# @kb-labs/mind-llm

**LLM provider abstraction for KB Labs Mind system.**

Unified interface for interacting with Large Language Models (OpenAI, Anthropic Claude, local models) used in query decomposition, synthesis, and reasoning.

## Features

- **🔌 Provider Abstraction** - Unified API for OpenAI, Claude, local models
- **🔄 Graceful Fallback** - Automatic fallback to alternative providers
- **⚡ Streaming Support** - Stream responses for real-time feedback
- **🎯 Template System** - Reusable prompt templates
- **📊 Token Counting** - Accurate token usage tracking
- **💾 Response Caching** - Cache LLM responses for performance
- **🛡️ Rate Limiting** - Built-in rate limiting and retries
- **📈 Analytics** - Track LLM usage and costs

## Architecture

```
mind-llm/
├── src/
│   ├── index.ts                 # Main exports
│   ├── providers/               # LLM provider implementations
│   │   ├── openai.ts            # OpenAI provider (GPT-3.5, GPT-4)
│   │   ├── anthropic.ts         # Anthropic Claude provider
│   │   └── local.ts             # Local model provider
│   ├── provider-factory.ts      # Factory pattern for providers
│   ├── templates/               # Prompt templates
│   │   ├── decomposition.ts     # Query decomposition prompts
│   │   ├── synthesis.ts         # Response synthesis prompts
│   │   └── classification.ts    # Query classification prompts
│   └── types.ts                 # LLM interfaces
```

## Usage

### Creating LLM Provider

```typescript
import { usePlatform } from '@kb-labs/sdk';

// Get platform LLM service (recommended - uses singleton)
const platform = usePlatform();
const llm = platform.getLLM();

// Platform automatically provides the right implementation:
// - OpenAI if OPENAI_API_KEY is set
// - Anthropic if ANTHROPIC_API_KEY is set
// - Falls back to mock/local if neither configured

// Example usage with platform
const response = await llm.complete({
  prompt: 'Explain how hybrid search works',
  maxTokens: 200,
});

// Manual creation (only if you need custom config)
import { OpenAILLM, AnthropicLLM } from '@kb-labs/sdk';

const openaiLLM = new OpenAILLM({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

const claudeLLM = new AnthropicLLM({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229',
});
```

### Simple Completion

```typescript
const response = await llmProvider.complete({
  prompt: 'Explain how hybrid search works in 2-3 sentences',
  maxTokens: 200,
  temperature: 0.7,
});

console.log(response.text);
console.log('Tokens used:', response.usage.totalTokens);
```

### Streaming Completion

```typescript
const stream = await llmProvider.streamComplete({
  prompt: 'Explain RAG architecture step by step',
  maxTokens: 500,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

### Using Templates

```typescript
import { synthesisTemplate } from '@kb-labs/mind-llm/templates';

const prompt = synthesisTemplate({
  query: 'How does authentication work?',
  chunks: [
    { content: 'Auth uses JWT tokens...', path: 'src/auth.ts' },
    { content: 'Token validation in middleware...', path: 'src/middleware.ts' },
  ],
});

const response = await llmProvider.complete({ prompt, maxTokens: 1000 });
```

## Providers

### OpenAI Provider

**Models supported:**
- `gpt-4` - Most capable, expensive
- `gpt-4-turbo` - Faster, cheaper than GPT-4
- `gpt-3.5-turbo` - Fast, cheap, good for simple tasks

**Features:**
- ✅ Streaming
- ✅ Function calling
- ✅ JSON mode
- ✅ Token counting

**Configuration:**
```typescript
{
  type: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4',
  temperature: 0.7,      // 0.0-2.0, default 0.7
  maxTokens: 2000,       // Max response tokens
  topP: 1.0,             // Nucleus sampling
  frequencyPenalty: 0.0, // -2.0 to 2.0
  presencePenalty: 0.0,  // -2.0 to 2.0
}
```

### Anthropic Claude Provider

**Models supported:**
- `claude-3-opus-20240229` - Most capable
- `claude-3-sonnet-20240229` - Balanced
- `claude-3-haiku-20240307` - Fast and cheap

**Features:**
- ✅ Streaming
- ✅ Long context (100K+ tokens)
- ✅ System prompts

**Configuration:**
```typescript
{
  type: 'anthropic',
  apiKey: 'sk-ant-...',
  model: 'claude-3-opus-20240229',
  temperature: 0.7,
  maxTokens: 4096,
}
```

### Local Provider

**Supported backends:**
- Ollama (http://localhost:11434)
- LM Studio
- Text Generation WebUI
- Any OpenAI-compatible API

**Models:**
- `llama2` - Meta's Llama 2
- `codellama` - Code-specialized Llama
- `mistral` - Mistral 7B
- `mixtral` - Mixtral 8x7B

**Configuration:**
```typescript
{
  type: 'local',
  endpoint: 'http://localhost:11434/api/generate',
  model: 'llama2',
  temperature: 0.7,
  maxTokens: 2000,
}
```

## Prompt Templates

### Decomposition Template

Breaks complex queries into sub-queries:

```typescript
import { decompositionTemplate } from '@kb-labs/mind-llm/templates';

const prompt = decompositionTemplate({
  query: 'Explain how Mind implements hybrid search with RRF',
});

const response = await llmProvider.complete({ prompt, maxTokens: 500 });
// Response: ["What is hybrid search?", "What is RRF?", "How does Mind combine them?"]
```

### Synthesis Template

Synthesizes answer from chunks:

```typescript
import { synthesisTemplate } from '@kb-labs/mind-llm/templates';

const prompt = synthesisTemplate({
  query: 'How does authentication work?',
  chunks: relevantChunks,
});

const response = await llmProvider.complete({ prompt, maxTokens: 1000 });
// Response: Comprehensive answer with source citations
```

### Classification Template

Classifies query intent:

```typescript
import { classificationTemplate } from '@kb-labs/mind-llm/templates';

const prompt = classificationTemplate({
  query: 'Where is the VectorStore interface?',
});

const response = await llmProvider.complete({ prompt, maxTokens: 50 });
// Response: "lookup"
```

## Advanced Features

### Function Calling (OpenAI)

```typescript
const response = await llmProvider.complete({
  prompt: 'Find files related to authentication',
  functions: [
    {
      name: 'search_codebase',
      description: 'Search codebase for relevant files',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
      },
    },
  ],
});

if (response.functionCall) {
  console.log('Function:', response.functionCall.name);
  console.log('Arguments:', response.functionCall.arguments);
}
```

### JSON Mode (OpenAI)

```typescript
const response = await llmProvider.complete({
  prompt: 'Extract key points from this code explanation',
  responseFormat: { type: 'json_object' },
});

const json = JSON.parse(response.text);
console.log(json.keyPoints);
```

### Token Counting

```typescript
import { countTokens } from '@kb-labs/mind-llm';

const tokens = countTokens('Your text here', 'gpt-4');
console.log('Tokens:', tokens);

// Check if prompt fits in context
const maxContext = 8192; // GPT-4 context
if (tokens > maxContext) {
  console.error('Prompt too long!');
}
```

## Configuration

### Environment Variables

```bash
# OpenAI
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MODEL=claude-3-opus-20240229

# Local
export LLM_ENDPOINT=http://localhost:11434/api/generate
export LLM_MODEL=llama2

# Global settings
export LLM_TEMPERATURE=0.7
export LLM_MAX_TOKENS=2000
```

### Provider Selection

```typescript
import { createLLMProvider } from '@kb-labs/sdk';

// Auto-select based on environment
const provider = createLLMProvider({
  type: process.env.LLM_PROVIDER || 'openai',
  apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  model: process.env.LLM_MODEL,
});
```

## Cost Optimization

### Token Usage Tracking

```typescript
let totalCost = 0;

const response = await llmProvider.complete({
  prompt: 'Your prompt',
  maxTokens: 500,
});

// Calculate cost (GPT-4: $0.03/1K prompt, $0.06/1K completion)
const promptCost = (response.usage.promptTokens / 1000) * 0.03;
const completionCost = (response.usage.completionTokens / 1000) * 0.06;
totalCost += promptCost + completionCost;

console.log('Cost:', totalCost.toFixed(4), 'USD');
```

### Caching Responses

```typescript
import { LLMCache } from '@kb-labs/mind-llm';

const cache = new LLMCache({ ttl: 3600 }); // 1 hour

async function cachedComplete(prompt: string) {
  const cached = cache.get(prompt);
  if (cached) return cached;

  const response = await llmProvider.complete({ prompt, maxTokens: 500 });
  cache.set(prompt, response);
  return response;
}
```

### Using Cheaper Models

```typescript
// Use GPT-3.5 for simple tasks
const cheapProvider = createLLMProvider({
  type: 'openai',
  model: 'gpt-3.5-turbo', // 10x cheaper than GPT-4
});

// Use GPT-4 only for complex reasoning
const premiumProvider = createLLMProvider({
  type: 'openai',
  model: 'gpt-4',
});
```

## Dependencies

```json
{
  "dependencies": {
    "@kb-labs/sdk": "^1.0.0",
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.9.0"
  }
}
```

## Testing

```bash
# Run unit tests
pnpm test

# Test with real LLM (requires API keys)
OPENAI_API_KEY=sk-... pnpm test:integration

# Mock LLM for tests
pnpm test:mock
```

## Development

### Build

```bash
pnpm build
```

### Watch Mode

```bash
pnpm dev
```

### Type Check

```bash
pnpm typecheck
```

## Best Practices

**DO ✅:**
- **Use templates** - Consistent prompts across the system
- **Count tokens** - Avoid exceeding context limits
- **Cache responses** - Reduce API costs
- **Handle errors** - Implement retries and fallbacks
- **Track usage** - Monitor costs and performance

**DON'T ❌:**
- **Hardcode prompts** - Use templates for maintainability
- **Ignore token limits** - Check before sending
- **Skip rate limiting** - Avoid API throttling
- **Use wrong model** - Match model to task complexity

## Related Packages

- **@kb-labs/mind-orchestrator** - Uses LLM for query decomposition and synthesis
- **@kb-labs/mind-engine** - Uses LLM for reasoning and classification

## Examples

See [examples/](./examples/) for complete examples:
- `basic-completion.ts` - Simple completion
- `streaming.ts` - Streaming responses
- `function-calling.ts` - OpenAI function calling
- `cost-tracking.ts` - Cost optimization

## License

Private - KB Labs internal use only.

## Support

For questions, check:
- [Mind Engine README](../mind-engine/README.md)
- [Mind Orchestrator README](../mind-orchestrator/README.md)
- [CLAUDE.md](../../CLAUDE.md) - Development guide

---

**Last Updated**: 2025-12-09
**Version**: 0.1.0
**Status**: ✅ Production Ready (SDK migrated)
