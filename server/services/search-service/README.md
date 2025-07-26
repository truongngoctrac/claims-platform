# Advanced Search Service

A comprehensive, production-ready search service built with Elasticsearch, featuring advanced capabilities for healthcare claim processing and multi-language support.

## 🚀 Features

### ✅ Core Infrastructure
- **Elasticsearch Cluster Setup** - Production-ready cluster management with health monitoring
- **Index Management & Optimization** - Automated index lifecycle management
- **Search Query Optimization** - Real-time query performance tuning
- **Performance Monitoring** - Comprehensive metrics and alerting

### ✅ Advanced Search Capabilities
- **Faceted Search** - Dynamic filtering with real-time facet updates
- **Auto-complete** - Intelligent suggestions with fuzzy matching
- **Search Analytics** - User behavior tracking and conversion analysis
- **Relevance Scoring** - ML-powered relevance tuning and A/B testing

### ✅ Intelligence Features
- **Search Suggestions** - Context-aware query recommendations
- **Multi-language Support** - 10+ languages with auto-detection
- **Query Optimization** - Automatic performance improvements
- **Real-time Analytics** - Live search metrics and insights

## 📁 Service Architecture

```
search-service/
├── ElasticsearchClusterService.ts      # 3.2.56 Elasticsearch cluster setup
├── IndexManagementService.ts           # 3.2.57 Index management & optimization
├── SearchQueryOptimizationService.ts   # 3.2.58 Search query optimization
├── FacetedSearchService.ts             # 3.2.59 Faceted search implementation
├── AutoCompleteService.ts              # 3.2.60 Auto-complete functionality
├── SearchAnalyticsService.ts           # 3.2.61 Search analytics tracking
├── RelevanceScoringService.ts          # 3.2.62 Relevance scoring tuning
├── SearchSuggestionService.ts          # 3.2.63 Search suggestion engine
├── MultiLanguageSearchService.ts       # 3.2.64 Multi-language search support
├── SearchPerformanceMonitoringService.ts # 3.2.65 Search performance monitoring
├── SearchService.ts                    # Main orchestrator service
└── README.md                          # This documentation
```

## 🛠 Installation & Setup

### Prerequisites
- Node.js 18+
- Elasticsearch 8.x cluster
- Redis (for caching)

### Environment Variables
```bash
# Elasticsearch Configuration
ELASTICSEARCH_NODES=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
ELASTICSEARCH_CA_CERT=/path/to/ca.crt

# Search Service Configuration
SEARCH_ANALYTICS_ENABLED=true
SEARCH_PERFORMANCE_MONITORING=true
SEARCH_MULTI_LANGUAGE_ENABLED=true
SEARCH_DEFAULT_LANGUAGE=en
```

### Installation
```bash
npm install @elastic/elasticsearch
```

## 🔧 API Endpoints

### Core Search
```http
POST /api/search
Content-Type: application/json

{
  "query": "healthcare claim",
  "index": "claims",
  "from": 0,
  "size": 20,
  "filters": [],
  "facets": {
    "status": { "field": "status", "type": "terms", "size": 10 },
    "date_range": { "field": "created_at", "type": "date_histogram", "interval": "month" }
  },
  "language": "vi",
  "autoComplete": true,
  "suggestions": true,
  "analytics": {
    "trackSearch": true,
    "userId": "user123",
    "sessionId": "session456"
  }
}
```

### Auto-complete
```http
GET /api/search/autocomplete?query=health&index=claims&size=10
```

### Search Suggestions
```http
GET /api/search/suggestions?query=claim&index=claims&size=10
```

### Index Management
```http
# Create Index
POST /api/search/indices
{
  "indexName": "healthcare-claims",
  "settings": {
    "numberOfShards": 3,
    "numberOfReplicas": 1,
    "refreshInterval": "1s"
  },
  "mappings": {
    "properties": {
      "title": { "type": "text", "analyzer": "vietnamese" },
      "content": { "type": "text", "analyzer": "vietnamese" },
      "status": { "type": "keyword" },
      "created_at": { "type": "date" }
    }
  }
}

# Get Index Stats
GET /api/search/indices/healthcare-claims/stats

# Optimize Index
POST /api/search/indices/healthcare-claims/optimize
{
  "maxSegments": 1
}
```

### Analytics & Monitoring
```http
# Get Search Metrics
GET /api/search/analytics/metrics?from=2024-01-01&to=2024-01-31

# Get Performance Report
GET /api/search/performance/report?period=day

# Get Active Alerts
GET /api/search/performance/alerts
```

### Relevance Scoring
```http
# Create Scoring Model
POST /api/search/scoring/models
{
  "name": "Healthcare Claims Scoring",
  "description": "Optimized scoring for healthcare claim searches",
  "version": "1.0",
  "fields": [
    { "field": "title", "type": "text", "weight": 2.0, "boost": 2.0 },
    { "field": "content", "type": "text", "weight": 1.0, "boost": 1.0 },
    { "field": "tags", "type": "keyword", "weight": 1.5, "boost": 1.3 }
  ],
  "functions": [
    {
      "type": "field_value_factor",
      "field": "popularity_score",
      "factor": 1.2,
      "modifier": "log1p"
    }
  ]
}

# Set Active Model
PUT /api/search/scoring/models/{modelId}/activate
```

### Multi-language Support
```http
# Setup Language Analyzers
POST /api/search/language/healthcare-claims/setup

# Get Supported Languages
GET /api/search/language/supported
```

## 🌐 Language Support

The service supports the following languages with specialized analyzers:

- **English** (en) - Standard + Porter stemming
- **Vietnamese** (vi) - Custom tokenization + stop words
- **Chinese** (zh) - CJK analyzer with segmentation
- **Japanese** (ja) - Kuromoji morphological analysis
- **Korean** (ko) - Nori analyzer
- **Arabic** (ar) - Arabic normalization + stemming
- **French** (fr) - French stemming + elision
- **German** (de) - German normalization + stemming
- **Spanish** (es) - Spanish stemming
- **Russian** (ru) - Russian stemming

## 📊 Performance Features

### Query Optimization
- Automatic wildcard → prefix conversion
- Boolean query clause reordering
- Source field filtering
- Aggregation size optimization
- Sort criteria limitation

### Performance Monitoring
- Real-time query performance tracking
- Slow query detection and alerting
- Cluster health monitoring
- Resource usage alerts
- Cache hit/miss ratio tracking

### Analytics
- User search behavior analysis
- Query popularity tracking
- Click-through rate measurement
- Conversion funnel analysis
- A/B testing support

## 🔍 Advanced Features

### Faceted Search
```javascript
const facetConfig = {
  status: {
    field: 'status.keyword',
    type: 'terms',
    size: 10
  },
  amount_range: {
    field: 'amount',
    type: 'range',
    ranges: [
      { key: 'low', to: 1000000 },
      { key: 'medium', from: 1000000, to: 5000000 },
      { key: 'high', from: 5000000 }
    ]
  },
  date_histogram: {
    field: 'created_at',
    type: 'date_histogram',
    interval: 'month'
  }
};
```

### Auto-complete with Context
```javascript
const autoCompleteConfig = {
  field: 'title.completion',
  size: 10,
  contexts: {
    category: ['medical', 'dental', 'vision'],
    language: ['en', 'vi']
  }
};
```

### Search Suggestions
```javascript
const suggestionTypes = [
  'completion',    // Fast prefix matching
  'phrase',        // Phrase suggestions with corrections
  'popular',       // Based on search frequency
  'trending',      // Rising search terms
  'personalized'   // User-specific suggestions
];
```

## 📈 Monitoring & Alerts

### Performance Thresholds
- Query execution time > 5s (High Alert)
- Query execution time > 10s (Critical Alert)
- Error rate > 5% (Medium Alert)
- Cache hit rate < 70% (Medium Alert)
- CPU usage > 80% (High Alert)
- Memory usage > 90% (Critical Alert)

### Health Checks
```http
GET /api/search/health
```

Response:
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "elasticsearch": "green",
    "analytics": true,
    "performance": true,
    "multiLanguage": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🚀 Usage Examples

### Basic Search
```javascript
const searchResult = await searchService.search({
  query: "bảo hiểm y tế",
  index: "healthcare-claims",
  language: "vi",
  facets: {
    status: { field: "status", type: "terms", size: 5 },
    provider: { field: "provider.keyword", type: "terms", size: 10 }
  }
});
```

### Multi-language Search
```javascript
const multiLangResult = await searchService.search({
  query: "health insurance",
  index: "claims",
  autoDetectLanguage: true,
  crossLanguageSearch: true,
  targetLanguages: ["vi", "zh", "ja"]
});
```

### Advanced Analytics
```javascript
const analytics = await searchService.getSearchMetrics({
  from: new Date('2024-01-01'),
  to: new Date('2024-01-31')
});

console.log(`
  Total Searches: ${analytics.totalSearches}
  Avg Response Time: ${analytics.averageResponseTime}ms
  Click-through Rate: ${(analytics.clickThroughRate * 100).toFixed(2)}%
  Popular Queries: ${analytics.popularQueries.slice(0, 5).map(q => q.query).join(', ')}
`);
```

## 🔧 Configuration

### Default Configuration
```javascript
const defaultConfig = {
  elasticsearch: {
    nodes: ['http://localhost:9200'],
    auth: { username: 'elastic', password: 'changeme' },
    ssl: { enabled: false }
  },
  analytics: { enabled: true, indexName: 'search-analytics' },
  performance: { monitoring: true, slowQueryThreshold: 1000 },
  multiLanguage: {
    enabled: true,
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'vi', 'zh', 'ja', 'ko', 'fr', 'de', 'es']
  }
};
```

## 🛡️ Security

- JWT-based authentication for all endpoints
- Role-based authorization (Admin required for management operations)
- Input validation with Zod schemas
- Rate limiting on search endpoints
- Audit logging for administrative actions

## 📚 Best Practices

### Index Design
- Use appropriate field types (text vs keyword)
- Configure proper analyzers for each language
- Set up completion fields for auto-complete
- Design facet fields as keywords
- Use nested objects for complex data structures

### Query Optimization
- Use filters instead of queries when exact matching
- Limit source fields to reduce network transfer
- Use reasonable page sizes (10-50 results)
- Implement client-side caching for frequent queries
- Monitor and tune slow queries

### Performance
- Regular index optimization (force merge)
- Monitor shard allocation and cluster health
- Use appropriate refresh intervals
- Implement circuit breakers for external dependencies
- Cache frequently accessed data

## 🔄 Deployment

### Production Checklist
- [ ] Elasticsearch cluster properly configured
- [ ] Security hardening (authentication, authorization, TLS)
- [ ] Monitoring and alerting set up
- [ ] Backup and recovery procedures
- [ ] Performance testing completed
- [ ] Log aggregation configured
- [ ] Health checks implemented

### Scaling Considerations
- Horizontal scaling with multiple Elasticsearch nodes
- Load balancing search requests
- Caching layer for frequently accessed data
- Asynchronous processing for heavy operations
- Database connection pooling

## 📞 Support

For technical support or questions about the search service:

1. Check the logs in `logs/search-*-*.log`
2. Monitor cluster health via `/api/search/health`
3. Review performance metrics in the admin dashboard
4. Contact the development team with specific error messages

## 🔄 Future Enhancements

- Machine learning-based query understanding
- Advanced semantic search capabilities
- Real-time indexing optimization
- Distributed caching across multiple regions
- GraphQL API support
- Voice search integration
- Visual search capabilities
