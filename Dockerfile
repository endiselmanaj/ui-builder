FROM node:22-bookworm-slim

# Install Claude Code CLI globally so it's on PATH inside the container.
# We do NOT mount the host's ~/.claude/ — the container has a clean home,
# so the agent loads with zero plugins, MCP servers, or auto-discovered
# CLAUDE.md / skills. Auth is via CLAUDE_CODE_OAUTH_TOKEN passed in env.
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app/ui-builder

# Install dependencies first for layer caching. Three package.jsons:
# the server, the client, and the per-session Vite scaffold.
COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json* ./client/
COPY templates/base/package.json templates/base/package-lock.json* ./templates/base/

RUN npm install \
 && npm --prefix client install \
 && npm --prefix templates/base install

# Copy the rest of the app.
COPY . .

# Express server + Vite client ports.
EXPOSE 3001 5173

# Bind both Vite (client) and Express to all interfaces inside the container
# so docker port-publish (5173:5173, 3001:3001) reaches the host browser.
ENV HOST_BIND=0.0.0.0

CMD ["./start.sh"]
