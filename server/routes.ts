
import { Express } from "express";
import http from "http";

export function registerRoutes(app: Express) {
  const server = http.createServer(app);
  
  // API routes will go here
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/assets/search', async (req, res) => {
    const { q } = req.query;
    if (typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    try {
      const { searchAssets } = await import('./lib/coinmarketcap');
      const results = await searchAssets(q);
      res.setHeader('Content-Type', 'application/json');
      res.json(results || []);
    } catch (error) {
      console.error('Search error:', error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ message: 'Failed to search assets' });
    }
  });

  return server;
}
