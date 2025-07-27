import { ThreatDetectionEvent } from "../types";
import { EventEmitter } from "events";

interface IPSRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  action: "block" | "alert" | "drop" | "reject" | "quarantine";
  conditions: {
    source_ip?: string[];
    destination_ip?: string[];
    source_port?: number[];
    destination_port?: number[];
    protocol?: string[];
    payload_regex?: string[];
    header_patterns?: Record<string, string>;
    rate_limits?: { requests_per_minute: number; bytes_per_second: number };
  };
  severity: "low" | "medium" | "high" | "critical";
  created_at: Date;
  updated_at: Date;
  match_count: number;
  last_triggered: Date | null;
}

interface BlockedEntity {
  id: string;
  type: "ip_address" | "user_id" | "user_agent" | "domain";
  value: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  blocked_at: Date;
  expires_at: Date | null;
  auto_unblock: boolean;
  block_count: number;
  triggered_by_rule: string;
}

interface IntrusionEvent {
  id: string;
  timestamp: Date;
  source_ip: string;
  target_endpoint: string;
  intrusion_type:
    | "sql_injection"
    | "xss"
    | "command_injection"
    | "path_traversal"
    | "brute_force"
    | "ddos"
    | "malware"
    | "unauthorized_access";
  severity: "low" | "medium" | "high" | "critical";
  action_taken: string;
  rule_triggered: string;
  payload: string;
  blocked: boolean;
  user_agent?: string;
  user_id?: string;
}

export class IntrusionPreventionService extends EventEmitter {
  private ipsRules: IPSRule[] = [];
  private blockedEntities: BlockedEntity[] = [];
  private intrusionEvents: IntrusionEvent[] = [];
  private rateLimiters: Map<
    string,
    { count: number; lastReset: Date; blocked: boolean }
  > = new Map();
  private isActive = false;
  private realTimeBlocking = true;

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  async initialize(): Promise<void> {
    if (this.isActive) return;

    await this.loadBlockedEntities();
    await this.startRealTimeMonitoring();
    await this.scheduleMaintenanceTasks();

    this.isActive = true;
    this.emit("ips_started", { timestamp: new Date() });
  }

  async analyzeAndPrevent(request: {
    source_ip: string;
    destination_ip?: string;
    source_port?: number;
    destination_port?: number;
    protocol?: string;
    headers: Record<string, string>;
    payload: string;
    url: string;
    method: string;
    user_agent?: string;
    user_id?: string;
  }): Promise<{
    allowed: boolean;
    action_taken: string;
    triggered_rules: string[];
    reason?: string;
    block_duration?: number;
  }> {
    try {
      // First check if entity is already blocked
      const blockCheck = await this.checkBlocked(request);
      if (!blockCheck.allowed) {
        return blockCheck;
      }

      // Check rate limiting
      const rateLimitCheck = await this.checkRateLimit(request);
      if (!rateLimitCheck.allowed) {
        return rateLimitCheck;
      }

      // Evaluate IPS rules
      const ruleEvaluation = await this.evaluateRules(request);
      if (!ruleEvaluation.allowed) {
        await this.executePreventionAction(request, ruleEvaluation);
        return ruleEvaluation;
      }

      // Log allowed request for analysis
      await this.logAllowedRequest(request);

      return {
        allowed: true,
        action_taken: "none",
        triggered_rules: [],
      };
    } catch (error) {
      this.emit("analysis_error", { request, error });
      return {
        allowed: true, // Fail open for availability
        action_taken: "error_occurred",
        triggered_rules: [],
        reason: "Analysis error - request allowed",
      };
    }
  }

  private async checkBlocked(request: any): Promise<{
    allowed: boolean;
    action_taken: string;
    triggered_rules: string[];
    reason?: string;
  }> {
    const blockedEntity = this.blockedEntities.find((entity) => {
      if (entity.expires_at && entity.expires_at < new Date()) {
        return false; // Expired block
      }

      switch (entity.type) {
        case "ip_address":
          return entity.value === request.source_ip;
        case "user_id":
          return entity.value === request.user_id;
        case "user_agent":
          return entity.value === request.user_agent;
        default:
          return false;
      }
    });

    if (blockedEntity) {
      blockedEntity.block_count++;
      this.emit("blocked_entity_triggered", blockedEntity);

      return {
        allowed: false,
        action_taken: "blocked_entity",
        triggered_rules: [blockedEntity.triggered_by_rule],
        reason: blockedEntity.reason,
      };
    }

    return { allowed: true, action_taken: "none", triggered_rules: [] };
  }

  private async checkRateLimit(request: any): Promise<{
    allowed: boolean;
    action_taken: string;
    triggered_rules: string[];
    reason?: string;
  }> {
    const key = `${request.source_ip}:${request.url}`;
    const now = new Date();
    const windowMs = 60 * 1000; // 1 minute window

    let limiter = this.rateLimiters.get(key);
    if (!limiter) {
      limiter = { count: 0, lastReset: now, blocked: false };
      this.rateLimiters.set(key, limiter);
    }

    // Reset counter if window expired
    if (now.getTime() - limiter.lastReset.getTime() > windowMs) {
      limiter.count = 0;
      limiter.lastReset = now;
      limiter.blocked = false;
    }

    limiter.count++;

    // Check if rate limit exceeded
    const rateLimit = this.getRateLimitForEndpoint(request.url);
    if (limiter.count > rateLimit.requests_per_minute) {
      limiter.blocked = true;

      // Auto-block if severe rate limiting detected
      if (limiter.count > rateLimit.requests_per_minute * 3) {
        await this.blockEntity(
          "ip_address",
          request.source_ip,
          "Rate limit exceeded",
          "medium",
          "ips_rate_limit",
        );
      }

      return {
        allowed: false,
        action_taken: "rate_limited",
        triggered_rules: ["rate_limit"],
        reason: `Rate limit exceeded: ${limiter.count}/${rateLimit.requests_per_minute} requests per minute`,
      };
    }

    return { allowed: true, action_taken: "none", triggered_rules: [] };
  }

  private async evaluateRules(request: any): Promise<{
    allowed: boolean;
    action_taken: string;
    triggered_rules: string[];
    reason?: string;
  }> {
    const triggeredRules: string[] = [];
    let highestPriorityAction = "alert";
    let reason = "";

    for (const rule of this.ipsRules
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority)) {
      const matches = await this.evaluateRule(rule, request);

      if (matches) {
        triggeredRules.push(rule.id);
        rule.match_count++;
        rule.last_triggered = new Date();

        if (this.shouldTakeAction(rule.action, highestPriorityAction)) {
          highestPriorityAction = rule.action;
          reason = rule.description;
        }

        this.emit("rule_triggered", { rule, request });
      }
    }

    const allowed =
      !triggeredRules.length ||
      (highestPriorityAction === "alert" && this.realTimeBlocking === false);

    return {
      allowed,
      action_taken: allowed ? "none" : highestPriorityAction,
      triggered_rules: triggeredRules,
      reason: reason || undefined,
    };
  }

  private async evaluateRule(rule: IPSRule, request: any): Promise<boolean> {
    const conditions = rule.conditions;

    // Source IP check
    if (conditions.source_ip && conditions.source_ip.length > 0) {
      if (!this.matchIPPatterns(request.source_ip, conditions.source_ip)) {
        return false;
      }
    }

    // Destination IP check
    if (conditions.destination_ip && conditions.destination_ip.length > 0) {
      if (
        !this.matchIPPatterns(request.destination_ip, conditions.destination_ip)
      ) {
        return false;
      }
    }

    // Port checks
    if (
      conditions.source_port &&
      !conditions.source_port.includes(request.source_port)
    ) {
      return false;
    }
    if (
      conditions.destination_port &&
      !conditions.destination_port.includes(request.destination_port)
    ) {
      return false;
    }

    // Protocol check
    if (
      conditions.protocol &&
      !conditions.protocol.includes(request.protocol)
    ) {
      return false;
    }

    // Payload regex checks
    if (conditions.payload_regex) {
      const payloadMatches = conditions.payload_regex.some((pattern) => {
        try {
          return new RegExp(pattern, "i").test(request.payload || "");
        } catch (error) {
          this.emit("regex_error", { pattern, error });
          return false;
        }
      });
      if (!payloadMatches) {
        return false;
      }
    }

    // Header pattern checks
    if (conditions.header_patterns) {
      for (const [headerName, pattern] of Object.entries(
        conditions.header_patterns,
      )) {
        const headerValue = request.headers[headerName.toLowerCase()];
        if (!headerValue || !new RegExp(pattern, "i").test(headerValue)) {
          return false;
        }
      }
    }

    return true;
  }

  private async executePreventionAction(
    request: any,
    evaluation: any,
  ): Promise<void> {
    const intrusionEvent: IntrusionEvent = {
      id: `intrusion_${Date.now()}`,
      timestamp: new Date(),
      source_ip: request.source_ip,
      target_endpoint: request.url,
      intrusion_type: this.determineIntrusionType(evaluation.triggered_rules),
      severity: this.calculateSeverity(evaluation.triggered_rules),
      action_taken: evaluation.action_taken,
      rule_triggered: evaluation.triggered_rules.join(","),
      payload: request.payload || "",
      blocked: evaluation.action_taken !== "alert",
      user_agent: request.user_agent,
      user_id: request.user_id,
    };

    this.intrusionEvents.push(intrusionEvent);

    switch (evaluation.action_taken) {
      case "block":
        await this.blockEntity(
          "ip_address",
          request.source_ip,
          evaluation.reason || "IPS rule triggered",
          "high",
          evaluation.triggered_rules[0],
        );
        break;
      case "quarantine":
        await this.quarantineEntity(
          request.source_ip,
          evaluation.reason || "Quarantined by IPS",
        );
        break;
      case "drop":
        // Connection dropped silently
        break;
      case "reject":
        // Connection rejected with response
        break;
    }

    this.emit("intrusion_prevented", intrusionEvent);
  }

  async blockEntity(
    type: BlockedEntity["type"],
    value: string,
    reason: string,
    severity: BlockedEntity["severity"],
    triggeredByRule: string,
    duration?: number,
  ): Promise<string> {
    const expiresAt = duration
      ? new Date(Date.now() + duration * 60 * 1000)
      : null;

    const blockedEntity: BlockedEntity = {
      id: `block_${Date.now()}`,
      type,
      value,
      reason,
      severity,
      blocked_at: new Date(),
      expires_at: expiresAt,
      auto_unblock: !!duration,
      block_count: 1,
      triggered_by_rule: triggeredByRule,
    };

    this.blockedEntities.push(blockedEntity);
    this.emit("entity_blocked", blockedEntity);

    return blockedEntity.id;
  }

  async unblockEntity(blockId: string): Promise<boolean> {
    const index = this.blockedEntities.findIndex(
      (entity) => entity.id === blockId,
    );
    if (index === -1) return false;

    const entity = this.blockedEntities[index];
    this.blockedEntities.splice(index, 1);
    this.emit("entity_unblocked", entity);

    return true;
  }

  async addIPSRule(
    rule: Omit<
      IPSRule,
      "id" | "created_at" | "updated_at" | "match_count" | "last_triggered"
    >,
  ): Promise<string> {
    const newRule: IPSRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      created_at: new Date(),
      updated_at: new Date(),
      match_count: 0,
      last_triggered: null,
    };

    this.ipsRules.push(newRule);
    this.emit("ips_rule_added", newRule);

    return newRule.id;
  }

  async updateIPSRule(
    ruleId: string,
    updates: Partial<IPSRule>,
  ): Promise<boolean> {
    const rule = this.ipsRules.find((r) => r.id === ruleId);
    if (!rule) return false;

    Object.assign(rule, updates, { updated_at: new Date() });
    this.emit("ips_rule_updated", rule);

    return true;
  }

  async deleteIPSRule(ruleId: string): Promise<boolean> {
    const index = this.ipsRules.findIndex((r) => r.id === ruleId);
    if (index === -1) return false;

    const rule = this.ipsRules[index];
    this.ipsRules.splice(index, 1);
    this.emit("ips_rule_deleted", rule);

    return true;
  }

  async getIntrusionStatistics(): Promise<{
    total_intrusions: number;
    blocked_intrusions: number;
    by_type: Record<string, number>;
    by_severity: Record<string, number>;
    top_sources: Array<{ ip: string; count: number }>;
    recent_trends: any;
  }> {
    const total = this.intrusionEvents.length;
    const blocked = this.intrusionEvents.filter((e) => e.blocked).length;

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const sourceIPs: Record<string, number> = {};

    this.intrusionEvents.forEach((event) => {
      byType[event.intrusion_type] = (byType[event.intrusion_type] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      sourceIPs[event.source_ip] = (sourceIPs[event.source_ip] || 0) + 1;
    });

    const topSources = Object.entries(sourceIPs)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total_intrusions: total,
      blocked_intrusions: blocked,
      by_type: byType,
      by_severity: bySeverity,
      top_sources: topSources,
      recent_trends: this.calculateIntrusionTrends(),
    };
  }

  async getRecentIntrusions(limit: number = 10): Promise<IntrusionEvent[]> {
    return this.intrusionEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getBlockedEntities(): Promise<BlockedEntity[]> {
    // Filter out expired blocks
    const activeBlocks = this.blockedEntities.filter(
      (entity) => !entity.expires_at || entity.expires_at > new Date(),
    );

    return activeBlocks.sort(
      (a, b) => b.blocked_at.getTime() - a.blocked_at.getTime(),
    );
  }

  async isHealthy(): Promise<boolean> {
    return this.isActive && this.ipsRules.filter((r) => r.enabled).length > 0;
  }

  // Helper methods
  private matchIPPatterns(ip: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern.includes("/")) {
        // CIDR notation
        return this.matchCIDR(ip, pattern);
      } else if (pattern.includes("*")) {
        // Wildcard pattern
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(ip);
      } else {
        // Exact match
        return ip === pattern;
      }
    });
  }

  private matchCIDR(ip: string, cidr: string): boolean {
    // Simple CIDR matching implementation
    const [network, prefixLength] = cidr.split("/");
    const mask = parseInt(prefixLength);

    // Convert IPs to integers for comparison
    const ipInt = this.ipToInt(ip);
    const networkInt = this.ipToInt(network);
    const maskInt = 0xffffffff << (32 - mask);

    return (ipInt & maskInt) === (networkInt & maskInt);
  }

  private ipToInt(ip: string): number {
    return (
      ip.split(".").reduce((int, octet) => (int << 8) + parseInt(octet), 0) >>>
      0
    );
  }

  private shouldTakeAction(newAction: string, currentAction: string): boolean {
    const actionPriority = {
      alert: 1,
      drop: 2,
      reject: 3,
      quarantine: 4,
      block: 5,
    };

    return actionPriority[newAction] > actionPriority[currentAction];
  }

  private determineIntrusionType(
    triggeredRules: string[],
  ): IntrusionEvent["intrusion_type"] {
    // Map rule IDs to intrusion types
    if (triggeredRules.some((rule) => rule.includes("sql")))
      return "sql_injection";
    if (triggeredRules.some((rule) => rule.includes("xss"))) return "xss";
    if (triggeredRules.some((rule) => rule.includes("command")))
      return "command_injection";
    if (triggeredRules.some((rule) => rule.includes("path")))
      return "path_traversal";
    if (triggeredRules.some((rule) => rule.includes("brute")))
      return "brute_force";
    if (triggeredRules.some((rule) => rule.includes("ddos"))) return "ddos";
    return "unauthorized_access";
  }

  private calculateSeverity(
    triggeredRules: string[],
  ): IntrusionEvent["severity"] {
    const rules = this.ipsRules.filter((r) => triggeredRules.includes(r.id));
    if (rules.some((r) => r.severity === "critical")) return "critical";
    if (rules.some((r) => r.severity === "high")) return "high";
    if (rules.some((r) => r.severity === "medium")) return "medium";
    return "low";
  }

  private getRateLimitForEndpoint(url: string): {
    requests_per_minute: number;
    bytes_per_second: number;
  } {
    // Different rate limits for different endpoints
    if (url.includes("/api/auth"))
      return { requests_per_minute: 10, bytes_per_second: 1024 };
    if (url.includes("/api/"))
      return { requests_per_minute: 100, bytes_per_second: 10240 };
    return { requests_per_minute: 200, bytes_per_second: 20480 };
  }

  private async quarantineEntity(
    sourceIp: string,
    reason: string,
  ): Promise<void> {
    // Implement quarantine logic - restrict access but don't completely block
    this.emit("entity_quarantined", {
      ip: sourceIp,
      reason,
      timestamp: new Date(),
    });
  }

  private async logAllowedRequest(request: any): Promise<void> {
    // Log allowed requests for analysis and baseline building
    this.emit("request_allowed", {
      timestamp: new Date(),
      source_ip: request.source_ip,
      url: request.url,
      method: request.method,
    });
  }

  private calculateIntrusionTrends(): any {
    const last24h = this.intrusionEvents.filter(
      (e) => e.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000,
    );

    return {
      last_24h_count: last24h.length,
      blocked_percentage:
        last24h.length > 0
          ? (last24h.filter((e) => e.blocked).length / last24h.length) * 100
          : 0,
      most_common_type: "sql_injection", // Mock
    };
  }

  private async loadBlockedEntities(): Promise<void> {
    // Mock loading from persistent storage
    this.blockedEntities = [];
  }

  private async startRealTimeMonitoring(): Promise<void> {
    // Mock real-time monitoring setup
    setInterval(() => {
      this.cleanupExpiredBlocks();
    }, 60 * 1000); // Check every minute
  }

  private cleanupExpiredBlocks(): void {
    const now = new Date();
    const initialCount = this.blockedEntities.length;

    this.blockedEntities = this.blockedEntities.filter((entity) => {
      if (entity.expires_at && entity.expires_at <= now) {
        this.emit("block_expired", entity);
        return false;
      }
      return true;
    });

    if (this.blockedEntities.length < initialCount) {
      this.emit("blocks_cleaned", {
        removed: initialCount - this.blockedEntities.length,
        remaining: this.blockedEntities.length,
      });
    }
  }

  private async scheduleMaintenanceTasks(): Promise<void> {
    // Daily cleanup and maintenance
    setInterval(
      () => {
        this.performMaintenance();
      },
      24 * 60 * 60 * 1000,
    );
  }

  private async performMaintenance(): Promise<void> {
    // Cleanup old intrusion events
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.intrusionEvents = this.intrusionEvents.filter(
      (event) => event.timestamp > oneWeekAgo,
    );

    // Cleanup rate limiters
    this.rateLimiters.clear();

    this.emit("maintenance_completed", { timestamp: new Date() });
  }

  private initializeDefaultRules(): void {
    this.ipsRules = [
      {
        id: "sql_injection_rule",
        name: "SQL Injection Prevention",
        description: "Blocks SQL injection attempts",
        enabled: true,
        priority: 100,
        action: "block",
        conditions: {
          payload_regex: [
            "(union|select|insert|update|delete|drop|create|alter)\\s+",
            "(or|and)\\s+\\d+\\s*=\\s*\\d+",
            "\\/\\*.*?\\*\\/",
            "--[^\\r\\n]*",
            ";\\s*(drop|delete|insert|update)",
          ],
        },
        severity: "high",
        created_at: new Date(),
        updated_at: new Date(),
        match_count: 0,
        last_triggered: null,
      },
      {
        id: "xss_prevention_rule",
        name: "XSS Attack Prevention",
        description: "Blocks Cross-Site Scripting attempts",
        enabled: true,
        priority: 90,
        action: "block",
        conditions: {
          payload_regex: [
            "<script[^>]*>.*?<\\/script>",
            "javascript:",
            "on(load|error|click|mouse)\\s*=",
            "<iframe[^>]*>.*?<\\/iframe>",
          ],
        },
        severity: "high",
        created_at: new Date(),
        updated_at: new Date(),
        match_count: 0,
        last_triggered: null,
      },
      {
        id: "brute_force_rule",
        name: "Brute Force Protection",
        description: "Blocks brute force login attempts",
        enabled: true,
        priority: 80,
        action: "quarantine",
        conditions: {
          rate_limits: { requests_per_minute: 10, bytes_per_second: 1024 },
        },
        severity: "medium",
        created_at: new Date(),
        updated_at: new Date(),
        match_count: 0,
        last_triggered: null,
      },
      {
        id: "path_traversal_rule",
        name: "Path Traversal Prevention",
        description: "Blocks directory traversal attempts",
        enabled: true,
        priority: 85,
        action: "block",
        conditions: {
          payload_regex: ["\\.\\.\\/|\\.\\.\\\\"],
        },
        severity: "high",
        created_at: new Date(),
        updated_at: new Date(),
        match_count: 0,
        last_triggered: null,
      },
    ];
  }
}
