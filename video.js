// 영상 만들기 — 디자인의 쪽을 장면으로, 요소 애니메이션·넘김 효과·배경 음악을 넣어 MP4로 (미리캔버스·캔바의 동영상 기능을 참고)
// 그리기: 쪽마다 '움직이지 않는 요소 묶음'과 '움직이는 요소'를 층(캔버스)으로 한 번만 그려 두고, 매 프레임 층을 겹쳐 그림.
// 녹화: 브라우저 녹화기(MediaRecorder)로 실제 시간만큼 녹화한 뒤 TV·SNS에서 재생되는 일반 MP4로 다시 묶음.
window.NC = window.NC || {};
NC.video = (function () {
  const ANIMS = [['none', '없음'], ['fade', '나타나기'], ['rise', '떠오르기'], ['drop', '내려오기'], ['left', '왼쪽에서'], ['right', '오른쪽에서'], ['zoom', '커지며'], ['pop', '톡 튀어나오기'], ['wipe', '펼치기']];
  const TRANS = [['soft', '부드럽게 넘김'], ['fade', '겹치며 바뀜'], ['slide', '옆으로 밀기'], ['up', '위로 밀기'], ['zoom', '다가오며'], ['none', '바로 바뀜']];
  const DEF = { dur: 5, trans: 'soft', turn: 1, loop: false, q: '1080' };
  const ease = t => 1 - Math.pow(1 - t, 3);
  const back = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const io = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));

  // 출력 크기: 짧은 변 1080(또는 720), 긴 변은 1920까지. 짝수로(H.264 규칙)
  function outSize(w, h, q) {
    const S = q === '720' ? 720 : 1080, L = q === '720' ? 1280 : 1920;
    let W, H; if (w >= h) { H = S; W = S * w / h; if (W > L) { W = L; H = L * h / w; } } else { W = S; H = S * h / w; if (H > L) { H = L; W = L * w / h; } }
    W = Math.round(W / 2) * 2; H = Math.round(H / 2) * 2; return { W, H };
  }
  const hasAnim = el => el.anim && el.anim.t && el.anim.t !== 'none';

  // 장면 만들기. o = { doc, pages:[{pg, i}], W, H, renderLayers([{pg, sets:[{els, withBg}]}], dpi, onProgress, cancelled) → Promise<canvas[][]> }
  async function build(o) {
    const V = Object.assign({}, DEF, o.doc.video || {}), dpi = o.W / (o.doc.w / 25.4), kx = o.W / o.doc.w, ky = o.H / o.doc.h;
    const boxOf = e => { const a = (e.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s2 = Math.abs(Math.sin(a)), w = e.w * c + e.h * s2, h = e.w * s2 + e.h * c; return { x: e.x + e.w / 2 - w / 2, y: e.y + e.h / 2 - h / 2, w, h }; };
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const key = e => JSON.stringify([e.anim.t, Number(e.anim.d || 0), Number(e.anim.s || 0.8)]) + '|' + (e.group || e.id);
    // 1) 쪽마다 층 나누기: 움직이는 요소는 (같은 묶음·같은 움직임끼리) 한 층씩, 고정 요소는 맨 아래 한 층.
    //    단, 움직이는 요소 위에 겹쳐 있던 고정 요소는 위쪽 층으로 올려 가려지지 않게 → 층 수 = 움직임 수 + 2 이하
    const plans = o.pages.map(({ pg }) => {
      const els = pg.els.filter(e => !e.hidden), base = [], top = [], movers = [];
      els.forEach(el => {
        if (hasAnim(el)) { const k2 = key(el), last = movers[movers.length - 1]; if (last && last.k === k2) last.els.push(el); else movers.push({ k: k2, els: [el], anim: el.anim }); return; }
        const b = boxOf(el); (movers.some(m => m.els.some(m2 => hit(boxOf(m2), b))) ? top : base).push(el);
      });
      const sets = [{ els: base, withBg: true }].concat(movers.map(m => ({ els: m.els })), top.length ? [{ els: top }] : []);
      return { pg, movers, top, sets };
    });
    // 2) 모든 층을 몇 번에 나눠 한꺼번에 그림 (글꼴을 매번 다시 읽지 않도록)
    const cvsAll = await o.renderLayers(plans.map(p => ({ pg: p.pg, sets: p.sets })), dpi, o.onProgress, o.cancelled);
    if (!cvsAll) return null;
    const scenes = plans.map((P, pi) => {
      const cvs = cvsAll[pi], pg = P.pg, layers = [{ cv: cvs[0], anim: null }];
      P.movers.forEach((m, mi) => {
        const bs = m.els.map(boxOf), x0 = Math.min(...bs.map(b => b.x)), y0 = Math.min(...bs.map(b => b.y)), x1 = Math.max(...bs.map(b => b.x + b.w)), y1 = Math.max(...bs.map(b => b.y + b.h));
        const L = { cv: cvs[mi + 1], anim: m.anim, box: { x: x0 * kx, y: y0 * ky, w: (x1 - x0) * kx, h: (y1 - y0) * ky } };
        L.cx = L.box.x + L.box.w / 2; L.cy = L.box.y + L.box.h / 2; layers.push(L);
      });
      if (P.top.length) layers.push({ cv: cvs[cvs.length - 1], anim: null });
      const tr = pg.vtrans || V.trans;
      return { dur: Number(pg.vdur || V.dur), trans: tr, turn: tr === 'none' ? 0 : Number(V.turn), layers, bg: pg.bg || '#ffffff' };
    });
    if (!V.loop && scenes.length) scenes[scenes.length - 1].turn = 0; // 마지막 장면은 넘김 없이 끝
    return { scenes, W: o.W, H: o.H, loop: V.loop, total: scenes.reduce((a, s) => a + s.dur + s.turn, 0) };
  }
  // 한 장면을 장면 시각 t(초)에 그림
  function drawScene(x, sc, t, W, H) {
    sc.layers.forEach(L => {
      if (!L.anim) { x.drawImage(L.cv, 0, 0, W, H); return; }
      const a = L.anim, d = Number(a.d || 0), s = Math.max(0.05, Number(a.s || 0.8)), p = clamp01((t - d) / s);
      if (p <= 0) return;
      if (p >= 1) { x.drawImage(L.cv, 0, 0, W, H); return; }
      const e = ease(p); let al = 1, dx = 0, dy = 0, sc2 = 1;
      switch (a.t) {
        case 'fade': al = e; break;
        case 'rise': al = e; dy = (1 - e) * H * 0.06; break;
        case 'drop': al = e; dy = -(1 - e) * H * 0.06; break;
        case 'left': al = e; dx = -(1 - e) * W * 0.08; break;
        case 'right': al = e; dx = (1 - e) * W * 0.08; break;
        case 'zoom': al = e; sc2 = 0.6 + 0.4 * e; break;
        case 'pop': al = clamp01(p * 3); sc2 = Math.max(0.01, 0.3 + 0.7 * back(p)); break;
      }
      x.save(); x.globalAlpha = al;
      if (a.t === 'wipe') { const b = L.box; x.beginPath(); x.rect(b.x - 2, b.y - 2, (b.w + 4) * e, b.h + 4); x.clip(); x.drawImage(L.cv, 0, 0, W, H); x.restore(); return; }
      x.translate(L.cx + dx, L.cy + dy); x.scale(sc2, sc2); x.translate(-L.cx, -L.cy); x.drawImage(L.cv, 0, 0, W, H); x.restore();
    });
  }
  // 영상 전체 시각 T(초)의 화면
  const _tmp = { a: null, b: null };
  function off(slot, W, H) { let c = _tmp[slot]; if (!c || c.width !== W || c.height !== H) { c = _tmp[slot] = document.createElement('canvas'); c.width = W; c.height = H; } const x = c.getContext('2d'); x.clearRect(0, 0, W, H); return c; }
  function at(V, T) { let acc = 0; for (let i = 0; i < V.scenes.length; i++) { const s = V.scenes[i], u = s.dur + s.turn; if (T < acc + u || i === V.scenes.length - 1) return { i, q: Math.min(T - acc, u) }; acc += u; } return { i: 0, q: 0 }; }
  function drawAt(x, V, T) {
    const { W, H } = V; const { i, q } = at(V, T), A = V.scenes[i];
    x.fillStyle = A.bg; x.fillRect(0, 0, W, H);
    if (q < A.dur || !A.turn) { drawScene(x, A, q, W, H); return; }
    const j = (i + 1) % V.scenes.length, B = V.scenes[j], p = clamp01((q - A.dur) / A.turn);
    const ca = off('a', W, H), cb = off('b', W, H); const xa = ca.getContext('2d'), xb = cb.getContext('2d');
    xa.fillStyle = A.bg; xa.fillRect(0, 0, W, H); drawScene(xa, A, A.dur + (q - A.dur), W, H);
    xb.fillStyle = B.bg; xb.fillRect(0, 0, W, H); drawScene(xb, B, 0, W, H);
    trans(x, ca, cb, p, A.trans, W, H, B.bg);
  }
  function trans(x, A, B, p, st, W, H, bg) {
    const e = io(p);
    if (st === 'slide') { const dx = Math.round(W * e); x.drawImage(A, -dx, 0, W, H); x.drawImage(B, W - dx, 0, W, H); const sx = W - dx, gr = x.createLinearGradient(sx - 70, 0, sx, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.16)'); x.fillStyle = gr; x.fillRect(sx - 70, 0, 70, H); return; }
    if (st === 'up') { const dy = Math.round(H * e); x.drawImage(A, 0, -dy, W, H); x.drawImage(B, 0, H - dy, W, H); return; }
    if (st === 'fade') { x.drawImage(A, 0, 0, W, H); x.save(); x.globalAlpha = e; x.drawImage(B, 0, 0, W, H); x.restore(); return; }
    if (st === 'zoom') { x.drawImage(A, 0, 0, W, H); const s = 1.12 - 0.12 * e; x.save(); x.globalAlpha = e; x.translate(W / 2, H / 2); x.scale(s, s); x.drawImage(B, -W / 2, -H / 2, W, H); x.restore(); return; }
    if (st === 'none') { x.drawImage(p < 0.5 ? A : B, 0, 0, W, H); return; }
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
  // 음악 재생 노드: from 초부터, total 초 동안(짧으면 반복), 끝 2초는 서서히 작게
  function music(buf, a, to, from, total) {
    const ac = ctx(), src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf; src.loop = buf.duration < total; const vol = a.vol == null ? 0.8 : Number(a.vol), now = ac.currentTime;
    g.gain.setValueAtTime(vol, now);
    if (a.fade !== false && total > 3) { const fs = Math.max(0, total - 2.5 - from); g.gain.setValueAtTime(vol, now + fs); g.gain.linearRampToValueAtTime(0.0001, now + Math.max(fs + 0.1, total - from)); }
    src.connect(g).connect(to); src.start(now, (from % buf.duration) || 0); return { stop() { try { src.stop(); } catch (e) {} } };
  }

  /* ---------- 미리보기 재생 ---------- */
  function player(canvas, V, audio) {
    const x = canvas.getContext('2d'); canvas.width = V.W; canvas.height = V.H;
    let t = 0, playing = false, t0 = 0, raf = 0, snd = null; const P = { onTime: null };
    const draw = () => { drawAt(x, V, Math.min(t, V.total - 0.001)); if (P.onTime) P.onTime(t); };
    const loop = () => { t = (performance.now() - t0) / 1000; if (t >= V.total) { t = V.total; P.pause(); draw(); return; } draw(); raf = requestAnimationFrame(loop); };
    P.play = () => { if (playing) return; if (t >= V.total - 0.01) t = 0; playing = true; t0 = performance.now() - t * 1000; if (audio && audio.buf) { const ac = ctx(); ac.resume && ac.resume(); snd = music(audio.buf, audio, ac.destination, t, V.total); } loop(); };
    P.pause = () => { playing = false; cancelAnimationFrame(raf); if (snd) { snd.stop(); snd = null; } };
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
      const V = o.V, withA = !!(o.audio && o.audio.buf), mime = mimeFor(withA);
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
          resolve({ blob: new Blob(r.parts, { type: 'video/mp4' }), ext, note: `MP4 · ${V.W}×${V.H} · ${r.seconds.toFixed(1)}초${withA ? ' · 음악 포함' : ''}` });
        }).catch(() => resolve({ blob, ext, warn: '변환 중 오류 — 녹화본 그대로 저장했습니다.' }));
      };
      rec.start(1000);
      const t0 = performance.now(); if (withA) snd = music(o.audio.buf, o.audio, dest, 0, V.total);
      const step = () => {
        if (o.cancelled && o.cancelled()) { stopped = true; if (rec.state !== 'inactive') rec.stop(); return; }
        const T = (performance.now() - t0) / 1000;
        if (T >= V.total) { drawAt(x, V, V.total - 0.001); if (rec.state !== 'inactive') rec.stop(); return; }
        drawAt(x, V, T); if (o.onProgress) o.onProgress(T / V.total, T);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
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
  return { ANIMS, TRANS, DEF, outSize, build, drawAt, player, record, decode, hasAnim, autoAnimate, defragMulti };
})();
