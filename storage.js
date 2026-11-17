// 저장·동기화: 브라우저 자동 저장(IndexedDB) + 파일 연결(File System Access API) + 다른 PC 변경 감지
window.NC = window.NC || {};
NC.store = (function () {
  const DBN = 'naracal-v2';
  /* 연결은 한 번 열어 다시 씀(다른 탭이 판을 올리면 닫고 다음에 새로). 쓰기는 요청 성공이 아니라 트랜잭션 완료(oncomplete)까지 기다려야 실제로 기록된 것 */
  let dbp = null;
  function open() { if (dbp) return dbp; dbp = new Promise((res, rej) => { const r = indexedDB.open(DBN, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); dbp = null; }; db.onclose = () => { dbp = null; }; res(db); }; r.onerror = () => { dbp = null; rej(r.error); }; }); return dbp; }
  async function idbGet(k) { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
  async function idbWrite(fn) { const db = await open(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); fn(tx.objectStore('kv')); tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error || new Error('브라우저 저장 실패')); }); }
  const idbSet = (k, v) => idbWrite(s => s.put(v, k)), idbDel = k => idbWrite(s => s.delete(k));
  /* 브라우저가 공간이 모자랄 때 이 사이트 자료를 마음대로 지우지 않도록 영구 보관 요청(한 번) */
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist().catch(() => {}); }).catch(() => {}); } catch (e) {}

  const state = { handle: null, fileName: '', lastMod: 0, dirty: false, saving: false, supported: !!window.showSaveFilePicker };
  const TYPES = [{ description: '디자인 공방 문서', accept: { 'application/json': ['.json'] } }];

  async function connectNew(doc) {
    if (!state.supported) throw new Error('이 브라우저는 파일 연결을 지원하지 않습니다 (Chrome, Edge 권장). 대신 "내려받기"를 쓰세요.');
    const h = await window.showSaveFilePicker({ suggestedName: (doc.name || 'design').replace(/[\\/:*?"<>|]/g, '_') + '.design.json', types: TYPES });
    state.handle = h; state.fileName = h.name; state.lastMod = 0;
    await idbSet('fileHandle', h);
    await writeFile(doc);
    return h;
  }
  async function openExisting() {
    if (!state.supported) return null;
    const [h] = await window.showOpenFilePicker({ types: TYPES, multiple: false });
    state.handle = h; state.fileName = h.name;
    await idbSet('fileHandle', h);
    return readFile();
  }
  async function reconnect() {
    try {
      const h = await idbGet('fileHandle'); if (!h) return 'none';
      state.handle = h; state.fileName = h.name;
      const p = await h.queryPermission({ mode: 'readwrite' });
      return p; // 'granted' | 'prompt' | 'denied'
    } catch (e) { return 'none'; }
  }
  async function requestPermission() {
    if (!state.handle) return false;
    const p = await state.handle.requestPermission({ mode: 'readwrite' });
    return p === 'granted';
  }
  // 이 PC 표시(동기화하지 않음): 저장할 때 "누가 저장했는지"를 파일에 남겨 충돌 안내에 씀
  function pc() {
    let p = null; try { p = JSON.parse(localStorage.getItem('naracal-pc') || 'null'); } catch (e) {}
    if (!p || !p.id) { p = { id: Math.random().toString(36).slice(2, 10), name: '' }; try { localStorage.setItem('naracal-pc', JSON.stringify(p)); } catch (e) {} }
    return p;
  }
  function pcName() { const p = pc(); return p.name || ('PC-' + p.id.slice(0, 4).toUpperCase()); }
  function setPcName(n) { const p = pc(); p.name = String(n || '').trim().slice(0, 20); try { localStorage.setItem('naracal-pc', JSON.stringify(p)); } catch (e) {} }
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  // 저장본 계보: saveId(이번 저장) + lineage(최근 저장 id들). 다른 PC가 내 마지막 저장을 이어받았는지 판단에 씀
  Object.assign(state, { lastSaveId: '', lineage: [], seq: 0, conflict: false, retries: 0 });
  function adopt(j) { state.lastSnap = 0; state.lastSaveId = (j && j.saveId) || ''; state.lineage = (j && j.lineage) || (state.lastSaveId ? [state.lastSaveId] : []); keepBase(j && j.docId); }
  // 이 브라우저 작업의 바탕 판(마지막으로 이어받거나 저장한 saveId) — 다시 열 때 그사이 다른 PC가 저장했는지 알아보는 데 씀
  function keepBase(docId) { if (state.lastSaveId) idbSet('docBase', { saveId: state.lastSaveId, docId: docId || '', t: Date.now() }).catch(() => {}); }
  // 파일 내용 j가 내 마지막 저장본을 이어받은 것인지 (아니면 서로 갈라진 것)
  function descends(j) { return !state.lastSaveId || ((j && j.lineage) || []).includes(state.lastSaveId); }
  async function readFile() {
    const f = await state.handle.getFile();
    state.lastMod = f.lastModified;
    const j = JSON.parse(await f.text());
    adopt(j);
    return j;
  }
  // 저장 전에 파일이 다른 PC에서 바뀌었는지 먼저 확인하고, 바뀌었으면 덮어쓰지 않고 { conflict } 를 돌려줌
  // 파일 판 j에는 있는데 지금 문서에는 없는 요소가 있는가 (덮으면 사라질 작업)
  function lostEls(j, doc) { const have = new Set(); (doc.pages || []).forEach(p => (p.els || []).forEach(e => have.add(e.id))); return (j.pages || []).some(p => (p.els || []).some(e => !have.has(e.id))); }
  async function writeFile(doc) {
    if (!state.handle || state.saving || state.conflict) return false;
    state.saving = true;
    try {
      const f0 = await state.handle.getFile();
      if (state.lastMod && f0.lastModified !== state.lastMod) { /* 시계가 어긋난 PC·늦게 도착한 판도 알아채도록 '달라졌으면' 내용 확인 */
        let j = null; try { j = JSON.parse(await f0.text()); } catch (e) {}
        if (!j) { /* 동기화 중이라 덜 받은 파일일 수 있음: 덮어쓰지 않고 잠시 뒤 다시. 4번째에 이 PC 작업을 충돌 사본으로 한 번 보관(예전엔 4번째에 덮어씀) */
          if (++state.retries === 4) { try { await writeCopy(doc, pcName() + ' 저장 대기'); } catch (e) {} }
          return { retry: true, held: state.retries >= 4 }; }
        else state.retries = 0;
        if (j && (j.saveId || '') !== state.lastSaveId) { if (window.NC && NC.live && NC.live.peers() && j.docId && j.docId === doc.docId) { if (!descends(j) && lostEls(j, doc)) { try { await writeCopy(j, (j.savedBy || '다른 PC') + ' 저장본'); } catch (e) {} } adopt(j); } else return { conflict: true, file: f0, data: j }; } // 실시간으로 같이 고치는 중이면 상대 저장본을 이어받아 그 다음 판으로 저장
      }
      const seq = state.seq, saveId = rid(), lineage = [saveId].concat(state.lineage).slice(0, 60);
      if (!doc.docId) doc.docId = rid(); // 버전 기록을 묶는 문서 번호 (이름을 바꾸거나 옮겨도 그대로)
      const text = JSON.stringify(Object.assign({}, doc, { saveId, lineage, savedBy: pcName(), pcId: pc().id, savedAt: Date.now() }));
      const w = await state.handle.createWritable();
      await w.write(text);
      await w.close();
      if (Date.now() - (state.lastSnap || 0) > SNAP_EVERY) { state.lastSnap = Date.now(); snapshot(doc.docId, text).catch(() => {}); }
      state.lastSaveId = saveId; state.lineage = lineage; state.retries = 0; keepBase(doc.docId);
      const f = await state.handle.getFile(); state.lastMod = f.lastModified; if (state.seq === seq) state.dirty = false;
      return true;
    } finally { state.saving = false; }
  }
  // 충돌 때 한쪽 내용을 따로 보관: 동기화 폴더가 있으면 그 안에 "충돌 사본" 파일로, 없으면 내려받기로
  async function writeCopy(data, label) {
    const t = new Date(), p2 = n => String(n).padStart(2, '0');
    const stamp = `${p2(t.getMonth() + 1)}-${p2(t.getDate())} ${p2(t.getHours())}${p2(t.getMinutes())}${p2(t.getSeconds())}`;
    const base = (data.name || 'design').replace(/[\\/:*?"<>|]/g, '_').trim() || 'design';
    let name = `${base} (충돌 사본 ${stamp} ${String(label || '').replace(/[\\/:*?"<>|]/g, '_')})`;
    if (!state.dir) { try { await reconnectFolder(); } catch (e) {} } // 시작 직후(폴더 연결 전)에도 폴더에 보관
    if (state.dir && (await folderReady())) {
      for (let n = 2, b0 = name; n < 50; n++) { try { await state.dir.getFileHandle(name + '.design.json'); name = `${b0} ${n}`; } catch (e) { break; } } /* 같은 초에 또 생겨도 앞 사본을 덮지 않게 */
      const h = await state.dir.getFileHandle(name + '.design.json', { create: true });
      const w = await h.createWritable(); await w.write(JSON.stringify(Object.assign({}, data, { name, saveId: '', lineage: [], docId: rid() }))); await w.close();
      return name + '.design.json';
    }
    download(Object.assign({}, data, { name })); return name + '.design.json (내려받기)';
  }
  /* ---------- 버전 기록: 동기화 폴더/.기록/<문서 번호>/<날짜-시각>_<PC>[_메모].json ----------
     저장할 때 15분에 한 번 남기고 문서마다 최근 40개만 둠. 점(.)으로 시작해 내 드라이브 목록에는 안 보임 */
  const SNAP_DIR = '.기록', SNAP_EVERY = 15 * 60 * 1000, SNAP_KEEP = 40;
  async function snapDir(docId, create) { if (!state.dir || !(await folderReady())) return null; const h = await state.dir.getDirectoryHandle(SNAP_DIR, { create: !!create }); return h.getDirectoryHandle(docId, { create: !!create }); }
  const clean = v => String(v || '').replace(/[\\/:*?"<>|_]/g, ' ').trim().slice(0, 40);
  async function snapshot(docId, text, memo) {
    const d = await snapDir(docId, true); if (!d) return false;
    const t = new Date(), p2 = n => String(n).padStart(2, '0'); const stamp = `${t.getFullYear()}${p2(t.getMonth() + 1)}${p2(t.getDate())}-${p2(t.getHours())}${p2(t.getMinutes())}${p2(t.getSeconds())}`;
    // 그림(data URL)은 그림 폴더에 한 번만 두고, 버전 파일에는 그림 이름만 (사진 많은 캘린더도 드라이브를 덜 차지)
    let j = null; try { j = JSON.parse(text); } catch (e) {}
    if (j && j.assets && Object.keys(j.assets).length) { const ad = await d.getDirectoryHandle('그림', { create: true }); for (const [k, v] of Object.entries(j.assets)) { try { await ad.getFileHandle(k + '.txt'); } catch (e) { const fh = await ad.getFileHandle(k + '.txt', { create: true }); const ww = await fh.createWritable(); await ww.write(v); await ww.close(); } } j.assetRefs = Object.keys(j.assets); delete j.assets; text = JSON.stringify(j); }
    const h = await d.getFileHandle(`${stamp}_${clean(pcName())}${memo ? '_' + clean(memo) : ''}.json`, { create: true }); const w = await h.createWritable(); await w.write(text); await w.close();
    const all = (await listSnapshots(docId)); const days = new Set(); for (const x of all.slice(SNAP_KEEP)) { const day = new Date(x.time).toDateString(); if (x.memo || (Date.now() - x.time < 30 * 864e5 && !days.has(day))) { days.add(day); continue; } try { await d.removeEntry(x.name); } catch (e) {} } /* 메모 붙은 판과 최근 30일 하루 한 판은 남김 */
    return true;
  }
  async function listSnapshots(docId) {
    let d; try { d = await snapDir(docId, false); } catch (e) { return []; } if (!d) return [];
    const out = [];
    for await (const [name, h] of d.entries()) { const m = name.match(/^(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)_([^_]*)(?:_(.*))?\.json$/); if (!m || h.kind !== 'file') continue; out.push({ name, handle: h, time: new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime(), pc: m[7], memo: m[8] || '' }); }
    return out.sort((a, b) => b.time - a.time);
  }
  async function readSnapshot(x, docId) {
    const f = await x.handle.getFile(); const j = Object.assign(JSON.parse(await f.text()), { _size: f.size });
    if (j.assetRefs) { j.assets = {}; let ad = null; try { ad = await (await snapDir(docId || j.docId, false)).getDirectoryHandle('그림'); } catch (e) {} for (const k of j.assetRefs) { try { j.assets[k] = await (await (await ad.getFileHandle(k + '.txt')).getFile()).text(); } catch (e) {} } delete j.assetRefs; }
    return j;
  }
  async function disconnect() { state.handle = null; state.fileName = ''; state.lastMod = 0; adopt(null); await idbDel('fileHandle'); }
  // 다른 PC(동기화 폴더)에서 파일이 바뀌었는지 확인
  async function checkExternal() {
    if (!state.handle || state.saving || state.conflict) return null;
    try {
      const p = await state.handle.queryPermission({ mode: 'read' }); if (p !== 'granted') return null;
      const f = await state.handle.getFile();
      if (f.lastModified !== state.lastMod) { return { file: f, text: await f.text() }; }
    } catch (e) {}
    return null;
  }
  function download(doc) {
    const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (doc.name || 'design').replace(/[\\/:*?"<>|]/g, '_') + '.design.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function pickLocal() {
    return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = () => { const f = i.files[0]; if (!f) return res(null); const r = new FileReader(); r.onload = () => { try { res(JSON.parse(r.result)); } catch (e) { res(null); } }; r.readAsText(f); }; i.click(); });
  }
  /* ---------- 동기화 폴더 (Google Drive 등): 설정값 + 모든 문서 ---------- */
  // 폴더 안: 설정.naracha.json(API 키·모델·최근 사용 목록) + *.design.json(문서들)
  const SET_FILE = '설정.naracha.json';
  const SYNC_KEYS = ['naracal-live', 'naracal-ai-v1', 'naracal-studio-presets', 'naracal-brand-colors', 'naracal-recent-colors', 'naracal-recent-fonts', 'naracal-recent-elems', 'naracal-recent-tpls', 'naracal-recent-formats', 'naracal-rules-saved', 'naracal-dojang'];
  Object.assign(state, { dir: null, dirName: '', dirSupported: !!window.showDirectoryPicker, setMod: 0, setBase: {} });
  async function connectFolder() {
    if (!state.dirSupported) throw new Error('이 브라우저는 폴더 연결을 지원하지 않습니다 (Chrome, Edge 권장).');
    const h = await window.showDirectoryPicker({ id: 'naracha-sync', mode: 'readwrite' });
    state.dir = h; state.dirName = h.name; state.setMod = 0; state.setBase = {}; try { localStorage.removeItem(BASE_KEY); } catch (e) {} // 다른 폴더: 기준 새로
    await idbSet('syncDir', h);
    return h;
  }
  async function reconnectFolder() {
    try {
      const h = await idbGet('syncDir'); if (!h) return 'none';
      state.dir = h; state.dirName = h.name;
      return await h.queryPermission({ mode: 'readwrite' });
    } catch (e) { return 'none'; }
  }
  async function requestFolderPermission() { if (!state.dir) return false; return (await state.dir.requestPermission({ mode: 'readwrite' })) === 'granted'; }
  async function disconnectFolder() { state.dir = null; state.dirName = ''; state.setMod = 0; state.setBase = {}; try { localStorage.removeItem(BASE_KEY); } catch (e) {} await idbDel('syncDir'); }
  async function folderReady() { try { return !!state.dir && (await state.dir.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { return false; } }
  const BASE_KEY = 'naracal-setbase';
  function saveBase() { try { localStorage.setItem(BASE_KEY, JSON.stringify(state.setBase || {})); } catch (e) {} }
  function loadBase() { try { const b = JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); return b && typeof b === 'object' && Object.keys(b).length ? b : null; } catch (e) { return null; } }
  function localSettings() { const o = {}; SYNC_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) o[k] = v; }); return o; }
  function applyVals(v) { for (const k of SYNC_KEYS) if (typeof v[k] === 'string' && localStorage.getItem(k) !== v[k]) { try { localStorage.setItem(k, v[k]); } catch (e) {} } }
  async function readRemote() {
    try { const f = await (await state.dir.getFileHandle(SET_FILE)).getFile(); const j = JSON.parse(await f.text()); return { f, vals: (j && j.values) || {} }; } catch (e) { return null; }
  }
  // 설정 합치기: 이 PC에서 마지막 동기화 뒤 바꾼 값은 이 PC 것, 아니면 폴더(다른 PC) 것.
  // AI 설정처럼 묶음 값은 항목별로 따져서, 두 PC가 서로 다른 항목을 바꿔도 둘 다 남음
  function obj(v) { try { const o = JSON.parse(v); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; } }
  function mergeVal(local, base, remote) {
    if (typeof remote !== 'string') return local;
    if (local === base || local == null) return remote;
    const L = obj(local), B = obj(base) || {}, R = obj(remote);
    if (!L || !R) return local;
    const out = Object.assign({}, R);
    for (const k of Object.keys(L)) if (JSON.stringify(L[k]) !== JSON.stringify(B[k])) out[k] = L[k];
    return JSON.stringify(out);
  }
  function mergeAll(L, B, R) { const o = {}; for (const k of SYNC_KEYS) { const v = mergeVal(L[k], B[k], R[k]); if (v != null) o[k] = v; } return o; }
  // 이 PC에서 바뀐 설정을 폴더에 씀. 그 사이 다른 PC가 바꾼 게 있으면 먼저 합침 ('merged' 반환)
  async function pushSettings(force) {
    if (!(await folderReady())) return false;
    let L = localSettings(), merged = false;
    if (!force && SYNC_KEYS.every(k => L[k] === state.setBase[k])) return false;
    const r = await readRemote();
    if (r && r.f.lastModified !== state.setMod) { const B = Object.keys(state.setBase || {}).length ? state.setBase : (loadBase() || state.setBase); const m = mergeAll(L, B, r.vals); merged = SYNC_KEYS.some(k => m[k] !== L[k]); L = m; applyVals(L); }
    const h = await state.dir.getFileHandle(SET_FILE, { create: true });
    const w = await h.createWritable(); await w.write(JSON.stringify({ v: 1, updatedAt: Date.now(), savedBy: pcName(), values: L }, null, 1)); await w.close();
    state.setBase = L; state.setMod = (await h.getFile()).lastModified; saveBase();
    return merged ? 'merged' : true;
  }
  // 다른 PC가 바꾼 설정을 가져옴 (이 PC에서 아직 안 올린 변경은 지킴). 가져왔으면 true
  async function pullSettings() {
    if (!(await folderReady())) return false;
    const r = await readRemote(); if (!r) return false;
    if (state.setMod && r.f.lastModified <= state.setMod + 500) return false;
    const first = !state.setMod, L = localSettings(), B0 = first ? loadBase() : null;
    /* 처음(창을 연 뒤 첫 가져오기): 지난번 맞춘 값을 기억하고 있으면 그걸 기준으로 합침 → 이 PC에서 그사이 바꾼 값을 지키고 다른 PC 값도 받음. 기억이 없으면 예전처럼 폴더 값 */
    applyVals(first ? (B0 ? mergeAll(L, B0, r.vals) : Object.assign({}, L, r.vals)) : mergeAll(L, state.setBase, r.vals));
    state.setBase = Object.assign({}, r.vals); state.setMod = r.f.lastModified; saveBase(); // 폴더에 없는 이 PC 값은 다음 올리기 때 올라감
    return true;
  }
  // 문서 번호(docId)로 동기화 폴더 안의 문서 파일 찾기 (영상 사본 → 원본 다시 가져오기용)
  async function findDocById(id) { if (!id) return null; const docs = await listDocs(); for (const x of docs) { try { const f = await x.handle.getFile(); if (f.size > 40 * 1024 * 1024) continue; const t = await f.text(); const m = t.match(/"docId":"([^"]+)"/); if (m && m[1] === id) return x.handle; } catch (e) {} } return null; }
  async function listDocs() {
    if (!(await folderReady())) return [];
    const out = [];
    for await (const [name, h] of state.dir.entries()) {
      if (h.kind !== 'file' || !/\.design\.json$/i.test(name)) continue;
      try { const f = await h.getFile(); out.push({ name, handle: h, lastModified: f.lastModified, size: f.size }); } catch (e) {}
    }
    return out.sort((a, b) => b.lastModified - a.lastModified);
  }
  async function inFolder(h) { if (!state.dir || !h) return false; try { return !!(await state.dir.resolve(h)); } catch (e) { return false; } }
  async function openHandle(h) { state.handle = h; state.fileName = h.name; await idbSet('fileHandle', h); return readFile(); }
  // 현재 문서를 폴더에 새 파일로 저장하고 연결 (이름이 겹치면 번호를 붙임)
  async function uniqueName(title, dir) {
    const base = (title || 'design').replace(/[\\/:*?"<>|]/g, '_').trim() || 'design';
    const names = new Set(); for await (const [n] of (dir || state.dir).entries()) names.add(n);
    let name = base + '.design.json'; for (let i = 2; names.has(name); i++) name = `${base} (${i}).design.json`;
    return name;
  }
  // 사본: 폴더에 새 파일로만 쓰고, 지금 작업 파일은 그대로 둠
  async function copyIntoFolder(data) {
    const h = await state.dir.getFileHandle(await uniqueName(data.name), { create: true });
    const w = await h.createWritable(); await w.write(JSON.stringify(Object.assign({}, data, { saveId: '', lineage: [], docId: rid(), savedBy: pcName(), savedAt: Date.now() }))); await w.close(); // 사본은 버전 기록을 따로
    return h;
  }
  async function saveIntoFolder(doc, path) {
    const dir = path && path.length ? await dirAt(path) : state.dir;
    const h = await dir.getFileHandle(await uniqueName(doc.name, dir), { create: true });
    state.handle = h; state.fileName = h.name; state.lastMod = 0; await idbSet('fileHandle', h);
    await writeFile(doc);
    return h;
  }

  /* ---------- 내 드라이브: 동기화 폴더 안의 하위 폴더 관리 ---------- */
  const HIDDEN = new Set(['디자인자료', '휴지통']);
  const TRASH = '휴지통';
  async function dirAt(path) { let d = state.dir; for (const p of path || []) d = await d.getDirectoryHandle(p); return d; }
  async function countItems(d) { let n = 0; for await (const [name, h] of d.entries()) if ((h.kind === 'directory' && !name.startsWith('.')) || /\.design\.json$/i.test(name)) n++; return n; }
  // 한 폴더의 하위 폴더와 디자인 목록
  async function listDir(path, opts) {
    opts = opts || {};
    const d = await dirAt(path); const folders = [], docs = [];
    for await (const [name, h] of d.entries()) {
      if (name.startsWith('.')) continue;
      if (h.kind === 'directory') { if (!opts.showHidden && !path.length && HIDDEN.has(name)) continue; folders.push({ name, handle: h, path: path.concat(name), count: await countItems(h).catch(() => 0) }); }
      else if (/\.design\.json$/i.test(name)) { try { const f = await h.getFile(); docs.push({ name, handle: h, path, lastModified: f.lastModified, size: f.size }); } catch (e) {} }
    }
    folders.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    docs.sort((a, b) => b.lastModified - a.lastModified);
    return { folders, docs };
  }
  // 모든 폴더를 돌며 디자인 찾기 (검색·최근 목록용, 휴지통·자료실 제외)
  async function walkDocs(path, out) {
    out = out || []; path = path || [];
    const { folders, docs } = await listDir(path); out.push(...docs);
    for (const f of folders) await walkDocs(f.path, out);
    return out;
  }
  async function allFolders(path, out) {
    out = out || [[]]; path = path || [];
    const { folders } = await listDir(path);
    for (const f of folders) { out.push(f.path); await allFolders(f.path, out); }
    return out;
  }
  async function makeFolder(path, name) {
    name = (name || '').replace(/[\\/:*?"<>|]/g, '_').trim(); if (!name) throw new Error('폴더 이름을 넣어 주세요');
    const d = await dirAt(path);
    for await (const [n] of d.entries()) if (n === name) throw new Error('같은 이름의 폴더가 이미 있습니다');
    return d.getDirectoryHandle(name, { create: true });
  }
  async function copyDir(src, dst) {
    for await (const [n, h] of src.entries()) {
      if (h.kind === 'directory') await copyDir(h, await dst.getDirectoryHandle(n, { create: true }));
      else { const f = await h.getFile(); const nh = await dst.getFileHandle(n, { create: true }); const w = await nh.createWritable(); await w.write(f); await w.close(); }
    }
  }
  // 파일·폴더 옮기기(이름 바꾸기 포함). 브라우저가 move를 지원하지 않으면 복사 후 지움
  async function moveEntry(entry, fromPath, toPath, newName) {
    const src = await dirAt(fromPath), dst = await dirAt(toPath);
    let name = newName || entry.name;
    if (entry.kind === 'file') {
      const base = name.replace(/\.design\.json$/i, '');
      if (dst !== src || name !== entry.name) { let taken = false; try { await dst.getFileHandle(name); taken = true; } catch (e) {} if (taken) name = await uniqueName(base, dst); }
    }
    try { if (entry.move) { await entry.move(dst, name); return entry; } } catch (e) {}
    if (entry.kind === 'file') {
      const f = await entry.getFile(); const nh = await dst.getFileHandle(name, { create: true });
      const w = await nh.createWritable(); await w.write(f); await w.close();
      await src.removeEntry(entry.name); return nh;
    }
    const nd = await dst.getDirectoryHandle(name, { create: true }); await copyDir(entry, nd);
    await src.removeEntry(entry.name, { recursive: true }); return nd;
  }
  async function toTrash(entry, fromPath) {
    const t = await state.dir.getDirectoryHandle(TRASH, { create: true });
    let name = entry.name, taken = false; try { entry.kind === 'file' ? await t.getFileHandle(name) : await t.getDirectoryHandle(name); taken = true; } catch (e) {}
    if (taken) name = entry.kind === 'file' ? await uniqueName(name.replace(/\.design\.json$/i, ''), t) : `${name} (${Date.now() % 100000})`;
    return moveEntry(entry, fromPath, [TRASH], name);
  }
  async function emptyEntry(name) { const t = await state.dir.getDirectoryHandle(TRASH); await t.removeEntry(name, { recursive: true }); }

  return { snapshot, listSnapshots, readSnapshot, state, idbGet, idbSet, idbDel, uniqueNameIn: uniqueName, dirAt, listDir, walkDocs, allFolders, makeFolder, moveEntry, toTrash, emptyEntry, TRASH, connectNew, openExisting, reconnect, requestPermission, readFile, writeFile, disconnect, checkExternal, download, pickLocal,
    writeCopy, pcName, setPcName, adopt, descends, pcId: () => pc().id,
    connectFolder, reconnectFolder, requestFolderPermission, disconnectFolder, folderReady, pushSettings, pullSettings, findDocById, listDocs, inFolder, openHandle, saveIntoFolder, copyIntoFolder };
})();
