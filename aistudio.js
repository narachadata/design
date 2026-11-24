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
  const S = { intent: 'img', ratio: '1:1', style: 'illust', prompt: '', cards: [], cardFor: '', deck: { aud: '학부모', n: 10, theme: 'navy', outline: null, edit: null }, jobs: [], box: null, boxF: '', boxOpen: false };
  const INTENTS = [['img', '🖼', '그림', '예: 운동장에서 줄넘기하는 아이들, 밝은 봄 느낌'], ['racha', '🐧', '라차', '라차(펭귄) 동작을 고르면 그려 줍니다'], ['sticker', '✨', '스티커', '예: 칭찬 도장, 엄지 척, 하트, 별'], ['icon', '🔷', '아이콘', '예: 수련 시간표에 쓸 아이콘 (시계·도복·물병·차량)'], ['pptbg', '🎞', 'PPT 배경', '예: 여름 캠프 발표 — 시원한 초록, 왼쪽에 글자 자리'], ['deck', '📊', '발표자료', '예: 2027 승급심사 안내 — 날짜·준비물·당일 순서']];
  const STYLES = [['illust', '그림책', 'warm children\'s picture-book illustration, soft colors'], ['flat', '납작한 벡터', 'flat vector illustration, clean shapes, bold outlines'], ['photo', '사진처럼', 'realistic photograph, natural light'], ['water', '수채화', 'soft watercolor painting'], ['cute3d', '3D 귀엽게', 'cute 3D clay render, soft lighting']];
  const RATIOS = [['1:1', '▢ 정사각'], ['3:4', '▯ 세로'], ['16:9', '▭ 가로']];
  const AUDS = ['학부모', '수련생', '선생님·관장', '지역 주민'];
  const BRAND = 'If any penguin appears it is "Racha": a cute round penguin with dark-gray head and back, white face and belly, orange beak and feet. EVERY penguin always wears a white taekwondo dobok (never casual clothes, never a judo gi, never a colored dobok). Every person or penguin in taekwondo clothes wears a white taekwondo dobok with a taekwondo V-neck collar (wrap-over V-neck, NOT a judo cross-over lapel); colored-belt students have a collar that is red on the outer band and black on the inner band. No logos, no text, no letters, no watermark.';
  const BRAND_EDIT = 'Anyone in taekwondo clothes wears a white taekwondo dobok with a taekwondo V-neck collar (NOT a judo lapel). Do not add any new text, letters, logos or watermark.'; /* 사진 고칠 때: 원래 있던 글자는 지우지 않게 */
  const chat = () => B.chatMode();

  /* ---------- 지시문 ---------- */
  const P = {
    img: (t, st, ratio, grid) => `${grid ? 'A 2x2 grid image with 4 different variations of the same request, one in each quadrant, separated by clear white gutters. Nothing crosses the quadrant borders. ' : ''}${t}. Style: ${st}. Aspect ratio ${ratio}${grid ? ' for each quadrant' : ''}. ${BRAND}`,
    sticker: (t, grid) => `${grid ? 'A 2x2 grid sheet of 4 separate die-cut stickers' : 'One die-cut sticker'}: ${t}. ${grid ? 'Each sticker centered in its own quadrant with wide empty margins; nothing crosses the quadrant borders. ' : ''}Flat vector, bold outlines, thick white die-cut border. Solid flat pure magenta #FF00FF background (chroma key) filling everything outside the stickers — no shadows, no gradients, no magenta inside the stickers. ${BRAND}`,  /* 흰 칼선 테두리가 흰 배경과 함께 지워지지 않게 배경은 자홍색 (11/24 검토) — removeWhite는 귀퉁이 색을 지우므로 그대로 동작 */
    pptbg: (t) => `Presentation slide background, 16:9 (1920x1080). Theme: ${t}. Abstract, soft shapes, subtle taekwondo motif (belt curve or dojang floor) only at the edges. Keep the left 60% plain and calm so title text can be placed on it. No text, no letters, no logos, no people.`,
    icons: (t) => `"${t}"에 어울리는 단순한 아이콘 8개를 SVG로 만드세요. 각 아이콘: viewBox "0 0 64 64", 선 위주(stroke-width 4, round cap/join), 색은 "currentColor"와 강조색 #E0564B만, 글자·script·외부 링크·image 금지.\n설명 없이 아래 형식의 \`\`\`json 블록 하나로만 답하세요:\n{"nc":"icons","icons":[{"name":"한글 이름","svg":"<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 64 64\\">…</svg>"}]}`,
    deck: (t, aud, n) => `태권도장 발표자료 개요를 만드세요. 주제: ${t}. 듣는 사람: ${aud}. ${n}장.\n규칙: 제목 18자 이내, bullets 최대 4개·각 26자 이내, 첫 장 type은 cover, 끝 장은 closing. 중간에 agenda를 한 번 넣고, 내용에 맞게 section·content·two·numbers·timeline·quote·cards3·statement·photo를 섞으세요(같은 type이 세 번 넘게 이어지지 않게). 실제 날짜·이름을 모르면 ○○로 비워 두세요.\ntype: cover|agenda|section|content|two|numbers|timeline|quote|gallery|cards3(세 가지 카드)|statement(한 문장 크게)|photo(큰 사진+짧은 설명)|closing\n설명 없이 \`\`\`json 블록 하나로만:\n{"nc":"deck","title":"","subtitle":"","slides":[{"type":"","title":"","bullets":[],"left":[],"right":[],"numbers":[{"v":"","l":""}],"steps":[{"when":"","what":""}],"quote":{"text":"","by":""},"cards":[{"ic":"이모지 하나","h":"","t":""}],"notes":"발표자 메모 2문장"}]}`,
    rewrite: (how, items) => `아래 글들을 「${how}」 방식으로 다듬으세요. 글마다 후보 3개. 원래 줄 수와 비슷하게, 뜻은 그대로.\n설명 없이 \`\`\`json 블록 하나로만: {"nc":"rewrite","items":[{"id":"","c":["","",""]}]}\n글:\n${items.map(x => `${x.id}: ${x.text.replace(/\n/g, ' / ')}`).join('\n')}`,
    edit: (how) => `Edit the attached image: ${how}. Keep everything else identical — same framing, same size, same style. ${BRAND}`,
    mask: (how) => `The attached image has an area painted in solid magenta (#FF00FF). Edit ONLY that magenta area: ${how}. Fill the whole magenta area naturally so that no magenta remains, matching the surrounding lighting, perspective and style. Keep everything outside the magenta area exactly the same, with the same framing and size. ${BRAND_EDIT}`,
    expand: () => `Outpainting: the attached image is a picture surrounded by areas filled with flat solid magenta (#FF00FF). Extend the original picture naturally into all magenta areas so the result is one seamless, complete image with the same style, lighting and perspective. No magenta may remain. Do not change, move or resize the original part. ${BRAND_EDIT}`,
    green: () => `Replace the entire background of the attached image with a perfectly flat, solid pure green (#00FF00) chroma-key background. Keep the main subject exactly the same — same pose, colors, details, size and position — with clean, sharp edges. No shadow or gradient on the background, no green spill on the subject.`,
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
    (async () => { try { if (j.expect === 'image') { const n = j.grid ? 1 : 2, done = []; await Promise.all(Array.from({ length: n }, async () => { const r = await AI.geminiImage({ prompt: j.grid ? j.prompt.replace(/^A 2x2 grid[^.]*\.[^.]*\.\s*/, '') : j.prompt, aspect: j.aspect || '1:1', size: '1K', refImage: j.ref, edit: j.edit }); for (let u of (r || [])) { if (j.white) { try { u = await trimAlpha(await AI.removeWhite(u)); } catch (e) {} } done.push(u); j.onPart && j.onPart(u); } })); j.status = 'done'; j.n = done.length; tray(); j.onDone && j.onDone(done); }
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

  /* 11/24 ⌘V 없이 (전문가 [중] 「클립보드 자동 읽기」): 기다리는 AI 작업이 있을 때
     · 작업 칸 「복사한 답 넣기」 단추 → 브라우저가 한 번 허용을 물음
     · 허용해 두면 채팅 창에서 답을 복사하고 공방으로 돌아오기만 해도 저절로 (같은 내용은 두 번 읽지 않음, 안 맞는 내용은 조용히 넘김) */
  const clipSeen = new Set();
  async function clipTake(byUser) {
    if (!S.jobs.some(j => j.status === 'wait')) return; if (!navigator.clipboard || !navigator.clipboard.read) { if (byUser) B.toast('이 브라우저는 클립보드를 직접 읽지 못합니다 — 답을 복사해 ⌘V(Ctrl+V)로 넣어 주세요', true); return; }
    let items; try { items = await navigator.clipboard.read(); } catch (e) { if (byUser) B.toast('클립보드를 읽지 못했습니다 — 주소창 왼쪽 자물쇠에서 「클립보드」를 허용하거나 ⌘V(Ctrl+V)로 넣어 주세요', true); return; }
    const images = []; let text = '', sig = '';
    for (const it of items) { const im = it.types.find(t => /^image\//.test(t)); if (im) { const b = await it.getType(im); sig += 'i' + b.size + ':'; images.push(await fileToURL(b)); } else if (it.types.includes('text/plain')) { const t = await (await it.getType('text/plain')).text(); text += t; sig += 't' + t.length + ':' + t.slice(0, 40) + t.slice(-40); } }
    if (!images.length && !(text && /\{/.test(text))) { if (byUser) B.toast('복사한 답이 없습니다 — 채팅에서 그림(오른쪽 단추 → 이미지 복사)이나 답 글 전체를 복사해 주세요', true); return; }
    if (text && !images.length && S.jobs.some(j => j.status === 'wait' && j.prompt && text.includes(String(j.prompt).slice(0, 60)))) { if (byUser) B.toast('아직 공방이 복사한 지시문이 클립보드에 있어요 — 채팅의 답을 복사한 뒤 눌러 주세요', true); return; }  /* 지시문을 답으로 잘못 읽지 않게 */
    if (!byUser && clipSeen.has(sig)) return; clipSeen.add(sig);
    const ok = await ingest({ images, text }); if (!ok && byUser) B.toast('기다리는 AI 작업과 맞지 않는 답입니다 — 그림은 그림 작업, 글(JSON)은 글 작업의 답을 복사해 주세요', true);
  }
  async function clipAuto() { if (!S.jobs.some(j => j.status === 'wait') || document.visibilityState !== 'visible') return; try { const p = await navigator.permissions.query({ name: 'clipboard-read' }); if (p.state !== 'granted') return; } catch (e) { return; } clipTake(false); }
  window.addEventListener('focus', () => setTimeout(clipAuto, 150)); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(clipAuto, 150); });

  /* ---------- 오른쪽 아래 작업 칸 ---------- */
  function tray() {
    let t = $('#aiTray'); if (!t) { t = document.createElement('div'); t.id = 'aiTray'; document.body.appendChild(t); t.addEventListener('click', e => { const x = e.target.closest('[data-tj]'); if (!x) return; const j = S.jobs.find(q => q.id === Number(x.dataset.tj)); if (!j) return; const a = x.dataset.ta;
      if (a === 'x') { S.jobs = S.jobs.filter(q => q !== j); tray(); return; } if (a === 'clip') { clipTake(true); return; } if (a === 'step2') { B.sendToChat(j.prompt, 'image', { note: '받은 그림을 복사해 공방에서 ⌘V' }); j.step2 = false; tray(); return; } if (a === 'again') { B.sendToChat(j.prompt, j.kind || (j.expect === 'image' ? 'image' : 'text')); return; } B.goSide('ai'); setTimeout(() => { const tg = document.querySelector('#sidebody #aisRes > *'); if (tg) { tg.scrollIntoView({ behavior: 'smooth', block: 'start' }); tg.animate && tg.animate([{ boxShadow: '0 0 0 3px rgba(47,91,234,.5)' }, { boxShadow: '0 0 0 0 rgba(47,91,234,0)' }], { duration: 1400 }); } }, 120); }); }  /* 「눌러서 고르기」 → 결과(후보·개요)로 스크롤 (11/24 검토) */
    const live = S.jobs.filter(j => j.status !== 'done' || Date.now() - (j.tDone || (j.tDone = Date.now())) < 20000).slice(0, 4); t.hidden = !live.length;
    t.innerHTML = live.map(j => { const sec = Math.round((Date.now() - j.t0) / 1000); const st = j.status === 'wait' ? (j.step2 ? `<b>① 그림을 채팅에 붙여 넣었으면</b> <button class="btn sm primary" data-tj="${j.id}" data-ta="step2">② 지시문 복사·채팅 열기</button>` : `📋 채팅 답을 기다려요 — 답을 복사한 뒤 <button class="btn sm primary" data-tj="${j.id}" data-ta="clip" title="복사한 답(그림·글)을 바로 넣습니다 — ⌘V도 됩니다. 한 번 허용하면 다음부터는 공방으로 돌아오기만 해도 저절로 들어갑니다">복사한 답 넣기</button> <button class="btn sm" data-tj="${j.id}" data-ta="again" title="지시문을 다시 복사하고 채팅을 엽니다">다시 복사</button>`) : j.status === 'run' ? `<span class="spin"></span> 만드는 중… ${sec}초 — 편집은 계속하셔도 돼요` : j.status === 'error' ? `⚠ ${esc(j.err || '안 됨')}` : `✅ ${j.n ? j.n + '개 ' : ''}도착 — <a data-tj="${j.id}" data-ta="go">눌러서 고르기</a>`; return `<div class="aj ${j.status}"><b class="ajt">${esc(j.label)}</b><span>${st}</span><button class="ajx" data-tj="${j.id}" data-ta="x" title="닫기">×</button></div>`; }).join('');
    clearTimeout(tray._t); if (live.some(j => j.status === 'run' || j.status === 'done')) tray._t = setTimeout(tray, j0(live) ? 1000 : 5000); /* 끝난 작업은 20초 뒤 저절로 사라짐 */
  }

  const j0 = l => l.some(j => j.status === 'run');
  /* ---------- 결과 넣기 ---------- */
  function addCards(list, kind, intent, extra) { if (S.cardFor !== intent) { S.cards = []; S.cardFor = intent; } list.forEach(u => keep(u, extra && extra.target ? 'fix' : intent, extra && extra.label || S.prompt)); list.slice().reverse().forEach(u => S.cards.unshift(Object.assign({ src: u, kind, intent }, extra || {}))); /* 받은 순서대로 앞에서부터 */ S.cards = S.cards.slice(0, 12); if (B.sideIs('ai')) B.renderSide(); }
  async function insertCard(i, asBg) { const c = S.cards[i]; if (!c) return; if (c.target && !asBg && B.replaceImg(c.target, c.src, c.box)) { B.toast('사진을 바꿨습니다 — 다른 후보를 눌러도 되고, 되돌리기는 Ctrl+Z · 사진 ✨ AI → 원본으로'); return; } await B.insertImage(c.src, { asBg: asBg || c.intent === 'pptbg', name: c.intent === 'icon' ? 'AI 아이콘' : c.intent === 'sticker' ? 'AI 스티커' : c.intent === 'pptbg' ? 'AI 배경' : 'AI 그림', small: c.intent === 'icon' }); }

  /* ---------- 만들기 ---------- */
  function make() {
    const t = (S.prompt || '').trim(), it = S.intent, st = (STYLES.find(x => x[0] === S.style) || STYLES[0])[2], grid = chat();
    if (it === 'racha') { B.openRachaMaker(); return; }
    if (!t) { B.toast('무엇을 만들지 한 줄로 써 주세요', true); const ta = $('#aisQ'); if (ta) ta.focus(); return; }
    if (it === 'img') jobStart({ label: '🖼 그림', expect: 'image', grid, prompt: P.img(t, st, S.ratio, grid), aspect: S.ratio, onPart: u => addCards([u], 'img', 'img'), onDone: r => { if (grid) addCards(r, 'img', 'img'); } });
    if (it === 'sticker') jobStart({ label: '✨ 스티커', expect: 'image', grid, white: true, prompt: P.sticker(t, grid), aspect: '1:1', onPart: u => addCards([u], 'img', 'sticker'), onDone: r => { if (grid) addCards(r, 'img', 'sticker'); } });
    if (it === 'pptbg') jobStart({ label: '🎞 PPT 배경', expect: 'image', prompt: P.pptbg(t), aspect: '16:9', onPart: u => addCards([u], 'img', 'pptbg'), onDone: r => { if (chat()) addCards(r, 'img', 'pptbg'); } });
    if (it === 'icon') jobStart({ label: '🔷 아이콘', expect: 'json', nc: 'icons', kind: 'text', prompt: P.icons(t), onDone: js => { const list = ((js && js.icons) || []).map(x => cleanSvg(x.svg)).filter(Boolean); if (!list.length) { B.toast('아이콘을 읽지 못했습니다', true); return; } addCards(list, 'svg', 'icon'); } });
    if (it === 'deck') jobStart({ label: '📊 발표자료 개요', expect: 'json', nc: 'deck', kind: 'text', prompt: P.deck(t, S.deck.aud, S.deck.n), onDone: js => { S.deck.outline = js && Array.isArray(js.slides) ? js : null; S.deck.edit = null; if (!S.deck.outline) { B.toast('개요를 읽지 못했습니다', true); return; } B.goSide('ai'); } });
    B.renderSide();
  }

  /* ---------- 발표자료: 개요 → 테마 → 쪽 ---------- */
  const MASCOTS = ['assets/racha/racha-guard.webp', 'asset:mascot-05', 'assets/racha/racha-highkick.webp', 'assets/racha/racha-sidekick.webp'];  /* 라차 공식 원본(1400px) — TV·4K에서도 선명 (11/24) */
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
      else if (ty === 'cards3') c = { title: s.title || '', items: (s.cards && s.cards.length ? s.cards : b.map(x => ({ h: x, t: '' }))).slice(0, 3).map((x, k) => ({ ic: String(x.ic || k + 1), h: String(x.h || ''), t: String(x.t || '') })) };
      else if (ty === 'statement') c = { text: s.title || b[0] || '', sub: s.title ? b[0] || '' : b[1] || '' };
      else if (ty === 'photo') c = { title: s.title || '', sub: b.join('\n'), img: img() };
      else if (ty === 'closing') c = { title: s.title || '감사합니다', sub: b[0] || o.subtitle || '' };
      else c = { title: s.title || '', bullets: b.slice(0, 4), img: img() };
      const pg = SL[ty](h, TH, c); if (s.notes) pg.notes = String(s.notes); return pg; });
    return pages;
  }

  /* ---------- 왼쪽 「AI 도구」 한 화면 ---------- */
  function renderPanel(body) {
    const tabs = `<div class="ais-tabs" role="tablist"><button role="tab" data-aitab="make" class="${S.tab !== 'chat' ? 'on' : ''}" aria-selected="${S.tab !== 'chat'}">✨ 만들기</button><button role="tab" data-aitab="chat" class="${S.tab === 'chat' ? 'on' : ''}" aria-selected="${S.tab === 'chat'}">💬 AI와 대화</button></div><div class="ais-tools"><button class="btn sm" data-aact="studio">🎨 그림 스튜디오</button><button class="btn sm" data-aact="racha">🐧 라차 동작</button><button class="btn sm" data-aact="imged">🖌 이미지 편집기</button><button class="btn sm" data-aact="keys">⚙ AI 설정</button></div>`;
    if (S.tab === 'chat') { body.innerHTML = `<div class="ais ais-chatwrap">${tabs}<div class="ais-chathost" id="aisChatHost"></div></div>`; body.onclick = e => { const t = e.target.closest('[data-aitab]'); if (t) { S.tab = t.dataset.aitab; renderPanel(body); return; } const a = e.target.closest('[data-aact]'); if (!a) return; const k = a.dataset.aact; if (k === 'studio') B.openAI('image'); if (k === 'keys') B.openAI('keys'); if (k === 'racha') B.openRachaMaker(); if (k === 'imged') B.imgEditorSel(); }; body.oninput = null; body.onchange = null; if (NC.aichat && NC.aichat.mount) NC.aichat.mount(body.querySelector('#aisChatHost')); return; }
    const it = S.intent, I = INTENTS.find(x => x[0] === it), mode = chat() ? `💬 채팅 요금제(${esc(B.chatName('image'))}·${esc(B.chatName('text'))})` : '🔑 API 키';
    const chips = INTENTS.map(([k, ic, t]) => `<button class="ais-chip${k === it ? ' on' : ''}" data-ain="${k}"><span>${ic}</span>${t}</button>`).join('');
    const opts = it === 'img' ? `<div class="ais-lb">그림체</div><div class="ais-row">${STYLES.map(([k, t]) => `<button class="ais-s${S.style === k ? ' on' : ''}" data-ast="${k}">${t}</button>`).join('')}</div><div class="ais-lb">모양</div><div class="ais-row">${RATIOS.map(([k, t]) => `<button class="ais-s${S.ratio === k ? ' on' : ''}" data-ara="${k}">${t}</button>`).join('')}</div>`
      : it === 'deck' ? `<div class="ais-lb">듣는 사람</div><div class="ais-row">${AUDS.map(a => `<button class="ais-s${S.deck.aud === a ? ' on' : ''}" data-aau="${a}">${a}</button>`).join('')}</div><div class="ais-lb">장 수</div><div class="ais-row">${[6, 8, 10, 12, 15].map(n => `<button class="ais-s${S.deck.n === n ? ' on' : ''}" data-anu="${n}">${n}장</button>`).join('')}</div>` : '';
    const goLabel = it === 'racha' ? '🐧 라차 동작 고르기' : chat() ? `📋 지시문 복사하고 ${esc(B.chatName(['img', 'sticker', 'pptbg'].includes(it) ? 'image' : 'text'))} 열기` : it === 'deck' ? '📊 개요 만들기' : '✨ 만들기';
    let res = '';
    if (it === 'deck') { const o = S.deck.outline, TN = NC.tpl.presThemeNames || {}, TH = NC.tpl.presThemes || {};
      res = o ? `<div class="ais-out"><b>📋 ${esc(o.title || '발표자료')} — ${o.slides.length}장</b> <small class="hint">줄을 누르면 고쳐요 · ↑↓ 순서 · 🗑 빼기</small>${outlineHTML(o)}
        <div class="ais-lb">테마</div><div class="ais-th">${Object.keys(TH).map(k => `<button class="ais-tc${S.deck.theme === k ? ' on' : ''}" data-ath="${k}" title="${esc(TN[k] || k)}"><i style="background:${TH[k].cbg}"></i><i style="background:${TH[k].ac}"></i><i style="background:${TH[k].bbg}"></i><span>${esc(TN[k] || k)}</span></button>`).join('')}</div>
        <div class="ais-row" style="margin-top:8px"><button class="btn primary sm" data-aact="decknew">새 발표자료로 만들기</button><button class="btn sm" data-aact="deckadd">지금 문서 뒤에 붙이기</button><button class="btn sm" data-aact="deckclr">지우기</button></div><p class="hint">만든 뒤 글·그림은 쪽에서 바로 고치고, 「🎞 PPT 배경」으로 배경 그림을 더할 수 있어요. 다운로드 → PowerPoint로 내보내기.</p></div>` : `<p class="hint">주제를 쓰고 「개요 만들기」 → 쪽 목록을 보고 테마를 고르면 같은 모양의 발표자료가 바로 만들어집니다. 템플릿 → 📊 프레젠테이션에서 직접 골라도 돼요.</p><button class="btn sm" data-aact="deckself">✍ AI 없이 개요 직접 쓰기</button>`; }
    else if (S.cards.length && S.cardFor === (it === 'img' ? 'img' : it)) { const tg = S.cards.some(c => c.target && c.intent === S.cardFor); res = `<div class="ais-lb">결과 <small>${tg ? '「눌러서 바꾸기」 = 고른 사진이 바뀜 (원본은 남음)' : '누르면 넣기' + (it === 'pptbg' ? ' (지금 쪽 배경으로)' : '')}</small></div><div class="ais-cards">${S.cards.map((c, i) => c.intent === S.cardFor ? `<button class="ais-card${c.intent === 'pptbg' ? ' wide' : ''}" data-acard="${i}" title="${c.target ? '누르면 고른 사진이 바뀜' : '누르면 넣기'}"><img src="${c.src}" alt="">${c.target ? '<i class="ais-rep">눌러서 바꾸기</i>' : ''}</button>` : '').join('')}</div>${it !== 'pptbg' && it !== 'icon' && !tg ? '<p class="hint">길게 누르거나 Shift+누르기 = 지금 쪽 배경으로</p>' : ''}`; }
    body.innerHTML = `<div class="ais">${tabs}<div class="ais-h"><b>✨ 무엇을 만들까요?</b><small>${mode}</small></div>
      <div class="ais-chips">${chips}</div>
      ${it === 'racha' ? `<p class="hint">${esc(I[3])}</p>` : `<textarea id="aisQ" rows="3" placeholder="${esc(I[3])}">${esc(S.prompt)}</textarea>`}
      ${opts}<button class="btn primary full ais-go" data-aact="go">${goLabel}</button>
      ${chat() ? `<p class="hint ais-tip">채팅에 붙여 넣고 답이 오면, 그림·글을 복사해 <b>공방 아무 데서나 ⌘V</b>${['img', 'sticker'].includes(it) ? ' — 그림은 한 장에 4가지로 받아 저절로 4장으로 나눠요' : ''}.</p>` : ''}
      <div id="aisRes">${res}</div>
      ${boxHTML()}
      </div>`;
    body.onclick = async e => { const g = k => e.target.closest(k);
      const tb = g('[data-aitab]'); if (tb) { S.tab = tb.dataset.aitab; renderPanel(body); return; } if (g('[data-aact="racha"]')) { B.openRachaMaker(); return; }
      const ch = g('[data-ain]'); if (ch) { saveQ(); S.prompts = Object.assign({}, S.prompts, { [S.intent]: S.prompt }); S.intent = ch.dataset.ain; S.prompt = (S.prompts || {})[S.intent] || ''; renderPanel(body); return; }  /* 만들 것마다 요청 글을 따로 기억 (11/24 검토: 그림에서 쓴 글이 스티커·발표자료로 따라옴) */
      const s1 = g('[data-ast]'); if (s1) { saveQ(); S.style = s1.dataset.ast; renderPanel(body); return; } const s2 = g('[data-ara]'); if (s2) { saveQ(); S.ratio = s2.dataset.ara; renderPanel(body); return; }
      const s3 = g('[data-aau]'); if (s3) { saveQ(); S.deck.aud = s3.dataset.aau; renderPanel(body); return; } const s4 = g('[data-anu]'); if (s4) { saveQ(); S.deck.n = Number(s4.dataset.anu); renderPanel(body); return; }
      const s5 = g('[data-ath]'); if (s5) { S.deck.theme = s5.dataset.ath; renderPanel(body); return; }
      const cd = g('[data-acard]'); if (cd) { if (cd._lp) { cd._lp = false; return; } await insertCard(Number(cd.dataset.acard), e.shiftKey); return; }
      const bf = g('[data-abf]'); if (bf) { S.boxF = bf.dataset.abf; renderPanel(body); return; }
      const bx = g('[data-abx]'); if (bx) { await boxInsert(bx.dataset.abx, e.shiftKey); return; }
      const bd = g('[data-abd]'); if (bd) { const id = bd.dataset.abd, x = (S.box || []).find(q => q.id === id); try { await RB.del(id); } catch (er) {} if (x && x.fname) boxTrash(x); if (x) URL.revokeObjectURL(x.url); S.box = (S.box || []).filter(q => q.id !== id); renderPanel(body); return; }
      const am = g('[data-alm]'); if (am) { const o = S.deck.outline, i = Number(am.dataset.ali), m = am.dataset.alm; if (!o) return; if (m === 'del') { if (o.slides.length <= 1) return; o.slides.splice(i, 1); if (S.deck.edit === i) S.deck.edit = null; else if (S.deck.edit > i) S.deck.edit--; } else { const j = m === 'up' ? i - 1 : i + 1; if (j < 0 || j >= o.slides.length) return; [o.slides[i], o.slides[j]] = [o.slides[j], o.slides[i]]; if (S.deck.edit === i) S.deck.edit = j; else if (S.deck.edit === j) S.deck.edit = i; } renderPanel(body); return; }
      const ae = g('[data-ale]'); if (ae) { const i = Number(ae.dataset.ale); S.deck.edit = S.deck.edit === i ? null : i; renderPanel(body); const t = body.querySelector('.ais-oe [data-alf=title]'); if (t) t.focus(); return; }
      const a = g('[data-aact]'); if (!a) return; const k = a.dataset.aact; saveQ();
      if (k === 'go') make(); if (k === 'studio') B.openAI('image'); if (k === 'virtue') B.openAI('content'); if (k === 'keys') B.openAI('keys'); if (k === 'chat') B.aichatShow(); if (k === 'imged') B.imgEditorSel();
      if (k === 'deckclr') { S.deck.outline = null; S.deck.edit = null; renderPanel(body); }
      if (k === 'deckself') { selfOutline(); renderPanel(body); const t = body.querySelector('.ais-oe [data-alf=title]'); if (t) t.focus(); }
      if (k === 'sladd') { const o = S.deck.outline; if (!o) return; const at = S.deck.edit == null ? Math.max(0, o.slides.length - 1) : S.deck.edit + 1; o.slides.splice(at, 0, { type: 'content', title: '', bullets: [] }); S.deck.edit = at; renderPanel(body); const t = body.querySelector('.ais-oe [data-alf=title]'); if (t) t.focus(); }
      if (k === 'boxclr') { if (!window.confirm(S.boxDrive ? '내 AI 결과함을 모두 비울까요? (구글 드라이브 「AI 결과함」 폴더의 그림은 내 드라이브 휴지통으로 가서 되살릴 수 있어요 · 문서에 넣은 그림은 그대로)' : '내 AI 결과함을 모두 비울까요? (문서에 넣은 그림은 그대로 남아요)')) return; try { await RB.clear(); } catch (er) {} for (const x of (S.box || [])) if (x.fname) await boxTrash(x); (S.box || []).forEach(x => URL.revokeObjectURL(x.url)); S.box = []; renderPanel(body); }
      if (k === 'decknew' || k === 'deckadd') { const o = S.deck.outline; if (!o) return; const pages = buildDeck(o, S.deck.theme); if (k === 'decknew') await B.openPagesAsNewDoc(pages, { w: 508, h: 285.75, name: o.title || '발표자료', fmt: 'pres169' }); else B.appendPages(pages); } };
    let lp = 0; body.onpointerdown = e => { const cd = e.target.closest('[data-acard]'); if (!cd) return; clearTimeout(lp); lp = setTimeout(() => { cd._lp = true; insertCard(Number(cd.dataset.acard), true); }, 600); }; body.onpointerup = () => clearTimeout(lp);
    const q = $('#aisQ'); if (q) q.oninput = () => { S.prompt = q.value; };
    body.oninput = e => { const f = e.target.closest('[data-alf]'), o = S.deck.outline; if (!f || !o || S.deck.edit == null) return; const sl = o.slides[S.deck.edit]; if (!sl) return; const k = f.dataset.alf;
      if (k === 'title') { sl.title = f.value; const t = f.closest('li').querySelector('.ais-olt'); if (t) t.textContent = f.value || '(제목 없음)'; } if (k === 'lines') setLines(sl, f.value); if (k === 'notes') sl.notes = f.value; };
    body.onchange = e => { const f = e.target.closest('[data-alf=type]'), o = S.deck.outline; if (!f || !o || S.deck.edit == null) return; const sl = o.slides[S.deck.edit], t = linesOf(sl); sl.type = f.value; setLines(sl, t); renderPanel(body); };
    const bxd = body.querySelector('.ais-box'); if (bxd) bxd.ontoggle = () => { S.boxOpen = bxd.open; };
    if (!S.box) loadBox();
  }
  const saveQ = () => { const q = $('#aisQ'); if (q) S.prompt = q.value; };

  /* ---------- 2단계 (11/23 전문가 권고): 칠한 곳만 바꾸기 · 사진 넓히기 · 더 정확한 배경 지우기 · 내 AI 결과함 ----------
     원칙: AI가 그린 결과를 그대로 쓰지 않고 이 PC에서 원본과 합침 — 칠하지 않은 곳·원래 사진 부분은 한 점도 바뀌지 않음.
     AI에게는 「자홍색(#FF00FF)으로 칠한 곳만」이라고 알려 줌(채팅 요금제에서도 그림 한 장 + 지시문으로 똑같이 됨). */
  const ASPECTS = [['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['3:2', 1.5], ['2:3', 2 / 3], ['16:9', 16 / 9], ['9:16', 9 / 16], ['5:4', 1.25], ['4:5', 0.8], ['21:9', 21 / 9]];
  const nearAspect = r => ASPECTS.reduce((b, a) => Math.abs(Math.log(a[1] / r)) < Math.abs(Math.log(b[1] / r)) ? a : b);
  const mkC = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  async function workCanvas(src, max) { const img = await AI.loadImg(src), k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = mkC(img.naturalWidth * k, img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c; }
  /* AI가 돌려준 그림을 원래 칸에 맞춤 (모양이 거의 같으면 늘이고, 다르면 가운데를 채워 자름) */
  function fitInto(g, img, W, H) { const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, r = iw / ih, R = W / H; if (Math.abs(r / R - 1) < 0.05) { g.drawImage(img, 0, 0, W, H); return; } let sw = iw, sh = ih, sx = 0, sy = 0; if (r > R) { sw = ih * R; sx = (iw - sw) / 2; } else { sh = iw / R; sy = (ih - sh) / 2; } g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H); }
  /* 칠한 곳을 f만큼 넓히고 흐리게 → 경계가 자연스럽게 섞임 */
  function softMask(m, f) { const o = mkC(m.width, m.height), g = o.getContext('2d'); for (let a = 0; a < 8; a++) g.drawImage(m, Math.round(Math.cos(a * Math.PI / 4) * f), Math.round(Math.sin(a * Math.PI / 4) * f)); g.drawImage(m, 0, 0); const o2 = mkC(m.width, m.height), g2 = o2.getContext('2d'); g2.filter = `blur(${Math.max(1, f / 2)}px)`; g2.drawImage(o, 0, 0); return o2; }
  async function blendMasked(base, res, mask, f) { const W = base.width, H = base.height, img = await AI.loadImg(res), rc = mkC(W, H), g = rc.getContext('2d'); fitInto(g, img, W, H); g.globalCompositeOperation = 'destination-in'; g.drawImage(softMask(mask, f), 0, 0); const o = mkC(W, H), og = o.getContext('2d'); og.drawImage(base, 0, 0); og.drawImage(rc, 0, 0); return o.toDataURL('image/png'); }
  const painted = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) return true; return false; };

  function aiDlg(id, title, html, cls) { let d = $('#' + id); if (d) { try { d.close(); } catch (e) {} d.remove(); } d = document.createElement('dialog'); d.id = id; d.className = 'nw-dlg aimk ' + (cls || ''); d.innerHTML = `<div class="dhead"><h2>${title}</h2><button class="btn sm" data-close>닫기</button></div><div class="dbody">${html}</div>`; document.body.appendChild(d); d.querySelector('[data-close]').onclick = () => d.close(); d.addEventListener('close', () => setTimeout(() => d.remove(), 0)); d.showModal(); return d; }
  /* 결과: 왼쪽 「AI 도구」 후보 카드 — 누르면 고른 사진이 바뀜(원본은 남음) */
  function fixJob({ label, el, ref, prompt, aspect, post, box }) {
    S.intent = 'img'; const from = { x: el.x, y: el.y, w: el.w, h: el.h };
    const add = async u => { try { addCards([await post(u)], 'img', 'img', { target: el.id, box: box ? Object.assign({ from }, box) : null, label }); } catch (e) { B.toast('AI 결과를 사진에 맞추지 못했습니다: ' + e.message, true); } };
    jobStart({ label, expect: 'image', edit: true, ref, prompt, aspect, onPart: add, onDone: async r => { if (chat()) for (const u of r) await add(u); B.goSide('ai'); } }); B.goSide('ai');
  }

  /* ① 칠한 곳만 바꾸기 */
  const FIXES = [['🧽 지우기', '칠한 곳에 있는 것을 지우고 주변 배경으로 자연스럽게 채워 주세요'], ['😊 웃는 얼굴', '칠한 곳의 얼굴을 자연스럽게 웃는 얼굴로 바꿔 주세요'], ['🥋 도복 입히기', '칠한 곳의 사람에게 흰 태권도 도복을 입혀 주세요'], ['☀ 밝게', '칠한 곳을 더 밝고 선명하게 해 주세요']];
  async function openMask(el) {
    const src = B.src(el.src); let base; try { base = await workCanvas(src, 1200); } catch (e) { B.toast(e.message, true); return; }
    const W = base.width, H = base.height, mask = mkC(W, H), mg = mask.getContext('2d'), undo = []; let brush = Math.round(Math.max(W, H) / 20), erase = false, down = false, last = null;
    const d = aiDlg('dlgAiMask', '🖌 칠한 곳만 바꾸기 <small>칠하지 않은 곳은 한 점도 바뀌지 않아요</small>', `<div class="aimk-b"><div class="aimk-st"><div class="aimk-cv" id="amkStage"><i class="amk-ring"></i></div></div>
      <div class="aimk-side"><div class="ais-lb">① 바꿀 곳을 칠하기</div><div class="ais-row"><button class="ais-s on" data-mk="paint">🖌 칠하기</button><button class="ais-s" data-mk="erase">🩹 덜 칠하기</button></div>
      <label class="aimk-sl">붓 굵기 <input type="range" id="amkSize" min="4" max="${Math.round(Math.max(W, H) / 5)}" value="${brush}"></label>
      <div class="ais-row"><button class="ais-s" data-mk="undo">↶ 한 번 취소</button><button class="ais-s" data-mk="clear">모두 지우기</button></div>
      <div class="ais-lb">② 칠한 곳을 어떻게 바꿀까요?</div><div class="ais-row">${FIXES.map((f, i) => `<button class="ais-s" data-mkf="${i}">${f[0]}</button>`).join('')}</div>
      <textarea id="amkHow" rows="3" placeholder="예: 들고 있는 컵을 지워 주세요 / 모자를 빨간 모자로"></textarea>
      <button class="btn primary full" data-mk="go" style="margin-top:10px">${chat() ? '📋 칠한 그림 복사하고 시작' : '✨ 바꾸기'}</button>
      <p class="hint">${chat() ? '칠한 그림이 복사됩니다 → 채팅 칸에 ⌘V → 오른쪽 아래 「② 지시문 복사」 → 답 그림을 복사해 공방에서 ⌘V. ' : ''}결과는 왼쪽 「AI 도구」에 후보로 와요 — 누르면 이 사진이 바뀝니다(원본은 남아요).</p></div></div>`, 'wide');
    const st = d.querySelector('#amkStage'), ring = st.querySelector('.amk-ring'); base.className = 'amk-base'; mask.className = 'amk-mask'; st.prepend(base, mask); st.style.aspectRatio = W + ' / ' + H; st.style.width = `min(100%, calc(60vh * ${(W / H).toFixed(4)}))`;
    const pt = e => { const r = mask.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    const showRing = e => { const r = mask.getBoundingClientRect(), k = r.width / W, sz = brush * k; ring.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX - r.left - sz / 2}px;top:${e.clientY - r.top - sz / 2}px;display:block`; };
    const dot = (a, b) => { mg.globalCompositeOperation = erase ? 'destination-out' : 'source-over'; mg.strokeStyle = mg.fillStyle = '#FF00FF'; mg.lineWidth = brush; mg.lineCap = mg.lineJoin = 'round'; mg.beginPath(); if (a) { mg.moveTo(a[0], a[1]); mg.lineTo(b[0], b[1]); mg.stroke(); } else { mg.arc(b[0], b[1], brush / 2, 0, Math.PI * 2); mg.fill(); } };
    mask.onpointerdown = e => { e.preventDefault(); mask.setPointerCapture(e.pointerId); undo.push(mg.getImageData(0, 0, W, H)); if (undo.length > 20) undo.shift(); down = true; last = pt(e); dot(null, last); };
    mask.onpointermove = e => { showRing(e); if (!down) return; const p = pt(e); dot(last, p); last = p; };
    mask.onpointerup = mask.onpointercancel = () => { down = false; }; mask.onpointerleave = () => { ring.style.display = 'none'; };
    d.querySelector('#amkSize').oninput = e => { brush = Number(e.target.value); };
    d.onclick = e => { const f = e.target.closest('[data-mkf]'); if (f) { const ta = d.querySelector('#amkHow'); ta.value = FIXES[Number(f.dataset.mkf)][1]; ta.focus(); return; }
      const b = e.target.closest('[data-mk]'); if (!b) return; const k = b.dataset.mk;
      if (k === 'paint' || k === 'erase') { erase = k === 'erase'; d.querySelectorAll('[data-mk=paint],[data-mk=erase]').forEach(x => x.classList.toggle('on', x === b)); }
      if (k === 'undo') { const u = undo.pop(); if (u) mg.putImageData(u, 0, 0); }
      if (k === 'clear') { undo.push(mg.getImageData(0, 0, W, H)); mg.clearRect(0, 0, W, H); }
      if (k === 'go') { const how = d.querySelector('#amkHow').value.trim(); if (!painted(mask)) { B.toast('바꿀 곳을 먼저 붓으로 칠해 주세요', true); return; } if (!how) { B.toast('칠한 곳을 어떻게 바꿀지 골라 주거나 써 주세요', true); d.querySelector('#amkHow').focus(); return; }
        const marked = mkC(W, H), g = marked.getContext('2d'); g.drawImage(base, 0, 0); g.drawImage(mask, 0, 0); const keepMask = mkC(W, H); keepMask.getContext('2d').drawImage(mask, 0, 0);
        const post = async u => { const fb = await workCanvas(src, 3000), mk = mkC(fb.width, fb.height); mk.getContext('2d').drawImage(keepMask, 0, 0, fb.width, fb.height); return blendMasked(fb, u, mk, Math.max(3, Math.round(fb.width / 150))); };
        d.close(); fixJob({ label: '🖌 칠한 곳 바꾸기', el, ref: marked.toDataURL('image/png'), prompt: P.mask(how), aspect: nearAspect(W / H)[0], post });
      } };
  }

  /* ② 사진 넓히기 (바깥을 AI가 채움 · 원래 사진은 그대로 가운데에) */
  const SHAPES = [['wide', '▭ 가로 16:9', 16 / 9], ['sq', '▢ 정사각', 1], ['tall', '▯ 세로 3:4', 3 / 4], ['story', '📱 세로 9:16', 9 / 16], ['more', '⤢ 사방으로 조금', 0]];
  async function openExpand(el) {
    const src = B.src(el.src); let base; try { base = await workCanvas(src, 1024); } catch (e) { B.toast(e.message, true); return; }
    const w = base.width, h = base.height, r0 = w / h; let shape = r0 < 1.6 ? 'wide' : 'more', anc = 'c';
    const lay = () => { const sh = SHAPES.find(x => x[0] === shape); let R = sh[2], NW, NH; if (!R) { R = nearAspect(r0)[1]; NW = w * 1.3; NH = h * 1.3; if (NW / NH > R) NH = NW / R; else NW = NH * R; } else if (R > r0) { NW = h * R; NH = h; } else { NW = w; NH = w / R; }
      NW = Math.round(NW); NH = Math.round(NH); const fx = !sh[2] || anc === 'c' ? 0.5 : anc === 's' ? 0 : 1, ox = Math.round((NW - w) * fx), oy = Math.round((NH - h) * fx);
      return { NW, NH, ox, oy, aspect: nearAspect(NW / NH)[0], same: NW - w < w * 0.03 && NH - h < h * 0.03, horiz: NW - w > NH - h, fixed: !!sh[2] }; };
    const d = aiDlg('dlgAiExpand', '↔ 사진 넓히기 <small>원래 사진은 그대로 두고 바깥만 AI가 이어 그려요</small>', `<div class="aimk-b"><div class="aimk-st"><canvas id="aexPv" class="aex-pv"></canvas><p class="hint" id="aexInfo"></p></div>
      <div class="aimk-side"><div class="ais-lb">① 어떤 모양으로?</div><div class="ais-row" id="aexShapes"></div><div class="ais-lb" id="aexAncL">② 원래 사진 자리</div><div class="ais-row" id="aexAnc"></div>
      <button class="btn primary full" data-ex="go" style="margin-top:14px">${chat() ? '📋 그림 복사하고 시작' : '✨ 넓히기'}</button>
      <p class="hint">빗금 친 곳을 AI가 채웁니다. ${chat() ? '그림이 복사됩니다 → 채팅에 ⌘V → 「② 지시문 복사」 → 답 그림을 복사해 공방에서 ⌘V. ' : ''}결과를 누르면 이 사진이 넓어지고, 사진 틀도 그만큼 커져요(원본은 남아요).</p></div></div>`, 'wide');
    const pv = d.querySelector('#aexPv');
    const draw = () => { const L = lay(), k = Math.min(520 / L.NW, 360 / L.NH); pv.width = Math.round(L.NW * k); pv.height = Math.round(L.NH * k); const g = pv.getContext('2d'); g.fillStyle = '#eef1f7'; g.fillRect(0, 0, pv.width, pv.height); g.strokeStyle = '#c6cede'; g.lineWidth = 1; for (let x = -pv.height; x < pv.width; x += 10) { g.beginPath(); g.moveTo(x, pv.height); g.lineTo(x + pv.height, 0); g.stroke(); } g.fillStyle = '#fff'; g.fillRect(L.ox * k, L.oy * k, w * k, h * k); g.drawImage(base, L.ox * k, L.oy * k, w * k, h * k); g.strokeStyle = '#2f5bea'; g.lineWidth = 2; g.strokeRect(L.ox * k + 1, L.oy * k + 1, w * k - 2, h * k - 2);
      d.querySelector('#aexShapes').innerHTML = SHAPES.map(([k2, t]) => `<button class="ais-s${shape === k2 ? ' on' : ''}" data-exs="${k2}">${t}</button>`).join('');
      const A = L.horiz ? [['s', '◧ 왼쪽'], ['c', '가운데'], ['e', '◨ 오른쪽']] : [['s', '⬒ 위'], ['c', '가운데'], ['e', '⬓ 아래']]; d.querySelector('#aexAnc').innerHTML = L.fixed && !L.same ? A.map(([k2, t]) => `<button class="ais-s${anc === k2 ? ' on' : ''}" data-exa="${k2}">${t}</button>`).join('') : '<small class="hint">가운데</small>';
      d.querySelector('#aexInfo').textContent = L.same ? '이미 이 모양이에요 — 「⤢ 사방으로 조금」을 고르면 둘레를 넓힙니다.' : `${w}×${h} → ${L.NW}×${L.NH} (${L.aspect})`; };
    draw();
    d.onclick = e => { const s1 = e.target.closest('[data-exs]'); if (s1) { shape = s1.dataset.exs; draw(); return; } const s2 = e.target.closest('[data-exa]'); if (s2) { anc = s2.dataset.exa; draw(); return; }
      if (!e.target.closest('[data-ex=go]')) return; const L = lay(); if (L.same) { B.toast('이미 이 모양이에요 — 다른 모양이나 「사방으로 조금」을 고르세요', true); return; }
      const pad = mkC(L.NW, L.NH), g = pad.getContext('2d'); g.fillStyle = '#FF00FF'; g.fillRect(0, 0, L.NW, L.NH); g.drawImage(base, L.ox, L.oy);
      const post = async u => { const fb = await workCanvas(src, 2400), s = fb.width / w, OW = Math.round(L.NW * s), OH = Math.round(L.NH * s), o = mkC(OW, OH), og = o.getContext('2d'), img = await AI.loadImg(u); fitInto(og, img, OW, OH);
        /* 원래 사진을 다시 얹되, 새로 생긴 쪽 경계만 부드럽게 */
        const f = Math.max(4, Math.round(Math.max(OW, OH) / 120)), x0 = L.ox * s, y0 = L.oy * s, x1 = x0 + fb.width, y1 = y0 + fb.height, m = mkC(OW, OH), mg = m.getContext('2d'); mg.filter = `blur(${f / 2}px)`; mg.fillStyle = '#000';
        mg.fillRect(x0 < 1 ? -f * 3 : x0 + f, y0 < 1 ? -f * 3 : y0 + f, (x1 > OW - 1 ? OW + f * 3 : x1 - f) - (x0 < 1 ? -f * 3 : x0 + f), (y1 > OH - 1 ? OH + f * 3 : y1 - f) - (y0 < 1 ? -f * 3 : y0 + f));
        const lay2 = mkC(OW, OH), lg = lay2.getContext('2d'); lg.drawImage(fb, x0, y0); lg.globalCompositeOperation = 'destination-in'; lg.drawImage(m, 0, 0); og.drawImage(lay2, 0, 0); return o.toDataURL('image/png'); };
      d.close(); fixJob({ label: '↔ 사진 넓히기', el, ref: pad.toDataURL('image/png'), prompt: P.expand(), aspect: L.aspect, post, box: { l: L.ox / w, t: L.oy / h, r: (L.NW - w - L.ox) / w, b: (L.NH - h - L.oy) / h } }); };
  }

  /* ③ 더 정확한 배경 지우기 — 가장자리 색(흰색만이 아니라 단색 배경 무엇이든)을 찾아 이어진 곳만 지우고, 경계는 배경색을 빼서 번짐 없이 */
  function borderColors(d, W, H) { const cnt = new Map(), add = i => { if (d[i * 4 + 3] < 8) return; const k = (d[i * 4] >> 4) << 8 | (d[i * 4 + 1] >> 4) << 4 | (d[i * 4 + 2] >> 4); const v = cnt.get(k) || [0, 0, 0, 0]; v[0]++; v[1] += d[i * 4]; v[2] += d[i * 4 + 1]; v[3] += d[i * 4 + 2]; cnt.set(k, v); }; let n = 0;
    for (let x = 0; x < W; x++) { add(x); add((H - 1) * W + x); n += 2; } for (let y = 1; y < H - 1; y++) { add(y * W); add(y * W + W - 1); n += 2; }
    return [...cnt.values()].sort((a, b) => b[0] - a[0]).filter((v, i) => i === 0 ? v[0] > n * 0.08 : v[0] > n * 0.12).slice(0, 3).map(v => [v[1] / v[0], v[2] / v[0], v[3] / v[0]].map(Math.round)); }
  function keyOut(d, W, H, o) { /* o: {cols, tol, soft, seeds:[{i,c}], keyAll} */
    const N = W * H, gone = new Uint8Array(N), all = o.cols.concat((o.seeds || []).map(s => s.c));
    const dist = (i, c) => { const r = d[i * 4] - c[0], g = d[i * 4 + 1] - c[1], b = d[i * 4 + 2] - c[2]; return Math.sqrt((2 * r * r + 4 * g * g + 3 * b * b) / 9); };
    const near = (i, cs) => { let m = 1e9, best = null; for (const c of cs) { const v = dist(i, c); if (v < m) { m = v; best = c; } } return [m, best]; };
    const flood = (starts, cs) => { const seen = new Uint8Array(N), stk = starts.slice(); while (stk.length) { const i = stk.pop(); if (seen[i]) continue; seen[i] = 1; if (!(gone[i] || d[i * 4 + 3] < 8 || near(i, cs)[0] < o.tol)) continue; gone[i] = 1; const x = i % W; if (x > 0) stk.push(i - 1); if (x < W - 1) stk.push(i + 1); if (i >= W) stk.push(i - W); if (i < N - W) stk.push(i + W); } };
    if (o.cols.length) { const b = []; for (let x = 0; x < W; x++) b.push(x, N - W + x); for (let y = 0; y < H; y++) b.push(y * W, y * W + W - 1); flood(b, o.cols); }
    if (o.keyAll) for (let i = 0; i < N; i++) if (near(i, o.cols)[0] < o.keyAll) gone[i] = 1;
    (o.seeds || []).forEach(s => flood([s.i], [s.c]));
    /* 경계 띠(soft 픽셀): 배경색에 가까운 만큼 비치게 + 배경색 빼기 */
    let band = gone; const soft = Math.max(0, o.soft | 0);
    for (let k = 0; k < soft; k++) { const nb = new Uint8Array(N); for (let i = 0; i < N; i++) { if (band[i]) continue; const x = i % W; if ((x > 0 && band[i - 1]) || (x < W - 1 && band[i + 1]) || (i >= W && band[i - W]) || (i < N - W && band[i + W])) nb[i] = 2; }
      for (let i = 0; i < N; i++) if (nb[i] === 2) { const [v, c] = near(i, all); const a = Math.max(0, Math.min(1, (v - o.tol * 0.5) / (o.tol * 1.3))); if (a < 1 && c) { const A = Math.max(a, 0.02); for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = Math.max(0, Math.min(255, Math.round((d[i * 4 + ch] - (1 - A) * c[ch]) / A))); } d[i * 4 + 3] = Math.round(d[i * 4 + 3] * a); }
      const merged = new Uint8Array(N); for (let i = 0; i < N; i++) merged[i] = band[i] || nb[i] ? 1 : 0; band = merged; }
    for (let i = 0; i < N; i++) if (gone[i]) d[i * 4 + 3] = 0;
    return gone; }
  async function openBg(el) {
    const src = B.src(el.src); let base; try { base = await workCanvas(src, 1600); } catch (e) { B.toast(e.message, true); return; }
    const W = base.width, H = base.height, bd = base.getContext('2d').getImageData(0, 0, W, H), cols = borderColors(bd.data, W, H); let tol = 42, soft = 2, seeds = [], tmr = 0;
    const sw = cols.map(c => `<i class="abg-sw" style="background:rgb(${c.join(',')})"></i>`).join('');
    const d = aiDlg('dlgAiBg', '🧽 배경 지우기 <small>이 PC에서 바로 · 사진이 밖으로 나가지 않아요</small>', `<div class="aimk-b"><div class="aimk-st"><div class="aimk-cv abg-cv" id="abgStage"></div><p class="hint">남은 배경(팔 사이 등)을 <b>누르면</b> 그 색도 지워요.</p></div>
      <div class="aimk-side"><div class="ais-lb">지울 배경 색</div><div>${sw || '<small class="hint">가장자리가 이미 비어 있어요 — 남은 곳을 눌러 지우세요</small>'}</div>
      <label class="aimk-sl">지우는 정도 <input type="range" id="abgTol" min="8" max="140" value="${tol}"></label><label class="aimk-sl">경계 부드럽게 <input type="range" id="abgSoft" min="0" max="4" value="${soft}"></label>
      <div class="ais-row"><button class="ais-s" data-bg="undo">↶ 누른 곳 취소</button><button class="ais-s" data-bg="reset">처음대로</button></div>
      <button class="btn primary full" data-bg="ok" style="margin-top:12px">✔ 이대로 적용</button>
      <div class="ais-lb" style="margin-top:16px">사진 배경이 복잡하면</div><button class="btn full" data-bg="ai">🤖 AI로 정확하게 지우기</button><p class="hint">AI가 배경만 초록으로 바꿔 주면, 이 PC에서 초록을 지워 깔끔하게 오려 냅니다. 결과는 「AI 도구」 후보로 — 누르면 바뀌어요.</p></div></div>`, 'wide');
    const st = d.querySelector('#abgStage'), pc = mkC(W, H); st.appendChild(pc); st.style.aspectRatio = W + ' / ' + H; st.style.width = `min(100%, calc(60vh * ${(W / H).toFixed(4)}))`;
    const run = () => { const id = new ImageData(new Uint8ClampedArray(bd.data), W, H); keyOut(id.data, W, H, { cols, tol, soft, seeds }); pc.getContext('2d').putImageData(id, 0, 0); };
    const later = () => { clearTimeout(tmr); tmr = setTimeout(run, 90); }; run();
    d.querySelector('#abgTol').oninput = e => { tol = Number(e.target.value); later(); }; d.querySelector('#abgSoft').oninput = e => { soft = Number(e.target.value); later(); };
    pc.onclick = e => { const r = pc.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) * W / r.width), y = Math.floor((e.clientY - r.top) * H / r.height), i = y * W + x; if (i < 0 || i >= W * H) return; seeds.push({ i, c: [bd.data[i * 4], bd.data[i * 4 + 1], bd.data[i * 4 + 2]] }); run(); };
    d.onclick = e => { const b = e.target.closest('[data-bg]'); if (!b) return; const k = b.dataset.bg;
      if (k === 'undo') { seeds.pop(); run(); } if (k === 'reset') { seeds = []; tol = 42; soft = 2; d.querySelector('#abgTol').value = tol; d.querySelector('#abgSoft').value = soft; run(); }
      if (k === 'ok') { clearTimeout(tmr); run(); if (!B.replaceImg(el.id, pc.toDataURL('image/png'))) { B.toast('사진을 찾지 못했습니다', true); return; } d.close(); B.toast('배경을 지웠습니다 — 되돌리기는 Ctrl+Z · 사진 ✨ AI → 원본으로'); }
      if (k === 'ai') { d.close(); fixJob({ label: '🤖 배경 정확히 지우기', el, ref: src, prompt: P.green(), aspect: nearAspect(W / H)[0], post: async u => { const img = await AI.loadImg(u), c = mkC(W, H), g = c.getContext('2d'); fitInto(g, img, W, H); const id = g.getImageData(0, 0, W, H); keyOut(id.data, W, H, { cols: [[0, 255, 0]].concat(borderColors(id.data, W, H)), tol: 80, soft: 2, keyAll: 36 }); for (let i = 0; i < W * H; i++) if (id.data[i * 4 + 3] > 0 && id.data[i * 4 + 3] < 255) { const p = i * 4, m = Math.max(id.data[p], id.data[p + 2]); if (id.data[p + 1] > m) id.data[p + 1] = m; } g.putImageData(id, 0, 0); return c.toDataURL('image/png'); } }); } };
  }

  /* ④ 내 AI 결과함 — 만든 그림·스티커·아이콘·배경·고친 사진을 이 PC 브라우저에 모아 둠(최근 80개, 문서가 바뀌어도 다시 넣기) */
  const RB = (() => { let dbp = null; const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('naracha-ai', 1); r.onupgradeneeded = () => r.result.createObjectStore('res', { keyPath: 'id' }); r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); dbp = null; }; res(db); }; r.onerror = () => { dbp = null; rej(r.error); }; }));
    const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('res', mode), q = fn(t.objectStore('res')); let out; if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error); }); };
    return { all: () => tx('readonly', s => s.getAll()), put: v => tx('readwrite', s => s.put(v)), del: id => tx('readwrite', s => s.delete(id)), clear: () => tx('readwrite', s => s.clear()) }; })();
  const BOXMAX = 80, BOXF = [['', '전체'], ['img', '그림'], ['sticker', '스티커'], ['icon', '아이콘'], ['pptbg', '배경'], ['fix', '고친 사진']];
  let boxLoading = null;
  /* 11/24 결과함을 구글 드라이브(동기화 폴더 「AI 결과함」)에도 — 두 PC에서 같이 봄 (전문가 [중] 후보). 폴더를 연결하지 않았으면 이 브라우저에만 */
  const BOXI = { img: '그림', sticker: '스티커', icon: '아이콘', pptbg: '배경', fix: '고친 사진' }, BOXK = Object.fromEntries(Object.entries(BOXI).map(([k, v]) => [v, k]));
  const boxName = it => { const d = new Date(it.t), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())} ${BOXI[it.intent] || '그림'} ${String(it.label || '').replace(/[\\/:*?"<>|\n]/g, ' ').slice(0, 40).trim()}`.trim() + '.png'; };
  const driveOK = async () => { try { return !!(B && B.drive && await B.drive.ready()); } catch (e) { return false; } };
  async function boxToDrive(it) { if (!(await driveOK())) return; try { const nm = await B.drive.write(it.blob, boxName(it)); if (nm) { it.fname = nm; await RB.put(Object.assign({}, it, { url: undefined })); } } catch (e) { } }
  async function driveItems(have) { if (!(await driveOK())) return []; let L = []; try { L = await B.drive.list(); } catch (e) { return []; } const out = [];
    for (const f of L) { if (!/\.(png|jpe?g|webp)$/i.test(f.name) || have.has(f.name)) continue; const m = f.name.match(/^\d{8}-\d{6} (\S+) ?(.*)\.\w+$/); try { const blob = await f.handle.getFile(); out.push({ id: 'd:' + f.name, t: f.lastModified, intent: m ? BOXK[m[1]] || 'img' : 'img', label: m ? m[2] : f.name, blob, fname: f.name, handle: f.handle, fromDrive: true }); } catch (e) { } } return out; }
  function loadBox() { if (boxLoading) return boxLoading; boxLoading = RB.all().then(async L => { L = L || []; S.boxDrive = await driveOK(); const have = new Set(L.map(x => x.fname).filter(Boolean)); const D = await driveItems(have);
      /* 이 PC에서 만들었지만 폴더에 아직 안 올라간 것(폴더 연결 전에 만든 것)은 지금 올림 */ if (await driveOK()) for (const x of L) if (!x.fname) boxToDrive(x);
      S.box = L.concat(D).sort((a, b) => b.t - a.t).slice(0, BOXMAX * 2).map(x => Object.assign({ url: URL.createObjectURL(x.blob) }, x)); }).catch(() => { S.box = []; }).then(() => { if (B && B.sideIs('ai')) B.renderSide(); }); return boxLoading; }
  async function boxTrash(x) { if (!(await driveOK())) return; try { let h = x.handle; if (!h) { const L = await B.drive.list(); const f = L.find(q => q.name === x.fname); h = f && f.handle; } if (h) await B.drive.trash(h); } catch (e) { } }
  function reloadBox() { (S.box || []).forEach(x => URL.revokeObjectURL(x.url)); S.box = null; boxLoading = null; return loadBox(); }
  const keepQ = []; let keeping = false;
  function keep(src, intent, label) { keepQ.push([src, intent, label]); if (!keeping) drainKeep(); }
  async function drainKeep() { keeping = true; while (keepQ.length) { const [src, intent, label] = keepQ.shift(); try { const blob = await (await fetch(src)).blob(), it = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), t: Date.now(), intent, label: String(label || '').slice(0, 80), blob }; await RB.put(it); boxToDrive(it); if (!S.box) await loadBox(); else S.box.unshift(Object.assign({ url: URL.createObjectURL(blob) }, it));
        if (S.box.length > BOXMAX) { const old = S.box.splice(BOXMAX); for (const o of old) { try { await RB.del(o.id); } catch (e) {} URL.revokeObjectURL(o.url); } } } catch (e) { /* 결과함은 보조 — 실패해도 작업은 계속 */ } } keeping = false; }
  async function boxInsert(id, asBg) { const x = (S.box || []).find(q => q.id === id); if (!x) return; const u = await fileToURL(x.blob); await B.insertImage(u, { asBg: asBg || x.intent === 'pptbg', name: x.intent === 'icon' ? 'AI 아이콘' : x.intent === 'sticker' ? 'AI 스티커' : x.intent === 'pptbg' ? 'AI 배경' : 'AI 그림', small: x.intent === 'icon' }); }
  function boxHTML() { const L = S.box, list = (L || []).filter(x => !S.boxF || x.intent === S.boxF);
    return `<details class="ais-box"${S.boxOpen ? ' open' : ''}><summary>📦 내 AI 결과함 <small>${L ? L.length + '개' : ''} · ${S.boxDrive ? '구글 드라이브 「AI 결과함」 폴더에도 보관 (두 PC 같이)' : '이 PC 브라우저에 보관 (동기화 폴더를 연결하면 두 PC에서 같이)'}</small></summary>${!L ? '<p class="hint">불러오는 중…</p>' : !L.length ? '<p class="hint">AI로 만든 그림·스티커·아이콘·배경·고친 사진이 여기에 모여요(최근 80개). 다른 문서에서도 눌러서 다시 넣을 수 있어요.</p>'
      : `<div class="ais-row" style="margin:6px 0">${BOXF.map(([k, t]) => `<button class="ais-s${S.boxF === k ? ' on' : ''}" data-abf="${k}">${t}</button>`).join('')}</div>${list.length ? `<div class="ais-cards">${list.map(x => `<div class="ais-bx${x.intent === 'pptbg' ? ' wide' : ''}"><button class="ais-card" data-abx="${x.id}" title="${esc(x.label || '')} — 누르면 넣기 · Shift+누르기 = 배경으로"><img src="${x.url}" alt="" loading="lazy"></button><button class="ajx" data-abd="${x.id}" title="결과함에서 빼기">×</button></div>`).join('')}</div>` : '<p class="hint">이 종류는 아직 없어요.</p>'}<div class="ais-row" style="margin-top:8px"><button class="btn sm" data-aact="boxclr">결과함 비우기</button></div>`}</details>`; }

  /* ⑤ 발표자료 개요 직접 고치기 — 줄을 누르면 종류·제목·내용·메모를 고치고, 순서 바꾸기·빼기·더하기 */
  const OTYPES = ['cover', 'agenda', 'section', 'content', 'two', 'numbers', 'timeline', 'quote', 'cards3', 'statement', 'photo', 'gallery', 'closing'];
  const tyName = t => (NC.tpl.presKinds || {})[t === 'two' ? 'twocol' : t] || t;
  const LHINT = { numbers: '한 줄에 「숫자 | 설명」 — 예: 120명 | 함께하는 수련생', timeline: '한 줄에 「언제 | 무엇」 — 예: 10:00 | 개회식', quote: '첫 줄 = 말, 둘째 줄 = 누가', two: '왼쪽 줄들 → --- → 오른쪽 줄들 (각 첫 줄은 소제목)', cover: '첫 줄 = 부제목, 둘째 줄 = 아래 작은 글', cards3: '한 줄에 「제목 | 설명」 세 줄 (맨 앞에 이모지를 쓰면 동그라미 안에)', statement: '제목 칸 = 크게 쓸 한 문장, 첫 줄 = 덧붙임', photo: '사진 옆 짧은 설명 (사진은 만든 뒤 눌러서 바꾸기)', section: '첫 줄 = 부제목', closing: '첫 줄 = 아래 작은 글' };
  function linesOf(s) { const b = s.bullets || []; if (s.type === 'numbers') return (s.numbers || []).map(x => `${x.v || ''} | ${x.l || ''}`).join('\n'); if (s.type === 'timeline') return (s.steps || []).map(x => `${x.when || ''} | ${x.what || ''}`).join('\n'); if (s.type === 'cards3') return (s.cards && s.cards.length ? s.cards : b.map(x => ({ h: x, t: '' }))).map(x => `${x.ic && !/^\d$/.test(x.ic) ? x.ic + ' ' : ''}${x.h || ''} | ${x.t || ''}`).join('\n'); if (s.type === 'quote') return [(s.quote || {}).text || '', (s.quote || {}).by || ''].join('\n').trim();
    if (s.type === 'two') { const L = s.left && s.left.length ? s.left : b.slice(0, 2), R = s.right && s.right.length ? s.right : b.slice(2); return [...L, '---', ...R].join('\n'); } return b.join('\n'); }
  function setLines(s, t) { const L = String(t).split('\n').map(x => x.trim()), ne = L.filter(Boolean), pair = x => { const k = x.indexOf('|'); return k < 0 ? [x, ''] : [x.slice(0, k).trim(), x.slice(k + 1).trim()]; };
    if (s.type === 'numbers') s.numbers = ne.map(x => { const [v, l] = pair(x); return { v, l }; }); else if (s.type === 'timeline') s.steps = ne.map(x => { const [when, what] = pair(x); return { when, what }; });
    else if (s.type === 'cards3') s.cards = ne.map(x => { let [hh, tt] = pair(x); const m = hh.match(/^(\p{Extended_Pictographic}\uFE0F?)\s*/u); return { ic: m ? m[1] : '', h: m ? hh.slice(m[0].length) : hh, t: tt.replace(/\s*\/\s*/g, '\n') }; });
    else if (s.type === 'quote') s.quote = { text: ne[0] || '', by: ne[1] || '' }; else if (s.type === 'two') { const k = L.indexOf('---'); s.left = (k < 0 ? L : L.slice(0, k)).filter(Boolean); s.right = k < 0 ? [] : L.slice(k + 1).filter(Boolean); } else s.bullets = ne; }
  function outlineHTML(o) { const E = S.deck.edit;
    return `<ol class="ais-ol">${o.slides.map((s, i) => `<li class="${E === i ? 'on' : ''}"><div class="ais-olr" data-ale="${i}" title="누르면 고치기"><em>${esc(tyName(s.type))}</em><span class="ais-olt">${esc(s.title || '(제목 없음)')}</span><span class="ais-oa"><button data-alm="up" data-ali="${i}" title="위로"${i ? '' : ' disabled'}>↑</button><button data-alm="dn" data-ali="${i}" title="아래로"${i < o.slides.length - 1 ? '' : ' disabled'}>↓</button><button data-alm="del" data-ali="${i}" title="이 쪽 빼기">🗑</button></span></div>${E === i ? `<div class="ais-oe"><select data-alf="type">${OTYPES.map(t => `<option value="${t}"${s.type === t ? ' selected' : ''}>${esc(tyName(t))}</option>`).join('')}</select><input data-alf="title" value="${esc(s.title || '')}" placeholder="제목 (18자 안쪽이 보기 좋아요)"><textarea data-alf="lines" rows="4" placeholder="${esc(LHINT[s.type] || '한 줄에 하나씩 (4줄까지)')}">${esc(linesOf(s))}</textarea><small class="hint">${esc(LHINT[s.type] || '한 줄에 하나씩 (4줄까지)')}</small><textarea data-alf="notes" rows="2" placeholder="발표자 메모 (발표 화면·PowerPoint 메모에 들어가요)">${esc(s.notes || '')}</textarea></div>` : ''}</li>`).join('')}</ol><button class="btn sm" data-aact="sladd" style="margin-top:6px">＋ 쪽 더하기</button>`; }
  function selfOutline() { const t = (S.prompt || '').trim().split('\n')[0].slice(0, 30) || '발표 제목', n = Math.max(4, S.deck.n), sl = [{ type: 'cover', title: t, bullets: [] }, { type: 'agenda', title: '오늘의 순서', bullets: ['', '', ''] }]; for (let i = 0; i < n - 3; i++) sl.push({ type: 'content', title: `내용 ${i + 1}`, bullets: [] }); sl.push({ type: 'closing', title: '감사합니다', bullets: [] }); S.deck.outline = { title: t, slides: sl }; S.deck.edit = 0; }

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
      <button class="ais-s" data-pim="bg">🧽 배경 지우기 <small>이 PC에서 바로 · 정도 조절</small></button>
      <button class="ais-s" data-pim="mask">🖌 칠한 곳만 바꾸기 <small>AI · 나머지는 그대로</small></button>
      <button class="ais-s" data-pim="expand">↔ 사진 넓히기 <small>AI가 바깥을 이어 그림</small></button>
      <button class="ais-s" data-pim="vary">🎲 비슷하게 새로 그리기</button>
      <label class="aip-ed"><input type="text" id="aipEdit" placeholder="이렇게 바꿔 주세요 — 예: 배경을 파란 하늘로"><button class="btn sm primary" data-pim="edit">바꾸기</button></label>
      ${el.orig ? '<button class="ais-s" data-pim="orig">↩ 원본으로</button>' : ''}<button class="ais-s" data-pim="tool">🖌 이미지 편집기 (지우개·자르기)</button></div><p class="hint" style="margin:6px 2px 0">결과는 왼쪽 「AI 도구」에 후보로 — 누르면 넣기. 원본은 남아요.</p>`;
    p.onclick = async e => { if (e.target.closest('[data-pc]')) { close(); return; } const b = e.target.closest('[data-pim]'); if (!b) return; const k = b.dataset.pim;
      if (k === 'tool') { close(); B.imgEditorSel(); return; }
      if (k === 'orig') { el.src = el.orig; if (el.origBox) Object.assign(el, el.origBox); delete el.orig; delete el.origBox; B.commit(); B.rerender(); close(); B.toast('원본으로 되돌렸습니다'); return; }
      if (k === 'bg') { close(); openBg(el); return; } if (k === 'mask') { close(); openMask(el); return; } if (k === 'expand') { close(); openExpand(el); return; }
      const how = k === 'edit' ? (($('#aipEdit') || {}).value || '').trim() : ''; if (k === 'edit' && !how) { B.toast('어떻게 바꿀지 써 주세요', true); return; }
      close(); S.intent = 'img'; jobStart({ label: k === 'vary' ? '🎲 비슷하게' : '🖼 사진 바꾸기', expect: 'image', ref: src, prompt: k === 'vary' ? P.vary() : P.edit(how), aspect: '1:1', onPart: u => addCards([u], 'img', 'img'), onDone: r => { if (chat()) addCards(r, 'img', 'img'); B.goSide('ai'); } }); B.goSide('ai'); };
  }

  NC.aiStudio = { init(bridge) { B = bridge; }, renderPanel, rewriteMenu, imageMenu, buildDeck, fenced, cleanSvg, sliceGrid, ingest, state: S, openMask, openExpand, openBg, keyOut, borderColors, loadBox, reloadBox, keep, linesOf, setLines };
})();
