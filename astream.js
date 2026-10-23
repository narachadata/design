// 긴 소리 스트리밍 읽기 — 몇 시간짜리 m4a·mp4·mp3·wav도 필요한 구간만 조금씩 풀어 씀 (전체를 메모리에 풀지 않음)
// m4a·mp4·mov: mp4box.js(github.com/gpac/mp4box.js)로 파일 속 목차(소리 조각의 위치·시각)만 읽고, 필요한 조각의 바이트만 잘라
//              브라우저 내장 디코더(WebCodecs AudioDecoder)로 풂.  wav: 바로 읽음.  mp3: 프레임을 찾아 내장 디코더로.
// 그 밖의 형식이나 디코더가 없는 브라우저는 파일이 작을 때만 한 번에 풂(decodeAudioData).
window.NC = window.NC || {};
NC.astream = (function () {
  const MP4BOX = 'https://cdn.jsdelivr.net/npm/mp4box@0.5.3/dist/mp4box.all.min.js';
  const OUT = 48000; // 섞을 때의 표본률(스테레오)
  function load(url, test) { if (test()) return Promise.resolve(); return new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = () => test() ? res() : rej(new Error('라이브러리를 불러오지 못했습니다')); s.onerror = () => rej(new Error('라이브러리를 불러오지 못했습니다 (인터넷 연결 확인)')); document.head.appendChild(s); }); }
  const infoCache = new WeakMap();

  /* ---------- 형식 알아보기 ---------- */
  async function probe(blob) {
    if (infoCache.has(blob)) return infoCache.get(blob);
    const head = new Uint8Array(await blob.slice(0, 64).arrayBuffer()), str = (a, b) => String.fromCharCode(...head.slice(a, b));
    let info;
    if (str(0, 4) === 'RIFF' && str(8, 12) === 'WAVE') info = await probeWav(blob);
    else if (str(4, 8) === 'ftyp' || str(4, 8) === 'moov' || str(4, 8) === 'mdat' || str(4, 8) === 'wide' || str(4, 8) === 'free') info = await probeMp4(blob);
    else if (str(0, 3) === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) info = await probeMp3(blob);
    else info = { kind: 'other' };
    infoCache.set(blob, info); return info;
  }
  // mp4·m4a: 목차(moov)만 읽음 — 앞에 있든 뒤에 있든 mp4box가 다음에 읽을 위치를 알려 줌
  async function probeMp4(blob) {
    await load(MP4BOX, () => !!window.MP4Box);
    const f = MP4Box.createFile(); let ready = null, err = null;
    f.onReady = i => { ready = i; }; f.onError = e => { err = e; };
    let off = 0; const CH = 1 << 20;
    while (!ready && !err && off < blob.size) { const ab = await blob.slice(off, off + CH).arrayBuffer(); ab.fileStart = off; const next = f.appendBuffer(ab); off = next > off ? next : off + ab.byteLength; }
    if (!ready) throw new Error('파일 목차를 읽지 못했습니다');
    const at = ready.audioTracks && ready.audioTracks[0]; if (!at) return { kind: 'mp4', noAudio: true, dur: ready.duration / ready.timescale };
    const trak = f.getTrackById(at.id), entry = trak.mdia.minf.stbl.stsd.entries[0];
    let desc = null; try { const dsi = entry.esds.esd.descs[0].descs[0]; desc = dsi && dsi.data ? new Uint8Array(dsi.data) : null; } catch (e) {}
    const codec = at.codec && /^mp4a/.test(at.codec) ? at.codec : 'mp4a.40.2';
    const samples = trak.samples.map(s => ({ o: s.offset, z: s.size, t: s.cts / s.timescale, d: s.duration / s.timescale }));
    return { kind: 'mp4', codec, desc, sr: at.audio.sample_rate, ch: at.audio.channel_count, dur: samples.length ? samples[samples.length - 1].t + samples[samples.length - 1].d : at.duration / at.timescale, samples };
  }
  async function probeWav(blob) {
    const b = new DataView(await blob.slice(0, Math.min(blob.size, 1 << 16)).arrayBuffer()); let p = 12, fmt = null, data = null;
    while (p + 8 <= b.byteLength) { const id = String.fromCharCode(b.getUint8(p), b.getUint8(p + 1), b.getUint8(p + 2), b.getUint8(p + 3)), sz = b.getUint32(p + 4, true); if (id === 'fmt ') fmt = { tag: b.getUint16(p + 8, true), ch: b.getUint16(p + 10, true), sr: b.getUint32(p + 12, true), bits: b.getUint16(p + 22, true) }; if (id === 'data') { data = { o: p + 8, z: Math.min(sz, blob.size - p - 8) }; break; } p += 8 + sz + (sz & 1); }
    if (!fmt || !data) return { kind: 'other' };
    const bpf = fmt.ch * fmt.bits / 8; return { kind: 'wav', sr: fmt.sr, ch: fmt.ch, bits: fmt.bits, float: fmt.tag === 3, data, bpf, dur: data.z / bpf / fmt.sr };
  }
  // mp3: 첫 프레임에서 표본률·채널, 비트레이트로 길이 어림 (Xing 정보가 있으면 정확히)
  const MP3_BR = [[0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]];
  const MP3_SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  function mp3Frame(u, i) { if (u[i] !== 0xff || (u[i + 1] & 0xe0) !== 0xe0) return null; const ver = (u[i + 1] >> 3) & 3, layer = (u[i + 1] >> 1) & 3, bri = u[i + 2] >> 4, sri = (u[i + 2] >> 2) & 3, pad = (u[i + 2] >> 1) & 1, ch = (u[i + 3] >> 6) === 3 ? 1 : 2; if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) return null; const br = MP3_BR[ver === 3 ? 0 : 1][bri] * 1000, sr = MP3_SR[ver][sri], spf = ver === 3 ? 1152 : 576, len = Math.floor((ver === 3 ? 144 : 72) * br / sr) + pad; return { br, sr, ch, spf, len }; }
  async function probeMp3(blob) {
    const u = new Uint8Array(await blob.slice(0, Math.min(blob.size, 1 << 18)).arrayBuffer()); let s = 0;
    if (u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33) s = 10 + ((u[6] & 0x7f) << 21 | (u[7] & 0x7f) << 14 | (u[8] & 0x7f) << 7 | (u[9] & 0x7f));
    let fr = null; for (let i = s; i < u.length - 4; i++) { fr = mp3Frame(u, i); if (fr) { s = i; break; } }
    if (!fr) return { kind: 'other' };
    let dur = (blob.size - s) * 8 / fr.br, delay = 0; const xi = String.fromCharCode(...u.slice(s + 4, s + 40)).search(/Xing|Info/);
    if (xi >= 0) { const p = s + 4 + xi; const flags = (u[p + 4] << 24) | (u[p + 5] << 16) | (u[p + 6] << 8) | u[p + 7]; if (flags & 1) { const n = (u[p + 8] << 24) | (u[p + 9] << 16) | (u[p + 10] << 8) | u[p + 11]; dur = n * fr.spf / fr.sr; }
      const lp = p + 8 + (flags & 1 ? 4 : 0) + (flags & 2 ? 4 : 0) + (flags & 4 ? 100 : 0) + (flags & 8 ? 4 : 0);  // LAME 꼬리표: 앞에 덧붙은 무음 길이
      if (/LAME|Lavf|Lavc/.test(String.fromCharCode(...u.slice(lp, lp + 4)))) delay = ((u[lp + 21] << 4) | (u[lp + 22] >> 4)) + 529;
      s += fr.len; }  // 정보 프레임은 소리가 아님
    return { kind: 'mp3', sr: fr.sr, ch: fr.ch, spf: fr.spf, start: s, dur, br: fr.br, delay };
  }

  /* ---------- 읽기: 시작 시각부터 48kHz 스테레오로 차례로 ---------- */
  // reader.read(n) → [L, R] (Float32Array n개). 끝을 넘으면 0. loop이면 끝에서 처음(loopFrom)으로
  async function reader(blob, from, opt) {
    opt = opt || {}; const info = await probe(blob);
    let src;
    if (info.kind === 'mp4' && !info.noAudio && window.AudioDecoder) src = await mp4Source(blob, info, from);
    else if (info.kind === 'wav') src = wavSource(blob, info, from);
    else if (info.kind === 'mp3' && window.AudioDecoder && await AudioDecoder.isConfigSupported({ codec: 'mp3', sampleRate: info.sr, numberOfChannels: info.ch }).then(r => r.supported).catch(() => false)) src = mp3Source(blob, info, from);
    else src = await wholeSource(blob, from, opt.ac);
    return resampler(src, opt.loop ? async t => { if (info.kind === 'mp4' && !info.noAudio && window.AudioDecoder) return mp4Source(blob, info, t); if (info.kind === 'wav') return wavSource(blob, info, t); if (info.kind === 'mp3') return mp3Source(blob, info, t); return wholeSource(blob, t, opt.ac); } : null, opt.loopFrom || 0);
  }
  // 원본 덩어리(표본률 그대로)를 48kHz 스테레오로: 선형 보간. 덩어리 경계는 앞 덩어리 끝을 붙여 이어 줌
  function resampler(src0, reopen, loopFrom) {
    let src = src0, cur = null, pos = 0, done = false;
    const st = c => ({ c: [c.c[0], c.c[1] || c.c[0]], n: c.n, sr: c.sr });
    async function pull() { let c = await src.next(); if (!c && reopen) { try { src.close && src.close(); } catch (e) {} src = await reopen(loopFrom); c = await src.next(); } if (!c) { done = true; return null; } return st(c); }
    return {
      async read(n) {
        const L = new Float32Array(n), R = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          while (!done && (!cur || pos + 1 >= cur.n)) {
            const nx = await pull(); if (!nx) break;
            if (!cur) { cur = nx; pos = 0; continue; }
            const k = Math.min(Math.floor(pos), cur.n), keep = cur.n - k, m = [0, 1].map(ch => { const a = new Float32Array(keep + nx.n); a.set(cur.c[ch].subarray(k), 0); a.set(nx.c[ch], keep); return a; });
            cur = { c: m, n: keep + nx.n, sr: nx.sr }; pos -= k;
          }
          if (!cur || pos >= cur.n) break;
          const k = Math.floor(pos), fr = pos - k, a = cur.c[0], b = cur.c[1], k1 = k + 1 < cur.n ? k + 1 : k;
          L[i] = a[k] + (a[k1] - a[k]) * fr; R[i] = b[k] + (b[k1] - b[k]) * fr; pos += cur.sr / OUT;
        }
        return [L, R];
      },
      close() { try { src.close && src.close(); } catch (e) {} }
    };
  }
  // mp4·m4a: 필요한 조각만 잘라 디코더로 (프라이밍 지연을 고려해 0.3초 앞에서 시작해 버림)
  async function mp4Source(blob, info, from) {
    const S = info.samples; let i = Math.max(0, S.findIndex(s => s.t + s.d > from - 0.3)); if (i < 0) i = S.length;
    const out = []; let err = null, skipUntil = from;
    const dec = new AudioDecoder({ output: ad => { const n = ad.numberOfFrames, ch = ad.numberOfChannels, t0 = ad.timestamp / 1e6, sr = ad.sampleRate; const c = []; for (let k = 0; k < Math.min(2, ch); k++) { const a = new Float32Array(n); ad.copyTo(a, { planeIndex: k, format: 'f32-planar' }); c.push(a); } ad.close(); let st = 0; if (t0 < skipUntil) st = Math.min(n, Math.round((skipUntil - t0) * ad.sampleRate)); if (st >= n) return; out.push({ c: c.map(a => a.subarray(st)), n: n - st, sr }); }, error: e => { err = e; } }); // 표본률은 닫기 전에 읽어 둠
    const cfg = { codec: info.codec, sampleRate: info.sr, numberOfChannels: info.ch }; if (info.desc) cfg.description = info.desc; dec.configure(cfg);
    return {
      async next() {
        while (!out.length) {
          if (err) throw err; if (i >= S.length) { if (dec.state === 'configured') { await dec.flush().catch(() => {}); if (!out.length) { dec.close(); return null; } } else return null; break; }
          // 이어진 조각들을 한 번에 읽음 (최대 1MB)
          let j = i, end = S[i].o + S[i].z; while (j + 1 < S.length && S[j + 1].o === end && end - S[i].o < (1 << 18) && j - i < 400) { j++; end += S[j].z; }
          const ab = new Uint8Array(await blob.slice(S[i].o, end).arrayBuffer());
          for (let k = i; k <= j; k++) dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(S[k].t * 1e6), duration: Math.round(S[k].d * 1e6), data: ab.subarray(S[k].o - S[i].o, S[k].o - S[i].o + S[k].z) }));
          i = j + 1; await dec.flush().catch(() => {});
        }
        return out.shift();
      },
      close() { try { dec.close(); } catch (e) {} }
    };
  }
  function wavSource(blob, info, from) {
    let off = info.data.o + Math.max(0, Math.floor(from * info.sr)) * info.bpf; const end = info.data.o + info.data.z, CH = info.bpf * info.sr; // 1초씩
    return { async next() { if (off >= end) return null; const ab = await blob.slice(off, Math.min(end, off + CH)).arrayBuffer(); off += ab.byteLength; const dv = new DataView(ab), n = Math.floor(ab.byteLength / info.bpf), c = [...Array(Math.min(2, info.ch))].map(() => new Float32Array(n)), by = info.bits / 8;
      for (let i = 0; i < n; i++) for (let k = 0; k < c.length; k++) { const p = i * info.bpf + k * by; c[k][i] = info.float ? (info.bits === 64 ? dv.getFloat64(p, true) : dv.getFloat32(p, true)) : info.bits === 16 ? dv.getInt16(p, true) / 32768 : info.bits === 24 ? ((dv.getUint8(p) | (dv.getUint8(p + 1) << 8) | (dv.getInt8(p + 2) << 16)) / 8388608) : info.bits === 32 ? dv.getInt32(p, true) / 2147483648 : (dv.getUint8(p) - 128) / 128; }
      return { c, n, sr: info.sr }; } };
  }
  // mp3 프레임 위치표: 가변 비트레이트(VBR)는 크기 비율로 위치를 짐작하면 어긋나므로 처음 한 번 프레임 머리만 따라가며 표를 만듦
  const mp3Idx = new WeakMap();
  function mp3Index(blob, info) {
    if (mp3Idx.has(blob)) return mp3Idx.get(blob);
    const p = (async () => {
      let offs = new Float64Array(1 << 16), n = 0, off = info.start, base = -1, u = null;
      while (off < blob.size - 4) {
        if (!u || off + 4 > base + u.length) { base = off; u = new Uint8Array(await blob.slice(off, off + (4 << 20)).arrayBuffer()); if (u.length < 4) break; }
        const fr = mp3Frame(u, off - base);
        if (!fr) { off++; continue; }  // 중간에 끼어든 꼬리표·잡음은 한 바이트씩 넘어감
        if (n === offs.length) { const g = new Float64Array(n * 2); g.set(offs); offs = g; }
        offs[n++] = off; off += fr.len;
      }
      return offs.subarray(0, n);
    })();
    mp3Idx.set(blob, p); return p;
  }
  function mp3Source(blob, info, from) {
    const spf = info.spf, sr = info.sr, delay = info.delay || 0;
    let off = 0, synced = true, t = 0, ready = null; const out = []; let err = null;
    let skip = 0;
    // 0.2초 앞에서부터 풀어 비트 저장소(앞 프레임 자료)를 채운 뒤 버림
    ready = (async () => { const idx = await mp3Index(blob, info); const k = Math.max(0, Math.min(idx.length - 1, Math.floor((Math.max(0, from - 0.2) * sr + delay) / spf))); off = idx.length ? idx[k] : blob.size; t = (k * spf - delay) / sr; skip = Math.max(0, Math.round((from - t) * sr)); })();
    const dec = new AudioDecoder({ output: ad => { const n = ad.numberOfFrames, sr = ad.sampleRate, c = []; for (let k = 0; k < Math.min(2, ad.numberOfChannels); k++) { const a = new Float32Array(n); ad.copyTo(a, { planeIndex: k, format: 'f32-planar' }); c.push(a); } ad.close(); out.push({ c, n, sr }); }, error: e => { err = e; } });
    dec.configure({ codec: 'mp3', sampleRate: info.sr, numberOfChannels: info.ch });
    return { async next() {
      if (ready) { await ready; ready = null; }
      while (!out.length) { if (err) throw err; if (off >= blob.size) { await dec.flush().catch(() => {}); if (!out.length) return null; break; }
        const u = new Uint8Array(await blob.slice(off, off + (1 << 18)).arrayBuffer()); let i = 0;
        if (!synced) { while (i < u.length - 4 && !(mp3Frame(u, i) && mp3Frame(u, i + mp3Frame(u, i).len))) i++; synced = true; }
        while (i < u.length - 4) { const fr = mp3Frame(u, i); if (!fr) { i++; continue; } if (i + fr.len > u.length) break; dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(Math.max(0, t) * 1e6), data: u.subarray(i, i + fr.len) })); t += fr.spf / fr.sr; i += fr.len; }
        off += Math.max(1, i); await dec.flush().catch(() => {}); }
      let c = out.shift(); if (skip > 0) { const s = Math.min(skip, c.n); skip -= s; if (s >= c.n) return this.next(); c = { c: c.c.map(a => a.subarray(s)), n: c.n - s, sr: c.sr }; } return c; },
      close() { try { dec.close(); } catch (e) {} } };
  }
  // 작은 파일·다른 형식: 한 번에 풀기 (긴 파일은 막음)
  async function wholeSource(blob, from, ac) {
    if (blob.size > 150 * 1048576) throw new Error('이 형식의 큰 파일은 바로 읽을 수 없습니다 (m4a·mp3·wav로 바꿔 주세요)');
    const ctx = ac || new OfflineAudioContext(2, 1, 48000), b = await ctx.decodeAudioData(await blob.arrayBuffer()); let p = Math.floor(from * b.sampleRate); const CH = b.sampleRate;
    return { async next() { if (p >= b.length) return null; const n = Math.min(CH, b.length - p), c = [b.getChannelData(0).subarray(p, p + n), (b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0)).subarray(p, p + n)]; p += n; return { c, n, sr: b.sampleRate }; } };
  }
  // AudioBuffer(기본 소리·짧은 효과음)도 같은 방식으로
  function bufferSource(b, from) { let p = Math.floor(Math.max(0, from) * b.sampleRate); const CH = b.sampleRate; return { async next() { if (p >= b.length) return null; const n = Math.min(CH, b.length - p), c = [b.getChannelData(0).subarray(p, p + n), (b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0)).subarray(p, p + n)]; p += n; return { c, n, sr: b.sampleRate }; } }; }
  function bufferReader(b, from, loop, loopFrom) { return resampler(bufferSource(b, from), loop ? async t => bufferSource(b, t) : null, loopFrom || 0); }

  /* ---------- 파형: 전체를 훑어 칸마다 최댓값 (긴 파일은 뒤에서 천천히) ---------- */
  const peakCache = new Map();
  async function peaks(blob, key, n, onProgress) {
    if (peakCache.has(key)) return peakCache.get(key);
    const info = await probe(blob), dur = info.dur || 0; if (!dur) return null;
    const out = new Float32Array(n), r = await reader(blob, 0), STEP = OUT; let done = 0;
    for (let t = 0; t < dur; t += 1) { const [L] = await r.read(STEP); const k0 = Math.floor(t / dur * n), k1 = Math.min(n - 1, Math.floor((t + 1) / dur * n)); let m = 0; for (let i = 0; i < L.length; i += 32) { const v = Math.abs(L[i]); if (v > m) m = v; } for (let k = k0; k <= k1; k++) out[k] = Math.max(out[k], m); done++; if (done % 60 === 0) { if (onProgress) onProgress(t / dur); await new Promise(res => setTimeout(res, 0)); } }
    r.close(); peakCache.set(key, out); return out;
  }
  return { probe, reader, bufferReader, peaks, OUT };
})();
