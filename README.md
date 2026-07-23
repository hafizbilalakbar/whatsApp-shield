# Antigravity Shield

> **Enterprise WhatsApp Business Suite** — Bulk number validation, anti-ban protection, AI-powered CRM, and conversation intelligence.

Antigravity Shield is a full-stack, production-ready platform for businesses that rely on WhatsApp communication. It combines a high-performance bulk number validator with intelligent anti-ban safeguards, a complete CRM messaging hub, and an AI-powered conversation intelligence engine — all behind a single QR-linked WhatsApp session.

---

## Features

### WhatsApp Shield — Number Validation
- **Bulk Validation** — Verify thousands of numbers against WhatsApp's network in real-time with live progress tracking and per-number status updates.
- **Anti-Ban Shield Mode** — Configurable rate limiting, randomized delays, typing simulation, and cooldown enforcement to prevent account flags.
- **Campaign Management** — Full history with search, filter, and export (PDF, CSV, TXT, JSON) including country-breakdown analytics.
- **Session Persistence** — QR-free session restore for returning users; automatic backup so sessions survive QR regeneration.

### Message Agent — CRM & Messaging
- **Conversation Hub** — Real-time two-way messaging with delivery and read receipts, contact management, and conversation history.
- **AI Provider Integration** — Bring your own API key for OpenAI, Anthropic, Groq, Together, Mistral, DeepSeek, or OpenRouter.
- **Conversation Intelligence** — Multi-language intent classification, sentiment analysis, lead scoring, culture adaptation, and opt-out detection.
- **Template Manager** — Pre-built and custom message templates across 8 categories with AI-powered personalization and A/B variation generation.
- **Business Profile** — Branded sender identity with configurable business hours, contact info, and compliance settings.

### Security & Compliance
- **Opt-Out Management** — Automatic suppression list with user-initiated opt-out detection (confidence-based).
- **Health Monitoring** — Account health scoring (delivery rate, reply rate, quality, block score, activity) with auto-pause and daily reports.
- **Compliance Controls** — Block list, suppression list, send-permission checks, and full opt-out audit log.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (SPA)                        │
│  React 18 + Vite + Tailwind CSS + Framer Motion        │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────────┐  │
│  │  Shield  │ │  Agent   │ │  Public Pages         │  │
│  │ Dashboard│ │   CRM    │ │  Landing, Guide, FAQ   │  │
│  └────┬─────┘ └────┬─────┘ └───────────────────────┘  │
│       │            │                                    │
│  ┌────┴────────────┴────────────────────────────────┐  │
│  │         WebSocketProvider (Context)               │  │
│  │  Auth State · Session · Campaign · Online/Offline │  │
│  └─────────────────────┬────────────────────────────┘  │
└────────────────────────┼──────────────────────────────┘
                         │
              HTTP/1.1   │   WebSocket (ws://host/ws)
                         │
┌────────────────────────┼──────────────────────────────┐
│                 Express + ws Server                    │
│  ┌─────────────────────────────────────────────────┐  │
│  │  REST API (/api/*)        WS Messages           │  │
│  │  · /api/status            · STATUS_UPDATE       │  │
│  │  · /api/check-bulk        · BULK_CHECK_PROGRESS │  │
│  │  · /api/logout            · connection_success  │  │
│  │  · /api/sessions/:phone   · MESSAGE_AGENT_UPDATE│  │
│  │  · /api/campaigns          · HISTORY_RESULT     │  │
│  │  · /api/message-agent/*   · SEND_MESSAGE        │  │
│  └─────────────────────────────────────────────────┘  │
│                        │                               │
│  ┌─────────────────────┴────────────────────────────┐ │
│  │              WhatsAppService                      │ │
│  │  @whiskeysockets/baileys · Session Management    │ │
│  │  QR Auth · Message Send/Receive · Number Check   │ │
│  └─────────────────────┬────────────────────────────┘ │
│                        │                               │
│  ┌─────────────────────┴────────────────────────────┐ │
│  │           Backend Services                       │ │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │ │
│  │  │ Health  │ │Compliance│ │ Conversation     │  │ │
│  │  │ Monitor │ │ Service  │ │ Intelligence     │  │ │
│  │  └─────────┘ └──────────┘ └──────────────────┘  │ │
│  │  ┌──────────────────────────────────────────┐   │ │
│  │  │         Template Manager                 │   │ │
│  │  └──────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | React 18.3 | Component-based UI |
| **Build** | Vite 5.4 | HMR dev server, optimized production builds |
| **Routing** | React Router v7 | Declarative client-side routing |
| **Styling** | Tailwind CSS 3.4 | Utility-first CSS with custom design system |
| **Animations** | Framer Motion 12 | Page transitions, micro-interactions |
| **UI Primitives** | Radix UI | Accessible, unstyled dialog, select, tabs, toast, tooltip |
| **Icons** | Lucide React | Consistent iconography |
| **Charts** | Recharts 3.8 | Campaign analytics, activity charts |
| **PDF** | jsPDF + jspdf-autotable | Report generation |
| **Phone** | libphonenumber-js | Number parsing and validation |
| **Classnames** | clsx + tailwind-merge + CVA | Component variant management |

### Backend

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Runtime** | Node.js | JavaScript runtime |
| **HTTP** | Express 4.21 | REST API framework |
| **WebSocket** | ws 8.18 | Bidirectional real-time communication |
| **WhatsApp** | Baileys 6.7 | Unofficial WhatsApp Web API client |
| **QR** | qrcode 1.5 | QR code generation for device pairing |
| **Logging** | Pino 9.6 | Structured JSON logging |
| **Phone** | libphonenumber-js | Number normalization on server |

---

## Project Structure

```
antigravity-shield/
│
├── backend/
│   ├── server.js                       # Express + WS server, REST API, bulk validation
│   ├── whatsapp.js                     # WhatsAppService: auth, messaging, session mgmt
│   │
│   ├── services/
│   │   ├── compliance-service.js       # Opt-out, block list, suppression
│   │   ├── conversation-intelligence.js  # AI intent, sentiment, lead scoring
│   │   ├── health-monitor.js           # Account health scoring, auto-pause
│   │   └── template-manager.js         # Message templates, AI generation
│   │
│   ├── session_auth_info/              # Baileys WhatsApp credentials (created at runtime)
│   ├── session_history.json            # Previously connected session profiles
│   ├── campaign_history.json           # Validation campaign records
│   ├── ai_providers.json              # User-configured AI provider API keys
│   ├── safety_settings.json           # Anti-ban configuration
│   ├── business_profile.json          # Business identity settings
│   ├── message_templates.json         # CRM message template library
│   ├── contacts.json                  # CRM contact database
│   ├── blocked_contacts.json          # Compliance block list
│   ├── opt_out_log.json               # Opt-out audit trail
│   ├── suppression_list.json          # Do-not-contact register
│   └── package.json
│
├── frontend/
│   ├── index.html                     # HTML entry, font loading, theme guard
│   ├── vite.config.js                 # Vite config with proxy to backend
│   ├── tailwind.config.js             # Custom design tokens, animations
│   ├── postcss.config.js
│   │
│   └── src/
│       ├── main.jsx                   # App bootstrap, provider tree
│       ├── App.jsx                    # Route definitions, page titles
│       ├── index.css                  # Tailwind directives, global styles
│       │
│       ├── context/
│       │   ├── WebSocketProvider.jsx  # Global auth, session, campaign state
│       │   └── ThemeProvider.jsx      # Dark/light theme management
│       │
│       ├── pages/
│       │   ├── LandingPage.jsx        # Marketing homepage
│       │   ├── DashboardPage.jsx      # 5-step validation wizard
│       │   ├── MessageAgentPage.jsx   # Full CRM messaging hub
│       │   ├── CampaignHistoryPage.jsx # Past campaign search & export
│       │   ├── ProfilePage.jsx        # User stats, session history
│       │   ├── NumberFormatsPage.jsx  # Number format reference
│       │   ├── UserGuidePage.jsx      # Interactive documentation
│       │   ├── FAQPage.jsx            # Categorized FAQ with search
│       │   ├── AboutPage.jsx          # Platform information
│       │   ├── ContactPage.jsx        # Support contact form
│       │   ├── ChangelogPage.jsx      # Release notes
│       │   ├── PrivacyPolicyPage.jsx  # Privacy policy
│       │   ├── TermsPage.jsx          # Terms of service
│       │   ├── DataProcessingPage.jsx # Data processing agreement
│       │   │
│       │   └── components/            # Message Agent sub-components
│       │       ├── ChatArea.jsx
│       │       ├── ChatSidebar.jsx
│       │       ├── ContactPanel.jsx
│       │       ├── CrmPipeline.jsx
│       │       ├── AnalyticsDashboard.jsx
│       │       ├── AccountHealthDashboard.jsx
│       │       ├── ConversationIntelligence.jsx
│       │       ├── TemplateManager.jsx
│       │       ├── AiProviderSettings.jsx
│       │       ├── SafetySettings.jsx
│       │       └── BusinessProfileSettings.jsx
│       │
│       ├── components/
│       │   ├── Layout.jsx             # Shell: header, nav, footer, mobile menu
│       │   ├── ErrorBoundary.jsx      # Global error catch
│       │   │
│       │   ├── dashboard/
│       │   │   ├── Step1Auth.jsx      # QR authentication
│       │   │   ├── Step2Audience.jsx  # Phone number input
│       │   │   ├── Step3Safety.jsx    # Anti-ban configuration
│       │   │   ├── Step4Scanning.jsx  # Live validation
│       │   │   ├── Step5Reports.jsx   # Results & export
│       │   │   └── StepProgress.jsx   # Step indicator
│       │   │
│       │   └── ui/                    # Reusable design system
│       │       ├── Button.jsx
│       │       ├── Card.jsx
│       │       ├── Badge.jsx
│       │       ├── Input.jsx
│       │       ├── Select.jsx
│       │       ├── Switch.jsx
│       │       ├── Tabs.jsx
│       │       ├── Dialog.jsx
│       │       ├── AlertDialog.jsx
│       │       ├── Toast.jsx
│       │       ├── Tooltip.jsx
│       │       ├── Progress.jsx
│       │       ├── Table.jsx
│       │       ├── Spinner.jsx
│       │       ├── Skeleton.jsx
│       │       ├── SkeletonCard.jsx
│       │       ├── SkeletonTable.jsx
│       │       ├── SkeletonDashboard.jsx
│       │       ├── SkeletonChat.jsx
│       │       ├── AppLoader.jsx
│       │       ├── LoadingOverlay.jsx
│       │       ├── NavigationProgress.jsx
│       │       ├── PageTransition.jsx
│       │       ├── ScrollToTop.jsx
│       │       ├── ProductSwitcher.jsx
│       │       ├── ProfileDropdown.jsx
│       │       ├── CountrySelector.jsx
│       │       ├── WhatsAppShieldLogo.jsx
│       │       ├── ToastNotification.jsx
│       │       └── cn.ts              # Tailwind classname utility
│       │
│       ├── hooks/
│       │   └── useLoadingState.js
│       │
│       ├── utils/
│       │   ├── exportUtils.js         # CSV, TXT, JSON, PDF export
│       │   ├── messageAgentWebSocket.js # Agent WS message handling
│       │   └── contactTransfer.js     # Shield-to-Agent contact import
│       │
│       └── data/
│           └── countries.js           # Country metadata (codes, flags, names)
│
├── .gitignore                          # Repository ignore patterns
├── package.json                        # Root monorepo scripts
├── package-lock.json                   # Locked dependency versions
├── LICENSE
└── README.md
```

---

## Installation

### Prerequisites

- **Node.js** v18 or later
- **npm** (ships with Node.js)
- A **WhatsApp** account with an active mobile device for QR pairing
- (Optional) API keys for AI providers (OpenAI, Anthropic, etc.) for Message Agent features

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/hafizbilalakbar/WhatsApp.git
 cd WhatsApp

# 2. Install all dependencies (backend + frontend)
npm run install:all

# 3. Start development servers
npm run dev
```

The backend starts at `http://localhost:5000` and the frontend at `http://localhost:3000`. Open `http://localhost:3000` in your browser.

### Manual Installation

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Run both
cd ..
npm run dev
```

---

## Environment Variables

The application uses sensible defaults and does not require environment variables for basic operation. The following variables can be set for custom configurations:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Backend Express/WS server port |
| `NODE_ENV` | `development` | Runtime environment (`development` / `production`) |

The frontend Vite dev server proxies `/api` and `/ws` to the backend automatically. For production, build the frontend with `npm run build` and serve the static files from the backend.

---

## Available Scripts

### Root

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend + backend concurrently |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend Vite dev server only |
| `npm run install:all` | Install dependencies for both workspaces |
| `npm run build` | Build frontend for production |

### Backend (`cd backend`)

| Script | Description |
|--------|-------------|
| `node server.js` | Start production server |
| `npx nodemon server.js` | Start with auto-reload (install nodemon globally) |

### Frontend (`cd frontend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |

---

## Deployment

### Production Build

```bash
# Build the frontend
cd frontend
npm run build

# Start the backend (serves frontend static files from dist/)
cd ../backend
NODE_ENV=production node server.js
```

The backend automatically serves the built frontend from `frontend/dist/` when `NODE_ENV=production`.

### Docker

A `Dockerfile` can be created using the following pattern:

```dockerfile
FROM node:18-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:18-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/ .
COPY --from=frontend /app/frontend/dist ./dist
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Major Modules

### 1. Authentication & Session Management

QR-based WhatsApp Web pairing using the Baileys library. Sessions are persisted to disk (`session_auth_info/`) and can be restored without re-scanning. The system automatically backs up existing sessions before generating a new QR code and only finalizes the replacement once the new connection is confirmed.

- **`WhatsAppService.generateQRCode()`** — Backs up existing credentials, starts fresh connect
- **`WhatsAppService.restoreSession()`** — Recovers from backup if primary missing, reconnects
- **WebSocket `STATUS_UPDATE`** — Real-time status propagation (QR_CODE, CONNECTED, DISCONNECTED)

### 2. Bulk Number Validation

Validates phone numbers against WhatsApp's network with configurable safety controls:

- **Shield Mode** — Random delays (configurable base + jitter), cooldown every N checks, typing simulation
- **Per-Number Results** — Exists/not-registered/invalid-format with profile picture and status text
- **Live Terminal** — Real-time WebSocket stream of validation progress
- **Campaign Persistence** — All results saved to `campaign_history.json` with country breakdowns

### 3. Message Agent CRM

Full-featured customer communication platform:

- **Chat Interface** — Real-time messaging with typing indicators, delivery/read receipts
- **Contact Management** — Import from Shield campaigns, manual add, bulk operations
- **CRM Pipeline** — Visual Kanban board for lead tracking across stages
- **Conversation Intelligence** — Multi-language NLP for intent classification, sentiment analysis, lead scoring, culture adaptation, and opt-out detection (supports 7+ AI providers)
- **Template Manager** — 20+ pre-built templates across 8 categories with AI personalization and A/B variation generation

### 4. Account Health & Compliance

- **Health Scoring** — Composite score (0-100) based on delivery rate, reply rate, message quality, block activity, and sending frequency
- **Auto-Pause** — Automatically halts sending when health drops below threshold
- **Opt-Out Detection** — AI-powered detection of opt-out intent in incoming messages (automatic suppression at ≥0.6 confidence)
- **Full Audit Trail** — All opt-out events, blocks, and suppression actions logged to `opt_out_log.json`

---

## Security Considerations

- **Session Credentials** — WhatsApp auth files stored on local disk. No credentials transmitted to third parties.
- **AI Provider Keys** — API keys stored in `ai_providers.json` on the server. Not exposed to the client.
- **No Database** — All data persisted as JSON files on the local filesystem. No external database required.
- **CORS** — Backend uses `cors()` middleware. In production, restrict to your domain.
- **WebSocket Ping/Pong** — Connection health monitoring with automatic reconnection and exponential backoff.
- **Session Backup** — Credentials are backed up before QR regeneration; stale sessions are cleaned up only after new authentication succeeds.

---

## Development Notes

- **State Architecture** — `WebSocketProvider` is the single source of truth for all authentication, session, scanning, and campaign state. Components consume via `useWebSocket()`.
- **Routing** — `Layout.jsx` wraps all routes and provides the persistent header, footer, and navigation. Public and authenticated navigation are mutually exclusive.
- **Animations** — `framer-motion` `AnimatePresence` for step transitions; Tailwind CSS custom animations for loading states, scan lines, and micro-interactions.
- **Design System** — All UI primitives live in `components/ui/` and follow a consistent API using `class-variance-authority` for variant management.
- **Real-Time Protocol** — WebSocket messages follow a typed protocol (`type` + `data` shape). The `STATUS_UPDATE` message is the primary mechanism for broadcasting state changes from the backend.

---

## Future Improvements

- **Multi-Device Support** — Manage multiple WhatsApp sessions simultaneously
- **Team Collaboration** — Multi-user workspace with role-based access
- **Webhook Integrations** — Outbound webhooks for campaign completion, message events, and health alerts
- **Scheduled Campaigns** — Time-based and recurring validation campaigns
- **Message Scheduling** — Schedule outgoing messages with CRM drip campaigns
- **Export Enhancements** — XLSX support, custom report builders, scheduled exports
- **Database Migration** — Optional PostgreSQL/SQLite backend for improved query performance and data integrity
- **OAuth SSO** — Single sign-on with Google, GitHub, or enterprise identity providers
- **API Rate Limiting** — Configurable rate limiting for REST endpoints

---



---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Author

**Hafiz Bilal Akbar**

- GitHub: [https://github.com/hafizbilalakbar](https://github.com/hafizbilalakbar)

---

## Contributing

Contributions are welcome. Please open an issue or submit a pull request for improvements, bug fixes, or feature requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
