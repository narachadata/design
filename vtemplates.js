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
    /* ---- 숏츠 전용 (2026 숏폼 흐름: 첫 1초에 큰 글자로 붙잡기 → 빠른 컷 → 마지막에 할 일 하나). 요소마다 들어오고 나가는 움직임을 달리해 눈이 따라가게 ---- */
    { id: 's-reasons', name: '이유 3가지 (정보형)', desc: '첫 화면 큰 질문 → 1·2·3 쾅 → 체험 신청', music: 'm-energy', sizes: ['916'], video: { dur: 3, trans: 'whip', turn: 0.35 }, build(S) {
      const g = geo(S), u = g.u, items = [['자신감이 자라요', '"나도 할 수 있어!"\n스스로 해낸 경험이 쌓여요', RED], ['집중력이 좋아져요', '구령에 맞춰 움직이며\n듣고 따르는 힘이 커져요', NAVY], ['예의가 몸에 배요', '인사로 시작해 인사로 끝나는\n매일의 습관', '#2F7D5B']];
      const out = [scene(NAVY, [R(g.cx - u * 22, u * 40, u * 44, u * 9, YEL, { radius: u * 4.5, anim: an('swipe', 0.05, 0.5) }), T('학부모님 필독', g.cx - u * 22, u * 41.6, u * 44, u * 5, { color: INK, anim: an('swipe', 0.05, 0.5) }), T('태권도를\n꼭 해야 하는\n이유 3가지', u * 6, u * 58, g.W - u * 12, u * 11, { font: 'YeogiOttaeJalnan', lh: 1.15, anim: an('wordslam', 0.35, 1.1) }), T('👇', 0, u * 112, g.W, u * 9, { anim: an('pop', 1.4, 0.4), animLoop: { t: 'bob', T: 0.8, a: 1.4 } })], { vcam: 'in', vcamA: 0.05, vdur: 2.6 })];
      items.forEach(([t1, t2, c], i) => out.push(scene(CREAM, [T(String(i + 1), 0, u * 30, g.W, u * 30, { font: 'Anton', weight: 400, color: c, anim: an('slam', 0, 0.45), animOut: { t: 'punch', s: 0.3, at: 0 } }), PH(u * 12, u * 72, g.W - u * 24, u * 34, { radius: u * 3, anim: an('punch', 0.35, 0.5) }), T(t1, u * 6, u * 110, g.W - u * 12, u * 8, { font: 'YeogiOttaeJalnan', color: INK, anim: an('mask', 0.55, 0.5) }), T(t2, u * 8, u * 122, g.W - u * 16, u * 4.6, { color: '#3B4253', weight: 600, lh: 1.4, anim: an('wordpop', 0.9, 0.9) })], { vtrans: i % 2 ? 'whip' : 'pullin', vcam: 'in', vcamA: 0.04 })));
      out.push(scene(NAVY, [logo(g.cx, u * 44, u * 64, true), T('지금 무료 체험', 0, u * 66, g.W, u * 10, { font: 'YeogiOttaeJalnan', anim: an('stretch', 0.2, 0.7) }), R(g.cx - u * 30, u * 88, u * 60, u * 13, YEL, { radius: u * 6.5, anim: an('pop', 0.6, 0.5), animLoop: { t: 'jelly', T: 0.9, a: 1.2 } }), T('프로필 링크에서 신청', g.cx - u * 30, u * 91.5, u * 60, u * 5.2, { color: INK, anim: an('pop', 0.6, 0.5), animLoop: { t: 'jelly', T: 0.9, a: 1.2 } })], { vdur: 3.4 }));
      return { pages: out, sfx: [{ ref: 'b:whoosh', at: 0.05 }, { ref: 'b:hit', at: 2.95 }, { ref: 'b:hit', at: 6.3 }, { ref: 'b:hit', at: 9.65 }, { ref: 'b:tada', at: 13.2 }] };
    } },
    { id: 's-review', name: '학부모님 후기 (신뢰)', desc: '별점 반짝 → 후기 카드가 단어씩 → 도장 로고', music: 'm-calm', sizes: ['916'], video: { dur: 4, trans: 'soft', turn: 0.6 }, build(S) {
      const g = geo(S), u = g.u, rv = [['"낯가리던 아이가\n먼저 인사를 해요"', '초등 2학년 학부모님'], ['"줄넘기 20개에서\n82개가 됐어요!"', '초등 4학년 학부모님'], ['"사범님들이 아이 마음을\n먼저 봐 주세요"', '7살 학부모님']];
      const out = [scene(CREAM, [T('실제 학부모님 후기', 0, u * 52, g.W, u * 9, { font: 'YeogiOttaeJalnan', color: NAVY, anim: an('mask', 0.1, 0.6) }), T('★★★★★', 0, u * 68, g.W, u * 8, { color: '#F5B301', anim: an('flash', 0.6, 0.6), animLoop: { t: 'glow', T: 1.2, a: 1.5 } }), T('나라차태권도', 0, u * 84, g.W, u * 5, { color: '#5B6170', weight: 600, anim: an('fade', 1, 0.6) })], { vdur: 2.8 })];
      rv.forEach(([q, who], i) => out.push(scene(i % 2 ? '#EEF3FF' : CREAM, [R(u * 7, u * 42, g.W - u * 14, u * 64, '#ffffff', { radius: u * 5, shadow: true, shC: '#1E2B5A', shA: 0.12, shX: 0, shY: 1.5, shB: 3, anim: an('rise', 0, 0.5) }), T('“', u * 12, u * 44, u * 20, u * 20, { font: 'Anton', weight: 400, color: YEL, align: 'left', anim: an('pop', 0.15, 0.4) }), T(q, u * 12, u * 62, g.W - u * 24, u * 6.4, { color: INK, lh: 1.35, anim: an('wordpop', 0.35, 1.2) }), T('★★★★★', u * 12, u * 86, g.W - u * 24, u * 4.6, { color: '#F5B301', anim: an('fade', 1.4, 0.4) }), T('— ' + who, u * 12, u * 94, g.W - u * 24, u * 4.2, { color: '#5B6170', weight: 600, anim: an('fade', 1.6, 0.5) })], { vcam: 'in', vcamA: 0.03 })));
      out.push(scene(NAVY, [T('믿고 맡기는', 0, u * 56, g.W, u * 6, { color: 'rgba(255,255,255,.8)', weight: 600, anim: an('rise', 0.1, 0.5) }), T('나라차태권도', 0, u * 66, g.W, u * 10, { font: 'YeogiOttaeJalnan', anim: an('charup', 0.3, 0.9) }), logo(g.cx, u * 86, u * 56, true)], { vdur: 3.2 }));
      out[out.length - 1].els[2].anim = an('fade', 1.1, 0.6);
      return { pages: out, sfx: [{ ref: 'b:bell', at: 0.6 }] };
    } },
    { id: 's-master', name: '관장·사범 소개 (신뢰)', desc: '사진 → 이름이 올라오고 → 자격이 차례로 → 한마디', music: 'm-calm', sizes: ['916'], video: { dur: 3.6, trans: 'slide', turn: 0.6 }, build(S) {
      const g = geo(S), u = g.u;
      const out = [scene(INK, [PH(0, u * 22, g.W, u * 92, { radius: 0, anim: an('fade', 0, 0.8) }), R(0, u * 96, g.W, u * 36, 'rgba(20,24,33,.82)', { anim: an('fade', 0.4, 0.5) }), T('안녕하세요!', u * 8, u * 100, g.W - u * 16, u * 6, { align: 'left', color: YEL, anim: an('mask', 0.6, 0.5) }), T('나라차태권도 관장 ○○○', u * 8, u * 110, g.W - u * 16, u * 7.4, { align: 'left', font: 'YeogiOttaeJalnan', anim: an('wordpop', 0.9, 0.8) })], { vcam: 'in', vcamA: 0.05, vdur: 3.8 }),
        scene(NAVY, [T('이런 사람이 가르칩니다', 0, u * 40, g.W, u * 6.5, { font: 'YeogiOttaeJalnan', anim: an('mask', 0, 0.5) })].concat(['국기원 공인 ○단', '태권도 지도자 자격 1급', '어린이 지도 경력 ○년', '응급처치·안전교육 수료'].flatMap((t, i) => [R(u * 10, u * (58 + i * 15), g.W - u * 20, u * 11, 'rgba(255,255,255,.1)', { radius: u * 3, anim: an('swipe', 0.4 + i * 0.3, 0.5) }), T('✓  ' + t, u * 14, u * (60.4 + i * 15), g.W - u * 28, u * 5.2, { align: 'left', weight: 700, anim: an('swipe', 0.45 + i * 0.3, 0.5) })])), { vdur: 4 }),
        scene(CREAM, [T('"인성이 먼저입니다.\n기술은 그 위에\n쌓입니다."', u * 8, u * 50, g.W - u * 16, u * 7.6, { font: 'YeogiOttaeJalnan', color: NAVY, lh: 1.35, anim: an('tilt', 0.1, 0.7) }), logo(g.cx, u * 100, u * 50)], { vdur: 3.4 })];
      out[2].els[1].anim = an('fade', 0.9, 0.5);
      return { pages: out, sfx: [{ ref: 'b:swoosh', at: 4.2 }] };
    } },
    { id: 's-challenge', name: '발차기 챌린지 (재미)', desc: '쾅! 챌린지 → 카운트 → 정답 공개 · 빠른 컷', music: 'm-drum', sizes: ['916'], video: { dur: 1.6, trans: 'flash', turn: 0.25 }, build(S) {
      const g = geo(S), u = g.u;
      const out = [scene(RED, [T('CHALLENGE', 0, u * 52, g.W, u * 13, { font: 'Anton', weight: 400, anim: an('slam', 0, 0.45), animLoop: { t: 'shake', T: 1, a: 0.5 } }), T('발차기 10초 챌린지', 0, u * 74, g.W, u * 7.4, { font: 'YeogiOttaeJalnan', color: YEL, anim: an('wordslam', 0.45, 0.8) })], { vtrans: 'glitch', vdur: 2.2 }),
        scene(INK, [PH(u * 6, u * 30, g.W - u * 12, u * 80, { radius: u * 4, anim: an('punch', 0, 0.4) }), T('몇 번 찼을까?', 0, u * 116, g.W, u * 8, { font: 'YeogiOttaeJalnan', anim: an('stretch', 0.3, 0.6), animLoop: { t: 'wiggle', T: 0.7, a: 1.3 } })], { vtrans: 'flash', vdur: 3 })];
      ['3', '2', '1'].forEach(n => out.push(scene(n === '2' ? YEL : NAVY, [T(n, 0, u * 58, g.W, u * 40, { font: 'Anton', weight: 400, color: n === '2' ? INK : '#fff', anim: an('slam', 0, 0.35), animOut: { t: 'punch', s: 0.2, at: 0 } })], { vtrans: 'flash', vdur: 0.75 })));
      out.push(scene(YEL, [T('정답은', 0, u * 52, g.W, u * 7, { color: INK, weight: 700, anim: an('mask', 0, 0.4) }), T('27번!', 0, u * 64, g.W, u * 22, { font: 'YeogiOttaeJalnan', color: RED, anim: an('slam', 0.3, 0.45), animLoop: { t: 'jelly', T: 0.6, a: 1.5 } }), T('🔥🔥🔥', 0, u * 96, g.W, u * 9, { anim: an('pop', 0.8, 0.4), animLoop: { t: 'bob', T: 0.6, a: 1.2 } }), T('너도 도전해 볼래?', 0, u * 112, g.W, u * 6, { color: INK, weight: 800, anim: an('wordpop', 1.1, 0.7) })], { vdur: 3.6 }));
      return { pages: out, sfx: [{ ref: 'b:boom', at: 0.05 }, { ref: 'b:drumroll', at: 2.5 }, { ref: 'b:hit', at: 5.8 }, { ref: 'b:hit', at: 6.8 }, { ref: 'b:hit', at: 7.8 }, { ref: 'b:tada', at: 9.1 }] };
    } },
    { id: 's-beforeafter', name: '비포·애프터 (향상왕)', desc: '전 → 후 사진을 나란히, 기록이 쾅 · 꾸준함 강조', music: 'm-bright', sizes: ['916'], video: { dur: 3.4, trans: 'wipe', turn: 0.5 }, build(S) {
      const g = geo(S), u = g.u, half = (g.W - u * 15) / 2;
      const out = [scene(NAVY, [T('BEFORE → AFTER', 0, u * 54, g.W, u * 9, { font: 'Anton', weight: 400, color: YEL, anim: an('slam', 0, 0.45) }), T('3개월 동안\n이만큼 달라졌어요', 0, u * 70, g.W, u * 7, { font: 'YeogiOttaeJalnan', lh: 1.25, anim: an('wordpop', 0.4, 0.9) })], { vdur: 2.6 }),
        scene(CREAM, [PH(u * 5, u * 34, half, u * 62, { radius: u * 3, anim: an('left', 0, 0.5) }), PH(u * 10 + half, u * 34, half, u * 62, { radius: u * 3, anim: an('right', 0.25, 0.5) }), R(u * 5, u * 34, u * 20, u * 7, INK, { radius: u * 1.5, anim: an('pop', 0.5, 0.3) }), T('BEFORE', u * 5, u * 35.3, u * 20, u * 4, { font: 'Anton', weight: 400, anim: an('pop', 0.5, 0.3) }), R(u * 10 + half, u * 34, u * 18, u * 7, RED, { radius: u * 1.5, anim: an('pop', 0.7, 0.3) }), T('AFTER', u * 10 + half, u * 35.3, u * 18, u * 4, { font: 'Anton', weight: 400, anim: an('pop', 0.7, 0.3) }), T('줄넘기 1분', 0, u * 102, g.W, u * 5.4, { color: '#5B6170', weight: 700, anim: an('fade', 1, 0.4) }), T('20회', u * 5, u * 110, half, u * 11, { font: 'Anton', weight: 400, color: '#8A90A0', anim: an('mask', 1.2, 0.4) }), T('→', g.cx - u * 5, u * 112, u * 10, u * 8, { color: INK, anim: an('swipe', 1.5, 0.3) }), T('82회', u * 10 + half, u * 108, half, u * 14, { font: 'Anton', weight: 400, color: RED, anim: an('slam', 1.7, 0.45), animLoop: { t: 'pulse', T: 0.8, a: 1.5 } })], { vdur: 4.6 }),
        scene(NAVY, [T('꾸준함이 만든 변화', 0, u * 58, g.W, u * 8, { font: 'YeogiOttaeJalnan', anim: an('charup', 0.1, 0.8) }), logo(g.cx, u * 80, u * 56, true)], { vdur: 3 })];
      out[2].els[1].anim = an('fade', 0.9, 0.5);
      return { pages: out, sfx: [{ ref: 'b:hit', at: 0.05 }, { ref: 'b:hit', at: 4.9 }, { ref: 'b:tada', at: 5.4 }] };
    } },
    { id: 's-quiz', name: '태권도 퀴즈 (재미)', desc: '질문 → 3·2·1 → 정답 → 댓글 유도', music: 'm-kids', sizes: ['916'], video: { dur: 3, trans: 'pullin', turn: 0.3 }, build(S) {
      const g = geo(S), u = g.u;
      const out = [scene(YEL, [T('Q.', 0, u * 40, g.W, u * 26, { font: 'Anton', weight: 400, color: NAVY, anim: an('slam', 0, 0.45) }), T('노란 띠는\n무엇을 뜻할까요?', u * 6, u * 72, g.W - u * 12, u * 8, { font: 'YeogiOttaeJalnan', color: INK, lh: 1.25, anim: an('wordpop', 0.4, 1) }), R(g.cx - u * 30, u * 102, u * 60, u * 6, '#F6C915', { stroke: '#B89200', strokeW: 0.6, radius: u * 1, anim: an('stretch', 1.2, 0.6), animLoop: { t: 'wiggle', T: 0.9, a: 1 } })], { vdur: 3.6 })];
      ['3', '2', '1'].forEach((n, i) => out.push(scene([NAVY, RED, '#2F7D5B'][i], [T(n, 0, u * 60, g.W, u * 38, { font: 'Anton', weight: 400, anim: an('punch', 0, 0.3), animOut: { t: 'pop', s: 0.2, at: 0 } })], { vtrans: 'flash', vdur: 0.7 })));
      out.push(scene(CREAM, [T('정답!', 0, u * 42, g.W, u * 10, { font: 'YeogiOttaeJalnan', color: RED, anim: an('flash', 0, 0.5) }), T('땅을 뚫고 나온 새싹처럼\n기초를 다지는 단계', u * 6, u * 62, g.W - u * 12, u * 6.4, { color: INK, lh: 1.35, anim: an('mask', 0.4, 0.6) }), T('🌱', 0, u * 86, g.W, u * 12, { anim: an('pop', 0.9, 0.5), animLoop: { t: 'tilt', T: 1.4, a: 1 } }), T('다음 퀴즈는 댓글로 맞혀 보세요 👇', u * 6, u * 108, g.W - u * 12, u * 4.8, { color: '#3B4253', weight: 700, anim: an('wordpop', 1.3, 0.8) })], { vdur: 4.2 }));
      return { pages: out, sfx: [{ ref: 'b:pop', at: 0.4 }, { ref: 'b:click', at: 3.9 }, { ref: 'b:click', at: 4.9 }, { ref: 'b:click', at: 5.9 }, { ref: 'b:tada', at: 6.9 }] };
    } },
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
      const g = geo(S), band = R(0, 0, g.W, g.u * (g.L ? 16 : 26), NAVY), head = (t) => g.L ? [band, T(t, g.u * 8, g.u * 4, g.W, g.u * 7, { align: 'left', font: 'GMarketSans', weight: 700 }), logo(g.W - g.u * 26, g.u * 4.5, g.u * 34, true)] : [band, logo(g.cx, g.u * 4, g.u * 34, true), T(t, g.u * 5, g.u * 13, g.W - g.u * 10, g.u * 9, { align: 'center', font: 'GMarketSans', weight: 700 })];  /* 세로 화면: 로고 위·제목 아래 가운데 (같은 줄이면 제목과 로고가 겹쳤음) */
      const rows = (list, y0) => list.map(([d, t], i) => g.L ? [T(d, g.u * 10, y0 + i * g.u * 12, g.u * 30, g.u * 5.4, { color: RED, align: 'left', font: 'GMarketSans', weight: 700, anim: an('left', 0.3 + i * 0.25, 0.5) }), T(t, g.u * 42, y0 + i * g.u * 12, g.W - g.u * 52, g.u * 5.4, { color: INK, align: 'left', weight: 600, anim: an('left', 0.3 + i * 0.25, 0.5) })]
        : [T(d, g.u * 10, y0 + i * g.u * 16, g.W - g.u * 20, g.u * 5.4, { color: RED, align: 'left', font: 'GMarketSans', weight: 700, anim: an('left', 0.3 + i * 0.25, 0.5) }), T(t, g.u * 10, y0 + i * g.u * 16 + g.u * 6.5, g.W - g.u * 20, g.u * 5.4, { color: INK, align: 'left', weight: 600, anim: an('left', 0.35 + i * 0.25, 0.5) })]).flat();  /* 세로 화면: 날짜 아래 내용(한 줄에 두면 내용이 두 줄로 접혀 다음 줄과 겹쳤음) */
      return { pages: [
        scene('#F6F8FC', head('11월 주요 일정').concat(rows([['11/3 (월)', '11월 수련 시작 · 인성 덕목 「배려」'], ['11/14 (금)', '승급심사 신청서 마감'], ['11/24 (월)', '정기 승급심사'], ['11/29 (토)', '가족 초청 시범 공연']], g.u * (g.L ? 26 : 36))), { vcam: 'in', vcamA: 0.03 }),
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
  // 숏츠·릴스 안전 영역: 세로(9:16) 화면은 위 약 12%(상태 표시·제목)와 아래 약 22%(설명·단추 줄)가 앱 화면에 가려짐
  // → 그 안에 들어간 글자·로고·작은 띠는 안전 영역 안으로 옮김(화면을 덮는 배경·사진은 그대로). 같은 줄의 띠와 글자는 함께 움직이도록 아래쪽부터 묶어서 옮김
  function safeShorts(pg, S) {
    const top = S.h * 0.12, bot = S.h * 0.78, big = e => e.h > S.h * 0.45 || (e.w >= S.w * 0.98 && e.h > S.h * 0.3);
    const inFrame = e => e.x >= -0.5 && e.y >= -0.5 && e.x + e.w <= S.w + 0.5 && e.y + e.h <= S.h + 0.5;  // 화면 밖으로 일부러 걸친 장식은 빼고
    (pg.els || []).forEach(e => { if (e.type === 'text' && e.x >= -0.5 && e.x < S.w * 0.5 && e.x + e.w > S.w + 0.5) e.w = Math.round(Math.max(20, S.w - e.x - Math.max(e.x, S.w * 0.05)) * 100) / 100; });  /* 화면 폭보다 넓은 글 상자(가로 화면용 제목)는 화면 안으로 줄여서 함께 옮김 — 전에는 '화면 밖 장식'으로 보고 맨 위 가려지는 곳에 남았음 */
    const els = (pg.els || []).filter(e => !big(e) && inFrame(e)); if (!els.length) return;
    const minY = Math.min(...els.map(e => e.y)), maxB = Math.max(...els.map(e => e.y + e.h));
    let d = 0; if (maxB > bot) d = -(maxB - bot); if (minY + d < top) d = top - minY; if (maxB + d > bot && minY + d > top) d = Math.max(top - minY, bot - maxB);  // 내용 묶음 전체를 같은 거리만큼 옮겨 간격 유지
    if (maxB - minY > bot - top) {  // 안전 영역보다 크면 묶음 전체를 비율대로 줄여 가운데에 (크기·간격·글자 크기 함께)
      const k = (bot - top) / (maxB - minY), cx = S.w / 2, r2 = v => Math.round(v * 100) / 100;
      els.forEach(e => { const ncx = cx + (e.x + e.w / 2 - cx) * k; e.w = r2(e.w * k); e.h = r2(e.h * k); e.x = r2(ncx - e.w / 2); e.y = r2(top + (e.y - minY) * k); if (e.size) e.size = Math.round(e.size * k * 10) / 10; if (e.strokeW) e.strokeW = r2(e.strokeW * k); if (e.radius) e.radius = r2(e.radius * k); });
      return;
    }
    if (Math.abs(d) > 0.5) els.forEach(e => { e.y = Math.round((e.y + d) * 100) / 100; });
  }
  function make(id, sizeKey) {
    const t = LIST.find(x => x.id === id); if (!t) return null; const S = SIZES[sizeKey] || SIZES['169'];
    const r = t.build(S);
    r.pages.forEach(pg => { pg.els = JSON.parse(JSON.stringify(pg.els || [])); });  /* 여러 장면이 같은 요소(머리 띠 등)를 함께 쓰면 장면마다 옮길 때 여러 번 옮겨졌음 — 장면마다 따로 */
    if (sizeKey === '916') r.pages.forEach(pg => safeShorts(pg, S));
    return { w: S.w, h: S.h, fmt: sizeKey === '916' ? 'story' : sizeKey === '45' ? 'ig45' : '', name: t.name, pages: r.pages, sfx: (r.sfx || []).map(x => Object.assign({ vol: 1, name: (NC.media.SOUNDS.find(s => 'b:' + s.id === x.ref) || {}).name || '효과음' }, x)), audio: t.music ? { src: 'b:' + t.music, name: (NC.media.SOUNDS.find(s => s.id === t.music) || {}).name || '', vol: 0.7, from: 0, fin: 0.5, fout: 2 } : null, video: Object.assign({ q: '1080', fps: 30, loop: false }, t.video) };
  }
  const total = (id, sizeKey) => { const r = make(id, sizeKey); if (!r) return 0; return r.pages.reduce((a, p, i) => a + Number(p.vdur || r.video.dur) + (i < r.pages.length - 1 || r.video.loop ? Number(r.video.turn || 0) : 0), 0); };
  return { SIZES, LIST, make, total };
})();
