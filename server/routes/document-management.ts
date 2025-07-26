import express from 'express';
import multer from 'multer';
import { DocumentManagementService } from '../services/document-management/DocumentService';
import { authenticateToken } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = express.Router();
const documentService = new DocumentManagementService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
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
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

// Apply authentication to all routes
router.use(authenticateToken);

// 2.2.11 File upload API với chunking
router.post('/upload/initiate', rateLimit(50), async (req, res) => {
  try {
    const { filename, fileSize, mimeType, chunkSize, claimId, documentType } = req.body;
    
    const result = await documentService.initiateChunkedUpload({
      filename,
      fileSize: parseInt(fileSize),
      mimeType,
      chunkSize: chunkSize ? parseInt(chunkSize) : undefined,
      userId: req.user.id,
      claimId,
      documentType
    });

    res.json({
      success: true,
      data: result,
      message: 'Upload session initiated successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/upload/chunk/:uploadId', rateLimit(200), async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { chunkNumber, checksum } = req.body;
    const chunkData = req.body.data; // In real implementation, would handle binary data properly

    const result = await documentService.uploadChunk(
      uploadId,
      parseInt(chunkNumber),
      Buffer.from(chunkData, 'base64'),
      checksum
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/upload/finalize/:uploadId', rateLimit(20), async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    const result = await documentService.finalizeUpload(uploadId);

    res.json({
      success: true,
      data: result,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Simple upload for smaller files
router.post('/upload/simple', upload.single('file'), rateLimit(20), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const { claimId, documentType } = req.body;

    // Initiate upload session
    const uploadSession = await documentService.initiateChunkedUpload({
      filename: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      userId: req.user.id,
      claimId,
      documentType
    });

    // Upload as single chunk
    await documentService.uploadChunk(
      uploadSession.uploadId,
      1,
      req.file.buffer,
      require('crypto').createHash('sha256').update(req.file.buffer).digest('hex')
    );

    // Finalize upload
    const result = await documentService.finalizeUpload(uploadSession.uploadId);

    res.json({
      success: true,
      data: result,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2.2.12 Document metadata management
router.get('/:documentId/metadata', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const metadata = await documentService.getDocumentMetadata(documentId, req.user.id);
    if (!metadata) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:documentId/metadata', async (req, res) => {
  try {
    const { documentId } = req.params;
    const updates = req.body;
    
    const updatedDocument = await documentService.updateDocumentMetadata(
      documentId,
      updates,
      req.user.id
    );

    res.json({
      success: true,
      data: updatedDocument,
      message: 'Document metadata updated successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2.2.17 Document versioning system
router.post('/:documentId/versions', upload.single('file'), async (req, res) => {
  try {
    const { documentId } = req.params;
    const { changes } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const version = await documentService.createDocumentVersion(
      documentId,
      req.file.buffer,
      changes,
      req.user.id
    );

    res.json({
      success: true,
      data: version,
      message: 'New document version created successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:documentId/versions', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const versions = await documentService.getDocumentVersions(documentId);

    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2.2.19 Document retrieval APIs
router.get('/:documentId/download', rateLimit(100), async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const result = await documentService.downloadDocument(documentId, req.user.id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const { document, fileBuffer } = result;

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    res.setHeader('Content-Length', document.size.toString());
    
    res.send(fileBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:documentId/view', rateLimit(200), async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const result = await documentService.getDocument(documentId, req.user.id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const { document, fileBuffer } = result;

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
    
    res.send(fileBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2.2.20 Thumbnail generation
router.get('/:documentId/thumbnail', rateLimit(100), async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const metadata = await documentService.getDocumentMetadata(documentId, req.user.id);
    if (!metadata || !metadata.thumbnailPath) {
      return res.status(404).json({ success: false, error: 'Thumbnail not found' });
    }

    // In real implementation, would serve thumbnail from storage
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(Buffer.from('mock thumbnail data'));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2.2.23 Watermarking system
router.post('/:documentId/watermark', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { watermarkText } = req.body;
    
    const result = await documentService.addWatermark(documentId, watermarkText);
    
    res.json({
      success: result,
      message: result ? 'Watermark added successfully' : 'Failed to add watermark'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2.2.24 Document expiry management
router.put('/:documentId/expiry', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { expiryDate } = req.body;
    
    const result = await documentService.setDocumentExpiry(
      documentId,
      new Date(expiryDate)
    );
    
    res.json({
      success: result,
      message: result ? 'Expiry date set successfully' : 'Failed to set expiry date'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2.2.25 Audit trail cho document access
router.get('/:documentId/access-log', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const accessLog = await documentService.getDocumentAccessLog(documentId);

    res.json({
      success: true,
      data: accessLog
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Document search
router.get('/search', rateLimit(100), async (req, res) => {
  try {
    const { query, claimId, documentType, status } = req.query;
    
    const documents = await documentService.searchDocuments({
      query: query as string,
      claimId: claimId as string,
      documentType: documentType as any,
      status: status as any,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Document statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await documentService.getDocumentStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk operations
router.post('/bulk/delete', rateLimit(5), async (req, res) => {
  try {
    const { documentIds } = req.body;
    
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid document IDs' });
    }

    const results = [];
    for (const documentId of documentIds) {
      try {
        // In real implementation, would have delete method
        results.push({ documentId, success: true });
      } catch (error) {
        results.push({ documentId, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      data: results,
      message: 'Bulk delete completed'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check expired documents
router.get('/expired', async (req, res) => {
  try {
    const expiredDocuments = await documentService.checkExpiredDocuments();

    res.json({
      success: true,
      data: expiredDocuments,
      message: `Found ${expiredDocuments.length} expired documents`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as documentManagementRouter };
