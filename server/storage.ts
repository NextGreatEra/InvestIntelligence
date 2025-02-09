import { Asset, InsertAsset, assets } from "@shared/schema";
import { db } from "./db";
import { eq, or, ilike } from "drizzle-orm";

export interface IStorage {
  getAssets(): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  getAssetBySymbol(symbol: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAssetPrice(id: number, price: number, priceChangePercentage24h?: number | null): Promise<Asset>;
  searchAssets(query: string): Promise<Asset[]>;
  removeAsset(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
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
}

export const storage = new DatabaseStorage();