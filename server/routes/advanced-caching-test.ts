import { RequestHandler } from 'express';

// Simple test endpoint to verify the advanced caching routes are loaded
export const testAdvancedCaching: RequestHandler = async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'Advanced caching routes are loaded successfully',
      timestamp: new Date().toISOString(),
      available_endpoints: [
        'GET /api/advanced-cache/:key - Get cached value',
        'POST /api/advanced-cache/:key - Set cached value', 
        'DELETE /api/advanced-cache/:key - Delete cached value',
        'GET /api/advanced-cache/health - Check cache health',
        'GET /api/advanced-cache/stats/current - Get current stats',
        'GET /api/advanced-cache/dashboard - Get dashboard data'
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
