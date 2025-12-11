'use client';

import { useState, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BrainCircuit, Sparkles, FileDown } from 'lucide-react';
import { generateFinancialReport } from '@/ai/flows/generate-financial-report';
import { Skeleton } from '@/components/ui/skeleton';
import { marked } from 'marked';
import jsPDF from 'jspdf';
import { Logo } from '@/components/logo';

// A simple component to render markdown content
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

  const { data: userData } = useDoc<{ businessProfile?: { businessName?: string, logoUrl?: string } }>(userDocRef);


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
        const margin = 40;

        // --- COVER PAGE ---
        pdf.setFillColor(248, 250, 252); // Light gray background
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        
        // Logo
        const logoUrl = userData?.businessProfile?.logoUrl;
        if (logoUrl) {
            try {
                // jsPDF needs image data, not just a URL. Fetch and convert.
                const response = await fetch(logoUrl);
                const blob = await response.blob();
                const reader = new FileReader();
                await new Promise<void>((resolve, reject) => {
                    reader.onload = () => {
                        pdf.addImage(reader.result as string, 'PNG', pdfWidth / 2 - 50, margin * 2, 100, 100);
                        resolve();
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.error("Could not load logo image for PDF", e);
            }
        } else {
             // Fallback if no logo - maybe render a placeholder?
        }


        // Company Name
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(26);
        pdf.setTextColor(17, 24, 39);
        const companyName = userData?.businessProfile?.businessName || user?.displayName || user?.email?.split('@')[0] || 'Financial Report';
        pdf.text(companyName, pdfWidth / 2, margin * 2 + 140, { align: 'center' });

        // Report Title
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(18);
        pdf.setTextColor(107, 114, 128);
        const reportTitle = query.length > 50 ? query.substring(0, 50) + '...' : query;
        pdf.text(reportTitle, pdfWidth / 2, margin * 2 + 170, { align: 'center' });
        
        // Subtitle
        pdf.setFontSize(12);
        pdf.text('AI-Generated Financial Insights', pdfWidth / 2, margin * 2 + 190, { align: 'center' });


        // Generated Date
        pdf.setFontSize(10);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pdfWidth / 2, pdfHeight - margin, { align: 'center' });

        // --- CONTENT PAGES ---
        if (reportContentRef.current) {
            pdf.addPage();
            // Header for content pages
            const addHeader = (pageNum: number) => {
                pdf.setPage(pageNum);
                pdf.setFontSize(10);
                pdf.setTextColor(150);
                pdf.text(companyName, margin, margin / 2);
                pdf.text(`Page ${pageNum}`, pdfWidth - margin, margin / 2, { align: 'right' });
                pdf.setDrawColor(220);
                pdf.line(margin, margin / 2 + 10, pdfWidth - margin, margin / 2 + 10);
            };

            // Using html method for content
             await pdf.html(reportContentRef.current, {
                x: margin,
                y: margin,
                width: pdfWidth - (margin * 2),
                windowWidth: pdfWidth - (margin * 2),
                autoPaging: 'text',
                callback: (doc) => {
                    const pageCount = doc.internal.getNumberOfPages();
                    // Start from page 2 for headers
                    for (let i = 2; i <= pageCount; i++) {
                        addHeader(i);
                    }
                    doc.save('ai-financial-report.pdf');
                }
            });
        } else {
             pdf.save('ai-financial-report.pdf');
        }


    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: 'destructive',
        title: 'PDF Generation Failed',
        description: 'An unexpected error occurred while creating the PDF.',
      });
    }
  };

  const handleDownloadCsv = () => {
    if (!report) return;

    toast({ title: 'Generating CSV...', description: 'Your download will begin shortly.' });

    // Basic conversion from Markdown to CSV. This is a best-effort approach.
    // It assumes simple structures like tables and lists.
    let csvContent = "data:text/csv;charset=utf-8,";
    const lines = report.split('\n');
    lines.forEach(line => {
        // Handle markdown table rows
        if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').slice(1, -1).map(cell => `"${cell.trim().replace(/"/g, '""')}"`);
            if (cells.length > 0 && !line.includes('---')) { // ignore separator lines
                 csvContent += cells.join(',') + "\r\n";
            }
        }
        // Handle list items
        else if (line.match(/^(\*|-|\d+\.)\s/)) {
            const item = `"${line.replace(/^(\*|-|\d+\.)\s/, '').trim().replace(/"/g, '""')}"`;
            csvContent += item + "\r\n";
        }
        // Handle headings and plain text
        else if (line.trim().length > 0) {
             const text = `"${line.replace(/#/g, '').trim().replace(/"/g, '""')}"`;
             csvContent += text + "\r\n";
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ai-financial-report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    "What was my total income last month?",
    "Show me all expenses related to 'Software'.",
    "List my top 5 spending categories in July 2024.",
    "Generate a profit and loss statement for the last quarter."
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
