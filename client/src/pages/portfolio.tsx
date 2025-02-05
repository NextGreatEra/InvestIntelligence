import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import AssetSearch from "@/components/portfolio/asset-search";
import AssetList from "@/components/portfolio/asset-list";

interface SelectedAsset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

export default function Portfolio() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
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
        body: JSON.stringify({
          symbol: data.symbol.toUpperCase(),
          name: data.name,
          current_price: data.current_price,
          quantity: data.quantity
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
      setQuantity("");
      toast({
        title: "Success",
        description: "Asset added to portfolio successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add asset to portfolio",
        variant: "destructive",
      });
    },
  });

  const handleAddAsset = () => {
    if (!selectedAsset || !quantity) {
      toast({
        title: "Error",
        description: "Please select an asset and enter quantity",
        variant: "destructive",
      });
      return;
    }

    if (!selectedAsset.current_price) {
      toast({
        title: "Error",
        description: "Failed to fetch current price. Please try again.",
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
  };

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
              <AssetSearch
                onSelect={(asset: SelectedAsset) => {
                  console.log('Selected asset with price:', asset);
                  setSelectedAsset(asset);
                }}
              />
              {selectedAsset && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Current Price:</span>
                    <span className="font-medium">
                      ${selectedAsset.current_price?.toLocaleString() ?? 'Loading...'}
                    </span>
                  </div>
                  <Input
                    type="number"
                    placeholder="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              )}
              <Button
                onClick={handleAddAsset}
                disabled={!selectedAsset || !quantity || addAssetMutation.isPending}
                className="w-full"
              >
                {addAssetMutation.isPending ? "Adding..." : "Add to Portfolio"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <AssetList />
    </div>
  );
}