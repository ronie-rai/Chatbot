import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Install OFA Assistant — Add to iPhone Home Screen",
  description: "Install OFA Sports Foundation assistant on your iPhone or Android — no App Store needed",
};

export default function InstallPage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OFA Assistant" />
        <meta name="theme-color" content="#25D366" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <link rel="manifest" href="/manifest.json" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #0d1f14 50%, #0a0a0a 100%);
            min-height: 100vh;
            color: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 0 20px 40px;
          }
          .hero {
            text-align: center;
            padding: 60px 0 40px;
          }
          .logo {
            width: 100px;
            height: 100px;
            background: linear-gradient(135deg, #25D366, #128C7E);
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 52px;
            margin: 0 auto 24px;
            box-shadow: 0 0 40px rgba(37,211,102,0.3);
          }
          h1 {
            font-size: 28px;
            font-weight: 700;
            background: linear-gradient(135deg, #25D366, #9BE3BC);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 8px;
          }
          .subtitle {
            color: #9CA3AF;
            font-size: 15px;
            max-width: 320px;
            margin: 0 auto;
            line-height: 1.5;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(37,211,102,0.1);
            border: 1px solid rgba(37,211,102,0.3);
            border-radius: 20px;
            padding: 6px 14px;
            font-size: 13px;
            color: #25D366;
            margin-top: 16px;
          }
          .cards {
            width: 100%;
            max-width: 420px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-top: 32px;
          }
          .card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 24px;
          }
          .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
          }
          .platform-icon {
            font-size: 28px;
          }
          .card-title {
            font-size: 17px;
            font-weight: 600;
          }
          .card-subtitle {
            font-size: 13px;
            color: #9CA3AF;
          }
          .steps {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .step {
            display: flex;
            align-items: flex-start;
            gap: 12px;
          }
          .step-num {
            min-width: 28px;
            height: 28px;
            background: linear-gradient(135deg, #25D366, #128C7E);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            flex-shrink: 0;
          }
          .step-text {
            font-size: 14px;
            color: #D1D5DB;
            line-height: 1.5;
            padding-top: 4px;
          }
          .step-text strong {
            color: #fff;
          }
          .icon-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 2px 8px;
            font-size: 13px;
            vertical-align: middle;
          }
          .cta {
            width: 100%;
            max-width: 420px;
            margin-top: 32px;
            text-align: center;
          }
          .open-btn {
            display: block;
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #25D366, #128C7E);
            border-radius: 16px;
            color: #fff;
            font-size: 16px;
            font-weight: 700;
            text-decoration: none;
            box-shadow: 0 8px 24px rgba(37,211,102,0.3);
          }
          .features {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 16px;
          }
          .feature {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px;
            padding: 12px;
            font-size: 13px;
            color: #9CA3AF;
          }
          .feature span { display: block; font-size: 20px; margin-bottom: 4px; }
          .footer {
            margin-top: 32px;
            font-size: 12px;
            color: #4B5563;
            text-align: center;
          }
        `}</style>
      </head>
      <body>
        <div className="hero">
          <div className="logo">🤖</div>
          <h1>OFA Assistant</h1>
          <p className="subtitle">Your AI-powered sports foundation assistant — bookings, admissions, enquiries & more</p>
          <div className="badge">✅ No App Store · No Apple ID · Free</div>
        </div>

        <div className="cards">
          {/* iOS Card */}
          <div className="card">
            <div className="card-header">
              <span className="platform-icon"></span>
              <div>
                <div className="card-title">Install on iPhone / iPad</div>
                <div className="card-subtitle">Open this page in Safari</div>
              </div>
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-text">Open <strong>Safari</strong> on your iPhone (must be Safari, not Chrome)</div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-text">Go to <strong>chatbot-server-seven-phi.vercel.app</strong></div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-text">Tap the <span className="icon-pill">⬆️ Share</span> button at the bottom of Safari</div>
              </div>
              <div className="step">
                <div className="step-num">4</div>
                <div className="step-text">Scroll down and tap <span className="icon-pill">➕ Add to Home Screen</span></div>
              </div>
              <div className="step">
                <div className="step-num">5</div>
                <div className="step-text">Tap <strong>Add</strong> — OFA Assistant icon appears on your home screen!</div>
              </div>
            </div>
          </div>

          {/* Android Card */}
          <div className="card">
            <div className="card-header">
              <span className="platform-icon">🤖</span>
              <div>
                <div className="card-title">Install on Android</div>
                <div className="card-subtitle">Download APK or use browser</div>
              </div>
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">A</div>
                <div className="step-text"><strong>Option 1 — APK (Recommended):</strong> Download and install the APK directly — works like a native app with push notifications</div>
              </div>
              <div className="step">
                <div className="step-num">B</div>
                <div className="step-text"><strong>Option 2 — Browser:</strong> Open in Chrome → tap ⋮ menu → <strong>Add to Home screen</strong></div>
              </div>
            </div>
            <a
              href="https://expo.dev/accounts/rohit_remag97/projects/chatbot-saas/builds/5c3230ed-1e57-4c3f-bb4b-efcadb988912"
              className="open-btn"
              style={{ marginTop: '16px', fontSize: '14px' }}
            >
              📥 Download Android APK
            </a>
          </div>
        </div>

        <div className="cta">
          <a href="/" className="open-btn">🚀 Open OFA Assistant</a>
          <div className="features">
            <div className="feature"><span>💬</span>AI Chat Assistant</div>
            <div className="feature"><span>📋</span>Forms & Templates</div>
            <div className="feature"><span>📊</span>Live Dashboard</div>
            <div className="feature"><span>🔔</span>Notifications</div>
          </div>
        </div>

        <div className="footer">
          OFA Sports Foundation · PWA · Works offline<br />
          No Apple ID · No App Store · No cost
        </div>
      </body>
    </html>
  );
}
