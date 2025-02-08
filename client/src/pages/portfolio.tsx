import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AssetSearch from "@/components/portfolio/asset-search";
import AssetList from "@/components/portfolio/asset-list";
import WatchList from "@/components/portfolio/watch-list";
import AddAssetButton from "@/components/portfolio/add-asset-button";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  type: 'stock' | 'crypto';
}

export default function Portfolio() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AssetList />
        <WatchList />
      </div>
    </div>
  );
}