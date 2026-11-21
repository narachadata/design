// 다른 프로그램 파일 가져오기 (팀장님 11/21 「인디자인·쿽익스프레스·일러스트·포토샵 파일을 잘 읽어 와서 편집」)
// · 포토샵 PSD/PSB  → 레이어마다 그림(위치·숨김·투명도·혼합), 글자 레이어는 고칠 수 있는 글 상자, 레이어 그룹은 묶음 (ag-psd 34.1.0)
// · 인디자인 IDML   → 쪽마다 글 상자(글꼴·크기·색·정렬·행간)·도형(색·선·둥근 모서리)·사진 틀, 마스터(머리글·쪽 번호 {쪽}), 이어진 긴 글은 「도서 편집」 원고로도
//                    (.indd는 형식이 공개되지 않아 인디자인에서 파일 → 내보내기 → InDesign Markup(IDML)로)
// · 일러스트 AI / PDF (쿽 → PDF) → 쪽마다 배경 그림(글자 뺀 그림) + 고칠 수 있는 글 상자(글꼴·크기·색), 또는 그림 한 장 그대로 (pdf.js 3.11)
// · 쿽 QXP·인디자인 INDD·EPS → 여는 법 안내
(function () {
  'use strict';
  window.NC = window.NC || {};
  NC.importMod = function (A) {
    const esc = A.esc, $ = s => document.querySelector(s), PT2MM = 25.4 / 72, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
    const ext = f => (String(f.name).match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
    const KINDS = { psd: 'psd', psb: 'psd', idml: 'idml', ai: 'pdf', pdf: 'pdf', indd: 'indd', indt: 'indd', qxp: 'qxp', qxd: 'qxp', qxt: 'qxp', eps: 'eps' };
    const isImportable = f => !!KINDS[ext(f)];
    const isImg = f => /^image\/(png|jpe?g|webp|gif|svg\+xml|bmp)$/i.test(f.type) || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(f.name);

    /* ---------- 글꼴 맞추기: 원래 글꼴 이름 → 공방에 있는 글꼴 (없으면 비슷한 계열) ---------- */
    const famList = () => (A.FONTS || []).map(f => f.family);
    function mapFont(name, report) {
      const raw = String(name || '').replace(/^[A-Z]{6}\+/, '').trim(); if (!raw) return { font: 'Pretendard', weight: 400 };
      const low = raw.toLowerCase().replace(/[\s_-]+/g, ''), fams = famList();
      const weight = /black|heavy|extrabold|ultrabold|eb\b|^.*xb$/i.test(raw) ? 800 : /bold|\bbd\b|semibold|demibold|sb\b/i.test(raw) ? 700 : /medium|\bmd\b/i.test(raw) ? 500 : /light|thin|\blt\b/i.test(raw) ? 300 : 400;
      const base = raw.replace(/[-,\s]*(regular|bold|light|medium|black|heavy|thin|semibold|extrabold|ultrabold|demibold|italic|oblique|std|pro|otf|ttf|lt|bd|md|eb|xb|b|l|m|r)$/ig, '').replace(/[-,\s]*(regular|bold|light|medium|black|heavy|thin|semibold|extrabold|italic)$/ig, '');
      const blow = base.toLowerCase().replace(/[\s_-]+/g, '');
      let hit = fams.find(f => f.toLowerCase().replace(/[\s_-]+/g, '') === low) || fams.find(f => f.toLowerCase().replace(/[\s_-]+/g, '') === blow) || (blow.length > 3 && fams.find(f => { const x = f.toLowerCase().replace(/[\s_-]+/g, ''); return x.length > 3 && (blow.includes(x) || x.includes(blow)); }));
      let out = hit;
      if (!out) {
        if (/myeongjo|myungjo|batang|명조|바탕|serif|minion|times|garamond|song|sm|hy신|ys|kopub.*batang|bon.*myeongjo|명/i.test(raw)) out = /nanum/i.test(raw) ? (fams.includes('Nanum Myeongjo') ? 'Nanum Myeongjo' : 'Noto Serif KR') : 'Noto Serif KR';
        else if (/gothic|dotum|고딕|돋움|sans|helvetica|arial|myriad|malgun|맑은|kopub.*dotum|spoqa|pretendard/i.test(raw)) out = /nanum/i.test(raw) && fams.includes('Nanum Gothic') ? 'Nanum Gothic' : /pretendard/i.test(raw) ? 'Pretendard' : 'Noto Sans KR';
        else out = 'Pretendard';
        if (report) report.add(`${raw} → ${out}`);
      }
      return { font: out, weight, italic: /italic|oblique/i.test(raw) };
    }
    const hex2 = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    const rgbHex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);
    const cmykHex = (c, m, y, k) => rgbHex(255 * (1 - c / 100) * (1 - k / 100), 255 * (1 - m / 100) * (1 - k / 100), 255 * (1 - y / 100) * (1 - k / 100));
    const tintHex = (h, t) => { if (!h || t == null || t >= 100) return h; const n = parseInt(h.slice(1), 16), f = t / 100; return rgbHex(255 - (255 - (n >> 16)) * f, 255 - (255 - ((n >> 8) & 255)) * f, 255 - (255 - (n & 255)) * f); };
    const dataURLof = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });

    /* =================== 포토샵 PSD =================== */
    async function importPSD(file, rep) {
      A.setStatus('포토샵 파일 읽는 중… (라이브러리 받는 중)');
      await A.loadScript('https://cdn.jsdelivr.net/npm/ag-psd@34.1.0/dist/bundle.js', () => window.agPsd, 'sha384-8QaSf9YmL2EzGhVa4Ma9mhhrRvfH85Fmk3zjDwbmVRDfL3FVw/mdmakdEB1UeqK+');
      A.setStatus('포토샵 레이어를 읽는 중…');
      const psd = window.agPsd.readPsd(await file.arrayBuffer(), { skipThumbnail: true, skipCompositeImageData: false });
      return psdToDoc(psd, file.name.replace(/\.[^.]+$/, ''), rep);
    }
    const BLEND = { multiply: 'multiply', screen: 'screen', overlay: 'overlay', darken: 'darken', lighten: 'lighten', 'color dodge': 'color-dodge', 'color burn': 'color-burn', 'hard light': 'hard-light', 'soft light': 'soft-light', difference: 'difference', exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity' };
    function psdToDoc(psd, name, rep) {
      const res = psd.imageResources && psd.imageResources.resolutionInfo, dpi0 = res && res.horizontalResolution ? (res.horizontalResolutionUnit === 'PPCM' ? res.horizontalResolution * 2.54 : res.horizontalResolution) : 72;
      const print = dpi0 >= 150, dpi = print ? dpi0 : 96, mm = px => r2(px / dpi * 25.4), ptOf = px => r1(px * 72 / dpi); /* 화면용(72dpi) PSD는 공방 화면 문서처럼 96dpi로 (1080px = 285.75mm) */
      const W = mm(psd.width), H = mm(psd.height), els = []; let nText = 0, nImg = 0;
      const walk = (list, gname, gid, hiddenUp) => (list || []).forEach(L => {
        const hidden = !!(L.hidden || hiddenUp), nm = (gname ? gname + ' › ' : '') + (L.name || '레이어');
        if (L.children) { const g = A.uid(); walk(L.children, nm, g, hidden); return; }
        let x = mm(L.left || 0), y = mm(L.top || 0), w = mm((L.right || 0) - (L.left || 0)), h = mm((L.bottom || 0) - (L.top || 0));
        if ((w <= 0 || h <= 0) && L.text && L.text.transform) { /* 글자 그림이 없는 글자 레이어: 기준점(첫 줄 바탕선)과 글자 크기로 자리 짐작 */
          const t = L.text, st0 = t.style || {}, sc0 = Math.hypot(t.transform[0], t.transform[1]) || 1, fs = (st0.fontSize || 24) * sc0, ls0 = String(t.text || '').split(/\r\n?|\n|\u0003/), bb = t.boundingBox || t.bounds;
          if (bb && bb.right && bb.right.value != null) { x = mm(t.transform[4] + bb.left.value * sc0); y = mm(t.transform[5] + bb.top.value * sc0); w = mm((bb.right.value - bb.left.value) * sc0); h = mm((bb.bottom.value - bb.top.value) * sc0); }
          else { x = mm(t.transform[4]); y = mm(t.transform[5] - fs * 0.9); w = mm(Math.max(...ls0.map(l => l.length)) * fs * 0.95 + fs); h = mm(ls0.length * fs * 1.25); } }
        if (w <= 0 || h <= 0) return;
        const base = { id: A.uid(), x, y, w, h, rot: 0, opacity: L.opacity == null ? 1 : r2(L.opacity), name: nm };
        if (gid) base.group = gid; if (hidden) base.hidden = true;
        if (L.text && L.text.text != null && !(L.text.transform && Math.abs(L.text.transform[1]) > 0.01)) { /* 글자 레이어 → 고칠 수 있는 글 상자 (기울인 글자는 그림으로) */
          const t = L.text, st = t.style || {}, ps = t.paragraphStyle || {}, sc = t.transform ? Math.hypot(t.transform[0], t.transform[1]) || 1 : 1, F = mapFont(st.font && st.font.name, rep.fonts), fc = st.fillColor;
          const size = ptOf((st.fontSize || 24) * sc), col = fc && fc.r != null ? rgbHex(fc.r, fc.g, fc.b) : '#000000';
          const lead = st.leading && st.fontSize && !st.autoLeading ? r2(st.leading / st.fontSize) : 1.2, align = { center: 'center', right: 'right', justifyAll: 'justify', justifyLeft: 'justify' }[ps.justification] || 'left';
          els.push(Object.assign({}, A.TEXT_DEF, base, { text: String(t.text).replace(/\r\n?/g, '\n').replace(/\u0003/g, '\n'), font: F.font, weight: F.weight, italic: !!F.italic || !!st.fauxItalic, size, color: col, lh: Math.max(0.8, lead), align, ls: st.tracking ? r2(st.tracking / 1000) : 0, w: r1(w * 1.06 + 1) }));
          if (st.fauxBold) els[els.length - 1].weight = 700; nText++; return;
        }
        if (!L.canvas || !L.canvas.width || !L.canvas.height) return;
        const src = A.addAsset(L.canvas.toDataURL('image/png'));
        els.push(Object.assign(base, { type: 'image', src, fit: 'fill', pos: '50% 50%', flip: false, radius: 0, blend: BLEND[L.blendMode] || undefined })); nImg++;
      });
      walk(psd.children, '', null, false);
      if (!els.length && psd.canvas) { els.push({ id: A.uid(), type: 'image', src: A.addAsset(psd.canvas.toDataURL('image/png')), x: 0, y: 0, w: W, h: H, rot: 0, fit: 'fill', pos: '50% 50%', opacity: 1, name: '합친 그림' }); nImg++; rep.notes.push('레이어 정보가 없어 합친 그림 한 장으로 넣었습니다.'); }
      rep.summary = `레이어 그림 ${nImg}개 · 글자 레이어 ${nText}개 (글자는 두 번 눌러 고침)`;
      if (!print) rep.notes.push(`화면용(${Math.round(dpi0)}dpi) 파일이라 공방 화면 문서처럼 맞췄습니다 — ${psd.width}×${psd.height}px.`);
      return { name, w: W, h: H, px: !print, pages: [{ bg: '#ffffff', els, label: '' }] };
    }

    /* =================== 인디자인 IDML =================== */
    const MAT = s => { const a = String(s || '1 0 0 1 0 0').trim().split(/\s+/).map(Number); return a.length === 6 && a.every(isFinite) ? a : [1, 0, 0, 1, 0, 0]; };
    const mul = (p, q) => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];
    const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    const kids = (el, tag) => [...el.children].filter(c => !tag || c.tagName === tag);
    const prop = (el, name) => { const p = kids(el, 'Properties')[0]; if (!p) return null; const x = kids(p, name)[0]; return x ? x.textContent : null; };
    async function importIDML(file, extra, rep) {
      A.setStatus('인디자인(IDML) 파일 읽는 중…');
      await A.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', () => window.JSZip, 'sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG');
      const zip = await window.JSZip.loadAsync(await file.arrayBuffer()), xml = async p => { const f = zip.file(p); if (!f) return null; return new DOMParser().parseFromString(await f.async('string'), 'application/xml'); };
      const dm = await xml('designmap.xml'); if (!dm) throw new Error('IDML 안에 designmap.xml이 없습니다');
      /* 색 */
      const colors = {}; const gr = await xml('Resources/Graphic.xml');
      if (gr) [...gr.getElementsByTagName('Color')].forEach(c => { const v = String(c.getAttribute('ColorValue') || '').split(/\s+/).map(Number), sp = c.getAttribute('Space'); colors[c.getAttribute('Self')] = sp === 'CMYK' ? cmykHex(...v) : sp === 'RGB' ? rgbHex(...v) : sp === 'LAB' ? (v[0] > 50 ? '#cccccc' : '#333333') : '#000000'; });
      if (gr) [...gr.getElementsByTagName('Tint')].forEach(t => { const b = colors[t.getAttribute('BaseColor')]; if (b) colors[t.getAttribute('Self')] = tintHex(b, Number(t.getAttribute('TintValue'))); });
      colors['Color/Paper'] = '#ffffff'; colors['Color/Black'] = colors['Color/Black'] || '#231f20'; colors['Color/Registration'] = '#000000';
      const col = (ref, tint) => { if (!ref || /Swatch\/None/.test(ref)) return ''; const c = colors[ref] || (/Black/.test(ref) ? '#231f20' : ''); return tint != null && tint !== '' && Number(tint) >= 0 ? tintHex(c, Number(tint)) : c; };
      /* 스타일 (BasedOn 이어받기) */
      const styles = {}; const sx = await xml('Resources/Styles.xml');
      const readAttrs = el => { const o = {}; ['PointSize', 'Leading', 'Justification', 'FontStyle', 'FillColor', 'FillTint', 'SpaceBefore', 'SpaceAfter', 'FirstLineIndent', 'LeftIndent', 'Tracking', 'Underline', 'Capitalization'].forEach(k => { const v = el.getAttribute(k); if (v != null) o[k] = v; }); const f = prop(el, 'AppliedFont'); if (f) o.AppliedFont = f; const ld = prop(el, 'Leading'); if (ld != null && o.Leading == null) o.Leading = ld; const b = prop(el, 'BasedOn'); if (b) o._based = b; return o; };
      if (sx) ['ParagraphStyle', 'CharacterStyle'].forEach(t => [...sx.getElementsByTagName(t)].forEach(s => { styles[s.getAttribute('Self')] = Object.assign(readAttrs(s), { _name: s.getAttribute('Name') || '' }); }));
      const resolve = (ref, seen) => { const s = styles[ref]; if (!s) return {}; seen = seen || new Set(); if (seen.has(ref)) return Object.assign({}, s); seen.add(ref); return Object.assign({}, s._based ? resolve(s._based, seen) : {}, s); };
      /* 원고(스토리) */
      const storyFiles = [...dm.getElementsByTagName('idPkg:Story')].map(e => e.getAttribute('src')), stories = {};
      for (const p of storyFiles) { const d = await xml(p); if (!d) continue; const st = d.getElementsByTagName('Story')[0]; if (st) stories[st.getAttribute('Self')] = st; }
      function storyParas(st) {
        const paras = []; let cur = null;
        const newP = (pst) => { cur = { pst, runs: [] }; paras.push(cur); };
        [...st.getElementsByTagName('ParagraphStyleRange')].forEach(psr => {
          const pref = psr.getAttribute('AppliedParagraphStyle'), P = Object.assign(resolve(pref), readAttrs(psr)); delete P._based; P._name = (styles[pref] || {})._name || '';
          if (!cur || cur.pst !== P) newP(P);
          [...psr.getElementsByTagName('CharacterStyleRange')].forEach(csr => {
            const C = Object.assign({}, P, resolve(csr.getAttribute('AppliedCharacterStyle')), readAttrs(csr)); delete C._based;
            [...csr.childNodes].forEach(n => {
              if (n.nodeType === 7) { if (n.target === 'ACE' && /^\s*18\b/.test(n.data || '')) cur.runs.push({ t: '{쪽}', C }); return; } /* 현재 쪽 번호 */
              if (n.nodeType !== 1) return;
              if (n.tagName === 'Content') cur.runs.push({ t: n.textContent.replace(/\u2028/g, '\n'), C });
              else if (n.tagName === 'Br') newP(P);
            });
          });
        });
        return paras.filter((p, i) => p.runs.length || i < paras.length - 1);
      }
      const ptsz = v => Number(v) || 12;
      function frameText(st) {
        const paras = storyParas(st); if (!paras.length) return null;
        const P0 = (paras.find(p => p.runs.length) || paras[0]).pst, R0 = ((paras.find(p => p.runs.length) || {}).runs || [])[0];
        const base = Object.assign({}, P0, R0 ? R0.C : {}), F0 = mapFont(base.AppliedFont, rep.fonts), size0 = ptsz(base.PointSize), lead0 = base.Leading && base.Leading !== 'Auto' ? Number(base.Leading) / size0 : 1.2;
        const color0 = col(base.FillColor || 'Color/Black', base.FillTint) || '#231f20', just = String(P0.Justification || 'LeftAlign');
        const align = /Center/.test(just) && !/Justified/.test(just) ? 'center' : /Right/.test(just) ? 'right' : /Justified/.test(just) ? 'justify' : 'left';
        const lines = [], html = paras.map(p => p.runs.map(r => { const C = r.C, F = mapFont(C.AppliedFont, rep.fonts), sz = ptsz(C.PointSize), c = col(C.FillColor || 'Color/Black', C.FillTint) || color0, w = /bold|black|heavy/i.test(C.FontStyle || '') ? 700 : /medium/i.test(C.FontStyle || '') ? 500 : F.weight;
          const css = []; if (Math.abs(sz - size0) > 0.05) css.push(`font-size:${r1(sz)}pt`); if (c.toLowerCase() !== color0.toLowerCase()) css.push(`color:${c}`); if (w !== (/bold|black|heavy/i.test(base.FontStyle || '') ? 700 : F0.weight)) css.push(`font-weight:${w}`); if (/italic/i.test(C.FontStyle || '')) css.push('font-style:italic'); if (C.Underline === 'true') css.push('text-decoration:underline');
          const t = esc(C.Capitalization === 'AllCaps' ? r.t.toUpperCase() : r.t); return css.length ? `<span style="${css.join(';')}">${t}</span>` : t; }).join('')).join('<br>');
        paras.forEach(p => lines.push(p.runs.map(r => r.t).join('')));
        return { text: lines.join('\n'), html, font: F0.font, weight: /bold|black|heavy/i.test(base.FontStyle || '') ? 700 : F0.weight, italic: /italic/i.test(base.FontStyle || ''), size: r1(size0), lh: r2(Math.max(0.8, lead0)), color: color0, align, ls: base.Tracking ? r2(Number(base.Tracking) / 1000) : 0, paras };
      }
      /* 쪽 · 마스터 */
      const spreadFiles = [...dm.getElementsByTagName('idPkg:Spread')].map(e => e.getAttribute('src')), masterFiles = [...dm.getElementsByTagName('idPkg:MasterSpread')].map(e => e.getAttribute('src'));
      const links = {}; (extra || []).forEach(f => { links[f.name.toLowerCase()] = f; });
      const usedStories = new Map(); let nText = 0, nShape = 0, nImg = 0; const missing = new Set();
      async function itemsOf(container, M0, pageRects, out, gid) {
        for (const it of kids(container)) {
          const tag = it.tagName; if (!/^(TextFrame|Rectangle|Oval|Polygon|GraphicLine|Group)$/.test(tag)) continue;
          if (it.getAttribute('Visible') === 'false') continue;
          const M = mul(M0, MAT(it.getAttribute('ItemTransform')));
          if (tag === 'Group') { await itemsOf(it, M, pageRects, out, A.uid()); continue; }
          let pts = [...it.getElementsByTagName('PathPointType')].filter(p => p.closest(tag) === it).map(p => p.getAttribute('Anchor').split(/\s+/).map(Number));
          if (!pts.length) { const gb = String(it.getAttribute('GeometricBounds') || '').split(/\s+/).map(Number); if (gb.length === 4) pts = [[gb[1], gb[0]], [gb[3], gb[2]]]; else continue; }
          const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
          const c = ap(M, (x0 + x1) / 2, (y0 + y1) / 2), sxx = Math.hypot(M[0], M[1]), syy = Math.hypot(M[2], M[3]), rot = Math.round(Math.atan2(M[1], M[0]) * 1800 / Math.PI) / 10;
          const wpt = (x1 - x0) * sxx, hpt = (y1 - y0) * syy, pi = pageRects.findIndex(r => c[0] >= r.x0 - 0.5 && c[0] <= r.x1 + 0.5) ; const pr = pageRects[pi < 0 ? 0 : pi]; if (!pr) continue;
          const el0 = { id: A.uid(), x: r2((c[0] - pr.x0 - wpt / 2) * PT2MM), y: r2((c[1] - pr.y0 - hpt / 2) * PT2MM), w: r2(Math.max(0.3, wpt * PT2MM)), h: r2(Math.max(0.3, hpt * PT2MM)), rot: Math.abs(rot) < 0.05 ? 0 : rot, opacity: 1 };
          if (gid) el0.group = gid;
          const fill = col(it.getAttribute('FillColor'), it.getAttribute('FillTint')), stroke = col(it.getAttribute('StrokeColor'), it.getAttribute('StrokeTint')), sw = Number(it.getAttribute('StrokeWeight') || 0), op = kids(it, 'TransparencySetting')[0];
          const opv = op && op.getElementsByTagName('BlendingSetting')[0] && op.getElementsByTagName('BlendingSetting')[0].getAttribute('Opacity'); if (opv) el0.opacity = r2(Number(opv) / 100);
          const target = out[pi < 0 ? 0 : pi];
          if (tag === 'TextFrame') {
            const sid = it.getAttribute('ParentStory'), st = stories[sid]; if (!st) continue;
            const first = !usedStories.has(sid); usedStories.set(sid, (usedStories.get(sid) || 0) + 1); if (!first) continue; /* 이어진(스레드) 글 상자는 첫 상자에 모두 — 넘치면 빨간 + */
            const T = frameText(st); if (!T) continue;
            const tfp = it.getElementsByTagName('TextFramePreference')[0], ncol = tfp ? Number(tfp.getAttribute('TextColumnCount') || 1) : 1, gut = tfp ? Number(tfp.getAttribute('TextColumnGutter') || 12) : 12, inset = tfp ? String(tfp.getAttribute('InsetSpacing') || '0').split(/\s+/).map(Number)[0] || 0 : 0;
            target.push(Object.assign({}, A.TEXT_DEF, el0, { type: 'text', text: T.text, html: T.html, htmlFor: T.text, font: T.font, weight: T.weight, italic: T.italic, size: T.size, lh: T.lh, color: T.color, align: T.align, ls: T.ls, sizing: 'fixed', bg: fill || '', pad: inset ? r1(inset * PT2MM) : 0, name: (T.text.split('\n')[0] || '글 상자').slice(0, 24) }, ncol > 1 ? { cols: ncol, colGap: r1(gut * PT2MM) } : {}));
            nText++; if (it.getAttribute('NextTextFrame') && it.getAttribute('NextTextFrame') !== 'n') rep.threads.push({ sid, paras: T.paras }); continue;
          }
          const img = it.getElementsByTagName('Image')[0] || it.getElementsByTagName('PDF')[0] || it.getElementsByTagName('EPS')[0];
          if (img) {
            const lk = img.getElementsByTagName('Link')[0], uri = lk ? decodeURIComponent(String(lk.getAttribute('LinkResourceURI') || '')) : '', fname = uri.split(/[\\/]/).pop() || '', f = links[fname.toLowerCase()];
            let src = ''; if (f && isImg(f)) src = A.addAsset(await dataURLof(f)); else { const cont = img.getElementsByTagName('Contents')[0]; if (cont && /^\s*(\/9j\/|iVBOR)/.test(cont.textContent)) src = A.addAsset((/^\s*\/9j\//.test(cont.textContent) ? 'data:image/jpeg;base64,' : 'data:image/png;base64,') + cont.textContent.trim()); }
            if (!src && fname) missing.add(fname);
            target.push(Object.assign(el0, { type: 'image', src, fit: 'cover', pos: '50% 50%', flip: false, radius: 0, name: fname ? `사진: ${fname}` : '사진 틀' })); nImg++; continue;
          }
          if (tag === 'GraphicLine') { const lw = Math.max(0.2, sw * PT2MM); target.push(Object.assign(el0, { type: 'shape', kind: 'line', h: r2(Math.max(lw, el0.h)), fill: stroke || '#000000', stroke: '', strokeW: 0, radius: 0, name: '선' })); nShape++; continue; }
          if (!fill && !(stroke && sw > 0)) continue; /* 빈 틀 */
          const rad = Number(it.getAttribute('TopLeftCornerRadius') || 0), rounded = /Rounded/.test(it.getAttribute('TopLeftCornerOption') || '');
          target.push(Object.assign(el0, { type: 'shape', kind: tag === 'Oval' ? 'ellipse' : 'rect', fill: fill || 'transparent', stroke: sw > 0 ? stroke : '', strokeW: sw > 0 ? r2(sw * PT2MM) : 0, radius: rounded ? r1(rad * PT2MM) : 0, name: tag === 'Oval' ? '원' : tag === 'Polygon' ? '도형' : '사각형' })); nShape++;
        }
      }
      const pageRectsOf = sp => { const SM = MAT(sp.getAttribute('ItemTransform')); return kids(sp, 'Page').map(pg => { const gb = String(pg.getAttribute('GeometricBounds') || '0 0 842 595').split(/\s+/).map(Number), PM = mul(SM, MAT(pg.getAttribute('ItemTransform'))), a = ap(PM, gb[1], gb[0]), b = ap(PM, gb[3], gb[2]); return { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]), pg, master: pg.getAttribute('AppliedMaster') || '', name: pg.getAttribute('Name') || '' }; }); };
      /* 마스터: 마스터 쪽마다 요소 목록 */
      const masters = {};
      for (const p of masterFiles) { const d = await xml(p); if (!d) continue; const ms = d.getElementsByTagName('MasterSpread')[0]; if (!ms) continue; const rects = pageRectsOf(ms), out = rects.map(() => []); usedStories.clear(); await itemsOf(ms, MAT(ms.getAttribute('ItemTransform')), rects, out); masters[ms.getAttribute('Self')] = out; }
      usedStories.clear(); nText = 0; nShape = 0; nImg = 0;
      const pages = []; let W = 210, H = 297, start = 1;
      for (const p of spreadFiles) {
        const d = await xml(p); if (!d) continue; const sp = d.getElementsByTagName('Spread')[0]; if (!sp) continue;
        const rects = pageRectsOf(sp), out = rects.map(() => []); await itemsOf(sp, MAT(sp.getAttribute('ItemTransform')), rects, out);
        rects.forEach((r, k) => { if (!pages.length) { W = r2((r.x1 - r.x0) * PT2MM); H = r2((r.y1 - r.y0) * PT2MM); start = Number(r.name) || 1; }
          const M = masters[r.master], mEls = M ? (M[rects.length > 1 && M.length > 1 ? (k === 0 ? 0 : M.length - 1) : Math.min(k, M.length - 1)] || []).map(e => Object.assign(A.clone(e), { id: A.uid(), name: '[마스터] ' + (e.name || ''), locked: true })) : [];
          pages.push({ bg: '#ffffff', els: mEls.concat(out[k]), label: '' }); });
      }
      if (!pages.length) throw new Error('IDML에 쪽이 없습니다');
      rep.summary = `${pages.length}쪽 · 글 상자 ${nText}개 · 도형 ${nShape}개 · 사진 틀 ${nImg}개${Object.keys(masters).length ? ' · 마스터(머리글·쪽 번호) 포함' : ''}`;
      if (missing.size) rep.notes.push(`사진 ${missing.size}개는 IDML 안에 없어 빈 틀로 넣었습니다 (${[...missing].slice(0, 6).join(', ')}${missing.size > 6 ? ' …' : ''}) — 가져올 때 IDML과 함께 Links 폴더의 사진을 같이 고르면 저절로 연결됩니다. 빈 틀을 누르고 오른쪽에서 사진을 넣어도 됩니다.`);
      if (rep.threads.length) rep.notes.push(`여러 상자로 이어진 긴 글 ${rep.threads.length}개는 첫 상자에 모두 넣었습니다(넘치면 빨간 +). 책처럼 긴 원고라면 아래 「도서 편집 원고로」를 누르면 판형 그대로 쪽에 저절로 흘립니다.`);
      return { name: file.name.replace(/\.[^.]+$/, ''), w: W, h: H, pages, start };
    }
    /* IDML 이어진 긴 글 → 도서 편집 원고 (스타일 이름으로 장·절·본문 짐작) */
    function threadsToMd(threads) {
      const kind = n => { n = String(n || '').toLowerCase(); if (/장|chapter|제목\s*1|heading\s*1|head\s*1|title|h1/.test(n)) return '# '; if (/절|제목\s*2|heading\s*2|head\s*2|subtitle|h2/.test(n)) return '## '; if (/소제목|제목\s*3|heading\s*3|head\s*3|h3/.test(n)) return '### '; if (/인용|quote/.test(n)) return '> '; if (/목록|bullet|list/.test(n)) return '- '; if (/캡션|caption|주석|note/.test(n)) return '[작은글] '; return ''; };
      return threads.map(t => t.paras.map(p => { const s = p.runs.map(r => r.t).join('').replace(/\n/g, ' ').trim(); return s ? kind(p.pst._name) + s : ''; }).filter(Boolean).join('\n')).join('\n[쪽 나눔]\n');
    }

    /* =================== 일러스트 AI · PDF =================== */
    async function importPDF(file, mode, rep) {
      A.setStatus('PDF·일러스트 파일 읽는 중…'); await A.loadPdfJs();
      let pdf; try { pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; }
      catch (e) { if (/\.ai$/i.test(file.name)) throw new Error('이 일러스트 파일은 PDF 호환 정보가 없어 열 수 없습니다 — 일러스트레이터에서 다른 이름으로 저장 → 「PDF 호환 파일 만들기」를 켜거나, PDF로 저장해 주세요'); throw e; }
      const N = Math.min(pdf.numPages, 60), pages = []; let W = 210, H = 297, nText = 0; if (pdf.numPages > 60) rep.notes.push(`쪽이 ${pdf.numPages}쪽이라 앞 60쪽만 가져왔습니다.`);
      for (let n = 1; n <= N; n++) {
        A.setStatus(`PDF ${n}/${N}쪽 그리는 중…`); const pg = await pdf.getPage(n), vp1 = pg.getViewport({ scale: 1 }), wmm = r2(vp1.width * PT2MM), hmm = r2(vp1.height * PT2MM); if (n === 1) { W = wmm; H = hmm; }
        const scale = Math.min(200 / 72, 4800 / Math.max(vp1.width, vp1.height)), vp = pg.getViewport({ scale });
        const draw = async noText => { const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height); const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); if (noText) { ctx.fillText = () => {}; ctx.strokeText = () => {}; } await pg.render({ canvasContext: ctx, viewport: vp, intent: 'print' }).promise; /* print: 화면 그리기(requestAnimationFrame)를 안 써서 다른 탭을 보는 동안에도 멈추지 않음 */ return c; };
        const full = await draw(false), els = [];
        if (mode === 'image') { els.push({ id: A.uid(), type: 'image', src: A.addAsset(full.toDataURL('image/jpeg', 0.92)), x: 0, y: 0, w: wmm, h: hmm, rot: 0, fit: 'fill', pos: '50% 50%', opacity: 1, name: `${n}쪽 그림` }); pages.push({ bg: '#ffffff', els, label: '' }); continue; }
        const bare = await draw(true), tc = await pg.getTextContent(), fctx = full.getContext('2d'), bctx = bare.getContext('2d');
        els.push({ id: A.uid(), type: 'image', src: A.addAsset(bare.toDataURL('image/jpeg', 0.92)), x: 0, y: 0, w: wmm, h: hmm, rot: 0, fit: 'fill', pos: '50% 50%', opacity: 1, locked: true, name: '배경 (글자 뺀 그림)' });
        /* 글자 조각 → 줄로 묶기 */
        const items = tc.items.filter(i => i.str != null && (i.str.trim() || i.width)).map(i => { const t = i.transform, size = Math.hypot(t[2], t[3]) || Math.hypot(t[0], t[1]); const [x, y] = vp1.convertToViewportPoint(t[4], t[5]); return { s: i.str, x, y, size, w: i.width, f: i.fontName, rot: Math.atan2(t[1], t[0]) }; }).filter(i => Math.abs(i.rot) < 0.02 && i.size > 0.5);
        items.sort((a, b) => Math.abs(a.y - b.y) > Math.min(a.size, b.size) * 0.3 ? a.y - b.y : a.x - b.x);
        const lines = []; for (const it of items) { const L = lines[lines.length - 1]; if (L && Math.abs(L.y - it.y) < it.size * 0.3 && Math.abs(L.size - it.size) < it.size * 0.2 && it.x - (L.x + L.w) < it.size * 1.2 && it.x - (L.x + L.w) > -it.size) { const gap = it.x - (L.x + L.w); L.s += (gap > it.size * 0.2 && !/\s$/.test(L.s) && !/^\s/.test(it.s) ? ' ' : '') + it.s; L.w = it.x + it.w - L.x; } else if (it.s.trim()) lines.push(Object.assign({}, it)); }
        const fontName = f => { try { const o = pg.commonObjs.get(f); return o && (o.name || o.loadedName) || ''; } catch (e) { return ''; } };
        for (const L of lines) {
          const s = L.s.trim(); if (!s) continue; const F = mapFont(fontName(L.f), rep.fonts);
          /* 색: 글자가 있는 그림과 뺀 그림이 달라지는 픽셀의 색 */
          let color = '#000000'; try { const bx = Math.max(0, Math.floor(L.x * scale)), by = Math.max(0, Math.floor((L.y - L.size * 0.85) * scale)), bw = Math.max(1, Math.min(full.width - bx, Math.ceil(L.w * scale))), bh = Math.max(1, Math.min(full.height - by, Math.ceil(L.size * scale))); const A1 = fctx.getImageData(bx, by, bw, bh).data, B1 = bctx.getImageData(bx, by, bw, bh).data; const px = []; for (let i = 0; i < A1.length; i += 8) { const d = Math.abs(A1[i] - B1[i]) + Math.abs(A1[i + 1] - B1[i + 1]) + Math.abs(A1[i + 2] - B1[i + 2]); if (d > 90) px.push([d, A1[i], A1[i + 1], A1[i + 2]]); } if (px.length) { px.sort((a, b) => b[0] - a[0]); const top = px.slice(0, Math.max(1, Math.ceil(px.length * 0.25))); color = rgbHex(top.reduce((a, p) => a + p[1], 0) / top.length, top.reduce((a, p) => a + p[2], 0) / top.length, top.reduce((a, p) => a + p[3], 0) / top.length); } /* 글자 가장자리의 흐린 픽셀 말고 가장 진한 쪽 1/4로 색을 읽음 */ } catch (e) {}
          const sizePt = r1(L.size), lh = 1.15, top = L.y - L.size * ((lh - 1) / 2 + 0.88);
          els.push(Object.assign({}, A.TEXT_DEF, { id: A.uid(), text: s, x: r2(L.x * PT2MM), y: r2(top * PT2MM), w: r2(Math.max(2, L.w * PT2MM * 1.04)), h: r2(L.size * lh * PT2MM), font: F.font, weight: F.weight, italic: !!F.italic, size: sizePt, lh, color, align: 'left', ls: 0, sizing: 'autow', name: s.slice(0, 24) })); nText++;
        }
        pages.push({ bg: '#ffffff', els, label: '' });
      }
      rep.summary = mode === 'image' ? `${pages.length}쪽 — 쪽마다 그림 한 장 (보기 그대로, 글자는 고칠 수 없음)` : `${pages.length}쪽 · 고칠 수 있는 글 상자 ${nText}개 (배경은 글자를 뺀 그림 — 잠금, 사진·도형은 배경에 포함)`;
      if (mode !== 'image') rep.notes.push('글자는 원래 자리에 다시 얹었습니다 — 글꼴이 공방 글꼴로 바뀌어 길이가 조금 다를 수 있습니다. 배경 그림은 잠가 두었습니다(레이어에서 잠금 풀기).');
      return { name: file.name.replace(/\.[^.]+$/, ''), w: W, h: H, pages };
    }

    /* =================== 가져오기 창 =================== */
    function guide(k) {
      return { indd: ['인디자인 INDD', '인디자인 원본(.indd)은 형식이 공개되지 않아 직접 열 수 없습니다.', '인디자인에서 <b>파일 → 내보내기 → 형식: InDesign Markup (IDML)</b>로 저장한 .idml 파일을 가져오세요. 사진은 패키지(파일 → 패키지)의 Links 폴더 사진을 함께 고르면 연결됩니다.'],
        qxp: ['쿽익스프레스 QXP', '쿽익스프레스 원본(.qxp)은 형식이 공개되지 않아 직접 열 수 없습니다.', '쿽에서 <b>파일 → 내보내기 → 레이아웃을 PDF로</b> 저장한 PDF를 가져오면 쪽마다 배경 그림 + 고칠 수 있는 글자로 들어옵니다. (인디자인이 있으면 인디자인으로 열어 IDML로 내보내도 됩니다)'],
        eps: ['EPS', 'EPS(포스트스크립트)는 브라우저에서 읽을 수 없습니다.', '일러스트레이터에서 열어 <b>PDF 또는 SVG</b>로 저장해 가져오세요 (SVG는 사진·업로드로 넣으면 선명한 벡터 그림).'] }[k];
    }
    function openDialog(preFiles) {
      let dl = $('#dlgImport'); if (!dl) { dl = document.createElement('dialog'); dl.id = 'dlgImport'; dl.className = 'wide'; document.body.appendChild(dl); }
      const st = { files: preFiles || [], pdfMode: 'edit' };
      const draw = () => {
        const main = st.files.find(isImportable), k = main ? KINDS[ext(main)] : null, imgs = st.files.filter(f => f !== main && isImg(f)), g = k ? guide(k) : null;
        dl.innerHTML = `<div class="dhead"><h2>📥 다른 프로그램 파일 가져오기 <small>포토샵 · 인디자인 · 일러스트 · 쿽(PDF) — 공방에서 고칠 수 있게</small></h2><button class="btn sm" data-close>닫기</button></div>
        <div class="dbody imp">
          <div class="imp-drop" id="impDrop"><b>여기에 파일을 끌어 놓거나</b><button class="btn primary" id="impPick">파일 고르기</button><small>.psd · .idml · .ai · .pdf (인디자인 사진을 연결하려면 Links 폴더 사진도 같이)</small></div>
          <div class="imp-cards">${[['🖼', '포토샵 PSD', '레이어마다 따로 — 움직이기·숨기기·투명도·혼합 모드, 글자 레이어는 고칠 수 있는 글 상자, 레이어 그룹은 묶음'], ['📘', '인디자인 IDML', '쪽·글 상자(글꼴·크기·색·정렬·행간·단)·도형(색·선·둥근 모서리)·사진 틀·마스터(머리글·쪽 번호). 긴 이어진 글은 도서 편집 원고로. (.indd는 IDML로 내보내기)'], ['✒️', '일러스트 AI · PDF', '쪽마다 글자를 뺀 배경 그림 + 원래 자리의 고칠 수 있는 글 상자(글꼴·크기·색). 또는 보기 그대로 그림 한 장. (쿽은 PDF로 내보내기)']].map(([i, t, d]) => `<div class="imp-card"><span>${i}</span><b>${t}</b><small>${d}</small></div>`).join('')}</div>
          ${main ? `<div class="imp-sel"><b>고른 파일:</b> ${esc(main.name)} (${Math.max(1, Math.round(main.size / 1024)).toLocaleString()}KB)${imgs.length ? ` + 사진 ${imgs.length}개` : ''}
            ${g ? `<div class="imp-warn"><b>${g[0]}</b> — ${g[1]}<br>${g[2]}</div>` : ''}
            ${k === 'pdf' ? `<div class="seg" style="max-width:520px;margin-top:8px"><button data-pm="edit" aria-pressed="${st.pdfMode === 'edit'}">글자를 고칠 수 있게 (배경 + 글 상자)</button><button data-pm="image" aria-pressed="${st.pdfMode === 'image'}">보기 그대로 그림 한 장</button></div>` : ''}
            ${g ? '' : `<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="impGo">📥 새 문서로 가져오기</button></div>`}</div>` : ''}
          <p class="hint">가져오면 <b>새 문서</b>로 열립니다(지금 문서는 그대로 — 저장하지 않았다면 '직전 문서'로 보관). 공방에 없는 글꼴은 비슷한 공방 글꼴로 바꾸고 무엇으로 바꿨는지 알려 드립니다. 파일은 이 PC 브라우저 안에서만 읽고 어디에도 올리지 않습니다.</p>
        </div>`;
        dl.querySelector('[data-close]').onclick = () => dl.close();
        $('#impPick').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = '.psd,.psb,.idml,.indd,.ai,.pdf,.qxp,.qxd,.eps,image/*'; i.onchange = () => { st.files = [...i.files]; draw(); }; i.click(); };
        const dz = $('#impDrop'); dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = e => { e.preventDefault(); e.stopPropagation(); st.files = [...e.dataTransfer.files]; draw(); };
        dl.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => { st.pdfMode = b.dataset.pm; draw(); });
        const go = $('#impGo'); if (go) go.onclick = () => run(main, imgs, st.pdfMode, dl);
      };
      draw(); if (!dl.open) dl.showModal();
    }
    async function run(main, imgs, pdfMode, dl) {
      const k = KINDS[ext(main)], rep = { fonts: new Set(), notes: [], threads: [], summary: '' };
      const kept = await A.newDocKeep(); if (kept === false) return; const prev = A.doc;
      try {
        dl.close(); A.setStatus('가져오는 중…');
        const d0 = A.newDoc(['custom', main.name, 210, 297]); d0.pages = []; A.setDoc(d0); /* 그림(asset)이 새 문서에 들어가도록 먼저 바꿈 */
        const R = k === 'psd' ? await importPSD(main, rep) : k === 'idml' ? await importIDML(main, imgs, rep) : await importPDF(main, pdfMode, rep);
        const d = A.doc; d.name = R.name; d.w = R.w; d.h = R.h; if (R.px) d.fmt = 'px'; d.bleed = R.px ? 0 : (k === 'idml' ? 3 : 0);
        d.pages = R.pages.map(p => Object.assign(A.newPage(p.bg), { els: p.els, label: p.label || '' }));
        if (R.start) d.book = Object.assign(A.clone(A.BOOK_DEF), { on: false, skip: 0, start: R.start });
        d.imported = { from: main.name, kind: k, at: Date.now() };
        A.afterNewDoc(); A.setStatus('');
        showReport(rep, k, R);
      } catch (e) { console.error(e); A.setStatus(''); A.restoreDoc(prev); A.toast('가져오지 못했습니다: ' + e.message + ' (보던 문서는 그대로)', true); }
    }
    function showReport(rep, k, R) {
      let dl = $('#dlgImpRep'); if (!dl) { dl = document.createElement('dialog'); dl.id = 'dlgImpRep'; document.body.appendChild(dl); }
      const fonts = [...rep.fonts];
      dl.innerHTML = `<div class="dhead"><h2>✅ 가져왔습니다 <small>${esc(R.name)}</small></h2><button class="btn sm" data-close>닫기</button></div><div class="dbody">
        <p style="margin-top:0"><b>${esc(rep.summary)}</b></p>
        ${fonts.length ? `<h3>바꾼 글꼴 (공방에 없는 글꼴 → 비슷한 글꼴)</h3><ul class="imp-list">${fonts.slice(0, 20).map(f => `<li>${esc(f)}</li>`).join('')}</ul><p class="hint">원래 글꼴이 꼭 필요하면 프로젝트 → 글꼴에서 글꼴 파일을 올린 뒤 그 글자를 골라 바꾸세요.</p>` : ''}
        ${rep.notes.length ? `<h3>알아 두세요</h3><ul class="imp-list">${rep.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
        <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px">${k === 'idml' && rep.threads.length ? '<button class="btn" id="impBook">📚 도서 편집 원고로 (긴 글 저절로 흘리기)</button>' : ''}<button class="btn primary" data-close>확인</button></div></div>`;
      dl.querySelectorAll('[data-close]').forEach(b => b.onclick = () => dl.close());
      const bb = $('#impBook'); if (bb) bb.onclick = async () => { dl.close(); const d = A.doc, md = threadsToMd(rep.threads); if (A.bookFrom) await A.bookFrom({ title: d.name, w: d.w, h: d.h, md }); };
      dl.showModal();
    }
    return { openDialog, isImportable, run };
  };
})();
