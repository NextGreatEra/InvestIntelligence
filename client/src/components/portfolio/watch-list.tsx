import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Asset } from "@shared/schema";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface WatchlistItem {
  id: number;
  assetId: number;
  addedAt: string;
  asset: Asset;
}

export default function WatchList() {
  const { data: watchlistItems = [], isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
  });
  const { toast } = useToast();

  const removeItemMutation = useMutation({
    mutationFn: async (watchlistItemId: number) => {
      const response = await fetch(`/api/watchlist/${watchlistItemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: "Success",
        description: "Item removed from watchlist",
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

  const handleDelete = (watchlistItemId: number) => {
    if (window.confirm('Are you sure you want to remove this item from your watchlist?')) {
      removeItemMutation.mutate(watchlistItemId);
    }
  };

  if (isLoading) {
    return <WatchListSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Watchlist</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {watchlistItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-lg bg-card border"
            >
              <div>
                <h3 className="font-medium">{item.asset.symbol.toUpperCase()}</h3>
                <p className="text-sm text-muted-foreground">{item.asset.name}</p>
              </div>
              <div className="flex items-center space-x-4">
                <p className="font-medium">
                  ${Number(item.asset.currentPrice).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
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

function WatchListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
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
