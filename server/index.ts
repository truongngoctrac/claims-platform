import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { authenticate, authorize } from "./auth";
import { UserRole } from "../shared/auth";

// Import route handlers
import {
  handleLogin,
  handleRegister,
  handleProfile,
  handleLogout,
} from "./routes/auth";
import {
  handleGetClaims,
  handleGetClaim,
  handleAssignClaim,
  handleSelfAssignClaim,
  handleUpdateClaimStatus,
  handleGetUnassignedClaims,
} from "./routes/claims";
import {
  handleGetUsers,
  handleGetUsersByRole,
  handleGetClaimExecutives,
  handleGetUserAssignments,
  handleGetAllAssignments,
} from "./routes/users";
import {
  handleGetNotifications,
  handleMarkNotificationRead,
  handleCreateNotification,
  handleGetUnreadCount,
} from "./routes/notifications";

// Healthcare claims routes
import {
  handleGetHealthcareClaims,
  handleGetHealthcareClaim,
  handleCreateHealthcareClaim,
  handleSubmitHealthcareClaim,
  handleAssignHealthcareClaim,
  handleSelfAssignHealthcareClaim,
  handleReviewHealthcareClaim,
  handleAddClaimComment,
  handleGetCustomerDashboard,
  handleGetTPADashboard,
  handleGetInsuranceDashboard,
} from "./routes/healthcare-claims";

// AI/ML Document Processing routes
import aiMLRouter from "./routes/ai-ml-processing";

// Integration routes
import {
  handleBHXHEligibilityCheck,
  handleHISPatientHistory,
  handleOCRProcessDocument,
  handleInitiatePayment,
  handleInsuranceCompanyNotification,
  handleFraudDetection,
  handleDigitalSignatureVerification,
} from "./routes/integrations";

// Payment routes
import {
  handleProcessPayment,
  handleProcessRefund,
  handleGetPaymentStatus,
  handleSchedulePayment,
  handlePaymentWebhook,
  handleGetPaymentAnalytics,
  handleGenerateReport,
  handleReconcilePayments,
  handleGetReconciliationReports,
  handleCheckFraud,
  handleGetFraudRules,
  handleUpdateFraudRule,
  handleGetBlacklists,
  handleManageBlacklist,
  handleGetTransactionMonitoring,
  handleGetPaymentMethods,
  handleGetExchangeRates,
  handlePaymentHealthCheck,
} from "./routes/payment";

// Analytics and Reporting routes
import {
  // Data Warehouse
  createDimension,
  getDimensions,
  createFactTable,
  getFactTables,
  getWarehouseMetrics,
  // ETL Pipeline
  createETLJob,
  runETLJob,
  getETLJobs,
  getETLJobMetrics,
  // Real-time Analytics
  createRealTimeMetric,
  updateRealTimeMetric,
  getRealTimeMetrics,
  createAlertRule,
  createStreamConfig,
  // Custom Reports
  createReportTemplate,
  executeReport,
  getReportExecution,
  downloadReport,
  listReportTemplates,
  // KPI Calculation
  createKPI,
  calculateKPI,
  getKPIValues,
  getKPIComparison,
  listKPIs,
  // Trend Analysis
  createTrendAnalysis,
  runTrendAnalysis,
  getTrendAnalysisResult,
  listTrendAnalysisResults,
  // Predictive Analytics
  createPredictiveModel,
  trainPredictiveModel,
  predictModel,
  batchPredict,
  listPredictiveModels,
  getTrainingJob,
  getBatchPredictionJob,
  // Data Aggregation
  createAggregationRule,
  executeAggregation,
  getAggregationResults,
  listAggregationRules,
  getAggregationJob,
  // Dashboard
  getAnalyticsDashboard,
  getSystemHealth,
  // Performance Benchmarking
  createBenchmarkSuite,
  runBenchmark,
  getBenchmarkHistory,
  getPerformanceComparison,
  getPerformanceAlerts,
  acknowledgeAlert,
  // Automated Reporting System
  createAutomatedReportTemplate,
  createReportSchedule,
  executeAutomatedReport,
  getReportTemplates,
  getReportExecutions,
  getReportAnalytics,
  cancelReportExecution,
  // Data Visualization API
  createVisualizationConfig,
  generateVisualization,
  getVisualizationTemplates,
  exportVisualization,
  getVisualizationConfigs,
  getVisualizationData,
  deleteVisualizationConfig,
  // Report Scheduling Engine
  createScheduledReport,
  triggerScheduledReport,
  getScheduledReports,
  getScheduleExecutions,
  getScheduleAnalytics,
  pauseSchedule,
  resumeSchedule,
  cancelScheduleExecution,
  // Data Export Services
  createExportConfiguration,
  executeExport,
  getExportConfigurations,
  getExportJob,
  getExportJobs,
  cancelExportJob,
  getExportTemplates,
  generateDataProfile,
  // Analytics Caching Layer
  createCacheConfiguration,
  getCacheValue,
  setCacheValue,
  deleteCacheValue,
  invalidateCache,
  refreshCacheValue,
  queryCacheValues,
  preloadCache,
  warmupCache,
  getCacheConfigurations,
  getCacheStatistics,
  getCacheOptimizations,
  flushCache,
  pauseCache,
  resumeCache,
  // Business Intelligence
  createBIDashboard,
  getBIDashboard,
  getBIDashboardData,
  createBIAnalysis,
  executeBIAnalysis,
  getBIDashboards,
  getBIAnalyses,
  getBIInsights,
  acknowledgeBIInsight,
  deleteBIDashboard,
  deleteBIAnalysis
} from "./routes/analytics-reporting";

// Search Service Routes
import {
  handleSearch,
  handleAutoComplete,
  handleSuggestions,
  handleCreateIndex,
  handleDeleteIndex,
  handleGetIndexStats,
  handleOptimizeIndex,
  handleGetClusterHealth,
  handleGetSearchMetrics,
  handleGetPerformanceReport,
  handleGetActiveAlerts,
  handleResolveAlert,
  handleCreateScoringModel,
  handleGetScoringModels,
  handleSetActiveScoringModel,
  handleSetupLanguageAnalyzers,
  handleGetSupportedLanguages,
  handleBuildAutoCompleteIndex,
  handleUpdatePopularQueries,
  handleHealthCheck
} from "./routes/search";

// Advanced Caching Service Routes
import {
  getCacheValue,
  setCacheValue,
  deleteCacheValue,
  checkCacheExists,
  invalidateByPattern,
  invalidateByTag,
  invalidateByDependency,
  warmCacheKeys,
  predictiveWarmCache,
  getCurrentCacheStats,
  getCacheMetrics,
  getHotspotAnalysis,
  createCacheBackup,
  restoreCacheBackup,
  getOptimizationRecommendations,
  runPerformanceBenchmark,
  getCacheHealth,
  getCacheServiceInfo,
  getCacheConfig,
  updateCacheConfig,
  exportCacheConfig,
  importCacheConfig,
  batchCacheOperations,
  getCacheDashboardData,
} from "./routes/advanced-caching";

// Test route for advanced caching
import { testAdvancedCaching } from "./routes/advanced-caching-test";

// External Integrations handlers
import {
  sendSMS,
  sendOTP,
  sendEmail,
  sendWelcomeEmail,
  sendClaimNotificationEmail,
  uploadFile,
  getPresignedUploadUrl,
  extractText,
  extractHealthcareDocument,
  geocodeAddress,
  findNearbyHospitals,
  findNearbyPharmacies,
  verifyIdentity,
  verifyCitizen,
  verifyInsurance,
  findHospitalsByLocation,
  getPatientMedicalHistory,
  processClaimComprehensively,
  getHealthStatus,
  getMetrics,
  getRateLimitStatus
} from "./routes/external-integrations";

// Predictive Analytics routes
import {
  predictProcessingTime,
  trainProcessingTimeModel,
  scoreClaimApproval,
  trainApprovalScoringModel,
  assessRisk,
  trainRiskAssessmentModel,
  processBatchPredictions,
  getEngineStatus,
  getEngineMetrics,
  performHealthCheck,
  getEngineConfig,
  updateEngineConfig,
  getProcessingTimeStatus,
  getApprovalScoringStatus,
  getRiskAssessmentStatus,
  demoProcessingTimePrediction,
  demoClaimApprovalScoring
} from "./routes/predictive-analytics";

// Smart Recommendations routes
import {
  getRecommendations,
  getDocumentRecommendations,
  getFormAutoFillSuggestions,
  submitFeedback,
  getEngineStatus as getSmartRecommendationsStatus,
  getEngineMetrics as getSmartRecommendationsMetrics,
  getEngineConfig as getSmartRecommendationsConfig,
  updateEngineConfig as updateSmartRecommendationsConfig,
  demoDocumentRecommendations,
  demoFormAutoFill,
  demoAllRecommendations,
  performHealthCheck as smartRecommendationsHealthCheck
} from "./routes/smart-recommendations";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
app.get("/api/ping", (_req, res) => {
  res.json({ message: "ClaimFlow API is running!" });
});

// Test endpoint for advanced caching
app.get("/api/advanced-cache/test", testAdvancedCaching);

  // Legacy demo route
  app.get("/api/demo", handleDemo);

  // Authentication routes (public)
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/logout", handleLogout);

  // Protected authentication routes
  app.get("/api/auth/profile", authenticate, handleProfile);
  app.post(
    "/api/auth/register",
    authenticate,
    authorize([UserRole.ADMIN]),
    handleRegister,
  );

  // Claims routes
  app.get("/api/claims", authenticate, handleGetClaims);
  app.get("/api/claims/unassigned", authenticate, handleGetUnassignedClaims);
  app.get("/api/claims/:id", authenticate, handleGetClaim);
  app.post(
    "/api/claims/assign",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleAssignClaim,
  );
  app.post(
    "/api/claims/:claimId/self-assign",
    authenticate,
    handleSelfAssignClaim,
  );
  app.put("/api/claims/:id/status", authenticate, handleUpdateClaimStatus);

  // User management routes
  app.get(
    "/api/users",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleGetUsers,
  );
  app.get(
    "/api/users/role/:role",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleGetUsersByRole,
  );
  app.get(
    "/api/users/claim-executives",
    authenticate,
    handleGetClaimExecutives,
  );
  app.get(
    "/api/users/:userId/assignments",
    authenticate,
    handleGetUserAssignments,
  );
  app.get(
    "/api/assignments",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleGetAllAssignments,
  );

  // Notification routes
  app.get("/api/notifications", authenticate, handleGetNotifications);
  app.get(
    "/api/notifications/unread-count",
    authenticate,
    handleGetUnreadCount,
  );
  app.put(
    "/api/notifications/:id/read",
    authenticate,
    handleMarkNotificationRead,
  );
  app.post(
    "/api/notifications",
    authenticate,
    authorize([UserRole.ADMIN]),
    handleCreateNotification,
  );

  // Healthcare Claims routes
  app.get("/api/healthcare-claims", authenticate, handleGetHealthcareClaims);
  app.post("/api/healthcare-claims", authenticate, handleCreateHealthcareClaim);
  app.get("/api/healthcare-claims/:id", authenticate, handleGetHealthcareClaim);
  app.post(
    "/api/healthcare-claims/:id/submit",
    authenticate,
    handleSubmitHealthcareClaim,
  );
  app.post(
    "/api/healthcare-claims/assign",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleAssignHealthcareClaim,
  );
  app.post(
    "/api/healthcare-claims/:claimId/self-assign",
    authenticate,
    handleSelfAssignHealthcareClaim,
  );
  app.post(
    "/api/healthcare-claims/review",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleReviewHealthcareClaim,
  );
  app.post(
    "/api/healthcare-claims/:claimId/comments",
    authenticate,
    handleAddClaimComment,
  );

  // Dashboard routes
  app.get("/api/dashboard/customer", authenticate, handleGetCustomerDashboard);
  app.get("/api/dashboard/tpa", authenticate, handleGetTPADashboard);
  app.get(
    "/api/dashboard/insurance",
    authenticate,
    handleGetInsuranceDashboard,
  );

  // Integration routes (mock services)
  app.post(
    "/api/integrations/bhxh/eligibility",
    authenticate,
    handleBHXHEligibilityCheck,
  );
  app.post(
    "/api/integrations/his/patient-history",
    authenticate,
    handleHISPatientHistory,
  );
  app.post(
    "/api/integrations/ocr/process",
    authenticate,
    handleOCRProcessDocument,
  );
  app.post(
    "/api/integrations/payment/initiate",
    authenticate,
    handleInitiatePayment,
  );
  app.post(
    "/api/integrations/insurance/notify",
    authenticate,
    handleInsuranceCompanyNotification,
  );
  app.post(
    "/api/integrations/fraud-detection",
    authenticate,
    handleFraudDetection,
  );
  app.post(
    "/api/integrations/signature/verify",
    authenticate,
    handleDigitalSignatureVerification,
  );

  // Analytics and Reporting Service Routes

  // Data Warehouse endpoints
  app.post("/api/analytics/dimensions", authenticate, authorize([UserRole.ADMIN]), createDimension);
  app.get("/api/analytics/dimensions", authenticate, getDimensions);
  app.post("/api/analytics/fact-tables", authenticate, authorize([UserRole.ADMIN]), createFactTable);
  app.get("/api/analytics/fact-tables", authenticate, getFactTables);
  app.get("/api/analytics/warehouse/metrics", authenticate, getWarehouseMetrics);

  // ETL Pipeline endpoints
  app.post("/api/analytics/etl/jobs", authenticate, authorize([UserRole.ADMIN]), createETLJob);
  app.post("/api/analytics/etl/jobs/:jobId/run", authenticate, authorize([UserRole.ADMIN]), runETLJob);
  app.get("/api/analytics/etl/jobs", authenticate, getETLJobs);
  app.get("/api/analytics/etl/jobs/:jobId/metrics", authenticate, getETLJobMetrics);

  // Real-time Analytics endpoints
  app.post("/api/analytics/realtime/metrics", authenticate, authorize([UserRole.ADMIN]), createRealTimeMetric);
  app.put("/api/analytics/realtime/metrics/:metricId", authenticate, updateRealTimeMetric);
  app.get("/api/analytics/realtime/metrics", authenticate, getRealTimeMetrics);
  app.post("/api/analytics/realtime/alerts", authenticate, authorize([UserRole.ADMIN]), createAlertRule);
  app.post("/api/analytics/realtime/streams", authenticate, authorize([UserRole.ADMIN]), createStreamConfig);

  // Custom Reports endpoints
  app.post("/api/analytics/reports/templates", authenticate, authorize([UserRole.ADMIN]), createReportTemplate);
  app.post("/api/analytics/reports/templates/:templateId/execute", authenticate, executeReport);
  app.get("/api/analytics/reports/executions/:executionId", authenticate, getReportExecution);
  app.get("/api/analytics/reports/executions/:executionId/download", authenticate, downloadReport);
  app.get("/api/analytics/reports/templates", authenticate, listReportTemplates);

  // KPI Calculation endpoints
  app.post("/api/analytics/kpis", authenticate, authorize([UserRole.ADMIN]), createKPI);
  app.post("/api/analytics/kpis/:kpiId/calculate", authenticate, authorize([UserRole.ADMIN]), calculateKPI);
  app.get("/api/analytics/kpis/:kpiId/values", authenticate, getKPIValues);
  app.get("/api/analytics/kpis/:kpiId/comparison", authenticate, getKPIComparison);
  app.get("/api/analytics/kpis", authenticate, listKPIs);

  // Trend Analysis endpoints
  app.post("/api/analytics/trends", authenticate, authorize([UserRole.ADMIN]), createTrendAnalysis);
  app.post("/api/analytics/trends/:configId/run", authenticate, authorize([UserRole.ADMIN]), runTrendAnalysis);
  app.get("/api/analytics/trends/results/:resultId", authenticate, getTrendAnalysisResult);
  app.get("/api/analytics/trends/results", authenticate, listTrendAnalysisResults);

  // Predictive Analytics endpoints
  app.post("/api/analytics/ml/models", authenticate, authorize([UserRole.ADMIN]), createPredictiveModel);
  app.post("/api/analytics/ml/models/:modelId/train", authenticate, authorize([UserRole.ADMIN]), trainPredictiveModel);
  app.post("/api/analytics/ml/models/:modelId/predict", authenticate, predictModel);
  app.post("/api/analytics/ml/models/:modelId/batch-predict", authenticate, authorize([UserRole.ADMIN]), batchPredict);
  app.get("/api/analytics/ml/models", authenticate, listPredictiveModels);
  app.get("/api/analytics/ml/training-jobs/:jobId", authenticate, getTrainingJob);
  app.get("/api/analytics/ml/batch-jobs/:jobId", authenticate, getBatchPredictionJob);

  // Data Aggregation endpoints
  app.post("/api/analytics/aggregations", authenticate, authorize([UserRole.ADMIN]), createAggregationRule);
  app.post("/api/analytics/aggregations/:ruleId/execute", authenticate, authorize([UserRole.ADMIN]), executeAggregation);
  app.get("/api/analytics/aggregations/:ruleId/results", authenticate, getAggregationResults);
  app.get("/api/analytics/aggregations", authenticate, listAggregationRules);
  app.get("/api/analytics/aggregations/jobs/:jobId", authenticate, getAggregationJob);

  // Performance Benchmarking endpoints
  app.post("/api/analytics/benchmarks/suites", authenticate, authorize([UserRole.ADMIN]), createBenchmarkSuite);
  app.post("/api/analytics/benchmarks/suites/:suiteId/run", authenticate, authorize([UserRole.ADMIN]), runBenchmark);
  app.get("/api/analytics/benchmarks/suites/:suiteId/history", authenticate, getBenchmarkHistory);
  app.get("/api/analytics/benchmarks/suites/:suiteId/compare/:runId1/:runId2", authenticate, getPerformanceComparison);
  app.get("/api/analytics/benchmarks/alerts", authenticate, getPerformanceAlerts);
  app.put("/api/analytics/benchmarks/alerts/:alertId/acknowledge", authenticate, acknowledgeAlert);

  // Automated Reporting System endpoints
  app.post("/api/analytics/automated-reports/templates", authenticate, authorize([UserRole.ADMIN]), createAutomatedReportTemplate);
  app.post("/api/analytics/automated-reports/schedules", authenticate, authorize([UserRole.ADMIN]), createReportSchedule);
  app.post("/api/analytics/automated-reports/templates/:templateId/execute", authenticate, executeAutomatedReport);
  app.get("/api/analytics/automated-reports/templates", authenticate, getReportTemplates);
  app.get("/api/analytics/automated-reports/executions", authenticate, getReportExecutions);
  app.get("/api/analytics/automated-reports/templates/:templateId/analytics", authenticate, getReportAnalytics);
  app.delete("/api/analytics/automated-reports/executions/:executionId", authenticate, authorize([UserRole.ADMIN]), cancelReportExecution);

  // Data Visualization API endpoints
  app.post("/api/analytics/visualizations/configs", authenticate, authorize([UserRole.ADMIN]), createVisualizationConfig);
  app.post("/api/analytics/visualizations/:configId/generate", authenticate, generateVisualization);
  app.get("/api/analytics/visualizations/templates", authenticate, getVisualizationTemplates);
  app.post("/api/analytics/visualizations/:configId/export", authenticate, exportVisualization);
  app.get("/api/analytics/visualizations/configs", authenticate, getVisualizationConfigs);
  app.get("/api/analytics/visualizations/data/:dataId", authenticate, getVisualizationData);
  app.delete("/api/analytics/visualizations/configs/:configId", authenticate, authorize([UserRole.ADMIN]), deleteVisualizationConfig);

  // Report Scheduling Engine endpoints
  app.post("/api/analytics/scheduled-reports", authenticate, authorize([UserRole.ADMIN]), createScheduledReport);
  app.post("/api/analytics/scheduled-reports/:scheduleId/trigger", authenticate, authorize([UserRole.ADMIN]), triggerScheduledReport);
  app.get("/api/analytics/scheduled-reports", authenticate, getScheduledReports);
  app.get("/api/analytics/scheduled-reports/:scheduleId/executions", authenticate, getScheduleExecutions);
  app.get("/api/analytics/scheduled-reports/:scheduleId/analytics", authenticate, getScheduleAnalytics);
  app.put("/api/analytics/scheduled-reports/:scheduleId/pause", authenticate, authorize([UserRole.ADMIN]), pauseSchedule);
  app.put("/api/analytics/scheduled-reports/:scheduleId/resume", authenticate, authorize([UserRole.ADMIN]), resumeSchedule);
  app.delete("/api/analytics/scheduled-reports/executions/:executionId", authenticate, authorize([UserRole.ADMIN]), cancelScheduleExecution);

  // Data Export Services endpoints
  app.post("/api/analytics/exports/configurations", authenticate, authorize([UserRole.ADMIN]), createExportConfiguration);
  app.post("/api/analytics/exports/:configId/execute", authenticate, executeExport);
  app.get("/api/analytics/exports/configurations", authenticate, getExportConfigurations);
  app.get("/api/analytics/exports/jobs/:jobId", authenticate, getExportJob);
  app.get("/api/analytics/exports/jobs", authenticate, getExportJobs);
  app.delete("/api/analytics/exports/jobs/:jobId", authenticate, authorize([UserRole.ADMIN]), cancelExportJob);
  app.get("/api/analytics/exports/templates", authenticate, getExportTemplates);
  app.post("/api/analytics/exports/data-profile", authenticate, authorize([UserRole.ADMIN]), generateDataProfile);

  // Analytics Caching Layer endpoints
  app.post("/api/analytics/cache/configurations", authenticate, authorize([UserRole.ADMIN]), createCacheConfiguration);
  app.get("/api/analytics/cache/:configId/:key", authenticate, getCacheValue);
  app.put("/api/analytics/cache/:configId/:key", authenticate, setCacheValue);
  app.delete("/api/analytics/cache/:configId/:key", authenticate, deleteCacheValue);
  app.post("/api/analytics/cache/:configId/invalidate", authenticate, authorize([UserRole.ADMIN]), invalidateCache);
  app.post("/api/analytics/cache/:configId/:key/refresh", authenticate, refreshCacheValue);
  app.post("/api/analytics/cache/:configId/query", authenticate, queryCacheValues);
  app.post("/api/analytics/cache/:configId/preload", authenticate, authorize([UserRole.ADMIN]), preloadCache);
  app.post("/api/analytics/cache/:configId/warmup", authenticate, authorize([UserRole.ADMIN]), warmupCache);
  app.get("/api/analytics/cache/configurations", authenticate, getCacheConfigurations);
  app.get("/api/analytics/cache/:configId/statistics", authenticate, getCacheStatistics);
  app.get("/api/analytics/cache/:configId/optimizations", authenticate, getCacheOptimizations);
  app.delete("/api/analytics/cache/:configId/flush", authenticate, authorize([UserRole.ADMIN]), flushCache);
  app.put("/api/analytics/cache/:configId/pause", authenticate, authorize([UserRole.ADMIN]), pauseCache);
  app.put("/api/analytics/cache/:configId/resume", authenticate, authorize([UserRole.ADMIN]), resumeCache);

  // Business Intelligence endpoints
app.post("/api/analytics/bi/dashboards", authenticate, authorize([UserRole.ADMIN]), createBIDashboard);
app.get("/api/analytics/bi/dashboards/:dashboardId", authenticate, getBIDashboard);
app.post("/api/analytics/bi/dashboards/:dashboardId/data", authenticate, getBIDashboardData);
app.post("/api/analytics/bi/analyses", authenticate, authorize([UserRole.ADMIN]), createBIAnalysis);
app.post("/api/analytics/bi/analyses/:analysisId/execute", authenticate, authorize([UserRole.ADMIN]), executeBIAnalysis);
app.get("/api/analytics/bi/dashboards", authenticate, getBIDashboards);
app.get("/api/analytics/bi/analyses", authenticate, getBIAnalyses);
app.get("/api/analytics/bi/insights", authenticate, getBIInsights);
app.put("/api/analytics/bi/insights/:insightId/acknowledge", authenticate, acknowledgeBIInsight);
app.delete("/api/analytics/bi/dashboards/:dashboardId", authenticate, authorize([UserRole.ADMIN]), deleteBIDashboard);
app.delete("/api/analytics/bi/analyses/:analysisId", authenticate, authorize([UserRole.ADMIN]), deleteBIAnalysis);

// Analytics Dashboard endpoints
app.get("/api/analytics/dashboard", authenticate, getAnalyticsDashboard);
app.get("/api/analytics/health", authenticate, getSystemHealth);

// Advanced Cache Operations
app.get("/api/advanced-cache/:key", authenticate, getCacheValue);
app.post("/api/advanced-cache/:key", authenticate, setCacheValue);
app.delete("/api/advanced-cache/:key", authenticate, deleteCacheValue);
app.head("/api/advanced-cache/:key", authenticate, checkCacheExists);

// Cache Invalidation
app.post("/api/advanced-cache/invalidate/pattern", authenticate, authorize([UserRole.ADMIN]), invalidateByPattern);
app.post("/api/advanced-cache/invalidate/tag/:tag", authenticate, authorize([UserRole.ADMIN]), invalidateByTag);
app.post("/api/advanced-cache/invalidate/dependency/:dependency", authenticate, authorize([UserRole.ADMIN]), invalidateByDependency);

// Cache Warming
app.post("/api/advanced-cache/warm/keys", authenticate, authorize([UserRole.ADMIN]), warmCacheKeys);
app.post("/api/advanced-cache/warm/predictive", authenticate, authorize([UserRole.ADMIN]), predictiveWarmCache);

// Cache Analytics
app.get("/api/advanced-cache/stats/current", authenticate, getCurrentCacheStats);
app.get("/api/advanced-cache/metrics", authenticate, getCacheMetrics);
app.get("/api/advanced-cache/analysis/hotspots", authenticate, getHotspotAnalysis);

// Cache Backup & Recovery
app.post("/api/advanced-cache/backup", authenticate, authorize([UserRole.ADMIN]), createCacheBackup);
app.post("/api/advanced-cache/restore", authenticate, authorize([UserRole.ADMIN]), restoreCacheBackup);

// Performance Optimization
app.get("/api/advanced-cache/optimization/recommendations", authenticate, getOptimizationRecommendations);
app.post("/api/advanced-cache/benchmark", authenticate, authorize([UserRole.ADMIN]), runPerformanceBenchmark);

// Health & Monitoring
app.get("/api/advanced-cache/health", authenticate, getCacheHealth);
app.get("/api/advanced-cache/info", authenticate, getCacheServiceInfo);

// Configuration Management
app.get("/api/advanced-cache/config", authenticate, authorize([UserRole.ADMIN]), getCacheConfig);
app.put("/api/advanced-cache/config", authenticate, authorize([UserRole.ADMIN]), updateCacheConfig);
app.get("/api/advanced-cache/config/export", authenticate, authorize([UserRole.ADMIN]), exportCacheConfig);
app.post("/api/advanced-cache/config/import", authenticate, authorize([UserRole.ADMIN]), importCacheConfig);

// Batch Operations
app.post("/api/advanced-cache/batch", authenticate, batchCacheOperations);

// Dashboard Data
app.get("/api/advanced-cache/dashboard", authenticate, getCacheDashboardData);

// Payment Service Routes

  // Core payment operations
  app.post("/api/payments/process", authenticate, handleProcessPayment);
  app.post("/api/payments/refund", authenticate, handleProcessRefund);
  app.get("/api/payments/:paymentId/status", authenticate, handleGetPaymentStatus);
  app.post("/api/payments/schedule", authenticate, handleSchedulePayment);

  // Payment webhooks (no auth required)
  app.post("/api/payments/webhook/:gateway", handlePaymentWebhook);

  // Analytics and reporting
  app.get("/api/payments/analytics", authenticate, handleGetPaymentAnalytics);
  app.post("/api/payments/reports", authenticate, handleGenerateReport);

  // Reconciliation
  app.post(
    "/api/payments/reconcile",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleReconcilePayments
  );
  app.get(
    "/api/payments/reconciliation/reports",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleGetReconciliationReports
  );

  // Fraud detection
  app.post("/api/payments/fraud/check", authenticate, handleCheckFraud);
  app.get(
    "/api/payments/fraud/rules",
    authenticate,
    authorize([UserRole.ADMIN]),
    handleGetFraudRules
  );
  app.put(
    "/api/payments/fraud/rules/:ruleId",
    authenticate,
    authorize([UserRole.ADMIN]),
    handleUpdateFraudRule
  );
  app.get(
    "/api/payments/fraud/blacklists",
    authenticate,
    authorize([UserRole.ADMIN]),
    handleGetBlacklists
  );
  app.post(
    "/api/payments/fraud/blacklists",
    authenticate,
    authorize([UserRole.ADMIN]),
    handleManageBlacklist
  );

  // Monitoring and configuration
  app.get("/api/payments/monitoring", authenticate, handleGetTransactionMonitoring);
  app.get("/api/payments/methods", authenticate, handleGetPaymentMethods);
  app.get("/api/payments/exchange-rates", authenticate, handleGetExchangeRates);
  app.get("/api/payments/health", handlePaymentHealthCheck);

  // Search Service Routes

  // Core search functionality
  app.post("/api/search", authenticate, handleSearch);
  app.get("/api/search/autocomplete", authenticate, handleAutoComplete);
  app.get("/api/search/suggestions", authenticate, handleSuggestions);

  // Index management
  app.post("/api/search/indices", authenticate, authorize([UserRole.ADMIN]), handleCreateIndex);
  app.delete("/api/search/indices/:indexName", authenticate, authorize([UserRole.ADMIN]), handleDeleteIndex);
  app.get("/api/search/indices/:indexName/stats", authenticate, handleGetIndexStats);
  app.get("/api/search/indices/stats", authenticate, handleGetIndexStats);
  app.post("/api/search/indices/:indexName/optimize", authenticate, authorize([UserRole.ADMIN]), handleOptimizeIndex);

  // Cluster management
  app.get("/api/search/cluster/health", authenticate, handleGetClusterHealth);

  // Analytics
  app.get("/api/search/analytics/metrics", authenticate, authorize([UserRole.ADMIN]), handleGetSearchMetrics);

  // Performance monitoring
  app.get("/api/search/performance/report", authenticate, authorize([UserRole.ADMIN]), handleGetPerformanceReport);
  app.get("/api/search/performance/alerts", authenticate, authorize([UserRole.ADMIN]), handleGetActiveAlerts);
  app.put("/api/search/performance/alerts/:alertId/resolve", authenticate, authorize([UserRole.ADMIN]), handleResolveAlert);

  // Relevance scoring
  app.post("/api/search/scoring/models", authenticate, authorize([UserRole.ADMIN]), handleCreateScoringModel);
  app.get("/api/search/scoring/models", authenticate, handleGetScoringModels);
  app.put("/api/search/scoring/models/:modelId/activate", authenticate, authorize([UserRole.ADMIN]), handleSetActiveScoringModel);

  // Multi-language support
  app.post("/api/search/language/:indexName/setup", authenticate, authorize([UserRole.ADMIN]), handleSetupLanguageAnalyzers);
  app.get("/api/search/language/supported", authenticate, handleGetSupportedLanguages);

  // Auto-complete management
  app.post("/api/search/autocomplete/build", authenticate, authorize([UserRole.ADMIN]), handleBuildAutoCompleteIndex);
  app.post("/api/search/suggestions/popular", authenticate, authorize([UserRole.ADMIN]), handleUpdatePopularQueries);

  // Search service health check
  app.get("/api/search/health", handleHealthCheck);

  // External Integrations Routes

  // SMS Gateway routes
  app.post("/api/external/sms/send", authenticate, sendSMS);
  app.post("/api/external/sms/otp", authenticate, sendOTP);

  // Email Service routes
  app.post("/api/external/email/send", authenticate, sendEmail);
  app.post("/api/external/email/welcome", authenticate, sendWelcomeEmail);
  app.post("/api/external/email/claim-notification", authenticate, sendClaimNotificationEmail);

  // Cloud Storage routes
  app.post("/api/external/storage/upload", authenticate, uploadFile);
  app.post("/api/external/storage/presigned-url", authenticate, getPresignedUploadUrl);

  // OCR Service routes
  app.post("/api/external/ocr/extract-text", authenticate, extractText);
  app.post("/api/external/ocr/healthcare-document", authenticate, extractHealthcareDocument);

  // Maps Service routes
  app.post("/api/external/maps/geocode", authenticate, geocodeAddress);
  app.post("/api/external/maps/nearby-hospitals", authenticate, findNearbyHospitals);
  app.post("/api/external/maps/nearby-pharmacies", authenticate, findNearbyPharmacies);

  // Identity Verification routes
  app.post("/api/external/identity/verify", authenticate, verifyIdentity);

  // Government API routes
  app.post("/api/external/government/verify-citizen", authenticate, verifyCitizen);
  app.post("/api/external/government/verify-insurance", authenticate, verifyInsurance);

  // Hospital Database routes
  app.post("/api/external/hospital/find-by-location", authenticate, findHospitalsByLocation);
  app.post("/api/external/hospital/patient-history", authenticate, getPatientMedicalHistory);

  // Comprehensive Claim Processing
  app.post("/api/external/claims/process-comprehensive", authenticate, processClaimComprehensively);

  // Health and Monitoring routes
  app.get("/api/external/health", authenticate, getHealthStatus);
  app.get("/api/external/metrics", authenticate, getMetrics);
  app.get("/api/external/rate-limits", authenticate, getRateLimitStatus);

  // AI/ML Document Processing routes
  app.use("/api/ai-ml", aiMLRouter);

  // Predictive Analytics Routes

  // Processing Time Prediction
  app.post("/api/predictive/processing-time/predict", authenticate, predictProcessingTime);
  app.post("/api/predictive/processing-time/train", authenticate, authorize([UserRole.ADMIN]), trainProcessingTimeModel);
  app.get("/api/predictive/processing-time/status", authenticate, getProcessingTimeStatus);
  app.get("/api/predictive/processing-time/demo", demoProcessingTimePrediction);

  // Claim Approval Scoring
  app.post("/api/predictive/approval/score", authenticate, scoreClaimApproval);
  app.post("/api/predictive/approval/train", authenticate, authorize([UserRole.ADMIN]), trainApprovalScoringModel);
  app.get("/api/predictive/approval/status", authenticate, getApprovalScoringStatus);
  app.get("/api/predictive/approval/demo", demoClaimApprovalScoring);

  // Risk Assessment
  app.post("/api/predictive/risk/assess", authenticate, assessRisk);
  app.post("/api/predictive/risk/train", authenticate, authorize([UserRole.ADMIN]), trainRiskAssessmentModel);
  app.get("/api/predictive/risk/status", authenticate, getRiskAssessmentStatus);

  // Batch Processing
  app.post("/api/predictive/batch", authenticate, processBatchPredictions);

  // Engine Management
  app.get("/api/predictive/engine/status", authenticate, getEngineStatus);
  app.get("/api/predictive/engine/metrics", authenticate, getEngineMetrics);
  app.get("/api/predictive/engine/health", performHealthCheck);
  app.get("/api/predictive/engine/config", authenticate, authorize([UserRole.ADMIN]), getEngineConfig);
  app.put("/api/predictive/engine/config", authenticate, authorize([UserRole.ADMIN]), updateEngineConfig);

  // Smart Recommendations Routes

  // General recommendations
  app.post("/api/recommendations", authenticate, getRecommendations);
  app.post("/api/recommendations/feedback", authenticate, submitFeedback);

  // Document recommendations
  app.post("/api/recommendations/documents", authenticate, getDocumentRecommendations);
  app.get("/api/recommendations/documents/demo", demoDocumentRecommendations);

  // Form auto-fill
  app.post("/api/recommendations/autofill", authenticate, getFormAutoFillSuggestions);
  app.get("/api/recommendations/autofill/demo", demoFormAutoFill);

  // Demo and testing
  app.get("/api/recommendations/demo", demoAllRecommendations);

  // Engine management
  app.get("/api/recommendations/engine/status", authenticate, getSmartRecommendationsStatus);
  app.get("/api/recommendations/engine/metrics", authenticate, getSmartRecommendationsMetrics);
  app.get("/api/recommendations/engine/health", smartRecommendationsHealthCheck);
  app.get("/api/recommendations/engine/config", authenticate, authorize([UserRole.ADMIN]), getSmartRecommendationsConfig);
  app.put("/api/recommendations/engine/config", authenticate, authorize([UserRole.ADMIN]), updateSmartRecommendationsConfig);

  return app;
}
