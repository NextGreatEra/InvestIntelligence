import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Asset } from "@shared/schema";
import { ArrowUpIcon, ArrowDownIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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

  const handleDelete = (portfolioItemId: number) => {
    if (window.confirm('Are you sure you want to remove this asset?')) {
      removeAssetMutation.mutate(portfolioItemId);
    }
  };

  if (isLoading) {
    return <AssetListSkeleton />;
  }

  const sortedPortfolioItems = [...portfolioItems].sort((a, b) => Number(b.asset.currentPrice) - Number(a.asset.currentPrice));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedPortfolioItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-lg bg-card border"
            >
              <div className="flex-1">
                <h3 className="font-medium">{item.asset.symbol.toUpperCase()}</h3>
                <p className="text-sm text-muted-foreground">{item.asset.name}</p>
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  ${Number(item.asset.currentPrice).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                {/* Price change removed as it's not directly available in the new structure */}
              </div>
              <div className="ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id)}
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