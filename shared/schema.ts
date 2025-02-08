import { pgTable, text, serial, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  currentPrice: decimal("current_price").notNull(),
  price_change_percentage_24h: decimal("price_change_percentage_24h"),
  lastUpdated: timestamp("last_updated").notNull()
});

export const portfolioItems = pgTable("portfolio_items", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  rank: integer("rank").notNull(),
  allocation: decimal("allocation", { precision: 10, scale: 2 }).notNull().default("0"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow()
});

export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  price: decimal("price").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow()
});

export const insertAssetSchema = createInsertSchema(assets)
  .extend({
    type: z.enum(["stock", "crypto"]),
    currentPrice: z.union([z.string(), z.number()]).transform(val => 
      typeof val === 'string' ? val : val.toString()
    )
  })
  .omit({ 
    id: true, 
    lastUpdated: true 
  });

export const insertPortfolioItemSchema = createInsertSchema(portfolioItems)
  .omit({ 
    id: true,
    lastUpdated: true,
    allocation: true
  });

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
  timestamp: true
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type InsertPortfolioItem = z.infer<typeof insertPortfolioItemSchema>;
export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;