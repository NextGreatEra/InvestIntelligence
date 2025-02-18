import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, LineChart, Settings, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Markets", href: "/markets", icon: LineChart },
  { name: "Settings", href: "/settings", icon: Settings }
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-border">
      <div className="flex h-14 items-center border-b border-border px-4">
        <h1 className="text-xl font-bold text-sidebar-foreground">Portfolio AI</h1>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {/* User auth status */}
        <div className="px-3 py-2">
          {user ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Welcome, {user.username}
              </p>
              {user.isGuest ? (
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2"
                    onClick={() => window.location.href = '/auth'}
                  >
                    <LogIn className="h-4 w-4" />
                    Create Account
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-2"
                    onClick={() => logoutMutation.mutate()}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out as guest
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </Button>
              )}
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => window.location.href = '/auth'}
            >
              <LogIn className="h-4 w-4" />
              Log in
            </Button>
          )}
        </div>
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}