import express from 'express';
import { ClaimsWorkflowEngine, defaultClaimsConfig } from '../services/claims-management/ClaimsService';
import { ClaimsSearchService } from '../services/claims-management/ClaimsSearchService';
import { ClaimsAnalyticsService } from '../services/claims-management/ClaimsAnalyticsService';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateClaimData } from '../middleware/validation';
import { rateLimit } from '../middleware/rateLimit';

const router = express.Router();
const workflowEngine = new ClaimsWorkflowEngine(defaultClaimsConfig);
const searchService = new ClaimsSearchService();
const analyticsService = new ClaimsAnalyticsService();

// Apply authentication to all routes
router.use(authenticateToken);

// 2.2.8 Claim search and filtering APIs
router.get('/search', rateLimit(100), async (req, res) => {
  try {
    const { query, filters, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const searchResults = await searchService.searchClaims({
      query: query as string,
      filters: filters ? JSON.parse(filters as string) : {},
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      },
      sorting: {
        field: sortBy as string,
        order: sortOrder as 'asc' | 'desc'
      },
      userId: req.user.id,
      userRole: req.user.role
    });

    res.json({
      success: true,
      data: searchResults.claims,
      pagination: searchResults.pagination,
      facets: searchResults.facets,
      totalResults: searchResults.totalResults
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Advanced search with faceted filtering
router.post('/advanced-search', rateLimit(50), async (req, res) => {
  try {
    const searchParams = req.body;
    const results = await searchService.advancedSearch(searchParams);
    
    res.json({
      success: true,
      data: results.claims,
      facets: results.facets,
      aggregations: results.aggregations,
      suggestions: results.suggestions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2.2.9 Claim analytics endpoints
router.get('/analytics/dashboard', requireRole(['admin', 'claims_manager']), async (req, res) => {
  try {
    const { timeRange = '30d', filters = {} } = req.query;
    
    const analytics = await analyticsService.getDashboardAnalytics({
      timeRange: timeRange as string,
      filters: typeof filters === 'string' ? JSON.parse(filters) : filters,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/analytics/performance', requireRole(['admin', 'claims_manager']), async (req, res) => {
  try {
    const performance = await analyticsService.getPerformanceMetrics({
      timeRange: req.query.timeRange as string || '30d',
      userId: req.user.id
    });

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/analytics/trends', requireRole(['admin', 'claims_manager']), async (req, res) => {
  try {
    const trends = await analyticsService.getTrendAnalysis({
      timeRange: req.query.timeRange as string || '90d',
      granularity: req.query.granularity as string || 'daily'
    });

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Claim workflow operations
router.post('/submit', validateClaimData, rateLimit(10), async (req, res) => {
  try {
    const claimData = {
      ...req.body,
      id: `HC${Date.now()}`,
      submittedBy: req.user.id,
      submittedAt: new Date(),
      status: 'pending'
    };

    const processedClaim = await workflowEngine.processClaim(claimData);
    
    res.status(201).json({
      success: true,
      data: processedClaim,
      message: 'Hồ sơ đã được nộp thành công'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:claimId', async (req, res) => {
  try {
    const { claimId } = req.params;
    // Mock claim retrieval - in real implementation would query database
    const claim = await searchService.getClaimById(claimId, req.user.id, req.user.role);
    
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    res.json({
      success: true,
      data: claim
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:claimId/history', async (req, res) => {
  try {
    const { claimId } = req.params;
    const history = workflowEngine.getClaimHistory(claimId);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:claimId/status', requireRole(['admin', 'claims_manager', 'claim_executive']), async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, reason } = req.body;
    
    let result;
    switch (status) {
      case 'approved':
        result = await workflowEngine.approveClaim(claimId, req.user.id);
        break;
      case 'rejected':
        result = await workflowEngine.rejectClaim(claimId, req.user.id, reason);
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    res.json({
      success: true,
      data: result,
      message: `Hồ sơ đã được ${status === 'approved' ? 'duyệt' : 'từ chối'}`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:claimId/assign', requireRole(['admin', 'claims_manager']), async (req, res) => {
  try {
    const { claimId } = req.params;
    const { assignedTo } = req.body;
    
    const result = await workflowEngine.reassignClaim(claimId, assignedTo);
    
    res.json({
      success: true,
      data: result,
      message: 'Hồ sơ đã được phân công thành công'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2.2.7 Bulk operations support
router.post('/bulk/operations', requireRole(['admin', 'claims_manager']), rateLimit(5), async (req, res) => {
  try {
    const { claimIds, operation, data } = req.body;
    
    // Validate bulk operation
    if (!Array.isArray(claimIds) || claimIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid claim IDs' });
    }

    if (claimIds.length > 100) {
      return res.status(400).json({ success: false, error: 'Bulk operation limited to 100 claims' });
    }

    const claims = claimIds.map(id => ({ id, ...data }));
    const results = await workflowEngine.processBulkClaims(claims, operation);
    
    const successful = results.filter(r => !r.error).length;
    const failed = results.length - successful;

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful,
          failed
        }
      },
      message: `Thao tác hàng loạt hoàn thành: ${successful} thành công, ${failed} thất bại`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Workflow metrics and monitoring
router.get('/metrics/workflow', requireRole(['admin', 'claims_manager']), async (req, res) => {
  try {
    const metrics = workflowEngine.getWorkflowMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export claims data
router.get('/export/claims', requireRole(['admin', 'claims_manager']), rateLimit(5), async (req, res) => {
  try {
    const { format = 'json', filters = {} } = req.query;
    
    const exportData = await searchService.exportClaims({
      format: format as string,
      filters: typeof filters === 'string' ? JSON.parse(filters) : filters,
      userId: req.user.id
    });

    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=claims-export.${format}`);
    res.send(exportData);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as claimsManagementRouter };
