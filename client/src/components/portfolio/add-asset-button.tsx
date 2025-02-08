import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AssetSearch from "./asset-search";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AssetSearchResult {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

export default function AddAssetButton() {
  const [open, setOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addAssetMutation = useMutation({
    mutationFn: async (asset: AssetSearchResult) => {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: asset.symbol.toUpperCase(),
          name: asset.name,
          currentPrice: asset.current_price,
          type: 'crypto'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add asset");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({
        title: "Asset added",
        description: `${variables.symbol.toUpperCase()} has been added to your portfolio`,
      });
      setOpen(false);
      setSelectedAsset(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add asset to portfolio",
        variant: "destructive",
      });
    },
  });

  const handleAssetSelect = (asset: AssetSearchResult) => {
    setSelectedAsset(asset);
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