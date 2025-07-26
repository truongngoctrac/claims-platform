import Fuse from 'fuse.js';

export interface SearchParams {
  query?: string;
  filters: Record<string, any>;
  pagination: {
    page: number;
    limit: number;
  };
  sorting: {
    field: string;
    order: 'asc' | 'desc';
  };
  userId: string;
  userRole: string;
}

export interface SearchResult {
  claims: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  facets: Record<string, Array<{ value: string; count: number }>>;
  totalResults: number;
}

export interface AdvancedSearchParams {
  query?: string;
  filters: {
    status?: string[];
    claimType?: string[];
    amountRange?: { min: number; max: number };
    dateRange?: { from: Date; to: Date };
    hospital?: string[];
    assignedTo?: string[];
    priority?: string[];
    tags?: string[];
  };
  facets?: string[];
  aggregations?: string[];
  suggestions?: boolean;
}

export class ClaimsSearchService {
  private fuseOptions = {
    keys: [
      { name: 'claimNumber', weight: 1.0 },
      { name: 'patientName', weight: 0.8 },
      { name: 'hospitalName', weight: 0.6 },
      { name: 'diagnosis', weight: 0.5 },
      { name: 'notes', weight: 0.3 }
    ],
    threshold: 0.4,
    includeScore: true,
    includeMatches: true
  };

  // Mock database - in real implementation would use MongoDB/PostgreSQL
  private mockClaims = [
    {
      id: 'HC001234',
      claimNumber: 'HC001234',
      patientName: 'Nguyễn Văn An',
      patientId: 'P001',
      hospitalName: 'Bệnh viện Bạch Mai',
      status: 'processing',
      claimType: 'inpatient',
      amount: 15000000,
      submittedAt: new Date('2024-01-15'),
      assignedTo: 'exec1',
      priority: 'high',
      diagnosis: 'Viêm phổi',
      tags: ['respiratory', 'emergency'],
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-16')
    },
    {
      id: 'HC001235',
      claimNumber: 'HC001235',
      patientName: 'Trần Thị Bình',
      patientId: 'P002',
      hospitalName: 'Bệnh viện Chợ Rẫy',
      status: 'approved',
      claimType: 'emergency',
      amount: 8500000,
      submittedAt: new Date('2024-01-14'),
      assignedTo: 'exec2',
      priority: 'urgent',
      diagnosis: 'Đau tim cấp',
      tags: ['cardiology', 'emergency'],
      createdAt: new Date('2024-01-14'),
      updatedAt: new Date('2024-01-15')
    },
    {
      id: 'HC001236',
      claimNumber: 'HC001236',
      patientName: 'Phạm Minh Đức',
      patientId: 'P003',
      hospitalName: 'Bệnh viện 108',
      status: 'pending',
      claimType: 'surgery',
      amount: 25000000,
      submittedAt: new Date('2024-01-13'),
      assignedTo: 'exec1',
      priority: 'medium',
      diagnosis: 'Phẫu thuật tim',
      tags: ['cardiology', 'surgery'],
      createdAt: new Date('2024-01-13'),
      updatedAt: new Date('2024-01-13')
    }
  ];

  // 2.2.8 Claim search và filtering APIs
  async searchClaims(params: SearchParams): Promise<SearchResult> {
    let filteredClaims = [...this.mockClaims];

    // Apply role-based filtering
    filteredClaims = this.applyRoleBasedFilter(filteredClaims, params.userRole, params.userId);

    // Apply text search
    if (params.query) {
      const fuse = new Fuse(filteredClaims, this.fuseOptions);
      const fuseResults = fuse.search(params.query);
      filteredClaims = fuseResults.map(result => ({
        ...result.item,
        _score: result.score,
        _matches: result.matches
      }));
    }

    // Apply filters
    filteredClaims = this.applyFilters(filteredClaims, params.filters);

    // Apply sorting
    filteredClaims = this.applySorting(filteredClaims, params.sorting);

    // Calculate facets
    const facets = this.calculateFacets(filteredClaims);

    // Apply pagination
    const totalResults = filteredClaims.length;
    const startIndex = (params.pagination.page - 1) * params.pagination.limit;
    const endIndex = startIndex + params.pagination.limit;
    const paginatedClaims = filteredClaims.slice(startIndex, endIndex);

    return {
      claims: paginatedClaims,
      pagination: {
        page: params.pagination.page,
        limit: params.pagination.limit,
        total: totalResults,
        totalPages: Math.ceil(totalResults / params.pagination.limit)
      },
      facets,
      totalResults
    };
  }

  async advancedSearch(params: AdvancedSearchParams): Promise<any> {
    let filteredClaims = [...this.mockClaims];

    // Apply advanced filters
    if (params.filters.status) {
      filteredClaims = filteredClaims.filter(claim => 
        params.filters.status!.includes(claim.status)
      );
    }

    if (params.filters.claimType) {
      filteredClaims = filteredClaims.filter(claim => 
        params.filters.claimType!.includes(claim.claimType)
      );
    }

    if (params.filters.amountRange) {
      const { min, max } = params.filters.amountRange;
      filteredClaims = filteredClaims.filter(claim => 
        claim.amount >= min && claim.amount <= max
      );
    }

    if (params.filters.dateRange) {
      const { from, to } = params.filters.dateRange;
      filteredClaims = filteredClaims.filter(claim => 
        claim.submittedAt >= from && claim.submittedAt <= to
      );
    }

    if (params.filters.hospital) {
      filteredClaims = filteredClaims.filter(claim => 
        params.filters.hospital!.includes(claim.hospitalName)
      );
    }

    if (params.filters.priority) {
      filteredClaims = filteredClaims.filter(claim => 
        params.filters.priority!.includes(claim.priority)
      );
    }

    if (params.filters.tags) {
      filteredClaims = filteredClaims.filter(claim => 
        claim.tags.some((tag: string) => params.filters.tags!.includes(tag))
      );
    }

    // Calculate facets if requested
    const facets = params.facets ? this.calculateAdvancedFacets(filteredClaims, params.facets) : {};

    // Calculate aggregations if requested
    const aggregations = params.aggregations ? this.calculateAggregations(filteredClaims, params.aggregations) : {};

    // Generate suggestions if requested
    const suggestions = params.suggestions ? this.generateSearchSuggestions(params.query || '') : [];

    return {
      claims: filteredClaims,
      facets,
      aggregations,
      suggestions
    };
  }

  async getClaimById(claimId: string, userId: string, userRole: string): Promise<any | null> {
    const claim = this.mockClaims.find(c => c.id === claimId);
    if (!claim) return null;

    // Apply role-based access control
    if (!this.canAccessClaim(claim, userId, userRole)) {
      return null;
    }

    return claim;
  }

  async exportClaims(params: { format: string; filters: any; userId: string }): Promise<string> {
    let claims = [...this.mockClaims];
    claims = this.applyFilters(claims, params.filters);

    if (params.format === 'csv') {
      return this.convertToCSV(claims);
    } else if (params.format === 'excel') {
      // In real implementation would use xlsx library
      return JSON.stringify(claims);
    }

    return JSON.stringify(claims, null, 2);
  }

  private applyRoleBasedFilter(claims: any[], userRole: string, userId: string): any[] {
    switch (userRole) {
      case 'admin':
      case 'claims_manager':
        return claims; // Can see all claims
      case 'claim_executive':
        return claims.filter(claim => claim.assignedTo === userId); // Only assigned claims
      case 'hospital_staff':
        return claims.filter(claim => claim.hospitalId === userId); // Only hospital's claims
      case 'customer':
        return claims.filter(claim => claim.patientId === userId); // Only own claims
      default:
        return [];
    }
  }

  private applyFilters(claims: any[], filters: Record<string, any>): any[] {
    return claims.filter(claim => {
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue;

        switch (key) {
          case 'status':
            if (Array.isArray(value)) {
              if (!value.includes(claim.status)) return false;
            } else if (claim.status !== value) return false;
            break;
          case 'claimType':
            if (Array.isArray(value)) {
              if (!value.includes(claim.claimType)) return false;
            } else if (claim.claimType !== value) return false;
            break;
          case 'amountMin':
            if (claim.amount < value) return false;
            break;
          case 'amountMax':
            if (claim.amount > value) return false;
            break;
          case 'dateFrom':
            if (claim.submittedAt < new Date(value)) return false;
            break;
          case 'dateTo':
            if (claim.submittedAt > new Date(value)) return false;
            break;
          case 'hospital':
            if (claim.hospitalName.toLowerCase().indexOf(value.toLowerCase()) === -1) return false;
            break;
          case 'assignedTo':
            if (claim.assignedTo !== value) return false;
            break;
          case 'priority':
            if (Array.isArray(value)) {
              if (!value.includes(claim.priority)) return false;
            } else if (claim.priority !== value) return false;
            break;
        }
      }
      return true;
    });
  }

  private applySorting(claims: any[], sorting: { field: string; order: 'asc' | 'desc' }): any[] {
    return claims.sort((a, b) => {
      let aValue = a[sorting.field];
      let bValue = b[sorting.field];

      // Handle date fields
      if (aValue instanceof Date) aValue = aValue.getTime();
      if (bValue instanceof Date) bValue = bValue.getTime();

      // Handle string fields
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (sorting.order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }

  private calculateFacets(claims: any[]): Record<string, Array<{ value: string; count: number }>> {
    const facets: Record<string, Record<string, number>> = {};

    claims.forEach(claim => {
      // Status facet
      if (!facets.status) facets.status = {};
      facets.status[claim.status] = (facets.status[claim.status] || 0) + 1;

      // Claim type facet
      if (!facets.claimType) facets.claimType = {};
      facets.claimType[claim.claimType] = (facets.claimType[claim.claimType] || 0) + 1;

      // Hospital facet
      if (!facets.hospital) facets.hospital = {};
      facets.hospital[claim.hospitalName] = (facets.hospital[claim.hospitalName] || 0) + 1;

      // Priority facet
      if (!facets.priority) facets.priority = {};
      facets.priority[claim.priority] = (facets.priority[claim.priority] || 0) + 1;

      // Amount range facet
      if (!facets.amountRange) facets.amountRange = {};
      const amountRange = this.getAmountRange(claim.amount);
      facets.amountRange[amountRange] = (facets.amountRange[amountRange] || 0) + 1;
    });

    // Convert to required format
    const result: Record<string, Array<{ value: string; count: number }>> = {};
    for (const [facetName, facetData] of Object.entries(facets)) {
      result[facetName] = Object.entries(facetData)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    }

    return result;
  }

  private calculateAdvancedFacets(claims: any[], requestedFacets: string[]): Record<string, any> {
    const result: Record<string, any> = {};

    requestedFacets.forEach(facetName => {
      switch (facetName) {
        case 'status':
          result.status = this.getStatusDistribution(claims);
          break;
        case 'hospital':
          result.hospital = this.getHospitalDistribution(claims);
          break;
        case 'amount':
          result.amount = this.getAmountDistribution(claims);
          break;
        case 'timeRange':
          result.timeRange = this.getTimeRangeDistribution(claims);
          break;
      }
    });

    return result;
  }

  private calculateAggregations(claims: any[], requestedAggregations: string[]): Record<string, any> {
    const result: Record<string, any> = {};

    requestedAggregations.forEach(aggName => {
      switch (aggName) {
        case 'totalAmount':
          result.totalAmount = claims.reduce((sum, claim) => sum + claim.amount, 0);
          break;
        case 'averageAmount':
          result.averageAmount = claims.length > 0 ? 
            claims.reduce((sum, claim) => sum + claim.amount, 0) / claims.length : 0;
          break;
        case 'countByStatus':
          result.countByStatus = this.getStatusCounts(claims);
          break;
        case 'avgProcessingTime':
          result.avgProcessingTime = this.calculateAverageProcessingTime(claims);
          break;
      }
    });

    return result;
  }

  private generateSearchSuggestions(query: string): string[] {
    const suggestions = [
      'Bệnh viện Bạch Mai',
      'Bệnh viện Chợ Rẫy',
      'Viêm phổi',
      'Phẫu thuật tim',
      'Cấp cứu',
      'Nội trú',
      'Ngoại trú'
    ];

    if (!query) return suggestions.slice(0, 5);

    return suggestions
      .filter(suggestion => 
        suggestion.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 5);
  }

  private canAccessClaim(claim: any, userId: string, userRole: string): boolean {
    switch (userRole) {
      case 'admin':
      case 'claims_manager':
        return true;
      case 'claim_executive':
        return claim.assignedTo === userId;
      case 'hospital_staff':
        return claim.hospitalId === userId;
      case 'customer':
        return claim.patientId === userId;
      default:
        return false;
    }
  }

  private convertToCSV(claims: any[]): string {
    if (claims.length === 0) return '';

    const headers = Object.keys(claims[0]).join(',');
    const rows = claims.map(claim => 
      Object.values(claim).map(value => 
        typeof value === 'string' ? `"${value}"` : value
      ).join(',')
    );

    return [headers, ...rows].join('\n');
  }

  private getAmountRange(amount: number): string {
    if (amount < 1000000) return 'Dưới 1M';
    if (amount < 5000000) return '1M - 5M';
    if (amount < 10000000) return '5M - 10M';
    if (amount < 20000000) return '10M - 20M';
    return 'Trên 20M';
  }

  private getStatusDistribution(claims: any[]): any {
    const distribution: Record<string, number> = {};
    claims.forEach(claim => {
      distribution[claim.status] = (distribution[claim.status] || 0) + 1;
    });
    return distribution;
  }

  private getHospitalDistribution(claims: any[]): any {
    const distribution: Record<string, number> = {};
    claims.forEach(claim => {
      distribution[claim.hospitalName] = (distribution[claim.hospitalName] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private getAmountDistribution(claims: any[]): any {
    const ranges = {
      'Dưới 1M': 0,
      '1M - 5M': 0,
      '5M - 10M': 0,
      '10M - 20M': 0,
      'Trên 20M': 0
    };

    claims.forEach(claim => {
      const range = this.getAmountRange(claim.amount);
      ranges[range as keyof typeof ranges]++;
    });

    return ranges;
  }

  private getTimeRangeDistribution(claims: any[]): any {
    const now = new Date();
    const ranges = {
      'Hôm nay': 0,
      'Tuần này': 0,
      'Tháng này': 0,
      'Quý này': 0,
      'Năm nay': 0
    };

    claims.forEach(claim => {
      const daysDiff = Math.floor((now.getTime() - claim.submittedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) ranges['Hôm nay']++;
      else if (daysDiff <= 7) ranges['Tuần này']++;
      else if (daysDiff <= 30) ranges['Tháng này']++;
      else if (daysDiff <= 90) ranges['Quý này']++;
      else if (daysDiff <= 365) ranges['Năm nay']++;
    });

    return ranges;
  }

  private getStatusCounts(claims: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    claims.forEach(claim => {
      counts[claim.status] = (counts[claim.status] || 0) + 1;
    });
    return counts;
  }

  private calculateAverageProcessingTime(claims: any[]): number {
    // Mock calculation - in real implementation would calculate based on actual timestamps
    return 2.5; // days
  }
}
