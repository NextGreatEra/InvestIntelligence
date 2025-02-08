import { Express } from "express";
import http from "http";
import { storage } from "./storage";
import { insertAssetSchema, insertPortfolioItemSchema } from "@shared/schema";
import { searchStocks } from "./lib/finnhub";

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
    const { q, type } = req.query;
    if (typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    try {
      let results = [];

      // If type is not specified or is 'stock', search for stocks
      if (!type || type === 'stock') {
        const stockResults = await searchStocks(q);
        console.log('Stock search results:', stockResults); // Debug log
        results.push(...stockResults);
      }

      // If type is not specified or is 'crypto', search for cryptocurrencies
      if (!type || type === 'crypto') {
        const { searchAssets } = await import('./lib/coinmarketcap');
        const cryptoResults = await searchAssets(q);
        console.log('Crypto search results:', cryptoResults); // Debug log
        if (cryptoResults) {
          results.push(...cryptoResults);
        }
      }

      console.log('Final search results:', results); // Debug log
      res.json(results);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ message: 'Failed to search assets' });
    }
  });

  // Add portfolio item endpoint
  app.post('/api/portfolio', async (req, res) => {
    try {
      console.log('Received portfolio item request:', req.body);

      // Parse and validate the asset data
      const assetData = insertAssetSchema.parse({
        symbol: req.body.symbol,
        name: req.body.name,
        type: req.body.type,
        currentPrice: req.body.currentPrice || req.body.current_price // Handle both property names
      });

      console.log('Validated asset data:', assetData);

      // Create the asset first
      const asset = await storage.createAsset(assetData);
      console.log('Asset created:', asset);

      // Create the portfolio item with default rank
      const portfolioItem = await storage.createPortfolioItem({
        assetId: asset.id,
        rank: 0
      });

      console.log('Portfolio item created:', portfolioItem);
      res.json(portfolioItem);
    } catch (error) {
      console.error('Error adding portfolio item:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Failed to add asset to portfolio' 
      });
    }
  });

  app.get('/api/markets', async (req, res) => {
    try {
      const [{ refreshTopCoins }, { getStockPrice }] = await Promise.all([
        import('./lib/coinmarketcap'),
        import('./lib/finnhub')
      ]);

      const coins = await refreshTopCoins();
      const cryptoMarkets = coins
        .filter(coin => ['BTC', 'ETH'].includes(coin.symbol))
        .map(coin => ({
          id: coin.id.toString(),
          symbol: coin.symbol,
          name: coin.name,
          current_price: coin.quote.USD.price,
          price_change_percentage_24h: coin.quote.USD.percent_change_24h
        }));

      const stockSymbols = ['SPY', 'QQQ'];
      const stockPrices = await Promise.all(
        stockSymbols.map(async symbol => {
          const price = await getStockPrice(symbol);
          return {
            id: symbol,
            symbol,
            name: symbol === 'SPY' ? 'S&P 500 ETF' : 'Nasdaq 100 ETF',
            current_price: price,
            price_change_percentage_24h: 0 // Note: We would need additional API calls to get 24h change
          };
        })
      );

      res.json([...cryptoMarkets, ...stockPrices]);
    } catch (error) {
      console.error('Error fetching markets:', error);
      res.status(500).json({ message: 'Failed to fetch markets data' });
    }
  });

  // Add new route for updating portfolio item allocation
  app.patch('/api/portfolio/:id/allocation', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { allocation } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid portfolio item ID' });
      }

      if (typeof allocation !== 'number' || allocation < 0 || allocation > 100) {
        return res.status(400).json({ message: 'Allocation must be a number between 0 and 100' });
      }

      await storage.updatePortfolioItemAllocation(id, allocation.toString());
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating allocation:', error);
      res.status(500).json({ message: 'Failed to update allocation' });
    }
  });

  return server;
}