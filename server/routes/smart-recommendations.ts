import { RequestHandler } from 'express';
import { 
  SmartRecommendationsEngine, 
  createSmartRecommendationsEngine,
  DEFAULT_SMART_RECOMMENDATIONS_CONFIG 
} from '../../ai-ml/smart-recommendations';

// Initialize the smart recommendations engine
const recommendationsEngine = createSmartRecommendationsEngine({
  enableDocumentRecommendations: true,
  enableFormAutoFill: true,
  enableProcessOptimization: true,
  enablePolicyRecommendations: true,
  enableNextBestActions: true,
  enablePersonalization: true,
  enableContentRecommendations: true,
  enableSmartNotifications: true,
  enableUXOptimization: true,
  learningEnabled: true,
  cacheRecommendations: true
});

// Initialize engine on module load
recommendationsEngine.initialize().catch(error => {
  console.error('Failed to initialize Smart Recommendations Engine:', error);
});

// Main recommendation endpoints
export const getRecommendations: RequestHandler = async (req, res) => {
  try {
    const { userId, context, types, options } = req.body;
    
    if (!userId || !context) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId and context' 
      });
    }

    const recommendations = await recommendationsEngine.getRecommendations(
      userId, 
      context, 
      types, 
      options
    );
    
    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
      timestamp: new Date().toISOString(),
      service: 'smart_recommendations'
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ 
      error: 'Failed to get recommendations',
      details: error.message 
    });
  }
};

export const getDocumentRecommendations: RequestHandler = async (req, res) => {
  try {
    const service = recommendationsEngine.getDocumentRecommendations();
    if (!service) {
      return res.status(503).json({ 
        error: 'Document recommendations service not available' 
      });
    }

    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ 
        error: 'Missing input data for document recommendations' 
      });
    }

    const recommendations = await service.recommend(input);
    
    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
      timestamp: new Date().toISOString(),
      service: 'document_recommendations'
    });

  } catch (error) {
    console.error('Document recommendations error:', error);
    res.status(500).json({ 
      error: 'Failed to get document recommendations',
      details: error.message 
    });
  }
};

export const getFormAutoFillSuggestions: RequestHandler = async (req, res) => {
  try {
    const service = recommendationsEngine.getFormAutoFill();
    if (!service) {
      return res.status(503).json({ 
        error: 'Form auto-fill service not available' 
      });
    }

    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ 
        error: 'Missing input data for form auto-fill' 
      });
    }

    const recommendations = await service.recommend(input);
    
    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
      timestamp: new Date().toISOString(),
      service: 'form_autofill'
    });

  } catch (error) {
    console.error('Form auto-fill error:', error);
    res.status(500).json({ 
      error: 'Failed to get form auto-fill suggestions',
      details: error.message 
    });
  }
};

export const submitFeedback: RequestHandler = async (req, res) => {
  try {
    const { feedback } = req.body;
    if (!feedback || !Array.isArray(feedback)) {
      return res.status(400).json({ 
        error: 'Missing or invalid feedback array' 
      });
    }

    await recommendationsEngine.submitFeedback(feedback);
    
    res.json({
      success: true,
      feedbackProcessed: feedback.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ 
      error: 'Failed to submit feedback',
      details: error.message 
    });
  }
};

// Engine management endpoints
export const getEngineStatus: RequestHandler = async (req, res) => {
  try {
    const status = recommendationsEngine.getEngineStatus();
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Engine status error:', error);
    res.status(500).json({ 
      error: 'Failed to get engine status',
      details: error.message 
    });
  }
};

export const getEngineMetrics: RequestHandler = async (req, res) => {
  try {
    const metrics = recommendationsEngine.getEngineMetrics();
    
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Engine metrics error:', error);
    res.status(500).json({ 
      error: 'Failed to get engine metrics',
      details: error.message 
    });
  }
};

export const getEngineConfig: RequestHandler = async (req, res) => {
  try {
    const config = recommendationsEngine.getConfig();
    
    res.json({
      success: true,
      config,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Engine config error:', error);
    res.status(500).json({ 
      error: 'Failed to get engine config',
      details: error.message 
    });
  }
};

export const updateEngineConfig: RequestHandler = async (req, res) => {
  try {
    const { config } = req.body;
    if (!config) {
      return res.status(400).json({ 
        error: 'Missing config in request body' 
      });
    }

    recommendationsEngine.updateConfig(config);
    const updatedConfig = recommendationsEngine.getConfig();
    
    res.json({
      success: true,
      config: updatedConfig,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Engine config update error:', error);
    res.status(500).json({ 
      error: 'Failed to update engine config',
      details: error.message 
    });
  }
};

// Demo endpoints with sample data
export const demoDocumentRecommendations: RequestHandler = async (req, res) => {
  try {
    const service = recommendationsEngine.getDocumentRecommendations();
    if (!service) {
      return res.status(503).json({ 
        error: 'Document recommendations service not available' 
      });
    }

    // Sample document recommendation input
    const sampleInput = {
      userId: 'DEMO-USER-001',
      claimType: 'medical',
      claimAmount: 3000000, // 3M VND
      customerProfile: {
        age: 35,
        gender: 'male',
        medicalHistory: ['hypertension', 'diabetes'],
        policyType: 'comprehensive',
        previousClaims: 3,
        riskProfile: 'low',
        preferredLanguage: 'vietnamese'
      },
      medicalCondition: {
        primaryDiagnosis: 'Type 2 Diabetes',
        secondaryDiagnoses: ['Hypertension'],
        severity: 'moderate',
        chronic: true,
        treatmentType: 'medication_management',
        specialtyRequired: ['endocrinology']
      },
      providerInfo: {
        providerId: 'PROV-001',
        type: 'hospital',
        specialty: ['internal_medicine', 'endocrinology'],
        accreditation: ['JCI', 'MOH'],
        reputation: 4.5
      },
      currentDocuments: [
        {
          type: 'medical_report',
          quality: 0.6,
          completeness: 0.7,
          uploaded: true,
          issues: ['poor_image_quality', 'missing_signature']
        }
      ],
      context: {
        userId: 'DEMO-USER-001',
        sessionId: 'demo-session',
        currentPage: 'claim_submission',
        userProfile: {},
        currentTask: 'document_upload',
        environmentVariables: {},
        timestamp: new Date(),
        locale: 'vi-VN',
        device: {
          type: 'mobile',
          os: 'Android',
          browser: 'Chrome',
          screen: { width: 375, height: 667, density: 2, orientation: 'portrait' },
          capabilities: { touch: true, camera: true, gps: true, offline: false, push_notifications: true }
        }
      }
    };

    const recommendations = await service.recommend(sampleInput);
    
    res.json({
      success: true,
      demo: true,
      recommendations,
      sampleInput,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Demo document recommendations error:', error);
    res.status(500).json({ 
      error: 'Failed to run demo document recommendations',
      details: error.message 
    });
  }
};

export const demoFormAutoFill: RequestHandler = async (req, res) => {
  try {
    const service = recommendationsEngine.getFormAutoFill();
    if (!service) {
      return res.status(503).json({ 
        error: 'Form auto-fill service not available' 
      });
    }

    // Sample form auto-fill input
    const sampleInput = {
      userId: 'DEMO-USER-002',
      formId: 'patient_registration_form',
      formType: 'patient_registration',
      currentData: {
        firstName: 'Nguyen',
        email: 'nguyen@email.com'
      },
      userProfile: {
        personalInfo: {
          firstName: 'Nguyen',
          lastName: 'Van A',
          fullName: 'Nguyen Van A',
          dateOfBirth: new Date('1985-06-15'),
          gender: 'male',
          nationality: 'Vietnamese',
          idNumber: '123456789',
          occupation: 'Software Engineer',
          employer: 'Tech Company',
          maritalStatus: 'married'
        },
        medicalInfo: {
          allergies: ['penicillin'],
          currentMedications: [{
            name: 'Metformin',
            dosage: '500mg',
            frequency: 'twice daily',
            prescribedBy: 'Dr. Smith',
            startDate: new Date('2023-01-01')
          }],
          medicalHistory: [],
          emergencyConditions: [],
          bloodType: 'O+',
          height: 175,
          weight: 70,
          primaryPhysician: {
            name: 'Dr. Tran',
            specialty: 'Internal Medicine',
            phoneNumber: '+84123456789',
            address: { street: '123 Medical St', city: 'Ho Chi Minh City', state: 'Ho Chi Minh', zipCode: '700000', country: 'Vietnam' },
            licenseNumber: 'MD12345'
          }
        },
        insuranceInfo: {
          policyNumber: 'POL123456',
          policyType: 'comprehensive',
          insuranceProvider: 'Vietnam Insurance',
          groupNumber: 'GRP001',
          effectiveDate: new Date('2023-01-01'),
          expirationDate: new Date('2024-01-01'),
          copayAmount: 200000,
          deductible: 1000000,
          coverageType: 'family'
        },
        contactInfo: {
          phoneNumber: '+84987654321',
          alternatePhone: '+84123456789',
          email: 'nguyen@email.com',
          alternateEmail: 'nguyen.alt@email.com',
          address: { street: '456 Main St', city: 'Ho Chi Minh City', state: 'Ho Chi Minh', zipCode: '700000', country: 'Vietnam' },
          mailingAddress: { street: '456 Main St', city: 'Ho Chi Minh City', state: 'Ho Chi Minh', zipCode: '700000', country: 'Vietnam' },
          preferredContactMethod: 'email',
          preferredLanguage: 'vietnamese'
        },
        emergencyContact: {
          name: 'Le Thi B',
          relationship: 'spouse',
          phoneNumber: '+84987654322',
          alternatePhone: '',
          address: { street: '456 Main St', city: 'Ho Chi Minh City', state: 'Ho Chi Minh', zipCode: '700000', country: 'Vietnam' }
        },
        preferences: {
          autoFillEnabled: true,
          saveFormData: true,
          suggestionsEnabled: true,
          validationLevel: 'standard',
          completionReminders: true,
          dataSharing: 'standard'
        },
        history: {
          completedForms: [],
          averageCompletionTime: 180,
          commonErrors: [],
          abandonmentReasons: [],
          preferredFieldOrder: []
        }
      },
      context: {
        userId: 'DEMO-USER-002',
        sessionId: 'demo-session-2',
        currentPage: 'patient_registration',
        userProfile: {},
        currentTask: 'form_completion',
        environmentVariables: {},
        timestamp: new Date(),
        locale: 'vi-VN',
        device: {
          type: 'desktop',
          os: 'Windows',
          browser: 'Chrome',
          screen: { width: 1920, height: 1080, density: 1, orientation: 'landscape' },
          capabilities: { touch: false, camera: false, gps: false, offline: false, push_notifications: true }
        }
      },
      preferences: {
        autoSave: true,
        showSuggestions: true,
        validationTiming: 'on_blur',
        progressTracking: true,
        smartDefaults: true
      }
    };

    const recommendations = await service.recommend(sampleInput);
    
    res.json({
      success: true,
      demo: true,
      recommendations,
      sampleInput,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Demo form auto-fill error:', error);
    res.status(500).json({ 
      error: 'Failed to run demo form auto-fill',
      details: error.message 
    });
  }
};

export const demoAllRecommendations: RequestHandler = async (req, res) => {
  try {
    const userId = 'DEMO-USER-ALL';
    const context = {
      userId,
      sessionId: 'demo-session-all',
      currentPage: 'dashboard',
      userProfile: {},
      currentTask: 'general_browsing',
      environmentVariables: {},
      timestamp: new Date(),
      locale: 'vi-VN',
      device: {
        type: 'mobile',
        os: 'iOS',
        browser: 'Safari',
        screen: { width: 375, height: 812, density: 3, orientation: 'portrait' },
        capabilities: { touch: true, camera: true, gps: true, offline: false, push_notifications: true }
      }
    };

    const options = {
      maxResults: 15,
      minConfidence: 0.5
    };

    const recommendations = await recommendationsEngine.getRecommendations(
      userId, 
      context, 
      undefined, // Get all types
      options
    );
    
    res.json({
      success: true,
      demo: true,
      recommendations,
      count: recommendations.length,
      context,
      options,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Demo all recommendations error:', error);
    res.status(500).json({ 
      error: 'Failed to run demo all recommendations',
      details: error.message 
    });
  }
};

// Service health check
export const performHealthCheck: RequestHandler = async (req, res) => {
  try {
    const status = recommendationsEngine.getEngineStatus();
    const metrics = recommendationsEngine.getEngineMetrics();
    
    const healthy = status.healthyServices === status.totalServices;
    const statusCode = healthy ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthy,
      status,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      error: 'Failed to perform health check',
      details: error.message 
    });
  }
};

// Export the recommendations engine for use in other modules
export { recommendationsEngine };
