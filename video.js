// 영상 만들기 — 디자인의 쪽을 장면으로: 요소 애니메이션(나타나기·사라지기·계속 움직이기·글자 효과)·넘김 효과·카메라·배경 음악 → MP4
// 캡컷(CapCut)의 편집 방식을 참고. 그리기: 쪽마다 '고정 요소 묶음'과 '움직이는 요소'를 층(캔버스)으로 한 번만 그려 두고
// (움직이는 층은 요소 상자 크기로 잘라 둠) 매 프레임 층을 변형해 겹쳐 그림. 무작위 효과는 시각으로 정해 미리보기와 저장본이 같음.
window.NC = window.NC || {};
NC.video = (function () {
  const ANIMS = [['none', '없음'], ['fade', '나타나기'], ['rise', '떠오르기'], ['drop', '내려오기'], ['left', '왼쪽에서'], ['right', '오른쪽에서'], ['zoom', '커지며'], ['zoomout', '작아지며'], ['pop', '톡 튀어나오기'], ['bounce', '통통 튀며'], ['spin', '돌며 나타나기'], ['flip', '뒤집으며'], ['blur', '흐릿하게'], ['wipe', '펼치기']];
  const TEXT_ANIMS = [['type', '타자기'], ['char', '한 글자씩'], ['word', '단어씩'], ['line', '한 줄씩']];
  const OUTS = [['none', '없음'], ['fade', '사라지기'], ['rise', '위로 사라지기'], ['drop', '아래로 사라지기'], ['left', '왼쪽으로'], ['right', '오른쪽으로'], ['zoom', '작아지며'], ['zoomout', '커지며 사라지기'], ['spin', '돌며 사라지기'], ['blur', '흐릿하게'], ['wipe', '걷어 내기']];
  const LOOPS = [['none', '없음'], ['pulse', '두근두근'], ['float', '둥실둥실'], ['swing', '흔들흔들'], ['shake', '부르르'], ['blink', '깜빡깜빡'], ['spin', '빙글빙글'], ['beat', '쿵쿵']];
  const KBS = [['none', '없음'], ['in', '천천히 다가가기'], ['out', '천천히 물러나기'], ['left', '왼쪽으로 흐르기'], ['right', '오른쪽으로 흐르기'], ['up', '위로 흐르기'], ['down', '아래로 흐르기']];
  const CAMS = [['none', '없음'], ['in', '천천히 다가가기'], ['out', '천천히 물러나기'], ['left', '왼쪽으로 흐르기'], ['right', '오른쪽으로 흐르기']];
  const TRANS = [['soft', '부드럽게 넘김'], ['fade', '겹치며 바뀜'], ['slide', '옆으로 밀기'], ['bounce', '밀고 튕기기'], ['up', '위로 밀기'], ['zoom', '다가오며'], ['pullin', '당겨 들어가기'], ['pullout', '물러나기'], ['whip', '휙 넘기기'], ['spin', '빙글 돌며'], ['blur', '흐려지며 바뀜'], ['flash', '번쩍'], ['black', '검게 넘김'], ['iris', '원으로 열기'], ['wipe', '닦아내기'], ['blinds', '블라인드'], ['glitch', '지지직'], ['shake', '흔들며 바뀜'], ['none', '바로 바뀜']];
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
        if (e.type === 'video') { L.video = { el: e, box: { x: e.x * kx, y: e.y * ky, w: e.w * kx, h: e.h * ky }, rad: Number(e.radius || 0) * kx, tin: Number(e.tin || 0), tout: Number(e.tout || e.dur || 0), loop: !!e.loop, d0: e.anim ? Number(e.anim.d || 0) : 0 }; L.vEl = o.videoEl ? await o.videoEl(e) : null; }
        layers.push(L);
      }
      if (P.top.length) layers.push({ cv: cvs[cvs.length - 1], ox: 0, oy: 0 });
      const tr = pg.vtrans || V.trans, turn = tr === 'none' ? 0 : Number(pg.vturn || V.turn);
      scenes.push({ dur: Number(pg.vdur || V.dur), trans: tr, turn, layers, bg: pg.bg || '#ffffff', cam: typeof pg.vcam === 'string' ? (pg.vcam !== 'none' && pg.vcam ? { t: pg.vcam, a: Number(pg.vcamA || 0.06) } : null) : (has(pg.vcam) ? pg.vcam : null) });
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
  function poseIn(t, e, p, W, H) {
    const o = { al: 1, dx: 0, dy: 0, s: 1, sx: 1, rot: 0, blur: 0, wipe: 1 };
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
    }
    return o;
  }
  function poseLoop(t, lp, W, H, tt) {
    const T = Math.max(0.2, Number(lp.T || 1.2)), a = Number(lp.a || 1), o = { al: 1, dx: 0, dy: 0, s: 1, rot: 0, pivotTop: false }, ph = 2 * Math.PI * tt / T;
    switch (lp.t) {
      case 'pulse': o.s = 1 + 0.04 * a * Math.pow(Math.sin(Math.PI * tt / T), 2); break;
      case 'float': o.dy = 0.012 * H * a * Math.sin(ph); break;
      case 'swing': o.rot = 4 * a * Math.PI / 180 * Math.sin(ph); o.pivotTop = true; break;
      case 'shake': { const k = Math.floor(tt * 20); o.dx = (rnd(k, 1) - 0.5) * 6 * a; o.dy = (rnd(k, 2) - 0.5) * 6 * a; break; }
      case 'blink': o.al = 0.55 + 0.45 * Math.cos(ph); break;
      case 'spin': o.rot = 2 * Math.PI * tt / T; break;
      case 'beat': { const q = (tt % T) / T, b = q < 0.12 ? Math.sin(q / 0.12 * Math.PI) : q > 0.2 && q < 0.32 ? 0.6 * Math.sin((q - 0.2) / 0.12 * Math.PI) : 0; o.s = 1 + 0.06 * a * b; break; }
    }
    return o;
  }
  // 층 하나를 장면 시각 t(초)에 그림 (D = 장면 길이)
  function drawLayer(x, L, t, D, W, H) {
    if (!L.cv && !L.video) return;
    if (!L.video && !L.anim && !L.out && !L.loop && !L.kb) { x.drawImage(L.cv, L.ox, L.oy); return; }
    let al = 1, dx = 0, dy = 0, s = 1, sx = 1, rot = 0, blur = 0, wipe = 1, unwipe = 0, pivotTop = false, pIn = 1;
    const mix = o => { al *= o.al; dx += o.dx; dy += o.dy; s *= o.s; sx *= (o.sx || 1); rot += o.rot; blur = Math.max(blur, o.blur || 0); if (o.wipe != null) wipe = Math.min(wipe, o.wipe); if (o.pivotTop) pivotTop = true; };
    const A = L.anim;
    if (A) { const d = Number(A.d || 0), sp = Math.max(0.05, Number(A.s || 0.8)); pIn = clamp01((t - d) / sp); if (!L.units) { if (pIn <= 0) return; if (pIn < 1) mix(poseIn(A.t, ease(pIn), pIn, W, H)); } }
    if (L.out) { const so = Math.max(0.05, Number(L.out.s || 0.6)), at = Number(L.out.at || 0), pO = clamp01((t - (D - at - so)) / so); if (pO >= 1) return; if (pO > 0) { if (L.out.t === 'wipe') unwipe = ease(pO); else mix(poseIn(L.out.t, ease(1 - pO), 1 - pO, W, H)); } }
    if (L.loop && pIn >= 1) mix(poseLoop(t, L.loop, W, H, t - (A ? Number(A.d || 0) + Number(A.s || 0.8) : 0)));
    x.save(); if (al < 1) x.globalAlpha = x.globalAlpha * Math.max(0, al); if (blur > 0.3) x.filter = `blur(${blur.toFixed(1)}px)`;
    const px = L.cx, py = pivotTop ? L.box.y : L.cy;
    if (dx || dy || s !== 1 || sx !== 1 || rot) { x.translate(px + dx, py + dy); if (rot) x.rotate(rot); x.scale(s * sx, s); x.translate(-px, -py); }
    if (wipe < 1 || unwipe > 0) { const b = L.box; x.beginPath(); x.rect(b.x - 4 + (b.w + 8) * unwipe, b.y - 4, (b.w + 8) * (wipe - unwipe), b.h + 8); x.clip(); }
    if (L.kb) { // 사진 천천히 움직이기: 사진 상자 안에서 확대·이동
      const b = L.kbox, u = clamp01(t / Math.max(0.1, D)), a = Number(L.kb.a || 0.12), k = L.kb.t;
      const sc = k === 'out' ? 1 + a * (1 - u) : 1 + a * (k === 'in' ? u : 0.5), mx = (k === 'left' ? -1 : k === 'right' ? 1 : 0) * a * b.w / 2 * (u - 0.5), my = (k === 'up' ? -1 : k === 'down' ? 1 : 0) * a * b.h / 2 * (u - 0.5);
      x.beginPath(); x.rect(b.x, b.y, b.w, b.h); x.clip(); const kcx = b.x + b.w / 2, kcy = b.y + b.h / 2; x.translate(kcx + mx, kcy + my); x.scale(sc, sc); x.translate(-kcx, -kcy);
    }
    if (L.video) drawVideo(x, L); else if (L.units && A) drawUnits(x, L, t, A); else x.drawImage(L.cv, L.ox, L.oy);
    x.restore();
  }
  // 동영상 층: 지금 프레임을 상자에 채워(cover/contain) 그림. 둥근 모서리
  function drawVideo(x, L) {
    const v = L.vEl, b = L.video.box, el = L.video.el; if (!v || !v.videoWidth) { x.fillStyle = '#222'; x.fillRect(b.x, b.y, b.w, b.h); return; }
    const vw = v.videoWidth, vh = v.videoHeight, cover = (el.fit || 'cover') !== 'contain', k = cover ? Math.max(b.w / vw, b.h / vh) : Math.min(b.w / vw, b.h / vh), dw = vw * k, dh = vh * k;
    x.save(); x.beginPath(); if (L.video.rad > 0 && x.roundRect) x.roundRect(b.x, b.y, b.w, b.h, L.video.rad); else x.rect(b.x, b.y, b.w, b.h); x.clip();
    x.drawImage(v, b.x + (b.w - dw) / 2, b.y + (b.h - dh) / 2, dw, dh); x.restore();
  }
  // 동영상의 '원본 시각': 장면 시각 t → 사용 구간(tin~tout) 안의 시각
  function mediaTime(L, t) { const d = L.video, len = Math.max(0.05, d.tout - d.tin), u = Math.max(0, t - d.d0); return d.tin + (d.loop ? u % len : Math.min(u, len - 0.04)); }
  // 시각 T에 화면에 나오는 동영상 층들
  function activeVideos(V, T) { const { i, q } = at(V, T), A = V.scenes[i], out = []; A.layers.forEach(L => { if (L.vEl) out.push({ L, t: q }); }); if (q >= A.dur && A.turn) { const B = V.scenes[(i + 1) % V.scenes.length]; B.layers.forEach(L => { if (L.vEl) out.push({ L, t: 0 }); }); } return out; }
  // 미리보기: 재생 중이면 동영상도 재생(어긋나면 맞춤), 멈췄으면 그 시각으로 감기
  function syncVideos(V, T, playing) { const act = new Set(); activeVideos(V, T).forEach(({ L, t }) => { const v = L.vEl, mt = mediaTime(L, t); act.add(v); if (playing) { if (Math.abs(v.currentTime - mt) > 0.25) v.currentTime = mt; if (v.paused) v.play().catch(() => {}); } else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - mt) > 0.04) v.currentTime = mt; } }); (V.videos || []).forEach(v => { if (!act.has(v) && !v.paused) v.pause(); }); }
  // 저장: 프레임마다 정확한 시각으로 감고 기다림
  async function seekVideos(V, T) { await Promise.all(activeVideos(V, T).map(({ L, t }) => new Promise(res => { const v = L.vEl, mt = mediaTime(L, t); if (Math.abs(v.currentTime - mt) < 0.001 && v.readyState >= 2) { res(); return; } const done = () => { v.removeEventListener('seeked', done); clearTimeout(to); res(); }, to = setTimeout(done, 1500); v.addEventListener('seeked', done); v.currentTime = mt; }))); }
  // 글자 효과: 글자 층을 한 번만 그려 두고 글자·단어·줄 칸만 잘라 보여 줌
  function drawUnits(x, L, t, A) {
    const d = Number(A.d || 0), sp = Math.max(0.1, Number(A.s || 0.8)), U = L.units, N = U.length; if (!N) { x.drawImage(L.cv, L.ox, L.oy); return; }
    const p = clamp01((t - d) / sp); if (p >= 1) { x.drawImage(L.cv, L.ox, L.oy); return; } if (p <= 0) return;
    if (A.t === 'type') { const n = p * N, k = Math.floor(n); x.beginPath(); L.lines.forEach(l => { if (l.last < k) x.rect(L.ox + l.x0 - 6, L.oy + l.y - 4, l.x1 - l.x0 + 12, l.y1 - l.y + 8); else if (l.first <= k && k < N) { const u = U[k], cut = u.x + u.w * (n - k); x.rect(L.ox + l.x0 - 6, L.oy + l.y - 4, cut - l.x0 + 6, l.y1 - l.y + 8); } }); x.clip(); x.drawImage(L.cv, L.ox, L.oy); return; }
    if (A.t === 'line') { const n = L.lines.length, st = Math.min(0.15, sp * 0.6 / Math.max(1, n)), one = Math.max(0.15, sp - st * (n - 1)); L.lines.forEach((l, i) => { const q = clamp01((t - d - i * st) / one); if (q <= 0) return; const e = ease(q); x.save(); x.globalAlpha *= e; x.beginPath(); x.rect(L.ox + l.x0 - 8, L.oy + l.y - 6, l.x1 - l.x0 + 16, l.y1 - l.y + 12); x.clip(); x.drawImage(L.cv, L.ox, L.oy + (1 - e) * (l.y1 - l.y) * 0.7); x.restore(); }); return; }
    // 한 글자씩·단어씩: 원본의 작은 칸만 옮겨 그림 (빠름)
    const groups = []; if (A.t === 'word') { let g = null; U.forEach((u, i) => { if (u.sp) { g = null; return; } if (!g || g.line !== u.line) { g = { line: u.line, x: u.x, y: u.y, x1: u.x + u.w, y1: u.y + u.h }; groups.push(g); } else { g.x1 = u.x + u.w; g.y = Math.min(g.y, u.y); g.y1 = Math.max(g.y1, u.y + u.h); } }); }
    else U.forEach(u => { if (!u.sp) groups.push({ x: u.x, y: u.y, x1: u.x + u.w, y1: u.y + u.h }); });
    const n = groups.length, st = Math.min(A.t === 'word' ? 0.12 : 0.045, sp * 0.7 / Math.max(1, n)), one = Math.max(0.12, sp - st * (n - 1));
    groups.forEach((g, i) => { const q = clamp01((t - d - i * st) / one); if (q <= 0) return; const e = ease(q), h = g.y1 - g.y, mx = 3, my = Math.round(h * 0.25), sx0 = Math.max(0, g.x - mx), sy0 = Math.max(0, g.y - my), sw = Math.min(L.cv.width - sx0, g.x1 - g.x + mx * 2), sh = Math.min(L.cv.height - sy0, h + my * 2); if (sw <= 0 || sh <= 0) return; x.save(); x.globalAlpha *= e; x.drawImage(L.cv, sx0, sy0, sw, sh, L.ox + sx0, L.oy + sy0 + (1 - e) * h * 0.6, sw, sh); x.restore(); });
  }
  // 한 장면을 장면 시각 t(초)에: 카메라(천천히 다가가기 등)를 건 뒤 층을 차례로
  function drawScene(x, sc, t, W, H) {
    x.save();
    if (sc.cam) { const u = clamp01(t / Math.max(0.1, sc.dur + sc.turn)), a = Number(sc.cam.a || 0.06), k = sc.cam.t, s = k === 'out' ? 1 + a * (1 - u) : 1 + a * (k === 'in' ? u : 0.6), mx = (k === 'left' ? -1 : k === 'right' ? 1 : 0) * a * W * 0.5 * (u - 0.5); x.translate(W / 2 + mx, H / 2); x.scale(s, s); x.translate(-W / 2, -H / 2); }
    sc.layers.forEach(L => drawLayer(x, L, t, sc.dur, W, H));
    x.restore();
  }
  // 영상 전체 시각 T(초)의 화면
  const _tmp = {};
  function off(slot, W, H) { let c = _tmp[slot]; if (!c || c.width !== W || c.height !== H) { c = _tmp[slot] = document.createElement('canvas'); c.width = W; c.height = H; } const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = 'none'; x.clearRect(0, 0, W, H); return c; }
  function at(V, T) { let acc = 0; for (let i = 0; i < V.scenes.length; i++) { const s = V.scenes[i], u = s.dur + s.turn; if (T < acc + u || i === V.scenes.length - 1) return { i, q: Math.min(T - acc, u), t0: acc }; acc += u; } return { i: 0, q: 0, t0: 0 }; }
  function sceneStarts(V) { let a = 0; return V.scenes.map(s => { const r = a; a += s.dur + s.turn; return r; }); }
  function drawAt(x, V, T) {
    const { W, H } = V; const { i, q } = at(V, T), A = V.scenes[i];
    x.save(); x.fillStyle = A.bg; x.fillRect(0, 0, W, H);
    if (q < A.dur || !A.turn) { drawScene(x, A, q, W, H); drawTracks(x, V, T); x.restore(); return; }
    const j = (i + 1) % V.scenes.length, B = V.scenes[j], p = clamp01((q - A.dur) / A.turn);
    const ca = off('a', W, H), cb = off('b', W, H); const xa = ca.getContext('2d'), xb = cb.getContext('2d');
    xa.fillStyle = A.bg; xa.fillRect(0, 0, W, H); drawScene(xa, A, q, W, H);
    xb.fillStyle = B.bg; xb.fillRect(0, 0, W, H); drawScene(xb, B, 0, W, H);
    trans(x, ca, cb, p, A.trans, W, H, B.bg, Math.floor(T * 30)); drawTracks(x, V, T); x.restore();
  }
  // 자막·오버레이 트랙 (장면 위에 영상 전체 시간 기준으로 겹침)
  const CAP_STYLES = [['outline', '흰 글자 외곽선'], ['box', '검은 상자'], ['pop', '노란 강조'], ['karaoke', '단어씩 강조'], ['plain', '그림자만']];
  function wrapText(x, text, maxW) { const out = []; String(text).split('\n').forEach(par => { let line = ''; par.split(/(\s+)/).forEach(w => { const t = line + w; if (x.measureText(t).width > maxW && line.trim()) { out.push(line.trim()); line = w.trim(); } else line = t; }); out.push(line.trim()); }); return out; }
  function drawCaption(x, c, T, W, H) {
    const u = T - c.at, d = Number(c.dur || 2.5); if (u < 0 || u > d) return;
    const fade = Math.min(1, u / 0.18, (d - u) / 0.18), sz = Math.round(Math.min(W, H) * Number(c.size || 0.065)), st = c.style || 'outline';
    x.save(); x.globalAlpha = Math.max(0, fade); x.font = `${c.weight || 800} ${sz}px "${c.font || 'Pretendard'}", "Pretendard", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const lines = wrapText(x, c.text || '', W * 0.86), lh = sz * 1.25, y0 = (c.pos === 'top' ? H * 0.14 : c.pos === 'middle' ? H * 0.5 : H * 0.84) - (lines.length - 1) * lh / 2;
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
    const fade = Math.min(1, u / 0.3, (d - u) / 0.3), w = W * Number(o.scale || 0.18), h = w * o.img.naturalHeight / o.img.naturalWidth, m = Math.min(W, H) * 0.04, p = o.pos || 'tr';
    const px = p[1] === 'l' ? m : p[1] === 'r' ? W - w - m : (W - w) / 2, py = p[0] === 't' ? m : p[0] === 'b' ? H - h - m : (H - h) / 2;
    x.save(); x.globalAlpha = Math.max(0, fade) * (o.opacity == null ? 1 : Number(o.opacity)); x.drawImage(o.img, px, py, w, h); x.restore();
  }
  function drawTracks(x, V, T) { (V.overlays || []).forEach(o => drawOverlay(x, o, T, V.W, V.H)); (V.captions || []).forEach(c => drawCaption(x, c, T, V.W, V.H)); }
  // 넘김 효과 (A 앞 장면, B 다음 장면, p 진행률)
  function trans(x, A, B, p, st, W, H, bg, f) {
    const e = io(p), full = (c, al) => { if (al != null) { x.save(); x.globalAlpha = al; x.drawImage(c, 0, 0, W, H); x.restore(); } else x.drawImage(c, 0, 0, W, H); };
    const zoomed = (c, s, al, rot, n, spread) => { n = n || 1; for (let k = 0; k < n; k++) { const sk = s * (1 + (spread || 0) * k); x.save(); x.globalAlpha = (al == null ? 1 : al) / (n > 1 ? (k === 0 ? 1 : 2.2 * k) : 1); x.translate(W / 2, H / 2); if (rot) x.rotate(rot); x.scale(sk, sk); x.drawImage(c, -W / 2, -H / 2, W, H); x.restore(); } };
    switch (st) {
      case 'slide': case 'bounce': { const ee = st === 'bounce' ? back(p) : e, dx = Math.round(W * ee); full(A); x.drawImage(A, -dx, 0, W, H); x.drawImage(B, W - dx, 0, W, H); const sx = W - dx, gr = x.createLinearGradient(sx - 70, 0, sx, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.16)'); x.fillStyle = gr; x.fillRect(sx - 70, 0, 70, H); return; }
      case 'up': { const dy = Math.round(H * e); x.drawImage(A, 0, -dy, W, H); x.drawImage(B, 0, H - dy, W, H); return; }
      case 'fade': full(A); full(B, e); return;
      case 'zoom': full(A); zoomed(B, 1.12 - 0.12 * e, e); return;
      case 'pullin': if (p < 0.5) { const q = Math.pow(p * 2, 2); zoomed(A, 1 + 1.2 * q, 1, 0, 5, 0.03 * q); } else { const q = ease(p * 2 - 1); zoomed(B, 1.6 - 0.6 * q, 1, 0, q < 0.95 ? 4 : 1, 0.03 * (1 - q)); } return;
      case 'pullout': if (p < 0.5) { const q = Math.pow(p * 2, 2); zoomed(A, 1 - 0.4 * q, 1, 0); x.fillStyle = 'rgba(0,0,0,' + (0.3 * q) + ')'; } else { const q = ease(p * 2 - 1); full(B); zoomed(B, 1.5 - 0.5 * q, 1 - q * 0.0, 0); } return;
      case 'whip': { const q = expoIO(p), dx = W * q, v = Math.abs(expoIO(Math.min(1, p + 0.02)) - expoIO(Math.max(0, p - 0.02))) / 0.04; for (let k = 0; k < 6; k++) { const off2 = -v * W * 0.004 * k; x.save(); x.globalAlpha = k ? 0.18 : 1; x.drawImage(A, -dx + off2, 0, W, H); x.drawImage(B, W - dx + off2, 0, W, H); x.restore(); } return; }
      case 'spin': if (p < 0.5) { const q = ease(p * 2); x.fillStyle = bg || '#fff'; x.fillRect(0, 0, W, H); zoomed(A, 1 + 0.3 * q, 1 - q, Math.PI / 2 * q, 3, 0.02); } else { const q = ease(p * 2 - 1); x.fillStyle = bg || '#fff'; x.fillRect(0, 0, W, H); zoomed(B, 1.3 - 0.3 * q, q, -Math.PI / 2 * (1 - q), q < 0.9 ? 3 : 1, 0.02); } return;
      case 'blur': { const q = 1 - Math.abs(2 * p - 1), c = off('q', Math.ceil(W / 4), Math.ceil(H / 4)), cx = c.getContext('2d'); cx.filter = `blur(${(q * 6).toFixed(1)}px)`; cx.drawImage(A, 0, 0, c.width, c.height); cx.globalAlpha = e; cx.drawImage(B, 0, 0, c.width, c.height); cx.filter = 'none'; cx.globalAlpha = 1; full(A); full(B, e); if (q > 0.02) { x.save(); x.globalAlpha = Math.min(1, q * 1.6); x.drawImage(c, 0, 0, W, H); x.restore(); } return; }
      case 'flash': full(p < 0.5 ? A : B); x.fillStyle = `rgba(255,255,255,${Math.pow(1 - Math.abs(2 * p - 1), 0.6)})`; x.fillRect(0, 0, W, H); return;
      case 'black': full(p < 0.5 ? A : B); x.fillStyle = `rgba(0,0,0,${1 - Math.abs(2 * p - 1)})`; x.fillRect(0, 0, W, H); return;
      case 'iris': { full(A); const r = e * Math.hypot(W, H) / 2; x.save(); x.beginPath(); x.arc(W / 2, H / 2, Math.max(0.1, r), 0, Math.PI * 2); x.clip(); x.drawImage(B, 0, 0, W, H); x.restore(); return; }
      case 'wipe': { full(A); const edge = W * 0.08, xx = -edge + (W + edge * 2) * e, c = off('w', W, H), cx = c.getContext('2d'); cx.drawImage(B, 0, 0, W, H); cx.globalCompositeOperation = 'destination-in'; const g = cx.createLinearGradient(xx - edge, 0, xx, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); cx.globalCompositeOperation = 'source-over'; x.drawImage(c, 0, 0); return; }
      case 'blinds': { full(A); const n = 8, h = H / n; x.save(); x.beginPath(); for (let k = 0; k < n; k++) x.rect(0, k * h, W, h * e); x.clip(); x.drawImage(B, 0, 0, W, H); x.restore(); return; }
      case 'glitch': { full(p < 0.5 ? A : B); if (p > 0.25 && p < 0.75) { const src = p < 0.5 ? A : B, n = 6 + Math.floor(rnd(f, 3) * 5); for (let k = 0; k < n; k++) { const y = rnd(f, k * 7) * H, h = H * (0.02 + rnd(f, k * 11) * 0.08), d = (rnd(f, k * 13) - 0.5) * W * 0.1; x.drawImage(src, 0, y, W, h, d, y, W, h); } x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.35; x.drawImage(src, 8, 0, W, H); x.restore(); } return; }
      case 'shake': { const amp = W * 0.02 * (1 - Math.abs(2 * p - 1)), sx = (rnd(f, 5) - 0.5) * 2 * amp, sy = (rnd(f, 9) - 0.5) * 2 * amp; x.save(); x.translate(sx, sy); full(A); full(B, e); x.restore(); return; }
      case 'none': full(p < 0.5 ? A : B); return;
    }
    // soft: 소식지 TV 영상과 같은 '부드럽게 넘김' — 앞 장이 왼쪽으로 물러나며 옅어진 뒤 다음 장이 오른쪽에서 또렷해짐
    x.fillStyle = bg || '#fff'; x.fillRect(0, 0, W, H);
    const sh = Math.round(W * 0.035), ea = NC.news.tvEase(Math.min(1, p / 0.6)), eb = NC.news.tvEase(Math.max(0, (p - 0.35) / 0.65));
    x.save(); x.globalAlpha = 1 - ea; x.drawImage(A, -sh * ea, 0, W, H); x.restore();
    x.save(); x.globalAlpha = eb; x.drawImage(B, sh * (1 - eb), 0, W, H); x.restore();
  }

  /* ---------- 소리 ---------- */
  let AC = null;
  const ctx = () => AC || (AC = new (window.AudioContext || window.webkitAudioContext)());
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
  // 음악 파형(타임라인용): 칸마다 최댓값
  function peaks(buf, n) { const d = buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / n)), out = new Float32Array(n); for (let i = 0; i < n; i++) { let m = 0; const s0 = i * step, e0 = Math.min(d.length, s0 + step); for (let k = s0; k < e0; k += 16) { const v = Math.abs(d[k]); if (v > m) m = v; } out[i] = m; } return out; }

  /* ---------- 미리보기 재생 ---------- */
  function player(canvas, V, audio) {
    const x = canvas.getContext('2d'); canvas.width = V.W; canvas.height = V.H;
    let t = 0, playing = false, t0 = 0, raf = 0, snd = null; const P = { onTime: null };
    const draw = () => { if (V.videos && V.videos.length) syncVideos(V, t, playing); drawAt(x, V, Math.min(t, V.total - 0.001)); if (P.onTime) P.onTime(t); };
    const loop = () => { t = (performance.now() - t0) / 1000; if (t >= V.total) { t = V.total; P.pause(); draw(); return; } draw(); raf = requestAnimationFrame(loop); };
    P.play = () => { if (playing) return; if (t >= V.total - 0.01) t = 0; playing = true; t0 = performance.now() - t * 1000; const ac = ctx(); ac.resume && ac.resume(); const m = audio && audio.buf ? music(audio.buf, audio, ac.destination, t, V.total) : null, fx = scheduleSfx(ac, ac.destination, V.sfx, t, ac.currentTime); snd = { stop() { if (m) m.stop(); fx.stop(); } }; loop(); };
    P.pause = () => { playing = false; cancelAnimationFrame(raf); if (snd) { snd.stop(); snd = null; } (V.videos || []).forEach(v => v.pause()); };
    P.seek = v => { const was = playing; P.pause(); t = Math.max(0, Math.min(V.total, v)); draw(); if (was) P.play(); };
    P.toggle = () => playing ? P.pause() : P.play();
    P.isPlaying = () => playing; P.destroy = () => P.pause();
    draw(); return P;
  }

  /* ---------- 녹화 ---------- */
  function mimeFor(withAudio) {
    if (!window.MediaRecorder) return '';
    if (!withAudio) return NC.news.tvMime();
    const list = ['video/mp4;codecs=avc1.4d0028,mp4a.40.2', 'video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    for (const m of list) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} } return '';
  }
  // o = { V, canvas, audio:{buf,vol,fade}, onProgress(p, T), cancelled() } → { blob, ext, note | warn } | null(중지)
  function record(o) {
    return new Promise((resolve, reject) => {
      const V = o.V, withA = !!((o.audio && o.audio.buf) || (V.sfx && V.sfx.length)), mime = mimeFor(withA);
      if (!mime) { reject(new Error('이 브라우저는 영상 저장을 지원하지 않습니다. 크롬(Chrome)에서 열어 주세요.')); return; }
      const cv = o.canvas; cv.width = V.W; cv.height = V.H; const x = cv.getContext('2d'); drawAt(x, V, 0);
      const vs = cv.captureStream(30); let dest = null, snd = null;
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
      const t0 = performance.now(); if (withA) { const ac = ctx(), m = o.audio && o.audio.buf ? music(o.audio.buf, o.audio, dest, 0, V.total) : null, fx = scheduleSfx(ac, dest, V.sfx, 0, ac.currentTime); snd = { stop() { if (m) m.stop(); fx.stop(); } }; }
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
  async function pickCodec(W, H, fps, bps) {
    const big = W * H > 2100000, list = big ? ['avc1.640033', 'avc1.4d0033'] : ['avc1.4d0028', 'avc1.640028', 'avc1.4d002a', 'avc1.42e028', 'avc1.42e01f']; // TV 호환: Main 4.0 먼저
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
    const bps = Math.round(Math.min(16e6, Math.max(5e6, W * H * fps * 0.15)));
    await load(MUXER, () => !!window.Mp4Muxer);
    const codec = await pickCodec(W, H, fps, bps); if (!codec) throw new Error('이 컴퓨터에서 H.264 인코더를 쓸 수 없습니다');
    let aBuf = null, aOk = false;
    if ((o.audio && o.audio.buf) || (V.sfx && V.sfx.length)) {
      if (!window.AudioEncoder) throw new Error('소리 인코더 없음');
      try { aOk = (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 })).supported; } catch (e) { aOk = false; }
      if (!aOk) throw new Error('이 브라우저는 AAC 소리 인코딩을 지원하지 않습니다');
      aBuf = await mixAudio(o.audio, V.total, V.sfx);
    }
    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({ target, video: { codec: 'avc', width: W, height: H, frameRate: fps }, audio: aBuf ? { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 } : undefined, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
    let err = null;
    const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { err = e; } });
    ve.configure({ codec, width: W, height: H, bitrate: bps, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' });
    const cv = o.canvas || document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { willReadFrequently: false });
    const us = 1e6 / fps;
    for (let i = 0; i < N; i++) {
      if (err) throw err;
      if (o.cancelled && o.cancelled()) { try { ve.close(); } catch (e) {} return null; }
      const T = Math.min(i / fps, V.total - 0.001); if (V.videos && V.videos.length) await seekVideos(V, T); drawAt(x, V, T);
      const fr = new VideoFrame(cv, { timestamp: Math.round(i * us), duration: Math.round(us) });
      ve.encode(fr, { keyFrame: i % (fps * 2) === 0 }); fr.close();
      if (ve.encodeQueueSize > 6 || i % 10 === 0) { await new Promise(r => setTimeout(r, 0)); if (o.onProgress) o.onProgress(i / N * (aBuf ? 0.95 : 1), T); }
      while (ve.encodeQueueSize > 12) await new Promise(r => setTimeout(r, 4));
    }
    await ve.flush(); ve.close(); if (err) throw err;
    if (aBuf) {
      const ae = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => { err = e; } });
      ae.configure({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 });
      const L = aBuf.getChannelData(0), R = aBuf.getChannelData(1), STEP = 4800;
      for (let p = 0; p < aBuf.length; p += STEP) {
        const n = Math.min(STEP, aBuf.length - p), data = new Float32Array(n * 2); data.set(L.subarray(p, p + n), 0); data.set(R.subarray(p, p + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(p / 48000 * 1e6), data }); ae.encode(ad); ad.close();
        if (ae.encodeQueueSize > 20) await new Promise(r => setTimeout(r, 0));
      }
      await ae.flush(); ae.close(); if (err) throw err;
    }
    muxer.finalize();
    if (o.onProgress) o.onProgress(1, V.total);
    const prof = { '42': 'Baseline', '4d': 'Main', '64': 'High' }[codec.slice(5, 7)] || '', lvl = (parseInt(codec.slice(9, 11), 16) / 10).toFixed(1);
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4', note: `MP4 · H.264 ${prof} ${lvl} · ${W}×${H} · ${fps}fps · ${V.total.toFixed(1)}초${aBuf ? ' · 소리(AAC)' : ''}` };
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
  return { ANIMS, TEXT_ANIMS, OUTS, LOOPS, KBS, CAMS, TRANS, DEF, outSize, build, timing, drawAt, sceneStarts, at, player, record, encode, canFast, decode, peaks, hasAnim, moves, autoAnimate, defragMulti, ctx, schedule, scheduleSfx, syncVideos, seekVideos, CAP_STYLES };
})();
