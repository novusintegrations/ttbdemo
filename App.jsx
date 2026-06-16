import React, { useState, useEffect } from "react";
import SingleReview from "./components/SingleReview.jsx";
import BatchReview from "./components/BatchReview.jsx";
import Integrations from "./components/Integrations.jsx";
import Reference from "./components/Reference.jsx";

const TABS = [
  { id: "single", label: "Single Label Review" },
  { id: "batch", label: "Batch Review" },
  { id: "integrations", label: "Integrations & API" },
  { id: "reference", label: "TTB Reference" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("single");
  const [ribbonStatus, setRibbonStatus] = useState("idle");

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="header-seal">🍷</div>
            <div>
              <div className="header-title">TTB Label Verifier</div>
              <div className="header-subtitle">Alcohol Label Compliance · AI-Powered Review</div>
            </div>
          </div>
          <div className="header-badge">COLA Compliance Tool · Prototype</div>
        </div>
      </header>

      {/* Status ribbon (signature element) */}
      <div className={`status-ribbon ${ribbonStatus}`} />

      {/* Nav */}
      <nav className="nav-tabs">
        <div className="nav-tabs-inner">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main className="main">
        {activeTab === "single" && <SingleReview onStatusChange={setRibbonStatus} />}
        {activeTab === "batch" && <BatchReview />}
        {activeTab === "integrations" && <Integrations />}
        {activeTab === "reference" && <Reference />}
      </main>

      {/* Footer */}
      <footer style={{
        background: "var(--navy)",
        color: "rgba(255,255,255,0.45)",
        textAlign: "center",
        padding: "1rem",
        fontSize: "0.75rem",
        letterSpacing: "0.04em",
        marginTop: "auto",
      }}>
        TTB Label Verifier · Prototype · Powered by Claude (Anthropic) · Not for official regulatory use
      </footer>
    </div>
  );
}
