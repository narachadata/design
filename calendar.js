// 달력 요소 렌더링, 공휴일 정보, 캘린더 마법사(페이지 생성)
window.NC = window.NC || {};
NC.cal = (function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const daysIn = (y, m) => new Date(y, m, 0).getDate();
  const WD = { en: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'], short: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'], ko1: ['일', '월', '화', '수', '목', '금', '토'] };
  const MONTHS_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

  /* ---------- 공휴일 자동 계산 (2023~2036) ----------
     근거: 공휴일에 관한 법률·관공서의 공휴일에 관한 규정(2021.7 대체공휴일 도입, 2023.5 부처님오신날·크리스마스 추가,
     2027년부터 노동절(5/1)·제헌절(7/17) 공휴일). 음력 명절 양력 날짜는 한국천문연구원 자료(위키백과 표)로 확인.
     대체공휴일: 설·추석 연휴는 일요일 또는 다른 공휴일과 겹칠 때, 그 밖의 대상 공휴일은 토·일요일 또는 다른 공휴일과 겹칠 때
     그 다음 첫 번째 평일(비공휴일). 신정·현충일은 대상이 아님. 임시공휴일·대통령 선거일은 포함하지 않음(직접 추가). */
  const FIXED = [[1, 1, '신정', false], [3, 1, '삼일절', true], [5, 1, '노동절', true, 2027], [5, 5, '어린이날', true], [6, 6, '현충일', false], [7, 17, '제헌절', true, 2027], [8, 15, '광복절', true], [10, 3, '개천절', true], [10, 9, '한글날', true], [12, 25, '크리스마스', true]];
  // [설날, 부처님오신날, 추석] 양력
  const LUNAR = { 2023: ['01-22', '05-27', '09-29'], 2024: ['02-10', '05-15', '09-17'], 2025: ['01-29', '05-05', '10-06'], 2026: ['02-17', '05-24', '09-25'], 2027: ['02-06', '05-13', '09-15'], 2028: ['01-26', '05-02', '10-03'], 2029: ['02-13', '05-20', '09-22'], 2030: ['02-03', '05-09', '09-12'], 2031: ['01-23', '05-28', '10-01'], 2032: ['02-11', '05-16', '09-19'], 2033: ['01-31', '05-06', '09-08'], 2034: ['02-19', '05-25', '09-27'], 2035: ['02-08', '05-15', '09-16'], 2036: ['01-28', '05-03', '10-04'] };
  const AUTO_RANGE = [2023, 2036];
  const canAuto = y => !!LUNAR[y];
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  function nthWeekday(y, m, dow, n) { let c = 0; for (let d = 1; d <= daysIn(y, m); d++) if (new Date(y, m - 1, d).getDay() === dow) { c++; if (c === n) return new Date(y, m - 1, d); } return null; }
  function electionDays(y) {
    const out = [];
    if (y >= 2024 && (y - 2024) % 4 === 0) out.push({ date: nthWeekday(y, 4, 3, 2), name: '국회의원 선거' });   // 4월 둘째 수요일
    if (y >= 2022 && (y - 2022) % 4 === 0) out.push({ date: nthWeekday(y, 6, 3, 1), name: '지방선거' });         // 6월 첫째 수요일
    return out;
  }
  function autoHolidays(year) {
    const md = s => { const [m, d] = s.split('-').map(Number); return new Date(year, m - 1, d); };
    const base = [];
    FIXED.forEach(([m, d, name, sub, from]) => { if (from && year < from) return; base.push({ date: new Date(year, m - 1, d), name, sub, group: name }); });
    const L = LUNAR[year];
    if (L) {
      const s = md(L[0]), b = md(L[1]), c = md(L[2]);
      base.push({ date: addDays(s, -1), name: '설날 연휴', sub: true, group: '설날' }, { date: s, name: '설날', sub: true, group: '설날' }, { date: addDays(s, 1), name: '설날 연휴', sub: true, group: '설날' });
      base.push({ date: b, name: '부처님 오신 날', sub: true, group: '부처님오신날' });
      base.push({ date: addDays(c, -1), name: '추석 연휴', sub: true, group: '추석' }, { date: c, name: '추석', sub: true, group: '추석' }, { date: addDays(c, 1), name: '추석 연휴', sub: true, group: '추석' });
    }
    electionDays(year).forEach(e => { if (e.date) base.push({ date: e.date, name: e.name, sub: false, group: e.name }); });
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
  const builtinHolidays = autoHolidays;
  async function fetchHolidays({ source, year, key }) {
    if (source === 'builtin') { if (!canAuto(year)) throw new Error(`자동 계산은 ${AUTO_RANGE[0]}~${AUTO_RANGE[1]}년만 됩니다. 다른 연도는 공공데이터포털이나 Nager.Date에서 가져오세요.`); return autoHolidays(year); }
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
  const CAL_DEF = { weekStart: 0, rows: 'merge', wdLang: 'en', wdH: 5.5, wdSize: 8, daySize: 11, evSize: 7, fontNum: 'Montserrat', fontBody: 'Noto Sans KR', outer: '#444444', outerW: 0.35, line: '#8A8A8A', lineW: 0.25, sunBg: '#F1F1F1', satBg: '', sunColor: '#E0564B', satColor: '#000000', dayColor: '#000000', evColor: '#000000', holColor: '', noteColor: '#1F5BD6', wdColor: '#000000', showHol: true, showWd: true, showHolName: true, cellPad: 1.2 };
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
    // 칸 편집(일러스트레이터 표처럼): 열 너비·행 높이 비율, 칸 합치기, 칸별 색·글자
    const colW = (el.colW && el.colW.length === 7) ? el.colW : [1, 1, 1, 1, 1, 1, 1];
    const rowH = (el.rowH && el.rowH.length === rows) ? el.rowH : Array(rows).fill(1);
    const merges = (el.merges || []).filter(g => g.c < total);
    const cover = {}; merges.forEach(g => { const r0 = Math.floor(g.c / 7), c0 = g.c % 7; for (let r = r0; r < Math.min(rows, r0 + g.rs); r++) for (let q = c0; q < Math.min(7, c0 + g.cs); q++) if (r * 7 + q !== g.c) cover[r * 7 + q] = g.c; });
    const cst = el.cells || {};
    const ckey = c => { const n = c - first + 1; return n >= 1 && n <= dim ? 'd' + n : String(c); };
    const content = c => {
      const n = c - first + 1, dow = (c + s.weekStart) % 7, cs = cst[ckey(c)] || cst[c] || {};  // cst[c]: 이전 방식(칸 번호)으로 저장된 서식
      let inner = '';
      if (n >= 1 && n <= dim) {
        const days = [n]; if (s.rows === 'merge' && c >= total - 7 && n + 7 <= dim) days.push(n + 7);
        const isHol = days.some(d => (hol[`${y}-${pad(m)}-${pad(d)}`] || []).length);
        const col = cs.numColor || ((dow === 0 || isHol) ? s.sunColor : dow === 6 ? s.satColor : s.dayColor);
        inner += `<div class="d" style="font-family:'${s.fontNum}';font-size:${s.daySize}pt;color:${col}">${days.join(' / ')}</div>`;
        days.forEach(d => {
          if (s.showHolName) (hol[`${y}-${pad(m)}-${pad(d)}`] || []).forEach(hn => { inner += `<div class="ev" style="font-size:${cs.size || s.evSize}pt;color:${s.holColor || s.sunColor}">${esc(hn)}</div>`; });
          (el.events || []).filter(e => e.d === d).forEach(e => { inner += `<div class="ev" style="font-size:${cs.size || s.evSize}pt;color:${COLORS[e.color] || e.color || cs.color || s.evColor};${cs.bold ? 'font-weight:700;' : ''}">${esc(e.text)}</div>`; });
        });
      }
      if (c === noteCell) inner += notes.map(t => `<div class="note" style="font-size:${cs.size || s.evSize}pt;color:${s.noteColor}">${esc(t)}</div>`).join('');
      if (cs.text) inner += `<div class="ct" style="font-size:${cs.size || s.evSize}pt;color:${cs.color || s.evColor};${cs.bold ? 'font-weight:700;' : ''}">${esc(cs.text).replace(/\n/g, '<br>')}</div>`;
      return inner;
    };
    let cells = '';
    // 칸 선은 SVG 벡터로 (CSS 테두리는 화면 픽셀로 반올림돼 인쇄 두께가 달라짐)
    const sw = colW.reduce((a, b) => a + b, 0), shh = rowH.reduce((a, b) => a + b, 0);
    const XS = [0]; colW.forEach(w => XS.push(XS[XS.length - 1] + w / sw * 1000)); const YS = [0]; rowH.forEach(h => YS.push(YS[YS.length - 1] + h / shh * 1000));
    const ln = (x1, y1, x2, y2, col, w) => `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${col}" stroke-width="${w}mm" vector-effect="non-scaling-stroke" stroke-linecap="square"/>`;
    let lines = '';
    for (let c = 0; c < total; c++) {
      if (cover[c] != null) continue;
      const n = c - first + 1, dow = (c + s.weekStart) % 7, r = Math.floor(c / 7), q = c % 7, cs = cst[ckey(c)] || cst[c] || {};
      const g = merges.find(x => x.c === c) || { cs: 1, rs: 1 };
      let inner = content(c);
      if (g.cs > 1 || g.rs > 1) for (let rr = r; rr < Math.min(rows, r + g.rs); rr++) for (let qq = q; qq < Math.min(7, q + g.cs); qq++) { const k = rr * 7 + qq; if (k !== c) inner += content(k); }
      const bgc = cs.bg != null ? cs.bg : dow === 0 && s.sunBg ? s.sunBg : dow === 6 && s.satBg ? s.satBg : '';
      const last = r + g.rs >= rows, qe = Math.min(7, q + g.cs), re = Math.min(rows, r + g.rs);
      if (s.lineW > 0 && qe < 7) lines += ln(XS[qe], YS[r], XS[qe], YS[re], s.line, s.lineW);
      if (qe === 7 && s.lineW > 0) lines += ln(XS[7], YS[r], XS[7], YS[re], s.line, s.lineW);
      if (!last && s.lineW > 0) lines += ln(XS[q], YS[re], XS[qe], YS[re], s.line, s.lineW);
      const border = '';
      const al = cs.align ? `text-align:${cs.align};` : '';
      cells += `<div class="cell" data-c="${c}" data-day="${n >= 1 && n <= dim ? n : ''}" style="grid-row:${r + 1}/span ${g.rs};grid-column:${q + 1}/span ${g.cs};${bgc ? `background:${bgc};` : ''}${border}${al}padding:${s.cellPad}mm ${s.cellPad + 0.2}mm">${inner}</div>`;
    }
    const wd = s.showWd ? `<div class="wd" style="grid-template-columns:${colW.map(w => w + 'fr').join(' ')};height:${s.wdH}mm;font-family:'${s.fontNum}';font-size:${s.wdSize}pt;color:${s.wdColor}">${Array.from({ length: 7 }, (_, i) => { const d = (i + s.weekStart) % 7; return `<span style="${d === 0 ? `color:${s.sunColor}` : ''}">${(WD[s.wdLang] || WD.en)[d]}</span>`; }).join('')}</div>` : '';
    // 바깥선(위·아래)과 왼쪽 선
    if (s.outerW > 0) { lines += ln(0, 0, 1000, 0, s.outer, s.outerW); lines += ln(0, 1000, 1000, 1000, s.outer, s.outerW); }
    if (s.lineW > 0) lines += ln(0, 0, 0, 1000, s.line, s.lineW);
    return `${wd}<div class="cg" style="position:relative;grid-template-columns:${colW.map(w => w + 'fr').join(' ')};grid-template-rows:${rowH.map(w => w + 'fr').join(' ')};font-family:'${s.fontBody}'">${cells}<svg class="cglines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${lines}</svg></div>`;
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

  /* ---------- 달력 테마 (레이아웃 × 색 × 글꼴) ---------- */
  const THEMES = [
    { id: 'classic', name: '클래식 옐로', desc: '2026년 원형. 노랑·하늘 번갈아', layout: 'classic', colorA: '#FFE89A', colorB: '#E6EDF2', titleColor: '#6A3416', idiomColor: '#4C8A2B', tabColor: '#F0716B', accent: '#1E2B5A', yearColor: '#1E2B5A', text: '#1a1a1a', fontTitle: 'Jua', fontHand: 'Nanum Pen Script', fontBody: 'Noto Sans KR', fontNum: 'Montserrat', line: '#737373', outer: '#444444', sunBg: '#F1F1F1', sunColor: '#E0564B' },
    { id: 'navy-band', name: '네이비 밴드', desc: '상단 짙은 띠에 흰 제목', layout: 'band', colorA: '#FFF4CC', colorB: '#EAF1FB', band: '#1E2B5A', titleColor: '#FFFFFF', idiomColor: '#FFD34D', tabColor: '#FFD34D', accent: '#FFD34D', yearColor: '#1E2B5A', text: '#1a1a1a', fontTitle: 'Black Han Sans', fontHand: 'Gaegu', fontBody: 'Noto Sans KR', fontNum: 'Montserrat', line: '#7C7F85', outer: '#1E2B5A', sunBg: '#F3F5FA', sunColor: '#D84343' },
    { id: 'mint', name: '파스텔 민트', desc: '민트·살구, 둥근 손글씨', layout: 'classic', titleWeight: 700, titleScale: 1.3, colorA: '#DDF3EA', colorB: '#FFE9D6', titleColor: '#1F6B4A', idiomColor: '#C2564B', tabColor: '#7FC8A9', accent: '#1F6B4A', yearColor: '#1F6B4A', text: '#223', fontTitle: 'Dongle', fontHand: 'Gaegu', fontBody: 'Gowun Dodum', fontNum: 'Montserrat', line: '#808C87', outer: '#4F9C7C', sunBg: '#EEF8F3', sunColor: '#D9534F' },
    { id: 'minimal', name: '모던 화이트', desc: '흰 바탕, 가는 선, 큰 타이포', layout: 'minimal', colorA: '#FFFFFF', colorB: '#F6F6F3', titleColor: '#111111', idiomColor: '#E0564B', tabColor: '#111111', accent: '#E0564B', yearColor: '#111111', text: '#1a1a1a', fontTitle: 'Pretendard', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#8C8C8C', outer: '#111111', sunBg: '', sunColor: '#E0564B' },
    { id: 'photo', name: '포토 스플릿', desc: '왼쪽 큰 그림, 오른쪽 글', layout: 'photo', colorA: '#FFFFFF', colorB: '#FFFFFF', panel: '#1E2B5A', titleColor: '#FFFFFF', idiomColor: '#1E2B5A', tabColor: '#1E2B5A', accent: '#FFD34D', yearColor: '#1E2B5A', text: '#1a1a1a', fontTitle: 'Do Hyeon', fontHand: 'Nanum Pen Script', fontBody: 'Noto Sans KR', fontNum: 'Montserrat', line: '#84858A', outer: '#1E2B5A', sunBg: '#F4F5F8', sunColor: '#D84343' },
    { id: 'red', name: '레드 다이내믹', desc: '빨간 띠, 힘찬 제목', layout: 'band', colorA: '#FFF1EE', colorB: '#FFF8E8', band: '#E0564B', titleColor: '#FFFFFF', idiomColor: '#FFE89A', tabColor: '#FFE89A', accent: '#FFE89A', yearColor: '#B8432B', text: '#1a1a1a', fontTitle: 'Do Hyeon', fontHand: 'Nanum Pen Script', fontBody: 'Noto Sans KR', fontNum: 'Montserrat', line: '#8F807D', outer: '#B8432B', sunBg: '#FFF3F1', sunColor: '#C8392B' },
    { id: 'forest', name: '숲 그린', desc: '초록·크림, 명조 제목', layout: 'classic', titleWeight: 700, titleScale: 0.95, colorA: '#E6F0DF', colorB: '#F7F3E8', titleColor: '#2F5D3A', idiomColor: '#8A5A2B', tabColor: '#5B9A6B', accent: '#2F5D3A', yearColor: '#2F5D3A', text: '#1f2a22', fontTitle: 'Gowun Batang', fontHand: 'Gaegu', fontBody: 'Gowun Dodum', fontNum: 'Montserrat', line: '#7D857A', outer: '#2F5D3A', sunBg: '#EEF4EA', sunColor: '#C8392B' },
    { id: 'dark', name: '블랙 골드', desc: '검정 인성면, 금색 제목', layout: 'minimal', colorA: '#1B1B1B', colorB: '#262626', titleColor: '#E6C068', idiomColor: '#B8432B', tabColor: '#E6C068', accent: '#E6C068', yearColor: '#1B1B1B', text: '#F2F2F2', calBg: '#FFFFFF', calText: '#1a1a1a', fontTitle: 'Black Han Sans', fontHand: 'Gaegu', fontBody: 'Noto Sans KR', fontNum: 'Montserrat', line: '#898989', outer: '#1B1B1B', sunBg: '', sunColor: '#C8392B' },
    /* 2026~2027 디자인 흐름을 바탕으로 더한 테마 (색면 분할·라운드 카드 레이아웃 포함) */
    { id: 'swiss-red', name: '스위스 그리드', desc: '빨강 색면·검정 큰 숫자, 국제 타이포 양식', layout: 'split', titleWeight: 800, colorA: '#F2F0EB', colorB: '#E9E6DF', band: '#D9261C', titleColor: '#FFFFFF', idiomColor: '#FFFFFF', tabColor: '#141414', accent: '#141414', yearColor: '#D9261C', text: '#141414', fontTitle: 'Pretendard', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#868480', outer: '#141414', sunBg: '', sunColor: '#D9261C' },
    { id: 'cobalt-block', name: '코발트 컬러블록', desc: '코발트 블루 색면에 핑크 숫자, 대담한 색 나눔', layout: 'split', titleWeight: 700, colorA: '#FFE8F0', colorB: '#E6EBFF', band: '#1E3FD8', titleColor: '#FFFFFF', idiomColor: '#FFB8D4', tabColor: '#FFB8D4', accent: '#FFB8D4', yearColor: '#1E3FD8', text: '#141B3D', fontTitle: 'Aggravo', fontHand: 'MangoBoardTtobaks', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#828693', outer: '#1E3FD8', sunBg: '#F4F6FF', sunColor: '#E0435E' },
    { id: 'dancheong', name: '모던 단청', desc: '쪽빛 색면·황색 숫자·한지 바탕, 세련된 전통색', layout: 'split', titleWeight: 700, colorA: '#F6EFE2', colorB: '#E7EEE8', band: '#22476B', titleColor: '#FFFFFF', idiomColor: '#F5B59D', tabColor: '#E8B33A', accent: '#E8B33A', yearColor: '#22476B', text: '#1E2328', fontTitle: 'Hahmlet', fontHand: 'MaruBuri', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#868278', outer: '#22476B', sunBg: '#FBF4EF', sunColor: '#B7322C' },
    { id: 'riso-duotone', name: '리소 듀오톤', desc: '형광 분홍·파랑 두 색 인쇄 감성, 종이 카드', layout: 'card', colorA: '#FFDCEA', colorB: '#D7E9F7', panel: '#FBF7EE', titleColor: '#0067A8', idiomColor: '#0067A8', tabColor: '#E8338F', accent: '#D92C84', yearColor: '#0067A8', text: '#1E2240', fontTitle: 'YeogiOttaeJalnan', fontHand: 'MangoBoardTtobaks', fontBody: 'Paperozi', fontNum: 'Oswald', line: '#8C857C', outer: '#1E2240', sunBg: '#FFF2F7', sunColor: '#D92C84' },
    { id: 'sage-cream', name: '세이지 크림', desc: '차분한 세이지 그린·크림, 둥근 카드', layout: 'card', titleWeight: 800, colorA: '#E1E9D9', colorB: '#F3ECDF', panel: '#FFFDF8', titleColor: '#3D5A43', idiomColor: '#3D5A43', tabColor: '#5A7A5F', accent: '#5A7A5F', yearColor: '#3D5A43', text: '#2A3229', fontTitle: 'NanumSquareNeo', fontHand: 'MangoBoardTtobaks', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#84897F', outer: '#3D5A43', sunBg: '#F2F6EF', sunColor: '#C0533D' },
    { id: 'mono-blue', name: '모노 블루', desc: '파랑 한 가지 색의 농담, 깔끔한 카드', layout: 'card', titleWeight: 800, colorA: '#E2EAFA', colorB: '#EEF3FB', panel: '#FFFFFF', titleColor: '#1C3C88', idiomColor: '#1C3C88', tabColor: '#2C58CF', accent: '#2C58CF', yearColor: '#1C3C88', text: '#14213D', fontTitle: 'Escoredream', fontHand: 'Escoredream', fontBody: 'Escoredream', fontNum: 'Montserrat', line: '#848992', outer: '#1C3C88', sunBg: '#F5F8FD', sunColor: '#D9434F' },
    { id: 'cloud-dancer', name: '클라우드 댄서', desc: '팬톤 2026 오프화이트·먹색 명조, 잡지 같은 여백', layout: 'minimal', titleWeight: 700, colorA: '#F0EEE9', colorB: '#E8E4DC', titleColor: '#2B2B2B', idiomColor: '#A9502C', tabColor: '#2B2B2B', accent: '#A9502C', yearColor: '#2B2B2B', text: '#2B2B2B', fontTitle: 'MaruBuri', fontHand: 'MaruBuri', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#8C8984', outer: '#2B2B2B', sunBg: '', sunColor: '#A9502C' },
    { id: 'kraft-paper', name: '크라프트 페이퍼', desc: '갈색 종이색·먹색 글자·빨간 도장 포인트', layout: 'minimal', titleWeight: 700, colorA: '#E3CDA9', colorB: '#ECDDC4', titleColor: '#2B2118', idiomColor: '#A83A2C', tabColor: '#2B2118', accent: '#A83A2C', yearColor: '#2B2118', text: '#2B2118', calBg: '#FAF5EC', calText: '#2B2118', fontTitle: 'NexonLv2Gothic', fontHand: 'MangoBoardTtobaks', fontBody: 'Pretendard', fontNum: 'Oswald', line: '#898173', outer: '#2B2118', sunBg: '', sunColor: '#A83A2C' },
    { id: 'deep-green-gold', name: '딥그린 골드', desc: '짙은 초록 인성면, 금색 명조 제목', layout: 'minimal', titleWeight: 700, colorA: '#14342B', colorB: '#1A3D33', titleColor: '#D6B26E', idiomColor: '#14342B', tabColor: '#D6B26E', accent: '#D6B26E', yearColor: '#14342B', text: '#F3EFE4', calBg: '#FFFDF7', calText: '#1C2420', fontTitle: 'Noto Serif KR', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#88857E', outer: '#14342B', sunBg: '', sunColor: '#B5432F' },
    { id: 'teal-amber', name: '틸 & 앰버', desc: '2026 올해의 색 청록 띠에 앰버 포인트', layout: 'band', titleWeight: 700, colorA: '#E3F0EE', colorB: '#F6F1E6', band: '#0F5257', titleColor: '#FFFFFF', idiomColor: '#F2C46D', tabColor: '#F2C46D', accent: '#F2C46D', yearColor: '#0F5257', text: '#18302F', fontTitle: 'GMarketSans', fontHand: 'MangoBoardTtobaks', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#7B8785', outer: '#0F5257', sunBg: '#EEF5F4', sunColor: '#C94C38' },
    { id: 'retro-70s', name: '레트로 70', desc: '번트 오렌지 띠·머스터드, 70년대 감성', layout: 'band', titleWeight: 700, colorA: '#F7E7C6', colorB: '#F2DECA', band: '#9E4318', titleColor: '#FFF3DC', idiomColor: '#F6C453', tabColor: '#F6C453', accent: '#F6C453', yearColor: '#9E4318', text: '#3A2414', fontTitle: 'Binggre', fontHand: 'MangoBoardTtobaks', fontBody: 'Paperozi', fontNum: 'Oswald', line: '#8C7D66', outer: '#9E4318', sunBg: '#FBF1E3', sunColor: '#C0392B' },
    { id: 'taekwon-dynamic', name: '태권 다이내믹', desc: '경기복 네이비·레드, 스포츠 숫자', layout: 'photo', titleWeight: 700, colorA: '#E7ECF5', colorB: '#FBE8E8', panel: '#0E1A3C', titleColor: '#FFFFFF', idiomColor: '#C8102E', tabColor: '#C8102E', accent: '#FF5252', yearColor: '#0E1A3C', text: '#111827', fontTitle: 'Isamanru', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Oswald', line: '#82858C', outer: '#0E1A3C', sunBg: '#F5F6FA', sunColor: '#C8102E' },
    { id: 'lavender-haze', name: '라벤더 헤이즈', desc: '연보라·버터 옐로, 보랏빛 패널', layout: 'photo', colorA: '#E9E3F7', colorB: '#FFF2D4', panel: '#4A3A7A', titleColor: '#FFFFFF', idiomColor: '#4A3A7A', tabColor: '#4A3A7A', accent: '#FFD88A', yearColor: '#4A3A7A', text: '#2A2440', fontTitle: 'HannaPro', fontHand: 'JoyfulStory', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#888492', outer: '#4A3A7A', sunBg: '#F6F3FC', sunColor: '#D3466A' },
    { id: 'mocha-latte', name: '모카 라테', desc: '팬톤 2025 모카 무스 브라운·라테 톤, 카페 감성', layout: 'photo', colorA: '#EADBCD', colorB: '#F4ECE2', panel: '#6A4C3B', titleColor: '#FFFFFF', idiomColor: '#6A4C3B', tabColor: '#6A4C3B', accent: '#F1D3B8', yearColor: '#6A4C3B', text: '#2E211A', fontTitle: 'Ridibatang', fontHand: 'MaruBuri', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#8A827A', outer: '#6A4C3B', sunBg: '#FAF5EF', sunColor: '#B9473A' },
    { id: 'terracotta', name: '테라코타 어스', desc: '흙빛 주황·모래·세이지, 따뜻한 자연색', layout: 'classic', titleWeight: 800, colorA: '#F3E2D0', colorB: '#E4E8DA', titleColor: '#A4472B', idiomColor: '#8A4426', tabColor: '#C8734F', accent: '#5A3A28', yearColor: '#A4472B', text: '#2E2420', fontTitle: 'Paperozi', fontHand: 'MangoBoardTtobaks', fontBody: 'Paperozi', fontNum: 'Montserrat', line: '#887D72', outer: '#7A4A2A', sunBg: '#F8EFE6', sunColor: '#C0392B' },
    { id: 'kids-pop', name: '키즈 팝', desc: '복숭아·하늘색, 통통한 굵은 제목', layout: 'classic', titleWeight: 900, titleScale: 0.9, colorA: '#FFDCC8', colorB: '#CDEBF5', titleColor: '#3B2E8C', idiomColor: '#2E5BBA', tabColor: '#FF8A4C', accent: '#3B2E8C', yearColor: '#3B2E8C', text: '#222222', fontTitle: 'CookieRun', fontHand: 'MangoBoardTtobaks', fontBody: 'NanumSquareNeo', fontNum: 'Montserrat', line: '#8C8480', outer: '#3A3A3A', sunBg: '#FFF4EE', sunColor: '#E5484D' },
  ];
  function themeOf(doc) { const t = doc.calendar.theme || {}; const base = THEMES.find(x => x.id === t.id) || THEMES[0]; return Object.assign({}, base, t); }

  /* ---------- 캘린더 마법사: 테마별 페이지 생성 ---------- */
  function buildPages(doc, uid, opts) {
    const C = doc.calendar, T = themeOf(doc), year = opts.year;
    const A = T.colorA, B = T.colorB, TX = T.text || '#1a1a1a', CTX = T.calText || TX, CBG = T.calBg || '#ffffff';
    const T_ = (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: T.fontBody, size: 12, weight: 400, italic: false, color: TX, align: 'left', lh: 1.3, ls: 0, strokeW: 0, strokeC: '#ffffff', shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, st);
    const I_ = (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }, st);
    const S_ = (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: T.tabColor, stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st);
    const pg = (bg, els, label, kind) => ({ id: uid(), bg, els, label, kind });
    const calEl = (m, extra) => Object.assign({ id: uid(), type: 'cal', year, month: m, rot: 0, opacity: 1, s: Object.assign({ fontNum: T.fontNum, fontBody: T.fontBody, line: T.line, outer: T.outer, sunBg: T.sunBg, sunColor: T.sunColor, dayColor: CTX, evColor: CTX, wdColor: CTX }, extra && extra.s), events: (C.months[m - 1].events || []).map(e => Object.assign({}, e)), notes: (C.months[m - 1].notes || []).slice(), name: `${m}월 달력`, role: 'cal', month: m }, extra, { s: Object.assign({ fontNum: T.fontNum, fontBody: T.fontBody, line: T.line, outer: T.outer, sunBg: T.sunBg, sunColor: T.sunColor, dayColor: CTX, evColor: CTX, wdColor: CTX }, extra && extra.s) });
    const mini = (m, x, y, w, h, st) => { const ny = m === 12 ? year + 1 : year, nm = m === 12 ? 1 : m + 1; return { id: uid(), type: 'mini', year: ny, month: nm, x, y, w, h, rot: 0, opacity: 1, s: Object.assign({ fontNum: T.fontNum, color: CTX, sunColor: T.sunColor }, st), name: '다음 달' }; };
    const img = (mo, x, y, w, h, st) => I_(mo.image, x, y, w, h, Object.assign({ pos: '50% 100%', name: '삽화', role: 'illust', month: mo.m }, mo.imgScale && mo.imgScale !== 1 ? {} : {}, st));
    const L = T.layout;

    function cover() {
      const c = C.cover, bg = c.bg === 'B' ? B : A;
      const dark = isDark(bg);
      return pg(bg, [
        I_(C.dojang.logo, 10, 12, 76, 18, { name: '로고', role: 'logo' }),
        T_(String(year), 130, 7, 84, 26, { font: T.fontNum, size: 60, weight: 800, color: dark ? T.titleColor : T.yearColor, align: 'right', lh: 1, ls: -0.02, name: '연도', role: 'year' }),
        I_(c.image, 30, 44, 164, 74, { name: '표지 그림', role: 'coverImage' }),
        T_(c.title, 12, 123, 200, 8, { size: 15, weight: 500, align: 'center', color: dark ? '#fff' : TX, name: '제목 윗줄', role: 'coverTitle' }),
        T_(c.subtitle, 12, 131, 200, 9, { size: 17, weight: 700, align: 'center', color: dark ? '#fff' : TX, name: '제목 아랫줄', role: 'coverSubtitle' }),
        T_(c.note, 12, 143, 200, 7, { size: 8, align: 'center', color: dark ? '#ddd' : TX, name: '설명', role: 'coverNote' }),
      ], '표지', 'cover');
    }
    function back() {
      const b = C.back, bg = b.bg === 'B' ? B : A, dark = isDark(bg);
      return pg(bg, [
        I_(b.image, 82, 16, 60, 52, { name: '로고', role: 'backImage' }),
        T_(b.headline, 12, 74, 200, 9, { size: 16, weight: 500, align: 'center', color: dark ? '#fff' : TX, name: '한글 구호', role: 'backHeadline' }),
        T_(b.headlineEn, 12, 86, 200, 28, { font: T.fontNum, size: 26, weight: 800, lh: 1.3, align: 'center', color: dark ? T.titleColor : '#111111', name: '영문 구호', role: 'backHeadlineEn' }),
        T_(b.quoteEn, 12, 122, 200, 10, { size: 8.5, lh: 1.55, align: 'center', color: dark ? '#ddd' : '#333333', name: '영문 문장', role: 'backQuoteEn' }),
        T_(b.quoteKo, 12, 132, 200, 10, { size: 8, lh: 1.55, align: 'center', color: dark ? '#bbb' : '#777777', name: '한글 문장', role: 'backQuoteKo' }),
      ], '뒷표지', 'back');
    }
    const ymText = m => `${year}\n${MONTHS_EN[m - 1]}`;
    const practiceText = mo => `1. ${mo.practice[0]}\n2. ${mo.practice[1]}`;

    function virtue(m) {
      const mo = C.months[m - 1], bg = mo.bg === 'B' ? B : A, chars = [...mo.virtue].length, nd = String(m).length;
      const common = { role: 'virtue', month: m, name: '덕목', weight: T.titleWeight || 400 };
      const ts = T.titleScale || 1;
      if (L === 'band') {
        return pg(bg, [
          S_('rect', 0, 0, 224, 40, { fill: T.band, name: '상단 띠' }),
          I_(C.dojang.swoosh, 200, 11, 15, 13, { name: '로고' }),
          T_(mo.virtue, 16, 7, 150, 20, Object.assign({ font: T.fontTitle, size: Math.round(40 * ts), color: T.titleColor, lh: 1 }, common)),
          T_(`(${mo.en})`, 16, 28, 150, 6, { font: T.fontNum, size: 8.5, weight: 600, ls: 0.14, color: T.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 16, 54, 104, 46, { size: 16.5, weight: 700, lh: 1.55, name: '명언', role: 'quote', month: m }),
          img(mo, 118, 44, 100, 90),
          T_(String(m), 14, 102, 36, 24, { font: T.fontNum, size: 58, weight: 800, lh: 0.9, ls: -0.04, color: T.band, name: '월 숫자' }),
          T_(ymText(m), nd === 1 ? 30 : 42, 115, 40, 9, { font: T.fontNum, size: 8, weight: 600, ls: 0.14, lh: 1.3, name: '연월', role: 'ym', month: m }),
          S_('rect', 0, 134, 224, 20, { fill: '#ffffff', opacity: 0.85, name: '하단 띠' }), S_('rect', 0, 134, 224, 0.6, { fill: T.band }),
          I_(C.dojang.target, 14, 137.5, 13, 13, { name: '실천 아이콘' }),
          T_(practiceText(mo), 32, 136.5, 186, 17, { font: T.fontHand, size: 13, lh: 1.5, name: '실천 과제', role: 'practice', month: m }),
        ], `${m}월 인성`, 'virtue');
      }
      if (L === 'minimal') {
        const dark = isDark(bg);
        return pg(bg, [
          S_('rect', 14, 12, 196, 0.5, { fill: T.titleColor, name: '윗줄' }),
          T_(`${MONTHS_EN[m - 1]}  ${year}`, 14, 15, 120, 6, { font: T.fontNum, size: 8, weight: 600, ls: 0.25, color: dark ? '#bbb' : '#666', name: '연월', role: 'ym', month: m }),
          T_(String(m).padStart(2, '0'), 160, 13, 50, 20, { font: T.fontNum, size: 40, weight: 800, align: 'right', lh: 1, ls: -0.03, color: T.titleColor, name: '월 숫자' }),
          T_(mo.virtue, 14, 34, 120, 24, Object.assign({ font: T.fontTitle, size: Math.round(44 * ts), color: T.titleColor, lh: 1.05, ls: -0.02 }, common, { weight: T.titleWeight || 800 })),
          T_(mo.en, 14, 58, 120, 6, { font: T.fontNum, size: 9, weight: 600, ls: 0.2, color: T.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 14, 70, 104, 44, { size: 15, weight: 500, lh: 1.6, name: '명언', role: 'quote', month: m }),
          img(mo, 120, 24, 92, 100),
          S_('rect', 14, 128, 196, 0.5, { fill: T.titleColor, name: '아랫줄' }),
          T_(practiceText(mo), 14, 132, 196, 18, { font: T.fontHand, size: 11.5, lh: 1.55, weight: 500, name: '실천 과제', role: 'practice', month: m }),
        ], `${m}월 인성`, 'virtue');
      }
      if (L === 'photo') {
        return pg('#ffffff', [
          S_('rect', 0, 0, 112, 154, { fill: bg, name: '그림 바탕' }),
          img(mo, 6, 10, 100, 134, { pos: '50% 50%' }),
          S_('rect', 112, 0, 112, 154, { fill: T.panel, name: '오른쪽 패널' }),
          I_(C.dojang.swoosh, 202, 10, 14, 12, { name: '로고' }),
          T_(String(m), 122, 10, 40, 20, { font: T.fontNum, size: 44, weight: 800, lh: 1, color: T.accent, name: '월 숫자' }),
          T_(ymText(m), nd === 1 ? 138 : 150, 14, 40, 9, { font: T.fontNum, size: 7.5, weight: 600, ls: 0.14, lh: 1.3, color: '#ffffff', name: '연월', role: 'ym', month: m }),
          T_(mo.virtue, 122, 40, 94, 20, Object.assign({ font: T.fontTitle, size: Math.round(34 * ts), color: T.titleColor, lh: 1.05 }, common)),
          T_(`(${mo.en})`, 122, 60, 94, 6, { font: T.fontNum, size: 8, weight: 600, ls: 0.12, color: T.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 122, 72, 94, 44, { size: 13.5, weight: 600, lh: 1.6, color: '#ffffff', name: '명언', role: 'quote', month: m }),
          S_('rect', 122, 118, 94, 0.5, { fill: T.accent }),
          T_(practiceText(mo), 122, 122, 94, 26, { font: T.fontHand, size: 10.5, lh: 1.5, color: '#ffffff', name: '실천 과제', role: 'practice', month: m }),
        ], `${m}월 인성`, 'virtue');
      }
      if (L === 'card') {
        /* 라운드 카드형: 바탕색 위에 둥근 카드, 알약 모양 연월 표시, 그림·실천 과제는 연한 상자 */
        return pg(bg, [
          S_('rect', 8, 8, 208, 138, { fill: T.panel || '#ffffff', radius: 6, name: '카드' }),
          S_('pill', 16, 15, 48, 8, { fill: T.accent, name: '연월 바탕' }),
          T_(`${MONTHS_EN[m - 1]}  ${year}`, 16, 15, 48, 8, { font: T.fontNum, size: 7, weight: 700, ls: 0.16, lh: 1, align: 'center', valign: 'middle', color: T.chipText || '#ffffff', name: '연월', role: 'ym', month: m }),
          I_(C.dojang.swoosh, 195, 13, 14, 12, { name: '로고' }),
          T_(mo.virtue, 16, 29, 98, 18, Object.assign({ font: T.fontTitle, size: Math.round(36 * ts), color: T.titleColor, lh: 1.05, ls: -0.02 }, common)),
          T_(mo.en, 16, 47.5, 98, 6, { font: T.fontNum, size: 8, weight: 700, ls: 0.18, color: T.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 16, 58, 98, 40, { size: 13.5, weight: 600, lh: 1.6, name: '명언', role: 'quote', month: m }),
          S_('rect', 118, 27, 92, 96, { fill: bg, radius: 4, name: '그림 바탕' }),
          img(mo, 120, 29, 88, 92),
          T_(String(m).padStart(2, '0'), 15, 100, 60, 22, { font: T.fontNum, size: 54, weight: 800, lh: 0.9, ls: -0.04, color: T.accent, name: '월 숫자' }),
          S_('rect', 14, 127, 196, 15, { fill: bg, radius: 3.5, name: '실천 바탕' }),
          I_(C.dojang.target, 18, 129.5, 10, 10, { name: '실천 아이콘' }),
          T_(practiceText(mo), 32, 128.5, 174, 13, { font: T.fontHand, size: 10.5, lh: 1.4, name: '실천 과제', role: 'practice', month: m }),
        ], `${m}월 인성`, 'virtue');
      }
      if (L === 'split') {
        /* 컬러 블록 스플릿: 왼쪽 세로 색면에 큰 월 숫자·덕목, 오른쪽 바탕에 명언·그림·실천 과제 */
        return pg(bg, [
          S_('rect', 0, 0, 84, 154, { fill: T.band, name: '왼쪽 색면' }),
          T_(String(m).padStart(2, '0'), 10, 9, 70, 30, { font: T.fontNum, size: 88, weight: 800, lh: 0.9, ls: -0.05, color: T.accent, name: '월 숫자' }),
          T_(`${MONTHS_EN[m - 1]}  ${year}`, 12, 43, 68, 6, { font: T.fontNum, size: 7.5, weight: 700, ls: 0.24, color: T.titleColor, name: '연월', role: 'ym', month: m }),
          S_('rect', 12, 52, 60, 0.5, { fill: T.titleColor, opacity: 0.6, name: '가는 줄' }),
          T_(mo.virtue, 12, 58, 68, 14, Object.assign({ font: T.fontTitle, size: Math.round(30 * ts), color: T.titleColor, lh: 1.05, ls: -0.02 }, common)),
          T_(mo.en, 12, 73, 68, 6, { font: T.fontNum, size: 8, weight: 700, ls: 0.16, color: T.accent, name: '영문', role: 'en', month: m }),
          T_(C.dojang.nameEn, 12, 141, 68, 5, { font: T.fontNum, size: 6, weight: 700, ls: 0.3, color: T.titleColor, opacity: 0.7, name: '도장 이름' }),
          I_(C.dojang.swoosh, 202, 9, 14, 12, { name: '로고' }),
          T_(mo.quote, 94, 14, 104, 32, { size: 14, weight: 700, lh: 1.55, ls: -0.01, name: '명언', role: 'quote', month: m }),
          img(mo, 112, 46, 104, 80),
          S_('rect', 94, 129, 122, 0.5, { fill: T.band, name: '실천 줄' }),
          I_(C.dojang.target, 94, 133, 10, 10, { name: '실천 아이콘' }),
          T_(practiceText(mo), 107, 132, 111, 20, { font: T.fontHand, size: 10, lh: 1.4, name: '실천 과제', role: 'practice', month: m }),
        ], `${m}월 인성`, 'virtue');
      }
      // classic
      const enX = Math.min(150, 18 + chars * 15.5 + 3);
      return pg(bg, [
        I_(C.dojang.swoosh, 201, 11, 15, 13, { name: '로고' }),
        T_(mo.virtue, 18, 22, 125, 20, Object.assign({ font: T.fontTitle, size: Math.round(46 * ts), color: T.titleColor, lh: 1, strokeW: 3, strokeC: '#ffffff', shadow: true }, common)),
        T_(`(${mo.en})`, enX, 33.5, 70, 6, { font: T.fontNum, size: 9, weight: 500, ls: 0.14, color: '#333333', name: '영문', role: 'en', month: m }),
        T_(mo.quote, 18, 57, 100, 45, { size: 17, weight: 700, lh: 1.55, ls: -0.01, name: '명언', role: 'quote', month: m }),
        img(mo, 118, 16, 100, 117),
        T_(String(m), 14, 104, 36, 24, { font: T.fontNum, size: 62, weight: 800, lh: 0.9, ls: -0.04, color: '#111111', name: '월 숫자' }),
        T_(ymText(m), nd === 1 ? 31 : 44, 118, 40, 9, { font: T.fontNum, size: 8, weight: 500, ls: 0.14, lh: 1.3, color: '#222222', name: '연월', role: 'ym', month: m }),
        S_('rect', 0, 133, 224, 21, { fill: '#ffffff', opacity: 0.72, name: '하단 띠' }),
        I_(C.dojang.target, 52, 137, 13, 13, { name: '실천 아이콘' }),
        T_(practiceText(mo), 70, 135.5, 150, 17, { font: T.fontHand, size: 13, lh: 1.5, color: '#222222', name: '실천 과제', role: 'practice', month: m }),
      ], `${m}월 인성`, 'virtue');
    }
    function calendar(m) {
      const mo = C.months[m - 1];
      const idiom = `${mo.idiom}(${mo.hanja})`;
      if (L === 'band') {
        return pg(CBG, [
          S_('rect', 0, 0, 224, 32, { fill: T.band, name: '상단 띠' }),
          T_(String(m), 12, 3, 34, 22, { font: T.fontNum, size: 50, weight: 800, lh: 1, ls: -0.03, color: '#ffffff', name: '월 숫자' }),
          T_(`${MONTHS_EN[m - 1]}\n${year}`, String(m).length === 1 ? 40 : 52, 8, 50, 14, { font: T.fontNum, size: 8.5, weight: 700, ls: 0.16, lh: 1.35, color: T.accent, name: '연월', role: 'ym', month: m }),
          T_(idiom, 96, 6, 70, 8, { size: 13, weight: 600, color: T.idiomColor, name: '사자성어', role: 'idiom', month: m }),
          T_(mo.meaning, 96, 15, 72, 14, { size: 8.5, lh: 1.4, color: '#ffffff', name: '사자성어 뜻', role: 'meaning', month: m }),
          S_('rect', 172, 4, 44, 25, { fill: '#ffffff', radius: 1.5, name: '미니 바탕' }),
          mini(m, 173, 5, 42, 23),
          mo.mascot ? I_(mo.mascot, 12, 34, 16, 16, { name: '마스코트', role: 'mascot', month: m }) : null,
          calEl(m, { x: 10, y: 50, w: 204, h: 96 }),
          I_(C.dojang.footer, 97, 147, 30, 4.4, { name: '하단 로고' }),
        ].filter(Boolean), `${m}월 달력`, 'cal');
      }
      if (L === 'minimal') {
        return pg(CBG, [
          T_(String(m).padStart(2, '0'), 10, 8, 40, 20, { font: T.fontNum, size: 44, weight: 800, lh: 1, ls: -0.03, color: CTX, name: '월 숫자' }),
          T_(`${MONTHS_EN[m - 1]}  ${year}`, 10, 30, 80, 6, { font: T.fontNum, size: 8, weight: 600, ls: 0.25, color: '#666', name: '연월', role: 'ym', month: m }),
          T_(idiom, 96, 11, 70, 8, { size: 12, weight: 600, color: T.idiomColor, name: '사자성어', role: 'idiom', month: m }),
          T_(mo.meaning, 96, 19, 72, 14, { size: 8.5, lh: 1.4, color: '#444', name: '사자성어 뜻', role: 'meaning', month: m }),
          mini(m, 172, 9, 42, 24),
          mo.mascot ? I_(mo.mascot, 54, 8, 24, 24, { name: '마스코트', role: 'mascot', month: m }) : null,
          S_('rect', 10, 40, 204, 0.5, { fill: T.outer }),
          calEl(m, { x: 10, y: 44, w: 204, h: 102, s: { lineW: 0.25, outerW: 0.5, wdLang: 'short', wdSize: 7 } }),
          T_(C.dojang.nameEn, 10, 148, 204, 5, { font: T.fontNum, size: 6.5, weight: 700, ls: 0.3, align: 'center', color: '#888', name: '하단 글자' }),
        ].filter(Boolean), `${m}월 달력`, 'cal');
      }
      if (L === 'photo') {
        return pg(CBG, [
          S_('rect', 0, 0, 30, 154, { fill: T.panel, name: '왼쪽 띠' }),
          T_(String(m), 2, 8, 26, 16, { font: T.fontNum, size: 34, weight: 800, lh: 1, align: 'center', color: T.accent, name: '월 숫자' }),
          T_(MONTHS_EN[m - 1], -32, 76, 90, 8, { font: T.fontNum, size: 11, weight: 700, ls: 0.3, align: 'center', color: '#ffffff', rot: -90, name: '월 이름', role: 'ym', month: m }),
          mo.mascot ? I_(mo.mascot, 5, 128, 20, 20, { name: '마스코트', role: 'mascot', month: m }) : null,
          T_(idiom, 38, 10, 80, 8, { size: 13, weight: 600, color: T.idiomColor, name: '사자성어', role: 'idiom', month: m }),
          T_(mo.meaning, 38, 19, 120, 12, { size: 8.5, lh: 1.4, color: '#444', name: '사자성어 뜻', role: 'meaning', month: m }),
          mini(m, 172, 8, 42, 24),
          calEl(m, { x: 38, y: 36, w: 176, h: 108 }),
          I_(C.dojang.footer, 97, 147, 30, 4.4, { name: '하단 로고' }),
        ].filter(Boolean), `${m}월 달력`, 'cal');
      }
      if (L === 'card') {
        const tint = mo.bg === 'B' ? B : A;
        return pg(CBG, [
          S_('rect', 10, 8, 204, 31, { fill: tint, radius: 5, name: '머리 카드' }),
          T_(String(m).padStart(2, '0'), 15, 10.5, 34, 18, { font: T.fontNum, size: 42, weight: 800, lh: 1, ls: -0.03, color: T.titleColor, name: '월 숫자' }),
          T_(`${MONTHS_EN[m - 1]}  ${year}`, 16, 30, 40, 5, { font: T.fontNum, size: 6.8, weight: 700, ls: 0.18, color: T.accent, name: '연월', role: 'ym', month: m }),
          mo.mascot ? I_(mo.mascot, 52, 11, 20, 20, { name: '마스코트', role: 'mascot', month: m }) : null,
          T_(idiom, 76, 13, 90, 8, { size: 12.5, weight: 700, color: T.idiomColor, name: '사자성어', role: 'idiom', month: m }),
          T_(mo.meaning, 76, 21.5, 90, 14, { size: 8.3, lh: 1.4, color: CTX, name: '사자성어 뜻', role: 'meaning', month: m }),
          S_('rect', 170, 10.5, 41, 26, { fill: '#ffffff', radius: 3, name: '미니 바탕' }),
          mini(m, 171.5, 12, 38, 23),
          calEl(m, { x: 10, y: 43, w: 204, h: 102, s: { lineW: 0.18 } }),
          I_(C.dojang.footer, 97, 147.5, 30, 4.4, { name: '하단 로고' }),
        ].filter(Boolean), `${m}월 달력`, 'cal');
      }
      if (L === 'split') {
        return pg(CBG, [
          S_('rect', 0, 0, 56, 154, { fill: T.band, name: '왼쪽 색면' }),
          T_(String(m).padStart(2, '0'), 8, 8, 44, 20, { font: T.fontNum, size: 54, weight: 800, lh: 0.9, ls: -0.04, color: T.accent, name: '월 숫자' }),
          T_(`${MONTHS_EN[m - 1]}\n${year}`, 8, 29, 44, 10, { font: T.fontNum, size: 7.5, weight: 700, ls: 0.22, lh: 1.35, color: T.titleColor, name: '연월', role: 'ym', month: m }),
          S_('rect', 8, 42, 40, 0.5, { fill: T.accent, name: '가는 줄' }),
          T_(idiom, 8, 46, 44, 10, { size: 11, weight: 700, lh: 1.3, color: T.idiomColor, name: '사자성어', role: 'idiom', month: m }),
          T_(mo.meaning, 8, 56, 42, 30, { size: 7.5, lh: 1.5, color: T.titleColor, opacity: 0.9, name: '사자성어 뜻', role: 'meaning', month: m }),
          mini(m, 8, 92, 40, 24, { color: T.titleColor, sunColor: T.accent }),
          mo.mascot ? I_(mo.mascot, 8, 126, 18, 18, { name: '마스코트', role: 'mascot', month: m }) : null,
          calEl(m, { x: 62, y: 10, w: 152, h: 134 }),
          I_(C.dojang.footer, 123, 147.5, 30, 4.4, { name: '하단 로고' }),
        ].filter(Boolean), `${m}월 달력`, 'cal');
      }
      // classic
      const els = [
        S_('rect', 15, 11, 152, 27, { fill: '#F4F3F0', name: '머리 배경' }),
        S_('rect', 167, 11, 1.2, 27, { fill: T.sunColor, name: '빨간 줄' }),
        S_('tab', 15, 11, 26, 33, { fill: T.tabColor, name: '탭' }),
      ];
      if (mo.mascot) els.push(I_(mo.mascot, 17.5, 12.5, 21, 21, { name: '마스코트', role: 'mascot', month: m }));
      els.push(
        T_(String(m), 58, 11.5, 30, 18, { font: T.fontNum, size: 45, weight: 800, lh: 1, ls: -0.03, color: '#111111', name: '월 숫자' }),
        T_(`${year}  ${MONTHS_EN[m - 1]}`, 59, 31, 60, 5, { font: T.fontNum, size: 8, weight: 600, ls: 0.16, color: '#222222', name: '연월', role: 'ym', month: m }),
        T_(idiom, 99, 16, 66, 8, { size: 13, weight: 500, color: T.idiomColor, ls: -0.01, name: '사자성어', role: 'idiom', month: m }),
        T_(mo.meaning, 99, 23.5, 66, 12, { size: 9, lh: 1.4, name: '사자성어 뜻', role: 'meaning', month: m }),
        mini(m, 172, 12, 42, 24),
        calEl(m, { x: 10, y: 43.5, w: 204, h: 102.5 }),
        I_(C.dojang.footer, 97, 146.5, 30, 4.4, { name: '하단 로고' }),
      );
      return pg(CBG, els, `${m}월 달력`, 'cal');
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
    out.forEach(p => p.els.forEach(e => { e.gen = 1; }));  // 자동으로 만든 요소 표시 (테마를 바꿀 때 사용자가 넣은 요소와 구분)
    return out;
  }
  function isDark(hex) { if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return false; const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 < 120; }

  /* ---------- 편집된 페이지 내용을 캘린더 데이터로 되돌려 모으기 (테마 바꿀 때 내용 유지) ---------- */
  function syncFromPages(doc) {
    const C = doc.calendar;
    doc.pages.forEach(p => p.els.forEach(el => {
      const m = el.month, mo = m ? C.months[m - 1] : null;
      if (el.type === 'text' && mo) {
        if (el.role === 'virtue') mo.virtue = el.text;
        else if (el.role === 'en') mo.en = el.text.replace(/^\(|\)$/g, '');
        else if (el.role === 'quote') mo.quote = el.text;
        else if (el.role === 'practice') { const ls = el.text.split('\n').map(x => x.replace(/^\s*\d+\.\s*/, '')).filter(Boolean); if (ls.length) mo.practice = [ls[0] || '', ls[1] || '']; }
        else if (el.role === 'idiom') { const mm = el.text.match(/^(.*?)\s*\((.*?)\)\s*$/); if (mm) { mo.idiom = mm[1].trim(); mo.hanja = mm[2].trim(); } else mo.idiom = el.text; }
        else if (el.role === 'meaning') mo.meaning = el.text;
      } else if (el.type === 'image' && mo) {
        if (el.role === 'illust') mo.image = el.src;
        if (el.role === 'mascot') mo.mascot = el.src;
      } else if (el.type === 'cal' && mo && el.role === 'cal') { mo.events = (el.events || []).map(e => Object.assign({}, e)); mo.notes = (el.notes || []).slice(); }
      else if (el.type === 'text') {
        const map = { coverTitle: ['cover', 'title'], coverSubtitle: ['cover', 'subtitle'], coverNote: ['cover', 'note'], backHeadline: ['back', 'headline'], backHeadlineEn: ['back', 'headlineEn'], backQuoteEn: ['back', 'quoteEn'], backQuoteKo: ['back', 'quoteKo'] };
        if (map[el.role]) C[map[el.role][0]][map[el.role][1]] = el.text;
      } else if (el.type === 'image') { if (el.role === 'coverImage') C.cover.image = el.src; if (el.role === 'backImage') C.back.image = el.src; }
    }));
  }
  // 테마를 바꿔 캘린더 페이지를 다시 만들되, 캘린더가 아닌 페이지는 그대로 둡니다.
  function retheme(doc, uid, year) {
    syncFromPages(doc);
    const fresh = buildPages(doc, uid, { year, kind: 'full' });
    const byKind = { cover: fresh.filter(p => p.kind === 'cover'), back: fresh.filter(p => p.kind === 'back') };
    const vir = fresh.filter(p => p.kind === 'virtue'), cal = fresh.filter(p => p.kind === 'cal');
    let replaced = 0;
    doc.pages = doc.pages.map(p => {
      if (!p.kind) return p;
      let np = null;
      if (p.kind === 'cover') np = byKind.cover.shift(); else if (p.kind === 'back') np = byKind.back.shift();
      else { const m = (p.els.find(e => e.month) || {}).month; if (p.kind === 'virtue') np = vir.find(x => x.els.some(e => e.month === m)); if (p.kind === 'cal') np = cal.find(x => x.els.some(e => e.month === m)); }
      if (np) {
        replaced++;
        // 달력 칸 편집(합치기·너비·높이·칸 색·칸 글자)은 그대로 옮김
        const oc = p.els.find(e => e.type === 'cal'), nc = np.els.find(e => e.type === 'cal');
        if (oc && nc) ['cells', 'merges', 'colW', 'rowH'].forEach(k => { if (oc[k] != null) nc[k] = JSON.parse(JSON.stringify(oc[k])); });
        // 사용자가 직접 넣은 요소(스티커·사진·글 상자 등)는 새 디자인 위에 그대로 둠
        if (p.els.some(e => e.gen)) np.els.push(...p.els.filter(e => !e.gen));
        return np;
      }
      return p;
    });
    return replaced;
  }
  // 칸 번호 → 칸 서식 키 (날짜 칸은 날짜로 고정해 달·주 시작이 바뀌어도 그 날짜를 따라감)
  function cellKey(el, c) { const s = Object.assign({}, CAL_DEF, el.s || {}); const first = (new Date(el.year, el.month - 1, 1).getDay() - s.weekStart + 7) % 7; const n = c - first + 1; return n >= 1 && n <= daysIn(el.year, el.month) ? 'd' + n : String(c); }
  function calRows(el) { const s = Object.assign({}, CAL_DEF, el.s || {}); const first = (new Date(el.year, el.month - 1, 1).getDay() - s.weekStart + 7) % 7; return s.rows === '6' ? 6 : s.rows === 'auto' ? Math.ceil((first + daysIn(el.year, el.month)) / 7) : 5; }
  return { cellKey, calRows, builtinHolidays, autoHolidays, canAuto, AUTO_RANGE, fetchHolidays, holidayMap, calHTML, miniHTML, applyRules, buildPages, retheme, syncFromPages, themeOf, THEMES, CAL_DEF, MINI_DEF, MONTHS_EN, daysIn, WD };
})();
