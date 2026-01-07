
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, FileDown, Loader2 } from 'lucide-react';
import { ScheduleEReport } from '@/components/dashboard/reports/cpa/ScheduleEReport';
import { DepreciationSchedule } from '@/components/dashboard/reports/cpa/DepreciationSchedule';
import { MortgageInterestReport } from '@/components/dashboard/reports/cpa/MortgageInterestReport';
import { GeneralLedgerCPA } from '@/components/dashboard/reports/cpa/GeneralLedgerCPA';
import { EquityRollForwardReport } from '@/components/dashboard/reports/cpa/EquityRollForwardReport';
import * as cpaActions from '@/actions/cpa-reports';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToCSV, exportToPDF } from '@/lib/report-exporter';

const reportOptions = [
    { label: "Schedule E Summary", value: "getScheduleESummary" },
    { label: "Depreciation Schedule", value: "getDepreciationSchedule" },
    { label: "Mortgage Interest Summary", value: "getMortgageInterestSummary" },
    { label: "General Ledger (CPA)", value: "getGeneralLedger" },
    { label: "Owner Equity Roll-Forward", value: "getEquityRollForward" },
];

export default function CpaReportsPage() {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();

    // State for the generated report
    const [reportData, setReportData] = useState<any | null>(null);
    const [activeReport, setActiveReport] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // State for form inputs
    const currentYear = new Date().getFullYear();
    const [selectedReport, setSelectedReport] = useState(reportOptions[0].value);
    const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
    const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
    const [scope, setScope] = useState('all');

    const propertiesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
    }, [user, firestore]);
    const { data: properties, isLoading: isLoadingProperties } = useCollection(propertiesQuery);

    const handleGenerate = async () => {
        if (!user || !selectedReport) return;
        setIsLoading(true);
        setReportData(null); // Clear previous report
        try {
            const action = cpaActions[selectedReport as keyof typeof cpaActions] as Function;
            const params = { userId: user.uid, startDate, endDate, propertyId: scope };
            const data = await action(params);
            setActiveReport(selectedReport);
            setReportData(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = (format: 'pdf' | 'csv') => {
        if (!reportData) return;
        const reportTitle = reportOptions.find(r => r.value === activeReport)?.label || 'Report';
        const propertyName = scope === 'all' ? 'All Properties' : properties?.find((p: any) => p.id === scope)?.name || 'Unknown Property';
        const params = { startDate, endDate, property: propertyName };

        if (format === 'pdf') {
            exportToPDF(reportTitle, reportData, params);
        } else {
            exportToCSV(reportTitle, reportData);
        }
    }
    
    const renderActiveReport = () => {
        if (isLoading) {
             return <div className="text-center p-10"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div>;
        }
        if (!activeReport || !reportData) {
            return <div className="text-center p-10 text-muted-foreground">Select and generate a report to view it here.</div>;
        }

        switch (activeReport) {
            case 'getScheduleESummary':
                return <ScheduleEReport data={reportData} />;
            case 'getDepreciationSchedule':
                return <DepreciationSchedule data={reportData} />;
            case 'getMortgageInterestSummary':
                return <MortgageInterestReport data={reportData} />;
            case 'getGeneralLedger':
                return <GeneralLedgerCPA data={reportData} />;
            case 'getEquityRollForward':
                return <EquityRollForwardReport data={reportData} />;
            default:
                return null;
        }
    };


    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">CPA & Tax Center</h1>
                    <p className="text-muted-foreground">Generate year-end reports for tax preparation.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Report Generator</CardTitle>
                    <CardDescription>Select a report type and filters, then generate your document.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 grid gap-1.5">
                        <Label>Report Type</Label>
                        <Select value={selectedReport} onValueChange={setSelectedReport}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {reportOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-1.5">
                        <Label>Start Date</Label>
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>End Date</Label>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                     <div className="md:col-span-2 grid gap-1.5">
                        <Label>Scope</Label>
                        <Select value={scope} onValueChange={setScope} disabled={isLoadingProperties}>
                            <SelectTrigger><SelectValue placeholder="Select property..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Properties (Portfolio)</SelectItem>
                                {properties?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end bg-slate-50/50 p-4 border-t">
                    <Button size="sm" className="gap-2" onClick={handleGenerate} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Generate Report
                    </Button>
                </CardFooter>
            </Card>

            
            <div className="mt-8">
                 {reportData && (
                    <div className="flex justify-end gap-2 mb-4">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport('pdf')}>
                            <FileDown className="h-4 w-4" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport('csv')}>
                            <FileDown className="h-4 w-4" /> CSV
                        </Button>
                    </div>
                )}
                {renderActiveReport()}
            </div>
        </div>
    )
}
