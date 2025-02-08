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

    const filteredResults = (data.result || [])
      .filter((result: any) => {
        // Get uppercase versions for case-insensitive comparison
        const type = result.type?.toUpperCase() || '';
        const symbol = result.symbol || '';
        const description = result.description || '';
        const searchQuery = query.toUpperCase();

        // Accept common stock types and ADRs
        const validTypes = ['STOCK', 'EQS', 'ADR'];
        const isValidType = validTypes.some(t => type.includes(t));

        // Check if it's a valid stock and matches either symbol or company name
        return isValidType && 
               symbol && 
               description &&
               !symbol.includes('.') && // Exclude non-standard symbols
               (symbol.toUpperCase().includes(searchQuery) || 
                description.toUpperCase().includes(searchQuery));
      })
      .slice(0, 5);

    if (filteredResults.length === 0) {
      return [];
    }

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

          if (typeof priceData.c !== 'number' || isNaN(priceData.c)) {
            console.error(`Invalid price data for ${result.symbol}:`, priceData);
            return null;
          }

          return {
            symbol: result.symbol,
            name: result.description,
            type: 'stock',
            current_price: priceData.c
          };
        } catch (error) {
          console.error(`Failed to fetch price for ${result.symbol}:`, error);
          return null;
        }
      })
    );

    return resultsWithPrices.filter((result): result is Partial<InsertAsset> => result !== null);
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

    if (typeof data.c !== 'number' || isNaN(data.c)) {
      throw new Error(`Invalid price data for ${symbol}`);
    }

    return data.c;
  } catch (error) {
    console.error('Finnhub price error:', error);
    throw error;
  }
}