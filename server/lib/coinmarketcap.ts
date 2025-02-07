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

export async function searchAssets(query: string) {
  if (!process.env.COINMARKETCAP_API_KEY) {
    console.error('Missing COINMARKETCAP_API_KEY');
    return [];
  }

  try {
    await enforceRateLimit();

    // Search using CoinMarketCap's search endpoint
    const response = await fetch(
      `${CMC_API}/cryptocurrency/search?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY!,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('CoinMarketCap API error:', response.status);
      return [];
    }

    const searchData = await response.json();
    if (!searchData.data || !Array.isArray(searchData.data.cryptocurrencies)) {
      console.error('Invalid response format from CoinMarketCap');
      return [];
    }

    // Get top 5 results
    const topResults = searchData.data.cryptocurrencies.slice(0, 5);
    if (topResults.length === 0) return [];

    // Get latest quotes for these cryptocurrencies
    const symbols = topResults.map(crypto => crypto.symbol).join(',');
    await enforceRateLimit();

    const quotesResponse = await fetch(
      `${CMC_API}/cryptocurrency/quotes/latest?symbol=${symbols}`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY!,
          'Accept': 'application/json'
        }
      }
    );

    if (!quotesResponse.ok) {
      console.error('CoinMarketCap quotes API error:', quotesResponse.status);
      return [];
    }

    const quotesData = await quotesResponse.json();

    // Map results with their current prices
    const results = topResults.map(crypto => {
      const quote = quotesData.data[crypto.symbol]?.quote?.USD;
      const price = quote?.price || 0;

      // Store in database for future reference
      storage.createAsset({
        symbol: crypto.symbol,
        name: crypto.name,
        type: 'crypto',
        currentPrice: price.toString()
      }).catch(error => {
        console.error('Failed to store asset:', error);
      });

      return {
        id: crypto.id.toString(),
        symbol: crypto.symbol,
        name: crypto.name,
        current_price: price
      };
    });

    return results;
  } catch (error) {
    console.error('CoinMarketCap API error:', error);
    return [];
  }
}

export async function getPrice(symbol: string): Promise<number> {
  try {
    if (!process.env.COINMARKETCAP_API_KEY) {
      throw new Error("COINMARKETCAP_API_KEY is not set");
    }

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