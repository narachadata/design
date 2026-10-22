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
  return { state, idbGet, idbSet, idbDel, connectNew, openExisting, reconnect, requestPermission, readFile, writeFile, disconnect, checkExternal, download, pickLocal };
})();
