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

client/src/App.tsx           — nav + view switch + shared state
client/src/pages/GeneratePage.tsx — prompt input + skill picker + generation feed
client/src/pages/SkillsPage.tsx   — workspace install/uninstall
client/src/GenerationCard.tsx     — iframe preview + ActivityLog per variant
client/src/ActivityLog.tsx        — derives timeline from raw agent events
client/src/hooks/useAgentEvents.ts — SSE → AgentEvent[]
client/src/Settings.tsx           — drawer for claude flag config

templates/base/          — Vite scaffold copied into each session (react, tailwind v4, recharts, zod, lucide-react)
skills/*.md              — skill catalog (markdown rule sheets)
data/                    — gitignored runtime state (workspace.json, generations.json, settings.json, sessions/)
```

## Concepts

- **Skill** — markdown file in `skills/`. First `#` heading = display name, first paragraph = description.
- **Library** = all skills on disk. **Workspace** = installed subset. **Loaded** = skills selected for a generation. Loaded ⊆ Installed ⊆ Library.
- **Session** — sandbox under `data/sessions/<uuid>/` with its own Vite server and agent process.
- **Generation** — one prompt run: 1 session (solo) or 2 sessions (compare mode).

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
4. Agent has `Bash` as the user — do not deploy without containerization
