const COINGECKO_API = "https://api.coingecko.com/api/v3";

export async function searchAssets(query: string) {
  const response = await fetch(
    `${COINGECKO_API}/search?query=${encodeURIComponent(query)}`
  );
  if (!response.ok) throw new Error("Failed to search assets");
  const data = await response.json();
  return data.coins.slice(0, 10);
}

export async function getPrice(id: string) {
  const response = await fetch(
    `${COINGECKO_API}/simple/price?ids=${id}&vs_currencies=usd`
  );
  if (!response.ok) throw new Error("Failed to fetch price");
  const data = await response.json();
  return data[id]?.usd;
}

export async function getPriceHistory(id: string, days = 7) {
  const response = await fetch(
    `${COINGECKO_API}/coins/${id}/market_chart?vs_currency=usd&days=${days}`
  );
  if (!response.ok) throw new Error("Failed to fetch price history");
  const data = await response.json();
  return data.prices.map(([timestamp, price]: [number, number]) => ({
    timestamp,
    price
  }));
}
