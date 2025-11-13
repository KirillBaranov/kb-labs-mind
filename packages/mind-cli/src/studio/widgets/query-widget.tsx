import type { FC, ReactNode } from 'react';

export interface MindQueryWidgetSection {
  title: string;
  content: ReactNode;
}

export interface MindQueryWidgetProps {
  heading?: string;
  summary?: string;
  sections: MindQueryWidgetSection[];
}

export const MindQueryWidget: FC<MindQueryWidgetProps> = ({ heading = 'Mind Query Results', summary, sections }) => (
  <section
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      padding: '1rem',
      backgroundColor: '#101827',
      borderRadius: '0.75rem',
      color: '#f9fafb',
      minHeight: '100%',
    }}
  >
    <header style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{heading}</h2>
      {summary ? (
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>{summary}</p>
      ) : null}
    </header>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {sections.map((section) => (
        <article
          key={section.title}
          style={{
            borderRadius: '0.5rem',
            border: '1px solid #1f2937',
            padding: '0.75rem',
            backgroundColor: '#0f172a',
          }}
        >
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#e2e8f0' }}>{section.title}</h3>
          <div style={{ fontSize: '0.85rem', color: '#cbd5f5', whiteSpace: 'pre-wrap' }}>{section.content}</div>
        </article>
      ))}
    </div>
  </section>
);

export default MindQueryWidget;
