# WhatsApp-Style AI Chatbot SaaS

A cross-platform SaaS chat application styled after WhatsApp, backed by an AI assistant with tool-calling capabilities. The AI extracts important information from conversations and inserts it into a tenant's Google Sheet.

## Monorepo Structure

```
/
├── apps/
│   ├── mobile/          → Expo React Native app (Android first)
│   └── realtime/        → Socket.io real-time server
├── packages/
│   └── shared-types/    → Shared TypeScript types (Message, Conversation, etc.)
├── server/              → Next.js App Router + Prisma + AI integration
└── turbo.json           → Turborepo pipeline
```

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo React Native (TypeScript) |
| API Server | Next.js 14 App Router |
| Real-time | Socket.io (self-hosted) |
| Database | PostgreSQL + Prisma ORM |
| AI | Groq (Llama 3.3 70B / 8B) with tool-calling |
| Sheets | Google Sheets API (service account) |
| Monorepo | Turborepo + pnpm workspaces |

## Build Phases

- **Phase 0** ✅ — Repo & Environment Scaffolding
- **Phase 1** — Data Model (Prisma schema + migrations + seed)
- **Phase 2** — Chat UI Skeleton (WhatsApp-styled, mock data)
- **Phase 3** — REST API for Messages
- **Phase 4** — Real-Time, Room-Scoped Delivery (Socket.io)
- **Phase 5** — AI Integration (Groq Chat Completions API)
- **Phase 6** — Tool Calling: Google Sheets Insert
- **Phase 7** — Multi-Tenancy Hardening
- **Phase 8** — Auth & Session
- **Phase 9** — Polish & Build (EAS Android build)

## Quick Start

### Prerequisites
- PostgreSQL database (Local installation, Supabase, Neon, or Railway)
- Node.js 18+
- pnpm 9+
- Expo Go app on Android device (or Android emulator)

### 1. Clone & Install
```bash
git clone <repo-url>
cd chatbot-saas
pnpm install
```

### 2. Set Up Environment
```bash
# Server
cp server/.env.example server/.env

# Mobile
cp apps/mobile/.env.example apps/mobile/.env

# Realtime
cp apps/realtime/.env.example apps/realtime/.env
```

Edit `server/.env` and fill in:
- `DATABASE_URL` (PostgreSQL connection string)
- `GROQ_API_KEY` (from [console.groq.com/keys](https://console.groq.com/keys))
- Other values as needed

### 3. Set Up Prisma
```bash
pnpm db:push       # Push schema to DB
pnpm db:seed       # Seed initial data (Phase 1+)
```

### 4. Start Development Servers
```bash
# Start all apps in parallel
pnpm dev
```

Or start individually:
```bash
# API server — http://localhost:3000
cd server && pnpm dev

# Realtime server — http://localhost:4000
cd apps/realtime && pnpm dev

# Mobile app (Expo)
cd apps/mobile && pnpm dev
```

### 5. Verify
- API health: http://localhost:3000/api/health
- Realtime health: http://localhost:4000/health
- Scan the Expo QR code with Expo Go

## Environment Variables Reference

### `server/.env`
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | Groq model (e.g. `llama-3.3-70b-versatile`) |
| `GOOGLE_SERVICE_ACCOUNT_PATH` | Path to GCP service account JSON |
| `REALTIME_SERVER_URL` | Internal URL of the Socket.io server |
| `REALTIME_SECRET` | Shared secret between API and realtime servers |
| `NEXTAUTH_SECRET` | Auth secret |

### `apps/mobile/.env`
| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Next.js API URL |
| `EXPO_PUBLIC_REALTIME_URL` | Socket.io server URL |

### `apps/realtime/.env`
| Variable | Description |
|---|---|
| `PORT` | Port the Socket.io server listens on |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `REALTIME_SECRET` | Shared secret |
