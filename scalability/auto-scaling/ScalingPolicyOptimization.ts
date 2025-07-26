/**
 * Scaling Policy Optimization System
 * Healthcare Claims Processing System
 */

export interface ScalingPolicy {
  id: string;
  name: string;
  serviceName: string;
  type: 'reactive' | 'predictive' | 'scheduled' | 'hybrid';
  enabled: boolean;
  rules: ScalingRule[];
  metrics: string[];
  targets: ScalingTargets;
  behavior: ScalingBehavior;
  optimization: OptimizationConfig;
  performance: PolicyPerformance;
  lastOptimized: Date;
}

export interface ScalingRule {
  id: string;
  condition: string;
  action: 'scale-up' | 'scale-down' | 'scale-to' | 'no-action';
  value: number;
  priority: number;
  enabled: boolean;
  cooldown: number;
  weight: number;
}

export interface ScalingTargets {
  minReplicas: number;
  maxReplicas: number;
  targetCPU?: number;
  targetMemory?: number;
  targetRequestRate?: number;
  targetResponseTime?: number;
  customTargets?: { [key: string]: number };
}

export interface ScalingBehavior {
  scaleUp: {
    stabilizationWindow: number;
    selectPolicy: 'max' | 'min' | 'disabled';
    policies: BehaviorPolicy[];
  };
  scaleDown: {
    stabilizationWindow: number;
    selectPolicy: 'max' | 'min' | 'disabled';
    policies: BehaviorPolicy[];
  };
}

export interface BehaviorPolicy {
  type: 'pods' | 'percent';
  value: number;
  periodSeconds: number;
}

export interface OptimizationConfig {
  enabled: boolean;
  algorithm: 'genetic' | 'reinforcement' | 'bayesian' | 'gradient';
  objectives: OptimizationObjective[];
  constraints: OptimizationConstraint[];
  learningRate: number;
  explorationRate: number;
  optimizationInterval: number;
}

export interface OptimizationObjective {
  name: string;
  type: 'minimize' | 'maximize';
  weight: number;
  metric: string;
  target?: number;
}

export interface OptimizationConstraint {
  name: string;
  type: 'hard' | 'soft';
  metric: string;
  operator: 'lt' | 'gt' | 'eq' | 'lte' | 'gte';
  value: number;
  penalty: number;
}

export interface PolicyPerformance {
  scalingEvents: number;
  successfulScalings: number;
  failedScalings: number;
  averageResponseTime: number;
  resourceUtilization: number;
  costEfficiency: number;
  slaCompliance: number;
  lastEvaluated: Date;
}

export interface OptimizationResult {
  policyId: string;
  iteration: number;
  timestamp: Date;
  originalPolicy: ScalingPolicy;
  optimizedPolicy: ScalingPolicy;
  improvement: number;
  confidence: number;
  metrics: { [key: string]: number };
  applied: boolean;
}

export interface HealthcareScalingScenario {
  name: string;
  description: string;
  triggers: string[];
  expectedLoad: number;
  duration: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  requiredSLA: number;
}

export class ScalingPolicyOptimization {
  private policies: Map<string, ScalingPolicy> = new Map();
  private optimizationHistory: Map<string, OptimizationResult[]> = new Map();
  private scenarios: Map<string, HealthcareScalingScenario> = new Map();
  private performanceData: Map<string, any[]> = new Map();

  constructor() {
    this.initializeHealthcareScenarios();
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize healthcare-specific scaling scenarios
   */
  private initializeHealthcareScenarios(): void {
    // Regular business hours scenario
    this.scenarios.set('business_hours', {
      name: 'Business Hours Processing',
      description: 'Standard claim processing during business hours',
      triggers: ['time_range_8_18', 'weekday'],
      expectedLoad: 1.0,
      duration: 36000000, // 10 hours
      urgency: 'medium',
      requiredSLA: 95
    });

    // Emergency surge scenario
    this.scenarios.set('emergency_surge', {
      name: 'Emergency Health Surge',
      description: 'Rapid scaling for health emergency situations',
      triggers: ['emergency_alert', 'high_claim_rate'],
      expectedLoad: 5.0,
      duration: 7200000, // 2 hours
      urgency: 'critical',
      requiredSLA: 99
    });

    // End of month billing scenario
    this.scenarios.set('month_end_billing', {
      name: 'Month End Billing Rush',
      description: 'Increased activity during month-end billing cycles',
      triggers: ['month_end', 'billing_cycle'],
      expectedLoad: 2.5,
      duration: 172800000, // 2 days
      urgency: 'high',
      requiredSLA: 97
    });

    // Maintenance window scenario
    this.scenarios.set('maintenance_mode', {
      name: 'Maintenance Window',
      description: 'Reduced capacity during maintenance',
      triggers: ['maintenance_schedule'],
      expectedLoad: 0.3,
      duration: 14400000, // 4 hours
      urgency: 'low',
      requiredSLA: 90
    });
  }

  /**
   * Initialize default scaling policies
   */
  private initializeDefaultPolicies(): void {
    // Claims processing policy
    this.addPolicy({
      id: 'claims-processing-standard',
      name: 'Claims Processing Standard Policy',
      serviceName: 'claims-processor',
      type: 'hybrid',
      enabled: true,
      rules: [
        {
          id: 'cpu-scale-up',
          condition: 'cpu > 70',
          action: 'scale-up',
          value: 1,
          priority: 1,
          enabled: true,
          cooldown: 300000,
          weight: 1.0
        },
        {
          id: 'cpu-scale-down',
          condition: 'cpu < 30',
          action: 'scale-down',
          value: 1,
          priority: 2,
          enabled: true,
          cooldown: 600000,
          weight: 0.8
        },
        {
          id: 'queue-scale-up',
          condition: 'queue_length > 100',
          action: 'scale-up',
          value: 2,
          priority: 1,
          enabled: true,
          cooldown: 180000,
          weight: 1.2
        }
      ],
      metrics: ['cpu', 'memory', 'queue_length', 'response_time'],
      targets: {
        minReplicas: 2,
        maxReplicas: 10,
        targetCPU: 60,
        targetMemory: 70,
        targetResponseTime: 2000,
        customTargets: {
          queue_length: 50,
          claims_per_minute: 100
        }
      },
      behavior: {
        scaleUp: {
          stabilizationWindow: 60,
          selectPolicy: 'max',
          policies: [
            { type: 'pods', value: 2, periodSeconds: 60 },
            { type: 'percent', value: 50, periodSeconds: 60 }
          ]
        },
        scaleDown: {
          stabilizationWindow: 300,
          selectPolicy: 'min',
          policies: [
            { type: 'pods', value: 1, periodSeconds: 60 },
            { type: 'percent', value: 10, periodSeconds: 60 }
          ]
        }
      },
      optimization: {
        enabled: true,
        algorithm: 'reinforcement',
        objectives: [
          { name: 'response_time', type: 'minimize', weight: 0.4, metric: 'avg_response_time', target: 1500 },
          { name: 'cost', type: 'minimize', weight: 0.3, metric: 'resource_cost' },
          { name: 'availability', type: 'maximize', weight: 0.3, metric: 'uptime_percentage', target: 99.9 }
        ],
        constraints: [
          { name: 'max_cost', type: 'hard', metric: 'hourly_cost', operator: 'lt', value: 100, penalty: 1000 },
          { name: 'min_sla', type: 'hard', metric: 'sla_compliance', operator: 'gt', value: 95, penalty: 500 }
        ],
        learningRate: 0.1,
        explorationRate: 0.2,
        optimizationInterval: 3600000 // 1 hour
      },
      performance: {
        scalingEvents: 0,
        successfulScalings: 0,
        failedScalings: 0,
        averageResponseTime: 0,
        resourceUtilization: 0,
        costEfficiency: 0,
        slaCompliance: 0,
        lastEvaluated: new Date()
      },
      lastOptimized: new Date()
    });
  }

  /**
   * Add new scaling policy
   */
  addPolicy(policy: ScalingPolicy): void {
    this.policies.set(policy.id, policy);
    console.log(`✅ Added scaling policy: ${policy.name}`);
  }

  /**
   * Optimize scaling policy using specified algorithm
   */
  async optimizePolicy(policyId: string): Promise<OptimizationResult | null> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      console.log(`❌ Policy not found: ${policyId}`);
      return null;
    }

    if (!policy.optimization.enabled) {
      console.log(`⚠️ Optimization disabled for policy: ${policyId}`);
      return null;
    }

    console.log(`🔧 Optimizing policy: ${policy.name} using ${policy.optimization.algorithm}`);

    let optimizedPolicy: ScalingPolicy;
    let improvement: number;

    switch (policy.optimization.algorithm) {
      case 'genetic':
        ({ optimizedPolicy, improvement } = await this.geneticOptimization(policy));
        break;
      case 'reinforcement':
        ({ optimizedPolicy, improvement } = await this.reinforcementOptimization(policy));
        break;
      case 'bayesian':
        ({ optimizedPolicy, improvement } = await this.bayesianOptimization(policy));
        break;
      case 'gradient':
        ({ optimizedPolicy, improvement } = await this.gradientOptimization(policy));
        break;
      default:
        console.log(`❌ Unknown optimization algorithm: ${policy.optimization.algorithm}`);
        return null;
    }

    const result: OptimizationResult = {
      policyId,
      iteration: this.getOptimizationIteration(policyId),
      timestamp: new Date(),
      originalPolicy: policy,
      optimizedPolicy,
      improvement,
      confidence: this.calculateConfidence(policy, optimizedPolicy),
      metrics: await this.evaluatePolicyPerformance(optimizedPolicy),
      applied: false
    };

    // Store optimization result
    this.storeOptimizationResult(policyId, result);

    // Apply optimization if improvement is significant
    if (improvement > 0.05 && result.confidence > 0.8) {
      this.applyOptimization(result);
    }

    console.log(`✅ Policy optimization completed. Improvement: ${(improvement * 100).toFixed(2)}%`);
    return result;
  }

  /**
   * Genetic algorithm optimization
   */
  private async geneticOptimization(policy: ScalingPolicy): Promise<{
    optimizedPolicy: ScalingPolicy;
    improvement: number;
  }> {
    const populationSize = 20;
    const generations = 10;
    const mutationRate = 0.1;
    const crossoverRate = 0.8;

    // Initialize population
    let population = this.generatePopulation(policy, populationSize);

    for (let generation = 0; generation < generations; generation++) {
      // Evaluate fitness
      const fitnessScores = await Promise.all(
        population.map(individual => this.evaluateFitness(individual))
      );

      // Selection, crossover, and mutation
      const newPopulation: ScalingPolicy[] = [];

      for (let i = 0; i < populationSize; i++) {
        const parent1 = this.tournamentSelection(population, fitnessScores);
        const parent2 = this.tournamentSelection(population, fitnessScores);

        let offspring = Math.random() < crossoverRate
          ? this.crossover(parent1, parent2)
          : parent1;

        if (Math.random() < mutationRate) {
          offspring = this.mutate(offspring);
        }

        newPopulation.push(offspring);
      }

      population = newPopulation;
    }

    // Select best individual
    const finalFitnessScores = await Promise.all(
      population.map(individual => this.evaluateFitness(individual))
    );

    const bestIndex = finalFitnessScores.indexOf(Math.max(...finalFitnessScores));
    const optimizedPolicy = population[bestIndex];

    const originalFitness = await this.evaluateFitness(policy);
    const optimizedFitness = finalFitnessScores[bestIndex];
    const improvement = (optimizedFitness - originalFitness) / originalFitness;

    return { optimizedPolicy, improvement };
  }

  /**
   * Reinforcement learning optimization
   */
  private async reinforcementOptimization(policy: ScalingPolicy): Promise<{
    optimizedPolicy: ScalingPolicy;
    improvement: number;
  }> {
    const episodes = 50;
    const learningRate = policy.optimization.learningRate;
    const explorationRate = policy.optimization.explorationRate;

    let currentPolicy = { ...policy };
    let bestPolicy = { ...policy };
    let bestReward = await this.evaluateFitness(policy);

    for (let episode = 0; episode < episodes; episode++) {
      // Epsilon-greedy action selection
      const action = Math.random() < explorationRate
        ? this.randomPolicyAction(currentPolicy)
        : this.greedyPolicyAction(currentPolicy);

      // Apply action to get new policy
      const newPolicy = this.applyAction(currentPolicy, action);

      // Evaluate reward
      const reward = await this.evaluateFitness(newPolicy);

      // Update policy using Q-learning inspired approach
      if (reward > bestReward) {
        bestPolicy = { ...newPolicy };
        bestReward = reward;
      }

      // Update current policy
      currentPolicy = this.updatePolicy(currentPolicy, newPolicy, reward, learningRate);
    }

    const originalFitness = await this.evaluateFitness(policy);
    const improvement = (bestReward - originalFitness) / originalFitness;

    return { optimizedPolicy: bestPolicy, improvement };
  }

  /**
   * Bayesian optimization
   */
  private async bayesianOptimization(policy: ScalingPolicy): Promise<{
    optimizedPolicy: ScalingPolicy;
    improvement: number;
  }> {
    const iterations = 20;
    const acquisitionFunction = 'expected_improvement';

    // Build surrogate model from historical data
    const observations: Array<{ policy: ScalingPolicy; fitness: number }> = [];

    // Initial observations
    for (let i = 0; i < 5; i++) {
      const candidate = this.generateRandomPolicyVariation(policy);
      const fitness = await this.evaluateFitness(candidate);
      observations.push({ policy: candidate, fitness });
    }

    let bestPolicy = observations.reduce((best, obs) => 
      obs.fitness > best.fitness ? obs : best
    ).policy;

    for (let iteration = 0; iteration < iterations; iteration++) {
      // Select next candidate using acquisition function
      const candidate = this.selectNextCandidate(observations, acquisitionFunction);
      const fitness = await this.evaluateFitness(candidate);

      observations.push({ policy: candidate, fitness });

      if (fitness > observations.reduce((max, obs) => Math.max(max, obs.fitness), -Infinity)) {
        bestPolicy = { ...candidate };
      }
    }

    const originalFitness = await this.evaluateFitness(policy);
    const bestFitness = await this.evaluateFitness(bestPolicy);
    const improvement = (bestFitness - originalFitness) / originalFitness;

    return { optimizedPolicy: bestPolicy, improvement };
  }

  /**
   * Gradient-based optimization
   */
  private async gradientOptimization(policy: ScalingPolicy): Promise<{
    optimizedPolicy: ScalingPolicy;
    improvement: number;
  }> {
    const iterations = 30;
    const learningRate = policy.optimization.learningRate;
    const epsilon = 0.01; // For numerical gradient

    let currentPolicy = { ...policy };
    let bestPolicy = { ...policy };
    let bestFitness = await this.evaluateFitness(policy);

    for (let iteration = 0; iteration < iterations; iteration++) {
      // Compute numerical gradients
      const gradients = await this.computeNumericalGradients(currentPolicy, epsilon);

      // Update policy parameters using gradients
      currentPolicy = this.updatePolicyWithGradients(currentPolicy, gradients, learningRate);

      // Evaluate new policy
      const fitness = await this.evaluateFitness(currentPolicy);

      if (fitness > bestFitness) {
        bestPolicy = { ...currentPolicy };
        bestFitness = fitness;
      }
    }

    const originalFitness = await this.evaluateFitness(policy);
    const improvement = (bestFitness - originalFitness) / originalFitness;

    return { optimizedPolicy: bestPolicy, improvement };
  }

  /**
   * Evaluate policy fitness based on objectives and constraints
   */
  private async evaluateFitness(policy: ScalingPolicy): Promise<number> {
    const metrics = await this.evaluatePolicyPerformance(policy);
    let fitness = 0;

    // Evaluate objectives
    for (const objective of policy.optimization.objectives) {
      const metricValue = metrics[objective.metric] || 0;
      let objectiveScore = 0;

      if (objective.type === 'minimize') {
        objectiveScore = objective.target ? 
          Math.max(0, (objective.target - metricValue) / objective.target) : 
          1 / (1 + metricValue);
      } else {
        objectiveScore = objective.target ? 
          Math.min(1, metricValue / objective.target) : 
          metricValue;
      }

      fitness += objectiveScore * objective.weight;
    }

    // Apply constraint penalties
    for (const constraint of policy.optimization.constraints) {
      const metricValue = metrics[constraint.metric] || 0;
      let violated = false;

      switch (constraint.operator) {
        case 'lt':
          violated = metricValue >= constraint.value;
          break;
        case 'gt':
          violated = metricValue <= constraint.value;
          break;
        case 'eq':
          violated = Math.abs(metricValue - constraint.value) > 0.01;
          break;
        case 'lte':
          violated = metricValue > constraint.value;
          break;
        case 'gte':
          violated = metricValue < constraint.value;
          break;
      }

      if (violated) {
        if (constraint.type === 'hard') {
          return -1000; // Large penalty for hard constraints
        } else {
          fitness -= constraint.penalty;
        }
      }
    }

    return fitness;
  }

  /**
   * Evaluate policy performance metrics
   */
  private async evaluatePolicyPerformance(policy: ScalingPolicy): Promise<{ [key: string]: number }> {
    // Simulate performance evaluation
    // In production, this would use actual metrics from monitoring systems
    
    const baselineMetrics = {
      avg_response_time: 2000,
      resource_cost: 50,
      uptime_percentage: 99.5,
      sla_compliance: 95,
      scaling_frequency: 10,
      resource_utilization: 60
    };

    // Apply policy impact simulation
    const targetCPU = policy.targets.targetCPU || 70;
    const targetMemory = policy.targets.targetMemory || 70;
    const minReplicas = policy.targets.minReplicas;
    const maxReplicas = policy.targets.maxReplicas;

    const responseFactor = Math.max(0.5, 100 / targetCPU);
    const costFactor = (minReplicas + maxReplicas) / 2 / 5; // Normalized by baseline
    const utilizationFactor = (targetCPU + targetMemory) / 140;

    return {
      avg_response_time: baselineMetrics.avg_response_time / responseFactor,
      resource_cost: baselineMetrics.resource_cost * costFactor,
      uptime_percentage: Math.min(99.99, baselineMetrics.uptime_percentage + utilizationFactor),
      sla_compliance: Math.min(100, baselineMetrics.sla_compliance + utilizationFactor * 2),
      scaling_frequency: baselineMetrics.scaling_frequency * (2 - utilizationFactor),
      resource_utilization: baselineMetrics.resource_utilization * utilizationFactor,
      hourly_cost: 25 * costFactor
    };
  }

  // Helper methods for optimization algorithms

  private generatePopulation(policy: ScalingPolicy, size: number): ScalingPolicy[] {
    const population: ScalingPolicy[] = [];
    
    for (let i = 0; i < size; i++) {
      population.push(this.generateRandomPolicyVariation(policy));
    }
    
    return population;
  }

  private generateRandomPolicyVariation(policy: ScalingPolicy): ScalingPolicy {
    const variation = JSON.parse(JSON.stringify(policy)); // Deep copy
    
    // Randomly modify targets
    variation.targets.targetCPU = Math.max(30, Math.min(90, 
      (variation.targets.targetCPU || 70) + (Math.random() - 0.5) * 40));
    variation.targets.targetMemory = Math.max(30, Math.min(90, 
      (variation.targets.targetMemory || 70) + (Math.random() - 0.5) * 40));
    
    // Randomly modify behavior
    variation.behavior.scaleUp.stabilizationWindow = Math.max(30, Math.min(300,
      variation.behavior.scaleUp.stabilizationWindow + (Math.random() - 0.5) * 120));
    variation.behavior.scaleDown.stabilizationWindow = Math.max(60, Math.min(600,
      variation.behavior.scaleDown.stabilizationWindow + (Math.random() - 0.5) * 240));
    
    return variation;
  }

  private tournamentSelection(population: ScalingPolicy[], fitnessScores: number[]): ScalingPolicy {
    const tournamentSize = 3;
    let bestIndex = Math.floor(Math.random() * population.length);
    
    for (let i = 1; i < tournamentSize; i++) {
      const candidateIndex = Math.floor(Math.random() * population.length);
      if (fitnessScores[candidateIndex] > fitnessScores[bestIndex]) {
        bestIndex = candidateIndex;
      }
    }
    
    return population[bestIndex];
  }

  private crossover(parent1: ScalingPolicy, parent2: ScalingPolicy): ScalingPolicy {
    const offspring = JSON.parse(JSON.stringify(parent1)); // Deep copy
    
    // Crossover targets
    if (Math.random() < 0.5) {
      offspring.targets.targetCPU = parent2.targets.targetCPU;
    }
    if (Math.random() < 0.5) {
      offspring.targets.targetMemory = parent2.targets.targetMemory;
    }
    
    // Crossover behavior
    if (Math.random() < 0.5) {
      offspring.behavior.scaleUp.stabilizationWindow = parent2.behavior.scaleUp.stabilizationWindow;
    }
    if (Math.random() < 0.5) {
      offspring.behavior.scaleDown.stabilizationWindow = parent2.behavior.scaleDown.stabilizationWindow;
    }
    
    return offspring;
  }

  private mutate(policy: ScalingPolicy): ScalingPolicy {
    const mutated = JSON.parse(JSON.stringify(policy)); // Deep copy
    
    // Mutate with 10% probability each
    if (Math.random() < 0.1) {
      mutated.targets.targetCPU = Math.max(30, Math.min(90, 
        (mutated.targets.targetCPU || 70) + (Math.random() - 0.5) * 20));
    }
    if (Math.random() < 0.1) {
      mutated.targets.targetMemory = Math.max(30, Math.min(90, 
        (mutated.targets.targetMemory || 70) + (Math.random() - 0.5) * 20));
    }
    
    return mutated;
  }

  private randomPolicyAction(policy: ScalingPolicy): string {
    const actions = ['adjust_cpu_target', 'adjust_memory_target', 'adjust_stabilization', 'adjust_replicas'];
    return actions[Math.floor(Math.random() * actions.length)];
  }

  private greedyPolicyAction(policy: ScalingPolicy): string {
    // Select action based on current performance
    // Simplified greedy selection
    return 'adjust_cpu_target';
  }

  private applyAction(policy: ScalingPolicy, action: string): ScalingPolicy {
    const newPolicy = JSON.parse(JSON.stringify(policy)); // Deep copy
    
    switch (action) {
      case 'adjust_cpu_target':
        newPolicy.targets.targetCPU = Math.max(30, Math.min(90, 
          (newPolicy.targets.targetCPU || 70) + (Math.random() - 0.5) * 10));
        break;
      case 'adjust_memory_target':
        newPolicy.targets.targetMemory = Math.max(30, Math.min(90, 
          (newPolicy.targets.targetMemory || 70) + (Math.random() - 0.5) * 10));
        break;
      case 'adjust_stabilization':
        newPolicy.behavior.scaleUp.stabilizationWindow = Math.max(30, Math.min(300,
          newPolicy.behavior.scaleUp.stabilizationWindow + (Math.random() - 0.5) * 60));
        break;
      case 'adjust_replicas':
        newPolicy.targets.maxReplicas = Math.max(newPolicy.targets.minReplicas + 1, Math.min(20,
          newPolicy.targets.maxReplicas + Math.floor((Math.random() - 0.5) * 4)));
        break;
    }
    
    return newPolicy;
  }

  private updatePolicy(current: ScalingPolicy, new: ScalingPolicy, reward: number, learningRate: number): ScalingPolicy {
    const updated = JSON.parse(JSON.stringify(current)); // Deep copy
    
    // Simple policy update based on reward
    if (reward > 0) {
      updated.targets.targetCPU = current.targets.targetCPU! + 
        (new.targets.targetCPU! - current.targets.targetCPU!) * learningRate;
      updated.targets.targetMemory = current.targets.targetMemory! + 
        (new.targets.targetMemory! - current.targets.targetMemory!) * learningRate;
    }
    
    return updated;
  }

  private selectNextCandidate(observations: Array<{ policy: ScalingPolicy; fitness: number }>, acquisitionFunction: string): ScalingPolicy {
    // Simplified candidate selection for Bayesian optimization
    const bestObservation = observations.reduce((best, obs) => 
      obs.fitness > best.fitness ? obs : best);
    
    return this.generateRandomPolicyVariation(bestObservation.policy);
  }

  private async computeNumericalGradients(policy: ScalingPolicy, epsilon: number): Promise<{ [key: string]: number }> {
    const gradients: { [key: string]: number } = {};
    const baseFitness = await this.evaluateFitness(policy);
    
    // Compute gradient for CPU target
    const cpuUpPolicy = JSON.parse(JSON.stringify(policy));
    cpuUpPolicy.targets.targetCPU = (cpuUpPolicy.targets.targetCPU || 70) + epsilon;
    const cpuUpFitness = await this.evaluateFitness(cpuUpPolicy);
    gradients.targetCPU = (cpuUpFitness - baseFitness) / epsilon;
    
    // Compute gradient for memory target
    const memUpPolicy = JSON.parse(JSON.stringify(policy));
    memUpPolicy.targets.targetMemory = (memUpPolicy.targets.targetMemory || 70) + epsilon;
    const memUpFitness = await this.evaluateFitness(memUpPolicy);
    gradients.targetMemory = (memUpFitness - baseFitness) / epsilon;
    
    return gradients;
  }

  private updatePolicyWithGradients(policy: ScalingPolicy, gradients: { [key: string]: number }, learningRate: number): ScalingPolicy {
    const updated = JSON.parse(JSON.stringify(policy)); // Deep copy
    
    if (gradients.targetCPU) {
      updated.targets.targetCPU = Math.max(30, Math.min(90,
        (updated.targets.targetCPU || 70) + gradients.targetCPU * learningRate));
    }
    
    if (gradients.targetMemory) {
      updated.targets.targetMemory = Math.max(30, Math.min(90,
        (updated.targets.targetMemory || 70) + gradients.targetMemory * learningRate));
    }
    
    return updated;
  }

  private calculateConfidence(original: ScalingPolicy, optimized: ScalingPolicy): number {
    // Calculate confidence based on the magnitude of changes and historical performance
    const changes = Math.abs((optimized.targets.targetCPU || 70) - (original.targets.targetCPU || 70)) +
                   Math.abs((optimized.targets.targetMemory || 70) - (original.targets.targetMemory || 70));
    
    // Higher confidence for smaller, incremental changes
    return Math.max(0.1, Math.min(1.0, 1.0 - (changes / 100)));
  }

  private applyOptimization(result: OptimizationResult): void {
    this.policies.set(result.policyId, result.optimizedPolicy);
    result.applied = true;
    result.optimizedPolicy.lastOptimized = new Date();
    
    console.log(`✅ Applied optimization for policy: ${result.policyId}`);
  }

  private storeOptimizationResult(policyId: string, result: OptimizationResult): void {
    if (!this.optimizationHistory.has(policyId)) {
      this.optimizationHistory.set(policyId, []);
    }
    
    const history = this.optimizationHistory.get(policyId)!;
    history.push(result);
    
    // Keep only last 50 results
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  private getOptimizationIteration(policyId: string): number {
    const history = this.optimizationHistory.get(policyId) || [];
    return history.length + 1;
  }

  /**
   * Get policy by ID
   */
  getPolicy(id: string): ScalingPolicy | undefined {
    return this.policies.get(id);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): ScalingPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(policyId: string): OptimizationResult[] {
    return this.optimizationHistory.get(policyId) || [];
  }

  /**
   * Get policy performance summary
   */
  getPolicyPerformanceSummary(policyId: string): any {
    const policy = this.policies.get(policyId);
    if (!policy) return null;

    const history = this.optimizationHistory.get(policyId) || [];
    const recentResults = history.slice(-10);

    return {
      policy: policy.name,
      totalOptimizations: history.length,
      recentImprovements: recentResults.map(r => r.improvement),
      averageImprovement: recentResults.length > 0 
        ? recentResults.reduce((sum, r) => sum + r.improvement, 0) / recentResults.length 
        : 0,
      lastOptimized: policy.lastOptimized,
      currentPerformance: policy.performance
    };
  }
}