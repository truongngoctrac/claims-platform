# Claims Module - Deployment Guide

## Tổng quan

Hướng dẫn deploy Claims module vào production environment. Module này bao gồm frontend (React), backend (Express/Node.js), và các dịch vụ AI/ML.

## Yêu cầu hệ thống

### Minimum Requirements
- **Node.js**: 18.x trở lên
- **MongoDB**: 5.0 trở lên
- **Redis**: 6.0 trở lên
- **Elasticsearch**: 7.x trở lên (optional, cho search)
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 20GB minimum cho logs và uploads

### Recommended Production Setup
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 100GB SSD
- **Network**: 1Gbps

## Environment Setup

### 1. Environment Variables

Tạo file `.env.production`:

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb://username:password@localhost:27017/claims_prod
MONGODB_DB_NAME=claims_production
REDIS_URL=redis://username:password@localhost:6379

# JWT & Security
JWT_SECRET=your-super-secure-jwt-secret-key-here
ENCRYPTION_KEY=your-32-character-encryption-key-here

# AI/ML Services
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4
DOCUMENT_AI_ENDPOINT=https://your-document-ai-service.com
DOCUMENT_AI_KEY=your-document-ai-key

# Payment Gateways
VNPAY_MERCHANT_ID=your-vnpay-merchant-id
VNPAY_SECRET_KEY=your-vnpay-secret-key
VNPAY_ENDPOINT=https://pay.vnpay.vn

STRIPE_PUBLIC_KEY=pk_live_your-stripe-public-key
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key

PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_ENVIRONMENT=live

# External Integrations
BHXH_ENDPOINT=https://api.baohiemxahoi.gov.vn
BHXH_API_KEY=your-bhxh-api-key

HIS_ENDPOINT=https://his.hospital.vn/api
HIS_API_KEY=your-his-api-key

ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=claims_prod

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_STORAGE=aws
UPLOAD_PATH=/var/uploads
AWS_BUCKET=your-s3-bucket
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# Notifications
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourcompany.com

SMS_PROVIDER=twilio
SMS_API_KEY=your-twilio-api-key
SMS_FROM_NUMBER=+84123456789

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-newrelic-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### 2. Database Setup

#### MongoDB
```bash
# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Create database and user
mongo
use claims_production
db.createUser({
  user: "claims_user",
  pwd: "secure_password",
  roles: ["readWrite"]
})
```

#### Redis
```bash
# Install Redis
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: requirepass your_redis_password

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

#### Elasticsearch (Optional)
```bash
# Install Elasticsearch
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb https://artifacts.elastic.co/packages/7.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-7.x.list
sudo apt update && sudo apt install elasticsearch

# Start Elasticsearch
sudo systemctl start elasticsearch
sudo systemctl enable elasticsearch
```

## Application Deployment

### 1. Build Process

```bash
# Clone và setup
git clone https://github.com/your-repo/claims-module.git
cd claims-module

# Install dependencies
npm ci --only=production

# Build frontend
npm run build:frontend

# Build backend
npm run build:backend

# Build AI/ML services
npm run build:ai-ml
```

### 2. PM2 Deployment

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
nano ecosystem.config.js
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'claims-api',
      script: './dist/server/index.js',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      max_memory_restart: '1G'
    },
    {
      name: 'claims-worker',
      script: './dist/workers/index.js',
      instances: 2,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      time: true
    }
  ]
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

### 3. Nginx Configuration

```nginx
# /etc/nginx/sites-available/claims-module
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    # Frontend static files
    location / {
        root /var/www/claims-module/dist/frontend;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # File uploads
    location /uploads/ {
        root /var/www/claims-module;
        expires 30d;
        add_header Cache-Control "public";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/claims-module /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Docker Deployment

### 1. Dockerfile

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production image
FROM node:18-alpine AS production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S claims -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=claims:nodejs /app/dist ./dist
COPY --from=builder --chown=claims:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=claims:nodejs /app/package.json ./

USER claims

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
```

### 2. Docker Compose

```yaml
version: '3.8'

services:
  claims-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/claims_prod
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
      - uploads:/app/uploads

  mongodb:
    image: mongo:5.0
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass password
    volumes:
      - redis_data:/data
    restart: unless-stopped

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.15.0
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - claims-app
    restart: unless-stopped

volumes:
  mongodb_data:
  redis_data:
  elasticsearch_data:
  uploads:
```

## Monitoring & Logging

### 1. Health Checks

```javascript
// healthcheck.js
const mongoose = require('mongoose');
const redis = require('redis');

async function healthCheck() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {}
  };

  try {
    // MongoDB check
    await mongoose.connection.db.admin().ping();
    health.services.mongodb = 'ok';
  } catch (error) {
    health.services.mongodb = 'error';
    health.status = 'error';
  }

  try {
    // Redis check
    const client = redis.createClient(process.env.REDIS_URL);
    await client.ping();
    health.services.redis = 'ok';
  } catch (error) {
    health.services.redis = 'error';
    health.status = 'error';
  }

  return health;
}

module.exports = { healthCheck };
```

### 2. Log Aggregation

```javascript
// logger.js
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'claims-module' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: { node: process.env.ELASTICSEARCH_URL }
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

### 3. Metrics Collection

```javascript
// metrics.js
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
  name: 'active_connections_total',
  help: 'Total number of active connections'
});

const claimsProcessed = new prometheus.Counter({
  name: 'claims_processed_total',
  help: 'Total number of claims processed'
});

// Export metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});
```

## Security Configuration

### 1. SSL/TLS Setup

```bash
# Using Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 2. Firewall Configuration

```bash
# UFW setup
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp  # Block direct access to Node.js
sudo ufw enable
```

### 3. Database Security

```javascript
// MongoDB security
use claims_production
db.createUser({
  user: "claims_readonly",
  pwd: "readonly_password",
  roles: [{ role: "read", db: "claims_production" }]
})

// Enable authentication
// In /etc/mongod.conf:
security:
  authorization: enabled
```

## Backup Strategy

### 1. Database Backup

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/claims"
mkdir -p $BACKUP_DIR

# MongoDB backup
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/mongodb_$DATE"

# Compress backup
tar -czf "$BACKUP_DIR/mongodb_$DATE.tar.gz" "$BACKUP_DIR/mongodb_$DATE"
rm -rf "$BACKUP_DIR/mongodb_$DATE"

# Upload to S3 (optional)
aws s3 cp "$BACKUP_DIR/mongodb_$DATE.tar.gz" s3://your-backup-bucket/

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

### 2. Automated Backup

```bash
# Add to crontab
0 2 * * * /path/to/backup.sh >> /var/log/backup.log 2>&1
```

## Performance Optimization

### 1. MongoDB Indexing

```javascript
// Essential indexes
db.claims.createIndex({ "status": 1, "createdAt": -1 });
db.claims.createIndex({ "patient.nationalId": 1 });
db.claims.createIndex({ "submittedBy": 1, "createdAt": -1 });
db.claims.createIndex({ "type": 1, "status": 1 });
db.claims.createIndex({ "processing.assignedTo": 1, "status": 1 });

// Text search index
db.claims.createIndex({
  "patient.fullName": "text",
  "medical.hospitalName": "text",
  "medical.diagnosis.primary": "text"
});
```

### 2. Caching Strategy

```javascript
// Redis caching
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

// Cache frequently accessed data
async function getCachedClaim(claimId) {
  const cached = await client.get(`claim:${claimId}`);
  if (cached) return JSON.parse(cached);
  
  const claim = await ClaimModel.findById(claimId);
  await client.setex(`claim:${claimId}`, 300, JSON.stringify(claim));
  return claim;
}
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Monitor Node.js memory
   pm2 monit
   
   # Restart if needed
   pm2 restart claims-api
   ```

2. **Database Connection Issues**
   ```bash
   # Check MongoDB status
   sudo systemctl status mongod
   
   # Check connections
   mongo --eval "db.serverStatus().connections"
   ```

3. **File Upload Failures**
   ```bash
   # Check disk space
   df -h
   
   # Check upload directory permissions
   ls -la /var/uploads
   ```

### Log Analysis

```bash
# Real-time API logs
pm2 logs claims-api --lines 100

# Error analysis
grep "ERROR" /var/log/claims/*.log | tail -100

# Performance monitoring
grep "slow" /var/log/claims/*.log
```

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer Setup**
2. **Database Sharding**
3. **Redis Clustering**
4. **CDN Integration**

### Vertical Scaling

1. **CPU/Memory Upgrades**
2. **SSD Storage**
3. **Database Optimization**

## Rollback Procedures

```bash
# Quick rollback
pm2 stop claims-api
git checkout previous-stable-tag
npm ci --only=production
npm run build
pm2 start claims-api

# Database rollback (if needed)
mongorestore --uri="$MONGODB_URI" /backups/mongodb_YYYYMMDD_HHMMSS
```
