// 템플릿 4: 명절·국경일 휴관 안내 카드
// 다가오는 휴일 날짜(대체 휴일 포함)가 자동으로 들어가고, 어떤 크기로 만들어도 다시 배치되는 반응형 템플릿
// 그림은 모두 벡터(직접 그린 SVG + Noto Emoji)라 현수막처럼 크게 인쇄해도 선명함
(function () {
  const L = NC.tpl.list;
  const H = (uid) => ({
    T: (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: 'Pretendard', size: 12, weight: 400, italic: false, color: '#1a1a1a', align: 'center', lh: 1.3, ls: 0, strokeW: 0, strokeC: '#ffffff', shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, st),
    I: (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }, st),
    S: (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: '#F0716B', stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st),
    P: (bg, els, label) => ({ id: uid(), bg, els, label }),
  });
  const NAME = '나라차태권도';
  const svg = (vb, body) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`);
  const EMO = cp => `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/svg/emoji_u${cp}.svg`;
  const r2 = v => Math.round(v * 100) / 100;

  /* ===== 벡터 그림 소재 ===== */
  const ART = {
    moon: (c1 = '#FFE58A', c2 = '#F5C242') => svg('0 0 100 100', `<defs><radialGradient id="m" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient><radialGradient id="g" r="50%"><stop offset=".6" stop-color="${c1}" stop-opacity=".45"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g)"/><circle cx="50" cy="50" r="34" fill="url(#m)"/><circle cx="40" cy="42" r="5" fill="${c2}" opacity=".45"/><circle cx="58" cy="58" r="7" fill="${c2}" opacity=".35"/><circle cx="60" cy="38" r="3" fill="${c2}" opacity=".4"/>`),
    sun: (c = '#F4A340', glow = '#FFD58A') => svg('0 0 100 100', `<defs><radialGradient id="s" r="50%"><stop offset=".55" stop-color="${glow}" stop-opacity=".7"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="url(#s)"/><circle cx="50" cy="50" r="30" fill="${c}"/>`),
    pouch: (body = '#D94B5C', band = '#F2C14E', knot = '#2E6F9E') => svg('0 0 100 110', `<path d="M30 40 Q14 52 14 74 Q14 104 50 104 Q86 104 86 74 Q86 52 70 40 Z" fill="${body}"/><path d="M26 30 Q50 44 74 30 L70 40 Q50 50 30 40 Z" fill="${band}"/><path d="M34 16 Q38 30 30 32 L70 32 Q62 30 66 16 Q58 24 50 22 Q42 24 34 16 Z" fill="${body}"/><circle cx="50" cy="36" r="5" fill="${knot}"/><path d="M47 40 L40 58 M53 40 L60 58" stroke="${knot}" stroke-width="3" stroke-linecap="round"/><text x="50" y="84" font-size="22" text-anchor="middle" fill="${band}" font-family="serif" font-weight="700">福</text>`),
    songpyeon: () => svg('0 0 120 70', `<path d="M8 52 Q10 22 38 18 Q58 18 62 40 Q48 56 8 52Z" fill="#F7B6C2"/><path d="M44 58 Q48 26 76 24 Q98 26 100 48 Q84 62 44 58Z" fill="#B8D99B"/><path d="M70 64 Q76 36 98 36 Q116 38 116 56 Q100 68 70 64Z" fill="#FFF4D6" stroke="#E9D9B0" stroke-width="1.2"/><path d="M14 46 Q30 40 54 42 M50 52 Q70 46 92 46 M76 58 Q94 54 110 54" stroke="#ffffff" stroke-opacity=".6" stroke-width="2" fill="none" stroke-linecap="round"/>`),
    persimmon: () => svg('0 0 100 100', `<circle cx="50" cy="58" r="36" fill="#F08A3C"/><ellipse cx="38" cy="48" rx="9" ry="6" fill="#FFB277" opacity=".7"/><path d="M50 26 Q34 18 28 28 Q40 34 50 30 Q60 34 72 28 Q66 18 50 26Z" fill="#4F8A3B"/><path d="M50 30 Q52 18 58 12" stroke="#5B4632" stroke-width="3" fill="none" stroke-linecap="round"/>`),
    tteokguk: () => svg('0 0 120 90', `<ellipse cx="60" cy="40" rx="52" ry="16" fill="#F7F1E3"/><path d="M8 40 Q12 84 60 84 Q108 84 112 40 Z" fill="#2F4A6D"/><path d="M14 44 Q60 60 106 44" stroke="#E7B84B" stroke-width="2" fill="none"/><g fill="#ffffff" stroke="#E6DCC4" stroke-width="1"><ellipse cx="38" cy="38" rx="9" ry="5"/><ellipse cx="58" cy="34" rx="9" ry="5"/><ellipse cx="78" cy="39" rx="9" ry="5"/><ellipse cx="50" cy="44" rx="9" ry="5"/><ellipse cx="70" cy="45" rx="9" ry="5"/></g><path d="M44 30 l6 2 M62 28 l5 3" stroke="#3E8E4E" stroke-width="2.5" stroke-linecap="round"/><path d="M56 40 l8 -2" stroke="#E2C044" stroke-width="2.5" stroke-linecap="round"/>`),
    kite: () => svg('0 0 80 120', `<rect x="8" y="6" width="64" height="80" rx="3" fill="#FFFDF6" stroke="#2F3B52" stroke-width="2"/><rect x="8" y="6" width="64" height="16" fill="#D94B5C"/><circle cx="40" cy="48" r="11" fill="#F6EFE3" stroke="#2F3B52" stroke-width="2"/><path d="M8 6 L72 86 M72 6 L8 86 M40 6 L40 86" stroke="#2F3B52" stroke-width="1.2" opacity=".5"/><path d="M28 86 Q24 100 30 116 M52 86 Q56 100 50 116" stroke="#2E6F9E" stroke-width="2.5" fill="none"/>`),
    taegeuk: () => svg('0 0 100 100', `<circle cx="50" cy="50" r="46" fill="#0F4C9C"/><path d="M4 50 A46 46 0 0 1 96 50 A23 23 0 0 1 50 50 A23 23 0 0 0 4 50Z" fill="#CD2E3A"/>`),
    mugunghwa: (petal = '#F3A9C3', center = '#C2185B') => svg('0 0 100 100', `<g transform="translate(50 50)">${[0, 72, 144, 216, 288].map(a => `<path transform="rotate(${a})" d="M0 0 C-22 -10 -24 -42 0 -46 C24 -42 22 -10 0 0Z" fill="${petal}" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.2"/>`).join('')}<circle r="11" fill="${center}"/><path d="M0 -4 L0 -22" stroke="#F7E36B" stroke-width="3" stroke-linecap="round"/><circle cy="-23" r="3.5" fill="#F7E36B"/></g>`),
    chrysanthemum: (c = '#FFFFFF', center = '#E8D48A') => svg('0 0 100 100', `<g transform="translate(50 50)">${Array.from({ length: 20 }, (_, i) => `<ellipse transform="rotate(${i * 18})" cx="0" cy="-26" rx="5" ry="18" fill="${c}" stroke="#D9DCE3" stroke-width="1"/>`).join('')}${Array.from({ length: 14 }, (_, i) => `<ellipse transform="rotate(${i * 25.7 + 9})" cx="0" cy="-15" rx="4" ry="11" fill="${c}" stroke="#D9DCE3" stroke-width="1"/>`).join('')}<circle r="8" fill="${center}"/></g>`),
    lantern: (c = '#F28AA8', c2 = '#F9C6D3') => svg('0 0 100 120', `<path d="M50 10 L50 22" stroke="#7A5C3E" stroke-width="2.5"/><g transform="translate(50 64)">${[-40, -20, 0, 20, 40].map((a, i) => `<path transform="rotate(${a})" d="M0 36 C-18 18 -16 -22 0 -40 C16 -22 18 18 0 36Z" fill="${i % 2 ? c2 : c}" stroke="#ffffff" stroke-width="1.4"/>`).join('')}</g><rect x="38" y="20" width="24" height="6" rx="2" fill="#E7B84B"/><rect x="40" y="100" width="20" height="5" rx="2" fill="#E7B84B"/><path d="M50 105 L50 118 M44 106 L42 116 M56 106 L58 116" stroke="#E25D6F" stroke-width="2" stroke-linecap="round"/>`),
    pinwheel: () => svg('0 0 100 120', `<g transform="translate(50 46)"><path d="M0 0 L0 -40 Q22 -34 0 0Z" fill="#F25F5C"/><path d="M0 0 L40 0 Q34 22 0 0Z" fill="#FFD23F"/><path d="M0 0 L0 40 Q-22 34 0 0Z" fill="#3BCEAC"/><path d="M0 0 L-40 0 Q-34 -22 0 0Z" fill="#4D96FF"/><circle r="4" fill="#ffffff" stroke="#555" stroke-width="1"/></g><path d="M50 50 L50 118" stroke="#8A6A4A" stroke-width="3" stroke-linecap="round"/>`),
    snowflake: (c = '#FFFFFF') => svg('0 0 100 100', `<g transform="translate(50 50)" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none">${[0, 60, 120].map(a => `<g transform="rotate(${a})"><path d="M0 -42 L0 42"/><path d="M0 -28 L-9 -37 M0 -28 L9 -37 M0 28 L-9 37 M0 28 L9 37"/></g>`).join('')}</g>`),
    book: (c = '#0F4C9C') => svg('0 0 120 90', `<path d="M60 18 Q36 6 8 12 L8 80 Q36 74 60 86 Z" fill="#FFFDF6" stroke="${c}" stroke-width="2.5"/><path d="M60 18 Q84 6 112 12 L112 80 Q84 74 60 86 Z" fill="#FFFDF6" stroke="${c}" stroke-width="2.5"/><path d="M20 30 Q36 26 50 32 M20 42 Q36 38 50 44 M20 54 Q36 50 50 56 M70 32 Q84 26 100 30 M70 44 Q84 38 100 42 M70 56 Q84 50 100 54" stroke="${c}" stroke-opacity=".45" stroke-width="2" fill="none"/>`),
    calendarIcon: (c = '#B82837') => svg('0 0 100 100', `<rect x="10" y="18" width="80" height="72" rx="10" fill="#ffffff" stroke="#2F3B52" stroke-width="3"/><path d="M10 28 Q10 18 20 18 L80 18 Q90 18 90 28 L90 38 L10 38Z" fill="${c}"/><path d="M30 10 L30 26 M70 10 L70 26" stroke="#2F3B52" stroke-width="5" stroke-linecap="round"/><g fill="${c}" opacity=".85"><circle cx="30" cy="54" r="4"/><circle cx="50" cy="54" r="4"/><circle cx="70" cy="54" r="4"/><circle cx="30" cy="72" r="4"/><circle cx="50" cy="72" r="4"/></g>`),
    cloud: (c = '#FFFFFF', o = 1) => svg('0 0 120 60', `<g fill="${c}" opacity="${o}"><circle cx="34" cy="36" r="16"/><circle cx="56" cy="26" r="20"/><circle cx="80" cy="34" r="16"/><rect x="20" y="36" width="76" height="16" rx="8"/></g><path d="M56 26 m-8 0 a8 8 0 1 1 8 8" stroke="${c === '#FFFFFF' ? '#E6E9F0' : '#ffffff'}" stroke-opacity=".7" stroke-width="2" fill="none"/>`),
    // 가로 띠 그림: 요소 크기(mm) 그대로의 viewBox로 그려 늘어나지 않게
    roof: (W, Hh, c = '#22324F', c2 = '#2F4566') => { const n = Math.max(6, Math.round(W / (Hh * 0.9))), tw = W / n; return svg(`0 0 ${r2(W)} ${r2(Hh)}`, `<rect x="0" y="${r2(Hh * 0.35)}" width="${r2(W)}" height="${r2(Hh * 0.65)}" fill="${c}"/>${Array.from({ length: n }, (_, i) => `<path d="M${r2(i * tw)} ${r2(Hh * 0.38)} Q${r2(i * tw + tw / 2)} ${r2(Hh * 0.05)} ${r2((i + 1) * tw)} ${r2(Hh * 0.38)}Z" fill="${c2}"/>`).join('')}<rect x="0" y="${r2(Hh * 0.33)}" width="${r2(W)}" height="${r2(Hh * 0.07)}" fill="#E7B84B" opacity=".9"/>`); },
    saekdong: (W, Hh, cs = ['#D94B5C', '#F2C14E', '#4F9D69', '#2E6F9E', '#F4A6B8', '#FFFFFF']) => { const n = cs.length, sh = Hh / n; return svg(`0 0 ${r2(W)} ${r2(Hh)}`, cs.map((c, i) => `<rect x="0" y="${r2(i * sh)}" width="${r2(W)}" height="${r2(sh + 0.05)}" fill="${c}"/>`).join('')); },
    mountains: (W, Hh, cs = ['#9DB8D9', '#6E91BF', '#3E5F8F']) => svg(`0 0 ${r2(W)} ${r2(Hh)}`, cs.map((c, i) => { const y0 = Hh * (0.25 + i * 0.22); return `<path d="M0 ${r2(Hh)} L0 ${r2(y0 + Hh * 0.2)} ${Array.from({ length: 5 }, (_, k) => `Q${r2(W * (k * 0.2 + 0.1))} ${r2(y0 - (k % 2 ? 0 : Hh * 0.12))} ${r2(W * (k + 1) * 0.2)} ${r2(y0 + Hh * 0.12)}`).join(' ')} L${r2(W)} ${r2(Hh)}Z" fill="${c}"/>`; }).join('')),
    arch: (W, Hh, fill = '#FFFDF7', stroke = '#E7B84B') => { const r = W / 2; return svg(`0 0 ${r2(W)} ${r2(Hh)}`, `<path d="M${r2(W * 0.01)} ${r2(Hh * 0.99)} L${r2(W * 0.01)} ${r2(r)} A${r2(r * 0.99)} ${r2(r * 0.99)} 0 0 1 ${r2(W * 0.99)} ${r2(r)} L${r2(W * 0.99)} ${r2(Hh * 0.99)}Z" fill="${fill}" stroke="${stroke}" stroke-width="${r2(W * 0.008)}"/><path d="M${r2(W * 0.05)} ${r2(Hh * 0.97)} L${r2(W * 0.05)} ${r2(r)} A${r2(r * 0.9)} ${r2(r * 0.9)} 0 0 1 ${r2(W * 0.95)} ${r2(r)} L${r2(W * 0.95)} ${r2(Hh * 0.97)}" fill="none" stroke="${stroke}" stroke-opacity=".5" stroke-width="${r2(W * 0.003)}"/>`); },
    stars: (W, Hh, c = '#FFF3C4', n = 26) => { let s = 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280; return svg(`0 0 ${r2(W)} ${r2(Hh)}`, Array.from({ length: n }, () => `<circle cx="${r2(rnd() * W)}" cy="${r2(rnd() * Hh)}" r="${r2((0.4 + rnd() * 0.9) * Math.min(W, Hh) / 160)}" fill="${c}" opacity="${r2(0.4 + rnd() * 0.6)}"/>`).join('')); },
    dots: (W, Hh, c = '#000000', o = 0.06) => { const g = Math.min(W, Hh) / 14; let d = ''; for (let y = g / 2; y < Hh; y += g) for (let x = ((y / g) % 2 ? g : g / 2); x < W; x += g) d += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(g * 0.09)}"/>`; return svg(`0 0 ${r2(W)} ${r2(Hh)}`, `<g fill="${c}" opacity="${o}">${d}</g>`); },
  };
  const FLAG = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/third_party/region-flags/waved-svg/emoji_u1f1f0_1f1f7.svg'; // 태극기
  const ZODIAC = ['1f400', '1f402', '1f405', '1f407', '1f409', '1f40d', '1f40e', '1f411', '1f412', '1f413', '1f415', '1f416']; // 자축인묘진사오미신유술해
  const zodiac = y => EMO(ZODIAC[((y - 4) % 12 + 12) % 12]);
  const GANJI = y => '갑을병정무기경신임계'[((y - 4) % 10 + 10) % 10] + '자축인묘진사오미신유술해'[((y - 4) % 12 + 12) % 12] + '년';

  /* ===== 휴일 날짜 (calendar.js 자동 계산: 대체 휴일 포함) ===== */
  const DOW = '일월화수목금토';
  const lum = c => { const n = parseInt(String(c).slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 255000; };
  // 바탕색에 맞는 로고판: 밝은 바탕 = 원래 색, 어두운·중간 바탕 = 흰색(빨간 점 유지), 빨강·주황 계열 바탕 = 전부 흰색
  const redish = c => { const n = parseInt(String(c).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return r > 140 && r > g * 1.35 && r > b * 1.25; };
  function logoFor(base, bg) { if (!/^#[0-9a-f]{6}$/i.test(bg || '')) return 'asset:' + base; const L_ = lum(bg); if (L_ < 0.62) return 'asset:' + base + (redish(bg) ? '-mono' : '-white'); return 'asset:' + base; }
  NC.logoFor = logoFor; NC.lum = lum;
  const onColor = (bg, a, b) => Math.abs(lum(bg) - lum(a)) >= 0.35 ? a : b; // 바탕 위에서 잘 보이는 쪽 색
  function upcoming(names) {
    const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let y = now.getFullYear(); y <= now.getFullYear() + 2; y++) {
      if (!NC.cal || !NC.cal.canAuto(y)) continue;
      const list = NC.cal.autoHolidays(y); let days = [...new Set(list.filter(h => names.includes(h.name)).map(h => h.date))].sort();
      if (!days.length) continue;
      const last = () => new Date(days[days.length - 1] + 'T00:00');
      list.filter(h => h.name === '대체 휴일').forEach(h => { const dd = (new Date(h.date + 'T00:00') - last()) / 864e5; if (dd >= 1 && dd <= 3 && !days.includes(h.date)) days.push(h.date); });
      days = days.sort().map(s => new Date(s + 'T00:00'));
      if (days[days.length - 1] >= today) { let r = new Date(days[days.length - 1]); do { r.setDate(r.getDate() + 1); } while (r.getDay() === 0 || r.getDay() === 6); return { year: y, days, resume: r }; }
    }
    return null;
  }
  const md = d => `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW[d.getDay()]})`;

  /* ===== 휴일 정의: 이름·문구·그림·색 ===== */
  const PAL = {
    navy: { bg: '#0E2347', ink: '#FFF6E0', sub: '#D9DFEC', ac: '#F2C14E', chip: '#FFFFFF', chipInk: '#0E2347', soft: '#1C3666' },
    beige: { bg: '#F6EFE3', ink: '#3A2E26', sub: '#7A6A5B', ac: '#B82837', chip: '#FFFFFF', chipInk: '#3A2E26', soft: '#EADFCB' },
    cream: { bg: '#FFF8EC', ink: '#2B2B2B', sub: '#6B6B6B', ac: '#D94B5C', chip: '#FFFFFF', chipInk: '#2B2B2B', soft: '#F4E6CF' },
  };
  const HOL = [
    { key: '신정', names: ['신정'], month: 1, season: '겨울', title: '새해 휴관 안내', greet: y => `${y}년 새해 복 많이 받으세요`, note: '새해에도 바른 인성, 건강한 몸으로 함께하겠습니다.', type: y => String(y), eyebrow: 'HAPPY NEW YEAR',
      art: y => [ART.sun('#F27A3A', '#FFC98A'), zodiac(y), ART.cloud('#FFFFFF')], pals: [{ bg: '#FFF4E8', ink: '#2B2B2B', sub: '#7A6655', ac: '#E8603C', chip: '#FFFFFF', chipInk: '#2B2B2B', soft: '#FBE0C8' }, PAL.navy, { bg: '#E9F1FB', ink: '#16305C', sub: '#4E6488', ac: '#E8603C', chip: '#FFFFFF', chipInk: '#16305C', soft: '#CFE0F4' }], fonts: ['GMarketSans', 'YeogiOttaeJalnan', 'Paperozi'] },
    { key: '설날', names: ['설날', '설날 연휴'], month: 2, season: '겨울', myeongjeol: true, title: '설 연휴 휴관 안내', greet: () => '새해 복 많이 받으세요', note: '가족과 함께 따뜻하고 넉넉한 설 명절 보내세요.', type: () => '설', eyebrow: 'SEOLLAL',
      art: y => [ART.pouch(), ART.tteokguk(), zodiac(y), ART.kite()], pals: [PAL.cream, PAL.navy, { bg: '#FBEDEE', ink: '#5A1E2A', sub: '#8A5560', ac: '#B82837', chip: '#FFFFFF', chipInk: '#5A1E2A', soft: '#F4D3D8' }], fonts: ['MaruBuri', 'HannaPro', 'GMarketSans'] },
    { key: '삼일절', names: ['삼일절'], month: 3, season: '봄', title: '삼일절 휴관 안내', greet: () => '그날의 함성을 기억합니다', note: '대한독립 만세! 나라를 위해 일어선 분들께 감사드립니다.', type: () => '3·1', eyebrow: 'INDEPENDENCE MOVEMENT DAY',
      art: () => [FLAG, ART.mugunghwa(), ART.taegeuk()], pals: [PAL.beige, { bg: '#F4F1EA', ink: '#1F2A44', sub: '#5B6478', ac: '#CD2E3A', chip: '#FFFFFF', chipInk: '#1F2A44', soft: '#E3DED2' }, PAL.navy], fonts: ['MaruBuri', 'GMarketSans', 'Paperozi'] },
    { key: '어린이날', names: ['어린이날'], month: 5, season: '봄', title: '어린이날 휴관 안내', greet: () => '세상의 모든 어린이를 응원해요!', note: '가족과 함께 즐겁고 신나는 하루 보내세요.', type: () => '5·5', eyebrow: "CHILDREN'S DAY",
      art: () => [ART.pinwheel(), EMO('1f388'), EMO('1f381')], pals: [{ bg: '#FFF7D6', ink: '#2B2B2B', sub: '#6B6B6B', ac: '#F25F5C', chip: '#FFFFFF', chipInk: '#2B2B2B', soft: '#FFE9A3' }, { bg: '#E3F4FF', ink: '#173B66', sub: '#4E6B8A', ac: '#4D96FF', chip: '#FFFFFF', chipInk: '#173B66', soft: '#C7E6FF' }, { bg: '#E9F8F1', ink: '#1E4A3A', sub: '#4F7564', ac: '#F25F5C', chip: '#FFFFFF', chipInk: '#1E4A3A', soft: '#C9EEDD' }], fonts: ['HannaPro', 'CookieRun', 'YeogiOttaeJalnan'] },
    { key: '부처님오신날', names: ['부처님 오신 날'], month: 5, season: '봄', title: '부처님 오신 날 휴관 안내', greet: () => '자비와 평화가 가득하길 바랍니다', note: '마음이 환해지는 하루 보내세요.', type: () => '蓮', eyebrow: "BUDDHA'S BIRTHDAY",
      art: () => [ART.lantern(), ART.lantern('#F6C343', '#FCE3A0'), ART.lantern('#7DC8A9', '#C7EBDD')], pals: [{ bg: '#FFF5F7', ink: '#4A2733', sub: '#86606B', ac: '#E25D7E', chip: '#FFFFFF', chipInk: '#4A2733', soft: '#FADDE5' }, { bg: '#1D2A4A', ink: '#FFF3DD', sub: '#D5DAE8', ac: '#F6C343', chip: '#FFFFFF', chipInk: '#1D2A4A', soft: '#2B3C63' }, PAL.cream], fonts: ['MaruBuri', 'GMarketSans', 'Paperozi'] },
    { key: '현충일', names: ['현충일'], month: 6, season: '여름', solemn: true, title: '현충일 휴관 안내', greet: () => '나라를 위해 헌신하신 분들을 기억합니다', note: '오전 10시 사이렌에 맞춰 1분간 묵념에 함께해 주세요.', type: () => '6·6', eyebrow: 'MEMORIAL DAY',
      art: () => [ART.chrysanthemum(), ART.mugunghwa('#C9CDD6', '#6B7280'), FLAG], pals: [{ bg: '#F3F4F6', ink: '#1F2937', sub: '#5B6472', ac: '#374151', chip: '#FFFFFF', chipInk: '#1F2937', soft: '#E1E4EA' }, { bg: '#1F2937', ink: '#F3F4F6', sub: '#C7CBD3', ac: '#E5E7EB', chip: '#FFFFFF', chipInk: '#1F2937', soft: '#2E3A4D' }, { bg: '#F7F5F0', ink: '#22304A', sub: '#5E6676', ac: '#22304A', chip: '#FFFFFF', chipInk: '#22304A', soft: '#E6E1D6' }], fonts: ['MaruBuri', 'Pretendard', 'MaruBuri'] },
    { key: '제헌절', names: ['제헌절'], month: 7, season: '여름', title: '제헌절 휴관 안내', greet: () => '대한민국 헌법이 만들어진 날입니다', note: '모두가 함께 지키는 약속, 법을 소중히 여기는 하루 되세요.', type: () => '7·17', eyebrow: 'CONSTITUTION DAY',
      art: () => [ART.book(), ART.taegeuk(), ART.mugunghwa()], pals: [{ bg: '#EEF4FB', ink: '#16305C', sub: '#4E6488', ac: '#0F4C9C', chip: '#FFFFFF', chipInk: '#16305C', soft: '#D6E4F5' }, PAL.beige, PAL.navy], fonts: ['GMarketSans', 'MaruBuri', 'Paperozi'] },
    { key: '광복절', names: ['광복절'], month: 8, season: '여름', title: '광복절 휴관 안내', greet: () => '빛을 되찾은 날, 그 기쁨을 기억합니다', note: '자유와 독립을 위해 힘쓴 분들께 감사드립니다.', type: () => '8·15', eyebrow: 'LIBERATION DAY',
      art: () => [FLAG, ART.mugunghwa(), ART.sun('#F6C343', '#FFE9A8')], pals: [{ bg: '#FFFFFF', ink: '#1F2A44', sub: '#5B6478', ac: '#CD2E3A', chip: '#F4F6FA', chipInk: '#1F2A44', soft: '#E9EDF5' }, { bg: '#0F4C9C', ink: '#FFFFFF', sub: '#D6E2F5', ac: '#F6C343', chip: '#FFFFFF', chipInk: '#0F4C9C', soft: '#2A64B0' }, PAL.beige], fonts: ['GMarketSans', 'MaruBuri', 'YeogiOttaeJalnan'] },
    { key: '추석', names: ['추석', '추석 연휴'], month: 9, season: '가을', myeongjeol: true, title: '추석 연휴 휴관 안내', greet: () => '풍성하고 행복한 한가위 보내세요', note: '보름달처럼 넉넉하고 따뜻한 명절 되세요.', type: () => '秋', eyebrow: 'CHUSEOK',
      art: () => [ART.moon(), ART.songpyeon(), EMO('1f407'), ART.persimmon()], pals: [PAL.navy, PAL.beige, { bg: '#FFF1E2', ink: '#4A2C1A', sub: '#8A6450', ac: '#E06A2C', chip: '#FFFFFF', chipInk: '#4A2C1A', soft: '#F8D9BD' }], fonts: ['MaruBuri', 'HannaPro', 'GMarketSans'] },
    { key: '개천절', names: ['개천절'], month: 10, season: '가을', title: '개천절 휴관 안내', greet: () => '하늘이 열린 날, 홍익인간의 뜻을 새깁니다', note: '널리 사람을 이롭게 하는 태권도인이 되겠습니다.', type: () => '10·3', eyebrow: 'NATIONAL FOUNDATION DAY',
      art: () => [ART.sun('#F27A3A', '#FFC98A'), ART.cloud('#FFFFFF'), ART.taegeuk()], pals: [{ bg: '#EAF3FB', ink: '#173B66', sub: '#4E6B8A', ac: '#E8603C', chip: '#FFFFFF', chipInk: '#173B66', soft: '#CFE3F5' }, PAL.navy, PAL.beige], fonts: ['GMarketSans', 'MaruBuri', 'Paperozi'] },
    { key: '한글날', names: ['한글날'], month: 10, season: '가을', title: '한글날 휴관 안내', greet: () => '세상에서 가장 아름다운 글자, 한글', note: '바르고 고운 우리말을 함께 써요.', type: () => 'ㄱㄴㄷ', eyebrow: 'HANGEUL DAY',
      art: () => [EMO('1f58c'), ART.book('#B82837'), EMO('270f')], pals: [PAL.beige, { bg: '#FFFFFF', ink: '#111111', sub: '#555555', ac: '#B82837', chip: '#F3F3F3', chipInk: '#111111', soft: '#ECECEC' }, PAL.navy], fonts: ['MaruBuri', 'GMarketSans', 'Euljiro'] },
    { key: '크리스마스', names: ['크리스마스'], month: 12, season: '겨울', title: '성탄절 휴관 안내', greet: () => '메리 크리스마스! 따뜻한 성탄절 보내세요', note: '사랑과 기쁨이 가득한 연말 되세요.', type: () => 'XMAS', eyebrow: 'MERRY CHRISTMAS',
      art: () => [EMO('1f384'), EMO('1f381'), ART.snowflake('#FFFFFF'), EMO('2b50')], pals: [{ bg: '#1E4A3A', ink: '#FFF6E8', sub: '#D3E2DA', ac: '#E7B84B', chip: '#FFFFFF', chipInk: '#1E4A3A', soft: '#2B5E4B' }, { bg: '#FFF7F2', ink: '#5A1E2A', sub: '#8A5560', ac: '#C8323F', chip: '#FFFFFF', chipInk: '#5A1E2A', soft: '#F6DCD8' }, { bg: '#B82837', ink: '#FFFFFF', sub: '#F6D6D9', ac: '#F2C14E', chip: '#FFFFFF', chipInk: '#B82837', soft: '#A01F2D' }], fonts: ['YeogiOttaeJalnan', 'HannaPro', 'GMarketSans'] },
    { key: '임시공휴일', names: [], month: 0, season: '사계절', title: '임시공휴일 휴관 안내', greet: () => '정부 지정 임시공휴일에 쉬어 갑니다', note: '편안한 휴일 보내세요.', type: () => 'OFF', eyebrow: 'HOLIDAY NOTICE',
      art: () => [ART.calendarIcon(), EMO('1f33f'), ART.cloud('#FFFFFF')], pals: [PAL.beige, { bg: '#EEF4FB', ink: '#16305C', sub: '#4E6488', ac: '#B82837', chip: '#FFFFFF', chipInk: '#16305C', soft: '#D6E4F5' }, PAL.navy], fonts: ['GMarketSans', 'Paperozi', 'HannaPro'] },
  ];

  /* ===== 글자 크기 어림 (줄 수 계산) ===== */
  const emW = ch => /[ㄱ-힣一-鿿]/.test(ch) ? 0.96 : /[A-Z0-9]/.test(ch) ? 0.66 : ch === ' ' ? 0.3 : 0.55;
  const textW = (t, mm) => [...t].reduce((a, ch) => a + emW(ch), 0) * mm;
  const pt = mm => r2(mm / 0.3528); // 글자 높이(mm) → pt
  const weightOf = f => ({ GMarketSans: 700, MaruBuri: 700, Paperozi: 800, HannaPro: 400, YeogiOttaeJalnan: 400, CookieRun: 700, Euljiro: 400, Pretendard: 700 })[f] || 700;

  /* ===== 레이아웃 엔진 ===== */
  // o: { hol, style, pal, fontT, art[] }, 크기 w·h(mm)
  function compose(uid, o, w, h, screen) {
    const { T, I, S, P } = H(uid); const hol = o.hol, p = o.pal, els = [];
    const wide = w / h > 1.7, tall = h / w > 1.15;
    const u = wide ? h / 62 : Math.min(w, h) / 100; // 기준 단위(mm)
    const info = hol.names.length ? upcoming(hol.names) : null; const year = info ? info.year : new Date().getFullYear() + (new Date().getMonth() > 9 ? 1 : 0);
    const fT = o.fontT, fB = 'Pretendard', dark = /^#(0|1|2)/.test(p.bg) || ['#B82837', '#0F4C9C', '#1E4A3A', '#1F2937'].includes(p.bg);
    const k = screen ? 1.08 : 1; // 휴대폰 화면용은 조금 크게
    // --- 배경 장식 (스타일별) ---
    let box = { x: w * 0.08, y: h * 0.08, w: w * 0.84, h: h * 0.84 }; let art = null; let artBox = null;
    const A = (i) => o.art[i % o.art.length];
    if (o.style === 'paper') {
      els.push(I(ART.dots(w, h, dark ? '#FFFFFF' : '#000000', 0.05), 0, 0, w, h, { fit: 'fill', name: '배경 무늬', locked: true }));
      els.push(S('rect', 3.2 * u, 3.2 * u, w - 6.4 * u, h - 6.4 * u, { fill: '', stroke: p.ac, strokeW: r2(0.35 * u), radius: r2(1.6 * u), name: '테두리' }));
      art = A(0); box = { x: w * 0.1, y: h * 0.07, w: w * 0.8, h: h * 0.86 };
      els.push(I(A(1), w - 15 * u, h - 15 * u, 10 * u, 10 * u, { name: '장식', opacity: 0.9 }));
    } else if (o.style === 'night') {
      if (dark) els.push(I(ART.stars(w, h * 0.7, '#FFF3C4'), 0, 0, w, h * 0.7, { fit: 'fill', name: '별', locked: true }));
      else { [p.ac, p.soft, '#4D96FF', '#3BCEAC', '#FFD23F'].forEach((c, i) => els.push(I(ART.stars(w, h * 0.75, c, 9), 0, 0, w, h * 0.75, { fit: 'fill', name: '색종이', locked: true, rot: i * 7 }))); }
      const mS = wide ? h * 0.62 : Math.min(w, h) * 0.5; els.push(I(hol.key === '추석' || hol.key === '설날' ? ART.moon() : A(0), wide ? w * 0.72 : w - mS * 0.78, wide ? h * 0.06 : -mS * 0.12, mS, mS, { name: '달' }));
      const rh = Math.max(9 * u, h * 0.1); if (dark) els.push(I(ART.roof(w, rh, '#0A1A36', '#14284D'), 0, h - rh, w, rh, { fit: 'fill', name: '기와 지붕' })); else els.push(I(ART.mountains(w, rh * 1.3, [p.soft, p.ac + 'AA', p.ac]), 0, h - rh * 1.3, w, rh * 1.3, { fit: 'fill', name: '언덕' }));
      box = wide ? { x: w * 0.06, y: h * 0.08, w: w * 0.6, h: h * 0.74 } : { x: w * 0.08, y: h * (tall ? 0.3 : 0.24), w: w * 0.84, h: h - rh - h * (tall ? 0.31 : 0.25) };
      art = hol.key === '추석' || hol.key === '설날' ? A(1) : null;
    } else if (o.style === 'arch') {
      const aw = wide ? h * 0.82 : w * 0.74, ah = wide ? h * 0.9 : h * 0.84, ax = wide ? w * 0.5 - aw / 2 : (w - aw) / 2, ay = wide ? h * 0.05 : h * 0.1;
      els.push(I(ART.arch(aw, ah, dark ? '#FFF8EA' : '#FFFFFF', p.ac), ax, ay, aw, ah, { fit: 'fill', name: '아치 액자' }));
      els.push(I(A(1), wide ? ax - 22 * u : 3 * u, h - 22 * u, 18 * u, 18 * u, { name: '장식' }));
      els.push(I(A(2), wide ? ax + aw + 4 * u : w - 17 * u, wide ? 4 * u : 3 * u, 14 * u, 14 * u, { name: '장식' }));
      art = A(0); box = { x: ax + aw * 0.1, y: ay + aw * 0.14, w: aw * 0.8, h: ah - aw * 0.16 }; o = Object.assign({}, o, { pal: Object.assign({}, p, { ink: '#2B2B2B', sub: '#6B6B6B', chip: '#F6F1E8', chipInk: '#2B2B2B' }) });
    } else if (o.style === 'calendar') {
      const bh = wide ? h : h * (tall ? 0.3 : 0.34), bw = wide ? w * 0.36 : w;
      els.push(S('rect', 0, 0, bw, bh, { fill: p.ac, name: '머리 띠' }));
      els.push(I(A(0), wide ? bw * 0.25 : w - bh * 0.95, wide ? h * 0.42 : bh * 0.12, wide ? bw * 0.5 : bh * 0.8, wide ? bw * 0.5 : bh * 0.8, { name: '그림', opacity: 0.95 }));
      const lgH = Math.min(6.5 * u, bh * 0.16), lgY = wide ? 6 * u : bh * 0.12; els.push(I(logoFor('brand-horizontal', p.ac), wide ? 6 * u : 7 * u, lgY, lgH * 5.19, lgH, { name: '로고', pos: '0% 50%' }));
      els.push(T(hol.eyebrow, wide ? 6 * u : 7 * u, lgY + lgH + 2.4 * u, wide ? bw - 12 * u : w * 0.6, 4 * u, { font: 'Montserrat', size: pt(2 * u), weight: 700, color: onColor(p.ac, '#FFFFFF', '#1F2430'), ls: 0.18, align: 'left', opacity: 0.85 }));
      els.push(T(String(year), wide ? 6 * u : 7 * u, lgY + lgH + 6.6 * u, wide ? bw - 12 * u : w * 0.6, 10 * u, { font: 'Montserrat', size: pt(7.5 * u), weight: 800, color: onColor(p.ac, '#FFFFFF', '#1F2430'), align: 'left', lh: 1, name: '연도' }));
      box = wide ? { x: bw + w * 0.04, y: h * 0.08, w: w - bw - w * 0.08, h: h * 0.84 } : { x: w * 0.08, y: bh + h * 0.04, w: w * 0.84, h: h - bh - h * 0.06 };
      o = Object.assign({}, o, { pal: Object.assign({}, p, { ink: '#1F2430', sub: '#5B6472', chip: '#F3F4F7', chipInk: '#1F2430' }), noEyebrow: true, noLogo: true }); els.unshift(S('rect', 0, 0, w, h, { fill: '#FFFFFF', name: '바탕', locked: true }));
    } else if (o.style === 'type') {
      const word = hol.type(year); const latin = /^[A-Z0-9·.]+$/.test(word); const big = Math.min(w * 0.92 / Math.max(1, textW(word, 1) * (latin ? 1.3 : 1.05)), h * 0.5); // 영문 굵은 대문자는 더 넓게 어림 (한 줄 유지)
      els.push(T(word, -w * 0.02, wide ? -h * 0.06 : -h * 0.02, w * 1.6, big * 1.2, { font: fT === 'MaruBuri' ? 'MaruBuri' : 'GMarketSans', size: pt(big), weight: 700, color: dark ? '#FFFFFF' : p.ac, opacity: dark ? 0.14 : 0.16, align: 'left', lh: 1, name: '큰 글자' }));
      const cw = wide ? w * 0.56 : w * 0.84, ch = wide ? h * 0.8 : h * 0.6, cx = wide ? w * 0.4 : (w - cw) / 2, cy = wide ? h * 0.1 : h - ch - h * 0.07;
      els.push(S('rect', cx, cy, cw, ch, { fill: '#FFFFFF', radius: r2(2.4 * u), name: '안내 상자', shadow: true }));
      els.push(I(A(0), wide ? w * 0.06 : w - 26 * u, wide ? h * 0.42 : cy - 20 * u, wide ? w * 0.26 : 22 * u, wide ? w * 0.26 : 22 * u, { name: '그림' }));
      box = { x: cx + cw * 0.08, y: cy + ch * 0.07, w: cw * 0.84, h: ch * 0.86 }; o = Object.assign({}, o, { pal: Object.assign({}, p, { ink: '#1F2430', sub: '#5B6472', chip: '#F3F4F7', chipInk: '#1F2430' }) });
    } else if (o.style === 'saekdong') {
      const sh = Math.max(5 * u, h * 0.06); els.push(I(ART.saekdong(w, sh), 0, 0, w, sh, { fit: 'fill', name: '색동' })); els.push(I(ART.saekdong(w, sh), 0, h - sh, w, sh, { fit: 'fill', name: '색동', flipV: true }));
      art = A(0); box = { x: w * 0.1, y: sh + h * 0.05, w: w * 0.8, h: h - 2 * sh - h * 0.1 };
      els.push(I(A(2), w - 16 * u, sh + 3 * u, 12 * u, 12 * u, { name: '장식' })); els.push(I(A(1), 4 * u, h - sh - 15 * u, 12 * u, 12 * u, { name: '장식' }));
    } else if (o.style === 'greet') { // 명절 인사 카드: 둘레에 작은 그림을 두르고 가운데 인사말을 크게
      const n = wide ? 9 : 5, s = Math.min(w, h) / (wide ? 6 : 8);
      for (let i = 0; i < n; i++) { els.push(I(A(i), i * (w - s) / (n - 1), 2 * u, s, s, { name: '장식', opacity: 0.95 })); els.push(I(A(i + 1), i * (w - s) / (n - 1), h - s - 2 * u, s, s, { name: '장식', opacity: 0.95 })); }
      box = { x: w * 0.1, y: s + 5 * u, w: w * 0.8, h: h - 2 * s - 10 * u }; o = Object.assign({}, o, { bigGreet: true });
    }
    const pal = o.pal; const contentBg = ['arch', 'calendar', 'type'].includes(o.style) ? '#FFFFFF' : pal.bg;
    // --- 내용 쌓기 (위에서 아래로, 상자 안에서 세로 가운데). z: 상자를 알맞게 채우는 배율 ---
    const cw = box.w; let items;
    const build = z => { items = []; const kz = k * z;
    const add = (hh, make) => items.push({ hh, make });
    // 먼저 한 줄에 맞춰 보고(72%까지 줄임), 안 되면 여러 줄로 (한 낱말만 다음 줄로 넘어가는 모양을 피함)
    const fitSize = (text, maxMM, wBox, lines) => { let m = maxMM; while (m > maxMM * 0.72 && textW(text, m) > wBox) m *= 0.96; if (textW(text, m) <= wBox) return m; m = maxMM; while (m > maxMM * 0.45 && Math.ceil(textW(text, m) / wBox) > lines) m *= 0.94; return m; };
    if (art) { const as = Math.min(box.h * (wide ? 0.5 : 0.27), cw * 0.45, 40 * u) * Math.min(1.25, z); add(as + 1.5 * u, (x, y) => els.push(I(art, x + (cw - as) / 2, y, as, as, { name: '그림' }))); artBox = as; }
    if (!o.noEyebrow) add(4.6 * u * z, (x, y) => els.push(T(`${hol.eyebrow}${hol.key === '신정' || hol.key === '설날' ? ' · ' + GANJI(year) : ''}`, x, y, cw, 3.4 * u, { font: 'Montserrat', size: pt(2 * u * kz), weight: 700, color: onColor(contentBg, pal.ac, pal.ink), ls: 0.2, name: '영문 머리말' })));
    const greetFirst = !!o.bigGreet; const mainT = greetFirst ? hol.greet(year) : hol.title, subT = greetFirst ? hol.title : hol.greet(year);
    const tMM = fitSize(mainT, (greetFirst ? 6.6 : 6.4) * u * kz, cw, 2), tLines = Math.ceil(textW(mainT, tMM) / cw);
    add(tMM * 1.18 * tLines + 1.6 * u, (x, y) => els.push(T(mainT, x, y, cw, tMM * 1.18 * tLines + 1, { font: o.fontT, size: pt(tMM), weight: weightOf(o.fontT), color: pal.ink, lh: 1.12, name: '제목' })));
    const gMM = fitSize(subT, 2.9 * u * kz, cw, 2), gLines = Math.ceil(textW(subT, gMM) / cw);
    add(gMM * 1.4 * gLines + 3 * u, (x, y) => els.push(T(subT, x, y, cw, gMM * 1.4 * gLines + 1, { font: fB, size: pt(gMM), weight: 500, color: pal.sub, lh: 1.35, name: '인사말' })));
    // 날짜 칩
    const days = info ? info.days.slice(0, 5) : null; const chipsN = days ? days.length + 1 : 3;
    const gap = 1.6 * u, chW = Math.min((cw - gap * (chipsN - 1)) / chipsN, 20 * u * kz), chH = chW * 1.12;
    add(chH + 3.4 * u, (x, y) => {
      const x0 = x + (cw - (chW * chipsN + gap * (chipsN - 1))) / 2;
      const list = days ? days.map(d => ({ n: d.getDate(), d: `${d.getMonth() + 1}월 (${DOW[d.getDay()]})`, l: '휴관' })).concat([{ n: info.resume.getDate(), d: `${info.resume.getMonth() + 1}월 (${DOW[info.resume.getDay()]})`, l: '정상 수업', on: true }]) : [{ n: '○', d: '○월 (○)', l: '휴관' }, { n: '○', d: '○월 (○)', l: '휴관' }, { n: '○', d: '○월 (○)', l: '정상 수업', on: true }];
      list.forEach((c, i) => { const cx = x0 + i * (chW + gap);
        els.push(S('rect', cx, y, chW, chH, { fill: c.on ? pal.ac : pal.chip, radius: r2(chW * 0.14), name: '날짜 칸', stroke: c.on ? '' : (dark && o.style !== 'arch' && o.style !== 'calendar' && o.style !== 'type' ? '' : '#E3E5EA'), strokeW: c.on ? 0 : r2(0.12 * u) }));
        const fc = c.on ? (lum(pal.ac) > 0.62 ? '#1F2430' : '#FFFFFF') : pal.chipInk;
        els.push(T(c.d, cx, y + chH * 0.08, chW, chH * 0.2, { font: fB, size: pt(chW * 0.13), weight: 600, color: fc, opacity: 0.8, name: '날짜 칸 요일' }));
        els.push(T(String(c.n), cx, y + chH * 0.26, chW, chH * 0.42, { font: 'Montserrat', size: pt(chW * 0.36), weight: 800, color: fc, lh: 1, name: '날짜 칸 날짜' }));
        els.push(T(c.l, cx, y + chH * 0.72, chW, chH * 0.2, { font: fB, size: pt(chW * (c.l.length > 2 ? 0.12 : 0.14)), weight: 700, color: c.on ? fc : onColor(pal.chip, pal.ac, pal.chipInk), name: '날짜 칸 표시' })); });
    });
    const note = info ? `${md(info.resume)}부터 정상 수업합니다.\n${hol.note}` : `○월 ○일(○)은 휴관합니다.\n${hol.note}`;
    const nMM = 2.15 * u * kz, nLines = note.split('\n').reduce((a, l) => a + Math.ceil(textW(l, nMM) / cw), 0);
    add(nMM * 1.5 * nLines + 3 * u, (x, y) => els.push(T(note, x, y, cw, nMM * 1.5 * nLines + 1, { font: fB, size: pt(nMM), weight: 500, color: pal.sub, lh: 1.5, name: '안내 문구' })));
    if (!o.noLogo) { const lh = Math.min(8.5 * u * z, box.h * 0.12), lw = lh * 1.98; add(lh + 1.2 * u, (x, y) => els.push(I(logoFor('brand-korean', contentBg), x + (cw - lw) / 2, y + 1.2 * u, lw, lh, Object.assign({ name: '로고' }, hol.solemn ? { fx: { sat: 0 }, opacity: 0.85 } : {})))); }
    };
    build(1); let total = items.reduce((a, it) => a + it.hh, 0);
    const z = Math.max(0.7, Math.min(wide ? 2.2 : 1.45, box.h * 0.9 / total)); // 가로 현수막은 글자를 더 크게 if (Math.abs(z - 1) > 0.04) build(z);
    // 넘치면 그림부터 줄이고, 그래도 넘치면 전체를 비율로 줄임
    total = items.reduce((a, it) => a + it.hh, 0);
    if (total > box.h && art) { const cut = Math.min(artBox * 0.6, total - box.h); items[0].hh -= cut; const as2 = artBox - cut; items[0].make = (x, y) => els.push(I(art, x + (cw - as2) / 2, y, as2, as2, { name: '그림' })); total -= cut; }
    let y = box.y + Math.max(0, (box.h - total) / 2); const startIdx = els.length;
    items.forEach(it => { it.make(box.x, y); y += it.hh; });
    if (total > box.h) { const f = box.h / total; els.slice(startIdx).forEach(e => { e.y = box.y + (e.y - box.y) * f; e.h *= f; e.w = e.w; if (e.size) e.size = r2(e.size * f); }); }
    return P(o.pal.bg || p.bg, els, `${hol.key} 휴관`);
  }

  /* ===== 템플릿 등록: 휴일마다 5가지(명절은 7가지) ===== */
  const STYLES = [['paper', '종이 카드'], ['night', '밤하늘'], ['arch', '아치 액자'], ['calendar', '달력 안내'], ['type', '큰 글자']];
  const EXTRA = [['saekdong', '색동'], ['greet', '인사 카드']];
  const W0 = 285.75, H0 = 357.19; // 기본: 인스타그램 4:5 (1080×1350px)
  HOL.forEach(hol => {
    const styles = STYLES.concat(hol.myeongjeol ? EXTRA : []);
    styles.forEach(([st, stName], i) => {
      const pal = hol.pals[st === 'night' ? (hol.pals.findIndex(p => /^#(0|1)/.test(p.bg)) >= 0 ? hol.pals.findIndex(p => /^#(0|1)/.test(p.bg)) : 0) : i % hol.pals.length];
      const o = { hol, style: st, pal, fontT: hol.fonts[i % hol.fonts.length], art: null };
      const tags = { format: 'SNS', season: hol.season, age: '전체', occasion: '휴관', biz: '태권도장' };
      const stLabel = st === 'night' && !/^#(0|1)/.test(pal.bg) ? '풍경' : stName;
      L.push({ id: `hol-${hol.key}-${st}`, cat: 'season', name: `${hol.key === '크리스마스' ? '성탄절' : hol.key} 휴관 카드 · ${stLabel}`, w: W0, h: H0, holiday: hol.key, holMonth: hol.month, responsive: true, tags,
        kw: [hol.key, hol.key === '크리스마스' ? '성탄절 크리스마스' : '', hol.myeongjeol ? '명절 명절인사' : '국경일 공휴일', '휴관 휴무 공지 안내 카드 SNS 인스타', stName, hol.season].join(' '),
        build: (uid, sz) => { const W = sz ? sz.w : W0, Hh = sz ? sz.h : H0, screen = sz ? !!sz.screen : true; const yr = (upcoming(hol.names) || {}).year || new Date().getFullYear(); return [compose(uid, Object.assign({}, o, { art: hol.art(yr) }), W, Hh, screen)]; } });
    });
  });
  // 다가오는 휴일 순서 (갤러리 '다가오는 휴일' 줄에 씀)
  NC.tpl.nextHolidays = () => { const now = new Date(); return HOL.filter(h => h.names.length).map(h => { const u = upcoming(h.names); return { key: h.key, t: u ? u.days[0].getTime() : Infinity }; }).filter(x => x.t >= now.getTime() - 864e5 * 3).sort((a, b) => a.t - b.t).map(x => x.key); };
})();
