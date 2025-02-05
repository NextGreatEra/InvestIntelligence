import { pgTable, text, serial, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'stock' or 'crypto'
  currentPrice: decimal("current_price").notNull(),
  lastUpdated: timestamp("last_updated").notNull()
});

export const portfolioItems = pgTable("portfolio_items", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  quantity: decimal("quantity").notNull(),
  averagePrice: decimal("average_price").notNull()
});

export const insertAssetSchema = createInsertSchema(assets).omit({ 
  id: true, 
  lastUpdated: true 
});

export const insertPortfolioItemSchema = createInsertSchema(portfolioItems).omit({ 
  id: true 
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type InsertPortfolioItem = z.infer<typeof insertPortfolioItemSchema>;

export interface AssetWithDetails extends Asset {
  holdings: number;
  value: number;
  profitLoss: number;
}
