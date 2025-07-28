import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Upload,
  X,
  Plus,
  Save,
  Send,
  CheckCircle,
  AlertTriangle,
  Info,
  User,
  Hospital,
  CreditCard,
  Loader2,
  Calendar,
  MapPin,
  Phone,
  Eye,
  Download,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthenticatedRequest } from "@/contexts/AuthContext";
import { ClaimType, TreatmentType, DocumentType } from "@shared/healthcare";
import { FileUpload } from "@/components/ui/file-upload";
import { useTranslation } from "@/lib/i18n";

interface ClaimFormData {
  type: ClaimType | "";

  // Patient information
  patient: {
    fullName: string;
    dateOfBirth: string;
    gender: "male" | "female" | "other" | "";
    nationalId: string;
    insuranceCardNumber: string;
    phoneNumber: string;
    address: string;
    relationship: "self" | "spouse" | "child" | "parent" | "other" | "";
  };

  // Medical information
  medical: {
    hospitalName: string;
    hospitalCode: string;
    doctorName: string;
    treatmentDate: string;
    dischargeDate: string;
    treatmentType: TreatmentType | "";
    diagnosis: {
      primary: string;
      icd10Code: string;
      secondary: string[];
    };
    symptoms: string;
    treatmentDescription: string;
  };

  // Financial information
  financial: {
    totalAmount: number;
    requestedAmount: number;
    currency: string;
    paymentMethod: "bank_transfer" | "cash" | "check" | "";
    bankDetails: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    };
  };
}

export function HealthcareClaimSubmission() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<ClaimFormData>({
    type: "",
    patient: {
      fullName: "",
      dateOfBirth: "",
      gender: "",
      nationalId: "",
      insuranceCardNumber: "",
      phoneNumber: "",
      address: "",
      relationship: "self",
    },
    medical: {
      hospitalName: "",
      hospitalCode: "",
      doctorName: "",
      treatmentDate: "",
      dischargeDate: "",
      treatmentType: "",
      diagnosis: {
        primary: "",
        icd10Code: "",
        secondary: [],
      },
      symptoms: "",
      treatmentDescription: "",
    },
    financial: {
      totalAmount: 0,
      requestedAmount: 0,
      currency: "VND",
      paymentMethod: "",
      bankDetails: {
        bankName: "",
        accountNumber: "",
        accountHolder: "",
      },
    },
  });

  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const steps = [
    {
      id: "basic",
      title: "Thông tin cơ bản",
      icon: <FileText className="w-5 h-5" />,
    },
    {
      id: "patient",
      title: "Thông tin bệnh nhân",
      icon: <User className="w-5 h-5" />,
    },
    {
      id: "medical",
      title: "Thông tin y tế",
      icon: <Hospital className="w-5 h-5" />,
    },
    {
      id: "financial",
      title: "Thông tin tài chính",
      icon: <CreditCard className="w-5 h-5" />,
    },
    {
      id: "documents",
      title: "Tài liệu",
      icon: <Upload className="w-5 h-5" />,
    },
    {
      id: "review",
      title: "Xem lại",
      icon: <CheckCircle className="w-5 h-5" />,
    },
  ];

  useEffect(() => {
    // Pre-fill user information if available
    if (user) {
      setFormData((prev) => ({
        ...prev,
        patient: {
          ...prev.patient,
          fullName: `${user.firstName} ${user.lastName}`,
          phoneNumber: user.phoneNumber || "",
        },
      }));
    }
  }, [user]);

  const updateFormData = (
    section: keyof ClaimFormData,
    field: string,
    value: any,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const updateNestedFormData = (
    section: keyof ClaimFormData,
    subSection: string,
    field: string,
    value: any,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subSection]: {
          ...prev[section][subSection],
          [field]: value,
        },
      },
    }));
  };

  const validateStep = (stepIndex: number): boolean => {
    const newErrors: { [key: string]: string } = {};

    switch (stepIndex) {
      case 0: // Basic info
        if (!formData.type)
          newErrors.type = "Vui lòng chọn loại yêu cầu bồi thường";
        break;
      case 1: // Patient info
        if (!formData.patient.fullName)
          newErrors.patientName = "Vui lòng nhập họ tên";
        if (!formData.patient.dateOfBirth)
          newErrors.patientDob = "Vui lòng nhập ngày sinh";
        if (!formData.patient.nationalId)
          newErrors.patientId = "Vui lòng nhập số CMND/CCCD";
        if (!formData.patient.insuranceCardNumber)
          newErrors.insuranceCard = "Vui lòng nhập số thẻ BHYT";
        break;
      case 2: // Medical info
        if (!formData.medical.hospitalName)
          newErrors.hospital = "Vui lòng nhập tên bệnh viện";
        if (!formData.medical.treatmentDate)
          newErrors.treatmentDate = "Vui lòng nhập ngày khám";
        if (!formData.medical.diagnosis.primary)
          newErrors.diagnosis = "Vui lòng nhập chẩn đoán";
        break;
      case 3: // Financial info
        if (formData.financial.totalAmount <= 0)
          newErrors.totalAmount = "Vui lòng nhập tổng chi phí";
        if (formData.financial.requestedAmount <= 0)
          newErrors.requestedAmount = "Vui lòng nhập số tiền yêu cầu";
        if (!formData.financial.paymentMethod)
          newErrors.paymentMethod = "Vui lòng chọn phương thức thanh toán";
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);

      const response = await makeAuthenticatedRequest(
        "/api/healthcare-claims",
        {
          method: "POST",
          body: JSON.stringify(formData),
        },
      );

      const data = await response.json();

      if (data.success) {
        setClaimId(data.claim.id);
        alert("Đã lưu nháp thành công!");
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Lỗi khi lưu nháp");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Create claim first if not exists
      let currentClaimId = claimId;
      if (!currentClaimId) {
        const createResponse = await makeAuthenticatedRequest(
          "/api/healthcare-claims",
          {
            method: "POST",
            body: JSON.stringify(formData),
          },
        );

        const createData = await createResponse.json();
        if (!createData.success) {
          throw new Error(createData.message);
        }
        currentClaimId = createData.claim.id;
      }

      // Submit the claim
      const submitResponse = await makeAuthenticatedRequest(
        `/api/healthcare-claims/${currentClaimId}/submit`,
        {
          method: "POST",
        },
      );

      const submitData = await submitResponse.json();

      if (submitData.success) {
        setSubmitSuccess(true);
        setClaimId(currentClaimId);
      } else {
        throw new Error(submitData.message);
      }
    } catch (error) {
      console.error("Error submitting claim:", error);
      alert("Lỗi khi nộp hồ sơ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        // Mock file upload
        const mockDoc = {
          id: `doc-${Date.now()}-${Math.random()}`,
          name: file.name,
          type: "medical_bill", // Default type
          size: file.size,
          uploadedAt: new Date().toISOString(),
          status: "uploaded",
        };
        setUploadedDocuments((prev) => [...prev, mockDoc]);
      });
    }
  };

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 vietnamese-text">
              Nộp hồ sơ thành công!
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground mb-6 vietnamese-text">
              Hồ sơ bồi thường của bạn đã được nộp thành công. Chúng tôi sẽ xử
              lý và thông báo kết quả trong thời gian sớm nhất.
            </p>

            <div className="bg-white rounded-lg p-6 mb-6">
              <div className="text-sm text-muted-foreground mb-2">Mã hồ sơ</div>
              <div className="text-2xl font-mono font-bold text-primary">
                {claimId}
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => (window.location.href = "/dashboard")}>
                Xem danh sách hồ sơ
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Nộp hồ sơ mới
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 vietnamese-text">
              Nộp hồ sơ bồi thường y tế
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground vietnamese-text">
              Vui lòng điền đầy đủ thông tin để nộp yêu cầu bồi thường
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center min-w-0 ${
                    index < steps.length - 1 ? "flex-1" : ""
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex-shrink-0 ${
                      index <= currentStep
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground text-muted-foreground"
                    }`}
                  >
                    <span className="scale-75 sm:scale-100">{step.icon}</span>
                  </div>
                  <div className="ml-2 sm:ml-3 hidden lg:block min-w-0">
                    <div
                      className={`text-xs sm:text-sm font-medium vietnamese-text truncate ${
                        index <= currentStep
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 sm:mx-4 ${
                        index < currentStep ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile step indicator */}
            <div className="lg:hidden text-center mt-3">
              <div className="text-xs sm:text-sm font-medium text-primary vietnamese-text">
                {steps[currentStep].title}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Bước {currentStep + 1} / {steps.length}
              </div>
            </div>
          </div>

          {/* Form Content */}
          <Card className="shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg sm:text-xl vietnamese-text">
                {steps[currentStep].title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Step 0: Basic Information */}
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="claimType" className="vietnamese-text">
                      Loại yêu cầu bồi thường *
                    </Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        updateFormData("type", "", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder="Chọn loại yêu cầu bồi thường"
                          className="vietnamese-text"
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value={ClaimType.OUTPATIENT}
                          className="vietnamese-text"
                        >
                          Ngoại trú
                        </SelectItem>
                        <SelectItem
                          value={ClaimType.INPATIENT}
                          className="vietnamese-text"
                        >
                          Nội trú
                        </SelectItem>
                        <SelectItem
                          value={ClaimType.EMERGENCY}
                          className="vietnamese-text"
                        >
                          Cấp cứu
                        </SelectItem>
                        <SelectItem
                          value={ClaimType.DENTAL}
                          className="vietnamese-text"
                        >
                          Nha khoa
                        </SelectItem>
                        <SelectItem
                          value={ClaimType.MATERNITY}
                          className="vietnamese-text"
                        >
                          Sản khoa
                        </SelectItem>
                        <SelectItem
                          value={ClaimType.PHARMACY}
                          className="vietnamese-text"
                        >
                          Dược phẩm
                        </SelectItem>
                        <SelectItem
                          value={ClaimType.SURGERY}
                          className="vietnamese-text"
                        >
                          Phẫu thuật
                        </SelectItem>
                        <SelectItem
                          value={ClaimType.DIAGNOSTIC}
                          className="vietnamese-text"
                        >
                          Chẩn đoán
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.type && (
                      <div className="text-sm text-destructive mt-1 vietnamese-text">
                        {errors.type}
                      </div>
                    )}
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="vietnamese-text">
                      Vui lòng chọn loại yêu cầu bồi thường phù hợp với trường
                      hợp của bạn. Thông tin này sẽ giúp chúng tôi xử lý hồ sơ
                      nhanh chóng và chính xác hơn.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Step 1: Patient Information */}
              {currentStep === 1 && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="fullName">Họ và tên *</Label>
                      <Input
                        id="fullName"
                        value={formData.patient.fullName}
                        onChange={(e) =>
                          updateFormData("patient", "fullName", e.target.value)
                        }
                        placeholder="Nhập họ và tên đầy đủ"
                      />
                      {errors.patientName && (
                        <div className="text-sm text-destructive mt-1">
                          {errors.patientName}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="dateOfBirth">Ngày sinh *</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.patient.dateOfBirth}
                        onChange={(e) =>
                          updateFormData(
                            "patient",
                            "dateOfBirth",
                            e.target.value,
                          )
                        }
                      />
                      {errors.patientDob && (
                        <div className="text-sm text-destructive mt-1">
                          {errors.patientDob}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="gender">Giới tính</Label>
                      <Select
                        value={formData.patient.gender}
                        onValueChange={(value) =>
                          updateFormData("patient", "gender", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn giới tính" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Nam</SelectItem>
                          <SelectItem value="female">Nữ</SelectItem>
                          <SelectItem value="other">Khác</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="relationship">Mối quan hệ</Label>
                      <Select
                        value={formData.patient.relationship}
                        onValueChange={(value) =>
                          updateFormData("patient", "relationship", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Mối quan hệ với người mua bảo hiểm" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="self">Bản thân</SelectItem>
                          <SelectItem value="spouse">Vợ/Chồng</SelectItem>
                          <SelectItem value="child">Con</SelectItem>
                          <SelectItem value="parent">Cha/Mẹ</SelectItem>
                          <SelectItem value="other">Khác</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="nationalId">Số CMND/CCCD *</Label>
                      <Input
                        id="nationalId"
                        value={formData.patient.nationalId}
                        onChange={(e) =>
                          updateFormData(
                            "patient",
                            "nationalId",
                            e.target.value,
                          )
                        }
                        placeholder="Nhập số CMND/CCCD"
                      />
                      {errors.patientId && (
                        <div className="text-sm text-destructive mt-1">
                          {errors.patientId}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="insuranceCard">Số thẻ BHYT *</Label>
                      <Input
                        id="insuranceCard"
                        value={formData.patient.insuranceCardNumber}
                        onChange={(e) =>
                          updateFormData(
                            "patient",
                            "insuranceCardNumber",
                            e.target.value,
                          )
                        }
                        placeholder="Nhập số thẻ BHYT"
                      />
                      {errors.insuranceCard && (
                        <div className="text-sm text-destructive mt-1">
                          {errors.insuranceCard}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="phoneNumber">Số điện thoại</Label>
                      <Input
                        id="phoneNumber"
                        value={formData.patient.phoneNumber}
                        onChange={(e) =>
                          updateFormData(
                            "patient",
                            "phoneNumber",
                            e.target.value,
                          )
                        }
                        placeholder="Nhập số điện thoại"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">Địa chỉ</Label>
                    <Textarea
                      id="address"
                      value={formData.patient.address}
                      onChange={(e) =>
                        updateFormData("patient", "address", e.target.value)
                      }
                      placeholder="Nhập địa chỉ chi tiết"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Medical Information */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hospitalName">
                        Tên bệnh viện/phòng khám *
                      </Label>
                      <Input
                        id="hospitalName"
                        value={formData.medical.hospitalName}
                        onChange={(e) =>
                          updateFormData(
                            "medical",
                            "hospitalName",
                            e.target.value,
                          )
                        }
                        placeholder="Nhập tên bệnh viện/phòng khám"
                      />
                      {errors.hospital && (
                        <div className="text-sm text-destructive mt-1">
                          {errors.hospital}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="hospitalCode">Mã bệnh viện</Label>
                      <Input
                        id="hospitalCode"
                        value={formData.medical.hospitalCode}
                        onChange={(e) =>
                          updateFormData(
                            "medical",
                            "hospitalCode",
                            e.target.value,
                          )
                        }
                        placeholder="Nhập mã bệnh viện (nếu có)"
                      />
                    </div>

                    <div>
                      <Label htmlFor="doctorName">Tên bác sĩ</Label>
                      <Input
                        id="doctorName"
                        value={formData.medical.doctorName}
                        onChange={(e) =>
                          updateFormData(
                            "medical",
                            "doctorName",
                            e.target.value,
                          )
                        }
                        placeholder="Nhập tên bác sĩ điều trị"
                      />
                    </div>

                    <div>
                      <Label htmlFor="treatmentType">Loại điều trị</Label>
                      <Select
                        value={formData.medical.treatmentType}
                        onValueChange={(value) =>
                          updateFormData("medical", "treatmentType", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn loại điều trị" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TreatmentType.CONSULTATION}>
                            Khám bệnh
                          </SelectItem>
                          <SelectItem value={TreatmentType.TREATMENT}>
                            Điều trị
                          </SelectItem>
                          <SelectItem value={TreatmentType.SURGERY}>
                            Phẫu thuật
                          </SelectItem>
                          <SelectItem value={TreatmentType.EMERGENCY}>
                            Cấp cứu
                          </SelectItem>
                          <SelectItem value={TreatmentType.REHABILITATION}>
                            Phục hồi chức năng
                          </SelectItem>
                          <SelectItem value={TreatmentType.PREVENTIVE}>
                            Phòng ngừa
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="treatmentDate">
                        Ngày khám/điều trị *
                      </Label>
                      <Input
                        id="treatmentDate"
                        type="date"
                        value={formData.medical.treatmentDate}
                        onChange={(e) =>
                          updateFormData(
                            "medical",
                            "treatmentDate",
                            e.target.value,
                          )
                        }
                      />
                      {errors.treatmentDate && (
                        <div className="text-sm text-destructive mt-1">
                          {errors.treatmentDate}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="dischargeDate">Ngày xuất viện</Label>
                      <Input
                        id="dischargeDate"
                        type="date"
                        value={formData.medical.dischargeDate}
                        onChange={(e) =>
                          updateFormData(
                            "medical",
                            "dischargeDate",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="diagnosis">Chẩn đoán chính *</Label>
                      <Input
                        id="diagnosis"
                        value={formData.medical.diagnosis.primary}
                        onChange={(e) =>
                          updateNestedFormData(
                            "medical",
                            "diagnosis",
                            "primary",
                            e.target.value,
                          )
                        }
                        placeholder="Nhập chẩn đoán chính"
                      />
                      {errors.diagnosis && (
                        <div className="text-sm text-destructive mt-1">
                          {errors.diagnosis}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="icd10">Mã ICD-10</Label>
                      <Input
                        id="icd10"
                        value={formData.medical.diagnosis.icd10Code}
                        onChange={(e) =>
                          updateNestedFormData(
                            "medical",
                            "diagnosis",
                            "icd10Code",
                            e.target.value,
                          )
                        }
                        placeholder="Nhập mã ICD-10 (nếu có)"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="symptoms">Triệu chứng</Label>
                    <Textarea
                      id="symptoms"
                      value={formData.medical.symptoms}
                      onChange={(e) =>
                        updateFormData("medical", "symptoms", e.target.value)
                      }
                      placeholder="Mô tả triệu chứng của bệnh nhân"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="treatmentDescription">Mô tả điều trị</Label>
                    <Textarea
                      id="treatmentDescription"
                      value={formData.medical.treatmentDescription}
                      onChange={(e) =>
                        updateFormData(
                          "medical",
                          "treatmentDescription",
                          e.target.value,
                        )
                      }
                      placeholder="Mô tả quá trình điều trị, thuốc sử dụng, v.v."
                      rows={4}
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Financial Information */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="totalAmount">Tổng chi phí (VND) *</Label>
                      <Input
                        id="totalAmount"
                        type="number"
                        value={formData.financial.totalAmount}
                        onChange={(e) =>
                          updateFormData(
                            "financial",
                            "totalAmount",
                            Number(e.target.value),
                          )
                        }
                        placeholder="Nhập tổng chi phí"
                      />
                      {errors.totalAmount && (
                        <div className="text-sm text-destructive mt-1">
                          {errors.totalAmount}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="requestedAmount">
                        Số tiền yêu cầu bồi thường (VND) *
                      </Label>
                      <Input
                        id="requestedAmount"
                        type="number"
                        value={formData.financial.requestedAmount}
                        onChange={(e) =>
                          updateFormData(
                            "financial",
                            "requestedAmount",
                            Number(e.target.value),
                          )
                        }
                        placeholder="Nhập số tiền yêu cầu"
                      />
                      {errors.requestedAmount && (
                        <div className="text-sm text-destructive mt-1">
                          {errors.requestedAmount}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="paymentMethod">
                      Phương thức thanh toán *
                    </Label>
                    <Select
                      value={formData.financial.paymentMethod}
                      onValueChange={(value) =>
                        updateFormData("financial", "paymentMethod", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn phương thức thanh toán" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">
                          Chuyển khoản ngân hàng
                        </SelectItem>
                        <SelectItem value="cash">Tiền mặt</SelectItem>
                        <SelectItem value="check">Séc</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.paymentMethod && (
                      <div className="text-sm text-destructive mt-1">
                        {errors.paymentMethod}
                      </div>
                    )}
                  </div>

                  {formData.financial.paymentMethod === "bank_transfer" && (
                    <div className="space-y-4">
                      <Separator />
                      <h4 className="font-semibold">
                        Thông tin tài khoản ngân hàng
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="bankName">Tên ngân hàng</Label>
                          <Input
                            id="bankName"
                            value={formData.financial.bankDetails.bankName}
                            onChange={(e) =>
                              updateNestedFormData(
                                "financial",
                                "bankDetails",
                                "bankName",
                                e.target.value,
                              )
                            }
                            placeholder="Nhập tên ngân hàng"
                          />
                        </div>

                        <div>
                          <Label htmlFor="accountNumber">Số tài khoản</Label>
                          <Input
                            id="accountNumber"
                            value={formData.financial.bankDetails.accountNumber}
                            onChange={(e) =>
                              updateNestedFormData(
                                "financial",
                                "bankDetails",
                                "accountNumber",
                                e.target.value,
                              )
                            }
                            placeholder="Nhập số tài khoản"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="accountHolder">Tên chủ tài khoản</Label>
                        <Input
                          id="accountHolder"
                          value={formData.financial.bankDetails.accountHolder}
                          onChange={(e) =>
                            updateNestedFormData(
                              "financial",
                              "bankDetails",
                              "accountHolder",
                              e.target.value,
                            )
                          }
                          placeholder="Nhập tên chủ tài khoản"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Documents */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <FileUpload
                    onFilesChange={(files) => {
                      const documents = files.map((file, index) => ({
                        id: `doc-${Date.now()}-${index}`,
                        name: file.name,
                        size: file.size,
                        status: "uploaded",
                      }));
                      setUploadedDocuments(documents);
                    }}
                    maxFiles={10}
                    maxSize={10}
                    acceptedTypes={[".pdf", ".jpg", ".jpeg", ".png"]}
                  />
                </div>
              )}

              {/* Step 5: Review */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Vui lòng kiểm tra lại toàn bộ thông tin trước khi nộp hồ
                      sơ. Sau khi nộp, bạn sẽ không thể chỉnh sửa thông tin.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Thông tin cơ bản
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div>
                            <strong>Loại:</strong> {formData.type}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Thông tin bệnh nhân
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div>
                            <strong>Họ tên:</strong> {formData.patient.fullName}
                          </div>
                          <div>
                            <strong>Ngày sinh:</strong>{" "}
                            {formData.patient.dateOfBirth}
                          </div>
                          <div>
                            <strong>CMND/CCCD:</strong>{" "}
                            {formData.patient.nationalId}
                          </div>
                          <div>
                            <strong>Thẻ BHYT:</strong>{" "}
                            {formData.patient.insuranceCardNumber}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Thông tin y tế
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div>
                            <strong>Bệnh viện:</strong>{" "}
                            {formData.medical.hospitalName}
                          </div>
                          <div>
                            <strong>Ngày khám:</strong>{" "}
                            {formData.medical.treatmentDate}
                          </div>
                          <div>
                            <strong>Chẩn đoán:</strong>{" "}
                            {formData.medical.diagnosis.primary}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Thông tin tài chính
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div>
                            <strong>Tổng chi phí:</strong>{" "}
                            {formData.financial.totalAmount.toLocaleString()}{" "}
                            VND
                          </div>
                          <div>
                            <strong>Số tiền yêu cầu:</strong>{" "}
                            {formData.financial.requestedAmount.toLocaleString()}{" "}
                            VND
                          </div>
                          <div>
                            <strong>Phương thức thanh toán:</strong>{" "}
                            {formData.financial.paymentMethod}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Tài liệu đính kèm
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {uploadedDocuments.length} tài liệu đã được tải lên
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                >
                  Quay lại
                </Button>

                <div className="flex gap-2">
                  {currentStep < steps.length - 1 && (
                    <Button
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Lưu nháp
                    </Button>
                  )}

                  {currentStep < steps.length - 1 ? (
                    <Button onClick={handleNext}>Tiếp theo</Button>
                  ) : (
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Nộp hồ sơ
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
