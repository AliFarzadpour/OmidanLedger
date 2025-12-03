'use client';

import { useState } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BrainCircuit, Sparkles } from 'lucide-react';
import { generateFinancialReport } from '@/ai/flows/generate-financial-report';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { marked } from 'marked';
import { collectionGroup, getDocs, query, where } from 'firebase/firestore';

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

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  primaryCategory: string;
  secondaryCategory: string;
  subcategory: string;
}

export function AIReportGenerator() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !user || !firestore) {
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
      // 1. Fetch data on the client
      const transactionsQuery = query(
        collectionGroup(firestore, 'transactions'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(transactionsQuery);
      const transactions = snapshot.docs.map(doc => doc.data() as Transaction);

      if (transactions.length === 0) {
        setReport("I couldn't find any transaction data to analyze. Please add some transactions and try again.");
        setIsLoading(false);
        return;
      }

      // 2. Format data for the AI
      const transactionDataString = transactions
        .map(t => `${t.date},${t.description},${t.amount.toFixed(2)},${t.primaryCategory} > ${t.secondaryCategory} > ${t.subcategory}`)
        .join('\n');

      // 3. Call the AI flow with the data
      const result = await generateFinancialReport({
        userQuery: query,
        transactionData: transactionDataString,
      });
      setReport(result);
    } catch (error) {
      console.error('Error generating AI report:', error);
      toast({
        variant: 'destructive',
        title: 'Error Generating Report',
        description: 'There was a problem communicating with the AI. Please try again.',
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
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-primary" />
              <CardTitle>AI Generated Report</CardTitle>
            </div>
            <CardDescription>Based on your question: "{query}"</CardDescription>
          </CardHeader>
          <CardContent>
             <MarkdownReport content={report} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
