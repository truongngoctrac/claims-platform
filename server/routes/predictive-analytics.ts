import { RequestHandler } from 'express';
import { 
  PredictiveAnalyticsEngine, 
  createPredictiveAnalyticsEngine,
  DEFAULT_PREDICTIVE_ANALYTICS_CONFIG 
} from '../../ai-ml/predictive-analytics';

// Initialize the predictive analytics engine
const predictiveEngine = createPredictiveAnalyticsEngine({
  enableProcessingTimePrediction: true,
  enableClaimApprovalScoring: true,
  enableRiskAssessment: true,
  cachingEnabled: true,
  batchProcessingEnabled: true,
  realTimeProcessingEnabled: true
});

// Initialize engine on module load
predictiveEngine.initialize().catch(error => {
  console.error('Failed to initialize Predictive Analytics Engine:', error);
});

// Processing Time Prediction Endpoints
export const predictProcessingTime: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getProcessingTimePrediction();
    if (!service) {
      return res.status(503).json({ 
        error: 'Processing time prediction service not available' 
      });
    }

    const { claimData } = req.body;
    if (!claimData) {
      return res.status(400).json({ 
        error: 'Missing claimData in request body' 
      });
    }

    const prediction = await service.predict(claimData);
    
    res.json({
      success: true,
      prediction,
      timestamp: new Date().toISOString(),
      service: 'processing_time_prediction'
    });

  } catch (error) {
    console.error('Processing time prediction error:', error);
    res.status(500).json({ 
      error: 'Failed to predict processing time',
      details: error.message 
    });
  }
};

export const trainProcessingTimeModel: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getProcessingTimePrediction();
    if (!service) {
      return res.status(503).json({ 
        error: 'Processing time prediction service not available' 
      });
    }

    const { trainingData, options } = req.body;
    if (!trainingData) {
      return res.status(400).json({ 
        error: 'Missing trainingData in request body' 
      });
    }

    const result = await service.train(trainingData, options);
    
    res.json({
      success: true,
      trainingResult: result,
      timestamp: new Date().toISOString(),
      service: 'processing_time_prediction'
    });

  } catch (error) {
    console.error('Processing time model training error:', error);
    res.status(500).json({ 
      error: 'Failed to train processing time model',
      details: error.message 
    });
  }
};

// Claim Approval Scoring Endpoints
export const scoreClaimApproval: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getClaimApprovalScoring();
    if (!service) {
      return res.status(503).json({ 
        error: 'Claim approval scoring service not available' 
      });
    }

    const { claimData } = req.body;
    if (!claimData) {
      return res.status(400).json({ 
        error: 'Missing claimData in request body' 
      });
    }

    const scoring = await service.predict(claimData);
    
    res.json({
      success: true,
      scoring,
      timestamp: new Date().toISOString(),
      service: 'claim_approval_scoring'
    });

  } catch (error) {
    console.error('Claim approval scoring error:', error);
    res.status(500).json({ 
      error: 'Failed to score claim approval',
      details: error.message 
    });
  }
};

export const trainApprovalScoringModel: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getClaimApprovalScoring();
    if (!service) {
      return res.status(503).json({ 
        error: 'Claim approval scoring service not available' 
      });
    }

    const { trainingData, options } = req.body;
    if (!trainingData) {
      return res.status(400).json({ 
        error: 'Missing trainingData in request body' 
      });
    }

    const result = await service.train(trainingData, options);
    
    res.json({
      success: true,
      trainingResult: result,
      timestamp: new Date().toISOString(),
      service: 'claim_approval_scoring'
    });

  } catch (error) {
    console.error('Approval scoring model training error:', error);
    res.status(500).json({ 
      error: 'Failed to train approval scoring model',
      details: error.message 
    });
  }
};

// Risk Assessment Endpoints
export const assessRisk: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getRiskAssessment();
    if (!service) {
      return res.status(503).json({ 
        error: 'Risk assessment service not available' 
      });
    }

    const { assessmentInput } = req.body;
    if (!assessmentInput) {
      return res.status(400).json({ 
        error: 'Missing assessmentInput in request body' 
      });
    }

    const assessment = await service.predict(assessmentInput);
    
    res.json({
      success: true,
      assessment,
      timestamp: new Date().toISOString(),
      service: 'risk_assessment'
    });

  } catch (error) {
    console.error('Risk assessment error:', error);
    res.status(500).json({ 
      error: 'Failed to assess risk',
      details: error.message 
    });
  }
};

export const trainRiskAssessmentModel: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getRiskAssessment();
    if (!service) {
      return res.status(503).json({ 
        error: 'Risk assessment service not available' 
      });
    }

    const { trainingData, options } = req.body;
    if (!trainingData) {
      return res.status(400).json({ 
        error: 'Missing trainingData in request body' 
      });
    }

    const result = await service.train(trainingData, options);
    
    res.json({
      success: true,
      trainingResult: result,
      timestamp: new Date().toISOString(),
      service: 'risk_assessment'
    });

  } catch (error) {
    console.error('Risk assessment model training error:', error);
    res.status(500).json({ 
      error: 'Failed to train risk assessment model',
      details: error.message 
    });
  }
};

// Batch Processing Endpoints
export const processBatchPredictions: RequestHandler = async (req, res) => {
  try {
    const { requests } = req.body;
    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({ 
        error: 'Missing or invalid requests array in request body' 
      });
    }

    const responses = await predictiveEngine.processBatch(requests);
    
    res.json({
      success: true,
      responses,
      totalRequests: requests.length,
      successfulRequests: responses.filter(r => r.success).length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process batch predictions',
      details: error.message 
    });
  }
};

// Engine Management Endpoints
export const getEngineStatus: RequestHandler = async (req, res) => {
  try {
    const status = predictiveEngine.getEngineStatus();
    
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
    const metrics = predictiveEngine.getEngineMetrics();
    
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

export const performHealthCheck: RequestHandler = async (req, res) => {
  try {
    const healthCheck = await predictiveEngine.performHealthCheck();
    
    const statusCode = healthCheck.overallHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthCheck.overallHealthy,
      healthCheck,
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

export const getEngineConfig: RequestHandler = async (req, res) => {
  try {
    const config = predictiveEngine.getConfig();
    
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

    predictiveEngine.updateConfig(config);
    const updatedConfig = predictiveEngine.getConfig();
    
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

// Service-specific status endpoints
export const getProcessingTimeStatus: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getProcessingTimePrediction();
    if (!service) {
      return res.status(503).json({ 
        error: 'Processing time prediction service not available' 
      });
    }

    const status = service.getStatus();
    const metrics = service.getMetrics();
    const model = service.getModel();
    
    res.json({
      success: true,
      service: 'processing_time_prediction',
      status,
      metrics,
      model: {
        id: model.id,
        name: model.name,
        version: model.version,
        accuracy: model.accuracy,
        lastTrained: model.lastTrained
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Processing time status error:', error);
    res.status(500).json({ 
      error: 'Failed to get processing time service status',
      details: error.message 
    });
  }
};

export const getApprovalScoringStatus: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getClaimApprovalScoring();
    if (!service) {
      return res.status(503).json({ 
        error: 'Claim approval scoring service not available' 
      });
    }

    const status = service.getStatus();
    const metrics = service.getMetrics();
    const model = service.getModel();
    
    res.json({
      success: true,
      service: 'claim_approval_scoring',
      status,
      metrics,
      model: {
        id: model.id,
        name: model.name,
        version: model.version,
        accuracy: model.accuracy,
        lastTrained: model.lastTrained
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Approval scoring status error:', error);
    res.status(500).json({ 
      error: 'Failed to get approval scoring service status',
      details: error.message 
    });
  }
};

export const getRiskAssessmentStatus: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getRiskAssessment();
    if (!service) {
      return res.status(503).json({ 
        error: 'Risk assessment service not available' 
      });
    }

    const status = service.getStatus();
    const metrics = service.getMetrics();
    const model = service.getModel();
    
    res.json({
      success: true,
      service: 'risk_assessment',
      status,
      metrics,
      model: {
        id: model.id,
        name: model.name,
        version: model.version,
        accuracy: model.accuracy,
        lastTrained: model.lastTrained
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Risk assessment status error:', error);
    res.status(500).json({ 
      error: 'Failed to get risk assessment service status',
      details: error.message 
    });
  }
};

// Demo endpoints with sample data
export const demoProcessingTimePrediction: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getProcessingTimePrediction();
    if (!service) {
      return res.status(503).json({ 
        error: 'Processing time prediction service not available' 
      });
    }

    // Sample claim data
    const sampleClaimData = {
      claimId: 'DEMO-001',
      claimType: 'medical',
      amount: 5000000, // 5M VND
      complexity: 'moderate',
      submittedAt: new Date(),
      customerId: 'CUST-001',
      providerId: 'PROV-001',
      documents: [
        {
          type: 'medical_report',
          quality: 'good',
          completeness: 0.9,
          requiresReview: false,
          automatable: true
        }
      ],
      previousClaims: [],
      seasonality: [],
      workload: {
        queueLength: 25,
        averageWaitTime: 2.5,
        staffUtilization: 0.75,
        priority: 'medium'
      },
      staff: {
        availableStaff: 10,
        expertise: [
          { area: 'medical', level: 4, capacity: 80 }
        ],
        workload: 0.7,
        vacation: 0.1
      },
      external: []
    };

    const prediction = await service.predict(sampleClaimData);
    
    res.json({
      success: true,
      demo: true,
      prediction,
      sampleInput: sampleClaimData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Demo processing time prediction error:', error);
    res.status(500).json({ 
      error: 'Failed to run demo processing time prediction',
      details: error.message 
    });
  }
};

export const demoClaimApprovalScoring: RequestHandler = async (req, res) => {
  try {
    const service = predictiveEngine.getClaimApprovalScoring();
    if (!service) {
      return res.status(503).json({ 
        error: 'Claim approval scoring service not available' 
      });
    }

    // Sample claim approval data
    const sampleClaimData = {
      claimId: 'DEMO-002',
      customerId: 'CUST-002',
      providerId: 'PROV-002',
      claimType: 'medical',
      requestedAmount: 3000000, // 3M VND
      submittedAt: new Date(),
      documents: [
        {
          type: 'medical_report',
          quality: 'excellent',
          authenticity: {
            overall: 0.95,
            digital: 0.9,
            watermark: 0.95,
            metadata: 0.98,
            source: 0.92
          },
          completeness: 0.95,
          metadata: {
            createdAt: new Date(),
            source: 'hospital_system',
            version: '1.0',
            signatures: ['Dr. Nguyen'],
            modifications: 0
          }
        }
      ],
      customer: {
        age: 35,
        gender: 'male',
        riskProfile: {
          creditScore: 750,
          riskCategory: 'low',
          fraudHistory: {
            flaggedClaims: 0,
            suspiciousActivity: 0,
            lastIncident: null,
            riskLevel: 0.1
          },
          claimFrequency: 'low',
          behaviorScore: 0.8
        },
        history: {
          membershipDuration: 1095, // 3 years
          totalClaims: 5,
          totalPaid: 10000000, // 10M VND
          lastClaimDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
          disputeHistory: []
        },
        behavior: {
          submissionPatterns: [],
          communicationStyle: 'cooperative',
          responsiveness: 0.9,
          compliance: 0.95
        },
        demographics: {
          location: {
            region: 'Ho Chi Minh City',
            city: 'Ho Chi Minh City',
            riskLevel: 0.2,
            fraudRate: 0.05
          },
          occupation: 'engineer',
          income: 'high',
          familySize: 3,
          education: 'university'
        }
      },
      provider: {
        providerId: 'PROV-002',
        type: 'hospital',
        reputation: {
          rating: 4.5,
          accreditation: ['JCI', 'MOH'],
          certifications: ['ISO9001'],
          peerReviews: 150,
          patientSatisfaction: 4.2
        },
        history: {
          yearsInPractice: 15,
          totalClaims: 5000,
          approvalRate: 0.92,
          averageClaimAmount: 2500000,
          flaggedClaims: 25,
          auditResults: []
        },
        compliance: {
          violations: [],
          warnings: [],
          suspensions: [],
          lastAudit: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          complianceScore: 0.95
        },
        specialties: ['general_medicine', 'emergency']
      },
      policy: {
        policyId: 'POL-002',
        type: 'standard',
        coverage: {
          inpatient: { covered: true, percentage: 80, limits: { annual: 100000000 }, deductible: 500000, copay: 0 },
          outpatient: { covered: true, percentage: 70, limits: { annual: 50000000 }, deductible: 200000, copay: 50000 },
          emergency: { covered: true, percentage: 90, limits: { annual: 200000000 }, deductible: 0, copay: 0 },
          specialist: { covered: true, percentage: 75, limits: { annual: 75000000 }, deductible: 300000, copay: 100000 },
          pharmacy: { covered: true, percentage: 60, limits: { annual: 25000000 }, deductible: 100000, copay: 20000 },
          dental: { covered: false, percentage: 0, limits: { annual: 0 }, deductible: 0, copay: 0 },
          vision: { covered: false, percentage: 0, limits: { annual: 0 }, deductible: 0, copay: 0 }
        },
        limits: {
          annualLimit: 100000000,
          lifetimeLimit: 1000000000,
          perServiceLimit: 50000000,
          waitingPeriod: 30
        },
        status: 'active',
        exclusions: []
      },
      medical: {
        diagnosis: [
          {
            code: 'J44.1',
            description: 'Chronic obstructive pulmonary disease with acute exacerbation',
            severity: 'moderate',
            chronic: true,
            primary: true,
            confidence: 0.9
          }
        ],
        procedures: [
          {
            code: '94760',
            description: 'Noninvasive ear or pulse oximetry for oxygen saturation',
            necessity: 'necessary',
            cost: 500000,
            duration: 30,
            complexity: 'simple'
          }
        ],
        medications: [
          {
            name: 'Albuterol',
            dosage: '2.5mg',
            duration: '7 days',
            cost: 200000,
            necessity: true,
            alternatives: ['Salbutamol']
          }
        ],
        severity: 'moderate',
        chronicity: 'chronic',
        comorbidities: ['hypertension']
      },
      financial: {
        requestedAmount: 3000000,
        estimatedCost: 2800000,
        marketRate: 2900000,
        costRatio: 1.04,
        previousClaims: [
          { claimId: 'CLM-001', amount: 2000000, approved: true, paidAmount: 1600000, date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }
        ]
      },
      historical: {
        previousClaims: [
          { claimId: 'CLM-001', type: 'medical', amount: 2000000, approved: true, processingTime: 3, issues: [] }
        ],
        approvalRate: 1.0,
        averageAmount: 2000000,
        patterns: [],
        trends: []
      },
      external: {
        medicalDatabase: {
          diagnosisValid: true,
          procedureAppropriate: true,
          medicationNecessary: true,
          providerQualified: true,
          confidence: 0.95
        },
        providerVerification: {
          licensed: true,
          accredited: true,
          inNetwork: true,
          reputation: 4.5,
          riskLevel: 0.1
        },
        fraudDatabase: {
          blacklisted: false,
          suspiciousPatterns: [],
          riskScore: 0.05,
          similarCases: 0
        },
        governmentData: {
          patientVerified: true,
          providerVerified: true,
          facilityVerified: true,
          compliance: true
        }
      }
    };

    const scoring = await service.predict(sampleClaimData);
    
    res.json({
      success: true,
      demo: true,
      scoring,
      sampleInput: sampleClaimData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Demo claim approval scoring error:', error);
    res.status(500).json({ 
      error: 'Failed to run demo claim approval scoring',
      details: error.message 
    });
  }
};

// Export the predictive engine for use in other modules
export { predictiveEngine };
