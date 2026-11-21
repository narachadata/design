// 도서 편집 (팀장님 11/21 「영상 바로 위에 도서 편집 메뉴 — 인디자인·쿽익스프레스 방식의 책 만들기」)
// 조사(인디자인·쿽 매뉴얼, 한국 책 관행 W3C klreq·인쇄소 안내)를 바탕으로 초보용으로 줄인 설계:
//   새 책 마법사(판형·여백·단·본문 글꼴) → 원고 한 덩어리(쿽 Automatic Text Box·인디자인 스마트 리플로처럼 쪽이 저절로 늘고 줆)
//   → 단락 스타일(장·절·소제목·본문·인용·목록…) → 머리글 변수(왼쪽 쪽 책 제목 · 오른쪽 쪽 장 제목) · 자동 쪽 번호
//   → 장은 오른쪽(홀수) 쪽에서 시작, 그때 생기는 빈 쪽은 번호·머리글 없음 → 차례 자동(점선·쪽 번호, 원고를 고치면 함께 새로 고침)
//   → 점검(넘친 글·쪽 수·안전 여백·그림 해상도·도련) → 인쇄소용 PDF(도련·재단선)·펼침면 보기·중철 소책자
// 데이터: doc.book(앱의 책자 설정에 bookMode·title·author·headL·headR·rule·cols… 더함), doc.bstyles(단락 스타일 — 글 상자 문단 스타일 doc.pstyles와 다름), doc.bstory.md(원고)
//   흘려 만든 쪽: pg.flow(본문)·pg.toc(차례)·pg.blank(장 앞 빈 쪽)·pg.chap(그 쪽 장 제목)·pg.chapOpen(장 시작 쪽)
//   본문 상자: el.flowFrame('body'|'toc')·el.locked — 고칠 때는 두 번 눌러 원고 편집기에서 (인디자인 스토리 편집기)
(function () {
  'use strict';
  window.NC = window.NC || {};
  NC.bookMod = function (A) {
    const esc = A.esc, MM = A.MM, $ = s => document.querySelector(s);
    const r1 = v => Math.round(v * 10) / 10, PT = 25.4 / 72;

    /* ---------- 판형·책 종류 ---------- */
    const TRIMS = [['sinkuk', '신국판', 152, 225, '단행본·문집 (가장 흔함)'], ['kuk', '국판 (A5)', 148, 210, '안내 책자·소설'], ['46', '46판', 128, 188, '작은 책·시집'], ['crown', '크라운판', 176, 248, '교재·사진 많은 책'], ['b5', 'B5 (46배판)', 182, 257, '교재·문제집'], ['a4', 'A4 (국배판)', 210, 297, '큰 교재·자료집'], ['custom', '직접 입력', 0, 0, '인쇄소가 알려 준 치수']];
    const KINDS = {
      general: { name: '일반 책', sub: '단행본·문집·수필집', trim: 'sinkuk', font: 'Noto Serif KR', size: 10, lh: 1.7, cols: 1, head: 'Pretendard', bind: 'perfect', sample: true },
      edu: { name: '인성 교재·수련 교본', sub: '어린이 눈높이 — 큰 글자', trim: 'crown', font: 'Noto Sans KR', size: 12, lh: 1.75, cols: 1, head: 'Pretendard', bind: 'perfect', sample: true, accent: '#1E3A8A' },
      booklet: { name: '소식·안내 책자', sub: '중철(스테이플) 소책자', trim: 'kuk', font: 'Pretendard', size: 10, lh: 1.65, cols: 1, head: 'Pretendard', bind: 'saddle', sample: true },
      big: { name: '큰 교재 (2단)', sub: 'A4 두 단 — 자료집', trim: 'a4', font: 'Noto Serif KR', size: 10, lh: 1.65, cols: 2, head: 'Pretendard', bind: 'perfect', sample: true },
    };
    /* 여백: 신국판 위 20·아래 25·안쪽 22·바깥 18mm(판면 112×180)을 기준 비율로, 교재는 조금 좁게 (조사 보고 11/21) */
    function marginsFor(w, h, kind) {
      const c = (v, a, b) => Math.round(Math.min(b, Math.max(a, v)) * 2) / 2;
      if (kind === 'edu') return { top: c(h * 0.075, 15, 22), bottom: c(h * 0.09, 18, 26), inner: c(w * 0.125, 18, 26), outer: c(w * 0.088, 13, 20) };
      return { top: c(h * 0.089, 15, 26), bottom: c(h * 0.111, 18, 30), inner: c(w * 0.145, 17, 28), outer: c(w * 0.118, 13, 22) };
    }

    /* ---------- 단락 스타일 (인디자인 단락 스타일 · 쿽 스타일 시트) — 크기 pt, 간격·들여쓰기 mm, 첫 줄 들여쓰기는 글자(em) ---------- */
    const PS_ORDER = ['h1', 'h2', 'h3', 'body', 'quote', 'list', 'center', 'small', 'tocTitle', 'toc1', 'toc2'];
    const PS_NAME = { h1: '장 제목', h2: '절 제목', h3: '소제목', body: '본문', quote: '인용', list: '목록', center: '가운데', small: '작은 글·캡션', tocTitle: '차례 제목', toc1: '차례 — 장', toc2: '차례 — 절' };
    const PS_MARK = { h1: '# ', h2: '## ', h3: '### ', body: '', quote: '> ', list: '- ', center: '[가운데] ', small: '[작은글] ' };
    function psDefaults(k) {
      const K = KINDS[k] || KINDS.general, f = K.font, z = K.size, hf = K.head, ac = K.accent || '#1a1a1a', S = {
        h1: { font: hf, size: Math.round(z * 2.2), weight: 800, lh: 1.3, align: 'left', indent: 0, indentL: 0, before: 0, after: 10, color: ac, ls: -0.02, start: 'right', sink: 26, keepNext: true },
        h2: { font: hf, size: Math.round(z * 1.4 * 2) / 2, weight: 700, lh: 1.4, align: 'left', indent: 0, indentL: 0, before: 7, after: 3, color: ac, ls: -0.01, keepNext: true },
        h3: { font: hf, size: Math.round(z * 1.12 * 2) / 2, weight: 700, lh: 1.5, align: 'left', indent: 0, indentL: 0, before: 4, after: 1.5, color: '#222222', ls: 0, keepNext: true },
        body: { font: f, size: z, weight: 400, lh: K.lh, align: 'justify', indent: 1, indentL: 0, before: 0, after: 0, color: '#222222', ls: -0.02 },
        quote: { font: 'Gowun Batang', size: Math.round(z * 0.95 * 2) / 2, weight: 400, lh: K.lh, align: 'left', indent: 0, indentL: 6, before: 3, after: 3, color: '#555555', ls: -0.01 },
        list: { font: f, size: z, weight: 400, lh: K.lh, align: 'left', indent: -1, indentL: 5, before: 0.5, after: 0.5, color: '#222222', ls: -0.02 },
        center: { font: f, size: z, weight: 400, lh: K.lh, align: 'center', indent: 0, indentL: 0, before: 2, after: 2, color: '#222222', ls: -0.02 },
        small: { font: f, size: Math.round(z * 0.85 * 2) / 2, weight: 400, lh: 1.6, align: 'left', indent: 0, indentL: 0, before: 1, after: 1, color: '#666666', ls: 0 },
        tocTitle: { font: hf, size: Math.round(z * 2), weight: 800, lh: 1.3, align: 'left', indent: 0, indentL: 0, before: 0, after: 12, color: ac, ls: -0.02, sink: 10 },
        toc1: { font: hf, size: Math.round(z * 1.1 * 2) / 2, weight: 700, lh: 1.5, align: 'left', indent: 0, indentL: 0, before: 3, after: 0.5, color: '#1a1a1a', ls: 0 },
        toc2: { font: hf, size: z, weight: 400, lh: 1.5, align: 'left', indent: 0, indentL: 5, before: 0.5, after: 0.5, color: '#444444', ls: 0 },
      }; return S;
    }
    function ps() { const d = A.doc; if (d.pstyles && !Array.isArray(d.pstyles)) { d.bstyles = d.pstyles; delete d.pstyles; } /* 11/21 첫 시험판이 글 상자 문단 스타일(doc.pstyles 목록)과 같은 이름을 썼던 것 바로잡기 */ if (!d.bstyles) d.bstyles = psDefaults((d.book && d.book.kind) || 'general'); const D = psDefaults((d.book && d.book.kind) || 'general'), o = {}; PS_ORDER.forEach(k => { o[k] = Object.assign({}, D[k], d.bstyles[k] || {}); }); return o; }
    const isBook = () => !!(A.doc && A.doc.book && A.doc.book.bookMode);
    const B_ = () => A.book();

    /* ---------- 원고 읽기: 한 줄 = 한 단락 (워드·한글에서 Enter 한 번이 한 단락인 것과 같게) ----------
       # 장 · ## 절 · ### 소제목 · > 인용 · - 목록 · [가운데] · [작은글] · [쪽 나눔] · **굵게** */
    function runsOf(t) { const runs = [], re = /\*\*(.+?)\*\*/g; let i = 0, m; while ((m = re.exec(t))) { if (m.index > i) runs.push({ t: t.slice(i, m.index) }); runs.push({ t: m[1], b: 1 }); i = re.lastIndex; } if (i < t.length) runs.push({ t: t.slice(i) }); return runs.length ? runs : [{ t: '' }]; }
    const plainOf = runs => runs.map(r => r.t).join('');
    function sliceRuns(runs, a, b) { const out = []; let pos = 0; for (const r of runs) { const s = pos, e = pos + r.t.length; pos = e; const x = Math.max(a, s), y = Math.min(b, e); if (y > x) out.push(Object.assign({}, r, { t: r.t.slice(x - s, y - s) })); } return out; }
    const runsHTML = runs => runs.map(r => r.b ? `<b>${esc(r.t)}</b>` : esc(r.t)).join('');
    function parse(md) {
      const out = []; String(md || '').replace(/\r/g, '').split('\n').forEach((raw, line) => {
        const s = raw.trim(); if (!s) return;
        if (/^\[\s*쪽\s*나눔\s*\]$/.test(s)) { out.push({ st: 'break', line }); return; }
        let st = 'body', t = s, m;
        if ((m = s.match(/^###\s*(.*)$/))) { st = 'h3'; t = m[1]; } else if ((m = s.match(/^##\s*(.*)$/))) { st = 'h2'; t = m[1]; } else if ((m = s.match(/^#\s*(.*)$/))) { st = 'h1'; t = m[1]; }
        else if ((m = s.match(/^>\s?(.*)$/))) { st = 'quote'; t = m[1]; } else if ((m = s.match(/^[-*•·]\s+(.*)$/))) { st = 'list'; t = '• ' + m[1]; }
        else if ((m = s.match(/^\[가운데\]\s*(.*)$/))) { st = 'center'; t = m[1]; } else if ((m = s.match(/^\[작은\s?글\]\s*(.*)$/))) { st = 'small'; t = m[1]; }
        const runs = runsOf(t); out.push({ st, runs, plain: plainOf(runs), line });
      }); return out;
    }

    /* ---------- 단락 → HTML (인라인 스타일만 써서 PNG·PDF 내보내기에도 그대로) ---------- */
    function pHTML(runs, s, o) {
      o = o || {}; const top = o.first ? (o.sink || 0) : (s.before || 0), ind = o.cont || o.noIndent ? (s.indent < 0 ? s.indent : 0) : (s.indent || 0);
      const lead = o.cont && s.indent < 0 ? 0 : ind; /* 목록 다음 줄(이어진 조각)은 매달린 들여쓰기 없이 */
      const css = `margin:0;padding:${r1(top)}mm 0 ${r1(s.after || 0)}mm ${r1((s.indentL || 0))}mm;text-indent:${lead}em;font-family:'${s.font}','Noto Serif KR','Noto Sans KR',serif;font-size:${s.size}pt;line-height:${s.lh};font-weight:${s.weight};color:${s.color};text-align:${s.align};${o.splitEnd && s.align === 'justify' ? 'text-align-last:justify;' : ''}letter-spacing:${s.ls || 0}em;word-break:${s.brk === 'char' ? 'normal' : 'keep-all'};overflow-wrap:anywhere;line-break:strict;`;  /* 한글 줄바꿈: 어절(기본) · 글자 (W3C klreq — 단락마다 고름) */
      if (o.toc) return `<p style="${css}display:flex;align-items:baseline;gap:1.5mm;text-indent:0"><span style="flex:0 1 auto">${runsHTML(runs)}</span><span style="flex:1 1 auto;border-bottom:0.3mm dotted ${s.color};opacity:.55;transform:translateY(-0.8mm)"></span><span style="flex:0 0 auto;font-variant-numeric:tabular-nums">${esc(o.toc)}</span></p>`;
      return `<p style="${css}">${runsHTML(runs)}</p>`;
    }

    /* ---------- 판면(본문 상자 자리): 펼침면이면 홀수·짝수 쪽마다 안쪽·바깥쪽 여백을 뒤집음 ---------- */
    function frameRects(abs) {
      const B = B_(), d = A.doc, right = A.isRightPage(abs), L = right ? B.mg.inner : B.mg.outer, R = right ? B.mg.outer : B.mg.inner, T = B.mg.top, H = d.h - T - B.mg.bottom;
      const W = d.w - L - R, cols = Math.max(1, Number(B.cols) || 1), g = Number(B.gutter) || 5, cw = (W - g * (cols - 1)) / cols;
      return Array.from({ length: cols }, (_, c) => ({ x: r1(L + c * (cw + g)), y: r1(T), w: r1(cw), h: r1(H) }));
    }

    /* ---------- 재기: 화면 밖 상자에 단락을 넣어 높이를 잼 (편집 화면과 같은 글 상자 CSS) ---------- */
    let MB = null;
    function mbox(w) { if (!MB) { MB = document.createElement('div'); MB.className = 'el el-text'; MB.setAttribute('aria-hidden', 'true'); MB.style.cssText = 'position:absolute;left:-30000px;top:0;visibility:hidden;'; document.body.appendChild(MB); } MB.style.width = w + 'mm'; return MB; }
    function hOf(html, lastAfter) { MB.innerHTML = html; return MB.offsetHeight / MM - (lastAfter || 0); }
    async function loadFonts(S) {
      const fams = [...new Set(Object.values(S).map(s => s.font))];
      try { await A.ensureLibFonts([{ els: fams.map(f => ({ type: 'text', font: f, text: '가' })) }]); } catch (e) {}
      try { await Promise.all(fams.flatMap(f => [400, 700].map(w => document.fonts.load(`${w} 12pt "${f}"`, '가나다 ABC 123')))); await document.fonts.ready; } catch (e) {}
    }

    /* ---------- 흘리기 엔진: 단락을 판면 상자에 차례로 채우고, 넘치면 다음 단·다음 쪽 (쪽은 필요한 만큼 만들어짐) ---------- */
    function layoutStream(paras, abs0, S, kind, extras) {
      const pages = [], heads = []; let pg = null, frames = [], fi = 0, content = [], plain = [], lastAfter = 0, chap = '', firstLine = -1, overflow = 0;
      const absNow = () => abs0 + pages.length - 1, fr = () => frames[fi];
      const startFrame = () => { content = []; plain = []; lastAfter = 0; firstLine = -1; if (fr()) mbox(fr().w); };
      const closeFrame = () => { if (!content.length || !fr()) return; const f = fr(), txt = plain.join('\n'); pg.els.push(Object.assign({}, A.TEXT_DEF, { id: A.uid(), x: f.x, y: f.y, w: f.w, h: f.h, sizing: 'fixed', text: txt, html: content.join(''), htmlFor: txt, font: S.body.font, size: S.body.size, lh: S.body.lh, color: S.body.color, align: 'left', ls: 0, flowFrame: kind, flowLine: firstLine, locked: true, name: kind === 'toc' ? '차례 (자동)' : '본문 (원고 — 두 번 눌러 고치기)' })); };
      const newPg = () => { pg = A.newPage(); pg.label = ''; if (kind === 'toc') pg.toc = true; else pg.flow = true; pg.chap = chap; const ex = extras && extras.length ? extras.shift() : null; if (ex && ex.length) pg.els.push(...ex); pages.push(pg); frames = frameRects(absNow()); fi = 0; startFrame(); };
      const blankPg = () => { pg.blank = true; pg.flow = kind !== 'toc'; frames = []; newPg(); };
      const nextFrame = () => { closeFrame(); fi++; if (fi >= frames.length) newPg(); else startFrame(); };
      const fits = (html, after, maxH) => hOf(content.join('') + html, after) <= (maxH != null ? maxH : fr().h) + 0.05;
      const lineMM = s => s.size * s.lh * PT;
      const pageEmpty = () => fi === 0 && !content.length && !pg.els.some(e => e.flowFrame);
      newPg();
      for (let n = 0; n < paras.length; n++) {
        const p = paras[n];
        if (p.st === 'break') { if (!pageEmpty()) { closeFrame(); newPg(); } continue; }
        const s = S[p.st] || S.body; let runs = p.runs, cont = false, sink = 0;
        const prev = paras[n - 1], noIndent = p.st === 'body' && (!prev || /^h\d$/.test(prev.st) || prev.st === 'break' || prev.st === 'tocTitle');
        if (s.start && s.start !== 'none' && kind === 'body') { /* 장 시작: 새 쪽 — 오른쪽(홀수) 쪽이 아니면 빈 쪽 하나 */
          if (!pageEmpty()) { closeFrame(); newPg(); }
          if (s.start === 'right' && A.book().facing && !A.isRightPage(absNow())) blankPg();
          chap = p.plain; pg.chap = chap; pg.chapOpen = true; pg.label = chap; sink = Number(s.sink) || 0;
        } else if (s.sink && pageEmpty()) sink = Number(s.sink) || 0;
        if (p.st === 'h1' && kind === 'body' && !(s.start && s.start !== 'none')) { chap = p.plain; if (pageEmpty()) { pg.chap = chap; pg.label = chap; } }
        let guard = 0;
        while (runs && guard++ < 400) {
          const first = !content.length, o = { first, cont, noIndent, sink: first ? sink : 0, toc: p.toc };
          const html = pHTML(runs, s, o);
          if (fits(html, s.after)) {
            /* 제목은 다음 단락 첫머리와 함께 (다음 줄과 함께 — 쪽 끝에 제목만 남지 않게) */
            const nx = paras[n + 1];
            if (s.keepNext && nx && nx.st !== 'break' && !first) { /* 제목 아래에 다음 단락이 적어도 2줄(짧으면 통째로) 들어갈 자리가 있어야 함 — 없으면 제목도 다음 쪽으로 */
              const s2 = S[nx.st] || S.body, nxH = hOf(pHTML(nx.runs, s2, {}), s2.after), need = Math.min(nxH, 2 * lineMM(s2) + (s2.before || 0)) - 0.3;
              const remain = fr().h - hOf(content.join('') + html, 0); if (!/^h\d$/.test(nx.st) && remain < need) { nextFrame(); continue; } }
            content.push(html); plain.push(plainOf(runs)); lastAfter = s.after || 0; if (firstLine < 0) firstLine = p.line; runs = null; break;
          }
          const splittable = !/^h\d$/.test(p.st) && !p.toc && p.st !== 'tocTitle';
          if (splittable) {
            const txt = plainOf(runs), cands = []; for (let k = 1; k < txt.length; k++) if (s.brk === 'char' ? txt[k] !== ' ' : (txt[k - 1] === ' ' || txt[k - 1] === '\n')) cands.push(k);
            const tryK = (k, maxH) => fits(pHTML(sliceRuns(runs, 0, k), s, Object.assign({}, o, { splitEnd: true })), 0, maxH);
            const best = (list, maxH) => { let lo = 0, hi = list.length - 1, b = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (tryK(list[mid], maxH)) { b = mid; lo = mid + 1; } else hi = mid - 1; } return b < 0 ? 0 : list[b]; };
            let k = best(cands); if (!k && first) { const all = Array.from({ length: txt.length - 1 }, (_, i) => i + 1); k = best(all); } /* 띄어쓰기 없는 긴 글은 글자 단위로 */
            if (k) {
              const L = lineMM(s), base = hOf(content.join(''), 0), partH = () => hOf(content.join('') + pHTML(sliceRuns(runs, 0, k), s, Object.assign({}, o, { splitEnd: true })), 0) - base;
              let lines = Math.round(partH() / L);
              if (lines < 2 && !first) { nextFrame(); continue; } /* 외톨이 줄: 쪽 끝에 한 줄만 남기지 않음 */
              const restLines = Math.round((hOf(pHTML(sliceRuns(runs, k, txt.length), s, { cont: true }), 0)) / L); MB.innerHTML = '';
              if (restLines === 1 && lines > 2) { const k2 = best(cands.filter(c => c < k), fr().h - L); if (k2) k = k2; } /* 과부 줄: 다음 쪽 첫머리에 한 줄만 가지 않게 */
              content.push(pHTML(sliceRuns(runs, 0, k), s, Object.assign({}, o, { splitEnd: true }))); plain.push(plainOf(sliceRuns(runs, 0, k)).trimEnd()); if (firstLine < 0) firstLine = p.line;
              runs = sliceRuns(runs, k, txt.length); if (runs.length && runs[0].t) runs[0] = Object.assign({}, runs[0], { t: runs[0].t.replace(/^\s+/, '') }); cont = true; sink = 0; nextFrame(); continue;
            }
          }
          if (first) { content.push(html); plain.push(plainOf(runs)); overflow++; if (firstLine < 0) firstLine = p.line; runs = null; break; } /* 빈 상자에도 안 들어가는 큰 제목 — 넘친 채로 두고 점검에 표시 */
          nextFrame();
        }
        if (/^h[123]$/.test(p.st) && kind === 'body') heads.push({ st: p.st, text: p.plain, abs: absNow() });
      }
      closeFrame();
      /* 끝의 빈 쪽 정리 (본문 상자도 직접 넣은 요소도 없으면) */
      while (pages.length > 1 && !pages[pages.length - 1].els.length) pages.pop();
      return { pages, heads, overflow };
    }

    /* ---------- 흘리기: 본문 → 차례(쪽 번호가 바뀌면 한 번 더) ---------- */
    let flowing = false, flowAgain = false;
    async function flow(opt) {
      opt = opt || {}; const d = A.doc; if (!isBook() || !d.bstory) return null;
      if (flowing) { flowAgain = true; return null; } flowing = true;
      try {
        A.endEdit(); const S = ps(); A.setStatus('원고를 흘려 넣는 중…'); await loadFonts(S);
        const paras = parse(d.bstory.md), keepCur = A.page(), curFlowIdx = keepCur && (keepCur.flow || keepCur.toc) ? d.pages.filter(p => p.flow).indexOf(keepCur) : -1;
        /* 흘려 만든 쪽에 직접 얹은 요소(사진 등)는 같은 순번 쪽에 다시 얹음 */
        const extras = d.pages.filter(p => p.flow && !p.blank).map(p => p.els.filter(e => !e.flowFrame));
        let res = null, toc = null;
        for (let pass = 0; pass < 3; pass++) {
          d.pages = d.pages.filter(p => !p.flow);
          let i0 = d.pages.findIndex(p => p.back); if (i0 < 0) i0 = d.pages.length;
          res = layoutStream(paras, i0, S, 'body', extras.map(x => x.slice()));
          d.pages.splice(i0, 0, ...res.pages);
          toc = updateToc(res.heads, S); if (!toc || !toc.changed) break;
        }
        d.book.flowStamp = hashOf(d.bstory.md + JSON.stringify(S) + JSON.stringify([B_().mg, B_().cols, B_().gutter, d.w, d.h, B_().facing]));
        d.book.lastFlow = { pages: res.pages.length, heads: res.heads.length, overflow: res.overflow, paras: paras.length, chars: paras.reduce((a, p) => a + (p.plain || '').length, 0) };
        A.commit();
        if (curFlowIdx >= 0) { const fl = d.pages.filter(p => p.flow); const tgt = fl[Math.min(curFlowIdx, fl.length - 1)]; if (tgt) A.setCur(d.pages.indexOf(tgt)); }
        else if (keepCur && d.pages.includes(keepCur)) A.setCur(d.pages.indexOf(keepCur)); else A.setCur(Math.min(A.cur, d.pages.length - 1));
        A.renderAll(); A.setStatus('');
        if (!opt.quiet) A.toast(`원고를 흘려 넣었습니다 — 본문 ${res.pages.length}쪽${res.heads.length ? ` · 제목 ${res.heads.length}개` : ''}${toc && toc.n ? ` · 차례 ${toc.n}줄` : ''}${res.overflow ? ` · 넘친 글 ${res.overflow}곳(점검 보기)` : ''}`);
        return res;
      } catch (e) { console.error(e); A.toast('흘려 넣지 못했습니다: ' + e.message, true); A.setStatus(''); return null; }
      finally { flowing = false; if (flowAgain) { flowAgain = false; setTimeout(() => flow({ quiet: true }), 50); } }
    }
    const hashOf = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
    let flowT = 0; const flowSoon = (ms) => { clearTimeout(flowT); flowT = setTimeout(() => flow({ quiet: true }), ms || 500); };
    const stale = () => isBook() && A.doc.bstory && A.doc.book.flowStamp !== hashOf(A.doc.bstory.md + JSON.stringify(ps()) + JSON.stringify([B_().mg, B_().cols, B_().gutter, A.doc.w, A.doc.h, B_().facing]));

    /* ---------- 차례: 장·절 제목과 쪽 번호로 차례 쪽(pg.toc)을 다시 채움 (인디자인 '목차 업데이트'를 흘릴 때마다 저절로) ---------- */
    function updateToc(heads, S) {
      const d = A.doc, B = B_(); const t0 = d.pages.findIndex(p => p.toc); if (t0 < 0) return null;
      const lv = B.tocLevel || 2, rows = heads.filter(h => h.st === 'h1' || (lv >= 2 && h.st === 'h2') || (lv >= 3 && h.st === 'h3'));
      const paras = [{ st: 'tocTitle', runs: [{ t: B.tocTitle || '차례' }], plain: B.tocTitle || '차례', line: -1 }].concat(rows.map(h => ({ st: h.st === 'h1' ? 'toc1' : 'toc2', runs: [{ t: h.text }], plain: h.text, line: -1, toc: String(A.bookNum(h.abs) == null ? h.abs + 1 : A.bookNum(h.abs)) })));
      const oldN = d.pages.filter(p => p.toc).length, extras = d.pages.filter(p => p.toc).map(p => p.els.filter(e => !e.flowFrame));
      const res = layoutStream(paras, t0, S, 'toc', extras);
      d.pages = d.pages.filter(p => !p.toc); d.pages.splice(t0, 0, ...res.pages);
      return { changed: res.pages.length !== oldN, n: rows.length };
    }
    function addToc() {
      const d = A.doc; if (d.pages.some(p => p.toc)) { flow(); return; }
      let i = d.pages.findIndex(p => p.flow); if (i < 0) i = d.pages.length;
      const pg = A.newPage(); pg.toc = true; pg.label = '차례'; d.pages.splice(i, 0, pg); flow();
    }

    /* ---------- 새 책 만들기 마법사 ---------- */
    const NB = { kind: 'general', trim: 'sinkuk', w: 152, h: 225, title: '', author: '나라차태권도', bind: 'perfect', sample: true, mg: null, cols: 1, font: '', size: 0, lh: 0, cover: true };
    function openNewBook() {
      let dl = $('#dlgNewBook'); if (!dl) { dl = document.createElement('dialog'); dl.id = 'dlgNewBook'; dl.className = 'wide'; document.body.appendChild(dl); }
      const K = () => KINDS[NB.kind], T = () => TRIMS.find(t => t[0] === NB.trim);
      const sync = () => { const t = T(); if (t[0] !== 'custom') { NB.w = t[2]; NB.h = t[3]; } NB.mg = marginsFor(NB.w, NB.h, NB.kind); };
      if (!NB.mg) sync();
      const fontOpts = (cur) => fontList().map(f => `<option value="${esc(f[0])}" ${f[0] === cur ? 'selected' : ''}>${esc(f[1])}</option>`).join('');
      const draw = () => {
        const k = K(), font = NB.font || k.font, size = NB.size || k.size, lh = NB.lh || k.lh, M = NB.mg, tw = r1(NB.w - M.inner - M.outer), th = r1(NB.h - M.top - M.bottom);
        const sc = 250 / Math.max(NB.w * 2, NB.h * 1.4), pw = NB.w * sc, ph = NB.h * sc;
        const prev = `<div class="nb-spread" style="width:${pw * 2}px;height:${ph}px">${[0, 1].map(s => { const right = s === 1, L = (right ? M.inner : M.outer) * sc, R = (right ? M.outer : M.inner) * sc; return `<div class="nb-pg" style="width:${pw}px;height:${ph}px"><div class="nb-tb" style="left:${L}px;right:${R}px;top:${M.top * sc}px;bottom:${M.bottom * sc}px;${NB.cols > 1 ? 'background-image:linear-gradient(90deg,transparent calc(50% - 3px),rgba(47,111,228,.25) calc(50% - 3px),rgba(47,111,228,.25) calc(50% + 3px),transparent calc(50% + 3px))' : ''}"></div><span class="nb-no" style="${right ? 'right' : 'left'}:${(right ? M.outer : M.outer) * sc}px;bottom:${M.bottom * sc * 0.35}px">${right ? 5 : 4}</span></div>`; }).join('')}</div>`;
        dl.innerHTML = `<div class="dhead"><h2>📚 새 책 만들기 <small>인디자인·쿽 방식 — 판형·여백·본문을 정하면 원고가 저절로 쪽에 흘러 들어갑니다</small></h2><button class="btn sm" data-close>닫기</button></div>
        <div class="dbody nb">
          <div class="nb-side">
            <h3>1. 책 종류</h3><div class="nb-kinds">${Object.entries(KINDS).map(([id, x]) => `<button class="nb-kind ${NB.kind === id ? 'on' : ''}" data-nbk="${id}"><b>${x.name}</b><small>${x.sub}</small></button>`).join('')}</div>
            <h3>2. 판형 (책 크기)</h3><div class="nb-trims">${TRIMS.map(t => `<button class="nb-trim ${NB.trim === t[0] ? 'on' : ''}" data-nbt="${t[0]}"><b>${t[1]}</b><small>${t[0] === 'custom' ? t[4] : `${t[2]}×${t[3]}mm · ${t[4]}`}</small></button>`).join('')}</div>
            ${NB.trim === 'custom' ? `<div class="grid2"><label class="f"><span>가로(mm)</span><input type="number" data-nbn="w" value="${NB.w}" min="50" max="600"></label><label class="f"><span>세로(mm)</span><input type="number" data-nbn="h" value="${NB.h}" min="50" max="600"></label></div>` : ''}
            <h3>3. 제목 · 지은이</h3><div class="grid2"><label class="f"><span>책 제목</span><input type="text" data-nbs="title" value="${esc(NB.title)}" placeholder="예: 나라차 수련 교본"></label><label class="f"><span>지은이 · 펴낸 곳</span><input type="text" data-nbs="author" value="${esc(NB.author)}"></label></div>
          </div>
          <div class="nb-main">
            <div class="nb-prevwrap">${prev}<p class="hint" style="margin:6px 0 0;text-align:center">펼침면 미리보기 — 파란 칸이 글이 들어가는 판면 ${tw}×${th}mm · 접히는 가운데(안쪽) 여백을 넓게</p></div>
            <h3>여백 (mm) <small>펼침면 기준 — 안쪽은 제본되는 쪽</small></h3>
            <div class="grid4">${[['top', '위'], ['bottom', '아래'], ['inner', '안쪽'], ['outer', '바깥쪽']].map(([k, t]) => `<label class="f"><span>${t}</span><input type="number" step="0.5" min="5" data-nbm="${k}" value="${M[k]}"></label>`).join('')}</div>
            <h3>본문</h3>
            <div class="grid4"><label class="f"><span>본문 글꼴</span><select data-nbs="font">${fontOpts(font)}</select></label><label class="f"><span>글자 크기(pt)</span><input type="number" step="0.5" min="7" max="20" data-nbn="size" value="${size}"></label><label class="f"><span>행간(%)</span><input type="number" step="5" min="120" max="250" data-nbn="lhp" value="${Math.round(lh * 100)}"></label><label class="f"><span>단</span><select data-nbn="cols">${[1, 2, 3].map(c => `<option value="${c}" ${(NB.cols || k.cols) === c ? 'selected' : ''}>${c}단</option>`).join('')}</select></label></div>
            <h3>제본 · 앞쪽</h3>
            <div class="grid2"><label class="f"><span>제본</span><select data-nbs="bind"><option value="perfect" ${NB.bind === 'perfect' ? 'selected' : ''}>무선 제본 (책등 있는 책)</option><option value="saddle" ${NB.bind === 'saddle' ? 'selected' : ''}>중철 (스테이플 — 4의 배수 쪽)</option></select></label>
              <div><label class="chk"><input type="checkbox" data-nbc="cover" ${NB.cover ? 'checked' : ''}> 맨 앞에 표지 쪽 (보기·집 인쇄용)</label><label class="chk"><input type="checkbox" data-nbc="sample" ${NB.sample ? 'checked' : ''}> 보기 원고 넣기 (태권도 교본 예시 — 나중에 바꾸기)</label></div></div>
            <p class="hint">만들면 <b>속표지 · 차례 · 본문(원고가 자동으로 흐름) · 판권</b> 쪽이 생기고, 왼쪽 쪽 위에는 책 제목, 오른쪽 쪽 위에는 장 제목, 바깥쪽 아래에 쪽 번호가 저절로 들어갑니다. 도련은 인쇄소 기준 사방 3mm. 지금 문서는 그대로 남습니다(저장하지 않았다면 '직전 문서'로 보관).</p>
            <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-close>취소</button><button class="btn primary" id="nbGo">📚 ${esc(T()[1])} ${NB.w}×${NB.h}mm 책 만들기</button></div>
          </div></div>`;
        dl.querySelectorAll('[data-close]').forEach(b => b.onclick = () => dl.close());
        $('#nbGo').onclick = () => createBook();
      };
      dl.onclick = e => {
        const k = e.target.closest('[data-nbk]'); if (k) { NB.kind = k.dataset.nbk; const x = KINDS[NB.kind]; NB.trim = x.trim; NB.font = ''; NB.size = 0; NB.lh = 0; NB.cols = x.cols; NB.bind = x.bind; sync(); draw(); return; }
        const t = e.target.closest('[data-nbt]'); if (t) { NB.trim = t.dataset.nbt; sync(); draw(); }
      };
      dl.onchange = e => {
        const t = e.target; if (t.dataset.nbs) { NB[t.dataset.nbs] = t.value; if (t.dataset.nbs === 'bind') draw(); return; }
        if (t.dataset.nbc) { NB[t.dataset.nbc] = t.checked; return; }
        if (t.dataset.nbm) { NB.mg[t.dataset.nbm] = Number(t.value) || 0; draw(); return; }
        if (t.dataset.nbn) { const v = Number(t.value); if (t.dataset.nbn === 'lhp') NB.lh = v / 100; else if (t.dataset.nbn === 'w' || t.dataset.nbn === 'h') { NB[t.dataset.nbn] = v; NB.mg = marginsFor(NB.w, NB.h, NB.kind); } else NB[t.dataset.nbn] = v; draw(); }
      };
      dl.oninput = e => { const t = e.target; if (t.dataset.nbs === 'title' || t.dataset.nbs === 'author') NB[t.dataset.nbs] = t.value; };
      draw(); dl.showModal();
    }
    function fontList() {
      const pref = [['Noto Serif KR', '본명조 (Noto Serif KR) — 책 본문'], ['Nanum Myeongjo', '나눔명조'], ['Gowun Batang', '고운바탕'], ['Hahmlet', '함렛'], ['Noto Sans KR', '본고딕 (Noto Sans KR)'], ['Pretendard', '프리텐다드']];
      const all = (A.FONTS || []).map(f => [f.family, f.label || f.family]).filter(f => !pref.some(p => p[0] === f[0]));
      return pref.concat(all);
    }
    async function createBook() {
      const K = KINDS[NB.kind], title = (NB.title || '').trim() || (NB.kind === 'edu' ? '나라차 수련 교본' : NB.kind === 'booklet' ? '나라차 소식' : '나라차 이야기');
      const kept = await A.newDocKeep(); if (kept === false) return;
      const d = A.newDoc(['custom', title, NB.w, NB.h]); d.name = title; d.bleed = 3; d.cropMarks = false; d.pages = [];
      d.book = Object.assign(A.clone(A.BOOK_DEF), { on: true, bookMode: true, kind: NB.kind, bind: NB.bind, title, author: NB.author || '', start: 1, skip: 0, facing: true, pos: 'outer', style: 'n', size: Math.max(7.5, Math.round((NB.size || K.size) * 0.85 * 2) / 2), color: '#555555', font: K.head, margin: 8, header: '', footer: '', headL: '{책제목}', headR: '{장제목}', rule: true, guides: true, mg: Object.assign({}, NB.mg), cols: Number(NB.cols || K.cols) || 1, gutter: 6, tocLevel: 2, tocTitle: '차례' });
      d.bstyles = psDefaults(NB.kind); if (NB.font) ['body', 'list', 'center', 'small'].forEach(k => { d.bstyles[k].font = NB.font; }); if (NB.size) { const z = NB.size; d.bstyles.body.size = z; d.bstyles.list.size = z; d.bstyles.center.size = z; d.bstyles.small.size = Math.round(z * 0.85 * 2) / 2; d.bstyles.quote.size = Math.round(z * 0.95 * 2) / 2; } if (NB.lh) ['body', 'list', 'center', 'quote'].forEach(k => { d.bstyles[k].lh = NB.lh; });
      d.bstory = { md: NB.sample ? SAMPLE(title) : `# 첫째 장\n여기에 원고를 붙여 넣으세요. 왼쪽 「도서 편집 → 원고」에서 원고 편집기를 열거나 워드·한글에서 복사해 붙여 넣으면 쪽이 저절로 늘어납니다.` };
      const T_ = (text, x, y, w, h, st) => Object.assign({}, A.TEXT_DEF, { id: A.uid(), text, x, y, w, h, sizing: 'fixed' }, st);
      const W = d.w, H = d.h, ac = K.accent || '#1a1a1a';
      if (NB.cover) { const c = A.newPage(K.accent || '#1E2B5A'); c.label = '표지'; c.noMaster = true; c.cover = true;
        c.els.push(T_(title, W * 0.1, H * 0.3, W * 0.8, H * 0.2, { font: K.head, size: Math.round(W / 5.5), weight: 800, color: '#ffffff', lh: 1.2, ls: -0.02, name: '표지 제목' }), T_(NB.author || '', W * 0.1, H * 0.82, W * 0.8, 10, { font: K.head, size: 12, weight: 600, color: '#ffffff', name: '지은이' })); d.pages.push(c);
        const cb = A.newPage(); cb.noMaster = true; cb.label = '표지 뒷면'; cb.blankSide = true; d.pages.push(cb); }
      const tp = A.newPage(); tp.label = '속표지'; tp.noMaster = true; tp.els.push(T_(title, W * 0.12, H * 0.32, W * 0.76, H * 0.15, { font: K.head, size: Math.round(W / 7), weight: 800, color: ac, lh: 1.25, align: 'center', name: '속표지 제목' }), T_(NB.author || '', W * 0.12, H * 0.75, W * 0.76, 10, { font: K.head, size: 11, weight: 600, color: '#444444', align: 'center', name: '지은이' })); d.pages.push(tp);
      const tb = A.newPage(); tb.noMaster = true; tb.label = '속표지 뒷면'; d.pages.push(tb);
      const tc = A.newPage(); tc.toc = true; tc.label = '차례'; d.pages.push(tc);
      const bk = A.newPage(); bk.back = true; bk.noMaster = true; bk.label = '판권';
      const y = new Date(), dstr = `${y.getFullYear()}년 ${y.getMonth() + 1}월 ${y.getDate()}일`;
      bk.els.push(T_(`${title}\n\n펴낸 날  ${dstr} 1판 1쇄\n지은이  ${NB.author || ''}\n펴낸 곳  나라차태권도\n\n이 책의 내용을 허락 없이 옮겨 쓰지 마세요.`, NB.mg.outer, H - NB.mg.bottom - 45, W - NB.mg.inner - NB.mg.outer, 45, { font: 'Pretendard', size: 8.5, lh: 1.7, color: '#333333', name: '판권' })); d.pages.push(bk);
      A.setDoc(d); await flow({ quiet: true }); A.afterNewDoc();
      const st = d.book.lastFlow || {}; A.toast(`새 책 "${title}"을 만들었습니다 — ${d.pages.length}쪽(본문 ${st.pages || 0}쪽). 왼쪽 「도서 편집 → 원고」에서 원고를 바꾸면 쪽이 저절로 다시 짜입니다${kept ? ` · 저장하지 않은 "${kept}"는 직전 문서로 보관` : ''}`);
      $('#dlgNewBook').close(); A.openTab('book');
    }
    /* 이 문서를 책으로 (지금 크기 그대로 — 끝에 본문 흐름을 붙임) */
    function convertDoc() {
      const d = A.doc; const K = KINDS.general;
      d.book = Object.assign(A.clone(A.BOOK_DEF), d.book || {}, { on: true, bookMode: true, kind: 'general', title: d.book && d.book.title || d.name || '', author: '', headL: '{책제목}', headR: '{장제목}', rule: true, guides: true, mg: Object.assign({}, marginsFor(d.w, d.h, 'general'), (d.book && d.book.mg) || {}), cols: (d.book && d.book.cols) || 1, gutter: 6, tocLevel: 2, tocTitle: '차례', size: 8.5, font: K.head, facing: true });
      if (!d.bstyles) d.bstyles = psDefaults('general'); if (!d.bstory) d.bstory = { md: '# 첫째 장\n여기에 원고를 붙여 넣으세요.' };
      flow();
    }

    /* ---------- 원고 편집기 (인디자인 스토리 편집기) ---------- */
    function openStory(line) {
      if (!isBook()) return; let dl = $('#dlgStory'); if (!dl) { dl = document.createElement('dialog'); dl.id = 'dlgStory'; dl.className = 'wide'; document.body.appendChild(dl); }
      const md = A.doc.bstory.md || '';
      dl.innerHTML = `<div class="dhead"><h2>✍ 원고 편집기 <small>한 줄 = 한 단락 · 줄 앞 기호로 스타일 — 고치고 「흘려 넣기」를 누르면 쪽이 다시 짜입니다</small></h2><button class="btn sm" data-close>닫기</button></div>
        <div class="dbody st-ed">
          <div class="st-bar">${['h1', 'h2', 'h3', 'body', 'quote', 'list', 'center', 'small'].map(k => `<button class="btn sm" data-stl="${k}" title="지금 줄을 ${PS_NAME[k]}(으)로${PS_MARK[k] ? ` — 줄 앞 「${PS_MARK[k].trim()}」` : ''}">${PS_NAME[k]}</button>`).join('')}<span class="st-sep"></span><button class="btn sm" data-sti="bold" title="고른 글자를 굵게 (**글자**)"><b>굵게</b></button><button class="btn sm" data-sti="break" title="여기서 다음 쪽으로">쪽 나눔</button><span class="st-sep"></span><button class="btn sm" id="stOpen" title="txt · md · 워드(docx) 원고 불러오기">📂 파일 불러오기</button></div>
          <div class="st-body"><textarea id="stText" spellcheck="false" placeholder="# 첫째 장\n본문 첫 단락…\n## 절 제목\n- 목록\n> 인용">${esc(md)}</textarea>
            <div class="st-side"><b>개요</b><div id="stOutline"></div><div class="hint" id="stCount"></div>
              <div class="st-help"><b>줄 앞 기호</b><br><code>#</code> 장 제목 (오른쪽 쪽에서 시작)<br><code>##</code> 절 제목 · <code>###</code> 소제목<br><code>&gt;</code> 인용 · <code>-</code> 목록<br><code>[가운데]</code> · <code>[작은글]</code><br><code>**굵게**</code> · <code>[쪽 나눔]</code><br>워드·한글·웹에서 붙여 넣으면 제목·굵게가 기호로 바뀝니다.</div></div></div>
          <div class="row" style="justify-content:flex-end;gap:8px;margin-top:8px"><button class="btn" data-close>닫기 (저장만)</button><button class="btn primary" id="stFlow">⤵ 흘려 넣기 — 쪽 다시 짜기</button></div></div>`;
      const ta = dl.querySelector('#stText');
      const outline = () => { const ps_ = parse(ta.value), hs = ps_.filter(p => /^h[12]$/.test(p.st)); dl.querySelector('#stOutline').innerHTML = hs.length ? hs.map(h => `<button class="st-ol ${h.st}" data-ln="${h.line}">${esc(h.plain || '(제목 없음)')}</button>`).join('') : '<span class="hint">「# 장 제목」 줄이 없습니다</span>'; const ch = ps_.reduce((a, p) => a + (p.plain || '').length, 0); dl.querySelector('#stCount').textContent = `단락 ${ps_.length}개 · ${ch.toLocaleString()}자 · 장 ${ps_.filter(p => p.st === 'h1').length}개`; };
      const save = () => { if (A.doc.bstory.md !== ta.value) { A.doc.bstory.md = ta.value; A.markDirty(); } };
      const lineRange = () => { const v = ta.value, a = v.lastIndexOf('\n', ta.selectionStart - 1) + 1; let b = v.indexOf('\n', ta.selectionEnd); if (b < 0) b = v.length; return [a, b]; };
      const setStyle = k => { const [a, b] = lineRange(), lines = ta.value.slice(a, b).split('\n').map(l => { const t = l.replace(/^\s*(#{1,3}\s*|>\s?|[-*•·]\s+|\[가운데\]\s*|\[작은\s?글\]\s*)/, ''); return t ? (PS_MARK[k] || '') + t : t; }).join('\n'); ta.setRangeText(lines, a, b, 'select'); ta.focus(); save(); outline(); };
      dl.onclick = e => {
        const s = e.target.closest('[data-stl]'); if (s) { setStyle(s.dataset.stl); return; }
        const i = e.target.closest('[data-sti]'); if (i) { if (i.dataset.sti === 'bold') { const a = ta.selectionStart, b = ta.selectionEnd; if (b > a) ta.setRangeText(`**${ta.value.slice(a, b)}**`, a, b, 'end'); } else { const [a] = lineRange(); ta.setRangeText('[쪽 나눔]\n', a, a, 'end'); } ta.focus(); save(); outline(); return; }
        const o = e.target.closest('[data-ln]'); if (o) { gotoLine(ta, Number(o.dataset.ln)); return; }
        if (e.target.closest('[data-close]')) { save(); dl.close(); if (stale()) flowSoon(10); }
      };
      ta.oninput = () => { save(); clearTimeout(ta._t); ta._t = setTimeout(outline, 300); };
      ta.onpaste = e => { const h = e.clipboardData && e.clipboardData.getData('text/html'); if (!h) return; const md2 = htmlToMd(h); if (!md2.trim()) return; e.preventDefault(); ta.setRangeText(md2, ta.selectionStart, ta.selectionEnd, 'end'); save(); outline(); };
      ta.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('#stFlow').click(); } };
      $('#stFlow').onclick = async () => { save(); dl.close(); await flow(); };
      $('#stOpen').onclick = () => importFile(md2 => { ta.value = md2; save(); outline(); });
      outline(); dl.showModal(); if (line != null && line >= 0) gotoLine(ta, line); else ta.focus();
    }
    function gotoLine(ta, ln) { const ls = ta.value.split('\n'); let a = 0; for (let i = 0; i < Math.min(ln, ls.length); i++) a += ls[i].length + 1; ta.focus(); ta.setSelectionRange(a, a + (ls[ln] || '').length); const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22; ta.scrollTop = Math.max(0, ln * lh - ta.clientHeight / 3); }
    /* 워드·한글·웹에서 붙여 넣은 HTML → 원고 기호 */
    function htmlToMd(html) {
      const doc_ = new DOMParser().parseFromString(html, 'text/html'), out = [];
      const inl = n => { let s = ''; n.childNodes.forEach(c => { if (c.nodeType === 3) s += c.nodeValue.replace(/\s+/g, ' '); else if (c.nodeType === 1) { const t = c.tagName; if (t === 'BR') s += '\n'; else if (t === 'B' || t === 'STRONG' || (c.style && (c.style.fontWeight === 'bold' || Number(c.style.fontWeight) >= 600))) { const x = inl(c).trim(); s += x ? `**${x}**` : ''; } else s += inl(c); } }); return s; };
      const walk = n => n.childNodes.forEach(c => { if (c.nodeType !== 1) { const t = (c.nodeValue || '').trim(); if (t) out.push(t); return; } const t = c.tagName, txt = () => inl(c).replace(/\*\*\s*\*\*/g, '').trim();
        if (/^H1$/.test(t)) out.push('# ' + txt().replace(/\*\*/g, '')); else if (/^H2$/.test(t)) out.push('## ' + txt().replace(/\*\*/g, '')); else if (/^H[3-6]$/.test(t)) out.push('### ' + txt().replace(/\*\*/g, ''));
        else if (t === 'LI') out.push('- ' + txt()); else if (t === 'BLOCKQUOTE') txt().split('\n').forEach(l => l.trim() && out.push('> ' + l.trim()));
        else if (t === 'P' || t === 'DIV' && !c.querySelector('p,div,h1,h2,h3,li,table')) { const x = txt(); if (x) x.split('\n').forEach(l => l.trim() && out.push(l.trim())); }
        else if (t === 'TABLE') c.querySelectorAll('tr').forEach(tr => out.push([...tr.children].map(td => td.textContent.trim()).join(' · ')));
        else if (t === 'STYLE' || t === 'SCRIPT' || t === 'META') return; else walk(c); });
      walk(doc_.body); return out.join('\n');
    }
    function importFile(done) {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.txt,.md,.docx,text/plain'; inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try {
          if (/\.docx$/i.test(f.name)) { await A.loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', () => window.mammoth, 'sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz'); const r = await window.mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() }); done(htmlToMd(r.value)); }
          else { let t = await f.text(); if (/�/.test(t.slice(0, 2000))) { try { t = new TextDecoder('euc-kr').decode(await f.arrayBuffer()); } catch (e) {} } done(t.replace(/\r/g, '')); } /* 한글 메모장(EUC-KR) 파일도 */
          A.toast(`「${f.name}」 원고를 불러왔습니다 — 「흘려 넣기」를 누르세요`);
        } catch (e) { A.toast('원고를 불러오지 못했습니다: ' + e.message, true); }
      }; inp.click();
    }

    /* ---------- 점검 (인디자인 사전 검사) ---------- */
    async function preflight() {
      const d = A.doc, B = B_(), out = [], add = (lv, page, msg) => out.push({ lv, page, msg });
      if (stale()) add('warn', null, '원고·스타일·여백을 고친 뒤 아직 다시 흘리지 않았습니다 — 「⤵ 다시 흘리기」');
      const lf = d.book.lastFlow || {}; if (lf.overflow) add('bad', null, `빈 상자에도 다 안 들어가는 글이 ${lf.overflow}곳 있습니다 (큰 제목·긴 낱말) — 글자 크기를 줄이거나 줄을 나누세요`);
      d.pages.forEach((p, i) => { if (!p.blank && !p.back && !p.noMaster && !p.toc && !p.els.length) add('warn', i, '빈 쪽입니다 — 일부러 비운 쪽이 아니면 지우거나 채우세요'); });
      const n = d.pages.length; if (B.bind === 'saddle' && n % 4) add('bad', null, `중철은 4의 배수 쪽이어야 합니다 — 지금 ${n}쪽, ${4 - n % 4}쪽 더 필요`); else if (n % 2) add('warn', null, `쪽 수가 홀수(${n}쪽)입니다 — 책은 짝수 쪽이어야 해서 마지막에 빈 쪽이 하나 붙습니다`); else add('ok', null, `${n}쪽 — ${B.bind === 'saddle' ? '중철 4의 배수 맞음' : n % 16 ? '짝수 쪽 맞음 (16의 배수면 종이가 가장 덜 버려짐)' : '16의 배수 — 인쇄 대수에 딱 맞음'}`);
      d.pages.forEach((p, i) => p.els.forEach(el => { if (el.flowFrame || el.hidden || p.cover) return; if (el.type === 'text') { const safe = 3; if (el.x < safe || el.y < safe || el.x + el.w > d.w - safe || el.y + el.h > d.h - safe) add('warn', i, `「${el.name || (el.text || '').slice(0, 12)}」 글이 재단선 3mm 안쪽 안전 여백 밖에 있습니다 — 잘릴 수 있어요`); } }));
      const imgs = []; d.pages.forEach((p, i) => p.els.forEach(el => { if (el.type === 'image' && el.src && !el.hidden) imgs.push([i, el]); }));
      await Promise.all(imgs.slice(0, 80).map(([i, el]) => new Promise(res => { const u = A.imgUrl(el); if (!u) return res(); const im = new Image(); im.onload = () => { const dpi = Math.round(im.naturalWidth / ((el.w * (el.zoom || 1)) / 25.4)); if (dpi < 150) add('bad', i, `사진 해상도가 낮습니다 (${dpi}ppi) — 인쇄하면 흐려요. 더 큰 사진이나 작게 넣기 (300ppi 권장)`); else if (dpi < 250) add('warn', i, `사진 해상도 ${dpi}ppi — 괜찮지만 300ppi면 더 선명`); res(); }; im.onerror = () => { add('bad', i, '사진을 불러오지 못했습니다 (연결 끊김)'); res(); }; im.src = u; setTimeout(res, 4000); })));
      try { A.printIssues(d.pages.map((_, i) => i)).forEach(x => add('warn', x.page - 1, x.msg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/^\s*·\s*/, ''))); } catch (e) {}
      if (!(Number(d.bleed) > 0)) add('warn', null, '도련이 0mm입니다 — 인쇄소에 맡기면 사방 3mm 도련이 필요합니다 (아래 인쇄소용 PDF가 3mm로 맞춤)');
      if (!out.some(x => x.lv !== 'ok')) add('ok', null, '문제없습니다 — 인쇄소용 PDF로 내보내세요');
      return out;
    }

    /* ---------- 왼쪽 패널 「도서 편집」 ---------- */
    const open = new Set(['story']); let pfCache = null;
    function renderSide(body) {
      const d = A.doc;
      if (!isBook()) {
        body.innerHTML = `<div class="wz-card bk-hero"><div class="bk-ic">📚</div><b style="font-size:15px">도서 편집</b><p class="hint" style="margin:6px 0 12px">인디자인·쿽익스프레스처럼 책을 만듭니다. 판형과 여백을 고르고 원고를 붙여 넣으면 <b>쪽이 저절로 늘어나며</b> 장 제목·쪽 번호·머리글·차례가 알아서 들어갑니다. 인성 교재·수련 교본·소식 책자·문집에 알맞습니다.</p><button class="btn primary full" data-bk="new">📚 새 책 만들기</button><button class="btn full" data-bk="convert" style="margin-top:6px">지금 문서를 책으로 (${Math.round(d.w)}×${Math.round(d.h)}mm 그대로)</button></div>
          <div class="hint" style="margin-top:10px;line-height:1.7"><b>이렇게 만들어요</b><br>① 새 책 만들기 — 책 종류·판형·여백·본문 글꼴<br>② 원고 — 붙여 넣기 · 워드(docx)·txt 불러오기<br>③ 스타일 — 장·절 제목·본문 모양을 한 번에<br>④ 머리글·쪽 번호 · 차례 — 저절로<br>⑤ 점검 → 인쇄소용 PDF</div>`;
        body.onclick = e => { const b = e.target.closest('[data-bk]'); if (!b) return; if (b.dataset.bk === 'new') openNewBook(); if (b.dataset.bk === 'convert') { convertDoc(); A.renderSide(); } };
        return;
      }
      const B = B_(), S = ps(), lf = d.book.lastFlow || {}, pg = A.page(), st = stale();
      const sec = (id, title, inner, extra) => `<details class="bk-sec2" data-sec="${id}" ${open.has(id) ? 'open' : ''}><summary>${title}${extra || ''}</summary><div class="bk-in">${inner}</div></details>`;
      const N = (k, t, v, step, min) => `<label class="f"><span>${t}</span><input type="number" data-bb="${k}" value="${v}" step="${step || 1}" min="${min == null ? 0 : min}"></label>`;
      const fonts = cur => fontList().map(f => `<option value="${esc(f[0])}" ${f[0] === cur ? 'selected' : ''}>${esc(f[1])}</option>`).join('');
      const styleRow = k => { const s = S[k]; return `<details class="bk-ps" ${open.has('ps-' + k) ? 'open' : ''} data-sec="ps-${k}"><summary><span class="bk-psn" style="font-family:'${esc(s.font)}';font-weight:${s.weight};color:${s.color}">${PS_NAME[k]}</span><small>${s.size}pt · ${Math.round(s.lh * 100)}%</small></summary><div class="bk-psf">
          <label class="f"><span>글꼴</span><select data-ps="${k}.font">${fonts(s.font)}</select></label>
          <div class="grid3"><label class="f"><span>크기(pt)</span><input type="number" step="0.5" min="5" data-ps="${k}.size" value="${s.size}"></label><label class="f"><span>행간(%)</span><input type="number" step="5" min="100" data-ps="${k}.lhp" value="${Math.round(s.lh * 100)}"></label><label class="f"><span>굵기</span><select data-ps="${k}.weight">${[[300, '가늘게'], [400, '보통'], [500, '중간'], [700, '굵게'], [800, '아주 굵게']].map(([w, t]) => `<option value="${w}" ${Number(s.weight) === w ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
          <div class="grid3"><label class="f"><span>정렬</span><select data-ps="${k}.align">${[['justify', '양끝'], ['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([a, t]) => `<option value="${a}" ${s.align === a ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>첫 줄 들여쓰기(글자)</span><input type="number" step="0.5" data-ps="${k}.indent" value="${s.indent}"></label><label class="f"><span>자간(%)</span><input type="number" step="1" data-ps="${k}.lsp" value="${Math.round((s.ls || 0) * 100)}"></label></div>
          <div class="grid3"><label class="f"><span>앞 간격(mm)</span><input type="number" step="0.5" data-ps="${k}.before" value="${s.before}"></label><label class="f"><span>뒤 간격(mm)</span><input type="number" step="0.5" data-ps="${k}.after" value="${s.after}"></label><label class="f"><span>색</span><input type="color" data-ps="${k}.color" value="${/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#222222'}"></label></div>
          ${['body', 'quote', 'list', 'small'].includes(k) ? `<label class="f"><span>줄바꿈 단위</span><select data-ps="${k}.brk"><option value="word" ${s.brk !== 'char' ? 'selected' : ''}>어절 (낱말을 자르지 않음 — 기본)</option><option value="char" ${s.brk === 'char' ? 'selected' : ''}>글자 (줄 끝이 고르고 낱말 사이가 덜 벌어짐)</option></select></label>` : ''}
          ${k === 'h1' ? `<div class="grid2"><label class="f"><span>장 시작</span><select data-ps="h1.start">${[['right', '오른쪽(홀수) 쪽에서'], ['page', '새 쪽에서'], ['none', '이어서']].map(([a, t]) => `<option value="${a}" ${s.start === a ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>장 제목 위 여백(mm)</span><input type="number" step="1" data-ps="h1.sink" value="${s.sink || 0}"></label></div>` : ''}
          ${['quote', 'list', 'toc2'].includes(k) ? `<label class="f"><span>왼쪽 들여쓰기(mm)</span><input type="number" step="0.5" data-ps="${k}.indentL" value="${s.indentL || 0}"></label>` : ''}
        </div></details>`; };
      const pf = pfCache ? `<div class="bk-pf">${pfCache.map(x => `<div class="bk-pfi ${x.lv}">${x.lv === 'ok' ? '✅' : x.lv === 'bad' ? '⛔' : '⚠️'} <span>${esc(x.msg)}</span>${x.page != null ? `<button class="btn sm" data-goto="${x.page}">${x.page + 1}쪽</button>` : ''}</div>`).join('')}</div>` : '<p class="hint">「점검하기」를 누르면 넘친 글·쪽 수·안전 여백·사진 해상도·도련을 살핍니다.</p>';
      body.innerHTML = `<div class="bk-top"><b>📚 ${esc(B.title || d.name)}</b><small>${r1(d.w)}×${r1(d.h)}mm · ${d.pages.length}쪽 (본문 ${lf.pages || 0}쪽) · 장 ${(parse(d.bstory.md).filter(p => p.st === 'h1').length)}개</small>
          <div class="row" style="gap:6px;margin-top:8px"><button class="btn primary sm" data-bk="story">✍ 원고 편집기</button><button class="btn sm ${st ? 'warn' : ''}" data-bk="flow" title="원고·스타일을 고친 뒤 쪽을 다시 짭니다">⤵ 다시 흘리기${st ? ' ●' : ''}</button><button class="btn sm" data-bk="spread">📖 펼침면</button></div></div>
        ${sec('story', '✍ 원고', `<p class="hint" style="margin-top:0">원고는 하나로 이어진 글입니다 — 고치면 쪽이 저절로 늘거나 줄고(인디자인 스마트 리플로·쿽 자동 상자), 장 제목(<b>#</b>)은 오른쪽 쪽에서 새로 시작합니다. 쪽 위의 본문 상자를 <b>두 번 누르면</b> 그 자리의 원고가 열립니다.</p>
          <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-bk="story">원고 편집기 열기</button><button class="btn sm" data-bk="import">📂 원고 파일 불러오기 (docx·txt)</button></div>
          <p class="hint">단락 ${lf.paras || 0}개 · ${(lf.chars || 0).toLocaleString()}자 → 본문 ${lf.pages || 0}쪽${lf.overflow ? ` · <b style="color:#c0392b">넘친 글 ${lf.overflow}곳</b>` : ''}</p>`)}
        ${sec('setup', '📐 판형 · 여백 · 단', `<div class="grid2"><label class="f"><span>책 제목 ({책제목})</span><input type="text" data-bb="title" value="${esc(B.title || '')}"></label><label class="f"><span>지은이 ({지은이})</span><input type="text" data-bb="author" value="${esc(B.author || '')}"></label></div>
          <div class="grid4">${N('mg.top', '위', B.mg.top, 0.5)}${N('mg.bottom', '아래', B.mg.bottom, 0.5)}${N('mg.inner', '안쪽', B.mg.inner, 0.5)}${N('mg.outer', '바깥쪽', B.mg.outer, 0.5)}</div>
          <div class="grid3">${N('cols', '단 수', B.cols, 1, 1)}${N('gutter', '단 사이(mm)', B.gutter, 0.5)}<label class="f"><span>제본</span><select data-bb="bind"><option value="perfect" ${B.bind !== 'saddle' ? 'selected' : ''}>무선</option><option value="saddle" ${B.bind === 'saddle' ? 'selected' : ''}>중철</option></select></label></div>
          <label class="chk"><input type="checkbox" data-bb="facing" ${B.facing ? 'checked' : ''}> 펼침면 (홀수 쪽 오른쪽 · 안쪽/바깥쪽 여백 뒤집기)</label><label class="chk"><input type="checkbox" data-bb="guides" ${B.guides ? 'checked' : ''}> 여백·단 안내선 보기 (인쇄 안 됨)</label>
          <p class="hint">판형(책 크기)을 바꾸려면 프로젝트 → 크기 바꾸기 뒤 「다시 흘리기」. 도련 ${Number(d.bleed) || 0}mm.</p>`)}
        ${sec('styles', '🅰 단락 스타일', `<p class="hint" style="margin-top:0">스타일을 고치면 책 전체의 같은 단락이 한꺼번에 바뀝니다 (인디자인 단락 스타일). 장 다음 첫 단락은 들여쓰지 않습니다.</p>${['h1', 'h2', 'h3', 'body', 'quote', 'list', 'center', 'small', 'tocTitle', 'toc1', 'toc2'].map(styleRow).join('')}<button class="btn sm" data-bk="psreset" style="margin-top:6px">기본 스타일로 되돌리기</button>`)}
        ${sec('master', '🗂 머리글 · 쪽 번호 (마스터)', `<div class="grid2"><label class="f"><span>왼쪽(짝수) 쪽 머리글</span><input type="text" data-bb="headL" value="${esc(B.headL || '')}" placeholder="{책제목}"></label><label class="f"><span>오른쪽(홀수) 쪽 머리글</span><input type="text" data-bb="headR" value="${esc(B.headR || '')}" placeholder="{장제목}"></label></div>
          <p class="hint" style="margin-top:0"><b>{책제목}</b> · <b>{장제목}</b>(그 쪽의 장 — 인디자인 '머리글 변수') · <b>{지은이}</b>. 장이 시작하는 쪽과 빈 쪽에는 머리글이 없습니다.</p>
          <div class="grid3"><label class="f"><span>쪽 번호 위치</span><select data-bb="pos">${[['outer', '바깥쪽'], ['center', '가운데'], ['inner', '안쪽']].map(([a, t]) => `<option value="${a}" ${B.pos === a ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>번호 모양</span><select data-bb="style">${[['n', '1'], ['dash', '- 1 -'], ['p', 'p.1']].map(([a, t]) => `<option value="${a}" ${B.style === a ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${N('size', '글자(pt)', B.size, 0.5, 5)}</div>
          <div class="grid2">${N('start', '이 문서 첫 쪽 번호', B.start, 1, 1)}<label class="chk" style="margin-top:20px"><input type="checkbox" data-bb="rule" ${B.rule ? 'checked' : ''}> 머리글 아래 가는 선</label></div>
          <div class="bk-pgm"><b>지금 쪽 (${A.cur + 1}쪽)</b> <label class="chk"><input type="checkbox" data-pgm="noMaster" ${pg.noMaster ? 'checked' : ''}> 머리글·쪽 번호 빼기 (인디자인 [없음] 마스터)</label></div>`)}
        ${sec('toc', '📑 차례', `<p class="hint" style="margin-top:0">장·절 제목과 쪽 번호로 차례를 만듭니다 (점선·쪽 번호). 원고를 고쳐 다시 흘리면 차례도 함께 새로 고쳐집니다.</p>
          <div class="grid2"><label class="f"><span>차례에 넣을 제목</span><select data-bb="tocLevel">${[[1, '장만'], [2, '장 + 절'], [3, '장 + 절 + 소제목']].map(([a, t]) => `<option value="${a}" ${Number(B.tocLevel || 2) === a ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>차례 제목</span><input type="text" data-bb="tocTitle" value="${esc(B.tocTitle || '차례')}"></label></div>
          <button class="btn sm" data-bk="toc">${d.pages.some(p => p.toc) ? '차례 새로 고침' : '차례 쪽 넣기 (본문 앞)'}</button>`)}
        ${sec('check', '✅ 점검 · 내보내기', `<button class="btn sm" data-bk="check">🔍 점검하기</button>${pf}
          <div class="col" style="gap:6px;margin-top:10px"><button class="btn primary full" data-bk="pdf" title="낱쪽 PDF · 도련 3mm · 재단선 — 인쇄소에 보내는 파일">🖨 인쇄소용 PDF (도련 3mm·재단선)</button><button class="btn full" data-bk="spread">📖 펼침면으로 보기</button><button class="btn full" data-bk="booklet" title="집 프린터 — 양면 인쇄 후 반으로 접어 스테이플">🏠 집에서 중철 소책자 인쇄 PDF</button></div>`)}`;
      body.onclick = async e => {
        const sm = e.target.closest('summary'); if (sm) { const dt = sm.parentElement; setTimeout(() => { if (dt.open) open.add(dt.dataset.sec); else open.delete(dt.dataset.sec); }, 0); return; }
        const g = e.target.closest('[data-goto]'); if (g) { A.goto(Number(g.dataset.goto)); return; }
        const b = e.target.closest('[data-bk]'); if (!b) return; const k = b.dataset.bk;
        if (k === 'story') openStory(); if (k === 'import') importFile(md => { A.doc.bstory.md = md; flow(); });
        if (k === 'flow') { await flow(); } if (k === 'spread') A.openSpreads(); if (k === 'toc') addToc();
        if (k === 'psreset') { if (confirm('단락 스타일을 처음 값으로 되돌릴까요?')) { d.bstyles = psDefaults(B.kind || 'general'); await flow({ quiet: true }); A.toast('기본 스타일로 되돌렸습니다'); } }
        if (k === 'check') { b.disabled = true; b.textContent = '살피는 중…'; pfCache = await preflight(); open.add('check'); A.renderSide(); }
        if (k === 'pdf') { if (stale()) await flow({ quiet: true }); if (!(Number(d.bleed) > 0)) d.bleed = 3; d.cropMarks = true; A.commit(); A.openDownload('pdfprint'); }
        if (k === 'booklet') { if (stale()) await flow({ quiet: true }); A.bookletPdf(); }
      };
      body.onchange = e => {
        const t = e.target;
        if (t.dataset.pgm) { A.page().noMaster = t.checked; A.commit(); A.renderCanvas(); return; }
        if (t.dataset.ps) { const [k, f] = t.dataset.ps.split('.'); if (!d.bstyles) d.bstyles = {}; const o = d.bstyles[k] = Object.assign({}, d.bstyles[k] || {}); let v = t.type === 'number' ? Number(t.value) : t.value; let key = f; if (f === 'lhp') { key = 'lh'; v = v / 100; } if (f === 'lsp') { key = 'ls'; v = v / 100; } if (f === 'weight') v = Number(v); o[key] = v; flowSoon(80); return; }
        if (t.dataset.bb) { const k = t.dataset.bb; let v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value; if (t.type === 'number' && t.value === '') return; if (k === 'tocLevel') v = Number(v);
          if (k.startsWith('mg.')) { d.book.mg = Object.assign({}, A.BOOK_DEF.mg, d.book.mg || {}); d.book.mg[k.slice(3)] = v; } else d.book[k] = v;
          if (['mg.top', 'mg.bottom', 'mg.inner', 'mg.outer', 'cols', 'gutter', 'facing', 'tocLevel', 'tocTitle', 'start'].includes(k)) flowSoon(80); else { A.commit(); A.renderCanvas(); } }
      };
    }

    /* ---------- 머리글·쪽 번호 (마스터) — app.js masterHTML이 책 모드일 때 부름 ---------- */
    function masterHTML(pg, i) {
      const B = B_(), d = A.doc; if (pg.blank || pg.noMaster || pg.cover) return ''; const n = A.bookNum(i); if (n == null) return '';
      const right = A.isRightPage(i), L = right ? B.mg.inner : B.mg.outer, R = right ? B.mg.outer : B.mg.inner, outerAl = right ? 'right' : 'left', innerAl = right ? 'left' : 'right';
      const tok = s => String(s || '').split('{책제목}').join(B.title || '').split('{지은이}').join(B.author || '').split('{장제목}').join(pg.chap || '');
      const head = pg.chapOpen || pg.toc ? '' : tok(right ? B.headR : B.headL).trim();
      const f = `font-family:'${esc(B.font || 'Pretendard')}','Noto Sans KR',sans-serif;font-size:${Number(B.size) || 8.5}pt;color:${esc(B.color || '#555')};line-height:1.2;white-space:nowrap;overflow:hidden;pointer-events:none;z-index:50;position:absolute;left:${L}mm;right:${R}mm;`;
      const num = { n: String(n), dash: `- ${n} -`, p: `p.${n}` }[B.style] || String(n), al = B.pos === 'center' ? 'center' : B.pos === 'inner' ? innerAl : outerAl;
      let h = '';
      if (head) h += `<div class="mst" style="${f}top:${r1(B.mg.top * 0.42)}mm;text-align:${outerAl};${B.rule ? `border-bottom:0.15mm solid ${esc(B.color || '#555')};padding-bottom:1mm;` : ''}">${esc(head)}</div>`;
      h += `<div class="mst" style="${f}bottom:${r1(B.mg.bottom * 0.42)}mm;text-align:${al}">${esc(num)}</div>`;
      return h;
    }
    function onFrameDbl(el) { openStory(el.flowLine); }
    /* 불러온 파일의 본문 상자 HTML 정리: 흘리기가 만드는 태그(p·span·b)와 서식 속성만 남김 (파일에 끼어든 스크립트·링크·그림 주소 차단) */
    const OK_TAG = new Set(['P', 'SPAN', 'B']), OK_CSS = new Set(['margin', 'padding', 'text-indent', 'font-family', 'font-size', 'line-height', 'font-weight', 'color', 'text-align', 'text-align-last', 'letter-spacing', 'word-break', 'overflow-wrap', 'line-break', 'display', 'align-items', 'gap', 'flex', 'border-bottom', 'opacity', 'transform', 'font-variant-numeric']);
    function sanitize(html) {
      const box = document.implementation.createHTMLDocument('').createElement('div'); box.innerHTML = String(html || '');
      const walk = n => { let s = ''; n.childNodes.forEach(c => { if (c.nodeType === 3) s += esc(c.nodeValue); else if (c.nodeType === 1) { const inner = walk(c); if (!OK_TAG.has(c.tagName)) { s += inner; return; }
        const css = String(c.getAttribute('style') || '').split(';').map(x => x.trim()).filter(Boolean).filter(d => { const i = d.indexOf(':'); if (i < 0) return false; const k = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1); return OK_CSS.has(k) && !/url\(|expression|javascript:|[<>]/i.test(v); }).join(';');
        const t = c.tagName.toLowerCase(); s += `<${t}${css ? ` style="${css.replace(/"/g, "'")}"` : ''}>${inner}</${t}>`; } }); return s; };
      return walk(box);
    }

    /* ---------- 보기 원고 (태권도 교본 예시 — 팀장님이 바꿔 쓰시도록) ---------- */
    const SAMPLE = (title) => `# 태권도를 시작하며
태권도는 우리 몸과 마음을 함께 단련하는 무도입니다. 발차기와 품새를 익히는 동안 우리는 바른 자세와 예의, 그리고 끝까지 해내는 힘을 배웁니다. 이 책은 ${title}을(를) 함께 공부하는 수련생과 가족을 위해 만들었습니다.
처음 도장에 오면 모든 것이 낯설지만, 하루하루 땀 흘리는 시간이 쌓이면 어느새 몸이 가벼워지고 마음이 단단해진 것을 느끼게 됩니다. 중요한 것은 빨리 배우는 것이 아니라 꾸준히 배우는 것입니다.
## 도장에 들어설 때
도장 문 앞에서는 신발을 가지런히 벗고, 들어서며 국기와 사범님께 바르게 인사합니다. 인사는 "오늘도 열심히 배우겠습니다"라는 약속입니다.
- 도복은 깨끗하게 빨아서 입습니다.
- 띠는 두 번 감아 앞에서 납작하게 묶습니다.
- 손톱과 발톱은 짧게 깎아 친구가 다치지 않게 합니다.
> 예의로 시작해서 예의로 끝난다. — 태권도 수련의 첫째 마음가짐
## 바른 자세
바른 자세는 모든 기술의 바탕입니다. 서기 자세가 흔들리면 발차기도 흔들리고, 마음이 흔들리면 자세도 흐트러집니다. 거울 앞에서 어깨와 허리를 곧게 펴고, 시선은 앞을 향하며, 숨을 고르게 쉬는 연습부터 시작해 봅시다.
매일 아침 일 분씩 바른 자세로 서 있는 연습을 하면, 학교에서 앉아 있는 자세와 걷는 모습도 함께 좋아집니다. **작은 습관이 큰 힘이 됩니다.**
# 기본 동작
기본 동작은 집을 지을 때의 주춧돌과 같습니다. 화려한 기술도 결국 기본 동작을 바르게 이어 붙인 것입니다. 이 장에서는 서기, 막기, 지르기, 차기의 네 가지 기본을 차례로 살펴봅니다.
## 서기
앞서기는 걷듯이 한 걸음 앞으로 나가 선 자세입니다. 앞굽이는 앞발 무릎을 굽혀 몸무게를 앞에 싣는 자세이고, 뒷굽이는 뒷발에 몸무게를 더 싣는 자세입니다. 어떤 서기든 발바닥 전체로 땅을 단단히 딛는 것이 중요합니다.
## 막기와 지르기
아래막기, 몸통막기, 얼굴막기는 상대의 공격으로부터 나를 지키는 동작입니다. 막기 뒤에는 곧바로 지르기가 이어집니다. 지르기를 할 때는 주먹을 단단히 쥐고, 허리를 돌려 온몸의 힘을 주먹 끝에 모읍니다.
연습할 때는 거울을 보며 팔의 높이와 각도를 확인하고, 동작이 끝나는 순간 기합과 함께 힘을 모아 봅니다. 기합은 자신감을 키우고 호흡을 바르게 해 줍니다.
## 차기
앞차기, 돌려차기, 옆차기는 태권도를 대표하는 발 기술입니다. 차기 전에 무릎을 충분히 들어 올리고, 찬 뒤에는 다리를 다시 접어 제자리로 돌아와야 균형을 잃지 않습니다.
### 함께 연습해요
- 앞차기 열 번 — 무릎을 먼저 들기
- 돌려차기 열 번 — 디딤발 돌리기
- 옆차기 다섯 번 — 발날로 차기
# 품새와 마음가짐
품새는 정해진 순서에 따라 기술을 이어 가는 혼자 하는 겨루기입니다. 태극 1장부터 8장까지 차례로 익히며, 장마다 담긴 뜻을 생각하며 수련합니다.
품새를 잘하려면 순서를 외우는 것보다 한 동작 한 동작을 정확하게 하는 것이 먼저입니다. 동작마다 시선, 호흡, 힘의 강약을 살리면 같은 품새도 훨씬 멋있어집니다.
## 끝까지 해내는 힘
승급 심사를 앞두고 긴장되는 것은 당연한 일입니다. 그동안 연습한 자신을 믿고, 틀려도 멈추지 말고 끝까지 마무리하세요. 끝까지 해내는 경험이 모여 검은 띠가 됩니다.
[가운데] **오늘도 한 걸음, 내일도 한 걸음.**
[작은글] 이 책의 예시 글은 「도서 편집 → 원고 편집기」에서 지우고 직접 쓴 원고로 바꾸어 쓰세요.`;

    return { renderSide, openNewBook, openStory, flow, masterHTML, onFrameDbl, isBook, stale, parse, preflight, htmlToMd, sanitize };
  };
})();
