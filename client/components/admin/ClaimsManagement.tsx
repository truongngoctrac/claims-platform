import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Download,
  Upload,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';

interface Claim {
  id: string;
  patientName: string;
  hospitalName: string;
  claimType: string;
  amount: number;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'paid';
  submittedDate: Date;
  lastUpdated: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  progress: number;
  documents: number;
  notes: number;
}

export function ClaimsManagement() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filteredClaims, setFilteredClaims] = useState<Claim[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);

  // Mock data
  useEffect(() => {
    const mockClaims: Claim[] = [
      {
        id: 'HS001234',
        patientName: 'Nguyễn Văn An',
        hospitalName: 'Bệnh viện Bạch Mai',
        claimType: 'Nội trú',
        amount: 15000000,
        status: 'pending',
        submittedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - 1 * 60 * 60 * 1000),
        priority: 'high',
        assignedTo: 'Nguyễn Thị Lan',
        progress: 25,
        documents: 8,
        notes: 3
      },
      {
        id: 'HS001235',
        patientName: 'Trần Thị Bình',
        hospitalName: 'Bệnh viện Chợ Rẫy',
        claimType: 'Cấp cứu',
        amount: 8500000,
        status: 'processing',
        submittedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - 30 * 60 * 1000),
        priority: 'urgent',
        assignedTo: 'Lê Văn Cường',
        progress: 75,
        documents: 12,
        notes: 5
      },
      {
        id: 'HS001236',
        patientName: 'Phạm Minh Đức',
        hospitalName: 'Bệnh viện 108',
        claimType: 'Phẫu thuật',
        amount: 25000000,
        status: 'approved',
        submittedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000),
        priority: 'medium',
        assignedTo: 'Hoàng Thị Mai',
        progress: 100,
        documents: 15,
        notes: 8
      }
    ];
    setClaims(mockClaims);
    setFilteredClaims(mockClaims);
  }, []);

  // Filter claims
  useEffect(() => {
    let filtered = claims.filter(claim => {
      const matchesSearch = 
        claim.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.hospitalName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || claim.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    });
    
    setFilteredClaims(filtered);
  }, [claims, searchTerm, statusFilter, priorityFilter]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Chờ xử lý', variant: 'secondary' as const, color: 'bg-yellow-500' },
      processing: { label: 'Đang xử lý', variant: 'default' as const, color: 'bg-blue-500' },
      approved: { label: 'Đã duyệt', variant: 'default' as const, color: 'bg-green-500' },
      rejected: { label: 'Từ chối', variant: 'destructive' as const, color: 'bg-red-500' },
      paid: { label: 'Đã thanh toán', variant: 'default' as const, color: 'bg-emerald-500' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant={config.variant} className="gap-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: 'Thấp', color: 'text-green-600 bg-green-100' },
      medium: { label: 'Trung bình', color: 'text-yellow-600 bg-yellow-100' },
      high: { label: 'Cao', color: 'text-orange-600 bg-orange-100' },
      urgent: { label: 'Khẩn cấp', color: 'text-red-600 bg-red-100' }
    };
    
    const config = priorityConfig[priority as keyof typeof priorityConfig];
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleBulkAction = (action: string) => {
    console.log(`Bulk action: ${action} for claims:`, bulkSelected);
    // Implement bulk actions
  };

  const handleStatusChange = (claimId: string, newStatus: string) => {
    setClaims(prev => prev.map(claim => 
      claim.id === claimId 
        ? { ...claim, status: newStatus as any, lastUpdated: new Date() }
        : claim
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quản lý hồ sơ bồi thường
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo mã hồ sơ, tên bệnh nhân, bệnh viện..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="pending">Chờ xử lý</SelectItem>
                <SelectItem value="processing">Đang xử lý</SelectItem>
                <SelectItem value="approved">Đã duyệt</SelectItem>
                <SelectItem value="rejected">Từ chối</SelectItem>
                <SelectItem value="paid">Đã thanh toán</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Độ ưu tiên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="urgent">Khẩn cấp</SelectItem>
                <SelectItem value="high">Cao</SelectItem>
                <SelectItem value="medium">Trung bình</SelectItem>
                <SelectItem value="low">Thấp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {bulkSelected.length > 0 && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-muted rounded-lg">
              <span className="text-sm">
                Đã chọn {bulkSelected.length} hồ sơ
              </span>
              <Button size="sm" onClick={() => handleBulkAction('approve')}>
                Duyệt hàng loạt
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('reject')}>
                Từ chối hàng loạt
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('export')}>
                <Download className="h-4 w-4 mr-2" />
                Xuất Excel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={bulkSelected.length === filteredClaims.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBulkSelected(filteredClaims.map(c => c.id));
                      } else {
                        setBulkSelected([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Mã hồ sơ</TableHead>
                <TableHead>Bệnh nhân</TableHead>
                <TableHead>Bệnh viện</TableHead>
                <TableHead>Loại hồ sơ</TableHead>
                <TableHead>Số tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Độ ưu tiên</TableHead>
                <TableHead>Tiến độ</TableHead>
                <TableHead>Phụ trách</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClaims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={bulkSelected.includes(claim.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkSelected([...bulkSelected, claim.id]);
                        } else {
                          setBulkSelected(bulkSelected.filter(id => id !== claim.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{claim.id}</TableCell>
                  <TableCell>{claim.patientName}</TableCell>
                  <TableCell>{claim.hospitalName}</TableCell>
                  <TableCell>{claim.claimType}</TableCell>
                  <TableCell>{claim.amount.toLocaleString('vi-VN')} ₫</TableCell>
                  <TableCell>{getStatusBadge(claim.status)}</TableCell>
                  <TableCell>{getPriorityBadge(claim.priority)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress value={claim.progress} className="h-2" />
                      <span className="text-xs text-muted-foreground">
                        {claim.progress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{claim.assignedTo}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedClaim(claim)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Chi tiết hồ sơ {claim.id}</DialogTitle>
                          </DialogHeader>
                          <ClaimDetailView claim={claim} onStatusChange={handleStatusChange} />
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="h-4 w-4" />
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
                <p className="text-sm text-muted-foreground">Chờ xử lý</p>
                <p className="text-2xl font-bold">
                  {filteredClaims.filter(c => c.status === 'pending').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Đang xử lý</p>
                <p className="text-2xl font-bold">
                  {filteredClaims.filter(c => c.status === 'processing').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Đã duyệt</p>
                <p className="text-2xl font-bold">
                  {filteredClaims.filter(c => c.status === 'approved').length}
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
                <p className="text-sm text-muted-foreground">Từ chối</p>
                <p className="text-2xl font-bold">
                  {filteredClaims.filter(c => c.status === 'rejected').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ClaimDetailViewProps {
  claim: Claim;
  onStatusChange: (claimId: string, newStatus: string) => void;
}

function ClaimDetailView({ claim, onStatusChange }: ClaimDetailViewProps) {
  const [notes, setNotes] = useState('');

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-3">Thông tin cơ bản</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mã hồ sơ:</span>
              <span className="font-medium">{claim.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bệnh nhân:</span>
              <span className="font-medium">{claim.patientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bệnh viện:</span>
              <span className="font-medium">{claim.hospitalName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loại hồ sơ:</span>
              <span className="font-medium">{claim.claimType}</span>
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Thông tin xử lý</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trạng thái:</span>
              <span>{claim.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phụ trách:</span>
              <span className="font-medium">{claim.assignedTo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tiến độ:</span>
              <span className="font-medium">{claim.progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Change */}
      <div>
        <h3 className="font-semibold mb-3">Thay đổi trạng thái</h3>
        <div className="flex gap-2">
          <Select
            value={claim.status}
            onValueChange={(value) => onStatusChange(claim.id, value)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Chờ xử lý</SelectItem>
              <SelectItem value="processing">Đang xử lý</SelectItem>
              <SelectItem value="approved">Đã duyệt</SelectItem>
              <SelectItem value="rejected">Từ chối</SelectItem>
              <SelectItem value="paid">Đã thanh toán</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <h3 className="font-semibold mb-3">Ghi chú xử lý</h3>
        <Textarea
          placeholder="Nhập ghi chú..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
        <Button className="mt-2">Lưu ghi chú</Button>
      </div>
    </div>
  );
}
