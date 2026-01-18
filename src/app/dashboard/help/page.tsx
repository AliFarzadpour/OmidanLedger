'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { isSuperAdmin } from '@/lib/auth-utils';
import { isHelpEnabled } from '@/lib/help/help-config';
import { 
  askHelpRag, 
  generateHelpArticlesFromCodebase, 
  generateSpecificArticle, 
  indexHelpArticles,
  getAllHelpArticles, // <--- New Import
  deleteHelpArticle   // <--- New Import
} from '@/actions/help-actions';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, BrainCircuit, AlertCircle, FilePlus, ListTree, PlusCircle, Trash2, Search, RefreshCw } from 'lucide-react';
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
  const [topic, setTopic] = useState(''); 
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);

  // --- NEW: Article Management State ---
  const [articles, setArticles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isArticlesLoading, setIsArticlesLoading] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      isSuperAdmin(user.uid).then(setIsAdmin);
    }
  }, [user]);

  // Load articles when Admin section is ready (optional, or load on click)
  const loadArticles = async () => {
    if (!user) return;
    setIsArticlesLoading(true);
    try {
      const data = await getAllHelpArticles(user.uid);
      setArticles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsArticlesLoading(false);
    }
  };

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
      toast({ title: "Bulk Generation Complete", description: `${result.created} articles created for category: ${result.category}` });
      loadArticles(); // Refresh list
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const handleGenerateSpecific = async () => {
    if (!user || !topic.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter a topic first.' });
        return;
    }
    setIsAdminActionLoading(true);
    try {
      const result = await generateSpecificArticle(user.uid, topic);
      if (result.success) {
          toast({ title: "Article Created", description: `Successfully added: "${result.title}"` });
          setTopic(''); 
          loadArticles(); // Refresh list
      }
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
      if (result.ok) {
        toast({ title: "Indexing Complete", description: `Indexed: ${result.indexed}, Skipped: ${result.skipped}` });
      } else {
        toast({ variant: 'destructive', title: 'Indexing Failed', description: result.errors[0] });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  // --- NEW: Delete Handler ---
  const handleDelete = async (id: string) => {
    if (!user || !confirm("Are you sure you want to delete this article?")) return;
    try {
      await deleteHelpArticle(user.uid, id);
      toast({ title: "Deleted", description: "Article removed." });
      setArticles(prev => prev.filter(a => a.id !== id));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };
  
  // Filter articles based on search
  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!enabled) {
    return (
      <div className="p-8"><Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Feature Disabled</AlertTitle></Alert></div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">AI Help Assistant</h1>
        <p className="text-muted-foreground mt-2">Ask questions about using Omidan Ledger.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Textarea
              placeholder="e.g., How do I add a new property?"
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

      {answer && (
        <Card className="animate-in fade-in-50 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary"/> Answer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Markdown content={answer} />
            {sources.length > 0 && (
              <div className="pt-4 border-t border-blue-200">
                <h4 className="font-semibold text-sm mb-2 text-blue-900">Sources Used:</h4>
                <div className="flex flex-wrap gap-2">
                  {sources.map(source => (
                    <div key={source.id} className="text-xs bg-white border border-blue-200 text-blue-800 px-3 py-1 rounded-full shadow-sm">
                      {source.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {isAdmin && (
        <div className="space-y-8">
            <Card className="bg-red-50 border-red-200">
            <CardHeader>
                <CardTitle className="text-red-900">Admin Controls</CardTitle>
                <CardDescription className="text-red-800">Generate and Manage Content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                
                {/* 1. Add Single Article */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-red-900">Add Specific Article</label>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Enter topic (e.g. How to track Maintenance)" 
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="bg-white"
                        />
                        <Button variant="destructive" onClick={handleGenerateSpecific} disabled={isAdminActionLoading}>
                            <PlusCircle className="mr-2 h-4 w-4"/> Create
                        </Button>
                    </div>
                </div>

                <div className="border-t border-red-200 my-4"></div>

                {/* 2. Bulk Actions */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-red-900">System Actions</label>
                    <div className="flex gap-4">
                        <Button variant="outline" className="border-red-300 text-red-900 hover:bg-red-100" onClick={handleGenerate} disabled={isAdminActionLoading}>
                        <FilePlus className="mr-2 h-4 w-4"/> Generate Batch
                        </Button>
                        <Button variant="outline" className="border-red-300 text-red-900 hover:bg-red-100" onClick={handleIndex} disabled={isAdminActionLoading}>
                        <ListTree className="mr-2 h-4 w-4"/> Index Embeddings
                        </Button>
                    </div>
                </div>
            </CardContent>
            </Card>

            {/* 3. NEW: Knowledge Base Manager */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Knowledge Base Manager</CardTitle>
                        <CardDescription>View and delete help articles.</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadArticles} disabled={isArticlesLoading}>
                        <RefreshCw className={`h-4 w-4 ${isArticlesLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search articles..." 
                            className="pl-8" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="rounded-md border h-[300px] overflow-y-auto">
                        {articles.length === 0 && !isArticlesLoading ? (
                            <div className="p-8 text-center text-muted-foreground">
                                No articles loaded. Click the refresh button.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filteredArticles.map((article) => (
                                    <div key={article.id} className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                                        <div className="space-y-1">
                                            <p className="font-medium text-sm">{article.title}</p>
                                            <div className="flex gap-2">
                                                <Badge variant="secondary" className="text-[10px]">{article.category}</Badge>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(article.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                        Total Articles: {articles.length}
                    </div>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}