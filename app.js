(function () {
'use strict';
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const MM = 96 / 25.4;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;
let _uid = Date.now() % 100000; const uid = () => (_uid++).toString(36) + Math.random().toString(36).slice(2, 5);
const FONTS = window.NARACAL_FONTS, ASSETS = window.NARACAL_ASSETS, FX = NC.fx, CAL = NC.cal, store = NC.store;
const SIZES = [['desk', '탁상 캘린더 224×154', 224, 154], ['a4p', 'A4 세로 210×297', 210, 297], ['a4l', 'A4 가로 297×210', 297, 210], ['a3p', 'A3 세로 297×420', 297, 420], ['a3l', 'A3 가로 420×297', 420, 297], ['a5p', 'A5 세로 148×210', 148, 210], ['a5l', 'A5 가로 210×148', 210, 148], ['b5p', 'B5 세로 176×250', 176, 250], ['sq', '정사각 210×210', 210, 210], ['ig', 'SNS 정사각 1080px', 285.75, 285.75], ['ig45', 'SNS 4:5 1080×1350px', 285.75, 357.19], ['story', 'SNS 세로 1080×1920px', 285.75, 508], ['yt', '유튜브 썸네일 1280×720', 338.67, 190.5], ['card', '명함 90×50', 90, 50], ['a6l', '엽서·초대장 148×105', 148, 105], ['a2p', '포스터 A2 420×594', 420, 594], ['xb', 'X배너 600×1800', 600, 1800], ['bn', '현수막 3000×700', 3000, 700]];
const COLOR_NAMES = { '': '검정', red: '빨강', blue: '파랑', green: '초록', gray: '회색' };
const SWATCH = ['#1a1a1a', '#ffffff', '#1E2B5A', '#2F5BEA', '#E0564B', '#FFE89A', '#FFD34D', '#4C8A2B', '#2F5D3A', '#6B3FD1', '#E6EDF2', '#DDF3EA', '#F3F4F7', '#888888'];

/* ---------- 문서 모델 ---------- */
let doc, cur = 0, sel = [], zoom = 0, hist = [], hptr = -1, editing = null, selDay = null, clip = null, lastTextStyle = null, tool = 'select';
function newPage(bg) { return { id: uid(), bg: bg || '#ffffff', els: [], label: '' }; }
function newDoc(sz) { sz = sz || SIZES[0]; return { v: 2, name: '새 디자인', w: sz[2], h: sz[3], bleed: 0, cropMarks: false, pages: [newPage()], assets: {}, fonts: [], holidays: {}, showHolidays: true, calendar: Object.assign(clone(window.NARACAL_DEFAULTS), { theme: Object.assign({ id: 'classic' }, window.NARACAL_DEFAULTS.theme) }), rules: clone(window.NARACAL_DEFAULTS.rules), updatedAt: Date.now() }; }
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
let idbTimer, fileTimer, freshDraft = false; // freshDraft: 처음 열 때 만든 초안을 아직 고치지 않음
function markDirty() {
  freshDraft = false; doc.updatedAt = Date.now(); store.state.dirty = true;
  clearTimeout(idbTimer); idbTimer = setTimeout(async () => { try { await store.idbSet('doc', doc); if (!store.state.handle) setStatus('브라우저에 저장됨 ' + tnow()); } catch (e) { setStatus('브라우저 저장 실패'); } }, 500);
  if (store.state.handle) { clearTimeout(fileTimer); fileTimer = setTimeout(saveFileNow, 1200); }
  updateSaveBadge();
}
async function saveFileNow() { try { const ok = await store.writeFile(doc); if (ok) setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); } catch (e) { setStatus('파일 저장 실패: ' + e.message); toast('파일 저장 실패: ' + e.message, true); } updateSaveBadge(); }
function tnow() { return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); }
function setStatus(t) { $('#status').textContent = t; }
function updateSaveBadge() { const b = $('#btnSave'); if (!b) return; b.querySelector('span').textContent = store.state.handle ? `${store.state.dir ? '동기화' : '저장됨'} · ${store.state.fileName.replace(/\.design\.json$/i, '')}` : '저장·동기화'; b.classList.toggle('on', !!store.state.handle); }
async function loadDoc(j, from) {
  if (!j || !j.pages) throw new Error('문서 형식이 아닙니다');
  if (j.v !== 2) throw new Error('이 프로그램의 문서 파일이 아닙니다');
  doc = Object.assign(newDoc(), j); doc.assets = doc.assets || {}; doc.holidays = doc.holidays || {}; doc.fonts = doc.fonts || [];
  if (!doc.calendar.theme || !doc.calendar.theme.id) doc.calendar.theme = Object.assign({ id: 'classic' }, doc.calendar.theme || {});
  cur = 0; sel = []; selDay = null; hist = []; hptr = -1;
  await registerDocFonts(); ensureAllHolidays();
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
// 동기화 폴더의 설정값(API 키·모델·최근 사용 목록): 다른 PC가 바꾼 건 가져오고, 여기서 바뀐 건 올림
function applySyncedSettings() { try { Object.assign(AI.cfg, JSON.parse(localStorage.getItem('naracal-ai-v1') || '{}')); } catch (e) {} }
async function syncSettings(first) {
  try {
    if (await store.pullSettings()) { applySyncedSettings(); if (!first) toast('다른 PC에서 바뀐 설정을 가져왔습니다'); if (sideTab === 'tpl' || sideTab === 'elems') renderSide(); }
    else if (first) await store.pushSettings(true);
  } catch (e) { console.warn('설정 동기화', e); }
}
async function syncTick() { await checkExternalChange(); if (store.state.dir) await syncSettings(); }
window.addEventListener('focus', syncTick);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncTick(); });
setInterval(() => { if (!document.hidden) syncTick(); }, 20000);
setInterval(() => { if (store.state.dir) store.pushSettings().catch(() => {}); }, 4000);
// 폴더가 연결된 뒤: 설정 맞추고, 문서가 폴더 밖이면 폴더의 최근 문서를 열거나 지금 문서를 폴더에 저장
async function afterFolderReady(opts) {
  opts = opts || {};
  await syncSettings(true);
  if (store.state.handle && await store.inFolder(store.state.handle)) {
    if (opts.loadCurrent) { try { await loadDoc(await store.readFile()); } catch (e) { console.warn(e); } }
    return;
  }
  const docs = await store.listDocs();
  gcAssets();
  if (docs.length) {
    const nm = docs[0].name.replace(/\.design\.json$/i, '');
    if (!freshDraft) {
      if (!window.confirm(`동기화 폴더에 문서가 ${docs.length}개 있습니다.\n\n확인: 가장 최근 문서 "${nm}"를 엽니다 (지금 화면의 문서도 폴더에 따로 저장해 둡니다)\n취소: 지금 문서를 계속 쓰고 폴더에 저장합니다`)) { await store.saveIntoFolder(doc); setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); return; }
      await store.saveIntoFolder(doc); store.state.dirty = false;
    }
    await openFolderDoc(docs[0].handle, `동기화 폴더의 최근 문서 "${nm}"를 열었습니다`); return;
  }
  await store.saveIntoFolder(doc); setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`);
}
async function openFolderDoc(h, msg) {
  if (store.state.handle && store.state.dirty) { clearTimeout(fileTimer); await saveFileNow(); }
  const j = await store.openHandle(h); await loadDoc(j, msg || `"${h.name}"를 열었습니다`); updateSaveBadge(); setStatus(`연결된 파일: ${store.state.fileName}`);
}
async function registerDocFonts() { for (const f of doc.fonts) { try { const ff = new FontFace(f.family, `url(${f.data})`); await ff.load(); document.fonts.add(ff); } catch (e) {} } }
function allFonts() { return FONTS.concat(doc.fonts.map(f => ({ family: f.family, label: f.family + ' (내 글꼴)', cat: 'mine', weights: [400, 700] }))); }
/* 최근 사용 글꼴 3개 */
function recentFonts() { try { return JSON.parse(localStorage.getItem('naracal-recent-fonts') || '[]'); } catch (e) { return []; } }
function noteFont(fam) { if (!fam) return; const r = recentFonts().filter(f => f !== fam); r.unshift(fam); try { localStorage.setItem('naracal-recent-fonts', JSON.stringify(r.slice(0, 3))); } catch (e) {} }

/* ---------- 공휴일 자동 적용 ---------- */
function ensureHolidays(year, silent) { if (!year || doc.holidays[year] || !CAL.canAuto(year)) return false; doc.holidays[year] = CAL.autoHolidays(year); markDirty(); if (!silent) toast(`${year}년 공휴일 ${doc.holidays[year].length}개를 자동으로 넣었습니다 (대체공휴일 포함)`); return true; }
function ensureAllHolidays() { let n = 0; const ys = new Set(); doc.pages.forEach(p => p.els.forEach(el => { if (el.type === 'cal' || el.type === 'mini') ys.add(el.year); })); if (doc.calendar.year) ys.add(doc.calendar.year); ys.forEach(y => { if (ensureHolidays(y, true)) n++; }); return n; }

/* ---------- 요소 HTML ---------- */
function elHTML(el, mode, ext) {
  if (el.hidden) return '';
  let { x, y, w, h } = el;
  if (ext && mode === 'print') { const b = doc.bleed || 0; if (x <= 0.3) { x -= b; w += b; } if (x + w >= doc.w - 0.3) w += b; if (y <= 0.3) { y -= b; h += b; } if (y + h >= doc.h - 0.3) h += b; }
  const base = `left:${x}mm;top:${y}mm;width:${w}mm;${el.type === 'text' && !el.warp ? 'min-height' : 'height'}:${h}mm;transform:rotate(${el.rot || 0}deg);opacity:${el.opacity == null ? 1 : el.opacity};`;
  const lock = el.locked ? ' locked' : '';
  const blend = el.blend && el.blend !== 'normal' && el.type !== 'text' ? `mix-blend-mode:${el.blend};` : '';
  if (el.type === 'text') {
    if (el.warp && el.warp !== 'none') return `<div class="el el-text warp${lock}" data-id="${el.id}" style="${base}${el.blend && el.blend !== 'normal' ? `mix-blend-mode:${el.blend};` : ''}">${FX.warpSVG(el)}</div>`;
    return `<div class="el el-text${lock}" data-id="${el.id}" style="${base}${FX.textStyle(el)}">${esc(el.upper ? el.text : el.text)}</div>`;
  }
  if (el.type === 'image') {
    const s = src(el.src); const clip = FX.clipPath(el.clip); const z = el.zoom || 1;
    const sh = el.shadow ? `filter:drop-shadow(${el.shX || 0.8}mm ${el.shY || 0.8}mm ${el.shB || 0.8}mm ${FX.rgba(el.shC || '#000000', el.shA == null ? 0.3 : el.shA)});` : '';
    const inner = s ? `<img src="${s}" alt="" draggable="false" style="object-fit:${el.fit};object-position:${el.pos};transform:translate(${el.panX || 0}%,${el.panY || 0}%) scale(${z * (el.flip ? -1 : 1)},${z});${FX.imageFilter(el)}">${el.tint ? `<div class="tint" style="background:${el.tint};opacity:${el.tintA == null ? 0.4 : el.tintA};mix-blend-mode:${el.tintMode || 'multiply'}"></div>` : ''}` : (mode === 'edit' ? '<div style="font-size:3.5mm;color:rgba(0,0,0,.4);text-align:center;padding-top:35%">그림 없음<br>오른쪽에서 넣기</div>' : '');
    return `<div class="el el-image${lock}" data-id="${el.id}" style="${base}${blend}${sh}"><div class="imgclip" style="border-radius:${el.radius || 0}mm;${clip ? `clip-path:${clip};` : ''}${el.border ? `border:${el.borderW || 0.5}mm solid ${el.border};` : ''}${s ? '' : 'outline:0.4mm dashed rgba(0,0,0,.3);'}">${inner}</div></div>`;
  }
  if (el.type === 'shape') return `<div class="el el-shape${lock}" data-id="${el.id}" style="${base}${blend}">${FX.shapeSVG(el)}</div>`;
  if (el.type === 'path') return `<div class="el el-path${lock}" data-id="${el.id}" style="${base}${blend}">${FX.pathSVG(el)}</div>`;
  if (el.type === 'chart') return `<div class="el el-chart${lock}" data-id="${el.id}" style="${base}">${chartSVG(el)}</div>`;
  if (el.type === 'cal') return `<div class="el el-cal${lock}" data-id="${el.id}" style="${base}">${CAL.calHTML(el, doc)}</div>`;
  if (el.type === 'mini') return `<div class="el el-mini${lock}" data-id="${el.id}" style="${base}">${CAL.miniHTML(el)}</div>`;
  return '';
}
function chartSVG(el) {
  const w = el.w, h = el.h, data = el.data || [], cols = el.colors || ['#1E2B5A'], fs = Math.max(2.2, Math.min(w, h) * 0.06);
  const ty = el.title ? fs * 1.9 : 0; let s = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block;font-family:'Noto Sans KR'">`;
  if (el.title) s += `<text x="${w / 2}" y="${fs * 1.3}" font-size="${fs * 1.2}" font-weight="700" text-anchor="middle" fill="#1a1a1a">${esc(el.title)}</text>`;
  const max = Math.max(1, ...data.map(d => Number(d.v) || 0)); const total = data.reduce((a, d) => a + (Number(d.v) || 0), 0) || 1;
  if (el.kind === 'bar' || el.kind === 'line') {
    const px = fs * 1.2, py = ty + fs * 0.6, pw = w - px * 1.5, ph = h - py - fs * 2.2; const n = data.length || 1; const bw = pw / n;
    s += `<line x1="${px}" y1="${py + ph}" x2="${px + pw}" y2="${py + ph}" stroke="#999" stroke-width="0.2"/>`;
    for (let g = 1; g <= 4; g++) s += `<line x1="${px}" y1="${py + ph - ph * g / 4}" x2="${px + pw}" y2="${py + ph - ph * g / 4}" stroke="#E5E7EB" stroke-width="0.15"/>`;
    const pts = [];
    data.forEach((d, i) => { const v = (Number(d.v) || 0) / max; const bx = px + i * bw + bw * 0.2, bh = ph * v; pts.push([px + i * bw + bw / 2, py + ph - bh]); if (el.kind === 'bar') s += `<rect x="${bx}" y="${py + ph - bh}" width="${bw * 0.6}" height="${bh}" rx="${bw * 0.08}" fill="${cols[i % cols.length]}"/>`; s += `<text x="${px + i * bw + bw / 2}" y="${py + ph + fs * 1.3}" font-size="${fs}" text-anchor="middle" fill="#444">${esc(d.l)}</text>`; if (el.showVal) s += `<text x="${px + i * bw + bw / 2}" y="${py + ph - bh - fs * 0.4}" font-size="${fs * 0.9}" text-anchor="middle" fill="#333" font-weight="600">${d.v}</text>`; });
    if (el.kind === 'line') { s += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${cols[0]}" stroke-width="${fs * 0.25}" stroke-linejoin="round"/>`; pts.forEach(p => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="${fs * 0.35}" fill="#fff" stroke="${cols[0]}" stroke-width="${fs * 0.2}"/>`; }); }
  } else if (el.kind === 'hbar') {
    const px = fs * 5, py = ty + fs * 0.6, pw = w - px - fs, ph = h - py - fs * 0.5; const n = data.length || 1; const rh = ph / n;
    data.forEach((d, i) => { const v = (Number(d.v) || 0) / max; s += `<text x="${px - fs * 0.5}" y="${py + i * rh + rh * 0.62}" font-size="${fs}" text-anchor="end" fill="#444">${esc(d.l)}</text><rect x="${px}" y="${py + i * rh + rh * 0.2}" width="${pw * v}" height="${rh * 0.6}" rx="${rh * 0.1}" fill="${cols[i % cols.length]}"/>`; if (el.showVal) s += `<text x="${px + pw * v + fs * 0.4}" y="${py + i * rh + rh * 0.62}" font-size="${fs * 0.9}" fill="#333" font-weight="600">${d.v}</text>`; });
  } else {
    const cx = w / 2, cy = ty + (h - ty) / 2, r = Math.min(w, h - ty) / 2 - fs * 1.6; let a0 = -Math.PI / 2;
    data.forEach((d, i) => { const frac = (Number(d.v) || 0) / total; const a1 = a0 + frac * Math.PI * 2; const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1); const big = frac > 0.5 ? 1 : 0; if (frac >= 0.9999) s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${cols[i % cols.length]}"/>`; else if (frac > 0) s += `<path d="M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${big} 1 ${x1} ${y1} Z" fill="${cols[i % cols.length]}"/>`; const am = (a0 + a1) / 2, lx = cx + (r + fs * 0.9) * Math.cos(am), ly = cy + (r + fs * 0.9) * Math.sin(am); if (frac > 0.02) s += `<text x="${lx}" y="${ly + fs * 0.35}" font-size="${fs * 0.9}" text-anchor="${Math.cos(am) < -0.1 ? 'end' : Math.cos(am) > 0.1 ? 'start' : 'middle'}" fill="#333">${esc(d.l)}${el.showVal ? ' ' + Math.round(frac * 100) + '%' : ''}</text>`; a0 = a1; });
    if (el.kind === 'donut') s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="#fff"/>`;
  }
  return s + '</svg>';
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
  pg.els.forEach(el => { if (el.type === 'text' && !(el.warp && el.warp !== 'none')) { const d = c.querySelector(`[data-id="${el.id}"]`); if (d) { const hh = r1(d.offsetHeight / MM); if (hh > el.h + 0.05) el.h = hh; } } });
  fitCanvas(); renderOverlay();
  $('#pageLabel').textContent = `${cur + 1} / ${doc.pages.length}${pg.label ? ' · ' + pg.label : ''}`;
  $('#stage').classList.toggle('pen', tool === 'pen');
}
function fitCanvas() {
  const st = $('#stage'), w = st.clientWidth - 80, h = st.clientHeight - 150;
  const k = zoom || Math.min(w / (doc.w * MM), h / (doc.h * MM));
  const c = $('#canvas'); c.style.transform = `scale(${k})`; c.dataset.k = k;
  const wrap = $('#canvasWrap'); wrap.style.width = (doc.w * MM * k) + 'px'; wrap.style.height = (doc.h * MM * k) + 'px';
  const o = $('#ovl'); o.style.transform = `scale(${k})`; o.style.setProperty('--k', k); o.style.width = (doc.w * MM) + 'px'; o.style.height = (doc.h * MM) + 'px';
  const z = $('#zoomPct'); if (z) z.textContent = Math.round(k * 100) + '%';
}
function renderOverlay(guides) {
  const o = $('#ovl'); const els = selEls(); let h = '';
  els.forEach(el => { const single = els.length === 1; h += `<div class="sel${single ? '' : ' multi'}" style="left:${el.x}mm;top:${el.y}mm;width:${el.w}mm;height:${el.h}mm;transform:rotate(${el.rot || 0}deg)">`; if (single && !el.locked) h += ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(d => `<div class="h ${d}" data-h="${d}"></div>`).join('') + '<div class="rotline"></div><div class="h rot" data-h="rot"></div>'; h += '</div>'; });
  if (els.length > 1) { const bx = Math.min(...els.map(e => e.x)), by = Math.min(...els.map(e => e.y)), bw = Math.max(...els.map(e => e.x + e.w)) - bx, bh = Math.max(...els.map(e => e.y + e.h)) - by; h += `<div class="sel group" style="left:${bx}mm;top:${by}mm;width:${bw}mm;height:${bh}mm"></div>`; }
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
function select(ids) { endEdit(); sel = ids.filter(id => find(id)); selDay = null; renderOverlay(); renderInspector(); if (sideTab === 'layers') renderSide(); updateToolbarState(); }
function groupOf(id) { const el = find(id); if (!el || !el.group) return [id]; return page().els.filter(e => e.group === el.group).map(e => e.id); }
function updateToolbarState() { const n = sel.length; const g = selEls().some(e => e.group); const b = $('#btnGroup'); if (b) { b.hidden = n < 2 && !g; b.textContent = g ? '그룹 해제' : '그룹'; } const ds = $('#btnDist'); if (ds) ds.hidden = n < 3; }

/* ---------- 포인터 조작 ---------- */
const wrap = $('#canvasWrap');
function toMM(e) { const r = $('#canvas').getBoundingClientRect(); const k = kScale(); return { x: (e.clientX - r.left) / k / MM, y: (e.clientY - r.top) / k / MM }; }
let drag = null, lastClick = null, pen = null;
wrap.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  if (editing) { if (e.target.closest('.el-text.editing')) return; endEdit(); }
  const p = toMM(e);
  if (tool === 'pen') { pen = { pts: [[r1(p.x), r1(p.y)]] }; $('#ovl').insertAdjacentHTML('beforeend', `<svg class="penprev" viewBox="0 0 ${doc.w} ${doc.h}" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible"><path d="" fill="none" stroke="#2f5bea" stroke-width="0.6" vector-effect="non-scaling-stroke"/></svg>`); e.preventDefault(); return; }
  const hd = e.target.closest('.ovl .h');
  if (hd && sel.length === 1) { const el = find(sel[0]); drag = { kind: hd.dataset.h === 'rot' ? 'rot' : 'resize', dir: hd.dataset.h, el, start: p, o: clone(el), cx: el.x + el.w / 2, cy: el.y + el.h / 2, moved: false }; e.preventDefault(); return; }
  const dom = e.target.closest('.el');
  if (dom) {
    const id = dom.dataset.id, el = find(id); const was = sel.includes(id);
    if (el.type === 'text' && was && !el.locked && !(el.warp && el.warp !== 'none') && lastClick && lastClick.id === id && Date.now() - lastClick.t < 450) { lastClick = null; startEdit(dom); return; }
    lastClick = { id, t: Date.now() };
    const ids = e.altKey ? [id] : groupOf(id);
    if (e.shiftKey) { sel = was ? sel.filter(i => !ids.includes(i)) : sel.concat(ids.filter(i => !sel.includes(i))); select(sel); }
    else if (!was) select(ids);
    if (el.type === 'cal' && was && !e.shiftKey) { const cell = e.target.closest('.cell'); if (cell && cell.dataset.day) { selDay = Number(cell.dataset.day); renderInspector(); const ds = $('#daySel'); if (ds) ds.scrollIntoView({ block: 'center' }); } }
    if (el.locked) return;
    drag = { kind: 'move', els: selEls().filter(x => !x.locked), start: p, orig: selEls().map(x => ({ id: x.id, x: x.x, y: x.y })), moved: false };
    e.preventDefault(); return;
  }
  if (!e.shiftKey) select([]);
  drag = { kind: 'marq', start: p, moved: false };
});
document.addEventListener('pointermove', e => {
  if (pen) { const p = toMM(e); const last = pen.pts[pen.pts.length - 1]; if (Math.hypot(p.x - last[0], p.y - last[1]) > 0.6) { pen.pts.push([r1(p.x), r1(p.y)]); const pv = $('#ovl .penprev path'); if (pv) pv.setAttribute('d', FX.smoothPath(pen.pts)); } return; }
  if (!drag) return;
  const p = toMM(e); let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (Math.abs(dx) + Math.abs(dy) > 0.2) drag.moved = true;
  if (!drag.moved) return;
  if (drag.kind === 'move') {
    let guides = [];
    if (!e.altKey) { const bx = Math.min(...drag.orig.map(o => o.x)) , by = Math.min(...drag.orig.map(o => o.y)); const bw = Math.max(...drag.els.map(el => drag.orig.find(q => q.id === el.id).x + el.w)) - bx, bh = Math.max(...drag.els.map(el => drag.orig.find(q => q.id === el.id).y + el.h)) - by; const sn = snap(bx + dx, by + dy, bw, bh, drag.els.map(el => el.id)); dx = sn.x - bx; dy = sn.y - by; guides = sn.guides; }
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    drag.els.forEach(el => { const o = drag.orig.find(q => q.id === el.id); el.x = r1(o.x + dx); el.y = r1(o.y + dy); });
    liveUpdate(drag.els); renderOverlay(guides);
  } else if (drag.kind === 'resize') {
    const el = drag.el, o = drag.o, rad = -(o.rot || 0) * Math.PI / 180;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad), ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    const d = drag.dir; let x = o.x, y = o.y, w = o.w, h = o.h;
    if (d.includes('e')) w = o.w + lx; if (d.includes('s')) h = o.h + ly;
    if (d.includes('w')) { w = o.w - lx; x = o.x + lx; } if (d.includes('n')) { h = o.h - ly; y = o.y + ly; }
    const keep = (el.type === 'image' || el.type === 'mini' || el.type === 'path' || e.shiftKey) && d.length === 2;
    if (keep) { const ar = o.w / o.h; if (Math.abs(w - o.w) > Math.abs(h - o.h)) h = w / ar; else w = h * ar; if (d.includes('w')) x = o.x + o.w - w; if (d.includes('n')) y = o.y + o.h - h; }
    if (w < 2) { w = 2; if (d.includes('w')) x = o.x + o.w - 2; } if (h < 2) { h = 2; if (d.includes('n')) y = o.y + o.h - 2; }
    el.x = r1(x); el.y = r1(y); el.w = r1(w); el.h = r1(h);
    if (el.type === 'path') { const sx = el.w / o.w, sy = el.h / o.h; el.pts = o.pts.map(pt => [r1(pt[0] * sx), r1(pt[1] * sy)]); renderCanvas(); } else if (el.type === 'text' && (d === 'e' || d === 'w')) { renderCanvas(); } else liveUpdate([el]);
    renderOverlay();
  } else if (drag.kind === 'rot') {
    const el = drag.el; let a = Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180 / Math.PI + 90; if (e.shiftKey) a = Math.round(a / 15) * 15; el.rot = Math.round(((a % 360) + 360) % 360); liveUpdate([el]); renderOverlay();
  } else if (drag.kind === 'marq') {
    const x = Math.min(drag.start.x, p.x), y = Math.min(drag.start.y, p.y), w = Math.abs(dx), h = Math.abs(dy);
    sel = page().els.filter(el => !el.hidden && el.x < x + w && el.x + el.w > x && el.y < y + h && el.y + el.h > y).map(el => el.id); renderOverlay(); $('#ovl').insertAdjacentHTML('beforeend', `<div class="marq" style="left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm"></div>`);
  }
});
document.addEventListener('pointerup', e => {
  if (pen) { const pts = pen.pts; pen = null; const pv = $('#ovl .penprev'); if (pv) pv.remove(); if (pts.length < 3) return; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1, w = Math.max(2, Math.max(...xs) - x0 + 1), h = Math.max(2, Math.max(...ys) - y0 + 1); const el = { id: uid(), type: 'path', pts: pts.map(p => [r1(p[0] - x0), r1(p[1] - y0)]), x: r1(x0), y: r1(y0), w: r1(w), h: r1(h), rot: 0, stroke: penStyle.stroke, strokeW: penStyle.strokeW, fill: '', closed: false, smooth: true, opacity: 1, name: '펜 선' }; page().els.push(el); commit(); select([el.id]); rerender(); return; }
  if (!drag) return; const d = drag; drag = null;
  if (d.kind === 'marq') { renderInspector(); if (sideTab === 'layers') renderSide(); renderOverlay(); updateToolbarState(); return; }
  if (d.moved) { commit(); rerender(); } else renderOverlay();
});
const penStyle = { stroke: '#1E2B5A', strokeW: 0.8 };
function liveUpdate(els) { const c = $('#canvas'); els.forEach(el => { const dom = c.querySelector(`[data-id="${el.id}"]`); if (!dom) return; dom.style.left = el.x + 'mm'; dom.style.top = el.y + 'mm'; dom.style.width = el.w + 'mm'; dom.style[el.type === 'text' && !el.warp ? 'minHeight' : 'height'] = el.h + 'mm'; dom.style.transform = `rotate(${el.rot || 0}deg)`; }); }
function snap(x, y, w, h, selfIds) {
  const T = 1.2, guides = []; const xs = [0, doc.w / 2, doc.w], ys = [0, doc.h / 2, doc.h];
  page().els.forEach(el => { if (selfIds.includes(el.id) || el.hidden) return; xs.push(el.x, el.x + el.w / 2, el.x + el.w); ys.push(el.y, el.y + el.h / 2, el.y + el.h); });
  let bx = null, by = null, bdx = T, bdy = T, gx = null, gy = null;
  [[x, 0], [x + w / 2, w / 2], [x + w, w]].forEach(([v, off]) => xs.forEach(g => { const dd = Math.abs(v - g); if (dd < bdx) { bdx = dd; bx = g - off; gx = g; } }));
  [[y, 0], [y + h / 2, h / 2], [y + h, h]].forEach(([v, off]) => ys.forEach(g => { const dd = Math.abs(v - g); if (dd < bdy) { bdy = dd; by = g - off; gy = g; } }));
  if (gx != null) guides.push({ v: gx }); if (gy != null) guides.push({ h: gy });
  return { x: bx != null ? bx : x, y: by != null ? by : y, guides };
}
wrap.addEventListener('dblclick', e => { const dom = e.target.closest('.el-text'); if (dom && !find(dom.dataset.id).locked && !dom.classList.contains('warp')) startEdit(dom); });
function startEdit(dom) { editing = dom; dom.contentEditable = 'true'; dom.classList.add('editing'); dom.focus(); const r = document.createRange(); r.selectNodeContents(dom); const s = getSelection(); s.removeAllRanges(); s.addRange(r); renderOverlay(); }
function endEdit() { if (!editing) return; const dom = editing; editing = null; const el = find(dom.dataset.id); const t = dom.innerText.replace(/\n$/, ''); dom.contentEditable = 'false'; dom.classList.remove('editing'); if (el && t !== el.text) { el.text = t; commit(); } rerender(); }
$('#canvas').addEventListener('input', e => { if (editing && e.target === editing) { const el = find(editing.dataset.id); if (el) { const hh = r1(editing.offsetHeight / MM); if (hh !== el.h) { el.h = hh; renderOverlay(); } } } });
$('#canvas').addEventListener('blur', e => { if (editing && e.target === editing) endEdit(); }, true);
wrap.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoom = clamp((zoom || kScale()) * (e.deltaY < 0 ? 1.1 : 0.9), 0.1, 8); fitCanvas(); }, { passive: false });
$('#zoomIn').onclick = () => { zoom = clamp((zoom || kScale()) * 1.2, 0.1, 8); fitCanvas(); };
$('#zoomOut').onclick = () => { zoom = clamp((zoom || kScale()) / 1.2, 0.1, 8); fitCanvas(); };
$('#zoomFit').onclick = () => { zoom = 0; fitCanvas(); };
$('#prevPage').onclick = () => goto(cur - 1); $('#nextPage').onclick = () => goto(cur + 1);
window.addEventListener('resize', () => { fitCanvas(); renderThumbs(); });
function setTool(t) { tool = t; $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); $('#stage').classList.toggle('pen', t === 'pen'); if (t === 'pen') { select([]); toast('펜: 페이지 위에서 끌어 선을 그립니다. Esc로 끝냅니다.'); } }
$$('[data-tool]').forEach(b => b.onclick = () => setTool(tool === b.dataset.tool ? 'select' : b.dataset.tool));

document.addEventListener('keydown', e => {
  if (editing) { if (e.key === 'Escape') { e.preventDefault(); endEdit(); } return; }
  if (e.target.matches('input,textarea,select') || document.querySelector('dialog[open]')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') { if (tool !== 'select') setTool('select'); else select([]); return; }
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
  if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); toggleGroup(); return; }
  if (mod && e.key.toLowerCase() === 'c') { if (sel.length) { clip = clone(selEls()); toast('복사했습니다'); } return; }
  if (mod && e.key.toLowerCase() === 'v') { if (clip) { const gmap = {}; const ids = clip.map(el => { const n = clone(el); n.id = uid(); if (n.group) { gmap[n.group] = gmap[n.group] || uid(); n.group = gmap[n.group]; } n.x += 5; n.y += 5; page().els.push(n); return n.id; }); commit(); select(ids); rerender(); } return; }
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); select(page().els.map(x => x.id)); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.length) { e.preventDefault(); removeSel(); } return; }
  if (e.key.startsWith('Arrow')) { if (!sel.length) return; e.preventDefault(); const d = e.shiftKey ? 5 : 1; selEls().forEach(el => { if (el.locked) return; if (e.key === 'ArrowLeft') el.x -= d; if (e.key === 'ArrowRight') el.x += d; if (e.key === 'ArrowUp') el.y -= d; if (e.key === 'ArrowDown') el.y += d; }); commit(); rerender(); return; }
  if (e.key === 'PageDown') goto(cur + 1); if (e.key === 'PageUp') goto(cur - 1);
  if (e.key.toLowerCase() === 'p' && !mod) setTool(tool === 'pen' ? 'select' : 'pen');
  if (e.key.toLowerCase() === 't' && !mod) addText('b');
});
function removeSel() { page().els = page().els.filter(el => !sel.includes(el.id)); sel = []; commit(); rerender(); }
function duplicate() { if (!sel.length) return; const gmap = {}; const ids = selEls().map(el => { const n = clone(el); n.id = uid(); if (n.group) { gmap[n.group] = gmap[n.group] || uid(); n.group = gmap[n.group]; } n.x += 5; n.y += 5; page().els.push(n); return n.id; }); commit(); select(ids); rerender(); }
function toggleGroup() { const els = selEls(); if (!els.length) return; if (els.some(e => e.group)) { els.forEach(e => delete e.group); toast('그룹을 해제했습니다'); } else if (els.length > 1) { const g = uid(); els.forEach(e => e.group = g); toast('그룹으로 묶었습니다'); } commit(); select(els.map(e => e.id)); }
function reorder(how) { if (!sel.length) return; const els = page().els; const ids = sel.slice(); const picked = els.filter(e => ids.includes(e.id)); const rest = els.filter(e => !ids.includes(e.id)); if (how === 'front') page().els = rest.concat(picked); else if (how === 'back') page().els = picked.concat(rest); else { const i = els.findIndex(x => x.id === ids[0]); const [el] = els.splice(i, 1); els.splice(how === 'up' ? Math.min(els.length, i + 1) : Math.max(0, i - 1), 0, el); } commit(); rerender(); }
$('#btnDup').onclick = duplicate; $('#btnDel').onclick = removeSel; $('#btnGroup').onclick = toggleGroup;
$('#btnFront').onclick = () => reorder('front'); $('#btnBack').onclick = () => reorder('back'); $('#btnUp').onclick = () => reorder('up'); $('#btnDown').onclick = () => reorder('down');
$$('[data-align]').forEach(b => b.onclick = () => {
  const els = selEls(); if (!els.length) return; const a = b.dataset.align;
  let bx = 0, by = 0, bw = doc.w, bh = doc.h;
  if (els.length > 1) { bx = Math.min(...els.map(e => e.x)); by = Math.min(...els.map(e => e.y)); bw = Math.max(...els.map(e => e.x + e.w)) - bx; bh = Math.max(...els.map(e => e.y + e.h)) - by; }
  els.forEach(el => { if (a === 'l') el.x = bx; if (a === 'c') el.x = r1(bx + (bw - el.w) / 2); if (a === 'r') el.x = r1(bx + bw - el.w); if (a === 't') el.y = by; if (a === 'm') el.y = r1(by + (bh - el.h) / 2); if (a === 'b') el.y = r1(by + bh - el.h); });
  commit(); rerender();
});
$('#btnDist').onclick = () => { const els = selEls(); if (els.length < 3) return; const horiz = (Math.max(...els.map(e => e.x + e.w)) - Math.min(...els.map(e => e.x))) >= (Math.max(...els.map(e => e.y + e.h)) - Math.min(...els.map(e => e.y))); const k = horiz ? 'x' : 'y', s = horiz ? 'w' : 'h'; const sorted = els.slice().sort((a, b) => a[k] - b[k]); const first = sorted[0], last = sorted[sorted.length - 1]; const span = (last[k] + last[s]) - first[k]; const total = sorted.reduce((a, e) => a + e[s], 0); const gap = (span - total) / (sorted.length - 1); let pos = first[k]; sorted.forEach(e => { e[k] = r1(pos); pos += e[s] + gap; }); commit(); rerender(); };
$('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;

/* ---------- 요소 추가 ---------- */
const TEXT_DEF = Object.assign({ type: 'text', text: '글자를 입력하세요', x: 20, y: 20, w: 80, h: 10, rot: 0, font: 'Noto Sans KR', size: 14, weight: 400, italic: false, color: '#1a1a1a', align: 'left', lh: 1.3, ls: 0, strokeW: 0, strokeC: '#ffffff', shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, FX.TEXT_FX_DEF);
function addEl(el, at) { el.id = el.id || uid(); if (at !== false) { el.x = r1(clamp((doc.w - el.w) / 2, 0, doc.w)); el.y = r1(clamp((doc.h - el.h) / 2, 0, doc.h)); } page().els.push(el); commit(); select([el.id]); rerender(); return el; }
function addEls(els, name) { if (!els.length) return; const xs = els.map(e => e.x), ys = els.map(e => e.y); const bw = Math.max(...els.map(e => e.x + e.w)) - Math.min(...xs), bh = Math.max(...els.map(e => e.y + e.h)) - Math.min(...ys); const ox = r1(clamp((doc.w - bw) / 2, 0, doc.w)) - Math.min(...xs), oy = r1(clamp((doc.h - bh) / 2, 0, doc.h)) - Math.min(...ys); const g = els.length > 1 ? uid() : null; els.forEach(e => { e.id = e.id || uid(); e.x = r1(e.x + ox); e.y = r1(e.y + oy); if (g) e.group = g; page().els.push(e); }); commit(); select(els.map(e => e.id)); rerender(); noteRecentElem(name); }
function addText(preset, st) { const base = Object.assign({}, TEXT_DEF, lastTextStyle || {}); const p = preset === 'h' ? { text: '제목을 입력하세요', size: 36, weight: 700, w: 120, h: 16 } : preset === 's' ? { text: '부제목을 입력하세요', size: 20, weight: 500, w: 100, h: 10 } : { text: '본문 글을 입력하세요', size: 12, weight: 400, w: 90, h: 8 }; const el = addEl(Object.assign(base, p, st || {})); setTimeout(() => { const d = $(`#canvas [data-id="${el.id}"]`); if (d && !(el.warp && el.warp !== 'none')) startEdit(d); }, 50); return el; }
function addShape(kind, st) { const def = { type: 'shape', kind, x: 0, y: 0, w: 40, h: kind === 'line' ? 4 : 40, rot: 0, fill: kind === 'line' ? '#333333' : '#F0716B', stroke: '', strokeW: kind === 'line' ? 0.6 : 0, radius: 0, opacity: 1, name: '' }; if (kind === 'line') def.w = 80; if (kind === 'polygon') def.sides = 6; addEl(Object.assign(def, st || {})); }
function addImage(ref) { const el = { type: 'image', src: ref, x: 0, y: 0, w: 60, h: 60, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }; const s = src(ref); if (s) { const i = new Image(); i.onload = () => { const ar = i.naturalWidth / i.naturalHeight; el.w = Math.min(80, doc.w * 0.6); el.h = r1(el.w / ar); if (el.h > doc.h * 0.8) { el.h = r1(doc.h * 0.8); el.w = r1(el.h * ar); } el.x = r1((doc.w - el.w) / 2); el.y = r1((doc.h - el.h) / 2); rerender(); commit(); }; i.src = s; } addEl(el); }
function addCal() { const y = doc.calendar.year || new Date().getFullYear(); ensureHolidays(y, true); addEl({ type: 'cal', year: y, month: 1, x: 0, y: 0, w: Math.min(204, doc.w - 20), h: Math.min(100, doc.h - 30), rot: 0, opacity: 1, s: {}, events: [], notes: [], name: '달력' }); }
function addMini() { const y = doc.calendar.year || new Date().getFullYear(); addEl({ type: 'mini', year: y, month: 1, x: 0, y: 0, w: 42, h: 24, rot: 0, opacity: 1, s: {}, name: '미니 달력' }); }
function fileToDataURL(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }
function recentElems() { try { return JSON.parse(localStorage.getItem('naracal-recent-elems') || '[]'); } catch (e) { return []; } }
function noteRecentElem(id) { if (!id) return; const r = recentElems().filter(x => x !== id); r.unshift(id); try { localStorage.setItem('naracal-recent-elems', JSON.stringify(r.slice(0, 8))); } catch (e) {} }

/* ======================= 왼쪽 레일 패널 ======================= */
let sideTab = 'pages', tplCat = 'all', tplQ = '', elCat = 'all', elQ = '', tplF = { format: '', season: '', age: '', occasion: '', biz: '' };
const RAIL = [['pages', '페이지', 'i-pages'], ['tpl', '템플릿', 'i-tpl'], ['elems', '요소', 'i-elems'], ['text', '텍스트', 'i-text'], ['photo', '사진', 'i-img'], ['upload', '업로드', 'i-upload'], ['project', '프로젝트', 'i-folder'], ['ai', 'AI 도구', 'i-ai'], ['bg', '배경', 'i-bg'], ['theme', '테마', 'i-theme'], ['chart', '차트', 'i-chart'], ['layers', '레이어', 'i-layers']];
function renderRail() { $('#rail').innerHTML = RAIL.map(([k, t, ic]) => `<button data-tab="${k}" aria-selected="${sideTab === k}" title="${t}"><svg class="ic"><use href="#${ic}"/></svg><span>${t}</span></button>`).join(''); $$('#rail button').forEach(b => b.onclick = () => { sideTab = b.dataset.tab; renderRail(); renderSide(); }); }
function tmpSheet(w, h, els, bg) { const tmp = Object.assign({}, doc, { w, h, bleed: 0, cropMarks: false }); const saved = doc; doc = tmp; try { return sheetHTML({ id: 'tmp', bg: bg || '#ffffff', els }, 'thumb'); } finally { doc = saved; } }
function fitBoxes(root, sel_, maxH) { root.querySelectorAll(sel_).forEach(bx => { const w = Number(bx.dataset.w), h = Number(bx.dataset.h), n = Number(bx.dataset.n) || 1; const bw = bx.clientWidth; if (!bw) return; const k = Math.min(bw / (w * MM * n + (n - 1) * 4), (maxH || 110) / (h * MM)); const total = w * MM * k * n + (n - 1) * 4; bx.querySelectorAll(':scope > .sheet').forEach((sh, i) => { sh.style.transform = `scale(${k})`; sh.style.left = ((bw - total) / 2 + i * (w * MM * k + 4)) + 'px'; }); bx.style.height = (h * MM * k) + 'px'; }); }
function renderSide() {
  const body = $('#sidebody'); const yearNow = doc.calendar.year || 2027;
  $('#sideTitle').textContent = (RAIL.find(r => r[0] === sideTab) || [])[1] || '';
  body.onclick = null; body.oninput = null; body.onchange = null;
  if (sideTab === 'pages') {
    body.innerHTML = `<div class="row" style="margin-bottom:8px"><button class="btn sm" id="pgAdd">+ 새 페이지</button><button class="btn sm" id="pgDup">복제</button><button class="btn sm icon" id="pgUp" title="위로">↑</button><button class="btn sm icon" id="pgDown" title="아래로">↓</button><button class="btn sm danger" id="pgDel">삭제</button></div><div id="thumbs"></div>`;
    renderThumbs();
    $('#thumbs').onclick = e => { const b = e.target.closest('.thumb'); if (b) goto(Number(b.dataset.i)); };
    $('#pgAdd').onclick = () => { doc.pages.splice(cur + 1, 0, newPage(page().bg)); commit(); goto(cur + 1); };
    $('#pgDup').onclick = () => { const n = clone(page()); n.id = uid(); const gmap = {}; n.els.forEach(e => { e.id = uid(); if (e.group) { gmap[e.group] = gmap[e.group] || uid(); e.group = gmap[e.group]; } }); doc.pages.splice(cur + 1, 0, n); commit(); goto(cur + 1); };
    $('#pgDel').onclick = () => { if (doc.pages.length === 1) { toast('마지막 페이지는 지울 수 없습니다', true); return; } if (!window.confirm(`${cur + 1}쪽을 지울까요?`)) return; doc.pages.splice(cur, 1); commit(); goto(Math.min(cur, doc.pages.length - 1)); };
    $('#pgUp').onclick = () => { if (cur === 0) return; [doc.pages[cur - 1], doc.pages[cur]] = [doc.pages[cur], doc.pages[cur - 1]]; commit(); goto(cur - 1); };
    $('#pgDown').onclick = () => { if (cur >= doc.pages.length - 1) return; [doc.pages[cur + 1], doc.pages[cur]] = [doc.pages[cur], doc.pages[cur + 1]]; commit(); goto(cur + 1); };
  } else if (sideTab === 'tpl') {
    body.innerHTML = `<div class="wz-card"><div class="wz-year">${yearNow}<small>년</small></div><p class="hint" style="margin:0 0 8px">연도별 달력 모양과 테마를 미리 보며 표지·인성·달력 26쪽을 한 번에 만듭니다.</p><button class="btn primary full" id="wzOpen"><svg class="ic"><use href="#i-cal"/></svg>캘린더 마법사 열기</button></div>
    <h3>템플릿 갤러리 <small id="tcount"></small></h3>
    <label class="f"><input type="text" id="tplSearch" placeholder="템플릿 검색 (예: 가을 모집 포스터, 유아, 카페 오픈)" value="${esc(tplQ)}"></label>
    <div class="facets">${[['format', '제작 형태'], ['season', '계절'], ['age', '연령'], ['occasion', '상황'], ['biz', '직종']].map(([k, t]) => `<select data-facet="${k}"><option value="">${t}: 전체</option>${NC.tpl.facets[k].map(v => `<option value="${esc(v)}" ${tplF[k] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`).join('')}${Object.values(tplF).some(Boolean) || tplQ ? '<button class="btn sm" id="tplClear">초기화</button>' : ''}</div>
    <div class="tgal" id="tgal"></div>
    <h3>문서 크기</h3>
    <label class="f"><select id="docSize">${SIZES.map(s => `<option value="${s[0]}" ${s[2] === doc.w && s[3] === doc.h ? 'selected' : ''}>${s[1]}</option>`).join('')}<option value="custom">직접 입력</option></select></label>
    <div class="grid2"><label class="f"><span>가로(mm)</span><input type="number" id="docW" value="${doc.w}" step="0.5"></label><label class="f"><span>세로(mm)</span><input type="number" id="docH" value="${doc.h}" step="0.5"></label></div>
    <button class="btn full" id="docSizeApply">크기 적용 (모든 페이지)</button>`;
    $('#wzOpen').onclick = () => openWizard(yearNow);
    renderGallery();
    body.querySelectorAll('[data-facet]').forEach(sl => sl.onchange = () => { tplF[sl.dataset.facet] = sl.value; renderSide(); });
    const tc_ = $('#tplClear'); if (tc_) tc_.onclick = () => { tplF = { format: '', season: '', age: '', occasion: '', biz: '' }; tplQ = ''; tplCat = 'all'; renderSide(); };
    let tq; $('#tplSearch').oninput = e => { tplQ = e.target.value; clearTimeout(tq); tq = setTimeout(renderGallery, 250); };
    $('#docSize').onchange = e => { const s = SIZES.find(x => x[0] === e.target.value); if (s) { $('#docW').value = s[2]; $('#docH').value = s[3]; } };
    $('#docSizeApply').onclick = () => { const w = Number($('#docW').value), h = Number($('#docH').value); if (!(w > 10 && h > 10)) return; doc.w = w; doc.h = h; commit(); zoom = 0; renderAll(); toast('문서 크기를 바꿨습니다'); };
  } else if (sideTab === 'elems') {
    renderElems();
  } else if (sideTab === 'text') {
    const rf = recentFonts();
    body.innerHTML = `<h3>글자 추가</h3><div class="tile"><button data-add="text:h"><span class="t-h">제목</span></button><button data-add="text:s"><span class="t-s">부제목</span></button><button data-add="text:b">본문 글</button><button data-add="text:v"><span style="writing-mode:vertical-rl">세로</span></button></div>
    <h3>스타일로 추가</h3><div class="tstyles">${FX.TEXT_PRESETS.map(p => `<button data-tstyle="${p.id}" class="tsb"><span style="${FX.textStyle(Object.assign({}, TEXT_DEF, { font: 'Jua', size: 18, weight: 800, align: 'center' }, p.st))}">${esc(p.name)}</span></button>`).join('')}</div>
    <h3>글꼴 조합</h3><div class="fontpairs">${[['Jua', 'Noto Sans KR', '귀엽고 또렷'], ['Black Han Sans', 'Pretendard', '강하고 현대적'], ['Gowun Batang', 'Gowun Dodum', '단정한 명조'], ['Do Hyeon', 'Nanum Gothic', '힘찬 고딕'], ['Nanum Brush Script', 'Noto Serif KR', '붓글씨 감성'], ['Dongle', 'Gaegu', '둥글둥글 손글씨']].map(([a, b, t]) => `<button class="fontpair" data-pair="${a}|${b}"><b style="font-family:'${a}'">${esc(a)}</b><span style="font-family:'${b}'">${esc(b)} · ${t}</span></button>`).join('')}</div>
    ${rf.length ? `<h3>최근 사용 글꼴</h3><div class="row">${rf.map(f => `<button class="btn sm" data-usefont="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</button>`).join('')}</div>` : ''}
    <p class="hint">글 상자를 두 번 누르면 바로 고칩니다. 오른쪽 속성 패널에서 그라데이션·외곽선·그림자·광선·3D·휘기 등 효과를 더합니다.</p>`;
    body.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.add) { const a = b.dataset.add.split(':')[1]; if (a === 'v') addText('s', { vertical: true, text: '세로로 쓰는 글', w: 14, h: 60 }); else addText(a); } if (b.dataset.tstyle) { const p = FX.TEXT_PRESETS.find(x => x.id === b.dataset.tstyle); addText('h', Object.assign({ font: 'Jua', size: 32 }, p.st)); } if (b.dataset.pair) { const [a, bb] = b.dataset.pair.split('|'); lastTextStyle = Object.assign({}, lastTextStyle || {}, { font: a }); noteFont(a); noteFont(bb); const t = addText('h', { font: a }); setTimeout(() => { endEdit(); const s2 = addText('b', { font: bb, text: '본문은 ' + bb + ' 글꼴로 씁니다.' }); s2.y = t.y + t.h + 4; rerender(); }, 120); } if (b.dataset.usefont) { const els = selEls().filter(x => x.type === 'text'); if (els.length) { els.forEach(x => x.font = b.dataset.usefont); commit(); rerender(); } else { lastTextStyle = Object.assign({}, lastTextStyle || {}, { font: b.dataset.usefont }); toast('새 글자의 기본 글꼴로 정했습니다'); } } };
  } else if (sideTab === 'photo') {
    const groups = [['2026 삽화', k => k.startsWith('illu-')], ['마스코트', k => k.startsWith('mascot-')], ['로고·아이콘', k => !k.startsWith('illu-') && !k.startsWith('mascot-')]];
    const mine = Object.keys(doc.assets);
    body.innerHTML = `<div class="row" style="margin-bottom:6px"><label class="btn sm">파일 올리기<input type="file" accept="image/*" id="imgFile" hidden multiple></label><button class="btn sm ai" id="imgAI">AI로 만들기</button></div>
    <p class="hint">그림을 누르면 페이지에 추가됩니다. 이미지 요소를 선택한 상태면 그 그림을 바꿉니다.</p>
    ${mine.length ? `<h3>내 이미지 (${mine.length})</h3><div class="picker">${mine.map(k => `<button data-img="a:${k}"><img src="${doc.assets[k]}" alt=""></button>`).join('')}</div>` : ''}
    ${groups.map(([t, f]) => { const ks = Object.keys(ASSETS).filter(f); return `<h3>${t}</h3><div class="picker">${ks.map(k => `<button data-img="asset:${k}" title="${k}"><img src="${ASSETS[k]}" alt="${k}"></button>`).join('')}</div>`; }).join('')}`;
    body.onclick = e => { const b = e.target.closest('[data-img]'); if (!b) return; const ref = b.dataset.img; const s = selEls(); if (s.length === 1 && s[0].type === 'image') { s[0].src = ref; commit(); rerender(); toast('그림을 바꿨습니다'); } else addImage(ref); };
    $('#imgFile').onchange = async e => { for (const f of e.target.files) addImage(addAsset(await fileToDataURL(f))); e.target.value = ''; renderSide(); };
    $('#imgAI').onclick = () => openAI('image');
  } else if (sideTab === 'upload') {
    const mine = Object.keys(doc.assets);
    body.innerHTML = `<div class="tile"><label><svg class="ic" style="width:22px;height:22px"><use href="#i-upload"/></svg>이미지 올리기<input type="file" accept="image/*" id="upImg" hidden multiple></label><label><svg class="ic" style="width:22px;height:22px"><use href="#i-font"/></svg>글꼴 올리기<input type="file" accept=".ttf,.otf,.woff,.woff2" id="upFont" hidden></label></div>
    <p class="hint">올린 이미지와 글꼴은 이 문서 파일 안에 함께 저장됩니다. 사진은 JPG, 투명 배경은 PNG를 권합니다.</p>
    <h3>내 이미지 (${mine.length})</h3>${mine.length ? `<div class="picker">${mine.map(k => `<button data-img="a:${k}" title="누르면 추가 · 우클릭 삭제" data-del="${k}"><img src="${doc.assets[k]}" alt=""></button>`).join('')}</div>` : '<p class="hint">아직 없습니다.</p>'}
    <h3>내 글꼴 (${doc.fonts.length})</h3>${doc.fonts.length ? `<ul class="list">${doc.fonts.map((f, i) => `<li><span style="font-family:'${esc(f.family)}'">${esc(f.family)}</span><button class="x" data-delfont="${i}">×</button></li>`).join('')}</ul>` : '<p class="hint">아직 없습니다.</p>'}`;
    $('#upImg').onchange = async e => { for (const f of e.target.files) addImage(addAsset(await fileToDataURL(f))); e.target.value = ''; renderSide(); };
    $('#upFont').onchange = async e => { const f = e.target.files[0]; if (!f) return; const data = await fileToDataURL(f); const family = f.name.replace(/\.(ttf|otf|woff2?)$/i, ''); try { const ff = new FontFace(family, `url(${data})`); await ff.load(); document.fonts.add(ff); doc.fonts.push({ family, data }); commit(); renderSide(); toast(`글꼴 "${family}"을 추가했습니다`); } catch (err) { toast('글꼴을 읽지 못했습니다', true); } };
    body.onclick = e => { const b = e.target.closest('[data-img]'); if (b) addImage(b.dataset.img); const d = e.target.closest('[data-delfont]'); if (d) { doc.fonts.splice(Number(d.dataset.delfont), 1); commit(); renderSide(); } };
    body.oncontextmenu = e => { const b = e.target.closest('[data-del]'); if (!b) return; e.preventDefault(); if (window.confirm('이 이미지를 보관함에서 지울까요? (페이지에 쓰인 곳은 비워집니다)')) { delete doc.assets[b.dataset.del]; commit(); renderAll(); } };
  } else if (sideTab === 'project') {
    const st = store.state;
    body.innerHTML = `<h3>문서</h3>${F('문서 이름', 'doc.name', doc.name)}
    <div class="grid2">${F('도련(mm)', 'doc.bleed', doc.bleed, { type: 'number', min: 0, max: 10, step: 0.5 })}${F('재단선', 'doc.cropMarks', doc.cropMarks, { type: 'check' })}</div>
    <p class="hint">${doc.w}×${doc.h}mm · ${doc.pages.length}쪽 · 크기는 템플릿 탭 아래에서 바꿉니다.</p>
    <h3>저장 · 동기화</h3>
    <p class="hint">${st.dir && st.handle ? `동기화 폴더 <b>${esc(st.dirName)}</b>의 <b>${esc(st.fileName)}</b>에 자동 저장 중 · 설정값도 함께 동기화` : st.handle ? `파일 <b>${esc(st.fileName)}</b>에 자동 저장 중` : '브라우저에만 자동 저장 중 (여러 PC에서 쓰려면 "저장·동기화"에서 구글 드라이브 폴더 연결)'}</p>
    <div class="tile"><button data-pj="save"><svg class="ic" style="width:22px;height:22px"><use href="#i-save"/></svg>저장·동기화</button><button data-pj="open"><svg class="ic" style="width:22px;height:22px"><use href="#i-open"/></svg>열기</button><button data-pj="new"><svg class="ic" style="width:22px;height:22px"><use href="#i-new"/></svg>새 문서</button><button data-pj="down"><svg class="ic" style="width:22px;height:22px"><use href="#i-upload"/></svg>사본 내려받기</button></div>
    <h3>내보내기</h3><div class="tile"><button data-pj="pdf"><svg class="ic" style="width:22px;height:22px"><use href="#i-pdf"/></svg>PDF</button><button data-pj="png"><svg class="ic" style="width:22px;height:22px"><use href="#i-img"/></svg>현재 쪽 PNG</button></div>
    <h3>공휴일</h3><p class="hint">${Object.keys(doc.holidays).length ? '적용 연도: ' + Object.keys(doc.holidays).sort().map(y => `${y}년(${doc.holidays[y].length})`).join(', ') : '아직 없습니다.'}</p><button class="btn sm" data-pj="hol">공휴일 가져오기·편집</button>
    <h3>반복 일정 규칙</h3><button class="btn sm" data-pj="rules">규칙 편집</button>`;
    body.onclick = e => { const b = e.target.closest('[data-pj]'); if (!b) return; const k = b.dataset.pj; if (k === 'save') openSaveDialog(); if (k === 'open') $('#btnOpen').click(); if (k === 'new') $('#btnNew').click(); if (k === 'down') { gcAssets(); store.download(doc); } if (k === 'pdf') $('#btnExport').click(); if (k === 'png') $('#btnPNG').click(); if (k === 'hol') openHoliday(); if (k === 'rules') openRules(); };
    body.oninput = e => { const t = e.target, k = t.dataset.k; if (!k) return; const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value; doc[k.slice(4)] = v; if (k === 'doc.name') $('#pname').value = v; markDirty(); };
  } else if (sideTab === 'ai') {
    body.innerHTML = `<p class="hint">Claude가 문구와 이미지 프롬프트를 만들고, Gemini가 삽화를 그립니다. API 키는 "API 설정"에 넣습니다.</p>
    <div class="tile"><button data-ai="content"><svg class="ic" style="width:22px;height:22px"><use href="#i-ai"/></svg>인성 문구 제안</button><button data-ai="image"><svg class="ic" style="width:22px;height:22px"><use href="#i-img"/></svg>AI 이미지 생성</button><button data-ai="keys"><svg class="ic" style="width:22px;height:22px"><use href="#i-help"/></svg>API 설정</button><button data-ai="edit"><svg class="ic" style="width:22px;height:22px"><use href="#i-elems"/></svg>이미지 편집기</button></div>
    <h3>이미지 편집기</h3><p class="hint">선택한 이미지의 배경을 색으로 지정해 지우고(스포이트·허용 범위·부드러운 가장자리), 지우개·복원 브러시로 세밀하게 다듬고, 자를 수 있습니다.</p>`;
    body.onclick = e => { const b = e.target.closest('[data-ai]'); if (!b) return; if (b.dataset.ai === 'edit') { const el = selEls()[0]; if (el && el.type === 'image' && src(el.src)) openImgEditor(el); else toast('먼저 이미지 요소를 선택하세요', true); } else openAI(b.dataset.ai); };
  } else if (sideTab === 'bg') {
    const pg = page();
    const grads = [['linear-gradient(135deg,#FFE89A,#FFD34D)', '옐로'], ['linear-gradient(135deg,#1E2B5A,#2F5BEA)', '네이비'], ['linear-gradient(135deg,#E0564B,#FFB199)', '선셋'], ['linear-gradient(180deg,#DDF3EA,#FFFFFF)', '민트 페이드'], ['linear-gradient(135deg,#6B3FD1,#E0564B)', '퍼플 레드'], ['linear-gradient(180deg,#E6EDF2,#FFFFFF)', '스카이 페이드'], ['radial-gradient(circle at 30% 20%,#FFF7CC,#FFE89A)', '빛 번짐'], ['linear-gradient(135deg,#1B1B1B,#3A3A3A)', '블랙']];
    const pats = [['radial-gradient(#1E2B5A22 1.2px, transparent 1.2px) 0 0/8px 8px, #FFFFFF', '점'], ['repeating-linear-gradient(45deg,#FFE89A 0 6px,#FFF4CC 6px 12px)', '사선'], ['linear-gradient(#E6EDF2 1px, transparent 1px) 0 0/10px 10px, linear-gradient(90deg,#E6EDF2 1px, transparent 1px) 0 0/10px 10px, #FFFFFF', '격자'], ['repeating-linear-gradient(0deg,#F3F4F7 0 8px,#FFFFFF 8px 16px)', '가로줄'], ['radial-gradient(circle,#FFD34D 20%, transparent 21%) 0 0/14px 14px, #FFF8E8', '물방울'], ['repeating-linear-gradient(90deg,#1E2B5A 0 2px,transparent 2px 24px), #FFFFFF', '세로선']];
    body.innerHTML = `<h3>단색</h3><div class="row">${['#ffffff', '#FFE89A', '#E6EDF2', '#DDF3EA', '#FFE9D6', '#F0EBFB', '#FDE7E4', '#F3F4F7', '#1E2B5A', '#E0564B', '#2F5D3A', '#1a1a1a'].map(c => `<button class="swb" data-bg="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>
    <label class="f"><span>직접 고르기</span><input type="color" id="bgColor" value="${/^#[0-9a-f]{6}$/i.test(pg.bg) ? pg.bg : '#ffffff'}"></label>
    <h3>그라데이션</h3><div class="bggrid">${grads.map(([g, n]) => `<button data-bg="${esc(g)}" style="background:${g}" title="${n}"><span>${n}</span></button>`).join('')}</div>
    <h3>패턴</h3><div class="bggrid">${pats.map(([g, n]) => `<button data-bg="${esc(g)}" style="background:${g}" title="${n}"><span>${n}</span></button>`).join('')}</div>
    <div class="row" style="margin-top:10px"><button class="btn sm" id="bgAll">모든 페이지에 적용</button><button class="btn sm" id="bgImg">사진을 배경으로</button></div>
    <p class="hint">배경은 페이지 전체를 채우며 도련까지 자동으로 늘어납니다.</p>`;
    body.onclick = e => { const b = e.target.closest('[data-bg]'); if (b) { page().bg = b.dataset.bg; commit(); rerender(); return; } if (e.target.id === 'bgAll') { doc.pages.forEach(p => p.bg = page().bg); commit(); renderAll(); toast('모든 페이지 배경을 바꿨습니다'); } if (e.target.id === 'bgImg') { const el = selEls()[0]; if (el && el.type === 'image') { el.x = 0; el.y = 0; el.w = doc.w; el.h = doc.h; el.fit = 'cover'; reorder('back'); toast('이미지를 배경 크기로 맞췄습니다'); } else toast('먼저 이미지 요소를 선택하세요', true); } };
    $('#bgColor').oninput = e => { page().bg = e.target.value; renderCanvas(); }; $('#bgColor').onchange = () => { commit(); rerender(); };
  } else if (sideTab === 'theme') {
    const cur_ = (doc.calendar.theme || {}).id; const hasCal = doc.pages.some(p => p.kind);
    body.innerHTML = `<p class="hint">달력 테마는 표지·인성·달력·뒷표지 전체 디자인입니다. ${hasCal ? '누르면 현재 캘린더에 바로 적용됩니다(문구·일정·그림 유지).' : '캘린더가 없으면 마법사로 새로 만듭니다.'}</p><div class="wz-themes" id="themeGrid"></div><div class="row" style="margin-top:10px"><button class="btn sm" id="themeWz">마법사에서 더 자세히</button></div>`;
    const saved = doc; const html = []; try { CAL.THEMES.forEach(th => { const t = Object.assign({}, saved, { calendar: Object.assign(clone(saved.calendar), { theme: clone(th), year: yearNow }), w: 224, h: 154, bleed: 0, cropMarks: false }); doc = t; const pv = CAL.buildPages(t, uid, { year: yearNow, kind: 'virtue', month: 1 })[0]; const pc = CAL.buildPages(t, uid, { year: yearNow, kind: 'cal', month: 1 })[0]; html.push(`<button class="wz-th ${cur_ === th.id ? 'on' : ''}" data-th="${th.id}" title="${esc(th.desc)}"><div class="wz-thbox" data-w="224" data-h="154" data-n="2">${sheetHTML(pv, 'thumb')}${sheetHTML(pc, 'thumb')}</div><span>${esc(th.name)}</span><small>${esc(th.desc)}</small></button>`); }); } finally { doc = saved; }
    $('#themeGrid').innerHTML = html.join(''); requestAnimationFrame(() => fitBoxes(body, '.wz-thbox', 80));
    body.onclick = e => { const b = e.target.closest('[data-th]'); if (b) { const th = CAL.THEMES.find(x => x.id === b.dataset.th); if (hasCal) { doc.calendar.theme = clone(th); const n = CAL.retheme(doc, uid, yearNow); ensureAllHolidays(); commit(); renderAll(); toast(`"${th.name}" 테마를 ${n}쪽에 적용했습니다`); } else openWizard(yearNow, th.id); } if (e.target.id === 'themeWz') openWizard(yearNow); };
  } else if (sideTab === 'chart') {
    const items = NC.elems.items.filter(i => i.cat === 'chart');
    body.innerHTML = `<p class="hint">차트를 넣고 오른쪽 속성 패널에서 항목과 값을 적습니다. 출석률·설문·띠 비율 같은 자료를 그림으로 보여 줄 때 씁니다.</p><div class="egrid" id="chartGrid">${items.map(it => elemCard(it)).join('')}</div>`;
    requestAnimationFrame(() => fitBoxes(body, '.ebox', 70));
    body.onclick = e => { const b = e.target.closest('[data-el]'); if (b) insertElem(b.dataset.el); };
  } else if (sideTab === 'layers') {
    const els = page().els.slice().reverse();
    body.innerHTML = `<h3>${cur + 1}쪽 레이어 (${els.length}) · 위가 앞</h3><div>${els.map(el => `<div class="layer ${sel.includes(el.id) ? 'active' : ''}" data-id="${el.id}"><i class="ltype">${({ text: '가', image: '▣', shape: '◆', path: '〰', cal: '▦', mini: '▤', chart: '▥' })[el.type] || '•'}</i><span>${esc(elName(el))}${el.group ? ' <small style="color:#888">(그룹)</small>' : ''}</span><button data-vis="${el.id}" class="${el.hidden ? '' : 'on'}" title="보이기">${el.hidden ? '○' : '◉'}</button><button data-lock="${el.id}" class="${el.locked ? 'on' : ''}" title="잠금">${el.locked ? '🔒' : '🔓'}</button></div>`).join('') || '<p class="hint">요소가 없습니다</p>'}</div>`;
    body.onclick = e => { const v = e.target.closest('[data-vis]'); if (v) { const el = find(v.dataset.vis); el.hidden = !el.hidden; commit(); rerender(); renderSide(); return; } const l = e.target.closest('[data-lock]'); if (l) { const el = find(l.dataset.lock); el.locked = !el.locked; commit(); renderOverlay(); renderSide(); return; } const row = e.target.closest('.layer'); if (row) select(e.shiftKey ? sel.concat(row.dataset.id) : [row.dataset.id]); };
  }
}
/* ---- 요소 패널 ---- */
function elemCard(it) { const els = it.make(uid, { year: doc.calendar.year || 2027 }); return `<button class="ecard" data-el="${it.id}" title="${esc(it.name)}"><div class="ebox" data-w="${it.w}" data-h="${it.h}">${tmpSheet(it.w, it.h, els, it.cat === 'icon' || it.cat === 'illust' ? 'transparent' : '#ffffff')}</div>${it.cat === 'icon' ? '' : `<span>${esc(it.name)}</span>`}</button>`; }
function insertElem(id) { const it = NC.elems.get(id); if (!it) return; const els = it.make(uid, { year: doc.calendar.year || 2027 }); addEls(els, it.id); }
function renderElems() {
  const body = $('#sidebody'); const q = elQ.trim().toLowerCase();
  const all = NC.elems.items.filter(i => !q || (i.name + ' ' + i.kw).toLowerCase().includes(q));
  const recent = recentElems().map(id => NC.elems.get(id)).filter(Boolean);
  let h = `<label class="f"><input type="text" id="elSearch" placeholder="요소 검색 (예: 별, 말풍선, 표)" value="${esc(elQ)}"></label><div class="tcats" id="elcats">${NC.elems.cats.map(([k, t]) => `<button data-ec="${k}" class="${elCat === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  if (elCat === 'all' && !q) {
    if (recent.length) h += `<h3>최근 사용</h3><div class="egrid">${recent.map(elemCard).join('')}</div>`;
    NC.elems.cats.slice(1).forEach(([k, t]) => { const list = all.filter(i => i.cat === k); if (!list.length) return; h += `<div class="esec"><h3>${t} <small>${list.length}</small></h3><button class="more" data-ec="${k}">더보기 ›</button></div><div class="egrid ${k === 'icon' ? 'icons' : ''}">${list.slice(0, k === 'icon' ? 16 : 6).map(elemCard).join('')}</div>`; });
  } else {
    const list = all.filter(i => elCat === 'all' || i.cat === elCat);
    h += `<p class="hint" style="margin:4px 0">${list.length}개</p><div class="egrid ${elCat === 'icon' ? 'icons' : ''}">${list.map(elemCard).join('') || '<p class="hint">맞는 요소가 없습니다</p>'}</div>`;
  }
  h += `<p class="hint" style="margin-top:12px">요소를 누르면 페이지 가운데에 들어갑니다. 여러 조각으로 된 요소는 자동으로 그룹이 되어 함께 움직입니다 (Ctrl+G로 그룹 해제·묶기).</p>`;
  body.innerHTML = h;
  requestAnimationFrame(() => fitBoxes(body, '.ebox', 64));
  body.onclick = e => { const c = e.target.closest('[data-ec]'); if (c) { elCat = c.dataset.ec; renderElems(); return; } const b = e.target.closest('[data-el]'); if (b) insertElem(b.dataset.el); };
  let tq; $('#elSearch').oninput = e => { elQ = e.target.value; clearTimeout(tq); tq = setTimeout(() => { renderElems(); const i = $('#elSearch'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
}
function elName(el) { if (el.name) return el.name; if (el.type === 'text') return (el.text || '글자').split('\n')[0].slice(0, 20); if (el.type === 'image') return '이미지'; if (el.type === 'shape') return (FX.SHAPES.find(s => s[0] === el.kind) || [])[1] || '도형'; if (el.type === 'path') return '펜 선'; if (el.type === 'chart') return '차트'; if (el.type === 'cal') return `${el.year}년 ${el.month}월 달력`; if (el.type === 'mini') return `미니 달력 ${el.month}월`; return el.type; }

/* ---- 템플릿 갤러리 ---- */
function tplItems() {
  const y = doc.calendar.year || 2027;
  const themeItems = CAL.THEMES.map(th => ({ id: 'theme-' + th.id, cat: 'calendar', theme: th, name: th.name + ' 캘린더', desc: th.desc, w: 224, h: 154, build: () => { const saved = doc; const tmp = Object.assign({}, doc, { calendar: Object.assign(clone(doc.calendar), { theme: clone(th) }) }); doc = tmp; try { return CAL.buildPages(tmp, uid, { year: y, kind: 'virtue', month: 1 }).concat(CAL.buildPages(tmp, uid, { year: y, kind: 'cal', month: 1 })); } finally { doc = saved; } } }));
  const calItems = [['cal-cover', '캘린더 표지', () => CAL.buildPages(doc, uid, { year: y, kind: 'cover' })], ['cal-virtue', '인성 페이지 (1월)', () => CAL.buildPages(doc, uid, { year: y, kind: 'virtue', month: 1 })], ['cal-month', '달력 페이지 (1월)', () => CAL.buildPages(doc, uid, { year: y, kind: 'cal', month: 1 })], ['cal-back', '캘린더 뒷표지', () => CAL.buildPages(doc, uid, { year: y, kind: 'back' })]].map(([id, name, build]) => ({ id, cat: 'calpage', name, w: 224, h: 154, build }));
  const items = themeItems.concat(calItems, NC.tpl.list.map(t => ({ id: t.id, cat: t.cat, name: t.name, w: t.w, h: t.h, tags: t.tags, kw: t.kw || t.name, build: () => t.build(uid, t.pal || null, { year: y }) })));
  themeItems.concat(calItems).forEach(t => { t.tags = { format: '달력', season: '사계절', age: '전체', occasion: '안내', biz: '태권도장' }; t.kw = t.name + ' 달력 캘린더 ' + (t.desc || ''); });
  const q = (tplQ || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(t => (tplCat === 'all' || t.cat === tplCat) && Object.keys(tplF).every(k => !tplF[k] || (t.tags && t.tags[k] === tplF[k])) && (!q.length || q.every(w => (t.name + ' ' + (t.kw || '')).toLowerCase().includes(w))));
}
function tplSheet(t, pages) { const tmp = Object.assign({}, doc, { w: t.w, h: t.h, bleed: 0, cropMarks: false }); const saved = doc; doc = tmp; try { return sheetHTML(pages[0], 'thumb'); } finally { doc = saved; } }
function recentTpls() { try { return JSON.parse(localStorage.getItem('naracal-recent-tpls') || '[]'); } catch (e) { return []; } }
function noteRecentTpl(id) { const r = recentTpls().filter(x => x !== id); r.unshift(id); try { localStorage.setItem('naracal-recent-tpls', JSON.stringify(r.slice(0, 8))); } catch (e) {} }
let galObs = null;
function tplCard(t) { const two = !!t.theme; return `<button class="tcard lazy ${two ? 'two' : ''}" data-tid="${t.id}" title="${esc(t.name)}"><div class="tbox" data-w="${t.w}" data-h="${t.h}" data-n="${two ? 2 : 1}"></div><span>${esc(t.name)}</span><small>${t.theme ? esc(t.desc) : (t.w >= 1000 ? (t.w / 10) + '×' + (t.h / 10) + 'cm' : Math.round(t.w) + '×' + Math.round(t.h) + 'mm')}</small></button>`; }
function fillCard(card, t) { if (!card.classList.contains('lazy')) return; card.classList.remove('lazy'); const pages = t.build(); const two = t.theme && pages.length > 1; const bx = card.querySelector('.tbox'); bx.innerHTML = tplSheet(t, pages) + (two ? tplSheet(t, pages.slice(1)) : ''); fitBoxes(card, '.tbox', 110); }
function renderGallery() {
  const g = $('#tgal'); if (!g) return; const items = tplItems(); const tc = $('#tcount'); if (tc) tc.textContent = `${items.length}개`;
  const filtered = tplCat !== 'all' || tplQ.trim() || Object.values(tplF).some(Boolean);
  const byId = {}; items.forEach(t => byId[t.id] = t);
  let h = '';
  if (!filtered) {
    const rec = recentTpls().map(id => byId[id]).filter(Boolean);
    const sNow = NC.tpl.seasonNow(); const seasonal = items.filter(t => t.tags.season === sNow).slice(0, 6);
    const rows = [['최근 사용', rec, null], [`${sNow} 추천`, seasonal, { season: sNow }], ['달력 테마', items.filter(t => t.theme), null, 'calendar'], ['모집·홍보', items.filter(t => t.tags.occasion === '모집').slice(0, 6), { occasion: '모집' }], ['행사·축하', items.filter(t => ['행사', '축하', '심사·대회'].includes(t.tags.occasion)).slice(0, 6), { occasion: '행사' }], ['명절·인사·감사', items.filter(t => ['명절·인사', '감사'].includes(t.tags.occasion)).slice(0, 6), { occasion: '명절·인사' }], ['다른 직종', items.filter(t => t.tags.biz !== '태권도장').slice(0, 6), { biz: '학원' }], ['SNS·카드뉴스', items.filter(t => ['SNS', '카드뉴스'].includes(t.tags.format)).slice(0, 6), { format: 'SNS' }], ['포스터', items.filter(t => t.tags.format === '포스터').slice(0, 6), { format: '포스터' }], ['안내문·서식', items.filter(t => ['안내문', '서식·활동지'].includes(t.tags.format)).slice(0, 6), { format: '안내문' }]];
    rows.forEach(([title, list, facet, cat]) => { if (!list.length) return; h += `<div class="esec"><h3>${title} <small>${list.length}</small></h3><button class="more" ${facet ? `data-more='${JSON.stringify(facet)}'` : cat ? `data-morecat="${cat}"` : ''}>${facet || cat ? '더보기 ›' : ''}</button></div><div class="tgal-row">${list.map(tplCard).join('')}</div>`; });
    g.innerHTML = h;
  } else {
    g.innerHTML = `<div class="tgal-grid">${items.map(tplCard).join('') || '<p class="hint">맞는 템플릿이 없습니다. 검색어를 줄이거나 필터를 초기화해 보세요.</p>'}</div>`;
  }
  if (galObs) galObs.disconnect();
  galObs = new IntersectionObserver(ents => { ents.forEach(en => { if (en.isIntersecting) { const t = byId[en.target.dataset.tid]; if (t) fillCard(en.target, t); galObs.unobserve(en.target); } }); }, { root: $('#sidebody'), rootMargin: '200px' });
  g.querySelectorAll('.tcard.lazy').forEach(c => galObs.observe(c));
  g.onclick = e => { const m = e.target.closest('[data-more]'); if (m) { Object.assign(tplF, JSON.parse(m.dataset.more)); renderSide(); return; } const mc = e.target.closest('[data-morecat]'); if (mc) { tplCat = mc.dataset.morecat; renderSide(); return; } const b = e.target.closest('[data-tid]'); if (b) openTplPreview(byId[b.dataset.tid]); };
}
function openTplPreview(t) {
  noteRecentTpl(t.id);
  let d = $('#dlgTpl'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgTpl'; d.innerHTML = `<div class="dhead"><h2 id="tplTitle"></h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="tplBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  const pages = t.build(); const hasCal = doc.pages.some(p => p.kind);
  $('#tplTitle').innerHTML = `${esc(t.name)} <small>${t.theme ? esc(t.desc) : (t.w >= 1000 ? (t.w / 10) + '×' + (t.h / 10) + 'cm' : Math.round(t.w) + '×' + Math.round(t.h) + 'mm') + ' · ' + pages.length + '쪽'}</small>`;
  const n = pages.length > 1 && t.theme ? 2 : 1;
  $('#tplBody').innerHTML = `<div class="tprev" id="tprev" data-w="${t.w}" data-h="${t.h}" data-n="${n}">${pages.slice(0, n).map(pg => tplSheet(t, [pg])).join('')}</div>
  <div class="row" style="margin-top:14px;justify-content:flex-end"><span class="hint" style="margin:0;flex:1">${t.theme ? '테마는 표지·인성·달력·뒷표지 전체 디자인입니다. 이미 만든 캘린더에 적용하면 문구·일정·그림은 그대로 두고 디자인만 바뀝니다.' : '만든 뒤 글자·그림·색을 자유롭게 바꿀 수 있습니다. 로고와 연락처는 도장 정보로 고쳐 주세요.'}</span>
  ${t.theme ? `<button class="btn" id="tplRetheme" ${hasCal ? '' : 'disabled title="현재 문서에 캘린더 페이지가 없습니다"'}>현재 캘린더에 적용</button><button class="btn primary" id="tplWizard">이 테마로 캘린더 만들기</button>` : `<button class="btn" id="tplAppend" ${(t.w === doc.w && t.h === doc.h) ? '' : 'title="현재 문서와 크기가 달라 요소가 어긋날 수 있습니다"'}>현재 문서 뒤에 추가</button><button class="btn primary" id="tplNew">이 템플릿으로 새 문서</button>`}</div>`;
  requestAnimationFrame(() => fitBoxes($('#tplBody'), '.tprev', Math.min(520, window.innerHeight * 0.55)));
  if (t.theme) { $('#tplWizard').onclick = () => { d.close(); openWizard(doc.calendar.year, t.theme.id); }; const rb = $('#tplRetheme'); if (rb) rb.onclick = () => { doc.calendar.theme = clone(t.theme); const y = doc.calendar.year || 2027; const nrep = CAL.retheme(doc, uid, y); ensureAllHolidays(); commit(); renderAll(); d.close(); toast(`"${t.name}" 테마를 ${nrep}쪽에 적용했습니다`); }; }
  else {
    $('#tplNew').onclick = () => { if (doc.pages.some(p => p.els.length) && !window.confirm('현재 문서를 닫고 새 문서를 만들까요? (파일에 연결되어 있지 않으면 브라우저 저장본만 남습니다)')) return; store.disconnect(); const nd = newDoc(); nd.w = t.w; nd.h = t.h; nd.name = t.name; nd.pages = pages; nd.calendar = doc.calendar; nd.holidays = doc.holidays; nd.assets = doc.assets; nd.fonts = doc.fonts; nd.rules = doc.rules; doc = nd; hist = []; hptr = -1; cur = 0; sel = []; $('#pname').value = doc.name; commit(); renderAll(); updateSaveBadge(); d.close(); toast(`"${t.name}" 문서를 만들었습니다`); };
    $('#tplAppend').onclick = () => { doc.pages.splice(cur + 1, 0, ...pages); commit(); goto(cur + 1); d.close(); toast(`${pages.length}쪽을 추가했습니다`); };
  }
  d.showModal();
}

/* ---- 캘린더 마법사 ---- */
let wz = { year: 2027, kind: 'full', mode: 'replace', view: 'cal', month: 1, weekStart: 0, rows: 'merge', colorA: '', colorB: '', themeId: 'classic' };
function openWizard(year, themeId) {
  wz.year = year || doc.calendar.year || new Date().getFullYear();
  wz.themeId = themeId || (doc.calendar.theme && doc.calendar.theme.id) || 'classic';
  const th = CAL.THEMES.find(x => x.id === wz.themeId) || CAL.THEMES[0];
  wz.colorA = themeId ? th.colorA : (doc.calendar.theme.colorA || th.colorA); wz.colorB = themeId ? th.colorB : (doc.calendar.theme.colorB || th.colorB);
  wz.month = 1; wz.view = 'cal'; ensureHolidays(wz.year, true);
  let d = $('#dlgWizard');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlgWizard'; d.className = 'wide'; d.innerHTML = `<div class="dhead"><h2>캘린더 마법사 <small>연도와 테마를 고르면 12개월 달력 모양이 바로 보입니다</small></h2><button class="btn sm" data-close>닫기</button></div><div class="dbody wz" id="wzBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  renderWizard(); d.showModal();
}
function wizardTheme() { const th = clone(CAL.THEMES.find(x => x.id === wz.themeId) || CAL.THEMES[0]); th.colorA = wz.colorA; th.colorB = wz.colorB; return th; }
function wizardDoc() { const t = Object.assign({}, doc, { calendar: clone(doc.calendar), w: 224, h: 154, bleed: 0, cropMarks: false }); t.calendar.year = wz.year; t.calendar.theme = wizardTheme(); return t; }
function wizardPages(kind) { const t = wizardDoc(); const saved = doc; doc = t; try { const pages = CAL.buildPages(t, uid, { year: wz.year, kind }); pages.forEach(p => p.els.forEach(el => { if (el.type === 'cal') el.s = Object.assign({}, el.s, { weekStart: wz.weekStart, rows: wz.rows }); if (el.type === 'mini') el.s = Object.assign({}, el.s, { weekStart: wz.weekStart }); })); return pages; } finally { doc = saved; } }
function wizardSheet(pg) { const t = wizardDoc(); const saved = doc; doc = t; try { return sheetHTML(pg, 'thumb'); } finally { doc = saved; } }
function themeThumbs() { const saved = doc; const out = []; try { CAL.THEMES.forEach(th => { const t = Object.assign({}, saved, { calendar: Object.assign(clone(saved.calendar), { theme: clone(th), year: wz.year }), w: 224, h: 154, bleed: 0, cropMarks: false }); doc = t; const pv = CAL.buildPages(t, uid, { year: wz.year, kind: 'virtue', month: 1 })[0]; out.push({ th, html: sheetHTML(pv, 'thumb') }); }); } finally { doc = saved; } return out; }
function renderWizard() {
  const body = $('#wzBody'); const hol = (doc.holidays[wz.year] || []).length;
  const pages = wizardPages(wz.view === 'cal' ? 'months' : 'virtues'); const big = pages[wz.month - 1]; const pageCount = wz.kind === 'full' ? 26 : 12;
  body.innerHTML = `<div class="wz-side">
    <h3>연도</h3><div class="wz-yearrow"><button class="btn icon" id="wzYm" title="이전 해"><svg class="ic"><use href="#i-prev"/></svg></button><input type="number" id="wzYear" value="${wz.year}" min="2000" max="2100"><button class="btn icon" id="wzYp" title="다음 해"><svg class="ic"><use href="#i-next"/></svg></button></div>
    <div class="wz-hol ${hol ? 'ok' : ''}">${hol ? `✓ ${wz.year}년 공휴일 ${hol}개 자동 적용 (대체공휴일 포함)` : `${wz.year}년은 자동 계산 범위(${CAL.AUTO_RANGE[0]}~${CAL.AUTO_RANGE[1]})를 벗어납니다`}<button class="btn sm" id="wzHol">${hol ? '편집' : '가져오기'}</button></div>
    <h3>디자인 테마</h3><div class="wz-themes">${themeThumbs().map(({ th, html }) => `<button class="wz-th ${wz.themeId === th.id ? 'on' : ''}" data-th="${th.id}" title="${esc(th.desc)}"><div class="wz-thbox" data-w="224" data-h="154">${html}</div><span>${esc(th.name)}</span></button>`).join('')}</div>
    <h3>구성</h3><div class="wz-opts">${[['full', '전체 26쪽', '표지 + 인성 12 + 달력 12 + 뒷표지'], ['months', '달력 12쪽', '월간 달력 페이지만'], ['virtues', '인성 12쪽', '덕목·명언 페이지만']].map(([k, t, d2]) => `<label class="wz-opt ${wz.kind === k ? 'on' : ''}"><input type="radio" name="wzKind" value="${k}" ${wz.kind === k ? 'checked' : ''}><b>${t}</b><small>${d2}</small></label>`).join('')}</div>
    <h3>달력 모양</h3><div class="grid2"><label class="f"><span>주 시작</span><select id="wzWs"><option value="0" ${wz.weekStart === 0 ? 'selected' : ''}>일요일</option><option value="1" ${wz.weekStart === 1 ? 'selected' : ''}>월요일</option></select></label><label class="f"><span>줄 수</span><select id="wzRows"><option value="merge" ${wz.rows === 'merge' ? 'selected' : ''}>5줄 (24/31 합침)</option><option value="6" ${wz.rows === '6' ? 'selected' : ''}>6줄</option><option value="auto" ${wz.rows === 'auto' ? 'selected' : ''}>자동</option></select></label></div>
    <h3>인성 페이지 색</h3><div class="grid2"><label class="f"><span>홀수 달</span><input type="color" id="wzA" value="${wz.colorA}"></label><label class="f"><span>짝수 달</span><input type="color" id="wzB" value="${wz.colorB}"></label></div>
    <h3>넣는 방식</h3><div class="seg"><button data-wzmode="replace" aria-pressed="${wz.mode === 'replace'}">문서 새로 만들기</button><button data-wzmode="append" aria-pressed="${wz.mode === 'append'}">현재 문서 뒤에 추가</button></div>
    <p class="hint" style="margin-top:10px">${wz.mode === 'replace' ? '지금 문서의 페이지를 모두 지우고 224×154mm 문서로 새로 만듭니다.' : `현재 문서(${doc.w}×${doc.h}mm) 끝에 ${pageCount}쪽을 덧붙입니다.`}</p>
    <button class="btn primary full" id="wzGo" style="margin-top:6px">${wz.year}년 ${pageCount}쪽 만들기</button>
    ${doc.pages.some(p => p.kind) ? `<button class="btn full" id="wzRetheme" style="margin-top:6px">현재 캘린더에 디자인만 적용</button>` : ''}
    <p class="hint">문구(덕목·명언·실천·사자성어)는 2026년 내용으로 채워지며, 만든 뒤 AI 도구나 직접 입력으로 바꿉니다.</p>
  </div>
  <div class="wz-main">
    <div class="wz-top"><div class="seg" style="width:220px"><button data-wzview="cal" aria-pressed="${wz.view === 'cal'}">달력 페이지</button><button data-wzview="virtue" aria-pressed="${wz.view === 'virtue'}">인성 페이지</button></div><span class="hint" style="margin:0">${wz.year}년 ${wz.month}월 · 아래 작은 달력을 누르면 크게 봅니다</span></div>
    <div class="wz-big"><div class="wz-bigbox" id="wzBig" data-w="224" data-h="154">${wizardSheet(big)}</div></div>
    <div class="wz-grid" id="wzGrid">${pages.map((pg, i) => `<button class="wz-m ${i + 1 === wz.month ? 'on' : ''}" data-m="${i + 1}"><div class="wz-mbox" data-w="224" data-h="154">${wizardSheet(pg)}</div><span>${i + 1}월</span></button>`).join('')}</div>
  </div>`;
  requestAnimationFrame(() => { fitBoxes(body, '.wz-thbox', 60); fitBoxes(body, '.wz-mbox', 80); fitBoxes(body, '.wz-bigbox', 460); });
  const setYear = y => { wz.year = clamp(Math.round(y) || wz.year, 2000, 2100); ensureHolidays(wz.year, true); renderWizard(); };
  body.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { const th = CAL.THEMES.find(x => x.id === b.dataset.th); wz.themeId = th.id; wz.colorA = th.colorA; wz.colorB = th.colorB; renderWizard(); });
  $('#wzYm').onclick = () => setYear(wz.year - 1); $('#wzYp').onclick = () => setYear(wz.year + 1); $('#wzYear').onchange = e => setYear(Number(e.target.value));
  $('#wzHol').onclick = () => { $('#dlgWizard').close(); openHoliday(wz.year); };
  body.querySelectorAll('[name=wzKind]').forEach(r => r.onchange = () => { wz.kind = r.value; renderWizard(); });
  $('#wzWs').onchange = e => { wz.weekStart = Number(e.target.value); renderWizard(); }; $('#wzRows').onchange = e => { wz.rows = e.target.value; renderWizard(); };
  $('#wzA').oninput = e => { wz.colorA = e.target.value; }; $('#wzA').onchange = () => renderWizard(); $('#wzB').oninput = e => { wz.colorB = e.target.value; }; $('#wzB').onchange = () => renderWizard();
  body.querySelectorAll('[data-wzmode]').forEach(b => b.onclick = () => { wz.mode = b.dataset.wzmode; renderWizard(); });
  body.querySelectorAll('[data-wzview]').forEach(b => b.onclick = () => { wz.view = b.dataset.wzview; renderWizard(); });
  $('#wzGrid').onclick = e => { const b = e.target.closest('[data-m]'); if (b) { wz.month = Number(b.dataset.m); renderWizard(); } };
  $('#wzGo').onclick = () => {
    doc.calendar.year = wz.year; doc.calendar.theme = wizardTheme();
    if (wz.mode === 'replace') { if (doc.pages.some(p => p.els.length) && !window.confirm('현재 문서의 페이지를 모두 지우고 새로 만듭니다. 계속할까요?')) return; doc.w = 224; doc.h = 154; doc.pages = []; doc.name = `${wz.year} 인성 캘린더`; $('#pname').value = doc.name; }
    const pages = wizardPages(wz.kind); doc.pages.push(...pages); ensureAllHolidays(); commit(); goto(wz.mode === 'replace' ? 0 : doc.pages.length - pages.length);
    $('#dlgWizard').close(); toast(`${wz.year}년 ${pages.length}쪽을 만들었습니다`);
    if (!doc.holidays[wz.year]) setTimeout(() => openHoliday(wz.year), 400);
  };
  const rt = $('#wzRetheme'); if (rt) rt.onclick = () => { doc.calendar.year = wz.year; doc.calendar.theme = wizardTheme(); const nrep = CAL.retheme(doc, uid, wz.year); ensureAllHolidays(); commit(); renderAll(); $('#dlgWizard').close(); toast(`디자인을 ${nrep}쪽에 적용했습니다 (문구·일정·그림 유지)`); };
}

/* ======================= 속성 패널 ======================= */
const F = (label, k, v, o = {}) => {
  const val = v == null ? '' : v;
  if (o.type === 'textarea') return `<label class="f"><span>${label}</span><textarea data-k="${k}" rows="${o.rows || 3}">${esc(val)}</textarea></label>`;
  if (o.type === 'range') return `<label class="f"><span>${label} <small>${val}</small></span><input data-k="${k}" type="range" min="${o.min}" max="${o.max}" step="${o.step}" value="${val}"></label>`;
  if (o.type === 'color') return `<label class="f"><span>${label}</span><input data-k="${k}" type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(val) ? val : '#000000')}"></label>`;
  if (o.type === 'check') return `<label class="chk"><input data-k="${k}" type="checkbox" ${val ? 'checked' : ''}> ${label}</label>`;
  if (o.type === 'select') return `<label class="f"><span>${label}</span><select data-k="${k}">${o.options.map(([a, t]) => `<option value="${a}" ${String(a) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  return `<label class="f"><span>${label}</span><input data-k="${k}" type="${o.type || 'text'}" value="${esc(val)}" ${o.step ? `step="${o.step}"` : ''} ${o.min != null ? `min="${o.min}" max="${o.max}"` : ''}></label>`;
};
const sw = (k, cur_) => `<div class="swrow">${SWATCH.map(c => `<button type="button" class="swb ${cur_ === c ? 'on' : ''}" data-set="${k}:${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>`;
function fontLabel(fam) { const f = allFonts().find(x => x.family === fam); return f ? f.label : fam; }
const fontPicker = (k, cur_) => `<button type="button" class="fp-btn" data-fp="${k}" data-cur="${esc(cur_)}" style="font-family:'${esc(cur_)}'"><span>${esc(fontLabel(cur_))}</span><i>▾</i></button>`;
let fpState = { cat: 'all', q: '' };
function openFontPop(btn) {
  closeFontPop(); const k = btn.dataset.fp, cur_ = btn.dataset.cur; const pop = document.createElement('div'); pop.id = 'fpPop';
  const cats = [['all', '전체'], ['title', '제목'], ['brush', '붓'], ['hand', '손글씨'], ['body', '본문'], ['latin', '영문'], ['mine', '내 글꼴']];
  const row = f => `<div class="fp-row ${f.family === cur_ ? 'on' : ''}" data-font="${esc(f.family)}" style="font-family:'${esc(f.family)}'"><span class="sm">나라차 태권도 가나다 ABC 123</span><span class="nm">${esc(f.label)}</span></div>`;
  const render = () => {
    const fonts = allFonts(); const rec = recentFonts().map(n => fonts.find(f => f.family === n)).filter(Boolean);
    const list = fonts.filter(f => (fpState.cat === 'all' || f.cat === fpState.cat) && (!fpState.q || (f.label + f.family).toLowerCase().includes(fpState.q.toLowerCase())));
    pop.innerHTML = `<div class="fp-head"><input type="text" id="fpQ" placeholder="글꼴 찾기" value="${esc(fpState.q)}"><div class="fp-cats">${cats.map(([c, t]) => `<button type="button" data-fc="${c}" class="${fpState.cat === c ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="fp-list">${rec.length && fpState.cat === 'all' && !fpState.q ? `<div class="fp-sec">최근 사용</div>${rec.map(row).join('')}<div class="fp-sec">전체</div>` : ''}${list.map(row).join('') || '<div class="hint" style="padding:10px">맞는 글꼴이 없습니다</div>'}</div>
    <div class="fp-foot"><button type="button" class="btn sm" id="fpMore">글꼴 둘러보기·내 글꼴 올리기</button></div>`;
    const q = pop.querySelector('#fpQ'); q.oninput = () => { fpState.q = q.value; const pos = q.selectionStart; render(); const q2 = pop.querySelector('#fpQ'); q2.focus(); q2.setSelectionRange(pos, pos); };
  };
  render(); const r = btn.getBoundingClientRect(); document.body.appendChild(pop);
  const h = Math.min(400, window.innerHeight - 20); pop.style.maxHeight = h + 'px'; pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 328)) + 'px'; pop.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
  pop.onclick = e => { const c = e.target.closest('[data-fc]'); if (c) { fpState.cat = c.dataset.fc; render(); return; } const rw = e.target.closest('[data-font]'); if (rw) { applyFontChoice(k, rw.dataset.font); closeFontPop(); return; } if (e.target.id === 'fpMore') { closeFontPop(); openFonts(); } };
  setTimeout(() => { const q = pop.querySelector('#fpQ'); if (q) q.focus(); }, 0);
}
function closeFontPop() { const p = $('#fpPop'); if (p) p.remove(); }
function applyFontChoice(k, fam) { const els = selEls(); if (!els.length) return; els.forEach(el => { if (k === 'font' ? el.type === 'text' : true) setK(el, k, fam); }); noteFont(fam); if (els[0].type === 'text') lastTextStyle = Object.assign({}, lastTextStyle || {}, { font: fam }); commit(); rerender(); }
document.addEventListener('pointerdown', e => { if ($('#fpPop') && !e.target.closest('#fpPop') && !e.target.closest('.fp-btn')) closeFontPop(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#fpPop')) { closeFontPop(); e.stopPropagation(); } }, true);

function renderInspector() {
  const ins = $('#inspector'); const els = selEls(); ins.onclick = null;
  if (!els.length) {
    const pg = page();
    ins.innerHTML = `<h2>${cur + 1}쪽 <small>${doc.w}×${doc.h}mm</small></h2>
    ${F('페이지 이름', 'pg.label', pg.label)}
    <h3>배경</h3><div class="swrow">${['#ffffff', '#FFE89A', '#E6EDF2', '#DDF3EA', '#FDE7E4', '#F0EBFB', '#1E2B5A', '#1a1a1a'].map(c => `<button class="swb" data-pgbg="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>
    <label class="f"><span>직접 고르기</span><input type="color" data-k="pg.bg" value="${/^#[0-9a-f]{6}$/i.test(pg.bg) ? pg.bg : '#ffffff'}"></label>
    <p class="hint">그라데이션·패턴 배경은 왼쪽 "배경" 메뉴에서 고릅니다. 요소를 누르면 그 요소의 속성이 여기에 나옵니다. 빈 곳을 끌면 여러 요소를 함께 고릅니다.</p>
    <h3>단축키</h3><p class="hint">T 글자 추가 · P 펜 · Ctrl+D 복제 · Ctrl+G 그룹 · Ctrl+Z 취소 · 화살표 이동 · Delete 삭제 · Ctrl+휠 확대</p>`;
    ins.onclick = e => { const b = e.target.closest('[data-pgbg]'); if (b) { pg.bg = b.dataset.pgbg; commit(); rerender(); } };
    return;
  }
  if (els.length > 1) {
    const grouped = els.some(e => e.group); const texts = els.filter(e => e.type === 'text');
    ins.innerHTML = `<h2>${els.length}개 선택${grouped ? ' <small>그룹</small>' : ''}</h2><div class="row"><button class="btn sm" id="mGroup">${grouped ? '그룹 해제' : '그룹으로 묶기'}</button><button class="btn sm" id="mLock">모두 잠금</button><button class="btn sm" id="mUnlock">잠금 해제</button></div>
    ${F('투명도', 'multi.opacity', els[0].opacity == null ? 1 : els[0].opacity, { type: 'range', min: 0, max: 1, step: 0.05 })}
    ${texts.length ? `<h3>글자 ${texts.length}개 한꺼번에</h3><div class="row"><label class="f" style="flex:1;margin:0"><span>글꼴</span>${fontPicker('font', texts[0].font)}</label></div><div class="grid2">${F('크기(pt)', 'multi.size', texts[0].size, { type: 'number', step: 0.5 })}${F('색', 'multi.color', texts[0].color, { type: 'color' })}</div>` : ''}
    <p class="hint">도구 막대의 정렬·간격 균등 버튼으로 맞추고, 끌어서 함께 옮깁니다.</p>`;
    ins.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.fp) { openFontPop(b); return; } if (b.id === 'mGroup') toggleGroup(); if (b.id === 'mLock') { els.forEach(x => x.locked = true); commit(); renderOverlay(); } if (b.id === 'mUnlock') { els.forEach(x => x.locked = false); commit(); renderOverlay(); } };
    return;
  }
  const el = els[0];
  let h = `<h2>${esc(elName(el))} <span class="row"><button class="btn sm icon ${el.locked ? 'on' : ''}" data-k="locked" data-toggle="1" title="잠금">${el.locked ? '🔒' : '🔓'}</button></span></h2>`;
  const geo = `<h3>위치·크기</h3><div class="grid4">${F('X', 'x', el.x, { type: 'number', step: 0.5 })}${F('Y', 'y', el.y, { type: 'number', step: 0.5 })}${F('너비', 'w', el.w, { type: 'number', step: 0.5 })}${F('높이', 'h', el.h, { type: 'number', step: 0.5 })}</div><div class="grid2">${F('회전(°)', 'rot', el.rot || 0, { type: 'number', step: 1 })}${F('투명도', 'opacity', el.opacity == null ? 1 : el.opacity, { type: 'range', min: 0, max: 1, step: 0.05 })}</div>${el.type !== 'text' ? F('혼합 모드', 'blend', el.blend || 'normal', { type: 'select', options: [['normal', '보통'], ['multiply', '곱하기'], ['screen', '스크린'], ['overlay', '오버레이'], ['darken', '어둡게'], ['lighten', '밝게'], ['difference', '차이']] }) : ''}${F('이름', 'name', el.name)}`;
  const shadowBlock = (pfx) => `<details class="fx" ${el.shadow ? 'open' : ''}><summary>${F('그림자', 'shadow', el.shadow, { type: 'check' })}</summary><div class="grid4">${F('색', 'shC', el.shC || '#000000', { type: 'color' })}${F('진하기', 'shA', el.shA == null ? 0.3 : el.shA, { type: 'number', step: 0.05, min: 0, max: 1 })}${F('가로', 'shX', el.shX == null ? 0.6 : el.shX, { type: 'number', step: 0.1 })}${F('세로', 'shY', el.shY == null ? 0.7 : el.shY, { type: 'number', step: 0.1 })}</div>${F('번짐(mm)', 'shB', el.shB == null ? 0.5 : el.shB, { type: 'number', step: 0.1, min: 0 })}</details>`;
  const fillBlock = `<div class="seg">${[['solid', '단색'], ['gradient', '그라데이션']].map(([a, t]) => `<button data-set="fillType:${a}" aria-pressed="${(el.fillType || 'solid') === a}">${t}</button>`).join('')}</div>${(el.fillType || 'solid') === 'gradient' ? `<div class="grid3">${F('시작 색', 'g1', el.g1 || '#2f5bea', { type: 'color' })}${F('끝 색', 'g2', el.g2 || '#e0564b', { type: 'color' })}${F('각도', 'gAngle', el.gAngle == null ? 90 : el.gAngle, { type: 'number', step: 15 })}</div>${el.type === 'shape' || el.type === 'path' ? F('모양', 'gKind', el.gKind || 'linear', { type: 'select', options: [['linear', '직선'], ['radial', '원형']] }) : ''}` : ''}`;
  if (el.type === 'text') {
    h += `<h3>스타일 프리셋</h3><div class="tstyles sm">${FX.TEXT_PRESETS.map(p => `<button data-preset="${p.id}" class="tsb"><span style="${FX.textStyle(Object.assign({}, TEXT_DEF, { font: 'Jua', size: 13, weight: 800, align: 'center' }, p.st))}">${esc(p.name)}</span></button>`).join('')}</div>
    <h3>글자</h3>${F('내용', 'text', el.text, { type: 'textarea', rows: 3 })}
    <div class="row"><label class="f" style="flex:1;margin:0"><span>글꼴</span>${fontPicker('font', el.font)}</label><button class="btn sm" id="fontBrowse" style="margin-top:17px">둘러보기</button></div>
    <div class="grid3">${F('크기(pt)', 'size', el.size, { type: 'number', step: 0.5, min: 2, max: 600 })}${F('굵기', 'weight', el.weight, { type: 'select', options: [[300, '가늘게'], [400, '보통'], [500, '중간'], [600, '약간 굵게'], [700, '굵게'], [800, '아주 굵게'], [900, '최대']] })}${F('줄 간격', 'lh', el.lh, { type: 'number', step: 0.05, min: 0.5, max: 4 })}</div>
    <div class="row"><div class="seg" style="flex:1">${[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([a, t]) => `<button data-set="align:${a}" aria-pressed="${el.align === a}">${t}</button>`).join('')}</div><div class="seg" style="flex:1">${[['top', '위'], ['middle', '중앙'], ['bottom', '아래']].map(([a, t]) => `<button data-set="valign:${a}" aria-pressed="${(el.valign || 'top') === a}">${t}</button>`).join('')}</div></div>
    <div class="grid4">${F('자간(em)', 'ls', el.ls, { type: 'number', step: 0.01, min: -0.3, max: 2 })}${F('기울임', 'italic', el.italic, { type: 'check' })}${F('밑줄', 'underline', el.underline, { type: 'check' })}${F('취소선', 'strike', el.strike, { type: 'check' })}</div>
    <div class="grid3">${F('대문자', 'upper', el.upper, { type: 'check' })}${F('세로쓰기', 'vertical', el.vertical, { type: 'check' })}${F('혼합', 'blend', el.blend || 'normal', { type: 'select', options: [['normal', '보통'], ['multiply', '곱하기'], ['screen', '스크린'], ['overlay', '오버레이'], ['difference', '차이']] })}</div>
    <h3>채우기</h3>${fillBlock}${(el.fillType || 'solid') === 'solid' ? `${F('글자 색', 'color', el.color, { type: 'color' })}${sw('color', el.color)}` : ''}
    <h3>효과 <small>포토샵 레이어 스타일</small></h3>
    <details class="fx" ${el.strokeW > 0 ? 'open' : ''}><summary><span class="chk">외곽선</span></summary><div class="grid2">${F('두께(pt)', 'strokeW', el.strokeW, { type: 'number', step: 0.25, min: 0, max: 30 })}${F('색', 'strokeC', el.strokeC, { type: 'color' })}</div>${sw('strokeC', el.strokeC)}</details>
    ${shadowBlock()}
    <details class="fx" ${el.glow ? 'open' : ''}><summary>${F('광선 (글로우)', 'glow', el.glow, { type: 'check' })}</summary><div class="grid2">${F('색', 'glowC', el.glowC || '#ffd34d', { type: 'color' })}${F('번짐(mm)', 'glowB', el.glowB == null ? 1.2 : el.glowB, { type: 'number', step: 0.1, min: 0 })}</div></details>
    <details class="fx" ${el.d3 > 0 ? 'open' : ''}><summary><span class="chk">3D 입체·긴 그림자</span></summary><div class="grid4">${F('단수', 'd3', el.d3 || 0, { type: 'number', step: 1, min: 0, max: 30 })}${F('색', 'd3C', el.d3C || '#1e2b5a', { type: 'color' })}${F('가로', 'd3X', el.d3X == null ? 0.3 : el.d3X, { type: 'number', step: 0.05 })}${F('세로', 'd3Y', el.d3Y == null ? 0.3 : el.d3Y, { type: 'number', step: 0.05 })}</div></details>
    <details class="fx" ${el.warp && el.warp !== 'none' ? 'open' : ''}><summary><span class="chk">휘기 (아치·원형)</span></summary>${F('모양', 'warp', el.warp || 'none', { type: 'select', options: [['none', '없음'], ['arcUp', '위로 아치'], ['arcDown', '아래로 아치'], ['circle', '원형']] })}${F('휘는 정도', 'warpAmt', el.warpAmt == null ? 40 : el.warpAmt, { type: 'range', min: 5, max: 100, step: 5 })}<p class="hint">휘어진 글자는 한 줄만 표시되며 내용은 위 "내용" 칸에서 고칩니다.</p></details>
    <details class="fx" ${el.bg ? 'open' : ''}><summary><span class="chk">상자 배경</span></summary><div class="grid3">${F('색', 'bg', el.bg || '#ffffff', { type: 'color' })}${F('모서리(mm)', 'bgR', el.bgR || 0, { type: 'number', step: 0.5, min: 0 })}${F('여백(mm)', 'pad', el.pad, { type: 'number', step: 0.5, min: 0 })}</div><button class="btn sm" data-set="bg:">배경 없음</button></details>
    ${el.role ? `<p class="hint">역할: ${el.role}${el.month ? ' · ' + el.month + '월' : ''} (AI 문구·테마 적용 대상)</p>` : ''}` + geo;
  } else if (el.type === 'image') {
    const f = el.fx || {};
    h += `<h3>그림</h3><div class="imgprev">${src(el.src) ? `<img src="${src(el.src)}" alt="">` : '<span class="hint">그림 없음</span>'}</div>
    <div class="row"><label class="btn sm">바꾸기(파일)<input type="file" accept="image/*" id="imgReplace" hidden></label><button class="btn sm" id="imgLib">사진 보관함</button><button class="btn sm ai" id="imgAI">AI로 만들기</button></div>
    <div class="row" style="margin-top:6px"><button class="btn sm primary" id="imgEdit" ${src(el.src) ? '' : 'disabled'}>편집기 (배경 지우기·브러시·자르기)</button>${el.srcOrig ? '<button class="btn sm" id="imgOrig">원본으로</button>' : ''}</div>
    <h3>필터 <small>포토샵 조정</small></h3><div class="tstyles sm">${FX.IMG_PRESETS.map(([id, n, fx]) => `<button class="tsb" data-imgpreset="${id}"><span>${n}</span></button>`).join('')}</div>
    <div class="grid2">${F('밝기 %', 'fx.bri', f.bri == null ? 100 : f.bri, { type: 'range', min: 20, max: 200, step: 5 })}${F('대비 %', 'fx.con', f.con == null ? 100 : f.con, { type: 'range', min: 20, max: 200, step: 5 })}${F('채도 %', 'fx.sat', f.sat == null ? 100 : f.sat, { type: 'range', min: 0, max: 250, step: 5 })}${F('색조 °', 'fx.hue', f.hue || 0, { type: 'range', min: 0, max: 360, step: 5 })}${F('흐림 mm', 'fx.blur', f.blur || 0, { type: 'range', min: 0, max: 5, step: 0.1 })}${F('흑백 %', 'fx.gray', f.gray || 0, { type: 'range', min: 0, max: 100, step: 5 })}${F('세피아 %', 'fx.sepia', f.sepia || 0, { type: 'range', min: 0, max: 100, step: 5 })}${F('반전', 'fx.inv', f.inv, { type: 'check' })}</div>
    <details class="fx" ${el.tint ? 'open' : ''}><summary><span class="chk">색 입히기 (틴트)</span></summary><div class="grid3">${F('색', 'tint', el.tint || '#1E2B5A', { type: 'color' })}${F('세기', 'tintA', el.tintA == null ? 0.4 : el.tintA, { type: 'range', min: 0, max: 1, step: 0.05 })}${F('방식', 'tintMode', el.tintMode || 'multiply', { type: 'select', options: [['multiply', '곱하기'], ['screen', '스크린'], ['overlay', '오버레이'], ['color', '색상'], ['normal', '덮기']] })}</div><button class="btn sm" data-set="tint:">틴트 없음</button></details>
    <h3>프레임·모양</h3>${F('모양 마스크', 'clip', el.clip || 'none', { type: 'select', options: FX.CLIPS })}
    <div class="grid2">${F('채우기', 'fit', el.fit, { type: 'select', options: [['contain', '안에 맞춤'], ['cover', '꽉 채움(잘림)'], ['fill', '늘림']] })}${F('정렬', 'pos', el.pos, { type: 'select', options: [['50% 50%', '가운데'], ['50% 100%', '아래'], ['50% 0%', '위'], ['0% 50%', '왼쪽'], ['100% 50%', '오른쪽'], ['0% 100%', '왼쪽 아래'], ['100% 100%', '오른쪽 아래']] })}</div>
    <div class="grid3">${F('확대', 'zoom', el.zoom || 1, { type: 'range', min: 1, max: 4, step: 0.05 })}${F('가로 이동 %', 'panX', el.panX || 0, { type: 'range', min: -50, max: 50, step: 1 })}${F('세로 이동 %', 'panY', el.panY || 0, { type: 'range', min: -50, max: 50, step: 1 })}</div>
    <div class="grid3">${F('좌우 뒤집기', 'flip', el.flip, { type: 'check' })}${F('모서리(mm)', 'radius', el.radius, { type: 'number', step: 0.5, min: 0 })}${F('테두리 두께', 'borderW', el.borderW || 0, { type: 'number', step: 0.25, min: 0 })}</div>${F('테두리 색', 'border', el.border || '#000000', { type: 'color' })}<button class="btn sm" data-set="border:">테두리 없음</button>
    ${shadowBlock()}
    <div class="row" style="margin-top:8px"><button class="btn sm" id="imgFitBox">비율대로 상자 맞춤</button><button class="btn sm" id="imgFull">페이지 가득</button></div>` + geo;
  } else if (el.type === 'shape') {
    h += `<h3>도형</h3>${F('종류', 'kind', el.kind, { type: 'select', options: FX.SHAPES })}
    ${el.kind === 'star' || el.kind === 'burst' ? `<div class="grid2">${F('꼭짓점 수', 'points', el.points || (el.kind === 'star' ? 5 : 12), { type: 'number', step: 1, min: 3, max: 40 })}${F('안쪽 비율', 'inner', el.inner == null ? (el.kind === 'star' ? 0.45 : 0.78) : el.inner, { type: 'range', min: 0.1, max: 0.95, step: 0.05 })}</div>` : ''}
    ${el.kind === 'polygon' ? F('변의 수', 'sides', el.sides || 6, { type: 'number', step: 1, min: 3, max: 20 }) : ''}
    ${el.kind === 'ring' || el.kind === 'cross' ? F('굵기 비율', 'inner', el.inner == null ? (el.kind === 'ring' ? 0.3 : 0.34) : el.inner, { type: 'range', min: 0.05, max: 0.9, step: 0.05 }) : ''}
    ${el.kind === 'arrow' ? `<div class="grid2">${F('머리 길이', 'headL', el.headL == null ? 0.4 : el.headL, { type: 'range', min: 0.1, max: 0.9, step: 0.05 })}${F('몸통 굵기', 'headW', el.headW == null ? 0.5 : el.headW, { type: 'range', min: 0.1, max: 1, step: 0.05 })}</div>` : ''}
    ${el.kind === 'rect' ? F('모서리(mm)', 'radius', el.radius, { type: 'number', step: 0.5, min: 0 }) : ''}
    ${el.kind === 'line' ? `<div class="grid2">${F('끝 화살표', 'arrowEnd', el.arrowEnd, { type: 'check' })}${F('시작 화살표', 'arrowStart', el.arrowStart, { type: 'check' })}</div>` : `<h3>채우기</h3>${fillBlock}${(el.fillType || 'solid') === 'solid' ? `${F('채우기 색', 'fill', el.fill || '#000000', { type: 'color' })}${sw('fill', el.fill)}<button class="btn sm" data-set="fill:">채우기 없음</button>` : ''}`}
    <h3>선</h3><div class="grid3">${F('선 색', 'stroke', el.stroke || (el.kind === 'line' ? el.fill : '#000000'), { type: 'color' })}${F('두께(mm)', 'strokeW', el.strokeW || 0, { type: 'number', step: 0.1, min: 0 })}${F('점선', 'dash', el.dash || '', { type: 'select', options: [['', '실선'], ['3 2', '긴 점선'], ['1.5 1.5', '점선'], ['0.1 2', '점점선'], ['6 2 1.5 2', '쇄선']] })}</div>${F('선 끝', 'cap', el.cap || 'butt', { type: 'select', options: [['butt', '각지게'], ['round', '둥글게'], ['square', '네모']] })}${el.kind !== 'line' ? '<button class="btn sm" data-set="stroke:">선 없음</button>' : ''}
    ${shadowBlock()}` + geo;
  } else if (el.type === 'path') {
    h += `<h3>펜 선</h3><div class="grid3">${F('선 색', 'stroke', el.stroke || '#000000', { type: 'color' })}${F('두께(mm)', 'strokeW', el.strokeW == null ? 0.8 : el.strokeW, { type: 'number', step: 0.1, min: 0 })}${F('점선', 'dash', el.dash || '', { type: 'select', options: [['', '실선'], ['3 2', '긴 점선'], ['1.5 1.5', '점선'], ['0.1 2', '점점선']] })}</div>
    <div class="grid3">${F('부드럽게', 'smooth', el.smooth !== false, { type: 'check' })}${F('닫힌 모양', 'closed', el.closed, { type: 'check' })}${F('선 끝', 'cap', el.cap || 'round', { type: 'select', options: [['round', '둥글게'], ['butt', '각지게'], ['square', '네모']] })}</div>
    ${el.closed ? `<h3>채우기</h3>${fillBlock}${(el.fillType || 'solid') === 'solid' ? `${F('채우기 색', 'fill', el.fill || '#FFE89A', { type: 'color' })}<button class="btn sm" data-set="fill:">채우기 없음</button>` : ''}` : ''}
    ${shadowBlock()}<p class="hint">점 ${(el.pts || []).length}개. 크기를 바꾸면 선도 함께 늘어납니다. 다시 그리려면 P 키로 펜을 켜세요.</p>` + geo;
  } else if (el.type === 'chart') {
    h += `<h3>차트</h3>${F('종류', 'kind', el.kind, { type: 'select', options: [['bar', '막대'], ['hbar', '가로 막대'], ['line', '꺾은선'], ['pie', '원형'], ['donut', '도넛']] })}${F('제목', 'title', el.title)}
    <label class="f"><span>항목과 값 (한 줄에 "이름, 값")</span><textarea data-k="chartData" rows="6">${esc((el.data || []).map(d => `${d.l}, ${d.v}`).join('\n'))}</textarea></label>
    ${F('값 표시', 'showVal', el.showVal, { type: 'check' })}<label class="f"><span>색 (쉼표로 구분)</span><input type="text" data-k="chartColors" value="${esc((el.colors || []).join(', '))}"></label>
    <div class="row">${[['#1E2B5A,#E0564B,#FFE89A,#4C8A2B,#6B3FD1,#2F8D9E', '기본'], ['#2F5BEA,#5B8DEF,#8FB4F5,#C3D6FA,#1E2B5A,#0F1A3A', '파랑 톤'], ['#E0564B,#F08A7C,#FFB8A8,#FFE89A,#FFD34D,#B8432B', '따뜻한 톤'], ['#2F5D3A,#4C8A2B,#7FC8A9,#DDF3EA,#1F6B4A,#A3D9B1', '초록 톤']].map(([c, n]) => `<button class="btn sm" data-set="chartColors:${c}">${n}</button>`).join('')}</div>` + geo;
  } else if (el.type === 'cal') {
    const s = Object.assign({}, CAL.CAL_DEF, el.s || {}); const dim = CAL.daysIn(el.year, el.month);
    const hol = (doc.holidays[el.year] || []); const holNames = selDay ? hol.filter(x => x.date === `${el.year}-${String(el.month).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`).map(x => x.name) : [];
    const evs = selDay ? (el.events || []).map((e, k) => ({ e, k })).filter(x => x.e.d === selDay) : []; const allEv = (el.events || []).map((e, k) => ({ e, k })).sort((a, b) => a.e.d - b.e.d);
    h += `<h3>달력</h3><div class="grid2">${F('연도', 'year', el.year, { type: 'number', min: 1900, max: 2100 })}${F('월', 'month', el.month, { type: 'select', options: Array.from({ length: 12 }, (_, i) => [i + 1, (i + 1) + '월']) })}</div>
    <p class="hint">${hol.length ? `${el.year}년 공휴일 ${hol.length}개 자동 적용 중` : `${el.year}년 공휴일 정보가 없습니다.`} <button class="btn sm" id="calHol">편집</button></p>
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
  h += `<h3>동작</h3><div class="row"><button class="btn sm" id="iDup">복제</button><button class="btn sm" id="iFront">맨 앞</button><button class="btn sm" id="iBack">맨 뒤</button><button class="btn sm danger" id="iDel">삭제</button></div>`;
  ins.innerHTML = h;
  ins.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fp) { openFontPop(b); return; }
    if (b.dataset.toggle) { el.locked = !el.locked; commit(); renderOverlay(); renderInspector(); return; }
    if (b.dataset.set != null) { const i = b.dataset.set.indexOf(':'); const k = b.dataset.set.slice(0, i), v = b.dataset.set.slice(i + 1); if (k === 'chartColors') el.colors = v.split(',').map(s => s.trim()); else setK(el, k, v); commit(); rerender(); return; }
    if (b.dataset.preset) { const p = FX.TEXT_PRESETS.find(x => x.id === b.dataset.preset); Object.assign(el, p.st); if (p.id === 'plain') { el.warp = 'none'; el.vertical = false; } commit(); rerender(); return; }
    if (b.dataset.imgpreset) { const p = FX.IMG_PRESETS.find(x => x[0] === b.dataset.imgpreset); el.fx = Object.assign({}, p[2]); commit(); rerender(); return; }
    if (b.id === 'iDup') duplicate(); if (b.id === 'iDel') removeSel(); if (b.id === 'iFront') reorder('front'); if (b.id === 'iBack') reorder('back');
    if (b.id === 'fontBrowse') openFonts();
    if (b.id === 'imgLib') { sideTab = 'photo'; renderRail(); renderSide(); }
    if (b.id === 'imgAI') openAI('image');
    if (b.id === 'imgEdit') openImgEditor(el);
    if (b.id === 'imgOrig') { el.src = el.srcOrig; delete el.srcOrig; commit(); rerender(); }
    if (b.id === 'imgFitBox') { const i = new Image(); i.onload = () => { el.h = r1(el.w * i.naturalHeight / i.naturalWidth); commit(); rerender(); }; i.src = src(el.src); }
    if (b.id === 'imgFull') { el.x = 0; el.y = 0; el.w = doc.w; el.h = doc.h; el.fit = 'cover'; commit(); rerender(); }
    if (b.id === 'calHol') openHoliday(el.year);
    if (b.id === 'evAdd') { el.events = el.events || []; el.events.push({ d: selDay, text: '', color: '' }); commit(); rerender(); const last = $$('#inspector .evrow input').pop(); if (last) last.focus(); }
    if (b.dataset.evdel != null) { el.events.splice(Number(b.dataset.evdel), 1); commit(); rerender(); }
    if (b.id === 'rulesApply') { const n = CAL.applyRules(el, doc.rules); commit(); rerender(); toast(`${n}개 일정을 넣었습니다`); }
    if (b.id === 'rulesAll') { let n = 0; doc.pages.forEach(p => p.els.forEach(x => { if (x.type === 'cal') n += CAL.applyRules(x, doc.rules); })); commit(); rerender(); toast(`문서 전체에 ${n}개 일정을 넣었습니다`); }
    if (b.id === 'rulesEdit') openRules();
  };
  ins.querySelectorAll('li[data-godate]').forEach(li => li.onclick = e => { if (e.target.closest('button')) return; selDay = Number(li.dataset.godate); rerender(); });
}
function openImgEditor(el) { const s = src(el.src); if (!s) return; NC.imgedit.open(s, url => { if (!el.srcOrig) el.srcOrig = el.src; el.src = addAsset(url); commit(); rerender(); toast('편집한 이미지를 넣었습니다'); }); }
function setK(obj, k, v) { const ks = k.split('.'); let a = obj; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = ks[i + 1].match(/^\d+$/) ? [] : {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; }
$('#inspector').addEventListener('input', e => {
  const t = e.target, k = t.dataset.k; if (!k) return;
  let v = t.type === 'checkbox' ? t.checked : t.value;
  if (t.type === 'number' || t.type === 'range') v = Number(v);
  if (k.startsWith('pg.')) { page()[k.slice(3)] = v; renderCanvas(); return; }
  if (k.startsWith('multi.')) { const kk = k.slice(6); selEls().forEach(el => { if (kk === 'opacity' || el.type === 'text') el[kk] = v; }); renderCanvas(); return; }
  const el = selEls()[0]; if (!el) return;
  if (['year', 'month', 'weight', 's.weekStart'].includes(k)) v = Number(v);
  if (t.dataset.ev != null) return;
  if (k === 'chartData') { el.data = v.split('\n').map(l => l.split(/[,\t]/)).filter(a => a[0] && a[0].trim()).map(a => ({ l: a[0].trim(), v: Number((a[1] || '0').trim()) || 0 })); renderCanvas(); return; }
  if (k === 'chartColors') { el.colors = v.split(',').map(s => s.trim()).filter(Boolean); renderCanvas(); return; }
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
  if (t.id === 'imgReplace' && el) { const f = t.files[0]; if (!f) return; fileToDataURL(f).then(d => { el.src = addAsset(d); delete el.srcOrig; commit(); rerender(); }); return; }
  if (t.dataset.k) { if (t.dataset.k === 'year' && el && (el.type === 'cal' || el.type === 'mini')) ensureHolidays(el.year); commit(); if (t.tagName === 'SELECT' || t.type === 'checkbox' || ['year', 'month', 'kind', 'warp', 'fillType'].includes(t.dataset.k)) { renderCanvas(); renderInspector(); } }
});

/* ======================= 상단 메뉴 · 대화상자 ======================= */
$('#pname').addEventListener('input', e => { doc.name = e.target.value; markDirty(); });
// 동기화 폴더 안의 문서는 이름을 바꾸면 파일 이름도 따라 바꿈 (지원하는 브라우저에서)
$('#pname').addEventListener('change', async () => {
  const h = store.state.handle; if (!h || !h.move || !(await store.inFolder(h))) return;
  const base = (doc.name || '').replace(/[\\/:*?"<>|]/g, '_').trim(); if (!base) return;
  const name = base + '.design.json'; if (name === h.name) return;
  if ((await store.listDocs()).some(x => x.name === name)) return;
  try { await h.move(name); store.state.fileName = h.name; await store.idbSet('fileHandle', h); updateSaveBadge(); } catch (e) { console.warn('파일 이름 바꾸기', e); }
});
$('#btnNew').onclick = async () => {
  const inDir = await store.folderReady();
  if (!window.confirm(inDir ? '새 문서를 만들까요? (지금 문서는 동기화 폴더에 그대로 남고, 새 문서도 폴더에 저장됩니다)' : '새 문서를 만들까요? (파일에 연결되어 있지 않은 현재 작업은 브라우저 저장본만 남습니다)')) return;
  if (store.state.handle && store.state.dirty) { clearTimeout(fileTimer); await saveFileNow(); }
  await store.disconnect(); doc = newDoc(); hist = []; hptr = -1; cur = 0; sel = []; $('#pname').value = doc.name; commit(); clearTimeout(fileTimer);
  if (inDir) { try { await store.saveIntoFolder(doc); setStatus(`동기화 폴더에 저장됨 · ${store.state.fileName}`); } catch (e) { toast('폴더에 저장하지 못했습니다: ' + e.message, true); } }
  renderAll(); updateSaveBadge(); sideTab = 'tpl'; renderRail(); renderSide();
};
$('#btnOpen').onclick = async () => { if (await store.folderReady()) { openSaveDialog(); return; } openOtherFile(); };
async function openOtherFile() { try { let j = null; if (store.state.supported) j = await store.openExisting(); else j = await store.pickLocal(); if (j) { await loadDoc(j, '불러왔습니다'); updateSaveBadge(); } } catch (e) { if (e.name !== 'AbortError') toast('열 수 없습니다: ' + e.message, true); } }
$('#btnSave').onclick = openSaveDialog;
$('#btnHelp').onclick = () => $('#dlgHelp').showModal();
$('#btnFonts').onclick = openFonts;
$('#btnHoliday').onclick = () => openHoliday();
$$('dialog [data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());

async function openSaveDialog() {
  let d = $('#dlgSave'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgSave'; d.innerHTML = `<div class="dhead"><h2>저장 · 동기화</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="saveBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  await renderSaveDialog();
  if (!d.open) d.showModal();
}
async function renderSaveDialog() {
  const d = $('#dlgSave'), st = store.state;
  const ready = await store.folderReady();
  const docs = ready ? await store.listDocs() : [];
  const curIn = ready && st.handle && await store.inFolder(st.handle);
  const when = t => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const folderPart = ready ? `<p><b>동기화 폴더:</b> <code>${esc(st.dirName)}</code> — 설정값과 아래 문서들이 이 폴더를 통해 모든 PC에서 같아집니다.</p>
    <h3>폴더 안의 문서 (${docs.length})</h3>
    ${docs.length ? `<ul class="list">${docs.map((x, i) => `<li data-doc="${i}" title="누르면 엽니다"><span>${esc(x.name.replace(/\.design\.json$/i, ''))}</span><small class="hint" style="margin:0">${when(x.lastModified)} · ${Math.max(1, Math.round(x.size / 1024)).toLocaleString()}KB</small>${st.handle && x.name === st.fileName && curIn ? '<b style="min-width:auto">작업 중</b>' : ''}</li>`).join('')}</ul>` : '<p class="hint">아직 문서가 없습니다.</p>'}
    <div class="row" style="margin-top:10px">${curIn ? '' : '<button class="btn primary" id="svIntoDir">지금 문서를 이 폴더에 저장</button>'}<button class="btn" id="svNow" ${st.handle ? '' : 'disabled'}>지금 저장</button><button class="btn" id="svOther">다른 위치의 파일 열기</button><button class="btn" id="svDown">내려받기 (JSON 사본)</button><button class="btn danger" id="svDiscDir">폴더 연결 해제</button></div>`
  : `<p><b>지금 상태:</b> ${st.handle ? `파일 <code>${esc(st.fileName)}</code>에 연결되어 자동 저장 중입니다. 설정값(API 키 등)은 이 PC에만 있습니다.` : '브라우저 안에만 자동 저장되고 있습니다 (이 PC, 이 브라우저에서만 보임).'}</p>
    ${st.dir ? `<p class="hint">동기화 폴더 <b>${esc(st.dirName)}</b>가 연결되어 있지만 이 창에서 아직 허락하지 않았습니다.</p><div class="row"><button class="btn primary" id="svReDir">동기화 폴더 다시 연결</button></div>` : ''}
    <h3>여러 PC에서 쓰기 (구글 드라이브)</h3>
    <ol style="margin:0 0 10px 18px;line-height:1.7"><li>각 PC에 <b>Google Drive 데스크톱 앱</b>을 설치하고 같은 계정으로 로그인합니다.</li><li>아래 <b>"동기화 폴더 연결"</b>을 누르고 <b>내 드라이브 → 나라차디자인공방</b> 폴더를 고릅니다 (없으면 그 창에서 새 폴더로 만듭니다). Windows는 보통 <code>G:\\내 드라이브</code>, Mac은 Finder 왼쪽의 <code>Google Drive → 내 드라이브</code>입니다.</li><li>그러면 <b>설정값(API 키·모델·최근 사용 글꼴·요소·템플릿)</b>과 <b>모든 문서</b>가 그 폴더에 저장되고, 다른 PC에서 같은 폴더를 연결하면 그대로 이어집니다.</li><li>PC마다 처음 한 번만 연결하면 됩니다. 브라우저가 "방문할 때마다 허용"을 물으면 허용해 두면 편합니다.</li></ol>
    ${st.dirSupported ? '' : '<p class="hint">이 브라우저는 폴더 연결을 지원하지 않습니다. Chrome 또는 Edge를 쓰세요. 지금은 "내려받기"로 저장하세요.</p>'}
    <div class="row"><button class="btn primary" id="svDir" ${st.dirSupported ? '' : 'disabled'}>동기화 폴더 연결</button><button class="btn" id="svConnect" ${st.supported ? '' : 'disabled'}>${st.handle ? '다른 파일에 연결' : '파일 하나만 연결'}</button><button class="btn" id="svNow" ${st.handle ? '' : 'disabled'}>지금 저장</button><button class="btn" id="svDown">내려받기 (JSON 사본)</button>${st.handle ? '<button class="btn danger" id="svDisc">파일 연결 해제</button>' : ''}</div>`;
  $('#saveBody').innerHTML = folderPart + `<p class="hint" style="margin-top:10px">문서 파일에는 올린 이미지와 AI 이미지가 함께 들어갑니다. 내장 글꼴과 2026 삽화는 프로그램에 있으므로 파일이 가벼워집니다. 같은 문서를 두 PC에서 동시에 고치면 나중에 저장한 쪽이 남으니, 한 PC에서 마치고 옮겨 가세요.</p>`;
  const on = (id, fn) => { const b = $('#' + id); if (b) b.onclick = async () => { try { await fn(); } catch (e) { if (e.name !== 'AbortError') toast(e.message, true); } }; };
  on('svDir', async () => { await store.connectFolder(); await afterFolderReady(); updateSaveBadge(); toast('동기화 폴더를 연결했습니다. 설정과 문서가 이 폴더로 동기화됩니다.'); renderSaveDialog(); });
  on('svReDir', async () => { if (await store.requestFolderPermission()) { await afterFolderReady({ loadCurrent: true }); updateSaveBadge(); renderSaveDialog(); } });
  on('svIntoDir', async () => { gcAssets(); await store.saveIntoFolder(doc); updateSaveBadge(); setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); renderSaveDialog(); });
  on('svDiscDir', async () => { if (!window.confirm('이 PC에서 동기화 폴더 연결을 끊을까요? (폴더 안 파일은 그대로 남습니다)')) return; await store.disconnectFolder(); await store.disconnect(); updateSaveBadge(); setStatus('브라우저에만 저장됩니다'); renderSaveDialog(); });
  on('svConnect', async () => { gcAssets(); await store.connectNew(doc); updateSaveBadge(); setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); toast('파일에 연결했습니다. 이제 자동으로 저장됩니다.'); d.close(); });
  on('svNow', async () => { gcAssets(); await saveFileNow(); d.close(); });
  on('svOther', async () => { d.close(); await openOtherFile(); });
  on('svDown', async () => { gcAssets(); store.download(doc); toast('사본을 내려받았습니다'); });
  on('svDisc', async () => { await store.disconnect(); updateSaveBadge(); setStatus('브라우저에만 저장됩니다'); d.close(); });
  const ul = d.querySelector('.list'); if (ul) ul.onclick = async e => { const li = e.target.closest('[data-doc]'); if (!li) return; const x = docs[Number(li.dataset.doc)]; if (st.handle && x.name === st.fileName && curIn) { d.close(); return; } try { await openFolderDoc(x.handle); d.close(); } catch (err) { toast('열 수 없습니다: ' + err.message, true); } };
}

/* ---- 글꼴 둘러보기 ---- */
let fontCat = 'all';
function openFonts() { renderFonts(); $('#dlgFonts').showModal(); }
function renderFonts() {
  const el = selEls()[0]; const target = el && el.type === 'text' ? el : null;
  const cats = [['all', '전체'], ['title', '제목용'], ['brush', '붓글씨'], ['hand', '손글씨'], ['body', '본문용'], ['latin', '영문'], ['mine', '내 글꼴']];
  const fonts = allFonts(); const rec = recentFonts().map(n => fonts.find(f => f.family === n)).filter(Boolean);
  const list = fonts.filter(f => fontCat === 'all' || f.cat === fontCat);
  const row = f => `<div class="fontrow ${target && target.font === f.family ? 'active' : ''}" data-font="${esc(f.family)}"><div class="nm">${esc(f.label)}</div><div class="sample" style="font-family:'${esc(f.family)}'">나라차 태권도 인성 캘린더 2027 Aa</div><span class="hint" style="margin:0">${f.weights.join('/')}</span></div>`;
  $('#fontBody').innerHTML = `<div class="row" style="margin-bottom:10px"><div class="seg" style="flex:1">${cats.map(([k, t]) => `<button data-fc="${k}" aria-pressed="${fontCat === k}">${t}</button>`).join('')}</div><label class="btn sm">내 글꼴 올리기<input type="file" accept=".ttf,.otf,.woff,.woff2" id="fontUp" hidden></label></div>
  <p class="hint">${target ? `선택한 글 상자 "${esc(elName(target))}"에 바로 적용됩니다.` : '글 상자를 선택한 뒤 열면 바로 적용됩니다. 지금은 새 글자의 기본 글꼴로 정해집니다.'} 모든 글꼴은 무료(OFL 등)로 상업 인쇄물에 쓸 수 있습니다.</p>
  ${rec.length && fontCat === 'all' ? `<h3>최근 사용</h3><div class="fontlist">${rec.map(row).join('')}</div><h3>전체 ${list.length}종</h3>` : ''}
  <div class="fontlist">${list.map(row).join('')}</div>`;
  $('#fontBody').onclick = e => { const c = e.target.closest('[data-fc]'); if (c) { fontCat = c.dataset.fc; renderFonts(); return; } const r = e.target.closest('[data-font]'); if (!r) return; noteFont(r.dataset.font); if (target) { target.font = r.dataset.font; commit(); rerender(); renderFonts(); } else { lastTextStyle = Object.assign({}, lastTextStyle || {}, { font: r.dataset.font }); toast(`새 글자의 기본 글꼴: ${r.dataset.font}`); } };
  $('#fontUp').onchange = async e => { const f = e.target.files[0]; if (!f) return; const data = await fileToDataURL(f); const family = f.name.replace(/\.(ttf|otf|woff2?)$/i, ''); try { const ff = new FontFace(family, `url(${data})`); await ff.load(); document.fonts.add(ff); doc.fonts.push({ family, data }); commit(); renderFonts(); toast(`글꼴 "${family}"을 추가했습니다`); } catch (err) { toast('글꼴을 읽지 못했습니다', true); } };
}

/* ---- 공휴일 ---- */
let holState = { year: 2027, source: 'builtin', list: null };
function openHoliday(year) { holState.year = year || doc.calendar.year || new Date().getFullYear(); holState.list = (doc.holidays[holState.year] || []).map(h => Object.assign({}, h)); holState.source = CAL.canAuto(holState.year) ? 'builtin' : (AI.cfg.datagoKey ? 'datago' : 'nager'); renderHoliday(); $('#dlgHoliday').showModal(); }
function renderHoliday() {
  const s = holState; const years = []; for (let y = 2020; y <= 2040; y++) years.push(y);
  $('#holBody').innerHTML = `<div class="row" style="margin-bottom:8px"><label class="f" style="margin:0"><span>연도</span><select id="holYear">${years.map(y => `<option ${y === s.year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
  <label class="f" style="margin:0;flex:1"><span>출처</span><select id="holSrc"><option value="builtin" ${s.source === 'builtin' ? 'selected' : ''}>자동 계산 (2023~2036년, 대체공휴일·2027년 신설 노동절·제헌절·선거일 포함)</option><option value="datago" ${s.source === 'datago' ? 'selected' : ''}>공공데이터포털 특일정보 (공식, 서비스 키 필요)</option><option value="nager" ${s.source === 'nager' ? 'selected' : ''}>Nager.Date 공개 API (키 없음, 한국 데이터 정확도 낮음)</option></select></label>
  <button class="btn primary" id="holFetch" style="margin-top:16px">가져오기</button></div>
  <div id="holKeyRow" ${s.source === 'datago' ? '' : 'hidden'}><label class="f"><span>공공데이터포털 서비스 키 (data.go.kr → 한국천문연구원 특일 정보)</span><input type="text" id="holKey" value="${esc(AI.cfg.datagoKey || '')}" placeholder="일반 인증키(Decoding)"></label></div>
  <p class="hint">연도를 고르면 2023~2036년은 자동으로 계산되어 들어갑니다(양력 공휴일 + 설·추석·부처님오신날 + 대체공휴일 규칙 + 국회의원·지방선거일). 임시공휴일·대통령 선거일·추가 지정일은 여기서 직접 넣어 주세요. <span id="holMsg"></span></p>
  <table class="holtable"><thead><tr><th style="width:130px">날짜</th><th>이름</th><th style="width:40px"></th></tr></thead><tbody id="holRows">${(s.list || []).map((h, i) => `<tr><td><input type="date" data-hd="${i}" value="${h.date}"></td><td><input type="text" data-hn="${i}" value="${esc(h.name)}"></td><td><button class="btn sm" data-hx="${i}">×</button></td></tr>`).join('')}</tbody></table>
  <div class="row" style="margin-top:8px"><button class="btn sm" id="holAdd">+ 직접 추가</button><div style="flex:1"></div><button class="btn danger" id="holClear">이 연도 지우기</button><button class="btn primary" id="holApply">적용 (${(s.list || []).length}개)</button></div>`;
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

/* ---- AI 도우미 ---- */
let aiCtx = { tab: 'content', monthIdx: 0 };
$('#btnAI').onclick = () => openAI(selEls()[0] && selEls()[0].type === 'image' ? 'image' : 'content');
function openAI(tab) { aiCtx.tab = tab; const el = selEls()[0]; if (el && el.month) aiCtx.monthIdx = el.month - 1; if (!AI.cfg.anthropicKey && !AI.cfg.geminiKey && tab !== 'keys') aiCtx.tab = 'keys'; renderAI(); $('#dlgAI').showModal(); }
$$('#dlgAI [role=tab]').forEach(b => b.onclick = () => { aiCtx.tab = b.dataset.tab; renderAI(); });
function applyMonthContent(mi, r) {
  Object.assign(doc.calendar.months[mi], { virtue: r.virtue, en: r.en, quote: r.quote, practice: r.practice.slice(0, 2), idiom: r.idiom, hanja: r.hanja, meaning: r.meaning });
  let n = 0;
  doc.pages.forEach(p => p.els.forEach(el => { if (el.type !== 'text' || el.month !== mi + 1) return; const map = { virtue: r.virtue, en: `(${r.en})`, quote: r.quote, practice: `1. ${r.practice[0]}\n2. ${r.practice[1]}`, idiom: `${r.idiom}(${r.hanja})`, meaning: r.meaning }; if (map[el.role] != null) { el.text = map[el.role]; n++; } }));
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
    <p class="hint">결과를 확인한 뒤 "적용"을 눌러야 들어갑니다. 적용하면 캘린더 데이터와, 해당 달의 역할이 지정된 글 상자가 함께 바뀝니다.</p><div id="aiResult"></div>`;
    $('#aiMonth').onchange = e => { aiCtx.monthIdx = Number(e.target.value); renderAI(); };
    $('#aiGoMonth').onclick = () => runAI(async () => { const r = await AI.suggestMonth({ year, month: mi + 1, virtue: $('#aiVirtue').value.trim(), hint: $('#aiHint').value.trim() }); $('#aiResult').innerHTML = `<div class="aiout">${esc(JSON.stringify(r, null, 2))}</div><div class="row" style="margin-top:8px"><button class="btn primary" id="aiApply">${mi + 1}월에 적용</button></div>`; $('#aiApply').onclick = () => { const n = applyMonthContent(mi, r); commit(); rerender(); $('#dlgAI').close(); toast(`${mi + 1}월 문구를 적용했습니다 (글 상자 ${n}개 갱신)`); }; });
    $('#aiGoYear').onclick = () => runAI(async () => { const r = await AI.suggestYear({ year, previous: months.map(x => x.virtue), hint: $('#aiHint').value.trim() }); $('#aiResult').innerHTML = `<div class="aiout">${r.map((x, k) => `${k + 1}월 ${x.virtue} (${x.en}) · ${x.idiom}(${x.hanja})\n  ${x.quote.replace(/\n/g, ' ')}\n  1) ${x.practice[0]}\n  2) ${x.practice[1]}`).join('\n\n')}</div><div class="row" style="margin-top:8px"><button class="btn primary" id="aiApplyY">12개월 모두 적용</button></div>`; $('#aiApplyY').onclick = () => { let n = 0; r.forEach((x, k) => n += applyMonthContent(k, x)); commit(); rerender(); $('#dlgAI').close(); toast(`12개월 문구를 적용했습니다 (글 상자 ${n}개 갱신)`); }; });
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
  <label class="chk"><input type="checkbox" id="aiWhite" checked> 생성 후 흰 배경을 자동으로 투명하게 (고급 지우기)</label>
  <div class="row"><button class="btn primary" id="aiGen">Gemini로 이미지 만들기</button><label class="f" style="margin:0"><span>장수</span><select id="aiN"><option>1</option><option>2</option><option>3</option></select></label><span id="aiBusy"></span></div>
  <div class="aiimgs" id="aiImgs"></div>`;
  $('#aiMonth2').onchange = e => { aiCtx.monthIdx = Math.max(0, Number(e.target.value)); };
  $('#aiPrompt').onclick = () => runAI(async () => { const k = Number($('#aiMonth2').value); const m2 = k >= 0 ? months[k] : null; const t = await AI.imagePrompt(m2 ? { virtue: m2.virtue, en: m2.en, quote: m2.quote, practice: m2.practice, character: $('#aiChar').value, extra: $('#aiExtra').value } : { virtue: 'General illustration for a taekwondo school design', en: '', quote: doc.name, practice: [], character: $('#aiChar').value, extra: $('#aiExtra').value }); $('#aiPromptText').value = t; });
  $('#aiGen').onclick = () => runAI(async () => {
    const prompt = $('#aiPromptText').value.trim(); if (!prompt) throw new Error('프롬프트를 먼저 적거나 Claude로 만들어 주세요.');
    const n = Number($('#aiN').value); const ref = $('#aiRef').checked ? ASSETS['mascot-01'] : null;
    for (let k = 0; k < n; k++) {
      $('#aiBusy').innerHTML = `<span class="spin"></span>${k + 1}/${n} 생성 중…`;
      const imgs = await AI.geminiImage({ prompt, refImage: ref });
      for (let s of imgs) {
        if ($('#aiWhite').checked) { try { s = await NC.imgedit.removeColorFromSrc(s, '#ffffff'); } catch (e) {} }
        const fig = document.createElement('figure'); fig.innerHTML = `<img src="${s}" alt=""><figcaption><button class="btn sm primary">사용</button><button class="btn sm">내려받기</button></figcaption>`;
        fig.querySelectorAll('button')[0].onclick = () => { const ref2 = addAsset(s); if (targetImg) { targetImg.src = ref2; delete targetImg.srcOrig; commit(); rerender(); } else addImage(ref2); $('#dlgAI').close(); toast('그림을 넣었습니다'); };
        fig.querySelectorAll('button')[1].onclick = () => { const a = document.createElement('a'); a.href = s; a.download = `ai-image-${Date.now()}.png`; a.click(); };
        $('#aiImgs').prepend(fig);
      }
    }
  });
}
function aiF(label, key, type) { return `<label class="f"><span>${label}</span><input type="${type || 'text'}" data-ai="${key}" value="${esc(AI.cfg[key])}" autocomplete="off"></label>`; }
$('#aiBody').addEventListener('input', e => { const k = e.target.dataset.ai; if (k) { AI.cfg[k] = e.target.value.trim(); AI.saveCfg(); } });
$('#aiBody').addEventListener('change', e => { const k = e.target.dataset.ai; if (k) { AI.cfg[k] = e.target.value.trim(); AI.saveCfg(); } });
async function runAI(fn) { const busy = $('#aiBusy'); const btns = $$('#aiBody button'); btns.forEach(b => b.disabled = true); if (busy) busy.innerHTML = '<span class="spin"></span>요청 중…'; try { await fn(); if (busy) busy.textContent = '완료'; } catch (err) { if (busy) busy.textContent = ''; toast(err.message, true); } finally { btns.forEach(b => b.disabled = false); } }

/* ---- 내보내기 ---- */
$('#btnExport').onclick = async () => {
  endEdit(); const b = Math.max(0, Number(doc.bleed) || 0);
  $('#pageStyle').textContent = `@page{size:${doc.w + 2 * b}mm ${doc.h + 2 * b}mm;margin:0}`;
  const root = $('#printRoot'); root.innerHTML = doc.pages.map(pg => sheetHTML(pg, 'print')).join('');
  setStatus('PDF 준비 중…'); try { await document.fonts.ready; } catch (e) {}
  await Promise.all(Array.from(root.querySelectorAll('img')).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
  setStatus('인쇄 창을 열었습니다 (대상: PDF로 저장, 여백: 없음, 배경 그래픽: 켬)'); window.print(); setTimeout(() => { root.innerHTML = ''; }, 2000);
};
$('#btnPNG').onclick = async () => {
  endEdit();
  if (!window.html2canvas) { setStatus('PNG 모듈 불러오는 중…'); await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = res; s.onerror = () => rej(new Error('PNG 모듈을 불러오지 못했습니다 (인터넷 필요)')); document.head.appendChild(s); }).catch(e => { toast(e.message, true); }); if (!window.html2canvas) return; }
  const tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-99999px;top:0'; tmp.innerHTML = sheetHTML(page(), 'thumb'); document.body.appendChild(tmp);
  try { const canvas = await html2canvas(tmp.firstElementChild, { scale: 300 / 96, backgroundColor: null, logging: false }); const a = document.createElement('a'); a.download = `${(doc.name || 'design').replace(/[\\/:*?"<>|]/g, '_')}-${cur + 1}.png`; a.href = canvas.toDataURL('image/png'); a.click(); toast('PNG로 저장했습니다 (300dpi)'); }
  catch (e) { toast('PNG 저장 실패: ' + e.message, true); } finally { tmp.remove(); setStatus(''); }
};

/* ---- 패널 너비 조절 ---- */
(function () {
  const root = document.documentElement;
  try { const w = JSON.parse(localStorage.getItem('naracal-panels') || '{}'); if (w.side) root.style.setProperty('--side-w', w.side + 'px'); if (w.insp) root.style.setProperty('--insp-w', w.insp + 'px'); } catch (e) {}
  function save() { try { localStorage.setItem('naracal-panels', JSON.stringify({ side: parseInt(getComputedStyle(root).getPropertyValue('--side-w')), insp: parseInt(getComputedStyle(root).getPropertyValue('--insp-w')) })); } catch (e) {} }
  [['rszL', '--side-w', 1, 200, 560], ['rszR', '--insp-w', -1, 240, 560]].forEach(([id, v, dir, min, max]) => {
    const h = document.getElementById(id); if (!h) return;
    h.addEventListener('pointerdown', e => { e.preventDefault(); const x0 = e.clientX, w0 = parseInt(getComputedStyle(root).getPropertyValue(v)); h.classList.add('on'); h.setPointerCapture(e.pointerId); const mv = ev => { root.style.setProperty(v, clamp(w0 + dir * (ev.clientX - x0), min, max) + 'px'); }; const up = () => { h.classList.remove('on'); h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); save(); fitCanvas(); renderThumbs(); }; h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); });
    h.addEventListener('dblclick', () => { root.style.setProperty(v, (dir === 1 ? 300 : 320) + 'px'); save(); fitCanvas(); renderThumbs(); });
  });
})();

/* ---- 자동 업데이트: 새 버전이 올라오면 편집 중이 아닐 때 새로고침 ---- */
(function () {
  const cur_ = window.NARACAL_VER || '';
  if (!cur_ || location.protocol === 'file:') return;
  let pending = null;
  async function check() { try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); if (j.ver && j.ver !== cur_) pending = j.ver; } catch (e) {} if (pending) tryReload(); }
  function tryReload() { if (editing || drag || pen || document.querySelector('dialog[open]')) { setTimeout(tryReload, 15000); return; } setStatus(`새 버전(${pending})이 있어 잠시 후 새로고침합니다`); toast('새 버전이 올라와 10초 뒤 자동으로 새로고침합니다. 작업은 자동 저장되어 있습니다.'); setTimeout(() => { location.href = location.pathname + '?v=' + pending; }, 10000); }
  setInterval(check, 60000); window.addEventListener('focus', check); setTimeout(check, 20000);
})();

/* ---- 기타 ---- */
let toastTimer; function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, err ? 5000 : 2200); }

/* ---- 시작 ---- */
(async function init() {
  doc = newDoc(); renderRail();
  let loaded = false;
  try {
    const p = await store.reconnect();
    if (p === 'granted') { const j = await store.readFile(); await loadDoc(j); loaded = true; setStatus(`연결된 파일: ${store.state.fileName}`); }
    else if (p === 'prompt') { const saved = await store.idbGet('doc'); if (saved) { await loadDoc(saved); loaded = true; } const st = $('#status'); st.innerHTML = `<button class="btn sm" id="reconn">연결된 파일 "${esc(store.state.fileName)}" 다시 열기</button>`; $('#reconn').onclick = async () => { if (await store.requestPermission()) { const j = await store.readFile(); await loadDoc(j, '연결된 파일을 열었습니다'); updateSaveBadge(); } }; }
  } catch (e) { console.warn(e); }
  if (!loaded) { try { const saved = await store.idbGet('doc'); if (saved) { await loadDoc(saved); loaded = true; setStatus('브라우저 저장본을 불러왔습니다'); } } catch (e) {} }
  if (!loaded) { doc = newDoc(); doc.calendar.year = 2027; doc.name = '2027 인성 캘린더'; doc.pages = CAL.buildPages(doc, uid, { year: 2027, kind: 'full' }); ensureAllHolidays(); $('#pname').value = doc.name; hist = [snapshot()]; hptr = 0; renderAll(); setStatus('2027년 캘린더 초안을 만들었습니다. 공휴일은 자동으로 들어갔습니다.'); freshDraft = true; }
  // 동기화 폴더(구글 드라이브): 허락돼 있으면 바로 맞추고, 아니면 한 번 눌러 허락받기
  try {
    const pf = await store.reconnectFolder();
    if (pf === 'granted') await afterFolderReady();
    else if (pf === 'prompt') {
      $('#status').innerHTML = `<button class="btn sm primary" id="reconnDir">동기화 폴더 "${esc(store.state.dirName)}" 연결 (눌러서 허락)</button>`;
      $('#reconnDir').onclick = async () => { try { if (await store.requestFolderPermission()) { await afterFolderReady({ loadCurrent: true }); updateSaveBadge(); toast('동기화 폴더에 연결했습니다'); } } catch (e) { toast(e.message, true); } };
    }
  } catch (e) { console.warn(e); }
  updateSaveBadge(); updateToolbarState();
  document.fonts && document.fonts.ready.then(() => renderAll());
})();
})();
