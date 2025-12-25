'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, getDocs, query, collectionGroup, where, writeBatch, doc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight, ChevronDown, FolderTree, Loader2, Combine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MergeCategoriesDialog } from '@/components/dashboard/transactions/MergeCategoriesDialog';

export default function ChartOfAccountsReport() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<any>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "Income": true, "Expense": true });
  const [isMergeToolOpen, setIsMergeToolOpen] = useState(false);

  const fetchData = async () => {
    if (!user || !firestore) return;
    setLoading(true);
    
    try {
      const q = query(collectionGroup(firestore, 'transactions'), where('userId', '==', user.uid));
      const accountsSnap = await getDocs(q);
      const hierarchy: any = {};

      accountsSnap.forEach(txDoc => {
        const tx = txDoc.data();
        const h = tx.categoryHierarchy || {};
        
        const l0 = h.l0 || (tx.amount > 0 ? "Income" : "Expense");
        const l1 = h.l1 || "General Group";
        const l2 = h.l2 || tx.subcategory || "Uncategorized Tax Line";
        const l3 = h.l3 || tx.description || "Misc Detail";
        const amt = Number(tx.amount) || 0;

        if (!hierarchy[l0]) hierarchy[l0] = { balance: 0, sub: {} };
        if (!hierarchy[l0].sub[l1]) hierarchy[l0].sub[l1] = { balance: 0, sub: {} };
        if (!hierarchy[l0].sub[l1].sub[l2]) hierarchy[l0].sub[l1].sub[l2] = { balance: 0, sub: {} };
        if (!hierarchy[l0].sub[l1].sub[l2].sub[l3]) hierarchy[l0].sub[l1].sub[l2].sub[l3] = { balance: 0 };

        hierarchy[l0].balance += amt;
        hierarchy[l0].sub[l1].balance += amt;
        hierarchy[l0].sub[l1].sub[l2].balance += amt;
        hierarchy[l0].sub[l1].sub[l2].sub[l3].balance += amt;
      });
      setTreeData(hierarchy);
    } catch (e) {
      console.error("COA Error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [user, firestore]);

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) return <div className="p-20 flex flex-col items-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /><p className="mt-4 text-muted-foreground">Building 4-Layer Hierarchy...</p></div>;

  return (
    <>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <FolderTree className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Chart of Accounts</h1>
          </div>
          <Button variant="outline" onClick={() => setIsMergeToolOpen(true)}>
            <Combine className="mr-2 h-4 w-4" />
            Merge Categories
          </Button>
        </div>

        <Card className="shadow-xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-900">
                <TableRow>
                  <TableHead className="text-white">Account Hierarchy (L0 → L3)</TableHead>
                  <TableHead className="text-right text-white">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(treeData).sort(([aName], [bName]) => {
                    const order = { 'Income': 1, 'Expense': 2, 'Asset': 3, 'Liability': 4, 'Equity': 5 };
                    return (order[aName as keyof typeof order] || 99) - (order[bName as keyof typeof order] || 99);
                }).map(([l0Name, l0]: any) => (
                  <RenderRow key={l0Name} name={l0Name} data={l0} level={0} expanded={expanded} onToggle={toggle} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <MergeCategoriesDialog 
        isOpen={isMergeToolOpen} 
        onOpenChange={setIsMergeToolOpen} 
        onSuccess={fetchData} // Refetch data on successful merge
      />
    </>
  );
}

function RenderRow({ name, data, level, expanded, onToggle }: any) {
  const isExpanded = expanded[name];
  const hasSub = data.sub && Object.keys(data.sub).length > 0;

  const styleConfig = [
    { padding: 'pl-4', font: 'font-bold', bg: 'bg-slate-100', text: 'text-slate-900' }, // L0
    { padding: 'pl-8', font: 'font-semibold', bg: 'bg-slate-50', text: 'text-slate-800' },  // L1
    { padding: 'pl-12', font: 'font-medium', bg: 'bg-white', text: 'text-slate-700' },   // L2
    { padding: 'pl-16', font: 'font-normal', bg: 'bg-white', text: 'text-slate-500' },    // L3
  ][level];

  return (
    <>
      <TableRow className={cn("cursor-pointer hover:bg-muted/50 transition-colors", styleConfig.bg)} onClick={() => hasSub && onToggle(name)}>
        <TableCell className={cn("flex items-center gap-2", styleConfig.padding, styleConfig.font, styleConfig.text)}>
          {hasSub ? (isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />) : <div className="w-4 shrink-0" />}
          {name}
        </TableCell>
        <TableCell className={cn(
            "text-right font-mono",
            styleConfig.font,
            data.balance >= 0 ? 'text-green-600' : 'text-slate-800'
        )}>
          {formatCurrency(data.balance)}
        </TableCell>
      </TableRow>
      {hasSub && isExpanded && Object.entries(data.sub).sort(([aName], [bName]) => aName.localeCompare(bName)).map(([subName, subData]: any) => (
        <RenderRow key={subName} name={subName} data={subData} level={level + 1} expanded={expanded} onToggle={toggle} />
      ))}
    </>
  );
}
