# 🍷 TTB Label Verifier

**AI-powered alcohol label compliance review for TTB COLA applications**

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

A prototype tool for the TTB Compliance Division to verify alcohol beverage labels against federal requirements using Claude (Anthropic). Designed for compliance agents reviewing COLA applications.

---

## Features

- **AI-powered label analysis** — Upload a label image; Claude extracts and verifies all required fields
- **Three beverage types** — Distilled Spirits, Wine, and Malt Beverage / Beer with type-specific field requirements
- **Government Warning verification** — Exact text match, ALL CAPS check, formatting validation
- **Application data comparison** — Optionally supply what the applicant claimed; AI flags discrepancies
- **Batch processing** — Upload up to 50 labels at once, processed in parallel
- **Microsoft Teams integration** — Rejection alerts and batch summaries as adaptive cards
- **REST API** — Integrate with COLA systems, Power Automate, Zapier, n8n, or any webhook-capable platform
- **Sub-5-second results** — Designed to meet agent workflow speed requirements
- **Clean, accessible UI** — Works for users of all tech comfort levels

---

## Quick Start (Local)

### Prerequisites
- Node.js 18+
- Anthropic API key → [console.anthropic.com](https://console.anthropic.com)

### 1. Clone & install
```bash
git clone https://github.com/YOUR_ORG/ttb-label-verifier.git
cd ttb-label-verifier
npm install
cd client && npm install
cd ../server && npm install
```

### 2. Configure environment
```bash
cp server/.env.example server/.env
# Edit server/.env and set ANTHROPIC_API_KEY
```

### 3. Start development servers
```bash
# From project root — starts both client (port 5173) and server (port 3001)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploy to Railway

Railway auto-detects the configuration via `railway.toml`.

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Select your repository
4. Add environment variables:
   - `ANTHROPIC_API_KEY` — **required**
   - `TEAMS_WEBHOOK_URL` — optional, for Teams alerts
   - `OUTBOUND_WEBHOOK_URL` — optional, for Power Automate / Zapier
5. Deploy — Railway handles the build and start automatically

The app serves the React client as static files from the Express server in production.

---

## API Reference

### Single Label Analysis
```
POST /api/analyze
Content-Type: multipart/form-data

Fields:
  image           File        Label image (JPG, PNG, WebP, TIFF)
  beverageType    string      "distilled_spirits" | "wine" | "malt_beverage"
  applicationData JSON string Optional — what the applicant claimed
```

**Response:**
```json
{
  "overallStatus": "APPROVED | REJECTED | NEEDS_REVIEW",
  "confidence": 0.94,
  "beverageType": "distilled_spirits",
  "extractedData": {
    "brandName": "OLD TOM DISTILLERY",
    "classType": "Kentucky Straight Bourbon Whiskey",
    "alcoholContent": "45% Alc./Vol. (90 Proof)",
    "netContents": "750 mL",
    "bottlerInfo": "...",
    "governmentWarning": "GOVERNMENT WARNING: ..."
  },
  "checks": [
    {
      "field": "brandName",
      "label": "Brand Name",
      "status": "PASS",
      "extractedValue": "OLD TOM DISTILLERY",
      "notes": "Brand name clearly visible and correctly formatted"
    }
  ],
  "governmentWarningDetails": {
    "found": true,
    "isAllCaps": true,
    "textMatch": "EXACT",
    "violations": []
  },
  "imageQuality": "GOOD",
  "summaryNotes": "All required fields present and compliant.",
  "analyzedAt": "2025-01-15T14:32:10Z",
  "modelUsed": "claude-sonnet-4-6"
}
```

### Batch Analysis
```
POST /api/analyze/batch
Content-Type: multipart/form-data

Fields:
  images[]        Files       Up to 50 label images
  beverageType    string      Beverage type for all labels in batch
```

### Webhook Registration
```
POST /api/webhooks/register
Content-Type: application/json

{
  "url": "https://your-endpoint.com/hook",
  "events": ["label.rejected", "batch.complete"],
  "name": "My Integration",
  "secret": "optional-hmac-secret"
}
```

Available events: `label.analyzed`, `label.rejected`, `batch.complete`, `batch.rejected`

---

## Microsoft Teams Integration

1. In Teams: Channel → **…** → Connectors → Incoming Webhook → Configure
2. Copy the webhook URL
3. Set `TEAMS_WEBHOOK_URL=<url>` in your environment
4. Restart the server

Alerts are sent as Adaptive Cards with status, brand name, violations, and batch summaries.

## Power Automate / Zapier

Register an outbound webhook (see API above) pointing to your Power Automate HTTP trigger or Zapier webhook URL. You'll receive JSON events for every label analyzed or rejected.

---

## Architecture

```
ttb-label-verifier/
├── client/                 React + Vite frontend
│   └── src/
│       ├── components/     UI components (tabs, results, drop zone)
│       └── utils/          API client, constants
├── server/                 Express API server
│   └── src/
│       ├── index.js        Routes & middleware
│       ├── anthropic.js    Claude AI integration
│       ├── webhooks.js     Outbound webhook registry
│       └── integrations/
│           └── teams.js    Microsoft Teams adaptive cards
├── railway.toml            Railway deployment config
└── .github/workflows/      CI pipeline
```

**AI model:** `claude-sonnet-4-6` — chosen for speed (<5s) and accuracy on structured extraction tasks.

---

## TTB Requirements Reference

### Government Warning (mandatory on all labels)
```
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink
alcoholic beverages during pregnancy because of the risk of birth defects.
(2) Consumption of alcoholic beverages impairs your ability to drive a car or
operate machinery, and may cause health problems.
```
"GOVERNMENT WARNING:" must be in ALL CAPS and bold. Exact text required — no variations.

### Beverage-Specific Requirements

| Field | Distilled Spirits | Wine | Malt Beverage |
|-------|:-:|:-:|:-:|
| Brand Name | ✓ | ✓ | ✓ |
| Class/Type | ✓ | ✓ | Optional |
| ABV | ✓ | If >7% | Optional |
| Net Contents | ✓ | ✓ | ✓ |
| Bottler Info | ✓ | ✓ | ✓ |
| Country of Origin | If imported | If imported | If imported |
| Sulfite Declaration | — | If >10ppm | — |
| Appellation | — | Optional | — |
| Government Warning | ✓ | ✓ | ✓ |

---

## Assumptions & Trade-offs

- **No persistent storage** — Analysis results are not saved server-side (stateless prototype). A production system would store results in a database tied to COLA application IDs.
- **No auth** — Set `API_KEY` env var to require bearer token authentication on API routes for production.
- **Batch concurrency** — All batch images are sent to Claude in parallel. With very large batches (50 labels) there may be rate limit pressure; the server handles this gracefully with error flags per file.
- **Image quality** — Claude handles reasonable image quality variations. Very low quality images are flagged as `NEEDS_REVIEW` rather than auto-rejected.
- **Brand name matching** — AI uses judgment for case variations (per Dave's "STONE'S THROW" example) rather than strict equality.

---

*Prototype for TTB Compliance Division · Not for official regulatory use*
