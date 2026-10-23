// 소식지 결합 — 나라차 소식지 엔진(narachadata.github.io/naracha/news.html)이 캔버스에 그리는 명령을
// 그대로 받아 적어 공방의 요소(글 상자·그림·도형·벡터 모양)로 바꾼다.
// 엔진은 같은 주소(origin)라 iframe으로 열면 함수·데이터(접속키·보관한 호·사진)를 그대로 쓸 수 있다.
// 엔진 파일은 고치지 않는다: newCanvas()만 잠시 바꿔 끼워 그리기 명령을 기록한다.
window.NC = window.NC || {};
NC.news = (function () {
  const PX = 25.4 / 96;            // 1px → mm (소식지 1080px = 285.75mm)
  const PT = 0.75;                 // 1px → pt
  const r2 = v => Math.round(v * 100) / 100;
  const TAU = Math.PI * 2;

  /* ======================= 1. 기록기 ======================= */
  // 캔버스 하나에 붙는 기록: 2D 컨텍스트를 Proxy로 감싸 그리기 명령을 기록하고 실제로도 그린다(엔진의 글자 재기·미리보기가 그대로 동작)
  function attach(c) {
    if (c.__rec) return c.__rec;
    const og = c.getContext.bind(c);
    const real = og('2d');
    const R = new Rec(real, c);
    const proxy = new Proxy(real, {
      get(t, k) { const h = R.hooks[k]; if (h) return h; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; },
      set(t, k, v) { t[k] = v; return true; }
    });
    c.getContext = (type, o) => type === '2d' ? proxy : og(type, o);
    c.__rec = R;
    return R;
  }
  function Rec(r, canvas) {
    this.r = r; this.canvas = canvas; this.ops = []; this.path = []; this.prims = []; this.clip = null; this.stack = [];
    this.cur = null; this.start = null; this.grads = new Map();
    const self = this;
    const T = (x, y) => { const m = self.r.getTransform(); return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; };
    const push = (seg) => self.path.push(seg);
    const moveTo = (x, y) => { push(['M', ...T(x, y)]); self.cur = [x, y]; self.start = [x, y]; };
    const lineTo = (x, y) => { if (!self.cur) return moveTo(x, y); push(['L', ...T(x, y)]); self.cur = [x, y]; };
    const cubic = (x1, y1, x2, y2, x, y) => { if (!self.cur) moveTo(x1, y1); push(['C', ...T(x1, y1), ...T(x2, y2), ...T(x, y)]); self.cur = [x, y]; };
    // 타원 호를 베지어로 (90° 이하 조각)
    const arcSeg = (cx, cy, rx, ry, rot, a0, a1, ccw) => {
      let da; // 캔버스 규칙: 한 바퀴 이상이면 원 전체, 아니면 방향대로 0~2π 사이
      if (!ccw) { da = a1 - a0; da = da >= TAU ? TAU : ((da % TAU) + TAU) % TAU; }
      else { da = a0 - a1; da = da >= TAU ? -TAU : -(((da % TAU) + TAU) % TAU); }
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const P = (a) => { const x = rx * Math.cos(a), y = ry * Math.sin(a); return [cx + x * cr - y * sr, cy + x * sr + y * cr]; };
      const D = (a) => { const x = -rx * Math.sin(a), y = ry * Math.cos(a); return [x * cr - y * sr, x * sr + y * cr]; };
      const p0 = P(a0);
      if (self.cur) lineTo(p0[0], p0[1]); else moveTo(p0[0], p0[1]);
      const n = Math.max(1, Math.ceil(Math.abs(da) / (Math.PI / 2) - 1e-9));
      const step = da / n, k = 4 / 3 * Math.tan(step / 4);
      for (let i = 0; i < n; i++) {
        const s = a0 + step * i, e = s + step, ps = P(s), pe = P(e), ds = D(s), de = D(e);
        cubic(ps[0] + k * ds[0], ps[1] + k * ds[1], pe[0] - k * de[0], pe[1] - k * de[1], pe[0], pe[1]);
      }
    };
    const scaleOf = () => { const m = self.r.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); };
    const axis = () => { const m = self.r.getTransform(); return Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6; };
    const H = this.hooks = {
      save() { self.stack.push(self.clip); r.save(); },
      restore() { if (self.stack.length) self.clip = self.stack.pop(); r.restore(); },
      beginPath() { self.path = []; self.prims = []; self.cur = null; r.beginPath(); },
      moveTo(x, y) { moveTo(x, y); self.prims.push({ t: 'M' }); r.moveTo(x, y); },
      lineTo(x, y) { lineTo(x, y); self.prims.push({ t: 'L' }); r.lineTo(x, y); },
      closePath() { if (self.path.length) push(['Z']); if (self.start) self.cur = self.start.slice(); self.prims.push({ t: 'Z' }); r.closePath(); },
      rect(x, y, w, h) { recRect(x, y, w, h); r.rect(x, y, w, h); },
      roundRect(x, y, w, h, rr) { const q = Math.min(Math.abs(Array.isArray(rr) ? rr[0] : rr || 0), Math.abs(w) / 2, Math.abs(h) / 2); moveTo(x + q, y); self.prims.push({ t: 'M' }); recArcTo(x + w, y, x + w, y + h, q); recArcTo(x + w, y + h, x, y + h, q); recArcTo(x, y + h, x, y, q); recArcTo(x, y, x + w, y, q); push(['Z']); self.prims.push({ t: 'Z' }); r.roundRect(x, y, w, h, rr); },
      arc(cx, cy, rad, a0, a1, ccw) { arcSeg(cx, cy, rad, rad, 0, a0, a1, !!ccw); const full = Math.abs(a1 - a0) >= TAU - 0.02; const [X, Y] = T(cx, cy); self.prims.push({ t: 'arc', full, c: [X, Y], r: rad * scaleOf(), ax: axis() }); r.arc(cx, cy, rad, a0, a1, ccw); },
      ellipse(cx, cy, rx, ry, rot, a0, a1, ccw) { arcSeg(cx, cy, rx, ry, rot, a0, a1, !!ccw); self.prims.push({ t: 'ellipse' }); r.ellipse(cx, cy, rx, ry, rot, a0, a1, ccw); },
      arcTo(x1, y1, x2, y2, rad) { recArcTo(x1, y1, x2, y2, rad); r.arcTo(x1, y1, x2, y2, rad); },
      quadraticCurveTo(cx, cy, x, y) { const p0 = self.cur || [cx, cy]; cubic(p0[0] + 2 / 3 * (cx - p0[0]), p0[1] + 2 / 3 * (cy - p0[1]), x + 2 / 3 * (cx - x), y + 2 / 3 * (cy - y), x, y); self.prims.push({ t: 'Q' }); r.quadraticCurveTo(cx, cy, x, y); },
    };
    function recRect(x, y, w, h) { moveTo(x, y); lineTo(x + w, y); lineTo(x + w, y + h); lineTo(x, y + h); push(['Z']); self.cur = [x, y]; const [X, Y] = T(x, y), [X2, Y2] = T(x + w, y + h); self.prims.push({ t: 'rect', ax: axis(), box: [Math.min(X, X2), Math.min(Y, Y2), Math.abs(X2 - X), Math.abs(Y2 - Y)] }); }
    function recArcTo(x1, y1, x2, y2, rad) {
        const p0 = self.cur;
        if (!p0) { moveTo(x1, y1); return; }
        const v1 = [p0[0] - x1, p0[1] - y1], v2 = [x2 - x1, y2 - y1], l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
        const cross = v1[0] * v2[1] - v1[1] * v2[0];
        if (!rad || l1 < 1e-9 || l2 < 1e-9 || Math.abs(cross) < 1e-9) { lineTo(x1, y1); self.prims.push({ t: 'L' }); return; }
        const ang = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2))));
        const tl = rad / Math.tan(ang / 2), u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2];
        const t1 = [x1 + u1[0] * tl, y1 + u1[1] * tl], t2 = [x1 + u2[0] * tl, y1 + u2[1] * tl];
        const bis = [u1[0] + u2[0], u1[1] + u2[1]], bl = Math.hypot(...bis), dc = rad / Math.sin(ang / 2);
        const c = [x1 + bis[0] / bl * dc, y1 + bis[1] / bl * dc];
        const a0 = Math.atan2(t1[1] - c[1], t1[0] - c[0]), a1 = Math.atan2(t2[1] - c[1], t2[0] - c[0]);
        lineTo(t1[0], t1[1]);
        let d = a1 - a0; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        const save = self.cur; self.cur = t1; arcSeg(c[0], c[1], rad, rad, 0, a0, a0 + d, d < 0); void save;
        self.prims.push({ t: 'arcTo', r: rad * scaleOf() });
    }
    Object.assign(H, {
      bezierCurveTo(a, b, c, d, x, y) { cubic(a, b, c, d, x, y); self.prims.push({ t: 'C' }); r.bezierCurveTo(a, b, c, d, x, y); },
      fill(a, b) { const rule = typeof a === 'string' ? a : b; self.op('fill', self.path, self.prims, rule); typeof a === 'string' || a == null ? r.fill(a || 'nonzero') : r.fill(a, b); },
      stroke() { self.op('stroke', self.path, self.prims); r.stroke(); },
      clip(a) { self.clip = (self.clip || []).concat([{ d: self.path.slice(), prims: self.prims.slice(), rule: a }]); r.clip(a || 'nonzero'); },
      fillRect(x, y, w, h) { const sp = self.path, spr = self.prims, sc = self.cur; self.path = []; self.prims = []; recRect(x, y, w, h); self.op('fill', self.path, self.prims); self.path = sp; self.prims = spr; self.cur = sc; r.fillRect(x, y, w, h); },
      strokeRect(x, y, w, h) { const sp = self.path, spr = self.prims, sc = self.cur; self.path = []; self.prims = []; recRect(x, y, w, h); self.op('stroke', self.path, self.prims); self.path = sp; self.prims = spr; self.cur = sc; r.strokeRect(x, y, w, h); },
      clearRect(x, y, w, h) { r.clearRect(x, y, w, h); },
      fillText(t, x, y, mw) { self.text('fill', t, x, y, mw); mw == null ? r.fillText(t, x, y) : r.fillText(t, x, y, mw); },
      strokeText(t, x, y, mw) { self.text('stroke', t, x, y, mw); mw == null ? r.strokeText(t, x, y) : r.strokeText(t, x, y, mw); },
      drawImage(img, ...a) { self.image(img, a); r.drawImage(img, ...a); },
      createLinearGradient(x0, y0, x1, y1) { const g = r.createLinearGradient(x0, y0, x1, y1); self.wrapGrad(g, { type: 'linear', p: [x0, y0, x1, y1] }); return g; },
      createRadialGradient(x0, y0, r0, x1, y1, r1) { const g = r.createRadialGradient(x0, y0, r0, x1, y1, r1); self.wrapGrad(g, { type: 'radial', p: [x0, y0, r0, x1, y1, r1] }); return g; },
    });
  }
  Rec.prototype.wrapGrad = function (g, info) { info.stops = []; const oa = g.addColorStop.bind(g); g.addColorStop = (o, c) => { info.stops.push([o, c]); oa(o, c); }; this.grads.set(g, info); };
  Rec.prototype.paint = function (v) { if (typeof v === 'string') return { c: v }; const g = this.grads.get(v); return g ? { g } : { c: '#000000', unk: true }; };
  Rec.prototype.state = function () {
    const r = this.r, m = r.getTransform();
    const sc = parseColor(r.shadowColor);
    const sh = sc && sc.a > 0 && (r.shadowBlur || r.shadowOffsetX || r.shadowOffsetY) ? { c: sc, blur: r.shadowBlur, x: r.shadowOffsetX, y: r.shadowOffsetY } : null;
    return { m: [m.a, m.b, m.c, m.d, m.e, m.f], alpha: r.globalAlpha, comp: r.globalCompositeOperation, fill: this.paint(r.fillStyle), stroke: this.paint(r.strokeStyle), lw: r.lineWidth, cap: r.lineCap, join: r.lineJoin, dash: r.getLineDash(), shd: sh, clip: this.clip, filter: r.filter && r.filter !== 'none' ? r.filter : '' };
  };
  Rec.prototype.op = function (k, path, prims, rule) { if (!path.length) return; this.ops.push(Object.assign({ k, d: path.slice(), prims: prims.slice(), rule: rule || 'nonzero' }, this.state())); };
  Rec.prototype.text = function (mode, t, x, y, mw) {
    t = String(t); if (!t) return;
    const r = this.r, bl = r.textBaseline, ta = r.textAlign;
    const m1 = r.measureText(t); r.textBaseline = 'alphabetic'; const m0 = r.measureText(t); r.textBaseline = bl;
    this.ops.push(Object.assign({ k: 'text', mode, t, x, y, mw, font: r.font, align: ta, dir: r.direction, w: m0.width, A: m0.fontBoundingBoxAscent, D: m0.fontBoundingBoxDescent, shift: m0.fontBoundingBoxAscent - m1.fontBoundingBoxAscent }, this.state()));
  };
  Rec.prototype.image = function (img, a) {
    const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height;
    let sx = 0, sy = 0, sw = iw, sh = ih, dx, dy, dw, dh;
    if (a.length <= 4) { dx = a[0]; dy = a[1]; dw = a.length > 2 ? a[2] : iw; dh = a.length > 2 ? a[3] : ih; }
    else { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
    if (!iw || !ih || !dw || !dh) return;
    this.ops.push(Object.assign({ k: 'img', img, iw, ih, sx, sy, sw, sh, dx, dy, dw, dh }, this.state()));
  };

  /* ======================= 2. 색·글꼴 도우미 ======================= */
  const _cx = document.createElement('canvas').getContext('2d');
  function parseColor(v) {
    if (!v || v === 'transparent') return null;
    let s = String(v).trim();
    if (!/^#|^rgb/i.test(s)) { _cx.fillStyle = '#000'; _cx.fillStyle = s; s = _cx.fillStyle; }
    let m = s.match(/^#([0-9a-f]{6})$/i); if (m) return { hex: '#' + m[1].toUpperCase(), a: 1 };
    m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i); if (m) return { hex: ('#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toUpperCase(), a: 1 };
    m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
    if (m) { const h = n => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0'); let a = m[4] == null ? 1 : (String(m[4]).endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4])); return { hex: ('#' + h(m[1]) + h(m[2]) + h(m[3])).toUpperCase(), a }; }
    return { hex: '#000000', a: 1 };
  }
  function parseFont(f) {
    const m = String(f).match(/^\s*(?:(italic|oblique)\s+)?(?:(small-caps)\s+)?(?:(normal|bold|bolder|lighter|\d{3})\s+)?(?:(?:ultra-|extra-|semi-)?(?:condensed|expanded)\s+)?([\d.]+)px(?:\s*\/\s*[\d.]+\w*)?\s+(.+)$/i);
    if (!m) return { size: 16, weight: 400, italic: false, family: 'Noto Sans KR' };
    const w = m[3] === 'bold' ? 700 : m[3] === 'bolder' ? 800 : m[3] === 'lighter' ? 300 : m[3] && /\d/.test(m[3]) ? Number(m[3]) : 400;
    const fam = m[5].split(',')[0].trim().replace(/^["']|["']$/g, '');
    return { size: Number(m[4]), weight: w, italic: !!m[1], family: fam };
  }
  const mat = m => ({ sx: Math.hypot(m[0], m[1]), rot: Math.atan2(m[1], m[0]) * 180 / Math.PI });
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  /* ======================= 3. 경로 → SVG ======================= */
  function bboxOf(d) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
    let px = 0, py = 0;
    d.forEach(s => {
      if (s[0] === 'M' || s[0] === 'L') { add(s[1], s[2]); px = s[1]; py = s[2]; }
      else if (s[0] === 'C') { // 베지어 극값까지 (곡선 바깥 상자 정확히)
        const xs = [px, s[1], s[3], s[5]], ys = [py, s[2], s[4], s[6]];
        add(s[5], s[6]);
        [xs, ys].forEach((v, k) => { const a = -v[0] + 3 * v[1] - 3 * v[2] + v[3], b = 2 * (v[0] - 2 * v[1] + v[2]), c = v[1] - v[0]; const ts = []; if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) ts.push(-c / b); } else { const D = b * b - 4 * a * c; if (D >= 0) { ts.push((-b + Math.sqrt(D)) / (2 * a), (-b - Math.sqrt(D)) / (2 * a)); } } ts.forEach(t => { if (t > 0 && t < 1) { const mt = 1 - t; const px_ = mt * mt * mt * xs[0] + 3 * mt * mt * t * xs[1] + 3 * mt * t * t * xs[2] + t * t * t * xs[3]; const py_ = mt * mt * mt * ys[0] + 3 * mt * mt * t * ys[1] + 3 * mt * t * t * ys[2] + t * t * t * ys[3]; add(px_, py_); } }); void k; });
        px = s[5]; py = s[6];
      }
    });
    return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function dStr(d, ox, oy) {
    const f = v => r2(v);
    return d.map(s => s[0] === 'Z' ? 'Z' : s[0] === 'C' ? `C${f(s[1] - ox)} ${f(s[2] - oy)} ${f(s[3] - ox)} ${f(s[4] - oy)} ${f(s[5] - ox)} ${f(s[6] - oy)}` : `${s[0]}${f(s[1] - ox)} ${f(s[2] - oy)}`).join('');
  }
  // 경로 모양 알아보기: 축 정렬 사각형 / 원 / 둥근 사각형
  function shapeOf(prims, d) {
    const p = prims.filter(x => x.t !== 'Z');
    if (p.length === 1 && p[0].t === 'rect' && p[0].ax) return { kind: 'rect', box: p[0].box, r: 0 };
    if (p.length === 1 && p[0].t === 'arc' && p[0].full && p[0].ax) { const c = p[0].c, r = p[0].r; return { kind: 'circle', box: [c[0] - r, c[1] - r, 2 * r, 2 * r] }; }
    if (p.length === 5 && p[0].t === 'M' && p.slice(1).every(x => x.t === 'arcTo') && Math.abs(p[1].r - p[4].r) < 0.01 && p.slice(1).every(x => Math.abs(x.r - p[1].r) < 0.01)) { const b = bboxOf(d); if (b) return { kind: 'rrect', box: [b.x, b.y, b.w, b.h], r: p[1].r }; }
    return null;
  }

  /* ======================= 4. 기록 → 공방 요소 ======================= */
  // pages: [{name, rec, w, h}] / addAsset: dataURL → 'a:키' / uid: 새 id
  function convert(pages, opt) {
    const { addAsset, uid } = opt;
    const imgCache = new Map();
    return pages.map(pg => convertPage(pg, addAsset, uid, imgCache));
  }
  function gradientDef(paint, m, ox, oy) {
    // 그라데이션 좌표(사용자 좌표)를 기기 좌표로 옮겨 SVG 정의로
    const g = paint.g, id = 'G' + Math.random().toString(36).slice(2, 8);
    const stops = g.stops.map(([o, c]) => { const pc = parseColor(c) || { hex: '#000000', a: 0 }; return `<stop offset="${r2(o)}" stop-color="${pc.hex}" stop-opacity="${r2(pc.a)}"/>`; }).join('');
    const tf = `gradientTransform="matrix(${m.map(r2).join(' ')})"`;
    void ox; void oy;
    if (g.type === 'linear') return { id, def: `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r2(g.p[0])}" y1="${r2(g.p[1])}" x2="${r2(g.p[2])}" y2="${r2(g.p[3])}" ${tf}>${stops}</linearGradient>` };
    return { id, def: `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" fx="${r2(g.p[0])}" fy="${r2(g.p[1])}" fr="${r2(g.p[2])}" cx="${r2(g.p[3])}" cy="${r2(g.p[4])}" r="${r2(g.p[5])}" ${tf}>${stops}</radialGradient>` };
  }
  function shadowProps(sh, alpha) {
    if (!sh) return {};
    return { shadow: true, shX: r2(sh.x * PX), shY: r2(sh.y * PX), shB: r2(sh.blur / 2 * PX), shC: sh.c.hex, shA: r2(sh.c.a * (alpha == null ? 1 : alpha)) };
  }
  function convertPage(pg, addAsset, uid, imgCache) {
    const W = pg.w, Hh = pg.h, ops = pg.rec.ops, els = [];
    let bg = '#ffffff';
    // 4-1. 채우기 바로 뒤 같은 경로의 선 → 한 요소로
    const merged = [];
    for (let i = 0; i < ops.length; i++) {
      const o = ops[i], n = ops[i + 1];
      if (o.k === 'fill' && n && n.k === 'stroke' && sameD(o.d, n.d)) { merged.push(Object.assign({}, o, { k: 'fillstroke', strokeOp: n })); i++; continue; }
      if (o.k === 'stroke' && n && n.k === 'fill' && sameD(o.d, n.d)) { merged.push(Object.assign({}, n, { k: 'fillstroke', strokeOp: o, strokeUnder: true })); i++; continue; }
      merged.push(o);
    }
    // 4-2. 외곽선 글자 + 같은 글자 채우기 → 한 글 상자 (스티커 제목)
    const T = [];
    for (let i = 0; i < merged.length; i++) {
      const o = merged[i];
      if (o.k === 'text' && o.mode === 'stroke') {
        // 같은 글자를 같은 자리에 채우는 명령을 바로 뒤에서 찾음 (사이에 다른 외곽선 글자가 있을 수 있음: "10" "월")
        let j = i + 1, hit = -1;
        while (j < merged.length && j <= i + 4 && merged[j].k === 'text') { const q = merged[j]; if (q.mode === 'fill' && q.t === o.t && Math.abs(q.x - o.x) < 0.5 && Math.abs(q.y - o.y) < 0.5 && q.font === o.font) { hit = j; break; } j++; }
        if (hit > 0) { const f = merged[hit]; merged.splice(hit, 1); T.push(Object.assign({}, f, { outline: o })); continue; }
      }
      T.push(o);
    }
    // 4-3. 요소 만들기
    let first = true;
    const textRuns = [];
    T.forEach((o, idx) => {
      if (o.k === 'text') { textRuns.push({ idx, o }); els.push({ __text: o }); return; }
      if (o.k === 'img') { const e = imageEl(o, addAsset, uid, imgCache, W, Hh); if (e) els.push(e); first = false; return; }
      if (o.k === 'fill' || o.k === 'stroke' || o.k === 'fillstroke') {
        // 맨 처음 쪽 전체를 칠하는 단색 → 페이지 바탕색
        const s = shapeOf(o.prims, o.d);
        if (first && o.k === 'fill' && s && s.kind === 'rect' && o.fill.c && !o.clip && o.alpha === 1 && s.box[0] <= 0.5 && s.box[1] <= 0.5 && s.box[2] >= W - 1 && s.box[3] >= Hh - 1) { const pc = parseColor(o.fill.c); if (pc && pc.a === 1) { bg = pc.hex; first = false; return; } }
        first = false;
        const e = vectorEl(o, s, uid, W, Hh); if (e) els.push(e);
      }
    });
    // 4-4. 글자: 같은 줄 조각 잇기 → 문단 묶기 → 글 상자
    const out = [];
    for (let i = 0; i < els.length; i++) {
      if (!els[i].__text) { out.push(els[i]); continue; }
      // 연속된 글자 명령 모으기
      const run = []; while (i < els.length && els[i].__text) { run.push(els[i].__text); i++; } i--;
      textBlocks(run).forEach(b => { const e = textEl(b, uid); if (e && e.text.trim()) out.push(e); });
    }
    // 4-5. 배경처럼 큰 장식은 잠가서 클릭이 통과되게 (lockedBg 기준과 같음: 쪽 넓이 60% 이상)
    out.forEach(e => { if ((e.type === 'shape' || e.type === 'path' || e.type === 'image') && e.w * e.h >= (W * PX) * (Hh * PX) * 0.6) { e.locked = true; e.name = e.name || '배경'; } });
    // 4-6. 연속된 작은 장식(벡터)은 한 묶음(그룹)으로 — 끌면 함께 움직이고, 풀어서 하나씩 고칠 수도 있음
    let runIds = [];
    const flush = () => { if (runIds.length >= 3) { const g = uid(); runIds.forEach(e => { e.group = g; }); } runIds = []; };
    out.forEach(e => { if ((e.type === 'path' || e.type === 'shape') && !e.locked && e.w * e.h < (W * PX) * (Hh * PX) * 0.04) runIds.push(e); else flush(); });
    flush();
    return { id: uid(), bg, els: out, label: pg.label || '' };
  }
  function sameD(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x.length !== y.length || x[0] !== y[0]) return false; for (let k = 1; k < x.length; k++) if (Math.abs(x[k] - y[k]) > 0.01) return false; } return true; }

  function vectorEl(o, s, uid, W, Hh) {
    const fillP = o.k === 'stroke' ? null : o.fill, strokeOp = o.k === 'stroke' ? o : o.strokeOp;
    const lw = strokeOp ? strokeOp.lw * mat(strokeOp.m).sx : 0;
    const b0 = bboxOf(o.d); if (!b0) return null;
    const pad = lw / 2 + 0.5;
    const fc = fillP && fillP.c ? parseColor(fillP.c) : null;
    const sc = strokeOp && strokeOp.stroke.c ? parseColor(strokeOp.stroke.c) : null;
    if (fillP && fillP.c && (!fc || fc.a === 0) && !strokeOp) return null;
    const base = { id: uid(), rot: 0, opacity: r2(o.alpha), name: '' };
    Object.assign(base, shadowProps(o.shd || (strokeOp && strokeOp.shd), 1));
    const clipNeeded = o.clip && o.clip.length && !insideClip(b0, o.clip);
    // 단색·2색 그라데이션 사각형·원·둥근 사각형은 고치기 쉬운 '도형'으로
    if (s && !clipNeeded && !o.dash.length && (!strokeOp || !strokeOp.dash.length) && (!fillP || fillP.c || (fillP.g && fillP.g.type === 'linear' && fillP.g.stops.length === 2))) {
      const [x, y, w, h] = s.box;
      const el = Object.assign(base, { type: 'shape', kind: s.kind === 'circle' ? 'ellipse' : 'rect', x: r2(x * PX), y: r2(y * PX), w: r2(Math.max(0.2, w) * PX), h: r2(Math.max(0.2, h) * PX), radius: s.kind === 'rrect' ? r2(s.r * PX) : 0 });
      if (fillP && fillP.c) { el.fill = fc.hex; if (fc.a < 1) el.opacity = r2(el.opacity * fc.a); }
      else if (fillP && fillP.g) { const g = fillP.g; const p0 = apply(o.m, g.p[0], g.p[1]), p1 = apply(o.m, g.p[2], g.p[3]); const c0 = parseColor(g.stops[0][1]), c1 = parseColor(g.stops[1][1]); el.fillType = 'gradient'; el.g1 = c0.hex; el.g2 = c1.hex; el.gAngle = Math.round(Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI) - 90; el.fill = c0.hex; }
      else el.fill = 'none';
      if (strokeOp && sc && sc.a > 0) { el.stroke = sc.hex; el.strokeW = r2(lw * PX); }
      return el;
    }
    // 그 밖의 모양은 벡터 경로(SVG)로 — 크게 인쇄해도 선명
    const ox = b0.x - pad, oy = b0.y - pad, vw = b0.w + pad * 2, vh = b0.h + pad * 2;
    const el = Object.assign(base, { type: 'path', x: r2(ox * PX), y: r2(oy * PX), w: r2(vw * PX), h: r2(vh * PX), d: dStr(o.d, ox, oy), vw: r2(vw), vh: r2(vh), closed: true, rule: o.rule === 'evenodd' ? 'evenodd' : undefined });
    if (fillP && fillP.c) { el.fill = fc ? fc.hex : '#000000'; if (fc && fc.a < 1) el.fillA = r2(fc.a); }
    else if (fillP && fillP.g) { const gd = gradientDef(fillP, o.m, ox, oy); el.fill = parseColor(fillP.g.stops[0] ? fillP.g.stops[0][1] : '#000').hex; el.fillType = 'raw'; el.gdef = gd.def.replace(/matrix\(([^)]*)\)/, (m0, nums) => { const v = nums.split(' ').map(Number); v[4] -= ox; v[5] -= oy; return `matrix(${v.map(r2).join(' ')})`; }); el.gid = gd.id; }
    else el.fill = '';
    if (strokeOp && sc && sc.a > 0) { el.stroke = sc.hex; if (sc.a < 1) el.strokeA = r2(sc.a); el.strokeW = r2(lw * PX); el.cap = strokeOp.cap; el.join = strokeOp.join; if (strokeOp.dash.length) { const k = mat(strokeOp.m).sx; el.dash = strokeOp.dash.map(v => r2(v * k)).join(' '); } }
    else { el.stroke = ''; el.strokeW = 0; }
    if (o.strokeUnder) el.strokeUnder = true;
    if (clipNeeded) el.clipD = o.clip.map(c => dStr(c.d, ox, oy)).join('|');
    return el;
  }
  function insideClip(b, clip) { return clip.every(c => { const cb = bboxOf(c.d); const s = shapeOf(c.prims, c.d); return cb && s && s.kind === 'rect' && b.x >= cb.x - 0.5 && b.y >= cb.y - 0.5 && b.x + b.w <= cb.x + cb.w + 0.5 && b.y + b.h <= cb.y + cb.h + 0.5; }); }

  /* ---------- 그림 ---------- */
  function imageEl(o, addAsset, uid, cache, W, Hh) {
    const m = o.m, { sx: k, rot } = mat(m);
    // 목적지 사각형(기기 좌표, 회전 전)
    const c0 = apply(m, o.dx + o.dw / 2, o.dy + o.dh / 2);
    let dw = o.dw * k, dh = o.dh * k, cx = c0[0], cy = c0[1];
    let sx = o.sx, sy = o.sy, sw = o.sw, sh = o.sh, clipKind = '', radius = 0, mask = null;
    const flipX = o.dw < 0 || m[0] < 0 && Math.abs(rot) < 1, flipY = o.dh < 0; void flipX; void flipY;
    // 자르기(clip): 사각형·원·둥근 사각형이면 그림 상자를 그 모양으로, 아니면 그 모양대로 잘라 투명 PNG로
    if (o.clip && o.clip.length && Math.abs(rot) < 0.01) {
      const last = o.clip[o.clip.length - 1], s = shapeOf(last.prims, last.d), cb = bboxOf(last.d);
      const L = cx - dw / 2, Tp = cy - dh / 2;
      if (cb) {
        const ix = Math.max(L, cb.x), iy = Math.max(Tp, cb.y), ix2 = Math.min(L + dw, cb.x + cb.w), iy2 = Math.min(Tp + dh, cb.y + cb.h);
        if (ix2 <= ix || iy2 <= iy) return null;
        const fx = sw / dw, fy = sh / dh;
        sx = o.sx + (ix - L) * fx; sy = o.sy + (iy - Tp) * fy; sw = (ix2 - ix) * fx; sh = (iy2 - iy) * fy;
        dw = ix2 - ix; dh = iy2 - iy; cx = ix + dw / 2; cy = iy + dh / 2;
        const full = Math.abs(ix - cb.x) < 1 && Math.abs(iy - cb.y) < 1 && Math.abs(dw - cb.w) < 1 && Math.abs(dh - cb.h) < 1;
        if (s && s.kind === 'circle' && full) clipKind = 'circle';
        else if (s && s.kind === 'rrect' && full) radius = s.r;
        else if (!(s && s.kind === 'rect')) mask = { d: last.d, ox: ix, oy: iy };
      }
    }
    if (sw <= 0 || sh <= 0) return null;
    const ref = assetFor(o.img, sx, sy, sw, sh, dw, dh, mask, addAsset, cache);
    if (!ref) return null;
    const el = { id: uid(), type: 'image', src: ref, x: r2((cx - dw / 2) * PX), y: r2((cy - dh / 2) * PX), w: r2(Math.abs(dw) * PX), h: r2(Math.abs(dh) * PX), rot: r2(rot), opacity: r2(o.alpha), fit: 'cover', pos: '50% 50%', clip: clipKind || 'none', radius: r2(radius * PX), name: '' };
    Object.assign(el, shadowProps(o.shd, 1));
    return el;
  }
  function srcKey(img) { return img.currentSrc || img.src || ''; }
  // 그림 조각을 원본 해상도 그대로 잘라 문서 그림으로 (같은 조각은 한 번만)
  function assetFor(img, sx, sy, sw, sh, dw, dh, mask, addAsset, cache) {
    const s0 = srcKey(img);
    const whole = !mask && sx <= 0.5 && sy <= 0.5 && Math.abs(sw - (img.naturalWidth || img.width)) < 1 && Math.abs(sh - (img.naturalHeight || img.height)) < 1;
    const key = (s0 ? s0.length + ':' + s0.slice(-64) + ':' + s0.slice(0, 64) : 'cv' + (img.__nid || (img.__nid = Math.random()))) + (whole ? '' : `|${Math.round(sx)},${Math.round(sy)},${Math.round(sw)},${Math.round(sh)}`) + (mask ? '|m' + Math.random() : '');
    if (cache.has(key)) return cache.get(key);
    let url;
    try {
      if (whole && /^data:image\//.test(s0)) url = s0;
      else {
        // 잘라 낼 크기: 원본 조각 해상도(너무 크면 3000px로), 마스크는 화면 배치 크기의 2배
        const sc = mask ? Math.min(2 * dw / sw, 3000 / Math.max(sw, sh)) : Math.min(1, 3000 / Math.max(sw, sh));
        const cw = Math.max(1, Math.round(sw * sc)), ch = Math.max(1, Math.round(sh * sc));
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const x = cv.getContext('2d');
        if (mask) { const k = cw / dw; x.setTransform(k, 0, 0, k, -mask.ox * k, -mask.oy * k); x.fill(new Path2D(dStr(mask.d, 0, 0)), 'nonzero'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-in'; }
        x.imageSmoothingQuality = 'high';
        x.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
        const opaque = !mask && /^data:image\/jpe?g/.test(s0);
        url = opaque ? cv.toDataURL('image/jpeg', 0.92) : cv.toDataURL('image/png');
      }
    } catch (e) { return null; }
    const ref = addAsset(url); cache.set(key, ref); return ref;
  }

  /* ---------- 글자 ---------- */
  // 연속된 글자 명령을 글 상자 단위로 묶음: ① 같은 줄에서 이어지는 조각(굵은 글씨·한 글자씩 벌려 쓴 글자) ② 같은 간격으로 내려가는 여러 줄
  function textBlocks(run) {
    // ① 줄 만들기
    const lines = [];
    run.forEach(o => {
      const f = parseFont(o.font), mm = mat(o.m), size = f.size * mm.sx;
      const base = devBaseline(o);
      const L = lines[lines.length - 1];
      if (L && !o.outline && !L.outline && Math.abs(L.rot - mm.rot) < 0.1 && Math.abs(L.base[1] - base[1]) < 0.6 && Math.abs(L.size - size) < 0.6 && L.alignL && (o.align === 'left' || o.align === 'start')) {
        const end = L.x1, gap = base[0] - end;
        if (gap > -1.5 && gap < size * 0.9) { L.segs.push({ o, f, gap }); L.x1 = base[0] + o.w * mm.sx; return; }
      }
      lines.push({ base, x0: base[0], x1: base[0] + o.w * mm.sx, size, rot: mm.rot, alignL: o.align === 'left' || o.align === 'start', outline: !!o.outline, segs: [{ o, f, gap: 0 }] });
    });
    // ② 문단 묶기: 같은 글꼴·색·정렬·기준점, 같은 줄 간격
    const blocks = [];
    lines.forEach(L => {
      const B = blocks[blocks.length - 1], o = L.segs[0].o;
      const sig = lineSig(L);
      if (B && B.sig === sig && !L.outline && L.segs.length === 1 && B.lines[B.lines.length - 1].segs.length === 1) {
        const prev = B.lines[B.lines.length - 1], step = L.base[1] - prev.base[1];
        const ax = anchorX(L), bx = anchorX(prev);
        if (Math.abs(ax - bx) < 1 && step > L.size * 0.85 && step < L.size * 2.6 && (B.step == null || Math.abs(step - B.step) < 1.2)) { B.step = B.step == null ? step : B.step; B.lines.push(L); return; }
      }
      blocks.push({ sig, lines: [L], step: null, o });
    });
    return blocks;
  }
  function lineSig(L) { const o = L.segs[0].o; return [o.font, JSON.stringify(o.fill), o.align, L.rot.toFixed(1), o.alpha, o.shd ? 1 : 0].join('|'); }
  function anchorX(L) { const o = L.segs[0].o, k = mat(o.m).sx, w = o.w * k; return o.align === 'center' ? L.x0 + w / 2 : (o.align === 'right' || o.align === 'end') ? L.x0 + w : L.x0; }
  // 기기 좌표의 알파벳 기준선 시작점(왼쪽 끝)
  function devBaseline(o) {
    const k = mat(o.m).sx; let w = o.w;
    if (o.mw != null && w > o.mw) w = o.mw;
    let lx = o.x; if (o.align === 'center') lx -= w / 2; else if (o.align === 'right' || o.align === 'end') lx -= w;
    return apply(o.m, lx, o.y + o.shift).concat([k]);
  }
  function colorOf(p) { if (p.c) return parseColor(p.c) || { hex: '#000000', a: 1 }; const s = p.g && p.g.stops[0]; return s ? parseColor(s[1]) : { hex: '#000000', a: 1 }; }
  function textEl(B, uid) {
    const L0 = B.lines[0], o = L0.segs[0].o, f = L0.segs[0].f, mm = mat(o.m), k = mm.sx;
    let size = f.size * k;
    // maxWidth로 눌려 그려진 글자는 그만큼 작게
    if (o.mw != null && o.w > o.mw) size *= o.mw / o.w;
    const A = o.A * k * (size / (f.size * k)), D = o.D * k * (size / (f.size * k));
    const n = B.lines.length, step = B.step || size * 1.25, lhPx = n > 1 ? step : Math.max(size * 1.15, A + D);
    const widths = B.lines.map(L => L.x1 - L.x0), wMax = Math.max(...widths);
    const slack = Math.max(6, wMax * 0.06 + size * 0.15);
    const boxW = wMax + slack;
    const align = o.align === 'center' ? 'center' : (o.align === 'right' || o.align === 'end') ? 'right' : 'left';
    // 첫 줄 기준선에서 상자 위쪽까지: (줄높이 − (어센트+디센트))/2 + 어센트
    const topOff = (lhPx - (A + D)) / 2 + A;
    // 회전이 없을 때 상자 위치 (회전이 있으면 중심을 돌림)
    const ax = anchorX(L0);
    let left = align === 'left' ? L0.x0 : align === 'center' ? ax - boxW / 2 : ax - boxW;
    let top = L0.base[1] - topOff;
    const boxH = lhPx * n;
    if (Math.abs(mm.rot) > 0.05) {
      // 회전된 글자: 기준점(로컬)으로 상자를 잡고 그 중심을 돌려 놓음
      const lx = o.align === 'center' ? -boxW / 2 : (o.align === 'right' || o.align === 'end') ? -boxW : 0;
      const ly = o.shift * k - topOff;
      const a = mm.rot * Math.PI / 180, cxL = lx + boxW / 2, cyL = ly + boxH / 2;
      const origin = apply(o.m, o.x, o.y);
      const cx = origin[0] + cxL * Math.cos(a) - cyL * Math.sin(a), cy = origin[1] + cxL * Math.sin(a) + cyL * Math.cos(a);
      left = cx - boxW / 2; top = cy - boxH / 2;
    }
    const c = colorOf(o.fill);
    const el = { id: uid(), type: 'text', x: r2(left * PX), y: r2(top * PX), w: r2(boxW * PX), h: r2(boxH * PX), rot: r2(mm.rot), font: f.family, size: r2(size * PT), weight: f.weight, italic: f.italic, color: c.hex, align, lh: r2(lhPx / size), ls: 0, strokeW: 0, strokeC: '#ffffff', shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: r2(o.alpha * (c.a == null ? 1 : c.a)), valign: 'top', name: '' };
    if (o.fill.g && o.fill.g.stops.length >= 2) { const g = o.fill.g, c1 = parseColor(g.stops[g.stops.length - 1][1]); el.fillType = 'gradient'; el.g1 = c.hex; el.g2 = c1.hex; el.gAngle = g.type === 'linear' ? Math.round(Math.atan2(g.p[3] - g.p[1], g.p[2] - g.p[0]) * 180 / Math.PI) + 90 : 180; }
    Object.assign(el, shadowProps(o.shd, 1));
    if (o.outline) { const so = o.outline, sc = colorOf(so.stroke); el.strokeW = r2(so.lw * mat(so.m).sx * PT); el.strokeC = sc.hex; if (!o.shd && so.shd) Object.assign(el, shadowProps(so.shd, 1)); }
    // 내용: 여러 줄은 줄바꿈으로, 한 줄 안의 조각(굵게·색)은 서식 있는 글자로
    const lines = B.lines.map(L => L.segs);
    el.text = lines.map(segs => segs.map(s => s.o.t).join('')).join('\n');
    // 한 글자씩 벌려 쓴 글자(자간) → 자간 값으로
    const one = lines.length === 1 ? lines[0] : null;
    if (one && one.length > 2 && one.every(s => [...s.o.t].length === 1 && s.o.font === o.font && JSON.stringify(s.o.fill) === JSON.stringify(o.fill))) {
      const gaps = one.slice(1).map(s => s.gap); const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (gaps.every(g => Math.abs(g - avg) < 1.5)) { el.ls = r2(avg / size); return el; }
    }
    const rich = lines.some(segs => segs.length > 1 || segs.some(s => s.o.font !== o.font || JSON.stringify(s.o.fill) !== JSON.stringify(o.fill)));
    if (rich) {
      const esc = t => String(t).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
      el.html = lines.map(segs => segs.map(s => { const sf = s.f, scol = colorOf(s.o.fill), st = []; if (sf.weight !== f.weight) st.push(`font-weight:${sf.weight}`); if (scol.hex !== c.hex) st.push(`color:${scol.hex}`); if (Math.abs(sf.size - f.size) > 0.3) st.push(`font-size:${r2(sf.size * k * PT)}pt`); if (sf.family !== f.family) st.push(`font-family:'${sf.family}'`); return st.length ? `<span style="${st.join(';')}">${esc(s.o.t)}</span>` : esc(s.o.t); }).join('')).join('<br>');
      el.htmlFor = el.text;
    }
    return el;
  }

  /* ======================= 5. 엔진 다루기 ======================= */
  const ENGINE = new URL('../naracha/news.html', location.href).href;
  // 엔진으로 지금 설정의 소식지를 그리면서 기록 → [{name, rec, w, h}]
  async function capture(win, opt) {
    opt = opt || {};
    if (!win || typeof win.buildPages !== 'function') throw new Error('소식지 엔진이 아직 준비되지 않았습니다');
    // 엔진의 [미리보기 만들기]와 같은 준비(글꼴 예열·사진 불러오기)를 거친 뒤 한 번 더 그리며 기록
    await prepare(win);
    const orig = win.newCanvas;
    win.newCanvas = function () { const c = orig.apply(this, arguments); attach(c); return c; };
    let list;
    try { list = opt.tv ? win.buildTvPages() : win.buildPages(win.selectedBday(), win.selectedKkw(), win.selectedRec()); }
    finally { win.newCanvas = orig; }
    return list.filter(p => p.canvas && p.canvas.__rec).map(p => ({ name: p.name, label: labelOf(p.name), rec: p.canvas.__rec, w: p.canvas.width, h: p.canvas.height, canvas: p.canvas }));
  }
  function labelOf(nm) { nm = String(nm || ''); const m = nm.match(/_(\d+)$/); const part = m ? ' ' + m[1] : ''; if (m) nm = nm.slice(0, -m[0].length); if (nm.indexOf('보고_') === 0) nm = nm.slice(3); nm = nm.replace(/^수련안내_/, '수련 안내 ').replace('승급심사추천', '승급심사 추천자').replace('국기원심사', '국기원 응시예정자').replace('실천체크리스트', '실천 체크리스트'); return nm + part; }
  // 엔진의 makeAll()을 그대로 불러 글꼴·사진을 준비시키고 끝날 때까지 기다림
  function prepare(win) {
    return new Promise((res, rej) => {
      const btn = win.document.getElementById('btnMake');
      const t0 = Date.now(); let started = false;
      try { win.makeAll(); } catch (e) { rej(e); return; }
      const tick = () => {
        if (btn && btn.disabled) started = true;
        if (btn && !btn.disabled && (started || Date.now() - t0 > 400)) { res(); return; }
        if (Date.now() - t0 > 60000) { rej(new Error('소식지를 만드는 데 너무 오래 걸립니다')); return; }
        setTimeout(tick, 80);
      };
      setTimeout(tick, 60);
    });
  }


  /* ======================= 6. 영상 도우미 (소식지 엔진 원문 그대로) =======================
     MP4 형식 고르기(tvMime)·넘김 곡선(tvEase)·TV에서 재생되는 일반 MP4로 다시 묶기(mp4Defrag, R7.3).
     영상 만들기 본체는 video.js(NC.video)가 이것을 씀. */
  function tvEase(p){ return (p<0.5)?(4*p*p*p):(1-Math.pow(-2*p+2,3)/2); }
  function tvMime(){
    if(!window.MediaRecorder) return "";
    /* [R7.3] TV 호환: H.264 Main 프로파일 레벨 4.0(1080p30 표준)을 먼저 요청 */
    var list=["video/mp4;codecs=avc1.4d0028","video/mp4;codecs=avc1.4d002a","video/mp4;codecs=avc1.640028","video/mp4","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"];
    for(var i=0;i<list.length;i++){ try{ if(MediaRecorder.isTypeSupported(list[i])) return list[i]; }catch(e){} }
    return "";
  }
  function mp4Defrag(buf){
    var u=new Uint8Array(buf), dv=new DataView(buf);
    function kids(st,en){
      var o=[], p=st;
      while(p+8<=en){
        var sz=dv.getUint32(p), tp=String.fromCharCode(u[p+4],u[p+5],u[p+6],u[p+7]), h=8;
        if(sz===1){ sz=dv.getUint32(p+8)*4294967296+dv.getUint32(p+12); h=16; } else if(sz===0) sz=en-p;
        if(sz<8 || p+sz>en) break;
        o.push({t:tp, s:p, e:p+sz, b:p+h}); p+=sz;
      }
      return o;
    }
    function find(l,t){ for(var i=0;i<l.length;i++) if(l[i].t===t) return l[i]; return null; }
    var top=kids(0,u.length), moov=find(top,"moov");
    if(!moov || !find(top,"moof")) return null;
    var mk=kids(moov.b,moov.e), mvhd=find(mk,"mvhd"), traks=mk.filter(function(k){ return k.t==="trak"; }), mvex=find(mk,"mvex");
    if(!mvhd || traks.length!==1) return null;
    var tk=kids(traks[0].b,traks[0].e), tkhd=find(tk,"tkhd"), mdia=find(tk,"mdia"); if(!tkhd||!mdia) return null;
    var mdk=kids(mdia.b,mdia.e), mdhd=find(mdk,"mdhd"), hdlr=find(mdk,"hdlr"), minf=find(mdk,"minf"); if(!mdhd||!hdlr||!minf) return null;
    var mik=kids(minf.b,minf.e), vmhd=find(mik,"vmhd"), dinf=find(mik,"dinf"), stbl=find(mik,"stbl"); if(!vmhd||!dinf||!stbl) return null;
    var stsd=find(kids(stbl.b,stbl.e),"stsd"); if(!stsd) return null;
    var trex={dur:0,size:0,flags:0};
    if(mvex){ var tx=find(kids(mvex.b,mvex.e),"trex"); if(tx){ trex.dur=dv.getUint32(tx.b+12); trex.size=dv.getUint32(tx.b+16); trex.flags=dv.getUint32(tx.b+20); } }
    /* 표본 모으기 */
    var S2=[], anyCto=false;
    top.forEach(function(bx){
      if(bx.t!=="moof") return;
      kids(bx.b,bx.e).forEach(function(tf){
        if(tf.t!=="traf") return;
        var tfk=kids(tf.b,tf.e), tfhd=find(tfk,"tfhd"); if(!tfhd) return;
        var fl=dv.getUint32(tfhd.b)&0xffffff, p=tfhd.b+8, base=bx.s, dDur=trex.dur, dSize=trex.size, dFlags=trex.flags;
        if(fl&0x1){ base=dv.getUint32(p)*4294967296+dv.getUint32(p+4); p+=8; }
        if(fl&0x2) p+=4;
        if(fl&0x8){ dDur=dv.getUint32(p); p+=4; }
        if(fl&0x10){ dSize=dv.getUint32(p); p+=4; }
        if(fl&0x20){ dFlags=dv.getUint32(p); p+=4; }
        var pos=-1;
        tfk.forEach(function(tr){
          if(tr.t!=="trun") return;
          var ver=u[tr.b], rf=dv.getUint32(tr.b)&0xffffff, n=dv.getUint32(tr.b+4), q=tr.b+8, first=null;
          if(rf&0x1){ pos=base+dv.getInt32(q); q+=4; } else if(pos<0) pos=base;
          if(rf&0x4){ first=dv.getUint32(q); q+=4; }
          for(var i=0;i<n;i++){
            var d=dDur, z=dSize, f=dFlags, c=0;
            if(rf&0x100){ d=dv.getUint32(q); q+=4; }
            if(rf&0x200){ z=dv.getUint32(q); q+=4; }
            if(rf&0x400){ f=dv.getUint32(q); q+=4; } else if(i===0 && first!=null) f=first;
            if(rf&0x800){ c=ver?dv.getInt32(q):dv.getUint32(q); q+=4; if(c) anyCto=true; }
            S2.push({o:pos, z:z, d:d, k:!(f&0x10000), c:c}); pos+=z;
          }
        });
      });
    });
    var N=S2.length; if(!N) return null;
    for(var i=0;i<N;i++){ if(S2[i].o+S2[i].z>u.length) return null; }
    /* 길이가 0인 표본(마지막 등)은 앞 표본 길이로 */
    var mdTs=(u[mdhd.b]===1)?dv.getUint32(mdhd.b+20):dv.getUint32(mdhd.b+12);
    var mvTs=(u[mvhd.b]===1)?dv.getUint32(mvhd.b+20):dv.getUint32(mvhd.b+12);
    var total=0;
    for(i=0;i<N;i++){ if(!S2[i].d) S2[i].d=(i>0?S2[i-1].d:Math.max(1,Math.round(mdTs/30))); total+=S2[i].d; }
    if(!S2.some(function(x){ return x.k; })) S2[0].k=true;
    /* 프레임 간격을 일정하게(고정 프레임률) — 녹화 간격이 들쭉날쭉하면 일부 TV 재생기가 끊기거나 거부한다.
       전체 길이는 그대로 두고 고르게 나눈다(초당 20~40프레임일 때만). */
    var fpsAvg=N/(total/mdTs);
    if(fpsAvg>=20 && fpsAvg<=40){ var each=Math.floor(total/N), extra=total-each*N; for(i=0;i<N;i++) S2[i].d=each+(i<extra?1:0); }
    /* 상자 만들기 */
    function cat(arr){ var n=0; arr.forEach(function(a){ n+=a.length; }); var o=new Uint8Array(n), p=0; arr.forEach(function(a){ o.set(a,p); p+=a.length; }); return o; }
    function box(t){ var parts=Array.prototype.slice.call(arguments,1), body=cat(parts), o=new Uint8Array(8+body.length), d=new DataView(o.buffer);
      d.setUint32(0,o.length); for(var k=0;k<4;k++) o[4+k]=t.charCodeAt(k); o.set(body,8); return o; }
    function u32s(list){ var o=new Uint8Array(list.length*4), d=new DataView(o.buffer); list.forEach(function(v,k){ d.setUint32(k*4, v>>>0); }); return o; }
    function i32s(list){ var o=new Uint8Array(list.length*4), d=new DataView(o.buffer); list.forEach(function(v,k){ d.setInt32(k*4, v); }); return o; }
    function copy(bx){ return u.slice(bx.s, bx.e); }
    function setDur(arr, v){   /* mvhd·mdhd·tkhd 의 길이 칸 */
      var d=new DataView(arr.buffer), ver=arr[8], isTk=(String.fromCharCode(arr[4],arr[5],arr[6],arr[7])==="tkhd");
      if(ver===1){ var off=isTk?36:32; d.setUint32(off, Math.floor(v/4294967296)); d.setUint32(off+4, v>>>0); }
      else d.setUint32(isTk?28:24, v>>>0);
      return arr;
    }
    var movDur=Math.round(total*mvTs/mdTs);
    var nMvhd=setDur(copy(mvhd), movDur), nTkhd=setDur(copy(tkhd), movDur), nMdhd=setDur(copy(mdhd), total);
    nTkhd[11]|=7;   /* 켜짐 · 영상에 포함 · 미리보기 */
    /* stts(길이 묶음) */
    var stts=[], run=0, last=-1;
    for(i=0;i<N;i++){ if(S2[i].d===last) run++; else { if(run) stts.push(run,last); run=1; last=S2[i].d; } }
    stts.push(run,last);
    var sync=[]; for(i=0;i<N;i++){ if(S2[i].k) sync.push(i+1); }
    /* 묶음(chunk): 30표본씩 */
    var PER=30, nCh=Math.ceil(N/PER), rem=N-(nCh-1)*PER;
    var stsc=[1,PER,1]; if(nCh===1) stsc=[1,N,1]; else if(rem!==PER) stsc=stsc.concat([nCh,rem,1]);
    var sizes=S2.map(function(x){ return x.z; });
    /* 1080p·초당 30프레임 이하면 레벨 표기를 4.0으로(녹화기가 4.2로 적는 경우가 있어, 4.0까지만 받는 재생기를 위해).
       화면 데이터는 그대로이고 «표기»만 고친다: avcC 의 레벨 칸 + 그 안 SPS 의 level_idc */
    var nStsd=copy(stsd), nAi=-1;
    for(i=8;i<nStsd.length-8;i++){ if(nStsd[i]===0x61&&nStsd[i+1]===0x76&&nStsd[i+2]===0x63&&nStsd[i+3]===0x43){ nAi=i; break; } }
    if(nAi>0 && fpsAvg<=30.5 && nStsd[nAi+7]>40 && nStsd[nAi+7]<=42){
      var a0=nAi+4;                    /* avcC 본문 시작: [0]버전 [1]프로파일 [2]호환 [3]레벨 [4]길이크기 [5]SPS개수 [6..7]SPS길이 [8]NAL머리 [9]프로파일 [10]호환 [11]레벨 */
      if((nStsd[a0+5]&0x1f)>=1 && (nStsd[a0+8]&0x1f)===7 && nStsd[a0+11]===nStsd[a0+3]){ nStsd[a0+3]=40; nStsd[a0+11]=40; }
    }
    function build(dataStart){
      var co=[], p=dataStart; for(var k=0;k<N;k++){ if(k%PER===0) co.push(p); p+=S2[k].z; }
      var boxes=[ nStsd,
        box("stts", u32s([0, stts.length/2].concat(stts))) ];
      if(anyCto){
        var ct=[], r2=0, l2=null; for(var k2=0;k2<N;k2++){ if(S2[k2].c===l2) r2++; else { if(r2) ct.push(r2,l2); r2=1; l2=S2[k2].c; } } ct.push(r2,l2);
        var hd=new Uint8Array(8); hd[0]=1; new DataView(hd.buffer).setUint32(4, ct.length/2);
        boxes.push(box("ctts", hd, i32s(ct)));
      }
      if(sync.length<N) boxes.push(box("stss", u32s([0, sync.length].concat(sync))));
      boxes.push(box("stsc", u32s([0, stsc.length/3].concat(stsc))));
      boxes.push(box("stsz", u32s([0, 0, N].concat(sizes))));
      boxes.push(box("stco", u32s([0, co.length].concat(co))));
      var nStbl=box.apply(null, ["stbl"].concat(boxes));
      var nMinf=box("minf", copy(vmhd), copy(dinf), nStbl);
      var nMdia=box("mdia", nMdhd, copy(hdlr), nMinf);
      return box("moov", nMvhd, box("trak", nTkhd, nMdia));
    }
    var ftyp=box("ftyp", new Uint8Array([0x69,0x73,0x6f,0x6d, 0,0,2,0, 0x69,0x73,0x6f,0x6d, 0x69,0x73,0x6f,0x32, 0x61,0x76,0x63,0x31, 0x6d,0x70,0x34,0x31]));   /* isom / isom iso2 avc1 mp41 */
    var dataLen=0; sizes.forEach(function(z){ dataLen+=z; });
    if(dataLen+8>4294967295) return null;
    var probe=build(0), dataStart=ftyp.length+probe.length+8, nMoov=build(dataStart);
    if(nMoov.length!==probe.length) return null;
    var mh=new Uint8Array(8); new DataView(mh.buffer).setUint32(0, dataLen+8); mh[4]=0x6d; mh[5]=0x64; mh[6]=0x61; mh[7]=0x74;
    /* 영상 데이터: 이어진 구간끼리 묶어 복사 없이 넘긴다 */
    var parts=[ftyp, nMoov, mh], rs=S2[0].o, re=S2[0].o+S2[0].z;
    for(i=1;i<N;i++){ if(S2[i].o===re) re+=S2[i].z; else { parts.push(u.subarray(rs,re)); rs=S2[i].o; re=rs+S2[i].z; } }
    parts.push(u.subarray(rs,re));
    var sd=nStsd, codec="", ai=nAi;
    codec=String.fromCharCode(sd[20],sd[21],sd[22],sd[23]);
    var prof=(ai>0)?sd[ai+5]:0, lvl=(ai>0)?sd[ai+7]:0;
    return { parts:parts, frames:N, seconds:total/mdTs, codec:codec, profile:prof, level:lvl, keys:sync.length };
  }
  return { PX, attach, convert, capture, prepare, labelOf, ENGINE, parseColor, parseFont, tvMime, tvEase, mp4Defrag, _textBlocks: textBlocks };
})();
