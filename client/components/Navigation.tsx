import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  BarChart3,
  Settings,
  Bell,
  User,
  LogOut,
  Shield,
  Users,
  ChevronDown,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@shared/auth";

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const getRoleDisplay = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Administrator";
      case UserRole.CLAIMS_MANAGER:
        return "Claims Manager";
      case UserRole.CLAIM_EXECUTIVE:
        return "Claims Executive";
      case UserRole.CUSTOMER:
        return "Customer";
      default:
        return role;
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return "destructive";
      case UserRole.CLAIMS_MANAGER:
        return "default";
      case UserRole.CLAIM_EXECUTIVE:
        return "secondary";
      case UserRole.CUSTOMER:
        return "outline";
      default:
        return "outline";
    }
  };

  const canAccessDashboard =
    user &&
    [
      UserRole.ADMIN,
      UserRole.CLAIMS_MANAGER,
      UserRole.CLAIM_EXECUTIVE,
    ].includes(user.role);

  const canAccessAdmin =
    user && [UserRole.ADMIN, UserRole.CLAIMS_MANAGER].includes(user.role);

  if (!isAuthenticated) {
    return (
      <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6">
          <div className="flex h-16 items-center justify-between">
            <Link
              to="/"
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground font-inter">
                ClaimFlow
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-6 text-sm">
                <a
                  href="#features"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Tính năng
                </a>
                <a
                  href="#process"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Quy trình
                </a>
                <a
                  href="#support"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Hỗ trợ
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="hidden sm:flex">
                  <Phone className="w-4 h-4 mr-2" />
                  1900-xxxx
                </Button>
                <Link to="/login">
                  <Button className="bg-primary hover:bg-primary/90">
                    Đăng nhập
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link
              to="/"
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground font-inter">
                ClaimFlow
              </span>
            </Link>

            <nav className="hidden md:flex items-center space-x-1">
              <Link to="/">
                <Button
                  variant={isActive("/") ? "secondary" : "ghost"}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isActive("/") && "bg-accent text-accent-foreground",
                  )}
                >
                  Trang chủ
                </Button>
              </Link>

              {canAccessDashboard && (
                <Link to="/dashboard">
                  <Button
                    variant={isActive("/dashboard") ? "secondary" : "ghost"}
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isActive("/dashboard") &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Bảng điều khiển
                  </Button>
                </Link>
              )}

              <Link to="/healthcare-claim">
                <Button
                  variant={
                    isActive("/healthcare-claim") ? "secondary" : "ghost"
                  }
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isActive("/healthcare-claim") &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Nộp hồ sơ
                </Button>
              </Link>

              {canAccessAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="text-sm font-medium transition-colors"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Quản trị
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild>
                      <Link to="/admin/users">Quản lý người dùng</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/assignments">Phân công công việc</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/settings">Cài đặt hệ thống</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm">
              <Bell className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium">
                        {user?.firstName} {user?.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <Badge
                          variant={getRoleBadgeVariant(user?.role!)}
                          className="text-xs px-1 py-0"
                        >
                          {getRoleDisplay(user?.role!)}
                        </Badge>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <div className="font-medium">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {user?.email}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Thông tin cá nhân
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Cài đặt
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell className="mr-2 h-4 w-4" />
                  Thông báo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
