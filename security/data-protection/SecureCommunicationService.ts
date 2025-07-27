import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface TLSConfig {
  minVersion: 'TLSv1.2' | 'TLSv1.3';
  cipherSuites: string[];
  dhParam: string;
  ecdhCurve: string;
  certificatePath: string;
  privateKeyPath: string;
  caPath?: string;
  ocspStapling: boolean;
  sessionTimeout: number;
}

export interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  fingerprint: string;
  algorithm: string;
  keySize: number;
}

export interface SecurityHeaders {
  'Strict-Transport-Security': string;
  'Content-Security-Policy': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
}

export interface CommunicationMetrics {
  totalConnections: number;
  secureConnections: number;
  failedHandshakes: number;
  certificateErrors: number;
  averageHandshakeTime: number;
  dataTransferred: number;
  encryptedDataTransferred: number;
}

export interface MessageEncryption {
  algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
  keyExchange: 'ECDH' | 'RSA-OAEP';
  digitalSignature: 'ECDSA' | 'RSA-PSS';
  hashFunction: 'SHA-256' | 'SHA-384' | 'SHA-512';
}

export interface SecureMessage {
  messageId: string;
  timestamp: Date;
  sender: string;
  recipient: string;
  encryptedPayload: string;
  signature: string;
  iv: string;
  keyFingerprint: string;
  algorithm: string;
}

export interface APISecurityConfig {
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  authentication: {
    jwtExpiration: number;
    refreshTokenExpiration: number;
    passwordComplexity: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
  };
  encryption: {
    apiKeyEncryption: boolean;
    responseEncryption: boolean;
    requestEncryption: boolean;
  };
}

export class SecureCommunicationService extends EventEmitter {
  private tlsConfig: TLSConfig;
  private messageEncryption: MessageEncryption;
  private apiSecurity: APISecurityConfig;
  private certificates: Map<string, CertificateInfo>;
  private keyPairs: Map<string, { publicKey: string; privateKey: string }>;
  private metrics: CommunicationMetrics;
  private isInitialized: boolean = false;

  constructor(
    tlsConfig?: Partial<TLSConfig>,
    messageEncryption?: Partial<MessageEncryption>,
    apiSecurity?: Partial<APISecurityConfig>
  ) {
    super();
    
    this.tlsConfig = {
      minVersion: 'TLSv1.3',
      cipherSuites: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-CHACHA20-POLY1305'
      ],
      dhParam: '2048',
      ecdhCurve: 'prime256v1',
      certificatePath: '/etc/ssl/certs/server.crt',
      privateKeyPath: '/etc/ssl/private/server.key',
      caPath: '/etc/ssl/certs/ca.crt',
      ocspStapling: true,
      sessionTimeout: 300,
      ...tlsConfig
    };

    this.messageEncryption = {
      algorithm: 'AES-256-GCM',
      keyExchange: 'ECDH',
      digitalSignature: 'ECDSA',
      hashFunction: 'SHA-256',
      ...messageEncryption
    };

    this.apiSecurity = {
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        skipSuccessfulRequests: false
      },
      authentication: {
        jwtExpiration: 15 * 60, // 15 minutes
        refreshTokenExpiration: 7 * 24 * 60 * 60, // 7 days
        passwordComplexity: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true
        }
      },
      encryption: {
        apiKeyEncryption: true,
        responseEncryption: true,
        requestEncryption: true
      },
      ...apiSecurity
    };

    this.certificates = new Map();
    this.keyPairs = new Map();
    this.metrics = {
      totalConnections: 0,
      secureConnections: 0,
      failedHandshakes: 0,
      certificateErrors: 0,
      averageHandshakeTime: 0,
      dataTransferred: 0,
      encryptedDataTransferred: 0
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadCertificates();
      await this.generateKeyPairs();
      this.setupSecurityHeaders();
      this.startMetricsCollection();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  private async loadCertificates(): Promise<void> {
    try {
      // In a real implementation, load certificates from filesystem or certificate store
      const mockCertInfo: CertificateInfo = {
        subject: 'CN=healthcare-claims.com',
        issuer: 'CN=Healthcare Claims CA',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        fingerprint: crypto.randomBytes(20).toString('hex'),
        algorithm: 'RSA',
        keySize: 4096
      };

      this.certificates.set('server', mockCertInfo);
      this.emit('certificateLoaded', { type: 'server', info: mockCertInfo });
    } catch (error) {
      this.emit('certificateLoadError', error);
      throw error;
    }
  }

  private async generateKeyPairs(): Promise<void> {
    const algorithms = ['RSA', 'ECDSA'];
    
    for (const algorithm of algorithms) {
      try {
        let keyPair;
        
        if (algorithm === 'RSA') {
          keyPair = crypto.generateKeyPairSync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
          });
        } else {
          keyPair = crypto.generateKeyPairSync('ec', {
            namedCurve: 'prime256v1',
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
          });
        }

        this.keyPairs.set(algorithm.toLowerCase(), keyPair);
        this.emit('keyPairGenerated', { algorithm });
      } catch (error) {
        this.emit('keyPairGenerationError', { algorithm, error });
        throw error;
      }
    }
  }

  getTLSConfiguration(): object {
    return {
      secureProtocol: 'TLSv1_3_method',
      minVersion: this.tlsConfig.minVersion,
      ciphers: this.tlsConfig.cipherSuites.join(':'),
      ecdhCurve: this.tlsConfig.ecdhCurve,
      cert: this.tlsConfig.certificatePath,
      key: this.tlsConfig.privateKeyPath,
      ca: this.tlsConfig.caPath,
      sessionTimeout: this.tlsConfig.sessionTimeout,
      secureOptions: crypto.constants.SSL_OP_NO_SSLv2 | 
                    crypto.constants.SSL_OP_NO_SSLv3 | 
                    crypto.constants.SSL_OP_NO_TLSv1 | 
                    crypto.constants.SSL_OP_NO_TLSv1_1,
      honorCipherOrder: true,
      requestCert: true,
      rejectUnauthorized: true
    };
  }

  getSecurityHeaders(): SecurityHeaders {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    };
  }

  async encryptMessage(message: string, recipientPublicKey: string, senderPrivateKey: string): Promise<SecureMessage> {
    try {
      const messageId = crypto.randomUUID();
      const timestamp = new Date();
      
      // Generate ephemeral key for this message
      const ephemeralKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      // Encrypt the message
      const cipher = crypto.createCipherGCM(this.messageEncryption.algorithm.toLowerCase(), ephemeralKey, iv);
      let encryptedPayload = cipher.update(message, 'utf8', 'hex');
      encryptedPayload += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      // Combine encrypted data with auth tag
      const fullEncryptedPayload = encryptedPayload + authTag.toString('hex');
      
      // Create message hash for signing
      const messageHash = crypto.createHash(this.messageEncryption.hashFunction.toLowerCase())
        .update(messageId + timestamp.toISOString() + fullEncryptedPayload)
        .digest();
      
      // Sign the message hash
      const signature = crypto.sign(this.messageEncryption.hashFunction.toLowerCase(), messageHash, senderPrivateKey);
      
      // Create key fingerprint
      const keyFingerprint = crypto.createHash('sha256')
        .update(recipientPublicKey)
        .digest('hex')
        .substring(0, 16);

      const secureMessage: SecureMessage = {
        messageId,
        timestamp,
        sender: 'healthcare-system',
        recipient: 'client-system',
        encryptedPayload: fullEncryptedPayload,
        signature: signature.toString('hex'),
        iv: iv.toString('hex'),
        keyFingerprint,
        algorithm: this.messageEncryption.algorithm
      };

      this.metrics.encryptedDataTransferred += Buffer.byteLength(message, 'utf8');
      this.emit('messageEncrypted', { messageId, size: Buffer.byteLength(message, 'utf8') });
      
      return secureMessage;
    } catch (error) {
      this.emit('messageEncryptionError', error);
      throw error;
    }
  }

  async decryptMessage(secureMessage: SecureMessage, recipientPrivateKey: string, senderPublicKey: string): Promise<string> {
    try {
      // Verify signature first
      const messageHash = crypto.createHash(this.messageEncryption.hashFunction.toLowerCase())
        .update(secureMessage.messageId + secureMessage.timestamp.toISOString() + secureMessage.encryptedPayload)
        .digest();
      
      const isValidSignature = crypto.verify(
        this.messageEncryption.hashFunction.toLowerCase(),
        messageHash,
        senderPublicKey,
        Buffer.from(secureMessage.signature, 'hex')
      );
      
      if (!isValidSignature) {
        throw new Error('Invalid message signature');
      }

      // Extract auth tag and encrypted data
      const authTagLength = 32; // 16 bytes = 32 hex chars
      const encryptedData = secureMessage.encryptedPayload.slice(0, -authTagLength);
      const authTag = Buffer.from(secureMessage.encryptedPayload.slice(-authTagLength), 'hex');
      
      // For this example, we'll use a derived key (in practice, use proper key exchange)
      const ephemeralKey = crypto.pbkdf2Sync(
        recipientPrivateKey.slice(0, 64),
        secureMessage.iv,
        100000,
        32,
        'sha256'
      );
      
      // Decrypt the message
      const decipher = crypto.createDecipherGCM(
        secureMessage.algorithm.toLowerCase(),
        ephemeralKey,
        Buffer.from(secureMessage.iv, 'hex')
      );
      decipher.setAuthTag(authTag);
      
      let decryptedMessage = decipher.update(encryptedData, 'hex', 'utf8');
      decryptedMessage += decipher.final('utf8');

      this.emit('messageDecrypted', { messageId: secureMessage.messageId });
      return decryptedMessage;
    } catch (error) {
      this.emit('messageDecryptionError', { messageId: secureMessage.messageId, error });
      throw error;
    }
  }

  validatePasswordComplexity(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = this.apiSecurity.authentication.passwordComplexity;

    if (password.length < config.minLength) {
      errors.push(`Password must be at least ${config.minLength} characters long`);
    }

    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (config.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
    return { hash, salt };
  }

  verifyPassword(password: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  }

  async encryptApiResponse(data: any): Promise<{ encryptedData: string; iv: string; tag: string }> {
    if (!this.apiSecurity.encryption.responseEncryption) {
      return { encryptedData: JSON.stringify(data), iv: '', tag: '' };
    }

    try {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv);
      
      const jsonData = JSON.stringify(data);
      let encrypted = cipher.update(jsonData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      this.emit('apiEncryptionError', error);
      throw error;
    }
  }

  async decryptApiRequest(encryptedData: string, iv: string, tag: string, key: Buffer): Promise<any> {
    if (!this.apiSecurity.encryption.requestEncryption) {
      return JSON.parse(encryptedData);
    }

    try {
      const decipher = crypto.createDecipherGCM('aes-256-gcm', key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      this.emit('apiDecryptionError', error);
      throw error;
    }
  }

  validateCertificate(certificate: string): { isValid: boolean; errors: string[]; info?: CertificateInfo } {
    try {
      // In a real implementation, parse and validate the actual certificate
      const errors: string[] = [];
      
      // Mock validation
      const now = new Date();
      const mockCert = this.certificates.get('server');
      
      if (!mockCert) {
        errors.push('Certificate not found');
        return { isValid: false, errors };
      }

      if (now < mockCert.validFrom) {
        errors.push('Certificate is not yet valid');
      }

      if (now > mockCert.validTo) {
        errors.push('Certificate has expired');
      }

      return {
        isValid: errors.length === 0,
        errors,
        info: mockCert
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Certificate parsing failed']
      };
    }
  }

  recordConnectionMetrics(isSecure: boolean, handshakeTime?: number): void {
    this.metrics.totalConnections++;
    
    if (isSecure) {
      this.metrics.secureConnections++;
      
      if (handshakeTime) {
        this.metrics.averageHandshakeTime = 
          (this.metrics.averageHandshakeTime * (this.metrics.secureConnections - 1) + handshakeTime) /
          this.metrics.secureConnections;
      }
    } else {
      this.metrics.failedHandshakes++;
    }

    this.emit('connectionMetricsUpdated', this.metrics);
  }

  private setupSecurityHeaders(): void {
    // This would integrate with your web framework to set security headers
    this.emit('securityHeadersConfigured', this.getSecurityHeaders());
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.emit('metricsReport', this.getMetrics());
    }, 60000); // Every minute
  }

  getMetrics(): CommunicationMetrics {
    return { ...this.metrics };
  }

  getCertificateInfo(type: string): CertificateInfo | undefined {
    return this.certificates.get(type);
  }

  getAPISecurityConfig(): APISecurityConfig {
    return { ...this.apiSecurity };
  }

  async rotateCertificates(): Promise<void> {
    try {
      // In a real implementation, this would rotate SSL/TLS certificates
      await this.loadCertificates();
      this.emit('certificatesRotated', { timestamp: new Date() });
    } catch (error) {
      this.emit('certificateRotationError', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.emit('shutdown');
    this.removeAllListeners();
  }
}

export default SecureCommunicationService;
