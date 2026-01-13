
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, BrainCircuit, Edit2, Plus, ArrowUpDown, Search, Wand2, AlertCircle, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { learnCategoryMapping } from '@/ai/flows/learn-category-mapping';
import { CATEGORY_MAP, L0Category } from '@/lib/categories';
import { PlusCircle } from 'lucide-react';

function HierarchicalCategorySelector({ l0, setL0, l1, setL1, l2, setL2 }: {
  l0: string; setL0: (val: string) => void;
  l1: string; setL1: (val: string) => void;
  l2: string; setL2: (val: string) => void;
}) {
  const l1Options = l0 && CATEGORY_MAP[l0 as L0Category] ? Object.keys(CATEGORY_MAP[l0 as L0Category]) : [];
  const l2Options = (l0 && l1 && CATEGORY_MAP[l0 as L0Category] && (CATEGORY_MAP[l0 as L0Category] as any)[l1]) ? (CATEGORY_MAP[l0 as L0Category] as any)[l1] : [];

  return (
    <div className="space-y-2 p-3 border rounded-md bg-slate-50">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="l0">Category (L0)</Label>
        <Select value={l0} onValueChange={val => { setL0(val); setL1(''); setL2(''); }}>
            <SelectTrigger id="l0" className="col-span-3 h-8 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
                {Object.keys(CATEGORY_MAP).map(key => <SelectItem key={key} value={key}>{key}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>
       <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="l1">Group (L1)</Label>
        <div className="col-span-3 flex gap-1">
            <Select value={l1} onValueChange={val => { setL1(val); setL2(''); }} disabled={!l0}>
                <SelectTrigger id="l1" className="h-8 bg-white"><SelectValue placeholder="Select L1..." /></SelectTrigger>
                <SelectContent>
                    {l1Options.map((key: string) => <SelectItem key={key} value={key}>{key}</SelectItem>)}
                    <SelectItem value="--add-new--"><span className="flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Add New...</span></SelectItem>
                </SelectContent>
            </Select>
            {l1 === '--add-new--' && <Input placeholder="New L1 Category" onChange={e => setL1(e.target.value)} className="h-8"/>}
        </div>
      </div>
       <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="l2">Tax Line (L2)</Label>
        <div className="col-span-2 flex gap-1">
            <Select value={l2} onValueChange={setL2} disabled={!l1 || l1 === '--add-new--'}>
                <SelectTrigger id="l2" className="h-8 bg-white"><SelectValue placeholder="Select L2..." /></SelectTrigger>
                <SelectContent>
                    {l2Options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    <SelectItem value="--add-new--"><span className="flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Add New...</span></SelectItem>
                </SelectContent>
            </Select>
            {l2 === '--add-new--' && <Input placeholder="New L2 Category" onChange={e => setL2(e.target.value)} className="h-8"/>}
        </div>
      </div>
    </div>
  );
}


type SortKey = 'originalKeyword' | 'category' | 'source' | 'propertyId';
type SortDirection = 'ascending' | 'descending';

const ADMIN_USER_ID = 'ZzqaKaPSOGgg6eALbbs5NY9DRVZ2';

export default function SmartRulesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isClient, setIsClient] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // Form state
  const [merchant, setMerchant] = useState('');
  const [l0, setL0] = useState('');
  const [l1, setL1] = useState('');
  const [l2, setL2] = useState('');
  const [propertyId, setPropertyId] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: SortDirection }>({ key: 'originalKeyword', direction: 'ascending' });
  
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection(propertiesQuery);
  const propertyMap = useMemo(() => properties?.reduce((map, p) => ({...map, [p.id]: p.name}), {}) || {}, [properties]);

  const isUserAdmin = user?.uid === ADMIN_USER_ID;

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchRules = async () => {
    if (!user || !firestore) return;
    setLoading(true);
    setFetchError(null);
    try {
      const collectionPath = isAdminMode && isUserAdmin ? 'globalVendorMap' : `users/${user.uid}/categoryMappings`;
      const q = query(collection(firestore, collectionPath));
      const snapshot = await getDocs(q);
      
      const fetchedRules = snapshot.docs.map(d => {
        const data = d.data();
        const cats = data.categoryHierarchy || {};
        return { 
          id: d.id, 
          primaryCategory: cats.l0 || data.primary,
          secondaryCategory: cats.l1 || data.secondary,
          subcategory: cats.l2 || data.sub,
          originalKeyword: data.transactionDescription || data.originalKeyword || d.id,
          ...data 
        }
      });
      setRules(fetchedRules);
    } catch (error: any) {
      console.error("Error fetching rules:", error);
      setFetchError(error.message);
      toast({ variant: 'destructive', title: "Error", description: "Could not fetch rules." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [user, firestore, isAdminMode, isUserAdmin]);

  const handleOpenDialog = (rule: any = null) => {
    if (rule) {
        setEditingRule(rule);
        setMerchant(rule.originalKeyword);
        const cats = rule.categoryHierarchy || {};
        setL0(cats.l0 || rule.primaryCategory);
        setL1(cats.l1 || rule.secondaryCategory);
        setL2(cats.l2 || rule.subcategory);
        setPropertyId(rule.propertyId || '');
    } else {
        setEditingRule(null);
        setMerchant('');
        setL0('OPERATING EXPENSE');
        setL1('');
        setL2('');
        setPropertyId('');
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!merchant || !l0 || !l1 || !l2 || !user) {
        toast({ variant: 'destructive', title: "Missing Fields", description: "Please fill out all keyword and category fields." });
        return;
    }
    setIsSaving(true);
    
    try {
        await learnCategoryMapping({
            transactionDescription: merchant,
            primaryCategory: l0,
            secondaryCategory: l1,
            subcategory: l2,
            userId: user.uid,
            propertyId: propertyId,
        });

        toast({ title: editingRule ? "Rule Updated" : "Rule Saved", description: `Rule for "${merchant}" has been saved.` });
        setIsDialogOpen(false);
        fetchRules();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !firestore) return;
    const collectionPath = isAdminMode && isUserAdmin ? 'globalVendorMap' : `users/${user.uid}/categoryMappings`;
    try {
      await deleteDoc(doc(firestore, collectionPath, id));
      toast({ title: "Rule Deleted" });
      fetchRules();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setDeletingRuleId(null);
    }
  };

  const filteredAndSortedRules = useMemo(() => {
    let filtered = [...rules];
    
    if (searchTerm) {
        const lowercasedFilter = searchTerm.toLowerCase();
        filtered = filtered.filter(rule => {
            const categoryString = `${rule.primaryCategory} ${rule.secondaryCategory} ${rule.subcategory}`.toLowerCase();
            const keywordMatch = rule.originalKeyword.toLowerCase().includes(lowercasedFilter);
            const categoryMatch = categoryString.includes(lowercasedFilter);
            const propertyMatch = (propertyMap[rule.propertyId] || '').toLowerCase().includes(lowercasedFilter);
            return keywordMatch || categoryMatch || propertyMatch;
        });
    }

    if (sourceFilter !== 'all') {
        filtered = filtered.filter(rule => rule.source === sourceFilter);
    }
    
    filtered.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortConfig.key) {
            case 'category':
                aValue = `${a.primaryCategory} > ${a.secondaryCategory} > ${a.subcategory}`;
                bValue = `${b.primaryCategory} > ${b.secondaryCategory} > ${b.subcategory}`;
                break;
            case 'propertyId':
                aValue = propertyMap[a.propertyId] || 'zzzz';
                bValue = propertyMap[b.propertyId] || 'zzzz';
                break;
            default:
                aValue = a[sortConfig.key] || '';
                bValue = b[sortConfig.key] || '';
        }
        
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
    });

    return filtered;
  }, [rules, searchTerm, sourceFilter, sortConfig, propertyMap]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => (
    sortConfig.key === key ? <ArrowUpDown className="h-4 w-4 inline" /> : <ArrowUpDown className="h-4 w-4 inline opacity-30" />
  );

  const allSources = useMemo(() => [...new Set(rules.map(r => r.source || 'Unknown'))], [rules]);

  if (!isClient) {
    return null;
  }

  return (
    <>
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BrainCircuit className="h-8 w-8 text-primary" />
            Smart Rules Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdminMode && isUserAdmin
              ? 'You are editing the GLOBAL master rules which apply to all users.' 
              : 'Managing your PERSONAL categorization rules for your account.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
            {isUserAdmin && (
              <div className="flex items-center space-x-2 bg-muted p-2 rounded-lg">
                  <Label htmlFor="admin-mode" className="font-normal text-sm">Personal</Label>
                  <Switch
                      id="admin-mode"
                      checked={isAdminMode}
                      onCheckedChange={setIsAdminMode}
                  />
                  <Label htmlFor="admin-mode" className="font-normal text-sm">Admin</Label>
              </div>
            )}
            <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" /> Add Rule
            </Button>
        </div>
      </div>
      
      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Fetching Data</AlertTitle>
          <AlertDescription className="font-mono text-xs break-all">
            {fetchError}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 border rounded-lg">
        <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Filter by keyword or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
            />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by source..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {allSources.map(source => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><Button variant="ghost" onClick={() => requestSort('originalKeyword')}>Keyword {getSortIcon('originalKeyword')}</Button></TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('category')}>Assigned Category {getSortIcon('category')}</Button></TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('propertyId')}>Cost Center {getSortIcon('propertyId')}</Button></TableHead>
                <TableHead><Button variant="ghost" onClick={() => requestSort('source')}>Source {getSortIcon('source')}</Button></TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
              ) : filteredAndSortedRules.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No rules match your filters.</TableCell></TableRow>
              ) : (
                filteredAndSortedRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.originalKeyword}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{rule.primaryCategory}</span>
                        <span className="text-xs text-muted-foreground">
                            {rule.secondaryCategory} &gt; {rule.subcategory}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                        {rule.propertyId ? <Badge variant="secondary">{propertyMap[rule.propertyId] || rule.propertyId}</Badge> : <span className="text-xs text-muted-foreground italic">Global</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.source || 'Unknown'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(rule)}>
                          <Edit2 className="h-4 w-4 text-slate-500 hover:text-blue-600"/>
                       </Button>
                       {deletingRuleId === rule.id ? (
                           <Button variant="destructive" size="sm" onClick={() => handleDelete(rule.id)}>Confirm</Button>
                       ) : (
                           <Button variant="ghost" size="icon" onClick={() => setDeletingRuleId(rule.id)}>
                            <Trash2 className="h-4 w-4 text-slate-500 hover:text-red-600" />
                          </Button>
                       )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Add New Rule'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="grid gap-2">
                    <Label>If transaction description contains...</Label>
                    <Input 
                        value={merchant}
                        onChange={(e) => setMerchant(e.target.value)}
                        placeholder="e.g., STARBUCKS"
                    />
                </div>
                
                <HierarchicalCategorySelector l0={l0} setL0={setL0} l1={l1} setL1={setL1} l2={l2} setL2={setL2} />
                
                <div className="grid gap-2">
                   <Label className="flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground" /> Assign to Property (Cost Center)</Label>
                   <Select value={propertyId} onValueChange={setPropertyId}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Optional: Assign to a property" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-- Global (No Property) --</SelectItem>
                        {isLoadingProperties ? <Loader2 className="animate-spin" /> : properties?.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                   </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Rule'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
