import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

const LOCAL_STORAGE_KEY = "portfolio_items";

export function usePortfolio() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Get portfolio from server if authenticated, otherwise from localStorage
  const { data: portfolio = [] } = useQuery({
    queryKey: ["/api/portfolio"],
    queryFn: async () => {
      if (!user) {
        const localItems = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
        return localItems;
      }
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      return res.json();
    }
  });

  const addToPortfolioMutation = useMutation({
    mutationFn: async (asset: { symbol: string; name: string; type: string }) => {
      if (!user) {
        // Store in localStorage if not authenticated
        const localItems = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
        const newItem = {
          id: Date.now(), // Use timestamp as temporary ID
          ...asset,
          asset: {
            id: Date.now(),
            symbol: asset.symbol,
            name: asset.name,
            type: asset.type,
            currentPrice: 0, // This will be updated by the market data
          }
        };
        localItems.push(newItem);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localItems));
        return newItem;
      }

      // Otherwise, store in server
      const res = await apiRequest("POST", "/api/portfolio", asset);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // When user logs in, merge localStorage portfolio with server portfolio
  useEffect(() => {
    if (user) {
      const localItems = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
      if (localItems.length > 0) {
        // First fetch server portfolio to avoid duplicates
        fetch("/api/portfolio")
          .then(res => res.json())
          .then(serverPortfolio => {
            // Filter out items that already exist on server
            const newItems = localItems.filter((localItem: any) => 
              !serverPortfolio.some((serverItem: any) => 
                serverItem.asset.symbol === localItem.asset.symbol && 
                serverItem.asset.type === localItem.asset.type
              )
            );

            return Promise.all(
              newItems.map(async (item: any) => {
                try {
                  await addToPortfolioMutation.mutateAsync({
                    symbol: item.asset.symbol,
                    name: item.asset.name,
                    type: item.asset.type
                  });
                } catch (error) {
                  console.error("Failed to migrate item:", error);
                }
              })
            );
          })
          .then(() => {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            if (localItems.length > 0) {
              toast({
                title: "Portfolio Synced",
                description: "Your portfolio has been saved to your account",
              });
            }
          })
          .catch(error => {
            console.error("Failed to sync portfolio:", error);
          });
      }
    }
  }, [user]);

  return {
    portfolio,
    addToPortfolio: addToPortfolioMutation.mutate,
    isAddingToPortfolio: addToPortfolioMutation.isPending
  };
}