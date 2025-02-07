import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AssetSearch from "./asset-search";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AssetSearchResult {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

export default function AddAssetButton() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addAssetMutation = useMutation({
    mutationFn: async (asset: AssetSearchResult) => {
      return apiRequest("/api/portfolio", {
        method: "POST",
        body: {
          symbol: asset.symbol,
          name: asset.name,
          currentPrice: asset.current_price,
          quantity: 1, // Default quantity
        },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({
        title: "Asset added",
        description: `${variables.symbol.toUpperCase()} has been added to your portfolio`,
      });
      setOpen(false);
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