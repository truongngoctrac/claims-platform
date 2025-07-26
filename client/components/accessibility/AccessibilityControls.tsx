import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Type, 
  Contrast, 
  Volume2, 
  MousePointer, 
  Keyboard,
  Settings,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAccessibility } from '../../hooks/useAccessibility';

interface AccessibilitySettings {
  fontSize: number;
  lineHeight: number;
  contrast: 'normal' | 'high' | 'higher';
  colorTheme: 'default' | 'monochrome' | 'blue-yellow' | 'green-red';
  animations: boolean;
  soundEffects: boolean;
  voiceNavigation: boolean;
  keyboardNavigation: boolean;
  screenReader: boolean;
  focusIndicator: 'normal' | 'enhanced' | 'high-contrast';
  textSpacing: number;
  cursorSize: 'normal' | 'large' | 'extra-large';
}

export function AccessibilityControls() {
  const { settings, updateSettings, resetSettings } = useAccessibility();
  const [isOpen, setIsOpen] = useState(false);

  const handleSettingChange = (key: keyof AccessibilitySettings, value: any) => {
    updateSettings({ [key]: value });
  };

  const presets = [
    {
      name: 'Thị lực kém',
      description: 'Tăng kích thước font, độ tương phản cao',
      settings: {
        fontSize: 150,
        contrast: 'high' as const,
        focusIndicator: 'enhanced' as const,
        cursorSize: 'large' as const
      }
    },
    {
      name: 'Khó khăn vận động',
      description: 'Tăng kích thước vùng click, điều hướng bàn phím',
      settings: {
        keyboardNavigation: true,
        focusIndicator: 'enhanced' as const,
        cursorSize: 'large' as const
      }
    },
    {
      name: 'Người khiếm thị',
      description: 'Tối ưu cho screen reader, điều hướng giọng nói',
      settings: {
        screenReader: true,
        voiceNavigation: true,
        keyboardNavigation: true,
        soundEffects: true
      }
    }
  ];

  return (
    <>
      {/* Accessibility Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 shadow-lg"
        aria-label="Mở cài đặt trợ năng"
      >
        <Eye className="h-4 w-4 mr-2" />
        Trợ năng
      </Button>

      {/* Accessibility Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Cài đặt trợ năng
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetSettings}
                    aria-label="Đặt lại cài đặt"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    aria-label="Đóng"
                  >
                    ✕
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick Presets */}
              <div>
                <h3 className="font-semibold mb-3">Cài đặt nhanh</h3>
                <div className="grid gap-3">
                  {presets.map((preset, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-3 cursor-pointer hover:bg-muted"
                      onClick={() => updateSettings(preset.settings)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Áp dụng cài đặt ${preset.name}`}
                    >
                      <h4 className="font-medium">{preset.name}</h4>
                      <p className="text-sm text-muted-foreground">{preset.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Font Settings */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Cài đặt chữ
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Kích thước chữ: {settings.fontSize}%
                    </label>
                    <Slider
                      value={[settings.fontSize]}
                      onValueChange={([value]) => handleSettingChange('fontSize', value)}
                      min={75}
                      max={200}
                      step={25}
                      className="w-full"
                      aria-label="Điều chỉnh kích thước chữ"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Khoảng cách dòng: {settings.lineHeight}
                    </label>
                    <Slider
                      value={[settings.lineHeight]}
                      onValueChange={([value]) => handleSettingChange('lineHeight', value)}
                      min={1}
                      max={2}
                      step={0.1}
                      className="w-full"
                      aria-label="Điều chỉnh khoảng cách dòng"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Khoảng cách chữ: {settings.textSpacing}px
                    </label>
                    <Slider
                      value={[settings.textSpacing]}
                      onValueChange={([value]) => handleSettingChange('textSpacing', value)}
                      min={0}
                      max={5}
                      step={0.5}
                      className="w-full"
                      aria-label="Điều chỉnh khoảng cách chữ"
                    />
                  </div>
                </div>
              </div>

              {/* Visual Settings */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Contrast className="h-4 w-4" />
                  Cài đặt hiển thị
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Độ tương phản</label>
                    <Select
                      value={settings.contrast}
                      onValueChange={(value) => handleSettingChange('contrast', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Bình thường</SelectItem>
                        <SelectItem value="high">Cao</SelectItem>
                        <SelectItem value="higher">Rất cao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Bảng màu</label>
                    <Select
                      value={settings.colorTheme}
                      onValueChange={(value) => handleSettingChange('colorTheme', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Mặc định</SelectItem>
                        <SelectItem value="monochrome">Đen trắng</SelectItem>
                        <SelectItem value="blue-yellow">Xanh - Vàng</SelectItem>
                        <SelectItem value="green-red">Xanh - Đỏ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Kích thước con trỏ</label>
                    <Select
                      value={settings.cursorSize}
                      onValueChange={(value) => handleSettingChange('cursorSize', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Bình thường</SelectItem>
                        <SelectItem value="large">Lớn</SelectItem>
                        <SelectItem value="extra-large">Rất lớn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Navigation Settings */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Keyboard className="h-4 w-4" />
                  Điều hướng
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Điều hướng bàn phím</p>
                      <p className="text-sm text-muted-foreground">
                        Sử dụng Tab, Enter, mũi tên để điều hướng
                      </p>
                    </div>
                    <Switch
                      checked={settings.keyboardNavigation}
                      onCheckedChange={(checked) => 
                        handleSettingChange('keyboardNavigation', checked)
                      }
                      aria-label="Bật/tắt điều hướng bàn phím"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Điều hướng giọng nói</p>
                      <p className="text-sm text-muted-foreground">
                        Sử dụng lệnh giọng nói để điều khiển
                      </p>
                    </div>
                    <Switch
                      checked={settings.voiceNavigation}
                      onCheckedChange={(checked) => 
                        handleSettingChange('voiceNavigation', checked)
                      }
                      aria-label="Bật/tắt điều hướng giọng nói"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Chỉ báo focus</label>
                    <Select
                      value={settings.focusIndicator}
                      onValueChange={(value) => handleSettingChange('focusIndicator', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Bình thường</SelectItem>
                        <SelectItem value="enhanced">Nâng cao</SelectItem>
                        <SelectItem value="high-contrast">Tương phản cao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Audio Settings */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Âm thanh
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Hiệu ứng âm thanh</p>
                      <p className="text-sm text-muted-foreground">
                        Phát âm thanh khi thực hiện thao tác
                      </p>
                    </div>
                    <Switch
                      checked={settings.soundEffects}
                      onCheckedChange={(checked) => 
                        handleSettingChange('soundEffects', checked)
                      }
                      aria-label="Bật/tắt hiệu ứng âm thanh"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Screen Reader</p>
                      <p className="text-sm text-muted-foreground">
                        Tối ưu cho phần mềm đọc màn hình
                      </p>
                    </div>
                    <Switch
                      checked={settings.screenReader}
                      onCheckedChange={(checked) => 
                        handleSettingChange('screenReader', checked)
                      }
                      aria-label="Bật/tắt hỗ trợ screen reader"
                    />
                  </div>
                </div>
              </div>

              {/* Motion Settings */}
              <div>
                <h3 className="font-semibold mb-3">Chuyển động</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Hiệu ứng chuyển động</p>
                    <p className="text-sm text-muted-foreground">
                      Bật/tắt hiệu ứng animation
                    </p>
                  </div>
                  <Switch
                    checked={settings.animations}
                    onCheckedChange={(checked) => 
                      handleSettingChange('animations', checked)
                    }
                    aria-label="Bật/tắt hiệu ứng chuyển động"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  className="flex-1"
                  onClick={() => setIsOpen(false)}
                >
                  Áp dụng
                </Button>
                <Button 
                  variant="outline" 
                  onClick={resetSettings}
                  aria-label="Đặt lại tất cả cài đặt"
                >
                  Đặt lại
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
