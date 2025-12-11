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
import { Logo } from '@/components/logo';

// A simple component to render markdown content in the app
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
  const reportContentRef = useRef<HTMLDivElement>(null); // still used for screen display only

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData } = useDoc<{ businessProfile?: { businessName?: string; logoUrl?: string } }>(userDocRef);

  // ---------- NEW / IMPROVED PDF GENERATION ----------
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
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 48;

      const companyName =
        userData?.businessProfile?.businessName ||
        user?.displayName ||
        user?.email?.split('@')[0] ||
        'AI Financial Report';

      const shortQuery = query.trim().length
        ? query.trim().length > 80
          ? `${query.trim().slice(0, 77)}...`
          : query.trim()
        : 'AI-Generated Financial Insights';

      const generatedDate = new Date().toLocaleDateString();
      const fileName = `ai-financial-report-${new Date().toISOString().slice(0, 10)}.pdf`;

      // Helper: header & footer for non-cover pages
      const addHeaderFooter = (pageNumber: number, totalPages: number) => {
        pdf.setPage(pageNumber);

        // Header
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text(companyName, margin, margin / 2);

        // Divider
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.5);
        pdf.line(margin, margin / 2 + 10, pdfWidth - margin, margin / 2 + 10);

        // Footer
        pdf.setFontSize(9);
        pdf.setTextColor(160, 160, 160);
        const footerY = pdfHeight - margin / 2;

        pdf.text(`Generated on: ${generatedDate}`, margin, footerY);
        pdf.text(`Page ${pageNumber} of ${totalPages}`, pdfWidth - margin, footerY, {
          align: 'right',
        });
      };

      // -------------------------
      // 1) COVER PAGE
      // -------------------------
      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

      // Accent band
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, pdfHeight * 0.18, pdfWidth, pdfHeight * 0.14, 'F');

      // Logo (if available)
      const logoUrl = userData?.businessProfile?.logoUrl;
      if (logoUrl) {
        try {
          const response = await fetch(logoUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          await new Promise<void>((resolve, reject) => {
            reader.onload = () => {
              const imgWidth = 80;
              const imgHeight = 80;
              pdf.addImage(
                reader.result as string,
                'PNG',
                pdfWidth / 2 - imgWidth / 2,
                pdfHeight * 0.11,
                imgWidth,
                imgHeight
              );
              resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error('Could not load logo image for PDF', e);
        }
      }

      // Company Name
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(17, 24, 39);
      pdf.text(companyName, pdfWidth / 2, pdfHeight * 0.38, { align: 'center' });

      // Report Title (based on query)
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(16);
      pdf.setTextColor(55, 65, 81);
      pdf.text(shortQuery, pdfWidth / 2, pdfHeight * 0.43, {
        align: 'center',
        maxWidth: pdfWidth - margin * 2,
      });

      // Subtitle
      pdf.setFontSize(11);
      pdf.setTextColor(100, 116, 139);
      pdf.text('AI-Generated Financial Report', pdfWidth / 2, pdfHeight * 0.48, { align: 'center' });

      // Date
      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Generated on ${generatedDate}`, pdfWidth / 2, pdfHeight * 0.53, {
        align: 'center',
      });

      // Footnote
      pdf.setFontSize(9);
      pdf.setTextColor(156, 163, 175);
      pdf.text(
        'This report is generated automatically based on your recorded transaction data.',
        pdfWidth / 2,
        pdfHeight - margin * 0.8,
        {
          align: 'center',
          maxWidth: pdfWidth - margin * 2,
        }
      );

      // -------------------------
      // 2) CONTENT PAGES (NEW TEMPLATE)
      // -------------------------
      // Build a clean, print-focused HTML with its own styling,
      // instead of using the on-screen DOM.
      const styledHtml = `
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
            color: #111827;
            font-size: 11pt;
            line-height: 1.5;
          }
          h1, h2, h3 {
            color: #111827;
            margin-top: 16px;
            margin-bottom: 8px;
            font-weight: 600;
          }
          h1 { font-size: 18pt; }
          h2 { font-size: 15pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
          h3 { font-size: 13pt; }
          p {
            margin: 4px 0;
          }
          strong, b {
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 14px;
          }
          th, td {
            border-bottom: 1px solid #e5e7eb;
            padding: 6px 8px;
            font-size: 10pt;
          }
          th {
            background-color: #f3f4f6;
            text-align: left;
          }
          ul, ol {
            margin: 6px 0 6px 18px;
          }
          li {
            margin-bottom: 2px;
          }
          .report-header {
            margin-bottom: 12px;
          }
          .report-header-title {
            font-size: 14pt;
            font-weight: 600;
            color: #111827;
          }
          .report-header-sub {
            font-size: 9pt;
            color: #6b7280;
            margin-top: 4px;
          }
          .pill {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 8.5pt;
            background-color: #eff6ff;
            color: #1d4ed8;
            margin-top: 4px;
          }
          .section-separator {
            margin: 18px 0;
            border-top: 1px solid #e5e7eb;
          }
        </style>
        <div class="report-root">
          <div class="report-header">
            <div class="report-header-title">${companyName} – Financial Overview</div>
            <div class="report-header-sub">
              Based on your question:
              <span style="font-style: italic;">"${shortQuery}"</span>
            </div>
            <div class="pill">AI-generated analysis</div>
          </div>
          <div class="section-separator"></div>
          ${marked.parse(report)}
        </div>
      `;

      // Create an off-screen container for jsPDF.html
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.width = `${pdfWidth - margin * 2}px`;
      container.innerHTML = styledHtml;
      document.body.appendChild(container);

      pdf.addPage(); // first content page (page 2 overall)

      await pdf.html(container, {
        x: margin,
        y: margin,
        width: pdfWidth - margin * 2,
        windowWidth: pdfWidth - margin * 2,
        autoPaging: 'text',
        html2canvas: {
          scale: 0.9,
        },
        callback: (doc) => {
          const totalPages = doc.internal.getNumberOfPages();

          // Add header/footer to all non-cover pages
          for (let i = 2; i <= totalPages; i++) {
            addHeaderFooter(i, totalPages);
          }

          document.body.removeChild(container);
          doc.save(fileName);
        },
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: 'destructive',
        title: 'PDF Generation Failed',
        description: 'An unexpected error occurred while creating the PDF.',
      });
    }
  };
  // ---------- END PDF CODE ----------

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
        if (cells.length > 0 && !line.includes('---')) {
          csvContent += cells.join(',') + '\r\n';
        }
      } else if (line.match(/^(\*|-|\d+\.)\s/)) {
        const item = `"${line.replace(/^(\*|-|\d+\.)\s/, '').trim().replace(/"/g, '""')}"`;
        csvContent += item + '\r\n';
      } else if (line.trim().length > 0) {
        const text = `"${line.replace(/#/g, '').trim().replace(/"/g, '""')}"`;
        csvContent += text + '\r\n';
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'ai-financial-report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    toast({
      title: 'Copied to Clipboard',
      description: 'The report content has been copied.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !user) {
      toast({
        variant: 'destructive',
        title: 'Input Required',
        description: 'Please enter a question or a report request.',
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
      console.error('Error generating AI report:', error);
      toast({
        variant: 'destructive',
        title: 'Error Generating Report',
        description: error.message || 'An unknown error occurred. Please check the server logs.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQueries = [
    'What was my total income last month?',
    "Show me all expenses related to 'Software'.",
    'List my top 5 spending categories in July 2024.',
    'Generate a profit and loss statement for the last quarter.',
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="e.g., 'What were my top 5 expenses last month?'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[100px] text-base"
              disabled={isLoading}
            />
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-xs text-muted-foreground">
                Try one of these examples:
                <div className="flex flex-wrap gap-2 mt-2">
                  {exampleQueries.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setQuery(ex)}
                      className="px-2 py-1 bg-muted hover:bg-secondary rounded-md text-left"
                      disabled={isLoading}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                <Sparkles className="mr-2 h-4 w-4" />
                {isLoading ? 'Generating...' : 'Ask AI'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
      )}

      {report && (
        <Card className="animate-in fade-in-50">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-6 w-6 text-primary" />
                <CardTitle>AI Generated Report</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadCsv}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download CSV
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
