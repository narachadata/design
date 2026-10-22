// 저장·동기화: 브라우저 자동 저장(IndexedDB) + 파일 연결(File System Access API) + 다른 PC 변경 감지
window.NC = window.NC || {};
NC.store = (function () {
  const DBN = 'naracal-v2';
  function open() { return new Promise((res, rej) => { const r = indexedDB.open(DBN, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function idbGet(k) { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
  async function idbSet(k, v) { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }
  async function idbDel(k) { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite').objectStore('kv').delete(k); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }

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
  function adopt(j) { state.lastSaveId = (j && j.saveId) || ''; state.lineage = (j && j.lineage) || (state.lastSaveId ? [state.lastSaveId] : []); }
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
  async function writeFile(doc) {
    if (!state.handle || state.saving || state.conflict) return false;
    state.saving = true;
    try {
      const f0 = await state.handle.getFile();
      if (state.lastMod && f0.lastModified > state.lastMod + 500) {
        let j = null; try { j = JSON.parse(await f0.text()); } catch (e) {}
        if (!j) { if (++state.retries < 4) return { retry: true }; } // 동기화 중이라 덜 받은 파일일 수 있음: 잠시 뒤 다시
        else if ((j.saveId || '') !== state.lastSaveId) return { conflict: true, file: f0, data: j };
      }
      const seq = state.seq, saveId = rid(), lineage = [saveId].concat(state.lineage).slice(0, 60);
      const w = await state.handle.createWritable();
      await w.write(JSON.stringify(Object.assign({}, doc, { saveId, lineage, savedBy: pcName(), pcId: pc().id, savedAt: Date.now() })));
      await w.close();
      state.lastSaveId = saveId; state.lineage = lineage; state.retries = 0;
      const f = await state.handle.getFile(); state.lastMod = f.lastModified; if (state.seq === seq) state.dirty = false;
      return true;
    } finally { state.saving = false; }
  }
  // 충돌 때 한쪽 내용을 따로 보관: 동기화 폴더가 있으면 그 안에 "충돌 사본" 파일로, 없으면 내려받기로
  async function writeCopy(data, label) {
    const t = new Date(), p2 = n => String(n).padStart(2, '0');
    const stamp = `${p2(t.getMonth() + 1)}-${p2(t.getDate())} ${p2(t.getHours())}${p2(t.getMinutes())}`;
    const base = (data.name || 'design').replace(/[\\/:*?"<>|]/g, '_').trim() || 'design';
    const name = `${base} (충돌 사본 ${stamp} ${String(label || '').replace(/[\\/:*?"<>|]/g, '_')})`;
    if (state.dir && (await folderReady())) {
      const h = await state.dir.getFileHandle(name + '.design.json', { create: true });
      const w = await h.createWritable(); await w.write(JSON.stringify(Object.assign({}, data, { name, saveId: '', lineage: [] }))); await w.close();
      return name + '.design.json';
    }
    download(Object.assign({}, data, { name })); return name + '.design.json (내려받기)';
  }
  async function disconnect() { state.handle = null; state.fileName = ''; state.lastMod = 0; adopt(null); await idbDel('fileHandle'); }
  // 다른 PC(동기화 폴더)에서 파일이 바뀌었는지 확인
  async function checkExternal() {
    if (!state.handle || state.saving || state.conflict) return null;
    try {
      const p = await state.handle.queryPermission({ mode: 'read' }); if (p !== 'granted') return null;
      const f = await state.handle.getFile();
      if (f.lastModified > state.lastMod + 500) { return { file: f, text: await f.text() }; }
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
  const SYNC_KEYS = ['naracal-ai-v1', 'naracal-recent-fonts', 'naracal-recent-elems', 'naracal-recent-tpls', 'naracal-recent-formats'];
  Object.assign(state, { dir: null, dirName: '', dirSupported: !!window.showDirectoryPicker, setMod: 0, setBase: {} });
  async function connectFolder() {
    if (!state.dirSupported) throw new Error('이 브라우저는 폴더 연결을 지원하지 않습니다 (Chrome, Edge 권장).');
    const h = await window.showDirectoryPicker({ id: 'naracha-sync', mode: 'readwrite' });
    state.dir = h; state.dirName = h.name; state.setMod = 0; state.setBase = {};
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
  async function disconnectFolder() { state.dir = null; state.dirName = ''; state.setMod = 0; state.setBase = {}; await idbDel('syncDir'); }
  async function folderReady() { try { return !!state.dir && (await state.dir.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { return false; } }
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
    if (r && r.f.lastModified > state.setMod + 500) { const m = mergeAll(L, state.setBase, r.vals); merged = SYNC_KEYS.some(k => m[k] !== L[k]); L = m; applyVals(L); }
    const h = await state.dir.getFileHandle(SET_FILE, { create: true });
    const w = await h.createWritable(); await w.write(JSON.stringify({ v: 1, updatedAt: Date.now(), savedBy: pcName(), values: L }, null, 1)); await w.close();
    state.setBase = L; state.setMod = (await h.getFile()).lastModified;
    return merged ? 'merged' : true;
  }
  // 다른 PC가 바꾼 설정을 가져옴 (이 PC에서 아직 안 올린 변경은 지킴). 가져왔으면 true
  async function pullSettings() {
    if (!(await folderReady())) return false;
    const r = await readRemote(); if (!r) return false;
    if (state.setMod && r.f.lastModified <= state.setMod + 500) return false;
    const first = !state.setMod, L = localSettings();
    applyVals(first ? Object.assign({}, L, r.vals) : mergeAll(L, state.setBase, r.vals));
    state.setBase = Object.assign({}, r.vals); state.setMod = r.f.lastModified; // 폴더에 없는 이 PC 값은 다음 올리기 때 올라감
    return true;
  }
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
  async function uniqueName(title) {
    const base = (title || 'design').replace(/[\\/:*?"<>|]/g, '_').trim() || 'design';
    const names = new Set((await listDocs()).map(d => d.name));
    let name = base + '.design.json'; for (let i = 2; names.has(name); i++) name = `${base} (${i}).design.json`;
    return name;
  }
  // 사본: 폴더에 새 파일로만 쓰고, 지금 작업 파일은 그대로 둠
  async function copyIntoFolder(data) {
    const h = await state.dir.getFileHandle(await uniqueName(data.name), { create: true });
    const w = await h.createWritable(); await w.write(JSON.stringify(Object.assign({}, data, { saveId: '', lineage: [], savedBy: pcName(), savedAt: Date.now() }))); await w.close();
    return h;
  }
  async function saveIntoFolder(doc) {
    const h = await state.dir.getFileHandle(await uniqueName(doc.name), { create: true });
    state.handle = h; state.fileName = h.name; state.lastMod = 0; await idbSet('fileHandle', h);
    await writeFile(doc);
    return h;
  }

  return { state, idbGet, idbSet, idbDel, connectNew, openExisting, reconnect, requestPermission, readFile, writeFile, disconnect, checkExternal, download, pickLocal,
    writeCopy, pcName, setPcName, adopt, descends,
    connectFolder, reconnectFolder, requestFolderPermission, disconnectFolder, folderReady, pushSettings, pullSettings, listDocs, inFolder, openHandle, saveIntoFolder, copyIntoFolder };
})();
