// 템플릿 6: 라차 장면 그림 템플릿 (팀장님 11/21 — 제미나이로 만든 행사 6장·스포츠 15장을 "달력 및 다양한 템플릿"에)
// 그림: assets/virtue/ra-ev-*.webp (승급 축하·모집·생일·방학 캠프·대회·출석 칭찬), assets/sports/sp-*.webp (달마다 운동 12 + 피구·컬링·아이스링크)
// 모든 그림은 모서리 r64·왼쪽 가슴 나라차 로고·유급자 깃(바깥 빨강·안쪽 검정)·태권도 V깃으로 손질해 둠
(function () {
  const L = NC.tpl.list;
  const INK = '#1E2B5A', WHITE = '#ffffff', PHONE = '010-0000-0000';
  const H = (uid) => ({
    T: (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: 'Noto Sans KR', size: 12, weight: 400, italic: false, color: INK, align: 'center', lh: 1.35, ls: 0, strokeW: 0, strokeC: WHITE, shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, st),
    I: (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }, st),
    S: (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: '#FFE89A', stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st),
    P: (bg, els, label) => ({ id: uid(), bg, els, label }),
  });
  const logo = bg => (NC.logoFor ? NC.logoFor('brand-horizontal', bg) : 'asset:brand-horizontal');
  const EV = k => `assets/virtue/ra-ev-${k}.webp`, SP = k => `assets/sports/${k}.webp`;
  const add = (o) => L.push(Object.assign({ tags: { format: 'SNS', season: '사계절', age: '전체', occasion: '행사', biz: '태권도장' } }, o, { kw: [o.name, '라차 펭귄 마스코트 그림 장면', o.kw || ''].join(' ') }));

  /* ① 행사 SNS 카드 (1:1 · 1080×1080) — 위 제목, 가운데 큰 라차 장면, 아래 안내 한 줄과 로고 */
  const W = 285.75;
  const SNS = [
    ['congrats', '승급 축하', '#FFF4D6', '#C8323C', 'CONGRATULATIONS', '승급을 축하합니다!', '2027년 ○월 승급심사 합격 ○○○ 외 ○명\n새 띠와 함께 더 멋지게 자라요', '축하', '승급 심사 합격 띠 축하'],
    ['recruit', '수련생 모집', '#E8F1FB', '#1E3A8A', 'NEW MEMBERS WELCOME', '신규 수련생 모집', `무료 체험 1회 · 6세~성인\n문의 ${PHONE}`, '모집', '모집 체험 입관 환영 신규'],
    ['birthday', '생일 축하', '#FDEDF2', '#C2456E', 'HAPPY BIRTHDAY', '생일 축하해요!', '○○○ 수련생의 생일을\n나라차 가족 모두 축하합니다', '축하', '생일 케이크 축하'],
    ['camp', '방학 캠프', '#EEF7E4', '#3F7A2A', 'SUMMER CAMP', '여름방학 특별 캠프', '7월 ○일 ~ ○일 · 초등 1~6학년\n선착순 ○명 · 문의 ' + PHONE, '캠프·특강', '방학 캠프 특강 소풍 숲'],
    ['contest', '대회 입상', '#EEF0FB', '#3B3FA8', 'CHAMPIONS', '대회 입상 축하!', '제○회 ○○ 품새대회\n금 ○ · 은 ○ · 동 ○ — 모두 자랑스러워요', '심사·대회', '대회 메달 시상 입상 품새'],
    ['attend', '출석 칭찬', '#FFF6DA', '#B7831A', 'PERFECT ATTENDANCE', '이달의 출석왕', '한 번도 빠지지 않은\n○○○ · ○○○ 칭찬해요!', '축하', '출석 개근 칭찬 별 스티커'],
  ];
  SNS.forEach(([k, nm, bg, ac, eb, title, body, occ, kw]) => add({
    id: `ra-sns-${k}`, cat: 'sns', name: `라차 ${nm} SNS 카드`, w: W, h: W, screen: true,
    tags: { format: 'SNS', season: k === 'camp' ? '여름' : '사계절', age: '전체', occasion: occ, biz: '태권도장' }, kw,
    build(uid) { const { T, I, S, P } = H(uid); return [P(bg, [
      S('ellipse', -50, -50, 150, 150, { fill: ac, opacity: 0.08, name: '장식 원' }), S('ellipse', W - 90, W - 110, 170, 170, { fill: ac, opacity: 0.08, name: '장식 원 2' }),
      T(eb, 20, 20, W - 40, 9, { font: 'Montserrat', size: 13, weight: 800, color: ac, ls: 0.28, name: '영문' }),
      T(title, 16, 32, W - 32, 26, { font: 'Jua', size: 56, color: INK, lh: 1.05, name: '제목' }),
      I(EV(k), (W - 158) / 2, 64, 158, 158, { name: '라차 그림' }),
      T(body, 20, 228, W - 40, 26, { size: 16.5, weight: 600, lh: 1.5, color: '#333', name: '내용' }),
      I(logo(bg), (W - 92) / 2, 260, 92, 16, { name: '로고' }),
    ], `라차 ${nm}`)]; } }));

  /* ② A4 포스터 — 색 띠 제목 + 큰 라차 장면 + 흰 안내 상자 (행사 3 + 스포츠 4) */
  const POS = [
    ['recruit', EV('recruit'), '수련생 모집', '#1E3A8A', '#FFD23F', 'NARACHA TAEKWONDO', '2027 신규 수련생 모집', '바른 인성과 건강한 몸, 태권도로 시작하세요', `수련 대상   6세 ~ 성인\n수련 시간   평일 14:00 ~ 21:00 (반별 운영)\n체험 수업   무료 체험 1회\n문의 전화   ${PHONE}`, '모집', '봄', '모집 체험 입관'],
    ['camp', EV('camp'), '방학 캠프', '#3F7A2A', '#FFE27A', 'SUMMER CAMP', '여름방학 특별 캠프', '숲 소풍 · 줄넘기 · 품새 · 캠프파이어', `기간   2027. 7. 26(월) ~ 7. 30(금), 5일\n대상   초등 1~6학년 (선착순 30명)\n참가비   000,000원 (식비·보험 포함)\n신청   도장 사무실 또는 ${PHONE}`, '캠프·특강', '여름', '방학 캠프 특강 여름'],
    ['contest', EV('contest'), '품새대회 안내', '#3B3FA8', '#FFD23F', 'TAEKWONDO CHAMPIONSHIP', '제5회 나라차배 품새대회', '그동안 갈고닦은 실력을 보여 주세요!', '일시   2027년 5월 15일(토) 오전 10시\n장소   ○○체육관 다목적실\n종목   개인 품새 · 단체 품새 · 격파\n시상   금·은·동 메달, 참가상', '심사·대회', '봄', '대회 메달 시상 품새 시합'],
    ['sportsday', SP('sp-09-run'), '운동회', '#C8323C', '#FFE27A', 'SPORTS DAY', '나라차 가족 운동회', '이어달리기 · 피구 · 줄다리기 · 가족 응원전', '일시   2027년 9월 ○일(토) 오전 10시\n장소   ○○초등학교 운동장\n준비   도복 · 운동화 · 물병\n문의   ' + PHONE, '행사', '가을', '운동회 체육대회 이어달리기 달리기 가족'],
    ['winter', SP('sp-01-ski'), '겨울 스포츠 캠프', '#2D5DA8', '#BFE3FF', 'WINTER CAMP', '겨울방학 스키 캠프', '스키 · 눈썰매 · 스케이트를 한 번에!', '기간   2027. 1. ○ ~ 1. ○ (1박 2일)\n장소   ○○ 스키장\n대상   초등 1~6학년 (선착순 ○명)\n신청   ' + PHONE, '캠프·특강', '겨울', '스키 눈썰매 스케이트 겨울 캠프 방학'],
    ['water', SP('sp-07-swim'), '여름 물놀이', '#1D7FB5', '#FFE27A', 'SUMMER SPLASH', '신나는 여름 물놀이 데이', '수영 · 물총 놀이 · 수박 파티', '일시   2027년 8월 ○일(토)\n장소   ○○ 야외 수영장\n준비   수영복 · 수건 · 갈아입을 옷\n문의   ' + PHONE, '행사', '여름', '수영 물놀이 여름 서핑 바다'],
    ['dodgeball', SP('sp-dodgeball'), '피구 대회', '#D0602A', '#FFF1A8', 'DODGEBALL GAME', '나라차 피구 대회', '반 대항 · 가족 대항 · 사범님 팀과 한판!', '일시   2027년 ○월 ○일(토) 오후 2시\n장소   나라차태권도 본관 수련장\n참가   전 수련생 (반별 팀 구성)\n시상   우승 · 준우승 · 매너상', '행사', '사계절', '피구 공 실내 체육 대회 놀이'],
  ];
  POS.forEach(([k, img, nm, ac, hi, eb, title, sub, info, occ, season, kw]) => add({
    id: `ra-poster-${k}`, cat: 'poster', name: `라차 ${nm} 포스터`, w: 210, h: 297,
    tags: { format: '포스터', season, age: '전체', occasion: occ, biz: '태권도장' }, kw,
    build(uid) { const { T, I, S, P } = H(uid); return [P('#FFFDF7', [
      S('rect', 0, 0, 210, 92, { fill: ac, name: '제목 띠' }),
      T(eb, 14, 14, 182, 8, { font: 'Montserrat', size: 11, weight: 800, color: hi, ls: 0.3, name: '영문' }),
      T(title, 10, 26, 190, 30, { font: 'Black Han Sans', size: 46, color: WHITE, lh: 1.1, name: '제목' }),
      T(sub, 14, 66, 182, 10, { size: 15, weight: 600, color: hi, name: '부제' }),
      S('ellipse', 18, 86, 174, 150, { fill: ac, opacity: 0.07, name: '그림 뒤 원' }),
      I(img, 37, 96, 136, 136, { name: '라차 그림' }),
      S('rect', 18, 238, 174, 40, { fill: WHITE, stroke: ac, strokeW: 0.6, radius: 5, name: '안내 상자' }),
      T(info, 26, 241, 160, 34, { size: 12, lh: 1.6, weight: 500, align: 'left', name: '안내 내용' }),
      I(logo('#FFFDF7'), 70, 283, 70, 10, { name: '로고' }),
    ], `라차 ${nm}`)]; } }));

  /* ③ 생일 축하 카드 (148×105) — 왼쪽 라차 케이크 그림 */
  add({ id: 'ra-card-birthday', cat: 'card', name: '라차 생일 축하 카드', w: 148, h: 105,
    tags: { format: '명함·카드', season: '사계절', age: '초등', occasion: '축하', biz: '태권도장' }, kw: '생일 케이크 축하 카드',
    build(uid) { const { T, I, S, P } = H(uid); return [P('#FDEDF2', [
      I(EV('birthday'), 8, 12, 70, 70, { name: '라차 그림' }),
      T('HAPPY BIRTHDAY', 82, 16, 60, 6, { font: 'Montserrat', size: 8.5, weight: 800, color: '#C2456E', ls: 0.2, align: 'left' }),
      T('○○○ 수련생,\n생일 축하해요!', 82, 25, 62, 26, { font: 'Gaegu', size: 22, weight: 700, color: INK, lh: 1.15, align: 'left', name: '제목' }),
      T('오늘처럼 힘찬 기합으로\n멋지게 자라길 응원합니다.', 82, 55, 62, 16, { size: 9.5, lh: 1.5, color: '#444', align: 'left', name: '내용' }),
      T('나라차태권도 사범 일동', 82, 76, 62, 6, { size: 8.5, weight: 600, color: INK, align: 'left' }),
      I(logo('#FDEDF2'), 8, 89, 50, 8, { pos: '0% 50%', name: '로고' }),
    ], '라차 생일 카드')]; } });

  /* ④ 이달의 라차 스포츠 SNS (4:5 · 12쪽) — 1월 스키 … 12월 눈썰매 (NARACAL_SPORTS_ART·NARACAL_SPORTS) */
  const PAL = [['#E8F1FB', '#2D5DA8'], ['#EEF0FB', '#4A4FB0'], ['#FDEDF2', '#C2456E'], ['#EEF7E4', '#4D8A2E'], ['#FFF1E6', '#D0602A'], ['#E6F6F4', '#1F8A7A'],
    ['#E4F4FC', '#1D7FB5'], ['#FFF6DA', '#B7831A'], ['#FBF0E3', '#B4652A'], ['#FCEBDD', '#C2551F'], ['#F2ECE4', '#7A5638'], ['#FBE9EA', '#B8333C']];
  add({ id: 'ra-sns-sports12', cat: 'sns', name: '이달의 라차 스포츠 SNS (12쪽)', w: 285.75, h: 357.19, screen: true,
    tags: { format: 'SNS', season: '사계절', age: '전체', occasion: '행사', biz: '태권도장' }, kw: '스포츠 운동 12달 달마다 스키 스케이트 축구 자전거 야구 배드민턴 수영 서핑 달리기 농구 탁구 눈썰매',
    build(uid) { const { T, I, S, P } = H(uid), Hh = 357.19; return (window.NARACAL_SPORTS || []).map((s, k) => { const m = k + 1, [bg, ac] = PAL[k], art = (window.NARACAL_SPORTS_ART || [])[k] || ''; return P(bg, [
      T(`${m}월의 라차 스포츠`, 20, 20, W - 40, 14, { font: 'Jua', size: 32, color: ac, name: '머리글' }),
      T(s[1], 20, 36, W - 40, 30, { font: 'Black Han Sans', size: 84, color: INK, lh: 1.1, name: '운동' }),
      T(s[2], 20, 70, W - 40, 10, { font: 'Montserrat', size: 22, weight: 800, color: ac, ls: 0.2, name: '영문' }),
      I(art, (W - 220) / 2, 88, 220, 220, { name: '라차 그림' }),
      S('rect', 0, Hh - 34, W, 34, { fill: ac, name: '하단 띠' }),
      T('몸도 마음도 튼튼하게 · 나라차태권도', 20, Hh - 25, 170, 16, { size: 22, weight: 700, color: WHITE, align: 'left', name: '문구' }),
      I(logo(ac), W - 110, Hh - 28, 90, 22, { pos: '100% 50%', name: '로고' }),
    ], `${m}월 ${s[1]}`); }); } });
})();
