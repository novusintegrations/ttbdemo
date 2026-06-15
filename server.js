/**
 * TTB Label Verifier — Proxy Server
 *
 * Keeps the Anthropic API key server-side.
 * The browser calls /api/verify; this server calls Anthropic and returns results.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node server.js
 *   or: set key in .env (see README)
 */

require('dotenv').config();
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('\n  ERROR: ANTHROPIC_API_KEY is not set.\n  Create a .env file or set the environment variable.\n  See README.md for instructions.\n');
  process.exit(1);
}

// ── MIME types for static files
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// ── Read body helper
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

// ── Call Anthropic
async function callAnthropic(systemPrompt, userMessage, imageData, imageType) {
  const body = JSON.stringify({
    model:      'claude-sonnet-4-6',
    max_tokens: 1800,
    system:     systemPrompt,
    messages: [{
      role: 'user',
      content: [
        {
          type:   'image',
          source: { type: 'base64', media_type: imageType, data: imageData }
        },
        { type: 'text', text: userMessage }
      ]
    }]
  });

  // Use built-in https (no external deps needed for the API call)
  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers: {
          'Content-Type':      'application/json',
          'Content-Length':    Buffer.byteLength(body),
          'x-api-key':         API_KEY,
          'anthropic-version': '2023-06-01',
        }
      },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) });
          } catch(e) {
            reject(new Error('Failed to parse Anthropic response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── POST /api/verify — proxy to Anthropic
  if (req.method === 'POST' && url.pathname === '/api/verify') {
    try {
      const raw  = await readBody(req);
      const body = JSON.parse(raw);
      const { imageData, imageType, systemPrompt, userMessage } = body;

      if (!imageData || !imageType || !systemPrompt || !userMessage) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing required fields: imageData, imageType, systemPrompt, userMessage' }));
      }

      const { status, body: apiBody } = await callAnthropic(systemPrompt, userMessage, imageData, imageType);

      if (status !== 200) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: apiBody.error?.message || `Anthropic API error ${status}` }));
      }

      const text = apiBody.content?.[0]?.text || '';
      let result;
      try {
        result = JSON.parse(text.replace(/```json|```/g, '').trim());
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Model returned unexpected format. Try again.' }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));

    } catch (err) {
      console.error('Error in /api/verify:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── GET /health — uptime check
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }

  // ── Static files — serve index.html for everything else
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fall back to index.html for SPA-style navigation
      fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data2);
      });
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  TTB Label Verifier running at http://localhost:${PORT}\n`);
});
