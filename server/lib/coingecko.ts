const COINGECKO_API = "https://api.coingecko.com/api/v3";

export async function searchAssets(query: string) {
  try {
    const response = await fetch(
      `${COINGECKO_API}/search?query=${encodeURIComponent(query)}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
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
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${id}&vs_currencies=usd`,
      { headers: { 'Accept': 'application/json' } }
    );

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
    const response = await fetch(
      `${COINGECKO_API}/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
      { headers: { 'Accept': 'application/json' } }
    );

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