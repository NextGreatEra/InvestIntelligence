import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type User = {
  id: number;
  username: string;
  createdAt: Date;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: any;
  logoutMutation: any;
  registerMutation: any;
};

type LoginData = {
  username: string;
  password: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user");
      if (res.status === 401) return null; //Explicitly handle 401 Unauthorized
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to fetch user");
      }
      return res.json();
    },
    onError: (err) => {
      // Handle errors during user data fetching.  Could be improved with more specific error handling
      console.error("Error fetching user data:", err);
      toast({ title: "Error", description: "Could not fetch user data", variant: "destructive" });
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: 'include' //Important for session management
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Invalid username or password");
      }
      return res.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
      // Clear user data on login failure
      //This is crucial to avoid stale data issues
    },
    onSuccess: () => {
      window.location.reload();
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Registration failed");
      }
      return res.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      window.location.reload();
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/logout", { method: "POST" });
      if (!res.ok) throw new Error("Logout failed");
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      window.location.reload();
    }
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}