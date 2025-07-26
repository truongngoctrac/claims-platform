import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface HealthStatus {
  frontend: boolean;
  backend: boolean;
  search: boolean;
}

export function HealthCheck() {
  const [health, setHealth] = useState<HealthStatus>({
    frontend: true, // Frontend is working if this renders
    backend: false,
    search: false
  });

  useEffect(() => {
    // Check backend health
    fetch('/api/ping')
      .then(res => res.json())
      .then(() => setHealth(prev => ({ ...prev, backend: true })))
      .catch(() => setHealth(prev => ({ ...prev, backend: false })));

    // Check search service health  
    fetch('/api/search/health')
      .then(res => res.json())
      .then(() => setHealth(prev => ({ ...prev, search: true })))
      .catch(() => setHealth(prev => ({ ...prev, search: false })));
  }, []);

  const StatusIcon = ({ status }: { status: boolean }) => {
    if (status) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-blue-500" />
        <span className="font-medium">System Health</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <StatusIcon status={health.frontend} />
          <span>Frontend React App</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon status={health.backend} />
          <span>Backend API</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon status={health.search} />
          <span>Search Service</span>
        </div>
      </div>
    </div>
  );
}
