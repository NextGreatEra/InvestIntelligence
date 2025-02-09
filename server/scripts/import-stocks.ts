
import { db } from "../db";
import { stocks } from "@shared/schema";

// Read and parse the stock data
const nyseStocks = [/* XNYS data */];
const nasdaqStocks = [/* XNAS data */];

async function importStocks() {
  try {
    console.log('Starting stock import process...');
    
    // Combine NYSE and NASDAQ stocks
    const allStocks = [...nyseStocks, ...nasdaqStocks]
      .filter(stock => {
        // Filter out any items without symbol or description
        if (!stock.symbol || !stock.description) return false;
        // Exclude preferred stocks, warrants, units, and other non-common stocks
        return !stock.symbol.includes('.') && 
               !stock.symbol.includes('-') &&
               !stock.symbol.endsWith('W') &&
               !stock.symbol.endsWith('U');
      })
      .map(stock => ({
        symbol: stock.symbol,
        description: stock.description,
        c: '0', // Initialize price as 0
        dp: null, // Initialize price change as null
        lastUpdated: new Date()
      }));

    console.log(`Processing ${allStocks.length} filtered stocks...`);

    // Insert stocks in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < allStocks.length; i += batchSize) {
      const batch = allStocks.slice(i, i + batchSize);
      await db.insert(stocks)
        .values(batch)
        .onConflictDoNothing();
      
      console.log(`Processed batch ${Math.floor(i/batchSize) + 1}...`);
    }

    console.log('Stock import completed successfully');
  } catch (error) {
    console.error('Error importing stocks:', error);
    throw error;
  }
}

// Run the import
importStocks()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
