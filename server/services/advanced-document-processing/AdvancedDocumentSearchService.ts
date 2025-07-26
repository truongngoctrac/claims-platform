import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import Fuse from 'fuse.js';

export interface SearchQuery {
  id: string;
  userId: string;
  query: string;
  filters: SearchFilter[];
  sorting: SortOption[];
  pagination: PaginationOptions;
  facets: string[];
  searchType: SearchType;
  timestamp: Date;
  executionTime?: number;
}

export type SearchType = 
  | 'full_text'
  | 'semantic'
  | 'fuzzy'
  | 'exact'
  | 'boolean'
  | 'hybrid';

export interface SearchFilter {
  field: string;
  operator: FilterOperator;
  value: any;
  boost?: number;
}

export type FilterOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists'
  | 'regex';

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
  boost?: number;
}

export interface PaginationOptions {
  page: number;
  size: number;
  offset?: number;
}

export interface SearchResult {
  documents: SearchDocument[];
  facets: SearchFacet[];
  aggregations: SearchAggregation[];
  totalCount: number;
  searchTime: number;
  suggestions: SearchSuggestion[];
  relatedQueries: string[];
  queryId: string;
}

export interface SearchDocument {
  id: string;
  score: number;
  highlights: SearchHighlight[];
  source: DocumentSource;
  explanation?: ScoreExplanation;
  snippet: string;
}

export interface DocumentSource {
  id: string;
  filename: string;
  originalName: string;
  documentType: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  ocrText?: string;
  metadata: Record<string, any>;
  extractedFields: Record<string, any>;
  tags: string[];
  classification: string;
  status: string;
  thumbnailPath?: string;
}

export interface SearchHighlight {
  field: string;
  fragments: string[];
  matchedTerms: string[];
}

export interface SearchFacet {
  field: string;
  values: FacetValue[];
  totalCount: number;
}

export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

export interface SearchAggregation {
  name: string;
  type: 'terms' | 'range' | 'date_histogram' | 'stats' | 'cardinality';
  buckets?: AggregationBucket[];
  value?: number;
}

export interface AggregationBucket {
  key: string;
  docCount: number;
  value?: number;
}

export interface SearchSuggestion {
  type: 'spelling' | 'completion' | 'phrase';
  text: string;
  score: number;
  highlight?: string;
}

export interface ScoreExplanation {
  value: number;
  description: string;
  details: ScoreExplanation[];
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  userId: string;
  query: SearchQuery;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  tags: string[];
}

export interface SearchIndex {
  id: string;
  name: string;
  documentTypes: string[];
  fields: IndexField[];
  settings: IndexSettings;
  status: 'building' | 'ready' | 'updating' | 'error';
  documentCount: number;
  lastUpdated: Date;
}

export interface IndexField {
  name: string;
  type: FieldType;
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  facetable: boolean;
  boost: number;
  analyzer?: string;
}

export type FieldType = 
  | 'text'
  | 'keyword'
  | 'integer'
  | 'float'
  | 'date'
  | 'boolean'
  | 'geo_point'
  | 'object'
  | 'nested';

export interface IndexSettings {
  numberOfShards: number;
  numberOfReplicas: number;
  maxResultWindow: number;
  analyzer: string;
  similarity: string;
  refreshInterval: string;
}

export interface SearchAnalytics {
  totalSearches: number;
  uniqueUsers: number;
  averageResponseTime: number;
  topQueries: QueryStatistics[];
  searchTrends: SearchTrend[];
  popularFilters: FilterStatistics[];
  clickThroughRates: ClickThroughRate[];
  zeroResultQueries: string[];
}

export interface QueryStatistics {
  query: string;
  count: number;
  averageResultCount: number;
  averageClickPosition: number;
  lastUsed: Date;
}

export interface SearchTrend {
  date: Date;
  searchCount: number;
  uniqueUsers: number;
  averageResponseTime: number;
}

export interface FilterStatistics {
  field: string;
  value: string;
  count: number;
  resultImpact: number;
}

export interface ClickThroughRate {
  query: string;
  totalSearches: number;
  totalClicks: number;
  ctr: number;
  averagePosition: number;
}

export class AdvancedDocumentSearchService extends EventEmitter {
  private documents: Map<string, DocumentSource> = new Map();
  private searchQueries: Map<string, SearchQuery> = new Map();
  private savedSearches: Map<string, SavedSearch> = new Map();
  private searchIndexes: Map<string, SearchIndex> = new Map();
  private searchAnalytics: SearchAnalytics;
  private fuseInstances: Map<string, Fuse<DocumentSource>> = new Map();

  constructor() {
    super();
    this.initializeAnalytics();
    this.initializeDefaultIndexes();
  }

  // Core Search Methods
  async search(
    query: string,
    filters: SearchFilter[] = [],
    options: {
      searchType?: SearchType;
      sorting?: SortOption[];
      pagination?: PaginationOptions;
      facets?: string[];
      userId?: string;
      includeHighlights?: boolean;
      includeExplanations?: boolean;
    } = {}
  ): Promise<SearchResult> {
    const startTime = Date.now();
    const queryId = uuidv4();

    const searchQuery: SearchQuery = {
      id: queryId,
      userId: options.userId || 'anonymous',
      query,
      filters,
      sorting: options.sorting || [],
      pagination: options.pagination || { page: 1, size: 20 },
      facets: options.facets || [],
      searchType: options.searchType || 'hybrid',
      timestamp: new Date()
    };

    this.searchQueries.set(queryId, searchQuery);

    try {
      let searchResults: SearchDocument[] = [];

      switch (searchQuery.searchType) {
        case 'full_text':
          searchResults = await this.performFullTextSearch(query, filters);
          break;
        case 'semantic':
          searchResults = await this.performSemanticSearch(query, filters);
          break;
        case 'fuzzy':
          searchResults = await this.performFuzzySearch(query, filters);
          break;
        case 'exact':
          searchResults = await this.performExactSearch(query, filters);
          break;
        case 'boolean':
          searchResults = await this.performBooleanSearch(query, filters);
          break;
        case 'hybrid':
          searchResults = await this.performHybridSearch(query, filters);
          break;
      }

      // Apply additional filters
      searchResults = this.applyFilters(searchResults, filters);

      // Apply sorting
      searchResults = this.applySorting(searchResults, searchQuery.sorting);

      // Calculate facets
      const facets = this.calculateFacets(searchResults, searchQuery.facets);

      // Calculate aggregations
      const aggregations = this.calculateAggregations(searchResults);

      // Apply pagination
      const totalCount = searchResults.length;
      const paginatedResults = this.applyPagination(searchResults, searchQuery.pagination);

      // Add highlights if requested
      if (options.includeHighlights) {
        paginatedResults.forEach(result => {
          result.highlights = this.generateHighlights(result.source, query);
        });
      }

      // Generate suggestions
      const suggestions = await this.generateSuggestions(query, searchResults);

      // Generate related queries
      const relatedQueries = await this.generateRelatedQueries(query);

      const executionTime = Date.now() - startTime;
      searchQuery.executionTime = executionTime;

      const result: SearchResult = {
        documents: paginatedResults,
        facets,
        aggregations,
        totalCount,
        searchTime: executionTime,
        suggestions,
        relatedQueries,
        queryId
      };

      // Update analytics
      this.updateSearchAnalytics(searchQuery, result);

      this.emit('searchPerformed', { query: searchQuery, result });

      return result;

    } catch (error) {
      this.emit('searchError', { queryId, error: error.message });
      throw error;
    }
  }

  private async performFullTextSearch(query: string, filters: SearchFilter[]): Promise<SearchDocument[]> {
    const results: SearchDocument[] = [];
    const searchTerms = this.tokenizeQuery(query);

    for (const [id, document] of this.documents.entries()) {
      let score = 0;
      const matchedFields: string[] = [];

      // Search in OCR text
      if (document.ocrText) {
        const textScore = this.calculateTextScore(document.ocrText, searchTerms);
        score += textScore * 0.6;
        if (textScore > 0) matchedFields.push('ocrText');
      }

      // Search in filename
      const filenameScore = this.calculateTextScore(document.originalName, searchTerms);
      score += filenameScore * 0.2;
      if (filenameScore > 0) matchedFields.push('filename');

      // Search in metadata
      const metadataText = Object.values(document.metadata).join(' ');
      const metadataScore = this.calculateTextScore(metadataText, searchTerms);
      score += metadataScore * 0.1;
      if (metadataScore > 0) matchedFields.push('metadata');

      // Search in extracted fields
      const fieldsText = Object.values(document.extractedFields).join(' ');
      const fieldsScore = this.calculateTextScore(fieldsText, searchTerms);
      score += fieldsScore * 0.1;
      if (fieldsScore > 0) matchedFields.push('extractedFields');

      if (score > 0) {
        results.push({
          id: document.id,
          score,
          highlights: [],
          source: document,
          snippet: this.generateSnippet(document, searchTerms)
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async performSemanticSearch(query: string, filters: SearchFilter[]): Promise<SearchDocument[]> {
    // Mock semantic search - in real implementation would use embeddings
    const results: SearchDocument[] = [];
    const queryEmbedding = await this.generateQueryEmbedding(query);

    for (const [id, document] of this.documents.entries()) {
      const documentEmbedding = await this.getDocumentEmbedding(document);
      const similarity = this.calculateCosineSimilarity(queryEmbedding, documentEmbedding);

      if (similarity > 0.3) { // Threshold for relevance
        results.push({
          id: document.id,
          score: similarity,
          highlights: [],
          source: document,
          snippet: this.generateSnippet(document, [query])
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async performFuzzySearch(query: string, filters: SearchFilter[]): Promise<SearchDocument[]> {
    const results: SearchDocument[] = [];

    // Use Fuse.js for fuzzy search
    let fuseInstance = this.fuseInstances.get('default');
    if (!fuseInstance) {
      fuseInstance = new Fuse(Array.from(this.documents.values()), {
        keys: [
          { name: 'ocrText', weight: 0.6 },
          { name: 'originalName', weight: 0.2 },
          { name: 'tags', weight: 0.1 },
          { name: 'classification', weight: 0.1 }
        ],
        threshold: 0.4,
        includeScore: true,
        includeMatches: true
      });
      this.fuseInstances.set('default', fuseInstance);
    }

    const fuseResults = fuseInstance.search(query);

    for (const fuseResult of fuseResults) {
      results.push({
        id: fuseResult.item.id,
        score: 1 - (fuseResult.score || 0),
        highlights: [],
        source: fuseResult.item,
        snippet: this.generateSnippet(fuseResult.item, [query])
      });
    }

    return results;
  }

  private async performExactSearch(query: string, filters: SearchFilter[]): Promise<SearchDocument[]> {
    const results: SearchDocument[] = [];
    const exactQuery = query.toLowerCase();

    for (const [id, document] of this.documents.entries()) {
      let score = 0;

      // Exact match in OCR text
      if (document.ocrText?.toLowerCase().includes(exactQuery)) {
        score += 0.8;
      }

      // Exact match in filename
      if (document.originalName.toLowerCase().includes(exactQuery)) {
        score += 0.2;
      }

      if (score > 0) {
        results.push({
          id: document.id,
          score,
          highlights: [],
          source: document,
          snippet: this.generateSnippet(document, [query])
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async performBooleanSearch(query: string, filters: SearchFilter[]): Promise<SearchDocument[]> {
    // Parse boolean query (simplified implementation)
    const booleanParts = this.parseBooleanQuery(query);
    const results: SearchDocument[] = [];

    for (const [id, document] of this.documents.entries()) {
      if (this.evaluateBooleanQuery(booleanParts, document)) {
        results.push({
          id: document.id,
          score: 1.0,
          highlights: [],
          source: document,
          snippet: this.generateSnippet(document, [query])
        });
      }
    }

    return results;
  }

  private async performHybridSearch(query: string, filters: SearchFilter[]): Promise<SearchDocument[]> {
    // Combine multiple search methods
    const fullTextResults = await this.performFullTextSearch(query, filters);
    const semanticResults = await this.performSemanticSearch(query, filters);
    const fuzzyResults = await this.performFuzzySearch(query, filters);

    // Merge and re-rank results
    const mergedResults = this.mergeSearchResults([
      { results: fullTextResults, weight: 0.5 },
      { results: semanticResults, weight: 0.3 },
      { results: fuzzyResults, weight: 0.2 }
    ]);

    return mergedResults;
  }

  // Filter and Sorting Methods
  private applyFilters(results: SearchDocument[], filters: SearchFilter[]): SearchDocument[] {
    return results.filter(result => {
      return filters.every(filter => this.evaluateFilter(result.source, filter));
    });
  }

  private evaluateFilter(document: DocumentSource, filter: SearchFilter): boolean {
    const value = this.getFieldValue(document, filter.field);

    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'not_equals':
        return value !== filter.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'not_contains':
        return !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'starts_with':
        return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
      case 'ends_with':
        return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
      case 'greater_than':
        return Number(value) > Number(filter.value);
      case 'less_than':
        return Number(value) < Number(filter.value);
      case 'between':
        const [min, max] = filter.value;
        return Number(value) >= Number(min) && Number(value) <= Number(max);
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'not_in':
        return Array.isArray(filter.value) && !filter.value.includes(value);
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      case 'regex':
        return new RegExp(filter.value, 'i').test(String(value));
      default:
        return true;
    }
  }

  private applySorting(results: SearchDocument[], sortOptions: SortOption[]): SearchDocument[] {
    if (sortOptions.length === 0) {
      return results; // Already sorted by score
    }

    return results.sort((a, b) => {
      for (const sortOption of sortOptions) {
        const aValue = this.getFieldValue(a.source, sortOption.field);
        const bValue = this.getFieldValue(b.source, sortOption.field);

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        else if (aValue > bValue) comparison = 1;

        if (comparison !== 0) {
          return sortOption.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  private applyPagination(results: SearchDocument[], pagination: PaginationOptions): SearchDocument[] {
    const offset = pagination.offset || (pagination.page - 1) * pagination.size;
    return results.slice(offset, offset + pagination.size);
  }

  // Facet and Aggregation Methods
  private calculateFacets(results: SearchDocument[], facetFields: string[]): SearchFacet[] {
    const facets: SearchFacet[] = [];

    for (const field of facetFields) {
      const values: Map<string, number> = new Map();

      for (const result of results) {
        const fieldValue = this.getFieldValue(result.source, field);
        if (fieldValue !== undefined && fieldValue !== null) {
          const stringValue = String(fieldValue);
          values.set(stringValue, (values.get(stringValue) || 0) + 1);
        }
      }

      const facetValues: FacetValue[] = Array.from(values.entries())
        .map(([value, count]) => ({ value, count, selected: false }))
        .sort((a, b) => b.count - a.count);

      facets.push({
        field,
        values: facetValues,
        totalCount: facetValues.reduce((sum, fv) => sum + fv.count, 0)
      });
    }

    return facets;
  }

  private calculateAggregations(results: SearchDocument[]): SearchAggregation[] {
    const aggregations: SearchAggregation[] = [];

    // Document type aggregation
    const typeAgg = this.calculateTermsAggregation(results, 'documentType');
    aggregations.push({
      name: 'document_types',
      type: 'terms',
      buckets: typeAgg
    });

    // Size stats aggregation
    const sizes = results.map(r => r.source.size);
    aggregations.push({
      name: 'size_stats',
      type: 'stats',
      value: sizes.reduce((sum, size) => sum + size, 0) / sizes.length
    });

    // Upload date histogram
    const dateHistogram = this.calculateDateHistogram(results, 'uploadedAt', 'day');
    aggregations.push({
      name: 'upload_date_histogram',
      type: 'date_histogram',
      buckets: dateHistogram
    });

    return aggregations;
  }

  private calculateTermsAggregation(results: SearchDocument[], field: string): AggregationBucket[] {
    const counts: Map<string, number> = new Map();

    for (const result of results) {
      const value = this.getFieldValue(result.source, field);
      if (value) {
        const stringValue = String(value);
        counts.set(stringValue, (counts.get(stringValue) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([key, docCount]) => ({ key, docCount }))
      .sort((a, b) => b.docCount - a.docCount);
  }

  private calculateDateHistogram(
    results: SearchDocument[], 
    field: string, 
    interval: 'day' | 'week' | 'month'
  ): AggregationBucket[] {
    const buckets: Map<string, number> = new Map();

    for (const result of results) {
      const date = this.getFieldValue(result.source, field) as Date;
      if (date) {
        const bucketKey = this.formatDateForHistogram(date, interval);
        buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
      }
    }

    return Array.from(buckets.entries())
      .map(([key, docCount]) => ({ key, docCount }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  // Suggestion and Related Query Methods
  private async generateSuggestions(query: string, results: SearchDocument[]): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    // Spelling suggestions
    const spellingSuggestions = this.generateSpellingSuggestions(query);
    suggestions.push(...spellingSuggestions);

    // Completion suggestions
    const completionSuggestions = this.generateCompletionSuggestions(query);
    suggestions.push(...completionSuggestions);

    // Phrase suggestions based on results
    const phraseSuggestions = this.generatePhraseSuggestions(query, results);
    suggestions.push(...phraseSuggestions);

    return suggestions;
  }

  private generateSpellingSuggestions(query: string): SearchSuggestion[] {
    // Mock spelling correction
    const commonMisspellings: Record<string, string> = {
      'benh vien': 'bệnh viện',
      'hoa don': 'hóa đơn',
      'xet nghiem': 'xét nghiệm',
      'thuoc': 'thuốc'
    };

    const suggestions: SearchSuggestion[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [misspelling, correction] of Object.entries(commonMisspellings)) {
      if (lowerQuery.includes(misspelling)) {
        suggestions.push({
          type: 'spelling',
          text: query.replace(new RegExp(misspelling, 'gi'), correction),
          score: 0.9,
          highlight: correction
        });
      }
    }

    return suggestions;
  }

  private generateCompletionSuggestions(query: string): SearchSuggestion[] {
    // Mock auto-completion
    const completions = [
      'bệnh viện bạch mai',
      'hóa đơn viện phí',
      'xét nghiệm máu',
      'thuốc kháng sinh',
      'chẩn đoán bệnh'
    ];

    return completions
      .filter(completion => completion.toLowerCase().startsWith(query.toLowerCase()))
      .map(completion => ({
        type: 'completion' as const,
        text: completion,
        score: 0.8,
        highlight: completion.substring(query.length)
      }));
  }

  private generatePhraseSuggestions(query: string, results: SearchDocument[]): SearchSuggestion[] {
    // Extract common phrases from search results
    const phrases = new Set<string>();

    for (const result of results) {
      if (result.source.ocrText) {
        const words = result.source.ocrText.split(/\s+/);
        for (let i = 0; i < words.length - 1; i++) {
          const phrase = `${words[i]} ${words[i + 1]}`.toLowerCase();
          if (phrase.includes(query.toLowerCase())) {
            phrases.add(phrase);
          }
        }
      }
    }

    return Array.from(phrases)
      .slice(0, 5)
      .map(phrase => ({
        type: 'phrase' as const,
        text: phrase,
        score: 0.7
      }));
  }

  private async generateRelatedQueries(query: string): Promise<string[]> {
    // Mock related queries based on query analysis
    const queryTerms = this.tokenizeQuery(query);
    const relatedQueries: string[] = [];

    // Add variations and related terms
    const relatedTerms: Record<string, string[]> = {
      'bệnh viện': ['phòng khám', 'trung tâm y tế', 'cơ sở y tế'],
      'hóa đơn': ['biên lai', 'phiếu thu', 'chứng từ'],
      'xét nghiệm': ['kiểm tra', 'thử nghiệm', 'phân tích'],
      'thuốc': ['dược phẩm', 'toa thuốc', 'đơn thuốc']
    };

    for (const term of queryTerms) {
      const related = relatedTerms[term.toLowerCase()];
      if (related) {
        relatedQueries.push(...related.map(r => query.replace(new RegExp(term, 'gi'), r)));
      }
    }

    return relatedQueries.slice(0, 5);
  }

  // Highlighting Methods
  private generateHighlights(document: DocumentSource, query: string): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const searchTerms = this.tokenizeQuery(query);

    // Highlight in OCR text
    if (document.ocrText) {
      const fragments = this.extractHighlightFragments(document.ocrText, searchTerms);
      if (fragments.length > 0) {
        highlights.push({
          field: 'ocrText',
          fragments,
          matchedTerms: searchTerms.filter(term => 
            document.ocrText!.toLowerCase().includes(term.toLowerCase())
          )
        });
      }
    }

    // Highlight in filename
    const filenameFragments = this.extractHighlightFragments(document.originalName, searchTerms);
    if (filenameFragments.length > 0) {
      highlights.push({
        field: 'filename',
        fragments: filenameFragments,
        matchedTerms: searchTerms.filter(term => 
          document.originalName.toLowerCase().includes(term.toLowerCase())
        )
      });
    }

    return highlights;
  }

  private extractHighlightFragments(text: string, searchTerms: string[]): string[] {
    const fragments: string[] = [];
    const fragmentLength = 150;

    for (const term of searchTerms) {
      const regex = new RegExp(term, 'gi');
      let match;

      while ((match = regex.exec(text)) !== null) {
        const start = Math.max(0, match.index - fragmentLength / 2);
        const end = Math.min(text.length, match.index + term.length + fragmentLength / 2);
        
        let fragment = text.substring(start, end);
        
        // Add ellipsis if truncated
        if (start > 0) fragment = '...' + fragment;
        if (end < text.length) fragment = fragment + '...';

        // Highlight the matched term
        fragment = fragment.replace(
          new RegExp(term, 'gi'), 
          `<mark>$&</mark>`
        );

        fragments.push(fragment);
      }
    }

    return fragments.slice(0, 3); // Limit to 3 fragments per field
  }

  // Saved Search Methods
  async saveSearch(
    userId: string,
    name: string,
    query: SearchQuery,
    options: {
      description?: string;
      isPublic?: boolean;
      tags?: string[];
    } = {}
  ): Promise<SavedSearch> {
    const savedSearch: SavedSearch = {
      id: uuidv4(),
      name,
      description: options.description,
      userId,
      query,
      isPublic: options.isPublic || false,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      tags: options.tags || []
    };

    this.savedSearches.set(savedSearch.id, savedSearch);
    this.emit('searchSaved', { savedSearch });

    return savedSearch;
  }

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return Array.from(this.savedSearches.values())
      .filter(search => search.userId === userId || search.isPublic)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async executeSavedSearch(savedSearchId: string, userId: string): Promise<SearchResult> {
    const savedSearch = this.savedSearches.get(savedSearchId);
    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    // Check access permissions
    if (savedSearch.userId !== userId && !savedSearch.isPublic) {
      throw new Error('Access denied');
    }

    // Update usage count
    savedSearch.usageCount++;
    this.savedSearches.set(savedSearchId, savedSearch);

    // Execute the saved query
    return this.search(
      savedSearch.query.query,
      savedSearch.query.filters,
      {
        searchType: savedSearch.query.searchType,
        sorting: savedSearch.query.sorting,
        pagination: savedSearch.query.pagination,
        facets: savedSearch.query.facets,
        userId
      }
    );
  }

  // Document Management Methods
  async addDocument(document: DocumentSource): Promise<void> {
    this.documents.set(document.id, document);
    this.updateSearchIndexes(document);
    this.emit('documentAdded', { document });
  }

  async updateDocument(documentId: string, updates: Partial<DocumentSource>): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) return;

    const updatedDocument = { ...document, ...updates };
    this.documents.set(documentId, updatedDocument);
    this.updateSearchIndexes(updatedDocument);
    this.emit('documentUpdated', { document: updatedDocument });
  }

  async removeDocument(documentId: string): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) return;

    this.documents.delete(documentId);
    this.removeFromSearchIndexes(documentId);
    this.emit('documentRemoved', { documentId });
  }

  // Search Analytics Methods
  async getSearchAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<SearchAnalytics> {
    // Filter analytics by date range if provided
    let filteredQueries = Array.from(this.searchQueries.values());
    
    if (startDate || endDate) {
      filteredQueries = filteredQueries.filter(query => {
        const queryDate = query.timestamp;
        return (!startDate || queryDate >= startDate) && 
               (!endDate || queryDate <= endDate);
      });
    }

    return this.calculateAnalytics(filteredQueries);
  }

  private calculateAnalytics(queries: SearchQuery[]): SearchAnalytics {
    const uniqueUsers = new Set(queries.map(q => q.userId)).size;
    const totalSearches = queries.length;
    const averageResponseTime = queries
      .filter(q => q.executionTime)
      .reduce((sum, q) => sum + (q.executionTime || 0), 0) / queries.length;

    // Calculate top queries
    const queryFrequency: Map<string, number> = new Map();
    queries.forEach(q => {
      queryFrequency.set(q.query, (queryFrequency.get(q.query) || 0) + 1);
    });

    const topQueries: QueryStatistics[] = Array.from(queryFrequency.entries())
      .map(([query, count]) => ({
        query,
        count,
        averageResultCount: 0, // Would need to track this
        averageClickPosition: 0, // Would need click tracking
        lastUsed: new Date()
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSearches,
      uniqueUsers,
      averageResponseTime,
      topQueries,
      searchTrends: [], // Would implement trend calculation
      popularFilters: [], // Would implement filter analysis
      clickThroughRates: [], // Would implement CTR calculation
      zeroResultQueries: [] // Would track zero-result queries
    };
  }

  // Helper Methods
  private tokenizeQuery(query: string): string[] {
    return query.toLowerCase()
      .split(/[\s\-_.,;:!?()[\]{}'"]+/)
      .filter(token => token.length > 0);
  }

  private calculateTextScore(text: string, searchTerms: string[]): number {
    if (!text) return 0;

    const lowerText = text.toLowerCase();
    let score = 0;

    for (const term of searchTerms) {
      const termCount = (lowerText.match(new RegExp(term.toLowerCase(), 'g')) || []).length;
      score += termCount / text.length * 1000; // Normalize by text length
    }

    return score;
  }

  private generateSnippet(document: DocumentSource, searchTerms: string[]): string {
    const text = document.ocrText || document.originalName;
    if (!text) return '';

    // Find the best snippet containing search terms
    const snippetLength = 200;
    for (const term of searchTerms) {
      const index = text.toLowerCase().indexOf(term.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - snippetLength / 2);
        const end = Math.min(text.length, start + snippetLength);
        let snippet = text.substring(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';
        
        return snippet;
      }
    }

    // Fallback to beginning of text
    return text.substring(0, snippetLength) + (text.length > snippetLength ? '...' : '');
  }

  private getFieldValue(document: DocumentSource, field: string): any {
    const fieldParts = field.split('.');
    let value: any = document;

    for (const part of fieldParts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private formatDateForHistogram(date: Date, interval: string): string {
    switch (interval) {
      case 'day':
        return date.toISOString().split('T')[0];
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return date.toISOString().split('T')[0];
    }
  }

  // Mock methods for advanced features
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    // Mock embedding generation
    return Array.from({ length: 128 }, () => Math.random());
  }

  private async getDocumentEmbedding(document: DocumentSource): Promise<number[]> {
    // Mock document embedding
    return Array.from({ length: 128 }, () => Math.random());
  }

  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    // Mock cosine similarity calculation
    return Math.random() * 0.8 + 0.2;
  }

  private parseBooleanQuery(query: string): any {
    // Mock boolean query parser
    return { type: 'and', terms: [query] };
  }

  private evaluateBooleanQuery(booleanParts: any, document: DocumentSource): boolean {
    // Mock boolean evaluation
    return Math.random() > 0.5;
  }

  private mergeSearchResults(resultSets: Array<{ results: SearchDocument[]; weight: number }>): SearchDocument[] {
    const scoreMap: Map<string, number> = new Map();
    const documentMap: Map<string, SearchDocument> = new Map();

    for (const { results, weight } of resultSets) {
      for (const result of results) {
        const currentScore = scoreMap.get(result.id) || 0;
        scoreMap.set(result.id, currentScore + (result.score * weight));
        documentMap.set(result.id, result);
      }
    }

    return Array.from(scoreMap.entries())
      .map(([id, score]) => {
        const document = documentMap.get(id)!;
        return { ...document, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  private updateSearchAnalytics(query: SearchQuery, result: SearchResult): void {
    this.searchAnalytics.totalSearches++;
    this.searchAnalytics.averageResponseTime = 
      (this.searchAnalytics.averageResponseTime + result.searchTime) / 2;
  }

  private updateSearchIndexes(document: DocumentSource): void {
    // Update search indexes with new/updated document
    this.fuseInstances.clear(); // Force rebuild of Fuse instances
  }

  private removeFromSearchIndexes(documentId: string): void {
    // Remove document from search indexes
    this.fuseInstances.clear(); // Force rebuild of Fuse instances
  }

  private initializeAnalytics(): void {
    this.searchAnalytics = {
      totalSearches: 0,
      uniqueUsers: 0,
      averageResponseTime: 0,
      topQueries: [],
      searchTrends: [],
      popularFilters: [],
      clickThroughRates: [],
      zeroResultQueries: []
    };
  }

  private initializeDefaultIndexes(): void {
    // Initialize default search indexes
    const defaultIndex: SearchIndex = {
      id: 'default',
      name: 'Default Document Index',
      documentTypes: ['medical_invoice', 'prescription', 'lab_result'],
      fields: [
        {
          name: 'ocrText',
          type: 'text',
          searchable: true,
          filterable: false,
          sortable: false,
          facetable: false,
          boost: 1.0,
          analyzer: 'standard'
        },
        {
          name: 'originalName',
          type: 'text',
          searchable: true,
          filterable: true,
          sortable: true,
          facetable: false,
          boost: 0.8
        },
        {
          name: 'documentType',
          type: 'keyword',
          searchable: false,
          filterable: true,
          sortable: false,
          facetable: true,
          boost: 1.0
        }
      ],
      settings: {
        numberOfShards: 1,
        numberOfReplicas: 0,
        maxResultWindow: 10000,
        analyzer: 'standard',
        similarity: 'BM25',
        refreshInterval: '1s'
      },
      status: 'ready',
      documentCount: 0,
      lastUpdated: new Date()
    };

    this.searchIndexes.set(defaultIndex.id, defaultIndex);
  }
}
