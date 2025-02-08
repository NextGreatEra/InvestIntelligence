import { Express } from "express";
import http from "http";
import { storage } from "./storage";
import { insertAssetSchema, insertPortfolioItemSchema } from "@shared/schema";

export function registerRoutes(app: Express) {
  const server = http.createServer(app);

  // API routes will go here
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/portfolio', async (req, res) => {
    try {
      const portfolioItems = await storage.getPortfolioItemsWithAssets();
      res.json(portfolioItems);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      res.status(500).json({ message: 'Failed to fetch portfolio items' });
    }
  });

  app.delete('/api/portfolio/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid portfolio item ID' });
      }
      await storage.removePortfolioItem(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing portfolio item:', error);
      res.status(500).json({ message: 'Failed to remove portfolio item' });
    }
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

  // Add portfolio item endpoint
  app.post('/api/portfolio', async (req, res) => {
    try {
      const assetData = insertAssetSchema.parse({
        symbol: req.body.symbol,
        name: req.body.name,
        currentPrice: req.body.current_price || req.body.currentPrice,
        type: req.body.type
      });

      // Create the asset first
      const asset = await storage.createAsset(assetData);

      // Create the portfolio item with default rank
      const portfolioItem = await storage.createPortfolioItem({
        assetId: asset.id,
        rank: 0
      });

      res.json(portfolioItem);
    } catch (error) {
      console.error('Error adding portfolio item:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Failed to add asset to portfolio' 
      });
    }
  });

  return server;
}