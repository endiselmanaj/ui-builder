# UI Builder

Type a prompt, and an AI agent builds a live React app for you in real time. Pick "skills" (style guides) to shape the output, and use **Compare mode** to run two versions side by side.

## AI setup (easiest way)

If you have [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) installed, paste this prompt and it will do everything for you:

> Clone https://github.com/endiselmanaj/ui-builder.git, install Node.js 20+ if not already installed, run `./start.sh` in the cloned directory, and open http://localhost:5173 in my browser.

## What you need

- **Node.js 20+** — [download here](https://nodejs.org/)
- **Claude Code CLI** — [install guide](https://docs.anthropic.com/en/docs/claude-code/overview)

After installing Claude Code, log in by running:

```bash
claude login
```

That's all the auth you need. No API key required.

## Quick start

```bash
git clone https://github.com/endiselmanaj/ui-builder.git
cd ui-builder
./start.sh
```

Then open **http://localhost:5173** in your browser.

`start.sh` installs dependencies automatically on first run, starts the backend on port 3001, and the frontend on port 5173. Press **Ctrl+C** to stop everything.

## How to use it

1. Open http://localhost:5173
2. Type a prompt like *"A dashboard with three KPI tiles and a weekly orders bar chart"*
3. Click **+ Skills** to pick style guides that shape the output
4. Toggle **Compare** to generate two versions side by side (with and without skills)
5. Click **Generate** and wait ~20-60 seconds for the live preview
6. Open **Context Lab** to run the "preparation matters" demo: the same
   prompt is built three times with increasingly rich context (briefing →
   +process schematic → +live Figma design browse) and shown side by side.
   Upload your own PDFs/images/XML or add URL sources for the agent to
   browse live via the Claude Chrome extension.

Past generations are saved and persist across page reloads.

Click the **gear icon** in the header to change the AI model, budget cap, and other settings.

## Running with Docker

```bash
claude setup-token          # generates an OAuth token
cp .env.example .env        # paste the token into CLAUDE_CODE_OAUTH_TOKEN
docker compose up
```

## Project structure

| Path | What it does |
|---|---|
| `skills/*.md` | Style guide catalog — each file is a skill |
| `server/` | Express backend that spawns the AI agent and manages sessions |
| `client/src/` | React frontend |
| `templates/base/` | Starter template copied into each generation |
| `data/` | Local state (gitignored) — saved generations and settings |
| `CLAUDE.md` | Architecture notes for AI-assisted development |
