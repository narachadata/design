// 구글 드라이브 직접 저장 — 드라이브 앱 설치 없이 구글 로그인만으로 (팀장님 11/25)
// 「1차로 작업 중인 PC에 저장 → 연동된 구글 드라이브에 업로드」:
//   · 쓰기는 이 PC(IndexedDB)에 바로 끝나고, 드라이브에는 뒤에서 차례로 올림(올릴 목록도 PC에 남아 창을 닫아도 다음에 이어서)
//   · 폴더 손잡이(FileSystemDirectoryHandle)와 같은 모양의 가짜 손잡이를 만들어 storage.js·app.js가 그대로 씀
//   · 목록은 한 번에 전부 받아(파일 수가 많아도 요청 1~2번) 메모리에 두고 20초마다 새로
//   · 문서 안 그림(assets)은 「.그림」 폴더에 한 번만 올리고, 문서 파일에는 그림 이름만 → 저장할 때 바뀐 글·배치만 올라감
//   · 아주 큰 파일(영상 원본 등 40MB 넘게)은 이 PC에만 둠
//   · 권한은 drive.file(공방이 만든 파일만 보임) — 메인 프로그램과 같은 구글 로그인 설정(같은 주소 narachadata.github.io)
window.NC = window.NC || {};
NC.gdrive = (function () {
  const CID = '299837559641-4ha9abens4vv1rd7in49bifmgge5hhcn.apps.googleusercontent.com';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const ROOT_NAME = '나라차디자인공방 (웹 저장)';
  const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
  const FOLDER = 'application/vnd.google-apps.folder', ASSET_DIR = '.그림';
  const BIG = 40 * 1024 * 1024, FRESH = 20000, ONE_SHOT = 4.5 * 1024 * 1024;
  const FIELDS = 'id,name,parents,mimeType,size,modifiedTime,appProperties,trashed';
  let fetcher = (u, o) => fetch(u, o);
  const S = { token: '', exp: 0, email: '', rootId: '', rootK: '', nodes: new Map(), listedAt: 0, queue: [], busy: false, err: '', need: false, wait: 0, done: 0, conflicts: 0, autoTries: 0, listeners: new Set() };
  const st = () => NC.store;
  const rid = () => 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = () => Date.now();
  const emit = () => S.listeners.forEach(f => { try { f(status()); } catch (e) {} });
  function nfErr(n) { const e = new Error(`「${n}」이(가) 없습니다`); e.name = 'NotFoundError'; return e; }

  /* ---------- 이 PC에 남기기 ---------- */
  let saveT = 0;
  function persist(soon) { clearTimeout(saveT); const go = () => st().idbSet('gd-meta', { rootId: S.rootId, rootK: S.rootK, email: S.email, listedAt: S.listedAt, nodes: [...S.nodes.values()] }).catch(() => {}); if (soon) saveT = setTimeout(go, 400); else return go(); }
  const saveQ = () => st().idbSet('gd-q', S.queue).catch(() => {});
  const cGet = k => st().idbGet('gd-c:' + k).catch(() => null), cSet = (k, v) => st().idbSet('gd-c:' + k, v), cDel = k => st().idbDel('gd-c:' + k).catch(() => {});
  function saveTok() { try { localStorage.setItem('naracal-gd-tok', JSON.stringify({ t: S.token, e: S.exp })); } catch (e) {} }
  function loadTok() { try { const o = JSON.parse(localStorage.getItem('naracal-gd-tok') || 'null'); if (o && o.t && o.e > now()) { S.token = o.t; S.exp = o.e; } } catch (e) {} }
  loadTok();  /* 로그인 단추를 누른 순간 바로 판단하도록 미리 */
  let loaded = null;
  function load() { if (loaded) return loaded; loaded = (async () => { loadTok(); const m = await st().idbGet('gd-meta').catch(() => null); if (m && m.rootK) { S.rootId = m.rootId || ''; S.rootK = m.rootK; S.email = m.email || ''; S.listedAt = 0; (m.nodes || []).forEach(n => S.nodes.set(n.k, n)); } const q = await st().idbGet('gd-q').catch(() => null); if (Array.isArray(q)) S.queue = q; })(); return loaded; }

  /* ---------- 구글 로그인 ---------- */
  function loadGIS() { return new Promise((res, rej) => { if (window.google && google.accounts && google.accounts.oauth2) return res(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('구글 로그인을 불러오지 못했습니다 — 인터넷 연결을 확인하세요')); document.head.appendChild(s); }); }
  function hint() { try { const o = JSON.parse(localStorage.getItem('naracal-acct') || 'null'); return (o && o.email) || S.email || ''; } catch (e) { return S.email || ''; } }
  const tokOK = () => !!S.token && S.exp > now() + 30000;
  let logging = null;
  function login() {
    if (S.fake) { S.token = 'fake'; S.exp = now() + 3600e3; S.need = false; emit(); return Promise.resolve(true); }
    if (logging) return logging;
    const open = () => new Promise((res, rej) => {
      const tc = google.accounts.oauth2.initTokenClient({ client_id: CID, scope: SCOPE, hint: hint(), callback: r => { if (r && r.access_token) { S.token = r.access_token; S.exp = now() + ((Number(r.expires_in) || 3600) - 60) * 1000; saveTok(); S.need = false; S.err = ''; S.autoTries = 0; emit(); res(true); kick(); } else rej(new Error('구글 로그인이 취소되었습니다')); },
        error_callback: e => rej(new Error(e && e.type === 'popup_closed' ? '로그인 창이 닫혔습니다' : e && e.type === 'popup_failed_to_open' ? '로그인 창이 막혔습니다 — 주소창 오른쪽의 팝업 차단을 풀어 주세요' : '구글 로그인이 되지 않았습니다')) });
      tc.requestAccessToken();
    });
    const ready = window.google && google.accounts && google.accounts.oauth2;
    logging = (ready ? open() : loadGIS().then(open)).finally(() => { logging = null; });
    return logging;
  }
  /* 한 시간쯤 지나 로그인이 끝나면: 다음에 화면을 누를 때 로그인 창을 잠깐 띄워 이어 감(브라우저는 누를 때만 창을 허락). 두 번 안 되면 단추로 */
  document.addEventListener('pointerdown', () => { if (!S.rootK || tokOK() || S.fake || logging || S.autoTries >= 2 || !(S.queue.length || now() - S.listedAt > FRESH)) return; if (now() - (S.lastAuto || 0) < 120000) return; S.lastAuto = now(); S.autoTries++; login().catch(() => { S.need = true; emit(); }); }, true);

  /* ---------- 드라이브 요청 ---------- */
  async function call(url, opt, raw) {
    if (!tokOK()) { S.need = true; emit(); const e = new Error('구글 로그인이 필요합니다'); e.auth = true; throw e; }
    opt = Object.assign({}, opt || {}); opt.headers = Object.assign({ Authorization: 'Bearer ' + S.token }, opt.headers || {});
    let r; try { r = await fetcher(url, opt); } catch (e) { const x = new Error('인터넷에 연결되지 않았습니다'); x.net = true; throw x; }
    if (r.status === 401) { S.token = ''; S.exp = 0; saveTok(); S.need = true; emit(); const e = new Error('구글 로그인이 필요합니다'); e.auth = true; throw e; }
    if (!r.ok) { let m = ''; try { m = ((await r.json()).error || {}).message || ''; } catch (e) {} const e = new Error(`구글 드라이브 오류 ${r.status}${m ? ' — ' + m : ''}`); e.status = r.status; throw e; }
    return raw ? r : (r.status === 204 ? null : r.json());
  }
  const qs = o => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  async function upload(id, meta, body, type) {
    const size = typeof body === 'string' ? new Blob([body]).size : body.size;
    if (size <= ONE_SHOT) {
      const b = 'nc' + Math.random().toString(36).slice(2), head = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n`;
      return call(`${UP}/files${id ? '/' + id : ''}?${qs({ uploadType: 'multipart', fields: FIELDS })}`, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: new Blob([head, body, `\r\n--${b}--`]) });
    }
    const r = await call(`${UP}/files${id ? '/' + id : ''}?${qs({ uploadType: 'resumable', fields: FIELDS })}`, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type }, body: JSON.stringify(meta) }, true);
    const loc = r.headers.get('Location'); if (!loc) throw new Error('큰 파일 올리기를 시작하지 못했습니다');
    let r2; try { r2 = await fetcher(loc, { method: 'PUT', headers: { 'Content-Type': type }, body: typeof body === 'string' ? new Blob([body], { type }) : body }); } catch (e) { const x = new Error('인터넷에 연결되지 않았습니다'); x.net = true; throw x; }
    if (!r2.ok) { const e = new Error('큰 파일 올리기 오류 ' + r2.status); e.status = r2.status; throw e; }
    return r2.json();
  }

  /* ---------- 나무(폴더·파일 목록) ---------- */
  const node = k => S.nodes.get(k);
  const kOfId = id => { for (const n of S.nodes.values()) if (n.id === id) return n.k; return ''; };
  const kids = k => [...S.nodes.values()].filter(n => n.parent === k && !n.gone);
  const pendingK = () => new Set(S.queue.map(o => o.k));
  const lmOf = f => Number(f.appProperties && f.appProperties.lm) || Date.parse(f.modifiedTime) || 0;
  async function listAll() {
    const all = []; let pt = '';
    do { const j = await call(`${API}/files?${qs(Object.assign({ q: 'trashed=false', fields: 'nextPageToken,files(' + FIELDS + ')', pageSize: 1000, spaces: 'drive' }, pt ? { pageToken: pt } : {}))}`); all.push(...(j.files || [])); pt = j.nextPageToken || ''; } while (pt);
    const byId = new Map(all.map(f => [f.id, f])), under = new Map([[S.rootId, true]]);
    const inRoot = f => { const seen = []; let cur = f; while (cur) { if (under.has(cur.id)) { const v = under.get(cur.id); seen.forEach(x => under.set(x, v)); return v; } seen.push(cur.id); const p = (cur.parents || [])[0]; if (!p) break; if (p === S.rootId) { seen.forEach(x => under.set(x, true)); return true; } cur = byId.get(p); } seen.forEach(x => under.set(x, false)); return false; };
    const mine = all.filter(f => f.id !== S.rootId && inRoot(f)), pend = pendingK(), seenK = new Set([S.rootK]);
    for (const f of mine) {
      let k = kOfId(f.id); const pk = (f.parents || [])[0] === S.rootId ? S.rootK : (kOfId((f.parents || [])[0]) || (f.parents || [])[0]);
      const folder = f.mimeType === FOLDER, lm = lmOf(f);
      if (!k) { k = f.id; S.nodes.set(k, { k, id: f.id, name: f.name, parent: pk, folder, size: Number(f.size) || 0, lm, rlm: lm, rparent: (f.parents || [])[0] }); }
      else { const n = node(k); n.rlm = lm; if (!pend.has(k)) Object.assign(n, { name: f.name, parent: pk, size: Number(f.size) || 0, lm, rparent: (f.parents || [])[0], gone: false }); }
      seenK.add(k);
    }
    for (const n of [...S.nodes.values()]) if (n.id && !seenK.has(n.k) && !pend.has(n.k) && n.k !== S.rootK) S.nodes.delete(n.k);  /* 다른 PC에서 지운 것 */
    S.listedAt = now(); persist(true); emit();
  }
  async function fresh(force) { await load(); if (!S.rootK) return; if (!force && now() - S.listedAt < FRESH) return; if (!tokOK() || !S.rootId) return; try { await listAll(); } catch (e) { if (!e.auth && !e.net) console.warn('드라이브 목록', e); } }

  /* ---------- 올리기 줄 ---------- */
  function enqueue(op) {
    const q = S.queue;
    if (op.op === 'rm') { const n = node(op.k); for (let i = q.length - 1; i >= 0; i--) if (q[i].k === op.k && !q[i].run) q.splice(i, 1); if (!n || !n.id) { saveQ(); emit(); return; } op.id = n.id; }
    else if (q.some(o => o.k === op.k && o.op === op.op && !o.run)) { emit(); return; }
    q.push(op); saveQ(); emit(); kick();
  }
  let kT = 0;
  function kick(ms) { clearTimeout(kT); kT = setTimeout(run, ms == null ? 300 : ms); }
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  async function assetDirK() {
    let a = kids(S.rootK).find(n => n.folder && n.name === ASSET_DIR); if (a && a.id) return a.k;
    if (!a) { a = { k: rid(), id: '', name: ASSET_DIR, parent: S.rootK, folder: true, size: 0, lm: now() }; S.nodes.set(a.k, a); }
    const f = await call(`${API}/files?fields=${FIELDS}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: ASSET_DIR, mimeType: FOLDER, parents: [S.rootId] }) });
    Object.assign(a, { id: f.id, rparent: S.rootId }); persist(true); return a.k;
  }
  /* 문서(.design.json)는 그림을 떼어 「.그림」 폴더에 한 번만 올리고, 문서에는 이름표(_gdA)만 */
  async function packDoc(text) {
    let j; try { j = JSON.parse(text); } catch (e) { return text; }
    if (!j || !j.assets || typeof j.assets !== 'object' || !Object.keys(j.assets).length) return text;
    const ak = await assetDirK(), have = new Set(kids(ak).map(n => n.name)), tag = {};
    for (const [key, v] of Object.entries(j.assets)) {
      if (typeof v !== 'string' || v.length < 2000) continue;  /* 작은 것은 문서에 그대로 */
      const nm = String(key).replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) + '-' + v.length.toString(36) + '-' + fnv(v) + '.txt';
      if (!have.has(nm)) { const f = await upload('', { name: nm, parents: [node(ak).id] }, v, 'text/plain'); S.nodes.set(f.id, { k: f.id, id: f.id, name: nm, parent: ak, folder: false, size: v.length, lm: lmOf(f), rlm: lmOf(f), rparent: node(ak).id }); have.add(nm); st().idbSet('gd-a:' + nm, v).catch(() => {}); }
      tag[key] = nm; delete j.assets[key];
    }
    if (!Object.keys(tag).length) return text;
    j._gdA = tag; return JSON.stringify(j);
  }
  async function unpackDoc(text) {
    if (text.indexOf('"_gdA"') < 0) return text;
    let j; try { j = JSON.parse(text); } catch (e) { return text; } if (!j || !j._gdA) return text;
    const ak = kids(S.rootK).find(n => n.folder && n.name === ASSET_DIR); j.assets = j.assets || {};
    for (const [key, nm] of Object.entries(j._gdA)) {
      let v = await st().idbGet('gd-a:' + nm).catch(() => null);
      if (!v) { const n = ak && kids(ak.k).find(x => x.name === nm); if (!n || !n.id) continue; v = await (await call(`${API}/files/${n.id}?alt=media`, {}, true)).text(); st().idbSet('gd-a:' + nm, v).catch(() => {}); }
      j.assets[key] = v;
    }
    delete j._gdA; return JSON.stringify(j);
  }
  const typeOf = n => /\.json$/i.test(n) ? 'application/json' : /\.txt$/i.test(n) ? 'text/plain' : /\.png$/i.test(n) ? 'image/png' : /\.jpe?g$/i.test(n) ? 'image/jpeg' : /\.webp$/i.test(n) ? 'image/webp' : /\.pdf$/i.test(n) ? 'application/pdf' : /\.mp4$/i.test(n) ? 'video/mp4' : /\.svg$/i.test(n) ? 'image/svg+xml' : 'application/octet-stream';
  const stamp = () => { const t = new Date(), p = n => String(n).padStart(2, '0'); return `${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}${p(t.getMinutes())}`; };
  async function doOp(o) {
    const n = node(o.k);
    if (o.op === 'rm') { if (o.id) { try { await call(`${API}/files/${o.id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }); } catch (e) { if (e.status !== 404) throw e; } } return; }
    if (!n || n.gone) return;
    const pid = n.parent === S.rootK ? S.rootId : (node(n.parent) || {}).id; if (!pid) { const e = new Error('윗 폴더가 아직 안 올라감'); e.later = true; throw e; }
    if (o.op === 'mkdir') { if (n.id) return; const f = await call(`${API}/files?fields=${FIELDS}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n.name, mimeType: FOLDER, parents: [pid], appProperties: { lm: String(n.lm) } }) }); Object.assign(n, { id: f.id, rparent: pid, rlm: n.lm }); return; }
    if (o.op === 'mv') { if (!n.id) return; await call(`${API}/files/${n.id}?${qs(Object.assign({ fields: 'id' }, n.rparent && n.rparent !== pid ? { addParents: pid, removeParents: n.rparent } : {}))}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n.name }) }); n.rparent = pid; return; }
    if (o.op === 'put') {
      if (n.folder) return;
      const c = await cGet(n.k); if (!c) return; if (n.size > BIG) { n.local = true; return; }
      const lm = c.lm; let body = c.data;
      if (typeof body === 'string' && /\.design\.json$/i.test(n.name)) body = await packDoc(body);
      if (n.id) { /* 올리기 전에: 그사이 다른 PC가 같은 파일을 올렸으면 덮지 않고 이 PC 것을 「충돌 사본」으로 */
        let f = null; try { f = await call(`${API}/files/${n.id}?fields=${FIELDS}`); } catch (e) { if (e.status !== 404) throw e; }
        if (!f || f.trashed) n.id = '';
        else if (n.rlm && lmOf(f) !== n.rlm) {
          const nm = n.name.replace(/(\.design\.json|\.[^.]+)?$/, m => ` (충돌 사본 ${stamp()} ${String(st().pcName()).replace(/[\\/:*?"<>|]/g, '_')})${m}`);
          const cf = await upload('', { name: nm, parents: [pid], appProperties: { lm: String(lm) } }, body, typeOf(n.name)); S.nodes.set(cf.id, { k: cf.id, id: cf.id, name: nm, parent: n.parent, folder: false, size: Number(cf.size) || 0, lm: lmOf(cf), rlm: lmOf(cf), rparent: pid }); cSet(cf.id, { lm: lmOf(cf), data: c.data }).catch(() => {});
          Object.assign(n, { lm: lmOf(f), rlm: lmOf(f), size: Number(f.size) || 0 }); cDel(n.k); S.conflicts++; return;
        }
      }
      const meta = n.id ? { name: n.name, appProperties: { lm: String(lm) } } : { name: n.name, parents: [pid], appProperties: { lm: String(lm) } };
      const f = await upload(n.id, meta, body, typeOf(n.name));
      Object.assign(n, { id: f.id, rparent: pid, rlm: lm }); if (n.k !== f.id && S.nodes.get(f.id) && S.nodes.get(f.id) !== n) S.nodes.delete(f.id);
    }
  }
  async function run() {
    if (S.busy) return; await load(); if (!S.queue.length) return;
    if (!tokOK()) { S.need = true; emit(); return; }
    S.busy = true; emit();
    /* 안 되는 것은 버리지 않고(예전엔 5번 뒤 버려서 ⏫가 사라져도 안 올라간 것이 있을 수 있었음) 오류를 남기고 점점 늦게 다시, 나머지는 계속 올림 */
    try {
      let i = 0;
      while (i < S.queue.length) {
        const o = S.queue[i]; if (o.next && o.next > now()) { i++; continue; } o.run = 1;
        try { await doOp(o); S.queue.splice(i, 1); S.done++; }
        catch (e) { delete o.run; if (e.later) { i++; continue; } if (e.auth) break; if (e.net) { S.err = e.message; S.wait = now() + 30000; kick(30000); break; }
          o.tries = (o.tries || 0) + 1; o.err = e.message; o.next = now() + Math.min(15000 * Math.pow(2, o.tries - 1), 600000); S.err = e.message; console.warn('드라이브에 올리지 못함 — 다시 해 봄', o, e); i++; }
        saveQ(); persist(true); emit();
      }
      if (!S.queue.some(o => o.tries)) S.err = '';
      const nx = S.queue.filter(o => o.next).map(o => o.next - now()); if (nx.length) kick(Math.max(1000, Math.min(...nx)));
    } finally { S.busy = false; saveQ(); persist(true); emit(); }
  }

  /* ---------- 내용 읽기 (이 PC에 있으면 바로, 없으면 내려받기) ---------- */
  async function content(n) {
    const c = await cGet(n.k); if (c && c.lm === n.lm) return c.data;
    if (!n.id) { if (c) return c.data; return ''; }
    const r = await call(`${API}/files/${n.id}?alt=media`, {}, true);
    let data = /\.(json|txt)$/i.test(n.name) ? await r.text() : await r.blob();
    if (typeof data === 'string' && /\.design\.json$/i.test(n.name)) data = await unpackDoc(data);
    cSet(n.k, { lm: n.lm, data }).catch(() => {}); return data;
  }
  async function checkOne(n) {  /* 지금 연 문서 — 20초 넘게 지났으면 그 파일만 드라이브에 물어봄 (다른 PC에서 고쳤는지) */
    if (!n.id || !tokOK() || now() - S.listedAt < FRESH || now() - (n.chk || 0) < FRESH || pendingK().has(n.k)) return;
    n.chk = now(); try { const f = await call(`${API}/files/${n.id}?fields=${FIELDS}`); if (f.trashed) return; const lm = lmOf(f); n.rlm = lm; if (lm !== n.lm) Object.assign(n, { lm, size: Number(f.size) || 0, name: f.name }); } catch (e) {}
  }
  /* getFile 결과: 문서·글(.json·.txt)은 크기·때만 먼저 주고 내용은 text()를 부를 때 (목록을 볼 때 모든 문서를 받지 않게) */
  class GInfo { constructor(n) { this.name = n.name; this.size = n.size; this.lastModified = n.lm; this.type = typeOf(n.name); this._k = n.k; }
    async text() { const n = node(this._k); const d = await content(n); return typeof d === 'string' ? d : await d.text(); }
    async arrayBuffer() { return new Blob([await this.text()]).arrayBuffer(); }
    async blob() { return new Blob([await this.text()], { type: this.type }); }
    stream() { const self = this; return new ReadableStream({ async start(c) { c.enqueue(new TextEncoder().encode(await self.text())); c.close(); } }); } }

  /* ---------- 손잡이 (FileSystemHandle과 같은 모양) ---------- */
  class GBase { constructor(k) { this.__gd = 1; this.k = k; }
    get name() { const n = node(this.k); return n ? (this.k === S.rootK ? ROOT_NAME : n.name) : ''; }
    async queryPermission() { return 'granted'; } async requestPermission() { if (!tokOK()) { try { await login(); } catch (e) {} } return 'granted'; }
    async isSameEntry(o) { return !!o && o.k === this.k; }
    async move(a, b) { const n = node(this.k); if (!n) throw nfErr(''); let dst = null, nm = a; if (a && typeof a === 'object') { dst = a; nm = b; } if (dst && dst.k !== n.parent) { let p = dst.k; while (p) { if (p === n.k) throw new Error('폴더를 자기 안으로 옮길 수 없습니다'); p = (node(p) || {}).parent; } n.parent = dst.k; } if (nm) n.name = String(nm); n.lm = n.folder ? n.lm : n.lm; persist(true); if (n.id) enqueue({ op: 'mv', k: n.k }); } }
  class GFile extends GBase { get kind() { return 'file'; }
    async getFile() { await load(); const n = node(this.k); if (!n || n.gone) throw nfErr(this.name); await checkOne(n);
      if (/\.(json|txt)$/i.test(n.name)) return new GInfo(n);
      const d = await content(n); return new File([d], n.name, { type: typeOf(n.name), lastModified: n.lm }); }
    async createWritable() { const self = this, parts = []; return { async write(d) { if (d && typeof d === 'object' && d.type === 'write') d = d.data; if (d instanceof GInfo) d = await d.text(); parts.push(d); }, async truncate() {}, async seek() {}, async abort() { parts.length = 0; },
      async close() { const n = node(self.k); if (!n) throw nfErr(self.name); const allStr = parts.every(p => typeof p === 'string'); const data = allStr ? parts.join('') : new Blob(parts, { type: typeOf(n.name) }); const lm = Math.max(now(), (n.lm || 0) + 1);
        await cSet(n.k, { lm, data }); Object.assign(n, { lm, size: typeof data === 'string' ? data.length : data.size, gone: false }); if (n.size > BIG) n.local = true; persist(true); if (!n.local) enqueue({ op: 'put', k: n.k }); emit(); } }; } }
  class GDir extends GBase { get kind() { return 'directory'; }
    async *entries() { await fresh(); for (const n of kids(this.k).sort((a, b) => a.name.localeCompare(b.name, 'ko'))) yield [n.name, handle(n)]; }
    async *values() { for await (const [, h] of this.entries()) yield h; }
    async *keys() { for await (const [n] of this.entries()) yield n; }
    [Symbol.asyncIterator]() { return this.entries(); }
    async getFileHandle(name, o) { await fresh(); const c = kids(this.k).find(n => n.name === name); if (c) { if (c.folder) { const e = new Error('폴더입니다'); e.name = 'TypeMismatchError'; throw e; } return handle(c); }
      if (!(o && o.create)) throw nfErr(name); const n = { k: rid(), id: '', name, parent: this.k, folder: false, size: 0, lm: now() }; S.nodes.set(n.k, n); persist(true); return handle(n); }
    async getDirectoryHandle(name, o) { await fresh(); const c = kids(this.k).find(n => n.name === name); if (c) { if (!c.folder) { const e = new Error('파일입니다'); e.name = 'TypeMismatchError'; throw e; } return handle(c); }
      if (!(o && o.create)) throw nfErr(name); const n = { k: rid(), id: '', name, parent: this.k, folder: true, size: 0, lm: now() }; S.nodes.set(n.k, n); persist(true); enqueue({ op: 'mkdir', k: n.k }); return handle(n); }
    async removeEntry(name, o) { const c = kids(this.k).find(n => n.name === name); if (!c) throw nfErr(name); if (c.folder && kids(c.k).length && !(o && o.recursive)) { const e = new Error('폴더가 비어 있지 않습니다'); e.name = 'InvalidModificationError'; throw e; }
      const drop = k => { kids(k).forEach(x => drop(x.k)); const x = node(k); if (x) { x.gone = true; cDel(k); S.nodes.delete(k); for (let i = S.queue.length - 1; i >= 0; i--) if (S.queue[i].k === k && !S.queue[i].run) S.queue.splice(i, 1); } };
      const id = c.id; drop(c.k); if (id) { S.queue.push({ op: 'rm', k: c.k, id }); saveQ(); kick(); } persist(true); emit(); }
    async resolve(h) { if (!h || !h.__gd) return null; const path = []; let k = h.k; while (k && k !== this.k) { const n = node(k); if (!n) return null; path.unshift(n.name); k = n.parent; } return k === this.k ? path : null; } }
  const cache = new Map();
  function handle(n) { let h = cache.get(n.k); if (!h) { h = n.folder ? new GDir(n.k) : new GFile(n.k); cache.set(n.k, h); } return h; }

  /* ---------- 연결 ---------- */
  async function connect() {
    await load(); if (!tokOK()) await login();
    try { const a = await call(`${API}/about?fields=user(emailAddress,displayName)`); S.email = (a.user || {}).emailAddress || ''; } catch (e) { if (e.auth) throw e; }
    if (!S.rootId) {
      const j = await call(`${API}/files?${qs({ q: `name='${ROOT_NAME.replace(/'/g, "\\'")}' and mimeType='${FOLDER}' and 'root' in parents and trashed=false`, fields: 'files(id,name,createdTime)', orderBy: 'createdTime', spaces: 'drive' })}`);
      let f = (j.files || [])[0]; S.found = !!f;
      if (!f) f = await call(`${API}/files?fields=id,name`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: ROOT_NAME, mimeType: FOLDER, parents: ['root'] }) });
      S.rootId = f.id; S.rootK = f.id; S.nodes.set(f.id, { k: f.id, id: f.id, name: ROOT_NAME, parent: '', folder: true, size: 0, lm: now() });
    }
    await listAll(); await persist(); kick();
    return handle(node(S.rootK));
  }
  function revive(o) { if (!o || !o.__gd || !o.k) return null; const n = node(o.k); return n ? handle(n) : null; }
  async function reviveAsync(o) { await load(); return revive(o); }
  async function disconnect() { await load(); S.rootId = ''; S.rootK = ''; S.nodes.clear(); cache.clear(); S.queue = []; S.listedAt = 0; await saveQ(); await persist(); emit(); }
  /* 점검: 드라이브를 지금 다시 읽고, 이 PC가 보는 공방 곳과 올릴 것·오류를 셈 (팀장님 11/25 「노트북에서 도장 PC 파일이 안 뜸」) */
  async function diag() {
    await load(); let listErr = ''; if (S.rootK && tokOK()) { try { await listAll(); } catch (e) { listErr = e.message; } }
    const all = [...S.nodes.values()].filter(n => n.k !== S.rootK && !n.gone), inAsset = n => { let p = n.parent; while (p && p !== S.rootK) { const x = node(p); if (!x) break; if (x.name === ASSET_DIR || x.name === '.기록') return true; p = x.parent; } return n.name === ASSET_DIR || n.name === '.기록'; };
    const vis = all.filter(n => !inAsset(n)), up = all.filter(n => n.id);
    return { email: S.email, rootId: S.rootId, created: S.found === false, docs: vis.filter(n => /\.design\.json$/i.test(n.name)).length, docsUp: vis.filter(n => /\.design\.json$/i.test(n.name) && n.id).length, folders: vis.filter(n => n.folder).length, files: all.length, onDrive: up.length,
      pending: S.queue.length, failed: S.queue.filter(o => o.tries).length, errs: [...new Set(S.queue.filter(o => o.err).map(o => o.err))].slice(0, 3), err: S.err, listErr, listedAt: S.listedAt, need: !tokOK() && !S.fake };
  }
  /* 다른 계정으로: 이 PC의 로그인·공방 곳 기억을 지우고(드라이브 파일은 그대로) 다시 로그인 */
  function forget() { const t = S.token; S.token = ''; S.exp = 0; saveTok(); try { if (t && !S.fake && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(t, () => {}); } catch (e) {} S.rootId = ''; S.rootK = ''; S.email = ''; S.found = undefined; S.nodes.clear(); cache.clear(); S.queue = []; S.listedAt = 0; S.err = ''; saveQ(); persist(); emit(); }
  function status() { return { on: !!S.rootK, created: S.found === false, failed: S.queue.filter(o => o.tries).length, email: S.email, root: ROOT_NAME, pending: S.queue.length, busy: S.busy, need: S.need || (!!S.rootK && !tokOK() && !S.fake), err: S.err, done: S.done, conflicts: S.conflicts, listedAt: S.listedAt, local: [...S.nodes.values()].filter(n => n.local).length }; }
  function onChange(f) { S.listeners.add(f); return () => S.listeners.delete(f); }
  async function flush(ms) { const t0 = now(); kick(0); while (S.queue.length && now() - t0 < (ms || 20000)) { if (!tokOK()) break; await new Promise(r => setTimeout(r, 200)); if (!S.busy) kick(0); } return S.queue.length; }
  window.addEventListener('online', () => kick(500));
  window.addEventListener('beforeunload', e => { if (S.queue.length && S.rootK) { saveQ(); } });

  /* ---------- 시험용 가짜 드라이브 (?qa 에서만) — 실제 구글에 가지 않고 같은 요청·응답 모양으로 ---------- */
  function fake() {
    S.fake = true; S.token = 'fake'; S.exp = now() + 3600e3;
    const F = new Map(), sessions = new Map(); let seq = 0, calls = 0, failN = 0; F.set('root', { id: 'root', name: '내 드라이브', mimeType: FOLDER, parents: [], modifiedTime: new Date().toISOString() });
    const out = f => ({ id: f.id, name: f.name, parents: f.parents, mimeType: f.mimeType, size: f.data != null ? String(f.data.length) : undefined, modifiedTime: f.modifiedTime, appProperties: f.appProperties, trashed: !!f.trashed });
    const res = (o, s, h) => new Response(o == null ? null : (typeof o === 'string' ? o : JSON.stringify(o)), { status: s || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}) });
    const touch = f => { f.modifiedTime = new Date(Date.now() + (seq++)).toISOString(); };
    const apply = (f, meta) => { if (meta.name) f.name = meta.name; if (meta.parents) f.parents = meta.parents; if (meta.appProperties) f.appProperties = Object.assign({}, f.appProperties, meta.appProperties); if (meta.trashed != null) f.trashed = meta.trashed; if (meta.mimeType) f.mimeType = meta.mimeType; touch(f); };
    fetcher = async (url, o) => {
      calls++; o = o || {}; const u = new URL(url), p = u.pathname, m = (o.method || 'GET').toUpperCase(), q = u.searchParams;
      if (o.headers && o.headers.Authorization !== 'Bearer fake' && !u.searchParams.get('sess')) return res({ error: { message: 'auth' } }, 401);
      if (p.endsWith('/about')) return res({ user: { emailAddress: 'qa@example.com', displayName: 'QA' } });
      if (u.searchParams.get('sess')) { const s = sessions.get(u.searchParams.get('sess')); const body = o.body instanceof Blob ? await o.body.text() : String(o.body); let f = s.id ? F.get(s.id) : null; if (!f) { f = { id: 'f' + (++seq) }; F.set(f.id, f); } apply(f, s.meta); f.data = body; return res(out(f)); }
      const up = p.includes('/upload/'), idm = p.match(/\/files\/([^/]+)$/), id = idm && idm[1];
      if (up && q.get('uploadType') === 'resumable') { const sid = 's' + (++seq); sessions.set(sid, { id, meta: JSON.parse(o.body) }); return res(null, 200, { Location: 'https://fake.upload/?sess=' + sid }); }
      if (up && failN > 0) { failN--; return res({ error: { message: '시험용 실패' } }, 500); }
      if (up) { const t = await o.body.text(), b = (o.headers['Content-Type'].match(/boundary=(\S+)/) || [])[1]; const parts = t.split('--' + b).slice(1, -1).map(x => x.replace(/^\r\n/, '').replace(/\r\n$/, '')); const meta = JSON.parse(parts[0].split('\r\n\r\n').slice(1).join('\r\n\r\n')); const data = parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n');
        let f = id ? F.get(id) : null; if (id && !f) return res({ error: { message: 'not found' } }, 404); if (!f) { f = { id: 'f' + (++seq) }; F.set(f.id, f); } apply(f, meta); f.data = data; return res(out(f)); }
      if (id && m === 'GET') { const f = F.get(id); if (!f) return res({ error: { message: 'not found' } }, 404); if (q.get('alt') === 'media') return new Response(f.data || '', { status: 200 }); return res(out(f)); }
      if (id && m === 'PATCH') { const f = F.get(id); if (!f) return res({ error: { message: 'not found' } }, 404); const meta = JSON.parse(o.body || '{}'); if (q.get('addParents')) f.parents = [q.get('addParents')]; apply(f, meta); return res(out(f)); }
      if (p.endsWith('/files') && m === 'POST') { const meta = JSON.parse(o.body); const f = { id: 'f' + (++seq) }; F.set(f.id, f); apply(f, meta); return res(out(f)); }
      if (p.endsWith('/files') && m === 'GET') { const qq = q.get('q') || ''; let L = [...F.values()].filter(f => f.id !== 'root' && !f.trashed); const nm = qq.match(/name='([^']+)'/); if (nm) L = L.filter(f => f.name === nm[1] && (f.parents || []).includes('root')); return res({ files: L.map(out) }); }
      return res({ error: { message: 'fake: ' + m + ' ' + p } }, 400);
    };
    return { files: F, calls: () => calls, fail: n => { failN = n; }, other: (id, text) => { const f = F.get(id); f.data = text; f.appProperties = Object.assign({}, f.appProperties, { lm: String(Date.now() + 99999) }); touch(f); } };
  }

  /* 로그인 창은 누른 순간에 열어야 크롬이 막지 않음 → 저장 설정·안내 창을 열 때 미리 불러 둠 */
  function preload() { if (S.fake) return; loadGIS().catch(() => {}); }
  return { connect, login, preload, diag, forget, revive, reviveAsync, disconnect, status, onChange, flush, fresh: () => fresh(true), run: () => run(), load, ROOT_NAME, tokOK, _fake: fake, _S: S };
})();
