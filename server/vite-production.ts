import express, { type Express } from "express";
import path from "path";
import fs from "fs";

export function log(message: string, source = "express") {
  console.log(`${new Date().toISOString()} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  const distPath = path.join(process.cwd(), "dist", "public");
  
  // Serve static files from dist/public
  app.use(express.static(distPath, {
    maxAge: "1d",
    etag: true,
    lastModified: true
  }));

  // Catch-all handler for SPA routing
  app.get("*", (req, res) => {
    const indexPath = path.join(distPath, "index.html");
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      log(`Index file not found at ${indexPath}`, "static");
      res.status(404).send("Application not built. Please run the build process.");
    }
  });
}