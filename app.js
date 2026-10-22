(function () {
'use strict';
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const MM = 96 / 25.4;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;
let _uid = Date.now() % 100000; const uid = () => (_uid++).toString(36) + Math.random().toString(36).slice(2, 5);
const FONTS = window.NARACAL_FONTS;
const ASSETS = window.NARACAL_ASSETS;
const SIZES = [['desk', '탁상 캘린더 224×154', 224, 154], ['a4p', 'A4 세로 210×297', 210, 297], ['a4l', 'A4 가로 297×210', 297, 210], ['a3p', 'A3 세로 297×420', 297, 420], ['a3l', 'A3 가로 420×297', 420, 297], ['a5p', 'A5 세로 148×210', 148, 210], ['a5l', 'A5 가로 210×148', 210, 148], ['b5p', 'B5 세로 176×250', 176, 250], ['sq', '정사각 210×210', 210, 210], ['ig', 'SNS 정사각 1080px', 285.75, 285.75], ['story', 'SNS 세로 1080×1920px', 285.75, 508], ['card', '명함 90×50', 90, 50], ['a2p', '포스터 A2 420×594', 420, 594]];
const COLOR_NAMES = { '': '검정', red: '빨강', blue: '파랑', green: '초록', gray: '회색' };
const store = NC.store, CAL = NC.cal;

/* ---------- 문서 모델 ---------- */
let doc, cur = 0, sel = [], zoom = 0, hist = [], hptr = -1, editing = null, sideTab = 'pages', selDay = null, clip = null, lastTextStyle = null;
function newPage(bg) { return { id: uid(), bg: bg || '#ffffff', els: [], label: '' }; }
function newDoc(sz) { sz = sz || SIZES[0]; return { v: 2, name: '새 디자인', w: sz[2], h: sz[3], bleed: 0, cropMarks: false, pages: [newPage()], assets: {}, fonts: [], holidays: {}, showHolidays: true, calendar: clone(window.NARACAL_DEFAULTS), rules: clone(window.NARACAL_DEFAULTS.rules), updatedAt: Date.now() }; }
const page = () => doc.pages[cur];
const find = id => page().els.find(e => e.id === id);
const selEls = () => sel.map(find).filter(Boolean);
function src(ref) { if (!ref) return ''; if (ref.startsWith('asset:')) return ASSETS[ref.slice(6)] || ''; if (ref.startsWith('a:')) return doc.assets[ref.slice(2)] || ''; return ref; }
function addAsset(dataURL) { for (const k in doc.assets) if (doc.assets[k] === dataURL) return 'a:' + k; const id = uid(); doc.assets[id] = dataURL; return 'a:' + id; }
function gcAssets() { const used = new Set(); const walk = v => { if (typeof v === 'string' && v.startsWith('a:')) used.add(v.slice(2)); else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(doc.pages); walk(doc.calendar); for (const k in doc.assets) if (!used.has(k)) delete doc.assets[k]; }

/* ---------- 실행 취소 ---------- */
function snapshot() { const a = doc.assets; doc.assets = null; const s = JSON.stringify(doc); doc.assets = a; return s; }
function commit() { hist = hist.slice(0, hptr + 1); hist.push(snapshot()); if (hist.length > 80) hist.shift(); hptr = hist.length - 1; markDirty(); }
function restore(s) { const a = doc.assets; doc = JSON.parse(s); doc.assets = a; cur = clamp(cur, 0, doc.pages.length - 1); sel = sel.filter(id => find(id)); renderAll(); markDirty(); }
function undo() { if (hptr > 0) { hptr--; restore(hist[hptr]); } }
function redo() { if (hptr < hist.length - 1) { hptr++; restore(hist[hptr]); } }

/* ---------- 저장 · 동기화 ---------- */
let idbTimer, fileTimer;
function markDirty() {
  doc.updatedAt = Date.now(); store.state.dirty = true;
  clearTimeout(idbTimer); idbTimer = setTimeout(async () => { try { await store.idbSet('doc', doc); if (!store.state.handle) setStatus('브라우저에 저장됨 ' + tnow()); } catch (e) { setStatus('브라우저 저장 실패'); } }, 500);
  if (store.state.handle) { clearTimeout(fileTimer); fileTimer = setTimeout(saveFileNow, 1200); }
  updateSaveBadge();
}
async function saveFileNow() {
  try { const ok = await store.writeFile(doc); if (ok) setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); }
  catch (e) { setStatus('파일 저장 실패: ' + e.message); toast('파일 저장 실패: ' + e.message, true); }
  updateSaveBadge();
}
function tnow() { return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); }
function setStatus(t) { $('#status').textContent = t; }
function updateSaveBadge() { const b = $('#btnSave'); b.textContent = store.state.handle ? `저장·동기화 · ${store.state.fileName}` : '저장·동기화'; b.classList.toggle('on', !!store.state.handle); }
async function loadDoc(j, from) {
  if (!j || !j.pages) throw new Error('문서 형식이 아닙니다');
  if (j.v !== 2) throw new Error('이 프로그램의 문서 파일이 아닙니다');
  doc = Object.assign(newDoc(), j); doc.assets = doc.assets || {}; doc.holidays = doc.holidays || {}; doc.fonts = doc.fonts || [];
  cur = 0; sel = []; selDay = null; hist = []; hptr = -1;
  await registerDocFonts();
  $('#pname').value = doc.name || '';
  hist.push(snapshot()); hptr = 0;
  renderAll(); if (from) toast(from);
}
async function checkExternalChange() {
  const ch = await store.checkExternal(); if (!ch) return;
  let j; try { j = JSON.parse(ch.text); } catch (e) { return; }
  if (store.state.dirty && !window.confirm('다른 곳(다른 PC)에서 이 파일이 바뀌었습니다. 여기서 저장하지 않은 변경이 있습니다.\n\n확인: 파일의 새 내용을 불러옵니다 (여기 변경은 사라짐)\n취소: 여기 내용을 유지하고 파일에 덮어씁니다')) { store.state.lastMod = ch.file.lastModified; saveFileNow(); return; }
  store.state.lastMod = ch.file.lastModified; store.state.dirty = false;
  await loadDoc(j, '다른 PC에서 바뀐 내용을 불러왔습니다');
}
window.addEventListener('focus', checkExternalChange);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExternalChange(); });
setInterval(() => { if (!document.hidden) checkExternalChange(); }, 20000);
async function registerDocFonts() { for (const f of doc.fonts) { try { const ff = new FontFace(f.family, `url(${f.data})`); await ff.load(); document.fonts.add(ff); } catch (e) {} } }
function allFonts() { return FONTS.concat(doc.fonts.map(f => ({ family: f.family, label: f.family + ' (내 글꼴)', cat: 'mine', weights: [400, 700] }))); }

/* ---------- 요소 HTML ---------- */
function textStyle(el) {
  let s = `font-family:'${el.font}';font-size:${el.size}pt;font-weight:${el.weight};font-style:${el.italic ? 'italic' : 'normal'};color:${el.color};text-align:${el.align};line-height:${el.lh};letter-spacing:${el.ls}em;`;
  if (el.strokeW > 0) s += `-webkit-text-stroke:${el.strokeW}pt ${el.strokeC};paint-order:stroke fill;`;
  if (el.shadow) s += `filter:drop-shadow(${el.shX}mm ${el.shY}mm ${el.shB}mm ${hexA(el.shC, el.shA)});`;
  if (el.bg) s += `background:${el.bg};`;
  if (el.pad) s += `padding:${el.pad}mm;`;
  if (el.valign && el.valign !== 'top') s += `display:flex;flex-direction:column;justify-content:${el.valign === 'middle' ? 'center' : 'flex-end'};`;
  return s;
}
function hexA(hex, a) { if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return hex || '#000'; const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a == null ? 1 : a})`; }
function elHTML(el, mode, ext) {
  if (el.hidden) return '';
  let { x, y, w, h } = el;
  if (ext && mode === 'print') { const b = doc.bleed || 0; if (x <= 0.3) { x -= b; w += b; } if (x + w >= doc.w - 0.3) w += b; if (y <= 0.3) { y -= b; h += b; } if (y + h >= doc.h - 0.3) h += b; }
  const base = `left:${x}mm;top:${y}mm;width:${w}mm;${el.type === 'text' ? 'min-height' : 'height'}:${h}mm;transform:rotate(${el.rot || 0}deg);opacity:${el.opacity == null ? 1 : el.opacity};`;
  const lock = el.locked ? ' locked' : '';
  if (el.type === 'text') return `<div class="el el-text${lock}" data-id="${el.id}" style="${base}${textStyle(el)}">${esc(el.text)}</div>`;
  if (el.type === 'image') { const s = src(el.src); return `<div class="el el-image${lock}" data-id="${el.id}" style="${base}border-radius:${el.radius || 0}mm;overflow:hidden;${el.border ? `border:${el.borderW || 0.5}mm solid ${el.border};` : ''}${s ? '' : 'outline:0.4mm dashed rgba(0,0,0,.3);'}">${s ? `<img src="${s}" alt="" draggable="false" style="object-fit:${el.fit};object-position:${el.pos};transform:scaleX(${el.flip ? -1 : 1})">` : (mode === 'edit' ? '<div style="font-size:3.5mm;color:rgba(0,0,0,.4);text-align:center;padding-top:35%">그림 없음<br>오른쪽에서 넣기</div>' : '')}</div>`; }
  if (el.type === 'shape') {
    let st = base;
    if (el.kind === 'line') st += `height:${el.strokeW || 0.5}mm;background:${el.fill};`;
    else { st += `background:${el.fill};`; if (el.stroke && el.strokeW) st += `border:${el.strokeW}mm solid ${el.stroke};`; if (el.kind === 'ellipse') st += 'border-radius:50%;'; else if (el.kind === 'rect' && el.radius) st += `border-radius:${el.radius}mm;`; if (el.kind === 'tri') st += 'clip-path:polygon(50% 0,100% 100%,0 100%);'; if (el.kind === 'tab') st += 'clip-path:polygon(0 0,100% 0,100% 80%,0 100%);'; if (el.kind === 'star') st += 'clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);'; if (el.kind === 'arrow') st += 'clip-path:polygon(0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%);'; }
    return `<div class="el el-shape${lock}" data-id="${el.id}" style="${st}"></div>`;
  }
  if (el.type === 'cal') return `<div class="el el-cal${lock}" data-id="${el.id}" style="${base}">${CAL.calHTML(el, doc)}</div>`;
  if (el.type === 'mini') return `<div class="el el-mini${lock}" data-id="${el.id}" style="${base}">${CAL.miniHTML(el)}</div>`;
  return '';
}
function sheetHTML(pg, mode) {
  const b = mode === 'print' ? (doc.bleed || 0) : 0;
  return `<div class="sheet${mode === 'print' ? ' print' : ''}" style="--pw:${doc.w};--ph:${doc.h};--b:${b}mm"><div class="page" style="--bg:${pg.bg}"><div class="bgfill"></div>${pg.els.map(e => elHTML(e, mode, true)).join('')}</div>${(b > 0 && doc.cropMarks) ? marks(b) : ''}</div>`;
}
function marks(b) { const L = Math.max(0, b - 0.5), t = 0.15; return `<div class="marks">${[['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']].map(([x, y]) => `<i style="${x}:0;${y}:${b}mm;width:${L}mm;height:${t}mm"></i><i style="${y}:0;${x}:${b}mm;height:${L}mm;width:${t}mm"></i>`).join('')}</div>`; }

/* ---------- 캔버스 ---------- */
function kScale() { return Number($('#canvas').dataset.k) || 1; }
function renderCanvas() {
  const c = $('#canvas'); const pg = page();
  c.style.setProperty('--pw', doc.w); c.style.setProperty('--ph', doc.h); c.style.setProperty('--b', '0mm');
  c.innerHTML = `<div class="page" style="--bg:${pg.bg}"><div class="bgfill"></div>${pg.els.map(e => elHTML(e, 'edit')).join('')}</div>`;
  // 글 상자 높이 자동 맞춤
  pg.els.forEach(el => { if (el.type === 'text') { const d = c.querySelector(`[data-id="${el.id}"]`); if (d) { const hh = r1(d.offsetHeight / MM); if (hh > el.h + 0.05) el.h = hh; } } });
  fitCanvas(); renderOverlay();
  $('#pageLabel').textContent = `${cur + 1} / ${doc.pages.length}${pg.label ? ' · ' + pg.label : ''}`;
}
function fitCanvas() {
  const st = $('#stage'), w = st.clientWidth - 80, h = st.clientHeight - 140;
  const k = zoom || Math.min(w / (doc.w * MM), h / (doc.h * MM));
  const c = $('#canvas'); c.style.transform = `scale(${k})`; c.dataset.k = k;
  const wrap = $('#canvasWrap'); wrap.style.width = (doc.w * MM * k) + 'px'; wrap.style.height = (doc.h * MM * k) + 'px';
  const o = $('#ovl'); o.style.transform = `scale(${k})`; o.style.setProperty('--k', k); o.style.width = (doc.w * MM) + 'px'; o.style.height = (doc.h * MM) + 'px';
}
function renderOverlay(guides) {
  const o = $('#ovl'); const els = selEls();
  let h = '';
  els.forEach(el => {
    const single = els.length === 1;
    h += `<div class="sel${single ? '' : ' multi'}" style="left:${el.x}mm;top:${el.y}mm;width:${el.w}mm;height:${el.h}mm;transform:rotate(${el.rot || 0}deg)">`;
    if (single && !el.locked) { h += ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(d => `<div class="h ${d}" data-h="${d}"></div>`).join('') + '<div class="rotline"></div><div class="h rot" data-h="rot"></div>'; }
    h += '</div>';
  });
  (guides || []).forEach(g => { h += g.v != null ? `<div class="guide v" style="left:${g.v}mm"></div>` : `<div class="guide h" style="top:${g.h}mm"></div>`; });
  o.innerHTML = h;
}
let thumbTimer;
function renderThumbs() {
  const box = $('#thumbs'); if (!box) return;
  const tw = box.clientWidth - 12 || 200; const k = tw / (doc.w * MM);
  box.innerHTML = doc.pages.map((pg, i) => `<button class="thumb ${i === cur ? 'active' : ''}" data-i="${i}"><div class="tbox" style="height:${doc.h * MM * k}px">${sheetHTML(pg, 'thumb')}</div><div class="tlabel"><b>${i + 1}</b><span>${esc(pg.label || '')}</span></div></button>`).join('');
  box.querySelectorAll('.tbox .sheet').forEach(s => { s.style.transform = `scale(${k})`; });
}
function renderAll() { renderCanvas(); renderSide(); renderInspector(); }
function rerender(opts) { opts = opts || {}; renderCanvas(); if (!opts.noPanel) renderInspector(); clearTimeout(thumbTimer); thumbTimer = setTimeout(() => { if (sideTab === 'pages') renderThumbs(); else if (sideTab === 'layers') renderSide(); }, 150); }
function goto(i) { endEdit(); cur = clamp(i, 0, doc.pages.length - 1); sel = []; selDay = null; renderAll(); }
function select(ids) { endEdit(); sel = ids.filter(id => find(id)); selDay = null; renderOverlay(); renderInspector(); if (sideTab === 'layers') renderSide(); }

/* ---------- 포인터 조작 ---------- */
const wrap = $('#canvasWrap');
function toMM(e) { const r = $('#canvas').getBoundingClientRect(); const k = kScale(); return { x: (e.clientX - r.left) / k / MM, y: (e.clientY - r.top) / k / MM }; }
let drag = null, lastClick = null;
wrap.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  if (editing) { if (e.target.closest('.el-text.editing')) return; endEdit(); }
  const hd = e.target.closest('.ovl .h');
  const p = toMM(e);
  if (hd && sel.length === 1) { const el = find(sel[0]); drag = { kind: hd.dataset.h === 'rot' ? 'rot' : 'resize', dir: hd.dataset.h, el, start: p, o: clone(el), cx: el.x + el.w / 2, cy: el.y + el.h / 2, moved: false }; e.preventDefault(); return; }
  const dom = e.target.closest('.el');
  if (dom) {
    const id = dom.dataset.id, el = find(id); const was = sel.includes(id);
    if (el.type === 'text' && was && !el.locked && lastClick && lastClick.id === id && Date.now() - lastClick.t < 450) { lastClick = null; startEdit(dom); return; }
    lastClick = { id, t: Date.now() };
    if (e.shiftKey) { sel = was ? sel.filter(i => i !== id) : sel.concat(id); select(sel); }
    else if (!was) select([id]);
    if (el.type === 'cal' && was && !e.shiftKey) { const cell = e.target.closest('.cell'); if (cell && cell.dataset.day) { selDay = Number(cell.dataset.day); renderInspector(); const ds = $('#daySel'); if (ds) ds.scrollIntoView({ block: 'center' }); } }
    if (el.locked) return;
    drag = { kind: 'move', els: selEls().filter(x => !x.locked), start: p, orig: selEls().map(x => ({ id: x.id, x: x.x, y: x.y })), moved: false };
    e.preventDefault(); return;
  }
  if (!e.shiftKey) select([]);
  drag = { kind: 'marq', start: p, moved: false };
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = toMM(e); let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (Math.abs(dx) + Math.abs(dy) > 0.2) drag.moved = true;
  if (!drag.moved) return;
  if (drag.kind === 'move') {
    let guides = [];
    if (drag.els.length === 1 && !e.altKey) { const el = drag.els[0], o = drag.orig[0]; const sn = snap(o.x + dx, o.y + dy, el.w, el.h, el.id); dx = sn.x - o.x; dy = sn.y - o.y; guides = sn.guides; }
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    drag.els.forEach(el => { const o = drag.orig.find(q => q.id === el.id); el.x = r1(o.x + dx); el.y = r1(o.y + dy); });
    liveUpdate(drag.els); renderOverlay(guides);
  } else if (drag.kind === 'resize') {
    const el = drag.el, o = drag.o, rad = -(o.rot || 0) * Math.PI / 180;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad), ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    const d = drag.dir; let x = o.x, y = o.y, w = o.w, h = o.h;
    if (d.includes('e')) w = o.w + lx; if (d.includes('s')) h = o.h + ly;
    if (d.includes('w')) { w = o.w - lx; x = o.x + lx; } if (d.includes('n')) { h = o.h - ly; y = o.y + ly; }
    const keep = (el.type === 'image' || el.type === 'mini' || e.shiftKey) && d.length === 2;
    if (keep) { const ar = o.w / o.h; if (Math.abs(w - o.w) > Math.abs(h - o.h)) h = w / ar; else w = h * ar; if (d.includes('w')) x = o.x + o.w - w; if (d.includes('n')) y = o.y + o.h - h; }
    if (w < 2) { w = 2; if (d.includes('w')) x = o.x + o.w - 2; } if (h < 2) { h = 2; if (d.includes('n')) y = o.y + o.h - 2; }
    el.x = r1(x); el.y = r1(y); el.w = r1(w); el.h = r1(h);
    if (el.type === 'text' && (d === 'n' || d === 's')) { /* 세로 손잡이는 최소 높이만 */ }
    liveUpdate([el]); renderOverlay();
  } else if (drag.kind === 'rot') {
    const el = drag.el; let a = Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180 / Math.PI + 90; if (e.shiftKey) a = Math.round(a / 15) * 15; el.rot = Math.round(((a % 360) + 360) % 360); liveUpdate([el]); renderOverlay();
  } else if (drag.kind === 'marq') {
    const x = Math.min(drag.start.x, p.x), y = Math.min(drag.start.y, p.y), w = Math.abs(dx), h = Math.abs(dy);
    const ids = page().els.filter(el => !el.hidden && el.x < x + w && el.x + el.w > x && el.y < y + h && el.y + el.h > y).map(el => el.id);
    sel = ids; renderOverlay(); $('#ovl').insertAdjacentHTML('beforeend', `<div class="marq" style="left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm"></div>`);
  }
});
document.addEventListener('pointerup', e => {
  if (!drag) return; const d = drag; drag = null;
  if (d.kind === 'marq') { renderInspector(); if (sideTab === 'layers') renderSide(); renderOverlay(); return; }
  if (d.moved) { commit(); rerender(); } else renderOverlay();
});
function liveUpdate(els) { const c = $('#canvas'); els.forEach(el => { const dom = c.querySelector(`[data-id="${el.id}"]`); if (!dom) return; dom.style.left = el.x + 'mm'; dom.style.top = el.y + 'mm'; dom.style.width = el.w + 'mm'; dom.style[el.type === 'text' ? 'minHeight' : 'height'] = el.h + 'mm'; dom.style.transform = `rotate(${el.rot || 0}deg)`; if (el.type === 'cal' || el.type === 'mini') { /* 내용은 그대로 */ } }); }
function snap(x, y, w, h, selfId) {
  const T = 1.2, guides = [];
  const xs = [0, doc.w / 2, doc.w], ys = [0, doc.h / 2, doc.h];
  page().els.forEach(el => { if (el.id === selfId || el.hidden) return; xs.push(el.x, el.x + el.w / 2, el.x + el.w); ys.push(el.y, el.y + el.h / 2, el.y + el.h); });
  let bx = null, by = null, bdx = T, bdy = T;
  [[x, 0], [x + w / 2, w / 2], [x + w, w]].forEach(([v, off]) => xs.forEach(g => { const dd = Math.abs(v - g); if (dd < bdx) { bdx = dd; bx = g - off; guides.length && (guides.splice(0, guides.length)); guides.push({ v: g }); } }));
  const gx = guides.slice();
  [[y, 0], [y + h / 2, h / 2], [y + h, h]].forEach(([v, off]) => ys.forEach(g => { const dd = Math.abs(v - g); if (dd < bdy) { bdy = dd; by = g - off; gx.length = bx != null ? 1 : 0; gx.push({ h: g }); } }));
  return { x: bx != null ? bx : x, y: by != null ? by : y, guides: gx };
}
wrap.addEventListener('dblclick', e => { const dom = e.target.closest('.el-text'); if (dom && !find(dom.dataset.id).locked) startEdit(dom); });
function startEdit(dom) { editing = dom; dom.contentEditable = 'true'; dom.classList.add('editing'); dom.focus(); const r = document.createRange(); r.selectNodeContents(dom); const s = getSelection(); s.removeAllRanges(); s.addRange(r); renderOverlay(); }
function endEdit() { if (!editing) return; const dom = editing; editing = null; const el = find(dom.dataset.id); const t = dom.innerText.replace(/\n$/, ''); dom.contentEditable = 'false'; dom.classList.remove('editing'); if (el && t !== el.text) { el.text = t; commit(); } rerender(); }
$('#canvas').addEventListener('input', e => { if (editing && e.target === editing) { const el = find(editing.dataset.id); if (el) { const hh = r1(editing.offsetHeight / MM); if (hh !== el.h) { el.h = hh; renderOverlay(); } } } });
$('#canvas').addEventListener('blur', e => { if (editing && e.target === editing) endEdit(); }, true);
wrap.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoom = clamp((zoom || kScale()) * (e.deltaY < 0 ? 1.1 : 0.9), 0.1, 6); fitCanvas(); }, { passive: false });
$('#zoomIn').onclick = () => { zoom = clamp((zoom || kScale()) * 1.2, 0.1, 6); fitCanvas(); };
$('#zoomOut').onclick = () => { zoom = clamp((zoom || kScale()) / 1.2, 0.1, 6); fitCanvas(); };
$('#zoomFit').onclick = () => { zoom = 0; fitCanvas(); };
$('#prevPage').onclick = () => goto(cur - 1); $('#nextPage').onclick = () => goto(cur + 1);
window.addEventListener('resize', () => { fitCanvas(); renderThumbs(); });

document.addEventListener('keydown', e => {
  if (editing) { if (e.key === 'Escape') { e.preventDefault(); endEdit(); } return; }
  if (e.target.matches('input,textarea,select') || document.querySelector('dialog[open]')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
  if (mod && e.key.toLowerCase() === 'c') { if (sel.length) { clip = clone(selEls()); toast('복사했습니다'); } return; }
  if (mod && e.key.toLowerCase() === 'v') { if (clip) { const ids = clip.map(el => { const n = clone(el); n.id = uid(); n.x += 5; n.y += 5; page().els.push(n); return n.id; }); commit(); select(ids); rerender(); } return; }
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); select(page().els.map(x => x.id)); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.length) { e.preventDefault(); removeSel(); } return; }
  if (e.key === 'Escape') { select([]); return; }
  if (e.key.startsWith('Arrow')) { if (!sel.length) return; e.preventDefault(); const d = e.shiftKey ? 5 : 1; selEls().forEach(el => { if (el.locked) return; if (e.key === 'ArrowLeft') el.x -= d; if (e.key === 'ArrowRight') el.x += d; if (e.key === 'ArrowUp') el.y -= d; if (e.key === 'ArrowDown') el.y += d; }); commit(); rerender({ noPanel: false }); return; }
  if (e.key === 'PageDown') goto(cur + 1); if (e.key === 'PageUp') goto(cur - 1);
});
function removeSel() { page().els = page().els.filter(el => !sel.includes(el.id)); sel = []; commit(); rerender(); }
function duplicate() { if (!sel.length) return; const ids = selEls().map(el => { const n = clone(el); n.id = uid(); n.x += 5; n.y += 5; page().els.push(n); return n.id; }); commit(); select(ids); rerender(); }
function reorder(how) { if (sel.length !== 1) return; const els = page().els, i = els.findIndex(x => x.id === sel[0]); const [el] = els.splice(i, 1); if (how === 'front') els.push(el); else if (how === 'back') els.unshift(el); else if (how === 'up') els.splice(Math.min(els.length, i + 1), 0, el); else els.splice(Math.max(0, i - 1), 0, el); commit(); rerender(); }
$('#btnDup').onclick = duplicate; $('#btnDel').onclick = removeSel;
$('#btnFront').onclick = () => reorder('front'); $('#btnBack').onclick = () => reorder('back'); $('#btnUp').onclick = () => reorder('up'); $('#btnDown').onclick = () => reorder('down');
$$('[data-align]').forEach(b => b.onclick = () => {
  const els = selEls(); if (!els.length) return; const a = b.dataset.align;
  let bx = 0, by = 0, bw = doc.w, bh = doc.h;
  if (els.length > 1) { bx = Math.min(...els.map(e => e.x)); by = Math.min(...els.map(e => e.y)); bw = Math.max(...els.map(e => e.x + e.w)) - bx; bh = Math.max(...els.map(e => e.y + e.h)) - by; }
  els.forEach(el => { if (a === 'l') el.x = bx; if (a === 'c') el.x = r1(bx + (bw - el.w) / 2); if (a === 'r') el.x = r1(bx + bw - el.w); if (a === 't') el.y = by; if (a === 'm') el.y = r1(by + (bh - el.h) / 2); if (a === 'b') el.y = r1(by + bh - el.h); });
  commit(); rerender();
});
$('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;

/* ---------- 요소 추가 ---------- */
const TEXT_DEF = { type: 'text', text: '글자를 입력하세요', x: 20, y: 20, w: 80, h: 10, rot: 0, font: 'Noto Sans KR', size: 14, weight: 400, italic: false, color: '#1a1a1a', align: 'left', lh: 1.3, ls: 0, strokeW: 0, strokeC: '#ffffff', shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' };
function addEl(el, at) { el.id = uid(); if (at !== false) { el.x = r1(clamp((doc.w - el.w) / 2, 0, doc.w)); el.y = r1(clamp((doc.h - el.h) / 2, 0, doc.h)); } page().els.push(el); commit(); select([el.id]); rerender(); return el; }
function addText(preset) { const base = Object.assign({}, TEXT_DEF, lastTextStyle || {}); const p = preset === 'h' ? { text: '제목을 입력하세요', size: 36, weight: 700, w: 120, h: 16 } : preset === 's' ? { text: '부제목을 입력하세요', size: 20, weight: 500, w: 100, h: 10 } : { text: '본문 글을 입력하세요', size: 12, weight: 400, w: 90, h: 8 }; const el = addEl(Object.assign(base, p)); setTimeout(() => { const d = $(`#canvas [data-id="${el.id}"]`); if (d) startEdit(d); }, 50); }
function addShape(kind) { const def = { type: 'shape', kind, x: 0, y: 0, w: 40, h: kind === 'line' ? 0.6 : 40, rot: 0, fill: kind === 'line' ? '#333333' : '#F0716B', stroke: '', strokeW: kind === 'line' ? 0.6 : 0, radius: kind === 'rect' ? 0 : 0, opacity: 1, name: '' }; if (kind === 'line') def.w = 80; addEl(def); }
function addImage(ref) { const el = { type: 'image', src: ref, x: 0, y: 0, w: 60, h: 60, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }; const s = src(ref); if (s) { const i = new Image(); i.onload = () => { const ar = i.naturalWidth / i.naturalHeight; el.h = r1(el.w / ar); if (el.h > doc.h * 0.8) { el.h = r1(doc.h * 0.8); el.w = r1(el.h * ar); } el.x = r1((doc.w - el.w) / 2); el.y = r1((doc.h - el.h) / 2); rerender(); commit(); }; i.src = s; } addEl(el); }
function addCal() { const y = doc.calendar.year || new Date().getFullYear(); const el = { type: 'cal', year: y, month: 1, x: 0, y: 0, w: Math.min(204, doc.w - 20), h: Math.min(100, doc.h - 30), rot: 0, opacity: 1, s: {}, events: [], notes: [], name: '달력' }; addEl(el); }
function addMini() { const y = doc.calendar.year || new Date().getFullYear(); addEl({ type: 'mini', year: y, month: 1, x: 0, y: 0, w: 42, h: 24, rot: 0, opacity: 1, s: {}, name: '미니 달력' }); }
function fileToDataURL(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }

/* ---------- 왼쪽 패널 ---------- */
$$('.sidetabs button').forEach(b => b.onclick = () => { sideTab = b.dataset.tab; $$('.sidetabs button').forEach(x => x.setAttribute('aria-selected', x === b)); renderSide(); });
function renderSide() {
  const body = $('#sidebody'); const yearNow = doc.calendar.year || 2027;
  if (sideTab === 'pages') {
    body.innerHTML = `<div class="row" style="margin-bottom:8px"><button class="btn sm" id="pgAdd">+ 새 페이지</button><button class="btn sm" id="pgDup">복제</button><button class="btn sm" id="pgUp">↑</button><button class="btn sm" id="pgDown">↓</button><button class="btn sm danger" id="pgDel">삭제</button></div><div id="thumbs"></div>`;
    renderThumbs();
    $('#thumbs').onclick = e => { const b = e.target.closest('.thumb'); if (b) goto(Number(b.dataset.i)); };
    $('#pgAdd').onclick = () => { doc.pages.splice(cur + 1, 0, newPage(page().bg)); commit(); goto(cur + 1); };
    $('#pgDup').onclick = () => { const n = clone(page()); n.id = uid(); n.els.forEach(e => e.id = uid()); doc.pages.splice(cur + 1, 0, n); commit(); goto(cur + 1); };
    $('#pgDel').onclick = () => { if (doc.pages.length === 1) { toast('마지막 페이지는 지울 수 없습니다', true); return; } if (!window.confirm(`${cur + 1}쪽을 지울까요?`)) return; doc.pages.splice(cur, 1); commit(); goto(Math.min(cur, doc.pages.length - 1)); };
    $('#pgUp').onclick = () => { if (cur === 0) return; [doc.pages[cur - 1], doc.pages[cur]] = [doc.pages[cur], doc.pages[cur - 1]]; commit(); goto(cur - 1); };
    $('#pgDown').onclick = () => { if (cur >= doc.pages.length - 1) return; [doc.pages[cur + 1], doc.pages[cur]] = [doc.pages[cur], doc.pages[cur + 1]]; commit(); goto(cur + 1); };
  } else if (sideTab === 'add') {
    body.innerHTML = `<h3>글자</h3><div class="tile"><button data-add="text:h"><span class="t-h">제목</span></button><button data-add="text:s"><span class="t-s">부제목</span></button><button data-add="text:b">본문 글</button></div>
    <h3>도형</h3><div class="tile" style="grid-template-columns:repeat(4,1fr)">${[['rect', '▭', '사각형'], ['ellipse', '●', '원'], ['tri', '▲', '삼각형'], ['line', '—', '선'], ['tab', '⬒', '탭'], ['star', '★', '별'], ['arrow', '➜', '화살표']].map(([k, ic, t]) => `<button data-add="shape:${k}" title="${t}"><span class="ic">${ic}</span><small>${t}</small></button>`).join('')}</div>
    <h3>달력 요소</h3><div class="tile"><button data-add="cal"><span class="ic">▦</span>월간 달력</button><button data-add="mini"><span class="ic">▤</span>미니 달력</button></div>
    <h3>이미지</h3><div class="tile"><label><span class="ic">⬆</span>파일 올리기<input type="file" accept="image/*" id="addImgFile" hidden multiple></label><button data-add="aiimg"><span class="ic">✦</span>AI로 만들기</button></div>
    <p class="hint">추가한 요소는 끌어서 옮기고, 손잡이로 크기와 회전을 바꿉니다. 글자는 두 번 눌러 고칩니다.</p>`;
    body.onclick = e => { const b = e.target.closest('[data-add]'); if (!b) return; const [t, a] = b.dataset.add.split(':'); if (t === 'text') addText(a); else if (t === 'shape') addShape(a); else if (t === 'cal') addCal(); else if (t === 'mini') addMini(); else if (t === 'aiimg') openAI('image'); };
    $('#addImgFile').onchange = async e => { for (const f of e.target.files) { addImage(addAsset(await fileToDataURL(f))); } e.target.value = ''; };
  } else if (sideTab === 'tpl') {
    body.innerHTML = `<h3>캘린더 마법사</h3>
    <label class="f"><span>연도</span><input type="number" id="wzYear" value="${yearNow}" min="2000" max="2100"></label>
    <label class="f"><span>구성</span><select id="wzKind"><option value="full">탁상 인성 캘린더 전체 (26쪽)</option><option value="months">월간 달력 페이지만 (12쪽)</option><option value="virtues">인성 페이지만 (12쪽)</option></select></label>
    <label class="f"><span>넣는 방식</span><select id="wzMode"><option value="replace">문서를 새로 만들기 (224×154)</option><option value="append">현재 문서 뒤에 추가</option></select></label>
    <button class="btn primary full" id="wzGo">만들기</button>
    <p class="hint">2026년 디자인을 바탕으로 ${yearNow}년 초안을 만듭니다. 내용(덕목·명언·실천·사자성어)은 AI 도우미에서 새로 받거나 직접 고칩니다. 공휴일은 상단 "공휴일"에서 가져와야 달력에 표시됩니다.</p>
    <h3>페이지 템플릿 (현재 페이지 뒤에 추가)</h3>
    <div class="row" style="margin-bottom:6px"><label class="f" style="margin:0;flex:1"><span>월</span><select id="tplMonth">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join('')}</select></label></div>
    <div class="tile"><button data-tpl="cover">표지</button><button data-tpl="back">뒷표지</button><button data-tpl="virtue">인성 페이지</button><button data-tpl="cal">달력 페이지</button></div>
    <h3>문서 크기</h3>
    <label class="f"><select id="docSize">${SIZES.map(s => `<option value="${s[0]}" ${s[2] === doc.w && s[3] === doc.h ? 'selected' : ''}>${s[1]}</option>`).join('')}<option value="custom">직접 입력</option></select></label>
    <div class="grid2"><label class="f"><span>가로(mm)</span><input type="number" id="docW" value="${doc.w}" step="0.5"></label><label class="f"><span>세로(mm)</span><input type="number" id="docH" value="${doc.h}" step="0.5"></label></div>
    <button class="btn full" id="docSizeApply">크기 적용 (모든 페이지)</button>
    <h3>인쇄 설정</h3>
    <div class="grid2"><label class="f"><span>도련(mm)</span><input type="number" id="docBleed" value="${doc.bleed}" min="0" max="10" step="0.5"></label><label class="chk" style="margin-top:18px"><input type="checkbox" id="docMarks" ${doc.cropMarks ? 'checked' : ''}> 재단선</label></div>
    <p class="hint">인쇄소 납품용 PDF는 보통 도련 3mm를 둡니다. 페이지 가장자리에 닿은 배경·도형·그림은 도련까지 자동으로 늘어납니다.</p>`;
    $('#wzGo').onclick = () => {
      const year = Number($('#wzYear').value), kind = $('#wzKind').value, mode = $('#wzMode').value;
      doc.calendar.year = year;
      if (mode === 'replace') { if (!window.confirm('현재 문서의 페이지를 모두 지우고 새로 만듭니다. 계속할까요?')) return; doc.w = 224; doc.h = 154; doc.pages = []; doc.name = `${year} 인성 캘린더`; $('#pname').value = doc.name; }
      const pages = CAL.buildPages(doc, uid, { year, kind });
      doc.pages.push(...pages); commit(); goto(mode === 'replace' ? 0 : doc.pages.length - pages.length);
      toast(`${pages.length}쪽을 만들었습니다`);
      if (!doc.holidays[year]) setTimeout(() => openHoliday(year), 400);
    };
    body.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => { const kind = b.dataset.tpl, month = Number($('#tplMonth').value); const pages = CAL.buildPages(doc, uid, { year: yearNow, kind, month }); doc.pages.splice(cur + 1, 0, ...pages); commit(); goto(cur + 1); });
    $('#docSize').onchange = e => { const s = SIZES.find(x => x[0] === e.target.value); if (s) { $('#docW').value = s[2]; $('#docH').value = s[3]; } };
    $('#docSizeApply').onclick = () => { const w = Number($('#docW').value), h = Number($('#docH').value); if (!(w > 10 && h > 10)) return; doc.w = w; doc.h = h; commit(); zoom = 0; renderAll(); toast('문서 크기를 바꿨습니다'); };
    $('#docBleed').onchange = e => { doc.bleed = Number(e.target.value) || 0; commit(); };
    $('#docMarks').onchange = e => { doc.cropMarks = e.target.checked; commit(); };
  } else if (sideTab === 'img') {
    const groups = [['2026 삽화', k => k.startsWith('illu-')], ['마스코트', k => k.startsWith('mascot-')], ['로고·아이콘', k => !k.startsWith('illu-') && !k.startsWith('mascot-')]];
    const mine = Object.keys(doc.assets);
    body.innerHTML = `<div class="row" style="margin-bottom:6px"><label class="btn sm">파일 올리기<input type="file" accept="image/*" id="imgFile" hidden multiple></label><button class="btn sm ai" id="imgAI">AI로 만들기</button></div>
    <p class="hint">그림을 누르면 페이지에 추가됩니다. 이미지 요소를 선택한 상태면 그 그림을 바꿉니다.</p>
    ${mine.length ? `<h3>내 이미지 (${mine.length})</h3><div class="picker">${mine.map(k => `<button data-img="a:${k}"><img src="${doc.assets[k]}" alt=""></button>`).join('')}</div>` : ''}
    ${groups.map(([t, f]) => { const ks = Object.keys(ASSETS).filter(f); return `<h3>${t}</h3><div class="picker">${ks.map(k => `<button data-img="asset:${k}" title="${k}"><img src="${ASSETS[k]}" alt="${k}"></button>`).join('')}</div>`; }).join('')}`;
    body.onclick = e => { const b = e.target.closest('[data-img]'); if (!b) return; const ref = b.dataset.img; const s = selEls(); if (s.length === 1 && s[0].type === 'image') { s[0].src = ref; commit(); rerender(); toast('그림을 바꿨습니다'); } else addImage(ref); };
    $('#imgFile').onchange = async e => { for (const f of e.target.files) addImage(addAsset(await fileToDataURL(f))); e.target.value = ''; renderSide(); };
    $('#imgAI').onclick = () => openAI('image');
  } else if (sideTab === 'layers') {
    const els = page().els.slice().reverse();
    body.innerHTML = `<h3>${cur + 1}쪽 레이어 (${els.length}) · 위가 앞</h3><div>${els.map(el => `<div class="layer ${sel.includes(el.id) ? 'active' : ''}" data-id="${el.id}"><span>${esc(elName(el))}</span><button data-vis="${el.id}" class="${el.hidden ? '' : 'on'}" title="보이기">${el.hidden ? '○' : '◉'}</button><button data-lock="${el.id}" class="${el.locked ? 'on' : ''}" title="잠금">${el.locked ? '🔒' : '🔓'}</button></div>`).join('') || '<p class="hint">요소가 없습니다</p>'}</div>`;
    body.onclick = e => { const v = e.target.closest('[data-vis]'); if (v) { const el = find(v.dataset.vis); el.hidden = !el.hidden; commit(); rerender(); renderSide(); return; } const l = e.target.closest('[data-lock]'); if (l) { const el = find(l.dataset.lock); el.locked = !el.locked; commit(); renderOverlay(); renderSide(); return; } const row = e.target.closest('.layer'); if (row) select(e.shiftKey ? sel.concat(row.dataset.id) : [row.dataset.id]); };
  }
}
function elName(el) { if (el.name) return el.name; if (el.type === 'text') return (el.text || '글자').split('\n')[0].slice(0, 20); if (el.type === 'image') return '이미지'; if (el.type === 'shape') return ({ rect: '사각형', ellipse: '원', tri: '삼각형', line: '선', tab: '탭', star: '별', arrow: '화살표' })[el.kind] || '도형'; if (el.type === 'cal') return `${el.year}년 ${el.month}월 달력`; if (el.type === 'mini') return `미니 달력 ${el.month}월`; return el.type; }

/* ---------- 속성 패널 ---------- */
const F = (label, k, v, o = {}) => {
  const val = v == null ? '' : v;
  if (o.type === 'textarea') return `<label class="f"><span>${label}</span><textarea data-k="${k}" rows="${o.rows || 3}">${esc(val)}</textarea></label>`;
  if (o.type === 'range') return `<label class="f"><span>${label} <small>${val}</small></span><input data-k="${k}" type="range" min="${o.min}" max="${o.max}" step="${o.step}" value="${val}"></label>`;
  if (o.type === 'color') return `<label class="f"><span>${label}</span><input data-k="${k}" type="color" value="${esc(val || '#000000')}"></label>`;
  if (o.type === 'check') return `<label class="chk"><input data-k="${k}" type="checkbox" ${val ? 'checked' : ''}> ${label}</label>`;
  if (o.type === 'select') return `<label class="f"><span>${label}</span><select data-k="${k}">${o.options.map(([a, t]) => `<option value="${a}" ${String(a) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  return `<label class="f"><span>${label}</span><input data-k="${k}" type="${o.type || 'text'}" value="${esc(val)}" ${o.step ? `step="${o.step}"` : ''} ${o.min != null ? `min="${o.min}" max="${o.max}"` : ''}></label>`;
};
// 글꼴 고르기: 각 항목이 자기 글꼴 모양으로 보이는 목록
function fontLabel(fam) { const f = allFonts().find(x => x.family === fam); return f ? f.label : fam; }
const fontPicker = (k, cur_) => `<button type="button" class="fp-btn" data-fp="${k}" data-cur="${esc(cur_)}" style="font-family:'${esc(cur_)}'"><span>${esc(fontLabel(cur_))}</span><i>▾</i></button>`;
let fpState = { cat: 'all', q: '' };
function openFontPop(btn) {
  closeFontPop();
  const k = btn.dataset.fp, cur_ = btn.dataset.cur;
  const pop = document.createElement('div'); pop.id = 'fpPop';
  const cats = [['all', '전체'], ['title', '제목'], ['brush', '붓'], ['hand', '손글씨'], ['body', '본문'], ['latin', '영문'], ['mine', '내 글꼴']];
  const render = () => {
    const list = allFonts().filter(f => (fpState.cat === 'all' || f.cat === fpState.cat) && (!fpState.q || (f.label + f.family).toLowerCase().includes(fpState.q.toLowerCase())));
    pop.innerHTML = `<div class="fp-head"><input type="text" id="fpQ" placeholder="글꼴 찾기" value="${esc(fpState.q)}"><div class="fp-cats">${cats.map(([c, t]) => `<button type="button" data-fc="${c}" class="${fpState.cat === c ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="fp-list">${list.map(f => `<div class="fp-row ${f.family === cur_ ? 'on' : ''}" data-font="${esc(f.family)}" style="font-family:'${esc(f.family)}'"><span class="sm">나라차 태권도 가나다 ABC 123</span><span class="nm">${esc(f.label)}</span></div>`).join('') || '<div class="hint" style="padding:10px">맞는 글꼴이 없습니다</div>'}</div>
    <div class="fp-foot"><button type="button" class="btn sm" id="fpMore">글꼴 둘러보기·내 글꼴 올리기</button></div>`;
    const q = pop.querySelector('#fpQ'); q.oninput = () => { fpState.q = q.value; const pos = q.selectionStart; render(); const q2 = pop.querySelector('#fpQ'); q2.focus(); q2.setSelectionRange(pos, pos); };
  };
  render();
  const r = btn.getBoundingClientRect(); document.body.appendChild(pop);
  const h = Math.min(380, window.innerHeight - 20); pop.style.maxHeight = h + 'px';
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 328)) + 'px';
  pop.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
  pop.onclick = e => {
    const c = e.target.closest('[data-fc]'); if (c) { fpState.cat = c.dataset.fc; render(); return; }
    const row = e.target.closest('[data-font]'); if (row) { applyFontChoice(k, row.dataset.font); closeFontPop(); return; }
    if (e.target.id === 'fpMore') { closeFontPop(); openFonts(); }
  };
  setTimeout(() => { const q = pop.querySelector('#fpQ'); if (q) q.focus(); }, 0);
}
function closeFontPop() { const p = $('#fpPop'); if (p) p.remove(); }
function applyFontChoice(k, fam) { const el = selEls()[0]; if (!el) return; setK(el, k, fam); if (el.type === 'text') lastTextStyle = Object.assign({}, lastTextStyle || {}, { font: fam }); commit(); rerender(); }
document.addEventListener('pointerdown', e => { if ($('#fpPop') && !e.target.closest('#fpPop') && !e.target.closest('.fp-btn')) closeFontPop(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#fpPop')) { closeFontPop(); e.stopPropagation(); } }, true);
function renderInspector() {
  const ins = $('#inspector'); const els = selEls();
  if (!els.length) {
    const pg = page();
    ins.innerHTML = `<h2>${cur + 1}쪽 <small style="font-weight:400;color:#6b7280">${doc.w}×${doc.h}mm</small></h2>
    ${F('페이지 이름', 'pg.label', pg.label)}${F('배경색', 'pg.bg', pg.bg, { type: 'color' })}
    <div class="row">${['#ffffff', '#FFE89A', '#E6EDF2', '#FDE7E4', '#E8F3EA', '#F3EAF6', '#1E2B5A', '#1a1a1a'].map(c => `<button class="btn sm" data-pgbg="${c}" style="background:${c};width:26px;height:26px;padding:0;border-radius:50%" title="${c}"></button>`).join('')}</div>
    <h3>문서</h3>${F('문서 이름', 'doc.name', doc.name)}
    <p class="hint">요소를 누르면 그 요소의 속성이 여기에 나옵니다. 빈 곳을 끌면 여러 요소를 한꺼번에 고릅니다.</p>
    <h3>공휴일</h3><p class="hint">${Object.keys(doc.holidays).length ? '가져온 연도: ' + Object.keys(doc.holidays).sort().map(y => `${y}년(${doc.holidays[y].length})`).join(', ') : '아직 가져온 공휴일 정보가 없습니다.'}</p><button class="btn sm" id="insHol">공휴일 가져오기·편집</button>`;
    ins.onclick = e => { const b = e.target.closest('[data-pgbg]'); if (b) { pg.bg = b.dataset.pgbg; commit(); rerender(); } if (e.target.id === 'insHol') openHoliday(); };
    return;
  }
  if (els.length > 1) { ins.innerHTML = `<h2>${els.length}개 선택</h2><p class="hint">위 도구 막대의 정렬 버튼으로 맞추거나, 끌어서 함께 옮길 수 있습니다. Delete로 모두 지웁니다.</p>${F('투명도', 'multi.opacity', els[0].opacity, { type: 'range', min: 0, max: 1, step: 0.05 })}<div class="row"><button class="btn sm" id="mLock">모두 잠금</button><button class="btn sm" id="mUnlock">잠금 해제</button></div>`; ins.onclick = e => { if (e.target.id === 'mLock') { els.forEach(x => x.locked = true); commit(); renderOverlay(); } if (e.target.id === 'mUnlock') { els.forEach(x => x.locked = false); commit(); renderOverlay(); } }; return; }
  const el = els[0];
  let h = `<h2>${esc(elName(el))} <button class="btn sm ${el.locked ? 'on' : ''}" data-k="locked" data-toggle="1">${el.locked ? '잠김' : '잠금'}</button></h2>`;
  const geo = `<h3>위치·크기</h3><div class="grid4">${F('X', 'x', el.x, { type: 'number', step: 0.5 })}${F('Y', 'y', el.y, { type: 'number', step: 0.5 })}${F('너비', 'w', el.w, { type: 'number', step: 0.5 })}${F('높이', 'h', el.h, { type: 'number', step: 0.5 })}</div><div class="grid2">${F('회전(°)', 'rot', el.rot || 0, { type: 'number', step: 1 })}${F('투명도', 'opacity', el.opacity == null ? 1 : el.opacity, { type: 'range', min: 0, max: 1, step: 0.05 })}</div>${F('이름', 'name', el.name)}`;
  if (el.type === 'text') {
    h += `<h3>글자</h3>${F('내용', 'text', el.text, { type: 'textarea', rows: 4 })}
    <div class="row"><label class="f" style="flex:1;margin:0"><span>글꼴</span>${fontPicker('font', el.font)}</label><button class="btn sm" id="fontBrowse" style="margin-top:16px">둘러보기</button></div>
    <div class="grid3">${F('크기(pt)', 'size', el.size, { type: 'number', step: 0.5, min: 2, max: 400 })}${F('굵기', 'weight', el.weight, { type: 'select', options: [[300, '가늘게'], [400, '보통'], [500, '중간'], [600, '약간 굵게'], [700, '굵게'], [800, '아주 굵게'], [900, '최대']] })}${F('색', 'color', el.color, { type: 'color' })}</div>
    <div class="row"><div class="seg" style="flex:1">${[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([a, t]) => `<button data-set="align:${a}" aria-pressed="${el.align === a}">${t}</button>`).join('')}</div><div class="seg" style="flex:1">${[['top', '위'], ['middle', '중앙'], ['bottom', '아래']].map(([a, t]) => `<button data-set="valign:${a}" aria-pressed="${(el.valign || 'top') === a}">${t}</button>`).join('')}</div></div>
    <div class="grid3">${F('줄 간격', 'lh', el.lh, { type: 'number', step: 0.05, min: 0.5, max: 4 })}${F('자간(em)', 'ls', el.ls, { type: 'number', step: 0.01, min: -0.2, max: 1 })}${F('기울임', 'italic', el.italic, { type: 'check' })}</div>
    <h3>효과</h3><div class="grid2">${F('외곽선 두께(pt)', 'strokeW', el.strokeW, { type: 'number', step: 0.25, min: 0, max: 20 })}${F('외곽선 색', 'strokeC', el.strokeC, { type: 'color' })}</div>
    ${F('그림자', 'shadow', el.shadow, { type: 'check' })}<div class="grid4">${F('색', 'shC', el.shC, { type: 'color' })}${F('진하기', 'shA', el.shA, { type: 'number', step: 0.05, min: 0, max: 1 })}${F('가로', 'shX', el.shX, { type: 'number', step: 0.1 })}${F('세로', 'shY', el.shY, { type: 'number', step: 0.1 })}</div>${F('번짐(mm)', 'shB', el.shB, { type: 'number', step: 0.1, min: 0 })}
    <div class="grid2">${F('상자 배경색', 'bg', el.bg || '#ffffff', { type: 'color' })}${F('안쪽 여백(mm)', 'pad', el.pad, { type: 'number', step: 0.5, min: 0 })}</div><div class="row"><button class="btn sm" data-set="bg:">배경 없음</button>${el.role ? `<span class="hint" style="margin:0">역할: ${el.role}${el.month ? ' · ' + el.month + '월' : ''} (AI 문구 적용 대상)</span>` : ''}</div>` + geo;
  } else if (el.type === 'image') {
    h += `<h3>그림</h3><div class="imgprev">${src(el.src) ? `<img src="${src(el.src)}" alt="">` : '<span class="hint">그림 없음</span>'}</div>
    <div class="row"><label class="btn sm">바꾸기(파일)<input type="file" accept="image/*" id="imgReplace" hidden></label><button class="btn sm" id="imgLib">보관함에서</button><button class="btn sm ai" id="imgAI">AI로 만들기</button></div>
    <div class="row" style="margin-top:6px"><button class="btn sm" id="imgWhite" ${src(el.src) ? '' : 'disabled'}>흰 배경 지우기</button><button class="btn sm" id="imgFitBox">비율대로 상자 맞춤</button></div>
    <div class="grid2">${F('채우기', 'fit', el.fit, { type: 'select', options: [['contain', '안에 맞춤'], ['cover', '꽉 채움(잘림)'], ['fill', '늘림']] })}${F('정렬', 'pos', el.pos, { type: 'select', options: [['50% 50%', '가운데'], ['50% 100%', '아래'], ['50% 0%', '위'], ['0% 50%', '왼쪽'], ['100% 50%', '오른쪽'], ['0% 100%', '왼쪽 아래'], ['100% 100%', '오른쪽 아래']] })}</div>
    <div class="grid3">${F('좌우 뒤집기', 'flip', el.flip, { type: 'check' })}${F('모서리(mm)', 'radius', el.radius, { type: 'number', step: 0.5, min: 0 })}${F('테두리 두께', 'borderW', el.borderW || 0, { type: 'number', step: 0.25, min: 0 })}</div>${F('테두리 색', 'border', el.border || '#000000', { type: 'color' })}<button class="btn sm" data-set="border:">테두리 없음</button>` + geo;
  } else if (el.type === 'shape') {
    h += `<h3>도형</h3>${F('종류', 'kind', el.kind, { type: 'select', options: [['rect', '사각형'], ['ellipse', '원'], ['tri', '삼각형'], ['line', '선'], ['tab', '탭'], ['star', '별'], ['arrow', '화살표']] })}
    <div class="grid2">${F('채우기 색', 'fill', el.fill, { type: 'color' })}${F('모서리(mm)', 'radius', el.radius, { type: 'number', step: 0.5, min: 0 })}</div>
    <div class="grid2">${F('선 색', 'stroke', el.stroke || '#000000', { type: 'color' })}${F('선 두께(mm)', 'strokeW', el.strokeW, { type: 'number', step: 0.1, min: 0 })}</div><button class="btn sm" data-set="stroke:">선 없음</button>` + geo;
  } else if (el.type === 'cal') {
    const s = Object.assign({}, CAL.CAL_DEF, el.s || {}); const dim = CAL.daysIn(el.year, el.month);
    const hol = (doc.holidays[el.year] || []); const holNames = selDay ? hol.filter(x => x.date === `${el.year}-${String(el.month).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`).map(x => x.name) : [];
    const evs = selDay ? (el.events || []).map((e, k) => ({ e, k })).filter(x => x.e.d === selDay) : [];
    const allEv = (el.events || []).map((e, k) => ({ e, k })).sort((a, b) => a.e.d - b.e.d);
    h += `<h3>달력</h3><div class="grid2">${F('연도', 'year', el.year, { type: 'number', min: 1900, max: 2100 })}${F('월', 'month', el.month, { type: 'select', options: Array.from({ length: 12 }, (_, i) => [i + 1, (i + 1) + '월']) })}</div>
    <p class="hint">${hol.length ? `${el.year}년 공휴일 ${hol.length}개 적용 중` : `${el.year}년 공휴일 정보가 없습니다.`} <button class="btn sm" id="calHol">가져오기·편집</button></p>
    <h3>일정</h3><label class="f"><span>날짜 (달력 칸을 눌러도 됩니다)</span><select id="daySel"><option value="">날짜 선택</option>${Array.from({ length: dim }, (_, d) => d + 1).map(d => `<option value="${d}" ${d === selDay ? 'selected' : ''}>${el.month}월 ${d}일 (${CAL.WD.ko1[new Date(el.year, el.month - 1, d).getDay()]})</option>`).join('')}</select></label>
    ${selDay ? `${holNames.length ? `<p class="hint">공휴일: ${holNames.join(', ')}</p>` : ''}<div class="evlist">${evs.map(({ e, k }) => `<div class="evrow"><input type="text" data-ev="${k}" value="${esc(e.text)}" placeholder="일정 내용"><select data-evc="${k}">${Object.entries(COLOR_NAMES).map(([c, t]) => `<option value="${c}" ${(e.color || '') === c ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="x" data-evdel="${k}">×</button></div>`).join('')}</div><button class="btn sm primary" id="evAdd">+ 이 날짜에 일정 추가</button>` : ''}
    <h3>이달의 일정 (${allEv.length})</h3><ul class="list">${allEv.map(({ e, k }) => `<li data-godate="${e.d}"><b>${e.d}일</b><span>${esc(e.text)}</span><button class="x" data-evdel="${k}">×</button></li>`).join('') || '<li><span class="hint" style="margin:0">일정 없음</span></li>'}</ul>
    <div class="row" style="margin-top:6px"><button class="btn sm" id="rulesApply">반복 일정 넣기</button><button class="btn sm" id="rulesAll">문서의 모든 달력에</button><button class="btn sm" id="rulesEdit">규칙 편집</button></div>
    <h3>메모 (빈 칸에 파란 글씨)</h3>${F('메모 1', 'notes.0', (el.notes || [])[0])}${F('메모 2', 'notes.1', (el.notes || [])[1])}
    <h3>모양</h3><div class="grid2">${F('주 시작', 's.weekStart', s.weekStart, { type: 'select', options: [[0, '일요일'], [1, '월요일']] })}${F('줄 수', 's.rows', s.rows, { type: 'select', options: [['merge', '5줄 (24/31 합침)'], ['6', '6줄'], ['auto', '자동']] })}</div>
    <div class="grid2">${F('요일 표기', 's.wdLang', s.wdLang, { type: 'select', options: [['en', 'SUNDAY'], ['short', 'SUN'], ['ko', '일요일'], ['ko1', '일']] })}${F('요일 줄 높이(mm)', 's.wdH', s.wdH, { type: 'number', step: 0.5 })}</div>
    <div class="grid3">${F('요일 크기', 's.wdSize', s.wdSize, { type: 'number', step: 0.5 })}${F('날짜 크기', 's.daySize', s.daySize, { type: 'number', step: 0.5 })}${F('일정 크기', 's.evSize', s.evSize, { type: 'number', step: 0.5 })}</div>
    <div class="grid2"><label class="f"><span>숫자·요일 글꼴</span>${fontPicker('s.fontNum', s.fontNum)}</label><label class="f"><span>일정 글꼴</span>${fontPicker('s.fontBody', s.fontBody)}</label></div>
    <div class="grid4">${F('일요일 색', 's.sunColor', s.sunColor, { type: 'color' })}${F('토요일 색', 's.satColor', s.satColor, { type: 'color' })}${F('날짜 색', 's.dayColor', s.dayColor, { type: 'color' })}${F('공휴일 색', 's.holColor', s.holColor, { type: 'color' })}</div>
    <div class="grid4">${F('일요일 칸', 's.sunBg', s.sunBg || '#ffffff', { type: 'color' })}${F('안쪽 선', 's.line', s.line, { type: 'color' })}${F('바깥 선', 's.outer', s.outer, { type: 'color' })}${F('메모 색', 's.noteColor', s.noteColor, { type: 'color' })}</div>
    <div class="grid3">${F('안쪽 선 두께', 's.lineW', s.lineW, { type: 'number', step: 0.05, min: 0 })}${F('바깥 선 두께', 's.outerW', s.outerW, { type: 'number', step: 0.05, min: 0 })}${F('칸 여백(mm)', 's.cellPad', s.cellPad, { type: 'number', step: 0.2, min: 0 })}</div>
    <div class="row">${F('요일 줄 보이기', 's.showWd', s.showWd, { type: 'check' })}${F('공휴일 표시', 's.showHol', s.showHol, { type: 'check' })}${F('공휴일 이름', 's.showHolName', s.showHolName, { type: 'check' })}</div><button class="btn sm" data-set="s.sunBg:">일요일 칸 색 없음</button>` + geo;
  } else if (el.type === 'mini') {
    const s = Object.assign({}, CAL.MINI_DEF, el.s || {});
    h += `<h3>미니 달력</h3><div class="grid2">${F('연도', 'year', el.year, { type: 'number' })}${F('월', 'month', el.month, { type: 'select', options: Array.from({ length: 12 }, (_, i) => [i + 1, (i + 1) + '월']) })}</div>
    <div class="grid3">${F('제목 크기', 's.titleSize', s.titleSize, { type: 'number', step: 0.5 })}${F('요일 크기', 's.wdSize', s.wdSize, { type: 'number', step: 0.5 })}${F('숫자 크기', 's.numSize', s.numSize, { type: 'number', step: 0.5 })}</div>
    <div class="grid2">${F('글자 색', 's.color', s.color, { type: 'color' })}${F('일요일 색', 's.sunColor', s.sunColor, { type: 'color' })}</div><div class="grid2">${F('월 제목 보이기', 's.showTitle', s.showTitle, { type: 'check' })}${F('주 시작', 's.weekStart', s.weekStart, { type: 'select', options: [[0, '일요일'], [1, '월요일']] })}</div><label class="f"><span>글꼴</span>${fontPicker('s.fontNum', s.fontNum)}</label>` + geo;
  }
  h += `<h3>동작</h3><div class="row"><button class="btn sm" id="iDup">복제</button><button class="btn sm danger" id="iDel">삭제</button></div>`;
  ins.innerHTML = h;
  ins.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fp) { openFontPop(b); return; }
    if (b.dataset.toggle) { el.locked = !el.locked; commit(); renderOverlay(); renderInspector(); return; }
    if (b.dataset.set != null) { const [k, v] = b.dataset.set.split(':'); setK(el, k, v); commit(); rerender(); return; }
    if (b.id === 'iDup') duplicate(); if (b.id === 'iDel') removeSel();
    if (b.id === 'fontBrowse') openFonts();
    if (b.id === 'imgLib') { sideTab = 'img'; $$('.sidetabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === 'img')); renderSide(); }
    if (b.id === 'imgAI') openAI('image');
    if (b.id === 'imgWhite') { b.disabled = true; b.textContent = '처리 중…'; try { el.src = addAsset(await AI.removeWhite(src(el.src))); commit(); rerender(); toast('흰 배경을 지웠습니다'); } catch (err) { toast('실패: ' + err.message, true); renderInspector(); } }
    if (b.id === 'imgFitBox') { const i = new Image(); i.onload = () => { el.h = r1(el.w * i.naturalHeight / i.naturalWidth); commit(); rerender(); }; i.src = src(el.src); }
    if (b.id === 'calHol') openHoliday(el.year);
    if (b.id === 'evAdd') { el.events = el.events || []; el.events.push({ d: selDay, text: '', color: '' }); commit(); rerender(); const last = $$('#inspector .evrow input').pop(); if (last) last.focus(); }
    if (b.dataset.evdel != null) { el.events.splice(Number(b.dataset.evdel), 1); commit(); rerender(); }
    if (b.id === 'rulesApply') { const n = CAL.applyRules(el, doc.rules); commit(); rerender(); toast(`${n}개 일정을 넣었습니다`); }
    if (b.id === 'rulesAll') { let n = 0; doc.pages.forEach(p => p.els.forEach(x => { if (x.type === 'cal') n += CAL.applyRules(x, doc.rules); })); commit(); rerender(); toast(`문서 전체에 ${n}개 일정을 넣었습니다`); }
    if (b.id === 'rulesEdit') openRules();
  };
  ins.querySelectorAll('li[data-godate]').forEach(li => li.onclick = e => { if (e.target.closest('button')) return; selDay = Number(li.dataset.godate); rerender(); });
}
function setK(obj, k, v) { const ks = k.split('.'); let a = obj; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = ks[i + 1].match(/^\d+$/) ? [] : {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; }
$('#inspector').addEventListener('input', e => {
  const t = e.target, k = t.dataset.k; if (!k) return;
  let v = t.type === 'checkbox' ? t.checked : t.value;
  if (t.type === 'number' || t.type === 'range') v = Number(v);
  if (k.startsWith('pg.')) { page()[k.slice(3)] = v; renderCanvas(); return; }
  if (k.startsWith('doc.')) { doc[k.slice(4)] = v; if (k === 'doc.name') $('#pname').value = v; markDirty(); return; }
  if (k.startsWith('multi.')) { selEls().forEach(el => el[k.slice(6)] = v); renderCanvas(); return; }
  const el = selEls()[0]; if (!el) return;
  if (['year', 'month', 'weight', 's.weekStart'].includes(k)) v = Number(v);
  if (t.dataset.ev != null) return;
  setK(el, k, v);
  if (el.type === 'text') lastTextStyle = { font: el.font, size: el.size, weight: el.weight, color: el.color };
  if (t.type === 'range') { const sm = t.parentElement.querySelector('small'); if (sm) sm.textContent = v; }
  renderCanvas();
});
$('#inspector').addEventListener('change', e => {
  const t = e.target; const el = selEls()[0];
  if (t.id === 'daySel') { selDay = t.value ? Number(t.value) : null; rerender(); return; }
  if (t.dataset.ev != null && el) { el.events[Number(t.dataset.ev)].text = t.value; commit(); rerender({ noPanel: true }); return; }
  if (t.dataset.evc != null && el) { el.events[Number(t.dataset.evc)].color = t.value; commit(); rerender(); return; }
  if (t.id === 'imgReplace' && el) { const f = t.files[0]; if (!f) return; fileToDataURL(f).then(d => { el.src = addAsset(d); commit(); rerender(); }); return; }
  if (t.dataset.k) { commit(); if (t.tagName === 'SELECT' || t.type === 'checkbox') renderInspector(); if (t.dataset.k === 'year' || t.dataset.k === 'month') renderInspector(); }
});

/* ---------- 상단 메뉴 ---------- */
$('#pname').addEventListener('input', e => { doc.name = e.target.value; markDirty(); });
$('#btnNew').onclick = () => { if (!window.confirm('새 문서를 만들까요? (파일에 연결되어 있지 않은 현재 작업은 브라우저 저장본만 남습니다)')) return; store.disconnect(); doc = newDoc(); hist = []; hptr = -1; cur = 0; sel = []; $('#pname').value = doc.name; commit(); renderAll(); updateSaveBadge(); sideTab = 'tpl'; $$('.sidetabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === 'tpl')); renderSide(); };
$('#btnOpen').onclick = async () => { try { let j = null; if (store.state.supported) j = await store.openExisting(); else j = await store.pickLocal(); if (j) { await loadDoc(j, '불러왔습니다'); updateSaveBadge(); } } catch (e) { if (e.name !== 'AbortError') toast('열 수 없습니다: ' + e.message, true); } };
$('#btnSave').onclick = openSaveDialog;
$('#btnHelp').onclick = () => $('#dlgHelp').showModal();
$('#btnFonts').onclick = openFonts;
$('#btnHoliday').onclick = () => openHoliday();
$$('dialog [data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());

function openSaveDialog() {
  let d = $('#dlgSave'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgSave'; d.innerHTML = `<div class="dhead"><h2>저장 · 동기화</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="saveBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  const st = store.state;
  $('#saveBody').innerHTML = `<p><b>지금 상태:</b> ${st.handle ? `파일 <code>${esc(st.fileName)}</code>에 연결되어 자동 저장 중입니다.` : '브라우저 안에만 자동 저장되고 있습니다 (이 PC, 이 브라우저에서만 보임).'}</p>
  <h3 style="margin:14px 0 6px">여러 PC에서 쓰려면</h3>
  <ol style="margin:0 0 10px 18px;line-height:1.6"><li>"파일에 연결"을 눌러 문서 파일을 <b>Google Drive·OneDrive·Dropbox·NAS 등 동기화되는 폴더</b>에 저장합니다.</li><li>바뀔 때마다 그 파일에 자동 저장됩니다. 다른 PC에서는 "열기"로 같은 파일을 열면 이어서 작업할 수 있습니다.</li><li>다른 PC에서 파일이 바뀌면 이 창이 자동으로 알아채고 새 내용을 불러옵니다(저장 안 한 변경이 있으면 물어봅니다).</li><li>프로그램 폴더(이 파일들)도 같은 동기화 폴더에 두면 모든 PC에서 같은 프로그램을 바로 열 수 있습니다.</li></ol>
  ${st.supported ? '' : '<p class="hint">이 브라우저는 파일 연결을 지원하지 않습니다. Chrome 또는 Edge를 쓰면 자동 저장·동기화가 됩니다. 지금은 "내려받기"로 저장하세요.</p>'}
  <div class="row"><button class="btn primary" id="svConnect" ${st.supported ? '' : 'disabled'}>${st.handle ? '다른 파일에 연결' : '파일에 연결 (자동 저장)'}</button><button class="btn" id="svNow" ${st.handle ? '' : 'disabled'}>지금 저장</button><button class="btn" id="svDown">내려받기 (JSON 사본)</button>${st.handle ? '<button class="btn danger" id="svDisc">연결 해제</button>' : ''}</div>
  <p class="hint" style="margin-top:10px">문서 파일에는 올린 이미지와 AI 이미지가 함께 들어갑니다. 내장 글꼴과 2026 삽화는 프로그램에 있으므로 파일이 가벼워집니다.</p>`;
  $('#svConnect').onclick = async () => { try { gcAssets(); await store.connectNew(doc); updateSaveBadge(); setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); toast('파일에 연결했습니다. 이제 자동으로 저장됩니다.'); d.close(); } catch (e) { if (e.name !== 'AbortError') toast(e.message, true); } };
  $('#svNow').onclick = () => { gcAssets(); saveFileNow(); d.close(); };
  $('#svDown').onclick = () => { gcAssets(); store.download(doc); toast('사본을 내려받았습니다'); };
  const disc = $('#svDisc'); if (disc) disc.onclick = async () => { await store.disconnect(); updateSaveBadge(); setStatus('브라우저에만 저장됩니다'); d.close(); };
  d.showModal();
}

/* ---------- 글꼴 둘러보기 ---------- */
let fontCat = 'all';
function openFonts() {
  const d = $('#dlgFonts'); renderFonts(); d.showModal();
}
function renderFonts() {
  const el = selEls()[0]; const target = el && el.type === 'text' ? el : null;
  const cats = [['all', '전체'], ['title', '제목용'], ['brush', '붓글씨'], ['hand', '손글씨'], ['body', '본문용'], ['latin', '영문'], ['mine', '내 글꼴']];
  const list = allFonts().filter(f => fontCat === 'all' || f.cat === fontCat);
  $('#fontBody').innerHTML = `<div class="row" style="margin-bottom:10px"><div class="seg" style="flex:1">${cats.map(([k, t]) => `<button data-fc="${k}" aria-pressed="${fontCat === k}">${t}</button>`).join('')}</div><label class="btn sm">내 글꼴 올리기 (.ttf/.otf/.woff2)<input type="file" accept=".ttf,.otf,.woff,.woff2" id="fontUp" hidden></label></div>
  <p class="hint">${target ? `선택한 글 상자 "${esc(elName(target))}"에 바로 적용됩니다.` : '글 상자를 선택한 뒤 열면 바로 적용됩니다. 지금은 새 글자의 기본 글꼴로 정해집니다.'} 모든 글꼴은 무료(OFL)로 상업 인쇄물에 쓸 수 있습니다.</p>
  <div class="fontlist">${list.map(f => `<div class="fontrow ${target && target.font === f.family ? 'active' : ''}" data-font="${esc(f.family)}"><div class="nm">${esc(f.label)}</div><div class="sample" style="font-family:'${esc(f.family)}'">나라차 태권도 인성 캘린더 2027 Aa</div><span class="hint" style="margin:0">${f.weights.join('/')}</span></div>`).join('')}</div>`;
  $('#fontBody').onclick = e => {
    const c = e.target.closest('[data-fc]'); if (c) { fontCat = c.dataset.fc; renderFonts(); return; }
    const r = e.target.closest('[data-font]'); if (!r) return;
    if (target) { target.font = r.dataset.font; commit(); rerender(); renderFonts(); } else { lastTextStyle = Object.assign({}, lastTextStyle || {}, { font: r.dataset.font }); toast(`새 글자의 기본 글꼴: ${r.dataset.font}`); }
  };
  $('#fontUp').onchange = async e => { const f = e.target.files[0]; if (!f) return; const data = await fileToDataURL(f); const family = f.name.replace(/\.(ttf|otf|woff2?)$/i, ''); try { const ff = new FontFace(family, `url(${data})`); await ff.load(); document.fonts.add(ff); doc.fonts.push({ family, data }); commit(); renderFonts(); toast(`글꼴 "${family}"을 추가했습니다`); } catch (err) { toast('글꼴을 읽지 못했습니다', true); } };
}

/* ---------- 공휴일 ---------- */
let holState = { year: 2027, source: 'builtin', list: null };
function openHoliday(year) {
  holState.year = year || doc.calendar.year || new Date().getFullYear(); holState.list = (doc.holidays[holState.year] || []).map(h => Object.assign({}, h));
  holState.source = (holState.year >= 2023 && holState.year <= 2030) ? 'builtin' : (AI.cfg.datagoKey ? 'datago' : 'nager');
  renderHoliday(); $('#dlgHoliday').showModal();
}
function renderHoliday() {
  const s = holState; const years = []; for (let y = 2020; y <= 2040; y++) years.push(y);
  $('#holBody').innerHTML = `<div class="row" style="margin-bottom:8px"><label class="f" style="margin:0"><span>연도</span><select id="holYear">${years.map(y => `<option ${y === s.year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
  <label class="f" style="margin:0;flex:1"><span>출처</span><select id="holSrc"><option value="builtin" ${s.source === 'builtin' ? 'selected' : ''}>내장 표 (2023~2030년, 대체공휴일 규칙 적용, 오프라인)</option><option value="datago" ${s.source === 'datago' ? 'selected' : ''}>공공데이터포털 특일정보 (공식, 서비스 키 필요)</option><option value="nager" ${s.source === 'nager' ? 'selected' : ''}>Nager.Date 공개 API (키 없음, 한국 데이터 정확도 낮음)</option></select></label>
  <button class="btn primary" id="holFetch" style="margin-top:16px">가져오기</button></div>
  <div id="holKeyRow" ${s.source === 'datago' ? '' : 'hidden'}><label class="f"><span>공공데이터포털 서비스 키 (data.go.kr → 한국천문연구원 특일 정보)</span><input type="text" id="holKey" value="${esc(AI.cfg.datagoKey || '')}" placeholder="일반 인증키(Decoding)"></label></div>
  <p class="hint">가져온 뒤 목록을 고치고 "적용"을 누르면 이 문서의 ${s.year}년 달력에 표시됩니다. 임시공휴일·선거일 등은 직접 추가하세요. <span id="holMsg"></span></p>
  <table class="holtable"><thead><tr><th style="width:130px">날짜</th><th>이름</th><th style="width:40px"></th></tr></thead><tbody id="holRows">${(s.list || []).map((h, i) => `<tr><td><input type="date" data-hd="${i}" value="${h.date}"></td><td><input type="text" data-hn="${i}" value="${esc(h.name)}"></td><td><button class="btn sm" data-hx="${i}">×</button></td></tr>`).join('')}</tbody></table>
  <div class="row" style="margin-top:8px"><button class="btn sm" id="holAdd">+ 직접 추가</button><div class="grow" style="flex:1"></div><button class="btn danger" id="holClear">이 연도 지우기</button><button class="btn primary" id="holApply">적용 (${(s.list || []).length}개)</button></div>`;
  $('#holYear').onchange = e => { s.year = Number(e.target.value); s.list = (doc.holidays[s.year] || []).map(h => Object.assign({}, h)); renderHoliday(); };
  $('#holSrc').onchange = e => { s.source = e.target.value; renderHoliday(); };
  $('#holFetch').onclick = async () => { const b = $('#holFetch'); b.disabled = true; b.textContent = '가져오는 중…'; try { const key = ($('#holKey') || {}).value || ''; if (key) { AI.cfg.datagoKey = key.trim(); AI.saveCfg(); } s.list = await CAL.fetchHolidays({ source: s.source, year: s.year, key: key.trim() }); renderHoliday(); $('#holMsg').textContent = `${s.list.length}개를 가져왔습니다.`; } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = '가져오기'; } };
  $('#holRows').oninput = e => { const t = e.target; if (t.dataset.hd != null) s.list[Number(t.dataset.hd)].date = t.value; if (t.dataset.hn != null) s.list[Number(t.dataset.hn)].name = t.value; };
  $('#holRows').onclick = e => { const b = e.target.closest('[data-hx]'); if (b) { s.list.splice(Number(b.dataset.hx), 1); renderHoliday(); } };
  $('#holAdd').onclick = () => { s.list = s.list || []; s.list.push({ date: `${s.year}-01-01`, name: '' }); renderHoliday(); };
  $('#holClear').onclick = () => { delete doc.holidays[s.year]; s.list = []; commit(); rerender(); renderHoliday(); };
  $('#holApply').onclick = () => { doc.holidays[s.year] = (s.list || []).filter(h => h.date && h.name).sort((a, b) => a.date < b.date ? -1 : 1); commit(); rerender(); $('#dlgHoliday').close(); toast(`${s.year}년 공휴일 ${doc.holidays[s.year].length}개를 적용했습니다`); };
}
function openRules() {
  let d = $('#dlgRules'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgRules'; d.innerHTML = `<div class="dhead"><h2>반복 일정 규칙</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="rulesBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  const row = (r, k) => `<div class="evrow" style="grid-template-columns:90px 90px 1fr 80px 28px;margin-bottom:4px"><select data-rk="week" data-r="${k}">${[['1', '첫째'], ['2', '둘째'], ['3', '셋째'], ['4', '넷째'], ['last', '마지막']].map(([v, t]) => `<option value="${v}" ${String(r.week) === v ? 'selected' : ''}>${t}</option>`).join('')}</select><select data-rk="dow" data-r="${k}">${CAL.WD.ko1.map((w, i) => `<option value="${i}" ${Number(r.dow) === i ? 'selected' : ''}>${w}요일</option>`).join('')}</select><input type="text" data-rk="text" data-r="${k}" value="${esc(r.text)}" placeholder="일정 내용"><select data-rk="color" data-r="${k}">${Object.entries(COLOR_NAMES).map(([c, t]) => `<option value="${c}" ${(r.color || '') === c ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="x" data-rd="${k}">×</button></div>`;
  const render = () => { $('#rulesBody').innerHTML = `<p class="hint">달력 요소의 "반복 일정 넣기"를 누르면 이 규칙대로 일정이 들어갑니다 (이미 같은 일정이 있으면 건너뜀).</p><div id="rulesList">${doc.rules.map(row).join('')}</div><button class="btn sm" id="ruleAdd">+ 규칙 추가</button>`; $('#ruleAdd').onclick = () => { doc.rules.push({ week: 'last', dow: 1, text: '', color: '' }); render(); }; $('#rulesList').oninput = e => { const t = e.target; if (t.dataset.r != null) { doc.rules[Number(t.dataset.r)][t.dataset.rk] = t.value; markDirty(); } }; $('#rulesList').onclick = e => { const b = e.target.closest('[data-rd]'); if (b) { doc.rules.splice(Number(b.dataset.rd), 1); markDirty(); render(); } }; };
  render(); d.showModal();
}

/* ---------- AI 도우미 ---------- */
let aiCtx = { tab: 'content', monthIdx: 0 };
$('#btnAI').onclick = () => openAI(selEls()[0] && selEls()[0].type === 'image' ? 'image' : 'content');
function openAI(tab) {
  aiCtx.tab = tab; const el = selEls()[0]; if (el && el.month) aiCtx.monthIdx = el.month - 1;
  if (!AI.cfg.anthropicKey && !AI.cfg.geminiKey) aiCtx.tab = 'keys';
  renderAI(); $('#dlgAI').showModal();
}
$$('#dlgAI [role=tab]').forEach(b => b.onclick = () => { aiCtx.tab = b.dataset.tab; renderAI(); });
function applyMonthContent(mi, r) {
  Object.assign(doc.calendar.months[mi], { virtue: r.virtue, en: r.en, quote: r.quote, practice: r.practice.slice(0, 2), idiom: r.idiom, hanja: r.hanja, meaning: r.meaning });
  let n = 0;
  doc.pages.forEach(p => p.els.forEach(el => {
    if (el.type !== 'text' || el.month !== mi + 1) return;
    const map = { virtue: r.virtue, en: `(${r.en})`, quote: r.quote, practice: `1. ${r.practice[0]}\n2. ${r.practice[1]}`, idiom: `${r.idiom}(${r.hanja})`, meaning: r.meaning };
    if (map[el.role] != null) { el.text = map[el.role]; n++; }
  }));
  return n;
}
function renderAI() {
  $$('#dlgAI [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === aiCtx.tab));
  const body = $('#aiBody'); const months = doc.calendar.months; const year = doc.calendar.year || 2027;
  if (aiCtx.tab === 'keys') {
    body.innerHTML = `<p class="hint">키는 이 컴퓨터의 브라우저에만 저장되며 다른 곳으로 보내지 않습니다. Claude 키는 console.anthropic.com, Gemini 키는 aistudio.google.com에서 만듭니다.</p>
    <div class="grid2">${aiF('Claude API 키', 'anthropicKey', 'password')}${aiF('Claude 모델', 'claudeModel')}${aiF('Gemini API 키', 'geminiKey', 'password')}${aiF('Gemini 이미지 모델', 'geminiModel')}
    <label class="f"><span>이미지 비율</span><select data-ai="aspect">${['1:1', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9'].map(a => `<option ${AI.cfg.aspect === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    <label class="f"><span>이미지 크기</span><select data-ai="size">${['1K', '2K', '4K'].map(a => `<option ${AI.cfg.size === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label></div>
    <p class="hint">모델 이름: Gemini는 gemini-nano-banana-2.1(기본), gemini-3.1-flash-image, gemini-3-pro-image, gemini-2.5-flash-image(구형). Claude는 claude-opus-5-5(기본), claude-sonnet-5-5. Claude 요청에는 안전 거절 시 다른 모델로 자동 전환되는 fallbacks 설정이 켜져 있습니다.</p>`;
    return;
  }
  const mi = aiCtx.monthIdx, mo = months[mi];
  if (aiCtx.tab === 'content') {
    body.innerHTML = `<div class="row" style="margin-bottom:10px"><label class="f" style="margin:0;flex:1"><span>대상 달</span><select id="aiMonth">${months.map((x, k) => `<option value="${k}" ${k === mi ? 'selected' : ''}>${k + 1}월 · ${esc(x.virtue)}</option>`).join('')}</select></label>
      <label class="f" style="margin:0;flex:2"><span>덕목 (비우면 Claude가 정함)</span><input type="text" id="aiVirtue" value="${esc(mo.virtue)}"></label></div>
    <label class="f"><span>참고 요청 (선택)</span><input type="text" id="aiHint" placeholder="예: 새 학기 분위기, 겨루기 장면을 넣어줘"></label>
    <div class="row"><button class="btn ai" id="aiGoMonth">이 달 문구 제안받기</button><button class="btn" id="aiGoYear">12개월 전체 덕목 구성하기</button><span id="aiBusy"></span></div>
    <p class="hint">결과를 확인한 뒤 "적용"을 눌러야 들어갑니다. 적용하면 캘린더 데이터와, 해당 달의 역할이 지정된 글 상자(덕목·영문·명언·실천·사자성어·뜻)가 함께 바뀝니다.</p>
    <div id="aiResult"></div>`;
    $('#aiMonth').onchange = e => { aiCtx.monthIdx = Number(e.target.value); renderAI(); };
    $('#aiGoMonth').onclick = () => runAI(async () => {
      const r = await AI.suggestMonth({ year, month: mi + 1, virtue: $('#aiVirtue').value.trim(), hint: $('#aiHint').value.trim() });
      $('#aiResult').innerHTML = `<div class="aiout">${esc(JSON.stringify(r, null, 2))}</div><div class="row" style="margin-top:8px"><button class="btn primary" id="aiApply">${mi + 1}월에 적용</button></div>`;
      $('#aiApply').onclick = () => { const n = applyMonthContent(mi, r); commit(); rerender(); $('#dlgAI').close(); toast(`${mi + 1}월 문구를 적용했습니다 (글 상자 ${n}개 갱신)`); };
    });
    $('#aiGoYear').onclick = () => runAI(async () => {
      const r = await AI.suggestYear({ year, previous: months.map(x => x.virtue), hint: $('#aiHint').value.trim() });
      $('#aiResult').innerHTML = `<div class="aiout">${r.map((x, k) => `${k + 1}월 ${x.virtue} (${x.en}) · ${x.idiom}(${x.hanja})\n  ${x.quote.replace(/\n/g, ' ')}\n  1) ${x.practice[0]}\n  2) ${x.practice[1]}`).join('\n\n')}</div><div class="row" style="margin-top:8px"><button class="btn primary" id="aiApplyY">12개월 모두 적용</button></div>`;
      $('#aiApplyY').onclick = () => { let n = 0; r.forEach((x, k) => n += applyMonthContent(k, x)); commit(); rerender(); $('#dlgAI').close(); toast(`12개월 문구를 적용했습니다 (글 상자 ${n}개 갱신)`); };
    });
    return;
  }
  const el = selEls()[0]; const targetImg = el && el.type === 'image' ? el : null;
  body.innerHTML = `<p class="hint">${targetImg ? `선택한 이미지 요소 "${esc(elName(targetImg))}"에 넣습니다.` : '현재 페이지에 새 이미지 요소로 넣습니다. (이미지 요소를 선택하고 열면 그 요소를 바꿉니다)'}</p>
  <div class="row" style="margin-bottom:8px"><label class="f" style="margin:0;flex:1"><span>관련 달 (문구 참고용)</span><select id="aiMonth2">${months.map((x, k) => `<option value="${k}" ${k === mi ? 'selected' : ''}>${k + 1}월 · ${esc(x.virtue)}</option>`).join('')}<option value="-1">달과 무관</option></select></label>
    <label class="f" style="margin:0"><span>주인공</span><select id="aiChar"><option value="penguin">펭귄 마스코트</option><option value="kids">어린이 수련생</option><option value="both">마스코트 + 어린이</option></select></label></div>
  <label class="f"><span>추가 요청 (선택)</span><input type="text" id="aiExtra" placeholder="예: 발차기 동작, 봄 벚꽃, 두 명이 악수"></label>
  <div class="row"><button class="btn ai" id="aiPrompt">Claude로 프롬프트 만들기</button><span class="hint" style="margin:0">또는 아래에 직접 적어도 됩니다 (한국어 가능).</span></div>
  <label class="f"><span>이미지 프롬프트</span><textarea id="aiPromptText" rows="6"></textarea></label>
  <label class="chk"><input type="checkbox" id="aiRef" checked> 펭귄 마스코트 참고 이미지 첨부 (같은 캐릭터로 그리게 함)</label>
  <label class="chk"><input type="checkbox" id="aiWhite" checked> 생성 후 흰 배경을 자동으로 투명하게</label>
  <div class="row"><button class="btn primary" id="aiGen">Gemini로 이미지 만들기</button><label class="f" style="margin:0"><span>장수</span><select id="aiN"><option>1</option><option>2</option><option>3</option></select></label><span id="aiBusy"></span></div>
  <div class="aiimgs" id="aiImgs"></div>`;
  $('#aiMonth2').onchange = e => { aiCtx.monthIdx = Math.max(0, Number(e.target.value)); };
  $('#aiPrompt').onclick = () => runAI(async () => {
    const k = Number($('#aiMonth2').value); const m2 = k >= 0 ? months[k] : null;
    const t = await AI.imagePrompt(m2 ? { virtue: m2.virtue, en: m2.en, quote: m2.quote, practice: m2.practice, character: $('#aiChar').value, extra: $('#aiExtra').value }
      : { virtue: 'General illustration for a taekwondo school design', en: '', quote: doc.name, practice: [], character: $('#aiChar').value, extra: $('#aiExtra').value });
    $('#aiPromptText').value = t;
  });
  $('#aiGen').onclick = () => runAI(async () => {
    const prompt = $('#aiPromptText').value.trim(); if (!prompt) throw new Error('프롬프트를 먼저 적거나 Claude로 만들어 주세요.');
    const n = Number($('#aiN').value); const ref = $('#aiRef').checked ? ASSETS['mascot-01'] : null;
    for (let k = 0; k < n; k++) {
      $('#aiBusy').innerHTML = `<span class="spin"></span>${k + 1}/${n} 생성 중…`;
      const imgs = await AI.geminiImage({ prompt, refImage: ref });
      for (let s of imgs) {
        if ($('#aiWhite').checked) { try { s = await AI.removeWhite(s); } catch (e) {} }
        const fig = document.createElement('figure'); fig.innerHTML = `<img src="${s}" alt=""><figcaption><button class="btn sm primary">사용</button><button class="btn sm">내려받기</button></figcaption>`;
        fig.querySelectorAll('button')[0].onclick = () => { const ref2 = addAsset(s); if (targetImg) { targetImg.src = ref2; commit(); rerender(); } else addImage(ref2); $('#dlgAI').close(); toast('그림을 넣었습니다'); };
        fig.querySelectorAll('button')[1].onclick = () => { const a = document.createElement('a'); a.href = s; a.download = `ai-image-${Date.now()}.png`; a.click(); };
        $('#aiImgs').prepend(fig);
      }
    }
  });
}
function aiF(label, key, type) { return `<label class="f"><span>${label}</span><input type="${type || 'text'}" data-ai="${key}" value="${esc(AI.cfg[key])}" autocomplete="off"></label>`; }
$('#aiBody').addEventListener('input', e => { const k = e.target.dataset.ai; if (k) { AI.cfg[k] = e.target.value.trim(); AI.saveCfg(); } });
$('#aiBody').addEventListener('change', e => { const k = e.target.dataset.ai; if (k) { AI.cfg[k] = e.target.value.trim(); AI.saveCfg(); } });
async function runAI(fn) {
  const busy = $('#aiBusy'); const btns = $$('#aiBody button'); btns.forEach(b => b.disabled = true);
  if (busy) busy.innerHTML = '<span class="spin"></span>요청 중…';
  try { await fn(); if (busy) busy.textContent = '완료'; }
  catch (err) { if (busy) busy.textContent = ''; toast(err.message, true); }
  finally { btns.forEach(b => b.disabled = false); }
}

/* ---------- 내보내기 ---------- */
$('#btnExport').onclick = async () => {
  endEdit();
  const b = Math.max(0, Number(doc.bleed) || 0);
  $('#pageStyle').textContent = `@page{size:${doc.w + 2 * b}mm ${doc.h + 2 * b}mm;margin:0}`;
  const root = $('#printRoot'); root.innerHTML = doc.pages.map(pg => sheetHTML(pg, 'print')).join('');
  setStatus('PDF 준비 중…');
  try { await document.fonts.ready; } catch (e) {}
  await Promise.all(Array.from(root.querySelectorAll('img')).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
  setStatus('인쇄 창을 열었습니다 (대상: PDF로 저장, 여백: 없음, 배경 그래픽: 켬)');
  window.print();
  setTimeout(() => { root.innerHTML = ''; }, 2000);
};
$('#btnPNG').onclick = async () => {
  endEdit();
  if (!window.html2canvas) { setStatus('PNG 모듈 불러오는 중…'); await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = res; s.onerror = () => rej(new Error('PNG 모듈을 불러오지 못했습니다 (인터넷 필요)')); document.head.appendChild(s); }).catch(e => { toast(e.message, true); }); if (!window.html2canvas) return; }
  const tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-99999px;top:0'; tmp.innerHTML = sheetHTML(page(), 'thumb'); document.body.appendChild(tmp);
  try { const canvas = await html2canvas(tmp.firstElementChild, { scale: 300 / 96, backgroundColor: null, logging: false }); const a = document.createElement('a'); a.download = `${(doc.name || 'design').replace(/[\\/:*?"<>|]/g, '_')}-${cur + 1}.png`; a.href = canvas.toDataURL('image/png'); a.click(); toast('PNG로 저장했습니다 (300dpi)'); }
  catch (e) { toast('PNG 저장 실패: ' + e.message, true); } finally { tmp.remove(); setStatus(''); }
};

/* ---------- 기타 ---------- */
let toastTimer; function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, err ? 5000 : 2200); }

/* ---------- 시작 ---------- */
(async function init() {
  doc = newDoc();
  let loaded = false;
  try {
    const p = await store.reconnect();
    if (p === 'granted') { const j = await store.readFile(); await loadDoc(j); loaded = true; setStatus(`연결된 파일: ${store.state.fileName}`); }
    else if (p === 'prompt') {
      const saved = await store.idbGet('doc'); if (saved) { await loadDoc(saved); loaded = true; }
      const st = $('#status'); st.innerHTML = `<button class="btn sm" id="reconn">연결된 파일 "${esc(store.state.fileName)}" 다시 열기</button>`;
      $('#reconn').onclick = async () => { if (await store.requestPermission()) { const j = await store.readFile(); await loadDoc(j, '연결된 파일을 열었습니다'); updateSaveBadge(); } };
    }
  } catch (e) { console.warn(e); }
  if (!loaded) { try { const saved = await store.idbGet('doc'); if (saved) { await loadDoc(saved); loaded = true; setStatus('브라우저 저장본을 불러왔습니다'); } } catch (e) {} }
  if (!loaded) {
    doc = newDoc(); doc.calendar.year = 2027; doc.name = '2027 인성 캘린더'; doc.pages = CAL.buildPages(doc, uid, { year: 2027, kind: 'full' });
    $('#pname').value = doc.name; hist = [snapshot()]; hptr = 0; renderAll();
    setStatus('2027년 캘린더 초안을 만들었습니다. "공휴일"에서 정보를 가져오세요.');
  }
  updateSaveBadge();
  document.fonts && document.fonts.ready.then(() => renderAll());
})();
})();
