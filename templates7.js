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
  const A = { logo: 'asset:logo-wordmark', group: 'asset:cover-group', m1: 'assets/racha/racha-highkick.webp', m3: 'assets/racha/racha-guard.webp', m4: 'assets/racha/racha-guard.webp', m5: 'asset:mascot-05', m7: 'assets/racha/racha-guard.webp', m8: 'assets/racha/racha-guard.webp', m9: 'assets/racha/racha-highkick.webp', m11: 'assets/racha/racha-sidekick.webp', pride: 'asset:illu-01-pride', respect: 'asset:illu-05-respect', friends: 'asset:illu-03-consideration', resp: 'asset:illu-04-responsibility', coop: 'asset:illu-12-cooperation', honesty: 'asset:illu-10-honesty' };
  /* 테마: cbg 표지·구역 바탕 / ctx 그 글자 / bbg 본문 바탕 / btx 본문 글자 / ac 강조 / onAc 강조 위 글자 / card 카드 / sub 보조 글자 */
  const TH = {
    navy: { cbg: '#1E2B5A', ctx: '#FFFFFF', bbg: '#FFFFFF', btx: '#1E2B5A', ac: '#FFC83D', onAc: '#1E2B5A', card: '#EEF2FA', sub: '#5B6478', fontT: 'Black Han Sans', fontQ: 'Gowun Batang' },
    red: { cbg: '#FFFFFF', ctx: '#1a1a1a', bbg: '#FFFFFF', btx: '#1a1a1a', ac: '#E0564B', onAc: '#FFFFFF', card: '#F6F6F8', sub: '#666C78', fontT: 'Do Hyeon', fontQ: 'Nanum Myeongjo' },
    green: { cbg: '#2F5D3A', ctx: '#FFFFFF', bbg: '#F7F4EC', btx: '#24402C', ac: '#E9A23B', onAc: '#FFFFFF', card: '#FFFFFF', sub: '#5E6B5F', fontT: 'Jua', fontQ: 'Gowun Batang' },
    gold: { cbg: '#141414', ctx: '#F5E7B8', bbg: '#1C1C1C', btx: '#F3EEDF', ac: '#C9A227', onAc: '#141414', card: '#262626', sub: '#B8AF98', fontT: 'Nanum Myeongjo', fontQ: 'Nanum Myeongjo' },
    pastel: { cbg: '#FFE9D6', ctx: '#3B2F4A', bbg: '#FFF8F0', btx: '#3B2F4A', ac: '#4A7BD0', onAc: '#FFFFFF', card: '#FFFFFF', sub: '#7A6E86', fontT: 'Jua', fontQ: 'Gowun Batang' },
    /* 11/23 2차 (팀장님 「여러 분위기에 맞는 템플릿」): 색만 바꾸지 않고 제목 꾸밈(head)·바탕 꾸밈(sty)·모서리(rad)까지 분위기마다 다르게 */
    kids: { cbg: '#FFD84D', ctx: '#2B2A4C', bbg: '#FFFDF5', btx: '#2B2A4C', ac: '#FF6B6B', onAc: '#FFFFFF', ac2: '#4DABF7', ac3: '#69DB7C', card: '#EAF6FF', sub: '#6B6A85', fontT: 'Jua', fontQ: 'Jua', head: 'blob', sty: 'kids', rad: 22, strip: ['꾸밈 원'] },
    sport: { cbg: '#111111', ctx: '#FFFFFF', bbg: '#F4F4F4', btx: '#111111', ac: '#E10600', onAc: '#FFFFFF', card: '#FFFFFF', sub: '#5C5C5C', fontT: 'Black Han Sans', fontQ: 'Do Hyeon', head: 'slash', sty: 'sport', rad: 0, strip: ['꾸밈 원', '아래 띠', '위 띠', '왼쪽 띠'] },
    hanji: { cbg: '#EFE6D2', ctx: '#2B2622', bbg: '#F7F1E3', btx: '#2B2622', ac: '#B3322B', onAc: '#FFFFFF', card: '#FFFBF1', sub: '#7A6E5D', fontT: 'Nanum Myeongjo', wT: 700, fontQ: 'Nanum Myeongjo', head: 'seal', sty: 'hanji', rad: 0, strip: ['꾸밈 원', '아래 띠', '위 띠', '왼쪽 띠'] },
    ocean: { cbg: '#0B6BB5', ctx: '#FFFFFF', bbg: '#F2F8FD', btx: '#0B3A63', ac: '#FFC94A', onAc: '#0B3A63', card: '#FFFFFF', sub: '#4F6E8A', fontT: 'Do Hyeon', fontQ: 'Gowun Batang', head: 'band', sty: 'ocean', rad: 14, strip: ['꾸밈 원', '아래 띠'] },
    spring: { cbg: '#FFE3EA', ctx: '#4A2B3A', bbg: '#FFF9FA', btx: '#4A2B3A', ac: '#EE6F94', onAc: '#FFFFFF', ac2: '#8CCB9B', card: '#FDEEF2', sub: '#8A6A78', fontT: 'Jua', fontQ: 'Gowun Batang', head: 'line', sty: 'spring', rad: 16, strip: ['꾸밈 원'] },
    winter: { cbg: '#123B2F', ctx: '#FFFFFF', bbg: '#F6F7F3', btx: '#173B30', ac: '#D64545', onAc: '#FFFFFF', card: '#E9EFEA', sub: '#5D6B65', fontT: 'Black Han Sans', fontQ: 'Nanum Myeongjo', head: 'under', sty: 'winter', rad: 10, strip: ['꾸밈 원'] },
    mono: { cbg: '#F2F2F0', ctx: '#111111', bbg: '#FFFFFF', btx: '#111111', ac: '#2F5BEA', onAc: '#FFFFFF', card: '#F4F5F7', sub: '#6B6F76', fontT: 'Pretendard', wT: 800, fontQ: 'Noto Serif KR', head: 'under', sty: 'mono', rad: 4, strip: ['꾸밈 원', '아래 띠', '위 띠', '왼쪽 띠'] },
    craft: { cbg: '#E8D9C2', ctx: '#4A3A2C', bbg: '#F6F0E6', btx: '#4A3A2C', ac: '#C46A3C', onAc: '#FFFFFF', card: '#FFFBF4', sub: '#86705C', fontT: 'Gaegu', wT: 700, fontQ: 'Gaegu', head: 'tape', sty: 'craft', rad: 8, strip: ['꾸밈 원', '아래 띠', '위 띠'] },
  };
  const R = t => (t.rad != null ? t.rad : 12);
  /* 제목 꾸밈 — 분위기마다 다른 모양 */
  const hd = (h, t, title, w) => { const T = (x, tw, st) => h.T(title || '', x, 26, tw, 26, Object.assign({ font: t.fontT, weight: t.wT || 400, size: 60, color: t.btx, name: '제목' }, st)); w = w || 440;
    switch (t.head) {
      case 'band': return [h.S('rect', 0, 0, W, 62, { fill: t.cbg, name: '제목 띠' }), h.S('rect', 0, 62, W, 3, { fill: t.ac, name: '제목 띠 아래 줄' }), T(34, w, { y: 18, color: t.ctx })];
      case 'slash': return [h.S('rect', 36, 21, 8, 36, { fill: t.ac, rot: 18, name: '꾸밈 빗금' }), h.S('rect', 48, 21, 8, 36, { fill: t.ac, rot: 18, opacity: 0.45, name: '꾸밈 빗금 2' }), T(66, w - 32, { italic: true })];
      case 'seal': return [h.S('rect', 34, 31, 14, 14, { fill: t.ac, name: '낙관 네모' }), T(56, w - 22), h.S('line', 34, 60, 440, 1, { fill: t.sub, stroke: t.sub, strokeW: 0.3, opacity: 0.7, name: '가는 선' })];
      case 'under': return [T(34, w), h.S('line', 34, 60, 440, 1, { fill: t.sub, stroke: t.sub, strokeW: 0.25, opacity: 0.6, name: '가는 선' }), h.S('rect', 34, 58.5, 40, 3, { fill: t.ac, name: '강조 막대' })];
      case 'blob': return [h.S('ellipse', 24, 14, 36, 36, { fill: t.ac2 || t.ac, opacity: 0.35, name: '꾸밈 동그라미' }), T(34, w), h.S('pill', 34, 58, 46, 5, { fill: t.ac, name: '강조 막대' })];
      case 'tape': return [h.S('rect', 26, 22, 74, 17, { fill: t.ac, opacity: 0.28, rot: -4, name: '마스킹 테이프' }), T(34, w)];
      default: return [T(34, w), h.S('rect', 34, 58, 40, 3, { fill: t.ac, name: '꾸밈 선' })];
    } };
  /* 바탕 꾸밈 (맨 뒤에 깔림) — big: 표지·구역·마무리 */
  const PET_BIG = [[30, 30, 18, 30], [72, 12, 12, -20], [410, 22, 20, 50], [452, 62, 13, 10], [380, 236, 16, -30], [446, 212, 22, 70], [120, 252, 12, 20], [252, 14, 10, -40]], PET = [[440, 16, 16, 30], [470, 42, 11, -20], [454, 6, 9, 60], [18, 262, 12, 20]];
  const DECO = {
    kids: (h, t, big) => big ? [h.S('ellipse', -50, -60, 170, 170, { fill: t.ac2, opacity: 0.45, name: '꾸밈 원 1' }), h.S('ellipse', 392, 176, 170, 170, { fill: t.ac3, opacity: 0.45, name: '꾸밈 원 2' }), h.S('ellipse', 430, -24, 64, 64, { fill: t.ac, opacity: 0.4, name: '꾸밈 원 3' }), h.S('ellipse', 150, 246, 38, 38, { fill: t.ac2, opacity: 0.5, name: '꾸밈 원 4' }), h.S('star', 300, 22, 22, 22, { fill: t.ac, opacity: 0.75, name: '꾸밈 별' })]
      : [h.S('ellipse', 448, -30, 90, 90, { fill: t.ac2, opacity: 0.25, name: '꾸밈 원 1' }), h.S('ellipse', -30, 244, 70, 70, { fill: t.ac3, opacity: 0.3, name: '꾸밈 원 2' })],
    sport: (h, t, big) => big ? [h.S('rect', 352, -70, 60, 440, { fill: t.ac, rot: 20, name: '꾸밈 빗금 1' }), h.S('rect', 426, -70, 22, 440, { fill: '#FFFFFF', opacity: 0.12, rot: 20, name: '꾸밈 빗금 2' }), h.S('rect', 0, H - 8, W, 8, { fill: t.ac, name: '아래 줄' })]
      : [h.S('rect', 466, -24, 16, 96, { fill: t.ac, rot: 20, name: '꾸밈 빗금 1' }), h.S('rect', 487, -24, 7, 96, { fill: t.ac, opacity: 0.45, rot: 20, name: '꾸밈 빗금 2' })],
    hanji: (h, t, big, k) => [h.S('rect', 9, 9, W - 18, H - 18, { fill: '', stroke: t.btx, strokeW: 0.8, opacity: 0.55, name: '테두리' }), h.S('rect', 12.5, 12.5, W - 25, H - 25, { fill: '', stroke: t.ac, strokeW: 0.3, opacity: 0.7, name: '안쪽 테두리' })]
      .concat(big && k !== 'cover' ? [h.S('rect', W - 56, H - 58, 24, 24, { fill: t.ac, radius: 2, name: '낙관' }), h.T('道', W - 56, H - 55, 24, 18, { font: 'Nanum Myeongjo', size: 44, weight: 700, color: '#FFFFFF', align: 'center', name: '낙관 글자' })] : []),
    ocean: (h, t, big) => big ? [h.S('ellipse', -80, 206, 280, 150, { fill: '#FFFFFF', opacity: 0.1, name: '물결 1' }), h.S('ellipse', 130, 222, 300, 150, { fill: '#FFFFFF', opacity: 0.14, name: '물결 2' }), h.S('ellipse', 330, 200, 280, 160, { fill: '#FFFFFF', opacity: 0.1, name: '물결 3' }), h.S('rect', 0, H - 6, W, 6, { fill: t.ac, name: '아래 줄' })]
      : [h.S('ellipse', -60, 262, 240, 70, { fill: t.cbg, opacity: 0.07, name: '물결 1' }), h.S('ellipse', 300, 268, 280, 70, { fill: t.cbg, opacity: 0.07, name: '물결 2' })],
    spring: (h, t, big) => (big ? PET_BIG : PET).map((p, i) => h.S('ellipse', p[0], p[1], p[2], p[2] * 0.62, { fill: i % 2 ? t.ac2 : t.ac, opacity: 0.55, rot: p[3], name: `꽃잎 ${i + 1}` })),
    winter: (h, t, big) => big ? Array.from({ length: 22 }, (_, i) => { const sz = 2 + (i * 7) % 6; return h.S('ellipse', (i * 97 + 13) % (W - 10), (i * 53 + 7) % (H - 10), sz, sz, { fill: '#FFFFFF', opacity: 0.25 + (i % 4) * 0.12, name: `눈 ${i + 1}` }); })
      : [[452, 20, 5], [470, 36, 3], [440, 44, 4], [486, 14, 3], [462, 58, 2]].map((p, i) => h.S('ellipse', p[0], p[1], p[2], p[2], { fill: t.sub, opacity: 0.3, name: `눈 ${i + 1}` })),
    mono: (h, t, big) => big ? [h.S('line', 34, H - 34, W - 68, 1, { fill: t.ctx, stroke: t.ctx, strokeW: 0.3, opacity: 0.5, name: '가는 선' }), h.S('rect', 34, H - 36.5, 40, 5, { fill: t.ac, name: '강조 막대' })] : [h.S('rect', W - 40, 30, 6, 6, { fill: t.ac, name: '꾸밈 네모' })],
    craft: (h, t, big) => big ? [h.S('rect', 12, 12, W - 24, H - 24, { fill: '', stroke: t.sub, strokeW: 0.5, radius: 8, opacity: 0.6, name: '테두리' }), h.S('rect', 352, 24, 84, 18, { fill: t.ac, opacity: 0.3, rot: 6, name: '마스킹 테이프' })] : [h.S('rect', 0, H - 6, W, 6, { fill: t.ac, opacity: 0.35, name: '아래 줄' })],
  };
  const BIG = new Set(['cover', 'section', 'closing']);
  /* 쪽 종류 — c = 내용, t = 테마 */
  const SLIDES = {
    cover: (h, t, c) => h.P(t.cbg, [
      h.S('ellipse', 300, -70, 280, 280, { fill: t.ac, opacity: 0.16, name: '꾸밈 원' }), h.S('rect', 0, H - 12, W, 12, { fill: t.ac, name: '아래 띠' }),
      h.S('rect', 34, 78, 46, 4, { fill: t.ac, name: '꾸밈 선' }),
      h.T(c.title, 34, 90, 300, 74, { font: t.fontT, weight: t.wT || 400, size: 70, color: t.ctx, lh: 1.15, name: '제목' }),
      h.T(c.sub || '', 34, 172, 300, 22, { size: 34, color: t.ctx, opacity: 0.85, name: '부제목' }),
      h.T(c.meta || '', 34, 226, 300, 14, { size: 24, weight: 700, color: t.ac, name: '날짜·발표자' }),
      h.I(c.img || A.m3, 330, 40, 150, 200, {}),
    ], '표지'),
    agenda: (h, t, c) => h.P(t.bbg, [
      ...hd(h, t, c.title || '오늘의 순서', 300),
      ...(c.items || []).slice(0, 5).flatMap((it, i) => [h.S('ellipse', 34, 82 + i * 34, 20, 20, { fill: t.ac, name: `번호 ${i + 1}` }), h.T(String(i + 1), 34, 85 + i * 34, 20, 14, { size: 30, weight: 800, color: t.onAc, align: 'center', name: `번호 글 ${i + 1}` }), h.T(it, 64, 84 + i * 34, 250, 18, { size: 34, color: t.btx, name: `순서 ${i + 1}` })]),
      h.S('rect', 330, 60, 150, 190, { fill: t.card, radius: R(t), name: '그림 바탕' }), h.I(c.img || A.m5, 340, 70, 130, 170, {}),
    ], '차례'),
    section: (h, t, c) => h.P(t.cbg, [
      h.S('rect', 0, 0, 14, H, { fill: t.ac, name: '왼쪽 띠' }),
      h.T(c.no || '01', 40, 58, 200, 80, { font: t.fontT, weight: t.wT || 400, size: 150, color: t.ac, name: '구역 번호' }),
      h.T(c.title, 40, 160, 420, 40, { font: t.fontT, weight: t.wT || 400, size: 70, color: t.ctx, name: '구역 제목' }),
      h.T(c.sub || '', 40, 210, 420, 20, { size: 32, color: t.ctx, opacity: 0.8, name: '설명' }),
    ], '구역 나눔'),
    content: (h, t, c) => h.P(t.bbg, [
      ...hd(h, t, c.title),
      h.T((c.bullets || []).map(b => '• ' + b).join('\n'), 34, 76, 250, 180, { size: 34, lh: 1.7, color: t.btx, name: '본문' }),
      h.S('rect', 300, 70, 176, 180, { fill: t.card, radius: R(t), name: '그림 바탕' }), h.I(c.img || A.m4, 310, 80, 156, 160, {}),
    ], '글 + 그림'),
    twocol: (h, t, c) => h.P(t.bbg, [
      ...hd(h, t, c.title),
      ...[c.left, c.right].flatMap((k, i) => { const x = 34 + i * 226; return [h.S('rect', x, 78, 214, 176, { fill: t.card, radius: R(t), name: i ? '오른쪽 칸' : '왼쪽 칸' }), h.S('rect', x, 78, 214, 6, { fill: t.ac, name: '칸 윗줄' }), h.T((k || {}).h || '', x + 14, 96, 186, 22, { size: 36, weight: 800, color: t.btx, name: '칸 제목' }), h.T((k || {}).t || '', x + 14, 128, 186, 116, { size: 30, lh: 1.6, color: t.btx, name: '칸 글' })]; }),
    ], '두 칸 비교'),
    numbers: (h, t, c) => h.P(t.bbg, [
      ...hd(h, t, c.title),
      ...(c.items || []).slice(0, 3).flatMap((it, i) => { const x = 34 + i * 150; return [h.S('rect', x, 88, 138, 150, { fill: t.card, radius: R(t), name: `숫자 칸 ${i + 1}` }), h.T(it.n, x, 108, 138, 50, { font: t.fontT, weight: t.wT || 400, size: 100, color: t.ac, align: 'center', name: `숫자 ${i + 1}` }), h.T(it.label, x + 8, 178, 122, 40, { size: 30, color: t.btx, align: 'center', lh: 1.45, name: `숫자 설명 ${i + 1}` })]; }),
    ], '큰 숫자'),
    timeline: (h, t, c) => { const it = (c.items || []).slice(0, 5), n = Math.max(1, it.length), gap = 440 / n; return h.P(t.bbg, [
      ...hd(h, t, c.title),
      h.S('rect', 34, 150, 440, 3, { fill: t.sub, opacity: 0.5, name: '일정 선' }),
      ...it.flatMap((x, i) => { const cx = 34 + gap * i + gap / 2; return [h.S('ellipse', cx - 8, 143, 16, 16, { fill: t.ac, name: `일정 점 ${i + 1}` }), h.T(x.when, cx - gap / 2, 112, gap, 20, { size: 34, weight: 800, color: t.ac, align: 'center', name: `때 ${i + 1}` }), h.T(x.what, cx - gap / 2 + 4, 172, gap - 8, 60, { size: 30, color: t.btx, align: 'center', lh: 1.45, name: `할 일 ${i + 1}` })]; }),
    ], '일정'); },
    quote: (h, t, c) => h.P(t.card === '#FFFFFF' ? t.bbg : t.card, [
      h.T('“', 40, 28, 80, 80, { font: t.fontQ, size: 190, color: t.ac, name: '따옴표' }),
      h.T(c.text, 80, 92, 360, 100, { font: t.fontQ, size: 48, lh: 1.5, color: t.btx, name: '말씀' }),
      h.T(c.by ? '— ' + c.by : '', 80, 210, 360, 16, { size: 30, color: t.sub, align: 'right', name: '말한 사람' }),
    ], '말씀·인용'),
    gallery: (h, t, c) => h.P(t.bbg, [
      ...hd(h, t, c.title),
      ...(c.pics || []).slice(0, 3).flatMap((p, i) => { const x = 34 + i * 150; return [h.S('rect', x, 78, 138, 140, { fill: t.card, radius: R(t), name: `사진 칸 ${i + 1}` }), h.I(p.img, x + 8, 86, 122, 124, {}), h.T(p.cap || '', x, 224, 138, 16, { size: 30, color: t.btx, align: 'center', name: `사진 설명 ${i + 1}` })]; }),
    ], '사진 모음'),
    photo: (h, t, c) => h.P(t.bbg, [
      h.S('rect', 0, 0, 200, H, { fill: t.cbg, name: '글 바탕' }), h.S('rect', 34, 62, 40, 3, { fill: t.ac, name: '글 꾸밈 선' }),
      h.T(c.title || '', 34, 72, 150, 60, { font: t.fontT, weight: t.wT || 400, size: 56, lh: 1.2, color: t.ctx, name: '제목' }),
      h.T(c.sub || '', 34, 138, 150, 100, { size: 28, lh: 1.6, color: t.ctx, opacity: 0.85, name: '설명' }),
      h.S('rect', 200, 0, W - 200, H, { fill: t.card, name: '사진 바탕' }), h.I(c.img || A.group, 210, 12, W - 220, H - 24, { fit: 'contain', name: '사진 (눌러서 바꾸기)' }),
    ], '큰 사진'),
    cards3: (h, t, c) => h.P(t.bbg, [...hd(h, t, c.title),
      ...(c.items || []).slice(0, 3).flatMap((it, i) => { const x = 34 + i * 150; return [h.S('rect', x, 80, 138, 172, { fill: t.card, radius: R(t), name: `카드 ${i + 1}` }), h.S('ellipse', x + 46, 92, 46, 46, { fill: t.ac, name: `카드 동그라미 ${i + 1}` }), h.T(it.ic || String(i + 1), x + 46, 100, 46, 30, { size: 48, weight: 800, color: t.onAc, align: 'center', name: `카드 기호 ${i + 1}` }), h.T(it.h || '', x + 6, 146, 126, 22, { size: 42, weight: 800, color: t.btx, align: 'center', name: `카드 제목 ${i + 1}` }), h.T(it.t || '', x + 8, 176, 122, 70, { size: 32, lh: 1.5, color: t.btx, align: 'center', name: `카드 글 ${i + 1}` })]; }),
    ], '세 가지 카드'),
    statement: (h, t, c) => h.P(t.ac, [
      h.T(c.text || '', 40, 76, W - 80, 96, { font: t.fontT, weight: t.wT || 400, size: 84, lh: 1.3, color: t.onAc, align: 'center', valign: 'middle', name: '한 문장' }),
      h.S('rect', W / 2 - 20, 186, 40, 3, { fill: t.onAc, opacity: 0.6, name: '꾸밈 선' }),
      h.T(c.sub || '', 40, 198, W - 80, 20, { size: 32, color: t.onAc, opacity: 0.85, align: 'center', name: '덧붙임' }),
    ], '한 문장 크게'),
    closing: (h, t, c) => h.P(t.cbg, [
      h.S('ellipse', -80, 160, 260, 260, { fill: t.ac, opacity: 0.16, name: '꾸밈 원' }), h.S('rect', 0, 0, W, 10, { fill: t.ac, name: '위 띠' }),
      h.T(c.title || '감사합니다', 0, 92, W, 60, { font: t.fontT, weight: t.wT || 400, size: 100, color: t.ctx, align: 'center', name: '마무리 글' }),
      h.T(c.sub || '', 0, 160, W, 22, { size: 34, color: t.ctx, align: 'center', opacity: 0.85, name: '부제목' }),
      h.T(`나라차태권도  ·  ${ADDR}  ·  ${PHONE}`, 0, 236, W, 14, { size: 24, color: t.ctx, align: 'center', opacity: 0.75, name: '연락처' }),
    ], '마무리'),
  };
  /* 분위기 입히기: 기본 꾸밈 중 그 분위기에 안 맞는 것(strip)을 빼고, 바탕 꾸밈(DECO)을 맨 뒤에 깔기 */
  Object.keys(SLIDES).forEach(k => { const f = SLIDES[k]; SLIDES[k] = (h, t, c) => { const pg = f(h, t, c); if (t.strip) pg.els = pg.els.filter(e => !t.strip.includes(e.name)); const D = DECO[t.sty]; if (D && k !== 'statement') pg.els.unshift(...D(h, t, BIG.has(k), k)); return pg; }; });
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
    { id: 'pres-kids', theme: 'kids', name: '어린이 태권도 체험 수업 · 키즈 컬러', tags: { format: '프레젠테이션', season: '사계절', age: '유아', occasion: '모집', biz: '태권도장' }, slides: [
      ['cover', { title: '태권도\n처음 해 봐요!', sub: '어린이 체험 수업에 오신 걸 환영해요', meta: '나라차태권도 · 유아·저학년', img: A.m1 }],
      ['agenda', { items: ['인사하기', '몸풀기 놀이', '발차기 해 보기', '송판 격파', '칭찬 스티커'], img: A.m5 }],
      ['cards3', { title: '오늘 배우는 세 가지', items: [{ ic: '🙇', h: '바른 인사', t: '허리를 숙여\n공손하게' }, { ic: '🦶', h: '앞차기', t: '무릎을 들고\n힘차게 쭉!' }, { ic: '💪', h: '기합', t: '큰 소리로\n자신 있게' }] }],
      ['photo', { title: '친구랑\n함께해요', sub: '놀이처럼 즐겁게 배우고\n서로 응원하는 법을\n익혀요', img: A.friends }],
      ['timeline', { title: '체험 수업 순서', items: [{ when: '10분', what: '인사·몸풀기' }, { when: '20분', what: '발차기 놀이' }, { when: '10분', what: '송판 격파' }, { when: '5분', what: '칭찬 시간' }] }],
      ['statement', { text: '할 수 있다!\n나는 태권도 어린이!', sub: '오늘 용기 낸 친구 모두 최고예요' }],
      ['closing', { title: '또 만나요!', sub: '등록 문의는 도장 안내데스크로' }],
    ] },
    { id: 'pres-sport', theme: 'sport', name: '태권도 대회 출전 안내 · 스포츠 블랙', tags: { format: '프레젠테이션', season: '사계절', age: '초등', occasion: '심사·대회', biz: '태권도장' }, slides: [
      ['cover', { title: '2027 태권도\n대회 출전', sub: '준비한 만큼 보여 주자', meta: '○○시장배 · 2027. ○. ○.', img: A.m9 }],
      ['section', { no: '01', title: '대회 소개', sub: '종목·장소·일정' }],
      ['content', { title: '대회 정보', bullets: ['종목: 품새 · 겨루기', '장소: ○○실내체육관', '참가: 유급자·유단자', '신청 마감: ○월 ○일'], img: A.m8 }],
      ['numbers', { title: '우리 팀', items: [{ n: '24명', label: '출전 선수' }, { n: '8주', label: '특별 훈련' }, { n: '3종목', label: '도전 종목' }] }],
      ['timeline', { title: '대회 당일', items: [{ when: '7:30', what: '도장 집합' }, { when: '9:00', what: '개회식' }, { when: '10:00', what: '경기 시작' }, { when: '16:00', what: '시상·귀가' }] }],
      ['cards3', { title: '선수 준비물', items: [{ ic: '🥋', h: '도복·띠', t: '이름표 달기' }, { ic: '🛡', h: '보호구', t: '몸통·머리·손발' }, { ic: '🍌', h: '간식·물', t: '가볍게 먹기' }] }],
      ['statement', { text: '포기하지 않는 사람이\n진짜 챔피언', sub: '나라차 선수단 파이팅!' }],
      ['closing', { title: '모두 화이팅!', sub: '학부모님의 응원이 가장 큰 힘입니다' }],
    ] },
    { id: 'pres-hanji', theme: 'hanji', name: '인성 교육 · 태권도 정신 · 한지 전통', tags: { format: '프레젠테이션', season: '사계절', age: '전체', occasion: '교육', biz: '태권도장' }, slides: [
      ['cover', { title: '태권도 정신\n다섯 가지', sub: '예의 · 염치 · 인내 · 극기 · 백절불굴', meta: '나라차태권도 인성 교육', img: A.respect }],
      ['agenda', { items: ['예의(禮義)', '염치(廉恥)', '인내(忍耐)', '극기(克己)', '백절불굴(百折不屈)'], img: A.m3 }],
      ['section', { no: '一', title: '예의', sub: '나를 낮추고 남을 높이는 마음' }],
      ['quote', { text: '예의로 시작해서\n예의로 끝난다.', by: '태권도의 가르침' }],
      ['cards3', { title: '도장에서 지키는 예절', items: [{ ic: '禮', h: '인사', t: '들어올 때\n나갈 때' }, { ic: '靜', h: '바른 자세', t: '말씀하실 때\n바르게 앉기' }, { ic: '和', h: '배려', t: '친구 먼저\n양보하기' }] }],
      ['content', { title: '집에서도 이어 가기', bullets: ['어른께 먼저 인사하기', '하루 한 가지 스스로 하기', '약속한 시간 지키기', '고마운 일에 감사 말하기'], img: A.resp }],
      ['statement', { text: '백 번 꺾여도\n굽히지 않는 마음', sub: '백절불굴(百折不屈)' }],
      ['closing', { title: '감사합니다', sub: '바른 마음, 바른 몸, 나라차태권도' }],
    ] },
    { id: 'pres-ocean', theme: 'ocean', name: '여름방학 특강 · 오션 블루', tags: { format: '프레젠테이션', season: '여름', age: '초등', occasion: '캠프·특강', biz: '태권도장' }, slides: [
      ['cover', { title: '여름방학\n태권도 특강', sub: '더위를 이기는 시원한 땀방울', meta: '2027. 7. 28. ~ 8. 15.', img: A.m7 }],
      ['agenda', { items: ['특강 소개', '반별 시간표', '특강 프로그램', '준비물', '신청 방법'], img: A.m5 }],
      ['content', { title: '이런 특강이에요', bullets: ['줄넘기·체력 집중 훈련', '품새 완성반', '시범단 기초 동작', '물총 놀이 마무리 행사'], img: A.m8 }],
      ['twocol', { title: '반별 시간표', left: { h: '오전반', t: '10:00 ~ 11:30\n유아·저학년\n놀이 체력 위주' }, right: { h: '오후반', t: '2:00 ~ 3:30\n고학년·청소년\n품새·시범 위주' } }],
      ['timeline', { title: '3주 과정', items: [{ when: '1주', what: '체력 기르기' }, { when: '2주', what: '기술 다지기' }, { when: '3주', what: '발표·물총 놀이' }] }],
      ['gallery', { title: '작년 여름 특강', pics: [{ img: A.m5, cap: '줄넘기' }, { img: A.m8, cap: '품새' }, { img: A.m11, cap: '마무리 행사' }] }],
      ['closing', { title: '시원하게 만나요!', sub: '신청은 7월 20일까지' }],
    ] },
    { id: 'pres-spring', theme: 'spring', name: '봄 새 학기 수련생 모집 · 봄꽃', tags: { format: '프레젠테이션', season: '봄', age: '학부모', occasion: '모집', biz: '태권도장' }, slides: [
      ['cover', { title: '새 학기,\n새 친구', sub: '봄과 함께 시작하는 태권도', meta: '2027 봄 신규 수련생 모집', img: A.m1 }],
      ['statement', { text: '아이의 첫걸음을\n함께 응원합니다', sub: '나라차태권도' }],
      ['cards3', { title: '태권도를 하면 좋아요', items: [{ ic: '🌱', h: '튼튼한 몸', t: '바른 자세와\n체력' }, { ic: '😊', h: '자신감', t: '발표·도전이\n즐거워져요' }, { ic: '🤝', h: '예절·배려', t: '친구와\n사이좋게' }] }],
      ['numbers', { title: '봄 모집 혜택', items: [{ n: '1주', label: '무료 체험' }, { n: '0원', label: '첫 달 도복' }, { n: '형제', label: '함께 오면 할인' }] }],
      ['photo', { title: '즐거운\n수업 시간', sub: '놀이와 수련이\n함께하는 수업으로\n즐겁게 배워요', img: A.group }],
      ['timeline', { title: '등록은 이렇게', items: [{ when: '1', what: '전화·방문 상담' }, { when: '2', what: '체험 수업' }, { when: '3', what: '등록·도복 받기' }] }],
      ['closing', { title: '봄에 만나요', sub: '상담은 언제든 환영합니다' }],
    ] },
    { id: 'pres-winter', theme: 'winter', name: '겨울방학 캠프·송년 행사 · 겨울', tags: { format: '프레젠테이션', season: '겨울', age: '전체', occasion: '행사', biz: '태권도장' }, slides: [
      ['cover', { title: '겨울방학\n송년 캠프', sub: '한 해를 신나게 마무리해요', meta: '2027. 12. 26. ~ 27.', img: A.m11 }],
      ['agenda', { items: ['캠프 소개', '일정표', '송년 발표회', '준비물', '안전 약속'], img: A.m3 }],
      ['timeline', { title: '캠프 일정', items: [{ when: '첫날 오후', what: '눈썰매·놀이' }, { when: '첫날 밤', what: '송년 파티' }, { when: '둘째 날', what: '발표회·귀가' }] }],
      ['twocol', { title: '준비물과 안전', left: { h: '준비물', t: '두꺼운 외투·장갑\n갈아입을 옷\n개인 물병' }, right: { h: '안전 약속', t: '사범님과 함께 다니기\n미끄러운 곳 조심\n아프면 바로 말하기' } }],
      ['gallery', { title: '송년 발표회', pics: [{ img: A.m8, cap: '품새' }, { img: A.m9, cap: '격파' }, { img: A.m11, cap: '단체 시범' }] }],
      ['quote', { text: '올해 흘린 땀이\n내년의 자신감이 됩니다.', by: '나라차태권도 관장' }],
      ['closing', { title: '즐거운 연말 되세요', sub: '새해에도 힘차게!' }],
    ] },
    { id: 'pres-mono', theme: 'mono', name: '학부모 총회·운영 보고 · 미니멀', tags: { format: '프레젠테이션', season: '사계절', age: '학부모', occasion: '안내', biz: '태권도장' }, slides: [
      ['cover', { title: '2027\n학부모 총회', sub: '한 해 운영 보고와 내년 계획', meta: '2027. 12. · 나라차태권도', img: A.logo }],
      ['agenda', { items: ['올해 돌아보기', '수련 성과', '시설·안전', '내년 계획', '질문과 답'], img: A.m3 }],
      ['section', { no: '01', title: '올해 돌아보기', sub: '숫자와 사진으로 보는 2027' }],
      ['numbers', { title: '2027 운영 결과', items: [{ n: '128명', label: '수련생' }, { n: '46명', label: '승급' }, { n: '15회', label: '행사·대회' }] }],
      ['content', { title: '시설·안전', bullets: ['매트 전체 교체 (6월)', '차량 안전 점검 매월', 'CCTV·출입 알림 운영', '응급 처치 교육 이수'], img: A.m4 }],
      ['twocol', { title: '내년 계획', left: { h: '수련', t: '시범단 새로 꾸리기\n품새 대회 출전 확대' }, right: { h: '소통', t: '분기별 공개 수업\n월 소식지 계속' } }],
      ['statement', { text: '믿고 맡겨 주셔서\n감사합니다', sub: '내년에도 한결같이' }],
      ['closing', { title: '질문과 답', sub: '편하게 말씀해 주세요' }],
    ] },
    { id: 'pres-craft', theme: 'craft', name: '우리 아이 성장 이야기 · 크라프트 감성', tags: { format: '프레젠테이션', season: '가을', age: '학부모', occasion: '감사', biz: '태권도장' }, slides: [
      ['cover', { title: '우리 아이\n성장 이야기', sub: '한 해 동안 이만큼 자랐어요', meta: '2027 가을 공개 수업', img: A.m3 }],
      ['statement', { text: '작은 발차기 하나에도\n큰 용기가 들어 있어요', sub: '' }],
      ['photo', { title: '처음 왔던 날', sub: '쭈뼛쭈뼛 인사하던\n아이가 이제는\n먼저 인사해요', img: A.m1 }],
      ['cards3', { title: '이만큼 자랐어요', items: [{ ic: '🌱', h: '몸', t: '줄넘기 100개\n거뜬히!' }, { ic: '🌼', h: '마음', t: '친구를\n먼저 도와요' }, { ic: '🌳', h: '자신감', t: '앞에 나와\n시범도 척척' }] }],
      ['gallery', { title: '함께한 순간', pics: [{ img: A.m5, cap: '봄 소풍' }, { img: A.m7, cap: '여름 캠프' }, { img: A.m8, cap: '가을 심사' }] }],
      ['quote', { text: '아이의 성장은\n하루하루 쌓인 땀방울입니다.', by: '나라차태권도' }],
      ['closing', { title: '고맙습니다', sub: '앞으로도 함께 지켜봐 주세요' }],
    ] },
  ];
  /* 분위기 낱말 (검색: 귀여운·깔끔한·전통·시원한·강렬한·감성 …) */
  const MOOD = { navy: '신뢰 차분 단정 네이비 남색', red: '깔끔 산뜻 흰색 빨강', green: '자연 숲 초록 캠프', gold: '고급 품격 검정 금색 시상', pastel: '부드러운 따뜻한 파스텔 상냥', kids: '귀여운 밝은 알록달록 어린이 유아 놀이', sport: '강렬한 역동 스포츠 대회 검정 빨강 빗금', hanji: '전통 한국 한지 붓 명조 예절 인성 낙관', ocean: '시원한 여름 바다 파랑 물결', spring: '봄 꽃 분홍 화사한 새학기', winter: '겨울 눈 연말 크리스마스 송년', mono: '미니멀 깔끔 비즈니스 보고 회의 모던', craft: '감성 따뜻한 손글씨 크라프트 종이 가을' };
  DECKS.forEach(dk => L.push({ id: dk.id, cat: 'pres', mood: dk.theme, name: dk.name, w: W, h: H, tags: dk.tags, screen: true, kw: `프레젠테이션 PPT 발표 슬라이드 피피티 분위기 ${MOOD[dk.theme] || ''} ${dk.name} ${dk.slides.map(s => s[1].title || '').join(' ')}`, build: (uid) => deck(TH[dk.theme], dk.slides)(uid) }));
  /* 쪽 하나씩 넣는 「쪽 종류」 템플릿 (지금 발표자료에 같은 테마 쪽 더하기) — 테마마다 10가지 */
  const SAMPLE = { cover: { title: '발표 제목', sub: '부제목을 쓰세요', meta: '날짜 · 발표자' }, agenda: { items: ['첫째 순서', '둘째 순서', '셋째 순서', '넷째 순서'] }, section: { no: '01', title: '구역 제목', sub: '이 구역에서 다룰 내용' }, content: { title: '쪽 제목', bullets: ['첫째 내용', '둘째 내용', '셋째 내용'] }, twocol: { title: '두 가지 비교', left: { h: '왼쪽', t: '내용을 쓰세요' }, right: { h: '오른쪽', t: '내용을 쓰세요' } }, numbers: { title: '숫자로 보기', items: [{ n: '100', label: '설명' }, { n: '20', label: '설명' }, { n: '3', label: '설명' }] }, timeline: { title: '일정', items: [{ when: '1단계', what: '할 일' }, { when: '2단계', what: '할 일' }, { when: '3단계', what: '할 일' }, { when: '4단계', what: '할 일' }] }, quote: { text: '마음에 남는 한 문장을\n여기에 쓰세요.', by: '말한 사람' }, gallery: { title: '사진 모음', pics: [{ img: A.m7, cap: '설명' }, { img: A.m8, cap: '설명' }, { img: A.m9, cap: '설명' }] }, closing: { title: '감사합니다', sub: '' } };
  Object.assign(SAMPLE, { photo: { title: '큰 사진\n제목', sub: '사진을 눌러 바꾸고\n설명을 쓰세요' }, cards3: { title: '세 가지', items: [{ ic: '1', h: '첫째', t: '설명을 쓰세요' }, { ic: '2', h: '둘째', t: '설명을 쓰세요' }, { ic: '3', h: '셋째', t: '설명을 쓰세요' }] }, statement: { text: '가장 전하고 싶은\n한 문장', sub: '덧붙이는 말' } });
  const KNAME = { cover: '표지', agenda: '차례', section: '구역 나눔', content: '글 + 그림', twocol: '두 칸 비교', numbers: '큰 숫자', timeline: '일정·과정', quote: '말씀·인용', gallery: '사진 모음', photo: '큰 사진', cards3: '세 가지 카드', statement: '한 문장 크게', closing: '마무리' };
  const TNAME = { navy: '네이비', red: '화이트 레드', green: '그린', gold: '블랙 골드', pastel: '파스텔', kids: '키즈 컬러', sport: '스포츠 블랙', hanji: '한지 전통', ocean: '오션 블루', spring: '봄꽃', winter: '겨울', mono: '미니멀', craft: '크라프트 감성' };
  Object.keys(TH).forEach(th => Object.keys(SLIDES).forEach(k => L.push({ id: `pres1-${th}-${k}`, cat: 'pres', mood: th, name: `발표 쪽 · ${KNAME[k]} · ${TNAME[th]}`, w: W, h: H, screen: true, one: true, tags: { format: '프레젠테이션', season: '사계절', age: '전체', occasion: '안내', biz: '태권도장' }, kw: `프레젠테이션 PPT 발표 슬라이드 쪽 ${KNAME[k]} ${TNAME[th]} 분위기 ${MOOD[th] || ''}`, build: (uid) => [SLIDES[k](H_(uid), TH[th], SAMPLE[k])] })));
  NC.tpl.presThemes = TH; NC.tpl.presSlides = SLIDES; NC.tpl.presH = H_; NC.tpl.presKinds = KNAME; NC.tpl.presThemeNames = TNAME; /* AI 발표자료 만들기가 같은 쪽 모양을 씀 */
  if (Array.isArray(NC.tpl.cats) && !NC.tpl.cats.some(c => c[0] === 'pres')) NC.tpl.cats.splice(1, 0, ['pres', '📊 프레젠테이션']);
  if (NC.tpl.facets && !NC.tpl.facets.format.includes('프레젠테이션')) NC.tpl.facets.format.push('프레젠테이션');
})();

/* SNS 글자 바닥값 (11/26 팀장님 「24px로」): SNS·카드뉴스 템플릿은 휴대폰에서 보므로 1080px 그림 기준 24px(정사각 285.75mm 기준 약 18pt)보다 작은 글을
   24px까지 키움 — 칸 폭·높이 안에서만(넘치지 않게, 모양 그대로). 장식 글자는 그대로. 인쇄물 크기로 바꿔 만들 때(sz && !sz.screen)는 건드리지 않음 */
(function () {
  const MIN_PX = 24;
  const emW = ch => /[ㄱ-힣一-鿿]/.test(ch) ? 0.95 : /[A-Z0-9]/.test(ch) ? 0.66 : ch === ' ' ? 0.3 : 0.52;
  function snsFloor(pages, W, H, fill) {
    fill = fill || 0.98;
    const minPt = MIN_PX * Math.min(W, H) / (0.3528 * 1080);
    [].concat(pages).forEach(pg => (pg && pg.els || []).forEach(e => {
      if (e.type !== 'text' || !e.size || e.name === '장식' || e.size >= minPt) return;
      let f = minPt / e.size; const mm = e.size * 0.3528, lines = String(e.text || '').split('\n');
      const longest = Math.max(...lines.map(l => [...l].reduce((a, ch) => a + emW(ch), 0) + (e.ls || 0) * l.length)) * mm;
      if (longest > 0 && e.w) f = Math.min(f, (e.w * fill) / longest);
      const tall = lines.length * mm * (e.lh || 1.35); if (tall > 0 && e.h) f = Math.min(f, Math.max(1, (e.h * 1.05) / tall));
      if (f > 1.02) { e.size = Math.round(e.size * f * 10) / 10; if (e.fitText) e.fitMax = e.size; }
    }));
    return pages;
  }
  NC.tpl.snsFloor = snsFloor;
  (NC.tpl.list || []).forEach(t => {
    const fmt = t.tags && t.tags.format;
    if (t._snsFloor || !(t.cat === 'sns' || fmt === 'SNS' || fmt === '카드뉴스') || typeof t.build !== 'function') return;
    const orig = t.build; t._snsFloor = true; t._buildRaw = orig;
    t.build = function (uid, a2) { const pages = orig.apply(this, arguments), sz = t.responsive && a2 && a2.w ? a2 : null; if (sz && !sz.screen) return pages;  /* 반응형만 둘째 값이 크기(sz), 나머지는 색 묶음(pal) */ return snsFloor(pages, sz && sz.w ? sz.w : t.w, sz && sz.h ? sz.h : t.h); };
  });
})();
