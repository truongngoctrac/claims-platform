import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  Calendar, 
  User, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DatePicker } from '../ui/date-picker';

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failed' | 'warning';
  metadata?: Record<string, any>;
}

export function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);

  // Mock data
  useEffect(() => {
    const mockLogs: AuditLogEntry[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        userId: 'admin1',
        userName: 'Nguyễn Văn Admin',
        action: 'UPDATE_CLAIM_STATUS',
        resource: 'claim',
        resourceId: 'HS001234',
        details: 'Thay đổi trạng thái từ "pending" thành "approved"',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        result: 'success',
        metadata: { oldStatus: 'pending', newStatus: 'approved', amount: 15000000 }
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        userId: 'manager1',
        userName: 'Trần Thị Lan',
        action: 'CREATE_USER',
        resource: 'user',
        resourceId: 'user123',
        details: 'Tạo tài khoản mới cho Dr. Phạm Minh Đức',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        result: 'success',
        metadata: { role: 'hospital_staff', hospital: 'Bệnh viện Bạch Mai' }
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        userId: 'exec1',
        userName: 'Lê Văn Cường',
        action: 'LOGIN_FAILED',
        resource: 'authentication',
        resourceId: 'login',
        details: 'Đăng nhập thất bại - sai mật khẩu',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        result: 'failed',
        metadata: { reason: 'invalid_password', attempts: 3 }
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        userId: 'admin1',
        userName: 'Nguyễn Văn Admin',
        action: 'DELETE_DOCUMENT',
        resource: 'document',
        resourceId: 'doc456',
        details: 'Xóa tài liệu "Hóa đơn viện phí"',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        result: 'warning',
        metadata: { claimId: 'HS001235', documentType: 'invoice' }
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        userId: 'hospital1',
        userName: 'Dr. Phạm Minh Đức',
        action: 'SUBMIT_CLAIM',
        resource: 'claim',
        resourceId: 'HS001236',
        details: 'Nộp hồ sơ bồi thường mới',
        ipAddress: '192.168.2.50',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        result: 'success',
        metadata: { claimType: 'outpatient', amount: 2500000, documents: 5 }
      }
    ];
    
    setLogs(mockLogs);
    setFilteredLogs(mockLogs);
  }, []);

  // Filter logs
  useEffect(() => {
    let filtered = logs.filter(log => {
      const matchesSearch = 
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resourceId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesAction = actionFilter === 'all' || log.action.includes(actionFilter);
      const matchesResult = resultFilter === 'all' || log.result === resultFilter;
      const matchesUser = userFilter === 'all' || log.userId === userFilter;
      
      const matchesDateFrom = !dateFrom || log.timestamp >= dateFrom;
      const matchesDateTo = !dateTo || log.timestamp <= dateTo;
      
      return matchesSearch && matchesAction && matchesResult && matchesUser && 
             matchesDateFrom && matchesDateTo;
    });
    
    setFilteredLogs(filtered);
  }, [logs, searchTerm, actionFilter, resultFilter, userFilter, dateFrom, dateTo]);

  const getResultBadge = (result: string) => {
    const resultConfig = {
      success: { label: 'Thành công', variant: 'default' as const, color: 'bg-green-500' },
      failed: { label: 'Thất bại', variant: 'destructive' as const, color: 'bg-red-500' },
      warning: { label: 'Cảnh báo', variant: 'secondary' as const, color: 'bg-yellow-500' }
    };
    
    const config = resultConfig[result as keyof typeof resultConfig];
    return (
      <Badge variant={config.variant} className="gap-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  const getActionIcon = (action: string) => {
    if (action.includes('LOGIN')) return <User className="h-4 w-4 text-blue-500" />;
    if (action.includes('CREATE')) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (action.includes('DELETE')) return <XCircle className="h-4 w-4 text-red-500" />;
    if (action.includes('UPDATE')) return <Activity className="h-4 w-4 text-orange-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const exportLogs = () => {
    // Implementation for exporting audit logs
    console.log('Exporting audit logs...', filteredLogs);
  };

  const refreshLogs = () => {
    setLoading(true);
    // Simulate refresh
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const uniqueUsers = Array.from(new Set(logs.map(log => log.userId)))
    .map(userId => {
      const log = logs.find(l => l.userId === userId);
      return { id: userId, name: log?.userName || userId };
    });

  const actionTypes = [
    { value: 'LOGIN', label: 'Đăng nhập' },
    { value: 'UPDATE', label: 'Cập nh���t' },
    { value: 'CREATE', label: 'Tạo mới' },
    { value: 'DELETE', label: 'Xóa' },
    { value: 'SUBMIT', label: 'Nộp' },
    { value: 'APPROVE', label: 'Duyệt' },
    { value: 'REJECT', label: 'Từ chối' }
  ];

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Nhật ký hoạt động hệ thống
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={refreshLogs} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
              <Button variant="outline" onClick={exportLogs}>
                <Download className="h-4 w-4 mr-2" />
                Xuất Excel
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Basic Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo người dùng, hành động, chi tiết..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Loại hành động" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả hành động</SelectItem>
                {actionTypes.map((action) => (
                  <SelectItem key={action.value} value={action.value}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Kết quả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="success">Thành công</SelectItem>
                <SelectItem value="failed">Thất bại</SelectItem>
                <SelectItem value="warning">Cảnh báo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Người dùng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả người dùng</SelectItem>
                {uniqueUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePicker
              placeholder="Từ ngày"
              selected={dateFrom}
              onSelect={setDateFrom}
            />
            <DatePicker
              placeholder="Đến ngày"
              selected={dateTo}
              onSelect={setDateTo}
            />
          </div>

          {/* Filter Summary */}
          {(searchTerm || actionFilter !== 'all' || resultFilter !== 'all' || 
            userFilter !== 'all' || dateFrom || dateTo) && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Hiển thị {filteredLogs.length} / {logs.length} bản ghi
                </span>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm('');
                    setActionFilter('all');
                    setResultFilter('all');
                    setUserFilter('all');
                    setDateFrom(undefined);
                    setDateTo(undefined);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Hành động</TableHead>
                  <TableHead>T��i nguyên</TableHead>
                  <TableHead>Chi tiết</TableHead>
                  <TableHead>Kết quả</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm">
                        {log.timestamp.toLocaleDateString('vi-VN')}
                        <br />
                        <span className="text-muted-foreground">
                          {log.timestamp.toLocaleTimeString('vi-VN')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{log.userName}</p>
                          <p className="text-xs text-muted-foreground">{log.userId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="font-medium">{log.action}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.resource}</p>
                        <p className="text-xs text-muted-foreground">{log.resourceId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={log.details}>
                        {log.details}
                      </div>
                    </TableCell>
                    <TableCell>{getResultBadge(log.result)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ipAddress}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tổng hoạt động</p>
                <p className="text-2xl font-bold">{logs.length}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Thành công</p>
                <p className="text-2xl font-bold text-green-600">
                  {logs.filter(l => l.result === 'success').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Thất bại</p>
                <p className="text-2xl font-bold text-red-600">
                  {logs.filter(l => l.result === 'failed').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cảnh báo</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {logs.filter(l => l.result === 'warning').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
