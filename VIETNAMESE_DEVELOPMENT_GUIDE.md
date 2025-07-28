# Hướng dẫn phát triển với tiếng Việt mặc định

## Mục tiêu
Đảm bảo tất cả component, page và feature mới trong ứng dụng ClaimFlow đều sử dụng tiếng Việt làm ngôn ngữ mặc định.

## Quy tắc bắt buộc

### 1. Sử dụng hệ thống i18n
```typescript
import { useTranslation } from "@/lib/i18n";

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <h1 className="vietnamese-text">{t('page.title')}</h1>
  );
}
```

### 2. Thêm class vietnamese-text
Tất cả text elements phải có class `vietnamese-text`:
```tsx
<h1 className="text-2xl font-bold vietnamese-text">{t('title')}</h1>
<p className="text-muted-foreground vietnamese-text">{t('description')}</p>
<Button className="vietnamese-text">{t('common.submit')}</Button>
<Input placeholder="Nhập thông tin..." className="vietnamese-text" />
```

### 3. Responsive Typography
Sử dụng responsive text classes:
```tsx
<h1 className="text-h1-mobile md:text-h1-desktop vietnamese-text">
<h2 className="text-h2-mobile md:text-h2-desktop vietnamese-text">
<p className="text-body-mobile md:text-body-desktop vietnamese-text">
```

## Templates sẵn có

### Component mới
```typescript
import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

export function NewComponent() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-2xl font-bold vietnamese-text">
          {t('component.title')}
        </h1>
      </div>
    </div>
  );
}
```

### Page mới
```typescript
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function NewPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold vietnamese-text">
              {t('page.title')}
            </h1>
            <Button className="vietnamese-text">
              {t('common.action')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Checklist cho mỗi component

- [ ] Import `useTranslation` từ `@/lib/i18n`
- [ ] Sử dụng `t()` function cho tất cả text
- [ ] Thêm `vietnamese-text` class cho text elements
- [ ] Sử dụng responsive typography classes
- [ ] Placeholder và label đều tiếng Việt
- [ ] Button text tiếng Việt
- [ ] Error messages tiếng Việt
- [ ] Không có hardcoded English text

## Ví dụ đúng vs sai

### ❌ Sai
```tsx
function BadComponent() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Button>Submit</Button>
      <Input placeholder="Enter name" />
    </div>
  );
}
```

### ✅ Đúng
```tsx
function GoodComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1 className="text-2xl font-bold vietnamese-text">
        {t('dashboard.title')}
      </h1>
      <Button className="vietnamese-text">
        {t('common.submit')}
      </Button>
      <Input 
        placeholder="Nhập họ tên" 
        className="vietnamese-text" 
      />
    </div>
  );
}
```

## Thêm translations mới

Khi cần thêm text mới, thêm vào file `client/lib/i18n.ts`:

1. Thêm key vào type `TranslationKey`
2. Thêm bản dịch vào `vietnameseTranslations`

```typescript
// Thêm vào TranslationKey
| 'new.feature.title'
| 'new.feature.description'

// Thêm vào vietnameseTranslations
'new.feature.title': 'Tiêu đề tính năng mới',
'new.feature.description': 'Mô tả tính năng mới',
```

## Quy tắc đặt tên

### Translation keys
- Sử dụng dot notation: `page.section.element`
- Bắt đầu với context: `dashboard.`, `claim.`, `common.`
- Kết thúc với type: `.title`, `.description`, `.button`, `.error`

### CSS Classes
- Luôn có `vietnamese-text` class
- Kết hợp với responsive classes
- Sử dụng design system colors

## Tools hỗ trợ

### Validation function
```typescript
import { validateVietnameseComponent } from "@/lib/component-templates";

const result = validateVietnameseComponent(componentCode);
if (!result.isValid) {
  console.log("Issues:", result.issues);
  console.log("Suggestions:", result.suggestions);
}
```

### Templates
```typescript
import { COMPONENT_TEMPLATE, PAGE_TEMPLATE } from "@/lib/component-templates";
```

## Lưu ý quan trọng

1. **Không bao giờ** hardcode text tiếng Anh
2. **Luôn luôn** sử dụng `useTranslation` hook
3. **Đảm bảo** responsive typography
4. **Kiểm tra** class `vietnamese-text` được thêm
5. **Test** trên mobile và desktop
6. **Review** code trước khi commit

## Hỗ trợ

Nếu có thắc mắc về vietnamese development:
1. Xem file `client/lib/i18n.ts` để hiểu cấu trúc
2. Tham khảo các component đã có như `Dashboard.tsx`, `Index.tsx`
3. Sử dụng validation function để check component
4. Follow checklist để đảm bảo quality

---

**Mục tiêu**: Tất cả user interface phải hiển thị tiếng Việt, tạo trải nghiệm tự nhiên cho người dùng Việt Nam.
