import { Asset, InsertAsset, PortfolioItem, InsertPortfolioItem, PriceHistory, WatchlistItem, InsertWatchlistItem, priceHistory, assets, portfolioItems, watchlistItems } from "@shared/schema";
import { db } from "./db";
import { eq, or, ilike, and, lte, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  getAssets(): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  getAssetBySymbol(symbol: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAssetPrice(id: number, price: number): Promise<Asset>;
  searchAssets(query: string): Promise<Asset[]>;
  removeAsset(id: number): Promise<void>;

  getPortfolioItems(): Promise<PortfolioItem[]>;
  getPortfolioItemsWithAssets(): Promise<(PortfolioItem & { asset: Asset })[]>;
  getPortfolioItem(id: number): Promise<PortfolioItem | undefined>;
  createPortfolioItem(item: InsertPortfolioItem): Promise<PortfolioItem>;
  updatePortfolioRank(id: number, newRank: number): Promise<PortfolioItem>;
  removePortfolioItem(id: number): Promise<void>;

  getWatchlistItems(): Promise<WatchlistItem[]>;
  getWatchlistItemsWithAssets(): Promise<(WatchlistItem & { asset: Asset })[]>;
  createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeWatchlistItem(id: number): Promise<void>;

  addPriceHistory(data: { assetId: number; price: number }): Promise<void>;
  getPriceHistory24h(assetSymbol: string): Promise<{ price: number } | null>;
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
    const formattedPrice = Number(insertAsset.currentPrice).toFixed(8);
    const [asset] = await db.insert(assets)
      .values({ 
        ...insertAsset,
        currentPrice: formattedPrice,
        lastUpdated: new Date() 
      })
      .returning();
    return asset;
  }

  async updateAssetPrice(id: number, price: number): Promise<Asset> {
    const formattedPrice = price.toFixed(8);
    const [asset] = await db.update(assets)
      .set({ 
        currentPrice: formattedPrice,
        lastUpdated: new Date() 
      })
      .where(eq(assets.id, id))
      .returning();
    if (!asset) throw new Error("Asset not found");
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

  async addPriceHistory(data: { assetId: number; price: number }): Promise<void> {
    try {
      await db.insert(priceHistory).values({
        assetId: data.assetId,
        price: data.price.toString(),
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error adding price history:', error);
      throw error;
    }
  }

  async getPriceHistory24h(assetSymbol: string): Promise<{ price: number } | null> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const asset = await this.getAssetBySymbol(assetSymbol);
      if (!asset) return null;

      const [historicalPrice] = await db
        .select({
          price: priceHistory.price
        })
        .from(priceHistory)
        .where(
          and(
            eq(priceHistory.assetId, asset.id),
            sql`${priceHistory.timestamp} <= ${twentyFourHoursAgo}`
          )
        )
        .orderBy(desc(priceHistory.timestamp))
        .limit(1);

      if (!historicalPrice) return null;

      return {
        price: Number(historicalPrice.price)
      };
    } catch (error) {
      console.error('Error getting price history:', error);
      return null;
    }
  }

  async getWatchlistItems(): Promise<WatchlistItem[]> {
    return await db.select().from(watchlistItems);
  }

  async getWatchlistItemsWithAssets(): Promise<(WatchlistItem & { asset: Asset })[]> {
    const result = await db.select({
      ...watchlistItems,
      asset: assets
    })
    .from(watchlistItems)
    .leftJoin(assets, eq(watchlistItems.assetId, assets.id));

    return result.map(item => ({
      ...item,
      asset: item.asset
    }));
  }

  async createWatchlistItem(insertItem: InsertWatchlistItem): Promise<WatchlistItem> {
    const [item] = await db.insert(watchlistItems)
      .values({
        ...insertItem,
        addedAt: new Date()
      })
      .returning();
    return item;
  }

  async removeWatchlistItem(id: number): Promise<void> {
    await db.delete(watchlistItems).where(eq(watchlistItems.id, id));
  }
}

export const storage = new DatabaseStorage();