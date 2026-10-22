// 추가 템플릿: 색상 변형(팔레트) 체계 + 새 유형 34종 (리플렛·입간판·쿠폰·명찰·스티커·티켓·서식·명절·웹·게임 등)
(function () {
  const L = NC.tpl.list;
  const NAVY = '#1E2B5A', YEL = '#FFE89A', SKY = '#E6EDF2', RED = '#E0564B', INK = '#1a1a1a', WHITE = '#ffffff', MINT = '#DDF3EA', GREEN = '#2F5D3A', CREAM = '#FFF8E8', GOLD = '#C9A227', PEACH = '#FFE9D6', GRAY = '#F3F4F7', PURPLE = '#6B3FD1', LAV = '#F0EBFB';
  const PHONE = '010-0000-0000', ADDR = '○○시 ○○구 ○○로 00, 2층';
  const D = { logo: 'asset:logo-wordmark', swoosh: 'asset:swoosh', group: 'asset:cover-group', m1: 'asset:mascot-01', m3: 'asset:mascot-03', m4: 'asset:mascot-04', m5: 'asset:mascot-05', m7: 'asset:mascot-07', m8: 'asset:mascot-08', m9: 'asset:mascot-09', m11: 'asset:mascot-11', pride: 'asset:illu-01-pride', morality: 'asset:illu-02-morality', friends: 'asset:illu-03-consideration', resp: 'asset:illu-04-responsibility', respect: 'asset:illu-05-respect', humility: 'asset:illu-06-humility', forgive: 'asset:illu-07-forgiveness', justice: 'asset:illu-09-justice', honesty: 'asset:illu-10-honesty', fairness: 'asset:illu-11-fairness', coop: 'asset:illu-12-cooperation', back: 'asset:backcover-logo', target: 'asset:target-icon' };
  const H = (uid) => ({
    T: (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: 'Noto Sans KR', size: 12, weight: 400, italic: false, color: INK, align: 'left', lh: 1.35, ls: 0, strokeW: 0, strokeC: WHITE, shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, st),
    I: (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }, st),
    S: (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: YEL, stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st),
    C: (year, month, x, y, w, h, s) => ({ id: uid(), type: 'cal', year, month, x, y, w, h, rot: 0, opacity: 1, s: s || {}, events: [], notes: [], name: `${month}월 달력` }),
    M: (year, month, x, y, w, h, s) => ({ id: uid(), type: 'mini', year, month, x, y, w, h, rot: 0, opacity: 1, s: s || {}, name: `${month}월` }),
    P: (bg, els, label) => ({ id: uid(), bg, els, label }),
  });
  // 색상 팔레트: bg 바탕, fg 주색(제목), ac 강조, soft 상자, tx 본문, sub 보조글
  const PAL = {
    yellow: { name: '옐로', bg: YEL, fg: NAVY, ac: RED, soft: WHITE, tx: INK, sub: '#444' },
    navy: { name: '네이비', bg: NAVY, fg: YEL, ac: WHITE, soft: '#2B3C78', tx: WHITE, sub: '#C8CFE4' },
    mint: { name: '민트', bg: MINT, fg: GREEN, ac: RED, soft: WHITE, tx: INK, sub: '#3B5A4A' },
    red: { name: '레드', bg: RED, fg: WHITE, ac: YEL, soft: '#EE7B70', tx: WHITE, sub: '#FFE3DF' },
    sky: { name: '스카이', bg: SKY, fg: NAVY, ac: RED, soft: WHITE, tx: INK, sub: '#4A5568' },
    lavender: { name: '라벤더', bg: LAV, fg: PURPLE, ac: RED, soft: WHITE, tx: INK, sub: '#5A4B7A' },
    dark: { name: '블랙', bg: '#1B1B1B', fg: '#E6C068', ac: WHITE, soft: '#2A2A2A', tx: WHITE, sub: '#BBBBBB' },
  };
  const vary = (base, pals) => pals.forEach(k => L.push(Object.assign({}, base, { id: base.id + '-' + k, name: base.name + ' · ' + PAL[k].name, pal: PAL[k] })));
  const add = t => L.push(t);
  const foot = (T, y, w, color) => T(`나라차태권도  ·  ${ADDR}  ·  ${PHONE}`, 0, y, w, 7, { size: 9.5, color: color || '#444', align: 'center', weight: 500, name: '하단 정보' });

  /* ===== 색상 변형 템플릿 (각 4~5종) ===== */
  vary({ id: 'sns-quote', cat: 'sns', name: '오늘의 명언 카드', w: 285.75, h: 285.75, build(uid, c) { const { T, I, S, P } = H(uid); return [P(c.bg, [
    T('오늘의 한마디', 24, 30, 160, 10, { font: 'Montserrat', size: 12, weight: 700, color: c.ac, ls: 0.3 }),
    S('rect', 24, 46, 40, 1.2, { fill: c.ac }),
    T('"누가 지켜보지 않아도\n올바른 선택을 하는 것,\n그것이 참다운 정직입니다."', 24, 60, 238, 120, { font: 'Gowun Batang', size: 30, weight: 700, color: c.fg, lh: 1.5, name: '명언' }),
    T('— 10월 인성 덕목 · 정직', 24, 190, 200, 12, { size: 15, weight: 500, color: c.sub, name: '출처' }),
    I(D.honesty, 186, 176, 86, 90, { pos: '50% 100%', name: '삽화' }),
    T('나라차태권도', 24, 250, 180, 10, { font: 'Montserrat', size: 11, weight: 700, color: c.fg, ls: 0.2 }),
  ], '명언 카드')]; } }, ['yellow', 'navy', 'mint', 'lavender', 'dark']);

  vary({ id: 'sns-welcome', cat: 'sns', name: '신규 입관 환영 카드', w: 285.75, h: 285.75, build(uid, c) { const { T, I, S, P } = H(uid); return [P(c.bg, [
    S('ellipse', 170, -40, 170, 170, { fill: c.soft, opacity: 0.9, name: '장식' }),
    T('WELCOME', 24, 34, 200, 12, { font: 'Montserrat', size: 14, weight: 800, color: c.ac, ls: 0.35 }),
    T('새 가족을\n환영합니다', 24, 52, 220, 90, { font: 'Jua', size: 56, color: c.fg, lh: 1.1, name: '제목' }),
    T('홍길동 · 김나라 수련생\n이번 주 나라차태권도에 첫발을 내디뎠어요.\n함께 응원해 주세요!', 24, 150, 230, 60, { size: 18, weight: 500, lh: 1.55, color: c.tx, name: '내용' }),
    I(D.m4, 190, 186, 80, 80, { name: '마스코트' }),
    T('나라차태권도', 24, 250, 180, 10, { font: 'Montserrat', size: 11, weight: 700, color: c.fg, ls: 0.2 }),
  ], '환영 카드')]; } }, ['yellow', 'navy', 'mint', 'sky']);

  vary({ id: 'poster-show', cat: 'poster', name: '발표회 포스터', w: 210, h: 297, build(uid, c) { const { T, I, S, P } = H(uid); return [P(c.bg, [
    I(D.swoosh, 180, 12, 18, 16, { name: '로고' }),
    T('2027 NARACHA SHOWCASE', 14, 20, 150, 8, { font: 'Montserrat', size: 10, weight: 700, color: c.ac, ls: 0.3 }),
    T('태권도\n발표회', 14, 36, 182, 76, { font: 'Black Han Sans', size: 72, color: c.fg, lh: 1.02, name: '제목' }),
    T('품새 · 격파 · 태권체조 · 시범단 공연', 14, 118, 182, 10, { size: 15, weight: 600, color: c.tx }),
    I(D.coop, 40, 132, 130, 84, { name: '삽화' }),
    S('rect', 14, 224, 182, 40, { fill: c.soft, radius: 5 }),
    T('2027년 12월 18일(토) 오후 2시  ·  ○○문화회관 대강당\n입장 무료 · 가족 모두 초대합니다', 22, 232, 166, 26, { size: 12.5, lh: 1.6, weight: 600, color: c.bg === NAVY || c.bg === RED || c.bg === '#1B1B1B' ? WHITE : c.tx, align: 'center', name: '안내' }),
    T(`나라차태권도  ·  ${PHONE}`, 14, 276, 182, 8, { size: 11, color: c.sub, align: 'center', weight: 500 }),
  ], '발표회 포스터')]; } }, ['navy', 'yellow', 'red', 'dark']);

  vary({ id: 'coupon-trial', cat: 'sticker', name: '무료 체험 쿠폰', w: 180, h: 80, build(uid, c) { const { T, I, S, P } = H(uid); return [P(c.bg, [
    S('rect', 4, 4, 172, 72, { fill: '', stroke: c.fg, strokeW: 0.5, radius: 3, name: '테두리' }),
    S('rect', 122, 4, 0.5, 72, { fill: c.fg, opacity: 0.5, name: '절취선' }),
    T('FREE TRIAL COUPON', 12, 12, 100, 6, { font: 'Montserrat', size: 8, weight: 800, color: c.ac, ls: 0.3 }),
    T('무료 체험수업\n1회 이용권', 12, 21, 104, 30, { font: 'Jua', size: 24, color: c.fg, lh: 1.1, name: '제목' }),
    T(`유효기간 2027. 12. 31 까지  ·  예약 ${PHONE}`, 12, 60, 106, 6, { size: 7.5, color: c.sub, weight: 500 }),
    I(D.m1, 128, 10, 44, 44, { name: '마스코트' }),
    T('나라차태권도', 126, 60, 46, 6, { font: 'Montserrat', size: 7, weight: 700, color: c.fg, align: 'center', ls: 0.15 }),
  ], '체험 쿠폰')]; } }, ['yellow', 'navy', 'mint', 'red']);

  vary({ id: 'nametag', cat: 'sticker', name: '수련생 명찰', w: 90, h: 60, build(uid, c) { const { T, I, S, P } = H(uid); return [P(c.bg, [
    S('rect', 0, 0, 90, 16, { fill: c.fg }),
    T('NARACHA TAEKWONDO', 6, 5.5, 60, 5, { font: 'Montserrat', size: 7, weight: 700, color: c.bg === NAVY ? NAVY : (c.fg === WHITE ? c.bg : WHITE), ls: 0.2 }),
    I(D.swoosh, 76, 3.5, 10, 9, { name: '로고' }),
    T('홍 길 동', 6, 24, 56, 14, { font: 'Do Hyeon', size: 26, color: c.tx, name: '이름' }),
    T('초등부 · 노란띠', 6, 44, 56, 6, { size: 8.5, weight: 600, color: c.sub, name: '소속' }),
    I(D.m8, 62, 20, 26, 36, { pos: '50% 100%', name: '마스코트' }),
  ], '명찰')]; } }, ['yellow', 'sky', 'mint', 'navy']);

  vary({ id: 'card-thanks', cat: 'card', name: '감사 카드', w: 148, h: 105, build(uid, c) { const { T, I, S, P } = H(uid); return [P(c.bg, [
    S('rect', 6, 6, 136, 93, { fill: '', stroke: c.fg, strokeW: 0.5, radius: 3 }),
    T('THANK YOU', 12, 14, 124, 7, { font: 'Montserrat', size: 10, weight: 800, color: c.ac, align: 'center', ls: 0.35 }),
    T('감사합니다', 12, 24, 124, 20, { font: 'Gowun Batang', size: 30, weight: 700, color: c.fg, align: 'center', name: '제목' }),
    T('한 해 동안 보내 주신 믿음과 응원 덕분에\n아이들이 더 바르고 건강하게 자랐습니다.\n새해에도 변함없는 사랑 부탁드립니다.', 14, 50, 120, 30, { size: 9.5, lh: 1.6, align: 'center', color: c.tx, name: '내용' }),
    T('나라차태권도 사범 일동', 12, 88, 124, 6, { size: 8.5, weight: 600, align: 'center', color: c.sub }),
    I(D.m5, 116, 62, 22, 30, { pos: '50% 100%', name: '마스코트' }),
  ], '감사 카드')]; } }, ['yellow', 'mint', 'lavender', 'navy']);

  /* ===== 달력 낱장 (연도는 문서의 캘린더 연도) ===== */
  add({ id: 'cal-a4-month', cat: 'calpage', name: 'A4 월간 달력 (사진형)', w: 210, h: 297, build(uid, c, ctx) { const { T, I, S, P, C, M } = H(uid); const y = ctx.year; return [P(WHITE, [
    I(D.group, 12, 12, 186, 112, { fit: 'cover', radius: 4, name: '사진' }),
    T('1', 12, 132, 40, 22, { font: 'Montserrat', size: 52, weight: 800, lh: 1, color: NAVY, name: '월 숫자' }),
    T(`JANUARY ${y}`, 44, 142, 100, 8, { font: 'Montserrat', size: 10, weight: 700, ls: 0.25, color: '#666', name: '연월' }),
    M(y, 2, 156, 132, 42, 22), M(y, 12, 112, 132, 42, 22, { showTitle: true }),
    C(y, 1, 12, 160, 186, 118, { wdLang: 'short', rows: 'auto' }),
    T('나라차태권도', 12, 284, 186, 6, { font: 'Montserrat', size: 8, weight: 700, color: '#888', align: 'center', ls: 0.3 }),
  ], '월간 달력')]; } });
  add({ id: 'cal-a3-year', cat: 'calpage', name: 'A3 연간 달력 (한 장)', w: 420, h: 297, build(uid, c, ctx) { const { T, I, S, P, M } = H(uid); const y = ctx.year; const els = [
    S('rect', 0, 0, 420, 44, { fill: NAVY }), I(D.logo, 18, 12, 80, 20, { name: '로고' }),
    T(String(y), 300, 6, 100, 32, { font: 'Montserrat', size: 56, weight: 800, color: YEL, align: 'right', lh: 1 }),
    T('연간 달력  ·  나라차태권도', 120, 17, 160, 10, { size: 13, weight: 600, color: WHITE }),
  ]; for (let m = 1; m <= 12; m++) { const col = (m - 1) % 4, row = Math.floor((m - 1) / 4); const x = 18 + col * 98, yy = 56 + row * 78; els.push(S('rect', x, yy, 90, 70, { fill: m % 2 ? GRAY : WHITE, radius: 2, stroke: '#E3E6EC', strokeW: 0.25 })); els.push(M(y, m, x + 3, yy + 3, 84, 64, { titleSize: 11, wdSize: 5.5, numSize: 6.5 })); }
    els.push(T(`${ADDR}  ·  ${PHONE}`, 18, 288, 384, 6, { size: 8.5, color: '#666', align: 'center' }));
    return [P(WHITE, els, '연간 달력')]; } });
  add({ id: 'cal-week', cat: 'calpage', name: '주간 계획표', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const days = ['월', '화', '수', '목', '금', '토', '일']; const els = [
    S('rect', 0, 0, 210, 30, { fill: YEL }), I(D.swoosh, 14, 8, 15, 13, { name: '로고' }),
    T('이번 주 수련 계획', 34, 9, 120, 12, { size: 18, weight: 700, color: NAVY }), T('이름 : ____________    주차 : ____월 ____주', 14, 36, 182, 7, { size: 10.5, color: '#444' }),
  ]; days.forEach((d, i) => { const y = 48 + i * 31; els.push(S('rect', 14, y, 26, 27, { fill: i === 6 ? '#FBE3E0' : i === 5 ? '#E6EDF2' : NAVY, radius: 2 })); els.push(T(d, 14, y + 8, 26, 10, { size: 16, weight: 700, color: i >= 5 ? NAVY : WHITE, align: 'center' })); els.push(S('rect', 42, y, 154, 27, { fill: WHITE, stroke: '#CFD4DD', strokeW: 0.3, radius: 2 })); els.push(T('□ 수련   □ 줄넘기 ____회   □ 품새 연습   □ 독서', 48, y + 4, 142, 6, { size: 9, color: '#555' })); els.push(S('line', 48, y + 19, 142, 0.2, { fill: '#D9DDE5' })); });
    els.push(T('이번 주 목표 : ____________________________________    사범님 확인 : ______', 14, 268, 182, 8, { size: 10.5, color: '#444' }));
    els.push(I(D.m9, 170, 276, 24, 20, { name: '마스코트' }));
    return [P(WHITE, els, '주간 계획표')]; } });
  add({ id: 'cal-desk-photo', cat: 'calpage', name: '탁상 달력 (사진 위·달력 아래)', w: 224, h: 154, build(uid, c, ctx) { const { T, I, S, P, C, M } = H(uid); const y = ctx.year; return [P(WHITE, [
    I(D.group, 0, 0, 224, 72, { fit: 'cover', name: '사진' }),
    S('rect', 0, 72, 224, 1.2, { fill: NAVY }),
    T('1', 10, 78, 24, 16, { font: 'Montserrat', size: 36, weight: 800, lh: 1, color: NAVY, name: '월 숫자' }),
    T(`JANUARY ${y}`, 32, 86, 80, 6, { font: 'Montserrat', size: 7.5, weight: 700, ls: 0.25, color: '#666', name: '연월' }),
    M(y, 2, 176, 76, 40, 20),
    C(y, 1, 10, 96, 204, 52, { wdLang: 'short', wdH: 4, wdSize: 6, daySize: 6, evSize: 5.5, cellPad: 0.6, rows: 'merge' }),
  ], '사진 탁상 달력')]; } });

  /* ===== 리플렛·입간판·웹·영상 ===== */
  add({ id: 'leaflet-intro', cat: 'leaflet', name: '도장 소개 리플렛 (3단 접지)', w: 297, h: 210, build(uid) { const { T, I, S, P } = H(uid); const cw = 99; const els = [
    S('rect', 99, 0, 0.25, 210, { fill: '#DDD', name: '접는 선' }), S('rect', 198, 0, 0.25, 210, { fill: '#DDD', name: '접는 선 2' }),
    // 1면: 표지 (오른쪽 면)
    S('rect', 198, 0, 99, 210, { fill: NAVY }), I(D.logo, 212, 20, 72, 18, { name: '로고' }),
    T('바른 인성,\n건강한 성장', 210, 60, 76, 40, { font: 'Jua', size: 26, color: YEL, lh: 1.15, name: '표지 제목' }),
    I(D.pride, 214, 100, 68, 76, { name: '표지 삽화' }), T(`${ADDR}\n${PHONE}`, 210, 186, 76, 14, { size: 8, lh: 1.5, color: '#C8CFE4' }),
    // 2면: 소개 (왼쪽 면)
    T('나라차태권도는', 12, 16, 76, 8, { size: 14, weight: 700, color: NAVY }),
    T('2010년부터 지역 아이들의 몸과 마음을 함께 길러 온 태권도장입니다. 국기원 공인 사범진이 연령별 맞춤 수련으로 자신감과 예절을 가르칩니다.', 12, 28, 76, 50, { size: 9, lh: 1.7, color: '#333', name: '소개' }),
    T('지도 철학', 12, 86, 76, 8, { size: 12, weight: 700, color: RED }),
    T('· 인성이 먼저, 기술은 그다음\n· 매달 하나의 덕목을 실천\n· 칭찬과 격려 중심의 수련', 12, 96, 76, 30, { size: 9, lh: 1.7, color: '#333' }),
    I(D.respect, 16, 130, 68, 64, { name: '삽화' }),
    // 3면: 프로그램 (가운데 면)
    T('프로그램', 111, 16, 76, 8, { size: 14, weight: 700, color: NAVY }),
    S('rect', 111, 28, 76, 0.5, { fill: YEL }),
    T('유아부 (5~7세)\n기초 체력과 예절, 놀이 중심 수련\n\n초등부 (8~13세)\n품새·겨루기·격파, 승급심사 준비\n\n청소년·성인부\n체력 관리와 호신술, 심신 단련\n\n시범단\n선발 수련생 대상 공연·대회 출전', 111, 34, 76, 110, { size: 8.8, lh: 1.6, color: '#333', name: '프로그램' }),
    S('rect', 111, 150, 76, 44, { fill: YEL, radius: 3 }),
    T('무료 체험 수업', 111, 156, 76, 8, { size: 12, weight: 700, color: NAVY, align: 'center' }),
    T(`도복 대여 · 학부모 참관 가능\n예약 ${PHONE}`, 111, 168, 76, 20, { size: 8.5, lh: 1.6, align: 'center', color: '#333' }),
  ]; return [P(WHITE, els, '리플렛 겉면')]; } });
  add({ id: 'xbanner', cat: 'banner', name: 'X배너 입간판 (60×180cm)', w: 600, h: 1800, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
    S('rect', 0, 0, 600, 420, { fill: NAVY }), I(D.logo, 90, 110, 420, 110, { name: '로고' }),
    T('NEW MEMBERS', 40, 260, 520, 40, { font: 'Montserrat', size: 60, weight: 700, color: YEL, align: 'center', ls: 0.3 }),
    T('신규\n수련생\n모집', 40, 470, 520, 560, { font: 'Black Han Sans', size: 270, color: NAVY, align: 'center', lh: 1.02, name: '제목' }),
    I(D.m1, 120, 1040, 360, 360, { name: '마스코트' }),
    S('rect', 60, 1440, 480, 110, { fill: NAVY, radius: 55 }),
    T(`무료 체험  ${PHONE}`, 60, 1468, 480, 60, { size: 62, weight: 700, color: YEL, align: 'center', lh: 1 }),
    T('바른 인성 · 건강한 체력 · 즐거운 수련', 40, 1600, 520, 60, { size: 46, weight: 600, color: RED, align: 'center' }),
    T(`나라차태권도  ·  ${ADDR}`, 40, 1700, 520, 40, { size: 30, weight: 500, color: '#444', align: 'center' }),
  ], 'X배너')]; } });
  add({ id: 'yt-thumb', cat: 'web', name: '유튜브 썸네일 (1280×720)', w: 338.67, h: 190.5, build(uid) { const { T, I, S, P } = H(uid); return [P(NAVY, [
    S('rect', 0, 0, 160, 190.5, { fill: YEL }),
    I(D.pride, 10, 14, 140, 170, { pos: '50% 100%', name: '삽화' }),
    T('승급심사\n완벽 준비법', 170, 30, 160, 90, { font: 'Black Han Sans', size: 48, color: WHITE, lh: 1.05, strokeW: 2, strokeC: NAVY, name: '제목' }),
    S('rect', 170, 126, 120, 22, { fill: RED, radius: 11 }),
    T('사범님이 알려줘요', 170, 131, 120, 12, { size: 15, weight: 700, color: WHITE, align: 'center' }),
    T('NARACHA TAEKWONDO', 170, 168, 160, 10, { font: 'Montserrat', size: 11, weight: 700, color: YEL, ls: 0.25 }),
  ], '유튜브 썸네일')]; } });
  add({ id: 'web-banner', cat: 'web', name: '웹 배너 (1200×400)', w: 317.5, h: 105.83, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
    S('rect', 0, 0, 10, 105.83, { fill: RED }),
    I(D.logo, 24, 14, 80, 20, { name: '로고' }),
    T('2027 신규 수련생 모집', 24, 40, 200, 24, { font: 'Black Han Sans', size: 40, color: NAVY, lh: 1, name: '제목' }),
    T(`무료 체험 1회 · 6세~성인 · ${PHONE}`, 24, 72, 200, 10, { size: 14, weight: 600, color: '#333' }),
    I(D.friends, 220, 4, 94, 100, { pos: '50% 100%', name: '삽화' }),
  ], '웹 배너')]; } });
  add({ id: 'sns-carousel', cat: 'sns', name: '캐러셀 (4:5, 1080×1350)', w: 285.75, h: 357.19, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
    S('rect', 0, 0, 285.75, 120, { fill: NAVY }),
    T('STEP 1 / 4', 24, 30, 200, 10, { font: 'Montserrat', size: 13, weight: 700, color: YEL, ls: 0.3 }),
    T('태권도 기본 자세\n주춤서기', 24, 48, 240, 60, { font: 'Jua', size: 40, color: WHITE, lh: 1.15, name: '제목' }),
    I(D.resp, 50, 130, 186, 150, { name: '삽화' }),
    T('발을 어깨너비의 두 배로 벌리고 무릎을 굽혀 허벅지가 바닥과 평행이 되도록 앉습니다. 허리는 곧게, 시선은 정면.', 24, 290, 238, 50, { size: 17, lh: 1.55, color: '#333', name: '내용' }),
    T('→ 다음 장', 24, 338, 120, 10, { size: 13, weight: 600, color: NAVY }),
  ], '캐러셀')]; } });

  /* ===== 스티커·티켓·라벨 ===== */
  add({ id: 'sticker-praise', cat: 'sticker', name: '칭찬 스티커 (원형 6cm)', w: 60, h: 60, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
    S('ellipse', 1, 1, 58, 58, { fill: YEL, stroke: NAVY, strokeW: 1 }),
    S('ellipse', 5, 5, 50, 50, { fill: '', stroke: NAVY, strokeW: 0.3 }),
    T('참 잘했어요!', 6, 14, 48, 10, { font: 'Jua', size: 15, color: NAVY, align: 'center', name: '문구' }),
    I(D.m3, 18, 24, 24, 24, { name: '마스코트' }),
    T('NARACHA', 6, 49, 48, 5, { font: 'Montserrat', size: 6, weight: 700, color: RED, align: 'center', ls: 0.3 }),
  ], '칭찬 스티커')]; } });
  add({ id: 'sticker-belt', cat: 'sticker', name: '승급 축하 스티커 (원형 6cm)', w: 60, h: 60, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
    S('ellipse', 1, 1, 58, 58, { fill: NAVY }),
    S('star', 20, 6, 20, 20, { fill: YEL, name: '별' }),
    T('승급 축하', 6, 27, 48, 9, { font: 'Jua', size: 14, color: WHITE, align: 'center', name: '문구' }),
    T('노란띠 → 초록띠', 6, 38, 48, 6, { size: 7, weight: 600, color: YEL, align: 'center', name: '띠' }),
    T('2027. 3', 6, 46, 48, 5, { font: 'Montserrat', size: 6, weight: 700, color: '#C8CFE4', align: 'center' }),
  ], '승급 스티커')]; } });
  add({ id: 'ticket-show', cat: 'sticker', name: '발표회 입장권', w: 180, h: 70, build(uid) { const { T, I, S, P } = H(uid); return [P(NAVY, [
    S('rect', 130, 0, 50, 70, { fill: YEL }), S('rect', 129.5, 4, 0.6, 62, { fill: WHITE, opacity: 0.6, name: '절취선' }),
    T('ADMISSION TICKET', 10, 9, 110, 6, { font: 'Montserrat', size: 7.5, weight: 800, color: YEL, ls: 0.3 }),
    T('2027 나라차 태권도 발표회', 10, 18, 115, 14, { font: 'Jua', size: 17, color: WHITE, name: '제목' }),
    T('2027. 12. 18 (토) 14:00  ·  ○○문화회관 대강당\n좌석 자유  ·  초대권', 10, 40, 115, 20, { size: 7.5, lh: 1.6, color: '#C8CFE4' }),
    I(D.swoosh, 110, 50, 14, 12, { name: '로고' }),
    T('No. 0001', 134, 10, 42, 6, { font: 'Montserrat', size: 7, weight: 700, color: NAVY, align: 'center' }),
    I(D.m7, 140, 18, 30, 30, { name: '마스코트' }),
    T('입장권', 134, 52, 42, 8, { size: 10, weight: 700, color: NAVY, align: 'center' }),
  ], '입장권')]; } });
  add({ id: 'label-goods', cat: 'sticker', name: '용품 이름 라벨 (5×3cm)', w: 50, h: 30, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
    S('rect', 0.5, 0.5, 49, 29, { fill: '', stroke: NAVY, strokeW: 0.5, radius: 2 }), S('rect', 0.5, 0.5, 49, 8, { fill: NAVY, radius: 2 }),
    T('NARACHA TAEKWONDO', 2, 2.6, 46, 4, { font: 'Montserrat', size: 5.5, weight: 700, color: YEL, align: 'center', ls: 0.15 }),
    T('홍 길 동', 2, 12, 46, 9, { font: 'Do Hyeon', size: 16, color: INK, align: 'center', name: '이름' }),
    T('초등부 · 호구 가방', 2, 22, 46, 5, { size: 6, color: '#555', align: 'center', name: '물품' }),
  ], '이름 라벨')]; } });

  /* ===== 상장·증서 추가 ===== */
  add({ id: 'cert-thanks', cat: 'cert', name: '감사장', w: 297, h: 210, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
    S('rect', 8, 8, 281, 194, { fill: '', stroke: GOLD, strokeW: 1.2 }), S('rect', 11, 11, 275, 188, { fill: '', stroke: GOLD, strokeW: 0.3 }),
    T('감  사  장', 20, 30, 257, 26, { font: 'Nanum Myeongjo', size: 44, weight: 700, color: NAVY, align: 'center', lh: 1 }),
    T('○○○ 학부모님', 20, 70, 257, 12, { size: 19, weight: 600, align: 'center', font: 'Nanum Myeongjo' }),
    T('귀하께서는 한 해 동안 도장 행사와 아이들의 수련에\n아낌없는 관심과 도움을 주셨기에 깊은 감사의 마음을 담아\n이 감사장을 드립니다.', 36, 92, 225, 40, { size: 13, lh: 1.9, align: 'center', font: 'Nanum Myeongjo', name: '내용' }),
    T('2027년  12월  18일', 20, 146, 257, 8, { size: 13, align: 'center', font: 'Nanum Myeongjo' }),
    T('나라차태권도  관장  ○ ○ ○  (인)', 20, 160, 257, 10, { size: 15, weight: 600, align: 'center', font: 'Nanum Myeongjo' }),
    I(D.logo, 118, 180, 60, 14, { name: '로고' }),
  ], '감사장')]; } });
  add({ id: 'cert-appoint', cat: 'cert', name: '임명장 (시범단·반장)', w: 297, h: 210, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
    S('rect', 0, 0, 297, 18, { fill: NAVY }), S('rect', 0, 18, 297, 3, { fill: YEL }),
    T('임  명  장', 20, 36, 257, 24, { font: 'Nanum Myeongjo', size: 42, weight: 700, color: NAVY, align: 'center', lh: 1 }),
    T('2027 나라차 시범단  ·  단장', 20, 66, 257, 9, { size: 14, weight: 600, align: 'center', color: RED }),
    T('홍 길 동', 20, 84, 257, 12, { size: 22, weight: 700, align: 'center', font: 'Nanum Myeongjo' }),
    T('위 수련생을 2027년 나라차 시범단 단장으로 임명합니다.\n책임감과 협동의 모범이 되어 주기 바랍니다.', 36, 104, 225, 26, { size: 13, lh: 1.9, align: 'center', font: 'Nanum Myeongjo', name: '내용' }),
    T('2027년  1월  10일', 20, 142, 257, 8, { size: 13, align: 'center', font: 'Nanum Myeongjo' }),
    T('나라차태권도  관장  ○ ○ ○  (인)', 20, 156, 257, 10, { size: 15, weight: 600, align: 'center', font: 'Nanum Myeongjo' }),
    I(D.m11, 236, 150, 44, 44, { name: '마스코트' }), I(D.logo, 20, 182, 56, 13, { name: '로고' }),
  ], '임명장')]; } });

  /* ===== 서식 (출석표·진도표·일지·체크리스트·자리배치) ===== */
  const table = (S, T, x, y, w, rowH, cols, rows, opts) => { const els = []; let cx = x; const widths = cols.map(c => c[1]); cols.forEach(([t, cw], i) => { els.push(S('rect', cx, y, cw, rowH, { fill: (opts && opts.head) || NAVY })); els.push(T(t, cx, y + rowH * 0.28, cw, rowH * 0.6, { size: (opts && opts.hs) || 9, weight: 700, color: WHITE, align: 'center' })); cx += cw; }); for (let r = 0; r < rows; r++) { cx = x; const yy = y + rowH * (r + 1); widths.forEach((cw, i) => { els.push(S('rect', cx, yy, cw, rowH, { fill: r % 2 ? GRAY : WHITE, stroke: '#D3D7DF', strokeW: 0.2 })); cx += cw; }); } return els; };
  add({ id: 'sheet-attendance', cat: 'sheet', name: '출석표 (월간)', w: 297, h: 210, build(uid) { const { T, I, S, P } = H(uid); const els = [ I(D.swoosh, 10, 8, 12, 10, { name: '로고' }), T('2027년  ___월  출석표', 26, 8, 150, 10, { size: 16, weight: 700, color: NAVY }), T('반 : ________   담당 사범 : ________', 190, 11, 97, 7, { size: 9, color: '#444', align: 'right' }) ];
    const cols = [['번호', 9], ['이름', 24]]; for (let d = 1; d <= 31; d++) cols.push([String(d), 7.6]); cols.push(['계', 10]);
    els.push(...table(S, T, 10, 22, 277, 7.4, cols, 23, { hs: 6.5 }));
    for (let r = 0; r < 23; r++) els.push(T(String(r + 1), 10, 22 + 7.4 * (r + 1) + 2, 9, 5, { size: 7, align: 'center', color: '#555' }));
    els.push(T('표기: ○ 출석  △ 지각  × 결석  / 보강', 10, 202, 200, 6, { size: 8, color: '#666' }));
    return [P(WHITE, els, '출석표')]; } });
  add({ id: 'sheet-belts', cat: 'sheet', name: '띠 승급 진도표', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const belts = [['흰띠', '#F5F5F5', '기본 서기·주먹 지르기'], ['노란띠', '#F2D53C', '태극 1장·앞차기'], ['초록띠', '#3E9C5A', '태극 2·3장·돌려차기'], ['파란띠', '#2D5FB8', '태극 4·5장·옆차기'], ['빨간띠', '#D13B3B', '태극 6·7장·뒤차기'], ['품띠', '#8B1E1E', '태극 8장·겨루기 기초'], ['검은띠', '#111111', '고려·시범 기술']]; const els = [
    S('rect', 0, 0, 210, 34, { fill: NAVY }), I(D.logo, 14, 8, 60, 16, { name: '로고' }), T('띠 승급 진도표', 90, 10, 106, 14, { size: 20, weight: 700, color: YEL, align: 'right' }),
    T('이름 : ______________     입관일 : ____________', 14, 42, 182, 8, { size: 11, color: '#444' }),
  ]; belts.forEach(([n, col, skill], i) => { const y = 56 + i * 30; els.push(S('rect', 14, y, 182, 26, { fill: WHITE, stroke: '#D3D7DF', strokeW: 0.3, radius: 3 })); els.push(S('rect', 14, y, 10, 26, { fill: col, radius: 3 })); els.push(T(n, 30, y + 5, 40, 8, { size: 13, weight: 700, color: NAVY })); els.push(T(skill, 30, y + 14, 90, 7, { size: 9, color: '#555', name: '기술' })); els.push(T('승급일  ____. ____. ____', 120, y + 6, 70, 7, { size: 9, color: '#444' })); els.push(T('사범 확인  ______', 120, y + 15, 70, 7, { size: 9, color: '#444' })); });
    els.push(I(D.m8, 160, 262, 34, 30, { name: '마스코트' })); els.push(T('한 칸씩 채워 가며 검은띠까지!', 14, 272, 140, 8, { size: 12, weight: 600, color: RED }));
    return [P(WHITE, els, '진도표')]; } });
  add({ id: 'sheet-journal', cat: 'sheet', name: '수련 일지', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const els = [
    S('rect', 0, 0, 210, 28, { fill: YEL }), I(D.swoosh, 14, 8, 14, 12, { name: '로고' }), T('나의 수련 일지', 34, 8, 120, 12, { size: 18, weight: 700, color: NAVY }),
    T('날짜 : 2027. ____. ____  (  )요일        이름 : ____________', 14, 36, 182, 8, { size: 11, color: '#444' }),
    T('오늘 배운 것', 14, 52, 100, 8, { size: 12, weight: 700, color: NAVY }), S('rect', 14, 62, 182, 50, { fill: WHITE, stroke: '#CFD4DD', strokeW: 0.3, radius: 3 }),
    T('잘한 점 / 고칠 점', 14, 120, 100, 8, { size: 12, weight: 700, color: NAVY }), S('rect', 14, 130, 182, 44, { fill: WHITE, stroke: '#CFD4DD', strokeW: 0.3, radius: 3 }),
    T('이달의 인성 실천  ☐ 했어요  ☐ 노력 중', 14, 182, 150, 8, { size: 12, weight: 700, color: NAVY }), S('rect', 14, 192, 182, 30, { fill: WHITE, stroke: '#CFD4DD', strokeW: 0.3, radius: 3 }),
    T('오늘의 기분', 14, 230, 60, 8, { size: 12, weight: 700, color: NAVY }), T('😀   🙂   😐   😢', 70, 229, 100, 10, { size: 16 }),
    T('사범님 한마디 : ______________________________________', 14, 248, 182, 8, { size: 11, color: '#444' }),
    I(D.m5, 166, 258, 30, 34, { name: '마스코트' }),
  ]; for (let i = 0; i < 4; i++) els.push(S('line', 18, 74 + i * 10, 174, 0.2, { fill: '#D9DDE5' })); for (let i = 0; i < 3; i++) els.push(S('line', 18, 142 + i * 10, 174, 0.2, { fill: '#D9DDE5' })); return [P(WHITE, els, '수련 일지')]; } });
  add({ id: 'sheet-checklist', cat: 'sheet', name: '준비물 체크리스트', w: 148, h: 210, build(uid) { const { T, I, S, P } = H(uid); const items = ['도복 (세탁한 것)', '띠', '명찰', '실내화', '물통', '수건', '줄넘기', '보호 장비 (겨루기 날)', '수련 일지', '마스크 (필요 시)']; const els = [
    S('rect', 0, 0, 148, 36, { fill: MINT }), I(D.swoosh, 10, 10, 14, 12, { name: '로고' }), T('수련 준비물 체크리스트', 30, 11, 110, 12, { size: 16, weight: 700, color: GREEN }),
  ]; items.forEach((it, i) => { const y = 46 + i * 14.5; els.push(S('rect', 12, y, 7, 7, { fill: WHITE, stroke: GREEN, strokeW: 0.5, radius: 1 })); els.push(T(it, 24, y + 0.5, 110, 7, { size: 11, weight: 500, name: '항목' })); els.push(S('line', 12, y + 10.5, 124, 0.2, { fill: '#D9E5DE' })); });
    els.push(I(D.m9, 104, 180, 34, 26, { name: '마스코트' })); els.push(T('빠짐없이 챙기면 오늘 수련도 성공!', 12, 196, 100, 7, { size: 9.5, weight: 600, color: RED }));
    return [P(WHITE, els, '체크리스트')]; } });
  add({ id: 'sheet-seats', cat: 'sheet', name: '자리 배치도', w: 297, h: 210, build(uid) { const { T, I, S, P } = H(uid); const els = [ T('자리 배치도  ·  ____월 ____반', 12, 10, 200, 10, { size: 16, weight: 700, color: NAVY }), S('rect', 60, 26, 177, 12, { fill: NAVY, radius: 6 }), T('사범님 (앞)', 60, 29, 177, 8, { size: 10, weight: 700, color: WHITE, align: 'center' }) ];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const x = 20 + c * 44, y = 48 + r * 38; els.push(S('rect', x, y, 38, 30, { fill: r % 2 ? GRAY : WHITE, stroke: '#CFD4DD', strokeW: 0.3, radius: 3 })); els.push(T(`${r * 6 + c + 1}`, x + 2, y + 2, 10, 5, { size: 7, color: '#999', font: 'Montserrat' })); els.push(T('이름', x, y + 12, 38, 8, { size: 10, weight: 600, align: 'center', color: '#444', name: '이름' })); }
    els.push(T('출입문 →', 250, 196, 40, 7, { size: 9, color: '#666' })); els.push(I(D.swoosh, 12, 190, 14, 12, { name: '로고' }));
    return [P(WHITE, els, '자리 배치도')]; } });
  add({ id: 'sheet-memo', cat: 'sheet', name: '메모지 (A5)', w: 148, h: 210, build(uid) { const { T, I, S, P } = H(uid); const els = [ S('rect', 0, 0, 148, 22, { fill: YEL }), I(D.logo, 10, 5, 46, 12, { name: '로고' }), T('MEMO', 100, 8, 40, 7, { font: 'Montserrat', size: 9, weight: 800, color: NAVY, align: 'right', ls: 0.3 }) ];
    for (let i = 0; i < 18; i++) els.push(S('line', 12, 36 + i * 9, 124, 0.2, { fill: '#D9DDE5' }));
    els.push(I(D.m3, 112, 184, 26, 22, { opacity: 0.8, name: '마스코트' })); return [P(WHITE, els, '메모지')]; } });
  add({ id: 'game-bingo', cat: 'sheet', name: '인성 빙고 (5×5)', w: 210, h: 210, build(uid) { const { T, I, S, P } = H(uid); const words = ['인사 잘하기', '숙제 끝내기', '줄넘기 100개', '친구 돕기', '물건 정리', '부모님께 안마', '품새 연습', '책 읽기', '일찍 자기', '칭찬하기', '쓰레기 줍기', '편식 안 하기', '기합 크게', '감사 인사', '약속 지키기', '양보하기', '스트레칭', '동생 돌보기', '설거지 돕기', '웃으며 인사', '격려 박수', '정직하게', '차례 지키기', '물 아끼기', '사과하기']; const els = [ T('인성 빙고', 10, 8, 190, 14, { font: 'Jua', size: 26, color: NAVY, align: 'center' }), T('실천한 칸에 ○표! 한 줄 완성하면 빙고', 10, 24, 190, 7, { size: 10, align: 'center', color: '#555' }) ];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const x = 15 + c * 36, y = 36 + r * 32; const center = r === 2 && c === 2; els.push(S('rect', x, y, 34, 30, { fill: center ? YEL : WHITE, stroke: NAVY, strokeW: 0.4, radius: 2 })); if (center) els.push(I(D.m1, x + 5, y + 3, 24, 24, { name: '마스코트' })); else els.push(T(words[r * 5 + c], x + 1, y + 10, 32, 10, { size: 9, weight: 600, align: 'center', color: INK, name: '칸' })); }
    els.push(T('이름 : __________', 15, 200, 100, 7, { size: 9, color: '#444' })); return [P(WHITE, els, '빙고')]; } });
  add({ id: 'garland', cat: 'sheet', name: '가랜드 (한 글자씩)', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const els = []; const letters = ['환', '영', '합', '니', '다', '!']; letters.forEach((ch, i) => { const x = 14 + (i % 3) * 64, y = 14 + Math.floor(i / 3) * 140; els.push(S('rect', x, y, 56, 100, { fill: i % 2 ? YEL : NAVY, radius: 3 })); els.push(S('tri', x, y + 100, 56, 28, { fill: i % 2 ? YEL : NAVY, rot: 180 })); els.push(T(ch, x, y + 24, 56, 50, { font: 'Black Han Sans', size: 90, color: i % 2 ? NAVY : YEL, align: 'center', lh: 1, name: '글자' })); els.push(S('ellipse', x + 25, y + 5, 6, 6, { fill: WHITE, name: '구멍' })); }); els.push(T('※ 잘라서 줄에 끼워 쓰세요', 14, 286, 180, 6, { size: 8, color: '#666' })); return [P(WHITE, els, '가랜드')]; } });

  /* ===== 안내문 추가 ===== */
  add({ id: 'notice-closed', cat: 'notice', name: '휴관 안내문', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
    S('rect', 0, 0, 210, 110, { fill: SKY }), I(D.logo, 14, 14, 64, 16, { name: '로고' }),
    T('휴관 안내', 14, 42, 182, 24, { font: 'Jua', size: 44, color: NAVY, name: '제목' }),
    T('설 연휴 2027. 2. 5(금) ~ 2. 8(월)', 14, 72, 182, 12, { size: 18, weight: 700, color: RED }),
    T('대체 휴일 포함 · 2. 9(화)부터 정상 수련', 14, 88, 182, 8, { size: 12, weight: 500, color: '#444' }),
    I(D.m7, 150, 36, 50, 66, { pos: '50% 100%', name: '마스코트' }),
    T('안내 말씀', 18, 124, 100, 8, { size: 14, weight: 700, color: NAVY }),
    T('설 연휴를 맞아 도장이 휴관합니다. 연휴 기간 차량 운행과 수련은 없으며, 보강 수련은 2월 둘째 주에 진행합니다. 가족과 함께 따뜻한 명절 보내시고 건강한 모습으로 다시 만나요.\n\n· 휴관 기간 : 2월 5일(금) ~ 2월 8일(월)\n· 정상 수련 : 2월 9일(화)\n· 보강 수련 : 2월 9일 ~ 12일, 반별 안내\n· 긴급 연락 : ' + PHONE, 18, 136, 174, 90, { size: 12, lh: 1.8, name: '본문' }),
    T('새해 복 많이 받으세요', 14, 240, 182, 12, { font: 'Nanum Brush Script', size: 30, color: NAVY, align: 'center' }),
    foot(T, 276, 210),
  ], '휴관 안내')]; } });
  add({ id: 'notice-openclass', cat: 'notice', name: '학부모 참관수업 안내', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
    S('rect', 0, 0, 210, 26, { fill: NAVY }), T('학부모 참관수업 안내', 14, 8, 182, 10, { size: 14, weight: 700, color: WHITE }), I(D.swoosh, 182, 6, 14, 12, { name: '로고' }),
    T('아이의 성장을\n직접 보러 오세요', 14, 40, 182, 40, { font: 'Jua', size: 34, color: NAVY, lh: 1.15, name: '제목' }),
    I(D.respect, 110, 86, 90, 70, { name: '삽화' }),
    T('일시  5월 ___일(___) 오후 ___시\n장소  도장 수련장\n내용  기본 동작 · 품새 발표 · 격파 체험 · 간담회', 14, 90, 100, 50, { size: 12, lh: 1.8, weight: 500, name: '안내' }),
    S('rect', 14, 166, 182, 56, { fill: GRAY, radius: 4 }),
    T('참관 신청서 (절취하여 제출)', 22, 172, 160, 8, { size: 12, weight: 700, color: NAVY }),
    T('수련생 이름 : ______________     참석 인원 : ____명\n보호자 성함 : ______________     연락처 : ______________\n□ 참석합니다     □ 불참합니다', 22, 184, 166, 34, { size: 11, lh: 1.8 }),
    T('2027년  4월  __일   나라차태권도', 14, 236, 182, 8, { size: 12, align: 'center', weight: 600, color: NAVY }),
    foot(T, 276, 210),
  ], '참관수업 안내')]; } });
  add({ id: 'notice-coach', cat: 'notice', name: '사범 소개', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const els = [ S('rect', 0, 0, 210, 40, { fill: YEL }), I(D.logo, 14, 10, 64, 16, { name: '로고' }), T('지도 사범 소개', 90, 13, 106, 12, { size: 18, weight: 700, color: NAVY, align: 'right' }) ];
    [['관장  ○ ○ ○', '국기원 공인 5단 · 생활체육지도자 2급', '“인성이 먼저입니다. 기술은 그 위에 쌓입니다.”', D.m1], ['사범  ○ ○ ○', '국기원 공인 4단 · 유아체육 전문', '“아이의 눈높이에서 함께 뜁니다.”', D.m4], ['사범  ○ ○ ○', '국기원 공인 3단 · 시범단 지도', '“멋진 발차기는 바른 자세에서 나옵니다.”', D.m9]].forEach(([n, q, m, img], i) => { const y = 52 + i * 72; els.push(S('rect', 14, y, 182, 62, { fill: WHITE, stroke: '#D9DDE5', strokeW: 0.3, radius: 4 })); els.push(S('rect', 20, y + 6, 50, 50, { fill: SKY, radius: 25 })); els.push(I(img, 25, y + 10, 40, 42, { name: '사진' })); els.push(T(n, 78, y + 10, 112, 9, { size: 15, weight: 700, color: NAVY, name: '이름' })); els.push(T(q, 78, y + 22, 112, 8, { size: 10, color: '#555', name: '경력' })); els.push(T(m, 78, y + 36, 112, 16, { size: 10.5, lh: 1.5, weight: 500, color: INK, name: '한마디' })); });
    els.push(foot(T, 276, 210)); return [P(WHITE, els, '사범 소개')]; } });
  add({ id: 'notice-items', cat: 'notice', name: '수련 준비물 안내', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const items = [['도복', '세탁 후 깨끗하게, 명찰 부착'], ['띠', '자기 띠를 스스로 매는 연습'], ['실내화', '도장 안에서만 신는 것'], ['물통', '이름을 꼭 적어 주세요'], ['보호 장비', '겨루기 수련일에만 (도장 대여 가능)'], ['수련 일지', '매주 금요일 사범님 확인']]; const els = [ S('rect', 0, 0, 210, 56, { fill: MINT }), I(D.logo, 14, 12, 64, 16, { name: '로고' }), T('수련 준비물 안내', 14, 32, 150, 14, { font: 'Jua', size: 26, color: GREEN, name: '제목' }), I(D.m8, 158, 8, 44, 48, { pos: '50% 100%', name: '마스코트' }) ];
    items.forEach(([a, b], i) => { const y = 70 + i * 30; els.push(S('rect', 14, y, 182, 24, { fill: i % 2 ? GRAY : WHITE, radius: 3 })); els.push(S('ellipse', 20, y + 5, 14, 14, { fill: GREEN })); els.push(T(String(i + 1), 20, y + 8, 14, 8, { font: 'Montserrat', size: 11, weight: 800, color: WHITE, align: 'center' })); els.push(T(a, 42, y + 4, 60, 8, { size: 13, weight: 700, color: NAVY, name: '준비물' })); els.push(T(b, 42, y + 13, 150, 7, { size: 10, color: '#555', name: '설명' })); });
    els.push(T('분실 방지를 위해 모든 물품에 이름을 적어 주세요.', 14, 256, 182, 8, { size: 11.5, weight: 600, color: RED, align: 'center' })); els.push(foot(T, 276, 210)); return [P(WHITE, els, '준비물 안내')]; } });

  /* ===== 명절·행사 ===== */
  add({ id: 'poster-seol', cat: 'season', name: '설날 인사 포스터', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P('#B8432B', [
    S('ellipse', 55, 60, 100, 100, { fill: YEL, name: '보름달' }),
    T('새해 복 많이 받으세요', 14, 176, 182, 24, { font: 'Nanum Brush Script', size: 54, color: WHITE, align: 'center', name: '제목' }),
    T('2027 정해년 · 나라차태권도 가족 여러분의 건강과 행복을 기원합니다', 14, 206, 182, 10, { size: 12, weight: 500, color: '#FFE3DF', align: 'center' }),
    I(D.m5, 76, 70, 60, 80, { pos: '50% 100%', name: '마스코트' }),
    I(D.swoosh, 96, 250, 18, 16, { name: '로고' }), T('NARACHA TAEKWONDO', 14, 272, 182, 8, { font: 'Montserrat', size: 10, weight: 700, color: YEL, align: 'center', ls: 0.3 }),
  ], '설날 인사')]; } });
  add({ id: 'poster-chuseok', cat: 'season', name: '추석 인사 포스터', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(NAVY, [
    S('ellipse', 120, 30, 70, 70, { fill: YEL, name: '보름달' }),
    T('풍성한 한가위\n되세요', 14, 150, 182, 60, { font: 'Gowun Batang', size: 42, weight: 700, color: WHITE, align: 'center', lh: 1.25, name: '제목' }),
    T('가족과 함께 넉넉하고 따뜻한 명절 보내시길 바랍니다', 14, 216, 182, 10, { size: 12, weight: 500, color: '#C8CFE4', align: 'center' }),
    I(D.respect, 20, 60, 110, 90, { pos: '50% 100%', name: '삽화' }),
    T('NARACHA TAEKWONDO', 14, 272, 182, 8, { font: 'Montserrat', size: 10, weight: 700, color: YEL, align: 'center', ls: 0.3 }),
  ], '추석 인사')]; } });
  add({ id: 'poster-yearend', cat: 'season', name: '송년회 포스터', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P('#1B1B1B', [
    S('star', 20, 20, 14, 14, { fill: GOLD }), S('star', 170, 40, 10, 10, { fill: GOLD }), S('star', 150, 230, 8, 8, { fill: GOLD }),
    T('2027', 14, 40, 182, 40, { font: 'Montserrat', size: 80, weight: 800, color: GOLD, align: 'center', lh: 1 }),
    T('나라차 가족 송년회', 14, 90, 182, 24, { font: 'Jua', size: 38, color: WHITE, align: 'center', name: '제목' }),
    T('한 해의 수고를 함께 나누는 밤', 14, 118, 182, 10, { size: 14, weight: 500, color: '#BBB', align: 'center' }),
    I(D.group, 30, 136, 150, 76, { name: '삽화' }),
    S('rect', 30, 222, 150, 36, { fill: '', stroke: GOLD, strokeW: 0.6, radius: 3 }),
    T('12월 23일(목) 오후 6시  ·  도장 수련장\n시상식 · 장기자랑 · 저녁 식사', 36, 229, 138, 22, { size: 12, lh: 1.6, weight: 600, color: WHITE, align: 'center', name: '안내' }),
    T('NARACHA TAEKWONDO', 14, 274, 182, 8, { font: 'Montserrat', size: 10, weight: 700, color: GOLD, align: 'center', ls: 0.3 }),
  ], '송년회')]; } });
  add({ id: 'poster-grad', cat: 'season', name: '수료·졸업 축하 포스터', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(SKY, [
    T('CONGRATULATIONS', 14, 24, 182, 10, { font: 'Montserrat', size: 13, weight: 800, color: RED, align: 'center', ls: 0.35 }),
    T('졸업을 축하합니다', 14, 40, 182, 30, { font: 'Jua', size: 42, color: NAVY, align: 'center', name: '제목' }),
    T('초등학교를 졸업하는 수련생 여러분, 새로운 출발을 응원합니다', 14, 76, 182, 10, { size: 12.5, weight: 500, color: '#444', align: 'center' }),
    I(D.coop, 30, 92, 150, 96, { name: '삽화' }),
    S('rect', 24, 198, 162, 50, { fill: WHITE, radius: 6 }),
    T('홍길동 · 김나라 · 이차차 · 박태권 · 최인성\n정의로 · 한공평 · 서협동', 30, 206, 150, 36, { size: 14, weight: 600, lh: 1.6, align: 'center', color: NAVY, name: '이름' }),
    T('나라차태권도 사범 일동', 14, 262, 182, 8, { size: 12, weight: 600, color: NAVY, align: 'center' }),
  ], '졸업 축하')]; } });
  add({ id: 'sns-seol', cat: 'season', name: 'SNS 설날 인사', w: 285.75, h: 285.75, build(uid) { const { T, I, S, P } = H(uid); return [P('#B8432B', [
    S('ellipse', 180, 30, 80, 80, { fill: YEL }),
    T('새해 복\n많이 받으세요', 24, 60, 238, 110, { font: 'Nanum Brush Script', size: 64, color: WHITE, lh: 1.1, name: '제목' }),
    T('2027년에도 나라차태권도가\n아이들의 건강한 성장을 함께합니다', 24, 184, 238, 40, { size: 18, weight: 500, lh: 1.5, color: '#FFE3DF', name: '내용' }),
    I(D.m5, 196, 180, 70, 86, { pos: '50% 100%', name: '마스코트' }),
    T('나라차태권도', 24, 250, 180, 10, { font: 'Montserrat', size: 11, weight: 700, color: YEL, ls: 0.2 }),
  ], 'SNS 설날')]; } });
  add({ id: 'sns-chuseok', cat: 'season', name: 'SNS 추석 인사', w: 285.75, h: 285.75, build(uid) { const { T, I, S, P } = H(uid); return [P(NAVY, [
    S('ellipse', 190, 24, 70, 70, { fill: YEL }),
    T('풍성한\n한가위', 24, 70, 238, 110, { font: 'Gowun Batang', size: 60, weight: 700, color: WHITE, lh: 1.15, name: '제목' }),
    T('가족과 함께 넉넉하고 따뜻한\n명절 보내세요', 24, 190, 238, 40, { size: 18, weight: 500, lh: 1.5, color: '#C8CFE4', name: '내용' }),
    I(D.m7, 196, 190, 70, 76, { pos: '50% 100%', name: '마스코트' }),
    T('나라차태권도', 24, 250, 180, 10, { font: 'Montserrat', size: 11, weight: 700, color: YEL, ls: 0.2 }),
  ], 'SNS 추석')]; } });
  add({ id: 'sns-photo-frame', cat: 'sns', name: '수련 사진 프레임', w: 285.75, h: 285.75, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
    S('rect', 20, 20, 245.75, 200, { fill: WHITE, radius: 4 }),
    I(D.group, 26, 26, 233.75, 188, { fit: 'cover', radius: 2, name: '사진 (바꿔 넣기)' }),
    T('오늘의 수련', 24, 230, 160, 14, { font: 'Jua', size: 24, color: NAVY, name: '제목' }),
    T('2027. 3. 15  ·  초등부 품새 수련', 24, 252, 200, 10, { size: 13, weight: 500, color: '#444', name: '설명' }),
    I(D.swoosh, 236, 232, 26, 22, { name: '로고' }),
  ], '사진 프레임')]; } });
  add({ id: 'sns-poll', cat: 'sns', name: 'SNS 설문·투표 카드', w: 285.75, h: 285.75, build(uid) { const { T, I, S, P } = H(uid); const opts = ['물놀이 캠프', '산악 캠프', '도장 1박 2일', '체험 학습']; const els = [ T('QUESTION', 24, 30, 200, 10, { font: 'Montserrat', size: 12, weight: 800, color: RED, ls: 0.3 }), T('여름 캠프,\n어디로 갈까요?', 24, 46, 238, 70, { font: 'Jua', size: 44, color: NAVY, lh: 1.1, name: '질문' }) ];
    opts.forEach((o, i) => { const y = 126 + i * 30; els.push(S('rect', 24, y, 200, 24, { fill: WHITE, stroke: NAVY, strokeW: 0.5, radius: 12 })); els.push(S('ellipse', 30, y + 5, 14, 14, { fill: YEL, stroke: NAVY, strokeW: 0.5 })); els.push(T(String.fromCharCode(65 + i), 30, y + 8, 14, 8, { font: 'Montserrat', size: 10, weight: 800, color: NAVY, align: 'center' })); els.push(T(o, 52, y + 6.5, 160, 10, { size: 15, weight: 600, color: INK, name: '보기' })); });
    els.push(I(D.m3, 220, 190, 56, 56, { name: '마스코트' })); els.push(T('댓글로 번호를 남겨 주세요!', 24, 254, 200, 10, { size: 13, weight: 600, color: RED }));
    return [P(SKY, els, '설문 카드')]; } });
  add({ id: 'card-invite-show', cat: 'card', name: '발표회 초대장', w: 148, h: 105, build(uid) { const { T, I, S, P } = H(uid); return [P(NAVY, [
    S('rect', 6, 6, 136, 93, { fill: '', stroke: YEL, strokeW: 0.5, radius: 3 }),
    T('YOU ARE INVITED', 12, 13, 124, 6, { font: 'Montserrat', size: 8, weight: 700, color: YEL, align: 'center', ls: 0.3 }),
    T('2027 나라차\n태권도 발표회', 12, 22, 124, 28, { font: 'Jua', size: 22, color: WHITE, align: 'center', lh: 1.15, name: '제목' }),
    T('12월 18일(토) 오후 2시\n○○문화회관 대강당', 12, 54, 124, 16, { size: 10.5, weight: 600, align: 'center', lh: 1.5, color: '#C8CFE4' }),
    T('아이들이 일 년 동안 갈고닦은 실력을 선보입니다. 꼭 오셔서 큰 박수로 응원해 주세요.', 16, 74, 116, 12, { size: 8, align: 'center', color: '#C8CFE4', lh: 1.5 }),
    I(D.m11, 112, 64, 26, 30, { pos: '50% 100%', name: '마스코트' }),
    T('나라차태권도', 12, 91, 124, 5, { font: 'Montserrat', size: 7, weight: 700, align: 'center', color: YEL, ls: 0.2 }),
  ], '발표회 초대장')]; } });
  add({ id: 'card-message', cat: 'card', name: '메시지 카드 (칭찬·격려)', w: 148, h: 105, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
    S('rect', 0, 0, 148, 30, { fill: MINT }), T('TO. 홍길동 수련생', 12, 10, 124, 10, { font: 'Gaegu', size: 18, weight: 700, color: GREEN, name: '받는 사람' }),
    T('이번 달 실천 과제를 끝까지 해낸 모습이 정말 멋졌어요.\n꾸준함이 가장 큰 실력입니다. 다음 달도 함께 힘내요!', 12, 40, 100, 40, { font: 'Gaegu', size: 13, lh: 1.6, color: INK, name: '내용' }),
    T('FROM. 사범님', 12, 90, 100, 8, { font: 'Gaegu', size: 12, weight: 700, color: GREEN }),
    I(D.m4, 108, 44, 34, 52, { pos: '50% 100%', name: '마스코트' }),
  ], '메시지 카드')]; } });
  add({ id: 'menu-goods', cat: 'notice', name: '용품 가격표', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const items = [['도복 (유아·초등)', '00,000원'], ['도복 (성인)', '00,000원'], ['띠 (색띠)', '0,000원'], ['호구 세트', '00,000원'], ['헤드기어', '00,000원'], ['발등·정강이 보호대', '00,000원'], ['줄넘기', '0,000원'], ['가방', '00,000원']]; const els = [ S('rect', 0, 0, 210, 44, { fill: NAVY }), I(D.logo, 14, 12, 64, 16, { name: '로고' }), T('용품 가격표', 90, 14, 106, 14, { size: 20, weight: 700, color: YEL, align: 'right' }) ];
    items.forEach(([a, b], i) => { const y = 58 + i * 22; els.push(S('rect', 14, y, 182, 18, { fill: i % 2 ? GRAY : WHITE, radius: 2 })); els.push(T(a, 22, y + 5, 110, 8, { size: 12.5, weight: 600, color: INK, name: '품목' })); els.push(S('line', 110, y + 10, 50, 0.2, { fill: '#C9CED8' })); els.push(T(b, 140, y + 5, 48, 8, { size: 12.5, weight: 700, color: NAVY, align: 'right', name: '가격' })); });
    els.push(T('※ 사이즈 교환은 착용 전 7일 이내 가능합니다. 주문은 사무실에서 받습니다.', 14, 240, 182, 8, { size: 10, color: '#666' })); els.push(I(D.m9, 160, 250, 36, 30, { name: '마스코트' })); els.push(foot(T, 282, 210));
    return [P(WHITE, els, '가격표')]; } });

  /* ===== 현수막 추가 ===== */
  add({ id: 'banner-welcome', cat: 'banner', name: '환영 현수막 (3m × 0.7m)', w: 3000, h: 700, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
    S('rect', 0, 0, 3000, 60, { fill: NAVY }), S('rect', 0, 640, 3000, 60, { fill: NAVY }),
    T('○○초등학교 1학년 신입생 여러분, 환영합니다!', 120, 150, 2760, 240, { font: 'Black Han Sans', size: 330, color: NAVY, align: 'center', lh: 1, name: '제목' }),
    T('나라차태권도가 건강한 학교생활을 응원합니다  ·  무료 체험 ' + PHONE, 120, 430, 2760, 150, { size: 170, weight: 700, color: RED, align: 'center', lh: 1 }),
    I(D.m8, 2600, 120, 340, 440, { name: '마스코트' }), I(D.m3, 60, 120, 340, 440, { name: '마스코트 2' }),
  ], '환영 현수막')]; } });
  add({ id: 'banner-exam', cat: 'banner', name: '승급심사 현수막 (3m × 0.7m)', w: 3000, h: 700, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
    S('rect', 0, 0, 3000, 700, { fill: '', stroke: NAVY, strokeW: 24 }),
    I(D.logo, 140, 200, 760, 190, { name: '로고' }),
    T('2027년 3월 정기 승급심사', 1000, 110, 1850, 280, { font: 'Do Hyeon', size: 360, color: NAVY, align: 'center', lh: 1, name: '제목' }),
    T('바른 자세 · 큰 기합 · 최선을 다하는 마음', 1000, 420, 1850, 160, { size: 170, weight: 700, color: RED, align: 'center', lh: 1 }),
    I(D.m1, 2560, 220, 360, 360, { name: '마스코트' }),
  ], '심사 현수막')]; } });

  NC.tpl.cats = [['all', '전체'], ['calendar', '달력 테마'], ['calpage', '달력 낱장'], ['poster', '포스터'], ['flyer', '전단지'], ['leaflet', '리플렛'], ['sns', 'SNS'], ['season', '명절·행사'], ['cert', '상장·증서'], ['card', '명함·카드'], ['sticker', '쿠폰·명찰·스티커'], ['sheet', '서식·활동지'], ['notice', '안내문'], ['banner', '현수막·입간판'], ['web', '웹·영상']];
})();
