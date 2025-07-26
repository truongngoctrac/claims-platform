import { RequestHandler } from "express";
import { AuthRequest } from "../auth";
import { DocumentType } from "../../shared/healthcare";

// Mock BHXH (Social Insurance) Integration
export const handleBHXHEligibilityCheck: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    const { nationalId, insuranceCard } = req.body;

    if (!nationalId || !insuranceCard) {
      return res.status(400).json({
        success: false,
        message: "National ID and insurance card number are required",
      });
    }

    // Mock BHXH API response
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API delay

    const mockEligibility = {
      eligible: true,
      coverage: [
        "Ngoại trú",
        "Nội trú",
        "Cấp cứu",
        "Phẫu thuật",
        "Xét nghiệm",
        "Chẩn đoán hình ảnh",
      ],
      validUntil: "2024-12-31",
      maxCoverage: 50000000, // 50 million VND
      coPaymentRate: 0.2, // 20% co-payment
    };

    res.json({
      success: true,
      eligibility: mockEligibility,
      message: "BHXH eligibility check completed",
    });
  } catch (error) {
    console.error("BHXH eligibility check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check BHXH eligibility",
    });
  }
};

// Mock HIS/EMR Integration
export const handleHISPatientHistory: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    const { nationalId, hospitalCode } = req.body;

    if (!nationalId) {
      return res.status(400).json({
        success: false,
        message: "National ID is required",
      });
    }

    // Mock HIS API response
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API delay

    const mockHistory = {
      patient: {
        id: "HIS-PAT-001",
        name: "Nguyễn Văn An",
        dateOfBirth: "1985-03-15",
        gender: "male",
      },
      visits: [
        {
          visitId: "VISIT-2024-001",
          date: "2024-01-14",
          hospitalCode: "CR001",
          hospitalName: "Bệnh viện Chợ Rẫy",
          department: "Khoa Tai Mũi Họng",
          doctorName: "BS. Lê Thị Hoa",
          diagnosis: "Viêm họng cấp",
          icd10Code: "J02.9",
          treatment: "Kê đơn thuốc kháng sinh, súc miệng",
          cost: 450000,
          status: "completed",
        },
        {
          visitId: "VISIT-2023-089",
          date: "2023-11-22",
          hospitalCode: "CR001",
          hospitalName: "Bệnh viện Chợ Rẫy",
          department: "Khoa Nội tổng hợp",
          doctorName: "BS. Phạm Văn Tuấn",
          diagnosis: "Khám sức khỏe định kỳ",
          icd10Code: "Z00.0",
          treatment: "Tư vấn dinh dưỡng, tập thể dục",
          cost: 250000,
          status: "completed",
        },
      ],
      totalVisits: 12,
      lastVisit: "2024-01-14",
    };

    res.json({
      success: true,
      patientHistory: mockHistory,
      message: "Patient history retrieved successfully",
    });
  } catch (error) {
    console.error("HIS patient history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve patient history",
    });
  }
};

// Mock OCR Service
export const handleOCRProcessDocument: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    const { fileUrl, documentType } = req.body;

    if (!fileUrl || !documentType) {
      return res.status(400).json({
        success: false,
        message: "File URL and document type are required",
      });
    }

    // Mock OCR processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let mockOCRResult;

    switch (documentType) {
      case DocumentType.MEDICAL_BILL:
        mockOCRResult = {
          extractedData: {
            text: "BÁO CÁO CHI PHÍ KHÁM CHỮA BỆNH\nBệnh viện Chợ Rẫy\nMã bệnh nhân: BN123456\nNgày khám: 14/01/2024\nTổng chi phí: 450,000 VND\nKhám bệnh: 200,000 VND\nThuốc: 250,000 VND",
            amounts: [450000, 200000, 250000],
            dates: ["2024-01-14"],
            hospitalName: "Bệnh viện Chợ Rẫy",
            patientId: "BN123456",
            services: [
              { name: "Khám bệnh", cost: 200000 },
              { name: "Thuốc", cost: 250000 },
            ],
          },
          confidence: 0.94,
        };
        break;

      case DocumentType.PRESCRIPTION:
        mockOCRResult = {
          extractedData: {
            text: "ĐơN THUỐC\nBS. Lê Thị Hoa\nAmoxicillin 500mg\nSố lượng: 14 viên\nCách dùng: 2 viên/ngày sau ăn\nThời gian: 7 ngày",
            medications: [
              {
                name: "Amoxicillin",
                dosage: "500mg",
                quantity: 14,
                usage: "2 viên/ngày sau ăn",
                duration: "7 ngày",
              },
            ],
            doctorName: "BS. Lê Thị Hoa",
            dates: ["2024-01-14"],
          },
          confidence: 0.91,
        };
        break;

      case DocumentType.TEST_RESULT:
        mockOCRResult = {
          extractedData: {
            text: "KẾT QUẢ XÉT NGHIỆM\nMẫu máu: 14/01/2024\nHemoglobin: 13.5 g/dL\nB���ch cầu: 8,200/µL\nTiểu cầu: 250,000/µL\nKết luận: Bình thường",
            testResults: [
              { parameter: "Hemoglobin", value: "13.5", unit: "g/dL" },
              { parameter: "Bạch cầu", value: "8,200", unit: "/µL" },
              { parameter: "Tiểu cầu", value: "250,000", unit: "/µL" },
            ],
            conclusion: "Bình thường",
            dates: ["2024-01-14"],
          },
          confidence: 0.96,
        };
        break;

      default:
        mockOCRResult = {
          extractedData: {
            text: "Extracted text from document...",
            amounts: [],
            dates: [],
          },
          confidence: 0.85,
        };
    }

    res.json({
      success: true,
      ocrResult: mockOCRResult,
      message: "Document processed successfully",
    });
  } catch (error) {
    console.error("OCR processing error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process document",
    });
  }
};

// Mock Payment Service
export const handleInitiatePayment: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    const { claimId, amount, paymentMethod, bankDetails } = req.body;

    if (!claimId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Claim ID, amount, and payment method are required",
      });
    }

    // Mock payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockPaymentResult = {
      paymentId: `PAY-${Date.now()}`,
      transactionId: `TXN-${Math.random().toString(36).substr(2, 9)}`,
      status: "success",
      amount,
      fee: Math.round(amount * 0.001), // 0.1% fee
      processedAt: new Date().toISOString(),
      bankResponse: {
        responseCode: "00",
        message: "Giao dịch thành công",
      },
    };

    res.json({
      success: true,
      payment: mockPaymentResult,
      message: "Payment initiated successfully",
    });
  } catch (error) {
    console.error("Payment initiation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate payment",
    });
  }
};

// Mock Insurance Company API
export const handleInsuranceCompanyNotification: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    const { insuranceCompanyId, claimId, status, amount } = req.body;

    if (!insuranceCompanyId || !claimId || !status) {
      return res.status(400).json({
        success: false,
        message: "Insurance company ID, claim ID, and status are required",
      });
    }

    // Mock API call to insurance company
    await new Promise((resolve) => setTimeout(resolve, 800));

    const mockInsuranceResponse = {
      acknowledged: true,
      referenceId: `INS-${Date.now()}`,
      message: "Claim status updated successfully",
      nextAction:
        status === "approved"
          ? "Proceed with payment"
          : status === "rejected"
            ? "Notify customer of rejection"
            : "Await further review",
    };

    res.json({
      success: true,
      insuranceResponse: mockInsuranceResponse,
      message: "Insurance company notified successfully",
    });
  } catch (error) {
    console.error("Insurance notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to notify insurance company",
    });
  }
};

// Mock Fraud Detection Service
export const handleFraudDetection: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    const { claimId, patientData, medicalData, financialData } = req.body;

    if (!claimId) {
      return res.status(400).json({
        success: false,
        message: "Claim ID is required",
      });
    }

    // Mock fraud detection processing
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const mockFraudAnalysis = {
      riskScore: Math.random() * 100, // 0-100 risk score
      riskLevel:
        Math.random() > 0.8 ? "high" : Math.random() > 0.5 ? "medium" : "low",
      flags: [
        ...(Math.random() > 0.7 ? ["Multiple claims in short period"] : []),
        ...(Math.random() > 0.8 ? ["Unusual claim amount for diagnosis"] : []),
        ...(Math.random() > 0.9 ? ["Provider not in network"] : []),
      ],
      recommendations: [
        "Review patient medical history",
        "Verify treatment details with hospital",
        "Check for duplicate claims",
      ],
      confidence: 0.87,
      processedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      fraudAnalysis: mockFraudAnalysis,
      message: "Fraud detection analysis completed",
    });
  } catch (error) {
    console.error("Fraud detection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform fraud detection",
    });
  }
};

// Mock Digital Signature Verification
export const handleDigitalSignatureVerification: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    const { documentUrl, signatureData, certificateChain } = req.body;

    if (!documentUrl || !signatureData) {
      return res.status(400).json({
        success: false,
        message: "Document URL and signature data are required",
      });
    }

    // Mock signature verification processing
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const mockVerificationResult = {
      valid: Math.random() > 0.1, // 90% success rate
      signerInfo: {
        name: "BS. Lê Thị Hoa",
        organization: "Bệnh viện Chợ Rẫy",
        certificate: "VNPT-CA",
        validFrom: "2023-01-01",
        validTo: "2024-12-31",
      },
      verificationTime: new Date().toISOString(),
      trustLevel: "high",
      warnings: [],
    };

    res.json({
      success: true,
      verification: mockVerificationResult,
      message: "Digital signature verified successfully",
    });
  } catch (error) {
    console.error("Digital signature verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify digital signature",
    });
  }
};
