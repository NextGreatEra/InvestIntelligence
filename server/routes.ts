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
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ message: "Query parameter 'q' required" });
    }

    try {
      const results = await searchAssets(q);
      res.json(results);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Failed to search assets" });
    }
  });

  app.get("/api/assets/:id/price", async (req, res) => {
    try {
      const price = await getPrice(req.params.id);
      if (!price) {
        return res.status(404).json({ message: "Price not found" });
      }
      res.json({ price });
    } catch (error) {
      console.error("Price fetch error:", error);
      res.status(500).json({ message: "Failed to fetch price" });
    }
  });

  app.get("/api/assets/:id/history", async (req, res) => {
    const { days = "7" } = req.query;
    try {
      const history = await getPriceHistory(req.params.id, Number(days));
      res.json(history);
    } catch (error) {
      console.error("History fetch error:", error);
      res.status(500).json({ message: "Failed to fetch price history" });
    }
  });

  // Portfolio routes
  app.get("/api/portfolio", async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Portfolio fetch error:", error);
      res.status(500).json({ message: "Failed to fetch portfolio" });
    }
  });

  app.post("/api/portfolio", async (req, res) => {
    try {
      const { symbol, name, current_price, quantity } = req.body;

      if (!symbol || !name || !current_price || !quantity) {
        return res.status(400).json({ 
          message: "Missing required fields" 
        });
      }

      // First create or update the asset
      let asset = await storage.getAssetBySymbol(symbol);

      if (!asset) {
        // Create new asset
        asset = await storage.createAsset({
          symbol,
          name,
          type: symbol.length <= 4 ? 'crypto' : 'stock',
          currentPrice: current_price.toString(),
        });
      }

      // Create portfolio item
      const portfolioItem = await storage.createPortfolioItem({
        assetId: asset.id,
        quantity: quantity.toString(),
        averagePrice: current_price.toString(),
      });

      res.json({
        ...portfolioItem,
        asset
      });
    } catch (error) {
      console.error("Portfolio creation error:", error);
      res.status(500).json({ message: "Failed to create portfolio item" });
    }
  });

  app.get("/api/portfolio/insight", async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Insight generation error:", error);
      res.status(500).json({ message: "Failed to generate insight" });
    }
  });

  return httpServer;
}