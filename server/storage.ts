import { Asset, InsertAsset, PortfolioItem, InsertPortfolioItem, assets, portfolioItems } from "@shared/schema";
import { db } from "./db";
import { eq, or, ilike, and, lte, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  getAssets(): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  getAssetBySymbol(symbol: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAssetPrice(id: number, price: number, priceChangePercentage24h?: number | null): Promise<Asset>;
  searchAssets(query: string): Promise<Asset[]>;
  removeAsset(id: number): Promise<void>;

  getPortfolioItems(): Promise<PortfolioItem[]>;
  getPortfolioItemsWithAssets(): Promise<(PortfolioItem & { asset: Asset })[]>;
  getPortfolioItem(id: number): Promise<PortfolioItem | undefined>;
  createPortfolioItem(item: InsertPortfolioItem): Promise<PortfolioItem>;
  updatePortfolioRank(id: number, newRank: number): Promise<PortfolioItem>;
  removePortfolioItem(id: number): Promise<void>;
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

  async getPortfolioItems(): Promise<PortfolioItem[]> {
    return await db.select()
      .from(portfolioItems)
      .orderBy(asc(portfolioItems.rank));
  }

  async getPortfolioItemsWithAssets(): Promise<(PortfolioItem & { asset: Asset })[]> {
    const result = await db.select({
      ...portfolioItems,
      asset: assets
    })
    .from(portfolioItems)
    .leftJoin(assets, eq(portfolioItems.assetId, assets.id))
    .orderBy(asc(portfolioItems.rank));

    return result.map(item => ({
      ...item,
      asset: item.asset
    }));
  }

  async getPortfolioItem(id: number): Promise<PortfolioItem | undefined> {
    const [item] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id));
    return item;
  }

  async createPortfolioItem(insertItem: InsertPortfolioItem): Promise<PortfolioItem> {
    const result = await db.select({
      maxRank: sql<number>`COALESCE(MAX(rank), 0)`
    }).from(portfolioItems);

    const newRank = (result[0]?.maxRank || 0) + 1;

    const [item] = await db.insert(portfolioItems)
      .values({
        ...insertItem,
        rank: newRank,
        allocation: "0",
        lastUpdated: new Date()
      })
      .returning();

    return item;
  }

  async updatePortfolioRank(id: number, newRank: number): Promise<PortfolioItem> {
    const [item] = await db.update(portfolioItems)
      .set({ rank: newRank, lastUpdated: new Date() })
      .where(eq(portfolioItems.id, id))
      .returning();
    if (!item) throw new Error("Portfolio item not found");
    return item;
  }

  async removePortfolioItem(id: number): Promise<void> {
    await db.delete(portfolioItems).where(eq(portfolioItems.id, id));
  }
}

export const storage = new DatabaseStorage();