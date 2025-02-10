import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpIcon, ArrowDownIcon, Loader2 } from "lucide-react";

interface MarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  percent_change_1h?: number | null;
  percent_change_24h?: number | null;
  percent_change_7d?: number | null;
  type?: 'crypto' | 'stock';
}

export default function Markets() {
  const [metricIndex, setMetricIndex] = useState(0);
  const metrics = ['1h', '24h', '7d'];
  const currentMetric = metrics[metricIndex];

  const { data: markets = [], isLoading } = useQuery<MarketData[]>({
    queryKey: ["/api/markets"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Markets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const cryptoSymbols = ['ETH', 'BTC'];
  const stockSymbols = ['SPY', 'QQQ'];

  const cryptoMarkets = markets.filter(m => cryptoSymbols.includes(m.symbol));
  const stockMarkets = markets.filter(m => stockSymbols.includes(m.symbol));

  const getPercentChange = (market: MarketData): number | null => {
    if (market.type === 'stock') {
      return market.percent_change_24h || null;
    }

    switch(currentMetric) {
      case '1h':
        return market.percent_change_1h ?? null;
      case '24h':
        return market.percent_change_24h ?? null;
      case '7d':
        return market.percent_change_7d ?? null;
      default:
        return null;
    }
  };

  const MarketSection = ({ title, data, showMetrics = false }: { title: string; data: MarketData[]; showMetrics?: boolean }) => (
    <div>
      <h3 className="font-medium mb-4">{title}</h3>
      <div className="space-y-4">
        {data.map((market) => (
          <div
            key={market.id}
            className="flex items-center justify-between p-4 rounded-lg bg-card border"
          >
            <div>
              <h3 className="font-medium">{market.symbol}</h3>
              <p className="text-sm text-muted-foreground">{market.name}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">
                ${market.current_price.toLocaleString()}
              </p>
              {showMetrics ? (
                <button
                  onClick={() => setMetricIndex((prev) => (prev + 1) % metrics.length)}
                  className="flex items-center gap-1 hover:bg-accent px-2 py-1 rounded"
                >
                  {(() => {
                    const change = getPercentChange(market);
                    if (change === null) {
                      return <span className="text-muted">N/A ({currentMetric})</span>;
                    }
                    return (
                      <>
                        {change >= 0 ? (
                          <ArrowUpIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownIcon className="h-4 w-4 text-red-500" />
                        )}
                        <p className={change >= 0 ? "text-green-500" : "text-red-500"}>
                          {Math.abs(change).toFixed(2)}% ({currentMetric})
                        </p>
                      </>
                    );
                  })()}
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  {(() => {
                    const change = market.percent_change_24h ?? null;
                    if (change === null) {
                      return <span className="text-muted">N/A (24h)</span>;
                    }
                    return (
                      <>
                        {change >= 0 ? (
                          <ArrowUpIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownIcon className="h-4 w-4 text-red-500" />
                        )}
                        <p className={change >= 0 ? "text-green-500" : "text-red-500"}>
                          {Math.abs(change).toFixed(2)}%
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Markets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <MarketSection title="Crypto" data={cryptoMarkets} showMetrics={true} />
        <MarketSection title="Stocks" data={stockMarkets} />
      </CardContent>
    </Card>
  );
}