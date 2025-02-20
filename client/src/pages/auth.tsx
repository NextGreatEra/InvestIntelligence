
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, TrendingUp } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const { loginMutation, registerMutation, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && !user.isGuest) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Only force registration form for guests
  useEffect(() => {
    if (user?.isGuest && isLogin) {
      setIsLogin(false);
    }
  }, [user?.isGuest, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords are identical",
        variant: "destructive",
      });
      return;
    }
    const mutation = isLogin ? loginMutation : registerMutation;
    await mutation.mutateAsync({ username, password, email });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              {user?.isGuest 
                ? "Create Account" 
                : (isLogin ? "Welcome Back" : "Create Account")}
            </CardTitle>
            <CardDescription>
              {user?.isGuest
                ? "Create an account to save your portfolio"
                : (isLogin
                  ? "Sign in to access your portfolio"
                  : "Sign up to start tracking your investments")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </>
              )}
              <Button type="submit" className="w-full">
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin
                  ? "Need an account? Sign up"
                  : "Already have an account? Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Hero Section */}
      <div className="flex-1 bg-primary p-6 flex items-center justify-center text-primary-foreground">
        <div className="max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Portfolio AI
            </h1>
            <p className="mx-auto max-w-[600px] text-gray-200 md:text-xl/relaxed">
              Track your investments with AI-powered insights
            </p>
          </div>
          <div className="grid gap-4 md:gap-8">
            <div className="flex items-center gap-4">
              <LineChart className="h-8 w-8" />
              <div>
                <h3 className="font-bold">Live Market Data</h3>
                <p className="text-gray-200">
                  Real-time prices for stocks and cryptocurrencies
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <TrendingUp className="h-8 w-8" />
              <div>
                <h3 className="font-bold">Smart Analysis</h3>
                <p className="text-gray-200">
                  AI-powered insights to help you make informed decisions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
