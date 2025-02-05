import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchAssets, getPrice } from "./lib/coinmarketcap";
import { generatePortfolioInsight } from "./lib/openai";

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  app.get("/api/test-cmc", async (req, res) => {
    try {
      // Use the searchAssets function with a simple query
      const results = await searchAssets("bitcoin");
      res.json({ status: "success", message: "API key is working" });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: error instanceof Error ? error.message : "API key validation failed"
      });
    }
  });

  // Asset routes
  app.get("/api/assets/search", async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ 
        message: "Query parameter 'q' required",
        details: "Search query must be a non-empty string"
      });
    }

    try {
      const results = await searchAssets(q);
      if (!results || results.length === 0) {
        return res.status(404).json({ 
          message: "No results found",
          details: "The search returned no matching assets"
        });
      }

      console.log('Search results:', { 
        query: q,
        resultCount: results.length,
        firstResult: results[0]
      });

      res.json(results);
    } catch (error) {
      console.error("Search error:", error instanceof Error ? error.message : error);

      res.status(500).json({ 
        message: "Failed to search assets",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.get("/api/assets/:symbol/price", async (req, res) => {
    try {
      const price = await getPrice(req.params.symbol.toUpperCase());
      console.log('Price fetched:', { symbol: req.params.symbol, price });
      if (!price) {
        return res.status(404).json({ message: "Price not found" });
      }
      res.json({ price });
    } catch (error) {
      console.error("Price fetch error:", error);
      res.status(500).json({ message: "Failed to fetch price" });
    }
  });

  // Portfolio routes
  app.get("/api/portfolio", async (req, res) => {
    try {
      const items = await storage.getPortfolioItems();
      const assets = await storage.getAssets();
      console.log('Portfolio data:', { items, assets });

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
    console.log('Portfolio creation request:', req.body);
    try {
      const { symbol, name, current_price, quantity } = req.body;

      if (!symbol || !name || !current_price || !quantity) {
        console.log('Missing fields:', { symbol, name, current_price, quantity });
        return res.status(400).json({ 
          message: "Missing required fields",
          details: { symbol, name, current_price, quantity }
        });
      }

      // First create or update the asset
      let asset = await storage.getAssetBySymbol(symbol);
      console.log('Existing asset:', asset);

      if (!asset) {
        // Create new asset
        const assetData = {
          symbol,
          name,
          type: 'crypto',
          currentPrice: current_price.toString(),
        };
        console.log('Creating new asset:', assetData);
        asset = await storage.createAsset(assetData);
      }

      // Create portfolio item
      const portfolioItemData = {
        assetId: asset.id,
        quantity: quantity.toString(),
        averagePrice: current_price.toString(),
      };
      console.log('Creating portfolio item:', portfolioItemData);

      const portfolioItem = await storage.createPortfolioItem(portfolioItemData);

      console.log('Created portfolio item:', portfolioItem);
      res.json({
        ...portfolioItem,
        asset
      });
    } catch (error) {
      console.error("Portfolio creation error:", error);
      res.status(500).json({ 
        message: "Failed to create portfolio item",
        details: error instanceof Error ? error.message : String(error)
      });
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