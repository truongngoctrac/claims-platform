import {
  PaymentAnalytics,
  PaymentDetails,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  Currency,
  PaymentReport,
} from '../../../shared/payment';

export class PaymentAnalyticsService {
  private paymentHistory: PaymentDetails[] = [];

  async trackPayment(payment: PaymentDetails): Promise<void> {
    this.paymentHistory.push(payment);
  }

  async generateAnalytics(startDate: Date, endDate: Date): Promise<PaymentAnalytics> {
    const filteredPayments = this.paymentHistory.filter(
      payment => payment.createdAt >= startDate && payment.createdAt <= endDate
    );

    const summary = this.calculateSummary(filteredPayments);
    const byGateway = this.analyzeByGateway(filteredPayments);
    const byMethod = this.analyzeByMethod(filteredPayments);
    const byCurrency = this.analyzeByCurrency(filteredPayments);
    const trends = this.calculateTrends(filteredPayments, startDate, endDate);
    const topFailureReasons = this.getTopFailureReasons(filteredPayments);

    return {
      period: { start: startDate, end: endDate },
      summary,
      byGateway,
      byMethod,
      byCurrency,
      trends,
      topFailureReasons,
    };
  }

  async generateReport(
    type: 'daily' | 'weekly' | 'monthly' | 'custom',
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<PaymentReport> {
    const analytics = await this.generateAnalytics(startDate, endDate);

    const report: PaymentReport = {
      id: `REPORT_${Date.now()}`,
      type,
      period: { start: startDate, end: endDate },
      data: analytics,
      generatedAt: new Date(),
      generatedBy: 'system',
      format,
    };

    if (format !== 'json') {
      report.downloadUrl = await this.generateReportFile(report);
    }

    return report;
  }

  private calculateSummary(payments: PaymentDetails[]) {
    const totalPayments = payments.length;
    const completedPayments = payments.filter(p => p.status === PaymentStatus.COMPLETED);
    const failedPayments = payments.filter(p => p.status === PaymentStatus.FAILED);
    const refundedPayments = payments.filter(p => p.status === PaymentStatus.REFUNDED);

    const totalAmount = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalFees = completedPayments.reduce((sum, p) => sum + p.fees.total, 0);
    const totalRefunds = refundedPayments.reduce((sum, p) => sum + p.amount, 0);

    const successRate = totalPayments > 0 ? (completedPayments.length / totalPayments) * 100 : 0;
    const averageAmount = completedPayments.length > 0 ? totalAmount / completedPayments.length : 0;

    // Calculate average processing time
    const processingTimes = completedPayments
      .filter(p => p.completedAt)
      .map(p => p.completedAt!.getTime() - p.createdAt.getTime());
    
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;

    return {
      totalPayments,
      totalAmount,
      totalFees,
      totalRefunds,
      totalChargebacks: 0, // Would be calculated from chargeback data
      successRate,
      averageAmount,
      averageProcessingTime: averageProcessingTime / 1000, // Convert to seconds
    };
  }

  private analyzeByGateway(payments: PaymentDetails[]) {
    const gatewayStats: Record<PaymentGateway, {
      count: number;
      amount: number;
      fees: number;
      successRate: number;
    }> = {} as any;

    // Initialize all gateways
    Object.values(PaymentGateway).forEach(gateway => {
      gatewayStats[gateway] = { count: 0, amount: 0, fees: 0, successRate: 0 };
    });

    payments.forEach(payment => {
      const stats = gatewayStats[payment.gateway];
      stats.count++;
      
      if (payment.status === PaymentStatus.COMPLETED) {
        stats.amount += payment.amount;
        stats.fees += payment.fees.total;
      }
    });

    // Calculate success rates
    Object.values(PaymentGateway).forEach(gateway => {
      const gatewayPayments = payments.filter(p => p.gateway === gateway);
      const successfulPayments = gatewayPayments.filter(p => p.status === PaymentStatus.COMPLETED);
      
      gatewayStats[gateway].successRate = gatewayPayments.length > 0 
        ? (successfulPayments.length / gatewayPayments.length) * 100 
        : 0;
    });

    return gatewayStats;
  }

  private analyzeByMethod(payments: PaymentDetails[]) {
    const methodStats: Record<PaymentMethod, {
      count: number;
      amount: number;
      successRate: number;
    }> = {} as any;

    // Initialize all methods
    Object.values(PaymentMethod).forEach(method => {
      methodStats[method] = { count: 0, amount: 0, successRate: 0 };
    });

    payments.forEach(payment => {
      const stats = methodStats[payment.method];
      stats.count++;
      
      if (payment.status === PaymentStatus.COMPLETED) {
        stats.amount += payment.amount;
      }
    });

    // Calculate success rates
    Object.values(PaymentMethod).forEach(method => {
      const methodPayments = payments.filter(p => p.method === method);
      const successfulPayments = methodPayments.filter(p => p.status === PaymentStatus.COMPLETED);
      
      methodStats[method].successRate = methodPayments.length > 0 
        ? (successfulPayments.length / methodPayments.length) * 100 
        : 0;
    });

    return methodStats;
  }

  private analyzeByCurrency(payments: PaymentDetails[]) {
    const currencyStats: Record<Currency, {
      count: number;
      amount: number;
    }> = {} as any;

    // Initialize all currencies
    Object.values(Currency).forEach(currency => {
      currencyStats[currency] = { count: 0, amount: 0 };
    });

    payments.forEach(payment => {
      const stats = currencyStats[payment.currency];
      stats.count++;
      
      if (payment.status === PaymentStatus.COMPLETED) {
        stats.amount += payment.amount;
      }
    });

    return currencyStats;
  }

  private calculateTrends(payments: PaymentDetails[], startDate: Date, endDate: Date) {
    const daily = this.calculateDailyTrends(payments, startDate, endDate);
    const hourly = this.calculateHourlyTrends(payments);

    return { daily, hourly };
  }

  private calculateDailyTrends(payments: PaymentDetails[], startDate: Date, endDate: Date) {
    const dailyData: Array<{
      date: string;
      payments: number;
      amount: number;
      successRate: number;
    }> = [];

    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayPayments = payments.filter(p => 
        p.createdAt.toISOString().split('T')[0] === dateStr
      );
      
      const successfulPayments = dayPayments.filter(p => p.status === PaymentStatus.COMPLETED);
      const totalAmount = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
      const successRate = dayPayments.length > 0 
        ? (successfulPayments.length / dayPayments.length) * 100 
        : 0;

      dailyData.push({
        date: dateStr,
        payments: dayPayments.length,
        amount: totalAmount,
        successRate,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyData;
  }

  private calculateHourlyTrends(payments: PaymentDetails[]) {
    const hourlyData: Array<{
      hour: number;
      payments: number;
      amount: number;
    }> = [];

    for (let hour = 0; hour < 24; hour++) {
      const hourPayments = payments.filter(p => p.createdAt.getHours() === hour);
      const successfulPayments = hourPayments.filter(p => p.status === PaymentStatus.COMPLETED);
      const totalAmount = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

      hourlyData.push({
        hour,
        payments: hourPayments.length,
        amount: totalAmount,
      });
    }

    return hourlyData;
  }

  private getTopFailureReasons(payments: PaymentDetails[]) {
    const failedPayments = payments.filter(p => p.status === PaymentStatus.FAILED);
    const reasonCounts: Record<string, number> = {};

    failedPayments.forEach(payment => {
      // Extract failure reason from timeline or metadata
      const failureEvent = payment.timeline.find(event => event.type === 'payment_failed');
      const reason = failureEvent?.message || 'Unknown error';
      
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    const totalFailures = Object.values(reasonCounts).reduce((sum, count) => sum + count, 0);

    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: totalFailures > 0 ? (count / totalFailures) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 failure reasons
  }

  private async generateReportFile(report: PaymentReport): Promise<string> {
    // Mock file generation - in real implementation, this would generate actual files
    const fileName = `payment-report-${report.id}.${report.format}`;
    const mockUrl = `https://reports.example.com/${fileName}`;

    switch (report.format) {
      case 'csv':
        await this.generateCSVReport(report);
        break;
      case 'pdf':
        await this.generatePDFReport(report);
        break;
    }

    return mockUrl;
  }

  private async generateCSVReport(report: PaymentReport): Promise<void> {
    // Mock CSV generation
    console.log(`Generating CSV report for ${report.id}`);
  }

  private async generatePDFReport(report: PaymentReport): Promise<void> {
    // Mock PDF generation
    console.log(`Generating PDF report for ${report.id}`);
  }

  // Real-time analytics methods
  async getRealtimeMetrics(): Promise<{
    paymentsToday: number;
    revenueToday: number;
    successRateToday: number;
    activePayments: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayPayments = this.paymentHistory.filter(p => p.createdAt >= today);
    const successfulToday = todayPayments.filter(p => p.status === PaymentStatus.COMPLETED);
    const revenueToday = successfulToday.reduce((sum, p) => sum + p.amount, 0);
    const successRateToday = todayPayments.length > 0 
      ? (successfulToday.length / todayPayments.length) * 100 
      : 0;
    
    const activePayments = this.paymentHistory.filter(p => 
      p.status === PaymentStatus.PENDING || p.status === PaymentStatus.PROCESSING
    ).length;

    return {
      paymentsToday: todayPayments.length,
      revenueToday,
      successRateToday,
      activePayments,
    };
  }

  async getTopCustomers(limit = 10): Promise<Array<{
    customerId: string;
    totalPayments: number;
    totalAmount: number;
    averageAmount: number;
  }>> {
    const customerStats: Record<string, {
      totalPayments: number;
      totalAmount: number;
    }> = {};

    this.paymentHistory
      .filter(p => p.status === PaymentStatus.COMPLETED)
      .forEach(payment => {
        const stats = customerStats[payment.customerId] || { totalPayments: 0, totalAmount: 0 };
        stats.totalPayments++;
        stats.totalAmount += payment.amount;
        customerStats[payment.customerId] = stats;
      });

    return Object.entries(customerStats)
      .map(([customerId, stats]) => ({
        customerId,
        totalPayments: stats.totalPayments,
        totalAmount: stats.totalAmount,
        averageAmount: stats.totalAmount / stats.totalPayments,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit);
  }
}
