# UI Builder

User picks skills (markdown rule sheets), types a prompt, and a Claude Code agent writes files into a per-generation Vite sandbox with live HMR preview. Compare mode runs two independent agents side by side.

## Maintaining this file

<!-- Target: under 200 lines. Every Claude Code session loads this at startup. -->

**If a session changes the architecture, update this file before the session ends.**

Update when:
- Files added/removed → update the file map
- Endpoints added/changed → update the API section
- Defaults changed → update **Default settings** and **How the agent runs**
- New ports or proxy paths → update the architecture section

Do NOT add here:
- Per-feature implementation details → put in commits or `docs/`
- Multi-step procedures → put in a skill under `skills/`
- User-specific preferences → put in `~/.claude/CLAUDE.md`

## Commands

- `./start.sh` — install deps + start server (3001) and client (5173)
- `npm run server` — Express only
- `npm run client` — Vite client only
- Tests: `cd client && npx vitest run`

## File map

@README.md for project overview and @package.json for available scripts.

```
server/index.ts          — Express: all /api/* endpoints + SSE + preview proxy
server/sessionManager.ts — session lifecycle: dir setup, Vite, agent spawn
server/agentRunner.ts    — spawns `claude -p` with stream-json output
server/proxy.ts          — http-proxy-middleware to session Vite servers
server/types.ts          — shared Settings type
server/contextLibrary.ts — context sources (file bundles) + tiers, data/context/
server/contextPrompt.ts  — context-lab agent prompt builder
server/readinessPrompt.ts — readiness gap-reveal + DoR-compile prompt builders
server/contextFiles.ts   — pure copy helper: files → session context/<slug>/

client/src/App.tsx           — nav + view switch + shared state
client/src/pages/GeneratePage.tsx — prompt input + skill picker + generation feed
client/src/pages/SkillsPage.tsx   — workspace install/uninstall
client/src/pages/ContextLabPage.tsx — context lab page (2-tier compare)
client/src/pages/ReadinessPage.tsx — readiness lab: gap reveal → answer → download DoR .md
client/src/GenerationCard.tsx     — iframe preview + ActivityLog per variant
client/src/ActivityLog.tsx        — derives timeline from raw agent events
client/src/hooks/useAgentEvents.ts — SSE → AgentEvent[]
client/src/Settings.tsx           — drawer for claude flag config
client/src/ContextSourcePanel.tsx   — context library upload/manage panel
client/src/TierConfigRow.tsx        — per-tier source chips
client/src/ContextGenerationCard.tsx — side-by-side preview card with focus mode

templates/base/          — Vite scaffold copied into each session (react, tailwind v4, recharts, zod, lucide-react)
skills/*.md              — skill catalog (markdown rule sheets)
data/                    — gitignored runtime state (workspace.json, generations.json, settings.json, sessions/, context/)
```

## Concepts

- **Skill** — markdown file in `skills/`. First `#` heading = display name, first paragraph = description.
- **Library** = all skills on disk. **Workspace** = installed subset. **Loaded** = skills selected for a generation. Loaded ⊆ Installed ⊆ Library.
- **Session** — sandbox under `data/sessions/<uuid>/` with its own Vite server and agent process.
- **Generation** — one prompt run: 1 session (solo) or 2 sessions (compare mode).
- **Context source** — a file bundle in `data/context/` used as agent input.
- **Tier** — ordered source list; Context Lab runs one session per non-empty tier (2 tiers).
- **Readiness run** — two doc-only agent passes over selected context sources: pass 1 writes `gaps.json` (covered/implied/undecided), a human answers the open ones, pass 2 writes `definition-of-ready.md` which the user downloads and uploads into Context Lab. No Vite/preview.

## Architecture

Two long-lived ports:
- **3001** — Express. All `/api/*` endpoints, proxies preview iframes.
- **5173** — Client Vite. Serves UI, proxies `/api/*` to 3001 with `ws: true`.

Each session spins up a Vite on a random port (`127.0.0.1`). Express proxies at `/api/preview/:sessionId/*`. Vite uses `--base /api/preview/<id>/` for correct asset URLs.

## API

- `GET /api/skills` → `[{ id, name, description }]`
- `GET /api/workspace` → `{ installed: string[] }`
- `POST /api/workspace/install` `{ skillId }`
- `POST /api/workspace/uninstall` `{ skillId }`
- `GET /api/generations` — newest first
- `DELETE /api/generations/:id` — kills sessions + removes from disk
- `GET /api/settings` / `PUT /api/settings`
- `POST /api/generate` `{ prompt, skills: string[], compare?: boolean }` — returns Generation immediately, agent runs in background
- `GET /api/sessions/:sessionId/events` — SSE, replays transcript on connect then streams live
- `ALL /api/preview/:sessionId/*` — proxy to session Vite
- `GET /api/context/sources` → list of context sources
- `POST /api/context/sources` — multipart upload, `{ label, files[] }` → creates a file source
- `DELETE /api/context/sources/:id`
- `GET /api/context/tiers` → the 2 configured tiers
- `PUT /api/context/tiers` `ContextTier[]` (exactly 2) — updates tier→source assignments
- `GET /api/context-lab/generations` — newest first, reconciles stale `running` on read
- `POST /api/context-lab/generate` `{ prompt? }` — one session per non-empty tier
- `DELETE /api/context-lab/generations/:id` — kills sessions + removes from disk
- `GET /api/readiness` — readiness runs, newest first (reconciles stale in-flight on read)
- `GET /api/readiness/:id` → a single `Readiness`
- `POST /api/readiness/start` `{ sourceIds: string[], prompt? }` — pass 1 (gap reveal); returns `Readiness` immediately, agent runs in background
- `POST /api/readiness/:id/compile` `{ answers: Record<gapId,string> }` — pass 2 (compile DoR); `409` unless status is `awaiting-answers`
- `GET /api/readiness/:id/document` — the compiled `definition-of-ready.md` as a markdown download
- `DELETE /api/readiness/:id` — kills both sessions + removes from disk

## How the agent runs

`server/agentRunner.ts` spawns:
```
claude -p "<prompt>"
  --output-format stream-json
  --include-partial-messages
  --verbose
  --model sonnet
  --permission-mode acceptEdits
  --tools "Edit,Write,Read,Bash"
```

- **No `--bare`** — `--bare` ignores `CLAUDE_CODE_OAUTH_TOKEN`, only works with `ANTHROPIC_API_KEY`.
- **stdin is closed** (`stdio: ["ignore", "pipe", "pipe"]`) to avoid the 3s "no stdin" warning.
- **cwd = session dir** so `claude` auto-loads `.claude/skills/*.md` files copied there.
- **`is_error` on exit** — `claude -p` exits 0 even on errors; check `{ is_error: true }` in the final event.
- **Context Lab runs** use the same flag set as skills-mode runs (one session per non-empty tier, no `--chrome`).

## Default settings

```ts
{ model: "sonnet", permissionMode: "acceptEdits", tools: "Edit,Write,Read,Bash", bare: false }
```

`bare: false` is required for subscription/OAuth auth. Do not enable bare mode without an API key.

## Generation status

- `running` — agent still alive
- `ready` — all variants exited code 0
- `errored` — at least one variant exited non-zero
- `stopped` — sessions killed (e.g. server restart)

## Auth

| Mode | macOS keychain | `CLAUDE_CODE_OAUTH_TOKEN` | `ANTHROPIC_API_KEY` |
|---|---|---|---|
| no `--bare` (default) | used on macOS | used on Linux | also works |
| `--bare` | ignored | ignored | required |

## Known gaps

1. No cancel button for running generations — need to SIGTERM the agent process
2. No Vite memory cap — each session is ~100-200 MB, no concurrency limit
3. `templates/base/node_modules` is shared via symlink — agent `npm install` would pollute it
4. Agent has `Bash` as the user — do not deploy without containerization. This extends to Context Lab: uploaded context files are trusted-local-assets only — the agent reads them with Bash available, so an untrusted PDF/XML is a prompt-injection vector; don't expose Context Lab uploads to untrusted users
