#!/bin/bash

# Vietnamese Healthcare Claims - Deployment Automation Script
# This script handles deployment to different environments

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT="${1:-staging}"
VERSION="${2:-latest}"
SERVICES=("basic-claims-service" "policy-management-service" "user-management-service" "api-gateway")

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    local missing_tools=()
    
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
    command -v docker-compose >/dev/null 2>&1 || missing_tools+=("docker-compose")
    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v helm >/dev/null 2>&1 || missing_tools+=("helm")
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    success "All prerequisites satisfied"
}

# Validate environment
validate_environment() {
    log "Validating environment: $ENVIRONMENT"
    
    case $ENVIRONMENT in
        "development"|"staging"|"production")
            log "Environment '$ENVIRONMENT' is valid"
            ;;
        *)
            error "Invalid environment: $ENVIRONMENT. Use: development, staging, or production"
            exit 1
            ;;
    esac
}

# Load environment configuration
load_env_config() {
    local env_file="$PROJECT_ROOT/infrastructure/environment-setup/.env.$ENVIRONMENT"
    
    if [[ -f "$env_file" ]]; then
        log "Loading environment configuration from $env_file"
        source "$env_file"
    else
        warning "Environment file not found: $env_file"
    fi
}

# Backup database before deployment
backup_database() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "Creating database backup for production deployment..."
        
        local backup_script="$PROJECT_ROOT/infrastructure/environment-setup/backup-database.sh"
        if [[ -f "$backup_script" ]]; then
            bash "$backup_script" "$ENVIRONMENT"
            success "Database backup completed"
        else
            warning "Database backup script not found"
        fi
    fi
}

# Build and push container images
build_and_push_images() {
    log "Building and pushing container images..."
    
    local registry="${DOCKER_REGISTRY:-ghcr.io/your-org}"
    
    for service in "${SERVICES[@]}"; do
        log "Building $service..."
        
        local dockerfile_path="$PROJECT_ROOT/backend/$service/Dockerfile"
        if [[ ! -f "$dockerfile_path" ]]; then
            error "Dockerfile not found for $service: $dockerfile_path"
            continue
        fi
        
        local image_tag="$registry/healthcare-$service:$VERSION"
        local latest_tag="$registry/healthcare-$service:latest"
        
        docker build \
            -t "$image_tag" \
            -t "$latest_tag" \
            -f "$dockerfile_path" \
            "$PROJECT_ROOT/backend/$service" || {
            error "Failed to build $service"
            return 1
        }
        
        docker push "$image_tag" || {
            error "Failed to push $service:$VERSION"
            return 1
        }
        
        if [[ "$ENVIRONMENT" == "production" ]]; then
            docker push "$latest_tag" || {
                error "Failed to push $service:latest"
                return 1
            }
        fi
        
        success "Built and pushed $service"
    done
}

# Deploy services using Docker Compose
deploy_docker_compose() {
    log "Deploying services using Docker Compose..."
    
    local compose_file="$PROJECT_ROOT/infrastructure/environment-setup/docker-compose.$ENVIRONMENT.yml"
    
    if [[ ! -f "$compose_file" ]]; then
        error "Docker Compose file not found: $compose_file"
        return 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # Pull latest images
    docker-compose -f "$compose_file" pull
    
    # Stop existing services
    docker-compose -f "$compose_file" down
    
    # Start services
    docker-compose -f "$compose_file" up -d
    
    success "Services deployed with Docker Compose"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log "Deploying to Kubernetes..."
    
    local k8s_manifests_dir="$PROJECT_ROOT/infrastructure/environment-setup/k8s"
    
    if [[ ! -d "$k8s_manifests_dir" ]]; then
        warning "Kubernetes manifests directory not found: $k8s_manifests_dir"
        return 0
    fi
    
    # Apply namespace
    kubectl apply -f "$k8s_manifests_dir/namespace.yml"
    
    # Apply configurations
    kubectl apply -f "$k8s_manifests_dir/configmaps/"
    kubectl apply -f "$k8s_manifests_dir/secrets/"
    
    # Apply services
    kubectl apply -f "$k8s_manifests_dir/services/"
    
    # Apply deployments
    kubectl apply -f "$k8s_manifests_dir/deployments/"
    
    # Wait for rollout
    for service in "${SERVICES[@]}"; do
        kubectl rollout status deployment/healthcare-$service -n healthcare-$ENVIRONMENT
    done
    
    success "Kubernetes deployment completed"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    local migration_script="$PROJECT_ROOT/infrastructure/environment-setup/run-migrations.sh"
    
    if [[ -f "$migration_script" ]]; then
        bash "$migration_script" "$ENVIRONMENT"
        success "Database migrations completed"
    else
        warning "Migration script not found: $migration_script"
    fi
}

# Health check
health_check() {
    log "Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Health check attempt $attempt/$max_attempts"
        
        local all_healthy=true
        
        # Check each service
        for service in "${SERVICES[@]}"; do
            local health_url="${SERVICE_BASE_URL:-http://localhost:8080}/health"
            
            if ! curl -f -s "$health_url" > /dev/null; then
                warning "$service health check failed"
                all_healthy=false
            fi
        done
        
        if $all_healthy; then
            success "All services are healthy"
            return 0
        fi
        
        sleep 10
        ((attempt++))
    done
    
    error "Health checks failed after $max_attempts attempts"
    return 1
}

# Smoke tests
run_smoke_tests() {
    log "Running smoke tests..."
    
    local smoke_test_script="$PROJECT_ROOT/infrastructure/ci-cd-pipeline/smoke-tests.sh"
    
    if [[ -f "$smoke_test_script" ]]; then
        bash "$smoke_test_script" "$ENVIRONMENT"
        success "Smoke tests passed"
    else
        warning "Smoke test script not found"
    fi
}

# Rollback function
rollback() {
    local previous_version="${3:-previous}"
    
    error "Deployment failed. Initiating rollback to $previous_version..."
    
    case "$DEPLOYMENT_METHOD" in
        "docker-compose")
            # Rollback Docker Compose deployment
            docker-compose -f "$PROJECT_ROOT/infrastructure/environment-setup/docker-compose.$ENVIRONMENT.yml" down
            # Restore previous version (implement based on your backup strategy)
            ;;
        "kubernetes")
            # Rollback Kubernetes deployment
            for service in "${SERVICES[@]}"; do
                kubectl rollout undo deployment/healthcare-$service -n healthcare-$ENVIRONMENT
            done
            ;;
    esac
    
    error "Rollback completed"
}

# Notification function
send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Healthcare Claims Deployment - $ENVIRONMENT: $status - $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    if [[ -n "${TEAMS_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Healthcare Claims Deployment - $ENVIRONMENT: $status - $message\"}" \
            "$TEAMS_WEBHOOK_URL"
    fi
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."
    
    # Remove old Docker images
    docker image prune -f
    
    # Remove old build artifacts
    rm -rf "$PROJECT_ROOT/dist/"
    
    success "Cleanup completed"
}

# Main deployment function
deploy() {
    log "Starting deployment to $ENVIRONMENT environment..."
    
    trap 'rollback "$ENVIRONMENT" "$VERSION" "previous"' ERR
    
    check_prerequisites
    validate_environment
    load_env_config
    backup_database
    build_and_push_images
    
    # Choose deployment method based on environment
    case "${DEPLOYMENT_METHOD:-docker-compose}" in
        "docker-compose")
            deploy_docker_compose
            ;;
        "kubernetes")
            deploy_kubernetes
            ;;
        *)
            error "Unknown deployment method: ${DEPLOYMENT_METHOD}"
            exit 1
            ;;
    esac
    
    run_migrations
    health_check
    run_smoke_tests
    cleanup
    
    success "Deployment to $ENVIRONMENT completed successfully!"
    send_notification "SUCCESS" "Deployment to $ENVIRONMENT completed successfully"
}

# Script usage
usage() {
    echo "Usage: $0 [ENVIRONMENT] [VERSION]"
    echo ""
    echo "Arguments:"
    echo "  ENVIRONMENT  Target environment (development|staging|production)"
    echo "  VERSION      Docker image version tag (default: latest)"
    echo ""
    echo "Examples:"
    echo "  $0 staging v1.2.3"
    echo "  $0 production latest"
    echo ""
    echo "Environment Variables:"
    echo "  DOCKER_REGISTRY     Docker registry URL"
    echo "  DEPLOYMENT_METHOD   Deployment method (docker-compose|kubernetes)"
    echo "  SLACK_WEBHOOK_URL   Slack notification webhook"
    echo "  TEAMS_WEBHOOK_URL   Teams notification webhook"
}

# Main execution
main() {
    if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
        usage
        exit 0
    fi
    
    deploy
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
