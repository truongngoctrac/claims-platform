/**
 * Resource Threshold Management System
 * Healthcare Claims Processing System
 */

export interface ResourceThreshold {
  id: string;
  name: string;
  resource: 'cpu' | 'memory' | 'disk' | 'network' | 'custom';
  metric: string;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  unit: string;
  operator: 'greater_than' | 'less_than' | 'equal' | 'not_equal';
  enabled: boolean;
  priority: number;
  cooldownPeriod: number;
  evaluationWindow: number;
  consecutiveBreaches: number;
  tags: string[];
  conditions?: ThresholdCondition[];
}

export interface ThresholdCondition {
  field: string;
  operator: 'and' | 'or';
  value: any;
  type: 'time' | 'metric' | 'state';
}

export interface ThresholdBreach {
  thresholdId: string;
  timestamp: Date;
  currentValue: number;
  thresholdValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration: number;
  consecutiveCount: number;
  resourceType: string;
  serviceName: string;
  action: 'scale-up' | 'scale-down' | 'alert-only';
  resolved: boolean;
  resolvedAt?: Date;
}

export interface ThresholdEvaluation {
  thresholdId: string;
  timestamp: Date;
  currentValue: number;
  breached: boolean;
  action: 'none' | 'scale-up' | 'scale-down' | 'alert';
  reason: string;
  metadata: { [key: string]: any };
}

export interface AdaptiveThreshold {
  baseThreshold: number;
  adaptationRate: number;
  historicalWindow: number;
  percentile: number;
  enabled: boolean;
  lastAdaptation: Date;
}

export interface ThresholdTemplate {
  name: string;
  description: string;
  thresholds: Partial<ResourceThreshold>[];
  applicableServices: string[];
  environment: 'development' | 'staging' | 'production';
}

export class ResourceThresholdManagement {
  private thresholds: Map<string, ResourceThreshold> = new Map();
  private breaches: Map<string, ThresholdBreach[]> = new Map();
  private adaptiveThresholds: Map<string, AdaptiveThreshold> = new Map();
  private evaluationHistory: Map<string, ThresholdEvaluation[]> = new Map();
  private templates: Map<string, ThresholdTemplate> = new Map();

  constructor() {
    this.initializeHealthcareThresholds();
    this.initializeTemplates();
  }

  /**
   * Initialize healthcare-specific threshold templates
   */
  private initializeHealthcareThresholds(): void {
    // CPU thresholds for claims processing
    this.addThreshold({
      id: 'cpu-claims-processing',
      name: 'Claims Processing CPU Threshold',
      resource: 'cpu',
      metric: 'cpu_utilization_percent',
      scaleUpThreshold: 70,
      scaleDownThreshold: 30,
      unit: 'percentage',
      operator: 'greater_than',
      enabled: true,
      priority: 1,
      cooldownPeriod: 300000, // 5 minutes
      evaluationWindow: 60000, // 1 minute
      consecutiveBreaches: 3,
      tags: ['healthcare', 'claims', 'cpu'],
      conditions: [
        {
          field: 'business_hours',
          operator: 'and',
          value: true,
          type: 'time'
        }
      ]
    });

    // Memory thresholds for document processing
    this.addThreshold({
      id: 'memory-document-processing',
      name: 'Document Processing Memory Threshold',
      resource: 'memory',
      metric: 'memory_utilization_percent',
      scaleUpThreshold: 80,
      scaleDownThreshold: 40,
      unit: 'percentage',
      operator: 'greater_than',
      enabled: true,
      priority: 2,
      cooldownPeriod: 240000, // 4 minutes
      evaluationWindow: 120000, // 2 minutes
      consecutiveBreaches: 2,
      tags: ['healthcare', 'documents', 'memory']
    });

    // Queue length threshold for claim processing
    this.addThreshold({
      id: 'queue-claims-pending',
      name: 'Pending Claims Queue Threshold',
      resource: 'custom',
      metric: 'pending_claims_count',
      scaleUpThreshold: 100,
      scaleDownThreshold: 20,
      unit: 'count',
      operator: 'greater_than',
      enabled: true,
      priority: 3,
      cooldownPeriod: 180000, // 3 minutes
      evaluationWindow: 60000, // 1 minute
      consecutiveBreaches: 2,
      tags: ['healthcare', 'claims', 'queue']
    });

    // Response time threshold for API endpoints
    this.addThreshold({
      id: 'response-time-api',
      name: 'API Response Time Threshold',
      resource: 'custom',
      metric: 'api_response_time_ms',
      scaleUpThreshold: 2000,
      scaleDownThreshold: 500,
      unit: 'milliseconds',
      operator: 'greater_than',
      enabled: true,
      priority: 1,
      cooldownPeriod: 120000, // 2 minutes
      evaluationWindow: 60000, // 1 minute
      consecutiveBreaches: 3,
      tags: ['healthcare', 'api', 'performance']
    });

    // Error rate threshold
    this.addThreshold({
      id: 'error-rate-critical',
      name: 'Critical Error Rate Threshold',
      resource: 'custom',
      metric: 'error_rate_percent',
      scaleUpThreshold: 5,
      scaleDownThreshold: 1,
      unit: 'percentage',
      operator: 'greater_than',
      enabled: true,
      priority: 1,
      cooldownPeriod: 60000, // 1 minute
      evaluationWindow: 30000, // 30 seconds
      consecutiveBreaches: 2,
      tags: ['healthcare', 'errors', 'critical']
    });
  }

  /**
   * Initialize threshold templates
   */
  private initializeTemplates(): void {
    this.templates.set('healthcare-claims-basic', {
      name: 'Healthcare Claims Basic',
      description: 'Basic thresholds for healthcare claims processing',
      applicableServices: ['claims-api', 'document-processor', 'notification-service'],
      environment: 'production',
      thresholds: [
        {
          name: 'CPU Threshold',
          resource: 'cpu',
          scaleUpThreshold: 70,
          scaleDownThreshold: 30,
          priority: 1
        },
        {
          name: 'Memory Threshold',
          resource: 'memory',
          scaleUpThreshold: 80,
          scaleDownThreshold: 40,
          priority: 2
        }
      ]
    });

    this.templates.set('healthcare-emergency', {
      name: 'Healthcare Emergency Response',
      description: 'Aggressive scaling for emergency healthcare scenarios',
      applicableServices: ['emergency-claims', 'urgent-processing'],
      environment: 'production',
      thresholds: [
        {
          name: 'Emergency CPU Threshold',
          resource: 'cpu',
          scaleUpThreshold: 50,
          scaleDownThreshold: 20,
          priority: 1,
          cooldownPeriod: 60000
        },
        {
          name: 'Emergency Queue Threshold',
          resource: 'custom',
          metric: 'emergency_queue_length',
          scaleUpThreshold: 10,
          scaleDownThreshold: 2,
          priority: 1
        }
      ]
    });
  }

  /**
   * Add a new threshold
   */
  addThreshold(threshold: ResourceThreshold): void {
    this.thresholds.set(threshold.id, threshold);
    console.log(`✅ Added threshold: ${threshold.name}`);
  }

  /**
   * Update existing threshold
   */
  updateThreshold(id: string, updates: Partial<ResourceThreshold>): boolean {
    const threshold = this.thresholds.get(id);
    if (!threshold) {
      console.log(`❌ Threshold not found: ${id}`);
      return false;
    }

    const updatedThreshold = { ...threshold, ...updates };
    this.thresholds.set(id, updatedThreshold);
    console.log(`✅ Updated threshold: ${id}`);
    return true;
  }

  /**
   * Remove threshold
   */
  removeThreshold(id: string): boolean {
    const removed = this.thresholds.delete(id);
    if (removed) {
      console.log(`✅ Removed threshold: ${id}`);
    } else {
      console.log(`❌ Threshold not found: ${id}`);
    }
    return removed;
  }

  /**
   * Enable or disable threshold
   */
  setThresholdEnabled(id: string, enabled: boolean): boolean {
    const threshold = this.thresholds.get(id);
    if (!threshold) {
      return false;
    }

    threshold.enabled = enabled;
    this.thresholds.set(id, threshold);
    console.log(`✅ ${enabled ? 'Enabled' : 'Disabled'} threshold: ${id}`);
    return true;
  }

  /**
   * Evaluate all thresholds against current metrics
   */
  async evaluateThresholds(metrics: { [key: string]: number }): Promise<ThresholdEvaluation[]> {
    const evaluations: ThresholdEvaluation[] = [];
    const now = new Date();

    for (const [id, threshold] of this.thresholds) {
      if (!threshold.enabled) {
        continue;
      }

      const evaluation = await this.evaluateThreshold(threshold, metrics, now);
      evaluations.push(evaluation);

      // Store evaluation history
      this.storeEvaluation(id, evaluation);

      // Handle breach if detected
      if (evaluation.breached) {
        await this.handleThresholdBreach(threshold, evaluation);
      }
    }

    return evaluations;
  }

  /**
   * Evaluate single threshold
   */
  private async evaluateThreshold(
    threshold: ResourceThreshold,
    metrics: { [key: string]: number },
    timestamp: Date
  ): Promise<ThresholdEvaluation> {
    const currentValue = metrics[threshold.metric] || 0;
    let breached = false;
    let action: 'none' | 'scale-up' | 'scale-down' | 'alert' = 'none';
    let reason = '';

    // Check conditions first
    if (threshold.conditions && !this.evaluateConditions(threshold.conditions, timestamp)) {
      return {
        thresholdId: threshold.id,
        timestamp,
        currentValue,
        breached: false,
        action: 'none',
        reason: 'Conditions not met',
        metadata: { conditionsEvaluated: true }
      };
    }

    // Evaluate threshold breach
    switch (threshold.operator) {
      case 'greater_than':
        if (currentValue > threshold.scaleUpThreshold) {
          breached = true;
          action = 'scale-up';
          reason = `Value ${currentValue} > ${threshold.scaleUpThreshold}`;
        } else if (currentValue < threshold.scaleDownThreshold) {
          breached = true;
          action = 'scale-down';
          reason = `Value ${currentValue} < ${threshold.scaleDownThreshold}`;
        }
        break;

      case 'less_than':
        if (currentValue < threshold.scaleUpThreshold) {
          breached = true;
          action = 'scale-up';
          reason = `Value ${currentValue} < ${threshold.scaleUpThreshold}`;
        } else if (currentValue > threshold.scaleDownThreshold) {
          breached = true;
          action = 'scale-down';
          reason = `Value ${currentValue} > ${threshold.scaleDownThreshold}`;
        }
        break;

      case 'equal':
        if (currentValue === threshold.scaleUpThreshold) {
          breached = true;
          action = 'scale-up';
          reason = `Value equals ${threshold.scaleUpThreshold}`;
        }
        break;

      case 'not_equal':
        if (currentValue !== threshold.scaleUpThreshold) {
          breached = true;
          action = 'alert';
          reason = `Value ${currentValue} != ${threshold.scaleUpThreshold}`;
        }
        break;
    }

    // Check cooldown period
    if (breached && this.isInCooldown(threshold.id, threshold.cooldownPeriod)) {
      action = 'none';
      reason += ' (in cooldown)';
      breached = false;
    }

    // Check consecutive breaches requirement
    if (breached && !this.hasConsecutiveBreaches(threshold.id, threshold.consecutiveBreaches)) {
      action = 'alert';
      reason += ` (${this.getConsecutiveBreachCount(threshold.id)}/${threshold.consecutiveBreaches} consecutive)`;
    }

    return {
      thresholdId: threshold.id,
      timestamp,
      currentValue,
      breached,
      action,
      reason,
      metadata: {
        threshold: threshold.scaleUpThreshold,
        priority: threshold.priority,
        resource: threshold.resource
      }
    };
  }

  /**
   * Evaluate threshold conditions
   */
  private evaluateConditions(conditions: ThresholdCondition[], timestamp: Date): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'time':
          return this.evaluateTimeCondition(condition, timestamp);
        case 'metric':
          return this.evaluateMetricCondition(condition);
        case 'state':
          return this.evaluateStateCondition(condition);
        default:
          return true;
      }
    });
  }

  /**
   * Evaluate time-based condition
   */
  private evaluateTimeCondition(condition: ThresholdCondition, timestamp: Date): boolean {
    if (condition.field === 'business_hours') {
      const hour = timestamp.getHours();
      const isBusinessHours = hour >= 8 && hour < 18;
      return condition.value === isBusinessHours;
    }

    if (condition.field === 'day_of_week') {
      const dayOfWeek = timestamp.getDay();
      return condition.value.includes(dayOfWeek);
    }

    return true;
  }

  /**
   * Evaluate metric-based condition
   */
  private evaluateMetricCondition(condition: ThresholdCondition): boolean {
    // Implementation would check against other metrics
    return true;
  }

  /**
   * Evaluate state-based condition
   */
  private evaluateStateCondition(condition: ThresholdCondition): boolean {
    // Implementation would check system state
    return true;
  }

  /**
   * Handle threshold breach
   */
  private async handleThresholdBreach(
    threshold: ResourceThreshold,
    evaluation: ThresholdEvaluation
  ): Promise<void> {
    const breach: ThresholdBreach = {
      thresholdId: threshold.id,
      timestamp: evaluation.timestamp,
      currentValue: evaluation.currentValue,
      thresholdValue: threshold.scaleUpThreshold,
      severity: this.calculateSeverity(threshold, evaluation),
      duration: 0,
      consecutiveCount: this.getConsecutiveBreachCount(threshold.id) + 1,
      resourceType: threshold.resource,
      serviceName: threshold.tags.find(tag => tag.startsWith('service:'))?.split(':')[1] || 'unknown',
      action: evaluation.action as 'scale-up' | 'scale-down' | 'alert-only',
      resolved: false
    };

    // Store breach
    this.storeBreach(threshold.id, breach);

    console.log(`🚨 Threshold breach detected: ${threshold.name}`, {
      currentValue: evaluation.currentValue,
      threshold: threshold.scaleUpThreshold,
      action: evaluation.action,
      severity: breach.severity
    });
  }

  /**
   * Calculate breach severity
   */
  private calculateSeverity(
    threshold: ResourceThreshold,
    evaluation: ThresholdEvaluation
  ): 'low' | 'medium' | 'high' | 'critical' {
    const percentage = Math.abs(
      (evaluation.currentValue - threshold.scaleUpThreshold) / threshold.scaleUpThreshold
    ) * 100;

    if (percentage > 100) return 'critical';
    if (percentage > 50) return 'high';
    if (percentage > 25) return 'medium';
    return 'low';
  }

  /**
   * Check if threshold is in cooldown period
   */
  private isInCooldown(thresholdId: string, cooldownPeriod: number): boolean {
    const evaluations = this.evaluationHistory.get(thresholdId) || [];
    const lastAction = evaluations
      .filter(e => e.action !== 'none' && e.action !== 'alert')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (!lastAction) return false;

    const timeSinceLastAction = Date.now() - lastAction.timestamp.getTime();
    return timeSinceLastAction < cooldownPeriod;
  }

  /**
   * Check consecutive breaches
   */
  private hasConsecutiveBreaches(thresholdId: string, required: number): boolean {
    const evaluations = this.evaluationHistory.get(thresholdId) || [];
    const recent = evaluations
      .slice(-required)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (recent.length < required) return false;

    return recent.every(e => e.breached);
  }

  /**
   * Get consecutive breach count
   */
  private getConsecutiveBreachCount(thresholdId: string): number {
    const evaluations = this.evaluationHistory.get(thresholdId) || [];
    const sorted = evaluations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    let count = 0;
    for (const evaluation of sorted) {
      if (evaluation.breached) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  /**
   * Store evaluation in history
   */
  private storeEvaluation(thresholdId: string, evaluation: ThresholdEvaluation): void {
    if (!this.evaluationHistory.has(thresholdId)) {
      this.evaluationHistory.set(thresholdId, []);
    }

    const history = this.evaluationHistory.get(thresholdId)!;
    history.push(evaluation);

    // Keep only last 100 evaluations
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * Store breach information
   */
  private storeBreach(thresholdId: string, breach: ThresholdBreach): void {
    if (!this.breaches.has(thresholdId)) {
      this.breaches.set(thresholdId, []);
    }

    const breaches = this.breaches.get(thresholdId)!;
    breaches.push(breach);

    // Keep only last 50 breaches
    if (breaches.length > 50) {
      breaches.splice(0, breaches.length - 50);
    }
  }

  /**
   * Get threshold by ID
   */
  getThreshold(id: string): ResourceThreshold | undefined {
    return this.thresholds.get(id);
  }

  /**
   * Get all thresholds
   */
  getAllThresholds(): ResourceThreshold[] {
    return Array.from(this.thresholds.values());
  }

  /**
   * Get thresholds by tag
   */
  getThresholdsByTag(tag: string): ResourceThreshold[] {
    return Array.from(this.thresholds.values())
      .filter(threshold => threshold.tags.includes(tag));
  }

  /**
   * Get recent breaches
   */
  getRecentBreaches(thresholdId?: string, timeWindow: number = 3600000): ThresholdBreach[] {
    const cutoff = new Date(Date.now() - timeWindow);
    const allBreaches: ThresholdBreach[] = [];

    if (thresholdId) {
      const breaches = this.breaches.get(thresholdId) || [];
      allBreaches.push(...breaches.filter(b => b.timestamp > cutoff));
    } else {
      for (const breaches of this.breaches.values()) {
        allBreaches.push(...breaches.filter(b => b.timestamp > cutoff));
      }
    }

    return allBreaches.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get threshold statistics
   */
  getThresholdStatistics(thresholdId: string): {
    totalEvaluations: number;
    totalBreaches: number;
    breachRate: number;
    avgBreachDuration: number;
    lastBreach?: Date;
  } {
    const evaluations = this.evaluationHistory.get(thresholdId) || [];
    const breaches = this.breaches.get(thresholdId) || [];

    const totalEvaluations = evaluations.length;
    const totalBreaches = breaches.length;
    const breachRate = totalEvaluations > 0 ? (totalBreaches / totalEvaluations) * 100 : 0;

    const resolvedBreaches = breaches.filter(b => b.resolved && b.resolvedAt);
    const avgBreachDuration = resolvedBreaches.length > 0
      ? resolvedBreaches.reduce((sum, b) => {
          const duration = b.resolvedAt!.getTime() - b.timestamp.getTime();
          return sum + duration;
        }, 0) / resolvedBreaches.length
      : 0;

    const lastBreach = breaches.length > 0
      ? breaches.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0].timestamp
      : undefined;

    return {
      totalEvaluations,
      totalBreaches,
      breachRate,
      avgBreachDuration,
      lastBreach
    };
  }

  /**
   * Apply threshold template
   */
  applyTemplate(templateName: string, serviceName: string): boolean {
    const template = this.templates.get(templateName);
    if (!template) {
      console.log(`❌ Template not found: ${templateName}`);
      return false;
    }

    template.thresholds.forEach((thresholdTemplate, index) => {
      const threshold: ResourceThreshold = {
        id: `${serviceName}-${templateName}-${index}`,
        name: `${serviceName} ${thresholdTemplate.name}`,
        resource: thresholdTemplate.resource || 'cpu',
        metric: thresholdTemplate.metric || `${thresholdTemplate.resource}_utilization_percent`,
        scaleUpThreshold: thresholdTemplate.scaleUpThreshold || 70,
        scaleDownThreshold: thresholdTemplate.scaleDownThreshold || 30,
        unit: thresholdTemplate.unit || 'percentage',
        operator: thresholdTemplate.operator || 'greater_than',
        enabled: thresholdTemplate.enabled !== false,
        priority: thresholdTemplate.priority || 5,
        cooldownPeriod: thresholdTemplate.cooldownPeriod || 300000,
        evaluationWindow: thresholdTemplate.evaluationWindow || 60000,
        consecutiveBreaches: thresholdTemplate.consecutiveBreaches || 3,
        tags: [...(thresholdTemplate.tags || []), `service:${serviceName}`, `template:${templateName}`],
        conditions: thresholdTemplate.conditions
      };

      this.addThreshold(threshold);
    });

    console.log(`✅ Applied template ${templateName} to service ${serviceName}`);
    return true;
  }
}
