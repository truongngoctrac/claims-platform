import {
  PaymentRequest,
  FraudCheckResult,
  FraudRule,
  RiskLevel,
  FraudRiskFactors,
} from '../../../shared/payment';

export class FraudDetectionService {
  private rules: FraudRule[] = [];
  private blacklistedIPs: Set<string> = new Set();
  private blacklistedEmails: Set<string> = new Set();
  private suspiciousDevices: Set<string> = new Set();

  constructor() {
    this.initializeFraudRules();
    this.loadBlacklists();
  }

  async checkPayment(request: PaymentRequest): Promise<FraudCheckResult> {
    const factors = await this.calculateRiskFactors(request);
    const triggeredRules = this.evaluateRules(request, factors);
    const riskScore = this.calculateRiskScore(factors, triggeredRules);
    const riskLevel = this.determineRiskLevel(riskScore);
    const action = this.determineAction(riskLevel, riskScore);
    const recommendations = this.generateRecommendations(triggeredRules, riskLevel);

    return {
      id: `FRAUD_${Date.now()}`,
      paymentId: '', // Will be set when payment is created
      riskScore,
      riskLevel,
      factors,
      rules: triggeredRules,
      recommendations,
      action,
      confidence: this.calculateConfidence(riskScore, triggeredRules.length),
      checkedAt: new Date(),
    };
  }

  private async calculateRiskFactors(request: PaymentRequest): Promise<FraudRiskFactors> {
    // Mock IP risk calculation
    const ipRisk = await this.calculateIPRisk(request.metadata?.clientIP || '127.0.0.1');
    
    // Mock device risk calculation
    const deviceRisk = await this.calculateDeviceRisk(request.metadata?.deviceId || 'unknown');
    
    // Mock behavior risk calculation
    const behaviorRisk = await this.calculateBehaviorRisk(request);
    
    // Mock location risk calculation
    const locationRisk = await this.calculateLocationRisk(request.metadata?.location || 'unknown');
    
    // Mock velocity risk calculation
    const velocityRisk = await this.calculateVelocityRisk(request.customerId);

    const overallRisk = (ipRisk + deviceRisk + behaviorRisk + locationRisk + velocityRisk) / 5;

    return {
      ipRisk,
      deviceRisk,
      behaviorRisk,
      locationRisk,
      velocityRisk,
      overallRisk,
    };
  }

  private async calculateIPRisk(ip: string): Promise<number> {
    // Check against blacklisted IPs
    if (this.blacklistedIPs.has(ip)) {
      return 0.9;
    }

    // Check if IP is from known proxy/VPN (mock)
    if (ip.startsWith('10.') || ip.startsWith('192.168.')) {
      return 0.3; // Private IP, medium risk
    }

    // Mock geolocation risk check
    if (Math.random() > 0.8) {
      return 0.6; // Random high-risk location
    }

    return Math.random() * 0.4; // Random low to medium risk
  }

  private async calculateDeviceRisk(deviceId: string): Promise<number> {
    if (this.suspiciousDevices.has(deviceId)) {
      return 0.8;
    }

    // Mock device fingerprinting risk
    return Math.random() * 0.3;
  }

  private async calculateBehaviorRisk(request: PaymentRequest): Promise<number> {
    let risk = 0;

    // Unusual amount for user
    if (request.amount > 100000) { // VND 100k threshold
      risk += 0.3;
    }

    // Unusual time (night hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) {
      risk += 0.2;
    }

    // Multiple payment methods in short time
    if (request.metadata?.recentMethodChanges === 'true') {
      risk += 0.3;
    }

    return Math.min(risk, 1.0);
  }

  private async calculateLocationRisk(location: string): Promise<number> {
    // Mock location-based risk assessment
    const highRiskCountries = ['XX', 'YY']; // Placeholder country codes
    
    if (highRiskCountries.includes(location)) {
      return 0.7;
    }

    return Math.random() * 0.3;
  }

  private async calculateVelocityRisk(customerId: string): Promise<number> {
    // Mock velocity checks
    // In real implementation, this would check recent transaction frequency
    const recentTransactions = Math.floor(Math.random() * 10);
    
    if (recentTransactions > 5) {
      return 0.8; // High velocity risk
    } else if (recentTransactions > 3) {
      return 0.5; // Medium velocity risk
    }

    return 0.1; // Low velocity risk
  }

  private evaluateRules(request: PaymentRequest, factors: FraudRiskFactors): FraudRule[] {
    const triggeredRules: FraudRule[] = [];

    for (const rule of this.rules) {
      let triggered = false;
      const details: Record<string, any> = {};

      switch (rule.id) {
        case 'high_amount':
          triggered = request.amount > 1000000; // VND 1M
          details.amount = request.amount;
          break;
          
        case 'high_ip_risk':
          triggered = factors.ipRisk > 0.7;
          details.ipRisk = factors.ipRisk;
          break;
          
        case 'high_velocity':
          triggered = factors.velocityRisk > 0.6;
          details.velocityRisk = factors.velocityRisk;
          break;
          
        case 'suspicious_device':
          triggered = factors.deviceRisk > 0.7;
          details.deviceRisk = factors.deviceRisk;
          break;
          
        case 'unusual_behavior':
          triggered = factors.behaviorRisk > 0.6;
          details.behaviorRisk = factors.behaviorRisk;
          break;
          
        case 'blacklisted_customer':
          triggered = this.blacklistedEmails.has(request.metadata?.email || '');
          details.email = request.metadata?.email;
          break;
      }

      if (triggered) {
        triggeredRules.push({
          ...rule,
          triggered: true,
          details,
        });
      }
    }

    return triggeredRules;
  }

  private calculateRiskScore(factors: FraudRiskFactors, triggeredRules: FraudRule[]): number {
    let score = factors.overallRisk * 0.6; // Base score from factors

    // Add rule-based scoring
    const ruleScore = triggeredRules.reduce((acc, rule) => acc + rule.score, 0);
    score += ruleScore * 0.4;

    return Math.min(score, 1.0);
  }

  private determineRiskLevel(riskScore: number): RiskLevel {
    if (riskScore >= 0.8) return RiskLevel.CRITICAL;
    if (riskScore >= 0.6) return RiskLevel.HIGH;
    if (riskScore >= 0.4) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private determineAction(riskLevel: RiskLevel, riskScore: number): 'approve' | 'review' | 'decline' {
    if (riskLevel === RiskLevel.CRITICAL || riskScore >= 0.9) {
      return 'decline';
    }
    if (riskLevel === RiskLevel.HIGH || riskScore >= 0.6) {
      return 'review';
    }
    return 'approve';
  }

  private generateRecommendations(triggeredRules: FraudRule[], riskLevel: RiskLevel): string[] {
    const recommendations: string[] = [];

    if (riskLevel === RiskLevel.CRITICAL) {
      recommendations.push('Block payment immediately');
      recommendations.push('Flag customer account for manual review');
    }

    triggeredRules.forEach(rule => {
      switch (rule.id) {
        case 'high_amount':
          recommendations.push('Verify large transaction with customer');
          break;
        case 'high_ip_risk':
          recommendations.push('Request additional identity verification');
          break;
        case 'high_velocity':
          recommendations.push('Implement transaction cooldown period');
          break;
        case 'suspicious_device':
          recommendations.push('Request device verification');
          break;
        case 'unusual_behavior':
          recommendations.push('Manual review required');
          break;
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Transaction appears legitimate');
    }

    return recommendations;
  }

  private calculateConfidence(riskScore: number, ruleCount: number): number {
    // Higher confidence with more triggered rules and extreme scores
    let confidence = 0.5; // Base confidence

    if (riskScore < 0.2 || riskScore > 0.8) {
      confidence += 0.3; // High confidence for extreme scores
    }

    confidence += Math.min(ruleCount * 0.1, 0.4); // Up to 0.4 bonus for rules

    return Math.min(confidence, 1.0);
  }

  private initializeFraudRules(): void {
    this.rules = [
      {
        id: 'high_amount',
        name: 'High Transaction Amount',
        description: 'Transaction amount exceeds normal limits',
        triggered: false,
        score: 0.3,
        severity: RiskLevel.MEDIUM,
      },
      {
        id: 'high_ip_risk',
        name: 'High IP Risk',
        description: 'Payment from high-risk IP address',
        triggered: false,
        score: 0.4,
        severity: RiskLevel.HIGH,
      },
      {
        id: 'high_velocity',
        name: 'High Transaction Velocity',
        description: 'Too many transactions in short time period',
        triggered: false,
        score: 0.5,
        severity: RiskLevel.HIGH,
      },
      {
        id: 'suspicious_device',
        name: 'Suspicious Device',
        description: 'Payment from suspicious or compromised device',
        triggered: false,
        score: 0.4,
        severity: RiskLevel.HIGH,
      },
      {
        id: 'unusual_behavior',
        name: 'Unusual Behavior Pattern',
        description: 'Transaction pattern deviates from normal behavior',
        triggered: false,
        score: 0.3,
        severity: RiskLevel.MEDIUM,
      },
      {
        id: 'blacklisted_customer',
        name: 'Blacklisted Customer',
        description: 'Customer is on fraud blacklist',
        triggered: false,
        score: 0.8,
        severity: RiskLevel.CRITICAL,
      },
    ];
  }

  private loadBlacklists(): void {
    // Mock blacklisted IPs and emails
    this.blacklistedIPs.add('192.168.1.100');
    this.blacklistedIPs.add('10.0.0.50');
    
    this.blacklistedEmails.add('fraud@example.com');
    this.blacklistedEmails.add('suspicious@test.com');
    
    this.suspiciousDevices.add('suspicious-device-123');
  }

  // Admin methods for managing fraud rules
  async addBlacklistedIP(ip: string): Promise<void> {
    this.blacklistedIPs.add(ip);
  }

  async removeBlacklistedIP(ip: string): Promise<void> {
    this.blacklistedIPs.delete(ip);
  }

  async addBlacklistedEmail(email: string): Promise<void> {
    this.blacklistedEmails.add(email);
  }

  async removeBlacklistedEmail(email: string): Promise<void> {
    this.blacklistedEmails.delete(email);
  }

  async updateRule(ruleId: string, updates: Partial<FraudRule>): Promise<void> {
    const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex !== -1) {
      this.rules[ruleIndex] = { ...this.rules[ruleIndex], ...updates };
    }
  }

  async getRules(): Promise<FraudRule[]> {
    return this.rules.map(rule => ({ ...rule }));
  }

  async getBlacklists(): Promise<{ ips: string[], emails: string[], devices: string[] }> {
    return {
      ips: Array.from(this.blacklistedIPs),
      emails: Array.from(this.blacklistedEmails),
      devices: Array.from(this.suspiciousDevices),
    };
  }
}
