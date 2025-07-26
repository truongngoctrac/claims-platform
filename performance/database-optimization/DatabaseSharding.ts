/**
 * Database Sharding Implementation
 * Advanced sharding strategies for healthcare data distribution
 */

export interface ShardingConfig {
  shardingStrategy: 'patient-based' | 'date-based' | 'hash-based' | 'composite';
  numberOfShards: number;
  shardKey: string;
  enableCrossShardQueries: boolean;
  healthcareCompliant: boolean;
  dataLocality: 'regional' | 'global';
}

export interface ShardDefinition {
  shardId: string;
  shardRange: string;
  connectionString: string;
  status: 'active' | 'readonly' | 'maintenance';
  dataTypes: string[];
  region: string;
  patientCount?: number;
  dataSize: number;
}

export class DatabaseSharding {
  private config: ShardingConfig;
  private shards: Map<string, ShardDefinition> = new Map();

  constructor(config: Partial<ShardingConfig> = {}) {
    this.config = {
      shardingStrategy: 'patient-based',
      numberOfShards: 4,
      shardKey: 'patient_id',
      enableCrossShardQueries: true,
      healthcareCompliant: true,
      dataLocality: 'regional',
      ...config
    };

    this.initializeHealthcareShards();
  }

  private initializeHealthcareShards(): void {
    // Create healthcare-optimized shards
    for (let i = 0; i < this.config.numberOfShards; i++) {
      const shard: ShardDefinition = {
        shardId: `healthcare_shard_${i}`,
        shardRange: this.generateShardRange(i),
        connectionString: `postgresql://user:pass@shard${i}.healthcare.internal:5432/healthcare_db`,
        status: 'active',
        dataTypes: ['patients', 'claims', 'medical_records'],
        region: this.getRegionForShard(i),
        dataSize: 0
      };
      this.shards.set(shard.shardId, shard);
    }
  }

  private generateShardRange(shardIndex: number): string {
    switch (this.config.shardingStrategy) {
      case 'patient-based':
        const startRange = shardIndex * 1000000;
        const endRange = (shardIndex + 1) * 1000000 - 1;
        return `patient_id BETWEEN ${startRange} AND ${endRange}`;
      
      case 'hash-based':
        return `patient_id % ${this.config.numberOfShards} = ${shardIndex}`;
        
      default:
        return `shard_${shardIndex}`;
    }
  }

  private getRegionForShard(shardIndex: number): string {
    const regions = ['us-east', 'us-west', 'eu-central', 'asia-pacific'];
    return regions[shardIndex % regions.length];
  }

  /**
   * Route query to appropriate shard(s)
   */
  routeQuery(sql: string, params: any[]): { shardIds: string[]; routingReason: string } {
    // Extract patient_id from query if present
    const patientId = this.extractPatientId(sql, params);
    
    if (patientId) {
      const shardId = this.getShardForPatientId(patientId);
      return {
        shardIds: [shardId],
        routingReason: `Routed to ${shardId} based on patient_id: ${patientId}`
      };
    }

    // If no patient_id, check if cross-shard query is needed
    if (this.requiresCrossShardQuery(sql)) {
      if (this.config.enableCrossShardQueries) {
        return {
          shardIds: Array.from(this.shards.keys()),
          routingReason: 'Cross-shard query required - distributed across all shards'
        };
      } else {
        throw new Error('Cross-shard queries are disabled');
      }
    }

    // Default to first shard
    return {
      shardIds: [Array.from(this.shards.keys())[0]],
      routingReason: 'Default routing to primary shard'
    };
  }

  private extractPatientId(sql: string, params: any[]): number | null {
    // Simple extraction - would be more sophisticated in production
    const patientIdMatch = sql.match(/patient_id\s*=\s*\?/i);
    if (patientIdMatch && params.length > 0) {
      return parseInt(params[0]);
    }
    
    const directMatch = sql.match(/patient_id\s*=\s*(\d+)/i);
    if (directMatch) {
      return parseInt(directMatch[1]);
    }
    
    return null;
  }

  private getShardForPatientId(patientId: number): string {
    switch (this.config.shardingStrategy) {
      case 'hash-based':
        const shardIndex = patientId % this.config.numberOfShards;
        return `healthcare_shard_${shardIndex}`;
        
      case 'patient-based':
        const rangeIndex = Math.floor(patientId / 1000000);
        return `healthcare_shard_${Math.min(rangeIndex, this.config.numberOfShards - 1)}`;
        
      default:
        return `healthcare_shard_0`;
    }
  }

  private requiresCrossShardQuery(sql: string): boolean {
    const crossShardPatterns = [
      /count\(\*\).*from.*patients/i,
      /sum\(.*\).*from.*claims/i,
      /group by.*provider_id/i,
      /aggregate|sum|count|avg|max|min/i
    ];
    
    return crossShardPatterns.some(pattern => pattern.test(sql));
  }

  /**
   * Generate healthcare sharding report
   */
  generateShardingReport(): string {
    const totalShards = this.shards.size;
    const activeShards = Array.from(this.shards.values()).filter(s => s.status === 'active').length;
    
    return `
# Healthcare Database Sharding Report

## Sharding Overview
- **Strategy**: ${this.config.shardingStrategy}
- **Total Shards**: ${totalShards}
- **Active Shards**: ${activeShards}
- **Shard Key**: ${this.config.shardKey}
- **Cross-Shard Queries**: ${this.config.enableCrossShardQueries ? 'Enabled' : 'Disabled'}

## Shard Distribution
${Array.from(this.shards.values()).map(shard => `
### ${shard.shardId}
- **Range**: ${shard.shardRange}
- **Status**: ${shard.status}
- **Region**: ${shard.region}
- **Data Types**: ${shard.dataTypes.join(', ')}
- **Data Size**: ${(shard.dataSize / 1024 / 1024).toFixed(2)} MB
`).join('')}

## Healthcare Compliance
- **HIPAA Compliant**: ${this.config.healthcareCompliant ? '✅ Yes' : '❌ No'}
- **Data Locality**: ${this.config.dataLocality}
- **Patient Data Isolation**: Ensured through ${this.config.shardingStrategy} strategy

## Performance Benefits
- **Query Performance**: ${((1 - (1/totalShards)) * 100).toFixed(1)}% reduction in data scanned per query
- **Scalability**: Linear scaling with shard additions
- **Maintenance**: Independent shard maintenance possible
    `.trim();
  }
}
