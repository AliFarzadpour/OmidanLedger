'use client';

import { useState } from 'react';
import { useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2, Building } from 'lucide-react';
import { generatePropertyReport } from '@/ai/flows/generate-property-report';
import { marked } from 'marked';

// Simple component to render markdown
function MarkdownReport({ content }: { content: string }) {
  const htmlContent = marked.parse(content);
  return (
    <div
      className="prose prose-sm md:prose-base dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

export function AIPropertyReportGenerator() {
  const { user } = useUser();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);

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
      // Call the new server action for property reports
      const result = await generatePropertyReport({
        userQuery: query,
        userId: user.uid,
      });

      setReport(result);
    } catch (error: any) {
      console.error('AI property report error:', error);
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
    'Which properties are vacant?',
    'Show my single-family homes in Dallas, TX',
    'List properties with rent over $2000/month',
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="Ask about your properties... e.g., 'Which of my units are vacant?'"
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
                <h3 className="font-semibold text-lg">Querying Your Portfolio...</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                    Our AI is analyzing your properties and writing a report. This may take a moment.
                </p>
             </div>
          </CardContent>
        </Card>
      )}

      {report && (
        <Card className="animate-in fade-in-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building className="h-6 w-6 text-primary" />
              <CardTitle>AI Property Report</CardTitle>
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
