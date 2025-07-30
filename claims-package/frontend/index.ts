// Claims Package - Frontend Export
// Main entry point for all frontend components, pages, hooks, and utilities

// Pages
export { HealthcareClaimSubmission } from './pages/HealthcareClaimSubmission';
export { ClaimTracking } from './pages/ClaimTracking';
export { Dashboard } from './pages/Dashboard';
export { SearchResults } from './pages/SearchResults';
export { SubmitClaim } from './pages/SubmitClaim';

// Admin Pages
export { AdminDashboard } from './pages/admin/AdminDashboard';

// Components - UI Library
export * from './components/ui';

// Components - Admin
export { AnalyticsDashboard } from './components/admin/AnalyticsDashboard';
export { AuditLog } from './components/admin/AuditLog';
export { BulkOperations } from './components/admin/BulkOperations';
export { ClaimsManagement } from './components/admin/ClaimsManagement';
export { NotificationManagement } from './components/admin/NotificationManagement';
export { SystemConfiguration } from './components/admin/SystemConfiguration';
export { SystemHealth } from './components/admin/SystemHealth';
export { UserManagement } from './components/admin/UserManagement';

// Components - Search
export { AdvancedSearchInterface } from './components/search/AdvancedSearchInterface';
export { SearchFilters } from './components/search/SearchFilters';
export { SearchSuggestions } from './components/search/SearchSuggestions';

// Components - Accessibility
export { AccessibilityControls } from './components/accessibility/AccessibilityControls';

// Components - Core
export { Navigation } from './components/Navigation';
export { ProtectedRoute } from './components/ProtectedRoute';
export { ErrorBoundary } from './components/ErrorBoundary';
export { HealthCheck } from './components/HealthCheck';
export { AuthTest } from './components/AuthTest';
export { TestComponent } from './components/TestComponent';

// Contexts
export { AuthProvider, useAuth, makeAuthenticatedRequest } from './contexts/AuthContext';

// Hooks
export { useMobile } from './hooks/use-mobile';
export { useToast } from './hooks/use-toast';
export { useAccessibility } from './hooks/useAccessibility';
export { useDebounce } from './hooks/useDebounce';
export { useWebSocket } from './hooks/useWebSocket';

// Libraries and Utilities
export { useTranslation, t, translations } from './lib/i18n';
export { cn } from './lib/utils';
export { componentTemplates } from './lib/component-templates';

// Types (re-export from shared)
export type * from '../shared';

// Router Configuration
export { ClaimsRoutes } from './routes';

// Theme Configuration
export { ClaimsTheme } from './styles/theme';
