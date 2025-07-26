import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import crypto from 'crypto-js';
import sharp from 'sharp';
import { EventEmitter } from 'events';

export interface DocumentMetadata {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  uploadedBy: string;
  uploadedAt: Date;
  claimId?: string;
  documentType: DocumentType;
  version: number;
  status: DocumentStatus;
  tags: string[];
  classification: string;
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  retentionPolicy: string;
  expiryDate?: Date;
  watermarked: boolean;
  compressed: boolean;
  ocrText?: string;
  thumbnailPath?: string;
  virusScanResult?: VirusScanResult;
  accessLog: DocumentAccessLog[];
  metadata: Record<string, any>;
}

export type DocumentType = 
  | 'medical_bill'
  | 'prescription'
  | 'id_document'
  | 'insurance_card'
  | 'medical_report'
  | 'xray'
  | 'lab_result'
  | 'discharge_summary'
  | 'referral_letter'
  | 'other';

export type DocumentStatus = 
  | 'uploading'
  | 'processing'
  | 'verified'
  | 'rejected'
  | 'archived'
  | 'expired';

export interface VirusScanResult {
  scanned: boolean;
  clean: boolean;
  scanDate: Date;
  threats?: string[];
  scanner: string;
}

export interface DocumentAccessLog {
  id: string;
  userId: string;
  action: 'view' | 'download' | 'edit' | 'delete' | 'share';
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  filename: string;
  size: number;
  checksum: string;
  createdAt: Date;
  createdBy: string;
  changes: string;
}

export interface ChunkInfo {
  chunkId: string;
  chunkNumber: number;
  totalChunks: number;
  chunkSize: number;
  checksum: string;
}

export class DocumentManagementService extends EventEmitter {
  private documents: Map<string, DocumentMetadata> = new Map();
  private versions: Map<string, DocumentVersion[]> = new Map();
  private uploadSessions: Map<string, any> = new Map();
  private allowedFileTypes = [
    '.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', 
    '.xls', '.xlsx', '.tiff', '.bmp', '.gif'
  ];
  private maxFileSize = 50 * 1024 * 1024; // 50MB
  private virusScanEnabled = true;

  constructor() {
    super();
  }

  // 2.2.11 File upload API với chunking
  async initiateChunkedUpload(metadata: {
    filename: string;
    fileSize: number;
    mimeType: string;
    chunkSize?: number;
    userId: string;
    claimId?: string;
    documentType: DocumentType;
  }): Promise<{ uploadId: string; chunkSize: number; totalChunks: number }> {
    
    // Validate file
    await this.validateFile(metadata.filename, metadata.fileSize, metadata.mimeType);
    
    const uploadId = uuidv4();
    const chunkSize = metadata.chunkSize || 1024 * 1024; // 1MB default
    const totalChunks = Math.ceil(metadata.fileSize / chunkSize);
    
    this.uploadSessions.set(uploadId, {
      ...metadata,
      uploadId,
      chunkSize,
      totalChunks,
      uploadedChunks: new Set(),
      startedAt: new Date(),
      status: 'initiated'
    });

    return { uploadId, chunkSize, totalChunks };
  }

  async uploadChunk(
    uploadId: string,
    chunkNumber: number,
    chunkData: Buffer,
    checksum: string
  ): Promise<{ success: boolean; message: string }> {
    
    const session = this.uploadSessions.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    // Verify chunk checksum
    const calculatedChecksum = crypto.SHA256(chunkData.toString()).toString();
    if (calculatedChecksum !== checksum) {
      throw new Error('Chunk checksum mismatch');
    }

    // Store chunk (in real implementation, would save to disk/cloud storage)
    session.uploadedChunks.add(chunkNumber);
    session.chunks = session.chunks || {};
    session.chunks[chunkNumber] = chunkData;

    const isComplete = session.uploadedChunks.size === session.totalChunks;
    
    if (isComplete) {
      return await this.finalizeUpload(uploadId);
    }

    return {
      success: true,
      message: `Chunk ${chunkNumber}/${session.totalChunks} uploaded successfully`
    };
  }

  async finalizeUpload(uploadId: string): Promise<{ success: boolean; documentId: string }> {
    const session = this.uploadSessions.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    // Reconstruct file from chunks
    const chunks = [];
    for (let i = 1; i <= session.totalChunks; i++) {
      if (!session.chunks[i]) {
        throw new Error(`Missing chunk ${i}`);
      }
      chunks.push(session.chunks[i]);
    }
    
    const fileBuffer = Buffer.concat(chunks);
    const documentId = uuidv4();
    
    // Calculate file checksum
    const fileChecksum = crypto.SHA256(fileBuffer.toString()).toString();
    
    // Create document metadata
    const document: DocumentMetadata = {
      id: documentId,
      filename: `${documentId}${path.extname(session.filename)}`,
      originalName: session.filename,
      mimeType: session.mimeType,
      size: fileBuffer.length,
      checksum: fileChecksum,
      uploadedBy: session.userId,
      uploadedAt: new Date(),
      claimId: session.claimId,
      documentType: session.documentType,
      version: 1,
      status: 'processing',
      tags: [],
      classification: await this.classifyDocument(fileBuffer, session.mimeType),
      confidentialityLevel: 'confidential',
      retentionPolicy: 'healthcare_standard',
      watermarked: false,
      compressed: false,
      accessLog: [],
      metadata: {}
    };

    this.documents.set(documentId, document);
    
    // Start background processing
    this.processDocument(documentId, fileBuffer);
    
    // Clean up upload session
    this.uploadSessions.delete(uploadId);
    
    this.emit('documentUploaded', { documentId, document });
    
    return { success: true, documentId };
  }

  // 2.2.12 Document metadata management
  async updateDocumentMetadata(
    documentId: string, 
    updates: Partial<DocumentMetadata>,
    userId: string
  ): Promise<DocumentMetadata> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Log access
    this.logAccess(documentId, userId, 'edit', true);

    const updatedDocument = { ...document, ...updates };
    this.documents.set(documentId, updatedDocument);
    
    this.emit('documentUpdated', { documentId, document: updatedDocument, userId });
    
    return updatedDocument;
  }

  async getDocumentMetadata(documentId: string, userId: string): Promise<DocumentMetadata | null> {
    const document = this.documents.get(documentId);
    if (!document) return null;

    // Check access permissions
    if (!await this.checkAccess(documentId, userId, 'view')) {
      return null;
    }

    // Log access
    this.logAccess(documentId, userId, 'view', true);

    return document;
  }

  // 2.2.13 File type validation
  private async validateFile(filename: string, fileSize: number, mimeType: string): Promise<void> {
    const ext = path.extname(filename).toLowerCase();
    
    if (!this.allowedFileTypes.includes(ext)) {
      throw new Error(`File type ${ext} is not allowed`);
    }

    if (fileSize > this.maxFileSize) {
      throw new Error(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
    }

    // MIME type validation
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error(`MIME type ${mimeType} is not allowed`);
    }
  }

  // 2.2.14 Virus scanning integration
  private async scanForViruses(fileBuffer: Buffer, filename: string): Promise<VirusScanResult> {
    if (!this.virusScanEnabled) {
      return {
        scanned: false,
        clean: true,
        scanDate: new Date(),
        scanner: 'disabled'
      };
    }

    // Mock virus scanning - in real implementation would integrate with ClamAV or similar
    const isClean = Math.random() > 0.001; // 99.9% clean rate
    
    return {
      scanned: true,
      clean: isClean,
      scanDate: new Date(),
      threats: isClean ? undefined : ['Win32.TestVirus'],
      scanner: 'ClamAV-Mock'
    };
  }

  // 2.2.15 Document compression
  private async compressDocument(fileBuffer: Buffer, mimeType: string): Promise<Buffer> {
    if (mimeType.startsWith('image/')) {
      // Compress images using sharp
      return await sharp(fileBuffer)
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
    }
    
    // For other file types, would use appropriate compression
    return fileBuffer;
  }

  // 2.2.16 Cloud storage integration (AWS S3)
  async uploadToCloudStorage(documentId: string, fileBuffer: Buffer): Promise<string> {
    // Mock AWS S3 upload - in real implementation would use AWS SDK
    const s3Key = `documents/${new Date().getFullYear()}/${documentId}`;
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return `s3://healthcare-documents/${s3Key}`;
  }

  // 2.2.17 Document versioning system
  async createDocumentVersion(
    documentId: string, 
    newFileBuffer: Buffer, 
    changes: string,
    userId: string
  ): Promise<DocumentVersion> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    const currentVersions = this.versions.get(documentId) || [];
    const newVersionNumber = Math.max(...currentVersions.map(v => v.version), 0) + 1;
    
    const newVersion: DocumentVersion = {
      id: uuidv4(),
      documentId,
      version: newVersionNumber,
      filename: `${documentId}_v${newVersionNumber}${path.extname(document.filename)}`,
      size: newFileBuffer.length,
      checksum: crypto.SHA256(newFileBuffer.toString()).toString(),
      createdAt: new Date(),
      createdBy: userId,
      changes
    };

    currentVersions.push(newVersion);
    this.versions.set(documentId, currentVersions);

    // Update document version
    document.version = newVersionNumber;
    this.documents.set(documentId, document);

    this.emit('documentVersionCreated', { documentId, version: newVersion });

    return newVersion;
  }

  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return this.versions.get(documentId) || [];
  }

  // 2.2.18 Access control cho documents
  async checkAccess(documentId: string, userId: string, action: string): Promise<boolean> {
    const document = this.documents.get(documentId);
    if (!document) return false;

    // Owner always has access
    if (document.uploadedBy === userId) return true;

    // Admin has full access
    // In real implementation, would check user roles from database
    if (userId === 'admin') return true;

    // Check confidentiality level
    switch (document.confidentialityLevel) {
      case 'public':
        return true;
      case 'internal':
        return true; // Assuming all authenticated users are internal
      case 'confidential':
        return action === 'view'; // Limited access
      case 'restricted':
        return false; // No access except owner/admin
      default:
        return false;
    }
  }

  // 2.2.19 Document retrieval APIs
  async getDocument(documentId: string, userId: string): Promise<{ document: DocumentMetadata; fileBuffer: Buffer } | null> {
    const document = this.documents.get(documentId);
    if (!document) return null;

    if (!await this.checkAccess(documentId, userId, 'view')) {
      throw new Error('Access denied');
    }

    // Log access
    this.logAccess(documentId, userId, 'view', true);

    // In real implementation, would retrieve from storage
    const fileBuffer = Buffer.from('mock file content');

    return { document, fileBuffer };
  }

  async downloadDocument(documentId: string, userId: string): Promise<{ document: DocumentMetadata; fileBuffer: Buffer } | null> {
    const result = await this.getDocument(documentId, userId);
    if (!result) return null;

    // Log download
    this.logAccess(documentId, userId, 'download', true);

    return result;
  }

  // 2.2.20 Thumbnail generation
  private async generateThumbnail(fileBuffer: Buffer, mimeType: string): Promise<string | null> {
    if (!mimeType.startsWith('image/')) {
      return null;
    }

    try {
      const thumbnailBuffer = await sharp(fileBuffer)
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      // In real implementation, would save thumbnail to storage
      const thumbnailId = uuidv4();
      const thumbnailPath = `thumbnails/${thumbnailId}.jpg`;
      
      return thumbnailPath;
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return null;
    }
  }

  // 2.2.21 Basic OCR integration
  private async performOCR(fileBuffer: Buffer, mimeType: string): Promise<string | null> {
    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
      return null;
    }

    // Mock OCR - in real implementation would use Tesseract.js or cloud OCR service
    const mockOcrTexts = [
      'Bệnh viện Bạch Mai\nHóa đơn viện phí\nSố tiền: 1.500.000 VNĐ\nNgày: 15/01/2024',
      'Đơn thuốc\nBác sĩ: Nguyễn Văn A\nThuốc kháng sinh\nLiều dùng: 2 viên/ngày',
      'Kết quả xét nghiệm\nMáu: Bình thường\nNước tiểu: Bình thường\nNgày xét nghiệm: 14/01/2024'
    ];

    return mockOcrTexts[Math.floor(Math.random() * mockOcrTexts.length)];
  }

  // 2.2.22 Document classification
  private async classifyDocument(fileBuffer: Buffer, mimeType: string): Promise<string> {
    // Mock classification based on OCR and file analysis
    const classifications = [
      'medical_invoice',
      'prescription',
      'lab_result',
      'xray_image',
      'medical_report',
      'insurance_document'
    ];

    return classifications[Math.floor(Math.random() * classifications.length)];
  }

  // 2.2.23 Watermarking system
  async addWatermark(documentId: string, watermarkText: string): Promise<boolean> {
    const document = this.documents.get(documentId);
    if (!document) return false;

    // Mock watermarking - in real implementation would modify the actual file
    document.watermarked = true;
    document.metadata.watermarkText = watermarkText;
    document.metadata.watermarkDate = new Date();

    this.documents.set(documentId, document);
    this.emit('documentWatermarked', { documentId, watermarkText });

    return true;
  }

  // 2.2.24 Document expiry management
  async setDocumentExpiry(documentId: string, expiryDate: Date): Promise<boolean> {
    const document = this.documents.get(documentId);
    if (!document) return false;

    document.expiryDate = expiryDate;
    this.documents.set(documentId, document);

    return true;
  }

  async checkExpiredDocuments(): Promise<string[]> {
    const now = new Date();
    const expiredDocuments = [];

    for (const [id, document] of this.documents.entries()) {
      if (document.expiryDate && document.expiryDate < now && document.status !== 'expired') {
        document.status = 'expired';
        this.documents.set(id, document);
        expiredDocuments.push(id);
      }
    }

    return expiredDocuments;
  }

  // 2.2.25 Audit trail cho document access
  private logAccess(
    documentId: string, 
    userId: string, 
    action: 'view' | 'download' | 'edit' | 'delete' | 'share',
    success: boolean,
    ipAddress: string = '127.0.0.1',
    userAgent: string = 'Unknown',
    details?: string
  ): void {
    const document = this.documents.get(documentId);
    if (!document) return;

    const logEntry: DocumentAccessLog = {
      id: uuidv4(),
      userId,
      action,
      timestamp: new Date(),
      ipAddress,
      userAgent,
      success,
      details
    };

    document.accessLog.push(logEntry);
    this.documents.set(documentId, document);

    this.emit('documentAccessed', { documentId, logEntry });
  }

  async getDocumentAccessLog(documentId: string): Promise<DocumentAccessLog[]> {
    const document = this.documents.get(documentId);
    return document?.accessLog || [];
  }

  // Background processing
  private async processDocument(documentId: string, fileBuffer: Buffer): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) return;

    try {
      // Virus scan
      const virusScanResult = await this.scanForViruses(fileBuffer, document.filename);
      document.virusScanResult = virusScanResult;

      if (!virusScanResult.clean) {
        document.status = 'rejected';
        this.documents.set(documentId, document);
        this.emit('documentRejected', { documentId, reason: 'virus_detected' });
        return;
      }

      // Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(fileBuffer, document.mimeType);
      if (thumbnailPath) {
        document.thumbnailPath = thumbnailPath;
      }

      // Perform OCR
      const ocrText = await this.performOCR(fileBuffer, document.mimeType);
      if (ocrText) {
        document.ocrText = ocrText;
      }

      // Compress if needed
      if (document.size > 5 * 1024 * 1024) { // 5MB
        const compressedBuffer = await this.compressDocument(fileBuffer, document.mimeType);
        document.compressed = true;
        document.size = compressedBuffer.length;
      }

      // Upload to cloud storage
      const cloudPath = await this.uploadToCloudStorage(documentId, fileBuffer);
      document.metadata.cloudPath = cloudPath;

      // Mark as verified
      document.status = 'verified';
      this.documents.set(documentId, document);

      this.emit('documentProcessed', { documentId, document });

    } catch (error) {
      document.status = 'rejected';
      document.metadata.processingError = error.message;
      this.documents.set(documentId, document);
      
      this.emit('documentProcessingError', { documentId, error });
    }
  }

  // Utility methods
  async searchDocuments(params: {
    query?: string;
    claimId?: string;
    documentType?: DocumentType;
    status?: DocumentStatus;
    userId: string;
  }): Promise<DocumentMetadata[]> {
    let results = Array.from(this.documents.values());

    // Apply filters
    if (params.claimId) {
      results = results.filter(doc => doc.claimId === params.claimId);
    }

    if (params.documentType) {
      results = results.filter(doc => doc.documentType === params.documentType);
    }

    if (params.status) {
      results = results.filter(doc => doc.status === params.status);
    }

    // Apply access control
    results = await Promise.all(
      results.filter(async doc => await this.checkAccess(doc.id, params.userId, 'view'))
    );

    // Text search in OCR content
    if (params.query) {
      const query = params.query.toLowerCase();
      results = results.filter(doc => 
        doc.originalName.toLowerCase().includes(query) ||
        doc.ocrText?.toLowerCase().includes(query) ||
        doc.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return results;
  }

  async getDocumentStats(): Promise<any> {
    const documents = Array.from(this.documents.values());
    
    return {
      total: documents.length,
      byStatus: this.groupBy(documents, 'status'),
      byType: this.groupBy(documents, 'documentType'),
      totalSize: documents.reduce((sum, doc) => sum + doc.size, 0),
      averageSize: documents.length > 0 ? documents.reduce((sum, doc) => sum + doc.size, 0) / documents.length : 0,
      processedToday: documents.filter(doc => 
        doc.uploadedAt.toDateString() === new Date().toDateString()
      ).length
    };
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }
}
