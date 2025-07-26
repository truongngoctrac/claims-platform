import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import { ElasticsearchClusterService } from './ElasticsearchClusterService';

interface SuggestionConfig {
  type: 'term' | 'phrase' | 'completion' | 'context' | 'popular' | 'trending';
  field: string;
  size: number;
  confidence?: number;
  maxErrors?: number;
  prefixLength?: number;
  minWordLength?: number;
  suggestMode?: 'missing' | 'popular' | 'always';
  analyzer?: string;
  shardSize?: number;
  text?: string;
  gramSize?: number;
  realWordErrorLikelihood?: number;
  contexts?: { [key: string]: string[] };
  payload?: any;
}

interface Suggestion {
  text: string;
  score: number;
  highlighted?: string;
  frequency?: number;
  options?: SuggestionOption[];
  category?: string;
  type: string;
  metadata?: any;
}

interface SuggestionOption {
  text: string;
  score: number;
  freq?: number;
  payload?: any;
  highlighted?: string;
}

interface SuggestionRequest {
  text: string;
  configs: SuggestionConfig[];
  size?: number;
  includePopular?: boolean;
  includeTrending?: boolean;
  userContext?: {
    userId?: string;
    sessionId?: string;
    location?: string;
    language?: string;
    preferences?: { [key: string]: any };
  };
}

interface SuggestionResponse {
  suggestions: Suggestion[];
  popular: Suggestion[];
  trending: Suggestion[];
  corrections: Suggestion[];
  alternatives: Suggestion[];
  metadata: {
    took: number;
    total: number;
    userContext?: any;
  };
}

interface PopularQuery {
  query: string;
  frequency: number;
  trend: number;
  category?: string;
  lastSearched: Date;
}

interface TrendingQuery {
  query: string;
  growth: number;
  volume: number;
  category?: string;
  timeframe: string;
}

interface QueryCorrection {
  original: string;
  corrected: string;
  confidence: number;
  edits: number;
  type: 'spelling' | 'grammar' | 'semantic';
}

export class SearchSuggestionService {
  private client: Client;
  private logger: winston.Logger;
  private clusterService: ElasticsearchClusterService;
  private popularQueries: Map<string, PopularQuery> = new Map();
  private trendingQueries: Map<string, TrendingQuery> = new Map();
  private queryCorrections: Map<string, QueryCorrection[]> = new Map();
  private userPreferences: Map<string, any> = new Map();
  private suggestionCache: Map<string, any> = new Map();
  private cacheTimeout: number = 300000; // 5 minutes

  constructor(clusterService: ElasticsearchClusterService) {
    this.clusterService = clusterService;
    this.client = clusterService.getClient();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'search-suggestion' },
      transports: [
        new winston.transports.File({ filename: 'logs/search-suggestion-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/search-suggestion-combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });

    this.initializePopularQueries();
    this.setupCacheCleanup();
  }

  async getSuggestions(indexName: string, request: SuggestionRequest): Promise<SuggestionResponse> {
    try {
      const { text, configs, size = 10, includePopular = true, includeTrending = true, userContext } = request;
      const startTime = Date.now();

      // Check cache first
      const cacheKey = this.generateCacheKey(text, configs, userContext);
      const cached = this.suggestionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Get suggestions from multiple sources
      const [
        elasticSuggestions,
        popularSuggestions,
        trendingSuggestions,
        corrections,
        alternatives,
        personalizedSuggestions
      ] = await Promise.all([
        this.getElasticsearchSuggestions(indexName, text, configs),
        includePopular ? this.getPopularSuggestions(text, userContext) : [],
        includeTrending ? this.getTrendingSuggestions(text, userContext) : [],
        this.getSpellCorrections(text),
        this.getSemanticAlternatives(text),
        userContext?.userId ? this.getPersonalizedSuggestions(text, userContext.userId) : []
      ]);

      // Combine and rank all suggestions
      const combinedSuggestions = this.combineAndRankSuggestions([
        ...elasticSuggestions,
        ...personalizedSuggestions
      ], text, size);

      const response: SuggestionResponse = {
        suggestions: combinedSuggestions,
        popular: popularSuggestions,
        trending: trendingSuggestions,
        corrections: corrections,
        alternatives: alternatives,
        metadata: {
          took: Date.now() - startTime,
          total: combinedSuggestions.length,
          userContext
        }
      };

      // Cache the response
      this.suggestionCache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to get suggestions:', error);
      throw error;
    }
  }

  private async getElasticsearchSuggestions(
    indexName: string,
    text: string,
    configs: SuggestionConfig[]
  ): Promise<Suggestion[]> {
    try {
      const suggest: any = {};
      
      configs.forEach((config, index) => {
        const suggesterName = `suggester_${index}`;
        
        switch (config.type) {
          case 'term':
            suggest[suggesterName] = {
              text,
              term: {
                field: config.field,
                size: config.size,
                suggest_mode: config.suggestMode || 'popular',
                max_edits: config.maxErrors || 2,
                prefix_length: config.prefixLength || 1,
                min_word_length: config.minWordLength || 4,
                shard_size: config.shardSize || config.size * 5
              }
            };
            break;

          case 'phrase':
            suggest[suggesterName] = {
              text,
              phrase: {
                field: config.field,
                size: config.size,
                gram_size: config.gramSize || 3,
                real_word_error_likelihood: config.realWordErrorLikelihood || 0.95,
                confidence: config.confidence || 1.0,
                max_errors: config.maxErrors || 2,
                direct_generator: [{
                  field: config.field,
                  suggest_mode: config.suggestMode || 'always',
                  min_word_length: config.minWordLength || 1
                }],
                highlight: {
                  pre_tag: '<em>',
                  post_tag: '</em>'
                }
              }
            };
            break;

          case 'completion':
            suggest[suggesterName] = {
              prefix: text,
              completion: {
                field: config.field,
                size: config.size,
                skip_duplicates: true,
                contexts: config.contexts
              }
            };
            break;
        }
      });

      const response = await this.client.search({
        index: indexName,
        body: { suggest }
      });

      const suggestions: Suggestion[] = [];
      
      Object.keys(response.body.suggest).forEach(suggesterName => {
        const suggesterResults = response.body.suggest[suggesterName];
        const configIndex = parseInt(suggesterName.split('_')[1]);
        const config = configs[configIndex];
        
        suggesterResults.forEach((result: any) => {
          result.options.forEach((option: any) => {
            suggestions.push({
              text: option.text,
              score: option.score || option._score || 1,
              highlighted: option.highlighted || this.highlightText(option.text, text),
              frequency: option.freq,
              category: config.type,
              type: 'elasticsearch',
              metadata: {
                field: config.field,
                suggester: config.type
              }
            });
          });
        });
      });

      return suggestions;
    } catch (error) {
      this.logger.error('Failed to get Elasticsearch suggestions:', error);
      return [];
    }
  }

  private async getPopularSuggestions(text: string, userContext?: any): Promise<Suggestion[]> {
    const popularSuggestions: Suggestion[] = [];
    const lowerText = text.toLowerCase();
    
    for (const [query, data] of this.popularQueries.entries()) {
      if (query.toLowerCase().includes(lowerText) || lowerText.includes(query.toLowerCase())) {
        popularSuggestions.push({
          text: query,
          score: data.frequency / 100, // Normalize frequency
          frequency: data.frequency,
          category: data.category,
          type: 'popular',
          highlighted: this.highlightText(query, text)
        });
      }
    }

    return popularSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private async getTrendingSuggestions(text: string, userContext?: any): Promise<Suggestion[]> {
    const trendingSuggestions: Suggestion[] = [];
    const lowerText = text.toLowerCase();
    
    for (const [query, data] of this.trendingQueries.entries()) {
      if (query.toLowerCase().includes(lowerText) || lowerText.includes(query.toLowerCase())) {
        trendingSuggestions.push({
          text: query,
          score: data.growth,
          category: data.category,
          type: 'trending',
          highlighted: this.highlightText(query, text),
          metadata: {
            growth: data.growth,
            volume: data.volume,
            timeframe: data.timeframe
          }
        });
      }
    }

    return trendingSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private async getSpellCorrections(text: string): Promise<Suggestion[]> {
    const corrections = this.queryCorrections.get(text.toLowerCase()) || [];
    
    return corrections.map(correction => ({
      text: correction.corrected,
      score: correction.confidence,
      type: 'correction',
      highlighted: this.highlightText(correction.corrected, text),
      metadata: {
        original: correction.original,
        edits: correction.edits,
        correctionType: correction.type
      }
    }));
  }

  private async getSemanticAlternatives(text: string): Promise<Suggestion[]> {
    // This would typically use NLP models or synonym dictionaries
    // Simplified implementation here
    const alternatives: Suggestion[] = [];
    
    const synonyms: { [key: string]: string[] } = {
      'search': ['find', 'lookup', 'query', 'discover'],
      'buy': ['purchase', 'acquire', 'get', 'obtain'],
      'fast': ['quick', 'rapid', 'swift', 'speedy'],
      'good': ['excellent', 'great', 'quality', 'superior']
    };

    const words = text.toLowerCase().split(' ');
    
    for (const word of words) {
      if (synonyms[word]) {
        for (const synonym of synonyms[word]) {
          const alternativeText = text.replace(new RegExp(word, 'gi'), synonym);
          alternatives.push({
            text: alternativeText,
            score: 0.8,
            type: 'semantic',
            highlighted: this.highlightText(alternativeText, text),
            metadata: {
              original: word,
              synonym
            }
          });
        }
      }
    }

    return alternatives.slice(0, 3);
  }

  private async getPersonalizedSuggestions(text: string, userId: string): Promise<Suggestion[]> {
    const userPrefs = this.userPreferences.get(userId);
    if (!userPrefs) return [];

    const personalizedSuggestions: Suggestion[] = [];
    
    // Use user's search history and preferences
    if (userPrefs.searchHistory) {
      for (const historyItem of userPrefs.searchHistory) {
        if (historyItem.query.toLowerCase().includes(text.toLowerCase())) {
          personalizedSuggestions.push({
            text: historyItem.query,
            score: historyItem.frequency * 1.2, // Boost personal queries
            type: 'personalized',
            highlighted: this.highlightText(historyItem.query, text),
            metadata: {
              personal: true,
              lastUsed: historyItem.lastUsed
            }
          });
        }
      }
    }

    return personalizedSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private combineAndRankSuggestions(
    suggestions: Suggestion[],
    originalText: string,
    size: number
  ): Suggestion[] {
    // Remove duplicates
    const uniqueSuggestions = new Map<string, Suggestion>();
    
    for (const suggestion of suggestions) {
      const key = suggestion.text.toLowerCase();
      const existing = uniqueSuggestions.get(key);
      
      if (!existing || suggestion.score > existing.score) {
        uniqueSuggestions.set(key, suggestion);
      }
    }

    // Apply ranking algorithm
    const rankedSuggestions = Array.from(uniqueSuggestions.values())
      .map(suggestion => ({
        ...suggestion,
        score: this.calculateFinalScore(suggestion, originalText)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, size);

    return rankedSuggestions;
  }

  private calculateFinalScore(suggestion: Suggestion, originalText: string): number {
    let score = suggestion.score;

    // Boost based on suggestion type
    const typeBoosts: { [key: string]: number } = {
      'completion': 1.5,
      'popular': 1.3,
      'personalized': 1.4,
      'trending': 1.2,
      'elasticsearch': 1.1,
      'correction': 0.9,
      'semantic': 0.8
    };

    score *= typeBoosts[suggestion.type] || 1.0;

    // Boost based on text similarity
    const similarity = this.calculateTextSimilarity(suggestion.text, originalText);
    score *= (1 + similarity * 0.5);

    // Boost based on frequency if available
    if (suggestion.frequency && suggestion.frequency > 0) {
      score *= Math.log(suggestion.frequency + 1) * 0.1;
    }

    return score;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const set1 = new Set(text1.toLowerCase().split(''));
    const set2 = new Set(text2.toLowerCase().split(''));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private highlightText(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  async updatePopularQueries(queries: { query: string; frequency: number; category?: string }[]): Promise<void> {
    try {
      for (const queryData of queries) {
        this.popularQueries.set(queryData.query.toLowerCase(), {
          query: queryData.query,
          frequency: queryData.frequency,
          trend: 0,
          category: queryData.category,
          lastSearched: new Date()
        });
      }
      
      this.logger.info(`Updated ${queries.length} popular queries`);
    } catch (error) {
      this.logger.error('Failed to update popular queries:', error);
      throw error;
    }
  }

  async updateTrendingQueries(queries: { query: string; growth: number; volume: number; category?: string; timeframe: string }[]): Promise<void> {
    try {
      for (const queryData of queries) {
        this.trendingQueries.set(queryData.query.toLowerCase(), queryData);
      }
      
      this.logger.info(`Updated ${queries.length} trending queries`);
    } catch (error) {
      this.logger.error('Failed to update trending queries:', error);
      throw error;
    }
  }

  async addQueryCorrection(correction: QueryCorrection): Promise<void> {
    try {
      const key = correction.original.toLowerCase();
      const existing = this.queryCorrections.get(key) || [];
      
      existing.push(correction);
      
      // Keep only top 5 corrections per query
      existing.sort((a, b) => b.confidence - a.confidence);
      this.queryCorrections.set(key, existing.slice(0, 5));
      
      this.logger.info(`Added query correction: ${correction.original} -> ${correction.corrected}`);
    } catch (error) {
      this.logger.error('Failed to add query correction:', error);
      throw error;
    }
  }

  async updateUserPreferences(userId: string, preferences: any): Promise<void> {
    try {
      this.userPreferences.set(userId, preferences);
      this.logger.info(`Updated user preferences for: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to update user preferences:', error);
      throw error;
    }
  }

  private initializePopularQueries(): void {
    // Initialize with some default popular queries
    const defaultQueries = [
      { query: 'search', frequency: 1000, category: 'general' },
      { query: 'help', frequency: 800, category: 'support' },
      { query: 'login', frequency: 600, category: 'auth' },
      { query: 'settings', frequency: 500, category: 'config' },
      { query: 'dashboard', frequency: 450, category: 'navigation' }
    ];

    this.updatePopularQueries(defaultQueries);
  }

  private setupCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.suggestionCache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.suggestionCache.delete(key);
        }
      }
    }, this.cacheTimeout);
  }

  private generateCacheKey(text: string, configs: SuggestionConfig[], userContext?: any): string {
    const configKey = configs.map(c => `${c.type}-${c.field}-${c.size}`).join('|');
    const contextKey = userContext ? JSON.stringify(userContext) : '';
    return `${text}-${configKey}-${contextKey}`;
  }

  async getSuggestionAnalytics(): Promise<{
    totalSuggestions: number;
    suggestionTypes: { [type: string]: number };
    popularQueries: PopularQuery[];
    trendingQueries: TrendingQuery[];
    cacheHitRate: number;
  }> {
    return {
      totalSuggestions: this.suggestionCache.size,
      suggestionTypes: {
        popular: this.popularQueries.size,
        trending: this.trendingQueries.size,
        corrections: this.queryCorrections.size
      },
      popularQueries: Array.from(this.popularQueries.values()).slice(0, 20),
      trendingQueries: Array.from(this.trendingQueries.values()).slice(0, 10),
      cacheHitRate: 0.85 // Would be calculated from actual cache hits/misses
    };
  }

  clearCache(): void {
    this.suggestionCache.clear();
    this.logger.info('Suggestion cache cleared');
  }

  clearAllData(): void {
    this.suggestionCache.clear();
    this.popularQueries.clear();
    this.trendingQueries.clear();
    this.queryCorrections.clear();
    this.userPreferences.clear();
    this.logger.info('All suggestion data cleared');
  }
}

// Default suggestion configurations
export const defaultSuggestionConfigs: { [key: string]: SuggestionConfig[] } = {
  standard: [
    {
      type: 'completion',
      field: 'title.completion',
      size: 5
    },
    {
      type: 'term',
      field: 'title',
      size: 3,
      suggestMode: 'popular'
    }
  ],
  comprehensive: [
    {
      type: 'completion',
      field: 'title.completion',
      size: 8
    },
    {
      type: 'phrase',
      field: 'content',
      size: 5,
      confidence: 0.7
    },
    {
      type: 'term',
      field: 'tags',
      size: 4,
      suggestMode: 'always'
    }
  ],
  contextual: [
    {
      type: 'completion',
      field: 'title.completion',
      size: 10,
      contexts: {
        category: ['technology', 'business'],
        language: ['en']
      }
    }
  ]
};
