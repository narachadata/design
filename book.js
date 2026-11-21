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
    const PS_ORDER = ['h1', 'h2', 'h3', 'body', 'quote', 'list', 'center', 'small', 'tip', 'warn', 'byline', 'tocTitle', 'toc1', 'toc2'];
    const PS_NAME = { h1: '장 제목', h2: '절 제목', h3: '소제목', body: '본문', quote: '인용', list: '목록', center: '가운데', small: '작은 글·캡션', tip: '도움말 상자', warn: '주의 상자', byline: '글쓴이', tocTitle: '차례 제목', toc1: '차례 — 장', toc2: '차례 — 절' };
    const PS_MARK = { h1: '# ', h2: '## ', h3: '### ', body: '', quote: '> ', list: '- ', center: '[가운데] ', small: '[작은글] ', tip: '[도움말] ', warn: '[주의] ', byline: '[글쓴이] ' };
    function psDefaults(k) {
      /* L = 본문 한 줄 높이(mm). 제목 앞뒤 간격을 줄 단위로 맞추면 쪽마다 글줄 리듬이 고르게 됨 (조판 전문가 11/21 — 인디자인 기준선 격자처럼)
         글자색은 먹 1도(K100 #000) — 회색 글은 K 비율로 (인쇄소에서 4도로 갈라져 번지지 않게) */
      const K = KINDS[k] || KINDS.general, f = K.font, z = K.size, hf = K.head, ac = K.accent || '#000000', L = z * K.lh * PT, q = v => Math.round(v * 10) / 10;
      const wordy = k === 'edu' || k === 'booklet', brk = wordy ? 'word' : 'char', bal = wordy ? 'left' : 'justify'; /* 일반 책·큰 교재: 글자 단위 + 양끝 맞춤(한국 단행본 관행) · 교재·소책자: 어절 단위 + 왼쪽 맞춤(아이들이 읽기 쉬움) */
      const S = {
        h1: { font: hf, size: Math.round(z * 2), weight: 700, lh: 1.3, align: 'left', indent: 0, indentL: 0, before: 0, after: q(2 * L), color: '#000000', ls: -0.02, start: 'right', sink: q(7 * L), keepNext: true },
        h2: { font: hf, size: Math.round(z * 1.25 * 2) / 2, weight: 700, lh: 1.4, align: 'left', indent: 0, indentL: 0, before: q(1.5 * L), after: q(0.5 * L), color: '#000000', ls: -0.01, keepNext: true },
        h3: { font: hf, size: Math.round(z * 1.05 * 2) / 2, weight: 700, lh: 1.5, align: 'left', indent: 0, indentL: 0, before: q(0.75 * L), after: q(0.25 * L), color: '#000000', ls: 0, keepNext: true },
        body: { font: f, size: z, weight: 400, lh: K.lh, align: bal, indent: 1, indentL: 0, before: 0, after: 0, color: '#000000', ls: -0.02, brk },
        quote: { font: 'Gowun Batang', size: Math.round(z * 0.95 * 2) / 2, weight: 400, lh: K.lh, align: 'left', indent: 0, indentL: 5, indentR: 5, bar: true, before: q(0.5 * L), after: q(0.5 * L), color: '#333333', ls: -0.01, brk },
        list: { font: f, size: z, weight: 400, lh: K.lh, align: 'left', indent: -1, indentL: 5, before: 0, after: 0, color: '#000000', ls: -0.02, brk: 'word' },
        center: { font: f, size: z, weight: 400, lh: K.lh, align: 'center', indent: 0, indentL: 0, before: q(0.5 * L), after: q(0.5 * L), color: '#000000', ls: -0.02, brk: 'word' },
        small: { font: f, size: Math.round(z * 0.8 * 2) / 2, weight: 400, lh: 1.55, align: 'left', indent: 0, indentL: 0, before: q(0.25 * L), after: q(0.25 * L), color: '#000000', ls: 0, brk: 'word' },
        tip: { font: f, size: Math.round(z * 0.95 * 2) / 2, weight: 400, lh: Math.min(K.lh, 1.65), align: 'left', indent: 0, indentL: 0, before: q(0.75 * L), after: q(0.75 * L), color: '#000000', ls: -0.02, brk: 'word', box: true, bg: '#EEF4FB', barColor: '#2F6FB3', label: '도움말' },
        warn: { font: f, size: Math.round(z * 0.95 * 2) / 2, weight: 400, lh: Math.min(K.lh, 1.65), align: 'left', indent: 0, indentL: 0, before: q(0.75 * L), after: q(0.75 * L), color: '#000000', ls: -0.02, brk: 'word', box: true, bg: '#FDF1EC', barColor: '#C8502D', label: '주의' },
        byline: { font: hf, size: Math.round(z * 0.9 * 2) / 2, weight: 500, lh: 1.5, align: 'right', indent: 0, indentL: 0, before: q(0.5 * L), after: q(0.5 * L), color: '#333333', ls: 0, brk: 'word' },
        tocTitle: { font: hf, size: Math.round(z * 2), weight: 700, lh: 1.3, align: 'left', indent: 0, indentL: 0, before: 0, after: q(2 * L), color: '#000000', ls: -0.02, sink: q(7 * L) },
        toc1: { font: hf, size: Math.round(z * 1.1 * 2) / 2, weight: 700, lh: 1.5, align: 'left', indent: 0, indentL: 0, before: q(0.75 * L), after: q(0.25 * L), color: '#000000', ls: 0 },
        toc2: { font: hf, size: z, weight: 400, lh: 1.5, align: 'left', indent: 0, indentL: 12, before: 0, after: q(0.1 * L), color: '#333333', ls: 0 },
      }; if (ac !== '#000000') S.h1.accent = ac; return S;
    }
    function ps() { const d = A.doc; if (d.pstyles && !Array.isArray(d.pstyles)) { d.bstyles = d.pstyles; delete d.pstyles; } /* 11/21 첫 시험판이 글 상자 문단 스타일(doc.pstyles 목록)과 같은 이름을 썼던 것 바로잡기 */ if (!d.bstyles) d.bstyles = psDefaults((d.book && d.book.kind) || 'general'); const D = psDefaults((d.book && d.book.kind) || 'general'), o = {}; PS_ORDER.forEach(k => { o[k] = Object.assign({}, D[k], d.bstyles[k] || {}); }); return o; }
    const isBook = () => !!(A.doc && A.doc.book && A.doc.book.bookMode);
    const B_ = () => A.book();

    /* ---------- 원고 읽기: 한 줄 = 한 단락 (워드·한글에서 Enter 한 번이 한 단락인 것과 같게) ----------
       # 장 · ## 절 · ### 소제목 · > 인용 · - 목록 · [가운데] · [작은글] · [쪽 나눔] · **굵게** */
    function runsOf(t) { const runs = [], re = /\*\*(.+?)\*\*/g; let i = 0, m; while ((m = re.exec(t))) { if (m.index > i) runs.push({ t: t.slice(i, m.index) }); runs.push({ t: m[1], b: 1 }); i = re.lastIndex; } if (i < t.length) runs.push({ t: t.slice(i) }); return runs.length ? runs : [{ t: '' }]; }
    const plainOf = runs => runs.map(r => r.t).join('');
    /* 원고 글 다듬기 (원고는 그대로 두고 쪽에 앉힐 때만): "곧은 따옴표" → “둥근 따옴표”, 숫자와 단위 사이는 줄이 갈리지 않게 붙임, ... → … */
    const UNIT = '(?:쪽|개|명|번|회|년|월|일|시|분|초|살|세|단|급|품|장|절|권|원|kg|g|km|m|cm|mm|%|℃)';
    function typo(t) {
      if (A.doc && A.doc.book && A.doc.book.typo === false) return t;
      let s = String(t).replace(/\.\.\./g, '…');
      s = s.replace(/"/g, (m, i, all) => /[\s(\[{\u00a0]/.test(all[i - 1] || ' ') ? '“' : '”');
      s = s.replace(/'/g, (m, i, all) => /[\s(\[{\u00a0“]/.test(all[i - 1] || ' ') ? '‘' : '’');
      s = s.replace(new RegExp('(\\d)\\s+(' + UNIT + ')(?![가-힣A-Za-z])', 'g'), '$1\u00a0$2').replace(new RegExp('(\\d)\\s+(' + UNIT + ')(?=[은는이가을를의에과와도로만]|$|[\\s.,·)])', 'g'), '$1\u00a0$2');
      return s;
    }
    function sliceRuns(runs, a, b) { const out = []; let pos = 0; for (const r of runs) { const s = pos, e = pos + r.t.length; pos = e; const x = Math.max(a, s), y = Math.min(b, e); if (y > x) out.push(Object.assign({}, r, { t: r.t.slice(x - s, y - s) })); } return out; }
    const runsHTML = runs => runs.map(r => r.b ? `<b>${esc(r.t)}</b>` : esc(r.t)).join('');
    const IMG_RE = /^!\[(.*?)\]\(((?:img:[A-Za-z0-9_-]+\s*,?\s*)+)\)$/;
    const imgRefs = s => String(s || '').split(',').map(x => x.trim().replace(/^img:/, '')).filter(x => /^[A-Za-z0-9_-]+$/.test(x));
    function parse(md) {
      const out = []; String(md || '').replace(/\r/g, '').split('\n').forEach((raw, line) => {
        const s = raw.trim(); if (!s) return;
        if (/^\[\s*쪽\s*나눔\s*\]$/.test(s)) { out.push({ st: 'break', line }); return; }
        { const im = s.match(IMG_RE); if (im) { const refs = imgRefs(im[2]), caps = im[1].split('|').map(c => typo(c.trim())); if (refs.length) { out.push({ st: 'img', ref: refs[0], refs, cap: caps[0] || '', caps, line, runs: [{ t: im[1] }], plain: '' }); return; } } } /* 사진 — 여러 장이면 한 줄에 나란히 */ /* 사진: ![설명](img:번호) — 설명은 사진 아래 캡션 */
        let st = 'body', t = s, m;
        if ((m = s.match(/^###\s*(.*)$/))) { st = 'h3'; t = m[1]; } else if ((m = s.match(/^##\s*(.*)$/))) { st = 'h2'; t = m[1]; } else if ((m = s.match(/^#\s*(.*)$/))) { st = 'h1'; t = m[1]; }
        else if ((m = s.match(/^>\s?(.*)$/))) { st = 'quote'; t = m[1]; } else if ((m = s.match(/^[-*•·]\s+(.*)$/))) { st = 'list'; t = '• ' + m[1]; }
        else if ((m = s.match(/^\[가운데\]\s*(.*)$/))) { st = 'center'; t = m[1]; } else if ((m = s.match(/^\[작은\s?글\]\s*(.*)$/))) { st = 'small'; t = m[1]; }
        else if ((m = s.match(/^\[(?:도움말|팁)\]\s*(.*)$/))) { st = 'tip'; t = m[1]; } else if ((m = s.match(/^\[주의\]\s*(.*)$/))) { st = 'warn'; t = m[1]; } else if ((m = s.match(/^\[글쓴이\]\s*(.*)$/))) { st = 'byline'; t = /^[—–-]/.test(m[1]) ? m[1] : '— ' + m[1]; }
        let chapNo = null; if (st === 'h1' && /\{번호없음\}/.test(t)) { t = t.replace(/\s*\{번호없음\}\s*/g, ' ').trim(); chapNo = false; } /* 장 번호를 붙이지 않을 장 (머리말·맺음말) */
        const runs = runsOf(typo(t)); out.push({ st, runs, plain: plainOf(runs), line, chapNo });
      }); return out;
    }

    /* ---------- 단락 → HTML (인라인 스타일만 써서 PNG·PDF 내보내기에도 그대로) ---------- */
    function pHTML(runs, s, o) {
      o = o || {}; const top = o.first ? (o.sink || 0) : (s.before || 0), ind = o.cont || o.noIndent ? (s.indent < 0 ? s.indent : 0) : (s.indent || 0);
      const lead = o.cont && s.indent < 0 ? 0 : ind; /* 목록 다음 줄(이어진 조각)은 매달린 들여쓰기 없이 */
      const bar = s.bar ? `border-left:0.5mm solid ${s.barColor || '#c9c9c9'};` : '', padL = r1((s.indentL || 0) - (s.bar ? 0 : 0));
      const css = `margin:0;padding:${r1(top)}mm ${r1(s.indentR || 0)}mm ${r1(s.after || 0)}mm ${padL}mm;${bar}text-indent:${lead}em;font-family:'${s.font}','Noto Serif KR','Noto Sans KR',serif;font-size:${s.size}pt;line-height:${s.lh};font-weight:${s.weight};color:${s.color};text-align:${s.align};${o.splitEnd && s.align === 'justify' ? 'text-align-last:justify;' : ''}letter-spacing:${o.ls != null ? o.ls : (s.ls || 0)}em;word-break:${s.brk === 'char' ? 'normal' : 'keep-all'};overflow-wrap:anywhere;line-break:strict;`;  /* 한글 줄바꿈: 어절(기본) · 글자 (W3C klreq — 단락마다 고름) */
      if (o.toc) return `<p style="${css}display:flex;align-items:baseline;gap:1.5mm;text-indent:0">${o.tocNo ? `<span style="flex:0 0 auto;font-weight:600;color:${s.color}">${esc(o.tocNo)}</span>` : ''}<span style="flex:0 1 auto">${runsHTML(runs)}</span><span style="flex:1 1 auto;${o.noLeader ? '' : `border-bottom:0.3mm dotted ${s.color};opacity:.55;`}transform:translateY(-0.8mm)"></span><span style="flex:0 0 auto;font-variant-numeric:tabular-nums">${esc(o.toc)}</span></p>`;
      if (s.box) { const lab = !o.cont && s.label ? `<b style="color:${s.barColor};font-weight:700;margin-right:1.5mm">${esc(s.label)}</b>` : ''; return `<p style="margin:0;padding:${r1(top)}mm 0 ${r1(s.after || 0)}mm 0;text-indent:0;"><span style="display:block;background:${s.bg};border-left:0.8mm solid ${s.barColor};padding:${o.cont ? 1.2 : 2.6}mm 3.2mm ${o.splitEnd ? 1.2 : 2.6}mm 3.2mm;font-family:'${s.font}','Noto Sans KR',sans-serif;font-size:${s.size}pt;line-height:${s.lh};font-weight:${s.weight};color:${s.color};text-align:${s.align};letter-spacing:${o.ls != null ? o.ls : (s.ls || 0)}em;word-break:${s.brk === 'char' ? 'normal' : 'keep-all'};overflow-wrap:anywhere;line-break:strict;">${lab}${runsHTML(runs)}</span></p>`; } /* 도움말·주의 상자 (조판 전문가 ★) — 쪽을 넘어가면 이어진 상자로 */
      if (o.chapNo) { const ac = s.accent || s.color; return `<p style="${css}"><span style="display:block;font-size:9pt;font-weight:600;letter-spacing:0.08em;line-height:1.4;color:${ac};padding:0 0 2.5mm 0">${esc(o.chapNo)}</span>${runsHTML(runs)}<span style="display:block;width:12mm;border-top:0.27mm solid ${ac};margin:4mm 0 0 0"></span></p>`; } /* 장 시작: 「제1장」 꼬리표 · 제목 · 짧은 줄 */
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
      const pages = [], heads = [], placed = []; let pg = null, frames = [], fi = 0, fy = 0, content = [], plain = [], lastAfter = 0, chap = '', sec = '', chapN = 0, firstLine = -1, overflow = 0;
      const numOn = kind === 'body' && A.doc.book.chapNum === true;
      const absNow = () => abs0 + pages.length - 1, fr = () => frames[fi], avail = () => fr().h - fy;
      const startFrame = () => { content = []; plain = []; lastAfter = 0; firstLine = -1; if (fr()) mbox(fr().w); };
      const closeFrame = (part) => { if (!content.length || !fr()) return; const f = fr(), txt = plain.join('\n'), hh = part ? Math.min(avail(), r1(hOf(content.join(''), 0) + 0.4)) : avail(); pg.els.push(Object.assign({}, A.TEXT_DEF, { id: A.uid(), x: f.x, y: r1(f.y + fy), w: f.w, h: r1(hh), sizing: 'fixed', text: txt, html: content.join(''), htmlFor: txt, font: S.body.font, size: S.body.size, lh: S.body.lh, color: S.body.color, align: 'left', ls: 0, flowFrame: kind, flowLine: firstLine, locked: true, name: kind === 'toc' ? '차례 (자동)' : '본문 (원고 — 두 번 눌러 고치기)' })); if (part) fy += hh; };
      const newPg = () => { pg = A.newPage(); pg.label = ''; if (kind === 'toc') pg.toc = true; else pg.flow = true; pg.chap = chap; pg.sec = sec; const ex = extras && extras.length ? extras.shift() : null; if (ex && ex.length) pg.els.push(...ex); pages.push(pg); frames = frameRects(absNow()); fi = 0; fy = 0; startFrame(); };
      const blankPg = () => { pg.blank = true; pg.flow = kind !== 'toc'; frames = []; newPg(); };
      const pending = [], floatOn = kind === 'body' && A.doc.book.imgFloat !== false; let flushing = false;
      const nextFrame = () => { closeFrame(); fi++; fy = 0; if (fi >= frames.length) newPg(); else startFrame(); flushPending(); };
      const fits = (html, after, maxH) => hOf(content.join('') + html, after) <= (maxH != null ? maxH : avail()) + 0.05;
      const lineMM = s => s.size * s.lh * PT;
      const pageEmpty = () => fi === 0 && fy === 0 && !content.length && !pg.els.some(e => e.flowFrame || e.flowImg);
      /* 사진 놓기 (인디자인 '고정된 개체'처럼 원고 흐름 안의 자리) — 단 폭 기준 크기, 남은 자리가 모자라면 다음 단·쪽 위로, 단보다 크면 줄임. 사진은 보통 그림 요소라 눌러서 편집 */
      const placeRow = (p) => { /* 나란한 사진: 높이를 맞춰 한 줄에 (단 폭을 나눠 씀) */
        const bim = A.doc.bimgs || {}, refs = p.refs.filter(r => bim[r]); if (!refs.length) return; const Sc = S.small, capCss = Object.assign({}, Sc, { align: 'center', indent: 0, before: 0, after: 0 }), g = 3;
        const size = () => { const f = fr(); const inv = refs.reduce((a, r) => a + 1 / (bim[r].ar || 0.66), 0); let h = (f.w - g * (refs.length - 1)) / inv; let ws = refs.map(r => h / (bim[r].ar || 0.66));
          const capH = Math.max(0, ...refs.map((r, j) => { const c = (p.caps || [])[j]; if (!c) return 0; mbox(ws[j]); return hOf(pHTML(runsOf(c), capCss, {}), 0); })); mbox(f.w);
          const gT = (content.length || fy > 0) ? 3 : 0, gB = 3, room = f.h - gT - gB - (capH ? capH + 2 : 0); if (h > room) { const k = Math.max(0.2, room / h); h *= k; ws = ws.map(w => w * k); }
          return { h, ws, capH, gT, gB, need: gT + h + (capH ? capH + 2 : 0) + gB }; };
        let z = size(); const used = content.length ? hOf(content.join(''), 0) : 0;
        if (fy + used + z.need > fr().h + 0.05 && (content.length || fy > 0)) { if (floatOn && !flushing) { pending.push(p); return; } if (flushing) return false; nextFrame(); z = size(); }
        if (content.length) closeFrame(true);
        fy += z.gT; const f = fr(), tw = z.ws.reduce((a, b) => a + b, 0) + g * (refs.length - 1); let x = f.x + (f.w - tw) / 2; const y = r1(f.y + fy);
        refs.forEach((r, j) => { const I = bim[r], w = z.ws[j]; pg.els.push(Object.assign({ type: 'image', src: I.src, fit: 'cover', pos: '50% 50%', opacity: 1, flip: false, radius: 0, rot: 0 }, I.ed || {}, { id: A.uid(), x: r1(x), y, w: r1(w), h: r1(z.h), flowImg: r, flowRow: true, flowLine: p.line, flowW: r1(w), flowH: r1(z.h), name: '사진(나란히)' + ((p.caps || [])[j] ? ': ' + p.caps[j].slice(0, 20) : '') + ' (누르면 편집)' }));
          const c = (p.caps || [])[j]; if (c) pg.els.push(Object.assign({}, A.TEXT_DEF, { id: A.uid(), x: r1(x), y: r1(y + z.h + 2), w: r1(w), h: r1(z.capH + 0.4), sizing: 'fixed', text: c, html: pHTML(runsOf(c), capCss, {}), htmlFor: c, font: Sc.font, size: Sc.size, lh: Sc.lh, color: Sc.color, align: 'center', ls: 0, flowFrame: kind, flowLine: p.line, locked: true, name: '사진 설명 (원고에서 고치기)' }));
          placed.push(r); x += w + g; });
        fy += z.h + (z.capH ? z.capH + 2.4 : 0) + z.gB; startFrame(); return true;
      };
      const placeImg = (p) => {
        if (p.refs && p.refs.length > 1) return placeRow(p);
        const I = (A.doc.bimgs || {})[p.ref]; if (!I) return; const Sc = S.small, capCss = Object.assign({}, Sc, { align: (I.wp || 100) >= 100 ? 'left' : 'center', indent: 0, before: 0, after: 0 });
        const size = () => { const f = fr(); let w = f.w * Math.min(100, Math.max(10, I.wp || 100)) / 100, h = w * (I.ar || 0.66); let capH = 0; if (p.cap) { mbox(w); capH = hOf(pHTML(runsOf(p.cap), capCss, {}), 0); mbox(f.w); } const gT = (content.length || fy > 0) ? 3 : 0, gB = 3; const room = f.h - gT - gB - (capH ? capH + 2 : 0); if (h > room) { const k = Math.max(0.2, room / h); w *= k; h *= k; } return { w, h, capH, gT, gB, need: gT + h + (capH ? capH + 2 : 0) + gB }; };
        let z = size(); const used = content.length ? hOf(content.join(''), 0) : 0;
        if (fy + used + z.need > fr().h + 0.05 && (content.length || fy > 0)) {
          if (floatOn && !flushing) { pending.push(p); return; } /* 사진 띄워 놓기: 남은 자리는 뒤 글로 채우고 사진은 다음 단·쪽 위로 (책 관행 · 인디자인 '다음 단 위로') */
          if (flushing) return false; nextFrame(); z = size(); }
        if (content.length) closeFrame(true);
        fy += z.gT; const f = fr(), x = r1(f.x + (f.w - z.w) / 2), y = r1(f.y + fy);
        pg.els.push(Object.assign({ type: 'image', src: I.src, fit: 'cover', pos: '50% 50%', opacity: 1, flip: false, radius: 0, rot: 0 }, I.ed || {}, { id: A.uid(), x, y, w: r1(z.w), h: r1(z.h), flowImg: p.ref, flowLine: p.line, flowW: r1(z.w), flowH: r1(z.h), name: '사진' + (p.cap ? ': ' + p.cap.slice(0, 20) : '') + ' (누르면 편집)' }));
        placed.push(p.ref); fy += z.h;
        if (p.cap) { const t = p.cap, ch = r1(z.capH + 0.4); pg.els.push(Object.assign({}, A.TEXT_DEF, { id: A.uid(), x, y: r1(f.y + fy + 2), w: r1(z.w), h: ch, sizing: 'fixed', text: t, html: pHTML(runsOf(t), capCss, {}), htmlFor: t, font: Sc.font, size: Sc.size, lh: Sc.lh, color: Sc.color, align: capCss.align, ls: 0, flowFrame: kind, flowLine: p.line, locked: true, name: '사진 설명 (원고에서 고치기)' })); fy += ch + 2; }
        fy += z.gB; startFrame(); return true;
      };
      /* 기다리던 사진을 새 단·쪽 맨 위에 차례로 (들어가는 만큼) */
      function flushPending() { if (!pending.length || flushing) return; flushing = true; try { while (pending.length) { const p = pending[0]; if (placeImg(p) === false) break; pending.shift(); } } finally { flushing = false; } }
      newPg();
      for (let n = 0; n < paras.length; n++) {
        const p = paras[n];
        if (p.st === 'break') { if (pending.length) nextFrame(); if (!pageEmpty()) { closeFrame(); newPg(); flushPending(); } continue; }
        if (p.st === 'img') { if (kind === 'body') placeImg(p); continue; }
        const s = S[p.st] || S.body; let runs = p.runs, cont = false, sink = 0; const tight = A.doc.book.tighten !== false && ['body', 'quote', 'list', 'tip', 'warn'].includes(p.st);
        const prev = paras[n - 1], noIndent = p.st === 'body' && (!prev || /^h\d$/.test(prev.st) || prev.st === 'break' || prev.st === 'tocTitle');
        if (s.start && s.start !== 'none' && kind === 'body' && pending.length) { let g = 0; while (pending.length && g++ < 50) nextFrame(); } /* 앞 장의 기다리던 사진은 장이 바뀌기 전에 */
        if (s.start && s.start !== 'none' && kind === 'body') { /* 장 시작: 새 쪽 — 오른쪽(홀수) 쪽이 아니면 빈 쪽 하나 */
          if (!pageEmpty()) { closeFrame(); newPg(); }
          if (s.start === 'right' && A.book().facing && !A.isRightPage(absNow())) blankPg();
          chap = p.plain; sec = ''; pg.chap = chap; pg.sec = ''; pg.chapOpen = true; pg.label = chap; sink = Number(s.sink) || 0;
        } else if (s.sink && pageEmpty()) sink = Number(s.sink) || 0;
        if (p.st === 'h1' && kind === 'body' && !(s.start && s.start !== 'none')) { chap = p.plain; sec = ''; if (pageEmpty()) { pg.chap = chap; pg.sec = ''; pg.label = chap; } }
        if (p.st === 'h2' && kind === 'body') { sec = p.plain; if (pageEmpty()) pg.sec = sec; }
        let chapNo = null; if (p.st === 'h1' && numOn && p.chapNo !== false) { chapN++; chapNo = `제${chapN}장`; }
        let guard = 0;
        while (runs && guard++ < 400) {
          const first = !content.length, o = { first, cont, noIndent, sink: first ? sink : 0, toc: p.toc, chapNo, tocNo: p.tocNo, noLeader: p.noLeader };
          /* 끝줄 한두 글자 막기: 마지막 줄이 아주 짧으면(줄 하나를 더 먹으면) 자간을 살짝 좁혀 한 줄 위로 (조판 전문가 — 짧은 끝줄 당기기) */
          if (tight && !p.toc) { const h0 = hOf(pHTML(runs, s, o), 0), o2 = Object.assign({}, o, { ls: r1((s.ls || 0) * 100 - 3) / 100 }), h1 = hOf(pHTML(runs, s, o2), 0); if (h1 < h0 - 0.3) o.ls = o2.ls; }
          const html = pHTML(runs, s, o);
          if (fits(html, s.after)) {
            /* 제목은 다음 단락 첫머리와 함께 (다음 줄과 함께 — 쪽 끝에 제목만 남지 않게) */
            const nx = paras[n + 1];
            if (s.keepNext && nx && nx.st !== 'break' && !first) { /* 제목 아래에 다음 단락이 적어도 2줄(짧으면 통째로) 들어갈 자리가 있어야 함 — 없으면 제목도 다음 쪽으로 */
              const s2 = S[nx.st] || S.body, nxH = hOf(pHTML(nx.runs, s2, {}), s2.after), need = Math.min(nxH, 2 * lineMM(s2) + (s2.before || 0)) - 0.3;
              const remain = avail() - hOf(content.join('') + html, 0); if (!/^h\d$/.test(nx.st) && remain < need) { nextFrame(); continue; } }
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
              if (restLines === 1 && lines > 2) { const k2 = best(cands.filter(c => c < k), avail() - L); if (k2) k = k2; } /* 과부 줄: 다음 쪽 첫머리에 한 줄만 가지 않게 */
              content.push(pHTML(sliceRuns(runs, 0, k), s, Object.assign({}, o, { splitEnd: true }))); plain.push(plainOf(sliceRuns(runs, 0, k)).trimEnd()); if (firstLine < 0) firstLine = p.line;
              runs = sliceRuns(runs, k, txt.length); if (runs.length && runs[0].t) runs[0] = Object.assign({}, runs[0], { t: runs[0].t.replace(/^\s+/, '') }); cont = true; sink = 0; nextFrame(); continue;
            }
          }
          if (first) { content.push(html); plain.push(plainOf(runs)); overflow++; if (firstLine < 0) firstLine = p.line; runs = null; break; } /* 빈 상자에도 안 들어가는 큰 제목 — 넘친 채로 두고 점검에 표시 */
          nextFrame();
        }
        if (/^h[123]$/.test(p.st) && kind === 'body') heads.push({ st: p.st, text: p.plain, abs: absNow(), no: chapNo });
        if (p.st === 'h2' && kind === 'body' && pg.sec !== sec && !pg.sec) pg.sec = sec;
      }
      { let g = 0; while (pending.length && g++ < 50) nextFrame(); } /* 끝에 남은 사진 */
      closeFrame();
      /* 끝의 빈 쪽 정리 (본문 상자도 직접 넣은 요소도 없으면) */
      while (pages.length > 1 && !pages[pages.length - 1].els.length) pages.pop();
      return { pages, heads, overflow, placed };
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
        await harvestImgs(paras);
        const extras = d.pages.filter(p => p.flow && !p.blank).map(p => p.els.filter(e => !e.flowFrame && !e.flowImg));
        let res = null, toc = null;
        for (let pass = 0; pass < 3; pass++) {
          d.pages = d.pages.filter(p => !p.flow);
          let i0 = d.pages.findIndex(p => p.back); if (i0 < 0) i0 = d.pages.length;
          res = layoutStream(paras, i0, S, 'body', extras.map(x => x.slice()));
          d.pages.splice(i0, 0, ...res.pages);
          { const bi = d.pages.findIndex(p => p.back); if (bi > 0 && B_().facing && A.isRightPage(bi)) { const bp = A.newPage(); bp.flow = true; bp.blank = true; bp.label = ''; d.pages.splice(bi, 0, bp); } } /* 판권은 책 맨 끝 왼쪽(짝수) 쪽에 — 모자라면 빈 쪽 하나 */
          toc = updateToc(res.heads, S); if (!toc || !toc.changed) break;
        }
        d.book.flowStamp = hashOf(d.bstory.md + imgSig() + JSON.stringify(S) + JSON.stringify([B_().mg, B_().cols, B_().gutter, d.w, d.h, B_().facing, B_().imgFloat, B_().chapNum, B_().typo, B_().tighten]));
        d.book.flowImgs = res.placed.slice(); d.book.lastFlow = { imgs: res.placed.length, pages: res.pages.length, heads: res.heads.length, overflow: res.overflow, paras: paras.length, chars: paras.reduce((a, p) => a + (p.plain || '').length, 0) };
        if (opt.amend && A.amendCommit) A.amendCommit(); else A.commit(); /* 쪽에서 사진을 고친 뒤 다시 흘린 것은 같은 되돌리기 한 칸으로 */
        if (curFlowIdx >= 0) { const fl = d.pages.filter(p => p.flow); const tgt = fl[Math.min(curFlowIdx, fl.length - 1)]; if (tgt) A.setCur(d.pages.indexOf(tgt)); }
        else if (keepCur && d.pages.includes(keepCur)) A.setCur(d.pages.indexOf(keepCur)); else A.setCur(Math.min(A.cur, d.pages.length - 1));
        A.renderAll(); A.setStatus('');
        if (!opt.quiet) A.toast(`원고를 흘려 넣었습니다 — 본문 ${res.pages.length}쪽${res.heads.length ? ` · 제목 ${res.heads.length}개` : ''}${toc && toc.n ? ` · 차례 ${toc.n}줄` : ''}${res.overflow ? ` · 넘친 글 ${res.overflow}곳(점검 보기)` : ''}`);
        return res;
      } catch (e) { console.error(e); A.toast('흘려 넣지 못했습니다: ' + e.message, true); A.setStatus(''); return null; }
      finally { flowing = false; if (flowAgain) { flowAgain = false; setTimeout(() => flow({ quiet: true }), 50); } }
    }
    /* 쪽 위에서 고친 사진(자르기·필터·바꾼 그림·크기)을 원고 사진(doc.bimgs)에 거둬 두고, 비율을 모르는 사진은 그림을 읽어 알아냄 */
    async function harvestImgs(paras) {
      const d = A.doc, bim = d.bimgs || (d.bimgs = {}), colW = (frameRects(0)[0] || { w: 100 }).w, SKIP = ['id', 'x', 'y', 'w', 'h', 'flowImg', 'flowLine', 'flowW', 'flowH', 'name', 'group', 'locked'];
      d.pages.forEach(p => p.els.forEach(e => { const I = e.flowImg && bim[e.flowImg]; if (!I) return; const ed = {}; for (const k in e) if (!SKIP.includes(k) && k !== 'flowRow') ed[k] = e[k]; I.ed = ed; if (e.flowRow) return;
        if (e.flowW && Math.abs(e.w - e.flowW) > 0.5) I.wp = Math.max(10, Math.min(100, Math.round(e.w / colW * 100)));
        if (e.flowW && (Math.abs(e.w - e.flowW) > 0.5 || Math.abs(e.h - e.flowH) > 0.5) && e.w > 0) I.ar = Math.round(e.h / e.w * 1000) / 1000; }));
      await Promise.all(paras.filter(p => p.st === 'img').flatMap(p => p.refs || [p.ref]).filter(r => bim[r] && !bim[r].ar).map(r => new Promise(res => { const im = new Image(); im.onload = () => { bim[r].ar = im.naturalWidth ? Math.round(im.naturalHeight / im.naturalWidth * 1000) / 1000 : 0.66; res(); }; im.onerror = () => { bim[r].ar = 0.66; res(); }; im.src = A.imgUrl({ src: bim[r].src, w: 100, h: 100 }) || ''; setTimeout(res, 4000); })));
    }
    /* 쪽에서 사진 크기를 바꾸면 다시 흘리고, 사진을 지우면 원고의 그 사진 줄도 지움 (app.js commit 뒤에 부름) */
    function afterCommit() {
      if (flowing || !isBook()) return; const d = A.doc, have = new Set(); let moved = false;
      d.pages.forEach(p => p.els.forEach(e => { if (!e.flowImg) return; have.add(e.flowImg); if (!e.flowRow && e.flowW && (Math.abs(e.w - e.flowW) > 0.5 || Math.abs(e.h - e.flowH) > 0.5)) moved = true; }));
      const gone = (d.book.flowImgs || []).filter(id => !have.has(id));
      if (gone.length) { d.bstory.md = d.bstory.md.split('\n').map(l => { const m = l.trim().match(IMG_RE); if (!m) return l; const refs = imgRefs(m[2]), caps = m[1].split('|'); const keep = refs.map((r, j) => [r, caps[j] || '']).filter(([r]) => !gone.includes(r)); if (keep.length === refs.length) return l; if (!keep.length) return null; return `![${keep.map(k => k[1].trim()).join('|')}](${keep.map(k => 'img:' + k[0]).join(',')})`; }).filter(l => l != null).join('\n'); d.book.flowImgs = (d.book.flowImgs || []).filter(id => have.has(id)); A.toast(`사진 ${gone.length}장을 원고에서도 뺐습니다 (되돌리기 Ctrl+Z)`); flowSoon(200, true); return; }
      if (moved) flowSoon(350, true);
    }
    /* 원고에 사진 넣기 — 파일을 문서 그림으로 넣고 번호를 돌려줌 */
    async function addPhotoFiles(files) {
      const d = A.doc, bim = d.bimgs || (d.bimgs = {}), ids = [];
      for (const f of files) { if (!/^image\//.test(f.type)) continue; const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); }); const id = 'p' + A.uid().slice(0, 6); bim[id] = { src: A.addAsset(url), wp: 100, name: f.name }; ids.push({ id, name: f.name.replace(/\.[^.]+$/, '') }); }
      return ids;
    }
    const imgSig = () => JSON.stringify(Object.entries(A.doc.bimgs || {}).map(([k, v]) => [k, v.wp, v.ar, v.src && v.src.length]));
    const hashOf = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
    let flowT = 0; const flowSoon = (ms, amend) => { clearTimeout(flowT); flowT = setTimeout(() => flow({ quiet: true, amend }), ms || 500); };
    const imgMoved = () => A.doc.pages.some(p => p.els.some(e => e.flowImg && !e.flowRow && e.flowW && (Math.abs(e.w - e.flowW) > 0.5 || Math.abs(e.h - e.flowH) > 0.5)));
    const stale = () => isBook() && A.doc.bstory && (imgMoved() || A.doc.book.flowStamp !== hashOf(A.doc.bstory.md + imgSig() + JSON.stringify(ps()) + JSON.stringify([B_().mg, B_().cols, B_().gutter, A.doc.w, A.doc.h, B_().facing, B_().imgFloat, B_().chapNum, B_().typo, B_().tighten])));

    /* ---------- 차례: 장·절 제목과 쪽 번호로 차례 쪽(pg.toc)을 다시 채움 (인디자인 '목차 업데이트'를 흘릴 때마다 저절로) ---------- */
    function updateToc(heads, S) {
      const d = A.doc, B = B_(); const t0 = d.pages.findIndex(p => p.toc); if (t0 < 0) return null;
      const lv = B.tocLevel || 2, rows = heads.filter(h => h.st === 'h1' || (lv >= 2 && h.st === 'h2') || (lv >= 3 && h.st === 'h3'));
      const paras = [{ st: 'tocTitle', runs: [{ t: B.tocTitle || '차례' }], plain: B.tocTitle || '차례', line: -1 }].concat(rows.map(h => ({ st: h.st === 'h1' ? 'toc1' : 'toc2', runs: [{ t: h.text }], plain: h.text, line: -1, toc: String(A.bookNum(h.abs) == null ? h.abs + 1 : A.bookNum(h.abs)), tocNo: h.st === 'h1' ? h.no || '' : '', noLeader: h.st === 'h1' })));
      const oldN = d.pages.filter(p => p.toc).length, extras = d.pages.filter(p => p.toc).map(p => p.els.filter(e => !e.flowFrame && !e.flowImg));
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
        const sc = 300 / Math.max(NB.w * 2, NB.h * 1.25), pw = NB.w * sc, ph = NB.h * sc, fpx = size * PT * sc, cols = Number(NB.cols || k.cols) || 1;
        const wordy = NB.kind === 'edu' || NB.kind === 'booklet', txt = esc(SAMPLE(NB.title || '이 책').split('\n').filter(l => !/^[#>\[-]/.test(l)).join(' ')).repeat(3);
        const body = `<div class="nb-txt" style="font-family:'${esc(font)}','Noto Serif KR',serif;font-size:${fpx}px;line-height:${lh};column-count:${cols};column-gap:${6 * sc}px;text-align:${wordy ? 'left' : 'justify'};word-break:${wordy ? 'keep-all' : 'normal'}">${txt}</div>`;
        const head = `<div class="nb-txt nb-h" style="font-family:'${esc(k.head)}','Noto Sans KR',sans-serif;padding-top:${Math.min(th * 0.3, 7 * size * lh * PT) * sc}px"><span style="font-size:${9 * PT * sc}px;color:${k.accent || '#000'}">제1장</span><b style="font-size:${size * 2 * PT * sc}px">태권도를 시작하며</b><i style="border-top-color:${k.accent || '#000'}"></i></div>`;
        const prev = `<div class="nb-spread" style="width:${pw * 2}px;height:${ph}px">${[0, 1].map(s => { const right = s === 1, L = (right ? M.inner : M.outer) * sc, R = (right ? M.outer : M.inner) * sc; return `<div class="nb-pg" style="width:${pw}px;height:${ph}px"><div class="nb-tb" style="left:${L}px;right:${R}px;top:${M.top * sc}px;bottom:${M.bottom * sc}px">${right ? head + body : body}</div>${right ? '' : `<span class="nb-rh" style="left:${L}px;right:${R}px;bottom:${(NB.h - M.top + Math.min(5, M.top * 0.3)) * sc}px">${esc(NB.title || '책 제목')}</span>`}<span class="nb-no" style="${right ? 'right' : 'left'}:${M.outer * sc}px;top:${(NB.h - M.bottom + Math.min(8, M.bottom * 0.4)) * sc}px">${right ? 5 : 4}</span></div>`; }).join('')}</div>`;
        const cpl = Math.max(1, Math.floor((tw - 6 * (cols - 1)) / cols / (size * PT * 0.98))) * cols, lpp = Math.max(1, Math.floor(th / (size * lh * PT))), perPage = cpl * lpp;
        dl.innerHTML = `<div class="dhead"><h2>📚 새 책 만들기 <small>인디자인·쿽 방식 — 판형·여백·본문을 정하면 원고가 저절로 쪽에 흘러 들어갑니다</small></h2><button class="btn sm" data-close>닫기</button></div>
        <div class="dbody nb">
          <div class="nb-side">
            <h3>1. 책 종류</h3><div class="nb-kinds">${Object.entries(KINDS).map(([id, x]) => `<button class="nb-kind ${NB.kind === id ? 'on' : ''}" data-nbk="${id}"><b>${x.name}</b><small>${x.sub}</small></button>`).join('')}</div>
            <h3>2. 판형 (책 크기)</h3><div class="nb-trims">${TRIMS.map(t => `<button class="nb-trim ${NB.trim === t[0] ? 'on' : ''}" data-nbt="${t[0]}"><b>${t[1]}</b><small>${t[0] === 'custom' ? t[4] : `${t[2]}×${t[3]}mm · ${t[4]}`}</small></button>`).join('')}</div>
            ${NB.trim === 'custom' ? `<div class="grid2"><label class="f"><span>가로(mm)</span><input type="number" data-nbn="w" value="${NB.w}" min="50" max="600"></label><label class="f"><span>세로(mm)</span><input type="number" data-nbn="h" value="${NB.h}" min="50" max="600"></label></div>` : ''}
            <h3>3. 제목 · 지은이</h3><div class="grid2"><label class="f"><span>책 제목</span><input type="text" data-nbs="title" value="${esc(NB.title)}" placeholder="예: 나라차 수련 교본"></label><label class="f"><span>지은이 · 펴낸 곳</span><input type="text" data-nbs="author" value="${esc(NB.author)}"></label></div>
          </div>
          <div class="nb-main">
            <div class="nb-prevwrap">${prev}<p class="hint" style="margin:8px 0 0;text-align:center">펼침면 미리보기 — 고른 글꼴·크기·행간 그대로 · 판면 ${tw}×${th}mm · 한 쪽에 ${lpp}줄, 약 ${Math.round(perPage / 10) * 10}자 (원고지 ${Math.round(perPage / 200 * 10) / 10}장)</p></div>
            <h3>여백 (mm) <small>펼침면 기준 — 안쪽은 제본되는 쪽</small></h3>
            <div class="grid4">${[['top', '위'], ['bottom', '아래'], ['inner', '안쪽'], ['outer', '바깥쪽']].map(([k, t]) => `<label class="f"><span>${t}</span><input type="number" step="0.5" min="5" data-nbm="${k}" value="${M[k]}"></label>`).join('')}</div>
            <h3>본문</h3>
            <div class="grid4"><label class="f"><span>본문 글꼴</span><select data-nbs="font">${fontOpts(font)}</select></label><label class="f"><span>글자 크기(pt)</span><input type="number" step="0.5" min="7" max="20" data-nbn="size" value="${size}"></label><label class="f"><span>행간(%)</span><input type="number" step="5" min="120" max="250" data-nbn="lhp" value="${Math.round(lh * 100)}"></label><label class="f"><span>단</span><select data-nbn="cols">${[1, 2, 3].map(c => `<option value="${c}" ${(NB.cols || k.cols) === c ? 'selected' : ''}>${c}단</option>`).join('')}</select></label></div>
            <h3>제본 · 앞쪽</h3>
            <div class="grid2"><label class="f"><span>제본</span><select data-nbs="bind"><option value="perfect" ${NB.bind === 'perfect' ? 'selected' : ''}>무선 제본 (책등 있는 책)</option><option value="saddle" ${NB.bind === 'saddle' ? 'selected' : ''}>중철 (스테이플 — 4의 배수 쪽)</option></select></label>
              <div><label class="chk"><input type="checkbox" data-nbc="cover" ${NB.cover ? 'checked' : ''}> 맨 앞에 표지 쪽 (보기·집 인쇄용)</label><label class="chk"><input type="checkbox" data-nbc="sample" ${NB.sample ? 'checked' : ''}> 보기 원고 넣기 (태권도 교본 예시 — 나중에 바꾸기)</label></div></div>
            <p class="hint">만들면 <b>속표지 · 차례 · 본문(원고가 자동으로 흐름) · 판권</b> 쪽이 생기고, 왼쪽 쪽 위에는 책 제목, 오른쪽 쪽 위에는 장 제목, 바깥쪽 아래에 쪽 번호가 저절로 들어갑니다. 도련은 인쇄소 기준 사방 3mm. 지금 문서는 그대로 남습니다(저장하지 않았다면 '직전 문서'로 보관).</p>
          </div>
          <div class="nb-foot"><span>${esc(k.name)} · ${esc(T()[1])} ${NB.w}×${NB.h}mm · 본문 ${size}pt/${Math.round(lh * 100)}% · ${cols}단 · ${NB.bind === 'saddle' ? '중철' : '무선'}</span><button class="btn" data-close>취소</button><button class="btn primary" id="nbGo">📚 이대로 책 만들기</button></div></div>`;
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
    async function createBook() { return makeBook(Object.assign({}, NB)); }
    /* 책 만들기 (마법사·인디자인 가져오기 공용) — o: kind·title·author·w·h·mg·cols·font·size·lh·bind·cover·sample·md */
    async function makeBook(NB) {
      NB.kind = NB.kind || 'general'; if (!NB.mg) NB.mg = marginsFor(NB.w, NB.h, NB.kind);
      const K = KINDS[NB.kind], title = (NB.title || '').trim() || (NB.kind === 'edu' ? '나라차 수련 교본' : NB.kind === 'booklet' ? '나라차 소식' : '나라차 이야기');
      const kept = await A.newDocKeep(); if (kept === false) return;
      const d = A.newDoc(['custom', title, NB.w, NB.h]); d.name = title; d.bleed = 3; d.cropMarks = false; d.pages = [];
      d.book = Object.assign(A.clone(A.BOOK_DEF), { on: true, bookMode: true, kind: NB.kind, bind: NB.bind, title, author: NB.author || '', start: 1, skip: 0, facing: true, pos: 'outer', style: 'n', size: Math.max(7.5, Math.round((NB.size || K.size) * 0.75 * 2) / 2), color: '#4d4d4d', ruleColor: '#999999', chapNum: true, typo: true, font: K.head, margin: 8, header: '', footer: '', headL: '{책제목}', headR: '{장제목}', rule: true, guides: true, mg: Object.assign({}, NB.mg), cols: Number(NB.cols || K.cols) || 1, gutter: 6, tocLevel: 2, tocTitle: '차례' });
      d.bstyles = psDefaults(NB.kind); if (NB.font) ['body', 'list', 'center', 'small'].forEach(k => { d.bstyles[k].font = NB.font; }); if (NB.size) { const z = NB.size; d.bstyles.body.size = z; d.bstyles.list.size = z; d.bstyles.center.size = z; d.bstyles.small.size = Math.round(z * 0.85 * 2) / 2; d.bstyles.quote.size = Math.round(z * 0.95 * 2) / 2; } if (NB.lh) ['body', 'list', 'center', 'quote'].forEach(k => { d.bstyles[k].lh = NB.lh; });
      d.bstory = { md: NB.md ? NB.md : NB.sample ? SAMPLE(title) : `# 첫째 장\n여기에 원고를 붙여 넣으세요. 왼쪽 「도서 편집 → 원고」에서 원고 편집기를 열거나 워드·한글에서 복사해 붙여 넣으면 쪽이 저절로 늘어납니다.` };
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
      bk.els.push(T_(`${title}\n\n1판 1쇄 펴낸 날  ${dstr}\n지은이  ${NB.author || ''}\n펴낸 곳  나라차태권도\n주소  \n전화  \n\n비매품\n이 책의 내용을 허락 없이 옮겨 쓰지 마세요.`, NB.mg.outer, H - NB.mg.bottom - 48, Math.min(70, W - NB.mg.inner - NB.mg.outer), 48, { font: 'Pretendard', size: 7.5, lh: 1.75, color: '#000000', name: '판권 (주소·전화를 채우세요)' })); d.pages.push(bk); /* 판권: 책 맨 끝 왼쪽(짝수) 쪽 · 먹 1도 7.5pt (조판 전문가 11/21) */
      A.setDoc(d); await flow({ quiet: true }); A.afterNewDoc();
      const st = d.book.lastFlow || {}; A.toast(`새 책 "${title}"을 만들었습니다 — ${d.pages.length}쪽(본문 ${st.pages || 0}쪽). 왼쪽 「도서 편집 → 원고」에서 원고를 바꾸면 쪽이 저절로 다시 짜입니다${kept ? ` · 저장하지 않은 "${kept}"는 직전 문서로 보관` : ''}`);
      const nbd = $('#dlgNewBook'); if (nbd && nbd.open) nbd.close(); A.openTab('book');
    }
    /* 이 문서를 책으로 (지금 크기 그대로 — 끝에 본문 흐름을 붙임) */
    function convertDoc() {
      const d = A.doc; const K = KINDS.general;
      d.book = Object.assign(A.clone(A.BOOK_DEF), d.book || {}, { on: true, bookMode: true, kind: 'general', title: d.book && d.book.title || d.name || '', author: '', headL: '{책제목}', headR: '{장제목}', rule: true, guides: true, mg: Object.assign({}, marginsFor(d.w, d.h, 'general'), (d.book && d.book.mg) || {}), cols: (d.book && d.book.cols) || 1, gutter: 6, tocLevel: 2, tocTitle: '차례', size: 8.5, font: K.head, facing: true });
      if (!d.bstyles) d.bstyles = psDefaults('general'); if (!d.bstory) d.bstory = { md: '# 첫째 장\n여기에 원고를 붙여 넣으세요.' };
      flow();
    }

    /* ---------- 원고 편집기 (인디자인 스토리 편집기) ---------- */
    /* ---------- 원고 편집기 (팀장님 11/21 · UX 전문가 검토 반영) ----------
       보기 모드(기본): 단락마다 스타일 칸 + 실제 글 모양, 사진은 카드(설명·폭·바꾸기·빼기), 자체 되돌리기(Ctrl+Z), 오른쪽에 그 단락이 들어간 쪽 미리보기,
       쓰다 멈추면(1.5초) 저절로 쪽 다시 짜기, 닫는 길은 「완료」 하나(Esc도 같음). 기호 모드(고급): 예전처럼 줄 앞 기호를 직접 씀 */
    const ED_STY = ['h1', 'h2', 'h3', 'body', 'quote', 'list', 'center', 'small', 'tip', 'warn', 'byline'];
    function mdToBlocks(md) {
      const out = []; String(md || '').replace(/\r/g, '').split('\n').forEach((raw, ln) => {
        const s = raw.trim(); if (!s) return;
        if (/^\[\s*쪽\s*나눔\s*\]$/.test(s)) { out.push({ st: 'break', ln }); return; }
        const im = s.match(IMG_RE); if (im) { const refs = imgRefs(im[2]), caps = im[1].split('|'); if (refs.length > 1) { out.push({ st: 'img', row: true, refs, caps: refs.map((_, j) => (caps[j] || '').trim()), ref: refs[0], cap: (caps[0] || '').trim(), ln }); return; } if (refs.length) { out.push({ st: 'img', cap: im[1], ref: refs[0], ln }); return; } }
        let st = 'body', t = s, m;
        if ((m = s.match(/^###\s*(.*)$/))) { st = 'h3'; t = m[1]; } else if ((m = s.match(/^##\s*(.*)$/))) { st = 'h2'; t = m[1]; } else if ((m = s.match(/^#\s*(.*)$/))) { st = 'h1'; t = m[1]; }
        else if ((m = s.match(/^>\s?(.*)$/))) { st = 'quote'; t = m[1]; } else if ((m = s.match(/^[-*•·]\s+(.*)$/))) { st = 'list'; t = m[1]; }
        else if ((m = s.match(/^\[가운데\]\s*(.*)$/))) { st = 'center'; t = m[1]; } else if ((m = s.match(/^\[작은\s?글\]\s*(.*)$/))) { st = 'small'; t = m[1]; }
        else if ((m = s.match(/^\[(?:도움말|팁)\]\s*(.*)$/))) { st = 'tip'; t = m[1]; } else if ((m = s.match(/^\[주의\]\s*(.*)$/))) { st = 'warn'; t = m[1]; } else if ((m = s.match(/^\[글쓴이\]\s*(.*)$/))) { st = 'byline'; t = m[1]; }
        out.push({ st, t, ln });
      }); return out;
    }
    const capClean = c => String(c || '').replace(/[[\]\n|]/g, ' ').trim();
    const blocksToMd = bl => bl.map(b => b.st === 'break' ? '[쪽 나눔]' : b.st === 'img' && b.row ? `![${b.caps.map(capClean).join('|')}](${b.refs.map(r => 'img:' + r).join(',')})` : b.st === 'img' ? `![${capClean(b.cap)}](img:${b.ref})` : (PS_MARK[b.st] || '') + String(b.t || '').replace(/\n/g, ' ')).join('\n');
    const inlineHTML = t => esc(t || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    function htmlToInline(el) { let s = ''; el.childNodes.forEach(n => { if (n.nodeType === 3) s += n.nodeValue.replace(/\n/g, ' '); else if (n.nodeType === 1) { if (n.tagName === 'BR') return; const inner = htmlToInline(n); if ((n.tagName === 'B' || n.tagName === 'STRONG' || Number((n.style && n.style.fontWeight) || 0) >= 600) && inner.trim()) s += '**' + inner.replace(/\*\*/g, '') + '**'; else s += inner; } }); return s.replace(/\*\*\*\*/g, '').replace(/ /g, ' '); }
    function caretOffset(el) { const sel = window.getSelection(); if (!sel.rangeCount) return 0; const r = sel.getRangeAt(0), pre = r.cloneRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset); return pre.toString().length; }
    function setCaret(el, off) { el.focus(); const sel = window.getSelection(), r = document.createRange(); let n, rest = off; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); while ((n = tw.nextNode())) { if (rest <= n.nodeValue.length) { r.setStart(n, rest); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); return; } rest -= n.nodeValue.length; } r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
    function openStory(line) {
      if (!isBook()) return; let dl = $('#dlgStory'); if (!dl) { dl = document.createElement('dialog'); dl.id = 'dlgStory'; dl.className = 'wide st-dlg'; document.body.appendChild(dl); }
      const d = A.doc; let mode = (() => { try { return localStorage.getItem('naracal-bk-edmode') || 'view'; } catch (e) { return 'view'; } })();
      let blocks = mdToBlocks(d.bstory.md), focusI = Math.max(0, blocks.findIndex(b => b.ln >= (line == null ? 0 : line))), hist = [], hptr = -1, saveT = 0, flowT = 0, snapT = 0, status = 'ok';
      if (line == null) focusI = 0;
      { const norm = blocksToMd(blocks); if (norm !== d.bstory.md) { d.bstory.md = norm; A.markDirty(); } } /* 빈 줄 정리 → 원고 줄 번호 = 단락 번호 (미리보기 쪽 찾기에 씀) */
      const S = () => ps();
      const css = st => { const s = S()[st] || S().body, base = S().body.size || 10, px = Math.max(12, Math.min(30, Math.round(15 * s.size / base))); return `font-family:'${esc(s.font)}','Noto Sans KR',sans-serif;font-weight:${s.weight};font-size:${px}px;color:${s.color};text-align:${s.align === 'justify' ? 'left' : s.align}`; };
      const snap = () => { const j = JSON.stringify(blocks); if (hist[hptr] === j) return; hist = hist.slice(0, hptr + 1); hist.push(j); if (hist.length > 200) hist.shift(); hptr = hist.length - 1; };
      const setStatus = (s, extra) => { status = s; const el = dl.querySelector('#beStat'); if (el) el.innerHTML = s === 'wait' ? '<span class="dot w"></span> 고친 내용이 아직 쪽에 안 들어갔어요 — 잠시 뒤 저절로 다시 짭니다' : s === 'busy' ? '<span class="spin"></span> 쪽 다시 짜는 중…' : `<span class="dot g"></span> 쪽에 반영됨${extra ? ' · ' + extra : ''}`; };
      const persist = () => { const md = blocksToMd(blocks); if (md !== d.bstory.md) { d.bstory.md = md; A.markDirty(); } };
      const changed = (structural) => {
        if (structural) snap(); else { clearTimeout(snapT); snapT = setTimeout(snap, 700); }
        clearTimeout(saveT); saveT = setTimeout(persist, 250); setStatus('wait'); outline();
        clearTimeout(flowT); flowT = setTimeout(async () => { persist(); setStatus('busy'); const r = await flow({ quiet: true }); setStatus('ok', r ? `본문 ${r.pages.length}쪽` : ''); preview(); }, 1500);
      };
      const blockHTML = (b, i) => {
        if (b.st === 'break') return `<div class="be-b be-br" data-i="${i}" tabindex="0">— 여기서 다음 쪽으로 (쪽 나눔) — <button class="btn sm" data-bact="delbr">빼기</button></div>`;
        if (b.st === 'img' && b.row) return `<div class="be-b be-img be-row" data-i="${i}"><div class="be-rowph">${b.refs.map((r, j) => { const I = (d.bimgs || {})[r] || {}, u = I.src ? A.imgUrl({ src: I.src, w: 60, h: 60 }) : ''; return `<div class="be-rc"><div class="be-ph">${u ? `<img src="${u}" alt="">` : '<span>사진 없음</span>'}</div><input class="be-cap" data-i="${i}" data-j="${j}" value="${esc(b.caps[j] || '')}" placeholder="사진 ${j + 1} 설명"></div>`; }).join('')}</div><div class="be-pa"><span class="hint" style="margin:0">사진 ${b.refs.length}장을 한 줄에 나란히</span><button class="btn sm" data-bact="unrow">하나씩 따로</button><button class="btn sm danger" data-bact="delimg">🗑 빼기</button></div></div>`;
        if (b.st === 'img') { const I = (d.bimgs || {})[b.ref] || {}, u = I.src ? A.imgUrl({ src: I.src, w: 60, h: 60 }) : '', wp = I.wp || 100;
          return `<div class="be-b be-img" data-i="${i}"><div class="be-ph">${u ? `<img src="${u}" alt="">` : '<span>사진 없음</span>'}</div><div class="be-pc"><input class="be-cap" data-i="${i}" value="${esc(b.cap || '')}" placeholder="사진 설명 (사진 아래에 나오는 글)"><div class="be-wb"><span>크기</span>${[[50, '작게'], [75, '보통'], [100, '꽉 차게']].map(([w, t]) => `<button class="${Math.abs(wp - w) < 1 ? 'on' : ''}" data-bw="${w}">${t}</button>`).join('')}${[50, 75, 100].some(w => Math.abs(wp - w) < 1) ? '' : `<em>${Math.round(wp)}%</em>`}</div><div class="be-pa">${blocks[i + 1] && blocks[i + 1].st === 'img' && (blocks[i + 1].refs || [1]).length + 1 <= 4 ? '<button class="btn sm" data-bact="row" title="바로 아래 사진과 한 줄에 나란히 놓기">⇆ 아래 사진과 나란히</button>' : ''}<button class="btn sm" data-bact="swap">사진 바꾸기</button><button class="btn sm danger" data-bact="delimg">🗑 사진 빼기</button></div></div></div>`; }
        return `<div class="be-b st-${b.st}" data-i="${i}"><select class="be-st" data-i="${i}" title="이 단락 모양">${ED_STY.map(k => `<option value="${k}" ${b.st === k ? 'selected' : ''}>${PS_NAME[k]}</option>`).join('')}</select><div class="be-t" contenteditable="true" spellcheck="false" data-i="${i}" style="${css(b.st)}">${inlineHTML(b.t) || '<br>'}</div></div>`;
      };
      const tEl = i => dl.querySelector(`.be-t[data-i="${i}"]`);
      const render = (fi, off) => {
        const list = dl.querySelector('#beList'); if (!list) return;
        list.innerHTML = blocks.length ? blocks.map(blockHTML).join('') : `<div class="be-empty"><b>아직 원고가 없어요</b><p>워드·한글에서 복사해 여기에 붙여 넣거나(Ctrl+V), 아래에서 고르세요.</p><div class="row" style="gap:8px;justify-content:center"><button class="btn primary" data-bact="import">📂 워드·한글·글 파일 가져오기</button><button class="btn" data-bact="sample">📖 보기 원고로 시작</button><button class="btn" data-bact="first">✍ 빈 칸에 바로 쓰기</button></div></div>`;
        if (fi != null && blocks[fi]) { const t = tEl(fi); if (t) setCaret(t, off == null ? 0 : off); else { const b = list.querySelector(`[data-i="${fi}"]`); if (b) b.scrollIntoView({ block: 'center' }); } }
        outline(); toolbarState();
      };
      const toolbarState = () => { const b = blocks[focusI]; dl.querySelectorAll('[data-stl]').forEach(x => x.classList.toggle('on', !!b && x.dataset.stl === b.st)); };
      const outline = () => { const ol = dl.querySelector('#beOutline'); if (!ol) return; const hs = blocks.map((b, i) => [b, i]).filter(([b]) => b.st === 'h1' || b.st === 'h2'); ol.innerHTML = hs.length ? hs.map(([b, i]) => `<button class="st-ol ${b.st}" data-goi="${i}">${esc(String(b.t || '(제목 없음)').replace(/\*\*/g, ''))}</button>`).join('') : '<span class="hint">장 제목이 없어요 — 단락 모양에서 「장 제목」을 고르세요</span>'; const ch = blocks.reduce((a, b) => a + String(b.t || '').length, 0); dl.querySelector('#beCount').textContent = `단락 ${blocks.filter(b => b.t != null).length}개 · ${ch.toLocaleString()}자 · 사진 ${blocks.filter(b => b.st === 'img').length}장 · 장 ${blocks.filter(b => b.st === 'h1').length}개`; };
      let pvT = 0; const preview = () => { clearTimeout(pvT); pvT = setTimeout(() => { const box = dl.querySelector('#bePv'); if (!box) return; const L = focusI; let best = -1; A.doc.pages.forEach(p => p.els.forEach(e => { if (e.flowLine != null && e.flowLine <= L && e.flowLine > best && (e.flowFrame === 'body' || e.flowImg)) best = e.flowLine; }));
        const pi = A.doc.pages.findIndex(p => p.els.some(e => e.flowLine === best && (e.flowFrame === 'body' || e.flowImg))); if (pi < 0) { box.innerHTML = '<p class="hint">쪽을 다시 짜면 여기에 보여요</p>'; return; }
        const n = A.bookNum(pi); dl.querySelector('#bePvN').textContent = `${n == null ? pi + 1 : n}쪽`; box.innerHTML = `<div class="pvb" data-w="${A.doc.w}" data-h="${A.doc.h}">${A.sheetHTML(A.doc.pages[pi], 'thumb')}</div>`; A.fitBoxes(box, '.pvb', Math.min(560, box.clientHeight || 480)); box.dataset.pi = pi; }, 120); };
      const splitAt = (i) => { const el = tEl(i), sel = window.getSelection(); if (!el || !sel.rangeCount) return; const r = sel.getRangeAt(0); r.deleteContents(); const tail = document.createRange(); tail.setStart(r.startContainer, r.startOffset); tail.setEnd(el, el.childNodes.length); const tmp = document.createElement('div'); tmp.appendChild(tail.extractContents()); const after = htmlToInline(tmp).trim(), b = blocks[i]; b.t = htmlToInline(el).trim(); const nst = /^h\d$/.test(b.st) ? 'body' : b.st; blocks.splice(i + 1, 0, { st: nst, t: after }); focusI = i + 1; changed(true); render(i + 1, 0); };
      const mergeUp = (i) => { const p = blocks[i - 1], b = blocks[i]; if (!p || p.t == null) { if (p && p.st === 'break') { blocks.splice(i - 1, 1); focusI = i - 1; changed(true); render(i - 1, 0); } return; } const off = String(p.t).replace(/\*\*/g, '').length; p.t = (p.t || '') + (b.t || ''); blocks.splice(i, 1); focusI = i - 1; changed(true); render(i - 1, off); };
      const setSt = (i, st) => { const b = blocks[i]; if (!b || b.t == null) return; b.st = st; changed(true); const el = tEl(i), off = el ? caretOffset(el) : 0; render(i, off); };
      const insertAfter = (i, items) => { blocks.splice(i + 1, 0, ...items); changed(true); render(i + items.length, 0); };
      const undoRedo = (dir) => { clearTimeout(snapT); snap(); const k = hptr + dir; if (k < 0 || k >= hist.length) return; hptr = k; blocks = JSON.parse(hist[hptr]); clearTimeout(saveT); saveT = setTimeout(persist, 50); setStatus('wait'); clearTimeout(flowT); flowT = setTimeout(async () => { persist(); setStatus('busy'); const r = await flow({ quiet: true }); setStatus('ok', r ? `본문 ${r.pages.length}쪽` : ''); preview(); }, 1200); render(Math.min(focusI, blocks.length - 1), 0); };
      const photoFiles = async (files, at) => { const ids = await addPhotoFiles(files); if (!ids.length) { A.toast('사진 파일(JPG·PNG·WEBP)을 골라 주세요', true); return; } const i = at == null ? focusI : at; insertAfter(Math.min(i, blocks.length - 1), ids.map(x => ({ st: 'img', cap: x.name, ref: x.id }))); A.toast(`사진 ${ids.length}장을 넣었어요 — 사진 설명 칸의 글이 사진 아래에 나옵니다`); };
      const pickPhotos = (at) => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.onchange = () => photoFiles([...inp.files], at); inp.click(); };
      const done = async () => { clearTimeout(flowT); clearTimeout(saveT); if (mode === 'view') persist(); else { const ta = dl.querySelector('#stText'); if (ta && ta.value !== d.bstory.md) { d.bstory.md = ta.value; A.markDirty(); } } dl.close(); if (stale()) await flow(); else A.commit(); /* 되돌리기 기록·자동 저장 */ };
      const draw = () => {
        dl.innerHTML = `<div class="dhead"><h2>✍ 원고 쓰기·고치기</h2><div class="seg st-mode"><button data-mode="view" aria-pressed="${mode === 'view'}">보기 모드</button><button data-mode="code" aria-pressed="${mode === 'code'}">기호 모드 (고급)</button></div><span style="flex:1"></span><button class="btn primary sm" data-bact="done">완료</button></div>
        <div class="dbody st-ed2">
          <div class="st-bar">${ED_STY.map(k => `<button class="btn sm" data-stl="${k}" title="지금 단락을 ${PS_NAME[k]}(으)로${k === 'h1' ? ' (Ctrl+1)' : k === 'h2' ? ' (Ctrl+2)' : k === 'h3' ? ' (Ctrl+3)' : k === 'body' ? ' (Ctrl+0)' : ''}">${PS_NAME[k]}</button>`).join('')}<span class="st-sep"></span><button class="btn sm" data-sti="bold" title="고른 글자를 굵게 (Ctrl+B)"><b>굵게</b></button><button class="btn sm" data-sti="break" title="여기서 다음 쪽으로 (Ctrl+Enter)">쪽 나눔</button><span class="st-sep"></span><button class="btn sm" data-bact="photo" title="지금 단락 아래에 사진 넣기 (Ctrl+Shift+P) — 사진 파일을 원고에 끌어 놓아도 돼요">🖼 사진 넣기</button><button class="btn sm" data-bact="import" title="워드(docx)·한글에서 저장한 txt·md 원고 가져오기">📂 파일 가져오기</button><button class="btn sm" data-bact="keys" title="단축키">⌨</button></div>
          <div class="st-main">
            ${mode === 'view' ? '<div class="be" id="beList"></div>' : `<textarea id="stText" spellcheck="false">${esc(d.bstory.md)}</textarea>`}
            <div class="st-side2"><div class="be-pvh">이 단락이 들어간 쪽 <b id="bePvN"></b></div><div class="be-pv" id="bePv"></div><b style="margin-top:8px">차례 (누르면 그 장으로)</b><div id="beOutline"></div><div class="hint" id="beCount"></div></div>
          </div>
          <div class="st-foot"><span id="beStat"></span><span style="flex:1"></span><span class="hint">Esc · Ctrl+S도 「완료」</span><button class="btn primary" data-bact="done">완료</button></div></div>`;
        if (mode === 'view') render(focusI, 0); else { const ta = dl.querySelector('#stText'); ta.oninput = () => { d.bstory.md = ta.value; A.markDirty(); blocks = mdToBlocks(ta.value); changed(false); }; outline(); }
        setStatus(stale() ? 'wait' : 'ok'); preview();
      };
      /* 원고 칸 안의 입력 */
      dl.oninput = e => { const t = e.target; if (t.classList.contains('be-t')) { const i = Number(t.dataset.i); blocks[i].t = htmlToInline(t); changed(false); } else if (t.classList.contains('be-cap')) { const b = blocks[Number(t.dataset.i)]; if (b.row && t.dataset.j != null) { b.caps[Number(t.dataset.j)] = t.value; b.cap = b.caps[0]; } else b.cap = t.value; changed(false); } };
      dl.onchange = e => { const t = e.target; if (t.classList.contains('be-st')) { setSt(Number(t.dataset.i), t.value); focusI = Number(t.dataset.i); } };
      dl.addEventListener('focusin', e => { const b = e.target.closest && e.target.closest('[data-i]'); if (b && b.dataset.i != null && dl.contains(b)) { const i = Number(b.dataset.i); if (i !== focusI) { focusI = i; toolbarState(); preview(); } } });
      dl.onkeydown = e => {
        const mod = e.ctrlKey || e.metaKey, k = e.key;
        if (mod && (k === 's' || k === 'S')) { e.preventDefault(); done(); return; }
        if (mode !== 'view') return;
        if (mod && !e.shiftKey && (k === 'z' || k === 'Z')) { e.preventDefault(); undoRedo(-1); return; }
        if (mod && ((e.shiftKey && (k === 'z' || k === 'Z')) || k === 'y' || k === 'Y')) { e.preventDefault(); undoRedo(1); return; }
        if (mod && e.shiftKey && (k === 'p' || k === 'P')) { e.preventDefault(); pickPhotos(); return; }
        if (mod && ['1', '2', '3', '0'].includes(k)) { e.preventDefault(); setSt(focusI, { 1: 'h1', 2: 'h2', 3: 'h3', 0: 'body' }[k]); return; }
        const t = e.target; if (!t.classList || !t.classList.contains('be-t')) return; const i = Number(t.dataset.i);
        if (mod && (k === 'b' || k === 'B')) { e.preventDefault(); document.execCommand('bold'); blocks[i].t = htmlToInline(t); changed(true); return; }
        if (mod && k === 'Enter') { e.preventDefault(); insertAfter(i, [{ st: 'break' }]); return; }
        if (k === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); snap(); splitAt(i); return; }
        if (k === 'Enter' && e.shiftKey) { e.preventDefault(); return; } /* 한 단락 안 줄바꿈은 쓰지 않음 */
        const sel = window.getSelection(), collapsed = sel.rangeCount && sel.getRangeAt(0).collapsed, off = collapsed ? caretOffset(t) : -1, len = t.textContent.length;
        if (k === 'Backspace' && collapsed && off === 0 && i > 0 && !e.isComposing) { e.preventDefault(); snap(); mergeUp(i); return; }
        if (k === 'Delete' && collapsed && off === len && blocks[i + 1] && blocks[i + 1].t != null) { e.preventDefault(); snap(); mergeUp(i + 1); setCaret(tEl(i), len); return; }
        if (k === 'ArrowUp' && collapsed && off === 0) { for (let j = i - 1; j >= 0; j--) if (tEl(j)) { e.preventDefault(); setCaret(tEl(j), tEl(j).textContent.length); return; } }
        if (k === 'ArrowDown' && collapsed && off === len) { for (let j = i + 1; j < blocks.length; j++) if (tEl(j)) { e.preventDefault(); setCaret(tEl(j), 0); return; } }
      };
      dl.addEventListener('paste', e => { if (mode !== 'view') return; const t = e.target.closest && e.target.closest('.be-t'); const cd = e.clipboardData; if (!cd) return; const imgs = [...cd.files].filter(f => /^image\//.test(f.type)); if (imgs.length) { e.preventDefault(); photoFiles(imgs, t ? Number(t.dataset.i) : focusI); return; } if (!t) return;
        const h = cd.getData('text/html'), bim = d.bimgs || (d.bimgs = {}), md = h ? htmlToMd(h, s => { const id = 'p' + A.uid().slice(0, 6); bim[id] = { src: A.addAsset(s), wp: 100 }; return id; }) : cd.getData('text/plain'); const nb = mdToBlocks(md); e.preventDefault(); if (!nb.length) return;
        snap(); if (nb.length === 1 && nb[0].t != null) { document.execCommand('insertHTML', false, inlineHTML(nb[0].t)); blocks[Number(t.dataset.i)].t = htmlToInline(t); changed(true); return; }
        const i = Number(t.dataset.i); splitAt(i); const cur = blocks[i]; if (nb[0].t != null && cur.t != null) { cur.t = (cur.t || '') + nb[0].t; if (!cur.t.trim() || cur.st === 'body') cur.st = nb[0].st; nb.shift(); } const last = blocks[i + 1]; blocks.splice(i + 1, 0, ...nb); if (last && !String(last.t || '').trim()) blocks.splice(i + 1 + nb.length, 1); changed(true); render(Math.min(i + nb.length, blocks.length - 1), 0); A.toast(`단락 ${nb.length + 1}개를 붙여 넣었어요 (제목·굵게·사진은 모양을 살려서)`); }, true);
      dl.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
      dl.addEventListener('drop', e => { const fs = [...(e.dataTransfer ? e.dataTransfer.files : [])].filter(f => /^image\//.test(f.type)); if (!fs.length) return; e.preventDefault(); const b = e.target.closest && e.target.closest('.be-b'); photoFiles(fs, b ? Number(b.dataset.i) : blocks.length - 1); });
      dl.onclick = async e => {
        const md_ = e.target.closest('[data-mode]'); if (md_) { if (mode === 'view') persist(); else { const ta = dl.querySelector('#stText'); if (ta) { d.bstory.md = ta.value; blocks = mdToBlocks(ta.value); } } mode = md_.dataset.mode; try { localStorage.setItem('naracal-bk-edmode', mode); } catch (er) {} draw(); return; }
        const s = e.target.closest('[data-stl]'); if (s) { if (mode === 'view') setSt(focusI, s.dataset.stl); else { const ta = dl.querySelector('#stText'), v = ta.value, a = v.lastIndexOf('\n', ta.selectionStart - 1) + 1; let b2 = v.indexOf('\n', ta.selectionEnd); if (b2 < 0) b2 = v.length; const lines = v.slice(a, b2).split('\n').map(l => { const t = l.replace(/^\s*(#{1,3}\s*|>\s?|[-*•·]\s+|\[가운데\]\s*|\[작은\s?글\]\s*)/, ''); return t && !/^!\[/.test(t) ? (PS_MARK[s.dataset.stl] || '') + t : l; }).join('\n'); ta.focus(); ta.setSelectionRange(a, b2); document.execCommand('insertText', false, lines); } return; }
        const it = e.target.closest('[data-sti]'); if (it) { if (mode === 'view') { const t = tEl(focusI); if (it.dataset.sti === 'bold') { if (t) { document.execCommand('bold'); blocks[focusI].t = htmlToInline(t); changed(true); } } else insertAfter(focusI, [{ st: 'break' }]); } else { const ta = dl.querySelector('#stText'); ta.focus(); if (it.dataset.sti === 'bold') { const a = ta.selectionStart, b2 = ta.selectionEnd; if (b2 > a) document.execCommand('insertText', false, `**${ta.value.slice(a, b2)}**`); } else { const a = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1; ta.setSelectionRange(a, a); document.execCommand('insertText', false, '[쪽 나눔]\n'); } } return; }
        const go = e.target.closest('[data-goi]'); if (go) { const i = Number(go.dataset.goi); focusI = i; if (mode === 'view') { const t = tEl(i); if (t) { t.scrollIntoView({ block: 'center' }); setCaret(t, 0); } } preview(); return; }
        const pv = e.target.closest('#bePv .pvb'); if (pv) { const pi = Number(dl.querySelector('#bePv').dataset.pi); await done(); A.goto(pi); return; }
        const bw = e.target.closest('[data-bw]'); if (bw) { const i = Number(bw.closest('.be-b').dataset.i), I = (d.bimgs || {})[blocks[i].ref]; if (I) { I.wp = Number(bw.dataset.bw); delete I.ar_user; } snap(); changed(true); render(i); return; }
        const ac = e.target.closest('[data-bact]'); if (!ac) return; const a = ac.dataset.bact, bi = ac.closest('.be-b') ? Number(ac.closest('.be-b').dataset.i) : focusI;
        if (a === 'done') { done(); return; }
        if (a === 'photo') { pickPhotos(); return; }
        if (a === 'keys') { A.toast('단축키 — Ctrl+1 장 제목 · Ctrl+2 절 제목 · Ctrl+3 소제목 · Ctrl+0 본문 · Ctrl+B 굵게 · Enter 새 단락 · Ctrl+Enter 쪽 나눔 · Ctrl+Shift+P 사진 넣기 · Ctrl+Z 되돌리기 · Ctrl+S·Esc 완료'); return; }
        if (a === 'import') { importFile(md2 => { const nb = mdToBlocks(md2); if (blocks.length && !window.confirm(`가져온 원고(단락 ${nb.length}개)를 지금 원고 끝에 붙일까요?\n(취소를 누르면 지금 원고를 가져온 원고로 바꿉니다)`)) blocks = nb; else blocks = blocks.concat(nb); changed(true); if (mode === 'view') render(0, 0); else draw(); }); return; }
        if (a === 'sample') { blocks = mdToBlocks(SAMPLE(B_().title || d.name)); changed(true); render(0, 0); return; }
        if (a === 'first') { blocks = [{ st: 'h1', t: '' }]; changed(true); render(0, 0); return; }
        if (a === 'delbr') { blocks.splice(bi, 1); changed(true); render(Math.max(0, bi - 1)); return; }
        if (a === 'row') { const b = blocks[bi], nx = blocks[bi + 1]; if (!nx || nx.st !== 'img') return; const refs = [b.ref].concat(nx.row ? nx.refs : [nx.ref]), caps = [b.cap || ''].concat(nx.row ? nx.caps : [nx.cap || '']); blocks.splice(bi, 2, { st: 'img', row: true, refs, caps, ref: refs[0], cap: caps[0] }); snap(); changed(true); render(bi); A.toast(`사진 ${refs.length}장을 한 줄에 나란히 놓았습니다`); return; }
        if (a === 'unrow') { const b = blocks[bi]; blocks.splice(bi, 1, ...b.refs.map((r, j) => ({ st: 'img', ref: r, cap: b.caps[j] || '' }))); snap(); changed(true); render(bi); return; }
        if (a === 'delimg') { const b = blocks[bi]; if (!window.confirm(`이 사진을 책에서 뺄까요?${b.cap ? `\n사진 설명 「${b.cap}」도 함께 빠져요.` : ''}\n(Ctrl+Z로 되돌릴 수 있어요)`)) return; blocks.splice(bi, 1); changed(true); render(Math.max(0, bi - 1)); return; }
        if (a === 'swap') { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const ids = await addPhotoFiles([f]); if (!ids.length) return; const I = d.bimgs[blocks[bi].ref], N = d.bimgs[ids[0].id]; I.src = N.src; delete I.ar; if (I.ed) delete I.ed.src; delete d.bimgs[ids[0].id]; changed(true); render(bi); }; inp.click(); return; }
      };
      dl.oncancel = e => { e.preventDefault(); done(); }; /* Esc = 완료 (고친 내용을 저장하고 쪽을 다시 짬) */
      snap(); draw(); dl.showModal(); if (mode === 'view' && blocks[focusI]) requestAnimationFrame(() => { const t = tEl(focusI); if (t) { setCaret(t, 0); t.scrollIntoView({ block: 'center' }); } else { const b = dl.querySelector(`#beList [data-i="${focusI}"]`); if (b) b.scrollIntoView({ block: 'center' }); } }); /* 쪽·점검에서 연 자리로 바로 */
    }
    function gotoLine(ta, ln) { const ls = ta.value.split('\n'); let a = 0; for (let i = 0; i < Math.min(ln, ls.length); i++) a += ls[i].length + 1; ta.focus(); ta.setSelectionRange(a, a + (ls[ln] || '').length); const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22; ta.scrollTop = Math.max(0, ln * lh - ta.clientHeight / 3); }
    /* 워드·한글·웹에서 붙여 넣은 HTML → 원고 기호 */
    function htmlToMd(html, onImg) {
      const doc_ = new DOMParser().parseFromString(html, 'text/html'), out = [];
      const inl = n => { let s = ''; n.childNodes.forEach(c => { if (c.nodeType === 3) s += c.nodeValue.replace(/\s+/g, ' '); else if (c.nodeType === 1) { const t = c.tagName; if (t === 'BR') s += '\n'; else if (t === 'B' || t === 'STRONG' || (c.style && (c.style.fontWeight === 'bold' || Number(c.style.fontWeight) >= 600))) { const x = inl(c).trim(); s += x ? `**${x}**` : ''; } else s += inl(c); } }); return s; };
      const walk = n => n.childNodes.forEach(c => { if (c.nodeType !== 1) { const t = (c.nodeValue || '').trim(); if (t) out.push(t); return; } const t = c.tagName, txt = () => inl(c).replace(/\*\*\s*\*\*/g, '').trim();
        if (/^H1$/.test(t)) out.push('# ' + txt().replace(/\*\*/g, '')); else if (/^H2$/.test(t)) out.push('## ' + txt().replace(/\*\*/g, '')); else if (/^H[3-6]$/.test(t)) out.push('### ' + txt().replace(/\*\*/g, ''));
        else if (t === 'LI') out.push('- ' + txt()); else if (t === 'BLOCKQUOTE') txt().split('\n').forEach(l => l.trim() && out.push('> ' + l.trim()));
        else if ((t === 'P' || (t === 'DIV' && !c.querySelector('p,div,h1,h2,h3,li,table'))) && !(onImg && c.querySelector('img'))) { const x = txt(); if (x) x.split('\n').forEach(l => l.trim() && out.push(l.trim())); }
        else if (t === 'TABLE') c.querySelectorAll('tr').forEach(tr => out.push([...tr.children].map(td => td.textContent.trim()).join(' · ')));
        else if (t === 'IMG') { const s = c.getAttribute('src') || ''; if (onImg && /^data:image\//.test(s)) out.push(`![${(c.getAttribute('alt') || '').replace(/[\[\]\n]/g, ' ').trim()}](img:${onImg(s)})`); }
        else if (t === 'STYLE' || t === 'SCRIPT' || t === 'META') return; else { if (c.querySelector && c.querySelector('img') && (t === 'P' || t === 'DIV')) { const x = txt(); if (x) out.push(x); c.querySelectorAll('img').forEach(im => walk({ childNodes: [im] })); return; } walk(c); } });
      walk(doc_.body); return out.join('\n');
    }
    function importFile(done) {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.txt,.md,.docx,text/plain'; inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try {
          if (/\.docx$/i.test(f.name)) { await A.loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', () => window.mammoth, 'sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz'); const r = await window.mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() }); const bim = A.doc.bimgs || (A.doc.bimgs = {}); let nImg = 0; done(htmlToMd(r.value, s => { const id = 'p' + A.uid().slice(0, 6); bim[id] = { src: A.addAsset(s), wp: 100 }; nImg++; return id; })); if (nImg) A.toast(`워드 원고의 사진 ${nImg}장도 함께 넣었습니다`); }
          else { let t = await f.text(); if (/�/.test(t.slice(0, 2000))) { try { t = new TextDecoder('euc-kr').decode(await f.arrayBuffer()); } catch (e) {} } done(t.replace(/\r/g, '')); } /* 한글 메모장(EUC-KR) 파일도 */
          A.toast(`「${f.name}」 원고를 불러왔습니다 — 「흘려 넣기」를 누르세요`);
        } catch (e) { A.toast('원고를 불러오지 못했습니다: ' + e.message, true); }
      }; inp.click();
    }

    /* ---------- 점검 (인디자인 사전 검사) ---------- */
    async function preflight() {
      const d = A.doc, B = B_(), out = [], add = (lv, page, msg, fix, line) => out.push({ lv, page, msg, fix, line });
      if (stale()) add('warn', null, '원고·스타일·여백을 고친 뒤 아직 쪽에 반영하지 않았습니다', 'flow');
      /* 예시 글·빈칸이 남았는지 (UX 전문가 — 인쇄 전에 가장 자주 놓치는 것) */
      const mdL = String(d.bstory.md || '').split('\n');
      mdL.forEach((l, ln) => { if (/이 책의 예시 글은|여기에 원고를 붙여 넣으세요/.test(l)) add('bad', null, `원고에 예시 안내 글이 남아 있습니다: 「${l.replace(/^\[[^\]]*\]\s*|^#+\s*/, '').slice(0, 26)}…」`, 'line', ln); });
      if (!mdL.some(l => /^#\s/.test(l.trim()))) add('warn', null, '원고에 장 제목(#)이 하나도 없습니다 — 차례·머리글이 비어요', 'line', 0);
      d.pages.forEach((p, i) => p.els.forEach(el => { if (el.type === 'text' && /판권/.test(el.name || '') && /(주소|전화)\s*(\n|$)/.test(el.text || '')) add('warn', i, '판권의 주소·전화가 비어 있습니다 — 판권 쪽 글 상자를 눌러 채우세요 (필요 없으면 줄을 지우기)'); }));
      const lf = d.book.lastFlow || {}; if (lf.overflow) add('bad', null, `빈 상자에도 다 안 들어가는 글이 ${lf.overflow}곳 있습니다 (큰 제목·긴 낱말) — 글자 크기를 줄이거나 줄을 나누세요`);
      d.pages.forEach((p, i) => { if (!p.blank && !p.back && !p.noMaster && !p.toc && !p.els.length) add('warn', i, '빈 쪽입니다 — 일부러 비운 쪽이 아니면 지우거나 채우세요'); });
      const n = d.pages.length; if (B.bind === 'saddle' && n % 4) add('bad', null, `중철은 4의 배수 쪽이어야 합니다 — 지금 ${n}쪽, ${4 - n % 4}쪽 더 필요`, 'pad4'); else if (n % 2) add('warn', null, `쪽 수가 홀수(${n}쪽)입니다 — 책은 짝수 쪽이어야 해서 마지막에 빈 쪽이 하나 붙습니다`, 'pad2'); else add('ok', null, `${n}쪽 — ${B.bind === 'saddle' ? '중철 4의 배수 맞음' : n % 16 ? '짝수 쪽 맞음 (16의 배수면 종이가 가장 덜 버려짐)' : '16의 배수 — 인쇄 대수에 딱 맞음'}`);
      d.pages.forEach((p, i) => p.els.forEach(el => { if (el.flowFrame || el.hidden || p.cover) return; if (el.type === 'text') { const safe = 3; if (el.x < safe || el.y < safe || el.x + el.w > d.w - safe || el.y + el.h > d.h - safe) add('warn', i, `「${el.name || (el.text || '').slice(0, 12)}」 글이 재단선 3mm 안쪽 안전 여백 밖에 있습니다 — 잘릴 수 있어요`); } }));
      const imgs = []; d.pages.forEach((p, i) => p.els.forEach(el => { if (el.type === 'image' && el.src && !el.hidden) imgs.push([i, el]); }));
      await Promise.all(imgs.slice(0, 80).map(([i, el]) => new Promise(res => { const u = A.imgUrl(el); if (!u) return res(); const im = new Image(); im.onload = () => { const dpi = Math.round(im.naturalWidth / ((el.w * (el.zoom || 1)) / 25.4)); if (dpi < 150) add('bad', i, `사진 해상도가 낮습니다 (${dpi}ppi) — 인쇄하면 흐려요. 더 큰 사진이나 작게 넣기 (300ppi 권장)`); else if (dpi < 250) add('warn', i, `사진 해상도 ${dpi}ppi — 괜찮지만 300ppi면 더 선명`); res(); }; im.onerror = () => { add('bad', i, '사진을 불러오지 못했습니다 (연결 끊김)'); res(); }; im.src = u; setTimeout(res, 4000); })));
      try { A.printIssues(d.pages.map((_, i) => i)).forEach(x => add('warn', x.page - 1, x.msg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/^\s*·\s*/, ''))); } catch (e) {}
      if (!(Number(d.bleed) > 0)) add('warn', null, '도련이 0mm입니다 — 인쇄소에 맡기면 사방 3mm 도련이 필요합니다', 'bleed');
      if (!out.some(x => x.lv !== 'ok')) add('ok', null, '문제없습니다 — 인쇄소용 PDF로 내보내세요');
      out.sort((a, b) => ({ bad: 0, warn: 1, ok: 2 }[a.lv] - { bad: 0, warn: 1, ok: 2 }[b.lv]));
      return out;
    }

    /* 인쇄소에 보낼 말 (UX 전문가 — 초보가 무엇을 알려야 하는지 몰라 전화가 오가는 일을 줄임) */
    function printMsg() {
      const d = A.doc, B = B_(), n = d.pages.length, T = TRIMS.find(t => Math.abs(t[2] - d.w) < 1.5 && Math.abs(t[3] - d.h) < 1.5), cover = d.pages.some(p => p.cover);
      return [`안녕하세요, 책 인쇄를 부탁드립니다.`, ``, `· 제목: ${B.title || d.name}`, `· 판형: ${T && T[0] !== 'custom' ? T[1] + ' ' : ''}${Math.round(d.w)}×${Math.round(d.h)}mm (재단 크기)`, `· 쪽 수: ${n}쪽${cover ? ' (표지 2쪽 포함 — 표지를 따로 받으시면 말씀해 주세요)' : ''}`, `· 제본: ${B.bind === 'saddle' ? '중철(스테이플)' : '무선 제본'}`, `· 본문 색: ${d.pages.some(p => p.els.some(e => e.type === 'image')) ? '컬러(사진 있음)' : '흑백 1도'}`, `· 파일: 낱쪽 PDF, 도련 사방 ${Number(d.bleed) || 3}mm, 재단선 있음`, `· 부수: (    )부`, `· 종이: 본문 (    ) / 표지 (    ) — 추천해 주시면 따르겠습니다`, `· 받을 날: (    )`, ``, `PDF 파일을 함께 보냅니다. 확인 부탁드립니다.`].join('\n');
    }
    const b0 = (e, k) => { const b = e.target.closest('[data-bk]'); return b && b.dataset.bk === k; };

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
      const B = B_(), S = ps(), S0 = S, lf = d.book.lastFlow || {}, pg = A.page(), st = stale();
      const sec = (id, title, inner, extra) => `<details class="bk-sec2" data-sec="${id}" ${open.has(id) ? 'open' : ''}><summary>${title}${extra || ''}</summary><div class="bk-in">${inner}</div></details>`;
      const N = (k, t, v, step, min) => `<label class="f"><span>${t}</span><input type="number" data-bb="${k}" value="${v}" step="${step || 1}" min="${min == null ? 0 : min}"></label>`;
      const fonts = cur => fontList().map(f => `<option value="${esc(f[0])}" ${f[0] === cur ? 'selected' : ''}>${esc(f[1])}</option>`).join('');
      const styleRow = k => { const s = S[k]; return `<details class="bk-ps" ${open.has('ps-' + k) ? 'open' : ''} data-sec="ps-${k}"><summary><span class="bk-psn" style="font-family:'${esc(s.font)}';font-weight:${s.weight};color:${s.color}">${PS_NAME[k]}</span><small>${s.size}pt · ${Math.round(s.lh * 100)}%</small></summary><div class="bk-psf">
          <label class="f"><span>글꼴</span><select data-ps="${k}.font">${fonts(s.font)}</select></label>
          <div class="grid3"><label class="f"><span>크기(pt)</span><input type="number" step="0.5" min="5" data-ps="${k}.size" value="${s.size}"></label><label class="f"><span>행간(%)</span><input type="number" step="5" min="100" data-ps="${k}.lhp" value="${Math.round(s.lh * 100)}"></label><label class="f"><span>굵기</span><select data-ps="${k}.weight">${[[300, '가늘게'], [400, '보통'], [500, '중간'], [700, '굵게'], [800, '아주 굵게']].map(([w, t]) => `<option value="${w}" ${Number(s.weight) === w ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
          <div class="grid3"><label class="f"><span>정렬</span><select data-ps="${k}.align">${[['justify', '양끝'], ['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([a, t]) => `<option value="${a}" ${s.align === a ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>첫 줄 들여쓰기(글자)</span><input type="number" step="0.5" data-ps="${k}.indent" value="${s.indent}"></label><label class="f"><span>자간(%)</span><input type="number" step="1" data-ps="${k}.lsp" value="${Math.round((s.ls || 0) * 100)}"></label></div>
          <div class="grid3"><label class="f"><span>앞 간격(mm)</span><input type="number" step="0.5" data-ps="${k}.before" value="${s.before}"></label><label class="f"><span>뒤 간격(mm)</span><input type="number" step="0.5" data-ps="${k}.after" value="${s.after}"></label><label class="f"><span>색</span><input type="color" data-ps="${k}.color" value="${/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#222222'}"></label></div>
          ${s.box ? `<div class="grid3"><label class="f"><span>꼬리표 글</span><input type="text" data-ps="${k}.label" value="${esc(s.label || '')}"></label><label class="f"><span>상자 바탕</span><input type="color" data-ps="${k}.bg" value="${/^#[0-9a-f]{6}$/i.test(s.bg) ? s.bg : '#eeeeee'}"></label><label class="f"><span>왼쪽 줄·꼬리표 색</span><input type="color" data-ps="${k}.barColor" value="${/^#[0-9a-f]{6}$/i.test(s.barColor) ? s.barColor : '#333333'}"></label></div>` : ''}
          ${['body', 'quote', 'list', 'small', 'tip', 'warn'].includes(k) ? `<label class="f"><span>줄바꿈 단위</span><select data-ps="${k}.brk"><option value="word" ${s.brk !== 'char' ? 'selected' : ''}>어절 (낱말을 자르지 않음 — 기본)</option><option value="char" ${s.brk === 'char' ? 'selected' : ''}>글자 (줄 끝이 고르고 낱말 사이가 덜 벌어짐)</option></select></label>` : ''}
          ${k === 'h1' ? `<div class="grid2"><label class="f"><span>장 시작</span><select data-ps="h1.start">${[['right', '오른쪽(홀수) 쪽에서'], ['page', '새 쪽에서'], ['none', '이어서']].map(([a, t]) => `<option value="${a}" ${s.start === a ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>장 제목 위 여백(mm)</span><input type="number" step="1" data-ps="h1.sink" value="${s.sink || 0}"></label></div>` : ''}
          ${['quote', 'list', 'toc2'].includes(k) ? `<label class="f"><span>왼쪽 들여쓰기(mm)</span><input type="number" step="0.5" data-ps="${k}.indentL" value="${s.indentL || 0}"></label>` : ''}
        </div></details>`; };
      const FIXT = { flow: '쪽에 반영', bleed: '3mm로', pad2: '빈 쪽 더하기', pad4: '빈 쪽 더하기', line: '원고에서 보기' };
      const nb = pfCache ? pfCache.filter(x => x.lv === 'bad').length : 0, nw = pfCache ? pfCache.filter(x => x.lv === 'warn').length : 0;
      const pf = pfCache ? `<div class="bk-light ${nb ? 'bad' : nw ? 'warn' : 'ok'}"><i></i><b>${nb ? `꼭 고칠 것 ${nb}개` : nw ? '인쇄는 되지만 살펴볼 것' : '인쇄소에 보낼 준비 끝'}</b><span>${nb ? `⛔ ${nb}` : ''}${nw ? ` ⚠️ ${nw}` : ''}</span></div><div class="bk-pf">${pfCache.map((x, xi) => `<div class="bk-pfi ${x.lv}">${x.lv === 'ok' ? '✅' : x.lv === 'bad' ? '⛔' : '⚠️'} <span>${esc(x.msg)}</span>${x.fix ? `<button class="btn sm primary" data-pffix="${xi}">${FIXT[x.fix]}</button>` : ''}${x.page != null ? `<button class="btn sm" data-goto="${x.page}">${x.page + 1}쪽</button>` : ''}</div>`).join('')}</div>` : '<p class="hint">「점검하기」를 누르면 넘친 글·쪽 수·안전 여백·사진 해상도·도련을 살핍니다.</p>';
      body.innerHTML = `<div class="bk-top"><b>📚 ${esc(B.title || d.name)}</b><small>${r1(d.w)}×${r1(d.h)}mm · ${d.pages.length}쪽 (본문 ${lf.pages || 0}쪽) · 장 ${(parse(d.bstory.md).filter(p => p.st === 'h1').length)}개</small>
          <div class="row" style="gap:6px;margin-top:8px"><button class="btn primary sm" data-bk="story">✍ 원고 편집기</button><button class="btn sm ${st ? 'warn' : ''}" data-bk="flow" title="원고·스타일을 고친 뒤 쪽을 다시 짭니다">⤵ 다시 흘리기${st ? ' ●' : ''}</button><button class="btn sm" data-bk="spread">📖 펼침면</button></div></div>
        ${sec('story', '✍ 원고', `<p class="hint" style="margin-top:0">원고는 하나로 이어진 글입니다 — 고치면 쪽이 저절로 늘거나 줄고(인디자인 스마트 리플로·쿽 자동 상자), 장 제목(<b>#</b>)은 오른쪽 쪽에서 새로 시작합니다. 쪽 위의 본문 상자를 <b>두 번 누르면</b> 그 자리의 원고가 열립니다. <b>사진</b>은 원고 편집기의 「🖼 사진 넣기」로 원고 사이에 넣으면 글과 함께 흐르고, 쪽에서 사진을 누르면 편집(두 번 누르면 사진 편집기), 모서리를 끌면 크기가 바뀌어 다시 흐릅니다.</p>
          <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-bk="story">원고 편집기 열기</button><button class="btn sm" data-bk="import">📂 원고 파일 불러오기 (docx·txt)</button></div>
          <p class="hint">단락 ${lf.paras || 0}개 · ${(lf.chars || 0).toLocaleString()}자${lf.imgs ? ` · 사진 ${lf.imgs}장` : ''} → 본문 ${lf.pages || 0}쪽${lf.overflow ? ` · <b style="color:#c0392b">넘친 글 ${lf.overflow}곳</b>` : ''}</p>`)}
        ${sec('setup', '📐 판형 · 여백 · 단', `<div class="grid2"><label class="f"><span>책 제목 ({책제목})</span><input type="text" data-bb="title" value="${esc(B.title || '')}"></label><label class="f"><span>지은이 ({지은이})</span><input type="text" data-bb="author" value="${esc(B.author || '')}"></label></div>
          <div class="grid4">${N('mg.top', '위', B.mg.top, 0.5)}${N('mg.bottom', '아래', B.mg.bottom, 0.5)}${N('mg.inner', '안쪽', B.mg.inner, 0.5)}${N('mg.outer', '바깥쪽', B.mg.outer, 0.5)}</div>
          <div class="grid3">${N('cols', '단 수', B.cols, 1, 1)}${N('gutter', '단 사이(mm)', B.gutter, 0.5)}<label class="f"><span>제본</span><select data-bb="bind"><option value="perfect" ${B.bind !== 'saddle' ? 'selected' : ''}>무선</option><option value="saddle" ${B.bind === 'saddle' ? 'selected' : ''}>중철</option></select></label></div>
          <label class="chk"><input type="checkbox" data-bb="facing" ${B.facing ? 'checked' : ''}> 펼침면 (홀수 쪽 오른쪽 · 안쪽/바깥쪽 여백 뒤집기)</label><label class="chk"><input type="checkbox" data-bb="guides" ${B.guides ? 'checked' : ''}> 여백·단 안내선 보기 (인쇄 안 됨)</label><label class="chk"><input type="checkbox" data-bb="imgFloat" ${B.imgFloat !== false ? 'checked' : ''}> 사진이 남은 자리에 안 들어가면 뒤 글로 빈자리를 먼저 채우고 사진은 다음 쪽 위로</label>
          <p class="hint">판형(책 크기)을 바꾸려면 프로젝트 → 크기 바꾸기 뒤 「다시 흘리기」. 도련 ${Number(d.bleed) || 0}mm.</p>`)}
        ${sec('styles', '🅰 단락 스타일', `<p class="hint" style="margin-top:0">스타일을 고치면 책 전체의 같은 단락이 한꺼번에 바뀝니다 (인디자인 단락 스타일). 장 다음 첫 단락은 들여쓰지 않습니다.</p>${PS_ORDER.map(styleRow).join('')}<button class="btn sm" data-bk="psreset" style="margin-top:6px">기본 스타일로 되돌리기</button>`)}
        ${sec('typo', '✒ 조판 다듬기', `<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap"><span style="font-size:12px;font-weight:600">책 전체 글자</span><button class="btn sm" data-bk="fsz-" title="모든 단락 스타일 글자를 0.5pt씩 작게">가 작게</button><button class="btn sm" data-bk="fsz+" title="모든 단락 스타일 글자를 0.5pt씩 크게">가 크게</button><span class="hint" style="margin:0">본문 ${S0.body.size}pt · 행간 ${Math.round(S0.body.lh * 100)}%</span></div>
          <label class="f" style="margin-top:8px"><span>본문 줄바꿈</span><select data-ps="body.brk"><option value="char" ${S0.body.brk === 'char' ? 'selected' : ''}>글자 단위 + 양끝 맞춤 (단행본처럼 반듯하게)</option><option value="word" ${S0.body.brk !== 'char' ? 'selected' : ''}>어절 단위 (낱말이 갈리지 않게 — 교재)</option></select></label>
          <label class="chk"><input type="checkbox" data-bb="chapNum" ${B.chapNum === true ? 'checked' : ''}> 장 제목 위에 「제1장」 번호 붙이기 (차례에도)</label><p class="hint" style="margin:0 0 4px 24px">머리말처럼 번호를 빼려는 장은 제목 끝에 {번호없음}</p>
          <label class="chk"><input type="checkbox" data-bb="typo" ${B.typo !== false ? 'checked' : ''}> 글 다듬기: "곧은 따옴표" → “둥근 따옴표”, 숫자와 단위(3쪽·10명)가 줄 끝에서 갈리지 않게</label>
          <label class="chk"><input type="checkbox" data-bb="tighten" ${B.tighten !== false ? 'checked' : ''}> 단락 끝줄에 한두 글자만 남으면 자간을 살짝 좁혀 윗줄로 당기기</label>
          <p class="hint">원고는 그대로 두고 쪽에 앉힐 때만 다듬습니다.</p>`)}
        ${sec('master', '🗂 머리글 · 쪽 번호 (마스터)', `<div class="grid2"><label class="f"><span>왼쪽(짝수) 쪽 머리글</span><input type="text" data-bb="headL" value="${esc(B.headL || '')}" placeholder="{책제목}"></label><label class="f"><span>오른쪽(홀수) 쪽 머리글</span><input type="text" data-bb="headR" value="${esc(B.headR || '')}" placeholder="{장제목}"></label></div>
          <p class="hint" style="margin-top:0"><b>{책제목}</b> · <b>{장제목}</b>(그 쪽의 장 — 인디자인 '머리글 변수') · <b>{절제목}</b>(그 쪽의 절) · <b>{지은이}</b>. 장이 시작하는 쪽과 빈 쪽에는 머리글이 없습니다.</p>
          <div class="grid3"><label class="f"><span>쪽 번호 위치</span><select data-bb="pos">${[['outer', '바깥쪽'], ['center', '가운데'], ['inner', '안쪽']].map(([a, t]) => `<option value="${a}" ${B.pos === a ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>번호 모양</span><select data-bb="style">${[['n', '1'], ['dash', '- 1 -'], ['p', 'p.1']].map(([a, t]) => `<option value="${a}" ${B.style === a ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${N('size', '글자(pt)', B.size, 0.5, 5)}</div>
          <div class="grid2">${N('start', '이 문서 첫 쪽 번호', B.start, 1, 1)}<label class="chk" style="margin-top:20px"><input type="checkbox" data-bb="rule" ${B.rule ? 'checked' : ''}> 머리글 아래 가는 선</label></div>
          <div class="bk-pgm"><b>지금 쪽 (${A.cur + 1}쪽)</b> <label class="chk"><input type="checkbox" data-pgm="noMaster" ${pg.noMaster ? 'checked' : ''}> 머리글·쪽 번호 빼기 (인디자인 [없음] 마스터)</label></div>`)}
        ${sec('toc', '📑 차례', `<p class="hint" style="margin-top:0">장·절 제목과 쪽 번호로 차례를 만듭니다 (점선·쪽 번호). 원고를 고쳐 다시 흘리면 차례도 함께 새로 고쳐집니다.</p>
          <div class="grid2"><label class="f"><span>차례에 넣을 제목</span><select data-bb="tocLevel">${[[1, '장만'], [2, '장 + 절'], [3, '장 + 절 + 소제목']].map(([a, t]) => `<option value="${a}" ${Number(B.tocLevel || 2) === a ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>차례 제목</span><input type="text" data-bb="tocTitle" value="${esc(B.tocTitle || '차례')}"></label></div>
          <button class="btn sm" data-bk="toc">${d.pages.some(p => p.toc) ? '차례 새로 고침' : '차례 쪽 넣기 (본문 앞)'}</button>`)}
        ${sec('check', '✅ 점검 · 내보내기', `<button class="btn sm" data-bk="check">🔍 점검하기</button>${pf}
          <div class="col" style="gap:6px;margin-top:10px"><button class="btn primary full" data-bk="pdf" title="낱쪽 PDF · 도련 3mm · 재단선 — 인쇄소에 보내는 파일">🖨 인쇄소용 PDF (도련 3mm·재단선)</button><button class="btn full" data-bk="spread">📖 펼침면으로 보기</button><button class="btn full" data-bk="booklet" title="집 프린터 — 양면 인쇄 후 반으로 접어 스테이플">🏠 집에서 중철 소책자 인쇄 PDF</button><button class="btn full" data-bk="copymsg" title="판형·쪽 수·제본·도련을 적은 글 — 문자·메일에 붙여 넣기">✉ 인쇄소에 보낼 말 복사</button></div>`)}`;
      body.onclick = async e => {
        const sm = e.target.closest('summary'); if (sm) { const dt = sm.parentElement; setTimeout(async () => { if (dt.open) open.add(dt.dataset.sec); else open.delete(dt.dataset.sec); if (dt.open && dt.dataset.sec === 'check') { pfCache = await preflight(); A.renderSide(); } }, 0); return; } /* 점검 칸을 열면 저절로 살핌 */
        const g = e.target.closest('[data-goto]'); if (g) { A.goto(Number(g.dataset.goto)); return; }
        const fx = e.target.closest('[data-pffix]'); if (fx && pfCache) { const it = pfCache[Number(fx.dataset.pffix)]; if (!it) return;
          if (it.fix === 'flow') await flow({ quiet: true });
          if (it.fix === 'bleed') { d.bleed = 3; A.commit(); }
          if (it.fix === 'pad2' || it.fix === 'pad4') { const need = it.fix === 'pad4' ? (4 - d.pages.length % 4) % 4 : d.pages.length % 2; let bi = d.pages.findIndex(p => p.back); if (bi < 0) bi = d.pages.length; for (let j = 0; j < need; j++) { const bp = A.newPage(); bp.noMaster = true; bp.label = '빈 쪽'; d.pages.splice(bi, 0, bp); } A.commit(); A.renderAll(); A.toast(`판권 앞에 빈 쪽 ${need}개를 더했습니다 — 지금 ${d.pages.length}쪽`); }
          if (it.fix === 'line') { openStory(it.line); return; }
          pfCache = await preflight(); open.add('check'); A.renderSide(); return; }
        if (b0(e, 'copymsg')) { const msg = printMsg(); try { await navigator.clipboard.writeText(msg); A.toast('인쇄소에 보낼 말을 복사했습니다 — 문자·메일에 붙여 넣으세요'); } catch (er) { window.prompt('아래 글을 복사하세요', msg); } return; }
        const b = e.target.closest('[data-bk]'); if (!b) return; const k = b.dataset.bk;
        if (k === 'story') openStory(); if (k === 'import') importFile(md => { A.doc.bstory.md = md; flow(); });
        if (k === 'flow') { await flow(); } if (k === 'spread') A.openSpreads(); if (k === 'toc') addToc();
        if (k === 'fsz+' || k === 'fsz-') { const dz = k === 'fsz+' ? 0.5 : -0.5, cur = ps(); if (cur.body.size + dz < 7 || cur.body.size + dz > 20) { A.toast('본문 글자는 7~20pt 사이로 정합니다', true); return; } d.bstyles = d.bstyles || {}; Object.keys(cur).forEach(sk => { const o = d.bstyles[sk] = Object.assign({}, d.bstyles[sk] || {}); o.size = Math.max(6, Math.round((cur[sk].size + dz * cur[sk].size / cur.body.size) * 2) / 2); }); await flow({ quiet: true }); A.toast(`책 전체 글자를 ${dz > 0 ? '크게' : '작게'} — 본문 ${ps().body.size}pt · 본문 ${(d.book.lastFlow || {}).pages || 0}쪽`); A.renderSide(); return; }
        if (k === 'psreset') { if (confirm('단락 스타일을 처음 값으로 되돌릴까요?')) { d.bstyles = psDefaults(B.kind || 'general'); await flow({ quiet: true }); A.toast('기본 스타일로 되돌렸습니다'); } }
        if (k === 'check') { b.disabled = true; b.textContent = '살피는 중…'; pfCache = await preflight(); open.add('check'); A.renderSide(); }
        if (k === 'pdf') { if (stale()) await flow({ quiet: true }); pfCache = await preflight(); const bad = pfCache.filter(x => x.lv === 'bad'); if (bad.length && !window.confirm(`꼭 고칠 것이 ${bad.length}개 있습니다:\n\n${bad.map(x => '· ' + x.msg).join('\n')}\n\n그래도 인쇄소용 PDF를 만들까요?`)) { open.add('check'); A.renderSide(); return; } if (!(Number(d.bleed) > 0)) d.bleed = 3; d.cropMarks = true; A.commit(); A.openDownload('pdfprint'); open.add('check'); A.renderSide(); }
        if (k === 'booklet') { if (stale()) await flow({ quiet: true }); A.bookletPdf(); }
      };
      body.onchange = e => {
        const t = e.target;
        if (t.dataset.pgm) { A.page().noMaster = t.checked; A.commit(); A.renderCanvas(); return; }
        if (t.dataset.ps) { const [k, f] = t.dataset.ps.split('.'); if (!d.bstyles) d.bstyles = {}; const o = d.bstyles[k] = Object.assign({}, d.bstyles[k] || {}); let v = t.type === 'number' ? Number(t.value) : t.value; let key = f; if (f === 'lhp') { key = 'lh'; v = v / 100; } if (f === 'lsp') { key = 'ls'; v = v / 100; } if (f === 'weight') v = Number(v); o[key] = v; flowSoon(80); return; }
        if (t.dataset.bb) { const k = t.dataset.bb; let v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value; if (t.type === 'number' && t.value === '') return; if (k === 'tocLevel') v = Number(v);
          if (k.startsWith('mg.')) { d.book.mg = Object.assign({}, A.BOOK_DEF.mg, d.book.mg || {}); d.book.mg[k.slice(3)] = v; } else d.book[k] = v;
          if (['mg.top', 'mg.bottom', 'mg.inner', 'mg.outer', 'cols', 'gutter', 'facing', 'tocLevel', 'tocTitle', 'start', 'imgFloat', 'chapNum', 'typo', 'tighten'].includes(k)) flowSoon(80); else { A.commit(); A.renderCanvas(); } }
      };
    }

    /* ---------- 머리글·쪽 번호 (마스터) — app.js masterHTML이 책 모드일 때 부름 ---------- */
    function masterHTML(pg, i) {
      const B = B_(), d = A.doc; if (pg.blank || pg.noMaster || pg.cover) return ''; const n = A.bookNum(i); if (n == null) return '';
      const right = A.isRightPage(i), L = right ? B.mg.inner : B.mg.outer, R = right ? B.mg.outer : B.mg.inner, outerAl = right ? 'right' : 'left', innerAl = right ? 'left' : 'right';
      const tok = s => String(s || '').split('{책제목}').join(B.title || '').split('{지은이}').join(B.author || '').split('{장제목}').join(pg.chap || '').split('{절제목}').join(pg.sec || pg.chap || '');
      const f0 = d.pages.findIndex(p => p.flow); if (B.frontNum !== true && f0 > 0 && i < f0) return ''; /* 앞붙이(속표지·차례)에는 쪽 번호·머리글 없음 — 책 관행 */
      const head = pg.chapOpen || pg.toc ? '' : tok(right ? B.headR : B.headL).trim();
      const f = `font-family:'${esc(B.font || 'Pretendard')}','Noto Sans KR',sans-serif;font-size:${Number(B.size) || 8.5}pt;color:${esc(B.color || '#555')};line-height:1.2;white-space:nowrap;overflow:hidden;pointer-events:none;z-index:50;position:absolute;left:${L}mm;right:${R}mm;`;
      const num = { n: String(n), dash: `- ${n} -`, p: `p.${n}` }[B.style] || String(n), al = B.pos === 'center' ? 'center' : B.pos === 'inner' ? innerAl : outerAl;
      let h = '';
      const gapT = Math.min(5, B.mg.top * 0.3), gapB = Math.min(8, B.mg.bottom * 0.4);
      if (head) h += `<div class="mst" style="${f}top:${r1(B.mg.top - gapT)}mm;transform:translateY(-100%);text-align:${outerAl};${B.rule ? `border-bottom:0.09mm solid ${esc(B.ruleColor || '#999999')};padding-bottom:1.2mm;` : ''}">${esc(head)}</div>`;
      h += `<div class="mst" style="${f}top:${r1(d.h - B.mg.bottom + gapB)}mm;transform:translateY(-75%);text-align:${al}">${esc(num)}</div>`;
      return h;
    }
    function onFrameDbl(el) { openStory(el.flowLine); }
    /* 불러온 파일의 본문 상자 HTML 정리: 흘리기가 만드는 태그(p·span·b)와 서식 속성만 남김 (파일에 끼어든 스크립트·링크·그림 주소 차단) */
    const OK_TAG = new Set(['P', 'SPAN', 'B']), OK_CSS = new Set(['margin', 'padding', 'border-left', 'border-top', 'width', 'background', 'margin-right', 'text-indent', 'font-family', 'font-size', 'line-height', 'font-weight', 'color', 'text-align', 'text-align-last', 'letter-spacing', 'word-break', 'overflow-wrap', 'line-break', 'display', 'align-items', 'gap', 'flex', 'border-bottom', 'opacity', 'transform', 'font-variant-numeric']);
    function sanitize(html) {
      const box = document.implementation.createHTMLDocument('').createElement('div'); box.innerHTML = String(html || '');
      const walk = n => { let s = ''; n.childNodes.forEach(c => { if (c.nodeType === 3) s += esc(c.nodeValue); else if (c.nodeType === 1) { const inner = walk(c); if (!OK_TAG.has(c.tagName)) { s += inner; return; }
        const css = String(c.getAttribute('style') || '').split(';').map(x => x.trim()).filter(Boolean).filter(d => { const i = d.indexOf(':'); if (i < 0) return false; const k = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1); return OK_CSS.has(k) && !/url\(|expression|javascript:|[<>]/i.test(v); }).join(';');
        const t = c.tagName.toLowerCase(); s += `<${t}${css ? ` style="${css.replace(/"/g, "'")}"` : ''}>${inner}</${t}>`; } }); return s; };
      return walk(box);
    }

    /* ---------- 보기 원고 (태권도 교본 예시 — 팀장님이 바꿔 쓰시도록) ---------- */
    const josa = (w, a, b) => { const c = String(w || '').trim().slice(-1), k = c.charCodeAt(0); if (k >= 0xac00 && k <= 0xd7a3) return w + ((k - 0xac00) % 28 ? a : b); return w + (/[0-9LMNRlmnr]$/.test(c) ? a : b); };
    const SAMPLE = (title) => `# 태권도를 시작하며
태권도는 우리 몸과 마음을 함께 단련하는 무도입니다. 발차기와 품새를 익히는 동안 우리는 바른 자세와 예의, 그리고 끝까지 해내는 힘을 배웁니다. 이 책은 ${josa(title, '을', '를')} 함께 공부하는 수련생과 가족을 위해 만들었습니다.
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

    return { renderSide, openNewBook, openStory, flow, masterHTML, onFrameDbl, isBook, stale, parse, preflight, htmlToMd, sanitize, makeBook, afterCommit };
  };
})();
