
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { usePortfolio } from "@/hooks/use-portfolio";

interface InsightResponse {
  message: string;
  sentiment: string;
  disclaimer: string;
}

const personas = {
  "default": "Default Persona",
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

export default function AiCommentary() {
  const { portfolio } = usePortfolio();
  const [selectedPersona, setSelectedPersona] = useState<PersonaKey>(() => {
    const saved = localStorage.getItem('aiCommentaryPersona');
    return (saved as PersonaKey) || "default";
  });

  const { data: insight, isLoading, error, refetch } = useQuery<InsightResponse>({
    queryKey: ["/api/portfolio/insight", selectedPersona],
    queryFn: async () => {
      const timestamp = Date.now();
      const response = await fetch(`/api/portfolio/insight${selectedPersona !== "default" ? `?persona=${selectedPersona}` : ''}&t=${timestamp}`);
      if (!response.ok) {
        throw new Error('Failed to fetch insights');
      }
      return response.json();
    },
    staleTime: 300000, // 5 minutes
    retry: 2,
    enabled: true // Always enabled to ensure insights load for new users
  });

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>AI Commentary</CardTitle>
        <Select
          value={selectedPersona}
          onValueChange={(value: PersonaKey) => {
            setSelectedPersona(value);
            localStorage.setItem('aiCommentaryPersona', value);
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
        ) : error ? (
          <div className="text-destructive">
            <p>Failed to load insights. Trying again...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              {insight?.message ? (
                <p className="text-lg font-medium">{insight.message}</p>
              ) : (
                <p className="text-lg font-medium">Loading insights...</p>
              )}
            </div>
            {insight?.disclaimer && (
              <p className="text-xs text-muted-foreground border-t pt-2">
                {insight.disclaimer}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
