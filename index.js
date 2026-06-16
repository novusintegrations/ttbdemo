require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const { analyzeLabel } = require("./anthropic");
const { notifyTeams } = require("./integrations/teams");
const { webhookRouter } = require("./webhooks");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static client build in production
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "../../client/dist");
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
  }
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Too many requests. Please wait a moment and try again." },
});
app.use("/api/", limiter);

// File upload config
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    features: {
      anthropicConnected: !!process.env.ANTHROPIC_API_KEY,
      teamsEnabled: !!process.env.TEAMS_WEBHOOK_URL,
      batchEnabled: true,
    },
  });
});

// Single label analysis
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file && !req.body.imageBase64) {
      return res.status(400).json({ error: "No image provided. Upload a file or supply imageBase64." });
    }

    const bevType = req.body.beverageType || "distilled_spirits";
    const applicationData = req.body.applicationData ? JSON.parse(req.body.applicationData) : null;

    let imageBase64, mimeType;
    if (req.file) {
      imageBase64 = req.file.buffer.toString("base64");
      mimeType = req.file.mimetype;
    } else {
      const parts = req.body.imageBase64.split(",");
      imageBase64 = parts.length > 1 ? parts[1] : parts[0];
      mimeType = req.body.mimeType || "image/jpeg";
    }

    const result = await analyzeLabel({ imageBase64, mimeType, beverageType: bevType, applicationData });

    // Optionally notify Teams
    if (process.env.TEAMS_WEBHOOK_URL && result.overallStatus === "REJECTED") {
      await notifyTeams(result, "single").catch(console.error);
    }

    res.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ error: err.message || "Analysis failed. Please try again." });
  }
});

// Batch label analysis
app.post("/api/analyze/batch", upload.array("images", 50), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: "No images provided for batch analysis." });
    }

    const bevType = req.body.beverageType || "distilled_spirits";
    const batchId = uuidv4();

    // Process concurrently with a concurrency cap of 5
    const results = [];
    const queue = [...files];
    const concurrency = 5;
    let active = 0;

    const process = (file) =>
      analyzeLabel({
        imageBase64: file.buffer.toString("base64"),
        mimeType: file.mimetype,
        beverageType: bevType,
        applicationData: null,
      }).then((r) => ({ ...r, filename: file.originalname }))
        .catch((e) => ({
          filename: file.originalname,
          overallStatus: "ERROR",
          error: e.message,
          checks: [],
        }));

    const runAll = async () => {
      const promises = files.map((f) => process(f));
      const settled = await Promise.allSettled(promises);
      return settled.map((s, i) =>
        s.status === "fulfilled" ? s.value : { filename: files[i].originalname, overallStatus: "ERROR", checks: [] }
      );
    };

    const batchResults = await runAll();
    const summary = {
      batchId,
      total: batchResults.length,
      approved: batchResults.filter((r) => r.overallStatus === "APPROVED").length,
      rejected: batchResults.filter((r) => r.overallStatus === "REJECTED").length,
      errors: batchResults.filter((r) => r.overallStatus === "ERROR").length,
      processedAt: new Date().toISOString(),
    };

    if (process.env.TEAMS_WEBHOOK_URL) {
      await notifyTeams({ summary, results: batchResults }, "batch").catch(console.error);
    }

    res.json({ summary, results: batchResults });
  } catch (err) {
    console.error("Batch error:", err);
    res.status(500).json({ error: err.message || "Batch analysis failed." });
  }
});

// Webhook routes (for external integrations)
app.use("/api/webhooks", webhookRouter);

// API key info route
app.get("/api/integrations", (req, res) => {
  res.json({
    available: [
      {
        id: "teams",
        name: "Microsoft Teams",
        description: "Send rejection alerts and batch summaries to a Teams channel",
        configured: !!process.env.TEAMS_WEBHOOK_URL,
        docsUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
      },
      {
        id: "webhook",
        name: "Custom Webhook",
        description: "POST analysis results to any endpoint (Zapier, Make, n8n, Power Automate)",
        configured: !!process.env.OUTBOUND_WEBHOOK_URL,
        docsUrl: "/api/webhooks/docs",
      },
      {
        id: "api",
        name: "REST API",
        description: "Direct API access with API key authentication",
        configured: true,
        docsUrl: "/api/docs",
      },
    ],
  });
});

// API docs
app.get("/api/docs", (req, res) => {
  res.json({
    version: "1.0.0",
    baseUrl: `${req.protocol}://${req.get("host")}/api`,
    endpoints: [
      { method: "GET", path: "/health", description: "Health check" },
      { method: "POST", path: "/analyze", description: "Analyze a single label image", body: "multipart/form-data: image (file), beverageType (string), applicationData (JSON string)" },
      { method: "POST", path: "/analyze/batch", description: "Analyze up to 50 labels", body: "multipart/form-data: images[] (files), beverageType (string)" },
      { method: "GET", path: "/integrations", description: "List available integrations" },
      { method: "POST", path: "/webhooks/register", description: "Register an outbound webhook" },
    ],
    authentication: "Pass x-api-key header if API_KEY env var is set",
    sdkExample: `
// Node.js
const form = new FormData();
form.append('image', fs.createReadStream('label.jpg'));
form.append('beverageType', 'distilled_spirits');
const res = await fetch('${req.protocol}://${req.get("host")}/api/analyze', {
  method: 'POST', body: form
});
const result = await res.json();
    `.trim(),
  });
});

// SPA fallback
if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    const idx = path.join(__dirname, "../../client/dist/index.html");
    if (fs.existsSync(idx)) res.sendFile(idx);
    else res.status(404).json({ error: "Client not built" });
  });
}

app.listen(PORT, () => {
  console.log(`\n🍷 TTB Label Verifier API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Docs:   http://localhost:${PORT}/api/docs`);
  console.log(`   Anthropic: ${process.env.ANTHROPIC_API_KEY ? "✓ configured" : "✗ missing ANTHROPIC_API_KEY"}`);
  console.log(`   Teams:     ${process.env.TEAMS_WEBHOOK_URL ? "✓ configured" : "○ optional"}\n`);
});
