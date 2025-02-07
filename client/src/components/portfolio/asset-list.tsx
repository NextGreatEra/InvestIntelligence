import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Asset } from "@shared/schema";
import { ArrowUpIcon, ArrowDownIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateAllocationMutation = useMutation({
    mutationFn: async ({id, allocation}: {id: number, allocation: number}) => {
      const response = await fetch(`/api/portfolio/${id}/allocation`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allocation }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update allocation");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({
        title: "Allocation updated",
        description: "Portfolio allocations have been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update allocation",
        variant: "destructive",
      });
    },
  });

  const removeAssetMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/portfolio/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove asset");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({
        title: "Asset removed",
        description: "The asset has been removed from your portfolio",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove asset",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <AssetListSkeleton />;
  }

  const sortedAssets = [...assets].sort((a, b) => a.rank - b.rank);
  const totalAllocation = sortedAssets.reduce((sum, asset) => sum + asset.allocation, 0);

  const handleAllocationChange = (assetId: number, newAllocation: number) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    const otherAssets = assets.filter(a => a.id !== assetId);
    const otherTotalAllocation = otherAssets.reduce((sum, a) => sum + a.allocation, 0);

    if (newAllocation + otherTotalAllocation > 100) {
      toast({
        title: "Invalid allocation",
        description: "Total allocation cannot exceed 100%",
        variant: "destructive",
      });
      return;
    }

    updateAllocationMutation.mutate({
      id: assetId,
      allocation: newAllocation,
    });
  };

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
                    onValueChange={(values) => handleAllocationChange(asset.id, values[0])}
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
                  onClick={() => {
                    console.log('Deleting asset:', asset.id);
                    removeAssetMutation.mutate(asset.id);
                  }}
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