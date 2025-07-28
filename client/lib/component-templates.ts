// Template cho các component mới để đảm bảo luôn sử dụng tiếng Việt
export const COMPONENT_TEMPLATE = `import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

// TODO: Import các UI components cần thiết
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NewComponent() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 vietnamese-text">
              {/* TODO: Thêm tiêu đề từ hệ thống i18n */}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground vietnamese-text">
              {/* TODO: Thêm mô tả từ hệ thống i18n */}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* TODO: Thêm nội dung component */}
          </div>
        </div>
      </div>
    </div>
  );
}`;

export const PAGE_TEMPLATE = `import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

export function NewPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 vietnamese-text">
                {/* TODO: Thêm tiêu đề từ hệ thống i18n */}
              </h1>
              <p className="text-muted-foreground vietnamese-text">
                {/* TODO: Thêm mô tả từ hệ thống i18n */}
              </p>
            </div>
            <div className="flex gap-2 mt-4 md:mt-0">
              {/* TODO: Thêm các action buttons */}
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="vietnamese-text">
                  {/* TODO: Thêm tiêu đề card */}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* TODO: Thêm nội dung */}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}`;

// Hướng dẫn sử dụng cho developers
export const VIETNAMESE_DEVELOPMENT_GUIDE = {
  principles: [
    "Luôn sử dụng useTranslation() hook từ @/lib/i18n",
    "Thêm class 'vietnamese-text' cho tất cả text elements",
    "Sử dụng responsive text classes: text-h1-mobile md:text-h1-desktop",
    "Tất cả placeholder, label, button text phải là tiếng Việt",
    "Thêm vietnamese-text class cho tất cả interactive elements"
  ],
  
  examples: {
    button: `<Button className="vietnamese-text">{t('common.submit')}</Button>`,
    input: `<Input placeholder="Nhập thông tin..." className="vietnamese-text" />`,
    heading: `<h1 className="text-2xl font-bold vietnamese-text">{t('page.title')}</h1>`,
    description: `<p className="text-muted-foreground vietnamese-text">{t('page.description')}</p>`
  },

  checklist: [
    "✅ Import useTranslation từ @/lib/i18n",
    "✅ Sử dụng t() function cho tất cả text",
    "✅ Thêm vietnamese-text class",
    "✅ Responsive typography classes",
    "✅ Consistent spacing và layout",
    "✅ Proper color classes",
    "✅ Accessibility support"
  ]
};

// Utility function để check component có đúng format không
export function validateVietnameseComponent(componentCode: string): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check for useTranslation import
  if (!componentCode.includes('useTranslation')) {
    issues.push("Component thiếu useTranslation hook");
    suggestions.push("Thêm: import { useTranslation } from '@/lib/i18n'");
  }

  // Check for vietnamese-text class
  if (!componentCode.includes('vietnamese-text')) {
    issues.push("Component thiếu vietnamese-text class");
    suggestions.push("Thêm vietnamese-text class cho text elements");
  }

  // Check for hardcoded English text
  const englishPatterns = [
    /["']Submit["']/g,
    /["']Cancel["']/g,
    /["']Search["']/g,
    /["']Loading["']/g,
    /["']Error["']/g,
    /["']Success["']/g
  ];

  englishPatterns.forEach(pattern => {
    if (pattern.test(componentCode)) {
      issues.push("Component có text tiếng Anh hardcoded");
      suggestions.push("Sử dụng t() function thay cho hardcoded text");
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
}

export default {
  COMPONENT_TEMPLATE,
  PAGE_TEMPLATE,
  VIETNAMESE_DEVELOPMENT_GUIDE,
  validateVietnameseComponent
};
