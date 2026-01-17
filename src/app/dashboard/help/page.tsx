'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { isSuperAdmin } from '@/lib/auth-utils';
import { isHelpEnabled } from '@/lib/help/help-config';
import { askHelpRag, generateHelpArticlesFromCodebase, indexHelpArticles } from '@/actions/help-actions';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Sparkles, BrainCircuit, AlertCircle, FilePlus, ListTree } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { marked } from 'marked';

function Markdown({ content }: { content: string }) {
  if (!content) return null;
  const html = marked.parse(content);
  return <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function HelpPage() {
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      isSuperAdmin(user.uid).then(setIsAdmin);
    }
  }, [user]);

  const enabled = isHelpEnabled();

  const handleAsk = async () => {
    if (!question.trim()) return;
    setIsLoading(true);
    setAnswer(null);
    setSources([]);
    try {
      const result = await askHelpRag(question);
      setAnswer(result.answer);
      setSources(result.sources);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!user) return;
    setIsAdminActionLoading(true);
    try {
      const result = await generateHelpArticlesFromCodebase(user.uid);
      toast({ title: "Content Generated", description: `${result.created} help articles were created.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsAdminActionLoading(false);
    }
  };
  
  const handleIndex = async () => {
    if (!user) return;
    setIsAdminActionLoading(true);
    try {
      const result = await indexHelpArticles(user.uid);
      toast({ title: "Indexing Complete", description: `${result.updated} articles were indexed.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsAdminActionLoading(false);
    }
  };
  
  if (!enabled) {
    return (
      <div className="p-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Feature Disabled</AlertTitle>
          <AlertDescription>The AI Help Assistant is not enabled in the current environment.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">AI Help Assistant</h1>
        <p className="text-muted-foreground mt-2">Ask questions about using FiscalFlow. I'll search our help articles to find an answer.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Textarea
              placeholder="e.g., How do I add a new property? or Why is my bank sync not working?"
              className="min-h-[120px]"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isLoading}
            />
            <Button onClick={handleAsk} disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Ask AI
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Searching for answers...</p>
        </div>
      )}

      {answer && (
        <Card className="animate-in fade-in-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary"/> Answer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Markdown content={answer} />
            {sources.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-2">Sources</h4>
                <div className="flex flex-wrap gap-2">
                  {sources.map(source => (
                    <div key={source.id} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{source.title}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {isAdmin && (
        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-900">Admin Controls</CardTitle>
            <CardDescription className="text-red-800">For super-admin use only.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button variant="destructive" onClick={handleGenerate} disabled={isAdminActionLoading}>
              <FilePlus className="mr-2 h-4 w-4"/> Generate Help Content
            </Button>
            <Button variant="destructive" onClick={handleIndex} disabled={isAdminActionLoading}>
              <ListTree className="mr-2 h-4 w-4"/> Index Embeddings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
