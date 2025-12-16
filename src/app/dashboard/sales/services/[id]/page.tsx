'use client';

import { useState, useEffect, use } from 'react'; // 👈 1. Import 'use'
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc, writeBatch, serverTimestamp, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Save, 
  Send, 
  ArrowLeft, 
  Loader2,
  Lock
} from 'lucide-react';

// 👈 2. Update types: params is now a Promise
export default function EditServiceInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); // 👈 3. Unwrap the params here using React.use()
  
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ... (Keep your state definitions exactly the same) ...
  const [status, setStatus] = useState<string>('draft');
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '',
    issueDate: '',
    dueDate: '',
    clientName: '',
    clientEmail: '',
    notes: '',
  });

  const [items, setItems] = useState<any[]>([]);
  const [taxRate, setTaxRate] = useState(0);

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  
  const isLocked = status === 'open' || status === 'paid';

  // Fetch Invoice Data
  useEffect(() => {
    const fetchInvoice = async () => {
      if (!firestore || !user) return;

      try {
        // 👇 Update this line: Use 'id' instead of 'params.id'
        const docRef = doc(firestore, 'invoices', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          setStatus(data.status);
          setInvoiceData({
            invoiceNumber: data.invoiceNumber,
            clientName: data.clientName || '',
            clientEmail: data.clientEmail || '',
            notes: data.notes || '',
            issueDate: data.issueDate?.seconds ? new Date(data.issueDate.seconds * 1000).toISOString().split('T')[0] : '',
            dueDate: data.dueDate?.seconds ? new Date(data.dueDate.seconds * 1000).toISOString().split('T')[0] : '',
          });
          setItems(data.items || []);
          setTaxRate(data.taxRate || 0);
        } else {
          alert("Invoice not found");
          router.push('/dashboard/sales/services');
        }
      } catch (error) {
        console.error("Error fetching invoice:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [firestore, user, id, router]); // 👈 Update dependency: 'id' instead of 'params.id'

  // ... (Keep existing handlers handleAddItem, handleRemoveItem, handleItemChange) ...
  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), description: '', quantity: 1, rate: 0 }]);
  };

  const handleRemoveItem = (itemId: number) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== itemId));
  };

  const handleItemChange = (itemId: number, field: string, value: any) => {
    setItems(items.map(item => item.id === itemId ? { ...item, [field]: value } : item));
  };

  // Save / Update Logic
  const handleSave = async (newStatus: 'draft' | 'open') => {
    if (!firestore || !user) return;
    setSaving(true);

    try {
      const batch = writeBatch(firestore);
      // 👇 Update this line: Use 'id' instead of 'params.id'
      const invoiceRef = doc(firestore, 'invoices', id);

      batch.update(invoiceRef, {
        status: newStatus,
        clientName: invoiceData.clientName,
        clientEmail: invoiceData.clientEmail,
        issueDate: new Date(invoiceData.issueDate),
        dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
        items: items,
        subtotal: subtotal,
        taxRate: taxRate,
        taxAmount: taxAmount,
        totalAmount: total,
        balanceDue: total,
        updatedAt: serverTimestamp(),
      });

      if (newStatus === 'open' && status === 'draft') {
        const ledgerRef = doc(collection(firestore, 'ledgerEntries'));
        batch.set(ledgerRef, {
          transactionId: id, // 👈 Update this line: Use 'id'
          date: serverTimestamp(),
          description: `Invoice #${invoiceData.invoiceNumber} for ${invoiceData.clientName}`,
          type: 'invoice',
          userId: user.uid,
          debit: { accountId: 'accounts-receivable', amount: total },
          credit: { accountId: 'service-revenue', amount: subtotal },
          ...(taxAmount > 0 && {
             taxCredit: { accountId: 'sales-tax-payable', amount: taxAmount }
          })
        });
      }

      await batch.commit();

      alert(newStatus === 'open' ? "Invoice Approved & Posted!" : "Invoice Updated!");
      router.push('/dashboard/sales/services');

    } catch (error: any) {
      console.error("Error updating:", error);
      alert("Failed to update invoice.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600"/></div>;

  return (
    // ... (Your JSX remains exactly the same) ...
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Copy your JSX from the previous file, it doesn't need changes */}
      {/* Just make sure you paste the full return (...) block here */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                Edit {invoiceData.invoiceNumber}
              </h1>
              <Badge variant={status === 'open' ? 'default' : 'secondary'}>
                {status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
        
        {!isLocked ? (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleSave('draft')} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> Save Changes
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleSave('open')} disabled={saving}>
              <Send className="h-4 w-4 mr-2" /> Approve & Post
            </Button>
          </div>
        ) : (
          <div className="bg-amber-50 text-amber-800 px-4 py-2 rounded-md text-sm border border-amber-200 flex items-center gap-2">
            <Lock className="h-4 w-4" /> This invoice is finalized and cannot be edited.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Name</label>
                  <Input 
                    value={invoiceData.clientName}
                    onChange={(e) => setInvoiceData({...invoiceData, clientName: e.target.value})}
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Email</label>
                  <Input 
                    value={invoiceData.clientEmail}
                    onChange={(e) => setInvoiceData({...invoiceData, clientEmail: e.target.value})}
                    disabled={isLocked}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 border-t pt-4">
                 <div className="space-y-2">
                    <label className="text-sm font-medium">Invoice #</label>
                    <Input value={invoiceData.invoiceNumber} disabled className="bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Issue Date</label>
                  <Input 
                    type="date"
                    value={invoiceData.issueDate}
                    onChange={(e) => setInvoiceData({...invoiceData, issueDate: e.target.value})}
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-red-600">Due Date</label>
                  <Input 
                    type="date"
                    value={invoiceData.dueDate}
                    onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                    disabled={isLocked}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-12 gap-4 mb-2 text-sm font-medium text-muted-foreground px-1">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Rate</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>

              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-4 items-start group">
                    <div className="col-span-6">
                      <Textarea 
                        className="min-h-[40px] resize-none"
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        type="number" className="text-right"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        type="number" className="text-right"
                        value={item.rate}
                        onChange={(e) => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                        disabled={isLocked}
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="font-medium">${(item.quantity * item.rate).toLocaleString()}</span>
                      {!isLocked && (
                        <button onClick={() => handleRemoveItem(item.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!isLocked && (
                <Button variant="outline" size="sm" className="mt-4 text-blue-600 border-dashed border-blue-200" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-slate-50/50">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-900">Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Tax Rate (%)</span>
                <Input 
                  className="w-20 text-right h-8 bg-white" 
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  disabled={isLocked}
                />
              </div>
              <div className="border-t pt-4 flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-lg text-blue-600">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
