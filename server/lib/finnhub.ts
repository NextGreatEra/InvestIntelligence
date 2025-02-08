import { Asset, InsertAsset } from '../../shared/schema';

const FINNHUB_API = "https://finnhub.io/api/v1";

export async function searchStocks(query: string): Promise<Partial<InsertAsset>[]> {
  try {
    if (!process.env.FINNHUB_API_KEY) {
      throw new Error('Missing FINNHUB_API_KEY');
    }

    console.log(`Searching stocks with query: ${query}`);
    const response = await fetch(
      `${FINNHUB_API}/search?q=${encodeURIComponent(query)}&token=${process.env.FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Raw search results:', data.result?.length || 0, 'items');

    // Handle empty results
    if (!data.result || !Array.isArray(data.result)) {
      console.log('No results found');
      return [];
    }

    const filteredResults = data.result
      .filter((result: any) => {
        if (!result) return false;

        // Basic data validation
        if (!result.symbol || !result.description) {
          console.log('Filtered out: Missing symbol or description');
          return false;
        }

        const symbol = result.symbol.toUpperCase();
        const description = result.description.toUpperCase();
        const searchQuery = query.toUpperCase();
        const type = (result.type || '').toUpperCase();

        // Check for special cases first (known major stocks)
        const majorStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
        if (majorStocks.includes(symbol)) {
          return true;
        }

        // More permissive type checking
        const validTypes = ['STOCK', 'COMMON', 'EQS', 'ETF', 'ADR'];
        const isValidType = validTypes.some(t => type.includes(t)) || type === '';

        // More lenient search matching
        const matchesSymbol = symbol.includes(searchQuery);
        const matchesName = description.includes(searchQuery);

        const shouldInclude = 
          isValidType && 
          !symbol.includes('.') && 
          (matchesSymbol || matchesName);

        if (!shouldInclude) {
          console.log(`Filtered out ${symbol}: type=${type}, matches=${matchesSymbol || matchesName}`);
        }

        return shouldInclude;
      })
      .slice(0, 5);

    console.log(`Filtered to ${filteredResults.length} results`);

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

          if (typeof priceData.c !== 'number' || isNaN(priceData.c)) {
            console.log(`Invalid price data for ${result.symbol}:`, priceData);
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

    const validResults = resultsWithPrices.filter((result): result is Partial<InsertAsset> => result !== null);
    console.log(`Final results with prices:`, validResults);
    return validResults;
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