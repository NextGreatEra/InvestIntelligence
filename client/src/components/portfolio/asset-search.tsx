import { useState, useCallback, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface AssetSearchResult {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  percent_change_1h?: number;
  percent_change_24h?: number;
  percent_change_7d?: number;
}

interface AssetSearchProps {
  onSelect: (asset: AssetSearchResult) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AssetSearch = ({ onSelect, open, onOpenChange }: AssetSearchProps) => {
  const [search, setSearch] = useState("");
  const [metricIndex, setMetricIndex] = useState(0);
  const { toast } = useToast();

  const metrics = ['1h', '24h', '7d'];
  const currentMetric = metrics[metricIndex];

  const { data: results = [], isLoading } = useQuery<AssetSearchResult[]>({
    queryKey: ["/api/assets/search", search],
    enabled: search.length >= 2,
    queryFn: async () => {
      try {
        const res = await fetch(`/api/assets/search?q=${encodeURIComponent(search)}`);
        const data = await res.json();

        if (!res.ok) {
          toast({
            title: "Search Error",
            description: data.message || "Failed to search assets",
            variant: "destructive",
          });
          return [];
        }

        return Array.isArray(data) ? data : [];
      } catch (err) {
        toast({
          title: "Search Error",
          description: "Failed to connect to search service",
          variant: "destructive",
        });
        return [];
      }
    }
  });

  const handleMetricClick = useCallback(() => {
    setMetricIndex((prev) => (prev + 1) % metrics.length);
  }, []);

  const getPercentChange = (asset: AssetSearchResult): number | null => {
    switch(currentMetric) {
      case '1h':
        return asset.percent_change_1h ?? null;
      case '24h':
        return asset.percent_change_24h ?? null;
      case '7d':
        return asset.percent_change_7d ?? null;
      default:
        return null;
    }
  };

  const handleSelect = useCallback((asset: AssetSearchResult) => {
    if (!asset.current_price) {
      toast({
        title: "Error",
        description: "Price information is missing",
        variant: "destructive",
      });
      return;
    }
    onSelect(asset);
    onOpenChange(false);
    setSearch(""); // Reset search when an asset is selected
  }, [onSelect, toast, onOpenChange]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Asset to Portfolio</DialogTitle>
          <DialogDescription>
            Search for a cryptocurrency by name or symbol to add it to your portfolio.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <Command shouldFilter={false} className="rounded-lg border shadow-md">
            <CommandInput
              placeholder="Search assets... (e.g. Bitcoin)"
              value={search}
              onValueChange={handleSearchChange}
              className="border-none focus:ring-0"
            />
            <CommandList>
              <CommandEmpty>
                {search.length < 2 ? (
                  "Type at least 2 characters to search"
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Searching...
                  </div>
                ) : (
                  "No results found"
                )}
              </CommandEmpty>
              {results.length > 0 && (
                <CommandGroup heading="Assets">
                  {results.map((asset) => (
                    <CommandItem
                      key={`${asset.symbol}-${asset.id}`}
                      onSelect={() => handleSelect(asset)}
                      className="flex justify-between items-center"
                    >
                      <div>
                        <span className="font-medium">{asset.symbol.toUpperCase()}</span>
                        <span className="ml-2 text-muted-foreground">{asset.name}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm">
                          ${typeof asset.current_price === 'number' ? 
                            asset.current_price.toLocaleString('en-US', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            }) : 'N/A'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMetricClick();
                          }}
                          className="px-2 py-1 text-xs rounded hover:bg-accent"
                        >
                          {(() => {
                            const change = getPercentChange(asset);
                            if (change === null) {
                              return <span className="text-muted">N/A ({currentMetric})</span>;
                            }
                            return (
                              <span className={change >= 0 ? "text-green-500" : "text-red-500"}>
                                {change.toFixed(2)}% ({currentMetric})
                              </span>
                            );
                          })()}
                        </button>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default memo(AssetSearch);