'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ margin: 0, padding: 0 }}>
        <div style={{ fontFamily: 'sans-serif', padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: '1200px', width: '100%' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Something went wrong!</h2>
            <p style={{ marginTop: '0.5rem', color: '#555' }}>
              An unhandled error occurred. Below is the full error message, which you can copy and paste.
            </p>
            <pre
              style={{
                marginTop: '1rem',
                padding: '1rem',
                border: '1px solid #ddd',
                borderRadius: '0.5rem',
                backgroundColor: '#f9f9f9',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: '#333',
                overflowY: 'auto'
              }}
            >
              <strong>{error.name}:</strong> {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
            <button
              onClick={() => reset()}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                border: 'none',
                backgroundColor: '#007bff',
                color: 'white',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
