import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  FileText, 
  Calendar,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { DatePicker } from '../ui/date-picker';

interface AnalyticsData {
  claimsOverTime: Array<{
    date: string;
    submitted: number;
    approved: number;
    rejected: number;
    amount: number;
  }>;
  claimsByStatus: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  claimsByType: Array<{
    type: string;
    count: number;
    amount: number;
  }>;
  hospitalPerformance: Array<{
    hospital: string;
    claims: number;
    approvalRate: number;
    avgTime: number;
  }>;
  kpis: {
    totalClaims: number;
    totalAmount: number;
    avgProcessingTime: number;
    approvalRate: number;
    pendingClaims: number;
    monthlyGrowth: number;
  };
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('claims');

  // Mock data
  useEffect(() => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const mockData: AnalyticsData = {
        claimsOverTime: [
          { date: '2024-01-01', submitted: 120, approved: 85, rejected: 15, amount: 2500000000 },
          { date: '2024-01-02', submitted: 145, approved: 98, rejected: 18, amount: 2800000000 },
          { date: '2024-01-03', submitted: 132, approved: 92, rejected: 12, amount: 2600000000 },
          { date: '2024-01-04', submitted: 158, approved: 108, rejected: 22, amount: 3200000000 },
          { date: '2024-01-05', submitted: 167, approved: 115, rejected: 20, amount: 3500000000 },
          { date: '2024-01-06', submitted: 142, approved: 95, rejected: 17, amount: 2900000000 },
          { date: '2024-01-07', submitted: 138, approved: 89, rejected: 19, amount: 2700000000 }
        ],
        claimsByStatus: [
          { name: 'Đã duyệt', value: 582, color: '#22c55e' },
          { name: 'Chờ xử lý', value: 123, color: '#eab308' },
          { name: 'Đang xử lý', value: 89, color: '#3b82f6' },
          { name: 'Từ chối', value: 45, color: '#ef4444' },
          { name: 'Đã thanh toán', value: 421, color: '#10b981' }
        ],
        claimsByType: [
          { type: 'Nội trú', count: 342, amount: 8500000000 },
          { type: 'Ngo��i trú', count: 567, amount: 3200000000 },
          { type: 'Cấp cứu', count: 123, amount: 2800000000 },
          { type: 'Phẫu thuật', count: 89, amount: 12000000000 },
          { type: 'Xét nghiệm', count: 234, amount: 890000000 }
        ],
        hospitalPerformance: [
          { hospital: 'Bệnh viện Bạch Mai', claims: 245, approvalRate: 92, avgTime: 2.3 },
          { hospital: 'Bệnh viện Chợ Rẫy', claims: 189, approvalRate: 88, avgTime: 2.8 },
          { hospital: 'Bệnh viện 108', claims: 156, approvalRate: 85, avgTime: 3.1 },
          { hospital: 'Bệnh viện K', claims: 134, approvalRate: 90, avgTime: 2.5 },
          { hospital: 'Bệnh viện Việt Đức', claims: 167, approvalRate: 94, avgTime: 2.1 }
        ],
        kpis: {
          totalClaims: 1260,
          totalAmount: 27500000000,
          avgProcessingTime: 2.6,
          approvalRate: 89.2,
          pendingClaims: 123,
          monthlyGrowth: 12.5
        }
      };
      
      setData(mockData);
      setLoading(false);
    }, 1000);
  }, [timeRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  const COLORS = ['#22c55e', '#eab308', '#3b82f6', '#ef4444', '#10b981'];

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Đang tải dữ liệu...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Phân tích & Báo cáo
            </div>
            <div className="flex gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 ngày qua</SelectItem>
                  <SelectItem value="30d">30 ngày qua</SelectItem>
                  <SelectItem value="90d">3 tháng qua</SelectItem>
                  <SelectItem value="1y">1 năm qua</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Xuất báo cáo
              </Button>
              <Button variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Làm mới
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng hồ sơ</p>
                <p className="text-2xl font-bold">{formatNumber(data.kpis.totalClaims)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">
                    +{data.kpis.monthlyGrowth}%
                  </span>
                </div>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng giá trị</p>
                <p className="text-2xl font-bold">{formatCurrency(data.kpis.totalAmount)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">+8.2%</span>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tỷ lệ duyệt</p>
                <p className="text-2xl font-bold">{data.kpis.approvalRate}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">+2.1%</span>
                </div>
              </div>
              <Users className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Thời gian xử lý TB</p>
                <p className="text-2xl font-bold">{data.kpis.avgProcessingTime} ngày</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">-0.3 ngày</span>
                </div>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Claims Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Xu hướng hồ sơ theo thời gian</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.claimsOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('vi-VN')} />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('vi-VN')}
                  formatter={(value, name) => [formatNumber(value as number), name]}
                />
                <Legend />
                <Area type="monotone" dataKey="submitted" stackId="1" stroke="#8884d8" fill="#8884d8" name="Đã nộp" />
                <Area type="monotone" dataKey="approved" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Đã duyệt" />
                <Area type="monotone" dataKey="rejected" stackId="1" stroke="#ffc658" fill="#ffc658" name="Từ chối" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Claims by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Phân bố theo trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.claimsByStatus}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {data.claimsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Claims by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Phân bố theo loại hồ sơ</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.claimsByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip formatter={(value) => formatNumber(value as number)} />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" name="Số lượng" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Hospital Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Hiệu suất bệnh viện</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Bệnh viện</th>
                  <th className="text-right p-2">Số hồ sơ</th>
                  <th className="text-right p-2">Tỷ lệ duyệt</th>
                  <th className="text-right p-2">Thời gian TB</th>
                  <th className="text-right p-2">Đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {data.hospitalPerformance.map((hospital, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2 font-medium">{hospital.hospital}</td>
                    <td className="p-2 text-right">{formatNumber(hospital.claims)}</td>
                    <td className="p-2 text-right">
                      <span className={`font-medium ${
                        hospital.approvalRate >= 90 ? 'text-green-600' :
                        hospital.approvalRate >= 85 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {hospital.approvalRate}%
                      </span>
                    </td>
                    <td className="p-2 text-right">{hospital.avgTime} ngày</td>
                    <td className="p-2 text-right">
                      <Badge 
                        variant={
                          hospital.approvalRate >= 90 ? 'default' :
                          hospital.approvalRate >= 85 ? 'secondary' : 'destructive'
                        }
                      >
                        {hospital.approvalRate >= 90 ? 'Xuất sắc' :
                         hospital.approvalRate >= 85 ? 'Tốt' : 'Cần cải thiện'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Biểu đồ doanh thu</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.claimsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('vi-VN')} />
              <YAxis tickFormatter={(value) => `${(value / 1000000000).toFixed(1)}B`} />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString('vi-VN')}
                formatter={(value) => [formatCurrency(value as number), 'Doanh thu']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="#8884d8" 
                strokeWidth={3}
                name="Doanh thu"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
