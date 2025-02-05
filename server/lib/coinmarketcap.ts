const CMC_API = "https://pro-api.coinmarketcap.com/v1";
import { storage } from "../storage";

interface CMCQuote {
  price: number;
  volume_24h: number;
  market_cap: number;
  percent_change_24h: number;
}

interface CMCData {
  id: number;
  name: string;
  symbol: string;
  quote: {
    USD: CMCQuote;
  };
}

// Add rate limiting
const REQUEST_INTERVAL = 500; // 500ms between requests
let lastRequestTime = 0;

async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

// Validate API key
function validateApiKey() {
  if (!process.env.COINMARKETCAP_API_KEY) {
    throw new Error("COINMARKETCAP_API_KEY is not set");
  }
}

export async function searchAssets(query: string) {
  try {
    validateApiKey();

    // First search in our database
    const localAssets = await storage.searchAssets(query);
    if (localAssets.length > 0) {
      console.log(`Found ${localAssets.length} assets in local database`);
      return localAssets.map(asset => ({
        id: asset.id.toString(),
        symbol: asset.symbol.toUpperCase(),
        name: asset.name,
        current_price: Number(asset.currentPrice)
      }));
    }

    // If not found locally, search via CoinMarketCap
    await enforceRateLimit();
    
    // Add search query to filter
    const searchQuery = query.toLowerCase();
    const response = await fetch(
      `${CMC_API}/cryptocurrency/listings/latest?limit=20&sort=market_cap&sort_dir=desc`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('CoinMarketCap API error:', errorData);
      throw new Error(`CoinMarketCap API error: ${response.status} - ${errorData.status?.error_message || 'Unknown error'}`);
    }

    const data = await response.json();
    const allAssets = data.data || [];
    const assets = allAssets.filter(asset => 
      asset.symbol.toLowerCase().includes(searchQuery) || 
      asset.name.toLowerCase().includes(searchQuery)
    ).slice(0, 5);

    // Store results in database for future use
    const results = await Promise.all(assets.map(async (asset: CMCData) => {
      const price = asset.quote.USD.price;
      try {
        // Store in database
        await storage.createAsset({
          symbol: asset.symbol,
          name: asset.name,
          type: 'crypto',
          currentPrice: price.toString()
        });
      } catch (error) {
        console.error('Failed to store asset:', error);
      }

      return {
        id: asset.id.toString(),
        symbol: asset.symbol,
        name: asset.name,
        current_price: price
      };
    }));

    return results;
  } catch (error) {
    console.error('CoinMarketCap search error:', error);
    throw new Error('Failed to search assets');
  }
}

export async function getPrice(symbol: string): Promise<number> {
  try {
    validateApiKey();

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

    // Otherwise fetch from API
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
      const errorData = await response.json();
      console.error('CoinMarketCap API error:', errorData);
      throw new Error(`CoinMarketCap API error: ${response.status} - ${errorData.status?.error_message || 'Unknown error'}`);
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