import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, SortAsc, SortDesc, Grid, List, Eye, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AdvancedSearchInterface } from '../components/search/AdvancedSearchInterface';
import { HealthcareClaim } from '../../shared/healthcare';

interface SearchResult {
  id: string;
  type: 'claim' | 'hospital' | 'patient' | 'document';
  title: string;
  description: string;
  metadata: Record<string, any>;
  relevanceScore: number;
  createdAt: Date;
  highlights?: string[];
}

export function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [facets, setFacets] = useState<Record<string, Array<{ value: string; count: number }>>>({});

  const query = searchParams.get('q') || '';
  const filters = Object.fromEntries(searchParams.entries());

  // Mock search function
  const performSearch = async (searchQuery: string, searchFilters: Record<string, any>) => {
    setLoading(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock search results
    const mockResults: SearchResult[] = [
      {
        id: 'HS001234',
        type: 'claim',
        title: 'Hồ sơ bồi thường - Nguyễn Văn An',
        description: 'Hồ sơ điều trị nội trú tại Bệnh viện Bạch Mai, chẩn đoán: Viêm phổi',
        metadata: {
          patientName: 'Nguyễn Văn An',
          hospitalName: 'Bệnh viện Bạch Mai',
          amount: 15000000,
          status: 'pending',
          claimType: 'Nội trú'
        },
        relevanceScore: 0.95,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        highlights: ['Nguyễn Văn An', 'Bệnh viện Bạch Mai', 'Viêm phổi']
      },
      {
        id: 'HS001235',
        type: 'claim',
        title: 'Hồ sơ bồi thường - Trần Thị Bình',
        description: 'Hồ sơ cấp cứu tại Bệnh viện Chợ Rẫy, chẩn đoán: Đau tim cấp',
        metadata: {
          patientName: 'Trần Thị Bình',
          hospitalName: 'Bệnh viện Chợ Rẫy',
          amount: 8500000,
          status: 'processing',
          claimType: 'Cấp cứu'
        },
        relevanceScore: 0.89,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        highlights: ['Trần Thị Bình', 'Bệnh viện Chợ Rẫy']
      },
      {
        id: 'hospital-bachmai',
        type: 'hospital',
        title: 'Bệnh viện Bạch Mai',
        description: 'Bệnh viện hạng đặc biệt, chuyên về khám chữa bệnh đa khoa',
        metadata: {
          address: 'Hà Nội',
          type: 'Bệnh viện công',
          specialties: ['Tim mạch', 'Thần kinh', 'Ung bướu'],
          rating: 4.5
        },
        relevanceScore: 0.82,
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        highlights: ['Bạch Mai', 'đa khoa', 'Hà Nội']
      }
    ];

    // Mock facets
    const mockFacets = {
      status: [
        { value: 'pending', count: 45 },
        { value: 'processing', count: 23 },
        { value: 'approved', count: 67 },
        { value: 'rejected', count: 12 }
      ],
      claimType: [
        { value: 'Nội trú', count: 89 },
        { value: 'Ngoại trú', count: 156 },
        { value: 'Cấp cứu', count: 34 },
        { value: 'Phẫu thuật', count: 28 }
      ],
      hospital: [
        { value: 'Bệnh viện Bạch Mai', count: 67 },
        { value: 'Bệnh viện Chợ Rẫy', count: 45 },
        { value: 'Bệnh viện 108', count: 32 },
        { value: 'Bệnh viện K', count: 23 }
      ]
    };

    setResults(mockResults);
    setTotalResults(mockResults.length);
    setFacets(mockFacets);
    setLoading(false);
  };

  // Perform search when query or filters change
  useEffect(() => {
    if (query || Object.keys(filters).length > 1) {
      performSearch(query, filters);
    }
  }, [query, filters]);

  // Update URL when search is performed
  const handleSearch = (newQuery: string, newFilters: Record<string, any>) => {
    const params = new URLSearchParams();
    if (newQuery) params.set('q', newQuery);
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(key, value.toString());
      }
    });
    
    setSearchParams(params);
  };

  const handleAnalytics = (event: string, data: any) => {
    console.log('Search Analytics:', event, data);
    // Implement analytics tracking
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'claim': return '📋';
      case 'hospital': return '🏥';
      case 'patient': return '👤';
      case 'document': return '📄';
      default: return '📄';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Chờ xử lý', variant: 'secondary' as const },
      processing: { label: 'Đang xử lý', variant: 'default' as const },
      approved: { label: 'Đã duyệt', variant: 'default' as const },
      rejected: { label: 'Từ chối', variant: 'destructive' as const },
      paid: { label: 'Đã thanh toán', variant: 'default' as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return config ? <Badge variant={config.variant}>{config.label}</Badge> : null;
  };

  const highlightText = (text: string, highlights?: string[]) => {
    if (!highlights || highlights.length === 0) return text;
    
    let highlightedText = text;
    highlights.forEach(highlight => {
      const regex = new RegExp(`(${highlight})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    
    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
  };

  return (
    <div className="space-y-6">
      {/* Search Interface */}
      <AdvancedSearchInterface 
        onSearch={handleSearch}
        onAnalytics={handleAnalytics}
      />

      {/* Results Header */}
      {(query || totalResults > 0) && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Kết quả tìm kiếm
                  {query && (
                    <span className="ml-2 text-muted-foreground">
                      cho "{query}"
                    </span>
                  )}
                </h2>
                <p className="text-muted-foreground">
                  Tìm thấy {totalResults.toLocaleString('vi-VN')} kết quả
                  {loading && ' - Đang tìm kiếm...'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Độ liên quan</SelectItem>
                    <SelectItem value="date">Ngày tạo</SelectItem>
                    <SelectItem value="amount">Số tiền</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </Button>
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Faceted Navigation */}
        {Object.keys(facets).length > 0 && (
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Lọc kết quả
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(facets).map(([key, values]) => (
                  <div key={key}>
                    <h4 className="font-medium mb-2 capitalize">
                      {key === 'status' ? 'Trạng thái' : 
                       key === 'claimType' ? 'Loại hồ sơ' :
                       key === 'hospital' ? 'Bệnh viện' : key}
                    </h4>
                    <div className="space-y-1">
                      {values.map((facet) => (
                        <div key={facet.value} className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              onChange={(e) => {
                                const currentValue = searchParams.get(key);
                                const values = currentValue ? currentValue.split(',') : [];
                                
                                if (e.target.checked) {
                                  values.push(facet.value);
                                } else {
                                  const index = values.indexOf(facet.value);
                                  if (index > -1) values.splice(index, 1);
                                }
                                
                                const newParams = new URLSearchParams(searchParams);
                                if (values.length > 0) {
                                  newParams.set(key, values.join(','));
                                } else {
                                  newParams.delete(key);
                                }
                                setSearchParams(newParams);
                              }}
                            />
                            <span className="text-sm">{facet.value}</span>
                          </label>
                          <Badge variant="outline" className="text-xs">
                            {facet.count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search Results */}
        <div className={`${Object.keys(facets).length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="h-6 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
              {results.map((result) => (
                <Card key={result.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getResultIcon(result.type)}</span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">
                            {highlightText(result.title, result.highlights)}
                          </h3>
                          <p className="text-muted-foreground mb-2">
                            {highlightText(result.description, result.highlights)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Metadata */}
                    <div className="space-y-2">
                      {result.type === 'claim' && (
                        <div className="flex flex-wrap gap-2">
                          {result.metadata.status && getStatusBadge(result.metadata.status)}
                          <Badge variant="outline">{result.metadata.claimType}</Badge>
                          <Badge variant="outline">
                            {result.metadata.amount?.toLocaleString('vi-VN')} ₫
                          </Badge>
                        </div>
                      )}
                      
                      {result.type === 'hospital' && (
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{result.metadata.type}</Badge>
                          <Badge variant="outline">⭐ {result.metadata.rating}</Badge>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                      <span>
                        Tạo: {result.createdAt.toLocaleDateString('vi-VN')}
                      </span>
                      <span>
                        Liên quan: {(result.relevanceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : query ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Không tìm thấy kết quả</h3>
                <p className="text-muted-foreground mb-4">
                  Không tìm thấy kết quả nào cho "{query}". Hãy thử:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Kiểm tra chính tả từ khóa</li>
                  <li>• Sử dụng từ khóa khác</li>
                  <li>• Giảm số lượng từ khóa</li>
                  <li>• Sử dụng bộ lọc ít hơn</li>
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* Pagination */}
          {results.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Hiển thị 1-{Math.min(10, totalResults)} của {totalResults} kết quả
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage === 1}>
                      Trước
                    </Button>
                    <Button variant="outline" size="sm">
                      Sau
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
