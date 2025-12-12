'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { useUser, useFirestore } from '@/firebase'; // Your existing hooks
import { doc, writeBatch, collection, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  ArrowRight, ArrowLeft, Plus, Trash2, CalendarIcon, CheckCircle2, Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- TYPES ---
type BalanceItem = {
  id: string;
  name: string;
  amount: string; 
  type: 'asset' | 'liability';
  subtype: string;
};

// --- SUB-COMPONENT: ACCOUNT LIST ---
function AccountList({ 
  items, type, onAdd, onRemove, onChange 
}: { 
  items: BalanceItem[], 
  type: 'asset' | 'liability',
  onAdd: () => void,
  onRemove: (id: string) => void,
  onChange: (id: string, field: keyof BalanceItem, value: string) => void
}) {
  const liabilitySubtypes = [
        { val: 'credit_card', label: 'Credit Card Balance' },
        { val: 'loan', label: 'Business Loan' },
        { val: 'payable', label: 'Unpaid Bills (Payable)' },
        { val: 'tax', label: 'Tax Owed' },
    ];

  return (
    <div className="space-y-4">
      {items.filter(i => i.type === type).map((item) => (
        <div key={item.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-12 gap-2 w-full">
            <div className="col-span-4">
              <Select 
                value={item.subtype} 
                onValueChange={(val) => onChange(item.id, 'subtype', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {type === 'asset' ? (
                     <>
                        <SelectGroup>
                            <SelectLabel>💰 Cash & Bank</SelectLabel>
                            <SelectItem value="checking">Checking</SelectItem>
                            <SelectItem value="savings">Savings</SelectItem>
                            <SelectItem value="cash_drawer">Cash Drawer</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>📥 Receivables</SelectLabel>
                            <SelectItem value="accounts_receivable">Accounts Receivable</SelectItem>
                            <SelectItem value="insurance_claims_receivable">Insurance Claims Receivable</SelectItem>
                        </SelectGroup>
                         <SelectGroup>
                            <SelectLabel>📦 Inventory</SelectLabel>
                            <SelectItem value="inventory">Inventory</SelectItem>
                            <SelectItem value="raw_materials">Raw Materials</SelectItem>
                            <SelectItem value="work_in_progress">Work in Progress</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>🛠 Fixed Assets</SelectLabel>
                            <SelectItem value="equipment">Equipment</SelectItem>
                            <SelectItem value="vehicles">Vehicles</SelectItem>
                            <SelectItem value="furniture">Furniture</SelectItem>
                            <SelectItem value="computers">Computers</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>🧾 Prepaids</SelectLabel>
                            <SelectItem value="prepaid_rent">Prepaid Rent</SelectItem>
                            <SelectItem value="prepaid_insurance">Prepaid Insurance</SelectItem>
                            <SelectItem value="prepaid_services">Prepaid Services</SelectItem>
                        </SelectGroup>
                         <SelectGroup>
                            <SelectLabel>📈 Investments</SelectLabel>
                            <SelectItem value="stocks">Stocks</SelectItem>
                            <SelectItem value="bonds">Bonds</SelectItem>
                            <SelectItem value="cds">CDs</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>🏢 Property</SelectLabel>
                            <SelectItem value="buildings">Buildings</SelectItem>
                            <SelectItem value="land">Land</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>📚 Intangibles</SelectLabel>
                            <SelectItem value="software">Software</SelectItem>
                            <SelectItem value="trademarks">Trademarks</SelectItem>
                            <SelectItem value="patents">Patents</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>🔐 Other Assets</SelectLabel>
                            <SelectItem value="security_deposits">Security Deposits</SelectItem>
                            <SelectItem value="loans_to_owner">Loans to Owner</SelectItem>
                        </SelectGroup>
                     </>
                  ) : (
                    liabilitySubtypes.map(s => <SelectItem key={s.val} value={s.val}>{s.label}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-5">
              <Input 
                placeholder={type === 'asset' ? "e.g., Chase Checking" : "e.g., Amex Gold"}
                value={item.name}
                onChange={(e) => onChange(item.id, 'name', e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <Input 
                type="number" 
                placeholder="0.00"
                value={item.amount}
                onChange={(e) => onChange(item.id, 'amount', e.target.value)}
                className="text-right"
              />
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" onClick={onAdd} className="w-full border-dashed">
        <Plus className="mr-2 h-4 w-4" /> Add {type === 'asset' ? 'Asset' : 'Liability'}
      </Button>
    </div>
  );
}

// --- MAIN WIZARD COMPONENT ---
export default function OpeningBalancesWizard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [items, setItems] = useState<BalanceItem[]>([]);
  const [equityType, setEquityType] = useState('owners_equity');
  const [isSaving, setIsSaving] = useState(false);

  // --- ACTIONS ---
  const addItem = (type: 'asset' | 'liability') => {
    setItems([...items, { 
      id: uuidv4(), 
      type, 
      name: '', 
      amount: '', 
      subtype: type === 'asset' ? 'checking' : 'credit_card' 
    }]);
  };

  const updateItem = (id: string, field: keyof BalanceItem, value: string) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  // --- CALCULATIONS ---
  const totals = useMemo(() => {
    const assets = items
      .filter(i => i.type === 'asset')
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    
    const liabilities = items
      .filter(i => i.type === 'liability')
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    return { assets, liabilities, equity: assets - liabilities };
  }, [items]);

  // --- SAVE TO FIRESTORE ---
  const handleFinalSave = async () => {
    if (!user || !firestore || !date) return;
    setIsSaving(true);

    try {
      const batch = writeBatch(firestore);
      const dateString = format(date, 'yyyy-MM-dd'); // Matches your dashboard string format
      
      // 1. Process Assets & Liabilities
      items.forEach(item => {
        const amountNum = parseFloat(item.amount) || 0;
        if (amountNum === 0 && !item.name) return; // Skip empty rows

        // A. Create the Bank Account Reference
        const accountRef = doc(collection(firestore, 'users', user.uid, 'bankAccounts'));
        batch.set(accountRef, {
          accountName: item.name || item.subtype,
          accountType: item.subtype,
          category: item.type, // 'asset' or 'liability'
          userId: user.uid,
          createdAt: Timestamp.now()
        });

        // B. Create the Opening Balance Transaction
        // Important: Assets are positive, Liabilities are negative for balance calculation
        const finalAmount = item.type === 'asset' ? amountNum : -amountNum;
        
        const txRef = doc(collection(firestore, 'users', user.uid, 'bankAccounts', accountRef.id, 'transactions'));
        batch.set(txRef, {
          description: "Opening Balance",
          amount: finalAmount,
          date: dateString, // String format to match your Dashboard index
          primaryCategory: "Opening Balance",
          secondaryCategory: item.type === 'asset' ? "Asset" : "Liability",
          userId: user.uid, // CRITICAL for collectionGroup queries
          bankAccountId: accountRef.id,
          createdAt: Timestamp.now()
        });
      });

      // 2. (Optional) Create Equity Record
      // We record this so the "Net Worth" is tracked, but we might mark it differently
      // so it doesn't double-count as "Income" on the dashboard.
      if (totals.equity !== 0) {
         // We can store this as a general transaction or in a separate 'equity' collection
         // For now, let's skip creating a transaction for Equity to avoid confusing the "Income" charts,
         // since Equity is derived from Assets - Liabilities.
      }

      await batch.commit();

      toast({
        title: "Setup Complete",
        description: "Your opening balances have been saved.",
      });

      // Redirect to Dashboard
      router.push('/dashboard');

    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        variant: "destructive",
        title: "Error Saving",
        description: error.message
      });
    } finally {
      setIsSaving(false);
    }
  };

  // --- NAVIGATION ---
  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      {/* PROGRESS BAR */}
      <div className="mb-8">
        <div className="flex justify-between text-sm font-medium text-muted-foreground mb-2">
          <span>Start</span>
          <span>Assets</span>
          <span>Liabilities</span>
          <span>Equity</span>
          <span>Review</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-in-out" 
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      <Card className="min-h-[400px] flex flex-col justify-between shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">
            {step === 1 && "When does your bookkeeping start?"}
            {step === 2 && "What does the business own? (Assets)"}
            {step === 3 && "What does the business owe? (Liabilities)"}
            {step === 4 && "Let's balance the books"}
            {step === 5 && "Review your Opening Balances"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Choose the date these opening balances apply to."}
            {step === 2 && "Add bank accounts, cash, inventory, and money owed to you."}
            {step === 3 && "Add credit cards, loans, and unpaid bills."}
            {step === 4 && "We calculated your equity based on Assets - Liabilities."}
            {step === 5 && "Confirm everything looks correct before saving."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1">
          {/* STEP 1: DATE */}
          {step === 1 && (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[280px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* STEP 2: ASSETS */}
          {step === 2 && (
            <AccountList 
              items={items} type="asset" 
              onAdd={() => addItem('asset')} 
              onRemove={removeItem} onChange={updateItem} 
            />
          )}

          {/* STEP 3: LIABILITIES */}
          {step === 3 && (
            <AccountList 
              items={items} type="liability" 
              onAdd={() => addItem('liability')} 
              onRemove={removeItem} onChange={updateItem} 
            />
          )}

          {/* STEP 4: EQUITY */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <span className="text-sm text-green-600 font-medium">Total Assets</span>
                  <div className="text-2xl font-bold text-green-700">
                    ${totals.assets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                  <span className="text-sm text-red-600 font-medium">Total Liabilities</span>
                  <div className="text-2xl font-bold text-red-700">
                    ${totals.liabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-center">
                <p className="text-muted-foreground mb-1">Calculated Equity</p>
                <div className="text-4xl font-bold text-slate-900 mb-4">
                  ${totals.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-left space-y-3 max-w-sm mx-auto">
                  <Label>Category</Label>
                  <Select value={equityType} onValueChange={setEquityType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owners_equity">Owner's Investment</SelectItem>
                      <SelectItem value="retained_earnings">Retained Earnings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="rounded-md border">
                <div className="bg-muted/50 p-3 border-b font-medium grid grid-cols-2">
                  <span>Category</span><span className="text-right">Balance</span>
                </div>
                <div className="divide-y max-h-[250px] overflow-y-auto">
                  {items.map(item => (
                     <div key={item.id} className="p-3 grid grid-cols-2 text-sm">
                       <span className={item.type === 'liability' ? 'text-red-600' : 'text-green-600'}>
                         {item.name || item.subtype} ({item.type})
                       </span>
                       <span className="text-right font-mono">
                         ${parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                       </span>
                     </div>
                  ))}
                  <div className="p-3 grid grid-cols-2 text-sm bg-slate-50 font-medium">
                     <span className="text-blue-600">Equity</span>
                     <span className="text-right font-mono">
                       ${totals.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                     </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Balances are ready to be saved to your dashboard.</span>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t p-6">
          <Button variant="ghost" onClick={prevStep} disabled={step === 1 || isSaving}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          
          {step < 5 ? (
            <Button onClick={nextStep} disabled={!date}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleFinalSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 min-w-[150px]">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save & Finish"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

    