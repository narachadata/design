(function () {
'use strict';
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const MM = 96 / 25.4;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const isWarp = el => !!(el.warp && el.warp !== 'none');  // 휘기 없음('none')은 보통 글자
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
function src(ref) { if (!ref) return ''; if (ref.startsWith('asset:')) return ASSETS[ref.slice(6)] || ''; if (ref.startsWith('a:')) return doc.assets[ref.slice(2)] || ''; if (ref.startsWith('lib:')) return NC.lib.url(ref.slice(4)); return ref; }
function addAsset(dataURL) { for (const k in doc.assets) if (doc.assets[k] === dataURL) return 'a:' + k; const id = uid(); doc.assets[id] = dataURL; return 'a:' + id; }
function gcAssets() { const used = new Set(); const walk = v => { if (typeof v === 'string' && v.startsWith('a:')) used.add(v.slice(2)); else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(doc.pages); walk(doc.calendar); for (const k in doc.assets) if (!used.has(k)) delete doc.assets[k]; }

/* ---------- 실행 취소 ---------- */
function snapshot() { const a = doc.assets; doc.assets = null; const s = JSON.stringify(doc); doc.assets = a; return s; }
let histMeta = [];  // 기록마다 그때 보던 쪽·선택
function commit() { const s_ = snapshot(); if (hist[hptr] === s_) return; hist = hist.slice(0, hptr + 1); histMeta = histMeta.slice(0, hptr + 1); hist.push(s_); histMeta.push({ cur, sel: sel.slice() }); if (hist.length > 120) { hist.shift(); histMeta.shift(); } hptr = hist.length - 1; markDirty(); }
// 바로 앞 기록을 고쳐 씀 (그림 비율 맞춤처럼 한 동작의 뒷처리)
function amendCommit() { if (hptr < 0) return commit(); hist[hptr] = snapshot(); markDirty(); }
let nudgeTimer = null; function commitSoon() { clearTimeout(nudgeTimer); nudgeTimer = setTimeout(commit, 450); }
function restore(s, meta) { const a = doc.assets; doc = JSON.parse(s); doc.assets = a; if (meta) { cur = meta.cur; sel = meta.sel.slice(); } cur = clamp(cur, 0, doc.pages.length - 1); sel = sel.filter(id => find(id)); cellSel = null; renderAll(); markDirty(); }
function undo() { clearTimeout(nudgeTimer); if (hptr > 0) { const m = histMeta[hptr]; hptr--; restore(hist[hptr], m); } }
function redo() { if (hptr < hist.length - 1) { hptr++; restore(hist[hptr], histMeta[hptr]); } }

/* ---------- 저장 · 동기화 ---------- */
let idbTimer, fileTimer, freshDraft = false; // freshDraft: 처음 열 때 만든 초안을 아직 고치지 않음
function markDirty() {
  freshDraft = false; doc.updatedAt = Date.now(); store.state.dirty = true; store.state.seq++;
  clearTimeout(idbTimer); idbTimer = setTimeout(async () => { try { await store.idbSet('doc', doc); if (!store.state.handle) setStatus('브라우저에 저장됨 ' + tnow()); } catch (e) { setStatus('브라우저 저장 실패'); } }, 500);
  if (store.state.handle) { clearTimeout(fileTimer); fileTimer = setTimeout(saveFileNow, 1200); }
  updateSaveBadge();
}
async function saveFileNow() {
  if (store.state.conflict) return;
  if (store.state.saving) { clearTimeout(fileTimer); fileTimer = setTimeout(saveFileNow, 800); return; } // 저장 중이면 끝난 뒤 다시
  try {
    const r = await store.writeFile(doc);
    if (r === true) setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`);
    else if (r && r.conflict) await resolveConflict(r.data, r.file);
    else if (r && r.retry) { clearTimeout(fileTimer); fileTimer = setTimeout(saveFileNow, 3000); }
  } catch (e) { setStatus('파일 저장 실패: ' + e.message); toast('파일 저장 실패: ' + e.message, true); }
  updateSaveBadge();
}
// 두 PC가 같은 문서를 고쳐 갈라졌을 때: 어느 쪽을 고르든 다른 쪽은 "충돌 사본" 파일로 남겨 아무것도 잃지 않음
async function resolveConflict(theirs, file) {
  const st = store.state; if (st.conflict) return;
  st.conflict = true; clearTimeout(fileTimer);
  try {
    const who = theirs.savedBy || '다른 PC', at = theirs.savedAt ? new Date(theirs.savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
    const takeTheirs = window.confirm(`같은 문서를 ${who}에서도 고쳤습니다${at ? ` (${at} 저장)` : ''}.\n두 PC의 내용이 서로 달라 하나로 합칠 수 없습니다.\n\n확인: ${who}의 내용으로 계속합니다 — 이 PC(${store.pcName()})의 내용은 "충돌 사본" 파일로 따로 보관\n취소: 이 PC의 내용으로 계속합니다 — ${who}의 내용은 "충돌 사본" 파일로 따로 보관\n\n어느 쪽을 골라도 지워지는 내용은 없습니다.`);
    gcAssets();
    const copy = takeTheirs ? await store.writeCopy(doc, store.pcName()) : await store.writeCopy(theirs, who);
    st.lastMod = file.lastModified; store.adopt(theirs);
    if (takeTheirs) { st.dirty = false; await loadDoc(theirs); }
    st.conflict = false;
    if (!takeTheirs) await saveFileNow(); // 이 PC 내용을 상대 저장본 다음 판으로 저장
    toast(`충돌 사본을 보관했습니다: ${copy}`);
    if ($('#dlgSave') && $('#dlgSave').open) renderSaveDialog();
  } catch (e) { toast('충돌 처리 중 오류: ' + e.message, true); }
  finally { st.conflict = false; }
}
// 다른 PC가 방금까지 이 문서를 고치고 있었으면 알려 줌 (동시에 고치는 걸 미리 막기 위해)
function warnIfRecentOther(j) {
  if (!j || !j.savedAt || !j.savedBy || j.savedBy === store.pcName()) return;
  const min = Math.round((Date.now() - j.savedAt) / 60000);
  if (min <= 5) toast(`${j.savedBy}에서 ${min < 1 ? '방금' : min + '분 전'} 이 문서를 저장했습니다. 그쪽에서 아직 작업 중이면 한쪽을 닫아 주세요.`, true);
}
function tnow() { return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); }
function setStatus(t) { $('#status').textContent = t; }
function updateSaveBadge() { const b = $('#btnSave'); if (!b) return; const st = store.state; b.querySelector('span').textContent = '저장'; b.title = st.handle ? `저장 (Ctrl+S) · ${st.dir ? '동기화 폴더' : '파일'}: ${st.fileName}` : '저장 (Ctrl+S) · 아직 파일로 저장하지 않음'; b.classList.toggle('on', !!st.handle); }
async function loadDoc(j, from) {
  if (!j || !j.pages) throw new Error('문서 형식이 아닙니다');
  if (j.v !== 2) throw new Error('이 프로그램의 문서 파일이 아닙니다');
  doc = Object.assign(newDoc(), j); doc.assets = doc.assets || {}; doc.holidays = doc.holidays || {}; doc.fonts = doc.fonts || [];
  if (!doc.calendar.theme || !doc.calendar.theme.id) doc.calendar.theme = Object.assign({ id: 'classic' }, doc.calendar.theme || {});
  const m8 = doc.calendar.months && doc.calendar.months[7]; if (m8 && !m8.image && /우정/.test(m8.virtue || '')) { m8.image = 'asset:illu-08-friendship'; doc.pages.forEach(p => p.els.forEach(e => { if (e.type === 'image' && e.role === 'illust' && e.month === 8 && !e.src) e.src = m8.image; })); }
  cur = 0; sel = []; selDay = null; hist = []; histMeta = []; hptr = -1;
  await registerDocFonts(); ensureAllHolidays();
  $('#pname').value = doc.name || '';
  hist.push(snapshot()); histMeta = [{ cur: 0, sel: [] }]; hptr = 0;
  renderAll(); if (from) toast(from);
}
async function checkExternalChange() {
  const st = store.state; if (st.conflict || editing || $('#cellEd') || drag) return;
  const ch = await store.checkExternal(); if (!ch) return;
  let j; try { j = JSON.parse(ch.text); } catch (e) { return; } // 동기화 중인 파일: 다음에 다시 확인
  if ((j.saveId || '') === st.lastSaveId) { st.lastMod = ch.file.lastModified; return; } // 내용은 그대로(시각만 바뀜)
  // 여기 저장 안 한 변경이 있거나, 상대가 내 마지막 저장을 못 보고 저장했으면 충돌
  if (st.dirty || !store.descends(j)) { await resolveConflict(j, ch.file); return; }
  st.lastMod = ch.file.lastModified; store.adopt(j);
  await loadDoc(j, `${j.savedBy || '다른 PC'}에서 바뀐 내용을 불러왔습니다`);
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
// 자료실을 다 읽으면 열려 있는 패널을 다시 그림
NC.lib.onReady(() => { if (['photo', 'elems', 'tpl', 'project'].includes(sideTab)) renderSide(); });
// 자료실 그림(lib:)을 문서 이미지로 복사해 넣기
async function libInsert(file) { try { setStatus('자료실에서 불러오는 중…'); const ref = addAsset(await NC.lib.dataURL(file)); setStatus(''); return ref; } catch (e) { setStatus(''); toast('자료실 파일을 읽지 못했습니다: ' + e.message, true); return null; } }
window.addEventListener('focus', syncTick);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncTick(); });
setInterval(() => { if (!document.hidden) syncTick(); }, 20000);
setInterval(() => { if (store.state.dir) store.pushSettings().then(r => { if (r === 'merged') applySyncedSettings(); }).catch(() => {}); }, 4000);
// 폴더가 연결된 뒤: 설정 맞추고, 문서가 폴더 밖이면 폴더의 최근 문서를 열거나 지금 문서를 폴더에 저장
async function afterFolderReady(opts) {
  opts = opts || {};
  await syncSettings(true);
  NC.lib.load(true);
  if (store.state.handle && await store.inFolder(store.state.handle)) {
    if (opts.loadCurrent) { try { await loadDoc(await store.readFile()); } catch (e) { console.warn(e); } }
    return;
  }
  const docs = (await store.walkDocs()).sort((a, b) => b.lastModified - a.lastModified);
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
  const j = await store.openHandle(h); await loadDoc(j, msg || `"${h.name}"를 열었습니다`); warnIfRecentOther(j); updateSaveBadge(); setStatus(`연결된 파일: ${store.state.fileName}`);
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
  if (ext && mode === 'print' && ((el.type === 'image' && el.fit !== 'contain') || (el.type === 'shape' && el.kind === 'rect' && !el.radius && !el.strokeW && !el.rot))) { const b = doc.bleed || 0; if (x <= 0.3) { x -= b; w += b; } if (x + w >= doc.w - 0.3) w += b; if (y <= 0.3) { y -= b; h += b; } if (y + h >= doc.h - 0.3) h += b; }
  const base = `left:${x}mm;top:${y}mm;width:${w}mm;${el.type === 'text' && !isWarp(el) ? 'min-height' : 'height'}:${h}mm;transform:rotate(${el.rot || 0}deg);opacity:${el.opacity == null ? 1 : el.opacity};`;
  const lock = el.locked ? ' locked' : '';
  const blend = el.blend && el.blend !== 'normal' && el.type !== 'text' ? `mix-blend-mode:${el.blend};` : '';
  if (el.type === 'text') {
    if (el.warp && el.warp !== 'none') return `<div class="el el-text warp${lock}" data-id="${el.id}" style="${base}${el.blend && el.blend !== 'normal' ? `mix-blend-mode:${el.blend};` : ''}">${FX.warpSVG(el)}</div>`;
    return `<div class="el el-text${lock}" data-id="${el.id}" style="${base}${FX.textStyle(el)}">${el.html && el.htmlFor === el.text ? (el.valign && el.valign !== 'top' ? `<div class="txw">${el.html}</div>` : el.html) : esc(el.text)}</div>`;
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
  pg.els.forEach(el => { if (el.type === 'text' && !isWarp(el)) { const d = c.querySelector(`[data-id="${el.id}"]`); if (d) { const hh = fitTextH(d, el); if (hh != null) el.h = hh; } } });
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
  if (els.length > 1) { const bx = Math.min(...els.map(e => e.x)), by = Math.min(...els.map(e => e.y)), bw = Math.max(...els.map(e => e.x + e.w)) - bx, bh = Math.max(...els.map(e => e.y + e.h)) - by; h += `<div class="sel group" style="left:${bx}mm;top:${by}mm;width:${bw}mm;height:${bh}mm">${els.some(e => e.locked) ? '' : ['nw', 'ne', 'se', 'sw'].map(d => `<div class="h ${d}" data-h="${d}" data-g="1" title="함께 크기 조절 (비율 유지)"></div>`).join('')}</div>`; }
  (guides || []).forEach(g => { h += g.v != null ? `<div class="guide v" style="left:${g.v}mm"></div>` : `<div class="guide h" style="top:${g.h}mm"></div>`; });
  h += calOverlay();
  o.innerHTML = h; showCellBar();
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
function goto(i) { endEdit(); cur = clamp(i, 0, doc.pages.length - 1); sel = []; selDay = null; cellSel = null; renderAll(); }
function select(ids) { endEdit(); sel = ids.filter(id => find(id)); selDay = null; if (cellSel && !sel.includes(cellSel.id)) cellSel = null; renderOverlay(); renderInspector(); if (sideTab === 'layers') renderSide(); updateToolbarState(); }
function groupOf(id) { const el = find(id); if (!el || !el.group) return [id]; return page().els.filter(e => e.group === el.group).map(e => e.id); }
function updateToolbarState() { const n = sel.length; const g = selEls().some(e => e.group); const b = $('#btnGroup'); if (b) { b.hidden = n < 2 && !g; b.textContent = g ? '그룹 해제' : '그룹'; } const ds = $('#btnDist'); if (ds) ds.hidden = n < 3; }

/* ---- 달력 칸 편집 (일러스트레이터·인디자인 표처럼) ----
   달력을 고른 상태에서: 칸 누르기·끌기·Shift+누르기 = 칸 선택 / 칸 경계선 끌기 = 너비·높이 / 두 번 누르기 = 칸에 바로 입력
   요일 줄을 끌면 달력 전체가 움직임 */
let cellSel = null; // { id, a, b } 두 꼭짓점 칸 번호
function calGeom(el) {
  const dom = $('#canvas').querySelector(`[data-id="${el.id}"]`); if (!dom) return null;
  const k = kScale(), cr = $('#canvas').getBoundingClientRect(), mm = v => v / k / MM;
  const g = dom.querySelector('.cg'); if (!g) return null; const gr = g.getBoundingClientRect();
  const rows = CAL.calRows(el), colW = (el.colW && el.colW.length === 7) ? el.colW : Array(7).fill(1), rowH = (el.rowH && el.rowH.length === rows) ? el.rowH : Array(rows).fill(1);
  const sw = colW.reduce((a, b) => a + b, 0), sh = rowH.reduce((a, b) => a + b, 0);
  const x0 = mm(gr.left - cr.left), y0 = mm(gr.top - cr.top), W = mm(gr.width), H = mm(gr.height);
  const xs = [x0]; colW.forEach(w => xs.push(xs[xs.length - 1] + W * w / sw)); const ys = [y0]; rowH.forEach(h => ys.push(ys[ys.length - 1] + H * h / sh));
  return { rows, colW, rowH, xs, ys, x0, y0, W, H };
}
function cellRect(a, b) { const r1_ = Math.min(Math.floor(a / 7), Math.floor(b / 7)), r2 = Math.max(Math.floor(a / 7), Math.floor(b / 7)), c1 = Math.min(a % 7, b % 7), c2 = Math.max(a % 7, b % 7); return { r1: r1_, r2, c1, c2 }; }
function selCells() { if (!cellSel) return []; const { r1: ra, r2, c1, c2 } = cellRect(cellSel.a, cellSel.b); const out = []; for (let r = ra; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(r * 7 + c); return out; }
function calOverlay() {
  const el = selEls()[0]; if (!el || el.type !== 'cal' || sel.length !== 1 || el.locked) return '';
  const G = calGeom(el); if (!G) return ''; let h = '';
  if (cellSel && cellSel.id === el.id) { let { r1: ra, r2, c1, c2 } = cellRect(cellSel.a, cellSel.b); (el.merges || []).forEach(g => { const gr = Math.floor(g.c / 7), gc = g.c % 7; if (gr >= ra && gr <= r2 && gc >= c1 && gc <= c2) { r2 = Math.max(r2, gr + g.rs - 1); c2 = Math.max(c2, gc + g.cs - 1); } }); h += `<div class="csel" style="left:${G.xs[c1]}mm;top:${G.ys[ra]}mm;width:${G.xs[c2 + 1] - G.xs[c1]}mm;height:${G.ys[r2 + 1] - G.ys[ra]}mm"></div>`; }
  for (let i = 1; i < 7; i++) h += `<div class="cgl cgv" data-cgl="c${i}" style="left:${G.xs[i]}mm;top:${G.y0}mm;height:${G.H}mm" title="끌어서 열 너비 조정 · 두 번 누르면 모든 열 같게"></div>`;
  for (let i = 1; i < G.rows; i++) h += `<div class="cgl cgh" data-cgl="r${i}" style="top:${G.ys[i]}mm;left:${G.x0}mm;width:${G.W}mm" title="끌어서 행 높이 조정 · 두 번 누르면 모든 행 같게"></div>`;
  return h;
}
function cellAt(e) { const t = document.elementFromPoint(e.clientX, e.clientY); const c = t && t.closest('.el-cal .cell'); return c ? Number(c.dataset.c) : null; }
// 칸 도구 막대
function showCellBar() {
  const el = selEls()[0]; let b = $('#cellBar');
  if (!el || el.type !== 'cal' || !cellSel || cellSel.id !== el.id) { if (b) b.hidden = true; return; }
  if (!b) {
    b = document.createElement('div'); b.id = 'cellBar'; b.className = 'textbar cellbar'; document.body.appendChild(b);
    b.innerHTML = `<label title="칸 색"><input type="color" id="cbBg" value="#fff3c4"><span class="sw bgsw"></span></label><button data-cb="nobg" title="칸 색 없애기">⊘</button><span class="sep"></span>
    <label title="칸 글자 색"><input type="color" id="cbColor" value="#1f5bd6"><span class="sw">A</span></label><button data-cb="smaller" title="칸 글자 작게">가−</button><button data-cb="bigger" title="칸 글자 크게">가+</button><button data-cb="bold" title="칸 글자 굵게"><b>B</b></button>
    <span class="sep"></span><button data-cb="left" title="왼쪽 정렬">⇤</button><button data-cb="center" title="가운데 정렬">↔</button><button data-cb="right" title="오른쪽 정렬">⇥</button>
    <span class="sep"></span><button data-cb="merge" title="고른 칸 합치기">합치기</button><button data-cb="split" title="합친 칸 나누기">나누기</button><button data-cb="evenc" title="모든 열 너비 같게">열 같게</button><button data-cb="evenr" title="모든 행 높이 같게">행 같게</button>
    <span class="sep"></span><button data-cb="type" title="칸에 글자 넣기 (두 번 누르기)">✎ 입력</button><button data-cb="clear" title="고른 칸 서식·글자 지우기">지우기</button>`;
    b.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });
    b.addEventListener('click', e => { const t = e.target.closest('[data-cb]'); if (t) cellCmd(t.dataset.cb); });
    $('#cbBg').addEventListener('input', e => { cellSet({ bg: e.target.value }, true); b.querySelector('.bgsw').style.background = e.target.value; });
    $('#cbBg').addEventListener('change', () => commit());
    $('#cbColor').addEventListener('input', e => cellSet({ color: e.target.value }, true)); $('#cbColor').addEventListener('change', () => commit());
  }
  b.hidden = false;
  const G = calGeom(el); const { r1: ra, c1 } = cellRect(cellSel.a, cellSel.b); const cr = $('#canvas').getBoundingClientRect(), k = kScale();
  const px = G.xs[c1] * MM * k + cr.left, py = G.ys[ra] * MM * k + cr.top;
  b.style.left = Math.max(8, Math.min(px, innerWidth - b.offsetWidth - 8)) + 'px'; b.style.top = Math.max(60, py - b.offsetHeight - 10) + 'px';
}
function cellSet(patch, live) { const el = selEls()[0]; if (!el) return; el.cells = el.cells || {}; selCells().forEach(c0 => { const c = CAL.cellKey(el, c0); el.cells[c] = Object.assign({}, el.cells[c] || {}, patch); Object.keys(el.cells[c]).forEach(k => { if (el.cells[c][k] === undefined) delete el.cells[c][k]; }); if (!Object.keys(el.cells[c]).length) delete el.cells[c]; }); renderCanvas(); if (!live) commit(); showCellBar(); }
function cellCmd(k) {
  const el = selEls()[0]; if (!el || !cellSel) return; const s = Object.assign({}, CAL.CAL_DEF, el.s || {}); const cs = (el.cells || {})[CAL.cellKey(el, cellSel.a)] || {};
  const rows = CAL.calRows(el);
  if (k === 'nobg') cellSet({ bg: undefined });
  if (k === 'smaller' || k === 'bigger') cellSet({ size: Math.max(4, Math.round(((cs.size || s.evSize) * (k === 'bigger' ? 1.15 : 1 / 1.15)) * 2) / 2) });
  if (k === 'bold') cellSet({ bold: cs.bold ? undefined : true });
  if (k === 'left' || k === 'center' || k === 'right') cellSet({ align: k === 'left' ? undefined : k });
  if (k === 'merge') { const { r1: ra, r2, c1, c2 } = cellRect(cellSel.a, cellSel.b); if (ra === r2 && c1 === c2) { toast('합칠 칸을 두 개 이상 끌어서 고르세요'); return; } const tl = ra * 7 + c1; const box = g => { const gr = Math.floor(g.c / 7), gc = g.c % 7; return !(gr > r2 || gr + g.rs - 1 < ra || gc > c2 || gc + g.cs - 1 < c1); }; el.merges = (el.merges || []).filter(g => !box(g)); el.merges.push({ c: tl, cs: c2 - c1 + 1, rs: Math.min(rows, r2 + 1) - ra }); cellSel = { id: el.id, a: tl, b: tl }; commit(); rerender(); toast('칸을 합쳤습니다. 합친 칸 안의 날짜·일정은 그대로 함께 보입니다.'); }
  if (k === 'split') { const cs_ = selCells(); const before = (el.merges || []).length; el.merges = (el.merges || []).filter(g => !cs_.includes(g.c)); if (el.merges.length === before) toast('고른 칸에 합친 칸이 없습니다'); commit(); rerender(); }
  if (k === 'evenc') { delete el.colW; commit(); rerender(); }
  if (k === 'evenr') { delete el.rowH; commit(); rerender(); }
  if (k === 'type') openCellEditor(cellSel.a);
  if (k === 'clear') { selCells().forEach(c => { if (el.cells) delete el.cells[CAL.cellKey(el, c)]; }); commit(); rerender(); }
}
// 칸에 바로 입력: 날짜 칸은 그날 일정(한 줄에 하나), 빈 칸은 자유 글자
function openCellEditor(c, append) {
  const el = selEls()[0]; if (!el) return; closeCellEditor(true);
  const G = calGeom(el); const r = Math.floor(c / 7), q = c % 7; const g = (el.merges || []).find(x => x.c === c) || { cs: 1, rs: 1 };
  const s = Object.assign({}, CAL.CAL_DEF, el.s || {}); const first = (new Date(el.year, el.month - 1, 1).getDay() - s.weekStart + 7) % 7; const n = c - first + 1, dim = CAL.daysIn(el.year, el.month);
  const isDay = n >= 1 && n <= dim; const cs = (el.cells || {})[CAL.cellKey(el, c)] || {};
  const val = isDay ? (el.events || []).filter(e => e.d === n).map(e => e.text).join('\n') : (cs.text || '');
  const ta = document.createElement('textarea'); ta.id = 'cellEd'; ta.className = 'celled'; ta.value = val;
  ta.placeholder = isDay ? `${el.month}월 ${n}일 일정 (한 줄에 하나)` : '칸에 넣을 글자';
  ta.style.cssText = `left:${G.xs[q]}mm;top:${G.ys[r] + (isDay ? s.daySize * 0.45 : 0)}mm;width:${G.xs[Math.min(7, q + g.cs)] - G.xs[q]}mm;height:${G.ys[Math.min(G.rows, r + g.rs)] - G.ys[r] - (isDay ? s.daySize * 0.45 : 0)}mm;font-size:${cs.size || s.evSize}pt;font-family:'${s.fontBody}'`;
  ta.dataset.c = c; ta.dataset.day = isDay ? n : ''; ta.dataset.id = el.id;
  $('#canvas').appendChild(ta); ta.focus(); if (append) { if (ta.value) ta.value += '\n'; ta.setSelectionRange(ta.value.length, ta.value.length); } else ta.select();
  ta.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeCellEditor(false); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); closeCellEditor(true); } e.stopPropagation(); });
  ta.addEventListener('blur', () => closeCellEditor(true));
}
function closeCellEditor(save) {
  const ta = $('#cellEd'); if (!ta) return; ta.id = ''; const el = find(ta.dataset.id); const v = ta.value.replace(/\s+$/, ''); ta.remove(); if (!save || !el) return;
  const c = Number(ta.dataset.c), d = Number(ta.dataset.day);
  if (d) { const old = (el.events || []).filter(e => e.d === d); const lines = v ? v.split('\n').map(x => x.trim()).filter(Boolean) : []; el.events = (el.events || []).filter(e => e.d !== d).concat(lines.map((t, i) => ({ d, text: t, color: (old[i] || {}).color || '' }))); }
  else { el.cells = el.cells || {}; const kk = CAL.cellKey(el, c); el.cells[kk] = Object.assign({}, el.cells[kk] || {}, { text: v || undefined }); if (!v) delete el.cells[kk].text; if (!Object.keys(el.cells[kk]).length) delete el.cells[kk]; }
  commit(); rerender();
}

/* ---------- 포인터 조작 ---------- */
const wrap = $('#canvasWrap');
function toMM(e) { const r = $('#canvas').getBoundingClientRect(); const k = kScale(); return { x: (e.clientX - r.left) / k / MM, y: (e.clientY - r.top) / k / MM }; }
let drag = null, lastClick = null, pen = null;
wrap.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  if ($('#cellEd') && !e.target.closest('#cellEd')) closeCellEditor(true);
  if (e.target.closest('#cellEd')) return;
  if (editing) { if (e.target.closest('.el-text.editing')) return; endEdit(); }
  const p = toMM(e);
  if (tool === 'pen') { pen = { pts: [[r1(p.x), r1(p.y)]] }; $('#ovl').insertAdjacentHTML('beforeend', `<svg class="penprev" viewBox="0 0 ${doc.w} ${doc.h}" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible"><path d="" fill="none" stroke="#2f5bea" stroke-width="0.6" vector-effect="non-scaling-stroke"/></svg>`); e.preventDefault(); return; }
  const hd = e.target.closest('.ovl .h');
  if (hd && sel.length > 1 && hd.dataset.g) { const els = selEls(); const bx = Math.min(...els.map(e => e.x)), by = Math.min(...els.map(e => e.y)), bw = Math.max(...els.map(e => e.x + e.w)) - bx, bh = Math.max(...els.map(e => e.y + e.h)) - by; drag = { kind: 'gresize', dir: hd.dataset.h, start: p, box: { x: bx, y: by, w: bw, h: bh }, o: els.map(e => clone(e)), els, moved: false }; e.preventDefault(); return; }
  if (hd && sel.length === 1) { const el = find(sel[0]); drag = { kind: hd.dataset.h === 'rot' ? 'rot' : 'resize', dir: hd.dataset.h, el, start: p, o: clone(el), cx: el.x + el.w / 2, cy: el.y + el.h / 2, moved: false }; e.preventDefault(); return; }
  const gl = e.target.closest('.ovl .cgl');
  if (gl && sel.length === 1) { const el = find(sel[0]); const G = calGeom(el); const isC = gl.dataset.cgl[0] === 'c', i = Number(gl.dataset.cgl.slice(1)); drag = { kind: 'cgl', el, isC, i, G, start: p, moved: false, w0: (isC ? G.colW : G.rowH).slice() }; e.preventDefault(); return; }
  const dom = (() => { const seen = new Set(); for (const n of document.elementsFromPoint(e.clientX, e.clientY)) { const d = n.closest && n.closest('#canvas .el'); if (!d || seen.has(d)) continue; seen.add(d); const x = find(d.dataset.id); if (x && (!x.locked || sel.includes(x.id))) return d; } return null; })();
  if (dom) {
    const id = dom.dataset.id, el = find(id); const was = sel.includes(id);
    // 고른 달력의 칸 위를 누르면 칸 선택 (요일 줄을 누르면 달력 이동)
    if (el.type === 'cal' && was && !el.locked && e.target.closest('.cell')) { const c = Number(e.target.closest('.cell').dataset.c); if (e.shiftKey && cellSel && cellSel.id === id) cellSel.b = c; else cellSel = { id, a: c, b: c }; const dd = e.target.closest('.cell').dataset.day; selDay = dd ? Number(dd) : null; drag = { kind: 'cells', start: p, moved: false }; renderOverlay(); renderInspector(); e.preventDefault(); return; }
    if (!was || el.type !== 'cal') cellSel = null;
    if (el.type === 'text' && was && !el.locked && !(el.warp && el.warp !== 'none') && lastClick && lastClick.id === id && Date.now() - lastClick.t < 450) { lastClick = null; startEdit(dom, e); e.preventDefault(); return; }
    lastClick = { id, t: Date.now() };
    const ids = e.altKey ? [id] : groupOf(id);
    if (e.shiftKey) { sel = was ? sel.filter(i => !ids.includes(i)) : sel.concat(ids.filter(i => !sel.includes(i))); select(sel); }
    else if (!was) select(ids);
    if (el.type === 'cal' && was && !e.shiftKey) { const cell = e.target.closest('.cell'); if (cell && cell.dataset.day) { selDay = Number(cell.dataset.day); renderInspector(); const ds = $('#daySel'); if (ds) ds.scrollIntoView({ block: 'center' }); } }
    if (el.locked) return;
    drag = { kind: 'move', els: selEls().filter(x => !x.locked), start: p, orig: selEls().map(x => ({ id: x.id, x: x.x, y: x.y })), moved: false };
    e.preventDefault(); return;
  }
  if (!e.shiftKey) { cellSel = null; select([]); }
  drag = { kind: 'marq', start: p, moved: false, base: e.shiftKey ? sel.slice() : [] };
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
    if (o.rot) { const ux = d.includes('e') ? 0 : d.includes('w') ? 1 : 0.5, uy = d.includes('s') ? 0 : d.includes('n') ? 1 : 0.5, a = o.rot * Math.PI / 180;
      const wp = (bx, by, bw, bh) => { const cx = bx + bw / 2, cy = by + bh / 2, lx = ux * bw - bw / 2, ly = uy * bh - bh / 2; return [cx + lx * Math.cos(a) - ly * Math.sin(a), cy + lx * Math.sin(a) + ly * Math.cos(a)]; };
      const [ax0, ay0] = wp(o.x, o.y, o.w, o.h), [ax1, ay1] = wp(x, y, w, h); x += ax0 - ax1; y += ay0 - ay1; }
    el.x = r1(x); el.y = r1(y); el.w = r1(w); el.h = r1(h);
    if (el.type === 'path') { const sx = el.w / o.w, sy = el.h / o.h; el.pts = o.pts.map(pt => [r1(pt[0] * sx), r1(pt[1] * sy)]); renderCanvas(); } else if (el.type === 'text' && (d === 'e' || d === 'w')) { renderCanvas(); } else liveUpdate([el]);
    renderOverlay();
  } else if (drag.kind === 'rot') {
    const el = drag.el; let a = Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180 / Math.PI + 90; if (e.shiftKey) a = Math.round(a / 15) * 15; el.rot = Math.round(((a % 360) + 360) % 360); liveUpdate([el]); renderOverlay();
  } else if (drag.kind === 'gresize') {
    // 여러 요소를 한 상자처럼 비율 유지 확대·축소 (글자 크기·선 두께도 함께)
    const B = drag.box, d = drag.dir; const ax = d.includes('w') ? B.x + B.w : B.x, ay = d.includes('n') ? B.y + B.h : B.y;
    const nw = Math.abs(p.x - ax), nh = Math.abs(p.y - ay); const k = Math.max(0.05, Math.max(nw / B.w, nh / B.h));
    const nx = d.includes('w') ? ax - B.w * k : ax, ny = d.includes('n') ? ay - B.h * k : ay;
    drag.els.forEach((el, i) => { const o = drag.o[i]; el.x = r1(nx + (o.x - B.x) * k); el.y = r1(ny + (o.y - B.y) * k); el.w = r1(o.w * k); el.h = r1(o.h * k); if (o.size) el.size = Math.round(o.size * k * 10) / 10; if (o.strokeW) el.strokeW = Math.round(o.strokeW * k * 100) / 100; if (o.pts) el.pts = o.pts.map(q => [r1(q[0] * k), r1(q[1] * k)]); });
    renderCanvas(); renderOverlay();
  } else if (drag.kind === 'cells') {
    const c = cellAt(e); if (c != null && cellSel && c !== cellSel.b) { cellSel.b = c; renderOverlay(); }
  } else if (drag.kind === 'cgl') {
    const G = drag.G, i = drag.i, w = drag.w0.slice(), tot = w.reduce((a, b) => a + b, 0), span = drag.isC ? G.W : G.H;
    const d = (drag.isC ? dx : dy) / span * tot, mn = tot * 0.04; let a = w[i - 1] + d, b = w[i] - d; if (a < mn) { b -= mn - a; a = mn; } if (b < mn) { a -= mn - b; b = mn; }
    w[i - 1] = Math.round(a * 1000) / 1000; w[i] = Math.round(b * 1000) / 1000; drag.el[drag.isC ? 'colW' : 'rowH'] = w; renderCanvas();
  } else if (drag.kind === 'marq') {
    const x = Math.min(drag.start.x, p.x), y = Math.min(drag.start.y, p.y), w = Math.abs(dx), h = Math.abs(dy);
    const hit = page().els.filter(el => !el.hidden && !el.locked && el.x < x + w && el.x + el.w > x && el.y < y + h && el.y + el.h > y).map(el => el.id); const ids = new Set(drag.base.concat(hit)); hit.forEach(id => groupOf(id).forEach(g => ids.add(g))); sel = [...ids]; renderOverlay(); $('#ovl').insertAdjacentHTML('beforeend', `<div class="marq" style="left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm"></div>`);
  }
});
document.addEventListener('pointerup', e => {
  if (pen) { const pts = pen.pts; pen = null; const pv = $('#ovl .penprev'); if (pv) pv.remove(); if (pts.length < 3) return; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1, w = Math.max(2, Math.max(...xs) - x0 + 1), h = Math.max(2, Math.max(...ys) - y0 + 1); const el = { id: uid(), type: 'path', pts: pts.map(p => [r1(p[0] - x0), r1(p[1] - y0)]), x: r1(x0), y: r1(y0), w: r1(w), h: r1(h), rot: 0, stroke: penStyle.stroke, strokeW: penStyle.strokeW, fill: '', closed: false, smooth: true, opacity: 1, name: '펜 선' }; page().els.push(el); commit(); select([el.id]); rerender(); return; }
  if (!drag) return; const d = drag; drag = null;
  if (d.kind === 'cells') { renderInspector(); showCellBar(); return; }
  if (d.kind === 'cgl') { if (d.moved) commit(); rerender(); return; }
  if (d.kind === 'marq') { renderInspector(); if (sideTab === 'layers') renderSide(); renderOverlay(); updateToolbarState(); return; }
  if (d.moved) { commit(); rerender(); } else renderOverlay();
});
const penStyle = { stroke: '#1E2B5A', strokeW: 0.8 };
function liveUpdate(els) { const c = $('#canvas'); els.forEach(el => { const dom = c.querySelector(`[data-id="${el.id}"]`); if (!dom) return; dom.style.left = el.x + 'mm'; dom.style.top = el.y + 'mm'; dom.style.width = el.w + 'mm'; dom.style[el.type === 'text' && !isWarp(el) ? 'minHeight' : 'height'] = el.h + 'mm'; dom.style.transform = `rotate(${el.rot || 0}deg)`; }); }
function snap(x, y, w, h, selfIds) {
  const T = Math.max(0.1, 6 / (kScale() * MM)), guides = []; const xs = [0, doc.w / 2, doc.w], ys = [0, doc.h / 2, doc.h];
  page().els.forEach(el => { if (selfIds.includes(el.id) || el.hidden) return; xs.push(el.x, el.x + el.w / 2, el.x + el.w); ys.push(el.y, el.y + el.h / 2, el.y + el.h); });
  let bx = null, by = null, bdx = T, bdy = T, gx = null, gy = null;
  [[x, 0], [x + w / 2, w / 2], [x + w, w]].forEach(([v, off]) => xs.forEach(g => { const dd = Math.abs(v - g); if (dd < bdx) { bdx = dd; bx = g - off; gx = g; } }));
  [[y, 0], [y + h / 2, h / 2], [y + h, h]].forEach(([v, off]) => ys.forEach(g => { const dd = Math.abs(v - g); if (dd < bdy) { bdy = dd; by = g - off; gy = g; } }));
  if (gx != null) guides.push({ v: gx }); if (gy != null) guides.push({ h: gy });
  return { x: bx != null ? bx : x, y: by != null ? by : y, guides };
}
wrap.addEventListener('dblclick', e => {
  const gl = e.target.closest('.ovl .cgl'); if (gl) { const el = selEls()[0]; if (el) { if (gl.dataset.cgl[0] === 'c') delete el.colW; else delete el.rowH; commit(); rerender(); toast(gl.dataset.cgl[0] === 'c' ? '모든 열 너비를 같게 했습니다' : '모든 행 높이를 같게 했습니다'); } return; }
  const cell = e.target.closest('.el-cal .cell'); if (cell && sel.length === 1 && find(sel[0]).type === 'cal') { const c = Number(cell.dataset.c); cellSel = { id: sel[0], a: c, b: c }; renderOverlay(); openCellEditor(c); return; }
});
wrap.addEventListener('dblclick', e => { const dom = e.target.closest('.el-text'); if (dom && dom !== editing && !find(dom.dataset.id).locked && !dom.classList.contains('warp')) startEdit(dom, e); });
function startEdit(dom, ev) {
  if (editing === dom) return;
  editing = dom; dom.contentEditable = 'true'; dom.classList.add('editing'); dom.focus(); try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
  // 누른 자리에 커서 (새 글 상자처럼 위치가 없으면 전체 선택)
  let r = ev && document.caretRangeFromPoint ? document.caretRangeFromPoint(ev.clientX, ev.clientY) : null;
  if (!r || !dom.contains(r.startContainer)) { r = document.createRange(); r.selectNodeContents(dom); }
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); renderOverlay(); showTextBar();
}
function endEdit() {
  if (!editing) return; const dom = editing; editing = null; hideTextBar(); const el = find(dom.dataset.id);
  const t = domText(dom); const html = richHTML(dom); dom.contentEditable = 'false'; dom.classList.remove('editing');
  if (el && (t !== el.text || (html || '') !== (el.html || ''))) { el.text = t; if (html) { el.html = html; el.htmlFor = t; } else { delete el.html; delete el.htmlFor; } commit(); }
  rerender();
}
/* ---- 서식 있는 글자 (부분 굵게·기울임·밑줄·취소선·색·크기) ---- */
// 편집 상자의 실제 글자 (text-transform 대문자 등 화면 변형 없이, 줄바꿈 유지)
function domText(dom) { let out = ''; const walk = (n, first) => { if (n.nodeType === 3) { out += n.nodeValue; return; } if (n.nodeType !== 1) return; if (n.tagName === 'BR') { out += '\n'; return; } const block = /^(DIV|P|LI|H[1-6]|TR)$/.test(n.tagName); if (block && out && !out.endsWith('\n')) out += '\n'; n.childNodes.forEach(c => walk(c)); }; dom.childNodes.forEach(c => walk(c)); return out.replace(/\n+$/, ''); }
// 편집 상자 내용을 안전한 최소 마크업으로: b·i·u·s·br + span(색·크기·굵기·기울임·밑줄·취소선). 서식이 없으면 '' 반환
function richHTML(dom) {
  const out = []; let formatted = false;
  const styleOf = n => { const st = n.style || {}, o = []; const tag = n.tagName;
    const fw = st.fontWeight; if (tag === 'B' || tag === 'STRONG' || (fw && (fw === 'bold' || fw === 'bolder' || Number(fw) >= 600))) o.push('font-weight:700'); else if (fw && (fw === 'normal' || fw === 'lighter' || Number(fw) < 600)) o.push('font-weight:400');
    if (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic') o.push('font-style:italic'); else if (st.fontStyle === 'normal') o.push('font-style:normal');
    const td = (st.textDecorationLine || st.textDecoration || '') + (tag === 'U' ? ' underline' : '') + (tag === 'S' || tag === 'STRIKE' ? ' line-through' : '');
    const dec = ['underline', 'line-through'].filter(x => td.includes(x)); if (dec.length) o.push('text-decoration:' + dec.join(' '));
    if (st.color) o.push('color:' + st.color); if (tag === 'FONT' && n.getAttribute('color')) o.push('color:' + n.getAttribute('color'));
    if (st.fontSize && /pt|px|em|%/.test(st.fontSize)) o.push('font-size:' + st.fontSize);
    return o.join(';'); };
  const walk = (n, top) => {
    if (n.nodeType === 3) { out.push(esc(n.nodeValue)); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName; if (tag === 'BR') { out.push('<br>'); return; }
    const block = /^(DIV|P|LI|H[1-6]|TR|UL|OL)$/.test(tag);
    if (block && out.length && !/<br>$/.test(out[out.length - 1])) out.push('<br>');
    const st = block ? '' : styleOf(n); if (st) { formatted = true; out.push(`<span style="${st}">`); }
    n.childNodes.forEach(c => walk(c));
    if (st) out.push('</span>');
  };
  dom.childNodes.forEach(c => walk(c, true));
  let h = out.join('').replace(/(<br>)+$/, ''); return formatted ? h : '';
}
// 상자 전체에 켜고 끌 때, 부분 서식 중 같은 속성은 지움
function stripRich(el, prop) { if (!el.html) return; const d = document.createElement('div'); d.innerHTML = el.html; d.querySelectorAll('span').forEach(sp => { if (prop === 'bold') sp.style.fontWeight = ''; if (prop === 'italic') sp.style.fontStyle = ''; if (prop === 'underline' || prop === 'strike') { const keep = (sp.style.textDecoration || '').split(' ').filter(x => x && x !== (prop === 'underline' ? 'underline' : 'line-through')); sp.style.textDecoration = keep.join(' '); } if (prop === 'color') sp.style.color = ''; if (prop === 'size') sp.style.fontSize = ''; }); const h = richHTML(d); if (h) el.html = h; else { delete el.html; delete el.htmlFor; } }
const FMT_CMD = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough' };
// B·I·U·S: 편집 중이면 고른 글자만, 아니면 상자 전체
function toggleFmt(kind) {
  if (editing) { document.execCommand(FMT_CMD[kind], false, null); updTextBar(); return; }
  const els = selEls().filter(x => x.type === 'text'); if (!els.length) return;
  const on = !fmtOn(els[0], kind);
  els.forEach(el => { if (kind === 'bold') el.weight = on ? 700 : 400; else el[kind] = on; stripRich(el, kind); });
  commit(); rerender();
}
function fmtOn(el, kind) { return kind === 'bold' ? Number(el.weight) >= 600 : !!el[kind]; }
function showTextBar() {
  let b = $('#textBar'); if (!b) { b = document.createElement('div'); b.id = 'textBar'; b.className = 'textbar'; document.body.appendChild(b);
    b.innerHTML = `<button data-tf="bold" title="굵게 (Ctrl+B)"><b>B</b></button><button data-tf="italic" title="기울임 (Ctrl+I)"><i>I</i></button><button data-tf="underline" title="밑줄 (Ctrl+U)"><u>U</u></button><button data-tf="strike" title="취소선"><s>S</s></button><span class="sep"></span><label title="고른 글자 색"><input type="color" id="tbColor" value="#e0564b"><span class="sw"></span></label><button data-tf="smaller" title="고른 글자 작게">가−</button><button data-tf="bigger" title="고른 글자 크게">가+</button><span class="sep"></span><button data-tf="clear" title="고른 글자 서식 지우기">서식 지우기</button>`;
    b.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });
    b.addEventListener('click', e => { const t = e.target.closest('[data-tf]'); if (!t || !editing) return; const k = t.dataset.tf;
      if (FMT_CMD[k]) toggleFmt(k);
      else if (k === 'clear') { document.execCommand('removeFormat', false, null); updTextBar(); }
      else sizeSel(k === 'bigger' ? 1.2 : 1 / 1.2); });
    $('#tbColor').addEventListener('input', e => { if (!editing) return; editing.focus(); restoreSel(); document.execCommand('foreColor', false, e.target.value); saveSel(); b.querySelector('.sw').style.background = e.target.value; });
    $('#tbColor').addEventListener('change', () => { if (editing) { editing.focus(); restoreSel(); } });
    $('#tbColor').addEventListener('mousedown', () => saveSel());
  }
  b.hidden = false; placeTextBar(); updTextBar();
}
let savedRange = null; function saveSel() { const s = getSelection(); if (s.rangeCount) savedRange = s.getRangeAt(0).cloneRange(); } function restoreSel() { if (!savedRange) return; const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
function hideTextBar() { const b = $('#textBar'); if (b) b.hidden = true; }
function placeTextBar() { const b = $('#textBar'); if (!b || !editing) return; const r = editing.getBoundingClientRect(); b.style.left = Math.max(8, Math.min(r.left, innerWidth - b.offsetWidth - 8)) + 'px'; b.style.top = Math.max(60, r.top - b.offsetHeight - 10) + 'px'; }
function updTextBar() { const b = $('#textBar'); if (!b || !editing) return; Object.entries(FMT_CMD).forEach(([k, c]) => { const x = b.querySelector(`[data-tf="${k}"]`); try { x.classList.toggle('on', document.queryCommandState(c)); } catch (e) {} }); $$('#inspector [data-tfi]').forEach(x => { try { x.classList.toggle('on', document.queryCommandState(FMT_CMD[x.dataset.tfi])); } catch (e) {} }); }
document.addEventListener('selectionchange', () => { if (editing) updTextBar(); });
// 편집 중이 아닐 때 Ctrl+B·I·U는 고른 글 상자 전체에
document.addEventListener('keydown', e => { if (editing || !(e.ctrlKey || e.metaKey) || (e.target.matches && e.target.matches('input,textarea,select')) || document.querySelector('dialog[open]')) return; const k = { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]; if (k && selEls().some(x => x.type === 'text')) { e.preventDefault(); toggleFmt(k); } }, true);
// 고른 글자 크기 바꾸기: 임시 font 태그로 감싼 뒤 pt 크기 span으로 바꿈
function sizeSel(f) {
  const el = find(editing.dataset.id); if (!el) return; const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) { toast('크기를 바꿀 글자를 먼저 드래그해 고르세요'); return; }
  const n0 = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
  const curPt = n0 ? parseFloat(getComputedStyle(n0).fontSize) * 0.75 : el.size;
  document.execCommand('styleWithCSS', false, false); document.execCommand('fontSize', false, '7'); document.execCommand('styleWithCSS', false, true);
  editing.querySelectorAll('font[size="7"]').forEach(fn => { const sp = document.createElement('span'); sp.style.fontSize = (Math.round(Math.max(4, curPt * f) * 2) / 2) + 'pt'; while (fn.firstChild) sp.appendChild(fn.firstChild); fn.replaceWith(sp); });
  editing.dispatchEvent(new Event('input', { bubbles: true }));
}
// 글 상자 높이 맞추기: 위쪽 정렬이면 내용 높이로(늘고 줄어듦), 중앙·아래 정렬이면 내용보다 작을 때만 늘림
function fitTextH(d, el) { const mh = d.style.minHeight; d.style.minHeight = '0'; const ch = r1(d.offsetHeight / MM); d.style.minHeight = mh; const top = !el.valign || el.valign === 'top'; if (top ? Math.abs(ch - el.h) > 0.05 : ch > el.h + 0.05) return Math.max(2, ch); return null; }
$('#canvas').addEventListener('input', e => { if (editing && e.target === editing) { const el = find(editing.dataset.id); if (el) { const hh = fitTextH(editing, el); if (hh != null) { el.h = hh; editing.style.minHeight = hh + 'mm'; renderOverlay(); placeTextBar(); } } } });
// 붙여넣기는 글자만 (다른 곳 서식·글꼴이 섞여 들어오지 않게)
$('#canvas').addEventListener('paste', e => { if (!editing || !editing.contains(e.target)) return; e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
$('#canvas').addEventListener('blur', e => { if (editing && e.target === editing && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#textBar'))) endEdit(); }, true);
// 확대·축소는 마우스 위치를 기준으로 (그 점이 화면에서 움직이지 않게)
function zoomAt(nk, cx, cy) {
  const sc = $('#scroller'), cr = $('#canvas').getBoundingClientRect(), k0 = kScale();
  const sr = sc.getBoundingClientRect(); if (cx == null) { cx = sr.left + sr.width / 2; cy = sr.top + sr.height / 2; }
  const px = (cx - cr.left) / k0, py = (cy - cr.top) / k0;  // 확대 전 캔버스 좌표(px)
  zoom = clamp(nk, 0.1, 8); fitCanvas();
  const cr2 = $('#canvas').getBoundingClientRect(); sc.scrollLeft += (cr2.left + px * zoom) - cx; sc.scrollTop += (cr2.top + py * zoom) - cy;
}
$('#scroller').addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoomAt((zoom || kScale()) * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY); }, { passive: false });
// Space를 누른 채 끌면 화면 이동 (손 도구)
let spaceDown = false, panDrag = null;
document.addEventListener('keydown', e => { if (e.code === 'Space' && !editing && !$('#cellEd') && !(e.target.matches && e.target.matches('input,textarea,select,[contenteditable="true"]')) && !document.querySelector('dialog[open]')) { if (!spaceDown) { spaceDown = true; $('#stage').classList.add('panning'); } e.preventDefault(); } });
document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; $('#stage').classList.remove('panning', 'grabbing'); } });
$('#scroller').addEventListener('pointerdown', e => { if (!spaceDown) return; e.preventDefault(); e.stopPropagation(); const sc = $('#scroller'); panDrag = { x: e.clientX, y: e.clientY, sl: sc.scrollLeft, st: sc.scrollTop }; $('#stage').classList.add('grabbing'); }, true);
document.addEventListener('pointermove', e => { if (!panDrag) return; const sc = $('#scroller'); sc.scrollLeft = panDrag.sl - (e.clientX - panDrag.x); sc.scrollTop = panDrag.st - (e.clientY - panDrag.y); });
document.addEventListener('pointerup', () => { if (panDrag) { panDrag = null; $('#stage').classList.remove('grabbing'); } });
// Ctrl+0 화면에 맞춤 · Ctrl+1 실제 크기(100%) · Ctrl+= 확대 · Ctrl+- 축소
document.addEventListener('keydown', e => { if (!(e.ctrlKey || e.metaKey) || e.altKey || (e.target.matches && e.target.matches('input,textarea,select')) || document.querySelector('dialog[open]')) return; const k = e.key; if (k === '0') { e.preventDefault(); zoom = 0; fitCanvas(); } else if (k === '1') { e.preventDefault(); zoomAt(1); } else if (k === '=' || k === '+') { e.preventDefault(); zoomAt((zoom || kScale()) * 1.25); } else if (k === '-') { e.preventDefault(); zoomAt((zoom || kScale()) / 1.25); } }, true);
$('#zoomIn').onclick = () => zoomAt((zoom || kScale()) * 1.2);
$('#zoomOut').onclick = () => zoomAt((zoom || kScale()) / 1.2);
$('#zoomFit').onclick = () => { zoom = 0; fitCanvas(); };
$('#prevPage').onclick = () => goto(cur - 1); $('#nextPage').onclick = () => goto(cur + 1);
window.addEventListener('resize', () => { fitCanvas(); renderThumbs(); });
function setTool(t) { tool = t; $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); $('#stage').classList.toggle('pen', t === 'pen'); if (t === 'pen') { select([]); toast('펜: 페이지 위에서 끌어 선을 그립니다. Esc로 끝냅니다.'); } }
$$('[data-tool]').forEach(b => b.onclick = () => setTool(tool === b.dataset.tool ? 'select' : b.dataset.tool));

document.addEventListener('keydown', e => {
  if (editing) { if (e.key === 'Escape') { e.preventDefault(); endEdit(); } return; }
  if ((e.target.matches && e.target.matches('input,textarea,select')) || document.querySelector('dialog[open]')) return;
  const mod = e.ctrlKey || e.metaKey;
  // 달력 칸이 골라져 있을 때: Delete=칸 글자·서식 지우기, Esc=칸 선택 해제, 글자 입력=칸에 바로 쓰기
  if (cellSel && sel.length === 1 && sel[0] === cellSel.id) {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); cellCmd('clear'); return; }
    if (e.key === 'Escape') { e.preventDefault(); cellSel = null; renderOverlay(); return; }
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); openCellEditor(cellSel.a); return; }
    if (!mod && !e.altKey && (e.key.length === 1 || e.key === 'Process' || e.isComposing) && e.code !== 'Space') { openCellEditor(cellSel.a, true); return; }
    if (e.key.startsWith('Arrow') && !e.shiftKey) { e.preventDefault(); const el = find(cellSel.id), rows = CAL.calRows(el); let c = cellSel.b; if (e.key === 'ArrowLeft') c = Math.max(0, c - 1); if (e.key === 'ArrowRight') c = Math.min(rows * 7 - 1, c + 1); if (e.key === 'ArrowUp') c = Math.max(0, c - 7); if (e.key === 'ArrowDown') c = Math.min(rows * 7 - 1, c + 7); cellSel = { id: cellSel.id, a: c, b: c }; renderOverlay(); return; }
    if (e.key.startsWith('Arrow') && e.shiftKey) { e.preventDefault(); const el = find(cellSel.id), rows = CAL.calRows(el); let c = cellSel.b; if (e.key === 'ArrowLeft') c = Math.max(0, c - 1); if (e.key === 'ArrowRight') c = Math.min(rows * 7 - 1, c + 1); if (e.key === 'ArrowUp') c = Math.max(0, c - 7); if (e.key === 'ArrowDown') c = Math.min(rows * 7 - 1, c + 7); cellSel.b = c; renderOverlay(); return; }
  }
  if (e.key === 'Escape') { if (tool !== 'select') setTool('select'); else select([]); return; }
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
  if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); toggleGroup(); return; }
  if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) { e.preventDefault(); reorder(e.code === 'BracketRight' ? (e.shiftKey ? 'front' : 'up') : (e.shiftKey ? 'back' : 'down')); return; }
  if (mod && (e.code === 'KeyC' || e.code === 'KeyX')) { if (sel.length) { const els = clone(selEls()); const assets = {}; const walk = v => { if (typeof v === 'string' && v.startsWith('a:') && doc.assets[v.slice(2)]) assets[v] = doc.assets[v.slice(2)]; else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(els); clip = { els, assets, page: cur, n: 0 }; if (e.code === 'KeyX') { removeSel(); toast('잘라냈습니다'); } else toast('복사했습니다'); } return; }
  if (mod && e.code === 'KeyV') { if (clip && clip.els) { e.preventDefault(); const inPlace = e.shiftKey || clip.page !== cur; if (!inPlace) clip.n++; const off = inPlace ? 0 : 5 * clip.n; const amap = {}; Object.entries(clip.assets).forEach(([ref, data]) => { amap[ref] = addAsset(data); }); const gmap = {}; const swap = v => { if (typeof v === 'string' && amap[v]) return amap[v]; if (Array.isArray(v)) return v.map(swap); if (v && typeof v === 'object') { for (const k in v) v[k] = swap(v[k]); } return v; }; const ids = clip.els.map(el => { const n = swap(clone(el)); n.id = uid(); delete n.gen; if (n.group) { gmap[n.group] = gmap[n.group] || uid(); n.group = gmap[n.group]; } n.x = r1(n.x + off); n.y = r1(n.y + off); page().els.push(n); return n.id; }); commit(); select(ids); rerender(); } return; }
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); select(page().els.filter(x => !x.hidden && !x.locked).map(x => x.id)); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.length) { e.preventDefault(); removeSel(); } return; }
  // 선택한 요소가 없으면 ↑↓(←→)로 페이지를 이동 (페이지 목록에서 고른 뒤 계속 넘기기)
  if (e.key.startsWith('Arrow') && !sel.length) { e.preventDefault(); goto(cur + (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1)); const t = document.querySelector(`#thumbs .thumb[data-i="${cur}"]`); if (t) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  if (e.key.startsWith('Arrow')) { if (!sel.length) return; e.preventDefault(); const d = e.altKey ? 0.1 : e.shiftKey ? 5 : 1; selEls().forEach(el => { if (el.locked) return; if (e.key === 'ArrowLeft') el.x = r1(el.x - d); if (e.key === 'ArrowRight') el.x = r1(el.x + d); if (e.key === 'ArrowUp') el.y = r1(el.y - d); if (e.key === 'ArrowDown') el.y = r1(el.y + d); }); commitSoon(); rerender(); return; }
  if (e.key === 'PageDown') goto(cur + 1); if (e.key === 'PageUp') goto(cur - 1);
  if (e.code === 'KeyP' && !mod && !e.altKey) setTool(tool === 'pen' ? 'select' : 'pen');
  if (e.code === 'KeyT' && !mod && !e.altKey) addText('b');
});
function removeSel() { const lk = selEls().filter(el => el.locked).length; page().els = page().els.filter(el => !sel.includes(el.id) || el.locked); sel = []; commit(); rerender(); if (lk) toast(`잠긴 요소 ${lk}개는 지우지 않았습니다 (잠금을 풀고 지우세요)`); }
function duplicate() { if (!sel.length) return; const gmap = {}; const ids = selEls().map(el => { const n = clone(el); n.id = uid(); delete n.gen; if (n.group) { gmap[n.group] = gmap[n.group] || uid(); n.group = gmap[n.group]; } n.x += 5; n.y += 5; page().els.push(n); return n.id; }); commit(); select(ids); rerender(); }
function toggleGroup() { const els = selEls(); if (!els.length) return; if (els.some(e => e.group)) { els.forEach(e => delete e.group); toast('그룹을 해제했습니다'); } else if (els.length > 1) { const g = uid(); els.forEach(e => e.group = g); toast('그룹으로 묶었습니다'); } commit(); select(els.map(e => e.id)); }
function reorder(how) {
  if (!sel.length) return; const ids = new Set(); selEls().forEach(e => { ids.add(e.id); if (e.group) page().els.forEach(x => { if (x.group === e.group) ids.add(x.id); }); });
  const els = page().els; const picked = els.filter(e => ids.has(e.id)), rest = els.filter(e => !ids.has(e.id));
  if (how === 'front') page().els = rest.concat(picked); else if (how === 'back') page().els = picked.concat(rest);
  else { // 고른 덩어리를 바로 위(아래)의 다른 요소 하나 너머로
    const idx = els.map((e, i) => ids.has(e.id) ? i : -1).filter(i => i >= 0); const lo = Math.min(...idx), hi = Math.max(...idx);
    const at = how === 'up' ? rest.findIndex((e, i) => els.indexOf(e) > hi) : (() => { let k = -1; rest.forEach((e, i) => { if (els.indexOf(e) < lo) k = i; }); return k; })();
    if (at < 0) return; const pos = how === 'up' ? at + 1 : at; page().els = rest.slice(0, pos).concat(picked, rest.slice(pos));
  }
  commit(); rerender();
}
$('#btnDup').onclick = duplicate; $('#btnDel').onclick = removeSel; $('#btnGroup').onclick = toggleGroup;
$('#btnFront').onclick = () => reorder('front'); $('#btnBack').onclick = () => reorder('back'); $('#btnUp').onclick = () => reorder('up'); $('#btnDown').onclick = () => reorder('down');
// 고른 요소를 '덩어리'로: 그룹은 하나로 묶고, 잠긴 요소는 빼고
function selUnits() {
  const m = new Map(); selEls().filter(e => !e.locked).forEach(e => { const k = e.group || e.id; if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
  return [...m.values()].map(els => { const x = Math.min(...els.map(e => e.x)), y = Math.min(...els.map(e => e.y)); return { els, x, y, w: Math.max(...els.map(e => e.x + e.w)) - x, h: Math.max(...els.map(e => e.y + e.h)) - y }; });
}
function moveUnit(u, nx, ny) { const dx = r1(nx - u.x), dy = r1(ny - u.y); u.els.forEach(e => { e.x = r1(e.x + dx); e.y = r1(e.y + dy); }); u.x += dx; u.y += dy; }
$$('[data-align]').forEach(b => b.onclick = () => {
  const units = selUnits(); if (!units.length) return; const a = b.dataset.align;
  let bx = 0, by = 0, bw = doc.w, bh = doc.h;
  if (units.length > 1) { bx = Math.min(...units.map(u => u.x)); by = Math.min(...units.map(u => u.y)); bw = Math.max(...units.map(u => u.x + u.w)) - bx; bh = Math.max(...units.map(u => u.y + u.h)) - by; }
  units.forEach(u => { let nx = u.x, ny = u.y; if (a === 'l') nx = bx; if (a === 'c') nx = bx + (bw - u.w) / 2; if (a === 'r') nx = bx + bw - u.w; if (a === 't') ny = by; if (a === 'm') ny = by + (bh - u.h) / 2; if (a === 'b') ny = by + bh - u.h; moveUnit(u, nx, ny); });
  commit(); rerender();
});
$('#btnDist').onclick = () => { const units = selUnits(); if (units.length < 3) { toast('간격을 맞추려면 세 개 이상(그룹은 하나로 셈) 고르세요'); return; } const horiz = (Math.max(...units.map(u => u.x + u.w)) - Math.min(...units.map(u => u.x))) >= (Math.max(...units.map(u => u.y + u.h)) - Math.min(...units.map(u => u.y))); const k = horiz ? 'x' : 'y', sz = horiz ? 'w' : 'h'; const sorted = units.slice().sort((a, b) => a[k] - b[k]); const first = sorted[0], last = sorted[sorted.length - 1]; const span = (last[k] + last[sz]) - first[k]; const total = sorted.reduce((a, u) => a + u[sz], 0); const gap = (span - total) / (sorted.length - 1); let pos = first[k]; sorted.forEach(u => { moveUnit(u, horiz ? pos : u.x, horiz ? u.y : pos); pos += u[sz] + gap; }); commit(); rerender(); };
$('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;

/* ---------- 요소 추가 ---------- */
const TEXT_DEF = Object.assign({ type: 'text', text: '글자를 입력하세요', x: 20, y: 20, w: 80, h: 10, rot: 0, font: 'Noto Sans KR', size: 14, weight: 400, italic: false, color: '#1a1a1a', align: 'left', lh: 1.3, ls: 0, strokeW: 0, strokeC: '#ffffff', shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, FX.TEXT_FX_DEF);
function addEl(el, at) { el.id = el.id || uid(); delete el.gen; if (at !== false) { el.x = r1(clamp((doc.w - el.w) / 2, 0, doc.w)); el.y = r1(clamp((doc.h - el.h) / 2, 0, doc.h)); } page().els.push(el); commit(); select([el.id]); rerender(); return el; }
function addEls(els, name) { if (!els.length) return; els.forEach(e => delete e.gen); const xs = els.map(e => e.x), ys = els.map(e => e.y); const bw = Math.max(...els.map(e => e.x + e.w)) - Math.min(...xs), bh = Math.max(...els.map(e => e.y + e.h)) - Math.min(...ys); const ox = r1(clamp((doc.w - bw) / 2, 0, doc.w)) - Math.min(...xs), oy = r1(clamp((doc.h - bh) / 2, 0, doc.h)) - Math.min(...ys); const g = els.length > 1 ? uid() : null; els.forEach(e => { e.id = e.id || uid(); e.x = r1(e.x + ox); e.y = r1(e.y + oy); if (g) e.group = g; page().els.push(e); }); commit(); select(els.map(e => e.id)); rerender(); noteRecentElem(name); }
function addText(preset, st) { const base = Object.assign({}, TEXT_DEF, lastTextStyle || {}); const p = preset === 'h' ? { text: '제목을 입력하세요', size: 36, weight: 700, w: 120, h: 16 } : preset === 's' ? { text: '부제목을 입력하세요', size: 20, weight: 500, w: 100, h: 10 } : { text: '본문 글을 입력하세요', size: 12, weight: 400, w: 90, h: 8 }; const el = addEl(Object.assign(base, p, st || {})); setTimeout(() => { const d = $(`#canvas [data-id="${el.id}"]`); if (d && !(el.warp && el.warp !== 'none')) startEdit(d); }, 50); return el; }
function addShape(kind, st) { const def = { type: 'shape', kind, x: 0, y: 0, w: 40, h: kind === 'line' ? 4 : 40, rot: 0, fill: kind === 'line' ? '#333333' : '#F0716B', stroke: '', strokeW: kind === 'line' ? 0.6 : 0, radius: 0, opacity: 1, name: '' }; if (kind === 'line') def.w = 80; if (kind === 'polygon') def.sides = 6; addEl(Object.assign(def, st || {})); }
function addImage(ref) { const el = { type: 'image', src: ref, x: 0, y: 0, w: 60, h: 60, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }; const s = src(ref); if (s) { const i = new Image(); i.onload = () => { const ar = i.naturalWidth / i.naturalHeight; el.w = Math.min(80, doc.w * 0.6); el.h = r1(el.w / ar); if (el.h > doc.h * 0.8) { el.h = r1(doc.h * 0.8); el.w = r1(el.h * ar); } el.x = r1((doc.w - el.w) / 2); el.y = r1((doc.h - el.h) / 2); rerender(); amendCommit(); }; i.src = s; } addEl(el); }
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
    ${libPhotoHTML()}
    ${groups.map(([t, f]) => { const ks = Object.keys(ASSETS).filter(f); return `<h3>${t}</h3><div class="picker">${ks.map(k => `<button data-img="asset:${k}" title="${k}"><img src="${ASSETS[k]}" alt="${k}"></button>`).join('')}</div>`; }).join('')}`;
    body.onclick = async e => {
      const pc = e.target.closest('[data-pcat]'); if (pc) { photoCat = pc.dataset.pcat; renderSide(); return; }
      const b = e.target.closest('[data-img],[data-libimg]'); if (!b) return;
      const ref = b.dataset.libimg ? await libInsert(b.dataset.libimg) : b.dataset.img; if (!ref) return;
      const s = selEls(); if (s.length === 1 && s[0].type === 'image') { s[0].src = ref; commit(); rerender(); toast('그림을 바꿨습니다'); } else addImage(ref);
    };
    const ps = $('#photoSearch'); if (ps) ps.oninput = () => { photoQ = ps.value; const pos = ps.selectionStart; renderSide(); const n = $('#photoSearch'); n.focus(); n.setSelectionRange(pos, pos); };
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
    body.onclick = e => { const b = e.target.closest('[data-pj]'); if (!b) return; const k = b.dataset.pj; if (k === 'save') openSaveDialog(); if (k === 'open') $('#btnOpen').click(); if (k === 'new') $('#btnNew').click(); if (k === 'down') { gcAssets(); store.download(doc); } if (k === 'pdf') openDownload('pdfhq'); if (k === 'png') openDownload('png'); if (k === 'hol') openHoliday(); if (k === 'rules') openRules(); };
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
function elemCard(it) { const els = it.make(uid, { year: doc.calendar.year || 2027 }); return `<button class="ecard" data-el="${it.id}" title="${esc(it.name)}"><div class="ebox" data-w="${it.w}" data-h="${it.h}">${tmpSheet(it.w, it.h, els, it.dark ? '#002559' : it.cat === 'icon' || it.cat === 'illust' || it.cat === 'naracha' ? 'transparent' : '#ffffff')}</div>${it.cat === 'icon' ? '' : `<span>${esc(it.name)}</span>`}</button>`; }
const LIB_ECATS = [['cartoon', '태권도 캐릭터 (만화)'], ['aiimg', 'AI로 만든 그림'], ['pose', '태권도 포즈 (사진)'], ['pair', '겨루기 · 두 사람'], ['silhouette', '동작 실루엣'], ['illust', '태권도 일러스트'], ['mascot', '마스코트 라차'], ['logo', '로고'], ['emblem', '엠블럼·패치'], ['belt', '띠·라벨'], ['pattern', '패턴·장식']];
function libElemItems() {
  return NC.lib.items('element').map(it => { const w = it.ratio >= 1 ? 60 : Math.round(60 * it.ratio), h = it.ratio >= 1 ? Math.round(60 / it.ratio) : 60;
    return { id: 'lib-' + it.id, cat: 'naracha', sub: it.cat, name: it.name, kw: '나라차 자료실 ' + it.kw, w: Math.max(w, 4), h: Math.max(h, 4), dark: it.dark, lib: it,
      make: (uid) => [{ id: uid(), type: 'image', src: 'lib:' + it.file, x: 0, y: 0, w: Math.max(w, 4), h: Math.max(h, 4), rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: it.name }] }; });
}
function libHint(short) { const st = NC.lib.st; const msg = store.state.dir ? (st.error === 'none' ? '동기화 폴더에 "디자인자료" 폴더가 없습니다.' : st.ready ? '' : '나라차 자료실을 불러오는 중…') : '저장·동기화에서 구글 드라이브 폴더를 연결하면 나라차 로고·마스코트·사진·템플릿(나라차 자료실)이 여기에 나옵니다.'; return msg ? `<p class="hint">${short ? '<b>나라차 자료실</b> · ' : ''}${msg}</p>` : ''; }
function getElem(id) { return NC.elems.get(id) || libElemItems().find(x => x.id === id); }
async function insertElem(id) { const it = getElem(id); if (!it) return; let els = it.make(uid, { year: doc.calendar.year || 2027 }); if (it.lib) { setStatus('자료실에서 불러오는 중…'); try { els = await NC.lib.materialize(els, addAsset); } catch (e) { toast('자료실 파일을 읽지 못했습니다: ' + e.message, true); return; } finally { setStatus(''); } } addEls(els, it.id); }
function renderElems() {
  const body = $('#sidebody'); const q = elQ.trim().toLowerCase();
  const libEls = libElemItems(); const cats = NC.elems.cats.slice(0, 1).concat([['naracha', '나라차']], NC.elems.cats.slice(1));
  const all = libEls.concat(NC.elems.items).filter(i => !q || (i.name + ' ' + i.kw).toLowerCase().includes(q));
  const recent = recentElems().map(getElem).filter(Boolean);
  let h = `<label class="f"><input type="text" id="elSearch" placeholder="요소 검색 (예: 로고, 라차, 별, 말풍선)" value="${esc(elQ)}"></label><div class="tcats" id="elcats">${cats.map(([k, t]) => `<button data-ec="${k}" class="${elCat === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  if (elCat === 'naracha' && !q) {
    h += libEls.length ? `<div class="row" style="margin:4px 0 2px"><button class="btn sm ai" data-aistudio>✨ AI로 태권도 그림 만들기</button></div><p class="hint">사진 포즈는 배경을 지운 사람만 들어갑니다. 실루엣은 이미지 속성의 "색 입히기"로 색을 바꿀 수 있습니다. AI로 만든 그림은 우클릭으로 이름 바꾸기·삭제를 합니다.</p>` + LIB_ECATS.map(([k, t]) => { const list = libEls.filter(i => i.sub === k); return list.length ? `<h3>${t} <small>${list.length}</small></h3><div class="egrid">${list.map(elemCard).join('')}</div>` : ''; }).join('') : libHint();
  } else if (elCat === 'all' && !q) {
    if (recent.length) h += `<h3>최근 사용</h3><div class="egrid">${recent.map(elemCard).join('')}</div>`;
    h += libEls.length ? `<div class="esec"><h3>나라차 자료실 <small>${libEls.length}</small></h3><button class="more" data-ec="naracha">더보기 ›</button></div><div class="egrid">${['cartoon', 'pose', 'illust', 'mascot', 'silhouette'].flatMap(k => libEls.filter(i => i.sub === k).slice(0, k === 'cartoon' ? 3 : 2)).slice(0, 9).map(elemCard).join('')}</div>` : libHint(true);
    NC.elems.cats.slice(1).forEach(([k, t]) => { const list = all.filter(i => i.cat === k); if (!list.length) return; h += `<div class="esec"><h3>${t} <small>${list.length}</small></h3><button class="more" data-ec="${k}">더보기 ›</button></div><div class="egrid ${k === 'icon' ? 'icons' : ''}">${list.slice(0, k === 'icon' ? 16 : 6).map(elemCard).join('')}</div>`; });
  } else {
    const list = all.filter(i => elCat === 'all' || i.cat === elCat);
    h += `<p class="hint" style="margin:4px 0">${list.length}개</p><div class="egrid ${elCat === 'icon' ? 'icons' : ''}">${list.map(elemCard).join('') || '<p class="hint">맞는 요소가 없습니다</p>'}</div>`;
  }
  h += `<p class="hint" style="margin-top:12px">요소를 누르면 페이지 가운데에 들어갑니다. 여러 조각으로 된 요소는 자동으로 그룹이 되어 함께 움직입니다 (Ctrl+G로 그룹 해제·묶기).</p>`;
  body.innerHTML = h;
  requestAnimationFrame(() => fitBoxes(body, '.ebox', 64));
  body.onclick = e => { if (e.target.closest('[data-aistudio]')) { openAI('image'); return; } const c = e.target.closest('[data-ec]'); if (c) { elCat = c.dataset.ec; renderElems(); return; } const b = e.target.closest('[data-el]'); if (b) insertElem(b.dataset.el); };
  // 내 그림(AI로 만든 그림): 우클릭으로 이름 바꾸기·지우기
  body.oncontextmenu = async e => { const b = e.target.closest('[data-el^="lib-ai-"]'); if (!b) return; e.preventDefault(); const it = getElem(b.dataset.el); if (!it) return;
    const nm = window.prompt(`"${it.name}"\n\n새 이름을 넣으면 이름을 바꿉니다. "삭제"라고 쓰면 내 그림에서 지웁니다 (두 PC 모두에서 사라짐).`, it.name); if (nm == null) return;
    try { if (nm.trim() === '삭제') { await NC.lib.removeMine(it.lib.id); toast('내 그림에서 지웠습니다'); } else if (nm.trim()) { await NC.lib.renameMine(it.lib.id, nm.trim()); toast('이름을 바꿨습니다'); } renderElems(); } catch (err) { toast(err.message, true); } };
  let tq; $('#elSearch').oninput = e => { elQ = e.target.value; clearTimeout(tq); tq = setTimeout(() => { renderElems(); const i = $('#elSearch'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
}
function elName(el) { if (el.name) return el.name; if (el.type === 'text') return (el.text || '글자').split('\n')[0].slice(0, 20); if (el.type === 'image') return '이미지'; if (el.type === 'shape') return (FX.SHAPES.find(s => s[0] === el.kind) || [])[1] || '도형'; if (el.type === 'path') return '펜 선'; if (el.type === 'chart') return '차트'; if (el.type === 'cal') return `${el.year}년 ${el.month}월 달력`; if (el.type === 'mini') return `미니 달력 ${el.month}월`; return el.type; }

/* ---- 사진: 나라차 자료실 ---- */
let photoCat = '', photoQ = '';
function libPhotoHTML() {
  const ph = NC.lib.items('photo'); if (!ph.length) return libHint(true);
  const cats = [...new Set(ph.map(x => x.cat))];
  const q = photoQ.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = ph.filter(x => (!photoCat || x.cat === photoCat) && (!q.length || q.every(w => (x.name + ' ' + x.kw).toLowerCase().includes(w))));
  const card = x => `<button data-libimg="${esc(x.file)}" title="${esc(x.name)}"><img src="${NC.lib.url(x.thumb)}" alt="${esc(x.name)}" loading="lazy"></button>`;
  let h = `<h3>나라차 자료실 사진 <small>${ph.length}</small></h3><label class="f"><input type="text" id="photoSearch" placeholder="사진 검색 (예: 겨루기, 아이, 도장)" value="${esc(photoQ)}"></label>
  <div class="tcats"><button data-pcat="" class="${photoCat ? '' : 'on'}">전체</button>${cats.map(c => `<button data-pcat="${esc(c)}" class="${photoCat === c ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>`;
  if (!photoCat && !q.length) cats.forEach(c => { const l = list.filter(x => x.cat === c); h += `<div class="esec"><h3>${esc(c)} <small>${l.length}</small></h3><button class="more" data-pcat="${esc(c)}">더보기 ›</button></div><div class="picker photos">${l.slice(0, 6).map(card).join('')}</div>`; });
  else h += `<p class="hint" style="margin:4px 0">${list.length}장</p><div class="picker photos">${list.map(card).join('') || '<p class="hint">맞는 사진이 없습니다</p>'}</div>`;
  return h + '<p class="hint">사진을 누르면 원본 크기(최대 2400px)로 문서에 들어갑니다. 게티이미지 사진은 도장 홍보물에만 쓰세요.</p>';
}

/* ---- 템플릿 갤러리 ---- */
function tplItems() {
  const y = doc.calendar.year || 2027;
  const themeItems = CAL.THEMES.map(th => ({ id: 'theme-' + th.id, cat: 'calendar', theme: th, name: th.name + ' 캘린더', desc: th.desc, w: 224, h: 154, build: () => { const saved = doc; const tmp = Object.assign({}, doc, { calendar: Object.assign(clone(doc.calendar), { theme: clone(th) }) }); doc = tmp; try { return CAL.buildPages(tmp, uid, { year: y, kind: 'virtue', month: 1 }).concat(CAL.buildPages(tmp, uid, { year: y, kind: 'cal', month: 1 })); } finally { doc = saved; } } }));
  const calItems = [['cal-cover', '캘린더 표지', () => CAL.buildPages(doc, uid, { year: y, kind: 'cover' })], ['cal-virtue', '인성 페이지 (1월)', () => CAL.buildPages(doc, uid, { year: y, kind: 'virtue', month: 1 })], ['cal-month', '달력 페이지 (1월)', () => CAL.buildPages(doc, uid, { year: y, kind: 'cal', month: 1 })], ['cal-back', '캘린더 뒷표지', () => CAL.buildPages(doc, uid, { year: y, kind: 'back' })]].map(([id, name, build]) => ({ id, cat: 'calpage', name, w: 224, h: 154, build }));
  const items = themeItems.concat(calItems, NC.tpl.list.map(t => ({ id: t.id, cat: t.cat, name: t.name, w: t.w, h: t.h, tags: t.tags, kw: t.kw || t.name, build: () => t.build(uid, t.pal || null, { year: y }) })));
  // 나라차 자료실 템플릿 (동기화 폴더의 디자인자료)
  const fresh = pg => Object.assign(clone(pg), { id: uid(), els: pg.els.map(e => Object.assign(clone(e), { id: uid() })) });
  NC.lib.templates().forEach(t => items.unshift({ id: t.id, cat: t.cat, name: t.name, w: t.w, h: t.h, tags: t.tags, kw: t.kw, lib: true, build: () => t.pages.map(fresh) }));
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
    const rows = [['최근 사용', rec, null], ['나라차 브랜드', items.filter(t => t.lib), null], [`${sNow} 추천`, seasonal, { season: sNow }], ['달력 테마', items.filter(t => t.theme), null, 'calendar'], ['모집·홍보', items.filter(t => t.tags.occasion === '모집').slice(0, 6), { occasion: '모집' }], ['행사·축하', items.filter(t => ['행사', '축하', '심사·대회'].includes(t.tags.occasion)).slice(0, 6), { occasion: '행사' }], ['명절·인사·감사', items.filter(t => ['명절·인사', '감사'].includes(t.tags.occasion)).slice(0, 6), { occasion: '명절·인사' }], ['다른 직종', items.filter(t => t.tags.biz !== '태권도장').slice(0, 6), { biz: '학원' }], ['SNS·카드뉴스', items.filter(t => ['SNS', '카드뉴스'].includes(t.tags.format)).slice(0, 6), { format: 'SNS' }], ['포스터', items.filter(t => t.tags.format === '포스터').slice(0, 6), { format: '포스터' }], ['안내문·서식', items.filter(t => ['안내문', '서식·활동지'].includes(t.tags.format)).slice(0, 6), { format: '안내문' }]];
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
    const ready = async () => { if (!t.lib) return true; try { setStatus('자료실 그림을 넣는 중…'); await NC.lib.materialize(pages, addAsset); return true; } catch (e) { toast('자료실 파일을 읽지 못했습니다: ' + e.message, true); return false; } finally { setStatus(''); } };
    $('#tplNew').onclick = async () => { if (doc.pages.some(p => p.els.length) && !window.confirm('현재 문서를 닫고 새 문서를 만들까요? (지금 문서는 저장된 상태로 남습니다)')) return; if (store.state.handle && store.state.dirty) { clearTimeout(fileTimer); await saveFileNow(); } const keepAssets = doc.assets; doc.assets = {}; if (!(await ready())) { doc.assets = keepAssets; return; } const libAssets = doc.assets; doc.assets = keepAssets; await store.disconnect(); const nd = newDoc(); nd.w = t.w; nd.h = t.h; nd.name = t.name; nd.pages = pages; nd.calendar = doc.calendar; nd.holidays = doc.holidays; nd.assets = libAssets; nd.fonts = doc.fonts; nd.rules = doc.rules; doc = nd; hist = []; histMeta = []; hptr = -1; cur = 0; sel = []; $('#pname').value = doc.name; commit(); clearTimeout(fileTimer); if (await store.folderReady()) { try { await store.saveIntoFolder(doc); } catch (e) { toast('폴더에 저장하지 못했습니다: ' + e.message, true); } } renderAll(); updateSaveBadge(); d.close(); toast(`"${t.name}" 문서를 만들었습니다`); };
    $('#tplAppend').onclick = async () => { if (!(await ready())) return; doc.pages.splice(cur + 1, 0, ...pages); commit(); goto(cur + 1); d.close(); toast(`${pages.length}쪽을 추가했습니다`); };
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
  if (o.type === 'range' || o.type === 'slider') {
    // 슬라이더 + 숫자 칸 (pct: 0~1 값을 0~100%로 보여 줌). 이름을 두 번 누르면 기본값으로
    const sc = o.pct ? 100 : 1, dv = o.def != null ? o.def : '', num = val === '' ? '' : Math.round(Number(val) * sc * 1000) / 1000;
    const mn = o.min * sc, mx = o.max * sc, st = (o.step || 1) * sc;
    return `<div class="sl" data-def="${dv}"><div class="slh"><span title="두 번 누르면 기본값">${label}</span><span class="slv"><input class="num" data-k="${k}" type="number" value="${num}" step="${st}" ${sc !== 1 ? `data-scale="${sc}"` : ''}>${o.unit || (o.pct ? '%' : '')}</span></div><input data-k="${k}" type="range" min="${mn}" max="${mx}" step="${st}" value="${num}" ${sc !== 1 ? `data-scale="${sc}"` : ''} style="--p:${Math.max(0, Math.min(100, (num - mn) / (mx - mn) * 100))}%"></div>`;
  }
  if (o.type === 'angle') return `<div class="sl ang" data-def="${o.def || 0}"><div class="slh"><span title="두 번 누르면 기본값">${label}</span><span class="slv"><input class="num" data-k="${k}" type="number" value="${val || 0}" step="1">°</span></div><div class="dialrow"><div class="dial" data-dial="${k}" style="--a:${val || 0}deg" title="끌어서 방향 바꾸기 (Shift: 15° 단위)"><i></i></div><div class="dialq">${[0, 45, 90, 135, 180, 270].map(a => `<button type="button" data-setnum="${k}:${a}">${a}°</button>`).join('')}</div></div></div>`;
  if (o.type === 'xy') { const [kx, ky] = k.split(','); const [vx, vy] = v; const r = o.range || 3; return `<div class="sl xy"><div class="slh"><span>${label}</span></div><div class="xyrow"><div class="xypad" data-xy="${k}" data-r="${r}" data-step="${o.step || 0.1}" title="점을 끌어서 위치 조정"><i style="left:${50 + vx / r * 50}%;top:${50 + vy / r * 50}%"></i></div><div class="xyside"><div class="slv"><small>가로</small><input class="num" data-k="${kx}" type="number" value="${vx}" step="${o.step || 0.1}"><small>세로</small><input class="num" data-k="${ky}" type="number" value="${vy}" step="${o.step || 0.1}"></div><div class="xyq">${(o.presets || []).map(([t, x, y]) => `<button type="button" data-setxy="${k}:${x},${y}">${t}</button>`).join('')}</div></div></div></div>`; }
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
    ${F('투명도', 'multi.opacity', els[0].opacity == null ? 1 : els[0].opacity, { type: 'slider', min: 0, max: 1, step: 0.01, pct: true, def: 1 })}
    ${texts.length ? `<h3>글자 ${texts.length}개 한꺼번에</h3><div class="row"><label class="f" style="flex:1;margin:0"><span>글꼴</span>${fontPicker('font', texts[0].font)}</label></div><div class="grid2">${F('크기(pt)', 'multi.size', texts[0].size, { type: 'number', step: 0.5 })}${F('색', 'multi.color', texts[0].color, { type: 'color' })}</div>` : ''}
    <p class="hint">도구 막대의 정렬·간격 균등 버튼으로 맞추고, 끌어서 함께 옮깁니다.</p>`;
    ins.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.fp) { openFontPop(b); return; } if (b.id === 'mGroup') toggleGroup(); if (b.id === 'mLock') { els.forEach(x => x.locked = true); commit(); renderOverlay(); } if (b.id === 'mUnlock') { els.forEach(x => x.locked = false); commit(); renderOverlay(); } };
    return;
  }
  const el = els[0];
  let h = `<h2>${esc(elName(el))} <span class="row"><button class="btn sm icon ${el.locked ? 'on' : ''}" data-k="locked" data-toggle="1" title="잠금">${el.locked ? '🔒' : '🔓'}</button></span></h2>`;
  const geo = `<h3>위치·크기</h3><div class="grid4">${F('X', 'x', el.x, { type: 'number', step: 0.5 })}${F('Y', 'y', el.y, { type: 'number', step: 0.5 })}${F('너비', 'w', el.w, { type: 'number', step: 0.5 })}${F('높이', 'h', el.h, { type: 'number', step: 0.5 })}</div>${F('회전', 'rot', el.rot || 0, { type: 'angle', def: 0 })}${F('투명도', 'opacity', el.opacity == null ? 1 : el.opacity, { type: 'slider', min: 0, max: 1, step: 0.01, pct: true, def: 1 })}${el.type !== 'text' ? F('혼합 모드', 'blend', el.blend || 'normal', { type: 'select', options: [['normal', '보통'], ['multiply', '곱하기'], ['screen', '스크린'], ['overlay', '오버레이'], ['darken', '어둡게'], ['lighten', '밝게'], ['difference', '차이']] }) : ''}${F('이름', 'name', el.name)}`;
  const shadowBlock = (pfx) => `<details class="fx" ${el.shadow ? 'open' : ''}><summary>${F('그림자', 'shadow', el.shadow, { type: 'check' })}</summary>${F('위치 — 점을 끌어 조정', 'shX,shY', [el.shX == null ? 0.6 : el.shX, el.shY == null ? 0.7 : el.shY], { type: 'xy', range: 4, step: 0.1, presets: [['아래', 0, 1], ['오른쪽 아래', 0.8, 0.8], ['왼쪽 아래', -0.8, 0.8], ['위', 0, -1], ['가운데(번짐만)', 0, 0]] })}
    ${F('번짐', 'shB', el.shB == null ? 0.5 : el.shB, { type: 'slider', min: 0, max: 6, step: 0.1, unit: 'mm', def: 0.5 })}${F('진하기', 'shA', el.shA == null ? 0.3 : el.shA, { type: 'slider', min: 0, max: 1, step: 0.01, pct: true, def: 0.3 })}
    ${F('그림자 색', 'shC', el.shC || '#000000', { type: 'color' })}<div class="shq"><span>빠른 설정</span>${[['부드럽게', 0.4, 0.8, 2.2, 0.22], ['또렷하게', 0.6, 0.7, 0.2, 0.45], ['강하게', 1.2, 1.4, 0.6, 0.6], ['떠 있게', 0, 2.2, 3.5, 0.3]].map(([t, x, y, b, a]) => `<button type="button" class="btn sm" data-shq="${x},${y},${b},${a}">${t}</button>`).join('')}</div></details>`;
  const fillBlock = `<div class="seg">${[['solid', '단색'], ['gradient', '그라데이션']].map(([a, t]) => `<button data-set="fillType:${a}" aria-pressed="${(el.fillType || 'solid') === a}">${t}</button>`).join('')}</div>${(el.fillType || 'solid') === 'gradient' ? `<div class="grid3">${F('시작 색', 'g1', el.g1 || '#2f5bea', { type: 'color' })}${F('끝 색', 'g2', el.g2 || '#e0564b', { type: 'color' })}</div>${F('방향', 'gAngle', el.gAngle == null ? 90 : el.gAngle, { type: 'angle', def: 90 })}${el.type === 'shape' || el.type === 'path' ? F('모양', 'gKind', el.gKind || 'linear', { type: 'select', options: [['linear', '직선'], ['radial', '원형']] }) : ''}` : ''}`;
  if (el.type === 'text') {
    h += `<h3>스타일 프리셋</h3><div class="tstyles sm">${FX.TEXT_PRESETS.map(p => `<button data-preset="${p.id}" class="tsb"><span style="${FX.textStyle(Object.assign({}, TEXT_DEF, { font: 'Jua', size: 13, weight: 800, align: 'center' }, p.st))}">${esc(p.name)}</span></button>`).join('')}</div>
    <h3>글자</h3>${el.html && el.htmlFor === el.text ? `<label class="f"><span>내용 <small>부분 서식이 있어 캔버스에서 두 번 눌러 고칩니다</small></span><textarea rows="3" readonly>${esc(el.text)}</textarea></label><button class="btn sm" data-set="html:">부분 서식 지우고 여기서 편집</button>` : F('내용', 'text', el.text, { type: 'textarea', rows: 3 })}
    <div class="row"><label class="f" style="flex:1;margin:0"><span>글꼴</span>${fontPicker('font', el.font)}</label><button class="btn sm" id="fontBrowse" style="margin-top:17px">둘러보기</button></div>
    ${F('글자 크기', 'size', el.size, { type: 'slider', min: 4, max: Math.max(160, el.size || 0), step: 0.5, unit: 'pt', def: 12 })}
    <div class="tfmt"><button type="button" data-tfi="bold" class="${fmtOn(el, 'bold') ? 'on' : ''}" title="굵게 (Ctrl+B)"><b>B</b></button><button type="button" data-tfi="italic" class="${el.italic ? 'on' : ''}" title="기울임 (Ctrl+I)"><i>I</i></button><button type="button" data-tfi="underline" class="${el.underline ? 'on' : ''}" title="밑줄 (Ctrl+U)"><u>U</u></button><button type="button" data-tfi="strike" class="${el.strike ? 'on' : ''}" title="취소선"><s>S</s></button><button type="button" data-tfi2="upper" class="${el.upper ? 'on' : ''}" title="영문 대문자">AA</button><button type="button" data-tfi2="vertical" class="${el.vertical ? 'on' : ''}" title="세로쓰기">세로</button>
    <select data-k="weight" title="굵기 단계 (글꼴이 지원하는 굵기)">${[[300, '가늘게'], [400, '보통'], [500, '중간'], [600, '약간 굵게'], [700, '굵게'], [800, '아주 굵게'], [900, '최대']].map(([a, t]) => `<option value="${a}" ${String(a) === String(el.weight) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <p class="hint" style="margin:2px 0 8px">글자를 두 번 눌러 편집하면서 일부만 드래그하면, 위에 뜨는 작은 도구 막대(또는 여기 B·I·U·S)로 <b>고른 글자만</b> 굵게·기울임·밑줄·색·크기를 바꿀 수 있습니다.</p>
    <div class="grid2">${F('줄 간격', 'lh', el.lh, { type: 'slider', min: 0.6, max: 3, step: 0.05, def: 1.35 })}${F('자간', 'ls', el.ls, { type: 'slider', min: -0.2, max: 1, step: 0.01, unit: 'em', def: 0 })}</div>
    <div class="row"><div class="seg" style="flex:1">${[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([a, t]) => `<button data-set="align:${a}" aria-pressed="${el.align === a}">${t}</button>`).join('')}</div><div class="seg" style="flex:1">${[['top', '위'], ['middle', '중앙'], ['bottom', '아래']].map(([a, t]) => `<button data-set="valign:${a}" aria-pressed="${(el.valign || 'top') === a}">${t}</button>`).join('')}</div></div>
    ${F('혼합 모드', 'blend', el.blend || 'normal', { type: 'select', options: [['normal', '보통'], ['multiply', '곱하기'], ['screen', '스크린'], ['overlay', '오버레이'], ['difference', '차이']] })}
    <h3>채우기</h3>${fillBlock}${(el.fillType || 'solid') === 'solid' ? `${F('글자 색', 'color', el.color, { type: 'color' })}${sw('color', el.color)}` : ''}
    <h3>효과 <small>포토샵 레이어 스타일</small></h3>
    <details class="fx" ${el.strokeW > 0 ? 'open' : ''}><summary><span class="chk">외곽선</span></summary>${F('두께', 'strokeW', el.strokeW, { type: 'slider', min: 0, max: 12, step: 0.25, unit: 'pt', def: 0 })}${F('색', 'strokeC', el.strokeC, { type: 'color' })}${sw('strokeC', el.strokeC)}</details>
    ${shadowBlock()}
    <details class="fx" ${el.glow ? 'open' : ''}><summary>${F('광선 (글로우)', 'glow', el.glow, { type: 'check' })}</summary>${F('번짐', 'glowB', el.glowB == null ? 1.2 : el.glowB, { type: 'slider', min: 0, max: 10, step: 0.1, unit: 'mm', def: 1.2 })}${F('색', 'glowC', el.glowC || '#ffd34d', { type: 'color' })}</details>
    <details class="fx" ${el.d3 > 0 ? 'open' : ''}><summary><span class="chk">3D 입체·긴 그림자</span></summary>${F('깊이 (단수)', 'd3', el.d3 || 0, { type: 'slider', min: 0, max: 30, step: 1, def: 0 })}${F('방향 — 점을 끌어 조정', 'd3X,d3Y', [el.d3X == null ? 0.3 : el.d3X, el.d3Y == null ? 0.3 : el.d3Y], { type: 'xy', range: 1, step: 0.05, presets: [['오른쪽 아래', 0.3, 0.3], ['아래', 0, 0.4], ['왼쪽 아래', -0.3, 0.3], ['오른쪽', 0.4, 0]] })}${F('색', 'd3C', el.d3C || '#1e2b5a', { type: 'color' })}</details>
    <details class="fx" ${el.warp && el.warp !== 'none' ? 'open' : ''}><summary><span class="chk">휘기 (아치·원형)</span></summary>${F('모양', 'warp', el.warp || 'none', { type: 'select', options: [['none', '없음'], ['arcUp', '위로 아치'], ['arcDown', '아래로 아치'], ['circle', '원형']] })}${F('휘는 정도', 'warpAmt', el.warpAmt == null ? 40 : el.warpAmt, { type: 'slider', min: 5, max: 100, step: 1, def: 40 })}<p class="hint">휘어진 글자는 한 줄만 표시되며 내용은 위 "내용" 칸에서 고칩니다.</p></details>
    <details class="fx" ${el.bg ? 'open' : ''}><summary><span class="chk">상자 배경</span></summary>${F('색', 'bg', el.bg || '#ffffff', { type: 'color' })}${F('모서리', 'bgR', el.bgR || 0, { type: 'slider', min: 0, max: 20, step: 0.5, unit: 'mm', def: 0 })}${F('여백', 'pad', el.pad, { type: 'slider', min: 0, max: 20, step: 0.5, unit: 'mm', def: 0 })}<button class="btn sm" data-set="bg:">배경 없음</button></details>
    ${el.role ? `<p class="hint">역할: ${el.role}${el.month ? ' · ' + el.month + '월' : ''} (AI 문구·테마 적용 대상)</p>` : ''}` + geo;
  } else if (el.type === 'image') {
    const f = el.fx || {};
    h += `<h3>그림</h3><div class="imgprev">${src(el.src) ? `<img src="${src(el.src)}" alt="">` : '<span class="hint">그림 없음</span>'}</div>
    <div class="row"><label class="btn sm">바꾸기(파일)<input type="file" accept="image/*" id="imgReplace" hidden></label><button class="btn sm" id="imgLib">사진 보관함</button><button class="btn sm ai" id="imgAI">AI로 만들기</button></div>
    <div class="row" style="margin-top:6px"><button class="btn sm primary" id="imgEdit" ${src(el.src) ? '' : 'disabled'}>편집기 (배경 지우기·브러시·자르기)</button>${el.srcOrig ? '<button class="btn sm" id="imgOrig">원본으로</button>' : ''}</div>
    <h3>필터 <small>포토샵 조정</small></h3><div class="tstyles sm">${FX.IMG_PRESETS.map(([id, n, fx]) => `<button class="tsb" data-imgpreset="${id}"><span>${n}</span></button>`).join('')}</div>
    <div class="grid2 sls">${F('밝기', 'fx.bri', f.bri == null ? 100 : f.bri, { type: 'slider', min: 20, max: 200, step: 1, unit: '%', def: 100 })}${F('대비', 'fx.con', f.con == null ? 100 : f.con, { type: 'slider', min: 20, max: 200, step: 1, unit: '%', def: 100 })}${F('채도', 'fx.sat', f.sat == null ? 100 : f.sat, { type: 'slider', min: 0, max: 250, step: 1, unit: '%', def: 100 })}${F('색조', 'fx.hue', f.hue || 0, { type: 'slider', min: 0, max: 360, step: 1, unit: '°', def: 0 })}${F('흐림', 'fx.blur', f.blur || 0, { type: 'slider', min: 0, max: 5, step: 0.1, unit: 'mm', def: 0 })}${F('흑백', 'fx.gray', f.gray || 0, { type: 'slider', min: 0, max: 100, step: 1, unit: '%', def: 0 })}${F('세피아', 'fx.sepia', f.sepia || 0, { type: 'slider', min: 0, max: 100, step: 1, unit: '%', def: 0 })}${F('반전', 'fx.inv', f.inv, { type: 'check' })}</div>
    <details class="fx" ${el.tint ? 'open' : ''}><summary><span class="chk">색 입히기 (틴트)</span></summary><div class="grid3">${F('색', 'tint', el.tint || '#1E2B5A', { type: 'color' })}${F('세기', 'tintA', el.tintA == null ? 0.4 : el.tintA, { type: 'slider', min: 0, max: 1, step: 0.01, pct: true, def: 0.4 })}${F('방식', 'tintMode', el.tintMode || 'multiply', { type: 'select', options: [['multiply', '곱하기'], ['screen', '스크린'], ['overlay', '오버레이'], ['color', '색상'], ['normal', '덮기']] })}</div><button class="btn sm" data-set="tint:">틴트 없음</button></details>
    <h3>프레임·모양</h3>${F('모양 마스크', 'clip', el.clip || 'none', { type: 'select', options: FX.CLIPS })}
    <div class="grid2">${F('채우기', 'fit', el.fit, { type: 'select', options: [['contain', '안에 맞춤'], ['cover', '꽉 채움(잘림)'], ['fill', '늘림']] })}${F('정렬', 'pos', el.pos, { type: 'select', options: [['50% 50%', '가운데'], ['50% 100%', '아래'], ['50% 0%', '위'], ['0% 50%', '왼쪽'], ['100% 50%', '오른쪽'], ['0% 100%', '왼쪽 아래'], ['100% 100%', '오른쪽 아래']] })}</div>
    <div>${F('확대', 'zoom', el.zoom || 1, { type: 'slider', min: 1, max: 4, step: 0.05, unit: '배', def: 1 })}${F('가로 이동', 'panX', el.panX || 0, { type: 'slider', min: -50, max: 50, step: 1, unit: '%', def: 0 })}${F('세로 이동', 'panY', el.panY || 0, { type: 'slider', min: -50, max: 50, step: 1, unit: '%', def: 0 })}</div>
    <div class="grid3">${F('좌우 뒤집기', 'flip', el.flip, { type: 'check' })}</div>${F('모서리', 'radius', el.radius, { type: 'slider', min: 0, max: 40, step: 0.5, unit: 'mm', def: 0 })}${F('테두리 두께', 'borderW', el.borderW || 0, { type: 'slider', min: 0, max: 10, step: 0.25, unit: 'mm', def: 0 })}${F('테두리 색', 'border', el.border || '#000000', { type: 'color' })}<button class="btn sm" data-set="border:">테두리 없음</button>
    ${shadowBlock()}
    <div class="row" style="margin-top:8px"><button class="btn sm" id="imgFitBox">비율대로 상자 맞춤</button><button class="btn sm" id="imgFull">페이지 가득</button></div>` + geo;
  } else if (el.type === 'shape') {
    h += `<h3>도형</h3>${F('종류', 'kind', el.kind, { type: 'select', options: FX.SHAPES })}
    ${el.kind === 'star' || el.kind === 'burst' ? `<div class="grid2">${F('꼭짓점 수', 'points', el.points || (el.kind === 'star' ? 5 : 12), { type: 'slider', min: 3, max: 40, step: 1 })}${F('안쪽 비율', 'inner', el.inner == null ? (el.kind === 'star' ? 0.45 : 0.78) : el.inner, { type: 'slider', min: 0.1, max: 0.95, step: 0.01, pct: true })}</div>` : ''}
    ${el.kind === 'polygon' ? F('변의 수', 'sides', el.sides || 6, { type: 'slider', min: 3, max: 20, step: 1, def: 6 }) : ''}
    ${el.kind === 'ring' || el.kind === 'cross' ? F('굵기 비율', 'inner', el.inner == null ? (el.kind === 'ring' ? 0.3 : 0.34) : el.inner, { type: 'slider', min: 0.05, max: 0.9, step: 0.01, pct: true }) : ''}
    ${el.kind === 'arrow' ? `<div class="grid2">${F('머리 길이', 'headL', el.headL == null ? 0.4 : el.headL, { type: 'slider', min: 0.1, max: 0.9, step: 0.01, pct: true, def: 0.4 })}${F('몸통 굵기', 'headW', el.headW == null ? 0.5 : el.headW, { type: 'slider', min: 0.1, max: 1, step: 0.01, pct: true, def: 0.5 })}</div>` : ''}
    ${el.kind === 'rect' ? F('모서리', 'radius', el.radius, { type: 'slider', min: 0, max: Math.max(5, Math.round(Math.min(el.w, el.h) / 2)), step: 0.5, unit: 'mm', def: 0 }) : ''}
    ${el.kind === 'line' ? `<div class="grid2">${F('끝 화살표', 'arrowEnd', el.arrowEnd, { type: 'check' })}${F('시작 화살표', 'arrowStart', el.arrowStart, { type: 'check' })}</div>` : `<h3>채우기</h3>${fillBlock}${(el.fillType || 'solid') === 'solid' ? `${F('채우기 색', 'fill', el.fill || '#000000', { type: 'color' })}${sw('fill', el.fill)}<button class="btn sm" data-set="fill:">채우기 없음</button>` : ''}`}
    <h3>선</h3>${F('두께', 'strokeW', el.strokeW || 0, { type: 'slider', min: 0, max: 8, step: 0.1, unit: 'mm', def: 0 })}<div class="grid2">${F('선 색', 'stroke', el.stroke || (el.kind === 'line' ? el.fill : '#000000'), { type: 'color' })}${F('점선', 'dash', el.dash || '', { type: 'select', options: [['', '실선'], ['3 2', '긴 점선'], ['1.5 1.5', '점선'], ['0.1 2', '점점선'], ['6 2 1.5 2', '쇄선']] })}</div>${F('선 끝', 'cap', el.cap || 'butt', { type: 'select', options: [['butt', '각지게'], ['round', '둥글게'], ['square', '네모']] })}${el.kind !== 'line' ? '<button class="btn sm" data-set="stroke:">선 없음</button>' : ''}
    ${shadowBlock()}` + geo;
  } else if (el.type === 'path') {
    h += `<h3>펜 선</h3>${F('두께', 'strokeW', el.strokeW == null ? 0.8 : el.strokeW, { type: 'slider', min: 0.1, max: 8, step: 0.1, unit: 'mm', def: 0.8 })}<div class="grid2">${F('선 색', 'stroke', el.stroke || '#000000', { type: 'color' })}${F('점선', 'dash', el.dash || '', { type: 'select', options: [['', '실선'], ['3 2', '긴 점선'], ['1.5 1.5', '점선'], ['0.1 2', '점점선']] })}</div>
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
    h += `<p class="hint cal-tip"><b>칸 편집</b> · 칸을 누르거나 끌면 칸이 골라지고 위에 칸 도구(칸 색·글자 색·크기·정렬·합치기·나누기)가 뜹니다. Shift+누르기·Shift+화살표로 범위, 두 번 누르기·Enter·바로 타자로 칸에 입력, 칸 경계선을 끌면 너비·높이 조정(두 번 누르면 같게). 달력을 옮길 때는 요일 줄을 끕니다.</p>
    <h3>달력</h3><div class="grid2">${F('연도', 'year', el.year, { type: 'number', min: 1900, max: 2100 })}${F('월', 'month', el.month, { type: 'select', options: Array.from({ length: 12 }, (_, i) => [i + 1, (i + 1) + '월']) })}</div>
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
  ins.onmousedown = e => { if (e.target.closest('[data-tfi]') && editing) e.preventDefault(); };
  ins.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tfi) { toggleFmt(b.dataset.tfi); if (!editing) return; b.classList.toggle('on'); return; }
    if (b.dataset.tfi2) { const k = b.dataset.tfi2; selEls().forEach(x => { if (x.type === 'text') x[k] = !x[k]; }); commit(); rerender(); return; }
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
  if (t.type === 'number' && (t.value.trim() === '' || isNaN(Number(t.value)))) return;  // 입력 중 빈 칸은 무시
  if (t.type === 'number' || t.type === 'range') { v = Number(v); if (t.dataset.scale) v = v / Number(t.dataset.scale); }
  if ((k === 'w' || k === 'h') && v < 1) return; if (k === 'year' && (v < 1900 || v > 2100)) return; if (k === 'size' && v < 1) return;
  syncCtl(t);
  if (k.startsWith('pg.')) { page()[k.slice(3)] = v; renderCanvas(); return; }
  if (k.startsWith('multi.')) { const kk = k.slice(6); selEls().forEach(el => { if (kk === 'opacity' || el.type === 'text') el[kk] = v; }); renderCanvas(); return; }
  const el = selEls()[0]; if (!el) return;
  if (['year', 'month', 'weight', 's.weekStart'].includes(k)) v = Number(v);
  if (t.dataset.ev != null) return;
  if (k === 'chartData') { el.data = v.split('\n').map(l => l.split(/[,\t]/)).filter(a => a[0] && a[0].trim()).map(a => ({ l: a[0].trim(), v: Number((a[1] || '0').trim()) || 0 })); renderCanvas(); return; }
  if (k === 'chartColors') { el.colors = v.split(',').map(s => s.trim()).filter(Boolean); renderCanvas(); return; }
  setK(el, k, v);
  if (el.type === 'text' && el.html && (k === 'color' || k === 'size')) stripRich(el, k === 'color' ? 'color' : 'size');
  if (el.type === 'cal' && ['month', 'year', 's.weekStart', 's.rows'].includes(k)) { const grid = Object.keys(el.cells || {}).filter(x => !x.startsWith('d')); if ((el.merges && el.merges.length) || el.rowH || grid.length) { delete el.merges; delete el.rowH; grid.forEach(x => delete el.cells[x]); cellSel = null; toast('칸 배치가 바뀌어 합친 칸·행 높이·빈 칸 글자를 초기화했습니다 (날짜 칸 색·글자는 날짜를 따라갑니다)'); } }
  if (el.type === 'text') lastTextStyle = { font: el.font, size: el.size, weight: el.weight, color: el.color };
  renderCanvas();
});
// 슬라이더·숫자 칸·다이얼·패드가 같은 값을 보여 주게 맞춤
function syncCtl(t) {
  const box = t.closest('.sl'); if (!box) return;
  box.querySelectorAll(`[data-k="${t.dataset.k}"]`).forEach(o => { if (o !== t) o.value = t.value; if (o.type === 'range') { const mn = Number(o.min), mx = Number(o.max); o.style.setProperty('--p', Math.max(0, Math.min(100, (Number(o.value) - mn) / (mx - mn) * 100)) + '%'); } });
  const dial = box.querySelector(`.dial[data-dial="${t.dataset.k}"]`); if (dial) dial.style.setProperty('--a', t.value + 'deg');
  const pad = box.querySelector('.xypad'); if (pad) { const [kx, ky] = pad.dataset.xy.split(','), r = Number(pad.dataset.r); const vx = Number(box.querySelector(`input[data-k="${kx}"]`).value), vy = Number(box.querySelector(`input[data-k="${ky}"]`).value); const dot = pad.querySelector('i'); dot.style.left = Math.max(0, Math.min(100, 50 + vx / r * 50)) + '%'; dot.style.top = Math.max(0, Math.min(100, 50 + vy / r * 50)) + '%'; }
}
// 다이얼·패드 끌기, 빠른 버튼, 이름 두 번 눌러 기본값
function ctlSet(k, v) { const el = selEls()[0]; if (!el) return; setK(el, k, v); const inp = $(`#inspector input.num[data-k="${k}"]`); if (inp) { inp.value = Math.round(v * 1000) / 1000; syncCtl(inp); } renderCanvas(); }
$('#inspector').addEventListener('pointerdown', e => {
  const dial = e.target.closest('.dial'), pad = e.target.closest('.xypad'); if (!dial && !pad) return; e.preventDefault();
  const tgt = dial || pad; try { tgt.setPointerCapture(e.pointerId); } catch (err) {} tgt.classList.add('drag');
  const move = ev => { const r = tgt.getBoundingClientRect();
    if (dial) { let a = Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI + 90; a = (a + 360) % 360; a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a); if (dial.dataset.dial === 'rot' && a > 180) a -= 360; ctlSet(dial.dataset.dial, a); }
    else { const [kx, ky] = pad.dataset.xy.split(','), R = Number(pad.dataset.r), stp = Number(pad.dataset.step); const q = v => Math.round(Math.max(-R, Math.min(R, v)) / stp) * stp; ctlSet(kx, q(((ev.clientX - r.left) / r.width * 2 - 1) * R)); ctlSet(ky, q(((ev.clientY - r.top) / r.height * 2 - 1) * R)); } };
  const up = () => { tgt.classList.remove('drag'); tgt.removeEventListener('pointermove', move); tgt.removeEventListener('pointerup', up); commit(); };
  tgt.addEventListener('pointermove', move); tgt.addEventListener('pointerup', up); move(e);
});
$('#inspector').addEventListener('click', e => {
  const sn = e.target.closest('[data-setnum]'); if (sn) { const [k, v] = sn.dataset.setnum.split(':'); ctlSet(k, Number(v)); commit(); return; }
  const sx = e.target.closest('[data-setxy]'); if (sx) { const [k, v] = sx.dataset.setxy.split(':'); const [kx, ky] = k.split(','); const [x, y] = v.split(',').map(Number); ctlSet(kx, x); ctlSet(ky, y); commit(); return; }
  const sq = e.target.closest('[data-shq]'); if (sq) { const [x, y, b, a] = sq.dataset.shq.split(',').map(Number); const el = selEls()[0]; if (!el) return; Object.assign(el, { shadow: true, shX: x, shY: y, shB: b, shA: a }); commit(); rerender(); return; }
});
$('#inspector').addEventListener('dblclick', e => {
  const lab = e.target.closest('.slh > span:first-child'); if (!lab) return; const box = lab.closest('.sl'); const def = box.dataset.def; if (def === '' || def == null) return;
  const inp = box.querySelector('input.num'); const sc = Number(inp.dataset.scale || 1); ctlSet(inp.dataset.k, Number(def)); inp.value = Number(def) * sc; syncCtl(inp); commit();
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
  const pth = await curDocPath(); if (!pth) return; for await (const [n] of (await store.dirAt(pth)).entries()) if (n === name) return;
  try { await h.move(name); store.state.fileName = h.name; await store.idbSet('fileHandle', h); updateSaveBadge(); } catch (e) { console.warn('파일 이름 바꾸기', e); }
});
$('#btnNew').onclick = openNewDesign;
$('#btnOpen').onclick = () => openDrive();
async function openOtherFile() { try { let j = null; if (store.state.supported) j = await store.openExisting(); else j = await store.pickLocal(); if (j) { await loadDoc(j, '불러왔습니다'); updateSaveBadge(); } } catch (e) { if (e.name !== 'AbortError') toast('열 수 없습니다: ' + e.message, true); } }
$('#btnSave').onclick = saveNow;
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
    <label class="f" style="max-width:320px"><span>이 PC 이름 (충돌 안내에 표시, 예: 도장 PC·집 맥북)</span><input type="text" id="svPcName" value="${esc(store.pcName())}" maxlength="20"></label>
    <h3>폴더 안의 문서 (${docs.length})</h3>
    ${docs.length ? `<ul class="list">${docs.map((x, i) => `<li data-doc="${i}" title="누르면 엽니다"><span>${esc(x.name.replace(/\.design\.json$/i, ''))}</span><small class="hint" style="margin:0">${when(x.lastModified)} · ${Math.max(1, Math.round(x.size / 1024)).toLocaleString()}KB</small>${st.handle && x.name === st.fileName && curIn ? '<b style="min-width:auto">작업 중</b>' : ''}</li>`).join('')}</ul>` : '<p class="hint">아직 문서가 없습니다.</p>'}
    <div class="row" style="margin-top:10px">${curIn ? '' : '<button class="btn primary" id="svIntoDir">지금 문서를 이 폴더에 저장</button>'}<button class="btn" id="svNow" ${st.handle ? '' : 'disabled'}>지금 저장</button><button class="btn" id="svOther">다른 위치의 파일 열기</button><button class="btn" id="svDown">내려받기 (JSON 사본)</button><button class="btn danger" id="svDiscDir">폴더 연결 해제</button></div>`
  : `<p><b>지금 상태:</b> ${st.handle ? `파일 <code>${esc(st.fileName)}</code>에 연결되어 자동 저장 중입니다. 설정값(API 키 등)은 이 PC에만 있습니다.` : '브라우저 안에만 자동 저장되고 있습니다 (이 PC, 이 브라우저에서만 보임).'}</p>
    ${st.dir ? `<p class="hint">동기화 폴더 <b>${esc(st.dirName)}</b>가 연결되어 있지만 이 창에서 아직 허락하지 않았습니다.</p><div class="row"><button class="btn primary" id="svReDir">동기화 폴더 다시 연결</button></div>` : ''}
    <h3>여러 PC에서 쓰기 (구글 드라이브)</h3>
    <ol style="margin:0 0 10px 18px;line-height:1.7"><li>각 PC에 <b>Google Drive 데스크톱 앱</b>을 설치하고 같은 계정으로 로그인합니다.</li><li>아래 <b>"동기화 폴더 연결"</b>을 누르고 <b>내 드라이브 → 나라차디자인공방</b> 폴더를 고릅니다 (없으면 그 창에서 새 폴더로 만듭니다). Windows는 보통 <code>G:\\내 드라이브</code>, Mac은 Finder 왼쪽의 <code>Google Drive → 내 드라이브</code>입니다.</li><li>그러면 <b>설정값(API 키·모델·최근 사용 글꼴·요소·템플릿)</b>과 <b>모든 문서</b>가 그 폴더에 저장되고, 다른 PC에서 같은 폴더를 연결하면 그대로 이어집니다.</li><li>PC마다 처음 한 번만 연결하면 됩니다. 브라우저가 "방문할 때마다 허용"을 물으면 허용해 두면 편합니다.</li></ol>
    ${st.dirSupported ? '' : '<p class="hint">이 브라우저는 폴더 연결을 지원하지 않습니다. Chrome 또는 Edge를 쓰세요. 지금은 "내려받기"로 저장하세요.</p>'}
    <div class="row"><button class="btn primary" id="svDir" ${st.dirSupported ? '' : 'disabled'}>동기화 폴더 연결</button><button class="btn" id="svConnect" ${st.supported ? '' : 'disabled'}>${st.handle ? '다른 파일에 연결' : '파일 하나만 연결'}</button><button class="btn" id="svNow" ${st.handle ? '' : 'disabled'}>지금 저장</button><button class="btn" id="svDown">내려받기 (JSON 사본)</button>${st.handle ? '<button class="btn danger" id="svDisc">파일 연결 해제</button>' : ''}</div>`;
  $('#saveBody').innerHTML = folderPart + `<p class="hint" style="margin-top:10px">문서 파일에는 올린 이미지와 AI 이미지가 함께 들어갑니다. 내장 글꼴과 2026 삽화는 프로그램에 있으므로 파일이 가벼워집니다. 두 PC에서 같은 문서를 동시에 고쳐 내용이 갈라지면 어느 쪽으로 계속할지 묻고, 다른 쪽은 "충돌 사본" 파일로 보관해 지워지는 내용이 없습니다.</p>`;
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
  const pn = $('#svPcName'); if (pn) pn.onchange = () => { store.setPcName(pn.value); pn.value = store.pcName(); toast('이 PC 이름을 저장했습니다'); };
  const ul = d.querySelector('.list'); if (ul) ul.onclick = async e => { const li = e.target.closest('[data-doc]'); if (!li) return; const x = docs[Number(li.dataset.doc)]; if (st.handle && x.name === st.fileName && curIn) { d.close(); return; } try { await openFolderDoc(x.handle); d.close(); } catch (err) { toast('열 수 없습니다: ' + err.message, true); } };
}

/* ---- 새 디자인 만들기 (미리캔버스식) ---- */
const PX = v => Math.round(v * 25.4 / 96 * 100) / 100;
// [id, 이름, 묶음, 가로, 세로, 단위('mm'|'px'), 검색어]
const FORMATS = [
  ['pres169', '프레젠테이션 16:9', 'pres', 1920, 1080, 'px', '발표 PPT 슬라이드 설명회'], ['pres43', '프레젠테이션 4:3', 'pres', 1024, 768, 'px', '발표 PPT 슬라이드'],
  ['info-h', '인포그래픽 가로형', 'pres', 1920, 1080, 'px', '인포그래픽 도표'], ['info-v', '인포그래픽 세로형', 'pres', 800, 2000, 'px', '인포그래픽 세로'],
  ['ig-sq', '인스타그램 정사각', 'sns', 1080, 1080, 'px', 'SNS 인스타 피드 게시물'], ['ig-45', '인스타그램 세로 4:5', 'sns', 1080, 1350, 'px', 'SNS 인스타 피드 세로'],
  ['story', '스토리 · 릴스', 'sns', 1080, 1920, 'px', 'SNS 인스타 스토리 릴스 쇼츠 세로'], ['cardnews', '카드뉴스', 'sns', 1080, 1080, 'px', 'SNS 카드뉴스 정사각'],
  ['kakao', '카카오톡 공지 이미지', 'sns', 800, 800, 'px', '카카오 단톡방 공지 학부모'], ['blog', '블로그 썸네일', 'sns', 966, 966, 'px', '네이버 블로그 대표 이미지'],
  ['fb', '페이스북 · 밴드 게시물', 'sns', 1200, 630, 'px', '페이스북 밴드 링크 이미지'],
  ['yt-thumb', '유튜브 썸네일', 'video', 1280, 720, 'px', '유튜브 썸네일 영상'], ['yt-art', '유튜브 채널 아트', 'video', 2560, 1440, 'px', '유튜브 배너 채널'], ['video', '영상 화면 16:9', 'video', 1920, 1080, 'px', '영상 자막 화면'],
  ['web-poster', '웹 포스터 세로형', 'web', 891, 1260, 'px', '웹 포스터 홈페이지'], ['detail', '상세페이지', 'web', 860, 1100, 'px', '상세페이지 쇼핑 소개'], ['web-banner', '홈페이지 배너', 'web', 1920, 600, 'px', '홈페이지 메인 배너'],
  ['a4p', 'A4 세로', 'print', 210, 297, 'mm', '문서 인쇄 포스터 안내문'], ['a4l', 'A4 가로', 'print', 297, 210, 'mm', '문서 인쇄 가로'], ['a3p', 'A3 세로', 'print', 297, 420, 'mm', '포스터 게시물'], ['a3l', 'A3 가로', 'print', 420, 297, 'mm', '포스터 가로'],
  ['a5p', 'A5 세로', 'print', 148, 210, 'mm', '전단 소책자'], ['b5p', 'B5 세로', 'print', 176, 250, 'mm', '소책자'], ['a2p', '포스터 A2', 'print', 420, 594, 'mm', '게시판 포스터 큰'],
  ['flyer', '전단지 A4', 'print', 210, 297, 'mm', '전단지 홍보 모집'], ['leaflet', '3단 리플렛', 'print', 297, 210, 'mm', '리플렛 접지 브로셔'],
  ['cert', '상장 · 증서 A4', 'print', 210, 297, 'mm', '상장 승급증 수료증 표창'], ['letter', '가정통신문 A4', 'doc', 210, 297, 'mm', '가정통신문 안내문 공지 학부모'], ['form', '문서 서식 세로형', 'doc', 794, 1123, 'px', '서식 신청서 활동지'],
  ['namecard', '명함', 'print', 90, 50, 'mm', '명함'], ['postcard', '엽서 · 초대장', 'print', 148, 100, 'mm', '엽서 초대장 카드'], ['coupon', '쿠폰 · 이용권', 'print', 90, 50, 'mm', '쿠폰 이용권 체험권'],
  ['sticker', '원형 스티커', 'print', 50, 50, 'mm', '스티커 라벨 원형'], ['nametag', '명찰', 'print', 90, 60, 'mm', '명찰 이름표'],
  ['banner', '가로 현수막 5×0.9m', 'sign', 5000, 900, 'mm', '현수막 가로 대형'], ['banner3', '가로 현수막 3×0.7m', 'sign', 3000, 700, 'mm', '현수막 가로'], ['banner-v', '세로 현수막 0.8×2m', 'sign', 800, 2000, 'mm', '현수막 세로 심사'],
  ['xbanner', 'X배너 60×180cm', 'sign', 600, 1800, 'mm', 'X배너 입간판 배너'], ['sign-a1', '입간판 A1', 'sign', 594, 841, 'mm', '입간판 포스터'],
  ['desk-cal', '탁상 캘린더', 'cal', 224, 154, 'mm', '캘린더 달력 탁상'], ['wall-cal', '벽걸이 캘린더 A3', 'cal', 297, 420, 'mm', '캘린더 달력 벽걸이'], ['a4-cal', 'A4 달력 한 장', 'cal', 297, 210, 'mm', '달력 월간 가로'],
];
const ND_GROUPS = [['rec', '추천', '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'], ['pres', '프레젠테이션', '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="m10 9 5 2.5-5 2.5z"/>'],
  ['sns', '소셜 미디어', '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>'], ['video', '유튜브 · 영상', '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10 9.5 5 2.5-5 2.5z"/>'],
  ['web', '웹사이트', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>'], ['print', '인쇄', '<path d="M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>'],
  ['doc', '문서', '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'], ['sign', '현수막 · 배너', '<path d="M3 5h18v8H3zM6 13v8M18 13v8"/>'], ['cal', '캘린더', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>']];
const ND_COLOR = { pres: '#2f5bea', sns: '#d6408b', video: '#e0302e', web: '#6b3fd1', print: '#1e2b5a', doc: '#2f8d9e', sign: '#c9831a', cal: '#3a8a3a' };
const ND_REC = ['ig-sq', 'cardnews', 'kakao', 'a4p', 'letter', 'cert', 'flyer', 'xbanner', 'banner3', 'pres169', 'yt-thumb', 'desk-cal'];
let ndState = { nav: 'rec', q: '' };
function recentFormats() { try { return JSON.parse(localStorage.getItem('naracal-recent-formats') || '[]'); } catch (e) { return []; } }
function fmtMM(f) { return f[5] === 'px' ? [PX(f[3]), PX(f[4])] : [f[3], f[4]]; }
function fmtLabel(f) { return f[5] === 'px' ? `${f[3]} × ${f[4]} px` : f[3] >= 1000 || f[4] >= 1000 ? `${f[3] / 10} × ${f[4] / 10} cm` : `${f[3]} × ${f[4]} mm`; }
function fcard(f) { const r = f[3] / f[4], H = 54, W = 92; let w = W, h = W / r; if (h > H) { h = H; w = H * r; } return `<button class="fcard" data-fmt="${f[0]}"><span class="shape" style="color:${ND_COLOR[f[2]]}"><i style="width:${Math.max(8, w)}px;height:${Math.max(6, h)}px;background:${ND_COLOR[f[2]]}1a"></i></span><b>${esc(f[1])}</b><small>${fmtLabel(f)}</small></button>`; }
function openNewDesign() {
  let d = $('#dlgNew');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlgNew'; d.className = 'nd'; d.innerHTML = `<div class="ndhead"><h2>무엇을 만들어야 하나요?</h2><button class="btn sm" data-close>닫기</button></div><div class="ndsearch"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="ndQ" placeholder="만들고 싶은 것을 검색해 보세요! (예: 인스타, 현수막, 상장)"></div><div class="ndbody"><nav id="ndNav"></nav><div class="ndmain" id="ndMain"></div></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close();
    $('#ndQ').oninput = e => { ndState.q = e.target.value; renderNewDesign(); };
    d.addEventListener('click', async e => { const n = e.target.closest('[data-ndnav]'); if (n) { ndState.nav = n.dataset.ndnav; ndState.q = ''; $('#ndQ').value = ''; renderNewDesign(); return; }
      const c = e.target.closest('[data-fmt]'); if (c) { const f = FORMATS.find(x => x[0] === c.dataset.fmt); const [w, h] = fmtMM(f); d.close(); await createDesign(w, h, f[1], f[0]); return; }
      if (e.target.id === 'ndMake') { const u = $('#ndU').value, w = Number($('#ndW').value), h = Number($('#ndH').value); if (!(w > 0 && h > 0)) { toast('가로·세로 크기를 넣어 주세요', true); return; } const k = u === 'px' ? 25.4 / 96 : u === 'cm' ? 10 : 1; d.close(); await createDesign(Math.round(w * k * 100) / 100, Math.round(h * k * 100) / 100, '새 디자인'); } }); }
  ndState.q = ''; $('#ndQ').value = ''; renderNewDesign(); d.showModal(); setTimeout(() => $('#ndQ').focus(), 50);
}
function renderNewDesign() {
  $('#ndNav').innerHTML = ND_GROUPS.map(([k, t, ic]) => `<button data-ndnav="${k}" class="${ndState.nav === k && !ndState.q ? 'on' : ''}"><svg viewBox="0 0 24 24">${ic}</svg>${t}</button>`).join('') + `<hr><button data-ndnav="custom" class="${ndState.nav === 'custom' && !ndState.q ? 'on' : ''}"><svg viewBox="0 0 24 24"><path d="m4 20 16-16M7 17l2 2M10 14l2 2M13 11l2 2M16 8l2 2"/></svg>직접 입력</button>`;
  const custom = `<h3>직접 입력</h3><div class="custom"><label>가로<input type="number" id="ndW" min="1" value="210"></label><label>세로<input type="number" id="ndH" min="1" value="297"></label><label>단위<select id="ndU"><option value="mm">mm</option><option value="cm">cm</option><option value="px">px</option></select></label><button class="btn primary" id="ndMake">새 디자인 만들기</button></div><p class="hint">인쇄물은 mm·cm, 화면용(SNS·웹·영상)은 px로 넣으면 편합니다. px는 96dpi 기준으로 바꿉니다.</p>`;
  const q = ndState.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let h = '';
  if (q.length) { const list = FORMATS.filter(f => q.every(w => (f[1] + ' ' + f[6]).toLowerCase().includes(w))); h = `<h3>검색 결과 <small>${list.length}</small></h3><div class="fgrid">${list.map(fcard).join('') || '<p class="hint">맞는 크기가 없습니다. 직접 입력으로 만들어 보세요.</p>'}</div>` + custom; }
  else if (ndState.nav === 'custom') h = custom;
  else if (ndState.nav === 'rec') {
    const rec = recentFormats().map(id => FORMATS.find(f => f[0] === id)).filter(Boolean);
    h = `<div class="chips">${[['rec', '전체'], ['sns', '소셜 미디어'], ['print', '인쇄'], ['sign', '현수막 · 배너'], ['doc', '문서'], ['pres', '프레젠테이션'], ['cal', '캘린더']].map(([k, t]) => `<button data-ndnav="${k}" class="${k === 'rec' ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    if (rec.length) h += `<h3>최근 사용</h3><div class="fgrid">${rec.map(fcard).join('')}</div>`;
    h += `<h3>도장에서 자주 쓰는 크기</h3><div class="fgrid">${ND_REC.map(id => fcard(FORMATS.find(f => f[0] === id))).join('')}</div>`;
    ND_GROUPS.slice(1).forEach(([k, t]) => { h += `<h3>${t}</h3><div class="fgrid">${FORMATS.filter(f => f[2] === k).map(fcard).join('')}</div>`; });
  } else { const t = ND_GROUPS.find(g => g[0] === ndState.nav); h = `<h3>${t[1]}</h3><div class="fgrid">${FORMATS.filter(f => f[2] === ndState.nav).map(fcard).join('')}</div>`; }
  $('#ndMain').innerHTML = h;
}
// 새 문서를 만들고, 동기화 폴더가 있으면 그 폴더에 새 파일로 저장
async function createDesign(w, h, name, fmtId) {
  if (fmtId) { const r = recentFormats().filter(x => x !== fmtId); r.unshift(fmtId); try { localStorage.setItem('naracal-recent-formats', JSON.stringify(r.slice(0, 6))); } catch (e) {} }
  if (store.state.handle && store.state.dirty) { clearTimeout(fileTimer); await saveFileNow(); }
  const inDir = await store.folderReady();
  await store.disconnect();
  doc = newDoc(['custom', name, w, h]); doc.name = name; { const f = FORMATS.find(x => x[0] === fmtId); if (f && ['print', 'doc', 'cal'].includes(f[2]) && f[5] === 'mm') doc.bleed = 3; } hist = []; histMeta = []; hptr = -1; cur = 0; sel = []; $('#pname').value = doc.name; commit(); clearTimeout(fileTimer);
  if (inDir) { try { const into = $('#dlgDrive') && drv.view === 'drive' ? drv.path : []; await store.saveIntoFolder(doc, into); setStatus(`${into.length ? into.join(' › ') + ' 폴더' : '동기화 폴더'}에 저장됨 · ${store.state.fileName}`); } catch (e) { toast('폴더에 저장하지 못했습니다: ' + e.message, true); } }
  else setStatus('브라우저에 저장됩니다 · 파일로 저장하려면 저장(Ctrl+S)');
  renderAll(); updateSaveBadge(); sideTab = 'tpl'; renderRail(); renderSide(); fitCanvas && fitCanvas();
  toast(`${name} (${fmtLabel(['', '', '', w, h, 'mm'])}) 새 디자인을 만들었습니다`);
}

/* ---- 내 드라이브: 폴더로 디자인 관리 (미리캔버스식) ---- */
let drv = { path: [], view: 'drive', tab: 'all', q: '', sort: 'date' };
const thumbCache = new Map();
async function curDocPath() { try { const r = await store.state.dir.resolve(store.state.handle); return r ? r.slice(0, -1) : null; } catch (e) { return null; } }
function openDrive(path) {
  if (path) drv.path = path;
  let d = $('#dlgDrive');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'dlgDrive'; d.className = 'nd drive';
    d.innerHTML = `<div class="ndhead"><h2>내 드라이브</h2><button class="btn primary" id="dvNew"><svg class="ic"><use href="#i-new"/></svg>새 디자인 만들기</button><button class="btn sm" data-close>닫기</button></div>
    <div class="ndbody"><nav id="dvNav"></nav><div class="ndmain" id="dvMain"></div></div>`;
    document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close();
    $('#dvNew').onclick = () => { d.close(); openNewDesign(); };
    d.addEventListener('click', driveClick); d.addEventListener('dragstart', driveDrag); d.addEventListener('dragover', e => { if (e.target.closest('[data-dropdir]')) { e.preventDefault(); e.target.closest('[data-dropdir]').classList.add('over'); } });
    d.addEventListener('dragleave', e => { const t = e.target.closest('[data-dropdir]'); if (t) t.classList.remove('over'); }); d.addEventListener('drop', driveDrop);
  }
  renderDrive(); if (!d.open) d.showModal();
}
async function renderDrive() {
  const ready = await store.folderReady();
  $('#dvNav').innerHTML = [['drive', '내 드라이브', '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'], ['recent', '최근 디자인', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'], ['trash', '휴지통', '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>']]
    .map(([k, t, ic]) => `<button data-dvnav="${k}" class="${drv.view === k ? 'on' : ''}"><svg viewBox="0 0 24 24">${ic}</svg>${t}</button>`).join('') + `<hr><button data-dvnav="sync"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5l2-2v6h-6l2.3-2.3A5.5 5.5 0 0 0 6.5 12M20 12a8 8 0 0 1-14 5l-2 2v-6h6l-2.3 2.3A5.5 5.5 0 0 0 17.5 12"/></svg>저장·동기화 설정</button>`;
  const main = $('#dvMain');
  if (!ready) { main.innerHTML = `<div class="dvempty"><h3>동기화 폴더가 연결되어 있지 않습니다</h3><p class="hint">구글 드라이브의 나라차디자인공방 폴더를 연결하면 폴더별로 디자인을 정리할 수 있습니다.</p><button class="btn primary" data-dvnav="sync">동기화 폴더 연결</button> <button class="btn" data-dvact="other">다른 위치의 파일 열기</button></div>`; return; }
  main.innerHTML = '<p class="hint"><span class="spin"></span> 불러오는 중…</p>';
  const cur = store.state.handle ? store.state.fileName : null, curPath = await curDocPath();
  const isCur = x => cur && x.name === cur && curPath && curPath.join('/') === x.path.join('/');
  let folders = [], docs = [], title = '', crumbs = '';
  const q = drv.q.trim().toLowerCase();
  if (drv.view === 'trash') { const r = await store.listDir([store.TRASH]).catch(() => ({ folders: [], docs: [] })); folders = r.folders; docs = r.docs; title = '휴지통'; }
  else if (drv.view === 'recent' || q) { docs = (await store.walkDocs()).sort((a, b) => b.lastModified - a.lastModified); if (!q) docs = docs.slice(0, 30); title = q ? `"${esc(drv.q)}" 검색 결과` : '최근 디자인'; }
  else { const r = await store.listDir(drv.path).catch(() => { drv.path = []; return store.listDir([]); }); folders = r.folders; docs = r.docs;
    crumbs = [`<button data-crumb="0">내 드라이브</button>`].concat(drv.path.map((p, i) => `<button data-crumb="${i + 1}">${esc(p)}</button>`)).join('<span>›</span>'); }
  if (q) { docs = docs.filter(x => x.name.toLowerCase().includes(q)); folders = []; }
  if (drv.sort === 'name') docs.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  if (drv.tab === 'folder') docs = []; if (drv.tab === 'design') folders = [];
  const nm = x => esc(x.name.replace(/\.design\.json$/i, ''));
  const when = t => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const trash = drv.view === 'trash';
  const fcardH = f => `<div class="dvfolder" data-dvfolder="${esc(f.name)}" ${trash ? '' : `data-dropdir="${esc(JSON.stringify(f.path))}"`}><svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><div><b>${esc(f.name)}</b><small>${f.count}개 항목</small></div><button class="dvmore" data-dvmenu="folder:${esc(f.name)}" title="더보기">⋯</button></div>`;
  const dcardH = (x, i) => `<div class="dvdoc ${isCur(x) ? 'cur' : ''}" data-dvdoc="${i}" draggable="${trash ? 'false' : 'true'}"><div class="dvthumb" data-thumb="${i}"></div><div class="dvmeta"><b title="${nm(x)}">${nm(x)}</b><small>${when(x.lastModified)}${drv.view !== 'drive' && x.path.length ? ' · ' + esc(x.path.join(' › ')) : ''}${isCur(x) ? ' · <em>작업 중</em>' : ''}</small></div><button class="dvmore" data-dvmenu="doc:${i}" title="더보기">⋯</button></div>`;
  drv.docs = docs; drv.folders = folders;
  main.innerHTML = `${crumbs ? `<div class="crumbs">${crumbs}</div>` : `<h3 style="margin-top:4px">${title}</h3>`}
  <div class="dvbar"><div class="chips">${[['all', '전체'], ['folder', '폴더'], ['design', '디자인']].map(([k, t]) => `<button data-dvtab="${k}" class="${drv.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <input id="dvQ" placeholder="모든 폴더에서 디자인 검색" value="${esc(drv.q)}">
    <select id="dvSort"><option value="date" ${drv.sort === 'date' ? 'selected' : ''}>수정한 날짜</option><option value="name" ${drv.sort === 'name' ? 'selected' : ''}>이름</option></select>
    ${drv.view === 'drive' && !q ? '<button class="btn" data-dvact="mkdir"><svg class="ic" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10v6M9 13h6"/></svg>새 폴더</button>' : ''}
    ${trash && (folders.length || docs.length) ? '<button class="btn danger" data-dvact="empty">휴지통 비우기</button>' : ''}</div>
  ${trash ? '<p class="hint">휴지통의 항목은 "되살리기"로 내 드라이브 맨 위로 돌아갑니다. "영구 삭제"하면 되돌릴 수 없습니다.</p>' : drv.view === 'drive' && !q ? '<p class="hint">디자인을 끌어 폴더 위에 놓으면 그 폴더로 옮겨집니다. 이 폴더에서 "새 디자인 만들기"를 누르면 새 디자인이 이 폴더에 저장됩니다.</p>' : ''}
  ${drv.view === 'drive' && drv.path.length && !q ? `<div class="dvfolder up" data-crumb="${drv.path.length - 1}" data-dropdir="${esc(JSON.stringify(drv.path.slice(0, -1)))}"><svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/></svg><div><b>상위 폴더로</b><small>${esc(drv.path.length > 1 ? drv.path[drv.path.length - 2] : '내 드라이브')}</small></div></div>` : ''}
  ${folders.length ? `<div class="dvfolders">${folders.map(fcardH).join('')}</div>` : ''}
  ${docs.length ? `<div class="dvdocs">${docs.map(dcardH).join('')}</div>` : !folders.length ? `<p class="hint" style="margin-top:30px;text-align:center">${trash ? '휴지통이 비어 있습니다.' : q ? '맞는 디자인이 없습니다.' : '아직 디자인이 없습니다. 오른쪽 위 "새 디자인 만들기"로 시작하세요.'}</p>` : ''}`;
  const qi = $('#dvQ'); qi.oninput = () => { clearTimeout(drv.qt); drv.qt = setTimeout(() => { drv.q = qi.value; renderDrive().then(() => { const n = $('#dvQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 300); };
  $('#dvSort').onchange = e => { drv.sort = e.target.value; renderDrive(); };
  // 미리보기는 화면에 보일 때 첫 쪽만 그림
  const obs = new IntersectionObserver(ents => ents.forEach(en => { if (!en.isIntersecting) return; obs.unobserve(en.target); fillThumb(en.target, docs[Number(en.target.dataset.thumb)]); }), { root: main, rootMargin: '200px' });
  main.querySelectorAll('[data-thumb]').forEach(t => obs.observe(t));
}
async function fillThumb(box, x) {
  const key = x.path.join('/') + '/' + x.name + '@' + x.lastModified;
  let html = thumbCache.get(key);
  if (!html) {
    try {
      const j = JSON.parse(await (await x.handle.getFile()).text());
      const saved = doc; doc = Object.assign(newDoc(), j, { bleed: 0, cropMarks: false });
      try { html = { h: sheetHTML(j.pages[0], 'thumb'), w: j.w, hh: j.h, n: j.pages.length }; } finally { doc = saved; }
      thumbCache.set(key, html);
    } catch (e) { box.innerHTML = '<span class="hint">미리보기 없음</span>'; return; }
  }
  box.innerHTML = `<div class="tbox" data-w="${html.w}" data-h="${html.hh}">${html.h}</div>${html.n > 1 ? `<span class="pg">${html.n}쪽</span>` : ''}`;
  fitBoxes(box, '.tbox', 130);
}
async function driveClick(e) {
  const t = e.target;
  const nav = t.closest('[data-dvnav]'); if (nav) { const v = nav.dataset.dvnav; if (v === 'sync') { $('#dlgDrive').close(); openSaveDialog(); return; } drv.view = v; drv.q = ''; if (v === 'drive') drv.path = drv.path || []; renderDrive(); return; }
  const cr = t.closest('[data-crumb]'); if (cr) { drv.path = drv.path.slice(0, Number(cr.dataset.crumb)); drv.view = 'drive'; renderDrive(); return; }
  const tb = t.closest('[data-dvtab]'); if (tb) { drv.tab = tb.dataset.dvtab; renderDrive(); return; }
  const act = t.closest('[data-dvact]'); if (act) {
    const a = act.dataset.dvact;
    if (a === 'other') { $('#dlgDrive').close(); openOtherFile(); }
    if (a === 'mkdir') { const n = window.prompt('새 폴더 이름', '새 폴더'); if (n) { try { await store.makeFolder(drv.path, n); renderDrive(); } catch (err) { toast(err.message, true); } } }
    if (a === 'empty' && window.confirm('휴지통을 비울까요? 안의 디자인과 폴더가 영구히 삭제됩니다.')) { for (const x of drv.folders.concat(drv.docs)) await store.emptyEntry(x.name); toast('휴지통을 비웠습니다'); renderDrive(); }
    return;
  }
  const mm = t.closest('[data-dvmenu]'); if (mm) { e.stopPropagation(); driveMenu(mm, mm.dataset.dvmenu); return; }
  const mi = t.closest('[data-dvmi]'); if (mi) { const [kind, key, op] = mi.dataset.dvmi.split('|'); $('#dvPop') && $('#dvPop').remove(); await driveOp(kind, key, op); return; }
  if (!t.closest('#dvPop')) $('#dvPop') && $('#dvPop').remove();
  const f = t.closest('[data-dvfolder]'); if (f && drv.view !== 'trash') { drv.path = drv.path.concat(f.dataset.dvfolder); drv.view = 'drive'; drv.q = ''; renderDrive(); return; }
  const dc = t.closest('[data-dvdoc]'); if (dc && drv.view !== 'trash') { const x = drv.docs[Number(dc.dataset.dvdoc)]; try { await openFolderDoc(x.handle, `"${x.name.replace(/\.design\.json$/i, '')}"를 열었습니다`); $('#dlgDrive').close(); } catch (err) { toast('열 수 없습니다: ' + err.message, true); } }
}
function driveMenu(btn, spec) {
  $('#dvPop') && $('#dvPop').remove();
  const [kind, key] = spec.split(':'); const trash = drv.view === 'trash';
  const items = trash ? [['restore', '되살리기'], ['purge', '영구 삭제']] : kind === 'folder' ? [['open', '열기'], ['rename', '이름 바꾸기'], ['move', '다른 폴더로 이동…'], ['trash', '휴지통으로']] : [['open', '열기'], ['rename', '이름 바꾸기'], ['dup', '사본 만들기'], ['move', '다른 폴더로 이동…'], ['trash', '휴지통으로']];
  const p = document.createElement('div'); p.id = 'dvPop'; p.className = 'fmenu';
  p.innerHTML = items.map(([op, t]) => `<button data-dvmi="${kind}|${esc(key)}|${op}" class="${op === 'trash' || op === 'purge' ? 'danger' : ''}">${t}</button>`).join('');
  $('#dlgDrive').appendChild(p); const r = btn.getBoundingClientRect();
  p.style.left = Math.min(r.right - p.offsetWidth, innerWidth - p.offsetWidth - 8) + 'px'; p.style.top = (r.bottom + 4) + 'px';
}
async function pickFolder(exclude) {
  const all = await store.allFolders(); const opts = all.filter(p => !exclude || !p.join('/').startsWith(exclude));
  const list = opts.map((p, i) => `${i + 1}. ${p.length ? p.join(' › ') : '내 드라이브 (맨 위)'}`).join('\n');
  const a = window.prompt(`어느 폴더로 옮길까요? 번호를 넣으세요.\n\n${list}`, '1'); if (a == null) return null;
  const k = Number(a) - 1; if (!(k >= 0 && k < opts.length)) { toast('번호를 확인해 주세요', true); return null; } return opts[k];
}
async function driveOp(kind, key, op) {
  try {
    const st = store.state;
    if (kind === 'folder') {
      const f = drv.folders.find(x => x.name === key); if (!f) return; const from = drv.view === 'trash' ? [store.TRASH] : drv.path;
      if (op === 'open') { drv.path = f.path; renderDrive(); return; }
      if (op === 'rename') { const n = window.prompt('폴더 이름', f.name); if (!n || n === f.name) return; await store.moveEntry(f.handle, from, from, n.replace(/[\\/:*?"<>|]/g, '_').trim()); }
      if (op === 'move') { const to = await pickFolder(f.path.join('/')); if (!to) return; await store.moveEntry(f.handle, from, to); }
      if (op === 'trash') { const cp = await curDocPath(); if (cp && cp.join('/').startsWith(f.path.join('/'))) throw new Error('지금 작업 중인 디자인이 이 폴더 안에 있습니다. 다른 디자인을 먼저 여세요.'); if (!window.confirm(`"${f.name}" 폴더를 안의 디자인과 함께 휴지통으로 옮길까요?`)) return; await store.toTrash(f.handle, from); }
      if (op === 'restore') await store.moveEntry(f.handle, [store.TRASH], []);
      if (op === 'purge') { if (!window.confirm(`"${f.name}" 폴더를 영구 삭제할까요? 되돌릴 수 없습니다.`)) return; await store.emptyEntry(f.name); }
    } else {
      const x = drv.docs[Number(key)]; if (!x) return; const curP = await curDocPath();
      const isCur = st.handle && x.name === st.fileName && curP && curP.join('/') === x.path.join('/');
      const label = x.name.replace(/\.design\.json$/i, '');
      if (op === 'open') { await openFolderDoc(x.handle); $('#dlgDrive').close(); return; }
      if (op === 'rename') {
        const n = window.prompt('디자인 이름', label); if (!n || n === label) return;
        if (isCur) { doc.name = n.trim(); $('#pname').value = doc.name; markDirty(); clearTimeout(fileTimer); await saveFileNow(); }
        else { const j = JSON.parse(await (await x.handle.getFile()).text()); j.name = n.trim(); const w = await x.handle.createWritable(); await w.write(JSON.stringify(j)); await w.close(); }
        const nh = await store.moveEntry(x.handle, x.path, x.path, n.replace(/[\\/:*?"<>|]/g, '_').trim() + '.design.json');
        if (isCur) { st.handle = nh; st.fileName = nh.name; st.lastMod = (await nh.getFile()).lastModified; await store.idbSet('fileHandle', nh); updateSaveBadge(); }
      }
      if (op === 'dup') { const j = JSON.parse(await (await x.handle.getFile()).text()); j.name = (j.name || label) + ' 사본'; const d = await store.dirAt(x.path); const h = await d.getFileHandle(await store.uniqueNameIn(j.name, d), { create: true }); const w = await h.createWritable(); await w.write(JSON.stringify(Object.assign(j, { saveId: '', lineage: [] }))); await w.close(); toast('사본을 만들었습니다'); }
      if (op === 'move') { const to = await pickFolder(); if (!to) return; if (isCur && st.dirty) { clearTimeout(fileTimer); await saveFileNow(); } const nh = await store.moveEntry(x.handle, x.path, to); if (isCur) { st.handle = nh; st.fileName = nh.name; st.lastMod = (await nh.getFile()).lastModified; await store.idbSet('fileHandle', nh); updateSaveBadge(); } toast(`"${label}"을(를) ${to.length ? to.join(' › ') : '내 드라이브'}로 옮겼습니다`); }
      if (op === 'trash') { if (isCur) throw new Error('지금 작업 중인 디자인은 휴지통으로 보낼 수 없습니다. 다른 디자인을 먼저 여세요.'); await store.toTrash(x.handle, x.path); toast('휴지통으로 옮겼습니다'); }
      if (op === 'restore') { await store.moveEntry(x.handle, [store.TRASH], []); toast('내 드라이브로 되살렸습니다'); }
      if (op === 'purge') { if (!window.confirm(`"${label}"을(를) 영구 삭제할까요? 되돌릴 수 없습니다.`)) return; await store.emptyEntry(x.name); }
    }
    renderDrive();
  } catch (err) { toast(err.message, true); }
}
function driveDrag(e) { const dc = e.target.closest('[data-dvdoc]'); if (!dc) return; e.dataTransfer.setData('text/x-nc-doc', dc.dataset.dvdoc); e.dataTransfer.effectAllowed = 'move'; }
async function driveDrop(e) {
  const t = e.target.closest('[data-dropdir]'); if (!t) return; e.preventDefault(); t.classList.remove('over');
  const i = e.dataTransfer.getData('text/x-nc-doc'); if (i === '') return; const x = drv.docs[Number(i)]; if (!x) return;
  const to = JSON.parse(t.dataset.dropdir); if (to.join('/') === x.path.join('/')) return;
  try {
    const st = store.state, curP = await curDocPath(); const isCur = st.handle && x.name === st.fileName && curP && curP.join('/') === x.path.join('/');
    if (isCur && st.dirty) { clearTimeout(fileTimer); await saveFileNow(); }
    const nh = await store.moveEntry(x.handle, x.path, to);
    if (isCur) { st.handle = nh; st.fileName = nh.name; st.lastMod = (await nh.getFile()).lastModified; await store.idbSet('fileHandle', nh); updateSaveBadge(); }
    toast(`${to.length ? to[to.length - 1] : '내 드라이브'} 폴더로 옮겼습니다`); renderDrive();
  } catch (err) { toast(err.message, true); }
}

/* ---- 파일 메뉴: 저장 · 새 이름으로 저장 · 사본 만들기 ---- */
async function saveNow() {
  gcAssets();
  try {
    if (store.state.handle) { clearTimeout(fileTimer); await saveFileNow(); toast('저장했습니다'); return; }
    if (await store.folderReady()) { await store.saveIntoFolder(doc); setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); updateSaveBadge(); toast('동기화 폴더에 저장했습니다'); return; }
    if (store.state.supported) { await store.connectNew(doc); updateSaveBadge(); setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); toast('저장했습니다. 이제 바뀔 때마다 자동 저장됩니다.'); return; }
    store.download(doc); toast('이 브라우저는 파일 저장을 지원하지 않아 내려받았습니다');
  } catch (e) { if (e.name !== 'AbortError') toast('저장하지 못했습니다: ' + e.message, true); }
}
async function saveAs() {
  const nm = window.prompt('새 이름으로 저장합니다. 문서 이름을 입력하세요.\n(지금 파일은 마지막으로 저장된 상태로 그대로 남습니다)', doc.name || '새 디자인'); if (nm == null || !nm.trim()) return;
  gcAssets();
  try {
    if (store.state.handle && store.state.dirty) { clearTimeout(fileTimer); await saveFileNow(); }
    const prev = doc.name; doc.name = nm.trim(); $('#pname').value = doc.name;
    if (await store.folderReady()) { await store.saveIntoFolder(doc); }
    else if (store.state.supported) { try { await store.connectNew(doc); } catch (e) { doc.name = prev; $('#pname').value = prev; throw e; } }
    else { store.download(doc); }
    updateSaveBadge(); setStatus(`새 이름으로 저장됨 · ${store.state.fileName || doc.name}`); toast(`"${doc.name}"(으)로 저장했습니다. 이제 이 파일에서 작업합니다.`);
  } catch (e) { if (e.name !== 'AbortError') toast('저장하지 못했습니다: ' + e.message, true); }
}
async function duplicateDoc() {
  gcAssets();
  const copy = Object.assign(clone(doc), { name: (doc.name || '새 디자인') + ' 사본' });
  try {
    if (await store.folderReady()) {
      const h = await store.copyIntoFolder(copy);
      if (window.confirm(`사본 "${h.name.replace(/\.design\.json$/i, '')}"을(를) 동기화 폴더에 만들었습니다.\n\n확인: 사본을 열어 작업합니다\n취소: 지금 문서에서 계속 작업합니다`)) await openFolderDoc(h, '사본을 열었습니다');
      else toast('사본을 만들었습니다 (열기 목록에 있습니다)');
    } else { store.download(copy); toast('사본을 파일로 내려받았습니다'); }
  } catch (e) { toast('사본을 만들지 못했습니다: ' + e.message, true); }
}
function openFileMenu() {
  const old = $('#fmenu'); if (old) { old.remove(); return; }
  const st = store.state, b = $('#btnFileMenu').getBoundingClientRect();
  const m = document.createElement('div'); m.className = 'fmenu'; m.id = 'fmenu'; m.setAttribute('role', 'menu');
  m.innerHTML = `<div class="fstate">${st.handle ? `<b>${esc(st.fileName.replace(/\.design\.json$/i, ''))}</b><br>${st.dir ? '구글 드라이브 동기화 폴더에 자동 저장 중' : '파일에 자동 저장 중'}` : '아직 파일로 저장하지 않았습니다 (브라우저에만 저장 중)'}</div><hr>
  <button data-fm="save"><svg class="ic"><use href="#i-save"/></svg>저장<kbd>Ctrl+S</kbd></button>
  <button data-fm="saveas"><svg class="ic"><use href="#i-save"/></svg>새 이름으로 저장…<kbd>Ctrl+Shift+S</kbd></button>
  <button data-fm="dup"><svg class="ic"><use href="#i-dup"/></svg>사본 만들기 (복제)</button>
  <button data-fm="rename"><svg class="ic"><use href="#i-text"/></svg>이름 바꾸기</button><hr>
  <button data-fm="new"><svg class="ic"><use href="#i-new"/></svg>새 디자인…</button>
  <button data-fm="open"><svg class="ic"><use href="#i-folder"/></svg>내 드라이브 (열기)…<kbd>Ctrl+O</kbd></button>
  <button data-fm="down"><svg class="ic"><use href="#i-upload"/></svg>파일로 내려받기 (JSON)</button><hr>
  <button data-fm="sync"><svg class="ic"><use href="#i-folder"/></svg>저장 · 동기화 설정…</button>`;
  document.body.appendChild(m); m.style.left = Math.max(8, Math.min(b.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = (b.bottom + 6) + 'px';
  m.onclick = e => { const x = e.target.closest('[data-fm]'); if (!x) return; m.remove(); ({ save: saveNow, saveas: saveAs, dup: duplicateDoc, rename: () => { const p = $('#pname'); p.focus(); p.select(); }, new: openNewDesign, open: () => $('#btnOpen').click(), down: () => { gcAssets(); store.download(doc); }, sync: openSaveDialog })[x.dataset.fm](); };
  setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target) && ev.target.closest('#btnFileMenu') == null) { m.remove(); } document.removeEventListener('pointerdown', off); }), 0);
}
$('#btnFileMenu').onclick = openFileMenu;
// 저장 단축키 (입력 중에도 동작, 브라우저 기본 저장 창 막기)
document.addEventListener('keydown', e => { const mod = e.ctrlKey || e.metaKey; if (!mod) return; const k = e.key.toLowerCase();
  if (k === 's') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) saveAs(); else saveNow(); }
  else if (k === 'o' && !document.querySelector('dialog[open]')) { e.preventDefault(); $('#btnOpen').click(); } }, true);

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
    body.innerHTML = `<p class="hint">키는 이 브라우저와, 동기화 폴더가 연결돼 있으면 그 폴더의 설정 파일(설정.naracha.json)에 저장되어 다른 PC에서도 바로 쓰입니다. 키는 Anthropic·Google 서버로만 보내집니다. Claude 키는 console.anthropic.com, Gemini 키는 aistudio.google.com에서 만듭니다.</p>
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
  // ---- AI 그림 스튜디오: 스타일 프리셋 + 인물·동작·띠 조합 + 여러 동작 한 번에(같은 그림체) + 내 그림 보관함 ----
  const el = selEls()[0]; const targetImg = el && el.type === 'image' ? el : null; const S = aiStudio;
  const opt = (list, cur) => list.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${t}</option>`).join('');
  const canSave = !!store.state.dir;
  body.innerHTML = `<p class="hint" style="margin-top:0">${targetImg ? `선택한 이미지 "${esc(elName(targetImg))}"를 바꿉니다.` : '만든 그림을 누르면 현재 페이지에 넣습니다.'} ${canSave ? '마음에 드는 그림은 <b>내 그림</b>에 보관하면 두 PC에서 함께 씁니다 (요소 → 나라차 → AI로 만든 그림).' : '<b>동기화 폴더를 연결하면</b> 만든 그림을 내 그림 보관함에 저장해 두 PC에서 함께 쓸 수 있습니다.'}</p>
  <div class="tcats" id="aiStyles">${AI_STYLES.map(([k, t]) => `<button data-st="${k}" class="${S.style === k ? 'on' : ''}">${t}</button>`).join('')}</div>
  <div class="grid3">
    <label class="f"><span>주인공</span><select id="aiWho">${opt(AI_WHO, S.who)}</select></label>
    <label class="f"><span>띠 색</span><select id="aiBelt">${opt(AI_BELT, S.belt)}</select></label>
    <label class="f"><span>표정</span><select id="aiMood">${opt(AI_MOOD, S.mood)}</select></label>
  </div>
  <div class="f"><span style="font-size:12px;color:var(--ui-muted)">동작 (여러 개 고르면 같은 그림체로 한 장씩 만듭니다)</span><div class="tcats" id="aiMoves">${AI_MOVES.map(([k, t]) => `<button data-mv="${k}" class="${S.moves.includes(k) ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <label class="f"><span>추가 요청 (선택, 한국어 가능)</span><input type="text" id="aiExtra" value="${esc(S.extra)}" placeholder="예: 벚꽃 배경, 금메달을 목에 걸고, 친구와 하이파이브"></label>
  <details ${S.showPrompt ? 'open' : ''} id="aiPD"><summary class="hint" style="cursor:pointer">프롬프트 보기·고치기</summary><textarea id="aiPromptText" rows="5" style="width:100%">${esc(S.prompt || aiComposePrompt(S.moves[0] || 'ready'))}</textarea><div class="row"><button class="btn sm ai" id="aiPrompt">Claude로 다듬기</button><button class="btn sm" id="aiReset">조합대로 다시 쓰기</button></div></details>
  <div class="row" style="flex-wrap:wrap">
    <label class="chk"><input type="checkbox" id="aiWhite" ${S.white ? 'checked' : ''}> 흰 배경 지우기 (요소용)</label>
    <label class="chk"><input type="checkbox" id="aiAuto" ${S.autoSave && canSave ? 'checked' : ''} ${canSave ? '' : 'disabled'}> 만든 그림 자동 보관</label>
    <label class="f" style="margin:0"><span>동작마다</span><select id="aiN">${opt([['1', '1장'], ['2', '2장'], ['3', '3장']], String(S.n))}</select></label>
  </div>
  <div class="row"><button class="btn primary" id="aiGen">✨ 그림 만들기</button><span id="aiBusy"></span><span class="hint" style="margin:0" id="aiCount"></span></div>
  <div class="aiimgs" id="aiImgs"></div>`;
  const sync = () => { S.who = $('#aiWho').value; S.belt = $('#aiBelt').value; S.mood = $('#aiMood').value; S.extra = $('#aiExtra').value; S.white = $('#aiWhite').checked; S.autoSave = $('#aiAuto').checked; S.n = Number($('#aiN').value); S.showPrompt = $('#aiPD').open; };
  const recompose = () => { sync(); S.prompt = ''; $('#aiPromptText').value = aiComposePrompt(S.moves[0] || 'ready'); updCount(); };
  const updCount = () => { const n = Math.max(1, S.moves.length) * S.n; $('#aiCount').textContent = `${n}장을 만듭니다${n > 3 ? ' (한 장에 10~30초)' : ''}`; };
  updCount();
  $('#aiStyles').onclick = e => { const b = e.target.closest('[data-st]'); if (!b) return; sync(); S.style = b.dataset.st; const d = AI_STYLE[S.style]; S.white = d.white; if (d.who) S.who = d.who; S.prompt = ''; renderAI(); };
  $('#aiMoves').onclick = e => { const b = e.target.closest('[data-mv]'); if (!b) return; const k = b.dataset.mv; S.moves = S.moves.includes(k) ? S.moves.filter(x => x !== k) : S.moves.concat(k); b.classList.toggle('on'); recompose(); };
  ['aiWho', 'aiBelt', 'aiMood'].forEach(id => $('#' + id).onchange = recompose);
  $('#aiExtra').onchange = recompose; $('#aiN').onchange = () => { sync(); updCount(); };
  $('#aiReset').onclick = recompose;
  $('#aiPromptText').oninput = e => { S.prompt = e.target.value; };
  $('#aiPrompt').onclick = () => runAI(async () => { sync(); const t = await AI.refinePrompt($('#aiPromptText').value); $('#aiPromptText').value = t; S.prompt = t; });
  const card = (s, meta) => {
    const fig = document.createElement('figure');
    fig.innerHTML = `<img src="${s}" alt=""><figcaption><button class="btn sm primary">넣기</button>${canSave ? `<button class="btn sm" data-save>${meta.saved ? '보관됨 ✓' : '내 그림에 보관'}</button>` : ''}<button class="btn sm">내려받기</button></figcaption>`;
    const [bIns] = fig.querySelectorAll('button'); const bSave = fig.querySelector('[data-save]'), bDown = fig.querySelector('button:last-child');
    bIns.onclick = () => { const ref2 = addAsset(s); if (targetImg) { targetImg.src = ref2; delete targetImg.srcOrig; commit(); rerender(); } else addImage(ref2); toast('그림을 넣었습니다'); };
    if (bSave) { if (meta.saved) bSave.disabled = true; bSave.onclick = async () => { bSave.disabled = true; try { await NC.lib.saveMine(s, meta); bSave.textContent = '보관됨 ✓'; toast('내 그림에 보관했습니다 (요소 → 나라차 → AI로 만든 그림)'); } catch (err) { bSave.disabled = false; toast(err.message, true); } }; }
    bDown.onclick = () => { const a = document.createElement('a'); a.href = s; a.download = `${(meta.name || 'ai-image').replace(/[\\/:*?"<>|]/g, '_')}.png`; a.click(); };
    $('#aiImgs').prepend(fig);
  };
  $('#aiGen').onclick = () => runAI(async () => {
    sync(); const moves = S.moves.length ? S.moves : [null]; const total = moves.length * S.n; let k = 0;
    const custom = S.prompt && S.prompt.trim();
    let styleRef = S.style === 'mascot' ? ASSETS['mascot-01'] : null;  // 같은 그림체를 위해 첫 그림을 다음 동작의 참고 그림으로
    for (const mv of moves) {
      const prompt = custom && moves.length === 1 ? S.prompt : aiComposePrompt(mv || 'ready', !!styleRef && S.style !== 'mascot');
      for (let r = 0; r < S.n; r++) {
        $('#aiBusy').innerHTML = `<span class="spin"></span>${++k}/${total} 만드는 중…`;
        const imgs = await AI.geminiImage({ prompt, refImage: styleRef, aspect: AI_STYLE[S.style].aspect || '1:1' });
        for (let s of imgs) {
          if (S.white) { try { s = await NC.imgedit.removeColorFromSrc(s, '#ffffff'); } catch (e) {} }
          if (!styleRef && S.style !== 'scene' && S.style !== 'photo') styleRef = s;
          const meta = { name: aiName(mv), kw: aiKw(mv), prompt, style: S.style };
          if (S.autoSave && canSave) { try { await NC.lib.saveMine(s, meta); meta.saved = true; } catch (e) { toast(e.message, true); } }
          card(s, meta);
        }
      }
    }
    if (S.autoSave && canSave) toast('만든 그림을 내 그림에 보관했습니다');
  });
}
// ---- AI 그림 스튜디오 설정 ----
const AI_STYLES = [['cartoon', '귀여운 캐릭터'], ['sticker', '스티커'], ['flat', '플랫 일러스트'], ['water', '수채화'], ['mascot', '라차 마스코트'], ['photo', '실사 사진'], ['scene', '배경·장면']];
const AI_STYLE = {
  cartoon: { white: true, text: 'cute chibi cartoon character, big head small body (2.5 heads tall), large sparkling eyes, rosy cheeks, clean bold dark outline, soft cel shading, bright friendly colors, Korean webtoon style, full body, centered, isolated on a plain pure white background, no text' },
  sticker: { white: true, text: 'die-cut sticker illustration, thick white border around the character, bold outline, vibrant flat colors, cute and playful, full body, isolated on a plain pure white background, no text' },
  flat: { white: true, text: 'modern flat vector illustration, simple geometric shapes, limited palette of navy #002559, red #B82837, warm skin tones and white, minimal shading, clean edges, full body, isolated on a plain pure white background, no text' },
  water: { white: true, text: 'soft watercolor and ink illustration, gentle brush textures, light pastel washes, hand-drawn line art, warm and heartwarming, full body, isolated on a plain pure white background, no text' },
  mascot: { white: true, who: 'penguin', text: 'the penguin mascot exactly as in the attached reference (same design, colors and proportions), cute cartoon style, clean outline, full body, isolated on a plain pure white background, no text' },
  photo: { white: false, text: 'high quality realistic studio photograph, soft key light, sharp focus, natural skin tones, plain light gray seamless background, full body, no text' },
  scene: { white: false, aspect: '4:3', text: 'bright cheerful illustration scene for a children\'s taekwondo school poster, wide composition with room for text, soft colors, no text' },
};
const AI_WHO = [['boy', '남자아이'], ['girl', '여자아이'], ['kids', '아이들 여럿'], ['teen', '청소년'], ['man', '성인 남성'], ['woman', '성인 여성'], ['master', '사범님'], ['penguin', '펭귄 라차']];
const AI_WHO_EN = { boy: 'a cheerful 8-year-old Korean boy', girl: 'a cheerful 8-year-old Korean girl with a ponytail', kids: 'three happy Korean children (boys and girls, ages 6-10)', teen: 'a confident Korean teenager', man: 'a fit Korean man in his 30s', woman: 'a fit Korean woman in her 30s', master: 'a kind, confident Korean taekwondo master instructor', penguin: 'the gray penguin mascot' };
const AI_BELT = [['yellow', '노란띠'], ['white', '흰띠'], ['green', '초록띠'], ['blue', '파란띠'], ['red', '빨간띠'], ['poom', '품띠 (빨강·검정)'], ['black', '검은띠']];
const AI_BELT_EN = { white: 'a white belt', yellow: 'a yellow belt', green: 'a green belt', blue: 'a blue belt', red: 'a red belt', poom: 'a red-and-black poom belt and a red-black collar dobok', black: 'a black belt and a black-collar dobok' };
const AI_MOOD = [['happy', '밝게 웃는'], ['kiai', '기합! (입 벌림)'], ['focus', '진지한 집중'], ['proud', '뿌듯한'], ['wink', '윙크']];
const AI_MOOD_EN = { happy: 'big bright smile', kiai: 'shouting a powerful kihap with mouth open', focus: 'serious focused expression', proud: 'proud confident smile', wink: 'playful wink' };
const AI_MOVES = [['ready', '준비 자세'], ['bow', '경례(인사)'], ['frontkick', '앞차기'], ['sidekick', '옆차기'], ['roundkick', '돌려차기'], ['backkick', '뒤차기'], ['axekick', '내려차기'], ['jumpkick', '뛰어 차기'], ['punch', '지르기'], ['block', '막기'], ['poomsae', '품새'], ['break', '격파'], ['medal', '메달·트로피'], ['thumb', '엄지 척'], ['run', '달리기·줄넘기'], ['stretch', '스트레칭']];
const AI_MOVE_EN = { ready: 'standing in the taekwondo ready stance (junbi) with fists in front of the belt', bow: 'bowing politely with hands at the sides', frontkick: 'performing a high front kick (ap chagi)', sidekick: 'performing a powerful side kick (yeop chagi), body sideways', roundkick: 'performing a dynamic roundhouse kick (dollyeo chagi)', backkick: 'performing a back kick (dwit chagi)', axekick: 'performing an axe kick (naeryeo chagi) with the leg raised high', jumpkick: 'jumping high in the air doing a flying kick', punch: 'throwing a straight middle punch (jireugi) in a front stance', block: 'doing a low block (arae makgi) in a front stance', poomsae: 'performing a graceful poomsae form movement', break: 'breaking a wooden board with a kick, splinters flying', medal: 'holding up a shiny gold medal and a trophy, celebrating', thumb: 'giving an energetic thumbs-up', run: 'jumping rope happily', stretch: 'doing a split stretch on a mat' };
let aiStudio = { style: 'cartoon', who: 'boy', belt: 'yellow', mood: 'happy', moves: ['frontkick'], extra: '', white: true, autoSave: true, n: 1, prompt: '', showPrompt: false };
function aiComposePrompt(mv, withRef) {
  const S = aiStudio, st = AI_STYLE[S.style];
  const who = S.style === 'mascot' ? 'the penguin mascot wearing a white taekwondo dobok' : `${AI_WHO_EN[S.who]} wearing a clean white taekwondo dobok with ${AI_BELT_EN[S.belt]}`;
  const act = S.style === 'scene' ? 'in a bright taekwondo dojang' : AI_MOVE_EN[mv] || AI_MOVE_EN.ready;
  return `${who}, ${act}, ${AI_MOOD_EN[S.mood]}.${S.extra ? ' ' + S.extra + '.' : ''} ${st.text}.${withRef ? ' Match the exact art style, line weight, colors and character design of the attached reference image.' : ''}`;
}
function aiName(mv) { const t = k => (AI_MOVES.find(x => x[0] === k) || [])[1] || ''; const w = (AI_WHO.find(x => x[0] === aiStudio.who) || [])[1]; return `${t(mv) || 'AI 그림'} · ${aiStudio.style === 'mascot' ? '라차' : w} (${(AI_STYLES.find(x => x[0] === aiStudio.style) || [])[1]})`; }
function aiKw(mv) { const S = aiStudio; return ['AI', (AI_STYLES.find(x => x[0] === S.style) || [])[1], (AI_WHO.find(x => x[0] === S.who) || [])[1], (AI_BELT.find(x => x[0] === S.belt) || [])[1], (AI_MOVES.find(x => x[0] === mv) || [])[1], S.extra].filter(Boolean).join(' '); }
function aiF(label, key, type) { return `<label class="f"><span>${label}</span><input type="${type || 'text'}" data-ai="${key}" value="${esc(AI.cfg[key])}" autocomplete="off"></label>`; }
$('#aiBody').addEventListener('input', e => { const k = e.target.dataset.ai; if (k) { AI.cfg[k] = e.target.value.trim(); AI.saveCfg(); } });
$('#aiBody').addEventListener('change', e => { const k = e.target.dataset.ai; if (k) { AI.cfg[k] = e.target.value.trim(); AI.saveCfg(); } });
async function runAI(fn) { const busy = $('#aiBusy'); const btns = $$('#aiBody button'); btns.forEach(b => b.disabled = true); if (busy) busy.innerHTML = '<span class="spin"></span>요청 중…'; try { await fn(); if (busy) busy.textContent = '완료'; } catch (err) { if (busy) busy.textContent = ''; toast(err.message, true); } finally { btns.forEach(b => b.disabled = false); } }

/* ---- 내보내기 ---- */
/* ---- 다운로드 (미리캔버스식): PNG · JPG · PDF(웹/인쇄) — 작업한 크기 그대로 바로 받기 ---- */
const DL_FMTS = [['pdfhq', 'PDF (고화질)', '보관·인쇄에 알맞은 300dpi 문서', '권장'], ['jpg', 'JPG', '공유에 알맞은 이미지'], ['png', 'PNG', '압축 손실 없는 고품질 이미지'], ['pdfweb', 'PDF (가벼운 공유용)', '카톡·메일로 보내기 좋은 200dpi 문서'], ['pdfprint', 'PDF (인쇄소용)', '300dpi 무손실 · 도련 포함 (재단선은 선택)'], ['pdfvector', 'PDF (벡터 · 인쇄 창)', '글자가 가장 선명 · 브라우저 인쇄 창에서 "PDF로 저장"']];
// PDF 종류별 해상도·압축 품질
const DL_PDF = { pdfhq: { dpi: 300, q: 0.92, bleed: false }, pdfweb: { dpi: 200, q: 0.88, bleed: false }, pdfprint: { dpi: 300, q: 0.97, bleed: true, png: true } };
let dlState = { fmt: 'pdfhq', scale: 3, pages: 'all', range: '', merge: false, imgBleed: false };
function loadScript(src, test) { if (test()) return Promise.resolve(); return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('모듈을 불러오지 못했습니다 (인터넷 필요)')); document.head.appendChild(s); }); }
function dlPages() {
  const n = doc.pages.length; if (dlState.pages === 'cur') return [cur];
  if (dlState.pages === 'range') { const out = []; (dlState.range || '').split(',').forEach(p => { const m = p.trim().match(/^(\d+)(?:\s*[-~]\s*(\d+))?$/); if (!m) return; const a = Number(m[1]), b = Number(m[2] || m[1]); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= n) out.push(i - 1); }); return [...new Set(out)]; }
  return doc.pages.map((_, i) => i);
}
// 캔버스 한계 안에서 쓸 수 있는 dpi
function dlDpi(want, bleed) { const W = (doc.w + 2 * bleed) / 25.4, H = (doc.h + 2 * bleed) / 25.4; return Math.max(24, Math.min(want, 14000 / W, 14000 / H, Math.sqrt(120e6 / (W * H)))); }
function openDownload(fmt) {
  if (fmt) dlState.fmt = fmt;
  const pxDoc = Math.abs(doc.w * 96 / 25.4 - Math.round(doc.w * 96 / 25.4)) < 0.05 && Math.abs(doc.h * 96 / 25.4 - Math.round(doc.h * 96 / 25.4)) < 0.05 && doc.w > 150; if (dlState.docKey !== doc.w + 'x' + doc.h) { dlState.docKey = doc.w + 'x' + doc.h; dlState.scale = pxDoc ? 1 : 3.125; }
  let p = $('#dlPanel'); if (p) { p.remove(); if (!fmt) return; }
  p = document.createElement('div'); p.id = 'dlPanel'; p.className = 'dlpanel'; document.body.appendChild(p);
  const b = $('#btnExport').getBoundingClientRect(); p.style.right = Math.max(8, innerWidth - b.right) + 'px'; p.style.top = (b.bottom + 8) + 'px';
  renderDownload();
  setTimeout(() => document.addEventListener('pointerdown', function off(ev) { const q = $('#dlPanel'); if (!q) { document.removeEventListener('pointerdown', off); return; } if (!q.contains(ev.target) && !ev.target.closest('#btnExport') && !ev.target.closest('dialog')) { q.remove(); document.removeEventListener('pointerdown', off); } }), 0);
}
function renderDownload() {
  const p = $('#dlPanel'); if (!p) return; const S = dlState, f = DL_FMTS.find(x => x[0] === S.fmt);
  const img = S.fmt === 'jpg' || S.fmt === 'png', n = dlPages().length;
  const bleed = (S.fmt === 'pdfprint' || S.fmt === 'pdfvector' || (img && S.imgBleed)) ? (Number(doc.bleed) || 0) : 0;
  let dpi = img ? dlDpi(96 * S.scale, bleed) : DL_PDF[S.fmt] ? dlDpi(DL_PDF[S.fmt].dpi, bleed) : 0;
  if (img && S.merge && n > 1) dpi = Math.min(dpi, dlMergeDpi(n, bleed));
  const px = v => Math.round(v / 25.4 * dpi);
  p.innerHTML = `<div class="dlhead"><b>다운로드</b><button class="x" data-dl="close">×</button></div>
  <label class="f"><span>파일 형식</span></label><div class="dlfmts">${DL_FMTS.map(([k, t, d, tag]) => `<button data-fmt2="${k}" class="${S.fmt === k ? 'on' : ''}"><b>${t}${tag ? ` <em>${tag}</em>` : ''}</b><small>${d}</small></button>`).join('')}</div>
  ${img ? `<label class="f"><span>크기</span><select id="dlScale">${[[1, '1배 (화면·SNS용 96dpi)'], [2, '2배 (선명하게 192dpi)'], [3.125, '인쇄용 300dpi'], [3.646, '고급 인쇄 350dpi']].map(([v, t]) => `<option value="${v}" ${S.scale === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
  <label class="f"><span>페이지 선택</span><select id="dlPages"><option value="all" ${S.pages === 'all' ? 'selected' : ''}>모든 페이지 (1~${doc.pages.length})</option><option value="cur" ${S.pages === 'cur' ? 'selected' : ''}>현재 페이지 (${cur + 1})</option><option value="range" ${S.pages === 'range' ? 'selected' : ''}>직접 입력</option></select></label>
  ${S.pages === 'range' ? `<label class="f"><input id="dlRange" placeholder="예: 1-3, 5" value="${esc(S.range)}"></label>` : ''}
  ${img && n > 1 ? `<label class="chk"><input type="checkbox" id="dlMerge" ${S.merge ? 'checked' : ''}> 한 장의 이미지로 합치기 (세로로 이어 붙임)</label>` : ''}
  ${img && Number(doc.bleed) > 0 ? `<label class="chk"><input type="checkbox" id="dlImgBleed" ${S.imgBleed ? 'checked' : ''}> 도련 ${doc.bleed}mm 포함 (명함·스티커를 인쇄소에 이미지로 보낼 때)</label>` : ''}
  <div class="dlinfo"><b>다운로드 정보</b><ul><li>${n} 페이지${img && n > 1 && !S.merge ? ' (ZIP 파일로 묶음)' : ''}</li><li>${doc.w} × ${doc.h} mm${bleed ? ` (+도련 ${bleed}mm)` : ''}</li>${dpi ? `<li>${px(doc.w + 2 * bleed).toLocaleString()} × ${(px(doc.h + 2 * bleed) * (img && S.merge && n > 1 ? n : 1)).toLocaleString()} px · ${Math.round(dpi)}dpi${(img ? Math.round(dpi) < Math.round(96 * S.scale) - 1 : DL_PDF[S.fmt] && Math.round(dpi) < DL_PDF[S.fmt].dpi - 1) ? ' <b>(크기가 커서 브라우저 한계에 맞춰 낮춤)</b>' : ''}</li>` : '<li>브라우저 인쇄 창에서 "대상: PDF로 저장", "여백: 없음", "배경 그래픽: 켬"</li>'}</ul>
  ${S.fmt === 'pdfprint' ? `<p class="hint" style="margin:6px 0 0">${bleed ? `도련 ${bleed}mm 포함 작업 사이즈${doc.cropMarks ? ' + 재단선(도련 바깥)' : ''}.` : '<b>도련이 0mm입니다.</b> 프로젝트 탭에서 도련을 넣으세요 (보통 1.5~3mm).'} 대부분의 인쇄소는 재단선 없는 작업 사이즈 파일을 받습니다.<br>이 PDF는 RGB 색입니다. 인쇄소에 "RGB→CMYK 변환, 검정 글자는 K100 단색"을 요청하고, 밝은 파랑·초록은 인쇄 시 탁해질 수 있으니 시안(교정쇄)으로 확인하세요.</p>` : ''}${S.fmt === 'pdfweb' ? '<p class="hint" style="margin:6px 0 0">확대하거나 인쇄하면 글자가 덜 선명할 수 있습니다. 인쇄·보관용은 "PDF (고화질)"을 쓰세요.</p>' : ''}</div>
  <div class="dlprog" id="dlProg"></div>
  <button class="btn primary full" id="dlGo"><svg class="ic"><use href="#i-upload"/></svg>${S.fmt === 'pdfvector' ? '인쇄 창 열기' : '고해상도 다운로드'}</button>`;
  p.onclick = e => { const c = e.target.closest('[data-dl="close"]'); if (c) { p.remove(); return; } const fm = e.target.closest('[data-fmt2]'); if (fm) { S.fmt = fm.dataset.fmt2; renderDownload(); } };
  const sc = $('#dlScale'); if (sc) sc.onchange = e => { S.scale = Number(e.target.value); renderDownload(); };
  $('#dlPages').onchange = e => { S.pages = e.target.value; renderDownload(); };
  const rg = $('#dlRange'); if (rg) { rg.onchange = e => { S.range = e.target.value; renderDownload(); }; }
  const mg = $('#dlMerge'); if (mg) mg.onchange = e => { S.merge = e.target.checked; renderDownload(); };
  const ib = $('#dlImgBleed'); if (ib) ib.onchange = e => { S.imgBleed = e.target.checked; renderDownload(); };
  $('#dlGo').onclick = runDownload;
}
// 페이지를 그림으로: 브라우저 자체 렌더링(SVG foreignObject, html-to-image)을 써서 편집 화면과 똑같이 —
// 광선·그림자·혼합 모드·그라데이션 글자·필터까지 그대로. 실패하면 html2canvas로 대신 그림
const fontDataCache = new Map(); let fontCssText = null;
async function fontCSSFor(node) {
  const used = new Set(); node.querySelectorAll('*').forEach(e => getComputedStyle(e).fontFamily.split(',').forEach(f => used.add(f.trim().replace(/^["']|["']$/g, ''))));
  if (!fontCssText) { try { fontCssText = await (await fetch('fonts/fonts.css')).text(); } catch (e) { fontCssText = null; } }
  const toData = async url => { if (!fontDataCache.has(url)) fontDataCache.set(url, fetch(url).then(r => r.blob()).then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }))); return fontDataCache.get(url); };
  const out = [];
  for (const block of (fontCssText || '').match(/@font-face\s*{[^}]*}/g) || []) {
    const fam = (block.match(/font-family:\s*['"]?([^;'"]+)['"]?/) || [])[1]; if (!fam || !used.has(fam.trim())) continue;
    let css = block; for (const m of block.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) { const u = new URL(m[1], new URL('fonts/fonts.css', location.href)).href; try { css = css.replace(m[0], `url(${await toData(u)})`); } catch (e) {} }
    out.push(css);
  }
  doc.fonts.forEach(f => { if (used.has(f.family)) out.push(`@font-face{font-family:'${f.family}';src:url(${f.data})}`); });
  return out.join('\n');
}
let dlFallback = 0;
async function renderPageCanvas(pg, dpi, mode, bg) {
  const c = await renderPageCanvas0(pg, dpi, mode, bg);
  // 정확한 픽셀 크기로 (예: 1080×1350, 반올림 오차로 생기는 흰 줄 없앰)
  const b = mode === 'print' ? (Number(doc.bleed) || 0) : 0, tw = Math.round((doc.w + 2 * b) / 25.4 * dpi), th = Math.round((doc.h + 2 * b) / 25.4 * dpi);
  if (Math.abs(c.width - tw) <= 3 && Math.abs(c.height - th) <= 3 && (c.width !== tw || c.height !== th)) { const o = document.createElement('canvas'); o.width = tw; o.height = th; const g = o.getContext('2d'); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, tw, th); } g.drawImage(c, 0, 0, tw, th); c.width = c.height = 0; return o; }
  return c;
}
async function renderPageCanvas0(pg, dpi, mode, bg) {
  const keepMarks = doc.cropMarks; doc.cropMarks = false;  // 재단선은 PDF 단계에서 도련 바깥에 따로 그림
  const tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-99999px;top:0'; try { tmp.innerHTML = sheetHTML(pg, mode); } finally { doc.cropMarks = keepMarks; } document.body.appendChild(tmp);
  try {
    await Promise.all(Array.from(tmp.querySelectorAll('img')).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
    const node = tmp.firstElementChild;
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js', () => window.htmlToImage);
      const r = node.getBoundingClientRect();
      return await htmlToImage.toCanvas(node, { pixelRatio: dpi / 96, width: Math.ceil(r.width), height: Math.ceil(r.height), backgroundColor: bg || undefined, fontEmbedCSS: await fontCSSFor(node), cacheBust: false, skipAutoScale: true });
    } catch (err) {
      console.warn('브라우저 렌더링 실패, html2canvas로 대신 그림', err); dlFallback++;
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', () => window.html2canvas);
      return await html2canvas(node, { scale: dpi / 96, backgroundColor: bg, logging: false, useCORS: true });
    }
  } finally { tmp.remove(); }
}
async function runDownload() {
  endEdit(); const S = dlState, pages = dlPages(); if (!pages.length) { toast('페이지 번호를 확인해 주세요', true); return; }
  const base = (doc.name || 'design').replace(/[\\/:*?"<>|]/g, '_');
  if (S.fmt === 'pdfvector') { $('#dlPanel').remove(); printVector(pages); return; }
  const prog = $('#dlProg'), go = $('#dlGo'); go.disabled = true; dlFallback = 0;
  const say = t => { prog.innerHTML = `<span class="spin"></span>${t}`; };
  const free = c => { c.width = c.height = 0; };  // 쪽마다 메모리 바로 비움
  try {
    say('모듈 불러오는 중…');
    try { await document.fonts.ready; } catch (e) {}
    const img = S.fmt === 'jpg' || S.fmt === 'png';
    if (img) {
      const bl = S.imgBleed && Number(doc.bleed) > 0 ? Number(doc.bleed) : 0, mode = bl ? 'print' : 'thumb';
      let dpi = dlDpi(96 * S.scale, bl); const type = S.fmt === 'png' ? 'image/png' : 'image/jpeg', ext = S.fmt, bg = S.fmt === 'png' ? null : '#ffffff';
      const toBlob = c => new Promise((r, rej) => c.toBlob(b => b ? r(b) : rej(new Error('이미지가 너무 큽니다. 크기를 줄이거나 ZIP으로 받아 주세요')), type, 0.92));
      if (pages.length > 1 && S.merge) {
        dpi = Math.min(dpi, dlMergeDpi(pages.length, bl));
        const pw = Math.round((doc.w + 2 * bl) / 25.4 * dpi), ph = Math.round((doc.h + 2 * bl) / 25.4 * dpi);
        const m = document.createElement('canvas'); m.width = pw; m.height = ph * pages.length; const g = m.getContext('2d'); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, m.width, m.height); }
        for (let i = 0; i < pages.length; i++) { say(`${i + 1}/${pages.length} 페이지 그리는 중…`); const c = await renderPageCanvas(doc.pages[pages[i]], dpi, mode, bg); g.drawImage(c, 0, i * ph, pw, ph); free(c); }
        saveBlob(await toBlob(m), `${base}.${ext}`); free(m);
      } else if (pages.length === 1) {
        const c = await renderPageCanvas(doc.pages[pages[0]], dpi, mode, bg); saveBlob(await toBlob(c), `${base}-${pages[0] + 1}.${ext}`); free(c);
      } else {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', () => window.JSZip);
        const zip = new JSZip();
        for (let i = 0; i < pages.length; i++) { say(`${i + 1}/${pages.length} 페이지 그리는 중…`); const c = await renderPageCanvas(doc.pages[pages[i]], dpi, mode, bg); zip.file(`${base}-${String(pages[i] + 1).padStart(2, '0')}.${ext}`, await toBlob(c)); free(c); }
        say('ZIP으로 묶는 중…'); saveBlob(await zip.generateAsync({ type: 'blob' }), `${base}.zip`);
      }
    } else {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => window.jspdf);
      const cfg = DL_PDF[S.fmt], bleed = cfg.bleed ? (Number(doc.bleed) || 0) : 0;
      // 재단선을 켜면 도련 바깥에 5mm 여백(슬러그)을 더 두고 그곳에 가는 선으로 그림
      const slug = cfg.bleed && doc.cropMarks ? 5 : 0;
      const W = doc.w + 2 * (bleed + slug), H = doc.h + 2 * (bleed + slug), dpi = dlDpi(cfg.dpi, bleed);
      const pdf = new jspdf.jsPDF({ unit: 'mm', format: [W, H], orientation: W > H ? 'landscape' : 'portrait', compress: true });
      pdf.setProperties({ title: doc.name || 'design', creator: '나라차 디자인 공방' });
      const pt = v => v / 25.4 * 72;
      for (let i = 0; i < pages.length; i++) {
        say(`${i + 1}/${pages.length} 페이지 그리는 중…`);
        const c = await renderPageCanvas(doc.pages[pages[i]], dpi, bleed ? 'print' : 'thumb', '#ffffff');
        if (i) pdf.addPage([W, H], W > H ? 'landscape' : 'portrait');
        // 인쇄소용은 무손실(색 번짐 없음), 그 밖은 JPEG
        if (cfg.png) pdf.addImage(c, 'PNG', slug, slug, doc.w + 2 * bleed, doc.h + 2 * bleed, `p${i}`, 'FAST');
        else pdf.addImage(c.toDataURL('image/jpeg', cfg.q), 'JPEG', slug, slug, doc.w + 2 * bleed, doc.h + 2 * bleed, `p${i}`, 'NONE');
        free(c);
        if (slug) { pdf.setDrawColor(0); pdf.setLineWidth(0.09); const x0 = slug + bleed, y0 = slug + bleed, x1 = x0 + doc.w, y1 = y0 + doc.h, L = slug - 1, gap = bleed + 1;
          [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]].forEach(([x, y, sx, sy]) => { pdf.line(x + sx * gap, y, x + sx * (gap + L), y); pdf.line(x, y + sy * gap, x, y + sy * (gap + L)); }); }
        // 인쇄소 프로그램이 읽는 재단·도련 영역 (pt, 왼쪽 아래 기준)
        try { const pc = pdf.internal.getCurrentPageInfo().pageContext; if (bleed || slug) { pc.trimBox = { bottomLeftX: pt(slug + bleed), bottomLeftY: pt(slug + bleed), topRightX: pt(slug + bleed + doc.w), topRightY: pt(slug + bleed + doc.h) }; pc.bleedBox = { bottomLeftX: pt(slug), bottomLeftY: pt(slug), topRightX: pt(slug + 2 * bleed + doc.w), topRightY: pt(slug + 2 * bleed + doc.h) }; } } catch (e) {}
      }
      saveBlob(pdf.output('blob'), `${base}.pdf`);
    }
    prog.textContent = '다운로드했습니다'; toast(dlFallback ? `다운로드했습니다. ${dlFallback}쪽은 대체 방식으로 그려 일부 효과가 화면과 다를 수 있습니다 (Chrome·Edge 최신 버전 권장)` : '다운로드했습니다', !!dlFallback);
  } catch (e) { prog.textContent = ''; toast('다운로드 실패: ' + e.message, true); } finally { go.disabled = false; }
}
// 여러 쪽을 한 장으로 합칠 때 브라우저 한계(한 변 32,000px·1억 화소) 안의 해상도
function dlMergeDpi(n, bl) { const W = (doc.w + 2 * bl) / 25.4, H = (doc.h + 2 * bl) / 25.4 * n; return Math.max(24, Math.min(30000 / H, 30000 / W, Math.sqrt(100e6 / (W * H)))); }
function saveBlob(b, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function printVector(pages) {
  const b = Math.max(0, Number(doc.bleed) || 0);
  $('#pageStyle').textContent = `@page{size:${doc.w + 2 * b}mm ${doc.h + 2 * b}mm;margin:0}`;
  $('#canvas').innerHTML = ''; const th = $('#thumbs'); if (th) th.innerHTML = '';  // SVG id 중복 방지
  const root = $('#printRoot'); root.innerHTML = pages.map(i => sheetHTML(doc.pages[i], 'print')).join('');
  setStatus('PDF 준비 중…');
  const fams = new Set(); root.querySelectorAll('*').forEach(e => getComputedStyle(e).fontFamily.split(',').forEach(f => fams.add(f.trim().replace(/^["']|["']$/g, ''))));
  try { await Promise.all([...fams].flatMap(f => [400, 700].map(w => document.fonts.load(`${w} 12px "${f}"`, '가A').catch(() => {})))); await document.fonts.ready; } catch (e) {}
  await Promise.all(Array.from(root.querySelectorAll('img')).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
  const done = () => { window.removeEventListener('afterprint', done); root.innerHTML = ''; renderAll(); setStatus(''); };
  window.addEventListener('afterprint', done);
  setStatus('인쇄 창을 열었습니다 (대상: PDF로 저장, 여백: 없음, 배경 그래픽: 켬)'); window.print();
}
$('#btnExport').onclick = () => openDownload();

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
  const busy = () => editing || drag || pen || $('#cellEd') || document.querySelector('dialog[open]') || $('#dlPanel') || store.state.saving;
  function tryReload() { if (busy()) { setTimeout(tryReload, 15000); return; } setStatus(`새 버전(${pending})이 있어 잠시 후 새로고침합니다`); toast('새 버전이 올라와 10초 뒤 자동으로 새로고침합니다. 작업은 자동 저장되어 있습니다.');
    setTimeout(async () => { if (busy()) { setTimeout(tryReload, 15000); return; } clearTimeout(nudgeTimer); if (store.state.handle && store.state.dirty) { clearTimeout(fileTimer); await saveFileNow(); } try { await store.idbSet('doc', doc); } catch (e) {} location.href = location.pathname + '?v=' + pending; }, 10000); }
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
    if (p === 'granted') { const j = await store.readFile(); await loadDoc(j); loaded = true; setStatus(`연결된 파일: ${store.state.fileName}`); setTimeout(() => warnIfRecentOther(j), 1500); }
    else if (p === 'prompt') { const saved = await store.idbGet('doc'); if (saved) { await loadDoc(saved); loaded = true; } const st = $('#status'); st.innerHTML = `<button class="btn sm" id="reconn">연결된 파일 "${esc(store.state.fileName)}" 다시 열기</button>`; $('#reconn').onclick = async () => { if (await store.requestPermission()) { const j = await store.readFile(); await loadDoc(j, '연결된 파일을 열었습니다'); updateSaveBadge(); } }; }
  } catch (e) { console.warn(e); }
  if (!loaded) { try { const saved = await store.idbGet('doc'); if (saved) { await loadDoc(saved); loaded = true; setStatus('브라우저 저장본을 불러왔습니다'); } } catch (e) {} }
  if (!loaded) { doc = newDoc(); doc.calendar.year = 2027; doc.name = '2027 인성 캘린더'; doc.pages = CAL.buildPages(doc, uid, { year: 2027, kind: 'full' }); ensureAllHolidays(); $('#pname').value = doc.name; hist = [snapshot()]; histMeta = [{ cur: 0, sel: [] }]; hptr = 0; renderAll(); setStatus('2027년 캘린더 초안을 만들었습니다. 공휴일은 자동으로 들어갔습니다.'); freshDraft = true; }
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
