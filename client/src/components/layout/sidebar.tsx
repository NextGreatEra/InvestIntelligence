import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, LineChart, Settings, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Markets", href: "/markets", icon: LineChart },
  { name: "Settings", href: "/settings", icon: Settings }
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-border">
      <div className="flex h-14 items-center border-b border-border px-4">
        <h1 className="text-xl font-bold text-sidebar-foreground">Portfolio AI</h1>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {/* User auth status */}
        <div className="px-3 py-2">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => window.location.href = '/api/login'}
          >
            <LogIn className="h-4 w-4" />
            Log in / Create Account
          </Button>
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