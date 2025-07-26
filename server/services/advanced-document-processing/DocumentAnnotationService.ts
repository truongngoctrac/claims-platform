import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface DocumentAnnotation {
  id: string;
  documentId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  type: AnnotationType;
  content: AnnotationContent;
  position: AnnotationPosition;
  visibility: AnnotationVisibility;
  status: AnnotationStatus;
  metadata: AnnotationMetadata;
  replies: AnnotationReply[];
  tags: string[];
  category: string;
  priority: AnnotationPriority;
}

export type AnnotationType = 
  | 'highlight'
  | 'note'
  | 'comment'
  | 'markup'
  | 'correction'
  | 'question'
  | 'approval'
  | 'redaction'
  | 'stamp'
  | 'drawing'
  | 'link';

export interface AnnotationContent {
  text?: string;
  richText?: string;
  markdown?: string;
  htmlContent?: string;
  mediaUrls?: string[];
  attachments?: AnnotationAttachment[];
  drawings?: DrawingData[];
  formData?: Record<string, any>;
}

export interface AnnotationPosition {
  page?: number;
  coordinates: BoundingBox;
  selectedText?: string;
  xpath?: string;
  anchorType: 'coordinates' | 'text' | 'element';
  relativePosition?: RelativePosition;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RelativePosition {
  before?: string;
  after?: string;
  contains?: string;
  nearElement?: string;
}

export type AnnotationVisibility = 
  | 'public'
  | 'private'
  | 'team'
  | 'role_based'
  | 'conditional';

export type AnnotationStatus = 
  | 'draft'
  | 'active'
  | 'resolved'
  | 'archived'
  | 'deleted';

export type AnnotationPriority = 
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface AnnotationMetadata {
  color?: string;
  style?: AnnotationStyle;
  confidence?: number;
  source?: 'manual' | 'automated' | 'ai_suggested';
  reviewStatus?: ReviewStatus;
  permissions?: AnnotationPermissions;
  customFields?: Record<string, any>;
  workflowState?: string;
}

export interface AnnotationStyle {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  opacity?: number;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
}

export type ReviewStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'needs_revision';

export interface AnnotationPermissions {
  canView: string[];
  canEdit: string[];
  canDelete: string[];
  canReply: string[];
  inheritFromDocument?: boolean;
}

export interface AnnotationReply {
  id: string;
  parentAnnotationId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  status: 'active' | 'edited' | 'deleted';
  reactions?: AnnotationReaction[];
}

export interface AnnotationReaction {
  userId: string;
  type: ReactionType;
  timestamp: Date;
}

export type ReactionType = 
  | 'like'
  | 'dislike'
  | 'agree'
  | 'disagree'
  | 'question'
  | 'important';

export interface AnnotationAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface DrawingData {
  id: string;
  type: DrawingType;
  points: Point[];
  style: DrawingStyle;
  createdAt: Date;
}

export type DrawingType = 
  | 'freehand'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'polygon';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  timestamp?: number;
}

export interface DrawingStyle {
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
  opacity: number;
  lineCap?: 'round' | 'square' | 'butt';
  lineJoin?: 'round' | 'bevel' | 'miter';
}

export interface AnnotationTemplate {
  id: string;
  name: string;
  description: string;
  type: AnnotationType;
  defaultContent: AnnotationContent;
  defaultStyle: AnnotationStyle;
  requiredFields: string[];
  allowedUsers?: string[];
  category: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface AnnotationWorkflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  documentTypes: string[];
  autoTriggers: WorkflowTrigger[];
  active: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'review' | 'approve' | 'notify' | 'auto_action';
  assignees: string[];
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  timeoutHours?: number;
}

export interface WorkflowTrigger {
  event: 'annotation_created' | 'annotation_updated' | 'status_changed';
  conditions: TriggerCondition[];
}

export interface WorkflowCondition {
  field: string;
  operator: string;
  value: any;
}

export interface TriggerCondition {
  field: string;
  operator: string;
  value: any;
}

export interface WorkflowAction {
  type: 'set_status' | 'assign_user' | 'send_notification' | 'add_tag';
  parameters: Record<string, any>;
}

export interface AnnotationSummary {
  documentId: string;
  totalAnnotations: number;
  annotationsByType: Record<AnnotationType, number>;
  annotationsByUser: Record<string, number>;
  annotationsByStatus: Record<AnnotationStatus, number>;
  recentActivity: AnnotationActivity[];
  collaborators: string[];
  lastActivity: Date;
}

export interface AnnotationActivity {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  annotationId: string;
  timestamp: Date;
  description: string;
  metadata?: Record<string, any>;
}

export type ActivityType = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'replied'
  | 'resolved'
  | 'status_changed'
  | 'shared';

export interface AnnotationExport {
  format: ExportFormat;
  annotations: DocumentAnnotation[];
  metadata: ExportMetadata;
  generatedAt: Date;
  generatedBy: string;
}

export type ExportFormat = 
  | 'json'
  | 'csv'
  | 'xlsx'
  | 'pdf'
  | 'word'
  | 'html';

export interface ExportMetadata {
  documentId: string;
  documentName: string;
  totalAnnotations: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, any>;
  includeReplies: boolean;
  includeDrawings: boolean;
  includeAttachments: boolean;
}

export interface CollaborationSession {
  id: string;
  documentId: string;
  participants: SessionParticipant[];
  startedAt: Date;
  lastActivity: Date;
  status: 'active' | 'paused' | 'ended';
  permissions: SessionPermissions;
}

export interface SessionParticipant {
  userId: string;
  userName: string;
  role: ParticipantRole;
  joinedAt: Date;
  lastSeen: Date;
  isOnline: boolean;
  cursor?: CursorPosition;
}

export type ParticipantRole = 
  | 'owner'
  | 'editor'
  | 'reviewer'
  | 'viewer';

export interface CursorPosition {
  page: number;
  x: number;
  y: number;
  color: string;
}

export interface SessionPermissions {
  canAnnotate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
  canInvite: boolean;
}

export class DocumentAnnotationService extends EventEmitter {
  private annotations: Map<string, DocumentAnnotation> = new Map();
  private templates: Map<string, AnnotationTemplate> = new Map();
  private workflows: Map<string, AnnotationWorkflow> = new Map();
  private activities: Map<string, AnnotationActivity[]> = new Map();
  private collaborationSessions: Map<string, CollaborationSession> = new Map();

  constructor() {
    super();
    this.initializeDefaultTemplates();
    this.initializeDefaultWorkflows();
  }

  // Core Annotation Methods
  async createAnnotation(
    documentId: string,
    userId: string,
    annotationData: {
      type: AnnotationType;
      content: AnnotationContent;
      position: AnnotationPosition;
      visibility?: AnnotationVisibility;
      category?: string;
      priority?: AnnotationPriority;
      tags?: string[];
      templateId?: string;
    }
  ): Promise<DocumentAnnotation> {
    const annotationId = uuidv4();
    
    let defaultStyle: AnnotationStyle = {};
    let defaultContent: AnnotationContent = {};

    // Apply template if specified
    if (annotationData.templateId) {
      const template = this.templates.get(annotationData.templateId);
      if (template) {
        defaultStyle = template.defaultStyle;
        defaultContent = { ...template.defaultContent, ...annotationData.content };
      }
    }

    const annotation: DocumentAnnotation = {
      id: annotationId,
      documentId,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      type: annotationData.type,
      content: { ...defaultContent, ...annotationData.content },
      position: annotationData.position,
      visibility: annotationData.visibility || 'public',
      status: 'active',
      metadata: {
        style: defaultStyle,
        source: 'manual',
        reviewStatus: 'pending',
        permissions: {
          canView: ['all'],
          canEdit: [userId],
          canDelete: [userId],
          canReply: ['all']
        }
      },
      replies: [],
      tags: annotationData.tags || [],
      category: annotationData.category || 'general',
      priority: annotationData.priority || 'medium'
    };

    this.annotations.set(annotationId, annotation);

    // Log activity
    await this.logActivity(documentId, {
      type: 'created',
      userId,
      annotationId,
      description: `Created ${annotation.type} annotation`
    });

    // Trigger workflows
    await this.triggerWorkflows('annotation_created', annotation);

    this.emit('annotationCreated', { annotation, userId });

    return annotation;
  }

  async updateAnnotation(
    annotationId: string,
    userId: string,
    updates: Partial<DocumentAnnotation>
  ): Promise<DocumentAnnotation | null> {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return null;

    // Check permissions
    if (!await this.canEditAnnotation(annotation, userId)) {
      throw new Error('Permission denied');
    }

    const updatedAnnotation: DocumentAnnotation = {
      ...annotation,
      ...updates,
      updatedAt: new Date()
    };

    this.annotations.set(annotationId, updatedAnnotation);

    // Log activity
    await this.logActivity(annotation.documentId, {
      type: 'updated',
      userId,
      annotationId,
      description: `Updated ${annotation.type} annotation`
    });

    // Trigger workflows
    await this.triggerWorkflows('annotation_updated', updatedAnnotation);

    this.emit('annotationUpdated', { annotation: updatedAnnotation, userId });

    return updatedAnnotation;
  }

  async deleteAnnotation(annotationId: string, userId: string): Promise<boolean> {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return false;

    // Check permissions
    if (!await this.canDeleteAnnotation(annotation, userId)) {
      throw new Error('Permission denied');
    }

    // Soft delete - mark as deleted
    annotation.status = 'deleted';
    annotation.updatedAt = new Date();
    this.annotations.set(annotationId, annotation);

    // Log activity
    await this.logActivity(annotation.documentId, {
      type: 'deleted',
      userId,
      annotationId,
      description: `Deleted ${annotation.type} annotation`
    });

    this.emit('annotationDeleted', { annotationId, userId });

    return true;
  }

  async getAnnotation(annotationId: string, userId: string): Promise<DocumentAnnotation | null> {
    const annotation = this.annotations.get(annotationId);
    if (!annotation || annotation.status === 'deleted') return null;

    // Check permissions
    if (!await this.canViewAnnotation(annotation, userId)) {
      return null;
    }

    return annotation;
  }

  async getDocumentAnnotations(
    documentId: string,
    userId: string,
    filters?: {
      type?: AnnotationType;
      status?: AnnotationStatus;
      category?: string;
      priority?: AnnotationPriority;
      createdBy?: string;
      tags?: string[];
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<DocumentAnnotation[]> {
    let annotations = Array.from(this.annotations.values())
      .filter(annotation => 
        annotation.documentId === documentId && 
        annotation.status !== 'deleted'
      );

    // Apply permission filtering
    annotations = await Promise.all(
      annotations.filter(async annotation => 
        await this.canViewAnnotation(annotation, userId)
      )
    );

    // Apply filters
    if (filters) {
      if (filters.type) {
        annotations = annotations.filter(a => a.type === filters.type);
      }
      if (filters.status) {
        annotations = annotations.filter(a => a.status === filters.status);
      }
      if (filters.category) {
        annotations = annotations.filter(a => a.category === filters.category);
      }
      if (filters.priority) {
        annotations = annotations.filter(a => a.priority === filters.priority);
      }
      if (filters.createdBy) {
        annotations = annotations.filter(a => a.createdBy === filters.createdBy);
      }
      if (filters.tags) {
        annotations = annotations.filter(a => 
          filters.tags!.some(tag => a.tags.includes(tag))
        );
      }
      if (filters.dateRange) {
        annotations = annotations.filter(a => 
          a.createdAt >= filters.dateRange!.start && 
          a.createdAt <= filters.dateRange!.end
        );
      }
    }

    return annotations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Reply Management
  async addReply(
    annotationId: string,
    userId: string,
    userName: string,
    content: string
  ): Promise<AnnotationReply | null> {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return null;

    // Check permissions
    if (!await this.canReplyToAnnotation(annotation, userId)) {
      throw new Error('Permission denied');
    }

    const reply: AnnotationReply = {
      id: uuidv4(),
      parentAnnotationId: annotationId,
      authorId: userId,
      authorName: userName,
      content,
      createdAt: new Date(),
      status: 'active',
      reactions: []
    };

    annotation.replies.push(reply);
    annotation.updatedAt = new Date();
    this.annotations.set(annotationId, annotation);

    // Log activity
    await this.logActivity(annotation.documentId, {
      type: 'replied',
      userId,
      annotationId,
      description: `Replied to ${annotation.type} annotation`
    });

    this.emit('replyAdded', { annotation, reply, userId });

    return reply;
  }

  async updateReply(
    annotationId: string,
    replyId: string,
    userId: string,
    newContent: string
  ): Promise<AnnotationReply | null> {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return null;

    const replyIndex = annotation.replies.findIndex(r => r.id === replyId);
    if (replyIndex === -1) return null;

    const reply = annotation.replies[replyIndex];
    
    // Check permissions (only author can edit)
    if (reply.authorId !== userId) {
      throw new Error('Permission denied');
    }

    reply.content = newContent;
    reply.updatedAt = new Date();
    reply.status = 'edited';

    annotation.updatedAt = new Date();
    this.annotations.set(annotationId, annotation);

    this.emit('replyUpdated', { annotation, reply, userId });

    return reply;
  }

  async deleteReply(
    annotationId: string,
    replyId: string,
    userId: string
  ): Promise<boolean> {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return false;

    const reply = annotation.replies.find(r => r.id === replyId);
    if (!reply) return false;

    // Check permissions (author or annotation owner can delete)
    if (reply.authorId !== userId && annotation.createdBy !== userId) {
      throw new Error('Permission denied');
    }

    reply.status = 'deleted';
    annotation.updatedAt = new Date();
    this.annotations.set(annotationId, annotation);

    this.emit('replyDeleted', { annotation, replyId, userId });

    return true;
  }

  // Reaction Management
  async addReaction(
    annotationId: string,
    replyId: string | null,
    userId: string,
    reactionType: ReactionType
  ): Promise<boolean> {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return false;

    if (replyId) {
      // Add reaction to reply
      const reply = annotation.replies.find(r => r.id === replyId);
      if (!reply) return false;

      // Remove existing reaction from this user
      reply.reactions = reply.reactions?.filter(r => r.userId !== userId) || [];
      
      // Add new reaction
      reply.reactions.push({
        userId,
        type: reactionType,
        timestamp: new Date()
      });
    } else {
      // Add reaction to annotation (extend interface if needed)
      // For now, we'll store reactions in metadata
      if (!annotation.metadata.reactions) {
        annotation.metadata.reactions = [];
      }
      
      annotation.metadata.reactions = annotation.metadata.reactions.filter(
        (r: any) => r.userId !== userId
      );
      
      annotation.metadata.reactions.push({
        userId,
        type: reactionType,
        timestamp: new Date()
      });
    }

    annotation.updatedAt = new Date();
    this.annotations.set(annotationId, annotation);

    this.emit('reactionAdded', { annotationId, replyId, userId, reactionType });

    return true;
  }

  // Drawing Management
  async addDrawing(
    annotationId: string,
    userId: string,
    drawingData: Omit<DrawingData, 'id' | 'createdAt'>
  ): Promise<string | null> {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return null;

    // Check permissions
    if (!await this.canEditAnnotation(annotation, userId)) {
      throw new Error('Permission denied');
    }

    const drawing: DrawingData = {
      ...drawingData,
      id: uuidv4(),
      createdAt: new Date()
    };

    if (!annotation.content.drawings) {
      annotation.content.drawings = [];
    }

    annotation.content.drawings.push(drawing);
    annotation.updatedAt = new Date();
    this.annotations.set(annotationId, annotation);

    this.emit('drawingAdded', { annotation, drawing, userId });

    return drawing.id;
  }

  // Template Management
  async createTemplate(
    userId: string,
    templateData: Omit<AnnotationTemplate, 'id' | 'createdBy' | 'createdAt'>
  ): Promise<AnnotationTemplate> {
    const template: AnnotationTemplate = {
      ...templateData,
      id: uuidv4(),
      createdBy: userId,
      createdAt: new Date()
    };

    this.templates.set(template.id, template);
    this.emit('templateCreated', { template, userId });

    return template;
  }

  async getTemplates(type?: AnnotationType): Promise<AnnotationTemplate[]> {
    let templates = Array.from(this.templates.values()).filter(t => t.active);
    
    if (type) {
      templates = templates.filter(t => t.type === type);
    }

    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Collaboration Methods
  async startCollaborationSession(
    documentId: string,
    userId: string,
    permissions: SessionPermissions
  ): Promise<string> {
    const sessionId = uuidv4();
    
    const session: CollaborationSession = {
      id: sessionId,
      documentId,
      participants: [{
        userId,
        userName: 'User', // Would lookup from user service
        role: 'owner',
        joinedAt: new Date(),
        lastSeen: new Date(),
        isOnline: true
      }],
      startedAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      permissions
    };

    this.collaborationSessions.set(sessionId, session);
    this.emit('collaborationSessionStarted', { session });

    return sessionId;
  }

  async joinCollaborationSession(
    sessionId: string,
    userId: string,
    userName: string
  ): Promise<boolean> {
    const session = this.collaborationSessions.get(sessionId);
    if (!session || session.status !== 'active') return false;

    // Check if user already in session
    const existingParticipant = session.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      existingParticipant.isOnline = true;
      existingParticipant.lastSeen = new Date();
    } else {
      session.participants.push({
        userId,
        userName,
        role: 'editor',
        joinedAt: new Date(),
        lastSeen: new Date(),
        isOnline: true
      });
    }

    session.lastActivity = new Date();
    this.collaborationSessions.set(sessionId, session);

    this.emit('participantJoined', { session, userId, userName });

    return true;
  }

  async updateCursorPosition(
    sessionId: string,
    userId: string,
    position: CursorPosition
  ): Promise<boolean> {
    const session = this.collaborationSessions.get(sessionId);
    if (!session) return false;

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) return false;

    participant.cursor = position;
    participant.lastSeen = new Date();
    session.lastActivity = new Date();

    this.collaborationSessions.set(sessionId, session);
    this.emit('cursorMoved', { sessionId, userId, position });

    return true;
  }

  // Analytics and Summary Methods
  async getAnnotationSummary(documentId: string): Promise<AnnotationSummary> {
    const annotations = Array.from(this.annotations.values())
      .filter(a => a.documentId === documentId && a.status !== 'deleted');

    const annotationsByType = annotations.reduce((acc, annotation) => {
      acc[annotation.type] = (acc[annotation.type] || 0) + 1;
      return acc;
    }, {} as Record<AnnotationType, number>);

    const annotationsByUser = annotations.reduce((acc, annotation) => {
      acc[annotation.createdBy] = (acc[annotation.createdBy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const annotationsByStatus = annotations.reduce((acc, annotation) => {
      acc[annotation.status] = (acc[annotation.status] || 0) + 1;
      return acc;
    }, {} as Record<AnnotationStatus, number>);

    const collaborators = Array.from(
      new Set(annotations.map(a => a.createdBy))
    );

    const activities = this.activities.get(documentId) || [];
    const recentActivity = activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    const lastActivity = annotations.length > 0 
      ? new Date(Math.max(...annotations.map(a => a.updatedAt.getTime())))
      : new Date();

    return {
      documentId,
      totalAnnotations: annotations.length,
      annotationsByType,
      annotationsByUser,
      annotationsByStatus,
      recentActivity,
      collaborators,
      lastActivity
    };
  }

  // Export Methods
  async exportAnnotations(
    documentId: string,
    format: ExportFormat,
    options: {
      includeReplies?: boolean;
      includeDrawings?: boolean;
      includeAttachments?: boolean;
      filters?: any;
      userId: string;
    }
  ): Promise<AnnotationExport> {
    const annotations = await this.getDocumentAnnotations(
      documentId,
      options.userId,
      options.filters
    );

    // Remove sensitive data based on options
    const exportAnnotations = annotations.map(annotation => {
      const exportAnnotation = { ...annotation };
      
      if (!options.includeReplies) {
        exportAnnotation.replies = [];
      }
      
      if (!options.includeDrawings) {
        exportAnnotation.content.drawings = [];
      }
      
      if (!options.includeAttachments) {
        exportAnnotation.content.attachments = [];
      }
      
      return exportAnnotation;
    });

    const exportData: AnnotationExport = {
      format,
      annotations: exportAnnotations,
      metadata: {
        documentId,
        documentName: 'Document', // Would lookup from document service
        totalAnnotations: exportAnnotations.length,
        filters: options.filters,
        includeReplies: options.includeReplies || false,
        includeDrawings: options.includeDrawings || false,
        includeAttachments: options.includeAttachments || false
      },
      generatedAt: new Date(),
      generatedBy: options.userId
    };

    this.emit('annotationsExported', { exportData, userId: options.userId });

    return exportData;
  }

  // Permission Methods
  private async canViewAnnotation(annotation: DocumentAnnotation, userId: string): Promise<boolean> {
    if (annotation.visibility === 'private' && annotation.createdBy !== userId) {
      return false;
    }

    if (annotation.metadata.permissions?.canView) {
      const canView = annotation.metadata.permissions.canView;
      return canView.includes('all') || canView.includes(userId);
    }

    return true;
  }

  private async canEditAnnotation(annotation: DocumentAnnotation, userId: string): Promise<boolean> {
    if (annotation.createdBy === userId) return true;

    if (annotation.metadata.permissions?.canEdit) {
      return annotation.metadata.permissions.canEdit.includes(userId);
    }

    return false;
  }

  private async canDeleteAnnotation(annotation: DocumentAnnotation, userId: string): Promise<boolean> {
    if (annotation.createdBy === userId) return true;

    if (annotation.metadata.permissions?.canDelete) {
      return annotation.metadata.permissions.canDelete.includes(userId);
    }

    return false;
  }

  private async canReplyToAnnotation(annotation: DocumentAnnotation, userId: string): Promise<boolean> {
    if (annotation.metadata.permissions?.canReply) {
      const canReply = annotation.metadata.permissions.canReply;
      return canReply.includes('all') || canReply.includes(userId);
    }

    return true;
  }

  // Activity Logging
  private async logActivity(
    documentId: string,
    activityData: {
      type: ActivityType;
      userId: string;
      annotationId: string;
      description: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const activity: AnnotationActivity = {
      id: uuidv4(),
      ...activityData,
      userName: 'User', // Would lookup from user service
      timestamp: new Date()
    };

    if (!this.activities.has(documentId)) {
      this.activities.set(documentId, []);
    }

    const documentActivities = this.activities.get(documentId)!;
    documentActivities.push(activity);

    // Keep only last 1000 activities per document
    if (documentActivities.length > 1000) {
      documentActivities.splice(0, documentActivities.length - 1000);
    }

    this.activities.set(documentId, documentActivities);
  }

  // Workflow Management
  private async triggerWorkflows(
    event: 'annotation_created' | 'annotation_updated' | 'status_changed',
    annotation: DocumentAnnotation
  ): Promise<void> {
    const applicableWorkflows = Array.from(this.workflows.values())
      .filter(workflow => 
        workflow.active &&
        workflow.autoTriggers.some(trigger => trigger.event === event)
      );

    for (const workflow of applicableWorkflows) {
      const trigger = workflow.autoTriggers.find(t => t.event === event);
      if (trigger && this.evaluateTriggerConditions(trigger.conditions, annotation)) {
        await this.executeWorkflow(workflow, annotation);
      }
    }
  }

  private evaluateTriggerConditions(
    conditions: TriggerCondition[],
    annotation: DocumentAnnotation
  ): boolean {
    return conditions.every(condition => {
      const value = this.getAnnotationFieldValue(annotation, condition.field);
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'contains':
          return String(value).includes(condition.value);
        default:
          return true;
      }
    });
  }

  private async executeWorkflow(
    workflow: AnnotationWorkflow,
    annotation: DocumentAnnotation
  ): Promise<void> {
    // Mock workflow execution
    this.emit('workflowTriggered', { workflow, annotation });
  }

  private getAnnotationFieldValue(annotation: DocumentAnnotation, field: string): any {
    const fieldParts = field.split('.');
    let value: any = annotation;

    for (const part of fieldParts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  // Initialize Default Data
  private initializeDefaultTemplates(): void {
    const highlightTemplate: AnnotationTemplate = {
      id: 'highlight_template',
      name: 'Standard Highlight',
      description: 'Standard highlighting template',
      type: 'highlight',
      defaultContent: { text: '' },
      defaultStyle: {
        backgroundColor: '#ffff00',
        opacity: 0.3
      },
      requiredFields: [],
      category: 'review',
      active: true,
      createdBy: 'system',
      createdAt: new Date()
    };

    const commentTemplate: AnnotationTemplate = {
      id: 'comment_template',
      name: 'Review Comment',
      description: 'Template for review comments',
      type: 'comment',
      defaultContent: { text: '' },
      defaultStyle: {
        backgroundColor: '#add8e6',
        borderColor: '#0000ff'
      },
      requiredFields: ['text'],
      category: 'review',
      active: true,
      createdBy: 'system',
      createdAt: new Date()
    };

    this.templates.set(highlightTemplate.id, highlightTemplate);
    this.templates.set(commentTemplate.id, commentTemplate);
  }

  private initializeDefaultWorkflows(): void {
    // Create a simple approval workflow
    const approvalWorkflow: AnnotationWorkflow = {
      id: 'approval_workflow',
      name: 'Annotation Approval Workflow',
      steps: [
        {
          id: 'review_step',
          name: 'Review',
          type: 'review',
          assignees: ['manager'],
          conditions: [],
          actions: [],
          timeoutHours: 24
        }
      ],
      documentTypes: ['medical_invoice'],
      autoTriggers: [
        {
          event: 'annotation_created',
          conditions: [
            {
              field: 'type',
              operator: 'equals',
              value: 'correction'
            }
          ]
        }
      ],
      active: true
    };

    this.workflows.set(approvalWorkflow.id, approvalWorkflow);
  }
}
