# External Integrations

This module contains all third-party API integrations for the healthcare claim system.

## Structure

- `third-party-apis/` - Core third-party integrations
- `config/` - Integration configurations
- `types/` - TypeScript type definitions
- `utils/` - Utility functions for integrations

## Available Integrations

### Communication Services
- SMS Gateway (Viettel, VNPT)
- Email Service (SendGrid)

### Storage & Processing
- Cloud Storage (AWS S3/MinIO)
- OCR Service

### Location & Verification
- Maps API
- Identity Verification APIs

### Payment & Healthcare
- Payment Gateways
- Hospital Database Integration
- Government API Connections

### Infrastructure
- API Rate Limiting
- Error Handling
- Retry Mechanisms

## Configuration

All integrations use environment variables for configuration. Check `.env.example` for required variables.

## Usage

```typescript
import { IntegrationManager } from './IntegrationManager';

const integrations = new IntegrationManager();
await integrations.initialize();
```
