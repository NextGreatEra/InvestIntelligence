import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface InsightResponse {
  message: string;
  sentiment: string;
}

export default function AiInsights() {
  const { data: insight, isLoading } = useQuery<InsightResponse>({
    queryKey: ["/api/portfolio/insight"],
    refetchInterval: 60000 // Refresh every minute
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Insights</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-lg font-medium">{insight?.message}</p>
            <p className={`text-sm ${
              insight?.sentiment === 'positive' ? 'text-green-500' :
              insight?.sentiment === 'negative' ? 'text-red-500' :
              'text-muted-foreground'
            }`}>
              Market Sentiment: {insight?.sentiment}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}