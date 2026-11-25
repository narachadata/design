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
  /* 이 PC에만 둘 큰 파일 = 영상·음악 원본 등. 문서(.design.json)는 사진을 떼어 올리므로 크기와 상관없이 올림 (11/25 — 사진 많은 문서가 40MB를 넘어 안 올라갔음) */
  const tooBig = n => n.size > BIG && !/\.(json|txt)$/i.test(n.name);
  const FIELDS = 'id,name,parents,mimeType,size,modifiedTime,createdTime,appProperties,trashed';
  /* 요청 시간 제한 — 큰 파일 올리기는 넉넉히(크기에 따라), 나머지 60초. 걸린 요청 하나 때문에 올리기 전체가 멈추던 것 막음 (11/25) */
  const realFetch = (u, o) => { const ac = new AbortController(), sz = o && o.body && (o.body.size || (o.body.length || 0)) || 0, ms = 60000 + Math.round(sz / 1024 / 20) * 1000; const t = setTimeout(() => ac.abort(), Math.min(ms, 30 * 60000)); return fetch(u, Object.assign({}, o, { signal: ac.signal })).finally(() => clearTimeout(t)); };
  let fetcher = realFetch;
  const S = { token: '', exp: 0, email: '', rootId: '', rootK: '', nodes: new Map(), ren: new Map(), listedAt: 0, queue: [], busy: false, err: '', need: false, wait: 0, done: 0, conflicts: 0, autoTries: 0, listeners: new Set() };
  const st = () => NC.store;
  const rid = () => 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = () => Date.now();
  const emit = () => S.listeners.forEach(f => { try { f(status()); } catch (e) {} });
  function nfErr(n) { const e = new Error(`「${n}」이(가) 없습니다`); e.name = 'NotFoundError'; return e; }

  /* ---------- 이 PC에 남기기 ---------- */
  /* 같은 PC에서 공방 창을 둘 열어도(11/25 남은 것): 창마다 「지난번 맞춘 판」(seenN·seenQ)과 비교해 **내가 바꾼 것만** 이 PC 기록에 더하고,
     다른 창이 바꾼 것은 받아 옴 — 예전엔 창마다 통째로 써서 한 창이 고친 문서·올릴 것을 다른 창이 지울 수 있었음. 쓰기는 잠금(Web Locks)으로 한 번에 하나 */
  let saveT = 0, seenN = new Map(), seenQ = new Set(), syncing = null, again = false, follow = null;
  const ser = n => JSON.stringify(n), qkey = o => o.qi || (o.qi = rid());
  const qser = o => JSON.stringify(Object.assign({}, o, { run: undefined }));
  let bc = null; try { bc = new BroadcastChannel('naracha-gd'); bc.onmessage = e => { if (e.data === 'sync' && S.rootK) { clearTimeout(saveT); saveT = setTimeout(() => { sync().then(() => { emit(); kick(500); }); }, 150); } }; } catch (e) {}
  const withLock = f => navigator.locks ? navigator.locks.request('naracha-gd-meta', f) : f();
  function dedupeIds() {  /* 두 창이 같은 드라이브 파일을 다른 이름표(k)로 알게 된 경우 하나로 — 더 새로 고친 것을 남기고 다른 이름표는 그리로 가리킴 */
    const byId = new Map();
    for (const n of [...S.nodes.values()]) { if (!n.id) continue; const o = byId.get(n.id); if (!o) { byId.set(n.id, n); continue; }
      const keep = (n.lm || 0) > (o.lm || 0) ? n : o, drop = keep === n ? o : n; S.ren.set(drop.k, keep.k); S.nodes.delete(drop.k); cache.delete(drop.k); byId.set(n.id, keep);
      S.nodes.forEach(x => { if (x.parent === drop.k) x.parent = keep.k; if (x.alias === drop.k) x.alias = keep.k; }); S.queue.forEach(q => { if (q.k === drop.k) q.k = keep.k; }); }
  }
  async function sync() {
    if (syncing) { again = true; if (!follow) { let res; follow = new Promise(r => { res = r; }); follow.res = res; } return follow; }  /* 진행 중인 맞추기는 그 전 내용 — 다음 맞추기가 끝날 때까지 기다림 */
    let changed = false;
    syncing = withLock(async () => {
      const m = await st().idbGet('gd-meta').catch(() => null), q0 = await st().idbGet('gd-q').catch(() => null);
      if (!S.reset && m && (m.gen || 0) > (S.gen || 0)) {  /* 다른 창이 연결을 끊거나 다른 계정으로 바꿈 → 이 창도 그 기록으로 */
        S.gen = m.gen; S.nodes.clear(); cache.clear(); S.queue.splice(0, S.queue.length); S.ids = []; S.rootId = m.rootId || ''; S.rootK = m.rootK || ''; S.email = m.email || ''; (m.nodes || []).forEach(n => S.nodes.set(n.k, n)); if (Array.isArray(q0)) q0.forEach(o => { delete o.run; S.queue.push(o); });
        seenN = new Map((m.nodes || []).map(n => [n.k, ser(n)])); seenQ = new Set(S.queue.map(qkey)); return;
      }
      if (!S.reset && m && m.rootK && m.rootK === S.rootK) {
        const stored = new Map((m.nodes || []).map(n => [n.k, n]));
        const fmerge = (mine, sn, was) => { const w = JSON.parse(was); for (const x of new Set([...Object.keys(mine), ...Object.keys(sn)])) { if (JSON.stringify(mine[x]) !== JSON.stringify(w[x])) continue; if (x in sn) mine[x] = sn[x]; else delete mine[x]; } };  /* 칸마다: 내가 바꾼 칸은 내 것, 아니면 다른 창 것 (한 창은 올린 번호, 다른 창은 새 저장 때를 바꿔도 둘 다 남음) */
        for (const k of new Set([...stored.keys(), ...S.nodes.keys()])) { const mine = S.nodes.get(k), sn = stored.get(k), was = seenN.get(k);
          if (mine && sn) { if (mine !== sn) { const mj = ser(mine); if (mj === was) { Object.keys(mine).forEach(x => { if (!(x in sn)) delete mine[x]; }); Object.assign(mine, sn); } else if (was && ser(sn) !== was) fmerge(mine, sn, was); } stored.set(k, mine); }
          else if (mine) { if (was && ser(mine) === was) { S.nodes.delete(k); cache.delete(k); } else stored.set(k, mine); }  /* 다른 창이 지운 것 · 새로 만든 것 */
          else if (was) stored.delete(k); else S.nodes.set(k, sn); }  /* 내가 지운 것 · 다른 창이 더한 것 */
        (m.ren || []).forEach(([a, b]) => { if (!S.ren.has(a)) S.ren.set(a, b); });
        const myQ = new Map(S.queue.map(o => [qkey(o), o])), out = [];
        for (const o of (Array.isArray(q0) ? q0 : [])) { const k = qkey(o); if (myQ.has(k)) { out.push(myQ.get(k)); myQ.delete(k); } else if (!seenQ.has(k)) { delete o.run; out.push(o); } }  /* 다른 창이 넣은 올릴 것 · 내가 끝낸 것은 뺌 */
        for (const [k, o] of myQ) if (!seenQ.has(k) || o.run) out.push(o);  /* 내가 새로 넣은 것 (다른 창이 끝낸 것은 뺌) */
        S.queue.splice(0, S.queue.length, ...out);
      }
      if (!S.reset && m && m.rootK && !S.rootK && !S.forgot) { S.rootId = m.rootId || ''; S.rootK = m.rootK; S.email = m.email || ''; (m.nodes || []).forEach(n => S.nodes.set(n.k, n)); }  /* 다른 창이 연결함 */
      dedupeIds(); S.queue.forEach(qkey);
      /* 쓸 내용을 지금 글자로 굳혀 그대로 쓰고, 「본 판」도 같은 글자로 (쓰는 사이 바뀐 것은 다음 맞추기에서 내 변경으로 잡힘) */
      const snapN = [...S.nodes.values()].map(n => [n.k, ser(n)]), snapQ = S.queue.map(o => [qkey(o), qser(o)]);
      const readN = new Map(((m && m.nodes) || []).map(n => [n.k, ser(n)])), readQ = new Map((Array.isArray(q0) ? q0 : []).map(o => [o.qi || '', qser(o)]));
      changed = S.reset || !m || m.rootK !== S.rootK || m.rootId !== S.rootId || m.email !== S.email || (m.gen || 0) !== (S.gen || 0) || readN.size !== snapN.length || readQ.size !== snapQ.length || snapN.some(([k, j]) => readN.get(k) !== j) || snapQ.some(([k, j]) => readQ.get(k) !== j);
      if (changed) {
        await st().idbSet('gd-meta', { rootId: S.rootId, rootK: S.rootK, email: S.email, listedAt: S.listedAt, gen: S.gen || 0, nodes: snapN.map(x => JSON.parse(x[1])), ren: [...S.ren].slice(-500) });
        await st().idbSet('gd-q', snapQ.map(x => JSON.parse(x[1])));
      }
      seenN = new Map(snapN); seenQ = new Set(snapQ.map(x => x[0])); S.reset = false;
    }).catch(e => console.warn('이 PC 기록', e)).finally(() => { syncing = null; if (changed) { try { bc && bc.postMessage('sync'); } catch (e) {} }  /* 바뀐 것이 있을 때만 다른 창에 알림 (예전엔 두 창이 끝없이 주고받음) */
      if (again) { again = false; const f = follow; follow = null; sync().then(() => f && f.res(), () => f && f.res()); } });
    return syncing;
  }
  function persist(soon) { clearTimeout(saveT); if (soon) saveT = setTimeout(sync, 400); else return sync(); }
  const saveQ = () => persist(true);
  const cGet = k => st().idbGet('gd-c:' + k).catch(() => null), cSet = (k, v) => st().idbSet('gd-c:' + k, v), cDel = k => st().idbDel('gd-c:' + k).catch(() => {});
  function saveTok() { try { localStorage.setItem('naracal-gd-tok', JSON.stringify({ t: S.token, e: S.exp })); } catch (e) {} }
  function loadTok() { try { const o = JSON.parse(localStorage.getItem('naracal-gd-tok') || 'null'); if (o && o.t && o.e > now()) { S.token = o.t; S.exp = o.e; } } catch (e) {} }
  loadTok();  /* 로그인 단추를 누른 순간 바로 판단하도록 미리 */
  let loaded = null;
  function load() { if (loaded) return loaded; loaded = (async () => { loadTok(); const m = await st().idbGet('gd-meta').catch(() => null); if (m && m.rootK) { S.rootId = m.rootId || ''; S.rootK = m.rootK; S.email = m.email || ''; S.listedAt = 0; (m.nodes || []).forEach(n => S.nodes.set(n.k, n)); (m.ren || []).forEach(([a, b]) => S.ren.set(a, b)); S.gen = m.gen || 0; seenN = new Map((m.nodes || []).map(n => [n.k, ser(n)])); } const q = await st().idbGet('gd-q').catch(() => null); if (Array.isArray(q)) { q.forEach(o => { delete o.run; }); S.queue = q; seenQ = new Set(q.map(qkey)); } })(); return loaded; }

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
    let r; try { r = await fetcher(url, opt); } catch (e) { if (e && e.name === 'AbortError') { const x = new Error('시간이 너무 오래 걸려 다음에 다시'); x.slow = true; throw x; } const x = new Error('인터넷에 연결되지 않았습니다'); x.net = true; throw x; }
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
    let r2; try { r2 = await fetcher(loc, { method: 'PUT', headers: { 'Content-Type': type }, body: typeof body === 'string' ? new Blob([body], { type }) : body }); } catch (e) { if (e && e.name === 'AbortError') { const x = new Error('시간이 너무 오래 걸려 다음에 다시'); x.slow = true; throw x; } const x = new Error('인터넷에 연결되지 않았습니다'); x.net = true; throw x; }
    if (!r2.ok) { const e = new Error('큰 파일 올리기 오류 ' + r2.status); e.status = r2.status; throw e; }
    return r2.json();
  }

  /* ---------- 나무(폴더·파일 목록) ---------- */
  const node = k => S.nodes.get(k) || (S.ren.has(k) ? S.nodes.get(S.ren.get(k)) || S.nodes.get(S.ren.get(S.ren.get(k)) || '') : undefined);
  const kOfId = id => { for (const n of S.nodes.values()) if (n.id === id) return n.k; return ''; };
  /* 두 PC가 같은 때(목록을 새로 받기 전·인터넷이 끊긴 사이) 같은 이름 폴더(영상·이미지·인쇄물·.그림·.기록…)를 따로 만들면 드라이브에 두 벌이 생김 (11/25 두 PC 시험)
     → 같은 윗 폴더·같은 이름 폴더는 한 폴더로 합쳐 보임: 먼저 생긴 것(만든 때 → 번호 순)이 본 폴더, 나머지는 alias(가리킴) — 두 PC가 같은 규칙이라 같게 보임. 드라이브 파일은 옮기거나 지우지 않음 */
  const real = k => { let n = node(k), d = 0; while (n && n.alias && d++ < 8) { const m = node(n.alias); if (!m) break; n = m; } return n ? n.k : k; };
  const kids = k => { const r = real(k); return [...S.nodes.values()].filter(n => !n.gone && !n.alias && n.parent && real(n.parent) === r); };
  const aliasesOf = k => [...S.nodes.values()].filter(n => n.alias && real(n.k) === k);
  function mergeDupFolders() {
    S.nodes.forEach(n => { if (n.alias) delete n.alias; });
    let changed = true, round = 0;
    while (changed && round++ < 6) {  /* 윗 폴더가 합쳐지면 그 안 같은 이름 폴더도 다시 묶음 */
      changed = false; const g2 = new Map();
      for (const n of S.nodes.values()) { if (!n.folder || n.gone || n.alias || n.k === S.rootK || !n.parent) continue; const key = real(n.parent) + '\u0000' + n.name; if (!g2.has(key)) g2.set(key, []); g2.get(key).push(n); }
      for (const L of g2.values()) { if (L.length < 2) continue;
        L.sort((a, b) => (!a.id - !b.id) || String(a.ct || '~').localeCompare(String(b.ct || '~')) || String(a.id || a.k).localeCompare(String(b.id || b.k)));
        for (const x of L.slice(1)) { x.alias = L[0].k; changed = true; } }
    }
  }
  const pendingK = () => new Set(S.queue.map(o => o.k));
  const lmOf = f => Number(f.appProperties && f.appProperties.lm) || Date.parse(f.modifiedTime) || 0;
  async function listAll() {
    const all = [], t0 = now(); let pt = '', partial = false;
    do { const j = await call(`${API}/files?${qs(Object.assign({ q: 'trashed=false', fields: 'nextPageToken,incompleteSearch,files(' + FIELDS + ')', pageSize: 1000, spaces: 'drive' }, pt ? { pageToken: pt } : {}))}`); all.push(...(j.files || [])); if (j.incompleteSearch) partial = true; pt = j.nextPageToken || ''; } while (pt);
    const recent = n => n.upAt && n.upAt > t0 - 30000;  /* 드라이브 목록은 만들기·옮기기 뒤 몇 초 늦을 수 있음 */  /* 목록을 받는 사이(또는 바로 전)에 이 PC가 올린 것 — 옛 목록으로 되돌리지 않음 (11/25 전문가 점검) */
    const byId = new Map(all.map(f => [f.id, f])), under = new Map([[S.rootId, true]]);
    const inRoot = f => { const seen = []; let cur = f; while (cur) { if (under.has(cur.id)) { const v = under.get(cur.id); seen.forEach(x => under.set(x, v)); return v; } seen.push(cur.id); const p = (cur.parents || [])[0]; if (!p) break; if (p === S.rootId) { seen.forEach(x => under.set(x, true)); return true; } cur = byId.get(p); } seen.forEach(x => under.set(x, false)); return false; };
    const mine = all.filter(f => f.id !== S.rootId && inRoot(f)), pend = pendingK(), seenK = new Set([S.rootK]);
    const idK = new Map(); S.nodes.forEach(n => { if (n.id) idK.set(n.id, n.k); }); const kOf = id => idK.get(id) || '';
    for (const f of mine) {
      let k = kOf(f.id); const pk = (f.parents || [])[0] === S.rootId ? S.rootK : (kOf((f.parents || [])[0]) || (f.parents || [])[0]);
      const folder = f.mimeType === FOLDER, lm = lmOf(f);
      if (!k) { k = f.id; idK.set(f.id, k); S.nodes.set(k, { k, id: f.id, name: f.name, parent: pk, folder, size: Number(f.size) || 0, lm, rlm: lm, rparent: (f.parents || [])[0], ct: f.createdTime || '' }); }
      else { const n = node(k); if (f.createdTime) n.ct = f.createdTime; if (!pend.has(k) && !recent(n) && !n.local) { n.rlm = lm; Object.assign(n, { name: f.name, parent: pk, size: Number(f.size) || 0, lm, rparent: (f.parents || [])[0], gone: false }); } }
      seenK.add(k);
    }
    if (!partial) {
      const pendUnder = new Set(); for (const k of pend) { let p = (node(k) || {}).parent, d = 0; while (p && p !== S.rootK && d++ < 50) { pendUnder.add(p); p = (node(p) || {}).parent; } }
      for (const n of [...S.nodes.values()]) { if (seenK.has(n.k)) { delete n.miss; continue; } if (!n.id || pend.has(n.k) || n.k === S.rootK || recent(n)) continue;
        if (!n.miss) { n.miss = 1; continue; }  /* 한 번 안 보인 것은 다음 목록까지 기다림 */
        if (n.folder && pendUnder.has(n.k)) { n.id = ''; n.rparent = ''; enqueue({ op: 'mkdir', k: n.k }); continue; }  /* 다른 PC가 지운 폴더 안에 이 PC 올릴 것 → 폴더를 다시 만들어 올림 */
        S.nodes.delete(n.k); cDel(n.k); }  /* 다른 PC에서 지운 것 */
    }
    mergeDupFolders();
    S.listedAt = now(); persist(true); emit();
  }
  let listing = null;
  async function fresh(force) { await load(); if (!S.rootK) return; if (!force && now() - S.listedAt < FRESH) return; if (!tokOK() || !S.rootId) return; if (listing) return listing; listing = (async () => { try { await listAll(); } catch (e) { if (!e.auth && !e.net) console.warn('드라이브 목록', e); } finally { listing = null; } })(); return listing; }

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
      if (!v) { let n = ak && kids(ak.k).find(x => x.name === nm && x.id); if (!n) n = [...S.nodes.values()].find(x => x.name === nm && x.id && !x.folder);
        let id = n && n.id; if (!id) { try { const r = await call(`${API}/files?${qs({ q: `name='${nm.replace(/'/g, "\\'")}' and trashed=false`, fields: 'files(id)', spaces: 'drive' })}`); id = ((r.files || [])[0] || {}).id; } catch (e) { if (e.auth || e.net) throw e; } }
        if (!id) { const e = new Error('문서 사진을 아직 받지 못했습니다 — 다른 PC가 다 올린 뒤(잠시 뒤) 다시 열어 주세요'); e.assetMissing = true; throw e; }
        v = await (await call(`${API}/files/${id}?alt=media`, {}, true)).text(); st().idbSet('gd-a:' + nm, v).catch(() => {}); }
      j.assets[key] = v;
    }
    delete j._gdA; return JSON.stringify(j);
  }
  /* 새로 만들 때는 드라이브에서 미리 받은 번호(generateIds)로 — 시간 초과·끊김으로 다시 보내도 같은 파일·폴더가 두 개 생기지 않음(이미 있으면 409 → 그것을 씀) (11/25 남은 것) */
  async function newId(n) { if (n.pid) return n.pid; if (!S.ids || !S.ids.length) { try { const j = await call(`${API}/files/generateIds?${qs({ count: 20, space: 'drive', type: 'files' })}`); S.ids = j.ids || []; } catch (e) { if (e.auth || e.net) throw e; S.ids = []; } } n.pid = S.ids.shift() || ''; if (n.pid) await persist(); return n.pid; }
  async function existing(id) { try { return await call(`${API}/files/${id}?fields=${FIELDS}`); } catch (e) { if (e.status === 404) return null; throw e; } }
  /* 「충돌 사본」은 정말 갈라졌을 때만 (11/25 팀장님 「열고 보기만 해도 충돌 사본이 많이 생김」): 드라이브 판과 이 PC 판의 저장 번호(saveId·lineage)를 봐서
     같은 판이거나 이 PC 판이 드라이브 판을 이어 고친 것이면 true(그대로 올림), 드라이브 판이 이 PC 판을 이어 고친 것이면 n.newer(이 PC 옛 판은 버림) */
  async function sameLine(n, f, mine) {
    if (!/\.design\.json$/i.test(n.name) || typeof mine !== 'string') return false;
    let a, b; try { a = JSON.parse(mine); b = JSON.parse(await (await call(`${API}/files/${f.id}?alt=media`, {}, true)).text()); } catch (e) { if (e && e.name === 'SyntaxError') return false; const x = new Error('드라이브 판을 받지 못해 다음에 다시 비교 — ' + (e.message || e)); x.net = !!e.net; x.auth = !!e.auth; x.status = e.status; throw x; }  /* 받기 실패(시간 초과·5xx·요청 많음)로 사본을 만들지 않음 */
    const as = a.saveId || '', bs = b.saveId || '';
    if (as && as === bs) return true;
    if (bs && (a.lineage || []).includes(bs)) return true;
    if (as && (b.lineage || []).includes(as)) { n.newer = true; return false; }
    const strip = j => { const o = Object.assign({}, j); ['saveId', 'lineage', 'savedBy', 'savedAt', 'pcId', 'assets', '_gdA'].forEach(k => delete o[k]); return JSON.stringify(o); };
    return strip(a) === strip(b);  /* 저장 번호가 없어도 내용(그림 빼고)이 같으면 같은 판 */
  }
  const typeOf = n => /\.json$/i.test(n) ? 'application/json' : /\.txt$/i.test(n) ? 'text/plain' : /\.png$/i.test(n) ? 'image/png' : /\.jpe?g$/i.test(n) ? 'image/jpeg' : /\.webp$/i.test(n) ? 'image/webp' : /\.pdf$/i.test(n) ? 'application/pdf' : /\.mp4$/i.test(n) ? 'video/mp4' : /\.svg$/i.test(n) ? 'image/svg+xml' : 'application/octet-stream';
  const stamp = () => { const t = new Date(), p = n => String(n).padStart(2, '0'); return `${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}${p(t.getMinutes())}`; };
  async function doOp(o) {
    const n = node(o.k);
    if (o.op === 'rm') { if (o.id) { try { await call(`${API}/files/${o.id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }); } catch (e) { if (e.status !== 404) throw e; } } return; }
    if (!n || n.gone) return;
    const pk0 = real(n.parent), pid = pk0 === S.rootK ? S.rootId : (node(pk0) || {}).id; if (!pid) { const e = new Error('윗 폴더가 아직 안 올라감'); e.later = true; throw e; }
    if (o.op === 'mkdir') { if (n.id || n.alias) return; const pre = await newId(n); let f = null; try { f = await call(`${API}/files?fields=${FIELDS}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign(pre ? { id: pre } : {}, { name: n.name, mimeType: FOLDER, parents: [pid], appProperties: { lm: String(n.lm) } })) }); } catch (e) { if (pre && e.status === 400) { delete n.pid; delete n.sent; S.ids = []; } if (!(e.status === 409 && pre)) throw e; f = await existing(pre); if (!f || f.trashed) { delete n.pid; delete n.sent; throw e; } }  /* 409: 지난번 보낸 것이 이미 만들어짐 (휴지통이면 다음에 새로) · 400: 받아 둔 번호가 안 맞음(계정 바뀜 등) → 버리고 다시 */
      Object.assign(n, { id: f.id, rparent: pid, rlm: n.lm, upAt: now() }); delete n.pid; return; }
    if (o.op === 'mv') { if (!n.id) { const e = new Error('처음 올리기가 끝나면 옮김'); e.later = true; throw e; } await call(`${API}/files/${n.id}?${qs(Object.assign({ fields: 'id' }, n.rparent && n.rparent !== pid ? { addParents: pid, removeParents: n.rparent } : {}))}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n.name }) }); n.rparent = pid; n.upAt = now(); return; }
    if (o.op === 'put') {
      if (n.folder) return;
      const c = await cGet(n.k); if (!c) return; if (tooBig(n)) { n.local = true; return; } n.local = false;
      const lm = c.lm; let body = c.data;
      if (typeof body === 'string' && /\.design\.json$/i.test(n.name)) body = await packDoc(body);
      if (n.id) { /* 올리기 전에: 그사이 다른 PC가 같은 파일을 올렸으면 덮지 않고 이 PC 것을 「충돌 사본」으로 */
        let f = null; try { f = await call(`${API}/files/${n.id}?fields=${FIELDS}`); } catch (e) { if (e.status !== 404) throw e; }
        if (!f || f.trashed) n.id = '';
        else if (n.rlm && lmOf(f) !== n.rlm && !/\.design\.json$/i.test(n.name)) {
          /* 문서가 아닌 같이 쓰는 파일: 설정은 덮지 않고 받아서 합친 뒤 다시 올림(11/25 두 PC 시험 — 예전엔 「충돌 사본」만 생기고 이 PC 바꾼 값이 드라이브에 안 올라갔음), 나머지(요소 숨김 등)는 나중 것으로 */
          if (n.name === '설정.naracha.json') { const c3 = await cGet(n.k); if (c3 && c3.lm !== lm) return;  /* 그사이 또 저장 → 다음 올리기에서 */ Object.assign(n, { lm: lmOf(f), rlm: lmOf(f), size: Number(f.size) || 0 }); cDel(n.k); persist(true); setTimeout(() => { try { window.dispatchEvent(new CustomEvent('gdrive-settings-conflict')); } catch (e) {} }, 0); return; }
        }
        else if (n.rlm && lmOf(f) !== n.rlm && await sameLine(n, f, c.data)) { /* 때만 다르고 내용은 이어진 판(같은 판·이 PC가 이어 고친 판) → 사본 없이 그대로 올림 */ }
        else if (n.rlm && lmOf(f) !== n.rlm && n.newer) { delete n.newer; const c3 = await cGet(n.k); if (c3 && c3.lm !== lm) return;  /* 그사이 또 저장 → 다음 올리기에서 다시 따짐 */ Object.assign(n, { lm: lmOf(f), rlm: lmOf(f), size: Number(f.size) || 0 }); cDel(n.k); return; }  /* 드라이브 것이 이 PC 것을 이어 고친 판 → 이 PC 옛 판은 올리지 않음 */
        else if (n.rlm && lmOf(f) !== n.rlm) {
          const nm = n.name.replace(/(\.design\.json|\.[^.]+)?$/, m => ` (충돌 사본 ${stamp()} ${String(st().pcName()).replace(/[\\/:*?"<>|]/g, '_')})${m}`);
          const cf = await upload('', { name: nm, parents: [pid], appProperties: { lm: String(lm) } }, body, typeOf(n.name)); S.nodes.set(cf.id, { k: cf.id, id: cf.id, name: nm, parent: n.parent, folder: false, size: Number(cf.size) || 0, lm: lmOf(cf), rlm: lmOf(cf), rparent: pid }); cSet(cf.id, { lm: lmOf(cf), data: c.data }).catch(() => {});
          const c2 = await cGet(n.k); if (c2 && c2.lm !== lm) { n.rlm = lmOf(f); S.conflicts++; return; }  /* 사본을 올리는 사이 또 저장함 → 새 저장은 남기고 다음 올리기에서 다시 따짐 */
          Object.assign(n, { lm: lmOf(f), rlm: lmOf(f), size: Number(f.size) || 0 }); cDel(n.k); S.conflicts++; return;
        }
      }
      if (!n.id) { const pre = await newId(n); if (pre && n.sent) { const ex = await existing(pre); if (ex && !ex.trashed) Object.assign(n, { id: ex.id, rparent: (ex.parents || [])[0] || pid }); else if (ex) { delete n.pid; delete n.sent; await newId(n); } } }  /* 지난번 만들기가 드라이브엔 됐는데 답을 못 받음 → 그 파일을 고쳐 씀 */
      const meta = n.id ? { name: n.name, appProperties: { lm: String(lm) } } : Object.assign(n.pid ? { id: n.pid } : {}, { name: n.name, parents: [pid], appProperties: { lm: String(lm) } });
      if (!n.id && n.pid && !n.sent) { n.sent = 1; await persist(); }  /* 한 번 보낸 뒤에만 「이미 만들어졌나」 물음 */
      let f; try { f = await upload(n.id, meta, body, typeOf(n.name)); } catch (e) { if (n.pid && e.status === 400) { delete n.pid; delete n.sent; S.ids = []; } if (!(e.status === 409 && n.pid)) throw e; const ex = await existing(n.pid); if (!ex || ex.trashed) { delete n.pid; delete n.sent; throw e; } n.id = ex.id; f = await upload(n.id, { name: n.name, appProperties: { lm: String(lm) } }, body, typeOf(n.name)); }
      delete n.pid; delete n.sent;
      Object.assign(n, { id: f.id, rparent: pid, rlm: lm, upAt: now() }); if (n.k !== f.id && S.nodes.get(f.id) && S.nodes.get(f.id) !== n) S.nodes.delete(f.id);
    }
  }
  /* 올릴 순서: 폴더 → 문서(.design.json)·설정 → 나머지(자료실 그림·내보낸 파일·버전 기록 등). 같은 무리 안에서는 들어온 순서 그대로 (11/25 — 308개 중 문서가 뒤에 밀렸음) */
  const kindOf = o => { const n = node(o.k); if (o.op === 'mkdir') return 0; if (!n) return 3; if (/\.design\.json$|^설정\.naracha\.json$/i.test(n.name) && !inHist(n)) return 1; if (o.op === 'mv' || o.op === 'rm') return 1; return 2 + (inHist(n) ? 1 : 0); };
  function inHist(n) { let p = n.parent, d = 0; while (p && p !== S.rootK && d++ < 50) { const x = node(p); if (!x) break; if (x.name === '.기록') return true; p = x.parent; } return false; }
  function sortQ() { const run1 = S.queue.filter(o => o.run); const rest = S.queue.filter(o => !o.run).map((o, i) => [kindOf(o), i, o]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]); S.queue = run1.concat(rest); }
  function queueKinds() { let docs = 0, other = 0; for (const o of S.queue) { const k = kindOf(o); if (k === 1) docs++; else other++; } return { docs, other }; }
  async function run() {
    if (S.busy) return; S.busy = true;
    if (navigator.locks && !S.fake) { let got = false; try { await navigator.locks.request('naracha-gd-run', { ifAvailable: true }, async l => { if (!l) return; got = true; await run0(); }); } catch (e) { console.warn(e); } finally { S.busy = false; emit(); } if (!got) kick(15000); return; }  /* 같은 PC 다른 창이 올리는 중이면 그 창에 맡기고 잠시 뒤 다시 */
    try { await run0(); } finally { S.busy = false; emit(); }
  }
  async function run0() {
    await load(); if (!S.queue.length) return;
    if (!tokOK()) { S.need = true; emit(); return; }
    S.busy = true; emit();
    /* 안 되는 것은 버리지 않고(예전엔 5번 뒤 버려서 ⏫가 사라져도 안 올라간 것이 있을 수 있었음) 오류를 남기고 점점 늦게 다시, 나머지는 계속 올림 */
    try {
      const skip = new Set();  /* 이번 차례에 건너뛸 것(윗 폴더가 아직 안 올라감·잠시 뒤 다시) */
      for (;;) {
        sortQ();  /* 올리는 사이 새로 들어온 문서도 앞으로 */
        const o = S.queue.find(x => !skip.has(x) && !x.run && !(x.next && x.next > now())); if (!o) break; o.run = 1; const hadId = !!((node(o.k) || {}).id); let created = false;
        try { await doOp(o); created = !hadId && !!((node(o.k) || {}).id); const j = S.queue.indexOf(o); if (j >= 0) S.queue.splice(j, 1); S.done++; }
        catch (e) { delete o.run; if (e.later) { skip.add(o); continue; } if (e.auth) break; if (e.net) { S.err = e.message; S.wait = now() + 30000; kick(30000); break; }
          o.tries = (o.tries || 0) + 1; o.err = e.message; o.next = now() + Math.min(15000 * Math.pow(2, o.tries - 1), 600000); S.err = e.message; console.warn('드라이브에 올리지 못함 — 다시 해 봄', o, e); skip.add(o); }
        if (created || o.op === 'rm' || o.op === 'mv') await persist(); else persist(true);  /* 새로 만든 것(드라이브 번호가 생김)·지우기·옮기기만 바로 남기고, 고쳐 올린 것은 0.4초 모아서 (11/25 — 수백 개 올릴 때 하나마다 이 PC 기록 전체를 쓰던 것) */
        emit();
      }
      if (!S.queue.some(o => o.tries)) S.err = '';
      const nx = S.queue.filter(o => o.next).map(o => o.next - now()); if (nx.length) kick(Math.max(1000, Math.min(...nx)));
    } finally { await persist(); saveQ(); emit(); }
  }

  /* ---------- 내용 읽기 (이 PC에 있으면 바로, 없으면 내려받기) ---------- */
  async function content(n) {
    const c = await cGet(n.k); if (c && c.lm === n.lm) return c.data;
    if (c && c.lm > (n.lm || 0) && !tooBig(n)) { n.lm = c.lm; persist(true); if (n.id || !n.folder) enqueue({ op: 'put', k: n.k }); return c.data; }  /* 이 PC에 저장했는데 기록에 남기기 전 꺼졌던 것 → 이 PC 것을 믿고 다시 올림 (드라이브 옛 판으로 덮지 않음) */
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
    async isSameEntry(o) { return !!o && !!o.k && real(o.k) === real(this.k); }
    async move(a, b) { const n = node(this.k); if (!n) throw nfErr(''); let dst = null, nm = a; if (a && typeof a === 'object') { dst = a; nm = b; } if (dst && dst.k !== n.parent) { let p = dst.k; while (p) { if (p === n.k) throw new Error('폴더를 자기 안으로 옮길 수 없습니다'); p = (node(p) || {}).parent; } n.parent = dst.k; } if (nm) n.name = String(nm); n.lm = n.folder ? n.lm : n.lm; if (n.folder) aliasesOf(n.k).forEach(x => { x.parent = n.parent; x.name = n.name; if (x.id) enqueue({ op: 'mv', k: x.k }); }); persist(true); if (n.id) enqueue({ op: 'mv', k: n.k }); } }
  class GFile extends GBase { get kind() { return 'file'; }
    async getFile() { await load(); const n = node(this.k); if (!n || n.gone) throw nfErr(this.name); await checkOne(n);
      if (/\.(json|txt)$/i.test(n.name)) return new GInfo(n);
      const d = await content(n); return new File([d], n.name, { type: typeOf(n.name), lastModified: n.lm }); }
    async createWritable() { const self = this, parts = []; return { async write(d) { if (d && typeof d === 'object' && d.type === 'write') d = d.data; if (d instanceof GInfo) d = await d.text(); parts.push(d); }, async truncate() {}, async seek() {}, async abort() { parts.length = 0; },
      async close() { const n = node(self.k); if (!n) throw nfErr(self.name); const allStr = parts.every(p => typeof p === 'string'); const data = allStr ? parts.join('') : new Blob(parts, { type: typeOf(n.name) }); const lm = Math.max(now(), (n.lm || 0) + 1);
        await cSet(n.k, { lm, data }); Object.assign(n, { lm, size: typeof data === 'string' ? data.length : data.size, gone: false }); n.local = tooBig(n); persist(true); if (!n.local) enqueue({ op: 'put', k: n.k }); emit(); } }; } }
  class GDir extends GBase { get kind() { return 'directory'; }
    async *entries() { await fresh(); for (const n of kids(this.k).sort((a, b) => a.name.localeCompare(b.name, 'ko'))) yield [n.name, handle(n)]; }
    async *values() { for await (const [, h] of this.entries()) yield h; }
    async *keys() { for await (const [n] of this.entries()) yield n; }
    [Symbol.asyncIterator]() { return this.entries(); }
    async getFileHandle(name, o) { await fresh(); const c = kids(this.k).find(n => n.name === name); if (c) { if (c.folder) { const e = new Error('폴더입니다'); e.name = 'TypeMismatchError'; throw e; } return handle(c); }
      if (!(o && o.create)) throw nfErr(name); const n = { k: rid(), id: '', name, parent: real(this.k), folder: false, size: 0, lm: now() }; S.nodes.set(n.k, n); persist(true); return handle(n); }
    async getDirectoryHandle(name, o) { await fresh(); let c = kids(this.k).find(n => n.name === name);
      if (!c && o && o.create && now() - S.listedAt > 3000) { await fresh(true); c = kids(this.k).find(n => n.name === name); }  /* 새 폴더 만들기 직전 드라이브를 한 번 더 — 다른 PC가 방금 만든 같은 이름 폴더를 씀 */ if (c) { if (!c.folder) { const e = new Error('파일입니다'); e.name = 'TypeMismatchError'; throw e; } return handle(c); }
      if (!(o && o.create)) throw nfErr(name); const n = { k: rid(), id: '', name, parent: real(this.k), folder: true, size: 0, lm: now() }; S.nodes.set(n.k, n); persist(true); enqueue({ op: 'mkdir', k: n.k }); return handle(n); }
    async removeEntry(name, o) { const c = kids(this.k).find(n => n.name === name); if (!c) throw nfErr(name); if (c.folder && kids(c.k).length && !(o && o.recursive)) { const e = new Error('폴더가 비어 있지 않습니다'); e.name = 'InvalidModificationError'; throw e; }
      const drop = k => { kids(k).forEach(x => drop(x.k)); const x = node(k); if (x) { x.gone = true; cDel(k); S.nodes.delete(k); for (let i = S.queue.length - 1; i >= 0; i--) if (S.queue[i].k === k && !S.queue[i].run) S.queue.splice(i, 1); } };
      const al0 = c.folder ? aliasesOf(c.k) : [], al = al0.filter(x => x.id).map(x => [x.k, x.id]); al0.forEach(x => { x.gone = true; S.nodes.delete(x.k); for (let i = S.queue.length - 1; i >= 0; i--) if (S.queue[i].k === x.k && !S.queue[i].run) S.queue.splice(i, 1); });
      const id = c.id; drop(c.k); if (id) S.queue.push({ op: 'rm', k: c.k, id }); al.forEach(([k, i]) => S.queue.push({ op: 'rm', k, id: i })); if (id || al.length) { saveQ(); kick(); } persist(true); emit(); }
    async resolve(h) { if (!h || !h.__gd) return null; const path = [], me = real(this.k); let k = h.k; while (k && real(k) !== me) { const n = node(k); if (!n) return null; path.unshift(n.name); k = n.parent; } return k && real(k) === me ? path : null; } }
  const cache = new Map();
  function handle(n) { n = node(n.k) || n; let h = cache.get(n.k); if (!h) { h = n.folder ? new GDir(n.k) : new GFile(n.k); cache.set(n.k, h); } return h; }

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
    S.forgot = false; await listAll(); await persist(); kick();
    return handle(node(S.rootK));
  }
  function revive(o) { if (!o || !o.__gd || !o.k) return null; const n = node(o.k); return n ? handle(n) : null; }
  async function reviveAsync(o) { await load(); return revive(o); }
  async function disconnect() { await load(); S.reset = true; S.forgot = true; S.gen = (S.gen || 0) + 1; S.ids = []; S.rootId = ''; S.rootK = ''; S.nodes.clear(); cache.clear(); S.queue = []; S.listedAt = 0; await saveQ(); await persist(); emit(); }
  /* 점검: 드라이브를 지금 다시 읽고, 이 PC가 보는 공방 곳과 올릴 것·오류를 셈 (팀장님 11/25 「노트북에서 도장 PC 파일이 안 뜸」) */
  async function diag() {
    await load(); let listErr = ''; if (S.rootK && tokOK()) { try { await listAll(); } catch (e) { listErr = e.message; } }
    const all = [...S.nodes.values()].filter(n => n.k !== S.rootK && !n.gone), inAsset = n => { let p = n.parent; while (p && p !== S.rootK) { const x = node(p); if (!x) break; if (x.name === ASSET_DIR || x.name === '.기록') return true; p = x.parent; } return n.name === ASSET_DIR || n.name === '.기록'; };
    const vis = all.filter(n => !inAsset(n)), up = all.filter(n => n.id);
    return { email: S.email, rootId: S.rootId, created: S.found === false, docs: vis.filter(n => /\.design\.json$/i.test(n.name)).length, docsUp: vis.filter(n => /\.design\.json$/i.test(n.name) && n.id).length, folders: vis.filter(n => n.folder && !n.alias).length, merged: all.filter(n => n.alias).length, files: all.length, onDrive: up.length,
      pending: S.queue.length, pendDocs: queueKinds().docs, pendOther: queueKinds().other, localOnly: all.filter(n => n.local).length, failed: S.queue.filter(o => o.tries).length, errs: [...new Set(S.queue.filter(o => o.err).map(o => o.err))].slice(0, 3), err: S.err, listErr, listedAt: S.listedAt, need: !tokOK() && !S.fake };
  }
  /* 이 PC에 있는데 드라이브에 없거나 더 새로운 것을 모두 다시 올릴 줄에 넣음 (폴더 먼저, 얕은 것부터) */
  async function pushAll() {
    await load(); if (!S.rootK) return 0; const depth = x => { let d = 0, p = x.parent; while (p && p !== S.rootK && d < 50) { d++; p = (node(p) || {}).parent; } return d; };
    const L = [...S.nodes.values()].filter(x => x.k !== S.rootK && !x.gone).sort((a, b) => (b.folder - a.folder) || depth(a) - depth(b));
    let n = 0;
    for (const x of L) {
      if (x.folder) { if (!x.id && !S.queue.some(o => o.k === x.k)) { S.queue.push({ op: 'mkdir', k: x.k }); n++; } continue; }
      x.local = tooBig(x); if (x.local) continue;
      const c = await cGet(x.k); if (!c) continue;  /* 이 PC에 내용이 없으면 드라이브에서 받은 것 그대로 */
      if (!x.id || (c.lm === x.lm && c.lm !== x.rlm)) { if (!S.queue.some(o => o.k === x.k && o.op === 'put')) { S.queue.push({ op: 'put', k: x.k }); n++; } }  /* c.lm < x.lm = 드라이브에서 받은 옛 판(다른 PC가 그 뒤에 고침) → 올리지 않음 (11/25 — 다른 PC 새 판을 옛 판으로 덮을 수 있었음) */
    }
    S.queue.forEach(o => { o.next = 0; }); saveQ(); emit(); kick(0); return n;
  }
  /* 다른 계정으로: 이 PC의 로그인·공방 곳 기억을 지우고(드라이브 파일은 그대로) 다시 로그인 */
  function forget() { const t = S.token; S.token = ''; S.exp = 0; saveTok(); try { if (t && !S.fake && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(t, () => {}); } catch (e) {} S.reset = true; S.forgot = true; S.gen = (S.gen || 0) + 1; S.ids = []; S.rootId = ''; S.rootK = ''; S.email = ''; S.found = undefined; S.nodes.clear(); cache.clear(); S.queue = []; S.listedAt = 0; S.err = ''; saveQ(); persist(); emit(); }
  function status() { const qk = queueKinds(); return { on: !!S.rootK, pendDocs: qk.docs, pendOther: qk.other, created: S.found === false, failed: S.queue.filter(o => o.tries).length, email: S.email, root: ROOT_NAME, pending: S.queue.length, busy: S.busy, need: S.need || (!!S.rootK && !tokOK() && !S.fake), err: S.err, done: S.done, conflicts: S.conflicts, listedAt: S.listedAt, local: [...S.nodes.values()].filter(n => n.local).length }; }
  function onChange(f) { S.listeners.add(f); return () => S.listeners.delete(f); }
  async function flush(ms) { const t0 = now(); kick(0); while (S.queue.length && now() - t0 < (ms || 20000)) { if (!tokOK()) break; await new Promise(r => setTimeout(r, 200)); if (!S.busy) kick(0); } return S.queue.length; }
  window.addEventListener('online', () => kick(500));
  window.addEventListener('beforeunload', e => { if (S.rootK) { clearTimeout(saveT); sync(); } });  /* 창을 닫을 때는 모아 두지 않고 바로 남김 */
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.rootK) { clearTimeout(saveT); sync(); } });

  /* ---------- 시험용 가짜 드라이브 (?qa 에서만) — 실제 구글에 가지 않고 같은 요청·응답 모양으로 ---------- */
  function fake() {
    S.fake = true; S.token = 'fake'; S.exp = now() + 3600e3;
    /* shared: 시험 서버(/__fd)의 가짜 드라이브를 여러 창(다른 출처 = 다른 PC)이 같이 씀 */
    if (arguments[0] && arguments[0].shared) { fetcher = (u, o) => realFetch('/__fd/' + encodeURIComponent(u), o); return { ctl: q => fetch('/__fd/' + encodeURIComponent('__ctl?' + (q || ''))).then(r => r.json()) }; }
    const F = new Map(), sessions = new Map(); let seq = 0, calls = 0, failN = 0; F.set('root', { id: 'root', name: '내 드라이브', mimeType: FOLDER, parents: [], modifiedTime: new Date().toISOString() });
    const out = f => ({ id: f.id, name: f.name, parents: f.parents, mimeType: f.mimeType, size: f.data != null ? String(f.data.length) : undefined, modifiedTime: f.modifiedTime, appProperties: f.appProperties, trashed: !!f.trashed });
    const res = (o, s, h) => new Response(o == null ? null : (typeof o === 'string' ? o : JSON.stringify(o)), { status: s || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}) });
    const touch = f => { f.modifiedTime = new Date(Date.now() + (seq++)).toISOString(); };
    const apply = (f, meta) => { if (meta.name) f.name = meta.name; if (meta.parents) f.parents = meta.parents; if (meta.appProperties) f.appProperties = Object.assign({}, f.appProperties, meta.appProperties); if (meta.trashed != null) f.trashed = meta.trashed; if (meta.mimeType) f.mimeType = meta.mimeType; touch(f); };
    fetcher = async (url, o) => {
      calls++; o = o || {}; const u = new URL(url), p = u.pathname, m = (o.method || 'GET').toUpperCase(), q = u.searchParams;
      if (o.headers && o.headers.Authorization !== 'Bearer fake' && !u.searchParams.get('sess')) return res({ error: { message: 'auth' } }, 401);
      if (p.endsWith('/about')) return res({ user: { emailAddress: 'qa@example.com', displayName: 'QA' } });
      if (u.searchParams.get('sess')) { const s = sessions.get(u.searchParams.get('sess')); const body = o.body instanceof Blob ? await o.body.text() : String(o.body); let f = s.id ? F.get(s.id) : null; if (!f) { f = { id: (s.meta && s.meta.id) || 'f' + (++seq) }; F.set(f.id, f); } apply(f, s.meta); f.data = body; return res(out(f)); }
      if (p.endsWith('/files/generateIds')) return res({ ids: Array.from({ length: Number(q.get('count')) || 10 }, () => 'g' + (++seq) + Math.random().toString(36).slice(2, 6)) });
      const up = p.includes('/upload/'), idm = p.match(/\/files\/([^/]+)$/), id = idm && idm[1];
      if (up && q.get('uploadType') === 'resumable') { const sid = 's' + (++seq); sessions.set(sid, { id, meta: JSON.parse(o.body) }); return res(null, 200, { Location: 'https://fake.upload/?sess=' + sid }); }
      if (up && failN > 0) { failN--; return res({ error: { message: '시험용 실패' } }, 500); }
      if (up) { const t = await o.body.text(), b = (o.headers['Content-Type'].match(/boundary=(\S+)/) || [])[1]; const parts = t.split('--' + b).slice(1, -1).map(x => x.replace(/^\r\n/, '').replace(/\r\n$/, '')); const meta = JSON.parse(parts[0].split('\r\n\r\n').slice(1).join('\r\n\r\n')); const data = parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n');
        let f = id ? F.get(id) : null; if (id && !f) return res({ error: { message: 'not found' } }, 404); if (!f) { if (meta.id && F.has(meta.id)) return res({ error: { message: 'exists' } }, 409); f = { id: meta.id || 'f' + (++seq) }; F.set(f.id, f); } apply(f, meta); f.data = data; return res(out(f)); }
      if (id && m === 'GET') { const f = F.get(id); if (!f) return res({ error: { message: 'not found' } }, 404); if (q.get('alt') === 'media') return new Response(f.data || '', { status: 200 }); return res(out(f)); }
      if (id && m === 'PATCH') { const f = F.get(id); if (!f) return res({ error: { message: 'not found' } }, 404); const meta = JSON.parse(o.body || '{}'); if (q.get('addParents')) f.parents = [q.get('addParents')]; apply(f, meta); return res(out(f)); }
      if (p.endsWith('/files') && m === 'POST') { const meta = JSON.parse(o.body); if (meta.id && F.has(meta.id)) return res({ error: { message: 'exists' } }, 409); const f = { id: meta.id || 'f' + (++seq) }; F.set(f.id, f); apply(f, meta); return res(out(f)); }
      if (p.endsWith('/files') && m === 'GET') { const qq = q.get('q') || ''; let L = [...F.values()].filter(f => f.id !== 'root' && !f.trashed); const nm = qq.match(/name='([^']+)'/); if (nm) L = L.filter(f => f.name === nm[1] && (!/'root' in parents/.test(qq) || (f.parents || []).includes('root'))); return res({ files: L.map(out) }); }
      return res({ error: { message: 'fake: ' + m + ' ' + p } }, 400);
    };
    return { files: F, calls: () => calls, fail: n => { failN = n; }, other: (id, text) => { const f = F.get(id); f.data = text; f.appProperties = Object.assign({}, f.appProperties, { lm: String(Date.now() + 99999) }); touch(f); } };
  }

  /* 로그인 창은 누른 순간에 열어야 크롬이 막지 않음 → 저장 설정·안내 창을 열 때 미리 불러 둠 */
  function preload() { if (S.fake) return; loadGIS().catch(() => {}); }
  return { connect, login, preload, diag, forget, pushAll, revive, reviveAsync, disconnect, status, onChange, flush, fresh: () => fresh(true), run: () => run(), load, ROOT_NAME, tokOK, _fake: fake, _S: S };
})();
