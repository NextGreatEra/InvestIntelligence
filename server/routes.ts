import { Express } from "express";
import http from "http";
import { storage } from "./storage";
import { insertAssetSchema } from "@shared/schema";
import { searchStocks, initializeStockSymbols } from "./lib/finnhub";

export function registerRoutes(app: Express) {
  const server = http.createServer(app);

  // API routes will go here
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/portfolio', async (req, res) => {
    try {
      const portfolioItems = await storage.getPortfolioItemsWithAssets();
      const enrichedItems = await Promise.all(
        portfolioItems.map(async (item) => {
          if (item.assetType === 'stock') {
            const stock = await storage.getStockById(item.assetId);
            return {
              ...item,
              asset: {
                id: stock.id,
                symbol: stock.symbol,
                name: stock.description,
                currentPrice: stock.c,
                priceChangePercentage24h: stock.dp,
                type: 'stock'
              }
            };
          } else {
            const asset = await storage.getAssetById(item.assetId);
            return {
              ...item,
              asset: {
                id: asset.id,
                symbol: asset.symbol,
                name: asset.name,
                currentPrice: asset.price,
                priceChangePercentage24h: asset.percentChange24h,
                type: 'crypto'
              }
            };
          }
        })
      );
      res.json(enrichedItems);
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
      let results = [];

      // Search in our assets (crypto) table
      const cryptoResults = await storage.searchAssets(q);
      const formattedCryptoResults = cryptoResults.map(asset => ({
        id: asset.id.toString(),
        symbol: asset.symbol,
        name: asset.name,
        current_price: parseFloat(asset.price),
        percent_change_1h: asset.percentChange1h ? parseFloat(asset.percentChange1h) : null,
        percent_change_24h: asset.percentChange24h ? parseFloat(asset.percentChange24h) : null,
        percent_change_7d: asset.percentChange7d ? parseFloat(asset.percentChange7d) : null,
        type: 'crypto'
      }));

      // Search in our stocks table
      const stockResults = await storage.searchStocks(q);
      const formattedStockResults = stockResults.map(stock => ({
        id: stock.id.toString(),
        symbol: stock.symbol,
        name: stock.description,
        current_price: parseFloat(stock.c),
        percent_change_24h: stock.dp ? parseFloat(stock.dp) : null,
        type: 'stock'
      }));

      // Combine and sort results by symbol alphabetically
      results = [...formattedCryptoResults, ...formattedStockResults]
        .sort((a, b) => a.symbol.localeCompare(b.symbol));

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

      const { symbol, name, type, currentPrice } = req.body;

      if (!symbol || !name || !type || !currentPrice) {
        throw new Error('Missing required fields');
      }

      let asset;
      if (type === 'crypto') {
        // For crypto assets, use the assets table
        const { getPrice } = await import('./lib/coinmarketcap');
        try {
          const quote = await getPrice(symbol);
          if (!quote || typeof quote.price === 'undefined') {
            throw new Error('Failed to fetch crypto price');
          }

          asset = await storage.createAsset({
            cmcId: parseInt(req.body.id), // This will be provided for crypto assets
            symbol: symbol.toUpperCase(),
            name: name,
            price: quote.price.toString(),
            percentChange24h: quote.percent_change_24h ? quote.percent_change_24h.toString() : null,
            lastUpdated: new Date()
          });
        } catch (error) {
          console.error('Error fetching crypto price:', error);
          throw new Error('Failed to fetch crypto price data');
        }
      } else if (type === 'stock') {
        // For stock assets, use the stocks table
        const { getStockPrice } = await import('./lib/finnhub');
        try {
          const { price, priceChange } = await getStockPrice(symbol);
          if (!price) {
            throw new Error('Failed to fetch stock price');
          }

          // Get or create stock record
          const existingStock = await storage.getStockBySymbol(symbol);
          if (existingStock) {
            asset = existingStock;
          } else {
            asset = await storage.createStock({
              symbol: symbol.toUpperCase(),
              description: name,
              c: price.toString(),
              dp: priceChange ? priceChange.toString() : null
            });
          }
        } catch (error) {
          console.error('Error fetching stock price:', error);
          throw new Error('Failed to fetch stock price data');
        }
      } else {
        throw new Error('Invalid asset type');
      }

      // Create the portfolio item with the asset type
      const portfolioItem = await storage.createPortfolioItem({
        assetId: asset.id,
        rank: 0,
        assetType: type
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
      // Fetch top crypto assets directly from storage
      const assets = await storage.getAssets();
      const cryptoMarkets = assets
        .filter(coin => ['BTC', 'ETH', 'LINK'].includes(coin.symbol))
        .map(coin => ({
          id: coin.id.toString(),
          symbol: coin.symbol,
          name: coin.name,
          current_price: parseFloat(coin.price),
          percent_change_1h: coin.percentChange1h ? parseFloat(coin.percentChange1h) : null,
          percent_change_24h: coin.percentChange24h ? parseFloat(coin.percentChange24h) : null,
          percent_change_7d: coin.percentChange7d ? parseFloat(coin.percentChange7d) : null,
          type: 'crypto'
        }));

      // Fetch stock data from our database
      const stockSymbols = ['SPY', 'QQQ'];
      const stockData = await Promise.all(
        stockSymbols.map(async symbol => {
          let stock = await storage.getStockBySymbol(symbol);

          // If stock is missing or has no price data, fetch it from Finnhub
          if (!stock || !stock.c || !stock.dp) {
            console.log(`Fetching fresh data for ${symbol} from Finnhub`);
            const { getStockPrice } = await import('./lib/finnhub');
            try {
              const { price, priceChange } = await getStockPrice(symbol);
              // This will create or update the stock in our database
              stock = await storage.createStock({
                symbol,
                description: symbol === 'SPY' ? 'S&P 500 ETF' : 'Nasdaq 100 ETF',
                c: price.toString(),
                dp: priceChange.toString()
              });
            } catch (error) {
              console.error(`Failed to fetch ${symbol} data:`, error);
              return null;
            }
          }

          return {
            id: stock.id.toString(),
            symbol: stock.symbol,
            name: stock.description,
            current_price: parseFloat(stock.c),
            percent_change_24h: stock.dp ? parseFloat(stock.dp) : null,
            type: 'stock'
          };
        })
      );

      const validStockData = stockData.filter(stock => stock !== null);
      res.json([...cryptoMarkets, ...validStockData]);
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

  // Add new route for initializing stock symbols
  app.post('/api/stocks/initialize', async (req, res) => {
    try {
      const count = await initializeStockSymbols();
      res.json({ message: `Successfully initialized ${count} stock symbols` });
    } catch (error) {
      console.error('Failed to initialize stock symbols:', error);
      res.status(500).json({ message: 'Failed to initialize stock symbols' });
    }
  });

  return server;
}