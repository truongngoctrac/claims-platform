import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  FileText, 
  Search, 
  BarChart3, 
  Settings, 
  User, 
  Bell,
  Eye,
  Shield,
  HelpCircle,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { AccessibilityControls } from './accessibility/AccessibilityControls';
import { RealTimeNotifications } from './ui/real-time-notifications';
import { useAuth } from '../contexts/AuthContext';

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
  badge?: string;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Trang chủ',
    path: '/',
    icon: <Home className="h-4 w-4" />
  },
  {
    label: 'Nộp hồ sơ',
    path: '/submit-claim',
    icon: <FileText className="h-4 w-4" />
  },
  {
    label: 'Tra cứu hồ sơ',
    path: '/claim-tracking',
    icon: <Search className="h-4 w-4" />
  },
  {
    label: 'Tìm kiếm nâng cao',
    path: '/search',
    icon: <Search className="h-4 w-4" />
  },
  {
    label: 'Bảng điều khiển',
    path: '/dashboard',
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ['admin', 'claims_manager', 'claim_executive']
  },
  {
    label: 'Quản trị Admin',
    path: '/admin',
    icon: <Shield className="h-4 w-4" />,
    roles: ['admin'],
    badge: 'Admin'
  }
];

export function Navigation() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const canAccess = (item: NavigationItem) => {
    if (!item.roles) return true;
    return user?.role && item.roles.includes(user.role);
  };

  const getUserDisplayName = (user: any) => {
    if (!user) return 'Unknown User';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return `${firstName} ${lastName}`.trim() || user.email || 'User';
  };

  const getInitials = (name: string | undefined | null) => {
    if (!name || typeof name !== 'string') {
      return 'U'; // Default fallback for "User"
    }
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-orange-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs sm:text-sm">CF</span>
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900 vietnamese-text">
                    ClaimFlow
                  </h1>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navigationItems.map((item) => (
                canAccess(item) && (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors vietnamese-text ${
                      isActive(item.path)
                        ? 'bg-orange-100 text-orange-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-1 lg:space-x-2">
                      {item.icon}
                      <span className="hidden lg:inline">{item.label}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs vietnamese-text">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  </Link>
                )
              ))}
            </div>

            {/* Right side items */}
            <div className="flex items-center space-x-3">
              {/* Notifications */}
              <RealTimeNotifications />

              {/* Accessibility Controls */}
              <AccessibilityControls />

              {/* User Menu */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} alt={getUserDisplayName(user)} />
                        <AvatarFallback>{getInitials(getUserDisplayName(user))}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex flex-col space-y-1 p-2">
                      <p className="text-sm font-medium leading-none vietnamese-text">{getUserDisplayName(user)}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                      <Badge variant="outline" className="w-fit text-xs mt-1 vietnamese-text">
                        {user.role === 'admin' ? 'Quản trị viên' :
                         user.role === 'claims_manager' ? 'Quản lý bồi thường' :
                         user.role === 'claim_executive' ? 'Nhân viên xử lý' :
                         user.role === 'hospital_staff' ? 'Nhân viên bệnh viện' :
                         'Khách hàng'}
                      </Badge>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer vietnamese-text">
                        <User className="mr-2 h-4 w-4" />
                        <span>Hồ sơ cá nhân</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="cursor-pointer vietnamese-text">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Cài đặt</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="vietnamese-text">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      <span>Hỗ trợ</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="cursor-pointer vietnamese-text">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Đăng xuất</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link to="/login">
                    <Button variant="outline" size="sm" className="vietnamese-text text-xs sm:text-sm">
                      Đăng nhập
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-1.5 sm:p-2"
                >
                  {mobileMenuOpen ? (
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigationItems.map((item) => (
                canAccess(item) && (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`block px-3 py-2 rounded-md text-sm sm:text-base font-medium transition-colors vietnamese-text ${
                      isActive(item.path)
                        ? 'bg-orange-100 text-orange-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center space-x-3">
                      {item.icon}
                      <span>{item.label}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs vietnamese-text">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  </Link>
                )
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Skip Link for Accessibility */}
      <a
        href="#main-content"
        className="skip-link sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-primary text-primary-foreground px-4 py-2 rounded z-50 vietnamese-text"
      >
        Nhảy đến nội dung chính
      </a>
    </>
  );
}
