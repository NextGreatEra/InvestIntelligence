import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AssetSearch from "./asset-search";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AssetSearchResult {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

export default function AddAssetButton() {
  const [open, setOpen] = useState(false);
  const [allocation, setAllocation] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get current portfolio to calculate remaining allocation
  const { data: portfolio = [] } = useQuery<{ allocation: number }[]>({
    queryKey: ["/api/portfolio"],
  });

  const totalCurrentAllocation = portfolio.reduce(
    (sum, asset) => sum + Number(asset.allocation), 
    0
  );
  const remainingAllocation = Math.max(0, 100 - totalCurrentAllocation);

  const addAssetMutation = useMutation({
    mutationFn: async (asset: AssetSearchResult) => {
      if (!allocation || allocation <= 0) {
        throw new Error("Please set an allocation percentage greater than 0");
      }

      if (allocation > remainingAllocation) {
        throw new Error(`Cannot allocate more than the remaining ${remainingAllocation.toFixed(2)}%`);
      }

      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: asset.symbol.toUpperCase(),
          name: asset.name,
          currentPrice: asset.current_price,
          allocation: Number(allocation),
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
        description: `${variables.symbol.toUpperCase()} has been added to your portfolio with ${allocation}% allocation`,
      });
      setOpen(false);
      setSelectedAsset(null);
      setAllocation(0);
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
  };

  const handleAllocationChange = (value: number[]) => {
    if (value[0] > remainingAllocation) {
      toast({
        title: "Warning",
        description: `Cannot allocate more than the remaining ${remainingAllocation.toFixed(2)}%`,
        variant: "destructive",
      });
      setAllocation(remainingAllocation);
      return;
    }
    setAllocation(value[0]);
  };

  const handleAddAsset = () => {
    if (!selectedAsset) return;
    addAssetMutation.mutate(selectedAsset);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={remainingAllocation <= 0}>
        <Plus className="mr-2 h-4 w-4" />
        Add Asset {remainingAllocation > 0 && `(${remainingAllocation.toFixed(2)}% remaining)`}
      </Button>

      <Dialog open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Asset Allocation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedAsset && (
              <div>
                <p className="text-sm font-medium mb-4">
                  {selectedAsset.name} ({selectedAsset.symbol.toUpperCase()})
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">
                      Allocation ({allocation.toFixed(2)}%)
                    </label>
                    <Slider
                      value={[allocation]}
                      onValueChange={handleAllocationChange}
                      max={remainingAllocation}
                      step={0.1}
                      className="mt-2"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Remaining allocation: {remainingAllocation.toFixed(2)}%
                  </p>
                  <Button 
                    onClick={handleAddAsset} 
                    className="w-full"
                    disabled={allocation <= 0 || allocation > remainingAllocation}
                  >
                    Add to Portfolio
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AssetSearch
        open={open}
        onOpenChange={setOpen}
        onSelect={handleAssetSelect}
      />
    </>
  );
}