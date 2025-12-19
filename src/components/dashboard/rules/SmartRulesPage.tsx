'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, BrainCircuit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SmartRulesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [rules, setRules] = useState<any[]>([]);
  const [merchant, setMerchant] = useState('');
  const [primaryCategory, setPrimaryCategory] = useState('Operating Expenses');
  const [secondaryCategory, setSecondaryCategory] = useState('General & Administrative');
  const [subcategory, setSubcategory] = useState('General Expense');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  const fetchRules = async () => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      const collectionPath = isAdminMode 
        ? 'globalVendorMap' 
        : `users/${user.uid}/categoryMappings`;
      const q = query(collection(firestore, collectionPath), orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      setRules(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
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

  const handleSave = async () => {
    if (!merchant || !user || !firestore) return;
    setIsSaving(true);

    const cleanId = merchant.toUpperCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "_")
      .replace(/\s+/g, '_');

    const ruleData = {
      originalKeyword: merchant,
      primaryCategory,
      secondaryCategory,
      subcategory,
      updatedAt: serverTimestamp(),
      source: isAdminMode ? 'Admin Manual' : 'User Manual'
    };

    const collectionPath = isAdminMode ? 'globalVendorMap' : `users/${user.uid}/categoryMappings`;

    try {
      await setDoc(doc(firestore, collectionPath, cleanId), ruleData);
      toast({ title: "Rule Saved", description: `Rule for "${merchant}" has been created.` });
      setMerchant('');
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
    if (window.confirm("Are you sure you want to delete this rule?")) {
      try {
        await deleteDoc(doc(firestore, collectionPath, id));
        toast({ title: "Rule Deleted" });
        setRules(rules.filter(r => r.id !== id));
      } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: error.message });
      }
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
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
        <div className="flex items-center space-x-2 bg-muted p-2 rounded-lg">
          <Label htmlFor="admin-mode" className="font-normal text-sm">Personal</Label>
          <Switch
            id="admin-mode"
            checked={isAdminMode}
            onCheckedChange={setIsAdminMode}
            disabled={user?.uid !== 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2'}
          />
          <Label htmlFor="admin-mode" className="font-normal text-sm">Admin (Global)</Label>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teach the AI a new rule</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input 
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="If vendor name contains..."
            className="md:col-span-1"
          />
          <Select value={subcategory} onValueChange={setSubcategory}>
            <SelectTrigger className="md:col-span-1">
              <SelectValue placeholder="Assign this category..." />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Operating Expenses</SelectLabel>
                <SelectItem value="Rent & Utilities">Rent & Utilities</SelectItem>
                <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                <SelectItem value="Meals & Entertainment">Meals & Entertainment</SelectItem>
                <SelectItem value="Travel & Lodging">Travel & Lodging</SelectItem>
                <SelectItem value="Software & Subscriptions">Software & Subscriptions</SelectItem>
                <SelectItem value="Advertising & Marketing">Advertising & Marketing</SelectItem>
                <SelectItem value="Repairs & Maintenance">Repairs & Maintenance</SelectItem>
                <SelectItem value="Fuel">Fuel</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Personal / Equity</SelectLabel>
                <SelectItem value="Personal Expense">Personal Expense</SelectItem>
                <SelectItem value="Owner's Draw">Owner's Draw</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Liabilities</SelectLabel>
                <SelectItem value="Credit Card Payment">Credit Card Payment</SelectItem>
                <SelectItem value="Loan Payment">Loan Payment</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={isSaving || !merchant} className="w-full md:w-auto">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Rule'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Assigned Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
              ) : rules.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No rules found. Add one above to teach the system!</TableCell></TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.originalKeyword || rule.id}</TableCell>
                    <TableCell>
                      <Badge variant={rule.subcategory === 'Personal Expense' ? 'destructive' : 'secondary'}>
                        {rule.subcategory}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.source || 'Unknown'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
