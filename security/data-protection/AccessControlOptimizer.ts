import crypto from "crypto";
import { EventEmitter } from "events";

export interface AccessPolicy {
  policyId: string;
  name: string;
  description: string;
  effect: "allow" | "deny";
  resources: string[];
  actions: string[];
  principals: string[];
  conditions?: AccessCondition[];
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface AccessCondition {
  type: "time" | "location" | "device" | "mfa" | "risk_score" | "custom";
  operator:
    | "equals"
    | "not_equals"
    | "in"
    | "not_in"
    | "greater_than"
    | "less_than"
    | "contains";
  key: string;
  value: any;
  description?: string;
}

export interface RoleDefinition {
  roleId: string;
  name: string;
  description: string;
  permissions: Permission[];
  inheritedRoles: string[];
  isBuiltIn: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: AccessCondition[];
  effect: "allow" | "deny";
}

export interface UserAccessProfile {
  userId: string;
  roles: string[];
  directPermissions: Permission[];
  temporaryAccess: TemporaryAccess[];
  accessLevel: "minimal" | "standard" | "elevated" | "administrative";
  lastAccess: Date;
  failedAttempts: number;
  isLocked: boolean;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
}

export interface TemporaryAccess {
  id: string;
  resource: string;
  actions: string[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt: Date;
  reason: string;
  isActive: boolean;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  matchedPolicies: string[];
  evaluationTime: number;
  riskScore: number;
  recommendations?: string[];
}

export interface AccessAuditLog {
  logId: string;
  userId: string;
  resource: string;
  action: string;
  decision: "allow" | "deny";
  timestamp: Date;
  sourceIP: string;
  userAgent: string;
  sessionId: string;
  riskScore: number;
  additionalContext?: any;
}

export interface AccessMetrics {
  totalAccessRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  averageEvaluationTime: number;
  topAccessedResources: Map<string, number>;
  failedLoginAttempts: number;
  lockedAccounts: number;
  policiesEvaluated: number;
}

export class AccessControlOptimizer extends EventEmitter {
  private policies: Map<string, AccessPolicy>;
  private roles: Map<string, RoleDefinition>;
  private userProfiles: Map<string, UserAccessProfile>;
  private auditLogs: AccessAuditLog[];
  private metrics: AccessMetrics;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.policies = new Map();
    this.roles = new Map();
    this.userProfiles = new Map();
    this.auditLogs = [];
    this.metrics = {
      totalAccessRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      averageEvaluationTime: 0,
      topAccessedResources: new Map(),
      failedLoginAttempts: 0,
      lockedAccounts: 0,
      policiesEvaluated: 0,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.setupDefaultRoles();
      await this.setupDefaultPolicies();
      this.startMetricsCollection();
      this.startCleanupSchedule();

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("initializationError", error);
      throw error;
    }
  }

  private async setupDefaultRoles(): Promise<void> {
    const defaultRoles: RoleDefinition[] = [
      {
        roleId: "patient",
        name: "Patient",
        description: "Basic patient access to their own health records",
        permissions: [
          {
            resource: "/patient/profile/*",
            actions: ["read", "update"],
            effect: "allow",
          },
          {
            resource: "/patient/claims/*",
            actions: ["read", "create"],
            effect: "allow",
          },
        ],
        inheritedRoles: [],
        isBuiltIn: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        roleId: "healthcare_provider",
        name: "Healthcare Provider",
        description: "Healthcare professional with patient data access",
        permissions: [
          {
            resource: "/patient/medical-records/*",
            actions: ["read", "create", "update"],
            effect: "allow",
          },
          {
            resource: "/claims/medical/*",
            actions: ["read", "create", "update"],
            effect: "allow",
          },
        ],
        inheritedRoles: [],
        isBuiltIn: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        roleId: "claims_adjuster",
        name: "Claims Adjuster",
        description: "Insurance claims processing specialist",
        permissions: [
          {
            resource: "/claims/*",
            actions: ["read", "update", "approve", "deny"],
            effect: "allow",
          },
          {
            resource: "/patient/basic-info/*",
            actions: ["read"],
            effect: "allow",
          },
        ],
        inheritedRoles: [],
        isBuiltIn: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        roleId: "system_admin",
        name: "System Administrator",
        description: "Full system administration access",
        permissions: [
          {
            resource: "*",
            actions: ["*"],
            effect: "allow",
          },
        ],
        inheritedRoles: [],
        isBuiltIn: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const role of defaultRoles) {
      this.roles.set(role.roleId, role);
    }
  }

  private async setupDefaultPolicies(): Promise<void> {
    const defaultPolicies: AccessPolicy[] = [
      {
        policyId: "hipaa_compliance",
        name: "HIPAA Compliance Policy",
        description: "Ensures HIPAA compliance for patient data access",
        effect: "allow",
        resources: ["/patient/medical-records/*", "/patient/phi/*"],
        actions: ["read", "create", "update"],
        principals: ["healthcare_provider", "claims_adjuster"],
        conditions: [
          {
            type: "mfa",
            operator: "equals",
            key: "mfa_enabled",
            value: true,
            description: "Multi-factor authentication required",
          },
          {
            type: "time",
            operator: "in",
            key: "business_hours",
            value: ["08:00-18:00"],
            description: "Access only during business hours",
          },
        ],
        priority: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "system",
      },
      {
        policyId: "emergency_access",
        name: "Emergency Access Policy",
        description: "Emergency access to critical patient data",
        effect: "allow",
        resources: ["/patient/emergency-info/*", "/patient/critical-alerts/*"],
        actions: ["read"],
        principals: ["healthcare_provider"],
        conditions: [
          {
            type: "custom",
            operator: "equals",
            key: "emergency_flag",
            value: true,
            description: "Emergency access flag must be set",
          },
        ],
        priority: 200,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "system",
      },
      {
        policyId: "data_retention",
        name: "Data Retention Policy",
        description: "Restricts access to archived data",
        effect: "deny",
        resources: ["/patient/archived-records/*"],
        actions: ["delete"],
        principals: ["*"],
        conditions: [
          {
            type: "time",
            operator: "less_than",
            key: "retention_period",
            value: 7,
            description: "Cannot delete data within retention period",
          },
        ],
        priority: 50,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "system",
      },
    ];

    for (const policy of defaultPolicies) {
      this.policies.set(policy.policyId, policy);
    }
  }

  async evaluateAccess(
    userId: string,
    resource: string,
    action: string,
    context?: any,
  ): Promise<AccessDecision> {
    const startTime = Date.now();

    try {
      this.metrics.totalAccessRequests++;

      const userProfile = this.userProfiles.get(userId);
      if (!userProfile) {
        this.logAccess(userId, resource, action, "deny", startTime, context);
        return {
          allowed: false,
          reason: "User profile not found",
          matchedPolicies: [],
          evaluationTime: Date.now() - startTime,
          riskScore: 100,
          recommendations: ["Verify user exists in the system"],
        };
      }

      if (userProfile.isLocked) {
        this.logAccess(userId, resource, action, "deny", startTime, context);
        return {
          allowed: false,
          reason: "User account is locked",
          matchedPolicies: [],
          evaluationTime: Date.now() - startTime,
          riskScore: 100,
          recommendations: ["Contact administrator to unlock account"],
        };
      }

      // Calculate risk score
      const riskScore = await this.calculateRiskScore(
        userId,
        resource,
        action,
        context,
      );

      // Evaluate policies
      const { allowed, matchedPolicies, reason } = await this.evaluatePolicies(
        userProfile,
        resource,
        action,
        context,
        riskScore,
      );

      // Update metrics
      if (allowed) {
        this.metrics.allowedRequests++;
      } else {
        this.metrics.deniedRequests++;
      }

      this.updateResourceMetrics(resource);
      this.updateEvaluationTime(Date.now() - startTime);

      // Log access attempt
      this.logAccess(
        userId,
        resource,
        action,
        allowed ? "allow" : "deny",
        startTime,
        context,
      );

      return {
        allowed,
        reason,
        matchedPolicies,
        evaluationTime: Date.now() - startTime,
        riskScore,
        recommendations: this.generateRecommendations(
          allowed,
          reason,
          riskScore,
        ),
      };
    } catch (error) {
      this.emit("accessEvaluationError", { userId, resource, action, error });
      this.logAccess(userId, resource, action, "deny", startTime, context);

      return {
        allowed: false,
        reason: "Access evaluation failed",
        matchedPolicies: [],
        evaluationTime: Date.now() - startTime,
        riskScore: 100,
        recommendations: ["Contact system administrator"],
      };
    }
  }

  private async evaluatePolicies(
    userProfile: UserAccessProfile,
    resource: string,
    action: string,
    context: any,
    riskScore: number,
  ): Promise<{ allowed: boolean; matchedPolicies: string[]; reason: string }> {
    const applicablePolicies: AccessPolicy[] = [];
    const matchedPolicies: string[] = [];

    // Find applicable policies
    for (const policy of this.policies.values()) {
      if (!policy.isActive) continue;

      // Check if policy applies to user's roles or direct assignment
      const hasAccess = this.checkPrincipalAccess(
        userProfile,
        policy.principals,
      );
      if (!hasAccess) continue;

      // Check if policy applies to resource
      const resourceMatches = this.matchResource(resource, policy.resources);
      if (!resourceMatches) continue;

      // Check if policy applies to action
      const actionMatches =
        policy.actions.includes("*") || policy.actions.includes(action);
      if (!actionMatches) continue;

      // Evaluate conditions
      const conditionsPass = await this.evaluateConditions(
        policy.conditions || [],
        context,
        riskScore,
      );
      if (!conditionsPass) continue;

      applicablePolicies.push(policy);
      matchedPolicies.push(policy.policyId);
      this.metrics.policiesEvaluated++;
    }

    // Sort by priority (higher priority first)
    applicablePolicies.sort((a, b) => b.priority - a.priority);

    // Apply first matching policy (highest priority)
    if (applicablePolicies.length > 0) {
      const topPolicy = applicablePolicies[0];
      return {
        allowed: topPolicy.effect === "allow",
        matchedPolicies,
        reason: `${topPolicy.effect} by policy: ${topPolicy.name}`,
      };
    }

    // Default deny if no policies match
    return {
      allowed: false,
      matchedPolicies,
      reason: "No applicable policies found - default deny",
    };
  }

  private checkPrincipalAccess(
    userProfile: UserAccessProfile,
    principals: string[],
  ): boolean {
    // Check for wildcard
    if (principals.includes("*")) return true;

    // Check user roles
    for (const roleId of userProfile.roles) {
      if (principals.includes(roleId)) return true;
    }

    // Check direct user assignment
    if (principals.includes(userProfile.userId)) return true;

    return false;
  }

  private matchResource(resource: string, policyResources: string[]): boolean {
    for (const policyResource of policyResources) {
      if (policyResource === "*") return true;

      // Handle wildcard patterns
      if (policyResource.endsWith("/*")) {
        const prefix = policyResource.slice(0, -2);
        if (resource.startsWith(prefix)) return true;
      } else if (policyResource === resource) {
        return true;
      }
    }
    return false;
  }

  private async evaluateConditions(
    conditions: AccessCondition[],
    context: any,
    riskScore: number,
  ): Promise<boolean> {
    for (const condition of conditions) {
      const conditionMet = await this.evaluateCondition(
        condition,
        context,
        riskScore,
      );
      if (!conditionMet) return false;
    }

    return true;
  }

  private async evaluateCondition(
    condition: AccessCondition,
    context: any,
    riskScore: number,
  ): Promise<boolean> {
    let contextValue: any;

    switch (condition.type) {
      case "time":
        contextValue = this.getCurrentTimeContext();
        break;
      case "location":
        contextValue = context?.location || context?.sourceIP;
        break;
      case "device":
        contextValue = context?.userAgent || context?.deviceId;
        break;
      case "mfa":
        contextValue = context?.mfaVerified || false;
        break;
      case "risk_score":
        contextValue = riskScore;
        break;
      case "custom":
        contextValue = context?.[condition.key];
        break;
      default:
        contextValue = context?.[condition.key];
    }

    return this.evaluateConditionOperator(
      condition.operator,
      contextValue,
      condition.value,
    );
  }

  private evaluateConditionOperator(
    operator: string,
    contextValue: any,
    conditionValue: any,
  ): boolean {
    switch (operator) {
      case "equals":
        return contextValue === conditionValue;
      case "not_equals":
        return contextValue !== conditionValue;
      case "in":
        return (
          Array.isArray(conditionValue) && conditionValue.includes(contextValue)
        );
      case "not_in":
        return (
          Array.isArray(conditionValue) &&
          !conditionValue.includes(contextValue)
        );
      case "greater_than":
        return Number(contextValue) > Number(conditionValue);
      case "less_than":
        return Number(contextValue) < Number(conditionValue);
      case "contains":
        return String(contextValue).includes(String(conditionValue));
      default:
        return false;
    }
  }

  private getCurrentTimeContext(): any {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, "0");
    const minute = now.getMinutes().toString().padStart(2, "0");
    const currentTime = `${hour}:${minute}`;

    return {
      current_time: currentTime,
      day_of_week: now.getDay(),
      is_business_hours: this.isBusinessHours(now),
    };
  }

  private isBusinessHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay();

    // Monday to Friday, 8 AM to 6 PM
    return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
  }

  private async calculateRiskScore(
    userId: string,
    resource: string,
    action: string,
    context: any,
  ): Promise<number> {
    let riskScore = 0;

    const userProfile = this.userProfiles.get(userId);
    if (!userProfile) return 100;

    // Recent failed attempts
    if (userProfile.failedAttempts > 0) {
      riskScore += userProfile.failedAttempts * 10;
    }

    // Time-based risk
    const now = new Date();
    if (!this.isBusinessHours(now)) {
      riskScore += 20;
    }

    // Location-based risk (simplified)
    if (context?.sourceIP && !this.isTrustedIP(context.sourceIP)) {
      riskScore += 30;
    }

    // Resource sensitivity
    if (resource.includes("medical-records") || resource.includes("phi")) {
      riskScore += 20;
    }

    // Action risk
    if (["delete", "admin", "export"].includes(action)) {
      riskScore += 25;
    }

    // MFA status
    if (!userProfile.mfaEnabled) {
      riskScore += 15;
    }

    return Math.min(riskScore, 100);
  }

  private isTrustedIP(ip: string): boolean {
    // Simplified trusted IP check
    const trustedRanges = ["192.168.", "10.0.", "172.16."];
    return trustedRanges.some((range) => ip.startsWith(range));
  }

  private generateRecommendations(
    allowed: boolean,
    reason: string,
    riskScore: number,
  ): string[] {
    const recommendations: string[] = [];

    if (!allowed) {
      recommendations.push(
        "Contact your administrator if you believe this is an error",
      );

      if (reason.includes("locked")) {
        recommendations.push("Account may be locked due to security concerns");
      }

      if (riskScore > 70) {
        recommendations.push(
          "High risk score detected - ensure you are accessing from a trusted location",
        );
      }
    }

    if (riskScore > 50) {
      recommendations.push(
        "Consider enabling multi-factor authentication for enhanced security",
      );
    }

    return recommendations;
  }

  private logAccess(
    userId: string,
    resource: string,
    action: string,
    decision: "allow" | "deny",
    startTime: number,
    context: any,
  ): void {
    const auditLog: AccessAuditLog = {
      logId: crypto.randomUUID(),
      userId,
      resource,
      action,
      decision,
      timestamp: new Date(),
      sourceIP: context?.sourceIP || "unknown",
      userAgent: context?.userAgent || "unknown",
      sessionId: context?.sessionId || "unknown",
      riskScore: context?.riskScore || 0,
      additionalContext: context,
    };

    this.auditLogs.push(auditLog);

    // Limit audit log size
    if (this.auditLogs.length > 100000) {
      this.auditLogs = this.auditLogs.slice(-50000);
    }

    this.emit("accessLogged", auditLog);
  }

  private updateResourceMetrics(resource: string): void {
    const current = this.metrics.topAccessedResources.get(resource) || 0;
    this.metrics.topAccessedResources.set(resource, current + 1);
  }

  private updateEvaluationTime(time: number): void {
    this.metrics.averageEvaluationTime =
      (this.metrics.averageEvaluationTime *
        (this.metrics.totalAccessRequests - 1) +
        time) /
      this.metrics.totalAccessRequests;
  }

  async createPolicy(
    policy: Omit<AccessPolicy, "policyId" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const policyId = crypto.randomUUID();
    const newPolicy: AccessPolicy = {
      ...policy,
      policyId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.policies.set(policyId, newPolicy);
    this.emit("policyCreated", { policyId, policy: newPolicy });

    return policyId;
  }

  async updatePolicy(
    policyId: string,
    updates: Partial<AccessPolicy>,
  ): Promise<void> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    const updatedPolicy = {
      ...policy,
      ...updates,
      updatedAt: new Date(),
    };

    this.policies.set(policyId, updatedPolicy);
    this.emit("policyUpdated", { policyId, policy: updatedPolicy });
  }

  async createUserProfile(
    profile: Omit<
      UserAccessProfile,
      "lastAccess" | "failedAttempts" | "isLocked"
    >,
  ): Promise<void> {
    const userProfile: UserAccessProfile = {
      ...profile,
      lastAccess: new Date(),
      failedAttempts: 0,
      isLocked: false,
    };

    this.userProfiles.set(profile.userId, userProfile);
    this.emit("userProfileCreated", { userId: profile.userId });
  }

  async grantTemporaryAccess(
    userId: string,
    resource: string,
    actions: string[],
    expiresInHours: number,
    grantedBy: string,
    reason: string,
  ): Promise<string> {
    const userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      throw new Error(`User profile not found: ${userId}`);
    }

    const tempAccess: TemporaryAccess = {
      id: crypto.randomUUID(),
      resource,
      actions,
      grantedBy,
      grantedAt: new Date(),
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      reason,
      isActive: true,
    };

    userProfile.temporaryAccess.push(tempAccess);
    this.emit("temporaryAccessGranted", { userId, tempAccess });

    return tempAccess.id;
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.emit("metricsReport", this.getMetrics());
    }, 60000); // Every minute
  }

  private startCleanupSchedule(): void {
    // Clean up old audit logs and expired temporary access
    setInterval(
      () => {
        this.cleanupExpiredData();
      },
      24 * 60 * 60 * 1000,
    ); // Daily
  }

  private cleanupExpiredData(): void {
    // Remove old audit logs (keep last 30 days)
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.auditLogs = this.auditLogs.filter((log) => log.timestamp > cutoffDate);

    // Remove expired temporary access
    for (const userProfile of this.userProfiles.values()) {
      userProfile.temporaryAccess = userProfile.temporaryAccess.filter(
        (access) => access.expiresAt > new Date(),
      );
    }

    this.emit("expiredDataCleaned", { timestamp: new Date() });
  }

  getMetrics(): AccessMetrics {
    return {
      totalAccessRequests: this.metrics.totalAccessRequests,
      allowedRequests: this.metrics.allowedRequests,
      deniedRequests: this.metrics.deniedRequests,
      averageEvaluationTime: this.metrics.averageEvaluationTime,
      topAccessedResources: new Map(this.metrics.topAccessedResources),
      failedLoginAttempts: this.metrics.failedLoginAttempts,
      lockedAccounts: this.metrics.lockedAccounts,
      policiesEvaluated: this.metrics.policiesEvaluated,
    };
  }

  getAuditLogs(filters?: {
    userId?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    decision?: "allow" | "deny";
  }): AccessAuditLog[] {
    let logs = this.auditLogs;

    if (filters) {
      logs = logs.filter((log) => {
        if (filters.userId && log.userId !== filters.userId) return false;
        if (filters.resource && !log.resource.includes(filters.resource))
          return false;
        if (filters.startDate && log.timestamp < filters.startDate)
          return false;
        if (filters.endDate && log.timestamp > filters.endDate) return false;
        if (filters.decision && log.decision !== filters.decision) return false;
        return true;
      });
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async shutdown(): Promise<void> {
    this.emit("shutdown");
    this.removeAllListeners();
  }
}

export default AccessControlOptimizer;
