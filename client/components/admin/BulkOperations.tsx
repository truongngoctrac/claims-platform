import React, { useState } from 'react';
import { Package, Upload, Download, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export function BulkOperations() {
  const [operations] = useState([
    {
      id: '1',
      type: 'bulk_approve',
      description: 'Duyệt hàng loạt 150 hồ sơ',
      status: 'completed',
      progress: 100,
      startTime: new Date(Date.now() - 30 * 60 * 1000),
      endTime: new Date(Date.now() - 5 * 60 * 1000),
      success: 148,
      failed: 2
    }
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Thao tác hàng loạt
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs defaultValue="operations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="operations">Thao tác</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="operations">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                  <h3 className="font-semibold">Duyệt hàng loạt</h3>
                  <p className="text-sm text-muted-foreground">
                    Duyệt nhiều hồ sơ cùng lúc
                  </p>
                  <Button className="w-full">Bắt đầu</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <XCircle className="h-12 w-12 mx-auto text-red-500" />
                  <h3 className="font-semibold">Từ chối hàng loạt</h3>
                  <p className="text-sm text-muted-foreground">
                    Từ chối nhiều hồ sơ cùng lúc
                  </p>
                  <Button variant="outline" className="w-full">Bắt đầu</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <RefreshCw className="h-12 w-12 mx-auto text-blue-500" />
                  <h3 className="font-semibold">Cập nhật thông tin</h3>
                  <p className="text-sm text-muted-foreground">
                    Cập nhật thông tin hàng loạt
                  </p>
                  <Button variant="outline" className="w-full">Bắt đầu</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lịch sử thao tác</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {operations.map((op) => (
                  <div key={op.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{op.description}</h4>
                      <Badge variant={op.status === 'completed' ? 'default' : 'secondary'}>
                        {op.status === 'completed' ? 'Hoàn thành' : 'Đang xử lý'}
                      </Badge>
                    </div>
                    <Progress value={op.progress} className="mb-2" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Thành công: {op.success} | Lỗi: {op.failed}</span>
                      <span>{op.endTime?.toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle>Import dữ liệu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Tải lên file Excel</h3>
                <p className="text-muted-foreground mb-4">
                  Hỗ trợ file .xlsx, .xls (tối đa 10MB)
                </p>
                <Button>Chọn file</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export dữ liệu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-20">
                  <div className="text-center">
                    <Download className="h-6 w-6 mx-auto mb-2" />
                    <div>Export hồ sơ</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-20">
                  <div className="text-center">
                    <Download className="h-6 w-6 mx-auto mb-2" />
                    <div>Export người dùng</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
