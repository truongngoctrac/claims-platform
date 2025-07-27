import crypto from "crypto";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";

export interface ScanConfiguration {
  scanId: string;
  projectPath: string;
  includePatterns: string[];
  excludePatterns: string[];
  scanTypes: ScanType[];
  severity: "all" | "high_critical" | "critical_only";
  customRules?: SecurityRule[];
}

export interface ScanType {
  type:
    | "sast"
    | "dependency"
    | "secret"
    | "license"
    | "infrastructure"
    | "custom";
  enabled: boolean;
  configuration?: any;
}

export interface SecurityRule {
  ruleId: string;
  name: string;
  description: string;
  category:
    | "injection"
    | "xss"
    | "authentication"
    | "authorization"
    | "cryptography"
    | "configuration"
    | "custom";
  severity: "low" | "medium" | "high" | "critical";
  pattern: RegExp;
  messageTemplate: string;
  remediation: string;
  cweId?: string;
  owaspCategory?: string;
}

export interface ScanResult {
  scanId: string;
  projectPath: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalFiles: number;
  scannedFiles: number;
  vulnerabilities: Vulnerability[];
  summary: ScanSummary;
  metadata: ScanMetadata;
}

export interface Vulnerability {
  id: string;
  ruleId: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  file: string;
  line: number;
  column?: number;
  code: string;
  remediation: string;
  cweId?: string;
  owaspCategory?: string;
  confidence: "low" | "medium" | "high";
  impact: string;
  likelihood: string;
}

export interface ScanSummary {
  totalVulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  riskScore: number;
  topCategories: Array<{ category: string; count: number }>;
  filesWithIssues: number;
}

export interface ScanMetadata {
  scannerVersion: string;
  rulesVersion: string;
  language: string[];
  frameworks: string[];
  environment: string;
  ciIntegration: boolean;
}

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  description: string;
  severity: "high" | "critical";
  examples: string[];
}

export interface DependencyVulnerability {
  packageName: string;
  version: string;
  vulnerabilityId: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  cvssScore?: number;
  publishedDate: Date;
  fixedIn?: string;
  recommendation: string;
}

export class CodeSecurityScanner extends EventEmitter {
  private securityRules: Map<string, SecurityRule>;
  private secretPatterns: Map<string, SecretPattern>;
  private scanHistory: Map<string, ScanResult>;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.securityRules = new Map();
    this.secretPatterns = new Map();
    this.scanHistory = new Map();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadSecurityRules();
      await this.loadSecretPatterns();

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("initializationError", error);
      throw error;
    }
  }

  private async loadSecurityRules(): Promise<void> {
    const rules: SecurityRule[] = [
      // SQL Injection Rules
      {
        ruleId: "sql_injection_001",
        name: "SQL Injection via String Concatenation",
        description:
          "Potential SQL injection vulnerability through string concatenation",
        category: "injection",
        severity: "critical",
        pattern:
          /query\s*=\s*['"`].*\$\{.*\}.*['"`]|query\s*\+=?\s*['"`].*\+.*['"`]/gi,
        messageTemplate:
          "SQL query constructed using string concatenation. Use parameterized queries instead.",
        remediation:
          "Use parameterized queries or prepared statements to prevent SQL injection.",
        cweId: "CWE-89",
        owaspCategory: "A03:2021 - Injection",
      },
      {
        ruleId: "sql_injection_002",
        name: "Direct SQL Query with User Input",
        description:
          "SQL query directly incorporating user input without sanitization",
        category: "injection",
        severity: "critical",
        pattern: /\.query\(['"`][^'"`]*\$\{[^}]*\}[^'"`]*['"`]\)/gi,
        messageTemplate:
          "SQL query contains unsanitized user input. Use parameterized queries.",
        remediation:
          "Always use parameterized queries when incorporating user input into SQL statements.",
        cweId: "CWE-89",
        owaspCategory: "A03:2021 - Injection",
      },

      // XSS Rules
      {
        ruleId: "xss_001",
        name: "Potential XSS via innerHTML",
        description:
          "Using innerHTML with user data may lead to XSS vulnerabilities",
        category: "xss",
        severity: "high",
        pattern: /\.innerHTML\s*=\s*(?!['"`][^'"`]*['"`])[^;]+/gi,
        messageTemplate:
          "Setting innerHTML with user data may cause XSS. Use textContent or sanitize input.",
        remediation:
          "Use textContent for plain text or properly sanitize HTML content using a trusted library.",
        cweId: "CWE-79",
        owaspCategory: "A03:2021 - Injection",
      },

      // Authentication Rules
      {
        ruleId: "auth_001",
        name: "Hardcoded Credentials",
        description: "Hardcoded passwords or API keys detected",
        category: "authentication",
        severity: "critical",
        pattern:
          /(password|passwd|pwd|key|secret|token)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/gi,
        messageTemplate:
          "Hardcoded credentials detected. Use environment variables or secure vaults.",
        remediation:
          "Store credentials in environment variables or secure credential management systems.",
        cweId: "CWE-798",
        owaspCategory: "A07:2021 - Identification and Authentication Failures",
      },

      // Cryptography Rules
      {
        ruleId: "crypto_001",
        name: "Weak Cryptographic Algorithm",
        description: "Use of weak or deprecated cryptographic algorithms",
        category: "cryptography",
        severity: "high",
        pattern: /(MD5|SHA1|DES|3DES|RC4)\b/gi,
        messageTemplate:
          "Weak cryptographic algorithm detected. Use stronger alternatives like SHA-256 or AES.",
        remediation:
          "Replace weak algorithms: Use SHA-256+ for hashing, AES for encryption.",
        cweId: "CWE-327",
        owaspCategory: "A02:2021 - Cryptographic Failures",
      },

      // Authorization Rules
      {
        ruleId: "authz_001",
        name: "Missing Authorization Check",
        description: "API endpoint may be missing authorization checks",
        category: "authorization",
        severity: "high",
        pattern:
          /app\.(get|post|put|delete|patch)\(['"`][^'"`]*['"`]\s*,\s*(?!.*auth|.*login|.*public)[^,]*\s*,\s*(?:async\s+)?\([^)]*\)\s*=>/gi,
        messageTemplate:
          "API endpoint may lack authorization checks. Ensure proper access control.",
        remediation:
          "Add authorization middleware to verify user permissions before processing requests.",
        cweId: "CWE-862",
        owaspCategory: "A01:2021 - Broken Access Control",
      },

      // Configuration Rules
      {
        ruleId: "config_001",
        name: "Debug Mode in Production",
        description:
          "Debug mode enabled which may expose sensitive information",
        category: "configuration",
        severity: "medium",
        pattern: /debug\s*[:=]\s*true|DEBUG\s*=\s*true|development/gi,
        messageTemplate:
          "Debug mode detected. Ensure debug is disabled in production.",
        remediation:
          "Disable debug mode in production environments and use proper logging instead.",
        cweId: "CWE-489",
        owaspCategory: "A05:2021 - Security Misconfiguration",
      },
    ];

    for (const rule of rules) {
      this.securityRules.set(rule.ruleId, rule);
    }
  }

  private async loadSecretPatterns(): Promise<void> {
    const patterns: SecretPattern[] = [
      {
        name: "AWS Access Key",
        pattern: /AKIA[0-9A-Z]{16}/g,
        description: "AWS Access Key ID detected",
        severity: "critical",
        examples: ["AKIAIOSFODNN7EXAMPLE"],
      },
      {
        name: "AWS Secret Key",
        pattern: /[0-9a-zA-Z/+]{40}/g,
        description: "Potential AWS Secret Access Key",
        severity: "critical",
        examples: ["wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"],
      },
      {
        name: "GitHub Token",
        pattern: /ghp_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82}/g,
        description: "GitHub Personal Access Token detected",
        severity: "critical",
        examples: ["ghp_1234567890abcdef1234567890abcdef12345678"],
      },
      {
        name: "JWT Token",
        pattern: /eyJ[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*/g,
        description: "JSON Web Token detected",
        severity: "high",
        examples: [
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
        ],
      },
      {
        name: "Database Connection String",
        pattern:
          /(mysql|postgresql|mongodb):\/\/[^:\s]+:[^@\s]+@[^:\s]+:[0-9]+\/[^\s]+/gi,
        description: "Database connection string with credentials",
        severity: "critical",
        examples: ["mysql://user:password@localhost:3306/database"],
      },
      {
        name: "API Key Pattern",
        pattern: /api[_-]?key['":\s]*['"]\s*[0-9a-zA-Z_-]{20,}/gi,
        description: "Generic API key pattern detected",
        severity: "high",
        examples: ['api_key: "abc123def456ghi789jkl012mno345"'],
      },
    ];

    for (const pattern of patterns) {
      this.secretPatterns.set(pattern.name, pattern);
    }
  }

  async scanProject(config: ScanConfiguration): Promise<string> {
    const startTime = new Date();

    try {
      this.emit("scanStarted", {
        scanId: config.scanId,
        projectPath: config.projectPath,
      });

      const files = await this.getFilesToScan(
        config.projectPath,
        config.includePatterns,
        config.excludePatterns,
      );
      const vulnerabilities: Vulnerability[] = [];

      let scannedFiles = 0;

      for (const file of files) {
        try {
          const fileContent = fs.readFileSync(file, "utf-8");
          const fileVulns = await this.scanFile(file, fileContent, config);
          vulnerabilities.push(...fileVulns);
          scannedFiles++;

          // Emit progress
          this.emit("scanProgress", {
            scanId: config.scanId,
            progress: (scannedFiles / files.length) * 100,
            currentFile: file,
          });
        } catch (error) {
          this.emit("fileScanError", { scanId: config.scanId, file, error });
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const scanResult: ScanResult = {
        scanId: config.scanId,
        projectPath: config.projectPath,
        startTime,
        endTime,
        duration,
        totalFiles: files.length,
        scannedFiles,
        vulnerabilities,
        summary: this.generateSummary(vulnerabilities, scannedFiles),
        metadata: {
          scannerVersion: "1.0.0",
          rulesVersion: "2024.1",
          language: this.detectLanguages(files),
          frameworks: this.detectFrameworks(vulnerabilities),
          environment: process.env.NODE_ENV || "unknown",
          ciIntegration: !!process.env.CI,
        },
      };

      this.scanHistory.set(config.scanId, scanResult);
      this.emit("scanCompleted", { scanId: config.scanId, result: scanResult });

      return config.scanId;
    } catch (error) {
      this.emit("scanError", { scanId: config.scanId, error });
      throw error;
    }
  }

  private async getFilesToScan(
    projectPath: string,
    includePatterns: string[],
    excludePatterns: string[],
  ): Promise<string[]> {
    const files: string[] = [];

    const walkDirectory = (dir: string) => {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip excluded directories
          if (!excludePatterns.some((pattern) => fullPath.includes(pattern))) {
            walkDirectory(fullPath);
          }
        } else if (stat.isFile()) {
          // Include files that match include patterns and don't match exclude patterns
          const shouldInclude = includePatterns.some(
            (pattern) =>
              fullPath.endsWith(pattern) || fullPath.includes(pattern),
          );
          const shouldExclude = excludePatterns.some((pattern) =>
            fullPath.includes(pattern),
          );

          if (shouldInclude && !shouldExclude) {
            files.push(fullPath);
          }
        }
      }
    };

    walkDirectory(projectPath);
    return files;
  }

  private async scanFile(
    filePath: string,
    content: string,
    config: ScanConfiguration,
  ): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    const lines = content.split("\n");

    // SAST scanning
    if (config.scanTypes.some((t) => t.type === "sast" && t.enabled)) {
      for (const [ruleId, rule] of this.securityRules.entries()) {
        if (this.shouldApplyRule(rule, config.severity)) {
          const matches = content.matchAll(rule.pattern);

          for (const match of matches) {
            if (match.index !== undefined) {
              const lineNumber = this.getLineNumber(content, match.index);
              const lineContent = lines[lineNumber - 1] || "";

              vulnerabilities.push({
                id: crypto.randomUUID(),
                ruleId,
                category: rule.category,
                severity: rule.severity,
                title: rule.name,
                description: rule.description,
                file: filePath,
                line: lineNumber,
                column: this.getColumnNumber(content, match.index),
                code: lineContent.trim(),
                remediation: rule.remediation,
                cweId: rule.cweId,
                owaspCategory: rule.owaspCategory,
                confidence: this.calculateConfidence(
                  rule,
                  match[0],
                  lineContent,
                ),
                impact: this.calculateImpact(rule.severity),
                likelihood: this.calculateLikelihood(rule.category, filePath),
              });
            }
          }
        }
      }
    }

    // Secret scanning
    if (config.scanTypes.some((t) => t.type === "secret" && t.enabled)) {
      for (const [
        patternName,
        secretPattern,
      ] of this.secretPatterns.entries()) {
        const matches = content.matchAll(secretPattern.pattern);

        for (const match of matches) {
          if (match.index !== undefined) {
            const lineNumber = this.getLineNumber(content, match.index);
            const lineContent = lines[lineNumber - 1] || "";

            vulnerabilities.push({
              id: crypto.randomUUID(),
              ruleId: `secret_${patternName.toLowerCase().replace(/\s+/g, "_")}`,
              category: "authentication",
              severity: secretPattern.severity,
              title: `Hardcoded Secret: ${patternName}`,
              description: secretPattern.description,
              file: filePath,
              line: lineNumber,
              column: this.getColumnNumber(content, match.index),
              code: this.redactSecret(lineContent.trim()),
              remediation:
                "Remove hardcoded secrets and use environment variables or secure vaults",
              cweId: "CWE-798",
              owaspCategory:
                "A07:2021 - Identification and Authentication Failures",
              confidence: "high",
              impact: "Critical - Secrets can be used for unauthorized access",
              likelihood: "High - Secrets are easily discoverable in code",
            });
          }
        }
      }
    }

    return vulnerabilities;
  }

  private shouldApplyRule(rule: SecurityRule, severityFilter: string): boolean {
    switch (severityFilter) {
      case "critical_only":
        return rule.severity === "critical";
      case "high_critical":
        return rule.severity === "high" || rule.severity === "critical";
      case "all":
      default:
        return true;
    }
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split("\n").length;
  }

  private getColumnNumber(content: string, index: number): number {
    const lastNewline = content.lastIndexOf("\n", index);
    return index - lastNewline;
  }

  private calculateConfidence(
    rule: SecurityRule,
    match: string,
    context: string,
  ): "low" | "medium" | "high" {
    // Simple confidence calculation based on pattern specificity and context
    if (rule.category === "injection" && context.includes("sanitize")) {
      return "low"; // Might be mitigated
    }

    if (rule.severity === "critical" && match.length > 10) {
      return "high";
    }

    return "medium";
  }

  private calculateImpact(severity: string): string {
    const impacts = {
      critical: "Critical - Complete system compromise possible",
      high: "High - Significant security impact",
      medium: "Medium - Moderate security risk",
      low: "Low - Minor security concern",
    };

    return impacts[severity as keyof typeof impacts] || "Unknown impact";
  }

  private calculateLikelihood(category: string, filePath: string): string {
    const likelihoods = {
      injection: "High - Common attack vector",
      xss: "High - Frequently exploited",
      authentication: "High - Direct access to credentials",
      authorization: "Medium - Depends on endpoint exposure",
      cryptography: "Medium - Requires cryptographic knowledge",
      configuration: "Low - Environment dependent",
    };

    return (
      likelihoods[category as keyof typeof likelihoods] ||
      "Medium - Standard risk"
    );
  }

  private redactSecret(line: string): string {
    // Redact potential secrets while preserving context
    return line.replace(/['"`][^'"`]{8,}['"`]/g, '"[REDACTED]"');
  }

  private generateSummary(
    vulnerabilities: Vulnerability[],
    scannedFiles: number,
  ): ScanSummary {
    const criticalCount = vulnerabilities.filter(
      (v) => v.severity === "critical",
    ).length;
    const highCount = vulnerabilities.filter(
      (v) => v.severity === "high",
    ).length;
    const mediumCount = vulnerabilities.filter(
      (v) => v.severity === "medium",
    ).length;
    const lowCount = vulnerabilities.filter((v) => v.severity === "low").length;

    // Calculate risk score (0-100)
    const riskScore = Math.min(
      criticalCount * 25 + highCount * 10 + mediumCount * 5 + lowCount * 1,
      100,
    );

    // Get top categories
    const categoryCount = new Map<string, number>();
    vulnerabilities.forEach((v) => {
      categoryCount.set(v.category, (categoryCount.get(v.category) || 0) + 1);
    });

    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const filesWithIssues = new Set(vulnerabilities.map((v) => v.file)).size;

    return {
      totalVulnerabilities: vulnerabilities.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      riskScore,
      topCategories,
      filesWithIssues,
    };
  }

  private detectLanguages(files: string[]): string[] {
    const extensions = new Set<string>();
    files.forEach((file) => {
      const ext = path.extname(file).toLowerCase();
      if (ext) extensions.add(ext);
    });

    const languageMap: Record<string, string> = {
      ".ts": "TypeScript",
      ".js": "JavaScript",
      ".tsx": "React TypeScript",
      ".jsx": "React JavaScript",
      ".py": "Python",
      ".java": "Java",
      ".cs": "C#",
      ".php": "PHP",
      ".rb": "Ruby",
      ".go": "Go",
      ".rs": "Rust",
      ".cpp": "C++",
      ".c": "C",
    };

    return Array.from(extensions)
      .map((ext) => languageMap[ext])
      .filter(Boolean);
  }

  private detectFrameworks(vulnerabilities: Vulnerability[]): string[] {
    const frameworks = new Set<string>();

    vulnerabilities.forEach((vuln) => {
      if (vuln.file.includes("react") || vuln.code.includes("React")) {
        frameworks.add("React");
      }
      if (vuln.file.includes("express") || vuln.code.includes("app.get")) {
        frameworks.add("Express");
      }
      if (vuln.file.includes("angular") || vuln.code.includes("@Component")) {
        frameworks.add("Angular");
      }
      if (vuln.file.includes("vue") || vuln.code.includes("Vue")) {
        frameworks.add("Vue.js");
      }
      if (vuln.file.includes("next") || vuln.code.includes("Next")) {
        frameworks.add("Next.js");
      }
    });

    return Array.from(frameworks);
  }

  async generateReport(
    scanId: string,
    format: "json" | "sarif" | "html" | "csv" = "json",
  ): Promise<string> {
    const result = this.scanHistory.get(scanId);
    if (!result) {
      throw new Error(`Scan result not found: ${scanId}`);
    }

    switch (format) {
      case "json":
        return JSON.stringify(result, null, 2);

      case "sarif":
        return this.generateSarifReport(result);

      case "html":
        return this.generateHtmlReport(result);

      case "csv":
        return this.generateCsvReport(result);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private generateSarifReport(result: ScanResult): string {
    const sarif = {
      version: "2.1.0",
      $schema:
        "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
      runs: [
        {
          tool: {
            driver: {
              name: "Healthcare Security Scanner",
              version: result.metadata.scannerVersion,
              rules: Array.from(this.securityRules.values()).map((rule) => ({
                id: rule.ruleId,
                name: rule.name,
                shortDescription: { text: rule.description },
                fullDescription: { text: rule.description },
                defaultConfiguration: {
                  level: rule.severity === "critical" ? "error" : "warning",
                },
                properties: {
                  category: rule.category,
                  cwe: rule.cweId,
                  owasp: rule.owaspCategory,
                },
              })),
            },
          },
          results: result.vulnerabilities.map((vuln) => ({
            ruleId: vuln.ruleId,
            level: vuln.severity === "critical" ? "error" : "warning",
            message: { text: vuln.description },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: vuln.file },
                  region: {
                    startLine: vuln.line,
                    startColumn: vuln.column,
                    snippet: { text: vuln.code },
                  },
                },
              },
            ],
            properties: {
              impact: vuln.impact,
              likelihood: vuln.likelihood,
              confidence: vuln.confidence,
            },
          })),
        },
      ],
    };

    return JSON.stringify(sarif, null, 2);
  }

  private generateHtmlReport(result: ScanResult): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report - ${result.scanId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .vulnerability { background: white; margin: 10px 0; padding: 15px; border-left: 4px solid #ccc; }
        .critical { border-left-color: #dc3545; }
        .high { border-left-color: #fd7e14; }
        .medium { border-left-color: #ffc107; }
        .low { border-left-color: #28a745; }
        .code { background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Scan Report</h1>
        <p><strong>Scan ID:</strong> ${result.scanId}</p>
        <p><strong>Project:</strong> ${result.projectPath}</p>
        <p><strong>Completed:</strong> ${result.endTime.toISOString()}</p>
        <p><strong>Duration:</strong> ${result.duration}ms</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Vulnerabilities</h3>
            <p style="font-size: 24px; color: #dc3545;">${result.summary.totalVulnerabilities}</p>
        </div>
        <div class="metric">
            <h3>Risk Score</h3>
            <p style="font-size: 24px; color: #fd7e14;">${result.summary.riskScore}/100</p>
        </div>
        <div class="metric">
            <h3>Files Scanned</h3>
            <p style="font-size: 24px; color: #28a745;">${result.scannedFiles}</p>
        </div>
    </div>

    <h2>Vulnerability Breakdown</h2>
    <ul>
        <li>Critical: ${result.summary.criticalCount}</li>
        <li>High: ${result.summary.highCount}</li>
        <li>Medium: ${result.summary.mediumCount}</li>
        <li>Low: ${result.summary.lowCount}</li>
    </ul>

    <h2>Vulnerabilities</h2>
    ${result.vulnerabilities
      .map(
        (vuln) => `
        <div class="vulnerability ${vuln.severity}">
            <h3>${vuln.title} (${vuln.severity.toUpperCase()})</h3>
            <p><strong>File:</strong> ${vuln.file}:${vuln.line}</p>
            <p><strong>Description:</strong> ${vuln.description}</p>
            <p><strong>Code:</strong></p>
            <div class="code">${vuln.code}</div>
            <p><strong>Remediation:</strong> ${vuln.remediation}</p>
        </div>
    `,
      )
      .join("")}
</body>
</html>`;

    return html;
  }

  private generateCsvReport(result: ScanResult): string {
    const headers = [
      "ID",
      "Severity",
      "Category",
      "Title",
      "File",
      "Line",
      "Description",
      "Remediation",
    ];
    const rows = result.vulnerabilities.map((vuln) => [
      vuln.id,
      vuln.severity,
      vuln.category,
      vuln.title,
      vuln.file,
      vuln.line.toString(),
      vuln.description,
      vuln.remediation,
    ]);

    return [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
  }

  getScanResult(scanId: string): ScanResult | undefined {
    return this.scanHistory.get(scanId);
  }

  getAllScanResults(): ScanResult[] {
    return Array.from(this.scanHistory.values());
  }

  getSecurityRules(): SecurityRule[] {
    return Array.from(this.securityRules.values());
  }

  addCustomRule(rule: SecurityRule): void {
    this.securityRules.set(rule.ruleId, rule);
    this.emit("ruleAdded", { ruleId: rule.ruleId });
  }

  async shutdown(): Promise<void> {
    this.emit("shutdown");
    this.removeAllListeners();
  }
}

export default CodeSecurityScanner;
