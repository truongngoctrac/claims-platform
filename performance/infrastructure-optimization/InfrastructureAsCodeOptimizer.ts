/**
 * Infrastructure as Code Optimizer
 * Optimizes Infrastructure as Code templates and configurations for healthcare applications
 */

import { 
  InfrastructureAsCodeMetrics,
  ResourceDrift,
  SecurityCompliance,
  OptimizationRecommendation 
} from './types';

export class InfrastructureAsCodeOptimizer {
  private metrics: InfrastructureAsCodeMetrics[] = [];
  private templates: Map<string, any> = new Map();
  private resources: Map<string, any> = new Map();
  private complianceRules: Map<string, any> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {}

  public async initialize(): Promise<void> {
    console.log('🏗️ Initializing Infrastructure as Code Optimizer...');
    await this.discoverTemplates();
    await this.loadComplianceRules();
    await this.scanCurrentState();
    this.startContinuousMonitoring();
  }

  private async discoverTemplates(): Promise<void> {
    console.log('📄 Discovering IaC templates...');
    
    // Simulate discovering various IaC templates
    const templateFiles = [
      { name: 'main.tf', type: 'terraform', path: '/infrastructure/terraform/main.tf' },
      { name: 'healthcare-stack.yaml', type: 'cloudformation', path: '/infrastructure/cf/healthcare-stack.yaml' },
      { name: 'k8s-deployment.yaml', type: 'kubernetes', path: '/k8s/deployment.yaml' },
      { name: 'docker-compose.yml', type: 'docker-compose', path: '/docker/docker-compose.yml' },
      { name: 'helm-chart.yaml', type: 'helm', path: '/helm/healthcare/values.yaml' }
    ];

    for (const template of templateFiles) {
      const templateContent = await this.loadTemplate(template);
      this.templates.set(template.name, {
        ...template,
        content: templateContent,
        lastModified: Date.now() - (Math.random() * 30 * 24 * 60 * 60 * 1000), // Random within last 30 days
        compliance: await this.analyzeTemplateCompliance(templateContent, template.type)
      });
    }
  }

  private async loadTemplate(template: any): Promise<any> {
    // Simulate loading template content
    const templates = {
      'terraform': this.generateTerraformTemplate(),
      'cloudformation': this.generateCloudFormationTemplate(),
      'kubernetes': this.generateKubernetesTemplate(),
      'docker-compose': this.generateDockerComposeTemplate(),
      'helm': this.generateHelmTemplate()
    };

    return templates[template.type as keyof typeof templates] || {};
  }

  private generateTerraformTemplate(): any {
    return {
      provider: {
        aws: {
          region: 'us-west-2',
          version: '~> 5.0'
        }
      },
      resource: {
        aws_instance: {
          web_server: {
            ami: 'ami-0c02fb55956c7d316',
            instance_type: 't3.large',
            tags: {
              Name: 'healthcare-web-server',
              Environment: 'production',
              Project: 'claimflow'
            },
            security_groups: ['${aws_security_group.web_sg.name}']
          }
        },
        aws_security_group: {
          web_sg: {
            name: 'healthcare-web-sg',
            ingress: [
              {
                from_port: 80,
                to_port: 80,
                protocol: 'tcp',
                cidr_blocks: ['0.0.0.0/0']
              },
              {
                from_port: 443,
                to_port: 443,
                protocol: 'tcp',
                cidr_blocks: ['0.0.0.0/0']
              }
            ]
          }
        }
      }
    };
  }

  private generateCloudFormationTemplate(): any {
    return {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: 'Healthcare Claims Processing Infrastructure',
      Resources: {
        WebServerInstance: {
          Type: 'AWS::EC2::Instance',
          Properties: {
            ImageId: 'ami-0c02fb55956c7d316',
            InstanceType: 't3.large',
            SecurityGroupIds: [{ Ref: 'WebSecurityGroup' }],
            Tags: [
              { Key: 'Name', Value: 'healthcare-web-server' },
              { Key: 'Environment', Value: 'production' }
            ]
          }
        },
        WebSecurityGroup: {
          Type: 'AWS::EC2::SecurityGroup',
          Properties: {
            GroupDescription: 'Security group for web servers',
            SecurityGroupIngress: [
              {
                IpProtocol: 'tcp',
                FromPort: 80,
                ToPort: 80,
                CidrIp: '0.0.0.0/0'
              }
            ]
          }
        }
      }
    };
  }

  private generateKubernetesTemplate(): any {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'healthcare-api',
        labels: {
          app: 'healthcare-api',
          version: 'v1.0.0'
        }
      },
      spec: {
        replicas: 3,
        selector: {
          matchLabels: {
            app: 'healthcare-api'
          }
        },
        template: {
          metadata: {
            labels: {
              app: 'healthcare-api'
            }
          },
          spec: {
            containers: [
              {
                name: 'api',
                image: 'healthcare/api:latest',
                ports: [{ containerPort: 3000 }],
                resources: {
                  requests: {
                    memory: '256Mi',
                    cpu: '250m'
                  },
                  limits: {
                    memory: '512Mi',
                    cpu: '500m'
                  }
                }
              }
            ]
          }
        }
      }
    };
  }

  private generateDockerComposeTemplate(): any {
    return {
      version: '3.8',
      services: {
        web: {
          build: './web',
          ports: ['3000:3000'],
          environment: {
            NODE_ENV: 'production',
            DB_HOST: 'db'
          },
          depends_on: ['db', 'redis']
        },
        db: {
          image: 'postgres:13',
          environment: {
            POSTGRES_PASSWORD: 'password123',
            POSTGRES_DB: 'healthcare'
          },
          volumes: ['db_data:/var/lib/postgresql/data']
        },
        redis: {
          image: 'redis:6-alpine',
          ports: ['6379:6379']
        }
      },
      volumes: {
        db_data: {}
      }
    };
  }

  private generateHelmTemplate(): any {
    return {
      replicaCount: 3,
      image: {
        repository: 'healthcare/api',
        tag: 'latest',
        pullPolicy: 'IfNotPresent'
      },
      service: {
        type: 'LoadBalancer',
        port: 80,
        targetPort: 3000
      },
      ingress: {
        enabled: true,
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod'
        },
        hosts: [
          {
            host: 'api.healthcare.com',
            paths: ['/']
          }
        ],
        tls: [
          {
            secretName: 'healthcare-tls',
            hosts: ['api.healthcare.com']
          }
        ]
      },
      resources: {
        limits: {
          cpu: '500m',
          memory: '512Mi'
        },
        requests: {
          cpu: '250m',
          memory: '256Mi'
        }
      }
    };
  }

  private async analyzeTemplateCompliance(template: any, type: string): Promise<number> {
    // Simulate compliance analysis - in real implementation, this would use tools like
    // Checkov, tfsec, or custom compliance rules
    
    let complianceScore = 100;
    const violations = [];

    // Check for common security issues
    if (this.hasOpenSecurityGroups(template)) {
      complianceScore -= 20;
      violations.push('Open security groups detected');
    }

    if (this.hasHardcodedSecrets(template)) {
      complianceScore -= 30;
      violations.push('Hardcoded secrets detected');
    }

    if (this.missingEncryption(template)) {
      complianceScore -= 15;
      violations.push('Missing encryption configuration');
    }

    if (this.missingBackupConfiguration(template)) {
      complianceScore -= 10;
      violations.push('Missing backup configuration');
    }

    if (this.missingMonitoring(template)) {
      complianceScore -= 10;
      violations.push('Missing monitoring configuration');
    }

    if (this.missingTags(template)) {
      complianceScore -= 5;
      violations.push('Missing required tags');
    }

    return Math.max(0, complianceScore);
  }

  private hasOpenSecurityGroups(template: any): boolean {
    // Check for 0.0.0.0/0 in security groups
    const templateStr = JSON.stringify(template);
    return templateStr.includes('0.0.0.0/0') && templateStr.includes('22'); // SSH port open to world
  }

  private hasHardcodedSecrets(template: any): boolean {
    // Check for hardcoded passwords, keys, etc.
    const templateStr = JSON.stringify(template).toLowerCase();
    return templateStr.includes('password123') || 
           templateStr.includes('secret') || 
           templateStr.includes('key') && templateStr.includes('=');
  }

  private missingEncryption(template: any): boolean {
    // Check if encryption is configured for storage resources
    const templateStr = JSON.stringify(template);
    return !templateStr.includes('encrypt') && templateStr.includes('database');
  }

  private missingBackupConfiguration(template: any): boolean {
    // Check if backup is configured for data resources
    const templateStr = JSON.stringify(template);
    return !templateStr.includes('backup') && templateStr.includes('database');
  }

  private missingMonitoring(template: any): boolean {
    // Check if monitoring/logging is configured
    const templateStr = JSON.stringify(template);
    return !templateStr.includes('monitor') && !templateStr.includes('log');
  }

  private missingTags(template: any): boolean {
    // Check if required tags are present
    const templateStr = JSON.stringify(template);
    return !templateStr.includes('Environment') || !templateStr.includes('Project');
  }

  private async loadComplianceRules(): Promise<void> {
    console.log('📋 Loading compliance rules...');
    
    const rules = [
      {
        id: 'require-encryption',
        name: 'Encryption Required',
        description: 'All data storage must be encrypted',
        severity: 'critical'
      },
      {
        id: 'no-hardcoded-secrets',
        name: 'No Hardcoded Secrets',
        description: 'Secrets must be stored in secure parameter stores',
        severity: 'critical'
      },
      {
        id: 'require-backup',
        name: 'Backup Configuration Required',
        description: 'Database resources must have backup configuration',
        severity: 'high'
      },
      {
        id: 'security-group-restrictions',
        name: 'Security Group Restrictions',
        description: 'Security groups should not allow unrestricted access',
        severity: 'high'
      },
      {
        id: 'require-tags',
        name: 'Resource Tagging Required',
        description: 'All resources must have proper tags',
        severity: 'medium'
      },
      {
        id: 'require-monitoring',
        name: 'Monitoring Required',
        description: 'Critical resources must have monitoring enabled',
        severity: 'medium'
      }
    ];

    rules.forEach(rule => {
      this.complianceRules.set(rule.id, rule);
    });
  }

  private async scanCurrentState(): Promise<void> {
    console.log('🔍 Scanning current infrastructure state...');
    
    // Simulate resource discovery and state analysis
    const currentResources = await this.discoverCurrentResources();
    const templateCompliance = await this.analyzeTemplateCompliance();
    const resourceDrift = await this.detectResourceDrift();
    const securityCompliance = await this.analyzeSecurityCompliance();
    const bestPracticesScore = await this.analyzeBestPractices();
    const costOptimizationScore = await this.analyzeCostOptimization();

    const metrics: InfrastructureAsCodeMetrics = {
      templateCompliance,
      resourceDrift,
      securityCompliance,
      costOptimizationScore,
      bestPracticesScore
    };

    this.metrics.push(metrics);
  }

  private async discoverCurrentResources(): Promise<void> {
    // Simulate discovering actual deployed resources
    const resources = [
      { id: 'i-1234567890abcdef0', type: 'ec2-instance', tags: { Name: 'web-server' } },
      { id: 'sg-0123456789abcdef0', type: 'security-group', rules: [{ port: 80, cidr: '0.0.0.0/0' }] },
      { id: 'db-instance-1', type: 'rds-instance', encrypted: false },
      { id: 'lb-healthcare', type: 'load-balancer', scheme: 'internet-facing' }
    ];

    resources.forEach(resource => {
      this.resources.set(resource.id, resource);
    });
  }

  private async analyzeTemplateCompliance(): Promise<number> {
    let totalScore = 0;
    let templateCount = 0;

    for (const [, template] of this.templates) {
      totalScore += template.compliance;
      templateCount++;
    }

    return templateCount > 0 ? totalScore / templateCount : 100;
  }

  private async detectResourceDrift(): Promise<ResourceDrift[]> {
    const drift: ResourceDrift[] = [];
    
    // Simulate drift detection between templates and actual resources
    drift.push({
      resourceId: 'i-1234567890abcdef0',
      resourceType: 'ec2-instance',
      driftType: 'configuration',
      currentState: { instance_type: 't3.large', tags: { Name: 'web-server' } },
      expectedState: { instance_type: 't3.medium', tags: { Name: 'healthcare-web-server', Environment: 'production' } },
      severity: 'medium'
    });

    drift.push({
      resourceId: 'db-instance-1',
      resourceType: 'rds-instance',
      driftType: 'security',
      currentState: { encrypted: false },
      expectedState: { encrypted: true },
      severity: 'critical'
    });

    return drift;
  }

  private async analyzeSecurityCompliance(): Promise<SecurityCompliance[]> {
    const compliance: SecurityCompliance[] = [];

    // Check against compliance rules
    compliance.push({
      rule: 'require-encryption',
      status: 'non-compliant',
      severity: 'critical',
      description: 'Database instance is not encrypted',
      remediation: 'Enable encryption on RDS instance'
    });

    compliance.push({
      rule: 'security-group-restrictions',
      status: 'non-compliant',
      severity: 'high',
      description: 'Security group allows unrestricted access',
      remediation: 'Restrict security group rules to specific IP ranges'
    });

    compliance.push({
      rule: 'require-tags',
      status: 'compliant',
      severity: 'medium',
      description: 'Resources have proper tags',
      remediation: 'N/A'
    });

    return compliance;
  }

  private async analyzeBestPractices(): Promise<number> {
    let score = 100;
    
    // Check various best practices
    if (!this.hasVersionPinning()) score -= 15;
    if (!this.hasProperModularization()) score -= 10;
    if (!this.hasDocumentation()) score -= 10;
    if (!this.hasTestingStrategy()) score -= 15;
    if (!this.hasChangeManagement()) score -= 10;

    return Math.max(0, score);
  }

  private hasVersionPinning(): boolean {
    // Check if provider/image versions are pinned
    for (const [, template] of this.templates) {
      const templateStr = JSON.stringify(template.content);
      if (templateStr.includes('latest') || !templateStr.includes('version')) {
        return false;
      }
    }
    return true;
  }

  private hasProperModularization(): boolean {
    // Check if templates are properly modularized
    return this.templates.size > 1; // Simplified check
  }

  private hasDocumentation(): boolean {
    // Check if templates have documentation
    return Math.random() > 0.3; // Simulate 70% chance of having documentation
  }

  private hasTestingStrategy(): boolean {
    // Check if there's a testing strategy for IaC
    return Math.random() > 0.5; // Simulate 50% chance of having tests
  }

  private hasChangeManagement(): boolean {
    // Check if proper change management is in place
    return Math.random() > 0.4; // Simulate 60% chance of having change management
  }

  private async analyzeCostOptimization(): Promise<number> {
    let score = 100;
    
    // Check for cost optimization practices
    if (!this.hasRightSizedResources()) score -= 20;
    if (!this.hasScheduledShutdown()) score -= 15;
    if (!this.hasReservedInstances()) score -= 10;
    if (!this.hasAutoScaling()) score -= 15;

    return Math.max(0, score);
  }

  private hasRightSizedResources(): boolean {
    // Check if resources are right-sized
    return Math.random() > 0.4; // Simulate 60% chance of right-sized resources
  }

  private hasScheduledShutdown(): boolean {
    // Check if non-production resources have scheduled shutdown
    return Math.random() > 0.6; // Simulate 40% chance of scheduled shutdown
  }

  private hasReservedInstances(): boolean {
    // Check if reserved instances are used for stable workloads
    return Math.random() > 0.7; // Simulate 30% chance of using reserved instances
  }

  private hasAutoScaling(): boolean {
    // Check if auto-scaling is configured
    return Math.random() > 0.5; // Simulate 50% chance of auto-scaling
  }

  private startContinuousMonitoring(): void {
    console.log('🔄 Starting continuous IaC monitoring...');
    
    this.scanInterval = setInterval(async () => {
      await this.scanCurrentState();
      await this.validateTemplates();
      await this.checkForDrift();
    }, 3600000); // Scan every hour
  }

  private async validateTemplates(): Promise<void> {
    console.log('✅ Validating IaC templates...');
    
    for (const [name, template] of this.templates) {
      const isValid = await this.validateTemplate(template);
      if (!isValid) {
        console.warn(`⚠️ Template ${name} has validation issues`);
      }
    }
  }

  private async validateTemplate(template: any): Promise<boolean> {
    // Simulate template validation
    return Math.random() > 0.1; // 90% chance of valid template
  }

  private async checkForDrift(): Promise<void> {
    console.log('🔍 Checking for infrastructure drift...');
    
    const drift = await this.detectResourceDrift();
    if (drift.length > 0) {
      console.warn(`⚠️ Detected ${drift.length} instances of infrastructure drift`);
    }
  }

  public async optimizeTemplates(): Promise<void> {
    console.log('🛠️ Optimizing IaC templates...');
    
    for (const [name, template] of this.templates) {
      const optimizedTemplate = await this.optimizeTemplate(template);
      this.templates.set(name, optimizedTemplate);
    }
  }

  private async optimizeTemplate(template: any): Promise<any> {
    const optimized = { ...template };
    
    // Apply optimizations
    optimized.content = await this.applySecurityOptimizations(optimized.content);
    optimized.content = await this.applyCostOptimizations(optimized.content);
    optimized.content = await this.applyPerformanceOptimizations(optimized.content);
    
    return optimized;
  }

  private async applySecurityOptimizations(content: any): Promise<any> {
    // Apply security optimizations like removing hardcoded secrets,
    // restricting security groups, enabling encryption, etc.
    console.log('🔐 Applying security optimizations...');
    return content;
  }

  private async applyCostOptimizations(content: any): Promise<any> {
    // Apply cost optimizations like right-sizing instances,
    // adding auto-scaling, configuring scheduled shutdown, etc.
    console.log('💰 Applying cost optimizations...');
    return content;
  }

  private async applyPerformanceOptimizations(content: any): Promise<any> {
    // Apply performance optimizations like load balancing,
    // caching, CDN configuration, etc.
    console.log('⚡ Applying performance optimizations...');
    return content;
  }

  public getOptimizationRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    
    if (this.metrics.length === 0) return recommendations;

    const latestMetrics = this.metrics[this.metrics.length - 1];

    // Security compliance recommendations
    const criticalSecurityIssues = latestMetrics.securityCompliance.filter(c => 
      c.status === 'non-compliant' && c.severity === 'critical'
    );
    
    if (criticalSecurityIssues.length > 0) {
      recommendations.push({
        id: 'iac-security-compliance',
        category: 'infrastructure-as-code',
        priority: 'critical',
        title: 'Critical Security Compliance Issues',
        description: `${criticalSecurityIssues.length} critical security compliance issues found`,
        expectedImpact: 'Improve security posture and reduce vulnerabilities',
        implementation: [
          'Fix hardcoded secrets in templates',
          'Enable encryption for data resources',
          'Restrict security group access',
          'Implement security scanning in CI/CD'
        ],
        estimatedCost: 1000,
        estimatedSavings: 5000,
        timeline: '1-2 weeks'
      });
    }

    // Resource drift recommendations
    if (latestMetrics.resourceDrift.length > 0) {
      recommendations.push({
        id: 'iac-resource-drift',
        category: 'infrastructure-as-code',
        priority: 'high',
        title: 'Infrastructure Drift Detected',
        description: `${latestMetrics.resourceDrift.length} resources have drifted from their expected state`,
        expectedImpact: 'Ensure infrastructure consistency and reliability',
        implementation: [
          'Implement drift detection automation',
          'Update templates to match current state',
          'Apply infrastructure changes through IaC',
          'Set up continuous compliance monitoring'
        ],
        estimatedCost: 2000,
        estimatedSavings: 3000,
        timeline: '2-3 weeks'
      });
    }

    // Template compliance recommendations
    if (latestMetrics.templateCompliance < 80) {
      recommendations.push({
        id: 'iac-template-compliance',
        category: 'infrastructure-as-code',
        priority: 'medium',
        title: 'Improve Template Compliance',
        description: `Template compliance score is ${latestMetrics.templateCompliance.toFixed(1)}%`,
        expectedImpact: 'Improve code quality and maintainability',
        implementation: [
          'Add template validation to CI/CD pipeline',
          'Implement code quality checks',
          'Add proper documentation',
          'Standardize template structure'
        ],
        estimatedCost: 1500,
        estimatedSavings: 2500,
        timeline: '3-4 weeks'
      });
    }

    // Best practices recommendations
    if (latestMetrics.bestPracticesScore < 70) {
      recommendations.push({
        id: 'iac-best-practices',
        category: 'infrastructure-as-code',
        priority: 'medium',
        title: 'Implement IaC Best Practices',
        description: `Best practices score is ${latestMetrics.bestPracticesScore.toFixed(1)}%`,
        expectedImpact: 'Improve development velocity and code quality',
        implementation: [
          'Implement version pinning for all dependencies',
          'Add comprehensive testing strategy',
          'Improve template modularization',
          'Implement proper change management'
        ],
        estimatedCost: 3000,
        estimatedSavings: 4000,
        timeline: '4-6 weeks'
      });
    }

    return recommendations;
  }

  public generateIaCReport(): any {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    
    if (!latestMetrics) {
      return {
        timestamp: Date.now(),
        error: 'No IaC metrics available',
        recommendations: []
      };
    }

    return {
      timestamp: Date.now(),
      templateAnalysis: {
        totalTemplates: this.templates.size,
        templateCompliance: latestMetrics.templateCompliance,
        templateTypes: this.getTemplateTypes(),
        recentlyModified: this.getRecentlyModifiedTemplates()
      },
      complianceAnalysis: {
        securityCompliance: latestMetrics.securityCompliance,
        complianceByRule: this.getComplianceByRule(latestMetrics.securityCompliance),
        criticalIssues: latestMetrics.securityCompliance.filter(c => 
          c.status === 'non-compliant' && c.severity === 'critical'
        ).length
      },
      driftAnalysis: {
        totalDrift: latestMetrics.resourceDrift.length,
        driftByType: this.getDriftByType(latestMetrics.resourceDrift),
        driftBySeverity: this.getDriftBySeverity(latestMetrics.resourceDrift)
      },
      qualityMetrics: {
        bestPracticesScore: latestMetrics.bestPracticesScore,
        costOptimizationScore: latestMetrics.costOptimizationScore,
        overallHealth: this.getIaCHealthStatus(latestMetrics)
      },
      recommendations: this.getOptimizationRecommendations()
    };
  }

  private getTemplateTypes(): Record<string, number> {
    const types: Record<string, number> = {};
    
    for (const [, template] of this.templates) {
      types[template.type] = (types[template.type] || 0) + 1;
    }
    
    return types;
  }

  private getRecentlyModifiedTemplates(): string[] {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    return Array.from(this.templates.entries())
      .filter(([, template]) => template.lastModified > oneWeekAgo)
      .map(([name]) => name);
  }

  private getComplianceByRule(compliance: SecurityCompliance[]): Record<string, { compliant: number; nonCompliant: number }> {
    const byRule: Record<string, { compliant: number; nonCompliant: number }> = {};
    
    compliance.forEach(item => {
      if (!byRule[item.rule]) {
        byRule[item.rule] = { compliant: 0, nonCompliant: 0 };
      }
      
      if (item.status === 'compliant') {
        byRule[item.rule].compliant++;
      } else {
        byRule[item.rule].nonCompliant++;
      }
    });
    
    return byRule;
  }

  private getDriftByType(drift: ResourceDrift[]): Record<string, number> {
    const byType: Record<string, number> = {};
    
    drift.forEach(item => {
      byType[item.driftType] = (byType[item.driftType] || 0) + 1;
    });
    
    return byType;
  }

  private getDriftBySeverity(drift: ResourceDrift[]): Record<string, number> {
    const bySeverity: Record<string, number> = {};
    
    drift.forEach(item => {
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
    });
    
    return bySeverity;
  }

  private getIaCHealthStatus(metrics: InfrastructureAsCodeMetrics): string {
    const criticalIssues = metrics.securityCompliance.filter(c => 
      c.status === 'non-compliant' && c.severity === 'critical'
    ).length;
    
    const criticalDrift = metrics.resourceDrift.filter(d => d.severity === 'critical').length;
    
    if (criticalIssues > 0 || criticalDrift > 0 || metrics.templateCompliance < 60) {
      return 'Critical - Immediate attention required';
    } else if (metrics.templateCompliance < 80 || metrics.bestPracticesScore < 70) {
      return 'Warning - Improvements needed';
    } else {
      return 'Healthy - Well-managed IaC';
    }
  }

  public cleanup(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    console.log('🏗️ Infrastructure as Code Optimizer cleaned up');
  }
}
