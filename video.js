// 영상 만들기 — 디자인의 쪽을 장면으로: 요소 애니메이션(나타나기·사라지기·계속 움직이기·글자 효과)·넘김 효과·카메라·배경 음악 → MP4
// 캡컷(CapCut)의 편집 방식을 참고. 그리기: 쪽마다 '고정 요소 묶음'과 '움직이는 요소'를 층(캔버스)으로 한 번만 그려 두고
// (움직이는 층은 요소 상자 크기로 잘라 둠) 매 프레임 층을 변형해 겹쳐 그림. 무작위 효과는 시각으로 정해 미리보기와 저장본이 같음.
window.NC = window.NC || {};
NC.video = (function () {
  const ANIMS = [['none', '없음'], ['fade', '나타나기'], ['rise', '떠오르기'], ['drop', '내려오기'], ['left', '왼쪽에서'], ['right', '오른쪽에서'], ['zoom', '커지며'], ['zoomout', '작아지며'], ['pop', '톡 튀어나오기'], ['bounce', '통통 튀며'], ['spin', '돌며 나타나기'], ['flip', '뒤집으며'], ['blur', '흐릿하게'], ['wipe', '펼치기'], ['slam', '쾅 내려찍기'], ['punch', '줌 펀치'], ['stretch', '쫀득 늘어나기'], ['swipe', '휙 들어오기'], ['mask', '가림막에서 올라오기'], ['glitch', '지지직'], ['flash', '번쩍'], ['roll', '굴러오기'], ['tilt', '기울며 들어오기']];
  const TEXT_ANIMS = [['type', '타자기'], ['char', '한 글자씩'], ['word', '단어씩'], ['line', '한 줄씩'], ['wordpop', '단어씩 톡 (숏츠 자막)'], ['wordslam', '단어씩 쾅'], ['charpop', '한 글자씩 톡'], ['charup', '한 글자씩 올라오기']];
  const OUTS = [['none', '없음'], ['fade', '사라지기'], ['rise', '위로 사라지기'], ['drop', '아래로 사라지기'], ['left', '왼쪽으로'], ['right', '오른쪽으로'], ['zoom', '작아지며'], ['zoomout', '커지며 사라지기'], ['spin', '돌며 사라지기'], ['blur', '흐릿하게'], ['wipe', '걷어 내기'], ['pop', '톡 작아지며'], ['punch', '펑 커지며'], ['swipe', '휙 나가기'], ['mask', '아래로 숨기'], ['glitch', '지지직 사라지기'], ['flash', '번쩍 사라지기']];
  const LOOPS = [['none', '없음'], ['pulse', '두근두근'], ['float', '둥실둥실'], ['swing', '흔들흔들'], ['shake', '부르르'], ['blink', '깜빡깜빡'], ['spin', '빙글빙글'], ['beat', '쿵쿵'], ['wiggle', '꿈틀꿈틀'], ['jelly', '말랑말랑'], ['bob', '통통'], ['tilt', '갸웃갸웃'], ['glow', '반짝반짝']];
  const KBS = [['none', '없음'], ['in', '천천히 다가가기'], ['out', '천천히 물러나기'], ['left', '왼쪽으로 흐르기'], ['right', '오른쪽으로 흐르기'], ['up', '위로 흐르기'], ['down', '아래로 흐르기']];
  const CAMS = [['none', '없음'], ['in', '천천히 다가가기'], ['out', '천천히 물러나기'], ['left', '왼쪽으로 흐르기'], ['right', '오른쪽으로 흐르기']];
  const TRANS = [['soft', '부드럽게 넘김'], ['fade', '겹치며 바뀜'], ['slide', '옆으로 밀기'], ['bounce', '밀고 튕기기'], ['up', '위로 밀기'], ['zoom', '다가오며'], ['pullin', '당겨 들어가기'], ['pullout', '물러나기'], ['whip', '휙 넘기기'], ['spin', '빙글 돌며'], ['blur', '흐려지며 바뀜'], ['flash', '번쩍'], ['black', '검게 넘김'], ['iris', '원으로 열기'], ['wipe', '닦아내기'], ['blinds', '블라인드'], ['glitch', '지지직'], ['shake', '흔들며 바뀜'], ['none', '바로 바뀜'],
    ['cover', '덮으며 들어오기'], ['split', '가운데 갈라짐'], ['page', '책장 넘기기'], ['peel', '모서리 넘기기'], ['flip', '뒤집기'], ['cube', '상자 돌리기'], ['doors', '문 열기'], ['clock', '시계 닦기'], ['checker', '바둑판'], ['heart', '하트로 열기'], ['star', '별로 열기'], ['leak', '빛 번짐'], ['mosaic', '모자이크'], ['wave', '물결']];
  // 고르는 창의 묶음 (프리미어·파이널컷 분류를 쉬운 말로). 'up'은 예전 문서용 — 이제 '옆으로 밀기 ↑'
  const TRANS_CATS = [['basic', '기본', ['soft', 'fade', 'black', 'flash', 'none']], ['push', '밀기', ['slide', 'bounce', 'cover', 'whip', 'split']], ['move', '확대·회전', ['zoom', 'pullin', 'pullout', 'spin', 'blur']], ['shape', '닦기·모양', ['wipe', 'iris', 'clock', 'blinds', 'checker', 'heart', 'star']], ['paper', '종이·입체', ['page', 'peel', 'flip', 'cube', 'doors']], ['fx', '효과', ['leak', 'mosaic', 'wave', 'glitch', 'shake']]];
  // 방향을 고를 수 있는 넘김: l = 다음 장면이 오른쪽에서(왼쪽으로 감), r = 왼쪽에서, u = 아래에서 위로, d = 위에서 아래로
  const TRANS_DIRS = { slide: 'lrud', bounce: 'lrud', cover: 'lrud', whip: 'lrud', wipe: 'lrud', page: 'lr', peel: 'lr', cube: 'lr' };
  const TRANS_NOTE = { flash: '화면이 밝게 번쩍여요 — 자주 쓰지 마세요', glitch: '깜빡임이 있어요 — 자주 쓰지 마세요', heart: '가끔 쓰기 좋아요', star: '가끔 쓰기 좋아요', cube: '가끔 쓰기 좋아요', peel: '가끔 쓰기 좋아요' };
  const TRANS_MIX = ['soft', 'fade', 'slide', 'cover', 'zoom', 'wipe', 'page', 'iris'];  // 골고루 섞기: 무난한 것만
  const DEF = { dur: 5, trans: 'soft', turn: 0.8, loop: false, q: '1080', fps: 30 };
  const ease = t => 1 - Math.pow(1 - t, 3);
  const back = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const bounceOut = t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
  const io = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const expoIO = p => p === 0 ? 0 : p === 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const rnd = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); }; // 시각으로 정하는 난수(같은 결과)
  const has = (o) => !!(o && o.t && o.t !== 'none');
  const hasAnim = el => has(el.anim);
  const moves = el => el.type === 'video' || has(el.anim) || has(el.animOut) || has(el.animLoop) || has(el.kb);

  // 출력 크기: 짧은 변 1080(또는 720·2160), 긴 변은 1920(1280·3840)까지. 짝수로(H.264 규칙)
  function outSize(w, h, q) {
    const S = q === '720' ? 720 : q === '2160' ? 2160 : 1080, L = q === '720' ? 1280 : q === '2160' ? 3840 : 1920;
    let W, H; if (w >= h) { H = S; W = S * w / h; if (W > L) { W = L; H = L * h / w; } } else { W = S; H = S * h / w; if (H > L) { H = L; W = L * w / h; } }
    W = Math.round(W / 2) * 2; H = Math.round(H / 2) * 2; return { W, H };
  }

  // 장면 만들기. o = { doc, pages:[{pg, i}], W, H, renderLayers([{pg, sets:[{els, withBg, crop, measure}]}], dpi, onProgress, cancelled) → Promise<canvas[][]> }
  async function build(o) {
    const V = Object.assign({}, DEF, o.doc.video || {}), dpi = o.W / (o.doc.w / 25.4), kx = o.W / o.doc.w, ky = o.H / o.doc.h, W = o.W, H = o.H;
    const boxOf = e => { const a = (e.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s2 = Math.abs(Math.sin(a)), w = e.w * c + e.h * s2, h = e.w * s2 + e.h * c; return { x: e.x + e.w / 2 - w / 2, y: e.y + e.h / 2 - h / 2, w, h }; };
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const key = e => (e.group || e.id) + '|' + JSON.stringify([e.anim && e.anim.t, e.animOut && e.animOut.t, e.animLoop && e.animLoop.t, e.kb && e.kb.t]);
    const pad = Math.round(Math.max(W, H) * 0.02);
    // 1) 쪽마다 층 나누기: 움직이는 요소는 (같은 묶음·같은 설정끼리) 한 층씩, 고정 요소는 맨 아래 한 층.
    //    움직이는 요소 위에 겹쳐 있던 고정 요소는 위쪽 층으로 올려 가려지지 않게 → 층 수 = 움직임 수 + 2 이하
    const plans = o.pages.map(({ pg }) => {
      const els = pg.els.filter(e => !e.hidden), base = [], top = [], movers = [];
      els.forEach(el => {
        if (moves(el)) { const k2 = key(el), last = movers[movers.length - 1]; if (last && last.k === k2 && !isTextFx(el)) last.els.push(el); else movers.push({ k: k2, els: [el], el }); return; }
        const b = boxOf(el); (movers.some(m => m.els.some(m2 => hit(boxOf(m2), b))) ? top : base).push(el);
      });
      movers.forEach(m => { const bs = m.els.map(boxOf), x0 = Math.min(...bs.map(b => b.x)), y0 = Math.min(...bs.map(b => b.y)), x1 = Math.max(...bs.map(b => b.x + b.w)), y1 = Math.max(...bs.map(b => b.y + b.h)); m.box = { x: x0 * kx, y: y0 * ky, w: (x1 - x0) * kx, h: (y1 - y0) * ky }; m.crop = { x: Math.floor(m.box.x - pad), y: Math.floor(m.box.y - pad), w: Math.ceil(m.box.w + pad * 2), h: Math.ceil(m.box.h + pad * 2) }; });
      const sets = [{ els: base, withBg: true }].concat(movers.map(m => ({ els: m.els, crop: m.crop, measure: isTextFx(m.el) ? m.el.id : null, skip: m.el.type === 'video' })), top.length ? [{ els: top }] : []);
      return { pg, movers, top, sets };
    });
    // 2) 모든 층을 몇 번에 나눠 한꺼번에 그림 (글꼴을 매번 다시 읽지 않도록, 바뀌지 않은 층은 캐시)
    const cvsAll = await o.renderLayers(plans.map(p => ({ pg: p.pg, sets: p.sets })), dpi, o.onProgress, o.cancelled);
    if (!cvsAll) return null;
    const scenes = [];
    for (let pi = 0; pi < plans.length; pi++) { const P = plans[pi];
      const cvs = cvsAll[pi], pg = P.pg, layers = [{ cv: cvs[0], ox: 0, oy: 0 }];
      for (let mi = 0; mi < P.movers.length; mi++) { const m = P.movers[mi];
        const e = m.el, cv = cvs[mi + 1], c = m.crop;
        const L = { cv, ox: c.x, oy: c.y, box: m.box, cx: m.box.x + m.box.w / 2, cy: m.box.y + m.box.h / 2, anim: has(e.anim) ? e.anim : null, out: has(e.animOut) ? e.animOut : null, loop: has(e.animLoop) ? e.animLoop : null, kb: has(e.kb) ? e.kb : null };
        if (L.kb) { L.kbox = { x: e.x * kx, y: e.y * ky, w: e.w * kx, h: e.h * ky }; }
        if (cv && cv.__units) { L.units = cv.__units.map(u => Object.assign({}, u, { x: u.x - c.x, y: u.y - c.y })); L.lines = linesOf(L.units); }
        if (e.type === 'video') { L.video = { el: e, kx, sp: Math.max(0.1, Math.min(4, Number(e.speed || 1))), box: { x: e.x * kx, y: e.y * ky, w: e.w * kx, h: e.h * ky }, rad: Number(e.radius || 0) * kx, tin: Number(e.tin || 0), tout: Number(e.tout || e.dur || 0), loop: !!e.loop, d0: e.anim ? Number(e.anim.d || 0) : 0 }; L.vEl = o.videoEl ? await o.videoEl(e) : null; }
        layers.push(L);
      }
      if (P.top.length) layers.push({ cv: cvs[cvs.length - 1], ox: 0, oy: 0 });
      const tr = pg.vtrans || V.trans, turn = tr === 'none' ? 0 : Number(pg.vturn || V.turn);
      scenes.push({ dur: Number(pg.vdur || V.dur), trans: tr, tdir: pg.vtrans ? (pg.vdir || '') : (V.tdir || ''), turn, layers, bg: pg.bg || '#ffffff', cam: typeof pg.vcam === 'string' ? (pg.vcam !== 'none' && pg.vcam ? { t: pg.vcam, a: Number(pg.vcamA || 0.06), p: pg.vcamP } : null) : (has(pg.vcam) ? Object.assign({}, pg.vcam, { p: pg.vcamP }) : null) });
    }
    if (!V.loop && scenes.length) scenes[scenes.length - 1].turn = 0; // 마지막 장면은 넘김 없이 끝
    const videos = []; scenes.forEach(sc => sc.layers.forEach(L => { if (L.vEl) videos.push(L.vEl); }));
    return { scenes, videos, W, H, loop: V.loop, total: scenes.reduce((a, s) => a + s.dur + s.turn, 0) };
  }
  // 장면 시간표 (타임라인·미리보기·저장이 같은 규칙): pages=[{pg,i}] → [{pg,i,t0,dur,turn,trans}], total
  function timing(doc, pages) {
    const V = Object.assign({}, DEF, doc.video || {}); let t = 0;
    const list = pages.map(({ pg, i }, k) => { const tr = pg.vtrans || V.trans, last = k === pages.length - 1, turn = tr === 'none' || (last && !V.loop) ? 0 : Number(pg.vturn || V.turn), dur = Number(pg.vdur || V.dur), r = { pg, i, t0: t, dur, turn, trans: tr }; t += dur + turn; return r; });
    return { list, total: t };
  }
  const isTextFx = el => el.type === 'text' && el.anim && TEXT_ANIMS.some(t => t[0] === el.anim.t);
  function linesOf(units) { const L = []; units.forEach((u, i) => { const l = L[u.line] || (L[u.line] = { x0: Infinity, x1: -Infinity, y: Infinity, y1: -Infinity, first: i, last: i }); l.x0 = Math.min(l.x0, u.x); l.x1 = Math.max(l.x1, u.x + u.w); l.y = Math.min(l.y, u.y); l.y1 = Math.max(l.y1, u.y + u.h); l.last = i; }); return L.filter(Boolean); }

  // 한 동작의 모양: 진행률 e(0→1, 1이면 원래 자리)에서 투명도·이동·크기·회전·흐림
  const cubicOut = p => 1 - Math.pow(1 - p, 3), expoOut = p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p), elasticOut = p => p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  function poseIn(t, e, p, W, H) {
    const o = { al: 1, dx: 0, dy: 0, s: 1, sx: 1, sy: 1, rot: 0, blur: 0, wipe: 1, mask: 1, bright: 1 };
    switch (t) {
      case 'fade': o.al = e; break;
      case 'rise': o.al = e; o.dy = (1 - e) * H * 0.06; break;
      case 'drop': o.al = e; o.dy = -(1 - e) * H * 0.06; break;
      case 'left': o.al = e; o.dx = -(1 - back(p)) * W * 0.08; break;
      case 'right': o.al = e; o.dx = (1 - back(p)) * W * 0.08; break;
      case 'zoom': o.al = e; o.s = 0.6 + 0.4 * e; break;
      case 'zoomout': o.al = e; o.s = 1.4 - 0.4 * e; break;
      case 'pop': o.al = clamp01(p * 3); o.s = Math.max(0.01, 0.3 + 0.7 * back(p)); break;
      case 'bounce': o.al = clamp01(p * 4); o.dy = -(1 - bounceOut(p)) * H * 0.08; break;
      case 'spin': o.al = e; o.rot = -Math.PI / 2 * (1 - e); o.s = 0.5 + 0.5 * e; break;
      case 'flip': o.al = clamp01(p * 2); o.sx = Math.max(0.02, Math.sin(Math.PI / 2 * e)); break;
      case 'blur': o.al = e; o.blur = 14 * (1 - e); break;
      case 'wipe': o.wipe = e; break;
      /* 숏츠용 (캡컷·릴스에서 많이 쓰는 움직임) */
      case 'slam': { const c = cubicOut(p); o.al = clamp01(p * 5); o.s = 1 + 1.3 * (1 - c); o.blur = 6 * (1 - c); if (p > 0.55 && p < 1) { const k = Math.floor(p * 60); o.dx = (rnd(k, 7) - 0.5) * W * 0.012 * (1 - p) / 0.45; o.dy = (rnd(k, 8) - 0.5) * H * 0.008 * (1 - p) / 0.45; } break; }  /* 크게 날아와 쾅 박히고 살짝 흔들림 */
      case 'punch': o.al = clamp01(p * 4); o.s = 1.35 - 0.35 * back(p); break;  /* 확 커졌다 제자리 */
      case 'stretch': { const q = elasticOut(p); o.al = clamp01(p * 4); o.sx = Math.max(0.05, 0.25 + 0.75 * q); o.sy = 1.35 - 0.35 * q; break; }  /* 옆으로 쫀득하게 늘어나며 */
      case 'swipe': { const q = expoOut(p); o.al = clamp01(p * 3); o.dx = -(1 - q) * W * 0.55; o.sx = 1 + 0.25 * (1 - q); o.blur = 9 * (1 - q); break; }  /* 빠르게 휙 + 잔상 */
      case 'mask': o.mask = cubicOut(p); break;  /* 보이지 않는 선 아래에서 쑥 올라옴 */
      case 'glitch': { const k = Math.floor(p * 24); o.dx = (rnd(k, 3) - 0.5) * W * 0.05 * (1 - p); o.al = p < 0.75 ? (rnd(k, 4) > 0.35 ? 1 : 0.25) : 1; o.sx = 1 + (rnd(k, 5) - 0.5) * 0.25 * (1 - p); break; }
      case 'flash': o.al = clamp01(p * 4); o.bright = 1 + 2.4 * (1 - e); o.s = 1 + 0.06 * (1 - e); break;
      case 'roll': o.al = e; o.dx = -(1 - e) * W * 0.3; o.rot = -2 * Math.PI * (1 - e); break;
      case 'tilt': o.al = e; o.rot = -0.3 * (1 - back(p)); o.dy = (1 - e) * H * 0.04; break;
    }
    return o;
  }
  function poseLoop(t, lp, W, H, tt) {
    const T = Math.max(0.2, Number(lp.T || 1.2)), a = Number(lp.a || 1), o = { al: 1, dx: 0, dy: 0, s: 1, sx: 1, sy: 1, rot: 0, bright: 1, pivotTop: false }, ph = 2 * Math.PI * tt / T;
    switch (lp.t) {
      case 'pulse': o.s = 1 + 0.04 * a * Math.pow(Math.sin(Math.PI * tt / T), 2); break;
      case 'float': o.dy = 0.012 * H * a * Math.sin(ph); break;
      case 'swing': o.rot = 4 * a * Math.PI / 180 * Math.sin(ph); o.pivotTop = true; break;
      case 'shake': { const k = Math.floor(tt * 20); o.dx = (rnd(k, 1) - 0.5) * 6 * a; o.dy = (rnd(k, 2) - 0.5) * 6 * a; break; }
      case 'blink': o.al = 0.55 + 0.45 * Math.cos(ph); break;
      case 'spin': o.rot = 2 * Math.PI * tt / T; break;
      case 'wiggle': o.rot = 3 * a * Math.PI / 180 * Math.sin(ph * 2); o.dx = 0.004 * W * a * Math.sin(ph * 3); break;
      case 'jelly': { const w = Math.sin(ph); o.sx = 1 + 0.05 * a * w; o.sy = 1 - 0.05 * a * w; break; }
      case 'bob': o.dy = -Math.abs(Math.sin(ph / 2)) * H * 0.014 * a; break;
      case 'tilt': o.rot = 6 * a * Math.PI / 180 * Math.sin(ph); break;
      case 'glow': o.bright = 1 + 0.22 * a * (0.5 + 0.5 * Math.sin(ph)); break;
      case 'beat': { const q = (tt % T) / T, b = q < 0.12 ? Math.sin(q / 0.12 * Math.PI) : q > 0.2 && q < 0.32 ? 0.6 * Math.sin((q - 0.2) / 0.12 * Math.PI) : 0; o.s = 1 + 0.06 * a * b; break; }
    }
    return o;
  }
  // 층 하나를 장면 시각 t(초)에 그림 (D = 장면 길이)
  function drawLayer(x, L, t, D, W, H) {
    if (!L.cv && !L.video) return;
    if (!L.video && !L.anim && !L.out && !L.loop && !L.kb) { x.drawImage(L.cv, L.ox, L.oy); return; }
    let al = 1, dx = 0, dy = 0, s = 1, sx = 1, sy = 1, rot = 0, blur = 0, wipe = 1, unwipe = 0, mask = 1, bright = 1, pivotTop = false, pIn = 1;
    const mix = o => { al *= o.al; dx += o.dx; dy += o.dy; s *= o.s; sx *= (o.sx || 1); sy *= (o.sy || 1); rot += o.rot; blur = Math.max(blur, o.blur || 0); if (o.wipe != null) wipe = Math.min(wipe, o.wipe); if (o.mask != null) mask = Math.min(mask, o.mask); if (o.bright) bright *= o.bright; if (o.pivotTop) pivotTop = true; };
    const A = L.anim;
    if (A) { const d = Number(A.d || 0), sp = Math.max(0.05, Number(A.s || 0.8)); pIn = clamp01((t - d) / sp); if (!L.units) { if (pIn <= 0) return; if (pIn < 1) mix(poseIn(A.t, ease(pIn), pIn, W, H)); } }
    if (L.out) { const so = Math.max(0.05, Number(L.out.s || 0.6)), at = Number(L.out.at || 0), pO = clamp01((t - (D - at - so)) / so); if (pO >= 1) return; if (pO > 0) { if (L.out.t === 'wipe') unwipe = ease(pO); else mix(poseIn(L.out.t, ease(1 - pO), 1 - pO, W, H)); } }
    if (L.loop && pIn >= 1) mix(poseLoop(t, L.loop, W, H, t - (A ? Number(A.d || 0) + Number(A.s || 0.8) : 0)));
    x.save(); if (al < 1) x.globalAlpha = x.globalAlpha * Math.max(0, al); { const fl = (blur > 0.3 ? `blur(${blur.toFixed(1)}px) ` : '') + (Math.abs(bright - 1) > 0.01 ? `brightness(${bright.toFixed(2)})` : ''); if (fl) x.filter = fl.trim(); }
    if (mask < 1 && L.box) { const b = L.box; x.beginPath(); x.rect(b.x - 6, b.y - 6, b.w + 12, b.h + 12); x.clip(); dy += (1 - mask) * (b.h + 12); }  /* 가림막: 상자 밖은 보이지 않고 아래에서 올라옴 */
    const px = L.cx, py = pivotTop ? L.box.y : L.cy;
    if (dx || dy || s !== 1 || sx !== 1 || sy !== 1 || rot) { x.translate(px + dx, py + dy); if (rot) x.rotate(rot); x.scale(s * sx, s * sy); x.translate(-px, -py); }
    if (wipe < 1 || unwipe > 0) { const b = L.box; x.beginPath(); x.rect(b.x - 4 + (b.w + 8) * unwipe, b.y - 4, (b.w + 8) * (wipe - unwipe), b.h + 8); x.clip(); }
    if (L.kb) { // 사진 천천히 움직이기: 사진 상자 안에서 확대·이동
      const b = L.kbox, p0 = L.kb.p0 != null ? Number(L.kb.p0) : 0, p1 = L.kb.p1 != null ? Number(L.kb.p1) : 1, u = p0 + (p1 - p0) * clamp01(t / Math.max(0.1, D)), a = Number(L.kb.a || 0.12), k = L.kb.t; /* p0~p1: 장면을 나눈 조각이 움직임의 어느 구간인지(나눈 자리에서 이어짐) */
      const sc = k === 'out' ? 1 + a * (1 - u) : 1 + a * (k === 'in' ? u : 0.5), mx = (k === 'left' ? -1 : k === 'right' ? 1 : 0) * a * b.w / 2 * (u - 0.5), my = (k === 'up' ? -1 : k === 'down' ? 1 : 0) * a * b.h / 2 * (u - 0.5);
      x.beginPath(); x.rect(b.x, b.y, b.w, b.h); x.clip(); const kcx = b.x + b.w / 2, kcy = b.y + b.h / 2; x.translate(kcx + mx, kcy + my); x.scale(sc, sc); x.translate(-kcx, -kcy);
    }
    if (L.video) drawVideo(x, L); else if (L.units && A) drawUnits(x, L, t, A); else x.drawImage(L.cv, L.ox, L.oy);
    x.restore();
  }
  // 동영상 층: 지금 프레임을 상자에 채워(cover/contain) 그림. 둥근 모서리
  // 색 보정(그림과 같은 el.fx: 밝기·대비·채도·색조·흐림·흑백·세피아) → 캔버스 filter
  function vFilter(el, kx) { const s = NC.fx && NC.fx.imageFilter ? NC.fx.imageFilter(el) : ''; if (!s) return 'none'; return s.replace(/^filter:/, '').replace(/;$/, '').replace(/blur\(([\d.]+)mm\)/, (m0, q) => `blur(${(Number(q) * (kx || 1)).toFixed(1)}px)`); }
  function drawVideo(x, L) {
    const v = L.vEl, b = L.video.box, el = L.video.el; if (!v || !v.videoWidth) return; // 원본이 없으면 빈 공간
    const fit = el.fit || 'cover', vw = v.videoWidth, vh = v.videoHeight, cover = fit === 'cover', k = cover ? Math.max(b.w / vw, b.h / vh) : Math.min(b.w / vw, b.h / vh), dw = vw * k, dh = vh * k, fl = vFilter(el, L.video.kx);
    x.save(); x.beginPath(); if (L.video.rad > 0 && x.roundRect) x.roundRect(b.x, b.y, b.w, b.h, L.video.rad); else x.rect(b.x, b.y, b.w, b.h); x.clip();
    if (fit === 'blur') { /* 흐린 배경 채우기(가로 영상을 세로 숏츠에): 작게 줄여 흐리게 깐 뒤 원본 전체를 가운데에 */ const c = off('vb', Math.max(8, Math.round(b.w / 8)), Math.max(8, Math.round(b.h / 8))), g = c.getContext('2d'), kc = Math.max(c.width / vw, c.height / vh) * 1.15; g.filter = `blur(3px) brightness(0.72)${fl !== 'none' ? ' ' + fl.replace(/blur\([^)]*\)/, '') : ''}`; g.drawImage(v, (c.width - vw * kc) / 2, (c.height - vh * kc) / 2, vw * kc, vh * kc); g.filter = 'none'; x.drawImage(c, b.x, b.y, b.w, b.h); }
    if (fl !== 'none') x.filter = fl;
    x.drawImage(v, b.x + (b.w - dw) / 2, b.y + (b.h - dh) / 2, dw, dh); x.filter = 'none'; x.restore();
  }
  // 동영상의 '원본 시각': 장면 시각 t → 사용 구간(tin~tout) 안의 시각
  function mediaTime(L, t) { const d = L.video, sp = d.sp || 1, len = Math.max(0.05, d.tout - d.tin), u = Math.max(0, t - d.d0) * sp; if (t < 0 && !d.loop) return Math.max(0, d.tin + t * sp); /* 넘김 동안(장면 시작 전): 사용 구간 앞쪽 원본을 미리 재생 → 멈춘 화면으로 들어오지 않음(파이널컷 '핸들') */ return d.tin + (d.loop ? u % len : Math.min(u, len - 0.04)); }
  // 시각 T에 화면에 나오는 동영상 층들
  function activeVideos(V, T) { const { i, q } = at(V, T), A = V.scenes[i], out = []; A.layers.forEach(L => { if (L.vEl) out.push({ L, t: q }); }); if (q >= A.dur && A.turn) { const B = V.scenes[(i + 1) % V.scenes.length], tb = q - A.dur - A.turn; B.layers.forEach(L => { if (L.vEl) out.push({ L, t: tb }); }); } return out; }
  // 미리보기: 재생 중이면 동영상도 재생(어긋나면 맞춤), 멈췄으면 그 시각으로 감기
  function syncVideos(V, T, playing) { const act = new Set(); activeVideos(V, T).forEach(({ L, t }) => { const v = L.vEl, mt = mediaTime(L, t); act.add(v); const dv = L.video, sp = dv.sp || 1, hold = !dv.loop && ((t < 0 && dv.tin + t * sp <= 0) || (t >= 0 && t < dv.d0) || ((t - dv.d0) * sp >= dv.tout - dv.tin - 0.04)); /* 등장 전·원본 끝: 한 화면에 멈춰 있어야 하는 동안은 재생을 멈춤(예전엔 계속 재생하다 되감겨 떨림) */ if (playing && hold) { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - mt) > 0.04) v.currentTime = mt; return; } if (playing) { const d = v.currentTime - mt; if (Math.abs(d) > 0.25 * sp) { v.currentTime = mt; v.playbackRate = sp; } else if (!v.seeking) v.playbackRate = sp * (Math.abs(d) > 0.03 ? Math.max(0.95, Math.min(1.05, 1 - d * 0.8 / sp)) : 1); if (v.paused) v.play().catch(() => {}); } else { if (!v.paused) v.pause(); if (v.playbackRate !== 1) v.playbackRate = 1; if (Math.abs(v.currentTime - mt) > 0.004) v.currentTime = mt; } }); (V.videos || []).forEach(v => { if (!act.has(v) && !v.paused) v.pause(); }); }
  // 저장: 프레임마다 정확한 시각으로 감고 기다림
  async function seekVideos(V, T) { await Promise.all(activeVideos(V, T).map(({ L, t }) => new Promise(res => { const v = L.vEl, mt = mediaTime(L, t); if (Math.abs(v.currentTime - mt) < 0.001 && v.readyState >= 2) { res(); return; } const done = () => { v.removeEventListener('seeked', done); clearTimeout(to); res(); }, to = setTimeout(done, 1500); v.addEventListener('seeked', done); v.currentTime = mt; }))); }
  // 글자 효과: 글자 층을 한 번만 그려 두고 글자·단어·줄 칸만 잘라 보여 줌
  function drawUnits(x, L, t, A) {
    const d = Number(A.d || 0), sp = Math.max(0.1, Number(A.s || 0.8)), U = L.units, N = U.length; if (!N) { x.drawImage(L.cv, L.ox, L.oy); return; }
    const p = clamp01((t - d) / sp); if (p >= 1) { x.drawImage(L.cv, L.ox, L.oy); return; } if (p <= 0) return;
    if (A.t === 'type') { const n = p * N, k = Math.floor(n); x.beginPath(); L.lines.forEach(l => { if (l.last < k) x.rect(L.ox + l.x0 - 6, L.oy + l.y - 4, l.x1 - l.x0 + 12, l.y1 - l.y + 8); else if (l.first <= k && k < N) { const u = U[k], cut = u.x + u.w * (n - k); x.rect(L.ox + l.x0 - 6, L.oy + l.y - 4, cut - l.x0 + 6, l.y1 - l.y + 8); } }); x.clip(); x.drawImage(L.cv, L.ox, L.oy); return; }
    if (A.t === 'line') { const n = L.lines.length, st = Math.min(0.15, sp * 0.6 / Math.max(1, n)), one = Math.max(0.15, sp - st * (n - 1)); L.lines.forEach((l, i) => { const q = clamp01((t - d - i * st) / one); if (q <= 0) return; const e = ease(q); x.save(); x.globalAlpha *= e; x.beginPath(); x.rect(L.ox + l.x0 - 8, L.oy + l.y - 6, l.x1 - l.x0 + 16, l.y1 - l.y + 12); x.clip(); x.drawImage(L.cv, L.ox, L.oy + (1 - e) * (l.y1 - l.y) * 0.7); x.restore(); }); return; }
    // 한 글자씩·단어씩: 원본의 작은 칸만 옮겨 그림 (빠름)
    const kind = A.t, byWord = kind === 'word' || kind === 'wordpop' || kind === 'wordslam', fx = kind.replace(/^(word|char)/, '');
    const groups = []; if (byWord) { let g = null; U.forEach((u, i) => { if (u.sp) { g = null; return; } if (!g || g.line !== u.line) { g = { line: u.line, x: u.x, y: u.y, x1: u.x + u.w, y1: u.y + u.h }; groups.push(g); } else { g.x1 = u.x + u.w; g.y = Math.min(g.y, u.y); g.y1 = Math.max(g.y1, u.y + u.h); } }); }
    else U.forEach(u => { if (!u.sp) groups.push({ x: u.x, y: u.y, x1: u.x + u.w, y1: u.y + u.h }); });
    const n = groups.length, st = Math.min(byWord ? (fx === 'slam' ? 0.16 : 0.12) : 0.045, sp * 0.7 / Math.max(1, n)), one = Math.max(fx ? 0.18 : 0.12, sp - st * (n - 1));
    groups.forEach((g, i) => { const q = clamp01((t - d - i * st) / one); if (q <= 0) return; const e = ease(q), h = g.y1 - g.y, mx = 3, my = Math.round(h * 0.25), sx0 = Math.max(0, g.x - mx), sy0 = Math.max(0, g.y - my), sw = Math.min(L.cv.width - sx0, g.x1 - g.x + mx * 2), sh = Math.min(L.cv.height - sy0, h + my * 2); if (sw <= 0 || sh <= 0) return; x.save();
      if (fx === 'pop' || fx === 'slam') { const sc = fx === 'pop' ? Math.max(0.01, 0.3 + 0.7 * back(q)) : 1 + 1.1 * (1 - cubicOut(q)), cxg = L.ox + sx0 + sw / 2, cyg = L.oy + sy0 + sh / 2; x.globalAlpha *= clamp01(q * (fx === 'pop' ? 3 : 5)); x.translate(cxg, cyg); x.scale(sc, sc); x.translate(-cxg, -cyg); x.drawImage(L.cv, sx0, sy0, sw, sh, L.ox + sx0, L.oy + sy0, sw, sh); }  /* 단어(글자)마다 톡 튀어나오거나 쾅 박힘 — 숏츠 자막 */
      else if (fx === 'up') { x.beginPath(); x.rect(L.ox + sx0, L.oy + sy0, sw, sh); x.clip(); x.drawImage(L.cv, sx0, sy0, sw, sh, L.ox + sx0, L.oy + sy0 + (1 - cubicOut(q)) * sh, sw, sh); }  /* 글자마다 보이지 않는 선 아래에서 쑥 */
      else { x.globalAlpha *= e; x.drawImage(L.cv, sx0, sy0, sw, sh, L.ox + sx0, L.oy + sy0 + (1 - e) * h * 0.6, sw, sh); }
      x.restore(); });
  }
  // 한 장면을 장면 시각 t(초)에: 카메라(천천히 다가가기 등)를 건 뒤 층을 차례로
  function drawScene(x, sc, t, W, H) {
    x.save();
    if (sc.cam) { const P = Array.isArray(sc.cam.p) ? sc.cam.p : [0, 1], u = P[0] + (P[1] - P[0]) * clamp01(t / Math.max(0.1, sc.dur + sc.turn)), a = Number(sc.cam.a || 0.06), k = sc.cam.t, s = k === 'out' ? 1 + a * (1 - u) : 1 + a * (k === 'in' ? u : 0.6), mx = (k === 'left' ? -1 : k === 'right' ? 1 : 0) * a * W * 0.5 * (u - 0.5); x.translate(W / 2 + mx, H / 2); x.scale(s, s); x.translate(-W / 2, -H / 2); }
    sc.layers.forEach(L => drawLayer(x, L, t, sc.dur, W, H));
    x.restore();
  }
  // 영상 전체 시각 T(초)의 화면
  const _tmp = {};
  function off(slot, W, H) { slot += W < 400 ? '@s' : ''; let c = _tmp[slot]; if (!c || c.width !== W || c.height !== H) { c = _tmp[slot] = document.createElement('canvas'); c.width = W; c.height = H; } const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = 'none'; x.clearRect(0, 0, W, H); return c; }
  function at(V, T) { let acc = 0; for (let i = 0; i < V.scenes.length; i++) { const s = V.scenes[i], u = s.dur + s.turn; if (T < acc + u || i === V.scenes.length - 1) return { i, q: Math.min(T - acc, u), t0: acc }; acc += u; } return { i: 0, q: 0, t0: 0 }; }
  function sceneStarts(V) { let a = 0; return V.scenes.map(s => { const r = a; a += s.dur + s.turn; return r; }); }
  function drawAt(x, V, T) {
    const { W, H } = V; const { i, q } = at(V, T), A = V.scenes[i];
    x.save(); x.fillStyle = A.bg; x.fillRect(0, 0, W, H);
    if (q < A.dur || !A.turn) { drawScene(x, A, q, W, H); drawTracks(x, V, T); x.restore(); return; }
    const j = (i + 1) % V.scenes.length, B = V.scenes[j], p = clamp01((q - A.dur) / A.turn);
    const ca = off('a', W, H), cb = off('b', W, H); const xa = ca.getContext('2d'), xb = cb.getContext('2d');
    xa.fillStyle = A.bg; xa.fillRect(0, 0, W, H); drawScene(xa, A, q, W, H);
    xb.fillStyle = B.bg; xb.fillRect(0, 0, W, H); drawScene(xb, B, q - A.dur - A.turn, W, H); /* 다음 장면은 시작 전 시각(−넘김~0)으로: 동영상은 앞쪽을 미리 재생 */
    trans(x, ca, cb, p, A.trans, W, H, B.bg, Math.floor(T * 30), A.tdir); drawTracks(x, V, T); x.restore();
  }
  // 자막·오버레이 트랙 (장면 위에 영상 전체 시간 기준으로 겹침)
  const CAP_STYLES = [['outline', '흰 글자 외곽선'], ['box', '검은 상자'], ['pop', '노란 강조'], ['karaoke', '단어씩 강조'], ['plain', '그림자만'], ['title', '큰 제목'], ['lower', '하단 이름표']];
  function wrapText(x, text, maxW) { const out = []; String(text).split('\n').forEach(par => { let line = ''; par.split(/(\s+)/).forEach(w => { const t = line + w; if (x.measureText(t).width > maxW && line.trim()) { out.push(line.trim()); line = w.trim(); } else line = t; }); out.push(line.trim()); }); return out; }
  // 큰 제목(가운데, 살짝 커지며 등장) · 하단 이름표(왼쪽 아래 띠가 밀려 들어옴 — 첫 줄 이름, 다음 줄 직함)
  function drawTitle(x, c, u, d, W, H, sz, st) {
    const fam = `"${c.font || 'Pretendard'}", "Pretendard", sans-serif`, ein = ease(clamp01(u / 0.45)), eout = clamp01((d - u) / 0.3);
    if (st === 'title') { const S = sz * 1.9; x.font = `900 ${S}px ${fam}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; const lines = wrapText(x, c.text || '', W * 0.86), lh = S * 1.2, mid = c.pos === 'top' ? H * 0.22 : c.pos === 'bottom' ? H * 0.74 : H * 0.5, y0 = mid - (lines.length - 1) * lh / 2, sc = 0.9 + 0.1 * ein;
      x.save(); x.globalAlpha *= Math.min(c.fi === 0 ? 1 : ein, c.fo === 0 ? 1 : eout); x.translate(W / 2, mid); x.scale(sc, sc); x.translate(-W / 2, -mid); lines.forEach((ln, i) => { const y = y0 + i * lh; x.lineWidth = S * 0.14; x.strokeStyle = 'rgba(0,0,0,.85)'; x.strokeText(ln, W / 2, y); x.fillStyle = '#fff'; x.fillText(ln, W / 2, y); }); x.restore(); return; }
    const parts = String(c.text || '').split('\n'), rest = parts.slice(1).filter(Boolean), S1 = sz * 1.05, S2 = sz * 0.68, padX = S1 * 0.6, padY = S1 * 0.38, mx = W * 0.06;
    x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.font = `800 ${S1}px ${fam}`; const w1 = x.measureText(parts[0] || '').width; x.font = `500 ${S2}px ${fam}`; const w2 = Math.max(0, ...rest.map(t => x.measureText(t).width));
    const bw = Math.min(W * 0.88, Math.max(w1, w2) + padX * 2 + S1 * 0.25), bh = padY * 2 + S1 + rest.length * S2 * 1.3, by = (c.pos === 'top' ? H * 0.16 : c.pos === 'middle' ? H * 0.5 : (H > W * 1.3 ? H * 0.68 : H * 0.8)) - bh / 2, bx = mx - (c.fi === 0 ? 0 : 1 - ein) * (bw + mx);
    x.save(); x.globalAlpha *= c.fo === 0 ? 1 : eout; x.fillStyle = 'rgba(20,27,58,.92)'; x.fillRect(bx, by, bw, bh); x.fillStyle = '#FFD34D'; x.fillRect(bx, by, S1 * 0.18, bh); x.beginPath(); x.rect(bx, by, bw, bh); x.clip();
    x.fillStyle = '#fff'; x.font = `800 ${S1}px ${fam}`; x.fillText(parts[0] || '', bx + padX + S1 * 0.1, by + padY + S1 * 0.86); x.font = `500 ${S2}px ${fam}`; x.fillStyle = 'rgba(255,255,255,.88)'; rest.forEach((t, i) => x.fillText(t, bx + padX + S1 * 0.1, by + padY + S1 + S2 * 1.2 * (i + 1))); x.restore();
  }
  function drawCaption(x, c, T, W, H) {
    const u = T - c.at, d = Number(c.dur || 2.5); if (u < 0 || u > d) return;
    const fade = Math.min(1, c.fi === 0 ? 1 : u / 0.18, c.fo === 0 ? 1 : (d - u) / 0.18), sz = Math.round(Math.min(W, H) * Number(c.size || 0.065)), st = c.style || 'outline';
    if (st === 'title' || st === 'lower') { x.save(); drawTitle(x, c, u, d, W, H, sz, st); x.restore(); return; }
    x.save(); x.globalAlpha = Math.max(0, fade); x.font = `${c.weight || 800} ${sz}px "${c.font || 'Pretendard'}", "Pretendard", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const lines = wrapText(x, c.text || '', W * 0.86), lh = sz * 1.25, y0 = (c.pos === 'top' ? H * 0.14 : c.pos === 'middle' ? H * 0.5 : (H > W * 1.3 ? H * 0.70 : H * 0.84)) - (lines.length - 1) * lh / 2; /* 세로(숏츠·릴스): 아래 앱 단추·설명 글(약 22%) 위로 */
    let wordIx = 0; const words = (c.text || '').split(/\s+/).filter(Boolean), shown = st === 'karaoke' ? Math.min(words.length, Math.floor(u / Math.max(0.15, d * 0.85 / Math.max(1, words.length))) + 1) : 1e9;
    lines.forEach((ln, i) => {
      const y = y0 + i * lh, w = x.measureText(ln).width;
      if (st === 'box') { x.fillStyle = 'rgba(10,12,18,.72)'; const ph = sz * 0.35, r = sz * 0.25; x.beginPath(); if (x.roundRect) x.roundRect(W / 2 - w / 2 - ph, y - lh / 2, w + ph * 2, lh, r); else x.rect(W / 2 - w / 2 - ph, y - lh / 2, w + ph * 2, lh); x.fill(); x.fillStyle = '#fff'; x.fillText(ln, W / 2, y); return; }
      if (st === 'karaoke') { let cx = W / 2 - w / 2; x.textAlign = 'left'; ln.split(/(\s+)/).forEach(tok => { const tw = x.measureText(tok).width; if (tok.trim()) { const on = wordIx < shown, cur = wordIx === shown - 1; x.lineWidth = sz * 0.16; x.strokeStyle = '#000'; x.strokeText(tok, cx, y); x.fillStyle = cur ? '#FFD34D' : on ? '#fff' : 'rgba(255,255,255,.35)'; x.fillText(tok, cx, y); wordIx++; } cx += tw; }); x.textAlign = 'center'; return; }
      if (st === 'plain') { x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = sz * 0.3; x.shadowOffsetY = sz * 0.06; x.fillStyle = '#fff'; x.fillText(ln, W / 2, y); x.shadowColor = 'transparent'; return; }
      const sc = st === 'pop' ? 1 + 0.12 * Math.max(0, 1 - u / 0.25) : 1; x.save(); x.translate(W / 2, y); x.scale(sc, sc);
      x.lineWidth = sz * (st === 'pop' ? 0.2 : 0.16); x.strokeStyle = st === 'pop' ? '#141821' : '#000'; x.strokeText(ln, 0, 0); x.fillStyle = st === 'pop' ? '#FFD34D' : '#fff'; x.fillText(ln, 0, 0); x.restore();
    });
    x.restore();
  }
  // 오버레이(로고·사진): 위치(9곳)·크기(가로 비율)·투명도, 처음·끝 0.3초 서서히
  function drawOverlay(x, o, T, W, H) {
    const u = T - o.at, d = Number(o.dur || 3); if (u < 0 || u > d || !o.img || !o.img.naturalWidth) return;
    const fade = Math.min(1, o.fi === 0 ? 1 : u / 0.3, o.fo === 0 ? 1 : (d - u) / 0.3), w = W * Number(o.scale || 0.18), h = w * o.img.naturalHeight / o.img.naturalWidth, m = Math.min(W, H) * 0.04, p = o.pos || 'tr';
    const px = p[1] === 'l' ? m : p[1] === 'r' ? W - w - m : (W - w) / 2, py = p[0] === 't' ? m : p[0] === 'b' ? H - h - m : (H - h) / 2;
    x.save(); x.globalAlpha = Math.max(0, fade) * (o.opacity == null ? 1 : Number(o.opacity)); x.drawImage(o.img, px, py, w, h); x.restore();
  }
  function drawTracks(x, V, T) { (V.overlays || []).forEach(o => drawOverlay(x, o, T, V.W, V.H)); (V.captions || []).forEach(c => drawCaption(x, c, T, V.W, V.H)); }
  // 넘김 효과 (A 앞 장면, B 다음 장면, p 진행률)
  // 반평면으로 다각형 자르기 (keep: 점이 남는 쪽이면 참) — 책장 넘기기 접힘선
  function clipPoly(pts, side) { const out = []; for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length], sa = side(a), sb = side(b); if (sa >= 0) out.push(a); if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; }
  const polyPath = (x, pts) => { x.beginPath(); pts.forEach((q, k) => k ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); };
  // 접어 넘기기: 모서리 C가 P로 옮겨 감 (접힘선 = C·P의 수직이등분선). back = 뒷면 'mirror'(앞 장면을 옅게 비춤) | 종이색
  function fold(x, A, B, W, H, C, P, back) {
    const dx = P[0] - C[0], dy = P[1] - C[1], L = Math.hypot(dx, dy); if (L < 1) { x.drawImage(A, 0, 0, W, H); return; }
    const n = [-dx / L, -dy / L], M = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2], side = q => (q[0] - M[0]) * n[0] + (q[1] - M[1]) * n[1];
    const rect = [[0, 0], [W, 0], [W, H], [0, H]], keep = clipPoly(rect, q => -side(q)), lift = clipPoly(rect, side), refl = q => { const d = 2 * side(q); return [q[0] - d * n[0], q[1] - d * n[1]]; };
    x.drawImage(B, 0, 0, W, H);
    const sw = Math.max(W, H) * 0.06, g0 = x.createLinearGradient(M[0], M[1], M[0] + n[0] * sw, M[1] + n[1] * sw); g0.addColorStop(0, 'rgba(0,0,0,0.38)'); g0.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g0; x.fillRect(0, 0, W, H);  // 넘어간 자리 그림자
    if (keep.length > 2) { x.save(); polyPath(x, keep); x.clip(); x.drawImage(A, 0, 0, W, H); x.restore(); }
    const flap = lift.map(refl).filter(q => isFinite(q[0])); if (flap.length < 3) return;
    x.save(); x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = Math.max(4, W * 0.012); polyPath(x, flap); x.fillStyle = back === 'mirror' ? '#fbfaf7' : '#f4f1ea'; x.fill(); x.restore();
    x.save(); polyPath(x, flap); x.clip();
    if (back === 'mirror') { const R = [1 - 2 * n[0] * n[0], -2 * n[0] * n[1], -2 * n[0] * n[1], 1 - 2 * n[1] * n[1]], c0 = 2 * (M[0] * n[0] + M[1] * n[1]); x.save(); x.transform(R[0], R[1], R[2], R[3], c0 * n[0], c0 * n[1]); x.globalAlpha = 0.22; x.drawImage(A, 0, 0, W, H); x.restore(); }
    const fl = Math.max(W, H) * 0.35, g1 = x.createLinearGradient(M[0], M[1], M[0] - n[0] * fl, M[1] - n[1] * fl); g1.addColorStop(0, 'rgba(255,255,255,0.5)'); g1.addColorStop(0.25, 'rgba(0,0,0,0.04)'); g1.addColorStop(1, 'rgba(0,0,0,0.22)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);  // 말린 종이 음영
    x.restore();
  }
  // 하트·별 모양 (지름 1 기준, 가운데 0,0)
  function shapePath(kind) { const p = new Path2D(); if (kind === 'heart') { p.moveTo(0, 0.32); p.bezierCurveTo(-0.55, -0.05, -0.38, -0.5, 0, -0.22); p.bezierCurveTo(0.38, -0.5, 0.55, -0.05, 0, 0.32); } else { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.2 : 0.5; k ? p.lineTo(Math.cos(a) * r, Math.sin(a) * r) : p.moveTo(Math.cos(a) * r, Math.sin(a) * r); } p.closePath(); } return p; }
  const SHAPES = {};
  function trans(x, A, B, p, st, W, H, bg, f, dir) {
    if (dir === 'r' && /^(page|peel|cube)$/.test(st)) { /* 왼쪽에서 넘기기: 좌우를 뒤집어 그린 뒤 다시 뒤집음 */
      const fa = off('fa', W, H), fb = off('fb', W, H), fo = off('fo', W, H), m = (c, s) => { const g = c.getContext('2d'); g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(s, 0, 0, W, H); g.restore(); };
      m(fa, A); m(fb, B); trans(fo.getContext('2d'), fa, fb, p, st, W, H, bg, f, 'l'); x.save(); x.translate(W, 0); x.scale(-1, 1); x.drawImage(fo, 0, 0, W, H); x.restore(); return;
    }
    const U = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] }[dir] || [-1, 0], DL = U[0] ? W : H;
    const e = io(p), full = (c, al) => { if (al != null) { x.save(); x.globalAlpha = al; x.drawImage(c, 0, 0, W, H); x.restore(); } else x.drawImage(c, 0, 0, W, H); };
    const zoomed = (c, s, al, rot, n, spread) => { n = n || 1; for (let k = 0; k < n; k++) { const sk = s * (1 + (spread || 0) * k); x.save(); x.globalAlpha = (al == null ? 1 : al) / (n > 1 ? (k === 0 ? 1 : 2.2 * k) : 1); x.translate(W / 2, H / 2); if (rot) x.rotate(rot); x.scale(sk, sk); x.drawImage(c, -W / 2, -H / 2, W, H); x.restore(); } };
    switch (st) {
      case 'slide': case 'bounce': case 'cover': { const ee = st === 'bounce' ? back(p) : e, d = Math.round(DL * ee), ax = U[0] * d, ay = U[1] * d, bx = ax - U[0] * DL, by = ay - U[1] * DL;
        if (st === 'cover') { full(A); x.save(); x.fillStyle = 'rgba(0,0,0,' + (0.25 * ee) + ')'; x.fillRect(0, 0, W, H); x.restore(); } else { full(A); x.drawImage(A, ax, ay, W, H); }
        x.drawImage(B, bx, by, W, H); const sw = Math.round(DL * 0.05), ex = U[0] < 0 ? bx : U[0] > 0 ? bx + W : 0, ey = U[1] < 0 ? by : U[1] > 0 ? by + H : 0;  /* 들어오는 장면 앞 가장자리 그림자 */
        const gr = U[0] ? x.createLinearGradient(ex + U[0] * sw, 0, ex, 0) : x.createLinearGradient(0, ey + U[1] * sw, 0, ey); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)'); x.fillStyle = gr; if (U[0]) x.fillRect(Math.min(ex, ex + U[0] * sw), 0, sw, H); else x.fillRect(0, Math.min(ey, ey + U[1] * sw), W, sw); return; }
      case 'up': { const dy = Math.round(H * e); x.drawImage(A, 0, -dy, W, H); x.drawImage(B, 0, H - dy, W, H); return; }
      case 'fade': full(A); full(B, e); return;
      case 'zoom': full(A); zoomed(B, 1.12 - 0.12 * e, e); return;
      case 'pullin': if (p < 0.5) { const q = Math.pow(p * 2, 2); zoomed(A, 1 + 1.2 * q, 1, 0, 5, 0.03 * q); } else { const q = ease(p * 2 - 1); zoomed(B, 1.6 - 0.6 * q, 1, 0, q < 0.95 ? 4 : 1, 0.03 * (1 - q)); } return;
      case 'pullout': if (p < 0.5) { const q = Math.pow(p * 2, 2); zoomed(A, 1 - 0.4 * q, 1, 0); x.fillStyle = 'rgba(0,0,0,' + (0.3 * q) + ')'; x.fillRect(0, 0, W, H); } else { const q = ease(p * 2 - 1); full(B); zoomed(B, 1.5 - 0.5 * q, 1 - q * 0.0, 0); } return;
      case 'whip': { const q = expoIO(p), d = DL * q, v = Math.abs(expoIO(Math.min(1, p + 0.02)) - expoIO(Math.max(0, p - 0.02))) / 0.04; for (let k = 0; k < 6; k++) { const o2 = v * DL * 0.004 * k, ax = U[0] * (d + o2), ay = U[1] * (d + o2); x.save(); x.globalAlpha = k ? 0.18 : 1; x.drawImage(A, ax, ay, W, H); x.drawImage(B, ax - U[0] * DL, ay - U[1] * DL, W, H); x.restore(); } return; }
      case 'spin': if (p < 0.5) { const q = ease(p * 2); x.fillStyle = bg || '#fff'; x.fillRect(0, 0, W, H); zoomed(A, 1 + 0.3 * q, 1 - q, Math.PI / 2 * q, 3, 0.02); } else { const q = ease(p * 2 - 1); x.fillStyle = bg || '#fff'; x.fillRect(0, 0, W, H); zoomed(B, 1.3 - 0.3 * q, q, -Math.PI / 2 * (1 - q), q < 0.9 ? 3 : 1, 0.02); } return;
      case 'blur': { const q = 1 - Math.abs(2 * p - 1), c = off('q', Math.ceil(W / 4), Math.ceil(H / 4)), cx = c.getContext('2d'); cx.filter = `blur(${(q * 6).toFixed(1)}px)`; cx.drawImage(A, 0, 0, c.width, c.height); cx.globalAlpha = e; cx.drawImage(B, 0, 0, c.width, c.height); cx.filter = 'none'; cx.globalAlpha = 1; full(A); full(B, e); if (q > 0.02) { x.save(); x.globalAlpha = Math.min(1, q * 1.6); x.drawImage(c, 0, 0, W, H); x.restore(); } return; }
      case 'flash': full(p < 0.5 ? A : B); x.fillStyle = `rgba(255,255,255,${Math.pow(1 - Math.abs(2 * p - 1), 0.6)})`; x.fillRect(0, 0, W, H); return;
      case 'black': full(p < 0.5 ? A : B); x.fillStyle = `rgba(0,0,0,${1 - Math.abs(2 * p - 1)})`; x.fillRect(0, 0, W, H); return;
      case 'iris': { full(A); const r = e * Math.hypot(W, H) / 2; x.save(); x.beginPath(); x.arc(W / 2, H / 2, Math.max(0.1, r), 0, Math.PI * 2); x.clip(); x.drawImage(B, 0, 0, W, H); x.restore(); return; }
      case 'wipe': { full(A); const edge = DL * 0.08, pos = -edge + (DL + edge * 2) * e, c = off('w', W, H), cx = c.getContext('2d'); cx.drawImage(B, 0, 0, W, H); cx.globalCompositeOperation = 'destination-in'; /* 방향: 기본은 왼쪽→오른쪽으로 닦음(다음 장면이 왼쪽부터) */ const rev = U[0] > 0 || U[1] > 0 ? false : true, a0 = rev ? pos - edge : DL - pos + edge, a1 = rev ? pos : DL - pos; const g = U[0] ? cx.createLinearGradient(a0, 0, a1, 0) : cx.createLinearGradient(0, a0, 0, a1); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); cx.globalCompositeOperation = 'source-over'; x.drawImage(c, 0, 0); return; }
      case 'blinds': { full(A); const n = 8, h = H / n; x.save(); x.beginPath(); for (let k = 0; k < n; k++) x.rect(0, k * h, W, h * e); x.clip(); x.drawImage(B, 0, 0, W, H); x.restore(); return; }
      case 'glitch': { f = Math.floor(f / 10); full(p < 0.5 ? A : B); if (p > 0.25 && p < 0.75) { const src = p < 0.5 ? A : B, n = 6 + Math.floor(rnd(f, 3) * 5); for (let k = 0; k < n; k++) { const y = rnd(f, k * 7) * H, h = H * (0.02 + rnd(f, k * 11) * 0.08), d = (rnd(f, k * 13) - 0.5) * W * 0.1; x.drawImage(src, 0, y, W, h, d, y, W, h); } x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.35; x.drawImage(src, 8, 0, W, H); x.restore(); } return; }
      case 'shake': { const amp = W * 0.02 * (1 - Math.abs(2 * p - 1)), sx = (rnd(f, 5) - 0.5) * 2 * amp, sy = (rnd(f, 9) - 0.5) * 2 * amp; x.save(); x.translate(sx, sy); full(A); full(B, e); x.restore(); return; }
      case 'none': full(p < 0.5 ? A : B); return;
      case 'split': { full(B); const d = e * (W >= H ? H : W) / 2; x.save(); if (W >= H) { x.drawImage(A, 0, 0, W, H / 2, 0, -d, W, H / 2); x.drawImage(A, 0, H / 2, W, H / 2, 0, H / 2 + d, W, H / 2); } else { x.drawImage(A, 0, 0, W / 2, H, -d, 0, W / 2, H); x.drawImage(A, W / 2, 0, W / 2, H, W / 2 + d, 0, W / 2, H); } x.restore(); return; }
      case 'doors': { x.fillStyle = '#0d0f14'; x.fillRect(0, 0, W, H); x.save(); x.translate(W / 2, H / 2); const s0 = 0.9 + 0.1 * e; x.scale(s0, s0); x.drawImage(B, -W / 2, -H / 2, W, H); x.restore(); x.fillStyle = 'rgba(0,0,0,' + (0.35 * (1 - e)) + ')'; x.fillRect(0, 0, W, H);
        const hw = W / 2, w1 = hw * (1 - e), N = 16; if (w1 < 0.5) return;  /* 가운데에서 양쪽으로 열리는 문: 바깥이 경첩, 안쪽 가장자리가 다가오며 커짐 */
        for (let k = 0; k < N; k++) { const u = (k + 0.5) / N, sy = -H * 0.1 * e * u, ws = w1 / N + 1; x.drawImage(A, hw * k / N, 0, hw / N + 0.5, H, w1 * k / N, sy, ws, H - 2 * sy); x.drawImage(A, W - hw * (k + 1) / N, 0, hw / N + 0.5, H, W - w1 * (k + 1) / N, sy, ws, H - 2 * sy); }
        x.fillStyle = 'rgba(0,0,0,' + (0.3 * e) + ')'; x.fillRect(0, 0, w1, H); x.fillRect(W - w1, 0, w1, H); return; }
      case 'flip': { x.fillStyle = bg || '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#111'; x.globalAlpha = 0.35; x.fillRect(0, 0, W, H); x.globalAlpha = 1; const c = Math.abs(Math.cos(Math.PI * e)), src = e < 0.5 ? A : B; x.save(); x.translate(W / 2, H / 2); x.scale(Math.max(0.002, c), 1 - 0.06 * Math.sin(Math.PI * e)); x.drawImage(src, -W / 2, -H / 2, W, H); x.fillStyle = 'rgba(0,0,0,' + (0.45 * (1 - c)) + ')'; x.fillRect(-W / 2, -H / 2, W, H); x.restore(); return; }
      case 'cube': { x.fillStyle = '#111'; x.fillRect(0, 0, W, H); const sx = W * (1 - e), N = 28, z = 1 - 0.08 * Math.sin(Math.PI * e); x.save(); x.translate(W / 2, H / 2); x.scale(z, z); x.translate(-W / 2, -H / 2);
        const face = (src, X0, X1, dep) => { const w = X1 - X0; if (w < 0.5) return; for (let k = 0; k < N; k++) { const u = (k + 0.5) / N, dpt = dep(u), sy = H * 0.14 * dpt; x.drawImage(src, W * k / N, 0, W / N + 0.5, H, X0 + w * k / N, sy, w / N + 1, H - 2 * sy); x.fillStyle = 'rgba(0,0,0,' + (0.5 * dpt) + ')'; x.fillRect(X0 + w * k / N, sy, w / N + 1, H - 2 * sy); } };
        face(A, 0, sx, u => e * (1 - u)); face(B, sx, W, u => (1 - e) * u); x.restore(); return; }
      case 'clock': { full(A); const r = Math.hypot(W, H), a0 = -Math.PI / 2; x.save(); x.beginPath(); x.moveTo(W / 2, H / 2); x.arc(W / 2, H / 2, r, a0, a0 + Math.PI * 2 * e); x.closePath(); x.clip(); x.drawImage(B, 0, 0, W, H); x.restore(); return; }
      case 'checker': { full(A); const cols = W >= H ? 8 : 5, rows = W >= H ? 5 : 8, cw = W / cols, ch = H / rows; x.save(); x.beginPath(); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const t0 = rnd(r * 13 + c, 7) * 0.7, k = clamp01((p - t0) / 0.3); if (k <= 0) continue; const kw = cw * k, kh = ch * k; x.rect(c * cw + (cw - kw) / 2 - 0.5, r * ch + (ch - kh) / 2 - 0.5, kw + 1, kh + 1); } x.clip(); x.drawImage(B, 0, 0, W, H); x.restore(); return; }
      case 'heart': case 'star': { full(A); const P2 = SHAPES[st] || (SHAPES[st] = shapePath(st)), k = Math.pow(e, 1.6) * Math.hypot(W, H) * (st === 'heart' ? 2.4 : 3.2); if (k < 0.5) return; const oy = st === 'heart' ? k * 0.05 : 0; x.save(); x.translate(W / 2, H / 2 + oy); x.scale(k, k); x.clip(P2); x.scale(1 / k, 1 / k); x.translate(-W / 2, -H / 2 - oy); x.drawImage(B, 0, 0, W, H); x.restore(); return; }
      case 'page': { const t = io(p); fold(x, A, B, W, H, [W, H], [W - 2.15 * W * t, H - H * 0.22 * Math.sin(Math.PI * t)], 'mirror'); return; }
      case 'peel': { const t = io(p); fold(x, A, B, W, H, [W, H], [W - 2.2 * W * t, H - 2.2 * H * t * (0.85 + 0.15 * t)], 'paper'); return; }
      case 'leak': { full(A); full(B, clamp01((p - 0.3) / 0.4)); const s = Math.sin(Math.PI * p); x.save(); x.globalCompositeOperation = 'screen'; [[0.15 + 0.7 * p, 0.3, '255,150,60'], [0.85 - 0.5 * p, 0.7, '255,90,140'], [0.5, 0.15 + 0.6 * p, '255,220,150']].forEach(([cx, cy, col], k) => { const R = Math.max(W, H) * (0.45 + 0.15 * k), g = x.createRadialGradient(cx * W, cy * H, 0, cx * W, cy * H, R); g.addColorStop(0, `rgba(${col},${0.85 * s})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(0, 0, W, H); }); x.restore(); return; }
      case 'mosaic': { const m = 1 - Math.abs(2 * p - 1), bs = Math.max(1, Math.round(1 + m * 46 * Math.max(W, H) / 1920)); const src = p < 0.5 ? A : B; if (bs <= 1) { full(src); return; } const c = off('m', Math.max(1, Math.ceil(W / bs)), Math.max(1, Math.ceil(H / bs))), cx = c.getContext('2d'); cx.imageSmoothingEnabled = true; cx.drawImage(A, 0, 0, c.width, c.height); cx.globalAlpha = clamp01((p - 0.4) / 0.2); cx.drawImage(B, 0, 0, c.width, c.height); cx.globalAlpha = 1; x.save(); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, W, H); x.restore(); return; }
      case 'wave': { const N = 72, h = H / N, amp = W * 0.03 * Math.sin(Math.PI * p), fa = clamp01((p - 0.3) / 0.4); full(fa < 0.5 ? A : B);  /* 가장자리 빈틈은 원래 장면으로 */ [[A, 1 - fa], [B, fa]].forEach(([src, al]) => { if (al <= 0) return; x.save(); x.globalAlpha = al; for (let k = 0; k < N; k++) { const y = k * h, dx = Math.sin(k * 0.13 + p * 7) * amp; x.drawImage(src, 0, y, W, h + 1, dx, y, W, h + 1); } x.restore(); }); return; }
    }
    // soft: 소식지 TV 영상과 같은 '부드럽게 넘김' — 앞 장이 왼쪽으로 물러나며 옅어진 뒤 다음 장이 오른쪽에서 또렷해짐
    x.fillStyle = bg || '#fff'; x.fillRect(0, 0, W, H);
    const sh = Math.round(W * 0.035), ea = NC.news.tvEase(Math.min(1, p / 0.6)), eb = NC.news.tvEase(Math.max(0, (p - 0.35) / 0.65));
    x.save(); x.globalAlpha = 1 - ea; x.drawImage(A, -sh * ea, 0, W, H); x.restore();
    x.save(); x.globalAlpha = eb; x.drawImage(B, sh * (1 - eb), 0, W, H); x.restore();
  }

  /* ---------- 소리 ---------- */
  let AC = null;
  const ctx = () => AC || (AC = (() => { try { return new AudioContext({ sampleRate: 48000 }); } catch (e) { return new (window.AudioContext || window.webkitAudioContext)(); } })());  // 영상 표준 48kHz
  async function decode(url) { const ab = await (await fetch(url)).arrayBuffer(); return await ctx().decodeAudioData(ab); }
  // 음악 예약: a = {vol, from(곡의 몇 초부터), start(영상 몇 초에 시작), fin·fout(서서히 크게·작게 초), fade(옛 문서: 끝 2.5초)}
  // T0 = 지금 재생을 시작하는 영상 시각, when = 그 순간의 소리 시계 시각, total = 영상 길이
  function schedule(ac, dest, buf, a, T0, when, total) {
    const src = ac.createBufferSource(), g = ac.createGain(), vol = a.vol == null ? 0.8 : Number(a.vol), from = Number(a.from || 0), start = Number(a.start || 0);
    const fin = Number(a.fin || 0), fout = a.fout != null ? Number(a.fout) : (a.fade === false ? 0 : 2.5);
    src.buffer = buf; const playLen = total - start; if (playLen <= 0) return { stop() {} };
    src.loop = buf.duration - from < playLen; if (src.loop) { src.loopStart = Math.min(from, buf.duration - 0.05); src.loopEnd = buf.duration; }
    const vt = v => when + (v - T0); // 영상 시각 → 소리 시계
    g.gain.setValueAtTime(fin > 0 ? 0.0001 : vol, Math.max(when, vt(start)));
    if (fin > 0) g.gain.linearRampToValueAtTime(vol, Math.max(when, vt(start + fin)));
    if (fout > 0 && total - fout > start) { g.gain.setValueAtTime(vol, Math.max(when, vt(total - fout))); g.gain.linearRampToValueAtTime(0.0001, Math.max(when + 0.01, vt(total))); }
    src.connect(g).connect(dest);
    if (T0 >= start) { const off2 = from + (T0 - start); src.start(when, src.loop ? from + ((off2 - from) % Math.max(0.05, buf.duration - from)) : Math.min(off2, buf.duration)); }
    else src.start(vt(start), from);
    return { stop() { try { src.stop(); } catch (e) {} } };
  }
  function music(buf, a, to, from, total) { const ac = ctx(); return schedule(ac, to, buf, a, from, ac.currentTime, total); }
  // 효과음들 예약: list = [{buf, at(영상 몇 초), vol}]
  function scheduleSfx(ac, dest, list, T0, when) {
    const srcs = [];
    (list || []).forEach(x => { if (!x.buf) return; const off0 = Number(x.off || 0), len = x.dur ? Math.min(Number(x.dur), x.buf.duration - off0) : x.buf.duration - off0; if (len <= 0 || x.at + len <= T0) return; const s2 = ac.createBufferSource(), g = ac.createGain(); s2.buffer = x.buf; g.gain.value = x.vol == null ? 1 : Number(x.vol); s2.connect(g).connect(dest); if (x.at >= T0) s2.start(when + (x.at - T0), off0, len); else s2.start(when, off0 + (T0 - x.at), len - (T0 - x.at)); srcs.push(s2); });
    return { stop() { srcs.forEach(s2 => { try { s2.stop(); } catch (e) {} }); } };
  }
  // ---- 소리 목록(voices): 배경 음악·트랙 클립·동영상 속 소리를 같은 방식으로 ----
  // voice = { buf(AudioBuffer) 또는 blob·url(파일), at(영상 몇 초에 시작), off(원본 몇 초부터), len(초, 없으면 끝까지), vol, fin, fout, loop }
  const vEnd = (v, total) => Math.min(total, v.len != null ? v.at + v.len : total);
  // 음량 점(vk): [[클립 시작부터 초, 배율], …] — 점 사이는 직선으로 이어지고, 첫 점 앞·끝 점 뒤는 그 점의 값
  function vkAt(vk, s) { if (s <= vk[0][0]) return vk[0][1]; for (let i = 1; i < vk.length; i++) if (s <= vk[i][0]) { const a = vk[i - 1], b = vk[i]; return a[1] + (b[1] - a[1]) * (s - a[0]) / Math.max(1e-6, b[0] - a[0]); } return vk[vk.length - 1][1]; }
  // 더킹: 구간 [s,e] 안에서 k배, 앞뒤 r초 동안 직선으로 내려가고 올라감
  function duckAt(D, t) { if (!D || !D.iv || !D.iv.length) return 1; const r = D.r || 0.35; let f = 1; for (const [s, e] of D.iv) { if (t < s - r || t > e + r) continue; const p = t < s ? (s - t) / r : t > e ? (t - e) / r : 0; f = Math.min(f, D.k + (1 - D.k) * Math.min(1, p)); } return f; }
  function duckKeys(D) { const r = (D && D.r) || 0.35, o = []; ((D && D.iv) || []).forEach(([s, e]) => o.push(s - r, s, e, e + r)); return o; }
  function envAt(v, t, total) { const end = vEnd(v, total), vol = v.vk && v.vk.length ? vkAt(v.vk, t - v.at) : v.vol == null ? 1 : Number(v.vol); let g = vol * duckAt(v.duck, t); if (v.fin > 0 && t < v.at + v.fin) g *= Math.max(0, (t - v.at) / v.fin); if (v.fout > 0 && t > end - v.fout) g *= Math.max(0, (end - t) / v.fout); if (t - v.at < MF) g *= Math.max(0, (t - v.at) / MF); if (end - t < MF) g *= Math.max(0, (end - t) / MF); return g; }
  const MF = 0.008;  /* 클립 끝 마이크로 페이드(8ms) — 잘린 파형이 갑자기 끊겨 나는 '딱' 소리 막기 */
  // 미리보기·실시간 녹화: 짧은 소리는 버퍼로, 파일은 오디오 플레이어로 (몇 시간짜리도 바로 재생)
  // 반복 소리의 원본 위치: 처음엔 off부터 끝까지, 그다음부터는 off~끝을 되풀이 (저장 astream.bufferReader·reader의 loopFrom과 같은 규칙)
  const loopPos = (p, o0, D) => p < D ? p : o0 + ((p - o0) % Math.max(0.05, D - o0));
  function playVoices(ac, dest, voices, T0, when, total) {
    const stops = [];
    (voices || []).forEach(v => {
      const end = vEnd(v, total); if (end <= T0) return;
      const g = ac.createGain(), at = t => when + (t - T0), t1 = Math.max(T0, v.at);
      // 음량이 꺾이는 시각(페이드 끝·시작, 음량 점)마다 값을 정해 직선으로 이음 — 내보내기(envAt)와 같은 모양
      const ks = new Set([end, v.at + MF, end - MF]); if (v.fin > 0) ks.add(v.at + v.fin); if (v.fout > 0) ks.add(end - v.fout); (v.vk || []).forEach(k => ks.add(v.at + Number(k[0]))); duckKeys(v.duck).forEach(t => ks.add(t));
      g.gain.setValueAtTime(envAt(v, t1, total), at(t1)); [...ks].filter(t => t > t1 && t <= end).sort((a, b) => a - b).forEach(t => g.gain.linearRampToValueAtTime(envAt(v, t, total), at(t)));
      g.connect(dest);
      const startAt = Math.max(when, at(v.at)), pos = Number(v.off || 0) + Math.max(0, T0 - v.at), dur = end - Math.max(T0, v.at);
      if (v.buf) { const s2 = ac.createBufferSource(); s2.buffer = v.buf; s2.loop = !!v.loop && v.buf.duration < dur + pos; if (s2.loop) { s2.loopStart = Math.min(Number(v.off || 0), v.buf.duration - 0.05); s2.loopEnd = v.buf.duration; } s2.connect(g); s2.start(startAt, s2.loop ? loopPos(pos, Number(v.off || 0), v.buf.duration) : Math.min(pos, v.buf.duration), s2.loop ? undefined : dur); stops.push(() => { try { s2.stop(); } catch (e) {} g.disconnect(); }); }
      else if (v.url) {
        /* 파일 소리(긴 m4a·mp3): ① 파일이 늦게 열리면 늦은 만큼 앞으로 가서 시작 ② 0.5초마다 '지금 있어야 할 곳'과 비교 —
           조금 어긋나면 재생 속도를 살짝(±3%) 바꿔 따라잡고, 많이 어긋나면 그 자리로 옮김 ③ 반복은 원본 '시작 위치(off)'로 돌아감(저장본과 같게) */
        const el = new Audio(); el.src = v.url; el.preload = 'auto'; el.loop = false; const node = ac.createMediaElementSource(el); node.connect(g); let tm = 0, tm2 = 0, iv = 0, done = false;
        const o0 = Number(v.off || 0), want = () => { const p2 = pos + Math.max(0, ac.currentTime - startAt), D = el.duration; return v.loop && isFinite(D) && D > o0 + 0.05 ? loopPos(p2, o0, D) : p2; };
        const fix = () => { if (done || el.paused || el.seeking) return; const d = el.currentTime - want(); if (Math.abs(d) > 0.25) { try { el.currentTime = want() + 0.03; } catch (e) {} el.playbackRate = 1; } else el.playbackRate = Math.abs(d) > 0.02 ? Math.max(0.97, Math.min(1.03, 1 - d * 0.6)) : 1; };
        const go = () => { if (done) return; try { el.currentTime = want(); } catch (e) {} el.play().catch(() => {}); clearInterval(iv); iv = setInterval(fix, 500); clearTimeout(tm2); tm2 = setTimeout(() => { done = true; el.pause(); clearInterval(iv); }, Math.max(0, (startAt + dur - ac.currentTime) * 1000)); };
        el.addEventListener('ended', () => { if (!done && v.loop) { try { el.currentTime = want(); } catch (e) {} el.play().catch(() => {}); } });
        el.addEventListener('loadedmetadata', () => { const wait = Math.max(0, (startAt - ac.currentTime) * 1000); tm = setTimeout(go, wait); }, { once: true });
        stops.push(() => { done = true; clearTimeout(tm); clearTimeout(tm2); clearInterval(iv); el.pause(); el.removeAttribute('src'); try { el.load(); } catch (e) {} try { node.disconnect(); } catch (e) {} g.disconnect(); }); }
    });
    return { stop() { stops.forEach(f => f()); } };
  }
  // 저장: 1초씩 필요한 구간만 읽어 섞음 → 48kHz 스테레오 덩어리를 차례로 넘김 (긴 파일도 메모리를 조금만 씀)
  async function mixVoices(voices, total, onBlock, onProgress, cancelled) {
    const SR = 48000, BL = SR, N = Math.ceil(total * SR);
    let env = 1; const CEIL = 0.891, K = 1 - Math.exp(-1 / (0.15 * SR));  // 리미터: 여러 소리가 겹쳐 1을 넘으면 찌그러지는 대신 순간적으로 줄임(-1 dBFS 천장)
    const silent = { read: async n => [new Float32Array(n), new Float32Array(n)], close() {} };
    try {
    for (let p = 0; p < N; p += BL) {
      if (cancelled && cancelled()) return false;
      const n = Math.min(BL, N - p), t0 = p / SR, L = new Float32Array(n), R = new Float32Array(n);
      for (const v of voices || []) {
        const end = vEnd(v, total); if (end <= t0) { if (v._r) { v._r.close(); v._r = null; } continue; } if (v.at >= t0 + n / SR) continue;
        if (!v._r) { const rel = Math.max(0, t0 - v.at); try { v._r = v.buf ? NC.astream.bufferReader(v.buf, Number(v.off || 0) + rel, !!v.loop, Number(v.off || 0)) : await NC.astream.reader(v.blob, Number(v.off || 0) + rel, { loop: !!v.loop, loopFrom: Number(v.off || 0) }); } catch (e) { console.warn('소리를 읽지 못해 무음으로 둡니다', e); v._r = silent; } }  /* 소리 하나 때문에 전체 저장이 실패하지 않게 */
        const i0 = Math.max(0, Math.round((v.at - t0) * SR)), i1 = Math.min(n, Math.round((end - t0) * SR)); if (i1 <= i0) continue;
        const [a, b] = await v._r.read(i1 - i0);
        for (let i = i0; i < i1; i++) { const g = envAt(v, t0 + i / SR, total); L[i] += a[i - i0] * g; R[i] += b[i - i0] * g; }
      }
      for (let i = 0; i < n; i++) { const pk = Math.max(Math.abs(L[i]), Math.abs(R[i])), need = pk > CEIL ? CEIL / pk : 1; env = need < env ? need : env + (need - env) * K; L[i] *= env; R[i] *= env; }
      await onBlock(L, R, t0); if (onProgress) onProgress(Math.min(1, (p + n) / N));
    }
    return true;
    } finally { (voices || []).forEach(v => { if (v._r) { try { v._r.close(); } catch (e) {} v._r = null; } }); }  // 중지·오류 때도 디코더를 닫음
  }
  // 음악 파형(타임라인용): 칸마다 최댓값
  function peaks(buf, n) { const d = buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / n)), out = new Float32Array(n); for (let i = 0; i < n; i++) { let m = 0; const s0 = i * step, e0 = Math.min(d.length, s0 + step); for (let k = s0; k < e0; k += 16) { const v = Math.abs(d[k]); if (v > m) m = v; } out[i] = m; } return out; }

  /* ---------- 미리보기 재생 ---------- */
  function player(canvas, V, audio) {
    const x = canvas.getContext('2d'); canvas.width = V.W; canvas.height = V.H;
    let t = 0, playing = false, t0 = 0, raf = 0, snd = null; const P = { onTime: null };
    const draw = () => { if (V.videos && V.videos.length) syncVideos(V, t, playing); drawAt(x, V, Math.min(t, V.total - 0.001)); if (P.onTime) P.onTime(t); };
    const loop = () => { t = (performance.now() - t0) / 1000; if (t >= V.total) { t = V.total; P.pause(); draw(); return; } draw(); raf = requestAnimationFrame(loop); };
    P.play = () => { if (playing) return; if (t >= V.total - 0.01) t = 0; playing = true; t0 = performance.now() - t * 1000; const ac = ctx(); ac.resume && ac.resume(); snd = playVoices(ac, ac.destination, V.voices, t, ac.currentTime, V.total); loop(); };
    P.pause = () => { playing = false; cancelAnimationFrame(raf); if (snd) { snd.stop(); snd = null; } (V.videos || []).forEach(v => v.pause()); };
    P.seek = v => { const was = playing; P.pause(); t = Math.max(0, Math.min(V.total, v)); draw(); if (was) P.play(); };
    P.toggle = () => playing ? P.pause() : P.play();
    P.isPlaying = () => playing; P.destroy = () => P.pause();
    draw(); return P;
  }

  /* ---------- 녹화 ---------- */
  function mimeFor(withAudio, big) {
    if (!window.MediaRecorder) return '';
    if (!withAudio) return NC.news.tvMime();
    const list = [...(big ? ['video/mp4;codecs=avc1.640033,mp4a.40.2'] : []), 'video/mp4;codecs=avc1.4d0028,mp4a.40.2', 'video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    for (const m of list) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} } return '';
  }
  // o = { V, canvas, audio:{buf,vol,fade}, onProgress(p, T), cancelled() } → { blob, ext, note | warn } | null(중지)
  function record(o) {
    return new Promise((resolve, reject) => {
      const V = o.V, withA = !!(V.voices && V.voices.length), mime = mimeFor(withA, V.W * V.H > 2100000);
      if (!mime) { reject(new Error('이 브라우저는 영상 저장을 지원하지 않습니다. 크롬(Chrome)에서 열어 주세요.')); return; }
      const cv = o.canvas; cv.width = V.W; cv.height = V.H; const x = cv.getContext('2d'); drawAt(x, V, 0);
      const vs = cv.captureStream(o.fps || 30); let dest = null, snd = null;
      if (withA) { const ac = ctx(); ac.resume && ac.resume(); dest = ac.createMediaStreamDestination(); }
      const stream = new MediaStream([...vs.getVideoTracks(), ...(dest ? dest.stream.getAudioTracks() : [])]);
      const bps = Math.round(Math.min(12e6, Math.max(5e6, V.W * V.H * 4.5)));
      let rec; try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bps, audioBitsPerSecond: 160000 }); } catch (e) { rec = new MediaRecorder(stream, { mimeType: mime }); }
      const chunks = []; let stopped = false;
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        if (snd) snd.stop(); try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
        if (stopped) { resolve(null); return; }
        const ext = mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm', blob = new Blob(chunks, { type: mime.split(';')[0] });
        if (ext !== 'mp4') { resolve({ blob, ext, warn: '이 브라우저는 MP4 녹화를 지원하지 않아 WebM으로 저장했습니다. 최신 크롬에서 다시 만들어 주세요.' }); return; }
        blob.arrayBuffer().then(buf => {
          let r = null;
          try { r = withA ? defragMulti(buf) : NC.news.mp4Defrag(buf); } catch (e) { r = null; }
          if (!r) { resolve({ blob, ext, warn: '일반 MP4 구조로 바꾸지 못해 녹화본 그대로 저장했습니다(일부 TV에서 재생되지 않을 수 있음).' }); return; }
          resolve({ blob: new Blob(r.parts, { type: 'video/mp4' }), ext, note: `MP4 · ${V.W}×${V.H} · ${r.seconds.toFixed(1)}초${withA ? ' · 소리 포함' : ''}` });
        }).catch(() => resolve({ blob, ext, warn: '변환 중 오류 — 녹화본 그대로 저장했습니다.' }));
      };
      rec.start(1000);
      const t0 = performance.now(); if (withA) { const ac = ctx(); snd = playVoices(ac, dest, V.voices, 0, ac.currentTime, V.total); }
      const step = () => {
        if (o.cancelled && o.cancelled()) { stopped = true; if (rec.state !== 'inactive') rec.stop(); return; }
        const T = (performance.now() - t0) / 1000;
        if (T >= V.total) { drawAt(x, V, V.total - 0.001); if (rec.state !== 'inactive') rec.stop(); return; }
        if (V.videos && V.videos.length) syncVideos(V, T, true); drawAt(x, V, T); if (o.onProgress) o.onProgress(T / V.total, T);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* ---------- 빠른 내보내기: WebCodecs(브라우저 내장 H.264·AAC 인코더) + mp4-muxer(github.com/Vanilagy/mp4-muxer) ----------
     실제 시간만큼 녹화하지 않고 한 장씩 그려 인코딩 → 훨씬 빠르고, 창을 가려도 끊기지 않고, 프레임이 정확한 일반 MP4. */
  const MUXER = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.min.js';
  function load(url, test) { if (test()) return Promise.resolve(); return new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = () => test() ? res() : rej(new Error('라이브러리를 불러오지 못했습니다')); s.onerror = () => rej(new Error('라이브러리를 불러오지 못했습니다 (인터넷 연결 확인)')); document.head.appendChild(s); }); }
  const canFast = () => !!(window.VideoEncoder && window.VideoFrame);
  // H.264 레벨: 화면 크기×fps에 맞는 가장 낮은 레벨 (1080p30=4.0, 1080p60=4.2, 4K30=5.1, 4K60=5.2) — 엄격한 TV 디코더가 거부하지 않게
  function avcLevel(W, H, fps) { const fs = Math.ceil(W / 16) * Math.ceil(H / 16), r = fs * fps; const T = [[0x1f, 3600, 108000], [0x20, 5120, 216000], [0x28, 8192, 245760], [0x2a, 8704, 522240], [0x32, 22080, 589824], [0x33, 36864, 983040], [0x34, 36864, 2073600]]; return (T.find(t => fs <= t[1] && r <= t[2]) || T[T.length - 1])[0]; }
  async function pickCodec(W, H, fps, bps) {
    const lv = avcLevel(W, H, fps).toString(16), list = ['4d00', '6400', '42e0'].map(p => `avc1.${p}${lv}`); // TV 호환: Main 먼저
    for (const codec of list) { try { const r = await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate: bps, framerate: fps, avc: { format: 'avc' } }); if (r.supported) return codec; } catch (e) {} }
    return null;
  }
  // 음악을 영상 길이에 맞춰 미리 섞음(시작 위치·반복·크기·서서히) → 48kHz 스테레오
  async function mixAudio(a, total, sfx) {
    const SR = 48000, oac = new OfflineAudioContext(2, Math.ceil(total * SR), SR);
    if (a && a.buf) schedule(oac, oac.destination, a.buf, a, 0, 0, total); scheduleSfx(oac, oac.destination, sfx, 0, 0); return oac.startRendering();
  }
  // o = { V, fps, audio:{buf,vol,fade}, canvas(미리보기), onProgress(p, T), cancelled() } → { blob, ext, note } | null(중지)
  async function encode(o) {
    const V = o.V, W = V.W, H = V.H, fps = Number(o.fps || 30), N = Math.max(1, Math.ceil(V.total * fps));
    const bps = Math.round(Math.min(W * H > 2100000 ? 45e6 : 16e6, Math.max(5e6, W * H * fps * 0.15)));  // 4K는 유튜브 권장(35~68Mbps)에 맞춰 상한 45Mbps
    await load(MUXER, () => !!window.Mp4Muxer);
    const codec = await pickCodec(W, H, fps, bps); if (!codec) throw new Error('이 컴퓨터에서 H.264 인코더를 쓸 수 없습니다');
    let aOk = false; const hasA = !!(V.voices && V.voices.length);
    if (hasA) {
      if (!window.AudioEncoder) throw new Error('소리 인코더 없음');
      try { aOk = (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 })).supported; } catch (e) { aOk = false; }
      if (!aOk) throw new Error('이 브라우저는 AAC 소리 인코딩을 지원하지 않습니다');
    }
    const aBuf = hasA;
    const fileOut = !!(o.writable && Mp4Muxer.FileSystemWritableFileStreamTarget);  /* 긴 영상: 고른 파일에 바로 씀 (메모리에 몇 GB를 모으지 않음) */
    const target = fileOut ? new Mp4Muxer.FileSystemWritableFileStreamTarget(o.writable) : new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({ target, video: { codec: 'avc', width: W, height: H, frameRate: fps }, audio: aBuf ? { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 } : undefined, fastStart: fileOut ? false : 'in-memory', firstTimestampBehavior: 'offset' });
    let err = null; const aq = []; let ai = 0, aP = 0;
    if (aBuf) {
      const ae = new AudioEncoder({ output: (c, m) => aq.push([c, m]), error: e => { err = e; } });
      ae.configure({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
      const ok = await mixVoices(V.voices, V.total, async (L, R, t0) => { const n = L.length, data = new Float32Array(n * 2); data.set(L, 0); data.set(R, n); const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(t0 * 1e6), data }); ae.encode(ad); ad.close(); if (ae.encodeQueueSize > 20) await new Promise(r => setTimeout(r, 0)); if (err) throw err; }, p => { if (o.onProgress) o.onProgress(p * 0.1, 0); }, o.cancelled);
      if (!ok) { try { ae.close(); } catch (e) {} return null; }
      await ae.flush(); ae.close(); if (err) throw err; aP = 0.1;
    }
    const ve = new VideoEncoder({ output: (c, m) => { while (ai < aq.length && aq[ai][0].timestamp <= c.timestamp) { const [ac2, am] = aq[ai++]; muxer.addAudioChunk(ac2, am); } muxer.addVideoChunk(c, m); }, error: e => { err = e; } });
    ve.configure({ codec, width: W, height: H, bitrate: bps, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' });
    const cv = o.canvas || document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { willReadFrequently: false });
    const us = 1e6 / fps;
    for (let i = 0; i < N; i++) {
      if (err) throw err;
      if (o.cancelled && o.cancelled()) { try { ve.close(); } catch (e) {} return null; }
      const T = Math.min(i / fps, V.total - 0.001); if (V.videos && V.videos.length) await seekVideos(V, T); drawAt(x, V, T);
      const fr = new VideoFrame(cv, { timestamp: Math.round(i * us), duration: Math.round(us) });
      ve.encode(fr, { keyFrame: i % (fps * 2) === 0 }); fr.close();
      if (ve.encodeQueueSize > 6 || i % 10 === 0) { await new Promise(r => setTimeout(r, 0)); if (o.onProgress) o.onProgress(aP + i / N * (1 - aP), T); }
      while (ve.encodeQueueSize > 12) await new Promise(r => setTimeout(r, 4));
    }
    await ve.flush(); ve.close(); if (err) throw err;
    while (ai < aq.length) { const [ac2, am] = aq[ai++]; muxer.addAudioChunk(ac2, am); }
    muxer.finalize();
    if (o.onProgress) o.onProgress(1, V.total);
    const prof = { '42': 'Baseline', '4d': 'Main', '64': 'High' }[codec.slice(5, 7)] || '', lvl = (parseInt(codec.slice(9, 11), 16) / 10).toFixed(1);
    const note = `MP4 · H.264 ${prof} ${lvl} · ${W}×${H} · ${fps}fps · ${V.total.toFixed(1)}초${aBuf ? ' · 소리(AAC)' : ''}`;
    if (fileOut) { await o.writable.close(); return { file: true, ext: 'mp4', note }; }
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4', note };
  }

  /* ---------- 여러 트랙(영상+소리) 조각난 MP4 → 일반 MP4 ----------
     영상만 있으면 소식지 엔진의 mp4Defrag(검증된 원문)를 쓰고, 소리가 함께 있으면 이것을 씀.
     표본(sample)마다 한 묶음(chunk)으로 적어 원래 끼워 넣어진 순서를 그대로 둠. */
  function defragMulti(buf) {
    const u = new Uint8Array(buf), dv = new DataView(buf);
    const kids = (st, en) => { const o = []; let p = st; while (p + 8 <= en) { let sz = dv.getUint32(p), h = 8; const tp = String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]); if (sz === 1) { sz = dv.getUint32(p + 8) * 4294967296 + dv.getUint32(p + 12); h = 16; } else if (sz === 0) sz = en - p; if (sz < 8 || p + sz > en) break; o.push({ t: tp, s: p, e: p + sz, b: p + h }); p += sz; } return o; };
    const find = (l, t) => l.find(k => k.t === t) || null;
    const top = kids(0, u.length), moov = find(top, 'moov'); if (!moov || !find(top, 'moof')) return null;
    const mk = kids(moov.b, moov.e), mvhd = find(mk, 'mvhd'), mvex = find(mk, 'mvex'); if (!mvhd) return null;
    const trex = {}; if (mvex) kids(mvex.b, mvex.e).filter(k => k.t === 'trex').forEach(tx => { trex[dv.getUint32(tx.b + 4)] = { dur: dv.getUint32(tx.b + 12), size: dv.getUint32(tx.b + 16), flags: dv.getUint32(tx.b + 20) }; });
    const T = {};
    mk.filter(k => k.t === 'trak').forEach(tr => {
      const tk = kids(tr.b, tr.e), tkhd = find(tk, 'tkhd'), mdia = find(tk, 'mdia'); if (!tkhd || !mdia) return;
      const id = dv.getUint32(tkhd.b + (u[tkhd.b] === 1 ? 20 : 12));
      const md = kids(mdia.b, mdia.e), mdhd = find(md, 'mdhd'), hdlr = find(md, 'hdlr'), minf = find(md, 'minf'); if (!mdhd || !hdlr || !minf) return;
      const mi = kids(minf.b, minf.e), stbl = find(mi, 'stbl'); if (!stbl) return; const stsd = find(kids(stbl.b, stbl.e), 'stsd'); if (!stsd) return;
      T[id] = { id, tkhd, mdhd, hdlr, minfOther: mi.filter(k => k.t !== 'stbl'), stsd, ts: u[mdhd.b] === 1 ? dv.getUint32(mdhd.b + 20) : dv.getUint32(mdhd.b + 12), S: [], vid: String.fromCharCode(u[hdlr.b + 8], u[hdlr.b + 9], u[hdlr.b + 10], u[hdlr.b + 11]) === 'vide' };
    });
    if (!Object.keys(T).length) return null;
    top.forEach(bx => {
      if (bx.t !== 'moof') return;
      kids(bx.b, bx.e).forEach(tf => {
        if (tf.t !== 'traf') return;
        const tfk = kids(tf.b, tf.e), tfhd = find(tfk, 'tfhd'); if (!tfhd) return;
        const fl = dv.getUint32(tfhd.b) & 0xffffff, id = dv.getUint32(tfhd.b + 4), tr = T[id]; if (!tr) return;
        const tx = trex[id] || { dur: 0, size: 0, flags: 0 };
        let p = tfhd.b + 8, base = bx.s, dDur = tx.dur, dSize = tx.size, dFlags = tx.flags;
        if (fl & 0x1) { base = dv.getUint32(p) * 4294967296 + dv.getUint32(p + 4); p += 8; } if (fl & 0x2) p += 4; if (fl & 0x8) { dDur = dv.getUint32(p); p += 4; } if (fl & 0x10) { dSize = dv.getUint32(p); p += 4; } if (fl & 0x20) { dFlags = dv.getUint32(p); p += 4; }
        let pos = -1;
        tfk.forEach(tn => {
          if (tn.t !== 'trun') return;
          const ver = u[tn.b], rf = dv.getUint32(tn.b) & 0xffffff, n = dv.getUint32(tn.b + 4); let q = tn.b + 8, first = null;
          if (rf & 0x1) { pos = base + dv.getInt32(q); q += 4; } else if (pos < 0) pos = base;
          if (rf & 0x4) { first = dv.getUint32(q); q += 4; }
          for (let i = 0; i < n; i++) { let d = dDur, z = dSize, f = dFlags, c = 0; if (rf & 0x100) { d = dv.getUint32(q); q += 4; } if (rf & 0x200) { z = dv.getUint32(q); q += 4; } if (rf & 0x400) { f = dv.getUint32(q); q += 4; } else if (i === 0 && first != null) f = first; if (rf & 0x800) { c = ver ? dv.getInt32(q) : dv.getUint32(q); q += 4; } tr.S.push({ o: pos, z, d, k: !(f & 0x10000), c }); pos += z; }
        });
      });
    });
    const tracks = Object.values(T).filter(t => t.S.length); if (!tracks.length) return null;
    for (const t of tracks) { for (const s of t.S) if (s.o + s.z > u.length) return null; for (let i = 0; i < t.S.length; i++) if (!t.S[i].d) t.S[i].d = i > 0 ? t.S[i - 1].d : Math.max(1, Math.round(t.ts / 30)); t.total = t.S.reduce((a, s) => a + s.d, 0); if (t.vid && !t.S.some(s => s.k)) t.S[0].k = true; }
    const mvTs = u[mvhd.b] === 1 ? dv.getUint32(mvhd.b + 20) : dv.getUint32(mvhd.b + 12);
    const cat = arr => { let n = 0; arr.forEach(a => n += a.length); const o = new Uint8Array(n); let p = 0; arr.forEach(a => { o.set(a, p); p += a.length; }); return o; };
    const box = (t, ...parts) => { const body = cat(parts), o = new Uint8Array(8 + body.length); new DataView(o.buffer).setUint32(0, o.length); for (let k = 0; k < 4; k++) o[4 + k] = t.charCodeAt(k); o.set(body, 8); return o; };
    const u32s = l => { const o = new Uint8Array(l.length * 4), d = new DataView(o.buffer); l.forEach((v, k) => d.setUint32(k * 4, v >>> 0)); return o; };
    const i32s = l => { const o = new Uint8Array(l.length * 4), d = new DataView(o.buffer); l.forEach((v, k) => d.setInt32(k * 4, v)); return o; };
    const copy = bx => u.slice(bx.s, bx.e);
    const setDur = (arr, v) => { const d = new DataView(arr.buffer), ver = arr[8], isTk = String.fromCharCode(arr[4], arr[5], arr[6], arr[7]) === 'tkhd'; if (ver === 1) { const off = isTk ? 36 : 32; d.setUint32(off, Math.floor(v / 4294967296)); d.setUint32(off + 4, v >>> 0); } else d.setUint32(isTk ? 28 : 24, v >>> 0); return arr; };
    // 새 mdat 안 순서: 원래 파일 위치 순서(영상·소리가 번갈아 들어간 그대로)
    const all = []; tracks.forEach(t => t.S.forEach(s => all.push(s))); all.sort((a, b) => a.o - b.o);
    const runs = (l, key) => { const o = []; let r = 0, last = null; l.forEach(s => { const v = key(s); if (v === last) r++; else { if (r) o.push(r, last); r = 1; last = v; } }); o.push(r, last); return o; };
    const movDur = Math.max(...tracks.map(t => Math.round(t.total * mvTs / t.ts)));
    const build = start => {
      let p = start; all.forEach(s => { s.no = p; p += s.z; });
      const traks = tracks.map(t => {
        const N = t.S.length, stts = runs(t.S, s => s.d), parts = [copy(t.stsd), box('stts', u32s([0, stts.length / 2].concat(stts)))];
        if (t.S.some(s => s.c)) { const ct = runs(t.S, s => s.c), hd = new Uint8Array(8); hd[0] = 1; new DataView(hd.buffer).setUint32(4, ct.length / 2); parts.push(box('ctts', hd, i32s(ct))); }
        if (t.vid) { const sync = []; t.S.forEach((s, i) => { if (s.k) sync.push(i + 1); }); if (sync.length < N) parts.push(box('stss', u32s([0, sync.length].concat(sync)))); }
        parts.push(box('stsc', u32s([0, 1, 1, 1, 1])), box('stsz', u32s([0, 0, N].concat(t.S.map(s => s.z)))), box('stco', u32s([0, N].concat(t.S.map(s => s.no)))));
        const tk = setDur(copy(t.tkhd), Math.round(t.total * mvTs / t.ts)); tk[11] |= 7;
        return box('trak', tk, box('mdia', setDur(copy(t.mdhd), t.total), copy(t.hdlr), box('minf', ...t.minfOther.map(copy), box('stbl', ...parts))));
      });
      return box('moov', setDur(copy(mvhd), movDur), ...traks);
    };
    const ftyp = box('ftyp', new Uint8Array([0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32, 0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31]));
    const dataLen = all.reduce((a, s) => a + s.z, 0); if (dataLen + 8 > 4294967295) return null;
    const probe = build(0), start = ftyp.length + probe.length + 8, nMoov = build(start); if (nMoov.length !== probe.length) return null;
    const mh = new Uint8Array(8); new DataView(mh.buffer).setUint32(0, dataLen + 8); mh[4] = 0x6d; mh[5] = 0x64; mh[6] = 0x61; mh[7] = 0x74;
    const parts = [ftyp, nMoov, mh]; all.forEach(s => parts.push(u.subarray(s.o, s.o + s.z)));
    return { parts, seconds: movDur / mvTs };
  }

  // '차례로 나타나기': 글자·사진·묶음 단위로 위→아래, 왼→오 순서. 큰 배경·잠긴 것·작은 장식은 그대로 둠. 한 쪽에 8개까지
  function autoAnimate(pg, docW, docH) {
    const units = new Map(), area = docW * docH;
    pg.els.forEach(el => { if (el.hidden || el.locked) return; const k = el.group || el.id; if (!units.has(k)) units.set(k, []); units.get(k).push(el); });
    const list = [];
    units.forEach(els => {
      const x0 = Math.min(...els.map(e => e.x)), y0 = Math.min(...els.map(e => e.y)), x1 = Math.max(...els.map(e => e.x + e.w)), y1 = Math.max(...els.map(e => e.y + e.h)), a = (x1 - x0) * (y1 - y0);
      if (a >= area * 0.45) return;
      const deco = els.every(e => e.type === 'path' || e.type === 'shape');
      if (deco && (els.length === 1 ? a < area * 0.03 : a < area * 0.02)) return;
      list.push({ els, x: x0, y: y0, a, t: els.some(e => e.type === 'text') ? 'rise' : els.some(e => e.type === 'image') ? 'zoom' : 'fade' });
    });
    const row = Math.max(4, docH * 0.04);
    list.sort((p, q) => Math.round(p.y / row) - Math.round(q.y / row) || p.x - q.x);
    let n = 0; list.slice(0, 8).forEach((u, k) => { const an = { t: u.t, d: Math.round(0.18 * k * 100) / 100, s: 0.7 }; u.els.forEach(e => { e.anim = Object.assign({}, an); n++; }); });
    return n;
  }
  return { trans, TRANS_CATS, TRANS_DIRS, TRANS_NOTE, TRANS_MIX, vkAt, ANIMS, TEXT_ANIMS, OUTS, LOOPS, KBS, CAMS, TRANS, DEF, outSize, build, timing, drawAt, sceneStarts, at, player, record, encode, canFast, decode, peaks, hasAnim, moves, autoAnimate, defragMulti, ctx, schedule, scheduleSfx, playVoices, mixVoices, syncVideos, seekVideos, CAP_STYLES };
})();
