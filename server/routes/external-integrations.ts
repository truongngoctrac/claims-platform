import { RequestHandler } from 'express';
import { integrationManager } from '../services/integrations/IntegrationManager';
import multer from 'multer';
import { z } from 'zod';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  }
});

// Validation schemas
const SMSRequestSchema = z.object({
  to: z.string().min(10),
  message: z.string().min(1),
  template: z.string().optional(),
  variables: z.record(z.string()).optional(),
  provider: z.enum(['viettel', 'vnpt']).optional()
});

const EmailRequestSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
  template: z.string().optional(),
  templateData: z.record(z.any()).optional()
});

const OCRRequestSchema = z.object({
  language: z.string().optional(),
  extractTables: z.boolean().optional(),
  extractForms: z.boolean().optional(),
  documentType: z.enum(['medical_record', 'prescription', 'invoice', 'insurance_card', 'lab_result']).optional()
});

const GeocodeRequestSchema = z.object({
  address: z.string().min(1)
});

const NearbySearchSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusKm: z.number().optional(),
  specialties: z.array(z.string()).optional()
});

const IdentityVerificationSchema = z.object({
  document: z.object({
    type: z.enum(['national_id', 'passport', 'driving_license', 'insurance_card']),
    frontImage: z.string(),
    backImage: z.string().optional(),
    number: z.string(),
    issuedDate: z.string().optional(),
    expiryDate: z.string().optional(),
    issuer: z.string().optional()
  }),
  personalInfo: z.object({
    fullName: z.string(),
    dateOfBirth: z.string(),
    gender: z.enum(['M', 'F']).optional(),
    nationality: z.string().optional(),
    placeOfBirth: z.string().optional(),
    address: z.string().optional(),
    phoneNumber: z.string().optional(),
    email: z.string().email().optional()
  }),
  verificationLevel: z.enum(['basic', 'enhanced', 'premium']),
  purpose: z.enum(['insurance_claim', 'account_opening', 'identity_check'])
});

// SMS Gateway Endpoints
export const sendSMS: RequestHandler = async (req, res) => {
  try {
    const { to, message, template, variables, provider } = SMSRequestSchema.parse(req.body);
    
    const result = await integrationManager.sendSMS(to, message, template, variables, provider);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
};

export const sendOTP: RequestHandler = async (req, res) => {
  try {
    const { phoneNumber, code, provider } = z.object({
      phoneNumber: z.string(),
      code: z.string(),
      provider: z.enum(['viettel', 'vnpt']).optional()
    }).parse(req.body);
    
    const result = await integrationManager.sendOTP(phoneNumber, code, provider);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
};

// Email Service Endpoints
export const sendEmail: RequestHandler = async (req, res) => {
  try {
    const { to, subject, html, text } = EmailRequestSchema.parse(req.body);
    
    const result = await integrationManager.sendEmail(to, subject, { html, text });
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
};

export const sendWelcomeEmail: RequestHandler = async (req, res) => {
  try {
    const { userEmail, userName, temporaryPassword } = z.object({
      userEmail: z.string().email(),
      userName: z.string(),
      temporaryPassword: z.string().optional()
    }).parse(req.body);
    
    const result = await integrationManager.sendWelcomeEmail(userEmail, userName, temporaryPassword);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
};

export const sendClaimNotificationEmail: RequestHandler = async (req, res) => {
  try {
    const { userEmail, userName, claimId, status, claimAmount, rejectionReason } = z.object({
      userEmail: z.string().email(),
      userName: z.string(),
      claimId: z.string(),
      status: z.enum(['submitted', 'approved', 'rejected']),
      claimAmount: z.number().optional(),
      rejectionReason: z.string().optional()
    }).parse(req.body);
    
    const result = await integrationManager.sendClaimNotificationEmail(
      userEmail, userName, claimId, status, claimAmount, rejectionReason
    );
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
};

// Cloud Storage Endpoints
export const uploadFile: RequestHandler = async (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: 'File upload failed: ' + err.message
      });
    }

    try {
      if (!req.file) {
        throw new Error('No file provided');
      }

      const { folder, contentType } = req.body;
      
      const result = await integrationManager.uploadFile(
        req.file.buffer,
        req.file.originalname,
        folder,
        contentType || req.file.mimetype
      );
      
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    }
  });
};

export const getPresignedUploadUrl: RequestHandler = async (req, res) => {
  try {
    const { key, expirationSeconds } = z.object({
      key: z.string(),
      expirationSeconds: z.number().optional()
    }).parse(req.body);
    
    const result = await integrationManager.getPresignedUploadUrl(key, expirationSeconds);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
};

// OCR Service Endpoints
export const extractText: RequestHandler = async (req, res) => {
  upload.single('document')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: 'File upload failed: ' + err.message
      });
    }

    try {
      if (!req.file) {
        throw new Error('No document provided');
      }

      const options = OCRRequestSchema.parse(req.body);
      
      const result = await integrationManager.extractTextFromDocument(
        {
          content: req.file.buffer,
          mimeType: req.file.mimetype,
          filename: req.file.originalname
        },
        options
      );
      
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'OCR processing failed'
      });
    }
  });
};

export const extractHealthcareDocument: RequestHandler = async (req, res) => {
  upload.single('document')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: 'File upload failed: ' + err.message
      });
    }

    try {
      if (!req.file) {
        throw new Error('No document provided');
      }

      const { documentType } = z.object({
        documentType: z.enum(['medical_record', 'prescription', 'invoice', 'insurance_card', 'lab_result'])
      }).parse(req.body);
      
      const result = await integrationManager.extractHealthcareDocument(
        {
          content: req.file.buffer,
          mimeType: req.file.mimetype,
          filename: req.file.originalname
        },
        documentType
      );
      
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Healthcare document processing failed'
      });
    }
  });
};

// Maps Service Endpoints
export const geocodeAddress: RequestHandler = async (req, res) => {
  try {
    const { address } = GeocodeRequestSchema.parse(req.body);
    
    const result = await integrationManager.geocodeAddress(address);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Geocoding failed'
    });
  }
};

export const findNearbyHospitals: RequestHandler = async (req, res) => {
  try {
    const { lat, lng, radiusKm } = NearbySearchSchema.parse(req.body);
    
    const result = await integrationManager.findNearbyHospitals({ lat, lng }, radiusKm);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Hospital search failed'
    });
  }
};

export const findNearbyPharmacies: RequestHandler = async (req, res) => {
  try {
    const { lat, lng, radiusKm } = NearbySearchSchema.parse(req.body);
    
    const result = await integrationManager.findNearbyPharmacies({ lat, lng }, radiusKm);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Pharmacy search failed'
    });
  }
};

// Identity Verification Endpoints
export const verifyIdentity: RequestHandler = async (req, res) => {
  try {
    const request = IdentityVerificationSchema.parse(req.body);
    
    const result = await integrationManager.verifyIdentity(request);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Identity verification failed'
    });
  }
};

// Government API Endpoints
export const verifyCitizen: RequestHandler = async (req, res) => {
  try {
    const { nationalId } = z.object({
      nationalId: z.string()
    }).parse(req.body);
    
    const result = await integrationManager.verifyCitizen(nationalId);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Citizen verification failed'
    });
  }
};

export const verifyInsurance: RequestHandler = async (req, res) => {
  try {
    const { cardNumber, nationalId } = z.object({
      cardNumber: z.string(),
      nationalId: z.string().optional()
    }).parse(req.body);
    
    const result = await integrationManager.verifyInsurance(cardNumber, nationalId);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Insurance verification failed'
    });
  }
};

// Hospital Database Endpoints
export const findHospitalsByLocation: RequestHandler = async (req, res) => {
  try {
    const { lat, lng, radiusKm, specialties } = NearbySearchSchema.parse(req.body);
    
    const result = await integrationManager.findHospitalsByLocation({ lat, lng }, radiusKm, specialties);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Hospital search failed'
    });
  }
};

export const getPatientMedicalHistory: RequestHandler = async (req, res) => {
  try {
    const { patientId, hospitalIds } = z.object({
      patientId: z.string(),
      hospitalIds: z.array(z.string()).optional()
    }).parse(req.body);
    
    const result = await integrationManager.getPatientMedicalHistory(patientId, hospitalIds);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Medical history retrieval failed'
    });
  }
};

// Comprehensive Claim Processing
export const processClaimComprehensively: RequestHandler = async (req, res) => {
  upload.array('documents', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: 'File upload failed: ' + err.message
      });
    }

    try {
      const { patientInfo, insuranceInfo, hospitalInfo, treatments, totalAmount } = req.body;
      
      if (!req.files || !Array.isArray(req.files)) {
        throw new Error('No documents provided');
      }

      const documents = req.files.map((file: Express.Multer.File, index) => ({
        content: file.buffer,
        mimeType: file.mimetype,
        filename: file.originalname,
        type: req.body[`documentTypes[${index}]`] || 'medical_record'
      }));

      const claimData = {
        patientInfo: JSON.parse(patientInfo),
        insuranceInfo: JSON.parse(insuranceInfo),
        hospitalInfo: JSON.parse(hospitalInfo),
        documents,
        treatments: JSON.parse(treatments),
        totalAmount: parseFloat(totalAmount)
      };
      
      const result = await integrationManager.processClaimComprehensively(claimData);
      
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Comprehensive claim processing failed'
      });
    }
  });
};

// Health and Monitoring Endpoints
export const getHealthStatus: RequestHandler = async (req, res) => {
  try {
    const healthStatus = integrationManager.getHealthStatus();
    
    res.json({
      success: true,
      data: healthStatus,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
};

export const getMetrics: RequestHandler = async (req, res) => {
  try {
    const { service } = req.query;
    
    const metrics = integrationManager.getServiceMetrics(service as string);
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Metrics retrieval failed'
    });
  }
};

export const getRateLimitStatus: RequestHandler = async (req, res) => {
  try {
    const rateLimits = integrationManager.getRateLimitStatus();
    
    res.json({
      success: true,
      data: rateLimits,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Rate limit status retrieval failed'
    });
  }
};
