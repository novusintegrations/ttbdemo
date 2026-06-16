# TTB Label Verifier

AI-powered COLA label compliance review. Claude Vision reads the label image and cross-checks every field against the application data — brand name, ABV, class/type, government warning, and more.

## Files

```
ttb-verifier/
├── index.html    ← Entire frontend (no build step, no dependencies)
├── server.js     ← Node.js server: serves index.html + proxies /api/verify to Anthropic
├── package.json  ← Declares Node ≥18, start command
├── .gitignore    ← Keeps .env out of git
└── README.md
```

## Deploy to Render

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "TTB Label Verifier"
git remote add origin https://github.com/YOUR_USERNAME/ttb-verifier.git
git push -u origin main
```

### 2. Create Render Web Service
1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Set:
   - **Runtime:** Node
   - **Build command:** *(leave blank — no build needed)*
   - **Start command:** `node server.js`

### 3. Add the API key
Under **Environment** → **Add environment variable:**
- Key: `ANTHROPIC_API_KEY`
- Value: your key from [console.anthropic.com](https://console.anthropic.com)

### 4. Deploy
Click **Create Web Service**. Render builds and deploys — your URL appears at the top of the dashboard.

---

## How it works

```
Browser  →  POST /api/verify  →  server.js  →  Anthropic Claude Vision  →  JSON result  →  Browser
```

The API key lives only in Render's environment. The browser never sees it.

## Local development

```bash
ANTHROPIC_API_KEY=sk-ant-... node server.js
# Open http://localhost:3000
```
