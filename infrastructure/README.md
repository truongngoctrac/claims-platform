# DevOps Foundation - Vietnamese Healthcare Claims System

This directory contains the complete DevOps infrastructure for the Vietnamese Healthcare Claims Processing System, providing production-ready CI/CD pipelines, environment management, and monitoring capabilities.

## 📁 Infrastructure Overview

```
infrastructure/
├── 📁 ci-cd-pipeline/
│   ├── ✅ GitHub Actions workflows (CI/CD)
│   ├── ✅ Automated testing pipeline
│   ├── ✅ Code quality checks (SonarQube)
│   ├── ✅ Security scanning setup
│   └── ✅ Deployment automation scripts
│
├── 📁 environment-setup/
│   ├── ✅ Development environment (Docker Compose)
│   ├── ✅ Staging environment configuration
│   ├── ✅ Environment variables management
│   ├── ✅ Database backup scripts
│   └── ✅ Log aggregation setup
│
└── 📁 monitoring-basic/
    ├── ✅ Health check endpoints
    ├── ✅ Basic application monitoring
    ├── ✅ Error tracking with Sentry
    ├── ✅ Uptime monitoring
    └── ✅ Alert notifications setup
```

## 🚀 Quick Start

### 1. Development Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd vietnamese-healthcare-claims

# Start development environment
cd infrastructure/environment-setup
docker-compose -f docker-compose.development.yml up -d

# Access services:
# - Frontend: http://localhost:3000
# - API Gateway: http://localhost:8000
# - MongoDB: localhost:27017
# - Redis: localhost:6379
# - Elasticsearch: http://localhost:9200
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3001
```

### 2. Staging Environment

```bash
# Configure environment variables
cp .env.staging.example .env.staging
# Edit .env.staging with your configuration

# Deploy to staging
docker-compose -f docker-compose.staging.yml up -d
```

### 3. CI/CD Pipeline Setup

The GitHub Actions workflows are automatically triggered on:
- **CI Pipeline**: Push/PR to main/develop branches
- **CD Pipeline**: Push to main branch
- **Security Scan**: Weekly schedule + manual trigger

## 🔧 CI/CD Pipeline Components

### GitHub Actions Workflows

#### 1. CI Pipeline (`.github/workflows/ci.yml`)
- **Frontend Testing**: TypeScript type checking, unit tests, build verification
- **Backend Testing**: Python service testing with coverage reports
- **Code Quality**: SonarCloud analysis for code quality metrics
- **Security Scanning**: Trivy, Snyk, and container security scans
- **Integration Tests**: Full-stack integration testing
- **Accessibility Tests**: Automated accessibility compliance checking
- **Performance Tests**: Lighthouse CI for frontend performance

#### 2. CD Pipeline (`.github/workflows/cd.yml`)
- **Container Building**: Multi-service Docker image building and registry push
- **Environment Deployment**: Automated staging and production deployments
- **Database Migrations**: Automated database schema updates
- **Health Checks**: Post-deployment verification and monitoring
- **Rollback Support**: Automatic rollback on deployment failures

#### 3. Security Pipeline (`.github/workflows/security-scan.yml`)
- **Dependency Scanning**: NPM audit and Python safety checks
- **Code Analysis**: CodeQL static analysis for security vulnerabilities
- **Secret Scanning**: TruffleHog for exposed credentials detection
- **Container Security**: Comprehensive Docker image vulnerability scanning
- **Compliance Checks**: Healthcare-specific compliance verification

### SonarQube Configuration
```bash
# Project configured with:
# - TypeScript/JavaScript analysis
# - Python code analysis
# - Coverage reporting
# - Healthcare compliance rules
# - Quality gate enforcement
```

### Deployment Automation
```bash
# Manual deployment
./infrastructure/ci-cd-pipeline/deploy.sh staging v1.2.3

# Automated deployment via GitHub Actions
# Triggers on main branch push
```

## 🐳 Environment Management

### Development Environment Features
- **Hot Reload**: Real-time code changes for both frontend and backend
- **Service Discovery**: Internal DNS resolution between containers
- **Development Tools**: MailHog for email testing, debugging tools
- **Sample Data**: Automated database seeding with test data
- **Mock Services**: External API mocking for offline development

### Staging Environment Features
- **Production-Like**: Mirrors production configuration and constraints
- **SSL/TLS**: HTTPS enforcement with Let's Encrypt certificates
- **Resource Limits**: CPU and memory constraints matching production
- **Monitoring Stack**: Full Prometheus + Grafana + Loki setup
- **Backup Systems**: Automated daily backups with encryption

### Environment Variables Management
```bash
# Development
.env.development    # Development-specific configuration
.env.staging       # Staging environment configuration
.env.production    # Production environment configuration (template)

# Security: Use environment variable injection for sensitive values
# Never commit production secrets to version control
```

### Docker Compose Services

#### Core Application Services
- **Frontend**: React SPA with Vite development server
- **API Gateway**: FastAPI/Express.js reverse proxy and rate limiting
- **Claims Service**: Python Flask microservice for claims processing
- **Policy Service**: Python Flask microservice for policy management
- **User Service**: Python Flask microservice for user management

#### Infrastructure Services
- **MongoDB**: Primary database with replication support
- **Redis**: Caching layer and session store
- **Elasticsearch**: Search engine and log aggregation
- **Nginx**: Load balancer and static file serving

#### Monitoring Services
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization dashboards and analytics
- **Loki**: Log aggregation and analysis
- **Promtail**: Log collection agent

## 📊 Monitoring & Observability

### Health Check Endpoints

#### Basic Health Checks
```
GET /health              # Basic application health
GET /health/detailed     # Comprehensive system health
GET /health/ready        # Kubernetes readiness probe
GET /health/live         # Kubernetes liveness probe
GET /metrics            # Prometheus metrics
```

#### Healthcare-Specific Checks
```
GET /health/healthcare   # Healthcare compliance status
GET /health/database     # Database connectivity
GET /health/redis        # Cache connectivity
GET /health/external     # External API status
```

### Monitoring Stack

#### Prometheus Configuration
- **Metrics Collection**: Application and infrastructure metrics
- **Alerting Rules**: Healthcare-specific alert conditions
- **Service Discovery**: Automatic service monitoring setup
- **Data Retention**: 30 days for staging, 90 days for production

#### Grafana Dashboards
- **Application Overview**: Key performance indicators
- **Healthcare Metrics**: Claims processing, patient data access
- **Infrastructure Health**: System resources and performance
- **Security Dashboard**: Compliance and audit metrics

#### Log Aggregation with Loki
- **Structured Logging**: JSON format with healthcare context
- **Log Retention**: 7 days for development, 30 days for staging
- **Vietnamese Compliance**: Audit trail for regulatory requirements
- **Security Filtering**: PII/PHI data sanitization

### Error Tracking with Sentry

#### Frontend Integration
```typescript
// Sentry configuration with healthcare privacy compliance
import { initSentry, reportHealthcareError } from '@/lib/sentry';

initSentry(); // Initializes with PII filtering

// Healthcare-specific error reporting
reportHealthcareError(error, {
  userId: 'anonymized-id',
  feature: 'claims-processing',
  severity: 'critical'
});
```

#### Backend Integration
```python
# Python services integration
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[FlaskIntegration()],
    traces_sample_rate=1.0,
    before_send=filter_healthcare_data  # PII/PHI filtering
)
```

### Uptime Monitoring

#### Monitoring Targets
- **Production Services**: 60-second intervals
- **Staging Services**: 5-minute intervals
- **Health Endpoints**: 30-second intervals
- **External Dependencies**: 2-minute intervals

#### Alert Thresholds
- **Response Time**: Warning >2s, Critical >5s
- **Availability**: Warning <99.5%, Critical <99%
- **Error Rate**: Warning >1%, Critical >5%

## 🔐 Security & Compliance

### Security Scanning
- **Dependency Vulnerabilities**: Daily automated scans
- **Container Security**: Pre-deployment image scanning
- **Code Analysis**: Static analysis for security vulnerabilities
- **Secret Detection**: Automated credential scanning

### Healthcare Compliance
- **GDPR Compliance**: Data protection and privacy controls
- **Vietnamese Healthcare Law**: Local regulatory compliance
- **Audit Logging**: Comprehensive audit trail for all operations
- **Data Encryption**: At-rest and in-transit encryption

### Backup & Disaster Recovery

#### Database Backup Strategy
```bash
# Automated daily backups
./infrastructure/environment-setup/backup-database.sh staging

# Features:
# - Encrypted backups with AES-256
# - Compressed storage optimization
# - Cloud storage integration (S3)
# - 30-day retention policy
# - Point-in-time recovery support
```

#### Backup Components
- **MongoDB**: Full database dumps with compression
- **Redis**: RDB snapshots with incremental backups
- **Elasticsearch**: Index snapshots and configurations
- **Application Logs**: Structured log backup and archival
- **Configuration Files**: Environment and deployment configs

## 🚨 Alert & Notification System

### Notification Channels
- **Slack**: Real-time team notifications with Vietnamese messages
- **Microsoft Teams**: Enterprise communication integration
- **Email**: Critical alerts with detailed reports
- **PagerDuty**: On-call rotation for critical incidents
- **Custom Webhooks**: Integration with external systems

### Alert Severity Levels
- **Critical**: Service outages, security breaches, compliance violations
- **High**: Performance degradation, partial service failures
- **Medium**: Minor issues, configuration warnings
- **Low**: Informational alerts, maintenance notifications

### Healthcare-Specific Alerts
```typescript
// Patient data access alerts
await healthcareAlertService.sendPatientDataAlert({
  type: 'unauthorized_access',
  description: 'Attempted unauthorized patient data access',
  service: 'user-management-service',
  unauthorized_access: true
});

// Compliance violation alerts
await healthcareAlertService.sendHealthcareComplianceAlert({
  type: 'GDPR Violation',
  description: 'Patient consent not properly recorded',
  service: 'claims-service',
  patient_affected: true,
  regulation_violated: 'GDPR Article 7'
});
```

## 🔧 Deployment Automation

### Deployment Script Features
```bash
./infrastructure/ci-cd-pipeline/deploy.sh production v1.2.3

# Automated deployment includes:
# - Pre-deployment health checks
# - Database backup creation
# - Blue-green deployment support
# - Health verification post-deployment
# - Automatic rollback on failure
# - Notification to team channels
```

### Smoke Test Suite
```bash
./infrastructure/ci-cd-pipeline/smoke-tests.sh staging

# Comprehensive testing:
# - Frontend functionality verification
# - API endpoint validation
# - Database connectivity testing
# - Performance threshold checking
# - Security header verification
# - Healthcare compliance validation
```

## 📋 Maintenance & Operations

### Regular Maintenance Tasks
- **Weekly**: Security scan reviews and dependency updates
- **Monthly**: Performance optimization and capacity planning
- **Quarterly**: Disaster recovery testing and compliance audits
- **Annually**: Security architecture review and penetration testing

### Troubleshooting Guides
- **Service Down**: Check health endpoints and container logs
- **Performance Issues**: Review Grafana dashboards and metrics
- **Database Problems**: Verify connectivity and run diagnostics
- **Security Alerts**: Follow incident response procedures

### Environment Scaling
```bash
# Horizontal scaling for high load
docker-compose -f docker-compose.staging.yml scale claims-service=3

# Resource allocation adjustment
# Edit service resource limits in docker-compose files
```

## 📞 Support & Documentation

### Additional Resources
- **API Documentation**: Available at `/api/docs` endpoints
- **Monitoring Dashboards**: Grafana at `:3001` port
- **Log Analysis**: Loki/Grafana integration
- **Health Status**: Status page at `/status` endpoint

### Team Contacts
- **DevOps Team**: devops@healthcare-claims.vn
- **Security Team**: security@healthcare-claims.vn
- **On-Call Support**: oncall@healthcare-claims.vn

---

## 🇻🇳 Vietnamese Healthcare Compliance

This infrastructure is specifically designed for Vietnamese healthcare regulations and includes:

- **Patient Data Protection**: GDPR-compliant data handling with Vietnamese healthcare law requirements
- **Audit Trail**: Comprehensive logging for regulatory compliance
- **Data Retention**: 7-year retention policy as required by Vietnamese healthcare regulations
- **Localization**: Vietnamese language support for alerts and notifications
- **Security Standards**: Healthcare-grade security controls and monitoring

For detailed configuration and advanced setup, refer to the individual service documentation in each subdirectory.
