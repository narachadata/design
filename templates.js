// 범용 템플릿 28종 (포스터·전단지·SNS·상장·명함·카드·안내문·현수막)
// 설계 규칙: 여백 A4 12mm / A5 8mm / 카드 6mm, 한 템플릿에 색 2~3가지, 제목-부제-본문 3단계 위계, 본문 글자 A4 11pt 이상·SNS 18pt 이상
window.NC = window.NC || {};
NC.tpl = (function () {
  const NAVY = '#1E2B5A', YEL = '#FFE89A', SKY = '#E6EDF2', RED = '#E0564B', INK = '#1a1a1a', WHITE = '#ffffff', MINT = '#DDF3EA', GREEN = '#2F5D3A', CREAM = '#FFF8E8', GOLD = '#C9A227', PEACH = '#FFE9D6', GRAY = '#F3F4F7';
  const H = (uid) => ({
    T: (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: 'Noto Sans KR', size: 12, weight: 400, italic: false, color: INK, align: 'left', lh: 1.35, ls: 0, strokeW: 0, strokeC: WHITE, shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, st),
    I: (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }, st),
    S: (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: YEL, stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st),
    P: (bg, els, label) => ({ id: uid(), bg, els, label }),
  });
  const D = { logo: 'asset:logo-wordmark', swoosh: 'asset:swoosh', group: 'asset:cover-group', m1: 'asset:mascot-01', m3: 'asset:mascot-03', m4: 'asset:mascot-04', m5: 'asset:mascot-05', m7: 'asset:mascot-07', m8: 'asset:mascot-08', m9: 'asset:mascot-09', m11: 'asset:mascot-11', pride: 'asset:illu-01-pride', morality: 'asset:illu-02-morality', friends: 'asset:illu-03-consideration', resp: 'asset:illu-04-responsibility', respect: 'asset:illu-05-respect', humility: 'asset:illu-06-humility', forgive: 'asset:illu-07-forgiveness', justice: 'asset:illu-09-justice', honesty: 'asset:illu-10-honesty', fairness: 'asset:illu-11-fairness', coop: 'asset:illu-12-cooperation', back: 'asset:backcover-logo', target: 'asset:target-icon' };
  const PHONE = '010-0000-0000', ADDR = '○○시 ○○구 ○○로 00, 2층';
  const foot = (T, y, w, color) => T(`나라차태권도  ·  ${ADDR}  ·  ${PHONE}`, 0, y, w, 7, { size: 9.5, color: color || '#444', align: 'center', weight: 500, name: '하단 정보' });

  const list = [
    /* ===== 포스터 (A4 세로) ===== */
    { id: 'poster-recruit', cat: 'poster', name: '수련생 모집 포스터 · 옐로', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
      S('rect', 0, 0, 210, 38, { fill: WHITE, name: '상단 띠' }), S('rect', 0, 38, 210, 2.5, { fill: NAVY }),
      I(D.logo, 14, 9, 70, 18, { name: '로고' }),
      T('NARACHA TAEKWONDO', 100, 15, 96, 8, { font: 'Montserrat', size: 10, weight: 700, color: NAVY, align: 'right', ls: 0.2 }),
      T('2027 신규 수련생 모집', 12, 52, 186, 30, { font: 'Black Han Sans', size: 44, color: NAVY, align: 'center', lh: 1.1, name: '제목' }),
      T('바른 인성과 건강한 몸, 태권도로 시작하세요', 12, 86, 186, 10, { size: 15, weight: 500, align: 'center', color: '#333' }),
      I(D.group, 20, 100, 170, 82, { name: '삽화' }),
      S('rect', 18, 190, 174, 66, { fill: WHITE, radius: 5, name: '안내 상자' }),
      T(`수련 대상   6세 ~ 성인\n수련 시간   평일 14:00 ~ 21:00 (반별 운영)\n체험 수업   무료 체험 1회\n문의 전화   ${PHONE}`, 28, 198, 156, 52, { size: 13.5, lh: 1.7, weight: 500, name: '안내 내용' }),
      S('rect', 0, 266, 210, 31, { fill: NAVY, name: '하단 띠' }),
      T(`나라차태권도  ·  ${ADDR}`, 12, 276, 186, 10, { size: 12, color: WHITE, align: 'center', weight: 500, name: '주소' }),
      I(D.m1, 160, 236, 36, 36, { name: '마스코트' }),
    ], '모집 포스터')]; } },
    { id: 'poster-recruit-navy', cat: 'poster', name: '수련생 모집 포스터 · 네이비', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(NAVY, [
      T('TAEKWONDO', 0, 22, 210, 20, { font: 'Montserrat', size: 46, weight: 800, color: 'rgba(255,255,255,.08)', align: 'center', ls: 0.1 }),
      I(D.swoosh, 96, 18, 18, 16, { name: '로고' }),
      T('새 학기\n태권도 시작', 14, 44, 182, 70, { font: 'Black Han Sans', size: 60, color: YEL, align: 'center', lh: 1.05, name: '제목' }),
      T('자신감 · 집중력 · 예절을 키우는 90분', 14, 118, 182, 10, { size: 15, weight: 500, align: 'center', color: WHITE }),
      I(D.pride, 40, 132, 130, 100, { name: '삽화' }),
      S('rect', 22, 238, 166, 30, { fill: YEL, radius: 15 }),
      T(`무료 체험 신청  ${PHONE}`, 22, 246, 166, 14, { size: 17, weight: 700, color: NAVY, align: 'center', name: '전화' }),
      T(`나라차태권도  ·  ${ADDR}`, 12, 278, 186, 8, { size: 10.5, color: '#C8CFE4', align: 'center' }),
    ], '모집 포스터 네이비')]; } },
    { id: 'poster-exam', cat: 'poster', name: '승급심사 안내 포스터', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(SKY, [
      I(D.swoosh, 180, 12, 18, 16, { name: '로고' }),
      T('승급심사 안내', 12, 30, 186, 24, { font: 'Jua', size: 44, color: NAVY, align: 'center', lh: 1 }),
      T('2027년 3월 정기 승급심사', 12, 58, 186, 10, { size: 15, weight: 600, color: RED, align: 'center' }),
      S('rect', 18, 76, 174, 72, { fill: WHITE, radius: 5 }),
      T('일시', 28, 84, 30, 8, { size: 13, weight: 700, color: NAVY }), T('2027년 3월 29일(월) ~ 30일(화)  오후 5시', 60, 84, 126, 8, { size: 13, weight: 500 }),
      T('장소', 28, 100, 30, 8, { size: 13, weight: 700, color: NAVY }), T('나라차태권도 본관 수련장', 60, 100, 126, 8, { size: 13, weight: 500 }),
      T('준비', 28, 116, 30, 8, { size: 13, weight: 700, color: NAVY }), T('도복 착용, 띠 정리, 심사비 납부 확인', 60, 116, 126, 8, { size: 13, weight: 500 }),
      T('문의', 28, 132, 30, 8, { size: 13, weight: 700, color: NAVY }), T(`${PHONE} (사범실)`, 60, 132, 126, 8, { size: 13, weight: 500 }),
      I(D.pride, 30, 156, 150, 112, { name: '삽화' }),
      T('"땀과 노력은 나를 자랑스럽게 만들어 줍니다"', 12, 272, 186, 10, { size: 13, weight: 600, align: 'center', color: NAVY }),
    ], '심사 포스터')]; } },
    { id: 'poster-contest', cat: 'poster', name: '품새 대회 포스터', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('rect', 0, 0, 210, 120, { fill: RED }), S('rect', 0, 120, 210, 4, { fill: NAVY }),
      I(D.swoosh, 14, 12, 16, 14, { name: '로고' }),
      T('제 5회 나라차배', 14, 34, 182, 12, { font: 'Montserrat', size: 14, weight: 700, color: YEL, ls: 0.1, name: '회차' }),
      T('어린이 품새 대회', 14, 48, 182, 40, { font: 'Black Han Sans', size: 54, color: WHITE, lh: 1.05, name: '제목' }),
      T('2027. 5. 15 (토)  10:00  ·  ○○체육관', 14, 96, 182, 10, { size: 14, weight: 600, color: WHITE }),
      I(D.justice, 118, 128, 80, 118, { pos: '50% 100%', name: '삽화' }),
      T('참가 부문', 14, 136, 90, 8, { size: 13, weight: 700, color: RED }),
      T('유치부 · 초등 저학년 · 초등 고학년\n개인 품새 / 단체 품새', 14, 146, 100, 20, { size: 12, lh: 1.6, weight: 500 }),
      T('참가 신청', 14, 174, 90, 8, { size: 13, weight: 700, color: RED }),
      T(`4월 30일까지 도장 사무실\n참가비 20,000원 (기념 티셔츠 포함)`, 14, 184, 100, 20, { size: 12, lh: 1.6, weight: 500 }),
      T('시상', 14, 212, 90, 8, { size: 13, weight: 700, color: RED }),
      T('부문별 금·은·동상, 전원 참가상', 14, 222, 100, 10, { size: 12, lh: 1.6, weight: 500 }),
      S('rect', 0, 262, 210, 35, { fill: NAVY }),
      T('주최 나라차태권도  ·  후원 ○○구 태권도협회', 12, 270, 186, 8, { size: 11, color: WHITE, align: 'center', weight: 500 }),
      T(`문의 ${PHONE}`, 12, 281, 186, 8, { size: 11, color: YEL, align: 'center', weight: 700 }),
    ], '대회 포스터')]; } },
    { id: 'poster-winter', cat: 'poster', name: '겨울방학 특강 포스터', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P('#EAF1FB', [
      I(D.logo, 14, 12, 66, 16, { name: '로고' }),
      T('WINTER SPECIAL', 100, 16, 96, 8, { font: 'Montserrat', size: 10, weight: 700, color: NAVY, align: 'right', ls: 0.25 }),
      T('겨울방학\n집중 특강', 14, 40, 182, 64, { font: 'Do Hyeon', size: 58, color: NAVY, align: 'center', lh: 1.05, name: '제목' }),
      T('품새 완성반 · 겨루기 기초반 · 줄넘기 체력반', 14, 108, 182, 10, { size: 14, weight: 600, align: 'center', color: RED }),
      I(D.coop, 30, 122, 150, 90, { name: '삽화' }),
      S('rect', 18, 218, 174, 46, { fill: WHITE, radius: 5 }),
      T('기간  1월 4일(월) ~ 1월 29일(금), 4주\n시간  오전 10시 ~ 12시 (주 3회)\n대상  초등 1~6학년  ·  정원 20명', 28, 224, 156, 34, { size: 12.5, lh: 1.7, weight: 500, name: '안내' }),
      foot(T, 274, 210),
    ], '겨울 특강 포스터')]; } },

    /* ===== 전단지 (A5) ===== */
    { id: 'flyer-camp', cat: 'flyer', name: '방학 캠프 전단지', w: 148, h: 210, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
      I(D.logo, 10, 8, 50, 12, { name: '로고' }),
      T('여름방학 특별 캠프', 8, 26, 132, 20, { font: 'Black Han Sans', size: 32, color: NAVY, align: 'center', lh: 1.1 }),
      T('2027. 7. 26(월) ~ 7. 30(금)  ·  5일간', 8, 48, 132, 8, { size: 12, weight: 600, align: 'center', color: RED }),
      I(D.coop, 14, 60, 120, 72, { name: '삽화' }),
      S('rect', 10, 136, 128, 54, { fill: WHITE, radius: 4 }),
      T(`프로그램  품새·겨루기·격파·물놀이·캠프파이어\n대    상  초등 1~6학년 (선착순 30명)\n참 가 비  000,000원 (식비·보험 포함)\n신    청  도장 사무실 또는 ${PHONE}`, 16, 142, 116, 44, { size: 10.5, lh: 1.65, weight: 500, name: '안내' }),
      T('나라차태권도', 8, 196, 132, 8, { font: 'Montserrat', size: 9, weight: 700, align: 'center', color: NAVY, ls: 0.2 }),
    ], '캠프 전단지')]; } },
    { id: 'flyer-trial', cat: 'flyer', name: '무료 체험수업 전단지', w: 148, h: 210, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('rect', 0, 0, 148, 92, { fill: NAVY }),
      I(D.swoosh, 122, 8, 16, 14, { name: '로고' }),
      T('FREE TRIAL', 10, 12, 100, 6, { font: 'Montserrat', size: 9, weight: 700, color: YEL, ls: 0.3 }),
      T('무료 체험수업\n신청하세요', 10, 22, 128, 44, { font: 'Jua', size: 34, color: WHITE, lh: 1.1, name: '제목' }),
      T('도복 무료 대여 · 1회 90분 · 학부모 참관 가능', 10, 72, 128, 8, { size: 10, weight: 500, color: '#C8CFE4' }),
      I(D.m4, 8, 96, 50, 50, { name: '마스코트' }),
      T('이렇게 진행돼요', 64, 100, 76, 7, { size: 12, weight: 700, color: NAVY }),
      T('1. 전화 또는 방문 신청\n2. 체험 시간 예약 (평일 오후)\n3. 기본 동작·간단한 발차기 체험\n4. 상담 후 반 배정', 64, 110, 78, 36, { size: 10, lh: 1.65, weight: 500, name: '안내' }),
      S('rect', 10, 154, 128, 24, { fill: YEL, radius: 12 }),
      T(`전화 신청  ${PHONE}`, 10, 160, 128, 12, { size: 14, weight: 700, color: NAVY, align: 'center' }),
      T(`나라차태권도  ·  ${ADDR}`, 8, 190, 132, 8, { size: 8.5, color: '#555', align: 'center' }),
    ], '체험수업 전단지')]; } },
    { id: 'flyer-fee', cat: 'flyer', name: '수강 안내 전단지', w: 148, h: 210, build(uid) { const { T, I, S, P } = H(uid); const rows = [['주 2회 반', '월 00,000원'], ['주 3회 반', '월 00,000원'], ['주 5회 반', '월 00,000원'], ['성인 야간반', '월 00,000원']]; const els = [
      I(D.logo, 10, 8, 50, 12, { name: '로고' }),
      T('2027 수강 안내', 8, 26, 132, 14, { font: 'Do Hyeon', size: 26, color: NAVY, align: 'center' }),
      T('반별 수련 시간과 수강료를 안내드립니다', 8, 42, 132, 7, { size: 9.5, align: 'center', color: '#555' }),
    ]; rows.forEach(([a, b], i) => { const y = 56 + i * 16; els.push(S('rect', 12, y, 124, 13, { fill: i % 2 ? GRAY : WHITE, stroke: '#D9DDE5', strokeW: 0.25 })); els.push(T(a, 18, y + 3.6, 60, 6, { size: 10.5, weight: 700, color: NAVY })); els.push(T(b, 78, y + 3.6, 52, 6, { size: 10.5, weight: 600, align: 'right', name: '금액' })); });
      els.push(T('※ 형제 등록 10% 할인 · 도복·띠 별도 · 3개월 선납 시 5% 할인', 12, 124, 124, 7, { size: 8.5, color: '#666' }));
      els.push(I(D.respect, 20, 134, 108, 52, { name: '삽화' }));
      els.push(T(`문의 ${PHONE}  ·  ${ADDR}`, 8, 192, 132, 8, { size: 8.5, color: '#555', align: 'center' }));
      return [P(WHITE, els, '수강 안내')]; } },

    /* ===== SNS (정사각 1080) ===== */
    { id: 'sns-notice', cat: 'sns', name: 'SNS 공지 카드', w: 285.75, h: 285.75, build(uid) { const { T, I, S, P } = H(uid); return [P(NAVY, [
      S('rect', 20, 20, 245.75, 245.75, { fill: '', stroke: YEL, strokeW: 1.2, radius: 6, name: '테두리' }),
      T('NOTICE', 30, 34, 225, 12, { font: 'Montserrat', size: 14, weight: 700, color: YEL, align: 'center', ls: 0.3 }),
      T('이번 주 수련 안내', 30, 52, 225, 30, { font: 'Jua', size: 52, color: WHITE, align: 'center', lh: 1.1, name: '제목' }),
      S('line', 100, 92, 85, 0.8, { fill: YEL }),
      T('· 월요일: 품새 집중 수련\n· 수요일: 겨루기 반별 수련\n· 금요일: 줄넘기 측정 주간\n· 토요일: 휴관 (지도진 교육)', 50, 110, 185, 90, { size: 20, lh: 1.7, color: WHITE, weight: 500, name: '내용' }),
      I(D.m4, 200, 196, 60, 60, { name: '마스코트' }),
      T('나라차태권도', 30, 240, 180, 12, { font: 'Montserrat', size: 12, weight: 700, color: YEL, ls: 0.2 }),
    ], 'SNS 공지')]; } },
    { id: 'sns-event', cat: 'sns', name: 'SNS 이벤트 카드', w: 285.75, h: 285.75, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
      I(D.swoosh, 236, 22, 28, 24, { name: '로고' }),
      T('EVENT', 24, 30, 160, 12, { font: 'Montserrat', size: 16, weight: 800, color: RED, ls: 0.3 }),
      T('친구 추천\n이벤트', 24, 48, 180, 90, { font: 'Black Han Sans', size: 70, color: NAVY, lh: 1.05, name: '제목' }),
      T('친구와 함께 등록하면\n두 사람 모두 도복을 선물로!', 24, 150, 190, 40, { size: 22, weight: 600, lh: 1.4, color: '#333', name: '내용' }),
      S('rect', 24, 206, 150, 30, { fill: NAVY, radius: 15 }),
      T('2027. 3. 1 ~ 3. 31', 24, 213, 150, 14, { size: 18, weight: 700, color: YEL, align: 'center', font: 'Montserrat' }),
      I(D.friends, 170, 130, 110, 150, { pos: '50% 100%', name: '삽화' }),
    ], 'SNS 이벤트')]; } },
    { id: 'sns-congrats', cat: 'sns', name: 'SNS 승급 축하 카드', w: 285.75, h: 285.75, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('ellipse', -60, -60, 220, 220, { fill: YEL, name: '장식 원' }),
      S('ellipse', 200, 200, 140, 140, { fill: SKY, name: '장식 원 2' }),
      T('CONGRATULATIONS', 24, 40, 238, 10, { font: 'Montserrat', size: 13, weight: 700, color: RED, ls: 0.3 }),
      T('승급을\n축하합니다!', 24, 56, 238, 80, { font: 'Jua', size: 58, color: NAVY, lh: 1.1, name: '제목' }),
      T('2027년 3월 정기 승급심사 합격자\n홍길동 · 김나라 · 이차차 · 박태권 외 12명', 24, 150, 200, 40, { size: 17, weight: 500, lh: 1.5, color: '#333', name: '내용' }),
      I(D.m1, 190, 160, 80, 80, { name: '마스코트' }),
      T('나라차태권도', 24, 250, 180, 10, { font: 'Montserrat', size: 11, weight: 700, color: NAVY, ls: 0.2 }),
    ], 'SNS 축하')]; } },
    { id: 'sns-cardnews', cat: 'sns', name: '카드뉴스 표지', w: 285.75, h: 285.75, build(uid) { const { T, I, S, P } = H(uid); return [P(MINT, [
      S('rect', 24, 24, 237.75, 237.75, { fill: WHITE, radius: 10 }),
      T('CARD NEWS  01', 40, 40, 160, 8, { font: 'Montserrat', size: 11, weight: 700, color: GREEN, ls: 0.3 }),
      T('태권도가 아이에게\n주는 5가지 변화', 40, 58, 200, 80, { font: 'Do Hyeon', size: 44, color: GREEN, lh: 1.15, name: '제목' }),
      T('집중력 · 자신감 · 예절 · 체력 · 친구', 40, 146, 200, 12, { size: 16, weight: 600, color: '#444' }),
      I(D.humility, 160, 150, 90, 110, { pos: '50% 100%', name: '삽화' }),
      T('→ 넘겨서 보기', 40, 238, 120, 10, { size: 13, weight: 600, color: GREEN }),
    ], '카드뉴스 표지')]; } },
    { id: 'sns-recruit', cat: 'sns', name: 'SNS 모집 카드', w: 285.75, h: 285.75, build(uid) { const { T, I, S, P } = H(uid); return [P(RED, [
      T('신규 수련생\n모집 중', 24, 36, 238, 110, { font: 'Black Han Sans', size: 72, color: WHITE, lh: 1.05, name: '제목' }),
      S('rect', 24, 156, 120, 14, { fill: YEL, radius: 7 }),
      T('무료 체험 1회', 24, 158.5, 120, 10, { size: 13, weight: 700, color: NAVY, align: 'center' }),
      T(`6세~성인 · 평일 14:00~21:00\n${PHONE}`, 24, 182, 200, 40, { size: 19, weight: 600, lh: 1.5, color: WHITE, name: '내용' }),
      I(D.m8, 186, 170, 90, 90, { name: '마스코트' }),
      T('나라차태권도', 24, 250, 180, 10, { font: 'Montserrat', size: 11, weight: 700, color: YEL, ls: 0.2 }),
    ], 'SNS 모집')]; } },
    { id: 'sns-story', cat: 'sns', name: '인스타 스토리 공지', w: 285.75, h: 508, build(uid) { const { T, I, S, P } = H(uid); return [P(NAVY, [
      I(D.swoosh, 118, 60, 50, 44, { name: '로고' }),
      T('오늘의 공지', 24, 130, 238, 20, { font: 'Montserrat', size: 14, weight: 700, color: YEL, align: 'center', ls: 0.3 }),
      T('3월 2일(화)\n대체 휴일\n휴관합니다', 24, 160, 238, 150, { font: 'Jua', size: 56, color: WHITE, align: 'center', lh: 1.15, name: '제목' }),
      S('line', 100, 326, 85, 0.8, { fill: YEL }),
      T('정상 수련은 3월 3일(수)부터\n차량도 평소대로 운행합니다', 24, 340, 238, 50, { size: 19, weight: 500, lh: 1.5, color: '#D7DDEF', align: 'center', name: '내용' }),
      I(D.m7, 98, 400, 90, 90, { name: '마스코트' }),
    ], '스토리 공지')]; } },

    /* ===== 상장·증서 (A4 가로) ===== */
    { id: 'cert-award', cat: 'cert', name: '상장', w: 297, h: 210, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('rect', 8, 8, 281, 194, { fill: '', stroke: NAVY, strokeW: 1.4, name: '바깥 테두리' }),
      S('rect', 12, 12, 273, 186, { fill: '', stroke: GOLD, strokeW: 0.5, name: '안쪽 테두리' }),
      T('제 2027-001 호', 22, 20, 80, 8, { size: 10, color: '#555' }),
      T('상    장', 20, 34, 257, 26, { font: 'Nanum Myeongjo', size: 46, weight: 700, color: NAVY, align: 'center', lh: 1 }),
      T('품새 부문  최우수상', 20, 64, 257, 10, { size: 15, weight: 600, align: 'center', color: RED }),
      T('이름 : 홍 길 동', 20, 84, 257, 10, { size: 17, weight: 600, align: 'center', font: 'Nanum Myeongjo' }),
      T('위 학생은 평소 성실한 수련 태도로 모범을 보였으며\n2027년 봄 품새 대회에서 뛰어난 기량을 발휘하였기에\n이 상장을 수여합니다.', 36, 104, 225, 36, { size: 13, lh: 1.9, align: 'center', font: 'Nanum Myeongjo', name: '내용' }),
      T('2027년  4월  1일', 20, 150, 257, 8, { size: 13, align: 'center', font: 'Nanum Myeongjo' }),
      T('나라차태권도  관장  ○ ○ ○  (인)', 20, 164, 257, 10, { size: 15, weight: 600, align: 'center', font: 'Nanum Myeongjo' }),
      I(D.logo, 118, 180, 60, 14, { name: '로고' }),
      I(D.m1, 236, 140, 40, 40, { opacity: 0.9, name: '마스코트' }),
    ], '상장')]; } },
    { id: 'cert-belt', cat: 'cert', name: '승급증', w: 297, h: 210, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('rect', 0, 0, 22, 210, { fill: NAVY, name: '왼쪽 띠' }), S('rect', 22, 0, 4, 210, { fill: RED }),
      I(D.logo, 40, 18, 70, 16, { name: '로고' }),
      T('승  급  증', 40, 48, 240, 26, { font: 'Nanum Myeongjo', size: 44, weight: 700, color: NAVY, lh: 1 }),
      T('CERTIFICATE OF PROMOTION', 40, 76, 240, 8, { font: 'Montserrat', size: 10, weight: 600, color: '#777', ls: 0.25 }),
      T('홍 길 동', 40, 94, 240, 12, { size: 22, weight: 700, font: 'Nanum Myeongjo' }),
      T('위 수련생은 2027년 3월 정기 승급심사에서 품새·기술·수련 태도 전 부문을\n우수하게 통과하였으므로  노란띠(8급)  로 승급하였음을 증명합니다.', 40, 112, 240, 24, { size: 12.5, lh: 1.8, font: 'Nanum Myeongjo', name: '내용' }),
      T('2027년  3월  31일', 40, 150, 240, 8, { size: 12.5, font: 'Nanum Myeongjo' }),
      T('나라차태권도  관장  ○ ○ ○  (인)', 40, 164, 240, 10, { size: 15, weight: 600, font: 'Nanum Myeongjo' }),
      I(D.m8, 232, 120, 50, 50, { name: '마스코트' }),
    ], '승급증')]; } },
    { id: 'cert-complete', cat: 'cert', name: '수료증', w: 297, h: 210, build(uid) { const { T, I, S, P } = H(uid); return [P(CREAM, [
      S('rect', 10, 10, 277, 190, { fill: WHITE, stroke: GOLD, strokeW: 0.8, radius: 3 }),
      I(D.back, 128, 18, 40, 40, { name: '로고' }),
      T('수  료  증', 20, 62, 257, 22, { font: 'Gowun Batang', size: 40, weight: 700, color: GREEN, align: 'center', lh: 1 }),
      T('2027 여름방학 특별 캠프', 20, 86, 257, 9, { size: 13, weight: 600, align: 'center', color: '#8A5A2B' }),
      T('홍 길 동', 20, 102, 257, 12, { size: 22, weight: 700, align: 'center', font: 'Gowun Batang' }),
      T('위 수련생은 5일간의 캠프 과정을 성실히 마쳤기에 이 증서를 드립니다.', 30, 122, 237, 10, { size: 12.5, align: 'center', font: 'Gowun Batang', name: '내용' }),
      T('2027년  7월  30일', 20, 146, 257, 8, { size: 12.5, align: 'center', font: 'Gowun Batang' }),
      T('나라차태권도  관장  ○ ○ ○', 20, 160, 257, 10, { size: 14, weight: 600, align: 'center', font: 'Gowun Batang' }),
      I(D.m9, 236, 150, 40, 40, { name: '마스코트' }), I(D.m3, 22, 150, 40, 40, { name: '마스코트 2' }),
    ], '수료증')]; } },
    { id: 'cert-attend', cat: 'cert', name: '개근상', w: 297, h: 210, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('rect', 0, 0, 297, 46, { fill: YEL }),
      I(D.logo, 20, 14, 70, 18, { name: '로고' }),
      T('PERFECT ATTENDANCE', 150, 20, 127, 8, { font: 'Montserrat', size: 10, weight: 700, color: NAVY, align: 'right', ls: 0.25 }),
      T('개  근  상', 20, 62, 257, 24, { font: 'Jua', size: 42, color: NAVY, align: 'center', lh: 1 }),
      T('홍 길 동', 20, 94, 257, 12, { size: 22, weight: 700, align: 'center' }),
      T('위 수련생은 2027년 상반기 동안 하루도 빠짐없이 수련에 참여하여\n성실함의 본보기가 되었기에 이 상을 드립니다.', 30, 114, 237, 24, { size: 13, lh: 1.8, align: 'center', name: '내용' }),
      T('2027년  6월  30일', 20, 150, 257, 8, { size: 12.5, align: 'center' }),
      T('나라차태권도  관장  ○ ○ ○  (인)', 20, 164, 257, 10, { size: 15, weight: 600, align: 'center' }),
      I(D.m11, 236, 130, 44, 44, { name: '마스코트' }),
    ], '개근상')]; } },

    /* ===== 명함·카드 ===== */
    { id: 'card-name', cat: 'card', name: '명함 · 화이트', w: 90, h: 50, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('rect', 0, 0, 90, 12, { fill: NAVY }),
      I(D.swoosh, 78, 2.5, 8, 7, { name: '로고' }),
      T('NARACHA TAEKWONDO', 5, 3.6, 70, 5, { font: 'Montserrat', size: 7, weight: 700, color: YEL, ls: 0.2 }),
      T('홍 길 동', 6, 17, 50, 8, { size: 16, weight: 700, name: '이름' }),
      T('사범 · 지도교사', 6, 25, 50, 5, { size: 8, color: '#555', weight: 500, name: '직함' }),
      T(`M. ${PHONE}\nE. naracha@example.com\nA. ${ADDR}`, 6, 33, 70, 14, { size: 6.8, lh: 1.55, color: '#333', name: '연락처' }),
      I(D.logo, 58, 16, 28, 8, { name: '워드마크' }),
    ], '명함')]; } },
    { id: 'card-name-navy', cat: 'card', name: '명함 · 네이비', w: 90, h: 50, build(uid) { const { T, I, S, P } = H(uid); return [P(NAVY, [
      S('rect', 0, 44, 90, 6, { fill: YEL }),
      I(D.swoosh, 6, 6, 10, 9, { name: '로고' }),
      T('홍 길 동', 6, 18, 50, 8, { size: 16, weight: 700, color: WHITE, name: '이름' }),
      T('관장', 6, 26, 50, 5, { size: 8, color: YEL, weight: 600, name: '직함' }),
      T(`${PHONE}  ·  naracha@example.com`, 6, 34, 78, 5, { size: 6.5, color: '#C8CFE4', name: '연락처' }),
      T('NARACHA TAEKWONDO', 40, 8, 46, 5, { font: 'Montserrat', size: 6.5, weight: 700, color: YEL, align: 'right', ls: 0.2 }),
    ], '명함 네이비')]; } },
    { id: 'card-invite', cat: 'card', name: '대회 초대장', w: 148, h: 105, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
      S('rect', 6, 6, 136, 93, { fill: '', stroke: NAVY, strokeW: 0.6, radius: 3 }),
      T('INVITATION', 12, 13, 124, 6, { font: 'Montserrat', size: 8, weight: 700, color: RED, align: 'center', ls: 0.3 }),
      T('제 5회 나라차배\n어린이 품새 대회', 12, 22, 124, 28, { font: 'Jua', size: 22, color: NAVY, align: 'center', lh: 1.15, name: '제목' }),
      T('2027년 5월 15일(토) 오전 10시\n○○체육관 다목적실', 12, 54, 124, 16, { size: 10.5, weight: 600, align: 'center', lh: 1.5 }),
      T('학부모님을 초대합니다. 아이들의 멋진 성장을 함께 응원해 주세요.', 16, 76, 116, 10, { size: 8.5, align: 'center', color: '#444', lh: 1.5 }),
      I(D.m3, 112, 66, 26, 26, { name: '마스코트' }),
      T('나라차태권도', 12, 90, 124, 5, { font: 'Montserrat', size: 7, weight: 700, align: 'center', color: NAVY, ls: 0.2 }),
    ], '초대장')]; } },
    { id: 'card-birthday', cat: 'card', name: '생일 축하 카드', w: 148, h: 105, build(uid) { const { T, I, S, P } = H(uid); return [P(PEACH, [
      S('ellipse', 100, -30, 90, 90, { fill: YEL, name: '장식' }),
      T('HAPPY BIRTHDAY', 10, 14, 90, 6, { font: 'Montserrat', size: 9, weight: 800, color: RED, ls: 0.25 }),
      T('홍길동 수련생,\n생일 축하해요!', 10, 24, 96, 34, { font: 'Gaegu', size: 26, weight: 700, color: NAVY, lh: 1.15, name: '제목' }),
      T('오늘처럼 힘찬 기합으로\n멋지게 자라길 응원합니다.', 10, 62, 96, 20, { size: 10, lh: 1.5, color: '#444', name: '내용' }),
      T('나라차태권도 사범 일동', 10, 90, 96, 6, { size: 8.5, weight: 600, color: NAVY }),
      I(D.m5, 100, 40, 44, 56, { pos: '50% 100%', name: '마스코트' }),
    ], '생일 카드')]; } },

    /* ===== 안내문 (A4 세로) ===== */
    { id: 'notice-letter', cat: 'notice', name: '가정통신문', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('rect', 0, 0, 210, 28, { fill: YEL }),
      I(D.logo, 14, 6, 60, 16, { name: '로고' }),
      T('가정통신문', 100, 9, 96, 10, { size: 14, weight: 700, align: 'right', color: NAVY }),
      T('2027학년도 3월 수련 안내', 18, 40, 174, 14, { size: 22, weight: 700, color: NAVY, name: '제목' }),
      S('line', 18, 58, 174, 0.6, { fill: NAVY }),
      T(`학부모님께,\n\n새 학기를 맞아 3월 수련 일정과 도장 운영 안내를 드립니다. 아이들이 즐겁고 안전하게 수련할 수 있도록 가정에서도 아래 내용을 함께 확인해 주시기 바랍니다.\n\n1. 승급심사: 3월 29일(월)~30일(화), 심사비 납부 기한 3월 20일\n2. 차량 운행: 등원 14:00 / 하원 18:30·20:30 (노선표 별도 안내)\n3. 휴관일: 3월 1일(삼일절), 3월 2일(대체 휴일)\n4. 준비물: 도복 명찰, 실내화, 물통\n\n문의: ${PHONE} (사범실)`, 18, 66, 174, 150, { size: 12, lh: 1.8, name: '본문' }),
      T('2027년  3월  2일', 18, 228, 174, 8, { size: 12, align: 'center' }),
      T('나라차태권도  관장  ○ ○ ○', 18, 240, 174, 10, { size: 14, weight: 700, align: 'center', color: NAVY }),
      S('rect', 0, 283, 210, 14, { fill: NAVY }),
      T(`${ADDR}  ·  ${PHONE}`, 12, 287, 186, 6, { size: 9, color: WHITE, align: 'center' }),
    ], '가정통신문')]; } },
    { id: 'schedule', cat: 'notice', name: '수련 시간표', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const els = [
      S('rect', 0, 0, 210, 34, { fill: WHITE }), S('rect', 0, 34, 210, 2.5, { fill: NAVY }), I(D.logo, 14, 8, 64, 16, { name: '로고' }),
      T('2027 수련 시간표', 90, 10, 106, 14, { size: 20, weight: 700, color: NAVY, align: 'right' }),
    ];
      const cols = ['시간', '월', '화', '수', '목', '금'], times = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
      const x0 = 14, y0 = 48, cw = 182 / 6, rh = 24;
      cols.forEach((c, i) => { els.push(S('rect', x0 + i * cw, y0, cw, 12, { fill: i === 0 ? NAVY : YEL })); els.push(T(c, x0 + i * cw, y0 + 2.8, cw, 6, { size: 11, weight: 700, align: 'center', color: i === 0 ? WHITE : NAVY })); });
      times.forEach((t, r) => { const y = y0 + 12 + r * rh; cols.forEach((c, i) => { els.push(S('rect', x0 + i * cw, y, cw, rh, { fill: i === 0 ? GRAY : WHITE, stroke: '#CFD4DD', strokeW: 0.25 })); }); els.push(T(t, x0, y + 8, cw, 8, { size: 11, weight: 700, align: 'center', color: NAVY })); for (let i = 1; i < 6; i++) els.push(T(r % 2 ? '유아부' : '초등부', x0 + i * cw, y + 8, cw, 8, { size: 10, weight: 500, align: 'center', color: '#333', name: '반 이름' })); });
      els.push(T(`※ 반 편성과 시간은 상담 후 조정됩니다.  문의 ${PHONE}`, 14, 236, 182, 8, { size: 10.5, color: '#555', align: 'center' }));
      els.push(I(D.respect, 60, 246, 90, 46, { name: '삽화' }));
      return [P(WHITE, els, '시간표')]; } },
    { id: 'notice-bus', cat: 'notice', name: '차량 노선 안내', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const stops = [['14:00', '○○아파트 정문'], ['14:05', '○○초등학교 후문'], ['14:12', '○○마트 앞'], ['14:18', '○○공원 입구'], ['14:25', '도장 도착']]; const els = [
      S('rect', 0, 0, 210, 40, { fill: NAVY }), I(D.swoosh, 14, 12, 16, 14, { name: '로고' }),
      T('차량 운행 노선 안내', 36, 11, 160, 14, { size: 22, weight: 700, color: WHITE }),
      T('2027년 3월부터 적용 · 1호차', 36, 26, 160, 8, { size: 11, color: YEL, weight: 600 }),
      T('등원 (오후)', 18, 52, 100, 8, { size: 14, weight: 700, color: NAVY }),
    ]; stops.forEach(([t, n], i) => { const y = 66 + i * 20; els.push(S('ellipse', 22, y + 2, 8, 8, { fill: i === stops.length - 1 ? RED : YEL, stroke: NAVY, strokeW: 0.5 })); if (i < stops.length - 1) els.push(S('rect', 25.6, y + 10, 0.8, 12, { fill: NAVY })); els.push(T(t, 36, y + 2, 24, 7, { size: 12, weight: 700, color: NAVY, font: 'Montserrat' })); els.push(T(n, 62, y + 2, 120, 7, { size: 12.5, weight: 500, name: '정류장' })); });
      els.push(T('하원', 18, 176, 100, 8, { size: 14, weight: 700, color: NAVY }));
      els.push(T('1차 18:30 · 2차 20:30 — 등원 노선의 역순으로 운행합니다.\n하원 장소 변경은 당일 오후 4시까지 사범실로 연락해 주세요.', 18, 188, 174, 20, { size: 11.5, lh: 1.6, weight: 500 }));
      els.push(S('rect', 18, 220, 174, 40, { fill: GRAY, radius: 4 }));
      els.push(T('안전 수칙\n· 차량이 완전히 멈춘 뒤 승하차합니다.  · 안전벨트를 꼭 맵니다.\n· 정해진 장소에서 보호자가 기다려 주세요.', 26, 226, 158, 30, { size: 10.5, lh: 1.6, name: '수칙' }));
      els.push(foot(T, 276, 210));
      return [P(WHITE, els, '차량 노선')]; } },
    { id: 'notice-safety', cat: 'notice', name: '도장 안전 수칙', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const rules = ['도장에 들어오고 나갈 때 국기와 사범님께 인사합니다.', '수련 전 준비운동을 충분히 하고, 아프면 바로 말합니다.', '허락 없이 겨루기나 격파를 하지 않습니다.', '장비와 기구는 제자리에 정리합니다.', '친구를 밀거나 놀리지 않습니다.', '물은 쉬는 시간에, 뛰지 않고 마십니다.']; const els = [
      S('rect', 0, 0, 210, 60, { fill: YEL }),
      I(D.logo, 14, 10, 64, 16, { name: '로고' }),
      T('도장 안전 수칙', 14, 30, 182, 20, { font: 'Jua', size: 34, color: NAVY, name: '제목' }),
      I(D.honesty, 140, 6, 62, 56, { pos: '50% 100%', name: '마스코트' }),
    ]; rules.forEach((r, i) => { const y = 74 + i * 26; els.push(S('ellipse', 16, y, 14, 14, { fill: NAVY })); els.push(T(String(i + 1), 16, y + 3, 14, 8, { font: 'Montserrat', size: 13, weight: 800, color: YEL, align: 'center' })); els.push(T(r, 36, y + 2.5, 158, 10, { size: 13, weight: 500, name: '수칙' })); els.push(S('line', 36, y + 18, 158, 0.3, { fill: '#D9DDE5' })); });
      els.push(T('우리 모두의 약속입니다. 지키면 더 즐거운 수련이 됩니다!', 14, 236, 182, 10, { size: 13, weight: 600, color: RED, align: 'center' }));
      els.push(foot(T, 276, 210));
      return [P(WHITE, els, '안전 수칙')]; } },

    /* ===== 현수막 ===== */
    { id: 'banner', cat: 'banner', name: '모집 현수막 (3m × 0.7m)', w: 3000, h: 700, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
      S('rect', 0, 0, 90, 700, { fill: NAVY }), S('rect', 2910, 0, 90, 700, { fill: NAVY }),
      I(D.logo, 160, 70, 700, 170, { name: '로고' }),
      T('신규 수련생 모집', 900, 60, 1950, 300, { font: 'Black Han Sans', size: 520, color: NAVY, align: 'center', lh: 1 }),
      T(`바른 인성 · 건강한 체력 · 무료 체험 수업    ☎ ${PHONE}`, 160, 420, 2680, 150, { size: 190, weight: 700, color: RED, align: 'center', lh: 1 }),
      I(D.m1, 2560, 240, 380, 380, { name: '마스코트' }),
    ], '현수막')]; } },
    { id: 'banner-congrats', cat: 'banner', name: '입상 축하 현수막 (3m × 0.7m)', w: 3000, h: 700, build(uid) { const { T, I, S, P } = H(uid); return [P(NAVY, [
      S('rect', 0, 620, 3000, 80, { fill: YEL }),
      T('축  ○○시 태권도대회 품새 부문 금메달  축', 120, 70, 2760, 260, { font: 'Black Han Sans', size: 400, color: YEL, align: 'center', lh: 1, name: '제목' }),
      T('홍길동 · 김나라 · 이차차 수련생  —  나라차태권도 가족 모두가 축하합니다', 120, 380, 2760, 180, { size: 200, weight: 700, color: WHITE, align: 'center', lh: 1, name: '내용' }),
      I(D.swoosh, 100, 90, 240, 210, { name: '로고' }),
    ], '축하 현수막')]; } },
  ];
  const cats = [['all', '전체'], ['calendar', '달력 테마'], ['calpage', '달력 페이지'], ['poster', '포스터'], ['flyer', '전단지'], ['sns', 'SNS'], ['cert', '상장·증서'], ['card', '명함·카드'], ['notice', '안내문'], ['banner', '현수막']];
  return { list, cats, get: id => list.find(t => t.id === id) };
})();
