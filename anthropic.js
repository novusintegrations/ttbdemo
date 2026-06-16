const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const GOVERNMENT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

const BEVERAGE_SCHEMAS = {
  distilled_spirits: {
    label: "Distilled Spirits",
    requiredFields: [
      { id: "brandName", label: "Brand Name", required: true },
      { id: "classType", label: "Class/Type Designation", required: true },
      { id: "alcoholContent", label: "Alcohol Content (ABV)", required: true },
      { id: "netContents", label: "Net Contents", required: true },
      { id: "bottlerInfo", label: "Bottler/Importer Name & Address", required: true },
      { id: "countryOfOrigin", label: "Country of Origin (if imported)", required: false },
      { id: "governmentWarning", label: "Government Warning Statement", required: true },
    ],
    notes: "Must show ABV as percentage. Proof optional but common. Government warning mandatory.",
  },
  wine: {
    label: "Wine",
    requiredFields: [
      { id: "brandName", label: "Brand Name", required: true },
      { id: "classType", label: "Class/Type Designation", required: true },
      { id: "alcoholContent", label: "Alcohol Content (ABV)", required: false, note: "Required if >7% or labeled as 'table wine'" },
      { id: "netContents", label: "Net Contents", required: true },
      { id: "bottlerInfo", label: "Bottler/Producer Name & Address", required: true },
      { id: "appellation", label: "Appellation of Origin", required: false },
      { id: "vintage", label: "Vintage Year", required: false },
      { id: "sulfiteDeclaration", label: "Sulfite Declaration", required: true, note: "Required if sulfites >10 ppm" },
      { id: "governmentWarning", label: "Government Warning Statement", required: true },
    ],
    notes: "Sulfite declaration required if applicable. Vintage and appellation rules apply.",
  },
  malt_beverage: {
    label: "Malt Beverage / Beer",
    requiredFields: [
      { id: "brandName", label: "Brand Name", required: true },
      { id: "classType", label: "Class/Type Designation", required: false, note: "e.g., Ale, Lager, Stout — not always required" },
      { id: "alcoholContent", label: "Alcohol Content (ABV)", required: false, note: "Required in some states; not federally mandated for all beers" },
      { id: "netContents", label: "Net Contents", required: true },
      { id: "bottlerInfo", label: "Brewer/Packer Name & Address", required: true },
      { id: "countryOfOrigin", label: "Country of Origin (if imported)", required: false },
      { id: "governmentWarning", label: "Government Warning Statement", required: true },
    ],
    notes: "ABV not federally required on all beer labels, but must not be misleading. Government warning always required.",
  },
};

function buildSystemPrompt(beverageType) {
  const schema = BEVERAGE_SCHEMAS[beverageType] || BEVERAGE_SCHEMAS.distilled_spirits;

  return `You are an expert TTB (Alcohol and Tobacco Tax and Trade Bureau) label compliance reviewer with 20 years of experience. You analyze alcohol beverage label images and verify they meet federal TTB COLA (Certificate of Label Approval) requirements.

You are reviewing a ${schema.label} label.

REQUIRED FIELDS FOR THIS BEVERAGE TYPE:
${schema.requiredFields.map((f) => `- ${f.label}${f.required ? " [REQUIRED]" : " [optional]"}${f.note ? `: ${f.note}` : ""}`).join("\n")}

SPECIAL NOTES: ${schema.notes}

GOVERNMENT WARNING — EXACT REQUIRED TEXT:
"${GOVERNMENT_WARNING}"

Government Warning rules:
- "GOVERNMENT WARNING:" must appear in ALL CAPS and BOLD
- Text must be exact word-for-word — no substitutions, abbreviations, or creative variations
- Must be on a contrasting background, legible font
- Minimum font size requirements must appear met (cannot be excessively tiny)
- Title case, lowercase, or any variation of "GOVERNMENT WARNING:" is a violation

COMMON VIOLATIONS TO WATCH FOR:
- "Government Warning" (title case) instead of "GOVERNMENT WARNING:" — REJECT
- Missing colon after GOVERNMENT WARNING — REJECT
- Paraphrased or shortened warning text — REJECT
- ABV discrepancy between label and stated value
- Brand name variation (case differences may be flagged but use judgment — "STONE'S THROW" vs "Stone's Throw" are likely the same brand)
- Missing required fields entirely
- Net contents in non-standard units

RESPONSE FORMAT:
Respond ONLY with valid JSON matching this exact schema:

{
  "overallStatus": "APPROVED" | "REJECTED" | "NEEDS_REVIEW",
  "confidence": 0.0-1.0,
  "extractedData": {
    "brandName": "string or null",
    "classType": "string or null",
    "alcoholContent": "string or null",
    "netContents": "string or null",
    "bottlerInfo": "string or null",
    "countryOfOrigin": "string or null",
    "appellation": "string or null",
    "vintage": "string or null",
    "sulfiteDeclaration": "string or null",
    "governmentWarning": "string or null"
  },
  "checks": [
    {
      "field": "fieldId",
      "label": "Human-readable field name",
      "status": "PASS" | "FAIL" | "WARNING" | "NOT_FOUND" | "N/A",
      "extractedValue": "what was found on label",
      "expectedValue": "what was expected (if applicable)",
      "notes": "explanation of result"
    }
  ],
  "imageQuality": "GOOD" | "FAIR" | "POOR",
  "imageQualityNotes": "any issues with image quality affecting review",
  "summaryNotes": "Overall summary for the agent",
  "governmentWarningDetails": {
    "found": true | false,
    "isAllCaps": true | false,
    "textMatch": "EXACT" | "PARTIAL" | "WRONG" | "MISSING",
    "extractedText": "the actual text found",
    "violations": ["list of specific violations if any"]
  }
}

Be precise, professional, and err on the side of flagging issues for human review rather than auto-approving. Use "NEEDS_REVIEW" for ambiguous cases where the image quality prevents certainty.`;
}

async function analyzeLabel({ imageBase64, mimeType, beverageType, applicationData }) {
  const schema = BEVERAGE_SCHEMAS[beverageType] || BEVERAGE_SCHEMAS.distilled_spirits;

  const userContent = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType,
        data: imageBase64,
      },
    },
    {
      type: "text",
      text: applicationData
        ? `Please analyze this ${schema.label} label image for TTB compliance.

APPLICATION DATA (what the applicant claimed):
${JSON.stringify(applicationData, null, 2)}

Verify that the label matches the application data AND meets all TTB requirements. Flag any discrepancies between what the applicant stated and what appears on the label.`
        : `Please analyze this ${schema.label} label image for TTB compliance. Extract all visible information and check it against TTB requirements.`,
    },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: buildSystemPrompt(beverageType),
    messages: [{ role: "user", content: userContent }],
  });

  const rawText = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Parse JSON, stripping any markdown fences
  const clean = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const result = JSON.parse(clean);

  return {
    ...result,
    beverageType,
    beverageTypeLabel: schema.label,
    analyzedAt: new Date().toISOString(),
    modelUsed: "claude-sonnet-4-6",
  };
}

module.exports = { analyzeLabel, BEVERAGE_SCHEMAS, GOVERNMENT_WARNING };
