// 템플릿 3: 꼬리표(제작 형태·계절·연령·상황·직종) + 조합형 레이아웃 엔진으로 만드는 템플릿 100여 종
(function () {
  const L = NC.tpl.list;
  const WHITE = '#ffffff', INK = '#1a1a1a';
  const PHONE = '010-0000-0000', ADDR = '○○시 ○○구 ○○로 00, 2층';
  const H = (uid) => ({
    T: (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: 'Noto Sans KR', size: 12, weight: 400, italic: false, color: INK, align: 'left', lh: 1.35, ls: 0, strokeW: 0, strokeC: WHITE, shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, st),
    I: (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }, st),
    S: (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: '#F0716B', stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st),
    P: (bg, els, label) => ({ id: uid(), bg, els, label }),
  });
  /* ---- 꼬리표 사전 ---- */
  const FORMATS = { poster: '포스터', flyer: '전단지', leaflet: '리플렛', sns: 'SNS', card: '명함·카드', cert: '상장·증서', notice: '안내문', banner: '현수막·입간판', sticker: '쿠폰·명찰·스티커', sheet: '서식·활동지', web: '웹·영상', calendar: '달력', calpage: '달력', season: '포스터' };
  NC.tpl.facets = {
    format: ['포스터', '전단지', 'SNS', '카드뉴스', '현수막·입간판', '명함·카드', '상장·증서', '안내문', '쿠폰·명찰·스티커', '서식·활동지', '웹·영상', '리플렛', '달력'],
    season: ['사계절', '봄', '여름', '가을', '겨울'],
    age: ['전체', '유아', '초등', '청소년', '성인', '학부모'],
    occasion: ['모집', '행사', '축하', '안내', '명절·인사', '감사', '할인·이벤트', '오픈', '심사·대회', '캠프·특강', '휴관', '교육'],
    biz: ['태권도장', '학원', '유치원·어린이집', '교회·단체', '카페·식당', '미용실·뷰티', '헬스·필라테스', '병원·약국', '부동산', '꽃집·소상공인', '학교·기관'],
  };
  /* ---- 계절 팔레트와 장식 ---- */
  const SEASON = {
    '봄': { bg: '#FFF0F5', bg2: '#FBD3E0', fg: '#7A2E4F', ac: '#E86A8E', soft: WHITE, tx: '#3a2a33', sub: '#8a5a6a', motifs: ['🌸', '🌷', '🌱', '🐝', '🦋'], fontT: 'Jua' },
    '여름': { bg: '#E6F6FB', bg2: '#BFE8F5', fg: '#0E5A8A', ac: '#FFB300', soft: WHITE, tx: '#17324a', sub: '#4a6a80', motifs: ['☀️', '🌊', '🍉', '⛱️', '🐬'], fontT: 'Black Han Sans' },
    '가을': { bg: '#FFF4E3', bg2: '#F2B266', fg: '#6B3A1E', ac: '#D1521F', soft: WHITE, tx: '#3a2a1e', sub: '#7a5a40', motifs: ['🍁', '🍂', '🌰', '🎃', '🍎'], fontT: 'Gowun Batang' },
    '겨울': { bg: '#EAF1FA', bg2: '#DCEBF7', fg: '#1B2A4A', ac: '#D13B3B', soft: WHITE, tx: '#1a2232', sub: '#55657f', motifs: ['❄️', '⛄', '🎄', '🧣', '⭐'], fontT: 'Do Hyeon' },
    '사계절': { bg: '#FFE89A', bg2: '#FFD34D', fg: '#1E2B5A', ac: '#E0564B', soft: WHITE, tx: INK, sub: '#444', motifs: ['⭐', '✨', '🎯', '🏆', '🥋'], fontT: 'Jua' },
  };
  const AGE_FONT = { '유아': ['Dongle', 'Gaegu'], '초등': ['Jua', 'Noto Sans KR'], '청소년': ['Black Han Sans', 'Pretendard'], '성인': ['Pretendard', 'Pretendard'], '학부모': ['Gowun Batang', 'Noto Sans KR'], '전체': [null, 'Noto Sans KR'] };
  /* ---- 직종별 기본 정보·아이콘 ---- */
  const BIZ = {
    '태권도장': { name: '나라차태권도', icon: '🥋', illu: 'asset:illu-01-pride', group: 'asset:cover-group', mascot: 'asset:mascot-01' },
    '학원': { name: '○○학원', icon: '📚' }, '유치원·어린이집': { name: '○○유치원', icon: '🧸' }, '교회·단체': { name: '○○교회', icon: '⛪' },
    '카페·식당': { name: '카페 ○○', icon: '☕' }, '미용실·뷰티': { name: '○○헤어', icon: '💇‍♀️' }, '헬스·필라테스': { name: '○○피트니스', icon: '🏋️' },
    '병원·약국': { name: '○○의원', icon: '🩺' }, '부동산': { name: '○○공인중개사', icon: '🏠' }, '꽃집·소상공인': { name: '○○플라워', icon: '💐' }, '학교·기관': { name: '○○초등학교', icon: '🏫' },
  };
  /* ---- 상황별 카피 (직종 이름을 끼워 넣음) ---- */
  const COPY = {
    '모집': b => ({ eyebrow: 'OPEN', title: '신규 회원\n모집', sub: `${b.name}에서 새 식구를 기다립니다`, body: '대상  어린이·청소년·성인\n시간  평일 오후 · 주말 오전\n문의  ' + PHONE, cta: '무료 체험 신청' }),
    '봄학기모집': b => ({ eyebrow: 'SPRING', title: '봄학기\n신입생 모집', sub: `새 학기, ${b.name}에서 시작하세요`, body: '접수  3월 ○일까지\n대상  초등 1~6학년\n문의  ' + PHONE, cta: '3월 등록 할인' }),
    '행사': b => ({ eyebrow: 'EVENT', title: '가족 운동회', sub: `${b.name} 가족이 함께하는 하루`, body: '일시  ○월 ○일(토) 오전 10시\n장소  ○○체육관\n준비  편한 옷, 물통', cta: '참가 신청' }),
    '축하': b => ({ eyebrow: 'CONGRATULATIONS', title: '축하합니다', sub: '여러분의 노력이 빛났습니다', body: '홍길동 · 김나라 · 이차차\n' + b.name + ' 가족 모두가 축하합니다', cta: '' }),
    '안내': b => ({ eyebrow: 'NOTICE', title: '안내 말씀', sub: `${b.name} 운영 안내`, body: '○월 ○일부터 운영 시간이 바뀝니다.\n평일 14:00~21:00 · 토요일 10:00~14:00\n문의 ' + PHONE, cta: '' }),
    '명절·인사': b => ({ eyebrow: 'GREETINGS', title: '행복한\n명절 되세요', sub: `${b.name} 임직원 일동`, body: '가족과 함께 넉넉하고 따뜻한\n시간 보내시길 바랍니다.', cta: '' }),
    '감사': b => ({ eyebrow: 'THANK YOU', title: '감사합니다', sub: '한 해 동안 보내 주신 믿음에', body: '새해에도 변함없는 사랑과\n관심 부탁드립니다.\n— ' + b.name, cta: '' }),
    '할인·이벤트': b => ({ eyebrow: 'EVENT', title: '친구 추천\n이벤트', sub: '함께 등록하면 두 사람 모두 선물', body: '기간  ○월 ○일 ~ ○월 ○일\n혜택  등록비 20% 할인\n문의  ' + PHONE, cta: '지금 신청' }),
    '오픈': b => ({ eyebrow: 'GRAND OPEN', title: '새롭게\n문을 엽니다', sub: `${b.name} ○월 ○일 오픈`, body: '오픈 기념 혜택\n첫 달 등록비 50% · 기념품 증정\n' + ADDR, cta: '오시는 길' }),
    '심사·대회': b => ({ eyebrow: 'CONTEST', title: '대회·심사\n안내', sub: `${b.name} ○월 정기 심사`, body: '일시  ○월 ○일(토) 오후 2시\n장소  본관\n준비  복장·참가비 확인', cta: '' }),
    '캠프·특강': b => ({ eyebrow: 'CAMP', title: '방학 특별\n캠프', sub: '5일간의 특별한 경험', body: '기간  ○월 ○일 ~ ○일\n대상  초등 1~6학년 (선착순 30명)\n문의  ' + PHONE, cta: '신청하기' }),
    '휴관': b => ({ eyebrow: 'CLOSED', title: '휴관 안내', sub: '○월 ○일 ~ ○일', body: '명절 연휴로 쉬어갑니다.\n○월 ○일부터 정상 운영합니다.\n긴급 ' + PHONE, cta: '' }),
    '교육': b => ({ eyebrow: 'CLASS', title: '학부모\n설명회', sub: `${b.name} 교육 과정 안내`, body: '일시  ○월 ○일(토) 오전 11시\n내용  과정 소개 · 상담\n문의  ' + PHONE, cta: '참석 신청' }),
  };
  /* ---- 레이아웃 엔진: 크기에 상관없이 비율로 배치 ---- */
  function compose(uid, o) {
    const { T, I, S, P } = H(uid); const w = o.w, h = o.h, u = Math.min(w, h) / 100, m = 6 * u; const P_ = o.pal, c = o.copy, fT = o.fontT, fB = o.fontB;
    const dark = isDark(P_.bg); const tx = dark ? WHITE : P_.tx, sub = dark ? '#dde3f0' : P_.sub;
    const els = []; const tall = h / w > 1.2, wide = w / h > 1.6;
    const motif = (i, x, y, s) => I(emojiSVG(P_.motifs[i % P_.motifs.length]), x, y, s, s, { name: '장식', fit: 'contain', opacity: 0.95 }); // 벡터 이모지: 현수막처럼 크게 인쇄해도 선명
    if (o.layout === 'band') {
      els.push(S('rect', 0, 0, w, h * 0.42, { fill: P_.fg, name: '상단 띠' }));
      els.push(T(c.eyebrow, m, m * 0.9, w - 2 * m, 4 * u, { font: 'Montserrat', size: 3.6 * u, weight: 700, color: P_.ac, ls: 0.3 }));
      els.push(T(c.title, m, m * 0.9 + 5 * u, w - 2 * m, h * 0.42 - m - 12 * u, { font: fT, size: (tall ? 17 : 14) * u, weight: 800, color: WHITE, lh: 1.08, name: '제목' }));
      els.push(T(c.sub, m, h * 0.42 - 8 * u, w - 2 * m, 6 * u, { font: fB, size: 4.6 * u, weight: 500, color: '#e6e9f2', name: '부제' }));
      els.push(motif(0, w - m - 14 * u, m * 0.6, 14 * u)); els.push(motif(1, w - m - 30 * u, h * 0.42 - 12 * u, 9 * u));
      els.push(S('rect', m, h * 0.48, w - 2 * m, h * 0.3, { fill: P_.soft, radius: 2 * u, name: '안내 상자' }));
      els.push(T(c.body, m + 4 * u, h * 0.48 + 4 * u, w - 2 * m - 8 * u, h * 0.3 - 8 * u, { font: fB, size: 4.2 * u, lh: 1.75, weight: 500, color: INK, name: '본문' }));
      if (c.cta) { els.push(S('pill', w / 2 - 22 * u, h * 0.82, 44 * u, 9 * u, { fill: P_.ac })); els.push(T(c.cta, w / 2 - 22 * u, h * 0.82 + 2.2 * u, 44 * u, 5 * u, { font: fB, size: 4.4 * u, weight: 700, color: WHITE, align: 'center', name: '버튼' })); }
      els.push(T(`${o.biz.name}  ·  ${ADDR}  ·  ${PHONE}`, m, h - m - 3 * u, w - 2 * m, 4 * u, { font: fB, size: 2.9 * u, color: tx, align: 'center', name: '하단 정보' }));
      return P(P_.bg, els, o.label);
    }
    if (o.layout === 'center') { // 위에서 아래로 차례로 쌓음 (정사각형에서도 쪽 밖으로 넘치거나 버튼이 제목을 가리지 않게)
      const Hu = h / u, D = tall ? 60 : 44, cy0 = tall ? 10 : 6;
      els.push(S('ellipse', w / 2 - D / 2 * u, cy0 * u, D * u, D * u, { fill: P_.bg2, name: '원' }));
      els.push(motif(0, w / 2 - D * 0.19 * u, (cy0 + D * 0.12) * u, D * 0.38 * u));
      if (o.biz.illu && o.useIllu) els.push(I(o.biz.illu, w / 2 - D * 0.41 * u, (cy0 + D * 0.09) * u, D * 0.82 * u, D * 0.88 * u, { pos: '50% 100%', name: '삽화' }));
      let y = cy0 + D + (tall ? 5 : 3); const ctaY = Hu - 6 - 14;
      els.push(T(c.eyebrow, m, y * u, w - 2 * m, 4 * u, { font: 'Montserrat', size: 3.4 * u, weight: 700, color: P_.ac, ls: 0.3, align: 'center' })); y += 5;
      const tS = tall ? 15 : 12; els.push(T(c.title.replace('\n', ' '), m, y * u, w - 2 * m, (tS * 0.45 + 2) * u, { font: fT, size: tS * u, weight: 800, color: dark ? WHITE : P_.fg, lh: 1.1, align: 'center', name: '제목' })); y += tS * 0.45 + 3;
      els.push(T(c.sub, m, y * u, w - 2 * m, 6 * u, { font: fB, size: 4.4 * u, weight: 500, color: sub, align: 'center', name: '부제' })); y += 7;
      const bodyH = c.body.split('\n').length * 3.9 * 0.3528 * 1.7 + 2;
      if (y + bodyH <= (c.cta ? ctaY : Hu - 10) - 1) els.push(T(c.body, m + 6 * u, y * u, w - 2 * m - 12 * u, bodyH * u, { font: fB, size: 3.9 * u, lh: 1.7, weight: 500, color: tx, align: 'center', name: '본문' }));
      if (c.cta) { els.push(S('pill', w / 2 - 20 * u, ctaY * u, 40 * u, 8 * u, { fill: P_.fg })); els.push(T(c.cta, w / 2 - 20 * u, (ctaY + 1.5) * u, 40 * u, 5 * u, { font: fB, size: 4 * u, weight: 700, color: P_.ac, align: 'center', valign: 'middle', name: '버튼' })); }
      els.push(motif(1, m, m, 10 * u)); els.push(motif(2, w - m - 10 * u, m * 0.8, 10 * u)); els.push(motif(3, m * 0.8, h - m - 12 * u, 9 * u));
      els.push(T(o.biz.name, m, h - m - 3 * u, w - 2 * m, 4 * u, { font: 'Montserrat', size: 3 * u, weight: 700, color: dark ? WHITE : P_.fg, align: 'center', ls: 0.2 }));
      return P(P_.bg, els, o.label);
    }
    if (o.layout === 'split') {
      els.push(S('rect', 0, 0, w * 0.5, h, { fill: P_.fg, name: '왼쪽 면' }));
      els.push(T(c.eyebrow, m, m, w * 0.5 - 2 * m, 4 * u, { font: 'Montserrat', size: 3.4 * u, weight: 700, color: P_.ac, ls: 0.3 }));
      els.push(T(c.title, m, m + 6 * u, w * 0.5 - 1.5 * m, h * 0.5, { font: fT, size: (tall ? 15 : 12) * u, weight: 800, color: WHITE, lh: 1.08, name: '제목' }));
      els.push(T(c.sub, m, h - m - 10 * u, w * 0.5 - 2 * m, 8 * u, { font: fB, size: 4 * u, weight: 500, color: '#e6e9f2', lh: 1.4, name: '부제' }));
      els.push(motif(0, w * 0.5 + m, m, 18 * u));
      if (o.biz.illu && o.useIllu) els.push(I(o.biz.illu, w * 0.5 + m, h * 0.12, w * 0.5 - 2 * m, h * 0.42, { pos: '50% 100%', name: '삽화' }));
      els.push(T(c.body, w * 0.5 + m, h * 0.6, w * 0.5 - 2 * m, h * 0.25, { font: fB, size: 4 * u, lh: 1.75, weight: 500, color: tx, name: '본문' }));
      if (c.cta) { els.push(S('pill', w * 0.5 + m, h - m - 12 * u, w * 0.5 - 2 * m, 9 * u, { fill: P_.ac })); els.push(T(c.cta, w * 0.5 + m, h - m - 9.8 * u, w * 0.5 - 2 * m, 5 * u, { font: fB, size: 4.2 * u, weight: 700, color: WHITE, align: 'center', name: '버튼' })); }
      els.push(T(o.biz.name + ' · ' + PHONE, w * 0.5 + m, h - m - 2.5 * u, w * 0.5 - 2 * m, 4 * u, { font: fB, size: 2.8 * u, color: sub, name: '하단 정보' }));
      return P(P_.bg, els, o.label);
    }
    if (o.layout === 'frame') {
      els.push(S('rect', m * 0.7, m * 0.7, w - 1.4 * m, h - 1.4 * m, { fill: '', stroke: P_.fg, strokeW: 0.5 * u, radius: 1.5 * u, name: '테두리' }));
      els.push(S('rect', m * 0.7 + 1.6 * u, m * 0.7 + 1.6 * u, w - 1.4 * m - 3.2 * u, h - 1.4 * m - 3.2 * u, { fill: '', stroke: P_.ac, strokeW: 0.15 * u, radius: 1 * u, name: '안쪽 테두리' }));
      [[m, m], [w - m - 10 * u, m], [m, h - m - 10 * u], [w - m - 10 * u, h - m - 10 * u]].forEach((p, i) => els.push(motif(i, p[0], p[1], 10 * u)));
      els.push(T(c.eyebrow, m, h * 0.2, w - 2 * m, 4 * u, { font: 'Montserrat', size: 3.4 * u, weight: 700, color: P_.ac, ls: 0.35, align: 'center' }));
      // 제목은 자리(높이 h*0.3)를 채우는 크기로 (작은 엽서에서 위아래가 비지 않게), 줄 길이도 넘지 않게
      const tl = c.title.split('\n'), tByH = (h * 0.3) / (tl.length * 1.1) * 0.9 / 0.3528, tByW = (w - 2 * m) * 0.92 / (Math.max(...tl.map(l => [...l].length)) * 0.95) / 0.3528, tSz = Math.min(tByH, tByW, (tall ? 16 : 13) * u * 1.7);
      els.push(T(c.title, m, h * 0.2 + 6 * u, w - 2 * m, h * 0.3, { font: fT, size: Math.max((tall ? 16 : 13) * u, tSz), weight: 800, color: dark ? WHITE : P_.fg, lh: 1.1, align: 'center', valign: 'middle', name: '제목' }));
      els.push(S('line', w / 2 - 12 * u, h * 0.56, 24 * u, 1, { fill: P_.ac, stroke: P_.ac, strokeW: 0.4 * u }));
      els.push(T(c.sub, m, h * 0.58, w - 2 * m, 6 * u, { font: fB, size: 4.4 * u, weight: 600, color: dark ? WHITE : P_.fg, align: 'center', name: '부제' }));
      els.push(T(c.body, m + 6 * u, h * 0.65, w - 2 * m - 12 * u, h * 0.2, { font: fB, size: 3.9 * u, lh: 1.75, weight: 500, color: tx, align: 'center', name: '본문' }));
      els.push(T(o.biz.name, m, h - m - 4 * u, w - 2 * m, 4 * u, { font: 'Montserrat', size: 3 * u, weight: 700, color: dark ? WHITE : P_.fg, align: 'center', ls: 0.25 }));
      return P(P_.bg, els, o.label);
    }
    if (o.layout === 'minimal') {
      els.push(S('rect', 0, 0, w, 1.2 * u, { fill: P_.ac }));
      els.push(T(c.eyebrow, m, m, w - 2 * m, 4 * u, { font: 'Montserrat', size: 3.2 * u, weight: 700, color: P_.sub, ls: 0.35 }));
      els.push(T(c.title, m, m + 7 * u, w - 2 * m, h * 0.4, { font: fT, size: (tall ? 20 : 15) * u, weight: 900, color: dark ? WHITE : P_.fg, lh: 1.02, ls: -0.02, name: '제목' }));
      els.push(T(c.sub, m, h * 0.56, w - 2 * m, 6 * u, { font: fB, size: 4.8 * u, weight: 600, color: P_.ac, name: '부제' }));
      els.push(T(c.body, m, h * 0.64, w * 0.62, h * 0.22, { font: fB, size: 4 * u, lh: 1.75, weight: 500, color: tx, name: '본문' }));
      els.push(motif(0, w - m - 22 * u, h * 0.62, 22 * u));
      if (c.cta) { els.push(S('rect', m, h - m - 10 * u, 36 * u, 8 * u, { fill: dark ? WHITE : P_.fg, radius: 0.8 * u })); els.push(T(c.cta, m, h - m - 7.8 * u, 36 * u, 5 * u, { font: fB, size: 3.8 * u, weight: 700, color: dark ? P_.fg : WHITE, align: 'center', name: '버튼' })); }
      els.push(T(o.biz.name + '  ' + PHONE, w - m - 60 * u, h - m - 2 * u, 60 * u, 4 * u, { font: fB, size: 2.9 * u, color: sub, align: 'right', name: '하단 정보' }));
      return P(P_.bg, els, o.label);
    }
    if (o.layout === 'banner') {
      els.push(S('rect', 0, 0, w, h * 0.09, { fill: P_.fg })); els.push(S('rect', 0, h * 0.91, w, h * 0.09, { fill: P_.fg }));
      els.push(T(c.title.replace('\n', ' '), w * 0.04, h * 0.17, w * 0.78, h * 0.4, { font: fT, size: h * 0.46, weight: 900, color: P_.fg, lh: 1, name: '제목' }));
      els.push(T((c.sub + '   ' + (c.cta ? '☎ ' + PHONE : '')).trim(), w * 0.04, h * 0.62, w * 0.78, h * 0.22, { font: fB, size: h * 0.22, weight: 700, color: P_.ac, lh: 1, name: '부제' }));
      els.push(motif(0, w * 0.84, h * 0.18, h * 0.6));
      return P(P_.bg, els, o.label);
    }
    if (o.layout === 'story') { // 세로 긴 SNS
      els.push(S('ellipse', -w * 0.3, -h * 0.1, w * 1.1, w * 1.1, { fill: P_.bg2, name: '원' }));
      els.push(motif(0, w * 0.6, h * 0.08, w * 0.3));
      els.push(T(c.eyebrow, m, h * 0.32, w - 2 * m, 5 * u, { font: 'Montserrat', size: 4 * u, weight: 700, color: P_.ac, ls: 0.3 }));
      els.push(T(c.title, m, h * 0.36, w - 2 * m, h * 0.22, { font: fT, size: 18 * u, weight: 800, color: dark ? WHITE : P_.fg, lh: 1.08, name: '제목' }));
      els.push(T(c.sub, m, h * 0.6, w - 2 * m, 8 * u, { font: fB, size: 5.4 * u, weight: 600, color: sub, lh: 1.4, name: '부제' }));
      els.push(T(c.body, m, h * 0.68, w - 2 * m, h * 0.16, { font: fB, size: 4.6 * u, lh: 1.7, weight: 500, color: tx, name: '본문' }));
      if (c.cta) { els.push(S('pill', m, h * 0.87, w - 2 * m, 10 * u, { fill: P_.fg })); els.push(T(c.cta, m, h * 0.87 + 2.6 * u, w - 2 * m, 6 * u, { font: fB, size: 5 * u, weight: 700, color: P_.ac, align: 'center', name: '버튼' })); }
      els.push(T(o.biz.name, m, h - m - 4 * u, w - 2 * m, 5 * u, { font: 'Montserrat', size: 3.4 * u, weight: 700, color: dark ? WHITE : P_.fg, ls: 0.2, name: '하단 정보' }));
      return P(P_.bg, els, o.label);
    }
    return P(P_.bg, els, o.label);
  }
  // 글자 크기 바닥: SNS·카드뉴스·스토리·썸네일은 휴대폰 화면에서 읽히게, 작은 인쇄물은 7pt 이상.
  // 글 상자의 폭(가장 긴 줄)과 높이를 넘지 않는 만큼만 키워 레이아웃이 깨지지 않게 함
  const emW = ch => /[\u3131-\uD7A3\u4E00-\u9FFF]/.test(ch) ? 0.95 : /[A-Z0-9]/.test(ch) ? 0.66 : ch === ' ' ? 0.3 : 0.52;
  function typeFloor(pg, fmt, w, h) {
    const screen = ['sns', 'story', 'card4x5', 'yt'].includes(fmt), u = Math.min(w, h) / 100;
    pg.els.forEach(e => {
      if (e.type !== 'text' || e.name === '장식' || !e.size) return;
      const k = e.size / u; let f = screen ? (k >= 10 ? 1.25 : k >= 5 ? 1.7 : 2.1) : (e.size < 7 ? 7 / e.size : 1);
      if (f <= 1) return;
      const mm = e.size * 0.3528, lines = String(e.text).split('\n');
      const longest = Math.max(...lines.map(l => [...l].reduce((a, ch) => a + emW(ch), 0) + (e.ls || 0) * l.length)) * mm;
      if (longest > 0) f = Math.min(f, (e.w * 0.98) / longest);
      const tall = lines.length * mm * (e.lh || 1.35); if (tall > 0) f = Math.min(f, Math.max(1, (e.h * 1.05) / tall));
      if (f > 1.02) { e.size = Math.round(e.size * f * 10) / 10; }
    });
    return pg;
  }
  // 이모지 → Noto Emoji 벡터 그림 주소 (Apache 2.0). 기기마다 모양이 달라지거나 크게 인쇄할 때 깨지지 않게
  const emojiSVG = ch => 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/svg/emoji_u' + [...ch].map(c => c.codePointAt(0).toString(16)).filter(c => c !== 'fe0f').join('_') + '.svg';
  NC.emojiSVG = emojiSVG;
  function isDark(hex) { if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return false; const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 120; }
  const SIZE = { poster: [210, 297, '포스터'], flyer: [148, 210, '전단지'], sns: [285.75, 285.75, 'SNS'], story: [285.75, 508, 'SNS'], card4x5: [285.75, 357.19, '카드뉴스'], postcard: [148, 105, '명함·카드'], banner: [3000, 700, '현수막·입간판'], yt: [338.67, 190.5, '웹·영상'] };
  const LAYOUT_FOR = { poster: ['band', 'center', 'split', 'frame', 'minimal'], flyer: ['band', 'center', 'minimal', 'frame'], sns: ['center', 'minimal', 'frame', 'split'], story: ['story'], card4x5: ['center', 'band'], postcard: ['frame', 'minimal'], banner: ['banner'], yt: ['split', 'minimal'] };
  let n = 0;
  function make(o) {
    const [w, h, fmtName] = SIZE[o.fmt]; const pal = Object.assign({}, SEASON[o.season || '사계절'], o.pal || {}); const biz = BIZ[o.biz || '태권도장']; const copy = Object.assign((COPY[o.copy || o.occasion] || COPY['모집'])(biz), o.text || {});
    const af = AGE_FONT[o.age || '전체']; const fontT = o.fontT || af[0] || pal.fontT; const fontB = af[1];
    const label = o.name; const id = 'g-' + (++n) + '-' + o.fmt;
    L.push({ id, cat: o.cat || (o.fmt === 'story' || o.fmt === 'card4x5' ? 'sns' : o.fmt === 'postcard' ? 'card' : o.fmt === 'banner' ? 'banner' : o.fmt === 'yt' ? 'web' : o.fmt), name: o.name, w, h, tags: { format: fmtName === 'SNS' && o.fmt === 'card4x5' ? '카드뉴스' : fmtName, season: o.season || '사계절', age: o.age || '전체', occasion: o.occasion, biz: o.biz || '태권도장' }, kw: [o.season, o.age, o.occasion, o.biz, fmtName, o.name].filter(Boolean).join(' '), build: (uid) => [typeFloor(compose(uid, { w, h, pal, copy, layout: o.layout, fontT, fontB, biz, label, useIllu: o.useIllu }), o.fmt, w, h)] });
  }
  /* ===== 생성 목록 ===== */
  // 1) 계절 × 형태 (태권도장 기본, 삽화 사용)
  ['봄', '여름', '가을', '겨울'].forEach((s, si) => {
    const occ = ['봄학기모집', '캠프·특강', '행사', '명절·인사'][si]; const occTag = ['모집', '캠프·특강', '행사', '명절·인사'][si];
    make({ fmt: 'poster', season: s, occasion: occTag, copy: occ, layout: ['band', 'center', 'split', 'frame'][si], name: `${s} ${occTag} 포스터`, useIllu: true });
    make({ fmt: 'flyer', season: s, occasion: occTag, copy: occ, layout: ['center', 'band', 'minimal', 'frame'][si], name: `${s} ${occTag} 전단지`, useIllu: true });
    make({ fmt: 'sns', season: s, occasion: occTag, copy: occ, layout: ['center', 'frame', 'minimal', 'split'][si], name: `${s} ${occTag} SNS`, useIllu: true });
    make({ fmt: 'story', season: s, occasion: occTag, copy: occ, layout: 'story', name: `${s} ${occTag} 스토리` });
    make({ fmt: 'banner', season: s, occasion: occTag, copy: occ, layout: 'banner', name: `${s} ${occTag} 현수막` });
    make({ fmt: 'postcard', season: s, occasion: '명절·인사', copy: '명절·인사', layout: 'frame', name: `${s} 인사 카드` });
  });
  // 2) 연령별 (톤이 다른 글꼴·카피)
  [['유아', '모집', 'center', '유아부 모집'], ['초등', '캠프·특강', 'band', '초등 방학 캠프'], ['청소년', '모집', 'split', '청소년 모집'], ['성인', '모집', 'minimal', '성인반 모집'], ['학부모', '교육', 'frame', '학부모 설명회']].forEach(([age, occ, lay, nm]) => {
    make({ fmt: 'poster', age, occasion: occ, copy: occ, layout: lay, name: `${nm} 포스터`, useIllu: true });
    make({ fmt: 'sns', age, occasion: occ, copy: occ, layout: age === '성인' ? 'minimal' : 'center', name: `${nm} SNS`, useIllu: true });
    make({ fmt: 'flyer', age, occasion: occ, copy: occ, layout: age === '학부모' ? 'frame' : 'band', name: `${nm} 전단지` });
  });
  // 3) 상황별 (사계절 브랜드 색)
  ['행사', '축하', '안내', '감사', '할인·이벤트', '오픈', '심사·대회', '휴관', '교육'].forEach((occ, i) => {
    const lay = ['band', 'center', 'minimal', 'frame', 'split'][i % 5];
    make({ fmt: 'poster', occasion: occ, copy: occ, layout: lay, name: `${occ} 포스터`, useIllu: occ !== '휴관' });
    make({ fmt: 'sns', occasion: occ, copy: occ, layout: ['center', 'minimal', 'frame'][i % 3], name: `${occ} SNS 카드` });
    make({ fmt: 'card4x5', occasion: occ, copy: occ, layout: i % 2 ? 'band' : 'center', name: `${occ} 카드뉴스` });
  });
  // 4) 직종별 (태권도장 외) — 모집·오픈·할인 세트, 직종에 맞는 계절감 없이 브랜드 톤
  const BIZPAL = { '학원': { bg: '#EAF2FF', bg2: '#C9DBFF', fg: '#1F3A93', ac: '#FF8A00' }, '유치원·어린이집': { bg: '#FFF7E0', bg2: '#FFE2A8', fg: '#C2582D', ac: '#3AA76D', motifs: ['🧸', '🎈', '🌈', '⭐', '🍭'] }, '교회·단체': { bg: '#F6F2FF', bg2: '#E3D9FF', fg: '#4B2E83', ac: '#C9A227', motifs: ['✝️', '🕊️', '🌿', '📖', '💒'] }, '카페·식당': { bg: '#FFF8F1', bg2: '#F3DEC8', fg: '#5A3A1E', ac: '#C8392B', motifs: ['☕', '🥐', '🍰', '🍝', '🌿'] }, '미용실·뷰티': { bg: '#FFF0F6', bg2: '#FBD0E3', fg: '#7A2E5A', ac: '#111111', motifs: ['✂️', '💄', '💅', '✨', '🪞'] }, '헬스·필라테스': { bg: '#111318', bg2: '#2A2F3A', fg: '#111318', ac: '#C6FF3D', tx: WHITE, sub: '#B8C0CC', motifs: ['🏋️', '💪', '🔥', '⚡', '🧘'] }, '병원·약국': { bg: '#F0F7FA', bg2: '#CFE7F0', fg: '#0F6E8C', ac: '#E0564B', motifs: ['🩺', '💊', '🏥', '🩹', '❤️'] }, '부동산': { bg: '#F4F6F8', bg2: '#D9E0E8', fg: '#1E2B5A', ac: '#C9A227', motifs: ['🏠', '🔑', '🏢', '📍', '📈'] }, '꽃집·소상공인': { bg: '#F3FBF4', bg2: '#CFEFD6', fg: '#2F5D3A', ac: '#E86A8E', motifs: ['💐', '🌹', '🌻', '🎀', '🛍️'] }, '학교·기관': { bg: '#FFFFFF', bg2: '#E6EDF2', fg: '#1E2B5A', ac: '#E0564B', motifs: ['🏫', '📚', '🎓', '📣', '🗓️'] } };
  Object.keys(BIZPAL).forEach((b, i) => {
    const pal = BIZPAL[b];
    make({ fmt: 'poster', biz: b, pal, occasion: '모집', copy: '모집', layout: ['band', 'center', 'split', 'minimal', 'frame'][i % 5], name: `${b} 모집 포스터`, fontT: b === '헬스·필라테스' ? 'Black Han Sans' : b === '유치원·어린이집' ? 'Jua' : b === '교회·단체' ? 'Gowun Batang' : 'Pretendard', age: b === '유치원·어린이집' ? '유아' : b === '헬스·필라테스' ? '성인' : '전체' });
    make({ fmt: 'sns', biz: b, pal, occasion: '오픈', copy: '오픈', layout: ['center', 'minimal', 'frame'][i % 3], name: `${b} 오픈 SNS`, fontT: b === '헬스·필라테스' ? 'Black Han Sans' : 'Pretendard' });
    make({ fmt: 'flyer', biz: b, pal, occasion: '할인·이벤트', copy: '할인·이벤트', layout: ['band', 'minimal', 'center'][i % 3], name: `${b} 이벤트 전단지`, fontT: 'Pretendard' });
    make({ fmt: 'banner', biz: b, pal, occasion: '오픈', copy: '오픈', layout: 'banner', name: `${b} 오픈 현수막`, fontT: 'Black Han Sans' });
  });
  // 5) 유튜브 썸네일·카드 몇 종
  make({ fmt: 'yt', occasion: '교육', copy: '교육', layout: 'split', name: '교육 영상 썸네일', useIllu: true, fontT: 'Black Han Sans' });
  make({ fmt: 'yt', occasion: '행사', copy: '행사', layout: 'minimal', name: '행사 영상 썸네일', fontT: 'Black Han Sans' });
  make({ fmt: 'postcard', occasion: '감사', copy: '감사', layout: 'frame', name: '감사 엽서' });
  make({ fmt: 'postcard', occasion: '축하', copy: '축하', layout: 'minimal', name: '축하 엽서', season: '봄' });

  /* ===== 기존 템플릿 꼬리표 자동 부여 ===== */
  const OCC_KW = [['recruit', '모집'], ['trial', '모집'], ['fee', '안내'], ['exam', '심사·대회'], ['contest', '심사·대회'], ['winter', '캠프·특강'], ['camp', '캠프·특강'], ['notice', '안내'], ['event', '할인·이벤트'], ['coupon', '할인·이벤트'], ['congrats', '축하'], ['cert', '축하'], ['thanks', '감사'], ['seol', '명절·인사'], ['chuseok', '명절·인사'], ['yearend', '행사'], ['grad', '축하'], ['show', '행사'], ['welcome', '모집'], ['closed', '휴관'], ['openclass', '교육'], ['coach', '안내'], ['items', '안내'], ['bus', '안내'], ['safety', '교육'], ['invite', '행사'], ['birthday', '축하'], ['schedule', '안내'], ['letter', '안내'], ['quote', '교육'], ['cardnews', '교육'], ['story', '안내'], ['banner', '모집'], ['xbanner', '모집'], ['nametag', '안내'], ['sticker', '축하'], ['ticket', '행사'], ['label', '안내'], ['appoint', '축하'], ['attend', '축하'], ['complete', '축하'], ['award', '축하'], ['belt', '축하'], ['sheet', '교육'], ['game', '교육'], ['garland', '행사'], ['memo', '안내'], ['menu', '안내'], ['poll', '행사'], ['photo', '행사'], ['carousel', '교육'], ['web', '모집'], ['yt', '교육'], ['name', '안내'], ['leaflet', '모집'], ['cal', '안내']];
  const SEASON_KW = [['winter', '겨울'], ['seol', '겨울'], ['yearend', '겨울'], ['camp', '여름'], ['chuseok', '가을'], ['grad', '봄'], ['spring', '봄']];
  const AGE_KW = [['kid', '유아'], ['camp', '초등'], ['grad', '초등'], ['parent', '학부모'], ['openclass', '학부모'], ['letter', '학부모'], ['bus', '학부모'], ['adult', '성인']];
  L.forEach(t => {
    if (t.tags) return;
    const id = t.id.toLowerCase(); const occ = (OCC_KW.find(([k]) => id.includes(k)) || [])[1] || '안내'; const season = (SEASON_KW.find(([k]) => id.includes(k)) || [])[1] || '사계절'; const age = (AGE_KW.find(([k]) => id.includes(k)) || [])[1] || '전체';
    t.tags = { format: FORMATS[t.cat] || '포스터', season, age, occasion: occ, biz: '태권도장' };
    t.kw = [t.name, t.tags.format, season, age, occ, '태권도장'].join(' ');
  });
  NC.tpl.cats = [['all', '전체'], ['calendar', '달력 테마'], ['calpage', '달력 낱장'], ['poster', '포스터'], ['flyer', '전단지'], ['leaflet', '리플렛'], ['sns', 'SNS'], ['season', '명절·행사'], ['cert', '상장·증서'], ['card', '명함·카드'], ['sticker', '쿠폰·명찰·스티커'], ['sheet', '서식·활동지'], ['notice', '안내문'], ['banner', '현수막·입간판'], ['web', '웹·영상']];
  NC.tpl.seasonNow = () => { const m = new Date().getMonth() + 1; return m >= 3 && m <= 5 ? '봄' : m >= 6 && m <= 8 ? '여름' : m >= 9 && m <= 11 ? '가을' : '겨울'; };
})();
