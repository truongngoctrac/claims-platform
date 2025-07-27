import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Clock,
  Shield,
  Users,
  CheckCircle,
  ArrowRight,
  Phone,
  Star,
  TrendingUp,
  Eye,
  MessageCircle,
  Award,
  Zap,
  Heart,
  Home,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

// Counter animation hook
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return count;
}

export function Index() {
  const claimsProcessed = useCounter(45678);
  const avgProcessingHours = useCounter(18);
  const satisfactionRate = useCounter(97);

  return (
    <div className="min-h-screen bg-background">

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-orange-50 via-white to-brand-blue-50 opacity-60" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />

        <div className="container mx-auto relative z-10 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">
            {/* Content */}
            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-3 sm:space-y-4">
                <Badge
                  variant="secondary"
                  className="bg-brand-orange-100 text-brand-orange-700 border-brand-orange-200 text-xs sm:text-sm vietnamese-text"
                >
                  <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Nền tảng bồi thường thông minh
                </Badge>

                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight vietnamese-text">
                  Xử lý Bồi thường{" "}
                  <span className="text-primary">Nhanh chóng</span> -{" "}
                  <span className="text-secondary">Đơn giản</span> -{" "}
                  <span className="text-success">Minh bạch</span>
                </h1>

                <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl vietnamese-text">
                  Nộp yêu cầu bồi thường online trong{" "}
                  <span className="font-semibold text-primary">5 phút</span>,
                  theo dõi tiến độ real-time và nhận kết quả nhanh chóng. Hệ
                  thống AI hỗ trợ xử lý tự động cho trải nghiệm tối ưu.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link to="/healthcare-claim" className="flex-1 sm:flex-none">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 vietnamese-text min-h-[48px]"
                  >
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Nộp yêu cầu bồi thường ngay
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                  </Button>
                </Link>

                <Link to="/claim-tracking" className="flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto border-2 border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold transition-all duration-300 vietnamese-text min-h-[48px]"
                  >
                    <Eye className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Kiểm tra trạng thái yêu cầu
                  </Button>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 fill-warning text-warning"
                      />
                    ))}
                  </div>
                  <span className="text-caption-mobile md:text-caption-desktop text-muted-foreground">
                    4.9/5 từ 12,500+ đánh giá
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-success" />
                  <span className="text-caption-mobile md:text-caption-desktop text-muted-foreground vietnamese-text">
                    Bảo mật SSL 256-bit
                  </span>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative order-first lg:order-last">
              <div className="relative bg-gradient-to-br from-primary/10 to-secondary/10 rounded-3xl p-8 md:p-12">
                {/* Floating Cards */}
                <div className="absolute -top-6 -left-6 bg-white rounded-xl shadow-lg p-4 rotate-3 hover:rotate-0 transition-transform duration-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="text-sm font-medium">Đã duyệt</span>
                  </div>
                  <div className="text-lg font-bold text-success">2.8M VND</div>
                </div>

                <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-4 -rotate-3 hover:rotate-0 transition-transform duration-300">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-info" />
                    <span className="text-sm font-medium">Đang xử lý</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Còn 1 ngày
                  </div>
                </div>

                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 -rotate-2 hover:rotate-0 transition-transform duration-300">
                  <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">Gia đình</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    4 thành viên
                  </div>
                </div>

                {/* Central Illustration */}
                <div className="text-center">
                  <div className="w-48 h-48 mx-auto bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mb-6 shadow-2xl">
                    <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center">
                      <FileText className="w-16 h-16 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-h3-mobile md:text-h3-desktop font-semibold text-foreground mb-2">
                    Hệ thống thông minh
                  </h3>
                  <p className="text-muted-foreground">
                    AI hỗ trợ xử lý tự động
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Statistics */}
      <section className="py-12 bg-white border-y">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold text-primary">
                {claimsProcessed.toLocaleString()}+
              </div>
              <div className="text-muted-foreground">
                Yêu cầu đã xử lý thành công
              </div>
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-sm text-success">+23% tháng này</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold text-secondary">
                {avgProcessingHours}h
              </div>
              <div className="text-muted-foreground">
                Thời gian xử lý trung bình
              </div>
              <div className="w-24 h-2 bg-muted rounded-full mx-auto">
                <div className="w-3/4 h-full bg-secondary rounded-full" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold text-success">
                {satisfactionRate}%
              </div>
              <div className="text-muted-foreground">
                Tỷ lệ hài lòng khách hàng
              </div>
              <div className="flex justify-center">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-white to-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Tính năng nổi bật
            </Badge>
            <h2 className="text-h2-mobile md:text-h2-desktop font-bold text-foreground mb-4">
              Tại sao chọn ClaimFlow?
            </h2>
            <p className="text-body-mobile md:text-body-desktop text-muted-foreground max-w-2xl mx-auto">
              Chúng tôi cam kết mang đến trải nghiệm bồi thường tốt nhất với
              công nghệ hiện đại
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="card-shadow-hover border-0 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6" />
                </div>
                <CardTitle className="text-h3-mobile md:text-h3-desktop">
                  Nộp yêu cầu nhanh
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Hoàn thành nộp yêu cầu chỉ trong 5 phút với form thông minh và
                  AI hỗ trợ
                </p>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-sm">Tự động điền thông tin</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-sm">Xác thực tức thì</span>
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow-hover border-0 bg-gradient-to-br from-secondary/5 to-secondary/10">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center mb-4">
                  <Eye className="w-6 h-6" />
                </div>
                <CardTitle className="text-h3-mobile md:text-h3-desktop">
                  Theo dõi real-time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Cập nhật tiến độ xử lý theo thời gian thực với thông báo push
                </p>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-sm">Thông báo tức thì</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-sm">Timeline chi tiết</span>
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow-hover border-0 bg-gradient-to-br from-success/5 to-success/10">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-success text-white flex items-center justify-center mb-4">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <CardTitle className="text-h3-mobile md:text-h3-desktop">
                  Hỗ trợ 24/7
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Đội ngũ chuyên viên và chatbot AI sẵn sàng hỗ trợ mọi lúc
                </p>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-sm">Hotline 24/7</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-sm">Chat AI thông minh</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Process Timeline */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Quy trình đơn giản
            </Badge>
            <h2 className="text-h2-mobile md:text-h2-desktop font-bold text-foreground mb-4 vietnamese-text">
              4 bước xử lý bồi thường
            </h2>
            <p className="text-body-mobile md:text-body-desktop text-muted-foreground max-w-2xl mx-auto vietnamese-text">
              Quy trình minh bạch và tự động hóa giúp rút ngắn thời gian xử lý
            </p>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted transform -translate-y-1/2 hidden md:block" />
            <div
              className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-success transform -translate-y-1/2 hidden md:block"
              style={{ width: "75%" }}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Step 1 */}
              <div className="text-center relative">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 shadow-lg relative z-10">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-h3-mobile font-semibold mb-2">
                  1. Nộp yêu cầu online
                </h3>
                <p className="text-caption-mobile md:text-caption-desktop text-muted-foreground">
                  Điền form và upload tài liệu trong 5 phút
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center relative">
                <div className="w-16 h-16 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center mx-auto mb-4 shadow-lg relative z-10">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="text-h3-mobile font-semibold mb-2">
                  2. Xác minh thông tin
                </h3>
                <p className="text-caption-mobile md:text-caption-desktop text-muted-foreground vietnamese-text">
                  AI kiểm tra và xác thực tài liệu tự động
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center relative">
                <div className="w-16 h-16 rounded-full bg-warning text-white flex items-center justify-center mx-auto mb-4 shadow-lg relative z-10">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-h3-mobile font-semibold mb-2">
                  3. Đánh giá và phê duyệt
                </h3>
                <p className="text-caption-mobile md:text-caption-desktop text-muted-foreground">
                  Chuyên viên thẩm định và đưa ra quyết định
                </p>
              </div>

              {/* Step 4 */}
              <div className="text-center relative">
                <div className="w-16 h-16 rounded-full bg-success text-white flex items-center justify-center mx-auto mb-4 shadow-lg relative z-10">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="text-h3-mobile font-semibold mb-2">
                  4. Thanh toán bồi thường
                </h3>
                <p className="text-caption-mobile md:text-caption-desktop text-muted-foreground">
                  Chuyển khoản trực tiếp trong 24h
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-primary via-primary/90 to-secondary relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 border border-white rounded-full" />
          <div className="absolute bottom-10 right-10 w-24 h-24 border border-white rounded-full" />
          <div className="absolute top-1/2 left-1/4 w-16 h-16 border border-white rounded-full" />
        </div>

        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-h2-mobile md:text-h2-desktop font-bold text-white mb-4">
            Sẵn sàng bắt đầu hành trình bồi thường?
          </h2>
          <p className="text-body-mobile md:text-body-desktop text-white/90 mb-8 max-w-2xl mx-auto">
            Tham gia cùng hàng nghìn khách hàng đã tin tưởng ClaimFlow. Trải
            nghiệm dịch vụ bồi thường nhanh chóng và minh bạch ngay hôm nay.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/healthcare-claim">
              <Button
                size="lg"
                variant="secondary"
                className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg font-semibold btn-mobile shadow-lg"
              >
                <FileText className="w-5 h-5 mr-2" />
                Bắt đầu ngay
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>

            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 px-8 py-4 text-lg font-semibold btn-mobile"
            >
              <Phone className="w-5 h-5 mr-2" />
              Gọi tư vấn: 1900-xxxx
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-8 text-white/80 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Bảo mật tuyệt đối</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Xử lý nhanh 24h</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              <span>Đảm bảo chất lượng</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-neutral-900 text-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">ClaimFlow</span>
              </div>
              <p className="text-neutral-400 text-sm">
                Nền tảng bồi thường bảo hiểm y tế thông minh, nhanh chóng và
                minh bạch.
              </p>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-sm">Hotline: 1900-xxxx</span>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Dịch vụ</h4>
              <div className="space-y-2 text-sm text-neutral-400">
                <div>Bồi thường ngoại trú</div>
                <div>Bồi thường nội trú</div>
                <div>Bồi thường cấp cứu</div>
                <div>Bồi thường thai sản</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Hỗ trợ</h4>
              <div className="space-y-2 text-sm text-neutral-400">
                <div>Hướng dẫn nộp hồ sơ</div>
                <div>Câu hỏi thường gặp</div>
                <div>Liên hệ hỗ trợ</div>
                <div>Chính sách bảo mật</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Công ty</h4>
              <div className="space-y-2 text-sm text-neutral-400">
                <div>Về ClaimFlow</div>
                <div>Tin tức</div>
                <div>Tuyển dụng</div>
                <div>Đối tác</div>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-800 mt-8 pt-8 text-center text-sm text-neutral-400">
            <p>© 2024 ClaimFlow. Tất cả quy��n được bảo lưu.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
