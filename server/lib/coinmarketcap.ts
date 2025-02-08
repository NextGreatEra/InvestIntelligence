import { storage } from "../storage";
import fetch from 'node-fetch';

const CMC_API = "https://pro-api.coinmarketcap.com/v1";

let cachedCoins: any[] = [];
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

async function refreshCache() {
  console.log('Fetching top coins from CoinMarketCap...');
  try {
    const response = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=250',
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY || '',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinMarketCap API error: ${response.statusText}`);
    }

    const data = await response.json();
    cachedCoins = data.data;
    lastCacheUpdate = Date.now();
    console.log(`Successfully fetched ${cachedCoins.length} coins`);
  } catch (error) {
    console.error('Error fetching from CoinMarketCap:', error);
    throw new Error('Failed to fetch cryptocurrency data');
  }
}

export async function refreshTopCoins() {
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
    cachedCoins = data.data; //Use cachedCoins instead of topCoinsCache
    lastCacheUpdate = Date.now();

    // Store all coins in database
    await Promise.all(cachedCoins.map(coin =>
      storage.createAsset({
        symbol: coin.symbol,
        name: coin.name,
        type: 'crypto',
        currentPrice: coin.quote.USD.price.toString()
      }).catch(error => console.error(`Failed to store coin ${coin.symbol}:`, error))
    ));

    return cachedCoins;
  } catch (error) {
    console.error('Failed to refresh top coins:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch coins: ${error.message}`);
    }
    throw error;
  }
}


export async function searchAssets(query: string) {
  console.log(`Searching assets with query: ${query}`);

  try {
    if (Date.now() - lastCacheUpdate > CACHE_DURATION || cachedCoins.length === 0) {
      console.log('Cache expired or empty, refreshing...');
      await refreshCache();
    }

    console.log(`Searching in cache of ${cachedCoins.length} coins`);
    const results = cachedCoins
      .filter(coin =>
        coin.name.toLowerCase().includes(query.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(query.toLowerCase())
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
    console.error('Search error:', error);
    throw new Error('Failed to search assets');
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
      const coin = cachedCoins.find(c => c.symbol === symbol);
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
    const priceChange = usdData.percent_change_24h || 0;

    // Update price and price change in database
    if (asset) {
      await storage.updateAssetPrice(asset.id, price, priceChange);
    }

    return price;
  } catch (error) {
    console.error('CoinMarketCap price error:', error);
    throw new Error('Failed to fetch price');
  }
}