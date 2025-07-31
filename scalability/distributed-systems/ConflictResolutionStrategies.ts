/**
 * Conflict Resolution Strategies Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface ConflictContext {
  key: string;
  conflictingValues: ConflictingValue[];
  lastResolution?: Date;
  resolutionStrategy: string;
  metadata: Record<string, any>;
}

export interface ConflictingValue {
  value: any;
  version: number;
  timestamp: number;
  nodeId: string;
  vectorClock?: VectorClock;
  confidence?: number;
  source?: string;
}

export interface VectorClock {
  [nodeId: string]: number;
}

export interface ResolutionResult {
  resolvedValue: any;
  strategy: string;
  confidence: number;
  metadata: Record<string, any>;
  isManualReview?: boolean;
}

export abstract class ConflictResolutionStrategy {
  protected strategyName: string;

  constructor(strategyName: string) {
    this.strategyName = strategyName;
  }

  abstract resolve(context: ConflictContext): Promise<ResolutionResult>;
  abstract canHandle(context: ConflictContext): boolean;
  abstract getConfidence(context: ConflictContext): number;
}

export class LastWriteWinsStrategy extends ConflictResolutionStrategy {
  constructor() {
    super('last_write_wins');
  }

  async resolve(context: ConflictContext): Promise<ResolutionResult> {
    console.log(`⏰ Resolving conflict using Last Write Wins for key: ${context.key}`);
    
    const latest = context.conflictingValues.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );

    return {
      resolvedValue: latest.value,
      strategy: this.strategyName,
      confidence: 0.8,
      metadata: {
        winningTimestamp: latest.timestamp,
        winningNode: latest.nodeId,
        discardedValues: context.conflictingValues.length - 1,
      },
    };
  }

  canHandle(context: ConflictContext): boolean {
    return context.conflictingValues.length > 1;
  }

  getConfidence(context: ConflictContext): number {
    // Higher confidence when timestamps are significantly different
    const timestamps = context.conflictingValues.map(v => v.timestamp);
    const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
    
    return maxDiff > 1000 ? 0.9 : 0.6; // 1 second difference = high confidence
  }
}

export class VectorClockStrategy extends ConflictResolutionStrategy {
  constructor() {
    super('vector_clock');
  }

  async resolve(context: ConflictContext): Promise<ResolutionResult> {
    console.log(`🕐 Resolving conflict using Vector Clocks for key: ${context.key}`);
    
    const valuesWithClocks = context.conflictingValues.filter(v => v.vectorClock);
    
    if (valuesWithClocks.length === 0) {
      throw new Error('Vector clocks not available for conflict resolution');
    }

    const winner = this.findCausalWinner(valuesWithClocks);
    
    if (winner) {
      return {
        resolvedValue: winner.value,
        strategy: this.strategyName,
        confidence: 0.95,
        metadata: {
          causalRelation: 'sequential',
          winningClock: winner.vectorClock,
        },
      };
    }

    // Concurrent updates - use application-specific logic
    const merged = await this.mergeConcurrentValues(valuesWithClocks);
    
    return {
      resolvedValue: merged,
      strategy: this.strategyName,
      confidence: 0.7,
      metadata: {
        causalRelation: 'concurrent',
        mergedValues: valuesWithClocks.length,
      },
    };
  }

  canHandle(context: ConflictContext): boolean {
    return context.conflictingValues.some(v => v.vectorClock);
  }

  getConfidence(context: ConflictContext): number {
    const clocksAvailable = context.conflictingValues.filter(v => v.vectorClock).length;
    return clocksAvailable / context.conflictingValues.length;
  }

  private findCausalWinner(values: ConflictingValue[]): ConflictingValue | null {
    for (let i = 0; i < values.length; i++) {
      const isWinner = values.every((other, j) => {
        if (i === j) return true;
        return this.happensBefore(other.vectorClock!, values[i].vectorClock!);
      });
      
      if (isWinner) {
        return values[i];
      }
    }
    
    return null;
  }

  private happensBefore(clock1: VectorClock, clock2: VectorClock): boolean {
    const allNodes = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);
    let hasSmaller = false;
    
    for (const node of allNodes) {
      const val1 = clock1[node] || 0;
      const val2 = clock2[node] || 0;
      
      if (val1 > val2) return false;
      if (val1 < val2) hasSmaller = true;
    }
    
    return hasSmaller;
  }

  private async mergeConcurrentValues(values: ConflictingValue[]): Promise<any> {
    // Application-specific merge logic for concurrent updates
    if (values.length === 0) return null;
    
    const baseValue = values[0].value;
    
    if (typeof baseValue === 'object' && baseValue !== null) {
      return this.mergeObjects(values.map(v => v.value));
    }
    
    // For non-objects, use the value with highest confidence or most recent
    return values.reduce((best, current) => 
      (current.confidence || 0) > (best.confidence || 0) ? current : best
    ).value;
  }

  private mergeObjects(objects: any[]): any {
    const merged = {};
    
    objects.forEach(obj => {
      if (typeof obj === 'object' && obj !== null) {
        Object.assign(merged, obj);
      }
    });
    
    return merged;
  }
}

export class HealthcareConflictStrategy extends ConflictResolutionStrategy {
  constructor() {
    super('healthcare_specific');
  }

  async resolve(context: ConflictContext): Promise<ResolutionResult> {
    console.log(`🏥 Resolving healthcare conflict for key: ${context.key}`);
    
    const dataType = this.inferDataType(context.key);
    
    switch (dataType) {
      case 'patient_vital_signs':
        return this.resolveVitalSignsConflict(context);
      case 'medication_record':
        return this.resolveMedicationConflict(context);
      case 'claim_status':
        return this.resolveClaimStatusConflict(context);
      case 'diagnosis':
        return this.resolveDiagnosisConflict(context);
      default:
        return this.resolveGenericHealthcareConflict(context);
    }
  }

  canHandle(context: ConflictContext): boolean {
    return this.isHealthcareData(context.key);
  }

  getConfidence(context: ConflictContext): number {
    const dataType = this.inferDataType(context.key);
    const criticalTypes = ['patient_vital_signs', 'medication_record'];
    
    return criticalTypes.includes(dataType) ? 0.95 : 0.8;
  }

  private inferDataType(key: string): string {
    if (key.includes('vital') || key.includes('heart_rate') || key.includes('blood_pressure')) {
      return 'patient_vital_signs';
    }
    if (key.includes('medication') || key.includes('prescription')) {
      return 'medication_record';
    }
    if (key.includes('claim') && key.includes('status')) {
      return 'claim_status';
    }
    if (key.includes('diagnosis')) {
      return 'diagnosis';
    }
    return 'unknown';
  }

  private isHealthcareData(key: string): boolean {
    const healthcareKeywords = ['patient', 'claim', 'vital', 'medication', 'diagnosis', 'treatment'];
    return healthcareKeywords.some(keyword => key.toLowerCase().includes(keyword));
  }

  private async resolveVitalSignsConflict(context: ConflictContext): Promise<ResolutionResult> {
    console.log(`💓 Resolving vital signs conflict`);
    
    // For vital signs, prefer the most recent reading from a trusted device
    const trustedSources = ['icu_monitor', 'patient_monitor', 'nurse_station'];
    
    const trusted = context.conflictingValues.filter(v => 
      trustedSources.includes(v.source || '')
    );
    
    const valuesToConsider = trusted.length > 0 ? trusted : context.conflictingValues;
    const latest = valuesToConsider.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );

    // Validate vital signs are within reasonable ranges
    if (this.isValidVitalSigns(latest.value)) {
      return {
        resolvedValue: latest.value,
        strategy: this.strategyName,
        confidence: 0.95,
        metadata: {
          resolvedBy: 'vital_signs_logic',
          source: latest.source,
          validationPassed: true,
        },
      };
    }

    // If latest is invalid, find most recent valid reading
    const validValues = valuesToConsider.filter(v => this.isValidVitalSigns(v.value));
    
    if (validValues.length > 0) {
      const validLatest = validValues.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      
      return {
        resolvedValue: validLatest.value,
        strategy: this.strategyName,
        confidence: 0.8,
        metadata: {
          resolvedBy: 'vital_signs_validation',
          invalidValuesDiscarded: valuesToConsider.length - validValues.length,
        },
        isManualReview: true,
      };
    }

    // All values are invalid - flag for manual review
    return {
      resolvedValue: latest.value,
      strategy: this.strategyName,
      confidence: 0.3,
      metadata: {
        resolvedBy: 'fallback',
        requiresManualReview: true,
      },
      isManualReview: true,
    };
  }

  private async resolveMedicationConflict(context: ConflictContext): Promise<ResolutionResult> {
    console.log(`💊 Resolving medication conflict`);
    
    // For medications, prefer prescriptions from doctors over other sources
    const doctorPrescriptions = context.conflictingValues.filter(v => 
      v.source === 'doctor' || v.metadata?.role === 'physician'
    );
    
    if (doctorPrescriptions.length > 0) {
      const latest = doctorPrescriptions.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      
      return {
        resolvedValue: latest.value,
        strategy: this.strategyName,
        confidence: 0.95,
        metadata: {
          resolvedBy: 'physician_authority',
          prescribingPhysician: latest.nodeId,
        },
      };
    }

    // No doctor prescriptions - use most recent from pharmacy
    const pharmacyRecords = context.conflictingValues.filter(v => 
      v.source === 'pharmacy'
    );
    
    if (pharmacyRecords.length > 0) {
      const latest = pharmacyRecords.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      
      return {
        resolvedValue: latest.value,
        strategy: this.strategyName,
        confidence: 0.8,
        metadata: {
          resolvedBy: 'pharmacy_authority',
        },
        isManualReview: true,
      };
    }

    // Fallback to most recent
    const latest = context.conflictingValues.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );

    return {
      resolvedValue: latest.value,
      strategy: this.strategyName,
      confidence: 0.5,
      metadata: {
        resolvedBy: 'fallback',
        requiresPhysicianReview: true,
      },
      isManualReview: true,
    };
  }

  private async resolveClaimStatusConflict(context: ConflictContext): Promise<ResolutionResult> {
    console.log(`📋 Resolving claim status conflict`);
    
    // Define claim status hierarchy (later statuses generally override earlier ones)
    const statusHierarchy = [
      'submitted',
      'under_review',
      'additional_info_requested',
      'approved',
      'partially_approved',
      'denied',
      'appeal_submitted',
      'appeal_approved',
      'appeal_denied',
      'paid'
    ];

    const latestStatus = context.conflictingValues.reduce((latest, current) => {
      const latestIndex = statusHierarchy.indexOf(latest.value?.status || '');
      const currentIndex = statusHierarchy.indexOf(current.value?.status || '');
      
      // Prefer higher hierarchy status, or more recent if same hierarchy
      if (currentIndex > latestIndex) return current;
      if (currentIndex === latestIndex && current.timestamp > latest.timestamp) return current;
      return latest;
    });

    return {
      resolvedValue: latestStatus.value,
      strategy: this.strategyName,
      confidence: 0.9,
      metadata: {
        resolvedBy: 'claim_status_hierarchy',
        statusHierarchy: statusHierarchy.indexOf(latestStatus.value?.status || ''),
      },
    };
  }

  private async resolveDiagnosisConflict(context: ConflictContext): Promise<ResolutionResult> {
    console.log(`🩺 Resolving diagnosis conflict`);
    
    // For diagnosis conflicts, prefer specialists over general practitioners
    const specialistDiagnoses = context.conflictingValues.filter(v => 
      v.metadata?.doctorSpecialty && v.metadata.doctorSpecialty !== 'general_practice'
    );

    if (specialistDiagnoses.length > 0) {
      const latest = specialistDiagnoses.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      
      return {
        resolvedValue: latest.value,
        strategy: this.strategyName,
        confidence: 0.9,
        metadata: {
          resolvedBy: 'specialist_authority',
          specialty: latest.metadata?.doctorSpecialty,
        },
      };
    }

    // Multiple general practitioners - flag for specialist review
    const latest = context.conflictingValues.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );

    return {
      resolvedValue: latest.value,
      strategy: this.strategyName,
      confidence: 0.6,
      metadata: {
        resolvedBy: 'general_practitioner',
        requiresSpecialistReview: true,
      },
      isManualReview: true,
    };
  }

  private async resolveGenericHealthcareConflict(context: ConflictContext): Promise<ResolutionResult> {
    // Generic healthcare conflict resolution
    const latest = context.conflictingValues.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );

    return {
      resolvedValue: latest.value,
      strategy: this.strategyName,
      confidence: 0.7,
      metadata: {
        resolvedBy: 'generic_healthcare_logic',
      },
    };
  }

  private isValidVitalSigns(vitalSigns: any): boolean {
    if (!vitalSigns || typeof vitalSigns !== 'object') return false;
    
    const ranges = {
      heartRate: { min: 30, max: 200 },
      systolicBP: { min: 60, max: 250 },
      diastolicBP: { min: 30, max: 150 },
      temperature: { min: 30, max: 45 }, // Celsius
      oxygenSaturation: { min: 70, max: 100 },
    };

    for (const [key, range] of Object.entries(ranges)) {
      if (vitalSigns[key] !== undefined) {
        const value = vitalSigns[key];
        if (value < range.min || value > range.max) {
          return false;
        }
      }
    }

    return true;
  }
}

export class ConflictResolutionManager {
  private strategies: ConflictResolutionStrategy[] = [];
  private conflictHistory: Map<string, ConflictResolution[]> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    this.strategies = [
      new HealthcareConflictStrategy(),
      new VectorClockStrategy(),
      new LastWriteWinsStrategy(),
    ];
  }

  async resolveConflict(context: ConflictContext): Promise<ResolutionResult> {
    console.log(`🔧 Resolving conflict for key: ${context.key} with ${context.conflictingValues.length} values`);
    
    // Find the best strategy for this conflict
    const strategy = this.selectBestStrategy(context);
    
    if (!strategy) {
      throw new Error(`No suitable conflict resolution strategy found for key: ${context.key}`);
    }

    // Resolve the conflict
    const result = await strategy.resolve(context);
    
    // Record the resolution
    await this.recordResolution(context, result);
    
    // Log metrics
    this.logResolutionMetrics(context, result);
    
    return result;
  }

  private selectBestStrategy(context: ConflictContext): ConflictResolutionStrategy | null {
    const applicableStrategies = this.strategies.filter(strategy => 
      strategy.canHandle(context)
    );

    if (applicableStrategies.length === 0) {
      return null;
    }

    // Select strategy with highest confidence
    return applicableStrategies.reduce((best, current) => {
      const bestConfidence = best.getConfidence(context);
      const currentConfidence = current.getConfidence(context);
      return currentConfidence > bestConfidence ? current : best;
    });
  }

  private async recordResolution(context: ConflictContext, result: ResolutionResult): Promise<void> {
    const resolution: ConflictResolution = {
      timestamp: new Date(),
      key: context.key,
      strategy: result.strategy,
      confidence: result.confidence,
      conflictingValuesCount: context.conflictingValues.length,
      isManualReview: result.isManualReview || false,
      metadata: result.metadata,
    };

    if (!this.conflictHistory.has(context.key)) {
      this.conflictHistory.set(context.key, []);
    }

    this.conflictHistory.get(context.key)!.push(resolution);
    
    // Keep only last 100 resolutions per key
    const history = this.conflictHistory.get(context.key)!;
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private logResolutionMetrics(context: ConflictContext, result: ResolutionResult): void {
    console.log(`📊 Conflict Resolution Metrics:
      Key: ${context.key}
      Strategy: ${result.strategy}
      Confidence: ${result.confidence}
      Values: ${context.conflictingValues.length}
      Manual Review: ${result.isManualReview || false}
    `);
  }

  getConflictHistory(key: string): ConflictResolution[] {
    return this.conflictHistory.get(key) || [];
  }

  getConflictMetrics(): ConflictMetrics {
    const allResolutions = Array.from(this.conflictHistory.values()).flat();
    
    const byStrategy = new Map<string, number>();
    let manualReviews = 0;
    let totalConfidence = 0;

    allResolutions.forEach(resolution => {
      byStrategy.set(resolution.strategy, (byStrategy.get(resolution.strategy) || 0) + 1);
      if (resolution.isManualReview) manualReviews++;
      totalConfidence += resolution.confidence;
    });

    return {
      totalConflicts: allResolutions.length,
      resolutionsByStrategy: Object.fromEntries(byStrategy),
      manualReviewRate: allResolutions.length > 0 ? manualReviews / allResolutions.length : 0,
      averageConfidence: allResolutions.length > 0 ? totalConfidence / allResolutions.length : 0,
      lastResolution: allResolutions.length > 0 ? allResolutions[allResolutions.length - 1].timestamp : null,
    };
  }

  async addCustomStrategy(strategy: ConflictResolutionStrategy): Promise<void> {
    this.strategies.unshift(strategy); // Add at beginning for higher priority
    console.log(`➕ Added custom conflict resolution strategy: ${strategy['strategyName']}`);
  }
}

interface ConflictResolution {
  timestamp: Date;
  key: string;
  strategy: string;
  confidence: number;
  conflictingValuesCount: number;
  isManualReview: boolean;
  metadata: Record<string, any>;
}

interface ConflictMetrics {
  totalConflicts: number;
  resolutionsByStrategy: Record<string, number>;
  manualReviewRate: number;
  averageConfidence: number;
  lastResolution: Date | null;
}

// Custom strategy for specific healthcare scenarios
export class EmergencyPriorityStrategy extends ConflictResolutionStrategy {
  constructor() {
    super('emergency_priority');
  }

  async resolve(context: ConflictContext): Promise<ResolutionResult> {
    console.log(`🚨 Emergency priority conflict resolution for: ${context.key}`);
    
    // In emergency scenarios, prefer real-time data from ICU/emergency sources
    const emergencySources = ['icu', 'emergency_room', 'ambulance', 'emergency_monitor'];
    
    const emergencyValues = context.conflictingValues.filter(v => 
      emergencySources.some(source => v.source?.includes(source))
    );

    if (emergencyValues.length > 0) {
      const latest = emergencyValues.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      
      return {
        resolvedValue: latest.value,
        strategy: this.strategyName,
        confidence: 0.98,
        metadata: {
          emergencySource: latest.source,
          emergencyPriority: true,
        },
      };
    }

    // Fallback to most recent if no emergency sources
    const latest = context.conflictingValues.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );

    return {
      resolvedValue: latest.value,
      strategy: this.strategyName,
      confidence: 0.6,
      metadata: {
        emergencyFallback: true,
      },
    };
  }

  canHandle(context: ConflictContext): boolean {
    // Only handle if emergency flag is set or emergency keywords present
    return context.metadata.isEmergency === true ||
           context.key.includes('emergency') ||
           context.conflictingValues.some(v => v.source?.includes('emergency'));
  }

  getConfidence(context: ConflictContext): number {
    const hasEmergencySource = context.conflictingValues.some(v => 
      v.source?.includes('emergency') || v.source?.includes('icu')
    );
    
    return hasEmergencySource ? 0.98 : 0.5;
  }
}
