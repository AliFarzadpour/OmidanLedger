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
  // 🚀 FINAL PROFESSIONAL PDF (Cleaned Markdown + Alignment)
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
    
    // Company Name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(companyName, 14, 20);

    // Query Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const splitTitle = doc.splitTextToSize(`Query: ${query}`, pageWidth - 100);
    doc.text(splitTitle, 14, 28);

    // Badge
    doc.setFillColor(230, 240, 255); 
    doc.roundedRect(pageWidth - 50, 12, 36, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(0, 80, 180); 
    doc.text('AI GENERATED', pageWidth - 46, 18);
    doc.setTextColor(100);
    doc.text(reportDate, pageWidth - 46, 24);

    // Line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 35, pageWidth - 14, 35);

    // --- 2. PARSE & CLEAN MARKDOWN ---
    const lines = report.split('\n');
    let currentY = 45;

    let tableHeaders: string[] = [];
    let tableBody: string[][] = [];
    let isCollectingTable = false;

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // CASE A: Table Row
      if (trimmedLine.startsWith('|')) {
        isCollectingTable = true;
        // Split by pipe, remove first/last empty items, trim whitespace
        const row = trimmedLine
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim());

        // Detect if it's a Header row (contains dashes like "---")
        if (row.some(cell => cell.includes('---'))) {
             // Skip divider rows
             return; 
        }

        // Logic: The first row found is the Header, subsequent are Body
        if (tableHeaders.length === 0) {
            tableHeaders = row.map(cell => cell.replace(/\*\*/g, '')); // Clean headers immediately
        } else {
            tableBody.push(row);
        }
      } 
      else {
        // CASE B: Not a table row (Text or Gap)
        
        // If we just finished a table, DRAW IT now
        if (isCollectingTable && tableBody.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [tableHeaders],
            body: tableBody,
            theme: 'grid', // 'grid' looks better for financial data than 'striped'
            headStyles: { fillColor: [41, 41, 41], textColor: 255, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200] },
            // Logic to style specific columns
            columnStyles: {
                // Assuming the last column is usually the "Amount" or financial number
                [tableHeaders.length - 1]: { halign: 'right', font: 'courier' } 
            },
            // Logic to Clean Content & Apply Bold
            didParseCell: (data) => {
                const rawText = data.cell.raw as string;
                // Check if the original text had markdown bold markers
                if (typeof rawText === 'string' && rawText.includes('**')) {
                    data.cell.styles.fontStyle = 'bold';
                    // Strip the asterisks for the final display
                    data.cell.text = [rawText.replace(/\*\*/g, '')]; 
                }
                // Check for "Total" or "Net Income" to verify bolding
                if (typeof rawText === 'string' && (rawText.includes('Total') || rawText.includes('NET'))) {
                     data.cell.styles.fontStyle = 'bold';
                     // Optional: Light gray background for total rows
                     data.cell.styles.fillColor = [245, 245, 245];
                }
            }
          });

          currentY = (doc as any).lastAutoTable.finalY + 12;
          tableHeaders = [];
          tableBody = [];
          isCollectingTable = false;
        }

        // Draw Regular Text
        if (trimmedLine !== '') {
            // Heading 2 (##)
            if (trimmedLine.startsWith('##')) {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                doc.text(trimmedLine.replace(/#/g, '').trim(), 14, currentY);
                currentY += 8;
            } 
            // Heading 3 (###) or Bullet Points
            else if (trimmedLine.startsWith('###') || trimmedLine.startsWith('*')) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(50, 50, 50);
                doc.text(trimmedLine.replace(/#/g, '').replace(/\*/g, '•').trim(), 14, currentY);
                currentY += 6;
            }
            // Regular Paragraph
            else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(60, 60, 60);
                // Remove bold markers from plain text paragraphs too
                const cleanText = trimmedLine.replace(/\*\*/g, '');
                const splitText = doc.splitTextToSize(cleanText, pageWidth - 28);
                doc.text(splitText, 14, currentY);
                currentY += (splitText.length * 5) + 3; 
            }
        }
      }
    });

    // Catch-all: If report ended with a table
    if (tableBody.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: [tableHeaders],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [41, 41, 41], textColor: 255, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200] },
            columnStyles: {
                [tableHeaders.length - 1]: { halign: 'right', font: 'courier' } 
            },
            didParseCell: (data) => {
                const rawText = data.cell.raw as string;
                if (typeof rawText === 'string' && rawText.includes('**')) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.text = [rawText.replace(/\*\*/g, '')]; 
                }
                if (typeof rawText === 'string' && (rawText.includes('Total') || rawText.includes('NET'))) {
                     data.cell.styles.fontStyle = 'bold';
                     data.cell.styles.fillColor = [245, 245, 245];
                }
            }
        });
    }

    // --- 3. FOOTER ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      const footerText = `Page ${i} of ${totalPages} | Generated on ${reportDate}`;
      const textWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - textWidth) / 2, pageHeight - 10);
    }

    doc.save(`Financial_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

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
