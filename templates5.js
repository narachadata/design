// 템플릿 5: 인성덕목 (이달의 덕목 SNS 카드 · A4 포스터 · 연간 계획표 · 칭찬 카드)
// 덕목 그림 = defaults.js NARACAL_VIRTUE_ART (극기 = 1년차·홀수 해, 홍익 = 2년차·짝수 해)
// 문구 = 메인 프로그램 인성덕목 2년 계획(virtue24.js, 관리 앱에서 고친 내용 포함) — app.js virtuePlanFor
// 덕목·명언·사자성어 글 상자와 삽화에는 달(month)·역할(role)을 달아 두어 [나라차 → 캘린더 → 인성 문구 넣기]로 새 문구·그림을 다시 받을 수 있음
(function () {
  const L = NC.tpl.list;
  const INK = '#1E2B5A', WHITE = '#ffffff';
  const H = (uid) => ({
    T: (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: 'Noto Sans KR', size: 12, weight: 400, italic: false, color: INK, align: 'center', lh: 1.35, ls: 0, strokeW: 0, strokeC: WHITE, shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, st),
    I: (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }, st),
    S: (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: '#FFE89A', stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st),
    P: (bg, els, label) => ({ id: uid(), bg, els, label }),
  });
  // 달마다 바탕(연한 색)과 강조색(진한 색) — 계절 흐름: 겨울 파랑 → 봄 분홍·연두 → 여름 하늘·민트 → 가을 주황·갈색 → 겨울 빨강
  const PAL = [['#E8F1FB', '#2D5DA8'], ['#EEF0FB', '#4A4FB0'], ['#FDEDF2', '#C2456E'], ['#EEF7E4', '#4D8A2E'], ['#FFF1E6', '#D0602A'], ['#E6F6F4', '#1F8A7A'],
    ['#E4F4FC', '#1D7FB5'], ['#FFF6DA', '#B7831A'], ['#FBF0E3', '#B4652A'], ['#FCEBDD', '#C2551F'], ['#F2ECE4', '#7A5638'], ['#FBE9EA', '#B8333C']];
  const TRACK = { '극기': { yr: '1년차', theme: '극기 — 나의 가치', id: 'kg' }, '홍익': { yr: '2년차', theme: '홍익 — 우리·모두의 가치', id: 'hi' } };
  // 그 덕목의 가장 가까운 해 (올해가 맞으면 올해, 아니면 내년)
  const yearOf = tr => { const y = new Date().getFullYear(), t = window.NARACAL_VTRACK ? window.NARACAL_VTRACK : (v => (v % 2 === 0 ? '홍익' : '극기')); return t(y) === tr ? y : y + 1; };
  const plan = tr => { const y = yearOf(tr); const P = typeof NC.virtuePlanFor === 'function' ? NC.virtuePlanFor(y).P : (((window.NARACAL_VPLAN || {})[tr]) || []); return { y, P }; };
  const art = (tr, m) => ((window.NARACAL_VIRTUE_ART || {})[tr] || [])[m - 1] || '';
  const logo = bg => (NC.logoFor ? NC.logoFor('brand-horizontal', bg) : 'asset:brand-horizontal'); // 가로 로고(5.19:1) — 어두운 바탕은 흰색, 빨강·주황·황토 바탕은 단색
  const josa = (w, a, b) => { const c = String(w || '').trim().slice(-1).charCodeAt(0); return (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28) ? a : b; }; // 받침 있으면 a
  const lines = p => `1. ${(p || [])[0] || ''}\n2. ${(p || [])[1] || ''}`;
  const R = (m, role) => ({ month: m, role }); // 인성 문구 넣기로 다시 채울 자리

  /* ① 이달의 인성덕목 SNS 카드 (4:5 · 1080×1350 · 12쪽) */
  function sns(uid, tr) {
    const { T, I, S, P } = H(uid), { P: V } = plan(tr), W = 285.75, Hh = 357.19;
    return V.map((v, k) => { const m = k + 1, [bg, ac] = PAL[k]; return P(bg, [
      T(`${m}월 이달의 인성덕목`, 20, 20, W - 40, 16, { font: 'Jua', size: 36, color: ac, name: '머리글' }),
      T(v.virtue, 20, 38, W - 40, 46, Object.assign({ font: 'Black Han Sans', size: 118, color: INK, lh: 1.1, name: '덕목' }, R(m, 'virtue'))),
      T(`(${v.en})`, 20, 86, W - 40, 12, Object.assign({ font: 'Montserrat', size: 26, weight: 700, color: ac, ls: 0.12, name: '영문' }, R(m, 'en'))),
      S('rect', 34, 104, W - 68, 152, { fill: WHITE, radius: 24, name: '그림 판' }),
      I(art(tr, m), 44, 110, W - 88, 140, Object.assign({ pos: '50% 100%', name: '삽화' }, R(m, 'illust'))),
      T(`${v.idiom}(${v.hanja})`, 20, 264, W - 40, 18, Object.assign({ font: 'Gowun Batang', size: 42, weight: 700, color: INK, name: '사자성어' }, R(m, 'idiom'))),
      T(v.meaning, 30, 285, W - 60, 30, Object.assign({ size: 24, weight: 500, color: '#3A4563', lh: 1.4, name: '풀이' }, R(m, 'meaning'))),
      S('rect', 0, Hh - 34, W, 34, { fill: ac, name: '하단 띠' }),
      T(`${TRACK[tr].yr} ${TRACK[tr].theme}`, 20, Hh - 25, 150, 16, { size: 26, weight: 700, color: WHITE, align: 'left', name: '덕목 해' }),
      I(logo(ac), W - 110, Hh - 28, 90, 22, { pos: '100% 50%', name: '로고' }),
    ], `${m}월 ${v.virtue}`); });
  }

  /* ② 이달의 인성덕목 포스터 (A4 세로 · 12쪽) — 게시판·가정통신 */
  function poster(uid, tr) {
    const { T, I, S, P } = H(uid), { y, P: V } = plan(tr);
    return V.map((v, k) => { const m = k + 1, [bg, ac] = PAL[k]; return P(bg, [
      S('rect', 0, 0, 210, 24, { fill: ac, name: '상단 띠' }),
      T(`${y}년 ${m}월 · 이달의 인성덕목`, 12, 7, 186, 10, { font: 'Jua', size: 20, color: WHITE, name: '머리글' }),
      T(v.virtue, 12, 30, 186, 28, Object.assign({ font: 'Black Han Sans', size: 72, color: INK, lh: 1.1, name: '덕목' }, R(m, 'virtue'))),
      T(`(${v.en})`, 12, 59, 186, 8, Object.assign({ font: 'Montserrat', size: 15, weight: 700, color: ac, ls: 0.12, name: '영문' }, R(m, 'en'))),
      I(art(tr, m), 35, 70, 140, 106, Object.assign({ pos: '50% 100%', name: '삽화' }, R(m, 'illust'))),
      S('rect', 18, 181, 174, 34, { fill: WHITE, radius: 6, name: '명언 상자' }),
      T(v.quote, 24, 185, 162, 27, Object.assign({ font: 'Gowun Batang', size: 13, weight: 700, color: INK, lh: 1.45, valign: 'middle', name: '명언' }, R(m, 'quote'))),
      T('이렇게 실천해요', 18, 220, 174, 8, { size: 15, weight: 800, color: ac, align: 'left', name: '실천 제목' }),
      T(lines(v.practice), 18, 229, 174, 26, Object.assign({ size: 12.5, weight: 500, color: '#2B2F3A', align: 'left', lh: 1.55, name: '실천' }, R(m, 'practice'))),
      S('rect', 18, 257, 174, 0.6, { fill: ac, opacity: 0.5, name: '구분선' }),
      T(`${v.idiom}(${v.hanja})`, 12, 260, 186, 9, Object.assign({ font: 'Gowun Batang', size: 18, weight: 700, color: INK, name: '사자성어' }, R(m, 'idiom'))),
      T(v.meaning, 18, 270, 174, 11, Object.assign({ size: 11, color: '#3A4563', lh: 1.4, name: '풀이' }, R(m, 'meaning'))),
      I(logo(bg), 80, 284, 50, 8, { name: '로고' }),
    ], `${m}월 ${v.virtue}`); });
  }

  /* ③ 연간 인성덕목 계획표 (A4 가로 · 1쪽 · 12달 그림 모음) */
  function yearly(uid, tr) {
    const { T, I, S, P } = H(uid), { y, P: V } = plan(tr), M = 12, cw = (297 - 2 * M - 3 * 5) / 4, ch = (194 - 36 - 2 * 4) / 3;
    const els = [
      T(`${y} 인성덕목 연간 계획`, M, 9, 180, 14, { font: 'Black Han Sans', size: 30, color: INK, align: 'left', name: '제목' }),
      T(`${TRACK[tr].yr} ${TRACK[tr].theme} · 달마다 한 가지 덕목을 함께 실천합니다`, M, 24, 200, 7, { size: 12, weight: 500, color: '#4A5370', align: 'left', name: '부제' }),
      I(logo('#ffffff'), 297 - M - 52, 11, 52, 12, { pos: '100% 50%', name: '로고' }),
    ];
    V.forEach((v, k) => { const m = k + 1, [bg, ac] = PAL[k], x = M + (k % 4) * (cw + 5), yy = 36 + Math.floor(k / 4) * (ch + 4);
      els.push(S('rect', x, yy, cw, ch, { fill: bg, radius: 4, name: `${m}월 칸` }),
        I(art(tr, m), x + 2, yy + 2, 28, 28, Object.assign({ pos: '50% 100%', name: `${m}월 삽화` }, R(m, 'illust'))),
        T(`${m}월`, x + 32, yy + 4, cw - 34, 5, { size: 10, weight: 800, color: ac, align: 'left', name: `${m}월` }),
        T(v.virtue, x + 32, yy + 10, cw - 34, 10, Object.assign({ font: 'Black Han Sans', size: v.virtue.length > 4 ? 16 : 21, color: INK, align: 'left', lh: 1.1, name: `${m}월 덕목` }, R(m, 'virtue'))),
        T(`(${v.en})`, x + 32, yy + 21, cw - 34, 5, Object.assign({ font: 'Montserrat', size: 7.5, weight: 700, color: ac, align: 'left', name: `${m}월 영문` }, R(m, 'en'))),
        T(`${v.idiom}(${v.hanja})`, x + 3, yy + 32, cw - 6, 6, Object.assign({ font: 'Gowun Batang', size: 11, weight: 700, color: INK, align: 'left', name: `${m}월 사자성어` }, R(m, 'idiom'))),
        T(`· ${(v.practice || [])[0] || ''}`, x + 3, yy + 39, cw - 6, 9, { size: 8, color: '#3A4563', align: 'left', lh: 1.35, name: `${m}월 실천` }));
    });
    els.push(T('나라차태권도 인성교육 — 수련 시간에 덕목을 배우고, 집에서는 실천 두 가지를 함께 해 주세요.', M, 199, 297 - 2 * M, 6, { size: 9.5, color: '#4A5370', name: '안내' }));
    return [P('#ffffff', els, `${y} 연간 계획`)];
  }

  /* ④ 인성 칭찬 카드 (엽서 148×100 · 12쪽) — 이름 칸에 써서 나눠 주기 */
  function praise(uid, tr) {
    const { T, I, S, P } = H(uid), { y, P: V } = plan(tr);
    return V.map((v, k) => { const m = k + 1, [bg, ac] = PAL[k]; return P('#ffffff', [
      S('rect', 4, 4, 140, 92, { fill: bg, stroke: ac, strokeW: 0.8, radius: 6, name: '테두리' }),
      I(art(tr, m), 8, 12, 58, 64, Object.assign({ pos: '50% 100%', name: '삽화' }, R(m, 'illust'))),
      T(`${m}월 인성 칭찬 카드`, 68, 11, 72, 7, { font: 'Jua', size: 14, color: ac, align: 'left', name: '머리글' }),
      T(v.virtue, 68, 19, 72, 14, Object.assign({ font: 'Black Han Sans', size: v.virtue.length > 4 ? 26 : 34, color: INK, align: 'left', lh: 1.1, name: '덕목' }, R(m, 'virtue'))),
      T('______________ 어린이는', 68, 38, 72, 7, { size: 12, weight: 500, color: '#2B2F3A', align: 'left', name: '이름 칸' }),
      T(`이번 달 「${v.virtue}」${josa(v.virtue, '을', '를')}\n멋지게 실천했어요!`, 68, 47, 72, 14, { size: 12, weight: 700, color: '#2B2F3A', align: 'left', lh: 1.45, name: '칭찬 글' }),
      T(`${v.idiom}(${v.hanja})`, 68, 64, 72, 6, Object.assign({ font: 'Gowun Batang', size: 11, weight: 700, color: ac, align: 'left', name: '사자성어' }, R(m, 'idiom'))),
      T(`${y}년 ${m}월`, 10, 82, 50, 6, { size: 10, weight: 500, color: '#4A5370', align: 'left', name: '날짜' }),
      I(logo(bg), 98, 80, 40, 9, { pos: '100% 50%', name: '로고' }),
    ], `${m}월 ${v.virtue}`); });
  }

  if (NC.tpl.facets && !NC.tpl.facets.occasion.includes('인성')) NC.tpl.facets.occasion.push('인성');
  const KINDS = [
    ['sns', '이달의 인성덕목 SNS 카드', 285.75, 357.19, 'sns', '카드뉴스', sns],
    ['poster', '이달의 인성덕목 포스터', 210, 297, 'poster', '포스터', poster],
    ['yearly', '인성덕목 연간 계획표', 297, 210, 'sheet', '안내문', yearly],
    ['praise', '인성 칭찬 카드', 148, 100, 'card', '명함·카드', praise],
  ];
  ['극기', '홍익'].forEach(tr => KINDS.forEach(([id, name, w, h, cat, fmt, fn]) => {
    const nm = `${name} · ${tr}(${TRACK[tr].yr}·${tr === '극기' ? '홀수' : '짝수'} 해)`;
    L.push({ id: `virtue-${id}-${TRACK[tr].id}`, cat, name: nm, w, h, virtue: tr, screen: cat === 'sns',
      tags: { format: fmt, season: '사계절', age: id === 'praise' ? '초등' : '전체', occasion: '인성', biz: '태권도장' },
      kw: [nm, '인성 인성덕목 덕목 삽화 라차 이달의', tr, TRACK[tr].theme, fmt, id === 'yearly' ? '계획 연간 12달' : '12쪽 달마다', '태권도장'].join(' '),
      build: uid => fn(uid, tr) });
  }));

  /* ===== 결제 단말기 화면 (800×1280 픽셀 · 세로) — 11/19 팀장님: 카카오페이 커넥트(수련비)·토스 프론트(용품) 배경 =====
     '결제' 같은 글은 넣지 않고 도장 CI·라차만 · 인성덕목 24개(극기 12 + 홍익 12)는 덕목·사자성어·라차 그림
     크기: 800×1280px = 211.67×338.67mm(96dpi) → 내려받기 PNG가 정확히 800×1280 */
  const DW = 800 * 25.4 / 96, DH = 1280 * 25.4 / 96, cx = w => (DW - w) / 2;
  const EMO = cp => `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/svg/emoji_u${cp}.svg`;
  const KICK = 'assets/virtue/racha-kick.webp';
  const NAVY = '#14213D', GOLD = '#C9A227';
  const frame2 = (S, c) => [S('rect', 8, 8, DW - 16, DH - 16, { fill: 'rgba(0,0,0,0)', stroke: c, strokeW: 0.7, name: '테두리' }), S('rect', 11.5, 11.5, DW - 23, DH - 23, { fill: 'rgba(0,0,0,0)', stroke: c, strokeW: 0.3, opacity: 0.8, name: '안쪽 테두리' })];
  const scatter = (I, cps, seed) => { let r = seed; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280; const spots = [[12, 16], [58, 30], [100, 12], [146, 28], [180, 48], [16, 306], [92, 312], [168, 304]]; return spots.map(([x, y], i) => { const sz = 14 + rnd() * 8;  /* 위·아래 가장자리만 (그림·로고와 안 겹치게) */ return I(EMO(cps[i % cps.length]), x, y, sz, sz, { rot: Math.round(rnd() * 50 - 25), opacity: 0.9, name: '꾸밈' }); }); };
  const CI = [
    ['premium-navy', '고급 · 네이비 골드', '고급', '사계절', (T, I, S, P) => P(NAVY, [...frame2(S, GOLD),
      I('asset:brand-since-white', cx(120), 104, 120, 101.7, { name: '로고' }),
      S('rect', cx(40), 222, 40, 0.5, { fill: GOLD, name: '금선' })], '고급 네이비')],
    ['premium-ivory', '고급 · 아이보리', '고급', '사계절', (T, I, S, P) => P('#F7F3EA', [...frame2(S, GOLD),
      I('asset:brand-symbol-gray', cx(130), 228, 130, 97.6, { opacity: 0.07, name: '워터마크' }),
      I('asset:brand-korean', cx(140), 122, 140, 70.7, { name: '로고' }),
      S('rect', cx(40), 206, 40, 0.5, { fill: GOLD, name: '금선' })], '고급 아이보리')],
    ['cute-yellow', '귀여운 · 라차 발차기', '귀여운', '사계절', (T, I, S, P) => P('#FFE89A', [
      S('ellipse', -30, -20, 110, 110, { fill: '#FFFFFF', opacity: 0.45, name: '동그라미' }), S('ellipse', 140, 250, 120, 120, { fill: '#FFFFFF', opacity: 0.45, name: '동그라미' }), S('ellipse', 150, 40, 40, 40, { fill: '#FFFFFF', opacity: 0.6, name: '동그라미' }),
      I(KICK, cx(150), 52, 150, 181, { name: '라차' }),
      I('asset:brand-horizontal', cx(150), 268, 150, 29, { name: '로고' })], '귀여운 노랑')],
    ['cute-sky', '귀여운 · 라차 인사', '귀여운', '사계절', (T, I, S, P) => P('#DDEFFB', [
      S('ellipse', 120, -40, 150, 150, { fill: '#FFFFFF', opacity: 0.5, name: '동그라미' }), S('ellipse', -50, 230, 140, 140, { fill: '#FFFFFF', opacity: 0.5, name: '동그라미' }),
      I(art('극기', 5), 15, 62, DW - 30, 170, { name: '라차' }),
      I('asset:brand-korean-navy', cx(110), 252, 110, 55.6, { name: '로고' })], '귀여운 하늘')],
    ['spring', '계절 · 봄', '귀여운', '봄', (T, I, S, P) => P('#FDE7EF', [...scatter(I, ['1f338', '1f337', '1f33c'], 3),
      I(art('극기', 3), 15, 70, DW - 30, 170, { name: '라차' }), I(logo('#FDE7EF'), cx(140), 272, 140, 27, { name: '로고' })], '봄')],
    ['summer', '계절 · 여름', '귀여운', '여름', (T, I, S, P) => P('#DDF4F7', [...scatter(I, ['2600', '1f349', '1f30a'], 7),
      I(art('극기', 7), 15, 70, DW - 30, 170, { name: '라차' }), I(logo('#DDF4F7'), cx(140), 272, 140, 27, { name: '로고' })], '여름')],
    ['autumn', '계절 · 가을', '귀여운', '가을', (T, I, S, P) => P('#FCEBD7', [...scatter(I, ['1f341', '1f342', '1f330'], 11),
      I(art('극기', 10), 15, 70, DW - 30, 170, { name: '라차' }), I(logo('#FCEBD7'), cx(140), 272, 140, 27, { name: '로고' })], '가을')],
    ['winter', '계절 · 겨울', '귀여운', '겨울', (T, I, S, P) => P('#E6EDF8', [...scatter(I, ['2744', '26c4', '1f381'], 13),
      I(art('극기', 12), 15, 70, DW - 30, 170, { name: '라차' }), I(logo('#E6EDF8'), cx(140), 272, 140, 27, { name: '로고' })], '겨울')],
  ];
  CI.forEach(([id, name, style, season, fn]) => L.push({ id: `dev-ci-${id}`, cat: 'device', name: `결제 단말기 배경 · ${name}`, w: DW, h: DH, screen: true,
    tags: { format: '단말기 화면', season, age: '전체', occasion: '안내', biz: '태권도장' }, kw: `결제 단말기 배경 화면 카카오페이 토스 커넥트 프론트 800 1280 로고 CI 라차 ${style} ${season} ${name}`,
    build: uid => { const { T, I, S, P } = H(uid); return [fn(T, I, S, P)]; } }));

  /* 인성덕목 24 — 극기 1~12월 + 홍익 1~12월 (덕목·영문·삽화·사자성어·풀이) */
  const both = () => ['극기', '홍익'].flatMap(tr => plan(tr).P.map((v, k) => ({ tr, m: k + 1, v })));
  function devCute(uid) { const { T, I, S, P } = H(uid); return both().map(({ tr, m, v }) => { const [bg, ac] = PAL[m - 1]; return P(bg, [
    S('ellipse', 130, -30, 120, 120, { fill: '#FFFFFF', opacity: 0.4, name: '동그라미' }),
    T(`${TRACK[tr].yr} ${tr} · ${m}월의 덕목`, 14, 20, DW - 28, 12, { font: 'Jua', size: 28, color: ac, name: '머리글' }),
    T(v.virtue, 10, 35, DW - 20, 38, Object.assign({ font: 'Black Han Sans', size: v.virtue.length > 4 ? 72 : 100, color: INK, lh: 1.1, name: '덕목' }, R(m, 'virtue'))),
    T(`(${v.en})`, 14, 75, DW - 28, 10, Object.assign({ font: 'Montserrat', size: 20, weight: 700, color: ac, ls: 0.1, name: '영문' }, R(m, 'en'))),
    S('rect', 16, 91, DW - 32, 160, { fill: WHITE, radius: 22, name: '그림 판' }),
    I(art(tr, m), 22, 97, DW - 44, 148, Object.assign({ pos: '50% 100%', name: '삽화' }, R(m, 'illust'))),
    T(`${v.idiom}(${v.hanja})`, 10, 260, DW - 20, 18, Object.assign({ font: 'Gowun Batang', size: 40, weight: 700, color: INK, name: '사자성어' }, R(m, 'idiom'))),
    T(v.meaning, 18, 282, DW - 36, 28, Object.assign({ size: 20, weight: 500, color: '#3A4563', lh: 1.4, name: '풀이' }, R(m, 'meaning'))),
    I(logo(bg), cx(80), 318, 80, 15.4, { name: '로고' }),
  ], `${tr} ${m}월 ${v.virtue}`); }); }
  /* 고급: 삽화를 원 안에 꽉 채움(원 모양으로 자름). 흰 바탕 극기 그림은 조금 줄여 머리 위 여백(아래쪽에 맞춤) — 11/20 팀장님 */
  const PFIT = { '극기': [0.86, 1, 0.86, 0.86, 0.86, 0.86, 0.86, 0.86, 1, 0.86, 1, 1] };
  const pfit = (tr, m) => { const z = (PFIT[tr] || [])[m - 1] || 1; return z === 1 ? { zoom: 1 } : { zoom: z, panY: Math.round(50 * (1 - z) * 10) / 10 }; };
  function devPremium(uid) { const { T, I, S, P } = H(uid); const CW = 156, CY = 40; return both().map(({ tr, m, v }) => P(NAVY, [...frame2(S, GOLD),
    T(`${TRACK[tr].yr} ${tr} · ${m}월의 덕목`, 14, 21, DW - 28, 9, { font: 'MaruBuri', size: 18, weight: 700, color: GOLD, ls: 0.12, name: '머리글' }),
    S('ellipse', cx(CW + 10), CY - 5, CW + 10, CW + 10, { fill: 'rgba(0,0,0,0)', stroke: GOLD, strokeW: 0.6, name: '금테' }),
    S('ellipse', cx(CW), CY, CW, CW, { fill: '#FFFFFF', name: '그림 원' }),
    I(art(tr, m), cx(CW), CY, CW, CW, Object.assign({ fit: 'cover', clip: 'circle', pos: '50% 50%', cardFit: 1, name: '삽화' }, pfit(tr, m), R(m, 'illust'))),
    T(v.virtue, 10, 205, DW - 20, 30, Object.assign({ font: 'Nanum Myeongjo ExtraBold', size: v.virtue.length > 4 ? 56 : 74, weight: 800, color: '#FFFFFF', lh: 1.1, ls: v.virtue.length > 4 ? 0.02 : 0.08, name: '덕목' }, R(m, 'virtue'))),
    T(v.en, 14, 236, DW - 28, 8, Object.assign({ font: 'Cinzel', size: 15, weight: 700, color: GOLD, ls: 0.28, name: '영문' }, R(m, 'en'))),
    S('rect', cx(14) - 12, 249.75, 14, 0.4, { fill: GOLD, name: '금선' }), S('rect', cx(14) + 12, 249.75, 14, 0.4, { fill: GOLD, name: '금선' }),
    S('rect', cx(2.4), 248.75, 2.4, 2.4, { fill: GOLD, rot: 45, name: '금 마름모' }),
    T(`${v.idiom}(${v.hanja})`, 10, 255, DW - 20, 16, Object.assign({ font: 'Noto Serif KR', size: 34, weight: 700, color: '#FFFFFF', ls: 0.02, name: '사자성어' }, R(m, 'idiom'))),
    T(v.meaning, 16, 274, DW - 32, 30, Object.assign({ font: 'MaruBuri', size: 16, weight: 400, color: '#C9CFDD', lh: 1.55, name: '풀이' }, R(m, 'meaning'))),
    I('asset:brand-horizontal-white', cx(70), 310, 70, 13.5, { name: '로고' }),
  ], `${tr} ${m}월 ${v.virtue}`)); }
  [['cute', '귀여운', devCute], ['premium', '고급', devPremium]].forEach(([id, nm, fn]) => L.push({ id: `dev-virtue-${id}`, cat: 'device', name: `결제 단말기 · 인성덕목 24 (${nm})`, w: DW, h: DH, screen: true,
    tags: { format: '단말기 화면', season: '사계절', age: '전체', occasion: '인성', biz: '태권도장' }, kw: `결제 단말기 화면 인성 인성덕목 덕목 24 극기 홍익 사자성어 라차 800 1280 ${nm}`, build: uid => fn(uid) }));
  if (NC.tpl.cats && !NC.tpl.cats.some(c => c[0] === 'device')) NC.tpl.cats.splice(Math.max(1, NC.tpl.cats.findIndex(c => c[0] === 'web')), 0, ['device', '결제 단말기']);
  if (NC.tpl.facets && !NC.tpl.facets.format.includes('단말기 화면')) NC.tpl.facets.format.push('단말기 화면');
})();
