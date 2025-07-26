import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import { ElasticsearchClusterService } from './ElasticsearchClusterService';

interface ScoringModel {
  id: string;
  name: string;
  description: string;
  version: string;
  fields: ScoringField[];
  boosts: FieldBoost[];
  functions: ScoringFunction[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  performance: ModelPerformance;
}

interface ScoringField {
  field: string;
  type: 'text' | 'keyword' | 'number' | 'date' | 'boolean';
  weight: number;
  analyzer?: string;
  boost?: number;
  minimumShouldMatch?: string;
  operator?: 'and' | 'or';
  slop?: number;
  tieBreaker?: number;
}

interface FieldBoost {
  field: string;
  boost: number;
  condition?: any;
}

interface ScoringFunction {
  type: 'field_value_factor' | 'script_score' | 'random_score' | 'decay' | 'boost_mode';
  field?: string;
  factor?: number;
  modifier?: 'none' | 'log' | 'log1p' | 'log2p' | 'ln' | 'ln1p' | 'ln2p' | 'square' | 'sqrt' | 'reciprocal';
  missing?: number;
  script?: string;
  params?: { [key: string]: any };
  decay?: {
    function: 'linear' | 'exp' | 'gauss';
    origin: any;
    scale: any;
    offset?: any;
    decay?: number;
  };
  weight?: number;
  filter?: any;
}

interface ModelPerformance {
  precision: number;
  recall: number;
  f1Score: number;
  ndcg: number;
  mrr: number;
  averagePrecision: number;
  clickThroughRate: number;
  conversionRate: number;
  userSatisfaction: number;
}

interface RelevanceJudgment {
  queryId: string;
  documentId: string;
  relevanceScore: number; // 0-3 scale (0: irrelevant, 1: somewhat relevant, 2: relevant, 3: highly relevant)
  annotatorId: string;
  timestamp: Date;
  feedback?: string;
}

interface QueryTestCase {
  queryId: string;
  query: string;
  expectedResults: Array<{
    documentId: string;
    expectedRank: number;
    expectedScore: number;
  }>;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  createdBy: string;
  createdAt: Date;
}

interface ABTestConfig {
  testId: string;
  name: string;
  description: string;
  controlModel: string;
  testModel: string;
  trafficSplit: number; // 0-100 percentage for test model
  startDate: Date;
  endDate: Date;
  metrics: string[];
  isActive: boolean;
}

export class RelevanceScoringService {
  private client: Client;
  private logger: winston.Logger;
  private clusterService: ElasticsearchClusterService;
  private scoringModels: Map<string, ScoringModel> = new Map();
  private activeModelId?: string;
  private judgmentsIndex: string = 'relevance-judgments';
  private testCasesIndex: string = 'query-test-cases';

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
      defaultMeta: { service: 'relevance-scoring' },
      transports: [
        new winston.transports.File({ filename: 'logs/relevance-scoring-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/relevance-scoring-combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });

    this.initializeIndices();
    this.loadDefaultModels();
  }

  private async initializeIndices(): Promise<void> {
    try {
      // Create relevance judgments index
      const judgmentsExists = await this.client.indices.exists({ index: this.judgmentsIndex });
      if (!judgmentsExists.body) {
        await this.client.indices.create({
          index: this.judgmentsIndex,
          body: {
            mappings: {
              properties: {
                queryId: { type: 'keyword' },
                documentId: { type: 'keyword' },
                relevanceScore: { type: 'integer' },
                annotatorId: { type: 'keyword' },
                timestamp: { type: 'date' },
                feedback: { type: 'text' }
              }
            }
          }
        });
      }

      // Create test cases index
      const testCasesExists = await this.client.indices.exists({ index: this.testCasesIndex });
      if (!testCasesExists.body) {
        await this.client.indices.create({
          index: this.testCasesIndex,
          body: {
            mappings: {
              properties: {
                queryId: { type: 'keyword' },
                query: { type: 'text' },
                expectedResults: {
                  type: 'nested',
                  properties: {
                    documentId: { type: 'keyword' },
                    expectedRank: { type: 'integer' },
                    expectedScore: { type: 'float' }
                  }
                },
                category: { type: 'keyword' },
                difficulty: { type: 'keyword' },
                createdBy: { type: 'keyword' },
                createdAt: { type: 'date' }
              }
            }
          }
        });
      }

      this.logger.info('Relevance scoring indices initialized');
    } catch (error) {
      this.logger.error('Failed to initialize indices:', error);
      throw error;
    }
  }

  private loadDefaultModels(): void {
    // Default BM25 model
    const bm25Model: ScoringModel = {
      id: 'bm25-default',
      name: 'BM25 Default',
      description: 'Standard BM25 scoring with default parameters',
      version: '1.0',
      fields: [
        { field: 'title', type: 'text', weight: 2.0, boost: 1.5 },
        { field: 'content', type: 'text', weight: 1.0, boost: 1.0 },
        { field: 'tags', type: 'keyword', weight: 1.2, boost: 1.2 }
      ],
      boosts: [],
      functions: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      performance: {
        precision: 0.75,
        recall: 0.68,
        f1Score: 0.71,
        ndcg: 0.82,
        mrr: 0.79,
        averagePrecision: 0.73,
        clickThroughRate: 0.15,
        conversionRate: 0.03,
        userSatisfaction: 0.77
      }
    };

    // Enhanced relevance model
    const enhancedModel: ScoringModel = {
      id: 'enhanced-relevance',
      name: 'Enhanced Relevance',
      description: 'Advanced scoring with popularity and recency boosts',
      version: '1.0',
      fields: [
        { field: 'title', type: 'text', weight: 2.5, boost: 2.0 },
        { field: 'content', type: 'text', weight: 1.0, boost: 1.0 },
        { field: 'summary', type: 'text', weight: 1.5, boost: 1.3 }
      ],
      boosts: [
        { field: 'popularity_score', boost: 1.5 },
        { field: 'quality_score', boost: 1.3 }
      ],
      functions: [
        {
          type: 'field_value_factor',
          field: 'view_count',
          factor: 1.2,
          modifier: 'log1p',
          missing: 1
        },
        {
          type: 'decay',
          field: 'created_at',
          decay: {
            function: 'gauss',
            origin: 'now',
            scale: '30d',
            decay: 0.5
          },
          weight: 1.5
        }
      ],
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      performance: {
        precision: 0.82,
        recall: 0.74,
        f1Score: 0.78,
        ndcg: 0.88,
        mrr: 0.85,
        averagePrecision: 0.80,
        clickThroughRate: 0.22,
        conversionRate: 0.05,
        userSatisfaction: 0.84
      }
    };

    this.scoringModels.set(bm25Model.id, bm25Model);
    this.scoringModels.set(enhancedModel.id, enhancedModel);
    this.activeModelId = bm25Model.id;
  }

  async createScoringModel(model: Omit<ScoringModel, 'id' | 'createdAt' | 'updatedAt' | 'performance'>): Promise<ScoringModel> {
    try {
      const scoringModel: ScoringModel = {
        ...model,
        id: this.generateModelId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        performance: {
          precision: 0,
          recall: 0,
          f1Score: 0,
          ndcg: 0,
          mrr: 0,
          averagePrecision: 0,
          clickThroughRate: 0,
          conversionRate: 0,
          userSatisfaction: 0
        }
      };

      this.scoringModels.set(scoringModel.id, scoringModel);
      this.logger.info(`Scoring model created: ${scoringModel.id}`);
      
      return scoringModel;
    } catch (error) {
      this.logger.error('Failed to create scoring model:', error);
      throw error;
    }
  }

  async updateScoringModel(modelId: string, updates: Partial<ScoringModel>): Promise<ScoringModel> {
    try {
      const existingModel = this.scoringModels.get(modelId);
      if (!existingModel) {
        throw new Error(`Scoring model not found: ${modelId}`);
      }

      const updatedModel: ScoringModel = {
        ...existingModel,
        ...updates,
        id: modelId,
        updatedAt: new Date()
      };

      this.scoringModels.set(modelId, updatedModel);
      this.logger.info(`Scoring model updated: ${modelId}`);
      
      return updatedModel;
    } catch (error) {
      this.logger.error('Failed to update scoring model:', error);
      throw error;
    }
  }

  async setActiveModel(modelId: string): Promise<void> {
    try {
      const model = this.scoringModels.get(modelId);
      if (!model) {
        throw new Error(`Scoring model not found: ${modelId}`);
      }

      // Deactivate current active model
      if (this.activeModelId) {
        const currentActive = this.scoringModels.get(this.activeModelId);
        if (currentActive) {
          currentActive.isActive = false;
          this.scoringModels.set(this.activeModelId, currentActive);
        }
      }

      // Activate new model
      model.isActive = true;
      this.activeModelId = modelId;
      this.scoringModels.set(modelId, model);

      this.logger.info(`Active scoring model changed to: ${modelId}`);
    } catch (error) {
      this.logger.error('Failed to set active model:', error);
      throw error;
    }
  }

  async applyScoring(indexName: string, query: any, modelId?: string): Promise<any> {
    try {
      const model = this.scoringModels.get(modelId || this.activeModelId || 'bm25-default');
      if (!model) {
        throw new Error('No scoring model available');
      }

      const scoredQuery = this.buildScoredQuery(query, model);
      
      const response = await this.client.search({
        index: indexName,
        body: scoredQuery
      });

      return response.body;
    } catch (error) {
      this.logger.error('Failed to apply scoring:', error);
      throw error;
    }
  }

  private buildScoredQuery(originalQuery: any, model: ScoringModel): any {
    const query = JSON.parse(JSON.stringify(originalQuery));

    // Apply field boosts
    if (model.fields.length > 0) {
      query.query = this.applyFieldBoosts(query.query, model.fields);
    }

    // Apply function scoring
    if (model.functions.length > 0) {
      query.query = {
        function_score: {
          query: query.query,
          functions: model.functions.map(fn => this.buildScoringFunction(fn)),
          score_mode: 'multiply',
          boost_mode: 'multiply'
        }
      };
    }

    return query;
  }

  private applyFieldBoosts(query: any, fields: ScoringField[]): any {
    if (query.multi_match) {
      // Apply field boosts to multi_match query
      const boostedFields = fields.map(field => 
        field.boost ? `${field.field}^${field.boost}` : field.field
      );
      
      return {
        ...query,
        multi_match: {
          ...query.multi_match,
          fields: boostedFields
        }
      };
    }

    if (query.bool) {
      // Apply boosts to bool query clauses
      return {
        ...query,
        bool: {
          ...query.bool,
          should: query.bool.should?.map((clause: any) => 
            this.applyBoostToClause(clause, fields)
          ),
          must: query.bool.must?.map((clause: any) => 
            this.applyBoostToClause(clause, fields)
          )
        }
      };
    }

    return query;
  }

  private applyBoostToClause(clause: any, fields: ScoringField[]): any {
    if (clause.match) {
      const field = Object.keys(clause.match)[0];
      const fieldConfig = fields.find(f => f.field === field);
      
      if (fieldConfig && fieldConfig.boost) {
        return {
          match: {
            [field]: {
              ...clause.match[field],
              boost: fieldConfig.boost
            }
          }
        };
      }
    }

    return clause;
  }

  private buildScoringFunction(func: ScoringFunction): any {
    switch (func.type) {
      case 'field_value_factor':
        return {
          field_value_factor: {
            field: func.field,
            factor: func.factor || 1.0,
            modifier: func.modifier || 'none',
            missing: func.missing || 1
          },
          weight: func.weight || 1.0
        };

      case 'script_score':
        return {
          script_score: {
            script: {
              source: func.script,
              params: func.params || {}
            }
          },
          weight: func.weight || 1.0
        };

      case 'decay':
        if (!func.decay || !func.field) {
          throw new Error('Decay function requires field and decay configuration');
        }
        
        return {
          [func.decay.function]: {
            [func.field]: {
              origin: func.decay.origin,
              scale: func.decay.scale,
              offset: func.decay.offset,
              decay: func.decay.decay || 0.5
            }
          },
          weight: func.weight || 1.0
        };

      case 'random_score':
        return {
          random_score: {
            seed: func.params?.seed || Date.now()
          },
          weight: func.weight || 1.0
        };

      default:
        throw new Error(`Unsupported scoring function type: ${func.type}`);
    }
  }

  async addRelevanceJudgment(judgment: Omit<RelevanceJudgment, 'timestamp'>): Promise<void> {
    try {
      const relevanceJudgment: RelevanceJudgment = {
        ...judgment,
        timestamp: new Date()
      };

      await this.client.index({
        index: this.judgmentsIndex,
        body: relevanceJudgment
      });

      this.logger.info(`Relevance judgment added for query: ${judgment.queryId}`);
    } catch (error) {
      this.logger.error('Failed to add relevance judgment:', error);
      throw error;
    }
  }

  async addTestCase(testCase: Omit<QueryTestCase, 'queryId' | 'createdAt'>): Promise<QueryTestCase> {
    try {
      const queryTestCase: QueryTestCase = {
        ...testCase,
        queryId: this.generateQueryId(),
        createdAt: new Date()
      };

      await this.client.index({
        index: this.testCasesIndex,
        body: queryTestCase
      });

      this.logger.info(`Test case added: ${queryTestCase.queryId}`);
      return queryTestCase;
    } catch (error) {
      this.logger.error('Failed to add test case:', error);
      throw error;
    }
  }

  async evaluateModel(modelId: string, testQueries?: string[]): Promise<ModelPerformance> {
    try {
      const model = this.scoringModels.get(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      // Get test cases to evaluate
      const testCases = await this.getTestCases(testQueries);
      
      let totalPrecision = 0;
      let totalRecall = 0;
      let totalNDCG = 0;
      let totalMRR = 0;
      let validEvaluations = 0;

      for (const testCase of testCases) {
        try {
          const results = await this.applyScoring('search-index', { 
            query: { match: { _all: testCase.query } }
          }, modelId);

          const metrics = this.calculateMetrics(results.hits.hits, testCase.expectedResults);
          
          totalPrecision += metrics.precision;
          totalRecall += metrics.recall;
          totalNDCG += metrics.ndcg;
          totalMRR += metrics.mrr;
          validEvaluations++;
        } catch (error) {
          this.logger.warn(`Failed to evaluate test case ${testCase.queryId}:`, error);
        }
      }

      const performance: ModelPerformance = {
        precision: validEvaluations > 0 ? totalPrecision / validEvaluations : 0,
        recall: validEvaluations > 0 ? totalRecall / validEvaluations : 0,
        f1Score: 0, // Will be calculated from precision and recall
        ndcg: validEvaluations > 0 ? totalNDCG / validEvaluations : 0,
        mrr: validEvaluations > 0 ? totalMRR / validEvaluations : 0,
        averagePrecision: 0, // Would require more complex calculation
        clickThroughRate: model.performance.clickThroughRate, // From analytics
        conversionRate: model.performance.conversionRate, // From analytics
        userSatisfaction: model.performance.userSatisfaction // From user feedback
      };

      performance.f1Score = performance.precision + performance.recall > 0 
        ? 2 * (performance.precision * performance.recall) / (performance.precision + performance.recall)
        : 0;

      // Update model performance
      model.performance = performance;
      model.updatedAt = new Date();
      this.scoringModels.set(modelId, model);

      this.logger.info(`Model evaluation completed for: ${modelId}`);
      return performance;
    } catch (error) {
      this.logger.error('Failed to evaluate model:', error);
      throw error;
    }
  }

  private async getTestCases(queryIds?: string[]): Promise<QueryTestCase[]> {
    const query = queryIds ? { terms: { queryId: queryIds } } : { match_all: {} };
    
    const response = await this.client.search({
      index: this.testCasesIndex,
      body: {
        query,
        size: 1000
      }
    });

    return response.body.hits.hits.map((hit: any) => hit._source);
  }

  private calculateMetrics(actualResults: any[], expectedResults: Array<{ documentId: string; expectedRank: number; expectedScore: number }>): {
    precision: number;
    recall: number;
    ndcg: number;
    mrr: number;
  } {
    const actualIds = actualResults.map(result => result._id);
    const expectedIds = expectedResults.map(result => result.documentId);
    
    // Calculate precision at k (k = 10)
    const k = Math.min(10, actualIds.length);
    const relevantRetrieved = actualIds.slice(0, k).filter(id => expectedIds.includes(id)).length;
    const precision = k > 0 ? relevantRetrieved / k : 0;
    
    // Calculate recall
    const totalRelevant = expectedIds.length;
    const recall = totalRelevant > 0 ? relevantRetrieved / totalRelevant : 0;
    
    // Calculate NDCG (simplified)
    let dcg = 0;
    let idcg = 0;
    
    for (let i = 0; i < k; i++) {
      const actualId = actualIds[i];
      const expectedResult = expectedResults.find(er => er.documentId === actualId);
      const relevance = expectedResult ? 1 : 0; // Simplified binary relevance
      
      dcg += relevance / Math.log2(i + 2);
      
      if (i < expectedIds.length) {
        idcg += 1 / Math.log2(i + 2); // Ideal relevance is 1
      }
    }
    
    const ndcg = idcg > 0 ? dcg / idcg : 0;
    
    // Calculate MRR
    let mrr = 0;
    for (let i = 0; i < actualIds.length; i++) {
      if (expectedIds.includes(actualIds[i])) {
        mrr = 1 / (i + 1);
        break;
      }
    }
    
    return { precision, recall, ndcg, mrr };
  }

  async getAllModels(): Promise<ScoringModel[]> {
    return Array.from(this.scoringModels.values());
  }

  async getModel(modelId: string): Promise<ScoringModel | null> {
    return this.scoringModels.get(modelId) || null;
  }

  async deleteModel(modelId: string): Promise<void> {
    if (this.activeModelId === modelId) {
      throw new Error('Cannot delete active model');
    }
    
    this.scoringModels.delete(modelId);
    this.logger.info(`Scoring model deleted: ${modelId}`);
  }

  private generateModelId(): string {
    return `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateQueryId(): string {
    return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
