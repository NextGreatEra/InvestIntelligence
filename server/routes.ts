import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchAssets as searchCrypto, getPrice as getCryptoPrice } from "./lib/coinmarketcap";
import { searchStocks, getStockPrice } from "./lib/finnhub";
import { generatePortfolioInsight } from "./lib/openai";

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  app.get("/api/test-cmc", async (req, res) => {
    try {
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
    const { q, type } = req.query;
    if (!q || typeof q !== "string" || q.length < 2) {
      return res.status(400).json({ 
        message: "Search query must be at least 2 characters"
      });
    }

    try {
      let results = [];
      const searchType = typeof type === 'string' ? type : undefined;
      
      if (!searchType || searchType === 'crypto') {
        const cryptoResults = await searchCrypto(q);
        results = [...results, ...(cryptoResults || [])];
      }
      if (!searchType || searchType === 'stock') {
        const stockResults = await searchStocks(q);
        results = [...results, ...(stockResults || [])];
      }

      if (results.length === 0) {
        return res.status(404).json({ 
          message: "No assets found matching your search"
        });
      }

      res.json(results);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ 
        message: "Failed to search assets. Please try again."
      });
    }
  });

  app.get("/api/assets/:symbol/price", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { type } = req.query;
      let price;
      
      if (type === 'stock') {
        price = await getStockPrice(symbol.toUpperCase());
      } else {
        price = await getCryptoPrice(symbol.toUpperCase());
      }
      
      console.log('Price fetched:', { symbol, type, price });
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

      const portfolio = await Promise.all(
        items.map(async (item) => {
          const asset = assets.find((a) => a.id === item.assetId);
          if (!asset) return null;

          const priceHistory = await storage.getPriceHistory24h(asset.symbol);
          const currentPrice = Number(asset.currentPrice);
          const priceChange24h = priceHistory ? 
            ((currentPrice - priceHistory.price) / priceHistory.price * 100)
            : 0;

          return {
            ...asset,
            allocation: Number(item.allocation),
            rank: item.rank,
            value: Number(asset.currentPrice),
            priceChange24h
          };
        })
      );

      res.json(portfolio.filter(Boolean));
    } catch (error) {
      console.error("Portfolio fetch error:", error);
      res.status(500).json({ message: "Failed to fetch portfolio" });
    }
  });

  app.delete("/api/portfolio/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const numericId = Number(id);

      if (isNaN(numericId)) {
        return res.status(400).json({ message: "Invalid portfolio item ID" });
      }

      console.log('Processing delete request for portfolio item:', { id: numericId });

      // Get the portfolio item to verify it exists
      const items = await storage.getPortfolioItems();
      const itemExists = items.some(item => item.id === numericId);

      if (!itemExists) {
        console.log('Portfolio item not found:', { id: numericId, availableIds: items.map(i => i.id) });
        return res.status(404).json({ message: "Portfolio item not found" });
      }

      await storage.removePortfolioItem(numericId);
      console.log('Portfolio item deleted successfully:', { id: numericId });

      res.json({ message: "Asset removed from portfolio" });
    } catch (error) {
      console.error("Portfolio item deletion error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to remove asset from portfolio" 
      });
    }
  });

  app.patch("/api/portfolio/:id/rank", async (req, res) => {
    try {
      const { id } = req.params;
      const { rank } = req.body;

      if (typeof rank !== 'number') {
        return res.status(400).json({ message: "Invalid rank value" });
      }

      const updatedItem = await storage.updatePortfolioRank(Number(id), rank);
      res.json(updatedItem);
    } catch (error) {
      console.error("Rank update error:", error);
      res.status(500).json({ message: "Failed to update asset rank" });
    }
  });

  app.post("/api/portfolio", async (req, res) => {
    console.log('Portfolio creation request:', req.body);
    try {
      const { symbol, name, currentPrice, type = 'crypto' } = req.body;

      if (!symbol || !name || !currentPrice) {
        console.log('Missing fields:', { symbol, name, currentPrice });
        return res.status(400).json({ 
          message: "Missing required fields",
          details: { symbol, name, currentPrice }
        });
      }

      // First create or update the asset
      let asset = await storage.getAssetBySymbol(symbol);
      console.log('Existing asset:', asset);

      if (!asset) {
        const assetData = {
          symbol,
          name,
          type,
          currentPrice: currentPrice.toString(),
        };
        console.log('Creating new asset:', assetData);
        asset = await storage.createAsset(assetData);
      }

      // Get current portfolio items to calculate allocation
      const currentItems = await storage.getPortfolioItems();
      const newAllocation = (100 / (currentItems.length + 1)).toString();

      // Update existing allocations to make room for the new asset
      for (const item of currentItems) {
        const updatedAllocation = (Number(item.allocation) * (currentItems.length / (currentItems.length + 1))).toString();
        await storage.updatePortfolioAllocation(item.id, updatedAllocation);
      }

      // Create portfolio item with calculated allocation
      const portfolioItemData = {
        assetId: asset.id,
        allocation: newAllocation,
        rank: 0, // Will be set automatically in storage layer
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
          value: Number(item.allocation) * Number(asset.currentPrice), // Use allocation instead of quantity
          profitLoss: (Number(asset.currentPrice) - Number(item.averagePrice)) * Number(item.allocation) // Use allocation instead of quantity
        };
      }).filter(Boolean);

      const insight = await generatePortfolioInsight(portfolio);
      res.json(insight);
    } catch (error) {
      console.error("Insight generation error:", error);
      res.status(500).json({ message: "Failed to generate insight" });
    }
  });

  app.get("/api/markets", async (req, res) => {
    try {
      // Fetch crypto data from CoinMarketCap
      const [btcPrice, ethPrice] = await Promise.all([
        getCryptoPrice('BTC'),
        getCryptoPrice('ETH')
      ]);

      // Fetch stock ETFs from Finnhub
      const [spyPrice, qqqPrice] = await Promise.all([
        getStockPrice('SPY'),
        getStockPrice('QQQ')
      ]);

      // Store current prices in history
      await Promise.all([
        storage.addPriceHistory({ assetId: 'BTC', price: btcPrice }),
        storage.addPriceHistory({ assetId: 'ETH', price: ethPrice }),
        storage.addPriceHistory({ assetId: 'SPY', price: spyPrice }),
        storage.addPriceHistory({ assetId: 'QQQ', price: qqqPrice })
      ]);

      // Get 24h ago prices
      const [btcHistory, ethHistory, spyHistory, qqqHistory] = await Promise.all([
        storage.getPriceHistory24h('BTC'),
        storage.getPriceHistory24h('ETH'),
        storage.getPriceHistory24h('SPY'),
        storage.getPriceHistory24h('QQQ')
      ]);

      const markets = [
        {
          id: 'bitcoin',
          symbol: 'BTC',
          name: 'Bitcoin',
          current_price: btcPrice,
          price_change_24h: btcHistory ? (btcPrice - btcHistory.price) : 0,
          price_change_percentage_24h: btcHistory ? ((btcPrice - btcHistory.price) / btcHistory.price * 100) : 0
        },
        {
          id: 'ethereum',
          symbol: 'ETH',
          name: 'Ethereum',
          current_price: ethPrice,
          price_change_24h: ethHistory ? (ethPrice - ethHistory.price) : 0,
          price_change_percentage_24h: ethHistory ? ((ethPrice - ethHistory.price) / ethHistory.price * 100) : 0
        },
        {
          id: 'sp500',
          symbol: 'SPY',
          name: 'S&P 500 ETF',
          current_price: spyPrice,
          price_change_24h: spyHistory ? (spyPrice - spyHistory.price) : 0,
          price_change_percentage_24h: spyHistory ? ((spyPrice - spyHistory.price) / spyHistory.price * 100) : 0
        },
        {
          id: 'nasdaq',
          symbol: 'QQQ',
          name: 'Nasdaq-100 ETF',
          current_price: qqqPrice,
          price_change_24h: qqqHistory ? (qqqPrice - qqqHistory.price) : 0,
          price_change_percentage_24h: qqqHistory ? ((qqqPrice - qqqHistory.price) / qqqHistory.price * 100) : 0
        }
      ];

      res.json(markets);
    } catch (error) {
      console.error("Markets fetch error:", error);
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  app.patch("/api/portfolio/:id/allocation", async (req, res) => {
    try {
      const { id } = req.params;
      const { allocation } = req.body;

      if (typeof allocation !== 'number' || allocation < 0 || allocation > 100) {
        return res.status(400).json({ message: "Invalid allocation value" });
      }

      // Get current portfolio to validate total allocation
      const items = await storage.getPortfolioItems();
      const otherItems = items.filter(item => item.id !== Number(id));
      const totalOtherAllocation = otherItems.reduce(
        (sum, item) => sum + Number(item.allocation),
        0
      );

      if (totalOtherAllocation + allocation > 100) {
        return res.status(400).json({ 
          message: "Total portfolio allocation cannot exceed 100%" 
        });
      }

      // Update the allocation
      await storage.updatePortfolioAllocation(Number(id), allocation.toString());
      res.json({ message: "Allocation updated successfully" });
    } catch (error) {
      console.error("Allocation update error:", error);
      res.status(500).json({ message: "Failed to update allocation" });
    }
  });

  return httpServer;
}