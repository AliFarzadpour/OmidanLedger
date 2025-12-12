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
import autoTable from 'jspdf-autotable'; // REQUIRED: npm install jspdf-autotable

// Render markdown inside UI (remains the same)
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
  // 🚀 PROFESSIONAL NATIVE PDF GENERATOR
  // ===========================================================
  const handleDownloadPdf = () => {
    if (!report) return;
    toast({ title: 'Generating PDF...', description: 'Creating professional report.' });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // --- 1. HEADER SECTION ---
    const companyName = userData?.businessProfile?.businessName || user?.displayName || 'Financial Report';
    const reportDate = new Date().toLocaleDateString();
    
    // Company Name (Top Left)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(companyName, 14, 20);

    // Report Title/Query (Below Name)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const splitTitle = doc.splitTextToSize(`Query: ${query}`, pageWidth - 100);
    doc.text(splitTitle, 14, 28);

    // "AI Generated" Badge (Top Right)
    doc.setFillColor(230, 240, 255); // Light Blue background
    doc.roundedRect(pageWidth - 50, 12, 36, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(0, 80, 180); // Dark Blue text
    doc.text('AI GENERATED', pageWidth - 46, 18);
    doc.setTextColor(100);
    doc.text(reportDate, pageWidth - 46, 24);

    // Separator Line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 35, pageWidth - 14, 35);

    // --- 2. PARSE MARKDOWN CONTENT ---
    // We split the AI response into "Text Paragraphs" and "Tables"
    const lines = report.split('\n');
    let currentY = 45; // Start position for body content

    let tableData: string[][] = [];
    let isCollectingTable = false;

    lines.forEach((line) => {
      // Check if line is part of a markdown table
      if (line.trim().startsWith('|')) {
        isCollectingTable = true;
        // Clean the markdown row (remove outer pipes and trim)
        const row = line
          .split('|')
          .slice(1, -1) // Remove first and last empty elements from split
          .map((cell) => cell.trim());
        tableData.push(row);
      } else {
        // If we were collecting a table and hit a text line, DRAW THE TABLE
        if (isCollectingTable && tableData.length > 0) {
          const headers = tableData[0]; // First row is header
          const body = tableData.slice(2); // Skip header and divider row (---|---)

          autoTable(doc, {
            startY: currentY,
            head: [headers],
            body: body,
            theme: 'striped',
            headStyles: { fillColor: [41, 41, 41], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            margin: { left: 14, right: 14 },
          });

          // Update Y position to after the table
          currentY = (doc as any).lastAutoTable.finalY + 10;
          tableData = [];
          isCollectingTable = false;
        }

        // DRAW PLAIN TEXT (Headings or Paragraphs)
        if (line.trim() !== '') {
            // Check if it's a Heading (starts with #)
            if (line.startsWith('##')) {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                const text = line.replace(/#/g, '').trim();
                doc.text(text, 14, currentY);
                currentY += 8;
            } 
            else if (line.startsWith('###')) {
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(50, 50, 50);
                const text = line.replace(/#/g, '').trim();
                doc.text(text, 14, currentY);
                currentY += 6;
            }
            else {
                // Regular Paragraph
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(60, 60, 60);
                const text = line.replace(/\*\*/g, ''); // Remove bold markdown for clean PDF
                const splitText = doc.splitTextToSize(text, pageWidth - 28);
                doc.text(splitText, 14, currentY);
                // Increase Y based on how many lines the text took up
                currentY += (splitText.length * 5) + 2; 
            }
        }
      }
    });

    // Catch-all: If the report ends with a table, draw it
    if (tableData.length > 0) {
        const headers = tableData[0];
        const body = tableData.slice(2);
        autoTable(doc, {
            startY: currentY,
            head: [headers],
            body: body,
            theme: 'striped',
            headStyles: { fillColor: [41, 41, 41] },
            margin: { left: 14, right: 14 },
        });
    }

    // --- 3. FOOTER (Page Numbers) ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      const footerText = `Page ${i} of ${totalPages} | Generated on ${reportDate}`;
      const textWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - textWidth) / 2, pageHeight - 10);
    }

    // Save
    doc.save(`Financial_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
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
                {/* Fixed: Re-added CSV button logic here if needed, or remove if unused */}
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
