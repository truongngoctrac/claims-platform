#!/bin/bash

# Vietnamese Healthcare Claims - Smoke Tests
# Basic functionality tests to verify deployment success

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-staging}"
BASE_URL="${2:-http://localhost:8080}"
API_URL="${3:-http://localhost:8000}"
TIMEOUT=30

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED_TESTS++))
}

error() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILED_TESTS++))
}

warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Test runner function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_status="${3:-0}"
    
    ((TOTAL_TESTS++))
    log "Running test: $test_name"
    
    if eval "$test_command"; then
        if [ $? -eq $expected_status ]; then
            success "$test_name"
            return 0
        else
            error "$test_name - Unexpected exit status"
            return 1
        fi
    else
        error "$test_name - Test execution failed"
        return 1
    fi
}

# HTTP test function
http_test() {
    local test_name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local expected_content="${4:-}"
    
    ((TOTAL_TESTS++))
    log "HTTP Test: $test_name"
    
    local response
    local status_code
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time $TIMEOUT "$url" || echo "HTTPSTATUS:000")
    status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$status_code" = "$expected_status" ]; then
        if [ -n "$expected_content" ]; then
            if echo "$body" | grep -q "$expected_content"; then
                success "$test_name (Status: $status_code, Content: ✓)"
                return 0
            else
                error "$test_name (Status: $status_code, Content: ✗)"
                return 1
            fi
        else
            success "$test_name (Status: $status_code)"
            return 0
        fi
    else
        error "$test_name (Expected: $expected_status, Got: $status_code)"
        return 1
    fi
}

# Wait for service to be ready
wait_for_service() {
    local service_url="$1"
    local max_attempts=30
    local attempt=1
    
    log "Waiting for service to be ready: $service_url"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 5 "$service_url/health" > /dev/null; then
            success "Service is ready after $attempt attempts"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts failed, waiting 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    error "Service did not become ready after $max_attempts attempts"
    return 1
}

# Frontend smoke tests
test_frontend() {
    log "Running Frontend Smoke Tests..."
    
    # Test homepage load
    http_test "Homepage loads successfully" "$BASE_URL" "200" "Healthcare Claims"
    
    # Test static assets
    http_test "CSS assets load" "$BASE_URL/assets/index.css" "200"
    http_test "JavaScript assets load" "$BASE_URL/assets/index.js" "200"
    
    # Test key pages
    http_test "Login page accessible" "$BASE_URL/login" "200"
    http_test "Dashboard page accessible" "$BASE_URL/dashboard" "200"
    
    # Test PWA manifest
    http_test "PWA manifest available" "$BASE_URL/manifest.json" "200"
    
    # Test service worker
    http_test "Service worker available" "$BASE_URL/sw.js" "200"
}

# API smoke tests
test_api() {
    log "Running API Smoke Tests..."
    
    # Health check endpoints
    http_test "API Gateway health check" "$API_URL/health" "200" '"status"'
    http_test "Detailed health check" "$API_URL/health/detailed" "200" '"services"'
    http_test "Readiness check" "$API_URL/health/ready" "200" '"status":"ready"'
    http_test "Liveness check" "$API_URL/health/live" "200" '"status":"alive"'
    
    # API versioning
    http_test "API version endpoint" "$API_URL/api/version" "200" '"version"'
    
    # Authentication endpoints
    http_test "Auth endpoint accessible" "$API_URL/api/auth/login" "400" # Expect 400 for empty request
    
    # Claims service endpoints
    http_test "Claims service health" "$API_URL/api/claims/health" "200"
    http_test "Claims list endpoint" "$API_URL/api/claims" "401" # Expect 401 for unauthorized
    
    # Policy service endpoints
    http_test "Policy service health" "$API_URL/api/policies/health" "200"
    http_test "Policies list endpoint" "$API_URL/api/policies" "401" # Expect 401 for unauthorized
    
    # User service endpoints
    http_test "User service health" "$API_URL/api/users/health" "200"
    http_test "User profile endpoint" "$API_URL/api/users/profile" "401" # Expect 401 for unauthorized
}

# Database connectivity tests
test_database() {
    log "Running Database Connectivity Tests..."
    
    # MongoDB connection test via API
    http_test "Database connectivity" "$API_URL/health/database" "200" '"database"'
    
    # Redis connection test via API
    http_test "Redis connectivity" "$API_URL/health/redis" "200" '"redis"'
    
    # Elasticsearch connection test via API
    http_test "Elasticsearch connectivity" "$API_URL/health/elasticsearch" "200" '"elasticsearch"'
}

# Performance tests
test_performance() {
    log "Running Performance Tests..."
    
    # Response time test
    local start_time=$(date +%s%N)
    http_test "Homepage response time" "$BASE_URL" "200"
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ $response_time -lt 3000 ]; then
        success "Homepage response time acceptable: ${response_time}ms"
    else
        warning "Homepage response time slow: ${response_time}ms"
    fi
    
    # API response time test
    start_time=$(date +%s%N)
    http_test "API health check response time" "$API_URL/health" "200"
    end_time=$(date +%s%N)
    response_time=$(( (end_time - start_time) / 1000000 ))
    
    if [ $response_time -lt 1000 ]; then
        success "API response time acceptable: ${response_time}ms"
    else
        warning "API response time slow: ${response_time}ms"
    fi
}

# Security tests
test_security() {
    log "Running Security Tests..."
    
    # HTTPS redirect test (if in production)
    if [ "$ENVIRONMENT" = "production" ]; then
        local http_url=$(echo "$BASE_URL" | sed 's/https:/http:/')
        http_test "HTTPS redirect" "$http_url" "301"
    fi
    
    # Security headers test
    local headers=$(curl -s -I "$BASE_URL" | tr -d '\r')
    
    if echo "$headers" | grep -q "X-Frame-Options"; then
        success "X-Frame-Options header present"
    else
        warning "X-Frame-Options header missing"
    fi
    
    if echo "$headers" | grep -q "X-Content-Type-Options"; then
        success "X-Content-Type-Options header present"
    else
        warning "X-Content-Type-Options header missing"
    fi
    
    if echo "$headers" | grep -q "Content-Security-Policy"; then
        success "Content-Security-Policy header present"
    else
        warning "Content-Security-Policy header missing"
    fi
}

# Healthcare-specific tests
test_healthcare_features() {
    log "Running Healthcare-Specific Tests..."
    
    # Compliance endpoints
    http_test "Healthcare compliance check" "$API_URL/health/healthcare" "200" '"status":"compliant"'
    
    # GDPR compliance test
    http_test "GDPR compliance endpoint" "$API_URL/api/gdpr/status" "200"
    
    # Patient data access audit
    http_test "Audit logging status" "$API_URL/health/audit" "200"
    
    # Vietnamese localization test
    http_test "Vietnamese language support" "$BASE_URL" "200" "lang=\"vi\""
    
    # Medical document upload test (without actual upload)
    http_test "Document upload endpoint exists" "$API_URL/api/documents/upload" "401" # Expect 401 for unauthorized
}

# Monitoring tests
test_monitoring() {
    log "Running Monitoring Tests..."
    
    # Prometheus metrics
    http_test "Prometheus metrics endpoint" "$API_URL/metrics" "200" "healthcare_claims"
    
    # Logging test
    http_test "Log health check" "$API_URL/health/logging" "200"
    
    # Alert system test
    http_test "Alert system status" "$API_URL/health/alerts" "200"
}

# Integration tests
test_integrations() {
    log "Running Integration Tests..."
    
    # External API connectivity
    http_test "External APIs health" "$API_URL/health/external" "200"
    
    # Email service test
    http_test "Email service status" "$API_URL/health/email" "200"
    
    # File storage test
    http_test "File storage health" "$API_URL/health/storage" "200"
}

# Backup system test
test_backup_system() {
    log "Running Backup System Tests..."
    
    # Backup status check
    http_test "Backup system status" "$API_URL/health/backup" "200"
    
    # Last backup check
    http_test "Last backup information" "$API_URL/api/admin/backup/status" "401" # Expect 401 for unauthorized
}

# Load balancer and proxy tests
test_load_balancer() {
    log "Running Load Balancer Tests..."
    
    # Multiple requests to check load balancing
    for i in {1..5}; do
        http_test "Load balancer request $i" "$API_URL/health" "200"
    done
    
    # Sticky session test (if applicable)
    local cookie_header=$(curl -s -I "$BASE_URL" | grep -i "set-cookie" || echo "")
    if [ -n "$cookie_header" ]; then
        success "Session cookies are being set"
    else
        log "No session cookies detected (may be expected)"
    fi
}

# Main test execution
main() {
    log "Starting smoke tests for environment: $ENVIRONMENT"
    log "Base URL: $BASE_URL"
    log "API URL: $API_URL"
    log "Timeout: ${TIMEOUT}s"
    
    # Wait for services to be ready
    wait_for_service "$API_URL"
    
    # Run all test suites
    test_frontend
    test_api
    test_database
    test_performance
    test_security
    test_healthcare_features
    test_monitoring
    test_integrations
    test_backup_system
    test_load_balancer
    
    # Summary
    log "========================================="
    log "Smoke Test Results Summary"
    log "========================================="
    log "Total Tests: $TOTAL_TESTS"
    success "Passed: $PASSED_TESTS"
    if [ $FAILED_TESTS -gt 0 ]; then
        error "Failed: $FAILED_TESTS"
    else
        log "Failed: $FAILED_TESTS"
    fi
    
    local success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    log "Success Rate: $success_rate%"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        success "All smoke tests passed! Deployment verification successful."
        return 0
    elif [ $success_rate -ge 80 ]; then
        warning "Some tests failed but deployment appears functional ($success_rate% success rate)"
        return 0
    else
        error "Too many tests failed! Deployment may have issues ($success_rate% success rate)"
        return 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [ENVIRONMENT] [BASE_URL] [API_URL]"
    echo ""
    echo "Arguments:"
    echo "  ENVIRONMENT  Target environment (development|staging|production)"
    echo "  BASE_URL     Frontend base URL (default: http://localhost:8080)"
    echo "  API_URL      API base URL (default: http://localhost:8000)"
    echo ""
    echo "Examples:"
    echo "  $0 staging https://staging.healthcare-claims.vn https://api-staging.healthcare-claims.vn"
    echo "  $0 production https://healthcare-claims.vn https://api.healthcare-claims.vn"
}

# Execute main function if script is run directly
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    usage
    exit 0
fi

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
