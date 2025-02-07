import { Asset, InsertAsset, PortfolioItem, InsertPortfolioItem, PriceHistory, priceHistory, assets, portfolioItems } from "@shared/schema";
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
  getPortfolioItem(id: number): Promise<PortfolioItem | undefined>;
  createPortfolioItem(item: InsertPortfolioItem): Promise<PortfolioItem>;
  updatePortfolioRank(id: number, newRank: number): Promise<PortfolioItem>;
  updatePortfolioAllocation(id: number, allocation: string): Promise<PortfolioItem>;
  removePortfolioItem(id: number): Promise<void>;

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

  async removeAsset(id: number): Promise<void> {
    await db.delete(assets).where(eq(assets.id, id));
  }

  async getPortfolioItems(): Promise<PortfolioItem[]> {
    return await db.select()
      .from(portfolioItems)
      .orderBy(asc(portfolioItems.rank));
  }

  async getPortfolioItem(id: number): Promise<PortfolioItem | undefined> {
    const [item] = await db.select().from(portfolioItems).where(eq(portfolioItems.id, id));
    return item;
  }

  async createPortfolioItem(insertItem: InsertPortfolioItem): Promise<PortfolioItem> {
    // Get the current highest rank using a raw SQL query
    const result = await db.select({
      maxRank: sql<number>`COALESCE(MAX(rank), 0)`
    }).from(portfolioItems);

    const newRank = (result[0]?.maxRank || 0) + 1;

    const [item] = await db.insert(portfolioItems)
      .values({
        ...insertItem,
        rank: newRank,
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

  async updatePortfolioAllocation(id: number, allocation: string): Promise<PortfolioItem> {
    const [item] = await db.update(portfolioItems)
      .set({ 
        allocation,
        lastUpdated: new Date()
      })
      .where(eq(portfolioItems.id, id))
      .returning();

    if (!item) throw new Error("Portfolio item not found");
    return item;
  }

  async removePortfolioItem(id: number): Promise<void> {
    try {
      // Get the item to be removed and its allocation
      const [itemToRemove] = await db.select()
        .from(portfolioItems)
        .where(eq(portfolioItems.id, id));

      if (!itemToRemove) {
        console.log('Item not found:', id);
        return;
      }

      console.log('Found item to remove:', itemToRemove);

      // Get other portfolio items
      const otherItems = await db.select()
        .from(portfolioItems)
        .where(
          eq(portfolioItems.id, id).not()
        );

      console.log('Other items count:', otherItems.length);

      const removedAllocation = Number(itemToRemove.allocation);
      const remainingItemCount = otherItems.length;

      if (remainingItemCount > 0) {
        // Redistribute the allocation among remaining items
        const redistributedAmount = removedAllocation / remainingItemCount;

        console.log('Redistributing allocation:', {
          removedAllocation,
          redistributedAmount,
          remainingItemCount
        });

        for (const item of otherItems) {
          const newAllocation = (Number(item.allocation) + redistributedAmount).toString();
          console.log('Updating allocation for item:', {
            itemId: item.id,
            oldAllocation: item.allocation,
            newAllocation
          });

          await this.updatePortfolioAllocation(item.id, newAllocation);
        }
      }

      // Finally, remove the item
      console.log('Executing delete query for item:', id);
      await db.delete(portfolioItems)
        .where(eq(portfolioItems.id, id));

      console.log('Item deleted successfully');
    } catch (error) {
      console.error('Error in removePortfolioItem:', error);
      throw error;
    }
  }

  async addPriceHistory(data: { assetId: number; price: number }): Promise<void> {
    await db.insert(priceHistory).values({
      assetId: data.assetId,
      price: data.price.toString(),
      timestamp: new Date()
    });
  }

  async getPriceHistory24h(assetSymbol: string): Promise<{ price: number } | null> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [historicalPrice] = await db
      .select({
        price: priceHistory.price
      })
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.assetId, Number(assetSymbol)),
          lte(priceHistory.timestamp, twentyFourHoursAgo)
        )
      )
      .orderBy(desc(priceHistory.timestamp))
      .limit(1);

    if (!historicalPrice) return null;

    return {
      price: Number(historicalPrice.price)
    };
  }
}

export const storage = new DatabaseStorage();