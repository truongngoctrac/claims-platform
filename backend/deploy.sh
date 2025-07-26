#!/bin/bash

# BHYT Backend Deployment Script
# Triển khai hệ thống backend BHYT với Docker

set -e  # Exit on any error

echo "🏥 Triển khai hệ thống BHYT Backend..."
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-development}
COMPOSE_FILE="infrastructure-setup/docker-compose.yml"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    print_step "Kiểm tra Docker..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker không được cài đặt. Vui lòng cài đặt Docker trước."
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon không chạy. Vui lòng khởi động Docker."
        exit 1
    fi
    
    print_status "Docker đã sẵn sàng"
}

# Check if docker-compose is installed
check_docker_compose() {
    print_step "Kiểm tra Docker Compose..."
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose không được cài đặt. Vui lòng cài đặt Docker Compose trước."
        exit 1
    fi
    
    print_status "Docker Compose đã sẵn sàng"
}

# Create environment file if it doesn't exist
setup_environment() {
    print_step "Thiết lập môi trường..."
    
    if [ ! -f ".env" ]; then
        print_warning "File .env không tồn tại. Tạo từ .env.example..."
        cp .env.example .env
        print_warning "Vui lòng cập nhật các giá trị trong file .env trước khi triển khai production!"
    fi
    
    # Generate random JWT secret if not set
    if ! grep -q "JWT_SECRET_KEY=your-super-secret" .env; then
        JWT_SECRET=$(openssl rand -base64 32)
        sed -i "s/JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production/JWT_SECRET_KEY=${JWT_SECRET}/" .env
        print_status "Đã tạo JWT secret key ngẫu nhiên"
    fi
    
    print_status "Môi trường đã được thiết lập"
}

# Build Docker images
build_images() {
    print_step "Build Docker images..."
    
    print_status "Building API Gateway..."
    docker-compose -f $COMPOSE_FILE build api-gateway
    
    print_status "Building User Management Service..."
    docker-compose -f $COMPOSE_FILE build user-service
    
    print_status "Building Policy Management Service..."
    docker-compose -f $COMPOSE_FILE build policy-service
    
    print_status "Building Claims Service..."
    docker-compose -f $COMPOSE_FILE build claims-service
    
    print_status "Tất cả images đã được build thành công"
}

# Start infrastructure services first
start_infrastructure() {
    print_step "Khởi động cơ sở hạ tầng..."
    
    print_status "Khởi động PostgreSQL và Redis..."
    docker-compose -f $COMPOSE_FILE up -d postgres redis consul
    
    print_status "Chờ database khởi động..."
    sleep 10
    
    # Wait for PostgreSQL to be ready
    until docker-compose -f $COMPOSE_FILE exec postgres pg_isready -U bhyt_user; do
        print_status "Chờ PostgreSQL sẵn sàng..."
        sleep 2
    done
    
    print_status "Cơ sở hạ tầng đã sẵn sàng"
}

# Run database migrations
run_migrations() {
    print_step "Chạy database migrations..."
    
    print_status "Khởi tạo database schema..."
    docker-compose -f $COMPOSE_FILE exec postgres psql -U bhyt_user -d bhyt_main -f /docker-entrypoint-initdb.d/init.sql
    
    print_status "Chạy migration scripts..."
    if [ -f "database-setup/migrations/001_initial_setup.sql" ]; then
        docker-compose -f $COMPOSE_FILE exec postgres psql -U bhyt_user -d bhyt_main -f /docker-entrypoint-initdb.d/migrations/001_initial_setup.sql
    fi
    
    print_status "Database migrations hoàn thành"
}

# Start application services
start_services() {
    print_step "Khởi động các dịch vụ ứng dụng..."
    
    print_status "Khởi động User Management Service..."
    docker-compose -f $COMPOSE_FILE up -d user-service
    sleep 5
    
    print_status "Khởi động Policy Management Service..."
    docker-compose -f $COMPOSE_FILE up -d policy-service
    sleep 5
    
    print_status "Khởi động Claims Service..."
    docker-compose -f $COMPOSE_FILE up -d claims-service
    sleep 5
    
    print_status "Khởi động API Gateway..."
    docker-compose -f $COMPOSE_FILE up -d api-gateway
    sleep 5
    
    print_status "Khởi động Load Balancer..."
    docker-compose -f $COMPOSE_FILE up -d nginx
    
    print_status "Tất cả dịch vụ đã được khởi động"
}

# Health check all services
health_check() {
    print_step "Kiểm tra sức khỏe các dịch vụ..."
    
    services=("user-service:5001" "policy-service:5002" "claims-service:5003" "api-gateway:8000")
    
    for service in "${services[@]}"; do
        service_name=$(echo $service | cut -d: -f1)
        port=$(echo $service | cut -d: -f2)
        
        print_status "Kiểm tra $service_name..."
        
        max_attempts=30
        attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if docker-compose -f $COMPOSE_FILE exec $service_name curl -f http://localhost:$port/health >/dev/null 2>&1; then
                print_status "$service_name đang hoạt động tốt"
                break
            else
                if [ $attempt -eq $max_attempts ]; then
                    print_error "$service_name không phản hồi sau $max_attempts lần thử"
                    return 1
                fi
                print_status "Thử lại $service_name ($attempt/$max_attempts)..."
                sleep 2
                ((attempt++))
            fi
        done
    done
    
    print_status "Tất cả dịch vụ đang hoạt động tốt"
}

# Display service information
show_services_info() {
    print_step "Thông tin dịch vụ:"
    echo ""
    echo -e "${GREEN}🌐 API Gateway:${NC} http://localhost:8000"
    echo -e "${GREEN}📚 API Documentation:${NC} http://localhost:8000/docs"
    echo -e "${GREEN}👥 User Service:${NC} http://localhost:5001"
    echo -e "${GREEN}📋 Policy Service:${NC} http://localhost:5002"
    echo -e "${GREEN}🏥 Claims Service:${NC} http://localhost:5003"
    echo -e "${GREEN}🗄️ Database:${NC} localhost:5432"
    echo -e "${GREEN}📦 Redis:${NC} localhost:6379"
    echo -e "${GREEN}🔍 Consul:${NC} http://localhost:8500"
    echo -e "${GREEN}⚖️ Load Balancer:${NC} http://localhost"
    echo ""
    echo -e "${YELLOW}💡 Tip:${NC} Sử dụng './deploy.sh stop' để dừng tất cả dịch vụ"
    echo -e "${YELLOW}💡 Tip:${NC} Sử dụng './deploy.sh logs [service]' để xem logs"
    echo -e "${YELLOW}💡 Tip:${NC} Sử dụng './deploy.sh restart [service]' để khởi động lại dịch vụ"
}

# Stop all services
stop_services() {
    print_step "Dừng tất cả dịch vụ..."
    docker-compose -f $COMPOSE_FILE down
    print_status "Tất cả dịch vụ đã được dừng"
}

# Show logs
show_logs() {
    local service=${1:-}
    if [ -z "$service" ]; then
        docker-compose -f $COMPOSE_FILE logs -f
    else
        docker-compose -f $COMPOSE_FILE logs -f $service
    fi
}

# Restart service
restart_service() {
    local service=${1:-}
    if [ -z "$service" ]; then
        print_error "Vui lòng chỉ định tên dịch vụ để khởi động lại"
        echo "Các dịch vụ có sẵn: api-gateway, user-service, policy-service, claims-service, postgres, redis, nginx"
        exit 1
    fi
    
    print_step "Khởi động lại $service..."
    docker-compose -f $COMPOSE_FILE restart $service
    print_status "$service đã được khởi động lại"
}

# Clean up everything
cleanup() {
    print_step "Dọn dẹp hệ thống..."
    docker-compose -f $COMPOSE_FILE down -v --remove-orphans
    docker system prune -f
    print_status "Dọn dẹp hoàn thành"
}

# Update services
update_services() {
    print_step "Cập nhật dịch vụ..."
    docker-compose -f $COMPOSE_FILE pull
    build_images
    docker-compose -f $COMPOSE_FILE up -d
    print_status "Cập nhật hoàn thành"
}

# Main deployment function
deploy() {
    print_status "Bắt đầu triển khai môi trường $ENVIRONMENT..."
    
    check_docker
    check_docker_compose
    setup_environment
    build_images
    start_infrastructure
    run_migrations
    start_services
    health_check
    show_services_info
    
    print_status "🎉 Triển khai thành công!"
}

# Command line interface
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "stop")
        stop_services
        ;;
    "logs")
        show_logs $2
        ;;
    "restart")
        restart_service $2
        ;;
    "cleanup")
        cleanup
        ;;
    "update")
        update_services
        ;;
    "health")
        health_check
        ;;
    "info")
        show_services_info
        ;;
    *)
        echo "Sử dụng: $0 {deploy|stop|logs|restart|cleanup|update|health|info}"
        echo ""
        echo "Các lệnh:"
        echo "  deploy   - Triển khai tất cả dịch vụ (mặc định)"
        echo "  stop     - Dừng tất cả dịch vụ"
        echo "  logs     - Xem logs (thêm tên service để xem log cụ thể)"
        echo "  restart  - Khởi động lại dịch vụ (yêu cầu tên service)"
        echo "  cleanup  - Dọn dẹp tất cả containers và volumes"
        echo "  update   - Cập nhật và khởi động lại dịch vụ"
        echo "  health   - Kiểm tra sức khỏe dịch vụ"
        echo "  info     - Hiển thị thông tin dịch vụ"
        exit 1
        ;;
esac
