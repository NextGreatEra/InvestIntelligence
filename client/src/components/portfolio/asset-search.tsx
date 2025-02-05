import { useState, useCallback } from "react";
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

export default function AssetSearch({ onSelect }: AssetSearchProps) {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: results = [], isLoading, error } = useQuery<Asset[]>({
    queryKey: ["/api/assets/search", search],
    enabled: search.length >= 2,
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch(`/api/assets/search?q=${encodeURIComponent(search)}`);
        if (!res.ok) {
          throw new Error("Failed to search assets");
        }
        const data = await res.json();
        if (!Array.isArray(data)) {
          return [];
        }
        return data;
      } catch (err) {
        console.error("Search error:", err);
        return [];
      }
    }
  });

  // Handle asset selection with validation
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

  return (
    <Command className="rounded-lg border shadow-md">
      <CommandInput
        placeholder="Search assets... (e.g. Bitcoin)"
        value={search}
        onValueChange={setSearch}
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