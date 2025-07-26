import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, X, Clock, Star, TrendingUp } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { useDebounce } from '../../hooks/useDebounce';
import { SearchFilters } from './SearchFilters';
import { SearchSuggestions } from './SearchSuggestions';

interface SearchHistory {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, any>;
  createdAt: Date;
}

interface AdvancedSearchProps {
  onSearch: (query: string, filters: Record<string, any>) => void;
  onAnalytics?: (event: string, data: any) => void;
}

export function AdvancedSearchInterface({ onSearch, onAnalytics }: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [sortBy, setSortBy] = useState('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }

    const savedSearchesData = localStorage.getItem('savedSearches');
    if (savedSearchesData) {
      setSavedSearches(JSON.parse(savedSearchesData));
    }
  }, []);

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;

    // Analytics tracking
    onAnalytics?.('search_performed', {
      query,
      filters,
      sortBy,
      sortOrder,
      timestamp: new Date()
    });

    // Add to search history
    const newHistoryItem: SearchHistory = {
      id: Date.now().toString(),
      query,
      timestamp: new Date(),
      resultCount: 0 // Would be updated with actual results
    };

    const updatedHistory = [newHistoryItem, ...searchHistory.slice(0, 9)];
    setSearchHistory(updatedHistory);
    localStorage.setItem('searchHistory', JSON.stringify(updatedHistory));

    // Perform search
    onSearch(query, { ...filters, sortBy, sortOrder });
    setShowSuggestions(false);
  }, [query, filters, sortBy, sortOrder, onSearch, onAnalytics, searchHistory]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setQuery('');
    setFilters({});
    setSortBy('relevance');
    setSortOrder('desc');
  };

  const saveCurrentSearch = () => {
    if (!query.trim()) return;

    const searchName = prompt('Tên tìm kiếm đã lưu:');
    if (!searchName) return;

    const newSavedSearch: SavedSearch = {
      id: Date.now().toString(),
      name: searchName,
      query,
      filters,
      createdAt: new Date()
    };

    const updatedSaved = [...savedSearches, newSavedSearch];
    setSavedSearches(updatedSaved);
    localStorage.setItem('savedSearches', JSON.stringify(updatedSaved));
  };

  const loadSavedSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query);
    setFilters(savedSearch.filters);
    onSearch(savedSearch.query, savedSearch.filters);
  };

  const deleteSavedSearch = (id: string) => {
    const updatedSaved = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updatedSaved);
    localStorage.setItem('savedSearches', JSON.stringify(updatedSaved));
  };

  return (
    <div className="space-y-6">
      {/* Main Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm hồ sơ bồi thường, bệnh viện, chẩn đoán..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => setShowSuggestions(true)}
                className="pl-10 pr-24"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-16 top-1 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={handleSearch}
                className="absolute right-2 top-1 h-8"
              >
                Tìm
              </Button>
            </div>

            {/* Search Suggestions */}
            {showSuggestions && (
              <SearchSuggestions
                query={debouncedQuery}
                onSelect={(suggestion) => {
                  setQuery(suggestion);
                  setShowSuggestions(false);
                }}
                onClose={() => setShowSuggestions(false)}
              />
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={isAdvancedMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsAdvancedMode(!isAdvancedMode)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Tìm kiếm nâng cao
              </Button>
              {query && (
                <Button variant="outline" size="sm" onClick={saveCurrentSearch}>
                  <Star className="h-4 w-4 mr-2" />
                  Lưu tìm kiếm
                </Button>
              )}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Độ liên quan</SelectItem>
                  <SelectItem value="date">Ngày tạo</SelectItem>
                  <SelectItem value="amount">Số tiền</SelectItem>
                  <SelectItem value="status">Trạng thái</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>

            {/* Active Filters */}
            {Object.keys(filters).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Bộ lọc:</span>
                {Object.entries(filters).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="gap-1">
                    {key}: {value}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => {
                        const newFilters = { ...filters };
                        delete newFilters[key];
                        setFilters(newFilters);
                      }}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      {isAdvancedMode && (
        <SearchFilters
          filters={filters}
          onChange={setFilters}
          onSearch={() => handleSearch()}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Search History */}
        {searchHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Lịch sử tìm kiếm
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => setQuery(item.query)}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.query}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.timestamp.toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.resultCount} kết quả
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saved Searches */}
        {savedSearches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Tìm kiếm đã lưu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {savedSearches.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 hover:bg-muted rounded"
                  >
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => loadSavedSearch(item)}
                    >
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.query}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSavedSearch(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Search Analytics Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Xu hướng tìm kiếm
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{searchHistory.length}</p>
              <p className="text-sm text-muted-foreground">Tìm kiếm gần đây</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{savedSearches.length}</p>
              <p className="text-sm text-muted-foreground">Tìm kiếm đã lưu</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {Object.keys(filters).length}
              </p>
              <p className="text-sm text-muted-foreground">Bộ lọc đang dùng</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">0.12s</p>
              <p className="text-sm text-muted-foreground">Thời gian phản hồi</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
