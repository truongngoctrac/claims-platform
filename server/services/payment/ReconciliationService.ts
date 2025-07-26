import {
  PaymentDetails,
  PaymentStatus,
  PaymentGateway,
  Currency,
} from '../../../shared/payment';

interface ReconciliationReport {
  id: string;
  date: Date;
  gateway: PaymentGateway;
  summary: {
    totalTransactions: number;
    totalAmount: number;
    totalFees: number;
    matchedTransactions: number;
    unmatchedTransactions: number;
    discrepancies: number;
  };
  discrepancies: ReconciliationDiscrepancy[];
  unmatchedInternal: PaymentDetails[];
  unmatchedGateway: GatewayTransaction[];
  generatedAt: Date;
}

interface ReconciliationDiscrepancy {
  id: string;
  type: 'amount_mismatch' | 'status_mismatch' | 'fee_mismatch' | 'missing_transaction';
  internalTransactionId: string;
  gatewayTransactionId: string;
  description: string;
  internalData: any;
  gatewayData: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

interface GatewayTransaction {
  id: string;
  gateway: PaymentGateway;
  amount: number;
  currency: Currency;
  status: string;
  fees: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export class ReconciliationService {
  private reconciliationHistory: ReconciliationReport[] = [];
  private gatewayTransactions: Map<PaymentGateway, GatewayTransaction[]> = new Map();

  constructor() {
    this.initializeGatewayData();
  }

  async reconcileForDate(date: Date): Promise<ReconciliationReport[]> {
    const reports: ReconciliationReport[] = [];
    
    // Reconcile each gateway separately
    for (const gateway of Object.values(PaymentGateway)) {
      const report = await this.reconcileGateway(gateway, date);
      reports.push(report);
    }

    return reports;
  }

  async reconcileGateway(gateway: PaymentGateway, date: Date): Promise<ReconciliationReport> {
    const reportId = `RECON_${gateway}_${date.toISOString().split('T')[0]}_${Date.now()}`;
    
    // Get internal transactions for the date and gateway
    const internalTransactions = await this.getInternalTransactions(gateway, date);
    
    // Get gateway transactions for the date
    const gatewayTransactions = await this.getGatewayTransactions(gateway, date);
    
    // Perform reconciliation
    const reconciliationResult = this.performReconciliation(internalTransactions, gatewayTransactions);
    
    const report: ReconciliationReport = {
      id: reportId,
      date,
      gateway,
      summary: {
        totalTransactions: internalTransactions.length,
        totalAmount: internalTransactions.reduce((sum, t) => sum + t.amount, 0),
        totalFees: internalTransactions.reduce((sum, t) => sum + t.fees.total, 0),
        matchedTransactions: reconciliationResult.matched.length,
        unmatchedTransactions: reconciliationResult.unmatchedInternal.length + reconciliationResult.unmatchedGateway.length,
        discrepancies: reconciliationResult.discrepancies.length,
      },
      discrepancies: reconciliationResult.discrepancies,
      unmatchedInternal: reconciliationResult.unmatchedInternal,
      unmatchedGateway: reconciliationResult.unmatchedGateway,
      generatedAt: new Date(),
    };

    this.reconciliationHistory.push(report);
    
    // Auto-resolve minor discrepancies
    await this.autoResolveDiscrepancies(report);
    
    // Alert for critical discrepancies
    await this.alertCriticalDiscrepancies(report);

    return report;
  }

  private async getInternalTransactions(gateway: PaymentGateway, date: Date): Promise<PaymentDetails[]> {
    // Mock internal transaction retrieval
    // In real implementation, this would query the database
    return [
      {
        id: 'TXN-001',
        customerId: 'CUST-001',
        amount: 100000,
        currency: Currency.VND,
        status: PaymentStatus.COMPLETED,
        gateway: gateway,
        method: require('../../../shared/payment').PaymentMethod.BANK_TRANSFER,
        description: 'Healthcare claim payment',
        transactionId: 'TXN-001',
        gatewayTransactionId: 'GTW-001',
        fees: { gateway: 1000, platform: 100, processing: 50, total: 1150 },
        compliance: {
          level: require('../../../shared/payment').ComplianceLevel.PCI_DSS_LEVEL_1,
          verified: true,
          verifiedAt: new Date(),
        },
        riskAssessment: {
          level: require('../../../shared/payment').RiskLevel.LOW,
          score: 0.2,
          factors: {
            ipRisk: 0.1,
            deviceRisk: 0.1,
            behaviorRisk: 0.2,
            locationRisk: 0.1,
            velocityRisk: 0.1,
            overallRisk: 0.12,
          },
        },
        timeline: [],
        createdAt: date,
        updatedAt: date,
        completedAt: date,
      },
      // Add more mock transactions as needed
    ];
  }

  private async getGatewayTransactions(gateway: PaymentGateway, date: Date): Promise<GatewayTransaction[]> {
    const transactions = this.gatewayTransactions.get(gateway) || [];
    return transactions.filter(t => 
      t.timestamp.toDateString() === date.toDateString()
    );
  }

  private performReconciliation(
    internalTransactions: PaymentDetails[],
    gatewayTransactions: GatewayTransaction[]
  ): {
    matched: Array<{ internal: PaymentDetails; gateway: GatewayTransaction }>;
    unmatchedInternal: PaymentDetails[];
    unmatchedGateway: GatewayTransaction[];
    discrepancies: ReconciliationDiscrepancy[];
  } {
    const matched: Array<{ internal: PaymentDetails; gateway: GatewayTransaction }> = [];
    const unmatchedInternal: PaymentDetails[] = [];
    const unmatchedGateway: GatewayTransaction[] = [...gatewayTransactions];
    const discrepancies: ReconciliationDiscrepancy[] = [];

    for (const internalTxn of internalTransactions) {
      const gatewayTxnIndex = unmatchedGateway.findIndex(
        gtw => gtw.id === internalTxn.gatewayTransactionId ||
               this.fuzzyMatch(internalTxn, gtw)
      );

      if (gatewayTxnIndex !== -1) {
        const gatewayTxn = unmatchedGateway[gatewayTxnIndex];
        unmatchedGateway.splice(gatewayTxnIndex, 1);

        // Check for discrepancies
        const txnDiscrepancies = this.checkDiscrepancies(internalTxn, gatewayTxn);
        discrepancies.push(...txnDiscrepancies);

        matched.push({ internal: internalTxn, gateway: gatewayTxn });
      } else {
        unmatchedInternal.push(internalTxn);
      }
    }

    return { matched, unmatchedInternal, unmatchedGateway, discrepancies };
  }

  private fuzzyMatch(internal: PaymentDetails, gateway: GatewayTransaction): boolean {
    // Implement fuzzy matching logic
    const amountMatch = Math.abs(internal.amount - gateway.amount) < 100; // Allow 100 unit difference
    const timeMatch = Math.abs(internal.createdAt.getTime() - gateway.timestamp.getTime()) < 5 * 60 * 1000; // 5 minutes
    
    return amountMatch && timeMatch;
  }

  private checkDiscrepancies(internal: PaymentDetails, gateway: GatewayTransaction): ReconciliationDiscrepancy[] {
    const discrepancies: ReconciliationDiscrepancy[] = [];

    // Amount mismatch
    if (internal.amount !== gateway.amount) {
      discrepancies.push({
        id: `DISC_AMT_${Date.now()}`,
        type: 'amount_mismatch',
        internalTransactionId: internal.id,
        gatewayTransactionId: gateway.id,
        description: `Amount mismatch: Internal ${internal.amount} vs Gateway ${gateway.amount}`,
        internalData: { amount: internal.amount },
        gatewayData: { amount: gateway.amount },
        severity: Math.abs(internal.amount - gateway.amount) > 1000 ? 'high' : 'medium',
        resolved: false,
      });
    }

    // Status mismatch
    const gatewayStatus = this.mapGatewayStatus(gateway.status);
    if (internal.status !== gatewayStatus) {
      discrepancies.push({
        id: `DISC_STATUS_${Date.now()}`,
        type: 'status_mismatch',
        internalTransactionId: internal.id,
        gatewayTransactionId: gateway.id,
        description: `Status mismatch: Internal ${internal.status} vs Gateway ${gateway.status}`,
        internalData: { status: internal.status },
        gatewayData: { status: gateway.status },
        severity: 'medium',
        resolved: false,
      });
    }

    // Fee mismatch
    if (Math.abs(internal.fees.gateway - gateway.fees) > 10) { // Allow 10 unit difference
      discrepancies.push({
        id: `DISC_FEE_${Date.now()}`,
        type: 'fee_mismatch',
        internalTransactionId: internal.id,
        gatewayTransactionId: gateway.id,
        description: `Fee mismatch: Internal ${internal.fees.gateway} vs Gateway ${gateway.fees}`,
        internalData: { fees: internal.fees },
        gatewayData: { fees: gateway.fees },
        severity: 'low',
        resolved: false,
      });
    }

    return discrepancies;
  }

  private mapGatewayStatus(gatewayStatus: string): PaymentStatus {
    // Map gateway-specific status to internal status
    const statusMap: Record<string, PaymentStatus> = {
      'completed': PaymentStatus.COMPLETED,
      'success': PaymentStatus.COMPLETED,
      'succeeded': PaymentStatus.COMPLETED,
      'failed': PaymentStatus.FAILED,
      'error': PaymentStatus.FAILED,
      'pending': PaymentStatus.PENDING,
      'processing': PaymentStatus.PROCESSING,
      'cancelled': PaymentStatus.CANCELLED,
      'canceled': PaymentStatus.CANCELLED,
    };

    return statusMap[gatewayStatus.toLowerCase()] || PaymentStatus.FAILED;
  }

  private async autoResolveDiscrepancies(report: ReconciliationReport): Promise<void> {
    for (const discrepancy of report.discrepancies) {
      if (discrepancy.severity === 'low' && this.canAutoResolve(discrepancy)) {
        await this.resolveDiscrepancy(discrepancy.id, 'system', 'Auto-resolved minor discrepancy');
      }
    }
  }

  private canAutoResolve(discrepancy: ReconciliationDiscrepancy): boolean {
    switch (discrepancy.type) {
      case 'fee_mismatch':
        // Auto-resolve small fee differences
        const feeDiff = Math.abs(
          discrepancy.internalData.fees?.gateway - discrepancy.gatewayData.fees
        );
        return feeDiff <= 50;
      
      case 'amount_mismatch':
        // Auto-resolve very small amount differences (rounding errors)
        const amountDiff = Math.abs(
          discrepancy.internalData.amount - discrepancy.gatewayData.amount
        );
        return amountDiff <= 10;
      
      default:
        return false;
    }
  }

  private async alertCriticalDiscrepancies(report: ReconciliationReport): Promise<void> {
    const criticalDiscrepancies = report.discrepancies.filter(d => d.severity === 'critical');
    
    if (criticalDiscrepancies.length > 0) {
      // Send alert to finance team
      console.log(`CRITICAL: ${criticalDiscrepancies.length} critical discrepancies found in reconciliation ${report.id}`);
      
      // In real implementation, this would send notifications
      // await this.notificationService.sendAlert({
      //   type: 'critical_reconciliation_discrepancy',
      //   data: { reportId: report.id, count: criticalDiscrepancies.length }
      // });
    }
  }

  async resolveDiscrepancy(discrepancyId: string, resolvedBy: string, notes?: string): Promise<void> {
    for (const report of this.reconciliationHistory) {
      const discrepancy = report.discrepancies.find(d => d.id === discrepancyId);
      if (discrepancy) {
        discrepancy.resolved = true;
        discrepancy.resolvedAt = new Date();
        discrepancy.resolvedBy = resolvedBy;
        break;
      }
    }
  }

  async getReconciliationReports(
    startDate?: Date,
    endDate?: Date,
    gateway?: PaymentGateway
  ): Promise<ReconciliationReport[]> {
    let reports = this.reconciliationHistory;

    if (startDate) {
      reports = reports.filter(r => r.date >= startDate);
    }

    if (endDate) {
      reports = reports.filter(r => r.date <= endDate);
    }

    if (gateway) {
      reports = reports.filter(r => r.gateway === gateway);
    }

    return reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  async getDiscrepancySummary(): Promise<{
    total: number;
    resolved: number;
    pending: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const allDiscrepancies = this.reconciliationHistory.flatMap(r => r.discrepancies);
    
    const total = allDiscrepancies.length;
    const resolved = allDiscrepancies.filter(d => d.resolved).length;
    const pending = total - resolved;

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    allDiscrepancies.forEach(d => {
      bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
      byType[d.type] = (byType[d.type] || 0) + 1;
    });

    return { total, resolved, pending, bySeverity, byType };
  }

  private initializeGatewayData(): void {
    // Mock gateway transaction data
    const mockGatewayTransactions: GatewayTransaction[] = [
      {
        id: 'GTW-001',
        gateway: PaymentGateway.VNPAY,
        amount: 100000,
        currency: Currency.VND,
        status: 'completed',
        fees: 1000,
        timestamp: new Date(),
        metadata: {},
      },
      {
        id: 'GTW-002',
        gateway: PaymentGateway.STRIPE,
        amount: 50.00,
        currency: Currency.USD,
        status: 'succeeded',
        fees: 1.75,
        timestamp: new Date(),
        metadata: {},
      },
    ];

    // Group by gateway
    mockGatewayTransactions.forEach(txn => {
      const existing = this.gatewayTransactions.get(txn.gateway) || [];
      existing.push(txn);
      this.gatewayTransactions.set(txn.gateway, existing);
    });
  }

  // Automated reconciliation scheduling
  async scheduleReconciliation(): Promise<void> {
    // This would typically be called by a cron job
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    try {
      const reports = await this.reconcileForDate(yesterday);
      console.log(`Automated reconciliation completed for ${yesterday.toDateString()}: ${reports.length} gateway reports generated`);
    } catch (error) {
      console.error('Automated reconciliation failed:', error);
    }
  }
}
