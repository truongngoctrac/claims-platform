import crypto from "crypto";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";

export interface ContainerImage {
  imageId: string;
  repository: string;
  tag: string;
  digest: string;
  size: number;
  createdAt: Date;
  architecture: string;
  os: string;
  layers: ContainerLayer[];
  metadata: ImageMetadata;
}

export interface ContainerLayer {
  layerId: string;
  digest: string;
  size: number;
  command: string;
  createdAt: Date;
  vulnerabilities: ContainerVulnerability[];
}

export interface ImageMetadata {
  labels: Record<string, string>;
  env: Record<string, string>;
  exposedPorts: string[];
  workingDir: string;
  user: string;
  entrypoint: string[];
  cmd: string[];
  volumes: string[];
}

export interface ContainerVulnerability {
  id: string;
  packageName: string;
  packageVersion: string;
  vulnerabilityId: string;
  severity: "negligible" | "low" | "medium" | "high" | "critical";
  description: string;
  cvssScore?: number;
  cveId?: string;
  fixedInVersion?: string;
  layerId: string;
  packagePath: string;
}

export interface SecurityPolicy {
  policyId: string;
  name: string;
  description: string;
  rules: SecurityRule[];
  enforcement: "advisory" | "blocking";
  applicableImages: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityRule {
  ruleId: string;
  category:
    | "vulnerability"
    | "configuration"
    | "secret"
    | "compliance"
    | "runtime";
  check: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  remediation: string;
  parameters?: Record<string, any>;
}

export interface ScanConfiguration {
  scanId: string;
  imageRef: string;
  scanDepth: "surface" | "deep" | "comprehensive";
  includeSecrets: boolean;
  includeMalware: boolean;
  includeCompliance: boolean;
  policyIds?: string[];
  customRules?: SecurityRule[];
}

export interface ContainerScanResult {
  scanId: string;
  imageRef: string;
  scanTime: Date;
  duration: number;
  image: ContainerImage;
  vulnerabilities: ContainerVulnerability[];
  secrets: SecretFinding[];
  malware: MalwareFinding[];
  complianceFindings: ComplianceFinding[];
  configurationIssues: ConfigurationIssue[];
  riskScore: number;
  summary: ScanSummary;
  recommendations: string[];
}

export interface SecretFinding {
  id: string;
  type: "api_key" | "password" | "certificate" | "token" | "private_key";
  description: string;
  filePath: string;
  lineNumber?: number;
  entropy: number;
  confidence: "low" | "medium" | "high";
  layerId: string;
}

export interface MalwareFinding {
  id: string;
  filePath: string;
  malwareType: string;
  signature: string;
  confidence: "low" | "medium" | "high";
  layerId: string;
  quarantined: boolean;
}

export interface ComplianceFinding {
  id: string;
  standard: "CIS" | "NIST" | "PCI-DSS" | "SOC2" | "HIPAA";
  requirement: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "pass" | "fail" | "warning";
  remediation: string;
}

export interface ConfigurationIssue {
  id: string;
  category: "privilege" | "network" | "filesystem" | "resource" | "runtime";
  issue: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  remediation: string;
  dockerfileLocation?: string;
}

export interface ScanSummary {
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  mediumVulnerabilities: number;
  lowVulnerabilities: number;
  secretsFound: number;
  malwareDetected: number;
  complianceIssues: number;
  configurationIssues: number;
}

export interface RuntimeSecurityEvent {
  eventId: string;
  containerId: string;
  imageRef: string;
  eventType:
    | "file_access"
    | "network_connection"
    | "process_execution"
    | "privilege_escalation";
  timestamp: Date;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  details: Record<string, any>;
  blocked: boolean;
}

export class ContainerSecurityService extends EventEmitter {
  private securityPolicies: Map<string, SecurityPolicy>;
  private scanHistory: Map<string, ContainerScanResult>;
  private runtimeEvents: RuntimeSecurityEvent[];
  private knownSecretPatterns: Map<string, RegExp>;
  private malwareSignatures: Map<string, string>;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.securityPolicies = new Map();
    this.scanHistory = new Map();
    this.runtimeEvents = [];
    this.knownSecretPatterns = new Map();
    this.malwareSignatures = new Map();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.setupDefaultPolicies();
      await this.loadSecretPatterns();
      await this.loadMalwareSignatures();
      this.startRuntimeMonitoring();

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("initializationError", error);
      throw error;
    }
  }

  private async setupDefaultPolicies(): Promise<void> {
    const defaultPolicies: SecurityPolicy[] = [
      {
        policyId: "healthcare_baseline",
        name: "Healthcare Container Security Baseline",
        description: "Basic security requirements for healthcare containers",
        enforcement: "blocking",
        applicableImages: ["*"],
        createdAt: new Date(),
        updatedAt: new Date(),
        rules: [
          {
            ruleId: "no_root_user",
            category: "configuration",
            check: "user_not_root",
            severity: "high",
            description: "Container should not run as root user",
            remediation: "Set USER directive in Dockerfile to non-root user",
          },
          {
            ruleId: "no_privileged_mode",
            category: "configuration",
            check: "not_privileged",
            severity: "critical",
            description: "Container should not run in privileged mode",
            remediation: "Remove --privileged flag from container runtime",
          },
          {
            ruleId: "critical_vulnerabilities",
            category: "vulnerability",
            check: "max_critical_vulns",
            severity: "critical",
            description: "No critical vulnerabilities allowed",
            remediation: "Update packages to patched versions",
            parameters: { maxCount: 0 },
          },
          {
            ruleId: "no_secrets",
            category: "secret",
            check: "no_embedded_secrets",
            severity: "high",
            description: "No secrets should be embedded in container",
            remediation: "Use environment variables or secret management",
          },
          {
            ruleId: "readonly_filesystem",
            category: "configuration",
            check: "readonly_root_filesystem",
            severity: "medium",
            description: "Root filesystem should be read-only",
            remediation:
              "Set --read-only flag and use tmpfs for writable directories",
          },
        ],
      },
      {
        policyId: "hipaa_compliance",
        name: "HIPAA Container Compliance",
        description: "HIPAA-specific container security requirements",
        enforcement: "blocking",
        applicableImages: ["healthcare/*", "patient-data/*"],
        createdAt: new Date(),
        updatedAt: new Date(),
        rules: [
          {
            ruleId: "encryption_at_rest",
            category: "compliance",
            check: "encrypted_volumes",
            severity: "critical",
            description: "All volumes must be encrypted",
            remediation: "Use encrypted storage for all persistent volumes",
          },
          {
            ruleId: "audit_logging",
            category: "compliance",
            check: "audit_logs_enabled",
            severity: "high",
            description: "Audit logging must be enabled",
            remediation: "Configure audit logging for all container activities",
          },
          {
            ruleId: "network_segmentation",
            category: "configuration",
            check: "isolated_network",
            severity: "high",
            description: "Container must be in isolated network",
            remediation: "Use custom Docker networks for isolation",
          },
        ],
      },
    ];

    for (const policy of defaultPolicies) {
      this.securityPolicies.set(policy.policyId, policy);
    }
  }

  private async loadSecretPatterns(): Promise<void> {
    const patterns = new Map<string, RegExp>([
      ["aws_access_key", /AKIA[0-9A-Z]{16}/g],
      ["aws_secret_key", /[0-9a-zA-Z/+]{40}/g],
      ["github_token", /ghp_[0-9a-zA-Z]{36}/g],
      ["jwt_token", /eyJ[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*/g],
      ["api_key", /api[_-]?key['":\s]*['"]\s*[0-9a-zA-Z_-]{20,}/gi],
      ["password", /password['":\s]*['"]\s*[^\s'"{]{8,}/gi],
      ["private_key", /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g],
      ["certificate", /-----BEGIN\s+CERTIFICATE-----/g],
    ]);

    this.knownSecretPatterns = patterns;
  }

  private async loadMalwareSignatures(): Promise<void> {
    // Simplified malware signatures - in production use proper antivirus engines
    const signatures = new Map<string, string>([
      ["suspicious_script", "curl.*|.*sh"],
      ["crypto_miner", "xmrig|minerd|cpuminer"],
      ["backdoor", "nc.*-l.*-p|netcat.*listen"],
      ["rootkit", "chattr.*+i|mount.*-o.*bind"],
      ["malicious_download", "wget.*pastebin|curl.*githubusercontent"],
    ]);

    this.malwareSignatures = signatures;
  }

  async scanContainer(config: ScanConfiguration): Promise<string> {
    const scanTime = new Date();
    const startTime = Date.now();

    try {
      this.emit("scanStarted", {
        scanId: config.scanId,
        imageRef: config.imageRef,
      });

      // Simulate container image analysis
      const image = await this.analyzeContainerImage(config.imageRef);
      const vulnerabilities = await this.scanVulnerabilities(image, config);
      const secrets = config.includeSecrets
        ? await this.scanSecrets(image)
        : [];
      const malware = config.includeMalware
        ? await this.scanMalware(image)
        : [];
      const complianceFindings = config.includeCompliance
        ? await this.scanCompliance(image)
        : [];
      const configurationIssues = await this.scanConfiguration(image);

      const summary = this.generateScanSummary(
        vulnerabilities,
        secrets,
        malware,
        complianceFindings,
        configurationIssues,
      );

      const riskScore = this.calculateRiskScore(
        summary,
        vulnerabilities,
        configurationIssues,
      );
      const recommendations = this.generateRecommendations(
        summary,
        vulnerabilities,
        configurationIssues,
      );

      const result: ContainerScanResult = {
        scanId: config.scanId,
        imageRef: config.imageRef,
        scanTime,
        duration: Date.now() - startTime,
        image,
        vulnerabilities,
        secrets,
        malware,
        complianceFindings,
        configurationIssues,
        riskScore,
        summary,
        recommendations,
      };

      this.scanHistory.set(config.scanId, result);
      this.emit("scanCompleted", { scanId: config.scanId, result });

      return config.scanId;
    } catch (error) {
      this.emit("scanError", { scanId: config.scanId, error });
      throw error;
    }
  }

  private async analyzeContainerImage(
    imageRef: string,
  ): Promise<ContainerImage> {
    // Simulate container image analysis
    const [repository, tag] = imageRef.split(":");

    return {
      imageId: crypto.randomUUID(),
      repository,
      tag: tag || "latest",
      digest: "sha256:" + crypto.randomBytes(32).toString("hex"),
      size: Math.floor(Math.random() * 1000000000), // Random size
      createdAt: new Date(),
      architecture: "amd64",
      os: "linux",
      layers: await this.analyzeLayers(imageRef),
      metadata: {
        labels: {
          "org.opencontainers.image.source": "https://github.com/example/repo",
          "org.opencontainers.image.version": "1.0.0",
        },
        env: {
          PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
          NODE_ENV: "production",
        },
        exposedPorts: ["8080/tcp", "443/tcp"],
        workingDir: "/app",
        user: "appuser",
        entrypoint: ["node"],
        cmd: ["server.js"],
        volumes: ["/app/data"],
      },
    };
  }

  private async analyzeLayers(imageRef: string): Promise<ContainerLayer[]> {
    // Simulate layer analysis
    const layers: ContainerLayer[] = [];
    const layerCount = Math.floor(Math.random() * 10) + 5; // 5-15 layers

    for (let i = 0; i < layerCount; i++) {
      layers.push({
        layerId: crypto.randomUUID(),
        digest: "sha256:" + crypto.randomBytes(32).toString("hex"),
        size: Math.floor(Math.random() * 100000000),
        command: this.generateLayerCommand(i),
        createdAt: new Date(
          Date.now() - (layerCount - i) * 24 * 60 * 60 * 1000,
        ),
        vulnerabilities: [],
      });
    }

    return layers;
  }

  private generateLayerCommand(index: number): string {
    const commands = [
      "FROM node:16-alpine",
      "RUN apk add --no-cache curl",
      "WORKDIR /app",
      "COPY package*.json ./",
      "RUN npm install --production",
      "COPY . .",
      "RUN addgroup -g 1001 -S nodejs",
      "RUN adduser -S nextjs -u 1001",
      "USER nextjs",
      "EXPOSE 8080",
      'CMD ["node", "server.js"]',
    ];

    return commands[index % commands.length];
  }

  private async scanVulnerabilities(
    image: ContainerImage,
    config: ScanConfiguration,
  ): Promise<ContainerVulnerability[]> {
    const vulnerabilities: ContainerVulnerability[] = [];

    // Simulate vulnerability scanning
    const commonVulns = [
      {
        packageName: "openssl",
        packageVersion: "1.1.1f",
        vulnerabilityId: "CVE-2022-0778",
        severity: "high" as const,
        description:
          "Infinite loop in BN_mod_sqrt() reachable when parsing certificates",
        cvssScore: 7.5,
        cveId: "CVE-2022-0778",
        fixedInVersion: "1.1.1n",
      },
      {
        packageName: "curl",
        packageVersion: "7.68.0",
        vulnerabilityId: "CVE-2022-27774",
        severity: "medium" as const,
        description: "Credential leak in redirects",
        cvssScore: 5.7,
        cveId: "CVE-2022-27774",
        fixedInVersion: "7.83.0",
      },
      {
        packageName: "libgnutls30",
        packageVersion: "3.6.13",
        vulnerabilityId: "CVE-2021-20231",
        severity: "critical" as const,
        description: "Use after free in client sending key_share extension",
        cvssScore: 9.8,
        cveId: "CVE-2021-20231",
        fixedInVersion: "3.6.16",
      },
    ];

    for (const layer of image.layers) {
      for (const vuln of commonVulns) {
        if (Math.random() > 0.7) {
          // 30% chance of vulnerability in each layer
          vulnerabilities.push({
            id: crypto.randomUUID(),
            layerId: layer.layerId,
            packagePath: `/usr/lib/${vuln.packageName}`,
            ...vuln,
          });
        }
      }
    }

    return vulnerabilities;
  }

  private async scanSecrets(image: ContainerImage): Promise<SecretFinding[]> {
    const secrets: SecretFinding[] = [];

    // Simulate secret scanning in layers
    for (const layer of image.layers) {
      // Check if layer command contains potential secrets
      for (const [secretType, pattern] of this.knownSecretPatterns) {
        const matches = layer.command.matchAll(pattern);

        for (const match of matches) {
          secrets.push({
            id: crypto.randomUUID(),
            type: secretType as any,
            description: `Potential ${secretType} found in layer command`,
            filePath: "Dockerfile",
            entropy: this.calculateEntropy(match[0]),
            confidence: "medium",
            layerId: layer.layerId,
          });
        }
      }
    }

    // Simulate file system secret scanning
    if (Math.random() > 0.8) {
      // 20% chance of finding secrets in files
      secrets.push({
        id: crypto.randomUUID(),
        type: "api_key",
        description: "API key found in configuration file",
        filePath: "/app/config/secrets.json",
        lineNumber: 15,
        entropy: 4.2,
        confidence: "high",
        layerId: image.layers[image.layers.length - 1].layerId,
      });
    }

    return secrets;
  }

  private calculateEntropy(text: string): number {
    const charFreq = new Map<string, number>();

    for (const char of text) {
      charFreq.set(char, (charFreq.get(char) || 0) + 1);
    }

    let entropy = 0;
    for (const freq of charFreq.values()) {
      const probability = freq / text.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  private async scanMalware(image: ContainerImage): Promise<MalwareFinding[]> {
    const malware: MalwareFinding[] = [];

    // Simulate malware scanning
    for (const layer of image.layers) {
      for (const [malwareType, signature] of this.malwareSignatures) {
        if (layer.command.includes(signature.split("|")[0])) {
          malware.push({
            id: crypto.randomUUID(),
            filePath: "/tmp/suspicious_script.sh",
            malwareType,
            signature,
            confidence: "medium",
            layerId: layer.layerId,
            quarantined: false,
          });
        }
      }
    }

    return malware;
  }

  private async scanCompliance(
    image: ContainerImage,
  ): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check HIPAA compliance
    if (!image.metadata.env["ENCRYPT_DATA"]) {
      findings.push({
        id: crypto.randomUUID(),
        standard: "HIPAA",
        requirement: "164.312(a)(2)(iv)",
        description: "Data encryption not properly configured",
        severity: "critical",
        status: "fail",
        remediation:
          "Set ENCRYPT_DATA environment variable and implement encryption",
      });
    }

    // Check CIS Docker benchmark
    if (image.metadata.user === "root" || !image.metadata.user) {
      findings.push({
        id: crypto.randomUUID(),
        standard: "CIS",
        requirement: "4.1",
        description: "Container should not run as root",
        severity: "high",
        status: "fail",
        remediation:
          "Create non-root user and set USER directive in Dockerfile",
      });
    }

    return findings;
  }

  private async scanConfiguration(
    image: ContainerImage,
  ): Promise<ConfigurationIssue[]> {
    const issues: ConfigurationIssue[] = [];

    // Check for root user
    if (image.metadata.user === "root" || !image.metadata.user) {
      issues.push({
        id: crypto.randomUUID(),
        category: "privilege",
        issue: "Container runs as root user",
        severity: "high",
        description: "Running containers as root increases security risk",
        remediation: "Create and use a non-root user in Dockerfile",
        dockerfileLocation: "USER directive missing",
      });
    }

    // Check for excessive privileges
    if (image.metadata.labels["security.privileged"] === "true") {
      issues.push({
        id: crypto.randomUUID(),
        category: "privilege",
        issue: "Container runs in privileged mode",
        severity: "critical",
        description: "Privileged containers have unrestricted access to host",
        remediation:
          "Remove --privileged flag and use specific capabilities instead",
      });
    }

    // Check for exposed sensitive ports
    const sensitivePorts = ["22/tcp", "3389/tcp", "23/tcp"]; // SSH, RDP, Telnet
    for (const port of image.metadata.exposedPorts) {
      if (sensitivePorts.includes(port)) {
        issues.push({
          id: crypto.randomUUID(),
          category: "network",
          issue: `Sensitive port ${port} exposed`,
          severity: "medium",
          description: "Administrative ports should not be exposed",
          remediation: `Remove EXPOSE ${port} from Dockerfile or use secure alternatives`,
        });
      }
    }

    return issues;
  }

  private generateScanSummary(
    vulnerabilities: ContainerVulnerability[],
    secrets: SecretFinding[],
    malware: MalwareFinding[],
    complianceFindings: ComplianceFinding[],
    configurationIssues: ConfigurationIssue[],
  ): ScanSummary {
    return {
      totalVulnerabilities: vulnerabilities.length,
      criticalVulnerabilities: vulnerabilities.filter(
        (v) => v.severity === "critical",
      ).length,
      highVulnerabilities: vulnerabilities.filter((v) => v.severity === "high")
        .length,
      mediumVulnerabilities: vulnerabilities.filter(
        (v) => v.severity === "medium",
      ).length,
      lowVulnerabilities: vulnerabilities.filter((v) => v.severity === "low")
        .length,
      secretsFound: secrets.length,
      malwareDetected: malware.length,
      complianceIssues: complianceFindings.filter((f) => f.status === "fail")
        .length,
      configurationIssues: configurationIssues.length,
    };
  }

  private calculateRiskScore(
    summary: ScanSummary,
    vulnerabilities: ContainerVulnerability[],
    configurationIssues: ConfigurationIssue[],
  ): number {
    let score = 0;

    // Vulnerability scoring
    score += summary.criticalVulnerabilities * 25;
    score += summary.highVulnerabilities * 15;
    score += summary.mediumVulnerabilities * 10;
    score += summary.lowVulnerabilities * 5;

    // Secret scoring
    score += summary.secretsFound * 20;

    // Malware scoring
    score += summary.malwareDetected * 30;

    // Configuration issues
    const criticalConfigIssues = configurationIssues.filter(
      (i) => i.severity === "critical",
    ).length;
    const highConfigIssues = configurationIssues.filter(
      (i) => i.severity === "high",
    ).length;

    score += criticalConfigIssues * 20;
    score += highConfigIssues * 10;

    // Compliance issues
    score += summary.complianceIssues * 15;

    return Math.min(score, 100);
  }

  private generateRecommendations(
    summary: ScanSummary,
    vulnerabilities: ContainerVulnerability[],
    configurationIssues: ConfigurationIssue[],
  ): string[] {
    const recommendations: string[] = [];

    if (summary.criticalVulnerabilities > 0) {
      recommendations.push(
        `URGENT: Address ${summary.criticalVulnerabilities} critical vulnerabilities immediately`,
      );
    }

    if (summary.secretsFound > 0) {
      recommendations.push(
        "Remove embedded secrets and use secure secret management",
      );
    }

    if (summary.malwareDetected > 0) {
      recommendations.push(
        "Quarantine and rebuild container - malware detected",
      );
    }

    const rootUserIssue = configurationIssues.find((i) =>
      i.issue.includes("root"),
    );
    if (rootUserIssue) {
      recommendations.push("Configure container to run as non-root user");
    }

    if (vulnerabilities.length > 0) {
      const packagesToUpdate = new Set(
        vulnerabilities.map((v) => v.packageName),
      );
      recommendations.push(
        `Update packages: ${Array.from(packagesToUpdate).join(", ")}`,
      );
    }

    recommendations.push(
      "Implement container image scanning in CI/CD pipeline",
    );
    recommendations.push(
      "Use distroless or minimal base images to reduce attack surface",
    );

    return recommendations;
  }

  private startRuntimeMonitoring(): void {
    // Simulate runtime monitoring
    setInterval(() => {
      this.generateRuntimeEvent();
    }, 30000); // Every 30 seconds
  }

  private generateRuntimeEvent(): void {
    const eventTypes = [
      "file_access",
      "network_connection",
      "process_execution",
      "privilege_escalation",
    ];
    const severities = ["low", "medium", "high", "critical"];

    const event: RuntimeSecurityEvent = {
      eventId: crypto.randomUUID(),
      containerId: "container_" + Math.random().toString(36).substr(2, 9),
      imageRef: "healthcare/patient-api:latest",
      eventType: eventTypes[
        Math.floor(Math.random() * eventTypes.length)
      ] as any,
      timestamp: new Date(),
      severity: severities[
        Math.floor(Math.random() * severities.length)
      ] as any,
      description: "Suspicious runtime activity detected",
      details: {
        process: "/bin/sh",
        command: "cat /etc/passwd",
        user: "appuser",
      },
      blocked: Math.random() > 0.7, // 30% chance of being blocked
    };

    this.runtimeEvents.push(event);

    // Keep only last 1000 events
    if (this.runtimeEvents.length > 1000) {
      this.runtimeEvents = this.runtimeEvents.slice(-500);
    }

    if (event.severity === "critical" || event.severity === "high") {
      this.emit("criticalRuntimeEvent", event);
    }
  }

  async evaluatePolicy(
    imageRef: string,
    policyId: string,
  ): Promise<{
    compliant: boolean;
    violations: Array<{ rule: SecurityRule; finding: string }>;
  }> {
    const policy = this.securityPolicies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    // Check if policy applies to this image
    const imageMatches = policy.applicableImages.some(
      (pattern) =>
        pattern === "*" || imageRef.includes(pattern.replace("*", "")),
    );

    if (!imageMatches) {
      return { compliant: true, violations: [] };
    }

    // For this example, simulate policy evaluation
    const violations: Array<{ rule: SecurityRule; finding: string }> = [];

    for (const rule of policy.rules) {
      // Simulate rule evaluation
      if (Math.random() > 0.8) {
        // 20% chance of violation
        violations.push({
          rule,
          finding: `Rule ${rule.ruleId} violated: ${rule.description}`,
        });
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  getScanResult(scanId: string): ContainerScanResult | undefined {
    return this.scanHistory.get(scanId);
  }

  getAllScanResults(): ContainerScanResult[] {
    return Array.from(this.scanHistory.values());
  }

  getRuntimeEvents(filters?: {
    containerId?: string;
    severity?: string;
    eventType?: string;
    startTime?: Date;
    endTime?: Date;
  }): RuntimeSecurityEvent[] {
    let events = this.runtimeEvents;

    if (filters) {
      events = events.filter((event) => {
        if (filters.containerId && event.containerId !== filters.containerId)
          return false;
        if (filters.severity && event.severity !== filters.severity)
          return false;
        if (filters.eventType && event.eventType !== filters.eventType)
          return false;
        if (filters.startTime && event.timestamp < filters.startTime)
          return false;
        if (filters.endTime && event.timestamp > filters.endTime) return false;
        return true;
      });
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getSecurityPolicies(): SecurityPolicy[] {
    return Array.from(this.securityPolicies.values());
  }

  async createPolicy(
    policy: Omit<SecurityPolicy, "policyId" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const policyId = crypto.randomUUID();
    const newPolicy: SecurityPolicy = {
      ...policy,
      policyId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.securityPolicies.set(policyId, newPolicy);
    this.emit("policyCreated", { policyId, policy: newPolicy });

    return policyId;
  }

  async generateComplianceReport(scanId: string): Promise<string> {
    const result = this.scanHistory.get(scanId);
    if (!result) {
      throw new Error(`Scan result not found: ${scanId}`);
    }

    let report = `# Container Security Compliance Report\n\n`;
    report += `**Scan ID:** ${scanId}\n`;
    report += `**Image:** ${result.imageRef}\n`;
    report += `**Scan Time:** ${result.scanTime.toISOString()}\n`;
    report += `**Risk Score:** ${result.riskScore}/100\n\n`;

    report += `## Executive Summary\n`;
    report += `- Total Vulnerabilities: ${result.summary.totalVulnerabilities}\n`;
    report += `- Critical Issues: ${result.summary.criticalVulnerabilities}\n`;
    report += `- Secrets Found: ${result.summary.secretsFound}\n`;
    report += `- Compliance Issues: ${result.summary.complianceIssues}\n\n`;

    if (result.vulnerabilities.length > 0) {
      report += `## Security Vulnerabilities\n\n`;
      for (const vuln of result.vulnerabilities.slice(0, 10)) {
        report += `### ${vuln.packageName} - ${vuln.vulnerabilityId}\n`;
        report += `**Severity:** ${vuln.severity.toUpperCase()}\n`;
        report += `**CVSS Score:** ${vuln.cvssScore || "N/A"}\n`;
        report += `**Fixed In:** ${vuln.fixedInVersion || "Not available"}\n\n`;
      }
    }

    return report;
  }

  async shutdown(): Promise<void> {
    this.emit("shutdown");
    this.removeAllListeners();
  }
}

export default ContainerSecurityService;
