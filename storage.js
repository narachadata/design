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
    state.handle = h; state.fileName = h.name;
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
  async function readFile() {
    const f = await state.handle.getFile();
    state.lastMod = f.lastModified;
    const text = await f.text();
    return JSON.parse(text);
  }
  async function writeFile(doc) {
    if (!state.handle || state.saving) return false;
    state.saving = true;
    try {
      const w = await state.handle.createWritable();
      await w.write(JSON.stringify(doc));
      await w.close();
      const f = await state.handle.getFile(); state.lastMod = f.lastModified; state.dirty = false;
      return true;
    } finally { state.saving = false; }
  }
  async function disconnect() { state.handle = null; state.fileName = ''; state.lastMod = 0; await idbDel('fileHandle'); }
  // 다른 PC(동기화 폴더)에서 파일이 바뀌었는지 확인
  async function checkExternal() {
    if (!state.handle || state.saving) return null;
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
  const SYNC_KEYS = ['naracal-ai-v1', 'naracal-recent-fonts', 'naracal-recent-elems', 'naracal-recent-tpls'];
  Object.assign(state, { dir: null, dirName: '', dirSupported: !!window.showDirectoryPicker, setMod: 0, setLast: '' });
  async function connectFolder() {
    if (!state.dirSupported) throw new Error('이 브라우저는 폴더 연결을 지원하지 않습니다 (Chrome, Edge 권장).');
    const h = await window.showDirectoryPicker({ id: 'naracha-sync', mode: 'readwrite' });
    state.dir = h; state.dirName = h.name; state.setMod = 0; state.setLast = '';
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
  async function disconnectFolder() { state.dir = null; state.dirName = ''; state.setMod = 0; state.setLast = ''; await idbDel('syncDir'); }
  async function folderReady() { try { return !!state.dir && (await state.dir.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { return false; } }
  function localSettings() { const o = {}; SYNC_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) o[k] = v; }); return o; }
  // 이 PC의 설정을 폴더에 씀 (바뀐 게 있을 때만)
  async function pushSettings(force) {
    if (!(await folderReady())) return false;
    const s = JSON.stringify(localSettings()); if (!force && s === state.setLast) return false;
    const h = await state.dir.getFileHandle(SET_FILE, { create: true });
    const w = await h.createWritable(); await w.write(JSON.stringify({ v: 1, updatedAt: Date.now(), values: JSON.parse(s) }, null, 1)); await w.close();
    state.setLast = s; state.setMod = (await h.getFile()).lastModified;
    return true;
  }
  // 다른 PC가 바꾼 설정을 가져옴. 가져왔으면 true
  async function pullSettings() {
    if (!(await folderReady())) return false;
    let f; try { f = await (await state.dir.getFileHandle(SET_FILE)).getFile(); } catch (e) { return false; }
    if (state.setMod && f.lastModified <= state.setMod + 500) return false;
    let j; try { j = JSON.parse(await f.text()); } catch (e) { return false; }
    const vals = (j && j.values) || {};
    for (const k of SYNC_KEYS) if (typeof vals[k] === 'string') { try { localStorage.setItem(k, vals[k]); } catch (e) {} }
    state.setLast = JSON.stringify(localSettings()); state.setMod = f.lastModified;
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
  async function saveIntoFolder(doc) {
    const base = (doc.name || 'design').replace(/[\\/:*?"<>|]/g, '_').trim() || 'design';
    const names = new Set((await listDocs()).map(d => d.name));
    let name = base + '.design.json'; for (let i = 2; names.has(name); i++) name = `${base} (${i}).design.json`;
    const h = await state.dir.getFileHandle(name, { create: true });
    state.handle = h; state.fileName = h.name; await idbSet('fileHandle', h);
    await writeFile(doc);
    return h;
  }

  return { state, idbGet, idbSet, idbDel, connectNew, openExisting, reconnect, requestPermission, readFile, writeFile, disconnect, checkExternal, download, pickLocal,
    connectFolder, reconnectFolder, requestFolderPermission, disconnectFolder, folderReady, pushSettings, pullSettings, listDocs, inFolder, openHandle, saveIntoFolder };
})();
