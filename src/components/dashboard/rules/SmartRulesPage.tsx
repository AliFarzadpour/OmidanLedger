'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, BrainCircuit, Edit2, Plus, ArrowUpDown, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type SortKey = 'originalKeyword' | 'category' | 'source';
type SortDirection = 'ascending' | 'descending';

export default function SmartRulesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // Form state
  const [merchant, setMerchant] = useState('');
  const [primaryCategory, setPrimaryCategory] = useState('Operating Expenses');
  const [secondaryCategory, setSecondaryCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');

  // Filtering and Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'originalKeyword', direction: 'ascending' });


  const fetchRules = async () => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      const collectionPath = isAdminMode 
        ? 'globalVendorMap' 
        : `users/${user.uid}/categoryMappings`;
      
      const q = query(collection(firestore, collectionPath));
      const snapshot = await getDocs(q);
      
      const fetchedRules = snapshot.docs.map(d => ({ 
          id: d.id, 
          primaryCategory: d.data().primaryCategory || d.data().primary,
          secondaryCategory: d.data().secondaryCategory || d.data().secondary,
          subcategory: d.data().subcategory || d.data().sub,
          originalKeyword: d.data().originalKeyword || d.data().transactionDescription || d.id,
          ...d.data() 
      }));
      setRules(fetchedRules);
    } catch (error) {
      console.error("Error fetching rules:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not fetch rules." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [user, firestore, isAdminMode]);

  const handleOpenDialog = (rule: any = null) => {
    if (rule) {
        setEditingRule(rule);
        setMerchant(rule.originalKeyword);
        setPrimaryCategory(rule.primaryCategory);
        setSecondaryCategory(rule.secondaryCategory);
        setSubcategory(rule.subcategory);
    } else {
        setEditingRule(null);
        setMerchant('');
        setPrimaryCategory('Operating Expenses');
        setSecondaryCategory('');
        setSubcategory('');
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!merchant || !primaryCategory || !secondaryCategory || !subcategory || !user || !firestore) {
        toast({ variant: 'destructive', title: "Missing Fields", description: "Please fill out all keyword and category fields." });
        return;
    }
    setIsSaving(true);

    const cleanId = editingRule?.id || merchant.toUpperCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "_")
      .replace(/\s+/g, '_');

    let ruleData: any = {
      updatedAt: serverTimestamp(),
      source: isAdminMode ? 'Admin Manual' : 'User Manual'
    };

    if (isAdminMode) {
      ruleData = {
        ...ruleData,
        originalKeyword: merchant,
        primary: primaryCategory,
        secondary: secondaryCategory,
        sub: subcategory
      };
    } else {
      ruleData = {
        ...ruleData,
        userId: user.uid,
        transactionDescription: merchant,
        primaryCategory,
        secondaryCategory,
        subcategory,
      };
    }

    const collectionPath = isAdminMode ? 'globalVendorMap' : `users/${user.uid}/categoryMappings`;

    try {
      await setDoc(doc(firestore, collectionPath, cleanId), ruleData, { merge: true });
      toast({ title: editingRule ? "Rule Updated" : "Rule Saved", description: `Rule for "${merchant}" has been saved.` });
      
      setIsDialogOpen(false);
      fetchRules();

    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !firestore) return;
    const collectionPath = isAdminMode ? 'globalVendorMap' : `users/${user.uid}/categoryMappings`;
    try {
      await deleteDoc(doc(firestore, collectionPath, id));
      toast({ title: "Rule Deleted" });
      fetchRules();
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
        setDeletingRuleId(null);
    }
  };

  const filteredAndSortedRules = useMemo(() => {
    let filtered = [...rules];
    
    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(rule => 
            rule.originalKeyword.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Filter by source
    if (sourceFilter !== 'all') {
        filtered = filtered.filter(rule => rule.source === sourceFilter);
    }
    
    // Sort
    filtered.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortConfig.key) {
            case 'category':
                aValue = `${a.primaryCategory} > ${a.secondaryCategory} > ${a.subcategory}`;
                bValue = `${b.primaryCategory} > ${b.secondaryCategory} > ${b.subcategory}`;
                break;
            case 'source':
                aValue = a.source || '';
                bValue = b.source || '';
                break;
            case 'originalKeyword':
            default:
                aValue = a.originalKeyword || '';
                bValue = b.originalKeyword || '';
        }
        
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
    });

    return filtered;
  }, [rules, searchTerm, sourceFilter, sortConfig]);

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
            {isAdminMode ? 'Editing the Global Master Rules for all users.' : 'Managing your personal categorization rules.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2 bg-muted p-2 rounded-lg">
                <Label htmlFor="admin-mode" className="font-normal text-sm">Personal</Label>
                <Switch
                    id="admin-mode"
                    checked={isAdminMode}
                    onCheckedChange={setIsAdminMode}
                    disabled={user?.uid !== 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2'}
                />
                <Label htmlFor="admin-mode" className="font-normal text-sm">Admin</Label>
            </div>
            <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" /> Add Rule
            </Button>
        </div>
      </div>
      
      {/* Filter and Search Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 border rounded-lg">
        <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Filter by keyword..."
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
                <TableHead><Button variant="ghost" onClick={() => requestSort('source')}>Source {getSortIcon('source')}</Button></TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
              ) : filteredAndSortedRules.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No rules match your filters.</TableCell></TableRow>
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
                    <Label>If vendor name contains...</Label>
                    <Input 
                        value={merchant}
                        onChange={(e) => setMerchant(e.target.value)}
                        placeholder="e.g., STARBUCKS"
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Assign Primary Category</Label>
                    <Input 
                        value={primaryCategory}
                        onChange={(e) => setPrimaryCategory(e.target.value)}
                        placeholder="e.g., Operating Expenses"
                    />
                </div>
                 <div className="grid gap-2">
                    <Label>Assign Secondary Category</Label>
                    <Input 
                        value={secondaryCategory}
                        onChange={(e) => setSecondaryCategory(e.target.value)}
                        placeholder="e.g., Meals & Entertainment"
                    />
                </div>
                 <div className="grid gap-2">
                    <Label>Assign Subcategory</Label>
                    <Input 
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                        placeholder="e.g., Business Meals"
                    />
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
