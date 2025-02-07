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
      console.log('Portfolio data:', { items, assets });

      const portfolio = await Promise.all(
        items.map(async (item) => {
          const asset = assets.find((a) => a.id === item.assetId);
          if (!asset) return null;

          // Fetch current price and 24h change from appropriate API
          let priceData;
          try {
            if (asset.type === 'stock') {
              priceData = await getStockPrice(asset.symbol);
            } else {
              priceData = await getCryptoPrice(asset.symbol);
            }

            // Update asset price in database
            await storage.updateAssetPrice(asset.id, priceData.price);

            return {
              ...asset,
              currentPrice: priceData.price.toString(),
              holdings: Number(item.quantity),
              value: Number(item.quantity) * priceData.price,
              priceChange24h: priceData.priceChange24h
            };
          } catch (error) {
            console.error(`Failed to fetch price data for ${asset.symbol}:`, error);
            // Return asset with current stored values if API call fails
            return {
              ...asset,
              holdings: Number(item.quantity),
              value: Number(item.quantity) * Number(asset.currentPrice),
              priceChange24h: 0
            };
          }
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
      const { symbol, name, currentPrice, quantity } = req.body;

      if (!symbol || !name || !currentPrice || !quantity) {
        console.log('Missing fields:', { symbol, name, currentPrice, quantity });
        return res.status(400).json({
          message: "Missing required fields",
          details: { symbol, name, currentPrice, quantity }
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
          currentPrice: currentPrice.toString(),
        };
        console.log('Creating new asset:', assetData);
        asset = await storage.createAsset(assetData);
      }

      // Create portfolio item
      const portfolioItemData = {
        assetId: asset.id,
        quantity: quantity.toString(),
        averagePrice: currentPrice.toString(),
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

  app.get("/api/markets", async (req, res) => {
    try {
      // First ensure assets exist in the database
      const [btcAsset, ethAsset] = await Promise.all([
        storage.getAssetBySymbol('BTC') || storage.createAsset({
          symbol: 'BTC',
          name: 'Bitcoin',
          type: 'crypto',
          currentPrice: '0'
        }),
        storage.getAssetBySymbol('ETH') || storage.createAsset({
          symbol: 'ETH',
          name: 'Ethereum',
          type: 'crypto',
          currentPrice: '0'
        })
      ]);

      // Fetch current prices
      const [btcPrice, ethPrice] = await Promise.all([
        getCryptoPrice('BTC'),
        getCryptoPrice('ETH')
      ]);

      // Store current prices in history using proper asset IDs
      await Promise.all([
        storage.addPriceHistory({ assetId: btcAsset.id, price: btcPrice }),
        storage.addPriceHistory({ assetId: ethAsset.id, price: ethPrice })
      ]);

      // Get 24h ago prices
      const [btcHistory, ethHistory] = await Promise.all([
        storage.getPriceHistory24h('BTC'),
        storage.getPriceHistory24h('ETH')
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
        }
      ];

      res.json(markets);
    } catch (error) {
      console.error("Markets fetch error:", error);
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  return httpServer;
}