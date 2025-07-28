import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function AuthTest() {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const testAuthEndpoint = async () => {
    setIsLoading(true);
    setTestResult('Testing...');

    try {
      // Test login first
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin@claimflow.com',
          password: 'password123'
        })
      });

      const loginData = await loginResponse.json();
      
      if (!loginData.success) {
        setTestResult(`Login failed: ${loginData.message}`);
        setIsLoading(false);
        return;
      }

      // Test profile endpoint with the token
      const profileResponse = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        }
      });

      const profileData = await profileResponse.json();
      
      if (profileData.success) {
        setTestResult(`✅ Auth endpoints working! User: ${profileData.user.email}`);
      } else {
        setTestResult(`❌ Profile endpoint failed: ${profileData.message}`);
      }

    } catch (error) {
      setTestResult(`❌ Network error: ${error}`);
    }
    
    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Auth Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testAuthEndpoint} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Testing...' : 'Test Auth Endpoints'}
        </Button>
        
        {testResult && (
          <div className="p-3 bg-muted rounded text-sm">
            {testResult}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
