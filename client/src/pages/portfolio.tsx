import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import AssetSearch from "@/components/portfolio/asset-search";
import AssetList from "@/components/portfolio/asset-list";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

export default function Portfolio() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const { toast } = useToast();

  const addAssetMutation = useMutation({
    mutationFn: async (data: { 
      symbol: string;
      name: string;
      current_price: number;
      quantity: string;
    }) => {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
      setQuantity("");
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
  }, []); // No dependencies needed as we're just setting state

  const handleQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuantity(e.target.value);
  }, []);

  const handleAddAsset = useCallback(() => {
    if (!selectedAsset || !quantity) {
      toast({
        title: "Error",
        description: "Please select an asset and enter quantity",
        variant: "destructive",
      });
      return;
    }

    const numericQuantity = parseFloat(quantity);
    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity greater than 0",
        variant: "destructive",
      });
      return;
    }

    addAssetMutation.mutate({
      symbol: selectedAsset.symbol,
      name: selectedAsset.name,
      current_price: selectedAsset.current_price,
      quantity
    });
  }, [selectedAsset, quantity, toast, addAssetMutation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Asset</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Asset to Portfolio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <AssetSearch onSelect={handleAssetSelect} />
              {selectedAsset && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Current Price:</span>
                    <span className="font-medium">
                      ${selectedAsset.current_price.toLocaleString()}
                    </span>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Enter quantity"
                    value={quantity}
                    onChange={handleQuantityChange}
                  />
                  <Button
                    onClick={handleAddAsset}
                    disabled={!selectedAsset || !quantity || addAssetMutation.isPending}
                    className="w-full"
                  >
                    {addAssetMutation.isPending ? "Adding..." : "Add to Portfolio"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <AssetList />
    </div>
  );
}