export default function HomePage(): React.ReactElement {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Chatbot SaaS API</h1>
      <p>Server is running. Use the API endpoints at <code>/api/*</code></p>
      <ul>
        <li><a href="/api/health">GET /api/health</a></li>
      </ul>
    </main>
  );
}
