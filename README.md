# TTB Label Verifier

AI-powered COLA label compliance review. Upload a label image, fill in the application fields, and Claude Vision reads the label and flags every discrepancy — government warning, ABV, brand name, same-field-of-vision, all of it.

Supports **Distilled Spirits** (27 CFR Part 5), **Malt Beverage** (27 CFR Part 7), and **Wine** (27 CFR Part 4).

---

## Deploy in 5 minutes (GitHub + Netlify)

### Step 1 — Push to GitHub
```bash
# Create a new repo on github.com, then:
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ttb-verifier.git
git push -u origin main
```

### Step 2 — Connect to Netlify
1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project**
2. Connect your GitHub account and select this repo
3. Build settings are auto-detected from `netlify.toml` — leave them as-is
4. Click **Deploy site**

### Step 3 — Add your API key
1. In Netlify: **Site settings** → **Environment variables** → **Add variable**
2. Key: `ANTHROPIC_API_KEY`
3. Value: your key from [console.anthropic.com](https://console.anthropic.com) → API Keys
4. Click **Save** → **Trigger deploy** (or it deploys automatically)

That's it. Netlify gives you a live URL like `https://your-site.netlify.app`.

---

## How it works

```
Browser                      Netlify Function              Anthropic
  │                               │                            │
  │  POST /api/verify             │                            │
  │  { image, fields }            │                            │
  │ ────────────────────────────► │                            │
  │                               │  POST /v1/messages         │
  │                               │  Claude Vision reads image │
  │                               │ ──────────────────────────►│
  │                               │                            │
  │                               │  { overall, checks[] }     │
  │                               │ ◄──────────────────────────│
  │  { overall, checks[] }        │                            │
  │ ◄──────────────────────────── │                            │
```

The API key lives only in Netlify's environment — never in the browser, never in your code.

---

## Project structure

```
ttb-verifier/
├── index.html              ← Frontend (zero dependencies, no build step)
├── netlify/functions/
│   └── verify.js           ← Serverless function — calls Anthropic, holds API key
├── netlify.toml            ← Routes /api/* → /.netlify/functions/*
└── README.md
```

---

## What gets checked

| Field | Distilled Spirits | Malt Beverage | Wine |
|---|---|---|---|
| Brand name | ✓ Required | ✓ Required | ✓ Required on brand label |
| Class / type | ✓ Same field of vision | ✓ Required | ✓ Required on brand label |
| Alcohol content | ✓ % ABV required; proof alone not OK | ○ Only if from added flavors | ✓ Mandatory if >14% ABV |
| Net contents | ✓ | ✓ | ✓ |
| Bottler / producer | ✓ | ✓ | ✓ Must match permit |
| Country of origin | ○ Imports only | ○ Imports only | ○ Imports only |
| Government warning | ✓ All beverages | ✓ All beverages | ✓ All beverages |

✓ = mandatory  ○ = conditional

---

## Local development

```bash
npm install -g netlify-cli
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
netlify dev
# Open http://localhost:8888
```

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | From console.anthropic.com |
