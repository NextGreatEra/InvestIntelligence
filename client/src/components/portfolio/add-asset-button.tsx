import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AssetSearch from "./asset-search";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface AssetSearchResult {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h?: number | null;
}

export default function AddAssetButton() {
  const [open, setOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);
  const { toast } = useToast();

  const addAssetMutation = useMutation({
    mutationFn: async (asset: AssetSearchResult) => {
      console.log('Adding asset:', asset); // Debug log
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: asset.id,
          symbol: asset.symbol.toUpperCase(),
          name: asset.name,
          currentPrice: asset.current_price,
          priceChangePercentage24h: asset.price_change_percentage_24h
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add asset");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({
        title: "Success",
        description: "Asset added successfully",
      });
      setOpen(false);
      setSelectedAsset(null);
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
    console.log('Selected asset:', asset); // Debug log
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
        onOpenChange={setOpen}
        onSelect={handleAssetSelect}
      />
    </>
  );
}