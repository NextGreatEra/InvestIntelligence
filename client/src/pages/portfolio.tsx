import { useState, useCallback, useEffect } from "react"; // Added useEffect
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AssetSearch from "@/components/portfolio/asset-search";
import AssetList from "@/components/portfolio/asset-list";
import AddAssetButton from "@/components/portfolio/add-asset-button"; // Added import

interface Asset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  type: 'stock' | 'crypto';
}

export default function Portfolio() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const { toast } = useToast();
  const [user, setUser] = useState(null); // Added user state
  const [portfolioItemsCount, setPortfolioItemsCount] = useState(0); // Added state to track portfolio items

  const addAssetMutation = useMutation({
    mutationFn: async (data: {
      symbol: string;
      name: string;
      currentPrice: number;
      type: 'stock' | 'crypto';
    }) => {
      console.log('Sending data to server:', data);
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to add asset");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/insight"] });
      setIsDialogOpen(false);
      setSelectedAsset(null);
      toast({
        title: "Success",
        description: "Asset added to portfolio successfully.",
      });
      // Update portfolioItemsCount after successful asset addition
      queryClient.fetchQuery(['/api/portfolio']).then(data => setPortfolioItemsCount(data.length));
    },
    onError: (error: Error) => {
      console.error('Error adding asset:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add asset to portfolio",
        variant: "destructive",
      });
    },
  });

  const handleAssetSelect = useCallback((asset: Asset) => {
    console.log('Selected asset:', asset);
    setSelectedAsset(asset);
  }, []);

  const handleAddAsset = useCallback(async (asset: Asset) => {
    // Create guest user if needed
    if (!user) {
      try {
        const response = await fetch("/api/user?createGuest=true");
        if (!response.ok) {
          throw new Error('Failed to create guest user');
        }
        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error("Error creating guest user:", error);
        toast({
          title: "Error",
          description: "Failed to create guest user",
          variant: "destructive",
        });
        return;
      }
    }
    await addAssetMutation.mutateAsync(asset);
  }, [user, toast, addAssetMutation]);

  useEffect(() => {
    // Fetch user data on mount
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/user?createGuest=false');
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUser();

      //Fetch Portfolio Item Count
    const fetchPortfolioItemCount = async () => {
      try {
        const response = await fetch('/api/portfolio');
        if (response.ok) {
          const data = await response.json();
          setPortfolioItemsCount(data.length);
        }
      } catch (error) {
        console.error('Error fetching portfolio item count', error);
      }
    }
    fetchPortfolioItemCount();
  }, []);


  return (
    <div className="space-y-6">
      <AssetList addAssetButton={<AddAssetButton handleAddAsset={handleAddAsset} handleAssetSelect={handleAssetSelect} portfolioItemsCount={portfolioItemsCount} />} /> {/* Added AddAssetButton prop */}
    </div>
  );
}