import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Loader2 } from "lucide-react";

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

  const { data: results = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets/search", search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const res = await fetch(`/api/assets/search?q=${encodeURIComponent(search)}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to search assets");
      }
      return res.json();
    }
  });

  return (
    <Command className="rounded-lg border shadow-md">
      <CommandInput
        placeholder="Search assets... (e.g. Bitcoin)"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {search.length < 2 ? "Type at least 2 characters to search" : "No results found"}
        </CommandEmpty>
        <CommandGroup heading="Assets">
          {isLoading ? (
            <CommandItem disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </CommandItem>
          ) : (
            results.map((asset) => (
              <CommandItem
                key={asset.id}
                onSelect={() => onSelect(asset)}
                className="flex justify-between items-center"
              >
                <div>
                  <span className="font-medium">{asset.symbol}</span>
                  <span className="ml-2 text-muted-foreground">{asset.name}</span>
                </div>
                <span className="text-sm">
                  ${asset.current_price.toLocaleString()}
                </span>
              </CommandItem>
            ))
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}