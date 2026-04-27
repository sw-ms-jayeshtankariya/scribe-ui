# scribe-ui

Angular 21 frontend for the Scribe AI documentation platform.

## Tech Stack

- Angular 21 — standalone components, no NgModules
- SCSS — custom design system, no Angular Material
- Angular HTTP Client with dev proxy to scribe-api (`proxy.conf.json`)
- Reactive repo/Confluence validation with `debounceTime` + `Subject`
- Native browser `EventSource` for SSE live streaming
- `DomSanitizer` + `bypassSecurityTrustHtml` for Markdown → HTML rendering in View Docs

## Running

```bash
npm install
npx ng serve --port 4200
```

All `/api` calls are proxied to `http://localhost:8000` via `proxy.conf.json`.
The AI Document Editor panel calls scribe-agents directly at `http://localhost:8001/edit-doc`.

---

## Pages & Routes

| Route | Page | State |
|---|---|---|
| `/` | Home hero | Static |
| `/projects` | Project Configurator list | **Live** — reads MongoDB, real-time badges, View Docs button when `docs_count > 0` |
| `/projects/new` | Create Project form | **Live** — validates repos + Confluence in real time |
| `/projects/:id/session` | Session History + live agent log | **Live** — SSE streaming, feature confirmation panel |
| `/projects/:id/docs` | Document Review (3-column) | **Live** — wired to MongoDB, AI Doc Editor, version history |
| `/dashboard` | Admin Dashboard | Shell built — pending real data wire-up |

---

## Key Service (`src/app/services/api.ts`)

All HTTP calls go through `ApiService`. Key methods:

| Method | Purpose |
|---|---|
| `getProjects()` | List all projects |
| `getProject(id)` | Single project (used to load feature manifest) |
| `createProject(body)` | Create project + trigger onboarding |
| `deleteProject(id)` | Delete project |
| `validateRepo(url)` | Real-time GitHub validation → branches |
| `validateConfluence(url)` | Real-time Confluence space validation |
| `generateDocs(projectId, depth, discoveryMode)` | Start generation → returns `session_id` |
| `getProjectSessions(projectId)` | List all sessions for a project |
| `openSessionStream(sessionId)` | Returns native `EventSource` for SSE |
| `sendSessionMessage(sessionId, message)` | Send mid-session guidance to agent |
| `confirmFeatures(sessionId, features, userMessage)` | Confirm feature list + free-text instruction → Phase 2 |
| `getProjectDocs(projectId)` | List all documents for a project |
| `getDoc(docId)` | Get a single document |
| `saveDocEdit(docId, content)` | Save edited content (old pushed to versions[]) |
| `resetDocEdit(docId)` | Restore previous version |
| `approveDoc(docId)` | Human-approve a document |
| `editDocWithAgent(docId, content, instruction)` | Call scribe-agents `/edit-doc` — Claude edits the document |

---

## View Docs Page — 3-Column Layout

### Left panel
Document list loaded from `GET /api/v1/documents/project/:id`. Each row has:
- Status dot (green = approved, amber = pending)
- Document name (feature name)
- Depth + status label

### Middle panel
Markdown rendered as styled HTML via a custom inline renderer (no external library). Two tabs:
- **Business Doc** — active, fully wired
- **Technical Use** — placeholder shell

Toolbar:
- **Side-by-Side Diff** — shows previous vs current version (only when `versions[]` has entries)
- **Reset Edits** — `POST /api/v1/documents/:id/reset` — pops last version and restores it
- **Approve & Save Business Doc** — `PATCH /api/v1/documents/:id/approve`

Version bar: `Previous version → Current Version ↓ latest`

### Right panel (dark — AI Document Editor)
User types a natural-language instruction. On Send (Ctrl+Enter):
1. Calls `POST http://localhost:8001/edit-doc` with `{ doc_id, content, instruction }`
2. Claude returns edited Markdown
3. UI saves via `PATCH /api/v1/documents/:id` — old content pushed to `versions[]`
4. Middle panel re-renders immediately
5. Instruction + "Document updated." logged in editor chat log

---

## Doc Generation Flow (UI side)

1. User clicks **Generate Docs** on any `READY` project card
2. **Generate Docs modal** opens — user picks:
   - **Depth**: Overview (~2 min) / Standard (~5 min) / Detailed (~15 min)
   - **Discovery mode**: Auto / JIRA-first / Code-first
3. `POST /api/v1/sessions/generate` — returns `session_id`
4. UI navigates to `/projects/:id/session?sid=<session_id>`
5. Session page auto-selects the new session and opens SSE stream
6. Live log panel shows every agent action in real time (colour-coded by event type)
7. When Phase 1 completes → **Feature Confirmation panel** slides in:
   - Each discovered feature shown as a checkable row (name, description, JIRA epics)
   - User unchecks features they don't need
   - Optional free-text instruction box: *"Merge auth and login into one", "Skip reporting", "Focus only on payment"*
   - **Confirm & Generate** → Phase 2 starts
8. Generator→Critic loop runs per feature — all activity streams live to the log
9. **Completion banner** appears: *"✓ Generation complete — N documents approved"* + **View Docs** button

---

## Session Log Event Types (colour-coded)

| Tag | Colour | Meaning |
|---|---|---|
| AGENT | Blue | General agent info / progress |
| TOOL | Green | File read, JIRA fetch, ChromaDB query |
| DRAFT | Purple | Generator finished a draft |
| CRITIC | Orange | Critic returned feedback gaps |
| ✓ APPROVED | Green | Feature document approved |
| ERROR | Red | Something failed |
| DONE | Bright green | Session completed |
| YOU | White/muted | User's own message in the log |

---

## Project Card Layout

Each card in the project list shows:
- Project name + tech badges + status badge (inline, one row)
- Feature bullets from agent summary (left blue border accent)
- Stats row: REPOS / DOCS / CREATED
- Repo chips with branch badges
- Action buttons (horizontal at bottom): Generate Docs · Session History · View Docs (N) [only when docs_count > 0] · ↺ Re-scan · Delete

---

## Building for Production

```bash
npx ng build
```

Output goes to `dist/scribe-ui/`. Point `environment.prod.ts` at the deployed scribe-api URL.
