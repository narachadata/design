// 템플릿 7: 프레젠테이션(PPT) 16:9 세트 (팀장님 11/23 「PPT 템플릿이 전혀 없네」)
// 캔바·미리캔버스 관행: 같은 색·글꼴로 묶인 여러 쪽 세트 — 표지·차례·구역·글+그림·두 칸·큰 숫자·일정·말씀·그림 모음·마무리
// 크기 1920×1080(508×285.75mm). 글자는 발표 화면에서 읽히게 제목 44~66pt · 본문 22~28pt. 전화·주소 자리는 도장 정보로 저절로 채워짐
(function () {
  const L = NC.tpl.list, W = 508, H = 285.75;
  const PHONE = '010-0000-0000', ADDR = '○○시 ○○구 ○○로 00, 2층';
  const H_ = (uid) => ({
    T: (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: 'Pretendard', size: 32, weight: 400, italic: false, color: '#1a1a1a', align: 'left', lh: 1.35, ls: 0, strokeW: 0, strokeC: '#ffffff', shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, st),
    I: (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '그림 (눌러서 바꾸기)' }, st),
    S: (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: '#FFE89A', stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st),
    P: (bg, els, label) => ({ id: uid(), bg, els, label }),
  });
  const A = { logo: 'asset:logo-wordmark', group: 'asset:cover-group', m1: 'asset:mascot-01', m3: 'asset:mascot-03', m4: 'asset:mascot-04', m5: 'asset:mascot-05', m7: 'asset:mascot-07', m8: 'asset:mascot-08', m9: 'asset:mascot-09', m11: 'asset:mascot-11', pride: 'asset:illu-01-pride', respect: 'asset:illu-05-respect', friends: 'asset:illu-03-consideration', resp: 'asset:illu-04-responsibility', coop: 'asset:illu-12-cooperation', honesty: 'asset:illu-10-honesty' };
  /* 테마: cbg 표지·구역 바탕 / ctx 그 글자 / bbg 본문 바탕 / btx 본문 글자 / ac 강조 / onAc 강조 위 글자 / card 카드 / sub 보조 글자 */
  const TH = {
    navy: { cbg: '#1E2B5A', ctx: '#FFFFFF', bbg: '#FFFFFF', btx: '#1E2B5A', ac: '#FFC83D', onAc: '#1E2B5A', card: '#EEF2FA', sub: '#5B6478', fontT: 'Black Han Sans', fontQ: 'Gowun Batang' },
    red: { cbg: '#FFFFFF', ctx: '#1a1a1a', bbg: '#FFFFFF', btx: '#1a1a1a', ac: '#E0564B', onAc: '#FFFFFF', card: '#F6F6F8', sub: '#666C78', fontT: 'Do Hyeon', fontQ: 'Nanum Myeongjo' },
    green: { cbg: '#2F5D3A', ctx: '#FFFFFF', bbg: '#F7F4EC', btx: '#24402C', ac: '#E9A23B', onAc: '#FFFFFF', card: '#FFFFFF', sub: '#5E6B5F', fontT: 'Jua', fontQ: 'Gowun Batang' },
    gold: { cbg: '#141414', ctx: '#F5E7B8', bbg: '#1C1C1C', btx: '#F3EEDF', ac: '#C9A227', onAc: '#141414', card: '#262626', sub: '#B8AF98', fontT: 'Nanum Myeongjo', fontQ: 'Nanum Myeongjo' },
    pastel: { cbg: '#FFE9D6', ctx: '#3B2F4A', bbg: '#FFF8F0', btx: '#3B2F4A', ac: '#4A7BD0', onAc: '#FFFFFF', card: '#FFFFFF', sub: '#7A6E86', fontT: 'Jua', fontQ: 'Gowun Batang' },
  };
  /* 쪽 종류 — c = 내용, t = 테마 */
  const SLIDES = {
    cover: (h, t, c) => h.P(t.cbg, [
      h.S('ellipse', 300, -70, 280, 280, { fill: t.ac, opacity: 0.16, name: '꾸밈 원' }), h.S('rect', 0, H - 12, W, 12, { fill: t.ac, name: '아래 띠' }),
      h.S('rect', 34, 78, 46, 4, { fill: t.ac, name: '꾸밈 선' }),
      h.T(c.title, 34, 90, 300, 74, { font: t.fontT, size: 70, color: t.ctx, lh: 1.15, name: '제목' }),
      h.T(c.sub || '', 34, 172, 300, 22, { size: 34, color: t.ctx, opacity: 0.85, name: '부제목' }),
      h.T(c.meta || '', 34, 226, 300, 14, { size: 24, weight: 700, color: t.ac, name: '날짜·발표자' }),
      h.I(c.img || A.m3, 330, 40, 150, 200, {}),
    ], '표지'),
    agenda: (h, t, c) => h.P(t.bbg, [
      h.T(c.title || '오늘의 순서', 34, 26, 300, 26, { font: t.fontT, size: 60, color: t.btx, name: '제목' }), h.S('rect', 34, 58, 40, 3, { fill: t.ac, name: '꾸밈 선' }),
      ...(c.items || []).slice(0, 5).flatMap((it, i) => [h.S('ellipse', 34, 82 + i * 34, 20, 20, { fill: t.ac, name: `번호 ${i + 1}` }), h.T(String(i + 1), 34, 85 + i * 34, 20, 14, { size: 30, weight: 800, color: t.onAc, align: 'center', name: `번호 글 ${i + 1}` }), h.T(it, 64, 84 + i * 34, 250, 18, { size: 34, color: t.btx, name: `순서 ${i + 1}` })]),
      h.S('rect', 330, 60, 150, 190, { fill: t.card, radius: 12, name: '그림 바탕' }), h.I(c.img || A.m5, 340, 70, 130, 170, {}),
    ], '차례'),
    section: (h, t, c) => h.P(t.cbg, [
      h.S('rect', 0, 0, 14, H, { fill: t.ac, name: '왼쪽 띠' }),
      h.T(c.no || '01', 40, 58, 200, 80, { font: t.fontT, size: 150, color: t.ac, name: '구역 번호' }),
      h.T(c.title, 40, 160, 420, 40, { font: t.fontT, size: 70, color: t.ctx, name: '구역 제목' }),
      h.T(c.sub || '', 40, 210, 420, 20, { size: 32, color: t.ctx, opacity: 0.8, name: '설명' }),
    ], '구역 나눔'),
    content: (h, t, c) => h.P(t.bbg, [
      h.T(c.title, 34, 26, 440, 26, { font: t.fontT, size: 60, color: t.btx, name: '제목' }), h.S('rect', 34, 58, 40, 3, { fill: t.ac, name: '꾸밈 선' }),
      h.T((c.bullets || []).map(b => '• ' + b).join('\n'), 34, 76, 250, 180, { size: 34, lh: 1.7, color: t.btx, name: '본문' }),
      h.S('rect', 300, 70, 176, 180, { fill: t.card, radius: 12, name: '그림 바탕' }), h.I(c.img || A.m4, 310, 80, 156, 160, {}),
    ], '글 + 그림'),
    twocol: (h, t, c) => h.P(t.bbg, [
      h.T(c.title, 34, 26, 440, 26, { font: t.fontT, size: 60, color: t.btx, name: '제목' }), h.S('rect', 34, 58, 40, 3, { fill: t.ac, name: '꾸밈 선' }),
      ...[c.left, c.right].flatMap((k, i) => { const x = 34 + i * 226; return [h.S('rect', x, 78, 214, 176, { fill: t.card, radius: 12, name: i ? '오른쪽 칸' : '왼쪽 칸' }), h.S('rect', x, 78, 214, 6, { fill: t.ac, name: '칸 윗줄' }), h.T((k || {}).h || '', x + 14, 96, 186, 22, { size: 36, weight: 800, color: t.btx, name: '칸 제목' }), h.T((k || {}).t || '', x + 14, 128, 186, 116, { size: 30, lh: 1.6, color: t.btx, name: '칸 글' })]; }),
    ], '두 칸 비교'),
    numbers: (h, t, c) => h.P(t.bbg, [
      h.T(c.title, 34, 26, 440, 26, { font: t.fontT, size: 60, color: t.btx, name: '제목' }), h.S('rect', 34, 58, 40, 3, { fill: t.ac, name: '꾸밈 선' }),
      ...(c.items || []).slice(0, 3).flatMap((it, i) => { const x = 34 + i * 150; return [h.S('rect', x, 88, 138, 150, { fill: t.card, radius: 12, name: `숫자 칸 ${i + 1}` }), h.T(it.n, x, 108, 138, 50, { font: t.fontT, size: 100, color: t.ac, align: 'center', name: `숫자 ${i + 1}` }), h.T(it.label, x + 8, 178, 122, 40, { size: 30, color: t.btx, align: 'center', lh: 1.45, name: `숫자 설명 ${i + 1}` })]; }),
    ], '큰 숫자'),
    timeline: (h, t, c) => { const it = (c.items || []).slice(0, 5), n = Math.max(1, it.length), gap = 440 / n; return h.P(t.bbg, [
      h.T(c.title, 34, 26, 440, 26, { font: t.fontT, size: 60, color: t.btx, name: '제목' }), h.S('rect', 34, 58, 40, 3, { fill: t.ac, name: '꾸밈 선' }),
      h.S('rect', 34, 150, 440, 3, { fill: t.sub, opacity: 0.5, name: '일정 선' }),
      ...it.flatMap((x, i) => { const cx = 34 + gap * i + gap / 2; return [h.S('ellipse', cx - 8, 143, 16, 16, { fill: t.ac, name: `일정 점 ${i + 1}` }), h.T(x.when, cx - gap / 2, 112, gap, 20, { size: 34, weight: 800, color: t.ac, align: 'center', name: `때 ${i + 1}` }), h.T(x.what, cx - gap / 2 + 4, 172, gap - 8, 60, { size: 30, color: t.btx, align: 'center', lh: 1.45, name: `할 일 ${i + 1}` })]; }),
    ], '일정'); },
    quote: (h, t, c) => h.P(t.card === '#FFFFFF' ? t.bbg : t.card, [
      h.T('“', 40, 28, 80, 80, { font: t.fontQ, size: 190, color: t.ac, name: '따옴표' }),
      h.T(c.text, 80, 92, 360, 100, { font: t.fontQ, size: 48, lh: 1.5, color: t.btx, name: '말씀' }),
      h.T(c.by ? '— ' + c.by : '', 80, 210, 360, 16, { size: 30, color: t.sub, align: 'right', name: '말한 사람' }),
    ], '말씀·인용'),
    gallery: (h, t, c) => h.P(t.bbg, [
      h.T(c.title, 34, 26, 440, 26, { font: t.fontT, size: 60, color: t.btx, name: '제목' }), h.S('rect', 34, 58, 40, 3, { fill: t.ac, name: '꾸밈 선' }),
      ...(c.pics || []).slice(0, 3).flatMap((p, i) => { const x = 34 + i * 150; return [h.S('rect', x, 78, 138, 140, { fill: t.card, radius: 12, name: `사진 칸 ${i + 1}` }), h.I(p.img, x + 8, 86, 122, 124, {}), h.T(p.cap || '', x, 224, 138, 16, { size: 30, color: t.btx, align: 'center', name: `사진 설명 ${i + 1}` })]; }),
    ], '사진 모음'),
    closing: (h, t, c) => h.P(t.cbg, [
      h.S('ellipse', -80, 160, 260, 260, { fill: t.ac, opacity: 0.16, name: '꾸밈 원' }), h.S('rect', 0, 0, W, 10, { fill: t.ac, name: '위 띠' }),
      h.T(c.title || '감사합니다', 0, 92, W, 60, { font: t.fontT, size: 100, color: t.ctx, align: 'center', name: '마무리 글' }),
      h.T(c.sub || '', 0, 160, W, 22, { size: 34, color: t.ctx, align: 'center', opacity: 0.85, name: '부제목' }),
      h.T(`나라차태권도  ·  ${ADDR}  ·  ${PHONE}`, 0, 236, W, 14, { size: 24, color: t.ctx, align: 'center', opacity: 0.75, name: '연락처' }),
    ], '마무리'),
  };
  const deck = (t, list) => uid => { const h = H_(uid); return list.map(([k, c]) => SLIDES[k](h, t, c)); };
  /* 도장에서 자주 쓰는 발표 다섯 가지 */
  const DECKS = [
    { id: 'pres-program', theme: 'navy', name: '수련 프로그램 설명회 · 네이비', tags: { format: '프레젠테이션', season: '사계절', age: '학부모', occasion: '교육', biz: '태권도장' }, slides: [
      ['cover', { title: '2027 수련 프로그램\n설명회', sub: '몸과 마음이 함께 자라는 한 해', meta: '2027. 3. · 나라차태권도', img: A.m3 }],
      ['agenda', { items: ['도장 소개', '나이별 수련 과정', '한 해 일정', '승급과 심사', '함께 지킬 약속'], img: A.m5 }],
      ['section', { no: '01', title: '도장 소개', sub: '예의·끈기·배려를 배우는 곳' }],
      ['content', { title: '우리 도장이 소중히 여기는 것', bullets: ['예의로 시작해서 예의로 끝나는 수업', '나이에 맞춘 단계별 수련', '인성 덕목을 매달 하나씩', '안전을 가장 먼저'], img: A.respect }],
      ['twocol', { title: '나이별 수련 과정', left: { h: '유아·저학년', t: '놀이로 익히는 기본 동작\n균형·협응 놀이\n짧고 즐거운 수업' }, right: { h: '고학년·청소년', t: '품새·겨루기 기술 수련\n체력 향상 프로그램\n심사·대회 준비' } }],
      ['numbers', { title: '숫자로 보는 나라차', items: [{ n: '15년', label: '함께한 시간' }, { n: '120명', label: '지금 수련생' }, { n: '98%', label: '다시 오고 싶다는 아이들' }] }],
      ['timeline', { title: '한 해 일정', items: [{ when: '3월', what: '새 학기 시작' }, { when: '5월', what: '가족 한마당' }, { when: '8월', what: '여름 캠프' }, { when: '11월', what: '승급심사' }, { when: '12월', what: '발표회' }] }],
      ['quote', { text: '태권도는 이기는 법보다\n지지 않는 마음을 가르칩니다.', by: '나라차태권도 관장' }],
      ['gallery', { title: '수업 모습', pics: [{ img: A.m7, cap: '기본 동작' }, { img: A.m8, cap: '품새' }, { img: A.m9, cap: '겨루기' }] }],
      ['closing', { title: '감사합니다', sub: '궁금한 점은 언제든 물어봐 주세요' }],
    ] },
    { id: 'pres-test', theme: 'red', name: '승급심사 안내 · 화이트 레드', tags: { format: '프레젠테이션', season: '사계절', age: '학부모', occasion: '심사·대회', biz: '태권도장' }, slides: [
      ['cover', { title: '승급심사 안내', sub: '한 단계 더 자라는 날', meta: '2027년 ○월 ○일 · 나라차태권도', img: A.m9 }],
      ['agenda', { items: ['심사 일정', '띠별 심사 내용', '준비물', '당일 순서', '부모님께 부탁'], img: A.m1 }],
      ['content', { title: '심사 일정', bullets: ['날짜: ○월 ○일 토요일', '장소: 나라차태권도 본관', '시간: 띠별로 나눠 진행', '결과: 심사 다음 주 발표'], img: A.m4 }],
      ['twocol', { title: '띠별 심사 내용', left: { h: '유급자', t: '기본 동작\n해당 품새\n발차기 시범' }, right: { h: '유단자 준비', t: '품새 두 가지\n겨루기 기본\n격파 시범' } }],
      ['numbers', { title: '준비물', items: [{ n: '🥋', label: '깨끗한 도복' }, { n: '🎗', label: '지금 띠' }, { n: '💧', label: '물병' }] }],
      ['timeline', { title: '당일 순서', items: [{ when: '9:30', what: '모이기·준비 운동' }, { when: '10:00', what: '기본 동작' }, { when: '10:40', what: '품새' }, { when: '11:20', what: '발차기·격파' }] }],
      ['quote', { text: '틀려도 괜찮아요.\n끝까지 해내는 것이 실력입니다.', by: '사범님' }],
      ['closing', { title: '모두 화이팅!', sub: '아이들의 도전을 함께 응원해 주세요' }],
    ] },
    { id: 'pres-camp', theme: 'green', name: '여름 태권도 캠프 · 그린', tags: { format: '프레젠테이션', season: '여름', age: '초등', occasion: '캠프·특강', biz: '태권도장' }, slides: [
      ['cover', { title: '여름 태권도 캠프', sub: '자연 속에서 키우는 용기와 우정', meta: '2027. 8. · 1박 2일', img: A.m7 }],
      ['agenda', { items: ['캠프 소개', '일정표', '준비물', '안전 약속', '신청 방법'], img: A.friends }],
      ['section', { no: '01', title: '캠프 소개', sub: '함께 땀 흘리고, 함께 웃는 이틀' }],
      ['content', { title: '이런 활동을 해요', bullets: ['계곡 물놀이와 레크리에이션', '야외 품새 수련', '캠프파이어와 장기 자랑', '친구와 함께하는 협동 놀이'], img: A.coop }],
      ['timeline', { title: '일정표', items: [{ when: '첫날 오전', what: '출발·도착' }, { when: '첫날 오후', what: '물놀이·수련' }, { when: '첫날 밤', what: '캠프파이어' }, { when: '둘째 날', what: '마무리·귀가' }] }],
      ['twocol', { title: '준비물과 안전', left: { h: '준비물', t: '갈아입을 옷 2벌\n수건·세면도구\n모자·물병' }, right: { h: '안전 약속', t: '혼자 다니지 않기\n물가에서는 사범님 곁\n아프면 바로 말하기' } }],
      ['gallery', { title: '작년 캠프', pics: [{ img: A.m5, cap: '물놀이' }, { img: A.m8, cap: '야외 수련' }, { img: A.m11, cap: '캠프파이어' }] }],
      ['closing', { title: '함께 떠나요!', sub: '신청은 도장 안내데스크나 전화로' }],
    ] },
    { id: 'pres-award', theme: 'gold', name: '연말 시상식·발표회 · 블랙 골드', tags: { format: '프레젠테이션', season: '겨울', age: '전체', occasion: '축하', biz: '태권도장' }, slides: [
      ['cover', { title: '2027 나라차\n시상식', sub: '한 해 동안 땀 흘린 모두에게', meta: '2027. 12. · 나라차태권도', img: A.pride }],
      ['agenda', { items: ['여는 말', '한 해 돌아보기', '시상', '시범 공연', '닫는 말'], img: A.m3 }],
      ['numbers', { title: '한 해 돌아보기', items: [{ n: '42명', label: '새로 승급한 수련생' }, { n: '12회', label: '함께한 행사' }, { n: '8개', label: '대회 메달' }] }],
      ['section', { no: '★', title: '시상', sub: '끝까지 해낸 이름들을 부릅니다' }],
      ['twocol', { title: '올해의 상', left: { h: '성실상', t: '하루도 빠지지 않은 수련생\n○○○ · ○○○' }, right: { h: '향상상', t: '가장 크게 자란 수련생\n○○○ · ○○○' } }],
      ['quote', { text: '오늘의 메달보다\n내일의 나를 더 기대합니다.', by: '나라차태권도 관장' }],
      ['gallery', { title: '시범 공연', pics: [{ img: A.m8, cap: '품새 시범' }, { img: A.m9, cap: '격파' }, { img: A.m11, cap: '단체 시범' }] }],
      ['closing', { title: '수고했습니다', sub: '새해에도 함께 힘차게!' }],
    ] },
    { id: 'pres-parents', theme: 'pastel', name: '신입 학부모 오리엔테이션 · 파스텔', tags: { format: '프레젠테이션', season: '사계절', age: '학부모', occasion: '안내', biz: '태권도장' }, slides: [
      ['cover', { title: '처음 오신\n부모님께', sub: '나라차태권도 첫 안내', meta: '신입 오리엔테이션', img: A.m1 }],
      ['agenda', { items: ['수업 시간표', '차량 운행', '준비물', '알림 받는 법', '자주 묻는 질문'], img: A.m5 }],
      ['content', { title: '수업 시간표', bullets: ['유아부: 오후 2시·3시', '초등부: 오후 4시·5시', '중고등부: 저녁 7시', '토요일: 특별 수업 (격주)'], img: A.m4 }],
      ['twocol', { title: '차량과 준비물', left: { h: '🚐 차량 운행', t: '정해진 정류장·시간\n늦어지면 문자 안내\n차량 안 안전띠 꼭' }, right: { h: '🎒 준비물', t: '도복·띠\n물병\n이름을 쓴 실내화' } }],
      ['numbers', { title: '알림은 이렇게', items: [{ n: '📱', label: '밴드에 공지' }, { n: '✉️', label: '월 소식지' }, { n: '☎️', label: '급한 일은 전화' }] }],
      ['quote', { text: '아이의 작은 성장도\n함께 기뻐하는 도장이 되겠습니다.', by: '나라차태권도' }],
      ['closing', { title: '환영합니다', sub: '궁금한 점은 언제든 편하게 물어봐 주세요' }],
    ] },
  ];
  DECKS.forEach(dk => L.push({ id: dk.id, cat: 'pres', name: dk.name, w: W, h: H, tags: dk.tags, screen: true, kw: `프레젠테이션 PPT 발표 슬라이드 피피티 ${dk.name} ${dk.slides.map(s => s[1].title || '').join(' ')}`, build: (uid) => deck(TH[dk.theme], dk.slides)(uid) }));
  /* 쪽 하나씩 넣는 「쪽 종류」 템플릿 (지금 발표자료에 같은 테마 쪽 더하기) — 테마마다 10가지 */
  const SAMPLE = { cover: { title: '발표 제목', sub: '부제목을 쓰세요', meta: '날짜 · 발표자' }, agenda: { items: ['첫째 순서', '둘째 순서', '셋째 순서', '넷째 순서'] }, section: { no: '01', title: '구역 제목', sub: '이 구역에서 다룰 내용' }, content: { title: '쪽 제목', bullets: ['첫째 내용', '둘째 내용', '셋째 내용'] }, twocol: { title: '두 가지 비교', left: { h: '왼쪽', t: '내용을 쓰세요' }, right: { h: '오른쪽', t: '내용을 쓰세요' } }, numbers: { title: '숫자로 보기', items: [{ n: '100', label: '설명' }, { n: '20', label: '설명' }, { n: '3', label: '설명' }] }, timeline: { title: '일정', items: [{ when: '1단계', what: '할 일' }, { when: '2단계', what: '할 일' }, { when: '3단계', what: '할 일' }, { when: '4단계', what: '할 일' }] }, quote: { text: '마음에 남는 한 문장을\n여기에 쓰세요.', by: '말한 사람' }, gallery: { title: '사진 모음', pics: [{ img: A.m7, cap: '설명' }, { img: A.m8, cap: '설명' }, { img: A.m9, cap: '설명' }] }, closing: { title: '감사합니다', sub: '' } };
  const KNAME = { cover: '표지', agenda: '차례', section: '구역 나눔', content: '글 + 그림', twocol: '두 칸 비교', numbers: '큰 숫자', timeline: '일정·과정', quote: '말씀·인용', gallery: '사진 모음', closing: '마무리' };
  const TNAME = { navy: '네이비', red: '화이트 레드', green: '그린', gold: '블랙 골드', pastel: '파스텔' };
  Object.keys(TH).forEach(th => Object.keys(SLIDES).forEach(k => L.push({ id: `pres1-${th}-${k}`, cat: 'pres', name: `발표 쪽 · ${KNAME[k]} · ${TNAME[th]}`, w: W, h: H, screen: true, one: true, tags: { format: '프레젠테이션', season: '사계절', age: '전체', occasion: '안내', biz: '태권도장' }, kw: `프레젠테이션 PPT 발표 슬라이드 쪽 ${KNAME[k]} ${TNAME[th]}`, build: (uid) => [SLIDES[k](H_(uid), TH[th], SAMPLE[k])] })));
  NC.tpl.presThemes = TH; NC.tpl.presSlides = SLIDES; NC.tpl.presH = H_; NC.tpl.presKinds = KNAME; NC.tpl.presThemeNames = TNAME; /* AI 발표자료 만들기가 같은 쪽 모양을 씀 */
  if (Array.isArray(NC.tpl.cats) && !NC.tpl.cats.some(c => c[0] === 'pres')) NC.tpl.cats.splice(1, 0, ['pres', '📊 프레젠테이션']);
  if (NC.tpl.facets && !NC.tpl.facets.format.includes('프레젠테이션')) NC.tpl.facets.format.push('프레젠테이션');
})();
