import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface InsightResponse {
  message: string;
  sentiment: string;
  disclaimer: string;
}

const personas = {
  "default": "Default Analyst",
  "gen-z": "Gen-Z Finance Bro",
  "boomer": "Traditional Investor",
  "sarcastic-veteran": "Jaded Wall Street Vet",
  "frat-bro": "Finance Gym Bro",
  "doomer": "Doomer Economist",
  "british-banker": "British Banker",
  "stoner-guru": "Chill Market Guru",
  "conspiracy-trader": "Conspiracy Trader",
  "startup-ceo": "Tech Startup CEO",
  "medieval-bard": "Market Bard"
} as const;

type PersonaKey = keyof typeof personas;

export default function AiInsights() {
  const [selectedPersona, setSelectedPersona] = useState<PersonaKey>("default");

  const { data: insight, isLoading, refetch } = useQuery<InsightResponse>({
    queryKey: ["/api/portfolio/insight", selectedPersona],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/insight${selectedPersona !== "default" ? `?persona=${selectedPersona}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      return response.json();
    },
    staleTime: Infinity
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>AI Insights</CardTitle>
        <Select
          value={selectedPersona}
          onValueChange={(value: PersonaKey) => {
            setSelectedPersona(value);
            refetch();
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select style" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(personas).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
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
            {insight?.disclaimer && (
              <p className="text-xs text-muted-foreground mt-4 border-t pt-2">
                {insight.disclaimer}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}