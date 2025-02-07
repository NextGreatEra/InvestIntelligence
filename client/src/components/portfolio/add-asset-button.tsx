import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AssetSearch from "./asset-search";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function AddAssetButton() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAssetSelect = async (asset: any) => {
    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: asset.symbol,
          name: asset.name,
          currentPrice: asset.current_price,
          quantity: 1, // Default quantity
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add asset");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({
        title: "Asset added",
        description: `${asset.symbol} has been added to your portfolio`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add asset to portfolio",
        variant: "destructive",
      });
    }
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
