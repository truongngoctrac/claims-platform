import crypto from "crypto";
import { EventEmitter } from "events";

export interface DLPPolicy {
  policyId: string;
  name: string;
  description: string;
  dataTypes: DataType[];
  channels: Channel[];
  actions: DLPAction[];
  severity: "low" | "medium" | "high" | "critical";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataType {
  type: "pii" | "phi" | "financial" | "confidential" | "custom";
  patterns: RegExp[];
  keywords: string[];
  contextualRules: ContextRule[];
  sensitivity: number; // 1-10
}

export interface ContextRule {
  field: string;
  condition: "contains" | "equals" | "matches" | "near";
  value: string;
  distance?: number; // for 'near' condition
}

export interface Channel {
  type:
    | "email"
    | "file_transfer"
    | "api"
    | "database"
    | "print"
    | "usb"
    | "cloud_upload";
  endpoint?: string;
  protocols: string[];
  monitoring: boolean;
}

export interface DLPAction {
  type: "block" | "quarantine" | "redact" | "encrypt" | "alert" | "log";
  parameters?: any;
  priority: number;
}

export interface DataClassification {
  content: string;
  classificationLevel: "public" | "internal" | "confidential" | "restricted";
  identifiedDataTypes: IdentifiedDataType[];
  riskScore: number;
  recommendedActions: string[];
}

export interface IdentifiedDataType {
  type: string;
  matches: DataMatch[];
  confidence: number;
  context: string;
}

export interface DataMatch {
  value: string;
  position: number;
  length: number;
  pattern: string;
  redacted?: string;
}

export interface DLPIncident {
  incidentId: string;
  userId: string;
  channel: string;
  dataTypes: string[];
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  detectedAt: Date;
  status: "open" | "investigating" | "resolved" | "false_positive";
  actionsTaken: string[];
  assignedTo?: string;
  resolvedAt?: Date;
  evidence: IncidentEvidence[];
}

export interface IncidentEvidence {
  type: "content_sample" | "metadata" | "user_activity" | "system_logs";
  data: any;
  timestamp: Date;
  source: string;
}

export interface DLPMetrics {
  totalScans: number;
  threatsDetected: number;
  threatsBlocked: number;
  falsePositives: number;
  dataTypesDetected: Map<string, number>;
  channelsMonitored: Map<string, number>;
  averageResponseTime: number;
  policyViolations: number;
}

export interface WatermarkConfig {
  enabled: boolean;
  type: "visible" | "invisible" | "digital";
  content: string;
  position: "top" | "bottom" | "center" | "corner";
  opacity: number;
}

export class DataLeakagePreventionService extends EventEmitter {
  private dlpPolicies: Map<string, DLPPolicy>;
  private incidents: Map<string, DLPIncident>;
  private dataClassificationCache: Map<string, DataClassification>;
  private metrics: DLPMetrics;
  private watermarkConfig: WatermarkConfig;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.dlpPolicies = new Map();
    this.incidents = new Map();
    this.dataClassificationCache = new Map();
    this.metrics = {
      totalScans: 0,
      threatsDetected: 0,
      threatsBlocked: 0,
      falsePositives: 0,
      dataTypesDetected: new Map(),
      channelsMonitored: new Map(),
      averageResponseTime: 0,
      policyViolations: 0,
    };
    this.watermarkConfig = {
      enabled: true,
      type: "invisible",
      content: "CONFIDENTIAL - HEALTHCARE DATA",
      position: "corner",
      opacity: 0.1,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.setupDefaultPolicies();
      this.startContinuousMonitoring();
      this.startMetricsCollection();

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("initializationError", error);
      throw error;
    }
  }

  private async setupDefaultPolicies(): Promise<void> {
    const defaultPolicies: DLPPolicy[] = [
      {
        policyId: "hipaa_phi_protection",
        name: "HIPAA PHI Protection",
        description:
          "Protects Protected Health Information according to HIPAA requirements",
        dataTypes: [
          {
            type: "phi",
            patterns: [
              /\b\d{3}-\d{2}-\d{4}\b/, // SSN
              /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/, // Credit card
              /\b[A-Z0-9]{10,15}\b/, // Medical record numbers
              /\b(?:patient|diagnosis|treatment|medical)\s+(?:id|number|code)\s*:?\s*[A-Z0-9\-]+/i,
            ],
            keywords: [
              "patient",
              "diagnosis",
              "treatment",
              "medical record",
              "health information",
            ],
            contextualRules: [
              {
                field: "subject",
                condition: "contains",
                value: "medical",
              },
              {
                field: "department",
                condition: "equals",
                value: "healthcare",
              },
            ],
            sensitivity: 9,
          },
        ],
        channels: [
          {
            type: "email",
            protocols: ["smtp", "pop3", "imap"],
            monitoring: true,
          },
          {
            type: "file_transfer",
            protocols: ["ftp", "sftp", "scp"],
            monitoring: true,
          },
          {
            type: "cloud_upload",
            protocols: ["https"],
            monitoring: true,
          },
        ],
        actions: [
          {
            type: "block",
            priority: 1,
          },
          {
            type: "alert",
            parameters: { recipients: ["security@healthcare.com"] },
            priority: 2,
          },
          {
            type: "log",
            priority: 3,
          },
        ],
        severity: "critical",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        policyId: "financial_data_protection",
        name: "Financial Data Protection",
        description: "Protects financial and payment information",
        dataTypes: [
          {
            type: "financial",
            patterns: [
              /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/, // Credit cards
              /\b\d{9}\b/, // Routing numbers
              /\b(?:account|acct)\s*(?:number|#|num)\s*:?\s*[0-9\-]+/i,
            ],
            keywords: [
              "credit card",
              "account number",
              "bank",
              "payment",
              "billing",
            ],
            contextualRules: [
              {
                field: "filename",
                condition: "contains",
                value: "payment",
              },
            ],
            sensitivity: 8,
          },
        ],
        channels: [
          {
            type: "email",
            protocols: ["smtp"],
            monitoring: true,
          },
          {
            type: "api",
            protocols: ["https"],
            monitoring: true,
          },
        ],
        actions: [
          {
            type: "redact",
            priority: 1,
          },
          {
            type: "alert",
            priority: 2,
          },
        ],
        severity: "high",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const policy of defaultPolicies) {
      this.dlpPolicies.set(policy.policyId, policy);
    }
  }

  async scanContent(
    content: string,
    metadata: {
      userId: string;
      channel: string;
      filename?: string;
      destination?: string;
      headers?: any;
    },
  ): Promise<{
    allowed: boolean;
    classification: DataClassification;
    actionsApplied: string[];
    incidentId?: string;
  }> {
    const startTime = Date.now();

    try {
      this.metrics.totalScans++;
      this.updateChannelMetrics(metadata.channel);

      // Classify the content
      const classification = await this.classifyContent(content, metadata);

      // Check cache first
      const cacheKey = this.generateCacheKey(content, metadata);
      const cachedResult = this.dataClassificationCache.get(cacheKey);

      if (cachedResult && this.isCacheValid(cachedResult)) {
        return {
          allowed: true,
          classification: cachedResult,
          actionsApplied: [],
        };
      }

      // Apply DLP policies
      const policyResults = await this.evaluatePolicies(
        classification,
        metadata,
      );

      let allowed = true;
      const actionsApplied: string[] = [];
      let incidentId: string | undefined;

      // Process policy violations
      if (policyResults.violations.length > 0) {
        this.metrics.threatsDetected++;
        this.metrics.policyViolations++;

        // Create incident
        incidentId = await this.createIncident(
          classification,
          metadata,
          policyResults.violations,
        );

        // Apply actions
        for (const violation of policyResults.violations) {
          const policy = this.dlpPolicies.get(violation.policyId);
          if (!policy) continue;

          for (const action of policy.actions.sort(
            (a, b) => a.priority - b.priority,
          )) {
            const actionResult = await this.applyAction(
              action,
              content,
              classification,
              metadata,
            );
            actionsApplied.push(`${action.type}: ${actionResult.message}`);

            if (action.type === "block") {
              allowed = false;
              this.metrics.threatsBlocked++;
            }
          }
        }
      }

      // Cache the classification result
      this.dataClassificationCache.set(cacheKey, classification);

      // Update metrics
      this.updateResponseTime(Date.now() - startTime);
      this.updateDataTypeMetrics(classification.identifiedDataTypes);

      this.emit("contentScanned", {
        userId: metadata.userId,
        channel: metadata.channel,
        classification,
        allowed,
        actionsApplied,
        incidentId,
      });

      return {
        allowed,
        classification,
        actionsApplied,
        incidentId,
      };
    } catch (error) {
      this.emit("scanError", { metadata, error });
      throw error;
    }
  }

  private async classifyContent(
    content: string,
    metadata: any,
  ): Promise<DataClassification> {
    const identifiedDataTypes: IdentifiedDataType[] = [];
    let riskScore = 0;

    // Scan against all data type patterns
    for (const policy of this.dlpPolicies.values()) {
      if (!policy.isActive) continue;

      for (const dataType of policy.dataTypes) {
        const matches = await this.findDataMatches(content, dataType);

        if (matches.length > 0) {
          identifiedDataTypes.push({
            type: dataType.type,
            matches,
            confidence: this.calculateConfidence(matches, dataType, content),
            context: this.extractContext(content, matches),
          });

          riskScore += dataType.sensitivity * matches.length;
        }
      }
    }

    // Determine classification level
    let classificationLevel:
      | "public"
      | "internal"
      | "confidential"
      | "restricted" = "public";

    if (riskScore > 50) {
      classificationLevel = "restricted";
    } else if (riskScore > 30) {
      classificationLevel = "confidential";
    } else if (riskScore > 10) {
      classificationLevel = "internal";
    }

    // Generate recommendations
    const recommendedActions = this.generateRecommendations(
      identifiedDataTypes,
      riskScore,
    );

    return {
      content: content.substring(0, 500), // Store sample only
      classificationLevel,
      identifiedDataTypes,
      riskScore: Math.min(riskScore, 100),
      recommendedActions,
    };
  }

  private async findDataMatches(
    content: string,
    dataType: DataType,
  ): Promise<DataMatch[]> {
    const matches: DataMatch[] = [];

    // Check patterns
    for (const pattern of dataType.patterns) {
      const patternMatches = content.matchAll(new RegExp(pattern, "gi"));

      for (const match of patternMatches) {
        if (match.index !== undefined) {
          matches.push({
            value: match[0],
            position: match.index,
            length: match[0].length,
            pattern: pattern.source,
          });
        }
      }
    }

    // Check keywords in context
    for (const keyword of dataType.keywords) {
      const keywordRegex = new RegExp(`\\b${keyword}\\b`, "gi");
      const keywordMatches = content.matchAll(keywordRegex);

      for (const match of keywordMatches) {
        if (match.index !== undefined) {
          matches.push({
            value: match[0],
            position: match.index,
            length: match[0].length,
            pattern: `keyword:${keyword}`,
          });
        }
      }
    }

    return matches;
  }

  private calculateConfidence(
    matches: DataMatch[],
    dataType: DataType,
    content: string,
  ): number {
    let confidence = 0;

    // Base confidence from pattern matches
    const patternMatches = matches.filter(
      (m) => !m.pattern.startsWith("keyword:"),
    );
    confidence += patternMatches.length * 30;

    // Contextual confidence
    for (const rule of dataType.contextualRules) {
      if (this.evaluateContextRule(rule, content)) {
        confidence += 20;
      }
    }

    // Keyword density
    const keywordMatches = matches.filter((m) =>
      m.pattern.startsWith("keyword:"),
    );
    const keywordDensity = keywordMatches.length / content.split(" ").length;
    confidence += keywordDensity * 100;

    return Math.min(confidence, 100);
  }

  private evaluateContextRule(rule: ContextRule, content: string): boolean {
    const field = rule.field.toLowerCase();

    // Simplified context evaluation
    switch (rule.condition) {
      case "contains":
        return content.toLowerCase().includes(rule.value.toLowerCase());
      case "equals":
        return content.toLowerCase() === rule.value.toLowerCase();
      case "matches":
        return new RegExp(rule.value, "i").test(content);
      case "near":
        // Check if terms appear within specified distance
        const distance = rule.distance || 50;
        const terms = rule.value.split(",").map((t) => t.trim());
        return this.areTermsNear(content, terms, distance);
      default:
        return false;
    }
  }

  private areTermsNear(
    content: string,
    terms: string[],
    maxDistance: number,
  ): boolean {
    const positions = [];

    for (const term of terms) {
      const regex = new RegExp(`\\b${term}\\b`, "gi");
      const matches = content.matchAll(regex);

      for (const match of matches) {
        if (match.index !== undefined) {
          positions.push(match.index);
        }
      }
    }

    // Check if any terms are within maxDistance of each other
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        if (Math.abs(positions[i] - positions[j]) <= maxDistance) {
          return true;
        }
      }
    }

    return false;
  }

  private extractContext(content: string, matches: DataMatch[]): string {
    if (matches.length === 0) return "";

    // Extract context around the first match
    const match = matches[0];
    const start = Math.max(0, match.position - 50);
    const end = Math.min(content.length, match.position + match.length + 50);

    return content.substring(start, end);
  }

  private generateRecommendations(
    dataTypes: IdentifiedDataType[],
    riskScore: number,
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore > 70) {
      recommendations.push(
        "Consider encrypting this content before transmission",
      );
      recommendations.push(
        "Verify recipient has proper clearance for this data",
      );
    }

    if (dataTypes.some((dt) => dt.type === "phi")) {
      recommendations.push("HIPAA compliance review required");
      recommendations.push("Ensure business associate agreement is in place");
    }

    if (dataTypes.some((dt) => dt.type === "financial")) {
      recommendations.push("PCI DSS compliance check required");
      recommendations.push("Consider tokenizing financial data");
    }

    if (riskScore > 30) {
      recommendations.push("Apply data retention policy");
      recommendations.push("Enable audit logging for this transaction");
    }

    return recommendations;
  }

  private async evaluatePolicies(
    classification: DataClassification,
    metadata: any,
  ): Promise<{
    violations: Array<{ policyId: string; severity: string; reason: string }>;
  }> {
    const violations = [];

    for (const policy of this.dlpPolicies.values()) {
      if (!policy.isActive) continue;

      // Check if policy applies to this channel
      const channelMatch = policy.channels.some(
        (channel) => channel.type === metadata.channel && channel.monitoring,
      );

      if (!channelMatch) continue;

      // Check if any identified data types match policy data types
      const dataTypeMatch = classification.identifiedDataTypes.some(
        (identified) =>
          policy.dataTypes.some(
            (policyDataType) =>
              policyDataType.type === identified.type ||
              policyDataType.type === "custom",
          ),
      );

      if (dataTypeMatch) {
        violations.push({
          policyId: policy.policyId,
          severity: policy.severity,
          reason: `Detected ${classification.identifiedDataTypes.map((dt) => dt.type).join(", ")} in ${metadata.channel}`,
        });
      }
    }

    return { violations };
  }

  private async applyAction(
    action: DLPAction,
    content: string,
    classification: DataClassification,
    metadata: any,
  ): Promise<{ success: boolean; message: string; modifiedContent?: string }> {
    try {
      switch (action.type) {
        case "block":
          return {
            success: true,
            message: "Content blocked due to policy violation",
          };

        case "quarantine":
          return {
            success: true,
            message: "Content quarantined for review",
          };

        case "redact":
          const redactedContent = await this.redactSensitiveData(
            content,
            classification,
          );
          return {
            success: true,
            message: "Sensitive data redacted",
            modifiedContent: redactedContent,
          };

        case "encrypt":
          const encryptedContent = await this.encryptContent(content);
          return {
            success: true,
            message: "Content encrypted",
            modifiedContent: encryptedContent,
          };

        case "alert":
          await this.sendAlert(classification, metadata, action.parameters);
          return {
            success: true,
            message: "Security alert sent",
          };

        case "log":
          await this.logSecurityEvent(classification, metadata);
          return {
            success: true,
            message: "Security event logged",
          };

        default:
          return {
            success: false,
            message: `Unknown action type: ${action.type}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Action failed: ${error.message}`,
      };
    }
  }

  private async redactSensitiveData(
    content: string,
    classification: DataClassification,
  ): Promise<string> {
    let redactedContent = content;

    for (const dataType of classification.identifiedDataTypes) {
      for (const match of dataType.matches) {
        // Replace with appropriate redaction
        const redactionPattern = this.getRedactionPattern(
          dataType.type,
          match.value,
        );
        redactedContent = redactedContent.replace(
          match.value,
          redactionPattern,
        );
        match.redacted = redactionPattern;
      }
    }

    return redactedContent;
  }

  private getRedactionPattern(dataType: string, originalValue: string): string {
    switch (dataType) {
      case "phi":
        return "[REDACTED-PHI]";
      case "financial":
        return "[REDACTED-FINANCIAL]";
      case "pii":
        return "[REDACTED-PII]";
      default:
        return "*".repeat(originalValue.length);
    }
  }

  private async encryptContent(content: string): Promise<string> {
    const algorithm = "aes-256-gcm";
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipherGCM(algorithm, key, iv);

    let encrypted = cipher.update(content, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    // In practice, you'd need to securely store/transmit the key
    return `ENCRYPTED:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  }

  private async sendAlert(
    classification: DataClassification,
    metadata: any,
    parameters: any,
  ): Promise<void> {
    const alertData = {
      timestamp: new Date(),
      severity: this.determineSeverity(classification.riskScore),
      userId: metadata.userId,
      channel: metadata.channel,
      dataTypes: classification.identifiedDataTypes.map((dt) => dt.type),
      riskScore: classification.riskScore,
      destination: metadata.destination,
    };

    // Send to configured recipients
    if (parameters?.recipients) {
      this.emit("securityAlert", {
        alertData,
        recipients: parameters.recipients,
      });
    } else {
      this.emit("securityAlert", { alertData });
    }
  }

  private async logSecurityEvent(
    classification: DataClassification,
    metadata: any,
  ): Promise<void> {
    const securityEvent = {
      timestamp: new Date(),
      eventType: "dlp_scan",
      userId: metadata.userId,
      channel: metadata.channel,
      classification,
      metadata,
    };

    this.emit("securityEventLogged", securityEvent);
  }

  private determineSeverity(
    riskScore: number,
  ): "low" | "medium" | "high" | "critical" {
    if (riskScore > 80) return "critical";
    if (riskScore > 60) return "high";
    if (riskScore > 30) return "medium";
    return "low";
  }

  private async createIncident(
    classification: DataClassification,
    metadata: any,
    violations: Array<{ policyId: string; severity: string; reason: string }>,
  ): Promise<string> {
    const incidentId = crypto.randomUUID();

    const incident: DLPIncident = {
      incidentId,
      userId: metadata.userId,
      channel: metadata.channel,
      dataTypes: classification.identifiedDataTypes.map((dt) => dt.type),
      severity: this.determineSeverity(classification.riskScore),
      description: `Data leakage detected: ${violations.map((v) => v.reason).join("; ")}`,
      detectedAt: new Date(),
      status: "open",
      actionsTaken: [],
      evidence: [
        {
          type: "content_sample",
          data: classification,
          timestamp: new Date(),
          source: "dlp_scanner",
        },
        {
          type: "metadata",
          data: metadata,
          timestamp: new Date(),
          source: "dlp_scanner",
        },
      ],
    };

    this.incidents.set(incidentId, incident);
    this.emit("incidentCreated", { incidentId, incident });

    return incidentId;
  }

  private generateCacheKey(content: string, metadata: any): string {
    const contentHash = crypto
      .createHash("sha256")
      .update(content)
      .digest("hex");
    const metadataHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(metadata))
      .digest("hex");
    return `${contentHash}:${metadataHash}`;
  }

  private isCacheValid(classification: DataClassification): boolean {
    // Cache is valid for 1 hour
    return true; // Simplified for demo
  }

  private updateChannelMetrics(channel: string): void {
    const current = this.metrics.channelsMonitored.get(channel) || 0;
    this.metrics.channelsMonitored.set(channel, current + 1);
  }

  private updateDataTypeMetrics(dataTypes: IdentifiedDataType[]): void {
    for (const dataType of dataTypes) {
      const current = this.metrics.dataTypesDetected.get(dataType.type) || 0;
      this.metrics.dataTypesDetected.set(dataType.type, current + 1);
    }
  }

  private updateResponseTime(responseTime: number): void {
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.totalScans - 1) +
        responseTime) /
      this.metrics.totalScans;
  }

  private startContinuousMonitoring(): void {
    // Monitor file system changes
    setInterval(
      () => {
        this.performFileSystemScan();
      },
      5 * 60 * 1000,
    ); // Every 5 minutes

    // Monitor network traffic
    setInterval(() => {
      this.performNetworkScan();
    }, 60 * 1000); // Every minute
  }

  private performFileSystemScan(): void {
    // Simplified file system monitoring
    this.emit("fileSystemScanStarted");
  }

  private performNetworkScan(): void {
    // Simplified network monitoring
    this.emit("networkScanStarted");
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.emit("metricsReport", this.getMetrics());
    }, 60000); // Every minute
  }

  async addWatermark(
    content: string,
    type: "text" | "pdf" | "image" = "text",
  ): Promise<string> {
    if (!this.watermarkConfig.enabled) return content;

    const watermark = `\n\n--- ${this.watermarkConfig.content} ---\n`;

    switch (type) {
      case "text":
        return content + watermark;
      case "pdf":
        // In practice, use a PDF library to add watermarks
        return content + watermark;
      case "image":
        // In practice, use an image processing library
        return content;
      default:
        return content + watermark;
    }
  }

  getMetrics(): DLPMetrics {
    return {
      totalScans: this.metrics.totalScans,
      threatsDetected: this.metrics.threatsDetected,
      threatsBlocked: this.metrics.threatsBlocked,
      falsePositives: this.metrics.falsePositives,
      dataTypesDetected: new Map(this.metrics.dataTypesDetected),
      channelsMonitored: new Map(this.metrics.channelsMonitored),
      averageResponseTime: this.metrics.averageResponseTime,
      policyViolations: this.metrics.policyViolations,
    };
  }

  getIncidents(filters?: {
    userId?: string;
    severity?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): DLPIncident[] {
    let incidents = Array.from(this.incidents.values());

    if (filters) {
      incidents = incidents.filter((incident) => {
        if (filters.userId && incident.userId !== filters.userId) return false;
        if (filters.severity && incident.severity !== filters.severity)
          return false;
        if (filters.status && incident.status !== filters.status) return false;
        if (filters.startDate && incident.detectedAt < filters.startDate)
          return false;
        if (filters.endDate && incident.detectedAt > filters.endDate)
          return false;
        return true;
      });
    }

    return incidents.sort(
      (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime(),
    );
  }

  async updateIncidentStatus(
    incidentId: string,
    status: "open" | "investigating" | "resolved" | "false_positive",
    assignedTo?: string,
    notes?: string,
  ): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    incident.status = status;
    incident.assignedTo = assignedTo;

    if (status === "resolved" || status === "false_positive") {
      incident.resolvedAt = new Date();

      if (status === "false_positive") {
        this.metrics.falsePositives++;
      }
    }

    this.emit("incidentUpdated", { incidentId, status, assignedTo });
  }

  async shutdown(): Promise<void> {
    this.emit("shutdown");
    this.removeAllListeners();
  }
}

export default DataLeakagePreventionService;
