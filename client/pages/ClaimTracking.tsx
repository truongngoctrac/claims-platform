import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Phone,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  Download,
  MessageCircle,
  Bell,
  Filter,
  RefreshCw,
  Calendar,
  User,
  Building,
  CreditCard,
  Share2,
  Printer,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthenticatedRequest } from "@/contexts/AuthContext";

interface ClaimStatus {
  id: string;
  name: string;
  description: string;
  timestamp: string;
  completed: boolean;
  current: boolean;
  icon: React.ReactNode;
  color: string;
}

interface ClaimDetails {
  id: string;
  claimNumber: string;
  type: string;
  status: string;
  priority: string;
  submittedAt: string;
  updatedAt: string;
  estimatedCompletion: string;
  patient: {
    name: string;
    dateOfBirth: string;
    insuranceNumber: string;
  };
  financial: {
    totalAmount: number;
    requestedAmount: number;
    approvedAmount?: number;
  };
  hospital: {
    name: string;
    treatmentDate: string;
  };
  documents: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    uploadedAt: string;
  }>;
  timeline: ClaimStatus[];
  communications: Array<{
    id: string;
    author: string;
    role: string;
    message: string;
    timestamp: string;
    type: "info" | "question" | "response" | "update";
  }>;
}

export function ClaimTracking() {
  const { user } = useAuth();
  const [searchMethod, setSearchMethod] = useState<"claim" | "contract" | "phone">("claim");
  const [searchData, setSearchData] = useState({
    claimNumber: "",
    contractNumber: "",
    personalInfo: "",
    phoneNumber: "",
    otp: "",
  });
  const [isSearching, setIsSearching] = useState(false);
  const [claimDetails, setClaimDetails] = useState<ClaimDetails | null>(null);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [error, setError] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSearch = async () => {
    setIsSearching(true);
    setError("");

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock claim data
      const mockClaim: ClaimDetails = {
        id: "hc-claim-001",
        claimNumber: searchData.claimNumber || "HC240115001",
        type: "Bồi thường ngoại trú",
        status: "Đang xem xét",
        priority: "Trung bình",
        submittedAt: "2024-01-15T09:30:00Z",
        updatedAt: "2024-01-16T14:20:00Z",
        estimatedCompletion: "2024-01-20T17:00:00Z",
        patient: {
          name: "Nguyễn Văn An",
          dateOfBirth: "15/03/1985",
          insuranceNumber: "DN4020210123456",
        },
        financial: {
          totalAmount: 2500000,
          requestedAmount: 2500000,
          approvedAmount: undefined,
        },
        hospital: {
          name: "Bệnh viện Chợ Rẫy",
          treatmentDate: "14/01/2024",
        },
        documents: [
          {
            id: "doc-1",
            name: "Hóa đơn viện phí",
            type: "medical_bill",
            status: "Đã xác minh",
            uploadedAt: "15/01/2024",
          },
          {
            id: "doc-2",
            name: "Đơn thuốc",
            type: "prescription",
            status: "Đang xem xét",
            uploadedAt: "15/01/2024",
          },
          {
            id: "doc-3",
            name: "CMND",
            type: "id_document",
            status: "Đã xác minh",
            uploadedAt: "15/01/2024",
          },
        ],
        timeline: [
          {
            id: "1",
            name: "Đã nhận yêu cầu",
            description: "Hồ sơ đã được nộp thành công",
            timestamp: "15/01/2024 09:30",
            completed: true,
            current: false,
            icon: <FileText className="w-4 h-4" />,
            color: "bg-success",
          },
          {
            id: "2",
            name: "Đang xác minh",
            description: "Kiểm tra tính hợp lệ của tài liệu",
            timestamp: "15/01/2024 14:15",
            completed: true,
            current: false,
            icon: <CheckCircle className="w-4 h-4" />,
            color: "bg-info",
          },
          {
            id: "3",
            name: "Đang đánh giá",
            description: "Chuyên viên đang thẩm định hồ sơ",
            timestamp: "16/01/2024 09:00",
            completed: false,
            current: true,
            icon: <Clock className="w-4 h-4" />,
            color: "bg-warning",
          },
          {
            id: "4",
            name: "Phê duyệt",
            description: "Đưa ra quyết định cuối cùng",
            timestamp: "",
            completed: false,
            current: false,
            icon: <CheckCircle className="w-4 h-4" />,
            color: "bg-muted",
          },
          {
            id: "5",
            name: "Thanh toán",
            description: "Chuyển khoản bồi thường",
            timestamp: "",
            completed: false,
            current: false,
            icon: <CreditCard className="w-4 h-4" />,
            color: "bg-muted",
          },
        ],
        communications: [
          {
            id: "1",
            author: "Hệ thống",
            role: "system",
            message: "Hồ sơ của bạn đã được tiếp nhận và đang trong quá trình xử lý",
            timestamp: "15/01/2024 09:30",
            type: "info",
          },
          {
            id: "2",
            author: "Nguyễn Thị Mai",
            role: "Chuyên viên thẩm định",
            message: "Chúng tôi đã xác minh thành công các tài liệu của bạn. Hồ sơ đang được chuyển sang bước đánh giá.",
            timestamp: "15/01/2024 16:45",
            type: "update",
          },
          {
            id: "3",
            author: "Hệ thống",
            role: "system",
            message: "Thời gian xử lý dự kiến: 3-5 ngày làm việc kể từ ngày nhận hồ sơ",
            timestamp: "16/01/2024 09:00",
            type: "info",
          },
        ],
      };

      setClaimDetails(mockClaim);
    } catch (error) {
      setError("Không tìm thấy hồ sơ. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setIsSearching(false);
    }
  };

  const sendOTP = () => {
    setShowOTPInput(true);
    // Simulate OTP sending
    alert("Mã OTP đã được gửi về số điện thoại của bạn");
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "đã xác minh":
        return "bg-success text-white";
      case "đang xem xét":
        return "bg-warning text-black";
      case "cần bổ sung":
        return "bg-destructive text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("vi-VN") + " VND";
  };

  const calculateDaysLeft = (targetDate: string) => {
    const target = new Date(targetDate);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-h1-mobile md:text-h1-desktop font-bold text-foreground mb-2">
              Tra cứu trạng thái hồ sơ
            </h1>
            <p className="text-muted-foreground">
              Nhập thông tin để kiểm tra tiến độ xử lý yêu cầu bồi thường
            </p>
          </div>

          {!claimDetails ? (
            /* Search Interface */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Tìm kiếm hồ sơ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={searchMethod} onValueChange={(value) => setSearchMethod(value as any)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="claim">Mã hồ sơ</TabsTrigger>
                    <TabsTrigger value="contract">Số hợp đồng</TabsTrigger>
                    <TabsTrigger value="phone">Số điện thoại</TabsTrigger>
                  </TabsList>

                  <TabsContent value="claim" className="space-y-4 mt-6">
                    <div>
                      <Label htmlFor="claimNumber">Mã hồ sơ bồi thường</Label>
                      <Input
                        id="claimNumber"
                        placeholder="Ví dụ: HC240115001"
                        value={searchData.claimNumber}
                        onChange={(e) =>
                          setSearchData(prev => ({ ...prev, claimNumber: e.target.value }))
                        }
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Mã hồ sơ được cung cấp khi bạn nộp yêu cầu bồi thường
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="contract" className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contractNumber">Số hợp đồng bảo hiểm</Label>
                        <Input
                          id="contractNumber"
                          placeholder="Ví d���: PVI202400123"
                          value={searchData.contractNumber}
                          onChange={(e) =>
                            setSearchData(prev => ({ ...prev, contractNumber: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="personalInfo">Thông tin cá nhân</Label>
                        <Input
                          id="personalInfo"
                          placeholder="Họ tên hoặc CMND"
                          value={searchData.personalInfo}
                          onChange={(e) =>
                            setSearchData(prev => ({ ...prev, personalInfo: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="phone" className="space-y-4 mt-6">
                    <div>
                      <Label htmlFor="phoneNumber">Số điện thoại đăng ký</Label>
                      <Input
                        id="phoneNumber"
                        placeholder="Ví dụ: 0912345678"
                        value={searchData.phoneNumber}
                        onChange={(e) =>
                          setSearchData(prev => ({ ...prev, phoneNumber: e.target.value }))
                        }
                      />
                      {!showOTPInput ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={sendOTP}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Gửi mã OTP
                        </Button>
                      ) : (
                        <div className="mt-2">
                          <Label htmlFor="otp">Mã OTP</Label>
                          <Input
                            id="otp"
                            placeholder="Nhập mã 6 số"
                            value={searchData.otp}
                            onChange={(e) =>
                              setSearchData(prev => ({ ...prev, otp: e.target.value }))
                            }
                            maxLength={6}
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end mt-6">
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="px-8"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Tìm kiếm
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Claim Details */
            <div className="space-y-6">
              {/* Header Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <Button
                  variant="outline"
                  onClick={() => setClaimDetails(null)}
                >
                  ← Tìm ki��m khác
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Share2 className="w-4 h-4 mr-2" />
                    Chia sẻ
                  </Button>
                  <Button variant="outline" size="sm">
                    <Printer className="w-4 h-4 mr-2" />
                    In
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNotifications(!showNotifications)}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Thông báo
                  </Button>
                </div>
              </div>

              {/* Claim Summary */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                      <CardTitle className="text-h2-mobile md:text-h2-desktop">
                        {claimDetails.claimNumber}
                      </CardTitle>
                      <p className="text-muted-foreground">{claimDetails.type}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={cn("text-sm", getStatusColor(claimDetails.status))}>
                        {claimDetails.status}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Ước tính hoàn thành: {calculateDaysLeft(claimDetails.estimatedCompletion)} ngày nữa
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Patient Info */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Thông tin bệnh nhân
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Họ tên:</strong> {claimDetails.patient.name}</div>
                        <div><strong>Ngày sinh:</strong> {claimDetails.patient.dateOfBirth}</div>
                        <div><strong>Số BHYT:</strong> {claimDetails.patient.insuranceNumber}</div>
                      </div>
                    </div>

                    {/* Hospital Info */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        Thông tin điều trị
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Bệnh viện:</strong> {claimDetails.hospital.name}</div>
                        <div><strong>Ngày điều trị:</strong> {claimDetails.hospital.treatmentDate}</div>
                        <div><strong>Ngày nộp:</strong> {new Date(claimDetails.submittedAt).toLocaleDateString("vi-VN")}</div>
                      </div>
                    </div>

                    {/* Financial Info */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Thông tin tài chính
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Tổng chi phí:</strong> {formatCurrency(claimDetails.financial.totalAmount)}</div>
                        <div><strong>Yêu cầu bồi thường:</strong> {formatCurrency(claimDetails.financial.requestedAmount)}</div>
                        {claimDetails.financial.approvedAmount && (
                          <div><strong>Số tiền duyệt:</strong> {formatCurrency(claimDetails.financial.approvedAmount)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Tiến độ xử lý
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {claimDetails.timeline.map((status, index) => (
                      <div key={status.id} className="flex gap-4">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white",
                            status.completed ? status.color : status.current ? "bg-warning" : "bg-muted"
                          )}>
                            {status.icon}
                          </div>
                          {index < claimDetails.timeline.length - 1 && (
                            <div className={cn(
                              "w-0.5 h-8 mt-2",
                              status.completed ? "bg-success" : "bg-muted"
                            )} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-8">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{status.name}</h4>
                            {status.current && (
                              <Badge variant="outline" className="text-xs">
                                Hiện tại
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">{status.description}</p>
                          {status.timestamp && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {status.timestamp}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Documents Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Trạng thái tài liệu
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {claimDetails.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{doc.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Tải lên: {doc.uploadedAt}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(doc.status)}>
                            {doc.status}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Communication History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Lịch sử trao đổi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {claimDetails.communications.map((comm) => (
                      <div key={comm.id} className="border-l-2 border-primary/20 pl-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{comm.author}</span>
                            <Badge variant="outline" className="text-xs">
                              {comm.role}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {comm.timestamp}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comm.message}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Hành động nhanh</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Gửi tin nhắn
                    </Button>
                    <Button variant="outline">
                      <Phone className="w-4 h-4 mr-2" />
                      Gọi hỗ trợ
                    </Button>
                    <Button variant="outline">
                      <FileText className="w-4 h-4 mr-2" />
                      Bổ sung tài liệu
                    </Button>
                    <Button variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Cập nhật trạng thái
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
