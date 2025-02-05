import { Asset, InsertAsset, PortfolioItem, InsertPortfolioItem } from "@shared/schema";
import { assets, portfolioItems } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getAssets(): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  getAssetBySymbol(symbol: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAssetPrice(id: number, price: number): Promise<Asset>;

  getPortfolioItems(): Promise<PortfolioItem[]>;
  getPortfolioItem(id: number): Promise<PortfolioItem | undefined>;
  createPortfolioItem(item: InsertPortfolioItem): Promise<PortfolioItem>;
  updatePortfolioItem(id: number, quantity: number): Promise<PortfolioItem>;
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
    const [asset] = await db.select().from(assets)
      .where(eq(assets.symbol, symbol.toUpperCase()));
    return asset;
  }

  async createAsset(insertAsset: InsertAsset): Promise<Asset> {
    const [asset] = await db.insert(assets)
      .values({ ...insertAsset, lastUpdated: new Date() })
      .returning();
    return asset;
  }

  async updateAssetPrice(id: number, price: number): Promise<Asset> {
    const [asset] = await db.update(assets)
      .set({ currentPrice: price.toString(), lastUpdated: new Date() })
      .where(eq(assets.id, id))
      .returning();
    if (!asset) throw new Error("Asset not found");
    return asset;
  }

  async getPortfolioItems(): Promise<PortfolioItem[]> {
    return await db.select().from(portfolioItems);
  }

  async getPortfolioItem(id: number): Promise<PortfolioItem | undefined> {
    const [item] = await db.select().from(portfolioItems)
      .where(eq(portfolioItems.id, id));
    return item;
  }

  async createPortfolioItem(insertItem: InsertPortfolioItem): Promise<PortfolioItem> {
    const [item] = await db.insert(portfolioItems)
      .values(insertItem)
      .returning();
    return item;
  }

  async updatePortfolioItem(id: number, quantity: number): Promise<PortfolioItem> {
    const [item] = await db.update(portfolioItems)
      .set({ quantity: quantity.toString() })
      .where(eq(portfolioItems.id, id))
      .returning();
    if (!item) throw new Error("Portfolio item not found");
    return item;
  }
}

export const storage = new DatabaseStorage();