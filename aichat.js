// AI 도우미 채팅창 (오른쪽 속성 자리) — 2026-11-19 팀장님 요청: Claude API 또는 Gemini API로 대화하며 공방을 함께 쓰기.
// 대화하며 지금 문서를 읽고(글·도형·그림·쪽), 직접 고치고(도구), 공방 기능 창을 열고, 매뉴얼로 사용법을 답합니다.
// 키는 AI 설정과 같은 곳(AI.cfg — 이 브라우저 + 동기화 폴더 설정 파일). 문서 내용은 고른 AI 회사(Anthropic·Google)로만 보냅니다.
// app.js가 NC.aichat.init(bridge)로 문서·편집 함수를 넘겨 줍니다.
(function () {
  const NC = window.NC = window.NC || {};
  const LS = 'naracal-aichat-v1';
  const CLAUDE_MODELS = [['claude-opus-5-5', 'Claude Opus 5.5 (기본 · 가장 똑똑함)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (빠름 · 절반 값)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (가장 빠름 · 아주 쌈)']];
  const MAX_LOOP = 14, MAX_MSGS = 80;
  let B = null, busy = false, aborter = null;
  const S = Object.assign({ prov: 'claude', claudeModel: 'claude-opus-5-5', geminiModel: '', sendPage: false, log: [] }, (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } })());
  if (!Array.isArray(S.log)) S.log = [];
  let api = []; /* 지금 대화의 AI 회사 형식 기록 — 덧붙이기만 함(Claude 생각 블록을 그대로 돌려보내야 해서 고치지 않음). 새로 고침하면 새 대화 */
  let apiProv = null;
  if (S.gemV !== 2) { S.gemV = 2; S.geminiModel = ''; S.gemAuto = null; }  /* 예전 판은 자동으로 고른 모델을 '직접 적은 모델' 칸에 넣어 둠 → 한 번 비워 자동 고르기·바쁠 때 바꾸기가 되게 (11/20) */
  function save() { try { localStorage.setItem(LS, JSON.stringify(Object.assign({}, S, { log: S.log.slice(-60) }))); } catch (e) {} }
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r1 = v => Math.round(v * 10) / 10;
  const cfg = () => window.AI.cfg;
  const keyOf = p => (p === 'gemini' ? cfg().geminiKey : cfg().anthropicKey) || '';

  /* ---------- 매뉴얼을 짧은 글로 (사용법 질문에 답할 때) ---------- */
  function manualText() {
    const M = window.NC_MANUAL || []; let s = '';
    M.forEach(t => { s += `## ${t.title}${t.when ? ` (${t.when})` : ''}\n`; (t.steps || []).forEach((x, i) => { s += `${i + 1}. ${x.t}: ${String(x.d || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ')}\n`; }); });
    return s;
  }
  let SYS = null;
  function system() {
    if (SYS) return SYS;
    SYS = `당신은 '나라차 디자인 공방'(태권도장 나라차태권도가 쓰는 웹 디자인 프로그램) 안의 AI 도우미입니다. 화면 오른쪽 채팅창에서 팀장님·사범님과 대화하며 디자인을 함께 만듭니다.

# 말하는 방식
- 사용자는 컴퓨터 초보입니다. 언제나 한국어로, 쉬운 말로, 짧게(보통 2~5문장) 답합니다. 영어·코드·전문 용어를 쓰지 않습니다(꼭 필요하면 쉬운 말로 풀어 씁니다).
- 버튼·메뉴 이름은 화면에 보이는 그대로 「」로 적습니다. 예: 「다운로드」, 「⋯ 더보기 → 크기 조정」.
- 디자인을 고친 뒤에는 무엇을 바꿨는지 한두 줄로 말하고, 마음에 안 들면 답 아래 「되돌리기」 단추(또는 Ctrl+Z)로 되돌릴 수 있다고 알려 줍니다(매번 길게 말할 필요는 없음).

# 할 수 있는 일 (도구)
- get_document로 지금 문서(크기·쪽·요소)를 먼저 읽고, 필요한 만큼만 고칩니다. 요소 id는 도구 결과에서 얻은 것만 씁니다.
- 디자인 평가·추천을 부탁받으면 see_page로 그 쪽 그림을 직접 보고 말합니다.
- 고치기: update_elements(글·위치·크기·색·글꼴), add_text, add_shape, delete_elements, arrange, set_background, add_page, go_to_page, select_elements.
- 공방 기능 창 열기: open_tool(템플릿·상장·출석부·캘린더·소식지·출력·다운로드·크기 조정·AI 그림 스튜디오 등). 출력·다운로드·파일 저장·새 문서처럼 되돌리기 어려운 일은 직접 하지 말고 창을 열어 사용자가 누르게 합니다.
- 템플릿: search_templates로 찾아 이름을 보여 주고, 원하면 open_template으로 미리 보기 창을 엽니다(만들기는 사용자가 누름).
- 그림: generate_image는 Gemini로 그림을 새로 만들어 쪽에 넣습니다(그림 한 장마다 요금이 듭니다 — 사용자가 그림을 원할 때만).

# 디자인 규칙
- 단위: 위치·크기는 mm(왼쪽 위가 0,0). 픽셀 문서(예: 800 × 1280 px 결제 단말기 화면)도 도구는 mm로 받습니다 — get_document가 알려 주는 px→mm 비율로 바꿔 씁니다. 글자 크기(size)는 pt입니다.
- 요소가 쪽 밖으로 나가지 않게, 인쇄물은 가장자리에서 5mm 이상 안쪽에 둡니다. 글이 상자보다 길면 상자(h)를 늘리거나 글자를 줄입니다.
- 나라차 색: 남색 #1E2B5A, 빨강 #E0564B, 노랑 #FFD34D. 마스코트는 펭귄 '라차'입니다. 도장 정보(이름·전화·주소)는 get_document의 dojang 값을 씁니다(지어내지 않음).
- 글꼴은 get_document의 fonts 목록에 있는 이름만 씁니다.
- 학생 이름·주소·사진 같은 개인정보는 지어내지 않고, 문서 밖으로 옮기지 않습니다. 상장·출석부 명단은 공방의 나라차 메뉴(관리프로그램 연동)로 만들게 안내합니다.
- 여러 요소를 지우거나 문서를 크게 바꾸기 전에는 한 번 물어봅니다.
- 할 수 없는 일(예: 인터넷 검색, 결제 단말기에 직접 올리기, 카톡 보내기)은 솔직히 못 한다고 하고, 사용자가 할 순서를 알려 줍니다.

# 공방 사용법 (매뉴얼 요약 — 사용법 질문은 이것을 바탕으로 답함)
${manualText()}`;
    return SYS;
  }

  /* ---------- 도구 정의 (Claude·Gemini 공용, JSON 스키마) ---------- */
  const N = (d) => ({ type: 'number', description: d });
  const STR = (d) => ({ type: 'string', description: d });
  const PROPS = {
    text: STR('글 내용 (줄바꿈은 \\n)'), x: N('왼쪽 위치 mm'), y: N('위쪽 위치 mm'), w: N('너비 mm'), h: N('높이 mm'), rot: N('회전 각도(도)'),
    font: STR('글꼴 이름 (fonts 목록에서)'), size: N('글자 크기 pt'), weight: N('굵기 100~900 (보통 400, 굵게 700)'), italic: { type: 'boolean', description: '기울임' },
    color: STR('글자 색 #RRGGBB'), align: { type: 'string', enum: ['left', 'center', 'right', 'justify'], description: '가로 정렬' }, valign: { type: 'string', enum: ['top', 'middle', 'bottom'], description: '세로 정렬' },
    lh: N('줄 간격 배수 (예 1.3)'), ls: N('글자 간격 (em, 예 -0.02)'), bg: STR('글 상자 바탕색 #RRGGBB (없애려면 빈 글)'),
    fill: STR('도형 채우기 색 #RRGGBB'), stroke: STR('도형 테두리 색 #RRGGBB (없애려면 빈 글)'), strokeW: N('도형 테두리 두께 mm'), radius: N('모서리 둥글기 mm'),
    opacity: N('불투명도 0~1'), name: STR('요소 이름(레이어에 보임)'),
  };
  const pick = (...ks) => Object.fromEntries(ks.map(k => [k, PROPS[k]]));
  const TOOLS = [
    { name: 'get_document', description: '지금 문서의 이름·크기·쪽 목록·지금 쪽의 요소(id·종류·글·위치·크기·색)·고른 요소·쓸 수 있는 글꼴·도장 정보를 읽습니다. 고치기 전에 먼저 부릅니다.', input_schema: { type: 'object', properties: {}, required: [] } },
    { name: 'get_page', description: '다른 쪽의 요소 목록을 읽습니다.', input_schema: { type: 'object', properties: { page: { type: 'integer', description: '쪽 번호 (화면에 보이는 번호)' } }, required: ['page'] } },
    { name: 'see_page', description: '쪽을 그림으로 그려서 봅니다(디자인 평가·배치 확인용). page를 비우면 지금 쪽.', input_schema: { type: 'object', properties: { page: { type: 'integer', description: '쪽 번호 (화면에 보이는 번호)' } }, required: [] } },
    { name: 'update_elements', description: '요소 여러 개의 글·위치·크기·색·글꼴 등을 한 번에 바꿉니다. 바꿀 항목만 적습니다. 모든 쪽의 id를 쓸 수 있습니다.', input_schema: { type: 'object', properties: { changes: { type: 'array', description: '바꿀 요소마다 하나', items: { type: 'object', properties: Object.assign({ id: STR('요소 id') }, PROPS), required: ['id'] } } }, required: ['changes'] } },
    { name: 'add_text', description: '지금 쪽(또는 page)에 글 상자를 넣습니다.', input_schema: { type: 'object', properties: Object.assign({ page: { type: 'integer', description: '쪽 번호 (비우면 지금 쪽)' } }, pick('text', 'x', 'y', 'w', 'h', 'font', 'size', 'weight', 'color', 'align', 'lh', 'bg', 'name')), required: ['text'] } },
    { name: 'add_shape', description: '도형을 넣습니다.', input_schema: { type: 'object', properties: Object.assign({ page: { type: 'integer', description: '쪽 번호 (비우면 지금 쪽)' }, kind: { type: 'string', enum: ['rect', 'pill', 'ellipse', 'tri', 'diamond', 'hexagon', 'star', 'line', 'arrow', 'heart'], description: '도형 종류' } }, pick('x', 'y', 'w', 'h', 'fill', 'stroke', 'strokeW', 'radius', 'opacity', 'rot', 'name')), required: ['kind', 'x', 'y', 'w', 'h'] } },
    { name: 'delete_elements', description: '요소를 지웁니다.', input_schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, description: '지울 요소 id' } }, required: ['ids'] } },
    { name: 'arrange', description: '요소를 앞·뒤로 보냅니다(겹침 순서).', input_schema: { type: 'object', properties: { id: STR('요소 id'), to: { type: 'string', enum: ['front', 'back', 'forward', 'backward'], description: '맨 앞·맨 뒤·한 칸 앞·한 칸 뒤' } }, required: ['id', 'to'] } },
    { name: 'set_background', description: '쪽 바탕색을 바꿉니다. 그라데이션은 CSS 형식(예: linear-gradient(135deg,#FFE89A,#FFD34D)).', input_schema: { type: 'object', properties: { color: STR('#RRGGBB 또는 CSS 그라데이션'), page: { type: 'integer', description: '쪽 번호 (비우면 지금 쪽)' }, all_pages: { type: 'boolean', description: '모든 쪽에 적용' } }, required: ['color'] } },
    { name: 'go_to_page', description: '그 쪽을 화면에 엽니다.', input_schema: { type: 'object', properties: { page: { type: 'integer', description: '쪽 번호 (화면에 보이는 번호)' } }, required: ['page'] } },
    { name: 'add_page', description: '지금 쪽 뒤에 새 쪽을 넣습니다.', input_schema: { type: 'object', properties: { duplicate: { type: 'boolean', description: 'true면 지금 쪽을 복제' } }, required: [] } },
    { name: 'select_elements', description: '화면에서 요소를 골라 보여 줍니다(사용자가 바로 속성을 고칠 수 있게).', input_schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] } },
    { name: 'search_templates', description: '템플릿을 찾습니다(예: "가을 모집 포스터", "상장", "결제 단말기 인성").', input_schema: { type: 'object', properties: { query: STR('찾을 말') }, required: ['query'] } },
    { name: 'open_template', description: '템플릿 미리 보기 창을 엽니다(만들기 단추는 사용자가 누름).', input_schema: { type: 'object', properties: { id: STR('search_templates 결과의 id') }, required: ['id'] } },
    { name: 'open_tool', description: '공방 기능 창·패널을 엽니다.', input_schema: { type: 'object', properties: { tool: { type: 'string', enum: ['templates', 'virtue_templates', 'pages', 'elements', 'photos', 'naracha', 'news', 'cert', 'att', 'calendar', 'calendar_wizard', 'book', 'resize', 'print', 'download', 'qr', 'dday', 'dojang_info', 'rules', 'settings', 'file_menu', 'new_design', 'holiday', 'fonts', 'ai_image_studio', 'racha_maker', 'virtue_copy', 'image_editor', 'manual'], description: '열 기능' } }, required: ['tool'] } },
    { name: 'generate_image', description: 'Gemini로 그림을 새로 만들어 지금 쪽에 넣습니다(요금이 듭니다). prompt는 영어로 자세히.', input_schema: { type: 'object', properties: { prompt: STR('그림 설명 (영어, 장면·인물·동작·그림체·배경)'), aspect: { type: 'string', enum: ['1:1', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9'], description: '비율' }, cutout: { type: 'boolean', description: 'true면 흰 배경을 지워 오려 쓰는 그림으로' }, x: N('넣을 왼쪽 위치 mm'), y: N('넣을 위쪽 위치 mm'), w: N('넣을 너비 mm') }, required: ['prompt'] } },
  ];

  /* ---------- 문서 읽기 ---------- */
  const pageNo = i => i + B.pgOff();
  const pageIdx = n => (n == null || n === '' ? B.cur : Math.max(0, Math.min(B.doc.pages.length - 1, Math.round(Number(n)) - B.pgOff())));
  function elInfo(e) {
    const o = { id: e.id, type: e.type };
    if (e.name) o.name = e.name;
    o.x = r1(e.x); o.y = r1(e.y); o.w = r1(e.w); o.h = r1(e.h); if (e.rot) o.rot = r1(e.rot);
    if (e.type === 'text') { const t = String(e.text || ''); o.text = t.length > 300 ? t.slice(0, 300) + '…' : t; o.font = e.font; o.size = e.size; if (e.weight && e.weight !== 400) o.weight = e.weight; o.color = e.color; o.align = e.align; if (e.bg) o.bg = e.bg; }
    else if (e.type === 'shape') { o.kind = e.kind; o.fill = e.fill; if (e.stroke) o.stroke = e.stroke; if (e.radius) o.radius = e.radius; }
    else if (e.type === 'image') { o.image = e.role === 'illust' ? '달력 삽화' : (e.src && String(e.src).startsWith('asset:') ? '공방 그림' : '그림'); }
    if (e.opacity != null && e.opacity < 1) o.opacity = e.opacity;
    if (e.locked) o.locked = true; if (e.hidden) o.hidden = true; if (e.role) o.role = e.role;
    return o;
  }
  function pageInfo(i) { const p = B.doc.pages[i]; return { page: pageNo(i), label: p.label || '', bg: p.bg, elements: p.els.filter(e => e.type !== 'audio').map(elInfo) }; }
  function docInfo() {
    const d = B.doc, px = B.isPx();
    const o = { name: d.name || '제목 없음', size: B.sizeLabel(), w_mm: r1(d.w), h_mm: r1(d.h), pages: d.pages.length, current_page: pageNo(B.cur), page_labels: d.pages.slice(0, 60).map((p, i) => `${pageNo(i)}${p.label ? ' ' + p.label : ''}`), selected: B.sel, current: pageInfo(B.cur), fonts: B.fonts().slice(0, 80) };
    if (px) o.px_per_mm = r1(96 / 25.4 * 100) / 100;
    if (d.cert) o.kind = '상장 문서(나라차 → 상장 메뉴로 만든 것 — 명단은 그 메뉴에서)';
    if (d.att) o.kind = '출석부 문서(나라차 → 출석부 메뉴)';
    const dj = B.dojang(); if (dj && (dj.name || dj.phone)) o.dojang = { name: dj.name || '', phone: dj.phone || '', addr: dj.addr || dj.address || '' };
    return o;
  }
  function findEl(id) { const d = B.doc; for (let i = 0; i < d.pages.length; i++) { const e = d.pages[i].els.find(x => x.id === id); if (e) return { e, i, p: d.pages[i] }; } return null; }

  /* ---------- 도구 실행 ---------- */
  const isCol = v => typeof v === 'string' && (/^#[0-9a-f]{3,8}$/i.test(v.trim()) || v.trim() === '' || /^(rgb|hsl)a?\(/i.test(v.trim()));
  const NUMK = ['x', 'y', 'w', 'h', 'rot', 'size', 'weight', 'lh', 'ls', 'strokeW', 'radius', 'opacity'];
  const COLK = ['color', 'bg', 'fill', 'stroke'];
  function applyProps(e, c) {
    const done = [];
    for (const k of Object.keys(c)) {
      if (k === 'id' || k === 'page' || k === 'kind') continue;
      let v = c[k];
      if (NUMK.includes(k)) { v = Number(v); if (!isFinite(v)) throw new Error(`${k} 값이 숫자가 아닙니다`); if (k === 'opacity') v = Math.max(0, Math.min(1, v)); if (k === 'w' || k === 'h') v = Math.max(0.5, v); if (k === 'size') v = Math.max(2, Math.min(800, v)); e[k] = k === 'ls' ? Math.round(v * 1000) / 1000 : k === 'opacity' || k === 'lh' ? Math.round(v * 100) / 100 : r1(v); done.push(k); continue; }
      if (COLK.includes(k)) { if (!isCol(v)) throw new Error(`${k} 색은 #RRGGBB로 적어 주세요`); e[k] = String(v).trim(); done.push(k); continue; }
      if (k === 'text') { if (e.type !== 'text') continue; e.text = String(v); delete e.html; done.push(k); continue; }
      if (k === 'font') { const f = String(v); if (!B.fonts().includes(f)) throw new Error(`'${f}' 글꼴은 공방에 없습니다. get_document의 fonts 목록에서 고르세요`); e.font = f; done.push(k); continue; }
      if (k === 'align' || k === 'valign' || k === 'name') { e[k] = String(v); done.push(k); continue; }
      if (k === 'italic') { e.italic = !!v; done.push(k); continue; }
    }
    return done;
  }
  function changed(p) { B.commit(); B.renderAll(); return p; }
  async function runTool(name, a, ctx) {
    a = a || {};
    const d = B.doc;
    if (name === 'get_document') return docInfo();
    if (name === 'get_page') return pageInfo(pageIdx(a.page));
    if (name === 'see_page') { const i = pageIdx(a.page); const url = await B.pageJPEG(i); ctx.images.push(url); return { ok: true, page: pageNo(i), note: '쪽 그림을 함께 보냈습니다' }; }
    if (name === 'update_elements') {
      const ch = Array.isArray(a.changes) ? a.changes : []; if (!ch.length) throw new Error('changes가 비었습니다');
      const out = [];
      for (const c of ch) { const f = c && findEl(String(c.id)); if (!f) { out.push({ id: c && c.id, error: '그런 id가 없습니다' }); continue; } if (f.e.locked) { out.push({ id: c.id, error: '잠긴 요소입니다(사용자가 레이어에서 잠금 풀기)' }); continue; } try { out.push({ id: c.id, changed: applyProps(f.e, c) }); } catch (er) { out.push({ id: c.id, error: er.message }); } }
      if (out.some(o => o.changed && o.changed.length)) { ctx.edits++; changed(); }
      return { results: out };
    }
    if (name === 'add_text') {
      const i = pageIdx(a.page), k = B.docK();
      const el = Object.assign({}, B.TEXT_DEF, { id: B.uid(), text: '', size: Math.round(14 * k * 2) / 2, w: r1(Math.min(90 * k, d.w * 0.9)), h: r1(10 * k) });
      el.x = r1((d.w - el.w) / 2); el.y = r1((d.h - el.h) / 2);
      applyProps(el, a); if (a.w != null && a.x == null) el.x = r1((d.w - el.w) / 2);
      d.pages[i].els.push(el); ctx.edits++; changed(); if (i === B.cur) B.select([el.id]);
      return { ok: true, id: el.id, page: pageNo(i) };
    }
    if (name === 'add_shape') {
      const i = pageIdx(a.page);
      const el = { type: 'shape', kind: String(a.kind || 'rect'), id: B.uid(), x: 0, y: 0, w: 40, h: 40, rot: 0, fill: '#F0716B', stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' };
      if (el.kind === 'line') { el.fill = '#333333'; el.strokeW = 0.6; }
      applyProps(el, a); d.pages[i].els.push(el); ctx.edits++; changed(); if (i === B.cur) B.select([el.id]);
      return { ok: true, id: el.id, page: pageNo(i) };
    }
    if (name === 'delete_elements') {
      const ids = (a.ids || []).map(String); let n = 0;
      ids.forEach(id => { const f = findEl(id); if (f && !f.e.locked) { f.p.els.splice(f.p.els.indexOf(f.e), 1); n++; } });
      if (n) { ctx.edits++; B.select([]); changed(); }
      return { deleted: n, not_found_or_locked: ids.length - n };
    }
    if (name === 'arrange') {
      const f = findEl(String(a.id)); if (!f) throw new Error('그런 id가 없습니다');
      const L = f.p.els, k = L.indexOf(f.e); L.splice(k, 1);
      const to = a.to === 'front' ? L.length : a.to === 'back' ? 0 : a.to === 'forward' ? Math.min(L.length, k + 1) : Math.max(0, k - 1);
      L.splice(to, 0, f.e); ctx.edits++; changed(); return { ok: true };
    }
    if (name === 'set_background') {
      const c = String(a.color || '').trim(); if (!c || /[;{}<>]|url\s*\(/i.test(c)) throw new Error('색 값이 올바르지 않습니다');
      const L = a.all_pages ? d.pages : [d.pages[pageIdx(a.page)]]; L.forEach(p => { p.bg = c; }); ctx.edits++; changed(); return { ok: true, pages: L.length };
    }
    if (name === 'go_to_page') { const i = pageIdx(a.page); B.goto(i); return { ok: true, page: pageNo(i) }; }
    if (name === 'add_page') { const i = B.addPage(!!a.duplicate); ctx.edits++; return { ok: true, page: pageNo(i) }; }
    if (name === 'select_elements') { const ids = (a.ids || []).map(String); const f = ids.map(findEl).filter(Boolean); if (f[0] && f[0].i !== B.cur) B.goto(f[0].i); B.select(f.filter(x => x.i === (f[0] ? f[0].i : B.cur)).map(x => x.e.id)); return { ok: true, selected: B.sel }; }
    if (name === 'search_templates') {
      const q = String(a.query || '').toLowerCase().split(/\s+/).filter(Boolean);
      const L = B.tplItems().map(t => { const hay = `${t.name} ${t.kw || ''} ${t.cat || ''} ${Object.values(t.tags || {}).join(' ')}`.toLowerCase(); const sc = q.reduce((s, w) => s + (hay.includes(w) ? (String(t.name).toLowerCase().includes(w) ? 3 : 1) : 0), 0); return { t, sc }; }).filter(x => x.sc > 0).sort((x, y) => y.sc - x.sc).slice(0, 12);
      return { found: L.length, templates: L.map(({ t }) => ({ id: t.id, name: t.name, size: t.w && t.h ? `${r1(t.w)}×${r1(t.h)}mm` : '' })) };
    }
    if (name === 'open_template') { const t = B.tplItems().find(x => x.id === String(a.id)); if (!t) throw new Error('그런 템플릿 id가 없습니다'); B.openTplPreview(t); ctx.opened = true; return { ok: true, note: '미리 보기 창을 열었습니다. 사용자가 「새 문서」나 「지금 문서 뒤에 추가」를 누르면 만들어집니다.' }; }
    if (name === 'open_tool') { if (!B.tool(String(a.tool))) throw new Error('그 기능은 열 수 없습니다'); ctx.opened = true; return { ok: true }; }
    if (name === 'generate_image') {
      if (!cfg().geminiKey) throw new Error('Gemini API 키가 없어 그림을 만들 수 없습니다. 채팅창 ⚙에서 Gemini 키를 넣거나, 「AI 그림 스튜디오」(내 채팅 요금제)로 만들도록 안내하세요.');
      ctx.note('🎨 그림 만드는 중… (10~40초)');
      const imgs = await window.AI.geminiImage({ prompt: String(a.prompt || ''), aspect: a.aspect || '1:1' });
      let u = imgs[0]; if (a.cutout) u = await window.AI.removeWhite(u);
      const id = await B.addImageURL(u, a); ctx.edits++;
      return { ok: true, id, note: '그림을 지금 쪽에 넣었습니다' };
    }
    throw new Error('모르는 도구: ' + name);
  }

  /* ---------- Claude (Messages API, 브라우저 직접 호출) ---------- */
  async function claudeCall() {
    const model = S.claudeModel || 'claude-opus-5-5';
    const fb = /^claude-(fable-5-[12]|opus-5-5|opus-5|sonnet-5-5)$/.test(model);  /* 서버 쪽 대체 모델(fallbacks)을 받는 모델만 — 그 밖(Haiku·Sonnet 5 등)에 보내면 400 */
    const body = { model, max_tokens: 16000, system: [{ type: 'text', text: system() }], tools: TOOLS, messages: api, cache_control: { type: 'ephemeral' }, output_config: { effort: 'medium' } };
    if (fb) body.fallbacks = 'default';
    const h = { 'content-type': 'application/json', 'x-api-key': cfg().anthropicKey, 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' };
    if (fb) h['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: h, body: JSON.stringify(body), signal: aborter.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(errKo('claude', r.status, j.error && j.error.message));
    return j;
  }
  async function claudeTurn(ctx) {
    for (let n = 0; n < MAX_LOOP; n++) {
      const j = await claudeCall();
      api.push({ role: 'assistant', content: j.content || [] });
      const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
      if (j.stop_reason === 'refusal') { ctx.say(text || 'AI가 이 부탁은 도와드릴 수 없다고 답했습니다. 다르게 말해 보세요.'); return; }
      const uses = (j.content || []).filter(b => b.type === 'tool_use');
      if (text) ctx.say(text);
      if (j.stop_reason !== 'tool_use' || !uses.length) { if (j.stop_reason === 'max_tokens') ctx.say('(답이 너무 길어 중간에 끊겼습니다. 「이어서」라고 보내 주세요.)'); return; }
      const results = [];
      for (const u of uses) {
        ctx.images = [];
        let res, isErr = false;
        try { ctx.tool(u.name, u.input); res = await runTool(u.name, u.input, ctx); } catch (er) { isErr = true; res = { error: er.message }; ctx.toolErr(u.name, er.message); }
        const content = [{ type: 'text', text: JSON.stringify(res) }];
        ctx.images.forEach(url => content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: url.split(',')[1] } }));
        results.push(Object.assign({ type: 'tool_result', tool_use_id: u.id, content }, isErr ? { is_error: true } : {}));
      }
      api.push({ role: 'user', content: results });
    }
    ctx.say('(할 일이 많아 여기서 멈췄습니다. 이어서 하려면 「계속」이라고 보내 주세요.)');
  }

  /* ---------- Gemini (generateContent + 함수 호출) ---------- */
  const gemSchema = s => { if (!s || typeof s !== 'object') return s; if (Array.isArray(s)) return s.map(gemSchema); const o = {}; for (const k in s) { if (k === 'additionalProperties') continue; o[k] = gemSchema(s[k]); } if (o.type === 'object' && o.properties && !Object.keys(o.properties).length) delete o.properties; if (Array.isArray(o.required) && !o.required.length) delete o.required; return o; };
  /* 모델: ⚙에 직접 적은 이름이 있으면 그것만. 비어 있으면 목록에서 고른 후보(안정판 Flash 먼저, 미리보기판은 뒤 — 미리보기는 바빠서 503이 잦음)를 하루 기억 */
  async function geminiCands() {
    if (S.geminiModel) return [S.geminiModel];
    const A = S.gemAuto; if (A && Array.isArray(A.list) && A.list.length && Date.now() - (A.at || 0) < 864e5) return A.list;
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': cfg().geminiKey }, signal: aborter.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(errKo('gemini', r.status, j.error && j.error.message));
    const L = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, '')).filter(n => /^gemini-\d/.test(n) && !/image|tts|audio|live|embed|vision|lite|learnlm|thinking-exp/.test(n));
    const ver = n => { const m = n.match(/^gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
    const score = n => ver(n) * 10 + (/flash/.test(n) ? 50 : /pro/.test(n) ? 2 : 0) + (/preview|exp/.test(n) ? -25 : 0)  /* Flash(값 싸고 빠름) 먼저, 미리보기판은 뒤, Pro는 맨 뒤 */ + (/-\d{3,}$|-\d{2}-\d{2}/.test(n) ? -0.5 : 0);
    L.sort((a, b) => score(b) - score(a));
    if (!L[0]) throw new Error('쓸 수 있는 Gemini 대화 모델을 찾지 못했습니다. ⚙에서 모델 이름을 직접 넣어 주세요.');
    S.gemAuto = { list: L.slice(0, 4), at: Date.now() }; save();
    return S.gemAuto.list;
  }
  async function geminiModel() { return (await geminiCands())[0]; }
  const sleep = ms => new Promise((res, rej) => { const t = setTimeout(res, ms); aborter.signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('중지', 'AbortError')); }, { once: true }); });
  /* 바쁨(5xx·529)이면 1.5초·4초 쉬고 다시, 그래도 바쁘면 (자동 고르기일 때·이 대화에 그 모델 답이 아직 없을 때) 다음 후보 모델로 */
  async function gemPost(ctx, body) {
    const cands = await geminiCands(); let i = Math.max(0, cands.indexOf(ctx.gemModel || cands[0]));
    for (;;) {
      const model = cands[i];
      for (const wait of [0, 1500, 4000]) {
        if (wait) await sleep(wait);
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg().geminiKey }, body: JSON.stringify(body), signal: aborter.signal });
        const j = await r.json().catch(() => ({}));
        if (r.ok) { if (ctx.gemModel && ctx.gemModel !== model) ctx.say(`(${ctx.gemModel} 모델이 바빠서 ${model} 모델로 보냈습니다)`); ctx.gemModel = model; return j; }
        if (!(r.status >= 500 || r.status === 529)) throw new Error(errKo('gemini', r.status, j.error && j.error.message));
        ctx.lastErr = errKo('gemini', r.status, j.error && j.error.message);
      }
      const canSwitch = !S.geminiModel && i + 1 < cands.length && !api.some(c => c.role === 'model');  /* 앞서 이 모델이 답한 대화는 생각 서명이 그 모델 것이라 바꾸지 않음 */
      if (!canSwitch) throw new Error(ctx.lastErr + (S.geminiModel ? ' — ⚙의 모델 칸을 비우면 바쁠 때 다른 모델로 바꿔 보냅니다.' : ''));
      ctx.gemModel = ctx.gemModel || model; i++;
    }
  }
  async function geminiTurn(ctx) {
    const decl = TOOLS.map(t => ({ name: t.name, description: t.description, parameters: gemSchema(t.input_schema) }));
    for (let n = 0; n < MAX_LOOP; n++) {
      const body = { systemInstruction: { parts: [{ text: system() }] }, contents: api, tools: [{ functionDeclarations: decl }] };
      const j = await gemPost(ctx, body);
      const c = (j.candidates || [])[0];
      if (!c || !c.content) { const why = (j.promptFeedback && j.promptFeedback.blockReason) || (c && c.finishReason) || ''; ctx.say(why ? `Gemini가 답하지 않았습니다(${why}). 다르게 말해 보세요.` : 'Gemini가 빈 답을 보냈습니다. 다시 보내 주세요.'); return; }
      const content = { role: 'model', parts: c.content.parts || [] };
      api.push(content);
      const text = content.parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
      const calls = content.parts.filter(p => p.functionCall);
      if (text) ctx.say(text);
      if (!calls.length) return;
      const parts = [], extra = [];
      for (const p of calls) {
        const fc = p.functionCall; ctx.images = [];
        let res;
        try { ctx.tool(fc.name, fc.args); res = await runTool(fc.name, fc.args || {}, ctx); } catch (er) { res = { error: er.message }; ctx.toolErr(fc.name, er.message); }
        parts.push({ functionResponse: Object.assign({ name: fc.name, response: { result: res } }, fc.id ? { id: fc.id } : {}) });
        ctx.images.forEach(url => extra.push({ inlineData: { mimeType: 'image/jpeg', data: url.split(',')[1] } }));
      }
      api.push({ role: 'user', parts: parts.concat(extra) });
    }
    ctx.say('(할 일이 많아 여기서 멈췄습니다. 이어서 하려면 「계속」이라고 보내 주세요.)');
  }

  function errKo(p, st, m) {
    m = String(m || '');
    const who = p === 'gemini' ? 'Gemini' : 'Claude';
    if (st === 401 || st === 403 || /api[_ -]?key|x-api-key|permission|invalid.*key/i.test(m) && st < 500) return `${who} API 키가 맞지 않거나 쓸 수 없습니다. ⚙에서 키를 다시 넣어 주세요. (${st})`;
    if (st === 429) return `${who} 사용량 한도에 걸렸습니다. 잠시 뒤 다시 보내거나, 결제(크레딧)를 확인해 주세요. (${st})`;
    if (st === 400 && /credit|billing|balance/i.test(m)) return `${who} 계정에 크레딧(충전 금액)이 없습니다. 결제 화면에서 충전해 주세요.`;
    if (st === 404) return `${who} 모델 이름을 찾지 못했습니다. ⚙에서 모델을 다시 골라 주세요. (${m.slice(0, 120)})`;
    if (st >= 500 || st === 529) return `${who} 서버가 바쁩니다(여러 번 다시 보내 봤지만 계속 바쁨). 1~2분 뒤 다시 보내 주세요. (${st})`;
    return `${who} 오류 ${st}: ${m.slice(0, 200)}`;
  }

  /* ---------- 화면 ---------- */
  function md(t) {
    let h = esc(t);
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
    h = h.split('\n').map(l => /^\s*[-•*]\s+/.test(l) ? `<li>${l.replace(/^\s*[-•*]\s+/, '')}</li>` : /^\s*\d+[.)]\s+/.test(l) ? `<li class="n">${l}</li>` : /^#{1,4}\s/.test(l) ? `<b>${l.replace(/^#{1,4}\s/, '')}</b><br>` : l + '<br>').join('');
    return h.replace(/(<br>)+$/, '').replace(/(<li[^>]*>.*?<\/li>)+/g, m => `<ul>${m}</ul>`);
  }
  const TOOL_KO = { get_document: '문서 읽음', get_page: '쪽 읽음', see_page: '쪽 그림 봄', update_elements: '요소 고침', add_text: '글 상자 넣음', add_shape: '도형 넣음', delete_elements: '요소 지움', arrange: '순서 바꿈', set_background: '바탕 바꿈', go_to_page: '쪽 이동', add_page: '쪽 추가', select_elements: '요소 고름', search_templates: '템플릿 찾음', open_template: '템플릿 미리 보기 엶', open_tool: '기능 창 엶', generate_image: '그림 만듦' };
  function renderLog() {
    const L = $('#achLog'); if (!L) return;
    if (!S.log.length) {
      L.innerHTML = `<div class="ach-hello"><b>무엇을 도와드릴까요?</b><p>지금 문서를 보고 글·색·배치를 직접 고치거나, 템플릿을 찾고, 사용법을 알려 드립니다.</p><div class="ach-ex">${['이 쪽 디자인 봐 주고 좋아지게 고쳐 줘', '제목을 더 크고 눈에 띄게 바꿔 줘', '겨울방학 특강 포스터 템플릿 찾아 줘', '상장은 어떻게 만들어?', '결제 단말기 인성덕목 이미지 쓰는 법 알려 줘'].map(x => `<button type="button" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`;
      return;
    }
    L.innerHTML = S.log.map((m, k) => {
      if (m.r === 'u') return `<div class="ach-m u">${esc(m.t).replace(/\n/g, '<br>')}</div>`;
      if (m.r === 'a') return `<div class="ach-m a">${md(m.t)}</div>`;
      if (m.r === 't') return `<div class="ach-t${m.err ? ' err' : ''}">${esc(m.t)}</div>`;
      if (m.r === 'e') return `<div class="ach-m e">${esc(m.t)}</div>`;
      if (m.r === 'x') return `<div class="ach-x"><span>${esc(m.t)}</span>${m.undo && !m.undone ? `<button type="button" class="btn sm" data-undo="${k}">↶ 되돌리기</button>` : m.undone ? '<em>되돌렸음</em>' : ''}</div>`;
      if (m.r === 'n') return `<div class="ach-n">${esc(m.t)}</div>`;
      return '';
    }).join('') + (busy ? `<div class="ach-busy"><i></i><i></i><i></i><span id="achNote">${esc(busyNote)}</span></div>` : '');
    L.scrollTop = L.scrollHeight;
  }
  let busyNote = '생각하는 중…';
  function renderSet() {
    const s = $('#achSet'); if (!s) return;
    const p = S.prov, k = keyOf(p);
    s.innerHTML = `<div class="ach-seg">${[['claude', 'Claude'], ['gemini', 'Gemini']].map(([v, t]) => `<button type="button" data-prov="${v}" class="${p === v ? 'on' : ''}">${t}${keyOf(v) ? '' : ' <small>(키 없음)</small>'}</button>`).join('')}</div>
      <label class="f"><span>${p === 'gemini' ? 'Gemini' : 'Claude'} API 키</span><input type="password" id="achKey" autocomplete="off" placeholder="${p === 'gemini' ? 'AIza… 또는 AQ.… (aistudio.google.com에서 만든 키)' : 'sk-ant-… (console.anthropic.com에서 만든 키)'}" value="${esc(k)}"></label>
      <label class="f"><span>모델</span>${p === 'gemini' ? `<input id="achModel" placeholder="비워 두면 가장 새 Flash를 자동으로" value="${esc(S.geminiModel)}">` : `${window.proxyPick ? window.proxyPick('#achModel', S.claudeModel, [[CLAUDE_MODELS[0][0], '🧠', 'Opus', CLAUDE_MODELS[0][1]], [CLAUDE_MODELS[1][0], '⚡', 'Sonnet', CLAUDE_MODELS[1][1]], [CLAUDE_MODELS[2][0], '💸', 'Haiku', CLAUDE_MODELS[2][1]]], 'txt') : ''}<select id="achModel" ${window.proxyPick ? 'hidden' : ''}>${CLAUDE_MODELS.map(([v, t]) => `<option value="${v}" ${S.claudeModel === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`}</label>
      <p class="hint" style="margin-bottom:2px">💳 쓴 만큼 요금 · 🔒 키는 이 PC에만 · 👤 상장·출석부를 연 채 물으면 이름도 함께 보내짐</p><details class="bk-more"><summary>ⓘ 자세히</summary><div>API는 쓴 만큼 요금이 듭니다(채팅 요금제와 따로). 키와 대화는 이 브라우저(동기화 폴더가 있으면 그 설정 파일)에만 두고, 문서 내용은 고른 AI 회사로만 보냅니다. 학생 이름이 든 상장·출석부를 열어 둔 채 물으면 그 이름도 함께 보내집니다.</div></details>
      <div class="row"><button type="button" class="btn sm" id="achKeySave">저장</button>${k ? '<button type="button" class="btn sm" id="achKeyDel">이 PC에서 키 지우기</button>' : ''}<button type="button" class="btn sm" id="achOld">예전 AI 도구 창</button></div>`;
  }
  function needKey() { return `${S.prov === 'gemini' ? 'Gemini' : 'Claude'} API 키가 아직 없습니다. 위 ⚙ 설정 칸에 키를 넣고 「저장」을 눌러 주세요. 키는 ${S.prov === 'gemini' ? 'aistudio.google.com → Get API key' : 'console.anthropic.com → API Keys'}에서 팀장님이 직접 만듭니다.`; }

  function push(m) { S.log.push(m); if (S.log.length > 120) S.log.splice(0, S.log.length - 120); save(); renderLog(); }
  function newChat(silent) { api = []; apiProv = null; if (!silent) { push({ r: 'n', t: '— 새 대화 —' }); } }

  async function send(text) {
    text = String(text || '').trim(); if (!text || busy) return;
    if (!keyOf(S.prov)) { push({ r: 'u', t: text }); push({ r: 'e', t: needKey() }); openSet(true); return; }
    if (apiProv && apiProv !== S.prov) newChat();
    if (api.length > MAX_MSGS) { newChat(); push({ r: 'n', t: '대화가 길어져 새 대화로 이어 갑니다(앞 내용은 AI가 기억하지 못함).' }); }
    apiProv = S.prov;
    push({ r: 'u', t: text });
    const h0 = B.hptr, d0 = B.doc;
    const ctx = { edits: 0, images: [], opened: false,
      say: t => push({ r: 'a', t }),
      tool: (n) => { if (!['get_document', 'get_page'].includes(n)) push({ r: 't', t: '· ' + (TOOL_KO[n] || n) }); busyNote = n === 'see_page' ? '쪽 그림 보는 중…' : '작업하는 중…'; renderLog(); },
      toolErr: (n, m) => push({ r: 't', t: `· ${TOOL_KO[n] || n} 못 함 — ${m}`, err: true }),
      note: t => { busyNote = t; const e = $('#achNote'); if (e) e.textContent = t; } };
    const state = pendingNote + `[지금 화면] 문서 「${B.doc.name || '제목 없음'}」 ${B.sizeLabel()}, ${B.doc.pages.length}쪽 중 ${pageNo(B.cur)}쪽, 고른 요소 ${B.sel.length ? B.sel.join(', ') : '없음'}`;
    const content = [];
    let img = null; if (S.sendPage) { try { img = await B.pageJPEG(B.cur); } catch (e) {} }
    if (S.prov === 'claude') { if (img) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.split(',')[1] } }); content.push({ type: 'text', text: `${state}\n\n${text}` }); api.push({ role: 'user', content }); }
    else { const parts = [{ text: `${state}\n\n${text}` }]; if (img) parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] } }); api.push({ role: 'user', parts }); }
    pendingNote = ''; busy = true; busyNote = '생각하는 중…'; aborter = new AbortController(); renderLog(); updBtn();
    try { if (S.prov === 'claude') await claudeTurn(ctx); else await geminiTurn(ctx); }
    catch (er) {
      if (er.name === 'AbortError') push({ r: 'n', t: '멈췄습니다.' }); else push({ r: 'e', t: er.message || String(er) });
      /* 실패한 차례는 대화 기록에서 빼서 다음에 다시 보낼 수 있게(덧붙이던 중이던 끝부분만) */
      if (S.prov === 'claude') { while (api.length && !(api[api.length - 1].role === 'assistant' && !(api[api.length - 1].content || []).some(b => b.type === 'tool_use'))) api.pop(); }
      else { while (api.length && !(api[api.length - 1].role === 'model' && !(api[api.length - 1].parts || []).some(p => p.functionCall))) api.pop(); }
    }
    finally { busy = false; aborter = null; }
    if (ctx.edits && B.doc === d0 && B.hptr > h0) push({ r: 'x', t: `디자인을 ${B.hptr - h0}번 고쳤습니다`, undo: true, h0, h1: B.hptr });
    else renderLog();
    updBtn();
  }
  function undoTurn(k) {
    const m = S.log[k]; if (!m || m.undone) return;
    if (B.hptr !== m.h1) { B.toast('그 뒤에 다른 것을 고쳐서 여기서는 되돌릴 수 없습니다. Ctrl+Z로 하나씩 되돌려 주세요.', true); return; }
    while (B.hptr > m.h0) B.undo();
    m.undone = true; save(); renderLog();
    if (api.length) pendingNote = '[알림] 사용자가 앞에서 AI가 고친 것을 「되돌리기」로 모두 되돌렸습니다(문서가 그 전으로 돌아감).\n';
  }
  let pendingNote = '';
  function updBtn() { const b = $('#achSend'); if (b) { b.textContent = busy ? '■ 멈춤' : '보내기'; b.classList.toggle('stop', busy); } }
  function openSet(on) { const s = $('#achSet'); if (!s) return; s.hidden = on === undefined ? !s.hidden : !on; if (!s.hidden) renderSet(); }

  function build() {
    if ($('#aiChat')) return;
    const a = document.createElement('aside'); a.className = 'aichat'; a.id = 'aiChat'; a.setAttribute('aria-label', 'AI 도우미'); a.hidden = true;
    a.innerHTML = `<div class="ach-head"><b>✨ AI 도우미</b><span class="ach-prov" id="achProv"></span><span class="sp"></span><button type="button" class="btn icon sm" id="achNew" title="새 대화 (앞 대화를 잊고 새로 시작)">＋</button><button type="button" class="btn icon sm" id="achCfg" title="AI 설정 — Claude·Gemini 고르기, API 키">⚙</button><button type="button" class="btn icon sm" id="achClose" title="닫고 속성 보기">✕</button></div>
      <div class="ach-set" id="achSet" hidden></div>
      <div class="ach-log" id="achLog"></div>
      <div class="ach-in"><label class="ach-pg" title="보낼 때 지금 쪽 그림도 함께 보냄(디자인 봐 달라고 할 때 — 조금 더 비쌈)"><input type="checkbox" id="achPg" ${S.sendPage ? 'checked' : ''}> 지금 쪽 그림 함께 보내기</label>
        <div class="ach-box"><textarea id="achText" rows="2" placeholder="무엇을 도와드릴까요? (Enter 보내기 · Shift+Enter 줄 바꿈)"></textarea><button type="button" class="btn primary" id="achSend">보내기</button></div></div>`;
    const insp = document.getElementById('inspector'); insp.parentNode.insertBefore(a, insp.nextSibling);
    a.addEventListener('click', e => {
      const t = e.target;
      const ex = t.closest('[data-ex]'); if (ex) { send(ex.dataset.ex); return; }
      const u = t.closest('[data-undo]'); if (u) { undoTurn(Number(u.dataset.undo)); return; }
      const pv = t.closest('[data-prov]'); if (pv) { S.prov = pv.dataset.prov; save(); renderSet(); renderHead(); return; }
      if (t.closest('#achNew')) { if (busy) return; newChat(); S.log = []; save(); renderLog(); return; }
      if (t.closest('#achCfg')) { openSet(); return; }
      if (t.closest('#achClose')) { if (B && B.openAIPanel) B.openAIPanel('make'); else show(false); return; }
      if (t.closest('#achSend')) { if (busy) { if (aborter) aborter.abort(); return; } const x = $('#achText'); const v = x.value; x.value = ''; send(v); return; }
      if (t.closest('#achKeySave')) { const v = $('#achKey').value.trim(); if (S.prov === 'gemini') cfg().geminiKey = v; else cfg().anthropicKey = v; const m = $('#achModel'); if (m) { if (S.prov === 'gemini') S.geminiModel = m.value.trim(); else S.claudeModel = m.value; } window.AI.saveCfg(); save(); renderSet(); renderHead(); B.toast('AI 설정을 저장했습니다'); openSet(false); return; }
      if (t.closest('#achKeyDel')) { if (S.prov === 'gemini') cfg().geminiKey = ''; else cfg().anthropicKey = ''; window.AI.saveCfg(); renderSet(); renderHead(); B.toast('이 PC에서 키를 지웠습니다'); return; }
      if (t.closest('#achOld')) { B.openAI('image'); return; }
    });
    a.addEventListener('change', e => { if (e.target.id === 'achPg') { S.sendPage = e.target.checked; save(); } if (e.target.id === 'achModel' && S.prov === 'claude') { S.claudeModel = e.target.value; save(); renderHead(); } });
    a.addEventListener('keydown', e => { if (e.target.id === 'achText' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); const v = e.target.value; e.target.value = ''; send(v); } e.stopPropagation(); });
    renderHead(); renderLog();
  }
  function renderHead() { const p = $('#achProv'); if (!p) return; const m = S.prov === 'gemini' ? (S.geminiModel || 'Gemini') : ((CLAUDE_MODELS.find(x => x[0] === S.claudeModel) || [0, S.claudeModel])[1].split(' (')[0]); p.textContent = m + (keyOf(S.prov) ? '' : ' · 키 없음'); }
  /* 11/24 팀장님 「AI 도구와 AI 도우미를 한곳에」: 대화창은 왼쪽 AI 도구 패널의 「💬 AI와 대화」 탭 안에 — mount(자리)로 넣음, show(true)는 그 탭을 엶 */
  function mount(host) { build(); const a = $('#aiChat'); if (!a || !host) return; host.appendChild(a); a.hidden = false; a.classList.add('embed'); const app = document.querySelector('.app'); if (app) app.classList.remove('ai-on'); renderHead(); renderLog(); if (!keyOf(S.prov) && !(B && B.chatMode && B.chatMode())) openSet(true); setTimeout(() => { const x = $('#achText'); if (x) x.focus(); }, 30); }
  function show(on) {
    if (on !== false && B && B.openAIPanel) { B.openAIPanel('chat'); return; }
    build(); const a = $('#aiChat'), app = document.querySelector('.app');
    if (on === undefined) on = a.hidden;
    a.hidden = !on; app.classList.toggle('ai-on', on);
    const b = document.getElementById('btnAI'); if (b) b.classList.toggle('on', on);
    if (on) { renderHead(); renderLog(); if (!keyOf(S.prov)) openSet(true); setTimeout(() => { const x = $('#achText'); if (x) x.focus(); }, 30); }
    try { localStorage.setItem(LS + '-open', on ? '1' : ''); } catch (e) {}
  }
  NC.aichat = { init(b) { B = b; }, mount, show, toggle: () => show(), send, get state() { return S; }, get api() { return api; }, _runTool: (n, a) => runTool(n, a, { edits: 0, images: [], note() {}, say() {} }), system };
})();
