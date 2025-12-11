'use client';

import { useState, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BrainCircuit, Sparkles, FileDown, ClipboardCopy } from 'lucide-react';
import { generateFinancialReport } from '@/ai/flows/generate-financial-report';
import { Skeleton } from '@/components/ui/skeleton';
import { marked } from 'marked';
import jsPDF from 'jspdf';

// Render markdown inside UI (not for PDF)
function MarkdownReport({ content }: { content: string }) {
  const htmlContent = marked.parse(content);
  return (
    <div
      className="prose prose-sm md:prose-base dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

export function AIReportGenerator() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const reportContentRef = useRef<HTMLDivElement>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData } = useDoc<{
    businessProfile?: { businessName?: string; logoUrl?: string };
  }>(userDocRef);

  // ===========================================================
  // 🚀 IMPROVED PDF GENERATOR — NO EMPTY PAGES, FULL PRO LAYOUT
  // ===========================================================
  const handleDownloadPdf = async () => {
    if (!report) return;

    toast({ title: 'Generating PDF...', description: 'Please wait a moment.' });

    try {
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 48;

      const companyName =
        userData?.businessProfile?.businessName ||
        user?.displayName ||
        user?.email?.split('@')[0] ||
        'Financial Report';

      const shortQuery =
        query.length > 80 ? query.substring(0, 77) + '...' : query || 'Financial Analysis';

      const generatedDate = new Date().toLocaleDateString();
      const fileName = `ai-financial-report-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;

      // ----------------------------------------------------------
      // 🎨 A CLEAN, PROFESSIONAL HTML TEMPLATE JUST FOR THE PDF
      // ----------------------------------------------------------
      const styledHtml = `
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
            color: #111827;
            font-size: 11pt;
            line-height: 1.5;
          }
          h1 { font-size: 20pt; font-weight: 700; margin: 0 0 12px 0; }
          h2 { font-size: 16pt; margin-top: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
          h3 { font-size: 14pt; margin-top: 14px; }
          p { margin: 6px 0; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            margin-bottom: 16px;
          }
          th, td {
            border-bottom: 1px solid #e5e7eb;
            padding: 6px 8px;
          }
          th {
            background: #f3f4f6;
            font-weight: 600;
          }
          ul, ol { margin-left: 20px; }
          li { margin-bottom: 4px; }
          .header-block {
            margin-bottom: 20px;
            padding-bottom: 14px;
            border-bottom: 1px solid #e5e7eb;
          }
          .meta-text {
            font-size: 10pt;
            color: #6b7280;
            margin-top: 6px;
          }
          .pill {
            display: inline-block;
            padding: 4px 10px;
            font-size: 9pt;
            border-radius: 999px;
            background: #eff6ff;
            color: #1d4ed8;
            margin-top: 8px;
          }
        </style>

        <div class="header-block">
          <h1>${companyName}</h1>
          <div class="meta-text"><strong>Query:</strong> ${shortQuery}</div>
          <div class="meta-text"><strong>Date:</strong> ${generatedDate}</div>
          <div class="pill">AI-Generated Financial Report</div>
        </div>

        ${marked.parse(report)}
      `;

      // Add to DOM for jsPDF.html
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.width = `${pdfWidth - margin * 2}px`;
      container.innerHTML = styledHtml;
      document.body.appendChild(container);

      // Render HTML into PDF
      await pdf.html(container, {
        x: margin,
        y: margin,
        width: pdfWidth - margin * 2,
        windowWidth: pdfWidth - margin * 2,
        html2canvas: { scale: 0.9 },
        callback: (doc) => {
          document.body.removeChild(container);
          doc.save(fileName);
        },
      });
    } catch (error) {
      console.error('PDF Error:', error);
      toast({
        variant: 'destructive',
        title: 'PDF Failed',
        description: 'Something went wrong while generating the PDF.',
      });
    }
  };

  // ===========================================================
  // CSV EXPORT
  // ===========================================================
  const handleDownloadCsv = () => {
    if (!report) return;

    toast({ title: 'Generating CSV...', description: 'Your download will begin shortly.' });

    let csvContent = 'data:text/csv;charset=utf-8,';
    const lines = report.split('\n');

    lines.forEach((line) => {
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line
          .split('|')
          .slice(1, -1)
          .map((cell) => `"${cell.trim().replace(/"/g, '""')}"`);
        if (!line.includes('---')) csvContent += cells.join(',') + '\r\n';
      } else if (line.match(/^(\*|-|\d+\.)\s/)) {
        csvContent += `"${line.replace(/^(\*|-|\d+\.)\s/, '').trim()}"\r\n`;
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.download = 'ai-financial-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    toast({
      title: 'Copied!',
      description: 'The report text is now on your clipboard.',
    });
  };

  // ===========================================================
  // SUBMIT AI QUERY
  // ===========================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !user) {
      toast({
        variant: 'destructive',
        title: 'Input Required',
        description: 'Please enter a question or request.',
      });
      return;
    }

    setIsLoading(true);
    setReport(null);

    try {
      const result = await generateFinancialReport({
        userQuery: query,
        userId: user.uid,
      });

      setReport(result);
    } catch (error: any) {
      console.error('AI error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message ?? 'Failed to generate the report.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQueries = [
    'What was my total income last month?',
    'List my top 5 spending categories this year.',
    'Generate a P&L statement for Q3.',
    'What subscriptions am I paying for?',
  ];

  // ===========================================================
  // UI
  // ===========================================================
  return (
    <div className="flex flex-col gap-6">
      {/* Query Input */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="Ask a question… e.g., 'Show me all software expenses last month'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[100px] text-base"
              disabled={isLoading}
            />
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-xs text-muted-foreground">
                Try:
                <div className="flex flex-wrap gap-2 mt-2">
                  {exampleQueries.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setQuery(ex)}
                      className="px-2 py-1 bg-muted hover:bg-secondary rounded-md"
                      disabled={isLoading}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                <Sparkles className="mr-2 h-4 w-4" />
                {isLoading ? 'Generating…' : 'Ask AI'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Loading Skeleton */}
      {isLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
      )}

      {/* Report Output */}
      {report && (
        <Card className="animate-in fade-in-50">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-6 w-6 text-primary" />
                <CardTitle>AI Generated Report</CardTitle>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <ClipboardCopy className="mr-2 h-4 w-4" /> Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                  <FileDown className="mr-2 h-4 w-4" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadCsv}>
                  <FileDown className="mr-2 h-4 w-4" /> CSV
                </Button>
              </div>
            </div>

            <CardDescription>Based on your question: "{query}"</CardDescription>
          </CardHeader>

          <CardContent>
            <div ref={reportContentRef}>
              <MarkdownReport content={report} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
