
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpIcon, ArrowDownIcon, Loader2 } from "lucide-react";

interface MarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
}

export default function Markets() {
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

  const cryptoSymbols = ['BTC', 'ETH'];
  const stockSymbols = ['SPY', 'QQQ'];

  const cryptoMarkets = markets.filter(m => cryptoSymbols.includes(m.symbol));
  const stockMarkets = markets.filter(m => stockSymbols.includes(m.symbol));

  const MarketSection = ({ title, data }: { title: string; data: MarketData[] }) => (
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
              <div className="flex items-center gap-1">
                {market.price_change_percentage_24h >= 0 ? (
                  <ArrowUpIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4 text-red-500" />
                )}
                <p
                  className={
                    market.price_change_percentage_24h >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  }
                >
                  {Math.abs(market.price_change_percentage_24h).toFixed(2)}%
                </p>
              </div>
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
        <MarketSection title="Crypto" data={cryptoMarkets} />
        <MarketSection title="Stocks" data={stockMarkets} />
      </CardContent>
    </Card>
  );
}
