import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import * as crypto from 'crypto-js';

export interface ComparisonResult {
  id: string;
  documentId1: string;
  documentId2: string;
  comparisonType: ComparisonType;
  timestamp: Date;
  similarity: number;
  differences: DocumentDifference[];
  summary: ComparisonSummary;
  status: 'processing' | 'completed' | 'failed';
  metadata: Record<string, any>;
}

export type ComparisonType = 
  | 'text_content'
  | 'visual_layout'
  | 'metadata'
  | 'structure'
  | 'semantic'
  | 'comprehensive';

export interface DocumentDifference {
  type: 'addition' | 'deletion' | 'modification' | 'formatting';
  location: {
    page?: number;
    position?: { x: number; y: number; width: number; height: number };
    textRange?: { start: number; end: number };
  };
  oldValue?: string;
  newValue?: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  category: string;
}

export interface ComparisonSummary {
  totalDifferences: number;
  criticalDifferences: number;
  addedContent: number;
  deletedContent: number;
  modifiedContent: number;
  formatChanges: number;
  overallSimilarity: number;
  keyChanges: string[];
  recommendedActions: string[];
}

export interface TextComparisonOptions {
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
  ignorePunctuation?: boolean;
  semanticAnalysis?: boolean;
  languageDetection?: boolean;
}

export interface VisualComparisonOptions {
  tolerance?: number;
  ignoreColors?: boolean;
  ignoreImages?: boolean;
  detectLayoutChanges?: boolean;
  pixelPerfect?: boolean;
}

export interface ComparisonConfig {
  textOptions?: TextComparisonOptions;
  visualOptions?: VisualComparisonOptions;
  weights?: {
    text: number;
    visual: number;
    structure: number;
    metadata: number;
  };
  outputFormat?: 'detailed' | 'summary' | 'visual_diff';
}

export class DocumentComparisonService extends EventEmitter {
  private comparisons: Map<string, ComparisonResult> = new Map();
  private defaultConfig: ComparisonConfig = {
    textOptions: {
      ignoreWhitespace: false,
      ignoreCase: false,
      ignorePunctuation: false,
      semanticAnalysis: true,
      languageDetection: true
    },
    visualOptions: {
      tolerance: 0.1,
      ignoreColors: false,
      ignoreImages: false,
      detectLayoutChanges: true,
      pixelPerfect: false
    },
    weights: {
      text: 0.4,
      visual: 0.3,
      structure: 0.2,
      metadata: 0.1
    },
    outputFormat: 'detailed'
  };

  constructor() {
    super();
  }

  async compareDocuments(
    documentId1: string,
    documentId2: string,
    comparisonType: ComparisonType = 'comprehensive',
    config: ComparisonConfig = {}
  ): Promise<string> {
    const comparisonId = uuidv4();
    const mergedConfig = { ...this.defaultConfig, ...config };

    const comparison: ComparisonResult = {
      id: comparisonId,
      documentId1,
      documentId2,
      comparisonType,
      timestamp: new Date(),
      similarity: 0,
      differences: [],
      summary: {
        totalDifferences: 0,
        criticalDifferences: 0,
        addedContent: 0,
        deletedContent: 0,
        modifiedContent: 0,
        formatChanges: 0,
        overallSimilarity: 0,
        keyChanges: [],
        recommendedActions: []
      },
      status: 'processing',
      metadata: { config: mergedConfig }
    };

    this.comparisons.set(comparisonId, comparison);
    
    // Start comparison process
    this.performComparison(comparisonId, mergedConfig);
    
    return comparisonId;
  }

  async getComparisonResult(comparisonId: string): Promise<ComparisonResult | null> {
    return this.comparisons.get(comparisonId) || null;
  }

  async getAllComparisons(limit: number = 50): Promise<ComparisonResult[]> {
    const results = Array.from(this.comparisons.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
    
    return results;
  }

  async deleteComparison(comparisonId: string): Promise<boolean> {
    return this.comparisons.delete(comparisonId);
  }

  private async performComparison(comparisonId: string, config: ComparisonConfig): Promise<void> {
    const comparison = this.comparisons.get(comparisonId);
    if (!comparison) return;

    try {
      this.emit('comparisonStarted', { comparisonId });

      // Get document contents (mock implementation)
      const document1 = await this.getDocumentContent(comparison.documentId1);
      const document2 = await this.getDocumentContent(comparison.documentId2);

      let differences: DocumentDifference[] = [];
      let overallSimilarity = 0;

      switch (comparison.comparisonType) {
        case 'text_content':
          differences = await this.compareTextContent(document1, document2, config.textOptions);
          break;
        case 'visual_layout':
          differences = await this.compareVisualLayout(document1, document2, config.visualOptions);
          break;
        case 'metadata':
          differences = await this.compareMetadata(document1, document2);
          break;
        case 'structure':
          differences = await this.compareStructure(document1, document2);
          break;
        case 'semantic':
          differences = await this.compareSemanticContent(document1, document2, config.textOptions);
          break;
        case 'comprehensive':
          differences = await this.performComprehensiveComparison(document1, document2, config);
          break;
      }

      // Calculate similarity
      overallSimilarity = this.calculateSimilarity(differences, document1, document2);

      // Generate summary
      const summary = this.generateComparisonSummary(differences, overallSimilarity);

      // Update comparison result
      comparison.differences = differences;
      comparison.similarity = overallSimilarity;
      comparison.summary = summary;
      comparison.status = 'completed';

      this.comparisons.set(comparisonId, comparison);
      this.emit('comparisonCompleted', { comparisonId, result: comparison });

    } catch (error) {
      comparison.status = 'failed';
      comparison.metadata.error = error.message;
      this.comparisons.set(comparisonId, comparison);
      this.emit('comparisonFailed', { comparisonId, error: error.message });
    }
  }

  private async compareTextContent(
    doc1: any, 
    doc2: any, 
    options: TextComparisonOptions = {}
  ): Promise<DocumentDifference[]> {
    const differences: DocumentDifference[] = [];
    
    let text1 = doc1.ocrText || doc1.textContent || '';
    let text2 = doc2.ocrText || doc2.textContent || '';

    // Apply text preprocessing based on options
    if (options.ignoreCase) {
      text1 = text1.toLowerCase();
      text2 = text2.toLowerCase();
    }

    if (options.ignoreWhitespace) {
      text1 = text1.replace(/\s+/g, ' ').trim();
      text2 = text2.replace(/\s+/g, ' ').trim();
    }

    if (options.ignorePunctuation) {
      text1 = text1.replace(/[^\w\s]/g, '');
      text2 = text2.replace(/[^\w\s]/g, '');
    }

    // Perform diff analysis
    const diffResult = this.performTextDiff(text1, text2);
    
    for (const diff of diffResult) {
      differences.push({
        type: diff.type as any,
        location: {
          textRange: { start: diff.start, end: diff.end }
        },
        oldValue: diff.oldValue,
        newValue: diff.newValue,
        confidence: diff.confidence,
        severity: this.determineSeverity(diff),
        description: diff.description,
        category: 'text_content'
      });
    }

    // Semantic analysis if enabled
    if (options.semanticAnalysis) {
      const semanticDiffs = await this.performSemanticAnalysis(text1, text2);
      differences.push(...semanticDiffs);
    }

    return differences;
  }

  private async compareVisualLayout(
    doc1: any, 
    doc2: any, 
    options: VisualComparisonOptions = {}
  ): Promise<DocumentDifference[]> {
    const differences: DocumentDifference[] = [];

    // Mock visual comparison implementation
    // In real implementation, would compare rendered images pixel by pixel
    
    const layoutChanges = [
      {
        type: 'modification',
        location: { page: 1, position: { x: 100, y: 200, width: 300, height: 50 } },
        description: 'Header position changed',
        severity: 'medium',
        confidence: 0.95
      },
      {
        type: 'addition',
        location: { page: 1, position: { x: 50, y: 500, width: 400, height: 100 } },
        description: 'New footer section added',
        severity: 'low',
        confidence: 0.87
      }
    ];

    for (const change of layoutChanges) {
      differences.push({
        type: change.type as any,
        location: change.location,
        confidence: change.confidence,
        severity: change.severity as any,
        description: change.description,
        category: 'visual_layout'
      });
    }

    return differences;
  }

  private async compareMetadata(doc1: any, doc2: any): Promise<DocumentDifference[]> {
    const differences: DocumentDifference[] = [];

    const metadataFields = ['title', 'author', 'createdDate', 'modifiedDate', 'tags', 'classification'];
    
    for (const field of metadataFields) {
      const value1 = doc1.metadata?.[field];
      const value2 = doc2.metadata?.[field];

      if (value1 !== value2) {
        differences.push({
          type: 'modification',
          location: {},
          oldValue: String(value1),
          newValue: String(value2),
          confidence: 1.0,
          severity: field === 'classification' ? 'high' : 'low',
          description: `Metadata field '${field}' changed`,
          category: 'metadata'
        });
      }
    }

    return differences;
  }

  private async compareStructure(doc1: any, doc2: any): Promise<DocumentDifference[]> {
    const differences: DocumentDifference[] = [];

    // Compare document structure (headings, paragraphs, tables, etc.)
    const structure1 = this.extractDocumentStructure(doc1);
    const structure2 = this.extractDocumentStructure(doc2);

    // Mock structure comparison
    if (structure1.headings.length !== structure2.headings.length) {
      differences.push({
        type: 'modification',
        location: {},
        oldValue: `${structure1.headings.length} headings`,
        newValue: `${structure2.headings.length} headings`,
        confidence: 1.0,
        severity: 'medium',
        description: 'Number of headings changed',
        category: 'structure'
      });
    }

    return differences;
  }

  private async compareSemanticContent(
    doc1: any, 
    doc2: any, 
    options: TextComparisonOptions = {}
  ): Promise<DocumentDifference[]> {
    const differences: DocumentDifference[] = [];

    // Extract key entities and concepts
    const entities1 = await this.extractEntities(doc1.ocrText || '');
    const entities2 = await this.extractEntities(doc2.ocrText || '');

    // Compare semantic meaning
    const semanticSimilarity = await this.calculateSemanticSimilarity(
      doc1.ocrText || '', 
      doc2.ocrText || ''
    );

    if (semanticSimilarity < 0.8) {
      differences.push({
        type: 'modification',
        location: {},
        confidence: 1 - semanticSimilarity,
        severity: semanticSimilarity < 0.5 ? 'high' : 'medium',
        description: `Semantic meaning differs significantly (similarity: ${(semanticSimilarity * 100).toFixed(1)}%)`,
        category: 'semantic'
      });
    }

    return differences;
  }

  private async performComprehensiveComparison(
    doc1: any, 
    doc2: any, 
    config: ComparisonConfig
  ): Promise<DocumentDifference[]> {
    const allDifferences: DocumentDifference[] = [];

    // Combine all comparison types with weights
    const textDiffs = await this.compareTextContent(doc1, doc2, config.textOptions);
    const visualDiffs = await this.compareVisualLayout(doc1, doc2, config.visualOptions);
    const metadataDiffs = await this.compareMetadata(doc1, doc2);
    const structureDiffs = await this.compareStructure(doc1, doc2);

    // Apply weights to differences
    textDiffs.forEach(diff => {
      diff.confidence *= config.weights?.text || 0.4;
      allDifferences.push(diff);
    });

    visualDiffs.forEach(diff => {
      diff.confidence *= config.weights?.visual || 0.3;
      allDifferences.push(diff);
    });

    metadataDiffs.forEach(diff => {
      diff.confidence *= config.weights?.metadata || 0.1;
      allDifferences.push(diff);
    });

    structureDiffs.forEach(diff => {
      diff.confidence *= config.weights?.structure || 0.2;
      allDifferences.push(diff);
    });

    return allDifferences;
  }

  private performTextDiff(text1: string, text2: string): any[] {
    // Mock text diff implementation
    // In real implementation, would use algorithms like Myers or similar
    return [
      {
        type: 'modification',
        start: 150,
        end: 200,
        oldValue: 'Bệnh viện Bạch Mai',
        newValue: 'Bệnh viện Việt Đức',
        confidence: 0.95,
        description: 'Hospital name changed'
      },
      {
        type: 'addition',
        start: 500,
        end: 550,
        newValue: 'Ghi chú bổ sung',
        confidence: 0.98,
        description: 'Additional note added'
      }
    ];
  }

  private async performSemanticAnalysis(text1: string, text2: string): Promise<DocumentDifference[]> {
    const differences: DocumentDifference[] = [];

    // Mock semantic analysis
    const semanticChanges = [
      {
        type: 'modification',
        description: 'Medical diagnosis terminology changed',
        severity: 'high',
        confidence: 0.92,
        category: 'semantic_medical'
      }
    ];

    for (const change of semanticChanges) {
      differences.push({
        type: change.type as any,
        location: {},
        confidence: change.confidence,
        severity: change.severity as any,
        description: change.description,
        category: change.category
      });
    }

    return differences;
  }

  private calculateSimilarity(differences: DocumentDifference[], doc1: any, doc2: any): number {
    if (differences.length === 0) return 1.0;

    // Calculate weighted similarity based on difference types and confidence
    let totalWeight = 0;
    let similaritySum = 0;

    for (const diff of differences) {
      const weight = this.getDifferenceWeight(diff);
      const impact = diff.confidence * this.getSeverityWeight(diff.severity);
      
      totalWeight += weight;
      similaritySum += weight * (1 - impact);
    }

    return totalWeight > 0 ? Math.max(0, similaritySum / totalWeight) : 1.0;
  }

  private generateComparisonSummary(
    differences: DocumentDifference[], 
    similarity: number
  ): ComparisonSummary {
    const summary: ComparisonSummary = {
      totalDifferences: differences.length,
      criticalDifferences: differences.filter(d => d.severity === 'critical').length,
      addedContent: differences.filter(d => d.type === 'addition').length,
      deletedContent: differences.filter(d => d.type === 'deletion').length,
      modifiedContent: differences.filter(d => d.type === 'modification').length,
      formatChanges: differences.filter(d => d.type === 'formatting').length,
      overallSimilarity: similarity,
      keyChanges: [],
      recommendedActions: []
    };

    // Generate key changes
    const significantDiffs = differences
      .filter(d => d.severity === 'high' || d.severity === 'critical')
      .slice(0, 5);
    
    summary.keyChanges = significantDiffs.map(d => d.description);

    // Generate recommendations
    if (summary.criticalDifferences > 0) {
      summary.recommendedActions.push('Review critical differences immediately');
    }
    if (similarity < 0.5) {
      summary.recommendedActions.push('Documents show significant changes - manual review required');
    }
    if (summary.totalDifferences > 20) {
      summary.recommendedActions.push('Consider document restructuring');
    }

    return summary;
  }

  // Helper methods
  private async getDocumentContent(documentId: string): Promise<any> {
    // Mock document retrieval
    return {
      id: documentId,
      ocrText: 'Sample OCR text content...',
      textContent: 'Sample text content...',
      metadata: {
        title: 'Sample Document',
        author: 'User',
        createdDate: new Date(),
        tags: ['medical', 'invoice']
      }
    };
  }

  private extractDocumentStructure(doc: any): any {
    return {
      headings: ['Heading 1', 'Heading 2'],
      paragraphs: 5,
      tables: 2,
      images: 3,
      pages: 1
    };
  }

  private async extractEntities(text: string): Promise<string[]> {
    // Mock entity extraction
    return ['Bệnh viện', 'Bác sĩ', 'Thuốc'];
  }

  private async calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
    // Mock semantic similarity calculation
    return 0.85;
  }

  private determineSeverity(diff: any): 'low' | 'medium' | 'high' | 'critical' {
    if (diff.confidence > 0.95 && diff.type === 'deletion') return 'high';
    if (diff.confidence > 0.9) return 'medium';
    return 'low';
  }

  private getDifferenceWeight(diff: DocumentDifference): number {
    const typeWeights = {
      'addition': 0.7,
      'deletion': 1.0,
      'modification': 0.9,
      'formatting': 0.3
    };
    return typeWeights[diff.type] || 0.5;
  }

  private getSeverityWeight(severity: string): number {
    const severityWeights = {
      'low': 0.2,
      'medium': 0.5,
      'high': 0.8,
      'critical': 1.0
    };
    return severityWeights[severity] || 0.5;
  }

  // Batch comparison methods
  async compareBatchDocuments(
    documentPairs: Array<{doc1: string, doc2: string}>,
    comparisonType: ComparisonType = 'comprehensive'
  ): Promise<string[]> {
    const comparisonIds: string[] = [];

    for (const pair of documentPairs) {
      const comparisonId = await this.compareDocuments(
        pair.doc1, 
        pair.doc2, 
        comparisonType
      );
      comparisonIds.push(comparisonId);
    }

    return comparisonIds;
  }

  async getComparisonReport(comparisonId: string): Promise<{
    summary: string;
    visualDiff?: string;
    exportData: any;
  } | null> {
    const comparison = this.comparisons.get(comparisonId);
    if (!comparison || comparison.status !== 'completed') return null;

    const summary = this.generateDetailedReport(comparison);
    
    return {
      summary,
      visualDiff: comparison.metadata.visualDiffPath,
      exportData: {
        comparisonId: comparison.id,
        timestamp: comparison.timestamp,
        similarity: comparison.similarity,
        differences: comparison.differences,
        summary: comparison.summary
      }
    };
  }

  private generateDetailedReport(comparison: ComparisonResult): string {
    const { summary, differences } = comparison;
    
    let report = `Document Comparison Report\n`;
    report += `==========================\n\n`;
    report += `Comparison ID: ${comparison.id}\n`;
    report += `Timestamp: ${comparison.timestamp.toISOString()}\n`;
    report += `Documents: ${comparison.documentId1} vs ${comparison.documentId2}\n`;
    report += `Overall Similarity: ${(comparison.similarity * 100).toFixed(2)}%\n\n`;
    
    report += `Summary:\n`;
    report += `- Total Differences: ${summary.totalDifferences}\n`;
    report += `- Critical Differences: ${summary.criticalDifferences}\n`;
    report += `- Added Content: ${summary.addedContent}\n`;
    report += `- Deleted Content: ${summary.deletedContent}\n`;
    report += `- Modified Content: ${summary.modifiedContent}\n\n`;
    
    if (summary.keyChanges.length > 0) {
      report += `Key Changes:\n`;
      summary.keyChanges.forEach((change, i) => {
        report += `${i + 1}. ${change}\n`;
      });
      report += `\n`;
    }
    
    if (summary.recommendedActions.length > 0) {
      report += `Recommended Actions:\n`;
      summary.recommendedActions.forEach((action, i) => {
        report += `${i + 1}. ${action}\n`;
      });
    }
    
    return report;
  }
}
