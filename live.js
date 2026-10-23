// 실시간 같이 편집: 같은 문서를 열어 둔 PC끼리 "요소 단위 변경"을 주고받음
// - 파일(구글 드라이브 동기화 폴더)은 지금처럼 진실의 원본. 여기서는 그림(data URL)·올린 글꼴을 보내지 않음
// - 통로 ① BroadcastChannel: 같은 브라우저의 탭끼리, 설정 없이 늘 켜짐(시험용·폴백)
//        ② Firebase Realtime Database(Spark 무료 플랜): 다른 PC와. 관장님이 설정 화면에서 Firebase 설정값을 붙여 넣고 Google 로그인
// - 같은 요소를 동시에 고치면 마지막 변경이 이김. Ctrl+Z는 내 변경만 되돌림(상대 변경은 그대로)
// - 접속한 PC 가운데 가장 먼저 들어온 PC만 파일에 저장하고, 나머지는 파일이 바뀌어도 충돌 창을 띄우지 않음
window.NC = window.NC || {};
NC.live = (function () {
  const KEY = 'naracal-live';            // 설정(localStorage; 동기화 폴더의 설정.naracha.json으로 다른 PC에도 넘어감)
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const SKIP = ['assets', 'fonts', 'name', 'docId', 'updatedAt', 'saveId', 'lineage', 'savedBy', 'pcId', 'savedAt', '_size', 'assetRefs'];  // 보내지 않는 문서 필드
  const COLORS = ['#e0564b', '#2f9e6b', '#d98b00', '#8a4fd1', '#1f9bd1', '#c2456b', '#5b7c2f'];
  const BIG = 2000, BIG_MARK = 'live:big';  // 이보다 긴 data: 문자열은 보내지 않고 표시만(파일에서 보충)
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const J = v => JSON.stringify(v);

  let api = null;                        // app.js가 넘겨주는 함수들 (attach)
  const me = { id: rid(), joined: Date.now() };
  let room = null;                       // { docId, bc, fb, peers: Map }
  let base = null;                       // 마지막으로 서로 맞춘 상태 (scan 결과)
  let rn = 0;                            // 받은 원격 변경 번호 (되돌리기 때 상대 변경을 빼는 데 씀)
  let remoteLog = [];                    // [{ n, keys }]
  let queue = [];                        // 편집·끌기 중에 받은 변경 (끝나면 적용)
  let queuedAt = 0;
  const seen = new Map();                // 메시지 id → 1 (중복 제거)
  let applying = false, lastLocal = 0, lastPres = '', tick = 0;
  const fb = { ready: false, loading: null, app: null, auth: null, db: null, D: null, A: null, user: null, connected: false, err: '' };
  const listeners = new Set();           // 상태가 바뀌면 부르는 함수들(설정 화면·상태 표시)

  /* ---------- 설정 ---------- */
  function cfg() { let c = null; try { c = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} if (!c || typeof c !== 'object') c = {}; if (c.on == null) c.on = true; if (!Array.isArray(c.emails)) c.emails = []; if (c.fb && typeof c.fb !== 'object') c.fb = null; return c; }
  function setCfg(patch) { const c = Object.assign(cfg(), patch); try { localStorage.setItem(KEY, J(c)); } catch (e) {} emit(); return c; }
  function emit() { listeners.forEach(f => { try { f(); } catch (e) {} }); }
  // Firebase 콘솔의 "구성(Config)" 글을 붙여 넣으면 { … } 부분만 읽음 (const firebaseConfig = { … }; 전체를 붙여도 됨)
  function parseFbConfig(text) {
    const m = String(text || '').match(/\{[\s\S]*\}/); if (!m) return null;
    let o = null; try { o = JSON.parse(m[0]); } catch (e) { try { o = Function('"use strict"; return (' + m[0] + ')')(); } catch (e2) { return null; } }
    if (!o || !o.apiKey || !o.projectId) return null;
    if (!o.databaseURL) o.databaseURL = `https://${o.projectId}-default-rtdb.firebaseio.com`;
    const keep = {}; ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId', 'storageBucket', 'messagingSenderId'].forEach(k => { if (o[k]) keep[k] = String(o[k]); });
    if (!keep.authDomain) keep.authDomain = keep.projectId + '.firebaseapp.com';
    return keep;
  }
  // Firebase 보안 규칙: 허용한 Google 계정만 읽기·쓰기
  function rulesText(emails) {
    const list = (emails || cfg().emails).map(e => String(e).trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+$/.test(e));
    const cond = list.length ? `auth != null && auth.token.email_verified == true && (${list.map(e => `auth.token.email == '${e}'`).join(' || ')})` : 'false';
    return JSON.stringify({ rules: { live: { '.read': cond, '.write': cond, '$doc': { ops: { '.indexOn': ['t'] }, inbox: { '$who': { '.indexOn': ['t'] } } } } } }, null, 2);
  }

  /* ---------- 문서 → 요소 단위 지도 ---------- */
  function pageAttrs(p) { const o = {}; for (const k in p) if (k !== 'els') o[k] = p[k]; return o; }
  function scan(d) {
    const v = { doc: new Map(), pageIds: [], pages: new Map() };
    for (const k in d) if (k !== 'pages' && !SKIP.includes(k)) v.doc.set(k, J(d[k]));
    (d.pages || []).forEach(p => { v.pageIds.push(p.id); const els = new Map(); (p.els || []).forEach(e => els.set(e.id, J(e))); v.pages.set(p.id, { attrs: J(pageAttrs(p)), ids: (p.els || []).map(e => e.id), els }); });
    return v;
  }
  // a → b 로 가는 변경 목록. a가 없으면 b 전체
  function diff(a, b, d) {
    const ops = [];
    const keys = new Set([...(a ? a.doc.keys() : []), ...b.doc.keys()]);
    for (const k of keys) { const va = a ? a.doc.get(k) : undefined, vb = b.doc.get(k); if (va !== vb) ops.push(vb === undefined ? { op: 'doc', k, del: true } : { op: 'doc', k, v: JSON.parse(vb) }); }
    if (a) a.pageIds.forEach(id => { if (!b.pages.has(id)) ops.push({ op: 'pageDel', pg: id }); });
    b.pageIds.forEach((id, i) => {
      const pb = b.pages.get(id), pa = a && a.pages.get(id);
      if (!pa) { const p = d.pages.find(x => x.id === id); ops.push({ op: 'pageAdd', pg: id, i, page: p }); return; }
      if (pa.attrs !== pb.attrs) ops.push({ op: 'page', pg: id, v: JSON.parse(pb.attrs) });
      pa.ids.forEach(eid => { if (!pb.els.has(eid)) ops.push({ op: 'del', pg: id, id: eid }); });
      let changed = false;
      pb.ids.forEach((eid, j) => { const sb = pb.els.get(eid), sa = pa.els.get(eid); if (sa !== sb) { ops.push({ op: 'set', pg: id, i: j, el: JSON.parse(sb) }); if (!sa) changed = true; } });
      if (J(pa.ids.filter(x => pb.els.has(x))) !== J(pb.ids.filter(x => pa.els.has(x))) || changed) ops.push({ op: 'order', pg: id, ids: pb.ids });
    });
    if (a && J(a.pageIds) !== J(b.pageIds)) ops.push({ op: 'pages', ids: b.pageIds });
    return ops;
  }
  const keyOf = op => op.op === 'doc' ? 'doc:' + op.k : op.op === 'pages' ? 'pages' : op.op === 'order' ? 'order:' + op.pg : op.op === 'set' ? op.pg + '/' + op.el.id : op.op === 'del' ? op.pg + '/' + op.id : 'page:' + op.pg;
  // 긴 data: 문자열(그림)을 표시로 바꿈 — Firebase로 보낼 때만
  function slim(v) { if (typeof v === 'string') return v.length > BIG && /^data:/.test(v) ? BIG_MARK : v; if (Array.isArray(v)) return v.map(slim); if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = slim(v[k]); return o; } return v; }
  // 표시로 온 값은 이쪽에 있던 값으로 채움. 채우지 못하면 true(파일에서 보충할 것)
  function unslim(v, old, miss) {
    if (v === BIG_MARK) { if (typeof old === 'string' && old !== BIG_MARK) return old; miss.v = true; return v; }
    if (Array.isArray(v)) return v.map((x, i) => unslim(x, Array.isArray(old) ? old[i] : undefined, miss));
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = unslim(v[k], old && typeof old === 'object' ? old[k] : undefined, miss); return o; }
    return v;
  }
  const hasBig = v => J(v).includes('"' + BIG_MARK + '"');
  const pending = new Set();  // 그림이 빠진 채 받은 요소 'pg/id' (파일이 오면 보충)

  /* ---------- 받은 변경을 문서에 적용 ---------- */
  function apply(ops, d) {
    const touched = [];   // [키, 바뀐 속성 목록(요소 전체면 null)]
    const pageOf = id => d.pages.find(p => p.id === id);
    for (const op of ops) {
      let attrs = null;
      try {
        if (op.op === 'doc') { if (op.del) delete d[op.k]; else d[op.k] = op.v; }
        else if (op.op === 'page') { const p = pageOf(op.pg); if (!p) continue; for (const k in p) if (k !== 'els') delete p[k]; Object.assign(p, op.v); }
        else if (op.op === 'pageAdd') { const miss = { v: false }; const page = unslim(op.page, pageOf(op.pg), miss); if (!Array.isArray(page.els)) page.els = []; const p = pageOf(op.pg); if (p) { Object.keys(p).forEach(k => delete p[k]); Object.assign(p, page); } else d.pages.splice(Math.min(op.i || 0, d.pages.length), 0, page); if (miss.v) page.els.forEach(e => pending.add(op.pg + '/' + e.id)); }
        else if (op.op === 'pageDel') { if (d.pages.length > 1) d.pages = d.pages.filter(p => p.id !== op.pg); }
        else if (op.op === 'pages') { const m = new Map(d.pages.map(p => [p.id, p])); const out = op.ids.map(id => m.get(id)).filter(Boolean); d.pages.forEach(p => { if (!op.ids.includes(p.id)) out.push(p); }); if (out.length) d.pages = out; }
        else if (op.op === 'set') { const p = pageOf(op.pg); if (!p) continue; const j = p.els.findIndex(e => e.id === op.el.id); const miss = { v: false }; const el = unslim(op.el, j >= 0 ? p.els[j] : undefined, miss); if (j >= 0) { const old = p.els[j]; attrs = []; for (const k of new Set([...Object.keys(old), ...Object.keys(el)])) if (J(old[k]) !== J(el[k])) attrs.push(k); p.els[j] = el; } else p.els.splice(Math.min(op.i || 0, p.els.length), 0, el); const k = op.pg + '/' + el.id; if (miss.v) pending.add(k); else pending.delete(k); }
        else if (op.op === 'del') { const p = pageOf(op.pg); if (!p) continue; p.els = p.els.filter(e => e.id !== op.id); pending.delete(op.pg + '/' + op.id); }
        else if (op.op === 'order') { const p = pageOf(op.pg); if (!p) continue; const m = new Map(p.els.map(e => [e.id, e])); const out = op.ids.map(id => m.get(id)).filter(Boolean); p.els.forEach(e => { if (!op.ids.includes(e.id)) out.push(e); }); p.els = out; }
        touched.push([keyOf(op), attrs]);
      } catch (e) { console.warn('실시간 변경 적용 실패', op, e); }
    }
    return touched;
  }
  // 편집·끌기 중이 아니면 바로, 아니면 잠시 뒤에
  function busy() { if (!api) return true; const s = api.state(); if (s.drag || s.editing) return true; const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('#inspector') && Date.now() - queuedAt < 3000) return true; return false; }
  function receiveOps(ops) { if (!ops || !ops.length) return; if (!queue.length) queuedAt = Date.now(); queue.push(...ops); flush(); }
  function flush() {
    if (!queue.length || !api || busy()) return;
    const ops = queue; queue = [];
    const d = api.doc();
    applying = true;
    try {
      const touched = apply(ops, d);
      rn++; remoteLog.push({ n: rn, keys: touched }); if (remoteLog.length > 600) remoteLog.shift();
      api.afterRemote();     // 쪽·선택 정리, 다시 그리기, 기록 고쳐 쓰기, 저장 예약
      base = scan(d);        // 다시 그리며 글 상자 높이가 맞춰진 뒤의 상태를 기준으로
    } finally { applying = false; }
    paint();
  }
  // 되돌리기·다시 실행: from → to 로 가되, 그 사이에 받은 상대 변경은 건드리지 않음
  function step(fromS, toS, fromMeta, toMeta) {
    const a = JSON.parse(fromS), b = JSON.parse(toS);
    const lo = Math.min(fromMeta.rn || 0, toMeta.rn || 0), hi = Math.max(fromMeta.rn || 0, toMeta.rn || 0);
    const excl = new Map();   // 키 → '*'(통째로) | Set(속성)
    remoteLog.forEach(r => { if (r.n > lo && r.n <= hi) r.keys.forEach(([k, attrs]) => { const cur = excl.get(k); if (!attrs || cur === '*') excl.set(k, '*'); else { const st = cur || new Set(); attrs.forEach(x => st.add(x)); excl.set(k, st); } }); });
    const d = api.doc(); const plain = [];
    for (const op of diff(scan(a), scan(b), b)) {
      const ex = excl.get(keyOf(op));
      if (!ex) { plain.push(op); continue; }
      if (ex === '*' || op.op !== 'set') continue;
      const p = d.pages.find(x => x.id === op.pg), cur = p && p.els.find(e => e.id === op.el.id); if (!cur) continue;
      const pa = a.pages.find(x => x.id === op.pg), ea = pa && pa.els.find(e => e.id === op.el.id) || {};
      for (const k of new Set([...Object.keys(ea), ...Object.keys(op.el)])) { if (ex.has(k) || J(ea[k]) === J(op.el[k])) continue; if (op.el[k] === undefined) delete cur[k]; else cur[k] = op.el[k]; }
    }
    apply(plain, d);
    return plain.length;
  }

  /* ---------- 보내기 ---------- */
  function changed() {
    if (!api || applying) return;
    const d = api.doc(); lastLocal = Date.now();
    if (!room || room.docId !== d.docId) return;
    const v = scan(d);
    const ops = base ? diff(base, v, d) : [];
    base = v;
    if (ops.length) send({ kind: 'ops', ops });
  }
  function send(msg, to) {
    msg = Object.assign({ id: rid(), from: me.id, pc: pcName(), joined: me.joined }, msg); if (to) msg.to = to;
    seen.set(msg.id, 1);
    if (room.bc) { try { room.bc.postMessage(msg); } catch (e) { console.warn('BroadcastChannel', e); } }
    if (room.fb) room.fb.send(msg, to);
  }
  function pcName() { return (NC.store && NC.store.pcName()) || 'PC'; }
  function onMessage(msg, via) {
    if (!msg || !room || msg.from === me.id || seen.has(msg.id)) return;
    if (msg.to && msg.to !== me.id) return;
    seen.set(msg.id, 1); if (seen.size > 3000) { const k = seen.keys().next().value; seen.delete(k); }
    if (msg.kind === 'ops') { receiveOps(msg.ops); touch(msg, null, via); }
    else if (msg.kind === 'presence') { touch(msg, msg.p, via); }
    else if (msg.kind === 'bye') { room.peers.delete(msg.from); emit(); paint(); checkSaver(); }
    else if (msg.kind === 'hello') { touch(msg, null, via); if (oldest() === me.id && api) { const d = api.doc(); send({ kind: 'state', pages: d.pages, doc: docFields(d) }, msg.from); } }
    else if (msg.kind === 'state') { if (!api) return; const d = api.doc(); const sd = Object.assign({}, msg.doc, { pages: msg.pages }); const ops = diff(scan(d), scan(sd), sd); if (ops.length) receiveOps(ops); }
  }
  function docFields(d) { const o = {}; for (const k in d) if (k !== 'pages' && !SKIP.includes(k)) o[k] = d[k]; return o; }
  // 접속자 기록. via: 'bc'(같은 브라우저) | 'fb'(Firebase) — 어느 통로로 마지막에 봤는지 남겨 끊김 판정에 씀
  function touch(msg, p, via) { let x = room.peers.get(msg.from); if (!x) { x = { id: msg.from, pc: msg.pc, joined: msg.joined || Date.now(), color: COLORS[room.peers.size % COLORS.length], bc: 0, fb: 0 }; room.peers.set(msg.from, x); emit(); checkSaver(); } x[via === 'fb' ? 'fb' : 'bc'] = Date.now(); x.pc = msg.pc || x.pc; if (p) { x.cur = p.cur; x.sel = p.sel || []; x.email = p.email || x.email; } paint(); }
  function prune() { if (!room) return; let ch = false; for (const [id, p] of room.peers) { const bcLive = p.bc && Date.now() - p.bc < 15000, fbLive = p.fb && (room.fb && fb.connected ? p.fbHere : Date.now() - p.fb < 60000); if (!bcLive && !fbLive) { room.peers.delete(id); ch = true; } } if (ch) { emit(); paint(); checkSaver(); } }
  // 가장 먼저 들어온 PC(파일 저장 담당·상태 보내기 담당)
  function oldest() { let best = me; for (const p of room.peers.values()) if (p.joined < best.joined || (p.joined === best.joined && p.id < best.id)) best = p; return best.id; }
  let wasSaver = true;
  function checkSaver() { const now = !deferSave(); if (now && !wasSaver && api) api.saveSoon(); wasSaver = now; }

  /* ---------- 방 들어가기·나가기 (문서 번호마다 하나) ---------- */
  function presence() { if (!api) return null; const s = api.state(); const d = api.doc(); return { cur: d.pages[s.cur] && d.pages[s.cur].id, sel: s.sel.slice(0, 20), email: fb.user ? fb.user.email : '' }; }
  function join(docId) {
    leave();
    const c = cfg(); if (!c.on || !docId) return;
    room = { docId, bc: null, fb: null, peers: new Map() };
    base = scan(api.doc()); remoteLog = []; queue = []; pending.clear(); lastPres = '';
    try { room.bc = new BroadcastChannel('naracal-live:' + docId); room.bc.onmessage = e => onMessage(e.data, 'bc'); } catch (e) {}
    if (fb.ready && fb.user) fbJoin(room);
    lastPres = ''; send({ kind: 'hello' });
    emit();
  }
  function leave() { if (!room) return; try { send({ kind: 'bye' }); } catch (e) {} if (room.bc) { try { room.bc.close(); } catch (e) {} } if (room.fb) room.fb.close(); room = null; base = null; queue = []; emit(); paint(); }
  addEventListener('pagehide', () => { try { leave(); } catch (e) {} });

  /* ---------- Firebase ---------- */
  async function loadFb() {
    const c = cfg(); if (!c.fb) return false;
    if (fb.loading) return fb.loading;
    fb.loading = (async () => {
      try {
        const [App, A, D] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-database.js')]);
        fb.app = App.getApps().find(a => a.name === 'naracal-live') || App.initializeApp(c.fb, 'naracal-live');
        fb.A = A; fb.D = D; fb.auth = A.getAuth(fb.app); fb.db = D.getDatabase(fb.app);
        A.onAuthStateChanged(fb.auth, u => { fb.user = u; fb.err = ''; emit(); if (room) { if (u && !room.fb) fbJoin(room); if (!u && room.fb) { room.fb.close(); room.fb = null; } } });
        try { const r = await A.getRedirectResult(fb.auth); if (r && r.user) fb.user = r.user; } catch (e) { fb.err = e.message; }
        D.onValue(D.ref(fb.db, '.info/connected'), s => { fb.connected = !!s.val(); emit(); });
        D.onValue(D.ref(fb.db, '.info/serverTimeOffset'), s => { fb.offset = s.val() || 0; });
        fb.ready = true; emit();
        return true;
      } catch (e) { fb.err = 'Firebase 불러오기 실패: ' + e.message; fb.loading = null; emit(); return false; }
    })();
    return fb.loading;
  }
  async function login() {
    if (!(await loadFb())) throw new Error(fb.err || 'Firebase 설정이 없습니다');
    const p = new fb.A.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await fb.A.signInWithPopup(fb.auth, p); }
    catch (e) { if (/popup-blocked|popup-closed|cancelled-popup|operation-not-supported/.test(e.code || '')) { await fb.A.signInWithRedirect(fb.auth, p); return; } throw e; }
  }
  async function logout() { if (fb.auth) await fb.A.signOut(fb.auth); }
  const now = () => Date.now() + (fb.offset || 0);
  function fbJoin(r) {
    const D = fb.D, db = fb.db, docId = r.docId, offs = [], timers = [];
    const P = `live/${docId}`;
    const myPres = D.ref(db, `${P}/presence/${me.id}`);
    const t = { send(msg, to) {
        const m = slim(Object.assign({}, msg, { t: D.serverTimestamp() }));
        const dest = to ? D.ref(db, `${P}/inbox/${to}`) : D.ref(db, `${P}/ops`);
        const ref = D.push(dest); D.set(ref, m).then(() => { timers.push(setTimeout(() => D.remove(ref).catch(() => {}), to ? 60000 : 25000)); }).catch(e => { fb.err = '보내기 실패: ' + (e.code || e.message); emit(); });
      },
      pres(p) { D.set(myPres, { pc: pcName(), joined: me.joined, p, t: D.serverTimestamp() }).catch(e => { fb.err = '접속 표시 실패: ' + (e.code || e.message); emit(); }); },
      close() { offs.forEach(f => { try { f(); } catch (e) {} }); timers.forEach(clearTimeout); D.remove(myPres).catch(() => {}); D.remove(D.ref(db, `${P}/inbox/${me.id}`)).catch(() => {}); } };
    r.fb = t;
    D.onDisconnect(myPres).remove();
    t.pres(presence());
    const from = now() - 3000;
    offs.push(D.onChildAdded(D.query(D.ref(db, `${P}/ops`), D.orderByChild('t'), D.startAt(from)), s => onMessage(s.val(), 'fb'), e => { fb.err = '읽기 실패(규칙·로그인 확인): ' + (e.code || e.message); emit(); }));
    offs.push(D.onChildAdded(D.query(D.ref(db, `${P}/inbox/${me.id}`), D.orderByChild('t'), D.startAt(from)), s => { onMessage(s.val(), 'fb'); D.remove(s.ref).catch(() => {}); }, () => {}));
    offs.push(D.onValue(D.ref(db, `${P}/presence`), s => {
      const v = s.val() || {};
      for (const [id, x] of Object.entries(v)) { if (id === me.id) continue; touch({ from: id, pc: x.pc, joined: x.joined }, x.p || {}, 'fb'); r.peers.get(id).fbHere = true; }
      for (const p of r.peers.values()) if (!v[p.id]) p.fbHere = false;
      prune(); emit(); paint(); checkSaver();
    }, () => {}));
    // 오래된 변경 치우기 (보낸 쪽이 지우지 못하고 나간 것)
    D.get(D.query(D.ref(db, `${P}/ops`), D.orderByChild('t'), D.endAt(now() - 180000))).then(s => { s.forEach(ch => { D.remove(ch.ref).catch(() => {}); }); }).catch(() => {});
    send({ kind: 'hello' });
  }

  /* ---------- 주기 점검: 방 바꾸기 · 접속 표시 · 미룬 변경 적용 ---------- */
  function sync() {
    if (!api) return;
    const d = api.doc(); const c = cfg();
    const want = c.on ? (d.docId || '') : '';
    if ((room ? room.docId : '') !== want) { if (want) join(want); else leave(); }
    if (!room) return;
    prune();
    const p = presence(); const ps = J(p); const chg = ps !== lastPres; tick++;
    if (chg || tick % 10 === 0) { lastPres = ps; if (room.bc) { const m = { id: rid(), from: me.id, pc: pcName(), joined: me.joined, kind: 'presence', p }; try { room.bc.postMessage(m); } catch (e) {} } }
    if (room.fb && (chg || tick % 40 === 0)) room.fb.pres(p);
    if (queue.length) flush();
    if (c.fb && !fb.ready && !fb.loading) loadFb();
  }
  setInterval(sync, 500);

  /* ---------- 파일과의 관계 ---------- */
  const peers = () => room ? room.peers.size : 0;
  // 다른 PC가 먼저 들어와 있으면 그쪽이 파일에 저장하므로 이 PC는 미룸
  function deferSave() { return !!(room && room.peers.size && oldest() !== me.id); }
  // 파일이 바뀌었을 때(다른 PC가 저장): 빠진 그림을 채우고, 내용이 같으면 "저장됨"으로
  function fromFile(j) {
    if (!api || !j) return false;
    const d = api.doc(); let got = false;
    if (j.assets) for (const k in j.assets) if (!d.assets[k]) { d.assets[k] = j.assets[k]; got = true; }
    if (pending.size && j.pages) { for (const key of Array.from(pending)) { const [pg, id] = key.split('/'); const fp = j.pages.find(p => p.id === pg), fe = fp && fp.els.find(e => e.id === id); const p = d.pages.find(p => p.id === pg); const i = p ? p.els.findIndex(e => e.id === id) : -1; if (fe && i >= 0 && !hasBig(fe)) { p.els[i] = JSON.parse(J(fe)); pending.delete(key); got = true; } } }
    const same = J(docFields(j)) === J(docFields(d)) && J(j.pages) === J(d.pages);
    if (!same && (j.savedAt || 0) > lastLocal + 2000 && Date.now() - lastLocal > 10000) { const sd = Object.assign({}, docFields(j), { pages: j.pages }); const ops = diff(scan(d), scan(sd), sd); if (ops.length) { receiveOps(ops); got = true; } }
    if (got) { base = scan(d); api.afterRemote(); }
    return same;
  }

  /* ---------- 화면 표시: 상단 접속 목록 + 다른 PC가 고르는 요소 ---------- */
  const css = `.livebar{display:inline-flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap}.livebar .lv{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:var(--ui-field,#f3f4f7);border:1px solid var(--ui-line,#dde1ea);cursor:pointer;color:var(--ui-fg,#222)}.livebar .lv i{width:8px;height:8px;border-radius:50%;background:var(--c,#2f9e6b);display:inline-block}.livebar .lv.off i{background:#bbb}.livebar .lv.err i{background:#e0564b}
.live-box{position:absolute;pointer-events:none;border:2px solid var(--c);border-radius:2px;box-sizing:border-box}.live-box b{position:absolute;left:-2px;top:-20px;font:600 11px/1 Pretendard,sans-serif;color:#fff;background:var(--c);padding:3px 6px;border-radius:4px;white-space:nowrap}
.live-rules{font:12px/1.5 ui-monospace,Menlo,monospace;background:#f6f7fa;border:1px solid #dde1ea;border-radius:6px;padding:8px;max-height:180px;overflow:auto;white-space:pre;user-select:all}`;
  function ensureUI() { if (document.getElementById('liveCss')) return; const s = document.createElement('style'); s.id = 'liveCss'; s.textContent = css; document.head.appendChild(s); const st = document.getElementById('status'); if (st && !document.getElementById('livebar')) { const b = document.createElement('span'); b.id = 'livebar'; b.className = 'livebar'; st.insertAdjacentElement('afterend', b); b.onclick = () => api && api.openSettings(); } }
  function statusText() {
    const c = cfg(); if (!c.on) return { t: '실시간 꺼짐', cls: 'off' };
    if (c.fb) { if (fb.err) return { t: '실시간 오류', cls: 'err', tip: fb.err }; if (!fb.ready) return { t: '실시간 준비 중', cls: 'off' }; if (!fb.user) return { t: '실시간: 로그인 필요', cls: 'off' }; if (!fb.connected) return { t: '실시간 연결 끊김', cls: 'off' }; return { t: '실시간 연결됨', cls: '', tip: fb.user.email }; }
    return { t: '실시간 (이 브라우저 탭끼리만)', cls: 'off', tip: 'Firebase를 설정하면 다른 PC와도 연결됩니다' };
  }
  function renderBar() {
    ensureUI(); const b = document.getElementById('livebar'); if (!b) return;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const s = statusText();
    const ps = room ? Array.from(room.peers.values()) : [];
    const show = ps.length || (cfg().fb && cfg().on);
    b.innerHTML = show ? `<span class="lv ${s.cls}" title="${esc(s.tip || s.t)}"><i></i>${esc(s.t)}${ps.length ? ` · 함께 ${ps.length}` : ''}</span>` + ps.map(p => `<span class="lv" style="--c:${p.color}" title="${esc(p.email || '')}"><i></i>${esc(p.pc)}${p.id === oldest() && p.id !== me.id ? ' (저장 담당)' : ''}</span>`).join('') : '';
  }
  listeners.add(renderBar);
  function paint() {
    const wrap = document.getElementById('canvasWrap'); if (!wrap) return;
    let layer = document.getElementById('liveLayer'); if (!layer) { layer = document.createElement('div'); layer.id = 'liveLayer'; layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible'; wrap.appendChild(layer); }
    const d = api && api.doc(); const s = api && api.state(); if (!room || !d || !s) { layer.innerHTML = ''; return; }
    const curId = d.pages[s.cur] && d.pages[s.cur].id; const canvas = document.getElementById('canvas'); const wr = wrap.getBoundingClientRect();
    let html = '';
    for (const p of room.peers.values()) { if (p.cur !== curId || !p.sel || !p.sel.length) continue; for (const id of p.sel) { const n = canvas && canvas.querySelector(`[data-id="${CSS.escape(id)}"]`); if (!n) continue; const r = n.getBoundingClientRect(); html += `<div class="live-box" style="--c:${p.color};left:${r.left - wr.left}px;top:${r.top - wr.top}px;width:${r.width}px;height:${r.height}px"><b>${String(p.pc).replace(/[&<>]/g, '')}</b></div>`; } }
    if (layer.innerHTML !== html) layer.innerHTML = html;
    renderBar();
  }
  setInterval(() => { if (room && room.peers.size) paint(); }, 400);

  /* ---------- 설정 화면 (저장·동기화 창 안) ---------- */
  function settingsHTML() {
    const c = cfg(); const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const s = statusText(); const ps = room ? Array.from(room.peers.values()) : [];
    return `<h3 style="margin-top:16px">실시간 같이 편집 <small style="font-weight:400;color:var(--ui-muted)">같은 문서를 연 PC끼리 바뀐 것을 바로 주고받기 (무료)</small></h3>
    <p><b>지금 상태:</b> ${esc(s.t)}${s.tip ? ` <small class="hint" style="margin:0">(${esc(s.tip)})</small>` : ''}${ps.length ? ` · 함께 보는 PC: ${ps.map(p => esc(p.pc)).join(', ')}` : ''}</p>
    <label class="f" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="lvOn" ${c.on ? 'checked' : ''}> 실시간 같이 편집 켜기</label>
    <div class="row" style="margin:8px 0">${c.fb ? `<button class="btn primary" id="lvLogin" ${fb.user ? 'hidden' : ''}>Google 로그인 (실시간 연결)</button><button class="btn" id="lvLogout" ${fb.user ? '' : 'hidden'}>로그아웃 (${esc(fb.user ? fb.user.email : '')})</button>` : ''}</div>
    <details id="lvSetup" ${c.fb ? '' : 'open'}><summary style="cursor:pointer;font-weight:600">다른 PC와 연결하기 — Firebase 설정 (처음 한 번, 관장님이 직접)</summary>
      <ol style="margin:8px 0 10px 18px;line-height:1.7">
        <li><a href="https://console.firebase.google.com/" target="_blank" rel="noopener">console.firebase.google.com</a>에 Google 계정으로 들어가 <b>프로젝트 추가</b> → 이름 <code>나라차공방</code> → Google 애널리틱스는 <b>끄고</b> 만들기.</li>
        <li>왼쪽 <b>빌드 → Realtime Database → 데이터베이스 만들기</b> → 위치 <code>asia-southeast1</code>(싱가포르) → <b>잠금 모드</b>로 시작.</li>
        <li>그 화면의 <b>규칙</b> 탭에 아래 "보안 규칙"을 그대로 붙여 넣고 <b>게시</b>. (규칙은 아래 허용 계정 목록에서 만들어집니다)</li>
        <li><b>빌드 → Authentication → 시작하기 → 로그인 방법 → Google</b> 사용 설정 → 저장. 같은 화면 <b>설정 → 승인된 도메인</b>에 <code>narachadata.github.io</code> 추가.</li>
        <li>왼쪽 위 톱니 <b>프로젝트 설정 → 내 앱 → 웹 앱 추가(&lt;/&gt;)</b> → 별명 <code>공방</code> → 등록 → "SDK 설정 및 구성"의 <b>구성(Config)</b> 글 전체를 복사해 아래 칸에 붙여 넣고 <b>설정 저장</b>.</li>
        <li>위 <b>Google 로그인</b>을 누릅니다. 다른 PC는 동기화 폴더로 설정이 넘어가므로 로그인만 하면 됩니다.</li>
      </ol>
      <label class="f"><span>허용할 Google 계정 (한 줄에 하나, 2~3개) — 이 계정으로 로그인한 PC만 읽고 쓸 수 있습니다</span><textarea id="lvEmails" rows="3" style="font-family:inherit" placeholder="example@gmail.com">${esc(c.emails.join('\n'))}</textarea></label>
      <label class="f" style="margin-top:8px"><span>Firebase 구성(Config) — <code>const firebaseConfig = { … }</code> 전체를 붙여 넣어도 됩니다</span><textarea id="lvCfg" rows="5" style="font-family:ui-monospace,Menlo,monospace;font-size:12px" placeholder='{ "apiKey": "…", "authDomain": "…", "databaseURL": "…", "projectId": "…", "appId": "…" }'>${esc(c.fb ? JSON.stringify(c.fb, null, 1) : '')}</textarea></label>
      <div class="row" style="margin:8px 0"><button class="btn primary" id="lvSaveCfg">설정 저장</button><button class="btn danger" id="lvClearCfg" ${c.fb ? '' : 'hidden'}>Firebase 설정 지우기</button></div>
      <p style="margin:10px 0 4px"><b>보안 규칙</b> (복사해 Firebase 규칙 탭에 붙여 넣기 — 계정 목록을 바꾸면 다시 붙여 넣어야 합니다) <button class="btn sm" id="lvCopyRules">규칙 복사</button></p>
      <pre class="live-rules" id="lvRules">${esc(rulesText())}</pre>
      <p class="hint">비용: Firebase Spark(무료) 플랜으로 충분합니다. 큰 그림은 보내지 않고 파일(구글 드라이브)로만 전해집니다. 설정값은 비밀이 아니지만, 위 규칙 덕분에 허용한 계정만 접근합니다.</p>
    </details>`;
  }
  function bindSettings(root, rerender) {
    const $ = s => root.querySelector(s); const toast = (m, e) => (api && api.toast ? api.toast(m, e) : alert(m));
    const on = (s, f) => { const b = $(s); if (b) b.onclick = async () => { try { await f(); } catch (e) { toast(e.message, true); } }; };
    const chk = $('#lvOn'); if (chk) chk.onchange = () => { setCfg({ on: chk.checked }); sync(); rerender(); };
    const em = $('#lvEmails'); if (em) em.oninput = () => { const r = $('#lvRules'); if (r) r.textContent = rulesText(em.value.split(/\n|,/).map(x => x.trim()).filter(Boolean)); };
    on('#lvSaveCfg', async () => { const emails = $('#lvEmails').value.split(/\n|,/).map(x => x.trim().toLowerCase()).filter(Boolean); const txt = $('#lvCfg').value.trim(); const f = txt ? parseFbConfig(txt) : null; if (txt && !f) throw new Error('Firebase 구성을 읽지 못했습니다. 콘솔의 구성(Config) 글을 그대로 붙여 넣어 주세요'); setCfg({ emails, fb: f }); if (f) { fb.loading = null; fb.ready = false; await loadFb(); } toast('실시간 설정을 저장했습니다' + (f && !fb.user ? ' — 이제 Google 로그인을 눌러 주세요' : '')); rerender(); });
    on('#lvClearCfg', async () => { if (!confirm('이 PC의 Firebase 설정을 지울까요? (다른 PC에는 동기화 폴더로 다시 넘어올 수 있습니다)')) return; try { await logout(); } catch (e) {} setCfg({ fb: null }); rerender(); });
    on('#lvCopyRules', async () => { await navigator.clipboard.writeText($('#lvRules').textContent); toast('보안 규칙을 복사했습니다. Firebase 규칙 탭에 붙여 넣고 "게시"를 누르세요'); });
    on('#lvLogin', async () => { await login(); toast('로그인했습니다'); rerender(); });
    on('#lvLogout', async () => { await logout(); rerender(); });
  }

  function attach(a) { api = a; ensureUI(); if (cfg().fb) loadFb(); sync(); }
  return { attach, changed, step, peers, deferSave, fromFile, paint, settingsHTML, bindSettings, cfg, setCfg, rulesText, parseFbConfig, login, logout, onChange: f => listeners.add(f), get rn() { return rn; }, active: () => !!room, me, debug: () => ({ room: room && { docId: room.docId, peers: Array.from(room.peers.values()), fb: !!room.fb }, fb: { ready: fb.ready, user: fb.user && fb.user.email, connected: fb.connected, err: fb.err }, pending: Array.from(pending), rn, queue: queue.length }) };
})();
