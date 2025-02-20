import { pgTable, text, serial, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from 'drizzle-orm';

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  isGuest: boolean("is_guest").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  cmcId: integer("cmc_id").notNull().unique(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  cmcRank: integer("cmc_rank"),
  circulatingSupply: decimal("circulating_supply", { precision: 30, scale: 8 }),
  totalSupply: decimal("total_supply", { precision: 30, scale: 8 }),
  maxSupply: decimal("max_supply", { precision: 30, scale: 8 }),
  infiniteSupply: boolean("infinite_supply"),
  firstHistoricalData: timestamp("first_historical_data"),
  lastHistoricalData: timestamp("last_historical_data"),
  dateAdded: timestamp("date_added"),
  lastUpdated: timestamp("last_updated").notNull(),
  price: decimal("price", { precision: 30, scale: 8 }),
  volume24h: decimal("volume_24h", { precision: 30, scale: 8 }),
  volumeChange24h: decimal("volume_change_24h", { precision: 10, scale: 2 }),
  percentChange1h: decimal("percent_change_1h", { precision: 10, scale: 2 }),
  percentChange24h: decimal("percent_change_24h", { precision: 10, scale: 2 }),
  percentChange7d: decimal("percent_change_7d", { precision: 10, scale: 2 }),
  marketCap: decimal("market_cap", { precision: 30, scale: 8 }),
  marketCapDominance: decimal("market_cap_dominance", { precision: 10, scale: 2 }),
  fullyDilutedMarketCap: decimal("fully_diluted_market_cap", { precision: 30, scale: 8 })
});

export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  description: text("description").notNull(),
  c: decimal("c", { precision: 30, scale: 8 }).notNull(), // Current price
  dp: decimal("dp", { precision: 10, scale: 2 }), // Daily percent change
  lastUpdated: timestamp("last_updated").notNull().defaultNow()
});

export const portfolioItems = pgTable("portfolio_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  assetId: integer("asset_id").notNull(),
  rank: integer("rank").notNull(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  assetType: text("asset_type").notNull() // 'crypto' or 'stock'
});

// Define relationships
export const portfolioRelations = relations(portfolioItems, ({ one }) => ({
  user: one(users, {
    fields: [portfolioItems.userId],
    references: [users.id],
  }),
  asset: one(assets, {
    fields: [portfolioItems.assetId],
    references: [assets.id],
  })
}));

// Schema for inserting users
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true,
  createdAt: true 
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const insertAssetSchema = createInsertSchema(assets).omit({ 
  id: true,
  lastUpdated: true 
});

export const insertStockSchema = createInsertSchema(stocks).omit({
  id: true,
  lastUpdated: true
});

export const insertPortfolioItemSchema = createInsertSchema(portfolioItems).omit({ 
  id: true,
  lastUpdated: true
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Stock = typeof stocks.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;
export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type InsertPortfolioItem = z.infer<typeof insertPortfolioItemSchema>;