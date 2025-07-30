# Claims Module - ClaimFlow

## Mô tả
Module bồi thường (Claims) hoàn chỉnh được export từ dự án ClaimFlow để tích hợp vào các ứng dụng khác.

## Tính năng chính

### 1. Frontend Components
- **Pages**: Nộp hồ sơ, tra cứu hồ sơ, dashboard, tìm kiếm nâng cao
- **UI Components**: Thư viện UI components hoàn chỉnh (Radix UI + TailwindCSS)
- **Admin Components**: Quản lý hồ sơ, analytics, audit log
- **Search Components**: Tìm kiếm thông minh, bộ lọc nâng cao

### 2. Backend Services
- **Claims Management**: CRUD operations, workflow automation
- **Document Processing**: AI-powered OCR, classification, validation
- **Search Services**: ElasticSearch integration, smart suggestions
- **Analytics & Reporting**: Real-time analytics, custom reports
- **Payment Integration**: VNPay, PayPal, Stripe gateways

### 3. AI/ML Features
- **Document AI**: Tự động phân loại và trích xuất thông tin
- **Predictive Analytics**: Dự đoán thời gian xử lý, scoring approval
- **Smart Recommendations**: Gợi ý tài liệu, auto-fill forms
- **Fraud Detection**: Phát hiện gian lận bằng ML

### 4. Infrastructure
- **Security**: Advanced encryption, audit trails, compliance
- **Performance**: Caching strategies, database optimization
- **Scalability**: Auto-scaling, distributed systems, event sourcing

## Cấu trúc thư mục

```
claims-package/
├── frontend/                    # React components và pages
│   ├── components/             # UI components
│   ├── pages/                  # Claim pages (submit, track, dashboard)
│   ├── hooks/                  # Custom React hooks
│   ├── contexts/              # React contexts
│   ├── lib/                   # Utilities và helpers
│   └── styles/                # CSS và styling
├── backend/                    # Server-side logic
│   ├── routes/                # API endpoints
│   ├── services/              # Business logic services
│   ├── models/                # Data models
│   └── middleware/            # Express middleware
├── ai-ml/                      # AI/ML services
│   ├── document-ai/           # Document processing
│   ├── predictive-analytics/  # Dự đoán và scoring
│   └── smart-recommendations/ # Gợi ý thông minh
├── shared/                     # Shared types và interfaces
├── config/                     # Configuration files
├── assets/                     # Static assets
└── docs/                      # Documentation
```

## Cài đặt

### Yêu cầu hệ thống
- Node.js 18+
- React 18+
- TypeScript 5+
- TailwindCSS 3+

### Dependencies chính
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "@tanstack/react-query": "^5.56.2",
    "@radix-ui/react-*": "latest",
    "tailwindcss": "^3.4.11",
    "lucide-react": "^0.462.0",
    "zod": "^3.23.8",
    "express": "^4.18.2",
    "mongodb": "^6.18.0",
    "mongoose": "^8.16.4"
  }
}
```

## Sử dụng

### 1. Frontend Integration
```typescript
import { ClaimsProvider, ClaimsRoutes } from '@claims/frontend';
import { ClaimsTheme } from '@claims/frontend/styles';

function App() {
  return (
    <ClaimsProvider>
      <ClaimsTheme>
        <ClaimsRoutes />
      </ClaimsTheme>
    </ClaimsProvider>
  );
}
```

### 2. Backend Integration
```typescript
import { claimsRoutes, claimsServices } from '@claims/backend';
import express from 'express';

const app = express();
app.use('/api/claims', claimsRoutes);
```

### 3. AI/ML Integration
```typescript
import { DocumentAI, PredictiveAnalytics } from '@claims/ai-ml';

const documentProcessor = new DocumentAI();
const claimScoring = new PredictiveAnalytics();
```

## Cấu hình

### Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/claims
REDIS_URL=redis://localhost:6379

# AI/ML Services
OPENAI_API_KEY=your_openai_key
DOCUMENT_AI_ENDPOINT=your_endpoint

# Payment Gateways
VNPAY_MERCHANT_ID=your_merchant_id
STRIPE_SECRET_KEY=your_stripe_key

# Search
ELASTICSEARCH_URL=http://localhost:9200
```

### TailwindCSS Configuration
```javascript
module.exports = {
  content: [
    './node_modules/@claims/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-orange': {
          500: '#ff6b35',
          600: '#ea5a2b',
        },
        'brand-blue': {
          500: '#2e86ab',
          600: '#2563eb',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

## API Documentation

### Claims API Endpoints
- `POST /api/claims` - Tạo hồ sơ mới
- `GET /api/claims/:id` - Lấy thông tin hồ sơ
- `PUT /api/claims/:id` - Cập nhật hồ sơ
- `DELETE /api/claims/:id` - Xóa hồ sơ
- `GET /api/claims/search` - Tìm kiếm hồ sơ
- `POST /api/claims/:id/submit` - Nộp hồ sơ
- `POST /api/claims/:id/approve` - Duyệt hồ sơ

### Document Processing API
- `POST /api/documents/upload` - Upload tài liệu
- `POST /api/documents/process` - Xử lý OCR
- `GET /api/documents/:id/extract` - Trích xuất thông tin

### Analytics API
- `GET /api/analytics/dashboard` - Dashboard data
- `GET /api/analytics/reports` - Custom reports
- `GET /api/analytics/trends` - Trend analysis

## Tùy chỉnh

### Themes
Module hỗ trợ nhiều theme:
- Light/Dark mode
- High contrast mode
- Color blind friendly

### Language Support
- Tiếng Việt (mặc định)
- English
- Extensible i18n system

### Workflow Customization
- Custom claim types
- Configurable approval workflows
- Business rule engine

## Performance

### Frontend Optimizations
- Code splitting
- Lazy loading
- Bundle optimization
- Image optimization
- Caching strategies

### Backend Optimizations
- Database indexing
- Query optimization
- Redis caching
- Background job processing

## Security Features

- JWT authentication
- Role-based access control
- Data encryption at rest
- Audit logging
- GDPR compliance
- Security headers
- Input validation

## Testing

### Frontend Tests
```bash
npm run test:frontend
npm run test:e2e
```

### Backend Tests
```bash
npm run test:backend
npm run test:integration
```

### AI/ML Tests
```bash
npm run test:ai-ml
npm run test:models
```

## Deployment

### Docker Support
```dockerfile
# Dockerfile included for easy deployment
FROM node:18-alpine
COPY . /app
WORKDIR /app
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Kubernetes
```yaml
# k8s manifests included
apiVersion: apps/v1
kind: Deployment
metadata:
  name: claims-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: claims-app
```

## Migration Guide

### Từ ClaimFlow standalone
1. Copy thư mục `claims-package` vào project
2. Install dependencies
3. Cập nhật routing
4. Cấu hình environment variables
5. Test integration

### Tích hợp vào existing app
1. Import components cần thiết
2. Merge routing configuration
3. Setup shared state management
4. Configure API endpoints

## Support & Maintenance

### Versioning
- Semantic versioning
- Changelog documentation
- Migration guides for breaking changes

### Updates
- Regular security updates
- Performance improvements
- New feature additions
- Bug fixes

## Contributors

- Fusion AI Assistant
- ClaimFlow Development Team

## License

MIT License - See LICENSE file for details
