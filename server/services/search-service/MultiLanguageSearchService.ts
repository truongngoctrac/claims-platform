import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import { ElasticsearchClusterService } from './ElasticsearchClusterService';

interface LanguageConfig {
  code: string;
  name: string;
  analyzer: string;
  stemmer?: string;
  stopwords?: string[];
  synonyms?: { [key: string]: string[] };
  transliteration?: boolean;
  rtl?: boolean;
  characterFilters?: string[];
  tokenFilters?: string[];
}

interface TranslationMapping {
  sourceLanguage: string;
  targetLanguage: string;
  translations: { [key: string]: string };
  lastUpdated: Date;
}

interface MultiLanguageQuery {
  originalQuery: string;
  sourceLanguage: string;
  targetLanguages?: string[];
  autoDetectLanguage?: boolean;
  crossLanguageSearch?: boolean;
  transliterationEnabled?: boolean;
  boostNativeLanguage?: boolean;
}

interface LanguageDetectionResult {
  language: string;
  confidence: number;
  alternativeLanguages: Array<{ language: string; confidence: number }>;
}

interface MultiLanguageSearchResult {
  hits: any[];
  translations: { [language: string]: string };
  detectedLanguage?: LanguageDetectionResult;
  searchedLanguages: string[];
  took: number;
  total: number;
}

interface LanguageAnalyzer {
  name: string;
  tokenizer: string;
  char_filter?: string[];
  filter: string[];
}

export class MultiLanguageSearchService {
  private client: Client;
  private logger: winston.Logger;
  private clusterService: ElasticsearchClusterService;
  private languageConfigs: Map<string, LanguageConfig> = new Map();
  private translationMappings: Map<string, TranslationMapping> = new Map();
  private languageDetectionCache: Map<string, LanguageDetectionResult> = new Map();

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
      defaultMeta: { service: 'multi-language-search' },
      transports: [
        new winston.transports.File({ filename: 'logs/multi-language-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/multi-language-combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });

    this.initializeLanguageConfigs();
  }

  private initializeLanguageConfigs(): void {
    const languages: LanguageConfig[] = [
      {
        code: 'en',
        name: 'English',
        analyzer: 'english',
        stemmer: 'english',
        stopwords: ['a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with'],
        characterFilters: ['html_strip'],
        tokenFilters: ['lowercase', 'stop', 'porter_stem']
      },
      {
        code: 'vi',
        name: 'Vietnamese',
        analyzer: 'vietnamese',
        stopwords: ['và', 'của', 'có', 'được', 'trong', 'là', 'một', 'các', 'để', 'đã', 'cho', 'từ', 'như', 'về', 'với', 'này', 'đó', 'không', 'khi', 'theo', 'sau', 'nếu', 'trước', 'hay', 'nào', 'những', 'rằng', 'sẽ', 'còn', 'cũng'],
        characterFilters: ['html_strip'],
        tokenFilters: ['lowercase', 'stop'],
        transliteration: true
      },
      {
        code: 'zh',
        name: 'Chinese',
        analyzer: 'cjk',
        characterFilters: ['html_strip'],
        tokenFilters: ['cjk_width', 'lowercase', 'stop']
      },
      {
        code: 'ja',
        name: 'Japanese',
        analyzer: 'kuromoji',
        characterFilters: ['html_strip'],
        tokenFilters: ['kuromoji_baseform', 'kuromoji_part_of_speech', 'cjk_width', 'stop', 'lowercase']
      },
      {
        code: 'ko',
        name: 'Korean',
        analyzer: 'nori',
        characterFilters: ['html_strip'],
        tokenFilters: ['nori_part_of_speech', 'lowercase', 'stop']
      },
      {
        code: 'ar',
        name: 'Arabic',
        analyzer: 'arabic',
        stemmer: 'arabic',
        rtl: true,
        characterFilters: ['html_strip'],
        tokenFilters: ['lowercase', 'arabic_normalization', 'arabic_stem', 'stop']
      },
      {
        code: 'fr',
        name: 'French',
        analyzer: 'french',
        stemmer: 'french',
        characterFilters: ['html_strip'],
        tokenFilters: ['lowercase', 'elision', 'stop', 'french_stem']
      },
      {
        code: 'de',
        name: 'German',
        analyzer: 'german',
        stemmer: 'german',
        characterFilters: ['html_strip'],
        tokenFilters: ['lowercase', 'stop', 'german_normalization', 'german_stem']
      },
      {
        code: 'es',
        name: 'Spanish',
        analyzer: 'spanish',
        stemmer: 'spanish',
        characterFilters: ['html_strip'],
        tokenFilters: ['lowercase', 'stop', 'spanish_stem']
      },
      {
        code: 'ru',
        name: 'Russian',
        analyzer: 'russian',
        stemmer: 'russian',
        characterFilters: ['html_strip'],
        tokenFilters: ['lowercase', 'stop', 'russian_stem']
      }
    ];

    languages.forEach(lang => {
      this.languageConfigs.set(lang.code, lang);
    });

    this.initializeTranslationMappings();
  }

  private initializeTranslationMappings(): void {
    // Common translations for search terms
    const commonTranslations = [
      {
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        translations: {
          'search': 'tìm kiếm',
          'find': 'tìm',
          'help': 'trợ giúp',
          'settings': 'cài đặt',
          'user': 'người dùng',
          'login': 'đăng nhập',
          'password': 'mật khẩu',
          'email': 'email',
          'name': 'tên',
          'address': 'địa chỉ',
          'phone': 'điện thoại',
          'company': 'công ty',
          'product': 'sản phẩm',
          'service': 'dịch vụ',
          'price': 'giá',
          'order': 'đặt hàng',
          'payment': 'thanh toán',
          'health': 'sức khỏe',
          'healthcare': 'chăm sóc sức khỏe',
          'medical': 'y tế',
          'doctor': 'bác sĩ',
          'hospital': 'bệnh viện',
          'insurance': 'bảo hiểm',
          'claim': 'yêu cầu bồi thường'
        },
        lastUpdated: new Date()
      }
    ];

    commonTranslations.forEach(mapping => {
      const key = `${mapping.sourceLanguage}-${mapping.targetLanguage}`;
      this.translationMappings.set(key, mapping);
    });
  }

  async setupLanguageAnalyzers(indexName: string): Promise<void> {
    try {
      const analyzers: { [key: string]: LanguageAnalyzer } = {};
      const tokenFilters: { [key: string]: any } = {};
      const charFilters: { [key: string]: any } = {};

      // Create analyzers for each language
      for (const [code, config] of this.languageConfigs) {
        analyzers[`${code}_analyzer`] = {
          name: `${code}_analyzer`,
          tokenizer: config.analyzer === 'cjk' ? 'cjk' : 'standard',
          char_filter: config.characterFilters,
          filter: config.tokenFilters || ['lowercase']
        };

        // Create stop words filter for each language
        if (config.stopwords) {
          tokenFilters[`${code}_stop`] = {
            type: 'stop',
            stopwords: config.stopwords
          };
        }

        // Create stemmer filter if available
        if (config.stemmer) {
          tokenFilters[`${code}_stemmer`] = {
            type: 'stemmer',
            language: config.stemmer
          };
        }

        // Create synonym filter if available
        if (config.synonyms) {
          const synonymList = Object.entries(config.synonyms)
            .map(([key, synonyms]) => `${key},${synonyms.join(',')}`)
            .join('\n');
          
          tokenFilters[`${code}_synonyms`] = {
            type: 'synonym',
            synonyms: synonymList.split('\n')
          };
        }
      }

      // Update index settings
      await this.client.indices.close({ index: indexName });
      
      await this.client.indices.putSettings({
        index: indexName,
        body: {
          analysis: {
            analyzer: analyzers,
            filter: tokenFilters,
            char_filter: charFilters
          }
        }
      });

      await this.client.indices.open({ index: indexName });
      
      this.logger.info(`Language analyzers configured for index: ${indexName}`);
    } catch (error) {
      this.logger.error('Failed to setup language analyzers:', error);
      throw error;
    }
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    try {
      // Check cache first
      const cached = this.languageDetectionCache.get(text);
      if (cached) {
        return cached;
      }

      // Simple language detection based on character patterns
      const result = this.performLanguageDetection(text);
      
      // Cache the result
      this.languageDetectionCache.set(text, result);
      
      return result;
    } catch (error) {
      this.logger.error('Language detection failed:', error);
      return { language: 'en', confidence: 0.5, alternativeLanguages: [] };
    }
  }

  private performLanguageDetection(text: string): LanguageDetectionResult {
    const languagePatterns = {
      'vi': /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i,
      'zh': /[\u4e00-\u9fff]/,
      'ja': /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/,
      'ko': /[\uac00-\ud7af]/,
      'ar': /[\u0600-\u06ff]/,
      'ru': /[а-яё]/i,
      'th': /[\u0e00-\u0e7f]/,
      'hi': /[\u0900-\u097f]/
    };

    const scores: { [key: string]: number } = {};
    let totalChars = text.length;

    // Count matches for each language pattern
    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      const matches = text.match(new RegExp(pattern, 'g'));
      scores[lang] = matches ? matches.length / totalChars : 0;
    }

    // Default to English for Latin scripts
    scores['en'] = text.match(/[a-zA-Z]/g)?.length / totalChars || 0;

    // Find the highest scoring language
    const sortedScores = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort(([, a], [, b]) => b - a);

    if (sortedScores.length === 0) {
      return { language: 'en', confidence: 0.1, alternativeLanguages: [] };
    }

    const [topLanguage, topScore] = sortedScores[0];
    const alternativeLanguages = sortedScores.slice(1, 4).map(([lang, score]) => ({
      language: lang,
      confidence: score
    }));

    return {
      language: topLanguage,
      confidence: Math.min(topScore * 2, 1), // Boost confidence but cap at 1
      alternativeLanguages
    };
  }

  async translateQuery(query: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    try {
      const mappingKey = `${sourceLanguage}-${targetLanguage}`;
      const mapping = this.translationMappings.get(mappingKey);
      
      if (!mapping) {
        this.logger.warn(`No translation mapping found for ${mappingKey}`);
        return query;
      }

      let translatedQuery = query.toLowerCase();
      
      // Replace known translations
      for (const [source, target] of Object.entries(mapping.translations)) {
        const regex = new RegExp(`\\b${source}\\b`, 'gi');
        translatedQuery = translatedQuery.replace(regex, target);
      }

      return translatedQuery;
    } catch (error) {
      this.logger.error('Query translation failed:', error);
      return query;
    }
  }

  async search(indexName: string, query: MultiLanguageQuery): Promise<MultiLanguageSearchResult> {
    try {
      const startTime = Date.now();
      const {
        originalQuery,
        sourceLanguage,
        targetLanguages = [],
        autoDetectLanguage = true,
        crossLanguageSearch = false,
        transliterationEnabled = false,
        boostNativeLanguage = true
      } = query;

      let detectedLanguage: LanguageDetectionResult | undefined;
      let actualSourceLanguage = sourceLanguage;

      // Auto-detect language if enabled
      if (autoDetectLanguage && !sourceLanguage) {
        detectedLanguage = await this.detectLanguage(originalQuery);
        actualSourceLanguage = detectedLanguage.language;
      }

      const searchedLanguages = [actualSourceLanguage];
      const translations: { [language: string]: string } = {};
      const searchQueries: any[] = [];

      // Primary language search
      const primaryQuery = await this.buildLanguageSpecificQuery(
        originalQuery,
        actualSourceLanguage,
        boostNativeLanguage ? 2.0 : 1.0
      );
      searchQueries.push(primaryQuery);

      // Cross-language search
      if (crossLanguageSearch && targetLanguages.length > 0) {
        for (const targetLang of targetLanguages) {
          const translatedQuery = await this.translateQuery(originalQuery, actualSourceLanguage, targetLang);
          translations[targetLang] = translatedQuery;
          
          const langQuery = await this.buildLanguageSpecificQuery(
            translatedQuery,
            targetLang,
            0.8 // Lower boost for translated queries
          );
          searchQueries.push(langQuery);
          searchedLanguages.push(targetLang);
        }
      }

      // Execute search with all language variants
      const searchBody = {
        query: {
          bool: {
            should: searchQueries,
            minimum_should_match: 1
          }
        },
        highlight: {
          fields: {
            '*': {}
          },
          pre_tags: ['<mark>'],
          post_tags: ['</mark>']
        },
        size: 20
      };

      const response = await this.client.search({
        index: indexName,
        body: searchBody
      });

      return {
        hits: response.body.hits.hits,
        translations,
        detectedLanguage,
        searchedLanguages,
        took: Date.now() - startTime,
        total: response.body.hits.total.value
      };
    } catch (error) {
      this.logger.error('Multi-language search failed:', error);
      throw error;
    }
  }

  private async buildLanguageSpecificQuery(
    query: string,
    language: string,
    boost: number = 1.0
  ): Promise<any> {
    const langConfig = this.languageConfigs.get(language);
    const analyzer = langConfig ? `${language}_analyzer` : 'standard';

    return {
      bool: {
        should: [
          {
            multi_match: {
              query,
              fields: [`title.${language}^3`, `content.${language}^1`, `tags.${language}^2`],
              type: 'best_fields',
              analyzer,
              boost
            }
          },
          {
            multi_match: {
              query,
              fields: [`title.${language}`, `content.${language}`],
              type: 'phrase',
              analyzer,
              boost: boost * 1.5
            }
          },
          {
            multi_match: {
              query,
              fields: [`title.${language}`, `content.${language}`],
              type: 'phrase_prefix',
              analyzer,
              boost: boost * 0.8
            }
          }
        ]
      }
    };
  }

  async createMultiLanguageMapping(fields: string[]): Promise<any> {
    const mapping: any = {
      properties: {}
    };

    for (const field of fields) {
      mapping.properties[field] = {
        type: 'object',
        properties: {}
      };

      // Add language-specific fields
      for (const [langCode] of this.languageConfigs) {
        mapping.properties[field].properties[langCode] = {
          type: 'text',
          analyzer: `${langCode}_analyzer`,
          fields: {
            keyword: {
              type: 'keyword',
              ignore_above: 256
            },
            completion: {
              type: 'completion',
              analyzer: `${langCode}_analyzer`,
              contexts: [
                {
                  name: 'language',
                  type: 'category'
                }
              ]
            }
          }
        };
      }
    }

    // Add language detection field
    mapping.properties.detected_language = {
      type: 'keyword'
    };

    // Add original language field
    mapping.properties.original_language = {
      type: 'keyword'
    };

    return mapping;
  }

  async addTranslationMapping(sourceLanguage: string, targetLanguage: string, translations: { [key: string]: string }): Promise<void> {
    try {
      const key = `${sourceLanguage}-${targetLanguage}`;
      const existing = this.translationMappings.get(key);
      
      const mapping: TranslationMapping = {
        sourceLanguage,
        targetLanguage,
        translations: existing ? { ...existing.translations, ...translations } : translations,
        lastUpdated: new Date()
      };

      this.translationMappings.set(key, mapping);
      this.logger.info(`Translation mapping updated for ${key}: ${Object.keys(translations).length} translations`);
    } catch (error) {
      this.logger.error('Failed to add translation mapping:', error);
      throw error;
    }
  }

  async getSupportedLanguages(): Promise<LanguageConfig[]> {
    return Array.from(this.languageConfigs.values());
  }

  async getLanguageStatistics(indexName: string): Promise<{ [language: string]: { documentCount: number; percentage: number } }> {
    try {
      const response = await this.client.search({
        index: indexName,
        body: {
          size: 0,
          aggs: {
            languages: {
              terms: {
                field: 'detected_language',
                size: 20
              }
            }
          }
        }
      });

      const buckets = response.body.aggregations.languages.buckets;
      const total = response.body.hits.total.value;
      const statistics: { [language: string]: { documentCount: number; percentage: number } } = {};

      for (const bucket of buckets) {
        statistics[bucket.key] = {
          documentCount: bucket.doc_count,
          percentage: (bucket.doc_count / total) * 100
        };
      }

      return statistics;
    } catch (error) {
      this.logger.error('Failed to get language statistics:', error);
      throw error;
    }
  }

  async optimizeLanguageQueries(indexName: string, language: string): Promise<void> {
    try {
      const langConfig = this.languageConfigs.get(language);
      if (!langConfig) {
        throw new Error(`Language not supported: ${language}`);
      }

      // Create language-specific index template
      const templateName = `${indexName}-${language}-template`;
      const template = {
        index_patterns: [`${indexName}-${language}-*`],
        template: {
          settings: {
            analysis: {
              analyzer: {
                [`${language}_search`]: {
                  tokenizer: 'standard',
                  char_filter: langConfig.characterFilters || [],
                  filter: langConfig.tokenFilters || ['lowercase']
                }
              }
            }
          },
          mappings: await this.createMultiLanguageMapping(['title', 'content', 'summary'])
        }
      };

      await this.client.indices.putIndexTemplate({
        name: templateName,
        body: template
      });

      this.logger.info(`Language optimization completed for ${language}`);
    } catch (error) {
      this.logger.error(`Failed to optimize language queries for ${language}:`, error);
      throw error;
    }
  }

  clearLanguageCache(): void {
    this.languageDetectionCache.clear();
    this.logger.info('Language detection cache cleared');
  }
}
