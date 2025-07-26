import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import { ElasticsearchClusterService } from './ElasticsearchClusterService';

interface AutoCompleteConfig {
  field: string;
  analyzer?: string;
  max_expansions?: number;
  prefix_length?: number;
  fuzziness?: string | number;
  fuzzy_transpositions?: boolean;
  fuzzy_min_length?: number;
  fuzzy_prefix_length?: number;
  suggest_mode?: 'missing' | 'popular' | 'always';
  accuracy?: number;
  size?: number;
  shard_size?: number;
  confidence?: number;
  max_errors?: number;
  separator?: string;
  lowercase_terms?: boolean;
  max_determinized_states?: number;
}

interface CompletionSuggestion {
  text: string;
  highlighted: string;
  score: number;
  freq?: number;
  payload?: any;
}

interface AutoCompleteRequest {
  text: string;
  size?: number;
  contexts?: { [key: string]: string[] };
  fuzziness?: string | number;
  skip_duplicates?: boolean;
  regex?: string;
}

interface AutoCompleteResponse {
  suggestions: CompletionSuggestion[];
  took: number;
  total: number;
  corrections?: string[];
  alternatives?: string[];
}

interface PhraseCompletion {
  text: string;
  highlighted: string;
  score: number;
  collate_match?: boolean;
}

interface AutoCompleteAnalytics {
  query: string;
  suggestions: CompletionSuggestion[];
  selected?: string;
  timestamp: Date;
  user_id?: string;
  session_id?: string;
}

export class AutoCompleteService {
  private client: Client;
  private logger: winston.Logger;
  private clusterService: ElasticsearchClusterService;
  private analyticsData: AutoCompleteAnalytics[] = [];
  private queryFrequency: Map<string, number> = new Map();
  private popularSuggestions: Map<string, number> = new Map();

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
      defaultMeta: { service: 'auto-complete' },
      transports: [
        new winston.transports.File({ filename: 'logs/auto-complete-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/auto-complete-combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
  }

  async suggest(indexName: string, request: AutoCompleteRequest, config: AutoCompleteConfig): Promise<AutoCompleteResponse> {
    try {
      const { text, size = 10, contexts, fuzziness, skip_duplicates = true } = request;
      const startTime = Date.now();

      // Use multiple suggestion types for better results
      const suggestions = await Promise.all([
        this.getCompletionSuggestions(indexName, text, config, size, contexts),
        this.getTermSuggestions(indexName, text, config),
        this.getPhraseSuggestions(indexName, text, config)
      ]);

      const [completions, terms, phrases] = suggestions;
      
      // Combine and rank suggestions
      const combinedSuggestions = this.combineAndRankSuggestions(
        completions,
        terms,
        phrases,
        text,
        size,
        skip_duplicates
      );

      const took = Date.now() - startTime;

      // Track analytics
      this.trackQuery(text);
      this.trackAnalytics({
        query: text,
        suggestions: combinedSuggestions,
        timestamp: new Date()
      });

      return {
        suggestions: combinedSuggestions,
        took,
        total: combinedSuggestions.length,
        corrections: terms.map(t => t.text),
        alternatives: phrases.map(p => p.text)
      };
    } catch (error) {
      this.logger.error('Auto-complete suggestion failed:', error);
      throw error;
    }
  }

  private async getCompletionSuggestions(
    indexName: string,
    text: string,
    config: AutoCompleteConfig,
    size: number,
    contexts?: { [key: string]: string[] }
  ): Promise<CompletionSuggestion[]> {
    try {
      const suggester: any = {
        completion: {
          field: config.field,
          size,
          skip_duplicates: true
        }
      };

      if (contexts) {
        suggester.completion.contexts = contexts;
      }

      const response = await this.client.search({
        index: indexName,
        body: {
          suggest: {
            autocomplete: {
              prefix: text,
              ...suggester
            }
          }
        }
      });

      const suggestions = response.body.suggest.autocomplete[0].options;
      return suggestions.map((option: any) => ({
        text: option.text,
        highlighted: this.highlightMatch(option.text, text),
        score: option._score || 1,
        payload: option.payload
      }));
    } catch (error) {
      this.logger.error('Completion suggestions failed:', error);
      return [];
    }
  }

  private async getTermSuggestions(
    indexName: string,
    text: string,
    config: AutoCompleteConfig
  ): Promise<CompletionSuggestion[]> {
    try {
      const response = await this.client.search({
        index: indexName,
        body: {
          suggest: {
            term_suggestion: {
              text,
              term: {
                field: config.field,
                suggest_mode: config.suggest_mode || 'popular',
                size: 5,
                max_edits: config.max_errors || 2,
                prefix_length: config.fuzzy_prefix_length || 1,
                min_word_length: config.fuzzy_min_length || 4,
                shard_size: config.shard_size || 5
              }
            }
          }
        }
      });

      const suggestions = response.body.suggest.term_suggestion[0].options;
      return suggestions.map((option: any) => ({
        text: option.text,
        highlighted: this.highlightMatch(option.text, text),
        score: option.score,
        freq: option.freq
      }));
    } catch (error) {
      this.logger.error('Term suggestions failed:', error);
      return [];
    }
  }

  private async getPhraseSuggestions(
    indexName: string,
    text: string,
    config: AutoCompleteConfig
  ): Promise<CompletionSuggestion[]> {
    try {
      const response = await this.client.search({
        index: indexName,
        body: {
          suggest: {
            phrase_suggestion: {
              text,
              phrase: {
                field: config.field,
                size: 5,
                gram_size: 3,
                direct_generator: [
                  {
                    field: config.field,
                    suggest_mode: 'always',
                    min_word_length: 1
                  }
                ],
                highlight: {
                  pre_tag: '<em>',
                  post_tag: '</em>'
                },
                collate: {
                  query: {
                    source: {
                      match: {
                        [config.field]: {
                          query: '{{suggestion}}',
                          operator: 'and'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const suggestions = response.body.suggest.phrase_suggestion[0].options;
      return suggestions.map((option: any) => ({
        text: option.text,
        highlighted: option.highlighted || this.highlightMatch(option.text, text),
        score: option.score
      }));
    } catch (error) {
      this.logger.error('Phrase suggestions failed:', error);
      return [];
    }
  }

  private combineAndRankSuggestions(
    completions: CompletionSuggestion[],
    terms: CompletionSuggestion[],
    phrases: CompletionSuggestion[],
    originalText: string,
    size: number,
    skipDuplicates: boolean
  ): CompletionSuggestion[] {
    const allSuggestions: CompletionSuggestion[] = [];
    const seen = new Set<string>();

    // Add completions with highest priority
    for (const suggestion of completions) {
      const normalizedText = suggestion.text.toLowerCase();
      if (!skipDuplicates || !seen.has(normalizedText)) {
        allSuggestions.push({
          ...suggestion,
          score: suggestion.score * 1.5 // Boost completion suggestions
        });
        seen.add(normalizedText);
      }
    }

    // Add term suggestions
    for (const suggestion of terms) {
      const normalizedText = suggestion.text.toLowerCase();
      if (!skipDuplicates || !seen.has(normalizedText)) {
        allSuggestions.push({
          ...suggestion,
          score: suggestion.score * 1.2 // Moderate boost for term suggestions
        });
        seen.add(normalizedText);
      }
    }

    // Add phrase suggestions
    for (const suggestion of phrases) {
      const normalizedText = suggestion.text.toLowerCase();
      if (!skipDuplicates || !seen.has(normalizedText)) {
        allSuggestions.push(suggestion);
        seen.add(normalizedText);
      }
    }

    // Apply popularity boost
    for (const suggestion of allSuggestions) {
      const popularity = this.popularSuggestions.get(suggestion.text.toLowerCase()) || 0;
      suggestion.score += popularity * 0.1;
    }

    // Sort by score and return top results
    return allSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, size);
  }

  private highlightMatch(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  async buildCompletionIndex(
    sourceIndex: string,
    completionIndex: string,
    config: {
      sourceField: string;
      completionField: string;
      weightField?: string;
      contextFields?: { [key: string]: string };
      minFrequency?: number;
    }
  ): Promise<void> {
    try {
      const { sourceField, completionField, weightField, contextFields, minFrequency = 1 } = config;

      // Create completion index with proper mapping
      const mappings = {
        properties: {
          [completionField]: {
            type: 'completion',
            analyzer: 'simple',
            preserve_separators: true,
            preserve_position_increments: true,
            max_input_length: 50,
            contexts: contextFields ? Object.keys(contextFields).map(key => ({
              name: key,
              type: 'category'
            })) : undefined
          },
          frequency: { type: 'integer' },
          weight: { type: 'float' }
        }
      };

      await this.client.indices.create({
        index: completionIndex,
        body: {
          mappings,
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0
          }
        }
      });

      // Extract and index completion suggestions
      const response = await this.client.search({
        index: sourceIndex,
        body: {
          size: 0,
          aggs: {
            suggestions: {
              terms: {
                field: `${sourceField}.keyword`,
                size: 10000,
                min_doc_count: minFrequency
              }
            }
          }
        }
      });

      const buckets = response.body.aggregations.suggestions.buckets;
      const bulkBody: any[] = [];

      for (const bucket of buckets) {
        const suggestion: any = {
          [completionField]: {
            input: [bucket.key],
            weight: weightField ? bucket.doc_count : undefined,
            contexts: contextFields ? await this.extractContexts(sourceIndex, bucket.key, contextFields) : undefined
          },
          frequency: bucket.doc_count
        };

        bulkBody.push({ index: { _index: completionIndex } });
        bulkBody.push(suggestion);
      }

      if (bulkBody.length > 0) {
        await this.client.bulk({ body: bulkBody });
        await this.client.indices.refresh({ index: completionIndex });
      }

      this.logger.info(`Completion index built: ${completionIndex} with ${buckets.length} suggestions`);
    } catch (error) {
      this.logger.error('Failed to build completion index:', error);
      throw error;
    }
  }

  private async extractContexts(
    sourceIndex: string,
    term: string,
    contextFields: { [key: string]: string }
  ): Promise<{ [key: string]: string[] }> {
    const contexts: { [key: string]: string[] } = {};

    for (const [contextName, contextField] of Object.entries(contextFields)) {
      const response = await this.client.search({
        index: sourceIndex,
        body: {
          size: 0,
          query: {
            match: { [`${contextField}.keyword`]: term }
          },
          aggs: {
            contexts: {
              terms: {
                field: `${contextField}.keyword`,
                size: 10
              }
            }
          }
        }
      });

      const buckets = response.body.aggregations.contexts.buckets;
      contexts[contextName] = buckets.map((bucket: any) => bucket.key);
    }

    return contexts;
  }

  async updateCompletionSuggestion(
    completionIndex: string,
    suggestion: string,
    weight?: number,
    contexts?: { [key: string]: string[] }
  ): Promise<void> {
    try {
      const doc: any = {
        completion: {
          input: [suggestion],
          weight,
          contexts
        },
        frequency: 1,
        updated_at: new Date()
      };

      await this.client.index({
        index: completionIndex,
        id: Buffer.from(suggestion).toString('base64'),
        body: doc
      });

      this.logger.info(`Completion suggestion updated: ${suggestion}`);
    } catch (error) {
      this.logger.error('Failed to update completion suggestion:', error);
      throw error;
    }
  }

  async deleteCompletionSuggestion(completionIndex: string, suggestion: string): Promise<void> {
    try {
      await this.client.delete({
        index: completionIndex,
        id: Buffer.from(suggestion).toString('base64'),
        ignore: [404]
      });

      this.logger.info(`Completion suggestion deleted: ${suggestion}`);
    } catch (error) {
      this.logger.error('Failed to delete completion suggestion:', error);
      throw error;
    }
  }

  trackSelection(query: string, selectedSuggestion: string, userId?: string, sessionId?: string): void {
    // Update popularity
    const current = this.popularSuggestions.get(selectedSuggestion.toLowerCase()) || 0;
    this.popularSuggestions.set(selectedSuggestion.toLowerCase(), current + 1);

    // Track analytics
    const analyticsEntry = this.analyticsData.find(
      entry => entry.query === query && entry.timestamp.getTime() > Date.now() - 60000 // Within last minute
    );

    if (analyticsEntry) {
      analyticsEntry.selected = selectedSuggestion;
      analyticsEntry.user_id = userId;
      analyticsEntry.session_id = sessionId;
    }
  }

  private trackQuery(query: string): void {
    const normalizedQuery = query.toLowerCase().trim();
    const current = this.queryFrequency.get(normalizedQuery) || 0;
    this.queryFrequency.set(normalizedQuery, current + 1);
  }

  private trackAnalytics(analytics: AutoCompleteAnalytics): void {
    this.analyticsData.push(analytics);
    
    // Keep only last 10000 entries
    if (this.analyticsData.length > 10000) {
      this.analyticsData = this.analyticsData.slice(-10000);
    }
  }

  async getPopularQueries(limit: number = 20): Promise<Array<{ query: string; frequency: number }>> {
    return Array.from(this.queryFrequency.entries())
      .map(([query, frequency]) => ({ query, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  async getAnalytics(timeRange?: { from: Date; to: Date }): Promise<{
    totalQueries: number;
    uniqueQueries: number;
    averageSuggestions: number;
    clickThroughRate: number;
    popularSuggestions: Array<{ suggestion: string; selections: number }>;
  }> {
    let filteredAnalytics = this.analyticsData;

    if (timeRange) {
      filteredAnalytics = this.analyticsData.filter(
        entry => entry.timestamp >= timeRange.from && entry.timestamp <= timeRange.to
      );
    }

    const totalQueries = filteredAnalytics.length;
    const uniqueQueries = new Set(filteredAnalytics.map(entry => entry.query)).size;
    const totalSuggestions = filteredAnalytics.reduce((sum, entry) => sum + entry.suggestions.length, 0);
    const averageSuggestions = totalQueries > 0 ? totalSuggestions / totalQueries : 0;
    const clickThroughs = filteredAnalytics.filter(entry => entry.selected).length;
    const clickThroughRate = totalQueries > 0 ? clickThroughs / totalQueries : 0;

    const popularSuggestions = Array.from(this.popularSuggestions.entries())
      .map(([suggestion, selections]) => ({ suggestion, selections }))
      .sort((a, b) => b.selections - a.selections)
      .slice(0, 20);

    return {
      totalQueries,
      uniqueQueries,
      averageSuggestions,
      clickThroughRate,
      popularSuggestions
    };
  }

  clearAnalytics(): void {
    this.analyticsData = [];
    this.queryFrequency.clear();
    this.popularSuggestions.clear();
    this.logger.info('Auto-complete analytics cleared');
  }
}

// Default auto-complete configurations
export const defaultAutoCompleteConfigs = {
  standard: {
    field: 'title.completion',
    size: 10,
    fuzziness: 'AUTO',
    suggest_mode: 'popular' as const,
    accuracy: 0.7
  },
  fuzzy: {
    field: 'title.completion',
    size: 8,
    fuzziness: 2,
    fuzzy_min_length: 3,
    fuzzy_prefix_length: 1,
    suggest_mode: 'always' as const
  },
  contextual: {
    field: 'title.completion',
    size: 15,
    fuzziness: 'AUTO',
    suggest_mode: 'popular' as const,
    contexts: {
      category: ['technology', 'business', 'health'],
      language: ['en', 'vi']
    }
  }
};
