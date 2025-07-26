/**
 * Service Discovery Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface ServiceInstance {
  id: string;
  name: string;
  host: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopping';
  version: string;
  metadata: Record<string, any>;
  healthCheckUrl?: string;
  lastHeartbeat: Date;
  tags: string[];
}

export interface ServiceDiscoveryConfig {
  registryType: 'consul' | 'etcd' | 'eureka' | 'in-memory';
  healthCheckInterval: number;
  heartbeatTimeout: number;
  retryAttempts: number;
  loadBalancingStrategy: 'round-robin' | 'random' | 'least-connections';
}

export interface ServiceRegistry {
  register(instance: ServiceInstance): Promise<void>;
  deregister(instanceId: string): Promise<void>;
  discover(serviceName: string): Promise<ServiceInstance[]>;
  healthCheck(instance: ServiceInstance): Promise<boolean>;
}

export class ConsulServiceRegistry implements ServiceRegistry {
  private consul: any;
  private config: ServiceDiscoveryConfig;

  constructor(config: ServiceDiscoveryConfig) {
    this.config = config;
    // Initialize Consul client
  }

  async register(instance: ServiceInstance): Promise<void> {
    const consulService = {
      ID: instance.id,
      Name: instance.name,
      Address: instance.host,
      Port: instance.port,
      Tags: instance.tags,
      Meta: instance.metadata,
      Check: {
        HTTP: instance.healthCheckUrl,
        Interval: `${this.config.healthCheckInterval}s`,
        Timeout: `${this.config.heartbeatTimeout}s`,
      },
    };

    await this.consul.agent.service.register(consulService);
    console.log(`✅ Service ${instance.name} registered with Consul`);
  }

  async deregister(instanceId: string): Promise<void> {
    await this.consul.agent.service.deregister(instanceId);
    console.log(`🔄 Service ${instanceId} deregistered from Consul`);
  }

  async discover(serviceName: string): Promise<ServiceInstance[]> {
    const services = await this.consul.health.service({
      service: serviceName,
      passing: true,
    });

    return services.map((service: any) => ({
      id: service.Service.ID,
      name: service.Service.Service,
      host: service.Service.Address,
      port: service.Service.Port,
      status: 'healthy',
      version: service.Service.Meta?.version || '1.0.0',
      metadata: service.Service.Meta || {},
      tags: service.Service.Tags || [],
      lastHeartbeat: new Date(),
    }));
  }

  async healthCheck(instance: ServiceInstance): Promise<boolean> {
    try {
      if (!instance.healthCheckUrl) return true;
      
      const response = await fetch(instance.healthCheckUrl, {
        method: 'GET',
        timeout: this.config.heartbeatTimeout,
      });
      
      return response.ok;
    } catch (error) {
      console.error(`❌ Health check failed for ${instance.name}:`, error);
      return false;
    }
  }
}

export class EtcdServiceRegistry implements ServiceRegistry {
  private etcd: any;
  private config: ServiceDiscoveryConfig;
  private leaseId: string | null = null;

  constructor(config: ServiceDiscoveryConfig) {
    this.config = config;
    // Initialize etcd client
  }

  async register(instance: ServiceInstance): Promise<void> {
    const key = `/services/${instance.name}/${instance.id}`;
    const value = JSON.stringify({
      host: instance.host,
      port: instance.port,
      status: instance.status,
      version: instance.version,
      metadata: instance.metadata,
      tags: instance.tags,
      lastHeartbeat: instance.lastHeartbeat,
    });

    // Create lease for TTL
    const lease = await this.etcd.lease.grant(this.config.heartbeatTimeout);
    this.leaseId = lease.ID;

    await this.etcd.put(key).value(value).lease(lease.ID);
    
    // Keep alive lease
    const keepAlive = await this.etcd.lease.keepAlive(lease.ID);
    keepAlive.on('keepAliveSucceeded', () => {
      console.log(`💓 Heartbeat sent for ${instance.name}`);
    });

    console.log(`✅ Service ${instance.name} registered with etcd`);
  }

  async deregister(instanceId: string): Promise<void> {
    const prefix = `/services/`;
    const keys = await this.etcd.getAll().prefix(prefix).keys();
    
    for (const key of keys) {
      if (key.includes(instanceId)) {
        await this.etcd.delete().key(key);
      }
    }

    if (this.leaseId) {
      await this.etcd.lease.revoke(this.leaseId);
    }

    console.log(`🔄 Service ${instanceId} deregistered from etcd`);
  }

  async discover(serviceName: string): Promise<ServiceInstance[]> {
    const prefix = `/services/${serviceName}/`;
    const result = await this.etcd.getAll().prefix(prefix);
    
    return result.kvs.map((kv: any) => {
      const data = JSON.parse(kv.value.toString());
      const instanceId = kv.key.toString().split('/').pop();
      
      return {
        id: instanceId,
        name: serviceName,
        host: data.host,
        port: data.port,
        status: data.status,
        version: data.version,
        metadata: data.metadata,
        tags: data.tags,
        lastHeartbeat: new Date(data.lastHeartbeat),
      };
    });
  }

  async healthCheck(instance: ServiceInstance): Promise<boolean> {
    try {
      if (!instance.healthCheckUrl) return true;
      
      const response = await fetch(instance.healthCheckUrl, {
        method: 'GET',
        timeout: this.config.heartbeatTimeout,
      });
      
      return response.ok;
    } catch (error) {
      console.error(`❌ Health check failed for ${instance.name}:`, error);
      return false;
    }
  }
}

export class ServiceDiscoveryManager {
  private registry: ServiceRegistry;
  private config: ServiceDiscoveryConfig;
  private localServices: Map<string, ServiceInstance> = new Map();

  constructor(config: ServiceDiscoveryConfig) {
    this.config = config;
    
    switch (config.registryType) {
      case 'consul':
        this.registry = new ConsulServiceRegistry(config);
        break;
      case 'etcd':
        this.registry = new EtcdServiceRegistry(config);
        break;
      default:
        throw new Error(`Unsupported registry type: ${config.registryType}`);
    }
  }

  async registerService(instance: ServiceInstance): Promise<void> {
    await this.registry.register(instance);
    this.localServices.set(instance.id, instance);
  }

  async deregisterService(instanceId: string): Promise<void> {
    await this.registry.deregister(instanceId);
    this.localServices.delete(instanceId);
  }

  async discoverService(serviceName: string): Promise<ServiceInstance[]> {
    return this.registry.discover(serviceName);
  }

  async getHealthyInstances(serviceName: string): Promise<ServiceInstance[]> {
    const instances = await this.discoverService(serviceName);
    const healthyInstances: ServiceInstance[] = [];

    for (const instance of instances) {
      const isHealthy = await this.registry.healthCheck(instance);
      if (isHealthy) {
        healthyInstances.push(instance);
      }
    }

    return healthyInstances;
  }

  async selectInstance(serviceName: string): Promise<ServiceInstance | null> {
    const healthyInstances = await this.getHealthyInstances(serviceName);
    
    if (healthyInstances.length === 0) {
      return null;
    }

    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        return this.roundRobinSelection(healthyInstances);
      case 'random':
        return this.randomSelection(healthyInstances);
      case 'least-connections':
        return this.leastConnectionsSelection(healthyInstances);
      default:
        return healthyInstances[0];
    }
  }

  private roundRobinSelection(instances: ServiceInstance[]): ServiceInstance {
    const index = Date.now() % instances.length;
    return instances[index];
  }

  private randomSelection(instances: ServiceInstance[]): ServiceInstance {
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }

  private leastConnectionsSelection(instances: ServiceInstance[]): ServiceInstance {
    // In a real implementation, you would track connection counts
    // For now, return the first instance
    return instances[0];
  }

  async startHealthChecking(): Promise<void> {
    setInterval(async () => {
      for (const [instanceId, instance] of this.localServices) {
        const isHealthy = await this.registry.healthCheck(instance);
        
        if (!isHealthy) {
          console.warn(`⚠️ Health check failed for ${instance.name}`);
          // Could implement retry logic or automatic deregistration
        }
      }
    }, this.config.healthCheckInterval * 1000);
  }
}
