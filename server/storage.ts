import { Asset, InsertAsset, PortfolioItem, InsertPortfolioItem } from "@shared/schema";

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

export class MemStorage implements IStorage {
  private assets: Map<number, Asset>;
  private portfolioItems: Map<number, PortfolioItem>;
  private currentAssetId: number;
  private currentPortfolioItemId: number;

  constructor() {
    this.assets = new Map();
    this.portfolioItems = new Map();
    this.currentAssetId = 1;
    this.currentPortfolioItemId = 1;
  }

  async getAssets(): Promise<Asset[]> {
    return Array.from(this.assets.values());
  }

  async getAsset(id: number): Promise<Asset | undefined> {
    return this.assets.get(id);
  }

  async getAssetBySymbol(symbol: string): Promise<Asset | undefined> {
    return Array.from(this.assets.values()).find(
      (asset) => asset.symbol.toLowerCase() === symbol.toLowerCase()
    );
  }

  async createAsset(insertAsset: InsertAsset): Promise<Asset> {
    const id = this.currentAssetId++;
    const asset: Asset = {
      ...insertAsset,
      id,
      lastUpdated: new Date()
    };
    this.assets.set(id, asset);
    return asset;
  }

  async updateAssetPrice(id: number, price: number): Promise<Asset> {
    const asset = await this.getAsset(id);
    if (!asset) throw new Error("Asset not found");
    
    const updated: Asset = {
      ...asset,
      currentPrice: price.toString(),
      lastUpdated: new Date()
    };
    this.assets.set(id, updated);
    return updated;
  }

  async getPortfolioItems(): Promise<PortfolioItem[]> {
    return Array.from(this.portfolioItems.values());
  }

  async getPortfolioItem(id: number): Promise<PortfolioItem | undefined> {
    return this.portfolioItems.get(id);
  }

  async createPortfolioItem(insertItem: InsertPortfolioItem): Promise<PortfolioItem> {
    const id = this.currentPortfolioItemId++;
    const item: PortfolioItem = { ...insertItem, id };
    this.portfolioItems.set(id, item);
    return item;
  }

  async updatePortfolioItem(id: number, quantity: number): Promise<PortfolioItem> {
    const item = await this.getPortfolioItem(id);
    if (!item) throw new Error("Portfolio item not found");
    
    const updated: PortfolioItem = { ...item, quantity: quantity.toString() };
    this.portfolioItems.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
