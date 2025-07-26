import { OpenAPIV3 } from 'openapi-types';
import { EventEmitter } from 'events';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';

export interface APIDocumentation {
  version: string;
  title: string;
  description: string;
  servers: OpenAPIV3.ServerObject[];
  paths: OpenAPIV3.PathsObject;
  components: OpenAPIV3.ComponentsObject;
  tags: OpenAPIV3.TagObject[];
  externalDocs?: OpenAPIV3.ExternalDocumentationObject;
  info: OpenAPIV3.InfoObject;
  security: OpenAPIV3.SecurityRequirementObject[];
}

export interface APIExample {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  method: string;
  version: string;
  request: {
    headers?: Record<string, string>;
    parameters?: Record<string, any>;
    body?: any;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body: any;
  };
  curl?: string;
  sdkExamples?: {
    javascript?: string;
    python?: string;
    php?: string;
    java?: string;
    csharp?: string;
  };
  notes?: string[];
  tags: string[];
}

export interface APIGuide {
  id: string;
  title: string;
  description: string;
  content: string;
  category: 'getting-started' | 'authentication' | 'endpoints' | 'examples' | 'migration' | 'troubleshooting';
  order: number;
  version?: string;
  lastUpdated: Date;
  tags: string[];
  relatedGuides: string[];
}

export class APIDocumentationManager extends EventEmitter {
  private documentation: Map<string, APIDocumentation> = new Map();
  private examples: Map<string, APIExample[]> = new Map();
  private guides: Map<string, APIGuide[]> = new Map();
  private outputDir: string;

  constructor(outputDir: string = 'docs/api') {
    super();
    this.outputDir = outputDir;
    this.initializeDocumentation();
  }

  private initializeDocumentation(): void {
    // Initialize v2.0.0 documentation
    this.generateDocumentationForVersion('2.0.0');
    this.generateExamplesForVersion('2.0.0');
    this.generateGuidesForVersion('2.0.0');

    // Initialize v3.0.0 beta documentation
    this.generateDocumentationForVersion('3.0.0');
    this.generateExamplesForVersion('3.0.0');
    this.generateGuidesForVersion('3.0.0');
  }

  private generateDocumentationForVersion(version: string): void {
    const doc: APIDocumentation = {
      version,
      title: 'Healthcare Claims API',
      description: 'Comprehensive API for healthcare claim submission, processing, and management in Vietnam',
      info: {
        title: 'Healthcare Claims API',
        version,
        description: `
# Healthcare Claims API v${version}

A comprehensive RESTful API for managing healthcare claims in Vietnam, designed to integrate with:
- Vietnam Social Insurance System
- National ID verification services
- Hospital databases
- Payment gateways
- Document processing services

## Features

- **Claim Submission**: Submit healthcare claims with document attachments
- **Real-time Processing**: Track claim status in real-time
- **External Integrations**: Seamless integration with government and healthcare systems
- **Multi-language Support**: Vietnamese and English support
- **Security**: Enterprise-grade security with OAuth2, API keys, and certificate-based authentication

## Base URL

Production: \`https://api.healthclaims.vn\`
Staging: \`https://staging-api.healthclaims.vn\`
        `,
        contact: {
          name: 'API Support',
          email: 'api-support@healthclaims.vn',
          url: 'https://healthclaims.vn/support'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        },
        termsOfService: 'https://healthclaims.vn/terms'
      },
      servers: [
        {
          url: 'https://api.healthclaims.vn',
          description: 'Production server'
        },
        {
          url: 'https://staging-api.healthclaims.vn',
          description: 'Staging server'
        },
        {
          url: 'http://localhost:8080',
          description: 'Development server'
        }
      ],
      tags: [
        {
          name: 'Claims',
          description: 'Healthcare claim operations'
        },
        {
          name: 'Authentication',
          description: 'Authentication and authorization'
        },
        {
          name: 'Users',
          description: 'User management'
        },
        {
          name: 'External Integrations',
          description: 'External API integrations'
        },
        {
          name: 'Analytics',
          description: 'Analytics and reporting'
        }
      ],
      paths: {
        '/api/v2/claims': {
          post: {
            tags: ['Claims'],
            summary: 'Submit a new healthcare claim',
            description: 'Submit a new healthcare claim with patient information, treatment details, and supporting documents',
            operationId: 'submitClaim',
            security: [
              { bearerAuth: [] },
              { apiKeyAuth: [] }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ClaimSubmissionRequest'
                  },
                  examples: {
                    'basic-claim': {
                      summary: 'Basic outpatient claim',
                      value: {
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
                          procedures: [
                            {
                              code: 'P001',
                              description: 'Khám bệnh tổng quát',
                              quantity: 1,
                              unitPrice: 50000
                            }
                          ],
                          totalAmount: 500000
                        },
                        documents: [
                          {
                            type: 'medical_record',
                            content: 'base64-encoded-content',
                            mimeType: 'application/pdf',
                            filename: 'medical_record.pdf'
                          }
                        ]
                      }
                    }
                  }
                }
              }
            },
            responses: {
              '201': {
                description: 'Claim submitted successfully',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/ClaimSubmissionResponse'
                    }
                  }
                }
              },
              '400': {
                description: 'Invalid request data',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/ErrorResponse'
                    }
                  }
                }
              },
              '401': {
                description: 'Unauthorized',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/ErrorResponse'
                    }
                  }
                }
              },
              '429': {
                description: 'Rate limit exceeded',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/ErrorResponse'
                    }
                  }
                }
              }
            }
          },
          get: {
            tags: ['Claims'],
            summary: 'List healthcare claims',
            description: 'Retrieve a list of healthcare claims with optional filtering and pagination',
            operationId: 'listClaims',
            security: [
              { bearerAuth: [] },
              { apiKeyAuth: [] }
            ],
            parameters: [
              {
                name: 'page',
                in: 'query',
                description: 'Page number for pagination',
                schema: {
                  type: 'integer',
                  minimum: 1,
                  default: 1
                }
              },
              {
                name: 'limit',
                in: 'query',
                description: 'Number of claims per page',
                schema: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 100,
                  default: 20
                }
              },
              {
                name: 'status',
                in: 'query',
                description: 'Filter by claim status',
                schema: {
                  type: 'string',
                  enum: ['submitted', 'processing', 'approved', 'rejected']
                }
              },
              {
                name: 'dateFrom',
                in: 'query',
                description: 'Filter claims from this date (YYYY-MM-DD)',
                schema: {
                  type: 'string',
                  format: 'date'
                }
              },
              {
                name: 'dateTo',
                in: 'query',
                description: 'Filter claims to this date (YYYY-MM-DD)',
                schema: {
                  type: 'string',
                  format: 'date'
                }
              }
            ],
            responses: {
              '200': {
                description: 'Claims retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/ClaimListResponse'
                    }
                  }
                }
              }
            }
          }
        },
        '/api/v2/claims/{id}': {
          get: {
            tags: ['Claims'],
            summary: 'Get claim details',
            description: 'Retrieve detailed information about a specific claim',
            operationId: 'getClaim',
            security: [
              { bearerAuth: [] },
              { apiKeyAuth: [] }
            ],
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                description: 'Claim ID',
                schema: {
                  type: 'string'
                }
              },
              {
                name: 'includeHistory',
                in: 'query',
                description: 'Include status change history',
                schema: {
                  type: 'boolean',
                  default: false
                }
              }
            ],
            responses: {
              '200': {
                description: 'Claim details retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/ClaimDetailsResponse'
                    }
                  }
                }
              },
              '404': {
                description: 'Claim not found',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/ErrorResponse'
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        },
        schemas: {
          ClaimSubmissionRequest: {
            type: 'object',
            required: ['patientInfo', 'treatmentDetails', 'documents'],
            properties: {
              patientInfo: {
                $ref: '#/components/schemas/PatientInfo'
              },
              treatmentDetails: {
                $ref: '#/components/schemas/TreatmentDetails'
              },
              documents: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Document'
                }
              },
              metadata: {
                $ref: '#/components/schemas/SubmissionMetadata'
              }
            }
          },
          PatientInfo: {
            type: 'object',
            required: ['nationalId', 'name', 'dateOfBirth', 'insuranceCardNumber'],
            properties: {
              nationalId: {
                type: 'string',
                pattern: '^[0-9]{12}$',
                description: 'Vietnamese national ID (12 digits)'
              },
              name: {
                type: 'string',
                maxLength: 100,
                description: 'Patient full name'
              },
              dateOfBirth: {
                type: 'string',
                format: 'date',
                description: 'Patient date of birth (YYYY-MM-DD)'
              },
              insuranceCardNumber: {
                type: 'string',
                pattern: '^[A-Z]{2}[0-9]{13}$',
                description: 'Vietnam social insurance card number'
              },
              phone: {
                type: 'string',
                pattern: '^[0-9]{10,11}$',
                description: 'Patient phone number'
              },
              email: {
                type: 'string',
                format: 'email',
                description: 'Patient email address'
              }
            }
          },
          TreatmentDetails: {
            type: 'object',
            required: ['hospitalId', 'treatmentDate', 'diagnosis', 'totalAmount'],
            properties: {
              hospitalId: {
                type: 'string',
                description: 'Hospital identifier'
              },
              treatmentDate: {
                type: 'string',
                format: 'date-time',
                description: 'Date and time of treatment'
              },
              diagnosis: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'ICD-10 diagnosis codes'
              },
              procedures: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Procedure'
                },
                description: 'Medical procedures performed'
              },
              totalAmount: {
                type: 'number',
                minimum: 0,
                description: 'Total claim amount in VND'
              }
            }
          },
          Procedure: {
            type: 'object',
            required: ['code', 'description', 'quantity', 'unitPrice'],
            properties: {
              code: {
                type: 'string',
                description: 'Procedure code'
              },
              description: {
                type: 'string',
                description: 'Procedure description'
              },
              quantity: {
                type: 'integer',
                minimum: 1,
                description: 'Quantity of procedures'
              },
              unitPrice: {
                type: 'number',
                minimum: 0,
                description: 'Unit price in VND'
              }
            }
          },
          Document: {
            type: 'object',
            required: ['type', 'content', 'mimeType'],
            properties: {
              type: {
                type: 'string',
                enum: ['medical_record', 'invoice', 'prescription', 'lab_result', 'discharge_summary'],
                description: 'Document type'
              },
              content: {
                type: 'string',
                format: 'byte',
                description: 'Base64 encoded document content'
              },
              mimeType: {
                type: 'string',
                enum: ['application/pdf', 'image/jpeg', 'image/png'],
                description: 'Document MIME type'
              },
              filename: {
                type: 'string',
                description: 'Original filename'
              }
            }
          },
          SubmissionMetadata: {
            type: 'object',
            properties: {
              submissionChannel: {
                type: 'string',
                enum: ['web', 'mobile', 'api'],
                default: 'api'
              },
              language: {
                type: 'string',
                enum: ['vi', 'en'],
                default: 'vi'
              },
              clientVersion: {
                type: 'string',
                description: 'Client application version'
              }
            }
          },
          ClaimSubmissionResponse: {
            type: 'object',
            properties: {
              claimId: {
                type: 'string',
                description: 'Unique claim identifier'
              },
              status: {
                type: 'string',
                enum: ['submitted', 'processing'],
                description: 'Initial claim status'
              },
              submissionDate: {
                type: 'string',
                format: 'date-time',
                description: 'Submission timestamp'
              },
              trackingNumber: {
                type: 'string',
                description: 'Claim tracking number'
              },
              estimatedProcessingTime: {
                type: 'integer',
                description: 'Estimated processing time in hours'
              },
              verificationResults: {
                type: 'object',
                description: 'Initial verification results'
              }
            }
          },
          ClaimListResponse: {
            type: 'object',
            properties: {
              claims: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/ClaimSummary'
                }
              },
              pagination: {
                $ref: '#/components/schemas/Pagination'
              }
            }
          },
          ClaimSummary: {
            type: 'object',
            properties: {
              id: {
                type: 'string'
              },
              status: {
                type: 'string'
              },
              patientName: {
                type: 'string'
              },
              totalAmount: {
                type: 'number'
              },
              submissionDate: {
                type: 'string',
                format: 'date-time'
              },
              hospitalName: {
                type: 'string'
              }
            }
          },
          ClaimDetailsResponse: {
            type: 'object',
            properties: {
              claim: {
                $ref: '#/components/schemas/ClaimDetails'
              },
              statusHistory: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/StatusChange'
                }
              }
            }
          },
          ClaimDetails: {
            type: 'object',
            properties: {
              id: {
                type: 'string'
              },
              status: {
                type: 'string'
              },
              patientInfo: {
                $ref: '#/components/schemas/PatientInfo'
              },
              treatmentDetails: {
                $ref: '#/components/schemas/TreatmentDetails'
              },
              documents: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/DocumentInfo'
                }
              },
              verificationResults: {
                type: 'object'
              },
              paymentInfo: {
                type: 'object'
              }
            }
          },
          DocumentInfo: {
            type: 'object',
            properties: {
              id: {
                type: 'string'
              },
              type: {
                type: 'string'
              },
              filename: {
                type: 'string'
              },
              uploadDate: {
                type: 'string',
                format: 'date-time'
              },
              downloadUrl: {
                type: 'string'
              }
            }
          },
          StatusChange: {
            type: 'object',
            properties: {
              status: {
                type: 'string'
              },
              timestamp: {
                type: 'string',
                format: 'date-time'
              },
              reason: {
                type: 'string'
              },
              updatedBy: {
                type: 'string'
              }
            }
          },
          Pagination: {
            type: 'object',
            properties: {
              total: {
                type: 'integer'
              },
              page: {
                type: 'integer'
              },
              pages: {
                type: 'integer'
              },
              limit: {
                type: 'integer'
              }
            }
          },
          ErrorResponse: {
            type: 'object',
            properties: {
              error: {
                type: 'string'
              },
              message: {
                type: 'string'
              },
              code: {
                type: 'string'
              },
              details: {
                type: 'object'
              },
              timestamp: {
                type: 'string',
                format: 'date-time'
              }
            }
          }
        }
      },
      security: [
        { bearerAuth: [] },
        { apiKeyAuth: [] }
      ],
      externalDocs: {
        description: 'Find more info here',
        url: 'https://healthclaims.vn/docs'
      }
    };

    this.documentation.set(version, doc);
  }

  private generateExamplesForVersion(version: string): void {
    const examples: APIExample[] = [
      {
        id: 'submit-basic-claim',
        title: 'Submit Basic Outpatient Claim',
        description: 'Example of submitting a basic outpatient healthcare claim',
        endpoint: '/api/v2/claims',
        method: 'POST',
        version,
        request: {
          headers: {
            'Authorization': 'Bearer your-jwt-token',
            'Content-Type': 'application/json',
            'X-API-Version': version
          },
          body: {
            patientInfo: {
              nationalId: '123456789012',
              name: 'Nguyễn Văn A',
              dateOfBirth: '1990-01-01',
              insuranceCardNumber: 'SV4010123456789',
              phone: '0901234567',
              email: 'nguyenvana@email.com'
            },
            treatmentDetails: {
              hospitalId: 'BV001',
              treatmentDate: '2024-01-15T10:00:00Z',
              diagnosis: ['J06.9'],
              procedures: [
                {
                  code: 'P001',
                  description: 'Khám bệnh tổng quát',
                  quantity: 1,
                  unitPrice: 50000
                }
              ],
              totalAmount: 500000
            },
            documents: [
              {
                type: 'medical_record',
                content: 'JVBERi0xLjQKJcOkw7zDtsKMCjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyMCBUZAooSGVsbG8gV29ybGQhKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCgo=',
                mimeType: 'application/pdf',
                filename: 'medical_record.pdf'
              }
            ],
            metadata: {
              submissionChannel: 'api',
              language: 'vi',
              clientVersion: '1.0.0'
            }
          }
        },
        response: {
          status: 201,
          body: {
            claimId: 'CL-2024-001234',
            status: 'submitted',
            submissionDate: '2024-01-15T10:05:00Z',
            trackingNumber: 'TN123456789',
            estimatedProcessingTime: 72,
            verificationResults: {
              nationalIdVerified: true,
              insuranceCardVerified: true,
              hospitalVerified: true
            }
          }
        },
        curl: `curl -X POST "https://api.healthclaims.vn/api/v2/claims" \\
  -H "Authorization: Bearer your-jwt-token" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Version: ${version}" \\
  -d '{
    "patientInfo": {
      "nationalId": "123456789012",
      "name": "Nguyễn Văn A",
      "dateOfBirth": "1990-01-01",
      "insuranceCardNumber": "SV4010123456789"
    },
    "treatmentDetails": {
      "hospitalId": "BV001",
      "treatmentDate": "2024-01-15T10:00:00Z",
      "diagnosis": ["J06.9"],
      "totalAmount": 500000
    },
    "documents": [
      {
        "type": "medical_record",
        "content": "base64-encoded-content",
        "mimeType": "application/pdf"
      }
    ]
  }'`,
        sdkExamples: {
          javascript: `
const response = await fetch('https://api.healthclaims.vn/api/v2/claims', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json',
    'X-API-Version': '${version}'
  },
  body: JSON.stringify({
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
  })
});

const claim = await response.json();
console.log('Claim submitted:', claim.claimId);
          `,
          python: `
import requests
import json

url = "https://api.healthclaims.vn/api/v2/claims"
headers = {
    "Authorization": "Bearer your-jwt-token",
    "Content-Type": "application/json",
    "X-API-Version": "${version}"
}

data = {
    "patientInfo": {
        "nationalId": "123456789012",
        "name": "Nguyễn Văn A",
        "dateOfBirth": "1990-01-01",
        "insuranceCardNumber": "SV4010123456789"
    },
    "treatmentDetails": {
        "hospitalId": "BV001",
        "treatmentDate": "2024-01-15T10:00:00Z",
        "diagnosis": ["J06.9"],
        "totalAmount": 500000
    },
    "documents": [
        {
            "type": "medical_record",
            "content": "base64-encoded-content",
            "mimeType": "application/pdf"
        }
    ]
}

response = requests.post(url, headers=headers, json=data)
claim = response.json()
print(f"Claim submitted: {claim['claimId']}")
          `
        },
        notes: [
          'National ID must be exactly 12 digits',
          'Insurance card number follows format: 2 letters + 13 digits',
          'Documents must be base64 encoded',
          'All amounts are in Vietnamese Dong (VND)'
        ],
        tags: ['claims', 'submission', 'outpatient']
      },
      {
        id: 'get-claim-status',
        title: 'Get Claim Status',
        description: 'Retrieve current status and details of a submitted claim',
        endpoint: '/api/v2/claims/{id}',
        method: 'GET',
        version,
        request: {
          headers: {
            'Authorization': 'Bearer your-jwt-token',
            'X-API-Version': version
          },
          parameters: {
            id: 'CL-2024-001234',
            includeHistory: true
          }
        },
        response: {
          status: 200,
          body: {
            claim: {
              id: 'CL-2024-001234',
              status: 'approved',
              patientInfo: {
                nationalId: '123456789012',
                name: 'Nguyễn Văn A',
                insuranceCardNumber: 'SV4010123456789'
              },
              treatmentDetails: {
                hospitalId: 'BV001',
                hospitalName: 'Bệnh viện Chợ Rẫy',
                treatmentDate: '2024-01-15T10:00:00Z',
                totalAmount: 500000,
                approvedAmount: 450000
              },
              verificationResults: {
                nationalIdVerified: true,
                insuranceCardVerified: true,
                hospitalVerified: true,
                fraudScore: 0.05
              },
              paymentInfo: {
                method: 'bank_transfer',
                bankAccount: '1234567890',
                expectedPaymentDate: '2024-01-20'
              }
            },
            statusHistory: [
              {
                status: 'submitted',
                timestamp: '2024-01-15T10:05:00Z',
                updatedBy: 'system'
              },
              {
                status: 'processing',
                timestamp: '2024-01-16T09:00:00Z',
                updatedBy: 'system'
              },
              {
                status: 'approved',
                timestamp: '2024-01-17T14:30:00Z',
                reason: 'All verification checks passed',
                updatedBy: 'admin@healthclaims.vn'
              }
            ]
          }
        },
        curl: `curl -X GET "https://api.healthclaims.vn/api/v2/claims/CL-2024-001234?includeHistory=true" \\
  -H "Authorization: Bearer your-jwt-token" \\
  -H "X-API-Version: ${version}"`,
        tags: ['claims', 'status', 'tracking']
      }
    ];

    this.examples.set(version, examples);
  }

  private generateGuidesForVersion(version: string): void {
    const guides: APIGuide[] = [
      {
        id: 'getting-started',
        title: 'Getting Started',
        description: 'Quick start guide for the Healthcare Claims API',
        content: `
# Getting Started with Healthcare Claims API

## Overview

The Healthcare Claims API provides a comprehensive solution for submitting, processing, and tracking healthcare claims in Vietnam. This guide will help you get started with the API.

## Prerequisites

Before you start, you'll need:

1. **API Credentials**: Contact our support team to get your API key and access token
2. **Development Environment**: Set up your development environment with HTTPS support
3. **Test Data**: Use our sandbox environment for testing

## Base URLs

- **Production**: \`https://api.healthclaims.vn\`
- **Staging**: \`https://staging-api.healthclaims.vn\`
- **Sandbox**: \`https://sandbox-api.healthclaims.vn\`

## Authentication

The API supports two authentication methods:

### 1. Bearer Token (JWT)
\`\`\`http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

### 2. API Key
\`\`\`http
X-API-Key: your-api-key-here
\`\`\`

## Your First API Call

Let's start with a simple API call to check your authentication:

\`\`\`bash
curl -X GET "https://api.healthclaims.vn/api/v2/ping" \\
  -H "Authorization: Bearer your-jwt-token" \\
  -H "X-API-Version: ${version}"
\`\`\`

## Submit Your First Claim

Here's how to submit a basic healthcare claim:

\`\`\`bash
curl -X POST "https://api.healthclaims.vn/api/v2/claims" \\
  -H "Authorization: Bearer your-jwt-token" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Version: ${version}" \\
  -d '{
    "patientInfo": {
      "nationalId": "123456789012",
      "name": "Nguyễn Văn A",
      "dateOfBirth": "1990-01-01",
      "insuranceCardNumber": "SV4010123456789"
    },
    "treatmentDetails": {
      "hospitalId": "BV001",
      "treatmentDate": "2024-01-15T10:00:00Z",
      "diagnosis": ["J06.9"],
      "totalAmount": 500000
    },
    "documents": [
      {
        "type": "medical_record",
        "content": "base64-encoded-pdf-content",
        "mimeType": "application/pdf"
      }
    ]
  }'
\`\`\`

## Next Steps

1. **Explore Examples**: Check out our comprehensive examples section
2. **Read the API Reference**: Detailed documentation for all endpoints
3. **Join the Community**: Connect with other developers in our forum
4. **Get Support**: Contact our technical support team for assistance

## Rate Limits

The API has the following rate limits:

- **POST /claims**: 10 requests per minute
- **GET /claims**: 100 requests per minute
- **Other endpoints**: 50 requests per minute

## Error Handling

The API uses standard HTTP status codes and returns detailed error messages:

\`\`\`json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid national ID format",
  "code": "INVALID_NATIONAL_ID",
  "details": {
    "field": "patientInfo.nationalId",
    "expected": "12 digits",
    "received": "11 digits"
  },
  "timestamp": "2024-01-15T10:05:00Z"
}
\`\`\`
        `,
        category: 'getting-started',
        order: 1,
        version,
        lastUpdated: new Date(),
        tags: ['quickstart', 'authentication', 'first-steps'],
        relatedGuides: ['authentication-guide', 'error-handling']
      },
      {
        id: 'authentication-guide',
        title: 'Authentication & Authorization',
        description: 'Complete guide to API authentication and authorization',
        content: `
# Authentication & Authorization

## Overview

The Healthcare Claims API uses a multi-layered security approach to ensure the safety and privacy of healthcare data.

## Authentication Methods

### 1. JWT Bearer Tokens

JWT tokens are the preferred method for user-based authentication:

\`\`\`http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

**Getting a JWT Token:**

\`\`\`bash
curl -X POST "https://api.healthclaims.vn/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
\`\`\`

**Response:**
\`\`\`json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "refreshToken": "refresh-token-here"
}
\`\`\`

### 2. API Keys

API keys are ideal for server-to-server communication:

\`\`\`http
X-API-Key: hc_live_1234567890abcdef
\`\`\`

**API Key Types:**
- **Live Keys**: For production use (\`hc_live_...\`)
- **Test Keys**: For development (\`hc_test_...\`)

### 3. Certificate-Based Authentication

For high-security integrations with government systems:

\`\`\`http
X-Client-Certificate: base64-encoded-certificate
\`\`\`

## Authorization Scopes

The API uses a role-based permission system:

### User Roles

- **Patient**: Can submit and view own claims
- **Provider**: Can submit claims for patients
- **Admin**: Full access to all claims and system management
- **Auditor**: Read-only access for compliance purposes

### Permission Scopes

- \`claims:submit\`: Submit new claims
- \`claims:read\`: Read claim information
- \`claims:update\`: Update claim status
- \`claims:delete\`: Delete claims (admin only)
- \`patients:read\`: Access patient information
- \`analytics:read\`: Access analytics data

## Security Best Practices

### 1. Token Management

- **Store tokens securely**: Never expose tokens in client-side code
- **Use refresh tokens**: Implement automatic token refresh
- **Set appropriate expiration**: Use short-lived access tokens

### 2. API Key Security

- **Environment variables**: Store API keys in environment variables
- **Rotate regularly**: Change API keys periodically
- **Monitor usage**: Track API key usage for suspicious activity

### 3. Request Security

- **Use HTTPS**: All API requests must use HTTPS
- **Validate certificates**: Verify SSL certificates
- **Rate limiting**: Implement client-side rate limiting

## Error Responses

### Authentication Errors

\`\`\`json
{
  "error": "AUTHENTICATION_FAILED",
  "message": "Invalid or expired token",
  "code": "INVALID_TOKEN",
  "timestamp": "2024-01-15T10:05:00Z"
}
\`\`\`

### Authorization Errors

\`\`\`json
{
  "error": "AUTHORIZATION_FAILED",
  "message": "Insufficient permissions",
  "code": "PERMISSION_DENIED",
  "requiredPermissions": ["claims:submit"],
  "timestamp": "2024-01-15T10:05:00Z"
}
\`\`\`

## Testing Authentication

Use our authentication test endpoint:

\`\`\`bash
curl -X GET "https://api.healthclaims.vn/auth/verify" \\
  -H "Authorization: Bearer your-token"
\`\`\`

**Success Response:**
\`\`\`json
{
  "valid": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "roles": ["provider"],
    "permissions": ["claims:submit", "claims:read"]
  },
  "expiresAt": "2024-01-15T11:05:00Z"
}
\`\`\`
        `,
        category: 'authentication',
        order: 2,
        version,
        lastUpdated: new Date(),
        tags: ['security', 'jwt', 'api-keys', 'permissions'],
        relatedGuides: ['getting-started', 'error-handling']
      }
    ];

    this.guides.set(version, guides);
  }

  public async generateOpenAPISpec(version: string): Promise<string> {
    const doc = this.documentation.get(version);
    if (!doc) {
      throw new Error(`Documentation for version ${version} not found`);
    }

    return yaml.dump(doc, { indent: 2, lineWidth: 120 });
  }

  public async generateSwaggerJSON(version: string): Promise<string> {
    const doc = this.documentation.get(version);
    if (!doc) {
      throw new Error(`Documentation for version ${version} not found`);
    }

    return JSON.stringify(doc, null, 2);
  }

  public async exportDocumentation(version: string, format: 'yaml' | 'json' = 'yaml'): Promise<void> {
    const doc = this.documentation.get(version);
    if (!doc) {
      throw new Error(`Documentation for version ${version} not found`);
    }

    const versionDir = path.join(this.outputDir, version);
    await fs.mkdir(versionDir, { recursive: true });

    if (format === 'yaml') {
      const yamlContent = await this.generateOpenAPISpec(version);
      await fs.writeFile(path.join(versionDir, 'openapi.yaml'), yamlContent);
    } else {
      const jsonContent = await this.generateSwaggerJSON(version);
      await fs.writeFile(path.join(versionDir, 'openapi.json'), jsonContent);
    }

    // Export examples
    const examples = this.examples.get(version) || [];
    await fs.writeFile(
      path.join(versionDir, 'examples.json'),
      JSON.stringify(examples, null, 2)
    );

    // Export guides
    const guides = this.guides.get(version) || [];
    const guidesDir = path.join(versionDir, 'guides');
    await fs.mkdir(guidesDir, { recursive: true });

    for (const guide of guides) {
      await fs.writeFile(
        path.join(guidesDir, `${guide.id}.md`),
        guide.content
      );
    }

    this.emit('documentation-exported', { version, format, outputDir: versionDir });
  }

  public getDocumentation(version: string): APIDocumentation | undefined {
    return this.documentation.get(version);
  }

  public getAllVersions(): string[] {
    return Array.from(this.documentation.keys());
  }

  public getExamples(version: string): APIExample[] {
    return this.examples.get(version) || [];
  }

  public getGuides(version: string): APIGuide[] {
    return this.guides.get(version) || [];
  }

  public addExample(version: string, example: APIExample): void {
    const examples = this.examples.get(version) || [];
    examples.push(example);
    this.examples.set(version, examples);
    this.emit('example-added', { version, example });
  }

  public addGuide(version: string, guide: APIGuide): void {
    const guides = this.guides.get(version) || [];
    guides.push(guide);
    this.guides.set(version, guides);
    this.emit('guide-added', { version, guide });
  }

  public updateDocumentation(version: string, updates: Partial<APIDocumentation>): void {
    const doc = this.documentation.get(version);
    if (doc) {
      const updatedDoc = { ...doc, ...updates };
      this.documentation.set(version, updatedDoc);
      this.emit('documentation-updated', { version, updates });
    }
  }

  public generateSDKExample(language: string, example: APIExample): string {
    switch (language) {
      case 'javascript':
        return this.generateJavaScriptExample(example);
      case 'python':
        return this.generatePythonExample(example);
      case 'php':
        return this.generatePHPExample(example);
      case 'java':
        return this.generateJavaExample(example);
      case 'csharp':
        return this.generateCSharpExample(example);
      default:
        return example.curl || 'SDK example not available for this language';
    }
  }

  private generateJavaScriptExample(example: APIExample): string {
    const headers = example.request.headers || {};
    const body = example.request.body ? JSON.stringify(example.request.body, null, 2) : 'undefined';

    return `
// ${example.title}
const response = await fetch('https://api.healthclaims.vn${example.endpoint}', {
  method: '${example.method}',
  headers: ${JSON.stringify(headers, null, 2)},
  ${example.request.body ? `body: ${body}` : ''}
});

const data = await response.json();
console.log(data);
    `.trim();
  }

  private generatePythonExample(example: APIExample): string {
    const headers = example.request.headers || {};
    const body = example.request.body ? JSON.stringify(example.request.body, null, 2) : 'None';

    return `
# ${example.title}
import requests
import json

url = "https://api.healthclaims.vn${example.endpoint}"
headers = ${JSON.stringify(headers, null, 2).replace(/"/g, "'")}
${example.request.body ? `data = ${body.replace(/"/g, "'")}` : ''}

response = requests.${example.method.toLowerCase()}(url, headers=headers${example.request.body ? ', json=data' : ''})
data = response.json()
print(data)
    `.trim();
  }

  private generatePHPExample(example: APIExample): string {
    const headers = example.request.headers || {};
    
    return `
<?php
// ${example.title}
$url = "https://api.healthclaims.vn${example.endpoint}";
$headers = [
${Object.entries(headers).map(([key, value]) => `    "${key}: ${value}"`).join(',\n')}
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
${example.method !== 'GET' ? `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${example.method}");` : ''}
${example.request.body ? `curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(${JSON.stringify(example.request.body)}));` : ''}

$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
print_r($data);
?>
    `.trim();
  }

  private generateJavaExample(example: APIExample): string {
    return `
// ${example.title}
// Java example using OkHttp
import okhttp3.*;
import java.io.IOException;

OkHttpClient client = new OkHttpClient();

${example.request.body ? `
RequestBody body = RequestBody.create(
    "${JSON.stringify(example.request.body)}",
    MediaType.get("application/json; charset=utf-8")
);
` : 'RequestBody body = null;'}

Request request = new Request.Builder()
    .url("https://api.healthclaims.vn${example.endpoint}")
    .method("${example.method}", body)
${Object.entries(example.request.headers || {}).map(([key, value]) => `    .addHeader("${key}", "${value}")`).join('\n')}
    .build();

try (Response response = client.newCall(request).execute()) {
    System.out.println(response.body().string());
}
    `.trim();
  }

  private generateCSharpExample(example: APIExample): string {
    return `
// ${example.title}
using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program
{
    private static readonly HttpClient client = new HttpClient();

    static async Task Main()
    {
${Object.entries(example.request.headers || {}).map(([key, value]) => `        client.DefaultRequestHeaders.Add("${key}", "${value}");`).join('\n')}

        ${example.request.body ? `
        var json = @"${JSON.stringify(example.request.body)}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        ` : 'HttpContent content = null;'}

        var response = await client.${example.method === 'POST' ? 'PostAsync' : example.method === 'GET' ? 'GetAsync' : 'SendAsync'}(
            "https://api.healthclaims.vn${example.endpoint}"${example.request.body ? ', content' : ''}
        );

        var responseString = await response.Content.ReadAsStringAsync();
        Console.WriteLine(responseString);
    }
}
    `.trim();
  }

  public async generatePostmanCollection(version: string): Promise<any> {
    const doc = this.documentation.get(version);
    const examples = this.examples.get(version) || [];

    if (!doc) {
      throw new Error(`Documentation for version ${version} not found`);
    }

    const collection = {
      info: {
        name: `Healthcare Claims API v${version}`,
        description: doc.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{bearerToken}}',
            type: 'string'
          }
        ]
      },
      variable: [
        {
          key: 'baseUrl',
          value: 'https://api.healthclaims.vn',
          type: 'string'
        },
        {
          key: 'version',
          value: version,
          type: 'string'
        }
      ],
      item: examples.map(example => ({
        name: example.title,
        request: {
          method: example.method,
          header: Object.entries(example.request.headers || {}).map(([key, value]) => ({
            key,
            value: value.replace(version, '{{version}}'),
            type: 'text'
          })),
          url: {
            raw: `{{baseUrl}}${example.endpoint}`,
            host: ['{{baseUrl}}'],
            path: example.endpoint.split('/').filter(Boolean)
          },
          ...(example.request.body && {
            body: {
              mode: 'raw',
              raw: JSON.stringify(example.request.body, null, 2),
              options: {
                raw: {
                  language: 'json'
                }
              }
            }
          })
        },
        response: [
          {
            name: `${example.response.status} Response`,
            status: example.response.status === 200 ? 'OK' : 
                   example.response.status === 201 ? 'Created' :
                   example.response.status === 400 ? 'Bad Request' :
                   example.response.status === 401 ? 'Unauthorized' :
                   example.response.status === 404 ? 'Not Found' : 'Response',
            code: example.response.status,
            header: Object.entries(example.response.headers || {}).map(([key, value]) => ({
              key,
              value,
              type: 'text'
            })),
            body: JSON.stringify(example.response.body, null, 2)
          }
        ]
      }))
    };

    return collection;
  }

  public async exportPostmanCollection(version: string): Promise<void> {
    const collection = await this.generatePostmanCollection(version);
    const versionDir = path.join(this.outputDir, version);
    await fs.mkdir(versionDir, { recursive: true });
    
    await fs.writeFile(
      path.join(versionDir, 'postman-collection.json'),
      JSON.stringify(collection, null, 2)
    );

    this.emit('postman-collection-exported', { version, outputDir: versionDir });
  }
}
