import React from "react";

export default function HomePage(): React.ReactElement {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#075E54",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "2rem",
      }}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: "40px 32px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontSize: 54, marginBottom: 12 }}>🏆</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111B21", margin: "0 0 8px" }}>
          OFA Chatbot Platform
        </h1>
        <p style={{ fontSize: 14, color: "#54656F", margin: "0 0 24px" }}>
          Intelligent multi-tenant assistant for <strong>OFA_Sports</strong> and organizations with Google Sheets sync.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            href="/admin"
            style={{
              display: "block",
              backgroundColor: "#00A884",
              color: "#FFFFFF",
              textDecoration: "none",
              padding: "14px 20px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            Open Admin Control Panel →
          </a>

          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              backgroundColor: "#F0F2F5",
              color: "#111B21",
              textDecoration: "none",
              padding: "12px 20px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Check API Health
          </a>
        </div>
      </div>
    </main>
  );
}
