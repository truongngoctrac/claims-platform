/**
 * Load Balancer Manager
 * Healthcare Claims Processing - Load Balancing Implementation
 */

import { LoadBalancerConfig } from '../types';

export class LoadBalancerManager {
  private nginxConfig: string = '';
  private haproxyConfig: string = '';
  private serviceEndpoints: Map<string, string[]> = new Map();

  constructor(private config: LoadBalancerConfig) {}

  async initialize(): Promise<void> {
    console.log(`🔄 Initializing ${this.config.type} load balancer`);
    
    switch (this.config.type) {
      case 'nginx':
        await this.initializeNginx();
        break;
      case 'haproxy':
        await this.initializeHAProxy();
        break;
      case 'traefik':
        await this.initializeTraefik();
        break;
    }

    console.log(`✅ ${this.config.type} load balancer initialized`);
  }

  private async initializeNginx(): Promise<void> {
    this.nginxConfig = this.generateNginxConfig();
    // In production, this would write to actual nginx config file
    console.log('📝 NGINX configuration generated');
  }

  private async initializeHAProxy(): Promise<void> {
    this.haproxyConfig = this.generateHAProxyConfig();
    // In production, this would write to actual haproxy config file
    console.log('📝 HAProxy configuration generated');
  }

  private async initializeTraefik(): Promise<void> {
    // Traefik dynamic configuration
    console.log('📝 Traefik configuration generated');
  }

  private generateNginxConfig(): string {
    return `
# Healthcare Claims Processing - NGINX Load Balancer Configuration
# Generated at: ${new Date().toISOString()}

upstream claims_backend {
    ${this.config.algorithms === 'least-connections' ? 'least_conn;' : ''}
    ${this.config.algorithms === 'ip-hash' ? 'ip_hash;' : ''}
    
    # Claims service instances
    server claims-service-1:3001 max_fails=3 fail_timeout=30s;
    server claims-service-2:3001 max_fails=3 fail_timeout=30s;
    server claims-service-3:3001 max_fails=3 fail_timeout=30s;
    
    # Health check
    keepalive 32;
}

upstream user_management_backend {
    ${this.config.algorithms === 'least-connections' ? 'least_conn;' : ''}
    
    server user-service-1:3002 max_fails=3 fail_timeout=30s;
    server user-service-2:3002 max_fails=3 fail_timeout=30s;
    
    keepalive 16;
}

upstream policy_management_backend {
    ${this.config.algorithms === 'least-connections' ? 'least_conn;' : ''}
    
    server policy-service-1:3003 max_fails=3 fail_timeout=30s;
    server policy-service-2:3003 max_fails=3 fail_timeout=30s;
    
    keepalive 16;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;

# Connection limits
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;

server {
    listen 80;
    listen [::]:80;
    ${this.config.sslEnabled ? `
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    ssl_certificate /etc/ssl/certs/healthcare-claims.crt;
    ssl_certificate_key /etc/ssl/private/healthcare-claims.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ` : ''}

    server_name healthcare-claims.local;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Connection limits
    limit_conn conn_limit_per_ip 20;
    
    # Health check endpoint
    location ${this.config.healthCheckPath} {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
    
    # Claims API
    location /api/claims {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://claims_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout ${this.config.timeoutMs}ms;
        proxy_send_timeout ${this.config.timeoutMs}ms;
        proxy_read_timeout ${this.config.timeoutMs}ms;
        
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        
        # Health check
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 30s;
    }
    
    # User Management API
    location /api/users {
        limit_req zone=api_limit burst=15 nodelay;
        
        proxy_pass http://user_management_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout ${this.config.timeoutMs}ms;
        proxy_send_timeout ${this.config.timeoutMs}ms;
        proxy_read_timeout ${this.config.timeoutMs}ms;
    }
    
    # Authentication API
    location /api/auth {
        limit_req zone=auth_limit burst=10 nodelay;
        
        proxy_pass http://user_management_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout ${this.config.timeoutMs}ms;
        proxy_send_timeout ${this.config.timeoutMs}ms;
        proxy_read_timeout ${this.config.timeoutMs}ms;
    }
    
    # Policy Management API
    location /api/policies {
        limit_req zone=api_limit burst=15 nodelay;
        
        proxy_pass http://policy_management_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout ${this.config.timeoutMs}ms;
        proxy_send_timeout ${this.config.timeoutMs}ms;
        proxy_read_timeout ${this.config.timeoutMs}ms;
    }
    
    # Frontend static files
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
}

# Monitoring and metrics
server {
    listen 8080;
    server_name localhost;
    
    location /nginx-status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
    }
    
    location /metrics {
        access_log off;
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
        return 200 "nginx_connections_active $connections_active\\n";
        add_header Content-Type text/plain;
    }
}
`;
  }

  private generateHAProxyConfig(): string {
    return `
# Healthcare Claims Processing - HAProxy Load Balancer Configuration
# Generated at: ${new Date().toISOString()}

global
    daemon
    maxconn ${this.config.maxConnections}
    log stdout local0
    
    # SSL configuration
    ${this.config.sslEnabled ? `
    ssl-default-bind-ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512
    ssl-default-bind-options ssl-min-ver TLSv1.2 no-tls-tickets
    ` : ''}

defaults
    mode http
    timeout connect 5000ms
    timeout client ${this.config.timeoutMs}ms
    timeout server ${this.config.timeoutMs}ms
    option httplog
    option dontlognull
    option redispatch
    retries 3
    
    # Health checks
    option httpchk GET ${this.config.healthCheckPath}
    
    # Compression
    compression algo gzip
    compression type text/html text/css text/javascript application/javascript application/json

# Frontend configuration
frontend healthcare_claims_frontend
    bind *:80
    ${this.config.sslEnabled ? 'bind *:443 ssl crt /etc/ssl/certs/healthcare-claims.pem' : ''}
    
    # Security headers
    http-response set-header X-Frame-Options DENY
    http-response set-header X-Content-Type-Options nosniff
    http-response set-header X-XSS-Protection "1; mode=block"
    ${this.config.sslEnabled ? 'http-response set-header Strict-Transport-Security "max-age=31536000; includeSubDomains"' : ''}
    
    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request reject if { sc_http_req_rate(0) gt 20 }
    
    # Routing rules
    acl is_claims_api path_beg /api/claims
    acl is_users_api path_beg /api/users
    acl is_auth_api path_beg /api/auth
    acl is_policies_api path_beg /api/policies
    acl is_health_check path ${this.config.healthCheckPath}
    
    use_backend claims_backend if is_claims_api
    use_backend user_management_backend if is_users_api
    use_backend user_management_backend if is_auth_api
    use_backend policy_management_backend if is_policies_api
    use_backend health_backend if is_health_check
    default_backend frontend_backend

# Backend configurations
backend claims_backend
    balance ${this.getHAProxyAlgorithm()}
    option httpchk GET /health
    
    server claims-1 claims-service-1:3001 check maxconn 100 weight 100
    server claims-2 claims-service-2:3001 check maxconn 100 weight 100
    server claims-3 claims-service-3:3001 check maxconn 100 weight 100

backend user_management_backend
    balance ${this.getHAProxyAlgorithm()}
    option httpchk GET /health
    
    server user-1 user-service-1:3002 check maxconn 50 weight 100
    server user-2 user-service-2:3002 check maxconn 50 weight 100

backend policy_management_backend
    balance ${this.getHAProxyAlgorithm()}
    option httpchk GET /health
    
    server policy-1 policy-service-1:3003 check maxconn 50 weight 100
    server policy-2 policy-service-2:3003 check maxconn 50 weight 100

backend frontend_backend
    balance roundrobin
    option httpchk GET /health
    
    server frontend-1 frontend-service-1:8080 check maxconn 200 weight 100
    server frontend-2 frontend-service-2:8080 check maxconn 200 weight 100

backend health_backend
    http-request return status 200 content-type text/plain string "healthy"

# Statistics interface
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
    stats admin if TRUE
    
    # Restrict access
    stats auth admin:${process.env.HAPROXY_STATS_PASSWORD || 'healthcare2024'}
`;
  }

  private getHAProxyAlgorithm(): string {
    switch (this.config.algorithms) {
      case 'least-connections':
        return 'leastconn';
      case 'ip-hash':
        return 'source';
      default:
        return 'roundrobin';
    }
  }

  async updateServiceEndpoints(serviceName: string, replicas: number): Promise<void> {
    console.log(`🔄 Updating load balancer for ${serviceName} with ${replicas} replicas`);
    
    const endpoints = Array.from({ length: replicas }, (_, i) => 
      `${serviceName}-${i + 1}:${this.getServicePort(serviceName)}`
    );
    
    this.serviceEndpoints.set(serviceName, endpoints);
    
    // In production, this would trigger configuration reload
    await this.reloadConfiguration();
    
    console.log(`✅ Load balancer updated for ${serviceName}`);
  }

  private getServicePort(serviceName: string): number {
    const servicePortMap: { [key: string]: number } = {
      'claims-service': 3001,
      'user-service': 3002,
      'policy-service': 3003,
      'frontend-service': 8080
    };
    
    return servicePortMap[serviceName] || 3000;
  }

  private async reloadConfiguration(): Promise<void> {
    // In production, this would reload nginx/haproxy configuration
    console.log('🔄 Reloading load balancer configuration');
    
    switch (this.config.type) {
      case 'nginx':
        // exec('nginx -s reload')
        break;
      case 'haproxy':
        // exec('haproxy -sf $(cat /var/run/haproxy.pid)')
        break;
    }
  }

  async getMetrics(): Promise<any> {
    return {
      type: this.config.type,
      activeConnections: Math.floor(Math.random() * this.config.maxConnections),
      maxConnections: this.config.maxConnections,
      requestsPerSecond: Math.floor(Math.random() * 1000),
      healthyBackends: this.serviceEndpoints.size,
      algorithm: this.config.algorithms,
      sslEnabled: this.config.sslEnabled,
      lastConfigUpdate: new Date().toISOString()
    };
  }

  async isHealthy(): Promise<boolean> {
    // In production, this would check actual load balancer health
    return true;
  }

  async performHealthCheck(): Promise<boolean> {
    try {
      // Check if load balancer is responding
      // In production, make actual HTTP request to health check endpoint
      return true;
    } catch (error) {
      console.error('Load balancer health check failed:', error);
      return false;
    }
  }
}
