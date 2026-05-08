import type { Express, Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { sessionManager } from "./sessionManager.js";

export function mountSessionProxy(app: Express) {
  const middleware = createProxyMiddleware<Request, Response>({
    changeOrigin: true,
    ws: true,
    router: (req: any) => {
      const target = req._sessionTarget as string | undefined;
      if (!target) {
        throw new Error("session target missing");
      }
      return target;
    },
    pathRewrite: (path, req: any) => {
      const id = req._sessionId as string;
      const prefix = `/api/preview/${id}`;
      // Vite is started with --base /api/preview/<id>/ so it expects requests
      // at the prefix. We do NOT strip the prefix; we pass through.
      return path;
    },
    on: {
      error: (err, _req, res: any) => {
        if (res?.writeHead) {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end(`session proxy error: ${err.message}`);
        }
      },
    },
  });

  app.use(
    "/api/preview/:sessionId",
    async (req: Request, res: Response, next: NextFunction) => {
      const sessionId = req.params.sessionId;
      if (!sessionManager.has(sessionId)) {
        res.status(404).type("text/plain").send(`unknown session: ${sessionId}`);
        return;
      }
      let target = sessionManager.proxyTarget(sessionId);
      if (!target) {
        try {
          target = await sessionManager.startVite(sessionId);
        } catch (err: any) {
          res
            .status(502)
            .type("text/plain")
            .send(`failed to start vite: ${err.message}`);
          return;
        }
      }
      (req as any)._sessionId = sessionId;
      (req as any)._sessionTarget = `http://127.0.0.1:${target.port}`;
      // Express's mount strips the /api/preview/:sessionId prefix from req.url
      // before middleware runs. Vite is started with --base /api/preview/<id>/
      // so it expects the full path. Restore it.
      req.url = req.originalUrl;
      next();
    },
    middleware,
  );

  // Forward websocket upgrades for HMR. Express's app.use mounts http; we
  // also need to handle 'upgrade' on the underlying server. The caller passes
  // the http server in via attachUpgrade.
  return middleware;
}

export function attachUpgrade(server: import("http").Server, middleware: any) {
  server.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";
    const m = url.match(/^\/api\/preview\/([^/]+)/);
    if (!m) return;
    const sessionId = m[1];
    const target = sessionManager.proxyTarget(sessionId);
    if (!target) {
      socket.destroy();
      return;
    }
    (req as any)._sessionId = sessionId;
    (req as any)._sessionTarget = `http://127.0.0.1:${target.port}`;
    middleware.upgrade(req, socket, head);
  });
}
