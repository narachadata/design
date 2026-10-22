// 요소 라이브러리: 도형·선·아이콘·프레임·배지·표·스마트 블록·장식 (미리캔버스 '요소' 패널 참고)
window.NC = window.NC || {};
NC.elems = (function () {
  const NAVY = '#1E2B5A', YEL = '#FFE89A', RED = '#E0564B', WHITE = '#ffffff', INK = '#1a1a1a', SKY = '#E6EDF2', MINT = '#DDF3EA', GREEN = '#2F5D3A', GRAY = '#F3F4F7';
  const H = (uid) => ({
    T: (text, x, y, w, h, st) => Object.assign({ id: uid(), type: 'text', text, x, y, w, h, rot: 0, font: 'Noto Sans KR', size: 12, weight: 400, italic: false, color: INK, align: 'left', lh: 1.35, ls: 0, strokeW: 0, strokeC: WHITE, shadow: false, shC: '#000000', shA: 0.25, shX: 0.6, shY: 0.7, shB: 0.4, bg: '', pad: 0, opacity: 1, valign: 'top', name: '' }, st),
    I: (ref, x, y, w, h, st) => Object.assign({ id: uid(), type: 'image', src: ref, x, y, w, h, rot: 0, fit: 'contain', pos: '50% 50%', flip: false, radius: 0, opacity: 1, name: '' }, st),
    S: (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'shape', kind, x, y, w, h, rot: 0, fill: NAVY, stroke: '', strokeW: 0, radius: 0, opacity: 1, name: '' }, st),
    Pth: (pts, x, y, w, h, st) => Object.assign({ id: uid(), type: 'path', pts, x, y, w, h, rot: 0, stroke: NAVY, strokeW: 0.8, fill: '', closed: false, smooth: true, opacity: 1, name: '' }, st),
    Ch: (kind, x, y, w, h, st) => Object.assign({ id: uid(), type: 'chart', kind, x, y, w, h, rot: 0, opacity: 1, title: '', data: [{ l: '1월', v: 30 }, { l: '2월', v: 45 }, { l: '3월', v: 60 }, { l: '4월', v: 52 }], colors: [NAVY, RED, YEL, '#4C8A2B', '#6B3FD1', '#2F8D9E'], showVal: true, name: '차트' }, st),
  });
  const items = [];
  const add = (cat, id, name, w, h, make, kw) => items.push({ cat, id, name, w, h, make, kw: kw || '' });
  const D = { logo: 'asset:logo-wordmark', swoosh: 'asset:swoosh', group: 'asset:cover-group', back: 'asset:backcover-logo', target: 'asset:target-icon' };

  /* 일러스트 (내장 그림) */
  const ILLU = [['illu-01-pride', '긍지 펭귄'], ['illu-02-morality', '도덕성 소년'], ['illu-03-consideration', '배려 악수'], ['illu-04-responsibility', '책임감 소년'], ['illu-05-respect', '존경 두 아이'], ['illu-06-humility', '겸손 소녀'], ['illu-07-forgiveness', '용서 포옹'], ['illu-09-justice', '정의 소녀'], ['illu-10-honesty', '정직 펭귄'], ['illu-11-fairness', '공평 저울'], ['illu-12-cooperation', '협동 상자'], ['cover-group', '단체 뒷모습'], ['backcover-logo', '펭귄 로고']];
  ILLU.forEach(([k, n]) => add('illust', 'il-' + k, n, 60, 60, (uid) => { const { I } = H(uid); return [I('asset:' + k, 0, 0, 60, 60, { name: n })]; }, '일러스트 그림 태권도 펭귄'));
  ['01', '03', '04', '05', '07', '08', '09', '11'].forEach(k => add('illust', 'ms-' + k, '마스코트 ' + k, 30, 30, (uid) => { const { I } = H(uid); return [I('asset:mascot-' + k, 0, 0, 30, 30, { name: '마스코트' })]; }, '마스코트 펭귄 발차기'));
  add('illust', 'il-logo', '로고 워드마크', 60, 15, (uid) => { const { I } = H(uid); return [I(D.logo, 0, 0, 60, 15, { name: '로고' })]; }, '로고');
  add('illust', 'il-swoosh', '로고 심벌', 20, 18, (uid) => { const { I } = H(uid); return [I(D.swoosh, 0, 0, 20, 18, { name: '로고' })]; }, '로고');
  add('illust', 'il-target', '과녁 아이콘', 20, 20, (uid) => { const { I } = H(uid); return [I(D.target, 0, 0, 20, 20, { name: '아이콘' })]; }, '아이콘 과녁');

  /* 도형: 종류 × 스타일 */
  const KINDS = [['rect', '사각형'], ['pill', '알약'], ['ellipse', '원'], ['tri', '삼각형'], ['diamond', '마름모'], ['hexagon', '육각형'], ['polygon', '오각형'], ['star', '별'], ['burst', '폭발'], ['heart', '하트'], ['cross', '십자'], ['ring', '고리'], ['bubble', '말풍선'], ['arrow', '화살표'], ['tab', '탭']];
  const STYLES = [['fill', '채움', { fill: NAVY }], ['outline', '윤곽', { fill: '', stroke: NAVY, strokeW: 0.8 }], ['yel', '노랑', { fill: YEL }], ['red', '빨강', { fill: RED }], ['grad', '그라데이션', { fillType: 'gradient', g1: '#2f5bea', g2: '#e0564b', gAngle: 45 }], ['soft', '연한 색', { fill: SKY }]];
  KINDS.forEach(([k, n]) => STYLES.forEach(([sid, sn, st]) => add('shape', `sh-${k}-${sid}`, `${n} · ${sn}`, 40, 40, (uid) => { const { S } = H(uid); const o = Object.assign({ name: n }, st); if (k === 'polygon') o.sides = 5; return [S(k, 0, 0, 40, 40, o)]; }, '도형 ' + n)));

  /* 선 */
  const LINES = [['solid', '실선', {}], ['dash', '점선', { dash: '3 2' }], ['dot', '점점선', { dash: '0.1 2', cap: 'round' }], ['thick', '굵은 선', { strokeW: 2.5 }], ['arrow', '화살표 선', { arrowEnd: true }], ['arrow2', '양방향 화살표', { arrowEnd: true, arrowStart: true }], ['dasharrow', '점선 화살표', { dash: '3 2', arrowEnd: true }], ['red', '빨간 선', { stroke: RED, strokeW: 1.2 }], ['yel', '노란 굵은 선', { stroke: YEL, strokeW: 4 }]];
  LINES.forEach(([id, n, st]) => add('line', 'ln-' + id, n, 60, 6, (uid) => { const { S } = H(uid); return [S('line', 0, 2.5, 60, 1, Object.assign({ fill: NAVY, stroke: NAVY, strokeW: 0.8, name: n }, st))]; }, '선 화살표 구분선'));
  add('line', 'ln-wave', '물결선', 60, 8, (uid) => { const { Pth } = H(uid); const pts = []; for (let i = 0; i <= 12; i++) pts.push([i * 5, 4 + (i % 2 ? 3 : -3)]); return [Pth(pts, 0, 0, 60, 8, { strokeW: 0.8, name: '물결선' })]; }, '물결 장식선');
  add('line', 'ln-zigzag', '지그재그', 60, 8, (uid) => { const { Pth } = H(uid); const pts = []; for (let i = 0; i <= 12; i++) pts.push([i * 5, i % 2 ? 7 : 1]); return [Pth(pts, 0, 0, 60, 8, { strokeW: 0.8, smooth: false, name: '지그재그' })]; }, '지그재그 장식선');
  add('line', 'ln-divider', '구분선 (가운데 점)', 60, 6, (uid) => { const { S } = H(uid); return [S('line', 0, 2.7, 26, 0.6, { fill: '#999', stroke: '#999', strokeW: 0.4 }), S('ellipse', 28.5, 1.5, 3, 3, { fill: RED }), S('line', 34, 2.7, 26, 0.6, { fill: '#999', stroke: '#999', strokeW: 0.4 })]; }, '구분선');
  add('line', 'ln-vert', '세로 선', 6, 60, (uid) => { const { S } = H(uid); return [S('rect', 2.5, 0, 1, 60, { fill: NAVY, name: '세로 선' })]; }, '세로선');

  /* 아이콘 (이모지) — 인쇄 시 그 PC의 컬러 이모지 글꼴 사용 */
  const EMOJI = { '태권도·운동': '🥋🥇🥈🥉🏆🎖️🏅🥊⚽🏀⚾🎯🏃‍♂️🤸‍♀️💪🔥⭐🌟✨', '학교·공부': '📚✏️📝🎒🏫🧑‍🏫👩‍🎓📖🖍️📌📎🔔⏰📅', '축하·행사': '🎉🎊🎈🎂🎁🎀🎵🎶🎤🎬🥳🙌👏💐', '마음·날씨': '❤️💛💙💚🧡💜🌈☀️🌙⛅🌸🍀🌻🍁❄️', '표시·화살표': '✅❌⭕❗❓➡️⬅️⬆️⬇️↗️🔁📍💡✔️➕', '음식·생활': '🍎🥛🍚🍱🚌🏠📞📱💬🕐🧼🩹🧴' };
  Object.entries(EMOJI).forEach(([g, s]) => [...new Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(s) : s].map(x => x.segment || x).forEach((e, i) => add('icon', `em-${g}-${i}`, e, 16, 16, (uid) => { const { T } = H(uid); return [T(e, 0, 0, 16, 16, { size: 34, lh: 1, align: 'center', name: '아이콘 ' + e, font: 'Noto Sans KR' })]; }, '아이콘 이모지 ' + g)));
  /* 번호 배지 */
  for (let i = 1; i <= 10; i++) add('icon', 'num-' + i, '번호 ' + i, 14, 14, (uid) => { const { S, T } = H(uid); return [S('ellipse', 0, 0, 14, 14, { fill: NAVY }), T(String(i), 0, 3, 14, 8, { font: 'Montserrat', size: 16, weight: 800, color: YEL, align: 'center', lh: 1 })]; }, '번호 숫자 배지');
  ['①', '②', '③', '④', '⑤', 'A', 'B', 'C', 'D', 'E'].forEach((c, i) => add('icon', 'ltr-' + i, c, 12, 12, (uid) => { const { T } = H(uid); return [T(c, 0, 0, 12, 12, { size: 24, weight: 800, color: NAVY, align: 'center', lh: 1, font: 'Montserrat' })]; }, '번호 문자'));

  /* 프레임 (사진 틀) */
  add('frame', 'fr-polaroid', '폴라로이드', 50, 60, (uid) => { const { S, I, T } = H(uid); return [S('rect', 0, 0, 50, 60, { fill: WHITE, stroke: '#DDD', strokeW: 0.3, shadow: true }), I(D.group, 3, 3, 44, 44, { fit: 'cover', name: '사진 (바꿔 넣기)' }), T('2027. 3. 15', 3, 50, 44, 6, { font: 'Nanum Pen Script', size: 12, align: 'center', color: '#444' })]; }, '프레임 사진 폴라로이드');
  add('frame', 'fr-circle', '원형 프레임', 50, 50, (uid) => { const { S, I } = H(uid); return [S('ellipse', 0, 0, 50, 50, { fill: YEL }), I(D.group, 2.5, 2.5, 45, 45, { fit: 'cover', clip: 'circle', name: '사진 (바꿔 넣기)' })]; }, '프레임 원형');
  add('frame', 'fr-rounded', '둥근 테두리', 60, 45, (uid) => { const { I } = H(uid); return [I(D.group, 0, 0, 60, 45, { fit: 'cover', radius: 4, border: NAVY, borderW: 1.2, name: '사진 (바꿔 넣기)' })]; }, '프레임 둥근');
  add('frame', 'fr-hex', '육각 프레임', 50, 50, (uid) => { const { S, I } = H(uid); return [S('hexagon', 0, 0, 50, 50, { fill: NAVY }), I(D.group, 2, 2, 46, 46, { fit: 'cover', clip: 'hexagon', name: '사진 (바꿔 넣기)' })]; }, '프레임 육각');
  add('frame', 'fr-heart', '하트 프레임', 50, 50, (uid) => { const { I } = H(uid); return [I(D.group, 0, 0, 50, 50, { fit: 'cover', clip: 'heart', name: '사진 (바꿔 넣기)' })]; }, '프레임 하트');
  add('frame', 'fr-film', '필름 프레임', 70, 40, (uid) => { const { S, I } = H(uid); const els = [S('rect', 0, 0, 70, 40, { fill: '#222' })]; for (let i = 0; i < 9; i++) { els.push(S('rect', 3 + i * 7.5, 1.5, 4, 3, { fill: WHITE, radius: 0.5 })); els.push(S('rect', 3 + i * 7.5, 35.5, 4, 3, { fill: WHITE, radius: 0.5 })); } els.push(I(D.group, 4, 6, 62, 28, { fit: 'cover', name: '사진 (바꿔 넣기)' })); return els; }, '프레임 필름');

  /* 배지·라벨 (묶음) */
  add('badge', 'bd-ribbon', '리본 배너', 70, 16, (uid) => { const { S, T } = H(uid); return [S('rect', 0, 4, 8, 12, { fill: '#B8432B' }), S('rect', 62, 4, 8, 12, { fill: '#B8432B' }), S('rect', 5, 0, 60, 14, { fill: RED }), T('이달의 인성', 5, 3, 60, 8, { size: 13, weight: 700, color: WHITE, align: 'center' })]; }, '배지 리본 띠');
  add('badge', 'bd-burst', '할인·강조 배지', 36, 36, (uid) => { const { S, T } = H(uid); return [S('burst', 0, 0, 36, 36, { fill: RED, points: 14, inner: 0.8 }), T('무료\n체험', 4, 10, 28, 16, { size: 13, weight: 800, color: WHITE, align: 'center', lh: 1.1 })]; }, '배지 폭발 강조');
  add('badge', 'bd-new', 'NEW 알약', 22, 9, (uid) => { const { S, T } = H(uid); return [S('pill', 0, 0, 22, 9, { fill: RED }), T('NEW', 0, 1.8, 22, 6, { font: 'Montserrat', size: 10, weight: 800, color: WHITE, align: 'center' })]; }, '배지 new');
  add('badge', 'bd-hot', 'HOT 알약', 22, 9, (uid) => { const { S, T } = H(uid); return [S('pill', 0, 0, 22, 9, { fill: YEL }), T('HOT', 0, 1.8, 22, 6, { font: 'Montserrat', size: 10, weight: 800, color: NAVY, align: 'center' })]; }, '배지 hot');
  add('badge', 'bd-tag', '라벨 태그', 34, 12, (uid) => { const { S, T } = H(uid); return [S('tab', 0, 0, 34, 12, { fill: NAVY, rot: -90 }), S('rect', 4, 0, 30, 12, { fill: NAVY, radius: 1 }), S('ellipse', 1.5, 4.5, 3, 3, { fill: WHITE }), T('초등부', 6, 2.8, 26, 7, { size: 10, weight: 700, color: WHITE, align: 'center' })]; }, '라벨 태그');
  add('badge', 'bd-bubble', '말풍선 + 글', 50, 34, (uid) => { const { S, T } = H(uid); return [S('bubble', 0, 0, 50, 34, { fill: YEL }), T('태권!', 4, 7, 42, 14, { font: 'Jua', size: 18, color: NAVY, align: 'center' })]; }, '말풍선');
  add('badge', 'bd-medal', '메달', 24, 34, (uid) => { const { S, T } = H(uid); return [S('rect', 8, 0, 8, 16, { fill: RED }), S('ellipse', 1, 12, 22, 22, { fill: '#F2C94C', stroke: '#B8860B', strokeW: 0.8 }), T('1', 1, 18, 22, 10, { font: 'Montserrat', size: 18, weight: 800, color: '#7A5A00', align: 'center', lh: 1 })]; }, '메달 1등');
  add('badge', 'bd-check', '체크 항목', 50, 8, (uid) => { const { S, T } = H(uid); return [S('rect', 0, 0.5, 7, 7, { fill: WHITE, stroke: NAVY, strokeW: 0.5, radius: 1 }), T('✓', 0, 0.5, 7, 7, { size: 11, weight: 800, color: NAVY, align: 'center', lh: 1 }), T('실천 항목', 10, 1, 40, 7, { size: 11, weight: 500 })]; }, '체크 항목');
  add('badge', 'bd-date', '날짜 배지', 26, 26, (uid) => { const { S, T } = H(uid); return [S('rect', 0, 0, 26, 26, { fill: WHITE, stroke: NAVY, strokeW: 0.6, radius: 2 }), S('rect', 0, 0, 26, 8, { fill: NAVY, radius: 2 }), T('3월', 0, 1.5, 26, 6, { size: 9, weight: 700, color: WHITE, align: 'center' }), T('15', 0, 10, 26, 14, { font: 'Montserrat', size: 24, weight: 800, color: NAVY, align: 'center', lh: 1 })]; }, '날짜 배지 캘린더');
  add('badge', 'bd-quote', '인용 따옴표', 20, 20, (uid) => { const { T } = H(uid); return [T('“', 0, 0, 20, 20, { font: 'Gowun Batang', size: 70, weight: 700, color: YEL, lh: 1 })]; }, '따옴표 인용');

  /* 표·목록 */
  add('table', 'tb-3x4', '표 3×4', 90, 40, (uid, ctx) => mkTable(uid, ctx && ctx.rows || 4, ctx && ctx.cols || 3), '표 테이블');
  add('table', 'tb-2x6', '표 2×6', 80, 60, (uid) => mkTable(uid, 6, 2), '표 테이블');
  add('table', 'tb-schedule', '시간표 6×5', 120, 70, (uid) => mkTable(uid, 5, 6, ['시간', '월', '화', '수', '목', '금']), '시간표');
  add('table', 'tb-check', '체크리스트 5항목', 60, 46, (uid) => { const { S, T } = H(uid); const els = []; for (let i = 0; i < 5; i++) { els.push(S('rect', 0, i * 9 + 1, 6, 6, { fill: WHITE, stroke: NAVY, strokeW: 0.5, radius: 1 })); els.push(T('항목 ' + (i + 1), 9, i * 9 + 0.8, 50, 7, { size: 10.5, weight: 500 })); } return els; }, '체크리스트 목록');
  add('table', 'tb-numbered', '번호 목록', 60, 46, (uid) => { const { S, T } = H(uid); const els = []; for (let i = 0; i < 5; i++) { els.push(S('ellipse', 0, i * 9 + 0.5, 7, 7, { fill: NAVY })); els.push(T(String(i + 1), 0, i * 9 + 2, 7, 5, { font: 'Montserrat', size: 9, weight: 800, color: YEL, align: 'center', lh: 1 })); els.push(T('내용 ' + (i + 1), 10, i * 9 + 0.8, 50, 7, { size: 10.5, weight: 500 })); } return els; }, '번호 목록');
  add('table', 'tb-compare', '비교표 2단', 90, 50, (uid) => { const { S, T } = H(uid); return [S('rect', 0, 0, 44, 50, { fill: SKY, radius: 2 }), S('rect', 46, 0, 44, 50, { fill: YEL, radius: 2 }), T('주 2회', 0, 4, 44, 8, { size: 13, weight: 800, color: NAVY, align: 'center' }), T('주 3회', 46, 4, 44, 8, { size: 13, weight: 800, color: NAVY, align: 'center' }), T('· 기본 수련\n· 월 00,000원', 4, 16, 36, 30, { size: 9.5, lh: 1.7 }), T('· 기본 + 품새반\n· 월 00,000원', 50, 16, 36, 30, { size: 9.5, lh: 1.7 })]; }, '비교표');
  function mkTable(uid, rows, cols, head) { const { S, T } = H(uid); const els = []; const cw = 30, rh = 10; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const hd = r === 0; els.push(S('rect', c * cw, r * rh, cw, rh, { fill: hd ? NAVY : (r % 2 ? GRAY : WHITE), stroke: '#CFD4DD', strokeW: 0.25 })); els.push(T(hd ? (head ? head[c] : '항목 ' + (c + 1)) : '', c * cw, r * rh + 2.6, cw, 6, { size: 9, weight: hd ? 700 : 400, color: hd ? WHITE : INK, align: 'center', name: hd ? '머리글' : '칸' })); } return els; }

  /* 스마트 블록 (제목+내용 묶음) */
  add('block', 'bk-info', '안내 상자', 90, 36, (uid) => { const { S, T } = H(uid); return [S('rect', 0, 0, 90, 36, { fill: WHITE, stroke: NAVY, strokeW: 0.5, radius: 3 }), S('rect', 0, 0, 90, 9, { fill: NAVY, radius: 3 }), T('안내', 4, 2, 80, 6, { size: 10, weight: 700, color: WHITE }), T('내용을 입력하세요. 수련 시간, 준비물, 주의 사항 등을 적습니다.', 4, 13, 82, 20, { size: 9, lh: 1.6 })]; }, '안내 상자 블록');
  add('block', 'bk-event', '일정 블록', 90, 30, (uid) => { const { S, T } = H(uid); return [S('rect', 0, 0, 22, 30, { fill: NAVY, radius: 2 }), T('3', 0, 4, 22, 12, { font: 'Montserrat', size: 24, weight: 800, color: YEL, align: 'center', lh: 1 }), T('MAR', 0, 18, 22, 6, { font: 'Montserrat', size: 8, weight: 700, color: WHITE, align: 'center', ls: 0.15 }), T('정기 승급심사', 27, 3, 60, 8, { size: 13, weight: 700, color: NAVY }), T('오후 5시 · 본관 수련장\n도복 착용, 심사비 납부 확인', 27, 13, 60, 16, { size: 9, lh: 1.5, color: '#444' })]; }, '일정 날짜 블록');
  add('block', 'bk-contact', '연락처 블록', 90, 22, (uid) => { const { S, T } = H(uid); return [S('rect', 0, 0, 90, 22, { fill: YEL, radius: 11 }), T('☎', 6, 5, 12, 12, { size: 20, lh: 1, color: NAVY }), T('010-0000-0000', 20, 3.5, 66, 8, { font: 'Montserrat', size: 15, weight: 800, color: NAVY }), T('나라차태권도 · 상담 환영', 20, 13, 66, 6, { size: 8.5, weight: 500, color: '#444' })]; }, '연락처 전화 블록');
  add('block', 'bk-quote', '인용구 블록', 90, 30, (uid) => { const { S, T } = H(uid); return [S('rect', 0, 0, 2, 30, { fill: RED }), T('“땀과 노력은 나를 자랑스럽게 만들어 줍니다.”', 7, 2, 80, 18, { font: 'Gowun Batang', size: 13, weight: 700, lh: 1.5, color: NAVY }), T('— 1월 인성 덕목, 긍지', 7, 22, 80, 6, { size: 8.5, color: '#666' })]; }, '인용구 명언 블록');
  add('block', 'bk-steps', '3단계 블록', 110, 30, (uid) => { const { S, T } = H(uid); const els = []; ['신청', '체험', '등록'].forEach((s, i) => { const x = i * 40; els.push(S('ellipse', x, 0, 16, 16, { fill: i === 2 ? RED : NAVY })); els.push(T(String(i + 1), x, 3.5, 16, 8, { font: 'Montserrat', size: 14, weight: 800, color: WHITE, align: 'center', lh: 1 })); els.push(T(s, x - 4, 19, 24, 8, { size: 11, weight: 700, color: NAVY, align: 'center' })); if (i < 2) els.push(S('line', x + 18, 7.5, 18, 1, { fill: '#999', stroke: '#999', strokeW: 0.5, arrowEnd: true })); }); return els; }, '단계 절차 블록');
  add('block', 'bk-profile', '프로필 카드', 90, 34, (uid) => { const { S, T, I } = H(uid); return [S('rect', 0, 0, 90, 34, { fill: WHITE, stroke: '#D9DDE5', strokeW: 0.3, radius: 3 }), S('ellipse', 4, 4, 26, 26, { fill: SKY }), I('asset:mascot-01', 6, 6, 22, 22, { name: '사진' }), T('홍 길 동', 36, 6, 50, 8, { size: 13, weight: 700, color: NAVY }), T('사범 · 국기원 4단', 36, 15, 50, 6, { size: 9, color: '#555' }), T('“아이의 눈높이에서 함께 뜁니다.”', 36, 23, 52, 8, { size: 8.5, color: INK })]; }, '프로필 소개 카드');
  add('block', 'bk-title', '제목 + 밑줄', 90, 18, (uid) => { const { S, T } = H(uid); return [T('섹션 제목', 0, 0, 90, 12, { size: 20, weight: 800, color: NAVY }), S('rect', 0, 14, 24, 1.5, { fill: RED })]; }, '제목 섹션');
  add('block', 'bk-price', '가격 블록', 60, 30, (uid) => { const { S, T } = H(uid); return [S('rect', 0, 0, 60, 30, { fill: NAVY, radius: 3 }), T('주 3회 반', 0, 4, 60, 7, { size: 10, weight: 600, color: '#C8CFE4', align: 'center' }), T('00,000원', 0, 12, 60, 12, { font: 'Montserrat', size: 22, weight: 800, color: YEL, align: 'center', lh: 1 }), T('/ 월', 0, 23, 60, 5, { size: 8, color: '#C8CFE4', align: 'center' })]; }, '가격 블록');

  /* 장식 */
  add('deco', 'dc-dots', '점 패턴', 40, 40, (uid) => { const { S } = H(uid); const els = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) els.push(S('ellipse', c * 9, r * 9, 3, 3, { fill: NAVY, opacity: 0.6 })); return els; }, '장식 패턴 점');
  add('deco', 'dc-stars', '별 흩뿌리기', 50, 30, (uid) => { const { S } = H(uid); return [[2, 4, 8], [20, 0, 6], [36, 8, 10], [12, 18, 5], [44, 22, 7], [26, 20, 4]].map(([x, y, s]) => S('star', x, y, s, s, { fill: YEL, stroke: '#D9B32A', strokeW: 0.2 })); }, '장식 별');
  add('deco', 'dc-confetti', '색종이', 50, 30, (uid) => { const { S } = H(uid); const cols = [RED, YEL, NAVY, '#4C8A2B', '#6B3FD1']; const els = []; for (let i = 0; i < 14; i++) els.push(S('rect', (i * 37) % 48, (i * 23) % 28, 3, 1.5, { fill: cols[i % 5], rot: (i * 47) % 180 })); return els; }, '장식 색종이 축하');
  add('deco', 'dc-band', '가로 색 띠', 100, 10, (uid) => { const { S } = H(uid); return [S('rect', 0, 0, 100, 10, { fill: YEL })]; }, '장식 띠 배경');
  add('deco', 'dc-corner', '모서리 장식', 30, 30, (uid) => { const { S } = H(uid); return [S('rect', 0, 0, 30, 1.2, { fill: NAVY }), S('rect', 0, 0, 1.2, 30, { fill: NAVY }), S('rect', 3, 3, 20, 0.5, { fill: RED }), S('rect', 3, 3, 0.5, 20, { fill: RED })]; }, '장식 모서리 프레임');
  add('deco', 'dc-stripes', '사선 줄무늬', 40, 40, (uid) => { const { S } = H(uid); const els = []; for (let i = 0; i < 8; i++) els.push(S('rect', i * 6 - 10, 0, 2, 56, { fill: NAVY, rot: 30, opacity: 0.5 })); return els; }, '장식 줄무늬');
  add('deco', 'dc-circleset', '동심원', 40, 40, (uid) => { const { S } = H(uid); return [S('ellipse', 0, 0, 40, 40, { fill: YEL, opacity: 0.5 }), S('ellipse', 7, 7, 26, 26, { fill: YEL, opacity: 0.7 }), S('ellipse', 14, 14, 12, 12, { fill: RED })]; }, '장식 동심원');
  add('deco', 'dc-brush', '붓 터치 밑줄', 60, 10, (uid) => { const { Pth } = H(uid); return [Pth([[0, 6], [10, 3], [22, 7], [34, 3], [46, 7], [60, 4]], 0, 0, 60, 10, { strokeW: 3.5, stroke: YEL, cap: 'round', name: '붓 밑줄' })]; }, '장식 밑줄 붓');
  add('deco', 'dc-grid', '격자 배경', 60, 40, (uid) => { const { S } = H(uid); const els = []; for (let i = 0; i <= 6; i++) els.push(S('rect', i * 10, 0, 0.3, 40, { fill: '#C9CED8' })); for (let j = 0; j <= 4; j++) els.push(S('rect', 0, j * 10, 60, 0.3, { fill: '#C9CED8' })); return els; }, '장식 격자');

  /* 차트 */
  add('chart', 'ch-bar', '막대 차트', 80, 50, (uid) => { const { Ch } = H(uid); return [Ch('bar', 0, 0, 80, 50, { title: '월별 출석률' })]; }, '차트 막대 그래프');
  add('chart', 'ch-pie', '원형 차트', 50, 50, (uid) => { const { Ch } = H(uid); return [Ch('pie', 0, 0, 50, 50, { title: '반 구성' })]; }, '차트 원형 파이');
  add('chart', 'ch-donut', '도넛 차트', 50, 50, (uid) => { const { Ch } = H(uid); return [Ch('donut', 0, 0, 50, 50, { title: '띠별 비율' })]; }, '차트 도넛');
  add('chart', 'ch-line', '꺾은선 차트', 80, 50, (uid) => { const { Ch } = H(uid); return [Ch('line', 0, 0, 80, 50, { title: '줄넘기 기록' })]; }, '차트 꺾은선');
  add('chart', 'ch-hbar', '가로 막대', 80, 50, (uid) => { const { Ch } = H(uid); return [Ch('hbar', 0, 0, 80, 50, { title: '설문 결과' })]; }, '차트 가로 막대');

  const cats = [['all', '전체'], ['illust', '일러스트'], ['shape', '도형'], ['line', '선'], ['icon', '아이콘'], ['frame', '프레임'], ['badge', '배지·라벨'], ['table', '표·목록'], ['block', '스마트 블록'], ['deco', '장식'], ['chart', '차트']];
  return { items, cats, get: id => items.find(x => x.id === id) };
})();
