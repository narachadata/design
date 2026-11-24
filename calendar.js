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
  /* 음력 공휴일(설날·부처님오신날·추석)의 양력 날짜 — 한국 시각 기준(2027·2028 설날은 중국 날짜보다 하루 늦음, 2026-11-18 바로잡음: 브라우저 한국 음력 달력과 42개 모두 대조) */
  const LUNAR = { 2023: ['01-22', '05-27', '09-29'], 2024: ['02-10', '05-15', '09-17'], 2025: ['01-29', '05-05', '10-06'], 2026: ['02-17', '05-24', '09-25'], 2027: ['02-07', '05-13', '09-15'], 2028: ['01-27', '05-02', '10-03'], 2029: ['02-13', '05-20', '09-22'], 2030: ['02-03', '05-09', '09-12'], 2031: ['01-23', '05-28', '10-01'], 2032: ['02-11', '05-16', '09-19'], 2033: ['01-31', '05-06', '09-08'], 2034: ['02-19', '05-25', '09-27'], 2035: ['02-08', '05-15', '09-16'], 2036: ['01-28', '05-03', '10-04'] };
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
  const CAL_DEF = { weekStart: 0, rows: 'merge', wdLang: 'en', wdH: 5.5, wdSize: 8, daySize: 11, evSize: 7, fontNum: 'Montserrat', fontBody: 'Noto Sans KR', outer: '#444444', outerW: 0.35, line: '#8A8A8A', lineW: 0.25, sunBg: '#F1F1F1', satBg: '', sunColor: '#E0564B', satColor: '#000000', dayColor: '#000000', evColor: '#000000', holColor: '', noteColor: '#1F5BD6', wdColor: '#000000', showHol: true, showWd: true, showHolName: true, cellPad: 1.2, lunar: '' };
  /* 음력: 브라우저의 한국 음력(단기) 달력으로 계산 — 지원하지 않는 브라우저면 표시하지 않음 */
  let srcOf = x => x; /* 그림 주소 풀이 (app.js가 setSrc로 넘겨 줌) — 칸 사진에 씀 */
  const LUNF = (() => { try { const f = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { month: 'numeric', day: 'numeric', timeZone: 'UTC' }); return f.resolvedOptions().calendar === 'dangi' ? f : null; } catch (e) { return null; } })();
  const lunarOf = (y, m, d) => { if (!LUNF) return null; try { const p = LUNF.formatToParts(new Date(Date.UTC(y, m - 1, d))); return { m: (p.find(x => x.type === 'month') || {}).value || '', d: Number((p.find(x => x.type === 'day') || {}).value) }; } catch (e) { return null; } };
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
        let lun = ''; if (s.lunar && days.length === 1) { const L = lunarOf(y, m, n); if (L && (s.lunar === 'all' || L.d === 1 || L.d === 15)) lun = `<small class="lun" style="font-size:${Math.max(4, Math.round(s.daySize * 0.5 * 10) / 10)}pt">${L.d === 1 || s.lunar === 'key' ? '음' : ''}${L.m}.${L.d}</small>`; }
        inner += `<div class="d" style="font-family:'${s.fontNum}';font-size:${s.daySize}pt;color:${col}">${days.join(' / ')}${lun}</div>`;
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
      const ph = cs.img ? srcOf(cs.img) : ''; /* 날짜 칸 사진 (Snapfish처럼): 칸을 꽉 채우고 날짜·일정은 흰 바탕 위에 */
      cells += `<div class="cell${ph ? ' phc' : ''}" data-c="${c}" data-day="${n >= 1 && n <= dim ? n : ''}" style="grid-row:${r + 1}/span ${g.rs};grid-column:${q + 1}/span ${g.cs};${bgc ? `background:${bgc};` : ''}${ph ? `background-image:url('${ph}');background-size:cover;background-position:${cs.imgPos || 'center'};` : ''}${border}${al}padding:${s.cellPad}mm ${s.cellPad + 0.2}mm">${inner}</div>`;
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
  function applyRules(el, rules, doc) {
    const y = el.year, m = el.month, dim = daysIn(y, m), hol = doc ? holidayMap(doc, y) : {}, p2 = n => String(n).padStart(2, '0');
    const off = (r, k) => r.noHol && (hol[`${y}-${p2(m)}-${p2(k)}`] || []).length;  /* '휴일 빼기' 규칙: 공휴일이면 건너뜀 */
    el.events = el.events || [];
    let added = 0;
    (rules || []).forEach(r => {
      if (!r.text) return;
      let d = null;
      if (r.week === 'every') { for (let k = 1; k <= dim; k++) if (new Date(y, m - 1, k).getDay() === Number(r.dow) && !off(r, k) && !el.events.some(e => e.d === k && e.text === r.text)) { el.events.push({ d: k, text: r.text, color: r.color || '' }); added++; } return; } /* 매주 ○요일 */
      if (r.kind === 'date') { const rm = Number(r.m) || 0, rd = r.last ? dim : Number(r.d); if ((rm === 0 || rm === m) && rd >= 1 && rd <= dim) d = rd; } /* 날짜 규칙: 매년 m월 d일 (m=0이면 매월 d일) — 생일·기념일·원비 날 */
      else if (r.week === 'last') { for (let k = dim; k >= 1; k--) if (new Date(y, m - 1, k).getDay() === Number(r.dow)) { d = k; break; } }
      else { let c = 0; for (let k = 1; k <= dim; k++) if (new Date(y, m - 1, k).getDay() === Number(r.dow)) { c++; if (c === Number(r.week)) { d = k; break; } } }
      if (d && !off(r, d) && !el.events.some(e => e.d === d && e.text === r.text)) { el.events.push({ d, text: r.text, color: r.color || '' }); added++; }
    });
    return added;
  }

  /* ---------- 달력 테마 (레이아웃 × 색 × 글꼴) ---------- */
  const THEMES = [
    { id: 'classic', cat: '인성', name: '클래식 옐로', desc: '2026년 원형. 노랑·하늘 번갈아', layout: 'classic', colorA: '#FFE89A', colorB: '#E6EDF2', titleColor: '#6A3416', idiomColor: '#4C8A2B', tabColor: '#F0716B', accent: '#1E2B5A', yearColor: '#1E2B5A', text: '#1a1a1a', fontTitle: 'Jua', fontHand: 'Nanum Pen Script', fontBody: 'Noto Sans KR', fontNum: 'Montserrat', line: '#737373', outer: '#444444', sunBg: '#F1F1F1', sunColor: '#E0564B' },
    { id: 'navy-band', cat: '인성', name: '네이비 밴드', desc: '상단 짙은 띠에 흰 제목', layout: 'band', colorA: '#FFF4CC', colorB: '#EAF1FB', band: '#1E2B5A', titleColor: '#FFFFFF', idiomColor: '#FFD34D', tabColor: '#FFD34D', accent: '#FFD34D', yearColor: '#1E2B5A', text: '#1a1a1a', fontTitle: 'Black Han Sans', fontHand: 'Gaegu', fontBody: 'Noto Sans KR', fontNum: 'Montserrat', line: '#7C7F85', outer: '#1E2B5A', sunBg: '#F3F5FA', sunColor: '#D84343' },
    { id: 'mint', cat: '인성', name: '파스텔 민트', desc: '민트·살구, 둥근 손글씨', layout: 'classic', titleWeight: 700, titleScale: 1.3, colorA: '#DDF3EA', colorB: '#FFE9D6', titleColor: '#1F6B4A', idiomColor: '#C2564B', tabColor: '#7FC8A9', accent: '#1F6B4A', yearColor: '#1F6B4A', text: '#223', fontTitle: 'Dongle', fontHand: 'Gaegu', fontBody: 'Gowun Dodum', fontNum: 'Montserrat', line: '#808C87', outer: '#4F9C7C', sunBg: '#EEF8F3', sunColor: '#D9534F' },
    { id: 'minimal', cat: '모던', name: '모던 화이트', desc: '흰 바탕, 가는 선, 큰 타이포', layout: 'minimal', colorA: '#FFFFFF', colorB: '#F6F6F3', titleColor: '#111111', idiomColor: '#E0564B', tabColor: '#111111', accent: '#E0564B', yearColor: '#111111', text: '#1a1a1a', fontTitle: 'Pretendard', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#8C8C8C', outer: '#111111', sunBg: '', sunColor: '#E0564B' },
    { id: 'photo', cat: '사진·그림', name: '포토 스플릿', desc: '왼쪽 큰 그림, 오른쪽 글', layout: 'photo', colorA: '#FFFFFF', colorB: '#FFFFFF', panel: '#1E2B5A', titleColor: '#FFFFFF', idiomColor: '#1E2B5A', tabColor: '#1E2B5A', accent: '#FFD34D', yearColor: '#1E2B5A', text: '#1a1a1a', fontTitle: 'Do Hyeon', fontHand: 'Nanum Pen Script', fontBody: 'Noto Sans KR', fontNum: 'Montserrat', line: '#84858A', outer: '#1E2B5A', sunBg: '#F4F5F8', sunColor: '#D84343' },
    { id: 'red', cat: '인성', name: '레드 다이내믹', desc: '빨간 띠, 힘찬 제목', layout: 'band', colorA: '#FFF1EE', colorB: '#FFF8E8', band: '#E0564B', titleColor: '#FFFFFF', idiomColor: '#FFE89A', tabColor: '#FFE89A', accent: '#FFE89A', yearColor: '#B8432B', text: '#1a1a1a', fontTitle: 'Do Hyeon', fontHand: 'Nanum Pen Script', fontBody: 'Noto Sans KR', fontNum: 'Montserrat', line: '#8F807D', outer: '#B8432B', sunBg: '#FFF3F1', sunColor: '#C8392B' },
    { id: 'forest', cat: '인성', name: '숲 그린', desc: '초록·크림, 명조 제목', layout: 'classic', titleWeight: 700, titleScale: 0.95, colorA: '#E6F0DF', colorB: '#F7F3E8', titleColor: '#2F5D3A', idiomColor: '#8A5A2B', tabColor: '#5B9A6B', accent: '#2F5D3A', yearColor: '#2F5D3A', text: '#1f2a22', fontTitle: 'Gowun Batang', fontHand: 'Gaegu', fontBody: 'Gowun Dodum', fontNum: 'Montserrat', line: '#7D857A', outer: '#2F5D3A', sunBg: '#EEF4EA', sunColor: '#C8392B' },
    { id: 'dark', cat: '모던', name: '블랙 골드', desc: '검정 인성면, 금색 제목', layout: 'minimal', colorA: '#1B1B1B', colorB: '#262626', titleColor: '#E6C068', idiomColor: '#B8432B', tabColor: '#E6C068', accent: '#E6C068', yearColor: '#1B1B1B', text: '#F2F2F2', calBg: '#FFFFFF', calText: '#1a1a1a', fontTitle: 'Black Han Sans', fontHand: 'Gaegu', fontBody: 'Noto Sans KR', fontNum: 'Montserrat', line: '#898989', outer: '#1B1B1B', sunBg: '', sunColor: '#C8392B' },
    /* 2026~2027 디자인 흐름을 바탕으로 더한 테마 (색면 분할·라운드 카드 레이아웃 포함) */
    { id: 'swiss-red', cat: '모던', name: '스위스 그리드', desc: '빨강 색면·검정 큰 숫자, 국제 타이포 양식', layout: 'split', titleWeight: 800, colorA: '#F2F0EB', colorB: '#E9E6DF', band: '#D9261C', titleColor: '#FFFFFF', idiomColor: '#FFFFFF', tabColor: '#141414', accent: '#141414', yearColor: '#D9261C', text: '#141414', fontTitle: 'Pretendard', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#868480', outer: '#141414', sunBg: '', sunColor: '#D9261C' },
    { id: 'cobalt-block', cat: '모던', name: '코발트 컬러블록', desc: '코발트 블루 색면에 핑크 숫자, 대담한 색 나눔', layout: 'split', titleWeight: 700, colorA: '#FFE8F0', colorB: '#E6EBFF', band: '#1E3FD8', titleColor: '#FFFFFF', idiomColor: '#FFB8D4', tabColor: '#FFB8D4', accent: '#FFB8D4', yearColor: '#1E3FD8', text: '#141B3D', fontTitle: 'Aggravo', fontHand: 'MangoBoardTtobaks', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#828693', outer: '#1E3FD8', sunBg: '#F4F6FF', sunColor: '#E0435E' },
    { id: 'dancheong', cat: '모던', name: '모던 단청', desc: '쪽빛 색면·황색 숫자·한지 바탕, 세련된 전통색', layout: 'split', titleWeight: 700, colorA: '#F6EFE2', colorB: '#E7EEE8', band: '#22476B', titleColor: '#FFFFFF', idiomColor: '#F5B59D', tabColor: '#E8B33A', accent: '#E8B33A', yearColor: '#22476B', text: '#1E2328', fontTitle: 'Hahmlet', fontHand: 'MaruBuri', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#868278', outer: '#22476B', sunBg: '#FBF4EF', sunColor: '#B7322C' },
    { id: 'riso-duotone', cat: '귀여운', name: '리소 듀오톤', desc: '형광 분홍·파랑 두 색 인쇄 감성, 종이 카드', layout: 'card', colorA: '#FFDCEA', colorB: '#D7E9F7', panel: '#FBF7EE', titleColor: '#0067A8', idiomColor: '#0067A8', tabColor: '#E8338F', accent: '#D92C84', yearColor: '#0067A8', text: '#1E2240', fontTitle: 'YeogiOttaeJalnan', fontHand: 'MangoBoardTtobaks', fontBody: 'Paperozi', fontNum: 'Oswald', line: '#8C857C', outer: '#1E2240', sunBg: '#FFF2F7', sunColor: '#D92C84' },
    { id: 'sage-cream', cat: '귀여운', name: '세이지 크림', desc: '차분한 세이지 그린·크림, 둥근 카드', layout: 'card', titleWeight: 800, colorA: '#E1E9D9', colorB: '#F3ECDF', panel: '#FFFDF8', titleColor: '#3D5A43', idiomColor: '#3D5A43', tabColor: '#5A7A5F', accent: '#5A7A5F', yearColor: '#3D5A43', text: '#2A3229', fontTitle: 'NanumSquareNeo', fontHand: 'MangoBoardTtobaks', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#84897F', outer: '#3D5A43', sunBg: '#F2F6EF', sunColor: '#C0533D' },
    { id: 'mono-blue', cat: '모던', name: '모노 블루', desc: '파랑 한 가지 색의 농담, 깔끔한 카드', layout: 'card', titleWeight: 800, colorA: '#E2EAFA', colorB: '#EEF3FB', panel: '#FFFFFF', titleColor: '#1C3C88', idiomColor: '#1C3C88', tabColor: '#2C58CF', accent: '#2C58CF', yearColor: '#1C3C88', text: '#14213D', fontTitle: 'Escoredream', fontHand: 'Escoredream', fontBody: 'Escoredream', fontNum: 'Montserrat', line: '#848992', outer: '#1C3C88', sunBg: '#F5F8FD', sunColor: '#D9434F' },
    { id: 'cloud-dancer', cat: '모던', name: '클라우드 댄서', desc: '팬톤 2026 오프화이트·먹색 명조, 잡지 같은 여백', layout: 'minimal', titleWeight: 700, colorA: '#F0EEE9', colorB: '#E8E4DC', titleColor: '#2B2B2B', idiomColor: '#A9502C', tabColor: '#2B2B2B', accent: '#A9502C', yearColor: '#2B2B2B', text: '#2B2B2B', fontTitle: 'MaruBuri', fontHand: 'MaruBuri', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#8C8984', outer: '#2B2B2B', sunBg: '', sunColor: '#A9502C' },
    { id: 'kraft-paper', cat: '모던', name: '크라프트 페이퍼', desc: '갈색 종이색·먹색 글자·빨간 도장 포인트', layout: 'minimal', titleWeight: 700, colorA: '#E3CDA9', colorB: '#ECDDC4', titleColor: '#2B2118', idiomColor: '#A83A2C', tabColor: '#2B2118', accent: '#A83A2C', yearColor: '#2B2118', text: '#2B2118', calBg: '#FAF5EC', calText: '#2B2118', fontTitle: 'NexonLv2Gothic', fontHand: 'MangoBoardTtobaks', fontBody: 'Pretendard', fontNum: 'Oswald', line: '#898173', outer: '#2B2118', sunBg: '', sunColor: '#A83A2C' },
    { id: 'deep-green-gold', cat: '모던', name: '딥그린 골드', desc: '짙은 초록 인성면, 금색 명조 제목', layout: 'minimal', titleWeight: 700, colorA: '#14342B', colorB: '#1A3D33', titleColor: '#D6B26E', idiomColor: '#14342B', tabColor: '#D6B26E', accent: '#D6B26E', yearColor: '#14342B', text: '#F3EFE4', calBg: '#FFFDF7', calText: '#1C2420', fontTitle: 'Noto Serif KR', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#88857E', outer: '#14342B', sunBg: '', sunColor: '#B5432F' },
    { id: 'teal-amber', cat: '인성', name: '틸 & 앰버', desc: '2026 올해의 색 청록 띠에 앰버 포인트', layout: 'band', titleWeight: 700, colorA: '#E3F0EE', colorB: '#F6F1E6', band: '#0F5257', titleColor: '#FFFFFF', idiomColor: '#F2C46D', tabColor: '#F2C46D', accent: '#F2C46D', yearColor: '#0F5257', text: '#18302F', fontTitle: 'GMarketSans', fontHand: 'MangoBoardTtobaks', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#7B8785', outer: '#0F5257', sunBg: '#EEF5F4', sunColor: '#C94C38' },
    { id: 'retro-70s', cat: '인성', name: '레트로 70', desc: '번트 오렌지 띠·머스터드, 70년대 감성', layout: 'band', titleWeight: 700, colorA: '#F7E7C6', colorB: '#F2DECA', band: '#9E4318', titleColor: '#FFF3DC', idiomColor: '#F6C453', tabColor: '#F6C453', accent: '#F6C453', yearColor: '#9E4318', text: '#3A2414', fontTitle: 'Binggre', fontHand: 'MangoBoardTtobaks', fontBody: 'Paperozi', fontNum: 'Oswald', line: '#8C7D66', outer: '#9E4318', sunBg: '#FBF1E3', sunColor: '#C0392B' },
    { id: 'taekwon-dynamic', cat: '사진·그림', name: '태권 다이내믹', desc: '경기복 네이비·레드, 스포츠 숫자', layout: 'photo', titleWeight: 700, colorA: '#E7ECF5', colorB: '#FBE8E8', panel: '#0E1A3C', titleColor: '#FFFFFF', idiomColor: '#C8102E', tabColor: '#C8102E', accent: '#FF5252', yearColor: '#0E1A3C', text: '#111827', fontTitle: 'Isamanru', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Oswald', line: '#82858C', outer: '#0E1A3C', sunBg: '#F5F6FA', sunColor: '#C8102E' },
    { id: 'lavender-haze', cat: '사진·그림', name: '라벤더 헤이즈', desc: '연보라·버터 옐로, 보랏빛 패널', layout: 'photo', colorA: '#E9E3F7', colorB: '#FFF2D4', panel: '#4A3A7A', titleColor: '#FFFFFF', idiomColor: '#4A3A7A', tabColor: '#4A3A7A', accent: '#FFD88A', yearColor: '#4A3A7A', text: '#2A2440', fontTitle: 'HannaPro', fontHand: 'JoyfulStory', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#888492', outer: '#4A3A7A', sunBg: '#F6F3FC', sunColor: '#D3466A' },
    { id: 'mocha-latte', cat: '사진·그림', name: '모카 라테', desc: '팬톤 2025 모카 무스 브라운·라테 톤, 카페 감성', layout: 'photo', colorA: '#EADBCD', colorB: '#F4ECE2', panel: '#6A4C3B', titleColor: '#FFFFFF', idiomColor: '#6A4C3B', tabColor: '#6A4C3B', accent: '#F1D3B8', yearColor: '#6A4C3B', text: '#2E211A', fontTitle: 'Ridibatang', fontHand: 'MaruBuri', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#8A827A', outer: '#6A4C3B', sunBg: '#FAF5EF', sunColor: '#B9473A' },
    { id: 'terracotta', cat: '인성', name: '테라코타 어스', desc: '흙빛 주황·모래·세이지, 따뜻한 자연색', layout: 'classic', titleWeight: 800, colorA: '#F3E2D0', colorB: '#E4E8DA', titleColor: '#A4472B', idiomColor: '#8A4426', tabColor: '#C8734F', accent: '#5A3A28', yearColor: '#A4472B', text: '#2E2420', fontTitle: 'Paperozi', fontHand: 'MangoBoardTtobaks', fontBody: 'Paperozi', fontNum: 'Montserrat', line: '#887D72', outer: '#7A4A2A', sunBg: '#F8EFE6', sunColor: '#C0392B' },
    { id: 'kids-pop', cat: '귀여운', name: '키즈 팝', desc: '복숭아·하늘색, 통통한 굵은 제목', layout: 'classic', titleWeight: 900, titleScale: 0.9, colorA: '#FFDCC8', colorB: '#CDEBF5', titleColor: '#3B2E8C', idiomColor: '#2E5BBA', tabColor: '#FF8A4C', accent: '#3B2E8C', yearColor: '#3B2E8C', text: '#222222', fontTitle: 'CookieRun', fontHand: 'MangoBoardTtobaks', fontBody: 'NanumSquareNeo', fontNum: 'Montserrat', line: '#8C8480', outer: '#3A3A3A', sunBg: '#FFF4EE', sunColor: '#E5484D' },
    /* ---- 2026 이미지면 새 테마 (팀장님 11/21 「인성 뿐 아니라 이미지면에 맞는 템플릿 · 카테고리」) — 캔바·어도비 익스프레스·에치 인기 캘린더 흐름:
       아치 창·폴라로이드 다꾸·벤토 격자·동그라미 창·매거진 표지·체커 스티커·사계절 장식. 달력면은 calLayout(기존 달력면 모양)을 씀 */
    { id: 'sports-team', cat: '스포츠', name: '라차 스포츠', desc: '달마다 다른 운동(스키·축구·수영…), 전광판 숫자와 스포츠 띠', layout: 'sports', calLayout: 'band', art: 'sports', titleWeight: 800, colorA: '#EEF3FB', colorB: '#FDF1EC', band: '#14286B', panel: '#14286B', titleColor: '#14286B', idiomColor: '#FFD34D', tabColor: '#E63946', accent: '#E63946', yearColor: '#14286B', text: '#14213D', fontTitle: 'Isamanru', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Oswald', line: '#7C7F85', outer: '#14286B', sunBg: '#F3F5FA', sunColor: '#E63946' },
    { id: 'sports-pop', cat: '스포츠', name: '스포츠 팝', desc: '라임·오렌지 경기장 색, 운동하는 라차', layout: 'sports', calLayout: 'card', art: 'sports', titleWeight: 900, colorA: '#F3FBE4', colorB: '#FFF3E6', band: '#FF7A1A', panel: '#1F3B2C', stripe2: '#B8E34A', titleColor: '#1F3B2C', idiomColor: '#1F3B2C', tabColor: '#FF7A1A', accent: '#FF7A1A', yearColor: '#1F3B2C', text: '#1E2A22', fontTitle: 'CookieRun', fontHand: 'Pretendard', fontBody: 'NanumSquareNeo', fontNum: 'Oswald', line: '#808C87', outer: '#1F3B2C', sunBg: '#F4FAEC', sunColor: '#E5484D' },
    { id: 'sports-court', cat: '스포츠', name: '코트 그린', desc: '경기장 선이 그려진 초록 코트, 운동하는 라차', layout: 'sports', calLayout: 'split', art: 'sports', court: true, titleWeight: 800, colorA: '#2E7D4F', colorB: '#2A7349', band: '#1E5C39', panel: '#FFFFFF', titleColor: '#FFFFFF', idiomColor: '#FFE066', tabColor: '#FFE066', accent: '#FFE066', yearColor: '#1E5C39', text: '#FFFFFF', calBg: '#FFFFFF', calText: '#1a1a1a', fontTitle: 'Isamanru', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Oswald', line: '#82858C', outer: '#1E5C39', sunBg: '', sunColor: '#D9434F' },
    { id: 'glass-aurora', cat: '사진·그림', name: '오로라 글래스', desc: '오로라 그라데이션에 그림을 크게, 반투명 유리 카드', layout: 'glass', calLayout: 'card', titleWeight: 800, colorA: '#E4E9FF', colorB: '#F7E3F5', g1: '#C9D6FF', g2: '#F6D5F7', blob1: '#A0E7E5', blob2: '#FFD6A5', titleColor: '#2A2550', idiomColor: '#6C4BD8', tabColor: '#6C4BD8', accent: '#6C4BD8', yearColor: '#2A2550', text: '#1F1F2E', fontTitle: 'Pretendard', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#868A99', outer: '#2A2550', sunBg: '#F5F6FF', sunColor: '#E0435E' },
    { id: 'glass-sunset', cat: '모던', name: '선셋 글래스', desc: '노을빛 그라데이션과 유리 카드, 배경화면용', layout: 'glass', calLayout: 'card', titleWeight: 800, colorA: '#FFE7D6', colorB: '#FFE0E6', g1: '#FFD6A5', g2: '#FF9AA2', blob1: '#FFF3B0', blob2: '#FFC2D1', titleColor: '#4A2030', idiomColor: '#C8435E', tabColor: '#E2557A', accent: '#E2557A', yearColor: '#4A2030', text: '#2E1A22', fontTitle: 'GMarketSans', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#8C8486', outer: '#4A2030', sunBg: '#FFF4F1', sunColor: '#E2557A' },
    { id: 'stamp-star', cat: '인성', name: '칭찬 도장판', desc: '그 달 날짜만큼 도장 칸 — 실천한 날 도장 쾅!', layout: 'stamp', calLayout: 'card', titleWeight: 800, colorA: '#FFF6E0', colorB: '#FFF0D6', panel: '#FFFFFF', stampC: '#F08C2E', dotC: 'rgba(240,140,46,0.14)', titleColor: '#3B2A6B', idiomColor: '#3B2A6B', tabColor: '#F08C2E', accent: '#F08C2E', yearColor: '#3B2A6B', text: '#2A2340', fontTitle: 'Jua', fontHand: 'Gaegu', fontBody: 'NanumSquareNeo', fontNum: 'Montserrat', line: '#8C8480', outer: '#3B2A6B', sunBg: '#FFF8EC', sunColor: '#E5484D' },
    { id: 'stamp-mint', cat: '귀여운', name: '칭찬 도장판 민트', desc: '민트 점무늬에 도장 칸, 실천 체크', layout: 'stamp', calLayout: 'card', titleWeight: 800, colorA: '#E3F6EF', colorB: '#EAF8F3', panel: '#FFFFFF', stampC: '#1F9E7D', dotC: 'rgba(31,158,125,0.14)', titleColor: '#1F4E5F', idiomColor: '#1F4E5F', tabColor: '#1F9E7D', accent: '#1F9E7D', yearColor: '#1F4E5F', text: '#1E3438', fontTitle: 'CookieRun', fontHand: 'Gaegu', fontBody: 'NanumSquareNeo', fontNum: 'Montserrat', line: '#808C87', outer: '#1F4E5F', sunBg: '#EEF8F4', sunColor: '#D9534F' },
    { id: 'badge-groovy', cat: '귀여운', name: '그루비 배지', desc: '둥근 창 둘레 곡선 글자, 무지개 아치, 70년대 레트로', layout: 'badge', calLayout: 'band', groovy: true, titleWeight: 800, colorA: '#F8E9CF', colorB: '#F6E3C4', band: '#9E4318', panel: '#F2B84B', arc1: '#D9622B', arc2: '#F2B84B', arc3: '#6B8F4E', titleColor: '#7A3B17', idiomColor: '#F6C453', tabColor: '#D9622B', accent: '#D9622B', yearColor: '#7A3B17', text: '#3A2414', fontTitle: 'Binggre', fontHand: 'Pretendard', fontBody: 'Paperozi', fontNum: 'Oswald', line: '#8C7D66', outer: '#9E4318', sunBg: '#FBF1E3', sunColor: '#C0392B' },
    { id: 'badge-emblem', cat: '인성', name: '나라차 엠블럼', desc: '도장 이름이 둘레를 감싼 엠블럼 창, 남색·빨강', layout: 'badge', calLayout: 'minimal', titleWeight: 800, colorA: '#EEF1F7', colorB: '#F4F5F9', panel: '#FFFFFF', titleColor: '#1E2B5A', idiomColor: '#E0564B', tabColor: '#E0564B', accent: '#E0564B', yearColor: '#1E2B5A', text: '#1a1a1a', fontTitle: 'Black Han Sans', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Oswald', line: '#7C7F85', outer: '#1E2B5A', sunBg: '', sunColor: '#D84343' },
    { id: 'season-garden', cat: '계절', name: '사계절 정원', desc: '달마다 바뀌는 계절색과 꽃·눈·단풍 장식', layout: 'season', calLayout: 'card', season: 'pastel', titleWeight: 400, colorA: '#FDEFF3', colorB: '#EEF3EE', titleColor: '#3A3A3A', idiomColor: '#3A3A3A', tabColor: '#3A3A3A', accent: '#3A3A3A', yearColor: '#3A3A3A', text: '#2A2A2A', fontTitle: 'Jua', fontHand: 'Gaegu', fontBody: 'Gowun Dodum', fontNum: 'Montserrat', line: '#8A8A8A', outer: '#555555', sunBg: '', sunColor: '#E0564B' },
    { id: 'season-arch', cat: '계절', name: '계절 아치', desc: '아치 창 위에 계절 꽃다발, 달마다 색이 바뀜', layout: 'arch', calLayout: 'card', season: 'pastel', deco: true, titleWeight: 700, colorA: '#FDEFF3', colorB: '#EEF3EE', panel: '#FFFFFF', titleColor: '#3A3A3A', idiomColor: '#3A3A3A', tabColor: '#3A3A3A', accent: '#3A3A3A', yearColor: '#3A3A3A', text: '#2A2A2A', fontTitle: 'Gowun Batang', fontHand: 'Gaegu', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#8A8A8A', outer: '#555555', sunBg: '', sunColor: '#C8392B' },
    { id: 'season-diary', cat: '계절', name: '계절 다이어리', desc: '모눈종이에 폴라로이드·마스킹테이프, 계절 장식', layout: 'polaroid', calLayout: 'card', season: 'pastel', deco: true, titleScale: 1.1, colorA: '#FDEFF3', colorB: '#EEF3EE', titleColor: '#3A3A3A', idiomColor: '#3A3A3A', tabColor: '#3A3A3A', accent: '#3A3A3A', yearColor: '#3A3A3A', text: '#2A2A2A', fontTitle: 'Jua', fontHand: 'Gaegu', fontBody: 'Gowun Dodum', fontNum: 'Montserrat', line: '#8A8A8A', outer: '#555555', sunBg: '', sunColor: '#E0564B' },
    { id: 'season-bento', cat: '계절', name: '계절 벤토', desc: '크기가 다른 네모 칸에 계절색, 2026 벤토 격자', layout: 'bento', calLayout: 'card', season: 'pastel', deco: true, titleWeight: 800, colorA: '#FDEFF3', colorB: '#EEF3EE', panel: '#2A2A2A', titleColor: '#3A3A3A', idiomColor: '#3A3A3A', tabColor: '#3A3A3A', accent: '#3A3A3A', yearColor: '#3A3A3A', text: '#2A2A2A', fontTitle: 'NanumSquareNeo', fontHand: 'Gaegu', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#8A8A8A', outer: '#555555', sunBg: '', sunColor: '#E0564B' },
    { id: 'season-night', cat: '계절', name: '사계절 밤하늘', desc: '달마다 짙은 계절색 바탕에 흰 글자와 장식', layout: 'season', calLayout: 'card', season: 'deep', colorA: '#1F3A5F', colorB: '#3B2A4F', titleColor: '#FFFFFF', idiomColor: '#3A3A3A', tabColor: '#FFFFFF', accent: '#FFFFFF', yearColor: '#1F3A5F', text: '#F5F5F5', calBg: '#FFFFFF', calText: '#1a1a1a', fontTitle: 'Jua', fontHand: 'Gaegu', fontBody: 'Gowun Dodum', fontNum: 'Montserrat', line: '#8A8A8A', outer: '#333333', sunBg: '', sunColor: '#E0564B' },
    { id: 'arch-sand', cat: '사진·그림', name: '아치 샌드', desc: '모래색 바탕에 테라코타 아치 창, 보헤미안 감성', layout: 'arch', calLayout: 'card', titleWeight: 700, colorA: '#F3E6D6', colorB: '#EFE2D2', panel: '#E8BFA2', titleColor: '#6E3B24', idiomColor: '#A4472B', tabColor: '#C8643C', accent: '#C8643C', yearColor: '#6E3B24', text: '#3A2A20', fontTitle: 'Gowun Batang', fontHand: 'MaruBuri', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#8A8076', outer: '#6E3B24', sunBg: '#FBF4EC', sunColor: '#B9473A' },
    { id: 'arch-sage', cat: '사진·그림', name: '아치 세이지', desc: '세이지 그린 아치 창, 차분한 자연색', layout: 'arch', calLayout: 'card', titleWeight: 700, colorA: '#E7ECE1', colorB: '#EEF0E6', panel: '#C3D3B8', titleColor: '#2F4B37', idiomColor: '#5A7A5F', tabColor: '#6F8F62', accent: '#6F8F62', yearColor: '#2F4B37', text: '#25302A', fontTitle: 'MaruBuri', fontHand: 'MaruBuri', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#84897F', outer: '#2F4B37', sunBg: '#F2F6EF', sunColor: '#C0533D' },
    { id: 'circle-sun', cat: '사진·그림', name: '선샤인 서클', desc: '해처럼 둥근 창에 그림, 큰 월 숫자', layout: 'circle', calLayout: 'minimal', titleWeight: 800, colorA: '#FFF3E0', colorB: '#FFF0E6', panel: '#FFCB5C', titleColor: '#3A2A1A', idiomColor: '#E0662C', tabColor: '#FF7A2F', accent: '#FF7A2F', yearColor: '#3A2A1A', text: '#2E2218', fontTitle: 'GMarketSans', fontHand: 'MangoBoardTtobaks', fontBody: 'Pretendard', fontNum: 'Montserrat', line: '#8C8278', outer: '#3A2A1A', sunBg: '', sunColor: '#E0564B' },
    { id: 'magazine-cobalt', cat: '사진·그림', name: '매거진 블루', desc: '잡지 표지처럼 큰 월 숫자 앞에 그림, 코발트', layout: 'magazine', calLayout: 'split', titleWeight: 800, colorA: '#E8EDFF', colorB: '#EEF1FF', band: '#2546F0', titleColor: '#0E1446', idiomColor: '#FFFFFF', tabColor: '#2546F0', accent: '#2546F0', yearColor: '#2546F0', text: '#141B3D', fontTitle: 'Pretendard', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#828693', outer: '#0E1446', sunBg: '', sunColor: '#E0435E' },
    { id: 'magazine-cream', cat: '모던', name: '매거진 크림', desc: '크림 종이에 토마토색 큰 숫자, 에디토리얼', layout: 'magazine', calLayout: 'split', titleWeight: 800, colorA: '#F3EDE2', colorB: '#F0E9DC', band: '#D9472B', titleColor: '#1E1E1E', idiomColor: '#FFFFFF', tabColor: '#D9472B', accent: '#D9472B', yearColor: '#D9472B', text: '#1E1E1E', fontTitle: 'Noto Serif KR', fontHand: 'MaruBuri', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#8C8984', outer: '#1E1E1E', sunBg: '', sunColor: '#D9472B' },
    { id: 'circle-night', cat: '모던', name: '미드나잇 서클', desc: '남색 밤하늘에 금빛 달 같은 동그라미 창', layout: 'circle', calLayout: 'minimal', titleWeight: 700, colorA: '#1C2340', colorB: '#222A4A', panel: '#2F3B6A', titleColor: '#FFFFFF', idiomColor: '#B8862B', tabColor: '#F6C445', accent: '#F6C445', yearColor: '#1C2340', text: '#F2F2F2', calBg: '#FFFFFF', calText: '#1a1a1a', fontTitle: 'Gowun Batang', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Playfair Display', line: '#898989', outer: '#1C2340', sunBg: '', sunColor: '#C8392B' },
    { id: 'bento-neon', cat: '모던', name: '벤토 네온', desc: '라임·오렌지 칸에 검정 굵은 글자, 네오 브루탈', layout: 'bento', calLayout: 'card', titleWeight: 800, colorA: '#F2F0E9', colorB: '#ECEAE2', panel: '#141414', tint1: '#D9F26A', tint2: '#FFFFFF', tint3: '#FF5A1F', titleColor: '#141414', idiomColor: '#141414', tabColor: '#FF5A1F', accent: '#FF5A1F', yearColor: '#141414', text: '#141414', fontTitle: 'Isamanru', fontHand: 'Pretendard', fontBody: 'Pretendard', fontNum: 'Oswald', line: '#868480', outer: '#141414', sunBg: '', sunColor: '#FF5A1F' },
    { id: 'bento-pastel', cat: '귀여운', name: '벤토 파스텔', desc: '복숭아·하늘·라벤더 둥근 칸, 귀여운 격자', layout: 'bento', calLayout: 'card', titleWeight: 800, colorA: '#F6F2EC', colorB: '#F3EFE8', panel: '#3B3355', tint1: '#FFDCCB', tint2: '#FFFFFF', tint3: '#D8E6FF', titleColor: '#3B3355', idiomColor: '#3B3355', tabColor: '#FF8A65', accent: '#FF8A65', yearColor: '#3B3355', text: '#2E2A40', fontTitle: 'CookieRun', fontHand: 'Gaegu', fontBody: 'NanumSquareNeo', fontNum: 'Montserrat', line: '#8C8480', outer: '#3B3355', sunBg: '#FFF4EE', sunColor: '#E5484D' },
    { id: 'polaroid-pink', cat: '귀여운', name: '다꾸 핑크', desc: '분홍 모눈종이에 폴라로이드·마스킹테이프·낙서', layout: 'polaroid', titleScale: 1.12, calLayout: 'card', colorA: '#FFE6EE', colorB: '#FFEFF4', grid: '#F6B9CC', titleColor: '#4B2E83', idiomColor: '#C2185B', tabColor: '#F06292', accent: '#F06292', tape: '#B9A6F2', yearColor: '#4B2E83', text: '#2E2440', fontTitle: 'Jua', fontHand: 'Gaegu', fontBody: 'Gowun Dodum', fontNum: 'Montserrat', line: '#8C8486', outer: '#4B2E83', sunBg: '#FFF4F7', sunColor: '#E0435E' },
    { id: 'polaroid-mint', cat: '귀여운', name: '다꾸 민트', desc: '민트 모눈종이에 폴라로이드, 노란 테이프', layout: 'polaroid', titleScale: 1.12, calLayout: 'card', colorA: '#E0F5EE', colorB: '#E8F7F2', grid: '#A8DCCB', titleColor: '#1F4E5F', idiomColor: '#1F8A70', tabColor: '#2BB39A', accent: '#2BB39A', tape: '#FFD45C', yearColor: '#1F4E5F', text: '#1E3438', fontTitle: 'Jua', fontHand: 'Gaegu', fontBody: 'Gowun Dodum', fontNum: 'Montserrat', line: '#808C87', outer: '#1F4E5F', sunBg: '#EEF8F4', sunColor: '#D9534F' },
    { id: 'sticker-lemon', cat: '귀여운', name: '체커 스티커', desc: '레몬 체커보드 테두리, 라벤더 스티커', layout: 'sticker', calLayout: 'card', titleWeight: 900, colorA: '#FFF7C2', colorB: '#FFF4B0', check: '#FFE45C', panel: '#FFFFFF', tint1: '#E4DAFF', titleColor: '#2B2B6B', idiomColor: '#5B3FE0', tabColor: '#7B5CFF', accent: '#7B5CFF', yearColor: '#2B2B6B', text: '#22224A', fontTitle: 'CookieRun', fontHand: 'Gaegu', fontBody: 'NanumSquareNeo', fontNum: 'Montserrat', line: '#8C8888', outer: '#2B2B6B', sunBg: '#FFFBE6', sunColor: '#E5484D' },
    { id: 'sticker-cherry', cat: '귀여운', name: '체리 체커', desc: '분홍 체커보드 테두리, 체리빛 스티커', layout: 'sticker', calLayout: 'card', titleWeight: 900, colorA: '#FFF0F3', colorB: '#FFEAF0', check: '#FFC2CF', panel: '#FFFFFF', tint1: '#FFD9E2', titleColor: '#5A1A2B', idiomColor: '#C8243F', tabColor: '#E8364F', accent: '#E8364F', yearColor: '#5A1A2B', text: '#3A1520', fontTitle: 'YeogiOttaeJalnan', fontHand: 'Gaegu', fontBody: 'Paperozi', fontNum: 'Montserrat', line: '#8C8486', outer: '#5A1A2B', sunBg: '#FFF5F7', sunColor: '#E8364F' },
  ];
  /* 계절 색표: season 테마는 달마다 바탕·제목·포인트 색이 바뀜 (pastel = 밝은 계절색, deep = 짙은 계절색·흰 글자) */
  const SEASON = {
    pastel: [['#E7F0FA', '#1F4E79', '#4A8BCB'], ['#F7EEE6', '#7A2E3B', '#D9577A'], ['#FDEDF2', '#A8365E', '#EE7FA4'], ['#EEF6E2', '#3F6B2A', '#E9A62C'], ['#E5F3E8', '#1E6B45', '#E8618C'], ['#E8EBFA', '#3D4A9E', '#8471D2'], ['#DFF3F6', '#0E6A80', '#F08A4B'], ['#FFF3D2', '#8A5200', '#F2A100'], ['#EEF1F8', '#4A5D8A', '#E06C9F'], ['#FBEADB', '#A4401E', '#E0662C'], ['#F6EDD6', '#735410', '#D49A12'], ['#ECF2EC', '#A3242F', '#2F6B4A']],
    deep: [['#1F3A5F', '#FFFFFF', '#A9CBEB'], ['#5A2333', '#FFFFFF', '#F7B6C8'], ['#7A2C4E', '#FFFFFF', '#FBD3DE'], ['#2F5226', '#FFFFFF', '#F7D46B'], ['#1D5640', '#FFFFFF', '#F59AB7'], ['#2E3672', '#FFFFFF', '#C3B6F2'], ['#0B5468', '#FFFFFF', '#FFC48C'], ['#7A4A00', '#FFFFFF', '#FFD66B'], ['#3B4A72', '#FFFFFF', '#F7B7CF'], ['#7A2E16', '#FFFFFF', '#F5B03B'], ['#5A4210', '#FFFFFF', '#F6D45A'], ['#123D2A', '#FFFFFF', '#F6C445']],
  };

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
    /* 배경이 있는 정사각 장면 그림(홍익 hi-…, 모서리 둥근 카드)은 자리 상자 가운데에 조금 작게 — 아래 붙이면 아래 띠·위 영문 덕목과 겹쳤음 (11/20) */
    const cardArt = src => /(^|\/)hi-\d\d-/.test(String(src || ''));
    const img = (mo, x, y, w, h, st) => { if (cardArt(mo.image)) { const s = Math.round(Math.min(w, h) * 0.78); x += (w - s) / 2; y += (h - s) * 0.65; w = h = s; st = Object.assign({}, st, { pos: '50% 50%' }); } return I_(mo.image, x, y, w, h, Object.assign({ pos: '50% 100%', name: '삽화', role: 'illust', month: mo.m }, st)); };
    const L = T.layout, L2 = T.calLayout || T.layout;
    /* 계절 테마: 그 달의 바탕·제목·포인트 색 (pastel·deep) */
    const TM = m => { if (!T.season) return Object.assign({ bg: (C.months[m - 1] || {}).bg === 'B' ? B : A }, T); const q = (SEASON[T.season] || SEASON.pastel)[m - 1]; return Object.assign({}, T, { bg: q[0], titleColor: q[1], accent: q[2], tabColor: q[2], idiomColor: q[1], yearColor: q[1], panel: T.season === 'deep' ? 'rgba(255,255,255,0.14)' : (T.panel || '#ffffff') }); };
    const deco = (m, x, y, w, h, st) => I_(`assets/deco/season-${String(m).padStart(2, '0')}.svg`, x, y, w, h, Object.assign({ name: '계절 장식', fit: 'contain' }, st));
    const rotP = (cx, cy, dx, dy, deg) => { const r = deg * Math.PI / 180; return [cx + dx * Math.cos(r) - dy * Math.sin(r), cy + dx * Math.sin(r) + dy * Math.cos(r)]; };

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
      const mo = C.months[m - 1], bg = T.season ? TM(m).bg : mo.bg === 'B' ? B : A, chars = [...mo.virtue].length, nd = String(m).length;
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
        ], `${m}월 이미지면`, 'virtue');
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
        ], `${m}월 이미지면`, 'virtue');
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
        ], `${m}월 이미지면`, 'virtue');
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
        ], `${m}월 이미지면`, 'virtue');
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
        ], `${m}월 이미지면`, 'virtue');
      }
      /* ===== 2026 이미지면 새 모양 (11/21) ===== */
      const t = TM(m), dk = isDark(bg), ink = dk ? '#ffffff' : TX, sub = dk ? 'rgba(255,255,255,0.75)' : '#666666', mm2 = String(m).padStart(2, '0'), ymCaps = `${MONTHS_EN[m - 1].toUpperCase()}  ${year}`;
      const logoAt = (x, y, w, h, on) => (on ? [S_('rect', x - 1.6, y - 1.4, w + 3.2, h + 2.8, { fill: '#ffffff', radius: 2, opacity: 0.92, name: '로고 바탕' })] : []).concat([I_(C.dojang.swoosh, x, y, w, h, { name: '로고' })]);  /* 남색 로고가 짙은 바탕에서 안 보여 흰 바탕을 깔아 줌 */
      const prac = (x, y, w, h, st) => T_(practiceText(mo), x, y, w, h, Object.assign({ font: T.fontBody, size: 10.5, weight: 500, lh: 1.5, color: ink, name: '실천 과제', role: 'practice', month: m }, st, { size: Math.max(9.5, (st && st.size) || 10.5) }));
      if (L === 'arch') {
        /* 아치 창: 오른쪽 아치 창 안에 그림, 왼쪽 큰 월 숫자·덕목·명언 (계절 테마는 아치 위에 꽃다발) */
        return pg(bg, [
          S_('arch', 117, 9, 98, 139, { fill: '', stroke: t.accent, strokeW: 0.45, name: '아치 선' }),
          S_('arch', 122, 14, 88, 129, { fill: t.panel || '#ffffff', name: '아치 창' }),
          img(mo, 125, 30, 82, 112, { clip: 'arch', pos: '50% 100%' }),
          T.deco ? deco(m, 146, -3, 80, 64) : null,
          ...logoAt(16, 13, 11, 9.5, dk),
          T_(ymCaps, 30, 15.5, 84, 6, { font: T.fontNum, size: 7.5, weight: 700, ls: 0.28, color: t.accent, name: '연월', role: 'ym', month: m }),
          T_(mm2, 14, 24, 70, 26, { font: T.fontNum, size: 64, weight: 700, lh: 0.95, ls: -0.03, color: t.titleColor, name: '월 숫자' }),
          T_(mo.virtue, 16, 50, 100, 20, Object.assign({ font: T.fontTitle, size: Math.round(42 * (T.titleScale || 1)), color: t.titleColor, lh: 1.05, ls: -0.01 }, common)),
          T_(mo.en, 16, 71, 100, 6, { font: T.fontNum, size: 8.5, weight: 600, italic: true, ls: 0.08, color: t.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 16, 82, 96, 38, { size: 12.5, weight: 500, lh: 1.6, color: ink, name: '명언', role: 'quote', month: m }),
          S_('rect', 16, 123, 22, 0.5, { fill: t.accent, name: '가는 줄' }),
          prac(16, 126, 100, 22, { size: 10 }),
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
      }
      if (L === 'polaroid') {
        /* 폴라로이드 다꾸: 모눈종이 바탕, 비스듬한 폴라로이드에 그림, 마스킹테이프·별 낙서 */
        const fx = 164, fy = 74, ang = -4, [ix, iy] = rotP(fx, fy, 0, -10, ang), [cx2, cy2] = rotP(fx, fy, 0, 43.5, ang);
        const tape = T.tape || t.accent;
        return pg(bg, [
          S_('grid', 0, 0, 224, 154, { fill: T.grid || (dk ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)'), cell: 6, lineW: 0.2, name: '모눈종이' }),
          T.deco ? deco(m, 0, 104, 64, 51, { flip: true, flipV: true, opacity: 0.95 }) : null,
          S_('rect', fx - 46, fy - 56, 92, 112, { fill: '#ffffff', rot: ang, shadow: true, shA: 0.18, shB: 1.2, shY: 1.2, radius: 0.8, name: '폴라로이드' }),
          S_('rect', ix - 41, iy - 41, 82, 82, { fill: T.season ? t.bg : (B || '#f4f1ea'), rot: ang, name: '사진 바탕' }),
          img(mo, ix - 40, iy - 40, 80, 80, { rot: ang, pos: '50% 100%' }),
          T_(`${MONTHS_EN[m - 1]} ${year} ♡`, cx2 - 40, cy2 - 6, 80, 12, { font: T.fontHand, size: 17, align: 'center', valign: 'middle', rot: ang, color: '#444444', name: '사진 글씨' }),
          S_('rect', fx - 17, fy - 61, 34, 10, { fill: tape, opacity: 0.72, rot: ang + 7, name: '마스킹테이프' }),
          T.deco ? deco(m, 150, -4, 76, 61) : S_('star', 200, 12, 9, 9, { fill: t.accent, points: 4, inner: 0.32, name: '반짝 낙서' }),
          S_('star', 108, 20, 6, 6, { fill: tape, points: 4, inner: 0.32, name: '반짝 낙서' }),
          S_('ellipse', 14, 12, 24, 24, { fill: t.accent, name: '월 스티커' }),
          T_(String(m), 14, 12, 24, 24, { font: T.fontNum, size: 30, weight: 800, align: 'center', valign: 'middle', lh: 1, color: '#ffffff', name: '월 숫자' }),
          T_(ymCaps, 42, 20, 70, 6, { font: T.fontNum, size: 7.5, weight: 700, ls: 0.24, color: sub, name: '연월', role: 'ym', month: m }),
          T_(mo.virtue, 15, 42, 100, 17, Object.assign({ font: T.fontTitle, size: Math.round(36 * (T.titleScale || 1)), color: t.titleColor, lh: 1.05 }, common)),
          S_('wave', 16, 60, 34, 3.6, { fill: t.accent, name: '물결 낙서' }),
          T_(mo.en, 54, 59.5, 60, 5, { font: T.fontNum, size: 8, weight: 700, ls: 0.16, color: t.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 16, 70, 92, 42, { size: 13, weight: 600, lh: 1.6, color: ink, name: '명언', role: 'quote', month: m }),
          S_('rect', 14, 119, 100, 28, { fill: dk ? 'rgba(255,255,255,0.12)' : '#ffffff', radius: 3, opacity: 0.92, name: '실천 메모' }),
          I_(C.dojang.target, 18, 123, 9, 9, { name: '실천 아이콘' }),
          prac(29.5, 120.5, 83, 26, { size: 10 }),
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
      }
      if (L === 'bento') {
        /* 벤토 격자: 크기가 다른 둥근 칸 — 큰 그림 칸 · 월 칸 · 연도 칸 · 덕목 · 명언 · 실천 */
        const c1 = T.season ? t.bg : (T.tint1 || A), c2 = T.tint2 || '#ffffff', c3 = T.season ? t.accent : (T.tint3 || B), pan = T.season ? t.titleColor : (T.panel || '#222222');
        const pageBg = T.season ? '#F7F5F1' : bg, r = 5;
        return pg(pageBg, [
          S_('rect', 8, 8, 100, 138, { fill: c1, radius: r, name: '그림 칸' }),
          T.deco ? deco(m, 46, 6, 64, 51) : null,
          img(mo, 12, 30, 92, 112, { pos: '50% 100%' }),
          S_('rect', 112, 8, 50, 46, { fill: c3, radius: r, name: '월 칸' }),
          T_(mm2, 116, 11, 42, 28, { font: T.fontNum, size: 64, weight: 800, lh: 1, ls: -0.04, color: isDark(c3) ? '#ffffff' : '#141414', name: '월 숫자' }),
          T_(MONTHS_EN[m - 1].toUpperCase(), 117, 44, 42, 6, { font: T.fontNum, size: 7.5, weight: 800, ls: 0.22, color: isDark(c3) ? '#ffffff' : '#141414', name: '월 이름', role: 'ym', month: m }),
          S_('rect', 166, 8, 50, 46, { fill: pan, radius: r, name: '연도 칸' }),
          T_(String(year), 170, 36, 44, 14, { font: T.fontNum, size: 26, weight: 800, lh: 1, ls: -0.02, color: '#ffffff', name: '연도' }),
          T_(C.dojang.nameEn || 'NARACHA', 171, 14, 30, 8, { font: T.fontNum, size: 5.5, weight: 700, ls: 0.2, lh: 1.3, color: 'rgba(255,255,255,0.7)', name: '도장 이름' }),
          S_('rect', 112, 58, 104, 26, { fill: c2, radius: r, name: '덕목 칸' }),
          ...logoAt(201, 62, 11, 9.5, isDark(c2)),
          T_(mo.virtue, 118, 61.5, 80, 13, Object.assign({ font: T.fontTitle, size: Math.round(28 * (T.titleScale || 1)), color: T.season ? t.titleColor : T.titleColor, lh: 1.05, ls: -0.02 }, common)),
          T_(mo.en, 118, 75.5, 92, 5, { font: T.fontNum, size: 8, weight: 700, ls: 0.18, color: T.season ? t.accent : T.accent, name: '영문', role: 'en', month: m }),
          S_('rect', 112, 88, 104, 36, { fill: T.season ? '#ffffff' : c1, radius: r, name: '명언 칸' }),
          T_(mo.quote, 118, 91.5, 92, 30, { size: 11.5, weight: 600, lh: 1.55, color: '#1f1f1f', name: '명언', role: 'quote', month: m }),
          S_('rect', 112, 128, 104, 18, { fill: c2, radius: r, name: '실천 칸' }),
          I_(C.dojang.target, 116, 132, 9.5, 9.5, { name: '실천 아이콘' }),
          prac(128, 129, 86, 16, { size: 9.5, lh: 1.4, color: '#222222' }),
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
      }
      if (L === 'circle') {
        /* 동그라미 창: 해·달처럼 둥근 창에 그림, 바깥 고리와 작은 점, 왼쪽 큰 월 숫자 */
        return pg(bg, [
          S_('ellipse', 100, 11, 120, 120, { fill: '', stroke: t.accent, strokeW: 0.45, name: '바깥 고리' }),
          S_('ellipse', 106, 17, 108, 108, { fill: t.panel || '#ffffff', name: '동그라미 창' }),
          img(mo, 110, 21, 100, 100, { clip: 'circle', pos: '50% 100%' }),
          S_('ellipse', 104.5, 32, 5, 5, { fill: t.accent, name: '고리 점' }), S_('ellipse', 208, 104, 3.4, 3.4, { fill: t.accent, name: '고리 점' }),
          T_(mm2, 12, 8, 90, 40, { font: T.fontNum, size: 104, weight: 800, lh: 0.95, ls: -0.05, color: t.accent, name: '월 숫자' }),
          T_(ymCaps, 15, 47, 84, 6, { font: T.fontNum, size: 7.5, weight: 700, ls: 0.28, color: sub, name: '연월', role: 'ym', month: m }),
          T_(mo.virtue, 15, 57, 86, 16, Object.assign({ font: T.fontTitle, size: Math.round(32 * (T.titleScale || 1)), color: t.titleColor, lh: 1.05, ls: -0.02 }, common)),
          T_(mo.en, 15, 73.5, 86, 5, { font: T.fontNum, size: 8.5, weight: 700, ls: 0.16, color: t.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 15, 82, 84, 40, { size: 12, weight: 500, lh: 1.6, color: ink, name: '명언', role: 'quote', month: m }),
          S_('rect', 15, 134, 194, 0.4, { fill: dk ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)', name: '실천 줄' }),
          I_(C.dojang.target, 15, 138, 9, 9, { name: '실천 아이콘' }),
          prac(27, 136.5, 160, 15, { size: 9.5, lh: 1.4 }),
          ...logoAt(197, 137.5, 12, 10.5, dk),
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
      }
      if (L === 'magazine') {
        /* 매거진 표지: 위 큰 달 이름(마스트헤드), 아주 큰 월 숫자 앞에 그림이 서고, 양옆 표지 글 */
        return pg(bg, [
          T_(MONTHS_EN[m - 1].toUpperCase(), 8, 6, 208, 20, { font: T.fontNum, size: 52, weight: 800, align: 'center', lh: 1, ls: 0.06, color: t.titleColor, name: '달 이름', role: 'ym', month: m }),
          S_('rect', 10, 28, 204, 0.5, { fill: t.titleColor, name: '윗줄' }),
          T_(`VOL.${mm2}  ·  ${year}  ·  ${C.dojang.nameEn || 'NARACHA TAEKWONDO'}`, 10, 30, 204, 5, { font: T.fontNum, size: 6, weight: 700, ls: 0.3, align: 'center', color: t.titleColor, name: '호수' }),
          T_(mm2, 40, 38, 144, 100, { font: T.fontNum, size: 255, weight: 800, align: 'center', lh: 0.95, ls: -0.06, color: t.accent, name: '큰 월 숫자' }),
          img(mo, 56, 42, 112, 106, { pos: '50% 100%' }),
          T_(mo.virtue, 10, 43, 56, 28, Object.assign({ font: T.fontTitle, size: Math.round(34 * (T.titleScale || 1)), color: t.titleColor, lh: 1.1, ls: -0.02 }, common)),
          T_(mo.en, 10, 72, 54, 5, { font: T.fontNum, size: 7.5, weight: 700, italic: true, ls: 0.08, color: t.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 10, 81, 50, 56, { size: 10, weight: 600, lh: 1.6, color: ink, name: '명언', role: 'quote', month: m }),
          T_('이달의 실천', 166, 44, 48, 5, { size: 7.5, weight: 800, ls: 0.1, color: t.accent, name: '실천 머리' }),
          S_('rect', 166, 51, 14, 0.5, { fill: t.accent }),
          prac(166, 54, 50, 60, { size: 9.5, lh: 1.55 }),
          ...logoAt(200, 134, 14, 12, dk),
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
      }
      if (L === 'sticker') {
        /* 체커 스티커: 체커보드 테두리 + 흰 카드, 별꽃 스티커 위 그림, 월 배지 */
        const tint = T.tint1 || B;
        return pg(bg, [
          S_('checker', 0, 0, 224, 154, { fill: T.check || t.accent, cell: 5, name: '체커보드' }),
          S_('rect', 8, 8, 208, 138, { fill: T.panel || '#ffffff', radius: 6, shadow: true, shA: 0.12, shB: 0.8, name: '카드' }),
          S_('burst', 110, 13, 102, 102, { fill: tint, points: 16, inner: 0.86, name: '별꽃 스티커' }),
          S_('rect', 124, 22, 76, 82, { fill: '#ffffff', radius: 4, rot: 4, shadow: true, shA: 0.16, shB: 1, name: '스티커 카드' }),
          img(mo, 127.5, 25.5, 69, 75, { rot: 4, radius: 2.5, pos: '50% 100%' }),
          S_('burst', 11, 9, 35, 35, { fill: t.accent, points: 12, inner: 0.8, rot: -8, name: '월 배지' }),
          T_(String(m), 11, 9, 35, 35, { font: T.fontNum, size: 34, weight: 800, align: 'center', valign: 'middle', lh: 1, color: '#ffffff', rot: -8, name: '월 숫자' }),
          T_(ymCaps, 50, 22.5, 64, 6, { font: T.fontNum, size: 7.5, weight: 800, ls: 0.24, color: t.accent, name: '연월', role: 'ym', month: m }),
          I_(C.dojang.swoosh, 196, 118, 13, 11, { name: '로고' }),
          T_(mo.virtue, 15, 48, 96, 17, Object.assign({ font: T.fontTitle, size: Math.round(36 * (T.titleScale || 1)), color: t.titleColor, lh: 1.05, ls: -0.02 }, common)),
          T_(mo.en, 16, 66, 96, 5, { font: T.fontNum, size: 8, weight: 800, ls: 0.18, color: t.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 16, 75, 92, 40, { size: 12.5, weight: 700, lh: 1.6, color: ink, name: '명언', role: 'quote', month: m }),
          S_('heart', 98, 112, 8, 7, { fill: t.accent, rot: 12, name: '하트 스티커' }),
          S_('pill', 15, 121, 178, 19, { fill: tint, name: '실천 바탕' }),
          I_(C.dojang.target, 20, 125.5, 10, 10, { name: '실천 아이콘' }),
          prac(33, 122, 158, 17, { size: 9.8, lh: 1.4, color: '#222222' }),
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
      }
      if (L === 'sports') {
        /* 라차 스포츠: 달마다 다른 운동 — 사선 스포츠 띠, 운동 아이콘 배지, 전광판 월 숫자 (그림은 NARACAL_SPORTS_ART가 있으면 그 달 운동 그림) */
        const SP = (window.NARACAL_SPORTS || [])[m - 1] || ['🏅', '운동', 'SPORTS'], art = (window.NARACAL_SPORTS_ART || [])[m - 1];
        const emo = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/svg/emoji_u' + [...SP[0]].map(c => c.codePointAt(0).toString(16)).filter(c => c !== 'fe0f').join('_') + '.svg';
        const mo2 = art ? Object.assign({}, mo, { image: art }) : mo, s2 = T.stripe2 || t.accent;
        return pg(bg, [
          T.court ? S_('rect', 112, 10, 104, 134, { fill: '', stroke: 'rgba(255,255,255,0.55)', strokeW: 0.7, name: '코트 선' }) : null,
          T.court ? S_('ellipse', 136, 50, 56, 56, { fill: '', stroke: 'rgba(255,255,255,0.55)', strokeW: 0.7, name: '코트 원' }) : null,
          T.court ? S_('rect', 112, 77.6, 104, 0.7, { fill: 'rgba(255,255,255,0.55)', name: '코트 가운데 선' }) : null,
          T.court ? null : S_('rect', 150, -40, 30, 240, { fill: T.band, rot: 24, name: '스포츠 띠' }),
          T.court ? null : S_('rect', 186, -40, 9, 240, { fill: s2, rot: 24, name: '스포츠 띠' }),
          img(mo2, 116, 24, 102, 124, { pos: '50% 100%', role: art ? 'sportsArt' : 'illust' }),
          S_('ellipse', 182, 8, 34, 34, { fill: '#ffffff', shadow: true, shA: 0.18, shB: 0.8, name: '운동 배지' }),
          I_(emo, 188, 14, 22, 22, { name: '운동 아이콘' }),
          S_('rect', 14, 12, 52, 30, { fill: T.court ? 'rgba(0,0,0,0.28)' : T.panel, radius: 3, name: '전광판' }),
          T_(mm2, 14, 12, 52, 30, { font: T.fontNum, size: 62, weight: 700, align: 'center', valign: 'middle', lh: 1, ls: 0.02, color: T.court ? t.accent : '#FFD34D', name: '월 숫자' }),
          T_(`${MONTHS_EN[m - 1].toUpperCase()}\n${year}`, 70, 15, 46, 12, { font: T.fontNum, size: 8.5, weight: 700, ls: 0.2, lh: 1.35, color: dk ? '#ffffff' : t.titleColor, name: '연월', role: 'ym', month: m }),
          S_('pill', 70, 31, 44, 9, { fill: t.accent, name: '운동 이름 바탕' }),
          T_(`${SP[1]}  ${SP[2]}`, 70, 31, 44, 9, { font: T.fontBody, size: 7.5, weight: 800, ls: 0.06, align: 'center', valign: 'middle', lh: 1, color: isDark(t.accent) ? '#ffffff' : '#1a1a1a', name: '이달의 운동' }),
          T_(mo.virtue, 14, 50, 100, 18, Object.assign({ font: T.fontTitle, size: Math.round(40 * (T.titleScale || 1)), color: t.titleColor, lh: 1.05, ls: -0.02 }, common)),
          T_(mo.en, 15, 68.5, 100, 6, { font: T.fontNum, size: 9, weight: 600, ls: 0.22, color: t.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 15, 78, 96, 40, { size: 12.5, weight: 700, lh: 1.6, color: ink, name: '명언', role: 'quote', month: m }),
          S_('rect', 14, 121, 100, 26, { fill: dk ? 'rgba(0,0,0,0.22)' : '#ffffff', radius: 3, name: '실천 카드' }),
          S_('rect', 14, 121, 3, 26, { fill: t.accent, name: '실천 색 막대' }),
          I_(C.dojang.target, 20, 125, 9.5, 9.5, { name: '실천 아이콘' }),
          prac(32, 122.5, 80, 24, { size: 10 }),
          ...logoAt(104, 13, 11, 9.5, dk),
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
      }
      if (L === 'glass') {
        /* 풀 이미지 + 유리 카드: 오로라 그라데이션 바탕에 그림을 크게, 왼쪽 반투명 유리 카드에 글 (배경화면에 잘 어울림) */
        return pg(bg, [
          S_('rect', 0, 0, 224, 154, { fillType: 'gradient', g1: T.g1 || A, g2: T.g2 || B, gAngle: 135, name: '그라데이션 바탕' }),
          S_('ellipse', 120, -30, 130, 110, { fill: T.blob1 || '#ffffff', opacity: 0.45, name: '빛 번짐' }),
          S_('ellipse', -40, 90, 120, 100, { fill: T.blob2 || '#ffffff', opacity: 0.4, name: '빛 번짐' }),
          img(mo, 66, 4, 158, 150, { pos: '75% 100%' }),
          S_('rect', 10, 12, 98, 130, { fill: '#ffffff', opacity: 0.56, radius: 6, shadow: true, shA: 0.12, shB: 1.6, shY: 1, name: '유리 카드' }),
          S_('rect', 10, 12, 98, 130, { fill: '', stroke: '#ffffff', strokeW: 0.5, radius: 6, name: '유리 테두리' }),
          ...logoAt(91, 18, 11, 9.5, false),
          T_(mm2, 17, 17, 60, 24, { font: T.fontNum, size: 60, weight: 800, lh: 1, ls: -0.04, color: t.accent, name: '월 숫자' }),
          T_(ymCaps, 18, 42, 84, 6, { font: T.fontNum, size: 7.5, weight: 700, ls: 0.26, color: t.titleColor, opacity: 0.7, name: '연월', role: 'ym', month: m }),
          T_(mo.virtue, 17, 52, 88, 18, Object.assign({ font: T.fontTitle, size: Math.round(38 * (T.titleScale || 1)), color: t.titleColor, lh: 1.05, ls: -0.02 }, common)),
          T_(mo.en, 18, 70, 88, 6, { font: T.fontNum, size: 8.5, weight: 700, ls: 0.2, color: t.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 18, 80, 86, 34, { size: 12, weight: 600, lh: 1.6, color: '#1f1f2e', name: '명언', role: 'quote', month: m }),
          S_('rect', 18, 116, 20, 0.5, { fill: t.accent, name: '가는 줄' }),
          prac(18, 119, 86, 22, { size: 9.8, color: '#1f1f2e' }),
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
      }
      if (L === 'stamp') {
        /* 칭찬 도장판: 그 달 날짜 수만큼 도장 칸(7칸 × 5줄) — 아이가 실천한 날 도장·스티커를 붙임 */
        const nd2 = daysIn(year, m), card = T.panel || '#ffffff', sc = T.stampC || t.accent, cells = [];
        for (let d = 1; d <= 35; d++) { const k = d - 1, cx = 140 + (k % 7) * 10.6, cy = 101 + Math.floor(k / 7) * 9; if (d <= nd2) { cells.push(S_('ellipse', cx, cy, 7.6, 7.6, { fill: '#ffffff', stroke: sc, strokeW: 0.35, dash: '1 0.7', name: `도장 칸 ${d}` })); cells.push(T_(String(d), cx, cy, 7.6, 7.6, { font: T.fontNum, size: 6, weight: 600, align: 'center', valign: 'middle', lh: 1, color: sc, opacity: 0.75, name: `날짜 ${d}` })); } }
        return pg(bg, [
          S_('dots', 0, 0, 224, 154, { fill: T.dotC || 'rgba(0,0,0,0.06)', cell: 5, name: '점무늬' }),
          img(mo, 120, 4, 98, 90, { pos: '50% 100%' }),
          ...logoAt(16, 12, 11, 9.5, false),
          T_(ymCaps, 30, 14.5, 84, 6, { font: T.fontNum, size: 7.5, weight: 700, ls: 0.26, color: t.accent, name: '연월', role: 'ym', month: m }),
          T_(String(m), 14, 24, 40, 26, { font: T.fontNum, size: 66, weight: 800, lh: 1, ls: -0.04, color: t.accent, name: '월 숫자' }),
          T_(mo.virtue, nd === 1 ? 38 : 56, 30, 70, 18, Object.assign({ font: T.fontTitle, size: Math.round(36 * (T.titleScale || 1)), color: t.titleColor, lh: 1.05, ls: -0.02 }, common)),
          T_(mo.en, nd === 1 ? 39 : 57, 48, 70, 5, { font: T.fontNum, size: 8, weight: 700, ls: 0.2, color: t.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 16, 58, 100, 30, { size: 12, weight: 700, lh: 1.6, color: ink, name: '명언', role: 'quote', month: m }),
          S_('rect', 8, 94, 208, 54, { fill: card, radius: 5, shadow: true, shA: 0.1, shB: 1, name: '도장판 카드' }),
          S_('star', 14, 99, 8, 8, { fill: sc, name: '별' }),
          T_('칭찬 도장판', 24, 99, 70, 8, { font: T.fontTitle, size: 14, weight: 800, valign: 'middle', lh: 1, color: t.titleColor, name: '도장판 제목' }),
          T_('실천한 날마다 도장 쾅! · 다 모으면 사범님께 보여 주세요', 14, 109, 120, 5, { size: 7, weight: 600, color: '#666666', name: '도장판 설명' }),
          S_('rect', 14, 118, 118, 25, { fill: T.season ? t.bg : (B || '#f6f6f6'), radius: 3, name: '실천 바탕' }),
          I_(C.dojang.target, 18, 121.5, 9.5, 9.5, { name: '실천 아이콘' }),
          prac(30, 120, 100, 22, { size: 9.8, color: '#222222' }),
          ...cells,
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
      }
      if (L === 'badge') {
        /* 곡선 글자 배지: 둥근 그림 창 둘레를 영문 덕목·도장 이름 글자가 감싸고, 월 숫자 배지도 원 둘레 글자 (레트로·그루비) */
        /* 둘레 글자는 원 둘레 길이에 맞춰 되풀이해 고르게 꽉 차게 (글자 폭 ≈ 0.58em) */
        const ringFill = (str, size, diam) => { const fs = size * 25.4 / 72, C2 = 2 * Math.PI * (diam / 2 - fs * 0.6); return str.repeat(Math.max(1, Math.round(C2 / (str.length * fs * 0.58)))); };
        const ring = ringFill(`${mo.en.toUpperCase()} ✦ ${C.dojang.nameEn || 'NARACHA TAEKWONDO'} ✦ ${year} ✦ `, 12, 114);
        return pg(bg, [
          T.groovy ? S_('arch', -26, 92, 92, 92, { fill: T.arc1 || t.accent, name: '무지개 1' }) : null,
          T.groovy ? S_('arch', -16, 102, 72, 82, { fill: T.arc2 || '#ffffff', name: '무지개 2' }) : null,
          T.groovy ? S_('arch', -6, 112, 52, 72, { fill: T.arc3 || t.titleColor, name: '무지개 3' }) : null,
          T.groovy ? S_('arch', 4, 122, 32, 62, { fill: bg, name: '무지개 4' }) : null,
          T_(ring, 108, 2, 114, 114, { font: T.fontNum, size: 12, weight: 700, warp: 'circle', warpFit: true, color: t.titleColor, name: '둘레 글자', role: 'ring', month: m }),
          S_('ellipse', 121, 15, 88, 88, { fill: T.panel || '#ffffff', name: '둥근 창' }),
          img(mo, 124, 18, 82, 82, { clip: 'circle', pos: '50% 100%' }),
          S_('ellipse', 176, 104, 40, 40, { fill: t.accent, shadow: true, shA: 0.18, shB: 0.8, name: '월 배지' }),
          S_('ellipse', 184.5, 112.5, 23, 23, { fill: '', stroke: 'rgba(255,255,255,0.7)', strokeW: 0.35, name: '배지 안쪽 선' }),
          T_(ringFill(`${MONTHS_EN[m - 1].toUpperCase()} • ${year} • `, 6.5, 40), 176, 104, 40, 40, { font: T.fontNum, size: 6.5, weight: 700, warp: 'circle', warpFit: true, color: '#ffffff', name: '배지 둘레 글자' }),
          T_(String(m), 176, 104, 40, 40, { font: T.fontNum, size: 34, weight: 800, align: 'center', valign: 'middle', lh: 1, color: '#ffffff', name: '월 숫자' }),
          ...logoAt(16, 12, 11, 9.5, dk),
          T_(ymCaps, 30, 14.5, 80, 6, { font: T.fontNum, size: 7.5, weight: 700, ls: 0.26, color: t.accent, name: '연월', role: 'ym', month: m }),
          T_(mo.virtue, 15, 26, 96, 20, Object.assign({ font: T.fontTitle, size: Math.round(44 * (T.titleScale || 1)), color: t.titleColor, lh: 1.05, ls: -0.02 }, common)),
          T_(mo.en, 16, 47, 96, 6, { font: T.fontNum, size: 9, weight: 700, ls: 0.22, color: t.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 16, 58, 94, 36, { size: 12.5, weight: 700, lh: 1.6, color: ink, name: '명언', role: 'quote', month: m }),
          S_('rect', T.groovy ? 52 : 14, 112, T.groovy ? 116 : 154, 32, { fill: dk ? 'rgba(255,255,255,0.12)' : '#ffffff', opacity: 0.92, radius: 4, name: '실천 카드' }),
          I_(C.dojang.target, T.groovy ? 56 : 18, 116, 9.5, 9.5, { name: '실천 아이콘' }),
          prac(T.groovy ? 68 : 30, 114.5, T.groovy ? 98 : 136, 28, { size: 9.8 }),
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
      }
      if (L === 'season') {
        /* 사계절 정원: 달마다 계절색 바탕, 오른쪽 위 꽃·눈·단풍 장식, 오른쪽 아래 그림 */
        return pg(bg, [
          deco(m, 112, 0, 112, 90),
          deco(m, 0, 116, 48, 38, { flip: true, flipV: true, opacity: 0.9 }),
          img(mo, 120, 38, 98, 110, { pos: '50% 100%' }),
          T_(mm2, 15, 12, 46, 26, { font: T.fontNum, size: 64, weight: 800, lh: 1, ls: -0.04, color: t.accent, name: '월 숫자' }),
          T_(`${year}\n${MONTHS_EN[m - 1].toUpperCase()}`, 49, 16.5, 60, 12, { font: T.fontNum, size: 7.5, weight: 700, ls: 0.22, lh: 1.45, color: sub, name: '연월', role: 'ym', month: m }),
          T_(mo.virtue, 15, 42, 100, 18, Object.assign({ font: T.fontTitle, size: Math.round(40 * (T.titleScale || 1)), color: t.titleColor, lh: 1.05 }, common)),
          T_(mo.en, 16, 61, 100, 5, { font: T.fontNum, size: 8.5, weight: 700, ls: 0.16, color: t.accent, name: '영문', role: 'en', month: m }),
          T_(mo.quote, 16, 71, 98, 44, { size: 13.5, weight: 700, lh: 1.6, color: ink, name: '명언', role: 'quote', month: m }),
          S_('rect', 14, 120, 118, 27, { fill: dk ? 'rgba(255,255,255,0.14)' : '#ffffff', opacity: dk ? 1 : 0.9, radius: 4, name: '실천 카드' }),
          I_(C.dojang.target, 18, 125, 10, 10, { name: '실천 아이콘' }),
          prac(31, 122, 100, 24, { size: 10, color: dk ? '#ffffff' : t.titleColor }),
          ...logoAt(102, 12, 12, 10.5, dk),
        ].filter(Boolean), `${m}월 이미지면`, 'virtue');
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
      ], `${m}월 이미지면`, 'virtue');
    }
    function calendar(m) {
      const mo = C.months[m - 1];
      const idiom = `${mo.idiom}(${mo.hanja})`;
      if (L2 === 'band') {
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
      if (L2 === 'minimal') {
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
      if (L2 === 'photo') {
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
      if (L2 === 'card') {
        const tc = TM(m), tint = T.season ? tc.bg : T.tint1 && T.layout === 'bento' ? T.tint1 : mo.bg === 'B' ? B : A, tDk = isDark(tint);  /* 계절 테마는 달마다 계절색 머리 카드 */
        return pg(CBG, [
          S_('rect', 10, 8, 204, 31, { fill: tint, radius: 5, name: '머리 카드' }),
          T_(String(m).padStart(2, '0'), 15, 10.5, 34, 18, { font: T.fontNum, size: 42, weight: 800, lh: 1, ls: -0.03, color: tDk ? '#ffffff' : tc.titleColor, name: '월 숫자' }),
          T_(`${MONTHS_EN[m - 1]}  ${year}`, 16, 30, 40, 5, { font: T.fontNum, size: 6.8, weight: 700, ls: 0.18, color: tDk ? '#ffffff' : tc.accent, name: '연월', role: 'ym', month: m }),
          mo.mascot ? I_(mo.mascot, 52, 11, 20, 20, { name: '마스코트', role: 'mascot', month: m }) : null,
          T_(idiom, 76, 13, 90, 8, { size: 12.5, weight: 700, color: tDk ? '#ffffff' : tc.idiomColor, name: '사자성어', role: 'idiom', month: m }),
          T_(mo.meaning, 76, 21.5, 90, 14, { size: 8.3, lh: 1.4, color: tDk ? '#eeeeee' : CTX, name: '사자성어 뜻', role: 'meaning', month: m }),
          S_('rect', 170, 10.5, 41, 26, { fill: '#ffffff', radius: 3, name: '미니 바탕' }),
          mini(m, 171.5, 12, 38, 23),
          calEl(m, { x: 10, y: 43, w: 204, h: 102, s: { lineW: 0.25 } }),
          I_(C.dojang.footer, 97, 147.5, 30, 4.4, { name: '하단 로고' }),
        ].filter(Boolean), `${m}월 달력`, 'cal');
      }
      if (L2 === 'split') {
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
    /* ---------- 배경화면 (2027~ 인쇄 대신 이미지로 나눠 줌, 팀장님 11/20) ----------
       한 달 = 한 장: 덕목·명언·그림 + 그 달 달력. 기준 크기(인쇄 글자 크기 그대로)로 짜고, 앱이 화면 크기(1920×1080 / 1080×2340px)로 통째로 키움.
       PC 기준 224×126(16:9) — 아래 작업 표시줄 자리는 비움 / 휴대폰 기준 126×273(9:19.5) — 위 1/4은 잠금 화면 시계 자리라 비움 */
    const WALL = { pc: [224, 126], mob: [126, 273] };
    const wallCal = (m, x, y, w, h, s) => calEl(m, { x, y, w, h, s: Object.assign({ wdLang: 'short', wdH: 4.6, wdSize: 6.5, daySize: 9, evSize: 5.2, lineW: 0.5, outerW: 0.8, cellPad: 2.2 }, s) });
    function wallMonth(m, fmt) {
      const T = TM(m), mo = C.months[m - 1], bg = T.bg, dark = isDark(bg), ts = T.titleScale || 1;  /* 계절 테마는 달마다 계절색 */
      const ink = dark ? '#ffffff' : TX, card = CBG, cardDark = isDark(card), idiom = `${mo.idiom}(${mo.hanja})`;
      const common = { role: 'virtue', month: m, name: '덕목', weight: T.titleWeight || 800 };
      const ym = `${MONTHS_EN[m - 1]}  ${year}`;
      if (fmt === 'pc') {
        return pg(bg, [
          T_(mo.virtue, 12, 9, 92, 15, Object.assign({ font: T.fontTitle, size: Math.round(34 * ts), color: dark ? '#ffffff' : T.titleColor, lh: 1, ls: -0.02 }, common)),
          T_(mo.en, 12, 24.5, 92, 5, { font: T.fontNum, size: 7, weight: 700, ls: 0.18, color: T.accent, name: '영문', role: 'en', month: m }),
          img(mo, 14, 31, 84, 62, { month: m, pos: '50% 50%' }),
          T_(mo.quote, 10, 95, 96, 15, { size: 9.5, weight: 700, lh: 1.5, align: 'center', color: ink, name: '명언', role: 'quote', month: m }),
          S_('rect', 108, 7, 108, 108, { fill: card, radius: 4, name: '달력 카드', shadow: true }),
          T_(String(m).padStart(2, '0'), 113, 9.5, 28, 15, { font: T.fontNum, size: 38, weight: 800, lh: 1, ls: -0.03, color: T.accent, name: '월 숫자' }),
          T_(ym, 140, 11, 56, 5, { font: T.fontNum, size: 6.5, weight: 700, ls: 0.18, color: cardDark ? '#dddddd' : '#555555', name: '연월', role: 'ym', month: m }),
          T_(idiom, 140, 16.5, 70, 6, { size: 9, weight: 700, color: T.idiomColor, name: '사자성어', role: 'idiom', month: m }),
          I_(C.dojang.swoosh, 201, 10, 11, 9, { name: '로고' }),
          wallCal(m, 112, 27, 100, 70),
          S_('rect', 112, 99.5, 100, 0.4, { fill: T.accent, opacity: 0.6, name: '실천 줄' }),
          I_(C.dojang.target, 112, 102, 8, 8, { name: '실천 아이콘' }),
          T_(practiceText(mo), 122, 101, 90, 12, { font: T.fontHand, size: 8.5, lh: 1.4, color: cardDark ? '#ffffff' : '#222222', name: '실천 과제', role: 'practice', month: m }),
          I_(C.dojang.footer, 140, 117, 36, 5.3, { name: '하단 로고', opacity: 0.85 }),
        ], `${m}월 PC 배경화면`, 'wall');
      }
      /* 휴대폰: 달력 칸을 위아래로 넉넉히(팀장님 11/20 — 줄 간격 늘리기): 그림을 조금 줄이고 달력 높이 70 (줄마다 약 13mm 기준) */
      return pg(bg, [
        T_(mo.virtue, 8, 60, 110, 12, Object.assign({ font: T.fontTitle, size: Math.round(28 * ts), color: dark ? '#ffffff' : T.titleColor, lh: 1, ls: -0.02, align: 'center' }, common)),
        T_(mo.en, 8, 72.5, 110, 5, { font: T.fontNum, size: 6.5, weight: 700, ls: 0.18, color: T.accent, align: 'center', name: '영문', role: 'en', month: m }),
        img(mo, 30, 79, 66, 58, { month: m, pos: '50% 50%' }),
        T_(mo.quote, 8, 138.5, 110, 14, { size: 8.5, weight: 700, lh: 1.45, align: 'center', color: ink, name: '명언', role: 'quote', month: m }),
        S_('rect', 5, 154, 116, 106, { fill: card, radius: 4, name: '달력 카드', shadow: true }),
        T_(String(m).padStart(2, '0'), 9, 156.5, 26, 14, { font: T.fontNum, size: 34, weight: 800, lh: 1, ls: -0.03, color: T.accent, name: '월 숫자' }),
        T_(ym, 35, 158, 60, 5, { font: T.fontNum, size: 6, weight: 700, ls: 0.18, color: cardDark ? '#dddddd' : '#555555', name: '연월', role: 'ym', month: m }),
        T_(idiom, 35, 163, 70, 6, { size: 8.5, weight: 700, color: T.idiomColor, name: '사자성어', role: 'idiom', month: m }),
        I_(C.dojang.swoosh, 106, 157, 11, 9, { name: '로고' }),
        wallCal(m, 8, 172, 110, 70, { daySize: 9.5, evSize: 5.2, wdH: 5 }),
        I_(C.dojang.target, 9, 245.5, 7.5, 7.5, { name: '실천 아이콘' }),
        T_(practiceText(mo), 18.5, 244.5, 100, 12, { font: T.fontHand, size: 8, lh: 1.4, color: cardDark ? '#ffffff' : '#222222', name: '실천 과제', role: 'practice', month: m }),
        I_(C.dojang.footer, 45, 263, 36, 5.3, { name: '하단 로고', opacity: 0.85 }),
      ], `${m}월 휴대폰 배경화면`, 'wall');
    }
    function wallCover(fmt) {
      const c = C.cover, bg = c.bg === 'B' ? B : A, dark = isDark(bg), ink = dark ? '#ffffff' : TX;
      if (fmt === 'pc') return pg(bg, [
        I_(C.dojang.logo, 12, 10, 60, 14, { name: '로고', role: 'logo' }),
        T_(String(year), 140, 6, 72, 22, { font: T.fontNum, size: 54, weight: 800, color: dark ? T.titleColor : T.yearColor, align: 'right', lh: 1, ls: -0.02, name: '연도', role: 'year' }),
        I_(c.image, 20, 30, 184, 64, { name: '표지 그림', role: 'coverImage' }),
        T_(c.title, 12, 97, 200, 7, { size: 13, weight: 500, align: 'center', color: ink, name: '제목 윗줄', role: 'coverTitle' }),
        T_(c.subtitle, 12, 104.5, 200, 9, { size: 16, weight: 700, align: 'center', color: ink, name: '제목 아랫줄', role: 'coverSubtitle' }),
      ], 'PC 배경화면 표지', 'wallcover');
      return pg(bg, [
        T_(String(year), 8, 66, 110, 22, { font: T.fontNum, size: 58, weight: 800, color: dark ? T.titleColor : T.yearColor, align: 'center', lh: 1, ls: -0.02, name: '연도', role: 'year' }),
        I_(C.dojang.logo, 33, 91, 60, 14, { name: '로고', role: 'logo' }),
        I_(c.image, 4, 112, 118, 66, { name: '표지 그림', role: 'coverImage' }),
        T_(c.title, 8, 184, 110, 7, { size: 12, weight: 500, align: 'center', color: ink, name: '제목 윗줄', role: 'coverTitle' }),
        T_(c.subtitle, 8, 192, 110, 18, { size: 15, weight: 700, lh: 1.35, align: 'center', color: ink, name: '제목 아랫줄', role: 'coverSubtitle' }),
        T_(c.note, 10, 214, 106, 16, { size: 8, lh: 1.5, align: 'center', color: dark ? '#dddddd' : TX, name: '설명', role: 'coverNote' }),
      ], '휴대폰 배경화면 표지', 'wallcover');
    }
    const out = [];
    const kind = opts.kind || 'full';
    if (/^wall-(pc|mob)$/.test(kind)) { const f = kind.slice(5); if (opts.cover !== false) out.push(wallCover(f)); for (let m = 1; m <= 12; m++) out.push(wallMonth(m, f)); out.forEach(p => { p.wall = f; p.els.forEach(e => { e.gen = 1; }); }); out.base = WALL[f]; return out; }
    if (kind === 'wallmonth') { const p = wallMonth(opts.month || 1, opts.fmt || 'pc'); p.wall = opts.fmt || 'pc'; p.els.forEach(e => { e.gen = 1; }); const r = [p]; r.base = WALL[p.wall]; return r; }
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
  // 쪽이 나타내는 달: 큰 달력 요소 → 그 밖의 달 표시 요소(작은 '다음 달' 달력은 빼고)
  function pageMonth(p) { const c = (p.els || []).find(e => e.type === 'cal' && e.month) || (p.els || []).find(e => e.month && e.type !== 'mini'); return c ? c.month : null; }
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
      else { const m = pageMonth(p); if (p.kind === 'virtue') np = vir.find(x => pageMonth(x) === m); if (p.kind === 'cal') np = cal.find(x => pageMonth(x) === m); }  /* 쪽의 달: 그 쪽 달력 요소의 달 — '다음 달' 작은 달력(month = 다음 달)에 먼저 걸려 한 칸씩 밀리고 12월이 사라지던 것 */
      if (np) {
        replaced++;
        // 달력 칸 편집(합치기·너비·높이·칸 색·칸 글자)은 그대로 옮김
        const oc = p.els.find(e => e.type === 'cal'), nc = np.els.find(e => e.type === 'cal');
        if (oc && nc) { ['cells', 'merges', 'colW', 'rowH'].forEach(k => { if (oc[k] != null) nc[k] = JSON.parse(JSON.stringify(oc[k])); }); carryS(oc, nc); }
        // 사용자가 직접 넣은 요소(스티커·사진·글 상자 등)는 새 디자인 위에 그대로 둠
        if (p.els.some(e => e.gen)) np.els.push(...p.els.filter(e => !e.gen));
        return np;
      }
      return p;
    });
    return replaced;
  }
  /* 달력 모양 중 사용자가 고른 것(주 시작·줄 수·음력 + 속성 창에서 바꾼 값 sUser)은 테마·달을 바꿔도 남김 (11/24 검토: 테마를 바꾸면 처음 값으로 돌아가고, 값이 undefined인 키가 들어가 달력이 깨짐) */
  function carryS(oc, nc) { if (!oc || !nc) return nc; const os = oc.s || {}, keys = new Set(['weekStart', 'rows', 'lunar'].concat(Object.keys(oc.sUser || {}))); const add = {}; keys.forEach(k => { if (os[k] !== undefined) add[k] = os[k]; }); nc.s = Object.assign({}, nc.s || {}, add); Object.keys(nc.s).forEach(k => { if (nc.s[k] === undefined) delete nc.s[k]; }); if (oc.sUser) nc.sUser = Object.assign({}, oc.sUser); return nc; }
  // 칸 번호 → 칸 서식 키 (날짜 칸은 날짜로 고정해 달·주 시작이 바뀌어도 그 날짜를 따라감)
  function cellKey(el, c) { const s = Object.assign({}, CAL_DEF, el.s || {}); const first = (new Date(el.year, el.month - 1, 1).getDay() - s.weekStart + 7) % 7; const n = c - first + 1; return n >= 1 && n <= daysIn(el.year, el.month) ? 'd' + n : String(c); }
  function calRows(el) { const s = Object.assign({}, CAL_DEF, el.s || {}); const first = (new Date(el.year, el.month - 1, 1).getDay() - s.weekStart + 7) % 7; return s.rows === '6' ? 6 : s.rows === 'auto' ? Math.ceil((first + daysIn(el.year, el.month)) / 7) : 5; }
  return { setSrc: f => { srcOf = f; }, SEASON, THEME_CATS: ['인성', '계절', '스포츠', '사진·그림', '귀여운', '모던'], cellKey, calRows, carryS, builtinHolidays, autoHolidays, canAuto, AUTO_RANGE, fetchHolidays, holidayMap, calHTML, miniHTML, applyRules, buildPages, retheme, syncFromPages, themeOf, THEMES, CAL_DEF, MINI_DEF, MONTHS_EN, daysIn, WD };
})();
