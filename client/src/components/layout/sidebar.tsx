
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, LineChart, Settings, LogIn, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();

  const sidebarContent = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-14 items-center border-b border-border px-4">
        <h1 className="text-xl font-bold text-sidebar-foreground">Portfolio AI</h1>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
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

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-40">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[85vw] p-0">
          {sidebarContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="hidden md:block w-64 border-r border-border">
      {sidebarContent}
    </div>
  );
}
