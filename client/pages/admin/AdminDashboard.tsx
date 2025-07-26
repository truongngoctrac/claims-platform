import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Settings, 
  Shield, 
  Bell,
  Download,
  Activity,
  Database,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ClaimsManagement } from '../../components/admin/ClaimsManagement';
import { UserManagement } from '../../components/admin/UserManagement';
import { AuditLog } from '../../components/admin/AuditLog';
import { SystemHealth } from '../../components/admin/SystemHealth';
import { AnalyticsDashboard } from '../../components/admin/AnalyticsDashboard';
import { SystemConfiguration } from '../../components/admin/SystemConfiguration';
import { NotificationManagement } from '../../components/admin/NotificationManagement';
import { BulkOperations } from '../../components/admin/BulkOperations';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemStats, setSystemStats] = useState({
    totalClaims: 12543,
    pendingClaims: 234,
    totalUsers: 1234,
    activeUsers: 856,
    systemHealth: 98.5,
    todayRevenue: 15600000,
    processingTime: 2.3,
    errorRate: 0.02
  });

  const [recentActivity, setRecentActivity] = useState([
    {
      id: '1',
      type: 'claim_approved',
      message: 'Hồ sơ #HS001234 đã được duyệt',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      user: 'Nguyễn Thị Lan'
    },
    {
      id: '2',
      type: 'user_created',
      message: 'Tài khoản mới được tạo cho bệnh viện ABC',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      user: 'Hệ thống'
    },
    {
      id: '3',
      type: 'system_alert',
      message: 'Cảnh báo: Tải hệ thống cao (85%)',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      user: 'Monitor'
    }
  ]);

  const quickActions = [
    {
      title: 'Xử lý hồ sơ cấp bách',
      description: '23 hồ sơ cần xử lý ngay',
      icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
      action: () => setActiveTab('claims'),
      urgent: true
    },
    {
      title: 'Tạo báo cáo tuần',
      description: 'Báo cáo hoạt động tuần này',
      icon: <FileText className="h-6 w-6 text-blue-500" />,
      action: () => setActiveTab('analytics'),
      urgent: false
    },
    {
      title: 'Cập nhật cấu hình',
      description: 'Cấu hình hệ thống cần review',
      icon: <Settings className="h-6 w-6 text-green-500" />,
      action: () => setActiveTab('system'),
      urgent: false
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'claim_approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'user_created':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'system_alert':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bảng điều khiển Admin</h1>
          <p className="text-muted-foreground">
            Quản lý hệ thống bồi thường bảo hiểm y tế
          </p>
        </div>
        <div className="flex gap-2">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                systemStats.systemHealth > 95 ? 'bg-green-500' : 
                systemStats.systemHealth > 90 ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-sm font-medium">
                Hệ thống: {systemStats.systemHealth}%
              </span>
            </div>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="claims">Hồ sơ</TabsTrigger>
          <TabsTrigger value="users">Người dùng</TabsTrigger>
          <TabsTrigger value="analytics">Phân tích</TabsTrigger>
          <TabsTrigger value="system">Hệ thống</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="notifications">Thông báo</TabsTrigger>
          <TabsTrigger value="operations">Thao tác</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tổng hồ sơ</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats.totalClaims.toLocaleString('vi-VN')}</div>
                <p className="text-xs text-muted-foreground">
                  +12% so với tháng trước
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chờ xử lý</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {systemStats.pendingClaims}
                </div>
                <p className="text-xs text-muted-foreground">
                  -5% so với hôm qua
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Người dùng hoạt động</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats.activeUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {((systemStats.activeUsers / systemStats.totalUsers) * 100).toFixed(1)}% tổng số
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Doanh thu hôm nay</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {systemStats.todayRevenue.toLocaleString('vi-VN')} ₫
                </div>
                <p className="text-xs text-muted-foreground">
                  +8% so với hôm qua
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Thao tác nhanh</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quickActions.map((action, index) => (
                  <Card 
                    key={index}
                    className={`cursor-pointer transition-colors hover:bg-muted ${
                      action.urgent ? 'border-red-200 bg-red-50' : ''
                    }`}
                    onClick={action.action}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {action.icon}
                        <div className="flex-1">
                          <h4 className="font-medium">{action.title}</h4>
                          <p className="text-sm text-muted-foreground">{action.description}</p>
                        </div>
                        {action.urgent && (
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Hoạt động gần đây
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      {getActivityIcon(activity.type)}
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{activity.message}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{activity.user}</span>
                          <span>•</span>
                          <span>{activity.timestamp.toLocaleTimeString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Hiệu suất hệ thống
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Thời gian xử lý trung bình</span>
                    <span className="font-medium">{systemStats.processingTime}s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tỷ lệ lỗi</span>
                    <span className="font-medium text-green-600">
                      {(systemStats.errorRate * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Độ khả dụng</span>
                    <span className="font-medium text-green-600">
                      {systemStats.systemHealth}%
                    </span>
                  </div>
                  <div className="pt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${systemStats.systemHealth}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="claims">
          <ClaimsManagement />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="system">
          <SystemConfiguration />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationManagement />
        </TabsContent>

        <TabsContent value="operations">
          <BulkOperations />
        </TabsContent>
      </Tabs>
    </div>
  );
}
