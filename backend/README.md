# BHYT Backend Foundation - Hệ thống Bảo hiểm Y tế Việt Nam

🏥 **Hệ thống backend hoàn chỉnh cho quản lý Bảo hiểm Y tế (BHYT) Việt Nam**

## 📋 Tổng quan

Đây là hệ thống backend microservices hoàn chỉnh được thiết kế đặc biệt cho hệ thống Bảo hiểm Y tế Việt Nam, bao gồm:

### ✅ Infrastructure Setup (1.2.1 - 1.2.5)
- ✅ **Docker containers** cho từng service
- ✅ **Docker Compose** cho development  
- ✅ **API Gateway** với FastAPI
- ✅ **Service discovery** configuration (Consul)
- ✅ **Load balancer** setup (Nginx)

### ✅ User Management Service (1.2.6 - 1.2.15)
- ✅ **Flask application** setup với blueprints
- ✅ **User model** và database schema theo chuẩn Việt Nam
- ✅ **JWT authentication** implementation
- ✅ **Role-based access control** (RBAC)
- ✅ **Password hashing** với bcrypt
- ✅ **User registration** API với validation CCCD
- ✅ **Login/logout** API endpoints
- ✅ **Profile management** APIs
- ✅ **Password reset** functionality với OTP
- ✅ **Input validation** với Marshmallow

### ✅ Policy Management Service (1.2.16 - 1.2.20)
- ✅ **Policy model** và relationships
- ✅ **Policy validation** logic
- ✅ **Policy lookup** APIs
- ✅ **Beneficiary management** 
- ✅ **Policy status tracking**

### ✅ Database Setup (1.2.21 - 1.2.26)
- ✅ **PostgreSQL** container configuration
- ✅ **Database migration** system (Alembic)
- ✅ **Initial schema** creation
- ✅ **Seed data** cho development
- ✅ **Redis setup** cho caching
- ✅ **Database connection** pooling

### ✅ Basic Claims Service (1.2.27 - 1.2.31)
- ✅ **Claim model** và basic schema
- ✅ **Claim creation** API
- ✅ **Claim retrieval** APIs
- ✅ **Basic status management**
- ✅ **Claim validation** rules

## 🚀 Cài đặt nhanh

### Yêu cầu hệ thống
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM tối thiểu
- 20GB dung lượng đĩa

### 1. Clone và setup
```bash
git clone <repository-url>
cd backend

# Copy environment file
cp .env.example .env

# Chỉnh sửa cấu hình trong .env file
nano .env
```

### 2. Triển khai
```bash
# Cấp quyền thực thi (Linux/Mac)
chmod +x deploy.sh

# Triển khai tất cả services
./deploy.sh deploy

# Hoặc sử dụng Docker Compose trực tiếp
docker-compose -f infrastructure-setup/docker-compose.yml up -d
```

### 3. Kiểm tra
```bash
# Kiểm tra health của tất cả services
./deploy.sh health

# Xem logs
./deploy.sh logs

# Xem thông tin services
./deploy.sh info
```

## 🌐 Endpoints chính

### API Gateway (Port 8000)
- **Health Check**: `GET /health`
- **API Docs**: `GET /docs`
- **Authentication**: `POST /api/v1/auth/login`
- **User Profile**: `GET /api/v1/users/profile`
- **Policies**: `GET /api/v1/policies`
- **Claims**: `POST /api/v1/claims`

### Direct Service Access
- **User Service**: `http://localhost:5001`
- **Policy Service**: `http://localhost:5002`  
- **Claims Service**: `http://localhost:5003`
- **Database**: `postgresql://localhost:5432`
- **Redis**: `redis://localhost:6379`

## 📊 Cấu trúc Database

### Users Database (`bhyt_users`)
```sql
-- Người dùng với thông tin CCCD Việt Nam
users (id, cccd, email, phone, full_name, ...)
user_profiles (user_id, occupation, medical_conditions, ...)
user_sessions (id, user_id, token_hash, expires_at, ...)
```

### Policies Database (`bhyt_policies`)
```sql
-- Loại thẻ BHYT (TE1, TE2, TE3, TE4, TE5, TE6)
insurance_card_types (id, code, name, coverage_percentage, ...)
insurance_cards (id, user_id, card_number, valid_from, valid_to, ...)
healthcare_facilities (id, code, name, level, province_code, ...)
coverage_policies (id, policy_type, coverage_percentage, max_amount, ...)
```

### Claims Database (`bhyt_claims`)
```sql
-- Yêu cầu bồi thường
claims (id, claim_number, user_id, total_amount, covered_amount, ...)
claim_service_details (id, claim_id, service_code, unit_price, ...)
claim_medications (id, claim_id, medication_code, quantity, ...)
claim_documents (id, claim_id, file_path, document_type, ...)
claim_status_history (id, claim_id, old_status, new_status, ...)
```

## 🔧 Quản lý Services

### Xem logs
```bash
# Tất cả services
./deploy.sh logs

# Service cụ thể
./deploy.sh logs user-service
./deploy.sh logs claims-service
```

### Khởi động lại service
```bash
./deploy.sh restart user-service
./deploy.sh restart api-gateway
```

### Dừng tất cả
```bash
./deploy.sh stop
```

### Dọn dẹp hoàn toàn
```bash
./deploy.sh cleanup
```

## 🔐 Bảo mật

### JWT Authentication
- Access token: 24 giờ
- Refresh token: 30 ngày
- Blacklist trong Redis
- Rate limiting

### Rate Limiting
- **Registration**: 5/phút
- **Login**: 10/phút  
- **Forgot Password**: 3/giờ
- **API calls**: 200/ngày, 50/giờ

### Validation
- **CCCD**: 12 chữ số
- **Phone**: Định dạng Việt Nam
- **Password**: Tối thiểu 8 ký tự
- **Age**: 16-150 tuổi

## 📈 Monitoring & Health Checks

### Health Check Endpoints
```bash
# API Gateway
curl http://localhost:8000/health

# Individual Services  
curl http://localhost:5001/health  # User Service
curl http://localhost:5002/health  # Policy Service
curl http://localhost:5003/health  # Claims Service
```

### Metrics
- Prometheus metrics trên port 9090
- Performance monitoring
- Error tracking
- Audit logging

## 🔄 Development Workflow

### 1. Code Changes
```bash
# Rebuild specific service
docker-compose -f infrastructure-setup/docker-compose.yml build user-service

# Restart service
./deploy.sh restart user-service
```

### 2. Database Changes
```bash
# Connect to database
docker-compose -f infrastructure-setup/docker-compose.yml exec postgres psql -U bhyt_user -d bhyt_users

# Run migration
./deploy.sh logs postgres
```

### 3. Adding New Features
1. Tạo migration scripts trong `database-setup/migrations/`
2. Cập nhật models trong service tương ứng
3. Thêm API endpoints
4. Update API Gateway routes
5. Test và deploy

## 🌐 T��ch hợp với hệ thống Việt Nam

### BHXH (Bảo hiểm Xã hội)
- API integration sẵn sàng
- Validation thẻ BHYT online
- Sync dữ liệu định kỳ

### HIS (Hospital Information System)
- Kết nối với hệ thống bệnh viện
- Tự động import dữ liệu khám bệnh
- Real-time updates

### Administrative Divisions
- API tỉnh/thành phố Việt Nam
- Validation địa chỉ
- Cập nhật tự động

### Payment Gateways
- VNPay integration
- Stripe/PayPal cho quốc tế
- Local banking systems

## 🛠️ Troubleshooting

### Service không khởi động
```bash
# Kiểm tra logs
./deploy.sh logs [service-name]

# Kiểm tra container status
docker-compose -f infrastructure-setup/docker-compose.yml ps

# Rebuild nếu cần
docker-compose -f infrastructure-setup/docker-compose.yml build [service-name]
```

### Database connection issues
```bash
# Kiểm tra PostgreSQL
docker-compose -f infrastructure-setup/docker-compose.yml exec postgres pg_isready -U bhyt_user

# Reset database
docker-compose -f infrastructure-setup/docker-compose.yml down -v
./deploy.sh deploy
```

### Performance issues
```bash
# Kiểm tra resource usage
docker stats

# Optimize containers
docker system prune -f
```

## 📝 API Documentation

Sau khi tri���n khai, truy cập:
- **FastAPI Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🚀 Production Deployment

### 1. Environment Configuration
```bash
# Cập nhật .env cho production
FLASK_ENV=production
DEBUG=false
JWT_SECRET_KEY=<strong-random-key>
POSTGRES_PASSWORD=<strong-password>
```

### 2. SSL/HTTPS Setup
```bash
# Thêm SSL certificates vào nginx/certs/
# Uncomment HTTPS config trong nginx.conf
```

### 3. Scaling
```bash
# Scale services
docker-compose -f infrastructure-setup/docker-compose.yml up -d --scale user-service=3
```

## 📞 Support

- **Documentation**: Xem file README trong từng service
- **Issues**: Tạo GitHub issue
- **Email**: support@bhyt-system.vn

## 📄 License

Copyright © 2024 BHYT System. All rights reserved.

---

**🎉 Hệ thống BHYT Backend Foundation đã sẵn sàng cho triển khai!**
