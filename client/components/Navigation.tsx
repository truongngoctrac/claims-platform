import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Settings, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">
                ClaimFlow
              </span>
            </Link>

            <nav className="hidden md:flex items-center space-x-1">
              <Link to="/">
                <Button
                  variant={isActive("/") ? "secondary" : "ghost"}
                  className={cn(
                    "text-sm font-medium",
                    isActive("/") && "bg-accent text-accent-foreground",
                  )}
                >
                  Overview
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button
                  variant={isActive("/dashboard") ? "secondary" : "ghost"}
                  className={cn(
                    "text-sm font-medium",
                    isActive("/dashboard") &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link to="/submit">
                <Button
                  variant={isActive("/submit") ? "secondary" : "ghost"}
                  className={cn(
                    "text-sm font-medium",
                    isActive("/submit") && "bg-accent text-accent-foreground",
                  )}
                >
                  Submit Claim
                </Button>
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <User className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Account</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
