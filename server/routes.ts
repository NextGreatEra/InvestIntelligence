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
      const assets = results.map(coin => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        current_price: 0 // Will be fetched when selected
      }));
      res.json(assets);
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
    const validation = insertPortfolioItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        message: "Invalid portfolio item data",
        errors: validation.error.errors 
      });
    }

    try {
      // First ensure we have the asset in our database
      const { assetId, symbol, name, currentPrice } = req.body;
      let asset = await storage.getAsset(assetId);

      if (!asset) {
        // Create the asset if it doesn't exist
        asset = await storage.createAsset({
          symbol,
          name,
          type: symbol.length <= 4 ? 'crypto' : 'stock', // Simple heuristic
          currentPrice: currentPrice.toString(),
        });
      }

      // Create the portfolio item
      const item = await storage.createPortfolioItem({
        assetId: asset.id,
        quantity: validation.data.quantity,
        averagePrice: validation.data.averagePrice,
      });

      res.json(item);
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