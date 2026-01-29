
'use client';

import { useState, useMemo, useEffect } from 'react';
import { doc, collection, query, deleteDoc, getDocs, Timestamp, getDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, UserPlus, Wallet, FileText, Download, Trash2, UploadCloud, Eye, Bot, Loader2, BookOpen, HandCoins, Building, Landmark, TrendingUp, AlertTriangle, Users, BadgeHelp } from 'lucide-react';
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import InviteTenantModal from '@/components/tenants/InviteTenantModal';
import { RecordPaymentModal } from '@/components/dashboard/sales/RecordPaymentModal';
import { TenantDocumentUploader } from '@/components/tenants/TenantDocumentUploader';
import { useToast } from '@/hooks/use-toast';
import { useStorage } from '@/firebase';
import { generateLease } from '@/ai/flows/lease-flow';
import { formatCurrency } from '@/lib/format';
import { ref, deleteObject } from 'firebase/storage';
import { isPast, parseISO, format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { calculateAmortization } from '@/actions/amortization-actions';
import { StatCard } from '@/components/dashboard/stat-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';


const TenantRow = ({ tenant, index, propertyId, landlordId, onUpdate, onOpenLease }: any) => {
    return (
        <div className="flex justify-between items-center border p-3 rounded-lg bg-slate-50/50">
            <div>
                <div className="flex items-center gap-2">
                    <p className="font-medium">{tenant.firstName} {tenant.lastName}</p>
                    {tenant.status && (
                        <Badge variant="outline" className={cn('capitalize text-xs h-5', tenant.status?.toLowerCase() === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-100 text-slate-600')}>
                            {tenant.status}
                        </Badge>
                    )}
                </div>
                <p className="text-sm text-muted-foreground">{tenant.email}</p>
            </div>
            <div className="text-right hidden sm:block">
                <p className="font-medium">${(tenant.rentAmount || 0).toLocaleString()}/mo</p>
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


function LeaseAgentModal({ tenant, propertyId, onOpenChange, isOpen }: { tenant: any, propertyId: string, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const flowResult = await generateLease({
        propertyId: propertyId,
        tenantId: tenant.email, 
        state: 'TX',
      });
      setResult(flowResult);
      toast({ title: 'Lease Saved!', description: 'The lease has been generated and saved to your documents tab.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
      onOpenChange(false); // Close the modal after action
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="text-primary"/> AI Agent Confirmation</DialogTitle>
          <DialogDescription>
            Please review the AI's plan before proceeding.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-4 rounded-lg border">
                <h4 className="font-semibold text-slate-800">Smart Summary</h4>
                <p className="text-sm text-slate-600 mt-1">
                    I will generate a Texas-compliant lease for {tenant.firstName} {tenant.lastName} and save it to this property's documents tab.
                </p>
            </div>
            <div>
                <h4 className="font-semibold text-slate-800">Legal Disclaimer</h4>
                <p className="text-xs text-muted-foreground mt-1">
                    This document was generated by an AI assistant. It is not a substitute for legal advice from a qualified attorney. Please review the document carefully before signing.
                </p>
            </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading} className="bg-primary hover:bg-primary/90">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
            Confirm & Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


function PropertyDocuments({ propertyId, landlordId }: { propertyId: string, landlordId: string}) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isUploaderOpen, setUploaderOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const docsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return query(collection(firestore, `properties/${propertyId}/documents`));
  }, [firestore, propertyId]);

  const { data: documents, isLoading, refetch: refetchDocs } = useCollection(docsQuery);

  const handleDelete = async (docData: any) => {
    if (!firestore || !storage) {
        toast({ variant: 'destructive', title: 'Error', description: 'Firebase services not available.' });
        return;
    }

    let fileRef;
    if (docData?.storagePath) {
        fileRef = ref(storage, docData.storagePath);
    } else if (docData?.downloadUrl) {
        fileRef = ref(storage, docData.downloadUrl);
    } else {
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
        console.error("Deletion Error:", error);
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
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString();
        }
    }
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString();
    }
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const onUploadSuccess = () => {
    refetchDocs();
    setUploaderOpen(false);
  }

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
                <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2"/>
                <p className="text-sm text-muted-foreground">No documents uploaded for this property yet.</p>
            </div>
          )}
          {!isLoading && documents && documents.length > 0 && (
            <div className="space-y-3">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-start justify-between p-3 bg-slate-50 border rounded-md">
                  <div>
                    <p className="font-medium">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground mt-1">Type: {doc.fileType} | Uploaded: {getSafeDate(doc.uploadedAt)}</p>
                    {doc.description && <p className="text-sm text-slate-600 mt-2 pl-2 border-l-2 border-slate-200">{doc.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1"><Eye className="h-3 w-3"/> View</Button>
                    </a>
                    <a href={doc.downloadUrl} download>
                      <Button variant="outline" size="sm" className="gap-1"><Download className="h-3 w-3"/> Download</Button>
                    </a>
                    
                    {isDeleting === doc.id ? (
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => {
                                handleDelete(doc);
                                setIsDeleting(null);
                            }}
                        >
                            Confirm Delete?
                        </Button>
                    ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => setIsDeleting(doc.id)}>
                            <Trash2 className="h-4 w-4"/>
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
  )
}

export function PropertyDashboardSFH({ property, onUpdate }: { property: any, onUpdate: () => void }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isLeaseAgentOpen, setLeaseAgentOpen] = useState(false);
  const [selectedTenantForLease, setSelectedTenantForLease] = useState<any>(null);
  const [formTab, setFormTab] = useState('general');

  const { user } = useUser();
  const firestore = useFirestore();
  const [interestForMonth, setInterestForMonth] = useState(0);

  // DYNAMIC MONTH KEY
  const monthKey = format(new Date(), 'yyyy-MM');
  
  const monthlyStatsRef = useMemoFirebase(() => {
    if (!firestore || !property?.id) return null;
    return doc(firestore, 'properties', property.id, 'monthlyStats', monthKey);
  }, [firestore, property, monthKey]);
  const { data: monthlyStats, isLoading: loadingTxs } = useDoc(monthlyStatsRef);

  useEffect(() => {
    if (!user || !property?.id) return;
    
    // Calculate interest for cash flow
    const calculateInterest = async () => {
      if (property.mortgage?.hasMortgage === 'yes' && property.mortgage.originalLoanAmount) {
          const result = await calculateAmortization({
              principal: property.mortgage.originalLoanAmount,
              annualRate: property.mortgage.interestRate,
              principalAndInterest: property.mortgage.principalAndInterest,
              loanStartDate: property.mortgage.purchaseDate,
              loanTermInYears: property.mortgage.loanTerm,
              targetDate: new Date().toISOString(),
          });
          if (result.success) {
              setInterestForMonth(result.interestPaidForMonth || 0);
          }
      }
    };
    calculateInterest();
  }, [user, property]);

  // SEPARATE ACTIVE AND PAST TENANTS
  const { activeTenants, pastTenants } = useMemo(() => {
    if (!property?.tenants) {
      return { activeTenants: [], pastTenants: [] };
    }
    
    const active: any[] = [];
    const past: any[] = [];

    property.tenants.forEach((t: any) => {
      // robust check: handles 'Active', 'active', 'ACTIVE'
      const isActive = (t.status || '').toLowerCase() === 'active';
      if (isActive) {
        active.push(t);
      } else {
        past.push(t);
      }
    });

    return { activeTenants: active, pastTenants: past };
  }, [property]);
  
  const { noi, cashFlow, dscr, economicOccupancy, breakEvenRent, rentalIncome, potentialRent, verdict } = useMemo(() => {
    if (!property) {
      return { noi: 0, cashFlow: 0, dscr: 0, economicOccupancy: 0, breakEvenRent: 0, rentalIncome: 0, potentialRent: 0, verdict: { label: 'Analyzing...', color: 'bg-gray-100 text-gray-800' } };
    }
  
    const rentalIncome = monthlyStats?.income || 0;
    const operatingExpenses = Math.abs(monthlyStats?.expenses || 0);
    const noiValue = rentalIncome - operatingExpenses;
  
    const debtPayment = property.mortgage?.principalAndInterest || 0;
    const totalDebtPayment = debtPayment + (property.mortgage?.escrowAmount || 0);
  
    const cashFlowValue = noiValue - debtPayment;
    const dscrValue = totalDebtPayment > 0 ? noiValue / totalDebtPayment : Infinity;
  
    const potentialRentValue = property.tenants?.filter((t: any) => t.status === 'active').reduce((sum: number, t: any) => sum + (t.rentAmount || 0), 0) || 0;
    const economicOccupancyValue = potentialRentValue > 0 ? (rentalIncome / potentialRentValue) * 100 : 0;
    
    const breakEvenRentValue = operatingExpenses + totalDebtPayment;
    const surplus = rentalIncome - breakEvenRentValue;
    
    let verdictLabel = "Stable";
    let verdictColor = "bg-blue-100 text-blue-800";
  
    if (cashFlowValue > 100 && dscrValue > 1.25) {
        verdictLabel = "Healthy Cash Flow";
        verdictColor = "bg-green-100 text-green-800";
    } else if (cashFlowValue < 0) {
        verdictLabel = "Underperforming";
        verdictColor = "bg-red-100 text-red-800";
    } else if (dscrValue < 1.25 && debtPayment > 0) {
        verdictLabel = "High Debt Ratio";
        verdictColor = "bg-amber-100 text-amber-800";
    }
  
    return { 
      noi: noiValue, 
      cashFlow: cashFlowValue, 
      dscr: dscrValue, 
      economicOccupancy: economicOccupancyValue, 
      breakEvenRent: breakEvenRentValue,
      surplus,
      rentalIncome: rentalIncome, 
      potentialRent: potentialRentValue,
      verdict: { label: verdictLabel, color: verdictColor },
    };
  }, [monthlyStats, property, interestForMonth]);
  
  const getAiInsight = useMemo(() => {
    if (loadingTxs) return "Analyzing property performance...";
    
    if (cashFlow > 0 && economicOccupancy < 80 && economicOccupancy > 0) {
        return `This property is cash-flowing. Improving the collection rate from ${economicOccupancy.toFixed(0)}% to 95% could increase monthly cash flow by approximately ${formatCurrency(potentialRent * 0.95 - rentalIncome)}.`;
    }
    if (dscr > 1.5 && property?.tenants?.length === 1) {
        return "Risk is tenant concentration (100% from one tenant). Consider adding a lease renewal reminder.";
    }
    if (cashFlow < 0 && noi > 0) {
        return "The property is profitable on an operating basis, but negative cash flow suggests the debt service is high. Consider refinancing options.";
    }
    if (dscr < 1.2 && dscr > 0 && isFinite(dscr)) {
        return "The debt service coverage ratio is below the typical lender threshold of 1.25x. Focus on increasing NOI by reducing expenses or raising rent.";
    }
    return "Property financials appear stable for the current period. Explore rent increase scenarios to optimize performance.";
  }, [loadingTxs, cashFlow, economicOccupancy, dscr, property, potentialRent, rentalIncome, noi]);


  const handleOpenDialog = (tab: string) => {
    setFormTab(tab);
    setIsEditOpen(true);
  }
  
  const handleOpenLeaseAgent = (tenant: any) => {
    setSelectedTenantForLease({...tenant });
    setLeaseAgentOpen(true);
  };
  
  if (!user) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!property) return <div className="p-8">Property not found.</div>;
  
  const getPropertyStatus = () => {
    const activeTenant = property.tenants?.find((t: any) => t.status === 'active');
    if (!activeTenant) return 'Vacant';
    if (activeTenant.leaseEnd && isPast(parseISO(activeTenant.leaseEnd))) {
      return 'Lease Expired';
    }
    return 'Occupied';
  };

  const status = getPropertyStatus();
  const activeTenant = property.tenants?.find((t: any) => t.status === 'active');
  const currentRent = activeTenant ? activeTenant.rentAmount : (property.financials?.targetRent || 0);
  const totalDebtPayment = (property.mortgage?.principalAndInterest || 0) + (property.mortgage?.escrowAmount || 0);
  
  const getDscrBadge = (ratio: number) => {
    if (!isFinite(ratio) || ratio === 0) return <Badge className="bg-blue-100 text-blue-800">No Debt</Badge>;
    if (ratio >= 1.25) return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
    if (ratio >= 1.1) return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Watch</Badge>;
    return <Badge variant="destructive">Risk</Badge>;
  }

  const header = (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/properties">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{property.name}</h1>
          <p className="text-muted-foreground">{property.address.street}, {property.address.city}</p>
        </div>
        <Badge className={cn("mt-1", verdict.color)}>{verdict.label}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
            <Button variant="outline" onClick={() => handleOpenDialog('general')}><Edit className="mr-2 h-4 w-4" /> Edit Settings</Button>
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
                onSuccess={() => { onUpdate(); setIsEditOpen(false); }} 
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

            {/* --- Investor KPIs --- */}
            <div className="grid grid-cols-4 gap-4">
                <TooltipProvider>
                    <Tooltip><TooltipTrigger asChild><div>
                        <StatCard title="NOI (Monthly)" value={noi} icon={<Wallet className="h-5 w-5 text-green-600"/>} isLoading={loadingTxs} cardClassName="bg-green-50/70 border-green-200" />
                    </div></TooltipTrigger><TooltipContent><p>Net Operating Income: Rent minus operating expenses (excludes debt).</p></TooltipContent></Tooltip>

                    <Tooltip><TooltipTrigger asChild><div>
                         <StatCard title="Cash Flow After Debt" value={cashFlow} icon={<TrendingUp className="h-5 w-5 text-slate-500" />} isLoading={loadingTxs} colorClass={cashFlow >= 0 ? "text-green-600" : "text-red-600"} cardClassName={cn(cashFlow >= 0 ? "bg-green-50/70 border-green-200" : "bg-red-50/70 border-red-200")} />
                    </div></TooltipTrigger><TooltipContent><p>NOI minus principal & interest payments. The cash left in your pocket.</p></TooltipContent></Tooltip>

                    <Tooltip><TooltipTrigger asChild><div>
                        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">DSCR</CardTitle></CardHeader><CardContent>
                            <div className="text-2xl font-bold">{!isFinite(dscr) || dscr === 0 ? 'No Debt' : `${dscr.toFixed(2)}x`}</div>
                            {getDscrBadge(dscr)}
                        </CardContent></Card>
                    </div></TooltipTrigger><TooltipContent><p>Debt Service Coverage Ratio: NOI / Debt Payment. Lenders look for &gt;1.25x.</p></TooltipContent></Tooltip>
                    
                    <Tooltip><TooltipTrigger asChild><div>
                        <StatCard title="Economic Occupancy" value={economicOccupancy} format="percent" icon={<Users className="h-5 w-5 text-slate-500" />} isLoading={loadingTxs} description={`${formatCurrency(potentialRent - rentalIncome)} unpaid`} cardClassName="bg-indigo-50/70 border-indigo-200" />
                    </div></TooltipTrigger><TooltipContent><p>Actual rent collected ÷ potential rent. Shows vacancy & bad debt impact.</p></TooltipContent></Tooltip>
                </TooltipProvider>
            </div>
            
            {/* --- Operational KPIs --- */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard title="Debt Payment" value={totalDebtPayment} icon={<Landmark className="h-5 w-5 text-slate-500" />} isLoading={loadingTxs} />
                <StatCard title="Current Rent" value={currentRent} icon={<FileText className="h-5 w-5 text-slate-500" />} isLoading={loadingTxs} />
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Status</CardTitle></CardHeader><CardContent><div className="text-xl font-bold capitalize">{status}</div></CardContent></Card>
                <StatCard 
                    title="Break-Even Rent" 
                    value={breakEvenRent} 
                    icon={<AlertTriangle className="h-5 w-5 text-slate-500" />} 
                    isLoading={loadingTxs} 
                    description={breakEvenRent > 0 ? `Surplus: ${formatCurrency(rentalIncome - breakEvenRent)}` : 'No fixed costs'}
                />
            </div>
            
             <div className="space-y-2 pt-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
                    <div className="bg-slate-200 p-2 rounded-full"><Bot className="h-5 w-5 text-slate-500 shrink-0" /></div>
                    <div>
                        <h4 className="font-semibold text-slate-800">Insight</h4>
                        <p className="text-sm text-slate-600">{getAiInsight}</p>
                    </div>
                </div>
            </div>

            <PropertySetupBanner propertyId={property.id} propertyData={property} onOpenSettings={handleOpenDialog}/>

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
                    <CardTitle>Current Residents</CardTitle>
                    <CardDescription>Lease details for this property.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog('tenants')}>Manage Tenants</Button>
                    <Button size="sm" onClick={() => setIsInviteOpen(true)} className="gap-2">
                        <UserPlus className="h-4 w-4" /> Create Portal
                    </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {(activeTenants.length > 0 || pastTenants.length > 0) ? (
                    <div className="space-y-6">
                        {/* --- Active Tenants Section --- */}
                        {activeTenants.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-green-700 flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    Active Residents
                                </h3>
                                {activeTenants.map((t: any, i: number) => (
                                    <TenantRow 
                                        key={`active-${i}`} 
                                        tenant={t} 
                                        index={i} 
                                        propertyId={property.id} 
                                        landlordId={user.uid}
                                        onUpdate={onUpdate}
                                        onOpenLease={handleOpenLeaseAgent}
                                    />
                                ))}
                            </div>
                        )}

                        {/* --- Visual Divider (Only if we have both types) --- */}
                        {activeTenants.length > 0 && pastTenants.length > 0 && (
                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">Past Residents</span>
                                </div>
                            </div>
                        )}

                        {/* --- Past Tenants Section --- */}
                        {pastTenants.length > 0 && (
                            <div className="space-y-4 opacity-75 grayscale-[0.3]">
                                {activeTenants.length === 0 && <h3 className="text-sm font-semibold text-muted-foreground">Past Residents</h3>}
                                {pastTenants.map((t: any, i: number) => (
                                    <TenantRow 
                                        key={`past-${i}`} 
                                        tenant={t} 
                                        index={i} 
                                        propertyId={property.id} 
                                        landlordId={user.uid}
                                        onUpdate={onUpdate}
                                        onOpenLease={handleOpenLeaseAgent}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    ) : (
                    <div className="text-center py-6">
                        <p className="text-muted-foreground text-sm">No tenants recorded.</p>
                        <Button variant="link" onClick={() => setIsInviteOpen(true)} className="mt-2">
                            Click "Create Portal" to add one.
                        </Button>
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
