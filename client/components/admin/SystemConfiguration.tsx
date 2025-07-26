import React, { useState } from 'react';
import { Settings, Save, RefreshCw, Shield, Bell, Database, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export function SystemConfiguration() {
  const [config, setConfig] = useState({
    general: {
      siteName: 'Hệ thống Bồi thường BHYT',
      timezone: 'Asia/Ho_Chi_Minh',
      language: 'vi-VN',
      maintenanceMode: false,
      debugMode: false
    },
    claims: {
      autoApprovalLimit: 5000000,
      requireManagerApproval: 10000000,
      maxDocumentSize: 10,
      allowedFileTypes: ['pdf', 'jpg', 'png', 'doc', 'docx'],
      processingTimeout: 72
    },
    notifications: {
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      emailProvider: 'smtp',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smsProvider: 'viettel'
    },
    security: {
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      passwordMinLength: 8,
      requireTwoFactor: false,
      ipWhitelist: '',
      rateLimitEnabled: true
    }
  });

  const handleSave = () => {
    console.log('Saving configuration:', config);
    // Implement save logic
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Cấu hình hệ thống
            </div>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Lưu cấu hình
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">Chung</TabsTrigger>
          <TabsTrigger value="claims">Hồ sơ</TabsTrigger>
          <TabsTrigger value="notifications">Thông báo</TabsTrigger>
          <TabsTrigger value="security">Bảo mật</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình chung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tên hệ thống</label>
                  <Input 
                    value={config.general.siteName}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      general: { ...prev.general, siteName: e.target.value }
                    }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Múi giờ</label>
                  <Select 
                    value={config.general.timezone}
                    onValueChange={(value) => setConfig(prev => ({
                      ...prev,
                      general: { ...prev.general, timezone: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Ho_Chi_Minh">Việt Nam (UTC+7)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Chế độ bảo trì</h4>
                  <p className="text-sm text-muted-foreground">Tạm dừng hệ thống để bảo trì</p>
                </div>
                <Switch 
                  checked={config.general.maintenanceMode}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    general: { ...prev.general, maintenanceMode: checked }
                  }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình xử lý hồ sơ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Hạn mức tự động duyệt (VNĐ)</label>
                  <Input 
                    type="number"
                    value={config.claims.autoApprovalLimit}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      claims: { ...prev.claims, autoApprovalLimit: Number(e.target.value) }
                    }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Thời gian xử lý tối đa (giờ)</label>
                  <Input 
                    type="number"
                    value={config.claims.processingTimeout}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      claims: { ...prev.claims, processingTimeout: Number(e.target.value) }
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình thông báo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Email</h4>
                    <p className="text-sm text-muted-foreground">Gửi thông báo qua email</p>
                  </div>
                  <Switch 
                    checked={config.notifications.emailEnabled}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, emailEnabled: checked }
                    }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">SMS</h4>
                    <p className="text-sm text-muted-foreground">Gửi thông báo qua tin nhắn</p>
                  </div>
                  <Switch 
                    checked={config.notifications.smsEnabled}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, smsEnabled: checked }
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình bảo mật</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Thời gian session (phút)</label>
                  <Input 
                    type="number"
                    value={config.security.sessionTimeout}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      security: { ...prev.security, sessionTimeout: Number(e.target.value) }
                    }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Số lần đăng nhập tối đa</label>
                  <Input 
                    type="number"
                    value={config.security.maxLoginAttempts}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      security: { ...prev.security, maxLoginAttempts: Number(e.target.value) }
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
