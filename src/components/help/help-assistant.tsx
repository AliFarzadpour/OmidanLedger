'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase'; // Adjust if your user hook is different
import { isSuperAdmin } from '@/lib/auth-utils';
import { isHelpEnabled } from '@/lib/help/help-config';
import { 
  askHelpRag, 
  generateHelpArticlesFromCodebase, 
  generateSpecificArticle, 
  indexHelpArticles,
  getAllHelpArticles,
  deleteHelpArticle
} from '@/actions/help-actions';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, BrainCircuit, FilePlus, ListTree, PlusCircle, Trash2, Search, RefreshCw, HelpCircle, Wrench, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { marked } from 'marked';

// --- Markdown Helper ---
function Markdown({ content }: { content: string }) {
  if (!content) return null;
  const html = marked.parse(content);
  return <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function HelpAssistant() {
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("ask");
  
  // Ask State
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Admin State
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [topic, setTopic] = useState('');
  const [articles, setArticles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Hydration fix
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (user?.uid) isSuperAdmin(user.uid).then(setIsAdmin);
  }, [user]);

  if (!isHelpEnabled() || !isClient) {
    return null;
  }

  // --- HANDLERS ---
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

  const loadArticles = async () => {
    if (!user) return;
    try {
      const data = await getAllHelpArticles(user.uid);
      setArticles(data);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    try {
      await deleteHelpArticle(user!.uid, id);
      setArticles(prev => prev.filter(a => a.id !== id));
      toast({ title: "Deleted" });
    } catch (e: any) { toast({ title: "Error", description: e.message }); }
  };

  const handleGenerateSpecific = async () => {
    if (!topic.trim()) return;
    setIsAdminLoading(true);
    try {
      const res = await generateSpecificArticle(user!.uid, topic);
      if (res.success) {
        toast({ title: "Success", description: `Created: ${res.title}` });
        setTopic('');
        loadArticles();
      }
    } catch (e: any) { toast({ variant: 'destructive', description: e.message }); }
    finally { setIsAdminLoading(false); }
  };

  const handleIndex = async () => {
    setIsAdminLoading(true);
    try {
      const res = await indexHelpArticles(user!.uid);
      if (res.ok) toast({ title: "Indexed", description: `Indexed: ${res.indexed}` });
      else toast({ variant: 'destructive', description: res.errors[0] });
    } catch (e: any) { toast({ description: e.message }); }
    finally { setIsAdminLoading(false); }
  };

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {/* 1. THE TRIGGER BUTTON (Visible in Navigation or Bottom Right) */}
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 z-50"
          title="Open Help Assistant"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </SheetTrigger>

      {/* 2. THE DRAWER CONTENT */}
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <BrainCircuit className="h-6 w-6 text-primary" /> 
            Omidan Assistant
          </SheetTitle>
        </SheetHeader>

        <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs">
            Articles are prepared by an AI assistant and may contain inaccuracies. Please verify critical information. For questions, contact <a href="mailto:Dev@OmidanAI.com" className="font-semibold">Dev@OmidanAI.com</a>.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ask">Ask Question</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin" className="text-red-600">Admin Tools</TabsTrigger>}
          </TabsList>

          {/* --- TAB 1: ASK (User View) --- */}
          <TabsContent value="ask" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Textarea
                placeholder="How do I add a property? Where is the Debt Center?"
                className="min-h-[100px] text-base"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              />
              <Button onClick={handleAsk} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Ask AI
              </Button>
            </div>

            {answer && (
              <Card className="bg-blue-50/50 border-blue-100 animate-in slide-in-from-bottom-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600"/> Answer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Markdown content={answer} />
                  
                  {sources.length > 0 && (
                    <div className="pt-3 border-t border-blue-200">
                      <p className="text-xs font-semibold text-blue-800 mb-2">Sources:</p>
                      <div className="flex flex-wrap gap-2">
                        {sources.map((s, i) => (
                          <Badge key={i} variant="secondary" className="bg-white hover:bg-white text-[10px] text-slate-600 border-blue-200">
                            {s.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* --- TAB 2: ADMIN (Manager View) --- */}
          {isAdmin && (
            <TabsContent value="admin" className="space-y-6 mt-4">
              
              {/* Add Article */}
              <div className="p-4 rounded-lg bg-red-50 border border-red-100 space-y-3">
                <div className="flex items-center gap-2 text-red-900 font-semibold text-sm">
                  <PlusCircle className="h-4 w-4"/> Add Specific Knowledge
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g. How DSCR is calculated" 
                    value={topic} 
                    onChange={e => setTopic(e.target.value)}
                    className="bg-white"
                  />
                  <Button size="sm" variant="destructive" onClick={handleGenerateSpecific} disabled={isAdminLoading}>
                    Create
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="w-full bg-white text-red-900 border-red-200 hover:bg-red-100" onClick={handleIndex} disabled={isAdminLoading}>
                  <RefreshCw className="mr-2 h-3 w-3"/> Re-Index Database
                </Button>
              </div>

              {/* Manage Articles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Knowledge Base</h3>
                  <Button variant="ghost" size="sm" onClick={loadArticles}><RefreshCw className="h-3 w-3"/></Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search titles..." 
                    className="pl-8" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="h-[300px] overflow-y-auto border rounded-md bg-white">
                  {filteredArticles.length === 0 ? (
                     <div className="p-4 text-center text-xs text-muted-foreground">Click refresh to load articles</div>
                  ) : (
                    <div className="divide-y">
                      {filteredArticles.map(a => (
                        <div key={a.id} className="p-3 flex justify-between items-start hover:bg-slate-50">
                          <div>
                            <p className="text-sm font-medium line-clamp-1">{a.title}</p>
                            <Badge variant="outline" className="text-[10px] mt-1">{a.category}</Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => handleDelete(a.id)}>
                            <Trash2 className="h-3 w-3"/>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
