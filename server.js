/**
 * TTB Label Verifier — server.js
 * Works on Render (and any Node host).
 * Set ANTHROPIC_API_KEY as an environment variable in Render dashboard.
 *
 * Routes:
 *   POST /api/verify  → calls Anthropic Claude Vision, returns JSON result
 *   GET  /*           → serves index.html
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT    = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('\n  ERROR: ANTHROPIC_API_KEY environment variable is not set.\n  Add it in the Render dashboard under Environment.\n');
  process.exit(1);
}

// ── CFR rule sets injected into the AI prompt ────────────────────────────────

const REQUIRED_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink ' +
  'alcoholic beverages during pregnancy because of the risk of birth defects. ' +
  '(2) Consumption of alcoholic beverages impairs your ability to drive a car or ' +
  'operate machinery, and may cause health problems.';

const TYPE_RULES = {
  spirits: `BEVERAGE TYPE: Distilled Spirits (27 CFR Part 5, Subpart A)
- Brand name, class/type, and alcohol content MUST appear in the same field of vision (27 CFR 5.63(a)). For cylindrical containers, one side = 40% of circumference. Flag if these three are not co-located.
- Alcohol content must state % by volume. "Proof" alone is NOT acceptable. Both % ABV and proof together are acceptable (27 CFR 5.65).
- Name and address of bottler or distiller required (27 CFR 5.66–5.68).
- Net contents required; may be blown/embossed into container (27 CFR 5.70).
- Age statement required if straight whisky is under 4 years old (27 CFR 5.74).
- If ≥2.5% neutral spirits, source must be disclosed (27 CFR 5.75).`,

  malt: `BEVERAGE TYPE: Malt Beverage (27 CFR Part 7)
- No same-field-of-vision requirement.
- Brand name required (27 CFR 7.64).
- Class/type designation required — e.g. "Beer", "Ale", "Lager", "Porter" (27 CFR 7.141).
- Alcohol content is ONLY mandatory if derived from added flavors or non-beverage ingredients (other than hop extract). If shown, "ABV" abbreviation is NOT acceptable — must spell out "alcohol by volume" (27 CFR 7.65).
- Name and address required (27 CFR 7.66–7.68).
- Allergen/additive declarations if applicable (27 CFR 7.63(b)).`,

  wine: `BEVERAGE TYPE: Wine (27 CFR Part 4) — applies to wines ≥7% ABV
- Brand name AND class/type must appear on the brand label specifically (27 CFR 4.33–4.34).
- A color alone (e.g. "Rosé") is NOT a valid class/type — must be "Rosé Wine" etc.
- Alcohol content is mandatory for wines >14% ABV. Optional for 7–14% ABV only if "table wine" or "light wine" is the class/type. "ABV" is NOT acceptable — must use "alcohol by volume" or "alc. by vol." (27 CFR 4.36).
- Appellation of origin is MANDATORY when: (a) a grape variety is used as class/type, (b) a vintage date appears, or (c) a geographic area is implied (27 CFR 4.25).
- If grape variety used as class/type, ≥75% must derive from that variety (85% for state/county appellations).
- Sulfite declaration required if ≥10 ppm (27 CFR 4.32(e)).
- Name and address must match bottler's/importer's basic permit exactly (27 CFR 4.35–4.37).`,
};

function buildPrompt(fields) {
  const type = fields.bevType || 'spirits';
  const system = `You are a TTB COLA label compliance specialist. Examine the label image carefully and compare it against the provided application data. Return ONLY a valid JSON object — no markdown, no preamble, no explanation.

${TYPE_RULES[type] || TYPE_RULES.spirits}

GOVERNMENT WARNING (27 CFR Part 16 — mandatory on ALL alcohol beverages ≥0.5% ABV):
Exact required text: "${REQUIRED_WARNING}"
Rules:
- "GOVERNMENT WARNING:" must be ALL CAPS and BOLD (27 CFR 16.22)
- Remainder of statement must NOT be bold
- Must appear SEPARATE AND APART from all other information (27 CFR 16.21)
- Must be on a contrasting background and readily legible
- Minimum type size: 1mm (≤237ml), 2mm (237ml–3L), 3mm (>3L) (27 CFR 16.22)
- Must appear as a CONTINUOUS statement — cannot be split across labels
- Applies to domestic AND imported products (27 CFR 16.20)
Common failures: title case ("Government Warning:"), bold on full statement, wrong/truncated text, buried in other text, type too small.

Status values:
- "pass" — label matches application and meets requirement
- "warn" — close match but minor discrepancy needs human review (e.g. "Stone's Throw" vs "STONE'S THROW")
- "fail" — clear mismatch, violation, or missing required element
- "skip" — field not provided in application; still read what is on the label

Return ONLY this JSON structure, nothing else:
{
  "overall": "pass|fail|warn",
  "summary": "One clear sentence for the reviewing agent",
  "checks": [
    { "field": "brand_name",   "label": "Brand Name",         "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "class_type",   "label": "Class / Type",       "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "abv",          "label": "Alcohol Content",    "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "net_contents", "label": "Net Contents",       "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "producer",     "label": "Bottler / Producer", "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "origin",       "label": "Country of Origin",  "status": "...", "found": "...", "expected": "...", "note": "..." },
    { "field": "govt_warning", "label": "Government Warning", "status": "...", "found": "...", "expected": "...", "note": "..." }
  ]
}`;

  const user = `Verify this label image against the following COLA application data:

Beverage type: ${type}
Brand name: ${fields.brand || '(not provided)'}
Class / type: ${fields.classType || '(not provided)'}
Alcohol content: ${fields.abv || '(not provided)'}
Net contents: ${fields.net || '(not provided)'}
Bottler / producer: ${fields.producer || '(not provided)'}
Country of origin: ${fields.origin || 'domestic (not provided)'}
Reviewer notes: ${fields.notes || 'none'}

Read the label image carefully. Check every field. Pay special attention to the government warning — verify it is present, verbatim, correctly formatted, and visually separate. Return only the JSON object.`;

  return { system, user };
}

// ── Call Anthropic API ────────────────────────────────────────────────────────

function callAnthropic(system, user, imageData, imageType) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 1800,
      system,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: imageType, data: imageData } },
          { type: 'text', text: user },
        ],
      }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'Content-Length':    Buffer.byteLength(body),
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch(e) {
          reject(new Error('Failed to parse Anthropic response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Read request body ─────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);

  // ── Health check
  if (req.method === 'GET' && parsed.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }

  // ── POST /api/verify — main verification endpoint
  if (req.method === 'POST' && parsed.pathname === '/api/verify') {
    res.setHeader('Content-Type', 'application/json');

    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
    }

    const { imageData, imageType, fields } = body;

    if (!imageData || !imageType || !fields) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing required fields: imageData, imageType, fields' }));
    }

    try {
      const { system, user } = buildPrompt(fields);
      const { status, data } = await callAnthropic(system, user, imageData, imageType);

      if (status !== 200) {
        res.writeHead(status);
        return res.end(JSON.stringify({ error: data.error?.message || `Anthropic API error ${status}` }));
      }

      const raw = data.content?.[0]?.text || '';
      let result;
      try {
        result = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: 'Model returned unexpected format — please try again.' }));
      }

      res.writeHead(200);
      return res.end(JSON.stringify(result));

    } catch(err) {
      console.error('Anthropic call failed:', err.message);
      res.writeHead(502);
      return res.end(JSON.stringify({ error: 'Could not reach Anthropic API: ' + err.message }));
    }
  }

  // ── Serve index.html for all other GET requests
  if (req.method === 'GET') {
    const indexPath = path.join(__dirname, 'index.html');
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('index.html not found');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`\n  TTB Label Verifier running on port ${PORT}`);
  console.log(`  API key: ${API_KEY ? 'loaded ✓' : 'MISSING ✗'}\n`);
});
