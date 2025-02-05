import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertAssetSchema, insertPortfolioItemSchema } from "@shared/schema";
import { searchAssets, getPrice, getPriceHistory } from "./lib/coingecko";
import { generatePortfolioInsight } from "./lib/openai";

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Asset routes
  app.get("/api/assets/search", async (req, res) => {
    const { query } = req.query;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ message: "Query parameter required" });
    }
    const results = await searchAssets(query);
    res.json(results);
  });

  app.get("/api/assets/:id/price", async (req, res) => {
    const price = await getPrice(req.params.id);
    res.json({ price });
  });

  app.get("/api/assets/:id/history", async (req, res) => {
    const { days = "7" } = req.query;
    const history = await getPriceHistory(req.params.id, Number(days));
    res.json(history);
  });

  // Portfolio routes
  app.get("/api/portfolio", async (req, res) => {
    const items = await storage.getPortfolioItems();
    const assets = await storage.getAssets();
    
    const portfolio = await Promise.all(
      items.map(async (item) => {
        const asset = assets.find((a) => a.id === item.assetId);
        if (!asset) return null;
        
        return {
          ...asset,
          holdings: Number(item.quantity),
          value: Number(item.quantity) * Number(asset.currentPrice),
          profitLoss: (Number(asset.currentPrice) - Number(item.averagePrice)) * Number(item.quantity)
        };
      })
    );

    res.json(portfolio.filter(Boolean));
  });

  app.post("/api/portfolio", async (req, res) => {
    const validation = insertPortfolioItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "Invalid portfolio item data" });
    }
    
    const item = await storage.createPortfolioItem(validation.data);
    res.json(item);
  });

  app.get("/api/portfolio/insight", async (req, res) => {
    const items = await storage.getPortfolioItems();
    const assets = await storage.getAssets();
    
    const portfolio = items.map((item) => {
      const asset = assets.find((a) => a.id === item.assetId);
      if (!asset) return null;
      return {
        symbol: asset.symbol,
        value: Number(item.quantity) * Number(asset.currentPrice),
        profitLoss: (Number(asset.currentPrice) - Number(item.averagePrice)) * Number(item.quantity)
      };
    }).filter(Boolean);

    const insight = await generatePortfolioInsight(portfolio);
    res.json(insight);
  });

  return httpServer;
}
