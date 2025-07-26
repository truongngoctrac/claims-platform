import AWS from 'aws-sdk';
import { Client as MinioClient } from 'minio';
import { CloudStorageConfig, IntegrationResponse } from '../types';
import { IntegrationConfigManager } from '../config/IntegrationConfig';
import { RateLimitManager } from '../utils/RateLimitManager';
import { RetryManager } from '../utils/RetryManager';
import crypto from 'crypto';
import path from 'path';

export interface FileUploadOptions {
  folder?: string;
  filename?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  encryption?: boolean;
  expirationDays?: number;
}

export interface FileDownloadOptions {
  range?: { start: number; end: number };
  versionId?: string;
}

export interface StorageFile {
  key: string;
  url: string;
  size: number;
  etag: string;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  expirationSeconds?: number;
  contentType?: string;
  contentDisposition?: string;
}

export class CloudStorageService {
  private configManager: IntegrationConfigManager;
  private rateLimitManager: RateLimitManager;
  private retryManager: RetryManager;
  private s3Client?: AWS.S3;
  private minioClient?: MinioClient;
  private currentProvider: 'aws-s3' | 'minio' | null = null;

  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
    this.rateLimitManager = new RateLimitManager();
    this.retryManager = new RetryManager();
    this.initializeClients();
  }

  private initializeClients(): void {
    const awsConfig = this.configManager.getConfig<CloudStorageConfig>('storage-aws-s3');
    const minioConfig = this.configManager.getConfig<CloudStorageConfig>('storage-minio');

    if (awsConfig?.enabled) {
      AWS.config.update({
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
        region: awsConfig.region
      });
      
      this.s3Client = new AWS.S3({
        httpOptions: { timeout: awsConfig.timeout }
      });
      this.currentProvider = 'aws-s3';
    } else if (minioConfig?.enabled) {
      this.minioClient = new MinioClient({
        endPoint: minioConfig.endpoint!.split(':')[0],
        port: parseInt(minioConfig.endpoint!.split(':')[1]) || 9000,
        useSSL: false,
        accessKey: minioConfig.accessKeyId,
        secretKey: minioConfig.secretAccessKey
      });
      this.currentProvider = 'minio';
    }
  }

  public async uploadFile(
    buffer: Buffer,
    options: FileUploadOptions = {}
  ): Promise<IntegrationResponse<StorageFile>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.currentProvider) {
        throw new Error('No storage provider configured');
      }

      await this.rateLimitManager.checkRateLimit(`storage-${this.currentProvider}`, requestId);

      const filename = options.filename || `${crypto.randomUUID()}${path.extname(options.filename || '')}`;
      const key = options.folder ? `${options.folder}/${filename}` : filename;

      const result = await this.retryManager.executeWithRetry(
        () => this.executeUpload(buffer, key, options),
        `storage-${this.currentProvider}`
      );

      return {
        success: true,
        data: result,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeUpload(
    buffer: Buffer,
    key: string,
    options: FileUploadOptions
  ): Promise<StorageFile> {
    if (this.currentProvider === 'aws-s3') {
      return this.uploadToS3(buffer, key, options);
    } else if (this.currentProvider === 'minio') {
      return this.uploadToMinio(buffer, key, options);
    }
    throw new Error('No valid storage provider available');
  }

  private async uploadToS3(
    buffer: Buffer,
    key: string,
    options: FileUploadOptions
  ): Promise<StorageFile> {
    const config = this.configManager.getConfig<CloudStorageConfig>('storage-aws-s3')!;
    
    const uploadParams: AWS.S3.PutObjectRequest = {
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: options.contentType || 'application/octet-stream',
      Metadata: options.metadata || {},
      ServerSideEncryption: options.encryption ? 'AES256' : undefined
    };

    if (options.expirationDays) {
      uploadParams.Expires = new Date(Date.now() + options.expirationDays * 24 * 60 * 60 * 1000);
    }

    const result = await this.s3Client!.upload(uploadParams).promise();
    
    // Get object metadata
    const headResult = await this.s3Client!.headObject({
      Bucket: config.bucket,
      Key: key
    }).promise();

    return {
      key,
      url: result.Location,
      size: headResult.ContentLength || buffer.length,
      etag: result.ETag?.replace(/"/g, '') || '',
      lastModified: headResult.LastModified || new Date(),
      contentType: headResult.ContentType,
      metadata: headResult.Metadata
    };
  }

  private async uploadToMinio(
    buffer: Buffer,
    key: string,
    options: FileUploadOptions
  ): Promise<StorageFile> {
    const config = this.configManager.getConfig<CloudStorageConfig>('storage-minio')!;
    
    const metaData: Record<string, string> = {
      'Content-Type': options.contentType || 'application/octet-stream',
      ...options.metadata
    };

    const result = await this.minioClient!.putObject(
      config.bucket,
      key,
      buffer,
      buffer.length,
      metaData
    );

    const objectStat = await this.minioClient!.statObject(config.bucket, key);
    const url = await this.minioClient!.presignedGetObject(config.bucket, key, 24 * 60 * 60); // 24 hours

    return {
      key,
      url,
      size: objectStat.size,
      etag: objectStat.etag,
      lastModified: objectStat.lastModified,
      contentType: objectStat.metaData['content-type'],
      metadata: objectStat.metaData
    };
  }

  public async downloadFile(
    key: string,
    options: FileDownloadOptions = {}
  ): Promise<IntegrationResponse<Buffer>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.currentProvider) {
        throw new Error('No storage provider configured');
      }

      await this.rateLimitManager.checkRateLimit(`storage-${this.currentProvider}`, requestId);

      const result = await this.retryManager.executeWithRetry(
        () => this.executeDownload(key, options),
        `storage-${this.currentProvider}`
      );

      return {
        success: true,
        data: result,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeDownload(key: string, options: FileDownloadOptions): Promise<Buffer> {
    if (this.currentProvider === 'aws-s3') {
      return this.downloadFromS3(key, options);
    } else if (this.currentProvider === 'minio') {
      return this.downloadFromMinio(key, options);
    }
    throw new Error('No valid storage provider available');
  }

  private async downloadFromS3(key: string, options: FileDownloadOptions): Promise<Buffer> {
    const config = this.configManager.getConfig<CloudStorageConfig>('storage-aws-s3')!;
    
    const downloadParams: AWS.S3.GetObjectRequest = {
      Bucket: config.bucket,
      Key: key,
      VersionId: options.versionId
    };

    if (options.range) {
      downloadParams.Range = `bytes=${options.range.start}-${options.range.end}`;
    }

    const result = await this.s3Client!.getObject(downloadParams).promise();
    return result.Body as Buffer;
  }

  private async downloadFromMinio(key: string, options: FileDownloadOptions): Promise<Buffer> {
    const config = this.configManager.getConfig<CloudStorageConfig>('storage-minio')!;
    
    const stream = await this.minioClient!.getObject(config.bucket, key);
    
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  public async deleteFile(key: string): Promise<IntegrationResponse<boolean>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.currentProvider) {
        throw new Error('No storage provider configured');
      }

      await this.rateLimitManager.checkRateLimit(`storage-${this.currentProvider}`, requestId);

      await this.retryManager.executeWithRetry(
        () => this.executeDelete(key),
        `storage-${this.currentProvider}`
      );

      return {
        success: true,
        data: true,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeDelete(key: string): Promise<void> {
    if (this.currentProvider === 'aws-s3') {
      const config = this.configManager.getConfig<CloudStorageConfig>('storage-aws-s3')!;
      await this.s3Client!.deleteObject({
        Bucket: config.bucket,
        Key: key
      }).promise();
    } else if (this.currentProvider === 'minio') {
      const config = this.configManager.getConfig<CloudStorageConfig>('storage-minio')!;
      await this.minioClient!.removeObject(config.bucket, key);
    }
  }

  public async getPresignedUploadUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<IntegrationResponse<{url: string; fields?: Record<string, string>}>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.currentProvider) {
        throw new Error('No storage provider configured');
      }

      const expirationSeconds = options.expirationSeconds || 3600; // 1 hour default
      let url: string;
      let fields: Record<string, string> | undefined;

      if (this.currentProvider === 'aws-s3') {
        const config = this.configManager.getConfig<CloudStorageConfig>('storage-aws-s3')!;
        
        const params = {
          Bucket: config.bucket,
          Key: key,
          Expires: expirationSeconds,
          ContentType: options.contentType,
          ContentDisposition: options.contentDisposition
        };

        url = await this.s3Client!.getSignedUrlPromise('putObject', params);
      } else {
        const config = this.configManager.getConfig<CloudStorageConfig>('storage-minio')!;
        url = await this.minioClient!.presignedPutObject(
          config.bucket,
          key,
          expirationSeconds
        );
      }

      return {
        success: true,
        data: { url, fields },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Presigned URL generation failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async getPresignedDownloadUrl(
    key: string,
    expirationSeconds: number = 3600
  ): Promise<IntegrationResponse<string>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.currentProvider) {
        throw new Error('No storage provider configured');
      }

      let url: string;

      if (this.currentProvider === 'aws-s3') {
        const config = this.configManager.getConfig<CloudStorageConfig>('storage-aws-s3')!;
        
        url = await this.s3Client!.getSignedUrlPromise('getObject', {
          Bucket: config.bucket,
          Key: key,
          Expires: expirationSeconds
        });
      } else {
        const config = this.configManager.getConfig<CloudStorageConfig>('storage-minio')!;
        url = await this.minioClient!.presignedGetObject(
          config.bucket,
          key,
          expirationSeconds
        );
      }

      return {
        success: true,
        data: url,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Presigned URL generation failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async listFiles(
    prefix?: string,
    maxKeys?: number
  ): Promise<IntegrationResponse<StorageFile[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.currentProvider) {
        throw new Error('No storage provider configured');
      }

      const files = await this.retryManager.executeWithRetry(
        () => this.executeList(prefix, maxKeys),
        `storage-${this.currentProvider}`
      );

      return {
        success: true,
        data: files,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'List files failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeList(prefix?: string, maxKeys?: number): Promise<StorageFile[]> {
    if (this.currentProvider === 'aws-s3') {
      return this.listFromS3(prefix, maxKeys);
    } else if (this.currentProvider === 'minio') {
      return this.listFromMinio(prefix, maxKeys);
    }
    throw new Error('No valid storage provider available');
  }

  private async listFromS3(prefix?: string, maxKeys?: number): Promise<StorageFile[]> {
    const config = this.configManager.getConfig<CloudStorageConfig>('storage-aws-s3')!;
    
    const result = await this.s3Client!.listObjectsV2({
      Bucket: config.bucket,
      Prefix: prefix,
      MaxKeys: maxKeys
    }).promise();

    return (result.Contents || []).map(object => ({
      key: object.Key!,
      url: `https://${config.bucket}.s3.${config.region}.amazonaws.com/${object.Key}`,
      size: object.Size || 0,
      etag: object.ETag?.replace(/"/g, '') || '',
      lastModified: object.LastModified || new Date()
    }));
  }

  private async listFromMinio(prefix?: string, maxKeys?: number): Promise<StorageFile[]> {
    const config = this.configManager.getConfig<CloudStorageConfig>('storage-minio')!;
    
    return new Promise((resolve, reject) => {
      const files: StorageFile[] = [];
      const stream = this.minioClient!.listObjects(config.bucket, prefix, true);
      
      stream.on('data', async (object) => {
        if (maxKeys && files.length >= maxKeys) {
          stream.destroy();
          return;
        }
        
        try {
          const url = await this.minioClient!.presignedGetObject(config.bucket, object.name!, 24 * 60 * 60);
          files.push({
            key: object.name!,
            url,
            size: object.size || 0,
            etag: object.etag || '',
            lastModified: object.lastModified || new Date()
          });
        } catch (error) {
          // Skip files that cannot generate URLs
        }
      });
      
      stream.on('end', () => resolve(files));
      stream.on('error', reject);
    });
  }

  public async copyFile(sourceKey: string, destinationKey: string): Promise<IntegrationResponse<StorageFile>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.currentProvider) {
        throw new Error('No storage provider configured');
      }

      const result = await this.retryManager.executeWithRetry(
        () => this.executeCopy(sourceKey, destinationKey),
        `storage-${this.currentProvider}`
      );

      return {
        success: true,
        data: result,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Copy failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeCopy(sourceKey: string, destinationKey: string): Promise<StorageFile> {
    if (this.currentProvider === 'aws-s3') {
      const config = this.configManager.getConfig<CloudStorageConfig>('storage-aws-s3')!;
      
      await this.s3Client!.copyObject({
        Bucket: config.bucket,
        CopySource: `${config.bucket}/${sourceKey}`,
        Key: destinationKey
      }).promise();

      const headResult = await this.s3Client!.headObject({
        Bucket: config.bucket,
        Key: destinationKey
      }).promise();

      return {
        key: destinationKey,
        url: `https://${config.bucket}.s3.${config.region}.amazonaws.com/${destinationKey}`,
        size: headResult.ContentLength || 0,
        etag: headResult.ETag?.replace(/"/g, '') || '',
        lastModified: headResult.LastModified || new Date(),
        contentType: headResult.ContentType,
        metadata: headResult.Metadata
      };
    } else if (this.currentProvider === 'minio') {
      const config = this.configManager.getConfig<CloudStorageConfig>('storage-minio')!;
      
      await this.minioClient!.copyObject(
        config.bucket,
        destinationKey,
        `/${config.bucket}/${sourceKey}`
      );

      const objectStat = await this.minioClient!.statObject(config.bucket, destinationKey);
      const url = await this.minioClient!.presignedGetObject(config.bucket, destinationKey, 24 * 60 * 60);

      return {
        key: destinationKey,
        url,
        size: objectStat.size,
        etag: objectStat.etag,
        lastModified: objectStat.lastModified,
        contentType: objectStat.metaData['content-type'],
        metadata: objectStat.metaData
      };
    }
    
    throw new Error('No valid storage provider available');
  }
}
