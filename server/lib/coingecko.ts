const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Add delay between requests to handle rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function searchAssets(query: string) {
  try {
    await delay(1000); // Add 1 second delay between requests
    const response = await fetch(
      `${COINGECKO_API}/search?query=${encodeURIComponent(query)}`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Portfolio Tracker' 
        } 
      }
    );

    if (response.status === 429) {
      console.log('Rate limited, retrying after delay...');
      await delay(2000);
      return searchAssets(query);
    }

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('CoinGecko search response:', data); // Debug log
    return data.coins.slice(0, 10).map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name
    }));
  } catch (error) {
    console.error('CoinGecko search error:', error);
    throw new Error('Failed to search assets');
  }
}

export async function getPrice(id: string) {
  try {
    await delay(1000); // Add 1 second delay between requests
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${id}&vs_currencies=usd`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Portfolio Tracker'
        } 
      }
    );

    if (response.status === 429) {
      console.log('Rate limited, retrying after delay...');
      await delay(2000);
      return getPrice(id);
    }

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    return data[id]?.usd;
  } catch (error) {
    console.error('CoinGecko price error:', error);
    throw new Error('Failed to fetch price');
  }
}

export async function getPriceHistory(id: string, days = 7) {
  try {
    await delay(1000); // Add 1 second delay between requests
    const response = await fetch(
      `${COINGECKO_API}/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
      { 
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Portfolio Tracker'
        } 
      }
    );

    if (response.status === 429) {
      console.log('Rate limited, retrying after delay...');
      await delay(2000);
      return getPriceHistory(id, days);
    }

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    return data.prices.map(([timestamp, price]: [number, number]) => ({
      timestamp,
      price
    }));
  } catch (error) {
    console.error('CoinGecko history error:', error);
    throw new Error('Failed to fetch price history');
  }
}