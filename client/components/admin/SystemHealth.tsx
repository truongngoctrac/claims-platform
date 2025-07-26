import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Server, 
  Database, 
  Wifi, 
  HardDrive, 
  Cpu, 
  Memory,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Bell
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  memory: {
    used: number;
    total: number;
    usage: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  disk: {
    used: number;
    total: number;
    usage: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  network: {
    inbound: number;
    outbound: number;
    latency: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  database: {
    connections: number;
    maxConnections: number;
    queryTime: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  services: Array<{
    name: string;
    status: 'running' | 'stopped' | 'error';
    uptime: number;
    lastCheck: Date;
  }>;
  uptime: number;
  lastUpdated: Date;
}

export function SystemHealth() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Mock data
  useEffect(() => {
    const generateMockMetrics = (): SystemMetrics => ({
      cpu: {
        usage: Math.random() * 80 + 10,
        cores: 8,
        temperature: Math.random() * 20 + 50,
        status: Math.random() > 0.8 ? 'warning' : 'healthy'
      },
      memory: {
        used: 12.5,
        total: 32,
        usage: (12.5 / 32) * 100,
        status: Math.random() > 0.9 ? 'warning' : 'healthy'
      },
      disk: {
        used: 450,
        total: 1000,
        usage: 45,
        status: 'healthy'
      },
      network: {
        inbound: Math.random() * 100,
        outbound: Math.random() * 50,
        latency: Math.random() * 50 + 10,
        status: 'healthy'
      },
      database: {
        connections: Math.floor(Math.random() * 50) + 10,
        maxConnections: 100,
        queryTime: Math.random() * 100 + 50,
        status: Math.random() > 0.95 ? 'warning' : 'healthy'
      },
      services: [
        {
          name: 'API Server',
          status: 'running',
          uptime: 2.5,
          lastCheck: new Date()
        },
        {
          name: 'Database',
          status: 'running',
          uptime: 5.2,
          lastCheck: new Date()
        },
        {
          name: 'Redis Cache',
          status: 'running',
          uptime: 3.1,
          lastCheck: new Date()
        },
        {
          name: 'File Storage',
          status: Math.random() > 0.95 ? 'error' : 'running',
          uptime: 1.8,
          lastCheck: new Date()
        },
        {
          name: 'WebSocket Server',
          status: 'running',
          uptime: 4.3,
          lastCheck: new Date()
        }
      ],
      uptime: 15.5,
      lastUpdated: new Date()
    });

    const fetchMetrics = () => {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setMetrics(generateMockMetrics());
        setLoading(false);
      }, 1000);
    };

    fetchMetrics();

    // Auto refresh every 30 seconds
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchMetrics, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'stopped':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatUptime = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    const minutes = Math.floor((hours % 1) * 60);
    
    if (days > 0) {
      return `${days}d ${remainingHours}h ${minutes}m`;
    }
    return `${remainingHours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} TB`;
    }
    return `${bytes} GB`;
  };

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Đang tải thông tin hệ thống...</span>
      </div>
    );
  }

  const overallHealth = metrics.services.every(s => s.status === 'running') &&
    metrics.cpu.status === 'healthy' &&
    metrics.memory.status === 'healthy' &&
    metrics.database.status === 'healthy' ? 'healthy' : 'warning';

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Tình trạng hệ thống
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(overallHealth)}>
                {getStatusIcon(overallHealth)}
                <span className="ml-1">
                  {overallHealth === 'healthy' ? 'Hệ thống ổn định' : 'Có cảnh báo'}
                </span>
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? 'Tự động' : 'Thủ công'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Cập nhật lần cuối: {metrics.lastUpdated.toLocaleString('vi-VN')} •
            Uptime: {formatUptime(metrics.uptime)}
          </div>
        </CardContent>
      </Card>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              CPU
              {getStatusIcon(metrics.cpu.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Sử dụng</span>
                  <span>{metrics.cpu.usage.toFixed(1)}%</span>
                </div>
                <Progress value={metrics.cpu.usage} />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Cores: {metrics.cpu.cores}</div>
                <div>Temperature: {metrics.cpu.temperature.toFixed(1)}°C</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memory */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Memory className="h-4 w-4" />
              Bộ nhớ
              {getStatusIcon(metrics.memory.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Sử dụng</span>
                  <span>{metrics.memory.usage.toFixed(1)}%</span>
                </div>
                <Progress value={metrics.memory.usage} />
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.memory.used} GB / {metrics.memory.total} GB
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disk */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Ổ cứng
              {getStatusIcon(metrics.disk.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Sử dụng</span>
                  <span>{metrics.disk.usage}%</span>
                </div>
                <Progress value={metrics.disk.usage} />
              </div>
              <div className="text-xs text-muted-foreground">
                {formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Network */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Mạng
              {getStatusIcon(metrics.network.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Inbound:</span>
                <span>{metrics.network.inbound.toFixed(1)} MB/s</span>
              </div>
              <div className="flex justify-between">
                <span>Outbound:</span>
                <span>{metrics.network.outbound.toFixed(1)} MB/s</span>
              </div>
              <div className="flex justify-between">
                <span>Latency:</span>
                <span>{metrics.network.latency.toFixed(1)} ms</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cơ sở dữ liệu
            {getStatusIcon(metrics.database.status)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Kết nối</div>
              <div className="text-2xl font-bold">
                {metrics.database.connections}/{metrics.database.maxConnections}
              </div>
              <Progress 
                value={(metrics.database.connections / metrics.database.maxConnections) * 100} 
                className="mt-2"
              />
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Thời gian truy vấn TB</div>
              <div className="text-2xl font-bold">{metrics.database.queryTime.toFixed(1)} ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Trạng thái</div>
              <Badge className={getStatusColor(metrics.database.status)}>
                {metrics.database.status === 'healthy' ? 'Bình thường' : 'Cảnh báo'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Trạng thái dịch vụ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.services.map((service, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{service.name}</h4>
                  {getStatusIcon(service.status)}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Trạng thái:</span>
                    <Badge variant="outline" className={getStatusColor(service.status)}>
                      {service.status === 'running' ? 'Hoạt động' : 
                       service.status === 'stopped' ? 'Dừng' : 'Lỗi'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Uptime:</span>
                    <span>{formatUptime(service.uptime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kiểm tra cuối:</span>
                    <span>{service.lastCheck.toLocaleTimeString('vi-VN')}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {metrics.services.some(s => s.status === 'error') && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Có dịch vụ đang gặp sự cố. Vui lòng kiểm tra và khắc phục.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
