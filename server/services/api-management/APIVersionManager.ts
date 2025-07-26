import { EventEmitter } from 'events';
import semver from 'semver';

export interface APIVersion {
  version: string;
  status: 'active' | 'deprecated' | 'sunset' | 'beta' | 'alpha';
  releaseDate: Date;
  deprecationDate?: Date;
  sunsetDate?: Date;
  supportLevel: 'full' | 'security-only' | 'none';
  changelog: ChangelogEntry[];
  endpoints: Map<string, EndpointVersion>;
  middleware: string[];
  schema: any;
  documentation: {
    url: string;
    examples: any[];
    migrationGuide?: string;
  };
  compatibility: {
    backwardCompatible: boolean;
    breakingChanges: string[];
    migrationRequired: boolean;
  };
}

export interface EndpointVersion {
  path: string;
  method: string;
  version: string;
  status: 'active' | 'deprecated' | 'removed';
  handler: string;
  requestSchema: any;
  responseSchema: any;
  rateLimit?: {
    requests: number;
    window: number;
  };
  authentication: string[];
  permissions: string[];
  changelog: ChangelogEntry[];
}

export interface ChangelogEntry {
  version: string;
  date: Date;
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  description: string;
  impact: 'breaking' | 'non-breaking' | 'internal';
  migration?: {
    required: boolean;
    instructions: string;
    automatedTool?: string;
  };
}

export interface VersioningStrategy {
  type: 'header' | 'url-path' | 'query-param' | 'content-type';
  parameterName?: string;
  defaultVersion: string;
  supportedVersions: string[];
  deprecationPolicy: {
    warningPeriod: number; // days
    supportPeriod: number; // days after deprecation
  };
}

export class APIVersionManager extends EventEmitter {
  private versions: Map<string, APIVersion> = new Map();
  private strategy: VersioningStrategy;
  private defaultVersion: string;

  constructor(strategy: VersioningStrategy) {
    super();
    this.strategy = strategy;
    this.defaultVersion = strategy.defaultVersion;
    this.initializeVersions();
  }

  private initializeVersions(): void {
    // Initialize v1.0.0 - Initial healthcare claims API
    this.registerVersion({
      version: '1.0.0',
      status: 'deprecated',
      releaseDate: new Date('2023-01-01'),
      deprecationDate: new Date('2024-01-01'),
      sunsetDate: new Date('2024-12-31'),
      supportLevel: 'security-only',
      changelog: [
        {
          version: '1.0.0',
          date: new Date('2023-01-01'),
          type: 'added',
          description: 'Initial API release with basic claim submission and tracking',
          impact: 'non-breaking'
        }
      ],
      endpoints: new Map([
        ['POST:/api/v1/claims', {
          path: '/api/v1/claims',
          method: 'POST',
          version: '1.0.0',
          status: 'deprecated',
          handler: 'claimsV1.submitClaim',
          requestSchema: {
            type: 'object',
            properties: {
              patientInfo: { type: 'object' },
              treatmentDetails: { type: 'object' },
              documents: { type: 'array' }
            },
            required: ['patientInfo', 'treatmentDetails']
          },
          responseSchema: {
            type: 'object',
            properties: {
              claimId: { type: 'string' },
              status: { type: 'string' },
              submissionDate: { type: 'string' }
            }
          },
          authentication: ['bearer-token'],
          permissions: ['claims:submit'],
          changelog: []
        }],
        ['GET:/api/v1/claims/:id', {
          path: '/api/v1/claims/:id',
          method: 'GET',
          version: '1.0.0',
          status: 'deprecated',
          handler: 'claimsV1.getClaim',
          requestSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' }
            }
          },
          responseSchema: {
            type: 'object',
            properties: {
              claim: { type: 'object' },
              status: { type: 'string' }
            }
          },
          authentication: ['bearer-token'],
          permissions: ['claims:read'],
          changelog: []
        }]
      ]),
      middleware: ['authentication', 'rateLimit', 'logging'],
      schema: {},
      documentation: {
        url: 'https://docs.healthclaims.vn/v1',
        examples: []
      },
      compatibility: {
        backwardCompatible: true,
        breakingChanges: [],
        migrationRequired: false
      }
    });

    // Initialize v2.0.0 - Enhanced API with external integrations
    this.registerVersion({
      version: '2.0.0',
      status: 'active',
      releaseDate: new Date('2024-01-01'),
      supportLevel: 'full',
      changelog: [
        {
          version: '2.0.0',
          date: new Date('2024-01-01'),
          type: 'added',
          description: 'Enhanced API with external integration support, improved validation, and real-time notifications',
          impact: 'breaking',
          migration: {
            required: true,
            instructions: 'Update request schemas to include new required fields. See migration guide.',
            automatedTool: 'npm run migrate-v1-to-v2'
          }
        },
        {
          version: '2.0.0',
          date: new Date('2024-01-01'),
          type: 'changed',
          description: 'Patient identification now requires national ID verification',
          impact: 'breaking'
        },
        {
          version: '2.0.0',
          date: new Date('2024-01-01'),
          type: 'added',
          description: 'Real-time claim status updates via WebSocket',
          impact: 'non-breaking'
        }
      ],
      endpoints: new Map([
        ['POST:/api/v2/claims', {
          path: '/api/v2/claims',
          method: 'POST',
          version: '2.0.0',
          status: 'active',
          handler: 'claimsV2.submitClaim',
          requestSchema: {
            type: 'object',
            properties: {
              patientInfo: {
                type: 'object',
                properties: {
                  nationalId: { type: 'string', pattern: '^[0-9]{12}$' },
                  name: { type: 'string' },
                  dateOfBirth: { type: 'string', format: 'date' },
                  insuranceCardNumber: { type: 'string' }
                },
                required: ['nationalId', 'name', 'dateOfBirth', 'insuranceCardNumber']
              },
              treatmentDetails: {
                type: 'object',
                properties: {
                  hospitalId: { type: 'string' },
                  treatmentDate: { type: 'string', format: 'date-time' },
                  diagnosis: { type: 'array', items: { type: 'string' } },
                  procedures: { type: 'array', items: { type: 'object' } },
                  totalAmount: { type: 'number', minimum: 0 }
                },
                required: ['hospitalId', 'treatmentDate', 'diagnosis', 'totalAmount']
              },
              documents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { enum: ['medical_record', 'invoice', 'prescription', 'lab_result'] },
                    content: { type: 'string' },
                    mimeType: { type: 'string' }
                  }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  submissionChannel: { enum: ['web', 'mobile', 'api'] },
                  language: { enum: ['vi', 'en'] }
                }
              }
            },
            required: ['patientInfo', 'treatmentDetails', 'documents']
          },
          responseSchema: {
            type: 'object',
            properties: {
              claimId: { type: 'string' },
              status: { enum: ['submitted', 'processing', 'approved', 'rejected'] },
              submissionDate: { type: 'string', format: 'date-time' },
              estimatedProcessingTime: { type: 'number' },
              trackingNumber: { type: 'string' },
              verificationResults: { type: 'object' },
              notifications: {
                type: 'object',
                properties: {
                  email: { type: 'boolean' },
                  sms: { type: 'boolean' },
                  push: { type: 'boolean' }
                }
              }
            }
          },
          rateLimit: {
            requests: 10,
            window: 60000 // 1 minute
          },
          authentication: ['bearer-token', 'api-key'],
          permissions: ['claims:submit', 'patient:verify'],
          changelog: [
            {
              version: '2.0.0',
              date: new Date('2024-01-01'),
              type: 'changed',
              description: 'Enhanced request validation with national ID verification',
              impact: 'breaking'
            }
          ]
        }],
        ['GET:/api/v2/claims/:id', {
          path: '/api/v2/claims/:id',
          method: 'GET',
          version: '2.0.0',
          status: 'active',
          handler: 'claimsV2.getClaim',
          requestSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              includeHistory: { type: 'boolean', default: false },
              includeDocuments: { type: 'boolean', default: false }
            }
          },
          responseSchema: {
            type: 'object',
            properties: {
              claim: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  patientInfo: { type: 'object' },
                  treatmentDetails: { type: 'object' },
                  auditTrail: { type: 'array' },
                  documents: { type: 'array' },
                  verificationResults: { type: 'object' },
                  paymentInfo: { type: 'object' }
                }
              },
              statusHistory: { type: 'array' },
              nextSteps: { type: 'array' }
            }
          },
          authentication: ['bearer-token', 'api-key'],
          permissions: ['claims:read'],
          changelog: []
        }],
        ['PUT:/api/v2/claims/:id/status', {
          path: '/api/v2/claims/:id/status',
          method: 'PUT',
          version: '2.0.0',
          status: 'active',
          handler: 'claimsV2.updateClaimStatus',
          requestSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { enum: ['processing', 'approved', 'rejected', 'requires_info'] },
              reason: { type: 'string' },
              approvalAmount: { type: 'number', minimum: 0 },
              rejectionCode: { type: 'string' },
              additionalInfo: { type: 'object' }
            },
            required: ['status']
          },
          responseSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              claimId: { type: 'string' },
              newStatus: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          },
          authentication: ['bearer-token'],
          permissions: ['claims:update', 'admin:claims'],
          changelog: []
        }],
        ['GET:/api/v2/claims', {
          path: '/api/v2/claims',
          method: 'GET',
          version: '2.0.0',
          status: 'active',
          handler: 'claimsV2.listClaims',
          requestSchema: {
            type: 'object',
            properties: {
              page: { type: 'number', minimum: 1, default: 1 },
              limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
              status: { enum: ['submitted', 'processing', 'approved', 'rejected'] },
              dateFrom: { type: 'string', format: 'date' },
              dateTo: { type: 'string', format: 'date' },
              hospitalId: { type: 'string' },
              patientId: { type: 'string' },
              sortBy: { enum: ['date', 'amount', 'status'], default: 'date' },
              sortOrder: { enum: ['asc', 'desc'], default: 'desc' }
            }
          },
          responseSchema: {
            type: 'object',
            properties: {
              claims: { type: 'array' },
              pagination: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  page: { type: 'number' },
                  pages: { type: 'number' },
                  limit: { type: 'number' }
                }
              },
              filters: { type: 'object' },
              summary: {
                type: 'object',
                properties: {
                  totalAmount: { type: 'number' },
                  averageAmount: { type: 'number' },
                  statusBreakdown: { type: 'object' }
                }
              }
            }
          },
          rateLimit: {
            requests: 100,
            window: 60000
          },
          authentication: ['bearer-token', 'api-key'],
          permissions: ['claims:list'],
          changelog: []
        }]
      ]),
      middleware: ['authentication', 'authorization', 'validation', 'rateLimit', 'logging', 'monitoring'],
      schema: {},
      documentation: {
        url: 'https://docs.healthclaims.vn/v2',
        examples: [
          {
            title: 'Submit a claim',
            description: 'Example of submitting a healthcare claim',
            request: {
              method: 'POST',
              url: '/api/v2/claims',
              body: {
                patientInfo: {
                  nationalId: '123456789012',
                  name: 'Nguyễn Văn A',
                  dateOfBirth: '1990-01-01',
                  insuranceCardNumber: 'SV4010123456789'
                },
                treatmentDetails: {
                  hospitalId: 'BV001',
                  treatmentDate: '2024-01-15T10:00:00Z',
                  diagnosis: ['J06.9'],
                  totalAmount: 500000
                },
                documents: [
                  {
                    type: 'medical_record',
                    content: 'base64-encoded-content',
                    mimeType: 'application/pdf'
                  }
                ]
              }
            },
            response: {
              claimId: 'CL-2024-001234',
              status: 'submitted',
              submissionDate: '2024-01-15T10:05:00Z',
              trackingNumber: 'TN123456789'
            }
          }
        ],
        migrationGuide: 'https://docs.healthclaims.vn/migration/v1-to-v2'
      },
      compatibility: {
        backwardCompatible: false,
        breakingChanges: [
          'National ID verification now required',
          'Enhanced document validation',
          'New response format with additional fields'
        ],
        migrationRequired: true
      }
    });

    // Initialize v3.0.0 - Beta version with AI and blockchain features
    this.registerVersion({
      version: '3.0.0',
      status: 'beta',
      releaseDate: new Date('2024-06-01'),
      supportLevel: 'full',
      changelog: [
        {
          version: '3.0.0',
          date: new Date('2024-06-01'),
          type: 'added',
          description: 'AI-powered fraud detection and blockchain-based claim verification',
          impact: 'non-breaking'
        },
        {
          version: '3.0.0',
          date: new Date('2024-06-01'),
          type: 'added',
          description: 'Smart contract integration for automated claim processing',
          impact: 'non-breaking'
        }
      ],
      endpoints: new Map([
        ['POST:/api/v3/claims/ai-validate', {
          path: '/api/v3/claims/ai-validate',
          method: 'POST',
          version: '3.0.0',
          status: 'active',
          handler: 'claimsV3.aiValidateClaim',
          requestSchema: {
            type: 'object',
            properties: {
              claimData: { type: 'object' },
              validationLevel: { enum: ['basic', 'enhanced', 'comprehensive'] }
            }
          },
          responseSchema: {
            type: 'object',
            properties: {
              validationResult: { type: 'object' },
              fraudScore: { type: 'number' },
              recommendations: { type: 'array' }
            }
          },
          authentication: ['bearer-token'],
          permissions: ['claims:ai-validate'],
          changelog: []
        }]
      ]),
      middleware: ['authentication', 'authorization', 'validation', 'rateLimit', 'logging', 'monitoring', 'ai-preprocessing'],
      schema: {},
      documentation: {
        url: 'https://docs.healthclaims.vn/v3-beta',
        examples: []
      },
      compatibility: {
        backwardCompatible: true,
        breakingChanges: [],
        migrationRequired: false
      }
    });
  }

  public registerVersion(version: APIVersion): void {
    if (!semver.valid(version.version)) {
      throw new Error(`Invalid version format: ${version.version}`);
    }

    this.versions.set(version.version, version);
    this.emit('version-registered', version);
  }

  public getVersion(version: string): APIVersion | undefined {
    return this.versions.get(version);
  }

  public getAllVersions(): APIVersion[] {
    return Array.from(this.versions.values()).sort((a, b) => 
      semver.compare(a.version, b.version)
    );
  }

  public getActiveVersions(): APIVersion[] {
    return Array.from(this.versions.values()).filter(v => v.status === 'active');
  }

  public getDeprecatedVersions(): APIVersion[] {
    return Array.from(this.versions.values()).filter(v => v.status === 'deprecated');
  }

  public getSunsetVersions(): APIVersion[] {
    return Array.from(this.versions.values()).filter(v => v.status === 'sunset');
  }

  public resolveVersion(request: any): string {
    let requestedVersion: string | undefined;

    switch (this.strategy.type) {
      case 'header':
        requestedVersion = request.headers[this.strategy.parameterName || 'api-version'];
        break;
      case 'url-path':
        const pathMatch = request.url.match(/\/v(\d+(?:\.\d+)?(?:\.\d+)?)/);
        requestedVersion = pathMatch ? pathMatch[1] : undefined;
        break;
      case 'query-param':
        requestedVersion = request.query[this.strategy.parameterName || 'version'];
        break;
      case 'content-type':
        const contentType = request.headers['content-type'];
        const versionMatch = contentType?.match(/version=(\d+(?:\.\d+)?(?:\.\d+)?)/);
        requestedVersion = versionMatch ? versionMatch[1] : undefined;
        break;
    }

    // If no version specified, use default
    if (!requestedVersion) {
      return this.defaultVersion;
    }

    // Normalize version (add patch version if missing)
    if (!/\d+\.\d+\.\d+/.test(requestedVersion)) {
      if (!/\d+\.\d+/.test(requestedVersion)) {
        requestedVersion = `${requestedVersion}.0.0`;
      } else {
        requestedVersion = `${requestedVersion}.0`;
      }
    }

    // Check if version exists
    const version = this.versions.get(requestedVersion);
    if (!version) {
      // Try to find the closest compatible version
      const availableVersions = Array.from(this.versions.keys())
        .filter(v => this.versions.get(v)?.status !== 'sunset')
        .sort((a, b) => semver.rcompare(a, b));

      for (const availableVersion of availableVersions) {
        if (semver.satisfies(availableVersion, `~${requestedVersion}`)) {
          return availableVersion;
        }
      }

      // If no compatible version found, return default
      return this.defaultVersion;
    }

    // Check if version is sunset
    if (version.status === 'sunset') {
      throw new Error(`API version ${requestedVersion} is no longer supported`);
    }

    return requestedVersion;
  }

  public isVersionSupported(version: string): boolean {
    const apiVersion = this.versions.get(version);
    return apiVersion ? apiVersion.status !== 'sunset' : false;
  }

  public isVersionDeprecated(version: string): boolean {
    const apiVersion = this.versions.get(version);
    return apiVersion ? apiVersion.status === 'deprecated' : false;
  }

  public getVersionWarnings(version: string): string[] {
    const warnings: string[] = [];
    const apiVersion = this.versions.get(version);
    
    if (!apiVersion) {
      warnings.push(`Version ${version} not found`);
      return warnings;
    }

    if (apiVersion.status === 'deprecated') {
      warnings.push(`Version ${version} is deprecated`);
      
      if (apiVersion.sunsetDate) {
        const daysUntilSunset = Math.ceil(
          (apiVersion.sunsetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        warnings.push(`Version ${version} will be sunset in ${daysUntilSunset} days`);
      }
    }

    if (apiVersion.status === 'beta' || apiVersion.status === 'alpha') {
      warnings.push(`Version ${version} is in ${apiVersion.status} and may have breaking changes`);
    }

    return warnings;
  }

  public getEndpointForVersion(version: string, path: string, method: string): EndpointVersion | undefined {
    const apiVersion = this.versions.get(version);
    if (!apiVersion) return undefined;

    const key = `${method}:${path}`;
    return apiVersion.endpoints.get(key);
  }

  public getMigrationPath(fromVersion: string, toVersion: string): ChangelogEntry[] {
    const changes: ChangelogEntry[] = [];
    const allVersions = Array.from(this.versions.keys()).sort(semver.compare);
    
    const fromIndex = allVersions.indexOf(fromVersion);
    const toIndex = allVersions.indexOf(toVersion);
    
    if (fromIndex === -1 || toIndex === -1) {
      return changes;
    }

    for (let i = fromIndex + 1; i <= toIndex; i++) {
      const version = this.versions.get(allVersions[i]);
      if (version) {
        changes.push(...version.changelog.filter(entry => entry.impact === 'breaking'));
      }
    }

    return changes;
  }

  public deprecateVersion(version: string, sunsetDate?: Date): boolean {
    const apiVersion = this.versions.get(version);
    if (!apiVersion) return false;

    apiVersion.status = 'deprecated';
    apiVersion.deprecationDate = new Date();
    if (sunsetDate) {
      apiVersion.sunsetDate = sunsetDate;
    }
    apiVersion.supportLevel = 'security-only';

    this.emit('version-deprecated', { version, sunsetDate });
    return true;
  }

  public sunsetVersion(version: string): boolean {
    const apiVersion = this.versions.get(version);
    if (!apiVersion) return false;

    apiVersion.status = 'sunset';
    apiVersion.supportLevel = 'none';

    this.emit('version-sunset', version);
    return true;
  }

  public addChangelogEntry(version: string, entry: ChangelogEntry): boolean {
    const apiVersion = this.versions.get(version);
    if (!apiVersion) return false;

    apiVersion.changelog.push(entry);
    this.emit('changelog-updated', { version, entry });
    return true;
  }

  public getVersionStats(): Record<string, any> {
    const stats = {
      total: this.versions.size,
      active: 0,
      deprecated: 0,
      sunset: 0,
      beta: 0,
      alpha: 0,
      versions: [] as any[]
    };

    for (const [versionNumber, version] of this.versions.entries()) {
      stats[version.status]++;
      
      stats.versions.push({
        version: versionNumber,
        status: version.status,
        releaseDate: version.releaseDate,
        deprecationDate: version.deprecationDate,
        sunsetDate: version.sunsetDate,
        supportLevel: version.supportLevel,
        endpointCount: version.endpoints.size
      });
    }

    return stats;
  }

  public validateRequest(version: string, endpoint: string, method: string, data: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    const apiVersion = this.versions.get(version);
    if (!apiVersion) {
      result.valid = false;
      result.errors.push(`Version ${version} not found`);
      return result;
    }

    if (apiVersion.status === 'sunset') {
      result.valid = false;
      result.errors.push(`Version ${version} is no longer supported`);
      return result;
    }

    if (apiVersion.status === 'deprecated') {
      result.warnings.push(`Version ${version} is deprecated`);
    }

    const endpointKey = `${method}:${endpoint}`;
    const endpointVersion = apiVersion.endpoints.get(endpointKey);
    
    if (!endpointVersion) {
      result.valid = false;
      result.errors.push(`Endpoint ${method} ${endpoint} not found in version ${version}`);
      return result;
    }

    if (endpointVersion.status === 'deprecated') {
      result.warnings.push(`Endpoint ${method} ${endpoint} is deprecated in version ${version}`);
    }

    if (endpointVersion.status === 'removed') {
      result.valid = false;
      result.errors.push(`Endpoint ${method} ${endpoint} has been removed in version ${version}`);
      return result;
    }

    // Validate request schema (simplified - in practice you'd use a proper JSON schema validator)
    if (endpointVersion.requestSchema && data) {
      const schemaValidation = this.validateSchema(data, endpointVersion.requestSchema);
      if (!schemaValidation.valid) {
        result.valid = false;
        result.errors.push(...schemaValidation.errors);
      }
    }

    return result;
  }

  private validateSchema(data: any, schema: any): { valid: boolean; errors: string[] } {
    // Simplified schema validation - in practice, use ajv or similar
    const errors: string[] = [];
    
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public getVersionStrategy(): VersioningStrategy {
    return this.strategy;
  }

  public updateStrategy(strategy: Partial<VersioningStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
    this.emit('strategy-updated', this.strategy);
  }
}

// Export default versioning strategies
export const defaultVersioningStrategies = {
  header: {
    type: 'header' as const,
    parameterName: 'API-Version',
    defaultVersion: '2.0.0',
    supportedVersions: ['1.0.0', '2.0.0', '3.0.0'],
    deprecationPolicy: {
      warningPeriod: 90,
      supportPeriod: 180
    }
  },
  urlPath: {
    type: 'url-path' as const,
    defaultVersion: '2.0.0',
    supportedVersions: ['1.0.0', '2.0.0', '3.0.0'],
    deprecationPolicy: {
      warningPeriod: 90,
      supportPeriod: 180
    }
  },
  queryParam: {
    type: 'query-param' as const,
    parameterName: 'version',
    defaultVersion: '2.0.0',
    supportedVersions: ['1.0.0', '2.0.0', '3.0.0'],
    deprecationPolicy: {
      warningPeriod: 90,
      supportPeriod: 180
    }
  }
};
