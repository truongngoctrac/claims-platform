# Quy tắc tiếng Việt mặc định cho ClaimFlow

## Tổng quan
ClaimFlow được thiết kế cho thị trường Việt Nam, do đó **tiếng Việt là ngôn ngữ mặc định** cho toàn bộ ứng dụng.

## Quy tắc bắt buộc

### 1. Mọi component mới phải sử dụng tiếng Việt
- Import và sử dụng `useTranslation` từ `@/lib/i18n`
- Thêm class `vietnamese-text` cho tất cả text elements
- Không hardcode text tiếng Anh

### 2. Hệ thống i18n
File `client/lib/i18n.ts` chứa:
- Type definitions cho translation keys
- Bản dịch tiếng Việt đầy đủ
- Hook `useTranslation()` để sử dụng

### 3. CSS Classes
- `vietnamese-text`: Class bắt buộc cho tất cả text
- Responsive typography: `text-h1-mobile md:text-h1-desktop`
- Design system colors từ `tailwind.config.ts`

### 4. Component structure
```typescript
import { useTranslation } from "@/lib/i18n";

export function Component() {
  const { t } = useTranslation();
  
  return (
    <div className="vietnamese-text">
      {t('translation.key')}
    </div>
  );
}
```

## Files đã được cập nhật

### ✅ Hoàn thành
- `client/lib/i18n.ts` - Hệ thống i18n hoàn chỉnh
- `client/pages/Index.tsx` - Trang chủ (đã tiếng Việt từ trước)
- `client/pages/Dashboard.tsx` - Dashboard với i18n
- `client/pages/HealthcareClaimSubmission.tsx` - Form nộp hồ sơ
- `client/components/Navigation.tsx` - Navigation (đã tiếng Việt)
- `client/pages/ClaimTracking.tsx` - Tra cứu hồ sơ (đã tiếng Việt)
- `client/pages/Login.tsx` - Đăng nhập (đã tiếng Việt)

### 📁 Templates & Guides
- `client/lib/component-templates.ts` - Templates cho component mới
- `VIETNAMESE_DEVELOPMENT_GUIDE.md` - Hướng dẫn phát triển
- `VIETNAMESE_DEFAULT.md` - Quy tắc chung (file này)

## Validation

Sử dụng function `validateVietnameseComponent()` để check:
```typescript
import { validateVietnameseComponent } from "@/lib/component-templates";

const result = validateVietnameseComponent(code);
console.log(result.isValid, result.issues, result.suggestions);
```

## Khi tạo feature mới

1. **Copy template** từ `component-templates.ts`
2. **Import useTranslation** hook
3. **Thêm vietnamese-text** class
4. **Sử dụng t()** function cho text
5. **Test responsive** trên mobile/desktop
6. **Validate** bằng validation function

## Lưu ý quan trọng

- **Tất cả text user-facing phải tiếng Việt**
- **Component mới tự động follow quy tắc này**
- **Không exception cho text tiếng Anh**
- **Responsive design cho mobile-first**
- **Accessibility support built-in**

## Cấu trúc i18n

```typescript
// Translation keys theo pattern
'section.subsection.element'

// Ví dụ
'dashboard.title'           // Bảng điều khiển
'claim.submit'             // Nộp hồ sơ  
'common.loading'           // Đang tải...
'form.required_field'      // Trường này là bắt buộc
```

## CSS Classes bắt buộc

```css
.vietnamese-text           /* Cho tất cả text */
.text-h1-mobile           /* Mobile typography */
.md:text-h1-desktop       /* Desktop typography */
```

---

**Kết quả**: Toàn bộ ứng dụng hiển thị tiếng Việt, tạo trải nghiệm tự nhiên cho người dùng Việt Nam. Mọi component mới tự động tuân thủ quy tắc này.
