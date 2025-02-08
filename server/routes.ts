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
        console.log('Stock search results:', stockResults);
        results.push(...stockResults);
      }

      // If type is not specified or is 'crypto', search for cryptocurrencies
      if (!type || type === 'crypto') {
        const { searchAssets } = await import('./lib/coinmarketcap');
        const cryptoResults = await searchAssets(q);
        console.log('Crypto search results:', cryptoResults);
        if (cryptoResults) {
          results.push(...cryptoResults);
        }
      }

      console.log('Final search results:', results);
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

      let currentPrice;
      let priceChangePercentage24h;

      // Determine type based on presence of id field (crypto) or not (stock)
      const assetType = req.body.id ? 'crypto' : 'stock';

      // Fetch fresh price data based on asset type
      if (assetType === 'crypto') {
        const { getPrice } = await import('./lib/coinmarketcap');
        try {
          const quote = await getPrice(req.body.symbol);
          if (!quote || typeof quote.price === 'undefined') {
            throw new Error('Failed to fetch crypto price');
          }
          currentPrice = quote.price;
          priceChangePercentage24h = quote.percent_change_24h;
        } catch (error) {
          console.error('Error fetching crypto price:', error);
          throw new Error('Failed to fetch crypto price data');
        }
      } else if (assetType === 'stock') {
        const { getStockPrice } = await import('./lib/finnhub');
        try {
          const { price, priceChange } = await getStockPrice(req.body.symbol);
          if (!price) {
            throw new Error('Failed to fetch stock price');
          }
          currentPrice = price;
          priceChangePercentage24h = priceChange;
        } catch (error) {
          console.error('Error fetching stock price:', error);
          throw new Error('Failed to fetch stock price data');
        }
      }

      if (!currentPrice || isNaN(currentPrice)) {
        throw new Error('Invalid price value');
      }

      // Validate and format the data
      const assetData = insertAssetSchema.parse({
        symbol: req.body.symbol.toUpperCase(),
        name: req.body.name,
        type: req.body.type,
        currentPrice: currentPrice.toString(),
        priceChangePercentage24h: priceChangePercentage24h != null 
          ? priceChangePercentage24h.toString() 
          : null,
        lastUpdated: new Date()
      });

      console.log('Formatted asset data:', assetData);

      // Create the asset
      const asset = await storage.createAsset(assetData);
      console.log('Asset created:', asset);

      // Create the portfolio item
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
        .filter(coin => ['BTC', 'ETH', 'LINK'].includes(coin.symbol))
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
          const { price, priceChange } = await getStockPrice(symbol);
          return {
            id: symbol,
            symbol,
            name: symbol === 'SPY' ? 'S&P 500 ETF' : 'Nasdaq 100 ETF',
            current_price: price,
            price_change_percentage_24h: priceChange
          };
        })
      );

      res.json([...cryptoMarkets, ...stockPrices]);
    } catch (error) {
      console.error('Error fetching markets:', error);
      res.status(500).json({ message: 'Failed to fetch markets data' });
    }
  });

  app.patch('/api/portfolio/:id/rank', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { rank } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid portfolio item ID' });
      }

      if (typeof rank !== 'number') {
        return res.status(400).json({ message: 'Invalid rank value' });
      }

      await storage.updatePortfolioRank(id, rank);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating portfolio item rank:', error);
      res.status(500).json({ message: 'Failed to update portfolio item rank' });
    }
  });

  return server;
}