import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AssetSearch from "./asset-search";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface AssetSearchResult {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

export default function AddAssetButton() {
  const [open, setOpen] = useState(false);
  const [allocation, setAllocation] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);
  const [showAllocationDialog, setShowAllocationDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addAssetMutation = useMutation({
    mutationFn: async (data: { asset: AssetSearchResult; allocation: number }) => {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: data.asset.symbol.toUpperCase(),
          name: data.asset.name,
          currentPrice: data.asset.current_price,
          type: 'crypto',
          allocation: data.allocation
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
        description: `${variables.asset.symbol.toUpperCase()} has been added to your portfolio`,
      });
      setOpen(false);
      setShowAllocationDialog(false);
      setSelectedAsset(null);
      setAllocation("");
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
    setOpen(false);
    setShowAllocationDialog(true);
  };

  const handleAllocationSubmit = () => {
    if (!selectedAsset || !allocation) {
      toast({
        title: "Error",
        description: "Please enter an allocation percentage",
        variant: "destructive",
      });
      return;
    }

    const allocationValue = parseFloat(allocation);
    if (isNaN(allocationValue) || allocationValue <= 0 || allocationValue > 100) {
      toast({
        title: "Error",
        description: "Please enter a valid allocation between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    addAssetMutation.mutate({
      asset: selectedAsset,
      allocation: allocationValue
    });
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

      <Dialog open={showAllocationDialog} onOpenChange={setShowAllocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Asset Allocation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="allocation" className="text-sm font-medium">
                Allocation Percentage (0-100)
              </label>
              <Input
                id="allocation"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                placeholder="Enter allocation percentage"
              />
            </div>
            <Button onClick={handleAllocationSubmit} className="w-full">
              Add to Portfolio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}