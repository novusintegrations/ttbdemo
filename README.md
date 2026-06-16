# TTB Label Verifier

**AI-powered COLA label compliance review for alcohol beverage producers, importers, and TTB compliance teams.**

The TTB (Alcohol and Tobacco Tax and Trade Bureau) reviews approximately 150,000 Certificate of Label Approval (COLA) applications each year. Each review requires an agent to manually examine a physical label image and verify that every required element such as brand name, class designation, alcohol content, government warning statement, and more matches what was submitted in the application, and meets the specific formatting and placement requirements set out in 27 CFR.

This tool uses Claude Vision (Anthropic's multimodal AI) to read a label image the same way a trained agent would, then cross-references every field against the application data in seconds. The result is a structured, per-field compliance report with specific CFR citations behind each finding. Claude is a widely recognizable and vetted application that can be deployed securely, governed, and accessed easily by governemnt organizations. 

---

## Who this is for

**TTB compliance agents** use this to pre-screen label submissions before formal review, reducing time spent on routine matching tasks and focusing attention on edge cases and judgment calls.

**Alcohol beverage producers and importers** use this before submitting a COLA application to catch formatting errors, missing elements, and government warning violations that would result in rejection.

**Compliance consultants and label designers** use this as a checklist tool when preparing labels for multiple SKUs or clients across different beverage categories.

**Technology and innovation teams** use this as a working prototype to demonstrate how AI-assisted document review can reduce processing backlogs and support federal compliance workflows.

---

## What it checks

The tool verifies seven fields on every label, with rules that vary by beverage type:

| Field | Checked Against |
|---|---|
| Brand name | Application field — exact or near match |
| Class / type designation | Application field + CFR designation rules |
| Alcohol content | Application field + format requirements by type |
| Net contents | Application field |
| Bottler / producer name and address | Application field |
| Country of origin | Application field (imports only) |
| Government Health Warning Statement | 27 CFR Part 16 — verbatim, format, placement |

Each check returns one of four statuses:

- **Pass** — label matches the application and meets the applicable requirement
- **Warn** — close match with a minor discrepancy that warrants human review (e.g. capitalization difference in brand name)
- **Fail** — clear mismatch, missing required element, or formatting violation
- **Skip** — field not provided in the application; AI still reads what appears on the label

---

## Beverage type rules

The verification engine loads a different CFR rule set depending on the beverage type selected. Not a generic check, each type has substantively different requirements.

### Distilled Spirits — 27 CFR Part 5

The most structurally demanding category. Three fields must appear together:

- **Same field of vision required (§5.63(a)):** Brand name, alcohol content, and class/type designation must all appear on the same side of the container and be visible simultaneously without turning it. For cylindrical containers, one side is defined as 40% of the circumference. The AI flags any label where these three elements are not co-located.
- **Alcohol content format (§5.65):** Must state percentage of alcohol by volume. "Proof" alone is not acceptable. Both % ABV and proof stated together is the common and acceptable format.
- **Name and address (§5.66–5.68):** Name and address of the bottler or distiller is required. For imported products, the importer's information is required.
- **Net contents (§5.70):** Required, but may be blown, embossed, or molded into the container rather than printed on the label.
- **Age statement (§5.74):** Required on straight whiskies aged less than 4 years. If an age statement appears, the AI verifies its presence and format.
- **Neutral spirits disclosure (§5.75):** If the product contains 2.5% or more neutral spirits, the source must be disclosed on the label.

Reference: [27 CFR Part 5 Subpart A — ecfr.gov](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-A)

### Malt Beverage — 27 CFR Part 7

The most permissive category in terms of placement, but with specific rules around alcohol content disclosure:

- **No same-field-of-vision requirement:** Mandatory information may appear anywhere on any label on the container.
- **Brand name (§7.64):** Required.
- **Class and type designation (§7.141):** Required. Acceptable designations include Beer, Ale, Lager, Porter, Stout, and others defined in the regulation. Generic designations are acceptable.
- **Alcohol content (§7.63, §7.65):** Only mandatory if the product's alcohol content is derived from added flavors or non-beverage ingredients other than hop extract. If alcohol content is shown voluntarily, the abbreviation "ABV" is NOT acceptable — the label must spell out "alcohol by volume" or use the approved abbreviations defined in §7.65.
- **Name and address (§7.66–7.68):** Required. For imports, the importer's name and address.
- **Allergen/additive declarations (§7.63(b)):** FD&C Yellow No. 5, cochineal extract or carmine, sulfites (if ≥10 ppm), and aspartame must be declared if present.

Reference: [27 CFR Part 7 Subpart A — ecfr.gov](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7/subpart-A)

### Wine — 27 CFR Part 4

The most complex category, with several conditional requirements that trigger based on what appears on the label:

- **Brand label placement (§4.33–4.34):** Brand name AND class/type designation must appear on the brand label specifically — not just anywhere on the container. A color descriptor alone (e.g., "Rosé") is NOT a valid class/type. Must be "Rosé Wine," "Table Wine," "Sparkling Wine," "Chardonnay," etc.
- **Alcohol content (§4.36):** Mandatory for wines over 14% ABV. Optional for wines between 7–14% ABV only if "table wine" or "light wine" appears as the class/type designation. The abbreviation "ABV" is NOT acceptable — must use "alcohol by volume" or "alc. by vol."
- **Appellation of origin (§4.25):** Mandatory on the brand label in three situations: (a) a grape variety is used as the class/type designation, (b) a vintage date appears anywhere on the label, or (c) a geographic area is implied. If an appellation is stated, at least 75% of the wine must be derived from grapes grown in that area (85% for state or county appellations).
- **Grape variety (§4.23):** If used as the class/type designation, at least 75% of the wine must derive from that variety, and appellation of origin becomes mandatory.
- **Sulfite declaration (§4.32(e)):** Required if sulfites are present at 10 ppm or more, measured as total SO₂.
- **Vintage date (§4.27):** Optional, but if shown, appellation of origin becomes mandatory. Not permitted on imported wines in containers larger than 5 liters.
- **Name and address (§4.35–4.37):** Must match the bottler's or importer's basic permit exactly. City and state are required.

Reference: [TTB Anatomy of a Wine Label](https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/anatomy-of-a-label)

### Government Health Warning Statement — 27 CFR Part 16

Required on ALL alcohol beverages containing 0.5% ABV or more, domestic and imported, under the Alcoholic Beverage Labeling Act of 1988. This is verified on every label regardless of beverage type.

**Required verbatim text:**

> GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

**Formatting requirements (§16.22):**
- "GOVERNMENT WARNING:" must appear in ALL CAPS and be bold
- The remainder of the statement must NOT be bold
- Must appear separate and apart from all other information on the label (§16.21)
- Must be on a contrasting background and be readily legible
- Must appear as a continuous statement — cannot be split across multiple labels or panels
- Applies to domestic and imported products (§16.20)

**Minimum type size by container volume (§16.22):**
- 1 mm — containers of 237 ml (8 fl. oz.) or less
- 2 mm — containers between 237 ml and 3 liters
- 3 mm — containers over 3 liters

**Common failure modes flagged by the AI:**
- Title case formatting ("Government Warning:" instead of "GOVERNMENT WARNING:")
- Bold applied to the entire statement rather than the heading only
- Wrong, paraphrased, or truncated text
- Statement buried within other label text rather than appearing separately
- Type size too small to be legible at the required minimum

Reference: [27 CFR Part 16 — ecfr.gov](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16)

---

## How to use the application

### Single label verification

1. Open the app and select the **Verify** tab
2. Select the beverage type — **Distilled Spirits**, **Malt Beverage**, or **Wine** — using the buttons at the top of the form. This loads the correct CFR rule set and updates the form field hints accordingly.
3. Upload the label image by dragging it into the drop zone or clicking to browse. JPG, PNG, and WEBP are supported up to 5 MB.
4. Fill in the COLA application fields:
   - **Brand name** — exactly as it appears in the application
   - **Class / type** — the designation as submitted
   - **Alcohol content** — as stated in the application (e.g., "45% Alc./Vol. (90 Proof)")
   - **Net contents** — as stated (e.g., "750 mL")
   - **Bottler / producer** — name and full address
   - **Country of origin** — leave blank for domestic products
   - **Reviewer notes** — optional context for the AI (unusual circumstances, known label versions, etc.)
5. Click **Verify Label**. The AI reads the image and returns results in under 10 seconds.
6. Review the per-field results table. Each field shows its status, what was found on the label, what was expected from the application, and a specific note explaining any discrepancy.
7. Export the result as a **CSV** (for records or import into a case management system), an **HTML report** (formatted, printable), or copy the **raw JSON** for integration with other systems.

### Batch processing

For importers or producers submitting multiple labels simultaneously:

1. Click **+ Batch** in the top bar
2. Select multiple image files — each image should be one label
3. Fill in the COLA application fields in the form (these apply to all images in the batch)
4. Click **Run all**
5. The AI verifies each image in sequence, showing a live status indicator per file
6. When complete, a structured CSV downloads automatically

The batch CSV is structured with one row per label and four dedicated columns per check field — Status, Found on Label, Expected (from Application), and Note — making it directly readable and filterable in Excel without any reformatting.

### The About tab

The About tab provides a full explanation of the tool's purpose, the technology stack, a step-by-step workflow diagram, and the complete regulatory coverage for all four CFR parts. This is intended as an orientation resource for new users and a reference for stakeholders evaluating the tool.

---

## Technology stack

| Component | Technology | Purpose |
|---|---|---|
| AI vision and reasoning | Anthropic Claude claude-sonnet-4-6 | Reads label images, performs compliance reasoning, returns structured JSON |
| Backend proxy | Node.js (server.js) | Holds API key server-side, proxies /api/verify to Anthropic |
| Frontend | Single-file HTML | Zero-dependency UI — no framework, no build step, no CDN |
| Hosting | Render.com | Runs the Node server, stores the API key as an environment variable |
| Source control | GitHub | Stores code — API key never committed |
| Regulatory source | 27 CFR Parts 4, 5, 7, 16 | All verification rules grounded in current federal regulations |

### Security model

The Anthropic API key is stored exclusively as a Render environment variable. It is:
- Never written into any source file
- Never committed to the GitHub repository
- Never sent to or visible in the browser
- Loaded at runtime via `process.env.ANTHROPIC_API_KEY`

The server exits immediately on startup if the key is not present, rather than serving a broken application.

### Data handling

Label images and application data are transmitted to Anthropic's API for analysis only. This application does not log, store, or retain any submitted images or field data. Session history displayed in the UI exists only in the browser's memory and is cleared when the tab is closed.

---

## Deployment

### Prerequisites

- A GitHub account
- A Render account ([render.com](https://render.com) — free tier is sufficient for prototype use)
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "TTB Label Verifier"
git remote add origin https://github.com/YOUR_ORG/ttb-verifier.git
git push -u origin main
```

The `.gitignore` excludes `.env` and `node_modules`. The API key should never appear in any committed file.

### Step 2 — Create a Render Web Service

1. Log in to [render.com](https://render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub account and select the `ttb-verifier` repository
4. Configure the service:

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | *(leave blank)* |
| Start command | `node server.js` |
| Instance type | Free (or Starter for production use) |

### Step 3 — Set the API key

Under **Environment** → **Add environment variable:**

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |

### Step 4 — Deploy

Click **Create Web Service**. Render clones the repo, installs nothing (no dependencies), and starts the server. Your live URL appears at the top of the Render dashboard.

To redeploy after any code change: `git push` — Render deploys automatically on every push to the connected branch.

### Verifying deployment

The server exposes a health check endpoint:

```
GET https://your-site.onrender.com/health
```

Returns:
```json
{ "status": "ok", "timestamp": "2024-06-11T14:22:36.000Z" }
```

Check the Render logs on startup for:
```
TTB Label Verifier running on port 3000
API key: loaded ✓
```

If you see `API key: MISSING ✗`, the environment variable is not set — add it in Render's dashboard and redeploy.

### Local development

No package installation is needed. Run:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here node server.js
```

Open `http://localhost:3000`.

---

## Limitations and intended use

This tool is a **working prototype**, not a certified compliance system. It is intended to assist human reviewers, not replace them.

- The AI reads label images as a skilled human would, but image quality affects accuracy. Blurry, low-contrast, or heavily angled images may produce less reliable results.
- The AI's confidence varies by label complexity. Simple, clear labels with standard formatting return highly reliable results. Unusual layouts or novel designations should always receive human review.
- Regulatory text in this tool reflects 27 CFR as of the development date. Always consult the current eCFR for authoritative and up-to-date regulatory text.
- All findings carry a final human review requirement. The tool surfaces issues for agent judgment — it does not make official TTB determinations.

---

## Regulatory references

| Regulation | Scope | Link |
|---|---|---|
| 27 CFR Part 4 | Wine labeling | [ecfr.gov](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4) |
| 27 CFR Part 5 Subpart A | Distilled spirits labeling | [ecfr.gov](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-A) |
| 27 CFR Part 7 Subpart A | Malt beverage labeling | [ecfr.gov](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7/subpart-A) |
| 27 CFR Part 16 | Government health warning | [ecfr.gov](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16) |
| TTB Wine Label Anatomy | Wine label interactive guide | [ttb.gov](https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/anatomy-of-a-label) |
| Alcoholic Beverage Labeling Act of 1988 | Statutory basis for warning requirement | [govinfo.gov](https://www.govinfo.gov/content/pkg/STATUTE-102/pdf/STATUTE-102-Pg3371.pdf) |

---

*TTB Label Verifier · COLA Compliance Prototype · Not an official TTB determination.*
