/**
 * Markdown formatter for KB Labs Mind Pack
 */

/**
 * Generate Markdown from sections with stable order
 */
export function generateMarkdown(sections: Record<string, string>): string {
  const order = [
    'intent_summary',
    'product_overview',
    'project_meta',
    'api_signatures',
    'recent_diffs',
    'docs_overview',
    'impl_snippets',
    'configs_profiles'
  ];
  
  let markdown = '';
  for (const section of order) {
    if (sections[section]) {
      markdown += sections[section] + '\n\n';
    }
  }
  
  return markdown.trim();
}
