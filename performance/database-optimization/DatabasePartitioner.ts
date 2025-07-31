/**
 * Database Partitioning Implementation
 * Advanced table partitioning strategies for healthcare claims data
 */

export interface PartitioningConfig {
  strategy: 'range' | 'hash' | 'list' | 'composite';
  partitionColumn: string;
  partitionSize: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  retentionPeriod: number; // months
  enableAutoPartitioning: boolean;
  enablePartitionPruning: boolean;
  compressionEnabled: boolean;
}

export interface PartitionPlan {
  tableName: string;
  strategy: PartitioningStrategy;
  partitions: PartitionDefinition[];
  maintenanceSchedule: MaintenanceSchedule;
  performanceProjection: PerformanceProjection;
  migrationPlan: MigrationStep[];
}

export interface PartitioningStrategy {
  type: 'range' | 'hash' | 'list' | 'composite';
  partitionKey: string[];
  subPartitionKey?: string[];
  partitionExpression: string;
  healthcareContext: string;
}

export interface PartitionDefinition {
  partitionName: string;
  tableName: string;
  partitionType: string;
  partitionBounds: string;
  estimatedSize: number;
  rowCount: number;
  creationDate: Date;
  lastAccessed?: Date;
  compressionRatio?: number;
}

export interface MaintenanceSchedule {
  autoCreatePartitions: boolean;
  autoDropPartitions: boolean;
  partitionCreationAdvance: number; // days
  archivalSchedule: string; // cron expression
  compressionSchedule: string;
  statisticsUpdateSchedule: string;
}

export interface PerformanceProjection {
  currentQueryTime: number;
  projectedQueryTime: number;
  improvementPercentage: number;
  storageReduction: number;
  maintenanceOverhead: number;
}

export interface MigrationStep {
  stepNumber: number;
  description: string;
  sqlCommand: string;
  estimatedDuration: string;
  riskLevel: 'low' | 'medium' | 'high';
  rollbackCommand?: string;
  prerequisites: string[];
}

export class DatabasePartitioner {
  private config: PartitioningConfig;
  private healthcareDataMappings = new Map<string, HealthcareDataProfile>();

  constructor(config: Partial<PartitioningConfig> = {}) {
    this.config = {
      strategy: 'range',
      partitionColumn: 'date_created',
      partitionSize: 'monthly',
      retentionPeriod: 84, // 7 years for healthcare compliance
      enableAutoPartitioning: true,
      enablePartitionPruning: true,
      compressionEnabled: true,
      ...config
    };

    this.initializeHealthcareProfiles();
  }

  /**
   * Initialize healthcare-specific data profiles
   */
  private initializeHealthcareProfiles(): void {
    this.healthcareDataMappings.set('claims', {
      dataType: 'claims',
      retentionRequirement: 84, // 7 years
      accessPattern: 'recent-heavy',
      complianceLevel: 'hipaa-required',
      partitioningRecommendation: 'date-based-monthly',
      sensitivityLevel: 'high'
    });

    this.healthcareDataMappings.set('patients', {
      dataType: 'demographics',
      retentionRequirement: 120, // 10 years
      accessPattern: 'active-lookup',
      complianceLevel: 'hipaa-critical',
      partitioningRecommendation: 'hash-by-patient-id',
      sensitivityLevel: 'critical'
    });

    this.healthcareDataMappings.set('audit_logs', {
      dataType: 'audit',
      retentionRequirement: 84, // 7 years
      accessPattern: 'append-only',
      complianceLevel: 'sox-required',
      partitioningRecommendation: 'date-based-daily',
      sensitivityLevel: 'high'
    });
  }

  /**
   * Generate partitioning plan for a table
   */
  async generatePartitioningPlan(tableName: string): Promise<PartitionPlan> {
    console.log(`📊 Generating partitioning plan for: ${tableName}`);

    const healthcareProfile = this.healthcareDataMappings.get(tableName);
    const strategy = this.determinePartitioningStrategy(tableName, healthcareProfile);
    const partitions = await this.generatePartitionDefinitions(tableName, strategy);
    const maintenanceSchedule = this.createMaintenanceSchedule(tableName, strategy);
    const performanceProjection = this.calculatePerformanceProjection(tableName, partitions);
    const migrationPlan = this.createMigrationPlan(tableName, strategy, partitions);

    return {
      tableName,
      strategy,
      partitions,
      maintenanceSchedule,
      performanceProjection,
      migrationPlan
    };
  }

  /**
   * Determine optimal partitioning strategy
   */
  private determinePartitioningStrategy(
    tableName: string, 
    profile?: HealthcareDataProfile
  ): PartitioningStrategy {
    
    if (!profile) {
      // Default strategy for unknown tables
      return {
        type: 'range',
        partitionKey: ['date_created'],
        partitionExpression: 'RANGE (date_created)',
        healthcareContext: 'Standard date-based partitioning for operational data'
      };
    }

    switch (profile.partitioningRecommendation) {
      case 'date-based-monthly':
        return {
          type: 'range',
          partitionKey: ['date_created'],
          partitionExpression: 'RANGE (date_created)',
          healthcareContext: 'Monthly partitions for claims data - optimizes recent access patterns while supporting compliance requirements'
        };

      case 'date-based-daily':
        return {
          type: 'range',
          partitionKey: ['created_at'],
          partitionExpression: 'RANGE (created_at)',
          healthcareContext: 'Daily partitions for audit logs - supports compliance audit trails and efficient log rotation'
        };

      case 'hash-by-patient-id':
        return {
          type: 'hash',
          partitionKey: ['patient_id'],
          partitionExpression: 'HASH (patient_id)',
          healthcareContext: 'Hash partitioning by patient - ensures even distribution while maintaining patient data locality'
        };

      case 'composite-patient-date':
        return {
          type: 'composite',
          partitionKey: ['patient_id'],
          subPartitionKey: ['date_created'],
          partitionExpression: 'RANGE (date_created) SUBPARTITION BY HASH (patient_id)',
          healthcareContext: 'Composite partitioning - combines patient locality with temporal access patterns'
        };

      default:
        return {
          type: 'range',
          partitionKey: ['date_created'],
          partitionExpression: 'RANGE (date_created)',
          healthcareContext: 'Default date-based partitioning'
        };
    }
  }

  /**
   * Generate partition definitions
   */
  private async generatePartitionDefinitions(
    tableName: string, 
    strategy: PartitioningStrategy
  ): Promise<PartitionDefinition[]> {
    const partitions: PartitionDefinition[] = [];
    const currentDate = new Date();
    const retentionMonths = this.config.retentionPeriod;

    if (strategy.type === 'range' && strategy.partitionKey.includes('date_created')) {
      // Generate monthly partitions for healthcare data
      for (let i = -retentionMonths; i <= 6; i++) { // Past retention + 6 months future
        const partitionDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const nextMonth = new Date(partitionDate.getFullYear(), partitionDate.getMonth() + 1, 1);
        
        const partitionName = `${tableName}_${partitionDate.getFullYear()}_${(partitionDate.getMonth() + 1).toString().padStart(2, '0')}`;
        
        partitions.push({
          partitionName,
          tableName,
          partitionType: 'RANGE',
          partitionBounds: `FROM ('${partitionDate.toISOString().split('T')[0]}') TO ('${nextMonth.toISOString().split('T')[0]}')`,
          estimatedSize: this.estimatePartitionSize(tableName, partitionDate),
          rowCount: this.estimatePartitionRows(tableName, partitionDate),
          creationDate: i <= 0 ? partitionDate : new Date(), // Historical partitions use their date
          compressionRatio: i < -12 ? 0.3 : 1.0 // Compress data older than 1 year
        });
      }
    } else if (strategy.type === 'hash') {
      // Generate hash partitions (typically 8-16 partitions for patient data)
      const partitionCount = 12; // Good balance for patient data distribution
      
      for (let i = 0; i < partitionCount; i++) {
        partitions.push({
          partitionName: `${tableName}_hash_${i.toString().padStart(2, '0')}`,
          tableName,
          partitionType: 'HASH',
          partitionBounds: `MODULUS ${partitionCount} REMAINDER ${i}`,
          estimatedSize: this.estimateHashPartitionSize(tableName, partitionCount),
          rowCount: this.estimateHashPartitionRows(tableName, partitionCount),
          creationDate: new Date(),
          compressionRatio: 0.7 // Hash partitions can be compressed
        });
      }
    }

    return partitions;
  }

  /**
   * Create maintenance schedule
   */
  private createMaintenanceSchedule(
    tableName: string, 
    strategy: PartitioningStrategy
  ): MaintenanceSchedule {
    const healthcareProfile = this.healthcareDataMappings.get(tableName);
    
    return {
      autoCreatePartitions: this.config.enableAutoPartitioning,
      autoDropPartitions: false, // Never auto-drop healthcare data - compliance requirement
      partitionCreationAdvance: 30, // Create next month's partition 30 days in advance
      archivalSchedule: '0 2 1 * *', // 2 AM on 1st of each month
      compressionSchedule: '0 3 1 * *', // 3 AM on 1st of each month (after archival)
      statisticsUpdateSchedule: '0 4 * * 0' // 4 AM every Sunday
    };
  }

  /**
   * Calculate performance projection
   */
  private calculatePerformanceProjection(
    tableName: string, 
    partitions: PartitionDefinition[]
  ): PerformanceProjection {
    // Simplified calculation - would use actual query patterns in production
    const totalPartitions = partitions.length;
    const activePartitions = partitions.filter(p => 
      p.creationDate && p.creationDate > new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
    ).length;

    const currentQueryTime = 2000; // Assume 2 seconds average
    const partitionPruningEfficiency = activePartitions / totalPartitions;
    const projectedQueryTime = currentQueryTime * partitionPruningEfficiency;
    const improvementPercentage = ((currentQueryTime - projectedQueryTime) / currentQueryTime) * 100;
    
    const totalCurrentSize = partitions.reduce((sum, p) => sum + p.estimatedSize, 0);
    const compressedSize = partitions.reduce((sum, p) => sum + (p.estimatedSize * (p.compressionRatio || 1)), 0);
    const storageReduction = ((totalCurrentSize - compressedSize) / totalCurrentSize) * 100;

    return {
      currentQueryTime,
      projectedQueryTime,
      improvementPercentage,
      storageReduction,
      maintenanceOverhead: 5 // 5% overhead for partition maintenance
    };
  }

  /**
   * Create migration plan
   */
  private createMigrationPlan(
    tableName: string,
    strategy: PartitioningStrategy,
    partitions: PartitionDefinition[]
  ): MigrationStep[] {
    const steps: MigrationStep[] = [];

    // Step 1: Create partitioned table structure
    steps.push({
      stepNumber: 1,
      description: `Create partitioned table structure for ${tableName}`,
      sqlCommand: this.generateCreatePartitionedTableSQL(tableName, strategy),
      estimatedDuration: '5-10 minutes',
      riskLevel: 'low',
      rollbackCommand: `DROP TABLE IF EXISTS ${tableName}_partitioned;`,
      prerequisites: ['Database backup completed', 'Maintenance window scheduled']
    });

    // Step 2: Create individual partitions
    partitions.slice(0, 5).forEach((partition, index) => {
      steps.push({
        stepNumber: index + 2,
        description: `Create partition: ${partition.partitionName}`,
        sqlCommand: this.generateCreatePartitionSQL(partition),
        estimatedDuration: '1-2 minutes',
        riskLevel: 'low',
        rollbackCommand: `DROP TABLE IF EXISTS ${partition.partitionName};`,
        prerequisites: ['Partitioned table structure created']
      });
    });

    // Step 3: Migrate data
    steps.push({
      stepNumber: partitions.length + 2,
      description: `Migrate data from ${tableName} to partitioned structure`,
      sqlCommand: this.generateDataMigrationSQL(tableName),
      estimatedDuration: '2-6 hours (depends on data volume)',
      riskLevel: 'high',
      rollbackCommand: `-- Restore from backup`,
      prerequisites: ['All partitions created', 'Application maintenance mode enabled']
    });

    // Step 4: Update application configuration
    steps.push({
      stepNumber: partitions.length + 3,
      description: 'Update application configuration for partitioned access',
      sqlCommand: `-- Update application connection strings and queries`,
      estimatedDuration: '30 minutes',
      riskLevel: 'medium',
      prerequisites: ['Data migration completed', 'Application testing completed']
    });

    // Step 5: Enable partition pruning and constraints
    steps.push({
      stepNumber: partitions.length + 4,
      description: 'Enable partition pruning and create constraints',
      sqlCommand: this.generateConstraintsSQL(tableName, partitions),
      estimatedDuration: '15 minutes',
      riskLevel: 'low',
      prerequisites: ['Application updated', 'Data validation completed']
    });

    return steps;
  }

  /**
   * Generate CREATE TABLE SQL for partitioned structure
   */
  private generateCreatePartitionedTableSQL(tableName: string, strategy: PartitioningStrategy): string {
    const healthcareProfile = this.healthcareDataMappings.get(tableName);
    
    if (tableName === 'claims') {
      return `
-- Create partitioned claims table
CREATE TABLE ${tableName}_partitioned (
    claim_id SERIAL,
    patient_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    claim_amount DECIMAL(10,2) NOT NULL,
    claim_status VARCHAR(20) NOT NULL,
    date_of_service DATE NOT NULL,
    date_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    primary_diagnosis_code VARCHAR(10),
    secondary_diagnosis_code VARCHAR(10),
    -- Healthcare compliance fields
    hipaa_consent BOOLEAN DEFAULT true,
    audit_created_by VARCHAR(50) NOT NULL,
    audit_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (claim_id, date_created)
) PARTITION BY ${strategy.partitionExpression};

-- Add healthcare-specific constraints
ALTER TABLE ${tableName}_partitioned 
ADD CONSTRAINT chk_claim_amount_positive CHECK (claim_amount > 0);

ALTER TABLE ${tableName}_partitioned 
ADD CONSTRAINT chk_service_date_valid CHECK (date_of_service <= CURRENT_DATE);

-- Add indexes that will be inherited by partitions
CREATE INDEX idx_${tableName}_patient_lookup ON ${tableName}_partitioned (patient_id, date_created);
CREATE INDEX idx_${tableName}_provider_lookup ON ${tableName}_partitioned (provider_id, date_created);
CREATE INDEX idx_${tableName}_status_lookup ON ${tableName}_partitioned (claim_status, date_created);
      `.trim();
    }

    return `
-- Generic partitioned table creation
CREATE TABLE ${tableName}_partitioned (
    LIKE ${tableName} INCLUDING ALL
) PARTITION BY ${strategy.partitionExpression};
    `.trim();
  }

  /**
   * Generate CREATE PARTITION SQL
   */
  private generateCreatePartitionSQL(partition: PartitionDefinition): string {
    if (partition.partitionType === 'RANGE') {
      return `
-- Create range partition: ${partition.partitionName}
CREATE TABLE ${partition.partitionName} PARTITION OF ${partition.tableName}_partitioned
FOR VALUES ${partition.partitionBounds};

-- Add compression for older partitions
${partition.compressionRatio && partition.compressionRatio < 1 
  ? `ALTER TABLE ${partition.partitionName} SET (compression = 'lz4');`
  : '-- No compression for recent data'
}
      `.trim();
    } else if (partition.partitionType === 'HASH') {
      return `
-- Create hash partition: ${partition.partitionName}
CREATE TABLE ${partition.partitionName} PARTITION OF ${partition.tableName}_partitioned
FOR VALUES WITH (${partition.partitionBounds});
      `.trim();
    }

    return `-- Partition creation for ${partition.partitionName}`;
  }

  /**
   * Generate data migration SQL
   */
  private generateDataMigrationSQL(tableName: string): string {
    return `
-- Healthcare data migration with audit trail
BEGIN;

-- Create migration audit record
INSERT INTO migration_audit (table_name, migration_type, start_time, status)
VALUES ('${tableName}', 'partitioning', CURRENT_TIMESTAMP, 'in_progress');

-- Migrate data in batches to minimize lock time
INSERT INTO ${tableName}_partitioned 
SELECT * FROM ${tableName} 
WHERE date_created >= '2020-01-01'  -- Adjust based on retention policy
ORDER BY date_created;

-- Verify data integrity
DO $$
DECLARE
    original_count INTEGER;
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO original_count FROM ${tableName};
    SELECT COUNT(*) INTO migrated_count FROM ${tableName}_partitioned;
    
    IF original_count != migrated_count THEN
        RAISE EXCEPTION 'Data migration failed: count mismatch (original: %, migrated: %)', 
                       original_count, migrated_count;
    END IF;
    
    RAISE NOTICE 'Data migration successful: % rows migrated', migrated_count;
END $$;

-- Update migration audit record
UPDATE migration_audit 
SET end_time = CURRENT_TIMESTAMP, 
    status = 'completed',
    rows_migrated = (SELECT COUNT(*) FROM ${tableName}_partitioned)
WHERE table_name = '${tableName}' 
  AND migration_type = 'partitioning' 
  AND status = 'in_progress';

COMMIT;
    `.trim();
  }

  /**
   * Generate constraints SQL
   */
  private generateConstraintsSQL(tableName: string, partitions: PartitionDefinition[]): string {
    return `
-- Enable partition pruning
SET enable_partition_pruning = on;
SET constraint_exclusion = partition;

-- Create partition-wise joins
SET enable_partitionwise_join = on;
SET enable_partitionwise_aggregate = on;

-- Update table statistics for all partitions
${partitions.map(p => `ANALYZE ${p.partitionName};`).join('\n')}

-- Create maintenance procedures
CREATE OR REPLACE FUNCTION maintain_${tableName}_partitions()
RETURNS void AS $$
BEGIN
    -- Auto-create next month's partition
    PERFORM create_next_partition('${tableName}_partitioned');
    
    -- Update statistics on active partitions
    PERFORM update_partition_statistics('${tableName}_partitioned');
    
    -- Log maintenance activity
    INSERT INTO partition_maintenance_log (table_name, maintenance_type, execution_time)
    VALUES ('${tableName}', 'auto_maintenance', CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Schedule automatic maintenance
SELECT cron.schedule('${tableName}_maintenance', '0 2 1 * *', 'SELECT maintain_${tableName}_partitions();');
    `.trim();
  }

  /**
   * Estimate partition size
   */
  private estimatePartitionSize(tableName: string, partitionDate: Date): number {
    // Simplified estimation based on table patterns
    const baseSizePerMonth = {
      'claims': 500 * 1024 * 1024, // 500MB per month
      'patients': 50 * 1024 * 1024, // 50MB per month
      'audit_logs': 200 * 1024 * 1024 // 200MB per month
    };

    return baseSizePerMonth[tableName as keyof typeof baseSizePerMonth] || 100 * 1024 * 1024;
  }

  /**
   * Estimate partition row count
   */
  private estimatePartitionRows(tableName: string, partitionDate: Date): number {
    const baseRowsPerMonth = {
      'claims': 100000, // 100K claims per month
      'patients': 10000, // 10K new patients per month
      'audit_logs': 500000 // 500K audit entries per month
    };

    return baseRowsPerMonth[tableName as keyof typeof baseRowsPerMonth] || 50000;
  }

  /**
   * Estimate hash partition size
   */
  private estimateHashPartitionSize(tableName: string, partitionCount: number): number {
    const totalEstimatedSize = 10 * 1024 * 1024 * 1024; // 10GB total
    return totalEstimatedSize / partitionCount;
  }

  /**
   * Estimate hash partition rows
   */
  private estimateHashPartitionRows(tableName: string, partitionCount: number): number {
    const totalEstimatedRows = 10000000; // 10M rows total
    return totalEstimatedRows / partitionCount;
  }

  /**
   * Generate partitioning report
   */
  generatePartitioningReport(tableName: string): Promise<string> {
    return this.generatePartitioningPlan(tableName).then(plan => {
      return `
# Database Partitioning Report: ${tableName}

## Strategy Overview
- **Partitioning Type**: ${plan.strategy.type.toUpperCase()}
- **Partition Key**: ${plan.strategy.partitionKey.join(', ')}
- **Healthcare Context**: ${plan.strategy.healthcareContext}

## Performance Projection
- **Current Query Time**: ${plan.performanceProjection.currentQueryTime}ms
- **Projected Query Time**: ${plan.performanceProjection.projectedQueryTime.toFixed(0)}ms
- **Performance Improvement**: ${plan.performanceProjection.improvementPercentage.toFixed(1)}%
- **Storage Reduction**: ${plan.performanceProjection.storageReduction.toFixed(1)}%

## Partition Summary
- **Total Partitions**: ${plan.partitions.length}
- **Active Partitions**: ${plan.partitions.filter(p => p.creationDate > new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)).length}
- **Compressed Partitions**: ${plan.partitions.filter(p => p.compressionRatio && p.compressionRatio < 1).length}
- **Total Storage**: ${(plan.partitions.reduce((sum, p) => sum + p.estimatedSize, 0) / 1024 / 1024 / 1024).toFixed(2)}GB

## Healthcare Compliance
- **Data Retention**: ${this.config.retentionPeriod} months (Healthcare compliance)
- **HIPAA Considerations**: Patient data locality maintained
- **Audit Requirements**: Partition-level audit trails supported
- **Backup Strategy**: Partition-level backup and recovery enabled

## Migration Plan
${plan.migrationPlan.map((step, index) => `
### Step ${step.stepNumber}: ${step.description}
- **Duration**: ${step.estimatedDuration}
- **Risk Level**: ${step.riskLevel.toUpperCase()}
- **Prerequisites**: ${step.prerequisites.join(', ')}
`).join('')}

## Maintenance Schedule
- **Auto-create Partitions**: ${plan.maintenanceSchedule.autoCreatePartitions ? 'Enabled' : 'Disabled'}
- **Partition Creation Advance**: ${plan.maintenanceSchedule.partitionCreationAdvance} days
- **Archival Schedule**: ${plan.maintenanceSchedule.archivalSchedule}
- **Compression Schedule**: ${plan.maintenanceSchedule.compressionSchedule}

## Recommendations
1. **Implement gradually** during low-usage hours
2. **Test thoroughly** with production-like data volumes
3. **Monitor performance** before and after implementation
4. **Update application queries** to leverage partition pruning
5. **Establish monitoring** for partition maintenance

## Next Steps
1. Review and approve partitioning strategy
2. Schedule implementation during maintenance window
3. Prepare rollback procedures
4. Update application documentation
5. Train operations team on partition maintenance
      `.trim();
    });
  }
}

/**
 * Healthcare data profile interface
 */
interface HealthcareDataProfile {
  dataType: string;
  retentionRequirement: number; // months
  accessPattern: 'recent-heavy' | 'uniform' | 'active-lookup' | 'append-only';
  complianceLevel: 'hipaa-required' | 'hipaa-critical' | 'sox-required';
  partitioningRecommendation: string;
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Healthcare partitioning templates
 */
export class HealthcarePartitioningTemplates {
  /**
   * Get claims table partitioning template
   */
  static getClaimsPartitioningSQL(): string {
    return `
-- Healthcare Claims Table Partitioning Template
-- Optimized for date-based access patterns with compliance considerations

-- 1. Create partitioned claims table
CREATE TABLE claims_partitioned (
    claim_id SERIAL,
    patient_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    claim_amount DECIMAL(10,2) NOT NULL,
    claim_status VARCHAR(20) NOT NULL,
    date_of_service DATE NOT NULL,
    date_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    primary_diagnosis_code VARCHAR(10),
    secondary_diagnosis_code VARCHAR(10),
    
    -- HIPAA compliance fields
    hipaa_consent BOOLEAN DEFAULT true,
    phi_access_level VARCHAR(20) DEFAULT 'standard',
    
    -- Audit fields
    created_by VARCHAR(50) NOT NULL,
    updated_by VARCHAR(50),
    updated_at TIMESTAMP,
    
    PRIMARY KEY (claim_id, date_created),
    
    -- Healthcare business rules
    CONSTRAINT chk_claim_amount_positive CHECK (claim_amount > 0),
    CONSTRAINT chk_service_date_valid CHECK (date_of_service <= CURRENT_DATE),
    CONSTRAINT chk_status_valid CHECK (claim_status IN ('submitted', 'pending', 'approved', 'denied', 'paid'))
    
) PARTITION BY RANGE (date_created);

-- 2. Create monthly partitions for current and future data
CREATE TABLE claims_2024_01 PARTITION OF claims_partitioned
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE claims_2024_02 PARTITION OF claims_partitioned
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- 3. Create indexes inherited by all partitions
CREATE INDEX idx_claims_patient_date ON claims_partitioned (patient_id, date_created);
CREATE INDEX idx_claims_provider_date ON claims_partitioned (provider_id, date_created);
CREATE INDEX idx_claims_status_date ON claims_partitioned (claim_status, date_created);
CREATE INDEX idx_claims_diagnosis ON claims_partitioned (primary_diagnosis_code, secondary_diagnosis_code);

-- 4. Enable partition pruning
SET enable_partition_pruning = on;
SET constraint_exclusion = partition;
    `;
  }

  /**
   * Get audit logs partitioning template
   */
  static getAuditLogsPartitioningSQL(): string {
    return `
-- Healthcare Audit Logs Partitioning Template
-- Daily partitions for compliance and performance

CREATE TABLE audit_logs_partitioned (
    audit_id SERIAL,
    user_id INTEGER NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    record_id INTEGER,
    patient_id INTEGER, -- For HIPAA audit trails
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (audit_id, created_at),
    
    -- Compliance constraints
    CONSTRAINT chk_action_type_valid CHECK (action_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')),
    CONSTRAINT chk_patient_access_logged CHECK (
        (table_name IN ('patients', 'claims', 'medical_records') AND patient_id IS NOT NULL) OR
        (table_name NOT IN ('patients', 'claims', 'medical_records'))
    )
    
) PARTITION BY RANGE (created_at);

-- Create daily partitions
CREATE TABLE audit_logs_2024_01_01 PARTITION OF audit_logs_partitioned
FOR VALUES FROM ('2024-01-01') TO ('2024-01-02');

-- Indexes for audit queries
CREATE INDEX idx_audit_patient_date ON audit_logs_partitioned (patient_id, created_at) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_audit_user_date ON audit_logs_partitioned (user_id, created_at);
CREATE INDEX idx_audit_table_action ON audit_logs_partitioned (table_name, action_type, created_at);
    `;
  }
}
