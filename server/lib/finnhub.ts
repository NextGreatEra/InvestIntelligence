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
        if (!result || !result.symbol || !result.description) return false;

        const symbol = result.symbol.toLowerCase();
        const description = result.description.toLowerCase();
        const searchQuery = query.toLowerCase().trim();

        // Only include stocks from major US exchanges (no extension in symbol)
        // Allow both stocks and ETFs (but exclude other extensions)
        if (symbol.includes('.') && !symbol.endsWith('.ETF')) return false;

        // Check for company name matches first
        if (description.includes(searchQuery)) {
          console.log(`Company name match: ${result.symbol} (${result.description})`);
          return true;
        }

        // Check for exact symbol match
        if (symbol === searchQuery) {
          console.log(`Exact symbol match: ${result.symbol}`);
          return true;
        }

        // Check if symbol starts with search query
        if (symbol.startsWith(searchQuery)) {
          console.log(`Symbol prefix match: ${result.symbol}`);
          return true;
        }

        // Check for partial symbol matches last
        if (symbol.includes(searchQuery)) {
          console.log(`Partial symbol match: ${result.symbol}`);
          return true;
        }

        return false;
      })
      .sort((a: any, b: any) => {
        // Prioritize exact matches and shorter symbols
        const aScore = a.symbol.toLowerCase() === query.toLowerCase() ? 3 :
                      a.symbol.toLowerCase().startsWith(query.toLowerCase()) ? 2 :
                      a.description.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        const bScore = b.symbol.toLowerCase() === query.toLowerCase() ? 3 :
                      b.symbol.toLowerCase().startsWith(query.toLowerCase()) ? 2 :
                      b.description.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        
        if (aScore !== bScore) return bScore - aScore;
        return a.symbol.length - b.symbol.length;
      })
      .sort((a: any, b: any) => {
        const aScore = (a.symbol.toLowerCase().includes(query.toLowerCase()) ? 2 : 0) +
                      (a.description.toLowerCase().includes(query.toLowerCase()) ? 1 : 0);
        const bScore = (b.symbol.toLowerCase().includes(query.toLowerCase()) ? 2 : 0) +
                      (b.description.toLowerCase().includes(query.toLowerCase()) ? 1 : 0);
        return bScore - aScore;
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

export async function getStockPrice(symbol: string): Promise<{ price: number; priceChange: number }> {
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

    // Calculate percentage change using current (c) and previous close (pc)
    const priceChange = ((data.c - data.pc) / data.pc) * 100;

    return {
      price: data.c,
      priceChange: priceChange
    };
  } catch (error) {
    console.error('Finnhub price error:', error);
    throw error;
  }
}