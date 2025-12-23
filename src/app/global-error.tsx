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
      <body>
        <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
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
              whiteSpace: 'pre-wrap', // Ensures the text wraps
              wordBreak: 'break-all', // Breaks long strings like URLs
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: '#333',
            }}
          >
            <strong>{error.name}:</strong> {error.message}
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
      </body>
    </html>
  );
}
