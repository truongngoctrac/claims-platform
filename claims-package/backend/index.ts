// Claims Package - Backend Export
// Main entry point for all backend services, routes, and utilities

// Routes
export { claimsRoutes } from './routes/claims';
export { healthcareClaimsRoutes } from './routes/healthcare-claims';
export { documentsRoutes } from './routes/documents';
export { searchRoutes } from './routes/search';
export { analyticsRoutes } from './routes/analytics';
export { paymentRoutes } from './routes/payment';

// Services
export { ClaimsService } from './services/ClaimsService';
export { DocumentService } from './services/DocumentService';
export { SearchService } from './services/SearchService';
export { AnalyticsService } from './services/AnalyticsService';
export { PaymentService } from './services/PaymentService';
export { NotificationService } from './services/NotificationService';

// AI/ML Services
export { DocumentAI } from './services/ai-ml/DocumentAI';
export { PredictiveAnalytics } from './services/ai-ml/PredictiveAnalytics';
export { SmartRecommendations } from './services/ai-ml/SmartRecommendations';

// Middleware
export { authMiddleware } from './middleware/auth';
export { rateLimitMiddleware } from './middleware/rateLimit';
export { validationMiddleware } from './middleware/validation';

// Database
export { ClaimModel } from './models/ClaimModel';
export { UserModel } from './models/UserModel';
export { DocumentModel } from './models/DocumentModel';

// Utilities
export { DatabaseManager } from './utils/DatabaseManager';
export { Logger } from './utils/Logger';
export { ConfigManager } from './utils/ConfigManager';

// Types (re-export from shared)
export type * from '../shared';
