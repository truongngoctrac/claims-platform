// Main Smart Recommendations Module
export * from './interfaces';

// Core Recommendation Services
export { DocumentRecommendationEngine } from './DocumentRecommendationEngine';
export { SmartFormAutoFillService } from './SmartFormAutoFill';

// Import all services
import { DocumentRecommendationEngine } from './DocumentRecommendationEngine';
import { SmartFormAutoFillService } from './SmartFormAutoFill';

import {
  SmartComponent,
  ComponentStatus,
  ComponentPerformance,
  SmartRecommendation,
  UserFeedback,
  RecommendationContext,
  Priority,
  RecommendationType
} from './interfaces';

export interface SmartRecommendationsConfig {
  enableDocumentRecommendations: boolean;
  enableFormAutoFill: boolean;
  enableProcessOptimization: boolean;
  enablePolicyRecommendations: boolean;
  enableNextBestActions: boolean;
  enablePersonalization: boolean;
  enableContentRecommendations: boolean;
  enableSmartNotifications: boolean;
  enableUXOptimization: boolean;
  enableABTesting: boolean;
  learningEnabled: boolean;
  personalizationLevel: PersonalizationLevel;
  cacheRecommendations: boolean;
  maxRecommendationsPerRequest: number;
  recommendationExpiry: number; // hours
}

export type PersonalizationLevel = 
  | 'none'
  | 'basic'
  | 'standard'
  | 'advanced'
  | 'full';

export class SmartRecommendationsEngine {
  private config: SmartRecommendationsConfig;
  private services: Map<string, SmartComponent> = new Map();
  private isInitialized: boolean = false;

  // Core Services
  private documentRecommendations?: DocumentRecommendationEngine;
  private formAutoFill?: SmartFormAutoFillService;

  // Recommendation cache
  private recommendationCache = new Map<string, CachedRecommendation[]>();
  private userProfiles = new Map<string, UserProfile>();

  constructor(config: SmartRecommendationsConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('Initializing Smart Recommendations Engine...');

    try {
      // Initialize enabled services
      if (this.config.enableDocumentRecommendations) {
        this.documentRecommendations = new DocumentRecommendationEngine();
        await this.documentRecommendations.initialize();
        this.services.set('document_recommendations', this.documentRecommendations);
        console.log('✓ Document Recommendations service initialized');
      }

      if (this.config.enableFormAutoFill) {
        this.formAutoFill = new SmartFormAutoFillService();
        await this.formAutoFill.initialize();
        this.services.set('form_autofill', this.formAutoFill);
        console.log('✓ Smart Form Auto-fill service initialized');
      }

      // Placeholder for other services
      if (this.config.enableProcessOptimization) {
        console.log('⚠ Process Optimization service - using mock implementation');
      }

      if (this.config.enablePolicyRecommendations) {
        console.log('⚠ Policy Recommendations service - using mock implementation');
      }

      if (this.config.enableNextBestActions) {
        console.log('⚠ Next Best Actions service - using mock implementation');
      }

      if (this.config.enablePersonalization) {
        console.log('⚠ Personalization Engine - using mock implementation');
      }

      if (this.config.enableContentRecommendations) {
        console.log('⚠ Content Recommendations service - using mock implementation');
      }

      if (this.config.enableSmartNotifications) {
        console.log('⚠ Smart Notifications service - using mock implementation');
      }

      if (this.config.enableUXOptimization) {
        console.log('⚠ UX Optimization service - using mock implementation');
      }

      if (this.config.enableABTesting) {
        console.log('⚠ A/B Testing Framework - using mock implementation');
      }

      this.isInitialized = true;
      console.log('✓ Smart Recommendations Engine fully initialized');

    } catch (error) {
      console.error('Failed to initialize Smart Recommendations Engine:', error);
      throw error;
    }
  }

  // Main recommendation method
  async getRecommendations(
    userId: string,
    context: RecommendationContext,
    types?: RecommendationType[],
    options?: RecommendationOptions
  ): Promise<SmartRecommendation[]> {
    if (!this.isInitialized) {
      throw new Error('Smart Recommendations Engine not initialized');
    }

    // Check cache first
    if (this.config.cacheRecommendations && !options?.skipCache) {
      const cached = this.getCachedRecommendations(userId, context);
      if (cached.length > 0) {
        return cached.map(c => c.recommendation);
      }
    }

    const recommendations: SmartRecommendation[] = [];
    const requestedTypes = types || this.getDefaultRecommendationTypes();

    // Generate recommendations from each service
    for (const type of requestedTypes) {
      try {
        const serviceRecs = await this.getRecommendationsByType(type, userId, context, options);
        recommendations.push(...serviceRecs);
      } catch (error) {
        console.error(`Error getting ${type} recommendations:`, error);
      }
    }

    // Sort and filter recommendations
    const filteredRecs = this.filterAndSortRecommendations(recommendations, options);
    
    // Cache recommendations
    if (this.config.cacheRecommendations) {
      this.cacheRecommendations(userId, context, filteredRecs);
    }

    return filteredRecs;
  }

  private async getRecommendationsByType(
    type: RecommendationType,
    userId: string,
    context: RecommendationContext,
    options?: RecommendationOptions
  ): Promise<SmartRecommendation[]> {
    switch (type) {
      case 'document':
        if (this.documentRecommendations && options?.documentInput) {
          return await this.documentRecommendations.recommend(options.documentInput);
        }
        break;

      case 'form_autofill':
        if (this.formAutoFill && options?.formInput) {
          return await this.formAutoFill.recommend(options.formInput);
        }
        break;

      case 'process_optimization':
        return this.getMockProcessOptimizationRecommendations(userId, context);

      case 'policy':
        return this.getMockPolicyRecommendations(userId, context);

      case 'next_action':
        return this.getMockNextBestActionRecommendations(userId, context);

      case 'content':
        return this.getMockContentRecommendations(userId, context);

      case 'notification':
        return this.getMockNotificationRecommendations(userId, context);

      case 'ui_optimization':
        return this.getMockUXOptimizationRecommendations(userId, context);

      case 'personalization':
        return this.getMockPersonalizationRecommendations(userId, context);

      default:
        return [];
    }

    return [];
  }

  // Mock implementations for future services
  private getMockProcessOptimizationRecommendations(userId: string, context: RecommendationContext): SmartRecommendation[] {
    return [{
      id: `process_opt_${Date.now()}`,
      type: 'process_optimization',
      title: 'Optimize Claim Processing Workflow',
      description: 'We identified 3 steps that can be automated to reduce processing time by 40%',
      confidence: 0.85,
      priority: 'high',
      category: 'efficiency',
      targetUser: userId,
      context,
      data: {
        currentSteps: 8,
        optimizedSteps: 5,
        timeSaving: '40%',
        automationOpportunities: ['Document verification', 'Initial review', 'Status notifications']
      },
      metadata: {
        source: 'process_optimization_engine',
        algorithm: 'workflow_analysis',
        version: '1.0.0',
        generatedAt: new Date(),
        personalizedFor: userId
      },
      expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      triggers: []
    }];
  }

  private getMockPolicyRecommendations(userId: string, context: RecommendationContext): SmartRecommendation[] {
    return [{
      id: `policy_rec_${Date.now()}`,
      type: 'policy',
      title: 'Upgrade to Comprehensive Health Coverage',
      description: 'Based on your medical history, comprehensive coverage could save you 25% on treatments',
      confidence: 0.78,
      priority: 'medium',
      category: 'cost_savings',
      targetUser: userId,
      context,
      data: {
        currentPolicy: 'Basic Health',
        recommendedPolicy: 'Comprehensive Health',
        estimatedSavings: '25%',
        additionalBenefits: ['Specialist care', 'Preventive treatments', 'Emergency coverage']
      },
      metadata: {
        source: 'policy_recommendation_engine',
        algorithm: 'collaborative_filtering',
        version: '1.0.0',
        generatedAt: new Date(),
        personalizedFor: userId
      },
      expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      triggers: []
    }];
  }

  private getMockNextBestActionRecommendations(userId: string, context: RecommendationContext): SmartRecommendation[] {
    return [{
      id: `next_action_${Date.now()}`,
      type: 'next_action',
      title: 'Schedule Follow-up Appointment',
      description: 'Your recent claim indicates you should schedule a follow-up within 2 weeks',
      confidence: 0.92,
      priority: 'urgent',
      category: 'compliance',
      targetUser: userId,
      context,
      data: {
        action: 'Schedule appointment',
        deadline: '2 weeks',
        reason: 'Medical follow-up required',
        suggestedProviders: ['Dr. Nguyen - Cardiology', 'City General Hospital']
      },
      metadata: {
        source: 'next_best_action_engine',
        algorithm: 'decision_tree',
        version: '1.0.0',
        generatedAt: new Date(),
        personalizedFor: userId
      },
      expiry: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      triggers: []
    }];
  }

  private getMockContentRecommendations(userId: string, context: RecommendationContext): SmartRecommendation[] {
    return [{
      id: `content_rec_${Date.now()}`,
      type: 'content',
      title: 'Health Tips for Your Condition',
      description: 'Personalized health articles and videos based on your medical profile',
      confidence: 0.75,
      priority: 'low',
      category: 'personalization',
      targetUser: userId,
      context,
      data: {
        articles: [
          'Managing Diabetes: 10 Essential Tips',
          'Healthy Diet for Heart Conditions',
          'Exercise Guidelines for Seniors'
        ],
        videos: ['5-Minute Morning Stretches', 'Medication Management'],
        personalizationFactors: ['Medical history', 'Age group', 'Previous engagement']
      },
      metadata: {
        source: 'content_recommendation_engine',
        algorithm: 'content_based_filtering',
        version: '1.0.0',
        generatedAt: new Date(),
        personalizedFor: userId
      },
      expiry: new Date(Date.now() + 48 * 60 * 60 * 1000),
      triggers: []
    }];
  }

  private getMockNotificationRecommendations(userId: string, context: RecommendationContext): SmartRecommendation[] {
    return [{
      id: `notification_${Date.now()}`,
      type: 'notification',
      title: 'Smart Notification Optimization',
      description: 'Adjust notification timing based on your activity patterns for better engagement',
      confidence: 0.88,
      priority: 'medium',
      category: 'user_experience',
      targetUser: userId,
      context,
      data: {
        currentTiming: 'Immediate',
        recommendedTiming: 'Evenings (6-8 PM)',
        reason: 'Higher engagement during this period',
        engagementIncrease: '35%'
      },
      metadata: {
        source: 'smart_notification_engine',
        algorithm: 'behavioral_analysis',
        version: '1.0.0',
        generatedAt: new Date(),
        personalizedFor: userId
      },
      expiry: new Date(Date.now() + 72 * 60 * 60 * 1000),
      triggers: []
    }];
  }

  private getMockUXOptimizationRecommendations(userId: string, context: RecommendationContext): SmartRecommendation[] {
    return [{
      id: `ux_opt_${Date.now()}`,
      type: 'ui_optimization',
      title: 'Optimize Your Dashboard Layout',
      description: 'Customize your dashboard based on your most-used features to improve efficiency',
      confidence: 0.82,
      priority: 'medium',
      category: 'user_experience',
      targetUser: userId,
      context,
      data: {
        mostUsedFeatures: ['Claim Status', 'Document Upload', 'Policy Information'],
        recommendedLayout: 'Feature-focused with quick access sidebar',
        estimatedTimeSaving: '20%'
      },
      metadata: {
        source: 'ux_optimization_engine',
        algorithm: 'usage_pattern_analysis',
        version: '1.0.0',
        generatedAt: new Date(),
        personalizedFor: userId
      },
      expiry: new Date(Date.now() + 168 * 60 * 60 * 1000), // 1 week
      triggers: []
    }];
  }

  private getMockPersonalizationRecommendations(userId: string, context: RecommendationContext): SmartRecommendation[] {
    return [{
      id: `personalization_${Date.now()}`,
      type: 'personalization',
      title: 'Personalized Experience Settings',
      description: 'Adjust your interface and features based on your preferences and usage patterns',
      confidence: 0.90,
      priority: 'medium',
      category: 'personalization',
      targetUser: userId,
      context,
      data: {
        languagePreference: 'Vietnamese',
        themePreference: 'Light mode with high contrast',
        featureRecommendations: ['Quick claim submission', 'Simplified navigation'],
        contentPersonalization: 'Medical content in Vietnamese with visual aids'
      },
      metadata: {
        source: 'personalization_engine',
        algorithm: 'preference_learning',
        version: '1.0.0',
        generatedAt: new Date(),
        personalizedFor: userId
      },
      expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      triggers: []
    }];
  }

  // Utility methods
  private getDefaultRecommendationTypes(): RecommendationType[] {
    const types: RecommendationType[] = [];
    
    if (this.config.enableDocumentRecommendations) types.push('document');
    if (this.config.enableFormAutoFill) types.push('form_autofill');
    if (this.config.enableProcessOptimization) types.push('process_optimization');
    if (this.config.enablePolicyRecommendations) types.push('policy');
    if (this.config.enableNextBestActions) types.push('next_action');
    if (this.config.enableContentRecommendations) types.push('content');
    if (this.config.enableSmartNotifications) types.push('notification');
    if (this.config.enableUXOptimization) types.push('ui_optimization');
    if (this.config.enablePersonalization) types.push('personalization');
    
    return types;
  }

  private filterAndSortRecommendations(
    recommendations: SmartRecommendation[],
    options?: RecommendationOptions
  ): SmartRecommendation[] {
    let filtered = recommendations;

    // Filter by confidence threshold
    if (options?.minConfidence) {
      filtered = filtered.filter(r => r.confidence >= options.minConfidence);
    }

    // Filter by priority
    if (options?.priorities) {
      filtered = filtered.filter(r => options.priorities.includes(r.priority));
    }

    // Sort by priority and confidence
    filtered.sort((a, b) => {
      const priorityOrder = { 'urgent': 4, 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return b.confidence - a.confidence;
    });

    // Limit results
    const maxResults = options?.maxResults || this.config.maxRecommendationsPerRequest;
    return filtered.slice(0, maxResults);
  }

  private getCachedRecommendations(userId: string, context: RecommendationContext): CachedRecommendation[] {
    const cacheKey = this.generateCacheKey(userId, context);
    const cached = this.recommendationCache.get(cacheKey) || [];
    
    // Filter out expired recommendations
    const now = new Date();
    return cached.filter(c => c.expiry > now);
  }

  private cacheRecommendations(userId: string, context: RecommendationContext, recommendations: SmartRecommendation[]): void {
    const cacheKey = this.generateCacheKey(userId, context);
    const expiry = new Date(Date.now() + this.config.recommendationExpiry * 60 * 60 * 1000);
    
    const cached: CachedRecommendation[] = recommendations.map(rec => ({
      recommendation: rec,
      expiry,
      cachedAt: new Date()
    }));
    
    this.recommendationCache.set(cacheKey, cached);
  }

  private generateCacheKey(userId: string, context: RecommendationContext): string {
    return `${userId}_${context.currentPage}_${context.currentTask}`;
  }

  // Learning and feedback
  async submitFeedback(feedback: UserFeedback[]): Promise<void> {
    if (!this.config.learningEnabled) {
      return;
    }

    // Route feedback to appropriate services
    for (const fb of feedback) {
      const service = this.getServiceByRecommendationId(fb.recommendationId);
      if (service) {
        await service.learn([fb]);
      }
    }
  }

  private getServiceByRecommendationId(recommendationId: string): SmartComponent | null {
    // Determine service based on recommendation ID pattern
    if (recommendationId.includes('doc_')) {
      return this.documentRecommendations || null;
    }
    if (recommendationId.includes('autofill_')) {
      return this.formAutoFill || null;
    }
    // Add other service mappings as needed
    return null;
  }

  // Service getters
  getDocumentRecommendations(): DocumentRecommendationEngine | undefined {
    return this.documentRecommendations;
  }

  getFormAutoFill(): SmartFormAutoFillService | undefined {
    return this.formAutoFill;
  }

  // Engine status and health
  getEngineStatus(): EngineStatus {
    const serviceStatuses = new Map<string, ComponentStatus>();
    
    for (const [name, service] of this.services) {
      serviceStatuses.set(name, service.getStatus());
    }

    return {
      isInitialized: this.isInitialized,
      totalServices: this.services.size,
      healthyServices: Array.from(serviceStatuses.values()).filter(s => s.isReady).length,
      serviceStatuses: Object.fromEntries(serviceStatuses),
      cacheSize: this.recommendationCache.size,
      lastHealthCheck: new Date()
    };
  }

  getEngineMetrics(): EngineMetrics {
    const serviceMetrics = new Map<string, ComponentPerformance>();
    
    for (const [name, service] of this.services) {
      serviceMetrics.set(name, service.getMetrics());
    }

    const totalRecommendations = Array.from(this.services.values())
      .reduce((sum, service) => sum + service.getStatus().totalRecommendations, 0);

    const averageUserSatisfaction = Array.from(serviceMetrics.values())
      .reduce((sum, metrics) => sum + metrics.userSatisfaction, 0) / serviceMetrics.size;

    return {
      totalRecommendations,
      averageUserSatisfaction,
      serviceMetrics: Object.fromEntries(serviceMetrics),
      cacheHitRate: 0.65, // Would be calculated from actual cache usage
      lastMetricsUpdate: new Date()
    };
  }

  // Configuration management
  updateConfig(newConfig: Partial<SmartRecommendationsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SmartRecommendationsConfig {
    return { ...this.config };
  }

  // Shutdown
  async shutdown(): Promise<void> {
    console.log('Shutting down Smart Recommendations Engine...');
    
    this.services.clear();
    this.recommendationCache.clear();
    this.userProfiles.clear();
    this.isInitialized = false;
    
    console.log('✓ Smart Recommendations Engine shutdown complete');
  }
}

// Supporting interfaces
export interface RecommendationOptions {
  maxResults?: number;
  minConfidence?: number;
  priorities?: Priority[];
  skipCache?: boolean;
  documentInput?: any;
  formInput?: any;
}

export interface CachedRecommendation {
  recommendation: SmartRecommendation;
  expiry: Date;
  cachedAt: Date;
}

export interface UserProfile {
  userId: string;
  preferences: any;
  demographics: any;
  behavior: any;
  lastUpdated: Date;
}

export interface EngineStatus {
  isInitialized: boolean;
  totalServices: number;
  healthyServices: number;
  serviceStatuses: Record<string, ComponentStatus>;
  cacheSize: number;
  lastHealthCheck: Date;
}

export interface EngineMetrics {
  totalRecommendations: number;
  averageUserSatisfaction: number;
  serviceMetrics: Record<string, ComponentPerformance>;
  cacheHitRate: number;
  lastMetricsUpdate: Date;
}

// Default Configuration
export const DEFAULT_SMART_RECOMMENDATIONS_CONFIG: SmartRecommendationsConfig = {
  enableDocumentRecommendations: true,
  enableFormAutoFill: true,
  enableProcessOptimization: true,
  enablePolicyRecommendations: true,
  enableNextBestActions: true,
  enablePersonalization: true,
  enableContentRecommendations: true,
  enableSmartNotifications: true,
  enableUXOptimization: true,
  enableABTesting: false, // Advanced feature
  learningEnabled: true,
  personalizationLevel: 'standard',
  cacheRecommendations: true,
  maxRecommendationsPerRequest: 10,
  recommendationExpiry: 6 // 6 hours
};

// Factory function
export function createSmartRecommendationsEngine(
  config?: Partial<SmartRecommendationsConfig>
): SmartRecommendationsEngine {
  const finalConfig = { ...DEFAULT_SMART_RECOMMENDATIONS_CONFIG, ...config };
  return new SmartRecommendationsEngine(finalConfig);
}
