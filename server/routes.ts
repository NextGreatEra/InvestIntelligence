import { Express } from "express";
import http from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

// Middleware to ensure user is authenticated
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      message: "Please create an account to save your portfolio changes",
      code: "AUTH_REQUIRED"
    });
  }
  next();
}

export function registerRoutes(app: Express) {
  const server = http.createServer(app);

  // Setup authentication routes
  setupAuth(app);

  // API routes will go here
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Public routes
  app.get('/api/portfolio/insight', async (req, res) => {
    try {
      const persona = req.query.persona as string;
      const userId = req.user?.id; // Optional user ID

      // Fetch both portfolio items and market data
      const [portfolioItems, marketAssets] = await Promise.all([
        userId ? storage.getPortfolioItemsWithAssets(userId) : [],
        (async () => {
          const assets = await storage.getAssets();
          const cryptoMarkets = assets
            .filter(coin => ['BTC', 'ETH'].includes(coin.symbol))
            .filter((coin, index, self) =>
              index === self.findIndex((t) => t.symbol === coin.symbol)
            )
            .map(coin => ({
              id: coin.id.toString(),
              symbol: coin.symbol,
              name: coin.name || coin.symbol,
              description: coin.name || coin.symbol,
              current_price: parseFloat(coin.price?.toString() || '0'),
              percent_change_1h: coin.percentChange1h ? parseFloat(coin.percentChange1h.toString()) : null,
              percent_change_24h: coin.percentChange24h ? parseFloat(coin.percentChange24h.toString()) : null,
              percent_change_7d: coin.percentChange7d ? parseFloat(coin.percentChange7d.toString()) : null,
              type: 'crypto'
            }));

          const stockSymbols = ['SPY', 'QQQ'];
          const stockData = await Promise.all(
            stockSymbols.map(async symbol => {
              const stock = await storage.getStockBySymbol(symbol);
              return stock ? {
                id: stock.id.toString(),
                symbol: stock.symbol,
                name: stock.description,
                description: stock.description,
                current_price: parseFloat(stock.c),
                percent_change_24h: stock.dp ? parseFloat(stock.dp) : null,
                type: 'stock'
              } : null;
            })
          );

          const validStockData = stockData.filter((stock): stock is NonNullable<typeof stock> => stock !== null);
          return [...cryptoMarkets, ...validStockData];
        })()
      ]);

      // Enrich portfolio items with full asset data
      const enrichedPortfolioItems = await Promise.all(
        portfolioItems.map(async (item) => {
          if (item.assetType === 'stock') {
            const stock = await storage.getStockById(item.assetId);
            if(!stock) return null; //Handle potential null
            return {
              id: item.id,
              assetName: stock.description || stock.symbol,
              symbol: stock.symbol,
              type: item.assetType,
              currentPrice: parseFloat(stock.c),
              percentChange: {
                '24h': stock.dp ? parseFloat(stock.dp) : null
              }
            };
          } else {
            const asset = await storage.getAssetById(item.assetId);
            if(!asset) return null; //Handle potential null
            return {
              id: item.id,
              assetName: asset.name || asset.symbol,
              symbol: asset.symbol,
              type: item.assetType,
              currentPrice: parseFloat(asset.price?.toString() || '0'),
              percentChange: {
                '1h': asset.percentChange1h ? parseFloat(asset.percentChange1h.toString()) : null,
                '24h': asset.percentChange24h ? parseFloat(asset.percentChange24h.toString()) : null,
                '7d': asset.percentChange7d ? parseFloat(asset.percentChange7d.toString()) : null
              }
            };
          }
        })
      );

      const { generatePortfolioInsight } = await import('./lib/openai');

      const dataForAI = {
        portfolioItems: enrichedPortfolioItems.filter(item => item !== null), //Filter out nulls
        marketAssets,
        marketSummary: {
          totalAssets: enrichedPortfolioItems.filter(item => item !== null).length, //Filter out nulls
          assetTypes: {
            crypto: enrichedPortfolioItems.filter(item => item?.type === 'crypto').length, //Handle potential null
            stocks: enrichedPortfolioItems.filter(item => item?.type === 'stock').length //Handle potential null
          },
          topMovers: marketAssets
            .filter(asset => asset.percent_change_24h != null)
            .sort((a, b) => Math.abs(b.percent_change_24h || 0) - Math.abs(a.percent_change_24h || 0))
            .slice(0, 3)
            .map(asset => ({
              symbol: asset.symbol,
              change24h: asset.percent_change_24h || 0
            }))
        },
        persona
      };

      try {
        const insights = await generatePortfolioInsight(dataForAI);
        res.json(insights);
      } catch (error) {
        console.error('Error generating portfolio insight:', error);
        res.json({
          message: "Your portfolio's showing more moves than a chess grandmaster! I'll have a deeper analysis ready in a moment.",
          sentiment: "neutral",
          disclaimer: "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
        });
      }
    } catch (error) {
      console.error('Error in portfolio insight route:', error);
      res.status(500).json({
        message: "Systems running hot like crypto in a bull market! Give me a minute to cool down.",
        sentiment: "neutral",
        disclaimer: "Not financial advice. Do your own research and consult licensed professionals before making investment decisions."
      });
    }
  });

  app.get('/api/portfolio', async (req, res) => {
    try {
      const userId = req.user?.id;
      const portfolioItems = userId ? await storage.getPortfolioItemsWithAssets(userId) : [];
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
                percent_change_1h: asset.percentChange1h,
                percent_change_24h: asset.percentChange24h,
                percent_change_7d: asset.percentChange7d,
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

  // Protected routes - require authentication
  app.post('/api/portfolio', requireAuth, async (req, res) => {
    try {
      const { symbol, name, type } = req.body;

      if (!symbol || !name || !type) {
        throw new Error('Missing required fields');
      }

      let asset;
      if (type === 'stock') {
        asset = await storage.getStockBySymbol(symbol);
        if (!asset) {
          throw new Error('Stock not found in database');
        }

        // If price is 0 or missing, fetch fresh price
        if (parseFloat(asset.c) === 0 || !asset.c) {
          const { getStockPrice } = await import('./lib/finnhub');
          const { price, priceChange } = await getStockPrice(symbol);
          asset = await storage.updateStock(symbol, price, priceChange);
        }
      } else if (type === 'crypto') {
        asset = await storage.getAssetBySymbol(symbol);
        if (!asset) {
          throw new Error('Crypto asset not found in database');
        }
      } else {
        throw new Error('Invalid asset type');
      }

      const portfolioItem = await storage.createPortfolioItem({
        userId: req.user!.id,
        assetId: asset.id,
        rank: 0,
        assetType: type
      });

      res.json(portfolioItem);
    } catch (error) {
      console.error('Error adding portfolio item:', error);
      res.status(400).json({
        message: error instanceof Error ? error.message : 'Failed to add asset to portfolio'
      });
    }
  });

  app.delete('/api/portfolio/:id', requireAuth, async (req, res) => {
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

  app.patch('/api/portfolio/:id/rank', requireAuth, async (req, res) => {
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

  app.get('/api/assets/search', async (req, res) => {
    const { q } = req.query;
    if (typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    try {
      // Search in stocks table
      const stockResults = await storage.searchStocks(q);
      const formattedStockResults = await Promise.all(stockResults.map(async stock => {
        // If price is 0 or null, fetch fresh price from Finnhub
        let currentPrice = parseFloat(stock.c);
        let dailyChange = stock.dp ? parseFloat(stock.dp) : null;

        if (currentPrice === 0 || !currentPrice) {
          try {
            const { getStockPrice } = await import('./lib/finnhub');
            const { price, priceChange } = await getStockPrice(stock.symbol);
            currentPrice = price;
            dailyChange = priceChange;

            // Update stock price in database
            await storage.updateStock(stock.symbol, price, priceChange);
          } catch (error) {
            console.error(`Failed to fetch price for ${stock.symbol}:`, error);
          }
        }

        return {
          id: stock.id.toString(),
          symbol: stock.symbol,
          name: stock.description,
          current_price: currentPrice,
          percent_change_24h: dailyChange,
          type: 'stock'
        };
      }));

      // Search in assets (crypto) table
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

      // Combine results
      let results = [...formattedStockResults, ...formattedCryptoResults];

      // If no results found and the query looks like a stock symbol (uppercase, 1-5 chars)
      if (results.length === 0 && /^[A-Z]{1,5}$/.test(q.toUpperCase())) {
        try {
          const { getStockPrice } = await import('./lib/finnhub');
          const { price, priceChange } = await getStockPrice(q.toUpperCase());

          // If we got a valid price, create a new stock entry
          if (price > 0) {
            const newStock = await storage.createStock({
              symbol: q.toUpperCase(),
              description: q.toUpperCase(), // We'll just use the symbol as description initially
              c: price.toString(),
              dp: priceChange.toString()
            });

            results = [{
              id: newStock.id.toString(),
              symbol: newStock.symbol,
              name: newStock.description,
              current_price: price,
              percent_change_24h: priceChange,
              type: 'stock'
            }];
          }
        } catch (error) {
          console.error('Error fetching from Finnhub:', error);
        }
      }

      // Sort results
      results = results.sort((a, b) => a.symbol.localeCompare(b.symbol));

      res.json(results);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ message: 'Failed to search assets' });
    }
  });

  app.post('/api/portfolio', requireAuth, async (req, res) => {
    try {
      console.log('Received portfolio item request:', req.body);
      const { symbol, name, type } = req.body;

      if (!symbol || !name || !type) {
        throw new Error('Missing required fields');
      }

      let asset;
      if (type === 'stock') {
        asset = await storage.getStockBySymbol(symbol);
        if (!asset) {
          throw new Error('Stock not found in database');
        }

        // If price is 0 or missing, fetch fresh price
        if (parseFloat(asset.c) === 0 || !asset.c) {
          const { getStockPrice } = await import('./lib/finnhub');
          const { price, priceChange } = await getStockPrice(symbol);
          asset = await storage.updateStock(symbol, price, priceChange);
        }
      } else if (type === 'crypto') {
        asset = await storage.getAssetBySymbol(symbol);
        if (!asset) {
          throw new Error('Crypto asset not found in database');
        }
      } else {
        throw new Error('Invalid asset type');
      }

      const portfolioItem = await storage.createPortfolioItem({
        userId: req.user!.id,
        assetId: asset.id,
        rank: 0,
        assetType: type
      });

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
        .filter(coin => ['BTC', 'ETH'].includes(coin.symbol))
        // Add distinct check to prevent duplicates
        .filter((coin, index, self) =>
          index === self.findIndex((t) => t.symbol === coin.symbol)
        )
        // Sort to ensure BTC comes first
        .sort((a, b) => {
          if (a.symbol === 'BTC') return -1;
          if (b.symbol === 'BTC') return 1;
          return 0;
        })
        .map(coin => ({
          id: coin.id.toString(),
          symbol: coin.symbol,
          name: coin.name,
          current_price: parseFloat(coin.price),
          percent_change_1h: coin.percentChange1h ? Number(coin.percentChange1h) : null,
          percent_change_24h: coin.percentChange24h ? Number(coin.percentChange24h) : null,
          percent_change_7d: coin.percentChange7d ? Number(coin.percentChange7d) : null,
          type: 'crypto'
        }));

      const stockSymbols = ['SPY', 'QQQ'];
      const stockData = await Promise.all(
        stockSymbols.map(async symbol => {
          let stock = await storage.getStockBySymbol(symbol);

          if (!stock || !stock.c || !stock.dp) {
            console.log(`Fetching fresh data for ${symbol} from Finnhub`);
            const { getStockPrice } = await import('./lib/finnhub');
            try {
              const { price, priceChange } = await getStockPrice(symbol);
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

  app.patch('/api/portfolio/:id/rank', requireAuth, async (req, res) => {
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

  // Add the new refresh endpoint
  app.post('/api/refresh', requireAuth, async (req, res) => {
    try {
      // Get all portfolio items
      const portfolioItems = await storage.getPortfolioItemsWithAssets(req.user!.id);

      // Get market assets
      const assets = await storage.getAssets();
      const cryptoMarkets = assets.filter(coin => ['BTC', 'ETH'].includes(coin.symbol));
      const stockSymbols = ['SPY', 'QQQ'];

      // Get unique crypto symbols from both portfolio and markets
      const cryptoSymbols = new Set([
        ...cryptoMarkets.map(c => c.symbol),
        ...(await Promise.all(
          portfolioItems
            .filter(item => item.assetType === 'crypto')
            .map(async item => {
              const asset = await storage.getAssetById(item.assetId);
              return asset.symbol;
            })
        ))
      ]);

      // Get unique stock symbols from both portfolio and markets
      const stockSymbolSet = new Set([
        ...stockSymbols,
        ...(await Promise.all(
          portfolioItems
            .filter(item => item.assetType === 'stock')
            .map(async item => {
              const stock = await storage.getStockById(item.assetId);
              return stock.symbol;
            })
        ))
      ]);

      // Update crypto prices
      if (cryptoSymbols.size > 0) {
        const { getPrice } = await import('./lib/coinmarketcap');
        await Promise.all(
          Array.from(cryptoSymbols).map(async symbol => {
            try {
              const { price, percent_change_24h } = await getPrice(symbol);
              const asset = await storage.getAssetBySymbol(symbol);
              if (asset) {
                await storage.updateAssetPrice(asset.id, price, percent_change_24h);
              }
            } catch (error) {
              console.error(`Failed to update ${symbol} price:`, error);
            }
          })
        );
      }

      // Update stock prices
      if (stockSymbolSet.size > 0) {
        const { getStockPrice } = await import('./lib/finnhub');
        await Promise.all(
          Array.from(stockSymbolSet).map(async symbol => {
            try {
              const { price, priceChange } = await getStockPrice(symbol);
              await storage.updateStock(symbol, price, priceChange);
            } catch (error) {
              console.error(`Failed to update ${symbol} price:`, error);
            }
          })
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error refreshing data:', error);
      res.status(500).json({ message: 'Failed to refresh data' });
    }
  });

  return server;
}