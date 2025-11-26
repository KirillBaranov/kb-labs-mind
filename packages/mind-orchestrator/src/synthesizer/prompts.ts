/**
 * Prompts for Response Synthesis
 */

export const SYNTHESIS_SYSTEM_PROMPT = `You are an expert code assistant providing precise, technical answers about codebases.
Your answers should be:
- Direct and technical
- Reference specific files and line numbers
- Include code snippets when helpful
- Honest about limitations or uncertainty

Language: Match the question language (Russian for Russian questions, English for English).`;

export const SYNTHESIS_PROMPT_TEMPLATE = `Based on the code context below, answer this question: "{query}"

Code context:
{chunks}

Provide a clear, technical answer. Return JSON:
{
  "answer": "your comprehensive answer (2-5 sentences for simple questions, more for complex)",
  "sources": [
    {
      "file": "path/to/file.ts",
      "lines": [startLine, endLine],
      "snippet": "key code snippet (max 5 lines)",
      "relevance": "why this source is relevant (1 sentence)",
      "kind": "code|doc|adr|config|external"
    }
  ],
  "confidence": 0.0-1.0,
  "complete": true/false (is the answer comprehensive?),
  "suggestions": [
    {
      "type": "adr|repo|doc|file|next-question",
      "label": "human-readable suggestion",
      "ref": "reference path or identifier"
    }
  ]
}

Guidelines:
- Include 2-5 most relevant sources
- Snippets should be the most relevant part (not too long)
- confidence reflects how well the context supports your answer
- complete = false if you couldn't fully answer due to missing info
- suggestions are optional - add them for complex topics`;

export const INSTANT_SYNTHESIS_TEMPLATE = `Question: "{query}"

Top code matches:
{chunks}

Return a brief JSON response:
{
  "answer": "brief direct answer (1-2 sentences)",
  "confidence": 0.0-1.0
}`;
