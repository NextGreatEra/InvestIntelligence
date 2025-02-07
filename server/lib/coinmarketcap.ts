
const CMC_API = "https://pro-api.coinmarketcap.com/v1";
import { storage } from "../storage";

// Cache for top coins
let topCoinsCache: any[] = [];
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Add rate limiting
const REQUEST_INTERVAL = 500;
let lastRequestTime = 0;

async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

async function refreshTopCoins() {
  if (!process.env.COINMARKETCAP_API_KEY) {
    throw new Error('Missing COINMARKETCAP_API_KEY');
  }

  await enforceRateLimit();
  const response = await fetch(
    `${CMC_API}/cryptocurrency/listings/latest?limit=250`,
    {
      headers: {
        'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`CoinMarketCap API error: ${response.status}`);
  }

  const data = await response.json();
  topCoinsCache = data.data || [];
  lastCacheUpdate = Date.now();

  // Store all coins in database
  await Promise.all(topCoinsCache.map(coin => 
    storage.createAsset({
      symbol: coin.symbol,
      name: coin.name,
      type: 'crypto',
      currentPrice: coin.quote.USD.price.toString()
    }).catch(console.error)
  ));

  return topCoinsCache;
}

export async function searchAssets(query: string) {
  try {
    // Refresh cache if needed
    if (Date.now() - lastCacheUpdate > CACHE_DURATION || topCoinsCache.length === 0) {
      await refreshTopCoins();
    }

    // Search in cached data
    const searchQuery = query.toLowerCase();
    const results = topCoinsCache.filter(coin => 
      coin.name.toLowerCase().includes(searchQuery) || 
      coin.symbol.toLowerCase().includes(searchQuery)
    ).slice(0, 5);

    if (results.length === 0) return [];

    return results.map(coin => ({
      id: coin.id.toString(),
      symbol: coin.symbol,
      name: coin.name,
      current_price: coin.quote.USD.price
    }));
  } catch (error) {
    console.error('CoinMarketCap search error:', error);
    return [];
  }
}

export async function getPrice(symbol: string): Promise<number> {
  try {
    // First check our database
    const asset = await storage.getAssetBySymbol(symbol);
    if (asset) {
      const lastUpdate = new Date(asset.lastUpdated);
      const now = new Date();
      // If price is less than 5 minutes old, use it
      if (now.getTime() - lastUpdate.getTime() < 5 * 60 * 1000) {
        return Number(asset.currentPrice);
      }
    }

    // Check cache first
    if (Date.now() - lastCacheUpdate <= CACHE_DURATION) {
      const coin = topCoinsCache.find(c => c.symbol === symbol);
      if (coin) {
        return coin.quote.USD.price;
      }
    }

    // Fallback to direct API call
    await enforceRateLimit();
    const response = await fetch(
      `${CMC_API}/cryptocurrency/quotes/latest?symbol=${symbol}`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`CoinMarketCap API error: ${response.status}`);
    }

    const data = await response.json();
    const price = data.data[symbol]?.quote?.USD?.price || 0;

    // Update price in database
    if (asset) {
      await storage.updateAssetPrice(asset.id, price);
    }

    return price;
  } catch (error) {
    console.error('CoinMarketCap price error:', error);
    throw new Error('Failed to fetch price');
  }
}
