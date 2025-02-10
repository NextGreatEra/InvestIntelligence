import AiInsights from "@/components/portfolio/ai-insights";
import AssetList from "@/components/portfolio/asset-list";
import Markets from "@/components/portfolio/markets";
import PriceChart from "@/components/portfolio/price-chart";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface PricePoint {
  timestamp: number;
  price: number;
}

export default function Dashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: history = [] } = useQuery<PricePoint[]>({
    queryKey: ["/api/assets/bitcoin/history"],
  });

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetch('/api/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Invalidate queries to refetch fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/markets"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/portfolio/insight"] })
      ]);
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Updating...' : 'Update'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <AssetList />
        <Markets />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <AiInsights />
        {history.length > 0 && (
          <PriceChart data={history} symbol="BTC" />
        )}
      </div>
    </div>
  );
}