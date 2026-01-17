'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { isSuperAdmin } from '@/lib/auth-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Sparkles, Loader2, AlertTriangle, BookOpen, DatabaseZap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { askHelp, indexHelpArticles } from '@/actions/help-actions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

function HelpCenterDisabled() {
    return (
        <Card className="border-amber-300 bg-amber-50 mt-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-5 w-5" />
                    Help Center Disabled
                </CardTitle>
                <CardDescription className="text-amber-700">
                    The AI-powered help center is not enabled in the current environment configuration.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-amber-900">
                    To enable this feature, please set the `NEXT_PUBLIC_ENABLE_HELP_RAG` environment variable to `true`.
                </p>
            </CardContent>
        </Card>
    );
}

function AdminIndexer() {
    const { user } = useUser();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isIndexing, setIsIndexing] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (user) {
            isSuperAdmin(user.uid).then(setIsAdmin);
        }
    }, [user]);

    const handleIndex = async () => {
        if (!user) return;
        setIsIndexing(true);
        try {
            const result = await indexHelpArticles(user.uid);
            toast({
                title: 'Indexing Complete',
                description: `${result.count} new articles have been indexed and are now searchable.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Indexing Failed',
                description: error.message,
            });
        } finally {
            setIsIndexing(false);
        }
    };

    if (!isAdmin) return null;

    return (
        <Card className="mt-8 bg-red-50 border-red-200">
            <CardHeader>
                <CardTitle className="text-red-900 flex items-center gap-2"><DatabaseZap/> Admin: Indexing</CardTitle>
                <CardDescription className="text-red-800">Process new help articles to make them searchable. Run this after adding new content to the `help_articles` collection.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="destructive" onClick={handleIndex} disabled={isIndexing}>
                    {isIndexing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {isIndexing ? 'Indexing...' : 'Index New Articles'}
                </Button>
            </CardContent>
        </Card>
    )
}

interface RAGResponse {
    answer: string;
    sources: { id: string; title: string; category: string }[];
}

export default function HelpCenterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHelpEnabled = process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
        const result = await askHelp(query);
        setResponse(result);
    } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
        toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
        setIsLoading(false);
    }
  };

  return (
      <div className="p-8 max-w-4xl mx-auto">
           <div className="flex items-center gap-4 mb-8">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                  <h1 className="text-3xl font-bold tracking-tight">Help Center</h1>
                  <p className="text-muted-foreground">Ask a question to get help from our AI assistant.</p>
              </div>
          </div>
          
          {!isHelpEnabled ? (
             <HelpCenterDisabled />
          ) : (
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/> AI Help Assistant</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Textarea
                                placeholder="Type your question here... e.g., 'How do I add a new property?'"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="min-h-[120px] text-base"
                                disabled={isLoading}
                            />
                            <Button type="submit" disabled={isLoading} className="w-full">
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                {isLoading ? 'Searching...' : 'Ask'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {response && (
                    <Card className="animate-in fade-in-50">
                        <CardHeader>
                            <CardTitle>Answer</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: response.answer.replace(/\n/g, '<br />') }} />
                            
                            {response.sources.length > 0 && (
                                <div className="pt-4 border-t">
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
                                        <BookOpen className="h-4 w-4" /> Sources
                                    </h4>
                                    <div className="flex flex-col gap-2">
                                        {response.sources.map(source => (
                                            <div key={source.id} className="text-xs p-2 bg-slate-50 rounded-md">
                                                {source.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
          )}
          <AdminIndexer />
      </div>
  );
}
