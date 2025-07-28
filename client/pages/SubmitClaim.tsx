import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function SubmitClaim() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 vietnamese-text">
              {t('claim.title')}
            </h1>
            <p className="text-muted-foreground vietnamese-text">
              {t('claim.subtitle')}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 vietnamese-text">
                <FileText className="h-5 w-5" />
                Biểu mẫu nộp hồ sơ bồi thường
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 vietnamese-text">
                  Tính năng nộp hồ sơ sắp ra mắt
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto vietnamese-text">
                  Biểu mẫu nộp hồ sơ bồi thường sẽ được triển khai trong giai đoạn tiếp theo.
                  Tính năng này sẽ bao gồm tải tài liệu lên, xác thực biểu mẫu và
                  tự động phân công xử lý hồ sơ.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
