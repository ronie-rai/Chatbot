# GEMINI.md — Workspace Rules for Chatbot SaaS
# Loaded automatically on every agent invocation.

---

## 🔴 UNIVERSAL CODE REVIEW LOOP (Mandatory for ALL code changes)

Every code modification — no matter how small — must complete the following
three-agent pipeline before it is considered accepted.

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   AGENT A   │────▶│   AGENT B   │────▶│  AGENT AUDITOR   │
│  Generate   │     │  Validate   │     │  Final Verdict   │
│  & Edit     │     │  & Verify   │     │  PASS or REJECT  │
└─────────────┘     └─────────────┘     └────────┬─────────┘
       ▲                                          │  REJECT
       └──────────────────────────────────────────┘
                       loops until PASS ✅
```

### Agent A — Code Author
- Implements the change (create / edit / delete files)
- States clearly: what changed, which files, and why

### Agent B — Validator  
Runs these checks and reports ✅ / ❌ for each:
1. **Correctness** — logic matches stated intent
2. **Type safety** — `tsc --noEmit` exit code must be 0
3. **Regression risk** — no unintended breakage of existing features
4. **Completeness** — all affected files updated (imports, exports, tests)
5. **Standards** — matches project conventions (naming, error handling, formatting)

### Agent Auditor — Final Verdict
- Reviews A's change + B's report
- Issues exactly one of:
  - `✅ ACCEPTED` — change is final and applied
  - `❌ REJECTED: <reason>` — specific fix required; loops back to Agent A
- **Loop limit: 3 iterations.** If still failing after 3, STOP and ask the user.

---

## Required Response Format (every code-change reply)

```
═══════════════════════════════════════════════════════════
🛠️  AGENT A — [Brief title of change]
═══════════════════════════════════════════════════════════
[Code changes + explanation]

═══════════════════════════════════════════════════════════
🔍  AGENT B — Validation Report
═══════════════════════════════════════════════════════════
✅/❌  Correctness   — <notes>
✅/❌  Type safety   — tsc --noEmit exit: <0 or N>
✅/❌  Regressions   — <notes>
✅/❌  Completeness  — <notes>
✅/❌  Standards     — <notes>

═══════════════════════════════════════════════════════════
⚖️  AGENT AUDITOR — Final Verdict
═══════════════════════════════════════════════════════════
VERDICT: ✅ ACCEPTED  |  ❌ REJECTED: <reason>
```

---

## Additional Project Rules

- **TypeScript is mandatory** — no `any` without an explicit comment justifying it.
- **Mock fallback pattern** — API calls must fall back to mock data gracefully when the
  server is unreachable (applies to mobile screens).
- **Non-blocking AI turns** — Claude API calls must never block the HTTP response to the
  client; always fire-and-forget with `catch` logging.
- **Tenant isolation** — every Prisma query that touches user data must be scoped by
  `tenantId`. Never query globally across tenants.
- **Secrets never hardcoded** — all credentials go in `.env`; use `process.env.*` with
  a safe default only for local dev.
- **Socket.io events are room-scoped** — never `io.emit(...)` globally; always
  `io.to(conversationId).emit(...)`.
