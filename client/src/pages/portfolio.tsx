import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import AssetSearch from "@/components/portfolio/asset-search";
import AssetList from "@/components/portfolio/asset-list";
import { InsertPortfolioItem, insertPortfolioItemSchema } from "@shared/schema";

interface SelectedAsset {
  id: number;
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
    mutationFn: async (data: InsertPortfolioItem) => {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add asset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      setIsDialogOpen(false);
      setSelectedAsset(null);
      setQuantity("");
      toast({
        title: "Asset added",
        description: "The asset has been added to your portfolio.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add asset to portfolio.",
        variant: "destructive",
      });
    },
  });

  const handleAddAsset = () => {
    if (!selectedAsset || !quantity) return;

    const data: InsertPortfolioItem = {
      assetId: selectedAsset.id,
      quantity: quantity,
      averagePrice: selectedAsset.current_price.toString()
    };

    const validation = insertPortfolioItemSchema.safeParse(data);
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: "Please check your input values.",
        variant: "destructive",
      });
      return;
    }

    addAssetMutation.mutate(validation.data);
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
                onSelect={(asset) => setSelectedAsset(asset)}
              />
              {selectedAsset && (
                <Input
                  type="number"
                  placeholder="Quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              )}
              <Button
                onClick={handleAddAsset}
                disabled={!selectedAsset || !quantity || addAssetMutation.isPending}
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