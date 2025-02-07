import AiInsights from "@/components/portfolio/ai-insights";
import AssetList from "@/components/portfolio/asset-list";
import Markets from "@/components/portfolio/markets";
import PriceChart from "@/components/portfolio/price-chart";
import { useQuery } from "@tanstack/react-query";

interface PricePoint {
  timestamp: number;
  price: number;
}

export default function Dashboard() {
  const { data: history = [] } = useQuery<PricePoint[]>({
    queryKey: ["/api/assets/bitcoin/history"],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
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