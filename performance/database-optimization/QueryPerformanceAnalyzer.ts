/**
 * Query Performance Analysis System
 * Comprehensive query analysis and optimization for healthcare claims database
 */

export interface QueryAnalysisConfig {
  enableRealTimeAnalysis: boolean;
  slowQueryThreshold: number; // milliseconds
  sampleRate: number; // 0-1, percentage of queries to analyze
  enableQueryPlan: boolean;
  enableIndexAnalysis: boolean;
  maxHistorySize: number;
}

export interface QueryMetrics {
  queryId: string;
  sql: string;
  executionTime: number;
  planTime: number;
  bufferHits: number;
  bufferReads: number;
  rows: number;
  timestamp: Date;
  database: string;
  user: string;
  application: string;
}

export interface QueryAnalysisResult {
  query: QueryMetrics;
  issues: QueryIssue[];
  recommendations: QueryRecommendation[];
  executionPlan: ExecutionPlan;
  indexUsage: IndexUsage[];
  performance: PerformanceRating;
}

export interface QueryIssue {
  type: 'slow-execution' | 'missing-index' | 'inefficient-join' | 'full-table-scan' | 'high-cost';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  impact: string;
  location?: string;
}

export interface QueryRecommendation {
  type: 'add-index' | 'rewrite-query' | 'partition-table' | 'optimize-join' | 'use-limit';
  priority: 'high' | 'medium' | 'low';
  description: string;
  estimatedImprovement: string;
  implementation: string;
  sqlExample?: string;
}

export interface ExecutionPlan {
  nodeType: string;
  cost: number;
  rows: number;
  width: number;
  actualTime: number;
  children: ExecutionPlan[];
  indexName?: string;
  tableName?: string;
}

export interface IndexUsage {
  indexName: string;
  tableName: string;
  used: boolean;
  scanType: 'index_scan' | 'index_only_scan' | 'bitmap_index_scan' | 'seq_scan';
  cost: number;
}

export interface PerformanceRating {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  category: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

export class QueryPerformanceAnalyzer {
  private config: QueryAnalysisConfig;
  private queryHistory: QueryMetrics[] = [];
  private activeQueries = new Map<string, QueryMetrics>();
  private performanceBaseline = new Map<string, number>();

  constructor(config: Partial<QueryAnalysisConfig> = {}) {
    this.config = {
      enableRealTimeAnalysis: true,
      slowQueryThreshold: 1000, // 1 second
      sampleRate: 0.1, // 10% of queries
      enableQueryPlan: true,
      enableIndexAnalysis: true,
      maxHistorySize: 10000,
      ...config
    };
  }

  /**
   * Analyze a query and provide optimization recommendations
   */
  async analyzeQuery(queryMetrics: QueryMetrics): Promise<QueryAnalysisResult> {
    console.log(`🔍 Analyzing query: ${queryMetrics.queryId}`);

    const issues = this.identifyQueryIssues(queryMetrics);
    const recommendations = this.generateRecommendations(queryMetrics, issues);
    const executionPlan = await this.getExecutionPlan(queryMetrics.sql);
    const indexUsage = this.analyzeIndexUsage(executionPlan);
    const performance = this.calculatePerformanceRating(queryMetrics, issues);

    // Store in history
    this.addToHistory(queryMetrics);

    return {
      query: queryMetrics,
      issues,
      recommendations,
      executionPlan,
      indexUsage,
      performance
    };
  }

  /**
   * Identify performance issues in the query
   */
  private identifyQueryIssues(query: QueryMetrics): QueryIssue[] {
    const issues: QueryIssue[] = [];

    // Check execution time
    if (query.executionTime > this.config.slowQueryThreshold) {
      issues.push({
        type: 'slow-execution',
        severity: query.executionTime > 5000 ? 'critical' : 'warning',
        description: `Query execution time (${query.executionTime}ms) exceeds threshold`,
        impact: 'High response time affecting user experience'
      });
    }

    // Check buffer efficiency
    const bufferHitRatio = query.bufferHits / (query.bufferHits + query.bufferReads);
    if (bufferHitRatio < 0.95) {
      issues.push({
        type: 'high-cost',
        severity: 'warning',
        description: `Low buffer hit ratio (${(bufferHitRatio * 100).toFixed(1)}%)`,
        impact: 'Excessive disk I/O operations'
      });
    }

    // Check for potential full table scans in healthcare data
    if (query.sql.toLowerCase().includes('select * from claims') && 
        !query.sql.toLowerCase().includes('where')) {
      issues.push({
        type: 'full-table-scan',
        severity: 'critical',
        description: 'Full table scan on claims table without WHERE clause',
        impact: 'HIPAA compliance risk and performance degradation'
      });
    }

    // Check for missing indexes on common healthcare fields
    const healthcareFields = ['patient_id', 'claim_id', 'provider_id', 'date_of_service', 'diagnosis_code'];
    healthcareFields.forEach(field => {
      if (query.sql.toLowerCase().includes(`where ${field}`) && 
          query.executionTime > 500) {
        issues.push({
          type: 'missing-index',
          severity: 'warning',
          description: `Potential missing index on healthcare field: ${field}`,
          impact: 'Slow patient data retrieval'
        });
      }
    });

    return issues;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(query: QueryMetrics, issues: QueryIssue[]): QueryRecommendation[] {
    const recommendations: QueryRecommendation[] = [];

    issues.forEach(issue => {
      switch (issue.type) {
        case 'slow-execution':
          recommendations.push({
            type: 'rewrite-query',
            priority: 'high',
            description: 'Optimize query structure for healthcare data access',
            estimatedImprovement: '60-80% reduction in execution time',
            implementation: 'Add proper WHERE clauses, use JOINs efficiently, limit result sets',
            sqlExample: `
-- Original slow query
SELECT * FROM claims WHERE patient_id = ?;

-- Optimized version
SELECT claim_id, amount, status, date_created 
FROM claims 
WHERE patient_id = ? 
  AND date_created >= CURRENT_DATE - INTERVAL '1 year'
LIMIT 100;`
          });
          break;

        case 'missing-index':
          recommendations.push({
            type: 'add-index',
            priority: 'high',
            description: 'Add indexes on frequently queried healthcare fields',
            estimatedImprovement: '70-90% reduction in query time',
            implementation: 'Create composite indexes on patient_id, claim_id, and date fields',
            sqlExample: `
-- Patient-centric index for HIPAA-compliant access
CREATE INDEX idx_claims_patient_date ON claims (patient_id, date_of_service);

-- Provider performance index
CREATE INDEX idx_claims_provider_status ON claims (provider_id, claim_status, date_created);

-- Diagnosis lookup index
CREATE INDEX idx_claims_diagnosis ON claims (primary_diagnosis_code, secondary_diagnosis_code);`
          });
          break;

        case 'full-table-scan':
          recommendations.push({
            type: 'rewrite-query',
            priority: 'high',
            description: 'Avoid full table scans on sensitive healthcare data',
            estimatedImprovement: '95% reduction in data exposure and execution time',
            implementation: 'Always use WHERE clauses for patient data access',
            sqlExample: `
-- Avoid: Full table scan
SELECT * FROM claims;

-- Use: Filtered access with patient context
SELECT c.* FROM claims c 
WHERE c.patient_id = ? 
  AND c.date_created >= ?
  AND c.claim_status IN ('pending', 'approved');`
          });
          break;

        case 'inefficient-join':
          recommendations.push({
            type: 'optimize-join',
            priority: 'medium',
            description: 'Optimize JOIN operations for healthcare data relationships',
            estimatedImprovement: '40-60% improvement in query performance',
            implementation: 'Use proper JOIN types and ensure indexes on JOIN columns',
            sqlExample: `
-- Optimized healthcare data JOIN
SELECT c.claim_id, c.amount, p.name, pr.provider_name
FROM claims c
INNER JOIN patients p ON c.patient_id = p.patient_id
INNER JOIN providers pr ON c.provider_id = pr.provider_id
WHERE c.date_created >= CURRENT_DATE - INTERVAL '30 days'
  AND c.claim_status = 'pending';`
          });
          break;
      }
    });

    // Add healthcare-specific recommendations
    if (query.sql.toLowerCase().includes('patient')) {
      recommendations.push({
        type: 'partition-table',
        priority: 'medium',
        description: 'Consider partitioning large healthcare tables by date',
        estimatedImprovement: '50-70% improvement for historical data queries',
        implementation: 'Partition by date_created or date_of_service for better data management',
        sqlExample: `
-- Partition claims table by date for better performance
CREATE TABLE claims_partitioned (
  claim_id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  date_of_service DATE NOT NULL,
  -- other columns
) PARTITION BY RANGE (date_of_service);

-- Create monthly partitions
CREATE TABLE claims_2024_01 PARTITION OF claims_partitioned
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');`
      });
    }

    return recommendations;
  }

  /**
   * Get query execution plan (mock implementation)
   */
  private async getExecutionPlan(sql: string): Promise<ExecutionPlan> {
    // In a real implementation, this would execute EXPLAIN ANALYZE
    return {
      nodeType: 'Seq Scan',
      cost: 1000.00,
      rows: 1000,
      width: 100,
      actualTime: 500.25,
      children: [],
      tableName: 'claims'
    };
  }

  /**
   * Analyze index usage from execution plan
   */
  private analyzeIndexUsage(plan: ExecutionPlan): IndexUsage[] {
    const indexUsage: IndexUsage[] = [];

    // Recursive function to analyze plan nodes
    const analyzePlanNode = (node: ExecutionPlan) => {
      if (node.indexName) {
        indexUsage.push({
          indexName: node.indexName,
          tableName: node.tableName || 'unknown',
          used: true,
          scanType: node.nodeType.toLowerCase().includes('index') ? 'index_scan' : 'seq_scan',
          cost: node.cost
        });
      }

      node.children.forEach(child => analyzePlanNode(child));
    };

    analyzePlanNode(plan);
    return indexUsage;
  }

  /**
   * Calculate performance rating
   */
  private calculatePerformanceRating(query: QueryMetrics, issues: QueryIssue[]): PerformanceRating {
    let score = 100;

    // Deduct points for issues
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'warning':
          score -= 15;
          break;
        case 'info':
          score -= 5;
          break;
      }
    });

    // Execution time factor
    if (query.executionTime > 5000) score -= 20;
    else if (query.executionTime > 1000) score -= 10;

    score = Math.max(0, score);

    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    let category: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

    if (score >= 90) {
      grade = 'A';
      category = 'excellent';
    } else if (score >= 80) {
      grade = 'B';
      category = 'good';
    } else if (score >= 70) {
      grade = 'C';
      category = 'fair';
    } else if (score >= 60) {
      grade = 'D';
      category = 'poor';
    } else {
      grade = 'F';
      category = 'critical';
    }

    return { score, grade, category };
  }

  /**
   * Add query to history with size management
   */
  private addToHistory(query: QueryMetrics): void {
    this.queryHistory.push(query);

    // Maintain history size
    if (this.queryHistory.length > this.config.maxHistorySize) {
      this.queryHistory.shift();
    }
  }

  /**
   * Get slow queries analysis
   */
  getSlowQueries(limit: number = 10): QueryMetrics[] {
    return this.queryHistory
      .filter(q => q.executionTime > this.config.slowQueryThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get query performance trends
   */
  getPerformanceTrends(timeframe: 'hour' | 'day' | 'week' = 'day'): {
    averageExecutionTime: number;
    queryCount: number;
    slowQueryCount: number;
    topTables: string[];
  } {
    const now = new Date();
    const cutoff = new Date();
    
    switch (timeframe) {
      case 'hour':
        cutoff.setHours(cutoff.getHours() - 1);
        break;
      case 'day':
        cutoff.setDate(cutoff.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(cutoff.getDate() - 7);
        break;
    }

    const relevantQueries = this.queryHistory.filter(q => q.timestamp >= cutoff);
    
    const averageExecutionTime = relevantQueries.length > 0
      ? relevantQueries.reduce((sum, q) => sum + q.executionTime, 0) / relevantQueries.length
      : 0;

    const slowQueryCount = relevantQueries.filter(q => q.executionTime > this.config.slowQueryThreshold).length;

    // Extract table names from queries (simplified)
    const tableNames = relevantQueries
      .map(q => this.extractTableNames(q.sql))
      .flat();
    
    const tableCounts = tableNames.reduce((acc, table) => {
      acc[table] = (acc[table] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topTables = Object.entries(tableCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([table]) => table);

    return {
      averageExecutionTime,
      queryCount: relevantQueries.length,
      slowQueryCount,
      topTables
    };
  }

  /**
   * Extract table names from SQL (simplified)
   */
  private extractTableNames(sql: string): string[] {
    const tables: string[] = [];
    const regex = /(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    let match;

    while ((match = regex.exec(sql)) !== null) {
      tables.push(match[1]);
    }

    return tables;
  }

  /**
   * Generate healthcare-specific query patterns analysis
   */
  analyzeHealthcarePatterns(): {
    patientAccessPatterns: any;
    claimProcessingPatterns: any;
    reportingPatterns: any;
    complianceIssues: string[];
  } {
    const patientQueries = this.queryHistory.filter(q => 
      q.sql.toLowerCase().includes('patient') || 
      q.sql.toLowerCase().includes('member')
    );

    const claimQueries = this.queryHistory.filter(q => 
      q.sql.toLowerCase().includes('claim') ||
      q.sql.toLowerCase().includes('billing')
    );

    const reportQueries = this.queryHistory.filter(q => 
      q.sql.toLowerCase().includes('count') ||
      q.sql.toLowerCase().includes('sum') ||
      q.sql.toLowerCase().includes('group by')
    );

    const complianceIssues: string[] = [];

    // Check for HIPAA compliance issues
    this.queryHistory.forEach(q => {
      if (q.sql.toLowerCase().includes('select *') && 
          q.sql.toLowerCase().includes('patient')) {
        complianceIssues.push(`Query ${q.queryId}: Potential over-exposure of patient data`);
      }

      if (q.sql.toLowerCase().includes('patient') && 
          !q.sql.toLowerCase().includes('where')) {
        complianceIssues.push(`Query ${q.queryId}: Unrestricted patient data access`);
      }
    });

    return {
      patientAccessPatterns: {
        queryCount: patientQueries.length,
        averageTime: patientQueries.reduce((sum, q) => sum + q.executionTime, 0) / patientQueries.length,
        slowQueries: patientQueries.filter(q => q.executionTime > 1000).length
      },
      claimProcessingPatterns: {
        queryCount: claimQueries.length,
        averageTime: claimQueries.reduce((sum, q) => sum + q.executionTime, 0) / claimQueries.length,
        peakHours: this.getQueryPeakHours(claimQueries)
      },
      reportingPatterns: {
        queryCount: reportQueries.length,
        complexQueries: reportQueries.filter(q => q.executionTime > 5000).length
      },
      complianceIssues
    };
  }

  /**
   * Get peak hours for query types
   */
  private getQueryPeakHours(queries: QueryMetrics[]): number[] {
    const hourCounts = new Array(24).fill(0);
    
    queries.forEach(q => {
      const hour = q.timestamp.getHours();
      hourCounts[hour]++;
    });

    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);
  }

  /**
   * Generate comprehensive analysis report
   */
  generateAnalysisReport(): string {
    const trends = this.getPerformanceTrends('day');
    const slowQueries = this.getSlowQueries(5);
    const healthcarePatterns = this.analyzeHealthcarePatterns();

    return `
# Query Performance Analysis Report

## Executive Summary
- **Total Queries Analyzed**: ${this.queryHistory.length}
- **Average Execution Time**: ${trends.averageExecutionTime.toFixed(2)}ms
- **Slow Queries (>1s)**: ${trends.slowQueryCount}
- **Performance Grade**: ${this.calculateOverallGrade()}

## Healthcare-Specific Analysis

### Patient Data Access
- **Patient Queries**: ${healthcarePatterns.patientAccessPatterns.queryCount}
- **Average Response Time**: ${healthcarePatterns.patientAccessPatterns.averageTime.toFixed(2)}ms
- **Slow Patient Queries**: ${healthcarePatterns.patientAccessPatterns.slowQueries}

### Claims Processing
- **Claim Queries**: ${healthcarePatterns.claimProcessingPatterns.queryCount}
- **Peak Hours**: ${healthcarePatterns.claimProcessingPatterns.peakHours.join(', ')}
- **Average Processing Time**: ${healthcarePatterns.claimProcessingPatterns.averageTime.toFixed(2)}ms

### HIPAA Compliance Issues
${healthcarePatterns.complianceIssues.length > 0 
  ? healthcarePatterns.complianceIssues.map(issue => `⚠️ ${issue}`).join('\n')
  : '✅ No compliance issues detected'
}

## Top Performance Issues
${slowQueries.slice(0, 3).map((q, i) => `
${i + 1}. **Query ${q.queryId}**
   - Execution Time: ${q.executionTime}ms
   - Database: ${q.database}
   - SQL: ${q.sql.substring(0, 100)}...
`).join('')}

## Most Queried Tables
${trends.topTables.map((table, i) => `${i + 1}. ${table}`).join('\n')}

## Recommendations
1. **Add indexes** on frequently queried healthcare fields (patient_id, claim_id)
2. **Implement query caching** for reporting and dashboard queries
3. **Consider read replicas** for analytics workloads
4. **Partition large tables** by date for better historical data access
5. **Review HIPAA compliance** for patient data access patterns

## Next Steps
- Implement recommended indexes
- Set up automated slow query alerts
- Review and optimize top 10 slowest queries
- Establish query performance baselines
    `.trim();
  }

  /**
   * Calculate overall performance grade
   */
  private calculateOverallGrade(): string {
    const trends = this.getPerformanceTrends('day');
    
    if (trends.averageExecutionTime < 100) return 'A (Excellent)';
    if (trends.averageExecutionTime < 500) return 'B (Good)';
    if (trends.averageExecutionTime < 1000) return 'C (Fair)';
    if (trends.averageExecutionTime < 2000) return 'D (Poor)';
    return 'F (Critical)';
  }

  /**
   * Clear analysis history
   */
  clearHistory(): void {
    this.queryHistory = [];
    this.activeQueries.clear();
  }
}

/**
 * Healthcare-specific query templates
 */
export class HealthcareQueryTemplates {
  /**
   * Get optimized patient lookup query
   */
  static getPatientLookupQuery(): string {
    return `
-- Optimized patient lookup with proper indexing
SELECT p.patient_id, p.first_name, p.last_name, p.date_of_birth,
       p.member_id, p.insurance_plan
FROM patients p
WHERE p.patient_id = $1
  AND p.status = 'active'
LIMIT 1;

-- Required index:
-- CREATE INDEX idx_patients_lookup ON patients (patient_id, status);
    `;
  }

  /**
   * Get optimized claims search query
   */
  static getClaimsSearchQuery(): string {
    return `
-- Optimized claims search with date range
SELECT c.claim_id, c.patient_id, c.provider_id, c.claim_amount,
       c.claim_status, c.date_of_service, c.date_created
FROM claims c
WHERE c.patient_id = $1
  AND c.date_of_service >= $2
  AND c.date_of_service <= $3
  AND c.claim_status IN ('pending', 'approved', 'processing')
ORDER BY c.date_of_service DESC
LIMIT 50;

-- Required indexes:
-- CREATE INDEX idx_claims_patient_date ON claims (patient_id, date_of_service, claim_status);
    `;
  }

  /**
   * Get optimized provider analytics query
   */
  static getProviderAnalyticsQuery(): string {
    return `
-- Optimized provider performance analytics
SELECT pr.provider_id, pr.provider_name, pr.specialty,
       COUNT(c.claim_id) as total_claims,
       SUM(c.claim_amount) as total_amount,
       AVG(c.claim_amount) as avg_claim_amount,
       COUNT(CASE WHEN c.claim_status = 'approved' THEN 1 END) as approved_claims
FROM providers pr
LEFT JOIN claims c ON pr.provider_id = c.provider_id
WHERE c.date_of_service >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY pr.provider_id, pr.provider_name, pr.specialty
HAVING COUNT(c.claim_id) > 10
ORDER BY total_amount DESC
LIMIT 100;

-- Required indexes:
-- CREATE INDEX idx_claims_provider_analytics ON claims (provider_id, date_of_service, claim_status, claim_amount);
    `;
  }
}
