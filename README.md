# TTB Label Verifier

AI-powered COLA label compliance review tool for TTB agents. Verifies distilled spirits, malt beverage, and wine labels against application fields using Claude claude-sonnet-4-6.

---

## Project structure

```
ttb-verifier/
├── index.html        ← The entire frontend (one file, no build step)
├── server.js         ← Node.js proxy — holds the API key, calls Anthropic
├── package.json
├── .env.example      ← Copy to .env and add your key
├── .gitignore
└── README.md
```

---

## Quick start (local)

### 1. Prerequisites
- Node.js 18 or newer — https://nodejs.org

### 2. Install
```bash
cd ttb-verifier
npm install
```

### 3. Add your API key
```bash
cp .env.example .env
```
Open `.env` and replace the placeholder with your real Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```
Get a key at https://console.anthropic.com → API Keys.

### 4. Run
```bash
npm start
```
Open http://localhost:3000 in your browser. The API key never leaves the server.

---

## Deploy to a live URL

### Option A — Railway (easiest, free tier available)
1. Push this folder to a GitHub repo
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variable: `ANTHROPIC_API_KEY` = your key
5. Deploy — Railway gives you a live URL instantly

### Option B — Render
1. Push to GitHub
2. https://render.com → New Web Service → connect repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variable: `ANTHROPIC_API_KEY`

### Option C — Fly.io
```bash
npm install -g flyctl
fly auth login
fly launch          # follow prompts
fly secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
fly deploy
```

### Option D — Any VPS (DigitalOcean, Linode, etc.)
```bash
# On your server:
git clone <your-repo>
cd ttb-verifier
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start

# To keep it running with PM2:
npm install -g pm2
pm2 start server.js --name ttb-verifier
pm2 save
```

---

## How it works

```
Browser                    server.js                 Anthropic API
  │                            │                          │
  │  POST /api/verify          │                          │
  │  { imageData, fields }     │                          │
  │ ─────────────────────────► │                          │
  │                            │  POST /v1/messages       │
  │                            │  x-api-key: [secret]     │
  │                            │ ────────────────────────► │
  │                            │                          │
  │                            │  { overall, checks[] }   │
  │                            │ ◄──────────────────────── │
  │   { overall, checks[] }    │                          │
  │ ◄───────────────────────── │                          │
```

The API key is set once as a server environment variable. Users never see it. No key entry in the UI.

---

## Features

- **Three beverage types** — Distilled Spirits (27 CFR Part 5), Malt Beverage (27 CFR Part 7), Wine (27 CFR Part 4)
- **7-field verification** — brand name, class/type, ABV, net contents, producer, country of origin, government warning
- **Government warning checker** — verifies verbatim text, ALL CAPS heading, bold, separate placement (27 CFR Part 16)
- **Per-type rules** — same-field-of-vision for spirits, ABV abbreviation rules for malt/wine, appellation triggers for wine
- **Agent override** — agents can correct AI verdicts; corrections logged for model improvement
- **Integrations** — Microsoft Teams Adaptive Cards, Power Automate HTTP triggers, generic webhook/REST
- **Batch mode** — queue multiple label images, verify in sequence, export CSV summary
- **Export** — CSV per-field results, printable HTML report

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key from console.anthropic.com |
| `PORT` | No | Server port (default: 3000) |
