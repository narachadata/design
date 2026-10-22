// 글자 효과 · 벡터 도형 · 펜 경로 렌더링 (포토샵 레이어 스타일 / 일러스트레이터 도형을 참고)
window.NC = window.NC || {};
NC.fx = (function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PT = 25.4 / 72; // 1pt = 0.3528mm
  function rgba(hex, a) { if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return hex || '#000'; const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a == null ? 1 : a})`; }

  /* ---------- 글자 ---------- */
  const TEXT_FX_DEF = { fillType: 'solid', g1: '#2f5bea', g2: '#e0564b', gAngle: 90, glow: false, glowC: '#ffd34d', glowB: 1.2, d3: 0, d3C: '#1e2b5a', d3X: 0.3, d3Y: 0.3, underline: false, strike: false, upper: false, vertical: false, blend: 'normal', warp: 'none', warpAmt: 40, bgR: 0, shA: 0.25 };
  function textShadows(el, useFilter) {
    const parts = [];
    for (let i = 1; i <= (el.d3 || 0); i++) parts.push([el.d3X * i, el.d3Y * i, 0, el.d3C]);
    if (el.glow) { parts.push([0, 0, el.glowB, el.glowC], [0, 0, el.glowB * 2, el.glowC], [0, 0, el.glowB * 0.5, el.glowC]); }
    if (el.shadow) parts.push([el.shX, el.shY, el.shB, rgba(el.shC, el.shA == null ? 0.25 : el.shA)]);
    if (!parts.length) return '';
    if (useFilter) return `filter:${parts.map(p => `drop-shadow(${p[0]}mm ${p[1]}mm ${p[2]}mm ${p[3]})`).join(' ')};`;
    return `text-shadow:${parts.map(p => `${p[0]}mm ${p[1]}mm ${p[2]}mm ${p[3]}`).join(',')};`;
  }
  function textStyle(el) {
    const grad = el.fillType === 'gradient';
    let s = `font-family:'${el.font}';font-size:${el.size}pt;font-weight:${el.weight};font-style:${el.italic ? 'italic' : 'normal'};text-align:${el.align};line-height:${el.lh};letter-spacing:${el.ls}em;`;
    s += grad ? `background:linear-gradient(${el.gAngle || 90}deg,${el.g1},${el.g2});-webkit-background-clip:text;background-clip:text;color:transparent;` : `color:${el.color};`;
    if (el.strokeW > 0) s += `-webkit-text-stroke:${el.strokeW}pt ${el.strokeC};paint-order:stroke fill;`;
    s += textShadows(el, grad);
    const deco = [el.underline ? 'underline' : '', el.strike ? 'line-through' : ''].filter(Boolean).join(' ');
    if (deco) s += `text-decoration:${deco};text-decoration-color:${grad ? el.g1 : el.color};`;
    if (el.upper) s += 'text-transform:uppercase;';
    if (el.vertical) s += 'writing-mode:vertical-rl;text-orientation:upright;';
    if (el.blend && el.blend !== 'normal') s += `mix-blend-mode:${el.blend};`;
    if (el.bg) s += `background-color:${el.bg};${grad ? '' : ''}border-radius:${el.bgR || 0}mm;`;
    if (el.pad) s += `padding:${el.pad}mm;`;
    if (el.valign && el.valign !== 'top') s += `display:flex;flex-direction:column;justify-content:${el.valign === 'middle' ? 'center' : 'flex-end'};`;
    return s;
  }
  // 휘어진 글자: SVG textPath (한 줄 기준)
  function warpSVG(el) {
    const W = el.w, Hh = el.h, fs = el.size * PT, amt = (el.warpAmt == null ? 40 : el.warpAmt) / 100;
    const text = el.upper ? el.text.toUpperCase() : el.text.replace(/\n/g, ' ');
    let d;
    if (el.warp === 'circle') { const r = Math.max(2, Math.min(W, Hh) / 2 - fs * 0.6); const cx = W / 2, cy = Hh / 2; d = `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`; }
    else { const y0 = el.warp === 'arcDown' ? Hh * 0.3 + fs * 0.4 : Hh * 0.7; const peak = el.warp === 'arcDown' ? y0 + 2 * amt * Hh * 0.6 : y0 - 2 * amt * Hh * 0.6; d = `M0 ${y0} Q${W / 2} ${peak} ${W} ${y0}`; }
    const grad = el.fillType === 'gradient';
    const id = 'g' + el.id;
    const fill = grad ? `url(#${id})` : el.color;
    const defs = grad ? `<defs><linearGradient id="${id}" gradientTransform="rotate(${(el.gAngle || 90) - 90})"><stop offset="0" stop-color="${el.g1}"/><stop offset="1" stop-color="${el.g2}"/></linearGradient></defs>` : '';
    const stroke = el.strokeW > 0 ? `stroke="${el.strokeC}" stroke-width="${el.strokeW * PT}" paint-order="stroke fill" stroke-linejoin="round"` : '';
    const sh = textShadows(el, true).replace('filter:', '').replace(';', '');
    return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" height="100%" style="overflow:visible;display:block;${sh ? `filter:${sh};` : ''}" xmlns="http://www.w3.org/2000/svg">${defs}<path id="p${el.id}" d="${d}" fill="none"/><text font-family="${esc(el.font)}" font-size="${fs}" font-weight="${el.weight}" font-style="${el.italic ? 'italic' : 'normal'}" letter-spacing="${el.ls * fs}" fill="${fill}" ${stroke}><textPath href="#p${el.id}" startOffset="50%" text-anchor="middle">${esc(text)}</textPath></text></svg>`;
  }
  const TEXT_PRESETS = [
    { id: 'plain', name: '기본', st: { fillType: 'solid', strokeW: 0, shadow: false, glow: false, d3: 0, bg: '' } },
    { id: 'sticker', name: '스티커', st: { fillType: 'solid', color: '#1E2B5A', strokeW: 3, strokeC: '#ffffff', shadow: true, shC: '#000000', shA: 0.3, shX: 0.8, shY: 0.8, shB: 0.6, glow: false, d3: 0, weight: 800 } },
    { id: 'outline', name: '외곽선만', st: { fillType: 'solid', color: '#ffffff', strokeW: 1.5, strokeC: '#1E2B5A', shadow: false, glow: false, d3: 0, weight: 800 } },
    { id: 'shadow', name: '긴 그림자', st: { fillType: 'solid', color: '#ffffff', strokeW: 0, shadow: false, glow: false, d3: 8, d3C: '#1E2B5A', d3X: 0.35, d3Y: 0.35, weight: 800 } },
    { id: 'block3d', name: '3D 블록', st: { fillType: 'solid', color: '#FFD34D', strokeW: 1, strokeC: '#1E2B5A', shadow: false, glow: false, d3: 6, d3C: '#1E2B5A', d3X: 0, d3Y: 0.45, weight: 800 } },
    { id: 'neon', name: '네온', st: { fillType: 'solid', color: '#ffffff', strokeW: 0, shadow: false, glow: true, glowC: '#2f5bea', glowB: 1.6, d3: 0, weight: 700 } },
    { id: 'gradient', name: '그라데이션', st: { fillType: 'gradient', g1: '#2f5bea', g2: '#e0564b', gAngle: 90, strokeW: 0, shadow: false, glow: false, d3: 0, weight: 800 } },
    { id: 'gold', name: '골드', st: { fillType: 'gradient', g1: '#F6E27A', g2: '#B8860B', gAngle: 180, strokeW: 0.6, strokeC: '#7A5A00', shadow: true, shC: '#000000', shA: 0.35, shX: 0.4, shY: 0.6, shB: 0.5, glow: false, d3: 0, weight: 800 } },
    { id: 'retro', name: '레트로', st: { fillType: 'solid', color: '#E0564B', strokeW: 0, shadow: true, shC: '#1E2B5A', shA: 1, shX: 1, shY: 1, shB: 0, glow: false, d3: 0, weight: 800 } },
    { id: 'box', name: '박스 강조', st: { fillType: 'solid', color: '#ffffff', bg: '#1E2B5A', bgR: 1.5, pad: 2, strokeW: 0, shadow: false, glow: false, d3: 0, weight: 700 } },
    { id: 'highlight', name: '형광펜', st: { fillType: 'solid', color: '#1a1a1a', bg: '#FFE89A', bgR: 0.5, pad: 1, strokeW: 0, shadow: false, glow: false, d3: 0 } },
    { id: 'arc', name: '아치형', st: { warp: 'arcUp', warpAmt: 40 } },
    { id: 'circle', name: '원형 글자', st: { warp: 'circle' } },
    { id: 'vertical', name: '세로쓰기', st: { vertical: true, warp: 'none' } },
  ];

  /* ---------- 벡터 도형 (SVG) ---------- */
  const SHAPES = [['rect', '사각형'], ['ellipse', '원'], ['tri', '삼각형'], ['line', '선'], ['arrow', '화살표'], ['star', '별'], ['polygon', '다각형'], ['heart', '하트'], ['diamond', '마름모'], ['hexagon', '육각형'], ['bubble', '말풍선'], ['cross', '십자'], ['ring', '고리'], ['tab', '탭'], ['burst', '폭발'], ['pill', '알약']];
  function polyPts(n, w, h, rot) { const pts = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (rot || 0) + i * 2 * Math.PI / n; pts.push([w / 2 + w / 2 * Math.cos(a), h / 2 + h / 2 * Math.sin(a)]); } return pts; }
  function starPts(n, inner, w, h) { const pts = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? inner : 1; const a = -Math.PI / 2 + i * Math.PI / n; pts.push([w / 2 + w / 2 * r * Math.cos(a), h / 2 + h / 2 * r * Math.sin(a)]); } return pts; }
  const P = pts => pts.map(p => p.map(v => Math.round(v * 100) / 100).join(',')).join(' ');
  function shapeBody(el, w, h, attrs) {
    const k = el.kind; const sw = el.strokeW || 0;
    switch (k) {
      case 'rect': case 'pill': return `<rect x="${sw / 2}" y="${sw / 2}" width="${w - sw}" height="${h - sw}" rx="${k === 'pill' ? Math.min(w, h) / 2 : (el.radius || 0)}" ${attrs}/>`;
      case 'ellipse': return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - sw / 2}" ry="${h / 2 - sw / 2}" ${attrs}/>`;
      case 'line': return `<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" ${attrs}/>`;
      case 'tri': return `<polygon points="${P([[w / 2, sw], [w - sw, h - sw], [sw, h - sw]])}" ${attrs}/>`;
      case 'tab': return `<polygon points="${P([[0, 0], [w, 0], [w, h * 0.8], [0, h]])}" ${attrs}/>`;
      case 'arrow': { const hw = el.headW == null ? 0.5 : el.headW, hl = el.headL == null ? 0.4 : el.headL; const sh = h * (1 - hw) / 2; return `<polygon points="${P([[0, sh], [w * (1 - hl), sh], [w * (1 - hl), 0], [w, h / 2], [w * (1 - hl), h], [w * (1 - hl), h - sh], [0, h - sh]])}" ${attrs}/>`; }
      case 'star': return `<polygon points="${P(starPts(el.points || 5, el.inner == null ? 0.45 : el.inner, w - sw, h - sw).map(p => [p[0] + sw / 2, p[1] + sw / 2]))}" ${attrs}/>`;
      case 'burst': return `<polygon points="${P(starPts(el.points || 12, el.inner == null ? 0.78 : el.inner, w - sw, h - sw).map(p => [p[0] + sw / 2, p[1] + sw / 2]))}" ${attrs}/>`;
      case 'polygon': return `<polygon points="${P(polyPts(el.sides || 6, w - sw, h - sw).map(p => [p[0] + sw / 2, p[1] + sw / 2]))}" ${attrs}/>`;
      case 'hexagon': return `<polygon points="${P(polyPts(6, w - sw, h - sw, Math.PI / 6).map(p => [p[0] + sw / 2, p[1] + sw / 2]))}" ${attrs}/>`;
      case 'diamond': return `<polygon points="${P([[w / 2, sw], [w - sw, h / 2], [w / 2, h - sw], [sw, h / 2]])}" ${attrs}/>`;
      case 'cross': { const t = (el.inner == null ? 0.34 : el.inner); const a = w * (1 - t) / 2, b = h * (1 - t) / 2; return `<polygon points="${P([[a, 0], [w - a, 0], [w - a, b], [w, b], [w, h - b], [w - a, h - b], [w - a, h], [a, h], [a, h - b], [0, h - b], [0, b], [a, b]])}" ${attrs}/>`; }
      case 'heart': return `<path d="M${w / 2} ${h * 0.95} C${w * 0.1} ${h * 0.62} ${-w * 0.05} ${h * 0.28} ${w * 0.25} ${h * 0.12} C${w * 0.4} ${h * 0.03} ${w * 0.5} ${h * 0.2} ${w / 2} ${h * 0.3} C${w * 0.5} ${h * 0.2} ${w * 0.6} ${h * 0.03} ${w * 0.75} ${h * 0.12} C${w * 1.05} ${h * 0.28} ${w * 0.9} ${h * 0.62} ${w / 2} ${h * 0.95}Z" ${attrs}/>`;
      case 'bubble': { const r = Math.min(w, h) * 0.12, bh = h * 0.78; return `<path d="M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${bh - r} Q${w} ${bh} ${w - r} ${bh} H${w * 0.35} L${w * 0.2} ${h} L${w * 0.24} ${bh} H${r} Q0 ${bh} 0 ${bh - r} V${r} Q0 0 ${r} 0Z" ${attrs}/>`; }
      case 'ring': { const t = (el.inner == null ? 0.3 : el.inner); return `<path fill-rule="evenodd" d="M${w / 2} 0 A${w / 2} ${h / 2} 0 1 1 ${w / 2 - 0.01} 0 Z M${w / 2} ${h * t / 2} A${w / 2 * (1 - t)} ${h / 2 * (1 - t)} 0 1 0 ${w / 2 - 0.01} ${h * t / 2} Z" ${attrs}/>`; }
      default: return `<rect width="${w}" height="${h}" ${attrs}/>`;
    }
  }
  function fillAttr(el, id) {
    if (el.fillType === 'gradient') return { attr: `fill="url(#${id})"`, defs: el.gKind === 'radial' ? `<radialGradient id="${id}"><stop offset="0" stop-color="${el.g1}"/><stop offset="1" stop-color="${el.g2}"/></radialGradient>` : `<linearGradient id="${id}" gradientTransform="rotate(${(el.gAngle || 0)} .5 .5)"><stop offset="0" stop-color="${el.g1}"/><stop offset="1" stop-color="${el.g2}"/></linearGradient>` };
    return { attr: `fill="${el.fill || 'none'}"`, defs: '' };
  }
  function shapeSVG(el) {
    const w = el.w, h = el.h; const id = 'sg' + el.id;
    const f = el.kind === 'line' ? { attr: 'fill="none"', defs: '' } : fillAttr(el, id);
    const sw = el.kind === 'line' ? (el.strokeW || 0.5) : (el.strokeW || 0);
    const stroke = sw > 0 ? `stroke="${el.kind === 'line' ? (el.stroke || el.fill || '#333') : (el.stroke || '#333')}" stroke-width="${sw}" stroke-linecap="${el.cap || 'butt'}" stroke-linejoin="round" ${el.dash ? `stroke-dasharray="${el.dash}"` : ''}` : (el.kind === 'line' ? 'stroke="#333" stroke-width="0.5"' : '');
    let markers = '';
    if (el.kind === 'line' && (el.arrowEnd || el.arrowStart)) { const c = el.stroke || el.fill || '#333'; markers = `<marker id="ae${el.id}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L6 3 L0 6 Z" fill="${c}"/></marker><marker id="as${el.id}" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M6 0 L0 3 L6 6 Z" fill="${c}"/></marker>`; }
    const mk = el.kind === 'line' ? `${el.arrowEnd ? `marker-end="url(#ae${el.id})"` : ''} ${el.arrowStart ? `marker-start="url(#as${el.id})"` : ''}` : '';
    const sh = el.shadow ? `filter:drop-shadow(${el.shX || 0.6}mm ${el.shY || 0.7}mm ${el.shB || 0.5}mm ${rgba(el.shC || '#000000', el.shA == null ? 0.3 : el.shA)});` : '';
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none" style="display:block;overflow:visible;${sh}" xmlns="http://www.w3.org/2000/svg"><defs>${f.defs}${markers}</defs>${shapeBody(el, w, h, `${f.attr} ${stroke} ${mk}`)}</svg>`;
  }
  /* ---------- 펜 경로 ---------- */
  function smoothPath(pts, closed) {
    if (!pts || pts.length < 2) return '';
    if (pts.length === 2) return `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) { const p0 = pts[i === 0 ? (closed ? n - 1 : 0) : i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || (closed ? pts[0] : p2); const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]; d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0]} ${p2[1]}`; }
    if (closed) d += ' Z';
    return d;
  }
  function pathSVG(el) {
    const w = el.w, h = el.h; const pts = el.pts || []; const id = 'pg' + el.id;
    const f = el.closed && el.fill ? fillAttr(el, id) : { attr: 'fill="none"', defs: '' };
    const d = el.smooth === false ? (pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ') + (el.closed ? ' Z' : '')) : smoothPath(pts, el.closed);
    const sh = el.shadow ? `filter:drop-shadow(${el.shX || 0.6}mm ${el.shY || 0.7}mm ${el.shB || 0.5}mm ${rgba(el.shC || '#000000', el.shA == null ? 0.3 : el.shA)});` : '';
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none" style="display:block;overflow:visible;${sh}" xmlns="http://www.w3.org/2000/svg"><defs>${f.defs}</defs><path d="${d}" ${f.attr} stroke="${el.stroke || '#333'}" stroke-width="${el.strokeW == null ? 0.8 : el.strokeW}" stroke-linecap="${el.cap || 'round'}" stroke-linejoin="round" ${el.dash ? `stroke-dasharray="${el.dash}"` : ''} vector-effect="non-scaling-stroke"/></svg>`;
  }
  /* ---------- 이미지 ---------- */
  const CLIPS = [['none', '없음'], ['circle', '원'], ['rounded', '둥근 모서리'], ['star', '별'], ['hexagon', '육각형'], ['heart', '하트'], ['diamond', '마름모'], ['blob', '물방울'], ['tri', '삼각형'], ['pill', '알약']];
  // w·h: 요소 크기(px). path()는 % 단위를 못 써서 하트는 실제 크기로 그림, 둥근 모서리는 가로세로가 달라도 같은 둥글기
  const HEART = [[0.5, 0.95], ['C', 0.1, 0.62, -0.05, 0.28, 0.25, 0.12], ['C', 0.4, 0.03, 0.5, 0.2, 0.5, 0.3], ['C', 0.5, 0.2, 0.6, 0.03, 0.75, 0.12], ['C', 1.05, 0.28, 0.9, 0.62, 0.5, 0.95]];
  function clipPath(k, w, h) {
    w = w || 100; h = h || 100; const f = v => Math.round(v * 100) / 100;
    switch (k) {
      case 'circle': return 'ellipse(50% 50% at 50% 50%)';
      case 'rounded': return `inset(0 round ${f(Math.min(w, h) * 0.12)}px)`;
      case 'pill': return 'inset(0 round 999px)';
      case 'star': return 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)';
      case 'hexagon': return 'polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0% 50%)';
      case 'diamond': return 'polygon(50% 0,100% 50%,50% 100%,0 50%)';
      case 'tri': return 'polygon(50% 0,100% 100%,0 100%)';
      case 'heart': return `path('M${f(HEART[0][0] * w)} ${f(HEART[0][1] * h)} ${HEART.slice(1).map(c => 'C' + [1, 3, 5].map(i => `${f(c[i] * w)} ${f(c[i + 1] * h)}`).join(' ')).join(' ')}Z')`; // 작은따옴표: style="" 속성 안에 들어가므로
      case 'blob': return 'polygon(60% 4%,86% 14%,98% 42%,90% 74%,66% 96%,34% 94%,10% 76%,2% 46%,14% 16%,36% 4%)';
      default: return '';
    }
  }
  function imageFilter(el) {
    const f = el.fx || {}; const parts = [];
    if (f.bri != null && f.bri !== 100) parts.push(`brightness(${f.bri}%)`);
    if (f.con != null && f.con !== 100) parts.push(`contrast(${f.con}%)`);
    if (f.sat != null && f.sat !== 100) parts.push(`saturate(${f.sat}%)`);
    if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`);
    if (f.blur) parts.push(`blur(${f.blur}mm)`);
    if (f.gray) parts.push(`grayscale(${f.gray}%)`);
    if (f.sepia) parts.push(`sepia(${f.sepia}%)`);
    if (f.inv) parts.push('invert(100%)');
    return parts.length ? `filter:${parts.join(' ')};` : '';
  }
  const IMG_PRESETS = [['none', '원본', {}], ['bw', '흑백', { gray: 100, con: 110 }], ['warm', '따뜻하게', { sepia: 30, sat: 120, bri: 105 }], ['cool', '차갑게', { hue: 15, sat: 90, bri: 102 }], ['vivid', '선명하게', { sat: 150, con: 115 }], ['soft', '부드럽게', { con: 90, bri: 108, sat: 90 }], ['retro', '레트로', { sepia: 50, con: 95, sat: 80 }], ['dark', '어둡게', { bri: 75, con: 115 }]];
  return { TEXT_FX_DEF, textStyle, warpSVG, TEXT_PRESETS, SHAPES, shapeSVG, pathSVG, smoothPath, CLIPS, clipPath, imageFilter, IMG_PRESETS, rgba };
})();
