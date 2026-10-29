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
// 화면에 그릴 때는 긴 data URL 대신 한 번 만든 blob 주소를 씀 (26쪽 캘린더도 수십 MB 문자열을 매번 다시 만들지 않게)
const blobOf = new Map(); // 그림 키 → { data, url }
function blobURL(key, d) {
  if (!d || !d.startsWith('data:') || d.length < 3000) return d || '';
  const c = blobOf.get(key); if (c && c.data === d) return c.url;
  try { const i = d.indexOf(','), meta = d.slice(5, i), mime = meta.split(';')[0], raw = /;base64/.test(meta) ? atob(d.slice(i + 1)) : decodeURIComponent(d.slice(i + 1)); const arr = new Uint8Array(raw.length); for (let k = 0; k < raw.length; k++) arr[k] = raw.charCodeAt(k) & 255; const url = URL.createObjectURL(new Blob([arr], { type: mime })); blobOf.set(key, { data: d, url }); /* 예전 주소는 다른 화면(미리보기 등)이 쓰고 있을 수 있어 해제하지 않음 */ return url; } catch (e) { return d; }
}
const PREV_MAX = 2048, prevOf = new Map(); // 원본 주소 → { url } (작은 그림이면 {}), 만드는 중이면 null
let prevTimer = 0;
function makePreview(full) {
  prevOf.set(full, null);
  fetch(full).then(r => r.blob()).then(b => /svg/.test(b.type) ? null : createImageBitmap(b).then(bm => ({ bm, type: b.type }))).then(r => {
    if (!r) { prevOf.set(full, {}); return; }
    const { bm } = r, L = Math.max(bm.width, bm.height);
    if (L <= PREV_MAX * 1.3) { bm.close && bm.close(); prevOf.set(full, {}); return; }
    const k = PREV_MAX / L, cv = document.createElement('canvas'); cv.width = Math.round(bm.width * k); cv.height = Math.round(bm.height * k);
    const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bm, 0, 0, cv.width, cv.height); bm.close && bm.close();
    cv.toBlob(bl => { if (!bl) { prevOf.set(full, {}); return; } prevOf.set(full, { url: URL.createObjectURL(bl) }); clearTimeout(prevTimer); prevTimer = setTimeout(() => { if (!drag && !editing) renderCanvas(); }, 250); }, /jpe?g/.test(r.type) ? 'image/jpeg' : 'image/png', 0.92);
  }).catch(() => prevOf.set(full, {}));
}
// 편집 화면에서 쓸 그림 주소 (썸네일·내보내기는 'thumb'·'print'로 원본을 씀): 화면에 작게 보일 때는 미리보기, 크게 확대하면 원본
function viewSrc(el, mode) {
  const full = src(el.src); if (!full || mode !== 'edit' || /^https?:/.test(full) && !full.startsWith(location.origin)) return full;
  const p = prevOf.get(full); if (p === undefined) { makePreview(full); return full; }
  if (!p || !p.url) return full;
  const onScreen = Math.max(el.w, el.h) * (el.zoom || 1) * MM * kScale() * (window.devicePixelRatio || 1);
  return onScreen < PREV_MAX * 0.8 ? p.url : full;
}
function src(ref) { if (!ref) return ''; if (ref.startsWith('asset:')) return blobURL(ref, ASSETS[ref.slice(6)]); if (ref.startsWith('a:')) return blobURL(ref, doc.assets[ref.slice(2)]); if (ref.startsWith('lib:')) return NC.lib.url(ref.slice(4)); return ref; }
function addAsset(dataURL) { for (const k in doc.assets) if (doc.assets[k] === dataURL) return 'a:' + k; const id = uid(); doc.assets[id] = dataURL; return 'a:' + id; }
function gcAssets() { const used = new Set(); const walk = v => { if (typeof v === 'string' && v.startsWith('a:')) used.add(v.slice(2)); else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(doc.pages); walk(doc.calendar); walk(doc.audio); hist.forEach(h => { for (const m of h.matchAll(/"a:([^"]+)"/g)) used.add(m[1]); }); for (const k in doc.assets) if (!used.has(k)) delete doc.assets[k]; } // 실행 취소 기록에 남은 그림도 지키기 (저장 뒤 Ctrl+Z로 지운 사진 되살리기)

/* ---------- 실행 취소 ---------- */
// 기록에는 내용만: 그림·올린 글꼴(수 MB)·이름·문서 번호·저장 시각은 빼고, 되돌릴 때 지금 값을 그대로 둠
const HIST_LIVE = ['assets', 'fonts', 'name', 'docId', 'updatedAt'];
function snapshot() { const keep = {}; HIST_LIVE.forEach(k => { keep[k] = doc[k]; delete doc[k]; }); const s = JSON.stringify(doc); Object.assign(doc, keep); return s; }
let histMeta = [];  // 기록마다 그때 보던 쪽·선택
function commit() { const s_ = snapshot(); if (hist[hptr] === s_) return; hist = hist.slice(0, hptr + 1); histMeta = histMeta.slice(0, hptr + 1); hist.push(s_); histMeta.push({ cur, sel: sel.slice(), rn: NC.live.rn }); if (hist.length > 120) { hist.shift(); histMeta.shift(); } hptr = hist.length - 1; markDirty(); }
// 바로 앞 기록을 고쳐 씀 (그림 비율 맞춤처럼 한 동작의 뒷처리)
function amendCommit() { if (hptr < 0) return commit(); hist[hptr] = snapshot(); histMeta[hptr].rn = NC.live.rn; markDirty(); }
let nudgeTimer = null; function commitSoon() { clearTimeout(nudgeTimer); nudgeTimer = setTimeout(() => { nudgeTimer = null; commit(); }, 450); }
function flushNudge() { if (nudgeTimer) { clearTimeout(nudgeTimer); nudgeTimer = null; commit(); } }
function restore(s, meta) { const live = {}; HIST_LIVE.forEach(k => { live[k] = doc[k]; }); doc = Object.assign(JSON.parse(s), live); if (meta) { cur = meta.cur; sel = meta.sel.slice(); } cur = clamp(cur, 0, doc.pages.length - 1); sel = sel.filter(id => find(id)); cellSel = null; renderAll(); markDirty(); }
function undo() { flushNudge(); if (hptr > 0) { const m = histMeta[hptr]; hptr--; if (NC.live.peers()) liveStep(hptr + 1, hptr, m); else restore(hist[hptr], m); } }
function redo() { flushNudge(); if (hptr < hist.length - 1) { hptr++; if (NC.live.peers()) liveStep(hptr - 1, hptr, histMeta[hptr]); else restore(hist[hptr], histMeta[hptr]); } }
// 실시간 연결 중의 되돌리기: 기록 a→b 사이의 내 변경만 지금 문서에 적용 (그 사이 받은 상대 변경은 건드리지 않음)
function liveStep(a, b, meta) { endEdit(); NC.live.step(hist[a], hist[b], histMeta[a], histMeta[b]); if (meta) { cur = meta.cur; sel = meta.sel.slice(); } cur = clamp(cur, 0, doc.pages.length - 1); sel = sel.filter(id => find(id)); cellSel = null; renderAll(); markDirty(); }

/* ---------- 저장 · 동기화 ---------- */
// 창을 닫거나 새로 고칠 때: 미뤄 둔 미세 이동을 기록하고 브라우저 저장을 바로, 파일 저장이 남았으면 경고
addEventListener('pagehide', () => { try { flushNudge(); if (store.state.dirty) store.idbSet('doc', doc); } catch (e) {} });
addEventListener('beforeunload', e => { try { flushNudge(); store.idbSet('doc', doc); } catch (err) {} if (store.state.handle && store.state.dirty && !store.state.conflict && !NC.live.deferSave()) { saveFileNow(); e.preventDefault(); e.returnValue = ''; } });
let idbTimer, fileTimer, freshDraft = false; // freshDraft: 처음 열 때 만든 초안을 아직 고치지 않음
function markDirty() {
  freshDraft = false; doc.updatedAt = Date.now(); store.state.dirty = true; store.state.seq++;
  clearTimeout(idbTimer); idbTimer = setTimeout(async () => { try { await store.idbSet('doc', doc); if (!store.state.handle) setStatus('브라우저에 저장됨 ' + tnow()); } catch (e) { setStatus('브라우저 저장 실패'); } }, 900);
  if (store.state.handle && !store.state.needPerm && !NC.live.deferSave()) { clearTimeout(fileTimer); fileTimer = setTimeout(saveFileNow, 1500); } // 파일 권한을 다시 받기 전에는 브라우저에만 저장. 실시간 연결 중엔 먼저 들어온 PC가 저장
  updateSaveBadge(); NC.live.changed();
}
async function saveFileNow() {
  if (store.state.conflict) return false;
  if (store.state.saving) { clearTimeout(fileTimer); fileTimer = setTimeout(saveFileNow, 800); return false; } // 저장 중이면 끝난 뒤 다시
  let ok = false;
  try {
    const r = await store.writeFile(doc);
    if (r === true) { ok = true; setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); }
    else if (r && r.conflict) await resolveConflict(r.data, r.file);
    else if (r && r.retry) { clearTimeout(fileTimer); fileTimer = setTimeout(saveFileNow, 3000); }
  } catch (e) { setStatus('파일 저장 실패: ' + e.message); toast('파일 저장 실패: ' + e.message, true); }
  updateSaveBadge(); return ok;
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
    if (takeTheirs) { st.dirty = false; await loadDoc(theirs, undefined, true); }
    st.conflict = false;
    if (!takeTheirs) await saveFileNow(); // 이 PC 내용을 상대 저장본 다음 판으로 저장
    toast(`충돌 사본을 보관했습니다: ${copy}`);
    if ($('#dlgSave') && $('#dlgSave').open) renderSaveDialog();
  } catch (e) { toast('충돌 처리 중 오류: ' + e.message, true); }
  finally { st.conflict = false; }
}
// 다른 PC가 방금까지 이 문서를 고치고 있었으면 알려 줌 (동시에 고치는 걸 미리 막기 위해)
function warnIfRecentOther(j) {
  if (!j || !j.savedAt || !j.savedBy || j.savedBy === store.pcName() || NC.live.peers()) return;
  const min = Math.round((Date.now() - j.savedAt) / 60000);
  if (min <= 5) toast(`${j.savedBy}에서 ${min < 1 ? '방금' : min + '분 전'} 이 문서를 저장했습니다. 그쪽에서 아직 작업 중이면 한쪽을 닫아 주세요.`, true);
}
// 다른 PC의 변경을 문서에 적용한 뒤: 쪽·선택 정리, 다시 그리기, 지금 기록을 고쳐 써 Ctrl+Z가 상대 변경을 되돌리지 않게, 저장 예약
function liveAfterRemote() { cur = clamp(cur, 0, doc.pages.length - 1); sel = sel.filter(id => find(id)); if (cellSel && !find(cellSel.id)) cellSel = null; renderAll(); if (hptr >= 0) { hist[hptr] = snapshot(); histMeta[hptr].rn = NC.live.rn; } markDirty(); }
function tnow() { return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); }
function setStatus(t) { $('#status').textContent = t; }
function updateSaveBadge() { const b = $('#btnSave'); if (!b) return; const st = store.state; b.querySelector('span').textContent = '저장'; b.title = st.handle ? `저장 (Ctrl+S) · ${st.dir ? '동기화 폴더' : '파일'}: ${st.fileName}` : '저장 (Ctrl+S) · 아직 파일로 저장하지 않음'; b.classList.toggle('on', !!st.handle); }
// 이 PC에 원본이 없는 동영상·소리(내 PC 원본 'm:'만 해당 — 공방 그림·기본 소리·공유 자료는 온라인에 있으므로 늘 열림)
const mediaMissing = new Set();
function mediaRefs() { const out = []; doc.pages.forEach((pg, i) => pg.els.forEach(el => { if (el.type === 'video' && NC.media.isLocal(el.src)) out.push({ id: el.src.slice(2), where: `${i + 1}쪽 동영상`, kind: 'video' }); })); if (doc.audio && NC.media.isLocal(doc.audio.src)) out.push({ id: doc.audio.src.slice(2), where: '배경 음악', kind: 'audio' }); (doc.tracks || []).forEach(t => (t.items || []).forEach(it => { if (NC.media.isLocal(it.ref)) out.push({ id: it.ref.slice(2), where: `${t.name} 트랙`, kind: 'audio' }); })); return out; }
async function checkMedia(warn) {
  mediaMissing.clear(); const refs = mediaRefs(); if (!refs.length) return;
  for (const r of refs) { if (!(await NC.media.has(r.id))) mediaMissing.add(r.id); }
  if (!mediaMissing.size) return;
  renderCanvas(); if (tlOn()) { tl.Vkey = ''; renderTimeline(); }
  if (warn) missingDialog();
}
function missingDialog() {
  const list = [...mediaMissing].map(id => ({ id, m: (doc.media || {})[id] || {}, where: [...new Set(mediaRefs().filter(r => r.id === id).map(r => r.where))].join(', ') }));
  let d = $('#dlgMiss'); if (d) d.remove(); d = document.createElement('dialog'); d.id = 'dlgMiss'; d.className = 'nw-dlg sm';
  d.innerHTML = `<div class="dhead"><h2>원본 영상이 없습니다</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody"><p class="hint" style="margin-top:0">원본 영상이 이 PC에 없으므로 <b>그 부분은 빈 공간</b>으로 보입니다. 편집 내용(자르기·움직임·자막 등)은 그대로 남아 있으니, 원본 파일을 연결하면 바로 이어서 편집할 수 있습니다. 공방 그림·기본 음악·공유 자료처럼 온라인에 있는 것은 모두 정상으로 불러왔습니다.</p>
  <div class="miss-list">${list.map(x => `<div class="miss-it" data-mid="${esc(x.id)}"><span><b>${esc(x.m.name || '이름 없는 파일')}</b><small>${esc(x.where)}${x.m.size ? ' · ' + (x.m.size / 1048576).toFixed(1) + 'MB' : ''}</small></span><button class="btn sm primary" data-relink="${esc(x.id)}">원본 연결</button></div>`).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-close>그대로 열기</button></div></div>`;
  document.body.appendChild(d); d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => d.close()); d.addEventListener('close', () => d.remove()); d.showModal();
  d.onclick = async e => { const b = e.target.closest('[data-relink]'); if (!b) return; const id = b.dataset.relink; try { const m0 = (doc.media || {})[id] || {}; const m = await NC.media.relink(id); if (m0.name && m.name !== m0.name && !window.confirm(`고른 파일 이름(${m.name})이 원래 이름(${m0.name})과 다릅니다. 이 파일로 연결할까요?`)) return; mediaMissing.delete(id); b.closest('.miss-it').classList.add('ok'); b.textContent = '연결됨'; b.disabled = true; vEls.clear(); renderCanvas(); if (tlOn()) { tl.Vkey = ''; renderTimeline(); } if (!mediaMissing.size) { d.close(); toast('원본을 모두 연결했습니다'); } } catch (err) { if (err.name !== 'AbortError') toast(err.message, true); } };
}
// 문서 파일 정리: 남이 준 문서·채팅 답·버전 기록을 열어도 스크립트가 실행되지 않게 (글 상자 html은 서식만 남기고, 화면에 들어가는 값에서 따옴표·꺾쇠를 막음)
const DOC_BAD = /[<>"`]|javascript:|expression\(/i, DOC_ID = /^[\w-]{1,60}$/, DOC_TEXTISH = ['text', 'html', 'name', 'title', 'label', 'note', 'caption', 'alt', 'rows', 'data', 'labels', 'cells', 'series', 'values', 'kw', 'prompt'];  // 글 내용(화면에 넣을 때 esc 처리됨)은 그대로
function cleanVals(o, depth) { for (const k in o) { if (DOC_TEXTISH.includes(k)) continue; const v = o[k]; if (typeof v === 'string') { if (DOC_BAD.test(v)) delete o[k]; } else if (Array.isArray(v)) { o[k] = v.map(x => typeof x === 'string' && DOC_BAD.test(x) ? '' : x); if (depth < 2) o[k].forEach(x => { if (x && typeof x === 'object') cleanVals(x, depth + 1); }); } else if (v && typeof v === 'object' && depth < 2) cleanVals(v, depth + 1); } }
function sanitizeDoc(d) {
  d.pages = (Array.isArray(d.pages) ? d.pages : []).filter(p => p && typeof p === 'object').map(p => Object.assign(newPage(), p)); if (!d.pages.length) d.pages = [newPage()];
  if (!d.calendar || typeof d.calendar !== 'object') d.calendar = newDoc().calendar;
  d.pages.forEach(p => { if (!DOC_ID.test(String(p.id || ''))) p.id = uid(); if (DOC_BAD.test(String(p.bg || ''))) p.bg = '#ffffff';
    p.els = (Array.isArray(p.els) ? p.els : []).filter(e => e && typeof e === 'object');
    p.els.forEach(e => { if (!DOC_ID.test(String(e.id || ''))) e.id = uid();
      if (e.type === 'text') { for (const k in TEXT_DEF) if (e[k] === undefined) e[k] = TEXT_DEF[k]; if (e.html) { const box = document.implementation.createHTMLDocument('').createElement('div'); box.innerHTML = String(e.html); e.html = richHTML(box) || undefined; if (!e.html) delete e.htmlFor; } }
      cleanVals(e, 0); }); });
  (d.tracks || []).forEach(t => { if (t && typeof t === 'object') { if (!DOC_ID.test(String(t.id || ''))) t.id = uid(); (t.items || []).forEach(it => { if (it && typeof it === 'object') { if (!DOC_ID.test(String(it.id || ''))) it.id = uid(); cleanVals(it, 0); } }); } });
  if (d.audio && typeof d.audio === 'object') cleanVals(d.audio, 0);
  if (d.media && typeof d.media === 'object') Object.keys(d.media).forEach(k => { if (!DOC_ID.test(k)) delete d.media[k]; else if (d.media[k] && typeof d.media[k] === 'object') cleanVals(d.media[k], 0); });
}
async function loadDoc(j, from, quiet) {
  if (!j || !j.pages) throw new Error('문서 형식이 아닙니다');
  if (j.v !== 2) throw new Error('이 프로그램의 문서 파일이 아닙니다');
  { const d0 = Object.assign(newDoc(), j); sanitizeDoc(d0); j = d0; }
  doc = Object.assign(newDoc(), j); doc.assets = doc.assets || {}; doc.holidays = doc.holidays || {}; doc.fonts = doc.fonts || [];
  if (!doc.calendar.theme || !doc.calendar.theme.id) doc.calendar.theme = Object.assign({ id: 'classic' }, doc.calendar.theme || {});
  const m8 = doc.calendar.months && doc.calendar.months[7]; if (m8 && !m8.image && /우정/.test(m8.virtue || '')) { m8.image = 'asset:illu-08-friendship'; doc.pages.forEach(p => p.els.forEach(e => { if (e.type === 'image' && e.role === 'illust' && e.month === 8 && !e.src) e.src = m8.image; })); }
  cur = 0; sel = []; selDay = null; hist = []; histMeta = []; hptr = -1;
  await registerDocFonts(); ensureAllHolidays();
  $('#pname').value = doc.name || '';
  hist.push(snapshot()); histMeta = [{ cur: 0, sel: [] }]; hptr = 0;
  renderAll(); if (from) toast(from);
  checkMedia(!quiet);
}
async function checkExternalChange() {
  const st = store.state; if (st.conflict || editing || $('#cellEd') || drag) return;
  const ch = await store.checkExternal(); if (!ch) return;
  let j; try { j = JSON.parse(ch.text); } catch (e) { return; } // 동기화 중인 파일: 다음에 다시 확인
  if ((j.saveId || '') === st.lastSaveId) { st.lastMod = ch.file.lastModified; return; } // 내용은 그대로(시각만 바뀜)
  if (NC.live.peers() && sameDoc(j, doc)) { st.lastMod = ch.file.lastModified; store.adopt(j); if (NC.live.fromFile(j)) { st.dirty = false; setStatus(`${j.savedBy || '다른 PC'}가 파일에 저장함 ${tnow()} · ${store.state.fileName}`); updateSaveBadge(); } return; } // 실시간으로 이미 같은 내용: 그림만 보충
  // 여기 저장 안 한 변경이 있거나, 상대가 내 마지막 저장을 못 보고 저장했으면 충돌
  if (st.dirty || !store.descends(j)) { await resolveConflict(j, ch.file); return; }
  st.lastMod = ch.file.lastModified; store.adopt(j);
  await loadDoc(j, `${j.savedBy || '다른 PC'}에서 바뀐 내용을 불러왔습니다`, true);
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
// 웹폰트(배민체·지마켓 산스 등): 파일을 복사하지 않고 공개 웹폰트 주소에서 불러옴. 쓰는 순간에만 내려받음
(function () {
  const W = window.NARACAL_WEBFONTS || []; if (!W.length) return;
  const css = W.map(f => f.faces.map(fc => `@font-face{font-family:'${f.family}';src:url('${fc.url}') format('${fc.format || 'woff2'}');font-weight:${fc.weight};font-display:swap}`).join('\n')).join('\n');
  const st = document.createElement('style'); st.id = 'webfontCss'; st.textContent = css; document.head.appendChild(st);
  W.forEach(f => { if (!FONTS.some(x => x.family === f.family)) FONTS.push({ family: f.family, label: f.label, cat: f.cat, weights: f.faces.map(x => x.weight), web: true, preview: f.preview, license: f.license }); });
})();
// 자료실 글꼴(동기화 폴더 디자인자료/글꼴): 이 PC에 자료실이 있으면 목록에 더하고, 문서에서 쓸 때만 파일을 읽음
NC.lib.onReady(() => { NC.lib.fonts().forEach(f => { if (!FONTS.some(x => x.family === f.family)) FONTS.push({ family: f.family, label: f.label, cat: f.cat, weights: f.faces.map(x => x.weight), lib: true, preview: f.previewUrl, desc: f.desc }); }); libLoaded.clear(); renderCanvas(); });
const libLoaded = new Set();
function fontsUsed(pages) { const u = new Set(); const add = v => { if (typeof v === 'string' && v) u.add(v); }; pages.forEach(p => p.els.forEach(el => { add(el.font); if (el.s) Object.keys(el.s).forEach(k => { if (/^font/i.test(k)) add(el.s[k]); }); })); return u; }
// 쓰인 자료실 글꼴을 불러옴. 새로 불러온 것이 있으면 true
function ensureLibFonts(pages) {
  const need = [...fontsUsed(pages)].filter(f => !libLoaded.has(f) && NC.lib.isLibFont(f)); if (!need.length) return Promise.resolve(false);
  need.forEach(f => libLoaded.add(f)); return Promise.all(need.map(f => NC.lib.ensureFont(f))).then(r => r.some(Boolean));
}
// 목록 순서: 인기 웹글꼴 → 자료실 → 기본 글꼴 (요즘 글꼴이 먼저 보이게)
const sortFonts = l => l.slice().sort((a, b) => (b.web ? 2 : b.lib ? 1 : 0) - (a.web ? 2 : a.lib ? 1 : 0));
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
  if (ext && mode === 'print' && ((el.type === 'image' && el.fit !== 'contain' && !el.rot && (!el.clip || el.clip === 'none') && !el.radius && !el.borderW) || (el.type === 'shape' && el.kind === 'rect' && !el.radius && !el.strokeW && !el.rot))) { const b = doc.bleed || 0; if (x <= 0.3) { x -= b; w += b; } if (x + w >= doc.w - 0.3) w += b; if (y <= 0.3) { y -= b; h += b; } if (y + h >= doc.h - 0.3) h += b; }
  const base = `left:${x}mm;top:${y}mm;width:${w}mm;${el.type === 'text' && !isWarp(el) ? 'min-height' : 'height'}:${h}mm;transform:rotate(${el.rot || 0}deg);opacity:${el.opacity == null ? 1 : el.opacity};`;
  const lock = el.locked ? ' locked' : '';
  const blend = el.blend && el.blend !== 'normal' && el.type !== 'text' ? `mix-blend-mode:${el.blend};` : '';
  if (el.type === 'text') {
    if (el.warp && el.warp !== 'none') return `<div class="el el-text warp${lock}" data-id="${el.id}" style="${base}${el.blend && el.blend !== 'normal' ? `mix-blend-mode:${el.blend};` : ''}">${FX.warpSVG(el)}</div>`;
    return `<div class="el el-text${lock}" data-id="${el.id}" style="${base}${FX.textStyle(el)}">${el.html && el.htmlFor === el.text ? (el.valign && el.valign !== 'top' ? `<div class="txw">${el.html}</div>` : el.html) : esc(el.text)}</div>`;
  }
  if (el.type === 'image') {
    const s = viewSrc(el, mode); const clip = FX.clipPath(el.clip, el.w * MM, el.h * MM); const z = el.zoom || 1;
    const sh = el.shadow ? `filter:drop-shadow(${el.shX || 0.8}mm ${el.shY || 0.8}mm ${el.shB || 0.8}mm ${FX.rgba(el.shC || '#000000', el.shA == null ? 0.3 : el.shA)});` : '';
    const inner = s ? `<img src="${s}" alt="" draggable="false" style="object-fit:${el.fit};object-position:${el.pos};transform:translate(${el.panX || 0}%,${el.panY || 0}%) scale(${z * (el.flip ? -1 : 1)},${z * (el.flipV ? -1 : 1)});${FX.imageFilter(el)}">${el.tint ? `<div class="tint" style="background:${el.tint};opacity:${el.tintA == null ? 0.4 : el.tintA};mix-blend-mode:${el.tintMode || 'multiply'}"></div>` : ''}` : (mode === 'edit' ? '<div style="font-size:3.5mm;color:rgba(0,0,0,.4);text-align:center;padding-top:35%">그림 없음<br>오른쪽에서 넣기</div>' : '');
    return `<div class="el el-image${lock}" data-id="${el.id}" style="${base}${blend}${sh}"><div class="imgclip" style="border-radius:${el.radius || 0}mm;${clip ? `clip-path:${clip};` : ''}${el.border ? `border:${el.borderW || 0.5}mm solid ${el.border};` : ''}${s ? '' : 'outline:0.4mm dashed rgba(0,0,0,.3);'}">${inner}</div></div>`;
  }
  if (el.type === 'video' && NC.media.isLocal(el.src) && mediaMissing.has(el.src.slice(2))) return `<div class="el el-video vmiss${lock}" data-id="${el.id}" style="${base}">${mode === 'edit' ? `<div class="vmiss-in"><b>원본 영상 없음</b><span>${esc(el.name || '')}</span><small>속성에서 '원본 다시 연결'</small></div>` : ''}</div>`;
  if (el.type === 'video') { const ps = el.poster ? src(el.poster) : ''; const len = Math.max(0, Number(el.tout || el.dur || 0) - Number(el.tin || 0)); return `<div class="el el-video${lock}" data-id="${el.id}" style="${base}${blend}"><div class="imgclip" style="border-radius:${el.radius || 0}mm;background:#1b1f2a">${ps ? `<img src="${ps}" alt="" draggable="false" style="object-fit:${el.fit === 'contain' ? 'contain' : 'cover'}">` : ''}${mode === 'edit' ? `<span class="vbadge">▶ ${len.toFixed(1)}초</span>` : ''}</div></div>`; }
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
  ensureLibFonts([page()]).then(n => { if (n && !editing) renderCanvas(); });
  const c = $('#canvas'); const pg = page();
  c.style.setProperty('--pw', doc.w); c.style.setProperty('--ph', doc.h); c.style.setProperty('--b', '0mm');
  c.innerHTML = `<div class="page" style="--bg:${pg.bg}"><div class="bgfill"></div>${pg.els.map(e => elHTML(e, 'edit')).join('')}</div>`;
  pg.els.forEach(el => { if (el.type === 'text' && !isWarp(el)) { const d = c.querySelector(`[data-id="${el.id}"]`); if (d) { const hh = fitTextH(d, el, true); if (hh != null) el.h = hh; } } });
  renderGhost(); fitCanvas(); renderOverlay(); NC.live.paint();
  $('#pageLabel').textContent = `${cur + 1} / ${doc.pages.length}${pg.label ? ' · ' + pg.label : ''}`;
  $('#stage').classList.toggle('pen', tool === 'pen');
}
/* ---------- 문서 밖 (미리캔버스처럼 페이지 밖도 작업 공간) ---------- */
// 회전까지 고려한 요소의 바깥 상자(mm)
// 여러 요소를 감싸는 상자(회전 반영)
// 문서 크기 글: SNS·화면용(px) 문서는 px로, 인쇄물은 mm로
function docSizeLabel(sep) { const f = FORMATS.find(x => x[0] === doc.fmt); sep = sep || '×'; return f && f[5] === 'px' ? `${f[3]}${sep}${f[4]}px` : `${Math.round(doc.w * 100) / 100}${sep}${Math.round(doc.h * 100) / 100}mm`; }
function unionBox(els) { const bb = els.map(elBox), x = Math.min(...bb.map(b => b.x)), y = Math.min(...bb.map(b => b.y)); return { x, y, w: Math.max(...bb.map(b => b.x + b.w)) - x, h: Math.max(...bb.map(b => b.y + b.h)) - y }; }
function elBox(el) {
  const a = (el.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s_ = Math.abs(Math.sin(a));
  const w = el.w * c + el.h * s_, h = el.w * s_ + el.h * c, cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
// 페이지 밖으로 나간 정도(mm): 왼·오른·위·아래
function pageOverflow(pg) {
  const o = { l: 0, r: 0, t: 0, b: 0 }; if (!pg) return o;
  pg.els.forEach(el => { if (el.hidden) return; const b = elBox(el); o.l = Math.max(o.l, -b.x); o.t = Math.max(o.t, -b.y); o.r = Math.max(o.r, b.x + b.w - doc.w); o.b = Math.max(o.b, b.y + b.h - doc.h); });
  return o;
}
const isOut = el => { const b = elBox(el); return b.x < -0.05 || b.y < -0.05 || b.x + b.w > doc.w + 0.05 || b.y + b.h > doc.h + 0.05; };
// 문서 밖으로 나간 부분은 반투명으로 보이고(선택한 요소는 조금 더 진하게) 눌러서 고를 수 있음. 내보내기·인쇄에서는 잘림(인쇄는 도련까지)
function renderGhost(light) {
  const g = $('#ghost'); if (!g) return; const pg = page();
  const outs = pg.els.filter(el => !el.hidden && isOut(el));
  const key = outs.map(e => e.id).join(',') + '|' + sel.join(',') + '|' + cur;
  if (light && key === renderGhost.key) { outs.forEach(el => { const d = g.querySelector(`[data-id="${el.id}"]`); if (!d) return; d.style.left = el.x + 'mm'; d.style.top = el.y + 'mm'; d.style.width = el.w + 'mm'; d.style[el.type === 'text' && !isWarp(el) ? 'minHeight' : 'height'] = el.h + 'mm'; d.style.transform = `rotate(${el.rot || 0}deg)`; }); return; }
  renderGhost.key = key;
  g.style.setProperty('--pw', doc.w); g.style.setProperty('--ph', doc.h); g.style.setProperty('--b', '0mm');
  g.innerHTML = outs.length ? `<div class="page">${outs.map(e => elHTML(e, 'edit').replace('class="el ', `class="el${sel.includes(e.id) ? ' gsel' : ''} `)).join('')}</div>` : '';
}
let ghostRaf = 0;
function ghostSoon() { if (ghostRaf) return; ghostRaf = requestAnimationFrame(() => { ghostRaf = 0; renderGhost(true); }); }
function fitCanvas() {
  // 위에 떠 있는 도구 막대와 아래 쪽 이동 막대에 페이지가 가리지 않게 그 높이만큼 비워 두고 맞춤
  const st = $('#stage'), tb = st.querySelector('.toolbar'), top = tb ? tb.offsetTop + tb.offsetHeight + 14 : 24, bot = st.classList.contains('tlon') && $('#vtl') && !document.body.classList.contains('tl-wide') ? $('#vtl').offsetHeight + 18 : 64;
  const w = st.clientWidth - 80, h = st.clientHeight - top - bot - 4;
  const k = zoom || Math.max(0.03, Math.min(Math.max(w, 60) / (doc.w * MM), Math.max(h, 60) / (doc.h * MM)));
  // 문서 밖으로 나간 요소가 있으면 그만큼 작업 화면을 넓혀 스크롤로 닿게 함 (좌우·위아래 같은 폭이라 페이지가 가운데에 그대로)
  const ov = pageOverflow(page()), px = Math.ceil(Math.max(ov.l, ov.r) * MM * k), py = Math.ceil(Math.max(ov.t, ov.b) * MM * k);
  const sc = $('#scroller'), prev = fitCanvas.pad || [0, 0];
  $('#canvasWrap').style.margin = `${top + py}px ${40 + px}px ${bot + py}px`; // 도구 막대가 두 줄로 접혀도 페이지를 가리지 않게
  if (sc && (px !== prev[0] || py !== prev[1])) { const ddx = px - prev[0], ddy = py - prev[1]; queueMicrotask(() => { sc.scrollLeft += ddx; sc.scrollTop += ddy; }); } // 크기가 다 정해진 뒤 스크롤을 옮겨 페이지가 제자리에
  fitCanvas.pad = [px, py];
  const c = $('#canvas'); c.style.transform = `scale(${k})`; c.dataset.k = k; const gh = $('#ghost'); if (gh) gh.style.transform = `scale(${k})`;
  const wrap = $('#canvasWrap'); wrap.style.width = (doc.w * MM * k) + 'px'; wrap.style.height = (doc.h * MM * k) + 'px';
  const o = $('#ovl'); o.style.transform = `scale(${k})`; o.style.setProperty('--k', k); o.style.width = (doc.w * MM) + 'px'; o.style.height = (doc.h * MM) + 'px';
  const z = $('#zoomPct'); if (z) z.textContent = Math.round(k * 100) + '%';
  try { if (showRulers()) requestAnimationFrame(drawRulers); } catch (e) {}
}
const SAFE = 3;
// 형식별 안전 여백(mm): 현수막은 미싱·아일렛, X배너는 거치대 자리. 나머지는 3mm
const SAFE_BY = { banner: 40, banner3: 30, 'banner-v': 30, xbanner: 25, 'sign-a1': 10 };
// 형식별 안내선: 도련이 없어도 인쇄물은 안전 여백, 스토리는 위·아래 가림 영역, 3단 리플렛은 접는 선, 유튜브 썸네일은 재생 시간 자리
function formatGuides() {
  const f = FORMATS.find(x => x[0] === doc.fmt), grp = f ? f[2] : ''; let h = '';
  if (!(Number(doc.bleed) > 0) && ['print', 'doc', 'sign', 'cal'].includes(grp)) { const m = safeMM(); h += `<div class="pg-safe" style="left:${m}mm;top:${m}mm;width:${doc.w - 2 * m}mm;height:${doc.h - 2 * m}mm" title="안전 여백 ${m}mm: 글자·로고는 이 안쪽에"></div>`; }
  if (doc.fmt === 'story') { const t = PX(250), b = PX(340); h += `<div class="pg-zone" style="left:0;top:0;width:${doc.w}mm;height:${t}mm"><span>위쪽 ${t.toFixed(0)}mm: 프로필·진행 막대에 가려짐</span></div><div class="pg-zone" style="left:0;top:${doc.h - b}mm;width:${doc.w}mm;height:${b}mm"><span>아래쪽: 답장 칸에 가려짐</span></div>`; }
  if (doc.fmt === 'leaflet') { const a = Math.abs(doc.w - 297) < 1 ? [99, 198] : [doc.w / 3, doc.w * 2 / 3]; h += a.map(x => `<div class="pg-fold" style="left:${x}mm;top:0;height:${doc.h}mm" title="접는 선 ${x}mm"></div>`).join(''); }
  if (doc.fmt === 'yt-thumb') { const w = PX(150), hh = PX(60), m = PX(12); h += `<div class="pg-zone" style="left:${doc.w - w - m}mm;top:${doc.h - hh - m}mm;width:${w}mm;height:${hh}mm"><span>재생 시간</span></div>`; }
  return h;
}
function safeMM() { return SAFE_BY[doc.fmt] || (Math.max(doc.w, doc.h) >= 2000 ? 30 : SAFE); }
function showGuides() { try { return localStorage.getItem('naracal-guides') !== '0'; } catch (e) { return true; } }
document.addEventListener('change', e => { if (e.target.id === 'guideToggle') { try { localStorage.setItem('naracal-guides', e.target.checked ? '1' : '0'); } catch (err) {} renderOverlay(); } });
// 쪽을 거의 다 덮는 잠긴 배경: 클릭이 통과해 그 위에서 끌어 고르기가 됨 (레이어 목록이나 우클릭으로는 고를 수 있음)
const lockedBg = el => el.locked && el.w * el.h >= doc.w * doc.h * 0.6;
function renderOverlay(guides) {
  const o = $('#ovl'); const els = selEls(); let h = '';
  els.forEach(el => { const single = els.length === 1; h += `<div class="sel${single ? '' : ' multi'}" style="left:${el.x}mm;top:${el.y}mm;width:${el.w}mm;height:${el.h}mm;transform:rotate(${el.rot || 0}deg)">`; if (single && !el.locked) h += (el.type === 'text' && !isWarp(el) ? ['nw', 'ne', 'e', 'se', 'sw', 'w'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']).map(d => `<div class="h ${d}" data-h="${d}"></div>`).join('') + '<div class="rotline"></div><div class="h rot" data-h="rot"></div>'; if (el.locked) h += `<button class="lockbadge" data-unlock="${el.id}" title="잠금 풀기 (Ctrl+L)">🔒 잠금 풀기</button>`; h += '</div>'; });
  if (els.length > 1) { const U = unionBox(els), bx = U.x, by = U.y, bw = U.w, bh = U.h; h += `<div class="sel group" style="left:${bx}mm;top:${by}mm;width:${bw}mm;height:${bh}mm">${els.some(e => e.locked) ? '' : ['nw', 'ne', 'se', 'sw'].map(d => `<div class="h ${d}" data-h="${d}" data-g="1" title="함께 크기 조절 (비율 유지)"></div>`).join('')}</div>`; }
  (guides || []).forEach(g => { h += g.v != null ? `<div class="guide v" style="left:${g.v}mm"></div>` : `<div class="guide h" style="top:${g.h}mm"></div>`; });
  h += calOverlay(); h += userGuidesHTML(); try { if (showRulers()) requestAnimationFrame(drawRulers); } catch (e) {} // 고른 요소 범위를 눈금자에 표시
  // 인쇄 안내선: 도련(잘려 나가는 영역)·안전 여백(글자를 두지 않을 영역)
  if (showGuides() && Number(doc.bleed) > 0) { const b = Number(doc.bleed); h += `<div class="pg-bleed" style="left:${-b}mm;top:${-b}mm;width:${doc.w + 2 * b}mm;height:${doc.h + 2 * b}mm" title="도련 ${b}mm: 이 선까지 배경을 채우세요"></div><div class="pg-safe" style="left:${safeMM()}mm;top:${safeMM()}mm;width:${doc.w - 2 * safeMM()}mm;height:${doc.h - 2 * safeMM()}mm" title="안전 여백 ${safeMM()}mm: 글자·로고는 이 안쪽에"></div>`; }
  if (showGuides()) h += formatGuides();
  o.innerHTML = h; showCellBar();
}
let thumbTimer;
function renderThumbs() {
  const box = $('#thumbs'); if (!box) return;
  const tw = box.clientWidth - 12 || 200; const k = tw / (doc.w * MM);
  box.innerHTML = doc.pages.map((pg, i) => `<button class="thumb ${i === cur ? 'active' : ''}" data-i="${i}" draggable="true" title="끌어서 순서 바꾸기"><div class="tbox" style="height:${doc.h * MM * k}px">${sheetHTML(pg, 'thumb')}</div><div class="tlabel"><b>${i + 1}</b><span>${esc(pg.label || '')}</span></div></button>`).join('');
  box.querySelectorAll('.tbox .sheet').forEach(s => { s.style.transform = `scale(${k})`; });
}
function renderAll() { renderCanvas(); renderSide(); renderInspector(); if (tlOn()) { if (!tl.playing) tlHidePrev(); renderTimeline(); } }
function rerender(opts) { opts = opts || {}; renderCanvas(); if (!opts.noPanel) renderInspector(); clearTimeout(thumbTimer); thumbTimer = setTimeout(() => { if (sideTab === 'pages') renderThumbs(); else if (sideTab === 'layers') renderSide(); if (tlOn()) { if (!tl.playing) tlHidePrev(); renderTimeline(); } }, 150); }
function goto(i) { endEdit(); cur = clamp(i, 0, doc.pages.length - 1); sel = []; selDay = null; cellSel = null; renderAll(); }
function select(ids) { endEdit(); sel = ids.filter(id => find(id)); if (sel.length) { tl.selIt = null; tl.selAu = false; tl.selScene = false; } selDay = null; if (cellSel && !sel.includes(cellSel.id)) cellSel = null; renderOverlay(); renderInspector(); if (sideTab === 'layers' || (sideTab === 'video' && ['text', 'motion', 'trans'].includes(vTab))) renderSide(); updateToolbarState(); }
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
function selRect() { let { r1: ra, r2, c1, c2 } = cellRect(cellSel.a, cellSel.b); const el = find(cellSel.id); ((el && el.merges) || []).forEach(g => { const gr = Math.floor(g.c / 7), gc = g.c % 7; if (gr >= ra && gr <= r2 && gc >= c1 && gc <= c2) { r2 = Math.max(r2, gr + g.rs - 1); c2 = Math.max(c2, gc + g.cs - 1); } }); return { r1: ra, r2, c1, c2 }; }
function cellRect(a, b) { const r1_ = Math.min(Math.floor(a / 7), Math.floor(b / 7)), r2 = Math.max(Math.floor(a / 7), Math.floor(b / 7)), c1 = Math.min(a % 7, b % 7), c2 = Math.max(a % 7, b % 7); return { r1: r1_, r2, c1, c2 }; }
function selCells() { if (!cellSel) return []; const { r1: ra, r2, c1, c2 } = selRect(); const out = []; for (let r = ra; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(r * 7 + c); return out; }
function calOverlay() {
  const el = selEls()[0]; if (!el || el.type !== 'cal' || sel.length !== 1 || el.locked) return '';
  const G = calGeom(el); if (!G) return ''; let h = '';
  if (cellSel && cellSel.id === el.id) { const { r1: ra, r2, c1, c2 } = selRect(); h += `<div class="csel" style="left:${G.xs[c1]}mm;top:${G.ys[ra]}mm;width:${G.xs[c2 + 1] - G.xs[c1]}mm;height:${G.ys[r2 + 1] - G.ys[ra]}mm"></div>`; }
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
    decorateColors(b);
  }
  b.hidden = false;
  const G = calGeom(el); const { r1: ra, c1 } = cellRect(cellSel.a, cellSel.b); const cr = $('#canvas').getBoundingClientRect(), k = kScale();
  const px = G.xs[c1] * MM * k + cr.left, py = G.ys[ra] * MM * k + cr.top;
  b.style.left = Math.max(8, Math.min(px, innerWidth - b.offsetWidth - 8)) + 'px'; b.style.top = Math.max(60, py - b.offsetHeight - 10) + 'px';
}
function cellSet(patch, live) { const el = selEls()[0]; if (!el) return; el.cells = el.cells || {}; selCells().forEach(c0 => { const c = CAL.cellKey(el, c0); const old = el.cells[String(c0)]; if (c !== String(c0) && old) { el.cells[c] = Object.assign({}, old, el.cells[c] || {}); delete el.cells[String(c0)]; } el.cells[c] = Object.assign({}, el.cells[c] || {}, patch); Object.keys(el.cells[c]).forEach(k => { if (el.cells[c][k] === undefined) delete el.cells[c][k]; }); if (!Object.keys(el.cells[c]).length) delete el.cells[c]; }); renderCanvas(); if (!live) commit(); showCellBar(); }
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
  if (k === 'clear') { selCells().forEach(c => { if (el.cells) { delete el.cells[CAL.cellKey(el, c)]; delete el.cells[String(c)]; } }); commit(); rerender(); }
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
  ta.addEventListener('keydown', e => { if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; } /* 한글 조합 중 Esc·Enter는 조합만 끝냄 */ if (e.key === 'Escape') { e.preventDefault(); closeCellEditor(false); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); closeCellEditor(true); } e.stopPropagation(); });
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
// 끌던 동작 취소 (Esc·포인터 취소): 마지막 기록 상태로 되돌림
function cancelDrag() {
  if (!drag) return false; const d = drag; drag = null;
  if (!d.moved && !d.dup) { renderOverlay(); return false; }
  restore(hist[hptr], { cur, sel: d.dup ? d.dup.orig : sel.slice() }); toast('끌기를 취소했습니다'); return true;
}
document.addEventListener('pointercancel', () => cancelDrag());
function toMM(e) { const r = $('#canvas').getBoundingClientRect(); const k = kScale(); return { x: (e.clientX - r.left) / k / MM, y: (e.clientY - r.top) / k / MM }; }
let drag = null, lastClick = null, pen = null;
wrap.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  if (tlOn() && $('#vprev') && !$('#vprev').hidden) { tlPause(); tlHidePrev(); const { list } = tlScenes(), x = list.find(q => tl.T >= q.t0 && tl.T < q.t0 + q.dur + q.turn); if (x && x.i !== cur) goto(x.i); }
  if ($('#cellEd') && !e.target.closest('#cellEd')) closeCellEditor(true);
  if (e.target.closest('#cellEd')) return;
  if (editing) { if (e.target.closest('.el-text.editing')) return; endEdit(); }
  flushNudge(); // 화살표·숫자키로 바꾼 것을 먼저 한 단계로 기록
  const p = toMM(e);
  if (tool === 'pen') { pen = { pts: [[r1(p.x), r1(p.y)]] }; $('#ovl').insertAdjacentHTML('beforeend', `<svg class="penprev" viewBox="0 0 ${doc.w} ${doc.h}" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible"><path d="" fill="none" stroke="#2f5bea" stroke-width="0.6" vector-effect="non-scaling-stroke"/></svg>`); e.preventDefault(); return; }
  const hd = e.target.closest('.ovl .h');
  if (hd && sel.length > 1 && hd.dataset.g) { const els = selEls(); const U0 = unionBox(els), bx = U0.x, by = U0.y, bw = U0.w, bh = U0.h; drag = { kind: 'gresize', dir: hd.dataset.h, start: p, box: { x: bx, y: by, w: bw, h: bh }, o: els.map(e => clone(e)), els, moved: false }; e.preventDefault(); return; }
  if (hd && sel.length === 1) { const el = find(sel[0]); drag = { kind: hd.dataset.h === 'rot' ? 'rot' : 'resize', dir: hd.dataset.h, el, start: p, o: clone(el), cx: el.x + el.w / 2, cy: el.y + el.h / 2, moved: false }; e.preventDefault(); return; }
  const gl = e.target.closest('.ovl .cgl');
  if (gl && sel.length === 1) { const el = find(sel[0]); const G = calGeom(el); const isC = gl.dataset.cgl[0] === 'c', i = Number(gl.dataset.cgl.slice(1)); drag = { kind: 'cgl', el, isC, i, G, start: p, moved: false, w0: (isC ? G.colW : G.rowH).slice() }; e.preventDefault(); return; }
  let hitNode = e.target; const dom = (() => { const seen = new Set(); for (const n of document.elementsFromPoint(e.clientX, e.clientY)) { let d = n.closest && n.closest('#canvas .el, #ghost .el'); if (d && d.closest('#ghost')) d = $(`#canvas [data-id="${d.dataset.id}"]`) || d; if (!d || seen.has(d)) continue; seen.add(d); const x = find(d.dataset.id); if (x && (!x.locked || sel.includes(x.id) || !lockedBg(x))) { hitNode = n; return d; } } return null; })();
  if (dom) {
    const id = dom.dataset.id, el = find(id); const was = sel.includes(id);
    // 고른 달력의 칸 위를 누르면 칸 선택 (요일 줄을 누르면 달력 이동)
    if (el.type === 'cal' && was && !el.locked && hitNode.closest('.cell')) { const cellNode = hitNode.closest('.cell'); const c = Number(cellNode.dataset.c); if (e.shiftKey && cellSel && cellSel.id === id) cellSel.b = c; else cellSel = { id, a: c, b: c }; const dd = cellNode.dataset.day; selDay = dd ? Number(dd) : null; drag = { kind: 'cells', start: p, moved: false }; renderOverlay(); renderInspector(); e.preventDefault(); return; }
    if (!was || el.type !== 'cal') cellSel = null;
    if (el.type === 'text' && was && !el.locked && !e.altKey && !(el.warp && el.warp !== 'none') && lastClick && lastClick.id === id && Date.now() - lastClick.t < 450) { lastClick = null; startEdit(dom, e); e.preventDefault(); return; }
    lastClick = { id, t: Date.now() };
    const ids = e.altKey ? [id] : groupOf(id);
    if (e.shiftKey) { sel = was ? sel.filter(i => !ids.includes(i)) : sel.concat(ids.filter(i => !sel.includes(i))); select(sel); }
    else if (!was) select(ids);
    if (el.type === 'cal' && was && !e.shiftKey) { const cell = e.target.closest('.cell'); if (cell && cell.dataset.day) { selDay = Number(cell.dataset.day); renderInspector(); const ds = $('#daySel'); if (ds) ds.scrollIntoView({ block: 'center' }); } }
    if (el.locked) { drag = { kind: 'marq', start: p, moved: false, base: [] }; e.preventDefault(); return; } // 잠긴 요소: 골라지기만 하고 옮겨지지 않음, 끌면 영역 고르기
    let dup = null; if (e.altKey && !e.shiftKey) { // Alt+끌기: 제자리에 복제한 뒤 복제본을 옮김
      const gmap = {}; const ids = selEls().filter(x => !x.locked).map(o => { const n = clone(o); n.id = uid(); delete n.gen; if (n.group) { gmap[n.group] = gmap[n.group] || uid(); n.group = gmap[n.group]; } page().els.push(n); return n.id; }); dup = { ids, orig: sel.slice() }; sel = ids; renderCanvas(); }
    drag = { kind: 'move', dup, reduceTo: (was && !e.shiftKey && !e.altKey && sel.length > ids.length) ? ids : null, els: selEls().filter(x => !x.locked), start: p, orig: selEls().map(x => ({ id: x.id, x: x.x, y: x.y })), moved: false };
    e.preventDefault(); return;
  }
  if (!e.shiftKey) { cellSel = null; select([]); }
  drag = { kind: 'marq', start: p, moved: false, base: e.shiftKey ? sel.slice() : [] };
});
// 끌기 중 마우스 이동은 화면 한 프레임에 한 번만 처리 (현수막처럼 큰 문서에서 버벅임 방지)
let moveEv = null, moveRaf = 0;
document.addEventListener('pointermove', e => {
  if (pen || !drag) { dragMove(e); return; }
  moveEv = e; if (!moveRaf) moveRaf = requestAnimationFrame(() => { moveRaf = 0; const ev = moveEv; moveEv = null; if (ev) dragMove(ev); });
});
function flushMove() { if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; } if (moveEv) { const ev = moveEv; moveEv = null; dragMove(ev); } }
function dragMove(e) {
  if (pen) { const p = toMM(e); const last = pen.pts[pen.pts.length - 1]; if (Math.hypot(p.x - last[0], p.y - last[1]) > 0.6) { pen.pts.push([r1(p.x), r1(p.y)]); const pv = $('#ovl .penprev path'); if (pv) pv.setAttribute('d', FX.smoothPath(pen.pts)); } return; }
  if (!drag) return;
  const p = toMM(e); let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (Math.abs(dx) + Math.abs(dy) > 0.2) drag.moved = true;
  if (!drag.moved) return;
  if (drag.kind === 'move') {
    let guides = [];
    if (!e.altKey || drag.dup) { const bx = Math.min(...drag.orig.map(o => o.x)) , by = Math.min(...drag.orig.map(o => o.y)); const bw = Math.max(...drag.els.map(el => drag.orig.find(q => q.id === el.id).x + el.w)) - bx, bh = Math.max(...drag.els.map(el => drag.orig.find(q => q.id === el.id).y + el.h)) - by; const sn = snap(bx + dx, by + dy, bw, bh, drag.els.map(el => el.id)); dx = sn.x - bx; dy = sn.y - by; guides = sn.guides; }
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    drag.els.forEach(el => { const o = drag.orig.find(q => q.id === el.id); el.x = r1(o.x + dx); el.y = r1(o.y + dy); });
    liveUpdate(drag.els); renderOverlay(guides);
  } else if (drag.kind === 'resize') {
    const el = drag.el, o = drag.o, rad = -(o.rot || 0) * Math.PI / 180;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad), ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    const d = drag.dir; let x = o.x, y = o.y, w = o.w, h = o.h;
    if (d.includes('e')) w = o.w + lx; if (d.includes('s')) h = o.h + ly;
    if (d.includes('w')) { w = o.w - lx; x = o.x + lx; } if (d.includes('n')) { h = o.h - ly; y = o.y + ly; }
    const keep = (el.type === 'image' || el.type === 'video' || el.type === 'mini' || el.type === 'path' || el.type === 'text' || e.shiftKey) && d.length === 2;
    if (keep) { const ar = o.w / o.h; if (Math.abs(w - o.w) > Math.abs(h - o.h)) h = w / ar; else w = h * ar; if (d.includes('w')) x = o.x + o.w - w; if (d.includes('n')) y = o.y + o.h - h; }
    if (w < 2) { w = 2; if (d.includes('w')) x = o.x + o.w - 2; } if (h < 2) { h = 2; if (d.includes('n')) y = o.y + o.h - 2; }
    if (o.rot) { const ux = d.includes('e') ? 0 : d.includes('w') ? 1 : 0.5, uy = d.includes('s') ? 0 : d.includes('n') ? 1 : 0.5, a = o.rot * Math.PI / 180;
      const wp = (bx, by, bw, bh) => { const cx = bx + bw / 2, cy = by + bh / 2, lx = ux * bw - bw / 2, ly = uy * bh - bh / 2; return [cx + lx * Math.cos(a) - ly * Math.sin(a), cy + lx * Math.sin(a) + ly * Math.cos(a)]; };
      const [ax0, ay0] = wp(o.x, o.y, o.w, o.h), [ax1, ay1] = wp(x, y, w, h); x += ax0 - ax1; y += ay0 - ay1; }
    el.x = r1(x); el.y = r1(y); el.w = r1(w); el.h = r1(h);
    if (el.type === 'text' && d.length === 2) scaleTextBy(el, o, el.w / o.w); /* 모서리 끌기 = 글자 크기도 함께 (캔바·미리캔버스와 같음) */
    if (el.type === 'path' && o.pts) { const sx = el.w / o.w, sy = el.h / o.h; el.pts = o.pts.map(pt => [r1(pt[0] * sx), r1(pt[1] * sy)]); renderCanvas(); } else if (el.type === 'text') { renderCanvas(); } else liveUpdate([el]);
    renderOverlay();
  } else if (drag.kind === 'rot') {
    const el = drag.el; let a = Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180 / Math.PI + 90; if (e.shiftKey) a = Math.round(a / 15) * 15; el.rot = Math.round(((a % 360) + 360) % 360); liveUpdate([el]); renderOverlay();
  } else if (drag.kind === 'gresize') {
    // 여러 요소를 한 상자처럼 비율 유지 확대·축소 (글자 크기·선 두께도 함께)
    const B = drag.box, d = drag.dir; const ax = d.includes('w') ? B.x + B.w : B.x, ay = d.includes('n') ? B.y + B.h : B.y;
    const nw = Math.abs(p.x - ax), nh = Math.abs(p.y - ay); const k = Math.max(0.05, Math.max(nw / B.w, nh / B.h));
    const nx = d.includes('w') ? ax - B.w * k : ax, ny = d.includes('n') ? ay - B.h * k : ay;
    drag.els.forEach((el, i) => { const o = drag.o[i]; el.x = r1(nx + (o.x - B.x) * k); el.y = r1(ny + (o.y - B.y) * k); el.w = r1(o.w * k); el.h = r1(o.h * k); if (o.size) el.size = Math.round(o.size * k * 10) / 10; if (o.html) el.html = o.html.replace(/font-size:\s*([\d.]+)pt/g, (_, v) => 'font-size:' + Math.round(v * k * 2) / 2 + 'pt'); if (o.strokeW) el.strokeW = Math.round(o.strokeW * k * 100) / 100; if (o.pts) el.pts = o.pts.map(q => [r1(q[0] * k), r1(q[1] * k)]); });
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
}
document.addEventListener('pointerup', e => {
  flushMove();
  if (pen) { const pts = pen.pts; pen = null; const pv = $('#ovl .penprev'); if (pv) pv.remove(); if (pts.length < 3) return; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1, w = Math.max(2, Math.max(...xs) - x0 + 1), h = Math.max(2, Math.max(...ys) - y0 + 1); const el = { id: uid(), type: 'path', pts: pts.map(p => [r1(p[0] - x0), r1(p[1] - y0)]), x: r1(x0), y: r1(y0), w: r1(w), h: r1(h), rot: 0, stroke: penStyle.stroke, strokeW: penStyle.strokeW, fill: '', closed: false, smooth: true, opacity: 1, name: '펜 선' }; page().els.push(el); commit(); select([el.id]); rerender(); return; }
  if (!drag) return; const d = drag; drag = null;
  if (d.kind === 'cells') { renderInspector(); showCellBar(); return; }
  if (d.kind === 'cgl') { if (d.moved) commit(); rerender(); return; }
  if (d.kind === 'marq') { renderInspector(); if (sideTab === 'layers') renderSide(); renderOverlay(); updateToolbarState(); return; }
  if (!d.moved && d.reduceTo) { select(d.reduceTo); return; } // 여러 개 고른 상태에서 하나를 누르고 떼면 그것만 (Figma·일러스트와 같음)
  if (!d.moved && d.dup) { page().els = page().els.filter(x => !d.dup.ids.includes(x.id)); sel = d.dup.orig; renderCanvas(); } // Alt+누르기만 하고 안 옮겼으면 복제 취소
  if (d.moved) { commit(); rerender(); } else renderOverlay();
});
const penStyle = { stroke: '#1E2B5A', strokeW: 0.8 };
function liveUpdate(els) { ghostSoon(); const c = $('#canvas'); els.forEach(el => { const dom = c.querySelector(`[data-id="${el.id}"]`); if (!dom) return; dom.style.left = el.x + 'mm'; dom.style.top = el.y + 'mm'; dom.style.width = el.w + 'mm'; dom.style[el.type === 'text' && !isWarp(el) ? 'minHeight' : 'height'] = el.h + 'mm'; dom.style.transform = `rotate(${el.rot || 0}deg)`; }); }
function snap(x, y, w, h, selfIds) {
  const T = Math.max(0.1, 6 / (kScale() * MM)), guides = []; const xs = [0, doc.w / 2, doc.w], ys = [0, doc.h / 2, doc.h];
  if (showGuides() && (Number(doc.bleed) > 0 || doc.fmt)) { const m = safeMM(); xs.push(m, doc.w - m); ys.push(m, doc.h - m); } // 안전 여백 선에도 붙음
  if (doc.guides && showGuides()) { xs.push(...(doc.guides.x || [])); ys.push(...(doc.guides.y || [])); } // 사용자 안내선
  page().els.forEach(el => { if (selfIds.includes(el.id) || el.hidden) return; xs.push(el.x, el.x + el.w / 2, el.x + el.w); ys.push(el.y, el.y + el.h / 2, el.y + el.h); });
  let bx = null, by = null, bdx = T, bdy = T, gx = null, gy = null;
  [[x, 0], [x + w / 2, w / 2], [x + w, w]].forEach(([v, off]) => xs.forEach(g => { const dd = Math.abs(v - g); if (dd < bdx) { bdx = dd; bx = g - off; gx = g; } }));
  [[y, 0], [y + h / 2, h / 2], [y + h, h]].forEach(([v, off]) => ys.forEach(g => { const dd = Math.abs(v - g); if (dd < bdy) { bdy = dd; by = g - off; gy = g; } }));
  if (gx != null) guides.push({ v: gx }); if (gy != null) guides.push({ h: gy });
  return { x: bx != null ? bx : x, y: by != null ? by : y, guides };
}
wrap.addEventListener('dblclick', e => {
  const gl = e.target.closest('.ovl .cgl'); if (gl) { const el = selEls()[0]; if (el) { if (gl.dataset.cgl[0] === 'c') delete el.colW; else delete el.rowH; commit(); rerender(); toast(gl.dataset.cgl[0] === 'c' ? '모든 열 너비를 같게 했습니다' : '모든 행 높이를 같게 했습니다'); } return; }
  const cell = (document.elementsFromPoint(e.clientX, e.clientY).find(n => n.closest && n.closest('.el-cal .cell')) || e.target).closest('.el-cal .cell'); if (cell && sel.length === 1 && find(sel[0]).type === 'cal') { const c = Number(cell.dataset.c); cellSel = { id: sel[0], a: c, b: c }; renderOverlay(); openCellEditor(c); return; }
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
  const fresh = el && freshText === el.id; freshText = null; // 방금 만든 글 상자: 넣은 글자까지 한 번의 실행 취소로
  if (el && !t.trim()) { page().els = page().els.filter(x => x !== el); sel = sel.filter(id => id !== el.id); if (fresh && hptr > 0) { hist.length = hptr; histMeta.length = hptr; hptr--; markDirty(); } else commit(); rerender(); return; } // 비운 글 상자는 지움 (Figma와 같음)
  if (el && (t !== el.text || (html || '') !== (el.html || ''))) { el.text = t; if (html) { el.html = html; el.htmlFor = t; } else { delete el.html; delete el.htmlFor; } fresh ? amendCommit() : commit(); }
  rerender();
}
let freshText = null;
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
    const st = block ? '' : styleOf(n); if (st) { formatted = true; out.push(`<span style="${esc(st)}">`); }
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
    $('#tbColor').addEventListener('blur', e => { const t = e.relatedTarget; if (editing && !(t && (editing.contains(t) || t.closest('#textBar')))) setTimeout(() => { if (editing && document.activeElement !== editing && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#textBar'))) endEdit(); }, 0); });
    $('#tbColor').addEventListener('mousedown', () => saveSel());
    decorateColors(b);
  }
  b.hidden = false; placeTextBar(); updTextBar();
}
let savedRange = null; function saveSel() { const s = getSelection(); if (s.rangeCount) savedRange = s.getRangeAt(0).cloneRange(); } function restoreSel() { if (!savedRange) return; const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
function hideTextBar() { const b = $('#textBar'); if (b) b.hidden = true; }
function placeTextBar() { const b = $('#textBar'); if (!b || !editing) return; const r = editing.getBoundingClientRect(); b.style.left = Math.max(8, Math.min(r.left, innerWidth - b.offsetWidth - 8)) + 'px'; b.style.top = Math.max(60, r.top - b.offsetHeight - 10) + 'px'; }
function updTextBar() { const b = $('#textBar'); if (!b || !editing) return; Object.entries(FMT_CMD).forEach(([k, c]) => { const x = b.querySelector(`[data-tf="${k}"]`); try { x.classList.toggle('on', document.queryCommandState(c)); } catch (e) {} }); $$('#inspector [data-tfi]').forEach(x => { try { x.classList.toggle('on', document.queryCommandState(FMT_CMD[x.dataset.tfi])); } catch (e) {} }); }
document.addEventListener('selectionchange', () => { if (editing) updTextBar(); });
// 편집 중이 아닐 때 Ctrl+B·I·U는 고른 글 상자 전체에
document.addEventListener('keydown', e => { if (editing || !(e.ctrlKey || e.metaKey) || (e.target.matches && e.target.matches('input,textarea,select')) || document.querySelector('dialog[open]')) return; const k = { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]; if (k && selEls().some(x => x.type === 'text')) { e.preventDefault(); e.stopImmediatePropagation(); toggleFmt(k); } }, true);
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
function fitTextH(d, el, growOnly) { const mh = d.style.minHeight; d.style.minHeight = '0'; const ch = r1(d.offsetHeight / MM); d.style.minHeight = mh; const top = !el.valign || el.valign === 'top'; if (top && !growOnly ? Math.abs(ch - el.h) > 0.05 : ch > el.h + 0.05) return Math.max(2, ch); return null; }
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
  const cr2 = $('#canvas').getBoundingClientRect(); sc.scrollLeft += (cr2.left + px * zoom) - cx; sc.scrollTop += (cr2.top + py * zoom) - cy; placeTextBar(); if (cellSel) renderOverlay();
}
$('#scroller').addEventListener('scroll', () => { placeTextBar(); if (cellSel) showCellBar(); });
$('#scroller').addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoomAt((zoom || kScale()) * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY); }, { passive: false });
// Space를 누른 채 끌면 화면 이동 (손 도구)
let spaceDown = false, panDrag = null;
document.addEventListener('keydown', e => { if (e.code === 'Space' && !editing && !$('#cellEd') && !(e.target.matches && e.target.matches('input,textarea,select,[contenteditable="true"]')) && !document.querySelector('dialog[open]')) { if (!spaceDown) { spaceDown = true; $('#stage').classList.add('panning'); } e.preventDefault(); } });
document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; $('#stage').classList.remove('panning', 'grabbing'); } });
window.addEventListener('blur', () => { spaceDown = false; panDrag = null; $('#stage').classList.remove('panning', 'grabbing'); });
$('#scroller').addEventListener('pointerdown', e => { if (!spaceDown) return; e.preventDefault(); e.stopPropagation(); const sc = $('#scroller'); panDrag = { x: e.clientX, y: e.clientY, sl: sc.scrollLeft, st: sc.scrollTop }; $('#stage').classList.add('grabbing'); }, true);
// 페이지 밖 회색 작업 공간: 누르면 선택 풀기, 끌면 영역 고르기 (미리캔버스처럼). 손바닥(Space)은 위 처리기가 먼저 가져감
$('#scroller').addEventListener('pointerdown', e => { if (e.button !== 0 || spaceDown || e.target !== $('#scroller') || tool === 'pen') return; if ($('#cellEd')) closeCellEditor(true); if (editing) endEdit(); flushNudge(); if (!e.shiftKey) { cellSel = null; select([]); } drag = { kind: 'marq', start: toMM(e), moved: false, base: e.shiftKey ? sel.slice() : [] }; });
document.addEventListener('pointermove', e => { if (!panDrag) return; const sc = $('#scroller'); sc.scrollLeft = panDrag.sl - (e.clientX - panDrag.x); sc.scrollTop = panDrag.st - (e.clientY - panDrag.y); });
document.addEventListener('pointerup', () => { if (panDrag) { panDrag = null; $('#stage').classList.remove('grabbing'); } });
// Ctrl+0 화면에 맞춤 · Ctrl+1 실제 크기(100%) · Ctrl+= 확대 · Ctrl+- 축소
document.addEventListener('keydown', e => { if (!(e.ctrlKey || e.metaKey) || e.altKey || (e.target.matches && e.target.matches('input,textarea,select')) || document.querySelector('dialog[open]')) return; if (tlOn() && /^[=+\-]$/.test(e.key)) return; const k = e.key; if (k === '0') { e.preventDefault(); zoom = 0; fitCanvas(); } else if (k === '1') { e.preventDefault(); zoomAt(1); } else if (k === '=' || k === '+') { e.preventDefault(); zoomAt((zoom || kScale()) * 1.25); } else if (k === '-') { e.preventDefault(); zoomAt((zoom || kScale()) / 1.25); } }, true);
$('#zoomIn').onclick = () => zoomAt((zoom || kScale()) * 1.2);
$('#zoomOut').onclick = () => zoomAt((zoom || kScale()) / 1.2);
$('#zoomFit').onclick = () => { zoom = 0; fitCanvas(); };
$('#pnTl').onclick = () => tlShow(!tlOn()); $('#prevPage').onclick = () => goto(cur - 1); $('#nextPage').onclick = () => goto(cur + 1);
window.addEventListener('resize', () => { fitCanvas(); renderThumbs(); });
function setTool(t) { tool = t; $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); $('#stage').classList.toggle('pen', t === 'pen'); if (t === 'pen') { select([]); toast('펜: 페이지 위에서 끌어 선을 그립니다. Esc로 끝냅니다.'); } }
$$('[data-tool]').forEach(b => b.onclick = () => setTool(tool === b.dataset.tool ? 'select' : b.dataset.tool));

document.addEventListener('keydown', e => {
  if (editing) { if (e.key === 'Escape' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); endEdit(); } return; }
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
  if (e.key === 'Escape') { if (cancelDrag()) return; if (tool !== 'select') setTool('select'); else select([]); return; }
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
  if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return; }
  if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) { e.preventDefault(); reorder(e.code === 'BracketRight' ? (e.shiftKey ? 'front' : 'up') : (e.shiftKey ? 'back' : 'down')); return; }
  if (mod && !e.altKey && (e.code === 'KeyC' || e.code === 'KeyX')) { if (sel.length) doCopy(e.code === 'KeyX'); return; }
  if (mod && !e.altKey && e.code === 'KeyV') { pasteShift = e.shiftKey; clearTimeout(pasteFallback); if (clip && clip.els) { const sh = e.shiftKey; pasteFallback = setTimeout(() => doPaste(sh), 150); } return; } // paste 이벤트가 안 오는 브라우저(사파리 등) 대비 // 실제 붙여넣기는 paste 이벤트에서 (바깥 그림·글자와 구분)
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); select(page().els.filter(x => !x.hidden && !x.locked).map(x => x.id)); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.length) { e.preventDefault(); removeSel(); } return; }
  // 선택한 요소가 없으면 ↑↓(←→)로 페이지를 이동 (페이지 목록에서 고른 뒤 계속 넘기기)
  if (e.key.startsWith('Arrow') && !sel.length) { e.preventDefault(); goto(cur + (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1)); const t = document.querySelector(`#thumbs .thumb[data-i="${cur}"]`); if (t) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  if (e.key.startsWith('Arrow')) { if (!sel.length) return; e.preventDefault(); const d = e.altKey ? 0.1 : e.shiftKey ? 5 : 1; selEls().forEach(el => { if (el.locked) return; if (e.key === 'ArrowLeft') el.x = r1(el.x - d); if (e.key === 'ArrowRight') el.x = r1(el.x + d); if (e.key === 'ArrowUp') el.y = r1(el.y - d); if (e.key === 'ArrowDown') el.y = r1(el.y + d); }); commitSoon(); rerender(); return; }
  if (e.key === 'PageDown') goto(cur + 1); if (e.key === 'PageUp') goto(cur - 1);
  if (e.code === 'KeyP' && !mod && !e.altKey) setTool(tool === 'pen' ? 'select' : 'pen');
  if (e.code === 'KeyT' && !mod && !e.altKey) addText('b');
});
function removeSel() { const lk = selEls().filter(el => el.locked).length; page().els = page().els.filter(el => !sel.includes(el.id) || el.locked); commit(); sel = []; histMeta[hptr] && (histMeta[hptr].sel = histMeta[hptr].sel.slice()); rerender(); /* 기록에는 지운 요소의 선택을 남겨 Ctrl+Z 하면 다시 골라진 상태로 */ if (lk) toast(`잠긴 요소 ${lk}개는 지우지 않았습니다 (잠금을 풀고 지우세요)`); }
function duplicate() { if (!sel.length) return; const gmap = {}; const ids = selEls().map(el => { const n = clone(el); n.id = uid(); delete n.gen; if (n.group) { gmap[n.group] = gmap[n.group] || uid(); n.group = gmap[n.group]; } n.x += 5; n.y += 5; page().els.push(n); return n.id; }); commit(); select(ids); rerender(); }
// 그룹: 고른 것이 두 묶음 이상이면 (그룹+낱개, 그룹+그룹도) 하나로 묶고, 그룹 하나만 골랐으면 해제
function selUnitCount() { const els = selEls(); return new Set(els.map(e => e.group || e.id)).size; }
function groupSel() { const els = selEls(); if (selUnitCount() < 2) { if (els.some(e => e.group)) toast('그룹 해제는 Ctrl+Shift+G'); return; } const g = uid(); els.forEach(e => e.group = g); commit(); select(els.map(e => e.id)); toast('그룹으로 묶었습니다 (해제: Ctrl+Shift+G)'); }
function ungroupSel() { const els = selEls(); if (!els.some(e => e.group)) return; els.forEach(e => delete e.group); commit(); select(els.map(e => e.id)); toast('그룹을 해제했습니다'); }
function toggleGroup() { if (selUnitCount() >= 2) groupSel(); else ungroupSel(); }
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
  return [...m.values()].map(els => Object.assign({ els }, unionBox(els)));  /* 회전된 요소는 실제 보이는 모양 기준으로 정렬 */
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
const TEXT_DEF = Object.assign({ type: 'text', text: '글자를 입력하세요', x: 20, y: 20, w: 80, h: 10, rot: 0, font: 'Pretendard', size: 14, weight: 400, italic: false, color: '#1a1a1a', align: 'left', lh: 1.3, ls: 0, strokeW: 0, strokeC: '#ffffff', shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, FX.TEXT_FX_DEF);
function addEl(el, at) { el.id = el.id || uid(); delete el.gen; if (at !== false) { el.x = r1(clamp((doc.w - el.w) / 2, 0, doc.w)); el.y = r1(clamp((doc.h - el.h) / 2, 0, doc.h)); } page().els.push(el); commit(); select([el.id]); rerender(); return el; }
function addEls(els, name) { if (!els.length) return; els.forEach(e => delete e.gen);
  { /* 문서 크기에 맞춰 요소 크기 조절 (현수막에선 점처럼, 명함에선 넘치던 것) — 묶음 전체를 같은 비율로 */
    const bw0 = Math.max(...els.map(e => e.x + e.w)) - Math.min(...els.map(e => e.x)), bh0 = Math.max(...els.map(e => e.y + e.h)) - Math.min(...els.map(e => e.y));
    const kk = Math.min(docK(), doc.w * 0.6 / Math.max(1, bw0), doc.h * 0.6 / Math.max(1, bh0));
    if (Math.abs(kk - 1) > 0.02) els.forEach(e => { e.x *= kk; e.y *= kk; e.w = r1(e.w * kk); e.h = r1(e.h * kk); if (e.size) e.size = Math.round(e.size * kk * 10) / 10; if (e.strokeW) e.strokeW = Math.round(e.strokeW * kk * 100) / 100; if (e.radius) e.radius *= kk; if (Array.isArray(e.pts)) e.pts = e.pts.map(q => [q[0] * kk, q[1] * kk]); }); }
  const xs = els.map(e => e.x), ys = els.map(e => e.y); const bw = Math.max(...els.map(e => e.x + e.w)) - Math.min(...xs), bh = Math.max(...els.map(e => e.y + e.h)) - Math.min(...ys); const ox = r1(clamp((doc.w - bw) / 2, 0, doc.w)) - Math.min(...xs), oy = r1(clamp((doc.h - bh) / 2, 0, doc.h)) - Math.min(...ys); const g = els.length > 1 ? uid() : null; els.forEach(e => { e.id = e.id || uid(); e.x = r1(e.x + ox); e.y = r1(e.y + oy); if (g) e.group = g; page().els.push(e); }); commit(); select(els.map(e => e.id)); rerender(); noteRecentElem(name); }
// 새 요소 크기는 문서 크기에 맞춤 (A5 기준. 현수막에서 너무 작거나 스티커에서 너무 크지 않게)
const docK = () => clamp(Math.min(doc.w, doc.h) / 148, 0.35, 20);
function addText(preset, st) { const base = Object.assign({}, TEXT_DEF, lastTextStyle || {}); const k = docK(); const p0 = preset === 'h' ? { text: '제목을 입력하세요', size: 36, weight: 700, w: 120, h: 16, ls: -0.02 } : preset === 's' ? { text: '부제목을 입력하세요', size: 20, weight: 500, w: 100, h: 10 } : { text: '본문 글을 입력하세요', size: 12, weight: 400, w: 90, h: 8 }; const p = Object.assign({}, p0, { size: Math.round(p0.size * k * 2) / 2, w: r1(Math.min(p0.w * k, doc.w * 0.9)), h: r1(p0.h * k) }); if (st && st.text && !st.w) p.w = r1(Math.min(doc.w * 0.8, Math.max(p.w, 20 * k))); const noEdit = st && st.noEdit; if (st) delete st.noEdit; const el = addEl(Object.assign(base, p, st || {})); if (noEdit) return el; freshText = el.id; setTimeout(() => { const d = $(`#canvas [data-id="${el.id}"]`); if (d && !(el.warp && el.warp !== 'none')) startEdit(d); }, 50); return el; }
function addShape(kind, st) { const k = docK(); const def = { type: 'shape', kind, x: 0, y: 0, w: r1(40 * k), h: kind === 'line' ? r1(4 * k) : r1(40 * k), rot: 0, fill: kind === 'line' ? '#333333' : '#F0716B', stroke: '', strokeW: kind === 'line' ? 0.6 : 0, radius: 0, opacity: 1, name: '' }; if (kind === 'line') { def.w = r1(80 * k); def.strokeW = 0.6 * k; } if (kind === 'polygon') def.sides = 6; addEl(Object.assign(def, st || {})); }
function addImage(ref) { const el = { type: 'image', src: ref, x: 0, y: 0, w: 60, h: 60, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }; const s = src(ref); if (s) { const i = new Image(); i.onload = () => { const ar = i.naturalWidth / i.naturalHeight; el.w = Math.min(80 * docK(), doc.w * 0.6); el.h = r1(el.w / ar); if (el.h > doc.h * 0.8) { el.h = r1(doc.h * 0.8); el.w = r1(el.h * ar); } el.x = r1((doc.w - el.w) / 2); el.y = r1((doc.h - el.h) / 2); rerender(); if (hptr === at && hist.length - 1 === at) amendCommit(); else commit(); }; i.src = s; } addEl(el); const at = hptr; }
function addCal() { const y = doc.calendar.year || new Date().getFullYear(); ensureHolidays(y, true); addEl({ type: 'cal', year: y, month: 1, x: 0, y: 0, w: Math.min(204, doc.w - 20), h: Math.min(100, doc.h - 30), rot: 0, opacity: 1, s: {}, events: [], notes: [], name: '달력' }); }
function addMini() { const y = doc.calendar.year || new Date().getFullYear(); addEl({ type: 'mini', year: y, month: 1, x: 0, y: 0, w: 42, h: 24, rot: 0, opacity: 1, s: {}, name: '미니 달력' }); }
function fileToDataURL(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }
function recentElems() { try { return JSON.parse(localStorage.getItem('naracal-recent-elems') || '[]'); } catch (e) { return []; } }
function noteRecentElem(id) { if (!id) return; const r = recentElems().filter(x => x !== id); r.unshift(id); try { localStorage.setItem('naracal-recent-elems', JSON.stringify(r.slice(0, 8))); } catch (e) {} }

/* ======================= 왼쪽 레일 패널 ======================= */
let sideTab = 'pages', tplCat = 'all', tplQ = '', elCat = 'all', elQ = '', tplF = { format: '', season: '', age: '', occasion: '', biz: '' };
/* ======================= 소식지 (나라차 소식지 엔진 결합) =======================
   내용(데이터 불러오기·일정·명단·사진첩·보관·클라우드)은 지금 쓰는 소식지 엔진(../naracha/news.html)을 그대로 쓰고
   (같은 주소라 접속키·보관한 호·사진이 그대로 보임), 화면은 공방과 같은 모양으로 입혀 가운데 작업 영역에 띄움.
   [공방 디자인으로 가져오기]는 엔진이 그리는 명령을 기록해 글 상자·사진·도형·벡터 모양으로 바꾼 새 문서를 엶. */
let newsMode = false, newsReady = null, newsWin = null, newsObs = null, newsDirty = false, newsSyncing = false;
let animTab = 'in';
const NEWS_NAV = [['pgCover', '표지'], ['pgToc', '목차'], ['pgVirtue', '인성덕목'], ['pgSchedule', '주요 일정'], ['pgCal', '수련계획표'], ['pgTrain', '수련 안내'], ['pgExamInfo', '승급심사 안내'], ['pgRec', '승급심사 추천자'], ['pgKkw', '국기원 응시예정자'], ['pgBday', '생일자'], ['pgAlbum', '사진첩 · 행사 보고'], ['pgCheck', '실천 체크리스트']];
function newsEngine() {
  if (newsReady) return newsReady;
  newsReady = new Promise((res, rej) => {
    const f = document.createElement('iframe'); f.id = 'newsFrame'; f.className = 'newsframe'; f.title = '소식지 내용 편집'; f.src = NC.news.ENGINE;
    const to = setTimeout(() => rej(new Error('소식지 엔진을 열지 못했습니다 (인터넷 연결을 확인하세요)')), 40000);
    f.onload = () => { clearTimeout(to); try { const w = f.contentWindow; if (typeof w.buildPages !== 'function') throw new Error('소식지 엔진이 아닙니다'); newsSkin(w); newsWin = w; res(w); if (sideTab === 'news') renderSide(); if (newsMode) renderInspector(); } catch (e) { rej(e); } };
    $('#stage').appendChild(f);
  });
  newsReady.catch(e => { newsReady = null; const f = $('#newsFrame'); if (f) f.remove(); toast(e.message, true); });
  return newsReady;
}
// 엔진 화면을 공방과 같은 모양으로: 같은 색·글꼴·입력칸·단추, 엔진의 머리줄·왼쪽 메뉴·만들기 구역은 숨김(공방 왼쪽 패널이 대신)
const NEWS_SKIN = `
:root{--bg:#eef0f4;--panel:#fff;--line:#e2e5eb;--line2:#eef0f4;--ink:#1b2130;--ink2:#3f4756;--muted:#707887;--faint:#9aa1ad;--acc:#2f5bea;--acc-h:#254dd1;--acc-soft:#e9eefc;--ring:rgba(47,91,234,.14)}
body{background:var(--bg);font-family:Pretendard,'Noto Sans KR',-apple-system,sans-serif;font-size:13.5px;line-height:1.45}
header,.subbar,.rail,#secMake{display:none!important}
body.nc-make section#secMake{display:block!important}body.nc-make main>section.card:not(#secMake){display:none!important}body.nc-make #secMake>.row:first-of-type,body.nc-make #secMake>.row:first-of-type+.hint{display:none!important}
.shell{display:block}main{max-width:780px;margin:0 auto;padding:22px 26px 140px}
section.card{border-radius:12px;border:1px solid var(--line);box-shadow:0 1px 2px rgba(16,24,40,.05),0 1px 3px rgba(16,24,40,.06);padding:0 0 18px;margin:0 0 16px;scroll-margin-top:18px}
section.card h2{background:#fff;font-size:15px;font-weight:700;letter-spacing:-.01em;padding:16px 20px 13px;margin:0 0 6px;border-bottom:1px solid var(--line2);border-radius:12px 12px 0 0}
section.card h2 .step{background:var(--acc-soft);color:var(--acc);font-weight:800;font-size:11px;border-radius:6px}
section.card>*:not(h2){margin-left:20px;margin-right:20px}
label.fl{font-size:12px;font-weight:600;color:var(--ink2);margin:14px 0 5px}
input[type=text],input[type=password],input[type=date],input[type=number],select,textarea{background:#fff;border:1px solid #cfd4dd;border-radius:8px;padding:8px 10px;font-size:13.5px}
input:focus,select:focus,textarea:focus{border-color:var(--acc);box-shadow:0 0 0 3px var(--ring)}
input[type=file]{border:1px dashed #cfd4dd;background:#f8f9fb;border-radius:8px}
button{font-weight:600;border-radius:8px;font-size:13px}
button.pri{background:var(--acc)}button.pri:hover{background:var(--acc-h)}
button.sec{border:1px solid #cfd4dd;color:var(--ink)}button.sec:hover{background:#f5f6f9;border-color:#b9c0cc}
.hint{color:#5f6775;font-size:12.5px;line-height:1.6}.hint b{color:var(--ink)}
.status{background:#f5f6f9;border-color:var(--line)}
.pgToggle{background:#fff;border:0;border-top:1px solid var(--line2);border-radius:0;padding:16px 0 4px;margin-top:8px;font-size:14px;font-weight:700;scroll-margin-top:18px}
.pgToggle input{accent-color:var(--acc)}
.sub{background:#f8f9fb;border:1px solid var(--line2);border-radius:10px}
.chip{border-color:#cfd4dd;border-radius:999px}.chip:hover{border-color:var(--acc);background:var(--acc-soft)}
.calGrid .cell{border-color:var(--line);border-radius:8px}
details.help{background:#f8f9fb;border-color:var(--line)}details.help summary{color:var(--acc)}
#editBadge{display:none}
::-webkit-scrollbar{width:10px}::-webkit-scrollbar-thumb{background:#cfd4dd;border-radius:10px;border:2px solid var(--bg)}
`;
function newsSkin(w) {
  const d = w.document, st = d.createElement('style'); st.id = 'ncSkin'; st.textContent = NEWS_SKIN; d.head.appendChild(st);
  // 제목·단추·항목 앞의 그림 문자(이모지)는 공방 화면처럼 덜어 냄 (상태 안내 문구는 그대로)
  const EMO = /^[\s←-⯿☀-➿️‍\u{1F000}-\u{1FAFF}]+/u;
  d.querySelectorAll('section.card h2, button, label.fl, summary, .pgToggle span').forEach(n => { n.childNodes.forEach(c => { if (c.nodeType === 3 && EMO.test(c.nodeValue)) c.nodeValue = c.nodeValue.replace(EMO, ''); }); });
  // 머리줄의 호·상태가 바뀌면 공방 패널도 갱신
  const watch = ['heroYm', 'heroSeason', 'hdrStatus', 'editBadge'].map(id => d.getElementById(id)).filter(Boolean);
  newsObs = new MutationObserver(() => { if (sideTab === 'news') newsHeroUpdate(); });
  watch.forEach(n => newsObs.observe(n, { childList: true, characterData: true, subtree: true, attributes: true }));
  ['input', 'change', 'click'].forEach(t => d.addEventListener(t, e => { if (t !== 'click' || (e.target.closest && e.target.closest('button,label,.chip,.cell'))) newsDirty = true; }, true));  /* 소식지 내용이 바뀌었을 수 있음 → 디자인 다듬기로 돌아올 때 반영 */
  d.addEventListener('change', e => { if (e.target && /^pg[A-Z]/.test(e.target.id || '') && sideTab === 'news') renderSide(); if (e.target && /^in(Year|Month|Ratio)$/.test(e.target.id || '')) setTimeout(newsHeroUpdate, 50); });
}
function setNewsMode(on) {
  const was = newsMode;
  newsMode = !!on; if (!newsMode) newsMakeView(false); $('#stage').classList.toggle('newsmode', newsMode);
  if (newsMode) { endEdit(); sel = []; renderOverlay(); newsEngine(); }
  renderInspector(); if (sideTab === 'news') renderSide();
  if (was && !newsMode && doc.news && newsDirty && newsWin) newsSync(true);
}
function newsInfo() {
  const w = newsWin; if (!w || !w.S) return null;
  const d = w.document, t = id => (d.getElementById(id) || {}).textContent || '';
  return { y: w.S.year, m: w.S.month, ratio: w.S.ratio, season: t('heroSeason'), stat: t('hdrStatus'), badge: t('editBadge') };
}
function newsHeroUpdate() {
  const i = newsInfo(), h = $('#nwHero'); if (!h) return;
  if (!i) { h.innerHTML = `<div class="nw-ym">소식지</div><div class="nw-stat">${newsReady ? '소식지 엔진을 여는 중…' : '내용 채우기를 누르면 소식지 엔진이 열립니다'}</div>`; return; }
  const R = { '45': '4:5 세로 1080×1350', '11': '1:1 정사각 1080×1080', '916': '9:16 세로 1080×1920' }[i.ratio] || i.ratio;
  h.innerHTML = `<div class="nw-top"><span class="nw-kicker">NARACHA NEWS LETTER</span>${i.season ? `<span class="nw-season">${esc(i.season)}</span>` : ''}</div><div class="nw-ym">${i.y}<small>년</small> ${i.m}<small>월호</small></div><div class="nw-meta">${esc(R)}</div>${i.stat ? `<div class="nw-stat">${esc(i.stat)}</div>` : ''}`;
}
function newsGo(id) {
  newsMakeView(false); setNewsMode(true);
  newsEngine().then(w => { const d = w.document; if (id === 'settingsCard' && w.showSettings) w.showSettings(true); const el = d.getElementById(id); if (!el) return; const tg = el.closest('.pgToggle') || el; tg.scrollIntoView({ behavior: 'smooth', block: 'start' }); tg.animate([{ background: '#e9eefc' }, { background: getComputedStyle(tg).backgroundColor }], { duration: 1200 }); });
}
function renderNewsSide(body) {
  const w = newsWin, d = w && w.document, on = id => { const c = d && d.getElementById(id); return c ? c.checked : true; };
  const isNews = !!doc.news;
  body.innerHTML = `<div class="nw-hero" id="nwHero"></div>
  <div class="seg nw-mode"><button data-nm="edit" aria-pressed="${newsMode}">내용 채우기</button><button data-nm="design" aria-pressed="${!newsMode}">디자인 다듬기</button></div>
  <h3>내용</h3>
  <div class="nw-nav">
    <button class="nw-it" data-go="secBasic"><span class="nw-ic"><svg class="ic"><use href="#i-settings"/></svg></span><span class="nw-t">기본 설정<small>호 · 비율 · 로고 · 표지 · 배경</small></span></button>
    ${NEWS_NAV.map(([id, t]) => `<div class="nw-it pg${on(id) ? '' : ' off'}" data-go="${id}"><label class="nw-sw" title="이 쪽 넣기/빼기"><input type="checkbox" data-pg="${id}" ${on(id) ? 'checked' : ''}><i></i></label><span class="nw-t">${t}</span></div>`).join('')}
    <button class="nw-it" data-go="secArchive"><span class="nw-ic"><svg class="ic"><use href="#i-folder"/></svg></span><span class="nw-t">지난 호 보관함<small>보관 · 클라우드 · 다른 PC에서 이어서</small></span></button>
    <button class="nw-it" data-go="settingsCard"><span class="nw-ic"><svg class="ic"><use href="#i-link"/></svg></span><span class="nw-t">데이터 연결<small>나라차 프로그램 접속키</small></span></button>
  </div>
  <h3>디자인</h3>
  <button class="btn primary full" id="nwImport"><svg class="ic"><use href="#i-news"/></svg>공방 디자인으로 가져오기</button>
  <p class="hint">채운 내용으로 소식지를 그려 <b>글 상자 · 사진 · 도형 · 벡터 장식</b>으로 바꾼 새 문서를 엽니다. 글꼴·색·배치·사진을 자유롭게 다듬으세요.</p>
  <button class="btn full" id="nwTvDoc"><svg class="ic"><use href="#i-tv"/></svg>TV 화면(16:9) 디자인으로 가져오기</button>
  ${isNews ? `<div class="nw-sync"><button class="btn primary full" id="nwSync"><svg class="ic"><use href="#i-refresh"/></svg>소식지 내용 반영하기</button><p class="hint" style="margin:6px 0 0"><b>연동 중</b> — 내용 채우기에서 고친 뒤 <b>디자인 다듬기</b>로 돌아오면 자동으로 반영됩니다. 바뀐 글·사진·새로 늘어난 명단만 들어오고, <b>관장님이 다듬은 글꼴·색·위치·글자는 그대로</b> 둡니다.${doc.news.at ? ` <span class="nw-at">마지막 반영 ${new Date(doc.news.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}</p></div><button class="btn sm full" id="nwRe" style="margin-top:6px">쪽 통째로 다시 가져오기…</button>` : ''}
  <h3>내보내기${isNews ? '' : ' <small style="text-transform:none;letter-spacing:0;font-weight:500;color:var(--ui-muted)">(지금 문서)</small>'}</h3>
  <div class="tile nw-out"><button id="nwPng"><svg class="ic"><use href="#i-img"/></svg>밴드용 PNG</button><button id="nwPdf"><svg class="ic"><use href="#i-pdf"/></svg>PDF</button><button id="nwVideo" style="grid-column:1/-1;flex-direction:row;justify-content:center"><svg class="ic"><use href="#i-tv"/></svg>TV 영상 MP4</button></div>
  <p class="hint"><b>가져오지 않고 바로 저장</b>하려면 <b>내용 채우기</b>에서 오른쪽 미리보기 아래 <b>바로 저장</b>(PNG · PDF · TV 영상)을 누르세요. 아래 단추는 공방에서 다듬은 문서를 저장합니다 — 다듬은 그대로 PNG·PDF로, TV 영상은 <b>TV 화면(16:9) 디자인</b>을 다듬은 뒤 넘김 효과·움직임·배경 음악을 넣어 TV에서 재생되는 MP4로 저장합니다.</p>`;
  newsHeroUpdate();
  body.onclick = e => {
    const nm = e.target.closest('[data-nm]'); if (nm) { setNewsMode(nm.dataset.nm === 'edit'); return; }
    if (e.target.closest('.nw-sw')) return;
    const go = e.target.closest('[data-go]'); if (go) { newsGo(go.dataset.go); return; }
    const id = (e.target.closest('button') || {}).id;
    if (id === 'nwImport') newsImport(false); else if (id === 'nwTvDoc') newsImport(true); else if (id === 'nwRe') newsReimport(); else if (id === 'nwSync') newsSync(false);
    else if (id === 'nwPng' || id === 'nwPdf') { if (!doc.news && !window.confirm('지금 문서는 소식지가 아닙니다. 지금 문서를 그대로 내보낼까요? (소식지는 먼저 [공방 디자인으로 가져오기])')) return; setNewsMode(false); openDownload(id === 'nwPng' ? 'png' : 'pdfhq'); }
    else if (id === 'nwVideo') newsVideo();
  };
  body.onchange = e => { const c = e.target.closest('[data-pg]'); if (!c) return; newsEngine().then(w2 => { const x = w2.document.getElementById(c.dataset.pg); if (x && x.checked !== c.checked) { x.checked = c.checked; x.dispatchEvent(new w2.Event('change', { bubbles: true })); x.dispatchEvent(new w2.Event('input', { bubbles: true })); } c.closest('.nw-it').classList.toggle('off', !c.checked); }); };
  if (!newsReady && newsMode) newsEngine();
}
function renderNewsInspector() {
  const ins = $('#inspector'); const w = newsWin, made = w && w.MADE || [], ed = w && w.document;
  const make = !!(ed && ed.body.classList.contains('nc-make'));
  const sel = id => { const x = ed && ed.getElementById(id); return x ? `<select id="nw_${id}">${x.innerHTML}</select>` : ''; };
  ins.innerHTML = `<h2 class="phead"><span>미리보기</span></h2><button class="btn full" id="nwPrev"><svg class="ic"><use href="#i-refresh"/></svg>${made.length ? '미리보기 새로 그리기' : '미리보기 그리기'}</button>
  <p class="hint">내용을 고친 뒤 눌러 보세요. 쪽을 누르면 크게 봅니다.</p>
  <div class="nw-direct"><h3>바로 저장 <small>공방으로 가져오지 않고</small></h3>
  <div class="tile nw-out"><button id="nwDPng"><svg class="ic"><use href="#i-img"/></svg>PNG 전체</button><button id="nwDPdf"><svg class="ic"><use href="#i-pdf"/></svg>PDF 한 개</button></div>
  <div class="grid3 nw-tvset"><label class="f"><span>한 장 시간</span>${sel('inTvSec')}</label><label class="f"><span>넘김</span>${sel('inTvTurn')}</label><label class="f"><span>전환</span>${sel('inTvStyle')}</label></div>
  <div class="row" style="gap:6px"><button class="btn sm" id="nwDTvPick" style="flex:1">${make ? 'TV 장 고르기 닫기' : 'TV 화면 미리보기 · 장 고르기'}</button></div>
  <button class="btn primary full" id="nwDTv" style="margin-top:6px"><svg class="ic"><use href="#i-tv"/></svg>TV 영상 저장 (16:9 MP4)</button>
  <p class="hint">PNG는 밴드용 한 장씩, PDF는 보관·인쇄용입니다. TV 영상은 1920×1080 가로 화면으로 다시 배치해 실제 시간만큼 녹화합니다(그동안 이 창을 가리지 마세요). 글꼴·색을 다듬어서 만들려면 왼쪽 <b>공방 디자인으로 가져오기</b>를 쓰세요.</p></div>
  <div class="nw-pv" id="nwPv">${made.map((p, i) => `<button class="nw-pvi" data-i="${i}"><img alt="" src="${p.__thumb || (p.__thumb = thumbOf(p.canvas))}"><span>${i + 1}. ${esc(NC.news.labelOf(p.name))}</span></button>`).join('') || '<p class="hint" style="text-align:center;padding:24px 0">아직 미리보기가 없습니다</p>'}</div>`;
  ins.onclick = e => {
    if (e.target.closest('#nwPrev')) { const b = $('#nwPrev'); b.disabled = true; b.lastChild.textContent = '그리는 중…'; newsEngine().then(w2 => NC.news.prepare(w2)).then(() => renderNewsInspector()).catch(err => { toast('미리보기 실패: ' + err.message, true); renderNewsInspector(); }); return; }
    const id = (e.target.closest('button') || {}).id;
    if (id === 'nwDPng') return newsDirect('png'); if (id === 'nwDPdf') return newsDirect('pdf'); if (id === 'nwDTv') return newsDirect('tv');
    if (id === 'nwDTvPick') { if (make) { newsMakeView(false); renderNewsInspector(); } else newsDirect('tvpick'); return; }
    const it = e.target.closest('.nw-pvi'); if (it && w && w.openViewer) w.openViewer(Number(it.dataset.i));
  };
  ins.onchange = e => { const m = (e.target.id || '').match(/^nw_(inTv\w+)$/); if (!m || !ed) return; const x = ed.getElementById(m[1]); if (!x) return; x.value = e.target.value; x.dispatchEvent(new w.Event('change', { bubbles: true })); };
  ['inTvSec', 'inTvTurn', 'inTvStyle'].forEach(k => { const x = ed && ed.getElementById(k), y = $('#nw_' + k); if (x && y) y.value = x.value; });
}
// 소식지 엔진 화면에서 '만들기' 구역(TV 장 고르기)만 보이기 / 되돌리기
function newsMakeView(on) { const w = newsWin; if (w && w.document && w.document.body) w.document.body.classList.toggle('nc-make', !!on); }
// 미리보기 그대로 바로 저장: 엔진의 저장 기능(PNG·PDF·TV 영상)을 그대로 부름 — 공방 문서는 건드리지 않음
async function newsDirect(kind) {
  let w; try { w = await newsEngine(); } catch (e) { return; }
  if (!(w.MADE && w.MADE.length)) {
    setStatus('미리보기를 그리는 중…');
    try { await NC.news.prepare(w); } catch (e) { toast('미리보기 실패: ' + e.message, true); return; } finally { setStatus(''); }
    renderNewsInspector();
  }
  if (!(w.MADE && w.MADE.length)) { toast('만들 쪽이 없습니다. 왼쪽에서 넣을 쪽을 켜 주세요.', true); return; }
  if (kind === 'png') { w.saveAllPng(); toast(`PNG ${w.MADE.length}장을 차례로 저장합니다 — 브라우저가 «여러 파일 다운로드»를 물으면 허용을 눌러 주세요`); return; }
  if (kind === 'pdf') { w.savePdf(); toast('PDF를 만들어 저장합니다'); return; }
  if (!newsMode) setNewsMode(true);
  newsMakeView(true); w.tvPreview();
  const ar = w.document.getElementById('tvPreviewArea'); if (ar) ar.scrollIntoView({ block: 'start' });
  renderNewsInspector();
  if (kind === 'tv') w.makeTvVideo();
}
function thumbOf(c) { const k = 240 / c.width, t = document.createElement('canvas'); t.width = 240; t.height = Math.round(c.height * k); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', 0.82); }
function newsFmt(wpx, hpx) { if (wpx === 1080 && hpx === 1350) return 'ig45'; if (wpx === 1080 && hpx === 1080) return 'ig'; if (wpx === 1080 && hpx === 1920) return 'story'; return ''; }
// 엔진이 그린 쪽들 → 공방 페이지 (그림은 지금 doc.assets 가 아니라 따로 모아 돌려줌)
function newsPages(cap, into) {
  const keep = doc.assets; doc.assets = into || {};
  try { const pages = NC.news.convert(cap, { addAsset, uid }); pages.forEach((p, i) => { p.news = cap[i].name; p.label = cap[i].label; p.newsBase = { bg: p.bg, els: clone(p.els) }; }); return { pages, assets: doc.assets }; } finally { doc.assets = keep; }
}
async function newsCapture(tv) {
  const w = await newsEngine(); setStatus(tv ? 'TV 화면을 그리는 중…' : '소식지를 그리는 중…');
  try { const cap = await NC.news.capture(w, { tv }); if (!cap.length) throw new Error('만들 쪽이 없습니다. 내용 채우기에서 넣을 쪽을 켜 주세요.'); return { w, cap }; } finally { setStatus(''); }
}
async function newsImport(tv, asked) {
  let r; try { r = await newsCapture(tv); } catch (e) { toast(e.message, true); return; }
  const { w, cap } = r, S = w.S;
  if (!asked && doc.pages.some(p => p.els.length) && !window.confirm(`${S.year}년 ${S.month}월호 소식지${tv ? ' TV 화면' : ''} ${cap.length}쪽을 새 문서로 엽니다. 지금 문서를 닫을까요? (${keepNote()})`)) return;
  await keepCurrentDoc();
  const { pages, assets } = newsPages(cap);
  await store.disconnect();
  const nd = newDoc(); const W0 = cap[0].w, H0 = cap[0].h;
  nd.w = Math.round(W0 * NC.news.PX * 100) / 100; nd.h = Math.round(H0 * NC.news.PX * 100) / 100; nd.fmt = newsFmt(W0, H0);
  nd.name = `${S.year}년 ${S.month}월호 소식지${tv ? ' TV' : ''}`; nd.pages = pages; nd.assets = assets; nd.fonts = []; nd.calendar = doc.calendar; nd.holidays = doc.holidays; nd.rules = doc.rules;
  nd.news = { ym: `${S.year}-${String(S.month).padStart(2, '0')}`, ratio: tv ? 'tv' : S.ratio, tv: !!tv, at: Date.now() };
  doc = nd; hist = []; histMeta = []; hptr = -1; cur = 0; sel = []; $('#pname').value = doc.name; commit(); clearTimeout(fileTimer);
  setStatus('아직 저장 위치를 고르지 않았습니다 · 저장(Ctrl+S)을 누르면 위치를 고릅니다 (그 전까지는 이 브라우저에 임시 저장)');
  zoom = 0; newsMode = false; $('#stage').classList.remove('newsmode'); renderAll(); fitCanvas(); updateSaveBadge();
  toast(`${doc.name} ${pages.length}쪽을 가져왔습니다 — 글자·사진·장식을 눌러 다듬으세요`);
}
// 소식지 ↔ 디자인 연동: 엔진이 새로 그린 쪽을 요소 단위로 합침 (다듬은 것은 지키고 바뀐 내용만) — 합치는 규칙은 news.js 7절
async function newsSync(auto) {
  if (!doc.news || newsSyncing) return;
  let w = newsWin; if (!w && !auto) { try { w = await newsEngine(); } catch (e) { return; } } if (!w || !w.S) return;
  const S = w.S, ym = `${S.year}-${String(S.month).padStart(2, '0')}`, tv = !!doc.news.tv;
  const R = { '45': '4:5', '11': '1:1', '916': '9:16' };
  if (doc.news.ym !== ym || (!tv && doc.news.ratio !== S.ratio)) {
    const msg = `소식지 엔진에 열린 호(${S.year}년 ${S.month}월호 · ${R[S.ratio] || S.ratio})가 이 디자인(${doc.news.ym.replace('-', '년 ')}월호 · ${tv ? 'TV' : R[doc.news.ratio] || doc.news.ratio})과 달라`;
    if (auto) { setStatus(msg + ' 자동 반영하지 않았습니다'); return; }
    if (!window.confirm(msg + '요. 그래도 이 디자인에 반영할까요?\n(다른 호의 내용이 들어갑니다)')) return;
  }
  newsSyncing = true; setStatus('소식지 내용 변경을 디자인에 반영하는 중…');
  try {
    const cap = await NC.news.capture(w, { tv }); if (!cap.length) { toast('소식지에 켜진 쪽이 없습니다', true); return; }
    const { pages: next, assets } = newsPages(cap, Object.assign({}, doc.assets));
    const SY = NC.news.sync, tot = { changed: 0, added: 0, removed: 0, kept: 0 }, newPages = [], capNames = new Set(cap.map(c => c.name));
    let baselined = 0, visible = false;
    next.forEach((np, ci) => {
      const at = doc.pages.findIndex(p => p.news === np.news);
      if (at < 0) { let pos = doc.pages.length; for (let j = ci - 1; j >= 0; j--) { const q = doc.pages.findIndex(p => p.news === cap[j].name); if (q >= 0) { pos = q + 1; break; } } doc.pages.splice(pos, 0, np); newPages.push(np.label); visible = true; return; }
      const pg = doc.pages[at];
      if (!pg.newsBase) { pg.newsBase = SY.baseFor(pg, np, doc.w); baselined++; return; }
      const r = SY.mergePage(pg.newsBase, pg, np, uid, doc.w);
      pg.els = r.els; pg.bg = r.bg; pg.newsBase = r.base;
      Object.keys(tot).forEach(k => { tot[k] += r.st[k]; }); if (r.st.changed + r.st.added + r.st.removed) visible = true;
    });
    for (const k in assets) if (!doc.assets[k]) doc.assets[k] = assets[k];
    const gone = doc.pages.filter(p => p.news && !capNames.has(p.news)).map(p => p.label || NC.news.labelOf(p.news));
    doc.news.at = Date.now(); newsDirty = false;
    if (visible) commit(); else amendCommit();   /* 기준만 바뀐 경우는 되돌리기 단계를 늘리지 않음 */
    renderAll(); if (sideTab === 'news') renderSide();
    const parts = [];
    if (tot.changed) parts.push(`바뀐 요소 ${tot.changed}`); if (tot.added) parts.push(`새 요소 ${tot.added}`); if (tot.removed) parts.push(`빠진 요소 ${tot.removed}`); if (newPages.length) parts.push(`새 쪽 ${newPages.join(', ')}`);
    let msg = parts.length ? `소식지 변경을 디자인에 반영했습니다 — ${parts.join(' · ')}` : (auto ? '' : '소식지 내용과 디자인이 이미 같습니다');
    if (tot.kept) msg += `${msg ? '. ' : ''}직접 다듬은 ${tot.kept}곳은 소식지 쪽 변경을 받지 않고 그대로 두었습니다`;
    if (baselined) msg += `${msg ? '. ' : ''}예전에 가져온 쪽 ${baselined}개는 이번에 기준만 잡았습니다(다음 변경부터 반영)`;
    if (gone.length) msg += `${msg ? '. ' : ''}소식지에서 꺼진 쪽(${gone.join(', ')})은 디자인에 남겨 두었습니다`;
    if (visible) toastUndo(msg); else if (msg) toast(msg); else setStatus('소식지 내용과 디자인이 같습니다');
  } catch (e) { toast('소식지 반영 실패: ' + e.message, true); } finally { newsSyncing = false; if (/반영하는 중/.test(($('#status') || {}).textContent || '')) setStatus(''); }
}
// 바뀐 쪽만 다시: 엔진이 새로 그린 쪽 중 고른 것만 이 문서의 같은 쪽과 바꿈(없던 쪽은 제자리에 끼워 넣음)
async function newsReimport() {
  let r; try { r = await newsCapture(doc.news && doc.news.tv); } catch (e) { toast(e.message, true); return; }
  const { cap } = r; const have = new Map(doc.pages.map((p, i) => [p.news, i]));
  let d = $('#dlgNewsRe'); if (d) d.remove();
  d = document.createElement('dialog'); d.id = 'dlgNewsRe'; d.className = 'nw-dlg';
  d.innerHTML = `<div class="dhead"><h2>바뀐 쪽 다시 가져오기</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody"><p class="hint">체크한 쪽만 새 내용으로 바꿉니다. <b>이미 있는 쪽을 바꾸면 그 쪽에서 다듬은 것은 사라집니다</b>(되돌리기 가능). 새로 생긴 쪽은 처음부터 체크되어 있습니다.</p><div class="nw-re">${cap.map((c, i) => { const ex = have.has(c.name); return `<label class="nw-rei"><img alt="" src="${thumbOf(c.canvas)}"><span><input type="checkbox" data-i="${i}" ${ex ? '' : 'checked'}> ${i + 1}. ${esc(c.label)}</span><em class="${ex ? '' : 'new'}">${ex ? '디자인에 있음' : '새 쪽'}</em></label>`; }).join('')}</div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>취소</button><button class="btn primary" id="nwReGo">고른 쪽 바꾸기</button></div></div>`;
  document.body.appendChild(d); d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => d.close()); d.addEventListener('close', () => d.remove()); d.showModal();
  $('#nwReGo').onclick = () => {
    const idx = [...d.querySelectorAll('input[data-i]:checked')].map(x => Number(x.dataset.i)); if (!idx.length) { d.close(); return; }
    const { pages, assets } = newsPages(idx.map(i => cap[i]), {}); Object.assign(doc.assets, assets);
    let n = 0;
    idx.forEach((ci, k) => { const pg = pages[k], at = doc.pages.findIndex(p => p.news === cap[ci].name); if (at >= 0) doc.pages[at] = pg; else { let pos = doc.pages.length; for (let j = ci - 1; j >= 0; j--) { const q = doc.pages.findIndex(p => p.news === cap[j].name); if (q >= 0) { pos = q + 1; break; } } doc.pages.splice(pos, 0, pg); } n++; });
    doc.news.at = Date.now(); d.close(); commit(); goto(Math.min(cur, doc.pages.length - 1)); toastUndo(`${n}쪽을 새 내용으로 바꿨습니다`);
  };
}
// 소식지 TV 영상: TV(16:9) 디자인 문서에서 MP4로. 지금 문서가 세로 소식지면 TV 화면 디자인을 먼저 가져옴
async function newsVideo() {
  setNewsMode(false);
  if (doc.news && doc.news.tv) { if (!doc.video) doc.video = { dur: 5, trans: 'soft', turn: 1.2, loop: true, q: '1080' }; sideTab = 'video'; renderRail(); renderSide(); openVideoMaker(); return; }
  if (!window.confirm('TV 영상은 16:9 가로 화면으로 다시 배치한 «TV 화면 디자인»에서 만듭니다.\n지금 TV 화면 디자인을 새 문서로 가져올까요? (' + keepNote() + ')\n\n가져온 뒤 다듬고, 왼쪽 «영상» 메뉴에서 MP4로 저장하세요.')) return;
  await newsImport(true, true);
  if (doc.news && doc.news.tv) { doc.video = { dur: 5, trans: 'soft', turn: 1.2, loop: true, q: '1080' }; commit(); sideTab = 'video'; renderRail(); renderSide(); }
}
/* ======================= 영상 만들기 (쪽 = 장면, 요소 애니메이션, 배경 음악 → MP4) ======================= */
const VIDEO = NC.video;
const vset = () => Object.assign({}, VIDEO.DEF, doc.video || {});
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function videoPages() { return doc.pages.map((pg, i) => ({ pg, i })).filter(x => !x.pg.vOff); }
function videoTotal() { return VIDEO.timing(doc, videoPages()).total; }
// 층들을 세로로 쌓아 여러 장씩 한 번에 그린 뒤 잘라 씀 (한 장씩 그리면 매번 한글 글꼴 수십 MB를 다시 읽어 아주 느림)
// 움직이는 층은 요소 상자(crop) 크기로 잘라 두고, 글자 효과 층은 글자마다 위치를 재 둠(measure). 같은 모양의 층은 다시 그리지 않음(캐시)
const layerCache = new Map();
async function videoLayers(list, dpi, onProgress, cancelled) {
  const W = Math.round(doc.w / 25.4 * dpi), H = Math.round(doc.h / 25.4 * dpi), per = Math.max(1, Math.min(40, Math.floor(30000 / H)));
  const items = [], out = list.map(it => new Array(it.sets.length));
  list.forEach((it, pi) => it.sets.forEach((st, si) => {
    if (st.skip) { out[pi][si] = null; return; }
    const keepMarks = doc.cropMarks; doc.cropMarks = false; let html; try { html = sheetHTML({ id: 'vl', bg: it.pg.bg || '#ffffff', els: st.els }, 'thumb'); } finally { doc.cropMarks = keepMarks; }
    const key = [W, H, st.withBg ? 1 : 0, JSON.stringify(st.crop || 0), st.measure || '', html].join('|');
    const hitC = layerCache.get(key); if (hitC) { out[pi][si] = hitC; return; }
    items.push({ pg: it.pg, st, pi, si, html, key });
  }));
  if (items.length) await loadScript('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js', () => window.htmlToImage);
  for (let s0 = 0; s0 < items.length; s0 += per) {
    if (cancelled && cancelled()) return null;
    if (onProgress) onProgress(s0, items.length);
    const part = items.slice(s0, s0 + per);
    // 바깥 상자는 화면 밖에 숨기고, 그 안의 '쌓은 상자'를 그림 (바깥 상자를 그리면 숨긴 위치까지 옮겨져 빈 그림이 됨)
    const tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-99999px;top:0';
    const stack = document.createElement('div'); stack.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;background:transparent'; tmp.appendChild(stack);
    stack.innerHTML = part.map(it => it.html).join('');
    [...stack.children].forEach((n, i) => { if (!part[i].st.withBg) n.classList.add('transp'); n.style.flex = 'none'; });
    document.body.appendChild(tmp);
    try {
      await Promise.all(Array.from(stack.querySelectorAll('img')).map(im => im.complete ? null : new Promise(r => { im.onload = im.onerror = r; })));
      try { await document.fonts.ready; } catch (e) {}
      // 글자 효과용: 글자(그래핌)마다 위치 재기 (출력 화소 단위, 쪽 왼쪽 위 기준)
      const units = part.map((it, i) => { if (!it.st.measure) return null; const sh = stack.children[i], node = sh.querySelector(`[data-id="${it.st.measure}"]`); if (!node) return null; const sR = sh.getBoundingClientRect(), k = W / sR.width, seg = window.Intl && Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null, U = []; let line = -1, lastTop = -1e9;
        const tw = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); let tn; while ((tn = tw.nextNode())) { const txt = tn.nodeValue; const parts = seg ? [...seg.segment(txt)].map(g => [g.index, g.segment]) : [...txt].map((c, ix) => [ix, c]); for (const [ix, g] of parts) { const r = document.createRange(); r.setStart(tn, ix); r.setEnd(tn, ix + g.length); const rc = [...r.getClientRects()].find(q => q.height > 0); if (!rc) continue; if (Math.abs(rc.top - lastTop) > rc.height * 0.5) { line++; lastTop = rc.top; } U.push({ x: (rc.left - sR.left) * k, y: (rc.top - sR.top) * k, w: rc.width * k, h: rc.height * k, line, sp: !g.trim() }); } }
        return U; });
      const r = stack.getBoundingClientRect();
      const big = await htmlToImage.toCanvas(stack, { pixelRatio: dpi / 96, width: Math.ceil(r.width), height: Math.ceil(r.height), fontEmbedCSS: await fontCSSFor(stack), cacheBust: false, skipAutoScale: true });
      const ph = big.height / part.length;
      part.forEach((it, i) => {
        const cr = it.st.crop || { x: 0, y: 0, w: W, h: H }, c = document.createElement('canvas'); c.width = Math.max(1, cr.w); c.height = Math.max(1, cr.h);
        const sc = big.width / W; c.getContext('2d').drawImage(big, cr.x * sc, Math.round(i * ph) + cr.y * sc, cr.w * sc, cr.h * sc, 0, 0, cr.w, cr.h);
        if (units[i]) c.__units = units[i];
        out[it.pi][it.si] = c; layerCache.set(it.key, c);
      });
      big.width = big.height = 0;
    } finally { tmp.remove(); }
  }
  if (layerCache.size > 400) { let n = layerCache.size - 300; for (const k of layerCache.keys()) { if (n-- <= 0) break; layerCache.delete(k); } }
  if (onProgress) onProgress(items.length, items.length);
  return out;
}
// 보관함: 이 PC에서 고른 음악·효과음·동영상 원본 목록 (영상 메뉴 → 오디오)
let libFilt = 'all'; const libCache = new Map();
function libUsedRefs() { let js = ''; try { js = JSON.stringify({ a: doc.audio, t: doc.tracks, p: doc.pages.map(p => p.els) }); } catch (e) {} return id => js.indexOf('"m:' + id + '"') >= 0; }
async function renderMediaLib() {
  const bx = $('#vdLib'); if (!bx) return;
  let list = []; try { list = await NC.media.list(); } catch (e) { if ($('#vdLib')) $('#vdLib').innerHTML = `<p class="hint">보관함을 읽지 못했습니다: ${esc(e.message)}</p>`; return; }
  if (!$('#vdLib')) return;
  libCache.clear(); list.forEach(m => libCache.set(m.id, { id: m.id, name: m.name, size: m.size, type: m.type, lastModified: m.lastModified }));
  const used = libUsedRefs(), A = doc.audio, want = list.filter(m => libFilt === 'all' || m.kind === libFilt);
  if (!want.length) { $('#vdLib').innerHTML = `<p class="hint" style="margin:4px 0">${list.length ? '이 종류의 파일이 없습니다.' : '아직 비어 있습니다. 위의 <b>내 PC 음악·효과음·동영상</b>으로 파일을 넣으면 여기에 모여 다음에 바로 다시 쓸 수 있습니다.'}</p>`; return; }
  const mb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB', dt = t => t ? new Date(t).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : '';
  $('#vdLib').innerHTML = want.map(m => { const nm = (m.name || '').replace(/\.[^.]+$/, ''), isV = m.kind === 'video', inDoc = used(m.id);
    return `<div class="snd-it lib-it${inDoc ? ' used' : ''}">${isV ? `<button class="btn icon sm" data-libplay="${m.id}" title="미리 보기"><svg class="ic"><use href="#i-play"/></svg></button>` : `<button class="btn icon sm snd-play" data-snd="m:${m.id}" title="들어 보기"><svg class="ic"><use href="#i-play"/></svg></button>`}<span class="lib-name" title="${esc(m.name)}"><b>${esc(nm)}</b><small>${isV ? '동영상' : '소리'} · ${mb(m.size || 0)}${m.added ? ' · ' + dt(m.added) : ''}${m.copy ? '' : ' · 내 PC 원본'}${inDoc ? ' · <em>이 문서에 사용</em>' : ''}</small></span>${isV ? `<button class="btn sm" data-libvid="${m.id}">넣기</button>` : `<button class="btn sm" data-setmusic="m:${m.id}" data-name="${esc(nm)}">${A && A.src === 'm:' + m.id ? '사용 중' : '배경음악'}</button><button class="btn sm" data-addsfx="m:${m.id}" data-name="${esc(nm)}" title="타임라인 재생 위치에 효과음으로">효과음</button>`}<button class="btn icon sm lib-del" data-libdel="${m.id}" title="보관함에서 빼기">✕</button></div>`; }).join('');
}
async function removeFromLib(id) {
  const m = libCache.get(id), used = libUsedRefs()(id);
  if (!window.confirm(`"${m ? m.name : id}"을(를) 보관함에서 뺄까요?${used ? '\n\n이 문서에서 쓰고 있는 파일입니다. 빼면 다음에 열 때 원본을 다시 연결해야 합니다.' : ''}\n(PC의 원본 파일은 지워지지 않습니다)`)) return;
  try { await NC.media.remove(id); mediaMissing.add(id); vEls.clear(); tl.Vkey = ''; toast('보관함에서 뺐습니다'); renderMediaLib(); if (used) { renderCanvas(); renderTimeline(); } } catch (e) { toast('빼지 못했습니다: ' + e.message, true); }
}
async function previewVideoLib(id) {
  $('#dlgLibV') && $('#dlgLibV').remove();
  let r; try { r = await NC.media.file(id, true); } catch (e) { r = { missing: true, err: e.message }; }
  if (!r || !r.url) { if (r && r.needPerm) toast('원본을 읽을 허락이 필요합니다 — 다시 눌러 주세요', true); else toast('이 PC에 원본이 없습니다. 다시 연결하려면 영상 요소를 고르고 "원본 다시 연결"을 누르세요', true); return; }
  const m = libCache.get(id), d = document.createElement('dialog'); d.id = 'dlgLibV'; d.className = 'nw-dlg vd-dlg';
  d.innerHTML = `<div class="dhead"><h2>${esc(m ? m.name : '동영상')}</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody"><div class="vd-stage"><video src="${r.url}" controls autoplay playsinline style="max-width:100%;max-height:100%"></video></div><div class="row" style="justify-content:flex-end"><button class="btn primary" id="libVUse">이 동영상 넣기</button></div></div>`;
  document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); d.addEventListener('close', () => d.remove()); d.showModal();
  $('#libVUse').onclick = () => { d.close(); if (m) { doc.media = Object.assign(doc.media || {}, { [m.id]: m }); placeVideo(m); } };
}
// 내 PC의 음악 파일을 바로 골라 배경 음악으로 (영상 메뉴 '내 PC 음악'·타임라인 '＋ 배경 음악 넣기' 공용)
async function pickMusicLocal() {
  try {
    const [m] = await NC.media.pick('audio'); if (!m) return;
    doc.media = Object.assign(doc.media || {}, { [m.id]: m });
    doc.audio = { src: 'm:' + m.id, name: m.name.replace(/\.[^.]+$/, ''), vol: 0.8, from: 0, fin: 0, fout: 2.5 };
    commit(); sideTab = 'video'; vTab = 'audio'; renderRail(); renderSide(); renderTimeline();
    toast(`배경 음악 «${doc.audio.name}»을 넣었습니다 (원본은 이 PC에만 있음)`);
  } catch (err) { if (err.name !== 'AbortError') toast('음악을 넣지 못했습니다: ' + err.message, true); }
}
async function videoBuild(q, onProgress, cancelled) {
  const ps = videoPages(); if (!ps.length) throw new Error('영상에 넣을 쪽이 없습니다');
  const { W, H } = VIDEO.outSize(doc.w, doc.h, q || vset().q);
  await ensureLibFonts(ps.map(x => x.pg)).catch(() => {});
  const V = await VIDEO.build({ doc, pages: ps, W, H, renderLayers: videoLayers, onProgress, cancelled, videoEl: openVideoEl });
  if (V) { V.voices = await videoVoices(ps, V.total); await videoOverlays(V); }
  return V;
}
// 소리 참조 풀기: 'b:' 기본 소리 · 'm:' 내 PC 원본 · 'shared:' 공유 자료 · 'a:' 예전 방식(문서 안)
const mediaAudio = (ref, ask) => NC.media.audio(ref, ask, r => src(r), VIDEO.ctx());
// 소리 목록: 배경 음악 · 오디오 트랙 클립 · 동영상 속 소리. 기본 소리는 버퍼, 파일은 원본을 가리키기만(긴 파일은 조금씩 읽음)
async function voiceSrc(ref) {
  if (ref.startsWith('b:')) return { buf: await NC.media.render(ref.slice(2)) };
  if (ref.startsWith('a:') || ref.startsWith('asset:')) { const u = src(ref); return { blob: await (await fetch(u)).blob(), url: u }; }
  const blob = await NC.media.blobOf(ref, true), url = await NC.media.urlOf(ref, true, r => src(r)); return { blob, url };
}
async function videoVoices(ps, total) {
  const out = [], miss = [];
  const add = async (ref, o, label) => { try { out.push(Object.assign(await voiceSrc(ref), o)); } catch (e) { miss.push(label + (e.code === 'perm' ? ' (허락 필요)' : '')); } };
  const A = doc.audio; if (A && A.src && !A.mute) await add(A.src, { at: Number(A.start || 0), off: Number(A.from || 0), vol: A.vol == null ? 0.8 : A.vol, vk: A.vk, fin: Number(A.fin || 0), fout: A.fout != null ? Number(A.fout) : (A.fade === false ? 0 : 2.5), loop: true }, '배경 음악');
  for (const t of tracks()) { if (t.type !== 'audio' || t.mute) continue; for (const it of t.items || []) if (!it.dis) await add(it.ref, { at: Number(it.at || 0), off: Number(it.off || 0), len: it.dur ? Number(it.dur) : null, vol: it.vol == null ? 1 : it.vol, vk: it.vk, fin: Number(it.fin || 0), fout: Number(it.fout || 0) }, it.name || '소리'); }
  const { list } = VIDEO.timing(doc, ps);
  for (const x of list) for (const el of x.pg.els) { if (el.type !== 'video' || el.hidden || el.mute) continue; if (NC.media.isLocal(el.src) && mediaMissing.has(el.src.slice(2))) continue; const d0 = el.anim ? Number(el.anim.d || 0) : 0, tin = Number(el.tin || 0), tout = Number(el.tout || el.dur || 0); try { const v = await voiceSrc(el.src); const info = v.blob ? await NC.astream.probe(v.blob).catch(() => null) : null; if (info && info.noAudio) continue; out.push(Object.assign(v, { at: x.t0 + d0, off: tin, len: Math.max(0.05, Math.min(tout - tin, x.dur - d0)), vol: el.vol == null ? 1 : el.vol })); } catch (e) {} }
  if (miss.length) toast(`소리를 읽지 못한 것: ${miss.join(', ')} — 원본이 이 PC에 있는지 확인하세요`, true);
  out.miss = miss;  // 영상 저장 결과 줄에도 남김(알림은 곧 덮이므로)
  return out;
}
// 동영상 원본을 열어 <video>로 (이 PC에 원본이 없으면 검은 화면 + 안내)
const vEls = new Map();
async function openVideoEl(el) {
  try { const u = await NC.media.urlOf(el.src, true, r => src(r)); if (vEls.has(u)) return vEls.get(u);
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = u; v.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('동영상을 열 수 없습니다')); setTimeout(res, 8000); }); vEls.set(u, v); return v;
  } catch (e) { toast(`동영상 '${el.name || ''}': ${e.message}`, true); return null; }
}
// 동영상 속 소리: 장면 시작 시각에 사용 구간만큼 (소리 끄기면 빼기)
async function videoOverlays(V) {
  V.captions = []; V.overlays = [];
  for (const t of tracks()) { if (t.mute) continue;
    if (t.type === 'caption') (t.items || []).forEach(c => { if (!c.dis) V.captions.push(Object.assign({}, c)); });
    if (t.type === 'overlay') for (const o of t.items || []) { if (o.dis) continue; const img = new Image(); img.src = src(o.src); try { await img.decode(); } catch (e) {} V.overlays.push(Object.assign({}, o, { img })); }
  }
}
const soundName = ref => { if (!ref) return ''; if (ref.startsWith('b:')) { const s0 = NC.media.SOUNDS.find(x => x.id === ref.slice(2)); return s0 ? s0.name : '기본 소리'; } return ''; };
let sndPrev = null; // 효과음·음악 들어 보기
async function previewSound(ref, btn, from, maxS) {  // from: 몇 초부터, maxS: 최대 몇 초만 (몇 시간짜리 원본을 끝까지 틀지 않게)
  if (sndPrev) { try { sndPrev.stop(); } catch (e) {} const was = sndPrev.ref; sndPrev = null; $$('.snd-play.on').forEach(b => b.classList.remove('on')); if (was === ref) return; }
  try {
    if (ref.startsWith('b:')) { const ac = VIDEO.ctx(); ac.resume && ac.resume(); const buf = await NC.media.render(ref.slice(2)), s2 = ac.createBufferSource(); s2.buffer = buf; s2.connect(ac.destination); s2.start(); sndPrev = { stop: () => s2.stop(), ref }; s2.onended = () => { if (sndPrev && sndPrev.ref === ref) { sndPrev = null; if (btn) btn.classList.remove('on'); } }; }
    else { const el = new Audio(await NC.media.urlOf(ref, true, r => src(r))); if (from) el.currentTime = from; el.play(); let tmx = 0; if (maxS) tmx = setTimeout(() => { if (sndPrev && sndPrev.ref === ref) { el.pause(); sndPrev = null; } }, maxS * 1000); sndPrev = { stop: () => { clearTimeout(tmx); el.pause(); }, ref }; el.onended = () => { if (sndPrev && sndPrev.ref === ref) { sndPrev = null; if (btn) btn.classList.remove('on'); } }; }
    if (btn) btn.classList.add('on');
  } catch (e) { toast(e.message, true); }
}
let sharedList = null;
let vTab = 'audio';
const V_TABS = [['media', '미디어'], ['audio', '오디오'], ['text', '글자'], ['motion', '움직임'], ['trans', '넘김'], ['tpl', '템플릿'], ['set', '설정']];
// 영상 메뉴: 캡컷처럼 왼쪽에는 '영상에 넣을 거리', 아래에는 타임라인
function renderVideoSide(body) {
  const V = vset(), tot = videoTotal(), o = VIDEO.outSize(doc.w, doc.h, V.q);
  const head = `<div class="vd-top"><div class="vd-sum"><b>${videoPages().length}</b>장면 · <b>${fmtT(tot)}</b> · ${o.W}×${o.H} · ${V.fps || 30}fps</div><div class="row" style="gap:6px"><button class="btn sm" id="vdPlay"><svg class="ic"><use href="#i-play"/></svg>크게 보기</button><button class="btn sm primary" id="vdSave"><svg class="ic"><use href="#i-video"/></svg>MP4 저장</button></div></div>
  <div class="vd-tabs">${V_TABS.map(([k, t]) => `<button data-vtab="${k}" aria-pressed="${vTab === k}">${t}</button>`).join('')}</div>`;
  let h = '';
  const selT = selEls().filter(e => e.type === 'text'), selAny = selEls();
  if (vTab === 'media') {
    h = `<button class="btn primary full" id="vdVideo"><svg class="ic"><use href="#i-video"/></svg>내 PC 동영상 넣기</button>
    <p class="hint">동영상 원본은 <b>이 PC에만</b> 두고 문서에는 이름만 저장합니다(구글 드라이브에 원본이 올라가지 않음). 다른 PC에서는 동영상을 고른 뒤 '원본 다시 연결'.</p>
    <h3>공유 자료 영상 <small class="vd-sm">드라이브 '디자인자료/영상자료/영상'</small></h3><div id="vdSharedV"><button class="btn sm" id="vdSharedVid">공유 영상 보기</button></div>
    <h3>사진</h3><p class="hint">사진은 왼쪽 <b>사진·업로드</b> 메뉴에서 넣고, 고른 뒤 오른쪽 애니메이션 → <b>천천히</b>(켄 번즈)로 움직이게 하세요.</p>`;
  } else if (vTab === 'audio') {
    const A = doc.audio, aName = A ? (A.name || soundName(A.src) || '음악') : '';
    const sfx = NC.media.SOUNDS.filter(x => x.cat === 'sfx'), mus = NC.media.SOUNDS.filter(x => x.cat === 'music');
    h = `<h3>배경 음악</h3>
    ${A ? `<div class="vd-music"><button class="btn icon sm snd-play" data-snd="${esc(A.src)}" title="들어 보기"><svg class="ic"><use href="#i-play"/></svg></button><b>${esc(aName)}</b><small>${NC.media.isLocal(A.src) ? '내 PC 원본' : A.src.startsWith('shared:') ? '공유 자료' : A.src.startsWith('b:') ? '기본 음악' : '문서 안'}</small><button class="btn sm" id="vdMusicDel">빼기</button></div>
    <div class="grid2"><label class="f"><span>소리 크기 <small id="vdVolV">${Math.round((A.vol == null ? 0.8 : A.vol) * 100)}%</small></span><input type="range" id="vdVol" min="0" max="2" step="0.05" value="${A.vol == null ? 0.8 : A.vol}"></label><label class="f"><span>곡의 몇 초부터</span><input type="number" id="vdFrom" min="0" step="0.5" value="${A.from || 0}"></label></div>
    <div class="grid2"><label class="f"><span>서서히 크게 (초)</span><input type="number" id="vdFin" min="0" max="10" step="0.5" value="${A.fin || 0}"></label><label class="f"><span>끝에서 서서히 작게 (초)</span><input type="number" id="vdFout" min="0" max="10" step="0.5" value="${A.fout != null ? A.fout : (A.fade === false ? 0 : 2.5)}"></label></div>` : '<p class="hint">보관함이나 기본 음악에서 골라 <b>배경음악</b>을 누르세요. 타임라인 음악 줄을 끌면 시작 위치가 바뀝니다.</p>'}
    <h3>보관함 <small class="vd-sm">이 PC에서 쓴 음악·효과음·동영상</small></h3>
    <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" id="vdMusicLocal"><svg class="ic"><use href="#i-music"/></svg>내 PC 음악</button><button class="btn sm" id="vdSfxLocal">내 PC 효과음</button><button class="btn sm" id="vdLibVideo"><svg class="ic"><use href="#i-video"/></svg>내 PC 동영상</button><button class="btn sm" id="vdShared">공유 자료</button></div><div id="vdSharedBox"></div>
    <div class="lib-filt">${[['all', '전체'], ['audio', '소리'], ['video', '동영상']].map(([v, t]) => `<button class="btn sm ${libFilt === v ? 'on' : ''}" data-libf="${v}">${t}</button>`).join('')}</div>
    <div id="vdLib" class="snd-list"><p class="hint">보관함을 읽는 중…</p></div>
    <details class="fx"><summary>기본 배경 음악 <small>${mus.length}곡 · 프로그램이 만든 소리</small></summary>
    <div class="snd-list">${mus.map(m => `<div class="snd-it"><button class="btn icon sm snd-play" data-snd="b:${m.id}" title="들어 보기"><svg class="ic"><use href="#i-play"/></svg></button><span>${esc(m.name)}</span><button class="btn sm" data-setmusic="b:${m.id}" data-name="${esc(m.name)}">${A && A.src === 'b:' + m.id ? '사용 중' : '쓰기'}</button></div>`).join('')}</div></details>
    <details class="fx"><summary>기본 효과음 <small>${sfx.length}개 · ＋ 누르면 재생 위치에</small></summary>
    <div class="sfx-grid">${sfx.map(x => `<div class="sfx-it"><button class="snd-play" data-snd="b:${x.id}" title="들어 보기"><svg class="ic"><use href="#i-play"/></svg></button><span>${esc(x.name)}</span><button class="sfx-add" data-addsfx="b:${x.id}" data-name="${esc(x.name)}" title="타임라인 재생 위치에 넣기">＋</button></div>`).join('')}</div></details>
    <p class="hint">보관함의 원본은 <b>이 PC에만</b> 있고 문서에는 이름만 저장됩니다(드라이브에 올라가지 않음). 기본 음악·효과음은 프로그램이 직접 만든 소리라 저작권 걱정이 없습니다.</p>`;
  } else if (vTab === 'text') {
    const presets = [['type', '타자기', '한 글자씩 쳐지듯'], ['char', '한 글자씩', '톡톡 떠오르기'], ['word', '단어씩', '말하듯 끊어서'], ['line', '한 줄씩', '줄마다 떠오르기'], ['pop', '톡 튀어나오기', '제목 강조'], ['blur', '흐릿하게', '부드럽게 또렷'], ['spin', '돌며 나타나기', '경쾌하게'], ['bounce', '통통 튀며', '아이들 느낌']];
    h = `<p class="hint">${selT.length ? `고른 글자 ${selT.length}개에 적용합니다.` : '글자를 고르면 그 글자에 적용하고, 고른 글자가 없으면 그 효과가 들어간 <b>새 제목</b>을 넣습니다.'}</p>
    <div class="vfx-grid">${presets.map(([v, t, d]) => `<button data-tfx="${v}"><i class="am am-${['type', 'char', 'word', 'line'].includes(v) ? 'wipe' : v}"></i><b>${t}</b><small>${d}</small></button>`).join('')}</div>
    <h3>계속 움직이기</h3><div class="vfx-grid">${VIDEO.LOOPS.slice(1).map(([v, t]) => `<button data-tloop="${v}"><i class="am am-zoom"></i><b>${t}</b></button>`).join('')}</div>`;
  } else if (vTab === 'motion') {
    h = `<p class="hint">${selAny.length ? `고른 요소 ${selAny.length}개에 적용합니다.` : '요소를 고른 뒤 누르세요. 아래 단추는 모든 쪽에 한꺼번에 적용합니다.'} 자세한 조정은 오른쪽 <b>애니메이션</b> 칸에서 합니다.</p>
    <h3>나타나기</h3><div class="vfx-grid">${VIDEO.ANIMS.slice(1).map(([v, t]) => `<button data-mfx="anim:${v}"><i class="am am-${v}"></i><b>${t}</b></button>`).join('')}</div>
    <h3>사라지기</h3><div class="vfx-grid">${VIDEO.OUTS.slice(1).map(([v, t]) => `<button data-mfx="animOut:${v}"><i class="am am-${v}"></i><b>${t}</b></button>`).join('')}</div>
    <h3>한꺼번에</h3><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" id="vdAutoAnim"><svg class="ic"><use href="#i-anim"/></svg>차례로 나타나기 (모든 쪽)</button><button class="btn sm" id="vdCamAll">카메라 천천히 (모든 쪽)</button><button class="btn sm" id="vdClrAnim">움직임 모두 빼기</button></div>`;
  } else if (vTab === 'trans') {
    const pg = page();
    h = `<p class="hint"><b>${cur + 1}쪽 → 다음 장면</b>으로 넘어가는 효과입니다. 타임라인의 ◆를 눌러도 바꿀 수 있어요.</p>
    <div class="vfx-grid">${VIDEO.TRANS.map(([v, t]) => `<button data-trx="${v}" class="${(pg.vtrans || V.trans) === v ? 'on' : ''}"><i class="tx tx-${v}"></i><b>${t}</b></button>`).join('')}</div>
    <label class="f"><span>넘김 길이 <small id="vdTurnV">${Number(pg.vturn || V.turn)}초</small></span><input type="range" id="vdPgTurn" min="0.2" max="2" step="0.1" value="${Number(pg.vturn || V.turn)}"></label>
    <button class="btn sm" id="vdTrAll">모든 장면에 같은 넘김</button>`;
  } else if (vTab === 'tpl') {
    h = videoTplHTML();
  } else {
    h = `<div class="grid2"><label class="f"><span>기본 장면 길이</span><select id="vdDur">${[2, 3, 4, 5, 6, 7, 8, 10].map(v => `<option value="${v}" ${Number(V.dur) === v ? 'selected' : ''}>${v}초</option>`).join('')}</select></label><label class="f"><span>기본 넘김 효과</span><select id="vdTrans">${VIDEO.TRANS.map(([v, t]) => `<option value="${v}" ${V.trans === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
    <div class="grid2"><label class="f"><span>기본 넘김 길이</span><select id="vdTurn">${[[0.3, '아주 빠르게 0.3초'], [0.5, '빠르게 0.5초'], [0.8, '보통 0.8초'], [1, '1초'], [1.2, '천천히 1.2초']].map(([v, t]) => `<option value="${v}" ${Number(V.turn) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>화질</span><select id="vdQ"><option value="1080" ${V.q !== '720' && V.q !== '2160' ? 'selected' : ''}>1080p (기본)</option><option value="720" ${V.q === '720' ? 'selected' : ''}>720p (가볍게)</option><option value="2160" ${V.q === '2160' ? 'selected' : ''}>4K (큰 TV)</option></select></label></div>
    <div class="grid2"><label class="f"><span>초당 장면 수</span><select id="vdFps"><option value="30" ${Number(V.fps || 30) === 30 ? 'selected' : ''}>30fps (기본)</option><option value="60" ${Number(V.fps) === 60 ? 'selected' : ''}>60fps (부드럽게)</option><option value="24" ${Number(V.fps) === 24 ? 'selected' : ''}>24fps (영화 느낌)</option></select></label><label class="vd-chk" style="align-self:end"><input type="checkbox" id="vdLoop" ${V.loop ? 'checked' : ''}> 끝나면 첫 장면으로 <small>(TV 반복)</small></label></div>
    <button class="btn sm" id="vdDurAll">장면 길이·넘김 모두 기본으로</button>
    <h3>장면 목록</h3><div class="vd-scenes">${doc.pages.map((pg, i) => `<label class="vd-scl${pg.vOff ? ' off' : ''}"><input type="checkbox" data-vin="${i}" ${pg.vOff ? '' : 'checked'}> ${i + 1}${pg.label ? ' · ' + esc(pg.label) : ''} <small>${Number(pg.vdur || V.dur).toFixed(1)}초</small></label>`).join('')}</div><p class="hint">체크를 풀면 그 쪽은 영상에서 빠집니다. 길이·순서는 아래 타임라인에서 끌어서 바꿉니다.</p>`;
  }
  body.innerHTML = head + `<div class="vd-pane">${h}</div>`;
  if (vTab === 'audio') renderMediaLib();
  if (vTab === 'tpl') requestAnimationFrame(() => fitBoxes(body, '.vt-th', 150));
  const setV = (k, v) => { doc.video = Object.assign(vset(), { [k]: v }); commit(); renderSide(); renderTimeline(); };
  const applyTo = (els, k, v) => { const defs = { anim: { d: 0, s: 0.8 }, animOut: { s: 0.6, at: 0 }, animLoop: { T: 1.2, a: 1 } }; els.forEach(el => { el[k] = Object.assign({}, defs[k], el[k] || {}, { t: v }); if (k === 'anim' && VIDEO.TEXT_ANIMS.some(x => x[0] === v) && el.type === 'text' && (!el.anim.s || el.anim.s < 1.2)) el.anim.s = Math.max(1.2, Math.min(4, (el.text || '').length * 0.06)); }); commit(); renderAll(); };
  body.onclick = async e => {
    const t = e.target;
    const vt = t.closest('[data-vtab]'); if (vt) { vTab = vt.dataset.vtab; renderSide(); return; }
    const sp = t.closest('[data-snd]'); if (sp) { previewSound(sp.dataset.snd, sp); return; }
    const lf = t.closest('[data-libf]'); if (lf) { libFilt = lf.dataset.libf; renderSide(); return; }
    const lv = t.closest('[data-libvid]'); if (lv) { const m = libCache.get(lv.dataset.libvid); if (m) { doc.media = Object.assign(doc.media || {}, { [m.id]: m }); placeVideo(m); } return; }
    const lp = t.closest('[data-libplay]'); if (lp) { previewVideoLib(lp.dataset.libplay); return; }
    const ld = t.closest('[data-libdel]'); if (ld) { removeFromLib(ld.dataset.libdel); return; }
    const mref = t.closest('[data-setmusic],[data-addsfx]'); if (mref) { const ref = mref.dataset.setmusic || mref.dataset.addsfx; if (ref && ref.startsWith('m:') && libCache.has(ref.slice(2))) doc.media = Object.assign(doc.media || {}, { [ref.slice(2)]: libCache.get(ref.slice(2)) }); }
    const sm = t.closest('[data-setmusic]'); if (sm) { doc.audio = Object.assign({ vol: 0.8, from: 0, fin: 0, fout: 2.5 }, doc.audio && doc.audio.src === sm.dataset.setmusic ? doc.audio : {}, { src: sm.dataset.setmusic, name: sm.dataset.name }); delete doc.audio.fade; commit(); renderSide(); renderTimeline(); toast(`배경 음악: ${sm.dataset.name}`); return; }
    const as = t.closest('[data-addsfx]'); if (as) { addSfx(as.dataset.addsfx, as.dataset.name); return; }
    const tf = t.closest('[data-tfx]'); if (tf) { const v = tf.dataset.tfx; if (selT.length) { applyTo(selT, 'anim', v); toast('글자 효과를 넣었습니다'); } else { const el = addText('h', { text: '제목을 입력하세요', noEdit: true }); el.anim = { t: v, d: 0.2, s: 1.4 }; commit(); renderAll(); } return; }
    const tlp = t.closest('[data-tloop]'); if (tlp) { const els = selAny.length ? selAny : []; if (!els.length) { toast('먼저 요소를 고르세요', true); return; } applyTo(els, 'animLoop', tlp.dataset.tloop); return; }
    const mf = t.closest('[data-mfx]'); if (mf) { if (!selAny.length) { toast('먼저 요소를 고르세요 (또는 아래 «차례로 나타나기»)', true); return; } const [k, v] = mf.dataset.mfx.split(':'); applyTo(selAny, k, v); return; }
    const tx = t.closest('[data-trx]'); if (tx) { page().vtrans = tx.dataset.trx; commit(); renderSide(); renderTimeline(); const { list } = tlScenes(), x = list.find(q => q.i === cur); if (x && x.turn && tlOn()) { tl.T = x.t0 + Math.max(0, x.dur - 0.3); tlPlay(); setTimeout(() => { if (tl.playing) tlPause(); }, (x.turn + 1.0) * 1000); } return; }
    const vtp = t.closest('[data-vtpl]'); if (vtp) { applyVideoTpl(vtp.dataset.vtpl); return; }
    const vts = t.closest('[data-vts]'); if (vts) { vtSize = vts.dataset.vts; renderSide(); return; }
    const vrs = t.closest('[data-vresp]'); if (vrs) { applyRespToVideo(vrs.dataset.vresp); return; }
    const id = (t.closest('button') || {}).id;
    if (id === 'vdPlay') openVideoPlayer(); else if (id === 'vdSave') openVideoMaker();
    else if (id === 'vdAutoAnim') { let n = 0; doc.pages.forEach(pg => { pg.els.forEach(el => { delete el.anim; }); n += VIDEO.autoAnimate(pg, doc.w, doc.h); }); commit(); renderAll(); toastUndo(`글자·사진·묶음 ${n}개에 '차례로 나타나기'를 넣었습니다`); }
    else if (id === 'vdCamAll') { doc.pages.forEach(pg => { if (!pg.vcam) pg.vcam = 'in'; }); commit(); renderAll(); toastUndo('모든 장면에 천천히 다가가는 카메라를 넣었습니다'); }
    else if (id === 'vdClrAnim') { doc.pages.forEach(pg => { delete pg.vcam; pg.els.forEach(el => { delete el.anim; delete el.animOut; delete el.animLoop; delete el.kb; }); }); commit(); renderAll(); toastUndo('모든 움직임을 뺐습니다'); }
    else if (id === 'vdTrAll') { const pg = page(); doc.pages.forEach(p2 => { p2.vtrans = pg.vtrans || V.trans; p2.vturn = pg.vturn; }); commit(); renderTimeline(); toastUndo('모든 장면에 같은 넘김 효과를 넣었습니다'); }
    else if (id === 'vdDurAll') { doc.pages.forEach(pg => { delete pg.vdur; delete pg.vtrans; delete pg.vturn; }); commit(); renderSide(); renderTimeline(); }
    else if (id === 'vdMusicDel') { delete doc.audio; commit(); renderSide(); renderTimeline(); }
    else if (id === 'vdMusicLocal') pickMusicLocal();
    else if (id === 'vdSfxLocal') { try { const list = await NC.media.pick('audio'); list.forEach(m => { doc.media = Object.assign(doc.media || {}, { [m.id]: m }); addSfx('m:' + m.id, m.name.replace(/\.[^.]+$/, ''), true); }); commit(); renderTimeline(); } catch (err) { if (err.name !== 'AbortError') toast(err.message, true); } }
    else if (id === 'vdShared' || id === 'vdSharedVid') { const bx = $(id === 'vdShared' ? '#vdSharedBox' : '#vdSharedV'); bx.innerHTML = '<p class="hint">공유 자료를 읽는 중…</p>'; try { sharedList = await NC.media.listShared(); } catch (err) { sharedList = []; } const want = id === 'vdShared' ? sharedList.filter(x => x.cat !== 'video') : sharedList.filter(x => x.cat === 'video'); bx.innerHTML = want.length ? `<div class="snd-list">${want.map(x => `<div class="snd-it">${x.cat !== 'video' ? `<button class="btn icon sm snd-play" data-snd="${esc(x.ref)}"><svg class="ic"><use href="#i-play"/></svg></button>` : ''}<span>${esc(x.name)} <small>${x.sub}</small></span>${x.cat === 'music' ? `<button class="btn sm" data-setmusic="${esc(x.ref)}" data-name="${esc(x.name)}">쓰기</button>` : x.cat === 'sfx' ? `<button class="btn sm" data-addsfx="${esc(x.ref)}" data-name="${esc(x.name)}">＋</button>` : `<button class="btn sm" data-addsv="${esc(x.ref)}" data-name="${esc(x.name)}">넣기</button>`}</div>`).join('')}</div>` : `<p class="hint">동기화 폴더의 <b>디자인자료/영상자료/${id === 'vdShared' ? '음악·효과음' : '영상'}</b> 폴더에 파일을 넣으면 여기에 보입니다.${await store.folderReady() ? '' : ' (동기화 폴더가 연결되어 있지 않습니다)'}</p>`; }
    else if (id === 'vdVideo' || id === 'vdLibVideo') addVideoEl();
    const sv = t.closest('[data-addsv]'); if (sv) addVideoRef(sv.dataset.addsv, sv.dataset.name);
  };
  body.onchange = async e => {
    const t = e.target;
    if (t.dataset.vin != null) { doc.pages[Number(t.dataset.vin)].vOff = !t.checked || undefined; commit(); renderSide(); renderTimeline(); return; }
    if (t.id === 'vdDur') setV('dur', Number(t.value)); else if (t.id === 'vdTrans') setV('trans', t.value); else if (t.id === 'vdTurn') setV('turn', Number(t.value)); else if (t.id === 'vdQ') setV('q', t.value); else if (t.id === 'vdFps') setV('fps', Number(t.value)); else if (t.id === 'vdLoop') setV('loop', t.checked);
    else if (['vdFrom', 'vdFin', 'vdFout'].includes(t.id)) { doc.audio[{ vdFrom: 'from', vdFin: 'fin', vdFout: 'fout' }[t.id]] = Math.max(0, Number(t.value) || 0); delete doc.audio.fade; commit(); renderTimeline(); }
    else if (t.id === 'vdVol' || t.id === 'vdPgTurn') { commit(); renderTimeline(); }
  };
  body.oninput = e => { if (e.target.id === 'vdVol') { const A = doc.audio, nv = Number(e.target.value), ov = A.vol == null ? 0.8 : Number(A.vol); if (A.vk && A.vk.length && ov > 0) A.vk = A.vk.map(k => [k[0], Math.round(k[1] * nv / ov * 1000) / 1000]); A.vol = nv; $('#vdVolV').textContent = Math.round(nv * 100) + '%'; }  /* 음량 점이 있으면 점 전체를 같은 비율로 */ if (e.target.id === 'vdPgTurn') { page().vturn = Number(e.target.value); $('#vdTurnV').textContent = page().vturn + '초'; } };
}
async function addVideoRef(ref, name) {
  try { const u = await NC.media.urlOf(ref, true), info = await videoInfo(u); const k = Math.min(doc.w * 0.8 / info.w, doc.h * 0.8 / info.h); addEl({ type: 'video', src: ref, poster: info.poster ? addAsset(info.poster) : '', name, w: Math.round(info.w * k * 10) / 10, h: Math.round(info.h * k * 10) / 10, x: 0, y: 0, rot: 0, opacity: 1, fit: 'cover', radius: 0, tin: 0, tout: Math.round(info.dur * 10) / 10, dur: info.dur, vol: 1, mute: false }); renderAll(); }
  catch (e) { toast('영상을 넣지 못했습니다: ' + e.message, true); }
}
async function addVideoEl() {
  try { const list = await NC.media.pick('video'); for (const m of list) await placeVideo(m); }
  catch (e) { if (e.name !== 'AbortError') toast('동영상을 넣지 못했습니다: ' + e.message, true); }
}
// 동영상 하나를 지금 쪽에 넣음 (원본은 이 PC에만, 문서에는 이름·크기와 작은 첫 장면만)
async function placeVideo(m, at) {
  doc.media = Object.assign(doc.media || {}, { [m.id]: m }); mediaMissing.delete(m.id);
  const u = (await NC.media.file(m.id, true)).url, info = await videoInfo(u);
  const k = Math.min(doc.w / info.w, doc.h / info.h), w = Math.round(info.w * k * 10) / 10, h = Math.round(info.h * k * 10) / 10;
  const el = addEl({ type: 'video', src: 'm:' + m.id, poster: info.poster ? addAsset(info.poster) : '', name: m.name.replace(/\.[^.]+$/, ''), w, h, x: 0, y: 0, rot: 0, opacity: 1, fit: 'cover', radius: 0, tin: 0, tout: Math.round(info.dur * 100) / 100, dur: info.dur, vol: 1, mute: false });
  const len = Math.round(info.dur * 10) / 10, pg = page();
  if (info.dur > 0 && Math.abs(Number(pg.vdur || vset().dur) - len) > 0.2) { pg.vdur = len; commit(); }
  if (tlOn()) { tl.fit = true; renderTimeline(); } else if (sideTab !== 'video') { sideTab = 'video'; renderRail(); renderSide(); tlShow(true); }
  toast(`동영상 '${m.name}' (${fmtT(info.dur)})을 넣었습니다 — 장면 길이를 영상에 맞췄습니다. ✂(Ctrl+B)로 잘라 필요 없는 부분을 지우세요. 원본은 이 PC에만 있습니다.`);
  return el;
}
// 소리 파일을 오디오 트랙 클립으로
async function placeAudio(m) {
  doc.media = Object.assign(doc.media || {}, { [m.id]: m }); mediaMissing.delete(m.id);
  const TR = tracks(); let t = TR.find(x => x.id === tl.selTr && x.type === 'audio') || TR.find(x => x.type === 'audio'); if (!t) { t = { id: uid(), type: 'audio', name: '오디오 2', items: [] }; TR.push(t); }
  let dur = 0; try { const f = await NC.media.blobOf('m:' + m.id, true); dur = (await NC.astream.probe(f)).dur || 0; if (!dur) { const el = new Audio(); el.src = (await NC.media.file(m.id, true)).url; dur = await new Promise(r => { el.onloadedmetadata = () => r(el.duration || 0); el.onerror = () => r(0); }); } } catch (e) {}
  t.items.push({ id: uid(), ref: 'm:' + m.id, name: m.name.replace(/\.[^.]+$/, ''), at: Math.round((tl.T || 0) * 10) / 10, vol: 1, dur: dur ? Math.round(dur * 100) / 100 : undefined, full: dur || undefined }); commit(); if (tlOn()) { tl.fit = true; renderTimeline(); } else { sideTab = 'video'; renderRail(); renderSide(); tlShow(true); }
  toast(`'${m.name}' (${fmtTC(dur || 0).slice(0, 8)})을 ${t.name} 트랙에 넣었습니다 — 원본은 이 PC에만 있고, 필요한 부분만 읽습니다. ✂(Ctrl+B)로 자르세요.`);
}
// 동영상 크기·길이·첫 장면(편집 화면·썸네일용 작은 그림)
function videoInfo(url) { return new Promise((res, rej) => { const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url; v.onerror = () => rej(new Error('이 동영상 형식은 브라우저에서 열 수 없습니다 (MP4·H.264로 바꿔 넣어 주세요)')); v.onloadedmetadata = () => { v.currentTime = Math.min(0.5, v.duration / 3 || 0); }; v.onseeked = () => { const W = v.videoWidth, H = v.videoHeight, k = Math.min(1, 640 / Math.max(W, H)), c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); let poster = ''; try { c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); poster = c.toDataURL('image/jpeg', 0.8); } catch (e) {} res({ w: W, h: H, dur: v.duration || 0, poster }); }; }); }

/* ---- 영상 편집은 '영상용 사본'에서 (원본 디자인 보호) ---- */
function videoNeedsGate() { return doc.pages.some(p => p.els && p.els.length) && !(doc.video && (doc.video.isCopy || doc.video.born)) && !(doc.news && doc.news.tv); }
function videoGate(then) { if (!videoNeedsGate()) { if (then) then(); return true; } openVideoGate(then); return false; }
function openVideoGate(then) {
  let d = $('#dlgVgate');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlgVgate'; d.innerHTML = `<div class="dhead"><h2>영상 편집은 영상용 사본에서</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="vgBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  $('#vgBody').innerHTML = `<p>타임라인에서 장면을 <b>지우거나 자르면 이 디자인의 쪽이 함께 바뀝니다.</b> 인쇄·이미지용 원본 디자인은 그대로 두고, <b>영상용 사본</b>을 따로 저장해 편집하는 것이 안전합니다.</p>
  <ul class="hint" style="margin:6px 0 12px 18px;line-height:1.7"><li>사본 이름은 <b>"${esc(doc.name || '디자인')} 영상"</b>이 되고, 저장 위치를 고른 뒤 그 파일에서 작업합니다.</li><li>원본은 마지막으로 저장된 상태로 남고 언제든 다시 열 수 있습니다.</li><li>원본을 고친 뒤 사본에도 반영하려면 사본에서 "원본 장면 다시 가져오기"(영상 패널 위)를 누릅니다.</li></ul>
  <div class="row" style="justify-content:flex-end"><button class="btn" id="vgCancel">취소</button><button class="btn" id="vgDirect" title="권장하지 않음">이 디자인에서 바로 편집</button><button class="btn primary" id="vgCopy">영상용 사본 만들기 (권장)</button></div>`;
  $('#vgCancel').onclick = () => d.close();
  $('#vgDirect').onclick = () => { if (!window.confirm('원본 디자인이 영상 편집으로 바뀔 수 있습니다. 그래도 이 문서에서 바로 편집할까요?')) return; doc.video = Object.assign(vset(), { born: 'design' }); commit(); d.close(); if (then) then(); else { sideTab = 'video'; renderRail(); renderSide(); } };
  $('#vgCopy').onclick = async () => { d.close(); await makeVideoCopy(then); };
  d.showModal();
}
async function makeVideoCopy(then) {
  const g = $('#dlgVgate'); if (g && g.open) g.close();
  try { await keepCurrentDoc(); } catch (e) {}
  gcAssets();
  const srcName = doc.name || '디자인', srcId = doc.docId || '';
  const nd = clone(doc); nd.docId = ''; delete nd.saveId; delete nd.lineage; delete nd.savedAt; nd.name = srcName + ' 영상';
  nd.video = Object.assign(vset(), { isCopy: true, born: 'copy', fromName: srcName, fromId: srcId, fromPages: clone(doc.pages) });
  try { await store.disconnect(); } catch (e) {}
  doc = nd; hist = []; histMeta = []; hptr = -1; cur = 0; sel = []; $('#pname').value = doc.name; commit(); updateSaveBadge();
  sideTab = 'video'; renderRail(); renderSide();
  if (await store.folderReady()) { try { await saveNow(); } catch (e) {} }
  else { setStatus('영상용 사본을 만들었습니다 · 저장(Ctrl+S)을 눌러 저장 위치를 고르세요 (그 전까지는 이 브라우저에 임시 저장)'); toast(`영상용 사본 "${doc.name}"을 만들었습니다. 원본은 그대로 남습니다. 저장(Ctrl+S)으로 위치를 골라 두세요.`); }
  if (then) then(); else tlShow(true);
}
// 사본에서: 원본 디자인의 쪽을 다시 가져오기(장면 내용만 바꾸고 소리·자막 트랙은 유지)
async function reimportFromSource() {
  const v = doc.video || {}; if (!v.isCopy) return;
  let pages = null;
  try { if (v.fromId && await store.folderReady()) { const h = await store.findDocById(v.fromId); if (h) { const f = await h.getFile(); pages = JSON.parse(await f.text()).pages; } } } catch (e) {}
  if (!pages) { const j = await store.pickLocal(); if (!j || !j.pages) return; pages = j.pages; }
  if (!window.confirm(`원본의 ${pages.length}쪽을 이 사본의 장면으로 다시 가져옵니다. 지금 장면의 내용은 원본 내용으로 바뀝니다 (소리·자막 트랙은 유지). 계속할까요?`)) return;
  const old = doc.pages; doc.pages = clone(pages).map((pg, i) => { const o = old[i]; if (o) { ['vdur', 'vtrans', 'vturn', 'anim', 'vcam', 'vkb'].forEach(k => { if (o[k] != null && pg[k] == null) pg[k] = o[k]; }); } return pg; });
  commit(); goto(0); toast('원본 장면을 다시 가져왔습니다');
}
/* ---- 영상 템플릿 ---- */
let vtSize = '169';
// 템플릿 장면을 문서 형식으로: id·묶음 이름 정리, 글자 기본값 채우기
function vtplPages(pages) {
  return pages.map(p => { const gm = {}; const els = p.els.map(e0 => { const e = Object.assign(e0.type === 'text' ? Object.assign({}, TEXT_DEF) : {}, clone(e0)); e.id = uid(); if (e.group) { gm[e.group] = gm[e.group] || uid(); e.group = gm[e.group]; } if (e.type === 'image' && e.src === '') { e.name = e.name || '사진 자리'; } return e; }); return Object.assign({}, newPage(p.bg), p, { id: uid(), els }); });
}
const vtCache = new Map();
function vtThumb(id) { const k = id + '|' + vtSize; if (vtCache.has(k)) return vtCache.get(k); const r = NC.vtpl.make(id, vtSize), pg = vtplPages([r.pages[Math.min(1, r.pages.length - 1)]])[0]; pg.els.forEach(e => { delete e.anim; }); const h = tmpSheet(r.w, r.h, pg.els, pg.bg); vtCache.set(k, h); return h; }
function videoTplHTML() {
  if (!window.NC.vtpl) return '<p class="hint">영상 템플릿을 불러오지 못했습니다</p>';
  const S = NC.vtpl.SIZES, list = NC.vtpl.LIST.filter(t => !t.sizes || t.sizes.includes(vtSize));
  const resp = (NC.tpl.list || []).filter(t => t.responsive);
  return `<div class="seg vt-size">${Object.entries(S).map(([k, v]) => `<button data-vts="${k}" aria-pressed="${vtSize === k}">${v.name}</button>`).join('')}</div>
  <p class="hint">${S[vtSize].px} · 누르면 새 영상 문서로 열립니다. 글·사진 자리는 모두 바꿔 쓰세요.</p>
  <div class="vt-grid">${list.map(t => `<button class="vt-card" data-vtpl="${t.id}" title="${esc(t.desc)}"><div class="tbox vt-th" data-w="${S[vtSize].w}" data-h="${S[vtSize].h}">${vtThumb(t.id)}</div><b>${esc(t.name)}</b><small>${esc(t.desc)} · ${Math.round(NC.vtpl.total(t.id, vtSize))}초</small></button>`).join('')}</div>
  <h3>디자인 템플릿으로 영상 만들기 <small class="vd-sm">${resp.length}개</small></h3>
  <p class="hint">크기에 맞춰 바뀌는 디자인 템플릿(명절 휴관 카드·SNS 등)을 이 크기로 만들고, 글자·사진이 차례로 나타나는 움직임과 음악을 넣어 영상으로 엽니다.</p>
  <div class="vt-rlist">${resp.slice(0, 80).map(t => `<button data-vresp="${t.id}">${esc(t.name)}</button>`).join('')}</div>`;
}
async function openVideoDoc(r, name) {
  if (doc.pages.some(p => p.els.length) && !window.confirm(`"${name}" 영상 템플릿을 새 문서로 엽니다. 지금 문서를 닫을까요? (${keepNote()})`)) return false;
  await keepCurrentDoc();
  await store.disconnect();
  const nd = newDoc(); nd.w = r.w; nd.h = r.h; nd.fmt = r.fmt || ''; nd.name = name; nd.pages = r.pages; nd.video = r.video; nd.calendar = doc.calendar; nd.holidays = doc.holidays; nd.rules = doc.rules;
  if (r.audio) nd.audio = r.audio; if (r.sfx && r.sfx.length) nd.sfx = r.sfx.map(x => Object.assign({ id: uid() }, x));
  doc = nd; hist = []; histMeta = []; hptr = -1; cur = 0; sel = []; $('#pname').value = doc.name; commit(); clearTimeout(fileTimer);
  setStatus('아직 저장 위치를 고르지 않았습니다 · 저장(Ctrl+S)을 누르면 위치를 고릅니다 (그 전까지는 이 브라우저에 임시 저장)');
  zoom = 0; sideTab = 'video'; renderRail(); renderAll(); fitCanvas(); updateSaveBadge(); if (!tlOn()) tlShow(true); else { tl.fit = true; renderTimeline(); }
  tl.T = 0; tlPlay(); return true;
}
async function applyVideoTpl(id) {
  const r = NC.vtpl.make(id, vtSize); if (!r) return; r.pages = vtplPages(r.pages);
  if (await openVideoDoc(r, `${r.name} (${NC.vtpl.SIZES[vtSize].name})`)) { doc.video = Object.assign(vset(), doc.video || {}, { born: 'video' }); markDirty(); toast(`'${r.name}' 영상 템플릿을 열었습니다 — 아래 타임라인에서 재생해 보세요`); }
}
async function applyRespToVideo(id) {
  const t = (NC.tpl.list || []).find(x => x.id === id); if (!t) return; const S = NC.vtpl.SIZES[vtSize];
  const pages = brandize(t.build(uid, { w: S.w, h: S.h, screen: true }), S.w, S.h, t);
  pages.forEach(pg => { VIDEO.autoAnimate(pg, S.w, S.h); pg.vcam = 'in'; });
  const r = { w: S.w, h: S.h, fmt: vtSize === '916' ? 'story' : vtSize === '45' ? 'ig45' : '', pages, video: { dur: 4.5, trans: 'soft', turn: 0.8, q: '1080', fps: 30, loop: false }, audio: { src: 'b:m-bright', name: '밝은 아침 (경쾌)', vol: 0.7, from: 0, fin: 0.5, fout: 2 } };
  if (await openVideoDoc(r, `${t.name} 영상`)) { doc.video = Object.assign(vset(), doc.video || {}, { born: 'video' }); markDirty(); toast(`'${t.name}'을(를) 영상으로 만들었습니다`); }
}
function addSfx(ref, name, quiet) {
  const TR = tracks(); let t = TR.find(x => x.id === tl.selTr && x.type === 'audio') || TR.find(x => x.type === 'audio'); if (!t) { t = { id: uid(), type: 'audio', name: '효과음', items: [] }; TR.push(t); }
  const at = Math.max(0, Math.round((tl.T || 0) * 10) / 10);
  t.items.push({ id: uid(), ref, name, at, vol: 1 }); if (!quiet) { commit(); renderTimeline(); toast(`'${name}'을(를) ${t.name} 트랙 ${fmtT(at)}에 넣었습니다 — 타임라인에서 끌어 옮기세요`); }
}

// 영상 편집 단축키 (프리미어·캡컷·필모라와 같은 키). 타임라인이 열려 있을 때만, 글자 입력 중에는 동작하지 않음
const TL_KEYS = [['Space', '재생 / 멈춤'], ['K', '멈춤'], ['L', '재생'], ['J', '1초 뒤로'], ['← →', '한 프레임 뒤로 / 앞으로'], ['Shift + ← →', '1초 뒤로 / 앞으로'], ['↑ ↓', '앞 장면 / 다음 장면으로'], ['Home / End', '처음 / 끝으로'],
  ['Ctrl + B', '재생 헤드에서 자르기 (Ctrl + K도 됨)'], ['Shift + Ctrl + B', '모두 자르기: 재생 헤드를 지나는 장면·자막·소리를 한 번에'], ['Q', '장면 앞부분을 재생 헤드까지 잘라내기'], ['W', '장면 뒷부분을 재생 헤드부터 잘라내기'], [';  /  \'', '앞 · 다음 편집점으로 (장면 경계와 클립 시작·끝)'], ['Alt + [  /  Alt + ]', '재생 헤드 앞 · 뒤 잘라내기 (Q · W와 같음, 파이널컷 방식)'], ['Delete', '고른 클립 지우기 · 장면을 고르면 리플 삭제(뒤 장면이 당겨지고, 그 장면에 붙은 자막·소리도 함께)'], ['Shift + Delete', '장면을 빈 틈으로 바꾸기 (길이·뒤 위치는 그대로)'], ['N', '스냅 켜기 / 끄기 (끌 때 장면 경계·재생 헤드·클립 끝·마커에 붙기)'], ['M', '마커 넣기 (재생 중에도 · 두 번 눌러 이름 바꾸기·지우기)'], ['Ctrl + ;  /  Ctrl + \'', '앞 · 다음 마커로'], ['V', '고른 클립 끄기 / 켜기 (지우지 않고 미리보기·저장에서 빼기)'], ['Ctrl + Z', '되돌리기'], ['Ctrl + Shift + Z', '다시'],
  ['T', '재생 위치에 글자 넣기'], ['C', '재생 위치에 자막 넣기'], ['R', '음성 녹음 시작 / 멈춤'], ['Ctrl + =  /  Ctrl + −', '타임라인 늘리기 / 줄이기'], ['Shift + Z', '타임라인 전체 보기'], ['F', '크게 미리보기'], ['Ctrl + E', '내보내기 (MP4)'], ['Esc', '미리보기 닫고 편집으로'], ['?', '단축키 목록']];
document.addEventListener('keydown', e => {
  if (!tlOn() || editing || $('#cellEd') || e.isComposing || e.keyCode === 229 || document.querySelector('dialog[open]') || (e.target.matches && e.target.matches('input,textarea,select,[contenteditable="true"]'))) return;
  if (cellSel && !(e.ctrlKey || e.metaKey)) return;  // 달력 칸을 고른 채 바로 쓰는 글자(한글 ㄱ=R 등)를 영상 단축키로 가로채지 않음
  if (sideTab !== 'video' && !(e.target.closest && e.target.closest('#vtl')) && !(e.ctrlKey || e.metaKey) && (/^Key[TCRQWJKLFNMV]$/.test(e.code) || ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code))) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key, c = e.code, fps = Number(vset().fps || 30), stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  const prevVisible = $('#vprev') && !$('#vprev').hidden, noSel = !sel.length || prevVisible;
  if (c === 'Space' && !mod) { stop(); if (!e.repeat) tl.playing ? tlPause() : tlPlay(); return; }
  if (mod && !e.altKey && (c === 'KeyB' || c === 'KeyK')) { stop(); if (e.shiftKey) tlBladeAll(); else tlSplit(); return; }
  if (mod && (c === 'Semicolon' || c === 'Quote')) { stop(); const ts = (doc.markers || []).map(m => Number(m.t)).sort((a, b) => a - b), to = c === 'Semicolon' ? ts.filter(v => v < tl.T - 0.01).pop() : ts.find(v => v > tl.T + 0.01); if (to != null) { tlPause(); tlSeek(to); } else toast(c === 'Semicolon' ? '앞쪽에 마커가 없습니다' : '뒤쪽에 마커가 없습니다'); return; }
  if (mod && c === 'KeyE') { stop(); tlPause(); openVideoMaker(); return; }
  if (mod && (k === '=' || k === '+' || c === 'Equal')) { stop(); tl.pxs = Math.min(400, tl.pxs * 1.25); renderTimeline(); return; }
  if (mod && (k === '-' || c === 'Minus')) { stop(); tl.pxs = Math.max(3, tl.pxs / 1.25); renderTimeline(); return; }
  if (e.altKey && !mod && (c === 'BracketLeft' || c === 'BracketRight')) { stop(); tlTrim(c === 'BracketLeft' ? 'head' : 'tail'); return; }  /* 파이널컷 Option+[ / ] = 앞·뒤 잘라내기 (Q·W와 같음) */
  if (mod || e.altKey) return;
  if (k === 'Escape' && prevVisible) { stop(); tlPause(); tlHidePrev(); return; }
  if (k === '?' || (e.shiftKey && c === 'Slash')) { stop(); tlKeysHelp(); return; }
  if (e.shiftKey && c === 'KeyZ') { stop(); tl.fit = true; renderTimeline(); return; }
  if ((k === 'Delete' || k === 'Backspace') && e.shiftKey && tl.selScene && noSel) { stop(); tlDeleteScene(true); return; }  /* Shift+Delete = 빈 틈으로 */
  if (e.shiftKey) { if ((k === 'ArrowLeft' || k === 'ArrowRight') && noSel) { stop(); tlSeek(tl.T + (k === 'ArrowLeft' ? -1 : 1)); } return; }
  if ((k === 'ArrowLeft' || k === 'ArrowRight') && noSel) { stop(); tlPause(); tlSeek(tl.T + (k === 'ArrowLeft' ? -1 : 1) / fps); return; }
  if ((c === 'Semicolon' || c === 'Quote') && noSel) { stop(); const { list, total } = tlScenes(), pts = [0, total]; list.forEach(q => pts.push(q.t0, q.t0 + q.dur)); tracks().forEach(t => (t.items || []).forEach(it => { const d = t.type === 'audio' ? itemDur(it) : Number(it.dur || 3); pts.push(Number(it.at || 0), Number(it.at || 0) + d); })); const u = [...new Set(pts.map(v => Math.round(v * 1000) / 1000))].sort((a, b) => a - b); const to = c === 'Semicolon' ? u.filter(v => v < tl.T - 0.01).pop() : u.find(v => v > tl.T + 0.01); if (to != null) { tlPause(); tlSeek(to); } return; }  /* 파이널컷 ; ' = 앞·다음 편집점(장면 경계와 클립 끝) */
  if ((k === 'ArrowUp' || k === 'ArrowDown') && noSel) { stop(); const { list, total } = tlScenes(), eps = 0.01; let to; if (k === 'ArrowUp') { const p = list.filter(x => x.t0 < tl.T - eps).pop(); to = p ? p.t0 : 0; } else { const n = list.find(x => x.t0 > tl.T + eps); to = n ? n.t0 : total; } tlPause(); tlSeek(to); const x = list.find(q => to >= q.t0 && to < q.t0 + q.dur + q.turn); if (x && x.i !== cur) goto(x.i); return; }
  if (k === 'Home') { stop(); tlPause(); tlSeek(0); return; }
  if (k === 'End') { stop(); tlPause(); tlSeek(tlScenes().total); return; }
  if ((k === 'Delete' || k === 'Backspace') && (tl.selIt || tl.selAu)) { stop(); $('#tlDel').click(); return; }
  if ((k === 'Delete' || k === 'Backspace') && tl.selScene && noSel) { stop(); tlDeleteScene(e.shiftKey); return; }  /* 파이널컷: Delete = 리플 삭제, Shift+Delete = 빈 틈으로 */
  if (c === 'KeyK') { stop(); tlPause(); return; }
  if (c === 'KeyL') { stop(); if (!tl.playing) tlPlay(); return; }
  if (c === 'KeyJ') { stop(); const was = tl.playing; tlPause(); tlSeek(tl.T - 1, !was); if (was) tlPlay(); return; }
  if (c === 'KeyQ' || c === 'KeyW') { stop(); tlTrim(c === 'KeyQ' ? 'head' : 'tail'); return; }
  if (c === 'KeyN') { stop(); tlToggleSnap(); return; }
  if (c === 'KeyM') { stop(); tlAddMarker(); return; }
  if (c === 'KeyV') { stop(); tlToggleClip(); return; }
  if (c === 'KeyT') { stop(); $('#tlText').click(); return; }
  if (c === 'KeyC') { stop(); tlAddCaption(); return; }
  if (c === 'KeyR') { stop(); tlRecord(); return; }
  if (c === 'KeyF') { stop(); tlPause(); openVideoPlayer(true); return; }
}, true);
// 타임라인 도구 말풍선: 이름 + 단축키(키 모양). 바로 뜸
(function () {
  let tip = null, cur0 = null;
  const show = n => {
    const t = n.dataset.tip; if (!t) return; if (!tip) { tip = document.createElement('div'); tip.className = 'tltip'; document.body.appendChild(tip); }
    const m = t.match(/^(.*?)\s*\(([^()]*(?:Ctrl|Shift|Space|Home|End|Delete|Esc|[A-Z?←→↑↓=−+])[^()]*)\)\s*$/);
    const keys = m ? m[2].split(/\s*,\s*/).map(g => g.split('+').map(x => `<kbd>${esc(x.trim())}</kbd>`).join('<i>+</i>')).join('<i>,</i>') : '';
    tip.innerHTML = `<span>${esc(m ? m[1] : t)}</span>${keys ? `<em>${keys}</em>` : ''}`; tip.hidden = false;
    const r = n.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const below = r.top - h - 10 < 0; tip.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + 'px'; tip.style.top = (below ? r.bottom + 8 : r.top - h - 8) + 'px'; tip.classList.toggle('below', below);
  };
  document.addEventListener('mouseover', e => {
    const n = e.target.closest && e.target.closest('#vtl [title], #vtl [data-tip], .tr-pop [title], .tl-menu [title]'); if (n === cur0) return; cur0 = n;
    if (!n) { if (tip) tip.hidden = true; return; }
    if (n.hasAttribute('title')) { n.dataset.tip = n.getAttribute('title'); n.removeAttribute('title'); }
    show(n);
  });
  document.addEventListener('pointerdown', () => { if (tip) tip.hidden = true; cur0 = null; }, true);
})();
// Q·W: 재생 헤드가 있는 장면의 앞(시작~헤드) 또는 뒤(헤드~끝)를 잘라냄. 뒤 장면은 당겨짐(리플)
// 리플: 장면 길이가 바뀌면 그 뒤의 자막·효과음·오디오·오버레이·배경 음악 시작도 함께 밀고 당김 (편집기 표준)
function tlRippleSnap(cut) { const its = []; tracks().forEach(tr => (tr.items || []).forEach(it => { if (Number(it.at || 0) >= cut - 1e-6) its.push([it, Number(it.at || 0)]); })); const A = doc.audio && Number(doc.audio.start || 0) > 0 && Number(doc.audio.start || 0) >= cut - 1e-6 ? Number(doc.audio.start) : null; return d => { its.forEach(([it, a]) => { it.at = Math.max(0, Math.round((a + d) * 100) / 100); }); if (A != null) doc.audio.start = Math.max(0, Math.round((A + d) * 100) / 100); }; }
// 스냅(파이널컷 N): 끌 때 장면 경계·재생 헤드·다른 클립 시작·끝·마커에 붙음(화면 8px 안), 붙은 자리에 노란 세로선. 안 붙으면 프레임 단위로
let tlSnapOn = (() => { try { return localStorage.getItem('naracal-snap') !== '0'; } catch (e) { return true; } })();
function tlSnapPts(skipId, skipScene) { const { list, total } = tlScenes(), p = [0, total, tl.T]; list.forEach(q => { if (q.i !== skipScene) p.push(q.t0, q.t0 + q.dur); }); tracks().forEach(t => (t.items || []).forEach(it => { if (it.id === skipId) return; const d = t.type === 'audio' ? itemDur(it) : Number(it.dur || 3); p.push(Number(it.at || 0), Number(it.at || 0) + d); })); (doc.markers || []).forEach(m => p.push(Number(m.t))); return p; }
function tlSnapTo(t, pts) { if (!tlSnapOn) return null; let best = null, bd = 8 / tl.pxs; pts.forEach(v => { const d = Math.abs(v - t); if (d < bd) { bd = d; best = v; } }); return best; }
const tlFrame = t => { const f = Number(vset().fps || 30); return Math.round(t * f) / f; };
function tlToggleSnap() { tlSnapOn = !tlSnapOn; try { localStorage.setItem('naracal-snap', tlSnapOn ? '1' : '0'); } catch (e) {} const b = $('#tlSnapBtn'); if (b) b.classList.toggle('on', tlSnapOn); toast(tlSnapOn ? '스냅 켬 — 끌 때 장면 경계·재생 헤드·클립 끝에 붙습니다' : '스냅 끔'); }
// 마커(파이널컷 M): 재생 헤드 자리에 표시(재생 중에도 박자에 맞춰), 스냅 대상, Ctrl+; / Ctrl+' 로 이동
function tlAddMarker() { const T = Math.round(tl.T * 1000) / 1000; doc.markers = doc.markers || []; const near = doc.markers.find(m => Math.abs(Number(m.t) - T) < 0.05); if (near) { tlMarkerEdit(near); return; } doc.markers.push({ id: uid(), t: T, name: '' }); doc.markers.sort((a, b) => a.t - b.t); commit(); renderTimeline(); toast(`마커를 넣었습니다 (${fmtTC(T).slice(3)}) — 두 번 눌러 이름 바꾸기·지우기`); }
function tlMarkerEdit(m) { const v = window.prompt('마커 이름 (비우고 확인하면 마커를 지웁니다)', m.name || ''); if (v == null) return; if (!v.trim()) { doc.markers = (doc.markers || []).filter(q => q !== m); toast('마커를 지웠습니다'); } else m.name = v.trim().slice(0, 40); commit(); renderTimeline(); }
function tlToggleClip() { for (const t of tracks()) { const it = (t.items || []).find(q => q.id === tl.selIt); if (it) { it.dis = !it.dis || undefined; commit(); renderTimeline(); toast(it.dis ? `'${it.name || it.text || '클립'}'을 껐습니다 — 미리보기·저장에서 빠짐 (V로 다시 켜기)` : '클립을 다시 켰습니다'); return; } } toast('켜고 끌 클립(자막·소리·오버레이)을 먼저 고르세요', true); }
function tlRipple(cut, d) { if (d) tlRippleSnap(cut)(d); }
// 연결된 클립(파이널컷 방식): 자막·소리·오버레이는 놓인 장면(주 줄거리 클립)에 붙어 있음 → 장면을 옮기거나 지우면 함께 따라감(지운 장면에 붙은 클립은 함께 지움)
function tlConnSnap() {
  const { list } = tlScenes(), recs = []; if (!list.length) return () => 0;
  const sceneAt = t => list.find(q => t >= q.t0 - 1e-6 && t < q.t0 + q.dur + q.turn - 1e-6) || list[list.length - 1];
  tracks().forEach(tr => (tr.items || []).forEach(it => { const sc = sceneAt(Number(it.at || 0)); recs.push({ tr, it, id: sc.pg.id, off: Number(it.at || 0) - sc.t0 }); }));
  let A = null; if (doc.audio && Number(doc.audio.start || 0) > 0) { const sc = sceneAt(Number(doc.audio.start)); A = { id: sc.pg.id, off: Number(doc.audio.start) - sc.t0 }; }
  return (opt = {}) => { const byId = new Map(tlScenes().list.map(q => [q.pg.id, q])); let gone = 0;
    recs.forEach(r => { const q = byId.get(r.id); if (!q) { if (opt.dropOrphans) { r.tr.items = r.tr.items.filter(x => x !== r.it); gone++; } return; } r.it.at = Math.max(0, Math.round((q.t0 + r.off) * 100) / 100); });
    if (A) { const q = byId.get(A.id); if (q) doc.audio.start = Math.max(0, Math.round((q.t0 + A.off) * 100) / 100); }
    return gone; };
}
// 장면 지우기: Delete = 리플 삭제(뒤 장면이 당겨지고 붙은 클립도 함께), Shift+Delete = 틈으로 바꾸기(길이는 그대로, 내용만 비움)
function tlDeleteScene(gap) {
  if (videoNeedsGate()) { openVideoGate(); return; }
  if (gap) { const pg = doc.pages[cur]; pg.els = []; pg.bg = '#000000'; pg.label = '빈 틈'; commit(); renderAll(); toastUndo(`${cur + 1}번 장면을 빈 틈으로 바꿨습니다 — 길이와 뒤 장면 위치는 그대로입니다`); return; }
  if (doc.pages.length < 2) { toast('장면이 하나뿐이라 지울 수 없습니다 — Shift+Delete로 빈 틈으로 바꿀 수 있습니다', true); return; }
  const snap = tlConnSnap(); doc.pages.splice(cur, 1); const gone = snap({ dropOrphans: true }); commit(); goto(Math.min(cur, doc.pages.length - 1));
  toastUndo(`장면을 지우고 뒤 장면을 당겼습니다${gone ? ` (붙어 있던 클립 ${gone}개도 함께 지움)` : ''}`);
}
// 모두 자르기(Shift+Ctrl+B): 재생 헤드를 지나는 장면과 모든 트랙 클립을 한 번에
function splitItem(t, it, q) {
  if (videoNeedsGate()) { openVideoGate(); return null; }
  const d = t.type === 'audio' ? itemDur(it) : Number(it.dur || 3), it2 = Object.assign(clone(it), { id: uid(), at: Math.round((it.at + q) * 100) / 100, dur: Math.round((d - q) * 100) / 100 });
  if (t.type === 'audio') { it2.off = Math.round((Number(it.off || 0) + q) * 100) / 100; if (it.vk && it.vk.length) { const vq = Math.round(VIDEO.vkAt(it.vk, q) * 1000) / 1000; it2.vk = [[0, vq]].concat(it.vk.filter(k => k[0] > q).map(k => [Math.round((k[0] - q) * 100) / 100, k[1]])); it.vk = it.vk.filter(k => k[0] < q).concat([[q, vq]]); } }
  it.dur = q; t.items.splice(t.items.indexOf(it) + 1, 0, it2); return it2;
}
function tlBladeAll() {
  if (videoNeedsGate()) { openVideoGate(); return; }
  let n = 0; const T = tl.T; tracks().forEach(t => (t.items || []).slice().forEach(it => { const d = t.type === 'audio' ? itemDur(it) : Number(it.dur || 3), q = Math.round((T - it.at) * 100) / 100; if (q > 0.05 && q < d - 0.05) { splitItem(t, it, q); n++; } }));
  const sel0 = tl.selIt; tl.selIt = null; const pages0 = doc.pages.length; tlSplitScene(true);
  if (doc.pages.length === pages0) { if (n) { commit(); renderTimeline(); } }
  tl.selIt = sel0; toastUndo(`재생 헤드에서 모두 잘랐습니다 (${doc.pages.length > pages0 ? '장면 1개 · ' : ''}클립 ${n}개)`);
}
function tlTrim(which) {
  if (videoNeedsGate()) { openVideoGate(); return; }
  const { list } = tlScenes(), x = list.find(s2 => tl.T >= s2.t0 && tl.T < s2.t0 + s2.dur); if (!x) { toast('장면 안에 재생 헤드를 두세요', true); return; }
  const q = Math.round((tl.T - x.t0) * 10) / 10, pg = x.pg;
  if (which === 'tail' ? q < 0.3 : x.dur - q < 0.3) { toast('남는 길이가 너무 짧습니다', true); return; }  // 검사를 먼저: 실패하면 동영상 구간도 그대로
  pg.els.forEach(e => { if (e.type !== 'video') return; const d0 = e.anim ? Number(e.anim.d || 0) : 0, used = Math.max(0, q - d0), tin = Number(e.tin || 0), tout = Number(e.tout || e.dur || 0); if (which === 'tail') e.tout = Math.round(Math.min(tout, tin + used) * 100) / 100; else if (used) e.tin = Math.round(Math.min(tout - 0.1, tin + used) * 100) / 100; });
  if (which === 'tail') { tlRipple(x.t0 + x.dur, q - x.dur); pg.vdur = q; }
  else { const rest = Math.round((x.dur - q) * 10) / 10; tlRipple(x.t0 + q, -q); pg.vdur = rest; pg.els.forEach(el => { if (el.anim) { const d = Number(el.anim.d || 0) - q; if (d + Number(el.anim.s || 0.8) <= 0) delete el.anim; else el.anim.d = Math.max(0, Math.round(d * 10) / 10); } }); tl.T = x.t0; }
  commit(); renderTimeline(); tlTimeLabel(); toastUndo(which === 'tail' ? `${x.i + 1}쪽 뒷부분을 잘라냈습니다 (${q}초 남음)` : `${x.i + 1}쪽 앞부분 ${q}초를 잘라냈습니다`);
}
function tlAddCaption() {
  const TR = tracks(); let t = TR.find(x => x.id === tl.selTr && x.type === 'caption') || TR.find(x => x.type === 'caption'); if (!t) { t = { id: uid(), type: 'caption', name: '자막 1', items: [] }; TR.push(t); }
  const it = { id: uid(), text: '자막을 입력하세요', at: Math.round(tl.T * 10) / 10, dur: 2.5, style: 'outline', pos: 'bottom', size: 0.065 }; t.items.push(it); commit(); renderTimeline(); openItemPop(t, it);
}
// 단축키 목록 (? 키 또는 ⌨ 단추)
function tlKeysHelp() {
  let d = $('#dlgKeys'); if (d) { d.close(); return; }
  d = document.createElement('dialog'); d.id = 'dlgKeys'; d.className = 'nw-dlg sm keys-dlg';
  d.innerHTML = `<div class="dhead"><h2>영상 편집 단축키</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody"><p class="hint" style="margin-top:0">일반 영상 편집 프로그램(프리미어·캡컷·필모라)과 같은 키입니다. 타임라인이 열려 있을 때 동작하며, 맥에서는 Ctrl 대신 ⌘(Command)도 됩니다. 요소를 고른 상태에서는 화살표가 요소를 움직입니다.</p><table class="keys">${TL_KEYS.map(([a, b]) => `<tr><td>${a.split(/(\s\/\s|\s\+\s)/).map(x => /^\s[\/+]\s$/.test(x) ? `<i>${x.trim()}</i>` : `<kbd>${esc(x.trim())}</kbd>`).join('')}</td><td>${esc(b)}</td></tr>`).join('')}</table></div>`;
  document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); d.addEventListener('close', () => d.remove()); d.showModal();
}
/* ======================= 타임라인 (캡컷식: 장면·움직임·음악·효과음 트랙 + 재생 헤드) ======================= */
const tl = { T: 0, pxs: 0, playing: false, V: null, Vkey: '', building: null, raf: 0, snd: null, t0: 0, open: null };
const tlOn = () => !!tl.open;
const fmtTC = (t, fps) => { fps = Math.round(fps || Number(vset().fps || 30)); const F = Math.floor(Math.max(0, t) * fps + 1e-6), f = F % fps, s = Math.floor(F / fps), S = s % 60, M = Math.floor(s / 60) % 60, H = Math.floor(s / 3600), p2 = n => String(n).padStart(2, '0'); return `${p2(H)}:${p2(M)}:${p2(S)}:${p2(f)}`; };
const TLI = { undo: '<path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>', redo: '<path d="m15 7 5 5-5 5M20 12H9a5 5 0 0 0 0 10h2"/>', del: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', cut: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5 20 18M8.5 15.5 20 6"/>', text: '<path d="M5 6h14M12 6v13"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', first: '<path d="M6 5v14M19 5 9 12l10 7z"/>', prevf: '<path d="M15 5 8 12l7 7"/>', nextf: '<path d="m9 5 7 7-7 7"/>', play: '<path d="M7 5v14l11-7z"/>', pause: '<path d="M8 5v14M16 5v14"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', vol: '<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6"/>', mute: '<path d="M4 9v6h4l5 4V5L8 9zM16 9l5 6M21 9l-5 6"/>', film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>', note: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>', fx: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>' };
const tli = (k, sz) => `<svg class="ic" viewBox="0 0 24 24" style="${sz ? `width:${sz}px;height:${sz}px` : ''}">${TLI[k]}</svg>`;
const TL_VIEWS = [['wide', '넓은 타임라인 (기본)', '화면 아래 왼쪽 끝~오른쪽 끝, 위 창들은 위로'], ['stage', '작업 영역 아래', '가운데 작업 영역 안에만'], ['focus', '영상 집중', '넓은 타임라인 + 양쪽 패널 접기'], ['tall', '큰 타임라인', '넓고 높게 (트랙이 많을 때)']];
let tlView = (() => { try { return localStorage.getItem('naracal-tlview') || 'wide'; } catch (e) { return 'wide'; } })();
// 타임라인은 영상 메뉴에서만(기본): 템플릿·요소 등 다른 메뉴로 가면 평소 공방 화면, 영상 메뉴로 돌아오면 다시 — 보기 방식에서 끄고 켬
let tlOnlyVideo = (() => { try { return localStorage.getItem('naracal-tlonly') !== '0'; } catch (e) { return true; } })();
function applyTlView() {
  const v = tl.open ? tlView : 'stage', wide = v !== 'stage', b = document.body, el = $('#vtl');
  b.classList.toggle('tl-wide', wide); b.classList.toggle('tl-focus', v === 'focus'); b.classList.toggle('tl-tall', v === 'tall');
  if (el) { const home = wide ? document.body : $('#stage'); if (el.parentElement !== home) home.appendChild(el); }
  try { const hgt = Number(localStorage.getItem('naracal-tlh-' + (v === 'tall' ? 'tall' : 'wide'))); document.body.style.setProperty('--tlh', (hgt >= 180 ? hgt : (v === 'tall' ? 440 : 300)) + 'px'); } catch (e) {}
  requestAnimationFrame(() => { fitCanvas(); renderTimeline(); });
}
function tlShow(on) {
  if (on && !tl.open && videoNeedsGate()) { openVideoGate(() => tlShow(true)); return; }
  tl.open = !!on; $('#stage').classList.toggle('tlon', tl.open);
  if (!$('#vtl')) {
    const d = document.createElement('div'); d.id = 'vtl'; d.className = 'vtl'; d.tabIndex = -1;
    d.innerHTML = `<div class="vtl-bar">
      <button class="tb" id="tlUndo" title="되돌리기 (Ctrl+Z)">${tli('undo')}</button><button class="tb" id="tlRedo" title="다시 (Ctrl+Shift+Z)">${tli('redo')}</button><button class="tb" id="tlDel" title="고른 클립 지우기 (Delete)">${tli('del')}</button><button class="tb" id="tlSplit" title="재생 헤드에서 자르기 (Ctrl+B)">${tli('cut')}</button><button class="tb" id="tlText" title="재생 위치에 글자 넣기 (T)">${tli('text')}</button><button class="tb" id="tlRec" title="음성 녹음 (R)">${tli('mic')}</button>
      <span class="tsep"></span>
      <button class="tb" id="tlFirst" title="처음으로 (Home)">${tli('first')}</button><button class="tb" id="tlPrevF" title="한 프레임 뒤로 (←)">${tli('prevf')}</button><button class="tb tplay" id="tlPlay" title="재생 / 멈춤 (Space)">${tli('play', 20)}</button><button class="tb" id="tlNextF" title="한 프레임 앞으로 (→)">${tli('nextf')}</button><button class="tb" id="tlStop" title="정지 (K)">${tli('stop')}</button>
      <span class="tl-time" id="tlTime">00:00:00:00</span><span class="tl-tot" id="tlTot">/ 00:00:00:00</span><span class="tl-msg" id="tlMsg"></span>
      <span class="grow"></span>
      <button class="tb${tlSnapOn ? ' on' : ''}" id="tlSnapBtn" title="스냅 — 장면 경계·재생 헤드·클립 끝에 붙기 (N)"><svg class="ic" viewBox="0 0 24 24"><path d="M6 3v8a6 6 0 0 0 12 0V3M6 3h4v8a2 2 0 0 0 4 0V3h4M6 7h4M14 7h4"/></svg></button>
      <button class="tb" id="tlZo" title="타임라인 줄이기 (Ctrl+−)">−</button><input type="range" id="tlZoom" min="0" max="100" value="40" title="타임라인 확대"><button class="tb" id="tlZi" title="타임라인 늘리기 (Ctrl+=)">+</button><button class="tb" id="tlZf" title="전체 보기 (Shift+Z)"><svg class="ic"><use href="#i-fit"/></svg></button>
      <button class="tb" id="tlKeys" title="단축키 목록 (?)"><svg class="ic" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg></button><span class="tsep"></span><button class="btn sm tview" id="tlView" title="창 배치 바꾸기"><svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h18M9 4v10"/></svg>보기 방식</button><button class="tb" id="tlBig" title="크게 미리보기 (F)">${tli('full')}</button><button class="btn sm primary" id="tlSave" title="내보내기 (Ctrl+E)"><svg class="ic"><use href="#i-video"/></svg>내보내기</button><button class="tb" id="tlClose" title="타임라인 닫기">✕</button></div>
      <div class="vtl-body"><div class="tl-heads" id="tlHeads"></div>
        <div class="tl-scroll" id="tlScroll"><div class="tl-inner" id="tlInner"></div></div>
        <div class="tl-meter"><div class="mt"><i id="mtL"></i></div><div class="mt"><i id="mtR"></i></div><span>L</span><span>R</span></div></div>`;
    $('#stage').appendChild(d); tlWire();
    const gr = document.createElement('div'); gr.className = 'tl-grip'; gr.title = '끌어서 타임라인 높이 조절'; d.prepend(gr);
    gr.addEventListener('pointerdown', e => { if (!document.body.classList.contains('tl-wide')) return; e.preventDefault(); const y0 = e.clientY, h0 = d.offsetHeight; gr.setPointerCapture(e.pointerId);
      const mv = ev => { const h = Math.max(180, Math.min(Math.max(220, innerHeight - 380), h0 - (ev.clientY - y0))); document.body.style.setProperty('--tlh', h + 'px'); fitCanvas(); };
      const up = () => { gr.removeEventListener('pointermove', mv); gr.removeEventListener('pointerup', up); try { localStorage.setItem('naracal-tlh-' + (tlView === 'tall' ? 'tall' : 'wide'), parseInt(getComputedStyle(document.body).getPropertyValue('--tlh'))); } catch (err) {} renderTimeline(); };
      gr.addEventListener('pointermove', mv); gr.addEventListener('pointerup', up); });
    const pc = document.createElement('canvas'); pc.id = 'vprev'; pc.className = 'vprev'; pc.hidden = true; $('#canvasWrap').appendChild(pc);
  }
  if (!tl.open) { tlPause(); tlHidePrev(); }
  if ($('#pnTl')) $('#pnTl').classList.toggle('on', tl.open);
  renderTimeline(); applyTlView();
}
function tlScenes() { return VIDEO.timing(doc, videoPages()); }
// 트랙: 오디오(효과음·녹음·음악 클립) · 자막 · 오버레이(로고·사진). 예전 문서의 효과음 줄은 첫 오디오 트랙으로 옮김
function tracks() {
  if (!doc.tracks) { doc.tracks = []; if (doc.sfx && doc.sfx.length) doc.tracks.push({ id: uid(), type: 'audio', name: '효과음', items: doc.sfx }); else doc.tracks.push({ id: uid(), type: 'audio', name: '효과음', items: [] }); delete doc.sfx; }
  return doc.tracks;
}
const TR_LABEL = { audio: '오디오', caption: '자막', overlay: '오버레이' };
const itemDur = it => { const s0 = NC.media.SOUNDS.find(q => 'b:' + q.id === it.ref); return Number(it.dur || (s0 ? s0.dur : 1)); };
function renderTimeline() {
  if (!tl.open || !$('#tlInner')) return;
  const TR = tracks(), { list, total } = tlScenes(), sc = $('#tlScroll'), avail = Math.max(300, sc.clientWidth - 30), fps = Number(vset().fps || 30);
  if (!tl.pxs || tl.fit) { tl.pxs = Math.max(6, Math.min(240, avail / Math.max(1, total))); tl.fit = false; }
  const px = tl.pxs, Wd = Math.max(avail, total * px + 160);
  const zr = $('#tlZoom'); if (zr) zr.value = Math.round(Math.log(px / 3) / Math.log(400 / 3) * 100);
  const steps = [1 / fps * 5, 0.5, 1, 2, 5, 10, 15, 30, 60], stepS = steps.find(v => v * px >= 90) || 60, minor = stepS / 5; let ruler = '';
  for (let t = 0; t <= total + stepS; t += minor) { const major = Math.abs(t / stepS - Math.round(t / stepS)) < 1e-6; ruler += `<i class="${major ? 'mj' : ''}" style="left:${t * px}px">${major ? `<span>${fmtTC(t, fps)}</span>` : ''}</i>`; }
  (doc.markers || []).forEach(m => { ruler += `<b class="tl-mk" data-mk="${esc(m.id)}" style="left:${Number(m.t) * px}px" title="${esc(m.name || '마커')} · ${fmtTC(Number(m.t), fps)} — 눌러서 이동, 두 번 눌러 이름 바꾸기·지우기"></b>`; });
  const strips = tl.strips || {};
  const scenes = list.map((x, k) => { const w = Math.max(6, (x.dur + x.turn) * px - 2), fs = strips[x.pg.id]; const film = fs && fs.length ? fs.map(u => `<img src="${u}" alt="">`).join('') : `<div class="tl-th tbox" data-w="${doc.w}" data-h="${doc.h}">${sheetHTML(x.pg, 'thumb')}</div>`; return `<div class="tl-clip${x.i === cur ? ' on' : ''}" data-ci="${x.i}" data-k="${k}" style="left:${x.t0 * px}px;width:${w}px"><div class="tl-film">${film}</div><span class="tl-cl">${tli('film', 11)} ${x.i + 1}${x.pg.label ? ' · ' + esc(x.pg.label) : ''} <b>${fmtTC(x.dur, fps).slice(3)}</b></span>${x.turn ? `<button class="tl-tr" data-tr="${x.i}" style="left:${x.dur * px - 10}px;width:${Math.max(20, x.turn * px)}px" title="넘김: ${esc((VIDEO.TRANS.find(t => t[0] === x.trans) || [0, ''])[1])} ${x.turn}초 — 눌러서 바꾸기">⇄</button>` : (k < list.length - 1 ? `<button class="tl-tr none" data-tr="${x.i}" style="left:${x.dur * px - 10}px" title="넘김 효과 넣기">＋</button>` : '')}<div class="tl-lh" data-lh="${x.i}" title="끌어서 장면 길이 (앞)"></div><div class="tl-rh" data-rh="${x.i}" title="끌어서 장면 길이"></div></div>`; }).join('');
  let anims = '';
  list.forEach(x => { let lane = 0; x.pg.els.forEach(el => { if (el.hidden || !VIDEO.moves(el) || el.type === 'video') return; const a = el.anim, o = el.animOut, l = el.animLoop, d = a ? Number(a.d || 0) : 0, s2 = a ? Number(a.s || 0.8) : 0, so = o ? Number(o.s || 0.6) : 0, at = o ? Number(o.at || 0) : 0; const L = lane++ % 3, y = 4 + L * 15, x0 = (x.t0 + d) * px, endT = x.t0 + x.dur - at, w = Math.max(6, (endT - x.t0 - d) * px); anims += `<div class="tl-an${sel.includes(el.id) ? ' on' : ''}" data-ael="${el.id}" data-ap="${x.i}" style="left:${x0}px;top:${y}px;width:${w}px" title="${esc(elName(el))} — 끌면 시작 시각, 오른쪽 끝을 끌면 나타나는 시간"><i class="in" style="width:${Math.min(w, s2 * px)}px"></i>${l ? '<i class="lp"></i>' : ''}${o ? `<i class="out" style="width:${Math.min(w, so * px)}px"></i>` : ''}<span>${esc(elName(el))}</span>${a ? '<em class="tl-ah" data-ah="1"></em>' : ''}</div>`; }); });
  let audio = '<button class="tl-add" id="tlAddMusic">＋ 배경 음악 넣기</button>';
  if (doc.audio) { const A = doc.audio, st = Number(A.start || 0), fin = Number(A.fin || 0), fout = A.fout != null ? Number(A.fout) : (A.fade === false ? 0 : 2.5); audio = `<div class="tl-au${tl.selAu ? ' sel' : ''}${A.mute ? ' muted' : ''}" id="tlAu" style="left:${st * px}px;width:${Math.max(10, (total - st) * px)}px" title="끌어서 시작 위치 옮기기"><canvas id="tlWave"></canvas><span>${tli('note', 11)} ${esc(A.name || soundName(A.src) || '음악')}</span>${vkHTML(A, total - st, px, 0.8)}${fin ? `<i class="fi" style="width:${fin * px}px"></i>` : ''}${fout ? `<i class="fo" style="width:${fout * px}px"></i>` : ''}${fadeHTML(fin, fout, px)}</div>`; }
  // 행 순서: 오버레이·자막 트랙(위) → 비디오 1 → 효과 → 오디오 1(배경 음악) → 오디오 트랙들
  const upper = TR.filter(t => t.type !== 'audio'), lower = TR.filter(t => t.type === 'audio');
  const rowOf = t => { const items = (t.items || []).map(it => { const d = t.type === 'audio' ? itemDur(it) : Number(it.dur || 3), cls = t.type === 'audio' ? 'tl-fx' : t.type === 'caption' ? 'tl-cap' : 'tl-ov', sel2 = tl.selIt === it.id ? ' sel' : '', lab = t.type === 'audio' ? esc(it.name || '소리') : t.type === 'caption' ? esc(String(it.text || '').replace(/\n/g, ' ')) : esc(it.name || '오버레이'); return `<div class="${cls}${sel2}${t.mute ? ' muted' : ''}${it.dis ? ' dis' : ''}" data-it="${it.id}" data-tid="${t.id}" style="left:${it.at * px}px;width:${Math.max(18, d * px)}px" title="${lab} · ${fmtTC(it.at, fps)} — 끌어 옮기기${t.type === 'audio' ? '(위아래로 다른 트랙)' : ', 두 번 눌러 고치기'}"><span>${t.type === 'overlay' && it.src ? `<img src="${src(it.src)}" alt="">` : ''}${lab}</span>${t.type === 'audio' ? vkHTML(it, d, px, 1) + (Number(it.fin || 0) ? `<i class="fi" style="width:${Number(it.fin) * px}px"></i>` : '') + (Number(it.fout || 0) ? `<i class="fo" style="width:${Number(it.fout) * px}px"></i>` : '') + fadeHTML(Number(it.fin || 0), Number(it.fout || 0), px) : ''}<em class="tl-il" data-il="1"></em><em class="tl-ir" data-ir="1"></em></div>`; }).join(''); return `<div class="tl-track tl-${t.type}" data-row="${t.id}">${items}</div>`; };
  const heads = `<div class="th rl"><button class="tadd" id="tlAddTrack" title="트랙 추가">＋ 트랙</button></div>` + upper.map(t => headHTML(t)).join('') + `<div class="th h-scn">${tli('film', 14)}<span>비디오 1<small>장면</small></span></div><div class="th h-ans">${tli('fx', 14)}<span>효과<small>움직임</small></span></div><div class="th h-aud">${tli('note', 14)}<span>오디오 1<small>배경 음악</small></span><button class="tm" data-mute="audio" title="소리 끄기/켜기"></button></div>` + lower.map(t => headHTML(t)).join('');
  $('#tlHeads').innerHTML = heads;
  $('#tlInner').style.width = Wd + 'px';
  $('#tlInner').innerHTML = `<div class="tl-ruler" id="tlRuler">${ruler}</div>${upper.map(rowOf).join('')}<div class="tl-track tl-scn">${scenes}</div><div class="tl-track tl-ans">${anims}</div><div class="tl-track tl-aud">${audio}</div>${lower.map(rowOf).join('')}<div class="tl-head" id="tlHead" style="left:${tl.T * px}px"><b class="hh" title="끌어서 이동"></b><button class="hcut" id="tlHeadCut" title="여기서 자르기 (Ctrl+B)">✂</button><i></i></div><div class="tl-end" style="left:${total * px}px"></div>${tl.snapT != null ? `<div class="tl-snapl" style="left:${tl.snapT * px}px"></div>` : ''}`;
  const m = !!(doc.audio && doc.audio.mute), mb = $('#tlHeads [data-mute="audio"]'); if (mb) { mb.innerHTML = tli(m ? 'mute' : 'vol', 13); mb.classList.toggle('on', m); }
  requestAnimationFrame(() => fitBoxes($('#tlInner'), '.tl-th', 44));
  tlTimeLabel(); tlWave(); tlStrips();
}
// ---- 음량 선(편집기 표준 '고무줄'): 소리 조각 위 가로선을 위아래로 끌면 음량, 선을 누르면 점이 생겨 그 점부터 따로 조절 ----
// 세로 눈금은 dB(사람 귀 기준): 맨 위 +6dB(200%), 0dB(100%)는 위에서 1/6쯤, 맨 아래는 소리 끔. 점: [[조각 시작부터 초, 배율], …]
const VK_TOP = 6, VK_RANGE = 36;
const vkY = v => v <= 0.0316 ? 1 : Math.min(1, Math.max(0, (VK_TOP - 20 * Math.log10(v)) / VK_RANGE));
const vkV = y => y >= 0.97 ? 0 : Math.round(Math.pow(10, (VK_TOP - Math.max(0, y) * VK_RANGE) / 20) * 1000) / 1000;
const vkDb = v => v <= 0 ? '소리 끔' : `${(20 * Math.log10(v)) >= 0 ? '+' : ''}${(20 * Math.log10(v)).toFixed(1)} dB · ${Math.round(v * 100)}%`;
const vkVal = (o, s, def) => o.vk && o.vk.length ? VIDEO.vkAt(o.vk, s) : o.vol == null ? def : Number(o.vol);
// 소리 페이드 손잡이(파이널컷): 조각 위 왼쪽·오른쪽 모서리의 작은 손잡이를 안쪽으로 끌면 서서히 커짐·작아짐 길이, 두 번 누르면 없앰
const fadeHTML = (fin, fout, px) => `<b class="tl-fh" data-fh="in" style="left:${Math.max(0, fin * px)}px" title="서서히 커짐 ${(fin || 0).toFixed(1)}초 — 안쪽으로 끌기 · 두 번 눌러 없애기"></b><b class="tl-fh out" data-fh="out" style="right:${Math.max(0, fout * px)}px" title="서서히 작아짐 ${(fout || 0).toFixed(1)}초 — 안쪽으로 끌기 · 두 번 눌러 없애기"></b>`;
function fadeDrag(e, host, which) {
  const isBg = host.id === 'tlAu', tr0 = isBg ? null : tracks().find(q => q.id === host.dataset.tid), o = isBg ? doc.audio : tr0 && tr0.items.find(q => q.id === host.dataset.it); if (!o) return;
  const d = isBg ? tlScenes().total - Number(o.start || 0) : itemDur(o), px = tl.pxs, sx = e.clientX;
  const fi0 = Number(o.fin || 0), fo0 = isBg ? (o.fout != null ? Number(o.fout) : (o.fade === false ? 0 : 2.5)) : Number(o.fout || 0);
  if (isBg) tl.selAu = true; else { tl.selIt = o.id; tl.selTr = tr0.id; }
  let tip = document.getElementById('vkTip'); if (!tip) { tip = document.createElement('div'); tip.id = 'vkTip'; tip.hidden = true; document.body.appendChild(tip); }
  let moved = false;
  const mv = ev => { const dx = (ev.clientX - sx) / px; if (Math.abs(ev.clientX - sx) > 2) moved = true; if (!moved) return;
    if (which === 'in') o.fin = Math.round(Math.max(0, Math.min(d - fo0 - 0.1, fi0 + dx)) * 20) / 20; else o.fout = Math.round(Math.max(0, Math.min(d - fi0 - 0.1, fo0 - dx)) * 20) / 20;
    tip.textContent = which === 'in' ? `서서히 커짐 ${Number(o.fin).toFixed(2)}초` : `서서히 작아짐 ${Number(o.fout).toFixed(2)}초`; tip.style.left = ev.clientX + 14 + 'px'; tip.style.top = ev.clientY - 30 + 'px'; tip.hidden = false; renderTimeline(); };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); tip.hidden = true;
    if (!moved) { const now = performance.now(), L = tl._fhLast; if (L && L.o === o && L.w === which && now - L.t < 450) { if (which === 'in') o.fin = 0; else o.fout = 0; tl._fhLast = null; commit(); renderTimeline(); toast(which === 'in' ? '서서히 커짐을 없앴습니다' : '서서히 작아짐을 없앴습니다'); return; } tl._fhLast = { o, w: which, t: now }; renderTimeline(); return; }
    if (isBg) delete o.fade; commit(); renderTimeline(); if (tl.playing) { tlPause(); tlPlay(); } };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
function vkHTML(o, d, px, def) {
  const W = Math.max(18, d * px), vk = (o.vk || []).filter(k => k[0] >= 0 && k[0] <= d);
  const pts = [[0, vkVal(o, 0, def)], ...vk, [d, vkVal(o, d, def)]], poly = pts.map(([q, v]) => `${(q * px).toFixed(1)},${(vkY(v) * 100).toFixed(2)}`).join(' ');
  return `<div class="tl-vk"><svg viewBox="0 0 ${W.toFixed(1)} 100" preserveAspectRatio="none"><polyline class="ln" points="${poly}"/><polyline class="hit" data-vline="1" points="${poly}"><title>음량 ${vkDb(vkVal(o, 0, def))} — 위아래로 끌어 음량 · 눌러서 점 찍기(그 점부터 따로 조절) · Alt+눌러 처음대로</title></polyline></svg>${vk.map(k => `<i data-vkp="${(o.vk || []).indexOf(k)}" style="left:${k[0] * px}px;top:${vkY(k[1]) * 100}%" title="${vkDb(k[1])} — 끌어 옮기기 · 두 번 눌러 지우기"></i>`).join('')}</div>`;
}
// 음량 선·점 끌기: 끄는 동안 옆에 dB 표시, 놓으면 실행 취소 한 단계
function vkDrag(e, host, vp) {
  const isBg = host.id === 'tlAu', tr0 = isBg ? null : tracks().find(q => q.id === host.dataset.tid), o = isBg ? doc.audio : tr0 && tr0.items.find(q => q.id === host.dataset.it); if (!o) return;
  const def = isBg ? 0.8 : 1, d = isBg ? tlScenes().total - Number(o.start || 0) : itemDur(o), px = tl.pxs, box = host.querySelector('.tl-vk').getBoundingClientRect();
  if (isBg) tl.selAu = true; else { tl.selIt = o.id; tl.selTr = tr0.id; }
  const sx = e.clientX, sy = e.clientY, sAt = ev => Math.max(0, Math.min(d, (ev.clientX - box.left) / px)), yAt = ev => (ev.clientY - box.top) / box.height;
  const vk0 = (o.vk || []).map(k => k.slice()), vol0 = o.vol == null ? def : Number(o.vol), s0 = sAt(e);
  let tip = document.getElementById('vkTip'); if (!tip) { tip = document.createElement('div'); tip.id = 'vkTip'; tip.hidden = true; document.body.appendChild(tip); }
  const show = (ev, v) => { tip.textContent = vkDb(v); tip.style.left = ev.clientX + 14 + 'px'; tip.style.top = ev.clientY - 30 + 'px'; tip.hidden = false; };
  let moved = false, move;
  if (e.altKey && !vp) { delete o.vk; delete o.vol; commit(); renderTimeline(); toast('음량을 처음대로 되돌렸습니다'); return; }
  if (vp) { const i = Number(vp.dataset.vkp), lo = i > 0 ? vk0[i - 1][0] + 0.05 : 0, hi = i < vk0.length - 1 ? vk0[i + 1][0] - 0.05 : d;
    move = ev => { const v = vkV(yAt(ev)); o.vk[i] = [Math.round(Math.max(lo, Math.min(hi, sAt(ev))) * 100) / 100, v]; show(ev, v); renderTimeline(); }; }
  else { // 선 끌기: 점이 없으면 조각 전체, 있으면 누른 곳 양옆 점(구간)을 함께 위아래로
    const a = vk0.reduce((r, k, j) => k[0] <= s0 ? j : r, -1), b = vk0.findIndex(k => k[0] > s0), dy0 = vkY(vkVal({ vk: vk0, vol: vol0 }, s0, def));
    move = ev => { const dy = (ev.clientY - sy) / box.height * (ev.shiftKey ? 0.2 : 1); if (!vk0.length) { o.vol = vkV(dy0 + dy); show(ev, o.vol); } else { o.vk = vk0.map(k => k.slice()); [a, b].filter(j => j >= 0).forEach(j => { o.vk[j][1] = vkV(vkY(vk0[j][1]) + dy); }); show(ev, VIDEO.vkAt(o.vk, s0)); } renderTimeline(); }; }
  const mv = ev => { if (Math.abs(ev.clientX - sx) > 3 || Math.abs(ev.clientY - sy) > 2) moved = true; if (moved) move(ev); };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); tip.hidden = true;
    if (vp && !moved) { const i = Number(vp.dataset.vkp), now = performance.now(), L = tl._vkLast; if (L && L.o === o && L.i === i && now - L.t < 450) { o.vk.splice(i, 1); if (!o.vk.length) delete o.vk; tl._vkLast = null; commit(); renderTimeline(); toast('음량 점을 지웠습니다'); return; } tl._vkLast = { o, i, t: now }; }
    if (moved) commit();
    else if (!vp) { // 눌러서 점 찍기 (가까운 점이 이미 있으면 그대로)
      const s1 = Math.round(s0 * 100) / 100, near = vk0.some(k => Math.abs(k[0] - s1) * px < 7);
      if (!near) { const v = Math.round(vkVal({ vk: vk0, vol: vol0 }, s1, def) * 1000) / 1000; o.vk = vk0.concat([[s1, v]]).sort((p, q) => p[0] - q[0]); commit(); toast('음량 점을 찍었습니다 — 점이나 점 사이 선을 위아래로 끌어 그 구간만 조절하세요'); }
    }
    renderTimeline(); if (moved && tl.playing) { tlPause(); tlPlay(); } };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
// 검색창 한글 조합 보호: 글자를 조합하는 동안에는 다시 그리지 않고(그리면 입력칸이 새로 생겨 'ㅌㅐ'처럼 낱자로 깨짐), 한 글자가 끝나면 검색
function imeSafe(inp, fn) { inp.addEventListener('compositionstart', () => { inp._comp = true; }); inp.addEventListener('compositionend', e => { inp._comp = false; fn(e); }); inp.oninput = e => { if (e.isComposing || inp._comp) return; fn(e); }; }
function headHTML(t) {
  const ic = t.type === 'audio' ? 'bell' : t.type === 'caption' ? 'text' : 'eye', toggle = t.type === 'audio' ? (t.mute ? 'mute' : 'vol') : 'eye';
  return `<div class="th h-${t.type}${t.mute ? ' off' : ''}" data-th="${t.id}">${tli(ic, 14)}<span data-tname="${t.id}" title="두 번 눌러 이름 바꾸기">${esc(t.name || TR_LABEL[t.type])}<small>${TR_LABEL[t.type]}</small></span>${t.type !== 'audio' ? `<button class="tm" data-tplus="${t.id}" title="${t.type === 'caption' ? '재생 위치에 자막 넣기' : '재생 위치에 로고·사진 넣기'}">＋</button>` : ''}<button class="tm${t.mute ? ' on' : ''}" data-tmute="${t.id}" title="${t.type === 'audio' ? '소리 끄기/켜기' : '보이기/숨기기'}">${tli(toggle, 13)}</button><button class="tm" data-tdel="${t.id}" title="트랙 지우기">✕</button></div>`;
}
// 필름 띠: 미리보기가 준비돼 있으면 장면을 시간대별로 뽑아 클립에 이어 붙임
let stripTimer = 0;
function tlStrips() {
  clearTimeout(stripTimer); stripTimer = setTimeout(async () => {
    const V = tl.V; if (!V || !tlOn() || tl.Vkey !== tlKey()) return;
    const { list } = tlScenes(), out = {}, th = 40, tw = Math.round(th * V.W / V.H), c = document.createElement('canvas'); c.width = tw; c.height = th; const x = c.getContext('2d');
    const big = document.createElement('canvas'); big.width = V.W; big.height = V.H; const bx = big.getContext('2d');
    list.forEach(s0 => { const n = Math.max(1, Math.min(24, Math.floor((s0.dur + s0.turn) * tl.pxs / tw))); out[s0.pg.id] = []; for (let k = 0; k < n; k++) { const T = s0.t0 + (s0.dur * (k + 0.5) / n); VIDEO.drawAt(bx, V, Math.min(T, V.total - 0.01)); x.drawImage(big, 0, 0, tw, th); out[s0.pg.id].push(c.toDataURL('image/jpeg', 0.6)); } });
    const same = JSON.stringify(Object.keys(out).map(k => out[k].length)) === JSON.stringify(Object.keys(tl.strips || {}).map(k => (tl.strips[k] || []).length)) && tl.stripKey === tl.Vkey;
    tl.strips = out; tl.stripKey = tl.Vkey; if (!same) renderTimeline();
  }, 300);
}
const tlKey = () => hptr + '|' + (hist[hptr] || '').length + '|' + doc.w + 'x' + doc.h;
async function tlWave() {
  const c = $('#tlWave'); if (!c || !doc.audio) return; const A = doc.audio, p0 = c.parentElement;
  try {
    let pk, dur;
    if (A.src.startsWith('b:')) { const buf = await NC.media.render(A.src.slice(2)); dur = buf.duration; pk = VIDEO.peaks(buf, Math.max(200, Math.round(dur * 8))); }
    else { const f = await NC.media.blobOf(A.src, false); dur = (await NC.astream.probe(f)).dur; if (!dur) return; const N = Math.min(20000, Math.max(200, Math.round(dur * 4))); pk = await Promise.race([NC.astream.peaks(f, A.src, N), new Promise(r => setTimeout(() => r(null), 50))]);
      /* 아직 계산 중이면 뒤에서 마저 계산한 뒤 한 번만 다시 그림 (이미 계산된 파형은 위에서 바로 받으므로 다시 부르지 않음 — 끝없이 되부르던 문제 방지) */
      if (!pk) { if (!tlWave.busy) { tlWave.busy = true; const msg = $('#tlMsg'); NC.astream.peaks(f, A.src, N, pr => { if (msg && dur > 120) msg.textContent = `음악 파형 계산 ${Math.round(pr * 100)}%`; }).then(() => { tlWave.busy = false; if (msg) msg.textContent = ''; tlWave(); }).catch(() => { tlWave.busy = false; }); } return; } }
    const w = p0.clientWidth, h = p0.clientHeight || 34; c.width = w; c.height = h; const x = c.getContext('2d'), from = Number(A.from || 0), px = tl.pxs; x.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < w; i++) { const t = from + i / px, k = Math.floor(((t % dur) / dur) * pk.length), v = pk[k] || 0, hh = Math.max(1, v * h * 0.9); x.fillRect(i, (h - hh) / 2, 1, hh); }
  } catch (e) { if (p0 && e.code) { p0.classList.add('miss'); p0.title = e.message + ' — 눌러서 연결'; } }
}
function tlTimeLabel() { const { total } = tlScenes(), fps = Number(vset().fps || 30); const el = $('#tlTime'); if (el) el.textContent = fmtTC(Math.min(tl.T, total), fps); const tt = $('#tlTot'); if (tt) tt.textContent = '/ ' + fmtTC(total, fps); const h = $('#tlHead'); if (h) h.style.left = tl.T * tl.pxs + 'px'; }
// 미리보기(가벼운 720p): 문서가 바뀌면 다시 만듦(바뀐 층만 다시 그림)
async function tlEnsureV() {
  const key = tlKey();
  if (tl.V && tl.Vkey === key) return tl.V;
  if (tl.building && tl.building.key === key) return tl.building.p;
  const msg = $('#tlMsg');
  const p = (async () => { const V = await videoBuild('720', (k, n) => { if (msg) msg.textContent = `미리보기 준비 ${Math.round(k / Math.max(1, n) * 100)}%`; }); if (msg) msg.textContent = ''; tl.V = V; tl.Vkey = key; tl.building = null; tlStrips(); return V; })();
  tl.building = { key, p }; try { return await p; } catch (e) { tl.building = null; if (msg) msg.textContent = '미리보기 실패: ' + e.message; throw e; }
}
async function tlDraw() { const V = await tlEnsureV(); const c = $('#vprev'); if (!c) return; if (c.width !== V.W || c.height !== V.H) { c.width = V.W; c.height = V.H; } c.hidden = false; if (V.videos && V.videos.length) { if (tl.playing) VIDEO.syncVideos(V, tl.T, true); else { const tok = tl.drawTok = (tl.drawTok || 0) + 1; V.videos.forEach(v => { if (!v.paused) v.pause(); }); await VIDEO.seekVideos(V, tl.T); if (tok !== tl.drawTok) return; } } VIDEO.drawAt(c.getContext('2d'), V, Math.min(tl.T, V.total - 0.001)); }
function tlHidePrev() { const c = $('#vprev'); if (c) c.hidden = true; }
async function tlPlay() {
  if (tl.playing || tl.starting) return; let V; tl.starting = true; tl.cancelStart = false; try { V = await tlEnsureV(); } catch (e) { return; } finally { tl.starting = false; }  /* 준비 중 두 번 눌러도 한 번만 */
  if (tl.cancelStart) { tl.cancelStart = false; return; }
  if (tl.T >= V.total - 0.05) tl.T = 0;
  tl.playing = true; $('#tlPlay').innerHTML = tli('pause', 20); tlMeter(true);
  const ac = VIDEO.ctx(); ac.resume && ac.resume();
  if (!tl.playing) return;
  const T0 = tl.T, when = ac.currentTime + 0.05; tl.t0 = when - T0;
  tl.snd = VIDEO.playVoices(ac, tlBus(ac), V.voices, T0, when, V.total);
  const loop = () => { if (!tl.playing) return; tl.T = Math.max(T0, ac.currentTime - tl.t0); if (tl.T >= V.total) { tl.T = V.total; tlPause(); tlDraw(); return; } tlDraw(); tlTimeLabel(); tlFollow(); tl.raf = requestAnimationFrame(loop); };
  loop();
}
// 미리보기 소리: 배경 음악 + 효과음을 소리 시계에 맞춰 예약 (영상 시각 = 소리 시계 − t0)
function tlBus(ac) {
  if (tl.bus && tl.bus.context === ac) return tl.bus;
  const bus = ac.createGain(), sp = ac.createChannelSplitter(2), aL = ac.createAnalyser(), aR = ac.createAnalyser(); aL.fftSize = aR.fftSize = 512; bus.connect(ac.destination); bus.connect(sp); sp.connect(aL, 0); sp.connect(aR, 1); tl.bus = bus; tl.an = [aL, aR]; return bus;
}
// 소리 막대(L·R): 재생 중 크기 표시
function tlMeter(on) {
  cancelAnimationFrame(tl.mraf); const L = $('#mtL'), R = $('#mtR'); if (!L) return;
  if (!on || !tl.an) { L.style.height = R.style.height = '0%'; return; }
  const buf = new Float32Array(512), lvl = a => { a.getFloatTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i])); const db = 20 * Math.log10(m || 1e-6); return Math.max(0, Math.min(100, (db + 48) / 48 * 100)); };
  const step = () => { L.style.height = lvl(tl.an[0]) + '%'; R.style.height = lvl(tl.an[1]) + '%'; tl.mraf = requestAnimationFrame(step); }; step();
}
function tlPause() { if (tl.starting) tl.cancelStart = true; if (!tl.playing) return; tl.playing = false; cancelAnimationFrame(tl.raf); if (tl.snd) { tl.snd.stop(); tl.snd = null; } if (tl.V && tl.V.videos) tl.V.videos.forEach(v => v.pause()); const b = $('#tlPlay'); if (b) b.innerHTML = tli('play', 20); tlMeter(false); tlTimeLabel(); }
function tlFollow() { const sc = $('#tlScroll'), x = tl.T * tl.pxs; if (!sc) return; if (x < sc.scrollLeft + 40 || x > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = Math.max(0, x - sc.clientWidth * 0.3); }
function tlSeek(T, show) { const { total, list } = tlScenes(); tl.T = Math.max(0, Math.min(total, T)); tlTimeLabel(); if (!tl.playing) { const x = list.find(q => tl.T >= q.t0 && tl.T < q.t0 + q.dur + q.turn) || list[list.length - 1]; if (x && x.i !== cur && doc.pages[x.i]) { cur = x.i; renderInspector(); if (typeof renderThumbs === 'function') renderThumbs(); } } if (tl.playing) { tlPause(); tlPlay(); } else if (show !== false) tlDraw().catch(() => {}); }
// 장면 나누기: 재생 위치에서 지금 장면을 둘로 (뒤쪽은 복제본, 움직임 시작을 그만큼 당김)
function tlSplit() {
  if (tl.selIt) { for (const t of tracks()) { const it = (t.items || []).find(q => q.id === tl.selIt); if (!it) continue; const d = t.type === 'audio' ? itemDur(it) : Number(it.dur || 3), q = Math.round((tl.T - it.at) * 100) / 100; if (q > 0.1 && q < d - 0.1) { const it2 = splitItem(t, it, q); tl.selIt = it2.id; commit(); renderTimeline(); toastUndo(`'${it.name || '클립'}'을 ${fmtTC(tl.T).slice(3)}에서 잘랐습니다 — 필요 없는 조각을 골라 Delete`); return; } } }
  tlSplitScene(false);
}
function tlSplitScene(quiet) {
  if (videoNeedsGate()) { openVideoGate(); return; }
  const { list } = tlScenes(), x = list.find(s2 => tl.T >= s2.t0 && tl.T < s2.t0 + s2.dur); if (!x) { if (!quiet) toast('장면 안에 재생 위치를 두고 나누세요', true); return; }
  const q = Math.round((tl.T - x.t0) * 10) / 10; if (q < 0.3 || x.dur - q < 0.3) { if (!quiet) toast('장면 끝에 너무 가깝습니다', true); return; }
  const a = x.pg, b = clone(a); b.id = uid(); const gm = {}; b.els.forEach(e => { e.id = uid(); if (e.group) { gm[e.group] = gm[e.group] || uid(); e.group = gm[e.group]; } if (e.anim) { const d = Number(e.anim.d || 0) - q; if (d < 0) delete e.anim; else e.anim.d = d; } });  /* 이미 시작한 움직임은 끝난 모습으로 이어짐(뒤 조각에서 처음부터 다시 튀지 않게) */
  // 동영상: 앞 조각은 자른 지점에서 끝나고, 뒤 조각은 자른 지점부터 이어서 재생
  a.els.forEach((e, k) => { if (e.type !== 'video') return; const e2 = b.els[k], d0 = e.anim ? Number(e.anim.d || 0) : 0, used = Math.max(0, q - d0), tin = Number(e.tin || 0), tout = Number(e.tout || e.dur || 0); if (!used) return; const cut = Math.min(tout, tin + used); e.tout = Math.round(cut * 100) / 100; e2.tin = Math.round(cut * 100) / 100; e2.tout = tout; if (e2.anim) e2.anim.d = 0; });
  b.vdur = Math.round((x.dur - q) * 10) / 10; a.vdur = q; b.vtrans = a.vtrans; b.vturn = a.vturn; a.vtrans = 'none'; a.els.forEach(e => { delete e.animOut; });
  doc.pages.splice(x.i + 1, 0, b); commit(); goto(x.i + 1); renderTimeline(); if (!quiet) toastUndo(`${x.i + 1}쪽을 ${q}초에서 나눴습니다`);
}
function tlWire() {
  const root = $('#vtl');
  $('#tlPlay').onclick = () => tl.playing ? tlPause() : tlPlay();
  $('#tlKeys').onclick = tlKeysHelp; $('#tlSnapBtn').onclick = tlToggleSnap;
  $('#tlView').onclick = () => popMenu($('#tlView'), TL_VIEWS.map(([k, t, d]) => [k, (tlView === k ? '✓ ' : '') + t, d]).concat([['only', (tlOnlyVideo ? '✓ ' : '　') + '영상 메뉴에서만 타임라인', '다른 메뉴(템플릿·요소·글자 등)로 가면 평소 디자인 공방 화면으로, 영상 메뉴로 돌아오면 다시 나타납니다. 끄면 어느 메뉴에서나 타임라인을 둡니다']]), k => { if (k === 'only') { tlOnlyVideo = !tlOnlyVideo; try { localStorage.setItem('naracal-tlonly', tlOnlyVideo ? '1' : '0'); } catch (e) {} toast(tlOnlyVideo ? '이제 영상 메뉴에서만 타임라인이 보입니다' : '이제 어느 메뉴에서나 타임라인을 둡니다'); if (tlOnlyVideo && sideTab !== 'video') { if (tl.playing) tlPause(); tlShow(false); } return; } tlView = k; try { localStorage.setItem('naracal-tlview', k); } catch (e) {} applyTlView(); });
  $('#tlSplit').onclick = tlSplit; $('#tlBig').onclick = () => { tlPause(); openVideoPlayer(true); }; $('#tlSave').onclick = () => { tlPause(); openVideoMaker(); }; $('#tlClose').onclick = () => tlShow(false);
  $('#tlZi').onclick = () => { tl.pxs = Math.min(400, tl.pxs * 1.4); renderTimeline(); }; $('#tlZo').onclick = () => { tl.pxs = Math.max(3, tl.pxs / 1.4); renderTimeline(); }; $('#tlZf').onclick = () => { tl.fit = true; renderTimeline(); };
  $('#tlZoom').oninput = e => { tl.pxs = 3 * Math.pow(400 / 3, Number(e.target.value) / 100); renderTimeline(); };
  $('#tlUndo').onclick = () => undo(); $('#tlRedo').onclick = () => redo();
  $('#tlFirst').onclick = () => tlSeek(0); $('#tlStop').onclick = () => tlPause();
  $('#tlPrevF').onclick = () => tlSeek(tl.T - 1 / Number(vset().fps || 30)); $('#tlNextF').onclick = () => tlSeek(tl.T + 1 / Number(vset().fps || 30));
  $('#tlText').onclick = () => { const { list } = tlScenes(), x = list.find(q => tl.T >= q.t0 && tl.T < q.t0 + q.dur + q.turn); if (x && x.i !== cur) goto(x.i); const el = addText('h', { text: '제목을 입력하세요', noEdit: true }); el.anim = { t: 'type', d: Math.max(0, Math.round((tl.T - (x ? x.t0 : 0)) * 10) / 10), s: 1.4 }; commit(); renderAll(); toast('타자기 효과 글자를 넣었습니다 — 두 번 눌러 글을 고치세요'); };
  $('#tlRec').onclick = tlRecord;
  $('#tlDel').onclick = () => { if (tl.selIt) { tracks().forEach(t => { t.items = (t.items || []).filter(q => q.id !== tl.selIt); }); tl.selIt = null; commit(); renderTimeline(); toastUndo('고른 클립을 지웠습니다'); return; } if (tl.selAu && doc.audio) { delete doc.audio; tl.selAu = false; commit(); renderTimeline(); renderSide(); toastUndo('배경 음악을 뺐습니다'); return; } tlDeleteScene(false); };
  root.addEventListener('click', e => {
    const t = e.target, trk = id => tracks().find(x => x.id === id);
    const m = t.closest('[data-mute]'); if (m) { if (!doc.audio) return; doc.audio.mute = !doc.audio.mute || undefined; commit(); renderTimeline(); if (tl.playing) { tlPause(); tlPlay(); } return; }
    const tm = t.closest('[data-tmute]'); if (tm) { const x = trk(tm.dataset.tmute); x.mute = !x.mute || undefined; commit(); renderTimeline(); if (tl.playing) { tlPause(); tlPlay(); } return; }
    const td = t.closest('[data-tdel]'); if (td) { const x = trk(td.dataset.tdel); if ((x.items || []).length && !window.confirm(`'${x.name}' 트랙과 안의 클립 ${x.items.length}개를 지울까요?`)) return; doc.tracks = tracks().filter(q => q !== x); commit(); renderTimeline(); toastUndo('트랙을 지웠습니다'); return; }
    const tp = t.closest('[data-tplus]'); if (tp) { const x = trk(tp.dataset.tplus); if (x.type === 'caption') { const it = { id: uid(), text: '자막을 입력하세요', at: Math.round(tl.T * 10) / 10, dur: 2.5, style: 'outline', pos: 'bottom', size: 0.065 }; x.items.push(it); commit(); renderTimeline(); openItemPop(x, it); } else overlayMenu(x, tp); return; }
    if (t.closest('#tlAddTrack')) { trackMenu(t.closest('#tlAddTrack')); return; }
  });
  root.addEventListener('dblclick', e => { const vp = e.target.closest('[data-vkp]'); if (vp || e.target.closest('[data-vline]')) { if (vp) { const host = vp.closest('[data-it],#tlAu'), o = host.id === 'tlAu' ? doc.audio : (tracks().find(q => q.id === host.dataset.tid) || { items: [] }).items.find(q => q.id === host.dataset.it); if (o && o.vk) { o.vk.splice(Number(vp.dataset.vkp), 1); if (!o.vk.length) delete o.vk; commit(); renderTimeline(); toast('음량 점을 지웠습니다'); } } return; } const nm = e.target.closest('[data-tname]'); if (nm) { const x = tracks().find(q => q.id === nm.dataset.tname), v = window.prompt('트랙 이름', x.name); if (v && v.trim()) { x.name = v.trim(); commit(); renderTimeline(); } return; } const it = e.target.closest('[data-it]'); if (!it) return; const x = tracks().find(q => q.id === it.dataset.tid), item = x && x.items.find(q => q.id === it.dataset.it); if (!item) return; if (x.type === 'audio') toast('소리 조각은 한 번 누르면 앞부분을 들어 보고, 지우려면 Delete 키나 🗑 단추를 씁니다 · 흰 선을 위아래로 끌면 음량'); else openItemPop(x, item);  /* 두 번 눌러 바로 지우던 것(실수로 잃기 쉬움) */ });
  $('#tlScroll').addEventListener('scroll', e => { const h = $('#tlHeads'); if (h) h.scrollTop = e.target.scrollTop; });  /* 머리 칸을 트랙과 함께 위아래로 */
  $('#tlHeads').addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) return; $('#tlScroll').scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });
  $('#tlScroll').addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); tl.pxs = Math.max(3, Math.min(400, tl.pxs * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); renderTimeline(); } }, { passive: false });
  const inner = () => $('#tlInner'), tAt = e => (e.clientX - inner().getBoundingClientRect().left) / tl.pxs;
  root.addEventListener('pointerdown', e => {
    const t = e.target; if (t.closest('.vtl-bar') || t.closest('.tl-heads') || t.closest('.tl-meter')) return;
    if (t.closest('#tlAddMusic')) { e.preventDefault(); pickMusicLocal(); return; }
    if (t.closest('#tlHeadCut')) { tlSplit(); return; }
    if (t.closest('[data-mute]')) return;
    const mk = t.closest('[data-mk]'); if (mk) { const m = (doc.markers || []).find(q => q.id === mk.dataset.mk); if (m) { const now = performance.now(), L = tl._mkLast; if (L && L.id === m.id && now - L.t < 450) { tl._mkLast = null; tlMarkerEdit(m); } else { tl._mkLast = { id: m.id, t: now }; tlPause(); tlSeek(Number(m.t)); } } e.preventDefault(); return; }
    const fh = t.closest('[data-fh]'); if (fh) { e.preventDefault(); e.stopPropagation(); fadeDrag(e, t.closest('[data-it],#tlAu'), fh.dataset.fh); return; }
    const vp = t.closest('[data-vkp]'), vl = t.closest('[data-vline]'); if (vp || vl) { e.preventDefault(); e.stopPropagation(); vkDrag(e, t.closest('[data-it],#tlAu'), vp); return; }
    const sx = e.clientX; let moved = false; const pid = e.pointerId; try { root.setPointerCapture(pid); } catch (err) {}
    let move = null, up = null;
    const lh = t.closest('[data-lh]'), rh = t.closest('[data-rh]'), clip = t.closest('.tl-clip'), tr = t.closest('[data-tr]'), an = t.closest('[data-ael]'), au = t.closest('#tlAu'), itEl = t.closest('[data-it]');
    tl.selIt = null; tl.selAu = false; tl.selScene = false;
    if (tr) { up = () => openTransPop(Number(tr.dataset.tr), tr); }
    else if (lh) { const pg = doc.pages[Number(lh.dataset.lh)], d0 = Number(pg.vdur || vset().dur), s0 = tlScenes().list.find(q => q.i === Number(lh.dataset.lh)), rip = s0 ? tlRippleSnap(s0.t0 + s0.dur) : () => {}; move = ev => { pg.vdur = Math.max(0.5, Math.round((d0 - (ev.clientX - sx) / tl.pxs) * 10) / 10); rip(pg.vdur - d0); renderTimeline(); }; up = () => { if (moved) commit(); }; }
    else if (rh) { const pg = doc.pages[Number(rh.dataset.rh)], d0 = Number(pg.vdur || vset().dur), s0 = tlScenes().list.find(q => q.i === Number(rh.dataset.rh)), rip = s0 ? tlRippleSnap(s0.t0 + s0.dur) : () => {}, sP = s0 ? tlSnapPts(null, s0.i).filter(v => v > s0.t0 + s0.dur + 0.01 || v < s0.t0 + s0.dur - 0.01) : []; move = ev => { let end = (s0 ? s0.t0 : 0) + d0 + (ev.clientX - sx) / tl.pxs; const v = s0 ? tlSnapTo(end, sP.filter(x => x < s0.t0 + s0.dur || x > s0.t0 + s0.dur)) : null; tl.snapT = v; if (v != null) end = v; pg.vdur = Math.max(0.5, Math.round((end - (s0 ? s0.t0 : 0)) * 100) / 100); rip(pg.vdur - d0); renderTimeline(); }; up = () => { tl.snapT = null; if (moved) commit(); renderTimeline(); }; }
    else if (an) { const pg = doc.pages[Number(an.dataset.ap)], el = pg.els.find(q => q.id === an.dataset.ael), edge = t.closest('[data-ah]'); const a0 = el.anim ? Object.assign({}, el.anim) : null; move = ev => { if (!a0) return; const dt = (ev.clientX - sx) / tl.pxs; if (edge) el.anim.s = Math.max(0.2, Math.round((Number(a0.s || 0.8) + dt) * 10) / 10); else el.anim.d = Math.max(0, Math.round((Number(a0.d || 0) + dt) * 10) / 10); renderTimeline(); }; up = () => { if (moved) { commit(); renderInspector(); } else { const i = doc.pages.indexOf(pg); if (i !== cur) goto(i); select([el.id]); renderTimeline(); } }; }
    else if (au) { if (au.classList.contains('miss')) { relinkMedia(doc.audio.src); return; } tl.selAu = true; const s0 = Number(doc.audio.start || 0); move = ev => { doc.audio.start = Math.max(0, Math.round((s0 + (ev.clientX - sx) / tl.pxs) * 10) / 10); renderTimeline(); }; up = () => { if (moved) commit(); }; }
    else if (itEl) { // 트랙 클립: 끌어 옮기기(오디오는 위아래 트랙으로도), 오른쪽 끝은 길이
      const tr0 = tracks().find(q => q.id === itEl.dataset.tid), it = tr0.items.find(q => q.id === itEl.dataset.it), a0 = it.at, d0 = tr0.type === 'audio' ? itemDur(it) : Number(it.dur || 3), edge = t.closest('[data-ir]'), ledge = t.closest('[data-il]'), o0 = Number(it.off || 0), full = Number(it.full || 0), vk0 = it.vk ? it.vk.map(k => k.slice()) : null; let owner = tr0;
      const sPts = tlSnapPts(it.id);
      move = ev => { let dt = (ev.clientX - sx) / tl.pxs; tl.snapT = null;
        { const cands = ledge ? [a0] : edge ? [a0 + d0] : [a0, a0 + d0]; let best = null; cands.forEach(c => { const v = tlSnapTo(c + dt, sPts); if (v != null && (best == null || Math.abs(v - c - dt) < Math.abs(best.v - best.c - dt))) best = { v, c }; }); if (best) { dt = best.v - best.c; tl.snapT = best.v; } else if (!ledge && !edge) dt = tlFrame(a0 + dt) - a0; }
        if (ledge) { let d = Math.max(-a0, Math.min(d0 - 0.2, dt)); if (tr0.type === 'audio') d = Math.max(-o0, d); it.at = Math.round((a0 + d) * 100) / 100; it.dur = Math.round((d0 - d) * 100) / 100; if (tr0.type === 'audio') { it.off = Math.round((o0 + d) * 100) / 100; if (vk0) it.vk = vk0.map(k => [Math.round((k[0] - d) * 100) / 100, k[1]]); } } else if (edge) { it.dur = Math.max(0.2, Math.round((d0 + dt) * 100) / 100); if (tr0.type === 'audio' && full) it.dur = Math.min(it.dur, Math.round((full - o0) * 100) / 100); } else { it.at = Math.max(0, Math.round((a0 + dt) * 1000) / 1000); if (tr0.type === 'audio') { const row = document.elementsFromPoint(ev.clientX, ev.clientY).map(n => n.closest && n.closest('[data-row]')).find(Boolean), dst = row && tracks().find(q => q.id === row.dataset.row); if (dst && dst !== owner && dst.type === 'audio') { owner.items = owner.items.filter(q => q !== it); dst.items.push(it); owner = dst; itEl.dataset.tid = dst.id; } } } renderTimeline(); };
      up = () => { tl.snapT = null; tl.selIt = it.id; tl.selTr = itEl.dataset.tid; if (moved) commit(); else { tlSeek(it.at, false); if (tr0.type === 'audio') previewSound(it.ref, null, Number(it.off || 0), 8); } renderTimeline(); }; }
    else if (clip) { const k0 = Number(clip.dataset.k); move = ev => { if (Math.abs(ev.clientX - sx) > 6) clip.style.transform = `translateX(${ev.clientX - sx}px)`; }; up = ev => { const { list } = tlScenes(), x = tAt(ev); if (moved && Math.abs(ev.clientX - sx) > 12) { let k1 = list.findIndex(s2 => x < s2.t0 + (s2.dur + s2.turn) / 2); if (k1 < 0) k1 = list.length; if (k1 > k0) k1 = Math.max(k0, k1 - 1);  /* 뒤로 옮길 때는 빠진 자리만큼 한 칸 당김 */ const from = list[k0].i, to = list[k1].i; if (from !== to) { const snap = tlConnSnap(); const [pg] = doc.pages.splice(from, 1); doc.pages.splice(to, 0, pg); snap(); commit(); goto(to);  /* 붙은 자막·소리도 장면과 함께 */ } renderTimeline(); } else { const i = Number(clip.dataset.ci); if (i !== cur) goto(i); tl.selScene = true; tlSeek(Math.max(tl.T, list[k0].t0) < list[k0].t0 + list[k0].dur && tl.T >= list[k0].t0 ? tl.T : list[k0].t0, false); renderTimeline(); } }; }
    else { tlSeek(tAt(e)); move = ev => tlSeek(tAt(ev)); }
    const mv = ev => { if (Math.abs(ev.clientX - sx) > 3) moved = true; if (move && moved) move(ev); };
    const fin = ev => { root.removeEventListener('pointermove', mv); root.removeEventListener('pointerup', fin); root.removeEventListener('pointercancel', fin); try { root.releasePointerCapture(pid); } catch (err) {} if (ev.type === 'pointercancel') { renderTimeline(); return; } if (up) up(ev); };
    root.addEventListener('pointermove', mv); root.addEventListener('pointerup', fin); root.addEventListener('pointercancel', fin);
  });
}
// 트랙 추가 메뉴
function popMenu(anchor, items, onPick) {
  $('#tlMenu') && $('#tlMenu').remove(); const r = anchor.getBoundingClientRect(), m = document.createElement('div'); m.id = 'tlMenu'; m.className = 'tl-menu';
  m.innerHTML = items.map(([k, t, d]) => `<button data-k="${k}"><b>${t}</b>${d ? `<small>${d}</small>` : ''}</button>`).join(''); document.body.appendChild(m);
  m.style.left = Math.min(innerWidth - 240, r.left) + 'px'; m.style.top = Math.max(8, r.top - m.offsetHeight - 6) + 'px';
  const close = () => { m.remove(); document.removeEventListener('pointerdown', out, true); }, out = e => { if (!m.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', out, true)); m.onclick = e => { const b = e.target.closest('[data-k]'); if (b) { close(); onPick(b.dataset.k); } };
}
function trackMenu(anchor) {
  popMenu(anchor, [['audio', '오디오 트랙', '효과음·녹음·음악 클립'], ['caption', '자막 트랙', '쇼츠식 자막 (단어씩 강조 등)'], ['overlay', '오버레이 트랙', '로고 워터마크·사진을 영상 위에']], k => {
    const n = tracks().filter(t => t.type === k).length + 1; tracks().push({ id: uid(), type: k, name: TR_LABEL[k] + ' ' + (k === 'audio' ? n + 1 : n), items: [] }); commit(); renderTimeline(); toast(`${TR_LABEL[k]} 트랙을 추가했습니다`);
  });
}
function overlayMenu(t, anchor) {
  popMenu(anchor, [['asset:brand-horizontal-white', '나라차 로고 (흰색)', '어두운 영상 위에'], ['asset:brand-horizontal', '나라차 로고 (컬러)', '밝은 영상 위에'], ['asset:brand-korean', '한글 로고', ''], ['asset:brand-hex', '육각 심볼', ''], ['upload', '사진·그림 올리기…', 'PNG·JPG']], async k => {
    let ref = k, name = (k.match(/brand-(\w+)/) || [0, '로고'])[1];
    if (k === 'upload') { const f = await new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => res(i.files[0]); i.click(); }); if (!f) return; ref = addAsset(await fileToDataURL(f)); name = f.name.replace(/\.[^.]+$/, ''); }
    else name = { 'brand-horizontal-white': '로고 (흰색)', 'brand-horizontal': '로고', 'brand-korean': '한글 로고', 'brand-hex': '심볼' }[k.slice(6)] || '로고';
    const { total } = tlScenes(), at = Math.round(tl.T * 10) / 10, it = { id: uid(), src: ref, name, at, dur: Math.max(1, Math.round((total - at) * 10) / 10), pos: 'tr', scale: k.includes('hex') ? 0.08 : 0.16, opacity: 0.9 };
    t.items.push(it); commit(); renderTimeline(); openItemPop(t, it);
  });
}
// 자막·오버레이 클립 고치기 창
function openItemPop(t, it) {
  $('#itPop') && $('#itPop').remove(); const m = document.createElement('div'); m.id = 'itPop'; m.className = 'tr-pop it-pop';
  const pos9 = [['tl', '↖'], ['tc', '↑'], ['tr', '↗'], ['ml', '←'], ['mc', '•'], ['mr', '→'], ['bl', '↙'], ['bc', '↓'], ['br', '↘']];
  m.innerHTML = t.type === 'caption' ? `<b>자막</b><label class="f"><textarea id="ipText" rows="2">${esc(it.text || '')}</textarea></label>
    <div class="tr-grid">${VIDEO.CAP_STYLES.map(([v, n]) => `<button data-cs="${v}" class="${(it.style || 'outline') === v ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="grid2"><label class="f"><span>위치</span><select id="ipPos"><option value="bottom" ${it.pos !== 'top' && it.pos !== 'middle' ? 'selected' : ''}>아래</option><option value="middle" ${it.pos === 'middle' ? 'selected' : ''}>가운데</option><option value="top" ${it.pos === 'top' ? 'selected' : ''}>위</option></select></label><label class="f"><span>글꼴</span><select id="ipFont">${['Pretendard', 'GMarketSans', 'YeogiOttaeJalnan', 'Paperozi', 'Jua', 'Black Han Sans'].map(f => `<option ${it.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label></div>`
    : `<b>오버레이 — ${esc(it.name || '')}</b><div class="pos9">${pos9.map(([v, a]) => `<button data-p9="${v}" class="${(it.pos || 'tr') === v ? 'on' : ''}">${a}</button>`).join('')}</div><label class="f"><span>투명도 <small id="ipOpV">${Math.round((it.opacity == null ? 1 : it.opacity) * 100)}%</small></span><input type="range" id="ipOp" min="0.1" max="1" step="0.05" value="${it.opacity == null ? 1 : it.opacity}"></label>`;
  m.innerHTML += `<div class="grid2"><label class="f"><span>${t.type === 'caption' ? '글자 크기' : '크기'} <small id="ipSzV"></small></span><input type="range" id="ipSz" min="${t.type === 'caption' ? 0.03 : 0.04}" max="${t.type === 'caption' ? 0.14 : 0.6}" step="0.005" value="${it.size || it.scale || (t.type === 'caption' ? 0.065 : 0.16)}"></label><label class="f"><span>길이 (초)</span><input type="number" id="ipDur" min="0.2" step="0.1" value="${it.dur || 3}"></label></div><div class="row" style="gap:6px;justify-content:space-between"><button class="btn sm danger" id="ipDel">지우기</button><button class="btn sm primary" id="ipOk">완료</button></div>`;
  document.body.appendChild(m); const r = ($('#vtl') || document.body).getBoundingClientRect(); m.style.left = Math.max(8, r.left + r.width / 2 - 160) + 'px'; m.style.top = Math.max(8, r.top - m.offsetHeight - 8) + 'px';
  const live = () => { renderTimeline(); tlSeek(Math.max(tl.T, it.at) <= it.at + (it.dur || 3) ? Math.max(tl.T, it.at) : it.at); };
  const close = () => { m.remove(); document.removeEventListener('pointerdown', out, true); commit(); renderTimeline(); }, out = e => { if (!m.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', out, true));
  m.oninput = e => { const id = e.target.id; if (id === 'ipText') it.text = e.target.value; if (id === 'ipSz') { if (t.type === 'caption') it.size = Number(e.target.value); else it.scale = Number(e.target.value); } if (id === 'ipOp') { it.opacity = Number(e.target.value); $('#ipOpV').textContent = Math.round(it.opacity * 100) + '%'; } if (id === 'ipDur') it.dur = Math.max(0.2, Number(e.target.value) || 1); tl.Vkey = ''; live(); };
  m.onchange = e => { if (e.target.id === 'ipPos') it.pos = e.target.value; if (e.target.id === 'ipFont') it.font = e.target.value; tl.Vkey = ''; live(); };
  m.onclick = e => { const cs = e.target.closest('[data-cs]'); if (cs) { it.style = cs.dataset.cs; m.querySelectorAll('[data-cs]').forEach(x => x.classList.toggle('on', x === cs)); tl.Vkey = ''; live(); } const p9 = e.target.closest('[data-p9]'); if (p9) { it.pos = p9.dataset.p9; m.querySelectorAll('[data-p9]').forEach(x => x.classList.toggle('on', x === p9)); tl.Vkey = ''; live(); } if (e.target.id === 'ipDel') { t.items = t.items.filter(q => q !== it); close(); toastUndo('지웠습니다'); } if (e.target.id === 'ipOk') close(); };
  tl.T = it.at + 0.4; tlDraw().catch(() => {});
}
// 음성 녹음: 마이크로 녹음해 재생 헤드 위치에 넣음 (원본은 이 PC에만)
let recState = null;
async function tlRecord() {
  const b = $('#tlRec');
  if (recState) { recState.rec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [], at = Math.round(tl.T * 10) / 10, t0 = Date.now();
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => { stream.getTracks().forEach(t => t.stop()); clearInterval(recState.iv); recState = null; b.classList.remove('rec'); $('#tlMsg').textContent = '';
      const blob = new Blob(chunks, { type: (mime || 'audio/webm').split(';')[0] }), nm = `녹음 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`, f = new File([blob], nm + (mime.includes('mp4') ? '.m4a' : '.webm'), { type: blob.type });
      const m = await NC.media.addFile(f); doc.media = Object.assign(doc.media || {}, { [m.id]: m }); const TR = tracks(); let rt = TR.find(x => x.type === 'audio' && /녹음|음성/.test(x.name)); if (!rt) { rt = { id: uid(), type: 'audio', name: '음성 녹음', items: [] }; TR.push(rt); } rt.items.push({ id: uid(), ref: 'm:' + m.id, name: nm, at, vol: 1, dur: (Date.now() - t0) / 1000 }); commit(); renderTimeline(); toast('녹음을 넣었습니다 (원본은 이 PC에만)'); };
    rec.start(); b.classList.add('rec'); recState = { rec, iv: setInterval(() => { $('#tlMsg').textContent = `● 녹음 중 ${((Date.now() - t0) / 1000).toFixed(0)}초 — 다시 누르면 멈춤`; }, 300) };
    if (!tl.playing) tlPlay();
  } catch (e) { toast('마이크를 쓸 수 없습니다: ' + e.message, true); }
}
// 넘김 효과 고르기 (◆ 누르면)
function openTransPop(i, anchor) {
  $('#trPop') && $('#trPop').remove(); const pg = doc.pages[i], V = vset(), r = anchor.getBoundingClientRect();
  const m = document.createElement('div'); m.id = 'trPop'; m.className = 'tr-pop';
  m.innerHTML = `<b>${i + 1}쪽 → 다음 장면 넘김</b><div class="tr-grid">${VIDEO.TRANS.map(([v, t]) => `<button data-tv="${v}" class="${(pg.vtrans || V.trans) === v ? 'on' : ''}">${t}</button>`).join('')}</div><label class="f"><span>넘김 길이 <small id="trTv">${Number(pg.vturn || V.turn)}초</small></span><input type="range" id="trTurn" min="0.2" max="2" step="0.1" value="${Number(pg.vturn || V.turn)}"></label><div class="row" style="gap:6px"><button class="btn sm" id="trAll">모든 장면에 적용</button><button class="btn sm" id="trClose">닫기</button></div>`;
  document.body.appendChild(m); m.style.left = Math.max(8, Math.min(innerWidth - 330, r.left - 150)) + 'px'; m.style.top = Math.max(8, r.top - m.offsetHeight - 8) + 'px';
  const close = () => { m.remove(); document.removeEventListener('pointerdown', out, true); }, out = e => { if (!m.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', out, true));
  m.onclick = e => { const b = e.target.closest('[data-tv]'); if (b) { pg.vtrans = b.dataset.tv; commit(); renderTimeline(); m.querySelectorAll('[data-tv]').forEach(x => x.classList.toggle('on', x === b)); const { list } = tlScenes(), x = list.find(s2 => s2.i === i); if (x) { tl.T = x.t0 + Math.max(0, x.dur - 0.3); tlPlay(); setTimeout(() => { if (tl.playing && tl.T > x.t0 + x.dur + x.turn + 0.3) tlPause(); }, (x.turn + 0.9) * 1000); } return; } if (e.target.id === 'trAll') { doc.pages.forEach(p2 => { p2.vtrans = pg.vtrans || V.trans; p2.vturn = pg.vturn; }); commit(); renderTimeline(); toastUndo('모든 장면에 같은 넘김 효과를 넣었습니다'); close(); } if (e.target.id === 'trClose') close(); };
  m.querySelector('#trTurn').oninput = e => { pg.vturn = Number(e.target.value); $('#trTv').textContent = pg.vturn + '초'; renderTimeline(); }; m.querySelector('#trTurn').onchange = () => commit();
}
async function relinkMedia(ref) { if (!NC.media.isLocal(ref)) return; const id = ref.slice(2), m = (doc.media || {})[id]; try { const r = await NC.media.file(id, true); if (r.url) { mediaMissing.delete(id); toast('원본을 읽을 수 있게 됐습니다'); renderCanvas(); renderTimeline(); return; } if (!window.confirm(`이 PC에 원본 "${m ? m.name : ''}"이(가) 연결되어 있지 않습니다. 이 PC의 파일을 골라 다시 연결할까요?`)) return; await NC.media.relink(id); mediaMissing.delete(id); vEls.clear(); tl.Vkey = ''; toast('원본을 다시 연결했습니다'); renderCanvas(); renderTimeline(); } catch (e) { if (e.name !== 'AbortError') toast(e.message, true); } }
// 미리보기 재생 (첫 장면부터, 또는 지금 쪽부터)
async function openVideoPlayer(fromCur) {
  let d = $('#dlgVplay'); if (d) d.remove();
  d = document.createElement('dialog'); d.id = 'dlgVplay'; d.className = 'nw-dlg vd-dlg';
  d.innerHTML = `<div class="dhead"><h2>영상 미리보기</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody"><div class="vd-stage"><canvas id="vpCv"></canvas><div class="vd-load" id="vpLoad">장면을 준비하는 중…</div></div><div class="vd-ctl"><button class="btn icon" id="vpPlay" title="재생 / 멈춤 (Space)"><svg class="ic"><use href="#i-play"/></svg></button><input type="range" id="vpSeek" min="0" max="1" step="0.01" value="0"><span id="vpTime">0:00 / 0:00</span><button class="btn primary" id="vpSave"><svg class="ic"><use href="#i-video"/></svg>MP4 저장</button></div></div>`;
  document.body.appendChild(d); let P = null, stop = false;
  d.querySelector('[data-close]').onclick = () => d.close(); d.addEventListener('close', () => { stop = true; if (P) P.destroy(); d.remove(); }); d.showModal();
  try {
    const V = await videoBuild(null, (k, n) => { const l = $('#vpLoad'); if (l) l.textContent = `장면을 준비하는 중… ${Math.round(k / Math.max(1, n) * 100)}%`; }, () => stop); if (!V || stop) return;
    const cv = $('#vpCv'); $('#vpLoad').remove(); P = VIDEO.player(cv, V);
    const seek = $('#vpSeek'); seek.max = V.total;
    const ic = () => { $('#vpPlay use').setAttribute('href', P.isPlaying() ? '#i-pause' : '#i-play'); };
    P.onTime = t => { seek.value = t; $('#vpTime').textContent = `${fmtT(t)} / ${fmtT(V.total)}`; ic(); };
    if (fromCur) { const x = VIDEO.timing(doc, videoPages()).list.find(q => q.i >= cur); P.seek(x ? x.t0 : 0); }  /* 타임라인과 같은 시간표 */
    $('#vpPlay').onclick = () => { P.toggle(); ic(); }; seek.oninput = () => P.seek(Number(seek.value));
    d.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); P.toggle(); ic(); } });
    $('#vpSave').onclick = () => { d.close(); openVideoMaker(); };
    P.play(); ic();
  } catch (e) { const l = $('#vpLoad'); if (l) l.textContent = '준비하지 못했습니다: ' + e.message; }
}
// MP4 저장: 편집 내용을 미리 본 뒤 화질을 골라 저장
function openVideoMaker() {
  if (newsMode) setNewsMode(false);
  if (doc.news && !doc.video) doc.video = { dur: 5, trans: 'soft', turn: 1.2, loop: !!doc.news.tv, q: '1080' }; // 소식지: 예전 TV 영상과 같은 기본값
  let d = $('#dlgVideo'); if (d) d.remove();
  const n = videoPages().length, tot = videoTotal();
  const QS = [['720', 'HD 720p', '파일 작음 · 메신저 전송용'], ['1080', 'Full HD 1080p', '기본 · TV·유튜브·SNS'], ['2160', '4K 2160p', '파일 큼 · 대형 TV·보관용']];
  const estMB = (q, fps) => { const o = VIDEO.outSize(doc.w, doc.h, q), bps = Math.min(o.W * o.H > 2100000 ? 45e6 : 16e6, Math.max(5e6, o.W * o.H * fps * 0.15)); return (bps + 192000) * tot / 8 / 1048576; };
  const qBtn = q => { const o = VIDEO.outSize(doc.w, doc.h, q[0]); return `<button type="button" class="vd-qbtn" data-q="${q[0]}" aria-pressed="${(vset().q || '1080') === q[0]}"><b>${q[1]}</b><span>${o.W}×${o.H}</span><small>${q[2]}</small></button>`; };
  d = document.createElement('dialog'); d.id = 'dlgVideo'; d.className = 'nw-dlg vd-dlg';
  d.innerHTML = `<div class="dhead"><h2>MP4 영상 저장</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody">
  <div class="vd-stage"><canvas id="vidCv"></canvas><div class="vd-load" id="vidProg">장면을 준비하는 중…</div></div>
  <div class="vd-ctl"><button class="btn icon" id="vidPlay" title="재생 / 멈춤 (Space)"><svg class="ic"><use href="#i-play"/></svg></button><input type="range" id="vidSeek" min="0" max="${tot}" step="0.01" value="0"><span id="vidTime">0:00 / ${fmtT(tot)}</span><span class="vd-meta">${n}장면${doc.audio ? ' · 음악 «' + esc(doc.audio.name || '') + '»' : ''}</span></div>
  <p class="hint" style="margin:0">위에서 편집한 내용을 끝까지 확인한 뒤 화질을 고르고 <b>영상 만들기</b>를 누르세요. 미리보기는 가볍게 보여 주고, 저장은 고른 화질로 만듭니다. 장면 길이·넘김·음악은 왼쪽 <b>영상</b> 메뉴와 타임라인에서 고칩니다.</p>
  <div class="vd-q" id="vidQ">${QS.map(qBtn).join('')}</div>
  <div class="row" style="align-items:center;gap:12px;flex-wrap:wrap"><label class="f" style="margin:0;flex-direction:row;align-items:center;gap:6px"><span>초당 장면 수</span><select id="vidFps">${[[24, '24fps (영화 느낌)'], [30, '30fps (기본)'], [60, '60fps (부드럽게)']].map(([v, t]) => `<option value="${v}" ${Number(vset().fps || 30) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label><span class="hint" id="vidEst"></span></div>
  <p class="hint" style="margin:0">저장 형식은 <b>MP4 (H.264 영상 + AAC 소리)</b>입니다. 윈도우·맥의 기본 플레이어, TV, 휴대폰, 유튜브·카톡에서 별도 프로그램 없이 소리까지 재생됩니다.</p>
  <div class="row" style="justify-content:space-between;align-items:center"><label class="vd-chk" style="margin:0"><input type="checkbox" id="vidShare" ${localStorage.getItem('naracal-video-share') === '1' ? 'checked' : ''}> 내 드라이브 '결과물' 폴더에도 저장 <small>(최종 결과물만 온라인에)</small></label><span><button class="btn" data-close>닫기</button> <button class="btn primary" id="vidGo"><svg class="ic"><use href="#i-video"/></svg>영상 만들기</button></span></div></div>`;
  document.body.appendChild(d); d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => d.close()); d.showModal();
  $('#vidShare').onchange = e => { try { localStorage.setItem('naracal-video-share', e.target.checked ? '1' : '0'); } catch (err) {} };
  let busy = false, stop = false, P = null, Vp = null;
  d.addEventListener('cancel', e => { if (busy) e.preventDefault(); }); d.addEventListener('close', () => { stop = true; if (P) P.destroy(); d.remove(); });
  const curQ = () => vset().q || '1080', curFps = () => Number(vset().fps || 30);
  const est = () => { const o = VIDEO.outSize(doc.w, doc.h, curQ()), mb = estMB(curQ(), curFps()); $('#vidEst').textContent = `저장 크기 ${o.W}×${o.H} · ${fmtT(tot)} · 파일 약 ${mb < 1 ? '1' : Math.round(mb)}MB`; };
  const setV = (k, v) => { doc.video = Object.assign(vset(), doc.video || {}, { [k]: v }); markDirty(); est(); };
  $('#vidQ').onclick = e => { const b = e.target.closest('[data-q]'); if (!b || busy) return; $$('#vidQ [data-q]').forEach(x => x.setAttribute('aria-pressed', x === b)); setV('q', b.dataset.q); };
  $('#vidFps').onchange = e => setV('fps', Number(e.target.value));
  est();
  // 미리보기 플레이어 (가벼운 720p로 준비 — 편집 내용·소리를 그대로 확인)
  const seek = $('#vidSeek'), ic = () => { const u = $('#vidPlay use'); if (u) u.setAttribute('href', P && P.isPlaying() ? '#i-pause' : '#i-play'); };
  const startPreview = async () => {
    try {
      if (!Vp) { Vp = await videoBuild('720', (k, nn) => { const l = $('#vidProg'); if (l) l.textContent = `장면을 준비하는 중… ${Math.round(k / Math.max(1, nn) * 100)}%`; }, () => stop); if (!Vp || stop) return; }
      P = VIDEO.player($('#vidCv'), Vp); P.onTime = t => { seek.value = t; $('#vidTime').textContent = `${fmtT(t)} / ${fmtT(Vp.total)}`; ic(); };
      $('#vidProg').textContent = '미리보기 — ▶를 누르거나 Space'; P.seek(0); ic();
    } catch (e) { const l = $('#vidProg'); if (l) l.textContent = '미리보기를 준비하지 못했습니다: ' + e.message; }
  };
  $('#vidPlay').onclick = () => { if (busy || !P) return; P.toggle(); ic(); if (P.isPlaying()) $('#vidProg').textContent = ''; };
  seek.oninput = () => { if (P && !busy) P.seek(Number(seek.value)); };
  d.addEventListener('keydown', e => { if (e.code === 'Space' && !busy && P && !(e.target.matches && e.target.matches('input,select,textarea,button'))) { e.preventDefault(); P.toggle(); ic(); } });
  startPreview();
  const go = $('#vidGo');
  go.onclick = async () => {
    if (busy) { stop = true; return; }
    busy = true; stop = false; go.lastChild.textContent = '중지'; const pr = $('#vidProg');
    if (P) { P.destroy(); P = null; ic(); }
    try {
      const Vb = await videoBuild(curQ(), (k, nn) => { pr.textContent = `장면을 준비하는 중… ${Math.round(k / Math.max(1, nn) * 100)}%`; }, () => stop); if (!Vb) throw new Error('중지했습니다');
      // 빠른 방식(WebCodecs + mp4-muxer) 먼저, 안 되면 실제 시간 녹화로
      let res = null, fastErr = null;
      if (VIDEO.canFast()) { try { res = await VIDEO.encode({ V: Vb, fps: curFps(), canvas: $('#vidCv'), cancelled: () => stop, onProgress: (p, T) => { pr.textContent = `영상 만드는 중… ${Math.round(p * 100)}%  (${fmtT(T)} / ${fmtT(Vb.total)})`; seek.value = T; } }); if (!res && stop) { pr.textContent = '중지했습니다'; return; } } catch (e) { fastErr = e; console.warn('빠른 내보내기 실패, 녹화 방식으로', e); } }
      if (!res) { if (fastErr) pr.textContent = '빠른 방식을 쓸 수 없어 실제 시간 녹화로 만듭니다 — 이 창을 가리지 마세요'; res = await VIDEO.record({ V: Vb, fps: curFps(), canvas: $('#vidCv'), cancelled: () => stop, onProgress: (p, T) => { pr.textContent = `녹화 중… ${Math.round(p * 100)}%  (${fmtT(T)} / ${fmtT(Vb.total)})`; seek.value = T; } }); }
      if (!res) { pr.textContent = '중지했습니다'; return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(res.blob); a.download = `${(doc.name || '영상').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 80) || '영상'}${Vb.H > Vb.W ? '_숏츠' : ''}_${Math.min(Vb.W, Vb.H)}p${curFps()}.${res.ext}`;  /* 화질·fps가 보이는 이름 (USB·윈도우에서 안전한 글자만) */ document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      let shared = ''; if ($('#vidShare') && $('#vidShare').checked) { try { if (!(await store.folderReady())) throw new Error('동기화 폴더가 연결되어 있지 않습니다'); shared = await NC.media.saveResult(res.blob, a.download); } catch (err) { toast('결과물 폴더에 저장하지 못했습니다: ' + err.message, true); } }
      const missV = (Vb && Vb.voices && Vb.voices.miss) || []; pr.textContent = `저장했습니다 — ${(res.blob.size / 1048576).toFixed(1)}MB · ${res.note || res.warn || ''}${shared ? ` · 내 드라이브/결과물/${shared}` : ''}${missV.length ? ` · ⚠ 빠진 소리: ${missV.join(', ')}` : ''}`; if (res.warn) toast(res.warn, true); else if (missV.length) toast(`영상을 저장했습니다 — 단, 소리 ${missV.length}개가 빠졌습니다(원본 없음)`, true); else toast('영상을 저장했습니다');
    } catch (e) { pr.textContent = e.message; } finally { busy = false; if (document.body.contains(go)) { go.lastChild.textContent = '영상 만들기'; if (Vp && !stop) { const msg = $('#vidProg').textContent; P = VIDEO.player($('#vidCv'), Vp); P.onTime = t => { seek.value = t; $('#vidTime').textContent = `${fmtT(t)} / ${fmtT(Vp.total)}`; ic(); }; P.seek(0); $('#vidProg').textContent = msg; } } }
  };
}
const RAIL = [['pages', '페이지', 'i-pages'], ['tpl', '템플릿', 'i-tpl'], ['news', '소식지', 'i-news'], ['video', '영상', 'i-video'], ['elems', '요소', 'i-elems'], ['text', '텍스트', 'i-text'], ['photo', '사진', 'i-img'], ['upload', '업로드', 'i-upload'], ['project', '프로젝트', 'i-folder'], ['ai', 'AI 도구', 'i-ai'], ['bg', '배경', 'i-bg'], ['theme', '테마', 'i-theme'], ['chart', '차트', 'i-chart'], ['layers', '레이어', 'i-layers']];
function renderRail() { $('#rail').innerHTML = RAIL.map(([k, t, ic]) => `<button data-tab="${k}" aria-selected="${sideTab === k}" title="${t}"><svg class="ic"><use href="#${ic}"/></svg><span>${t}</span></button>`).join(''); $$('#rail button').forEach(b => b.onclick = () => { sideTab = b.dataset.tab; if (sideTab !== 'news' && newsMode) setNewsMode(false); renderRail(); renderSide(); if (sideTab === 'video') { if (!tlOn()) tlShow(true); } else if (tlOn() && tlOnlyVideo) { if (tl.playing) tlPause(); tlShow(false); } }); }
function tmpSheet(w, h, els, bg) { const tmp = Object.assign({}, doc, { w, h, bleed: 0, cropMarks: false }); const saved = doc; doc = tmp; try { return sheetHTML({ id: 'tmp', bg: bg || '#ffffff', els }, 'thumb'); } finally { doc = saved; } }
function fitBoxes(root, sel_, maxH) { root.querySelectorAll(sel_).forEach(bx => { const w = Number(bx.dataset.w), h = Number(bx.dataset.h), n = Number(bx.dataset.n) || 1; const bw = bx.clientWidth; if (!bw) return; const k = Math.min(bw / (w * MM * n + (n - 1) * 4), (maxH || 110) / (h * MM)); const total = w * MM * k * n + (n - 1) * 4; bx.querySelectorAll(':scope > .sheet').forEach((sh, i) => { sh.style.transform = `scale(${k})`; sh.style.left = ((bw - total) / 2 + i * (w * MM * k + 4)) + 'px'; }); bx.style.height = (h * MM * k) + 'px'; }); }
function renderSide() {
  const body = $('#sidebody'); const yearNow = doc.calendar.year || 2027;
  $('#sideTitle').textContent = (RAIL.find(r => r[0] === sideTab) || [])[1] || '';
  body.onclick = null; body.oninput = null; body.onchange = null;
  if (sideTab === 'pages') {
    body.innerHTML = `<div class="row" style="margin-bottom:8px"><button class="btn sm" id="pgAdd">+ 새 페이지</button><button class="btn sm" id="pgDup">복제</button><button class="btn sm icon" id="pgUp" title="위로">↑</button><button class="btn sm icon" id="pgDown" title="아래로">↓</button><button class="btn sm danger" id="pgDel">삭제</button><button class="btn sm" id="pgGrid" title="모든 쪽을 한눈에 (여러 쪽 고르기·끌어서 순서 바꾸기)">모아 보기</button></div><div id="thumbs"></div>`;
    renderThumbs();
    $('#thumbs').onclick = e => { const b = e.target.closest('.thumb'); if (b) goto(Number(b.dataset.i)); };
    $('#pgGrid').onclick = openPageGrid;
    $('#pgAdd').onclick = () => { doc.pages.splice(cur + 1, 0, newPage(page().bg)); commit(); goto(cur + 1); };
    $('#pgDup').onclick = () => { const n = clone(page()); n.id = uid(); const gmap = {}; n.els.forEach(e => { e.id = uid(); if (e.group) { gmap[e.group] = gmap[e.group] || uid(); e.group = gmap[e.group]; } }); doc.pages.splice(cur + 1, 0, n); commit(); goto(cur + 1); };
    $('#pgDel').onclick = () => { if (doc.pages.length === 1) { toast('마지막 페이지는 지울 수 없습니다', true); return; } if (!window.confirm(`${cur + 1}쪽을 지울까요?`)) return; doc.pages.splice(cur, 1); commit(); goto(Math.min(cur, doc.pages.length - 1)); };
    $('#pgUp').onclick = () => { if (cur === 0) return; [doc.pages[cur - 1], doc.pages[cur]] = [doc.pages[cur], doc.pages[cur - 1]]; commit(); goto(cur - 1); };
    $('#pgDown').onclick = () => { if (cur >= doc.pages.length - 1) return; [doc.pages[cur + 1], doc.pages[cur]] = [doc.pages[cur], doc.pages[cur + 1]]; commit(); goto(cur + 1); };
  } else if (sideTab === 'news') {
    renderNewsSide(body);
  } else if (sideTab === 'video') {
    if (videoNeedsGate()) { body.innerHTML = `<div class="wz-card"><b style="font-size:14px">영상 편집은 영상용 사본에서</b><p class="hint" style="margin:6px 0 10px">타임라인에서 장면을 지우거나 자르면 이 디자인의 쪽이 함께 바뀝니다. 원본은 그대로 두고 "${esc(doc.name || '디자인')} 영상" 사본을 만들어 편집하세요.</p><button class="btn primary full" id="vgOpen">영상용 사본 만들기</button><button class="btn full" id="vgDirect2" style="margin-top:6px">이 디자인에서 바로 편집 (원본이 바뀜)</button></div>`; $('#vgOpen').onclick = () => makeVideoCopy(); $('#vgDirect2').onclick = () => openVideoGate(); return; }
    renderVideoSide(body);
    if (doc.video && doc.video.isCopy) body.insertAdjacentHTML('afterbegin', `<div class="vg-badge">영상용 사본 · 원본: <b>${esc(doc.video.fromName || '')}</b> (원본 디자인은 바뀌지 않습니다) <button class="btn sm" id="vgReimport">원본 장면 다시 가져오기</button></div>`), ($('#vgReimport').onclick = reimportFromSource);
  } else if (sideTab === 'tpl') {
    const filt = tplFiltered();
    body.innerHTML = `${filt ? tplNavHTML() : ''}<div class="wz-card" ${filt ? 'hidden' : ''}><div class="wz-year">${yearNow}<small>년</small></div><p class="hint" style="margin:0 0 8px">연도별 달력 모양과 테마를 미리 보며 표지·인성·달력 26쪽을 한 번에 만듭니다.</p><button class="btn primary full" id="wzOpen"><svg class="ic"><use href="#i-cal"/></svg>캘린더 마법사 열기</button>${window.NARACAL_VPLAN ? `<button class="btn full" id="wzVirtue" style="margin-top:6px" title="나라차 인성덕목 2년 계획(메인 프로그램과 같은 내용)의 덕목·명언·실천·사자성어를 12달에 넣습니다. 그림은 그대로 둡니다.">📖 ${yearNow}년 인성 문구 넣기 · ${window.NARACAL_VTRACK(yearNow) === '극기' ? '1년차 극기' : '2년차 홍익'}</button>` : ''}</div>
    <h3 ${filt ? 'hidden' : ''}>템플릿 갤러리 <small id="tcount"></small></h3>
    <label class="f"><input type="text" id="tplSearch" placeholder="템플릿 검색 (예: 가을 모집 포스터, 유아, 카페 오픈)" value="${esc(tplQ)}"></label>
    <div class="facets">${[['format', '제작 형태'], ['season', '계절'], ['age', '연령'], ['occasion', '상황'], ['biz', '직종']].map(([k, t]) => `<select data-facet="${k}"><option value="">${t}: 전체</option>${NC.tpl.facets[k].map(v => `<option value="${esc(v)}" ${tplF[k] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`).join('')}</div><div class="tcats" id="tplcats">${NC.tpl.cats.map(([k, t]) => `<button data-tcat="${k}" class="${tplCat === k ? 'on' : ''}">${t}</button>`).join('')}<button data-tcat="holiday" class="${tplCat === 'holiday' ? 'on' : ''}">명절·휴일 휴관</button></div>
    <div class="tgal" id="tgal"></div>
    <h3>문서 크기</h3>
    <label class="f"><select id="docSize">${SIZES.map(s => `<option value="${s[0]}" ${s[2] === doc.w && s[3] === doc.h ? 'selected' : ''}>${s[1]}</option>`).join('')}<option value="custom">직접 입력</option></select></label>
    <div class="grid2"><label class="f"><span>가로(mm)</span><input type="number" id="docW" value="${doc.w}" step="0.5"></label><label class="f"><span>세로(mm)</span><input type="number" id="docH" value="${doc.h}" step="0.5"></label></div>
    <button class="btn full" id="docSizeApply">크기 적용 (모든 페이지)</button><button class="btn full" id="docResize" style="margin-top:6px">크기 조정… (내용 맞춰 배치 · 다른 크기로 사본)</button>`;
    $('#wzOpen').onclick = () => openWizard(yearNow);
    if ($('#wzVirtue')) $('#wzVirtue').onclick = () => {   /* [나라차 R4.505] 인성덕목 2년 계획 문구를 연도에 맞게 */
      const tr = window.NARACAL_VTRACK(yearNow), P = (window.NARACAL_VPLAN || {})[tr]; if (!P || !doc.calendar.months) return;
      if (!confirm(`${yearNow}년은 ${tr === '극기' ? '1년차 극기(나의 가치)' : '2년차 홍익(우리·모두의 가치)'}입니다.\n12달의 덕목·영문·명언·실천 2가지·사자성어를 나라차 인성덕목 2년 계획으로 바꿉니다.\n(그림·일정·디자인은 그대로 — 덕목이 바뀐 달은 그림을 새로 넣어 주세요)`)) return;
      let n = 0; P.forEach((x, k) => { if (doc.calendar.months[k]) n += applyMonthContent(k, x); });
      commit(); rerender(); alert(`인성 문구를 넣었습니다 (글 상자 ${n}곳 갱신).`);
    };
    renderGallery();
    body.querySelectorAll('[data-facet]').forEach(sl => sl.onchange = () => tplGo(() => { tplF[sl.dataset.facet] = sl.value; }));
    $('#tplcats').onclick = e => { const b = e.target.closest('[data-tcat]'); if (!b || b.dataset.tcat === tplCat) return; tplGo(() => { tplCat = b.dataset.tcat; }); };
    const nav = $('#tplNav'); if (nav) nav.onclick = e => { if (e.target.closest('#tplBack')) { tplBackBtn(); return; } if (e.target.closest('#tplHome')) { tplGo(() => { tplCat = 'all'; tplQ = ''; tplF = { format: '', season: '', age: '', occasion: '', biz: '' }; }); return; } const x = e.target.closest('[data-tx]'); if (x) tplGo(() => { const k = x.dataset.tx; if (k === 'cat') tplCat = 'all'; else if (k === 'q') tplQ = ''; else tplF[k] = ''; }); };
    let tq; imeSafe($('#tplSearch'), e => { if (!tplQ.trim() && e.target.value.trim()) tplPush(); tplQ = e.target.value; clearTimeout(tq); tq = setTimeout(() => { if ($('#tplSearch') && $('#tplSearch')._comp) return; if (!!tplQ.trim() !== !!$('#tplNav')) { const pos = e.target.selectionStart; renderSide(); const n = $('#tplSearch'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } else renderGallery(); }, 250); });
    $('#docSize').onchange = e => { const s = SIZES.find(x => x[0] === e.target.value); if (s) { $('#docW').value = s[2]; $('#docH').value = s[3]; } };
    $('#docSizeApply').onclick = () => { const w = Number($('#docW').value), h = Number($('#docH').value); if (!(w > 10 && h > 10)) return; const nd = resizedDoc({ w: doc.w, h: doc.h, pages: doc.pages }, w, h, 'fit'); doc.pages = nd.pages; doc.w = w; doc.h = h; doc.fmt = (SIZES.find(x => x[2] === w && x[3] === h) || [''])[0] === 'desk' ? 'desk-cal' : ''; commit(); zoom = 0; renderAll(); toast('문서 크기를 바꾸고 내용을 맞춰 배치했습니다 (Ctrl+Z로 되돌리기)'); };
    $('#docResize').onclick = openResize;
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
    ${mine.length ? `<h3>내 이미지 (${mine.length})</h3><div class="picker">${mine.map(k => `<button data-img="a:${k}" draggable="true"><img src="${doc.assets[k]}" alt="" draggable="false"></button>`).join('')}</div>` : ''}
    ${libPhotoHTML()}
    ${groups.map(([t, f]) => { const ks = Object.keys(ASSETS).filter(f); return `<h3>${t}</h3><div class="picker">${ks.map(k => `<button data-img="asset:${k}" title="${k}" draggable="true"><img src="${ASSETS[k]}" alt="${k}" draggable="false"></button>`).join('')}</div>`; }).join('')}`;
    body.onclick = async e => {
      const pc = e.target.closest('[data-pcat]'); if (pc) { photoCat = pc.dataset.pcat; renderSide(); return; }
      const b = e.target.closest('[data-img],[data-libimg]'); if (!b) return;
      const ref = b.dataset.libimg ? await libInsert(b.dataset.libimg) : b.dataset.img; if (!ref) return;
      const s = selEls(); if (s.length === 1 && s[0].type === 'image') { s[0].src = ref; commit(); rerender(); toast('그림을 바꿨습니다'); } else addImage(ref);
    };
    const ps = $('#photoSearch'); if (ps) imeSafe(ps, () => { photoQ = ps.value; const pos = ps.selectionStart; renderSide(); const n = $('#photoSearch'); n.focus(); n.setSelectionRange(pos, pos); });
    $('#imgFile').onchange = async e => { for (const f of e.target.files) addImage(addAsset(await fileToDataURL(f))); e.target.value = ''; renderSide(); };
    $('#imgAI').onclick = () => openAI('image');
  } else if (sideTab === 'upload') {
    const mine = Object.keys(doc.assets);
    body.innerHTML = `<div class="tile"><label><svg class="ic" style="width:22px;height:22px"><use href="#i-upload"/></svg>이미지 올리기<input type="file" accept="image/*" id="upImg" hidden multiple></label><label><svg class="ic" style="width:22px;height:22px"><use href="#i-font"/></svg>글꼴 올리기<input type="file" accept=".ttf,.otf,.woff,.woff2" id="upFont" hidden></label></div>
    <p class="hint">올린 이미지와 글꼴은 이 문서 파일 안에 함께 저장됩니다. 사진은 JPG, 투명 배경은 PNG를 권합니다.</p>
    <h3>내 이미지 (${mine.length})</h3>${mine.length ? `<div class="picker">${mine.map(k => `<button data-img="a:${k}" title="누르면 추가 · 끌어서 원하는 자리나 그림 위에 놓기 · 우클릭 삭제" data-del="${k}" draggable="true"><img src="${doc.assets[k]}" alt="" draggable="false"></button>`).join('')}</div>` : '<p class="hint">아직 없습니다.</p>'}
    <h3>내 글꼴 (${doc.fonts.length})</h3>${doc.fonts.length ? `<ul class="list">${doc.fonts.map((f, i) => `<li><span style="font-family:'${esc(f.family)}'">${esc(f.family)}</span><button class="x" data-delfont="${i}">×</button></li>`).join('')}</ul>` : '<p class="hint">아직 없습니다.</p>'}`;
    $('#upImg').onchange = async e => { for (const f of e.target.files) addImage(addAsset(await fileToDataURL(f))); e.target.value = ''; renderSide(); };
    $('#upFont').onchange = async e => { const f = e.target.files[0]; if (!f) return; const data = await fileToDataURL(f); const family = f.name.replace(/\.(ttf|otf|woff2?)$/i, ''); try { const ff = new FontFace(family, `url(${data})`); await ff.load(); document.fonts.add(ff); doc.fonts.push({ family, data }); commit(); markDirty(); renderSide(); toast(`글꼴 "${family}"을 추가했습니다`); } catch (err) { toast('글꼴을 읽지 못했습니다', true); } };
    body.onclick = e => { const b = e.target.closest('[data-img]'); if (b) addImage(b.dataset.img); const d = e.target.closest('[data-delfont]'); if (d) { doc.fonts.splice(Number(d.dataset.delfont), 1); commit(); markDirty(); renderSide(); } };
    body.oncontextmenu = e => { const b = e.target.closest('[data-del]'); if (!b) return; e.preventDefault(); if (window.confirm('이 이미지를 보관함에서 지울까요? (페이지에 쓰인 곳은 비워집니다)')) { delete doc.assets[b.dataset.del]; commit(); markDirty(); renderAll(); } };
  } else if (sideTab === 'project') {
    const st = store.state;
    body.innerHTML = `<h3>문서</h3>${F('문서 이름', 'doc.name', doc.name)}
    <div class="grid2">${F('도련(mm)', 'doc.bleed', doc.bleed, { type: 'number', min: 0, max: 10, step: 0.5 })}${F('재단선', 'doc.cropMarks', doc.cropMarks, { type: 'check' })}</div>
    <label class="chk"><input type="checkbox" id="guideToggle" ${showGuides() ? 'checked' : ''}> 인쇄 안내선 보기 (빨강: 도련, 파랑: 안전 여백 ${SAFE}mm)</label>
    <p class="hint">${docSizeLabel()} · ${doc.pages.length}쪽 · 크기는 템플릿 탭 아래에서 바꿉니다.</p>
    <h3>저장 · 동기화</h3>
    <p class="hint">${st.dir && st.handle ? `동기화 폴더 <b>${esc(st.dirName)}</b>의 <b>${esc(st.fileName)}</b>에 자동 저장 중 · 설정값도 함께 동기화` : st.handle ? `파일 <b>${esc(st.fileName)}</b>에 자동 저장 중` : '브라우저에만 자동 저장 중 (여러 PC에서 쓰려면 "저장·동기화"에서 구글 드라이브 폴더 연결)'}</p>
    <div class="tile"><button data-pj="save"><svg class="ic" style="width:22px;height:22px"><use href="#i-save"/></svg>저장·동기화</button><button data-pj="open"><svg class="ic" style="width:22px;height:22px"><use href="#i-open"/></svg>열기</button><button data-pj="new"><svg class="ic" style="width:22px;height:22px"><use href="#i-new"/></svg>새 문서</button><button data-pj="down"><svg class="ic" style="width:22px;height:22px"><use href="#i-upload"/></svg>사본 내려받기</button></div>
    <h3>내보내기</h3><div class="tile"><button data-pj="pdf"><svg class="ic" style="width:22px;height:22px"><use href="#i-pdf"/></svg>PDF</button><button data-pj="png"><svg class="ic" style="width:22px;height:22px"><use href="#i-img"/></svg>현재 쪽 PNG</button></div>
    <h3>공휴일</h3><p class="hint">${Object.keys(doc.holidays).length ? '적용 연도: ' + Object.keys(doc.holidays).sort().map(y => `${y}년(${doc.holidays[y].length})`).join(', ') : '아직 없습니다.'}</p><button class="btn sm" data-pj="hol">공휴일 가져오기·편집</button>
    <h3>반복 일정 규칙</h3><button class="btn sm" data-pj="rules">규칙 편집</button>`;
    body.onclick = e => { const b = e.target.closest('[data-pj]'); if (!b) return; const k = b.dataset.pj; if (k === 'save') openSaveDialog(); if (k === 'open') $('#btnOpen').click(); if (k === 'new') $('#btnNew').click(); if (k === 'down') { gcAssets(); store.download(doc); } if (k === 'pdf') openDownload('pdfhq'); if (k === 'png') openDownload('png'); if (k === 'hol') openHoliday(); if (k === 'rules') openRules(); };
    body.oninput = e => { const t = e.target, k = t.dataset.k; if (!k) return; const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value; doc[k.slice(4)] = v; if (k === 'doc.name') $('#pname').value = v; markDirty(); };
  } else if (sideTab === 'ai') {
    body.innerHTML = `<p class="hint">${chatMode() ? '지금 쓰는 채팅 요금제(Claude·Gemini·ChatGPT)로 씁니다 — 지시문을 복사해 채팅에 붙여 넣고, 받은 답·그림을 공방에 붙여 넣습니다. 방식은 "AI 설정"에서 바꿉니다.' : 'Claude가 문구와 이미지 프롬프트를 만들고, Gemini가 삽화를 그립니다. API 키는 "AI 설정"에 넣습니다.'}</p>
    <div class="tile"><button data-ai="content"><svg class="ic" style="width:22px;height:22px"><use href="#i-ai"/></svg>인성 문구 제안</button><button data-ai="image"><svg class="ic" style="width:22px;height:22px"><use href="#i-img"/></svg>AI 이미지 생성</button><button data-ai="keys"><svg class="ic" style="width:22px;height:22px"><use href="#i-help"/></svg>AI 설정</button><button data-racha><span style="font-size:20px">🐧</span>라차 동작 만들기</button><button data-ai="edit"><svg class="ic" style="width:22px;height:22px"><use href="#i-elems"/></svg>이미지 편집기</button></div>
    <h3>이미지 편집기</h3><p class="hint">선택한 이미지의 배경을 색으로 지정해 지우고(스포이트·허용 범위·부드러운 가장자리), 지우개·복원 브러시로 세밀하게 다듬고, 자를 수 있습니다.</p>`;
    body.onclick = e => { if (e.target.closest('[data-racha]')) { openRachaMaker(); return; } const b = e.target.closest('[data-ai]'); if (!b) return; if (b.dataset.ai === 'edit') { const el = selEls()[0]; if (el && el.type === 'image' && src(el.src)) openImgEditor(el); else toast('먼저 이미지 요소를 선택하세요', true); } else openAI(b.dataset.ai); };
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
    body.innerHTML = `<h3>${cur + 1}쪽 레이어 (${els.length}) · 위가 앞</h3><div>${els.map(el => `<div class="layer ${sel.includes(el.id) ? 'active' : ''}" data-id="${el.id}" draggable="true" title="끌어서 순서 바꾸기 · 이름을 두 번 눌러 바꾸기"><i class="ltype">${({ text: '가', image: '▣', shape: '◆', path: '〰', cal: '▦', mini: '▤', chart: '▥' })[el.type] || '•'}</i><span>${esc(elName(el))}${el.group ? ' <small style="color:#888">(그룹)</small>' : ''}</span><button data-vis="${el.id}" class="${el.hidden ? '' : 'on'}" title="보이기">${el.hidden ? '○' : '◉'}</button><button data-lock="${el.id}" class="${el.locked ? 'on' : ''}" title="잠금">${el.locked ? '🔒' : '🔓'}</button></div>`).join('') || '<p class="hint">요소가 없습니다</p>'}</div>`;
    body.onclick = e => { const v = e.target.closest('[data-vis]'); if (v) { const el = find(v.dataset.vis); el.hidden = !el.hidden; commit(); rerender(); renderSide(); return; } const l = e.target.closest('[data-lock]'); if (l) { const el = find(l.dataset.lock); el.locked = !el.locked; commit(); renderOverlay(); renderSide(); return; } const row = e.target.closest('.layer'); if (row) { const id = row.dataset.id; select(e.shiftKey || e.metaKey || e.ctrlKey ? (sel.includes(id) ? sel.filter(x => x !== id) : sel.concat(id)) : [id]); } };
  }
}
/* ---- 요소 패널 ---- */
function elemCard(it) { const els = it.make(uid, { year: doc.calendar.year || 2027 }); return `<button class="ecard" data-el="${it.id}" title="${esc(it.name)}"><div class="ebox" data-w="${it.w}" data-h="${it.h}">${tmpSheet(it.w, it.h, els, it.dark ? '#002559' : it.cat === 'icon' || it.cat === 'illust' || it.cat === 'naracha' ? 'transparent' : '#ffffff')}</div>${it.cat === 'icon' ? '' : `<span>${esc(it.name)}</span>`}</button>`; }
const LIB_ECATS = [['brand', '로고 · 심볼'], ['logo', '로고 (자료실)'], ['emblem', '엠블럼·패치'], ['mascot', '마스코트 라차'], ['mine-el', '내 요소'], ['cartoon', '태권도 캐릭터 (만화)'], ['ai-char', 'AI 캐릭터·사람'], ['ai-sticker', 'AI 스티커'], ['ai-scene', 'AI 배경·장면'], ['ai-photo', 'AI 사진'], ['ai-coloring', 'AI 색칠 도안'], ['ai-icon', 'AI 아이콘'], ['ai-mascot', 'AI 라차'], ['aiimg', 'AI로 만든 그림'], ['pose', '태권도 포즈 (사진)'], ['pair', '겨루기 · 두 사람'], ['silhouette', '동작 실루엣'], ['illust', '태권도 일러스트'], ['belt', '띠·라벨'], ['pattern', '패턴·장식']];
// 프로그램에 들어 있는 나라차 로고·심볼 (자료실이 없어도 늘 맨 위에)
const BRAND_ELS = [['brand-horizontal', '가로 로고'], ['brand-horizontal-navy', '가로 로고 (남색)'], ['brand-horizontal-white', '가로 로고 (흰색)'], ['brand-horizontal-mono', '가로 로고 (한 색)'], ['brand-korean', '한글 로고'], ['brand-korean-navy', '한글 로고 (남색)'], ['brand-korean-white', '한글 로고 (흰색)'], ['brand-since', 'Since 2002 로고'], ['brand-since-white', 'Since 2002 (흰색)'], ['brand-hex', '육각 심볼'], ['brand-symbol-gray', '심볼 (회색)'], ['logo-wordmark-white', '워드마크 (흰색)']];
const brandAR = {};
function brandItems() {
  return BRAND_ELS.filter(([k]) => ASSETS[k]).map(([k, name]) => {
    if (brandAR[k] == null) { brandAR[k] = LOGO_AR[k.replace(/-(white|navy|mono)$/, '')] || 0; const im = new Image(); im.onload = () => { const was = brandAR[k]; brandAR[k] = im.naturalWidth / im.naturalHeight; if (Math.abs(was - brandAR[k]) > 0.05 && sideTab === 'elems') renderElems(); }; im.src = src('asset:' + k); }
    const ar = brandAR[k] || 1, w = ar >= 1 ? 60 : Math.round(60 * ar), h = ar >= 1 ? Math.round(60 / ar) : 60;
    return { id: 'brand-' + k, cat: 'naracha', sub: 'brand', name, kw: '나라차 로고 심볼 브랜드 ' + name, w, h, dark: /white/.test(k), make: (uid) => [{ id: uid(), type: 'image', src: 'asset:' + k, x: 0, y: 0, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '나라차 ' + name }] };
  });
}
function libElemItems() {
  return brandItems().concat(libElemItems0());
}
function libElemItems0() {
  return NC.lib.items('element').map(it => { const w = it.ratio >= 1 ? 60 : Math.round(60 * it.ratio), h = it.ratio >= 1 ? Math.round(60 / it.ratio) : 60;
    return { id: 'lib-' + it.id, cat: 'naracha', sub: it.cat, name: it.name, kw: '나라차 자료실 ' + it.kw, w: Math.max(w, 4), h: Math.max(h, 4), dark: it.dark, lib: it,
      make: (uid) => [{ id: uid(), type: 'image', src: 'lib:' + it.file, x: 0, y: 0, w: Math.max(w, 4), h: Math.max(h, 4), rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: it.name }] }; });
}
const rachaBtn = '<div class="row" style="margin:4px 0 2px"><button class="btn sm ai" data-racha>🐧 라차 동작 한 번에 만들기</button></div>';
function libHint(short) { const st = NC.lib.st; const msg = store.state.dir ? (st.error === 'none' ? '동기화 폴더에 "디자인자료" 폴더가 없습니다.' : st.ready ? '' : '나라차 자료실을 불러오는 중…') : '저장·동기화에서 구글 드라이브 폴더를 연결하면 나라차 로고·마스코트·사진·템플릿(나라차 자료실)이 여기에 나옵니다.'; return msg ? `<p class="hint">${short ? '<b>나라차 자료실</b> · ' : ''}${msg}</p>` : ''; }
function getElem(id) { return NC.elems.get(id) || libElemItems().find(x => x.id === id); }
async function insertElem(id) { const it = getElem(id); if (!it) return; let els = it.make(uid, { year: doc.calendar.year || 2027 }); if (it.lib) { setStatus('자료실에서 불러오는 중…'); try { els = await NC.lib.materialize(els, addAsset); } catch (e) { toast('자료실 파일을 읽지 못했습니다: ' + e.message, true); return; } finally { setStatus(''); } } addEls(els, it.id); }
// 내 요소 추가: PNG·SVG·JPG를 자료실 '내 그림'에 보관 (동기화 폴더라 두 PC 모두에서 요소로 보임)
async function addMyElements() {
  const files = await new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = 'image/png,image/svg+xml,image/jpeg,image/webp'; i.onchange = () => res([...i.files]); i.click(); }); if (!files.length) return;
  if (!(await store.folderReady())) { for (const f of files) { const d = await fileToDataURL(f); addImage(addAsset(d)); } toast('동기화 폴더가 연결되어 있지 않아 이 문서에만 넣었습니다. 연결하면 요소로 보관됩니다.', true); return; }
  let n = 0; for (const f of files) { try { const d = await fileToDataURL(f); await NC.lib.saveMine(d, { name: f.name.replace(/\.[^.]+$/, ''), kw: '내 요소 ' + f.name, cat: 'mine-el' }); n++; } catch (e) { toast(`${f.name}: ${e.message}`, true); } }
  if (n) { elCat = 'naracha'; renderElems(); toast(`내 요소 ${n}개를 추가했습니다 — 요소 → 나라차 → 내 요소`); }
}
function renderElems() {
  { const si = $('#elSearch'); if (si && si._comp) { if (!si._pend) { si._pend = true; si.addEventListener('compositionend', () => { si._pend = false; setTimeout(() => { if (sideTab === 'elems') renderElems(); }, 0); }, { once: true }); } return; } }
  const si0 = $('#elSearch'), hadF = !!si0 && document.activeElement === si0, caret = hadF ? si0.selectionStart : 0;  // 다시 그려도 검색창 입력이 끊기지 않게
  const body = $('#sidebody'); const q = elQ.trim().toLowerCase();
  const libEls = libElemItems(); const cats = NC.elems.cats.slice(0, 1).concat([['naracha', '나라차']], NC.elems.cats.slice(1));
  const qw = q.split(/\s+/).filter(Boolean), pool = libEls.concat(NC.elems.items), txtOf = i => (i.name + ' ' + i.kw).toLowerCase(); let all = pool.filter(i => qw.every(w => txtOf(i).includes(w))); if (!all.length && qw.length > 1) { const hits = i => qw.filter(w => txtOf(i).includes(w)).length; all = pool.filter(i => hits(i) > 0).sort((a, b) => hits(b) - hits(a)); }  // 모든 낱말이 맞는 것이 없으면 맞는 낱말이 많은 순
  const recent = recentElems().map(getElem).filter(Boolean);
  let h = `<div class="row" style="gap:6px;margin-bottom:6px"><label class="f" style="flex:1;margin:0"><input type="text" id="elSearch" placeholder="요소 검색 (예: 로고, 라차, 별, 말풍선)" value="${esc(elQ)}"></label><button class="btn sm" data-addmine title="내 PC의 PNG·SVG·JPG를 요소로 추가 (자료실에 보관돼 두 PC 모두에서 보임)">＋ 내 요소</button></div><div class="tcats" id="elcats">${cats.map(([k, t]) => `<button data-ec="${k}" class="${elCat === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  if (elCat === 'naracha' && !q) {
    h += libEls.length ? `<div class="row" style="margin:4px 0 2px;flex-wrap:wrap;gap:6px"><button class="btn sm primary" data-addmine>＋ 내 요소 추가</button><button class="btn sm ai" data-aistudio>✨ AI로 태권도 그림 만들기</button><button class="btn sm ai" data-racha>🐧 라차 동작 한 번에 만들기</button></div><p class="hint">사진 포즈는 배경을 지운 사람만 들어갑니다. 실루엣은 이미지 속성의 "색 입히기"로 색을 바꿀 수 있습니다. AI로 만든 그림은 우클릭으로 이름 바꾸기·삭제를 합니다.</p>` + LIB_ECATS.map(([k, t]) => { const list = libEls.filter(i => i.sub === k); return list.length ? `<h3>${t} <small>${list.length}</small></h3><div class="egrid">${list.map(elemCard).join('')}</div>` : (k === 'mine-el' ? `<h3>내 요소</h3><p class="hint">위의 <b>＋ 내 요소 추가</b>로 PNG·SVG를 올리면 여기에 모입니다 (자료실에 보관되어 두 PC 모두에서 보임).</p>` : ''); }).join('') + (NC.lib.ready ? '' : rachaBtn + libHint()) : rachaBtn + libHint();
  } else if (elCat === 'all' && !q) {
    if (recent.length) h += `<h3>최근 사용</h3><div class="egrid">${recent.map(elemCard).join('')}</div>`;
    h += libEls.length ? `<div class="esec"><h3>나라차 자료실 <small>${libEls.length}</small></h3><button class="more" data-ec="naracha">더보기 ›</button></div><div class="egrid">${['brand', 'cartoon', 'pose', 'illust', 'mascot', 'silhouette'].flatMap(k => libEls.filter(i => i.sub === k).slice(0, k === 'brand' ? 3 : k === 'cartoon' ? 2 : 1)).slice(0, 9).map(elemCard).join('')}</div>` : rachaBtn + libHint(true);
    NC.elems.cats.slice(1).forEach(([k, t]) => { const list = all.filter(i => i.cat === k); if (!list.length) return; h += `<div class="esec"><h3>${t} <small>${list.length}</small></h3><button class="more" data-ec="${k}">더보기 ›</button></div><div class="egrid ${k === 'icon' ? 'icons' : ''}">${list.slice(0, k === 'icon' ? 16 : 6).map(elemCard).join('')}</div>`; });
  } else {
    const list = all.filter(i => elCat === 'all' || i.cat === elCat);
    h += `<p class="hint" style="margin:4px 0">${list.length}개</p><div class="egrid ${elCat === 'icon' ? 'icons' : ''}">${list.map(elemCard).join('') || '<p class="hint">맞는 요소가 없습니다</p>'}</div>`;
  }
  h += `<p class="hint" style="margin-top:12px">요소를 누르면 페이지 가운데에 들어갑니다. 여러 조각으로 된 요소는 자동으로 그룹이 되어 함께 움직입니다 (Ctrl+G로 그룹 해제·묶기).</p>`;
  body.innerHTML = h;
  requestAnimationFrame(() => fitBoxes(body, '.ebox', 64));
  body.onclick = e => { if (e.target.closest('[data-addmine]')) { addMyElements(); return; } if (e.target.closest('[data-aistudio]')) { openAI('image'); return; } if (e.target.closest('[data-racha]')) { openRachaMaker(); return; } const c = e.target.closest('[data-ec]'); if (c) { elCat = c.dataset.ec; renderElems(); return; } const b = e.target.closest('[data-el]'); if (b) insertElem(b.dataset.el); };
  // 내 그림(AI로 만든 그림): 우클릭으로 이름 바꾸기·지우기
  body.oncontextmenu = async e => { const b = e.target.closest('[data-el^="lib-ai-"]'); if (!b) return; e.preventDefault(); const it = getElem(b.dataset.el); if (!it) return;
    const nm = window.prompt(`"${it.name}"\n\n새 이름을 넣으면 이름을 바꿉니다. "삭제"라고 쓰면 내 그림에서 지웁니다 (두 PC 모두에서 사라짐).`, it.name); if (nm == null) return;
    try { if (nm.trim() === '삭제') { await NC.lib.removeMine(it.lib.id); toast('내 그림에서 지웠습니다'); } else if (nm.trim()) { await NC.lib.renameMine(it.lib.id, nm.trim()); toast('이름을 바꿨습니다'); } renderElems(); } catch (err) { toast(err.message, true); } };
  let tq; imeSafe($('#elSearch'), e => { elQ = e.target.value; clearTimeout(tq); tq = setTimeout(() => { if ($('#elSearch') && $('#elSearch')._comp) return; renderElems(); const i = $('#elSearch'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
  if (hadF) { const i = $('#elSearch'); if (i) { i.focus(); try { i.setSelectionRange(caret, caret); } catch (e) {} } }
}
function elName(el) { if (el.name) return el.name; if (el.type === 'text') return (el.text || '글자').split('\n')[0].slice(0, 20); if (el.type === 'image') return '이미지'; if (el.type === 'shape') return (FX.SHAPES.find(s => s[0] === el.kind) || [])[1] || '도형'; if (el.type === 'path') return el.d ? '벡터 모양' : '펜 선'; if (el.type === 'video') return '동영상'; if (el.type === 'chart') return '차트'; if (el.type === 'cal') return `${el.year}년 ${el.month}월 달력`; if (el.type === 'mini') return `미니 달력 ${el.month}월`; return el.type; }

/* ---- 사진: 나라차 자료실 ---- */
let photoCat = '', photoQ = '';
function libPhotoHTML() {
  const ph = NC.lib.items('photo'); if (!ph.length) return libHint(true);
  const cats = [...new Set(ph.map(x => x.cat))];
  const q = photoQ.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = ph.filter(x => (!photoCat || x.cat === photoCat) && (!q.length || q.every(w => (x.name + ' ' + x.kw).toLowerCase().includes(w))));
  const card = x => `<button data-libimg="${esc(x.file)}" title="${esc(x.name)}" draggable="true"><img src="${NC.lib.url(x.thumb)}" alt="${esc(x.name)}" loading="lazy" draggable="false"></button>`;
  let h = `<h3>나라차 자료실 사진 <small>${ph.length}</small></h3><label class="f"><input type="text" id="photoSearch" placeholder="사진 검색 (예: 겨루기, 아이, 도장)" value="${esc(photoQ)}"></label>
  <div class="tcats"><button data-pcat="" class="${photoCat ? '' : 'on'}">전체</button>${cats.map(c => `<button data-pcat="${esc(c)}" class="${photoCat === c ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>`;
  if (!photoCat && !q.length) cats.forEach(c => { const l = list.filter(x => x.cat === c); h += `<div class="esec"><h3>${esc(c)} <small>${l.length}</small></h3><button class="more" data-pcat="${esc(c)}">더보기 ›</button></div><div class="picker photos">${l.slice(0, 6).map(card).join('')}</div>`; });
  else h += `<p class="hint" style="margin:4px 0">${list.length}장</p><div class="picker photos">${list.map(card).join('') || '<p class="hint">맞는 사진이 없습니다</p>'}</div>`;
  return h + '<p class="hint">사진을 누르면 원본 크기(최대 2400px)로 문서에 들어갑니다. 게티이미지 사진은 도장 홍보물에만 쓰세요.</p>';
}

/* ---- 템플릿 로고 자동 배치: 나라차태권도 템플릿에 로고를 디자이너 규칙으로 넣음 ----
   ① 도장 이름만 적힌 글자 → 로고 (위아래 여유가 있으면 한글 로고, 없으면 가로 로고)
   ② '나라차태권도 · 연락처' 줄 → 연락처만 남기고 로고는 ③에서
   ③ 로고가 없는 쪽 → 다른 요소와 겹치지 않는 빈 모서리에 (어린이·칭찬은 라차 로고, 상장은 육각 엠블럼)
   ④ 상장의 '(인)' 옆 → 육각 엠블럼을 직인처럼
   로고는 배경 없는 판을 쓰고, 그 자리 바탕색에 따라 원래 색 / 흰색(빨간 점 유지) / 전부 흰색을 고름 */
const NAME_ONLY = /^(나라차\s*태권도|NARACHA(\s+TAEKWONDO)?)$/i, NAME_LEAD = /^나라차\s*태권도\s*[·|,]\s*/;
const isLogoRef = s => /^asset:(brand-|logo-wordmark|backcover-logo|footer-wordmark)|^lib:brand\//.test(s || '');
const LOGO_AR = { 'brand-horizontal': 5.19, 'brand-korean': 1.98, 'brand-hex': 0.867, 'backcover-logo': 0.957 };
function logoRef(base, bg) { return NC.logoFor ? NC.logoFor(base, bg) : 'asset:' + base; }
function elExtent(e) { // 요소가 실제로 차지하는 범위 (글 상자는 글자 폭으로)
  if (e.type !== 'text' || e.vertical) return { x: e.x, y: e.y, w: e.w, h: e.h };
  const tw = Math.min(e.w, textWidthMM(e)), lines = String(e.text || '').split('\n').length, th = Math.min(e.h, lines * e.size * 0.3528 * (e.lh || 1.3) * 1.05);
  const x = e.align === 'center' ? e.x + (e.w - tw) / 2 : e.align === 'right' ? e.x + e.w - tw : e.x, y = e.valign === 'middle' ? e.y + (e.h - th) / 2 : e.valign === 'bottom' ? e.y + e.h - th : e.y;
  return { x, y, w: tw, h: th };
}
const bgLike = (e, W, H) => e.locked || (e.type === 'shape' && (e.w >= W * 0.85 || e.h >= H * 0.85 || e.w * e.h >= W * H * 0.3)) || (e.type === 'image' && !isLogoRef(e.src) && e.w * e.h >= W * H * 0.45);
function collides(pg, b, skip, W, H, pad = 1.5) { return pg.els.some(e => { if (e.hidden || skip.includes(e)) return false;
  if (bgLike(e, W, H)) { if (e.type !== 'shape' || e.w >= W * 0.98 && e.h >= H * 0.98) return false; const inside = b.x >= e.x + pad && b.y >= e.y + pad && b.x + b.w <= e.x + e.w - pad && b.y + b.h <= e.y + e.h - pad, outside = b.x + b.w <= e.x || b.x >= e.x + e.w || b.y + b.h <= e.y || b.y >= e.y + e.h; return !(inside || outside); } /* 큰 바탕 상자: 가장자리에 걸치지 않게 */ const r = elExtent(e); return b.x - pad < r.x + r.w && b.x + b.w + pad > r.x && b.y - pad < r.y + r.h && b.y + b.h + pad > r.y; }); }
function colorUnder(pg, b, skip) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  for (let i = pg.els.length - 1; i >= 0; i--) { const e = pg.els[i]; if (e === skip || e.hidden || e.type === 'text' || isLogoRef(e.src)) continue; if (cx < e.x || cx > e.x + e.w || cy < e.y || cy > e.y + e.h) continue;
    if (e.type === 'shape' && !['line', 'arrow'].includes(e.kind) && /^#[0-9a-f]{6}$/i.test(e.fill || '') && (e.opacity == null || e.opacity > 0.6)) return e.fill;
    if (e.type === 'image' && e.w * e.h > b.w * b.h * 3) return null; }
  return /^#[0-9a-f]{6}$/i.test(pg.bg || '') ? pg.bg : '#ffffff';
}
function brandize(pages, W, H, t) {
  if (!Array.isArray(pages) || t.theme || t.lib || t.holiday || (t.tags && t.tags.biz && !/태권/.test(t.tags.biz))) return pages;  /* 헬스·유치원 등 다른 업종 템플릿엔 나라차 로고를 붙이지 않음 */
  const txt = (t.name || '') + ' ' + (t.kw || ''), kid = /유아|어린이|칭찬|생일|스티커|키즈|아이/.test(txt) || (t.tags && t.tags.age === '유아'), cert = t.cat === 'cert';
  const mk = (src, b) => ({ id: uid(), type: 'image', src, x: r1(b.x), y: r1(b.y), w: r1(b.w), h: r1(b.h), rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '로고' });
  pages.forEach(pg => {
    let has = false;
    pg.els.forEach(e => { if (e.type === 'image' && isLogoRef(e.src)) { has = true; if (e.src === 'asset:logo-wordmark') { const bg = colorUnder(pg, e, e); if (bg && NC.lum && NC.lum(bg) < 0.62) e.src = 'asset:logo-wordmark-white'; } } });
    // ① 도장 이름 글자 → 로고
    pg.els.slice().forEach(e => {
      if (has || e.type !== 'text' || e.html || !NAME_ONLY.test(String(e.text || '').trim())) return; // 이미 로고가 있으면 이름 글자는 그대로 (로고 두 개는 군더더기)
      const sz = e.size * 0.3528, ext = elExtent(e), cy = ext.y + ext.h / 2, bg = colorUnder(pg, ext, e);
      const ax = lw => e.align === 'left' ? e.x : e.align === 'right' ? e.x + e.w - lw : e.x + (e.w - lw) / 2;
      // 로고가 제 역할을 하는 최소 크기: 한글 로고 짧은 변의 7%, 가로 로고 4.5% (겹치면 작은 판으로 물러남)
      const mn = Math.min(W, H), mg = Math.max(SAFE, mn * 0.04);
      const place = (base, lh) => { const lw = lh * LOGO_AR[base]; let x = ax(lw), y = cy - lh / 2; x = clamp(x, mg, W - mg - lw); y = clamp(y, mg, H - mg - lh); return { base, b: { x, y, w: lw, h: lh } }; };
      const cands = [place('brand-korean', Math.max(sz * 2.4, mn * 0.07)), place('brand-horizontal', Math.max(sz * 1.5, mn * 0.045)), place('brand-horizontal', Math.max(sz * 1.5, 3.5))];
      const pick = cands.find(c => c.b.w <= W - 2 * mg && !collides(pg, c.b, [e], W, H, 0.8)) || cands[cands.length - 1];
      pg.els.splice(pg.els.indexOf(e), 1, mk(logoRef(pick.base, bg), pick.b)); has = true;
    });
    // ② 이름이 섞인 연락처 줄
    pg.els.forEach(e => { if (e.type === 'text' && !e.html && NAME_LEAD.test(e.text || '')) e.text = e.text.replace(NAME_LEAD, ''); });
    // ③ 빈 모서리에 로고
    if (!has && Math.min(W, H) >= 70) {
      const base = cert ? 'brand-hex' : kid ? 'backcover-logo' : 'brand-horizontal', ar = LOGO_AR[base], wide = W / H > 2;
      const lh0 = base === 'brand-horizontal' ? (wide ? H * 0.12 : Math.min(Math.max(W * 0.26, 20), 130) / ar) : Math.min(W, H) * (cert ? 0.15 : 0.17);
      const m = Math.max(SAFE + 2, Math.min(W, H) * 0.055), order = cert ? ['tc', 'br', 'bl'] : kid ? ['br', 'bl', 'tr', 'tl'] : wide ? ['tr', 'br', 'tl', 'bl', 'tc', 'bc'] : ['tl', 'tr', 'bc', 'br', 'bl', 'tc'];
      // 빈 자리가 없으면 크기를 줄여 가며 다시 찾음 (현수막처럼 로고가 꼭 있어야 하는 곳)
      outer: for (const f of [1, 0.8, 0.64, 0.5]) { const lh = lh0 * f, lw = lh * ar, S = { tl: [m, m], tr: [W - m - lw, m], tc: [(W - lw) / 2, m], bl: [m, H - m - lh], br: [W - m - lw, H - m - lh], bc: [(W - lw) / 2, H - m - lh] };
        for (const k of order) { const b = { x: S[k][0], y: S[k][1], w: lw, h: lh }; if (collides(pg, b, [], W, H)) continue; const bg = colorUnder(pg, b, null); pg.els.push(mk(base === 'brand-horizontal' ? logoRef(base, bg) : 'asset:' + base, b)); has = true; break outer; } }
    }
    // ④ 상장 직인
    if (cert) pg.els.filter(e => e.type === 'text' && /\(인\)/.test(e.text || '')).forEach(e => { const ext = elExtent(e), s = Math.max(e.size * 0.3528 * 3.2, 12), b = { x: ext.x + ext.w - s * 0.55, y: ext.y + ext.h / 2 - s * 0.55, w: s * 0.867, h: s }; const st = mk('asset:brand-hex', b); st.opacity = 0.92; st.name = '직인 엠블럼'; pg.els.push(st); });
  });
  return pages;
}

/* ---- 템플릿 패널 이동 기록: 들어갈 때마다 남기고 '‹ 뒤로'·브라우저 뒤로로 한 단계씩 돌아감 ---- */
let tplHist = [];
const TPLF0 = () => ({ format: '', season: '', age: '', occasion: '', biz: '' });
function tplFiltered() { return tplCat !== 'all' || !!tplQ.trim() || Object.values(tplF).some(Boolean); }
function tplPush() { tplHist.push({ c: tplCat, f: Object.assign({}, tplF), q: tplQ, sc: ($('#sidebody') || {}).scrollTop || 0 }); if (tplHist.length > 40) tplHist.shift(); try { history.pushState({ ncPanel: tplHist.length }, ''); } catch (e) {} }
function tplGo(mut) { tplPush(); mut(); renderSide(); const b = $('#sidebody'); if (b) b.scrollTop = 0; }
function tplBack() { const h = tplHist.pop(); if (!h) { if (tplFiltered()) { tplCat = 'all'; tplQ = ''; tplF = TPLF0(); if (sideTab === 'tpl') renderSide(); } return; } tplCat = h.c; tplF = h.f; tplQ = h.q; if (sideTab === 'tpl') { renderSide(); requestAnimationFrame(() => { const b = $('#sidebody'); if (b) b.scrollTop = h.sc; }); } }
function tplBackBtn() { if (tplHist.length && history.state && history.state.ncPanel) history.back(); else tplBack(); } // 기록이 있으면 브라우저 기록과 함께 한 단계
window.addEventListener('popstate', () => { if (tplHist.length) tplBack(); });
document.addEventListener('keydown', e => { if (e.altKey && e.key === 'ArrowLeft' && sideTab === 'tpl' && tplFiltered() && !editing && !(e.target.matches && e.target.matches('input,textarea,select,[contenteditable="true"]'))) { e.preventDefault(); tplBackBtn(); } });
function tplNavHTML() {
  const cats = Object.fromEntries(NC.tpl.cats.concat([['holiday', '명절·휴일 휴관']]));
  const chips = []; if (tplCat !== 'all') chips.push(['cat', cats[tplCat] || tplCat]); if (tplQ.trim()) chips.push(['q', `"${tplQ.trim()}"`]); Object.entries(tplF).forEach(([k, v]) => { if (v) chips.push([k, v]); });
  const title = chips.length ? chips.map(c => c[1]).join(' · ') : '전체';
  return `<div class="tnav" id="tplNav"><div class="tnav-top"><button class="btn sm" id="tplBack" title="이전 화면으로 (Alt+← · 마우스 뒤로 단추)">‹ 뒤로</button><b class="tnav-t">${esc(title)}</b><button class="lnk" id="tplHome">템플릿 홈</button></div>${chips.length > 1 ? `<div class="tchips">${chips.map(([k, t]) => `<button data-tx="${k}" title="이 조건 지우기">${esc(t)} ×</button>`).join('')}</div>` : ''}</div>`;
}
/* ---- 템플릿 갤러리 ---- */
function tplItems() {
  const y = doc.calendar.year || 2027;
  const themeItems = CAL.THEMES.map(th => ({ id: 'theme-' + th.id, cat: 'calendar', theme: th, name: th.name + ' 캘린더', desc: th.desc, w: 224, h: 154, build: () => { const saved = doc; const tmp = Object.assign({}, doc, { calendar: Object.assign(clone(doc.calendar), { theme: clone(th) }) }); doc = tmp; try { return CAL.buildPages(tmp, uid, { year: y, kind: 'virtue', month: 1 }).concat(CAL.buildPages(tmp, uid, { year: y, kind: 'cal', month: 1 })); } finally { doc = saved; } } }));
  const calItems = [['cal-cover', '캘린더 표지', () => CAL.buildPages(doc, uid, { year: y, kind: 'cover' })], ['cal-virtue', '인성 페이지 (1월)', () => CAL.buildPages(doc, uid, { year: y, kind: 'virtue', month: 1 })], ['cal-month', '달력 페이지 (1월)', () => CAL.buildPages(doc, uid, { year: y, kind: 'cal', month: 1 })], ['cal-back', '캘린더 뒷표지', () => CAL.buildPages(doc, uid, { year: y, kind: 'back' })]].map(([id, name, build]) => ({ id, cat: 'calpage', name, w: 224, h: 154, build }));
  const items = themeItems.concat(calItems, NC.tpl.list.map(t => ({ id: t.id, cat: t.cat, name: t.name, w: t.w, h: t.h, tags: t.tags, kw: t.kw || t.name, responsive: t.responsive, holiday: t.holiday, build: sz => brandize(t.responsive && sz ? t.build(uid, sz) : t.build(uid, t.pal || null, { year: y }), sz ? sz.w : t.w, sz ? sz.h : t.h, t) })));
  // 나라차 자료실 템플릿 (동기화 폴더의 디자인자료)
  const fresh = pg => Object.assign(clone(pg), { id: uid(), els: pg.els.map(e => Object.assign(clone(e), { id: uid() })) });
  NC.lib.templates().forEach(t => items.unshift({ id: t.id, cat: t.cat, name: t.name, w: t.w, h: t.h, tags: t.tags, kw: t.kw, lib: true, build: () => t.pages.map(fresh) }));
  themeItems.concat(calItems).forEach(t => { t.tags = { format: '달력', season: '사계절', age: '전체', occasion: '안내', biz: '태권도장' }; t.kw = t.name + ' 달력 캘린더 ' + (t.desc || ''); });
  const q = (tplQ || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tplCat === 'holiday') { const order = NC.tpl.nextHolidays ? NC.tpl.nextHolidays() : []; const rank = t => { const i = order.indexOf(t.holiday); return i < 0 ? 99 : i; }; items.sort((a, b) => (a.holiday ? 0 : 1) - (b.holiday ? 0 : 1) || rank(a) - rank(b)); }
  return items.filter(t => (tplCat === 'all' || (tplCat === 'holiday' ? !!t.holiday : t.cat === tplCat)) && Object.keys(tplF).every(k => !tplF[k] || (t.tags && t.tags[k] === tplF[k])) && (!q.length || q.every(w => (t.name + ' ' + (t.kw || '')).toLowerCase().includes(w))));
}
function tplSheet(t, pages) { const tmp = Object.assign({}, doc, { w: t.w, h: t.h, bleed: 0, cropMarks: false }); const saved = doc; doc = tmp; try { return sheetHTML(pages[0], 'thumb'); } finally { doc = saved; } }
function recentTpls() { try { return JSON.parse(localStorage.getItem('naracal-recent-tpls') || '[]'); } catch (e) { return []; } }
function noteRecentTpl(id) { const r = recentTpls().filter(x => x !== id); r.unshift(id); try { localStorage.setItem('naracal-recent-tpls', JSON.stringify(r.slice(0, 8))); } catch (e) {} }
let galObs = null;
function tplCard(t) { const two = !!t.theme; return `<button class="tcard lazy ${two ? 'two' : ''}" data-tid="${t.id}" title="${esc(t.name)}"><div class="tbox" data-w="${t.w}" data-h="${t.h}" data-n="${two ? 2 : 1}"></div><span>${esc(t.name)}</span><small>${t.theme ? esc(t.desc) : (t.w >= 1000 ? (t.w / 10) + '×' + (t.h / 10) + 'cm' : isScreenSize(t.w, t.h) ? Math.round(t.w * 96 / 25.4) + '×' + Math.round(t.h * 96 / 25.4) + 'px' : Math.round(t.w) + '×' + Math.round(t.h) + 'mm')}</small></button>`; }
function fillCard(card, t) { if (!card.classList.contains('lazy')) return; card.classList.remove('lazy'); const pages = t.build(); const two = t.theme && pages.length > 1; const bx = card.querySelector('.tbox'); bx.innerHTML = tplSheet(t, pages) + (two ? tplSheet(t, pages.slice(1)) : ''); fitBoxes(card, '.tbox', 110); }
function renderGallery() {
  const g = $('#tgal'); if (!g) return; const items = tplItems(); const tc = $('#tcount'); if (tc) tc.textContent = `${items.length}개`;
  const filtered = tplCat !== 'all' || tplQ.trim() || Object.values(tplF).some(Boolean);
  const byId = {}; items.forEach(t => byId[t.id] = t);
  let h = '';
  if (!filtered) {
    const rec = recentTpls().map(id => byId[id]).filter(Boolean);
    const sNow = NC.tpl.seasonNow(); const seasonal = items.filter(t => t.tags.season === sNow).slice(0, 6);
    const nextH = (NC.tpl.nextHolidays ? NC.tpl.nextHolidays() : []).slice(0, 2); const holOrder = NC.tpl.nextHolidays ? NC.tpl.nextHolidays() : [];
    const rows = [['최근 사용', rec, null], [`다가오는 휴일 휴관 카드${nextH.length ? ' · ' + nextH.map(k => k === '크리스마스' ? '성탄절' : k).join('·') : ''}`, items.filter(t => t.holiday && nextH.includes(t.holiday)).sort((a, b) => nextH.indexOf(a.holiday) - nextH.indexOf(b.holiday)), { occasion: '휴관' }], ['나라차 브랜드', items.filter(t => t.lib), null], [`${sNow} 추천`, seasonal, { season: sNow }], ['달력 테마', items.filter(t => t.theme), null, 'calendar'], ['모집·홍보', items.filter(t => t.tags.occasion === '모집').slice(0, 6), { occasion: '모집' }], ['행사·축하', items.filter(t => ['행사', '축하', '심사·대회'].includes(t.tags.occasion)).slice(0, 6), { occasion: '행사' }], ['명절·인사·감사', items.filter(t => ['명절·인사', '감사'].includes(t.tags.occasion)).slice(0, 6), { occasion: '명절·인사' }], ['다른 직종', items.filter(t => t.tags.biz !== '태권도장').slice(0, 6), { biz: '학원' }], ['SNS·카드뉴스', items.filter(t => ['SNS', '카드뉴스'].includes(t.tags.format)).slice(0, 6), { format: 'SNS' }], ['포스터', items.filter(t => t.tags.format === '포스터').slice(0, 6), { format: '포스터' }], ['안내문·서식', items.filter(t => ['안내문', '서식·활동지'].includes(t.tags.format)).slice(0, 6), { format: '안내문' }]];
    rows.forEach(([title, list, facet, cat]) => { if (!list.length) return; h += `<div class="esec"><h3>${title} <small>${list.length}</small></h3><button class="more" ${facet ? `data-more='${JSON.stringify(facet)}'` : cat ? `data-morecat="${cat}"` : ''}>${facet || cat ? '더보기 ›' : ''}</button></div><div class="tgal-row">${list.map(tplCard).join('')}</div>`; });
    g.innerHTML = h;
  } else {
    g.innerHTML = `<div class="tgal-grid">${items.map(tplCard).join('') || '<p class="hint">맞는 템플릿이 없습니다. 검색어를 줄이거나 필터를 초기화해 보세요.</p>'}</div>`;
  }
  if (galObs) galObs.disconnect();
  galObs = new IntersectionObserver(ents => { ents.forEach(en => { if (en.isIntersecting) { const t = byId[en.target.dataset.tid]; if (t) fillCard(en.target, t); galObs.unobserve(en.target); } }); }, { root: $('#sidebody'), rootMargin: '200px' });
  g.querySelectorAll('.tcard.lazy').forEach(c => galObs.observe(c));
  g.onclick = e => { const m = e.target.closest('[data-more]'); if (m) { const f = JSON.parse(m.dataset.more); tplGo(() => { if (f.occasion === '휴관') tplCat = 'holiday'; else Object.assign(tplF, f); }); return; } const mc = e.target.closest('[data-morecat]'); if (mc) { tplGo(() => { tplCat = mc.dataset.morecat; }); return; } const b = e.target.closest('[data-tid]'); if (b) openTplPreview(byId[b.dataset.tid]); };
}
// 템플릿을 원하는 크기로: 반응형 템플릿(자동 생성·명절 카드)은 그 크기로 새로 짜고, 나머지는 크기 조정 규칙으로 맞춤
const isScreenSize = (w, h, fmt) => { const f = FORMATS.find(x => x[0] === fmt); if (f) return f[5] === 'px'; return w > 150 && Math.abs(w * 96 / 25.4 - Math.round(w * 96 / 25.4)) < 0.05 && Math.abs(h * 96 / 25.4 - Math.round(h * 96 / 25.4)) < 0.05; };
function tplPagesFor(t, S) {
  if (t.theme) return t.build();
  if (t.responsive) return t.build({ w: S.w, h: S.h, screen: S.screen });
  const pages = t.build(); if (Math.abs(t.w - S.w) < 0.5 && Math.abs(t.h - S.h) < 0.5) return pages;
  return resizedDoc({ w: t.w, h: t.h, pages }, S.w, S.h, 'fit').pages;
}
function openTplPreview(t) {
  noteRecentTpl(t.id);
  let d = $('#dlgTpl'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgTpl'; d.innerHTML = `<div class="dhead"><h2 id="tplTitle"></h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="tplBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  const hasCal = doc.pages.some(p => p.kind), empty = !page().els.length;
  const docS = { w: doc.w, h: doc.h, screen: isScreenSize(doc.w, doc.h, doc.fmt), fmt: doc.fmt || '' }, origS = { w: t.w, h: t.h, screen: isScreenSize(t.w, t.h) };
  const sameDocSize = Math.abs(t.w - doc.w) < 0.5 && Math.abs(t.h - doc.h) < 0.5;
  let choice = t.theme ? 'orig' : (empty || sameDocSize ? 'doc' : 'orig'); // 빈 쪽이면 지금 문서 크기에 맞춰 보여 줌
  const sizeOf = v => { if (v === 'doc') return docS; if (v === 'orig') return origS; const f = FORMATS.find(x => x[0] === v); const [w, h] = fmtMM(f); return { w, h, screen: f[5] === 'px', fmt: v }; };
  const label = S => S.w >= 1000 || S.h >= 1000 ? `${Math.round(S.w / 10)}×${Math.round(S.h / 10)}cm` : S.screen ? `${Math.round(S.w * 96 / 25.4)}×${Math.round(S.h * 96 / 25.4)}px` : `${Math.round(S.w)}×${Math.round(S.h)}mm`;
  const draw = () => {
    const S = sizeOf(choice); const pages = tplPagesFor(t, S); const n = pages.length > 1 && t.theme ? 2 : 1;
    $('#tplTitle').innerHTML = `${esc(t.name)} <small>${t.theme ? esc(t.desc) : label(S) + ' · ' + pages.length + '쪽'}</small>`;
    $('#tplBody').innerHTML = `<div class="tprev" id="tprev" data-w="${S.w}" data-h="${S.h}" data-n="${n}">${pages.slice(0, n).map(pg => tplSheet(Object.assign({}, t, { w: S.w, h: S.h }), [pg])).join('')}</div>
    ${t.theme ? '' : `<div class="row tsize"><label class="f" style="flex:1;margin:0"><span>만들 크기 (문서 형식에 맞춰 다시 배치${t.responsive ? ' · 이 템플릿은 크기마다 새로 짭니다' : ''})</span><select id="tplSize"><option value="doc" ${choice === 'doc' ? 'selected' : ''}>지금 문서 크기 · ${label(docS)}</option><option value="orig" ${choice === 'orig' ? 'selected' : ''}>템플릿 원래 크기 · ${label(origS)}</option>${ND_GROUPS.filter(g => g[0] !== 'rec').map(([g, tt]) => `<optgroup label="${tt}">${FORMATS.filter(f => f[2] === g).map(f => `<option value="${f[0]}" ${choice === f[0] ? 'selected' : ''}>${esc(f[1])} · ${fmtLabel(f)}</option>`).join('')}</optgroup>`).join('')}</select></label></div>`}
    <div class="row" style="margin-top:10px;justify-content:flex-end"><span class="hint" style="margin:0;flex:1">${t.theme ? '테마는 표지·인성·달력·뒷표지 전체 디자인입니다. 이미 만든 캘린더에 적용하면 문구·일정·그림은 그대로 두고 디자인만 바뀝니다.' : t.holiday ? '날짜 칸은 다가오는 휴일(대체 휴일 포함)로 자동으로 채워집니다. 글자·그림·색은 자유롭게 바꿀 수 있습니다.' : '만든 뒤 글자·그림·색을 자유롭게 바꿀 수 있습니다. 로고와 연락처는 도장 정보로 고쳐 주세요.'}</span>
    ${t.theme ? `<button class="btn" id="tplRetheme" ${hasCal ? '' : 'disabled title="현재 문서에 캘린더 페이지가 없습니다"'}>현재 캘린더에 적용</button><button class="btn primary" id="tplWizard">이 테마로 캘린더 만들기</button>` : (choice === 'doc' ? `<button class="btn ${empty ? 'primary' : ''}" id="tplHere">${empty ? '이 쪽에 적용' : '현재 쪽 뒤에 추가'}</button><button class="btn ${empty ? '' : 'primary'}" id="tplNew">이 크기로 새 문서</button>` : `<button class="btn" id="tplHere" title="지금 문서 크기(${label(docS)})에 맞춰 넣습니다">${empty ? '지금 문서에 맞춰 적용' : '지금 문서 뒤에 추가 (문서 크기)'}</button><button class="btn primary" id="tplNew">${label(S)} 새 문서</button>`)}</div>`;
    requestAnimationFrame(() => fitBoxes($('#tplBody'), '.tprev', Math.min(500, window.innerHeight * 0.5)));
    const ss = $('#tplSize'); if (ss) ss.onchange = () => { choice = ss.value; draw(); };
    if (t.theme) { $('#tplWizard').onclick = () => { d.close(); openWizard(doc.calendar.year, t.theme.id); }; const rb = $('#tplRetheme'); if (rb) rb.onclick = () => { doc.calendar.theme = clone(t.theme); const y = doc.calendar.year || 2027; const nrep = CAL.retheme(doc, uid, y); ensureAllHolidays(); commit(); renderAll(); d.close(); toast(`"${t.name}" 테마를 ${nrep}쪽에 적용했습니다`); }; return; }
    const ready = async pgs => { if (!t.lib) return true; try { setStatus('자료실 그림을 넣는 중…'); await NC.lib.materialize(pgs, addAsset); return true; } catch (e) { toast('자료실 파일을 읽지 못했습니다: ' + e.message, true); return false; } finally { setStatus(''); } };
    $('#tplNew').onclick = async () => { if (doc.pages.some(p => p.els.length) && !window.confirm(`현재 문서를 닫고 새 문서를 만들까요? (${keepNote()})`)) return; await keepCurrentDoc(); const pgs = tplPagesFor(t, S); const keepAssets = doc.assets; doc.assets = {}; if (!(await ready(pgs))) { doc.assets = keepAssets; return; } const libAssets = doc.assets; doc.assets = keepAssets; await store.disconnect(); const nd = newDoc(); nd.w = S.w; nd.h = S.h; nd.fmt = S.fmt || ''; nd.name = t.name; nd.pages = pgs; nd.calendar = doc.calendar; nd.holidays = doc.holidays; nd.assets = libAssets; nd.fonts = doc.fonts; nd.rules = doc.rules; if (!S.screen && ['print', 'doc', 'cal', 'sign'].includes((FORMATS.find(f => f[0] === S.fmt) || [])[2])) nd.bleed = 3; doc = nd; hist = []; histMeta = []; hptr = -1; cur = 0; sel = []; $('#pname').value = doc.name; commit(); clearTimeout(fileTimer); setStatus('아직 저장 위치를 고르지 않았습니다 · 저장(Ctrl+S)을 누르면 위치를 고릅니다 (그 전까지는 이 브라우저에 임시 저장)'); zoom = 0; renderAll(); fitCanvas(); updateSaveBadge(); d.close(); toast(`"${t.name}" 문서를 만들었습니다 (${label(S)})`); };
    // 지금 문서에 넣기: 늘 지금 문서 크기로 다시 짜서 넣음. 지금 쪽이 비어 있으면 그 쪽을 바꿈
    $('#tplHere').onclick = async () => { const pg = tplPagesFor(t, docS); if (!(await ready(pg))) return; const emp = !page().els.length; doc.pages.splice(emp ? cur : cur + 1, emp ? 1 : 0, ...pg); const at = emp ? cur : cur + 1; commit(); goto(at); d.close(); toastUndo(emp ? `"${t.name}"을(를) 이 쪽에 적용했습니다` : `${pg.length}쪽을 추가했습니다`); };
  };
  draw(); d.showModal();
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
    const oldName = doc.name, oldW = doc.w, oldH = doc.h; doc.calendar.year = wz.year; doc.calendar.theme = wizardTheme();
    if (wz.mode === 'replace') { if (doc.pages.some(p => p.els.length) && !window.confirm('현재 문서의 페이지를 모두 지우고 새로 만듭니다. 계속할까요?')) return; doc.w = 224; doc.h = 154; doc.bleed = doc.bleed || 3; doc.pages = []; doc.name = `${wz.year} 인성 캘린더`; $('#pname').value = doc.name; }
    const pages = wizardPages(wz.kind); doc.pages.push(...pages); ensureAllHolidays(); commit(); goto(wz.mode === 'replace' ? 0 : doc.pages.length - pages.length);
    $('#dlgWizard').close(); { const nm0 = oldName, w0 = oldW, h0 = oldH; toastUndo(`${wz.year}년 ${pages.length}쪽을 만들었습니다`, () => { doc.name = nm0; doc.w = w0; doc.h = h0; $('#pname').value = nm0; zoom = 0; renderAll(); fitCanvas(); }); }
    if (!doc.holidays[wz.year]) setTimeout(() => openHoliday(wz.year), 400);
  };
  const rt = $('#wzRetheme'); if (rt) rt.onclick = () => { doc.calendar.year = wz.year; doc.calendar.theme = wizardTheme(); const nrep = CAL.retheme(doc, uid, wz.year); ensureAllHolidays(); commit(); renderAll(); $('#dlgWizard').close(); toast(`디자인을 ${nrep}쪽에 적용했습니다 (문구·일정·그림 유지)`); };
}

/* ======================= 속성 패널 ======================= */
const presetsOpen = () => { try { return localStorage.getItem('naracal-presets-open') !== '0'; } catch (e) { return true; } };
// 잠금 풀기·잠그기 (속성 창 단추, 선택 테두리의 잠금 단추 공용)
function setLock(ids, on) { ids.forEach(id => { const el = find(id); if (el) el.locked = on; }); commit(); renderOverlay(); renderInspector(); if (sideTab === 'layers') renderSide(); toast(on ? '잠갔습니다 (Ctrl+L로 풀기)' : '잠금을 풀었습니다'); }
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest && t.closest('#presetFold')) { const open = !presetsOpen(); try { localStorage.setItem('naracal-presets-open', open ? '1' : '0'); } catch (err) {} renderInspector(); return; }
  if (t.closest && t.closest('#elUnlock')) { setLock(sel, false); return; }
  if (t.closest && t.closest('[data-fsz]')) { fszStep(Number(t.closest('[data-fsz]').dataset.fsz)); return; }
  if (t.closest && t.closest('[data-fszdd]')) { fszMenu(t.closest('[data-fszdd]')); return; }
  if (t.closest && t.closest('#elLock')) { const on = !selEls().every(x => x.locked); setLock(sel, on); }
}, true);
/* 글자 크기 (미리캔버스 방식): − / + 는 크기에 맞는 간격으로, ▾ 는 자주 쓰는 크기 목록. 직접 입력은 제한 없음 */
const FSZ = [6, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 120, 144, 180, 240, 300, 400, 500, 700, 1000];
function fszSet(v) { const inp = $('#fszIn'); if (!inp || !(v > 0)) return; inp.value = Math.round(v * 2) / 2; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
function fszStep(dir) { const inp = $('#fszIn'); if (!inp) return; const v = Number(inp.value) || 12; const st = v < 24 ? 1 : v < 72 ? 2 : v < 200 ? 5 : 10; fszSet(dir > 0 ? Math.floor(v / st) * st + st : Math.max(1, Math.ceil(v / st) * st - st)); }
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return;
  const dir = (e.code === 'Period' || e.key === '>') ? 1 : (e.code === 'Comma' || e.key === '<') ? -1 : 0; if (!dir) return;
  if (typeof editing !== 'undefined' && editing) return;
  const ts = selEls().filter(x => x.type === 'text' && !x.locked); if (!ts.length) return;
  e.preventDefault(); e.stopImmediatePropagation();
  ts.forEach(el => { const v = el.size || 12, nv = dir > 0 ? (FSZ.find(n => n > v + 0.01) || Math.round(v * 1.1)) : ([...FSZ].reverse().find(n => n < v - 0.01) || Math.max(1, Math.round(v * 0.9))); scaleTextBy(el, clone(el), nv / v); el.size = nv; if ((!el.valign || el.valign === 'top') && !(el.warp && el.warp !== 'none')) el.h = 1; });
  commit(); renderAll();
}, true);
function fszMenu(btn) {
  $('#fszPop') && $('#fszPop').remove();
  const v = Number(($('#fszIn') || {}).value) || 0, r = btn.getBoundingClientRect();
  const m = document.createElement('div'); m.id = 'fszPop'; m.className = 'fszpop';
  m.innerHTML = FSZ.map(n => `<button type="button" data-n="${n}" class="${n === v ? 'on' : ''}">${n}</button>`).join('');
  m.style.left = Math.min(innerWidth - 110, r.left - 60) + 'px'; m.style.top = Math.min(innerHeight - 300, r.bottom + 4) + 'px';
  document.body.appendChild(m);
  const on = m.querySelector('.on'); if (on) on.scrollIntoView({ block: 'center' });
  const close = () => { m.remove(); document.removeEventListener('pointerdown', out, true); };
  const out = e => { if (!m.contains(e.target)) close(); };
  m.onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; fszSet(Number(b.dataset.n)); close(); };
  setTimeout(() => document.addEventListener('pointerdown', out, true));
}
/* 글자 상자를 k배: 글자 크기와 외곽선·그림자·여백·글자별 크기(span)까지 같은 비율로 */
function scaleTextBy(el, o, k) {
  if (!(k > 0) || !isFinite(k)) return;
  const q = (v, n) => v == null ? v : Math.round(v * k * n) / n;
  el.size = Math.max(1, q(o.size, 10));
  ['strokeW', 'pad', 'shX', 'shY', 'shB', 'd3X', 'd3Y', 'glowB', 'bgR'].forEach(key => { if (typeof o[key] === 'number') el[key] = q(o[key], 100); });
  if (o.html) el.html = o.html.replace(/font-size:\s*([\d.]+)pt/g, (m, v) => `font-size:${Math.round(v * k * 10) / 10}pt`);
}
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
// 빠른 색 줄: 나라차 브랜드 색을 앞에, 그다음 기본 색
const swList = () => { try { return [...new Set(brandColors().concat(SWATCH).map(c => c.toUpperCase()))].slice(0, Math.max(SWATCH.length, 10)); } catch (e) { return SWATCH; } };
const sw = (k, cur_) => `<div class="swrow">${swList().map(c => `<button type="button" class="swb ${String(cur_ || '').toUpperCase() === c ? 'on' : ''}" data-set="${k}:${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>`;
// 글꼴에 실제로 있는 굵기 (모르면 400·700)
function fontWeights(fam) { const f = allFonts().find(x => x.family === fam); return (f && f.weights && f.weights.length) ? f.weights : [400, 700]; }
function nearestWeight(fam, w) { const have = fontWeights(fam); return have.reduce((a, b) => Math.abs(b - w) < Math.abs(a - w) ? b : a, have[0]); }
function fontLabel(fam) { const f = allFonts().find(x => x.family === fam); return f ? f.label : fam; }
const fontPicker = (k, cur_) => `<button type="button" class="fp-btn" data-fp="${k}" data-cur="${esc(cur_)}" style="font-family:'${esc(cur_)}'"><span>${esc(fontLabel(cur_))}</span><i>▾</i></button>`;
let fpState = { cat: 'all', q: '' };
function openFontPop(btn) {
  closeFontPop(); const k = btn.dataset.fp, cur_ = btn.dataset.cur; const pop = document.createElement('div'); pop.id = 'fpPop';
  const cats = [['all', '전체'], ['hot', '인기'], ['title', '제목'], ['brush', '붓'], ['hand', '손글씨'], ['body', '본문'], ['latin', '영문'], ['mine', '내 글꼴']];
  const row = f => `<div class="fp-row ${f.family === cur_ ? 'on' : ''}" data-font="${esc(f.family)}" style="font-family:'${esc(f.family)}'">${f.preview ? `<img class="fpimg" src="${esc(f.preview)}" alt="" loading="lazy">` : '<span class="sm">나라차 태권도 가나다 ABC 123</span>'}<span class="nm">${esc(f.label)}${f.lib ? ' <em class="ftag">자료실</em>' : f.web ? ' <em class="ftag web">인기</em>' : ''}</span></div>`;
  const render = () => {
    const fonts = allFonts(); const rec = recentFonts().map(n => fonts.find(f => f.family === n)).filter(Boolean);
    const list = sortFonts(fonts.filter(f => (fpState.cat === 'all' || (fpState.cat === 'hot' ? f.web || f.lib : f.cat === fpState.cat)) && (!fpState.q || (f.label + f.family).toLowerCase().includes(fpState.q.toLowerCase()))));
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
function applyFontChoice(k, fam) { const els = selEls(); if (!els.length) return; els.forEach(el => { if (k === 'font' ? el.type === 'text' : true) { setK(el, k, fam); if (k === 'font' && el.weight && !fontWeights(fam).includes(Number(el.weight))) el.weight = nearestWeight(fam, Number(el.weight)); } }); noteFont(fam); if (els[0].type === 'text') lastTextStyle = Object.assign({}, lastTextStyle || {}, { font: fam }); commit(); rerender(); }
document.addEventListener('pointerdown', e => { if ($('#fpPop') && !e.target.closest('#fpPop') && !e.target.closest('.fp-btn')) closeFontPop(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#fpPop')) { closeFontPop(); e.stopPropagation(); } }, true);

function renderInspector() {
  if (newsMode) { renderNewsInspector(); return; }
  const ins = $('#inspector'); const els = selEls(); ins.onclick = null;
  if (!els.length) {
    const pg = page();
    ins.innerHTML = `<h2>${cur + 1}쪽 <small>${docSizeLabel()}</small></h2>
    ${F('페이지 이름', 'pg.label', pg.label)}
    <h3>배경</h3><div class="swrow">${['#ffffff', '#FFE89A', '#E6EDF2', '#DDF3EA', '#FDE7E4', '#F0EBFB', '#1E2B5A', '#1a1a1a'].map(c => `<button class="swb" data-pgbg="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>
    <label class="f"><span>직접 고르기</span><input type="color" data-k="pg.bg" value="${/^#[0-9a-f]{6}$/i.test(pg.bg) ? pg.bg : '#ffffff'}"></label>
    <p class="hint">그라데이션·패턴 배경은 왼쪽 "배경" 메뉴에서 고릅니다. 요소를 누르면 그 요소의 속성이 여기에 나옵니다. 빈 곳을 끌면 여러 요소를 함께 고릅니다.</p>
    <h3 class="anim-h"><svg class="ic"><use href="#i-video"/></svg>영상 장면</h3><div class="grid2">${F('보여 주는 시간', 'pg.vdur', pg.vdur || vset().dur, { type: 'slider', min: 1, max: 20, step: 0.5, unit: '초', def: vset().dur })}${F('다음으로 넘김', 'pg.vtrans', pg.vtrans || '', { type: 'select', options: [['', '기본 (' + VIDEO.TRANS.find(t => t[0] === vset().trans)[1] + ')']].concat(VIDEO.TRANS) })}</div><div class="grid2">${F('넘김 길이', 'pg.vturn', pg.vturn || vset().turn, { type: 'slider', min: 0.2, max: 2, step: 0.1, unit: '초', def: vset().turn })}${F('카메라', 'pg.vcam', pg.vcam || '', { type: 'select', options: [['', '없음']].concat(VIDEO.CAMS.slice(1)) })}</div><div class="row" style="gap:6px"><button class="btn sm" id="pgVplay"><svg class="ic"><use href="#i-play"/></svg>이 쪽부터 미리보기</button><button class="btn sm" id="pgVtab">영상 메뉴</button></div>
    <h3>단축키</h3><p class="hint">T 글자 추가 · P 펜 · Ctrl+D 복제 · Ctrl+G 그룹 · Ctrl+Z 취소 · 화살표 이동 · Delete 삭제 · Ctrl+휠 확대</p>`;
    ins.onclick = e => { if (e.target.closest('#pgVplay')) { openVideoPlayer(true); return; } if (e.target.closest('#pgVtab')) { sideTab = 'video'; renderRail(); renderSide(); return; } const b = e.target.closest('[data-pgbg]'); if (b) { pg.bg = b.dataset.pgbg; commit(); rerender(); } };
    return;
  }
  if (els.length > 1) {
    const grouped = els.some(e => e.group); const texts = els.filter(e => e.type === 'text');
    ins.innerHTML = `<h2>${els.length}개 선택${grouped ? ' <small>그룹</small>' : ''}</h2><div class="row"><button class="btn sm" id="mGroup">${grouped ? '그룹 해제' : '그룹으로 묶기'}</button><button class="btn sm" id="mLock">모두 잠금</button><button class="btn sm" id="mUnlock">잠금 해제</button></div>
    <h3>묶음 위치·크기 <small>mm</small></h3><div class="grid4">${(() => { const U9 = unionBox(els), bx = U9.x, by = U9.y, bw = U9.w, bh = U9.h; return F('X', 'grp.x', r1(bx), { type: 'number', step: 0.5 }) + F('Y', 'grp.y', r1(by), { type: 'number', step: 0.5 }) + F('너비', 'grp.w', r1(bw), { type: 'number', step: 0.5 }) + F('높이', 'grp.h', r1(bh), { type: 'number', step: 0.5 }); })()}</div>
    ${F('투명도', 'multi.opacity', els[0].opacity == null ? 1 : els[0].opacity, { type: 'slider', min: 0, max: 1, step: 0.01, pct: true, def: 1 })}
    ${texts.length ? `<h3>글자 ${texts.length}개 한꺼번에</h3><div class="row"><label class="f" style="flex:1;margin:0"><span>글꼴</span>${fontPicker('font', texts[0].font)}</label></div><div class="grid2">${F('크기(pt)', 'multi.size', texts[0].size, { type: 'number', step: 0.5 })}${F('색', 'multi.color', texts[0].color, { type: 'color' })}</div>` : ''}
    <p class="hint">도구 막대의 정렬·간격 균등 버튼으로 맞추고, 끌어서 함께 옮깁니다.</p>`;
    ins.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.fp) { openFontPop(b); return; } if (b.id === 'mGroup') toggleGroup(); if (b.id === 'mLock') { els.forEach(x => x.locked = true); commit(); renderOverlay(); } if (b.id === 'mUnlock') { els.forEach(x => x.locked = false); commit(); renderOverlay(); } };
    return;
  }
  const el = els[0];
  let h = el.type === 'text' ? `<h2 class="phead"><span>스타일 프리셋</span><button class="btn sm icon" id="presetFold" title="스타일 프리셋 ${presetsOpen() ? '접기' : '펴기'}">${presetsOpen() ? '▴' : '▾'}</button></h2>` : `<h2>${esc(elName(el))}</h2>`;
  if (el.locked) h += `<div class="lockbar">🔒 잠긴 요소입니다 — 옮기거나 크기를 바꿀 수 없습니다<button class="btn sm" id="elUnlock">잠금 풀기</button></div>`;
  const geo = `<h3 class="phead"><span>위치·크기</span><button class="btn sm" id="elLock" title="Ctrl+L">${el.locked ? '🔓 잠금 풀기' : '🔒 잠그기'}</button></h3><div class="grid4">${F('X', 'x', el.x, { type: 'number', step: 0.5 })}${F('Y', 'y', el.y, { type: 'number', step: 0.5 })}${F('너비', 'w', el.w, { type: 'number', step: 0.5 })}${F('높이', 'h', el.h, { type: 'number', step: 0.5 })}</div>${['image', 'shape', 'path', 'chart'].includes(el.type) ? F('너비·높이 비율 고정 (숫자로 바꿀 때)', 'ratioLock', el.ratioLock == null ? el.type === 'image' : el.ratioLock, { type: 'check' }) : ''}${F('회전', 'rot', el.rot || 0, { type: 'angle', def: 0 })}${F('투명도', 'opacity', el.opacity == null ? 1 : el.opacity, { type: 'slider', min: 0, max: 1, step: 0.01, pct: true, def: 1 })}${el.type !== 'text' ? F('혼합 모드', 'blend', el.blend || 'normal', { type: 'select', options: [['normal', '보통'], ['multiply', '곱하기'], ['screen', '스크린'], ['overlay', '오버레이'], ['darken', '어둡게'], ['lighten', '밝게'], ['difference', '차이']] }) : ''}${F('이름', 'name', el.name)}`;
  const shadowBlock = (pfx) => `<details class="fx" ${el.shadow ? 'open' : ''}><summary>${F('그림자', 'shadow', el.shadow, { type: 'check' })}</summary>${F('위치 — 점을 끌어 조정', 'shX,shY', [el.shX == null ? 0.6 : el.shX, el.shY == null ? 0.7 : el.shY], { type: 'xy', range: 4, step: 0.1, presets: [['아래', 0, 1], ['오른쪽 아래', 0.8, 0.8], ['왼쪽 아래', -0.8, 0.8], ['위', 0, -1], ['가운데(번짐만)', 0, 0]] })}
    ${F('번짐', 'shB', el.shB == null ? 0.5 : el.shB, { type: 'slider', min: 0, max: 6, step: 0.1, unit: 'mm', def: 0.5 })}${F('진하기', 'shA', el.shA == null ? 0.3 : el.shA, { type: 'slider', min: 0, max: 1, step: 0.01, pct: true, def: 0.3 })}
    ${F('그림자 색', 'shC', el.shC || '#000000', { type: 'color' })}<div class="shq"><span>빠른 설정</span>${[['부드럽게', 0.4, 0.8, 2.2, 0.22], ['또렷하게', 0.6, 0.7, 0.2, 0.45], ['강하게', 1.2, 1.4, 0.6, 0.6], ['떠 있게', 0, 2.2, 3.5, 0.3]].map(([t, x, y, b, a]) => `<button type="button" class="btn sm" data-shq="${x},${y},${b},${a}">${t}</button>`).join('')}</div></details>`;
  const fillBlock = `<div class="seg">${[['solid', '단색'], ['gradient', '그라데이션']].map(([a, t]) => `<button data-set="fillType:${a}" aria-pressed="${(el.fillType || 'solid') === a}">${t}</button>`).join('')}</div>${(el.fillType || 'solid') === 'gradient' ? `<div class="grid3">${F('시작 색', 'g1', el.g1 || '#2f5bea', { type: 'color' })}${F('끝 색', 'g2', el.g2 || '#e0564b', { type: 'color' })}</div>${F('방향', 'gAngle', el.gAngle == null ? 90 : el.gAngle, { type: 'angle', def: 90 })}${el.type === 'shape' || el.type === 'path' ? F('모양', 'gKind', el.gKind || 'linear', { type: 'select', options: [['linear', '직선'], ['radial', '원형']] }) : ''}` : ''}`;
  if (el.type === 'text') {
    h += `<div class="tstyles sm" id="presetGrid" ${presetsOpen() ? '' : 'hidden'}>${FX.TEXT_PRESETS.map(p => `<button data-preset="${p.id}" class="tsb"><span style="${FX.textStyle(Object.assign({}, TEXT_DEF, { font: 'Jua', size: 13, weight: 800, align: 'center' }, p.st))}">${esc(p.name)}</span></button>`).join('')}</div>
    <h3>글자</h3>${el.html && el.htmlFor === el.text ? `<label class="f"><span>내용 <small>부분 서식이 있어 캔버스에서 두 번 눌러 고칩니다</small></span><textarea rows="3" readonly>${esc(el.text)}</textarea></label><button class="btn sm" data-set="html:">부분 서식 지우고 여기서 편집</button>` : F('내용', 'text', el.text, { type: 'textarea', rows: 3 })}
    <div class="row"><label class="f" style="flex:1;margin:0"><span>글꼴</span>${fontPicker('font', el.font)}</label><button class="btn sm" id="fontBrowse" style="margin-top:17px">둘러보기</button></div>
    <div class="fsz"><span>글자 크기</span><div class="fszc"><button type="button" data-fsz="-1" title="작게 (Ctrl+Shift+,)">−</button><input class="num" id="fszIn" data-k="size" type="number" step="0.5" min="1" value="${el.size}" title="크기를 직접 입력 (제한 없음)"><button type="button" class="fszdd" data-fszdd title="자주 쓰는 크기">▾</button><button type="button" data-fsz="1" title="크게 (Ctrl+Shift+.)">+</button><em>pt</em></div></div>
    <div class="tfmt"><button type="button" data-tfi="bold" class="${fmtOn(el, 'bold') ? 'on' : ''}" title="굵게 (Ctrl+B)"><b>B</b></button><button type="button" data-tfi="italic" class="${el.italic ? 'on' : ''}" title="기울임 (Ctrl+I)"><i>I</i></button><button type="button" data-tfi="underline" class="${el.underline ? 'on' : ''}" title="밑줄 (Ctrl+U)"><u>U</u></button><button type="button" data-tfi="strike" class="${el.strike ? 'on' : ''}" title="취소선"><s>S</s></button><button type="button" data-tfi2="upper" class="${el.upper ? 'on' : ''}" title="영문 대문자">AA</button><button type="button" data-tfi2="vertical" class="${el.vertical ? 'on' : ''}" title="세로쓰기">세로</button>
    <select data-k="weight" title="굵기 단계 (이 글꼴에 실제로 있는 굵기만)">${(() => { const have = fontWeights(el.font); return [[100, '아주 가늘게'], [200, '더 가늘게'], [300, '가늘게'], [400, '보통'], [500, '중간'], [600, '약간 굵게'], [700, '굵게'], [800, '아주 굵게'], [900, '최대']].filter(([a]) => have.includes(a) || String(a) === String(el.weight)).map(([a, t]) => `<option value="${a}" ${String(a) === String(el.weight) ? 'selected' : ''}>${t}${have.includes(a) ? '' : ' (가짜 굵게)'}</option>`).join(''); })()}</select></div>
    <p class="hint" style="margin:2px 0 8px">글자를 두 번 눌러 편집하면서 일부만 드래그하면, 위에 뜨는 작은 도구 막대(또는 여기 B·I·U·S)로 <b>고른 글자만</b> 굵게·기울임·밑줄·색·크기를 바꿀 수 있습니다.</p>
    <div class="grid2">${F('줄 간격', 'lh', el.lh, { type: 'slider', min: 0.6, max: 3, step: 0.05, def: 1.35 })}${F('자간', 'ls', el.ls, { type: 'slider', min: -0.2, max: 1, step: 0.01, unit: 'em', def: 0 })}</div>
    <div class="row"><div class="seg" style="flex:1">${[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽'], ['justify', '양쪽']].map(([a, t]) => `<button data-set="align:${a}" aria-pressed="${el.align === a}" title="${t} 정렬">${t}</button>`).join('')}</div><div class="seg" style="flex:1">${[['top', '위'], ['middle', '중앙'], ['bottom', '아래']].map(([a, t]) => `<button data-set="valign:${a}" aria-pressed="${(el.valign || 'top') === a}">${t}</button>`).join('')}</div></div>
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
  } else if (el.type === 'video') {
    const full = Number(el.dur || el.tout || 0), m = (doc.media || {})[String(el.src).slice(2)];
    h += `<h3>동영상</h3><p class="hint" style="margin-top:0">${esc(m ? m.name : el.name || '')} · 원본 ${full.toFixed(1)}초 · <b>이 PC에만 있는 원본</b>(문서에는 이름만 저장)</p>
    <div class="grid2">${F('쓸 구간 시작', 'tin', el.tin || 0, { type: 'slider', min: 0, max: Math.max(0.1, full), step: 0.1, unit: '초', def: 0 })}${F('쓸 구간 끝', 'tout', el.tout || full, { type: 'slider', min: 0.1, max: Math.max(0.1, full), step: 0.1, unit: '초', def: full })}</div>
    <div class="grid2">${F('소리 크기', 'vol', el.vol == null ? 1 : el.vol, { type: 'slider', min: 0, max: 2, step: 0.05, pct: true, def: 1 })}${F('채우기', 'fit', el.fit || 'cover', { type: 'select', options: [['cover', '꽉 채우기(잘림)'], ['contain', '전체 보이기']] })}</div>
    <div class="grid3">${F('소리 끄기', 'mute', !!el.mute, { type: 'check' })}${F('반복', 'loop', !!el.loop, { type: 'check' })}${F('둥근 모서리', 'radius', el.radius || 0, { type: 'number', step: 0.5 })}</div>
    <div class="row" style="gap:6px"><button class="btn sm" id="vFitScene">장면 길이를 구간에 맞추기</button><button class="btn sm" id="vRelink">원본 다시 연결</button></div>` + geo;
  } else if (el.type === 'path' && el.d) {
    h += `<h3>벡터 모양</h3>${fillBlock}${(el.fillType || 'solid') === 'solid' ? `${F('채우기 색', 'fill', el.fill || '#FFE89A', { type: 'color' })}<button class="btn sm" data-set="fill:">채우기 없음</button>` : el.fillType === 'raw' ? '<p class="hint" style="margin:2px 0 8px">원래 그라데이션을 쓰고 있습니다. 단색·그라데이션을 고르면 바뀝니다.</p>' : ''}
    <div class="grid2">${F('선 색', 'stroke', el.stroke || '#000000', { type: 'color' })}${F('선 두께', 'strokeW', el.strokeW || 0, { type: 'slider', min: 0, max: 8, step: 0.1, unit: 'mm', def: 0 })}</div>
    ${shadowBlock()}<p class="hint">소식지 등에서 가져온 벡터 모양입니다. 크게 인쇄해도 선명하며, 크기를 바꾸면 모양이 함께 늘어납니다.</p>` + geo;
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
    <div class="grid4">${F('일요일 색', 's.sunColor', s.sunColor, { type: 'color' })}${F('토요일 색', 's.satColor', s.satColor, { type: 'color' })}${F('날짜 색', 's.dayColor', s.dayColor, { type: 'color' })}${F('공휴일 색', 's.holColor', s.holColor || s.sunColor, { type: 'color' })}</div>
    <div class="grid4">${F('일요일 칸', 's.sunBg', s.sunBg || '#ffffff', { type: 'color' })}${F('안쪽 선', 's.line', s.line, { type: 'color' })}${F('바깥 선', 's.outer', s.outer, { type: 'color' })}${F('메모 색', 's.noteColor', s.noteColor, { type: 'color' })}</div>
    <div class="grid3">${F('안쪽 선 두께', 's.lineW', s.lineW, { type: 'number', step: 0.05, min: 0 })}${F('바깥 선 두께', 's.outerW', s.outerW, { type: 'number', step: 0.05, min: 0 })}${F('칸 여백(mm)', 's.cellPad', s.cellPad, { type: 'number', step: 0.2, min: 0 })}</div>
    <div class="row">${F('요일 줄 보이기', 's.showWd', s.showWd, { type: 'check' })}${F('공휴일 표시', 's.showHol', s.showHol, { type: 'check' })}${F('공휴일 이름', 's.showHolName', s.showHolName, { type: 'check' })}</div><button class="btn sm" data-set="s.sunBg:">일요일 칸 색 없음</button>` + geo;
  } else if (el.type === 'mini') {
    const s = Object.assign({}, CAL.MINI_DEF, el.s || {});
    h += `<h3>미니 달력</h3><div class="grid2">${F('연도', 'year', el.year, { type: 'number' })}${F('월', 'month', el.month, { type: 'select', options: Array.from({ length: 12 }, (_, i) => [i + 1, (i + 1) + '월']) })}</div>
    <div class="grid3">${F('제목 크기', 's.titleSize', s.titleSize, { type: 'number', step: 0.5 })}${F('요일 크기', 's.wdSize', s.wdSize, { type: 'number', step: 0.5 })}${F('숫자 크기', 's.numSize', s.numSize, { type: 'number', step: 0.5 })}</div>
    <div class="grid2">${F('글자 색', 's.color', s.color, { type: 'color' })}${F('일요일 색', 's.sunColor', s.sunColor, { type: 'color' })}</div><div class="grid2">${F('월 제목 보이기', 's.showTitle', s.showTitle, { type: 'check' })}${F('주 시작', 's.weekStart', s.weekStart, { type: 'select', options: [[0, '일요일'], [1, '월요일']] })}</div><label class="f"><span>글꼴</span>${fontPicker('s.fontNum', s.fontNum)}</label>` + geo;
  }
  { // 영상 애니메이션 (캡컷식 3칸 + 사진 천천히 움직이기)
    const tabs = [['in', '나타나기', 'anim', el.type === 'text' ? VIDEO.ANIMS.concat(VIDEO.TEXT_ANIMS) : VIDEO.ANIMS], ['out', '사라지기', 'animOut', VIDEO.OUTS], ['loop', '계속', 'animLoop', VIDEO.LOOPS]].concat(el.type === 'image' ? [['kb', '천천히', 'kb', VIDEO.KBS]] : []);
    if (!tabs.some(t => t[0] === animTab)) animTab = 'in';
    const T = tabs.find(t => t[0] === animTab), k = T[2], cur0 = el[k] || {}, on = cur0.t && cur0.t !== 'none';
    const dots = tabs.map(t => el[t[2]] && el[t[2]].t && el[t[2]].t !== 'none');
    h += `<h3 class="anim-h"><svg class="ic"><use href="#i-anim"/></svg>애니메이션 <small>영상용</small></h3><div class="seg anim-tabs">${tabs.map((t, ti) => `<button type="button" data-atab="${t[0]}" aria-pressed="${animTab === t[0]}">${t[1]}${dots[ti] ? ' •' : ''}</button>`).join('')}</div>
    <div class="anim-grid">${T[3].map(([v, t]) => `<button type="button" data-anim="${v}" data-ak="${k}" aria-pressed="${(cur0.t || 'none') === v}"><i class="am am-${v}"></i>${t}</button>`).join('')}</div>`;
    if (on) {
      if (k === 'anim') h += `<div class="grid2">${F('시작', 'anim.d', cur0.d || 0, { type: 'slider', min: 0, max: 10, step: 0.1, unit: '초', def: 0 })}${F('걸리는 시간', 'anim.s', cur0.s || 0.8, { type: 'slider', min: 0.2, max: 4, step: 0.1, unit: '초', def: 0.8 })}</div>`;
      if (k === 'animOut') h += `<div class="grid2">${F('걸리는 시간', 'animOut.s', cur0.s || 0.6, { type: 'slider', min: 0.2, max: 3, step: 0.1, unit: '초', def: 0.6 })}${F('끝나기 전', 'animOut.at', cur0.at || 0, { type: 'slider', min: 0, max: 10, step: 0.1, unit: '초', def: 0 })}</div><p class="hint">장면이 끝날 때 사라집니다. '끝나기 전'만큼 일찍 사라지게 할 수 있어요.</p>`;
      if (k === 'animLoop') h += `<div class="grid2">${F('한 번 도는 시간', 'animLoop.T', cur0.T || 1.2, { type: 'slider', min: 0.3, max: 6, step: 0.1, unit: '초', def: 1.2 })}${F('세기', 'animLoop.a', cur0.a || 1, { type: 'slider', min: 0.3, max: 3, step: 0.1, def: 1 })}</div><p class="hint">나타나기가 끝난 뒤부터 장면이 끝날 때까지 계속 움직입니다.</p>`;
      if (k === 'kb') h += `${F('움직이는 정도', 'kb.a', cur0.a || 0.12, { type: 'slider', min: 0.04, max: 0.4, step: 0.01, pct: true, def: 0.12 })}<p class="hint">사진 액자 안에서 장면 내내 천천히 확대·이동합니다(켄 번즈).</p>`;
      h += `<button class="btn sm" id="iAnimPlay"><svg class="ic"><use href="#i-play"/></svg>이 쪽부터 미리보기</button>`;
    } else h += `<p class="hint">${k === 'anim' ? '고르면 영상에서 이 요소가 그 방식으로 나타납니다.' + (el.type === 'text' ? ' 타자기·한 글자씩·단어씩·한 줄씩은 글자에만 있는 효과예요.' : '') : k === 'animOut' ? '고르면 장면이 끝날 때 이 방식으로 사라집니다.' : k === 'animLoop' ? '고르면 나타난 뒤 계속 움직입니다 (두근두근·둥실둥실 등).' : '고르면 사진이 천천히 확대·이동합니다.'}</p>`;
  }
  h += `<h3>동작</h3><div class="row"><button class="btn sm" id="iDup">복제</button><button class="btn sm" id="iFront">맨 앞</button><button class="btn sm" id="iBack">맨 뒤</button><button class="btn sm danger" id="iDel">삭제</button></div>`;
  ins.innerHTML = h;
  ins.onmousedown = e => { if (e.target.closest('[data-tfi]') && editing) e.preventDefault(); };
  ins.onclick = async e => {
    const at = e.target.closest('[data-atab]'); if (at) { animTab = at.dataset.atab; renderInspector(); return; }
    const ab = e.target.closest('[data-anim]'); if (ab) { const v = ab.dataset.anim, k = ab.dataset.ak || 'anim'; const defs = { anim: { d: 0, s: 0.8 }, animOut: { s: 0.6, at: 0 }, animLoop: { T: 1.2, a: 1 }, kb: { a: 0.12 } }; if (v === 'none') delete el[k]; else el[k] = Object.assign({}, defs[k], el[k] || {}, { t: v }); if (k === 'anim' && v !== 'none' && VIDEO.TEXT_ANIMS.some(x => x[0] === v) && (!el.anim.s || el.anim.s < 1.2)) el.anim.s = Math.max(1.2, Math.min(4, (el.text || '').length * 0.06)); commit(); renderInspector(); if (sideTab === 'video') renderSide(); renderTimeline(); return; }
    if (e.target.closest('#iAnimPlay')) { openVideoPlayer(true); return; }
    if (e.target.closest('#vFitScene')) { page().vdur = Math.max(0.5, Math.round((Number(el.tout || el.dur || 0) - Number(el.tin || 0)) * 10) / 10); commit(); renderAll(); toast(`장면 길이를 ${page().vdur}초로 맞췄습니다`); return; }
    if (e.target.closest('#vRelink')) { relinkMedia(el.src); return; }
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
$('#inspector').addEventListener('change', e => { const k = e.target.dataset.k; if (k === 'grp.w' || k === 'grp.h') { const ev = new Event('input', { bubbles: true }); ev.__apply = true; e.target.dispatchEvent(ev); } }, true);
$('#inspector').addEventListener('input', e => {
  const t = e.target, k = t.dataset.k; if (!k) return;
  let v = t.type === 'checkbox' ? t.checked : t.value;
  if (t.type === 'number' && (t.value.trim() === '' || isNaN(Number(t.value)))) return;  // 입력 중 빈 칸은 무시
  if (t.type === 'number' || t.type === 'range') { v = Number(v); if (t.dataset.scale) v = v / Number(t.dataset.scale); }
  if ((k === 'w' || k === 'h') && v < 1) return; if (k === 'year' && (v < 1900 || v > 2100)) return; if (k === 'size' && v < 1) return;
  syncCtl(t);
  if (k.startsWith('pg.')) { page()[k.slice(3)] = v; renderCanvas(); return; }
  if ((k === 'grp.w' || k === 'grp.h') && !e.__apply) return; // 묶음 너비·높이는 다 친 뒤(Enter·칸 나가기)에만: 한 글자마다 줄이면 1mm로 망가짐
  if (k.startsWith('grp.')) { // 묶음 이동(X·Y) / 비율 유지 크기 조절(너비·높이)
    const els = selEls().filter(x => !x.locked); if (!els.length) return; const U9 = unionBox(els), bx = U9.x, by = U9.y, bw = U9.w, bh = U9.h; const kk = k.slice(4);
    if (kk === 'x' || kk === 'y') els.forEach(e => { e[kk] = r1(e[kk] + v - (kk === 'x' ? bx : by)); });
    else { if (v < 1) return; const f = v / (kk === 'w' ? bw : bh); els.forEach(e => { e.x = r1(bx + (e.x - bx) * f); e.y = r1(by + (e.y - by) * f); e.w = r1(e.w * f); e.h = r1(e.h * f); if (e.size) e.size = Math.round(e.size * f * 10) / 10; if (e.strokeW) e.strokeW = Math.round(e.strokeW * f * 100) / 100; if (e.pts) e.pts = e.pts.map(q => [r1(q[0] * f), r1(q[1] * f)]); if (e.html) e.html = e.html.replace(/font-size:\s*([\d.]+)pt/g, (_, z) => 'font-size:' + Math.round(z * f * 2) / 2 + 'pt'); }); }
    renderCanvas(); renderOverlay(); return;
  }
  if (k.startsWith('multi.')) { const kk = k.slice(6); selEls().forEach(el => { if (kk === 'opacity' || el.type === 'text') el[kk] = v; }); renderCanvas(); return; }
  const el = selEls()[0]; if (!el) return;
  if (['year', 'month', 'weight', 's.weekStart'].includes(k)) v = Number(v);
  if (t.dataset.ev != null) return;
  if (k === 'chartData') { el.data = v.split('\n').map(l => l.split(/[,\t]/)).filter(a => a[0] && a[0].trim()).map(a => ({ l: a[0].trim(), v: Number((a[1] || '0').trim()) || 0 })); renderCanvas(); return; }
  if (k === 'chartColors') { el.colors = v.split(',').map(s => s.trim()).filter(Boolean); renderCanvas(); return; }
  const ow = el.w, oh = el.h;
  setK(el, k, v);
  // 너비·높이를 숫자로 바꿀 때: 비율 고정이면 다른 쪽도 함께 (그림은 기본으로 고정), 자유 곡선은 점도 함께 늘림
  if ((k === 'w' || k === 'h') && ow > 0 && oh > 0) { const lock = el.ratioLock == null ? el.type === 'image' : el.ratioLock; if (lock) { if (k === 'w') el.h = Math.round(v * oh / ow * 1000) / 1000; else el.w = Math.round(v * ow / oh * 1000) / 1000; } if (el.pts) { const fx = el.w / ow, fy = el.h / oh; el.pts = el.pts.map(q => [q[0] * fx, q[1] * fy]); } if (lock) setTimeout(() => { const o = $(`#inspector input[data-k="${k === 'w' ? 'h' : 'w'}"]`); if (o && document.activeElement !== o) o.value = r1(k === 'w' ? el.h : el.w); }, 0); }
  if (el.type === 'text' && el.html && (k === 'color' || k === 'size')) stripRich(el, k === 'color' ? 'color' : 'size');
  if (el.type === 'text' && k === 'size' && (!el.valign || el.valign === 'top') && !(el.warp && el.warp !== 'none')) el.h = 1;  /* 그릴 때 내용 높이로 다시 늘어남 */
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
// 왼쪽 위 로고 = 메인 화면(내 드라이브: 내 디자인 목록·새 디자인 만들기). 지금 문서는 자동 저장 그대로
$('#brandHome').onclick = () => { if (typeof tlPause === 'function' && tl.playing) tlPause(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); openDrive(); };
$('#brandHome').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#brandHome').click(); } };
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
  $('#saveBody').innerHTML = folderPart + NC.live.settingsHTML() + `<p class="hint" style="margin-top:10px">문서 파일에는 올린 이미지와 AI 이미지가 함께 들어갑니다. 내장 글꼴과 2026 삽화는 프로그램에 있으므로 파일이 가벼워집니다. 두 PC에서 같은 문서를 동시에 고쳐 내용이 갈라지면 어느 쪽으로 계속할지 묻고, 다른 쪽은 "충돌 사본" 파일로 보관해 지워지는 내용이 없습니다.</p>`;
  const on = (id, fn) => { const b = $('#' + id); if (b) b.onclick = async () => { try { await fn(); } catch (e) { if (e.name !== 'AbortError') toast(e.message, true); } }; };
  on('svDir', async () => { await store.connectFolder(); await afterFolderReady(); updateSaveBadge(); toast('동기화 폴더를 연결했습니다. 설정과 문서가 이 폴더로 동기화됩니다.'); renderSaveDialog(); });
  on('svReDir', async () => { if (await store.requestFolderPermission()) { await afterFolderReady({ loadCurrent: true }); updateSaveBadge(); renderSaveDialog(); } });
  on('svIntoDir', async () => { d.close(); await saveNow(); });
  on('svDiscDir', async () => { if (!window.confirm('이 PC에서 동기화 폴더 연결을 끊을까요? (폴더 안 파일은 그대로 남습니다)')) return; await store.disconnectFolder(); await store.disconnect(); updateSaveBadge(); setStatus('브라우저에만 저장됩니다'); renderSaveDialog(); });
  on('svConnect', async () => { gcAssets(); await store.connectNew(doc); updateSaveBadge(); setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); toast('파일에 연결했습니다. 이제 자동으로 저장됩니다.'); d.close(); });
  on('svNow', async () => { gcAssets(); await saveFileNow(); d.close(); });
  on('svOther', async () => { d.close(); await openOtherFile(); });
  on('svDown', async () => { gcAssets(); store.download(doc); toast('사본을 내려받았습니다'); });
  on('svDisc', async () => { await store.disconnect(); updateSaveBadge(); setStatus('브라우저에만 저장됩니다'); d.close(); });
  const pn = $('#svPcName'); if (pn) pn.onchange = () => { store.setPcName(pn.value); pn.value = store.pcName(); toast('이 PC 이름을 저장했습니다'); };
  NC.live.bindSettings(d, () => { if (d.open) renderSaveDialog(); });
  const ul = d.querySelector('.list'); if (ul) ul.onclick = async e => { const li = e.target.closest('[data-doc]'); if (!li) return; const x = docs[Number(li.dataset.doc)]; if (st.handle && x.name === st.fileName && curIn) { d.close(); return; } try { await openFolderDoc(x.handle); d.close(); } catch (err) { toast('열 수 없습니다: ' + err.message, true); } };
}

/* ---- 새 디자인 만들기 (미리캔버스식) ---- */
const PX = v => Math.round(v * 25.4 / 96 * 100) / 100;
// [id, 이름, 묶음, 가로, 세로, 단위('mm'|'px'), 검색어]
const FORMATS = [
  /* 도장 소식지: 소식지 엔진(naracha/news.html)의 비율 선택과 같은 크기 — 4:5가 엔진 기본, TV는 영상 송출용 */
  ['nl-45', '도장 소식지 4:5 (기본)', 'news', 1080, 1350, 'px', '소식지 나라차 월간 밴드 세로 기본'], ['nl-sq', '도장 소식지 정사각 1:1', 'news', 1080, 1080, 'px', '소식지 나라차 정사각'],
  ['nl-916', '도장 소식지 세로 9:16', 'news', 1080, 1920, 'px', '소식지 나라차 세로 긴'], ['nl-tv', '도장 소식지 TV 화면 16:9', 'news', 1920, 1080, 'px', '소식지 나라차 TV 빔프로젝터 송출 가로'],
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
const ND_GROUPS = [['rec', '추천', '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'], ['news', '도장 소식지', '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 12.5h7M7 16h4"/>'], ['pres', '프레젠테이션', '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="m10 9 5 2.5-5 2.5z"/>'],
  ['sns', '소셜 미디어', '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>'], ['video', '유튜브 · 영상', '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10 9.5 5 2.5-5 2.5z"/>'],
  ['web', '웹사이트', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>'], ['print', '인쇄', '<path d="M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>'],
  ['doc', '문서', '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'], ['sign', '현수막 · 배너', '<path d="M3 5h18v8H3zM6 13v8M18 13v8"/>'], ['cal', '캘린더', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>']];
const ND_COLOR = { news: '#e2731e', pres: '#2f5bea', sns: '#d6408b', video: '#e0302e', web: '#6b3fd1', print: '#1e2b5a', doc: '#2f8d9e', sign: '#c9831a', cal: '#3a8a3a' };
const ND_REC = ['nl-45', 'ig-sq', 'cardnews', 'kakao', 'a4p', 'letter', 'cert', 'flyer', 'xbanner', 'banner3', 'pres169', 'yt-thumb', 'desk-cal'];
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
    h = `<div class="chips">${[['rec', '전체'], ['news', '도장 소식지'], ['sns', '소셜 미디어'], ['print', '인쇄'], ['sign', '현수막 · 배너'], ['doc', '문서'], ['pres', '프레젠테이션'], ['cal', '캘린더']].map(([k, t]) => `<button data-ndnav="${k}" class="${k === 'rec' ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    if (rec.length) h += `<h3>최근 사용</h3><div class="fgrid">${rec.map(fcard).join('')}</div>`;
    h += `<h3>도장에서 자주 쓰는 크기</h3><div class="fgrid">${ND_REC.map(id => fcard(FORMATS.find(f => f[0] === id))).join('')}</div>`;
    ND_GROUPS.slice(1).forEach(([k, t]) => { h += `<h3>${t}</h3><div class="fgrid">${FORMATS.filter(f => f[2] === k).map(fcard).join('')}</div>`; });
  } else { const t = ND_GROUPS.find(g => g[0] === ndState.nav); h = `<h3>${t[1]}</h3><div class="fgrid">${FORMATS.filter(f => f[2] === ndState.nav).map(fcard).join('')}</div>`; }
  $('#ndMain').innerHTML = h;
}
// 새 문서를 만들고, 동기화 폴더가 있으면 그 폴더에 새 파일로 저장
// 다른 문서로 넘어가기 전에 지금 문서 지키기: 파일이 연결돼 있으면 저장, 아니면 이 브라우저에 '직전 문서'로 한 부 보관(저장 ▾ → 직전 문서 되살리기)
async function keepCurrentDoc() {
  try { flushNudge(); } catch (e) {}
  if (store.state.handle) {
    if (!store.state.dirty) return;  // 이미 파일에 저장됨
    if (!store.state.needPerm) { clearTimeout(fileTimer); if (await saveFileNow()) return; }
  }  // 파일 저장에 실패했거나 권한 대기·파일 없음이면 아래에서 '직전 문서'로 보관
  if (doc.pages.some(p => p.els.length)) { try { await store.idbSet('doc-prev', JSON.parse(JSON.stringify(doc))); } catch (e) { console.warn('직전 문서 보관 실패', e); } }
}
const keepNote = () => store.state.handle ? '지금 문서는 파일에 저장됩니다' : '지금 문서는 파일로 저장하지 않았지만 저장 ▾ → 직전 문서 되살리기로 되살릴 수 있습니다';
async function restorePrevDoc() {
  let j = null; try { j = await store.idbGet('doc-prev'); } catch (e) {}
  if (!j || !j.pages) { toast('되살릴 직전 문서가 없습니다', true); return; }
  await keepCurrentDoc(); await store.disconnect(); await loadDoc(j, `직전 문서 "${j.name || '디자인'}"를 되살렸습니다 (방금 보던 문서는 다시 '직전 문서'로 보관)`); updateSaveBadge();
}
async function createDesign(w, h, name, fmtId) {
  if (fmtId) { const r = recentFormats().filter(x => x !== fmtId); r.unshift(fmtId); try { localStorage.setItem('naracal-recent-formats', JSON.stringify(r.slice(0, 6))); } catch (e) {} }
  await keepCurrentDoc();
  const inDir = await store.folderReady();
  await store.disconnect();
  doc = newDoc(['custom', name, w, h]); doc.name = name; doc.fmt = fmtId || ''; { const f = FORMATS.find(x => x[0] === fmtId); if (f && ['print', 'doc', 'cal'].includes(f[2]) && f[5] === 'mm') doc.bleed = 3; } hist = []; histMeta = []; hptr = -1; cur = 0; sel = []; $('#pname').value = doc.name; commit(); clearTimeout(fileTimer);
  const into = inDir && $('#dlgDrive') && drv.view === 'drive' ? drv.path : null;
  if (into && into.length) { try { await store.saveIntoFolder(doc, into); rememberLoc(into); setStatus(`${into.length ? into.join(' › ') + ' 폴더' : '동기화 폴더'}에 저장됨 · ${store.state.fileName}`); } catch (e) { toast('폴더에 저장하지 못했습니다: ' + e.message, true); } }
  else if (inDir) setStatus('아직 저장 위치를 고르지 않았습니다 · 저장(Ctrl+S)을 누르면 위치를 고릅니다 (그 전까지는 이 브라우저에 임시 저장)');
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

/* ---- 저장 위치 고르기 (처음 저장 · 새 이름으로 저장): 동기화 폴더 안의 폴더 = 위치. 새 폴더·이름 바꾸기·삭제(휴지통)도 여기서 ---- */
const locLabel = p => p && p.length ? '내 드라이브 › ' + p.join(' › ') : '내 드라이브';
function lastLoc() { try { return JSON.parse(localStorage.getItem('naracal-save-loc') || '[]'); } catch (e) { return []; } }
function rememberLoc(p) { try { localStorage.setItem('naracal-save-loc', JSON.stringify(p || [])); } catch (e) {} }
// 지금 열린 문서 파일이 들어 있는 폴더 경로 (그 폴더는 이름 바꾸기·삭제를 막아 자동 저장이 끊기지 않게)
async function curDocPath() { try { const st = store.state; if (!st.dir || !st.handle) return null; const r = await st.dir.resolve(st.handle); return r ? r.slice(0, -1) : null; } catch (e) { return null; } }
function pickSaveLocation(o) {
  return new Promise(async resolve => {
    let d = $('#dlgLoc'); if (d) d.remove();
    d = document.createElement('dialog'); d.id = 'dlgLoc'; d.className = 'loc-dlg';
    let sel = lastLoc(), all = [[]], counts = new Map(), done = false; const busy = await curDocPath();
    const finish = v => { if (done) return; done = true; resolve(v); d.close(); };
    d.innerHTML = `<div class="dhead"><h2>${esc(o.title || '저장')}</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody">
      <label class="f"><span>문서 이름</span><input type="text" id="locName" maxlength="80" value="${esc(o.name || '')}"></label>
      <div class="loc-head"><b>저장 위치</b><span id="locCur"></span></div>
      <div class="loc-tree" id="locTree"><p class="hint" style="padding:12px">폴더를 읽는 중…</p></div>
      <div class="loc-tools"><button class="btn sm" id="locNew"><svg class="ic"><use href="#i-plus"/></svg>새 폴더</button><button class="btn sm" id="locRen">이름 바꾸기</button><button class="btn sm danger" id="locDel"><svg class="ic"><use href="#i-del"/></svg>삭제</button></div>
      ${o.note ? `<p class="hint">${esc(o.note)}</p>` : ''}
      <div class="row" style="justify-content:flex-end;margin-top:6px"><button class="btn" data-close>취소</button><button class="btn primary" id="locOk"><svg class="ic"><use href="#i-save"/></svg>${esc(o.ok || '저장')}</button></div></div>`;
    document.body.appendChild(d); d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => finish(null)); d.addEventListener('close', () => { if (!done) { done = true; resolve(null); } d.remove(); }); d.showModal();
    const key = p => JSON.stringify(p), same = (a, b) => key(a) === key(b);
    const load = async () => { try { all = await store.allFolders(); } catch (e) { all = [[]]; } if (!all.some(p => same(p, sel))) sel = []; draw(); };
    const draw = () => {
      const rows = all.slice().sort((a, b) => a.join('\u0001').localeCompare(b.join('\u0001'), 'ko'));
      $('#locTree').innerHTML = rows.map(p => `<button type="button" class="loc-row${same(p, sel) ? ' on' : ''}" data-p='${esc(key(p))}' style="padding-left:${10 + p.length * 18}px"><svg class="ic"><use href="#${p.length ? 'i-folder' : 'i-pages'}"/></svg><span>${esc(p.length ? p[p.length - 1] : '내 드라이브')}</span>${busy && same(p, busy) ? '<em>지금 문서</em>' : ''}</button>`).join('');
      $('#locCur').textContent = locLabel(sel); const root = !sel.length;
      $('#locRen').disabled = root; $('#locDel').disabled = root;
      const on = $('#locTree .on'); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    const inBusy = p => busy && p.length && busy.length >= p.length && same(busy.slice(0, p.length), p);
    d.querySelector('#locTree').onclick = e => { const r = e.target.closest('.loc-row'); if (r) { sel = JSON.parse(r.dataset.p); draw(); } };
    d.querySelector('#locTree').ondblclick = e => { if (e.target.closest('.loc-row')) $('#locOk').click(); };
    $('#locNew').onclick = async () => { const n = window.prompt(`${locLabel(sel)} 안에 새 폴더를 만듭니다. 폴더 이름:`, '새 폴더'); if (!n) return; try { const h = await store.makeFolder(sel, n); sel = sel.concat(h.name); await load(); } catch (e) { toast(e.message, true); } };
    $('#locRen').onclick = async () => {
      if (!sel.length) return; if (inBusy(sel)) { toast('지금 열린 문서가 이 폴더 안에 있어 이름을 바꿀 수 없습니다', true); return; }
      const old = sel[sel.length - 1], n = window.prompt('폴더의 새 이름', old); if (!n || n.trim() === old) return; const name = n.replace(/[\\/:*?"<>|]/g, '_').trim(); if (!name) return;
      try { const parent = sel.slice(0, -1), pd = await store.dirAt(parent); for await (const [x] of pd.entries()) if (x === name) throw new Error('같은 이름의 폴더가 이미 있습니다'); const h = await pd.getDirectoryHandle(old); await store.moveEntry(h, parent, parent, name); sel = parent.concat(name); await load(); toast('폴더 이름을 바꿨습니다'); } catch (e) { toast('바꾸지 못했습니다: ' + e.message, true); }
    };
    $('#locDel').onclick = async () => {
      if (!sel.length) return; if (inBusy(sel)) { toast('지금 열린 문서가 이 폴더 안에 있어 삭제할 수 없습니다', true); return; }
      const parent = sel.slice(0, -1), name = sel[sel.length - 1];
      try { const pd = await store.dirAt(parent), h = await pd.getDirectoryHandle(name); let n = 0; try { n = (await store.walkDocs(sel)).length; } catch (e) {}
        if (!window.confirm(`"${name}" 폴더를 휴지통으로 옮길까요?${n ? `\n안에 있는 디자인 ${n}개도 함께 옮겨집니다.` : ''}\n(내 드라이브 → 휴지통에서 되살릴 수 있습니다)`)) return;
        await store.toTrash(h, parent); sel = parent; await load(); toast('휴지통으로 옮겼습니다'); } catch (e) { toast('삭제하지 못했습니다: ' + e.message, true); }
    };
    $('#locOk').onclick = () => { const nm = $('#locName').value.trim(); if (!nm) { $('#locName').focus(); toast('문서 이름을 넣어 주세요', true); return; } finish({ name: nm, path: sel }); };
    $('#locName').onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('#locOk').click(); } };
    setTimeout(() => { const i = $('#locName'); if (i) { i.focus(); i.select(); } }, 30);
    load();
  });
}
/* ---- 파일 메뉴: 저장 · 새 이름으로 저장 · 사본 만들기 ---- */
async function saveNow() {
  gcAssets();
  try {
    if (store.state.handle) { clearTimeout(fileTimer); if (store.state.needPerm) { if (!(await store.requestPermission())) { toast('파일 권한을 허락하지 않아 저장하지 못했습니다 (작업은 이 브라우저에 남아 있습니다)', true); return; } store.state.needPerm = false; } if (await saveFileNow()) toast('저장했습니다'); else if (!store.state.conflict) toast('아직 저장하지 못했습니다 — 파일 권한이나 동기화 상태를 확인해 주세요(위 저장 표시를 누르면 다시 시도)', true); return; }  /* 실패했는데 '저장했습니다'가 뜨던 것 */
    if (await store.folderReady()) { const loc = await pickSaveLocation({ title: '저장', name: doc.name || '새 디자인', ok: '여기에 저장' }); if (!loc) return; doc.name = loc.name; $('#pname').value = doc.name; await store.saveIntoFolder(doc, loc.path); rememberLoc(loc.path); setStatus(`${locLabel(loc.path)}에 저장됨 ${tnow()} · ${store.state.fileName}`); updateSaveBadge(); toast(`${locLabel(loc.path)}에 저장했습니다. 이제 바뀔 때마다 자동 저장됩니다.`); return; }
    if (store.state.supported) { await store.connectNew(doc); updateSaveBadge(); setStatus(`파일에 저장됨 ${tnow()} · ${store.state.fileName}`); toast('저장했습니다. 이제 바뀔 때마다 자동 저장됩니다.'); return; }
    store.download(doc); toast('이 브라우저는 파일 저장을 지원하지 않아 내려받았습니다');
  } catch (e) { if (e.name !== 'AbortError') toast('저장하지 못했습니다: ' + e.message, true); }
}
async function saveAs() {
  const inDir = await store.folderReady();
  let nm, loc = null;
  if (inDir) { loc = await pickSaveLocation({ title: '새 이름으로 저장', name: (doc.name || '새 디자인'), ok: '새 이름으로 저장', note: '지금 파일은 마지막으로 저장된 상태로 그대로 남고, 이제부터 새 파일에서 작업합니다.' }); if (!loc) return; nm = loc.name; }
  else { nm = window.prompt('새 이름으로 저장합니다. 문서 이름을 입력하세요.\n(지금 파일은 마지막으로 저장된 상태로 그대로 남습니다)', doc.name || '새 디자인'); if (nm == null || !nm.trim()) return; }
  gcAssets();
  try {
    if (store.state.handle && store.state.dirty) { clearTimeout(fileTimer); await saveFileNow(); }
    const prev = doc.name, prevId = doc.docId; doc.name = nm.trim(); doc.docId = ''; $('#pname').value = doc.name; // 새 파일은 버전 기록을 새로 시작
    if (inDir) { await store.saveIntoFolder(doc, loc.path); rememberLoc(loc.path); }
    else if (store.state.supported) { try { await store.connectNew(doc); } catch (e) { doc.name = prev; doc.docId = prevId; $('#pname').value = prev; throw e; } }
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
  <button data-fm="bulk"><svg class="ic"><use href="#i-dup"/></svg>대량 만들기… (상장·명찰을 명단으로)</button>
  <button data-fm="versions"><svg class="ic"><use href="#i-pages"/></svg>버전 기록… (예전 상태로 되돌리기)</button>
  <button data-fm="resize"><svg class="ic"><use href="#i-pages"/></svg>크기 조정… (다른 크기로 사본)</button>
  <button data-fm="rename"><svg class="ic"><use href="#i-text"/></svg>이름 바꾸기</button><hr>
  <button data-fm="new"><svg class="ic"><use href="#i-new"/></svg>새 디자인…</button>
  <button data-fm="open"><svg class="ic"><use href="#i-folder"/></svg>내 드라이브 (열기)…<kbd>Ctrl+O</kbd></button>
  <button data-fm="prev"><svg class="ic"><use href="#i-open"/></svg>직전 문서 되살리기 (파일로 저장 안 한 문서)</button>
  <button data-fm="down"><svg class="ic"><use href="#i-upload"/></svg>파일로 내려받기 (JSON)</button><hr>
  <button data-fm="sync"><svg class="ic"><use href="#i-folder"/></svg>저장 · 동기화 설정…</button>`;
  document.body.appendChild(m); m.style.left = Math.max(8, Math.min(b.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = (b.bottom + 6) + 'px';
  m.onclick = e => { const x = e.target.closest('[data-fm]'); if (!x) return; m.remove(); ({ prev: restorePrevDoc, save: saveNow, saveas: saveAs, dup: duplicateDoc, resize: openResize, versions: openVersions, bulk: openBulk, rename: () => { const p = $('#pname'); p.focus(); p.select(); }, new: openNewDesign, open: () => $('#btnOpen').click(), down: () => { gcAssets(); store.download(doc); }, sync: openSaveDialog })[x.dataset.fm](); };
  setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target) && ev.target.closest('#btnFileMenu') == null) { m.remove(); } document.removeEventListener('pointerdown', off); }), 0);
  document.addEventListener('keydown', function escFm(ev) { if (!document.body.contains(m)) { document.removeEventListener('keydown', escFm, true); return; } if (ev.key === 'Escape') { ev.preventDefault(); m.remove(); document.removeEventListener('keydown', escFm, true); $('#btnFileMenu').focus(); } }, true);
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
  const cats = [['all', '전체'], ['hot', '인기 글꼴'], ['title', '제목용'], ['brush', '붓글씨'], ['hand', '손글씨'], ['body', '본문용'], ['latin', '영문'], ['mine', '내 글꼴']];
  const fonts = allFonts(); const rec = recentFonts().map(n => fonts.find(f => f.family === n)).filter(Boolean);
  const list = sortFonts(fonts.filter(f => fontCat === 'all' || (fontCat === 'hot' ? f.web || f.lib : f.cat === fontCat)));
  const row = f => `<div class="fontrow ${target && target.font === f.family ? 'active' : ''}" data-font="${esc(f.family)}"><div class="nm">${esc(f.label)}</div>${f.preview ? `<img class="fpimg" src="${esc(f.preview)}" alt="" loading="lazy">` : `<div class="sample" style="font-family:'${esc(f.family)}'">나라차 태권도 인성 캘린더 2027 Aa</div>`}<span class="hint" style="margin:0">${f.lib ? '자료실 · ' : f.web ? '인기 웹글꼴 · ' : ''}${f.weights.join('/')}${f.desc ? ' · ' + esc(f.desc) : ''}</span></div>`;
  $('#fontBody').innerHTML = `<div class="row" style="margin-bottom:10px"><div class="seg" style="flex:1">${cats.map(([k, t]) => `<button data-fc="${k}" aria-pressed="${fontCat === k}">${t}</button>`).join('')}</div><label class="btn sm">내 글꼴 올리기<input type="file" accept=".ttf,.otf,.woff,.woff2" id="fontUp" hidden></label></div>
  <p class="hint">${target ? `선택한 글 상자 "${esc(elName(target))}"에 바로 적용됩니다.` : '글 상자를 선택한 뒤 열면 바로 적용됩니다. 지금은 새 글자의 기본 글꼴로 정해집니다.'} '인기' 표시는 요즘 디자이너가 많이 쓰는 무료 웹글꼴(쓸 때만 불러옴), '자료실'은 구글 드라이브 디자인자료의 글꼴(이 PC들에서만 보임)입니다. 빙그레·롯데리아·웰컴체는 로고 제작에는 쓰지 마세요.</p>
  ${rec.length && fontCat === 'all' ? `<h3>최근 사용</h3><div class="fontlist">${rec.map(row).join('')}</div><h3>전체 ${list.length}종</h3>` : ''}
  <div class="fontlist">${list.map(row).join('')}</div>`;
  $('#fontBody').onclick = e => { const c = e.target.closest('[data-fc]'); if (c) { fontCat = c.dataset.fc; renderFonts(); return; } const r = e.target.closest('[data-font]'); if (!r) return; noteFont(r.dataset.font); if (target) { target.font = r.dataset.font; commit(); rerender(); renderFonts(); } else { lastTextStyle = Object.assign({}, lastTextStyle || {}, { font: r.dataset.font }); toast(`새 글자의 기본 글꼴: ${r.dataset.font}`); } };
  $('#fontUp').onchange = async e => { const f = e.target.files[0]; if (!f) return; const data = await fileToDataURL(f); const family = f.name.replace(/\.(ttf|otf|woff2?)$/i, ''); try { const ff = new FontFace(family, `url(${data})`); await ff.load(); document.fonts.add(ff); doc.fonts.push({ family, data }); commit(); markDirty(); renderFonts(); toast(`글꼴 "${family}"을 추가했습니다`); } catch (err) { toast('글꼴을 읽지 못했습니다', true); } };
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
function openAI(tab) { aiCtx.tab = tab; const el = selEls()[0]; if (el && el.month) aiCtx.monthIdx = el.month - 1; if (!chatMode() && !AI.cfg.anthropicKey && !AI.cfg.geminiKey && tab !== 'keys') aiCtx.tab = 'keys'; renderAI(); $('#dlgAI').showModal(); }
$$('#dlgAI [role=tab]').forEach(b => b.onclick = () => { aiCtx.tab = b.dataset.tab; renderAI(); });
function applyMonthContent(mi, r) {
  Object.assign(doc.calendar.months[mi], { virtue: r.virtue, en: r.en, quote: r.quote, practice: r.practice.slice(0, 2), idiom: r.idiom, hanja: r.hanja, meaning: r.meaning });
  let n = 0;
  doc.pages.forEach(p => p.els.forEach(el => { if (el.type !== 'text' || el.month !== mi + 1) return; const map = { virtue: r.virtue, en: `(${r.en})`, quote: r.quote, practice: `1. ${r.practice[0]}\n2. ${r.practice[1]}`, idiom: `${r.idiom}(${r.hanja})`, meaning: r.meaning }; if (map[el.role] != null) { el.text = map[el.role]; n++; } }));
  return n;
}
function renderAI() {
  $$('#dlgAI [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === aiCtx.tab));
  $('#dlgAI').classList.toggle('studio', aiCtx.tab === 'image');
  const body = $('#aiBody'); const months = doc.calendar.months; const year = doc.calendar.year || 2027;
  if (aiCtx.tab === 'keys') {
    const chat = chatMode(), sel = (k, list) => `<select data-ai="${k}">${list.map(x => `<option value="${x}" ${AI.cfg[k] === x ? 'selected' : ''}>${CHAT_SITES[x][0]}</option>`).join('')}</select>`;
    const modes = `<div class="aimode"><label class="${chat ? 'on' : ''}"><input type="radio" name="aimode" value="chat" ${chat ? 'checked' : ''}><b>내 채팅 요금제로</b><span>키·추가 요금 없음. 지시문을 복사해 쓰던 채팅(Claude·Gemini·ChatGPT)에 붙여 넣고, 받은 답·그림을 공방에 붙여 넣습니다.</span></label>
      <label class="${chat ? '' : 'on'}"><input type="radio" name="aimode" value="api" ${chat ? '' : 'checked'}><b>API 키로 자동</b><span>버튼 한 번에 끝나지만, 구독과 별도로 쓴 만큼 요금이 듭니다.</span></label></div>`;
    if (chat) {
      body.innerHTML = `${modes}<div class="grid2"><label class="f"><span>문구·프롬프트 다듬기에 쓸 채팅</span>${sel('chatText', ['claude', 'gemini', 'chatgpt'])}</label><label class="f"><span>그림 그리기에 쓸 채팅</span>${sel('chatImage', ['gemini', 'claude', 'chatgpt'])}</label></div>
      <p class="hint">채팅은 이 브라우저에 로그인된 계정(지금 쓰는 요금제)을 그대로 씁니다. 처음 한 번은 열린 새 탭에서 로그인해 두세요. 채팅 사이트에 자동으로 입력하지는 않고, 관장님이 붙여 넣고 보내는 방식입니다. Claude 채팅에서 만든 그림·디자인도 이미지로 복사하거나 내려받아 받는 칸에 넣으면 똑같이 쓸 수 있습니다.</p>`;
      body.querySelectorAll('[name=aimode]').forEach(r => r.onchange = () => { AI.cfg.mode = r.value; AI.saveCfg(); renderAI(); });
      return;
    }
    body.innerHTML = `${modes}<p class="hint">키는 이 브라우저와, 동기화 폴더가 연결돼 있으면 그 폴더의 설정 파일(설정.naracha.json)에 저장되어 다른 PC에서도 바로 쓰입니다. 키는 Anthropic·Google 서버로만 보내집니다. Claude 키는 console.anthropic.com, Gemini 키는 aistudio.google.com에서 만듭니다.</p>
    <div class="grid2">${aiF('Claude API 키', 'anthropicKey', 'password')}${aiF('Claude 모델', 'claudeModel')}${aiF('Gemini API 키', 'geminiKey', 'password')}${aiF('Gemini 이미지 모델', 'geminiModel')}
    <label class="f"><span>이미지 비율</span><select data-ai="aspect">${['1:1', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9'].map(a => `<option ${AI.cfg.aspect === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    <label class="f"><span>이미지 크기</span><select data-ai="size">${['1K', '2K', '4K'].map(a => `<option ${AI.cfg.size === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label></div>
    <div class="keysaved" id="keySaved">${keySavedText()}</div>
    <p class="hint">모델 이름: Gemini는 gemini-nano-banana-2.1(기본), gemini-3.1-flash-image, gemini-3-pro-image, gemini-2.5-flash-image(구형). Claude는 claude-opus-5-5(기본), claude-sonnet-5-5. Claude 요청에는 안전 거절 시 다른 모델로 자동 전환되는 fallbacks 설정이 켜져 있습니다.</p>`;
    body.querySelectorAll('[name=aimode]').forEach(r => r.onchange = () => { AI.cfg.mode = r.value; AI.saveCfg(); renderAI(); });
    return;
  }
  const mi = aiCtx.monthIdx, mo = months[mi];
  if (aiCtx.tab === 'content') {
    const chat = chatMode(), site = CHAT_SITES[AI.cfg.chatText][0];
    body.innerHTML = `<div class="row" style="margin-bottom:10px"><label class="f" style="margin:0;flex:1"><span>대상 달</span><select id="aiMonth">${months.map((x, k) => `<option value="${k}" ${k === mi ? 'selected' : ''}>${k + 1}월 · ${esc(x.virtue)}</option>`).join('')}</select></label>
      <label class="f" style="margin:0;flex:2"><span>덕목 (비우면 AI가 정함)</span><input type="text" id="aiVirtue" value="${esc(mo.virtue)}"></label></div>
    <label class="f"><span>참고 요청 (선택)</span><input type="text" id="aiHint" placeholder="예: 새 학기 분위기, 겨루기 장면을 넣어줘"></label>
    ${chat ? `<p class="hint" style="margin:0 0 6px">① 단추를 누르면 지시문이 복사되고 <b>${site}</b> 채팅이 새 탭에 열립니다. 채팅 칸에 붙여 넣어(⌘V·Ctrl+V) 보내세요. <button class="lnk" data-gokeys>다른 채팅으로 바꾸기</button></p>` : ''}
    <div class="row"><button class="btn ai" id="aiGoMonth">${chat ? '① 이 달 문구 — 지시문 복사·채팅 열기' : '이 달 문구 제안받기'}</button><button class="btn" id="aiGoYear">${chat ? '① 12개월 전체 — 지시문 복사·채팅 열기' : '12개월 전체 덕목 구성하기'}</button><span id="aiBusy"></span></div>
    ${chat ? `<label class="f" style="margin-top:10px"><span>② 채팅의 답을 복사해 여기에 붙여 넣기 (답 아래 복사 단추 → 여기서 ⌘V·Ctrl+V, 붙여 넣으면 바로 읽음)</span><textarea id="aiAnswer" rows="4" placeholder='{"virtue": "…", "quote": "…"} 처럼 생긴 답'></textarea></label>` : ''}
    <p class="hint">결과를 확인한 뒤 "적용"을 눌러야 들어갑니다. 적용하면 캘린더 데이터와, 해당 달의 역할이 지정된 글 상자가 함께 바뀝니다.</p><div id="aiResult"></div>`;
    $('#aiMonth').onchange = e => { aiCtx.monthIdx = Number(e.target.value); renderAI(); };
    const showMonth = r => { $('#aiResult').innerHTML = `<div class="aiout" style="white-space:normal"><b style="font-size:15px">${esc(r.virtue)}</b> <small>${esc(r.en || '')}</small><p style="margin:6px 0">${esc(r.quote).replace(/\\n|\n/g, '<br>')}</p><div>1. ${esc(r.practice[0] || '')}<br>2. ${esc(r.practice[1] || '')}</div><small>${esc(r.idiom)}(${esc(r.hanja)}) — ${esc(r.meaning)}</small></div><div class="row" style="margin-top:8px"><button class="btn primary" id="aiApply">${mi + 1}월에 적용</button></div>`; $('#aiApply').onclick = () => { const n = applyMonthContent(mi, r); commit(); rerender(); $('#dlgAI').close(); toast(`${mi + 1}월 문구를 적용했습니다 (글 상자 ${n}개 갱신)`); }; $('#aiApply').scrollIntoView({ block: 'nearest' }); };
    const showYear = r => { $('#aiResult').innerHTML = `<div class="aiout">${r.map((x, k) => `${k + 1}월 ${esc(x.virtue)} (${esc(x.en)}) · ${esc(x.idiom)}(${esc(x.hanja)})\n  ${esc(x.quote.replace(/\n/g, ' '))}\n  1) ${esc(x.practice[0])}\n  2) ${esc(x.practice[1])}`).join('\n\n')}</div><div class="row" style="margin-top:8px"><button class="btn primary" id="aiApplyY">12개월 모두 적용</button></div>`; $('#aiApplyY').onclick = () => { let n = 0; r.forEach((x, k) => n += applyMonthContent(k, x)); commit(); rerender(); $('#dlgAI').close(); toast(`12개월 문구를 적용했습니다 (글 상자 ${n}개 갱신)`); }; };
    const mArgs = () => ({ year, month: mi + 1, virtue: $('#aiVirtue').value.trim(), hint: $('#aiHint').value.trim() }), yArgs = () => ({ year, previous: months.map(x => x.virtue), hint: $('#aiHint').value.trim() });
    if (chat) {
      $('#aiGoMonth').onclick = () => { aiCtx.ask = 'month'; sendToChat(AI.chat.month(mArgs()), 'text'); };
      $('#aiGoYear').onclick = () => { aiCtx.ask = 'year'; sendToChat(AI.chat.year(yArgs()), 'text'); };
      const read = () => { const t = $('#aiAnswer').value; if (!t.trim()) return; try { let y = null; try { y = AI.readYear(t); } catch (e) {} if (y) showYear(y); else showMonth(AI.readMonth(t)); } catch (err) { $('#aiResult').innerHTML = `<p class="hint" style="color:var(--ui-danger)">${esc(err instanceof SyntaxError ? '답에서 JSON을 읽지 못했습니다. 채팅 답 아래의 복사 단추로 답 전체를 복사해 붙여 넣어 주세요.' : err.message)}</p>`; } };
      $('#aiAnswer').oninput = read; body.querySelector('[data-gokeys]').onclick = () => { aiCtx.tab = 'keys'; renderAI(); };
    } else {
      $('#aiGoMonth').onclick = () => runAI(async () => showMonth(await AI.suggestMonth(mArgs())));
      $('#aiGoYear').onclick = () => runAI(async () => showYear(await AI.suggestYear(yArgs())));
    }
    return;
  }
  renderStudio(body);  // 7단계 AI 그림 만들기 (아래 renderStudio)
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
// ---- 채팅창 방식: API 키 없이 내 요금제(Claude·Gemini·ChatGPT 채팅)로 — 지시문을 복사해 채팅에 붙여 넣고, 받은 답·그림을 공방에 붙여 넣음 ----
// 채팅 사이트를 대신 조작하지 않음: 로그인·요금제는 관장님 브라우저의 그 사이트 그대로
const CHAT_SITES = { claude: ['Claude', 'https://claude.ai/new'], gemini: ['Gemini', 'https://gemini.google.com/app'], chatgpt: ['ChatGPT', 'https://chatgpt.com/'] };
const chatMode = () => AI.cfg.mode !== 'api';
async function copyText(t) { try { await navigator.clipboard.writeText(t); } catch (e) { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px'; (document.querySelector('dialog[open]') || document.body).appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } }
async function copyImg(src) { const img = await AI.loadImg(src); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); const b = await new Promise(r => c.toBlob(r, 'image/png')); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); }
// 참고 그림 여러 장을 한 장으로 나란히 (채팅에는 한 번에 한 장씩 붙여 넣기 편하게)
async function refSheet(list) { const ims = await Promise.all(list.map(AI.loadImg)); const H = 640, ws = ims.map(i => Math.round(i.naturalWidth * H / i.naturalHeight)); const c = document.createElement('canvas'); c.width = ws.reduce((a, b) => a + b, 0) + 40 * (ims.length - 1); c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, H); let o = 0; ims.forEach((im, k) => { x.drawImage(im, o, 0, ws[k], H); o += ws[k] + 40; }); return c.toDataURL('image/png'); }
function openChatSite(k) { window.open(CHAT_SITES[k][1], 'nc-chat-' + k); }
// 복사가 먼저(창이 바뀌면 복사가 막힘), 그다음 채팅 탭 열기
async function sendToChat(text, kind, o = {}) { const k = kind === 'image' ? AI.cfg.chatImage : AI.cfg.chatText; await copyText(text); if (o.open !== false) openChatSite(k); toast(`지시문을 복사했습니다 — ${o.open === false ? '같은' : '열린'} ${CHAT_SITES[k][0]} 채팅 칸에 ⌘V·Ctrl+V로 붙여 넣고 보내세요${o.note ? '. ' + o.note : ''}`); }
// 받은 그림 받는 칸: 붙여 넣기(그림 복사 → ⌘V) · 끌어다 놓기 · 눌러서 파일 고르기
function chatImgZone(zone, onImg) {
  const take = async files => { for (const f of files) if (/^image\//.test(f.type)) { try { await onImg(await fileToDataURL(f)); } catch (err) { toast(err.message, true); } } };
  zone._take = take;
  zone.onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.onchange = () => take([...i.files]); i.click(); };
  zone.ondragover = e => { e.preventDefault(); zone.classList.add('on'); }; zone.ondragleave = () => zone.classList.remove('on');
  zone.ondrop = async e => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('on'); const fs = [...e.dataTransfer.files]; if (fs.length) return take(fs); const u = (e.dataTransfer.getData('text/uri-list') || '').split('\n')[0].trim(); if (!u) return; try { const b = await (await fetch(u)).blob(); if (!/^image\//.test(b.type)) throw 0; take([b]); } catch (err) { toast('그 그림은 바로 가져올 수 없습니다 — 채팅의 그림을 오른쪽 클릭 → 이미지 복사 후, 이 칸을 보고 ⌘V·Ctrl+V 하세요', true); } };
}
document.addEventListener('paste', e => { const z = document.querySelector('dialog[open] .chatzone'); if (!z || !z._take) return; const fs = [...((e.clipboardData && e.clipboardData.files) || [])].filter(f => /^image\//.test(f.type)); if (!fs.length) return; e.preventDefault(); z._take(fs); });
const aiMoveName = mv => aiStudio.style === 'scene' ? '장면' : (AI_MOVES.find(x => x[0] === mv) || [])[1] || '그림';
function aiChatFlow() {
  const S = aiStudio, mvs = S.moves.length ? S.moves : ['ready'], needRef = S.style === 'mascot', site = CHAT_SITES[AI.cfg.chatImage][0], n = needRef ? 1 : 0;
  return `<div class="chatflow"><p class="hint" style="margin:0 0 6px">${site} 채팅(내 요금제)에서 그립니다. 동작마다 지시문을 복사해 같은 대화에 이어 붙이면 그림체가 맞춰집니다. <button class="lnk" data-gokeys>다른 채팅으로 바꾸기</button> · <button class="lnk" id="aiNewChat">새 대화로 시작</button></p>
  <div class="row" style="flex-wrap:wrap;gap:6px">${needRef ? `<button class="btn sm" id="aiRefCp">① 라차 참고 그림 복사·${site} 열기</button>` : ''}${mvs.map(mv => `<button class="btn sm ${S.cur === mv ? 'ai' : ''}" data-cp="${mv}">${n ? '②' : '①'} ${esc(aiMoveName(mv))} 지시문 복사</button>`).join('')}</div>
  <div class="chatzone" id="aiZone"><b>${n ? '③' : '②'} 받은 그림을 여기에 넣기</b><span>채팅의 그림을 오른쪽 클릭 → 이미지 복사 → 여기서 ⌘V·Ctrl+V · 내려받은 파일을 끌어다 놓기 · 눌러서 파일 고르기</span><small id="aiZoneFor">${S.cur ? `받을 그림: ${esc(aiMoveName(S.cur))}` : ''}</small></div></div>`;
}
function aiChatWire(take, sync) {
  const S = aiStudio, mvs = S.moves.length ? S.moves : ['ready'], needRef = S.style === 'mascot', body = $('#aiBody');
  body.querySelector('[data-gokeys]').onclick = () => { aiCtx.tab = 'keys'; renderAI(); };
  $('#aiNewChat').onclick = () => { S.chatOn = false; S.imgN = 0; toast('다음 지시문을 복사하면 채팅을 새로 엽니다'); };
  if ($('#aiRefCp')) $('#aiRefCp').onclick = async () => { S.chatOn = true; S.imgN = 0; try { await copyImg(await refSheet([ASSETS['mascot-03'], ASSETS['mascot-01']].filter(Boolean))); openChatSite(AI.cfg.chatImage); toast('라차 참고 그림을 복사했습니다 — 열린 채팅 칸에 ⌘V·Ctrl+V로 붙여 넣은 뒤 ② 지시문 복사를 누르세요'); } catch (err) { toast('참고 그림을 복사하지 못했습니다: ' + err.message, true); } };
  body.querySelectorAll('[data-cp]').forEach(b => b.onclick = async () => {
    const mv = b.dataset.cp; sync(); const custom = S.prompt && S.prompt.trim() && mvs.length === 1; const prompt = custom ? S.prompt : aiComposePrompt(mv, false); const first = !S.imgN;
    await sendToChat(AI.chat.image(prompt, { aspect: AI_STYLE[S.style].aspect || '1:1', refs: first && needRef ? 1 : 0, next: !first }), 'image', { open: !S.chatOn, note: '그림이 나오면 오른쪽 클릭 → 이미지 복사 후 아래 칸에 붙여 넣으세요' });
    S.chatOn = true; S.imgN = (S.imgN || 0) + 1; S.cur = mv; S.curPrompt = prompt;
    body.querySelectorAll('[data-cp]').forEach(x => x.classList.toggle('ai', x === b)); $('#aiZoneFor').textContent = `받을 그림: ${aiMoveName(mv)}`;
  });
  chatImgZone($('#aiZone'), async s => { sync(); const mv = S.cur || mvs[0]; await take(s, mv, S.curPrompt || aiComposePrompt(mv, false)); toast(`'${aiMoveName(mv)}' 그림을 받았습니다 — 아래에서 넣기를 누르세요`); });
}
// ════ AI 그림 만들기 (나라차 도장 고유 기능) ════
// 7단계: ① 용도 ② 그림체 ③ 참고 그림 ④ 주인공 ⑤ 인원 ⑥ 포즈 ⑦ 배경·상황·추가 요청 → 오른쪽에 'Gemini에 보낼 글'이 실시간으로 만들어짐
// 지시문은 Google 공식 가이드(Nano Banana) 방식: 첫 문장에 무엇을·비율, 서술형 문장, 하고 싶은 것을 긍정형으로, 글자 금지는 따옴표 없이
// 받은 그림은 네 모서리 색으로 배경을 지우고(흰색·크로마 그린·스티커 회색) 고른 내용으로 분류해 보관함(요소 → 나라차)에 넣음
const ST_USE = [
  ['element', '오려 쓰는 그림', '배경 없이 어디든 붙이기', '1:1', true, '정사각', 'full body, centered, with wide empty margins on all sides'],
  ['poster', '포스터 전체 그림', '위에 제목, 아래에 안내 자리', '3:4', false, '세로', 'subjects in the middle; keep the top 30% as a plain wall or sky for a headline and the bottom 15% plain for details'],
  ['sns', 'SNS 정사각', '인스타 · 카카오톡 · 블로그', '1:1', false, '정사각', 'subjects centered with comfortable space around them and a simple, pleasant background'],
  ['sns45', 'SNS 세로', '인스타 피드 세로 4:5', '4:5', false, '세로', 'subjects centered with comfortable space around them and a simple, pleasant background'],
  ['story', '숏츠·스토리', '휴대폰 세로 화면', '9:16', false, '휴대폰 세로', 'subjects in the middle; keep the top 15% and the bottom 25% simple for captions and app buttons'],
  ['wide', '가로 화면', '유튜브 · TV · 블로그 대표 그림', '16:9', false, '가로', ''],
  ['calendar', '달력 삽화', '달력 칸에 맞는 정사각', '1:1', false, '정사각', 'subjects centered with generous margin; the scene softly fades out toward the edges so it can be cropped'],
  ['deco', '카드·상장 장식', '작은 모서리 장식', '1:1', true, '정사각', 'a small, compact decorative illustration, centered, with wide margins'],
];
const ST_STYLES = [
  ['chibi', '귀여운 캐릭터', '큰 머리 · 큰 눈 · 밝은 색', '🧸', 'cute chibi character illustration', 'Draw it in a cute kawaii mascot style: about 2.5 heads tall, large sparkling eyes, rosy cheeks, soft cel shading and a clean, bold dark outline around every figure.', 'w'],
  ['flat', '플랫 일러스트', '깔끔한 면과 선', '🔷', 'flat vector illustration', 'Draw it as a modern flat vector illustration with simple geometric shapes, clean dark outlines and minimal shading.', 'w'],
  ['water', '수채화', '부드러운 손그림', '🎨', 'watercolor illustration', 'Paint it as a soft watercolor and ink illustration with gentle brush textures, light pastel washes and a hand-drawn ink line around every figure.', 'w'],
  ['clay', '3D 캐릭터', '말랑한 애니메이션 인형', '🧩', '3D character render', 'Render it like a cute character from a premium animated film: soft clay-like materials, rounded shapes, gentle studio lighting and high detail.', 'g'],
  ['webtoon', '웹툰', '선명한 한국 웹툰', '📖', 'Korean webtoon illustration', 'Draw it as a Korean webtoon panel: crisp dark line art around every figure, clean cel coloring and an expressive, dynamic pose.', 'w'],
  ['icon', '아이콘·픽토그램', '단순한 한 가지 색 그림', '🔣', 'simple pictogram icon', 'Make it a simple, bold pictogram icon in one solid navy color (#1E2B5A) with geometric shapes and no small details.', 'w'],
  ['photo', '실사 사진', '진짜 사진처럼', '📷', 'realistic photograph', 'Make it a high-quality realistic photograph with natural soft light, sharp focus and natural skin tones.', 'g'],
  ['line', '색칠 도안', '검은 선만 · 색칠놀이 종이', '✏️', 'black-and-white coloring page', 'Draw it as black-and-white coloring book line art for children: clean, uniform black outlines only, with large simple areas that are easy to color and no shading, gray or color fill.', null],
];
const ST_BG = { w: ['#ffffff', 'Place it on a perfectly flat, solid pure white (#FFFFFF) background that fills the whole canvas edge to edge, with no floor, no ground shadow and no gradient. A continuous dark outline separates every white part of the clothing from the white background.'], g: ['#00b140', 'Place it on a perfectly flat, solid chroma-key green (#00B140) background that fills the whole canvas edge to edge, evenly lit, with no gradient, no floor and no cast shadow.'], s: ['#d9d9d9', 'Place the sticker on a perfectly flat, solid light gray (#D9D9D9) background that fills the whole canvas edge to edge, with no gradient, no floor and no drop shadow under the sticker.'] };
const ST_REFS = [['none', '없음', '참고 그림 없이 그립니다', '➖'], ['racha', '라차 마스코트', '도장 펭귄을 똑같이', '🐧'], ['mine', '내 그림에서', '보관함의 그림을 참고', '🖼️'], ['file', '파일 올리기', '내 PC의 그림을 참고', '📁']];
const ST_REFROLE = [['same', '이 사람을 똑같이 (1번 사람)'], ['style', '그림체만 비슷하게']];
const ST_HERO = [['people', '사람', '수련생 · 사범님', '🧒'], ['racha', '라차만', '도장 펭귄 마스코트', '🐧'], ['both', '사람 + 라차', '함께 나와요', '🤝'], ['none', '배경만', '사람 없이 장소·계절', '🏞️']];
const ST_BELT = [['white', '흰띠', '#ffffff', 'a white belt'], ['yellow', '노란띠', '#f6c90e', 'a yellow belt'], ['orange', '주황띠', '#f39c12', 'an orange belt'], ['green', '초록띠', '#2e9e4f', 'a green belt'], ['blue', '파란띠', '#2f6fe4', 'a blue belt'], ['purple', '보라띠', '#8e44ad', 'a purple belt'], ['brown', '밤띠', '#7b4a2a', 'a brown belt'], ['red', '빨간띠', '#d63031', 'a red belt'], ['poom', '품띠', 'linear-gradient(90deg,#d63031 50%,#111 50%)', 'a red-and-black poom belt'], ['black', '검은띠', '#111111', 'a black belt'], ['mixed', '여러 색', 'conic-gradient(#f6c90e,#2e9e4f,#2f6fe4,#d63031,#f6c90e)', '']];
const ST_MOOD = [['happy', '😄', '밝게 웃음', 'a big, bright smile'], ['kiai', '😤', '기합!', 'shouting a powerful kihap with the mouth open'], ['focus', '🧐', '진지한 집중', 'a serious, focused expression'], ['proud', '😊', '뿌듯함', 'a proud, confident smile'], ['wink', '😉', '윙크', 'a playful wink'], ['wow', '😲', '깜짝', 'a surprised, excited face'], ['moved', '🥹', '감동', 'touched, happy tears in the eyes']];
// 옷: [키, 이름, 영어, 띠를 맴, 도복 상의(V넥 깃·가슴 엠블럼)] — 나라차 운영규정 '수련 복장 규정'(흰 도복 원칙, 흰 상의+검정 바지·검정 도복·나라차 티셔츠+검정 바지 허용)
const ST_OUTFIT = [['dobok', '흰 도복', 'a clean white taekwondo dobok (white V-neck pullover top and white pants)', true, true], ['blackpants', '흰 상의+검정 바지', 'a white taekwondo dobok top (V-neck pullover) with black dobok pants', true, true], ['black', '검정 도복', 'a black taekwondo dobok (black V-neck pullover top and black pants)', true, true], ['tee', '나라차 티셔츠', 'a navy long-sleeve T-shirt with black dobok pants', true, false], ['gear', '겨루기 보호구', 'a white taekwondo dobok with full sparring gear: a blue or red chest protector, headgear, forearm and shin guards and gloves', true, false], ['hanbok', '한복', 'a colorful traditional Korean hanbok', false, false], ['casual', '평상복', 'casual everyday clothes', false, false]];
const ST_DOBOK = 'The dobok top is a taekwondo-style pullover with a V-neck opening, not a wrap-over judo or karate jacket, so there are no overlapping lapels. The V-neck collar is a contrasting trim band that ends in a small black square at the bottom point of the V.';
const ST_EMBLEM = 'a red dot and a short red stroke above a large curved navy-blue swoosh, together shaped like a flying-kick figure, symbol only with no text';
const ST_AGE = [['kid-m', '어린이 남자', '👦', 'boy', 'about 8 years old', 'm'], ['kid-f', '어린이 여자', '👧', 'girl', 'about 8 years old', 'f'], ['tod-m', '유아 남자', '🧒', 'little boy', 'about 5 years old', 'm'], ['tod-f', '유아 여자', '👶', 'little girl', 'about 5 years old', 'f'], ['teen-m', '청소년 남자', '🧑', 'teenage boy', 'about 15 years old', 'm'], ['teen-f', '청소년 여자', '👱‍♀️', 'teenage girl', 'about 15 years old', 'f'], ['man', '성인 남자', '👨', 'man', 'in his 30s', 'm'], ['woman', '성인 여자', '👩', 'woman', 'in her 30s', 'f'], ['master-m', '사범님 (남)', '🥋', 'taekwondo master instructor, a kind and confident man', 'in his 40s', 'm'], ['master-f', '사범님 (여)', '🥋', 'taekwondo master instructor, a kind and confident woman', 'in her 40s', 'f']];
const ST_HAIR = { m: ['a short neat haircut', 'a bowl cut', 'short curly hair', 'a buzz cut', 'short spiky hair', 'side-parted hair'], f: ['a high ponytail', 'two braids', 'a bob cut', 'pigtails', 'long straight hair with a headband', 'a low bun'] };
const ST_RACE = [['kr', '한국인', 'Korean'], ['white', '백인', 'white'], ['black', '흑인', 'Black'], ['sea', '동남아시아', 'Southeast Asian'], ['sa', '남아시아', 'South Asian'], ['latin', '라틴', 'Latino'], ['mixed', '여러 인종 섞임', 'mixed-race']];
const ST_POSE = [['ready', '준비 자세', 'standing in the taekwondo ready stance (junbi) with fists about one fist-width in front of the lower belly'], ['bow', '경례(인사)', 'bowing politely in the taekwondo way: the upper body bent forward about 30 degrees at the waist, head lowered, arms straight down at the sides, seen from a three-quarter side view so the bend at the waist is clearly visible (not a hand salute)'], ['frontkick', '앞차기', 'performing a high front kick (ap chagi), striking with the ball of the foot with the toes pulled back'], ['sidekick', '옆차기', 'performing a powerful side kick (yeop chagi), striking with the edge and heel of the foot, the supporting foot turned away'], ['roundkick', '돌려차기', 'performing a dynamic roundhouse kick (dollyeo chagi)'], ['backkick', '뒤차기', 'performing a back kick (dwit chagi)'], ['axekick', '내려차기', 'performing an axe kick (naeryeo chagi) with the leg raised high'], ['jumpkick', '뛰어 차기', 'jumping high in the air doing a flying kick'], ['punch', '지르기', 'throwing a straight middle punch (jireugi) in a front stance'], ['block', '막기', 'doing a low block (arae makgi) in a front stance'], ['poomsae', '품새', 'performing a graceful poomsae form movement'], ['break', '격파', 'breaking a wooden board with a kick, splinters flying'], ['medal', '메달·트로피', 'holding up a shiny gold medal and a trophy, celebrating'], ['thumb', '엄지 척', 'giving an energetic thumbs-up'], ['wave', '손 흔들기', 'waving hello'], ['cheer', '만세·파이팅', 'jumping with both fists raised in a cheer'], ['heart', '손하트', 'making a finger heart with one hand'], ['point', '가리키기(안내)', 'pointing to the side with one open hand as if introducing something'], ['sign', '빈 팻말 들기', 'holding up a blank sign board with both hands'], ['run', '줄넘기', 'jumping rope happily'], ['stretch', '스트레칭', 'doing a split stretch on a mat'], ['sit', '앉아서 웃기', 'sitting cross-legged']];
const ST_FLIPPER = { thumb: 'raising one flipper in a cheerful thumbs-up gesture', heart: 'making a heart shape with both flippers', point: 'pointing to the side with one flipper as if introducing something', wave: 'waving hello with one flipper', sign: 'holding up a blank sign board with both flippers', punch: 'punching forward with one flipper in a front stance', medal: 'holding up a shiny gold medal with both flippers, celebrating', cheer: 'jumping with both flippers raised in a cheer' };
const ST_GROUP = [['photo', '단체 기념사진', '앞줄 앉고 뒷줄 서서', 'posing for a group photo'], ['line', '나란히 준비 자세', '한 줄로 서서', 'standing side by side in a neat line, all in the taekwondo ready stance'], ['kiai', '다 같이 기합', '주먹을 위로 번쩍', 'all shouting kihap together with fists raised high'], ['sync', '맞춰서 발차기', '같은 순간 같은 발차기', 'all performing the same high front kick at the same moment in perfect sync'], ['hi5', '하이파이브', '서로 손바닥을 마주침', 'giving each other high-fives'], ['trophy', '시상 축하', '트로피·메달 들고', 'celebrating together holding trophies and gold medals'], ['spar', '겨루기', '둘이 마주 보고', 'facing each other in a friendly sparring match, one kicking and one blocking'], ['master', '사범님과 아이들', '사범님이 가운데서 지도', 'gathered around the master instructor in the center, following the movement'], ['bow', '다 같이 경례', '공손하게 인사', 'all bowing politely together in the taekwondo way: upper bodies bent forward about 30 degrees at the waist, heads lowered, arms straight down at the sides, seen from a three-quarter side view so the bend at the waist is clearly visible (not a hand salute)'], ['circle', '파이팅 손 모으기', '둥글게 서서 손을 모음', 'standing in a circle putting their hands together in the middle for a team cheer']];
// 배경·상황: [키, 묶음, 그림, 이름, 배경으로 쓸 때, 소품으로만 쓸 때]
const ST_SCENE = [
  ['spring', 'time', '🌸', '봄 벚꽃', 'a spring day with cherry blossoms', 'cherry blossom branches'], ['summer', 'time', '🌊', '여름', 'a bright summer day with water splashes', 'a beach ball and water splashes'], ['autumn', 'time', '🍁', '가을 단풍', 'an autumn day with maple leaves', 'maple leaves'], ['winter', 'time', '⛄', '겨울 눈', 'a snowy winter day', 'a small snowman and snowflakes'], ['seol', 'time', '🧧', '설날', 'Korean Lunar New Year with traditional patterns', 'a traditional lucky bag (bokjumeoni)'], ['chuseok', 'time', '🌕', '추석', 'Chuseok night with a big full moon', 'songpyeon rice cakes'], ['kidsday', 'time', '🎈', '어린이날', 'Korean Children\'s Day with balloons and pinwheels', 'balloons and a pinwheel'], ['xmas', 'time', '🎄', '크리스마스', 'Christmas with gifts and twinkling lights', 'a gift box and a Santa hat'], ['halloween', 'time', '🎃', '할로윈', 'a friendly Halloween', 'a smiling pumpkin'],
  ['newterm', 'event', '🌱', '새 학기·모집', 'a fresh new semester in early spring', 'a school backpack and fresh sprouts'], ['trial', 'event', '🎟️', '무료 체험 수업', 'a welcoming first trial class', 'a welcome ribbon'], ['exam', 'event', '🎖️', '승급심사', 'belt promotion test day', 'a new belt and a certificate scroll'], ['contest', 'event', '🏆', '대회·시상', 'a taekwondo competition award ceremony', 'a trophy and medals'], ['demo', 'event', '🎤', '시범 공연', 'a taekwondo demonstration performance on a stage', 'stage lights and wooden boards'], ['open', 'event', '👨‍👩‍👧', '부모님 참관', 'an open class with parents happily watching', 'a small clapping crowd'], ['bday', 'event', '🎂', '생일 파티', 'a birthday party', 'balloons and a birthday cake'], ['camp', 'event', '⛺', '방학 캠프', 'a fun outdoor vacation camp', 'a small tent'], ['entrance', 'event', '🎒', '입학', 'a school entrance day', 'a school backpack'], ['graduation', 'event', '🎓', '졸업', 'a graduation celebration', 'a graduation cap and a bouquet'],
  ['dojang', 'place', '🏠', '도장 안', 'inside a bright, modern taekwondo dojang with blue and red mats', 'taekwondo mats and a wooden practice board'], ['park', 'place', '🛝', '동네 놀이터 공원', 'a typical Korean neighborhood children\'s park on a sunny day, with a colorful playground slide, swings, a sandbox, soft rubber safety flooring, leafy trees and benches', 'a small colorful playground slide and a swing'], ['school', 'place', '🏫', '학교 운동장', 'a Korean elementary school playground with a sandy field, a soccer goal and the school building in the distance', 'a soccer ball'], ['stage', 'place', '🎪', '무대', 'a bright stage with spotlights', 'spotlights'], ['sky', 'place', '☁️', '하늘', 'a clear blue sky with soft clouds', 'soft clouds'],
];
const ST_SCENE_G = [['time', '때 · 계절 · 명절'], ['event', '도장 행사'], ['place', '장소']];
const ST_EXTRA = [['medal', '금메달 목에 걸기', 'wearing a gold medal around the neck'], ['flag', '태극기 들기', 'holding a small Korean flag (Taegeukgi)'], ['hands', '친구와 손잡기', 'holding hands with a friend'], ['bubble', '말풍선 자리 비우기', 'leave empty space beside the head for a speech bubble'], ['glasses', '안경', 'wearing glasses'], ['front', '정면 보며 웃기', 'smiling and facing the viewer'], ['sparkle', '반짝이 효과', 'small sparkle effects around the characters']];
const ST_CATS = { char: ['ai-char', 'AI 캐릭터·사람'], sticker: ['ai-sticker', 'AI 스티커'], scene: ['ai-scene', 'AI 배경·장면'], photo: ['ai-photo', 'AI 사진'], coloring: ['ai-coloring', 'AI 색칠 도안'], icon: ['ai-icon', 'AI 아이콘'], mascot: ['ai-mascot', 'AI 라차'] };
const ST_STEPS = [['용도', '어디에 쓸 그림인가요?'], ['그림체', '어떤 그림체로 그릴까요?'], ['참고 그림', '참고할 그림이 있나요?'], ['주인공', '누가 나오나요?'], ['인원', '몇 명이, 누가 나오나요?'], ['포즈', '어떤 동작을 할까요?'], ['배경·추가', '배경·상황과 더 바라는 점']];
const ST_QUICK = [
  ['🐧 라차 스티커', { use: 'element', style: 'chibi', sticker: true, ref: 'racha', hero: 'racha', rachaPose: 'thumb', mood: 'happy', scenes: [] }],
  ['📣 모집 포스터', { use: 'poster', style: 'chibi', ref: 'none', hero: 'people', belt: 'yellow', mood: 'happy', outfit: 'dobok', people: [{ age: 'kid-m', race: 'kr', belt: '', pose: 'frontkick' }, { age: 'kid-f', race: 'kr', belt: '', pose: 'thumb' }], poseMode: 'each', scenes: ['newterm', 'dojang'], brand: true }],
  ['🌏 다국적 단체 사진', { use: 'sns', style: 'flat', ref: 'none', hero: 'people', belt: 'mixed', mood: 'happy', outfit: 'dobok', people: [{ age: 'kid-m', race: 'kr', belt: '' }, { age: 'kid-f', race: 'white', belt: '' }, { age: 'kid-m', race: 'black', belt: '' }, { age: 'kid-f', race: 'sea', belt: '' }, { age: 'master-m', race: 'kr', belt: 'black' }], poseMode: 'group', group: 'photo', scenes: ['dojang'], brand: true }],
  ['✏️ 색칠 도안', { use: 'poster', style: 'line', ref: 'none', hero: 'people', belt: 'white', mood: 'happy', outfit: 'dobok', people: [{ age: 'kid-m', race: 'kr', belt: '', pose: 'sidekick' }], poseMode: 'each', scenes: [] }],
  ['🌸 계절 배경', { use: 'wide', style: 'water', ref: 'none', hero: 'none', scenes: ['spring', 'park'] }],
];
const STU_DEF = { step: 1, use: 'element', style: 'chibi', sticker: false, brand: false, ref: 'none', refRole: 'same', mineId: '', hero: 'people', belt: 'yellow', mood: 'happy', outfit: 'dobok', logo: true, people: [{ age: 'kid-m', race: 'kr', belt: '', pose: 'frontkick' }], rachaPose: 'frontkick', poseMode: 'each', group: 'photo', scenes: [], extras: [], extra: '', cut: true, autoSave: true, quick: -1 };
let stu = (() => { try { const v = Object.assign(clone(STU_DEF), JSON.parse(localStorage.getItem('naracal-studio') || '{}')); if (!ST_USE.some(u => u[0] === v.use)) v.use = 'element'; if (!ST_STYLES.some(s => s[0] === v.style)) { if (v.style === 'sticker') v.sticker = true; v.style = 'chibi'; } v.people = (v.people || []).slice(0, 6).map(p => Object.assign({ age: 'kid-m', race: 'kr', belt: '', pose: 'ready' }, p, { age: ST_AGE.some(a => a[0] === p.age) ? p.age : p.age === 'master' ? 'master-m' : 'kid-m', race: ST_RACE.some(r => r[0] === p.race) ? p.race : 'kr' })); if (!v.people.length) v.people = clone(STU_DEF.people); if (v.ref === 'logo') v.ref = 'none'; if (!ST_OUTFIT.some(o => o[0] === v.outfit)) v.outfit = 'dobok'; /* 옛 '시범단 도복' 등 */ v.scenes = (v.scenes || []).filter(k => ST_SCENE.some(x => x[0] === k)); v.extras = (v.extras || []).filter(k => ST_EXTRA.some(x => x[0] === k)); if (!ST_HERO.some(h => h[0] === v.hero)) v.hero = 'people'; return v; } catch (e) { return clone(STU_DEF); } })();
let stuRefFile = '', stuEdited = '', stuChatN = 0, stuChatOpen = false, stuRefDone = false, stuSnap = null, stuSig = '', stuVisited = new Set([1]);
const stuSave = () => { try { localStorage.setItem('naracal-studio', JSON.stringify(stu)); } catch (e) {} };
const stFind = (L, k) => L.find(x => x[0] === k) || L[0];
const stuUseOf = S => stFind(ST_USE, S.use), stuStyleOf = S => stFind(ST_STYLES, S.style);
const stuStickerOn = S => S.sticker && stuUseOf(S)[4] && S.style !== 'line';
const stuCutOf = S => S.cut && stuUseOf(S)[4] && stuStyleOf(S)[6] !== null;
const stuBgOf = S => stuStickerOn(S) ? ST_BG.s : ST_BG[stuStyleOf(S)[6]] || ST_BG.w;
const stuPeopleOf = S => S.hero === 'people' || S.hero === 'both' ? S.people : [];
const stuIsMaster = p => /^master/.test(p.age);
const stuBeltKey = (S, p, i) => p.belt || (stuIsMaster(p) ? 'black' : S.belt === 'mixed' ? ['yellow', 'green', 'blue', 'red', 'orange', 'purple'][i % 6] : S.belt);
function stuBaseRefs(S) {
  S = S || stu;
  if (S.ref === 'racha') return [ASSETS['mascot-03'], ASSETS['mascot-01']].filter(Boolean);
  if (S.ref === 'mine') { const it = NC.lib.mine().find(x => x.id === S.mineId); return it ? [NC.lib.url(it.file)].filter(Boolean) : []; }
  if (S.ref === 'file') return stuRefFile ? [stuRefFile] : [];
  return [];
}
// 도복 가슴 엠블럼: 사람이 도복 상의·나라차 티셔츠를 입거나 라차가 나올 때
const stuLogoOn = S => !!S.logo && S.hero !== 'none' && (S.hero !== 'people' || stFind(ST_OUTFIT, S.outfit)[4] || S.outfit === 'tee') && !['line', 'icon'].includes(S.style);
// 엠블럼 그림: 가로형 로고(brand-horizontal)의 왼쪽 심볼만 잘라 한 번 만들어 둠
let stuEmblemUrl = '', stuEmblemBusy = false, stuOnEmblem = null;
function stuEmblem() {
  if (stuEmblemUrl || stuEmblemBusy || !ASSETS['brand-horizontal']) return stuEmblemUrl;
  stuEmblemBusy = true;
  AI.loadImg(ASSETS['brand-horizontal']).then(im => { const k = 2000 / im.naturalWidth, W = 2000, H = Math.round(im.naturalHeight * k), c = document.createElement('canvas'); c.width = Math.round(W * 0.24); c.height = H; c.getContext('2d').drawImage(im, 0, 0, W, H); stuEmblemUrl = stuTrim(c).toDataURL('image/png'); if (stuOnEmblem) stuOnEmblem(); }).catch(() => {});
  return '';
}
// 그림 둘레의 빈 곳(투명·흰색)을 잘라냄 — 참고 그림 판에서 대상이 작아지지 않게
function stuTrim(src) {
  const W = src.width, H = src.height, d = src.getContext('2d').getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; if (d[i + 3] > 16 && (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 < 0) return src; const pad = 4, c = document.createElement('canvas'); x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); c.width = Math.min(W, x1 + pad) - x0; c.height = Math.min(H, y1 + pad) - y0; c.getContext('2d').drawImage(src, -x0, -y0); return c;
}
function stuRefSrc(S) { S = S || stu; const L = stuBaseRefs(S); if (stuLogoOn(S) && stuEmblem()) L.push(stuEmblemUrl); return L; }
// 참고 그림 판: 목표 비율 캔버스 가운데에 나란히 (비율이 가로로 늘어나지 않게 — 공식 가이드: 원하는 비율의 참고 그림을 주는 것이 가장 확실)
async function stuRefSheet(list, aspect) {
  const [aw, ah] = aspect.split(':').map(Number), W = aw >= ah ? 1024 : Math.round(1024 * aw / ah), H = aw >= ah ? Math.round(1024 * ah / aw) : 1024;
  const ims = (await Promise.all(list.map(AI.loadImg))).map(im => { const t = document.createElement('canvas'); t.width = im.naturalWidth; t.height = im.naturalHeight; t.getContext('2d').drawImage(im, 0, 0); return stuTrim(t); });
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const wt = list.map(u => u === stuEmblemUrl ? 0.45 : 1), sum = wt.reduce((a, b) => a + b, 0), gap = W * 0.04, unit = (W * 0.9 - gap * (ims.length - 1)) / sum; let ox = W * 0.05;
  ims.forEach((im, i) => { const boxW = unit * wt[i], boxH = H * 0.9 * (wt[i] < 1 ? 0.45 : 1), k = Math.min(boxW / im.width, boxH / im.height), w = im.width * k, h = im.height * k; x.drawImage(im, ox + (boxW - w) / 2, (H - h) / 2, w, h); ox += boxW + gap; });
  return c.toDataURL('image/png');
}
const stuOrient = a => { const [w, h] = a.split(':').map(Number); return w === h ? 'square' : w > h ? 'horizontal (landscape)' : 'vertical (portrait)'; };
// Gemini에 보낼 영어 글 (next: 같은 대화에서 이어 그리기)
function stuPrompt(S, next) {
  S = S || stu;
  const use = stuUseOf(S), st = stuStyleOf(S), aspect = use[3], orient = stuOrient(aspect), cut = stuCutOf(S), sticker = stuStickerOn(S);
  const ppl = stuPeopleOf(S), racha = S.hero === 'racha' || S.hero === 'both', none = S.hero === 'none', refs = stuBaseRefs(S).length, logo = stuLogoOn(S) && !!stuEmblemUrl, outfit = stFind(ST_OUTFIT, S.outfit);
  const group = ppl.length > 1 && S.poseMode === 'group', n = ppl.length + (racha ? 1 : 0);
  const hairIdx = { m: 0, f: 0 };
  const personOf = (p, i) => { const a = stFind(ST_AGE, p.age), race = stFind(ST_RACE, p.race)[2], hair = ST_HAIR[a[5]][(hairIdx[a[5]]++) % 6], bk = stuBeltKey(S, p, i), belt = outfit[3] ? `, ${stFind(ST_BELT, bk)[3]}${outfit[4] ? ` and ${bk === 'black' ? 'a black' : 'a red-and-black'} collar` : ''}` : ''; return `${/^master/.test(p.age) ? `the ${race} ${a[3]} ${a[4]}` : `a ${race} ${a[3]}, ${a[4]}`}, with ${hair}${belt}`; };
  const rachaDobok = 'a white taekwondo dobok (V-neck pullover top with a black collar, not a wrap-over judo jacket) and a black belt';
  const rachaDesc = S.ref === 'racha' && refs ? `Racha, our penguin mascot (as in the reference sheet), in ${rachaDobok}` : `Racha, our taekwondo dojang's penguin mascot: a cute, round gray penguin with a dark gray head and back, a white face and belly, an orange beak and feet, wearing ${rachaDobok}`;
  const rachaPose = ST_FLIPPER[S.rachaPose] || stFind(ST_POSE, S.rachaPose)[2];
  const rachaAlone = S.ref === 'racha' && refs ? `Racha wears ${rachaDobok} and is ${rachaPose}.` : `Racha is a cute, round gray penguin with a dark gray head and back, a white face and belly, and an orange beak and feet. He wears ${rachaDobok} and is ${rachaPose}.`;
  const what = none ? 'a background scene' : n === 1 ? (racha ? 'Racha, our taekwondo dojang\'s penguin mascot' : 'a taekwondo student') : `${n} taekwondo ${racha && ppl.length ? 'friends (people and our penguin mascot)' : 'members'}`;
  const L = [];
  if (next) L.push(`Now create the next ${orient} ${aspect} image in this same series. Keep exactly the same art style, line weight, color palette and ${stuSig === stuSigOf(S) ? 'the same character designs (faces, hairstyles, body proportions, outfits)' : 'the same character design style'} as the image you just made. What changes is described below.`);
  else L.push(`Create a ${orient} ${aspect} ${st[4]}${sticker ? ' (die-cut sticker)' : ''} of ${what}.`);
  if (!next && !refs && logo) L.push('The attached image shows our NARACHA emblem (the red-and-navy symbol).');
  if (!next && refs) L.push((S.ref === 'racha' ? 'The attached reference sheet shows Racha, our penguin mascot, from two angles. Draw Racha exactly as in the reference: same body shape, proportions, face, colors and outfit. If any written description below differs from the reference, follow the reference.' : S.refRole === 'same' ? 'The person in the attached image is subject 1: keep the same face, hairstyle and body proportions.' : 'Match the art style, line weight and colors of the attached reference image.') + (logo ? ' The small red-and-navy symbol on the right of the reference sheet is our NARACHA emblem.' : ''));
  if (none) L.push('There are no people, animals or characters at all, only the scene.');
  else if (n === 1) L.push(racha ? rachaAlone : `The subject is ${personOf(ppl[0], 0)}, wearing ${outfit[2]}, ${stFind(ST_POSE, ppl[0].pose || 'ready')[2]}.`);
  else {
    if (ppl.length) {
      L.push(`${ppl.length > 2 ? `All ${ppl.length} people wear` : ppl.length === 2 ? 'Both people wear' : 'The person wears'} ${outfit[2]}${outfit[3] ? (ppl.length > 1 ? ' and have bare feet' : ' and has bare feet') : ''}.`);
      const list = ppl.map((p, i) => `${i + 1}) ${personOf(p, i)}${group ? '' : ', ' + stFind(ST_POSE, p.pose || 'ready')[2]}`);
      if (group && S.group === 'photo' && ppl.length >= 4) { /* 단체 사진: 사범님·어른·청소년은 뒷줄(사범님 가운데), 어린이는 앞줄 */ const tall = p => /^(master|man|woman|teen)/.test(p.age); let back = list.filter((x, i) => tall(ppl[i])), front = list.filter((x, i) => !tall(ppl[i])); if (!back.length || !front.length) { const h = Math.ceil(ppl.length / 2); back = list.slice(0, h); front = list.slice(h); } const mi = back.findIndex(x => /master/.test(x)); if (mi >= 0 && back.length > 2) back.splice(Math.floor(back.length / 2), 0, back.splice(mi, 1)[0]); L.push(`${back.length === 1 ? `Standing behind the children in the center: ${back[0]}` : `Back row, standing, from left to right: ${back.join('; ')}`}. Front row, ${front.length > 3 ? 'kneeling' : 'standing slightly in front'}, from left to right: ${front.join('; ')}.`); }
      else L.push(`From left to right: ${list.join('; ')}.`);
    }
    if (racha) L.push(`With them is ${rachaDesc}, ${group ? 'joining in' : rachaPose}.`);
    if (group) L.push(`Together they are ${stFind(ST_GROUP, S.group)[3]}.`);
    L.push(`Exactly ${ppl.length ? `${ppl.length} ${ppl.length > 1 ? 'people' : 'person'}` : ''}${ppl.length && racha ? ' and one penguin mascot' : ''}, no one else in the scene.`);
    if (new Set(ppl.map(p => p.race)).size > 1) L.push('Show natural, varied skin tones and hair textures; everyone is dressed identically in taekwondo uniforms, with no cultural costumes or stereotyped accessories.');
  }
  if (!none) L.push(`${n > 1 ? 'Everyone has' : 'The expression is'} ${stFind(ST_MOOD, S.mood)[3]}.`);
  const ex = S.extras.map(k => stFind(ST_EXTRA, k)[2]); if (S.extra.trim()) ex.push(S.extra.trim());
  if (ex.length) L.push(`Extra details from the user (some may be written in Korean): ${ex.join('; ')}. Apply them to the picture and never draw them as text. If they conflict with anything above, follow these extra details.`);
  const sc = S.scenes.map(k => stFind(ST_SCENE, k));
  if (cut && sc.length && !none) L.push(`Add two or three small props related to the theme (${sc.map(x => x[5]).join(', ')}) that touch or overlap the characters, so everything forms one connected group; the background itself stays empty.`);
  else if (sc.length) L.push(`Setting: ${sc.map(x => x[4]).join(', ')}.`);
  let comp = use[4] && !cut ? (none ? 'a full scene filling the whole picture' : 'full body, centered, with the setting filling the whole picture around them') : use[6];
  if (S.use === 'wide') comp = n === 1 ? 'the subject on the left third, keeping the right two thirds clear for text' : none ? 'a wide, calm scene with clear open space in the center for text' : 'subjects on the left and right sides, keeping the center clear for text';
  if (comp) L.push(`Composition: ${comp}.`);
  L.push(st[5]);
  if (S.brand && !['line', 'icon', 'photo'].includes(S.style)) L.push('Use our brand colors as accents in the props and background: navy #1E2B5A, red #E0564B and warm yellow #FFE89A.');
  if (sticker) L.push('Turn it into a die-cut sticker with a thick, even white border around the entire silhouette.');
  if (cut) L.push(stuBgOf(S)[1]);
  if (ppl.length && outfit[3] && S.style !== 'icon') L.push(`Taekwondo details: ${ppl.length > 1 ? 'everyone has bare feet' : 'bare feet'}. ${ppl.length > 1 ? 'Each belt' : 'The belt'} wraps twice around the waist and is tied in a flat knot at the front center, with two equal-length ends hanging down. Hands look natural, with five fingers each.`);
  if (ppl.length && outfit[4] && S.style !== 'icon') L.push(ST_DOBOK);
  const logoNow = stuLogoOn(S);
  if (logoNow) { const tee = ppl.length && S.outfit === 'tee', many = n > 1; L.push(`${logo ? 'Copy the emblem from the reference exactly and place' : 'Place'} a small ${tee ? 'white one-color ' : ''}NARACHA emblem on the left chest of ${many ? 'every top' : 'the top'}${tee ? ' (T-shirt)' : ''}: ${ST_EMBLEM}. It is small, about the size of a palm.`); }
  L.push(logoNow ? 'Apart from that small chest emblem, there are no words, letters, numbers or other logos anywhere in the image.' : 'There are no words, letters, numbers or logos anywhere in the image.');
  L.push(`The final image must be ${orient} ${aspect}${aspect === '1:1' ? '' : ', not square'}.`);
  return { en: L.join(' '), aspect, cut };
}
const stuSigOf = S => [S.hero, S.style, ...stuPeopleOf(S).map(p => p.age + p.race)].join('|');
function stuSummary(S) {
  S = S || stu; const use = stuUseOf(S), ppl = stuPeopleOf(S);
  const who = ppl.map(p => `${stFind(ST_AGE, p.age)[1]}${p.race !== 'kr' ? '(' + stFind(ST_RACE, p.race)[1] + ')' : ''}`); if (S.hero === 'racha' || S.hero === 'both') who.push('라차');
  const pose = S.hero === 'none' ? '—' : ppl.length > 1 && S.poseMode === 'group' ? stFind(ST_GROUP, S.group)[1] : [...new Set(ppl.map(p => stFind(ST_POSE, p.pose || 'ready')[1]).concat(S.hero !== 'people' ? [stFind(ST_POSE, S.rachaPose)[1]] : []))].join('·');
  const dress = S.hero === 'none' ? '—' : !ppl.length ? `라차(검은띠${stuLogoOn(S) ? '·엠블럼' : ''}) · ${stFind(ST_MOOD, S.mood)[2]}` : `${stFind(ST_BELT, S.belt)[1]} · ${stFind(ST_MOOD, S.mood)[2]} · ${stFind(ST_OUTFIT, S.outfit)[1]}${stuLogoOn(S) ? ' · 엠블럼' : ''}`;
  return [['용도', `${use[1]} · ${use[5]}${stuCutOf(S) ? ' · 배경 없음' : ''}`], ['그림체', stuStyleOf(S)[1] + (stuStickerOn(S) ? ' · 스티커' : '')], ['참고', S.ref === 'none' ? '없음' : stFind(ST_REFS, S.ref)[1]], ['주인공', S.hero === 'none' ? '배경만' : who.join(', ')], ['차림', dress], ['포즈', pose], ['배경', S.scenes.length ? S.scenes.map(k => stFind(ST_SCENE, k)[3]).join(', ') + (stuCutOf(S) && S.hero !== 'none' ? ' (소품으로만)' : '') : '—'], ['추가', S.extras.map(k => stFind(ST_EXTRA, k)[1]).concat(S.extra.trim() ? [S.extra.trim()] : []).join(', ') || '—']];
}
function stuStepSub(n) {
  const S = stu, ppl = stuPeopleOf(S), sum = stuSummary(S);
  return [sum[0][1], sum[1][1], S.ref === 'none' ? '없음' : stFind(ST_REFS, S.ref)[1], S.hero === 'none' ? '배경만' : `${stFind(ST_HERO, S.hero)[1]}${ppl.length ? ' · ' + stFind(ST_BELT, S.belt)[1] : ''}`, ppl.length ? `${ppl.length}명` : S.hero === 'none' ? '건너뜀' : '라차만', sum[5][1], [sum[6][1], sum[7][1]].filter(v => v !== '—').join(' · ') || '선택 안 함'][n - 1];
}
const stuSkip = n => (n === 5 && !stuPeopleOf(stu).length) || (n === 6 && stu.hero === 'none');
// 받은 그림의 보관 분류·이름·검색어
function stuClassify(S) {
  S = S || stu; const ppl = stuPeopleOf(S), cut = stuCutOf(S);
  const k = S.style === 'line' ? 'coloring' : S.style === 'icon' ? 'icon' : S.style === 'photo' ? 'photo' : S.hero === 'racha' ? 'mascot' : stuStickerOn(S) ? 'sticker' : S.hero === 'none' ? 'scene' : cut ? 'char' : 'scene';
  const pose = S.hero === 'none' ? '배경' : ppl.length > 1 && S.poseMode === 'group' ? stFind(ST_GROUP, S.group)[1] : stFind(ST_POSE, S.hero === 'racha' ? S.rachaPose : (ppl[0] || {}).pose || 'ready')[1];
  const who = S.hero === 'none' ? '' : S.hero === 'racha' ? '라차' : (ppl.length > 1 ? `${ppl.length}명` : `${stFind(ST_AGE, (ppl[0] || {}).age || 'kid-m')[1]} ${stFind(ST_BELT, stuBeltKey(S, ppl[0] || {}, 0))[1]}`) + (S.hero === 'both' ? '+라차' : '');
  const scene = S.scenes.map(x => stFind(ST_SCENE, x)[3]);
  const name = [pose, who, scene[0]].filter(Boolean).join(' · ') + ` (${stuStyleOf(S)[1]})`;
  const kw = ['AI', stuStyleOf(S)[1], stuUseOf(S)[1], stuUseOf(S)[5], cut ? '투명 배경 누끼 PNG' : '배경 있음', ppl.length > 1 ? '단체' : '', stFind(ST_MOOD, S.mood)[2], ppl.length ? stFind(ST_OUTFIT, S.outfit)[1] : '', pose, who, ...ppl.map(p => `${stFind(ST_AGE, p.age)[1]} ${stFind(ST_RACE, p.race)[1]} ${stFind(ST_BELT, stuBeltKey(S, p, 0))[1]}`), ...scene, S.hero === 'racha' || S.hero === 'both' ? '라차 마스코트 펭귄' : '', stuLogoOn(S) ? '나라차 로고 엠블럼' : '', '태권도 나라차', ...S.extras.map(e => stFind(ST_EXTRA, e)[1]), S.extra].filter(Boolean).join(' ');
  return { cat: ST_CATS[k][0], catName: ST_CATS[k][1], name, kw };
}
// 되돌리기 단추가 있는 알림 (문서 되돌리기와 따로)
function toastAction(msg, label, fn) { const t = $('#toast'); t.className = 'toast act'; t.innerHTML = `<span>${esc(msg)}</span><button type="button">${esc(label)}</button>`; toastShow(t); t.querySelector('button').onclick = () => { toastHide(t); fn(); }; clearTimeout(toastTimer); toastTimer = setTimeout(() => toastHide(t), 7000); }
// 받은 그림 배경 지우기: 네 모서리 색을 재서 그 색을 지움(Gemini는 지시한 색을 정확히 지키지 않음), 크로마 그린은 그림 전체에서
async function stuCutImage(s, S) {
  const img = await AI.loadImg(s), W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const pick = (px, py) => x.getImageData(Math.min(W - 6, Math.max(0, px)), Math.min(H - 6, Math.max(0, py)), 6, 6).data; let r = 0, g = 0, b = 0, n = 0;
  [[2, 2], [W - 8, 2], [2, H - 8], [W * 0.5, 2]].forEach(([px, py]) => { const d = pick(Math.round(px), Math.round(py)); for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } });
  const hex = '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join(''), want = stuBgOf(S)[0], dist = (h1, h2) => [1, 3, 5].reduce((a, i) => a + Math.abs(parseInt(h1.substr(i, 2), 16) - parseInt(h2.substr(i, 2), 16)), 0);
  const green = want === '#00b140';
  let out = await NC.imgedit.removeColorFromSrc(s, hex, green ? { tol: 40, connected: false } : {});
  // 오른쪽 아래 모서리에 따로 떨어진 작은 표시(Gemini 반짝이)를 지움 — 본 그림과 떨어져 있을 때만
  try { const im2 = await AI.loadImg(out), c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const y = c2.getContext('2d'); y.drawImage(im2, 0, 0); const d = y.getImageData(0, 0, W, H).data, cx = Math.round(W * 0.88), cy = Math.round(H * 0.88);
    let mainR = 0, mainB = 0, cornerN = 0; for (let yy = 0; yy < H; yy += 2) for (let xx = 0; xx < W; xx += 2) { if (d[(yy * W + xx) * 4 + 3] < 40) continue; if (xx >= cx && yy >= cy) cornerN++; else { if (xx > mainR) mainR = xx; if (yy > mainB) mainB = yy; } }
    if (cornerN && (mainR < cx - W * 0.02 || mainB < cy - H * 0.02)) { y.clearRect(cx, cy, W - cx, H - cy); out = c2.toDataURL('image/png'); } } catch (e) {}
  return { src: out, warn: dist(hex, want) > 90 ? '배경색이 예상과 달라 지우기가 깔끔하지 않을 수 있어요 — 이미지 편집기에서 다듬으세요' : '' };
}
function renderStudio(body) {
  const CN = (CHAT_SITES[AI.cfg.chatImage] || ['AI'])[0], el = selEls()[0], targetImg = el && el.type === 'image' ? el : null, canSave = !!store.state.dir, chat = chatMode();
  const presets = (() => { try { return JSON.parse(localStorage.getItem('naracal-studio-presets') || '[]'); } catch (e) { return []; } })();
  body.innerHTML = `<div class="stu">
    <div class="stu-quick"><button class="stu-chip new" data-act="newPic">＋ 새 그림</button><span>빠른 시작</span>${ST_QUICK.map((q, i) => `<button class="stu-chip${stu.quick === i ? ' on' : ''}" data-quick="${i}" aria-pressed="${stu.quick === i}">${q[0]}</button>`).join('')}${presets.map((p, i) => `<span class="stu-chip mine"><button data-preset="${i}">⭐ ${esc(p.name)}</button><button class="x" data-pdelp="${i}" title="이 조합 지우기" aria-label="${esc(p.name)} 지우기">✕</button></span>`).join('')}<button class="stu-chip add" data-savepreset>＋ 지금 조합 저장</button></div>
    <div class="stu-main">
      <nav class="stu-steps" id="stuSteps" aria-label="단계"></nav>
      <section class="stu-pane" id="stuPane"></section>
      <aside class="stu-side">
        <div class="stu-card-sum"><div class="stu-sum-h"><b>지금 만들 그림</b><span class="stu-badge" id="stuRatio"></span></div><div id="stuSum"></div><p class="stu-tip">고르지 않은 단계는 기본값으로 들어가요 — 지금 바로 복사해도 됩니다.</p></div>
        <div id="stuEdBar"></div><div class="stu-actions" id="stuActs"></div>
        <div class="chatzone" id="stuZone" tabindex="0" role="button" aria-label="받은 그림 넣기"><b id="stuZoneT">받은 그림을 여기에 넣기</b><span>${CN} 그림 오른쪽 클릭 → 이미지 복사 → 여기서 ⌘V·Ctrl+V<br>내려받은 파일 끌어다 놓기 · 눌러서 고르기</span><small id="stuCat"></small></div>
        <label class="chk" style="margin-top:2px"><input type="checkbox" id="stuAuto" ${stu.autoSave && canSave ? 'checked' : ''} ${canSave ? '' : 'disabled'}> 받은 그림을 보관함에 자동으로 분류해 넣기</label>
        ${canSave ? '' : '<p class="hint" style="margin:0">동기화 폴더를 연결하면 보관함(요소 → 나라차)에 분류해 넣습니다.</p>'}
        ${targetImg ? `<p class="hint" style="margin:0">고른 이미지 "${esc(elName(targetImg))}"를 받은 그림으로 바꿀 수 있습니다.</p>` : ''}
        <div class="aiimgs stu-res" id="aiImgs"></div>
        <details class="stu-en"><summary>${CN}에 보낼 글(영어) 보기·고치기</summary><textarea id="stuEn" rows="6"></textarea><div class="row" style="margin-top:4px"><button class="btn sm" data-act="resetEn">고른 내용대로 다시 쓰기</button></div></details>
      </aside>
    </div></div>`;
  const steps = () => { $('#stuSteps').innerHTML = ST_STEPS.map(([t], i) => { const n = i + 1, skip = stuSkip(n), on = stu.step === n; return `<button class="${on ? 'on' : ''}${!on && stuVisited.has(n) && !skip ? ' done' : ''}${skip ? ' skip' : ''}" data-step="${n}" ${on ? 'aria-current="step"' : ''}><b>${!on && stuVisited.has(n) && !skip ? '✓' : n}</b><span>${t}<small>${esc(stuStepSub(n))}</small></span></button>`; }).join(''); };
  const side = () => {
    const p = stuPrompt(stu, false), c = stuClassify(stu), use = stuUseOf(stu);
    $('#stuRatio').textContent = `${use[5]} ${use[3]}${p.cut ? ' · 배경 없음' : ''}`;
    $('#stuSum').innerHTML = stuSummary(stu).filter(r => r[1] !== '—').map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('');
    if (!$('#stuEn').matches(':focus')) $('#stuEn').value = stuEdited || p.en;
    $('#stuEdBar').innerHTML = stuEdited ? '<p class="stu-edbar">✎ 직접 고친 영어 글을 복사합니다 — 고른 내용은 반영되지 않아요 (아래 "고른 내용대로 다시 쓰기"로 되돌림)</p>' : '';
    $('#stuCat').textContent = `보관 분류: ${c.catName}`;
    const refs = stuRefSrc(stu), site = CHAT_SITES[AI.cfg.chatImage][0], needRef = refs.length && !stuRefDone;
    $('#stuActs').innerHTML = chat ? `${refs.length ? `<button class="btn stu-act${needRef ? ' primary' : ' done'}" data-act="copyRef"><i>${needRef ? '①' : '✓'}</i> ${needRef ? `참고 그림 복사 · ${site} 열기` : '참고 그림 복사함 (다시 복사)'}<small>${needRef ? '채팅 칸에 먼저 붙여 넣기' : '채팅에 붙여 넣었으면 다음 단추'}</small></button>` : ''}
      <button class="btn stu-act${needRef ? '' : ' primary'}" data-act="copyPrompt" id="stuCopyBtn"><i>${refs.length ? '②' : '①'}</i> ${CN}에 보낼 글 복사${refs.length ? '' : ` · ${site} 열기`}<small>채팅 칸에 ⌘V·Ctrl+V 하고 보내기</small></button>
      ${stuChatN ? `<button class="btn sm" data-act="copyNext">↪ 같은 그림체로 다음 그림 (이어서 그리기)</button><button class="btn sm" data-act="newChat">새 대화로 처음부터</button>${stuChatN >= 4 ? '<p class="hint" style="margin:0">4장 넘게 이어 그리면 모습이 흐트러질 수 있어요 — 새 대화로 시작해 보세요.</p>' : ''}` : ''}
      <p class="hint" style="margin:0">${site} 채팅(내 요금제)에서 그립니다 · <button class="lnk" data-act="keys">다른 채팅으로 바꾸기</button></p>`
      : `<button class="btn primary stu-act" data-act="gen"><i>✨</i> 바로 그림 만들기 (API)<small>Gemini API 요금이 듭니다</small></button><span id="aiBusy"></span>`;
  };
  const pane = () => {
    const n = stu.step, [t, q] = ST_STEPS[n - 1]; let h = '';
    const card = (attr, k, on, ic, ttl, sub, extra) => `<button class="stu-card${on ? ' on' : ''}" ${attr}="${k}" aria-pressed="${on}">${ic ? `<span class="ic">${ic}</span>` : ''}<b>${ttl}</b>${sub ? `<small>${sub}</small>` : ''}${extra || ''}</button>`;
    const chip = (attr, k, on, label) => `<button class="stu-chip${on ? ' on' : ''}" ${attr}="${k}" aria-pressed="${on}">${label}</button>`;
    if (n === 1) { h = `<div class="stu-cards">${ST_USE.map(u => card('data-use', u[0], stu.use === u[0], '', u[1], u[2], `<em>${u[5]}${u[4] ? ' · 배경 없음' : ''}</em>`)).join('')}</div>`;
      if (stuUseOf(stu)[4]) h += `<div class="stu-opts"><label class="chk"><input type="checkbox" id="stuSticker" ${stu.sticker ? 'checked' : ''}> 흰 테두리가 있는 스티커로</label>${stuStyleOf(stu)[6] !== null ? `<label class="chk"><input type="checkbox" id="stuCut" ${stu.cut ? 'checked' : ''}> 받은 그림의 배경을 지워 투명하게</label>` : ''}</div>`;
      if (['poster', 'calendar', 'wide'].includes(stu.use)) h += '<p class="hint">채팅 그림은 보통 가로세로 1,000px 안팎이라 A4 이상 인쇄물의 <b>전체 배경</b>으로는 흐릴 수 있어요. 큰 인쇄물에는 "오려 쓰는 그림"으로 인물을 따로 만들어 배치하면 선명합니다.</p>'; }
    if (n === 2) h = `<div class="stu-cards">${ST_STYLES.map(s => card('data-style', s[0], stu.style === s[0], s[3], s[1], s[2])).join('')}</div>${['line', 'icon', 'photo'].includes(stu.style) ? '' : `<div class="stu-opts"><label class="chk"><input type="checkbox" id="stuBrand" ${stu.brand ? 'checked' : ''}> 나라차 색(남색·빨강·노랑)을 포인트로</label></div>`}`;
    if (n === 3) { const refs = stuRefSrc(stu);
      h = `<div class="stu-cards">${ST_REFS.map(r => card('data-ref', r[0], stu.ref === r[0], r[3], r[1], r[2])).join('')}</div>`;
      if (stu.ref === 'mine') { const mine = NC.lib.mine().slice(0, 30); h += mine.length ? `<h4>참고할 그림을 고르세요</h4><div class="stu-mine">${mine.map(it => `<button class="${stu.mineId === it.id ? 'on' : ''}" data-mine="${esc(it.id)}" title="${esc(it.name)}" aria-pressed="${stu.mineId === it.id}"><img src="${NC.lib.url(it.thumb) || ''}" alt="${esc(it.name)}"></button>`).join('')}</div>` : '<p class="hint">보관함에 그림이 아직 없습니다 (동기화 폴더 연결 후 AI 그림을 보관하면 여기에 나옵니다).</p>'; }
      if (stu.ref === 'file') h += `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="pickRef">그림 파일 고르기</button>${stuRefFile ? '<span class="hint" style="margin:0">✓ 골랐습니다</span>' : ''}</div>`;
      if (stu.ref === 'mine' || stu.ref === 'file') h += `<h4>참고 그림을 어떻게 쓸까요?</h4><div class="stu-chips">${ST_REFROLE.map(r => chip('data-role', r[0], stu.refRole === r[0], r[1])).join('')}</div>`;
      if (refs.length) h += `<div class="stu-refprev">${refs.map(s => `<img src="${s}" alt="참고 그림">`).join('')}<p class="hint">오른쪽 <b>① 참고 그림 복사</b>를 누르면 이 그림이 복사되고 채팅이 열립니다. 채팅 칸에 먼저 붙여 넣으세요.</p></div>`;
      if (stu.ref === 'none' && refs.length) h += '<p class="hint" style="margin-top:6px">참고 그림은 나라차 엠블럼만 들어갑니다 (주인공 단계에서 끌 수 있어요).</p>';
      else if (stu.ref === 'none') h += '<p class="hint" style="margin-top:10px">참고 그림 없이 그립니다. 바로 <b>다음</b>으로 가세요. 라차를 그리면 "라차 마스코트"를 고르는 것이 가장 똑같이 나와요.</p>'; }
    if (n === 4) { const ppl = stu.hero === 'people' || stu.hero === 'both';
      h = `<div class="stu-cards four">${ST_HERO.map(r => card('data-hero', r[0], stu.hero === r[0], r[3], r[1], r[2])).join('')}</div>`;
      if (stu.hero === 'none') h += '<p class="hint" style="margin-top:10px">사람·라차 없이 장소·계절 배경만 그립니다. 마지막 단계에서 배경·상황을 고르세요.</p>';
      else { if (ppl) h += `<h4>띠 색</h4><div class="stu-chips">${ST_BELT.map(b => chip('data-belt', b[0], stu.belt === b[0], `<i class="sw" style="background:${b[2]}"></i>${b[1]}`)).join('')}</div>`;
        h += `<h4>표정</h4><div class="stu-chips">${ST_MOOD.map(m => chip('data-mood', m[0], stu.mood === m[0], `<span class="emo">${m[1]}</span>${m[2]}`)).join('')}</div>`;
        if (ppl) h += `<h4>옷</h4><div class="stu-chips">${ST_OUTFIT.map(o => chip('data-outfit', o[0], stu.outfit === o[0], o[1])).join('')}</div><p class="hint" style="margin:6px 0 0">나라차 운영규정의 복장: 흰 도복(심사·예식) · 흰 상의+검정 바지 · 검정 도복 · 나라차 티셔츠+검정 바지. 유급자·품은 빨강·검정 깃, 유단자는 검정 깃으로 그립니다.</p>`;
        else h += '<p class="hint" style="margin-top:10px">라차는 늘 흰 도복(검정 깃)에 검은띠로 그립니다.</p>';
        if (stuLogoOn(Object.assign({}, stu, { logo: true }))) h += `<div class="stu-opts"><label class="chk"><input type="checkbox" id="stuLogo" ${stu.logo ? 'checked' : ''}> 🥋 왼쪽 가슴에 나라차 엠블럼 넣기 <small class="hint" style="margin:0">(참고 그림 판에 엠블럼이 함께 들어가 Gemini가 보고 따라 그려요)</small></label></div>`; } }
    if (n === 5) h = !stuPeopleOf(stu).length ? `<div class="stu-empty">${stu.hero === 'none' ? '🏞️<p>배경만 그립니다 — 인원 단계는 건너뜁니다.</p>' : '🐧<p>라차만 그립니다 — 인원 단계는 건너뜁니다.</p>'}</div>` : `<div class="stu-count"><button class="btn" data-act="pplMinus" ${stu.people.length <= 1 ? 'disabled' : ''} aria-label="한 명 빼기">−</button><b>${stu.people.length}명</b><button class="btn" data-act="pplPlus" ${stu.people.length >= 6 ? 'disabled' : ''} aria-label="한 명 더하기">＋</button><span class="hint" style="margin:0">최대 6명</span></div>
      ${stu.people.length >= 5 ? '<p class="stu-warn">5명 이상이면 얼굴·손이 작아져 어색해지기 쉬워요. 인쇄물에는 1~3명씩 "오려 쓰는 그림"으로 따로 만들어 배치하면 더 깔끔합니다.</p>' : ''}
      <div class="stu-chips" style="margin:8px 0"><button class="stu-chip" data-act="allKr">모두 한국인</button><button class="stu-chip" data-act="mixRace">🌏 다국적으로 섞기</button><button class="stu-chip" data-act="mixGender">남녀 섞기</button></div>
      <div class="stu-people"><div class="stu-phead"><span></span><span></span><span>나이·성별</span><span>인종·출신</span><span>띠</span><span></span></div>${stu.people.map((p, i) => `<div class="stu-person"><span class="no">${i + 1}</span><span class="av">${stFind(ST_AGE, p.age)[2]}</span>
        <select data-age="${i}" aria-label="${i + 1}번 나이·성별">${ST_AGE.map(a => `<option value="${a[0]}" ${p.age === a[0] ? 'selected' : ''}>${a[1]}</option>`).join('')}</select>
        <select data-race="${i}" aria-label="${i + 1}번 인종·출신">${ST_RACE.map(r => `<option value="${r[0]}" ${p.race === r[0] ? 'selected' : ''}>${r[1]}</option>`).join('')}</select>
        <select data-pbelt="${i}" aria-label="${i + 1}번 띠"><option value="">${stuIsMaster(p) ? '검은띠 (사범님)' : stu.belt === 'mixed' ? '자동 (여러 색으로 섞음)' : `위에서 고른 띠 (${stFind(ST_BELT, stu.belt)[1]})`}</option>${ST_BELT.filter(b => b[0] !== 'mixed').map(b => `<option value="${b[0]}" ${p.belt === b[0] ? 'selected' : ''}>${b[1]}</option>`).join('')}</select>
        ${stu.people.length > 1 ? `<button class="x" data-pdel="${i}" title="${i + 1}번 빼기" aria-label="${i + 1}번 빼기">✕</button>` : '<span></span>'}</div>`).join('')}</div>`;
    if (n === 6) { const ppl = stuPeopleOf(stu);
      if (stu.hero === 'none') h = '<div class="stu-empty">🏞️<p>배경만 그리므로 포즈는 없습니다.</p></div>';
      else { if (ppl.length > 1) h += `<div class="stu-seg" role="group"><button class="${stu.poseMode === 'each' ? 'on' : ''}" data-pmode="each" aria-pressed="${stu.poseMode === 'each'}">각자 포즈</button><button class="${stu.poseMode === 'group' ? 'on' : ''}" data-pmode="group" aria-pressed="${stu.poseMode === 'group'}">단체 포즈</button></div>`;
        if (ppl.length > 1 && stu.poseMode === 'group') h += `<div class="stu-cards">${ST_GROUP.map(g => card('data-group', g[0], stu.group === g[0], '', g[1], g[2])).join('')}</div>`;
        else ppl.forEach((p, i) => { h += `<h4>${ppl.length > 1 ? `${i + 1}번 · ` : ''}${stFind(ST_AGE, p.age)[1]}</h4><div class="stu-chips">${ST_POSE.map(m => chip('data-pose', `${i}:${m[0]}`, (p.pose || 'ready') === m[0], m[1])).join('')}</div>`; });
        if (stu.hero !== 'people') h += `<h4>🐧 라차</h4><div class="stu-chips">${ST_POSE.map(m => chip('data-rpose', m[0], stu.rachaPose === m[0], m[1])).join('')}</div>`; } }
    if (n === 7) { const cut = stuCutOf(stu);
      h = cut && stu.hero !== 'none' ? `<div class="stu-note">지금은 <b>배경 없는 그림</b>(오려 쓰는 그림)이라, 고른 장소·계절·행사는 인물 곁의 <b>작은 소품</b>으로만 들어갑니다.${stu.scenes.length ? ' 공원·도장 같은 배경을 그대로 그리려면 →' : ''} <button class="btn sm" data-act="bgOn">배경까지 그리기</button></div>` : stuUseOf(stu)[4] && !stu.cut && stu.hero !== 'none' ? '<div class="stu-note">배경까지 그립니다 (배경 지우기 꺼짐). <button class="btn sm" data-act="bgOff">배경 없이 오려 쓰기로</button></div>' : '';
      h += ST_SCENE_G.map(([g, gt]) => `<h4>${gt}</h4><div class="stu-chips">${ST_SCENE.filter(s => s[1] === g).map(s => chip('data-scene', s[0], stu.scenes.includes(s[0]), `<span class="emo">${s[2]}</span>${s[3]}`)).join('')}</div>`).join('');
      h += `<h4>더 바라는 점 <small>(눌러서 넣고 빼기)</small></h4><div class="stu-chips">${ST_EXTRA.map(x => chip('data-xtra', x[0], stu.extras.includes(x[0]), (stu.extras.includes(x[0]) ? '✓ ' : '＋ ') + x[1])).join('')}</div>
        <textarea id="stuExtra" rows="3" placeholder="직접 쓰기 (한국어로 써도 됩니다) — 예: 벚꽃 아래에서 친구와 하이파이브">${esc(stu.extra)}</textarea>`; }
    const refs = stuRefSrc(stu), needRef = refs.length && !stuRefDone;
    $('#stuPane').innerHTML = `<div class="stu-q"><span>${n} / 7 · ${t}</span><h3>${q}</h3></div><div class="stu-body">${h}</div>
      <div class="stu-nav">${n > 1 ? '<button class="btn" data-act="prev">‹ 이전</button>' : '<span></span>'}${n < 7 && chat ? `<button class="btn stu-navcopy" data-act="${needRef ? 'copyRef' : 'copyPrompt'}">${needRef ? '① 참고 그림 복사' : '📋 지금 글 복사'}</button>` : ''}${n < 7 ? `<button class="btn primary" data-act="next">다음: ${ST_STEPS[n][0]} ›</button>` : `<button class="btn primary" data-act="${needRef ? 'copyRef' : 'copyPrompt'}">${needRef ? '① 참고 그림 복사부터' : `${refs.length ? '② ' : ''}${CN}에 보낼 글 복사`}</button>`}</div>`;
  };
  const all = () => { stuSave(); steps(); pane(); side(); };
  const change = (resetChat) => { if (resetChat) { stuChatN = 0; stuChatOpen = false; stuRefDone = false; } stu.quick = -1; stuSave(); steps(); pane(); side(); };
  stuOnEmblem = () => { if (body.isConnected && $('#stuPane')) all(); }; stuEmblem();
  const refocus = (attr, val) => { const b = body.querySelector(`[${attr}="${val}"]`); if (b) b.focus({ preventScroll: true }); };
  all();
  body.onclick = async e => {
    const b = e.target.closest('button,[data-mine]'); if (!b || !body.contains(b)) return; const d = b.dataset;
    if (d.quick != null) { const prev = clone(stu), qi = Number(d.quick); Object.assign(stu, clone(STU_DEF), clone(ST_QUICK[qi][1]), { step: 7, autoSave: stu.autoSave, quick: qi }); stu.cut = stuUseOf(stu)[4] && stuStyleOf(stu)[6] !== null; stuChatN = 0; stuChatOpen = false; stuRefDone = false; stuEdited = ''; ST_STEPS.forEach((x, i) => stuVisited.add(i + 1)); stuSave(); renderStudio(body); toastAction(`'${ST_QUICK[qi][0]}' 조합을 넣었습니다 — 바로 복사하거나 단계를 눌러 바꾸세요`, '되돌리기', () => { Object.assign(stu, prev); stuSave(); renderStudio(body); }); return; }
    if (d.preset != null) { const p = presets[d.preset]; if (p) { const prev = clone(stu); Object.assign(stu, clone(STU_DEF), clone(p.s), { step: 7 }); stuChatN = 0; stuChatOpen = false; stuRefDone = false; stuEdited = ''; ST_STEPS.forEach((x, i) => stuVisited.add(i + 1)); stuSave(); renderStudio(body); toastAction(`'${p.name}' 조합을 불렀습니다`, '되돌리기', () => { Object.assign(stu, prev); stuSave(); renderStudio(body); }); } return; }
    if (d.pdelp != null) { const p = presets[d.pdelp]; if (!p || !window.confirm(`'${p.name}' 조합을 지울까요?`)) return; presets.splice(Number(d.pdelp), 1); try { localStorage.setItem('naracal-studio-presets', JSON.stringify(presets)); } catch (er) {} renderStudio(body); return; }
    if (d.savepreset != null) { const nm = window.prompt('이 조합의 이름 (빠른 시작 줄에 ⭐로 생겨요)', stuClassify(stu).name.split(' (')[0]); if (!nm || !nm.trim()) return; const s = clone(stu); delete s.step; delete s.quick; presets.unshift({ name: nm.trim().slice(0, 20), s }); try { localStorage.setItem('naracal-studio-presets', JSON.stringify(presets.slice(0, 12))); } catch (er) {} renderStudio(body); toast('내 조합으로 저장했습니다 (빠른 시작 줄의 ⭐, 두 PC에서 함께 씀)'); return; }
    if (d.step) { stu.step = Number(d.step); stuVisited.add(stu.step); all(); refocus('data-step', d.step); return; }
    if (d.use) { stu.use = d.use; stu.cut = stuUseOf(stu)[4] && stuStyleOf(stu)[6] !== null; change(true); refocus('data-use', d.use); return; }
    if (d.style) { stu.style = d.style; stu.cut = stuUseOf(stu)[4] && stuStyleOf(stu)[6] !== null; change(true); refocus('data-style', d.style); return; }
    if (d.ref) { stu.ref = d.ref; stu.refRole = 'same'; if (d.ref === 'racha' && (stu.hero === 'people' || stu.hero === 'none')) { stu.hero = 'racha'; toast('주인공을 "라차만"으로 바꿨어요 — 사람도 함께라면 주인공 단계에서 "사람 + 라차"를 고르세요'); } change(true); refocus('data-ref', d.ref); return; }
    if (d.role) { stu.refRole = d.role; change(); refocus('data-role', d.role); return; }
    if (d.mine) { stu.mineId = d.mine; change(true); return; }
    if (d.hero) { stu.hero = d.hero; if ((d.hero === 'racha' || d.hero === 'both') && stu.ref === 'none') { stu.ref = 'racha'; toast('참고 그림을 "라차 마스코트"로 정했어요 — 라차가 똑같이 나옵니다'); } if (d.hero === 'none' && stu.ref === 'racha') stu.ref = 'none'; change(true); refocus('data-hero', d.hero); return; }
    if (d.belt) { stu.belt = d.belt; change(); refocus('data-belt', d.belt); return; }
    if (d.mood) { stu.mood = d.mood; change(); refocus('data-mood', d.mood); return; }
    if (d.outfit) { stu.outfit = d.outfit; change(); refocus('data-outfit', d.outfit); return; }
    if (d.pmode) { stu.poseMode = d.pmode; change(); refocus('data-pmode', d.pmode); return; }
    if (d.group) { stu.group = d.group; change(); refocus('data-group', d.group); return; }
    if (d.pose) { const [i, p] = d.pose.split(':'); stu.people[i].pose = p; change(); refocus('data-pose', d.pose); return; }
    if (d.rpose) { stu.rachaPose = d.rpose; change(); refocus('data-rpose', d.rpose); return; }
    if (d.scene) { stu.scenes = stu.scenes.includes(d.scene) ? stu.scenes.filter(x => x !== d.scene) : stu.scenes.concat(d.scene); change(); refocus('data-scene', d.scene); return; }
    if (d.xtra) { stu.extras = stu.extras.includes(d.xtra) ? stu.extras.filter(x => x !== d.xtra) : stu.extras.concat(d.xtra); change(); refocus('data-xtra', d.xtra); return; }
    if (d.pdel != null) { stu.people.splice(Number(d.pdel), 1); change(true); return; }
    const a = d.act; if (!a) return;
    if (a === 'newPic') { const prev = clone(stu); Object.assign(stu, clone(STU_DEF), { autoSave: stu.autoSave }); stuChatN = 0; stuChatOpen = false; stuRefDone = false; stuEdited = ''; stuSnap = null; stuVisited = new Set([1]); stuSave(); renderStudio(body); toastAction('처음부터 새 그림을 만듭니다', '되돌리기', () => { Object.assign(stu, prev); stuSave(); renderStudio(body); }); return; }
    if (a === 'next' || a === 'prev') { let s = stu.step + (a === 'next' ? 1 : -1); while (s > 1 && s < 7 && stuSkip(s)) s += a === 'next' ? 1 : -1; stu.step = Math.max(1, Math.min(7, s)); stuVisited.add(stu.step); all(); const nb = body.querySelector(`[data-act="${a}"]`) || body.querySelector('[data-act="next"],[data-act="prev"]'); if (nb) nb.focus({ preventScroll: true }); return; }
    if (a === 'pplPlus') { const last = stu.people[stu.people.length - 1] || {}; stu.people.push({ age: last.age === 'kid-m' ? 'kid-f' : 'kid-m', race: last.race || 'kr', belt: '', pose: last.pose || 'ready' }); const was = stu.poseMode; if (stu.people.length > 2) stu.poseMode = 'group'; change(true); if (was !== stu.poseMode) toastAction('3명 이상이라 포즈를 "단체 포즈"로 바꿨어요', '각자 포즈로', () => { stu.poseMode = 'each'; change(); }); return; }
    if (a === 'pplMinus') { stu.people.pop(); change(true); return; }
    if (a === 'allKr') { stu.people.forEach(p => p.race = 'kr'); change(true); return; }
    if (a === 'mixRace') { const r = ['kr', 'white', 'black', 'sea', 'sa', 'latin', 'mixed']; stu.people.forEach((p, i) => p.race = r[i % r.length]); change(true); return; }
    if (a === 'mixGender') { stu.people.forEach((p, i) => { const base = p.age.split('-')[0]; if (['kid', 'tod', 'teen', 'master'].includes(base)) p.age = base + (i % 2 ? '-f' : '-m'); else p.age = i % 2 ? 'woman' : 'man'; }); change(true); return; }
    if (a === 'pickRef') { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { if (i.files[0]) { stuRefFile = await fileToDataURL(i.files[0]); change(true); } }; i.click(); return; }
    if (a === 'bgOn' || a === 'bgOff') { stu.cut = a === 'bgOff'; change(true); toast(a === 'bgOn' ? '배경까지 그립니다 — 고른 장소·계절이 배경으로 들어가요' : '배경 없이 오려 쓰는 그림으로 바꿨습니다'); return; }
    if (a === 'resetEn') { stuEdited = ''; side(); toast('고른 내용대로 다시 썼습니다'); return; }
    if (a === 'keys') { aiCtx.tab = 'keys'; renderAI(); return; }
    if (a === 'newChat') { stuChatN = 0; stuChatOpen = false; stuRefDone = false; side(); pane(); toast('다음 복사부터 새 대화로 엽니다 (참고 그림이 있으면 다시 붙여 넣어요)'); return; }
    if (a === 'copyRef') { stuChatOpen = true; try { await copyImg(await stuRefSheet(stuRefSrc(stu), stuUseOf(stu)[3])); openChatSite(AI.cfg.chatImage); stuRefDone = true; side(); pane(); toast('참고 그림 복사됨 · 채팅 칸에 ⌘V 한 뒤 ② 단추'); } catch (er) { stuChatOpen = false; toast('참고 그림을 복사하지 못했습니다: ' + er.message, true); } return; }
    if (a === 'copyPrompt' || a === 'copyNext') { const next = a === 'copyNext', p = stuPrompt(stu, next), text = stuEdited && !next ? stuEdited : p.en; await sendToChat(text, 'image', { open: !stuChatOpen }); if (!next) stuSig = stuSigOf(stu); stuChatOpen = true; stuChatN++; stuSnap = clone(stu); side(); const btn = $('#stuCopyBtn'); if (btn && !next) { btn.classList.add('ok'); btn.innerHTML = `<i>✓</i> 복사됨<small>${CN} 채팅 칸에 붙여 넣고 보내세요</small>`; setTimeout(() => { if (btn.isConnected) side(); }, 2500); } $('#stuZoneT').textContent = '받은 그림을 여기에 넣기 ← 그림이 나오면'; return; }
    if (a === 'gen') runAI(async () => { const p = stuPrompt(stu, false); stuSnap = clone(stu); const imgs = await AI.geminiImage({ prompt: stuEdited || p.en, refImage: stuRefSrc(stu), aspect: p.aspect }); for (const s0 of imgs) await take(s0); });
  };
  body.onchange = e => { const t = e.target, d = t.dataset;
    if (d.age != null && t.tagName === 'SELECT') { stu.people[d.age].age = t.value; change(true); refocus('data-age', d.age); }
    if (d.race != null) { stu.people[d.race].race = t.value; change(true); refocus('data-race', d.race); }
    if (d.pbelt != null) { stu.people[d.pbelt].belt = t.value; change(); refocus('data-pbelt', d.pbelt); }
    if (t.id === 'stuCut') { stu.cut = t.checked; change(); }
    if (t.id === 'stuSticker') { stu.sticker = t.checked; change(true); }
    if (t.id === 'stuBrand') { stu.brand = t.checked; change(); }
    if (t.id === 'stuLogo') { stu.logo = t.checked; change(true); }
    if (t.id === 'stuAuto') { stu.autoSave = t.checked; stuSave(); } };
  body.oninput = e => { if (e.target.id === 'stuExtra') { stu.extra = e.target.value; stuSave(); steps(); side(); } if (e.target.id === 'stuEn') { stuEdited = e.target.value; $('#stuEdBar').innerHTML = '<p class="stu-edbar">✎ 직접 고친 영어 글을 복사합니다 — 고른 내용은 반영되지 않아요 (아래 "고른 내용대로 다시 쓰기"로 되돌림)</p>'; } };
  // 받은 그림: 배경 지우기 → 분류해 보관 → 결과 카드(해상도·인쇄 크기 안내)
  const take = async s => {
    const S = stuSnap || stu, zone = $('#stuZone'); zone.classList.add('busy'); $('#stuZoneT').textContent = '받은 그림 정리 중… (배경 지우기)';
    let warn = '';
    try {
      if (stuCutOf(S)) { try { const r = await stuCutImage(s, S); s = r.src; warn = r.warn; } catch (er) {} }
      const im = await AI.loadImg(s), cm = Math.round(im.naturalWidth / 150 * 2.54), c = stuClassify(S), meta = { name: c.name, kw: c.kw, prompt: stuPrompt(S, false).en, style: S.style, cat: c.cat };
      if (stu.autoSave && canSave) { try { await NC.lib.saveMine(s, meta); meta.saved = true; } catch (er) { toast('보관하지 못했습니다: ' + er.message, true); } }
      const fig = document.createElement('figure'); fig.className = 'new';
      fig.innerHTML = `<img src="${s}" alt="${esc(c.name)}"><figcaption><span class="stu-saved">${meta.saved ? `✓ 보관됨 · ${esc(c.catName)}` : esc(c.catName)}</span><span class="stu-px">${im.naturalWidth}×${im.naturalHeight}px · 선명한 인쇄 가로 약 ${cm}cm까지</span>${warn ? `<span class="stu-px warn">${esc(warn)}</span>` : ''}${stuCutOf(S) ? '' : '<span class="stu-px">오른쪽 아래 Gemini 표시가 있으면 자르거나 덮으세요</span>'}<div class="row" style="gap:4px"><button class="btn sm primary" data-ins>${targetImg ? '바꾸기' : '넣기'}</button>${canSave && !meta.saved ? '<button class="btn sm" data-keep>보관</button>' : ''}<button class="btn sm" data-dl>내려받기</button></div></figcaption>`;
      fig.querySelector('[data-ins]').onclick = () => { const r = addAsset(s); if (targetImg) { targetImg.src = r; delete targetImg.srcOrig; commit(); rerender(); } else addImage(r); toast('그림을 넣었습니다'); };
      const kb = fig.querySelector('[data-keep]'); if (kb) kb.onclick = async () => { kb.disabled = true; try { await NC.lib.saveMine(s, meta); fig.querySelector('.stu-saved').textContent = `✓ 보관됨 · ${c.catName}`; kb.remove(); toast(`보관했습니다 — 요소 → 나라차 → ${c.catName}`); } catch (er) { kb.disabled = false; toast(er.message, true); } };
      fig.querySelector('[data-dl]').onclick = () => { const a2 = document.createElement('a'); a2.href = s; a2.download = c.name.replace(/[\\/:*?"<>|]/g, '_') + '.png'; a2.click(); };
      $('#aiImgs').prepend(fig); fig.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      toast(meta.saved ? `받은 그림을 보관했습니다 — 요소 → 나라차 → ${c.catName}` : '받은 그림이 들어왔습니다 — 넣기를 누르세요');
    } finally { zone.classList.remove('busy'); $('#stuZoneT').textContent = '받은 그림을 여기에 넣기'; }
  };
  chatImgZone($('#stuZone'), take);
  $('#stuZone').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#stuZone').click(); } };
}
function aiF(label, key, type) { return `<label class="f"><span>${label}</span><input type="${type || 'text'}" data-ai="${key}" value="${esc(AI.cfg[key])}" autocomplete="off"></label>`; }
// 키 저장 표시: 이 브라우저에 바로 저장되고, 동기화 폴더가 있으면 몇 초 안에 설정 파일로 올라가 다른 PC에도 적용됨
function keySavedText() { const has = [AI.cfg.geminiKey && 'Gemini', AI.cfg.anthropicKey && 'Claude'].filter(Boolean); if (!has.length) return '아직 저장된 키가 없습니다. 칸에 붙여 넣으면 바로 저장됩니다.'; return `✓ ${has.join('·')} 키 저장됨 — ${store.state.dir ? '동기화 폴더(구글 드라이브)에도 저장되어 같은 폴더를 연결한 다른 PC에서도 그대로 쓰입니다' : '이 브라우저에 저장됨 · 다른 PC에서도 쓰려면 저장 ▾ → 동기화 폴더를 연결하세요'}`; }
$('#aiBody').addEventListener('input', e => { const k = e.target.dataset.ai; if (k) { AI.cfg[k] = e.target.value.trim(); AI.saveCfg(); const ks = $('#keySaved'); if (ks) ks.textContent = keySavedText(); if (/Key$/.test(k) && store.state.dir) setTimeout(() => store.pushSettings().catch(() => {}), 300); } });
$('#aiBody').addEventListener('change', e => { const k = e.target.dataset.ai; if (k) { AI.cfg[k] = e.target.value.trim(); AI.saveCfg(); } });
async function runAI(fn) { const busy = $('#aiBusy'); const btns = $$('#aiBody button'); btns.forEach(b => b.disabled = true); if (busy) busy.innerHTML = '<span class="spin"></span>요청 중…'; try { await fn(); if (busy) busy.textContent = '완료'; } catch (err) { if (busy) busy.textContent = ''; toast(err.message, true); } finally { btns.forEach(b => b.disabled = false); } }

/* ---- 내보내기 ---- */
/* ---- 다운로드 (미리캔버스식): PNG · JPG · PDF(웹/인쇄) — 작업한 크기 그대로 바로 받기 ---- */
const DL_FMTS = [['pdfhq', 'PDF (고화질)', '보관·인쇄에 알맞은 300dpi 문서', '권장'], ['jpg', 'JPG', '공유에 알맞은 이미지'], ['png', 'PNG', '압축 손실 없는 고품질 이미지'], ['pdfweb', 'PDF (가벼운 공유용)', '카톡·메일로 보내기 좋은 200dpi 문서'], ['pdfprint', 'PDF (인쇄소용)', '300dpi 최고 화질 · 도련·재단 상자 포함 (재단선은 선택)'], ['pdfvector', 'PDF (벡터 · 인쇄 창)', '글자가 가장 선명 · 브라우저 인쇄 창에서 "PDF로 저장"']];
// PDF 종류별 해상도·압축 품질
const DL_PDF = { pdfhq: { dpi: 300, q: 0.92, bleed: false }, pdfweb: { dpi: 200, q: 0.88, bleed: false }, pdfprint: { dpi: 300, q: 1, bleed: true } }; // 인쇄소용: 투명 마스크가 생기지 않게 최고 화질 JPEG (크롬 PNG는 늘 투명 채널이 있어 인쇄소 점검에 '투명도'로 걸림)
let dlState = { fmt: 'pdfhq', scale: 3, pages: 'all', range: '', merge: false, imgBleed: false };
function loadScript(src, test) { if (test()) return Promise.resolve(); return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('모듈을 불러오지 못했습니다 (인터넷 필요)')); document.head.appendChild(s); }); }
function dlPages() {
  const n = doc.pages.length; if (dlState.pages === 'cur' || dlState.pages === 'sel') return [cur];
  if (dlState.pages === 'range') { const out = []; (dlState.range || '').split(',').forEach(p => { const m = p.trim().match(/^(\d+)(?:\s*[-~]\s*(\d+))?$/); if (!m) return; const a = Number(m[1]), b = Number(m[2] || m[1]); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= n) out.push(i - 1); }); return [...new Set(out)]; }
  return doc.pages.map((_, i) => i);
}
// 캔버스 한계 안에서 쓸 수 있는 dpi
function dlDpi(want, bleed) { const W = (doc.w + 2 * bleed) / 25.4, H = (doc.h + 2 * bleed) / 25.4; return Math.max(24, Math.min(want, 14000 / W, 14000 / H, Math.sqrt(120e6 / (W * H)))); }
function openDownload(fmt) {
  if (fmt) { dlState.fmt = fmt; dlState.userFmt = true; }
  const pxDoc = Math.abs(doc.w * 96 / 25.4 - Math.round(doc.w * 96 / 25.4)) < 0.05 && Math.abs(doc.h * 96 / 25.4 - Math.round(doc.h * 96 / 25.4)) < 0.05 && doc.w > 150; if (dlState.docKey !== doc.w + 'x' + doc.h) { dlState.docKey = doc.w + 'x' + doc.h; dlState.scale = pxDoc ? 1 : 3.125; if (!dlState.userFmt) dlState.fmt = Number(doc.bleed) > 0 && !pxDoc ? 'pdfprint' : 'pdfhq'; }
  let p = $('#dlPanel'); if (p) { p.remove(); if (!fmt) return; }
  p = document.createElement('div'); p.id = 'dlPanel'; p.className = 'dlpanel'; document.body.appendChild(p);
  const b = $('#btnExport').getBoundingClientRect(); p.style.right = Math.max(8, innerWidth - b.right) + 'px'; p.style.top = (b.bottom + 8) + 'px';
  renderDownload();
  document.addEventListener('keydown', function escDl(ev) { const q = $('#dlPanel'); if (!q) { document.removeEventListener('keydown', escDl, true); return; } if (ev.key === 'Escape' && !document.querySelector('dialog[open]')) { ev.preventDefault(); q.remove(); document.removeEventListener('keydown', escDl, true); const b = $('#btnExport'); if (b) b.focus(); } }, true);
  setTimeout(() => document.addEventListener('pointerdown', function off(ev) { const q = $('#dlPanel'); if (!q) { document.removeEventListener('pointerdown', off); return; } if (!q.contains(ev.target) && !ev.target.closest('#btnExport') && !ev.target.closest('dialog')) { q.remove(); document.removeEventListener('pointerdown', off); } }), 0);
}
function renderDownload() {
  const p = $('#dlPanel'); if (!p) return; const S = dlState, f = DL_FMTS.find(x => x[0] === S.fmt);
  if (S.pages === 'sel' && (!sel.length || (S.fmt !== 'png' && S.fmt !== 'jpg'))) S.pages = 'cur';
  const img = S.fmt === 'jpg' || S.fmt === 'png', n = dlPages().length;
  const bleed = (S.fmt === 'pdfprint' || S.fmt === 'pdfvector' || (img && S.imgBleed)) ? (Number(doc.bleed) || 0) : 0;
  let dpi = img ? dlDpi(96 * S.scale, bleed) : DL_PDF[S.fmt] ? dlDpi(DL_PDF[S.fmt].dpi, bleed) : 0;
  if (img && S.merge && n > 1) dpi = Math.min(dpi, dlMergeDpi(n, bleed));
  const px = v => Math.round(v / 25.4 * dpi);
  p.innerHTML = `<div class="dlhead"><b>다운로드</b><button class="x" data-dl="close">×</button></div>
  <label class="f"><span>파일 형식</span></label><div class="dlfmts">${DL_FMTS.map(([k, t, d]) => { const tag = k === (Number(doc.bleed) > 0 ? 'pdfprint' : 'pdfhq') ? '권장' : ''; return `<button data-fmt2="${k}" class="${S.fmt === k ? 'on' : ''}"><b>${t}${tag ? ` <em>${tag}</em>` : ''}</b><small>${d}</small></button>`; }).join('')}</div>
  ${img ? `<label class="f"><span>크기</span><select id="dlScale">${[[1, '1배 (화면·SNS용 96dpi)'], [2, '2배 (선명하게 192dpi)'], [3.125, '인쇄용 300dpi'], [3.646, '고급 인쇄 350dpi']].map(([v, t]) => `<option value="${v}" ${S.scale === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
  <label class="f"><span>페이지 선택</span><select id="dlPages"><option value="all" ${S.pages === 'all' ? 'selected' : ''}>모든 페이지 (1~${doc.pages.length})</option><option value="cur" ${S.pages === 'cur' ? 'selected' : ''}>현재 페이지 (${cur + 1})</option><option value="range" ${S.pages === 'range' ? 'selected' : ''}>직접 입력</option>${img && sel.length ? `<option value="sel" ${S.pages === 'sel' ? 'selected' : ''}>선택한 요소만 (${sel.length}개)</option>` : ''}</select></label>
  ${S.pages === 'range' ? `<label class="f"><input id="dlRange" placeholder="예: 1-3, 5" value="${esc(S.range)}"></label>` : ''}
  ${S.fmt === 'png' ? `<label class="chk"><input type="checkbox" id="dlTransp" ${S.transp ? 'checked' : ''}> 투명 배경 (쪽 배경색을 빼고 저장 — 로고·스티커용)</label>` : ''}
  ${img && n > 1 ? `<label class="chk"><input type="checkbox" id="dlMerge" ${S.merge ? 'checked' : ''}> 한 장의 이미지로 합치기 (세로로 이어 붙임)</label>` : ''}
  ${img && Number(doc.bleed) > 0 ? `<label class="chk"><input type="checkbox" id="dlImgBleed" ${S.imgBleed ? 'checked' : ''}> 도련 ${doc.bleed}mm 포함 (명함·스티커를 인쇄소에 이미지로 보낼 때)</label>` : ''}
  <div class="dlinfo"><b>다운로드 정보</b><ul><li>${n} 페이지${img && n > 1 && !S.merge ? ' (ZIP 파일로 묶음)' : ''}</li><li>${docSizeLabel(' × ')}${bleed ? ` (+도련 ${bleed}mm)` : ''}</li>${dpi ? `<li>${px(doc.w + 2 * bleed).toLocaleString()} × ${(px(doc.h + 2 * bleed) * (img && S.merge && n > 1 ? n : 1)).toLocaleString()} px · ${Math.round(dpi)}dpi${(img ? Math.round(dpi) < Math.round(96 * S.scale) - 1 : DL_PDF[S.fmt] && Math.round(dpi) < DL_PDF[S.fmt].dpi - 1) ? ' <b>(크기가 커서 브라우저 한계에 맞춰 낮춤)</b>' : ''}</li>` : '<li>브라우저 인쇄 창에서 "대상: PDF로 저장", "여백: 없음", "배경 그래픽: 켬"</li>'}</ul>
  ${S.fmt === 'pdfprint' ? `<p class="hint" style="margin:6px 0 0">${bleed ? `도련 ${bleed}mm 포함 작업 사이즈${doc.cropMarks ? ' + 재단선(도련 바깥)' : ''}.` : '<b>도련이 0mm입니다.</b> 프로젝트 탭에서 도련을 넣으세요 (보통 1.5~3mm).'} 대부분의 인쇄소는 재단선 없는 작업 사이즈 파일을 받습니다.<br>이 PDF는 sRGB 그림(300dpi)으로 된 파일입니다. 인쇄소에 "sRGB 기준 CMYK 변환"을 요청하고, 밝은 파랑·초록은 탁해질 수 있으니 시안(교정쇄)으로 확인하세요. 명함처럼 작은 검정 글자가 많으면 "PDF (벡터)"가 더 선명합니다(검정 단색 처리 가능).</p>` : ''}${S.fmt === 'pdfweb' ? '<p class="hint" style="margin:6px 0 0">확대하거나 인쇄하면 글자가 덜 선명할 수 있습니다. 인쇄·보관용은 "PDF (고화질)"을 쓰세요.</p>' : ''}</div>
  <div id="dlWarn"></div><div class="dlprog" id="dlProg"></div>
  <button class="btn primary full" id="dlGo"><svg class="ic"><use href="#i-upload"/></svg>${S.fmt === 'pdfvector' ? '인쇄 창 열기' : '고해상도 다운로드'}</button>`;
  p.onclick = e => { const c = e.target.closest('[data-dl="close"]'); if (c) { p.remove(); return; } const fm = e.target.closest('[data-fmt2]'); if (fm) { S.fmt = fm.dataset.fmt2; S.userFmt = true; renderDownload(); } };
  const sc = $('#dlScale'); if (sc) sc.onchange = e => { S.scale = Number(e.target.value); renderDownload(); };
  $('#dlPages').onchange = e => { S.pages = e.target.value; renderDownload(); };
  const rg = $('#dlRange'); if (rg) { rg.onchange = e => { S.range = e.target.value; renderDownload(); }; }
  const mg = $('#dlMerge'); if (mg) mg.onchange = e => { S.merge = e.target.checked; renderDownload(); };
  const ib = $('#dlImgBleed'); if (ib) ib.onchange = e => { S.imgBleed = e.target.checked; renderDownload(); };
  const tp = $('#dlTransp'); if (tp) tp.onchange = e => { S.transp = e.target.checked; renderDownload(); };
  $('#dlGo').onclick = runDownload;
  const printy = S.fmt === 'pdfprint' || S.fmt === 'pdfhq'; // 인쇄 점검은 인쇄용·고화질 PDF에서만
  if (printy) checkResolution(dlPages()).then(list => {
    const w = $('#dlWarn'); if (!w) return; const iss = printIssues(dlPages()); if (!list.length && !iss.length) { w.innerHTML = '<div class="dlok">✓ 인쇄 점검: 해상도·안전 여백·글자 크기 문제 없음</div>'; return; }
    const row = x => `<li><button class="lnk" data-dlgo="${x.page - 1}|${x.id}">${x.page}쪽 · ${esc(x.name)}</button> ${x.msg}</li>`;
    w.innerHTML = `<div class="dlwarn"><b>⚠ 인쇄 점검 ${list.length + iss.length}건</b> — 이름을 누르면 그 요소로 갑니다.<ul>${list.slice(0, 6).map(x => row({ page: x.page, id: x.id, name: x.name, msg: `· 약 ${x.ppi}ppi (권장 ${x.need}ppi 이상) — 흐리게 나올 수 있음` })).join('')}${iss.slice(0, 8).map(row).join('')}</ul>${list.length + iss.length > 14 ? '<small>…더 있음</small>' : ''}</div>`;
    w.onclick = e => { const g = e.target.closest('[data-dlgo]'); if (!g) return; const [pi, id] = g.dataset.dlgo.split('|'); goto(Number(pi)); if (id) select([id]); };
  });
}
// 인쇄 점검: 안전 여백(재단선 안쪽 3mm) 밖으로 나간 글자·작은 그림, 너무 작은 글자, 도련까지 안 닿은 가장자리 배경
// 글 상자 안 실제 글자 폭(mm) 어림: 가장 긴 줄을 그 글꼴로 재어 봄
const _tm = document.createElement('canvas').getContext('2d');
function textWidthMM(el) { _tm.font = `${el.italic ? 'italic ' : ''}${el.weight || 400} 100px "${el.font}", sans-serif`; const w = Math.max(...String(el.text || '').split('\n').map(l => _tm.measureText(l).width + (el.ls || 0) * 100 * l.length)); return w / 100 * el.size * 25.4 / 72; }
// 인쇄(CMYK)로 거의 못 내는 선명한 RGB 색: 형광 초록·하늘·파랑 계열 (채도·명도가 모두 높은 색)
function outOfGamut(c) { if (!/^#[0-9a-f]{6}$/i.test(c || '')) return false; const n = parseInt(c.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, bl = (n & 255) / 255, mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), sat = mx ? (mx - mn) / mx : 0; if (sat < 0.8 || mx < 0.8) return false; let h = 0; const d = mx - mn; if (mx === r) h = ((g - bl) / d) % 6; else if (mx === g) h = (bl - r) / d + 2; else h = (r - g) / d + 4; h = (h * 60 + 360) % 360; return (h >= 75 && h <= 250) || (h >= 270 && h <= 320); }
function printIssues(pages) {
  const out = [], b = Number(doc.bleed) || 0;
  for (const pi of pages) { const bad = new Set(); const pg = doc.pages[pi]; if (outOfGamut(pg.bg)) bad.add(pg.bg.toUpperCase()); pg.els.forEach(el => { if (el.hidden) return; ['color', 'fill', 'stroke', 'g1', 'g2'].forEach(k => { if (outOfGamut(el[k])) bad.add(el[k].toUpperCase()); }); }); if (bad.size) out.push({ page: pi + 1, id: '', name: '색', msg: `· ${[...bad].slice(0, 4).join(', ')} — 아주 선명한 RGB 색은 인쇄하면 탁해집니다 (시안으로 확인하거나 조금 덜 선명한 색으로)` }); }
  for (const pi of pages) for (const el of doc.pages[pi].els) {
    if (el.hidden) continue; const add = msg => out.push({ page: pi + 1, id: el.id, name: elName(el), msg });
    let x0 = el.x, y0 = el.y, x1 = el.x + el.w, y1 = el.y + el.h;
    if (el.type === 'text' && !el.vertical) { const tw = Math.min(el.w, textWidthMM(el)); if (el.align === 'center') { x0 = el.x + (el.w - tw) / 2; x1 = x0 + tw; } else if (el.align === 'right') x0 = x1 - tw; else x1 = x0 + tw;  const sz = el.size * 25.4 / 72, nl = String(el.text || '').split('\n').reduce((n, l) => { _tm.font = `${el.weight || 400} 100px "${el.font}"`; return n + Math.max(1, Math.ceil(_tm.measureText(l).width / 100 * sz / Math.max(1, el.w))); }, 0), th = Math.min(el.h, nl * sz * (el.lh || 1.3)); if (el.valign === 'bottom') y0 = y1 - th; else if (el.valign === 'middle') { y0 = el.y + (el.h - th) / 2; y1 = y0 + th; } else y1 = y0 + th; }
    const inside = x1 > 0 && y1 > 0 && x0 < doc.w && y0 < doc.h;
    if (!inside) continue;
    const big = el.w >= doc.w * 0.6 || el.h >= doc.h * 0.6 || x0 < -0.5 || y0 < -0.5 || x1 > doc.w + 0.5 || y1 > doc.h + 0.5; // 일부러 가장자리까지 깐 배경·띠
    if (el.rot) { const a = el.rot * Math.PI / 180, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (Math.abs(Math.cos(a)) * (x1 - x0) + Math.abs(Math.sin(a)) * (y1 - y0)) / 2, hh = (Math.abs(Math.sin(a)) * (x1 - x0) + Math.abs(Math.cos(a)) * (y1 - y0)) / 2; x0 = cx - hw; x1 = cx + hw; y0 = cy - hh; y1 = cy + hh; }
    const SF = safeMM();
    if (el.type === 'text' || ((el.type === 'image' || el.type === 'chart' || el.type === 'mini' || el.type === 'cal') && !big)) {
      const m = Math.min(x0, y0, doc.w - x1, doc.h - y1);
      if (m < SF - 0.05) add(`· 재단선에서 ${Math.max(0, Math.round(m * 10) / 10)}mm — 안전 여백(${SF}mm) 안으로 옮기세요 (잘릴 수 있음)`);
    }
    if (el.type === 'text' && el.size && el.size < 6) add(`· 글자 ${el.size}pt — 6pt보다 작으면 인쇄 때 읽기 어렵습니다`);
    if (el.type === 'cal' && el.s) { const small = ['evSize', 'daySize'].filter(k => el.s[k] && el.s[k] < 5); if (small.length) add(`· 달력 글자 ${Math.min(...small.map(k => el.s[k]))}pt — 5pt보다 작으면 인쇄 때 읽기 어렵습니다`); }
    if ((el.type === 'shape' && el.strokeW && el.strokeW < 0.1) || (el.type === 'path' && el.strokeW && (el.d ? el.strokeW : el.strokeW * 0.2646) < 0.1)) add('· 선이 0.1mm보다 가늘어 인쇄 때 끊기거나 안 보일 수 있습니다');
    if ((el.type === 'shape' || el.type === 'image') && el.kind !== 'line') { const g = Math.min(...[x0, y0, doc.w - x1, doc.h - y1].filter(v => v > 0.3)); if (g < 2 && (el.w >= doc.w * 0.3 || el.h >= doc.h * 0.3)) add(`· 가장자리에서 ${Math.round(g * 10) / 10}mm 떨어져 재단 후 얇은 흰 줄이 남을 수 있습니다 — 가장자리에 붙이거나 3mm 이상 띄우세요`); }
    if (b > 0 && (el.type === 'image' || el.type === 'shape')) {
      const auto = (el.type === 'image' && el.fit !== 'contain' && !el.rot && (!el.clip || el.clip === 'none') && !el.radius && !el.borderW) || (el.type === 'shape' && el.kind === 'rect' && !el.radius && !el.strokeW && !el.rot);
      const touch = Math.abs(x0) <= 0.3 || Math.abs(y0) <= 0.3 || Math.abs(x1 - doc.w) <= 0.3 || Math.abs(y1 - doc.h) <= 0.3;
      if (touch && !auto && el.kind !== 'line' && !(el.type === 'image' && el.fit === 'contain')) add(`· 재단선에 딱 맞춰 끝남 — 도련(${b}mm)까지 늘려야 흰 선이 안 생깁니다`);
    }
  }
  return out;
}
// 인쇄 크기 대비 사진 해상도 점검 (보통 인쇄물 150ppi, 현수막처럼 큰 것은 60ppi 이상 권장)
const imgSizeCache = new Map();
function imgNatural(u) { if (!imgSizeCache.has(u)) imgSizeCache.set(u, new Promise(res => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = u; })); return imgSizeCache.get(u); }
async function checkResolution(pages) {
  const mx = Math.max(doc.w, doc.h), need = mx >= 1500 ? 50 : mx >= 800 ? 100 : mx >= 400 ? 150 : 200, out = []; // 멀리서 보는 큰 인쇄물일수록 낮아도 됨
  for (const pi of pages) for (const el of doc.pages[pi].els) {
    if (el.type !== 'image' || el.hidden) continue; const u = src(el.src), raw = el.src.startsWith('a:') ? doc.assets[el.src.slice(2)] || '' : el.src.startsWith('asset:') ? ASSETS[el.src.slice(6)] || '' : el.src; if (!u || /^data:image\/svg|\.svg(\?|$)/i.test(raw)) continue;
    const nat = await imgNatural(u); if (!nat) continue;
    const ar = nat[0] / nat[1], boxAr = el.w / el.h; const fill = el.fit === 'cover' ? (ar > boxAr ? el.h * ar : el.w) : el.fit === 'fill' ? el.w : (ar > boxAr ? el.w : el.h * ar);
    const ppi = Math.round(nat[0] / ((fill * (el.zoom || 1)) / 25.4)); if (ppi < need * 0.9) out.push({ page: pi + 1, id: el.id, name: elName(el), ppi, need }); // 10% 여유: 경계값(197/200ppi)은 인쇄 차이가 없음
  }
  return out;
}
// 페이지를 그림으로: 브라우저 자체 렌더링(SVG foreignObject, html-to-image)을 써서 편집 화면과 똑같이 —
// 광선·그림자·혼합 모드·그라데이션 글자·필터까지 그대로. 실패하면 html2canvas로 대신 그림
const fontDataCache = new Map(); let fontCssText = null;
async function fontCSSFor(node) {
  // 쓰인 글꼴과 그 굵기만 넣음 (한글 글꼴은 굵기 하나가 수 MB라, 모두 넣으면 그림 한 장에 수십 MB를 읽어 아주 느림)
  const used = new Set(), wts = new Map(); node.querySelectorAll('*').forEach(e => { const cs = getComputedStyle(e), w = Number(cs.fontWeight) || 400; cs.fontFamily.split(',').forEach(f => { const fam = f.trim().replace(/^["']|["']$/g, ''); used.add(fam); if (!wts.has(fam)) wts.set(fam, new Set()); wts.get(fam).add(w); }); });
  if (!fontCssText) { try { fontCssText = await (await fetch('fonts/fonts.css')).text(); } catch (e) { fontCssText = null; } }
  const toData = async url => { if (!fontDataCache.has(url)) fontDataCache.set(url, fetch(url).then(r => r.blob()).then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }))); return fontDataCache.get(url); };
  const out = [];
  const webCss = (($('#webfontCss') || {}).textContent || '') + '\n' + (($('#libfontCss') || {}).textContent || '');
  const blocks = ((fontCssText || '') + '\n' + webCss).match(/@font-face\s*{[^}]*}/g) || [];
  const famOf = b => ((b.match(/font-family:\s*['"]?([^;'"]+)['"]?/) || [])[1] || '').trim(), wOf = b => { const m = b.match(/font-weight:\s*([^;}]+)/); if (!m) return [400, 400]; const v = m[1].trim().split(/\s+/).map(x => x === 'bold' ? 700 : x === 'normal' ? 400 : Number(x)); return [v[0], v[1] || v[0]]; };
  // 글꼴마다 쓰인 굵기에 브라우저가 고를 면(가장 가까운 굵기, 범위 굵기면 그대로)만 남김
  const keepW = new Map(); used.forEach(fam => { const have = [...new Set(blocks.filter(b => famOf(b) === fam).map(b => wOf(b).join('-')))].map(k => k.split('-').map(Number)); if (!have.length) return; const need = new Set(); (wts.get(fam) || [400]).forEach(w => { const r = have.find(([a1, b1]) => w >= a1 && w <= b1); if (r) { need.add(r.join('-')); return; } let best = have[0], bd = Infinity; have.forEach(h => { const d = Math.abs(h[0] - w) - (h[0] > w && w >= 500 ? 0.5 : 0); if (d < bd) { bd = d; best = h; } }); need.add(best.join('-')); }); keepW.set(fam, need); });
  for (const block of blocks) {
    const fam = famOf(block); if (!fam || !used.has(fam)) continue; const kw = keepW.get(fam); if (kw && !kw.has(wOf(block).join('-'))) continue;
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
  const near = Math.abs(c.width - tw) <= 3 && Math.abs(c.height - th) <= 3;
  if (near && (c.width !== tw || c.height !== th || bg)) {
    const o = document.createElement('canvas'); o.width = tw; o.height = th; const g = o.getContext('2d', { alpha: !bg }); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, tw, th); }
    if (c.width >= tw && c.height >= th) g.drawImage(c, 0, 0, tw, th, 0, 0, tw, th); else { g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, tw, th); }
    c.width = c.height = 0; return o;
  }
  return c;
}
async function renderPageCanvas0(pg, dpi, mode, bg) {
  const keepMarks = doc.cropMarks; doc.cropMarks = false;  // 재단선은 PDF 단계에서 도련 바깥에 따로 그림
  const tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-99999px;top:0'; try { tmp.innerHTML = sheetHTML(pg, mode); } finally { doc.cropMarks = keepMarks; } if (pg.transp) tmp.firstElementChild.classList.add('transp'); document.body.appendChild(tmp);
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
    try { await ensureLibFonts(pages.map(i => doc.pages[i])); await document.fonts.ready; } catch (e) {}
    const img = S.fmt === 'jpg' || S.fmt === 'png';
    if (img) {
      const bl = S.imgBleed && Number(doc.bleed) > 0 ? Number(doc.bleed) : 0, mode = bl ? 'print' : 'thumb';
      let dpi = dlDpi(96 * S.scale, bl); const type = S.fmt === 'png' ? 'image/png' : 'image/jpeg', ext = S.fmt, bg = S.fmt === 'png' ? null : '#ffffff';
      const toBlob = c => new Promise((r, rej) => c.toBlob(b => b ? r(b) : rej(new Error('이미지가 너무 큽니다. 크기를 줄이거나 ZIP으로 받아 주세요')), type, 0.92)).then(b => setDpi(b, dpi, type));
      const transp = S.fmt === 'png' && (S.transp || S.pages === 'sel'); const pgOf = i => transp ? Object.assign({}, doc.pages[i], { bg: 'transparent', transp: true }) : doc.pages[i];
      if (S.pages === 'sel') { // 선택한 요소만: 그 요소만 그린 뒤 둘레(1mm 여유)로 잘라 냄
        const ids = new Set(sel); page().els.forEach(x => { if (x.group && selEls().some(y => y.group === x.group)) ids.add(x.id); });
        const els = page().els.filter(x => ids.has(x.id) && !x.hidden); if (!els.length) { toast('먼저 내려받을 요소를 고르세요', true); return; } const bb = els.map(x => { const a = (x.rot || 0) * Math.PI / 180, cx = x.x + x.w / 2, cy = x.y + x.h / 2, hw = (Math.abs(Math.cos(a)) * x.w + Math.abs(Math.sin(a)) * x.h) / 2, hh = (Math.abs(Math.sin(a)) * x.w + Math.abs(Math.cos(a)) * x.h) / 2; return [cx - hw, cy - hh, cx + hw, cy + hh]; });
        const pad = 1, X0 = Math.max(0, Math.min(...bb.map(v => v[0])) - pad), Y0 = Math.max(0, Math.min(...bb.map(v => v[1])) - pad), X1 = Math.min(doc.w, Math.max(...bb.map(v => v[2])) + pad), Y1 = Math.min(doc.h, Math.max(...bb.map(v => v[3])) + pad);
        say('선택한 요소 그리는 중…'); const c = await renderPageCanvas(Object.assign({}, page(), { els, bg: S.fmt === 'png' ? 'transparent' : '#ffffff', transp: S.fmt === 'png' }), dpi, 'thumb', bg);
        const k = dpi / 25.4, o = document.createElement('canvas'); o.width = Math.max(1, Math.round((X1 - X0) * k)); o.height = Math.max(1, Math.round((Y1 - Y0) * k)); const g = o.getContext('2d'); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, o.width, o.height); } g.drawImage(c, Math.round(X0 * k), Math.round(Y0 * k), o.width, o.height, 0, 0, o.width, o.height); free(c);
        saveBlob(await toBlob(o), `${base}-선택.${ext}`); free(o); say('완료'); toast(`선택한 요소를 ${ext.toUpperCase()}로 저장했습니다`); go.disabled = false; return;
      }
      if (pages.length > 1 && S.merge) {
        dpi = Math.min(dpi, dlMergeDpi(pages.length, bl));
        const pw = Math.round((doc.w + 2 * bl) / 25.4 * dpi), ph = Math.round((doc.h + 2 * bl) / 25.4 * dpi);
        const m = document.createElement('canvas'); m.width = pw; m.height = ph * pages.length; const g = m.getContext('2d'); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, m.width, m.height); }
        for (let i = 0; i < pages.length; i++) { say(`${i + 1}/${pages.length} 페이지 그리는 중…`); const c = await renderPageCanvas(pgOf(pages[i]), dpi, mode, bg); g.drawImage(c, 0, i * ph, pw, ph); free(c); }
        saveBlob(await toBlob(m), `${base}.${ext}`); free(m);
      } else if (pages.length === 1) {
        const c = await renderPageCanvas(pgOf(pages[0]), dpi, mode, bg); saveBlob(await toBlob(c), `${base}-${pages[0] + 1}.${ext}`); free(c);
      } else {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', () => window.JSZip);
        const zip = new JSZip();
        for (let i = 0; i < pages.length; i++) { say(`${i + 1}/${pages.length} 페이지 그리는 중…`); const c = await renderPageCanvas(pgOf(pages[i]), dpi, mode, bg); zip.file(`${base}-${String(pages[i] + 1).padStart(2, '0')}.${ext}`, await toBlob(c)); free(c); }
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
        if (cfg.png) pdf.addImage(c, 'PNG', slug, slug, doc.w + 2 * bleed, doc.h + 2 * bleed, `p${i}`, 'FAST');
        else pdf.addImage(c.toDataURL('image/jpeg', cfg.q), 'JPEG', slug, slug, doc.w + 2 * bleed, doc.h + 2 * bleed, `p${i}`, 'NONE');
        free(c);
        if (slug) { try { pdf.setDrawColor(1, 1, 1, 1); } catch (e) { pdf.setDrawColor(0); } pdf.setLineWidth(0.09); const x0 = slug + bleed, y0 = slug + bleed, x1 = x0 + doc.w, y1 = y0 + doc.h, L = slug - 1, gap = bleed + 1;
          [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]].forEach(([x, y, sx, sy]) => { pdf.line(x + sx * gap, y, x + sx * (gap + L), y); pdf.line(x, y + sy * gap, x, y + sy * (gap + L)); }); }
        // 인쇄소 프로그램이 읽는 재단·도련 영역 (pt, 왼쪽 아래 기준)
        try { const pc = pdf.internal.getCurrentPageInfo().pageContext; if (bleed || slug) { pc.trimBox = { bottomLeftX: pt(slug + bleed), bottomLeftY: pt(slug + bleed), topRightX: pt(slug + bleed + doc.w), topRightY: pt(slug + bleed + doc.h) }; pc.bleedBox = { bottomLeftX: pt(slug), bottomLeftY: pt(slug), topRightX: pt(slug + 2 * bleed + doc.w), topRightY: pt(slug + 2 * bleed + doc.h) }; } } catch (e) {}
      }
      saveBlob(pdf.output('blob'), `${base}${S.fmt === 'pdfprint' ? `_인쇄용_${doc.w}x${doc.h}mm${bleed ? `_도련${bleed}mm` : ''}` : S.fmt === 'pdfweb' ? '_공유용' : ''}.pdf`);
    }
    prog.textContent = '다운로드했습니다'; toast(dlFallback ? `다운로드했습니다. ${dlFallback}쪽은 대체 방식으로 그려 일부 효과가 화면과 다를 수 있습니다 (Chrome·Edge 최신 버전 권장)` : '다운로드했습니다', !!dlFallback);
  } catch (e) { prog.textContent = ''; toast('다운로드 실패: ' + e.message, true); } finally { go.disabled = false; }
}
// 여러 쪽을 한 장으로 합칠 때 브라우저 한계(한 변 32,000px·1억 화소) 안의 해상도
function dlMergeDpi(n, bl) { const W = (doc.w + 2 * bl) / 25.4, H = (doc.h + 2 * bl) / 25.4 * n; return Math.max(24, Math.min(30000 / H, 30000 / W, Math.sqrt(100e6 / (W * H)))); }
// JPG(JFIF 밀도)·PNG(pHYs)에 dpi를 적어 넣음 — 인쇄소 프로그램이 실제 크기(mm)로 읽게
const CRC32 = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = ~0; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; }; })();
async function setDpi(blob, dpi, type) {
  try { const d = Math.round(dpi || 0); if (!(d > 0 && d < 65536)) return blob; const u = new Uint8Array(await blob.arrayBuffer());
    if (type === 'image/jpeg' && u[2] === 0xFF && u[3] === 0xE0 && u[6] === 0x4A && u[7] === 0x46) { u[13] = 1; u[14] = d >> 8; u[15] = d & 255; u[16] = d >> 8; u[17] = d & 255; return new Blob([u], { type }); }
    if (type === 'image/png' && u[12] === 0x49 && u[13] === 0x48) { const p = Math.round(d / 0.0254), c = new Uint8Array(21), v = new DataView(c.buffer); v.setUint32(0, 9); c.set([0x70, 0x48, 0x59, 0x73], 4); v.setUint32(8, p); v.setUint32(12, p); c[16] = 1; v.setUint32(17, CRC32(c.subarray(4, 17))); return new Blob([u.subarray(0, 33), c, u.subarray(33)], { type }); }
  } catch (e) {} return blob; }
function saveBlob(b, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function printVector(pages) {
  const b = Math.max(0, Number(doc.bleed) || 0);
  $('#pageStyle').textContent = `@page{size:${doc.w + 2 * b}mm ${doc.h + 2 * b}mm;margin:0}`;
  $('#canvas').innerHTML = ''; const th = $('#thumbs'); if (th) th.innerHTML = '';  // SVG id 중복 방지
  // 브라우저 인쇄 PDF에는 재단 여백(슬러그)이 없어 재단선이 도련 위 그림에 찍히므로 끔. 파일 이름에 도련 포함을 표시
  const keepMarks = doc.cropMarks; doc.cropMarks = false; const root = $('#printRoot'); try { root.innerHTML = pages.map(i => sheetHTML(doc.pages[i], 'print')).join(''); } finally { doc.cropMarks = keepMarks; }
  const keepTitle = document.title; document.title = `${(doc.name || 'design').replace(/[\\/:*?"<>|]/g, '_')}_인쇄용${b ? `_도련${b}mm` : ''}`; window.addEventListener('afterprint', () => { document.title = keepTitle; }, { once: true }); setTimeout(() => { document.title = keepTitle; }, 60000);
  setStatus('PDF 준비 중…'); await ensureLibFonts(pages.map(i => doc.pages[i]));
  // 실제로 쓰인 글꼴·굵기·기울임 조합을 모두 먼저 불러 둠 (300·800 같은 굵기가 대체 글꼴로 찍히지 않게)
  const combos = new Set(); root.querySelectorAll('*').forEach(e => { const cs = getComputedStyle(e); if (!e.childNodes.length) return; cs.fontFamily.split(',').forEach(f => combos.add(`${cs.fontStyle} ${cs.fontWeight} 12px "${f.trim().replace(/^["']|["']$/g, '')}"`)); });
  try { await Promise.all([...combos].map(c => document.fonts.load(c, '가A1').catch(() => {}))); await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); } catch (e) {}
  await Promise.all(Array.from(root.querySelectorAll('img')).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
  let fin = false; const done = () => { if (fin) return; fin = true; window.removeEventListener('afterprint', done); root.innerHTML = ''; renderAll(); setStatus(''); };
  window.addEventListener('afterprint', done);
  setStatus('인쇄 창을 열었습니다 (대상: PDF로 저장, 여백: 없음, 배경 그래픽: 켬)'); window.print(); setTimeout(() => { if ($('#printRoot').innerHTML) done(); }, 1500);
}
$('#btnExport').onclick = () => openDownload();

/* ---- 복사·붙여넣기 (단축키·우클릭 메뉴 공용) ---- */
function doCopy(cut) {
  const els = clone(selEls().filter(x => !cut || !x.locked)); if (!els.length) return;
  const assets = {}; const walk = v => { if (typeof v === 'string' && v.startsWith('a:') && doc.assets[v.slice(2)]) assets[v] = doc.assets[v.slice(2)]; else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(els);
  clip = { els, assets, page: cur, n: 0, mark: 'nc-clip:' + uid(), t: Date.now() }; { const c_ = clip; try { navigator.clipboard.writeText(c_.mark).catch(() => { c_.ctx = true; }); } catch (e) { c_.ctx = true; } } // 표식을 못 쓰면(권한 없음) 다음 붙여넣기는 앱 안 복사본으로 // 시스템 클립보드에 표식: 붙여넣을 때 바깥 복사본과 구분
  if (cut) { removeSel(); toast('잘라냈습니다'); } else toast('복사했습니다');
}
function doPaste(inPlace) {
  if (!clip || !clip.els) return; inPlace = inPlace || clip.page !== cur; if (!inPlace) clip.n++; const off = inPlace ? 0 : 5 * clip.n;
  const amap = {}; Object.entries(clip.assets).forEach(([ref, data]) => { amap[ref] = addAsset(data); });
  const gmap = {}; const swap = v => { if (typeof v === 'string' && amap[v]) return amap[v]; if (Array.isArray(v)) return v.map(swap); if (v && typeof v === 'object') { for (const k in v) v[k] = swap(v[k]); } return v; };
  const ids = clip.els.map(el => { const n = swap(clone(el)); n.id = uid(); delete n.gen; delete n.locked; if (n.group) { gmap[n.group] = gmap[n.group] || uid(); n.group = gmap[n.group]; } n.x = r1(n.x + off); n.y = r1(n.y + off); page().els.push(n); return n.id; });
  commit(); select(ids); rerender();
}

/* ---- 스타일 복사·붙여넣기 (Ctrl+Alt+C / Ctrl+Alt+V) ---- */
const STYLE_SKIP = new Set(['rot', 'zoom', 'panX', 'panY', 'pos', 'clip', 'flip', 'flipV', 'fit', 'crop', 'id', 'type', 'x', 'y', 'w', 'h', 'text', 'html', 'htmlFor', 'src', 'srcOrig', 'name', 'role', 'month', 'group', 'locked', 'hidden', 'gen', 'pts', 'data', 'events', 'notes', 'cells', 'merges', 'colW', 'rowH', 'year', 'title', 'kind']);
let styleClip = null;
function copyStyle() { const el = selEls()[0]; if (!el) return; const st = {}; Object.keys(el).forEach(k => { if (!STYLE_SKIP.has(k)) st[k] = clone(el[k]); }); if (el.type === 'shape') st.kind = el.kind; styleClip = { type: el.type, st }; toast('스타일을 복사했습니다 (Ctrl+Alt+V로 다른 요소에 붙여넣기)'); }
function pasteStyle() {
  if (!styleClip) { toast('먼저 스타일을 복사하세요 (Ctrl+Alt+C)', true); return; }
  const same = t => t === styleClip.type || (['shape', 'path'].includes(t) && ['shape', 'path'].includes(styleClip.type));
  const els = selEls().filter(x => !x.locked && same(x.type)); if (!els.length) { toast('같은 종류의 요소(글자는 글자에)를 고르세요', true); return; }
  els.forEach(el => { Object.entries(styleClip.st).forEach(([k, v]) => { if (k === 'kind' && el.type !== 'shape') return; el[k] = clone(v); }); if (el.type === 'text' && el.html) stripRich(el, 'color'); });
  commit(); rerender(); toast(`${els.length}개에 스타일을 붙였습니다`);
}

/* ---- 찾아 바꾸기 (Ctrl+F) · 글꼴 한꺼번에 바꾸기 ---- */
// 문서 안의 모든 글자 자리: 글 상자, 차트 제목, 달력 일정·메모·칸 글자
function textSlots() {
  const out = [];
  doc.pages.forEach((p, pi) => p.els.forEach(el => {
    if (el.locked) return; // 잠긴 요소는 바꾸지 않음 (Canva와 같음)
    if (el.type === 'text') out.push({ pi, el, get: () => el.text, set: v => { if (el.html && el.htmlFor === el.text) { const d = document.createElement('div'); d.innerHTML = el.html; const tw = document.createTreeWalker(d, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) n.nodeValue = n.nodeValue.split(findState.q).join(findState.r); if (domText(d) === v) { const h = richHTML(d); if (h) { el.html = h; el.htmlFor = v; } else { delete el.html; delete el.htmlFor; } } else { delete el.html; delete el.htmlFor; } } else if (el.html) { delete el.html; delete el.htmlFor; } el.text = v; }, label: elName(el) });
    if (el.type === 'chart' && el.title) out.push({ pi, el, get: () => el.title, set: v => { el.title = v; }, label: '차트 제목' });
    if (el.type === 'cal') { (el.events || []).forEach(ev => out.push({ pi, el, get: () => ev.text, set: v => { ev.text = v; }, label: `달력 ${el.month}월 ${ev.d}일 일정` })); (el.notes || []).forEach((t, i) => out.push({ pi, el, get: () => el.notes[i], set: v => { el.notes[i] = v; }, label: `달력 ${el.month}월 메모` })); Object.values(el.cells || {}).forEach(c => { if (c.text) out.push({ pi, el, get: () => c.text, set: v => { c.text = v; }, label: `달력 ${el.month}월 칸 글자` }); }); }
  }));
  return out;
}
let findState = { q: '', r: '', scope: 'all' };
function openFind() {
  let d = $('#dlgFind'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgFind'; d.innerHTML = `<div class="dhead"><h2>찾아 바꾸기 · 글꼴 바꾸기</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="findBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  renderFind(); if (!d.open) d.showModal(); setTimeout(() => { const q = $('#fQ'); if (q) { q.focus(); q.select(); } }, 30);
}
function renderFind() {
  const S = findState, B = $('#findBody');
  if (!$('#fQ')) { // 입력 칸은 한 번만 만듦 (한글 조합 중에 다시 그리면 글자가 깨짐)
    B.innerHTML = `<div class="grid2"><label class="f"><span>찾을 말</span><input id="fQ" value="${esc(S.q)}" placeholder="예: 2027"></label><label class="f"><span>바꿀 말</span><input id="fR" value="${esc(S.r)}" placeholder="예: 2028"></label></div><div id="findRes"></div>`;
    const q = $('#fQ'), r = $('#fR');
    q.addEventListener('input', e => { S.q = q.value; if (!e.isComposing) renderFindRes(); }); q.addEventListener('compositionend', () => { S.q = q.value; renderFindRes(); });
    r.addEventListener('input', () => { S.r = r.value; });
    q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); r.focus(); } });
    B.onclick = e => findClick(e);
  }
  renderFindRes();
}
let findSlots = [];
function renderFindRes() {
  const S = findState; const slots = findSlots = S.q ? textSlots().filter(x => (S.scope === 'all' || x.pi === cur) && (x.get() || '').includes(S.q)) : [];
  const cnt = slots.reduce((a, x) => a + (x.get().split(S.q).length - 1), 0);
  const fonts = {}; doc.pages.forEach(p => p.els.forEach(el => { const add = f => { if (f) fonts[f] = (fonts[f] || 0) + 1; }; if (el.type === 'text') add(el.font); if (el.type === 'cal' || el.type === 'mini') { add((el.s || {}).fontNum); add((el.s || {}).fontBody); } }));
  const keepFrom = ($('#fFrom') || {}).value, keepTo = ($('#fTo') || {}).value;
  $('#findRes').innerHTML = `<div class="row"><div class="seg">${[['all', `모든 쪽 (${doc.pages.length})`], ['page', `현재 쪽 (${cur + 1})`]].map(([k, t]) => `<button data-fscope="${k}" aria-pressed="${S.scope === k}">${t}</button>`).join('')}</div><span class="hint" style="margin:0">${S.q ? `${cnt}곳 (${slots.length}개 요소) · 잠긴 요소는 제외` : '찾을 말을 넣으세요'}</span><button class="btn primary" id="fAll" ${cnt ? '' : 'disabled'}>모두 바꾸기</button></div>
  <ul class="list" style="max-height:240px;overflow:auto;margin-top:8px">${slots.slice(0, 200).map((x, i) => `<li data-fgo="${i}"><b>${x.pi + 1}쪽</b><span>${esc(x.label)} · ${esc(x.get().replace(/\n/g, ' ').slice(0, 60))}</span><button class="btn sm" data-fone="${i}">바꾸기</button></li>`).join('')}</ul>
  <h3 style="margin-top:16px">글꼴 한꺼번에 바꾸기</h3><p class="hint">문서에서 쓰인 글꼴을 다른 글꼴로 모두 바꿉니다 (달력 숫자·글꼴 포함, 잠긴 요소 제외).</p>
  <div class="row"><select id="fFrom">${Object.entries(fonts).sort((a, b) => b[1] - a[1]).map(([f, n]) => `<option value="${esc(f)}" ${f === keepFrom ? 'selected' : ''}>${esc(fontLabel(f))} · ${n}곳</option>`).join('')}</select><span>→</span><select id="fTo">${allFonts().map(f => `<option value="${esc(f.family)}" ${f.family === keepTo ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select><button class="btn" id="fFont">바꾸기</button></div>`;
}
function findClick(e) {
  const S = findState, slots = findSlots, cnt = slots.reduce((a, x) => a + (x.get().split(S.q).length - 1), 0);
  const sc = e.target.closest('[data-fscope]'); if (sc) { S.scope = sc.dataset.fscope; renderFindRes(); return; }
  const one = e.target.closest('[data-fone]'); if (one) { const x = slots[Number(one.dataset.fone)]; x.set(x.get().split(S.q).join(S.r)); commit(); rerender(); renderFindRes(); return; }
  const go = e.target.closest('[data-fgo]'); if (go) { const x = slots[Number(go.dataset.fgo)]; if (x.pi !== cur) goto(x.pi); select([x.el.id]); return; }
  if (e.target.id === 'fAll') { slots.forEach(x => x.set(x.get().split(S.q).join(S.r))); commit(); renderAll(); toastUndo(`${cnt}곳을 바꿨습니다`); renderFindRes(); }
  if (e.target.id === 'fFont') { const a = $('#fFrom').value, b = $('#fTo').value; if (!a || a === b) return; let n = 0; doc.pages.forEach(p => p.els.forEach(el => { if (el.locked) return; if (el.type === 'text' && el.font === a) { el.font = b; n++; } if ((el.type === 'cal' || el.type === 'mini') && el.s) { if (el.s.fontNum === a) { el.s.fontNum = b; n++; } if (el.s.fontBody === a) { el.s.fontBody = b; n++; } } })); commit(); renderAll(); toast(`${n}곳의 글꼴을 바꿨습니다`); renderFindRes(); }
}

/* ---- 우클릭 메뉴 ---- */
function openCtx(ev, items) {
  $('#ctxMenu') && $('#ctxMenu').remove();
  const m = document.createElement('div'); m.id = 'ctxMenu'; m.className = 'fmenu ctx';
  m.innerHTML = items.map(it => it === '-' ? '<hr>' : `<button data-ctx="${it[0]}" ${it[3] ? 'disabled' : ''}>${it[1]}${it[2] ? `<kbd>${it[2]}</kbd>` : ''}</button>`).join('');
  document.body.appendChild(m); m.style.left = Math.min(ev.clientX, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = Math.min(ev.clientY, innerHeight - m.offsetHeight - 8) + 'px';
  const off = e2 => { if (!m.contains(e2.target)) close(); };
  const esc_ = e2 => { if (!document.body.contains(m)) return close(); if (e2.key === 'Escape') { e2.stopImmediatePropagation(); close(); } };
  const close = () => { m.remove(); document.removeEventListener('keydown', esc_, true); document.removeEventListener('pointerdown', off, true); $('#scroller').removeEventListener('scroll', close); };
  m.onclick = e => { const b = e.target.closest('[data-ctx]'); if (!b || b.disabled) return; close(); ctxDo(b.dataset.ctx); };
  setTimeout(() => document.addEventListener('pointerdown', off, true), 0); document.addEventListener('keydown', esc_, true); $('#scroller').addEventListener('scroll', close);
}
function ctxDo(k) {
  const els = selEls(), el = els[0];
  ({ copy: () => doCopy(false), cut: () => doCopy(true), paste: () => doPaste(false), pastein: () => doPaste(true), dup: duplicate, del: removeSel, ungroup: ungroupSel, cstyle: copyStyle, pstyle: pasteStyle,
    front: () => reorder('front'), up: () => reorder('up'), down: () => reorder('down'), back: () => reorder('back'), group: groupSel,
    lock: () => { const on = !els.every(x => x.locked); els.forEach(x => x.locked = on); commit(); renderOverlay(); renderInspector(); if (sideTab === 'layers') renderSide(); toast(on ? '잠갔습니다 (Ctrl+L로 풀기)' : '잠금을 풀었습니다'); },
    flipH: () => flipSel('h'), flipV: () => flipSel('v'),
    asbg: () => { if (!el || el.type !== 'image') return; el.x = 0; el.y = 0; el.w = doc.w; el.h = doc.h; el.fit = 'cover'; el.rot = 0; el.locked = true; reorder('back'); toast('배경으로 만들고 잠갔습니다 (레이어에서 잠금 해제)'); },
    all: () => select(page().els.filter(x => !x.hidden && !x.locked).map(x => x.id)), find: openFind, rulers: toggleRulers, clrguides: () => { doc.guides = { x: [], y: [] }; commit(); renderOverlay(); toast('안내선을 모두 지웠습니다'); } })[k]();
}
function flipSel(dir) { const els = selEls().filter(x => !x.locked && x.type === 'image'); if (!els.length) { toast('뒤집기는 그림에 쓸 수 있습니다', true); return; } els.forEach(x => { if (dir === 'h') x.flip = !x.flip; else x.flipV = !x.flipV; }); commit(); rerender(); }
$('#scroller').addEventListener('contextmenu', e => {
  if (e.target.closest('#cellEd') || editing) return; e.preventDefault();
  const d = (document.elementsFromPoint(e.clientX, e.clientY).map(n => { const g = n.closest && n.closest('#ghost .el'); return g ? $(`#canvas [data-id="${g.dataset.id}"]`) : n.closest && n.closest('#canvas .el'); }).filter(Boolean)).find(x => { const el = find(x.dataset.id); return el && (!el.locked || sel.includes(el.id) || !lockedBg(el)); });
  if (d && !sel.includes(d.dataset.id)) select(groupOf(d.dataset.id));
  if (!d) { if (sel.length) select([]); openCtx(e, [['paste', '붙여넣기', 'Ctrl+V', !clip], ['pastein', '같은 자리에 붙여넣기', 'Ctrl+Shift+V', !clip], '-', ['all', '모두 선택', 'Ctrl+A'], ['find', '찾아 바꾸기…', 'Ctrl+F'], '-', ['rulers', showRulers() ? '눈금자 끄기' : '눈금자 보이기', 'Shift+R'], ...(doc.guides && (doc.guides.x.length || doc.guides.y.length) ? [['clrguides', '안내선 모두 지우기', '']] : [])]); return; }
  const els = selEls(), img = els.length === 1 && els[0].type === 'image', locked = els.every(x => x.locked);
  openCtx(e, [['copy', '복사', 'Ctrl+C'], ['cut', '잘라내기', 'Ctrl+X'], ['paste', '붙여넣기', 'Ctrl+V', !clip], ['dup', '복제', 'Ctrl+D'], ['del', '삭제', 'Delete'], '-', ['cstyle', '스타일 복사', 'Ctrl+Alt+C'], ['pstyle', '스타일 붙여넣기', 'Ctrl+Alt+V', !styleClip], '-',
    ['front', '맨 앞으로', 'Ctrl+Shift+]'], ['up', '앞으로', 'Ctrl+]'], ['down', '뒤로', 'Ctrl+['], ['back', '맨 뒤로', 'Ctrl+Shift+['], '-',
    ...(selUnitCount() >= 2 ? [['group', '그룹으로 묶기', 'Ctrl+G']] : []), ...(els.some(x => x.group) ? [['ungroup', '그룹 해제', 'Ctrl+Shift+G']] : []), ['lock', locked ? '잠금 풀기' : '잠그기', 'Ctrl+L'],
    ...(img ? [['flipH', '좌우 뒤집기', 'Shift+H'], ['flipV', '상하 뒤집기', 'Shift+V'], ['asbg', '배경으로 만들기', '']] : [])]);
});

/* ---- 추가 단축키: 스타일 복사, 찾기, 잠금, 뒤집기, 숫자 투명도, Ctrl+화살표 회전 ---- */
document.addEventListener('keydown', e => {
  if (editing || $('#cellEd') || (e.target.matches && e.target.matches('input,textarea,select')) || document.querySelector('dialog[open]')) { if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF' && !editing && !document.querySelector('dialog[open]')) { e.preventDefault(); openFind(); } return; }
  const mod = e.ctrlKey || e.metaKey; const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (mod && e.code === 'KeyF') { stop(); openFind(); return; }
  if (mod && e.altKey && e.code === 'KeyC') { stop(); copyStyle(); return; }
  if (mod && e.altKey && e.code === 'KeyV') { stop(); pasteStyle(); return; }
  if (!sel.length || (cellSel && (!mod || e.code.startsWith('Arrow')))) return;
  if (mod && e.code === 'KeyL') { stop(); ctxDo('lock'); return; }
  if (e.shiftKey && !mod && e.code === 'KeyH') { stop(); flipSel('h'); return; }
  if (e.shiftKey && !mod && e.code === 'KeyV') { stop(); flipSel('v'); return; }
  if (!mod && !e.altKey && !e.shiftKey && /^Digit[0-9]$/.test(e.code) && !cellSel) { stop(); const n = Number(e.code.slice(5)); selEls().forEach(x => { if (!x.locked) x.opacity = n === 0 ? 1 : n / 10; }); commitSoon(); renderCanvas(); renderInspector(); toast(`투명도 ${n === 0 ? 100 : n * 10}%`); return; }
  if (mod && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { stop(); const d = (e.code === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 15 : 1); selEls().forEach(x => { if (!x.locked) x.rot = Math.round((((x.rot || 0) + d) % 360 + 360) % 360); }); commitSoon(); renderCanvas(); renderOverlay(); renderInspector(); return; }
}, true);

/* ---- 페이지 목록: 끌어서 순서 바꾸기 ---- */
document.addEventListener('dragstart', e => { const t = e.target.closest && e.target.closest('#thumbs .thumb'); if (!t) return; e.dataTransfer.setData('text/x-nc-page', t.dataset.i); e.dataTransfer.effectAllowed = 'move'; t.classList.add('dragging'); });
document.addEventListener('dragover', e => { const t = e.target.closest && e.target.closest('#thumbs .thumb'); if (!t || !e.dataTransfer.types.includes('text/x-nc-page')) return; e.preventDefault(); $$('#thumbs .thumb').forEach(x => x.classList.remove('dropb', 'dropa')); const r = t.getBoundingClientRect(); t.classList.add(e.clientY < r.top + r.height / 2 ? 'dropb' : 'dropa'); });
document.addEventListener('dragend', () => $$('#thumbs .thumb').forEach(x => x.classList.remove('dragging', 'dropb', 'dropa')));
document.addEventListener('drop', e => {
  const t = e.target.closest && e.target.closest('#thumbs .thumb'); if (!t || !e.dataTransfer.types.includes('text/x-nc-page')) return; e.preventDefault();
  const from = Number(e.dataTransfer.getData('text/x-nc-page')); const r = t.getBoundingClientRect(); let to = Number(t.dataset.i) + (e.clientY < r.top + r.height / 2 ? 0 : 1); if (to > from) to--;
  if (to === from) return; const [p] = doc.pages.splice(from, 1); doc.pages.splice(to, 0, p); sel = []; cellSel = null; selDay = null; cur = to; commit(); renderAll(); toast(`${from + 1}쪽을 ${to + 1}번째로 옮겼습니다`);
});

/* ---- 레이어: 끌어서 순서 바꾸기, 두 번 눌러 이름 바꾸기 ---- */
document.addEventListener('dragstart', e => { const l = e.target.closest && e.target.closest('#sidebody .layer'); if (!l) return; e.dataTransfer.setData('text/x-nc-layer', l.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
document.addEventListener('dragover', e => { const l = e.target.closest && e.target.closest('#sidebody .layer'); if (!l || !e.dataTransfer.types.includes('text/x-nc-layer')) return; e.preventDefault(); $$('#sidebody .layer').forEach(x => x.classList.remove('dropb', 'dropa')); const r = l.getBoundingClientRect(); l.classList.add(e.clientY < r.top + r.height / 2 ? 'dropb' : 'dropa'); });
document.addEventListener('drop', e => {
  const l = e.target.closest && e.target.closest('#sidebody .layer'); if (!l || !e.dataTransfer.types.includes('text/x-nc-layer')) return; e.preventDefault();
  const id = e.dataTransfer.getData('text/x-nc-layer'), tid = l.dataset.id; if (id === tid) return; const els = page().els; const el = find(id); const above = e.clientY < l.getBoundingClientRect().top + l.getBoundingClientRect().height / 2;
  els.splice(els.indexOf(el), 1); const ti = els.findIndex(x => x.id === tid); els.splice(above ? ti + 1 : ti, 0, el); // 목록은 위가 앞(배열 뒤쪽)
  commit(); rerender(); renderSide();
});
document.addEventListener('dblclick', e => { const sp = e.target.closest && e.target.closest('#sidebody .layer span'); if (!sp) return; const el = find(sp.closest('.layer').dataset.id); const n = window.prompt('레이어 이름', el.name || elName(el)); if (n == null) return; el.name = n.trim(); commit(); renderSide(); renderInspector(); });

/* ---- 색 고르기: HEX 입력 · 브랜드 색 · 문서에 쓰인 색 · 최근 색 · 스포이트 · 같은 색 모두 바꾸기 ----
   속성 패널의 모든 색 칸(input[type=color]) 옆에 HEX 칸과 ▾ 단추를 붙임. 고른 색은 원래 색 칸에 넣고 input·change를 보내므로 기존 처리 그대로 동작 */
const BRAND_DEF = ['#002559', '#B82837', '#F2C94C', '#FFFFFF', '#111111', '#6B7280'];
const isHex = v => /^#[0-9a-f]{6}$/i.test(v);
function lsList(k, def) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return Array.isArray(v) ? v : def; } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
const brandColors = () => lsList('naracal-brand-colors', BRAND_DEF);
const recentColors = () => lsList('naracal-recent-colors', []);
function noteColor(c) { c = c.toUpperCase(); lsSet('naracal-recent-colors', [c].concat(recentColors().filter(x => x.toUpperCase() !== c)).slice(0, 10)); }
// 문서에 쓰인 색 (많이 쓴 순)
function docColors(pages) {
  const n = {}; const walk = v => { if (typeof v === 'string') { if (isHex(v)) { const c = v.toUpperCase(); n[c] = (n[c] || 0) + 1; } } else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  (pages || doc.pages).forEach(p => { walk(p.bg); walk(p.els); });
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
// 같은 색을 모두 바꿈 (요소의 색 속성·달력 서식·칸 색·쪽 배경). 바꾼 곳 수를 돌려줌
function replaceColor(from, to, pages) {
  let n = 0; from = from.toUpperCase();
  const walk = o => { for (const k in o) { const v = o[k]; if (typeof v === 'string') { if (isHex(v) && v.toUpperCase() === from) { o[k] = to; n++; } } else if (v && typeof v === 'object') walk(v); } };
  pages.forEach(p => { if (typeof p.bg === 'string' && isHex(p.bg) && p.bg.toUpperCase() === from) { p.bg = to; n++; } p.els.forEach(el => { if (!el.locked) walk(el); }); });
  return n;
}
function decorateColors(root) {
  root.querySelectorAll('input[type=color]:not([data-cdeco])').forEach(inp => {
    inp.dataset.cdeco = '1';
    if (inp.closest('.textbar')) { const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'cpal'; b2.title = '브랜드 색 · 문서 색 · 스포이트'; b2.textContent = '▾'; (inp.closest('label') || inp).after(b2); b2.addEventListener('mousedown', () => { try { saveSel(); } catch (err) {} }); b2.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPalette(inp, b2); }); return; }
    const hex = document.createElement('input'); hex.className = 'hexin'; hex.value = inp.value.toUpperCase(); hex.maxLength = 7; hex.spellcheck = false; hex.title = 'HEX 색 코드 (예: #002559)';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cpal'; btn.title = '브랜드 색 · 문서 색 · 스포이트'; btn.textContent = '▾';
    const wrap = document.createElement('span'); wrap.className = 'cfield'; inp.replaceWith(wrap); wrap.append(inp, hex, btn);
    inp.addEventListener('input', () => { hex.value = inp.value.toUpperCase(); });
    hex.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); hex.blur(); } e.stopPropagation(); });
    hex.addEventListener('change', () => { let v = hex.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).split('').map(c => c + c).join(''); if (!isHex(v)) { hex.value = inp.value.toUpperCase(); toast('색 코드는 #RRGGBB 꼴로 넣으세요', true); return; } applyColor(inp, v); });
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPalette(inp, btn); });
    if (root.id === 'textBar') [btn, hex].forEach(x => x.addEventListener('mousedown', () => { try { saveSel(); } catch (err) {} }));
  });
}
function applyColor(inp, c, opt) {
  const old = inp.value; inp.value = c; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); noteColor(c);
  if (opt && opt.all && isHex(old) && old.toUpperCase() !== c.toUpperCase()) { const n = replaceColor(old, c, opt.all === 'page' ? [page()] : doc.pages); amendCommit(); renderAll(); toast(`같은 색 ${n}곳을 바꿨습니다`); }
}
let palAll = '';
function openPalette(inp, anchor) {
  // 속성 패널이 다시 그려지면 같은 항목의 새 색 칸을 찾아 씀
  const T = () => document.body.contains(inp) ? inp : (inp.dataset.k && $(`#inspector input[type=color][data-k="${inp.dataset.k}"]`)) || inp;
  $('#cpalPop') && $('#cpalPop').remove();
  const m = document.createElement('div'); m.id = 'cpalPop'; m.className = 'cpalpop';
  const inBar = !!anchor.closest('.textbar'); const sw = (list, cls) => list.map(c => `<button class="csw ${cls || ''}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('');
  const draw = () => {
    const cur_ = T().value.toUpperCase(), brand = brandColors(), inBrand = brand.some(c => c.toUpperCase() === cur_);
    m.innerHTML = `<div class="cph"><span class="csw big" style="background:${cur_}"></span><b>${cur_}</b>${window.EyeDropper ? '<button class="btn sm" data-eye title="화면에서 색 집기">스포이트</button>' : ''}</div>
      <h4>나라차 브랜드 색 <button class="lnk" data-brand="${inBrand ? 'del' : 'add'}">${inBrand ? '이 색 빼기' : '+ 이 색 넣기'}</button></h4><div class="cgrid">${sw(brand)}</div>
      ${recentColors().length ? `<h4>최근 쓴 색</h4><div class="cgrid">${sw(recentColors())}</div>` : ''}
      <h4>이 문서에 쓰인 색</h4><div class="cgrid">${sw(docColors().slice(0, 24))}</div>
      <h4>기본 색</h4><div class="cgrid">${sw(['#000000', '#3F3F46', '#71717A', '#D4D4D8', '#FFFFFF', '#E11D48', '#F97316', '#FACC15', '#22C55E', '#14B8A6', '#0EA5E9', '#2563EB', '#7C3AED', '#DB2777', '#8B5A2B', '#FDE68A'])}</div>
      ${inBar ? '' : `<div class="cpall"><label class="chk"><input type="checkbox" data-all ${palAll ? 'checked' : ''}> 같은 색 모두 바꾸기</label><select data-allsc ${palAll ? '' : 'disabled'}><option value="page" ${palAll === 'page' ? 'selected' : ''}>이 쪽만</option><option value="doc" ${palAll === 'doc' ? 'selected' : ''}>모든 쪽</option></select></div>
      <p class="hint" style="margin:4px 0 0">켜 두면 지금 색(${cur_})을 쓴 다른 요소도 함께 바뀝니다.</p>`}`;
  };
  draw(); (anchor.closest('#textBar, #cellBar') || document.body).appendChild(m);
  const r = anchor.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = (r.bottom + m.offsetHeight + 8 > innerHeight ? Math.max(8, r.top - m.offsetHeight - 4) : r.bottom + 4) + 'px';
  m.addEventListener('click', async e => {
    const c = e.target.closest('[data-c]'); if (c) { applyColor(T(), c.dataset.c, { all: inBar ? '' : palAll === 'doc' ? 'doc' : palAll ? 'page' : '' }); draw(); return; }
    if (e.target.closest('[data-eye]')) { try { const r_ = await new window.EyeDropper().open(); applyColor(T(), r_.sRGBHex.length === 7 ? r_.sRGBHex : rgbHex(r_.sRGBHex), { all: inBar ? '' : palAll }); draw(); } catch (err) {} return; }
    const b = e.target.closest('[data-brand]'); if (b) { const cur_ = T().value.toUpperCase(); lsSet('naracal-brand-colors', b.dataset.brand === 'add' ? brandColors().concat(cur_) : brandColors().filter(x => x.toUpperCase() !== cur_)); draw(); }
  });
  m.addEventListener('change', e => { if (e.target.matches('[data-all]')) { palAll = e.target.checked ? 'page' : ''; draw(); } if (e.target.matches('[data-allsc]')) palAll = e.target.value; });
  setTimeout(() => document.addEventListener('pointerdown', function off(e2) { if (!m.contains(e2.target)) { m.remove(); document.removeEventListener('pointerdown', off); } }), 0);
}
function rgbHex(s) { const m = String(s).match(/\d+/g); return m ? '#' + m.slice(0, 3).map(x => Number(x).toString(16).padStart(2, '0')).join('') : '#000000'; }
new MutationObserver(() => decorateColors($('#inspector'))).observe($('#inspector'), { childList: true, subtree: true });
decorateColors($('#inspector'));

/* ---- 사진 끌어 넣기: 컴퓨터 파일이나 왼쪽 패널의 그림을 캔버스로. 그림 위에 놓으면 그 그림만 바꿈(크기·자르기 유지) ---- */
document.addEventListener('dragstart', e => { const b = e.target.closest && e.target.closest('#sidebody [data-img], #sidebody [data-libimg]'); if (!b) return; e.dataTransfer.setData('text/x-nc-img', b.dataset.libimg ? 'lib|' + b.dataset.libimg : b.dataset.img); e.dataTransfer.effectAllowed = 'copy'; });
const dropKind = e => { const t = e.dataTransfer && e.dataTransfer.types; return t && (t.includes('text/x-nc-img') ? 'img' : t.includes('Files') ? 'file' : ''); };
function dropTarget(e) { const d = document.elementsFromPoint(e.clientX, e.clientY).map(n => n.closest && n.closest('#canvas .el')).find(Boolean); const el = d && find(d.dataset.id); return el && el.type === 'image' && !el.locked ? el : null; }
window.addEventListener('dragover', e => { if (dropKind(e) === 'file') e.preventDefault(); }); // 캔버스 밖에 떨어뜨려도 브라우저가 파일을 열지 않게
window.addEventListener('drop', e => { if (dropKind(e) === 'file' && !e.target.closest('#scroller')) e.preventDefault(); });
$('#scroller').addEventListener('dragover', e => {
  if (!dropKind(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  const el = dropTarget(e); $$('#canvas .el.dropon').forEach(x => x.classList.remove('dropon')); if (el) { const d = $(`#canvas .el[data-id="${el.id}"]`); if (d) d.classList.add('dropon'); }
});
$('#scroller').addEventListener('dragleave', e => { if (!e.relatedTarget || !$('#scroller').contains(e.relatedTarget)) $$('#canvas .el.dropon').forEach(x => x.classList.remove('dropon')); });
// 동영상·소리 파일 끌어다 놓기: 원본은 이 PC에 그대로 두고 위치(손잡이)만 기억 — 길이와 상관없이 편집 가능
function mediaDrop(e) {
  const kindOf = it => { if (/^(video|audio)\//.test(it.type)) return it.type; const f = it.getAsFile(), n = (f && f.name) || ''; return /\.(m4a|mp3|wav|aac|flac|ogg|opus|wma)$/i.test(n) ? 'audio/x' : /\.(mp4|mov|m4v|webm|mkv)$/i.test(n) ? 'video/x' : ''; };
  const items = [...(e.dataTransfer.items || [])].filter(it => it.kind === 'file').map(it => ({ it, t: kindOf(it) })).filter(x => x.t).map(x => Object.assign(x.it, { _t: x.t })); if (!items.length) return false;
  e.preventDefault(); e.stopPropagation();
  const got = items.map(it => ({ type: it._t, file: it.getAsFile(), hp: it.getAsFileSystemHandle ? it.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null) })); // 이벤트 안에서 바로 받아 둬야 함
  (async () => { for (const g of got) { try { const h = await g.hp; const m = h && h.kind === 'file' ? await NC.media.addHandle(h) : await NC.media.addFile(g.file); if (/^video/.test(g.type)) await placeVideo(m); else await placeAudio(m); } catch (err) { toast('넣지 못했습니다: ' + err.message, true); } } })();
  return true;
}
document.addEventListener('drop', e => { if (e.target.closest && e.target.closest('#vtl') && e.dataTransfer && mediaDrop(e)) return; }, true);
document.addEventListener('dragover', e => { if (e.target.closest && e.target.closest('#vtl') && e.dataTransfer && [...(e.dataTransfer.items || [])].some(it => it.kind === 'file')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }, true);
$('#scroller').addEventListener('drop', async e => {
  const kind = dropKind(e); if (!kind) return; if (kind === 'file' && mediaDrop(e)) return; e.preventDefault(); $$('#canvas .el.dropon').forEach(x => x.classList.remove('dropon'));
  const tgt = dropTarget(e), p = toMM(e), pg0 = page(); let refs = [];
  if (kind === 'img') { const v = e.dataTransfer.getData('text/x-nc-img'); const r = v.startsWith('lib|') ? await libInsert(v.slice(4)) : v; if (r) refs = [r]; }
  else { const fs = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type)); if (!fs.length) { toast('그림·동영상·소리 파일만 넣을 수 있습니다', true); return; } for (const f of fs) refs.push(addAsset(await fileToDataURL(f))); }
  if (!refs.length || page() !== pg0) return;
  if (tgt && refs.length === 1 && pg0.els.includes(tgt)) { tgt.src = refs[0]; delete tgt.srcOrig; commit(); select([tgt.id]); rerender(); toast('그림을 바꿨습니다 (자리·크기·자르기는 그대로)'); return; }
  const ids = [];
  for (const [i, ref] of refs.entries()) {
    const im = await new Promise(res => { const i_ = new Image(); i_.onload = () => res(i_); i_.onerror = () => res(null); i_.src = src(ref); }); const ar = im ? im.naturalWidth / im.naturalHeight : 1;
    let w = Math.min(80 * docK(), doc.w * 0.6), h = w / ar; if (h > doc.h * 0.8) { h = doc.h * 0.8; w = h * ar; }
    const el = { id: uid(), type: 'image', src: ref, x: r1(clamp(p.x - w / 2 + i * 5, -w / 2, doc.w - w / 2)), y: r1(clamp(p.y - h / 2 + i * 5, -h / 2, doc.h - h / 2)), w: r1(w), h: r1(h), rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' };
    page().els.push(el); ids.push(el.id);
  }
  commit(); select(ids); rerender(); if (sideTab === 'upload' || sideTab === 'photo') renderSide();
});

/* ---- 크기 조정 (Canva '크기 조정'): 새 크기에 맞춰 내용을 다시 배치. 이 디자인을 바꾸거나 새 크기로 사본을 만듦 ----
   fit: 비율을 지키며 줄이고 늘림. 쪽 가장자리에 가까운 요소는 그 가장자리 기준, 가운데 요소는 가운데 기준. 배경·띠는 새 쪽을 꽉 채움
   stretch: 가로·세로를 따로 늘림 / keep: 크기는 그대로 두고 가운데로 옮김 */
function resizeEls(els, w0, h0, W, H, mode) {
  const sx = W / w0, sy = H / h0, s = mode === 'keep' ? 1 : Math.min(sx, sy);
  const fit1 = (p, sz, len0, len1, k, band) => { // 한 축의 새 위치·크기
    if (mode === 'stretch' || band) return [p * (len1 / len0), sz * (len1 / len0)]; // 쪽을 가로지르는 배경·띠는 그 축을 꽉 채움
    const n = sz * k, c = p + sz / 2;
    if (mode === 'keep') return [p + (len1 - len0) / 2, sz];
    if (c < len0 / 3) return [p * k, n]; // 앞쪽 가장자리 기준
    if (c > len0 * 2 / 3) return [len1 - (len0 - p - sz) * k - n, n]; // 뒤쪽 가장자리 기준
    return [c / len0 * len1 - n / 2, n]; // 가운데 기준
  };
  // 그룹은 한 덩어리로 자리를 정하고 안의 요소는 비율대로 (배지의 바탕과 글자가 흩어지지 않게)
  const units = new Map(); els.forEach(el => { const k = el.group || el.id; if (!units.has(k)) units.set(k, []); units.get(k).push(el); });
  const MM_KEYS = ['strokeW', 'shX', 'shY', 'shB', 'glowB', 'd3X', 'd3Y', 'pad', 'bgR', 'borderW', 'radius'];
  units.forEach(list => {
    const bx = Math.min(...list.map(e => e.x)), by = Math.min(...list.map(e => e.y)), bw = Math.max(...list.map(e => e.x + e.w)) - bx, bh = Math.max(...list.map(e => e.y + e.h)) - by;
    const rot = list.length === 1 && list[0].rot;
    const bandX = bw >= w0 * 0.95 && !rot, bandY = bh >= h0 * 0.95 && !rot;
    const [nx, nw] = fit1(bx, bw, w0, W, s, bandX), [ny, nh] = fit1(by, bh, h0, H, s, bandY);
    const fx = bw ? nw / bw : 1, fy = bh ? nh / bh : 1, f = mode === 'stretch' ? Math.min(fx, fy) : s; // 글자·선 굵기 배율
    list.forEach(el => {
      const ex = fx, ey = fy;
      if (el.pts) el.pts = el.pts.map(q => [r1(q[0] * ex), r1(q[1] * ey)]);
      el.x = r1(nx + (el.x - bx) * fx); el.y = r1(ny + (el.y - by) * fy); el.w = r1(el.w * ex); el.h = r1(el.h * ey);
      if (f !== 1) {
        if (el.size) el.size = Math.round(el.size * f * 10) / 10;
        if (el.html) el.html = el.html.replace(/font-size:\s*([\d.]+)pt/g, (_, v) => 'font-size:' + Math.round(v * f * 2) / 2 + 'pt');
        MM_KEYS.forEach(k => { if (typeof el[k] === 'number' && el[k]) el[k] = Math.round(el[k] * f * 100) / 100; });
        if (el.s && (el.type === 'cal' || el.type === 'mini')) Object.keys(el.s).forEach(k => { if (/Size$|H$/.test(k) && typeof el.s[k] === 'number') el.s[k] = Math.round(el.s[k] * f * 10) / 10; });
      }
    });
  });
}
function resizedDoc(src_, W, H, mode) { const d = clone(src_); d.pages.forEach(p => resizeEls(p.els, src_.w, src_.h, W, H, mode)); d.w = W; d.h = H; return d; }
let rsState = { fmt: '', w: 0, h: 0, unit: 'mm', mode: 'fit' };
function openResize() {
  endEdit(); let d = $('#dlgResize');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlgResize'; d.className = 'wide'; d.innerHTML = `<div class="dhead"><h2>크기 조정</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="rsBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  rsState = { fmt: '', w: doc.w, h: doc.h, unit: 'mm', mode: 'fit' }; renderResize(); d.showModal();
}
function rsMM() { return rsState.unit === 'px' ? [PX(rsState.w), PX(rsState.h)] : [rsState.w, rsState.h]; }
function renderResize() {
  const S = rsState, [W, H] = rsMM(), ok = W > 5 && H > 5 && W < 20000 && H < 20000;
  const prevPage = ok ? resizedDoc({ w: doc.w, h: doc.h, pages: [page()] }, W, H, S.mode).pages[0] : null;
  const box = 220, k = ok ? Math.min(box / W, box / H) : 1;
  $('#rsBody').innerHTML = `<div class="rsgrid"><div>
    <label class="f"><span>새 크기 고르기</span><select id="rsFmt"><option value="">직접 입력</option>${ND_GROUPS.filter(g => g[0] !== 'rec').map(([g, t]) => `<optgroup label="${t}">${FORMATS.filter(f => f[2] === g).map(f => `<option value="${f[0]}" ${S.fmt === f[0] ? 'selected' : ''}>${esc(f[1])} · ${fmtLabel(f)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <div class="row"><label class="f" style="flex:1"><span>가로</span><input type="number" id="rsW" value="${S.w}" step="0.5"></label><button class="btn sm" id="rsSwap" title="가로·세로 바꾸기" style="margin-top:18px">⇄</button><label class="f" style="flex:1"><span>세로</span><input type="number" id="rsH" value="${S.h}" step="0.5"></label><label class="f" style="width:72px"><span>단위</span><select id="rsU"><option value="mm" ${S.unit === 'mm' ? 'selected' : ''}>mm</option><option value="px" ${S.unit === 'px' ? 'selected' : ''}>px</option></select></label></div>
    <p class="hint" style="margin:0">지금 크기: ${docSizeLabel(' × ')} · 쪽 ${doc.pages.length}개</p>
    <h3>내용 맞추는 방법</h3>
    <div class="rsmodes">${[['fit', '알맞게 다시 배치 (추천)', '비율을 지키며 크기를 맞추고, 가장자리 요소는 가장자리에, 배경·띠는 새 쪽을 꽉 채웁니다'], ['stretch', '늘려서 채우기', '가로·세로를 따로 늘립니다. 비율 차이가 작을 때'], ['keep', '내용 크기 그대로', '요소 크기는 두고 가운데로만 옮깁니다']].map(([m, t, dd]) => `<label class="rsmode ${S.mode === m ? 'on' : ''}"><input type="radio" name="rsMode" value="${m}" ${S.mode === m ? 'checked' : ''}><b>${t}</b><small>${dd}</small></label>`).join('')}</div>
  </div><div class="rsprev"><span class="hint">미리보기 (${cur + 1}쪽)</span><div class="rsbox" style="width:${ok ? W * k : box}px;height:${ok ? H * k : box}px">${ok ? `<div style="transform:scale(${k * 25.4 / 96});transform-origin:0 0;position:absolute;left:0;top:0">${tmpSheet(W, H, prevPage.els, page().bg)}</div>` : ''}</div>
  <p class="hint" style="text-align:center">${ok ? `${Math.round(W * 10) / 10} × ${Math.round(H * 10) / 10} mm` : '크기를 확인해 주세요'}</p></div></div>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="rsCopy" ${ok ? '' : 'disabled'}>새 크기로 사본 만들기</button><button class="btn primary" id="rsApply" ${ok ? '' : 'disabled'}>이 디자인 크기 바꾸기</button></div>`;
  const B = $('#rsBody');
  $('#rsFmt').onchange = e => { const f = FORMATS.find(x => x[0] === e.target.value); S.fmt = e.target.value; if (f) { S.w = f[3]; S.h = f[4]; S.unit = f[5]; } renderResize(); };
  $('#rsW').onchange = e => { S.w = Number(e.target.value); S.fmt = ''; renderResize(); }; $('#rsH').onchange = e => { S.h = Number(e.target.value); S.fmt = ''; renderResize(); };
  $('#rsU').onchange = e => { const u = e.target.value; if (u !== S.unit) { const f = u === 'px' ? 96 / 25.4 : 25.4 / 96; S.w = Math.round(S.w * f * 10) / 10; S.h = Math.round(S.h * f * 10) / 10; S.unit = u; } renderResize(); };
  $('#rsSwap').onclick = () => { [S.w, S.h] = [S.h, S.w]; S.fmt = ''; renderResize(); };
  B.querySelectorAll('[name=rsMode]').forEach(r => r.onchange = () => { S.mode = r.value; renderResize(); });
  $('#rsApply').onclick = () => { const nd = resizedDoc({ w: doc.w, h: doc.h, pages: doc.pages }, W, H, S.mode); doc.pages = nd.pages; doc.w = W; doc.h = H; doc.fmt = S.fmt || ''; { const f = FORMATS.find(x => x[0] === S.fmt); if (f) doc.bleed = ['print', 'doc', 'cal'].includes(f[2]) && f[5] === 'mm' ? (doc.bleed || 3) : 0; } commit();  /* 인쇄물↔SNS로 바꾸면 도련도 맞춤 */ zoom = 0; $('#dlgResize').close(); renderAll(); fitCanvas && fitCanvas(); toastUndo(`크기를 ${Math.round(W * 10) / 10} × ${Math.round(H * 10) / 10} mm로 바꿨습니다`, () => { zoom = 0; fitCanvas(); }); };
  $('#rsCopy').onclick = async () => {
    const f = FORMATS.find(x => x[0] === S.fmt); const nd = resizedDoc(doc, W, H, S.mode); nd.fmt = S.fmt || ''; nd.name = `${doc.name || '새 디자인'} (${f ? f[1] : `${Math.round(W)}×${Math.round(H)}`})`;
    if (f) nd.bleed = ['print', 'doc', 'cal'].includes(f[2]) && f[5] === 'mm' ? (doc.bleed || 3) : 0;
    $('#dlgResize').close(); gcAssets();
    try {
      if (await store.folderReady()) { const h = await store.copyIntoFolder(nd); if (window.confirm(`"${h.name.replace(/\.design\.json$/i, '')}"을(를) 만들었습니다.\n\n확인: 새 크기 디자인을 열어 다듬기\n취소: 지금 문서에서 계속`)) await openFolderDoc(h, '새 크기 디자인을 열었습니다'); else toast('새 크기 사본을 만들었습니다 (열기 목록에 있습니다)'); }
      else { store.download(nd); toast('새 크기 사본을 파일로 내려받았습니다'); }
    } catch (e) { toast('사본을 만들지 못했습니다: ' + e.message, true); }
  };
}

/* ---- 버전 기록 (Canva 'Version history'): 동기화 폴더에 15분마다 남은 문서 상태를 보고 되돌리거나 사본으로 ---- */
const DOC_KEYS_SKIP = new Set(['saveId', 'lineage', 'savedBy', 'pcId', 'savedAt', 'docId', 'name', '_size']);
async function openVersions() {
  if (!(store.state.handle && (await store.folderReady()))) { toast('버전 기록은 동기화 폴더(구글 드라이브)에 저장된 문서에서 쓸 수 있습니다 (저장 ▾ → 저장·동기화 설정)', true); return; }
  let d = $('#dlgVer'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgVer'; d.className = 'wide'; d.innerHTML = `<div class="dhead"><h2>버전 기록</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="verBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  d.showModal(); await renderVersions();
}
let verSel = null;
async function renderVersions() {
  const B = $('#verBody'); B.innerHTML = '<p class="hint">불러오는 중…</p>';
  if (!doc.docId) { B.innerHTML = '<p class="hint">아직 남은 버전이 없습니다. 이 문서가 동기화 폴더에 저장되면 15분마다 자동으로 남습니다.</p><button class="btn" id="verNow">지금 상태를 버전으로 남기기</button>'; $('#verNow').onclick = verNow; return; }
  const list = await store.listSnapshots(doc.docId);
  const fmt = t => { const x = new Date(t), p2 = n => String(n).padStart(2, '0'); const today = new Date().toDateString() === x.toDateString(); return `${today ? '오늘' : `${x.getMonth() + 1}월 ${x.getDate()}일`} ${p2(x.getHours())}:${p2(x.getMinutes())}`; };
  B.innerHTML = `<div class="vergrid"><div><div class="row" style="margin-bottom:8px"><span class="hint" style="margin:0;flex:1">${list.length}개 · 15분마다 자동 저장 (최근 40개)</span><button class="btn sm" id="verNow">지금 상태 남기기</button></div>
    <ul class="list verlist">${list.map((x, i) => `<li data-ver="${i}" class="${verSel === x.name ? 'on' : ''}"><b>${fmt(x.time)}</b><span>${esc(x.pc)}${x.memo ? ' · ' + esc(x.memo) : ''}</span></li>`).join('') || '<li><span>아직 남은 버전이 없습니다</span></li>'}</ul></div>
    <div class="verprev"><div id="verPrev" class="hint">왼쪽에서 버전을 고르면 미리 봅니다</div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" id="verCopy" disabled>사본으로 만들기</button><button class="btn primary" id="verRestore" disabled>이 버전으로 되돌리기</button></div></div></div>`;
  $('#verNow').onclick = verNow;
  B.querySelector('.verlist').onclick = async e => {
    const li = e.target.closest('[data-ver]'); if (!li) return; const x = list[Number(li.dataset.ver)]; verSel = x.name; B.querySelectorAll('.verlist li').forEach(l => l.classList.toggle('on', l === li));
    $('#verPrev').innerHTML = '<span class="hint">불러오는 중…</span>'; let j; try { j = await store.readSnapshot(x, doc.docId); } catch (err) { $('#verPrev').textContent = '읽지 못했습니다: ' + err.message; return; }
    const saved = doc; let html = ''; try { doc = Object.assign({}, saved, { w: j.w, h: j.h, assets: j.assets || {}, bleed: 0, cropMarks: false }); const k = Math.min(300 / (j.w * MM), 260 / (j.h * MM)); html = `<div class="verbox" style="width:${j.w * MM * k}px;height:${j.h * MM * k}px"><div style="transform:scale(${k});transform-origin:0 0">${sheetHTML(j.pages[0], 'thumb')}</div></div>`; } finally { doc = saved; }
    $('#verPrev').innerHTML = `${html}<p class="hint">${fmt(x.time)} · ${esc(x.pc)} · ${j.pages.length}쪽 · ${Math.round(j._size / 1024)}KB</p>`;
    $('#verRestore').disabled = false; $('#verCopy').disabled = false;
    $('#verRestore').onclick = async () => {
      if (!window.confirm(`${fmt(x.time)} 버전으로 되돌릴까요?\n지금 상태는 버전 기록에 먼저 남겨 두고, Ctrl+Z로도 되돌릴 수 있습니다.`)) return;
      await verNow('되돌리기 전'); Object.keys(j).forEach(k => { if (!DOC_KEYS_SKIP.has(k) && k !== 'assets' && k !== 'fonts') doc[k] = j[k]; }); doc.assets = Object.assign({}, doc.assets, j.assets || {}); (j.fonts || []).forEach(f => { if (!doc.fonts.some(x => x.family === f.family)) doc.fonts.push(f); }); cur = Math.min(cur, doc.pages.length - 1); sel = []; cellSel = null; commit(); zoom = 0; renderAll(); fitCanvas(); $('#dlgVer').close(); toast(`${fmt(x.time)} 버전으로 되돌렸습니다`);
    };
    $('#verCopy').onclick = async () => { const c = Object.assign({}, j, { name: `${doc.name || '디자인'} (${fmt(x.time).replace(':', '시 ')}분 버전)` }); delete c._size; const h = await store.copyIntoFolder(c); toast(`"${h.name.replace(/\.design\.json$/i, '')}"을(를) 만들었습니다 (열기 목록에 있습니다)`); };
  };
}
async function verNow(memo) {
  if (typeof memo !== 'string') memo = '직접 남김';
  if (store.state.dirty) { clearTimeout(fileTimer); await saveFileNow(); }
  if (!doc.docId) doc.docId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  try { await store.snapshot(doc.docId, JSON.stringify(Object.assign({}, doc, { savedBy: store.pcName(), savedAt: Date.now() })), memo); if ($('#dlgVer') && $('#dlgVer').open && memo === '직접 남김') { toast('지금 상태를 버전으로 남겼습니다'); renderVersions(); } } catch (e) { toast('버전을 남기지 못했습니다: ' + e.message, true); }
}

/* ---- 대량 만들기 (Canva 'Bulk create'): 명단 표를 붙여 넣으면 지금 쪽을 사람 수만큼 복제하며 {열 이름}을 채움 ----
   글 상자 안에 {이름}·{띠}처럼 첫 줄의 열 이름을 중괄호로 넣어 두거나, 열마다 바꿀 글 상자를 골라 연결 */
let bulkState = { raw: '', map: {} };
function parseTable(raw) {
  const lines = raw.replace(/\r/g, '').split('\n').filter(l => l.trim()); if (!lines.length) return { head: [], rows: [] };
  const tab = lines[0].includes('\t'); const split = l => { if (tab) return l.split('\t'); const out = []; let cur_ = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur_); cur_ = ''; } else cur_ += ch; } out.push(cur_); return out; };
  const head = split(lines[0]).map(h => h.trim()); return { head, rows: lines.slice(1).map(l => { const c = split(l); return Object.fromEntries(head.map((h, i) => [h, (c[i] || '').trim()])); }) };
}
function openBulk() {
  endEdit(); let d = $('#dlgBulk');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlgBulk'; d.className = 'wide'; d.innerHTML = `<div class="dhead"><h2>대량 만들기</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="bulkBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); }
  d.showModal(); renderBulk();
}
function renderBulk() {
  const S = bulkState, T = parseTable(S.raw), texts = page().els.filter(e => e.type === 'text' && !e.locked);
  const holes = new Set(); texts.forEach(e => (e.text.match(/\{([^{}\n]+)\}/g) || []).forEach(m => holes.add(m.slice(1, -1).trim())));
  const B = $('#bulkBody');
  if (!$('#bulkRaw')) {
    B.innerHTML = `<p class="hint">1) 지금 쪽(${cur + 1}쪽)의 글 상자에 <b>{이름}</b>·<b>{띠}</b>·<b>{날짜}</b>처럼 바꿀 자리를 적어 두세요. 2) 엑셀·구글 시트에서 <b>첫 줄(열 이름)을 포함해</b> 명단을 복사해 아래에 붙여 넣으세요. 3) 사람 수만큼 쪽이 문서 끝에 만들어집니다 (최대 300명).</p>
    <textarea id="bulkRaw" rows="7" placeholder="이름&#9;띠&#9;날짜&#10;김태권&#9;노란띠&#9;2027. 3. 15.&#10;이도장&#9;초록띠&#9;2027. 3. 15." style="width:100%;font:13px/1.5 ui-monospace,Menlo,monospace"></textarea><div id="bulkInfo"></div>`;
    $('#bulkRaw').value = S.raw; $('#bulkRaw').addEventListener('input', () => { S.raw = $('#bulkRaw').value; renderBulk(); });
  }
  const unmatched = T.head.filter(h => h && !holes.has(h));
  $('#bulkInfo').innerHTML = !T.head.length ? `<p class="hint" style="margin-top:8px">${holes.size ? `이 쪽에서 찾은 자리: ${[...holes].map(h => `<b>{${esc(h)}}</b>`).join(' ')}` : '이 쪽에는 아직 {자리}가 없습니다. 글 상자를 두 번 눌러 {이름}처럼 적어 넣으세요.'}</p>` : `
    <p class="hint" style="margin:8px 0">${T.rows.length}명 · 열: ${T.head.map(h => holes.has(h) ? `<b class="ok">{${esc(h)}} ✓</b>` : `<span>${esc(h)}</span>`).join(' · ')}</p>
    ${unmatched.length ? `<div class="grid2">${unmatched.map(h => `<label class="f"><span>"${esc(h)}" 열을 넣을 글 상자</span><select data-bmap="${esc(h)}"><option value="">넣지 않음</option>${texts.map(e => `<option value="${e.id}" ${S.map[h] === e.id ? 'selected' : ''}>${esc(elName(e).slice(0, 30))}</option>`).join('')}</select></label>`).join('')}</div><p class="hint">연결한 글 상자는 글자 전체가 그 열 값으로 바뀝니다.</p>` : ''}
    ${T.rows.length ? `<table class="btable"><tr>${T.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${T.rows.slice(0, 4).map(r => `<tr>${T.head.map(h => `<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}${T.rows.length > 4 ? `<tr><td colspan="${T.head.length}">… ${T.rows.length - 4}명 더</td></tr>` : ''}</table>` : ''}
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="bulkGo" ${T.rows.length && T.rows.length <= 300 ? '' : 'disabled'}>${Math.min(T.rows.length, 300)}쪽 만들기</button></div>`;
  B.querySelectorAll('[data-bmap]').forEach(sl => sl.onchange = () => { S.map[sl.dataset.bmap] = sl.value; });
  const go = $('#bulkGo'); if (go) go.onclick = () => {
    const src_ = page(), made = [];
    T.rows.slice(0, 300).forEach(r => {
      const p = clone(src_); p.els.forEach(e => { e.id = uid(); delete e.gen; }); const gm = {}; p.els.forEach(e => { if (e.group) { gm[e.group] = gm[e.group] || uid(); e.group = gm[e.group]; } });
      const fill = t => t.replace(/\{([^{}\n]+)\}/g, (m, k) => (k.trim() in r ? r[k.trim()] : m));
      p.els.forEach((e, i) => { if (e.type !== 'text') return; const srcEl = src_.els[i]; const mapped = Object.keys(S.map).find(h => S.map[h] === srcEl.id); const nv = mapped ? r[mapped] : fill(e.text); if (nv === e.text) return;
        if (e.html && e.htmlFor === e.text && !mapped) { const dv = document.createElement('div'); dv.innerHTML = e.html; const tw = document.createTreeWalker(dv, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) n.nodeValue = fill(n.nodeValue); if (domText(dv) === nv) { e.html = richHTML(dv) || undefined; e.htmlFor = nv; if (!e.html) { delete e.html; delete e.htmlFor; } } else { delete e.html; delete e.htmlFor; } } else { delete e.html; delete e.htmlFor; }
        e.text = nv; });
      p.name = (T.head[0] && r[T.head[0]]) || p.name; made.push(p);
    });
    doc.pages.push(...made); commit(); const first = doc.pages.length - made.length; $('#dlgBulk').close(); goto(first); toastUndo(`${made.length}쪽을 만들었습니다 (${first + 1}~${doc.pages.length}쪽)`);
  };
}

let pasteShift = false, pasteFallback = null;
// Ctrl+C: 시스템 클립보드에도 표식을 넣어 둠 (권한이 없어도 동작)
document.addEventListener('copy', e => { if (editing || (e.target.matches && e.target.matches('input,textarea,[contenteditable="true"]')) || !clip || Date.now() - clip.t > 1500) return; e.clipboardData.setData('text/plain', clip.mark); e.preventDefault(); });
document.addEventListener('cut', e => { if (editing || (e.target.matches && e.target.matches('input,textarea,[contenteditable="true"]')) || !clip || Date.now() - clip.t > 1500) return; e.clipboardData.setData('text/plain', clip.mark); e.preventDefault(); });
/* ---- 바깥에서 복사한 것 붙여넣기: 화면 캡처·사진 파일은 그림으로, 글자는 새 글 상자로 ---- */
document.addEventListener('paste', async e => {
  if (editing || $('#cellEd') || (e.target.matches && e.target.matches('input,textarea,select,[contenteditable="true"]')) || document.querySelector('dialog[open]')) return;
  const cd = e.clipboardData; if (!cd) return;
  const files = [...cd.files].filter(f => /^image\//.test(f.type));
  if (files.length) { e.preventDefault(); for (const f of files) addImage(addAsset(await fileToDataURL(f))); toast('붙여 넣은 그림을 넣었습니다'); return; }
  const t = (cd.getData('text/plain') || '').trim();
  clearTimeout(pasteFallback);
  if (clip && clip.els && (t === clip.mark || !t || (clip.ctx && !files.length))) { e.preventDefault(); doPaste(pasteShift); pasteShift = false; return; } // 앱 안에서 복사한 요소
  if (t.startsWith('nc-clip:')) { e.preventDefault(); return; } // 다른 창·새로 고침 전의 표식
  if (!t) return; e.preventDefault();
  if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?\S*)?$/i.test(t)) { try { const bl = await (await fetch(t)).blob(); addImage(addAsset(await fileToDataURL(bl))); } catch (err) { addImage(t); toast('그림을 가져오지 못해 주소로 넣었습니다 (내려받기에서 빠질 수 있음)', true); } return; }
  addText('b', { text: t.slice(0, 2000), noEdit: true });
});

/* ---- 눈금자·사용자 안내선 (Shift+R): 눈금자에서 끌어 안내선을 만들고, 안내선을 끌어 옮기거나 눈금자로 되돌려 지움 ----
   안내선은 문서(doc.guides, mm)에 저장되어 실행 취소·동기화되고, 자석 정렬 대상이 됨 */
const RULER = 18;
const showRulers = () => { try { return localStorage.getItem('naracal-rulers') === '1'; } catch (e) { return false; } };
function toggleRulers() { try { localStorage.setItem('naracal-rulers', showRulers() ? '0' : '1'); } catch (e) {} drawRulers(); fitCanvas(); toast(showRulers() ? '눈금자를 켰습니다 — 눈금자에서 끌어 안내선을 만드세요 (Shift+R로 끄기)' : '눈금자를 껐습니다'); }
function ensureRulers() {
  if ($('#rulerH')) return;
  $('#stage').insertAdjacentHTML('beforeend', `<canvas id="rulerH" class="ruler rh" title="아래로 끌어 가로 안내선 만들기"></canvas><canvas id="rulerV" class="ruler rv" title="오른쪽으로 끌어 세로 안내선 만들기"></canvas><button id="rulerC" class="ruler rc" title="눈금자 끄기 (Shift+R)">mm</button>`);
  $('#rulerH').addEventListener('pointerdown', e => startGuide(e, 'y', null));
  $('#rulerV').addEventListener('pointerdown', e => startGuide(e, 'x', null));
  $('#rulerC').onclick = toggleRulers;
}
function drawRulers() {
  ensureRulers(); const on = showRulers(); ['#rulerH', '#rulerV', '#rulerC'].forEach(s => { $(s).hidden = !on; }); $('#stage').classList.toggle('rulers', on); if (!on) return;
  const st = $('#stage').getBoundingClientRect(), cv = $('#canvas').getBoundingClientRect(), pxmm = kScale() * MM, dpr = devicePixelRatio || 1;
  const major = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(s => s * pxmm >= 64) || 5000, minor = major / (String(major)[0] === '2' ? 4 : 5);
  const els = selEls(), sb = els.length ? [Math.min(...els.map(e => e.x)), Math.max(...els.map(e => e.x + e.w)), Math.min(...els.map(e => e.y)), Math.max(...els.map(e => e.y + e.h))] : null;
  [['#rulerH', st.width, cv.left - st.left, doc.w, sb && [sb[0], sb[1]]], ['#rulerV', st.height - RULER, cv.top - st.top - RULER, doc.h, sb && [sb[2], sb[3]]]].forEach(([id, len, o, size, band], vi) => {
    const c = $(id), W = vi ? RULER : len, H = vi ? len : RULER; c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = '#f4f5f7'; g.fillRect(0, 0, W, H);
    const P = mm => o + mm * pxmm; // 화면 위치(px)
    g.fillStyle = '#ffffff'; vi ? g.fillRect(0, P(0), RULER, size * pxmm) : g.fillRect(P(0), 0, size * pxmm, RULER); // 쪽 영역은 흰색
    if (band) { g.fillStyle = 'rgba(47,111,228,.18)'; vi ? g.fillRect(0, P(band[0]), RULER, (band[1] - band[0]) * pxmm) : g.fillRect(P(band[0]), 0, (band[1] - band[0]) * pxmm, RULER); }
    g.strokeStyle = '#9aa1ad'; g.fillStyle = '#5b6270'; g.font = '9px system-ui, sans-serif'; g.lineWidth = 1; g.beginPath();
    const a = Math.floor(-o / pxmm / minor) * minor, b = (len - o) / pxmm;
    for (let mm = a; mm <= b; mm = Math.round((mm + minor) * 1000) / 1000) {
      const p = Math.round(P(mm)) + 0.5, isMaj = Math.abs(mm / major - Math.round(mm / major)) < 1e-6, tl = isMaj ? RULER : RULER * 0.35;
      if (vi) { g.moveTo(RULER - tl, p); g.lineTo(RULER, p); } else { g.moveTo(p, RULER - tl); g.lineTo(p, RULER); }
      if (isMaj) { const t = String(Math.round(mm)); if (vi) { g.save(); g.translate(9, p + 2); g.rotate(-Math.PI / 2); g.fillText(t, 0, 0); g.restore(); } else g.fillText(t, p + 2, 9); }
    }
    g.stroke(); g.fillStyle = '#d6d9e0'; vi ? g.fillRect(RULER - 1, 0, 1, H) : g.fillRect(0, RULER - 1, W, 1);
  });
}
// 안내선 끌기: axis 'x'(세로선) / 'y'(가로선), idx가 null이면 새로 만듦. 눈금자 위에 놓으면 지움
function startGuide(e, axis, idx) {
  e.preventDefault(); e.stopPropagation(); flushNudge();
  doc.guides = doc.guides || { x: [], y: [] }; const list = doc.guides[axis]; if (idx == null) { list.push(axis === 'x' ? toMM(e).x : toMM(e).y); idx = list.length - 1; }
  const st = $('#stage').getBoundingClientRect();
  const mv = ev => { const p = toMM(ev); let v = axis === 'x' ? p.x : p.y; const T = 6 / (kScale() * MM); const cand = axis === 'x' ? [0, doc.w / 2, doc.w] : [0, doc.h / 2, doc.h]; page().els.forEach(el => { if (el.hidden) return; if (axis === 'x') cand.push(el.x, el.x + el.w / 2, el.x + el.w); else cand.push(el.y, el.y + el.h / 2, el.y + el.h); }); const near = cand.find(c => Math.abs(c - v) < T); if (near != null && !ev.altKey) v = near; list[idx] = Math.round(v * 10) / 10; renderOverlay(); showGuideTip(ev, `${axis === 'x' ? 'X' : 'Y'} ${list[idx]}mm`); };
  const up = ev => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); hideGuideTip(); const over = axis === 'x' ? ev.clientX < st.left + RULER : ev.clientY < st.top + RULER; if (over || !showRulers() && false) { list.splice(idx, 1); toast('안내선을 지웠습니다'); } commit(); renderOverlay(); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
function showGuideTip(ev, t) { let d = $('#guideTip'); if (!d) { d = document.createElement('div'); d.id = 'guideTip'; document.body.appendChild(d); } d.textContent = t; d.style.left = (ev.clientX + 12) + 'px'; d.style.top = (ev.clientY + 12) + 'px'; d.hidden = false; }
function hideGuideTip() { const d = $('#guideTip'); if (d) d.hidden = true; }
function userGuidesHTML() { const g = doc.guides; if (!g || !showGuides()) return ''; return (g.x || []).map((v, i) => `<div class="uguide ugv" data-ug="x:${i}" style="left:${v}mm;top:-60mm;height:${doc.h + 120}mm" title="끌어서 옮기기 · 눈금자로 끌어 지우기"></div>`).join('') + (g.y || []).map((v, i) => `<div class="uguide ugh" data-ug="y:${i}" style="top:${v}mm;left:-60mm;width:${doc.w + 120}mm" title="끌어서 옮기기 · 눈금자로 끌어 지우기"></div>`).join(''); }
wrap.addEventListener('pointerdown', e => { const ub = e.target.closest && e.target.closest('.lockbadge'); if (ub) { e.preventDefault(); e.stopPropagation(); setLock([ub.dataset.unlock], false); } }, true);
wrap.addEventListener('pointerdown', e => { const u = e.target.closest && e.target.closest('.uguide'); if (!u || e.button !== 0) return; const [ax, i] = u.dataset.ug.split(':'); startGuide(e, ax, Number(i)); }, true);
$('#scroller').addEventListener('scroll', () => { if (showRulers()) drawRulers(); }, { passive: true });
window.addEventListener('resize', () => { if (showRulers()) drawRulers(); });
document.addEventListener('keydown', e => { if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyR' && !editing && !$('#cellEd') && !cellSel && !(e.target.matches && e.target.matches('input,textarea,select,[contenteditable="true"]')) && !document.querySelector('dialog[open]')) { e.preventDefault(); toggleRulers(); } });

/* ---- 쪽 모아 보기 (Canva 'Grid view'): 모든 쪽을 한눈에, 끌어서 순서 바꾸기, 여러 쪽 골라 복제·삭제, 두 번 눌러 그 쪽으로 ---- */
let gridSel = new Set(), gridAnchor = 0;
function dupPage(p) { const n = clone(p); n.id = uid(); const gmap = {}; n.els.forEach(e => { e.id = uid(); delete e.gen; if (e.group) { gmap[e.group] = gmap[e.group] || uid(); e.group = gmap[e.group]; } }); return n; }
function openPageGrid() {
  endEdit(); let d = $('#dlgGrid');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlgGrid'; d.className = 'wide'; d.innerHTML = `<div class="dhead"><h2>쪽 모아 보기</h2><div class="row" style="gap:6px"><span class="hint" id="gridInfo" style="margin:0"></span><button class="btn sm" data-gx="dup">복제</button><button class="btn sm danger" data-gx="del">삭제</button><button class="btn sm primary" data-gx="go">이 쪽 편집</button><button class="btn sm" data-close>닫기</button></div></div><div class="dbody"><p class="hint" style="margin-top:0">누르면 고르기 · Ctrl/⌘·Shift로 여러 쪽 · 끌어서 순서 바꾸기 · 두 번 누르면 그 쪽으로 · Delete로 삭제</p><div id="gridBody" class="pgrid"></div></div>`; document.body.appendChild(d);
    d.querySelector('[data-close]').onclick = () => d.close();
    d.addEventListener('click', e => { const b = e.target.closest('[data-gx]'); if (b) gridCmd(b.dataset.gx); });
    d.addEventListener('keydown', e => { if ((e.key === 'Delete' || e.key === 'Backspace') && !(e.target.matches && e.target.matches('input,textarea'))) { e.preventDefault(); gridCmd('del'); } });
  }
  gridSel = new Set([cur]); gridAnchor = cur; renderPageGrid(); d.showModal();
  requestAnimationFrame(() => { const t = $(`#gridBody [data-gi="${cur}"]`); if (t) t.scrollIntoView({ block: 'center' }); });
}
function renderPageGrid() {
  const B = $('#gridBody'), tw = 170, k = tw / (doc.w * MM), th = doc.h * MM * k;
  B.innerHTML = doc.pages.map((pg, i) => `<div class="gtile ${gridSel.has(i) ? 'on' : ''} ${i === cur ? 'cur' : ''}" data-gi="${i}" draggable="true"><div class="gbox" style="width:${tw}px;height:${th}px">${sheetHTML(pg, 'thumb')}</div><span><b>${i + 1}</b> ${esc(pg.label || '')}</span></div>`).join('');
  B.querySelectorAll('.gbox .sheet').forEach(s => { s.style.transform = `scale(${k})`; });
  $('#gridInfo').textContent = `${doc.pages.length}쪽 중 ${gridSel.size}쪽 고름`;
  B.onclick = e => { const t = e.target.closest('[data-gi]'); if (!t) return; const i = Number(t.dataset.gi);
    if (e.shiftKey) { gridSel = new Set(); for (let j = Math.min(gridAnchor, i); j <= Math.max(gridAnchor, i); j++) gridSel.add(j); }
    else if (e.ctrlKey || e.metaKey) { gridSel.has(i) ? gridSel.delete(i) : gridSel.add(i); gridAnchor = i; }
    else { gridSel = new Set([i]); gridAnchor = i; }
    renderPageGrid(); };
  B.ondblclick = e => { const t = e.target.closest('[data-gi]'); if (!t) return; $('#dlgGrid').close(); goto(Number(t.dataset.gi)); };
  B.ondragstart = e => { const t = e.target.closest('[data-gi]'); if (!t) return; const i = Number(t.dataset.gi); if (!gridSel.has(i)) { gridSel = new Set([i]); } e.dataTransfer.setData('text/x-nc-grid', [...gridSel].join(',')); e.dataTransfer.effectAllowed = 'move'; };
  B.ondragover = e => { const t = e.target.closest('[data-gi]'); if (!t || !e.dataTransfer.types.includes('text/x-nc-grid')) return; e.preventDefault(); B.querySelectorAll('.gtile').forEach(x => x.classList.remove('dropl', 'dropr')); const r = t.getBoundingClientRect(); t.classList.add(e.clientX < r.left + r.width / 2 ? 'dropl' : 'dropr'); };
  B.ondrop = e => { const t = e.target.closest('[data-gi]'); if (!t || !e.dataTransfer.types.includes('text/x-nc-grid')) return; e.preventDefault();
    const idx = e.dataTransfer.getData('text/x-nc-grid').split(',').map(Number).sort((a, b) => a - b); const r = t.getBoundingClientRect(); let to = Number(t.dataset.gi) + (e.clientX < r.left + r.width / 2 ? 0 : 1);
    const moving = idx.map(i => doc.pages[i]), curPg = page(); to -= idx.filter(i => i < to).length; const rest = doc.pages.filter((p, i) => !idx.includes(i)); rest.splice(to, 0, ...moving); doc.pages = rest;
    gridSel = new Set(moving.map(p => doc.pages.indexOf(p))); cur = Math.max(0, doc.pages.indexOf(curPg)); sel = []; cellSel = null; commit(); renderAll(); renderPageGrid(); toast(`${moving.length}쪽을 옮겼습니다`); };
}
function gridCmd(k) {
  const idx = [...gridSel].sort((a, b) => a - b); if (!idx.length) return;
  if (k === 'go') { $('#dlgGrid').close(); goto(idx[0]); return; }
  if (k === 'dup') { const copies = idx.map(i => dupPage(doc.pages[i])); const at = idx[idx.length - 1] + 1; doc.pages.splice(at, 0, ...copies); gridSel = new Set(copies.map((_, j) => at + j)); commit(); renderAll(); renderPageGrid(); toast(`${copies.length}쪽을 복제했습니다`); return; }
  if (k === 'del') { if (idx.length >= doc.pages.length) { toast('모든 쪽을 지울 수는 없습니다', true); return; } if (!window.confirm(`${idx.length}쪽을 지울까요? (Ctrl+Z로 되돌릴 수 있습니다)`)) return; const curPg = page(); doc.pages = doc.pages.filter((p, i) => !gridSel.has(i)); cur = Math.max(0, Math.min(doc.pages.indexOf(curPg) >= 0 ? doc.pages.indexOf(curPg) : idx[0], doc.pages.length - 1)); sel = []; cellSel = null; gridSel = new Set([Math.min(idx[0], doc.pages.length - 1)]); commit(); renderAll(); renderPageGrid(); toastUndo(`${idx.length}쪽을 지웠습니다`, () => { if ($('#dlgGrid') && $('#dlgGrid').open) renderPageGrid(); }); }
}

/* ---- 라차(도장 캐릭터) 동작 요소 한 번에 만들기: 지금 있는 라차 그림을 참고 그림으로 같은 모습의 새 동작을 그려 '마스코트 라차'에 보관 ---- */
const RACHA = [
  ['tkd', '태권도 동작', [
    ['front-kick', '앞차기', 'performing a high front snap kick (ap chagi), one leg raised straight forward, arms in guard'],
    ['roundhouse', '돌려차기', 'performing a roundhouse kick (dollyeo chagi) at head height, hips turned, kicking leg swinging horizontally, motion lines'],
    ['side-kick', '옆차기', 'performing a powerful side kick (yeop chagi), body sideways, kicking leg fully extended to the side'],
    ['back-kick', '뒤차기', 'performing a back kick (dwi chagi), looking over the shoulder, leg thrust straight backward'],
    ['axe-kick', '내려차기', 'performing an axe kick (naeryeo chagi), leg raised straight up high above the head, about to strike down'],
    ['jump-kick', '뛰어 앞차기', 'performing a jumping front kick in mid-air, both feet off the ground, dynamic motion lines'],
    ['punch', '몸통 지르기', 'doing a middle punch (momtong jireugi) in a long front stance, fist extended forward, shouting kihap'],
    ['low-block', '아래막기', 'doing a low block (arae makgi) in a front stance, serious focused face'],
    ['high-block', '얼굴막기', 'doing a high block (eolgul makgi), forearm raised above the head'],
    ['knife-hand', '손날치기', 'doing a knife-hand strike (sonnal chigi) to the side in a back stance'],
    ['breaking', '격파', 'breaking a wooden board held in front with a punch, board splitting with small wood splinters'],
    ['sparring', '겨루기 자세', 'in a sparring fighting stance, light on the feet, both fists up, confident smile'],
    ['ready', '품새 준비', 'standing in poomsae ready stance (junbi seogi), fists in front of the belt, calm and serious'],
    ['bow', '인사', 'bowing politely at 30 degrees in taekwondo greeting (gyeongnye), hands at the sides'],
    ['kihap', '기합', 'shouting a loud kihap with fists clenched at the waist, energy burst effect lines'],
    ['flag-salute', '국기에 대한 경례', 'standing straight with the right hand on the chest, saluting respectfully'],
  ]],
  ['guide', '안내·상황', [
    ['guide', '손으로 안내하기', 'smiling and presenting to the right side with an open hand palm up, like a guide introducing information'],
    ['point-up', '위 가리키기', 'pointing up with one hand, explaining something with a cheerful face'],
    ['sign-board', '빈 공지판 들기', 'holding a large blank white sign board with both hands in front of the body, the board is empty with no text'],
    ['megaphone', '확성기 공지', 'making an announcement through a red megaphone, excited'],
    ['wave', '손 흔들기', 'waving hello cheerfully with one hand'],
    ['thumbs-up', '엄지척', 'giving a big thumbs up with a wink'],
    ['clap', '박수 응원', 'clapping hands and cheering happily'],
    ['celebrate', '축하', 'jumping with both arms up celebrating, colorful confetti around'],
    ['trophy', '트로피', 'holding a gold trophy up proudly'],
    ['medal', '메달', 'proudly showing a gold medal hanging on the chest'],
    ['certificate', '상장 들기', 'holding up a framed certificate with both hands, proud smile'],
    ['heart', '하트', 'making a big heart shape above the head with both arms'],
    ['thinking', '생각하기', 'thinking with one hand on the chin, a question mark above the head'],
    ['ok', 'OK', 'making an OK sign with one hand and smiling'],
    ['calendar', '달력 가리키기', 'pointing at a big wall calendar page with one hand (calendar has no readable text)'],
    ['gift', '선물', 'holding a wrapped gift box with a ribbon'],
    ['reading', '책 읽기', 'sitting and reading a book happily'],
    ['water', '물 마시기', 'drinking water from a bottle after training, small sweat drops'],
    ['holiday', '쉬는 날', 'relaxed holiday mood, waving goodbye with a small travel bag'],
    ['sebae', '한복 세배', 'wearing a colorful Korean hanbok instead of the dobok, kneeling and bowing deeply for the New Year (sebae)'],
  ]],
];
const RACHA_STYLE = 'Draw the exact same penguin mascot character as in the reference images: round gray head with a white face patch, big round eyes, orange beak and orange feet, gray flipper-hands, wearing a white taekwondo dobok with a black belt tied at the waist, a bronze medal on a red-white-blue ribbon, and a small Korean flag patch on the left shoulder. Keep the same hand-drawn cartoon style: clean black outlines, flat colors, light gray shading. Full body, centered, generous margin around the character, plain pure white background, no text, no letters, no frame, no ground line, no extra characters.';
let rachaBusy = false, rachaStop = false;
const rachaDone = id => NC.lib.mine().some(x => x.tag === 'racha:' + id);
function openRachaMaker() {
  let d = $('#dlgRacha');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlgRacha'; d.className = 'wide'; d.innerHTML = `<div class="dhead"><h2>라차 동작 요소 만들기 <small>도장 캐릭터를 같은 모습으로 새 동작으로</small></h2><button class="btn sm" data-close>닫기</button></div><div class="dbody" id="rachaBody"></div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => { rachaStop = true; d.close(); }; }
  renderRacha(); d.showModal();
}
function renderRacha() {
  const B = $('#rachaBody'); const keyOK = chatMode() || !!AI.cfg.geminiKey, libOK = NC.lib.ready || !!store.state.dir;
  B.innerHTML = `${keyOK ? '' : `<div class="lockbar">Gemini API 키가 필요합니다 — AI 도우미 → API 설정에 넣어 주세요<button class="btn sm" id="rkKey">키 넣기</button></div>`}
  ${libOK ? '' : '<div class="lockbar">동기화 폴더가 연결되어 있지 않아 만든 그림은 이 창에서만 쓸 수 있습니다 (저장 ▾ → 동기화 폴더 연결)</div>'}
  <p class="hint" style="margin-top:0">지금 있는 라차 그림 2장(준비 자세·앞차기)을 참고 그림으로 보내 같은 캐릭터로 그립니다. 흰 배경은 자동으로 지우고, 요소 → 나라차 → <b>마스코트 라차</b>에 보관되어 모든 PC에서 씁니다. ${chatMode() ? `<b>${CHAT_SITES[AI.cfg.chatImage][0]} 채팅(내 요금제)</b>에 지시문을 붙여 넣어 한 장씩 받습니다.` : '한 장에 수십 초, Gemini 요금이 장마다 듭니다.'}</p>
  ${RACHA.map(([gid, gname, list]) => `<h3 class="phead"><span>${gname} <small>${list.length}가지</small></span><span><button class="lnk" data-rall="${gid}">모두 고르기</button> · <button class="lnk" data-rnone="${gid}">모두 빼기</button></span></h3><div class="rgrid">${list.map(([id, name]) => `<label class="rchk ${rachaDone(id) ? 'done' : ''}"><input type="checkbox" data-rid="${id}" ${rachaDone(id) ? '' : 'checked'}> ${name}${rachaDone(id) ? ' <small>✓ 있음</small>' : ''}</label>`).join('')}</div>`).join('')}
  <div class="row" style="margin-top:12px;justify-content:flex-end"><span class="hint" id="rStat" style="margin:0;flex:1"></span><button class="btn" id="rStop" hidden>멈추기</button><button class="btn primary" id="rGo" ${keyOK ? '' : 'disabled'}>고른 동작 만들기</button></div>
  <div id="rChat"></div><div class="rres" id="rRes"></div>`;
  const cnt = () => { const n = B.querySelectorAll('[data-rid]:checked').length; $('#rGo').textContent = chatMode() ? `고른 ${n}가지 — 채팅으로 만들기` : `고른 ${n}가지 만들기`; return n; }; cnt();
  B.onchange = cnt;
  B.onclick = async e => {
    const a = e.target.closest('[data-rall],[data-rnone]'); if (a) { const g = a.dataset.rall || a.dataset.rnone, on = !!a.dataset.rall; RACHA.find(x => x[0] === g)[2].forEach(([id]) => { const c = B.querySelector(`[data-rid="${id}"]`); if (c) c.checked = on; }); cnt(); return; }
    if (e.target.id === 'rkKey') { $('#dlgRacha').close(); openAI('keys'); return; }
    if (e.target.id === 'rStop') { rachaStop = true; e.target.disabled = true; return; }
    const ins = e.target.closest('[data-rins]'); if (ins) { addImage(addAsset(ins.dataset.rins.startsWith('data:') ? ins.dataset.rins : ins.querySelector('img').src)); return; }
    if (e.target.id === 'rGo') { if (chatMode()) runRachaChat(); else runRacha(); }
  };
}
// 채팅 방식: 참고 그림 한 장(라차 두 자세) → 동작마다 지시문 복사 → 받은 그림 붙여 넣기 → 다음 동작
function runRachaChat() {
  const B = $('#rachaBody'), ids = [...B.querySelectorAll('[data-rid]:checked')].map(c => c.dataset.rid); if (!ids.length) return;
  const all = RACHA.flatMap(g => g[2]), refs = [ASSETS['mascot-03'], ASSETS['mascot-01']].filter(Boolean), box = $('#rChat'), res = $('#rRes'), site = CHAT_SITES[AI.cfg.chatImage][0];
  let i = 0, sent = 0, refOk = false;
  const cur = () => all.find(x => x[0] === ids[i]);
  const draw = () => {
    if (i >= ids.length) { box.innerHTML = `<p class="hint">고른 ${ids.length}가지를 모두 받았습니다. 아래 그림을 누르면 페이지에 넣습니다.</p>`; $('#rStat').textContent = ''; return; }
    const [, name] = cur();
    box.innerHTML = `<div class="chatflow"><div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn sm" data-rc="ref">① 라차 참고 그림 복사·${site} 열기</button><button class="btn sm ai" data-rc="cp">② ${i + 1}/${ids.length} '${esc(name)}' 지시문 복사</button><button class="btn sm" data-rc="skip">이 동작 건너뛰기</button></div>
      <div class="chatzone" id="rZone"><b>③ 받은 '${esc(name)}' 그림을 여기에 넣기</b><span>채팅의 그림을 오른쪽 클릭 → 이미지 복사 → 여기서 ⌘V·Ctrl+V · 내려받은 파일을 끌어다 놓기 · 눌러서 파일 고르기</span></div></div>`;
    $('#rStat').textContent = `${i + 1}/${ids.length} · ${name}`;
    chatImgZone($('#rZone'), got);
  };
  box.onclick = async e => {
    const k = e.target.dataset && e.target.dataset.rc; if (!k) return;
    if (k === 'ref') { sent = 0; refOk = true; try { await copyImg(await refSheet(refs)); openChatSite(AI.cfg.chatImage); toast('라차 참고 그림을 복사했습니다 — 열린 채팅 칸에 ⌘V·Ctrl+V로 붙여 넣은 뒤 ② 지시문 복사를 누르세요'); } catch (err) { toast('참고 그림을 복사하지 못했습니다: ' + err.message, true); } }
    if (k === 'cp' && !refOk) { toast('먼저 ① 라차 참고 그림 복사·채팅 열기를 눌러 채팅에 참고 그림을 붙여 넣어 주세요', true); return; }
    if (k === 'cp') { const [, , pose] = cur(); await sendToChat(AI.chat.image(`The penguin mascot is ${pose}. ${RACHA_STYLE}`, { aspect: '1:1', refs: sent ? 0 : 1, next: !!sent }), 'image', { open: false, note: '그림이 나오면 오른쪽 클릭 → 이미지 복사 후 ③ 칸에 붙여 넣으세요' }); sent++; }
    if (k === 'skip') { i++; draw(); }
  };
  const got = async s => {
    const [id, name, pose] = cur(); try { s = await NC.imgedit.removeColorFromSrc(s, '#ffffff'); } catch (err) {}
    const meta = { name: `라차 · ${name}`, kw: `라차 마스코트 펭귄 캐릭터 ${name} ${id}`, prompt: pose, style: 'racha', cat: 'mascot', tag: 'racha:' + id };
    try { if (NC.lib.ready || store.state.dir) await NC.lib.saveMine(s, meta); } catch (err) { toast('보관하지 못했습니다: ' + err.message, true); }
    res.insertAdjacentHTML('beforeend', `<button class="rcard" data-rins="" title="눌러서 페이지에 넣기"><img src="${s}" alt=""><span>${esc(name)}</span></button>`);
    const lbl = B.querySelector(`[data-rid="${id}"]`); if (lbl) { lbl.checked = false; lbl.closest('.rchk').classList.add('done'); }
    toast(`'${name}' 그림을 받았습니다`); i++; draw(); if (sideTab === 'elems') renderSide();
  };
  draw();
}
async function runRacha() {
  if (rachaBusy) return; const B = $('#rachaBody'); const ids = [...B.querySelectorAll('[data-rid]:checked')].map(c => c.dataset.rid); if (!ids.length) return;
  const all = RACHA.flatMap(g => g[2]); rachaBusy = true; rachaStop = false; $('#rGo').disabled = true; $('#rStop').hidden = false; $('#rStop').disabled = false;
  const refs = [ASSETS['mascot-03'], ASSETS['mascot-01']].filter(Boolean); const res = $('#rRes'); let ok = 0, fail = [];
  for (let i = 0; i < ids.length; i++) {
    if (rachaStop) break;
    const [id, name, pose] = all.find(x => x[0] === ids[i]);
    $('#rStat').innerHTML = `<span class="spin"></span>${i + 1}/${ids.length} · ${name} 그리는 중…`;
    try {
      const imgs = await AI.geminiImage({ prompt: `The penguin mascot is ${pose}. ${RACHA_STYLE}`, refImage: refs, aspect: '1:1', size: '1K' });
      let s = imgs[0]; try { s = await NC.imgedit.removeColorFromSrc(s, '#ffffff'); } catch (err) {}
      const meta = { name: `라차 · ${name}`, kw: `라차 마스코트 펭귄 캐릭터 ${name} ${id}`, prompt: pose, style: 'racha', cat: 'mascot', tag: 'racha:' + id };
      try { if (NC.lib.ready || store.state.dir) await NC.lib.saveMine(s, meta); } catch (err) { toast('보관하지 못했습니다: ' + err.message, true); }
      res.insertAdjacentHTML('beforeend', `<button class="rcard" data-rins="" title="눌러서 페이지에 넣기"><img src="${s}" alt=""><span>${esc(name)}</span></button>`); ok++;
      const lbl = B.querySelector(`[data-rid="${id}"]`); if (lbl) { lbl.checked = false; lbl.closest('.rchk').classList.add('done'); }
    } catch (err) { fail.push(name); res.insertAdjacentHTML('beforeend', `<div class="rcard fail"><span>${esc(name)}</span><small>${esc(err.message).slice(0, 80)}</small></div>`); if (/키|key|quota|할당|billing|PERMISSION/i.test(err.message) && ok === 0) break; }
  }
  rachaBusy = false; $('#rGo').disabled = false; $('#rStop').hidden = true;
  $('#rStat').textContent = `${ok}가지를 만들었습니다${fail.length ? ` · 실패 ${fail.length}가지(${fail.join(', ')}) — 다시 고르고 만들기를 누르면 다시 합니다` : ''}${rachaStop ? ' · 멈춤' : ''}`;
  if (ok && sideTab === 'elems') renderSide();
}

// 점검용 (주소에 ?qa 가 있을 때만): 자동 시험에서 문서 상태를 읽음
if (/[?&]qa\b/.test(location.search)) window.NCQA = { live: NC.live, renderPageCanvas, videoLayers, fontCSSFor, placeVideo, checkMedia, mediaMissing, tlSeekTo: t => tlSeek(t, false), tlSplit, tlTrim, loadDoc, get doc() { return doc; }, get sel() { return sel; }, get tl() { return tl; }, get cur() { return cur; }, select, goto, commit, undo, renderAll, tplItems, tplPagesFor, tplSheet, sheetHTML };

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

/* ---- 새 버전 알림: 작업 중에는 새로고침하지 않고 단추만 보여 줌. 5분 넘게 손대지 않았을 때만 자동으로 ---- */
(function () {
  const cur_ = window.NARACAL_VER || '';
  if (!cur_ || location.protocol === 'file:') return;
  let pending = null, lastInput = Date.now(), timer = 0;
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => window.addEventListener(ev, () => { lastInput = Date.now(); }, { capture: true, passive: true }));
  // 같은 버전으로 이미 한 번 새로고침했는데도 옛 파일이 보이면(브라우저 저장본) 다시 새로고침하지 않음 — 되풀이 새로고침 방지
  const tried = () => { try { return sessionStorage.getItem('nc-reloaded-to') || ''; } catch (e) { return ''; } };
  async function check() { try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); if (j.ver && j.ver > cur_ && j.ver !== tried()) { pending = j.ver; showBtn(); } } catch (e) {} }
  const busy = () => editing || drag || pen || $('#cellEd') || document.querySelector('dialog[open]') || $('#dlPanel') || store.state.saving || (typeof tl !== 'undefined' && (tl.playing || tl.starting)) || (typeof recState !== 'undefined' && recState);
  async function reloadNow() { if (!pending) return; clearTimeout(nudgeTimer); if (store.state.handle && store.state.dirty) { clearTimeout(fileTimer); await saveFileNow(); } try { await store.idbSet('doc', doc); } catch (e) {} try { sessionStorage.setItem('nc-reloaded-to', pending); } catch (e) {} { const u = new URL(location.href); u.searchParams.set('v', pending); location.href = u.href; } }
  function showBtn() {
    let b = $('#newVerBtn'); if (!b) { b = document.createElement('button'); b.id = 'newVerBtn'; b.className = 'btn sm newver'; b.title = '저장된 작업은 그대로 두고 새 버전으로 다시 엽니다'; b.onclick = reloadNow; const bar = $('.topbar .grow'); if (bar) bar.after(b); else document.body.appendChild(b); }
    b.innerHTML = `<svg class="ic"><use href="#i-refresh"/></svg>새 버전 · 새로고침`;
    clearInterval(timer); timer = setInterval(() => { if (pending && Date.now() - lastInput > 5 * 60000 && !busy()) reloadNow(); }, 30000);
  }
  setInterval(check, 120000); window.addEventListener('focus', check); setTimeout(check, 20000);
})();

/* ---- 기타 ---- */
// 알림은 맨 위층(popover)에 띄움: 대화창이 열려 있어도 어두운 배경 뒤에 깔리지 않게. 글이 길면 더 오래
function toastShow(t) { t.hidden = false; try { if (t.showPopover) { if (t.matches(':popover-open')) t.hidePopover(); t.showPopover(); } } catch (e) {} }
function toastHide(t) { t.hidden = true; try { if (t.hidePopover && t.matches(':popover-open')) t.hidePopover(); } catch (e) {} }
let toastTimer; function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); toastShow(t); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastHide(t), Math.max(err ? 5000 : 2500, String(msg).length * 70)); }
// 큰 동작 뒤: 알림에 '되돌리기' 단추 (Ctrl+Z와 같음). after: 되돌린 뒤 할 일
function toastUndo(msg, after) { const t = $('#toast'); t.className = 'toast act'; t.innerHTML = `<span>${esc(msg)}</span><button type="button">되돌리기</button>`; toastShow(t); t.querySelector('button').onclick = () => { toastHide(t); undo(); if (after) after(); toast('되돌렸습니다 (다시 하려면 Ctrl+Shift+Z)'); }; clearTimeout(toastTimer); toastTimer = setTimeout(() => toastHide(t), 7000); }

/* ---- 시작 ---- */
// 같은 문서인지 (문서 번호가 있으면 번호로, 없으면 이름으로)
function sameDoc(a, b) { return a && b && (a.docId && b.docId ? a.docId === b.docId : (a.name || '') === (b.name || '')); }
(async function init() {
  doc = newDoc(); renderRail();
  let loaded = false;
  try {
    const p = await store.reconnect();
    if (p === 'granted') { const j = await store.readFile(); const dr = await store.idbGet('doc').catch(() => null); if (dr && sameDoc(dr, j) && (dr.updatedAt || 0) > (j.savedAt || 0) + 1000 && window.confirm(`이 브라우저에 파일보다 나중에 고친 작업이 있습니다 (파일에 저장되지 못한 작업).\n\n확인: 브라우저 작업으로 열어 파일에 저장 (권장)\n취소: 파일 내용으로 열기 (브라우저 작업은 충돌 사본으로 보관)`)) { await loadDoc(dr); loaded = true; markDirty(); setStatus(`연결된 파일: ${store.state.fileName} · 브라우저 작업을 이어서 저장합니다`); } else { if (dr && sameDoc(dr, j) && (dr.updatedAt || 0) > (j.savedAt || 0) + 1000) { try { await store.writeCopy(dr, '브라우저 작업'); } catch (e) {} } await loadDoc(j); loaded = true; setStatus(`연결된 파일: ${store.state.fileName}`); setTimeout(() => warnIfRecentOther(j), 1500); } }
    else if (p === 'prompt') { const saved = await store.idbGet('doc'); if (saved) { await loadDoc(saved); loaded = true; } const st = $('#status'); st.innerHTML = `<button class="btn sm" id="reconn">연결된 파일 "${esc(store.state.fileName)}" 다시 열기</button>`; store.state.needPerm = true;
      $('#reconn').onclick = async () => {
        if (!(await store.requestPermission())) return; store.state.needPerm = false;
        const draft = loaded ? doc : null; const j = await store.readFile();
        // 권한을 기다리는 동안(지난번 창 포함) 브라우저에서 고친 작업이 파일보다 새로우면 덮어쓰지 않음
        if (draft && sameDoc(draft, j) && (draft.updatedAt || 0) > (j.savedAt || 0) + 1000) {
          if (window.confirm(`이 브라우저에 파일보다 나중에 고친 작업이 있습니다.\n\n확인: 지금 작업을 파일에 저장 (권장)\n취소: 파일 내용을 열고, 지금 작업은 "충돌 사본"으로 보관`)) { await saveFileNow(); setStatus(`연결된 파일: ${store.state.fileName} · 브라우저 작업을 저장했습니다`); updateSaveBadge(); return; }
          try { await store.writeCopy(draft, '브라우저 작업'); } catch (e) { store.download(draft); }
        }
        await loadDoc(j, '연결된 파일을 열었습니다'); updateSaveBadge();
      }; }
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
  NC.live.attach({ canSave: () => !!(store.state.handle && !store.state.needPerm), doc: () => doc, state: () => ({ cur, sel, drag: !!drag, editing: !!editing || !!$('#cellEd') }), afterRemote: liveAfterRemote, saveSoon: () => { if (store.state.dirty) markDirty(); }, openSettings: openSaveDialog, toast });
  document.fonts && document.fonts.ready.then(() => renderAll());
})();
})();
