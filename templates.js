// 범용 템플릿 (포스터·전단지·SNS·상장·명함·초대장·안내문·시간표·현수막)
window.NC = window.NC || {};
NC.tpl = (function () {
  const NAVY = '#1E2B5A', YEL = '#FFE89A', SKY = '#E6EDF2', RED = '#E0564B', INK = '#1a1a1a', WHITE = '#ffffff';
  const H = (uid) => ({
    T: (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: 'Noto Sans KR', size: 12, weight: 400, italic: false, color: INK, align: 'left', lh: 1.35, ls: 0, strokeW: 0, strokeC: WHITE, shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, st),
    I: (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }, st),
    S: (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: YEL, stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st),
    P: (bg, els, label) => ({ id: uid(), bg, els, label }),
  });
  const D = { logo: 'asset:logo-wordmark', swoosh: 'asset:swoosh', group: 'asset:cover-group', m1: 'asset:mascot-01', m3: 'asset:mascot-03', m4: 'asset:mascot-04', m8: 'asset:mascot-08', pride: 'asset:illu-01-pride', coop: 'asset:illu-12-cooperation', respect: 'asset:illu-05-respect', honesty: 'asset:illu-10-honesty', justice: 'asset:illu-09-justice', back: 'asset:backcover-logo', friends: 'asset:illu-03-consideration' };

  const list = [
    { id: 'poster-recruit', cat: 'poster', name: '수련생 모집 포스터', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
      S('rect', 0, 0, 210, 38, { fill: WHITE, name: '상단 띠' }), S('rect', 0, 38, 210, 2.5, { fill: NAVY }),
      I(D.logo, 14, 9, 70, 18, { name: '로고' }),
      T('NARACHA TAEKWONDO', 100, 15, 96, 8, { font: 'Montserrat', size: 10, weight: 700, color: NAVY, align: 'right', ls: 0.2 }),
      T('2027 신규 수련생 모집', 12, 52, 186, 30, { font: 'Black Han Sans', size: 44, color: NAVY, align: 'center', lh: 1.1, name: '제목' }),
      T('바른 인성과 건강한 몸, 태권도로 시작하세요', 12, 86, 186, 10, { size: 15, weight: 500, align: 'center', color: '#333' }),
      I(D.group, 20, 100, 170, 82, { name: '삽화' }),
      S('rect', 18, 190, 174, 66, { fill: WHITE, radius: 5, name: '안내 상자' }),
      T('수련 대상   6세 ~ 성인\n수련 시간   평일 14:00 ~ 21:00 (반별 운영)\n체험 수업   무료 체험 1회\n문의 전화   010-0000-0000', 28, 198, 156, 52, { size: 13.5, lh: 1.7, weight: 500, name: '안내 내용' }),
      S('rect', 0, 266, 210, 31, { fill: NAVY, name: '하단 띠' }),
      T('나라차태권도  ·  ○○시 ○○구 ○○로 00, 2층', 12, 276, 186, 10, { size: 12, color: WHITE, align: 'center', weight: 500, name: '주소' }),
      I(D.m1, 160, 236, 36, 36, { name: '마스코트' }),
    ], '모집 포스터')]; } },
    { id: 'poster-exam', cat: 'poster', name: '승급심사 안내 포스터', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(SKY, [
      I(D.swoosh, 180, 12, 18, 16, { name: '로고' }),
      T('승급심사 안내', 12, 30, 186, 24, { font: 'Jua', size: 44, color: NAVY, align: 'center', lh: 1 }),
      T('2027년 3월 정기 승급심사', 12, 58, 186, 10, { size: 15, weight: 600, color: RED, align: 'center' }),
      S('rect', 18, 76, 174, 72, { fill: WHITE, radius: 5 }),
      T('일시', 28, 84, 30, 8, { size: 13, weight: 700, color: NAVY }), T('2027년 3월 29일(월) ~ 30일(화)  오후 5시', 60, 84, 126, 8, { size: 13, weight: 500 }),
      T('장소', 28, 100, 30, 8, { size: 13, weight: 700, color: NAVY }), T('나라차태권도 본관 수련장', 60, 100, 126, 8, { size: 13, weight: 500 }),
      T('준비', 28, 116, 30, 8, { size: 13, weight: 700, color: NAVY }), T('도복 착용, 띠 정리, 심사비 납부 확인', 60, 116, 126, 8, { size: 13, weight: 500 }),
      T('문의', 28, 132, 30, 8, { size: 13, weight: 700, color: NAVY }), T('010-0000-0000 (사범실)', 60, 132, 126, 8, { size: 13, weight: 500 }),
      I(D.pride, 30, 156, 150, 112, { name: '삽화' }),
      T('"땀과 노력은 나를 자랑스럽게 만들어 줍니다"', 12, 272, 186, 10, { size: 13, weight: 600, align: 'center', color: NAVY }),
    ], '심사 포스터')]; } },
    { id: 'flyer-camp', cat: 'flyer', name: '방학 캠프 전단지', w: 148, h: 210, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
      I(D.logo, 10, 8, 50, 12, { name: '로고' }),
      T('여름방학 특별 캠프', 8, 26, 132, 20, { font: 'Black Han Sans', size: 32, color: NAVY, align: 'center', lh: 1.1 }),
      T('2027. 7. 26(월) ~ 7. 30(금)  ·  5일간', 8, 48, 132, 8, { size: 12, weight: 600, align: 'center', color: RED }),
      I(D.coop, 14, 60, 120, 72, { name: '삽화' }),
      S('rect', 10, 136, 128, 54, { fill: WHITE, radius: 4 }),
      T('프로그램  품새·겨루기·격파·물놀이·캠프파이어\n대    상  초등 1~6학년 (선착순 30명)\n참 가 비  000,000원 (식비·보험 포함)\n신    청  도장 사무실 또는 010-0000-0000', 16, 142, 116, 44, { size: 10.5, lh: 1.65, weight: 500, name: '안내' }),
      T('나라차태권도', 8, 196, 132, 8, { font: 'Montserrat', size: 9, weight: 700, align: 'center', color: NAVY, ls: 0.2 }),
    ], '캠프 전단지')]; } },
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
    { id: 'cert-award', cat: 'cert', name: '상장', w: 297, h: 210, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('rect', 8, 8, 281, 194, { fill: '', stroke: NAVY, strokeW: 1.4, name: '바깥 테두리' }),
      S('rect', 12, 12, 273, 186, { fill: '', stroke: '#C9A227', strokeW: 0.5, name: '안쪽 테두리' }),
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
    { id: 'card-name', cat: 'card', name: '명함', w: 90, h: 50, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('rect', 0, 0, 90, 12, { fill: NAVY }),
      I(D.swoosh, 78, 2.5, 8, 7, { name: '로고' }),
      T('NARACHA TAEKWONDO', 5, 3.6, 70, 5, { font: 'Montserrat', size: 7, weight: 700, color: YEL, ls: 0.2 }),
      T('홍 길 동', 6, 17, 50, 8, { size: 16, weight: 700, name: '이름' }),
      T('사범 · 지도교사', 6, 25, 50, 5, { size: 8, color: '#555', weight: 500, name: '직함' }),
      T('M. 010-0000-0000\nE. naracha@example.com\nA. ○○시 ○○구 ○○로 00, 2층', 6, 33, 70, 14, { size: 6.8, lh: 1.55, color: '#333', name: '연락처' }),
      I(D.logo, 58, 16, 28, 8, { name: '워드마크' }),
    ], '명함')]; } },
    { id: 'card-invite', cat: 'card', name: '대회 초대장', w: 148, h: 105, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
      S('rect', 6, 6, 136, 93, { fill: '', stroke: NAVY, strokeW: 0.6, radius: 3 }),
      T('INVITATION', 12, 13, 124, 6, { font: 'Montserrat', size: 8, weight: 700, color: RED, align: 'center', ls: 0.3 }),
      T('제 5회 나라차배\n어린이 품새 대회', 12, 22, 124, 28, { font: 'Jua', size: 22, color: NAVY, align: 'center', lh: 1.15, name: '제목' }),
      T('2027년 5월 15일(토) 오전 10시\n○○체육관 다목적실', 12, 54, 124, 16, { size: 10.5, weight: 600, align: 'center', lh: 1.5 }),
      T('학부모님을 초대합니다. 아이들의 멋진 성장을 함께 응원해 주세요.', 16, 76, 116, 10, { size: 8.5, align: 'center', color: '#444', lh: 1.5 }),
      I(D.m3, 112, 66, 26, 26, { name: '마스코트' }),
      T('나라차태권도', 12, 90, 124, 5, { font: 'Montserrat', size: 7, weight: 700, align: 'center', color: NAVY, ls: 0.2 }),
    ], '초대장')]; } },
    { id: 'notice-letter', cat: 'notice', name: '가정통신문', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); return [P(WHITE, [
      S('rect', 0, 0, 210, 28, { fill: YEL }),
      I(D.logo, 14, 6, 60, 16, { name: '로고' }),
      T('가정통신문', 100, 9, 96, 10, { size: 14, weight: 700, align: 'right', color: NAVY }),
      T('2027학년도 3월 수련 안내', 18, 40, 174, 14, { size: 22, weight: 700, color: NAVY, name: '제목' }),
      S('line', 18, 58, 174, 0.6, { fill: NAVY }),
      T('학부모님께,\n\n새 학기를 맞아 3월 수련 일정과 도장 운영 안내를 드립니다. 아이들이 즐겁고 안전하게 수련할 수 있도록 가정에서도 아래 내용을 함께 확인해 주시기 바랍니다.\n\n1. 승급심사: 3월 29일(월)~30일(화), 심사비 납부 기한 3월 20일\n2. 차량 운행: 등원 14:00 / 하원 18:30·20:30 (노선표 별도 안내)\n3. 휴관일: 3월 1일(삼일절), 3월 2일(대체 휴일)\n4. 준비물: 도복 명찰, 실내화, 물통\n\n문의: 010-0000-0000 (사범실)', 18, 66, 174, 150, { size: 12, lh: 1.8, name: '본문' }),
      T('2027년  3월  2일', 18, 228, 174, 8, { size: 12, align: 'center' }),
      T('나라차태권도  관장  ○ ○ ○', 18, 240, 174, 10, { size: 14, weight: 700, align: 'center', color: NAVY }),
      S('rect', 0, 283, 210, 14, { fill: NAVY }),
      T('○○시 ○○구 ○○로 00, 2층  ·  010-0000-0000', 12, 287, 186, 6, { size: 9, color: WHITE, align: 'center' }),
    ], '가정통신문')]; } },
    { id: 'schedule', cat: 'notice', name: '수련 시간표', w: 210, h: 297, build(uid) { const { T, I, S, P } = H(uid); const els = [
      S('rect', 0, 0, 210, 34, { fill: WHITE }), S('rect', 0, 34, 210, 2.5, { fill: NAVY }), I(D.logo, 14, 8, 64, 16, { name: '로고' }),
      T('2027 수련 시간표', 90, 10, 106, 14, { size: 20, weight: 700, color: NAVY, align: 'right' }),
    ];
      const cols = ['시간', '월', '화', '수', '목', '금'], times = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
      const x0 = 14, y0 = 48, cw = 182 / 6, rh = 24;
      cols.forEach((c, i) => { els.push(S('rect', x0 + i * cw, y0, cw, 12, { fill: i === 0 ? NAVY : YEL })); els.push(T(c, x0 + i * cw, y0 + 2.8, cw, 6, { size: 11, weight: 700, align: 'center', color: i === 0 ? WHITE : NAVY })); });
      times.forEach((t, r) => { const y = y0 + 12 + r * rh; cols.forEach((c, i) => { els.push(S('rect', x0 + i * cw, y, cw, rh, { fill: i === 0 ? '#F3F4F7' : WHITE, stroke: '#CFD4DD', strokeW: 0.25 })); }); els.push(T(t, x0, y + 8, cw, 8, { size: 11, weight: 700, align: 'center', color: NAVY })); for (let i = 1; i < 6; i++) els.push(T(r % 2 ? '유아부' : '초등부', x0 + i * cw, y + 8, cw, 8, { size: 10, weight: 500, align: 'center', color: '#333', name: '반 이름' })); });
      els.push(T('※ 반 편성과 시간은 상담 후 조정됩니다.  문의 010-0000-0000', 14, 236, 182, 8, { size: 10.5, color: '#555', align: 'center' }));
      els.push(I(D.respect, 60, 246, 90, 46, { name: '삽화' }));
      return [P(WHITE, els, '시간표')]; } },
    { id: 'banner', cat: 'banner', name: '현수막 (3m × 0.7m)', w: 3000, h: 700, build(uid) { const { T, I, S, P } = H(uid); return [P(YEL, [
      S('rect', 0, 0, 90, 700, { fill: NAVY }), S('rect', 2910, 0, 90, 700, { fill: NAVY }),
      I(D.logo, 160, 70, 700, 170, { name: '로고' }),
      T('신규 수련생 모집', 900, 60, 1950, 300, { font: 'Black Han Sans', size: 520, color: NAVY, align: 'center', lh: 1 }),
      T('바른 인성 · 건강한 체력 · 무료 체험 수업    ☎ 010-0000-0000', 160, 420, 2680, 150, { size: 190, weight: 700, color: RED, align: 'center', lh: 1 }),
      I(D.m1, 2560, 240, 380, 380, { name: '마스코트' }),
    ], '현수막')]; } },
  ];
  const cats = [['all', '전체'], ['calendar', '달력'], ['poster', '포스터'], ['flyer', '전단지'], ['sns', 'SNS'], ['cert', '상장·증서'], ['card', '명함·초대장'], ['notice', '안내문'], ['banner', '현수막']];
  return { list, cats, get: id => list.find(t => t.id === id) };
})();
