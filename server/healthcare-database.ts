import bcrypt from "bcryptjs";
import {
  HealthcareClaim,
  ClaimType,
  ClaimStatus,
  DocumentType,
  TreatmentType,
  HealthcareProvider,
  InsuranceCompany,
  CustomerDashboard,
  TPADashboard,
  InsuranceDashboard,
  ProcessingComment,
} from "../shared/healthcare";
import { User, UserRole } from "../shared/auth";

// Extended database for healthcare claims
class HealthcareDatabase {
  private claims: HealthcareClaim[] = [];
  private providers: HealthcareProvider[] = [];
  private insuranceCompanies: InsuranceCompany[] = [];
  private processingComments: ProcessingComment[] = [];

  constructor() {
    this.initializeHealthcareData();
  }

  private initializeHealthcareData() {
    // Initialize sample healthcare providers
    this.providers = [
      {
        id: "hospital-1",
        name: "Bệnh viện Bạch Mai",
        code: "BM001",
        type: "hospital",
        address: "78 Giải Phóng, Đống Đa, Hà Nội",
        phone: "024-3869-3731",
        email: "info@bachmai.gov.vn",
        specialties: ["Nội khoa", "Ngoại khoa", "Sản khoa", "Nhi khoa"],
        integration: {
          hasHisIntegration: true,
          hasEmrIntegration: true,
          lastSyncAt: "2024-01-15T10:00:00Z",
        },
        stats: {
          totalClaims: 1250,
          averageClaimAmount: 2500000,
          approvalRate: 0.92,
        },
      },
      {
        id: "hospital-2",
        name: "Bệnh viện Chợ Rẫy",
        code: "CR001",
        type: "hospital",
        address: "201B Nguyễn Chí Thanh, Quận 5, TP.HCM",
        phone: "028-3955-4269",
        email: "info@choray.vn",
        specialties: ["Tim mạch", "Ung bướu", "Cấp cứu", "Phẫu thuật"],
        integration: {
          hasHisIntegration: true,
          hasEmrIntegration: false,
        },
        stats: {
          totalClaims: 2100,
          averageClaimAmount: 3200000,
          approvalRate: 0.89,
        },
      },
      {
        id: "clinic-1",
        name: "Phòng khám Đa khoa An Sinh",
        code: "AS001",
        type: "clinic",
        address: "123 Nguyễn Văn Cừ, Quận 1, TP.HCM",
        phone: "028-3925-1234",
        specialties: ["Nội khoa", "Nhi khoa", "Da liễu"],
        integration: {
          hasHisIntegration: false,
          hasEmrIntegration: false,
        },
        stats: {
          totalClaims: 450,
          averageClaimAmount: 850000,
          approvalRate: 0.95,
        },
      },
    ];

    // Initialize sample insurance companies
    this.insuranceCompanies = [
      {
        id: "insurance-1",
        name: "Bảo hiểm PVI",
        code: "PVI",
        contactInfo: {
          phone: "1900-9095",
          email: "cskh@pvi.com.vn",
          address: "25 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội",
        },
        policyTypes: ["Sức khỏe cá nhân", "Sức khỏe gia đình", "Tai nạn"],
        tpaIntegration: {
          enabled: true,
          apiKey: "pvi_api_key_123",
        },
        rules: {
          maxAutoApprovalAmount: 5000000,
          requiresMedicalReview: ["C78", "I21", "S72"], // Các mã ICD-10 cần thẩm định
          documentsRequired: [
            DocumentType.MEDICAL_BILL,
            DocumentType.INSURANCE_CARD,
            DocumentType.ID_DOCUMENT,
          ],
        },
      },
      {
        id: "insurance-2",
        name: "Bảo hiểm Bảo Việt",
        code: "BV",
        contactInfo: {
          phone: "1900-558-8",
          email: "cskh@baoviet.com.vn",
          address: "8 Lê Thái Tổ, Hoàn Kiếm, Hà Nội",
        },
        policyTypes: ["Y tế cao cấp", "Chăm sóc sức khỏe", "Bảo hiểm nhóm"],
        tpaIntegration: {
          enabled: true,
          apiKey: "bv_api_key_456",
        },
        rules: {
          maxAutoApprovalAmount: 3000000,
          requiresMedicalReview: ["C80", "I46", "N18"],
          documentsRequired: [
            DocumentType.MEDICAL_BILL,
            DocumentType.PRESCRIPTION,
            DocumentType.TEST_RESULT,
          ],
        },
      },
    ];

    // Initialize sample healthcare claims
    this.claims = [
      {
        id: "hc-claim-001",
        claimNumber: "HC240115001",
        submittedBy: "customer-1",
        submittedAt: "2024-01-15T09:30:00Z",
        type: ClaimType.OUTPATIENT,
        status: ClaimStatus.SUBMITTED,
        priority: "medium",

        patient: {
          fullName: "Nguyễn Văn An",
          dateOfBirth: "1985-03-15",
          gender: "male",
          nationalId: "001085012345",
          insuranceCardNumber: "DN4020210123456",
          phoneNumber: "+84-912-345-678",
          address: "123 Trần Hưng Đạo, Quận 1, TP.HCM",
          relationship: "self",
        },

        medical: {
          hospitalName: "B���nh viện Chợ Rẫy",
          hospitalCode: "CR001",
          doctorName: "BS. Lê Thị Hoa",
          treatmentDate: "2024-01-14",
          treatmentType: TreatmentType.CONSULTATION,
          diagnosis: {
            primary: "Viêm họng cấp",
            icd10Code: "J02.9",
            secondary: ["Sốt"],
          },
          symptoms: "Đau họng, sốt nhẹ, khó nuốt",
          treatmentDescription: "Khám họng, kê đơn thuốc kháng sinh",
        },

        financial: {
          totalAmount: 450000,
          requestedAmount: 450000,
          currency: "VND",
          paymentMethod: "bank_transfer",
          bankDetails: {
            bankName: "Vietcombank",
            accountNumber: "0123456789",
            accountHolder: "Nguyen Van An",
          },
        },

        documents: [
          {
            id: "doc-001",
            claimId: "hc-claim-001",
            name: "hoa_don_vien_phi.pdf",
            type: DocumentType.MEDICAL_BILL,
            url: "/uploads/hoa_don_vien_phi.pdf",
            size: 245600,
            uploadedAt: "2024-01-15T09:35:00Z",
            uploadedBy: "customer-1",
            ocrProcessed: false,
            verified: false,
            status: "uploaded",
          },
          {
            id: "doc-002",
            claimId: "hc-claim-001",
            name: "don_thuoc.jpg",
            type: DocumentType.PRESCRIPTION,
            url: "/uploads/don_thuoc.jpg",
            size: 156800,
            uploadedAt: "2024-01-15T09:36:00Z",
            uploadedBy: "customer-1",
            ocrProcessed: true,
            ocrData: {
              extractedText: "Amoxicillin 500mg x 2 viên/ngày x 7 ngày",
              confidence: 0.95,
              processedAt: "2024-01-15T09:37:00Z",
            },
            verified: false,
            status: "processing",
          },
        ],

        processing: {
          comments: [],
        },

        external: {
          insuranceCompanyId: "insurance-2",
          tpaReference: "TPA-HC-001",
        },

        createdAt: "2024-01-15T09:30:00Z",
        updatedAt: "2024-01-15T09:36:00Z",
      },

      {
        id: "hc-claim-002",
        claimNumber: "HC240114001",
        submittedBy: "customer-1",
        submittedAt: "2024-01-14T14:20:00Z",
        type: ClaimType.EMERGENCY,
        status: ClaimStatus.UNDER_REVIEW,
        priority: "high",

        patient: {
          fullName: "Trần Thị Mai",
          dateOfBirth: "1990-08-22",
          gender: "female",
          nationalId: "001090067890",
          insuranceCardNumber: "HN4020210987654",
          phoneNumber: "+84-987-654-321",
          address: "456 Nguyễn Trãi, Thanh Xuân, Hà Nội",
          relationship: "spouse",
        },

        medical: {
          hospitalName: "Bệnh viện Bạch Mai",
          hospitalCode: "BM001",
          doctorName: "BS. Phạm Văn Tuấn",
          treatmentDate: "2024-01-13",
          dischargeDate: "2024-01-14",
          treatmentType: TreatmentType.EMERGENCY,
          diagnosis: {
            primary: "Viêm ruột thừa cấp",
            icd10Code: "K35.9",
          },
          symptoms: "Đau bụng dưới bên phải, sốt cao, buồn nôn",
          treatmentDescription: "Phẫu thuật cắt ruột thừa nội soi",
        },

        financial: {
          totalAmount: 15750000,
          requestedAmount: 15750000,
          currency: "VND",
          paymentMethod: "bank_transfer",
          bankDetails: {
            bankName: "Techcombank",
            accountNumber: "9876543210",
            accountHolder: "Tran Thi Mai",
          },
        },

        documents: [
          {
            id: "doc-003",
            claimId: "hc-claim-002",
            name: "giay_ra_vien.pdf",
            type: DocumentType.DISCHARGE_SUMMARY,
            url: "/uploads/giay_ra_vien.pdf",
            size: 892400,
            uploadedAt: "2024-01-14T14:25:00Z",
            uploadedBy: "customer-1",
            ocrProcessed: true,
            ocrData: {
              extractedText:
                "Chẩn đoán: Viêm ruột thừa cấp. Đã phẫu thuật thành công.",
              confidence: 0.92,
              processedAt: "2024-01-14T14:30:00Z",
            },
            verified: true,
            verifiedBy: "tpa-executive-1",
            verifiedAt: "2024-01-14T16:00:00Z",
            status: "verified",
          },
        ],

        processing: {
          assignedTo: "executive-1",
          assignedAt: "2024-01-14T15:00:00Z",
          comments: [
            {
              id: "comment-001",
              authorId: "executive-1",
              authorName: "Mike Johnson",
              authorRole: "TPA Executive",
              message: "Đã xác minh hồ sơ, chuyển lên thẩm định y khoa",
              type: "info",
              createdAt: "2024-01-14T16:30:00Z",
              isInternal: true,
            },
          ],
        },

        external: {
          insuranceCompanyId: "insurance-1",
          tpaReference: "TPA-HC-002",
        },

        createdAt: "2024-01-14T14:20:00Z",
        updatedAt: "2024-01-14T16:30:00Z",
      },

      {
        id: "hc-claim-003",
        claimNumber: "HC240112001",
        submittedBy: "customer-2",
        submittedAt: "2024-01-12T11:15:00Z",
        type: ClaimType.INPATIENT,
        status: ClaimStatus.APPROVED,
        priority: "medium",

        patient: {
          fullName: "Lê Minh Hoàng",
          dateOfBirth: "1978-12-10",
          gender: "male",
          nationalId: "001078054321",
          insuranceCardNumber: "SG4020210555777",
          phoneNumber: "+84-909-888-777",
          address: "789 Lê Lợi, Quận 3, TP.HCM",
          relationship: "self",
        },

        medical: {
          hospitalName: "Bệnh viện Chợ Rẫy",
          hospitalCode: "CR001",
          doctorName: "BS. Nguyễn Văn Đức",
          treatmentDate: "2024-01-10",
          dischargeDate: "2024-01-12",
          treatmentType: TreatmentType.SURGERY,
          diagnosis: {
            primary: "Sỏi thận",
            icd10Code: "N20.0",
          },
          symptoms: "Đau thắt lưng, tiểu khó, tiểu ra máu",
          treatmentDescription: "Phẫu thuật tán sỏi thận bằng laser",
        },

        financial: {
          totalAmount: 28500000,
          requestedAmount: 28500000,
          approvedAmount: 26000000,
          currency: "VND",
          paymentMethod: "bank_transfer",
          bankDetails: {
            bankName: "ACB",
            accountNumber: "1122334455",
            accountHolder: "Le Minh Hoang",
          },
        },

        documents: [
          {
            id: "doc-004",
            claimId: "hc-claim-003",
            name: "bien_lai_thanh_toan.pdf",
            type: DocumentType.MEDICAL_BILL,
            url: "/uploads/bien_lai_thanh_toan.pdf",
            size: 445200,
            uploadedAt: "2024-01-12T11:20:00Z",
            uploadedBy: "customer-2",
            ocrProcessed: true,
            verified: true,
            status: "verified",
          },
        ],

        processing: {
          assignedTo: "executive-2",
          assignedAt: "2024-01-12T12:00:00Z",
          reviewedBy: "manager-1",
          reviewedAt: "2024-01-13T09:30:00Z",
          comments: [
            {
              id: "comment-002",
              authorId: "manager-1",
              authorName: "Sarah Wilson",
              authorRole: "Claims Manager",
              message:
                "Đã duyệt bồi thường 26,000,000 VND. Trừ 2,500,000 VND do không nằm trong phạm vi bảo hiểm.",
              type: "decision",
              createdAt: "2024-01-13T09:30:00Z",
              isInternal: false,
            },
          ],
        },

        external: {
          insuranceCompanyId: "insurance-1",
          tpaReference: "TPA-HC-003",
        },

        createdAt: "2024-01-12T11:15:00Z",
        updatedAt: "2024-01-13T09:30:00Z",
        completedAt: "2024-01-13T09:30:00Z",
      },
    ];
  }

  // Healthcare Claims CRUD operations
  createHealthcareClaim(
    claimData: Omit<
      HealthcareClaim,
      "id" | "claimNumber" | "createdAt" | "updatedAt"
    >,
  ): HealthcareClaim {
    const claim: HealthcareClaim = {
      ...claimData,
      id: `hc-claim-${Date.now()}`,
      claimNumber: `HC${new Date().getFullYear()}${String(Date.now()).slice(-8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.claims.push(claim);
    return claim;
  }

  getAllHealthcareClaims(): HealthcareClaim[] {
    return this.claims.sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
  }

  getHealthcareClaimById(id: string): HealthcareClaim | null {
    return this.claims.find((claim) => claim.id === id) || null;
  }

  updateHealthcareClaim(
    id: string,
    updates: Partial<HealthcareClaim>,
  ): HealthcareClaim | null {
    const claimIndex = this.claims.findIndex((claim) => claim.id === id);
    if (claimIndex === -1) return null;

    this.claims[claimIndex] = {
      ...this.claims[claimIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return this.claims[claimIndex];
  }

  getClaimsBySubmitter(userId: string): HealthcareClaim[] {
    return this.claims.filter((claim) => claim.submittedBy === userId);
  }

  getClaimsByAssignee(userId: string): HealthcareClaim[] {
    return this.claims.filter(
      (claim) => claim.processing.assignedTo === userId,
    );
  }

  getClaimsByStatus(status: ClaimStatus): HealthcareClaim[] {
    return this.claims.filter((claim) => claim.status === status);
  }

  getUnassignedClaims(): HealthcareClaim[] {
    return this.claims.filter(
      (claim) =>
        !claim.processing.assignedTo &&
        [ClaimStatus.SUBMITTED, ClaimStatus.PENDING_DOCUMENTS].includes(
          claim.status,
        ),
    );
  }

  // Healthcare Providers
  getAllHealthcareProviders(): HealthcareProvider[] {
    return this.providers;
  }

  getHealthcareProviderById(id: string): HealthcareProvider | null {
    return this.providers.find((provider) => provider.id === id) || null;
  }

  // Insurance Companies
  getAllInsuranceCompanies(): InsuranceCompany[] {
    return this.insuranceCompanies;
  }

  getInsuranceCompanyById(id: string): InsuranceCompany | null {
    return this.insuranceCompanies.find((company) => company.id === id) || null;
  }

  // Comments
  addComment(
    claimId: string,
    comment: Omit<ProcessingComment, "id" | "createdAt">,
  ): ProcessingComment {
    const newComment: ProcessingComment = {
      ...comment,
      id: `comment-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const claim = this.getHealthcareClaimById(claimId);
    if (claim) {
      if (!claim.processing.comments) {
        claim.processing.comments = [];
      }
      claim.processing.comments.push(newComment);
      this.updateHealthcareClaim(claimId, { processing: claim.processing });
    }

    return newComment;
  }

  // Dashboard data
  getCustomerDashboard(userId: string): CustomerDashboard {
    const userClaims = this.getClaimsBySubmitter(userId);
    const activeClaims = userClaims.filter(
      (claim) =>
        ![
          ClaimStatus.APPROVED,
          ClaimStatus.REJECTED,
          ClaimStatus.PAID,
          ClaimStatus.CLOSED,
        ].includes(claim.status),
    );

    return {
      activeClaims: activeClaims.slice(0, 5),
      recentClaims: userClaims.slice(0, 10),
      totalClaimsSubmitted: userClaims.length,
      totalAmountClaimed: userClaims.reduce(
        (sum, claim) => sum + claim.financial.requestedAmount,
        0,
      ),
      totalAmountReceived: userClaims
        .filter((claim) => claim.financial.approvedAmount)
        .reduce((sum, claim) => sum + (claim.financial.approvedAmount || 0), 0),
      notifications: [
        {
          id: "notif-1",
          message: "Hồ sơ HC240115001 đang được xử lý",
          type: "info",
          createdAt: "2024-01-15T10:00:00Z",
        },
      ],
    };
  }

  getTPADashboard(userId: string): TPADashboard {
    const assignedClaims = this.getClaimsByAssignee(userId);
    const pendingReview = assignedClaims.filter((claim) =>
      [ClaimStatus.UNDER_REVIEW, ClaimStatus.MEDICAL_REVIEW].includes(
        claim.status,
      ),
    );

    return {
      assignedClaims: assignedClaims.slice(0, 10),
      pendingReview,
      completedToday: assignedClaims.filter(
        (claim) =>
          claim.completedAt &&
          new Date(claim.completedAt).toDateString() ===
            new Date().toDateString(),
      ).length,
      averageProcessingTime: 24, // hours
      workload: {
        current: assignedClaims.length,
        capacity: 20,
      },
      performanceMetrics: {
        claimsProcessed: assignedClaims.filter((claim) => claim.completedAt)
          .length,
        accuracy: 0.94,
        customerSatisfaction: 0.88,
      },
    };
  }

  getInsuranceDashboard(): InsuranceDashboard {
    const pendingApproval = this.claims.filter((claim) =>
      [ClaimStatus.MEDICAL_REVIEW, ClaimStatus.UNDER_REVIEW].includes(
        claim.status,
      ),
    );

    const highValueClaims = this.claims.filter(
      (claim) => claim.financial.requestedAmount > 10000000,
    );

    return {
      pendingApproval,
      highValueClaims,
      suspiciousClaims: [], // Would be populated by fraud detection
      monthlyStats: {
        total: this.claims.length,
        byStatus: this.claims.reduce(
          (acc, claim) => {
            acc[claim.status] = (acc[claim.status] || 0) + 1;
            return acc;
          },
          {} as Record<ClaimStatus, number>,
        ),
        byType: this.claims.reduce(
          (acc, claim) => {
            acc[claim.type] = (acc[claim.type] || 0) + 1;
            return acc;
          },
          {} as Record<ClaimType, number>,
        ),
        averageProcessingTime: 48,
        totalPaid: this.claims
          .filter((claim) => claim.financial.approvedAmount)
          .reduce(
            (sum, claim) => sum + (claim.financial.approvedAmount || 0),
            0,
          ),
        averageClaimAmount:
          this.claims.reduce(
            (sum, claim) => sum + claim.financial.requestedAmount,
            0,
          ) / this.claims.length,
      },
      fraudAlerts: [],
    };
  }
}

export const healthcareDatabase = new HealthcareDatabase();
