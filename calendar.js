// 달력 요소 렌더링, 공휴일 정보, 캘린더 마법사(페이지 생성)
window.NC = window.NC || {};
NC.cal = (function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const daysIn = (y, m) => new Date(y, m, 0).getDate();
  const WD = { en: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'], short: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'], ko1: ['일', '월', '화', '수', '목', '금', '토'] };
  const MONTHS_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

  /* ---------- 내장 공휴일 표 (2023~2030, 대체공휴일 규칙 적용) ---------- */
  const FIXED = [[1, 1, '신정', false], [3, 1, '삼일절', true], [5, 5, '어린이날', true], [6, 6, '현충일', false], [8, 15, '광복절', true], [10, 3, '개천절', true], [10, 9, '한글날', true], [12, 25, '크리스마스', true]];
  const LUNAR = { 2023: ['01-22', '05-27', '09-29'], 2024: ['02-10', '05-15', '09-17'], 2025: ['01-29', '05-05', '10-06'], 2026: ['02-17', '05-24', '09-25'], 2027: ['02-06', '05-13', '09-15'], 2028: ['01-26', '05-02', '10-03'], 2029: ['02-13', '05-20', '09-22'], 2030: ['02-03', '05-09', '09-12'] };
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  function builtinHolidays(year) {
    const md = s => { const [m, d] = s.split('-').map(Number); return new Date(year, m - 1, d); };
    const base = [];
    FIXED.forEach(([m, d, name, sub]) => base.push({ date: new Date(year, m - 1, d), name, sub, group: name }));
    const L = LUNAR[year];
    if (L) {
      const s = md(L[0]), b = md(L[1]), c = md(L[2]);
      base.push({ date: addDays(s, -1), name: '설날 연휴', sub: true, group: '설날' }, { date: s, name: '설날', sub: true, group: '설날' }, { date: addDays(s, 1), name: '설날 연휴', sub: true, group: '설날' });
      base.push({ date: b, name: '부처님 오신 날', sub: true, group: '부처님오신날' });
      base.push({ date: addDays(c, -1), name: '추석 연휴', sub: true, group: '추석' }, { date: c, name: '추석', sub: true, group: '추석' }, { date: addDays(c, 1), name: '추석 연휴', sub: true, group: '추석' });
    }
    const map = {}, byDate = {};
    const put = (k, n) => { (map[k] = map[k] || []).push(n); };
    base.forEach(h => { const k = dkey(h.date); put(k, h.name); (byDate[k] = byDate[k] || []).push(h); });
    const needs = [];
    Object.keys(byDate).sort().forEach(k => {
      const hs = byDate[k], el = hs.filter(h => h.sub); if (!el.length) return;
      const dow = hs[0].date.getDay(), groups = new Set(hs.map(h => h.group));
      const weekend = el.some(h => (h.group === '설날' || h.group === '추석') ? dow === 0 : (dow === 0 || dow === 6));
      if (weekend || groups.size > 1) needs.push(hs[0].date);
    });
    needs.forEach(d => { let x = addDays(d, 1); while (x.getDay() === 0 || x.getDay() === 6 || map[dkey(x)]) x = addDays(x, 1); put(dkey(x), '대체 휴일'); });
    const list = [];
    Object.keys(map).sort().forEach(k => map[k].forEach(n => list.push({ date: k, name: n })));
    return list;
  }
  async function fetchHolidays({ source, year, key }) {
    if (source === 'builtin') { if (!LUNAR[year]) throw new Error('내장 표는 2023~2030년만 있습니다. 다른 연도는 Nager.Date나 공공데이터포털에서 가져오세요.'); return builtinHolidays(year); }
    if (source === 'nager') {
      const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
      if (!r.ok) throw new Error('Nager.Date 응답 오류 ' + r.status);
      const j = await r.json();
      const seen = new Set(), out = [];
      j.forEach(h => { const k = h.date + '|' + (h.localName || h.name); if (!seen.has(k)) { seen.add(k); out.push({ date: h.date, name: h.localName || h.name }); } });
      return out;
    }
    if (source === 'datago') {
      if (!key) throw new Error('공공데이터포털 서비스 키를 넣어 주세요.');
      const tryKey = async k => {
        const r = await fetch(`https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${k}&solYear=${year}&numOfRows=100&pageNo=1&_type=json`);
        const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { throw new Error('응답을 읽지 못했습니다: ' + t.slice(0, 120)); }
        const body = j.response && j.response.body; if (!body) throw new Error((j.response && j.response.header && j.response.header.resultMsg) || '응답 형식 오류');
        let items = body.items && body.items.item; if (!items) return []; if (!Array.isArray(items)) items = [items];
        return items.filter(i => i.isHoliday === 'Y').map(i => { const s = String(i.locdate); return { date: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`, name: i.dateName }; });
      };
      try { return await tryKey(key); } catch (e) { if (/%/.test(key)) throw e; return tryKey(encodeURIComponent(key)); }
    }
    throw new Error('알 수 없는 출처');
  }
  function holidayMap(doc, year) {
    const map = {}; ((doc.holidays || {})[year] || []).forEach(h => { if (h.date && h.name) (map[h.date] = map[h.date] || []).push(h.name); }); return map;
  }

  /* ---------- 달력 요소 ---------- */
  const CAL_DEF = { weekStart: 0, rows: 'merge', wdLang: 'en', wdH: 5.5, wdSize: 8, daySize: 7.5, evSize: 7, fontNum: 'Montserrat', fontBody: 'Noto Sans KR', outer: '#444444', outerW: 0.35, line: '#BBBBBB', lineW: 0.2, sunBg: '#F1F1F1', satBg: '', sunColor: '#E0564B', satColor: '#222222', dayColor: '#222222', evColor: '#1a1a1a', holColor: '#E0564B', noteColor: '#1F5BD6', wdColor: '#222222', showHol: true, showWd: true, showHolName: true, cellPad: 1.2 };
  const MINI_DEF = { fontNum: 'Montserrat', titleSize: 9, wdSize: 4.4, numSize: 5, sunColor: '#E0564B', color: '#222222', showTitle: true, weekStart: 0 };
  const COLORS = { red: '#E0564B', blue: '#1F5BD6', green: '#2F7D32', gray: '#888888' };
  function calHTML(el, doc) {
    const s = Object.assign({}, CAL_DEF, el.s || {});
    const y = el.year, m = el.month, dim = daysIn(y, m), first = (new Date(y, m - 1, 1).getDay() - s.weekStart + 7) % 7;
    const hol = (s.showHol && doc.showHolidays !== false) ? holidayMap(doc, y) : {};
    const rows = s.rows === '6' ? 6 : s.rows === 'auto' ? Math.ceil((first + dim) / 7) : 5;
    const total = rows * 7;
    const notes = (el.notes || []).filter(Boolean);
    const blanks = []; for (let i = 0; i < total; i++) { const n = i - first + 1; if (n < 1 || n > dim) blanks.push(i); }
    const noteCell = notes.length ? (blanks.length ? (blanks[0] < first ? blanks[0] : blanks[blanks.length - 1]) : total - 1) : -1;
    let cells = '';
    for (let c = 0; c < total; c++) {
      const n = c - first + 1, dow = (c + s.weekStart) % 7;
      let inner = '';
      if (n >= 1 && n <= dim) {
        const days = [n]; if (s.rows === 'merge' && c >= total - 7 && n + 7 <= dim) days.push(n + 7);
        const isHol = days.some(d => (hol[`${y}-${pad(m)}-${pad(d)}`] || []).length);
        const col = (dow === 0 || isHol) ? s.sunColor : dow === 6 ? s.satColor : s.dayColor;
        inner += `<div class="d" style="font-family:'${s.fontNum}';font-size:${s.daySize}pt;color:${col}">${days.join(' / ')}</div>`;
        days.forEach(d => {
          if (s.showHolName) (hol[`${y}-${pad(m)}-${pad(d)}`] || []).forEach(hn => { inner += `<div class="ev" style="font-size:${s.evSize}pt;color:${s.holColor}">${esc(hn)}</div>`; });
          (el.events || []).filter(e => e.d === d).forEach(e => { inner += `<div class="ev" style="font-size:${s.evSize}pt;color:${COLORS[e.color] || s.evColor}">${esc(e.text)}</div>`; });
        });
      }
      if (c === noteCell) inner += notes.map(t => `<div class="note" style="font-size:${s.evSize}pt;color:${s.noteColor}">${esc(t)}</div>`).join('');
      const bg = dow === 0 && s.sunBg ? `background:${s.sunBg};` : dow === 6 && s.satBg ? `background:${s.satBg};` : '';
      const border = `border-right:${s.lineW}mm solid ${s.line};border-bottom:${(c >= total - 7) ? s.outerW : s.lineW}mm solid ${(c >= total - 7) ? s.outer : s.line};`;
      cells += `<div class="cell" data-day="${n >= 1 && n <= dim ? n : ''}" style="${bg}${border}padding:${s.cellPad}mm ${s.cellPad + 0.2}mm">${inner}</div>`;
    }
    const wd = s.showWd ? `<div class="wd" style="height:${s.wdH}mm;font-family:'${s.fontNum}';font-size:${s.wdSize}pt;color:${s.wdColor}">${Array.from({ length: 7 }, (_, i) => { const d = (i + s.weekStart) % 7; return `<span style="${d === 0 ? `color:${s.sunColor}` : ''}">${(WD[s.wdLang] || WD.en)[d]}</span>`; }).join('')}</div>` : '';
    return `${wd}<div class="cg" style="grid-template-rows:repeat(${rows},1fr);border-top:${s.outerW}mm solid ${s.outer};border-left:${s.lineW}mm solid ${s.line};font-family:'${s.fontBody}'">${cells}</div>`;
  }
  function miniHTML(el) {
    const s = Object.assign({}, MINI_DEF, el.s || {});
    const y = el.year, m = el.month, dim = daysIn(y, m), first = (new Date(y, m - 1, 1).getDay() - s.weekStart + 7) % 7;
    let h = s.showTitle ? `<div class="mt" style="font-size:${s.titleSize}pt;color:${s.color}">${m}</div>` : '';
    h += `<div class="mg" style="font-family:'${s.fontNum}';font-size:${s.numSize}pt;color:${s.color}">` + Array.from({ length: 7 }, (_, i) => { const d = (i + s.weekStart) % 7; return `<span class="w" style="font-size:${s.wdSize}pt;${d === 0 ? `color:${s.sunColor}` : ''}">${WD.short[d]}</span>`; }).join('');
    for (let i = 0; i < 42; i++) { const n = i - first + 1; h += (n < 1 || n > dim) ? '<span></span>' : `<span style="${(i + s.weekStart) % 7 === 0 ? `color:${s.sunColor}` : ''}">${n}</span>`; }
    return h + '</div>';
  }
  function applyRules(el, rules) {
    const y = el.year, m = el.month, dim = daysIn(y, m);
    el.events = el.events || [];
    let added = 0;
    (rules || []).forEach(r => {
      if (!r.text) return;
      let d = null;
      if (r.week === 'last') { for (let k = dim; k >= 1; k--) if (new Date(y, m - 1, k).getDay() === Number(r.dow)) { d = k; break; } }
      else { let c = 0; for (let k = 1; k <= dim; k++) if (new Date(y, m - 1, k).getDay() === Number(r.dow)) { c++; if (c === Number(r.week)) { d = k; break; } } }
      if (d && !el.events.some(e => e.d === d && e.text === r.text)) { el.events.push({ d, text: r.text, color: r.color || '' }); added++; }
    });
    return added;
  }

  /* ---------- 캘린더 마법사: 2026년 디자인을 요소로 재현 ---------- */
  function buildPages(doc, uid, opts) {
    const C = doc.calendar, T = C.theme, year = opts.year;
    const A = T.colorA, B = T.colorB;
    const T_ = (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: T.fontBody, size: 12, weight: 400, italic: false, color: '#1a1a1a', align: 'left', lh: 1.3, ls: 0, strokeW: 0, strokeC: '#ffffff', shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, name: '' }, st);
    const I_ = (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }, st);
    const S_ = (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: '#F0716B', stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st);
    const pg = (bg, els, label) => ({ id: uid(), bg, els, label });
    function cover() {
      const c = C.cover;
      return pg(c.bg === 'B' ? B : A, [
        I_(C.dojang.logo, 10, 12, 76, 18, { name: '로고' }),
        T_(String(year), 130, 7, 84, 26, { font: T.fontNum, size: 60, weight: 800, color: T.yearColor, align: 'right', lh: 1, ls: -0.02, name: '연도', role: 'year' }),
        I_(c.image, 30, 44, 164, 74, { name: '표지 그림' }),
        T_(c.title, 12, 123, 200, 8, { size: 15, weight: 500, align: 'center', name: '제목 윗줄' }),
        T_(c.subtitle, 12, 131, 200, 9, { size: 17, weight: 700, align: 'center', name: '제목 아랫줄' }),
        T_(c.note, 12, 143, 200, 7, { size: 8, align: 'center', name: '설명' }),
      ], '표지');
    }
    function virtue(m) {
      const mo = C.months[m - 1], bg = mo.bg === 'B' ? B : A, chars = [...mo.virtue].length;
      const enX = Math.min(150, 18 + chars * 15.5 + 3);
      const nd = String(m).length;
      return pg(bg, [
        I_(C.dojang.swoosh, 201, 11, 15, 13, { name: '로고' }),
        T_(mo.virtue, 18, 22, 125, 20, { font: T.fontTitle, size: 46, weight: 400, color: T.titleColor, lh: 1, strokeW: 3, strokeC: '#ffffff', shadow: true, name: '덕목', role: 'virtue', month: m }),
        T_(`(${mo.en})`, enX, 33.5, 70, 6, { font: T.fontNum, size: 9, weight: 500, ls: 0.14, color: '#333333', name: '영문', role: 'en', month: m }),
        T_(mo.quote, 18, 57, 100, 45, { size: 17, weight: 700, lh: 1.55, ls: -0.01, name: '명언', role: 'quote', month: m }),
        I_(mo.image, 118, 16, 100, 117, { pos: '50% 100%', name: '삽화', role: 'illust', month: m }),
        T_(String(m), 14, 104, 36, 24, { font: T.fontNum, size: 62, weight: 800, lh: 0.9, ls: -0.04, color: '#111111', name: '월 숫자' }),
        T_(`${year}\n${MONTHS_EN[m - 1]}`, nd === 1 ? 31 : 44, 118, 40, 9, { font: T.fontNum, size: 8, weight: 500, ls: 0.14, lh: 1.3, color: '#222222', name: '연월', role: 'ym', month: m }),
        S_('rect', 0, 133, 224, 21, { fill: '#ffffff', opacity: 0.72, name: '하단 띠' }),
        I_(C.dojang.target, 52, 137, 13, 13, { name: '실천 아이콘' }),
        T_(`1. ${mo.practice[0]}\n2. ${mo.practice[1]}`, 70, 135.5, 150, 17, { font: T.fontHand, size: 13, lh: 1.5, color: '#222222', name: '실천 과제', role: 'practice', month: m }),
      ], `${m}월 인성`);
    }
    function calendar(m) {
      const mo = C.months[m - 1];
      const ny = m === 12 ? year + 1 : year, nm = m === 12 ? 1 : m + 1;
      const els = [
        S_('rect', 15, 11, 152, 27, { fill: '#F4F3F0', name: '머리 배경' }),
        S_('rect', 167, 11, 1.2, 27, { fill: '#E0564B', name: '빨간 줄' }),
        S_('tab', 15, 11, 26, 33, { fill: T.tabColor, name: '탭' }),
      ];
      if (mo.mascot) els.push(I_(mo.mascot, 17.5, 12.5, 21, 21, { name: '마스코트', role: 'mascot', month: m }));
      els.push(
        T_(String(m), 58, 11.5, 30, 18, { font: T.fontNum, size: 45, weight: 800, lh: 1, ls: -0.03, color: '#111111', name: '월 숫자' }),
        T_(`${year}  ${MONTHS_EN[m - 1]}`, 59, 31, 60, 5, { font: T.fontNum, size: 8, weight: 600, ls: 0.16, color: '#222222', name: '연월', role: 'ym', month: m }),
        T_(`${mo.idiom}(${mo.hanja})`, 99, 16, 66, 8, { size: 13, weight: 500, color: T.idiomColor, ls: -0.01, name: '사자성어', role: 'idiom', month: m }),
        T_(mo.meaning, 99, 23.5, 66, 12, { size: 9, lh: 1.4, name: '사자성어 뜻', role: 'meaning', month: m }),
        { id: uid(), type: 'mini', year: ny, month: nm, x: 172, y: 12, w: 42, h: 24, rot: 0, opacity: 1, s: {}, name: '다음 달' },
        { id: uid(), type: 'cal', year, month: m, x: 10, y: 43.5, w: 204, h: 102.5, rot: 0, opacity: 1, s: { fontNum: T.fontNum, fontBody: T.fontBody }, events: (mo.events || []).map(e => Object.assign({}, e)), notes: (mo.notes || []).slice(), name: `${m}월 달력`, role: 'cal', month: m },
        I_(C.dojang.footer, 97, 146.5, 30, 4.4, { name: '하단 로고' }),
      );
      return pg('#ffffff', els, `${m}월 달력`);
    }
    function back() {
      const b = C.back;
      return pg(b.bg === 'B' ? B : A, [
        I_(b.image, 82, 16, 60, 52, { name: '로고' }),
        T_(b.headline, 12, 74, 200, 9, { size: 16, weight: 500, align: 'center', name: '한글 구호' }),
        T_(b.headlineEn, 12, 86, 200, 28, { font: T.fontNum, size: 26, weight: 800, lh: 1.3, align: 'center', color: '#111111', name: '영문 구호' }),
        T_(b.quoteEn, 12, 122, 200, 10, { size: 8.5, lh: 1.55, align: 'center', color: '#333333', name: '영문 문장' }),
        T_(b.quoteKo, 12, 132, 200, 10, { size: 8, lh: 1.55, align: 'center', color: '#777777', name: '한글 문장' }),
      ], '뒷표지');
    }
    const out = [];
    const kind = opts.kind || 'full';
    if (kind === 'full') { out.push(cover()); for (let m = 1; m <= 12; m++) { out.push(virtue(m)); out.push(calendar(m)); } out.push(back()); }
    else if (kind === 'months') { for (let m = 1; m <= 12; m++) out.push(calendar(m)); }
    else if (kind === 'virtues') { for (let m = 1; m <= 12; m++) out.push(virtue(m)); }
    else if (kind === 'cover') out.push(cover());
    else if (kind === 'back') out.push(back());
    else if (kind === 'virtue') out.push(virtue(opts.month || 1));
    else if (kind === 'cal') out.push(calendar(opts.month || 1));
    return out;
  }
  return { builtinHolidays, fetchHolidays, holidayMap, calHTML, miniHTML, applyRules, buildPages, CAL_DEF, MINI_DEF, MONTHS_EN, daysIn, WD };
})();
