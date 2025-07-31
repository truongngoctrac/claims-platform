/**
 * Slow Query Analysis System
 * Advanced slow query detection and optimization for healthcare databases
 */

export interface SlowQueryConfig {
  thresholdMs: number;
  enableRealTimeDetection: boolean;
  enableQueryPlanAnalysis: boolean;
  enableHealthcarePatterns: boolean;
  retentionDays: number;
  enableAutoOptimization: boolean;
}

export interface SlowQuery {
  queryId: string;
  sql: string;
  executionTime: number;
  planTime: number;
  calls: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
  totalTime: number;
  database: string;
  user: string;
  timestamp: Date;
  healthcareContext?: HealthcareQueryContext;
  optimizationSuggestions: OptimizationSuggestion[];
}

export interface HealthcareQueryContext {
  dataType: 'patient' | 'claims' | 'provider' | 'audit' | 'reporting';
  hipaaRelevant: boolean;
  criticalityLevel: 'critical' | 'high' | 'medium' | 'low';
  businessImpact: string;
}

export interface OptimizationSuggestion {
  type: 'index' | 'rewrite' | 'partition' | 'cache' | 'configuration';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  implementation: string;
  estimatedImprovement: string;
  sqlExample?: string;
}

export class SlowQueryAnalyzer {
  private config: SlowQueryConfig;
  private slowQueries: SlowQuery[] = [];
  private patterns = new Map<string, number>();

  constructor(config: Partial<SlowQueryConfig> = {}) {
    this.config = {
      thresholdMs: 1000,
      enableRealTimeDetection: true,
      enableQueryPlanAnalysis: true,
      enableHealthcarePatterns: true,
      retentionDays: 30,
      enableAutoOptimization: false,
      ...config
    };
  }

  /**
   * Analyze slow query with healthcare context
   */
  analyzeSlowQuery(queryData: Partial<SlowQuery>): SlowQuery {
    const slowQuery: SlowQuery = {
      queryId: queryData.queryId || `sq_${Date.now()}`,
      sql: queryData.sql || '',
      executionTime: queryData.executionTime || 0,
      planTime: queryData.planTime || 0,
      calls: queryData.calls || 1,
      avgTime: queryData.avgTime || queryData.executionTime || 0,
      maxTime: queryData.maxTime || queryData.executionTime || 0,
      minTime: queryData.minTime || queryData.executionTime || 0,
      totalTime: queryData.totalTime || queryData.executionTime || 0,
      database: queryData.database || 'healthcare_db',
      user: queryData.user || 'unknown',
      timestamp: queryData.timestamp || new Date(),
      optimizationSuggestions: []
    };

    // Add healthcare context
    if (this.config.enableHealthcarePatterns) {
      slowQuery.healthcareContext = this.analyzeHealthcareContext(slowQuery.sql);
    }

    // Generate optimization suggestions
    slowQuery.optimizationSuggestions = this.generateOptimizationSuggestions(slowQuery);

    // Store for analysis
    this.slowQueries.push(slowQuery);
    this.updatePatterns(slowQuery);
    this.cleanup();

    return slowQuery;
  }

  /**
   * Analyze healthcare context of the query
   */
  private analyzeHealthcareContext(sql: string): HealthcareQueryContext {
    const sqlLower = sql.toLowerCase();
    
    // Patient data queries
    if (sqlLower.includes('patient') || sqlLower.includes('member')) {
      return {
        dataType: 'patient',
        hipaaRelevant: true,
        criticalityLevel: 'critical',
        businessImpact: 'Direct impact on patient care and access'
      };
    }
    
    // Claims processing queries
    if (sqlLower.includes('claim') || sqlLower.includes('billing')) {
      return {
        dataType: 'claims',
        hipaaRelevant: true,
        criticalityLevel: 'high',
        businessImpact: 'Affects claim processing and provider payments'
      };
    }
    
    // Provider queries
    if (sqlLower.includes('provider') || sqlLower.includes('doctor')) {
      return {
        dataType: 'provider',
        hipaaRelevant: false,
        criticalityLevel: 'medium',
        businessImpact: 'Impacts provider directory and network management'
      };
    }
    
    // Audit queries
    if (sqlLower.includes('audit') || sqlLower.includes('log')) {
      return {
        dataType: 'audit',
        hipaaRelevant: true,
        criticalityLevel: 'high',
        businessImpact: 'Critical for compliance and security monitoring'
      };
    }
    
    // Default to reporting
    return {
      dataType: 'reporting',
      hipaaRelevant: false,
      criticalityLevel: 'low',
      businessImpact: 'Affects business intelligence and reporting'
    };
  }

  /**
   * Generate healthcare-specific optimization suggestions
   */
  private generateOptimizationSuggestions(query: SlowQuery): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const sql = query.sql.toLowerCase();
    const context = query.healthcareContext;

    // Patient data optimization
    if (context?.dataType === 'patient') {
      if (sql.includes('select *')) {
        suggestions.push({
          type: 'rewrite',
          priority: 'critical',
          description: 'Avoid SELECT * on patient tables for HIPAA compliance',
          implementation: 'Specify only required columns to minimize data exposure',
          estimatedImprovement: '60-80% performance improvement + compliance',
          sqlExample: `
-- Instead of: SELECT * FROM patients WHERE patient_id = ?
SELECT patient_id, first_name, last_name, date_of_birth 
FROM patients WHERE patient_id = ?;`
        });
      }

      if (!sql.includes('limit') && sql.includes('where')) {
        suggestions.push({
          type: 'rewrite',
          priority: 'high',
          description: 'Add LIMIT clause for patient queries',
          implementation: 'Limit result sets to prevent large data exposures',
          estimatedImprovement: '70% improvement in response time',
          sqlExample: `
-- Add LIMIT to patient searches
SELECT * FROM patients WHERE last_name = ? LIMIT 50;`
        });
      }
    }

    // Claims processing optimization
    if (context?.dataType === 'claims') {
      if (sql.includes('date_of_service') && !sql.includes('index')) {
        suggestions.push({
          type: 'index',
          priority: 'high',
          description: 'Add index on date_of_service for claims queries',
          implementation: 'CREATE INDEX idx_claims_service_date ON claims (date_of_service, claim_status)',
          estimatedImprovement: '80-90% improvement for date range queries',
          sqlExample: `
CREATE INDEX idx_claims_service_date 
ON claims (date_of_service, claim_status, patient_id);`
        });
      }

      if (sql.includes('group by') && query.executionTime > 5000) {
        suggestions.push({
          type: 'partition',
          priority: 'medium',
          description: 'Consider partitioning claims table by date',
          implementation: 'Partition claims table by date_of_service for better aggregation performance',
          estimatedImprovement: '50-70% improvement for reporting queries'
        });
      }
    }

    // General optimization suggestions
    if (query.executionTime > 10000) { // 10 seconds
      suggestions.push({
        type: 'cache',
        priority: 'high',
        description: 'Implement query result caching',
        implementation: 'Cache query results with appropriate TTL based on data volatility',
        estimatedImprovement: '95% improvement for repeated queries'
      });
    }

    return suggestions;
  }

  /**
   * Update query patterns for trending analysis
   */
  private updatePatterns(query: SlowQuery): void {
    // Extract pattern from SQL
    const pattern = this.extractQueryPattern(query.sql);
    this.patterns.set(pattern, (this.patterns.get(pattern) || 0) + 1);
  }

  /**
   * Extract query pattern for analysis
   */
  private extractQueryPattern(sql: string): string {
    // Normalize SQL to identify patterns
    return sql
      .toLowerCase()
      .replace(/\d+/g, '?') // Replace numbers with placeholders
      .replace(/'[^']*'/g, '?') // Replace string literals
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Cleanup old slow query records
   */
  private cleanup(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    this.slowQueries = this.slowQueries.filter(q => q.timestamp > cutoffDate);
  }

  /**
   * Generate slow query analysis report
   */
  generateSlowQueryReport(): string {
    const totalQueries = this.slowQueries.length;
    const criticalQueries = this.slowQueries.filter(q => 
      q.healthcareContext?.criticalityLevel === 'critical'
    ).length;
    
    const avgExecutionTime = totalQueries > 0 
      ? this.slowQueries.reduce((sum, q) => sum + q.executionTime, 0) / totalQueries
      : 0;

    return `
# Slow Query Analysis Report

## Overview
- **Total Slow Queries**: ${totalQueries}
- **Critical Healthcare Queries**: ${criticalQueries}
- **Average Execution Time**: ${avgExecutionTime.toFixed(2)}ms
- **Analysis Period**: Last ${this.config.retentionDays} days

## Healthcare Query Breakdown
${this.generateHealthcareBreakdown()}

## Top Slow Queries
${this.slowQueries
  .sort((a, b) => b.executionTime - a.executionTime)
  .slice(0, 5)
  .map((query, index) => `
### ${index + 1}. Query ID: ${query.queryId}
- **Execution Time**: ${query.executionTime}ms
- **Data Type**: ${query.healthcareContext?.dataType || 'unknown'}
- **Criticality**: ${query.healthcareContext?.criticalityLevel || 'unknown'}
- **HIPAA Relevant**: ${query.healthcareContext?.hipaaRelevant ? 'Yes' : 'No'}
- **SQL**: \`${query.sql.substring(0, 100)}...\`
- **Top Suggestion**: ${query.optimizationSuggestions[0]?.description || 'No suggestions'}
`).join('')}

## Query Patterns
${Array.from(this.patterns.entries())
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5)
  .map(([pattern, count]) => `- **${count}x**: ${pattern.substring(0, 80)}...`)
  .join('\n')}

## Optimization Summary
${this.generateOptimizationSummary()}

## Healthcare Compliance Impact
${this.generateComplianceImpact()}

## Recommendations
${this.generateRecommendations()}
    `.trim();
  }

  private generateHealthcareBreakdown(): string {
    const breakdown = this.slowQueries.reduce((acc, query) => {
      const type = query.healthcareContext?.dataType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(breakdown)
      .map(([type, count]) => `- **${type}**: ${count} queries`)
      .join('\n');
  }

  private generateOptimizationSummary(): string {
    const allSuggestions = this.slowQueries.flatMap(q => q.optimizationSuggestions);
    const suggestionTypes = allSuggestions.reduce((acc, suggestion) => {
      acc[suggestion.type] = (acc[suggestion.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(suggestionTypes)
      .map(([type, count]) => `- **${type}**: ${count} suggestions`)
      .join('\n');
  }

  private generateComplianceImpact(): string {
    const hipaaQueries = this.slowQueries.filter(q => q.healthcareContext?.hipaaRelevant);
    const criticalQueries = this.slowQueries.filter(q => 
      q.healthcareContext?.criticalityLevel === 'critical'
    );

    return `
- **HIPAA-Relevant Slow Queries**: ${hipaaQueries.length}
- **Critical Patient Care Impact**: ${criticalQueries.length}
- **Compliance Risk Level**: ${criticalQueries.length > 5 ? 'High' : 'Medium'}
- **Patient Care Impact**: ${criticalQueries.length > 0 ? 'Direct impact on patient access times' : 'No direct patient impact'}
    `.trim();
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const criticalCount = this.slowQueries.filter(q => 
      q.healthcareContext?.criticalityLevel === 'critical'
    ).length;
    
    if (criticalCount > 0) {
      recommendations.push('• Prioritize optimization of patient and critical healthcare queries');
    }
    
    const selectStarCount = this.slowQueries.filter(q => 
      q.sql.toLowerCase().includes('select *')
    ).length;
    
    if (selectStarCount > 0) {
      recommendations.push('• Replace SELECT * with specific column lists for HIPAA compliance');
    }
    
    const avgTime = this.slowQueries.reduce((sum, q) => sum + q.executionTime, 0) / this.slowQueries.length;
    if (avgTime > 5000) {
      recommendations.push('• Implement aggressive indexing strategy for healthcare tables');
    }
    
    return recommendations.length > 0 ? recommendations : ['• Query performance appears acceptable'];
  }

  getSlowQueries(): SlowQuery[] {
    return [...this.slowQueries];
  }
}
