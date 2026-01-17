'use client';

import { useState, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BrainCircuit, Sparkles, FileDown, ClipboardCopy, Loader2 } from 'lucide-react';
import { generateFinancialReport } from '@/ai/flows/generate-financial-report';
import { Skeleton } from '@/components/ui/skeleton';
import { marked } from 'marked';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isHelpEnabled } from '@/lib/help/help-config';
import { askHelpRag } from '@/actions/help-actions';

// Render markdown inside UI
function MarkdownReport({ content }: { content: string }) {
  if (!content) return null;
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
  const [helpSources, setHelpSources] = useState<any[]>([]); // For RAG results
  const reportContentRef = useRef<HTMLDivElement>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData } = useDoc<{
    businessProfile?: { businessName?: string; logoUrl?: string };
  }>(userDocRef);

  // ... (PDF and CSV generation functions remain the same)
  const handleDownloadPdf = () => {
    if (!report) return;
    toast({ title: 'Generating PDF...', description: 'Creating professional report.' });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width; // ~210mm
    const pageHeight = doc.internal.pageSize.height; // ~297mm
    const margin = 14;
    const maxLineWidth = pageWidth - (margin * 2);

    // Helper: Clean Markdown Artifacts
    const cleanText = (text: string) => {
      return text
        .replace(/\*\*/g, '') // Remove bold markers
        .replace(/##/g, '')   // Remove header markers
        .replace(/__/g, '')   // Remove italics markers
        .trim();
    };

    // Helper: Check for Page Break in Text Blocks
    let currentY = 45;
    const checkPageBreak = (heightNeeded: number) => {
      if (currentY + heightNeeded >= pageHeight - 20) { // 20mm footer buffer
        doc.addPage();
        currentY = 20; // Reset to top of new page
        return true;
      }
      return false;
    };

    // --- 1. HEADER SECTION ---
    const companyName = userData?.businessProfile?.businessName || user?.displayName || 'Financial Report';
    const reportDate = new Date().toLocaleDateString();

    // Company Name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(companyName, margin, 20);

    // Query/Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const splitTitle = doc.splitTextToSize(`Query: ${query}`, maxLineWidth - 50);
    doc.text(splitTitle, margin, 28);

    // Badge
    doc.setFillColor(230, 240, 255);
    doc.roundedRect(pageWidth - 50, 12, 36, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(0, 80, 180);
    doc.text('AI GENERATED', pageWidth - 46, 18);
    doc.setTextColor(100);
    doc.text(reportDate, pageWidth - 46, 24);

    // Divider Line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 35, pageWidth - margin, 35);

    // --- 2. PARSE CONTENT ---
    const lines = report.split('\n');
    let tableHeaders: string[] = [];
    let tableBody: string[][] = [];
    let isCollectingTable = false;

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // --- TABLE ROW DETECTION ---
      if (trimmedLine.startsWith('|')) {
        isCollectingTable = true;
        const row = trimmedLine
          .split('|')
          .slice(1, -1)
          .map((cell) => cleanText(cell));

        // Ignore divider rows (e.g., ---|---)
        if (row.some(cell => cell.includes('---'))) return;

        if (tableHeaders.length === 0) {
          tableHeaders = row;
        } else {
          tableBody.push(row);
        }
      } 
      // --- END OF TABLE / TEXT BLOCK ---
      else {
        // 1. Draw any pending table BEFORE drawing text
        if (isCollectingTable && tableHeaders.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [tableHeaders],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [41, 41, 41], textColor: 255, fontStyle: 'bold', halign: 'center' },
            // Important: 'linebreak' ensures text inside cells wraps instead of getting cut off
            styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak', lineColor: [220, 220, 220] },
            columnStyles: {
              // Right align the last column (usually Amount)
              [tableHeaders.length - 1]: { halign: 'right', font: 'courier' }
            },
            // Logic to bold specific rows (Total/Net Income)
            didParseCell: (data) => {
              const rawText = data.cell.raw as string;
              if (rawText.toLowerCase().includes('total') || rawText.toLowerCase().includes('net income')) {
                 data.cell.styles.fontStyle = 'bold';
                 data.cell.styles.fillColor = [245, 245, 245]; // Light gray background
              }
            },
            margin: { left: margin, right: margin }
          });

          // Update Y to be below the table
          currentY = (doc as any).lastAutoTable.finalY + 10;
          
          // Reset table buffers
          tableHeaders = [];
          tableBody = [];
          isCollectingTable = false;
        }

        // 2. Draw Text (Paragraphs, Bullets, Headers)
        if (trimmedLine !== '') {
          const cleanedLine = cleanText(trimmedLine);
          
          // HEADERS (##)
          if (trimmedLine.startsWith('##')) {
            checkPageBreak(15); // Check if we have room
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(cleanedLine, margin, currentY);
            currentY += 8;
          }
          // BULLETS or SUB-HEADERS (###, *)
          else if (trimmedLine.startsWith('###') || trimmedLine.startsWith('*') || trimmedLine.startsWith('•')) {
            checkPageBreak(10);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold'); // Bold for sub-points
            doc.setTextColor(50, 50, 50);
            
            // Handle bullet formatting
            const bulletText = cleanedLine.replace(/^[\*\•\-]\s?/, ''); // Remove the existing marker
            // Indent slightly and wrap text
            const splitText = doc.splitTextToSize(`• ${bulletText}`, maxLineWidth);
            doc.text(splitText, margin + 2, currentY);
            currentY += (splitText.length * 5) + 3;
          }
          // NORMAL TEXT
          else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            
            // Wrap text safely within margins
            const splitText = doc.splitTextToSize(cleanedLine, maxLineWidth);
            
            // Check if this specific paragraph needs a page break
            const heightNeeded = splitText.length * 5;
            checkPageBreak(heightNeeded);

            doc.text(splitText, margin, currentY);
            currentY += heightNeeded + 2; // Spacing between paragraphs
          }
        }
      }
    });

    // Catch-all: If report ends with a table (no text after it)
    if (isCollectingTable && tableHeaders.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [tableHeaders],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [41, 41, 41], textColor: 255, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
        columnStyles: { [tableHeaders.length - 1]: { halign: 'right', font: 'courier' } },
        didParseCell: (data) => {
           const rawText = data.cell.raw as string;
           if (rawText.toLowerCase().includes('total') || rawText.toLowerCase().includes('net income')) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [245, 245, 245];
           }
        },
        margin: { left: margin, right: margin }
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
    setHelpSources([]);

    try {
      const helpEnabled = isHelpEnabled();
      const isHelpQuestion = ['how do i', 'how to', 'where can i', 'what is'].some(prefix => query.toLowerCase().startsWith(prefix));

      if (helpEnabled && isHelpQuestion) {
        const result = await askHelpRag(query);
        setReport(result.answer);
        setHelpSources(result.sources);
      } else {
        const result = await generateFinancialReport({
          userQuery: query,
          userId: user.uid,
        });
        setReport(result);
      }
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

      {isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 gap-4 text-center">
             <div className="bg-primary/10 p-4 rounded-full">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
             </div>
             <div className="space-y-1">
                <h3 className="font-semibold text-lg">Report in Progress...</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                    Our AI is analyzing your transactions and writing your report. This may take a minute.
                </p>
             </div>
          </CardContent>
        </Card>
      )}

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
            {helpSources.length > 0 && (
              <div className="pt-4 mt-4 border-t">
                <h4 className="font-semibold text-sm mb-2">Sources</h4>
                <div className="flex flex-wrap gap-2">
                  {helpSources.map(source => (
                    <div key={source.id} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{source.title}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
