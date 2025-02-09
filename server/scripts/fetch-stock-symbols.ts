
import { db } from "../db";
import { stocks } from "@shared/schema";
import fetch from "node-fetch";

async function fetchAndStoreStocks() {
  try {
    if (!process.env.FINNHUB_API_KEY) {
      throw new Error('Missing FINNHUB_API_KEY');
    }

    // Fetch from both exchanges
    const [nyseResponse, nasdaqResponse] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/symbol?mic=XNYS&token=${process.env.FINNHUB_API_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/symbol?mic=XNAS&token=${process.env.FINNHUB_API_KEY}`)
    ]);

    if (!nyseResponse.ok || !nasdaqResponse.ok) {
      throw new Error('Failed to fetch stock data');
    }

    const nyseData = await nyseResponse.json();
    const nasdaqData = await nasdaqResponse.json();

    console.log(`Fetched ${nyseData.length} NYSE and ${nasdaqData.length} NASDAQ stocks`);

    // Combine and filter stocks
    const allStocks = [...nyseData, ...nasdaqData]
      .filter(stock => {
        if (!stock.symbol || !stock.description) return false;
        // Only include regular stocks and ETFs
        return !stock.symbol.includes('.') || stock.symbol.endsWith('.ETF');
      })
      .map(stock => ({
        symbol: stock.symbol,
        description: stock.description,
        c: '0',
        dp: null,
        lastUpdated: new Date()
      }));

    // Insert in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < allStocks.length; i += batchSize) {
      const batch = allStocks.slice(i, i + batchSize);
      await db.insert(stocks)
        .values(batch)
        .onConflictDoNothing();
      
      inserted += batch.length;
      console.log(`Processed ${inserted}/${allStocks.length} stocks...`);
    }

    console.log('Stock import completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchAndStoreStocks();
