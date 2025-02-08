
import { Express } from "express";
import http from "http";

export function registerRoutes(app: Express) {
  const server = http.createServer(app);
  
  // API routes will go here
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return server;
}
