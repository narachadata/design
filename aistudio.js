// AI 작업대 (팀장님 11/23 「AI가 모든 편집을 해 주기보다 그림·사진 편집·요소 만들기·PPT 배경·PPT 제작 같은 부분에 — 캔바·미리캔버스 검토 후 새로 설계」)
// 조사·전문가 설계: 입구는 두 곳 — ① 왼쪽 「AI 도구」 한 화면(무엇을 만들까요?) ② 고른 글·사진 옆 「✨ AI」.
//   결과는 후보 여러 장(나오는 대로 채움) · 뒤에서 돌리고 편집은 계속(오른쪽 아래 작업 칸) · 넣기는 되돌리기 한 번 · 원본은 남김.
//   채팅 요금제(기본): 지시문을 복사해 채팅에 붙여 넣고, 답은 공방 아무 데서나 ⌘V 한 번 — 그림은 2×2 격자 한 장으로 받아 4장으로 자름, 글은 ```json {"nc":…}``` 한 덩어리.
//   API 키: Claude(글·아이콘·개요 — 몇 초) · Gemini(그림 — 10~30초, 두 장 동시에).
(function () {
  window.NC = window.NC || {};
  let B = null; /* app.js 다리 */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = q => document.querySelector(q);
  const S = { intent: 'img', ratio: '1:1', style: 'illust', prompt: '', cards: [], cardFor: '', deck: { aud: '학부모', n: 10, theme: 'navy', outline: null }, jobs: [] };
  const INTENTS = [['img', '🖼', '그림', '예: 운동장에서 줄넘기하는 아이들, 밝은 봄 느낌'], ['racha', '🐧', '라차', '라차(펭귄) 동작을 고르면 그려 줍니다'], ['sticker', '✨', '스티커', '예: 칭찬 도장, 엄지 척, 하트, 별'], ['icon', '🔷', '아이콘', '예: 수련 시간표에 쓸 아이콘 (시계·도복·물병·차량)'], ['pptbg', '🎞', 'PPT 배경', '예: 여름 캠프 발표 — 시원한 초록, 왼쪽에 글자 자리'], ['deck', '📊', '발표자료', '예: 2027 승급심사 안내 — 날짜·준비물·당일 순서']];
  const STYLES = [['illust', '그림책', 'warm children\'s picture-book illustration, soft colors'], ['flat', '납작한 벡터', 'flat vector illustration, clean shapes, bold outlines'], ['photo', '사진처럼', 'realistic photograph, natural light'], ['water', '수채화', 'soft watercolor painting'], ['cute3d', '3D 귀엽게', 'cute 3D clay render, soft lighting']];
  const RATIOS = [['1:1', '▢ 정사각'], ['3:4', '▯ 세로'], ['16:9', '▭ 가로']];
  const AUDS = ['학부모', '수련생', '선생님·관장', '지역 주민'];
  const BRAND = 'If any penguin appears it is "Racha": a cute round penguin with dark-gray head and back, white face and belly, orange beak and feet. Every person or penguin in taekwondo clothes wears a white taekwondo dobok with a taekwondo V-neck collar (wrap-over V-neck, NOT a judo cross-over lapel); colored-belt students have a collar that is red on the outer band and black on the inner band. No logos, no text, no letters, no watermark.';
  const chat = () => B.chatMode();

  /* ---------- 지시문 ---------- */
  const P = {
    img: (t, st, ratio, grid) => `${grid ? 'A 2x2 grid image with 4 different variations of the same request, one in each quadrant, separated by clear white gutters. Nothing crosses the quadrant borders. ' : ''}${t}. Style: ${st}. Aspect ratio ${ratio}${grid ? ' for each quadrant' : ''}. ${BRAND}`,
    sticker: (t, grid) => `${grid ? 'A 2x2 grid sheet of 4 separate die-cut stickers' : 'One die-cut sticker'}: ${t}. ${grid ? 'Each sticker centered in its own quadrant with wide empty margins; nothing crosses the quadrant borders. ' : ''}Flat vector, bold outlines, thick white die-cut border. Pure white #FFFFFF background. ${BRAND}`,
    pptbg: (t) => `Presentation slide background, 16:9 (1920x1080). Theme: ${t}. Abstract, soft shapes, subtle taekwondo motif (belt curve or dojang floor) only at the edges. Keep the left 60% plain and calm so title text can be placed on it. No text, no letters, no logos, no people.`,
    icons: (t) => `"${t}"에 어울리는 단순한 아이콘 8개를 SVG로 만드세요. 각 아이콘: viewBox "0 0 64 64", 선 위주(stroke-width 4, round cap/join), 색은 "currentColor"와 강조색 #E0564B만, 글자·script·외부 링크·image 금지.\n설명 없이 아래 형식의 \`\`\`json 블록 하나로만 답하세요:\n{"nc":"icons","icons":[{"name":"한글 이름","svg":"<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 64 64\\">…</svg>"}]}`,
    deck: (t, aud, n) => `태권도장 발표자료 개요를 만드세요. 주제: ${t}. 듣는 사람: ${aud}. ${n}장.\n규칙: 제목 18자 이내, bullets 최대 4개·각 26자 이내, 첫 장 type은 cover, 끝 장은 closing. 중간에 agenda를 한 번 넣고, 내용에 맞게 section·content·two·numbers·timeline·quote를 섞으세요. 실제 날짜·이름을 모르면 ○○로 비워 두세요.\ntype: cover|agenda|section|content|two|numbers|timeline|quote|gallery|closing\n설명 없이 \`\`\`json 블록 하나로만:\n{"nc":"deck","title":"","subtitle":"","slides":[{"type":"","title":"","bullets":[],"left":[],"right":[],"numbers":[{"v":"","l":""}],"steps":[{"when":"","what":""}],"quote":{"text":"","by":""},"notes":"발표자 메모 2문장"}]}`,
    rewrite: (how, items) => `아래 글들을 「${how}」 방식으로 다듬으세요. 글마다 후보 3개. 원래 줄 수와 비슷하게, 뜻은 그대로.\n설명 없이 \`\`\`json 블록 하나로만: {"nc":"rewrite","items":[{"id":"","c":["","",""]}]}\n글:\n${items.map(x => `${x.id}: ${x.text.replace(/\n/g, ' / ')}`).join('\n')}`,
    edit: (how) => `Edit the attached image: ${how}. Keep everything else identical — same framing, same size, same style. ${BRAND}`,
    vary: () => `Make a new variation of the attached image: same subject and style, slightly different pose and composition. ${BRAND}`,
  };
  const REWRITES = [['spell', '✔ 맞춤법', '맞춤법·띄어쓰기만 바르게'], ['short', '✂ 짧게', '더 짧고 간결하게'], ['long', '➕ 길게', '조금 더 자세하게'], ['kid', '🧒 쉽게', '초등학생도 알기 쉬운 말로'], ['polite', '🙇 공손하게', '학부모님께 드리는 공손한 말투로'], ['en', '🌐 영어로', '자연스러운 영어로 번역']];

  /* ---------- 받은 글에서 JSON 꺼내기 ---------- */
  function fenced(t) { t = String(t || ''); const m = [...t.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(x => x[1]); for (const c of m.concat([t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)])) { try { const j = JSON.parse(c); if (j && typeof j === 'object') return j; } catch (e) {} } return null; }
  /* SVG 안전하게 (스크립트·이벤트·외부 링크·이미지 빼기) */
  function cleanSvg(svg) { const d = new DOMParser().parseFromString(String(svg || ''), 'image/svg+xml'), r = d.documentElement; if (!r || r.nodeName !== 'svg') return null; r.querySelectorAll('script,foreignObject,image,use,a,iframe,style').forEach(n => n.remove()); r.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name) || /href/i.test(a.name) || /javascript:|url\(/i.test(a.value)) n.removeAttribute(a.name); })); [...r.attributes].forEach(a => { if (/^on/i.test(a.name)) r.removeAttribute(a.name); }); if (!r.getAttribute('xmlns')) r.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); r.setAttribute('color', '#1E2B5A'); const s = new XMLSerializer().serializeToString(r); return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s))); }
  /* 2×2 격자 그림 → 4장 (칸 경계에서 2% 안쪽) */
  async function sliceGrid(src, cols, rows, white) { const img = await AI.loadImg(src), W = img.naturalWidth, H = img.naturalHeight, cw = W / cols, ch = H / rows, out = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const ix = Math.round(cw * 0.02), iy = Math.round(ch * 0.02), w = Math.round(cw - ix * 2), h = Math.round(ch - iy * 2), cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, Math.round(c * cw + ix), Math.round(r * ch + iy), w, h, 0, 0, w, h); let u = cv.toDataURL('image/png'); if (white) { try { u = await trimAlpha(await AI.removeWhite(u)); } catch (e) {} } out.push(u); } return out; }
  async function trimAlpha(src) { const img = await AI.loadImg(src), c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (x1 < 0) return src; const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); return o.toDataURL('image/png'); }

  /* ---------- 작업 (뒤에서 돌리기 · 채팅은 기다리기) ---------- */
  let jid = 0;
  function jobStart(spec) { /* spec: {label, expect:'image'|'json', nc, prompt, kind:'image'|'text', grid, white, aspect, ref, onDone(results|json)} */
    const j = Object.assign({ id: ++jid, status: chat() ? 'wait' : 'run', t0: Date.now(), n: 0 }, spec); S.jobs.unshift(j); S.jobs = S.jobs.slice(0, 6); tray();
    if (chat()) { const go = async () => { if (j.ref) { try { await B.copyImg(j.ref); B.toast('① 그림을 복사했습니다 — 채팅 칸에 먼저 ⌘V로 붙여 넣으세요. 그다음 「② 지시문 복사」'); } catch (e) {} j.step2 = true; tray(); return; } await B.sendToChat(j.prompt, j.kind || (j.expect === 'image' ? 'image' : 'text'), { note: '답(그림·글)을 복사해 공방 아무 데서나 ⌘V' }); }; go(); return j; }
    (async () => { try { if (j.expect === 'image') { const n = j.grid ? 1 : 2, done = []; await Promise.all(Array.from({ length: n }, async () => { const r = await AI.geminiImage({ prompt: j.grid ? j.prompt.replace(/^A 2x2 grid[^.]*\.[^.]*\.\s*/, '') : j.prompt, aspect: j.aspect || '1:1', size: '1K', refImage: j.ref }); for (let u of (r || [])) { if (j.white) { try { u = await trimAlpha(await AI.removeWhite(u)); } catch (e) {} } done.push(u); j.onPart && j.onPart(u); } })); j.status = 'done'; j.n = done.length; tray(); j.onDone && j.onDone(done); }
        else { const t = await AI.claudeText({ system: '디자인 도우미. 요청한 형식(```json 블록)으로만 답합니다.', user: j.prompt }), js = fenced(t); if (!js) throw new Error('답을 읽지 못했습니다'); j.status = 'done'; tray(); j.onDone && j.onDone(js); } }
      catch (e) { j.status = 'error'; j.err = e.message; tray(); B.toast('AI: ' + e.message, true); } })();
    return j;
  }
  /* 채팅에서 복사해 온 답: 공방 어디서나 ⌘V (글을 고치는 중·입력 칸 안은 빼고) */
  async function ingest({ images, text }) {
    const wait = S.jobs.filter(j => j.status === 'wait'); if (!wait.length) return false;
    let j = null, js = null;
    if (text) { js = fenced(text); if (js && js.nc) j = wait.find(x => x.expect === 'json' && x.nc === js.nc); if (!j && js) j = wait.find(x => x.expect === 'json'); }
    if (!j && images && images.length) j = wait.find(x => x.expect === 'image');
    if (!j) return false;
    j.status = 'run'; tray();
    try {
      if (j.expect === 'json') { j.status = 'done'; tray(); j.onDone(js); }
      else { let out = []; for (const u of images) { if (j.grid) out = out.concat(await sliceGrid(u, 2, 2, j.white)); else { let v = u; if (j.white) { try { v = await trimAlpha(await AI.removeWhite(u)); } catch (e) {} } out.push(v); } } j.status = 'done'; j.n = out.length; tray(); j.onDone(out); }
      B.toast(`✅ ${j.label} — 답을 받았습니다`); return true;
    } catch (e) { j.status = 'error'; j.err = e.message; tray(); B.toast(e.message, true); return true; }
  }
  const fileToURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  document.addEventListener('paste', async e => {
    if (!S.jobs.some(j => j.status === 'wait')) return; const t = e.target; if (t && t.closest && (t.closest('input,textarea,[contenteditable="true"]') || t.isContentEditable)) return; if (document.querySelector('dialog[open] .chatzone')) return;
    const cd = e.clipboardData; if (!cd) return; const files = [...(cd.files || [])].filter(f => /^image\//.test(f.type)), text = cd.getData('text/plain');
    if (!files.length && !(text && /\{/.test(text))) return;
    e.preventDefault(); e.stopImmediatePropagation(); const images = []; for (const f of files) images.push(await fileToURL(f));
    if (!(await ingest({ images, text }))) B.toast('기다리는 AI 작업과 맞지 않는 답입니다 — 그림은 그림 작업, 글(JSON)은 글 작업에 붙여 넣으세요', true);
  }, true);

  /* ---------- 오른쪽 아래 작업 칸 ---------- */
  function tray() {
    let t = $('#aiTray'); if (!t) { t = document.createElement('div'); t.id = 'aiTray'; document.body.appendChild(t); t.addEventListener('click', e => { const x = e.target.closest('[data-tj]'); if (!x) return; const j = S.jobs.find(q => q.id === Number(x.dataset.tj)); if (!j) return; const a = x.dataset.ta;
      if (a === 'x') { S.jobs = S.jobs.filter(q => q !== j); tray(); return; } if (a === 'step2') { B.sendToChat(j.prompt, 'image', { note: '받은 그림을 복사해 공방에서 ⌘V' }); j.step2 = false; tray(); return; } if (a === 'again') { B.sendToChat(j.prompt, j.kind || (j.expect === 'image' ? 'image' : 'text')); return; } B.goSide('ai'); }); }
    const live = S.jobs.filter(j => j.status !== 'done' || Date.now() - (j.tDone || (j.tDone = Date.now())) < 20000).slice(0, 4); t.hidden = !live.length;
    t.innerHTML = live.map(j => { const sec = Math.round((Date.now() - j.t0) / 1000); const st = j.status === 'wait' ? (j.step2 ? `<b>① 그림을 채팅에 붙여 넣었으면</b> <button class="btn sm primary" data-tj="${j.id}" data-ta="step2">② 지시문 복사·채팅 열기</button>` : `📋 채팅 답을 기다려요 — 답을 복사해 여기서 <b>⌘V</b> <button class="btn sm" data-tj="${j.id}" data-ta="again" title="지시문을 다시 복사하고 채팅을 엽니다">다시 복사</button>`) : j.status === 'run' ? `<span class="spin"></span> 만드는 중… ${sec}초 — 편집은 계속하셔도 돼요` : j.status === 'error' ? `⚠ ${esc(j.err || '안 됨')}` : `✅ ${j.n ? j.n + '개 ' : ''}도착 — <a data-tj="${j.id}" data-ta="go">눌러서 고르기</a>`; return `<div class="aj ${j.status}"><b class="ajt">${esc(j.label)}</b><span>${st}</span><button class="ajx" data-tj="${j.id}" data-ta="x" title="닫기">×</button></div>`; }).join('');
    clearTimeout(tray._t); if (live.some(j => j.status === 'run' || j.status === 'done')) tray._t = setTimeout(tray, j0(live) ? 1000 : 5000); /* 끝난 작업은 20초 뒤 저절로 사라짐 */
  }

  const j0 = l => l.some(j => j.status === 'run');
  /* ---------- 결과 넣기 ---------- */
  function addCards(list, kind, intent) { if (S.cardFor !== intent) { S.cards = []; S.cardFor = intent; } list.slice().reverse().forEach(u => S.cards.unshift({ src: u, kind, intent })); /* 받은 순서대로 앞에서부터 */ S.cards = S.cards.slice(0, 12); if (B.sideIs('ai')) B.renderSide(); }
  async function insertCard(i, asBg) { const c = S.cards[i]; if (!c) return; await B.insertImage(c.src, { asBg: asBg || c.intent === 'pptbg', name: c.intent === 'icon' ? 'AI 아이콘' : c.intent === 'sticker' ? 'AI 스티커' : c.intent === 'pptbg' ? 'AI 배경' : 'AI 그림', small: c.intent === 'icon' }); }

  /* ---------- 만들기 ---------- */
  function make() {
    const t = (S.prompt || '').trim(), it = S.intent, st = (STYLES.find(x => x[0] === S.style) || STYLES[0])[2], grid = chat();
    if (it === 'racha') { B.openRachaMaker(); return; }
    if (!t) { B.toast('무엇을 만들지 한 줄로 써 주세요', true); const ta = $('#aisQ'); if (ta) ta.focus(); return; }
    if (it === 'img') jobStart({ label: '🖼 그림', expect: 'image', grid, prompt: P.img(t, st, S.ratio, grid), aspect: S.ratio, onPart: u => addCards([u], 'img', 'img'), onDone: r => { if (grid) addCards(r, 'img', 'img'); } });
    if (it === 'sticker') jobStart({ label: '✨ 스티커', expect: 'image', grid, white: true, prompt: P.sticker(t, grid), aspect: '1:1', onPart: u => addCards([u], 'img', 'sticker'), onDone: r => { if (grid) addCards(r, 'img', 'sticker'); } });
    if (it === 'pptbg') jobStart({ label: '🎞 PPT 배경', expect: 'image', prompt: P.pptbg(t), aspect: '16:9', onPart: u => addCards([u], 'img', 'pptbg'), onDone: r => { if (chat()) addCards(r, 'img', 'pptbg'); } });
    if (it === 'icon') jobStart({ label: '🔷 아이콘', expect: 'json', nc: 'icons', kind: 'text', prompt: P.icons(t), onDone: js => { const list = ((js && js.icons) || []).map(x => cleanSvg(x.svg)).filter(Boolean); if (!list.length) { B.toast('아이콘을 읽지 못했습니다', true); return; } addCards(list, 'svg', 'icon'); } });
    if (it === 'deck') jobStart({ label: '📊 발표자료 개요', expect: 'json', nc: 'deck', kind: 'text', prompt: P.deck(t, S.deck.aud, S.deck.n), onDone: js => { S.deck.outline = js && Array.isArray(js.slides) ? js : null; if (!S.deck.outline) { B.toast('개요를 읽지 못했습니다', true); return; } B.goSide('ai'); } });
    B.renderSide();
  }

  /* ---------- 발표자료: 개요 → 테마 → 쪽 ---------- */
  const MASCOTS = ['asset:mascot-03', 'asset:mascot-05', 'asset:mascot-04', 'asset:mascot-07', 'asset:mascot-08', 'asset:mascot-09', 'asset:mascot-01', 'asset:mascot-11'];
  function buildDeck(o, theme) {
    const SL = NC.tpl.presSlides, TH = NC.tpl.presThemes[theme] || NC.tpl.presThemes.navy, uid = B.uid, h = NC.tpl.presH(uid); let sec = 0, mi = 0; const img = () => MASCOTS[(mi++) % MASCOTS.length];
    const pages = (o.slides || []).map((s, i) => { const ty = s.type === 'two' ? 'twocol' : SL[s.type] ? s.type : 'content', b = (s.bullets || []).filter(Boolean); let c;
      if (ty === 'cover') c = { title: s.title || o.title || '', sub: s.subtitle || o.subtitle || b[0] || '', meta: b[1] || '나라차태권도', img: img() };
      else if (ty === 'agenda') c = { title: s.title || '오늘의 순서', items: b.length ? b : (o.slides || []).filter(x => x.type === 'section').map(x => x.title), img: img() };
      else if (ty === 'section') c = { no: String(++sec).padStart(2, '0'), title: s.title || '', sub: b[0] || '' };
      else if (ty === 'twocol') { const L = s.left && s.left.length ? s.left : b.slice(0, 2), R = s.right && s.right.length ? s.right : b.slice(2); c = { title: s.title || '', left: { h: L[0] || '', t: L.slice(1).join('\n') }, right: { h: R[0] || '', t: R.slice(1).join('\n') } }; }
      else if (ty === 'numbers') c = { title: s.title || '', items: (s.numbers || []).slice(0, 3).map(x => ({ n: String(x.v || ''), label: String(x.l || '') })) };
      else if (ty === 'timeline') c = { title: s.title || '', items: (s.steps || []).slice(0, 5).map(x => ({ when: String(x.when || ''), what: String(x.what || '') })) };
      else if (ty === 'quote') c = { text: (s.quote && s.quote.text) || s.title || '', by: (s.quote && s.quote.by) || '' };
      else if (ty === 'gallery') c = { title: s.title || '', pics: [0, 1, 2].map(k => ({ img: img(), cap: b[k] || '' })) };
      else if (ty === 'closing') c = { title: s.title || '감사합니다', sub: b[0] || o.subtitle || '' };
      else c = { title: s.title || '', bullets: b.slice(0, 4), img: img() };
      const pg = SL[ty](h, TH, c); if (s.notes) pg.notes = String(s.notes); return pg; });
    return pages;
  }

  /* ---------- 왼쪽 「AI 도구」 한 화면 ---------- */
  function renderPanel(body) {
    const it = S.intent, I = INTENTS.find(x => x[0] === it), mode = chat() ? `💬 채팅 요금제(${esc(B.chatName('image'))}·${esc(B.chatName('text'))})` : '🔑 API 키';
    const chips = INTENTS.map(([k, ic, t]) => `<button class="ais-chip${k === it ? ' on' : ''}" data-ain="${k}"><span>${ic}</span>${t}</button>`).join('');
    const opts = it === 'img' ? `<div class="ais-lb">그림체</div><div class="ais-row">${STYLES.map(([k, t]) => `<button class="ais-s${S.style === k ? ' on' : ''}" data-ast="${k}">${t}</button>`).join('')}</div><div class="ais-lb">모양</div><div class="ais-row">${RATIOS.map(([k, t]) => `<button class="ais-s${S.ratio === k ? ' on' : ''}" data-ara="${k}">${t}</button>`).join('')}</div>`
      : it === 'deck' ? `<div class="ais-lb">듣는 사람</div><div class="ais-row">${AUDS.map(a => `<button class="ais-s${S.deck.aud === a ? ' on' : ''}" data-aau="${a}">${a}</button>`).join('')}</div><div class="ais-lb">장 수</div><div class="ais-row">${[6, 8, 10, 12, 15].map(n => `<button class="ais-s${S.deck.n === n ? ' on' : ''}" data-anu="${n}">${n}장</button>`).join('')}</div>` : '';
    const goLabel = it === 'racha' ? '🐧 라차 동작 고르기' : chat() ? `📋 지시문 복사하고 ${esc(B.chatName(['img', 'sticker', 'pptbg'].includes(it) ? 'image' : 'text'))} 열기` : it === 'deck' ? '📊 개요 만들기' : '✨ 만들기';
    let res = '';
    if (it === 'deck') { const o = S.deck.outline, TN = NC.tpl.presThemeNames || {}, TH = NC.tpl.presThemes || {};
      res = o ? `<div class="ais-out"><b>📋 ${esc(o.title || '발표자료')} — ${o.slides.length}장</b><ol>${o.slides.map(s => `<li><em>${esc((NC.tpl.presKinds || {})[s.type === 'two' ? 'twocol' : s.type] || s.type)}</em> ${esc(s.title || '')}</li>`).join('')}</ol>
        <div class="ais-lb">테마</div><div class="ais-th">${Object.keys(TH).map(k => `<button class="ais-tc${S.deck.theme === k ? ' on' : ''}" data-ath="${k}" title="${esc(TN[k] || k)}"><i style="background:${TH[k].cbg}"></i><i style="background:${TH[k].ac}"></i><i style="background:${TH[k].bbg}"></i><span>${esc(TN[k] || k)}</span></button>`).join('')}</div>
        <div class="ais-row" style="margin-top:8px"><button class="btn primary sm" data-aact="decknew">새 발표자료로 만들기</button><button class="btn sm" data-aact="deckadd">지금 문서 뒤에 붙이기</button><button class="btn sm" data-aact="deckclr">지우기</button></div><p class="hint">만든 뒤 글·그림은 쪽에서 바로 고치고, 「🎞 PPT 배경」으로 배경 그림을 더할 수 있어요. 다운로드 → PowerPoint로 내보내기.</p></div>` : `<p class="hint">주제를 쓰고 「개요 만들기」 → 쪽 목록을 보고 테마를 고르면 같은 모양의 발표자료가 바로 만들어집니다. 템플릿 → 📊 프레젠테이션에서 직접 골라도 돼요.</p>`; }
    else if (S.cards.length && S.cardFor === (it === 'img' ? 'img' : it)) res = `<div class="ais-lb">결과 <small>누르면 넣기${it === 'pptbg' ? ' (지금 쪽 배경으로)' : ''}</small></div><div class="ais-cards">${S.cards.map((c, i) => c.intent === S.cardFor ? `<button class="ais-card${c.intent === 'pptbg' ? ' wide' : ''}" data-acard="${i}" title="누르면 넣기"><img src="${c.src}" alt=""></button>` : '').join('')}</div>${it !== 'pptbg' && it !== 'icon' ? '<p class="hint">길게 누르거나 Shift+누르기 = 지금 쪽 배경으로</p>' : ''}`;
    body.innerHTML = `<div class="ais"><div class="ais-h"><b>✨ 무엇을 만들까요?</b><small>${mode}</small></div>
      <div class="ais-chips">${chips}</div>
      ${it === 'racha' ? `<p class="hint">${esc(I[3])}</p>` : `<textarea id="aisQ" rows="3" placeholder="${esc(I[3])}">${esc(S.prompt)}</textarea>`}
      ${opts}<button class="btn primary full ais-go" data-aact="go">${goLabel}</button>
      ${chat() ? `<p class="hint ais-tip">채팅에 붙여 넣고 답이 오면, 그림·글을 복사해 <b>공방 아무 데서나 ⌘V</b>${['img', 'sticker'].includes(it) ? ' — 그림은 한 장에 4가지로 받아 저절로 4장으로 나눠요' : ''}.</p>` : ''}
      ${res}
      <details class="ais-more"><summary>더보기 — 그림 스튜디오 · 인성 문구 · AI와 대화 · AI 설정</summary><div class="ais-row"><button class="btn sm" data-aact="studio">🎨 그림 스튜디오</button><button class="btn sm" data-aact="virtue">📝 인성 문구</button><button class="btn sm" data-aact="chat">💬 AI와 대화</button><button class="btn sm" data-aact="keys">⚙ AI 설정</button><button class="btn sm" data-aact="imged">🖌 이미지 편집기</button></div></details></div>`;
    body.onclick = async e => { const g = k => e.target.closest(k);
      const ch = g('[data-ain]'); if (ch) { saveQ(); S.intent = ch.dataset.ain; renderPanel(body); return; }
      const s1 = g('[data-ast]'); if (s1) { saveQ(); S.style = s1.dataset.ast; renderPanel(body); return; } const s2 = g('[data-ara]'); if (s2) { saveQ(); S.ratio = s2.dataset.ara; renderPanel(body); return; }
      const s3 = g('[data-aau]'); if (s3) { saveQ(); S.deck.aud = s3.dataset.aau; renderPanel(body); return; } const s4 = g('[data-anu]'); if (s4) { saveQ(); S.deck.n = Number(s4.dataset.anu); renderPanel(body); return; }
      const s5 = g('[data-ath]'); if (s5) { S.deck.theme = s5.dataset.ath; renderPanel(body); return; }
      const cd = g('[data-acard]'); if (cd) { await insertCard(Number(cd.dataset.acard), e.shiftKey); return; }
      const a = g('[data-aact]'); if (!a) return; const k = a.dataset.aact; saveQ();
      if (k === 'go') make(); if (k === 'studio') B.openAI('image'); if (k === 'virtue') B.openAI('content'); if (k === 'keys') B.openAI('keys'); if (k === 'chat') B.aichatShow(); if (k === 'imged') B.imgEditorSel();
      if (k === 'deckclr') { S.deck.outline = null; renderPanel(body); }
      if (k === 'decknew' || k === 'deckadd') { const o = S.deck.outline; if (!o) return; const pages = buildDeck(o, S.deck.theme); if (k === 'decknew') await B.openPagesAsNewDoc(pages, { w: 508, h: 285.75, name: o.title || '발표자료', fmt: 'pres169' }); else B.appendPages(pages); } };
    let lp = 0; body.onpointerdown = e => { const cd = e.target.closest('[data-acard]'); if (!cd) return; clearTimeout(lp); lp = setTimeout(() => { cd._lp = true; insertCard(Number(cd.dataset.acard), true); }, 600); }; body.onpointerup = () => clearTimeout(lp);
    const q = $('#aisQ'); if (q) q.oninput = () => { S.prompt = q.value; };
  }
  const saveQ = () => { const q = $('#aisQ'); if (q) S.prompt = q.value; };

  /* ---------- 고른 글 「✨ AI」 다듬기 ---------- */
  function rewriteMenu(anchor, els) {
    let p = $('#aiPop'); if (p) p.remove(); p = document.createElement('div'); p.id = 'aiPop'; document.body.appendChild(p);
    const r = anchor.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(innerWidth - 330, r.left)) + 'px'; p.style.top = (r.bottom + 6) + 'px';
    const close = () => { p.remove(); document.removeEventListener('pointerdown', out, true); }, out = e => { if (!p.contains(e.target) && e.target !== anchor) close(); }; setTimeout(() => document.addEventListener('pointerdown', out, true), 0);
    const items = els.map((x, i) => ({ id: 't' + (i + 1), text: String(x.text || ''), el: x }));
    const draw = (cands) => { p.innerHTML = `<div class="aip-h"><b>✨ 글 다듬기</b><small>${els.length > 1 ? els.length + '개 글 상자' : ''}${chat() ? ' · 채팅 요금제' : ''}</small><button class="ajx" data-pc>×</button></div>${cands ? items.map(x => `<div class="aip-g"><small>${esc(x.text.slice(0, 24))}${x.text.length > 24 ? '…' : ''}</small>${(cands[x.id] || []).map((c, k) => `<button class="aip-c" data-pid="${x.id}" data-pk="${k}">${esc(c)}</button>`).join('') || '<em>후보 없음</em>'}</div>`).join('') + '<p class="hint" style="margin:6px 2px 0">누르면 바꿔 넣기 (Ctrl+Z로 되돌리기)</p>' : `<div class="aip-r">${REWRITES.map(([k, t]) => `<button class="ais-s" data-prw="${k}">${t}</button>`).join('')}</div>${chat() ? '<p class="hint" style="margin:6px 2px 0">누르면 지시문을 복사하고 채팅을 엽니다 — 답을 복사해 공방에서 ⌘V</p>' : ''}`}`; };
    let cand = null; draw(null);
    p.onclick = e => { if (e.target.closest('[data-pc]')) { close(); return; }
      const w = e.target.closest('[data-prw]'); if (w) { const how = REWRITES.find(x => x[0] === w.dataset.prw)[2]; p.innerHTML = '<div class="aip-h"><b>✨ 글 다듬기</b></div><p class="hint" style="margin:8px"><span class="spin"></span> ' + (chat() ? '채팅 답을 기다려요 — 답을 복사해 공방에서 ⌘V' : '다듬는 중…') + '</p>';
        jobStart({ label: '✍ 글 다듬기', expect: 'json', nc: 'rewrite', kind: 'text', prompt: P.rewrite(how, items), onDone: js => { cand = {}; ((js && js.items) || []).forEach(x => { cand[x.id] = (x.c || []).map(String).filter(Boolean).slice(0, 3); }); if (!p.isConnected) document.body.appendChild(p); draw(cand); } }); return; }
      const c = e.target.closest('[data-pid]'); if (c && cand) { const x = items.find(q => q.id === c.dataset.pid); if (!x) return; const v = cand[x.id][Number(c.dataset.pk)]; x.el.text = v; delete x.el.html; delete x.el.htmlFor; B.commit(); B.rerender(); B.toast('바꿔 넣었습니다 — 마음에 안 들면 Ctrl+Z'); c.classList.add('on'); } };
  }

  /* ---------- 고른 사진 「✨ AI」 ---------- */
  function imageMenu(anchor, el) {
    let p = $('#aiPop'); if (p) p.remove(); p = document.createElement('div'); p.id = 'aiPop'; document.body.appendChild(p);
    const r = anchor.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(innerWidth - 330, r.left - 200)) + 'px'; p.style.top = Math.min(innerHeight - 320, r.bottom + 6) + 'px';
    const close = () => { p.remove(); document.removeEventListener('pointerdown', out, true); }, out = e => { if (!p.contains(e.target) && e.target !== anchor) close(); }; setTimeout(() => document.addEventListener('pointerdown', out, true), 0);
    const src = B.src(el.src);
    p.innerHTML = `<div class="aip-h"><b>✨ 사진 AI</b><small>${chat() ? '채팅 요금제' : 'API'}</small><button class="ajx" data-pc>×</button></div><div class="aip-r col">
      <button class="ais-s" data-pim="bg">🧽 흰 배경 지우기 <small>바로 · 이 PC에서</small></button>
      <button class="ais-s" data-pim="vary">🎲 비슷하게 새로 그리기</button>
      <label class="aip-ed"><input type="text" id="aipEdit" placeholder="이렇게 바꿔 주세요 — 예: 배경을 파란 하늘로"><button class="btn sm primary" data-pim="edit">바꾸기</button></label>
      ${el.orig ? '<button class="ais-s" data-pim="orig">↩ 원본으로</button>' : ''}<button class="ais-s" data-pim="tool">🖌 이미지 편집기 (지우개·자르기)</button></div><p class="hint" style="margin:6px 2px 0">결과는 왼쪽 「AI 도구」에 후보로 — 누르면 넣기. 원본은 남아요.</p>`;
    p.onclick = async e => { if (e.target.closest('[data-pc]')) { close(); return; } const b = e.target.closest('[data-pim]'); if (!b) return; const k = b.dataset.pim;
      if (k === 'tool') { close(); B.imgEditorSel(); return; }
      if (k === 'orig') { el.src = el.orig; delete el.orig; B.commit(); B.rerender(); close(); return; }
      if (k === 'bg') { try { const u = await trimAlpha(await AI.removeWhite(src)); const ref = B.addAsset(u); el.orig = el.orig || el.src; el.src = ref; B.commit(); B.rerender(); B.toast('흰 배경을 지웠습니다 — 덜 지워졌으면 이미지 편집기, 되돌리기는 Ctrl+Z'); } catch (er) { B.toast('배경을 지우지 못했습니다: ' + er.message, true); } close(); return; }
      const how = k === 'edit' ? (($('#aipEdit') || {}).value || '').trim() : ''; if (k === 'edit' && !how) { B.toast('어떻게 바꿀지 써 주세요', true); return; }
      close(); S.intent = 'img'; jobStart({ label: k === 'vary' ? '🎲 비슷하게' : '🖼 사진 바꾸기', expect: 'image', ref: src, prompt: k === 'vary' ? P.vary() : P.edit(how), aspect: '1:1', onPart: u => addCards([u], 'img', 'img'), onDone: r => { if (chat()) addCards(r, 'img', 'img'); B.goSide('ai'); } }); B.goSide('ai'); };
  }

  NC.aiStudio = { init(bridge) { B = bridge; }, renderPanel, rewriteMenu, imageMenu, buildDeck, fenced, cleanSvg, sliceGrid, ingest, state: S };
})();
