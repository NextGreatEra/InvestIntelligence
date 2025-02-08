import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import AddAssetButton from "@/components/portfolio/add-asset-button";
import AssetSearch from "@/components/portfolio/asset-search";
import AssetList from "@/components/portfolio/asset-list";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  type: 'stock' | 'crypto';
}

export default function Portfolio() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [allocation, setAllocation] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const { toast } = useToast();

  const addAssetMutation = useMutation({
    mutationFn: async (data: {
      symbol: string;
      name: string;
      currentPrice: number;
      type: 'stock' | 'crypto';
    }) => {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: data.symbol,
          name: data.name,
          currentPrice: Number(data.currentPrice), // Ensure price is a number
          type: data.type
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to add asset");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      setIsDialogOpen(false);
      setSelectedAsset(null);
      setAllocation("");
      toast({
        title: "Success",
        description: "Asset added to portfolio successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add asset to portfolio",
        variant: "destructive",
      });
    },
  });

  const handleAssetSelect = useCallback((asset: Asset) => {
    setSelectedAsset(asset);
  }, []);

  const handleAllocationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAllocation(e.target.value);
  }, []);

  const handleAddAsset = useCallback(() => {
    if (!selectedAsset) {
      toast({
        title: "Error",
        description: "Please select an asset first",
        variant: "destructive",
      });
      return;
    }

    addAssetMutation.mutate({
      symbol: selectedAsset.symbol,
      name: selectedAsset.name,
      currentPrice: selectedAsset.current_price,
      type: selectedAsset.type
    });
  }, [selectedAsset, toast, addAssetMutation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <AddAssetButton />
      </div>

      <AssetList />
    </div>
  );
}