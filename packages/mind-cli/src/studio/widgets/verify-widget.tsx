import type { FC, ReactNode } from 'react';

export interface MindVerifyChecklistItem {
  label: string;
  status: 'pass' | 'fail' | 'warn';
  details?: ReactNode;
}

export interface MindVerifyWidgetProps {
  heading?: string;
  summary?: string;
  checklist: MindVerifyChecklistItem[];
  footer?: ReactNode;
}

export const MindVerifyWidget: FC<MindVerifyWidgetProps> = ({
  heading = 'Mind Verification',
  summary,
  checklist,
  footer,
}) => (
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
      {checklist.map((item) => {
        const statusColor =
          item.status === 'pass'
            ? '#22c55e'
            : item.status === 'fail'
              ? '#f97316'
              : '#facc15';

        return (
          <article
            key={item.label}
            style={{
              borderRadius: '0.5rem',
              border: '1px solid #1f2937',
              padding: '0.75rem',
              backgroundColor: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                aria-hidden
                style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '9999px',
                  backgroundColor: statusColor,
                  boxShadow: `0 0 0.35rem ${statusColor}55`,
                }}
              />
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#e2e8f0' }}>{item.label}</h3>
            </div>
            {item.details ? (
              <div style={{ fontSize: '0.85rem', color: '#cbd5f5', whiteSpace: 'pre-wrap' }}>
                {item.details}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>

    {footer ? (
      <footer
        style={{
          marginTop: '0.5rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #1f2937',
          color: '#94a3b8',
          fontSize: '0.85rem',
        }}
      >
        {footer}
      </footer>
    ) : null}
  </section>
);

export default MindVerifyWidget;
