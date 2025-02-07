
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
    
    // Filter for US stocks only to improve price fetch reliability
    const filteredResults = (data.result || [])
      .filter((result: any) => {
        const type = result.type?.toUpperCase() || '';
        const symbol = result.symbol || '';
        // Only include US stocks (no foreign exchanges)
        return (type.includes('STOCK') || type === 'EQS') && 
               result.symbol && 
               result.description &&
               !symbol.includes('.') // Exclude foreign exchange symbols
      })
      .slice(0, 5);

    if (filteredResults.length === 0) {
      return [];
    }

    // Fetch prices for filtered results
    const resultsWithPrices = await Promise.all(
      filteredResults.map(async (result: any) => {
        try {
          const quote = await fetch(
            `${FINNHUB_API}/quote?symbol=${encodeURIComponent(result.symbol)}&token=${process.env.FINNHUB_API_KEY}`
          );
          
          if (!quote.ok) {
            throw new Error(`Quote API error: ${quote.status}`);
          }
          
          const priceData = await quote.json();
          const price = priceData.c; // Current price
          
          if (!price) {
            return null;
          }
          
          return {
            symbol: result.symbol,
            name: result.description,
            type: 'stock',
            currentPrice: price.toString()
          };
        } catch (error) {
          console.error(`Failed to fetch price for ${result.symbol}:`, error);
          return null;
        }
      })
    );

    return resultsWithPrices.filter(result => result !== null);
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
    const price = data.c || 0; // Current price
    
    if (!price) {
      throw new Error(`No price available for ${symbol}`);
    }
    
    return price;
  } catch (error) {
    console.error('Finnhub price error:', error);
    throw error;
  }
}
