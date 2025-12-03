'use client';

import { useState, useRef } from 'react';
import { useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BrainCircuit, Sparkles, FileDown } from 'lucide-react';
import { generateFinancialReport } from '@/ai/flows/generate-financial-report';
import { Skeleton } from '@/components/ui/skeleton';
import { marked } from 'marked';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const reportContentRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    if (!reportContentRef.current) return;

    toast({ title: 'Generating PDF...', description: 'Please wait a moment.' });

    try {
      const canvas = await html2canvas(reportContentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('ai-financial-report.pdf');
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
            if (cells.length > 0) {
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
          <CardContent ref={reportContentRef}>
            <MarkdownReport content={report} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
