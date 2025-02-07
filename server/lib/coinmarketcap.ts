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
        'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY
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
      current_price: coin.quote.USD.price,
      price_change_percentage_24h: coin.quote.USD.percent_change_24h || 0
    }));
  } catch (error) {
    console.error('CoinMarketCap search error:', error);
    return [];
  }
}

export async function getPrice(symbol: string): Promise<{ price: number; priceChange24h: number }> {
  try {
    await enforceRateLimit();
    const response = await fetch(
      `${CMC_API}/cryptocurrency/quotes/latest?symbol=${symbol}`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`CoinMarketCap API error: ${response.status}`);
    }

    const data = await response.json();
    const coinData = data.data[symbol];
    if (!coinData?.quote?.USD) {
      throw new Error(`No price data available for ${symbol}`);
    }

    const price = coinData.quote.USD.price || 0;
    const priceChange24h = coinData.quote.USD.percent_change_24h || 0;

    // Update price in database if asset exists
    const asset = await storage.getAssetBySymbol(symbol);
    if (asset) {
      await storage.updateAssetPrice(asset.id, price);
    }

    return { price, priceChange24h };
  } catch (error) {
    console.error('CoinMarketCap price error:', error);
    throw new Error('Failed to fetch price');
  }
}