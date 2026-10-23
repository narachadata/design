// 영상 템플릿 — TV·모니터·유튜브(16:9 1920×1080)와 쇼츠(9:16 1080×1920)에 맞춰 자동 배치되는 장면 묶음
// 2026 숏폼 흐름(움직이는 큰 글자·굵은 미니멀·세로 우선·빠른 컷·반복 시청)과 국기원 15초 홍보 형식(자막으로 효과 나열)을 참고.
// 각 템플릿: 장면(쪽)마다 요소·움직임·장면 길이·넘김 효과·카메라, 그리고 기본 음악·효과음. 글자는 모두 고쳐 쓰는 자리 글.
window.NC = window.NC || {};
NC.vtpl = (function () {
  const SIZES = { '169': { w: 508, h: 285.75, name: 'TV·유튜브 16:9', px: '1920×1080' }, '916': { w: 285.75, h: 508, name: '쇼츠·릴스 9:16', px: '1080×1920' }, '45': { w: 285.75, h: 357.19, name: 'SNS 4:5', px: '1080×1350' } };
  const NAVY = '#1E2B5A', RED = '#E0313B', YEL = '#FFD34D', INK = '#141821', CREAM = '#FFF8EC';
  const PT = 72 / 25.4;
  // ---- 요소 만들기 (단위 mm) ----
  const T = (text, x, y, w, mm, o) => Object.assign({ type: 'text', text, x, y, w, h: mm * 1.25 * (String(text).split('\n').length), size: Math.round(mm * PT * 10) / 10, font: 'Pretendard', weight: 800, color: '#ffffff', align: 'center', lh: 1.15, ls: -0.02 }, o || {});
  const R = (x, y, w, h, fill, o) => Object.assign({ type: 'shape', kind: 'rect', x, y, w, h, fill, radius: 0, strokeW: 0 }, o || {});
  const C = (x, y, d, fill, o) => Object.assign({ type: 'shape', kind: 'ellipse', x, y, w: d, h: d, fill, strokeW: 0 }, o || {});
  const IMG = (src, x, y, w, h, o) => Object.assign({ type: 'image', src, x, y, w, h, fit: 'contain', pos: '50% 50%' }, o || {});
  const PH = (x, y, w, h, o) => Object.assign({ type: 'image', src: '', x, y, w, h, fit: 'cover', pos: '50% 50%', radius: 3, name: '사진 자리' }, o || {});
  const an = (t, d, s) => ({ t, d: d || 0, s: s || 0.7 });
  const logo = (cx, y, w, white) => IMG(white ? 'asset:brand-horizontal-white' : 'asset:brand-horizontal', cx - w / 2, y, w, w / 5.19, { name: '나라차 로고' });
  const logoK = (cx, y, h, white) => IMG(white ? 'asset:brand-korean-white' : 'asset:brand-korean', cx - h * 1.98 / 2, y, h * 1.98, h, { name: '나라차 로고' });
  const mascot = (x, y, h, n) => IMG('asset:mascot-' + (n || '01'), x, y, h * 0.8, h, { name: '라차' });
  const scene = (bg, els, o) => Object.assign({ bg, els, label: '' }, o || {});
  // 크기 정보: 가로형이면 L, 세로형이면 P
  const geo = S => { const L = S.w > S.h, u = Math.min(S.w, S.h) / 100; return { W: S.w, H: S.h, L, u, cx: S.w / 2, cy: S.h / 2 }; };

  const LIST = [
    { id: 'kinetic', name: '키네틱 홍보 15초', desc: '큰 글자가 빠르게 바뀌는 2026 숏폼 대세', music: 'm-energy', video: { dur: 1.6, trans: 'flash', turn: 0.3 }, build(S) {
      const g = geo(S), big = g.u * (g.L ? 26 : 30), sub = g.u * 4.4, words = [['자신감', 'CONFIDENCE', NAVY], ['집중력', 'FOCUS', RED], ['체력', 'POWER', YEL], ['인성', 'CHARACTER', NAVY]];
      const out = [scene(INK, [T('태권도 하면?', 0, g.cy - big * 0.45, g.W, big * 0.55, { font: 'YeogiOttaeJalnan', anim: an('char', 0.1, 0.9) })], { vtrans: 'glitch', vcam: 'in' })];
      words.forEach(([k, e, c], i) => out.push(scene(c, [T(e, 0, g.cy - big * 0.95, g.W, sub, { font: 'Anton', weight: 400, ls: 0.3, color: c === YEL ? INK : 'rgba(255,255,255,.75)', anim: an('fade', 0.05, 0.4) }), T(k, 0, g.cy - big * 0.5, g.W, big, { font: 'YeogiOttaeJalnan', color: c === YEL ? INK : '#fff', anim: an('pop', 0, 0.45), animLoop: { t: 'pulse', T: 0.6, a: 1 } })], { vtrans: ['whip', 'pullin', 'glitch', 'flash'][i], vcam: 'in', vcamA: 0.08 })));
      out.push(scene(NAVY, [logo(g.cx, g.cy - g.u * (g.L ? 22 : 26), g.u * (g.L ? 60 : 70), true), T('나라차태권도', 0, g.cy - g.u * 2, g.W, g.u * 9, { font: 'YeogiOttaeJalnan', anim: an('rise', 0.2, 0.6) }), R(g.cx - g.u * 26, g.cy + g.u * 12, g.u * 52, g.u * 11, YEL, { radius: g.u * 5.5, anim: an('pop', 0.6, 0.5), animLoop: { t: 'pulse', T: 1, a: 1 } }), T('지금 무료 체험', g.cx - g.u * 26, g.cy + g.u * 14.2, g.u * 52, g.u * 5.6, { color: INK, anim: an('pop', 0.6, 0.5), animLoop: { t: 'pulse', T: 1, a: 1 } })], { vdur: 3.2 }));
      return { pages: out, sfx: [{ ref: 'b:whoosh', at: 1.5 }, { ref: 'b:hit', at: 1.9 }, { ref: 'b:hit', at: 3.8 }, { ref: 'b:hit', at: 5.7 }, { ref: 'b:hit', at: 7.6 }, { ref: 'b:tada', at: 9.6 }] };
    } },
    { id: 'intro', name: '도장 소개', desc: '로고 등장 · 특징 3가지 · 연락처', music: 'm-bright', video: { dur: 3.5, trans: 'soft', turn: 0.8 }, build(S) {
      const g = geo(S), out = [];
      out.push(scene(NAVY, [C(g.cx - g.u * 60, g.cy - g.u * 60, g.u * 120, 'rgba(255,255,255,.06)', { anim: an('zoom', 0, 1.2) }), logo(g.cx, g.cy - g.u * 12, g.u * (g.L ? 70 : 80), true), T('바른 마음 · 튼튼한 몸 · 함께 자라는 도장', 0, g.cy + g.u * 6, g.W, g.u * 4.6, { weight: 600, color: 'rgba(255,255,255,.9)', anim: an('type', 0.9, 1.4) })], { vcam: 'in' }));
      const feats = [['01', '체계적인 커리큘럼', '급수별 맞춤 수련'], ['02', '인성 교육', '매달 인성 덕목 실천'], ['03', '안전한 차량 운행', '집 앞까지 안전하게']];
      const cards = []; feats.forEach(([n, a, b], i) => { const cw = g.L ? g.u * 44 : g.u * 80, ch = g.L ? g.u * 46 : g.u * 26, x = g.L ? g.cx - cw * 1.5 - g.u * 4 + i * (cw + g.u * 4) : g.cx - cw / 2, y = g.L ? g.cy - ch / 2 + g.u * 6 : g.u * 32 + i * (ch + g.u * 5); const A = an('rise', 0.25 + i * 0.25, 0.6), grp = 'f' + i; cards.push(R(x, y, cw, ch, '#ffffff', { radius: g.u * 3, anim: A, group: grp }), T(n, x, y + g.u * 3, cw, g.u * 7, { font: 'Bebas Neue', weight: 400, color: RED, anim: A, group: grp }), T(a, x, y + (g.L ? g.u * 16 : g.u * 11), cw, g.u * 5.2, { color: NAVY, anim: A, group: grp }), T(b, x, y + (g.L ? g.u * 25 : g.u * 18), cw, g.u * 3.6, { weight: 500, color: '#5b6478', anim: A, group: grp })); });
      out.push(scene('#EEF2FA', [T('나라차태권도는', 0, g.L ? g.u * 8 : g.u * 14, g.W, g.u * 7, { color: NAVY, font: 'GMarketSans', weight: 700, anim: an('rise', 0, 0.6) })].concat(cards), { vdur: 4.5 }));
      out.push(scene(CREAM, [mascot(g.L ? g.cx - g.u * 60 : g.cx - g.u * 24, g.L ? g.cy - g.u * 30 : g.u * 18, g.u * 60, '03'), T('아이와 함께\n자라는 도장', g.L ? g.cx - g.u * 8 : 0, g.L ? g.cy - g.u * 12 : g.u * 84, g.L ? g.u * 70 : g.W, g.u * 9, { color: NAVY, font: 'YeogiOttaeJalnan', align: g.L ? 'left' : 'center', anim: an('line', 0.3, 0.9) })], { vcam: 'in' }));
      out.push(scene(NAVY, [T('상담 · 체험 문의', 0, g.cy - g.u * 18, g.W, g.u * 5, { weight: 600, color: YEL, anim: an('fade', 0, 0.5) }), T('010-0000-0000', 0, g.cy - g.u * 9, g.W, g.u * 11, { font: 'GMarketSans', weight: 700, anim: an('char', 0.3, 0.9) }), T('경기도 성남시 분당구 ○○로 00', 0, g.cy + g.u * 6, g.W, g.u * 4.4, { weight: 500, color: 'rgba(255,255,255,.8)', anim: an('fade', 0.8, 0.6) }), logo(g.cx, g.H - g.u * 16, g.u * 40, true)], { vdur: 4 }));
      return { pages: out, sfx: [{ ref: 'b:swoosh', at: 0 }] };
    } },
    { id: 'recruit', name: '수강생 모집 카운트다운', desc: '3·2·1 숫자와 무료 체험 버튼', music: 'm-energy', video: { dur: 1, trans: 'flash', turn: 0.25 }, build(S) {
      const g = geo(S), out = [];
      out.push(scene(YEL, [T('NEW MEMBERS', 0, g.cy - g.u * 22, g.W, g.u * 6, { font: 'Anton', weight: 400, ls: 0.25, color: INK, anim: an('fade', 0, 0.4) }), T('신규 수련생\n모집', 0, g.cy - g.u * 13, g.W, g.u * (g.L ? 14 : 16), { font: 'YeogiOttaeJalnan', color: INK, anim: an('char', 0.2, 1) })], { vdur: 2.4, vcam: 'in' }));
      ['3', '2', '1'].forEach((n, i) => out.push(scene([NAVY, RED, INK][i], [T(n, 0, g.cy - g.u * 30, g.W, g.u * 48, { font: 'Anton', weight: 400, anim: an('zoomout', 0, 0.35) })], {})));
      out.push(scene(NAVY, [T('지금 신청하면', 0, g.cy - g.u * 26, g.W, g.u * 5.4, { weight: 600, color: 'rgba(255,255,255,.85)', anim: an('rise', 0, 0.5) }), T('무료 체험 수업', 0, g.cy - g.u * 17, g.W, g.u * 12, { font: 'YeogiOttaeJalnan', color: YEL, anim: an('pop', 0.2, 0.5) }), T('11월 1일 ~ 11월 30일 · 5세 ~ 성인', 0, g.cy + g.u * 0.5, g.W, g.u * 4.6, { weight: 600, anim: an('fade', 0.6, 0.5) }), R(g.cx - g.u * 28, g.cy + g.u * 12, g.u * 56, g.u * 11, RED, { radius: g.u * 5.5, anim: an('pop', 0.9, 0.5), animLoop: { t: 'pulse', T: 0.9, a: 1.2 } }), T('전화 010-0000-0000', g.cx - g.u * 28, g.cy + g.u * 14.4, g.u * 56, g.u * 5, { anim: an('pop', 0.9, 0.5), animLoop: { t: 'pulse', T: 0.9, a: 1.2 } }), logo(g.cx, g.H - g.u * 14, g.u * 34, true)], { vdur: 4.5 }));
      return { pages: out, sfx: [{ ref: 'b:riser', at: 0 }, { ref: 'b:boom', at: 2.65 }, { ref: 'b:boom', at: 3.9 }, { ref: 'b:boom', at: 5.15 }, { ref: 'b:tada', at: 6.4 }] };
    } },
    { id: 'effects4', name: '태권도 효과 4가지', desc: '국기원 15초 형식 — 자막으로 효과 나열', music: 'm-bright', video: { dur: 2.6, trans: 'slide', turn: 0.4 }, build(S) {
      const g = geo(S), out = [scene(NAVY, [T('태권도,\n이렇게 좋아요', 0, g.cy - g.u * 14, g.W, g.u * 12, { font: 'YeogiOttaeJalnan', anim: an('line', 0, 0.9) })], { vcam: 'in' })];
      [['집중력 UP', '정해진 동작을 익히며 집중하는 힘이 자라요'], ['체력 UP', '유산소와 근력을 함께 기르는 전신 운동'], ['자신감 UP', '승급할 때마다 쌓이는 성취의 경험'], ['인성 UP', '예의와 배려를 몸으로 배우는 시간']].forEach(([a, b], i) => out.push(scene(i % 2 ? CREAM : '#fff', [PH(g.L ? g.u * 8 : g.u * 10, g.L ? g.u * 10 : g.u * 10, g.L ? g.W * 0.48 : g.W - g.u * 20, g.L ? g.H - g.u * 20 : g.H * 0.45, { kb: { t: 'in', a: 0.12 } }), C(g.L ? g.W * 0.56 : g.u * 10, g.L ? g.u * 26 : g.H * 0.5 + g.u * 6, g.u * 14, RED, { anim: an('pop', 0.1, 0.4) }), T(String(i + 1), g.L ? g.W * 0.56 : g.u * 10, g.L ? g.u * 28.4 : g.H * 0.5 + g.u * 8.4, g.u * 14, g.u * 7.5, { font: 'Anton', weight: 400, anim: an('pop', 0.1, 0.4) }), T(a, g.L ? g.W * 0.56 : g.u * 10, g.L ? g.u * 44 : g.H * 0.5 + g.u * 24, g.L ? g.W * 0.4 : g.W - g.u * 20, g.u * 10, { font: 'YeogiOttaeJalnan', color: NAVY, align: 'left', anim: an('char', 0.3, 0.7) }), T(b, g.L ? g.W * 0.56 : g.u * 10, g.L ? g.u * 60 : g.H * 0.5 + g.u * 40, g.L ? g.W * 0.38 : g.W - g.u * 20, g.u * 4.6, { weight: 600, color: '#4b5468', align: 'left', lh: 1.4, anim: an('word', 0.8, 1) })], {})));
      out.push(scene(NAVY, [logo(g.cx, g.cy - g.u * 10, g.u * 60, true), T('지금 시작해 보세요', 0, g.cy + g.u * 6, g.W, g.u * 6, { anim: an('type', 0.4, 1) })], { vdur: 3 }));
      return { pages: out, sfx: [] };
    } },
    { id: 'tips3', name: '쇼츠 3가지 팁', desc: '단어씩 나오는 자막 · 세로 우선', music: 'm-lofi', video: { dur: 3.2, trans: 'up', turn: 0.35 }, sizes: ['916', '169'], build(S) {
      const g = geo(S), cap = (t, y, o) => T(t, g.u * 6, y, g.W - g.u * 12, g.u * 8, Object.assign({ font: 'YeogiOttaeJalnan', color: '#fff', strokeW: 4, strokeC: INK, anim: an('word', 0.1, 0.8) }, o || {}));
      const out = [scene(INK, [PH(0, 0, g.W, g.H, { radius: 0, kb: { t: 'in', a: 0.15 }, opacity: 0.6 }), cap('아이가 운동을\n싫어한다면?', g.cy - g.u * 16), T('3가지 방법', 0, g.cy + g.u * 6, g.W, g.u * 9, { font: 'YeogiOttaeJalnan', color: YEL, anim: an('pop', 0.9, 0.5) })], {})];
      [['칭찬은 구체적으로', '"발차기가 높아졌네!"'], ['작은 목표부터', '이번 주는 줄넘기 50개'], ['친구와 함께', '함께하면 더 오래가요']].forEach(([a, b], i) => out.push(scene(INK, [PH(0, 0, g.W, g.H, { radius: 0, kb: { t: ['left', 'right', 'up'][i], a: 0.12 }, opacity: 0.55 }), T(String(i + 1), 0, g.cy - g.u * 34, g.W, g.u * 18, { font: 'Anton', weight: 400, color: YEL, anim: an('pop', 0, 0.4) }), cap(a, g.cy - g.u * 8), T(b, 0, g.cy + g.u * 12, g.W, g.u * 5, { weight: 700, color: '#fff', anim: an('fade', 1, 0.5) })], {})));
      out.push(scene(NAVY, [cap('더 궁금하면\n상담받아 보세요!', g.cy - g.u * 18), logo(g.cx, g.cy + g.u * 10, g.u * 50, true)], { vdur: 3 }));
      return { pages: out, sfx: [{ ref: 'b:pop', at: 3.5 }, { ref: 'b:pop', at: 7 }, { ref: 'b:pop', at: 10.6 }] };
    } },
    { id: 'monthly', name: '이달의 일정 (TV)', desc: '도장 TV 반복 재생용 안내', music: 'm-calm', video: { dur: 6, trans: 'soft', turn: 1, loop: true }, sizes: ['169', '916'], build(S) {
      const g = geo(S), band = R(0, 0, g.W, g.u * 16, NAVY), head = (t) => [band, T(t, g.u * 8, g.u * 4, g.W, g.u * 7, { align: 'left', font: 'GMarketSans', weight: 700 }), logo(g.W - g.u * 26, g.u * 4.5, g.u * 34, true)];
      const rows = (list, y0) => list.map(([d, t], i) => [T(d, g.u * 10, y0 + i * g.u * 12, g.u * 30, g.u * 5.4, { color: RED, align: 'left', font: 'GMarketSans', weight: 700, anim: an('left', 0.3 + i * 0.25, 0.5) }), T(t, g.u * 42, y0 + i * g.u * 12, g.W - g.u * 52, g.u * 5.4, { color: INK, align: 'left', weight: 600, anim: an('left', 0.3 + i * 0.25, 0.5) })]).flat();
      return { pages: [
        scene('#F6F8FC', head('11월 주요 일정').concat(rows([['11/3 (월)', '11월 수련 시작 · 인성 덕목 「배려」'], ['11/14 (금)', '승급심사 신청서 마감'], ['11/24 (월)', '정기 승급심사'], ['11/29 (토)', '가족 초청 시범 공연']], g.u * 26)), { vcam: 'in', vcamA: 0.03 }),
        scene('#FFF6F4', head('휴관 안내').concat([T('11월 17일 (월)', 0, g.cy - g.u * 10, g.W, g.u * 10, { font: 'YeogiOttaeJalnan', color: RED, anim: an('pop', 0.2, 0.5) }), T('도장 내부 공사로 하루 쉽니다', 0, g.cy + g.u * 4, g.W, g.u * 5.4, { color: INK, weight: 600, anim: an('fade', 0.6, 0.6) })]), { vcam: 'in', vcamA: 0.03 }),
        scene('#F6FBF6', head('이달의 인성 덕목').concat([mascot(g.L ? g.u * 14 : g.cx - g.u * 20, g.L ? g.u * 26 : g.u * 22, g.u * 50, '04'), T('배려', g.L ? g.cx - g.u * 10 : 0, g.L ? g.u * 34 : g.u * 76, g.L ? g.W * 0.55 : g.W, g.u * 16, { font: 'YeogiOttaeJalnan', color: '#2F5D3A', anim: an('char', 0.3, 0.8) }), T('다른 사람의 마음을 먼저 생각해요', g.L ? g.cx - g.u * 10 : 0, g.L ? g.u * 56 : g.u * 98, g.L ? g.W * 0.55 : g.W, g.u * 5.4, { color: INK, weight: 600, anim: an('type', 1, 1.2) })]), { vcam: 'in', vcamA: 0.03 }),
      ], sfx: [] };
    } },
    { id: 'promotion', name: '승급심사 축하', desc: '축하 효과와 합격자 이름', music: 'm-kids', video: { dur: 4, trans: 'iris', turn: 0.7 }, build(S) {
      const g = geo(S), conf = []; for (let i = 0; i < 14; i++) { const x = (i * 37 % 100) / 100 * g.W, y = (i * 53 % 100) / 100 * g.H * 0.9, c = [YEL, RED, '#5BC0EB', '#9BC53D'][i % 4]; conf.push(R(x, y, g.u * 2.2, g.u * 4, c, { rot: i * 37 % 180, radius: g.u * 0.6, anim: an('drop', i * 0.05, 0.6), animLoop: { t: 'float', T: 1.4 + (i % 3) * 0.3, a: 1.2 } })); }
      const names = ['김○○', '이○○', '박○○', '최○○', '정○○', '강○○'], nameEls = names.map((n, i) => { const cols = g.L ? 3 : 2, cw = (g.W - g.u * 20) / cols, x = g.u * 10 + (i % cols) * cw, y = g.cy - g.u * 6 + Math.floor(i / cols) * g.u * 12; return T(n, x, y, cw, g.u * 7, { color: NAVY, font: 'GMarketSans', weight: 700, anim: an('pop', 0.3 + i * 0.12, 0.4) }); });
      return { pages: [
        scene(NAVY, conf.concat([T('CONGRATULATIONS', 0, g.cy - g.u * 22, g.W, g.u * 5.4, { font: 'Anton', weight: 400, ls: 0.25, color: YEL, anim: an('fade', 0, 0.5) }), T('승급을\n축하합니다!', 0, g.cy - g.u * 13, g.W, g.u * 13, { font: 'YeogiOttaeJalnan', anim: an('bounce', 0.2, 0.9) })]), { vcam: 'in' }),
        scene(CREAM, [T('11월 승급심사 합격', 0, g.L ? g.u * 14 : g.u * 30, g.W, g.u * 7, { color: RED, font: 'YeogiOttaeJalnan', anim: an('rise', 0, 0.5) })].concat(nameEls), { vdur: 5 }),
        scene('#EAF2FF', [mascot(g.cx - g.u * 22, g.L ? g.u * 10 : g.u * 26, g.u * 54, '05'), T('다음 띠를 향해 파이팅!', 0, g.L ? g.H - g.u * 24 : g.u * 90, g.W, g.u * 7, { color: NAVY, font: 'YeogiOttaeJalnan', anim: an('char', 0.4, 0.8) })], { vcam: 'in' }),
      ], sfx: [{ ref: 'b:tada', at: 0.3 }, { ref: 'b:clap', at: 4.7 }] };
    } },
    { id: 'contest', name: '대회 결과 하이라이트', desc: '사진 천천히 움직이기 + 메달', music: 'm-drum', video: { dur: 3.5, trans: 'pullin', turn: 0.6 }, build(S) {
      const g = geo(S);
      const photo = (cap, i) => scene(INK, [PH(0, 0, g.W, g.H, { radius: 0, kb: { t: ['in', 'left', 'out', 'right'][i % 4], a: 0.14 } }), R(0, g.H - g.u * 22, g.W, g.u * 22, 'rgba(10,12,18,.65)'), T(cap, g.u * 8, g.H - g.u * 16, g.W - g.u * 16, g.u * 6, { align: 'left', font: 'GMarketSans', weight: 700, anim: an('word', 0.3, 0.8) })], {});
      return { pages: [
        scene(INK, [T('2026 경희대 라이온스컵', 0, g.cy - g.u * 22, g.W, g.u * 5, { weight: 700, color: YEL, anim: an('fade', 0, 0.5) }), T('대회 결과', 0, g.cy - g.u * 14, g.W, g.u * 15, { font: 'YeogiOttaeJalnan', anim: an('zoomout', 0.2, 0.6) }), T('금 3 · 은 4 · 동 5', 0, g.cy + g.u * 6, g.W, g.u * 7, { font: 'GMarketSans', weight: 700, anim: an('char', 0.8, 0.8) })], { vcam: 'in' }),
        photo('품새 개인전 금메달 — 김○○', 0), photo('겨루기 단체전 준우승', 1), photo('끝까지 최선을 다한 우리 선수들', 2),
        scene(NAVY, [T('모두 수고했어요!', 0, g.cy - g.u * 10, g.W, g.u * 11, { font: 'YeogiOttaeJalnan', anim: an('bounce', 0, 0.9) }), logo(g.cx, g.cy + g.u * 8, g.u * 44, true)], { vdur: 3 }),
      ], sfx: [{ ref: 'b:drumroll', at: 0.2 }] };
    } },
    { id: 'slideshow', name: '오늘의 수련 사진', desc: '사진 슬라이드 · 천천히 움직이기', music: 'm-lofi', video: { dur: 3, trans: 'fade', turn: 0.8 }, build(S) {
      const g = geo(S), caps = ['오늘의 수련', '발차기 연습', '품새 집중!', '다 함께 기합!', '수고했어요'];
      return { pages: caps.map((c, i) => scene('#111', [PH(0, 0, g.W, g.H, { radius: 0, kb: { t: ['in', 'right', 'out', 'left', 'in'][i], a: 0.12 } }), R(g.u * 6, g.H - g.u * 18, g.u * (8 + c.length * 5.4), g.u * 10, i === 0 ? RED : '#ffffff', { radius: g.u * 5, anim: an('left', 0.3, 0.5) }), T(c, g.u * 6, g.H - g.u * 16.4, g.u * (8 + c.length * 5.4), g.u * 5.6, { color: i === 0 ? '#fff' : INK, anim: an('left', 0.3, 0.5) })].concat(i === 0 ? [logo(g.W - g.u * 26, g.u * 6, g.u * 40, true)] : []), {})), sfx: [{ ref: 'b:shutter', at: 0.1 }] };
    } },
    { id: 'notice', name: '공지 TV 대기화면', desc: '깔끔한 카드 · 반복 재생', music: '', video: { dur: 7, trans: 'slide', turn: 0.8, loop: true }, sizes: ['169', '916'], build(S) {
      const g = geo(S), card = (k, title, body, c) => scene('#EEF1F6', [R(g.u * 6, g.u * 6, g.W - g.u * 12, g.H - g.u * 12, '#fff', { radius: g.u * 4, shadow: true, shA: 0.1 }), R(g.u * 6, g.u * 6, g.u * 3, g.H - g.u * 12, c), T('공지 ' + k, g.u * 16, g.u * 14, g.W, g.u * 5, { align: 'left', color: c, font: 'GMarketSans', weight: 700, anim: an('fade', 0, 0.5) }), T(title, g.u * 16, g.u * 22, g.W - g.u * 32, g.u * 10, { align: 'left', color: INK, font: 'YeogiOttaeJalnan', anim: an('rise', 0.2, 0.6) }), T(body, g.u * 16, g.u * (g.L ? 42 : 46), g.W - g.u * 32, g.u * 5, { align: 'left', color: '#4b5468', weight: 500, lh: 1.6, anim: an('line', 0.6, 1) }), logo(g.W - g.u * 34, g.H - g.u * 16, g.u * 24)], { vcam: 'in', vcamA: 0.02 });
      return { pages: [card('01', '겨울 차량 시간 변경', '12월 1일부터 차량 출발이 10분씩 빨라집니다.\n자세한 시간표는 단톡방을 확인해 주세요.', NAVY), card('02', '도복 교환 안내', '작아진 도복은 데스크에서 교환할 수 있어요.\n사이즈를 미리 알려 주세요.', RED), card('03', '실내화를 챙겨 주세요', '도장 안에서는 맨발 · 대기실은 실내화', '#2F7D5B')], sfx: [] };
    } },
    { id: 'birthday', name: '생일 축하', desc: '풍선이 둥실 · 이름이 톡톡', music: 'm-kids', video: { dur: 4.5, trans: 'zoom', turn: 0.6 }, build(S) {
      const g = geo(S), balloons = []; for (let i = 0; i < 7; i++) { const d = g.u * (12 + (i % 3) * 4), x = (i + 0.3) / 7 * g.W - d / 2, y = g.H * (0.08 + (i % 2) * 0.12); balloons.push(C(x, y, d, ['#FF6B8B', YEL, '#5BC0EB', '#9BC53D', '#B084F5'][i % 5], { anim: an('rise', i * 0.08, 0.8), animLoop: { t: 'float', T: 1.8 + (i % 3) * 0.4, a: 1.5 } })); }
      return { pages: [
        scene('#FFF3F6', balloons.concat([T('HAPPY BIRTHDAY', 0, g.cy - g.u * 4, g.W, g.u * (g.L ? 14 : 11), { font: 'Bagel Fat One', weight: 400, color: '#E54B6B', anim: an('char', 0.4, 1) }), T('11월 생일을 축하해요!', 0, g.cy + g.u * 14, g.W, g.u * 6, { color: NAVY, font: 'GMarketSans', weight: 700, anim: an('fade', 1.2, 0.6) })]), { vcam: 'in' }),
        scene('#FFF9E8', [T('11월의 주인공', 0, g.L ? g.u * 12 : g.u * 26, g.W, g.u * 7, { color: '#E54B6B', font: 'YeogiOttaeJalnan', anim: an('rise', 0, 0.5) })].concat(['김○○', '이○○', '박○○', '최○○'].map((n, i) => { const cols = g.L ? 4 : 2, cw = (g.W - g.u * 16) / cols, x = g.u * 8 + (i % cols) * cw, y = g.cy - g.u * 4 + Math.floor(i / cols) * g.u * 14; return T(n, x, y, cw, g.u * 7, { color: NAVY, font: 'GMarketSans', weight: 700, anim: an('pop', 0.4 + i * 0.15, 0.4) }); }), [mascot(g.cx - g.u * 12, g.H - g.u * 34, g.u * 30, '07')]), { vdur: 5 }),
      ], sfx: [{ ref: 'b:pop', at: 0.2 }, { ref: 'b:tada', at: 1.2 }] };
    } },
    { id: 'outro', name: '유튜브 엔딩', desc: '구독·좋아요 단추가 두근두근', music: 'm-bright', video: { dur: 8, trans: 'none', turn: 0 }, sizes: ['169'], build(S) {
      const g = geo(S), bw = g.u * 34;
      return { pages: [scene(INK, [T('시청해 주셔서 감사합니다', 0, g.u * 10, g.W, g.u * 7, { font: 'YeogiOttaeJalnan', anim: an('type', 0, 1.2) }), PH(g.u * 10, g.u * 26, g.W * 0.36, g.W * 0.36 * 9 / 16, { name: '다음 영상 자리', anim: an('left', 0.6, 0.6) }), PH(g.W * 0.54 - g.u * 4, g.u * 26, g.W * 0.36, g.W * 0.36 * 9 / 16, { name: '추천 영상 자리', anim: an('right', 0.8, 0.6) }), R(g.cx - bw - g.u * 3, g.H - g.u * 24, bw, g.u * 11, RED, { radius: g.u * 2, anim: an('pop', 1.4, 0.5), animLoop: { t: 'pulse', T: 1, a: 1.3 } }), T('구독', g.cx - bw - g.u * 3, g.H - g.u * 21.6, bw, g.u * 5.4, { anim: an('pop', 1.4, 0.5), animLoop: { t: 'pulse', T: 1, a: 1.3 } }), R(g.cx + g.u * 3, g.H - g.u * 24, bw, g.u * 11, '#ffffff', { radius: g.u * 2, anim: an('pop', 1.7, 0.5) }), T('좋아요 👍', g.cx + g.u * 3, g.H - g.u * 21.6, bw, g.u * 5.4, { color: INK, anim: an('pop', 1.7, 0.5) })], {})], sfx: [{ ref: 'b:click', at: 1.6 }, { ref: 'b:click', at: 1.9 }] };
    } },
    { id: 'vacation', name: '방학 특강', desc: '흐릿하게 나타나는 제목 · 프로그램 소개', music: 'm-bright', video: { dur: 3.8, trans: 'wipe', turn: 0.7 }, build(S) {
      const g = geo(S), out = [scene('#DDEBFF', [C(g.W - g.u * 40, -g.u * 20, g.u * 70, '#ffffff', { opacity: 0.6, animLoop: { t: 'float', T: 3, a: 1 } }), T('WINTER CAMP', 0, g.cy - g.u * 20, g.W, g.u * 6, { font: 'Anton', weight: 400, ls: 0.2, color: '#3F6FD8', anim: an('fade', 0, 0.6) }), T('겨울방학 특강', 0, g.cy - g.u * 12, g.W, g.u * 14, { font: 'YeogiOttaeJalnan', color: NAVY, anim: an('blur', 0.2, 0.9) }), T('12월 29일 ~ 1월 30일', 0, g.cy + g.u * 6, g.W, g.u * 6, { weight: 700, color: NAVY, anim: an('fade', 0.9, 0.5) })], { vcam: 'in' })];
      [['줄넘기 급수제', '한 달 만에 2단 뛰기 도전'], ['스포츠 데이', '피구 · 발야구 · 협동 놀이'], ['품새 집중반', '승급심사 대비 반복 수련']].forEach(([a, b], i) => out.push(scene(i % 2 ? '#fff' : '#F2F6FF', [T('PROGRAM ' + (i + 1), 0, g.cy - g.u * 20, g.W, g.u * 5, { font: 'Bebas Neue', weight: 400, ls: 0.2, color: RED, anim: an('fade', 0, 0.4) }), T(a, 0, g.cy - g.u * 12, g.W, g.u * 11, { font: 'YeogiOttaeJalnan', color: NAVY, anim: an('char', 0.1, 0.7) }), T(b, 0, g.cy + g.u * 4, g.W, g.u * 5.4, { weight: 600, color: '#4b5468', anim: an('word', 0.7, 0.8) })], {})));
      out.push(scene(NAVY, [T('선착순 마감!', 0, g.cy - g.u * 14, g.W, g.u * 11, { font: 'YeogiOttaeJalnan', color: YEL, anim: an('pop', 0, 0.5), animLoop: { t: 'shake', a: 0.6 } }), T('문의 010-0000-0000', 0, g.cy + g.u * 2, g.W, g.u * 6, { weight: 700, anim: an('fade', 0.4, 0.5) }), logo(g.cx, g.H - g.u * 16, g.u * 40, true)], {}));
      return { pages: out, sfx: [] };
    } },
    { id: 'holiday', name: '명절 인사', desc: '보름달이 둥실 · 휴관 안내', music: 'm-calm', video: { dur: 4.5, trans: 'fade', turn: 1 }, build(S) {
      const g = geo(S), moon = g.u * (g.L ? 46 : 60);
      return { pages: [
        scene('#1B2440', [C(g.cx - moon / 2, g.L ? g.u * 8 : g.u * 24, moon, '#FFE6A3', { anim: an('fade', 0, 1.4), animLoop: { t: 'float', T: 4, a: 0.8 } }), T('풍성한 한가위', 0, g.L ? g.u * 60 : g.u * 92, g.W, g.u * 12, { font: 'YeogiOttaeJalnan', color: '#FFE6A3', anim: an('blur', 0.6, 1.2) }), T('가족과 함께 따뜻한 추석 보내세요', 0, g.L ? g.u * 76 : g.u * 110, g.W, g.u * 5, { weight: 600, color: 'rgba(255,255,255,.85)', anim: an('type', 1.4, 1.4) })], { vcam: 'in' }),
        scene(CREAM, [T('추석 연휴 휴관', 0, g.cy - g.u * 18, g.W, g.u * 10, { font: 'YeogiOttaeJalnan', color: RED, anim: an('rise', 0, 0.6) }), T('9월 24일 (목) ~ 9월 27일 (일)', 0, g.cy - g.u * 3, g.W, g.u * 6.5, { font: 'GMarketSans', weight: 700, color: INK, anim: an('char', 0.4, 0.8) }), T('9월 28일 (월)부터 정상 수업합니다', 0, g.cy + g.u * 10, g.W, g.u * 4.8, { weight: 600, color: '#4b5468', anim: an('fade', 1.2, 0.6) }), logo(g.cx, g.H - g.u * 16, g.u * 40)], { vcam: 'in' }),
      ], sfx: [{ ref: 'b:bell', at: 0.3 }] };
    } },
  ];
  // 크기별로 장면 만들기: 문서 요소 형식으로 다듬어 돌려줌 (id·그림 정리는 공방이 함)
  function make(id, sizeKey) {
    const t = LIST.find(x => x.id === id); if (!t) return null; const S = SIZES[sizeKey] || SIZES['169'];
    const r = t.build(S);
    return { w: S.w, h: S.h, fmt: sizeKey === '916' ? 'story' : sizeKey === '45' ? 'ig45' : '', name: t.name, pages: r.pages, sfx: (r.sfx || []).map(x => Object.assign({ vol: 1, name: (NC.media.SOUNDS.find(s => 'b:' + s.id === x.ref) || {}).name || '효과음' }, x)), audio: t.music ? { src: 'b:' + t.music, name: (NC.media.SOUNDS.find(s => s.id === t.music) || {}).name || '', vol: 0.7, from: 0, fin: 0.5, fout: 2 } : null, video: Object.assign({ q: '1080', fps: 30, loop: false }, t.video) };
  }
  const total = (id, sizeKey) => { const r = make(id, sizeKey); if (!r) return 0; return r.pages.reduce((a, p, i) => a + Number(p.vdur || r.video.dur) + (i < r.pages.length - 1 || r.video.loop ? Number(r.video.turn || 0) : 0), 0); };
  return { SIZES, LIST, make, total };
})();
