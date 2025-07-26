import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Eye, 
  EyeOff,
  UserPlus,
  Settings,
  Download,
  Upload,
  Mail
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'claims_manager' | 'claim_executive' | 'customer' | 'hospital_staff';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: Date;
  createdAt: Date;
  hospital?: string;
  permissions: string[];
  avatar?: string;
  phone?: string;
  department?: string;
}

const roles = {
  admin: { label: 'Quản trị viên', color: 'bg-red-500' },
  claims_manager: { label: 'Quản lý bồi thường', color: 'bg-blue-500' },
  claim_executive: { label: 'Nhân viên xử lý', color: 'bg-green-500' },
  customer: { label: 'Khách hàng', color: 'bg-gray-500' },
  hospital_staff: { label: 'Nhân viên bệnh viện', color: 'bg-purple-500' }
};

const permissions = [
  { id: 'view_claims', name: 'Xem hồ sơ' },
  { id: 'edit_claims', name: 'Chỉnh sửa hồ sơ' },
  { id: 'approve_claims', name: 'Duyệt hồ sơ' },
  { id: 'reject_claims', name: 'Từ chối hồ sơ' },
  { id: 'manage_users', name: 'Quản lý người dùng' },
  { id: 'view_reports', name: 'Xem báo cáo' },
  { id: 'system_config', name: 'Cấu hình hệ thống' },
  { id: 'audit_logs', name: 'Xem audit log' }
];

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);

  // Mock data
  useEffect(() => {
    const mockUsers: User[] = [
      {
        id: '1',
        name: 'Nguyễn Văn Admin',
        email: 'admin@company.com',
        role: 'admin',
        status: 'active',
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        permissions: ['view_claims', 'edit_claims', 'approve_claims', 'manage_users', 'system_config'],
        phone: '0123456789',
        department: 'IT'
      },
      {
        id: '2',
        name: 'Trần Thị Lan',
        email: 'lan.tran@company.com',
        role: 'claims_manager',
        status: 'active',
        lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        permissions: ['view_claims', 'edit_claims', 'approve_claims', 'view_reports'],
        phone: '0987654321',
        department: 'Bồi thường'
      },
      {
        id: '3',
        name: 'Lê Văn Cường',
        email: 'cuong.le@company.com',
        role: 'claim_executive',
        status: 'active',
        lastLogin: new Date(Date.now() - 30 * 60 * 1000),
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        permissions: ['view_claims', 'edit_claims'],
        phone: '0123987654',
        department: 'Xử lý hồ sơ'
      },
      {
        id: '4',
        name: 'Dr. Phạm Minh Đức',
        email: 'duc.pham@bachmai.vn',
        role: 'hospital_staff',
        status: 'active',
        lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        hospital: 'Bệnh viện Bạch Mai',
        permissions: ['view_claims'],
        phone: '0456789123',
        department: 'Khoa Tim mạch'
      }
    ];
    setUsers(mockUsers);
    setFilteredUsers(mockUsers);
  }, []);

  // Filter users
  useEffect(() => {
    let filtered = users.filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
    
    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter, statusFilter]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Hoạt động', variant: 'default' as const, color: 'bg-green-500' },
      inactive: { label: 'Không hoạt động', variant: 'secondary' as const, color: 'bg-gray-500' },
      suspended: { label: 'Tạm khóa', variant: 'destructive' as const, color: 'bg-red-500' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant={config.variant} className="gap-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = roles[role as keyof typeof roles];
    return (
      <Badge variant="outline" className="gap-1">
        <div className={`w-2 h-2 rounded-full ${roleConfig.color}`} />
        {roleConfig.label}
      </Badge>
    );
  };

  const handleStatusToggle = (userId: string, newStatus: string) => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, status: newStatus as any } : user
    ));
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
      setUsers(prev => prev.filter(user => user.id !== userId));
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Quản lý người dùng
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateUser(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Thêm người dùng
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Xuất Excel
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo tên, email, số điện thoại..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả vai trò</SelectItem>
                {Object.entries(roles).map(([key, role]) => (
                  <SelectItem key={key} value={key}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="inactive">Không hoạt động</SelectItem>
                <SelectItem value="suspended">Tạm khóa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Phòng ban</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Lần đăng nhập cuối</TableHead>
                <TableHead>Quyền hạn</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {user.phone && (
                          <p className="text-sm text-muted-foreground">{user.phone}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(user.role)}
                    {user.hospital && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {user.hospital}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{user.department || '-'}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {user.lastLogin.toLocaleDateString('vi-VN')}
                      <br />
                      <span className="text-muted-foreground">
                        {user.lastLogin.toLocaleTimeString('vi-VN')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.slice(0, 2).map((perm) => {
                        const permission = permissions.find(p => p.id === perm);
                        return (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {permission?.name}
                          </Badge>
                        );
                      })}
                      {user.permissions.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{user.permissions.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Chi tiết người dùng</DialogTitle>
                          </DialogHeader>
                          <UserDetailView 
                            user={user} 
                            onStatusChange={handleStatusToggle}
                          />
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={user.status === 'active'}
                        onCheckedChange={(checked) => 
                          handleStatusToggle(user.id, checked ? 'active' : 'inactive')
                        }
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tổng người dùng</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Đang hoạt động</p>
                <p className="text-2xl font-bold text-green-600">
                  {users.filter(u => u.status === 'active').length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Quản trị viên</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
              <Settings className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bệnh viện</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.role === 'hospital_staff').length}
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo người dùng mới</DialogTitle>
          </DialogHeader>
          <CreateUserForm onClose={() => setShowCreateUser(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface UserDetailViewProps {
  user: User;
  onStatusChange: (userId: string, newStatus: string) => void;
}

function UserDetailView({ user, onStatusChange }: UserDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-3">Thông tin cơ bản</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Họ tên:</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Điện thoại:</span>
              <span className="font-medium">{user.phone || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phòng ban:</span>
              <span className="font-medium">{user.department || '-'}</span>
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Thông tin hệ thống</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vai trò:</span>
              <span>{roles[user.role as keyof typeof roles]?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trạng thái:</span>
              <span>{user.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ngày tạo:</span>
              <span>{user.createdAt.toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Đăng nhập cuối:</span>
              <span>{user.lastLogin.toLocaleDateString('vi-VN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div>
        <h3 className="font-semibold mb-3">Quyền hạn</h3>
        <div className="grid grid-cols-2 gap-2">
          {permissions.map((permission) => (
            <div key={permission.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={user.permissions.includes(permission.id)}
                readOnly
              />
              <span className="text-sm">{permission.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button onClick={() => onStatusChange(user.id, 'active')}>
          Kích hoạt
        </Button>
        <Button 
          variant="outline" 
          onClick={() => onStatusChange(user.id, 'suspended')}
        >
          Tạm khóa
        </Button>
        <Button variant="outline">
          Đặt lại mật khẩu
        </Button>
      </div>
    </div>
  );
}

function CreateUserForm({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input placeholder="Họ tên" />
        <Input placeholder="Email" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input placeholder="Số điện thoại" />
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Vai trò" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(roles).map(([key, role]) => (
              <SelectItem key={key} value={key}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input placeholder="Phòng ban" />
      <Input placeholder="Mật khẩu tạm thời" type="password" />
      
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button onClick={onClose}>
          Tạo người dùng
        </Button>
      </div>
    </div>
  );
}
