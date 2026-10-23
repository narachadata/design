// 영상 편집용 자료 (영상 메뉴에서만 씀)
// ① 내 PC 원본(local): 동영상·녹음·음악 원본은 이 PC에만 둠. 파일 위치(손잡이)를 이 브라우저에 기억하고 문서에는 이름·크기만 저장
//    → 구글 드라이브에는 편집 내용만 올라가고 원본은 올라가지 않음. 다른 PC에서는 '원본 다시 연결'
// ② 기본 소리(built-in): 효과음·배경음악을 브라우저에서 직접 합성 — 저작권 걱정 없음, 파일 없음
// ③ 공유 자료(shared): 동기화 폴더 '디자인자료/영상자료/(음악·효과음·영상)' — 템플릿 영상·음악처럼 여러 PC에서 같이 쓸 것
window.NC = window.NC || {};
NC.media = (function () {
  /* ---------- ① 내 PC 원본 ---------- */
  // 저장소 이름은 공방 전용. 'naracha-media'는 같은 주소(narachadata.github.io)의 나라차 본 앱이 학생 사진('kv' 칸)에 쓰는 이름이라 절대 열어 바꾸지 않음
  const DB = 'naracha-design-media', OLD = 'naracha-media', ST = 'files';
  let dbp = null;
  const openDB = v => new Promise((res, rej) => { const r = v ? indexedDB.open(DB, v) : indexedDB.open(DB); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST, { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('다른 창에서 공방이 열려 있어 저장소를 준비하지 못했습니다. 다른 공방 창을 닫고 다시 해 주세요.')); });
  // 예전 판 공방이 'naracha-media'에 'files' 칸을 만들어 둔 PC라면 그 기록만 한 번 복사해 옴 (읽기만, 판 올리기·지우기 없음, 없으면 열지도 않음 — 열면 빈 저장소가 생겨 본 앱을 방해)
  async function migrateOld(d) {
    try {
      if (localStorage.getItem('naracal-media-moved') || !indexedDB.databases) return;
      if (!(await indexedDB.databases()).some(x => x.name === OLD)) { localStorage.setItem('naracal-media-moved', '1'); return; }
      const od = await new Promise((res, rej) => { const r = indexedDB.open(OLD); r.onupgradeneeded = () => { r.transaction.abort(); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      try { if (od.objectStoreNames.contains(ST)) { const all = await new Promise((res, rej) => { const q = od.transaction(ST).objectStore(ST).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }); if (all.length) await new Promise((res, rej) => { const t = d.transaction(ST, 'readwrite'), st = t.objectStore(ST); all.forEach(rec => st.put(rec)); t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error); }); } } finally { od.close(); }
      localStorage.setItem('naracal-media-moved', '1');
    } catch (e) { console.warn('예전 원본 목록 옮기기 실패', e); }
  }
  const db = () => dbp || (dbp = (async () => { let d = await openDB(); if (!d.objectStoreNames.contains(ST)) { const v = d.version + 1; d.close(); d = await openDB(v); } d.onversionchange = () => { d.close(); dbp = null; }; await migrateOld(d); return d; })().catch(e => { dbp = null; throw e; }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(ST, mode), s = t.objectStore(ST), r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = t.onabort = () => rej(t.error || new Error('저장소 기록 실패')); }); };
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const urls = new Map(); // id → blob 주소 (이번 창에서)
  // 파일 고르기: 손잡이를 얻을 수 있으면 손잡이만 기억(복사하지 않음), 아니면 이 브라우저 안에 사본
  async function pick(accept) {
    if (window.showOpenFilePicker) {
      const hs = await window.showOpenFilePicker({ multiple: true, types: [{ description: accept === 'video' ? '동영상' : accept === 'audio' ? '소리' : '동영상·소리', accept: accept === 'video' ? { 'video/*': ['.mp4', '.mov', '.webm', '.m4v'] } : accept === 'audio' ? { 'audio/*': ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac', '.opus'] } : { 'video/*': ['.mp4', '.mov', '.webm', '.m4v'], 'audio/*': ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac', '.opus'] } }] });
      const out = []; for (const h of hs) out.push(await addHandle(h)); return out;
    }
    return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = accept === 'video' ? 'video/*' : accept === 'audio' ? 'audio/*,.m4a,.mp3,.wav,.aac' : 'video/*,audio/*,.m4a'; i.onchange = async () => { const out = []; for (const f of i.files) out.push(await addFile(f)); res(out); }; i.click(); });
  }
  async function addHandle(h, id) { if (id) fileC.delete('m:' + id); const f = await h.getFile(); const rec = { id: id || rid(), name: f.name, size: f.size, type: f.type, lastModified: f.lastModified, added: Date.now(), handle: h }; await tx('readwrite', s => s.put(rec)); urls.set(rec.id, URL.createObjectURL(f)); return meta(rec); }
  async function addFile(f, id) { if (id) fileC.delete('m:' + id); const rec = { id: id || rid(), name: f.name, size: f.size, type: f.type, lastModified: f.lastModified, added: Date.now(), blob: f }; await tx('readwrite', s => s.put(rec)); urls.set(rec.id, URL.createObjectURL(f)); return meta(rec); }
  const meta = r => ({ id: r.id, name: r.name, size: r.size, type: r.type || '', lastModified: r.lastModified });
  // 보관함: 이 PC에서 고른 원본 전부 (최근 것부터). kind = 'video' | 'audio'
  const kindOf = r => /^video\//.test(r.type || '') || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(r.name || '') ? 'video' : 'audio';
  async function list() { const all = await tx('readonly', s => s.getAll()); return (all || []).map(r => Object.assign(meta(r), { kind: kindOf(r), added: r.added || r.lastModified || 0, copy: !!r.blob })).sort((a, b) => b.added - a.added); }
  async function remove(id) { await tx('readwrite', s => s.delete(id)); const u = urls.get(id); if (u) { try { URL.revokeObjectURL(u); } catch (e) {} urls.delete(id); } fileC.delete('m:' + id); }
  // 원본 열기: 이번 창에서 처음이면 읽기 허락을 받아야 함(버튼을 누른 흐름 안에서 부를 것)
  async function file(id, ask) {
    if (urls.has(id)) return { url: urls.get(id) };
    const rec = await tx('readonly', s => s.get(id)); if (!rec) return { missing: true };
    if (rec.blob) { urls.set(id, URL.createObjectURL(rec.blob)); return { url: urls.get(id) }; }
    try {
      let p = await rec.handle.queryPermission({ mode: 'read' });
      if (p !== 'granted' && ask) p = await rec.handle.requestPermission({ mode: 'read' });
      if (p !== 'granted') return { needPerm: true, name: rec.name };
      const f = await rec.handle.getFile(); urls.set(id, URL.createObjectURL(f)); return { url: urls.get(id) };
    } catch (e) { return { missing: true, err: e.message }; }
  }
  async function has(id) { return !!(await tx('readonly', s => s.get(id))); }
  // 다른 PC에서: 같은 id로 이 PC의 파일을 다시 연결
  async function relink(id, accept) {
    if (window.showOpenFilePicker) { const [h] = await window.showOpenFilePicker({ multiple: false }); return addHandle(h, id); }
    return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept || ''; i.onchange = async () => res(await addFile(i.files[0], id)); i.click(); });
  }

  /* ---------- ② 기본 소리 (합성) ---------- */
  const SR = 44100;
  const SOUNDS = [
    ['whoosh', '휙', 'sfx', 0.7], ['swoosh', '휘익 (올라감)', 'sfx', 1.2], ['pop', '뽁', 'sfx', 0.3], ['ding', '딩동', 'sfx', 1.4], ['bell', '종소리', 'sfx', 2.2], ['click', '딸깍', 'sfx', 0.1],
    ['hit', '퍽 (발차기)', 'sfx', 0.45], ['boom', '쿵', 'sfx', 1.2], ['clap', '박수', 'sfx', 2.4], ['tada', '짜잔', 'sfx', 1.6], ['coin', '띠링', 'sfx', 0.6], ['whistle', '호루라기', 'sfx', 1.0],
    ['drumroll', '두구두구', 'sfx', 2.2], ['shutter', '찰칵', 'sfx', 0.35], ['success', '성공', 'sfx', 1.2], ['buzz', '삐빅', 'sfx', 0.6], ['riser', '긴장감 상승', 'sfx', 3], ['heart', '두근', 'sfx', 1.0],
    ['m-bright', '밝은 아침 (경쾌)', 'music', 32], ['m-energy', '태권 에너지 (힘참)', 'music', 28], ['m-calm', '잔잔한 오후 (차분)', 'music', 32], ['m-lofi', '로파이 공부 (편안)', 'music', 32], ['m-drum', '태고 북소리 (웅장)', 'music', 24], ['m-kids', '꼬마 행진 (귀여움)', 'music', 24],
  ].map(([id, name, cat, dur]) => ({ id, name, cat, dur }));
  const cache = new Map();
  function render(id) {
    if (cache.has(id)) return cache.get(id);
    const s = SOUNDS.find(x => x.id === id); if (!s) return Promise.reject(new Error('없는 소리'));
    const p = (async () => { const c = new OfflineAudioContext(2, Math.ceil(s.dur * SR), SR); (SYN[id] || SYN.pop)(c, s.dur); return c.startRendering(); })();
    cache.set(id, p); return p;
  }
  // 합성 부품
  const noiseBuf = (c, len) => { const b = c.createBuffer(1, Math.ceil(len * SR), SR), d = b.getChannelData(0); let seed = 7; for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; } return b; };
  function env(c, g, t, a, d, peak, end) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end || 0.0001, t + a + d); }
  function tone(c, out, f, t, a, d, peak, type, f2) { const o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d); env(c, g, t, a, d, peak); o.connect(g).connect(out); o.start(t); o.stop(t + a + d + 0.05); }
  function noise(c, out, t, len, peak, ftype, f1, f2, q) { const n = c.createBufferSource(); n.buffer = noiseBuf(c, len); const f = c.createBiquadFilter(); f.type = ftype || 'bandpass'; f.frequency.setValueAtTime(f1, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + len); f.Q.value = q || 1; const g = c.createGain(); env(c, g, t, Math.min(0.02, len * 0.2), len * 0.8, peak); n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + len); }
  const master = (c, v) => { const g = c.createGain(); g.gain.value = v || 0.8; const comp = c.createDynamicsCompressor(); g.connect(comp).connect(c.destination); return g; };
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const SYN = {
    whoosh: (c, d) => noise(c, master(c), 0, d, 0.9, 'bandpass', 400, 3200, 0.8),
    swoosh: (c, d) => { const m = master(c); noise(c, m, 0, d, 0.6, 'bandpass', 300, 6000, 1.5); tone(c, m, 200, 0, d * 0.9, 0.1, 0.08, 'sawtooth', 1200); },
    pop: (c) => tone(c, master(c), 900, 0, 0.005, 0.12, 0.9, 'sine', 180),
    ding: (c) => { const m = master(c); tone(c, m, NOTE(88), 0, 0.005, 0.6, 0.5); tone(c, m, NOTE(84), 0.35, 0.005, 1.0, 0.5); },
    bell: (c) => { const m = master(c);[1, 2.76, 5.4, 8.9].forEach((k, i) => tone(c, m, 523 * k, 0, 0.003, 2 / (i + 1), 0.4 / (i + 1))); },
    click: (c) => { const m = master(c); noise(c, m, 0, 0.03, 0.8, 'highpass', 3000, 0, 0.7); tone(c, m, 2000, 0, 0.001, 0.03, 0.3); },
    hit: (c) => { const m = master(c, 1); tone(c, m, 160, 0, 0.002, 0.25, 1, 'sine', 50); noise(c, m, 0, 0.18, 0.9, 'lowpass', 2500, 400, 0.7); noise(c, m, 0, 0.06, 0.6, 'highpass', 4000, 0, 0.7); },
    boom: (c) => { const m = master(c, 1); tone(c, m, 90, 0, 0.005, 1.1, 1, 'sine', 30); noise(c, m, 0, 0.6, 0.5, 'lowpass', 600, 80, 0.5); },
    clap: (c, d) => { const m = master(c); for (let i = 0; i < 26; i++) { const t = i * 0.08 + Math.random() * 0.05; noise(c, m, t, 0.07, 0.35 + Math.random() * 0.3, 'bandpass', 1200 + Math.random() * 600, 0, 1.2); } void d; },
    tada: (c) => { const m = master(c);[60, 64, 67, 72].forEach((n, i) => { tone(c, m, NOTE(n + 12), i * 0.09, 0.01, 1.4 - i * 0.1, 0.25, 'triangle'); tone(c, m, NOTE(n), i * 0.09, 0.01, 1.4 - i * 0.1, 0.18, 'square'); }); },
    coin: (c) => { const m = master(c); tone(c, m, NOTE(83), 0, 0.003, 0.08, 0.4, 'square'); tone(c, m, NOTE(88), 0.08, 0.003, 0.45, 0.4, 'square'); },
    whistle: (c) => { const m = master(c), o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain(); o.frequency.value = 2800; l.frequency.value = 28; lg.gain.value = 140; l.connect(lg).connect(o.frequency); env(c, g, 0, 0.02, 0.9, 0.35); o.connect(g).connect(m); o.start(0); l.start(0); o.stop(1); l.stop(1); noise(c, m, 0, 0.9, 0.08, 'bandpass', 2800, 0, 4); },
    drumroll: (c, d) => { const m = master(c); for (let t = 0; t < d - 0.4; t += 0.045) noise(c, m, t, 0.06, 0.15 + t / d * 0.4, 'bandpass', 900, 0, 0.8); tone(c, m, 110, d - 0.4, 0.003, 0.4, 1, 'sine', 45); noise(c, m, d - 0.4, 0.4, 0.8, 'highpass', 5000, 0, 0.5); },
    shutter: (c) => { const m = master(c); noise(c, m, 0, 0.04, 0.9, 'highpass', 2500, 0, 0.7); noise(c, m, 0.12, 0.06, 0.7, 'bandpass', 1800, 0, 1); },
    success: (c) => { const m = master(c);[72, 76, 79, 84].forEach((n, i) => tone(c, m, NOTE(n), i * 0.11, 0.005, 0.7, 0.3, 'triangle')); },
    buzz: (c) => { const m = master(c); tone(c, m, 180, 0, 0.005, 0.22, 0.4, 'square'); tone(c, m, 180, 0.3, 0.005, 0.22, 0.4, 'square'); },
    riser: (c, d) => { const m = master(c); noise(c, m, 0, d, 0.5, 'bandpass', 200, 5000, 2); tone(c, m, 110, 0, d * 0.95, 0.05, 0.15, 'sawtooth', 880); },
    heart: (c) => { const m = master(c, 1); tone(c, m, 70, 0, 0.005, 0.18, 1, 'sine', 40); tone(c, m, 70, 0.28, 0.005, 0.2, 0.8, 'sine', 40); },
    // 배경음악: 화음 진행 + 리듬(합성). 길이는 끝이 처음으로 자연스럽게 이어지게(반복 재생용)
    'm-bright': (c, d) => song(c, d, { bpm: 112, prog: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]], lead: 'triangle', drums: 'pop', bass: true, arp: true }),
    'm-energy': (c, d) => song(c, d, { bpm: 136, prog: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], lead: 'sawtooth', drums: 'rock', bass: true, arp: true, bright: 1.2 }),
    'm-calm': (c, d) => song(c, d, { bpm: 80, prog: [[60, 64, 67, 71], [57, 60, 64, 67], [65, 69, 72, 76], [67, 71, 74, 77]], lead: 'sine', drums: '', pad: true, arp: true, soft: true }),
    'm-lofi': (c, d) => song(c, d, { bpm: 84, prog: [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [57, 60, 64, 67]], lead: 'triangle', drums: 'lofi', bass: true, pad: true, soft: true }),
    'm-drum': (c, d) => song(c, d, { bpm: 96, prog: [[50, 57, 62], [48, 55, 60], [50, 57, 62], [45, 52, 57]], lead: '', drums: 'taiko', pad: true, bass: true }),
    'm-kids': (c, d) => song(c, d, { bpm: 120, prog: [[72, 76, 79], [77, 81, 84], [79, 83, 86], [72, 76, 79]], lead: 'square', drums: 'pop', bass: true, arp: true, kids: true }),
  };
  function song(c, d, o) {
    const m = master(c, o.soft ? 0.55 : 0.7), beat = 60 / o.bpm, bar = beat * 4, bars = Math.floor(d / bar);
    const rev = c.createConvolver(), rb = c.createBuffer(2, SR * 1.6, SR); for (let ch = 0; ch < 2; ch++) { const x = rb.getChannelData(ch); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / x.length, 3); } rev.buffer = rb; const wet = c.createGain(); wet.gain.value = o.soft ? 0.35 : 0.2; rev.connect(wet).connect(m);
    const send = node => { node.connect(m); node.connect(rev); };
    for (let b = 0; b < bars; b++) {
      const ch = o.prog[b % o.prog.length], t0 = b * bar;
      if (o.pad) ch.forEach(n => { const os = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); os.type = 'sawtooth'; os.frequency.value = NOTE(n); os.detune.value = (Math.random() - 0.5) * 12; f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.035, t0 + bar * 0.3); g.gain.linearRampToValueAtTime(0.0001, t0 + bar * 1.02); os.connect(f).connect(g); send(g); os.start(t0); os.stop(t0 + bar * 1.05); });
      if (o.bass) for (let k = 0; k < 4; k++) { if (o.drums === 'lofi' && k % 2) continue; tone(c, m, NOTE(ch[0] - 24), t0 + k * beat, 0.01, beat * 0.8, o.kids ? 0.18 : 0.28, 'triangle'); }
      if (o.arp && o.lead) for (let k = 0; k < 8; k++) { const n = ch[(k + (b % 2)) % ch.length] + 12 * (k % 4 === 3 ? 1 : 0); const g = c.createGain(), os = c.createOscillator(), f = c.createBiquadFilter(); os.type = o.lead; os.frequency.value = NOTE(n); f.type = 'lowpass'; f.frequency.value = 2400 * (o.bright || 1); const t = t0 + k * beat / 2; env(c, g, t, 0.005, beat * 0.45, o.lead === 'sine' ? 0.12 : o.lead === 'square' ? 0.05 : 0.08); os.connect(f).connect(g); send(g); os.start(t); os.stop(t + beat * 0.5); }
      for (let k = 0; k < 8; k++) { const t = t0 + k * beat / 2 + (o.drums === 'lofi' && k % 2 ? beat * 0.08 : 0);
        if (o.drums === 'pop' || o.drums === 'rock' || o.drums === 'lofi') { if (k % 4 === 0 || (o.drums === 'rock' && k % 2 === 0)) tone(c, m, 120, t, 0.002, 0.22, o.drums === 'lofi' ? 0.5 : 0.8, 'sine', 45); if (k % 4 === 2) noise(c, m, t, o.drums === 'lofi' ? 0.12 : 0.16, o.drums === 'lofi' ? 0.25 : 0.4, 'bandpass', 1800, 0, 0.8); noise(c, m, t, 0.04, o.drums === 'rock' ? 0.12 : 0.07, 'highpass', 7000, 0, 0.7); }
        if (o.drums === 'taiko') { if (k % 2 === 0 || (k === 7 && b % 2)) { tone(c, m, 85, t, 0.003, 0.6, k % 4 === 0 ? 1 : 0.6, 'sine', 40); noise(c, m, t, 0.12, 0.25, 'lowpass', 800, 0, 0.6); } if (k === 5) noise(c, m, t, 0.05, 0.3, 'bandpass', 2500, 0, 2); }
      }
    }
  }

  /* ---------- ③ 공유 자료 (동기화 폴더 '디자인자료/영상자료') ---------- */
  const SHARE = ['디자인자료', '영상자료'];
  async function shareDir(sub, create) { if (!(await NC.store.folderReady())) return null; let d = NC.store.state.dir; for (const p of SHARE.concat(sub ? [sub] : [])) d = await d.getDirectoryHandle(p, { create: !!create }); return d; }
  async function listShared() {
    const out = []; for (const sub of ['음악', '효과음', '영상']) { let d = null; try { d = await shareDir(sub, false); } catch (e) {} if (!d) continue; for await (const [name, h] of d.entries()) { if (h.kind !== 'file' || name.startsWith('.')) continue; if (!/\.(mp3|m4a|wav|aac|ogg|mp4|mov|webm|m4v)$/i.test(name)) continue; out.push({ ref: 'shared:' + sub + '/' + name, name: name.replace(/\.[^.]+$/, ''), cat: sub === '영상' ? 'video' : sub === '효과음' ? 'sfx' : 'music', sub }); } }
    return out;
  }
  const shUrls = new Map();
  async function sharedURL(path) { if (shUrls.has(path)) return shUrls.get(path); const [sub, name] = [path.slice(0, path.indexOf('/')), path.slice(path.indexOf('/') + 1)]; const d = await shareDir(sub, false); const f = await (await d.getFileHandle(name)).getFile(); const u = URL.createObjectURL(f); shUrls.set(path, u); return u; }
  // 내 PC 파일을 공유 자료로 올리기 (템플릿 음악 등 여러 PC에서 쓸 것만)
  async function share(fileObj, sub) { const d = await shareDir(sub, true); let name = fileObj.name; for (let i = 2; ; i++) { try { await d.getFileHandle(name); name = fileObj.name.replace(/(\.[^.]+)?$/, ` (${i})$1`); } catch (e) { break; } } const h = await d.getFileHandle(name, { create: true }); const w = await h.createWritable(); await w.write(fileObj); await w.close(); return 'shared:' + sub + '/' + name; }
  // 결과물 저장: 동기화 폴더 '결과물' (최종 산출물만 온라인에)
  async function saveResult(blob, name) { const d = await NC.store.state.dir.getDirectoryHandle('결과물', { create: true }); let nm = name; for (let i = 2; ; i++) { try { await d.getFileHandle(nm); nm = name.replace(/(\.[^.]+)?$/, ` (${i})$1`); } catch (e) { break; } } const h = await d.getFileHandle(nm, { create: true }); const w = await h.createWritable(); await w.write(blob); await w.close(); return nm; }

  /* ---------- 참조 풀기: 소리 → AudioBuffer, 동영상 → 주소 ---------- */
  // ref: 'b:<기본 소리>' · 'm:<내 PC 원본 id>' · 'shared:<경로>' · 'a:<문서 그림 키(예전 방식)>'
  async function urlOf(ref, ask, assetURL) {
    if (!ref) return null;
    if (ref.startsWith('m:')) { const r = await file(ref.slice(2), ask); if (r.url) return r.url; const e = new Error(r.needPerm ? `"${r.name}" 원본을 읽으려면 허락이 필요합니다` : '이 PC에 원본이 없습니다 — 원본 다시 연결'); e.code = r.needPerm ? 'perm' : 'missing'; e.ref = ref; throw e; }
    if (ref.startsWith('shared:')) return sharedURL(ref.slice(7));
    if (assetURL) return assetURL(ref);
    return ref;
  }
  const bufs = new Map();
  async function audio(ref, ask, assetURL, ac) {
    if (ref.startsWith('b:')) return render(ref.slice(2));
    const key = ref; if (bufs.has(key)) return bufs.get(key);
    const u = await urlOf(ref, ask, assetURL); const ab = await (await fetch(u)).arrayBuffer(); const b = await ac.decodeAudioData(ab); bufs.set(key, b); return b;
  }
  // 원본 파일 자체(읽지 않고 가리키기만): 긴 파일을 조금씩 읽을 때
  const fileC = new Map();  // m:아이디 → File (handle.getFile()은 부를 때마다 새 File이라 캐시가 안 맞음)
  async function blobOf(ref, ask) { if (fileC.has(ref)) return fileC.get(ref); const f = await blobOf0(ref, ask); if (ref.startsWith('m:')) fileC.set(ref, f); return f; }
  async function blobOf0(ref, ask) {
    if (ref.startsWith('m:')) { const rec = await tx('readonly', st => st.get(ref.slice(2))); if (!rec) { const e = new Error('이 PC에 원본이 없습니다'); e.code = 'missing'; throw e; } if (rec.blob) return rec.blob; let p = await rec.handle.queryPermission({ mode: 'read' }); if (p !== 'granted' && ask) p = await rec.handle.requestPermission({ mode: 'read' }); if (p !== 'granted') { const e = new Error(`"${rec.name}" 원본을 읽으려면 허락이 필요합니다`); e.code = 'perm'; throw e; } return rec.handle.getFile(); }
    if (ref.startsWith('shared:')) { const path = ref.slice(7), sub = path.slice(0, path.indexOf('/')), name = path.slice(path.indexOf('/') + 1); const d = await shareDir(sub, false); return (await d.getFileHandle(name)).getFile(); }
    return (await fetch(ref)).blob();
  }
  const isLocal = ref => typeof ref === 'string' && ref.startsWith('m:');
  return { pick, addFile, addHandle, file, has, relink, list, remove, SOUNDS, render, listShared, sharedURL, share, saveResult, urlOf, audio, isLocal, blobOf };
})();
