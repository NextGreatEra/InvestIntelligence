import { useState, useCallback, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Asset } from "@shared/schema";

interface AssetSearchResult {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

interface AssetSearchProps {
  onSelect: (asset: AssetSearchResult) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AssetSearch = ({ onSelect, open, onOpenChange }: AssetSearchProps) => {
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
                      <span className="text-sm">
                        ${typeof asset.current_price === 'number' ? asset.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
                      </span>
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