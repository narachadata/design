// 이미지 편집기: 색 지정 배경 지우기(스포이트·허용 범위·가장자리 부드럽게·연결 영역·색 번짐 제거·조각 제거) + 지우개/복원 브러시 + 자르기
window.NC = window.NC || {};
NC.imgedit = (function () {
  const $ = s => document.querySelector(s);
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지를 읽지 못했습니다')); i.src = src; }); }
  const hex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  const toRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  // 색 거리: 밝기 차이를 덜 보고 색상 차이를 더 보는 가중 RGB (0~~441)
  function dist(r, g, b, c) { const dr = r - c[0], dg = g - c[1], db = b - c[2]; const rm = (r + c[0]) / 2; return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 3; }
  const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

  /* 색 기준 알파 마스크 계산. 반환: Float32Array alpha(0~1) */
  function colorMask(data, W, H, o) {
    const c = toRGB(o.color), tol = o.tol, soft = Math.max(0.5, o.soft);
    const a = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { const d = dist(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], c); a[i] = smooth((d - (tol - soft)) / (2 * soft)); } // 0 = 지움, 1 = 유지
    if (o.connected) {
      // 가장자리에서 이어진 '지울 영역'만 지움 (안쪽 같은 색은 보존)
      const reach = new Uint8Array(W * H); const stack = [];
      const push = i => { if (!reach[i] && a[i] < 0.5) { reach[i] = 1; stack.push(i); } };
      for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); } for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
      while (stack.length) { const i = stack.pop(); const x = i % W, y = (i / W) | 0; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W); }
      // 닿은 영역 주변 2px 까지는 부드러운 값 유지, 나머지는 1
      for (let i = 0; i < W * H; i++) if (!reach[i]) { const x = i % W, y = (i / W) | 0; let near = false; for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < W && ny >= 0 && ny < H && reach[ny * W + nx]) { near = true; break; } } if (!near) a[i] = 1; }
    }
    return a;
  }
  // 작은 조각(섬) 제거: 남은 영역 중 minPx 보다 작은 덩어리를 지움, 구멍도 메움
  function removeIslands(alpha, W, H, minPx, fillHoles) {
    const lab = new Int32Array(W * H).fill(-1); const sizes = []; const stack = [];
    const pass = (target) => { lab.fill(-1); sizes.length = 0; for (let s = 0; s < W * H; s++) { if (lab[s] !== -1 || ((alpha[s] >= 0.5) !== target)) continue; const id = sizes.length; sizes.push(0); lab[s] = id; stack.push(s); while (stack.length) { const i = stack.pop(); sizes[id]++; const x = i % W, y = (i / W) | 0; const nb = [i - 1, i + 1, i - W, i + W]; const ok = [x > 0, x < W - 1, y > 0, y < H - 1]; for (let k = 0; k < 4; k++) if (ok[k] && lab[nb[k]] === -1 && ((alpha[nb[k]] >= 0.5) === target)) { lab[nb[k]] = id; stack.push(nb[k]); } } } };
    pass(true); for (let i = 0; i < W * H; i++) if (lab[i] >= 0 && sizes[lab[i]] < minPx) alpha[i] = 0;
    if (fillHoles) { pass(false); const touches = new Uint8Array(sizes.length); for (let x = 0; x < W; x++) { if (lab[x] >= 0) touches[lab[x]] = 1; if (lab[(H - 1) * W + x] >= 0) touches[lab[(H - 1) * W + x]] = 1; } for (let y = 0; y < H; y++) { if (lab[y * W] >= 0) touches[lab[y * W]] = 1; if (lab[y * W + W - 1] >= 0) touches[lab[y * W + W - 1]] = 1; } for (let i = 0; i < W * H; i++) if (lab[i] >= 0 && !touches[lab[i]] && sizes[lab[i]] < minPx * 4) alpha[i] = 1; }
  }
  // 알파 가장자리 매끈하게 (작은 박스 블러)
  function blurAlpha(alpha, W, H, r) {
    if (!r) return alpha; const tmp = new Float32Array(W * H); const out = new Float32Array(W * H); const n = 2 * r + 1;
    for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += alpha[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s / n; s += alpha[y * W + Math.min(W - 1, x + r + 1)] - alpha[y * W + Math.max(0, x - r)]; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { out[y * W + x] = s / n; s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
    return out;
  }
  // 마스크 적용 + 색 번짐 제거(반투명 가장자리 픽셀에서 배경색 성분을 빼서 테두리 번짐 방지)
  function applyMask(src, out, W, H, alpha, bg, despill) {
    const c = bg ? toRGB(bg) : null;
    for (let i = 0; i < W * H; i++) {
      const a0 = src[i * 4 + 3] / 255; const a = Math.min(a0, alpha[i]);
      let r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
      if (despill && c && a > 0.02 && a < 0.98) { r = Math.min(255, Math.max(0, (r - (1 - a) * c[0]) / a)); g = Math.min(255, Math.max(0, (g - (1 - a) * c[1]) / a)); b = Math.min(255, Math.max(0, (b - (1 - a) * c[2]) / a)); }
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = Math.round(a * 255);
    }
  }
  // 간단 API (AI 이미지 흰 배경 자동 제거용)
  async function removeColorFromSrc(srcUrl, color, opts) {
    const img = await loadImg(srcUrl); const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, W, H); const o = Object.assign({ color: color || '#ffffff', tol: 22, soft: 8, connected: true, despill: true, feather: 1, minPx: Math.round(W * H / 4000) }, opts);
    let a = colorMask(id.data, W, H, o); removeIslands(a, W, H, o.minPx, true); a = blurAlpha(a, W, H, o.feather);
    const out = ctx.createImageData(W, H); applyMask(id.data, out.data, W, H, a, o.color, o.despill); ctx.putImageData(out, 0, 0);
    return c.toDataURL('image/png');
  }

  /* ---------- 편집기 UI ---------- */
  let st = null;
  function open(srcUrl, onApply) {
    let d = $('#dlgImg');
    if (!d) { d = document.createElement('dialog'); d.id = 'dlgImg'; d.className = 'wide'; d.innerHTML = `<div class="dhead"><h2>이미지 편집기 <small>배경 지우기 · 지우개/복원 브러시 · 자르기</small></h2><button class="btn sm" id="imgCancel">닫기</button></div><div class="dbody ie" id="ieBody"></div>`; document.body.appendChild(d); $('#imgCancel').onclick = () => d.close(); }
    loadImg(srcUrl).then(img => {
      const W = img.naturalWidth, H = img.naturalHeight;
      const orig = document.createElement('canvas'); orig.width = W; orig.height = H; orig.getContext('2d').drawImage(img, 0, 0);
      const work = document.createElement('canvas'); work.width = W; work.height = H; work.getContext('2d').drawImage(img, 0, 0);
      st = { W, H, orig, work, hist: [], tool: 'bg', color: '#ffffff', tol: 22, soft: 8, connected: true, despill: true, feather: 1, minPx: Math.round(W * H / 4000), brush: 30, hard: 70, zoom: 1, crop: null, onApply };
      render(); fit();
      d.showModal();
    }).catch(e => alert(e.message));
  }
  function pushHist() { const c = document.createElement('canvas'); c.width = st.W; c.height = st.H; c.getContext('2d').drawImage(st.work, 0, 0); st.hist.push(c); if (st.hist.length > 12) st.hist.shift(); }
  function undo() { const c = st.hist.pop(); if (!c) return; st.work.getContext('2d').clearRect(0, 0, st.W, st.H); st.work.getContext('2d').drawImage(c, 0, 0); draw(); }
  function render() {
    const body = $('#ieBody');
    body.innerHTML = `<div class="ie-side">
      <div class="seg"><button data-tool="bg" aria-pressed="${st.tool === 'bg'}">배경 지우기</button><button data-tool="erase" aria-pressed="${st.tool === 'erase'}">지우개</button><button data-tool="restore" aria-pressed="${st.tool === 'restore'}">복원</button><button data-tool="crop" aria-pressed="${st.tool === 'crop'}">자르기</button></div>
      <div id="ieTool"></div>
      <h3>다듬기</h3>
      <label class="f"><span>가장자리 매끈하게 <small>${st.feather}px</small></span><input type="range" id="ieFeather" min="0" max="4" step="1" value="${st.feather}"></label>
      <label class="f"><span>작은 조각 제거 <small>${st.minPx}px 미만</small></span><input type="range" id="ieMin" min="0" max="${Math.max(50, Math.round(st.W * st.H / 500))}" step="10" value="${st.minPx}"></label>
      <div class="row"><button class="btn sm" id="ieTidy">지금 다듬기</button><button class="btn sm" id="ieUndo">되돌리기</button><button class="btn sm" id="ieReset">원본으로</button></div>
      <h3>보기</h3><label class="f"><span>확대 <small id="ieZoomV">${Math.round(st.zoom * 100)}%</small></span><input type="range" id="ieZoom" min="0.1" max="4" step="0.05" value="${st.zoom}"></label>
      <label class="chk"><input type="checkbox" id="ieChecker" checked> 투명 바둑판 배경 보기</label>
      <div class="row" style="margin-top:12px"><button class="btn primary full" id="ieApply">적용</button></div>
      <p class="hint">적용하면 편집본이 문서에 들어가고 원본은 "원본으로" 메뉴로 되돌릴 수 있습니다.</p>
    </div>
    <div class="ie-main"><div class="ie-wrap" id="ieWrap"><canvas id="ieCanvas"></canvas><canvas id="ieOverlay"></canvas></div><p class="hint" id="ieMsg"></p></div>`;
    renderTool();
    body.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { st.tool = b.dataset.tool; render(); draw(); });
    $('#ieFeather').oninput = e => { st.feather = Number(e.target.value); e.target.previousElementSibling.querySelector('small').textContent = st.feather + 'px'; };
    $('#ieMin').oninput = e => { st.minPx = Number(e.target.value); e.target.previousElementSibling.querySelector('small').textContent = st.minPx + 'px 미만'; };
    $('#ieTidy').onclick = () => { pushHist(); tidy(); draw(); msg('가장자리를 다듬고 작은 조각을 지웠습니다'); };
    $('#ieUndo').onclick = undo;
    $('#ieReset').onclick = () => { pushHist(); const c = st.work.getContext('2d'); c.clearRect(0, 0, st.W, st.H); c.drawImage(st.orig, 0, 0); draw(); };
    $('#ieZoom').oninput = e => { st.zoom = Number(e.target.value); $('#ieZoomV').textContent = Math.round(st.zoom * 100) + '%'; layout(); };
    $('#ieChecker').onchange = e => { $('#ieWrap').classList.toggle('plain', !e.target.checked); };
    $('#ieApply').onclick = () => { const url = st.work.toDataURL('image/png'); $('#dlgImg').close(); st.onApply(url); };
    bindCanvas();
    draw();
  }
  function renderTool() {
    const t = $('#ieTool');
    if (st.tool === 'bg') t.innerHTML = `<h3>배경 지우기</h3>
      <div class="row"><label class="f" style="flex:1;margin:0"><span>지울 색</span><input type="color" id="ieColor" value="${st.color}"></label><button class="btn sm ${st.pick ? 'on' : ''}" id="iePick" style="margin-top:16px">스포이트</button></div>
      <p class="hint">스포이트를 누른 뒤 그림에서 지울 색을 클릭하세요. 흰 배경은 기본값 그대로 쓰면 됩니다.</p>
      <label class="f"><span>허용 범위 <small>${st.tol}</small></span><input type="range" id="ieTol" min="2" max="120" step="1" value="${st.tol}"></label>
      <label class="f"><span>가장자리 부드러움 <small>${st.soft}</small></span><input type="range" id="ieSoft" min="1" max="40" step="1" value="${st.soft}"></label>
      <label class="chk"><input type="checkbox" id="ieConn" ${st.connected ? 'checked' : ''}> 바깥에서 이어진 영역만 지우기 (안쪽 같은 색 보존)</label>
      <label class="chk"><input type="checkbox" id="ieDespill" ${st.despill ? 'checked' : ''}> 가장자리 색 번짐 제거</label>
      <div class="row"><button class="btn primary sm" id="ieRun">이 색 지우기</button><span class="hint" style="margin:0">여러 색은 차례로 반복</span></div>`;
    else if (st.tool === 'erase' || st.tool === 'restore') t.innerHTML = `<h3>${st.tool === 'erase' ? '지우개' : '복원'} 브러시</h3>
      <label class="f"><span>크기 <small>${st.brush}px</small></span><input type="range" id="ieBrush" min="2" max="300" step="1" value="${st.brush}"></label>
      <label class="f"><span>경도 <small>${st.hard}%</small></span><input type="range" id="ieHard" min="0" max="100" step="5" value="${st.hard}"></label>
      <p class="hint">그림 위에서 끌어서 ${st.tool === 'erase' ? '지웁니다' : '원본을 되살립니다'}. 확대해서 세밀하게 작업할 수 있습니다. 키보드 [ ] 로 크기 조절.</p>`;
    else t.innerHTML = `<h3>자르기</h3><p class="hint">그림 위에서 끌어 남길 영역을 지정한 뒤 "자르기 적용"을 누릅니다.</p><div class="row"><button class="btn primary sm" id="ieCropGo" ${st.crop ? '' : 'disabled'}>자르기 적용</button><button class="btn sm" id="ieCropClear">영역 지우기</button></div>`;
    const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el[ev] = fn; };
    on('ieColor', 'oninput', e => { st.color = e.target.value; });
    on('iePick', 'onclick', () => { st.pick = !st.pick; renderTool(); $('#ieWrap').classList.toggle('picking', st.pick); });
    on('ieTol', 'oninput', e => { st.tol = Number(e.target.value); e.target.previousElementSibling.querySelector('small').textContent = st.tol; });
    on('ieSoft', 'oninput', e => { st.soft = Number(e.target.value); e.target.previousElementSibling.querySelector('small').textContent = st.soft; });
    on('ieConn', 'onchange', e => { st.connected = e.target.checked; });
    on('ieDespill', 'onchange', e => { st.despill = e.target.checked; });
    on('ieRun', 'onclick', () => { pushHist(); runRemove(); draw(); });
    on('ieBrush', 'oninput', e => { st.brush = Number(e.target.value); e.target.previousElementSibling.querySelector('small').textContent = st.brush + 'px'; });
    on('ieHard', 'oninput', e => { st.hard = Number(e.target.value); e.target.previousElementSibling.querySelector('small').textContent = st.hard + '%'; });
    on('ieCropGo', 'onclick', () => { if (!st.crop) return; pushHist(); const { x, y, w, h } = st.crop; const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(st.work, x, y, w, h, 0, 0, w, h); st.W = w; st.H = h; st.work.width = w; st.work.height = h; st.work.getContext('2d').drawImage(c, 0, 0); const o2 = document.createElement('canvas'); o2.width = w; o2.height = h; o2.getContext('2d').drawImage(st.orig, x, y, w, h, 0, 0, w, h); st.orig = o2; st.crop = null; st.hist = []; render(); fit(); });
    on('ieCropClear', 'onclick', () => { st.crop = null; drawOverlay(); renderTool(); });
  }
  function msg(t) { const m = $('#ieMsg'); if (m) m.textContent = t; }
  function runRemove() {
    const ctx = st.work.getContext('2d'); const id = ctx.getImageData(0, 0, st.W, st.H);
    let a = colorMask(id.data, st.W, st.H, { color: st.color, tol: st.tol, soft: st.soft, connected: st.connected });
    a = blurAlpha(a, st.W, st.H, st.feather);
    const out = ctx.createImageData(st.W, st.H); applyMask(id.data, out.data, st.W, st.H, a, st.color, st.despill); ctx.putImageData(out, 0, 0);
    msg(`${st.color} 색을 지웠습니다. 남은 부분은 지우개로, 지나치게 지워진 곳은 복원 브러시로 다듬으세요.`);
  }
  function tidy() {
    const ctx = st.work.getContext('2d'); const id = ctx.getImageData(0, 0, st.W, st.H); const a = new Float32Array(st.W * st.H);
    for (let i = 0; i < st.W * st.H; i++) a[i] = id.data[i * 4 + 3] / 255;
    removeIslands(a, st.W, st.H, st.minPx, true); const b = blurAlpha(a, st.W, st.H, st.feather);
    for (let i = 0; i < st.W * st.H; i++) id.data[i * 4 + 3] = Math.round(Math.min(a[i] > 0.5 ? 1 : b[i] * 1.0, b[i] > a[i] ? b[i] : a[i] < 0.5 ? b[i] : 1) * 255);
    ctx.putImageData(id, 0, 0);
  }
  function fit() { const wrap = $('#ieWrap'); const k = Math.min((wrap.clientWidth - 20) / st.W, (wrap.clientHeight - 20) / st.H, 1); st.zoom = Math.max(0.1, k); $('#ieZoom').value = st.zoom; $('#ieZoomV').textContent = Math.round(st.zoom * 100) + '%'; layout(); }
  function layout() { const c = $('#ieCanvas'), o = $('#ieOverlay'); [c, o].forEach(x => { x.width = st.W; x.height = st.H; x.style.width = (st.W * st.zoom) + 'px'; x.style.height = (st.H * st.zoom) + 'px'; }); draw(); }
  function draw() { const c = $('#ieCanvas'); if (!c) return; const ctx = c.getContext('2d'); ctx.clearRect(0, 0, st.W, st.H); ctx.drawImage(st.work, 0, 0); drawOverlay(); }
  function drawOverlay() { const o = $('#ieOverlay'); if (!o) return; const ctx = o.getContext('2d'); ctx.clearRect(0, 0, st.W, st.H); if (st.crop) { const { x, y, w, h } = st.crop; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, st.W, st.H); ctx.clearRect(x, y, w, h); ctx.strokeStyle = '#2f5bea'; ctx.lineWidth = 2 / st.zoom; ctx.strokeRect(x, y, w, h); } }
  function bindCanvas() {
    const o = $('#ieOverlay'); let drawing = false, last = null, start = null;
    const pos = e => { const r = o.getBoundingClientRect(); return { x: (e.clientX - r.left) / st.zoom, y: (e.clientY - r.top) / st.zoom }; };
    o.onpointerdown = e => {
      const p = pos(e); o.setPointerCapture(e.pointerId);
      if (st.pick) { const d = st.work.getContext('2d').getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data; st.color = hex(d[0], d[1], d[2]); st.pick = false; $('#ieWrap').classList.remove('picking'); renderTool(); msg(`지울 색을 ${st.color} 로 정했습니다. "이 색 지우기"를 누르세요.`); return; }
      if (st.tool === 'crop') { start = p; st.crop = { x: p.x, y: p.y, w: 0, h: 0 }; return; }
      if (st.tool === 'erase' || st.tool === 'restore') { pushHist(); drawing = true; last = p; dab(p); }
    };
    o.onpointermove = e => {
      const p = pos(e);
      if (st.tool === 'crop' && start) { st.crop = { x: Math.round(Math.min(start.x, p.x)), y: Math.round(Math.min(start.y, p.y)), w: Math.round(Math.abs(p.x - start.x)), h: Math.round(Math.abs(p.y - start.y)) }; drawOverlay(); return; }
      if (!drawing) { cursorRing(p); return; }
      const dx = p.x - last.x, dy = p.y - last.y, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (st.brush / 6)));
      for (let i = 1; i <= n; i++) dab({ x: last.x + dx * i / n, y: last.y + dy * i / n });
      last = p; draw();
    };
    o.onpointerup = () => { drawing = false; if (st.tool === 'crop' && start) { start = null; if (st.crop && (st.crop.w < 2 || st.crop.h < 2)) st.crop = null; renderTool(); drawOverlay(); } };
    document.onkeydown = e => { if (!$('#dlgImg') || !$('#dlgImg').open) return; if (e.key === '[') { st.brush = Math.max(2, st.brush - 4); renderTool(); } if (e.key === ']') { st.brush = Math.min(300, st.brush + 4); renderTool(); } if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); } };
    function cursorRing(p) { if (st.tool !== 'erase' && st.tool !== 'restore') return; const ctx = o.getContext('2d'); ctx.clearRect(0, 0, st.W, st.H); ctx.beginPath(); ctx.arc(p.x, p.y, st.brush / 2, 0, Math.PI * 2); ctx.strokeStyle = st.tool === 'erase' ? '#e0564b' : '#2f8d46'; ctx.lineWidth = 1.5 / st.zoom; ctx.stroke(); }
    function dab(p) {
      const ctx = st.work.getContext('2d'); const r = st.brush / 2; const h = st.hard / 100;
      const g = ctx.createRadialGradient(p.x, p.y, r * h, p.x, p.y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      if (st.tool === 'erase') { ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      else { // 복원: 원본에서 브러시 모양으로 가져오기
        const tmp = document.createElement('canvas'); tmp.width = st.W; tmp.height = st.H; const tc = tmp.getContext('2d'); tc.fillStyle = g; tc.beginPath(); tc.arc(p.x, p.y, r, 0, Math.PI * 2); tc.fill(); tc.globalCompositeOperation = 'source-in'; tc.drawImage(st.orig, 0, 0); ctx.drawImage(tmp, 0, 0);
      }
    }
  }
  return { open, removeColorFromSrc };
})();
