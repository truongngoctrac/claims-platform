import React, { useState } from 'react';
import { Bell, Send, Users, Settings, Eye, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export function NotificationManagement() {
  const [notifications] = useState([
    {
      id: '1',
      title: 'Hồ sơ cần xử lý khẩn cấp',
      message: 'Có 15 hồ sơ cần xử lý trong 24h tới',
      type: 'urgent',
      recipients: 'claims_managers',
      status: 'sent',
      sentAt: new Date(),
      readCount: 12,
      totalRecipients: 15
    }
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Quản lý thông báo
            </div>
            <Button>
              <Send className="h-4 w-4 mr-2" />
              Gửi thông báo mới
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs defaultValue="send" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send">Gửi thông báo</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
          <TabsTrigger value="templates">Mẫu thông báo</TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle>Tạo thông báo mới</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tiêu đề</label>
                  <Input placeholder="Nhập tiêu đề thông báo" />
                </div>
                <div>
                  <label className="text-sm font-medium">Loại thông báo</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn loại" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Thông tin</SelectItem>
                      <SelectItem value="warning">Cảnh báo</SelectItem>
                      <SelectItem value="urgent">Khẩn cấp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Đối tượng nhận</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn đối tượng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả người dùng</SelectItem>
                    <SelectItem value="admins">Quản trị viên</SelectItem>
                    <SelectItem value="claims_managers">Quản lý bồi thường</SelectItem>
                    <SelectItem value="hospital_staff">Nhân viên bệnh viện</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Nội dung</label>
                <Textarea placeholder="Nhập nội dung thông báo" rows={4} />
              </div>
              <Button>Gửi thông báo</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Đối tượng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Thời gian gửi</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell className="font-medium">{notification.title}</TableCell>
                      <TableCell>
                        <Badge variant={notification.type === 'urgent' ? 'destructive' : 'default'}>
                          {notification.type === 'urgent' ? 'Khẩn cấp' : 'Thông tin'}
                        </Badge>
                      </TableCell>
                      <TableCell>{notification.recipients}</TableCell>
                      <TableCell>
                        <Badge variant="default">Đã gửi</Badge>
                      </TableCell>
                      <TableCell>{notification.sentAt.toLocaleString('vi-VN')}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Mẫu thông báo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Tính năng đang phát triển...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
