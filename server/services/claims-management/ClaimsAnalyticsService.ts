export interface AnalyticsParams {
  timeRange: string;
  filters?: Record<string, any>;
  userId: string;
}

export interface DashboardAnalytics {
  kpis: {
    totalClaims: number;
    totalAmount: number;
    averageProcessingTime: number;
    approvalRate: number;
    pendingClaims: number;
    monthlyGrowth: number;
  };
  trends: {
    claimsOverTime: Array<{
      date: string;
      submitted: number;
      approved: number;
      rejected: number;
      amount: number;
    }>;
    statusDistribution: Array<{
      name: string;
      value: number;
      color: string;
    }>;
    topHospitals: Array<{
      name: string;
      claims: number;
      amount: number;
      approvalRate: number;
    }>;
  };
  performance: {
    executivePerformance: Array<{
      name: string;
      claims: number;
      avgTime: number;
      approvalRate: number;
    }>;
    processingTimes: Array<{
      stage: string;
      avgTime: number;
      target: number;
    }>;
  };
}

export class ClaimsAnalyticsService {
  // 2.2.9 Claim analytics endpoints
  async getDashboardAnalytics(params: AnalyticsParams): Promise<DashboardAnalytics> {
    const timeRange = this.parseTimeRange(params.timeRange);
    
    return {
      kpis: await this.calculateKPIs(timeRange, params.filters),
      trends: await this.calculateTrends(timeRange, params.filters),
      performance: await this.calculatePerformance(timeRange, params.filters)
    };
  }

  async getPerformanceMetrics(params: AnalyticsParams): Promise<any> {
    const timeRange = this.parseTimeRange(params.timeRange);
    
    return {
      claimVolume: await this.calculateClaimVolume(timeRange),
      processingEfficiency: await this.calculateProcessingEfficiency(timeRange),
      qualityMetrics: await this.calculateQualityMetrics(timeRange),
      financialMetrics: await this.calculateFinancialMetrics(timeRange),
      resourceUtilization: await this.calculateResourceUtilization(timeRange)
    };
  }

  async getTrendAnalysis(params: { timeRange: string; granularity: string }): Promise<any> {
    const timeRange = this.parseTimeRange(params.timeRange);
    const granularity = params.granularity || 'daily';
    
    return {
      claimTrends: await this.calculateClaimTrends(timeRange, granularity),
      financialTrends: await this.calculateFinancialTrends(timeRange, granularity),
      performanceTrends: await this.calculatePerformanceTrends(timeRange, granularity),
      seasonalPatterns: await this.calculateSeasonalPatterns(timeRange),
      forecasting: await this.generateForecasts(timeRange, granularity)
    };
  }

  // 2.2.10 Performance optimization
  async getOptimizedAnalytics(params: AnalyticsParams): Promise<any> {
    // Use caching for frequently requested analytics
    const cacheKey = `analytics:${JSON.stringify(params)}`;
    
    // In real implementation, would use Redis cache
    // const cached = await redis.get(cacheKey);
    // if (cached) return JSON.parse(cached);

    const analytics = await this.getDashboardAnalytics(params);
    
    // Cache for 5 minutes
    // await redis.setex(cacheKey, 300, JSON.stringify(analytics));
    
    return analytics;
  }

  private async calculateKPIs(timeRange: { start: Date; end: Date }, filters?: any): Promise<any> {
    // Mock KPI calculations - in real implementation would query database
    return {
      totalClaims: 1260,
      totalAmount: 27500000000,
      averageProcessingTime: 2.6,
      approvalRate: 89.2,
      pendingClaims: 123,
      monthlyGrowth: 12.5
    };
  }

  private async calculateTrends(timeRange: { start: Date; end: Date }, filters?: any): Promise<any> {
    return {
      claimsOverTime: [
        { date: '2024-01-01', submitted: 120, approved: 85, rejected: 15, amount: 2500000000 },
        { date: '2024-01-02', submitted: 145, approved: 98, rejected: 18, amount: 2800000000 },
        { date: '2024-01-03', submitted: 132, approved: 92, rejected: 12, amount: 2600000000 },
        { date: '2024-01-04', submitted: 158, approved: 108, rejected: 22, amount: 3200000000 },
        { date: '2024-01-05', submitted: 167, approved: 115, rejected: 20, amount: 3500000000 }
      ],
      statusDistribution: [
        { name: 'Đã duyệt', value: 582, color: '#22c55e' },
        { name: 'Chờ xử lý', value: 123, color: '#eab308' },
        { name: 'Đang xử lý', value: 89, color: '#3b82f6' },
        { name: 'Từ chối', value: 45, color: '#ef4444' },
        { name: 'Đã thanh toán', value: 421, color: '#10b981' }
      ],
      topHospitals: [
        { name: 'Bệnh viện Bạch Mai', claims: 245, amount: 6200000000, approvalRate: 92 },
        { name: 'Bệnh viện Chợ Rẫy', claims: 189, amount: 4800000000, approvalRate: 88 },
        { name: 'Bệnh viện 108', claims: 156, amount: 3900000000, approvalRate: 85 },
        { name: 'Bệnh viện K', claims: 134, amount: 3400000000, approvalRate: 90 },
        { name: 'Bệnh viện Việt Đức', claims: 167, amount: 4200000000, approvalRate: 94 }
      ]
    };
  }

  private async calculatePerformance(timeRange: { start: Date; end: Date }, filters?: any): Promise<any> {
    return {
      executivePerformance: [
        { name: 'Nguyễn Thị Lan', claims: 89, avgTime: 2.1, approvalRate: 94 },
        { name: 'Lê Văn Cường', claims: 76, avgTime: 2.8, approvalRate: 87 },
        { name: 'Trần Minh Hải', claims: 92, avgTime: 2.3, approvalRate: 91 },
        { name: 'Phạm Thu Hà', claims: 68, avgTime: 3.1, approvalRate: 85 }
      ],
      processingTimes: [
        { stage: 'Tiếp nhận', avgTime: 0.2, target: 0.5 },
        { stage: 'Xác minh', avgTime: 1.8, target: 2.0 },
        { stage: 'Thẩm định', avgTime: 2.1, target: 3.0 },
        { stage: 'Phê duyệt', avgTime: 0.8, target: 1.0 },
        { stage: 'Thanh toán', avgTime: 1.2, target: 1.5 }
      ]
    };
  }

  private async calculateClaimVolume(timeRange: { start: Date; end: Date }): Promise<any> {
    return {
      totalSubmitted: 1260,
      totalProcessed: 1137,
      totalPending: 123,
      dailyAverage: 42,
      peakDay: { date: '2024-01-15', count: 89 },
      lowDay: { date: '2024-01-07', count: 23 },
      weekendRatio: 0.15,
      holidayImpact: -0.35
    };
  }

  private async calculateProcessingEfficiency(timeRange: { start: Date; end: Date }): Promise<any> {
    return {
      averageProcessingTime: 2.6,
      medianProcessingTime: 2.1,
      slaCompliance: 94.2,
      bottlenecks: [
        { stage: 'Thẩm định', avgDelay: 0.8, impact: 'medium' },
        { stage: 'Xác minh tài liệu', avgDelay: 0.4, impact: 'low' }
      ],
      efficiency: {
        autoApprovalRate: 23,
        straightThroughProcessing: 67,
        exceptionRate: 8
      }
    };
  }

  private async calculateQualityMetrics(timeRange: { start: Date; end: Date }): Promise<any> {
    return {
      accuracy: 97.8,
      reworkRate: 3.2,
      customerSatisfaction: 4.2,
      auditScore: 95.6,
      errorsByType: [
        { type: 'Thiếu tài liệu', count: 45, percentage: 35 },
        { type: 'Sai thông tin', count: 28, percentage: 22 },
        { type: 'Chậm xử lý', count: 35, percentage: 27 },
        { type: 'Khác', count: 20, percentage: 16 }
      ]
    };
  }

  private async calculateFinancialMetrics(timeRange: { start: Date; end: Date }): Promise<any> {
    return {
      totalClaimValue: 27500000000,
      averageClaimValue: 21825396,
      medianClaimValue: 15000000,
      approvedAmount: 24750000000,
      rejectedAmount: 2750000000,
      pendingAmount: 3250000000,
      payoutRatio: 0.90,
      topClaimsByValue: [
        { claimId: 'HC001256', amount: 125000000, type: 'Phẫu thuật tim' },
        { claimId: 'HC001267', amount: 98000000, type: 'Điều trị ung thư' },
        { claimId: 'HC001278', amount: 87000000, type: 'Phẫu thuật não' }
      ]
    };
  }

  private async calculateResourceUtilization(timeRange: { start: Date; end: Date }): Promise<any> {
    return {
      executiveWorkload: {
        total: 12,
        available: 11,
        utilization: 87.5,
        overloaded: 2
      },
      systemResources: {
        databaseLoad: 65,
        apiResponseTime: 150,
        storageUsage: 72,
        networkLatency: 25
      },
      capacity: {
        current: 1250,
        maximum: 1500,
        utilizationRate: 83.3,
        projectedPeak: 1380
      }
    };
  }

  private async calculateClaimTrends(timeRange: { start: Date; end: Date }, granularity: string): Promise<any> {
    const dataPoints = this.generateTimeSeriesData(timeRange, granularity);
    
    return {
      volume: dataPoints.map(point => ({
        date: point.date,
        claims: Math.floor(Math.random() * 50) + 80
      })),
      approval: dataPoints.map(point => ({
        date: point.date,
        rate: Math.random() * 10 + 85
      })),
      types: {
        inpatient: dataPoints.map(point => ({
          date: point.date,
          count: Math.floor(Math.random() * 20) + 30
        })),
        outpatient: dataPoints.map(point => ({
          date: point.date,
          count: Math.floor(Math.random() * 25) + 35
        })),
        emergency: dataPoints.map(point => ({
          date: point.date,
          count: Math.floor(Math.random() * 10) + 15
        }))
      }
    };
  }

  private async calculateFinancialTrends(timeRange: { start: Date; end: Date }, granularity: string): Promise<any> {
    const dataPoints = this.generateTimeSeriesData(timeRange, granularity);
    
    return {
      totalValue: dataPoints.map(point => ({
        date: point.date,
        amount: Math.floor(Math.random() * 1000000000) + 2000000000
      })),
      averageValue: dataPoints.map(point => ({
        date: point.date,
        amount: Math.floor(Math.random() * 5000000) + 15000000
      })),
      payoutRatio: dataPoints.map(point => ({
        date: point.date,
        ratio: Math.random() * 0.1 + 0.85
      }))
    };
  }

  private async calculatePerformanceTrends(timeRange: { start: Date; end: Date }, granularity: string): Promise<any> {
    const dataPoints = this.generateTimeSeriesData(timeRange, granularity);
    
    return {
      processingTime: dataPoints.map(point => ({
        date: point.date,
        avgTime: Math.random() * 1 + 2
      })),
      slaCompliance: dataPoints.map(point => ({
        date: point.date,
        rate: Math.random() * 5 + 92
      })),
      efficiency: dataPoints.map(point => ({
        date: point.date,
        score: Math.random() * 10 + 85
      }))
    };
  }

  private async calculateSeasonalPatterns(timeRange: { start: Date; end: Date }): Promise<any> {
    return {
      monthlyPattern: [
        { month: 'Tháng 1', claims: 1250, trend: 'increase' },
        { month: 'Tháng 2', claims: 980, trend: 'decrease' },
        { month: 'Tháng 3', claims: 1180, trend: 'increase' },
        { month: 'Tháng 4', claims: 1320, trend: 'increase' },
        { month: 'Tháng 5', claims: 1150, trend: 'decrease' },
        { month: 'Tháng 6', claims: 1280, trend: 'increase' }
      ],
      weeklyPattern: [
        { day: 'Thứ 2', avgClaims: 45 },
        { day: 'Thứ 3', avgClaims: 52 },
        { day: 'Thứ 4', avgClaims: 48 },
        { day: 'Thứ 5', avgClaims: 50 },
        { day: 'Thứ 6', avgClaims: 46 },
        { day: 'Thứ 7', avgClaims: 28 },
        { day: 'Chủ nhật', avgClaims: 23 }
      ],
      hourlyPattern: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        avgClaims: hour >= 8 && hour <= 17 ? Math.random() * 10 + 15 : Math.random() * 3 + 1
      }))
    };
  }

  private async generateForecasts(timeRange: { start: Date; end: Date }, granularity: string): Promise<any> {
    return {
      nextWeek: {
        predictedVolume: 320,
        confidence: 0.85,
        factors: ['seasonal_increase', 'weekend_effect']
      },
      nextMonth: {
        predictedVolume: 1380,
        confidence: 0.78,
        factors: ['holiday_season', 'flu_season']
      },
      scenarios: {
        optimistic: { volume: 1450, probability: 0.25 },
        realistic: { volume: 1380, probability: 0.50 },
        pessimistic: { volume: 1250, probability: 0.25 }
      }
    };
  }

  private parseTimeRange(timeRange: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    switch (timeRange) {
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
      case '90d':
        start.setDate(now.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 30);
    }

    return { start, end };
  }

  private generateTimeSeriesData(timeRange: { start: Date; end: Date }, granularity: string): Array<{ date: string }> {
    const dataPoints = [];
    const current = new Date(timeRange.start);
    
    while (current <= timeRange.end) {
      dataPoints.push({
        date: current.toISOString().split('T')[0]
      });
      
      switch (granularity) {
        case 'hourly':
          current.setHours(current.getHours() + 1);
          break;
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        default:
          current.setDate(current.getDate() + 1);
      }
    }
    
    return dataPoints;
  }
}
