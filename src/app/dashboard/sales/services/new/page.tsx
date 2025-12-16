'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase'; // Assuming you have these hooks
import { collection, doc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore'; // Firebase tools
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Trash2, 
  Save, 
  Send, 
  ArrowLeft, 
  Calendar as CalendarIcon 
} from 'lucide-react';

export default function NewServiceInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 1. Invoice State
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: 'INV-2024-001', // We will auto-generate this later
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    clientName: '',
    clientEmail: '',
    notes: 'Payment is due within 15 days. Thank you for your business!',
  });

  // 2. Line Items State (The Service Rows)
  const [items, setItems] = useState([
    { id: 1, description: 'Consulting Services', quantity: 1, rate: 150.00 },
  ]);

  const [taxRate, setTaxRate] = useState(0); // e.g. 8.25 for 8.25%

  // 3. Calculated Totals
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // --- Handlers ---
  const { user } = useUser();
  const firestore = useFirestore();

  const handleAddItem = () => {
    setItems([
      ...items, 
      { id: Date.now(), description: '', quantity: 1, rate: 0 }
    ]);
  };

  const handleRemoveItem = (id: number) => {
    if (items.length === 1) return; // Prevent deleting the last row
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: number, field: string, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSave = async (status: 'draft' | 'open') => {
    if (!user || !firestore) return;
    setLoading(true);

    try {
      // 1. Prepare the Data
      const invoiceId = doc(collection(firestore, 'invoices')).id; // Generate ID
      const batch = writeBatch(firestore); // Start a batch transaction

      const invoiceRef = doc(firestore, 'invoices', invoiceId);
      
      const invoicePayload = {
        id: invoiceId,
        userId: user.uid,
        invoiceNumber: invoiceData.invoiceNumber, // We will automate this next
        status: status,
        type: 'service', // Explicitly marking this as a Service Invoice
        
        // Client Info
        clientName: invoiceData.clientName,
        clientEmail: invoiceData.clientEmail,
        // clientId: selectedClientId, // TODO: We will link this to real clients later
        
        // Dates
        issueDate: Timestamp.fromDate(new Date(invoiceData.issueDate)),
        dueDate: invoiceData.dueDate ? Timestamp.fromDate(new Date(invoiceData.dueDate)) : null,
        
        // The Money
        items: items, // The array of service rows
        subtotal: subtotal,
        taxRate: taxRate,
        taxAmount: taxAmount,
        totalAmount: total,
        balanceDue: total, // Initially, they owe the full amount
        
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 2. Add Invoice to Batch
      batch.set(invoiceRef, invoicePayload);

      // 3. IF APPROVED: Generate the Accounting Entries (The "Double Entry")
      if (status === 'open') {
        const ledgerRef = doc(collection(firestore, 'ledgerEntries'));
        
        batch.set(ledgerRef, {
          transactionId: invoiceId, // Link back to invoice
          date: serverTimestamp(),
          description: `Invoice #${invoiceData.invoiceNumber} for ${invoiceData.clientName}`,
          type: 'invoice',
          userId: user.uid,
          
          // The Journal Entry
          debit: {
            accountId: 'accounts-receivable', // Asset: They owe you
            amount: total
          },
          credit: {
            accountId: 'service-revenue', // Income: You earned it
            amount: subtotal
          },
          // Handle Tax Liability if needed (Credit Sales Tax Payable)
          ...(taxAmount > 0 && {
             taxCredit: {
               accountId: 'sales-tax-payable',
               amount: taxAmount
             }
          })
        });
      }

      // 4. Commit to Database
      await batch.commit();

      alert(status === 'draft' ? "Draft Saved!" : "Invoice Approved & Posted to Ledger!");
      router.push('/dashboard/sales/services');

    } catch (error) {
      console.error("Error saving invoice:", error);
      alert("Failed to save invoice. Check console for details.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">New Service Invoice</h1>
            <p className="text-sm text-muted-foreground">Create a new bill for hours or projects.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={loading}>
            <Save className="h-4 w-4 mr-2" /> Save Draft
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleSave('open')} disabled={loading}>
            <Send className="h-4 w-4 mr-2" /> Approve & Send
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: The Invoice Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Client & Dates */}
          <Card>
            <CardContent className="p-6 grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Name</label>
                  <Input 
                    placeholder="e.g. Acme Corp" 
                    value={invoiceData.clientName}
                    onChange={(e) => setInvoiceData({...invoiceData, clientName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Email</label>
                  <Input 
                    type="email" 
                    placeholder="billing@acme.com" 
                    value={invoiceData.clientEmail}
                    onChange={(e) => setInvoiceData({...invoiceData, clientEmail: e.target.value})}
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
                  <div className="relative">
                    <Input 
                      type="date" 
                      value={invoiceData.issueDate}
                      onChange={(e) => setInvoiceData({...invoiceData, issueDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-red-600">Due Date</label>
                  <Input 
                    type="date" 
                    value={invoiceData.dueDate}
                    onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Line Items */}
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-900">Services / Line Items</h3>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 mb-2 text-sm font-medium text-muted-foreground px-1">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty/Hrs</div>
                <div className="col-span-2 text-right">Rate</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>

              {/* Rows */}
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-4 items-start group">
                    <div className="col-span-6">
                      <Textarea 
                        placeholder="Description of service..." 
                        className="min-h-[40px] resize-none"
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        type="number" 
                        className="text-right" 
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        type="number" 
                        className="text-right" 
                        value={item.rate}
                        onChange={(e) => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="font-medium">
                        ${(item.quantity * item.rate).toLocaleString()}
                      </span>
                      <button 
                        onClick={() => handleRemoveItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4 text-blue-600 hover:text-blue-700 border-dashed border-blue-200"
                onClick={handleAddItem}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Line Item
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary & Notes */}
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
                />
              </div>

              <div className="border-t pt-4 flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-lg text-blue-600">
                  ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <label className="text-sm font-medium">Terms & Notes</label>
              <Textarea 
                className="min-h-[100px] text-sm"
                value={invoiceData.notes}
                onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
              />
              <p className="text-xs text-muted-foreground">
                These notes will be visible on the PDF sent to the client.
              </p>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
