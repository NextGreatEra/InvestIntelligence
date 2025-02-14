import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

export function usePortfolio() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: portfolio = [] } = useQuery({
    queryKey: ["/api/portfolio"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      return res.json();
    }
  });

  const addToPortfolioMutation = useMutation({
    mutationFn: async (asset: { symbol: string; name: string; type: string }) => {
      const res = await apiRequest("POST", "/api/portfolio", asset);
      const data = await res.json();
      if (!res.ok) {
        // Check if this is an authentication error
        if (data.code === "AUTH_REQUIRED") {
          toast({
            title: "Account Required",
            description: "Create an account to save your portfolio changes and track your assets across devices!",
            variant: "default"
          });
        }
        throw new Error(data.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
    },
    onError: (error: Error) => {
      if (!error.message.includes("Please create an account")) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  });

  return {
    portfolio,
    addToPortfolio: addToPortfolioMutation.mutate,
    isAddingToPortfolio: addToPortfolioMutation.isPending
  };
}
