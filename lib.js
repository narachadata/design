// 나라차 자료실: 동기화 폴더 안 "디자인자료"(library.json + 파일)를 읽어 요소·사진·템플릿으로 보여 줌.
// 게티이미지 사진·지도진 사진처럼 공개 사이트에 올리면 안 되는 자료는 이 폴더(구글 드라이브)에만 있습니다.
// 문서에 넣을 때는 파일을 문서 안 이미지로 복사하므로, 만든 문서는 자료실이 없는 곳에서도 그대로 열립니다.
window.NC = window.NC || {};
NC.lib = (function () {
  const DIR = '디자인자료';
  const st = { ready: false, loading: null, data: null, dir: null, urls: {}, thumbOf: {}, listeners: [], error: '' };
  async function fileHandle(p) {
    let d = st.dir; const parts = p.split('/');
    for (const s of parts.slice(0, -1)) d = await d.getDirectoryHandle(s);
    return d.getFileHandle(parts[parts.length - 1]);
  }
  async function blob(p) { return (await fileHandle(p)).getFile(); }
  async function pool(list, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < list.length) { const x = list[i++]; await fn(x); } })); }
  function reset() { Object.values(st.urls).forEach(u => URL.revokeObjectURL(u)); Object.assign(st, { ready: false, loading: null, data: null, dir: null, urls: {}, thumbOf: {}, error: '' }); }
  // 폴더가 연결돼 있으면 목록과 미리보기(작은 그림·브랜드 요소)를 읽어 둠
  function load(force) {
    if (st.loading && !force) return st.loading;
    if (force) reset();
    st.loading = (async () => {
      if (!(await NC.store.folderReady())) return false;
      try { st.dir = await NC.store.state.dir.getDirectoryHandle(DIR); } catch (e) { st.error = 'none'; return false; }
      try { st.data = JSON.parse(await (await blob('library.json')).text()); } catch (e) { st.error = 'bad'; return false; }
      st.data.items = st.data.items || []; st.data.templates = st.data.templates || [];
      const want = new Set();
      st.data.items.forEach(it => { st.thumbOf[it.file] = it.thumb; want.add(it.thumb); if (it.kind === 'element') want.add(it.file); });
      // 템플릿 미리보기에 쓰이는 그림
      const walk = v => { if (typeof v === 'string' && v.startsWith('lib:')) want.add(v.slice(4)); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
      st.data.templates.forEach(t => walk(t.pages));
      await pool([...want], 8, async p => { if (st.urls[p]) return; try { st.urls[p] = URL.createObjectURL(await blob(p)); } catch (e) {} });
      st.ready = true; st.listeners.forEach(f => { try { f(); } catch (e) {} });
      return true;
    })();
    return st.loading;
  }
  // 화면 표시용 주소 (원본을 아직 안 읽었으면 작은 그림)
  function url(p) { return st.urls[p] || st.urls[st.thumbOf[p]] || ''; }
  async function dataURL(p) { const f = await blob(p); return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }
  // 문서에 넣기 전에 lib: 참조를 문서 이미지(addAsset)로 바꿈
  async function materialize(obj, addAsset) {
    const refs = new Set(); const walk = v => { if (typeof v === 'string' && v.startsWith('lib:')) refs.add(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(obj);
    const map = {}; for (const r of refs) map[r] = addAsset(await dataURL(r.slice(4)));
    const swap = v => { if (Array.isArray(v)) return v.map(swap); if (v && typeof v === 'object') { for (const k in v) v[k] = swap(v[k]); return v; } return typeof v === 'string' && map[v] ? map[v] : v; };
    return swap(obj);
  }
  return {
    st, load, url, dataURL, materialize, reset,
    onReady(f) { st.listeners.push(f); },
    get ready() { return st.ready; },
    items(kind) { return st.ready ? st.data.items.filter(i => !kind || i.kind === kind) : []; },
    templates() { return st.ready ? st.data.templates : []; },
    item(id) { return st.ready ? st.data.items.find(i => i.id === id) : null; },
  };
})();
