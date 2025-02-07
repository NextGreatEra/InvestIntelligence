import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Asset } from "@shared/schema";
import { ArrowUpIcon, ArrowDownIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { queryClient } from "@/lib/queryClient";

interface AssetWithDetails extends Asset {
  allocation: number;
  rank: number;
  value: number;
  priceChange24h: number;
}

export default function AssetList() {
  const { data: assets = [], isLoading } = useQuery<AssetWithDetails[]>({
    queryKey: ["/api/portfolio"],
  });
  const { toast } = useToast();

  const removeAssetMutation = useMutation({
    mutationFn: async (assetId: number) => {
      console.log('Attempting to delete asset with ID:', assetId);
      const response = await fetch(`/api/portfolio/${assetId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove asset");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({
        title: "Success",
        description: "Asset removed successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: async ({id, allocation}: {id: number, allocation: number}) => {
      const response = await fetch(`/api/portfolio/${id}/allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocation }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update allocation");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAllocationChange = async (assetId: number, newAllocation: number) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    const otherAssets = assets.filter(a => a.id !== assetId);
    const totalRemaining = 100 - newAllocation;
    
    if (newAllocation < 0 || newAllocation > 100) {
      toast({
        title: "Invalid allocation",
        description: "Allocation must be between 0 and 100%",
        variant: "destructive",
      });
      return;
    }

    // Calculate proportional allocations for other assets
    const currentOtherTotal = otherAssets.reduce((sum, a) => sum + a.allocation, 0);
    const scalingFactor = currentOtherTotal > 0 ? totalRemaining / currentOtherTotal : 0;

    try {
      // Update the changed asset first
      await updateAllocationMutation.mutateAsync({
        id: assetId,
        allocation: newAllocation
      });

      // Update other assets proportionally
      for (const otherAsset of otherAssets) {
        const newOtherAllocation = currentOtherTotal > 0 
          ? otherAsset.allocation * scalingFactor 
          : totalRemaining / otherAssets.length;
          
        await updateAllocationMutation.mutateAsync({
          id: otherAsset.id,
          allocation: newOtherAllocation
        });
      }
    } catch (error) {
      console.error('Error updating allocations:', error);
    }
  };

  const handleDelete = (assetId: number) => {
    console.log('Delete requested for asset:', assetId);
    if (window.confirm('Are you sure you want to remove this asset?')) {
      removeAssetMutation.mutate(assetId);
    }
  };

  if (isLoading) {
    return <AssetListSkeleton />;
  }

  const sortedAssets = [...assets].sort((a, b) => a.rank - b.rank);
  const totalAllocation = sortedAssets.reduce((sum, asset) => sum + asset.allocation, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Assets ({totalAllocation.toFixed(2)}% Allocated)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedAssets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between p-4 rounded-lg bg-card border"
            >
              <div className="flex-1">
                <h3 className="font-medium">{asset.symbol}</h3>
                <p className="text-sm text-muted-foreground">{asset.name}</p>
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  ${Number(asset.currentPrice).toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[asset.allocation]}
                    onValueChange={([value]) => handleAllocationChange(asset.id, value)}
                    max={100}
                    step={0.1}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">
                    {asset.allocation.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="flex-1 text-right">
                <p className="font-medium">
                  ${asset.value.toLocaleString()}
                </p>
                <div className="flex items-center justify-end gap-1">
                  {asset.priceChange24h >= 0 ? (
                    <ArrowUpIcon className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4 text-red-500" />
                  )}
                  <p
                    className={
                      asset.priceChange24h >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  >
                    {asset.priceChange24h ? Math.abs(asset.priceChange24h).toFixed(2) : '0.00'}%
                  </p>
                </div>
              </div>
              <div className="ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(asset.id)}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AssetListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 rounded-lg bg-card border"
            >
              <Skeleton className="h-12 w-24" />
              <Skeleton className="h-12 w-24" />
              <Skeleton className="h-12 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}