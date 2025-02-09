import { Asset, InsertAsset, Stock, InsertStock, assets, stocks } from "@shared/schema";
import { db } from "./db";
import { eq, or, ilike } from "drizzle-orm";

export interface IStorage {
  // Asset methods
  getAssets(): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  getAssetBySymbol(symbol: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAssetPrice(id: number, price: number, priceChangePercentage24h?: number | null): Promise<Asset>;
  searchAssets(query: string): Promise<Asset[]>;
  removeAsset(id: number): Promise<void>;

  // Stock methods
  getStocks(): Promise<Stock[]>;
  getStock(id: number): Promise<Stock | undefined>;
  getStockBySymbol(symbol: string): Promise<Stock | undefined>;
  createStock(stock: InsertStock): Promise<Stock>;
  updateStock(symbol: string, price: number, percentChange: number | null): Promise<Stock>;
  searchStocks(query: string): Promise<Stock[]>;
  removeStock(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Asset methods remain unchanged
  async getAssets(): Promise<Asset[]> {
    return await db.select().from(assets);
  }

  async getAsset(id: number): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset;
  }

  async getAssetBySymbol(symbol: string): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.symbol, symbol.toUpperCase()));
    return asset;
  }

  async searchAssets(query: string): Promise<Asset[]> {
    return await db.select()
      .from(assets)
      .where(
        or(
          ilike(assets.symbol, `%${query}%`),
          ilike(assets.name, `%${query}%`)
        )
      )
      .limit(5);
  }

  async createAsset(insertAsset: InsertAsset): Promise<Asset> {
    const [existingAsset] = await db.select()
      .from(assets)
      .where(eq(assets.cmcId, insertAsset.cmcId));

    if (existingAsset) {
      const [updated] = await db.update(assets)
        .set({
          ...insertAsset,
          lastUpdated: new Date()
        })
        .where(eq(assets.cmcId, insertAsset.cmcId))
        .returning();
      return updated;
    }

    const [asset] = await db.insert(assets)
      .values({ 
        ...insertAsset,
        lastUpdated: new Date() 
      })
      .returning();
    return asset;
  }

  async updateAssetPrice(id: number, price: number, priceChangePercentage24h?: number | null): Promise<Asset> {
    const [asset] = await db
      .update(assets)
      .set({
        price: price.toString(),
        percentChange24h: priceChangePercentage24h?.toString(),
        lastUpdated: new Date()
      })
      .where(eq(assets.id, id))
      .returning();
    return asset;
  }

  async removeAsset(id: number): Promise<void> {
    await db.delete(assets).where(eq(assets.id, id));
  }

  // New Stock methods
  async getStocks(): Promise<Stock[]> {
    return await db.select().from(stocks);
  }

  async getStock(id: number): Promise<Stock | undefined> {
    const [stock] = await db.select().from(stocks).where(eq(stocks.id, id));
    return stock;
  }

  async getStockBySymbol(symbol: string): Promise<Stock | undefined> {
    const [stock] = await db.select().from(stocks).where(eq(stocks.symbol, symbol.toUpperCase()));
    return stock;
  }

  async searchStocks(query: string): Promise<Stock[]> {
    return await db.select()
      .from(stocks)
      .where(
        or(
          ilike(stocks.symbol, `%${query}%`),
          ilike(stocks.description, `%${query}%`)
        )
      )
      .limit(5);
  }

  async createStock(insertStock: InsertStock): Promise<Stock> {
    const [existingStock] = await db.select()
      .from(stocks)
      .where(eq(stocks.symbol, insertStock.symbol));

    if (existingStock) {
      const [updated] = await db.update(stocks)
        .set({
          ...insertStock,
          lastUpdated: new Date()
        })
        .where(eq(stocks.symbol, insertStock.symbol))
        .returning();
      return updated;
    }

    const [stock] = await db.insert(stocks)
      .values({ 
        ...insertStock,
        lastUpdated: new Date() 
      })
      .returning();
    return stock;
  }

  async updateStock(symbol: string, price: number, percentChange: number | null): Promise<Stock> {
    const [stock] = await db
      .update(stocks)
      .set({
        c: price.toString(),
        dp: percentChange?.toString(),
        lastUpdated: new Date()
      })
      .where(eq(stocks.symbol, symbol))
      .returning();
    return stock;
  }

  async removeStock(id: number): Promise<void> {
    await db.delete(stocks).where(eq(stocks.id, id));
  }
}

export const storage = new DatabaseStorage();