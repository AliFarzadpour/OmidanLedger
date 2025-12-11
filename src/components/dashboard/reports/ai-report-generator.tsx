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
  // 🚀 FIXED PDF GENERATOR WITH FOOTER (Page X of Y + Date)
  // ===========================================================
  const handleDownloadPdf = async () => {
    if (!report) return;

    toast({ title: 'Generating PDF...', description: 'Please wait a moment.' });

    try {
      // 1. Setup PDF document
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
      });

      // A4 Size in points: 595.28 x 841.89
      const pdfWidth = 595.28; 
      const pdfHeight = 841.89;
      const margin = 40;
      const contentWidth = pdfWidth - (margin * 2);

      const companyName =
        userData?.businessProfile?.businessName ||
        user?.displayName ||
        'Financial Report';

      const shortQuery =
        query.length > 80 ? query.substring(0, 77) + '...' : query || 'Financial Analysis';

      const generatedDate = new Date().toLocaleDateString();
      const generatedTime = new Date().toLocaleTimeString();
      const fileName = `ai-report-${new Date().toISOString().slice(0, 10)}.pdf`;

      // 2. Create stylized HTML template
      const styledHtml = `
        <div style="width: ${contentWidth}px; font-family: sans-serif; color: #111;">
            <style>
              h1 { font-size: 22px; font-weight: 700; margin-bottom: 5px; color: #000; }
              h2 { font-size: 16px; margin-top: 20px; border-bottom: 2px solid #eee; padding-bottom: 5px; color: #333; }
              h3 { font-size: 14px; margin-top: 15px; font-weight: 600; color: #444; }
              p { font-size: 11px; line-height: 1.5; margin-bottom: 8px; color: #333; }
              ul, ol { margin-left: 20px; margin-bottom: 10px; }
              li { font-size: 11px; margin-bottom: 4px; }
              
              /* Table Styling */
              table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; }
              th { background-color: #f3f4f6; text-align: left; padding: 6px; border: 1px solid #ddd; font-weight: bold; }
              td { padding: 6px; border: 1px solid #ddd; }
              
              /* Header Block */
              .header { margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #000; }
              .meta { font-size: 10px; color: #666; margin-top: 4px; }
              .badge { 
                display: inline-block; background: #e0f2fe; color: #0369a1; 
                padding: 4px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; margin-top: 8px;
              }
            </style>

            <div class="header">
              <h1>${companyName}</h1>
              <div class="meta"><strong>Topic:</strong> ${shortQuery}</div>
              <div class="meta"><strong>Generated:</strong> ${generatedDate} at ${generatedTime}</div>
              <div class="badge">AI GENERATED REPORT</div>
            </div>

            <div class="content">
              ${marked.parse(report)}
            </div>
        </div>
      `;

      // 3. Create a temporary container
      const container = document.createElement('div');
      container.innerHTML = styledHtml;
      
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.zIndex = '-9999';
      container.style.background = 'white'; 
      container.style.width = `${contentWidth}px`; 
      
      document.body.appendChild(container);

      // 4. Generate PDF
      await pdf.html(container, {
        x: margin,
        y: margin,
        width: contentWidth,
        windowWidth: contentWidth, 
        autoPaging: 'text', 
        html2canvas: {
            scale: 1, 
            logging: false,
            useCORS: true 
        },
        callback: (doc) => {
          // 5. Add Footer to ALL pages
          const totalPages = doc.getNumberOfPages();
          const footerFontSize = 9;
          
          for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(footerFontSize);
            doc.setTextColor(150); // Light gray color

            const footerText = `Page ${i} of ${totalPages} | Generated on ${generatedDate}`;
            const textWidth = doc.getTextWidth(footerText);
            
            // Center footer at the bottom
            const xPos = (pdfWidth - textWidth) / 2;
            const yPos = pdfHeight - 20; // 20pt from bottom

            doc.text(footerText, xPos, yPos);
          }

          doc.save(fileName);
          document.body.removeChild(container);
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
  // CSV EXPORT (Unchanged)
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
