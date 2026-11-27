/* 편집 화면 그림 선명하게(11/27 팀장님 「송년회 포스터의 시범단 육각 패치가 흐릿」): 브라우저가 큰 그림을 작게 보일 때 쓰는 줄이기(밉맵)는 가는 글자·선을 뭉갬
   → 화면에 보이는 크기에 맞춰 란초시3으로 미리 줄인 그림을 만들어 씀. 무거운 계산이라 일꾼(Worker)에서 — 편집이 멈추지 않게.
   받는 것: { id, buf(RGBA ArrayBuffer), sw, sh, dw, dh } → 보내는 것: { id, buf, dw, dh } */
function lzResize(src, sw, sh, dw, dh) {
  const a = 3, sinc = x => { if (x === 0) return 1; x *= Math.PI; return Math.sin(x) / x; }, L = x => (x <= -a || x >= a) ? 0 : sinc(x) * sinc(x / a);
  const P = new Float32Array(sw * sh * 4);  /* 알파 미리곱 — 투명 가장자리에 검은 테가 안 생기게 */
  for (let i = 0, n = sw * sh; i < n; i++) { const al = src[i * 4 + 3] / 255; P[i * 4] = src[i * 4] * al; P[i * 4 + 1] = src[i * 4 + 1] * al; P[i * 4 + 2] = src[i * 4 + 2] * al; P[i * 4 + 3] = src[i * 4 + 3]; }
  const wts = (sN, dN) => { const sc = sN / dN, f = Math.max(1, sc), sup = a * f, out = []; for (let d = 0; d < dN; d++) { const c = (d + 0.5) * sc - 0.5, s0 = Math.max(0, Math.floor(c - sup) + 1), s1 = Math.min(sN - 1, Math.floor(c + sup)); const w = []; let t = 0; for (let s = s0; s <= s1; s++) { const v = L((s - c) / f); w.push(v); t += v; } out.push([s0, Float32Array.from(w, v => v / (t || 1))]); } return out; };
  const WX = wts(sw, dw), WY = wts(sh, dh), T = new Float32Array(dw * sh * 4);
  for (let y = 0; y < sh; y++) for (let x = 0; x < dw; x++) { const [s0, w] = WX[x]; let r = 0, g = 0, b = 0, al = 0, o = (y * sw + s0) * 4; for (let k = 0; k < w.length; k++, o += 4) { const v = w[k]; r += P[o] * v; g += P[o + 1] * v; b += P[o + 2] * v; al += P[o + 3] * v; } const q = (y * dw + x) * 4; T[q] = r; T[q + 1] = g; T[q + 2] = b; T[q + 3] = al; }
  const D = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y++) { const [s0, w] = WY[y]; for (let x = 0; x < dw; x++) { let r = 0, g = 0, b = 0, al = 0; for (let k = 0; k < w.length; k++) { const o = ((s0 + k) * dw + x) * 4, v = w[k]; r += T[o] * v; g += T[o + 1] * v; b += T[o + 2] * v; al += T[o + 3] * v; } const q = (y * dw + x) * 4; al = Math.max(0, Math.min(255, al)); const m = al > 0.5 ? 255 / al : 0; D[q] = r * m; D[q + 1] = g * m; D[q + 2] = b * m; D[q + 3] = al; } }
  return D;
}
self.onmessage = e => { const { id, buf, sw, sh, dw, dh } = e.data; try { const D = lzResize(new Uint8ClampedArray(buf), sw, sh, dw, dh); self.postMessage({ id, buf: D.buffer, dw, dh }, [D.buffer]); } catch (er) { self.postMessage({ id, err: String(er && er.message || er) }); } };
