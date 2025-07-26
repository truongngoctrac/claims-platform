export interface SecurityAuditResult {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'vulnerability' | 'compliance' | 'configuration' | 'access' | 'data';
  title: string;
  description: string;
  affected_systems: string[];
  recommendations: string[];
  compliance_standards: string[];
  risk_score: number;
  status: 'open' | 'in_progress' | 'resolved' | 'acknowledged';
  assigned_to?: string;
  due_date?: Date;
  resolution_notes?: string;
}

export interface VulnerabilityResult {
  id: string;
  cve_id?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affected_component: string;
  version: string;
  fix_version?: string;
  exploit_available: boolean;
  cvss_score: number;
  first_discovered: Date;
  last_seen: Date;
  patched: boolean;
  patch_available: boolean;
  remediation_effort: 'low' | 'medium' | 'high';
}

export interface ThreatDetectionEvent {
  id: string;
  timestamp: Date;
  event_type: 'intrusion_attempt' | 'anomaly' | 'malware' | 'data_exfiltration' | 'privilege_escalation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_ip: string;
  target_system: string;
  user_agent?: string;
  user_id?: string;
  description: string;
  indicators: string[];
  confidence_score: number;
  blocked: boolean;
  response_actions: string[];
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  incident_type: 'data_breach' | 'system_compromise' | 'malware' | 'phishing' | 'dos_attack' | 'unauthorized_access';
  detected_at: Date;
  reported_by: string;
  assigned_to?: string;
  affected_systems: string[];
  affected_users: string[];
  impact_assessment: string;
  containment_actions: string[];
  recovery_actions: string[];
  lessons_learned?: string;
  compliance_notifications: string[];
  estimated_cost?: number;
}

export interface EncryptionKey {
  id: string;
  algorithm: 'AES-256' | 'RSA-2048' | 'RSA-4096' | 'ECDSA' | 'ChaCha20';
  purpose: 'data_encryption' | 'key_encryption' | 'signing' | 'authentication';
  created_at: Date;
  expires_at?: Date;
  status: 'active' | 'expired' | 'revoked' | 'compromised';
  usage_count: number;
  last_used: Date;
  key_strength: number;
  rotation_policy: 'monthly' | 'quarterly' | 'yearly' | 'manual';
}

export interface ZeroTrustPolicy {
  id: string;
  name: string;
  description: string;
  resource_type: 'api' | 'database' | 'file' | 'application' | 'network';
  conditions: {
    user_attributes: Record<string, any>;
    device_attributes: Record<string, any>;
    location_constraints: string[];
    time_constraints: string[];
    risk_score_threshold: number;
  };
  actions: {
    allow: boolean;
    additional_verification: boolean;
    logging_level: 'basic' | 'detailed' | 'full';
    session_timeout: number;
  };
  priority: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AuthenticationEvent {
  id: string;
  user_id: string;
  method: 'password' | 'mfa' | 'biometric' | 'sso' | 'certificate';
  success: boolean;
  ip_address: string;
  user_agent: string;
  location?: {
    country: string;
    city: string;
    coordinates: [number, number];
  };
  device_fingerprint: string;
  risk_score: number;
  additional_factors: string[];
  session_id?: string;
  timestamp: Date;
  failure_reason?: string;
}

export interface DataClassification {
  id: string;
  classification: 'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret';
  data_type: 'pii' | 'phi' | 'financial' | 'legal' | 'operational' | 'intellectual_property';
  sensitivity_score: number;
  retention_period: number;
  encryption_required: boolean;
  access_controls: string[];
  geographical_restrictions: string[];
  compliance_requirements: string[];
  created_at: Date;
  updated_at: Date;
}

export interface SecurityMetrics {
  timestamp: Date;
  vulnerabilities_detected: number;
  vulnerabilities_resolved: number;
  security_incidents: number;
  failed_login_attempts: number;
  successful_authentications: number;
  data_breaches: number;
  compliance_violations: number;
  security_training_completion: number;
  mean_time_to_detect: number;
  mean_time_to_respond: number;
  mean_time_to_resolve: number;
  security_score: number;
}

export interface ComplianceRequirement {
  id: string;
  standard: 'HIPAA' | 'SOC2' | 'ISO27001' | 'PCI_DSS' | 'GDPR' | 'VIETNAMESE_HEALTHCARE';
  requirement_id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
  evidence_required: string[];
  responsible_party: string;
  due_date?: Date;
  last_assessment: Date;
  next_assessment: Date;
  audit_notes: string[];
}

export interface SecurityConfiguration {
  feature: string;
  enabled: boolean;
  severity_threshold: 'low' | 'medium' | 'high' | 'critical';
  alert_channels: string[];
  auto_remediation: boolean;
  notification_frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  retention_days: number;
  encryption_enabled: boolean;
  compliance_mode: boolean;
  custom_rules: Record<string, any>;
}

export interface BiometricTemplate {
  id: string;
  user_id: string;
  biometric_type: 'fingerprint' | 'face' | 'voice' | 'iris' | 'palm';
  template_data: string; // encrypted biometric template
  quality_score: number;
  enrollment_date: Date;
  last_used: Date;
  usage_count: number;
  device_id: string;
  active: boolean;
  expiry_date?: Date;
}

export interface SecurityTrainingModule {
  id: string;
  title: string;
  description: string;
  category: 'phishing' | 'password_security' | 'data_protection' | 'incident_response' | 'compliance';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_minutes: number;
  required_for_roles: string[];
  completion_criteria: {
    minimum_score: number;
    time_limit_minutes: number;
    retries_allowed: number;
  };
  content_url: string;
  quiz_questions: Array<{
    question: string;
    options: string[];
    correct_answer: number;
    explanation: string;
  }>;
  created_at: Date;
  updated_at: Date;
  version: string;
}

export interface PenetrationTestResult {
  id: string;
  test_type: 'network' | 'web_application' | 'wireless' | 'social_engineering' | 'physical';
  target_system: string;
  methodology: string;
  start_date: Date;
  end_date: Date;
  tester: string;
  findings: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    impact: string;
    likelihood: string;
    recommendation: string;
    cvss_score: number;
  }>;
  executive_summary: string;
  remediation_timeline: string;
  retest_required: boolean;
  compliance_impact: string[];
}
