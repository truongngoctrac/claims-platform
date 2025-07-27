import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LoginRequest } from "@shared/auth";

export function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [formData, setFormData] = useState<LoginRequest>({
    email: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated && !isLoading) {
    const from = (location.state as any)?.from?.pathname || "/dashboard";
    return <Navigate to={from} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-claim-blue-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await login(formData);

      if (!result.success) {
        setError(result.message || "Login failed");
      }
      // Success will be handled by the auth context and redirect will happen automatically
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-orange-50 via-white to-brand-blue-50 p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <FileText className="h-5 w-5 sm:h-7 sm:w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2 vietnamese-text">
            Chào mừng đến với ClaimFlow
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground vietnamese-text">
            Đăng nhập vào tài khoản bồi thường của bạn
          </p>
        </div>

        {/* Login Form */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-lg sm:text-xl vietnamese-text">
              Đăng nhập
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="vietnamese-text">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="vietnamese-text">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Nhập địa chỉ email của bạn"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="h-11 sm:h-12 text-base vietnamese-text"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="vietnamese-text">
                  Mật khẩu
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu của bạn"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                    className="h-11 sm:h-12 text-base vietnamese-text pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 sm:h-12 text-base vietnamese-text font-semibold"
                disabled={isSubmitting || !formData.email || !formData.password}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  "Đăng nhập"
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 p-3 sm:p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2 vietnamese-text">
                Tài khoản demo:
              </h4>
              <div className="text-xs sm:text-sm text-muted-foreground space-y-1 vietnamese-text">
                <div>
                  <strong>Quản trị viên:</strong> admin@claimflow.com /
                  password123
                </div>
                <div>
                  <strong>Quản lý:</strong> manager@claimflow.com / password123
                </div>
                <div>
                  <strong>Nhân viên:</strong> mike@claimflow.com / password123
                </div>
                <div>
                  <strong>Khách hàng:</strong> john@example.com / password123
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-4 sm:mt-6">
          <p className="text-xs sm:text-sm text-muted-foreground vietnamese-text">
            Nền tảng xử lý bồi thường an toàn và bảo mật
          </p>
        </div>
      </div>
    </div>
  );
}
