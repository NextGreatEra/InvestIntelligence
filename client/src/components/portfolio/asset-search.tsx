import { useState, useCallback, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Loader2, PlusIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AssetSearchResult {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

interface AssetSearchProps {
  onSelect: (asset: AssetSearchResult) => void;
}

const AssetSearch = ({ onSelect }: AssetSearchProps) => {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

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
  }, [onSelect, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
      </CardHeader>
      <CardContent>
        <Command shouldFilter={false} className="rounded-lg border shadow-md">
          <CommandInput
            placeholder="Search assets... (e.g. Bitcoin, AAPL)"
            value={search}
            onValueChange={setSearch}
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
              <CommandGroup heading="Search Results">
                {results.map((asset) => (
                  <CommandItem
                    key={`${asset.symbol}-${asset.id}`}
                    className="flex justify-between items-center p-4 hover:bg-accent"
                  >
                    <div>
                      <div className="font-medium">{asset.symbol.toUpperCase()}</div>
                      <div className="text-sm text-muted-foreground">{asset.name}</div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium">
                        ${typeof asset.current_price === 'number' 
                          ? asset.current_price.toLocaleString('en-US', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            }) 
                          : 'N/A'}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleSelect(asset)}
                        className="ml-2"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CardContent>
    </Card>
  );
};

export default memo(AssetSearch);