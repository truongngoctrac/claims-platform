// Healthcare-specific enums and types
export enum ClaimType {
  OUTPATIENT = "outpatient", // Ngoại trú
  INPATIENT = "inpatient", // Nội trú
  EMERGENCY = "emergency", // Cấp cứu
  DENTAL = "dental", // Nha khoa
  MATERNITY = "maternity", // Sản khoa
  PHARMACY = "pharmacy", // Dược phẩm
  SURGERY = "surgery", // Phẫu thuật
  DIAGNOSTIC = "diagnostic", // Chẩn đoán
}

export enum ClaimStatus {
  DRAFT = "draft", // Nháp
  SUBMITTED = "submitted", // Đã nộp
  UNDER_REVIEW = "under_review", // Đang xem xét
  PENDING_DOCUMENTS = "pending_documents", // Chờ bổ sung hồ sơ
  MEDICAL_REVIEW = "medical_review", // Thẩm định y khoa
  APPROVED = "approved", // Đã duyệt
  REJECTED = "rejected", // Từ chối
  PAID = "paid", // Đã thanh toán
  CLOSED = "closed", // Đã đóng
}

export enum DocumentType {
  MEDICAL_BILL = "medical_bill", // Hóa đơn viện phí
  PRESCRIPTION = "prescription", // Đơn thuốc
  TEST_RESULT = "test_result", // Kết quả xét nghiệm
  DISCHARGE_SUMMARY = "discharge_summary", // Tóm tắt xuất viện
  DIAGNOSIS_REPORT = "diagnosis_report", // Báo cáo chẩn đoán
  INSURANCE_CARD = "insurance_card", // Thẻ bảo hiểm
  ID_DOCUMENT = "id_document", // Giấy tờ tùy thân
  DEATH_CERTIFICATE = "death_certificate", // Giấy chứng tử
  POLICE_REPORT = "police_report", // Báo cáo công an
  OTHER = "other", // Khác
}

export enum TreatmentType {
  CONSULTATION = "consultation", // Khám bệnh
  TREATMENT = "treatment", // Điều trị
  SURGERY = "surgery", // Phẫu thuật
  EMERGENCY = "emergency", // Cấp cứu
  REHABILITATION = "rehabilitation", // Phục hồi chức năng
  PREVENTIVE = "preventive", // Phòng ngừa
}

// Healthcare Claim Interface
export interface HealthcareClaim {
  id: string;
  claimNumber: string; // Số hồ sơ
  submittedBy: string; // User ID người nộp
  submittedAt: string;

  // Basic claim info
  type: ClaimType;
  status: ClaimStatus;
  priority: "low" | "medium" | "high" | "urgent";

  // Patient information
  patient: {
    fullName: string;
    dateOfBirth: string;
    gender: "male" | "female" | "other";
    nationalId: string;
    insuranceCardNumber: string;
    phoneNumber: string;
    address: string;
    relationship?: "self" | "spouse" | "child" | "parent" | "other"; // Quan hệ với người mua bảo hiểm
  };

  // Medical information
  medical: {
    hospitalName: string;
    hospitalCode?: string;
    doctorName?: string;
    treatmentDate: string;
    dischargeDate?: string;
    treatmentType: TreatmentType;
    diagnosis: {
      primary: string; // Chẩn đoán chính
      icd10Code?: string; // Mã ICD-10
      secondary?: string[]; // Chẩn đoán phụ
    };
    symptoms?: string;
    treatmentDescription?: string;
  };

  // Financial information
  financial: {
    totalAmount: number; // Tổng chi phí
    requestedAmount: number; // Số tiền yêu cầu bồi thường
    approvedAmount?: number; // Số tiền được duyệt
    currency: string;
    paymentMethod?: "bank_transfer" | "cash" | "check";
    bankDetails?: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    };
  };

  // Documents
  documents: HealthcareDocument[];

  // Processing information
  processing: {
    assignedTo?: string; // TPA staff ID
    assignedAt?: string;
    reviewedBy?: string; // Insurance reviewer ID
    reviewedAt?: string;
    comments?: ProcessingComment[];
    internalNotes?: string;
  };

  // External system references
  external: {
    bhxhClaimId?: string; // ID hồ sơ BHXH
    hospitalSystemId?: string; // ID trong hệ thống bệnh viện
    insuranceCompanyId?: string; // ID công ty bảo hiểm
    tpaReference?: string; // Mã tham chiếu TPA
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface HealthcareDocument {
  id: string;
  claimId: string;
  name: string;
  type: DocumentType;
  url: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;

  // OCR/AI processing
  ocrProcessed: boolean;
  ocrData?: {
    extractedText?: string;
    extractedAmounts?: number[];
    confidence?: number;
    processedAt?: string;
  };

  // Verification
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;

  // Status
  status: "uploaded" | "processing" | "verified" | "rejected";
}

export interface ProcessingComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  message: string;
  type: "info" | "question" | "request" | "decision";
  createdAt: string;
  isInternal: boolean; // True for internal TPA/insurance comments
}

// Healthcare provider interface
export interface HealthcareProvider {
  id: string;
  name: string;
  code: string;
  type: "hospital" | "clinic" | "pharmacy" | "diagnostic_center";
  address: string;
  phone: string;
  email?: string;
  specialties?: string[];

  // Integration details
  integration: {
    hasHisIntegration: boolean;
    hasEmrIntegration: boolean;
    apiEndpoint?: string;
    lastSyncAt?: string;
  };

  // Statistics
  stats: {
    totalClaims: number;
    averageClaimAmount: number;
    approvalRate: number;
  };
}

// Insurance company interface
export interface InsuranceCompany {
  id: string;
  name: string;
  code: string;
  logo?: string;
  contactInfo: {
    phone: string;
    email: string;
    address: string;
  };

  // Policy types they offer
  policyTypes: string[];

  // Integration with TPA
  tpaIntegration: {
    enabled: boolean;
    apiKey?: string;
    webhookUrl?: string;
  };

  // Processing rules
  rules: {
    maxAutoApprovalAmount: number;
    requiresMedicalReview: string[]; // ICD-10 codes requiring medical review
    documentsRequired: DocumentType[];
  };
}

// TPA (Third Party Administrator) workflow
export interface TPAWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  rules: WorkflowRule[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  type:
    | "document_check"
    | "medical_review"
    | "financial_review"
    | "approval"
    | "payment";
  assignedRole:
    | "tpa_executive"
    | "medical_reviewer"
    | "financial_reviewer"
    | "approver";
  timeLimit?: number; // hours
  required: boolean;
}

export interface WorkflowRule {
  id: string;
  condition: string; // JSON condition
  action: "auto_approve" | "require_review" | "reject" | "request_documents";
  value?: any;
}

// API interfaces for external integrations
export interface BHXHIntegration {
  checkEligibility(
    nationalId: string,
    insuranceCard: string,
  ): Promise<{
    eligible: boolean;
    coverage: string[];
    validUntil: string;
  }>;

  submitClaim(claim: HealthcareClaim): Promise<{
    success: boolean;
    bhxhClaimId?: string;
    message: string;
  }>;
}

export interface HISIntegration {
  getPatientHistory(nationalId: string): Promise<{
    visits: Array<{
      date: string;
      diagnosis: string;
      treatment: string;
      cost: number;
    }>;
  }>;

  verifyTreatment(
    hospitalCode: string,
    patientId: string,
    date: string,
  ): Promise<{
    verified: boolean;
    details?: any;
  }>;
}

export interface OCRService {
  processMedicalDocument(
    fileUrl: string,
    documentType: DocumentType,
  ): Promise<{
    success: boolean;
    extractedData: {
      text: string;
      amounts: number[];
      dates: string[];
      diagnosis?: string;
      medications?: string[];
    };
    confidence: number;
  }>;
}

// Request/Response interfaces
export interface CreateClaimRequest {
  patient: HealthcareClaim["patient"];
  medical: HealthcareClaim["medical"];
  financial: Omit<HealthcareClaim["financial"], "approvedAmount">;
  type: ClaimType;
}

export interface UpdateClaimRequest {
  claimId: string;
  updates: Partial<HealthcareClaim>;
  comment?: string;
}

export interface AssignClaimRequest {
  claimId: string;
  assignedTo: string;
  priority?: "low" | "medium" | "high" | "urgent";
  notes?: string;
}

export interface ReviewClaimRequest {
  claimId: string;
  decision: "approve" | "reject" | "request_more_info";
  approvedAmount?: number;
  comments: string;
  documentsRequired?: DocumentType[];
}

export interface ClaimSearchFilters {
  status?: ClaimStatus[];
  type?: ClaimType[];
  assignedTo?: string;
  submittedFrom?: string;
  submittedTo?: string;
  amountFrom?: number;
  amountTo?: number;
  hospitalName?: string;
  patientName?: string;
}

export interface ClaimStatistics {
  total: number;
  byStatus: Record<ClaimStatus, number>;
  byType: Record<ClaimType, number>;
  averageProcessingTime: number; // hours
  totalPaid: number;
  averageClaimAmount: number;
}

// Role-specific dashboard data
export interface CustomerDashboard {
  activeClaims: HealthcareClaim[];
  recentClaims: HealthcareClaim[];
  totalClaimsSubmitted: number;
  totalAmountClaimed: number;
  totalAmountReceived: number;
  notifications: Array<{
    id: string;
    message: string;
    type: "info" | "warning" | "success";
    createdAt: string;
  }>;
}

export interface TPADashboard {
  assignedClaims: HealthcareClaim[];
  pendingReview: HealthcareClaim[];
  completedToday: number;
  averageProcessingTime: number;
  workload: {
    current: number;
    capacity: number;
  };
  performanceMetrics: {
    claimsProcessed: number;
    accuracy: number;
    customerSatisfaction: number;
  };
}

export interface InsuranceDashboard {
  pendingApproval: HealthcareClaim[];
  highValueClaims: HealthcareClaim[];
  suspiciousClaims: HealthcareClaim[];
  monthlyStats: ClaimStatistics;
  fraudAlerts: Array<{
    claimId: string;
    reason: string;
    riskScore: number;
  }>;
}
