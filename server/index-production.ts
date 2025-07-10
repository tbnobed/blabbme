import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Production static file serving - NO VITE IMPORTS
  const fs = await import("fs");
  const publicPath = path.join(__dirname, "public");
  
  if (fs.existsSync(publicPath)) {
    console.log(`✓ Serving frontend from: ${publicPath}`);
    app.use(express.static(publicPath));
    
    // Catch-all handler for React Router
    app.get("*", (req, res) => {
      res.sendFile(path.join(publicPath, "index.html"));
    });
  } else {
    console.log(`✗ Frontend files missing at: ${publicPath}`);
    app.get("*", (req, res) => {
      res.status(500).send(`
        <h1>Build Error</h1>
        <p>Frontend files not found. Please check Docker build logs.</p>
        <p>Expected location: <code>${publicPath}</code></p>
      `);
    });
  }

  // ALWAYS serve the app on port 5000
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log(`Production server running on port ${port}`);
  });
})();