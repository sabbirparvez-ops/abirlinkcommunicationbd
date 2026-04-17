import "dotenv/config";
import path from "path";
import express from "express";
import http from "http";
import { createServer as createViteServer } from "vite";
import apiApp from "./api/index";

const PORT = 3000;

async function startServer() {
  const app = express();

  // Set Permissions-Policy for Wake Lock early
  app.use((req, res, next) => {
    res.setHeader("Permissions-Policy", "screen-wake-lock=*, wake-lock=*");
    next();
  });

  // Mount API routes
  app.use(apiApp);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Self-pinging mechanism to keep the app awake (every 5 minutes)
    setInterval(() => {
      http.get(`http://localhost:${PORT}/api/health`, (res) => {
        console.log(`[Keep-Alive] Pinged health endpoint. Status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error(`[Keep-Alive] Ping failed: ${err.message}`);
      });
    }, 5 * 60 * 1000);
  });
}

startServer();
