import { useState, useCallback, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

interface AssetSearchProps {
  onSelect: (asset: Asset) => void;
}

const AssetSearch = memo(({ onSelect }: AssetSearchProps) => {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: results = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets/search", search],
    enabled: search.length >= 2,
    retry: false,
    staleTime: 30000, // Cache results for 30 seconds
    gcTime: 60000, // Keep unused data for 1 minute
    queryFn: async () => {
      try {
        const res = await fetch(`/api/assets/search?q=${encodeURIComponent(search)}`);
        if (!res.ok) {
          throw new Error("Failed to search assets");
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error("Search error:", err);
        return [];
      }
    }
  });

  const handleSelect = useCallback((asset: Asset) => {
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

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  return (
    <Command className="rounded-lg border shadow-md">
      <CommandInput
        placeholder="Search assets... (e.g. Bitcoin)"
        value={search}
        onValueChange={handleSearchChange}
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
        <CommandGroup heading="Assets">
          {results.map((asset) => (
            <CommandItem
              key={asset.id}
              onSelect={() => handleSelect(asset)}
              className="flex justify-between items-center"
            >
              <div>
                <span className="font-medium">{asset.symbol.toUpperCase()}</span>
                <span className="ml-2 text-muted-foreground">{asset.name}</span>
              </div>
              <span className="text-sm">
                ${asset.current_price?.toLocaleString() ?? 'N/A'}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

// Memoize the component to prevent unnecessary re-renders
});

export default AssetSearch;