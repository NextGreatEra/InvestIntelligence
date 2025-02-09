import { storage } from "../storage";
import fetch from 'node-fetch';

const CMC_API = "https://pro-api.coinmarketcap.com/v1";

export async function initializeCryptoAssets() {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) {
    throw new Error('Missing COINMARKETCAP_API_KEY');
  }

  // First fetch the cryptocurrency map
  console.log('Fetching cryptocurrency map...');
  const mapResponse = await fetch(
    `${CMC_API}/cryptocurrency/map`,
    {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
      },
    }
  );

  if (!mapResponse.ok) {
    throw new Error(`CoinMarketCap API error: ${mapResponse.statusText}`);
  }

  const mapData = await mapResponse.json();
  const cryptoMap = new Map(mapData.data.map((coin: any) => [coin.id, {
    cmcId: coin.id,
    name: coin.name,
    symbol: coin.symbol,
    firstHistoricalData: coin.first_historical_data,
    lastHistoricalData: coin.last_historical_data
  }]));

  // Then fetch the latest listings
  console.log('Fetching latest cryptocurrency data...');
  const listingsResponse = await fetch(
    `${CMC_API}/cryptocurrency/listings/latest?limit=200`,
    {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
      },
    }
  );

  if (!listingsResponse.ok) {
    throw new Error(`CoinMarketCap API error: ${listingsResponse.statusText}`);
  }

  const listingsData = await listingsResponse.json();

  // Process and store the data
  console.log('Processing and storing cryptocurrency data...');
  for (const coin of listingsData.data) {
    const mapInfo = cryptoMap.get(coin.id);
    if (!mapInfo) continue;

    await storage.createAsset({
      cmcId: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      cmcRank: coin.cmc_rank,
      circulatingSupply: coin.circulating_supply?.toString(),
      totalSupply: coin.total_supply?.toString(),
      maxSupply: coin.max_supply?.toString(),
      infiniteSupply: coin.infinite_supply,
      firstHistoricalData: new Date(mapInfo.firstHistoricalData),
      lastHistoricalData: new Date(mapInfo.lastHistoricalData),
      dateAdded: new Date(coin.date_added),
      lastUpdated: new Date(coin.last_updated),
      price: coin.quote.USD.price.toString(),
      volume24h: coin.quote.USD.volume_24h.toString(),
      volumeChange24h: coin.quote.USD.volume_change_24h?.toString(),
      percentChange1h: coin.quote.USD.percent_change_1h?.toString(),
      percentChange24h: coin.quote.USD.percent_change_24h?.toString(),
      percentChange7d: coin.quote.USD.percent_change_7d?.toString(),
      marketCap: coin.quote.USD.market_cap.toString(),
      marketCapDominance: coin.quote.USD.market_cap_dominance?.toString(),
      fullyDilutedMarketCap: coin.quote.USD.fully_diluted_market_cap?.toString()
    });
  }

  console.log('Database initialization complete');
}

export async function refreshTopCoins() {
  await initializeCryptoAssets();
  return storage.getAllAssets();
}

export async function searchAssets(query: string) {
  console.log(`Searching assets with query: ${query}`);

  try {
    const allAssets = await refreshTopCoins(); // Use the new refreshTopCoins
    console.log(`Searching in cache of ${allAssets.length} coins`);
    const results = allAssets
      .filter(coin =>
        coin.name.toLowerCase().includes(query.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 5)
      .map(coin => ({
        id: coin.id.toString(),
        symbol: coin.symbol,
        name: coin.name,
        current_price: parseFloat(coin.price) // Assuming price is stored as a string
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

export async function getPrice(symbol: string): Promise<number | {price: number, percent_change_24h: number | null}> {
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
        return Number(asset.price); //Assuming price is stored as a string
      }
    }


    // Fallback to direct API call (removed cache check as it's now handled in initializeCryptoAssets)
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
    const priceChange = usdData.percent_change_24h || null;

    // Update price and price change in database
    if (asset) {
      await storage.updateAssetPrice(asset.id, price, priceChange);
    }

    return {
      price: Number(price),
      percent_change_24h: priceChange ? Number(priceChange) : null
    };
  } catch (error) {
    console.error('CoinMarketCap price error:', error);
    throw new Error('Failed to fetch price');
  }
}

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