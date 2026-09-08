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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <img src="/ofa-logo.png" alt="OFA Sports Foundation" style={{ width: 96, height: 96, borderRadius: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111B21", margin: "0 0 8px" }}>
          OFA Sports Foundation
        </h1>
        <p style={{ fontSize: 14, color: "#54656F", margin: "0 0 24px" }}>
          Official AI Chat, Sports Facilities Booking &amp; Analytics Platform
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            href="/dashboard"
            style={{
              display: "block",
              background: "linear-gradient(135deg, #075E54 0%, #00A884 100%)",
              color: "#FFFFFF",
              textDecoration: "none",
              padding: "15px 20px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              boxShadow: "0 4px 12px rgba(0,168,132,0.3)",
            }}
          >
            📊 Open User Data &amp; Insights Dashboard →
          </a>

          <a
            href="/ofa-sports.apk"
            download="ofa-sports.apk"
            style={{
              display: "block",
              backgroundColor: "#000000",
              color: "#FFFFFF",
              textDecoration: "none",
              padding: "14px 20px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              border: "1px solid #333333",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            📱 Download OFA Sports App (APK) ↓
          </a>

          <a
            href="/admin"
            style={{
              display: "block",
              backgroundColor: "#F0F2F5",
              color: "#111B21",
              textDecoration: "none",
              padding: "13px 20px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              border: "1px solid #CFD8DC",
            }}
          >
            ⚙️ Open Super Admin Control Panel →
          </a>

          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              backgroundColor: "transparent",
              color: "#54656F",
              textDecoration: "none",
              padding: "8px 20px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Check API Health
          </a>
        </div>
      </div>
    </main>
  );
}
