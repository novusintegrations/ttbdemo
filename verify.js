/**
 * Netlify Function: /api/verify
 * Proxies label image + fields to Anthropic Claude Vision.
 * API key lives here as ANTHROPIC_API_KEY env var — never in the browser.
 */

const https = require('https');

const REQUIRED_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink ' +
  'alcoholic beverages during pregnancy because of the risk of birth defects. ' +
  '(2) Consumption of alcoholic beverages impairs your ability to drive a car or ' +
  'operate machinery, and may cause health problems.';

const TYPE_RULES = {
  spirits: `BEVERAGE TYPE: Distilled Spirits (27 CFR Part 5)
- Brand name, class/type, and alcohol content MUST appear in the same field of vision (27 CFR 5.63(a))
- Alcohol content must state % by volume — "Proof" alone is NOT acceptable (27 CFR 5.65)
- Name and address of bottler/distiller required (27 CFR 5.66-5.68)
- Net contents required; may be blown/embossed into container (27 CFR 5.70)
- Age statement required if straight whisky under 4 years old (27 CFR 5.74)`,

  malt: `BEVERAGE TYPE: Malt Beverage (27 CFR Part 7)
- No same-field-of-vision requirement
- Brand name required (27 CFR 7.64)
- Class/type designation required — e.g. "Beer", "Ale", "Lager" (27 CFR 7.141)
- Alcohol content ONLY mandatory if derived from added flavors/non-beverage ingredients
- If alcohol content shown, "ABV" abbreviation NOT acceptable — must spell out (27 CFR 7.65)
- Name and address required (27 CFR 7.66-7.68)`,

  wine: `BEVERAGE TYPE: Wine (27 CFR Part 4) — applies to wines ≥7% ABV
- Brand name AND class/type must appear on the brand label (27 CFR 4.33-4.34)
- A color alone (e.g. "Rosé") is NOT a valid class/type — must be "Rosé Wine" etc.
- Alcohol content mandatory for wines >14% ABV; "ABV" abbreviation NOT acceptable (27 CFR 4.36)
- Appellation of origin mandatory when grape variety used as class/type, or vintage date shown (27 CFR 4.25)
- Sulfite declaration required if ≥10 ppm (27 CFR 4.32(e))
- Name and address must match basic permit exactly (27 CFR 4.35-4.37)`,
};

function buildPrompt(fields) {
  const type = fields.bevType || 'spirits';
  return {
    system: `You are a TTB COLA label compliance specialist. Examine the label image carefully and compare it against the application data provided. Return ONLY a valid JSON object — no markdown, no explanation.

${TYPE_RULES[type] || TYPE_RULES.spirits}

GOVERNMENT WARNING (27 CFR Part 16 — mandatory on ALL alcohol beverages ≥0.5% ABV):
Exact required text: "${REQUIRED_WARNING}"
- "GOVERNMENT WARNING:" must be ALL CAPS and BOLD
- Rest of statement must NOT be bold
- Must be separate and apart from all other information (27 CFR 16.21)
- Must be on a contrasting background and readily legible
- Minimum type size: 1mm (≤237ml), 2mm (237ml–3L), 3mm (>3L)
- Cannot be split across labels — must appear as one continuous statement

Status values:
- "pass" — label matches application / meets requirement
- "warn" — close match but minor discrepancy needs human review
- "fail" — clear mismatch, violation, or missing required element  
- "skip" — field not provided in application (still read what's on the label)

Return this exact JSON structure:
{
  "overall": "pass|fail|warn",
  "summary": "One sentence verdict for the reviewing agent",
  "checks": [
    { "field": "brand_name",    "label": "Brand Name",           "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "class_type",    "label": "Class / Type",         "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "abv",           "label": "Alcohol Content",      "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "net_contents",  "label": "Net Contents",         "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "producer",      "label": "Bottler / Producer",   "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "origin",        "label": "Country of Origin",    "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "govt_warning",  "label": "Government Warning",   "status": "...", "found": "...", "expected": "...", "note": "..." }
  ]
}`,

    user: `Verify this label image against the following COLA application data:

Beverage type: ${type}
Brand name: ${fields.brand || '(not provided)'}
Class / type: ${fields.classType || '(not provided)'}
Alcohol content: ${fields.abv || '(not provided)'}
Net contents: ${fields.net || '(not provided)'}
Bottler / producer: ${fields.producer || '(not provided)'}
Country of origin: ${fields.origin || 'domestic (not provided)'}
Reviewer notes: ${fields.notes || 'none'}

Read the label image carefully. Check every field. Pay special attention to the government warning statement — verify it is present, verbatim, correctly formatted, and separate from other text. Return only the JSON object.`,
  };
}

function callAnthropic(systemPrompt, userText, imageData, imageType) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: imageType, data: imageData } },
          { type: 'text', text: userText },
        ],
      }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch (e) {
          reject(new Error('Failed to parse Anthropic response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on server.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { imageData, imageType, fields } = body;
  if (!imageData || !imageType || !fields) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing imageData, imageType, or fields' }) };
  }

  try {
    const { system, user } = buildPrompt(fields);
    const { status, data } = await callAnthropic(system, user, imageData, imageType);

    if (status !== 200) {
      return {
        statusCode: status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: data.error?.message || `Anthropic error ${status}` }),
      };
    }

    const raw = data.content?.[0]?.text || '';
    let result;
    try {
      result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Model returned unexpected format. Try again.' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
