
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  doc,
  collection,
  query,
  deleteDoc,
  getDocs,
  Timestamp,
  collectionGroup,
  where,
} from 'firebase/firestore';
import { useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Edit,
  UserPlus,
  Wallet,
  FileText,
  Download,
  Trash2,
  UploadCloud,
  Eye,
  Bot,
  Loader2,
  Landmark,
  TrendingUp,
  AlertTriangle,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { PropertyForm } from '@/components/dashboard/sales/property-form';
import { PropertyFinancials } from '@/components/dashboard/sales/property-financials';
import { PropertySetupBanner } from '@/components/dashboard/sales/property-setup-banner';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import InviteTenantModal from '@/components/tenants/InviteTenantModal';
import { RecordPaymentModal } from '@/components/dashboard/sales/RecordPaymentModal';
import { TenantDocumentUploader } from '@/components/tenants/TenantDocumentUploader';
import { useToast } from '@/hooks/use-toast';
import { useStorage } from '@/firebase';
import { generateLease } from '@/ai/flows/lease-flow';
import { formatCurrency } from '@/lib/format';
import { ref, deleteObject } from 'firebase/storage';
import { parseISO, format, startOfMonth, endOfMonth, differenceInDays, isPast } from 'date-fns';
import { calculateAmortization } from '@/actions/amortization-actions';
import { StatCard } from '@/components/dashboard/stat-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';

// ---------- Robust helpers ----------
const toNum = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const toDateSafe = (v: any): Date | null => {
  if (!v) return null;

  // Firestore Timestamp
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === 'object' && typeof v.seconds === 'number') return new Date(v.seconds * 1000);

  // String or Date
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// L0 normalization so we don’t miss categories
function normalizeL0Any(tx: any): string {
  const raw = String(tx?.categoryHierarchy?.l0 || tx?.primaryCategory || '').toUpperCase().trim();
  if (raw === 'INCOME') return 'INCOME';
  if (raw === 'OPERATING EXPENSE') return 'OPERATING EXPENSE';
  if (raw === 'EXPENSE') return 'OPERATING EXPENSE';
  if (raw === 'ASSET') return 'ASSET';
  if (raw === 'LIABILITY') return 'LIABILITY';
  if (raw === 'EQUITY') return 'EQUITY';
  if (raw.includes('INCOME')) return 'INCOME';
  if (raw.includes('EXPENSE')) return 'OPERATING EXPENSE';
  return raw || 'UNKNOWN';
}

const getRentForDate = (rentHistory: { amount: any; effectiveDate: any }[], date: Date): number => {
  if (!rentHistory || rentHistory.length === 0) return 0;

  const normalized = rentHistory
    .map((r) => ({
      amount: toNum(r?.amount ?? r?.rent ?? r?.value),
      effective: toDateSafe(r?.effectiveDate ?? r?.date ?? r?.startDate ?? r?.from),
    }))
    .filter((x) => x.amount > 0 && x.effective);

  if (normalized.length === 0) return 0;

  normalized.sort((a, b) => b.effective!.getTime() - a.effective!.getTime());
  const match = normalized.find((r) => r.effective!.getTime() <= date.getTime());
  return match ? match.amount : 0;
};

function getRentForMonthFromPropertyTenants(tenants: any[] | undefined, date: Date): number {
  if (!tenants || tenants.length === 0) return 0;
  const allHistory = tenants.flatMap((t) => (Array.isArray(t?.rentHistory) ? t.rentHistory : []));
  return getRentForDate(allHistory, date);
}

function resolveRentDueForMonth(opts: { monthTenant?: any; property?: any; unit?: any; date: Date }): number {
  const { monthTenant, property, unit, date } = opts;

  const direct = getRentForDate(monthTenant?.rentHistory || [], date);
  if (direct > 0) return direct;

  const propFallback = getRentForMonthFromPropertyTenants(property?.tenants, date);
  if (propFallback > 0) return propFallback;

  const tenantRent =
    toNum(monthTenant?.rentAmount) || toNum(monthTenant?.rent) || toNum(monthTenant?.monthlyRent);
  if (tenantRent > 0) return tenantRent;

  const unitRent =
    toNum(unit?.financials?.rent) || toNum(unit?.financials?.targetRent) || toNum(unit?.targetRent);
  if (unitRent > 0) return unitRent;

  const propRent =
    toNum(property?.financials?.targetRent) || toNum(property?.financials?.rent) || toNum(property?.targetRent);
  if (propRent > 0) return propRent;

  return 0;
}

function parseMonthKeyToDate(monthKey: string): Date {
  return parseISO(`${monthKey}-02`); // avoids timezone issues
}

function monthWindow(date: Date): { start: Date; end: Date } {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

function tenantForMonth(tenants: any[] | undefined, date: Date): any | null {
  if (!tenants || tenants.length === 0) return null;

  const { start: monthStart, end: monthEnd } = monthWindow(date);

  const overlappingTenants = tenants.filter((t) => {
    const leaseStart = toDateSafe(t.leaseStart);
    const leaseEnd = toDateSafe(t.leaseEnd);
    if (!leaseStart || !leaseEnd) return false;
    return leaseStart <= monthEnd && leaseEnd >= monthStart;
  });

  if (overlappingTenants.length > 1) {
    return overlappingTenants.sort((a, b) => {
      const startA = toDateSafe(a.leaseStart)?.getTime() || 0;
      const startB = toDateSafe(b.leaseStart)?.getTime() || 0;
      return startB - startA;
    })[0];
  }

  return overlappingTenants[0] || null;
}

const TenantRow = ({
  tenant,
  index,
  propertyId,
  landlordId,
  onUpdate,
  onOpenLease,
  isOccupantForMonth,
  viewingDate,
  property,
}: any) => {
  const rentDue = resolveRentDueForMonth({ monthTenant: tenant, property, date: viewingDate });
  return (
    <div className="flex justify-between items-center border p-3 rounded-lg bg-slate-50/50">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium">
            {tenant.firstName} {tenant.lastName}
          </p>
          {isOccupantForMonth && <Badge className="bg-blue-100 text-blue-800">This Month</Badge>}
          {tenant.status && (
            <Badge
              variant="outline"
              className={cn(
                'capitalize text-xs h-5',
                tenant.status?.toLowerCase() === 'active'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-slate-100 text-slate-600'
              )}
            >
              {tenant.status}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{tenant.email}</p>
      </div>

      <div className="text-right hidden sm:block">
        <p className="font-medium">${rentDue.toLocaleString()}/mo</p>
        <p className="text-xs text-muted-foreground">Lease ends: {tenant.leaseEnd || 'N/A'}</p>
      </div>

      <div className="flex items-center gap-2">
        <RecordPaymentModal
          tenant={{ ...tenant, id: tenant.email || `tenant_${index}` }}
          propertyId={propertyId}
          landlordId={landlordId}
          onSuccess={onUpdate}
        />
        <Button variant="ghost" size="icon" onClick={() => onOpenLease(tenant)} title="Auto-Draft Lease">
          <Bot className="h-4 w-4 text-slate-500" />
        </Button>
      </div>
    </div>
  );
};

function LeaseAgentModal({
  tenant,
  propertyId,
  onOpenChange,
  isOpen,
}: {
  tenant: any;
  propertyId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const flowResult = await generateLease({
        propertyId,
        tenantId: tenant.email,
        state: 'TX',
      });
      setResult(flowResult);
      toast({ title: 'Lease Saved!', description: "The lease has been generated and saved to your documents tab." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="text-primary" /> AI Agent Confirmation
          </DialogTitle>
          <DialogDescription>Please review the AI's plan before proceeding.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-slate-50 p-4 rounded-lg border">
            <h4 className="font-semibold text-slate-800">Smart Summary</h4>
            <p className="text-sm text-slate-600 mt-1">
              I will generate a Texas-compliant lease for {tenant.firstName} {tenant.lastName} and save it to this property’s documents tab.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800">Legal Disclaimer</h4>
            <p className="text-xs text-muted-foreground mt-1">
              This document was generated by an AI assistant. It is not a substitute for legal advice from a qualified attorney.
              Please review the document carefully before signing.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="bg-primary hover:bg-primary/90">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm & Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PropertyDocuments({ propertyId, landlordId }: { propertyId: string; landlordId: string }) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isUploaderOpen, setUploaderOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const docsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return query(collection(firestore, `properties/${propertyId}/documents`));
  }, [firestore, propertyId]);

  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refetchDocs = async () => {
    if (!docsQuery) return;
    setIsLoading(true);
    const snap = await getDocs(docsQuery);
    setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setIsLoading(false);
  };

  useEffect(() => {
    refetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const handleDelete = async (docData: any) => {
    if (!firestore || !storage) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firebase services not available.' });
      return;
    }

    let fileRef;
    if (docData?.storagePath) fileRef = ref(storage, docData.storagePath);
    else if (docData?.downloadUrl) fileRef = ref(storage, docData.downloadUrl);
    else {
      toast({ variant: 'destructive', title: 'Cannot Delete', description: 'No file path found in document.' });
      return;
    }

    try {
      await deleteObject(fileRef);
      const docRef = doc(firestore, `properties/${propertyId}/documents`, docData.id);
      await deleteDoc(docRef);
      toast({ title: 'Document Deleted', description: `${docData.fileName} removed successfully.` });
      refetchDocs();
    } catch (error: any) {
      console.error('Deletion Error:', error);
      if (error.code === 'storage/object-not-found') {
        const docRef = doc(firestore, `properties/${propertyId}/documents`, docData.id);
        await deleteDoc(docRef);
        toast({ title: 'Cleaned Up', description: 'File was missing from storage, so database record was removed.' });
        refetchDocs();
      } else if (error.code === 'storage/unauthorized') {
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to delete this file.' });
      } else {
        toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
      }
    }
  };

  const getSafeDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) return date.toLocaleDateString();
    }
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString();
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const onUploadSuccess = () => {
    refetchDocs();
    setUploaderOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Document Storage</CardTitle>
            <CardDescription>Lease agreements, inspection reports, and other files for this property.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setUploaderOpen(true)} className="gap-2">
            <UploadCloud className="h-4 w-4" /> Upload File
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading && <p>Loading documents...</p>}

          {!isLoading && (!documents || documents.length === 0) && (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-muted-foreground">No documents uploaded for this property yet.</p>
            </div>
          )}

          {!isLoading && documents && documents.length > 0 && (
            <div className="space-y-3">
              {documents.map((docItem: any) => (
                <div key={docItem.id} className="flex items-start justify-between p-3 bg-slate-50 border rounded-md">
                  <div>
                    <p className="font-medium">{docItem.fileName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Type: {docItem.fileType} | Uploaded: {getSafeDate(docItem.uploadedAt)}
                    </p>
                    {docItem.description && (
                      <p className="text-sm text-slate-600 mt-2 pl-2 border-l-2 border-slate-200">{docItem.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <a href={docItem.downloadUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1">
                        <Eye className="h-3 w-3" /> View
                      </Button>
                    </a>
                    <a href={docItem.downloadUrl} download>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Download className="h-3 w-3" /> Download
                      </Button>
                    </a>

                    {isDeleting === docItem.id ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          handleDelete(docItem);
                          setIsDeleting(null);
                        }}
                      >
                        Confirm Delete?
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-500"
                        onClick={() => setIsDeleting(docItem.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isUploaderOpen && (
        <TenantDocumentUploader
          isOpen={isUploaderOpen}
          onOpenChange={setUploaderOpen}
          propertyId={propertyId}
          landlordId={landlordId}
          onSuccess={onUploadSuccess}
        />
      )}
    </>
  );
}

export function PropertyDashboardSFH({ property, onUpdate }: { property: any; onUpdate: () => void }) {
  console.log("✅ USING src/components/dashboard/PropertyDashboardSFH.tsx");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isLeaseAgentOpen, setLeaseAgentOpen] = useState(false);
  const [selectedTenantForLease, setSelectedTenantForLease] = useState<any>(null);
  const [formTab, setFormTab] = useState('general');

  const { user } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const [interestForMonth, setInterestForMonth] = useState(0);

  const selectedMonthKey = useMemo(() => {
    const monthParam = searchParams.get('month');
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) return monthParam;
    return format(new Date(), 'yyyy-MM');
  }, [searchParams]);

  const selectedMonthDate = useMemo(() => parseMonthKeyToDate(selectedMonthKey), [selectedMonthKey]);

  // --- KPI TX SOURCE (authoritative) ---
  // We fetch txs via getDocs into local state so KPI math always has a real array.
  const [kpiTxs, setKpiTxs] = useState<any[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);

  const monthlyTransactionsQuery = useMemoFirebase(() => {
    if (!firestore || !property?.id || !user?.uid) return null;

    return query(
      collectionGroup(firestore, 'transactions'),
      where('userId', '==', user.uid),
      where('costCenter', '==', property.id)
    );
  }, [firestore, property?.id, user?.uid]);


  useEffect(() => {
    if (!monthlyTransactionsQuery) {
      setKpiTxs([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setKpiLoading(true);
        const snap = await getDocs(monthlyTransactionsQuery);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!cancelled) setKpiTxs(rows);
        console.log("KPI TX FETCH", { count: rows.length, first: rows[0] });
      } catch (e) {
        console.error("KPI TX FETCH FAILED", e);
        if (!cancelled) setKpiTxs([]);
      } finally {
        if (!cancelled) setKpiLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [monthlyTransactionsQuery]);


  useEffect(() => {
    if (!user || !property?.id) return;

    const calculateInterest = async () => {
      if (property.mortgage?.hasMortgage === 'yes' && property.mortgage.originalLoanAmount) {
        const result = await calculateAmortization({
          principal: property.mortgage.originalLoanAmount,
          annualRate: property.mortgage.interestRate,
          principalAndInterest: property.mortgage.principalAndInterest,
          loanStartDate: property.mortgage.purchaseDate,
          loanTermInYears: property.mortgage.loanTerm,
          targetDate: selectedMonthDate.toISOString(),
        });
        if (result.success) setInterestForMonth(result.interestPaidForMonth || 0);
      }
    };

    calculateInterest();
  }, [user, property, selectedMonthDate]);

  const monthTenant = useMemo(
    () => tenantForMonth(property?.tenants, selectedMonthDate),
    [property, selectedMonthDate]
  );
  
  const { noi, cashFlow, dscr, economicOccupancy, breakEvenRent, rentalIncome, potentialRent, verdict } = useMemo(() => {
    if (!property) {
      return {
        noi: 0,
        cashFlow: 0,
        dscr: 0,
        economicOccupancy: 0,
        breakEvenRent: 0,
        rentalIncome: 0,
        potentialRent: 0,
        verdict: { label: 'Analyzing...', color: 'bg-gray-100 text-gray-800' },
      };
    }

    const monthKey = selectedMonthKey;

    const txList: any[] = kpiTxs;
  
    // 1) Filter txs to THIS month
    const monthlyTxs = txList.filter((tx: any) => {
      const d = toDateSafe(tx?.date);
      if (!d) return false;
      return format(d, 'yyyy-MM') === monthKey;
    });
  
    // 2) Sum INCOME (actual collected)
    const rentalIncomeValue = monthlyTxs
      .filter((tx: any) => normalizeL0Any(tx) === 'INCOME')
      .reduce((sum: number, tx: any) => {
        const amt = toNum(tx?.amount);
        // rent collected should contribute positively
        return sum + (amt >= 0 ? amt : Math.abs(amt));
      }, 0);
  
    // 3) Sum Operating Expenses
    const operatingExpensesValue = monthlyTxs
      .filter((tx: any) => normalizeL0Any(tx) === 'OPERATING EXPENSE')
      .reduce((sum: number, tx: any) => sum + Math.abs(toNum(tx?.amount)), 0);
  
    // 4) Potential rent (from tenant/property rent logic)
    const monthTenantLocal = tenantForMonth(property?.tenants, selectedMonthDate);
    const potentialRentValue = resolveRentDueForMonth({
      monthTenant: monthTenantLocal,
      property,
      date: selectedMonthDate,
    });
  
    // 5) NOI (Monthly) = Income - Operating Expenses
    const noiValue = rentalIncomeValue - operatingExpensesValue;
  
    // 6) Debt & ratios
    const debtPayment = toNum(property?.mortgage?.principalAndInterest); // P&I only
    const escrow = toNum(property?.mortgage?.escrowAmount);
    const totalDebtPayment = debtPayment + escrow;
  
    const cashFlowValue = noiValue - debtPayment; // matches your UI tooltip (NOI minus P&I)
    const dscrValue = totalDebtPayment > 0 ? noiValue / totalDebtPayment : Infinity;
  
    const economicOccupancyValue =
      potentialRentValue > 0 ? (rentalIncomeValue / potentialRentValue) * 100 : 0;
  
    const breakEvenRentValue = operatingExpensesValue + totalDebtPayment;
  
    // 7) Verdict
    let verdictLabel = 'Stable';
    let verdictColor = 'bg-blue-100 text-blue-800';
  
    if (cashFlowValue > 100 && dscrValue > 1.25) {
      verdictLabel = 'Healthy Cash Flow';
      verdictColor = 'bg-green-100 text-green-800';
    } else if (cashFlowValue < 0) {
      verdictLabel = 'Underperforming';
      verdictColor = 'bg-red-100 text-red-800';
    } else if (dscrValue < 1.25 && debtPayment > 0) {
      verdictLabel = 'High Debt Ratio';
      verdictColor = 'bg-amber-100 text-amber-800';
    }
  
    console.log('KPI COMPONENTS', {
      monthKey,
      monthTxCount: monthlyTxs.length,
      rentalIncomeValue,
      operatingExpensesValue,
      potentialRentValue,
      noiValue,
    });
  
    return {
      noi: noiValue,
      cashFlow: cashFlowValue,
      dscr: dscrValue,
      economicOccupancy: economicOccupancyValue,
      breakEvenRent: breakEvenRentValue,
      rentalIncome: rentalIncomeValue,
      potentialRent: potentialRentValue,
      verdict: { label: verdictLabel, color: verdictColor },
    };
  }, [kpiTxs, property, selectedMonthDate, selectedMonthKey]);

  const getAiInsight = useMemo(() => {
    if (kpiLoading) return 'Analyzing property performance...';

    if (cashFlow > 0 && economicOccupancy < 80 && economicOccupancy > 0) {
      return `This property is cash-flowing. Improving the collection rate from ${economicOccupancy.toFixed(
        0
      )}% to 95% could increase monthly cash flow by approximately ${formatCurrency(
        potentialRent * 0.95 - rentalIncome
      )}.`;
    }
    if (dscr > 1.5 && property?.tenants?.length === 1) {
      return 'Risk is tenant concentration (100% from one tenant). Consider adding a lease renewal reminder.';
    }
    if (cashFlow < 0 && noi > 0) {
      return 'The property is profitable on an operating basis, but negative cash flow suggests the debt service is high. Consider refinancing options.';
    }
    if (dscr < 1.2 && dscr > 0 && isFinite(dscr)) {
      return 'The debt service coverage ratio is below the typical lender threshold of 1.25x. Focus on increasing NOI by reducing expenses or raising rent.';
    }
    return 'Property financials appear stable for the current period. Explore rent increase scenarios to optimize performance.';
  }, [kpiLoading, cashFlow, economicOccupancy, dscr, property, potentialRent, rentalIncome, noi]);

  const handleOpenDialog = (tab: string) => {
    setFormTab(tab);
    setIsEditOpen(true);
  };

  const handleOpenLeaseAgent = (tenant: any) => {
    setSelectedTenantForLease({ ...tenant });
    setLeaseAgentOpen(true);
  };

  if (!user) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!property) return <div className="p-8">Property not found.</div>;

  const getPropertyStatus = () => {
    return monthTenant ? 'Occupied' : 'Vacant';
  };

  const status = getPropertyStatus();
  const currentRent = resolveRentDueForMonth({ monthTenant, property, date: selectedMonthDate });
  const totalDebtPayment =
    toNum(property.mortgage?.principalAndInterest) + toNum(property.mortgage?.escrowAmount);

  const getDscrBadge = (ratio: number) => {
    if (!isFinite(ratio) || ratio === 0) return <Badge className="bg-blue-100 text-blue-800">No Debt</Badge>;
    if (ratio >= 1.25) return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
    if (ratio >= 1.1) return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Watch</Badge>;
    return <Badge variant="destructive">Risk</Badge>;
  };

  const header = (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/properties">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div>
          <h1 className="text-2xl font-bold">{property.name}</h1>
          <p className="text-muted-foreground">
            {property.address?.street}, {property.address?.city}
          </p>
        </div>

        <Badge className={cn('mt-1', verdict.color)}>{verdict.label}</Badge>
      </div>

      <div className="flex items-center gap-2">
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={() => handleOpenDialog('general')}>
              <Edit className="mr-2 h-4 w-4" /> Edit Settings
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Property Settings</DialogTitle>
              <DialogDescription>
                Update tenants, mortgage details, and configuration for {property.name}.
              </DialogDescription>
            </DialogHeader>

            <PropertyForm
              initialData={{ id: property.id, ...property }}
              onSuccess={() => {
                onUpdate();
                setIsEditOpen(false);
              }}
              defaultTab={formTab}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6 p-6">
        {header}

        <div className="space-y-6 pt-4">
          {/* Investor KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="NOI (Monthly)"
                      value={noi}
                      icon={<Wallet className="h-5 w-5 text-green-600" />}
                      isLoading={kpiLoading}
                      cardClassName={cn(
                        'shadow-lg',
                        noi >= 0 ? 'bg-green-50/70 border-green-200' : 'bg-red-50/70 border-red-200'
                      )}
                      colorClass={noi >= 0 ? 'text-green-700' : 'text-red-700'}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Net Operating Income: Rent minus operating expenses (excludes debt).</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Cash Flow After Debt"
                      value={cashFlow}
                      icon={<TrendingUp className="h-5 w-5 text-slate-500" />}
                      isLoading={kpiLoading}
                      colorClass={cashFlow >= 0 ? 'text-green-600' : 'text-red-600'}
                      cardClassName={cn(
                        'shadow-lg',
                        cashFlow >= 0 ? 'bg-green-50/70 border-green-200' : 'bg-red-50/70 border-red-200'
                      )}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>NOI minus principal & interest payments. The cash left in your pocket.</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Card className="shadow-lg h-full">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">DSCR</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {!isFinite(dscr) || dscr === 0 ? 'No Debt' : `${dscr.toFixed(2)}x`}
                        </div>
                        {getDscrBadge(dscr)}
                      </CardContent>
                    </Card>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Debt Service Coverage Ratio: NOI / Debt Payment. Lenders look for &gt;1.25x.</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatCard
                      title="Economic Occupancy"
                      value={economicOccupancy}
                      format="percent"
                      icon={<Users className="h-5 w-5 text-slate-500" />}
                      isLoading={kpiLoading}
                      description={`${formatCurrency(potentialRent - rentalIncome)} unpaid`}
                      cardClassName="shadow-lg bg-indigo-50/70 border-indigo-200"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Actual rent collected ÷ potential rent. Shows vacancy & bad debt impact.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Operational KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Debt Payment"
              value={totalDebtPayment}
              icon={<Landmark className="h-5 w-5 text-slate-500" />}
              isLoading={kpiLoading}
            />
            <StatCard
              title="Current Rent"
              value={currentRent}
              icon={<FileText className="h-5 w-5 text-slate-500" />}
              isLoading={kpiLoading}
            />
            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold capitalize">{status}</div>
              </CardContent>
            </Card>

            <StatCard
              title="Break-Even Rent"
              value={breakEvenRent}
              icon={<AlertTriangle className="h-5 w-5 text-slate-500" />}
              isLoading={kpiLoading}
              description={
                breakEvenRent > 0
                  ? `Surplus: ${formatCurrency(rentalIncome - breakEvenRent)}`
                  : 'No fixed costs'
              }
            />
          </div>

          <div className="space-y-2 pt-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
              <div className="bg-slate-200 p-2 rounded-full">
                <Bot className="h-5 w-5 text-slate-500 shrink-0" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">Insight</h4>
                <p className="text-sm text-slate-600">{getAiInsight}</p>
              </div>
            </div>
          </div>

          <PropertySetupBanner
            propertyId={property.id}
            propertyData={property}
            onOpenSettings={handleOpenDialog}
          />

          <Tabs defaultValue="tenants" className="w-full">
            <TabsList className="grid w-full grid-cols-6 lg:w-[850px]">
              <TabsTrigger value="tenants">Tenants</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="deposits">Deposits</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="tenants" className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Resident for {selectedMonthKey}</CardTitle>
                    <CardDescription>
                      Shows the tenant whose lease overlaps this month. If none, the property is vacant for that month.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog('tenants')}>
                      Manage Tenants
                    </Button>
                    <Button size="sm" onClick={() => setIsInviteOpen(true)} className="gap-2">
                      <UserPlus className="h-4 w-4" /> Create Portal
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  {monthTenant ? (
                    <div className="space-y-3">
                      <TenantRow
                        tenant={monthTenant}
                        index={0}
                        propertyId={property.id}
                        landlordId={user.uid}
                        onUpdate={onUpdate}
                        onOpenLease={handleOpenLeaseAgent}
                        isOccupantForMonth={true}
                        viewingDate={selectedMonthDate}
                        property={property}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                      <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-medium">Vacant for {selectedMonthKey}</p>
                      <p className="text-xs text-muted-foreground mt-1">No lease overlaps this month.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="income" className="mt-6">
              <PropertyFinancials propertyId={property.id} propertyName={property.name} view="income" />
            </TabsContent>

            <TabsContent value="expenses" className="mt-6">
              <PropertyFinancials propertyId={property.id} propertyName={property.name} view="expenses" />
            </TabsContent>

            <TabsContent value="deposits" className="mt-6">
              <PropertyFinancials propertyId={property.id} propertyName={property.name} view="deposits" />
            </TabsContent>

            <TabsContent value="documents" className="mt-6">
              <PropertyDocuments propertyId={property.id} landlordId={user.uid} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {isInviteOpen && (
        <InviteTenantModal
          isOpen={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          propertyId={property.id}
          landlordId={user.uid}
        />
      )}

      {isLeaseAgentOpen && selectedTenantForLease && (
        <LeaseAgentModal
          isOpen={isLeaseAgentOpen}
          onOpenChange={setLeaseAgentOpen}
          tenant={selectedTenantForLease}
          propertyId={property.id}
        />
      )}
    </>
  );
}
