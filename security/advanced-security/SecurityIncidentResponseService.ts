import { SecurityIncident, ThreatDetectionEvent } from '../types';
import { EventEmitter } from 'events';

interface IncidentPlaybook {
  id: string;
  name: string;
  description: string;
  incident_types: string[];
  severity_levels: string[];
  steps: IncidentStep[];
  estimated_duration: number; // minutes
  required_roles: string[];
  compliance_requirements: string[];
  enabled: boolean;
  version: string;
  created_at: Date;
  updated_at: Date;
}

interface IncidentStep {
  id: string;
  order: number;
  title: string;
  description: string;
  action_type: 'manual' | 'automated' | 'approval';
  assigned_role: string;
  estimated_time: number; // minutes
  dependencies: string[];
  automation_script?: string;
  approval_required: boolean;
  notification_channels: string[];
}

interface IncidentResponse {
  incident_id: string;
  responder_id: string;
  step_id: string;
  action_taken: string;
  timestamp: Date;
  duration: number; // minutes
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  notes: string;
  evidence_collected: string[];
}

interface IncidentTeamMember {
  id: string;
  name: string;
  role: 'incident_commander' | 'security_analyst' | 'forensics_expert' | 'communications_lead' | 'technical_lead';
  contact_info: {
    email: string;
    phone: string;
    slack: string;
  };
  availability: 'available' | 'busy' | 'offline';
  skills: string[];
  current_incidents: string[];
}

export class SecurityIncidentResponseService extends EventEmitter {
  private incidents: SecurityIncident[] = [];
  private playbooks: IncidentPlaybook[] = [];
  private responses: IncidentResponse[] = [];
  private teamMembers: IncidentTeamMember[] = [];
  private activeIncidents: Map<string, any> = new Map();
  private escalationRules: Array<{ condition: any; action: string }> = [];

  constructor() {
    super();
    this.initializePlaybooks();
    this.initializeTeamMembers();
    this.initializeEscalationRules();
  }

  async createIncident(
    title: string,
    description: string,
    severity: SecurityIncident['severity'],
    incidentType: SecurityIncident['incident_type'],
    detectedBy: string,
    affectedSystems: string[] = [],
    affectedUsers: string[] = [],
    triggeringEvent?: ThreatDetectionEvent
  ): Promise<string> {
    const incident: SecurityIncident = {
      id: `incident_${Date.now()}`,
      title,
      description,
      severity,
      status: 'open',
      incident_type: incidentType,
      detected_at: new Date(),
      reported_by: detectedBy,
      affected_systems: affectedSystems,
      affected_users: affectedUsers,
      impact_assessment: await this.assessImpact(severity, affectedSystems, affectedUsers),
      containment_actions: [],
      recovery_actions: [],
      compliance_notifications: this.determineComplianceNotifications(incidentType, severity)
    };

    this.incidents.push(incident);
    this.activeIncidents.set(incident.id, {
      incident,
      start_time: new Date(),
      current_step: null,
      assigned_team: []
    });

    await this.initiateIncidentResponse(incident);
    this.emit('incident_created', incident);

    return incident.id;
  }

  private async initiateIncidentResponse(incident: SecurityIncident): Promise<void> {
    // Find appropriate playbook
    const playbook = this.findPlaybook(incident.incident_type, incident.severity);
    if (!playbook) {
      this.emit('no_playbook_found', { incident: incident.id, type: incident.incident_type });
      await this.handleManualIncident(incident);
      return;
    }

    // Assign incident team
    const assignedTeam = await this.assignIncidentTeam(incident, playbook);
    this.activeIncidents.get(incident.id)!.assigned_team = assignedTeam;

    // Start playbook execution
    await this.executePlaybook(incident, playbook);

    // Send initial notifications
    await this.sendIncidentNotifications(incident, 'created');
  }

  private async executePlaybook(incident: SecurityIncident, playbook: IncidentPlaybook): Promise<void> {
    this.emit('playbook_started', { incident: incident.id, playbook: playbook.id });

    for (const step of playbook.steps.sort((a, b) => a.order - b.order)) {
      try {
        await this.executeStep(incident, step, playbook);
      } catch (error) {
        this.emit('step_failed', { incident: incident.id, step: step.id, error });
        
        if (step.action_type === 'automated') {
          // Try manual fallback for failed automated steps
          await this.requestManualIntervention(incident, step);
        }
      }
    }
  }

  private async executeStep(incident: SecurityIncident, step: IncidentStep, playbook: IncidentPlaybook): Promise<void> {
    const activeIncident = this.activeIncidents.get(incident.id)!;
    activeIncident.current_step = step.id;

    const response: IncidentResponse = {
      incident_id: incident.id,
      responder_id: await this.assignStepResponder(step, activeIncident.assigned_team),
      step_id: step.id,
      action_taken: '',
      timestamp: new Date(),
      duration: 0,
      status: 'pending',
      notes: '',
      evidence_collected: []
    };

    this.responses.push(response);
    const startTime = Date.now();

    try {
      switch (step.action_type) {
        case 'automated':
          await this.executeAutomatedStep(incident, step, response);
          break;
        case 'manual':
          await this.requestManualStep(incident, step, response);
          break;
        case 'approval':
          await this.requestApproval(incident, step, response);
          break;
      }

      response.duration = Math.round((Date.now() - startTime) / 60000); // minutes
      response.status = 'completed';
      this.emit('step_completed', { incident: incident.id, step: step.id, response });

    } catch (error) {
      response.status = 'failed';
      response.notes = `Error: ${error.message}`;
      throw error;
    }
  }

  private async executeAutomatedStep(incident: SecurityIncident, step: IncidentStep, response: IncidentResponse): Promise<void> {
    response.status = 'in_progress';

    switch (step.id) {
      case 'isolate_affected_systems':
        await this.isolateAffectedSystems(incident);
        response.action_taken = `Isolated systems: ${incident.affected_systems.join(', ')}`;
        incident.containment_actions.push(response.action_taken);
        break;

      case 'collect_forensic_evidence':
        const evidence = await this.collectForensicEvidence(incident);
        response.evidence_collected = evidence;
        response.action_taken = `Collected ${evidence.length} pieces of evidence`;
        break;

      case 'block_malicious_ips':
        await this.blockMaliciousIPs(incident);
        response.action_taken = 'Blocked identified malicious IP addresses';
        incident.containment_actions.push(response.action_taken);
        break;

      case 'reset_compromised_credentials':
        await this.resetCompromisedCredentials(incident);
        response.action_taken = `Reset credentials for ${incident.affected_users.length} users`;
        incident.recovery_actions.push(response.action_taken);
        break;

      case 'backup_critical_data':
        await this.backupCriticalData(incident);
        response.action_taken = 'Created emergency backup of critical data';
        break;

      case 'notify_stakeholders':
        await this.notifyStakeholders(incident);
        response.action_taken = 'Sent notifications to relevant stakeholders';
        break;

      default:
        if (step.automation_script) {
          await this.executeCustomScript(step.automation_script, incident, response);
        }
    }
  }

  private async requestManualStep(incident: SecurityIncident, step: IncidentStep, response: IncidentResponse): Promise<void> {
    response.status = 'pending';
    
    const assignedResponder = await this.getResponderById(response.responder_id);
    if (assignedResponder) {
      await this.sendStepNotification(assignedResponder, incident, step);
    }

    // In a real implementation, this would wait for manual completion
    // For demo purposes, we'll simulate completion
    await this.simulateManualStep(incident, step, response);
  }

  private async requestApproval(incident: SecurityIncident, step: IncidentStep, response: IncidentResponse): Promise<void> {
    response.status = 'pending';
    
    const approvers = this.teamMembers.filter(member => 
      member.role === 'incident_commander' && member.availability === 'available'
    );

    if (approvers.length === 0) {
      throw new Error('No available approvers found');
    }

    for (const approver of approvers) {
      await this.sendApprovalRequest(approver, incident, step);
    }

    // Simulate approval
    await this.simulateApproval(incident, step, response);
  }

  async updateIncidentStatus(incidentId: string, status: SecurityIncident['status'], notes?: string): Promise<boolean> {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return false;

    const oldStatus = incident.status;
    incident.status = status;

    if (status === 'resolved' || status === 'closed') {
      const activeIncident = this.activeIncidents.get(incidentId);
      if (activeIncident) {
        await this.finalizeIncident(incident, activeIncident);
        this.activeIncidents.delete(incidentId);
      }
    }

    this.emit('incident_status_updated', { 
      incident: incidentId, 
      old_status: oldStatus, 
      new_status: status,
      notes 
    });

    return true;
  }

  async addIncidentNote(incidentId: string, note: string, authorId: string): Promise<boolean> {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (!incident) return false;

    if (!incident.lessons_learned) {
      incident.lessons_learned = '';
    }
    
    incident.lessons_learned += `\n[${new Date().toISOString()}] ${authorId}: ${note}`;
    this.emit('incident_note_added', { incident: incidentId, note, author: authorId });

    return true;
  }

  async getActiveIncidents(): Promise<SecurityIncident[]> {
    return this.incidents.filter(incident => 
      incident.status === 'open' || 
      incident.status === 'investigating' || 
      incident.status === 'contained'
    );
  }

  async getIncidentById(incidentId: string): Promise<SecurityIncident | null> {
    return this.incidents.find(i => i.id === incidentId) || null;
  }

  async getIncidentStatistics(): Promise<{
    total_incidents: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    average_resolution_time: number;
    compliance_incidents: number;
  }> {
    const total = this.incidents.length;
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    
    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let complianceIncidents = 0;

    this.incidents.forEach(incident => {
      bySeverity[incident.severity] = (bySeverity[incident.severity] || 0) + 1;
      byType[incident.incident_type] = (byType[incident.incident_type] || 0) + 1;
      byStatus[incident.status] = (byStatus[incident.status] || 0) + 1;

      if (incident.status === 'resolved' || incident.status === 'closed') {
        resolvedCount++;
        // Mock resolution time calculation
        totalResolutionTime += Math.random() * 480; // 0-480 minutes
      }

      if (incident.compliance_notifications.length > 0) {
        complianceIncidents++;
      }
    });

    return {
      total_incidents: total,
      by_severity: bySeverity,
      by_type: byType,
      by_status: byStatus,
      average_resolution_time: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      compliance_incidents: complianceIncidents
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.playbooks.filter(p => p.enabled).length > 0 &&
           this.teamMembers.filter(m => m.availability === 'available').length > 0;
  }

  // Helper methods
  private findPlaybook(incidentType: string, severity: string): IncidentPlaybook | null {
    return this.playbooks.find(playbook => 
      playbook.enabled &&
      playbook.incident_types.includes(incidentType) &&
      playbook.severity_levels.includes(severity)
    ) || null;
  }

  private async assignIncidentTeam(incident: SecurityIncident, playbook: IncidentPlaybook): Promise<IncidentTeamMember[]> {
    const team: IncidentTeamMember[] = [];
    
    for (const role of playbook.required_roles) {
      const member = this.teamMembers.find(m => 
        m.role === role && 
        m.availability === 'available' &&
        m.current_incidents.length < 3 // Max 3 incidents per person
      );
      
      if (member) {
        team.push(member);
        member.current_incidents.push(incident.id);
        member.availability = member.current_incidents.length >= 2 ? 'busy' : 'available';
      }
    }

    return team;
  }

  private async assignStepResponder(step: IncidentStep, team: IncidentTeamMember[]): Promise<string> {
    const responder = team.find(member => member.role === step.assigned_role);
    return responder ? responder.id : 'unassigned';
  }

  private async assessImpact(severity: string, affectedSystems: string[], affectedUsers: string[]): Promise<string> {
    const systemCount = affectedSystems.length;
    const userCount = affectedUsers.length;
    
    let impact = `${severity} severity incident affecting ${systemCount} system(s) and ${userCount} user(s).`;
    
    if (affectedSystems.includes('patient_database') || affectedSystems.includes('claims_database')) {
      impact += ' Healthcare data may be compromised.';
    }
    
    if (severity === 'critical') {
      impact += ' Business operations may be significantly impacted.';
    }

    return impact;
  }

  private determineComplianceNotifications(incidentType: string, severity: string): string[] {
    const notifications = [];
    
    if (incidentType === 'data_breach' || 
        (incidentType === 'unauthorized_access' && severity === 'high')) {
      notifications.push('VIETNAMESE_HEALTHCARE_AUTHORITY');
      notifications.push('HIPAA_COMPLIANCE');
    }
    
    if (severity === 'critical') {
      notifications.push('EXECUTIVE_TEAM');
      notifications.push('BOARD_OF_DIRECTORS');
    }

    return notifications;
  }

  // Mock automation methods
  private async isolateAffectedSystems(incident: SecurityIncident): Promise<void> {
    this.emit('systems_isolated', { 
      incident: incident.id, 
      systems: incident.affected_systems,
      timestamp: new Date()
    });
  }

  private async collectForensicEvidence(incident: SecurityIncident): Promise<string[]> {
    return [
      'system_logs_snapshot',
      'network_traffic_capture',
      'memory_dump',
      'disk_image',
      'database_transaction_log'
    ];
  }

  private async blockMaliciousIPs(incident: SecurityIncident): Promise<void> {
    this.emit('ips_blocked', { 
      incident: incident.id,
      timestamp: new Date()
    });
  }

  private async resetCompromisedCredentials(incident: SecurityIncident): Promise<void> {
    this.emit('credentials_reset', { 
      incident: incident.id,
      users: incident.affected_users,
      timestamp: new Date()
    });
  }

  private async backupCriticalData(incident: SecurityIncident): Promise<void> {
    this.emit('emergency_backup_created', { 
      incident: incident.id,
      timestamp: new Date()
    });
  }

  private async notifyStakeholders(incident: SecurityIncident): Promise<void> {
    this.emit('stakeholders_notified', { 
      incident: incident.id,
      notifications: incident.compliance_notifications,
      timestamp: new Date()
    });
  }

  private async executeCustomScript(script: string, incident: SecurityIncident, response: IncidentResponse): Promise<void> {
    // Mock script execution
    response.action_taken = `Executed custom script: ${script}`;
  }

  private async simulateManualStep(incident: SecurityIncident, step: IncidentStep, response: IncidentResponse): Promise<void> {
    // Simulate manual step completion
    setTimeout(() => {
      response.status = 'completed';
      response.action_taken = `Manual step completed: ${step.title}`;
      response.notes = 'Completed by assigned responder';
    }, step.estimated_time * 1000); // Convert to milliseconds for demo
  }

  private async simulateApproval(incident: SecurityIncident, step: IncidentStep, response: IncidentResponse): Promise<void> {
    // Simulate approval
    setTimeout(() => {
      response.status = 'completed';
      response.action_taken = `Approval granted for: ${step.title}`;
      response.notes = 'Approved by incident commander';
    }, 30000); // 30 seconds for demo
  }

  private async getResponderById(responderId: string): Promise<IncidentTeamMember | null> {
    return this.teamMembers.find(member => member.id === responderId) || null;
  }

  private async sendStepNotification(responder: IncidentTeamMember, incident: SecurityIncident, step: IncidentStep): Promise<void> {
    this.emit('step_notification_sent', { 
      responder: responder.id,
      incident: incident.id,
      step: step.id,
      channels: step.notification_channels
    });
  }

  private async sendApprovalRequest(approver: IncidentTeamMember, incident: SecurityIncident, step: IncidentStep): Promise<void> {
    this.emit('approval_request_sent', { 
      approver: approver.id,
      incident: incident.id,
      step: step.id
    });
  }

  private async sendIncidentNotifications(incident: SecurityIncident, event: string): Promise<void> {
    this.emit('incident_notification_sent', { 
      incident: incident.id,
      event,
      recipients: incident.compliance_notifications
    });
  }

  private async handleManualIncident(incident: SecurityIncident): Promise<void> {
    // Assign default team for manual handling
    const commander = this.teamMembers.find(m => m.role === 'incident_commander' && m.availability === 'available');
    if (commander) {
      this.activeIncidents.get(incident.id)!.assigned_team = [commander];
      await this.sendStepNotification(commander, incident, {
        id: 'manual_handling',
        order: 1,
        title: 'Manual Incident Handling Required',
        description: 'No automated playbook found for this incident type',
        action_type: 'manual',
        assigned_role: 'incident_commander',
        estimated_time: 60,
        dependencies: [],
        approval_required: false,
        notification_channels: ['email', 'slack']
      });
    }
  }

  private async finalizeIncident(incident: SecurityIncident, activeIncident: any): Promise<void> {
    // Generate incident report
    const report = await this.generateIncidentReport(incident, activeIncident);
    
    // Release team members
    activeIncident.assigned_team.forEach((member: IncidentTeamMember) => {
      const index = member.current_incidents.indexOf(incident.id);
      if (index > -1) {
        member.current_incidents.splice(index, 1);
      }
      member.availability = member.current_incidents.length === 0 ? 'available' : 'busy';
    });

    this.emit('incident_finalized', { incident: incident.id, report });
  }

  private async generateIncidentReport(incident: SecurityIncident, activeIncident: any): Promise<any> {
    const responses = this.responses.filter(r => r.incident_id === incident.id);
    const totalDuration = responses.reduce((sum, r) => sum + r.duration, 0);
    
    return {
      incident_id: incident.id,
      duration_minutes: totalDuration,
      steps_completed: responses.filter(r => r.status === 'completed').length,
      steps_failed: responses.filter(r => r.status === 'failed').length,
      evidence_collected: responses.flatMap(r => r.evidence_collected),
      team_members: activeIncident.assigned_team.map((m: IncidentTeamMember) => m.id),
      generated_at: new Date()
    };
  }

  private async requestManualIntervention(incident: SecurityIncident, step: IncidentStep): Promise<void> {
    this.emit('manual_intervention_requested', { 
      incident: incident.id,
      step: step.id,
      reason: 'Automated step failed'
    });
  }

  // Initialization methods
  private initializePlaybooks(): void {
    this.playbooks = [
      {
        id: 'data_breach_playbook',
        name: 'Data Breach Response',
        description: 'Standard response for healthcare data breaches',
        incident_types: ['data_breach', 'unauthorized_access'],
        severity_levels: ['high', 'critical'],
        steps: [
          {
            id: 'isolate_affected_systems',
            order: 1,
            title: 'Isolate Affected Systems',
            description: 'Immediately isolate compromised systems',
            action_type: 'automated',
            assigned_role: 'technical_lead',
            estimated_time: 15,
            dependencies: [],
            approval_required: false,
            notification_channels: ['slack', 'sms']
          },
          {
            id: 'collect_forensic_evidence',
            order: 2,
            title: 'Collect Forensic Evidence',
            description: 'Preserve evidence for investigation',
            action_type: 'automated',
            assigned_role: 'forensics_expert',
            estimated_time: 30,
            dependencies: ['isolate_affected_systems'],
            approval_required: false,
            notification_channels: ['email']
          },
          {
            id: 'notify_stakeholders',
            order: 3,
            title: 'Notify Stakeholders',
            description: 'Inform required parties of the breach',
            action_type: 'automated',
            assigned_role: 'communications_lead',
            estimated_time: 20,
            dependencies: [],
            approval_required: true,
            notification_channels: ['email', 'phone']
          }
        ],
        estimated_duration: 240,
        required_roles: ['incident_commander', 'technical_lead', 'forensics_expert', 'communications_lead'],
        compliance_requirements: ['HIPAA', 'VIETNAMESE_HEALTHCARE'],
        enabled: true,
        version: '1.0',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
  }

  private initializeTeamMembers(): void {
    this.teamMembers = [
      {
        id: 'ic_001',
        name: 'Nguyen Van An',
        role: 'incident_commander',
        contact_info: {
          email: 'an.nguyen@company.com',
          phone: '+84901234567',
          slack: '@an.nguyen'
        },
        availability: 'available',
        skills: ['incident_management', 'crisis_communication', 'leadership'],
        current_incidents: []
      },
      {
        id: 'sa_001',
        name: 'Tran Thi Bao',
        role: 'security_analyst',
        contact_info: {
          email: 'bao.tran@company.com',
          phone: '+84907654321',
          slack: '@bao.tran'
        },
        availability: 'available',
        skills: ['threat_analysis', 'log_analysis', 'malware_analysis'],
        current_incidents: []
      },
      {
        id: 'fe_001',
        name: 'Le Van Cuong',
        role: 'forensics_expert',
        contact_info: {
          email: 'cuong.le@company.com',
          phone: '+84909876543',
          slack: '@cuong.le'
        },
        availability: 'available',
        skills: ['digital_forensics', 'evidence_collection', 'malware_reverse_engineering'],
        current_incidents: []
      },
      {
        id: 'cl_001',
        name: 'Pham Thi Dao',
        role: 'communications_lead',
        contact_info: {
          email: 'dao.pham@company.com',
          phone: '+84908765432',
          slack: '@dao.pham'
        },
        availability: 'available',
        skills: ['crisis_communication', 'stakeholder_management', 'media_relations'],
        current_incidents: []
      },
      {
        id: 'tl_001',
        name: 'Hoang Van Duc',
        role: 'technical_lead',
        contact_info: {
          email: 'duc.hoang@company.com',
          phone: '+84905432109',
          slack: '@duc.hoang'
        },
        availability: 'available',
        skills: ['system_administration', 'network_security', 'containment_procedures'],
        current_incidents: []
      }
    ];
  }

  private initializeEscalationRules(): void {
    this.escalationRules = [
      {
        condition: { severity: 'critical', duration_hours: 1 },
        action: 'escalate_to_executive'
      },
      {
        condition: { type: 'data_breach', status: 'open', duration_hours: 4 },
        action: 'notify_regulatory_authorities'
      },
      {
        condition: { affected_systems: ['patient_database'], duration_hours: 2 },
        action: 'activate_emergency_response'
      }
    ];
  }
}
