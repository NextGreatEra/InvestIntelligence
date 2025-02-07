
import { Asset, InsertAsset } from '../../shared/schema';

const FINNHUB_API = "https://finnhub.io/api/v1";

export async function searchStocks(query: string): Promise<Partial<InsertAsset>[]> {
  try {
    if (!process.env.FINNHUB_API_KEY) {
      throw new Error('Missing FINNHUB_API_KEY');
    }

    const response = await fetch(
      `${FINNHUB_API}/search?q=${encodeURIComponent(query)}&token=${process.env.FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter for NYSE and NASDAQ stocks only
    const filteredResults = (data.result || [])
      .filter((result: any) => {
        const exchange = result.type?.toUpperCase();
        return exchange === 'NYSE' || exchange === 'NASDAQ';
      })
      .slice(0, 5);

    // Fetch prices for filtered results
    const resultsWithPrices = await Promise.all(
      filteredResults.map(async (result: any) => {
        const price = await getStockPrice(result.symbol);
        return {
          symbol: result.symbol,
          name: result.description,
          type: 'stock',
          currentPrice: price.toString()
        };
      })
    );

    return resultsWithPrices;
  } catch (error) {
    console.error('Finnhub search error:', error);
    return [];
  }
}

export async function getStockPrice(symbol: string): Promise<number> {
  try {
    if (!process.env.FINNHUB_API_KEY) {
      throw new Error('Missing FINNHUB_API_KEY');
    }

    const response = await fetch(
      `${FINNHUB_API}/quote?symbol=${encodeURIComponent(symbol)}&token=${process.env.FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    return data.c || 0; // Current price
  } catch (error) {
    console.error('Finnhub price error:', error);
    throw new Error('Failed to fetch price');
  }
}
