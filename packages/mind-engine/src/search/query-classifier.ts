/**
 * @module @kb-labs/mind-engine/search/query-classifier
 * Query classification for adaptive search weights
 */

export type QueryType = 'lookup' | 'concept' | 'code' | 'debug' | 'general';

export interface QueryClassification {
  type: QueryType;
  confidence: number;
  weights: {
    vector: number;
    keyword: number;
  };
  suggestedLimit: number;
}

interface QueryPattern {
  patterns: RegExp[];
  weights: { vector: number; keyword: number };
  suggestedLimit: number;
}

/**
 * Query patterns and their optimal search weights
 */
const QUERY_PATTERNS: Record<QueryType, QueryPattern> = {
  // Lookup: specific names, identifiers, exact matches
  lookup: {
    patterns: [
      /^[A-Z][a-zA-Z0-9]+$/,                    // PascalCase (class names)
      /^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/,   // camelCase (function names)
      /^\w+_\w+$/,                               // snake_case
      /^[A-Z][A-Z_0-9]+$/,                       // CONSTANT_CASE
      /^(get|set|create|delete|update|find)\w+$/i, // Method patterns
      /`\w+`/,                                   // Backtick identifiers
      /"\w+"|\'\w+\'/,                           // Quoted identifiers
      /^where\s+is\s+/i,                         // "where is X"
      /^find\s+(the\s+)?\w+/i,                   // "find X"
    ],
    weights: { vector: 0.3, keyword: 0.7 },
    suggestedLimit: 10,
  },

  // Concept: understanding, explanations, "how does X work"
  concept: {
    patterns: [
      /^how\s+(does|do|to|can|should)/i,
      /^what\s+(is|are|does)/i,
      /^why\s+(does|do|is|are)/i,
      /^explain\s+/i,
      /^describe\s+/i,
      /^when\s+should/i,
      /architecture|design|pattern|approach/i,
      /relationship\s+between/i,
      /difference\s+between/i,
    ],
    weights: { vector: 0.8, keyword: 0.2 },
    suggestedLimit: 15,
  },

  // Code: implementation details, writing code
  code: {
    patterns: [
      /implement/i,
      /function.*that/i,
      /create.*class/i,
      /write.*code/i,
      /example.*of/i,
      /syntax\s+for/i,
      /how.*implement/i,
      /code.*for/i,
      /snippet/i,
    ],
    weights: { vector: 0.6, keyword: 0.4 },
    suggestedLimit: 12,
  },

  // Debug: errors, bugs, fixes
  debug: {
    patterns: [
      /error/i,
      /bug/i,
      /fix/i,
      /crash/i,
      /fail/i,
      /not\s+work/i,
      /doesn.*t\s+work/i,
      /broken/i,
      /issue/i,
      /problem/i,
      /why\s+(does|is).*not/i,
      /undefined|null|NaN/i,
      /exception|throw/i,
    ],
    weights: { vector: 0.5, keyword: 0.5 },
    suggestedLimit: 15,
  },

  // General: default fallback
  general: {
    patterns: [],
    weights: { vector: 0.6, keyword: 0.4 },
    suggestedLimit: 12,
  },
};

/**
 * Priority order for classification (first match wins)
 */
const CLASSIFICATION_PRIORITY: QueryType[] = [
  'lookup',
  'debug',
  'code',
  'concept',
  'general',
];

/**
 * Classify a query to determine optimal search strategy
 */
export function classifyQuery(query: string): QueryClassification {
  const normalizedQuery = query.trim();

  // Special case: "What is X" where X is a specific identifier (PascalCase)
  // These should be treated as lookup queries, not concept queries
  const whatIsMatch = normalizedQuery.match(/^what\s+is\s+(?:the\s+)?([A-Z][a-zA-Z0-9]+)/i);
  if (whatIsMatch) {
    const identifier = whatIsMatch[1];
    // If it's a PascalCase identifier, treat as lookup
    if (/^[A-Z][a-z]+[A-Z]?\w*$/.test(identifier)) {
      return {
        type: 'lookup',
        confidence: 0.85,
        weights: { vector: 0.3, keyword: 0.7 },
        suggestedLimit: 10,
      };
    }
  }

  // Check for explicit identifiers in query (highest priority for lookup)
  if (hasExactIdentifier(normalizedQuery)) {
    const identifiers = extractIdentifiers(normalizedQuery);
    if (identifiers.length > 0) {
      return {
        type: 'lookup',
        confidence: 0.9,
        weights: { vector: 0.3, keyword: 0.7 },
        suggestedLimit: 10,
      };
    }
  }

  // Check each type in priority order
  for (const type of CLASSIFICATION_PRIORITY) {
    if (type === 'general') continue; // Skip general, it's fallback

    const pattern = QUERY_PATTERNS[type];
    const matchCount = pattern.patterns.filter(p => p.test(normalizedQuery)).length;

    if (matchCount > 0) {
      // Calculate confidence based on how many patterns matched
      const confidence = Math.min(0.95, 0.6 + matchCount * 0.15);

      return {
        type,
        confidence,
        weights: pattern.weights,
        suggestedLimit: pattern.suggestedLimit,
      };
    }
  }

  // Default to general
  return {
    type: 'general',
    confidence: 0.5,
    weights: QUERY_PATTERNS.general.weights,
    suggestedLimit: QUERY_PATTERNS.general.suggestedLimit,
  };
}

/**
 * Check if query contains specific technical identifiers
 */
export function hasExactIdentifier(query: string): boolean {
  // Check for quoted strings, backticks, or PascalCase/camelCase
  return (
    /`[^`]+`/.test(query) ||
    /"[^"]+"/.test(query) ||
    /'[^']+'/.test(query) ||
    /\b[A-Z][a-z]+[A-Z]\w*\b/.test(query) ||
    /\b[a-z]+[A-Z]\w+\b/.test(query)
  );
}

/**
 * Extract identifiers from query for keyword boost
 */
export function extractIdentifiers(query: string): string[] {
  const identifiers: string[] = [];

  // Backtick identifiers
  const backticks = query.match(/`([^`]+)`/g);
  if (backticks) {
    identifiers.push(...backticks.map(s => s.slice(1, -1)));
  }

  // Quoted strings
  const quoted = query.match(/["']([^"']+)["']/g);
  if (quoted) {
    identifiers.push(...quoted.map(s => s.slice(1, -1)));
  }

  // PascalCase
  const pascalCase = query.match(/\b[A-Z][a-zA-Z0-9]+\b/g);
  if (pascalCase) {
    identifiers.push(...pascalCase);
  }

  // camelCase (starting with lowercase)
  const camelCase = query.match(/\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g);
  if (camelCase) {
    identifiers.push(...camelCase);
  }

  return [...new Set(identifiers)];
}

/**
 * Detect if query is in Russian (for future multi-language support)
 */
export function detectLanguage(query: string): 'en' | 'ru' | 'other' {
  if (/[а-яА-ЯёЁ]/.test(query)) {
    return 'ru';
  }
  if (/^[a-zA-Z0-9\s\W]+$/.test(query)) {
    return 'en';
  }
  return 'other';
}
