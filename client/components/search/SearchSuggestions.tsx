import React, { useState, useEffect } from 'react';
import { Search, Clock, TrendingUp, Tag, MapPin, Users } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface Suggestion {
  id: string;
  text: string;
  type: 'query' | 'hospital' | 'diagnosis' | 'patient' | 'trending' | 'recent';
  icon: React.ReactNode;
  description?: string;
  metadata?: any;
}

interface SearchSuggestionsProps {
  query: string;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
}

export function SearchSuggestions({ query, onSelect, onClose }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock data for suggestions
  const mockSuggestions: Suggestion[] = [
    {
      id: '1',
      text: 'Bệnh viện Bạch Mai',
      type: 'hospital',
      icon: <MapPin className="h-4 w-4" />,
      description: 'Bệnh viện Trung ương',
      metadata: { address: 'Hà Nội' }
    },
    {
      id: '2',
      text: 'Viêm phổi',
      type: 'diagnosis',
      icon: <Tag className="h-4 w-4" />,
      description: 'Chẩn đoán bệnh',
      metadata: { icd10: 'J18.9' }
    },
    {
      id: '3',
      text: 'Phẫu thuật tim',
      type: 'trending',
      icon: <TrendingUp className="h-4 w-4" />,
      description: 'Tìm kiếm phổ biến',
      metadata: { searches: 1234 }
    },
    {
      id: '4',
      text: 'Nguyễn Văn A',
      type: 'patient',
      icon: <Users className="h-4 w-4" />,
      description: 'Bệnh nhân',
      metadata: { id: 'BN001' }
    },
    {
      id: '5',
      text: 'Bồi thường cao',
      type: 'recent',
      icon: <Clock className="h-4 w-4" />,
      description: 'Tìm kiếm gần đây'
    }
  ];

  const popularSearches = [
    'Khám tổng quát',
    'Xét nghiệm máu',
    'Chụp X-quang',
    'Siêu âm',
    'Nội soi',
    'Phẫu thuật',
    'Cấp cứu',
    'Thuốc kháng sinh'
  ];

  const recentSearches = [
    'Bệnh viện Chợ Rẫy',
    'Viêm gan B',
    'Trẻ em dưới 6 tuổi',
    'Bồi thường từ chối'
  ];

  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!query.trim()) {
        // Show popular and recent searches
        const popular = popularSearches.slice(0, 4).map((search, index) => ({
          id: `popular-${index}`,
          text: search,
          type: 'trending' as const,
          icon: <TrendingUp className="h-4 w-4" />,
          description: 'Tìm kiếm phổ biến'
        }));

        const recent = recentSearches.slice(0, 3).map((search, index) => ({
          id: `recent-${index}`,
          text: search,
          type: 'recent' as const,
          icon: <Clock className="h-4 w-4" />,
          description: 'Tìm kiếm gần đây'
        }));

        setSuggestions([...popular, ...recent]);
      } else {
        // Filter suggestions based on query
        const filtered = mockSuggestions.filter(suggestion =>
          suggestion.text.toLowerCase().includes(query.toLowerCase()) ||
          suggestion.description?.toLowerCase().includes(query.toLowerCase())
        );

        // Add query-based suggestions
        const queryBased: Suggestion[] = [
          {
            id: 'query-exact',
            text: query,
            type: 'query',
            icon: <Search className="h-4 w-4" />,
            description: 'Tìm kiếm chính xác'
          }
        ];

        // Add auto-complete suggestions
        const autoComplete = popularSearches
          .filter(search => search.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 3)
          .map((search, index) => ({
            id: `auto-${index}`,
            text: search,
            type: 'query' as const,
            icon: <Search className="h-4 w-4" />,
            description: 'Gợi ý tự động'
          }));

        setSuggestions([...queryBased, ...filtered, ...autoComplete]);
      }

      setLoading(false);
    };

    fetchSuggestions();
  }, [query]);

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'hospital':
        return <MapPin className="h-4 w-4 text-blue-500" />;
      case 'diagnosis':
        return <Tag className="h-4 w-4 text-green-500" />;
      case 'patient':
        return <Users className="h-4 w-4 text-purple-500" />;
      case 'trending':
        return <TrendingUp className="h-4 w-4 text-orange-500" />;
      case 'recent':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Search className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'hospital':
        return 'Bệnh viện';
      case 'diagnosis':
        return 'Chẩn đoán';
      case 'patient':
        return 'Bệnh nhân';
      case 'trending':
        return 'Phổ biến';
      case 'recent':
        return 'Gần đây';
      default:
        return 'Tìm kiếm';
    }
  };

  if (suggestions.length === 0 && !loading) {
    return null;
  }

  return (
    <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-96 overflow-hidden">
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            Đang tìm kiếm...
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {/* Section Headers */}
            {!query && (
              <>
                <div className="px-4 py-2 bg-muted/50 border-b">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Tìm kiếm phổ biến
                  </h4>
                </div>
                {suggestions
                  .filter(s => s.type === 'trending')
                  .map((suggestion) => (
                    <SuggestionItem
                      key={suggestion.id}
                      suggestion={suggestion}
                      onSelect={onSelect}
                      getSuggestionIcon={getSuggestionIcon}
                      getTypeLabel={getTypeLabel}
                    />
                  ))}
                
                <div className="px-4 py-2 bg-muted/50 border-b border-t">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Tìm kiếm gần đây
                  </h4>
                </div>
                {suggestions
                  .filter(s => s.type === 'recent')
                  .map((suggestion) => (
                    <SuggestionItem
                      key={suggestion.id}
                      suggestion={suggestion}
                      onSelect={onSelect}
                      getSuggestionIcon={getSuggestionIcon}
                      getTypeLabel={getTypeLabel}
                    />
                  ))}
              </>
            )}

            {query && suggestions.map((suggestion) => (
              <SuggestionItem
                key={suggestion.id}
                suggestion={suggestion}
                onSelect={onSelect}
                getSuggestionIcon={getSuggestionIcon}
                getTypeLabel={getTypeLabel}
                query={query}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SuggestionItemProps {
  suggestion: Suggestion;
  onSelect: (text: string) => void;
  getSuggestionIcon: (type: string) => React.ReactNode;
  getTypeLabel: (type: string) => string;
  query?: string;
}

function SuggestionItem({ 
  suggestion, 
  onSelect, 
  getSuggestionIcon, 
  getTypeLabel, 
  query 
}: SuggestionItemProps) {
  const highlightText = (text: string, query?: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => (
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900">
          {part}
        </mark>
      ) : (
        part
      )
    ));
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
      onClick={() => onSelect(suggestion.text)}
    >
      <div className="flex-shrink-0">
        {getSuggestionIcon(suggestion.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {highlightText(suggestion.text, query)}
          </p>
          <Badge variant="outline" className="text-xs">
            {getTypeLabel(suggestion.type)}
          </Badge>
        </div>
        {suggestion.description && (
          <p className="text-xs text-muted-foreground truncate">
            {suggestion.description}
          </p>
        )}
        {suggestion.metadata && (
          <div className="text-xs text-muted-foreground mt-1">
            {suggestion.metadata.address && (
              <span>📍 {suggestion.metadata.address}</span>
            )}
            {suggestion.metadata.icd10 && (
              <span>🏷️ {suggestion.metadata.icd10}</span>
            )}
            {suggestion.metadata.searches && (
              <span>🔥 {suggestion.metadata.searches} lượt tìm</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
