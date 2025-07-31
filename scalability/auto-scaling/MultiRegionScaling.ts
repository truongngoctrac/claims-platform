/**
 * Multi-Region Scaling System
 * Healthcare Claims Processing System
 */

export interface RegionConfig {
  id: string;
  name: string;
  awsRegion: string;
  dataCenter: string;
  timezone: string;
  capacity: {
    maxInstances: number;
    availableZones: string[];
    networkLatency: number;
    bandwidth: number;
  };
  compliance: {
    dataResidency: boolean;
    certifications: string[];
    restrictions: string[];
  };
  costs: {
    computeMultiplier: number;
    storageMultiplier: number;
    networkMultiplier: number;
  };
  healthcareRegulations: {
    hipaaCompliant: boolean;
    localHealthLaws: string[];
    dataTransferRestrictions: string[];
  };
}

export interface GlobalLoadDistribution {
  timestamp: Date;
  regions: {
    [regionId: string]: {
      currentLoad: number;
      capacity: number;
      utilization: number;
      latency: number;
      healthScore: number;
    };
  };
  totalLoad: number;
  optimalDistribution: { [regionId: string]: number };
  rebalanceRecommended: boolean;
}

export interface RegionFailover {
  triggerRegion: string;
  targetRegions: string[];
  failoverType: 'automatic' | 'manual' | 'gradual';
  dataReplication: 'sync' | 'async' | 'eventual';
  estimatedRTO: number; // Recovery Time Objective
  estimatedRPO: number; // Recovery Point Objective
  complianceImpact: string[];
  cost: number;
}

export interface CrossRegionScalingPolicy {
  id: string;
  name: string;
  priority: number;
  triggers: {
    loadThreshold: number;
    latencyThreshold: number;
    errorRateThreshold: number;
    regionalFailure: boolean;
  };
  actions: {
    redistributeLoad: boolean;
    scaleTargetRegion: boolean;
    initiateFailover: boolean;
    adjustGlobalCapacity: boolean;
  };
  constraints: {
    dataResidency: boolean;
    maxCrossRegionLatency: number;
    complianceRequirements: string[];
  };
  healthcareSpecific: {
    emergencyOverride: boolean;
    patientDataProtection: boolean;
    regulatoryCompliance: string[];
  };
}

export interface HealthcareDataFlow {
  sourceRegion: string;
  targetRegion: string;
  dataType: 'claims' | 'patient_data' | 'medical_records' | 'analytics';
  encryptionLevel: 'standard' | 'enhanced' | 'maximum';
  complianceLevel: 'basic' | 'hipaa' | 'gdpr' | 'local';
  transferMethod: 'direct' | 'vpn' | 'private_link';
  estimatedLatency: number;
  estimatedCost: number;
}

export interface RegionHealthMetrics {
  regionId: string;
  timestamp: Date;
  availability: number;
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  };
  capacity: {
    cpuUtilization: number;
    memoryUtilization: number;
    storageUtilization: number;
    networkUtilization: number;
  };
  compliance: {
    dataResidencyViolations: number;
    securityIncidents: number;
    auditFindings: number;
  };
  healthScore: number;
}

export class MultiRegionScaling {
  private regions: Map<string, RegionConfig> = new Map();
  private scalingPolicies: Map<string, CrossRegionScalingPolicy> = new Map();
  private healthMetrics: Map<string, RegionHealthMetrics[]> = new Map();
  private loadDistribution: GlobalLoadDistribution | null = null;
  private dataFlows: Map<string, HealthcareDataFlow> = new Map();

  constructor() {
    this.initializeHealthcareRegions();
    this.initializeCrossRegionPolicies();
    this.initializeHealthcareDataFlows();
  }

  /**
   * Initialize healthcare-compliant regions
   */
  private initializeHealthcareRegions(): void {
    // US East (Primary) - HIPAA compliant
    this.regions.set('us-east-1', {
      id: 'us-east-1',
      name: 'US East (Virginia)',
      awsRegion: 'us-east-1',
      dataCenter: 'primary',
      timezone: 'America/New_York',
      capacity: {
        maxInstances: 100,
        availableZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
        networkLatency: 15,
        bandwidth: 10000
      },
      compliance: {
        dataResidency: true,
        certifications: ['HIPAA', 'SOC2', 'PCI-DSS'],
        restrictions: []
      },
      costs: {
        computeMultiplier: 1.0,
        storageMultiplier: 1.0,
        networkMultiplier: 1.0
      },
      healthcareRegulations: {
        hipaaCompliant: true,
        localHealthLaws: ['HITECH', 'ACA'],
        dataTransferRestrictions: []
      }
    });

    // US West (Secondary) - HIPAA compliant
    this.regions.set('us-west-2', {
      id: 'us-west-2',
      name: 'US West (Oregon)',
      awsRegion: 'us-west-2',
      dataCenter: 'secondary',
      timezone: 'America/Los_Angeles',
      capacity: {
        maxInstances: 80,
        availableZones: ['us-west-2a', 'us-west-2b', 'us-west-2c'],
        networkLatency: 20,
        bandwidth: 8000
      },
      compliance: {
        dataResidency: true,
        certifications: ['HIPAA', 'SOC2'],
        restrictions: []
      },
      costs: {
        computeMultiplier: 1.1,
        storageMultiplier: 1.05,
        networkMultiplier: 1.2
      },
      healthcareRegulations: {
        hipaaCompliant: true,
        localHealthLaws: ['CCPA', 'HITECH'],
        dataTransferRestrictions: []
      }
    });

    // EU West (GDPR compliant)
    this.regions.set('eu-west-1', {
      id: 'eu-west-1',
      name: 'EU West (Ireland)',
      awsRegion: 'eu-west-1',
      dataCenter: 'tertiary',
      timezone: 'Europe/Dublin',
      capacity: {
        maxInstances: 60,
        availableZones: ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'],
        networkLatency: 100,
        bandwidth: 5000
      },
      compliance: {
        dataResidency: true,
        certifications: ['GDPR', 'ISO27001'],
        restrictions: ['eu_data_residency']
      },
      costs: {
        computeMultiplier: 1.2,
        storageMultiplier: 1.15,
        networkMultiplier: 1.5
      },
      healthcareRegulations: {
        hipaaCompliant: false,
        localHealthLaws: ['GDPR', 'Medical Device Regulation'],
        dataTransferRestrictions: ['no_us_transfer']
      }
    });

    // Canada Central (Health Canada compliant)
    this.regions.set('ca-central-1', {
      id: 'ca-central-1',
      name: 'Canada Central',
      awsRegion: 'ca-central-1',
      dataCenter: 'backup',
      timezone: 'America/Toronto',
      capacity: {
        maxInstances: 40,
        availableZones: ['ca-central-1a', 'ca-central-1b'],
        networkLatency: 25,
        bandwidth: 4000
      },
      compliance: {
        dataResidency: true,
        certifications: ['PIPEDA', 'CSA'],
        restrictions: ['canada_data_residency']
      },
      costs: {
        computeMultiplier: 1.15,
        storageMultiplier: 1.1,
        networkMultiplier: 1.3
      },
      healthcareRegulations: {
        hipaaCompliant: false,
        localHealthLaws: ['PIPEDA', 'Canada Health Act'],
        dataTransferRestrictions: ['limited_us_transfer']
      }
    });
  }

  /**
   * Initialize cross-region scaling policies
   */
  private initializeCrossRegionPolicies(): void {
    // Emergency failover policy
    this.scalingPolicies.set('emergency-failover', {
      id: 'emergency-failover',
      name: 'Emergency Healthcare Failover',
      priority: 1,
      triggers: {
        loadThreshold: 90,
        latencyThreshold: 5000,
        errorRateThreshold: 10,
        regionalFailure: true
      },
      actions: {
        redistributeLoad: true,
        scaleTargetRegion: true,
        initiateFailover: true,
        adjustGlobalCapacity: true
      },
      constraints: {
        dataResidency: true,
        maxCrossRegionLatency: 150,
        complianceRequirements: ['HIPAA', 'data_encryption']
      },
      healthcareSpecific: {
        emergencyOverride: true,
        patientDataProtection: true,
        regulatoryCompliance: ['HIPAA', 'HITECH']
      }
    });

    // Load balancing policy
    this.scalingPolicies.set('load-balancing', {
      id: 'load-balancing',
      name: 'Global Load Balancing',
      priority: 2,
      triggers: {
        loadThreshold: 70,
        latencyThreshold: 2000,
        errorRateThreshold: 5,
        regionalFailure: false
      },
      actions: {
        redistributeLoad: true,
        scaleTargetRegion: true,
        initiateFailover: false,
        adjustGlobalCapacity: false
      },
      constraints: {
        dataResidency: true,
        maxCrossRegionLatency: 100,
        complianceRequirements: ['data_encryption']
      },
      healthcareSpecific: {
        emergencyOverride: false,
        patientDataProtection: true,
        regulatoryCompliance: ['basic_compliance']
      }
    });

    // Business hours optimization
    this.scalingPolicies.set('business-hours', {
      id: 'business-hours',
      name: 'Business Hours Optimization',
      priority: 3,
      triggers: {
        loadThreshold: 60,
        latencyThreshold: 1500,
        errorRateThreshold: 3,
        regionalFailure: false
      },
      actions: {
        redistributeLoad: true,
        scaleTargetRegion: true,
        initiateFailover: false,
        adjustGlobalCapacity: true
      },
      constraints: {
        dataResidency: false,
        maxCrossRegionLatency: 200,
        complianceRequirements: []
      },
      healthcareSpecific: {
        emergencyOverride: false,
        patientDataProtection: true,
        regulatoryCompliance: []
      }
    });
  }

  /**
   * Initialize healthcare data flows
   */
  private initializeHealthcareDataFlows(): void {
    // US East to US West - Claims data
    this.dataFlows.set('us-east-to-west-claims', {
      sourceRegion: 'us-east-1',
      targetRegion: 'us-west-2',
      dataType: 'claims',
      encryptionLevel: 'enhanced',
      complianceLevel: 'hipaa',
      transferMethod: 'private_link',
      estimatedLatency: 50,
      estimatedCost: 0.02
    });

    // US to EU - Analytics data (anonymized)
    this.dataFlows.set('us-to-eu-analytics', {
      sourceRegion: 'us-east-1',
      targetRegion: 'eu-west-1',
      dataType: 'analytics',
      encryptionLevel: 'standard',
      complianceLevel: 'gdpr',
      transferMethod: 'vpn',
      estimatedLatency: 120,
      estimatedCost: 0.05
    });

    // US to Canada - Medical records backup
    this.dataFlows.set('us-to-canada-backup', {
      sourceRegion: 'us-east-1',
      targetRegion: 'ca-central-1',
      dataType: 'medical_records',
      encryptionLevel: 'maximum',
      complianceLevel: 'hipaa',
      transferMethod: 'private_link',
      estimatedLatency: 35,
      estimatedCost: 0.03
    });
  }

  /**
   * Analyze global load distribution
   */
  async analyzeGlobalLoadDistribution(): Promise<GlobalLoadDistribution> {
    console.log('🌍 Analyzing global load distribution across healthcare regions');

    const timestamp = new Date();
    const regions: GlobalLoadDistribution['regions'] = {};
    let totalLoad = 0;

    // Collect current metrics from all regions
    for (const [regionId, regionConfig] of this.regions) {
      const metrics = await this.getRegionMetrics(regionId);
      const currentLoad = this.calculateRegionLoad(metrics);
      
      regions[regionId] = {
        currentLoad,
        capacity: regionConfig.capacity.maxInstances,
        utilization: currentLoad / regionConfig.capacity.maxInstances,
        latency: regionConfig.capacity.networkLatency,
        healthScore: metrics.healthScore
      };
      
      totalLoad += currentLoad;
    }

    // Calculate optimal distribution
    const optimalDistribution = this.calculateOptimalDistribution(regions, totalLoad);
    
    // Determine if rebalancing is needed
    const rebalanceRecommended = this.shouldRebalance(regions, optimalDistribution);

    this.loadDistribution = {
      timestamp,
      regions,
      totalLoad,
      optimalDistribution,
      rebalanceRecommended
    };

    return this.loadDistribution;
  }

  /**
   * Execute multi-region scaling decision
   */
  async executeMultiRegionScaling(
    sourceRegion: string,
    targetLoad: number,
    urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<{
    success: boolean;
    actions: Array<{
      region: string;
      action: string;
      newCapacity: number;
      estimatedCost: number;
      complianceCheck: boolean;
    }>;
    failover?: RegionFailover;
    dataTransfers: HealthcareDataFlow[];
  }> {
    console.log(`🚀 Executing multi-region scaling from ${sourceRegion} with target load ${targetLoad}`);

    const actions: Array<{
      region: string;
      action: string;
      newCapacity: number;
      estimatedCost: number;
      complianceCheck: boolean;
    }> = [];

    const dataTransfers: HealthcareDataFlow[] = [];
    let failover: RegionFailover | undefined;

    // Check if source region can handle the load
    const sourceRegionConfig = this.regions.get(sourceRegion);
    if (!sourceRegionConfig) {
      throw new Error(`Region not found: ${sourceRegion}`);
    }

    const sourceMetrics = await this.getRegionMetrics(sourceRegion);
    const sourceCapacity = sourceRegionConfig.capacity.maxInstances;
    
    // If source region is at capacity or failing, initiate scaling/failover
    if (targetLoad > sourceCapacity * 0.8 || sourceMetrics.healthScore < 0.5) {
      console.log(`⚠️ Source region ${sourceRegion} capacity exceeded or unhealthy`);
      
      // Find suitable target regions
      const suitableRegions = await this.findSuitableTargetRegions(sourceRegion, urgency);
      
      if (suitableRegions.length === 0) {
        return {
          success: false,
          actions: [{
            region: sourceRegion,
            action: 'scale-denied',
            newCapacity: 0,
            estimatedCost: 0,
            complianceCheck: false
          }],
          dataTransfers: []
        };
      }

      // Execute scaling across regions
      for (const targetRegion of suitableRegions) {
        const targetRegionConfig = this.regions.get(targetRegion)!;
        const targetMetrics = await this.getRegionMetrics(targetRegion);
        
        // Calculate additional capacity needed
        const additionalCapacity = Math.min(
          Math.ceil(targetLoad * 0.3), // Distribute 30% of load
          targetRegionConfig.capacity.maxInstances - targetMetrics.capacity.cpuUtilization
        );

        // Check compliance
        const complianceCheck = await this.checkCrossRegionCompliance(sourceRegion, targetRegion);
        
        if (complianceCheck) {
          // Scale target region
          actions.push({
            region: targetRegion,
            action: 'scale-up',
            newCapacity: additionalCapacity,
            estimatedCost: this.calculateScalingCost(targetRegion, additionalCapacity),
            complianceCheck: true
          });

          // Set up data transfer
          const dataFlow = await this.setupDataTransfer(sourceRegion, targetRegion, 'claims');
          if (dataFlow) {
            dataTransfers.push(dataFlow);
          }
        }
      }

      // If critical urgency, prepare failover
      if (urgency === 'critical' && sourceMetrics.healthScore < 0.3) {
        failover = await this.prepareRegionFailover(sourceRegion, suitableRegions);
      }
    } else {
      // Scale within source region
      const additionalCapacity = Math.ceil(targetLoad - sourceMetrics.capacity.cpuUtilization);
      
      actions.push({
        region: sourceRegion,
        action: 'scale-up',
        newCapacity: additionalCapacity,
        estimatedCost: this.calculateScalingCost(sourceRegion, additionalCapacity),
        complianceCheck: true
      });
    }

    const success = actions.length > 0 && actions.every(action => action.complianceCheck);

    console.log(`✅ Multi-region scaling ${success ? 'successful' : 'failed'}. Actions: ${actions.length}`);

    return {
      success,
      actions,
      failover,
      dataTransfers
    };
  }

  /**
   * Find suitable target regions for scaling
   */
  private async findSuitableTargetRegions(
    sourceRegion: string,
    urgency: string
  ): Promise<string[]> {
    const sourceConfig = this.regions.get(sourceRegion)!;
    const suitableRegions: string[] = [];

    for (const [regionId, regionConfig] of this.regions) {
      if (regionId === sourceRegion) continue;

      const metrics = await this.getRegionMetrics(regionId);
      
      // Check capacity availability
      if (metrics.capacity.cpuUtilization > 70) continue;
      
      // Check compliance requirements
      if (sourceConfig.healthcareRegulations.hipaaCompliant && 
          !regionConfig.healthcareRegulations.hipaaCompliant) {
        if (urgency !== 'critical') continue; // Allow in critical situations
      }
      
      // Check data transfer restrictions
      const hasRestrictions = this.checkDataTransferRestrictions(sourceRegion, regionId);
      if (hasRestrictions && urgency !== 'critical') continue;
      
      // Check latency requirements
      const estimatedLatency = this.calculateCrossRegionLatency(sourceRegion, regionId);
      if (estimatedLatency > 200 && urgency === 'low') continue;
      
      suitableRegions.push(regionId);
    }

    // Sort by preference (health score, latency, cost)
    suitableRegions.sort((a, b) => {
      const scoreA = this.calculateRegionPreferenceScore(sourceRegion, a);
      const scoreB = this.calculateRegionPreferenceScore(sourceRegion, b);
      return scoreB - scoreA;
    });

    return suitableRegions.slice(0, 3); // Return top 3 regions
  }

  /**
   * Prepare region failover
   */
  private async prepareRegionFailover(
    sourceRegion: string,
    targetRegions: string[]
  ): Promise<RegionFailover> {
    const primaryTarget = targetRegions[0];
    const sourceConfig = this.regions.get(sourceRegion)!;
    const targetConfig = this.regions.get(primaryTarget)!;

    // Determine failover type based on urgency and data requirements
    const failoverType: 'automatic' | 'manual' | 'gradual' = 
      sourceConfig.healthcareRegulations.hipaaCompliant && 
      targetConfig.healthcareRegulations.hipaaCompliant
        ? 'automatic'
        : 'manual';

    // Determine data replication strategy
    const dataReplication: 'sync' | 'async' | 'eventual' = 
      failoverType === 'automatic' ? 'sync' : 'async';

    // Calculate RTO and RPO based on healthcare requirements
    const estimatedRTO = failoverType === 'automatic' ? 300 : 900; // 5-15 minutes
    const estimatedRPO = dataReplication === 'sync' ? 0 : 60; // 0-1 minute

    // Assess compliance impact
    const complianceImpact: string[] = [];
    if (!targetConfig.healthcareRegulations.hipaaCompliant) {
      complianceImpact.push('HIPAA compliance temporarily suspended');
    }
    if (targetConfig.compliance.restrictions.length > 0) {
      complianceImpact.push(`Data residency restrictions: ${targetConfig.compliance.restrictions.join(', ')}`);
    }

    // Calculate failover cost
    const cost = this.calculateFailoverCost(sourceRegion, targetRegions);

    return {
      triggerRegion: sourceRegion,
      targetRegions,
      failoverType,
      dataReplication,
      estimatedRTO,
      estimatedRPO,
      complianceImpact,
      cost
    };
  }

  /**
   * Setup data transfer between regions
   */
  private async setupDataTransfer(
    sourceRegion: string,
    targetRegion: string,
    dataType: 'claims' | 'patient_data' | 'medical_records' | 'analytics'
  ): Promise<HealthcareDataFlow | null> {
    const flowKey = `${sourceRegion}-to-${targetRegion}-${dataType}`;
    const existingFlow = this.dataFlows.get(flowKey);
    
    if (existingFlow) {
      return existingFlow;
    }

    const sourceConfig = this.regions.get(sourceRegion)!;
    const targetConfig = this.regions.get(targetRegion)!;

    // Check if data transfer is allowed
    const transferAllowed = await this.checkCrossRegionCompliance(sourceRegion, targetRegion);
    if (!transferAllowed) {
      console.log(`❌ Data transfer not allowed: ${sourceRegion} → ${targetRegion}`);
      return null;
    }

    // Determine encryption level based on data type and compliance
    let encryptionLevel: 'standard' | 'enhanced' | 'maximum' = 'standard';
    if (dataType === 'patient_data' || dataType === 'medical_records') {
      encryptionLevel = 'maximum';
    } else if (dataType === 'claims') {
      encryptionLevel = 'enhanced';
    }

    // Determine compliance level
    let complianceLevel: 'basic' | 'hipaa' | 'gdpr' | 'local' = 'basic';
    if (sourceConfig.healthcareRegulations.hipaaCompliant && 
        targetConfig.healthcareRegulations.hipaaCompliant) {
      complianceLevel = 'hipaa';
    } else if (targetConfig.compliance.certifications.includes('GDPR')) {
      complianceLevel = 'gdpr';
    }

    // Determine transfer method
    const transferMethod: 'direct' | 'vpn' | 'private_link' = 
      encryptionLevel === 'maximum' ? 'private_link' : 'vpn';

    // Calculate latency and cost
    const estimatedLatency = this.calculateCrossRegionLatency(sourceRegion, targetRegion);
    const estimatedCost = this.calculateDataTransferCost(sourceRegion, targetRegion, dataType);

    const dataFlow: HealthcareDataFlow = {
      sourceRegion,
      targetRegion,
      dataType,
      encryptionLevel,
      complianceLevel,
      transferMethod,
      estimatedLatency,
      estimatedCost
    };

    this.dataFlows.set(flowKey, dataFlow);
    console.log(`✅ Setup data transfer: ${sourceRegion} → ${targetRegion} (${dataType})`);

    return dataFlow;
  }

  // Helper methods

  private async getRegionMetrics(regionId: string): Promise<RegionHealthMetrics> {
    // Simulate getting real metrics
    return {
      regionId,
      timestamp: new Date(),
      availability: 99.5 + Math.random() * 0.5,
      performance: {
        avgResponseTime: 100 + Math.random() * 200,
        throughput: 1000 + Math.random() * 500,
        errorRate: Math.random() * 2
      },
      capacity: {
        cpuUtilization: Math.random() * 80,
        memoryUtilization: Math.random() * 75,
        storageUtilization: Math.random() * 60,
        networkUtilization: Math.random() * 70
      },
      compliance: {
        dataResidencyViolations: 0,
        securityIncidents: 0,
        auditFindings: Math.floor(Math.random() * 3)
      },
      healthScore: 0.8 + Math.random() * 0.2
    };
  }

  private calculateRegionLoad(metrics: RegionHealthMetrics): number {
    // Calculate load based on multiple factors
    const cpuWeight = 0.4;
    const memoryWeight = 0.3;
    const networkWeight = 0.2;
    const performanceWeight = 0.1;

    const cpuLoad = metrics.capacity.cpuUtilization;
    const memoryLoad = metrics.capacity.memoryUtilization;
    const networkLoad = metrics.capacity.networkUtilization;
    const performanceLoad = (metrics.performance.avgResponseTime / 1000) * 100; // Normalize to percentage

    return (cpuLoad * cpuWeight) + 
           (memoryLoad * memoryWeight) + 
           (networkLoad * networkWeight) + 
           (performanceLoad * performanceWeight);
  }

  private calculateOptimalDistribution(
    regions: GlobalLoadDistribution['regions'],
    totalLoad: number
  ): { [regionId: string]: number } {
    const optimal: { [regionId: string]: number } = {};
    const regionIds = Object.keys(regions);
    
    // Calculate total capacity
    const totalCapacity = regionIds.reduce((sum, regionId) => 
      sum + regions[regionId].capacity, 0);
    
    // Distribute load based on capacity and health
    regionIds.forEach(regionId => {
      const region = regions[regionId];
      const capacityRatio = region.capacity / totalCapacity;
      const healthFactor = region.healthScore;
      const optimalLoad = totalLoad * capacityRatio * healthFactor;
      
      optimal[regionId] = Math.min(optimalLoad, region.capacity * 0.8); // Max 80% utilization
    });
    
    return optimal;
  }

  private shouldRebalance(
    current: GlobalLoadDistribution['regions'],
    optimal: { [regionId: string]: number }
  ): boolean {
    const threshold = 0.2; // 20% difference threshold
    
    return Object.keys(current).some(regionId => {
      const currentLoad = current[regionId].currentLoad;
      const optimalLoad = optimal[regionId];
      const difference = Math.abs(currentLoad - optimalLoad) / optimalLoad;
      return difference > threshold;
    });
  }

  private async checkCrossRegionCompliance(sourceRegion: string, targetRegion: string): Promise<boolean> {
    const sourceConfig = this.regions.get(sourceRegion)!;
    const targetConfig = this.regions.get(targetRegion)!;
    
    // Check data residency requirements
    if (sourceConfig.compliance.dataResidency && targetConfig.compliance.dataResidency) {
      // Both regions have data residency requirements
      if (sourceConfig.awsRegion.split('-')[0] !== targetConfig.awsRegion.split('-')[0]) {
        // Different geographical regions
        return false;
      }
    }
    
    // Check healthcare-specific restrictions
    const sourceRestrictions = sourceConfig.healthcareRegulations.dataTransferRestrictions;
    if (sourceRestrictions.includes('no_us_transfer') && targetConfig.awsRegion.startsWith('us-')) {
      return false;
    }
    
    if (sourceRestrictions.includes('limited_us_transfer') && targetConfig.awsRegion.startsWith('us-')) {
      // Allow only for emergency situations (simplified check)
      return true;
    }
    
    return true;
  }

  private checkDataTransferRestrictions(sourceRegion: string, targetRegion: string): boolean {
    const sourceConfig = this.regions.get(sourceRegion)!;
    const restrictions = sourceConfig.healthcareRegulations.dataTransferRestrictions;
    
    if (restrictions.length === 0) return false;
    
    const targetConfig = this.regions.get(targetRegion)!;
    
    return restrictions.some(restriction => {
      if (restriction === 'no_us_transfer' && targetConfig.awsRegion.startsWith('us-')) return true;
      if (restriction === 'limited_us_transfer' && targetConfig.awsRegion.startsWith('us-')) return true;
      return false;
    });
  }

  private calculateCrossRegionLatency(sourceRegion: string, targetRegion: string): number {
    const sourceConfig = this.regions.get(sourceRegion)!;
    const targetConfig = this.regions.get(targetRegion)!;
    
    // Base latency between regions
    const baseLatency = sourceConfig.capacity.networkLatency + targetConfig.capacity.networkLatency;
    
    // Add inter-region latency based on geographical distance
    const sourceContinent = sourceConfig.awsRegion.split('-')[0];
    const targetContinent = targetConfig.awsRegion.split('-')[0];
    
    if (sourceContinent !== targetContinent) {
      return baseLatency + 50; // Additional latency for cross-continent
    }
    
    return baseLatency + 10; // Additional latency for cross-region
  }

  private calculateRegionPreferenceScore(sourceRegion: string, targetRegion: string): number {
    const sourceConfig = this.regions.get(sourceRegion)!;
    const targetConfig = this.regions.get(targetRegion)!;
    
    let score = 0;
    
    // Health score (40% weight)
    score += 0.4;
    
    // Latency score (30% weight) - lower latency is better
    const latency = this.calculateCrossRegionLatency(sourceRegion, targetRegion);
    const latencyScore = Math.max(0, 1 - (latency / 200)); // Normalize to 0-1
    score += latencyScore * 0.3;
    
    // Cost score (20% weight) - lower cost is better
    const costRatio = targetConfig.costs.computeMultiplier / sourceConfig.costs.computeMultiplier;
    const costScore = Math.max(0, 2 - costRatio); // Normalize to 0-1
    score += costScore * 0.2;
    
    // Compliance score (10% weight)
    const complianceScore = sourceConfig.healthcareRegulations.hipaaCompliant === 
                           targetConfig.healthcareRegulations.hipaaCompliant ? 1 : 0.5;
    score += complianceScore * 0.1;
    
    return score;
  }

  private calculateScalingCost(regionId: string, additionalCapacity: number): number {
    const regionConfig = this.regions.get(regionId)!;
    const baseCost = 0.1; // Base cost per instance per hour
    return baseCost * additionalCapacity * regionConfig.costs.computeMultiplier;
  }

  private calculateFailoverCost(sourceRegion: string, targetRegions: string[]): number {
    const sourceConfig = this.regions.get(sourceRegion)!;
    let totalCost = 0;
    
    // Data transfer costs
    targetRegions.forEach(targetRegion => {
      const targetConfig = this.regions.get(targetRegion)!;
      const transferCost = 0.05 * targetConfig.costs.networkMultiplier;
      totalCost += transferCost;
    });
    
    // Setup costs
    totalCost += 50; // Base failover setup cost
    
    return totalCost;
  }

  private calculateDataTransferCost(sourceRegion: string, targetRegion: string, dataType: string): number {
    const sourceConfig = this.regions.get(sourceRegion)!;
    const targetConfig = this.regions.get(targetRegion)!;
    
    let baseCost = 0.02; // Base cost per GB
    
    // Data type multiplier
    const dataTypeMultipliers = {
      claims: 1.0,
      patient_data: 1.5,
      medical_records: 2.0,
      analytics: 0.5
    };
    
    baseCost *= dataTypeMultipliers[dataType as keyof typeof dataTypeMultipliers] || 1.0;
    
    // Region cost multiplier
    baseCost *= (sourceConfig.costs.networkMultiplier + targetConfig.costs.networkMultiplier) / 2;
    
    return baseCost;
  }

  /**
   * Get current global load distribution
   */
  getCurrentLoadDistribution(): GlobalLoadDistribution | null {
    return this.loadDistribution;
  }

  /**
   * Get region configuration
   */
  getRegionConfig(regionId: string): RegionConfig | undefined {
    return this.regions.get(regionId);
  }

  /**
   * Get all regions
   */
  getAllRegions(): RegionConfig[] {
    return Array.from(this.regions.values());
  }

  /**
   * Get cross-region scaling policies
   */
  getScalingPolicies(): CrossRegionScalingPolicy[] {
    return Array.from(this.scalingPolicies.values());
  }

  /**
   * Get data flows
   */
  getDataFlows(): HealthcareDataFlow[] {
    return Array.from(this.dataFlows.values());
  }
}
