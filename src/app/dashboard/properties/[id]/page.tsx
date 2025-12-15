'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'; 
import { useParams, useRouter } from 'next/navigation'; // Added useRouter for redirect
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Wallet, ShieldCheck, ArrowLeft, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react'; // Added Trash2, AlertTriangle, Loader2
import Link from 'next/link';
import { PropertyForm } from '@/components/dashboard/sales/property-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast'; // Added Toast

export default function PropertyDashboard() {
  const { id } = useParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter(); // For redirecting after delete
  const { toast } = useToast();

  const [property, setProperty] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI States
  const [editTab, setEditTab] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false); // Delete Modal State
  const [isDeleting, setIsDeleting] = useState(false); // Loading State during delete

  const fetchData = async () => {
    if (!user || !firestore || !id) return;
    try {
      const propRef = doc(firestore, 'properties', id as string);
      const propSnap = await getDoc(propRef);
      if (propSnap.exists()) {
         setProperty({ id: propSnap.id, ...propSnap.data() });
         
         const accountsQ = query(collection(firestore, 'accounts'), where('propertyId', '==', id), where('userId', '==', user.uid));
         const accSnap = await getDocs(accountsQ);
         setAccounts(accSnap.docs.map(d => d.data()));
      }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user, firestore, id]);

  // --- DELETE & CLEANUP FUNCTION ---
  const handleDelete = async () => {
    if (!user || !firestore || !id) return;
    setIsDeleting(true);

    try {
      const batch = writeBatch(firestore);

      // 1. Delete the Property Document
      const propRef = doc(firestore, 'properties', id as string);
      batch.delete(propRef);

      // 2. Find & Delete ALL Linked Ledger Accounts (Cleanup)
      const accountsQ = query(collection(firestore, 'accounts'), where('propertyId', '==', id), where('userId', '==', user.uid));
      const accountSnaps = await getDocs(accountsQ);
      
      accountSnaps.forEach((doc) => {
         batch.delete(doc.ref);
      });

      // 3. Commit the Batch
      await batch.commit();

      toast({ title: "Property Deleted", description: `Successfully removed property and ${accountSnaps.size} ledger accounts.` });
      
      // 4. Redirect to List Page
      router.push('/dashboard/sales/rent-collection');

    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Delete Failed", description: error.message });
      setIsDeleting(false); // Only stop loading if it failed
    }
  };

  if (loading) return <div className="p-10 flex justify-center text-muted-foreground">Loading property details...</div>;
  if (!property) return <div className="p-10 text-center text-muted-foreground">Property not found.</div>;

  const missingItems = [];
  if (!property.tenants?.length) missingItems.push({ id: 'tenants', label: 'Add Tenants', desc: 'Required to track rent income.' });
  if (property.mortgage?.hasMortgage === 'no' || !property.mortgage?.lenderName) missingItems.push({ id: 'mortgage', label: 'Setup Mortgage', desc: 'Enable auto-splits for loan payments.' });
  if (!property.taxAndInsurance?.policyNumber) missingItems.push({ id: 'tax', label: 'Tax & Insurance', desc: 'Track escrow and tax expenses.' });
  
  const completeness = Math.round(25 + ((3 - missingItems.length) / 3) * 75);

  return (
    <div className="p-8 space-y-8">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-4">
            <Link href="/dashboard/sales/rent-collection">
               <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
               <h1 className="text-2xl font-bold flex items-center gap-2">
                  {property.name}
                  <Badge variant="outline" className="text-sm font-normal">{property.type}</Badge>
               </h1>
               <p className="text-muted-foreground">{property.address?.street}, {property.address?.city}</p>
            </div>
         </div>
         
         <div className="flex gap-2">
            <Button onClick={() => setEditTab('general')} variant="outline">Edit Settings</Button>
            {/* DELETE BUTTON */}
            <Button onClick={() => setIsDeleteOpen(true)} variant="destructive" size="icon">
               <Trash2 className="h-4 w-4" />
            </Button>
         </div>
      </div>

      {/* SETUP WIZARD */}
      {missingItems.length > 0 && (
        <Card className="bg-indigo-50 border-indigo-100">
           <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                 <CardTitle className="text-indigo-900 text-lg">Finish Setting Up {property.name}</CardTitle>
                 <span className="text-sm font-bold text-indigo-700">{completeness}% Complete</span>
              </div>
              <Progress value={completeness} className="h-2 bg-indigo-200" />
           </CardHeader>
           <CardContent className="grid md:grid-cols-3 gap-4">
              {missingItems.map((item) => (
                 <button 
                    key={item.id}
                    onClick={() => setEditTab(item.id)} 
                    className="flex items-start gap-3 p-3 bg-white rounded-lg border border-indigo-100 hover:shadow-md transition-all text-left group"
                 >
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                       <Plus className="h-4 w-4" />
                    </div>
                    <div>
                       <div className="font-semibold text-sm text-slate-900">{item.label}</div>
                       <div className="text-xs text-slate-500">{item.desc}</div>
                    </div>
                 </button>
              ))}
           </CardContent>
        </Card>
      )}

      {/* DASHBOARD TABS */}
      <Tabs defaultValue="overview" className="w-full">
         <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="financials">Financials & Ledgers</TabsTrigger>
         </TabsList>

         <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
               <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                     <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-slate-500" /><CardTitle className="text-base">Mortgage & Loan</CardTitle></div>
                     <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditTab('mortgage')}>Edit</Button>
                  </CardHeader>
                  <CardContent>
                     {property.mortgage?.hasMortgage === 'yes' ? (
                        <div className="space-y-2 text-sm">
                           <div className="flex justify-between"><span className="text-muted-foreground">Lender</span><span className="font-medium">{property.mortgage.lenderName}</span></div>
                           <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="font-medium">${property.mortgage.monthlyPayment}</span></div>
                           <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span className="font-medium">${property.mortgage.loanBalance}</span></div>
                        </div>
                     ) : (
                        <div className="text-sm text-muted-foreground italic">No mortgage recorded.</div>
                     )}
                  </CardContent>
               </Card>

               <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                     <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-500" /><CardTitle className="text-base">Tax & Insurance</CardTitle></div>
                     <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditTab('tax')}>Edit</Button>
                  </CardHeader>
                  <CardContent>
                     {property.taxAndInsurance?.policyNumber ? (
                        <div className="space-y-2 text-sm">
                           <div className="flex justify-between"><span className="text-muted-foreground">Insurer</span><span className="font-medium">{property.taxAndInsurance.insuranceProvider}</span></div>
                           <div className="flex justify-between"><span className="text-muted-foreground">Renewal</span><span className="font-medium">{property.taxAndInsurance.renewalDate}</span></div>
                        </div>
                     ) : (
                        <div className="text-sm text-muted-foreground italic">No insurance details.</div>
                     )}
                  </CardContent>
               </Card>
            </div>
         </TabsContent>

         <TabsContent value="tenants">
            <Card>
               <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle>Current Residents</CardTitle>
                  <Button size="sm" onClick={() => setEditTab('tenants')}><Plus className="h-4 w-4 mr-2"/> Manage Tenants</Button>
               </CardHeader>
               <CardContent>
                  <Table>
                     <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Term</TableHead><TableHead>Rent</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                     <TableBody>
                        {property.tenants?.map((t:any, i:number) => (
                           <TableRow key={i}>
                              <TableCell className="font-medium">{t.firstName} {t.lastName}</TableCell>
                              <TableCell className="text-xs">{t.leaseStart} - {t.leaseEnd}</TableCell>
                              <TableCell>${t.rentAmount}</TableCell>
                              <TableCell><Badge className="bg-green-600">Active</Badge></TableCell>
                           </TableRow>
                        ))}
                        {(!property.tenants || property.tenants.length === 0) && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground h-20">No tenants listed.</TableCell></TableRow>}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         </TabsContent>

         <TabsContent value="financials">
            <Card>
                <CardHeader>
                    <CardTitle>Automated Ledgers</CardTitle>
                    <p className="text-xs text-muted-foreground">These accounts were automatically created for this property.</p>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Account Name</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                        <TableBody>
                           {accounts.map((acc:any, i:number) => (
                              <TableRow key={i}>
                                 <TableCell className="font-medium">{acc.name}</TableCell>
                                 <TableCell>{acc.type} / {acc.subtype}</TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
         </TabsContent>
      </Tabs>

      {/* --- EDIT MODAL --- */}
      <Dialog open={!!editTab} onOpenChange={(open) => !open && setEditTab(null)}>
         <DialogContent className="max-w-5xl h-[90vh] overflow-hidden p-0">
            <VisuallyHidden.Root><DialogTitle>Edit Property</DialogTitle></VisuallyHidden.Root>
            {editTab && (
               <div className="h-full overflow-y-auto p-6">
                  <PropertyForm initialData={property} defaultTab={editTab} onSuccess={() => { setEditTab(null); fetchData(); }} />
               </div>
            )}
         </DialogContent>
      </Dialog>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
         <DialogContent>
            <DialogHeader>
               <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" /> Delete Property?
               </DialogTitle>
               <DialogDescription className="pt-2">
                  This action cannot be undone. This will permanently delete <strong>{property.name}</strong> and remove all <strong>{accounts.length} associated ledger accounts</strong>.
                  <br/><br/>
                  Any historical transactions linked to this property will remain in your bank feed but will become unlinked.
               </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
               <Button variant="ghost" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>Cancel</Button>
               <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Delete Property"}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

    </div>
  );
}

    