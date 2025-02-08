import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AssetSearch from "./asset-search";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface AssetSearchResult {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  type: 'stock' | 'crypto';
}

export default function AddAssetButton() {
  const [open, setOpen] = useState(false);
  const [isWatchlist, setIsWatchlist] = useState(false);
  const { toast } = useToast();

  const addAssetMutation = useMutation({
    mutationFn: async (asset: AssetSearchResult) => {
      const endpoint = isWatchlist ? "/api/watchlist" : "/api/portfolio";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: asset.symbol.toUpperCase(),
          name: asset.name,
          currentPrice: asset.current_price,
          type: asset.type
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to add asset to ${isWatchlist ? 'watchlist' : 'portfolio'}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate both queries as the asset might have been added to either
      if (isWatchlist) {
        queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      }
      toast({
        title: "Success",
        description: `Asset added to ${isWatchlist ? 'watchlist' : 'portfolio'} successfully`,
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssetSelect = (asset: AssetSearchResult) => {
    addAssetMutation.mutate(asset);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Asset
      </Button>

      <AssetSearch
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setIsWatchlist(false); // Reset to portfolio mode when closing
          }
        }}
        onSelect={handleAssetSelect}
      >
        <div className="flex items-center space-x-2 mt-4 mb-2">
          <Switch
            id="add-to-watchlist"
            checked={isWatchlist}
            onCheckedChange={setIsWatchlist}
          />
          <Label htmlFor="add-to-watchlist">
            Add to {isWatchlist ? 'Watchlist' : 'Portfolio'}
          </Label>
        </div>
      </AssetSearch>
    </>
  );
}