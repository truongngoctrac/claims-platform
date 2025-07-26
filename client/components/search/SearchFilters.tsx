import React from 'react';
import { Calendar, DollarSign, FileText, Building, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DatePicker } from '../ui/date-picker';
import { Checkbox } from '../ui/checkbox';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';

interface SearchFiltersProps {
  filters: Record<string, any>;
  onChange: (filters: Record<string, any>) => void;
  onSearch: () => void;
}

export function SearchFilters({ filters, onChange, onSearch }: SearchFiltersProps) {
  const updateFilter = (key: string, value: any) => {
    if (value === null || value === undefined || value === '') {
      const newFilters = { ...filters };
      delete newFilters[key];
      onChange(newFilters);
    } else {
      onChange({ ...filters, [key]: value });
    }
  };

  const claimStatuses = [
    { value: 'pending', label: 'Đang xử lý', color: 'bg-yellow-500' },
    { value: 'approved', label: 'Đã duyệt', color: 'bg-green-500' },
    { value: 'rejected', label: 'Từ chối', color: 'bg-red-500' },
    { value: 'processing', label: 'Đang thẩm định', color: 'bg-blue-500' },
    { value: 'paid', label: 'Đã thanh toán', color: 'bg-emerald-500' }
  ];

  const claimTypes = [
    'Khám bệnh',
    'Nội trú',
    'Ngoại trú', 
    'Cấp cứu',
    'Phẫu thuật',
    'Xét nghiệm',
    'Chẩn đoán hình ảnh',
    'Thuốc men'
  ];

  const hospitalTypes = [
    'Bệnh viện công',
    'Bệnh viện tư',
    'Phòng khám',
    'Trung tâm y tế'
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bộ lọc nâng cao</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <label className="text-sm font-medium">Khoảng thời gian</label>
            </div>
            <div className="space-y-2">
              <DatePicker
                placeholder="Từ ngày"
                selected={filters.dateFrom}
                onSelect={(date) => updateFilter('dateFrom', date)}
              />
              <DatePicker
                placeholder="Đến ngày"
                selected={filters.dateTo}
                onSelect={(date) => updateFilter('dateTo', date)}
              />
            </div>
          </div>

          {/* Amount Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <label className="text-sm font-medium">Số tiền bồi thường</label>
            </div>
            <div className="space-y-3">
              <div className="px-2">
                <Slider
                  value={[filters.amountMin || 0, filters.amountMax || 100000000]}
                  onValueChange={([min, max]) => {
                    updateFilter('amountMin', min);
                    updateFilter('amountMax', max);
                  }}
                  max={100000000}
                  step={100000}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Từ"
                  type="number"
                  value={filters.amountMin || ''}
                  onChange={(e) => updateFilter('amountMin', Number(e.target.value))}
                />
                <Input
                  placeholder="Đến"
                  type="number"
                  value={filters.amountMax || ''}
                  onChange={(e) => updateFilter('amountMax', Number(e.target.value))}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {(filters.amountMin || 0).toLocaleString('vi-VN')} - {(filters.amountMax || 100000000).toLocaleString('vi-VN')} VNĐ
              </div>
            </div>
          </div>

          {/* Claim Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <label className="text-sm font-medium">Trạng thái</label>
            </div>
            <div className="space-y-2">
              {claimStatuses.map((status) => (
                <div key={status.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status.value}`}
                    checked={filters.statuses?.includes(status.value) || false}
                    onCheckedChange={(checked) => {
                      const current = filters.statuses || [];
                      if (checked) {
                        updateFilter('statuses', [...current, status.value]);
                      } else {
                        updateFilter('statuses', current.filter((s: string) => s !== status.value));
                      }
                    }}
                  />
                  <label
                    htmlFor={`status-${status.value}`}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                    {status.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Claim Type */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <label className="text-sm font-medium">Loại hồ sơ</label>
            </div>
            <Select
              value={filters.claimType || ''}
              onValueChange={(value) => updateFilter('claimType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn loại hồ sơ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tất cả</SelectItem>
                {claimTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hospital */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <label className="text-sm font-medium">Bệnh viện</label>
            </div>
            <Input
              placeholder="Tên bệnh viện"
              value={filters.hospitalName || ''}
              onChange={(e) => updateFilter('hospitalName', e.target.value)}
            />
            <Select
              value={filters.hospitalType || ''}
              onValueChange={(value) => updateFilter('hospitalType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Loại bệnh viện" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tất cả</SelectItem>
                {hospitalTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Patient Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <label className="text-sm font-medium">Thông tin bệnh nhân</label>
            </div>
            <Input
              placeholder="Tên bệnh nhân"
              value={filters.patientName || ''}
              onChange={(e) => updateFilter('patientName', e.target.value)}
            />
            <Input
              placeholder="Số CCCD/CMND"
              value={filters.patientId || ''}
              onChange={(e) => updateFilter('patientId', e.target.value)}
            />
            <Input
              placeholder="Số thẻ BHYT"
              value={filters.insuranceCard || ''}
              onChange={(e) => updateFilter('insuranceCard', e.target.value)}
            />
          </div>
        </div>

        {/* Advanced Options */}
        <div className="border-t pt-6">
          <h4 className="text-sm font-medium mb-3">Tùy chọn nâng cao</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-documents"
                checked={filters.hasDocuments || false}
                onCheckedChange={(checked) => updateFilter('hasDocuments', checked)}
              />
              <label htmlFor="has-documents" className="text-sm cursor-pointer">
                Có tài liệu đính kèm
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires-review"
                checked={filters.requiresReview || false}
                onCheckedChange={(checked) => updateFilter('requiresReview', checked)}
              />
              <label htmlFor="requires-review" className="text-sm cursor-pointer">
                Cần thẩm định
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="high-priority"
                checked={filters.highPriority || false}
                onCheckedChange={(checked) => updateFilter('highPriority', checked)}
              />
              <label htmlFor="high-priority" className="text-sm cursor-pointer">
                Ưu tiên cao
              </label>
            </div>
          </div>
        </div>

        {/* Filter Summary */}
        {Object.keys(filters).length > 0 && (
          <div className="border-t pt-6">
            <h4 className="text-sm font-medium mb-3">Bộ lọc đang áp dụng</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(filters).map(([key, value]) => (
                <Badge key={key} variant="secondary">
                  {key}: {Array.isArray(value) ? value.join(', ') : value.toString()}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={onSearch} className="flex-1">
            Áp dụng bộ lọc
          </Button>
          <Button
            variant="outline"
            onClick={() => onChange({})}
            className="flex-1"
          >
            Xóa bộ lọc
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
