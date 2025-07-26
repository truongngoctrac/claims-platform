import { RequestHandler, Router } from 'express';
import { DocumentAI, DEFAULT_CONFIG, DocumentProcessingRequest, DocumentProcessingResult } from '../../ai-ml/document-ai';
import multer from 'multer';
import { z } from 'zod';

// Initialize DocumentAI instance
const documentAI = new DocumentAI(DEFAULT_CONFIG);
let aiInitialized = false;

// Initialize AI/ML system
const initializeAI = async () => {
  if (!aiInitialized) {
    try {
      await documentAI.initialize();
      aiInitialized = true;
      console.log('AI/ML Document Processing system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI/ML system:', error);
      throw error;
    }
  }
};

// Setup multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  }
});

// Validation schemas
const ProcessingOptionsSchema = z.object({
  enableOCR: z.boolean().default(true),
  enableClassification: z.boolean().default(true),
  enableExtraction: z.boolean().default(true),
  enableSimilarityCheck: z.boolean().default(true),
  enableFraudDetection: z.boolean().default(true),
  enableQualityCheck: z.boolean().default(true),
  preprocessingOptions: z.object({
    denoise: z.boolean().default(true),
    deskew: z.boolean().default(true),
    enhance: z.boolean().default(true),
    binarize: z.boolean().default(false),
    removeBackground: z.boolean().default(false),
    resolutionEnhancement: z.boolean().default(false),
    contrastOptimization: z.boolean().default(true)
  }).default({}),
  extractionLevel: z.enum(['basic', 'standard', 'comprehensive']).default('standard'),
  confidenceThreshold: z.number().min(0).max(1).default(0.7)
});

const TrainingDataSchema = z.object({
  modelType: z.enum(['ocr', 'classification', 'extraction']),
  trainingData: z.array(z.any()),
  validationData: z.array(z.any()).optional(),
  hyperparameters: z.record(z.any()).default({})
});

// Route handlers
export const processDocument: RequestHandler = async (req, res) => {
  try {
    await initializeAI();

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Validate processing options
    const optionsValidation = ProcessingOptionsSchema.safeParse(req.body.options || {});
    if (!optionsValidation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid processing options',
        details: optionsValidation.error.issues
      });
    }

    const options = optionsValidation.data;

    // Create processing request
    const request: DocumentProcessingRequest = {
      documentId: req.body.documentId || `doc_${Date.now()}`,
      documentBuffer: req.file.buffer,
      metadata: {
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.body.uploadedBy || 'anonymous',
        uploadedAt: new Date(),
        source: 'api_upload',
        language: req.body.language || 'vietnamese',
        expectedDocumentType: req.body.expectedDocumentType
      },
      options
    };

    // Process document
    const result: DocumentProcessingResult = await documentAI.processDocument(request);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during document processing',
      message: error.message
    });
  }
};

export const batchProcessDocuments: RequestHandler = async (req, res) => {
  try {
    await initializeAI();

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded for batch processing'
      });
    }

    const files = req.files as Express.Multer.File[];
    const options = ProcessingOptionsSchema.parse(req.body.options || {});

    // Create processing requests for all files
    const requests: DocumentProcessingRequest[] = files.map((file, index) => ({
      documentId: req.body.documentIds?.[index] || `batch_doc_${Date.now()}_${index}`,
      documentBuffer: file.buffer,
      metadata: {
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadedBy: req.body.uploadedBy || 'anonymous',
        uploadedAt: new Date(),
        source: 'api_batch_upload',
        language: req.body.language || 'vietnamese'
      },
      options
    }));

    // Add to processing queue
    for (const request of requests) {
      await documentAI.addDocumentToQueue(request);
    }

    // Process queue
    const results = await documentAI.processQueue();

    res.json({
      success: true,
      data: {
        processedCount: results.length,
        results
      }
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during batch processing',
      message: error.message
    });
  }
};

export const trainModel: RequestHandler = async (req, res) => {
  try {
    await initializeAI();

    const validation = TrainingDataSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid training data format',
        details: validation.error.issues
      });
    }

    const { modelType, trainingData, validationData, hyperparameters } = validation.data;

    // Start training
    const trainingResult = await documentAI.trainModel(
      modelType === 'ocr' ? 'ocr_trainer' : 'classifier',
      trainingData
    );

    res.json({
      success: true,
      data: trainingResult
    });

  } catch (error) {
    console.error('Model training error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during model training',
      message: error.message
    });
  }
};

export const getSystemStatus: RequestHandler = async (req, res) => {
  try {
    const status = documentAI.getStatus();
    const metrics = documentAI.getMetrics();
    const statistics = documentAI.getProcessingStatistics();

    res.json({
      success: true,
      data: {
        status,
        metrics,
        statistics,
        components: {
          ocr: documentAI.getComponentStatus('ocr_trainer'),
          classifier: documentAI.getComponentStatus('classifier'),
          extractor: documentAI.getComponentStatus('extractor'),
          similarity: documentAI.getComponentStatus('similarity'),
          fraud: documentAI.getComponentStatus('fraud'),
          monitor: documentAI.getComponentStatus('monitor')
        }
      }
    });

  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      message: error.message
    });
  }
};

export const getPerformanceMetrics: RequestHandler = async (req, res) => {
  try {
    const componentName = req.params.component;
    
    if (componentName) {
      const metrics = documentAI.getComponentMetrics(componentName);
      const status = documentAI.getComponentStatus(componentName);
      
      if (!metrics || !status) {
        return res.status(404).json({
          success: false,
          error: 'Component not found'
        });
      }

      res.json({
        success: true,
        data: { metrics, status }
      });
    } else {
      const overallMetrics = documentAI.getMetrics();
      const overallStatus = documentAI.getStatus();
      
      res.json({
        success: true,
        data: {
          overall: { metrics: overallMetrics, status: overallStatus },
          components: {
            ocr: {
              metrics: documentAI.getComponentMetrics('ocr_trainer'),
              status: documentAI.getComponentStatus('ocr_trainer')
            },
            classifier: {
              metrics: documentAI.getComponentMetrics('classifier'),
              status: documentAI.getComponentStatus('classifier')
            },
            extractor: {
              metrics: documentAI.getComponentMetrics('extractor'),
              status: documentAI.getComponentStatus('extractor')
            }
          }
        }
      });
    }

  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics',
      message: error.message
    });
  }
};

export const updateConfiguration: RequestHandler = async (req, res) => {
  try {
    const newConfig = req.body;
    
    // Validate config structure (basic validation)
    if (typeof newConfig !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Configuration must be an object'
      });
    }

    documentAI.updateConfig(newConfig);

    res.json({
      success: true,
      data: {
        message: 'Configuration updated successfully',
        config: documentAI.getConfig()
      }
    });

  } catch (error) {
    console.error('Configuration update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration',
      message: error.message
    });
  }
};

export const healthCheck: RequestHandler = async (req, res) => {
  try {
    const isHealthy = aiInitialized && documentAI.getStatus().isReady;
    
    if (isHealthy) {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        aiInitialized,
        memoryUsage: process.memoryUsage()
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        reason: !aiInitialized ? 'AI system not initialized' : 'AI system not ready'
      });
    }

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

// Create and configure router
const router = Router();

// Health check endpoint
router.get('/health', healthCheck);

// Document processing endpoints
router.post('/process', upload.single('document'), processDocument);
router.post('/batch-process', upload.array('documents', 10), batchProcessDocuments);

// Model training endpoint
router.post('/train', trainModel);

// System monitoring endpoints
router.get('/status', getSystemStatus);
router.get('/metrics', getPerformanceMetrics);
router.get('/metrics/:component', getPerformanceMetrics);

// Configuration endpoints
router.put('/config', updateConfiguration);
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: documentAI.getConfig()
  });
});

// Initialize AI system on startup
initializeAI().catch(console.error);

export default router;
