import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Chatbot AI",
  description: "How Chatbot AI collects, stores, and uses your data.",
};

export default function PrivacyPage() {
  const date = "31 August 2026";

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, color: "#111B21" }}>
      {/* Header */}
      <div style={{ borderBottom: "3px solid #075E54", paddingBottom: 24, marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 40 }}>💬</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#075E54" }}>Chatbot AI</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 8px" }}>Privacy Policy</h1>
        <p style={{ color: "#667781", margin: 0 }}>Last updated: {date}</p>
      </div>

      <Section title="1. Overview">
        Chatbot AI is a WhatsApp-style business messaging SaaS that uses AI to assist your
        customers and capture enquiry details. This policy explains what data we collect, why,
        and how we protect it.
      </Section>

      <Section title="2. Data We Collect">
        <ul>
          <li><strong>Account data:</strong> name, email address, hashed password, and tenant (organisation) association.</li>
          <li><strong>Chat messages:</strong> text content of messages sent in AI conversations, stored to maintain conversation history.</li>
          <li><strong>Extracted customer information:</strong> contact details (name, phone number, enquiry) identified by the AI from chat messages and inserted into your Google Sheet.</li>
          <li><strong>Usage metadata:</strong> message timestamps, read/delivery status, and IP address for security logging.</li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Data">
        <ul>
          <li>To operate the chat service and deliver AI responses in real time.</li>
          <li>To insert captured customer details into your configured Google Sheet.</li>
          <li>To maintain conversation history for context-aware AI replies.</li>
          <li>To authenticate users and enforce tenant isolation (no cross-tenant data access).</li>
        </ul>
      </Section>

      <Section title="4. Google Sheets Integration">
        When you connect a Google Sheet, our service uses a Google service account to append rows
        containing AI-extracted customer data. We do <strong>not</strong> read any existing data
        in your spreadsheet. You control which spreadsheet is connected and can revoke access at
        any time by removing the service account from your Google Sheet&apos;s sharing settings.
      </Section>

      <Section title="5. AI Processing">
        Messages are sent to Anthropic&apos;s Claude API to generate responses and identify
        extractable information. Anthropic&apos;s own{" "}
        <a href="https://www.anthropic.com/privacy" style={{ color: "#128C7E" }}>Privacy Policy</a>
        {" "}applies to this processing. We do not share personally identifiable information with
        other third parties.
      </Section>

      <Section title="6. Data Retention">
        <ul>
          <li>Chat messages are retained for as long as your account is active.</li>
          <li>Upon account termination, all message data is deleted within 30 days.</li>
          <li>Data in your Google Sheet is entirely under your control.</li>
        </ul>
      </Section>

      <Section title="7. Security">
        <ul>
          <li>Passwords are stored as bcrypt hashes — never in plaintext.</li>
          <li>All API communication is over HTTPS.</li>
          <li>Real-time events are authenticated with a shared secret between services.</li>
          <li>Tenant isolation is enforced at the database level — each query is scoped by tenant ID.</li>
        </ul>
      </Section>

      <Section title="8. Your Rights">
        You may request access to, correction of, or deletion of your personal data at any time
        by contacting us at <a href="mailto:privacy@yourcompany.com" style={{ color: "#128C7E" }}>privacy@yourcompany.com</a>.
      </Section>

      <Section title="9. Changes to This Policy">
        We will notify users of material changes via in-app notice or email at least 14 days
        before changes take effect.
      </Section>

      <Section title="10. Contact">
        For any privacy questions, email{" "}
        <a href="mailto:privacy@yourcompany.com" style={{ color: "#128C7E" }}>privacy@yourcompany.com</a>.
      </Section>

      <footer style={{ marginTop: 64, paddingTop: 24, borderTop: "1px solid #E9EDEF", color: "#667781", fontSize: 14 }}>
        © {new Date().getFullYear()} Chatbot AI. All rights reserved.
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#075E54", borderLeft: "4px solid #25D366", paddingLeft: 12, margin: "0 0 12px" }}>
        {title}
      </h2>
      <div style={{ color: "#374151" }}>{children}</div>
    </section>
  );
}
