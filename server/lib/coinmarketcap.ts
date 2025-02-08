import { storage } from "../storage";

const CMC_API = "https://pro-api.coinmarketcap.com/v1";

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
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) {
    console.error('Missing COINMARKETCAP_API_KEY');
    throw new Error('Missing COINMARKETCAP_API_KEY');
  }

  await enforceRateLimit();

  try {
    console.log('Fetching top coins from CoinMarketCap...');
    const response = await fetch(
      `${CMC_API}/cryptocurrency/listings/latest?limit=250`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': apiKey,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`CoinMarketCap API error: ${response.status}`, errorText);
      throw new Error(`CoinMarketCap API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) {
      console.error('Invalid response format from CoinMarketCap:', data);
      throw new Error('Invalid response format from CoinMarketCap');
    }

    console.log(`Successfully fetched ${data.data.length} coins`);
    topCoinsCache = data.data;
    lastCacheUpdate = Date.now();

    // Store all coins in database
    await Promise.all(topCoinsCache.map(coin => 
      storage.createAsset({
        symbol: coin.symbol,
        name: coin.name,
        type: 'crypto',
        currentPrice: coin.quote.USD.price.toString()
      }).catch(error => console.error(`Failed to store coin ${coin.symbol}:`, error))
    ));

    return topCoinsCache;
  } catch (error) {
    console.error('Failed to refresh top coins:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch coins: ${error.message}`);
    }
    throw error;
  }
}

export async function searchAssets(query: string) {
  if (!query) {
    console.log('Empty search query, returning empty results');
    return [];
  }

  try {
    console.log('Searching assets with query:', query);

    // Check if cache needs refresh
    const now = Date.now();
    if (now - lastCacheUpdate > CACHE_DURATION || topCoinsCache.length === 0) {
      console.log('Cache expired or empty, refreshing...');
      await refreshTopCoins();
    }

    // Search in cached data
    const searchQuery = query.toLowerCase();
    console.log('Searching in cache of', topCoinsCache.length, 'coins');

    const results = topCoinsCache
      .filter(coin => 
        coin.name.toLowerCase().includes(searchQuery) || 
        coin.symbol.toLowerCase().includes(searchQuery)
      )
      .slice(0, 5)
      .map(coin => ({
        id: coin.id.toString(),
        symbol: coin.symbol,
        name: coin.name,
        current_price: coin.quote.USD.price
      }));

    console.log(`Found ${results.length} results for query "${query}"`);
    return results;
  } catch (error) {
    console.error('Asset search error:', error);
    // Return empty results instead of throwing to prevent UI disruption
    return [];
  }
}

interface PriceData {
  price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
}

export async function getPrice(symbol: string): Promise<number> {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) {
    console.error('Missing COINMARKETCAP_API_KEY');
    throw new Error('Missing COINMARKETCAP_API_KEY');
  }

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
          'X-CMC_PRO_API_KEY': apiKey,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`CoinMarketCap API error: ${response.status}`, errorText);
      throw new Error(`CoinMarketCap API error: ${response.status}`);
    }

    const data = await response.json();
    const usdData = data.data[symbol]?.quote?.USD;
    if (!usdData) {
      console.error(`No USD data found for ${symbol}:`, data);
      throw new Error(`No USD data found for ${symbol}`);
    }

    const price = usdData.price || 0;

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