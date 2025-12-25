'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight, ChevronDown, FolderTree, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChartOfAccountsReport() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<any>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "Income": true, "Operating Expenses": true, "Expense": true });

  useEffect(() => {
    async function buildCOA() {
      if (!user || !firestore) return;
      setLoading(true);
      
      try {
        const accountsRef = collection(firestore, `users/${user.uid}/bankAccounts`);
        const accountsSnap = await getDocs(accountsRef);
        const hierarchy: any = {};

        // Aggregate across all accounts
        for (const accountDoc of accountsSnap.docs) {
          const txRef = collection(firestore, `users/${user.uid}/bankAccounts/${accountDoc.id}/transactions`);
          const txSnap = await getDocs(txRef);

          txSnap.forEach(txDoc => {
            const tx = txDoc.data();
            const h = tx.categoryHierarchy || {};
            
            // Normalize the 4 Layers
            const l0 = h.l0 || (tx.amount > 0 ? "Income" : "Operating Expenses");
            const l1 = h.l1 || "General Group";
            const l2 = h.l2 || tx.subcategory || "Uncategorized Tax Line";
            const l3 = h.l3 || tx.description || "Misc Detail";
            const amt = Number(tx.amount) || 0;

            // Build Tree: L0 -> L1 -> L2 -> L3
            if (!hierarchy[l0]) hierarchy[l0] = { balance: 0, sub: {} };
            if (!hierarchy[l0].sub[l1]) hierarchy[l0].sub[l1] = { balance: 0, sub: {} };
            if (!hierarchy[l0].sub[l1].sub[l2]) hierarchy[l0].sub[l1].sub[l2] = { balance: 0, sub: {} };
            if (!hierarchy[l0].sub[l1].sub[l2].sub[l3]) hierarchy[l0].sub[l1].sub[l2].sub[l3] = { balance: 0 };

            hierarchy[l0].balance += amt;
            hierarchy[l0].sub[l1].balance += amt;
            hierarchy[l0].sub[l1].sub[l2].balance += amt;
            hierarchy[l0].sub[l1].sub[l2].sub[l3].balance += amt;
          });
        }
        setTreeData(hierarchy);
      } catch (e) {
        console.error("COA Error:", e);
      } finally {
        setLoading(false);
      }
    }
    buildCOA();
  }, [user, firestore]);

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) return <div className="p-20 flex flex-col items-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /><p className="mt-4 text-muted-foreground">Building 4-Layer Hierarchy...</p></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FolderTree className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Chart of Accounts</h1>
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
              {Object.entries(treeData).map(([l0Name, l0]: any) => (
                <RenderRow key={l0Name} name={l0Name} data={l0} level={0} expanded={expanded} onToggle={toggle} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RenderRow({ name, data, level, expanded, onToggle }: any) {
  const isExpanded = expanded[name];
  const hasSub = data.sub && Object.keys(data.sub).length > 0;
  const paddingClass = ["pl-4 font-black bg-slate-100", "pl-8 font-bold bg-slate-50", "pl-12 font-semibold", "pl-16 italic text-muted-foreground"][level];

  return (
    <>
      <TableRow className={cn("cursor-pointer hover:bg-muted/50 transition-colors", paddingClass)} onClick={() => hasSub && onToggle(name)}>
        <TableCell className="flex items-center gap-2">
          {hasSub ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <div className="w-4" />}
          {name}
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatCurrency(data.balance)}
        </TableCell>
      </TableRow>
      {hasSub && isExpanded && Object.entries(data.sub).map(([subName, subData]: any) => (
        <RenderRow key={subName} name={subName} data={subData} level={level + 1} expanded={expanded} onToggle={onToggle} />
      ))}
    </>
  );
}