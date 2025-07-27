import { ThreatDetectionEvent, SecurityConfiguration } from '../types';
import { EventEmitter } from 'events';

interface ThreatPattern {
  id: string;
  name: string;
  description: string;
  pattern_type: 'behavioral' | 'signature' | 'anomaly' | 'ml_based';
  indicators: {
    ip_patterns: string[];
    user_agent_patterns: string[];
    request_patterns: string[];
    time_patterns: string[];
    frequency_thresholds: Record<string, number>;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence_threshold: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

interface MLModel {
  id: string;
  name: string;
  type: 'anomaly_detection' | 'classification' | 'clustering' | 'sequence_analysis';
  version: string;
  accuracy: number;
  last_trained: Date;
  training_data_size: number;
  feature_importance: Record<string, number>;
  enabled: boolean;
}

interface ThreatIntelligence {
  source: string;
  type: 'ip_reputation' | 'domain_reputation' | 'file_hash' | 'signature';
  indicator: string;
  threat_type: string;
  confidence: number;
  last_seen: Date;
  description: string;
}

export class ThreatDetectionService extends EventEmitter {
  private detectedThreats: ThreatDetectionEvent[] = [];
  private threatPatterns: ThreatPattern[] = [];
  private mlModels: MLModel[] = [];
  private threatIntelligence: ThreatIntelligence[] = [];
  private isActive = false;
  private analysisQueue: Array<{ timestamp: Date; data: any }> = [];
  private behaviorBaselines: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeThreatPatterns();
    this.initializeMLModels();
    this.initializeThreatIntelligence();
  }

  async initialize(): Promise<void> {
    if (this.isActive) return;
    
    await this.loadBehaviorBaselines();
    await this.startRealTimeAnalysis();
    await this.updateThreatIntelligence();
    
    this.isActive = true;
    this.emit('threat_detection_started', { timestamp: new Date() });
  }

  async analyzeEvent(eventData: any): Promise<ThreatDetectionEvent | null> {
    try {
      // Add to analysis queue
      this.analysisQueue.push({ timestamp: new Date(), data: eventData });
      
      // Perform multi-layered analysis
      const threatAnalysis = await Promise.all([
        this.performSignatureAnalysis(eventData),
        this.performBehavioralAnalysis(eventData),
        this.performAnomalyDetection(eventData),
        this.performMLAnalysis(eventData),
        this.performThreatIntelligenceCheck(eventData)
      ]);

      // Combine results and calculate overall threat score
      const combinedAnalysis = this.combineAnalysisResults(threatAnalysis);
      
      if (combinedAnalysis.is_threat) {
        const threatEvent = await this.createThreatEvent(eventData, combinedAnalysis);
        this.detectedThreats.push(threatEvent);
        
        await this.respondToThreat(threatEvent);
        this.emit('threat_detected', threatEvent);
        
        return threatEvent;
      }

      return null;
    } catch (error) {
      this.emit('analysis_error', { event: eventData, error });
      return null;
    }
  }

  private async performSignatureAnalysis(eventData: any): Promise<{
    threat_detected: boolean;
    confidence: number;
    matched_patterns: string[];
    details: any;
  }> {
    const matchedPatterns: string[] = [];
    let maxConfidence = 0;

    for (const pattern of this.threatPatterns.filter(p => p.enabled && p.pattern_type === 'signature')) {
      const confidence = await this.evaluatePattern(pattern, eventData);
      if (confidence >= pattern.confidence_threshold) {
        matchedPatterns.push(pattern.id);
        maxConfidence = Math.max(maxConfidence, confidence);
      }
    }

    return {
      threat_detected: matchedPatterns.length > 0,
      confidence: maxConfidence,
      matched_patterns: matchedPatterns,
      details: { signature_analysis: true }
    };
  }

  private async performBehavioralAnalysis(eventData: any): Promise<{
    threat_detected: boolean;
    confidence: number;
    anomaly_score: number;
    details: any;
  }> {
    const userId = eventData.user_id || 'anonymous';
    const baseline = this.behaviorBaselines.get(userId);
    
    if (!baseline) {
      // Create new baseline
      await this.createUserBaseline(userId, eventData);
      return {
        threat_detected: false,
        confidence: 0,
        anomaly_score: 0,
        details: { baseline_created: true }
      };
    }

    // Analyze deviations from baseline
    const deviations = await this.calculateBehavioralDeviations(eventData, baseline);
    const anomalyScore = this.calculateAnomalyScore(deviations);
    
    const isThreat = anomalyScore > 0.7; // Threshold for behavioral anomalies
    
    return {
      threat_detected: isThreat,
      confidence: isThreat ? anomalyScore : 0,
      anomaly_score: anomalyScore,
      details: { deviations, baseline_comparison: true }
    };
  }

  private async performAnomalyDetection(eventData: any): Promise<{
    threat_detected: boolean;
    confidence: number;
    anomaly_type: string;
    details: any;
  }> {
    // Time-based anomaly detection
    const timeAnomalies = await this.detectTimeAnomalies(eventData);
    
    // Frequency-based anomaly detection
    const frequencyAnomalies = await this.detectFrequencyAnomalies(eventData);
    
    // Geographic anomaly detection
    const geoAnomalies = await this.detectGeographicAnomalies(eventData);
    
    const anomalies = [...timeAnomalies, ...frequencyAnomalies, ...geoAnomalies];
    const maxConfidence = Math.max(0, ...anomalies.map(a => a.confidence));
    
    return {
      threat_detected: anomalies.length > 0,
      confidence: maxConfidence,
      anomaly_type: anomalies.length > 0 ? anomalies[0].type : 'none',
      details: { anomalies }
    };
  }

  private async performMLAnalysis(eventData: any): Promise<{
    threat_detected: boolean;
    confidence: number;
    model_predictions: any[];
    details: any;
  }> {
    const predictions = [];
    
    for (const model of this.mlModels.filter(m => m.enabled)) {
      try {
        const prediction = await this.runMLModel(model, eventData);
        predictions.push({
          model_id: model.id,
          prediction: prediction.is_threat,
          confidence: prediction.confidence,
          features: prediction.features
        });
      } catch (error) {
        this.emit('ml_model_error', { model: model.id, error });
      }
    }

    const avgConfidence = predictions.length > 0 
      ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
      : 0;
    
    const isThreat = predictions.some(p => p.prediction && p.confidence > 0.6);

    return {
      threat_detected: isThreat,
      confidence: avgConfidence,
      model_predictions: predictions,
      details: { ml_analysis: true }
    };
  }

  private async performThreatIntelligenceCheck(eventData: any): Promise<{
    threat_detected: boolean;
    confidence: number;
    matched_indicators: string[];
    details: any;
  }> {
    const matchedIndicators: string[] = [];
    let maxConfidence = 0;

    // Check IP reputation
    if (eventData.ip_address) {
      const ipThreat = this.threatIntelligence.find(
        ti => ti.type === 'ip_reputation' && ti.indicator === eventData.ip_address
      );
      if (ipThreat) {
        matchedIndicators.push(`ip:${ipThreat.indicator}`);
        maxConfidence = Math.max(maxConfidence, ipThreat.confidence);
      }
    }

    // Check domain reputation
    if (eventData.domain) {
      const domainThreat = this.threatIntelligence.find(
        ti => ti.type === 'domain_reputation' && ti.indicator === eventData.domain
      );
      if (domainThreat) {
        matchedIndicators.push(`domain:${domainThreat.indicator}`);
        maxConfidence = Math.max(maxConfidence, domainThreat.confidence);
      }
    }

    return {
      threat_detected: matchedIndicators.length > 0,
      confidence: maxConfidence,
      matched_indicators: matchedIndicators,
      details: { threat_intelligence_check: true }
    };
  }

  private combineAnalysisResults(results: any[]): {
    is_threat: boolean;
    overall_confidence: number;
    threat_types: string[];
    analysis_summary: any;
  } {
    const threatResults = results.filter(r => r.threat_detected);
    const allConfidences = results.map(r => r.confidence || 0);
    
    // Weighted scoring based on analysis type reliability
    const weights = {
      signature: 0.3,
      behavioral: 0.25,
      anomaly: 0.2,
      ml: 0.15,
      threat_intel: 0.1
    };

    const weightedScore = results.reduce((score, result, index) => {
      const weight = Object.values(weights)[index] || 0.1;
      return score + (result.confidence || 0) * weight;
    }, 0);

    const overallConfidence = Math.min(1.0, weightedScore);
    const isThreat = overallConfidence > 0.5;

    return {
      is_threat: isThreat,
      overall_confidence: overallConfidence,
      threat_types: threatResults.map((_, index) => Object.keys(weights)[index]).filter(Boolean),
      analysis_summary: {
        total_analyses: results.length,
        positive_results: threatResults.length,
        weighted_score: weightedScore,
        individual_results: results
      }
    };
  }

  private async createThreatEvent(eventData: any, analysis: any): Promise<ThreatDetectionEvent> {
    const severity = this.calculateThreatSeverity(analysis.overall_confidence);
    const eventType = this.determineThreatType(eventData, analysis);

    const threatEvent: ThreatDetectionEvent = {
      id: `threat_${Date.now()}`,
      timestamp: new Date(),
      event_type: eventType,
      severity,
      source_ip: eventData.ip_address || 'unknown',
      target_system: eventData.target_system || 'unknown',
      user_agent: eventData.user_agent,
      user_id: eventData.user_id,
      description: this.generateThreatDescription(eventType, analysis),
      indicators: this.extractThreatIndicators(eventData, analysis),
      confidence_score: analysis.overall_confidence,
      blocked: false,
      response_actions: []
    };

    return threatEvent;
  }

  private async respondToThreat(threat: ThreatDetectionEvent): Promise<void> {
    const responses = [];

    // Automatic response based on severity and type
    if (threat.severity === 'critical') {
      responses.push('immediate_block');
      responses.push('isolate_system');
      responses.push('escalate_incident');
    } else if (threat.severity === 'high') {
      responses.push('rate_limit');
      responses.push('enhanced_monitoring');
      responses.push('notify_security_team');
    } else if (threat.severity === 'medium') {
      responses.push('log_event');
      responses.push('monitor_user');
    }

    threat.response_actions = responses;

    for (const action of responses) {
      try {
        await this.executeResponse(action, threat);
      } catch (error) {
        this.emit('response_error', { action, threat: threat.id, error });
      }
    }
  }

  async getRecentThreats(limit: number = 10): Promise<ThreatDetectionEvent[]> {
    return this.detectedThreats
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getThreatsByType(eventType: string): Promise<ThreatDetectionEvent[]> {
    return this.detectedThreats.filter(threat => threat.event_type === eventType);
  }

  async getThreatStatistics(): Promise<{
    total_threats: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
    blocked_percentage: number;
    average_confidence: number;
    recent_trends: any;
  }> {
    const total = this.detectedThreats.length;
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalConfidence = 0;
    let blockedCount = 0;

    this.detectedThreats.forEach(threat => {
      bySeverity[threat.severity] = (bySeverity[threat.severity] || 0) + 1;
      byType[threat.event_type] = (byType[threat.event_type] || 0) + 1;
      totalConfidence += threat.confidence_score;
      if (threat.blocked) blockedCount++;
    });

    return {
      total_threats: total,
      by_severity: bySeverity,
      by_type: byType,
      blocked_percentage: total > 0 ? (blockedCount / total) * 100 : 0,
      average_confidence: total > 0 ? totalConfidence / total : 0,
      recent_trends: this.calculateThreatTrends()
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.isActive &&
           this.threatPatterns.filter(p => p.enabled).length > 0 &&
           this.mlModels.filter(m => m.enabled).length > 0;
  }

  // Helper methods with mock implementations
  private async evaluatePattern(pattern: ThreatPattern, eventData: any): Promise<number> {
    let confidence = 0;

    // IP pattern matching
    if (pattern.indicators.ip_patterns.some(ip => eventData.ip_address?.includes(ip))) {
      confidence += 0.3;
    }

    // User agent pattern matching
    if (pattern.indicators.user_agent_patterns.some(ua => eventData.user_agent?.includes(ua))) {
      confidence += 0.2;
    }

    // Request pattern matching
    if (pattern.indicators.request_patterns.some(req => eventData.request_path?.includes(req))) {
      confidence += 0.3;
    }

    // Frequency threshold checks
    for (const [metric, threshold] of Object.entries(pattern.indicators.frequency_thresholds)) {
      if (eventData[metric] && eventData[metric] > threshold) {
        confidence += 0.2;
      }
    }

    return Math.min(1.0, confidence);
  }

  private async createUserBaseline(userId: string, eventData: any): Promise<void> {
    const baseline = {
      user_id: userId,
      typical_hours: [new Date().getHours()],
      typical_ips: [eventData.ip_address],
      typical_user_agents: [eventData.user_agent],
      typical_actions: [eventData.action],
      request_frequency: 1,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.behaviorBaselines.set(userId, baseline);
  }

  private async calculateBehavioralDeviations(eventData: any, baseline: any): Promise<any> {
    const currentHour = new Date().getHours();
    const timeDeviation = !baseline.typical_hours.includes(currentHour);
    const ipDeviation = !baseline.typical_ips.includes(eventData.ip_address);
    const uaDeviation = !baseline.typical_user_agents.includes(eventData.user_agent);

    return {
      time_deviation: timeDeviation,
      ip_deviation: ipDeviation,
      user_agent_deviation: uaDeviation,
      frequency_deviation: eventData.request_frequency > baseline.request_frequency * 3
    };
  }

  private calculateAnomalyScore(deviations: any): number {
    const weights = { time: 0.2, ip: 0.4, user_agent: 0.2, frequency: 0.2 };
    let score = 0;

    if (deviations.time_deviation) score += weights.time;
    if (deviations.ip_deviation) score += weights.ip;
    if (deviations.user_agent_deviation) score += weights.user_agent;
    if (deviations.frequency_deviation) score += weights.frequency;

    return score;
  }

  private async detectTimeAnomalies(eventData: any): Promise<any[]> {
    const currentHour = new Date().getHours();
    if (currentHour >= 2 && currentHour <= 5) { // Unusual hours
      return [{
        type: 'time_anomaly',
        confidence: 0.6,
        description: 'Activity during unusual hours'
      }];
    }
    return [];
  }

  private async detectFrequencyAnomalies(eventData: any): Promise<any[]> {
    if (eventData.request_frequency && eventData.request_frequency > 100) {
      return [{
        type: 'frequency_anomaly',
        confidence: 0.8,
        description: 'Unusually high request frequency'
      }];
    }
    return [];
  }

  private async detectGeographicAnomalies(eventData: any): Promise<any[]> {
    // Mock geographic anomaly detection
    if (eventData.country && eventData.country !== 'Vietnam') {
      return [{
        type: 'geographic_anomaly',
        confidence: 0.4,
        description: 'Access from unusual geographic location'
      }];
    }
    return [];
  }

  private async runMLModel(model: MLModel, eventData: any): Promise<{
    is_threat: boolean;
    confidence: number;
    features: any;
  }> {
    // Mock ML model prediction
    const features = this.extractFeatures(eventData);
    const confidence = Math.random();
    const isThreat = confidence > 0.6;

    return {
      is_threat: isThreat,
      confidence: confidence,
      features: features
    };
  }

  private extractFeatures(eventData: any): any {
    return {
      hour_of_day: new Date().getHours(),
      request_size: eventData.request_size || 0,
      response_time: eventData.response_time || 0,
      status_code: eventData.status_code || 200,
      user_agent_length: eventData.user_agent?.length || 0
    };
  }

  private calculateThreatSeverity(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence >= 0.9) return 'critical';
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  private determineThreatType(eventData: any, analysis: any): ThreatDetectionEvent['event_type'] {
    if (analysis.analysis_summary.individual_results[0]?.matched_patterns?.length > 0) {
      return 'intrusion_attempt';
    }
    if (analysis.analysis_summary.individual_results[1]?.anomaly_score > 0.7) {
      return 'anomaly';
    }
    if (analysis.analysis_summary.individual_results[4]?.matched_indicators?.length > 0) {
      return 'malware';
    }
    return 'anomaly';
  }

  private generateThreatDescription(eventType: string, analysis: any): string {
    const confidence = Math.round(analysis.overall_confidence * 100);
    return `${eventType} detected with ${confidence}% confidence based on multi-layer analysis`;
  }

  private extractThreatIndicators(eventData: any, analysis: any): string[] {
    const indicators = [];
    if (eventData.ip_address) indicators.push(`source_ip:${eventData.ip_address}`);
    if (eventData.user_agent) indicators.push(`user_agent:${eventData.user_agent}`);
    if (eventData.request_path) indicators.push(`request_path:${eventData.request_path}`);
    return indicators;
  }

  private calculateThreatTrends(): any {
    const last24h = this.detectedThreats.filter(
      t => t.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    );
    
    return {
      last_24h_count: last24h.length,
      trend_direction: Math.random() > 0.5 ? 'increasing' : 'decreasing',
      most_common_type: 'intrusion_attempt'
    };
  }

  private async executeResponse(action: string, threat: ThreatDetectionEvent): Promise<void> {
    switch (action) {
      case 'immediate_block':
        threat.blocked = true;
        this.emit('threat_blocked', threat);
        break;
      case 'isolate_system':
        this.emit('system_isolated', { system: threat.target_system, threat });
        break;
      case 'escalate_incident':
        this.emit('incident_escalated', threat);
        break;
      case 'rate_limit':
        this.emit('rate_limit_applied', { ip: threat.source_ip, threat });
        break;
      case 'enhanced_monitoring':
        this.emit('monitoring_enhanced', threat);
        break;
      case 'notify_security_team':
        this.emit('security_team_notified', threat);
        break;
      case 'log_event':
        this.emit('threat_logged', threat);
        break;
      case 'monitor_user':
        this.emit('user_monitoring_enabled', { user: threat.user_id, threat });
        break;
    }
  }

  private async loadBehaviorBaselines(): Promise<void> {
    // Mock loading baselines from storage
    this.behaviorBaselines.clear();
  }

  private async startRealTimeAnalysis(): Promise<void> {
    // Mock real-time analysis setup
    setInterval(() => {
      if (this.analysisQueue.length > 0) {
        const events = this.analysisQueue.splice(0, 10); // Process 10 events at a time
        events.forEach(event => {
          this.analyzeEvent(event.data).catch(error => {
            this.emit('analysis_error', { event: event.data, error });
          });
        });
      }
    }, 1000);
  }

  private async updateThreatIntelligence(): Promise<void> {
    // Mock threat intelligence update
    setInterval(() => {
      this.emit('threat_intelligence_updated', { 
        timestamp: new Date(),
        sources_updated: this.threatIntelligence.length 
      });
    }, 60 * 60 * 1000); // Hourly updates
  }

  private initializeThreatPatterns(): void {
    this.threatPatterns = [
      {
        id: 'sql_injection_pattern',
        name: 'SQL Injection Detection',
        description: 'Detects SQL injection attempts in requests',
        pattern_type: 'signature',
        indicators: {
          ip_patterns: [],
          user_agent_patterns: ['sqlmap', 'havij'],
          request_patterns: ['union select', 'drop table', '1=1', 'or 1=1'],
          time_patterns: [],
          frequency_thresholds: { request_frequency: 50 }
        },
        severity: 'high',
        confidence_threshold: 0.7,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'brute_force_pattern',
        name: 'Brute Force Attack Detection',
        description: 'Detects brute force login attempts',
        pattern_type: 'behavioral',
        indicators: {
          ip_patterns: [],
          user_agent_patterns: [],
          request_patterns: ['/login', '/auth'],
          time_patterns: [],
          frequency_thresholds: { failed_attempts: 10 }
        },
        severity: 'medium',
        confidence_threshold: 0.6,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
  }

  private initializeMLModels(): void {
    this.mlModels = [
      {
        id: 'anomaly_detector_v1',
        name: 'Behavioral Anomaly Detector',
        type: 'anomaly_detection',
        version: '1.0.0',
        accuracy: 0.87,
        last_trained: new Date(),
        training_data_size: 100000,
        feature_importance: {
          hour_of_day: 0.3,
          request_frequency: 0.4,
          response_time: 0.2,
          geographic_location: 0.1
        },
        enabled: true
      },
      {
        id: 'threat_classifier_v2',
        name: 'Threat Classification Model',
        type: 'classification',
        version: '2.1.0',
        accuracy: 0.92,
        last_trained: new Date(),
        training_data_size: 250000,
        feature_importance: {
          request_patterns: 0.4,
          user_behavior: 0.3,
          network_patterns: 0.2,
          temporal_patterns: 0.1
        },
        enabled: true
      }
    ];
  }

  private initializeThreatIntelligence(): void {
    this.threatIntelligence = [
      {
        source: 'malware_db',
        type: 'ip_reputation',
        indicator: '192.168.1.100',
        threat_type: 'botnet',
        confidence: 0.95,
        last_seen: new Date(),
        description: 'Known botnet command and control server'
      },
      {
        source: 'domain_intel',
        type: 'domain_reputation',
        indicator: 'malicious-site.com',
        threat_type: 'phishing',
        confidence: 0.88,
        last_seen: new Date(),
        description: 'Confirmed phishing domain targeting healthcare systems'
      }
    ];
  }
}
