
import { db } from "../db";
import { stocks } from "@shared/schema";
import fetch from "node-fetch";

async function fetchNYSEStocks() {
  try {
    if (!process.env.FINNHUB_API_KEY) {
      throw new Error('Missing FINNHUB_API_KEY');
    }

    console.log('Fetching NYSE stock symbols...');
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/symbol?mic=XNYS&token=${process.env.FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Received ${data.length} NYSE symbols from Finnhub`);

    const validStocks = data.filter((stock: any) => {
      if (!stock.symbol || !stock.description) return false;
      return !stock.symbol.includes('.') || stock.symbol.endsWith('.ETF');
    });

    console.log(`Filtered to ${validStocks.length} valid stocks`);

    let successCount = 0;
    for (const stock of validStocks) {
      try {
        await db.insert(stocks).values({
          symbol: stock.symbol,
          description: stock.description,
          c: '0',
          dp: null,
          lastUpdated: new Date()
        }).onConflictDoNothing();
        successCount++;
      } catch (error) {
        console.error(`Failed to store stock ${stock.symbol}:`, error);
      }
    }

    console.log(`Successfully stored ${successCount} new stocks in database`);
  } catch (error) {
    console.error('Failed to fetch NYSE stocks:', error);
    process.exit(1);
  }
}

fetchNYSEStocks();
