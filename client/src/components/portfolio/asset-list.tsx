import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Asset } from "@shared/schema";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

interface AssetWithDetails extends Asset {
  holdings: number;
  value: number;
  priceChange24h: number;
}

export default function AssetList() {
  const { data: assets = [], isLoading } = useQuery<AssetWithDetails[]>({
    queryKey: ["/api/portfolio"],
  });

  if (isLoading) {
    return <AssetListSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between p-4 rounded-lg bg-card border"
            >
              <div>
                <h3 className="font-medium">{asset.symbol}</h3>
                <p className="text-sm text-muted-foreground">{asset.name}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  ${Number(asset.currentPrice).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {asset.holdings.toLocaleString()} units
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  ${asset.value.toLocaleString()}
                </p>
                <div className="flex items-center justify-end gap-1">
                  {asset.priceChange24h >= 0 ? (
                    <ArrowUpIcon className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4 text-red-500" />
                  )}
                  <p
                    className={
                      asset.priceChange24h >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  >
                    {Math.abs((asset.priceChange24h / (asset.currentPrice - asset.priceChange24h) * 100)).toFixed(2)}%
                  </p>
                </div>
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