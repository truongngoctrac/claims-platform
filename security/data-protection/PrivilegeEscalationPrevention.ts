import crypto from "crypto";
import { EventEmitter } from "events";

export interface PrivilegeRequest {
  requestId: string;
  userId: string;
  requestedPrivileges: string[];
  currentPrivileges: string[];
  justification: string;
  urgency: "low" | "medium" | "high" | "emergency";
  requestedAt: Date;
  expiresAt?: Date;
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  approvedBy?: string;
  approvedAt?: Date;
  deniedReason?: string;
}

export interface EscalationRule {
  ruleId: string;
  name: string;
  description: string;
  fromPrivileges: string[];
  toPrivileges: string[];
  requiresApproval: boolean;
  approverRoles: string[];
  maxDuration: number; // in hours
  conditions: EscalationCondition[];
  isActive: boolean;
  riskScore: number;
}

export interface EscalationCondition {
  type:
    | "time_restriction"
    | "location_restriction"
    | "mfa_required"
    | "approval_chain"
    | "emergency_override";
  parameters: any;
  description: string;
}

export interface PrivilegeAuditEvent {
  eventId: string;
  userId: string;
  eventType:
    | "escalation_requested"
    | "escalation_granted"
    | "escalation_denied"
    | "privilege_used"
    | "privilege_revoked";
  privileges: string[];
  timestamp: Date;
  sourceIP: string;
  userAgent: string;
  sessionId: string;
  riskScore: number;
  justification?: string;
  approver?: string;
  automaticRevocation?: boolean;
}

export interface PrivilegeMonitoring {
  userId: string;
  privilegeLevel: string;
  normalBehaviorPattern: BehaviorPattern;
  currentActivity: ActivityMetrics;
  anomaliesDetected: AnomalyAlert[];
  lastReview: Date;
  nextReview: Date;
}

export interface BehaviorPattern {
  typicalAccessHours: number[];
  commonResources: string[];
  averageSessionDuration: number;
  typicalActions: string[];
  locationPatterns: string[];
}

export interface ActivityMetrics {
  sessionStartTime: Date;
  resourcesAccessed: string[];
  actionsPerformed: string[];
  currentLocation: string;
  deviceFingerprint: string;
}

export interface AnomalyAlert {
  alertId: string;
  type:
    | "unusual_time"
    | "unusual_location"
    | "excessive_privileges"
    | "suspicious_activity"
    | "privilege_abuse";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  detectedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  falsePositive?: boolean;
}

export interface EscalationMetrics {
  totalRequests: number;
  approvedRequests: number;
  deniedRequests: number;
  expiredRequests: number;
  emergencyEscalations: number;
  averageApprovalTime: number;
  anomaliesDetected: number;
  privilegeAbuses: number;
  automaticRevocations: number;
}

export class PrivilegeEscalationPrevention extends EventEmitter {
  private escalationRules: Map<string, EscalationRule>;
  private privilegeRequests: Map<string, PrivilegeRequest>;
  private auditEvents: PrivilegeAuditEvent[];
  private privilegeMonitoring: Map<string, PrivilegeMonitoring>;
  private metrics: EscalationMetrics;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.escalationRules = new Map();
    this.privilegeRequests = new Map();
    this.auditEvents = [];
    this.privilegeMonitoring = new Map();
    this.metrics = {
      totalRequests: 0,
      approvedRequests: 0,
      deniedRequests: 0,
      expiredRequests: 0,
      emergencyEscalations: 0,
      averageApprovalTime: 0,
      anomaliesDetected: 0,
      privilegeAbuses: 0,
      automaticRevocations: 0,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.setupDefaultEscalationRules();
      this.startPrivilegeMonitoring();
      this.startAutomaticCleanup();

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("initializationError", error);
      throw error;
    }
  }

  private async setupDefaultEscalationRules(): Promise<void> {
    const defaultRules: EscalationRule[] = [
      {
        ruleId: "patient_to_provider",
        name: "Patient to Healthcare Provider",
        description: "Escalation from patient role to healthcare provider role",
        fromPrivileges: ["patient_read", "patient_update"],
        toPrivileges: [
          "provider_read",
          "provider_write",
          "medical_records_access",
        ],
        requiresApproval: true,
        approverRoles: ["senior_provider", "department_head"],
        maxDuration: 8, // 8 hours
        conditions: [
          {
            type: "mfa_required",
            parameters: { mfa_level: "strong" },
            description: "Strong MFA authentication required",
          },
          {
            type: "time_restriction",
            parameters: { allowed_hours: [8, 18] },
            description: "Only allowed during business hours",
          },
        ],
        isActive: true,
        riskScore: 70,
      },
      {
        ruleId: "provider_to_admin",
        name: "Provider to Administrator",
        description: "Escalation from provider to administrative privileges",
        fromPrivileges: ["provider_read", "provider_write"],
        toPrivileges: ["admin_read", "admin_write", "system_config"],
        requiresApproval: true,
        approverRoles: ["system_admin", "security_officer"],
        maxDuration: 2, // 2 hours
        conditions: [
          {
            type: "approval_chain",
            parameters: { required_approvers: 2 },
            description: "Requires two-person approval",
          },
          {
            type: "location_restriction",
            parameters: { allowed_locations: ["office", "secure_facility"] },
            description: "Must be in secure location",
          },
        ],
        isActive: true,
        riskScore: 95,
      },
      {
        ruleId: "emergency_escalation",
        name: "Emergency Privilege Escalation",
        description: "Emergency escalation for critical situations",
        fromPrivileges: ["*"],
        toPrivileges: ["emergency_override", "critical_access"],
        requiresApproval: false,
        approverRoles: [],
        maxDuration: 1, // 1 hour
        conditions: [
          {
            type: "emergency_override",
            parameters: { emergency_code_required: true },
            description: "Valid emergency authorization code required",
          },
        ],
        isActive: true,
        riskScore: 100,
      },
    ];

    for (const rule of defaultRules) {
      this.escalationRules.set(rule.ruleId, rule);
    }
  }

  async requestPrivilegeEscalation(
    userId: string,
    requestedPrivileges: string[],
    currentPrivileges: string[],
    justification: string,
    urgency: "low" | "medium" | "high" | "emergency" = "medium",
    duration?: number,
  ): Promise<{
    requestId: string;
    requiresApproval: boolean;
    estimatedApprovalTime?: number;
  }> {
    try {
      const requestId = crypto.randomUUID();

      // Find applicable escalation rule
      const applicableRule = this.findApplicableRule(
        currentPrivileges,
        requestedPrivileges,
      );
      if (!applicableRule) {
        throw new Error(
          "No applicable escalation rule found for requested privileges",
        );
      }

      // Calculate expiration time
      const maxDuration = duration || applicableRule.maxDuration;
      const expiresAt = new Date(Date.now() + maxDuration * 60 * 60 * 1000);

      // Create privilege request
      const privilegeRequest: PrivilegeRequest = {
        requestId,
        userId,
        requestedPrivileges,
        currentPrivileges,
        justification,
        urgency,
        requestedAt: new Date(),
        expiresAt,
        status: applicableRule.requiresApproval ? "pending" : "approved",
      };

      this.privilegeRequests.set(requestId, privilegeRequest);
      this.metrics.totalRequests++;

      if (urgency === "emergency") {
        this.metrics.emergencyEscalations++;
      }

      // Log audit event
      this.logAuditEvent({
        eventType: "escalation_requested",
        userId,
        privileges: requestedPrivileges,
        justification,
        riskScore: applicableRule.riskScore,
      });

      // Handle emergency or auto-approved requests
      if (!applicableRule.requiresApproval || urgency === "emergency") {
        await this.processEscalationApproval(
          requestId,
          "system",
          "Auto-approved",
        );
      }

      this.emit("privilegeEscalationRequested", {
        requestId,
        userId,
        privileges: requestedPrivileges,
      });

      return {
        requestId,
        requiresApproval:
          applicableRule.requiresApproval && urgency !== "emergency",
        estimatedApprovalTime: this.estimateApprovalTime(
          urgency,
          applicableRule,
        ),
      };
    } catch (error) {
      this.emit("privilegeEscalationError", { userId, error });
      throw error;
    }
  }

  private findApplicableRule(
    currentPrivileges: string[],
    requestedPrivileges: string[],
  ): EscalationRule | null {
    for (const rule of this.escalationRules.values()) {
      if (!rule.isActive) continue;

      // Check if current privileges match the rule's from privileges
      const hasFromPrivileges =
        rule.fromPrivileges.includes("*") ||
        rule.fromPrivileges.some((priv) => currentPrivileges.includes(priv));

      if (!hasFromPrivileges) continue;

      // Check if requested privileges match the rule's to privileges
      const matchesToPrivileges =
        rule.toPrivileges.includes("*") ||
        requestedPrivileges.every((priv) => rule.toPrivileges.includes(priv));

      if (matchesToPrivileges) return rule;
    }

    return null;
  }

  async approvePrivilegeEscalation(
    requestId: string,
    approverId: string,
    comments?: string,
  ): Promise<boolean> {
    try {
      const request = this.privilegeRequests.get(requestId);
      if (!request) {
        throw new Error(`Privilege request not found: ${requestId}`);
      }

      if (request.status !== "pending") {
        throw new Error(`Request is not in pending status: ${request.status}`);
      }

      // Verify approver has the required role
      const rule = this.findApplicableRule(
        request.currentPrivileges,
        request.requestedPrivileges,
      );
      if (rule && rule.requiresApproval) {
        const isValidApprover = await this.validateApprover(
          approverId,
          rule.approverRoles,
        );
        if (!isValidApprover) {
          throw new Error(
            "Approver does not have required role for this escalation",
          );
        }
      }

      await this.processEscalationApproval(requestId, approverId, comments);
      return true;
    } catch (error) {
      this.emit("privilegeApprovalError", { requestId, approverId, error });
      throw error;
    }
  }

  async denyPrivilegeEscalation(
    requestId: string,
    approverId: string,
    reason: string,
  ): Promise<boolean> {
    try {
      const request = this.privilegeRequests.get(requestId);
      if (!request) {
        throw new Error(`Privilege request not found: ${requestId}`);
      }

      if (request.status !== "pending") {
        throw new Error(`Request is not in pending status: ${request.status}`);
      }

      request.status = "denied";
      request.deniedReason = reason;
      this.metrics.deniedRequests++;

      // Log audit event
      this.logAuditEvent({
        eventType: "escalation_denied",
        userId: request.userId,
        privileges: request.requestedPrivileges,
        approver: approverId,
        justification: reason,
        riskScore: 0,
      });

      this.emit("privilegeEscalationDenied", {
        requestId,
        userId: request.userId,
        reason,
      });
      return true;
    } catch (error) {
      this.emit("privilegeDenialError", { requestId, approverId, error });
      throw error;
    }
  }

  private async processEscalationApproval(
    requestId: string,
    approverId: string,
    comments?: string,
  ): Promise<void> {
    const request = this.privilegeRequests.get(requestId);
    if (!request) return;

    request.status = "approved";
    request.approvedBy = approverId;
    request.approvedAt = new Date();
    this.metrics.approvedRequests++;

    // Update approval time metrics
    if (request.approvedAt) {
      const approvalTime =
        request.approvedAt.getTime() - request.requestedAt.getTime();
      this.updateApprovalTimeMetrics(approvalTime);
    }

    // Schedule automatic revocation
    if (request.expiresAt) {
      this.scheduleAutomaticRevocation(requestId, request.expiresAt);
    }

    // Start monitoring the escalated privileges
    await this.startPrivilegeMonitoringForUser(
      request.userId,
      request.requestedPrivileges,
    );

    // Log audit event
    this.logAuditEvent({
      eventType: "escalation_granted",
      userId: request.userId,
      privileges: request.requestedPrivileges,
      approver: approverId,
      justification: comments || "Approved",
      riskScore: 50,
    });

    this.emit("privilegeEscalationApproved", {
      requestId,
      userId: request.userId,
      privileges: request.requestedPrivileges,
    });
  }

  private async validateApprover(
    approverId: string,
    requiredRoles: string[],
  ): Promise<boolean> {
    // In a real implementation, this would check the approver's roles against the required roles
    // For now, we'll simulate this validation
    return requiredRoles.length === 0 || Math.random() > 0.1; // 90% success rate for simulation
  }

  private estimateApprovalTime(urgency: string, rule: EscalationRule): number {
    const baseTime = {
      low: 4 * 60, // 4 hours
      medium: 2 * 60, // 2 hours
      high: 30, // 30 minutes
      emergency: 5, // 5 minutes
    };

    const riskMultiplier =
      rule.riskScore > 80 ? 2 : rule.riskScore > 60 ? 1.5 : 1;
    return (baseTime[urgency as keyof typeof baseTime] || 120) * riskMultiplier;
  }

  private scheduleAutomaticRevocation(
    requestId: string,
    expiresAt: Date,
  ): void {
    const timeout = expiresAt.getTime() - Date.now();

    setTimeout(
      async () => {
        await this.revokePrivilegeEscalation(
          requestId,
          "system",
          "Automatic expiration",
        );
      },
      Math.max(timeout, 0),
    );
  }

  async revokePrivilegeEscalation(
    requestId: string,
    revokedBy: string,
    reason: string,
  ): Promise<boolean> {
    try {
      const request = this.privilegeRequests.get(requestId);
      if (!request) {
        throw new Error(`Privilege request not found: ${requestId}`);
      }

      if (request.status !== "approved") {
        return false; // Already revoked or not approved
      }

      request.status = "revoked";

      if (revokedBy === "system") {
        this.metrics.automaticRevocations++;
      }

      // Stop monitoring
      this.stopPrivilegeMonitoringForUser(request.userId);

      // Log audit event
      this.logAuditEvent({
        eventType: "privilege_revoked",
        userId: request.userId,
        privileges: request.requestedPrivileges,
        approver: revokedBy,
        justification: reason,
        riskScore: 0,
        automaticRevocation: revokedBy === "system",
      });

      this.emit("privilegeEscalationRevoked", {
        requestId,
        userId: request.userId,
        reason,
      });
      return true;
    } catch (error) {
      this.emit("privilegeRevocationError", { requestId, revokedBy, error });
      throw error;
    }
  }

  private async startPrivilegeMonitoringForUser(
    userId: string,
    privileges: string[],
  ): Promise<void> {
    const monitoring: PrivilegeMonitoring = {
      userId,
      privilegeLevel: privileges.join(","),
      normalBehaviorPattern: await this.buildBehaviorPattern(userId),
      currentActivity: {
        sessionStartTime: new Date(),
        resourcesAccessed: [],
        actionsPerformed: [],
        currentLocation: "unknown",
        deviceFingerprint: "unknown",
      },
      anomaliesDetected: [],
      lastReview: new Date(),
      nextReview: new Date(Date.now() + 60 * 60 * 1000), // Next review in 1 hour
    };

    this.privilegeMonitoring.set(userId, monitoring);
  }

  private stopPrivilegeMonitoringForUser(userId: string): void {
    this.privilegeMonitoring.delete(userId);
  }

  private async buildBehaviorPattern(userId: string): Promise<BehaviorPattern> {
    // In a real implementation, this would analyze historical user behavior
    // For now, we'll return a mock pattern
    return {
      typicalAccessHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      commonResources: ["/patient/records", "/claims/view"],
      averageSessionDuration: 4 * 60 * 60 * 1000, // 4 hours
      typicalActions: ["read", "update"],
      locationPatterns: ["office", "hospital"],
    };
  }

  async detectAnomalies(
    userId: string,
    currentActivity: Partial<ActivityMetrics>,
  ): Promise<AnomalyAlert[]> {
    const monitoring = this.privilegeMonitoring.get(userId);
    if (!monitoring) return [];

    const anomalies: AnomalyAlert[] = [];
    const pattern = monitoring.normalBehaviorPattern;

    // Check time-based anomalies
    const currentHour = new Date().getHours();
    if (!pattern.typicalAccessHours.includes(currentHour)) {
      anomalies.push({
        alertId: crypto.randomUUID(),
        type: "unusual_time",
        severity: "medium",
        description: `User accessing system outside typical hours (${currentHour}:00)`,
        detectedAt: new Date(),
        resolved: false,
      });
    }

    // Check resource access anomalies
    if (currentActivity.resourcesAccessed) {
      const unusualResources = currentActivity.resourcesAccessed.filter(
        (resource) =>
          !pattern.commonResources.some((common) => resource.includes(common)),
      );

      if (unusualResources.length > 0) {
        anomalies.push({
          alertId: crypto.randomUUID(),
          type: "suspicious_activity",
          severity: "high",
          description: `User accessing unusual resources: ${unusualResources.join(", ")}`,
          detectedAt: new Date(),
          resolved: false,
        });
      }
    }

    // Check location anomalies
    if (
      currentActivity.currentLocation &&
      !pattern.locationPatterns.includes(currentActivity.currentLocation)
    ) {
      anomalies.push({
        alertId: crypto.randomUUID(),
        type: "unusual_location",
        severity: "high",
        description: `User accessing from unusual location: ${currentActivity.currentLocation}`,
        detectedAt: new Date(),
        resolved: false,
      });
    }

    // Update monitoring with detected anomalies
    monitoring.anomaliesDetected.push(...anomalies);
    this.metrics.anomaliesDetected += anomalies.length;

    // Emit alerts for critical anomalies
    const criticalAnomalies = anomalies.filter(
      (a) => a.severity === "critical",
    );
    if (criticalAnomalies.length > 0) {
      this.emit("criticalAnomalyDetected", {
        userId,
        anomalies: criticalAnomalies,
      });
    }

    return anomalies;
  }

  private logAuditEvent(
    eventData: Omit<
      PrivilegeAuditEvent,
      "eventId" | "timestamp" | "sourceIP" | "userAgent" | "sessionId"
    >,
  ): void {
    const auditEvent: PrivilegeAuditEvent = {
      eventId: crypto.randomUUID(),
      sourceIP: "unknown",
      userAgent: "unknown",
      sessionId: "unknown",
      timestamp: new Date(),
      ...eventData,
    };

    this.auditEvents.push(auditEvent);

    // Limit audit log size
    if (this.auditEvents.length > 50000) {
      this.auditEvents = this.auditEvents.slice(-25000);
    }

    this.emit("auditEventLogged", auditEvent);
  }

  private updateApprovalTimeMetrics(approvalTime: number): void {
    const approvedCount = this.metrics.approvedRequests;
    this.metrics.averageApprovalTime =
      (this.metrics.averageApprovalTime * (approvedCount - 1) + approvalTime) /
      approvedCount;
  }

  private startPrivilegeMonitoring(): void {
    setInterval(
      () => {
        this.performPeriodicMonitoring();
      },
      5 * 60 * 1000,
    ); // Every 5 minutes
  }

  private performPeriodicMonitoring(): void {
    for (const [userId, monitoring] of this.privilegeMonitoring.entries()) {
      // Check if review is due
      if (monitoring.nextReview <= new Date()) {
        this.performPrivilegeReview(userId);
      }

      // Check for prolonged sessions
      const sessionDuration =
        Date.now() - monitoring.currentActivity.sessionStartTime.getTime();
      if (
        sessionDuration >
        monitoring.normalBehaviorPattern.averageSessionDuration * 2
      ) {
        this.emit("prolongedSessionDetected", {
          userId,
          duration: sessionDuration,
        });
      }
    }
  }

  private async performPrivilegeReview(userId: string): Promise<void> {
    const monitoring = this.privilegeMonitoring.get(userId);
    if (!monitoring) return;

    // Update review times
    monitoring.lastReview = new Date();
    monitoring.nextReview = new Date(Date.now() + 60 * 60 * 1000); // Next review in 1 hour

    // Check for abuse patterns
    const suspiciousActivity = monitoring.anomaliesDetected.filter(
      (anomaly) =>
        !anomaly.resolved && anomaly.severity in ["high", "critical"],
    );

    if (suspiciousActivity.length > 3) {
      this.metrics.privilegeAbuses++;
      this.emit("privilegeAbuseDetected", {
        userId,
        anomalies: suspiciousActivity,
      });
    }
  }

  private startAutomaticCleanup(): void {
    setInterval(
      () => {
        this.cleanupExpiredRequests();
      },
      60 * 60 * 1000,
    ); // Every hour
  }

  private cleanupExpiredRequests(): void {
    const now = new Date();
    let expiredCount = 0;

    for (const [requestId, request] of this.privilegeRequests.entries()) {
      if (
        request.expiresAt &&
        request.expiresAt <= now &&
        request.status === "pending"
      ) {
        request.status = "expired";
        expiredCount++;
      }
    }

    this.metrics.expiredRequests += expiredCount;

    if (expiredCount > 0) {
      this.emit("requestsExpired", { count: expiredCount, timestamp: now });
    }
  }

  getPrivilegeRequests(filters?: {
    userId?: string;
    status?: string;
    urgency?: string;
  }): PrivilegeRequest[] {
    let requests = Array.from(this.privilegeRequests.values());

    if (filters) {
      if (filters.userId) {
        requests = requests.filter((req) => req.userId === filters.userId);
      }
      if (filters.status) {
        requests = requests.filter((req) => req.status === filters.status);
      }
      if (filters.urgency) {
        requests = requests.filter((req) => req.urgency === filters.urgency);
      }
    }

    return requests.sort(
      (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime(),
    );
  }

  getAuditEvents(filters?: {
    userId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
  }): PrivilegeAuditEvent[] {
    let events = this.auditEvents;

    if (filters) {
      events = events.filter((event) => {
        if (filters.userId && event.userId !== filters.userId) return false;
        if (filters.eventType && event.eventType !== filters.eventType)
          return false;
        if (filters.startDate && event.timestamp < filters.startDate)
          return false;
        if (filters.endDate && event.timestamp > filters.endDate) return false;
        return true;
      });
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getMetrics(): EscalationMetrics {
    return { ...this.metrics };
  }

  getMonitoringStatus(): Array<
    Omit<PrivilegeMonitoring, "normalBehaviorPattern">
  > {
    return Array.from(this.privilegeMonitoring.values()).map((monitoring) => {
      const { normalBehaviorPattern, ...status } = monitoring;
      return status;
    });
  }

  async shutdown(): Promise<void> {
    this.emit("shutdown");
    this.removeAllListeners();
  }
}

export default PrivilegeEscalationPrevention;
