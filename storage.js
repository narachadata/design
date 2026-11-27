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
    const h = await window.showSaveFilePicker({ suggestedName: (doc.name || 'design').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) + '.design.json', types: TYPES });
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
      let h = await idbGet('fileHandle'); if (!h) return 'none';
      if (h.__gd) { h = window.NC.gdrive ? await NC.gdrive.reviveAsync(h) : null; if (!h) return 'none'; } /* 구글 로그인 저장(앱 없이)의 문서 */
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
  function adopt(j) { state.lastIds = idsOf(j); state.gone = Array.isArray(j && j.gone) ? j.gone.slice(0, 300) : []; state.lastSnap = 0; state.lastSaveId = (j && j.saveId) || ''; state.lineage = (j && j.lineage) || (state.lastSaveId ? [state.lastSaveId] : []); keepBase(j && j.docId); remember(j); }
  /* 지운 요소 묘비(gone, 11/27 합치기 조): 지난 저장에 있었는데 이번에 없는 요소 번호 — 기준판 없이 합칠 때(합집합) 지운 요소가 되살아나지 않게. 다시 생기면(되돌리기) 뺌 */
  const idsOf = j => { const s = new Set(); ((j && j.pages) || []).forEach(p => (p.els || []).forEach(e => e && e.id && s.add(e.id))); return s; };
  function goneNow(d) { const now = idsOf(d), last = state.lastIds || now, g = new Set((state.gone || []).filter(x => !now.has(x))); last.forEach(x => { if (!now.has(x)) g.add(x); }); state.lastIds = now; return [...g].slice(-300); }
  /* 최근 판 기억(그림 빼고 8개, 이 브라우저): 다른 PC 판과 갈라졌을 때 「둘 다 가졌던 판」을 찾아 합치는 데 씀 (11/26 팀장님 「충돌 사본 대신 같이 작업」) */
  let VERS = null; const versLoad = () => VERS ? Promise.resolve(VERS) : idbGet('docVers').then(v => (VERS = Array.isArray(VERS) ? VERS : Array.isArray(v) ? v : [])).catch(() => (VERS = VERS || []));
  function remember(j) { if (!j || !j.saveId) return; versLoad().then(L => { if (L.some(v => v.id === j.saveId)) return; let t; try { t = JSON.stringify(Object.assign({}, j, { assets: undefined, _gdA: undefined })); } catch (e) { return; } L.unshift({ id: j.saveId, docId: j.docId || '', t, at: Date.now() });
    /* 11/27: 모든 문서 합쳐 8개뿐이라 1~2분 고치면 두 PC가 함께 가진 판이 밀려나던 것 → 문서마다 최근 3개 + 그 앞은 1분 이상 떨어진 판으로 10개까지, 모두 60개 */
    const per = new Map(), keep = []; for (const v of L) { const a = per.get(v.docId) || []; if (a.length < 3 || (a.length < 10 && (a[a.length - 1].at || 0) - (v.at || 0) >= 60000)) { a.push(v); per.set(v.docId, a); keep.push(v); } }
    L.length = 0; L.push(...keep.slice(0, 60)); idbSet('docVers', L).catch(() => {}); }); }
  async function verById(id) { if (!id) return null; const L = await versLoad(); const v = L.find(x => x.id === id); if (!v) return null; try { return JSON.parse(v.t); } catch (e) { return null; } }
  /* 두 판의 계보(saveId·lineage)가 함께 가진 가장 최근 판(이 브라우저에 기억된 것) — 새로 고침 직후처럼 내 마지막 판을 모를 때도 */
  async function commonBase(a, b) { const L = await versLoad(); if (!a || !b) return null; const B = new Set([b.saveId].concat(b.lineage || []).filter(Boolean)); for (const id of [a.saveId].concat(a.lineage || [])) { if (!id || !B.has(id)) continue; const v = L.find(x => x.id === id); if (v) { try { return JSON.parse(v.t); } catch (e) { return null; } } } return null; }
  async function baseFor(theirs) { const L = await versLoad(); if (!theirs) return null; const T = new Set([theirs.saveId].concat(theirs.lineage || []).filter(Boolean)); for (const id of [state.lastSaveId].concat(state.lineage || [])) { if (!id || !T.has(id)) continue; const v = L.find(x => x.id === id && (!theirs.docId || !x.docId || x.docId === theirs.docId)); if (v) { try { return JSON.parse(v.t); } catch (e) { return null; } } } return null; }
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
        let j = null, rerr = null; try { j = JSON.parse(await f0.text()); } catch (e) { if (e && e.name !== 'SyntaxError') rerr = e; }
        if (!j && rerr) return { retry: true };  /* 잠깐 못 읽음(다른 PC 사진을 아직 못 받음·인터넷·로그인) — 덮지 않고 다시, 충돌 사본은 만들지 않음 (11/25 점검) */
        if (!j) { /* 동기화 중이라 덜 받은 파일일 수 있음: 덮어쓰지 않고 잠시 뒤 다시. 4번째에 이 PC 작업을 충돌 사본으로 한 번 보관(예전엔 4번째에 덮어씀) */
          if (++state.retries === 4) { try { await keepLocal(doc, pcName() + ' 저장 대기 — 연결된 파일을 읽지 못함'); } catch (e) {} }  /* 11/27: 드라이브 사본 파일 대신 */
          return { retry: true, held: state.retries >= 4 }; }
        else state.retries = 0;
        if (j && (j.saveId || '') !== state.lastSaveId) { if (window.NC && NC.live && NC.live.peers() && j.docId && j.docId === doc.docId) { if (!descends(j) && lostEls(j, doc)) return { conflict: true, file: f0, data: j };  /* 11/26: 사본 대신 합치기(app.js mergeTheirs) */ adopt(j); } else return { conflict: true, file: f0, data: j }; } // 실시간으로 같이 고치는 중이면 상대 저장본을 이어받아 그 다음 판으로 저장
      }
      const seq = state.seq, saveId = rid(), lineage = [saveId].concat(state.lineage).slice(0, 60);
      if (!doc.docId) doc.docId = rid(); // 버전 기록을 묶는 문서 번호 (이름을 바꾸거나 옮겨도 그대로)
      const gone = goneNow(doc); state.gone = gone; const text = JSON.stringify(Object.assign({}, doc, { saveId, lineage, savedBy: pcName(), pcId: pc().id, savedAt: Date.now() }, gone.length ? { gone } : {}));
      const w = await state.handle.createWritable();
      await w.write(text);
      await w.close();
      if (Date.now() - (state.lastSnap || 0) > SNAP_EVERY) { state.lastSnap = Date.now(); snapshot(doc.docId, text).catch(() => {}); }
      state.lastSaveId = saveId; state.lineage = lineage; state.retries = 0; keepBase(doc.docId); remember(Object.assign({}, doc, { saveId, lineage, assets: undefined }, gone.length ? { gone } : {}));
      const f = await state.handle.getFile(); state.lastMod = f.lastModified; if (state.seq === seq) state.dirty = false;
      return true;
    } finally { state.saving = false; }
  }
  // 충돌 때 한쪽 내용을 따로 보관: 동기화 폴더가 있으면 그 안에 "충돌 사본" 파일로, 없으면 내려받기로
  /* 사본이 생긴 까닭 기록 (11/26 「배포 뒤 사본이 계속」 — 다음에 원인을 바로 보려고, 이 PC localStorage 최근 20개, 🔍 점검에 보임) */
  function noteCopy(name, why) { try { const L = JSON.parse(localStorage.getItem('naracal-copylog') || '[]'); L.unshift({ t: Date.now(), name: String(name || '').slice(0, 80), why: String(why || '').slice(0, 80), v: window.NARACAL_VER || '' }); localStorage.setItem('naracal-copylog', JSON.stringify(L.slice(0, 20))); } catch (e) {} }
  /* 11/27 팀장님 「송년회 포스터 충돌 사본이 6개 더」: 저절로 생기는 사본은 드라이브 파일로 만들지 않고 이 브라우저의 「직전 문서」에만 보관(저장 ▾ → 직전 문서 되살리기, 최근 6개) */
  async function keepLocal(data, label) { noteCopy((data && data.name) || '', '브라우저에만 보관: ' + (label || ''));
    try { const cp = JSON.parse(JSON.stringify(data)); delete cp.saveId; cp._keptAt = Date.now(); cp._why = String(label || ''); let L = (await idbGet('doc-prevs')) || []; L = [cp].concat(L.filter(x => x && !(x.docId === cp.docId && Math.abs((x._keptAt || 0) - cp._keptAt) < 60000))).slice(0, 6); await idbSet('doc-prevs', L); return '직전 문서(이 브라우저)'; } catch (e) { return ''; } }
  const copyAt = new Map();  /* 문서마다 마지막으로 사본 파일을 만든 때 — 10분 안에 또 생기면 파일 대신 브라우저에만 */
  async function writeCopy(data, label) {
    { const key = (data && (data.docId || data.name)) || ''; const t0 = copyAt.get(key) || Number(localStorage.getItem('naracal-copyat:' + key) || 0); if (Date.now() - t0 < 10 * 60e3) return keepLocal(data, label + ' (10분 안 거듭 — 파일 안 만듦)'); copyAt.set(key, Date.now()); try { localStorage.setItem('naracal-copyat:' + key, String(Date.now())); } catch (e) {} }
    noteCopy((data && data.name) || '', '공방: ' + (label || ''));
    const t = new Date(), p2 = n => String(n).padStart(2, '0');
    const stamp = `${p2(t.getMonth() + 1)}-${p2(t.getDate())} ${p2(t.getHours())}${p2(t.getMinutes())}${p2(t.getSeconds())}`;
    const base = (data.name || 'design').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'design';
    let name = `${base} (충돌 사본 ${stamp} ${String(label || '').replace(/[\\/:*?"<>|]/g, '_')})`;
    if (!state.dir) { try { await reconnectFolder(); } catch (e) {} } // 시작 직후(폴더 연결 전)에도 폴더에 보관
    if (state.dir && (await folderReady())) {
      for (let n = 2, b0 = name; n < 50; n++) { try { await state.dir.getFileHandle(name + '.design.json'); name = `${b0} ${n}`; } catch (e) { break; } } /* 같은 초에 또 생겨도 앞 사본을 덮지 않게 */
      const h = await state.dir.getFileHandle(name + '.design.json', { create: true });
      const w = await h.createWritable(); await w.write(JSON.stringify(Object.assign({}, data, { name, saveId: '', lineage: [], docId: rid(), copyOf: (data && data.saveId) || '' }))); await w.close();
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
    if (j && j.assets && Object.keys(j.assets).length) { const ad = await d.getDirectoryHandle('그림', { create: true }); for (const [k, v] of Object.entries(j.assets)) { let ok = false; try { ok = (await (await ad.getFileHandle(k + '.txt')).getFile()).size > 0; } catch (e) {} if (!ok && v) { const fh = await ad.getFileHandle(k + '.txt', { create: true }); const ww = await fh.createWritable(); await ww.write(v); await ww.close(); } } j.assetRefs = Object.keys(j.assets); delete j.assets; text = JSON.stringify(j); }
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
    if (j.assetRefs) { j.assets = {}; let ad = null; try { ad = await (await snapDir(docId || j.docId, false)).getDirectoryHandle('그림'); } catch (e) {} for (const k of j.assetRefs) { try { const tx = await (await (await ad.getFileHandle(k + '.txt')).getFile()).text(); if (tx) j.assets[k] = tx; } catch (e) {} }  /* 빈 조각은 건너뜀 — 되살릴 때 지금 문서의 같은 그림을 씀 */ delete j.assetRefs; }
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
    a.download = (doc.name || 'design').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) + '.design.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function pickLocal() {
    return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = () => { const f = i.files[0]; if (!f) return res(null); const r = new FileReader(); r.onload = () => { try { res(JSON.parse(r.result)); } catch (e) { res(null); } }; r.readAsText(f); }; i.click(); });
  }
  /* ---------- 동기화 폴더 (Google Drive 등): 설정값 + 모든 문서 ---------- */
  // 폴더 안: 설정.naracha.json(API 키·모델·최근 사용 목록) + *.design.json(문서들)
  const SET_FILE = '설정.naracha.json';
  const SYNC_KEYS = ['naracal-live', 'naracal-ai-v1', 'naracal-studio-presets', 'naracal-brand-colors', 'naracal-recent-colors', 'naracal-recent-fonts', 'naracal-recent-elems', 'naracal-recent-tpls', 'naracal-recent-formats', 'naracal-rules-saved', 'naracal-dojang', 'naracal-cert-serial', 'naracal-acct'];
  Object.assign(state, { dir: null, dirName: '', dirSupported: !!window.showDirectoryPicker, setMod: 0, setBase: {} });
  /* 구글 로그인으로 저장 (드라이브 앱 없이 — gdrive.js): 이 PC에 먼저 쓰고 드라이브에는 뒤에서 올림 */
  async function connectDrive() { const h = await NC.gdrive.connect(); return useFolder(h); }
  const isDrive = () => !!(state.dir && state.dir.__gd);
  async function connectFolder() {
    if (!state.dirSupported) throw new Error('이 브라우저는 폴더 연결을 지원하지 않습니다 (Chrome, Edge 권장).');
    const h = await window.showDirectoryPicker({ id: 'naracha-sync', mode: 'readwrite' });
    return useFolder(h);
  }
  async function useFolder(h) {
    state.dir = h; state.dirName = h.name; state.setMod = 0; state.setBase = {}; try { localStorage.removeItem(BASE_KEY); } catch (e) {} // 다른 폴더: 기준 새로
    await idbSet('syncDir', h);
    return h;
  }
  /* 고른 폴더가 다른 PC에서 쓰던 공방 폴더인지 (같은 구글 계정 확인용): 설정 파일의 저장한 PC·때, 맨 위 문서·폴더 수, 안에 나라차디자인공방 폴더가 있는지 */
  async function folderInfo() {
    const out = { name: state.dirName, set: null, docs: 0, folders: 0, child: null };
    if (!state.dir) return out;
    try { for await (const [n, h] of state.dir.entries()) { if (h.kind === 'file' && /\.design\.json$/i.test(n)) out.docs++; else if (h.kind === 'directory' && !n.startsWith('.')) { out.folders++; if (n === '나라차디자인공방') out.child = h; } } } catch (e) {}
    try { const f = await (await state.dir.getFileHandle(SET_FILE)).getFile(); const j = JSON.parse(await f.text()); out.set = { by: (j && j.savedBy) || '', at: (j && j.updatedAt) || f.lastModified }; } catch (e) {}
    return out;
  }
  async function reconnectFolder() {
    try {
      let h = await idbGet('syncDir'); if (!h) return 'none';
      if (h.__gd) { h = window.NC.gdrive ? await NC.gdrive.reviveAsync(h) : null; if (!h) return 'none'; }
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
  /* 상장 다음 번호: 두 PC가 따로 상장을 찍어도 번호가 뒤로 가지 않게 앞 글자별 큰 번호 (11/25 두 PC 점검) */
  function maxSerial(l, r) { const L = obj(l) || {}, R = obj(r) || {}, o = Object.assign({}, R); for (const k of Object.keys(L)) o[k] = Math.max(Number(L[k]) || 0, Number(R[k]) || 0); return Object.keys(o).length ? JSON.stringify(o) : (l != null ? l : r); }
  function mergeAll(L, B, R) { const o = {}; for (const k of SYNC_KEYS) { const v = k === 'naracal-cert-serial' ? maxSerial(L[k], R[k]) : mergeVal(L[k], B[k], R[k]); if (v != null) o[k] = v; } return o; }
  // 이 PC에서 바뀐 설정을 폴더에 씀. 그 사이 다른 PC가 바꾼 게 있으면 먼저 합침 ('merged' 반환)
  async function pushSettings(force) {
    if (!(await folderReady())) return false;
    let L = localSettings(), merged = false;
    if (!force && SYNC_KEYS.every(k => L[k] === state.setBase[k])) return false;
    const r = await readRemote();
    let B1 = state.setBase; if (r && r.f.lastModified !== state.setMod) { const B = Object.keys(state.setBase || {}).length ? state.setBase : (loadBase() || state.setBase); const m = mergeAll(L, B, r.vals); merged = SYNC_KEYS.some(k => m[k] !== L[k]); L = m; applyVals(L); B1 = r.vals; }
    if (isDrive()) state.setUnsent = { base: Object.assign({}, B1 || {}), at: Date.now() };  /* 11/26 데이터 조: 드라이브가 이 올리기를 충돌로 거절하면 이 기준으로 다시 합침 (내가 바꾼 칸이 사라지던 것) */
    const h = await state.dir.getFileHandle(SET_FILE, { create: true });
    const w = await h.createWritable(); await w.write(JSON.stringify({ v: 1, updatedAt: Date.now(), savedBy: pcName(), values: L }, null, 1)); await w.close();
    state.setBase = L; state.setMod = (await h.getFile()).lastModified; saveBase();
    return merged ? 'merged' : true;
  }
  // 다른 PC가 바꾼 설정을 가져옴 (이 PC에서 아직 안 올린 변경은 지킴). 가져왔으면 true
  async function pullSettings() {
    if (!(await folderReady())) return false;
    const r = await readRemote(); if (!r) return false;
    /* 구글 로그인 저장은 「때」가 쓴 PC의 시계라 PC끼리 시계가 조금 달라도 받게: 같은 판이면 건너뜀, 다르면 합침 (11/25) */
    if (state.setMod && (isDrive() ? r.f.lastModified === state.setMod : r.f.lastModified <= state.setMod + 500)) return false;
    const first = !state.setMod, L = localSettings(), B0 = first ? loadBase() : null;
    /* 처음(창을 연 뒤 첫 가져오기): 지난번 맞춘 값을 기억하고 있으면 그걸 기준으로 합침 → 이 PC에서 그사이 바꾼 값을 지키고 다른 PC 값도 받음. 기억이 없으면 예전처럼 폴더 값 */
    const U = state.setUnsent && Date.now() - state.setUnsent.at < 90000 ? state.setUnsent.base : null; state.setUnsent = null;
    applyVals(first ? (B0 ? mergeAll(L, B0, r.vals) : Object.assign({}, L, r.vals)) : mergeAll(L, U || state.setBase, r.vals));
    state.setBase = Object.assign({}, r.vals); state.setMod = r.f.lastModified; saveBase(); // 폴더에 없는 이 PC 값은 다음 올리기 때 올라감
    return true;
  }
  // 문서 번호(docId)로 동기화 폴더 안의 문서 파일 찾기 (영상 사본 → 원본 다시 가져오기용)
  async function findDocById(id, o) { if (!id) return null; let docs = []; try { docs = (await walkDocs()).sort((a, b) => ((a.path || [])[0] === TRASH) - ((b.path || [])[0] === TRASH)); } catch (e) { docs = await listDocs(); }  /* 11/26 데이터 조: 맨 위 폴더만 보던 것 — 하위 폴더까지 */ const cand = []; for (const x of docs) { if (o && o.main && (((x.path || [])[0] === TRASH) || /\(충돌 사본 /.test(x.name || ''))) continue;  /* 이어 저장할 본 문서만 (휴지통·충돌 사본 빼고) */ try { const f = await x.handle.getFile(); if (f.size > 40 * 1024 * 1024) continue; const t = await f.text(); const m = t.match(/"docId":"([^"]+)"/); if (m && m[1] === id) { const sid = (t.match(/"saveId":"([^"]+)"/) || [])[1] || '', lm = t.match(/"lineage":\[([^\]]*)\]/), lin = lm ? (lm[1].match(/"([^"]+)"/g) || []).map(q => q.slice(1, -1)) : []; cand.push({ h: x.handle, name: x.name || x.handle.name, trash: (x.path || [])[0] === TRASH, ids: new Set([sid].concat(lin).filter(Boolean)), lm: f.lastModified }); if (!o || (!o.lineage && !o.name)) break; } } catch (e) {} }
    /* 11/27 합치기 조: 같은 문서 번호의 파일이 여럿이면(드라이브 「사본 만들기」·탐색기 복사 등) 먼저 찾은 아무 파일에 붙어 두 문서가 섞이던 것 → ① 이 문서 계보와 겹치는 파일 ② 같은 이름 ③ 하나뿐일 때만. 여럿인데 아무것도 안 맞으면 붙이지 않음 */
    if (!cand.length) return null; const nonTrash = cand.filter(c => !c.trash), pool = nonTrash.length ? nonTrash : cand; if (pool.length === 1 && cand.length === 1) return pool[0].h;
    const L = (o && o.lineage || []).filter(Boolean); if (L.length) { const hit = pool.filter(c => L.some(x => c.ids.has(x))).sort((a, b) => L.findIndex(x => a.ids.has(x)) - L.findIndex(x => b.ids.has(x)) || b.lm - a.lm); if (hit.length) return hit[0].h; }
    if (o && o.name) { const nm = pool.find(c => c.name === o.name); if (nm) return nm.h; }
    return pool.length === 1 && !(o && o.strict) ? pool[0].h : null; }
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
    if (isDrive() && window.NC && NC.gdrive && NC.gdrive.fresh) { try { await NC.gdrive.fresh(); } catch (e) {} }  /* 11/26 데이터 조: 다른 PC가 몇 초 전에 만든 같은 이름을 못 보던 것 — 새 이름 정하기 직전에 드라이브 목록을 새로 */
    const base = (title || 'design').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'design';
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
    try { const M = JSON.parse(localStorage.getItem('naracal-trash-from') || '{}'); M[name] = (fromPath || []).filter(x => x !== TRASH); const ks = Object.keys(M); if (ks.length > 400) ks.slice(0, ks.length - 400).forEach(k => delete M[k]); localStorage.setItem('naracal-trash-from', JSON.stringify(M)); } catch (e) {}  /* 11/26 UI·UX 조: 되살리기가 늘 맨 위로 가던 것 → 원래 폴더로 */
    return moveEntry(entry, fromPath, [TRASH], name);
  }
  function trashFrom(name) { try { const p = JSON.parse(localStorage.getItem('naracal-trash-from') || '{}')[name]; return Array.isArray(p) ? p : null; } catch (e) { return null; } }
  /* 종류별 폴더 (팀장님 11/21): 폴더 만들기(없으면) · 아무 파일(PNG·PDF·영상) 쓰기 · 파일 목록 */
  async function ensureDir(path) { let d = state.dir; for (const p of path || []) d = await d.getDirectoryHandle(p, { create: true }); return d; }
  async function uniqueFile(name, dir) { const names = new Set(); for await (const [n] of dir.entries()) names.add(n); if (!names.has(name)) return name; const m = name.match(/^(.*?)(\.[^.]+)?$/); for (let i = 2; i < 999; i++) { const c = `${m[1]} (${i})${m[2] || ''}`; if (!names.has(c)) return c; } return Date.now() + '_' + name; }
  async function writeBlobAt(path, name, blob) { if (!(await folderReady())) return null; const d = await ensureDir(path); const nm = await uniqueFile(String(name || 'file').replace(/[\\/:*?"<>|]/g, '_'), d); const h = await d.getFileHandle(nm, { create: true }); const w = await h.createWritable(); await w.write(blob); await w.close(); return nm; }
  async function listFiles(path) { let d; try { d = await dirAt(path); } catch (e) { return []; } const out = []; for await (const [n, h] of d.entries()) { if (h.kind !== 'file' || n.startsWith('.')) continue; try { const f = await h.getFile(); out.push({ name: n, handle: h, size: f.size, lastModified: f.lastModified }); } catch (e) {} } return out.sort((a, b) => b.lastModified - a.lastModified); }
  async function emptyEntry(name, handle) { const t = await state.dir.getDirectoryHandle(TRASH); await t.removeEntry(name, handle && handle.__gd ? { recursive: true, handle } : { recursive: true }); }  /* 11/26: 구글 드라이브는 같은 이름이 둘일 수 있어 손잡이로 그 파일만 */

  return { ensureDir, writeBlobAt, listFiles, snapshot, listSnapshots, readSnapshot, state, idbGet, idbSet, idbDel, uniqueNameIn: uniqueName, dirAt, listDir, walkDocs, allFolders, makeFolder, moveEntry, toTrash, trashFrom, emptyEntry, TRASH, connectNew, openExisting, reconnect, requestPermission, readFile, writeFile, disconnect, checkExternal, download, pickLocal,
    writeCopy, pcName, setPcName, adopt, descends, baseFor, commonBase, verById, remember, noteCopy, keepLocal, pcId: () => pc().id,
    connectFolder, connectDrive, isDrive, useFolder, folderInfo, reconnectFolder, requestFolderPermission, disconnectFolder, folderReady, pushSettings, pullSettings, findDocById, listDocs, inFolder, openHandle, saveIntoFolder, copyIntoFolder };
})();
