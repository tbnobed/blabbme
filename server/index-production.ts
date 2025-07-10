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
  // The built files should be in the same dist directory as the server
  const fs = await import("fs");
  const publicPath = path.join(__dirname, "public");
  
  console.log(`Looking for frontend files at: ${publicPath}`);
  console.log(`Server located at: ${__dirname}`);
  
  // List what's actually in the dist directory
  try {
    const distContents = fs.readdirSync(__dirname);
    console.log(`Contents of dist directory: ${distContents.join(', ')}`);
  } catch (err) {
    console.log(`Error reading dist directory: ${err.message}`);
  }
  
  // Check if public directory exists
  if (fs.existsSync(publicPath)) {
    console.log(`✓ Public directory found at: ${publicPath}`);
    const publicContents = fs.readdirSync(publicPath);
    console.log(`Public directory contents: ${publicContents.join(', ')}`);
  } else {
    console.log(`✗ Public directory not found at: ${publicPath}`);
  }
  
  app.use(express.static(publicPath));
  
  // Catch-all handler for React Router
  app.get("*", (req, res) => {
    const indexPath = path.join(publicPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send(`
        <h1>Frontend Build Issue</h1>
        <p>Frontend files not found at: <code>${indexPath}</code></p>
        <p>Server directory: <code>${__dirname}</code></p>
        <p>Check Docker logs for directory contents</p>
      `);
    }
  });

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