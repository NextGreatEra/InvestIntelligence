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

        // Check for exact matches to major stock symbols first
        const majorStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
        if (majorStocks.includes(symbol)) {
          console.log(`Found major stock: ${symbol}`);
          return true;
        }

        // For other stocks, use more lenient matching
        const matchesSymbol = symbol.includes(searchQuery);
        const matchesName = description.includes(searchQuery);

        // Log all potential matches for debugging
        if (matchesSymbol || matchesName) {
          console.log(`Potential match: ${symbol} (${description})`);
        }

        // Include result if it matches the search query in either symbol or name
        return !symbol.includes('.') && (matchesSymbol || matchesName);
      })
      .slice(0, 5);

    console.log(`Filtered to ${filteredResults.length} results:`, filteredResults);

    // Fetch prices for filtered results
    const resultsWithPrices = await Promise.all(
      filteredResults.map(async (result: any) => {
        try {
          console.log(`Fetching price for ${result.symbol}`);
          const quote = await fetch(
            `${FINNHUB_API}/quote?symbol=${encodeURIComponent(result.symbol)}&token=${process.env.FINNHUB_API_KEY}`
          );

          if (!quote.ok) {
            throw new Error(`Quote API error: ${quote.status}`);
          }

          const priceData = await quote.json();
          console.log(`Price data for ${result.symbol}:`, priceData);

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