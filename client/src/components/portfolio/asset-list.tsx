import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Asset } from "@shared/schema";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import AllocationChart from "./allocation-chart";

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

  const updateAllocationMutation = useMutation({
    mutationFn: async ({ id, allocation }: { id: number; allocation: number }) => {
      const response = await fetch(`/api/portfolio/${id}/allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocation }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update allocation");
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

  const handleAllocationChange = (id: number, newAllocation: number) => {
    const currentTotal = portfolioItems.reduce((sum, item) => 
      sum + (item.id === id ? 0 : parseFloat(item.allocation || "0")), 0);

    if (currentTotal + newAllocation > 100) {
      toast({
        title: "Warning",
        description: "Total allocation cannot exceed 100%",
        variant: "destructive",
      });
      return;
    }

    updateAllocationMutation.mutate({ id, allocation: newAllocation });
  };

  if (isLoading) {
    return <AssetListSkeleton />;
  }

  const sortedPortfolioItems = [...portfolioItems].sort((a, b) => 
    parseFloat(b.allocation || "0") - parseFloat(a.allocation || "0")
  );

  const totalAllocation = sortedPortfolioItems.reduce(
    (sum, item) => sum + parseFloat(item.allocation || "0"), 
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6 w-full aspect-square max-w-md mx-auto">
          <AllocationChart
            width={400}
            height={400}
            data={sortedPortfolioItems}
          />
        </div>
        <div className="space-y-4">
          {sortedPortfolioItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col space-y-2 p-4 rounded-lg bg-card border"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{item.asset.symbol.toUpperCase()}</h3>
                  <p className="text-sm text-muted-foreground">{item.asset.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    ${Number(item.asset.currentPrice).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {parseFloat(item.allocation || "0").toFixed(1)}% Allocation
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Slider
                    value={[parseFloat(item.allocation || "0")]}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                    onValueChange={([value]) => handleAllocationChange(item.id, value)}
                  />
                </div>
                <div className="w-16 text-right">
                  <span className="text-sm font-medium">
                    {parseFloat(item.allocation || "0").toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
          {totalAllocation < 100 && (
            <p className="text-sm text-muted-foreground text-center">
              Remaining allocation: {(100 - totalAllocation).toFixed(1)}%
            </p>
          )}
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
        <div className="mb-6 w-full aspect-square max-w-md mx-auto">
          <Skeleton className="w-[400px] h-[400px] rounded-full" />
        </div>
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