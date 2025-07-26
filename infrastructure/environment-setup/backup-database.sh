#!/bin/bash

# Vietnamese Healthcare Claims - Database Backup Script
# Automated backup solution for MongoDB with encryption and compression

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT="${1:-staging}"
BACKUP_TYPE="${2:-full}"  # full, incremental, or differential

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
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

# Load environment configuration
load_env_config() {
    local env_file="$SCRIPT_DIR/.env.$ENVIRONMENT"
    
    if [[ -f "$env_file" ]]; then
        log "Loading environment configuration from $env_file"
        source "$env_file"
    else
        error "Environment file not found: $env_file"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking backup prerequisites..."
    
    local missing_tools=()
    
    command -v mongodump >/dev/null 2>&1 || missing_tools+=("mongodump")
    command -v gzip >/dev/null 2>&1 || missing_tools+=("gzip")
    command -v openssl >/dev/null 2>&1 || missing_tools+=("openssl")
    command -v aws >/dev/null 2>&1 || warning "AWS CLI not found - S3 upload will be skipped"
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    success "All prerequisites satisfied"
}

# Create backup directory structure
setup_backup_directory() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    BACKUP_DIR="${BACKUP_LOCATION:-/app/backups}/$ENVIRONMENT/$timestamp"
    
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    
    # Create subdirectories
    mkdir -p "$BACKUP_DIR/mongodb"
    mkdir -p "$BACKUP_DIR/redis"
    mkdir -p "$BACKUP_DIR/elasticsearch"
    mkdir -p "$BACKUP_DIR/logs"
    mkdir -p "$BACKUP_DIR/config"
}

# MongoDB backup
backup_mongodb() {
    log "Starting MongoDB backup..."
    
    local mongo_host="${MONGODB_HOST:-localhost}"
    local mongo_port="${MONGODB_PORT:-27017}"
    local mongo_db="${MONGODB_DATABASE:-healthcare_claims_${ENVIRONMENT}}"
    local mongo_user="${MONGODB_ROOT_USERNAME}"
    local mongo_pass="${MONGODB_ROOT_PASSWORD}"
    
    if [[ -z "$mongo_user" ]] || [[ -z "$mongo_pass" ]]; then
        error "MongoDB credentials not found in environment"
        return 1
    fi
    
    local backup_file="$BACKUP_DIR/mongodb/mongodb_backup.archive"
    
    # Create MongoDB dump
    mongodump \
        --host "$mongo_host:$mongo_port" \
        --db "$mongo_db" \
        --username "$mongo_user" \
        --password "$mongo_pass" \
        --authenticationDatabase admin \
        --archive="$backup_file" \
        --gzip \
        --numParallelCollections 4 || {
        error "MongoDB backup failed"
        return 1
    }
    
    # Get backup file size
    local file_size=$(du -h "$backup_file" | cut -f1)
    log "MongoDB backup completed - Size: $file_size"
    
    # Encrypt backup file
    if [[ -n "${ENCRYPTION_KEY:-}" ]]; then
        log "Encrypting MongoDB backup..."
        openssl enc -aes-256-cbc -salt -pbkdf2 -in "$backup_file" -out "$backup_file.enc" -pass pass:"$ENCRYPTION_KEY"
        rm "$backup_file"
        mv "$backup_file.enc" "$backup_file"
        success "MongoDB backup encrypted"
    fi
    
    return 0
}

# Redis backup
backup_redis() {
    log "Starting Redis backup..."
    
    local redis_host="${REDIS_HOST:-localhost}"
    local redis_port="${REDIS_PORT:-6379}"
    local redis_pass="${REDIS_PASSWORD:-}"
    
    local backup_file="$BACKUP_DIR/redis/redis_backup.rdb"
    
    # Save current Redis state
    if [[ -n "$redis_pass" ]]; then
        redis-cli -h "$redis_host" -p "$redis_port" -a "$redis_pass" BGSAVE
    else
        redis-cli -h "$redis_host" -p "$redis_port" BGSAVE
    fi
    
    # Wait for background save to complete
    sleep 5
    
    # Copy RDB file
    if [[ -n "$redis_pass" ]]; then
        redis-cli -h "$redis_host" -p "$redis_port" -a "$redis_pass" --rdb "$backup_file"
    else
        redis-cli -h "$redis_host" -p "$redis_port" --rdb "$backup_file"
    fi
    
    if [[ -f "$backup_file" ]]; then
        # Compress backup
        gzip "$backup_file"
        local file_size=$(du -h "$backup_file.gz" | cut -f1)
        log "Redis backup completed - Size: $file_size"
        
        # Encrypt if encryption key is available
        if [[ -n "${ENCRYPTION_KEY:-}" ]]; then
            log "Encrypting Redis backup..."
            openssl enc -aes-256-cbc -salt -pbkdf2 -in "$backup_file.gz" -out "$backup_file.gz.enc" -pass pass:"$ENCRYPTION_KEY"
            rm "$backup_file.gz"
            success "Redis backup encrypted"
        fi
        
        return 0
    else
        error "Redis backup failed - RDB file not found"
        return 1
    fi
}

# Elasticsearch backup
backup_elasticsearch() {
    log "Starting Elasticsearch backup..."
    
    local es_host="${ELASTICSEARCH_HOST:-localhost}"
    local es_port="${ELASTICSEARCH_PORT:-9200}"
    local es_user="${ELASTICSEARCH_USERNAME:-}"
    local es_pass="${ELASTICSEARCH_PASSWORD:-}"
    
    local backup_file="$BACKUP_DIR/elasticsearch/elasticsearch_backup.json"
    
    # Create Elasticsearch snapshot
    local auth_header=""
    if [[ -n "$es_user" ]] && [[ -n "$es_pass" ]]; then
        auth_header="-u $es_user:$es_pass"
    fi
    
    # Export all indices
    curl $auth_header -X GET "$es_host:$es_port/_all" -o "$backup_file" || {
        error "Elasticsearch backup failed"
        return 1
    }
    
    # Compress backup
    gzip "$backup_file"
    local file_size=$(du -h "$backup_file.gz" | cut -f1)
    log "Elasticsearch backup completed - Size: $file_size"
    
    # Encrypt if encryption key is available
    if [[ -n "${ENCRYPTION_KEY:-}" ]]; then
        log "Encrypting Elasticsearch backup..."
        openssl enc -aes-256-cbc -salt -pbkdf2 -in "$backup_file.gz" -out "$backup_file.gz.enc" -pass pass:"$ENCRYPTION_KEY"
        rm "$backup_file.gz"
        success "Elasticsearch backup encrypted"
    fi
    
    return 0
}

# Backup configuration files
backup_configuration() {
    log "Backing up configuration files..."
    
    local config_backup_dir="$BACKUP_DIR/config"
    
    # Copy environment files
    if [[ -f "$SCRIPT_DIR/.env.$ENVIRONMENT" ]]; then
        cp "$SCRIPT_DIR/.env.$ENVIRONMENT" "$config_backup_dir/"
    fi
    
    # Copy Docker Compose files
    if [[ -f "$SCRIPT_DIR/docker-compose.$ENVIRONMENT.yml" ]]; then
        cp "$SCRIPT_DIR/docker-compose.$ENVIRONMENT.yml" "$config_backup_dir/"
    fi
    
    # Copy Nginx configuration
    if [[ -d "$SCRIPT_DIR/nginx" ]]; then
        cp -r "$SCRIPT_DIR/nginx" "$config_backup_dir/"
    fi
    
    # Copy monitoring configuration
    if [[ -d "$SCRIPT_DIR/monitoring" ]]; then
        cp -r "$SCRIPT_DIR/monitoring" "$config_backup_dir/"
    fi
    
    # Compress configuration backup
    tar -czf "$config_backup_dir.tar.gz" -C "$BACKUP_DIR" config
    rm -rf "$config_backup_dir"
    
    success "Configuration backup completed"
}

# Backup application logs
backup_logs() {
    log "Backing up application logs..."
    
    local logs_backup_dir="$BACKUP_DIR/logs"
    local log_date=$(date -d "yesterday" +"%Y-%m-%d")
    
    # Backup Docker container logs
    if command -v docker >/dev/null 2>&1; then
        local containers=$(docker ps --format "table {{.Names}}" | grep healthcare- | tail -n +2)
        
        for container in $containers; do
            local log_file="$logs_backup_dir/${container}_${log_date}.log"
            docker logs --since="24h" --until="1h" "$container" > "$log_file" 2>&1 || true
        done
    fi
    
    # Backup system logs
    if [[ -d "/var/log" ]]; then
        find /var/log -name "*.log" -mtime -1 -exec cp {} "$logs_backup_dir/" \; 2>/dev/null || true
    fi
    
    # Compress logs backup
    if [[ "$(ls -A $logs_backup_dir)" ]]; then
        tar -czf "$logs_backup_dir.tar.gz" -C "$BACKUP_DIR" logs
        rm -rf "$logs_backup_dir"
        success "Logs backup completed"
    else
        warning "No logs found to backup"
        rmdir "$logs_backup_dir"
    fi
}

# Upload to cloud storage
upload_to_cloud() {
    if [[ -z "${AWS_ACCESS_KEY_ID:-}" ]] || [[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
        warning "AWS credentials not found - skipping cloud upload"
        return 0
    fi
    
    log "Uploading backup to S3..."
    
    local s3_bucket="${S3_BACKUP_BUCKET:-healthcare-claims-backups}"
    local s3_prefix="$ENVIRONMENT/$(date +"%Y/%m/%d")"
    
    # Create archive of entire backup
    local archive_name="healthcare_claims_backup_${ENVIRONMENT}_$(date +"%Y%m%d_%H%M%S").tar.gz"
    local archive_path="$(dirname "$BACKUP_DIR")/$archive_name"
    
    tar -czf "$archive_path" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"
    
    # Upload to S3
    aws s3 cp "$archive_path" "s3://$s3_bucket/$s3_prefix/$archive_name" || {
        error "Failed to upload backup to S3"
        return 1
    }
    
    success "Backup uploaded to S3: s3://$s3_bucket/$s3_prefix/$archive_name"
    
    # Clean up local archive
    rm "$archive_path"
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    local retention_days="${BACKUP_RETENTION_DAYS:-30}"
    local backup_base_dir="${BACKUP_LOCATION:-/app/backups}/$ENVIRONMENT"
    
    if [[ -d "$backup_base_dir" ]]; then
        find "$backup_base_dir" -type d -mtime +$retention_days -exec rm -rf {} \; 2>/dev/null || true
        success "Old backups cleaned up (retention: $retention_days days)"
    fi
    
    # Cleanup old S3 backups
    if command -v aws >/dev/null 2>&1 && [[ -n "${S3_BACKUP_BUCKET:-}" ]]; then
        local cutoff_date=$(date -d "$retention_days days ago" +"%Y-%m-%d")
        log "Cleaning up S3 backups older than $cutoff_date"
        
        aws s3 ls "s3://${S3_BACKUP_BUCKET}/$ENVIRONMENT/" --recursive | \
        awk -v cutoff="$cutoff_date" '$1 < cutoff {print $4}' | \
        while read -r file; do
            aws s3 rm "s3://${S3_BACKUP_BUCKET}/$file" || true
        done
    fi
}

# Generate backup report
generate_backup_report() {
    log "Generating backup report..."
    
    local report_file="$BACKUP_DIR/backup_report.txt"
    
    cat > "$report_file" << EOF
Vietnamese Healthcare Claims - Backup Report
============================================
Environment: $ENVIRONMENT
Backup Type: $BACKUP_TYPE
Timestamp: $(date)
Backup Directory: $BACKUP_DIR

Backup Status:
EOF
    
    # Check each backup component
    if [[ -f "$BACKUP_DIR/mongodb/mongodb_backup.archive" ]] || [[ -f "$BACKUP_DIR/mongodb/mongodb_backup.archive.enc" ]]; then
        echo "✅ MongoDB: SUCCESS" >> "$report_file"
    else
        echo "❌ MongoDB: FAILED" >> "$report_file"
    fi
    
    if [[ -f "$BACKUP_DIR/redis/redis_backup.rdb.gz" ]] || [[ -f "$BACKUP_DIR/redis/redis_backup.rdb.gz.enc" ]]; then
        echo "✅ Redis: SUCCESS" >> "$report_file"
    else
        echo "❌ Redis: FAILED" >> "$report_file"
    fi
    
    if [[ -f "$BACKUP_DIR/elasticsearch/elasticsearch_backup.json.gz" ]] || [[ -f "$BACKUP_DIR/elasticsearch/elasticsearch_backup.json.gz.enc" ]]; then
        echo "✅ Elasticsearch: SUCCESS" >> "$report_file"
    else
        echo "❌ Elasticsearch: FAILED" >> "$report_file"
    fi
    
    if [[ -f "$BACKUP_DIR/config.tar.gz" ]]; then
        echo "✅ Configuration: SUCCESS" >> "$report_file"
    else
        echo "❌ Configuration: FAILED" >> "$report_file"
    fi
    
    if [[ -f "$BACKUP_DIR/logs.tar.gz" ]]; then
        echo "✅ Logs: SUCCESS" >> "$report_file"
    else
        echo "⚠️  Logs: SKIPPED" >> "$report_file"
    fi
    
    # Add file sizes
    echo "" >> "$report_file"
    echo "Backup Sizes:" >> "$report_file"
    du -h "$BACKUP_DIR"/* >> "$report_file" 2>/dev/null || true
    
    # Add total size
    echo "" >> "$report_file"
    echo "Total Backup Size: $(du -sh "$BACKUP_DIR" | cut -f1)" >> "$report_file"
    
    success "Backup report generated: $report_file"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Healthcare Claims Backup - $ENVIRONMENT: $status - $message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    if [[ -n "${TEAMS_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Healthcare Claims Backup - $ENVIRONMENT: $status - $message\"}" \
            "$TEAMS_WEBHOOK_URL" || true
    fi
}

# Main backup function
main_backup() {
    log "Starting backup process for $ENVIRONMENT environment..."
    
    local start_time=$(date +%s)
    local backup_success=true
    
    check_prerequisites
    load_env_config
    setup_backup_directory
    
    # Perform backups
    backup_mongodb || backup_success=false
    backup_redis || backup_success=false
    backup_elasticsearch || backup_success=false
    backup_configuration
    backup_logs
    
    # Upload and cleanup
    upload_to_cloud
    cleanup_old_backups
    generate_backup_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local duration_formatted=$(printf '%02d:%02d:%02d' $((duration/3600)) $((duration%3600/60)) $((duration%60)))
    
    if $backup_success; then
        success "Backup completed successfully in $duration_formatted"
        send_notification "SUCCESS" "Backup completed in $duration_formatted"
    else
        error "Backup completed with errors in $duration_formatted"
        send_notification "PARTIAL_SUCCESS" "Backup completed with errors in $duration_formatted"
        exit 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [ENVIRONMENT] [BACKUP_TYPE]"
    echo ""
    echo "Arguments:"
    echo "  ENVIRONMENT   Target environment (development|staging|production)"
    echo "  BACKUP_TYPE   Type of backup (full|incremental|differential)"
    echo ""
    echo "Examples:"
    echo "  $0 staging full"
    echo "  $0 production incremental"
}

# Main execution
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    usage
    exit 0
fi

# Run backup if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main_backup
fi
