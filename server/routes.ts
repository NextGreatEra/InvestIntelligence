import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchAssets as searchCrypto, getPrice as getCryptoPrice } from "./lib/coinmarketcap";
import { searchStocks, getStockPrice } from "./lib/finnhub";

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
    const { q } = req.query;
    if (!q || typeof q !== "string" || q.length < 2) {
      return res.status(400).json({ 
        message: "Search query must be at least 2 characters"
      });
    }

    try {
      const results = await searchCrypto(q); 
      const searchResults = results || [];

      if (searchResults.length === 0) {
        return res.status(404).json({ 
          message: "No assets found matching your search"
        });
      }

      res.json(searchResults);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ 
        message: "Failed to search assets. Please try again."
      });
    }
  });

  app.get("/api/assets/:symbol/price", async (req, res) => {
    try {
      const price = await getCryptoPrice(req.params.symbol.toUpperCase()); 
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

      // Get historical prices from storage for 24h change
      const btcAsset = await storage.getAssetBySymbol('BTC');
      const ethAsset = await storage.getAssetBySymbol('ETH');
      const spyAsset = await storage.getAssetBySymbol('SPY');
      const qqqAsset = await storage.getAssetBySymbol('QQQ');

      const markets = [
        {
          id: 'bitcoin',
          symbol: 'BTC',
          name: 'Bitcoin',
          current_price: btcPrice,
          price_change_24h: btcAsset ? (btcPrice - Number(btcAsset.currentPrice)) : 0,
          price_change_percentage_24h: btcAsset ? ((btcPrice - Number(btcAsset.currentPrice)) / Number(btcAsset.currentPrice) * 100) : 0
        },
        {
          id: 'ethereum',
          symbol: 'ETH',
          name: 'Ethereum',
          current_price: ethPrice,
          price_change_24h: ethAsset ? (ethPrice - Number(ethAsset.currentPrice)) : 0,
          price_change_percentage_24h: ethAsset ? ((ethPrice - Number(ethAsset.currentPrice)) / Number(ethAsset.currentPrice) * 100) : 0
        },
        {
          id: 'sp500',
          symbol: 'SPY',
          name: 'S&P 500 ETF',
          current_price: spyPrice,
          price_change_24h: spyAsset ? (spyPrice - Number(spyAsset.currentPrice)) : 0,
          price_change_percentage_24h: spyAsset ? ((spyPrice - Number(spyAsset.currentPrice)) / Number(spyAsset.currentPrice) * 100) : 0
        },
        {
          id: 'nasdaq',
          symbol: 'QQQ',
          name: 'Nasdaq-100 ETF',
          current_price: qqqPrice,
          price_change_24h: qqqAsset ? (qqqPrice - Number(qqqAsset.currentPrice)) : 0,
          price_change_percentage_24h: qqqAsset ? ((qqqPrice - Number(qqqAsset.currentPrice)) / Number(qqqAsset.currentPrice) * 100) : 0
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