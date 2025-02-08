import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Asset } from "@shared/schema";
import { PlusCircleIcon, MinusCircleIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import AddAssetButton from "@/components/portfolio/add-asset-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PortfolioItem {
  id: number;
  assetId: number;
  rank: number;
  allocation: string;
  asset: Asset;
}

export default function AssetList() {
  const { data: portfolioItems = [], isLoading } = useQuery<PortfolioItem[]>({
    queryKey: ["/api/portfolio"],
  });
  const { toast } = useToast();

  const removeAssetMutation = useMutation({
    mutationFn: async (portfolioItemId: number) => {
      const response = await fetch(`/api/portfolio/${portfolioItemId}`, {
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRankMutation = useMutation({
    mutationFn: async ({ id, newRank }: { id: number; newRank: number }) => {
      const response = await fetch(`/api/portfolio/${id}/rank`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rank: newRank }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update rank");
      }
      return response.json();
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

  const handleDelete = (portfolioItemId: number) => {
    if (window.confirm('Are you sure you want to remove this asset?')) {
      removeAssetMutation.mutate(portfolioItemId);
    }
  };

  const moveAsset = (currentIndex: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= portfolioItems.length) return;

    const currentItem = portfolioItems[currentIndex];
    const targetItem = portfolioItems[newIndex];

    updateRankMutation.mutate({ id: currentItem.id, newRank: targetItem.rank });
    updateRankMutation.mutate({ id: targetItem.id, newRank: currentItem.rank });
  };

  if (isLoading) {
    return <AssetListSkeleton />;
  }

  // Filter out invalid portfolio items
  const validPortfolioItems = portfolioItems.filter(item => item && item.asset);
  const sortedPortfolioItems = [...validPortfolioItems].sort((a, b) => a.rank - b.rank);
  const totalItems = sortedPortfolioItems.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Portfolio Assets</CardTitle>
        <AddAssetButton />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedPortfolioItems.map((item, index) => {
            const allocation = totalItems === 1 ? 100 :
              Math.round((totalItems - index) * (100 / totalItems));

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-lg bg-card border"
              >
                <div className="flex items-center space-x-2">
                  {totalItems > 1 && (
                    <div className="flex flex-col space-y-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveAsset(index, 'up')}
                              disabled={index === 0}
                            >
                              <PlusCircleIcon className="h-4 w-4 text-green-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Increase allocation (move up)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveAsset(index, 'down')}
                              disabled={index === totalItems - 1}
                            >
                              <MinusCircleIcon className="h-4 w-4 text-red-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Decrease allocation (move down)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium">
                      {item.asset.symbol.toUpperCase()}
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({allocation}%)
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground">{item.asset.name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-medium">
                      ${Number(item.asset.currentPrice).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    {item.asset.priceChangePercentage24h != null && (
                      <p className={`text-sm ${Number(item.asset.priceChangePercentage24h) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {Number(item.asset.priceChangePercentage24h) >= 0 ? '+' : ''}
                        {Number(item.asset.priceChangePercentage24h).toFixed(2)}%
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function AssetListSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Portfolio Assets</CardTitle>
        <div className="w-24 h-9" /> {/* Space for AddAssetButton */}
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