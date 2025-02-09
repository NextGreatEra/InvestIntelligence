
import { db } from "../db";
import { stocks } from "@shared/schema";

// Parse the NYSE and NASDAQ data
const nyseStocks = [
  { symbol: "LND", description: "BRASILAGRO-CIA BRA - SPN ADR" },
  { symbol: "OMI", description: "OWENS & MINOR INC" },
  { symbol: "HGTY", description: "HAGERTY INC-A" },
  { symbol: "BKN", description: "BLACKROCK INVEST QLTY MUNI" },
  { symbol: "BRO", description: "BROWN & BROWN INC" }
];

const nasdaqStocks = [
  { symbol: "CAAS", description: "CHINA AUTOMOTIVE SYSTEMS INC" },
  { symbol: "DYNX", description: "DYNAMIX CORP" },
  { symbol: "HFBL", description: "HOME FEDERAL BANCORP INC/LA" },
  { symbol: "TWNP", description: "TWIN HOSPITALITY GRP INC" },
  { symbol: "PFES", description: "AXS 2X PFE Bear Daily ETF" }
];

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
