import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { Index } from './pages/Index';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SubmitClaim } from './pages/SubmitClaim';
import { HealthcareClaimSubmission } from './pages/HealthcareClaimSubmission';
import { ClaimTracking } from './pages/ClaimTracking';
import { Profile } from './pages/Profile';
import { NotFound } from './pages/NotFound';
import { SearchResults } from './pages/SearchResults';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('401')) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <ErrorBoundary>
              <Navigation />
            </ErrorBoundary>
            <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
              <ErrorBoundary>
                <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                
                {/* Protected routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/submit-claim"
                  element={
                    <ProtectedRoute>
                      <SubmitClaim />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/healthcare-claim"
                  element={
                    <ProtectedRoute>
                      <HealthcareClaimSubmission />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/claim-tracking"
                  element={
                    <ProtectedRoute>
                      <ClaimTracking />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/search"
                  element={
                    <ProtectedRoute>
                      <SearchResults />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                
                {/* Admin routes */}
                <Route
                  path="/admin/*"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                
                {/* 404 route */}
                <Route path="*" element={<NotFound />} />
                </Routes>
              </ErrorBoundary>
            </main>
            
            {/* Global UI Components */}
            <Toaster
              position="top-right"
              richColors
              expand={true}
              visibleToasts={5}
            />


          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
