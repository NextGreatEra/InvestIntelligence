import { db } from "../db";
import { stocks } from "@shared/schema";
import XNYS from "../../attached_assets/XNYS.json";
import XNAS from "../../attached_assets/XNAS.json";

async function importStocks() {
  try {
    // Combine both exchange data
    const allStocks = [...XNYS, ...XNAS].map(stock => ({
      symbol: stock.symbol,
      description: stock.description,
      c: "0", // Initial price as string for decimal column
      dp: "0", // Initial daily percent change as string for decimal column
    }));

    console.log(`Importing ${allStocks.length} stocks...`);

    // Insert stocks in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < allStocks.length; i += batchSize) {
      const batch = allStocks.slice(i, i + batchSize);
      await db.insert(stocks).values(batch)
        .onConflictDoNothing({ target: stocks.symbol });
      console.log(`Imported batch ${Math.floor(i / batchSize) + 1}`);
    }

    console.log('Stock import completed successfully');
  } catch (error) {
    console.error('Error importing stocks:', error);
  }
}

// Run the import
importStocks().then(() => process.exit(0)).catch((error) => {
  console.error('Failed to import stocks:', error);
  process.exit(1);
});