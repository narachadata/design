// AI 연동: Claude(문구·프롬프트 설계) + Gemini(이미지 생성). 키는 localStorage에만 저장됩니다.
window.AI = (function () {
  const KEY = 'naracal-ai-v1';
  const cfg = Object.assign({
    anthropicKey: '', geminiKey: '',
    claudeModel: 'claude-opus-5-5',
    geminiModel: 'gemini-nano-banana-2.1',
    aspect: '3:4', size: '1K',
  }, (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })());
  function saveCfg() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }

  /* ---------- Claude ---------- */
  async function claudeRequest(body) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(Object.assign({ model: cfg.claudeModel, max_tokens: 16000, fallbacks: 'default' }, body)),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || ('Claude 오류 ' + r.status));
    if (j.stop_reason === 'refusal') throw new Error('Claude가 이 요청을 거절했습니다. ' + ((j.stop_details && j.stop_details.explanation) || ''));
    return j;
  }
  function textOf(j) { return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join(''); }
  function parseJSON(t) {
    const s = t.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}'), c = s.indexOf('['), d = s.lastIndexOf(']');
    let body = s;
    if (a >= 0 && (c < 0 || a < c)) body = s.slice(a, b + 1); else if (c >= 0) body = s.slice(c, d + 1);
    return JSON.parse(body);
  }
  // 구조화 출력을 먼저 시도하고, 서버가 거부하면 JSON 텍스트로 다시 요청합니다.
  async function claudeJSON({ system, user, schema }) {
    if (!cfg.anthropicKey) throw new Error('Claude API 키를 먼저 넣어 주세요 (AI 도우미 > API 설정).');
    try {
      const j = await claudeRequest({ system, messages: [{ role: 'user', content: user }],
        output_config: { format: { type: 'json_schema', schema } } });
      return parseJSON(textOf(j));
    } catch (e) {
      if (!/output_config|format|schema/i.test(e.message)) throw e;
      const j = await claudeRequest({ system: system + '\n\n반드시 JSON만 출력하고 다른 설명은 쓰지 마세요.', messages: [{ role: 'user', content: user }] });
      return parseJSON(textOf(j));
    }
  }
  async function claudeText({ system, user }) {
    if (!cfg.anthropicKey) throw new Error('Claude API 키를 먼저 넣어 주세요 (AI 도우미 > API 설정).');
    const j = await claudeRequest({ system, messages: [{ role: 'user', content: user }] });
    return textOf(j).trim();
  }

  const VIRTUE_SCHEMA = {
    type: 'object', additionalProperties: false,
    properties: {
      virtue: { type: 'string' }, en: { type: 'string' }, quote: { type: 'string' },
      practice: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
      idiom: { type: 'string' }, hanja: { type: 'string' }, meaning: { type: 'string' },
    },
    required: ['virtue', 'en', 'quote', 'practice', 'idiom', 'hanja', 'meaning'],
  };
  const YEAR_SCHEMA = { type: 'object', additionalProperties: false, properties: { months: { type: 'array', items: VIRTUE_SCHEMA, minItems: 12, maxItems: 12 } }, required: ['months'] };

  const SYSTEM_COPY = `당신은 태권도장 어린이·청소년 인성교육 캘린더의 카피라이터입니다.
초등학생이 바로 이해할 수 있는 쉬운 한국어로, 따뜻하고 힘 있는 어조로 씁니다. 태권도 수련 장면(기합, 띠, 품새, 겨루기, 도장, 사범님)을 자연스럽게 녹입니다.
형식 규칙:
- virtue: 덕목 이름(한글, 2~5자). en: 영문 덕목명 대문자.
- quote: 큰따옴표로 감싼 2~3줄 명언. 줄바꿈은 \\n. 전체 45자 안팎. 한 줄은 18자 이내.
- practice: 실천 과제 2개. 각 35자 이내, "~하기."로 끝나는 구체적 행동(집·학교·도장에서 할 수 있는 것).
- idiom: 덕목과 어울리는 사자성어(한글 4자). hanja: 그 한자 4자. meaning: 뜻풀이 한 문장, 30자 이내, "~합니다."로 끝맺음.`;

  const EXAMPLE = `참고 예시(2026년 1월): {"virtue":"긍지·자부심","en":"PRIDE, SELF-ESTEEM","quote":"\\"땀과 노력은, 나를 자랑스럽게\\n만들어 줍니다. 자신을 믿으세요!\\"","practice":["매일 실천할 수 있는 목표 정하고, 1년간 실천하기.","도전한 일에 성공했을 때, 자신에게 칭찬 해주기."],"idiom":"우공이산","hanja":"愚公移山","meaning":"꾸준한 의지로 나아가면 큰 산도 옮길 수 있습니다."}`;

  async function suggestMonth({ year, month, virtue, hint }) {
    const user = `${year}년 ${month}월의 인성 덕목${virtue ? `은 "${virtue}"입니다` : '을 하나 정해 주세요'}.${hint ? ' 참고: ' + hint : ''}
${month}월의 계절감이나 학사 일정(새 학기, 방학, 명절 등)이 어울리면 가볍게 반영해 주세요.
${EXAMPLE}
위 형식의 JSON 객체 하나를 만들어 주세요.`;
    return claudeJSON({ system: SYSTEM_COPY, user, schema: VIRTUE_SCHEMA });
  }
  async function suggestYear({ year, previous, hint }) {
    const user = `${year}년 1월부터 12월까지 12개의 인성 덕목을 구성해 주세요. 서로 겹치지 않고, 한 해의 흐름(새해 다짐 → 봄 새 학기 → 여름 → 가을 → 연말 감사)에 맞게 배치합니다.
작년(${year - 1}년) 덕목: ${previous.join(', ')}. 같은 덕목을 다시 써도 되지만 문구는 새로 씁니다.${hint ? ' 참고: ' + hint : ''}
${EXAMPLE}
{"months":[...12개...]} 형식의 JSON을 만들어 주세요. 배열 순서가 1월부터 12월입니다.`;
    const j = await claudeJSON({ system: SYSTEM_COPY, user, schema: YEAR_SCHEMA });
    return j.months;
  }

  const STYLE_GUIDE = `Style: flat vector children's-book illustration, bold clean black outlines, soft cel shading, bright and cheerful, no gradients, no text, no letters, no watermark, no logo. Subject centered, full body visible, generous margin around the subject. PURE WHITE background (#FFFFFF), nothing else in the background.
Characters available: (1) the dojang mascot: a cute round penguin (dark gray head and back, white face and belly, orange beak and feet, small gray mitten hands) wearing a white taekwondo dobok with a black belt and a small red-and-blue emblem on the chest; (2) Korean elementary-school children in white doboks with colored belts (yellow, green, blue, red, black), neat black hair, friendly faces.`;

  async function imagePrompt({ virtue, en, quote, practice, character, extra }) {
    const user = `Write ONE image-generation prompt (English, 60-110 words, a single paragraph, no headings) for a Korean taekwondo school's character-education calendar page.
Month virtue: ${virtue} (${en}). Quote on the page: ${quote.replace(/\n/g, ' ')}. Practice items: ${practice.join(' / ')}.
Main character: ${character === 'kids' ? 'one or two Korean children in doboks' : character === 'both' ? 'the penguin mascot together with a child in a dobok' : 'the penguin mascot'}.
Show a warm, concrete scene that expresses the virtue through a clear action or gesture (not abstract symbols), suitable for ages 7-13.${extra ? ' Extra request from the designer: ' + extra : ''}
Start the prompt with the scene, then append this style block verbatim:
${STYLE_GUIDE}
Output the prompt text only.`;
    return claudeText({ system: 'You are an art director writing prompts for an image-generation model. Output only the prompt.', user });
  }

  /* ---------- Gemini ---------- */
  async function geminiImage({ prompt, refImage, aspect, size }) {
    if (!cfg.geminiKey) throw new Error('Gemini API 키를 먼저 넣어 주세요 (AI 도우미 > API 설정).');
    const model = cfg.geminiModel.trim();
    aspect = aspect || cfg.aspect; size = size || cfg.size;
    const ref = refImage ? await toBase64(refImage) : null;
    if (/^gemini-2\.5-flash-image/.test(model)) return geminiLegacy({ model, prompt, ref, aspect });
    const input = [];
    if (ref) input.push({ type: 'image', data: ref.data, mime_type: ref.mime });
    input.push({ type: 'text', text: (ref ? 'Use the attached image as the exact character reference (same mascot design, colors and proportions). ' : '') + prompt });
    const body = { model, input, response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: aspect, image_size: size } };
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.geminiKey }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || ('Gemini 오류 ' + r.status));
    const imgs = [];
    (j.steps || []).forEach(st => { if (st.type === 'model_output') (st.content || []).forEach(c => { if (c.type === 'image' && c.data) imgs.push(`data:${c.mime_type || 'image/png'};base64,${c.data}`); }); });
    if (!imgs.length && j.output_image && j.output_image.data) imgs.push(`data:${j.output_image.mime_type || 'image/png'};base64,${j.output_image.data}`);
    if (!imgs.length) throw new Error('Gemini가 이미지를 돌려주지 않았습니다. 상태: ' + (j.status || '알 수 없음'));
    return imgs;
  }
  async function geminiLegacy({ model, prompt, ref, aspect }) {
    const parts = [];
    if (ref) parts.push({ inline_data: { mime_type: ref.mime, data: ref.data } });
    parts.push({ text: (ref ? 'Use the attached image as the exact character reference. ' : '') + prompt });
    const body = { contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } } };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.geminiKey }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || ('Gemini 오류 ' + r.status));
    const imgs = [];
    ((j.candidates || [])[0]?.content?.parts || []).forEach(p => { if (p.inlineData && p.inlineData.data) imgs.push(`data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}`); });
    if (!imgs.length) throw new Error('Gemini가 이미지를 돌려주지 않았습니다.');
    return imgs;
  }
  async function toBase64(src) {
    if (src.startsWith('data:')) { const m = src.match(/^data:([^;]+);base64,(.*)$/s); return { mime: m[1], data: m[2] }; }
    const img = await loadImg(src);
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const d = c.toDataURL('image/png'); const m = d.match(/^data:([^;]+);base64,(.*)$/s); return { mime: m[1], data: m[2] };
  }
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지를 읽지 못했습니다')); i.src = src; }); }

  /* ---------- 흰 배경 제거 (가장자리에서 이어진 흰색만 투명하게) ---------- */
  async function removeWhite(src, tol) {
    tol = tol || 60;
    const img = await loadImg(src);
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, W, H), d = id.data;
    const corners = [0, W - 1, (H - 1) * W, W * H - 1].map(i => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    const dist = i => { let best = 1e9; for (const k of corners) { const v = Math.abs(d[i * 4] - k[0]) + Math.abs(d[i * 4 + 1] - k[1]) + Math.abs(d[i * 4 + 2] - k[2]); if (v < best) best = v; } return best; };
    const seen = new Uint8Array(W * H); const stack = [];
    for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
    for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
    while (stack.length) {
      const i = stack.pop(); if (seen[i]) continue; seen[i] = 1;
      if (dist(i) >= tol) continue;
      d[i * 4 + 3] = 0;
      const x = i % W, y = (i / W) | 0;
      if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
    }
    // 가장자리 부드럽게
    for (let i = 0; i < W * H; i++) {
      if (d[i * 4 + 3] === 0) continue;
      const x = i % W, y = (i / W) | 0;
      const near = (x > 0 && d[(i - 1) * 4 + 3] === 0) || (x < W - 1 && d[(i + 1) * 4 + 3] === 0) || (y > 0 && d[(i - W) * 4 + 3] === 0) || (y < H - 1 && d[(i + W) * 4 + 3] === 0);
      if (near) { const v = dist(i); if (v < tol * 2.2) d[i * 4 + 3] = Math.round(255 * Math.min(1, v / (tol * 2.2))); }
    }
    ctx.putImageData(id, 0, 0);
    return c.toDataURL('image/png');
  }

  return { cfg, saveCfg, suggestMonth, suggestYear, imagePrompt, geminiImage, removeWhite, loadImg };
})();
