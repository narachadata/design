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
      await loadMine();
      await loadFonts();
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
  /* ---------- 내 그림 (AI로 만든 그림 보관함) ----------
     디자인자료/내 그림/ 안에 그림 한 장마다 <id>.png + <id>.json(이름·검색어·프롬프트)을 따로 둠.
     목록 파일이 따로 없어서 두 PC가 동시에 저장해도 서로 덮어쓰지 않음 */
  const MINE = '내 그림';
  st.mine = [];
  async function mineDir(create) { return st.dir.getDirectoryHandle(MINE, { create: !!create }); }
  async function loadMine() {
    st.mine = [];
    let d; try { d = await mineDir(); } catch (e) { return; }
    const metas = [];
    for await (const [name, h] of d.entries()) if (h.kind === 'file' && name.endsWith('.json')) metas.push(h);
    await pool(metas, 8, async h => {
      try {
        const m = JSON.parse(await (await h.getFile()).text());
        const file = `${MINE}/${m.id}.png`, thumb = `${MINE}/${m.id}.thumb.jpg`;
        st.urls[file] = st.urls[file] || URL.createObjectURL(await blob(file));
        try { st.urls[thumb] = st.urls[thumb] || URL.createObjectURL(await blob(thumb)); } catch (e) {}
        st.mine.push(Object.assign({ kind: 'element', group: 'mine', cat: 'aiimg', file, thumb: st.urls[thumb] ? thumb : file }, m));
      } catch (e) {}
    });
    st.mine.sort((a, b) => (b.created || 0) - (a.created || 0));
  }
  async function writeBlob(dir, name, b) { const h = await dir.getFileHandle(name, { create: true }); const w = await h.createWritable(); await w.write(b); await w.close(); }
  async function thumbBlob(dataURL) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataURL; });
    const k = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return { blob: await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82)), ratio: img.naturalWidth / img.naturalHeight };
  }
  // AI 그림 한 장을 보관함에 저장
  async function saveMine(dataURL, meta) {
    if (!st.dir) { if (!(await NC.store.folderReady())) throw new Error('동기화 폴더가 연결되어 있지 않습니다 (저장 ▾ → 저장·동기화 설정)'); st.dir = await NC.store.state.dir.getDirectoryHandle(DIR, { create: true }); }
    const d = await mineDir(true);
    const id = 'ai-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const png = await (await fetch(dataURL)).blob(); const t = await thumbBlob(dataURL);
    await writeBlob(d, id + '.png', png); await writeBlob(d, id + '.thumb.jpg', t.blob);
    const m = { id, name: meta.name || 'AI 그림', kw: meta.kw || '', prompt: meta.prompt || '', style: meta.style || '', created: Date.now(), by: NC.store.pcName(), ratio: Math.round(t.ratio * 10000) / 10000 };
    await writeBlob(d, id + '.json', new Blob([JSON.stringify(m, null, 1)], { type: 'application/json' }));
    const file = `${MINE}/${id}.png`, thumb = `${MINE}/${id}.thumb.jpg`;
    st.urls[file] = URL.createObjectURL(png); st.urls[thumb] = URL.createObjectURL(t.blob);
    const it = Object.assign({ kind: 'element', group: 'mine', cat: 'aiimg', file, thumb }, m); st.mine.unshift(it);
    return it;
  }
  async function removeMine(id) {
    const d = await mineDir();
    for (const n of [id + '.png', id + '.thumb.jpg', id + '.json']) { try { await d.removeEntry(n); } catch (e) {} }
    st.mine = st.mine.filter(x => x.id !== id);
  }
  async function renameMine(id, name) {
    const it = st.mine.find(x => x.id === id); if (!it) return;
    it.name = name; const d = await mineDir(true);
    const m = { id: it.id, name, kw: it.kw, prompt: it.prompt, style: it.style, created: it.created, by: it.by, ratio: it.ratio };
    await writeBlob(d, id + '.json', new Blob([JSON.stringify(m, null, 1)], { type: 'application/json' }));
  }

  /* ---------- 자료실 글꼴 (디자인자료/글꼴/fonts.json) ----------
     공개 사이트에 올리면 안 되는 글꼴이라 동기화 폴더에만 둠. 목록에는 미리 만든 견본 그림만 보여 주고,
     글꼴 파일은 문서에서 실제로 쓸 때 그 글꼴만 읽어 @font-face(blob 주소)로 등록 */
  st.fonts = []; const fontLoading = {};
  async function loadFonts() {
    st.fonts = [];
    let meta; try { meta = JSON.parse(await (await blob('글꼴/fonts.json')).text()); } catch (e) { return; }
    for (const f of meta.fonts || []) { try { st.urls[f.preview] = st.urls[f.preview] || URL.createObjectURL(await blob(f.preview)); } catch (e) {} st.fonts.push(Object.assign({}, f, { previewUrl: st.urls[f.preview] || '' })); }
  }
  function fontInfo(family) { return st.fonts.find(f => f.family === family); }
  // 그 글꼴의 모든 굵기를 읽어 등록 (한 번만). 등록되면 true
  function ensureFont(family) {
    const f = fontInfo(family); if (!f) return Promise.resolve(false);
    if (!fontLoading[family]) fontLoading[family] = (async () => {
      let css = '';
      for (const fc of f.faces) { try { const u = st.urls[fc.file] || (st.urls[fc.file] = URL.createObjectURL(await blob(fc.file))); css += `@font-face{font-family:'${family}';src:url('${u}') format('${fc.format || 'woff2'}');font-weight:${fc.weight};font-display:block}\n`; } catch (e) {} }
      if (!css) return false;
      let el = document.getElementById('libfontCss'); if (!el) { el = document.createElement('style'); el.id = 'libfontCss'; document.head.appendChild(el); } el.textContent += css;
      try { await Promise.all(f.faces.map(fc => document.fonts.load(`${fc.weight} 20px '${family}'`, '가A'))); } catch (e) {}
      return true;
    })();
    return fontLoading[family];
  }

  return {
    fonts() { return st.fonts || []; }, ensureFont, isLibFont: fam => !!fontInfo(fam),
    st, load, url, dataURL, materialize, reset, saveMine, removeMine, renameMine, loadMine,
    mine() { return st.mine || []; },
    onReady(f) { st.listeners.push(f); },
    get ready() { return st.ready; },
    items(kind) { const base = st.ready ? st.data.items.filter(i => !kind || i.kind === kind) : []; return kind === 'element' || !kind ? (st.mine || []).concat(base) : base; },
    templates() { return st.ready ? st.data.templates : []; },
    item(id) { return st.ready ? st.data.items.find(i => i.id === id) : null; },
  };
})();
