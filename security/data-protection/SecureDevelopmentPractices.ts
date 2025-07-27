import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface SecurityGuideline {
  id: string;
  category: 'authentication' | 'authorization' | 'data_handling' | 'input_validation' | 'error_handling' | 'logging' | 'configuration';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  implementation: string;
  examples: CodeExample[];
  checklistItems: string[];
  relatedStandards: string[];
}

export interface CodeExample {
  language: 'typescript' | 'javascript' | 'sql' | 'yaml' | 'json';
  title: string;
  insecureCode?: string;
  secureCode: string;
  explanation: string;
}

export interface SecurityReview {
  reviewId: string;
  projectName: string;
  reviewType: 'pre_commit' | 'pull_request' | 'release' | 'periodic';
  reviewer: string;
  timestamp: Date;
  findings: SecurityFinding[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  status: 'in_progress' | 'completed' | 'requires_action';
  recommendations: string[];
}

export interface SecurityFinding {
  id: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: {
    file: string;
    line?: number;
    function?: string;
  };
  recommendation: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
  assignee?: string;
}

export interface DeveloperTraining {
  trainingId: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // minutes
  modules: TrainingModule[];
  prerequisites: string[];
  certificationRequired: boolean;
}

export interface TrainingModule {
  moduleId: string;
  title: string;
  content: string;
  exercises: SecurityExercise[];
  quiz: QuizQuestion[];
  resources: string[];
}

export interface SecurityExercise {
  exerciseId: string;
  title: string;
  description: string;
  vulnerableCode: string;
  solution: string;
  hints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizQuestion {
  questionId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface ComplianceFramework {
  frameworkId: string;
  name: string;
  description: string;
  requirements: ComplianceRequirement[];
  applicableRegions: string[];
  lastUpdated: Date;
}

export interface ComplianceRequirement {
  requirementId: string;
  section: string;
  title: string;
  description: string;
  controls: SecurityControl[];
  evidence: string[];
  status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'not_applicable';
}

export interface SecurityControl {
  controlId: string;
  description: string;
  implementation: string;
  testProcedure: string;
  automatedCheck: boolean;
}

export class SecureDevelopmentPractices extends EventEmitter {
  private guidelines: Map<string, SecurityGuideline>;
  private reviews: Map<string, SecurityReview>;
  private trainings: Map<string, DeveloperTraining>;
  private complianceFrameworks: Map<string, ComplianceFramework>;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.guidelines = new Map();
    this.reviews = new Map();
    this.trainings = new Map();
    this.complianceFrameworks = new Map();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.setupSecurityGuidelines();
      await this.setupDeveloperTraining();
      await this.setupComplianceFrameworks();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  private async setupSecurityGuidelines(): Promise<void> {
    const guidelines: SecurityGuideline[] = [
      {
        id: 'auth_001',
        category: 'authentication',
        title: 'Secure Password Handling',
        description: 'Implement secure password storage and validation',
        severity: 'critical',
        implementation: 'Use bcrypt or similar for password hashing with salt',
        examples: [
          {
            language: 'typescript',
            title: 'Secure Password Hashing',
            insecureCode: `
// INSECURE - Plain text password storage
const user = {
  email: 'user@example.com',
  password: 'plainTextPassword' // Never do this!
};
            `,
            secureCode: `
import bcrypt from 'bcryptjs';

// SECURE - Hashed password with salt
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);

const user = {
  email: 'user@example.com',
  passwordHash: hashedPassword
};

// Verification
const isValidPassword = await bcrypt.compare(providedPassword, user.passwordHash);
            `,
            explanation: 'Always hash passwords with a strong algorithm like bcrypt and use appropriate salt rounds (12+)'
          }
        ],
        checklistItems: [
          'Passwords are hashed using bcrypt with salt rounds >= 12',
          'Password complexity requirements are enforced',
          'Account lockout mechanisms are in place',
          'Password reset flows are secure'
        ],
        relatedStandards: ['OWASP ASVS', 'NIST 800-63B']
      },
      {
        id: 'input_001',
        category: 'input_validation',
        title: 'Input Sanitization and Validation',
        description: 'Prevent injection attacks through proper input handling',
        severity: 'critical',
        implementation: 'Use parameterized queries and input validation libraries',
        examples: [
          {
            language: 'typescript',
            title: 'SQL Injection Prevention',
            insecureCode: `
// VULNERABLE to SQL injection
const query = \`SELECT * FROM users WHERE id = \${userId}\`;
const result = await db.query(query);
            `,
            secureCode: `
// SECURE - Parameterized query
const query = 'SELECT * FROM users WHERE id = ?';
const result = await db.query(query, [userId]);

// Or using Zod for validation
import { z } from 'zod';

const UserIdSchema = z.string().uuid();
const validatedUserId = UserIdSchema.parse(userId);
            `,
            explanation: 'Always use parameterized queries and validate input with schema validation libraries'
          }
        ],
        checklistItems: [
          'All user inputs are validated using schema validation',
          'Parameterized queries are used for database operations',
          'Input length limits are enforced',
          'Special characters are properly escaped'
        ],
        relatedStandards: ['OWASP Top 10', 'CWE-89']
      },
      {
        id: 'data_001',
        category: 'data_handling',
        title: 'Sensitive Data Protection',
        description: 'Protect sensitive healthcare data in transit and at rest',
        severity: 'critical',
        implementation: 'Encrypt sensitive data and implement proper access controls',
        examples: [
          {
            language: 'typescript',
            title: 'Healthcare Data Encryption',
            secureCode: `
import crypto from 'crypto';

class HealthcareDataHandler {
  private encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = crypto.randomBytes(32);
  }

  encryptPHI(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    return \`\${iv.toString('hex')}:\${tag.toString('hex')}:\${encrypted}\`;
  }

  // Always log access to PHI
  logPHIAccess(userId: string, patientId: string, action: string) {
    console.log(\`PHI Access: User \${userId} performed \${action} on patient \${patientId} at \${new Date().toISOString()}\`);
  }
}
            `,
            explanation: 'Encrypt all PHI data and maintain comprehensive audit logs for HIPAA compliance'
          }
        ],
        checklistItems: [
          'PHI is encrypted at rest and in transit',
          'Access controls are role-based',
          'All data access is logged',
          'Data retention policies are implemented'
        ],
        relatedStandards: ['HIPAA', 'GDPR', 'HITECH']
      },
      {
        id: 'error_001',
        category: 'error_handling',
        title: 'Secure Error Handling',
        description: 'Prevent information disclosure through error messages',
        severity: 'medium',
        implementation: 'Implement generic error responses and secure logging',
        examples: [
          {
            language: 'typescript',
            title: 'Secure Error Handling',
            insecureCode: `
// INSECURE - Exposes system information
try {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
} catch (error) {
  res.status(500).json({ error: error.message }); // Don't expose DB errors!
}
            `,
            secureCode: `
// SECURE - Generic error response
try {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
} catch (error) {
  // Log the actual error securely
  logger.error('Database query failed', { userId, error: error.message });
  
  // Return generic error to client
  res.status(500).json({ 
    error: 'An internal error occurred. Please try again later.',
    errorId: crypto.randomUUID() // For tracking
  });
}
            `,
            explanation: 'Never expose internal system details in error messages. Log errors securely for debugging.'
          }
        ],
        checklistItems: [
          'Error messages are generic and don\'t expose system details',
          'Detailed errors are logged securely',
          'Error correlation IDs are used for tracking',
          'Stack traces are never exposed to clients'
        ],
        relatedStandards: ['OWASP Error Handling', 'CWE-209']
      }
    ];

    for (const guideline of guidelines) {
      this.guidelines.set(guideline.id, guideline);
    }
  }

  private async setupDeveloperTraining(): Promise<void> {
    const training: DeveloperTraining = {
      trainingId: 'sec_train_001',
      title: 'Healthcare Application Security Fundamentals',
      description: 'Essential security practices for healthcare software development',
      category: 'security_fundamentals',
      difficulty: 'intermediate',
      duration: 240, // 4 hours
      modules: [
        {
          moduleId: 'mod_001',
          title: 'HIPAA Compliance in Development',
          content: 'Understanding HIPAA requirements and implementing compliant code',
          exercises: [
            {
              exerciseId: 'ex_001',
              title: 'Identify PHI in Code',
              description: 'Review code samples and identify Protected Health Information',
              vulnerableCode: `
const patientData = {
  name: 'John Doe',
  ssn: '123-45-6789',
  diagnosis: 'Type 2 Diabetes',
  email: 'john@example.com'
};

// This data is logged without encryption
console.log('Patient data:', patientData);
              `,
              solution: `
// Encrypt sensitive data before logging
const sensitiveFields = ['ssn', 'diagnosis'];
const safePatientData = Object.keys(patientData).reduce((acc, key) => {
  if (sensitiveFields.includes(key)) {
    acc[key] = '[ENCRYPTED]';
  } else {
    acc[key] = patientData[key];
  }
  return acc;
}, {});

console.log('Patient data:', safePatientData);
              `,
              hints: [
                'SSN and diagnosis are PHI under HIPAA',
                'Consider what data should never be logged in plain text',
                'Implement data classification for automatic handling'
              ],
              difficulty: 'medium'
            }
          ],
          quiz: [
            {
              questionId: 'q_001',
              question: 'Which of the following is considered PHI under HIPAA?',
              options: [
                'Patient name only',
                'De-identified medical records',
                'Patient name + diagnosis',
                'Anonymous usage statistics'
              ],
              correctAnswer: 2,
              explanation: 'Patient name combined with medical information constitutes PHI'
            }
          ],
          resources: [
            'https://www.hhs.gov/hipaa/for-professionals/privacy/index.html',
            'NIST Cybersecurity Framework',
            'OWASP Healthcare Security Guidelines'
          ]
        }
      ],
      prerequisites: ['Basic TypeScript knowledge', 'Understanding of web security'],
      certificationRequired: true
    };

    this.trainings.set(training.trainingId, training);
  }

  private async setupComplianceFrameworks(): Promise<void> {
    const hipaaFramework: ComplianceFramework = {
      frameworkId: 'hipaa_framework',
      name: 'HIPAA Compliance Framework',
      description: 'Health Insurance Portability and Accountability Act compliance requirements',
      applicableRegions: ['US'],
      lastUpdated: new Date(),
      requirements: [
        {
          requirementId: 'hipaa_164_308',
          section: '164.308',
          title: 'Administrative Safeguards',
          description: 'Implement administrative safeguards for PHI protection',
          controls: [
            {
              controlId: 'admin_001',
              description: 'Assign security responsibility to specific personnel',
              implementation: 'Designate security officers and maintain role assignments',
              testProcedure: 'Verify security officer assignments and responsibilities',
              automatedCheck: false
            }
          ],
          evidence: ['Security policy documents', 'Role assignment records'],
          status: 'compliant'
        },
        {
          requirementId: 'hipaa_164_312',
          section: '164.312',
          title: 'Technical Safeguards',
          description: 'Implement technical safeguards for PHI systems',
          controls: [
            {
              controlId: 'tech_001',
              description: 'Implement access controls for PHI systems',
              implementation: 'Role-based access control with multi-factor authentication',
              testProcedure: 'Test access controls and authentication mechanisms',
              automatedCheck: true
            }
          ],
          evidence: ['Access control configurations', 'Authentication logs'],
          status: 'compliant'
        }
      ]
    };

    this.complianceFrameworks.set(hipaaFramework.frameworkId, hipaaFramework);
  }

  async conductSecurityReview(
    projectName: string,
    reviewer: string,
    reviewType: 'pre_commit' | 'pull_request' | 'release' | 'periodic'
  ): Promise<string> {
    
    const reviewId = crypto.randomUUID();
    
    // Simulate security review findings
    const findings: SecurityFinding[] = await this.performAutomatedSecurityScan();
    
    const overallRisk = this.calculateOverallRisk(findings);
    
    const review: SecurityReview = {
      reviewId,
      projectName,
      reviewType,
      reviewer,
      timestamp: new Date(),
      findings,
      overallRisk,
      status: findings.length > 0 ? 'requires_action' : 'completed',
      recommendations: this.generateRecommendations(findings)
    };

    this.reviews.set(reviewId, review);
    this.emit('securityReviewCompleted', { reviewId, review });
    
    return reviewId;
  }

  private async performAutomatedSecurityScan(): Promise<SecurityFinding[]> {
    // Simulate automated security scanning
    const findings: SecurityFinding[] = [];

    // Check for common vulnerabilities
    const commonFindings = [
      {
        category: 'input_validation',
        severity: 'high' as const,
        title: 'Missing Input Validation',
        description: 'User input is not properly validated before processing',
        location: { file: 'src/api/users.ts', line: 45, function: 'createUser' },
        recommendation: 'Implement Zod schema validation for all user inputs'
      },
      {
        category: 'authentication',
        severity: 'medium' as const,
        title: 'Weak Password Policy',
        description: 'Password complexity requirements are insufficient',
        location: { file: 'src/auth/password.ts', line: 12 },
        recommendation: 'Increase minimum password length to 12 characters and require special characters'
      }
    ];

    for (const finding of commonFindings) {
      findings.push({
        id: crypto.randomUUID(),
        ...finding,
        status: 'open'
      });
    }

    return findings;
  }

  private calculateOverallRisk(findings: SecurityFinding[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    const mediumCount = findings.filter(f => f.severity === 'medium').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 2) return 'high';
    if (highCount > 0 || mediumCount > 5) return 'medium';
    return 'low';
  }

  private generateRecommendations(findings: SecurityFinding[]): string[] {
    const recommendations: string[] = [];

    if (findings.some(f => f.category === 'input_validation')) {
      recommendations.push('Implement comprehensive input validation using Zod schemas');
    }

    if (findings.some(f => f.category === 'authentication')) {
      recommendations.push('Review and strengthen authentication mechanisms');
    }

    if (findings.some(f => f.severity === 'critical')) {
      recommendations.push('Address critical security findings immediately before deployment');
    }

    recommendations.push('Conduct regular security training for development team');
    recommendations.push('Implement automated security testing in CI/CD pipeline');

    return recommendations;
  }

  async createSecurityChecklist(category?: string): Promise<string[]> {
    const checklist: string[] = [];

    for (const guideline of this.guidelines.values()) {
      if (!category || guideline.category === category) {
        checklist.push(`${guideline.title}:`);
        checklist.push(...guideline.checklistItems.map(item => `  ☐ ${item}`));
        checklist.push('');
      }
    }

    return checklist;
  }

  async generateSecurityReport(reviewId: string): Promise<string> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      throw new Error(`Security review not found: ${reviewId}`);
    }

    let report = `# Security Review Report\n\n`;
    report += `**Project:** ${review.projectName}\n`;
    report += `**Review Type:** ${review.reviewType}\n`;
    report += `**Reviewer:** ${review.reviewer}\n`;
    report += `**Date:** ${review.timestamp.toISOString()}\n`;
    report += `**Overall Risk:** ${review.overallRisk.toUpperCase()}\n\n`;

    report += `## Summary\n`;
    report += `- Total Findings: ${review.findings.length}\n`;
    report += `- Critical: ${review.findings.filter(f => f.severity === 'critical').length}\n`;
    report += `- High: ${review.findings.filter(f => f.severity === 'high').length}\n`;
    report += `- Medium: ${review.findings.filter(f => f.severity === 'medium').length}\n`;
    report += `- Low: ${review.findings.filter(f => f.severity === 'low').length}\n\n`;

    if (review.findings.length > 0) {
      report += `## Findings\n\n`;
      for (const finding of review.findings) {
        report += `### ${finding.title} (${finding.severity.toUpperCase()})\n`;
        report += `**Location:** ${finding.location.file}`;
        if (finding.location.line) report += `:${finding.location.line}`;
        if (finding.location.function) report += ` in ${finding.location.function}()`;
        report += `\n`;
        report += `**Description:** ${finding.description}\n`;
        report += `**Recommendation:** ${finding.recommendation}\n\n`;
      }
    }

    if (review.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      for (const recommendation of review.recommendations) {
        report += `- ${recommendation}\n`;
      }
    }

    return report;
  }

  async trackTrainingProgress(userId: string, trainingId: string, moduleId: string): Promise<void> {
    // In a real implementation, this would track user progress through training modules
    this.emit('trainingProgressUpdated', { userId, trainingId, moduleId, timestamp: new Date() });
  }

  async validateCompliance(frameworkId: string): Promise<{
    compliant: boolean;
    gaps: ComplianceRequirement[];
    score: number;
  }> {
    
    const framework = this.complianceFrameworks.get(frameworkId);
    if (!framework) {
      throw new Error(`Compliance framework not found: ${frameworkId}`);
    }

    const gaps = framework.requirements.filter(req => 
      req.status === 'non_compliant' || req.status === 'partially_compliant'
    );

    const compliantCount = framework.requirements.filter(req => req.status === 'compliant').length;
    const score = (compliantCount / framework.requirements.length) * 100;

    return {
      compliant: gaps.length === 0,
      gaps,
      score
    };
  }

  getSecurityGuidelines(category?: string): SecurityGuideline[] {
    const guidelines = Array.from(this.guidelines.values());
    return category ? guidelines.filter(g => g.category === category) : guidelines;
  }

  getSecurityReviews(projectName?: string): SecurityReview[] {
    const reviews = Array.from(this.reviews.values());
    return projectName ? reviews.filter(r => r.projectName === projectName) : reviews;
  }

  getDeveloperTraining(): DeveloperTraining[] {
    return Array.from(this.trainings.values());
  }

  getComplianceFrameworks(): ComplianceFramework[] {
    return Array.from(this.complianceFrameworks.values());
  }

  async shutdown(): Promise<void> {
    this.emit('shutdown');
    this.removeAllListeners();
  }
}

export default SecureDevelopmentPractices;
