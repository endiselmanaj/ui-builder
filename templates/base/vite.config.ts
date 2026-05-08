import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The Express proxy in front of this server runs on :3001 and forwards
// /api/preview/<sessionId>/ → this Vite dev server. We don't pin
// hmr.clientPort here — HMR uses the page's location.port, which goes
// through whichever proxy chain delivered the iframe (5173 in dev, 3001
// in production). Both proxies have ws:true so the upgrade tunnels.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    strictPort: false,
  },
});
