'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReportCard } from '@/components/dashboard/reports/cpa/ReportCard';
import { ScheduleEReport } from '@/components/dashboard/reports/cpa/ScheduleEReport';
import { DepreciationSchedule } from '@/components/dashboard/reports/cpa/DepreciationSchedule';
import { MortgageInterestReport } from '@/components/dashboard/reports/cpa/MortgageInterestReport';
import { GeneralLedgerCPA } from '@/components/dashboard/reports/cpa/GeneralLedgerCPA';
import { EquityRollForwardReport } from '@/components/dashboard/reports/cpa/EquityRollForwardReport';

export default function CpaReportsPage() {
    const router = useRouter();
    
    // State to hold the generated report data
    const [reportData, setReportData] = useState<any | null>(null);
    const [activeReport, setActiveReport] = useState<string | null>(null);
    const [reportParams, setReportParams] = useState<any>({});
    const [isLoading, setIsLoading] = useState(false);


    const handleGenerate = (reportName: string, data: any, params: any) => {
        setActiveReport(reportName);
        setReportData(data);
        setReportParams(params);
    };

    const handleLoading = (loading: boolean) => {
        setIsLoading(loading);
    }
    
    const reports = [
        { title: "Schedule E Summary", generator: "getScheduleESummary" },
        { title: "Depreciation Schedule", generator: "getDepreciationSchedule" },
        { title: "Mortgage Interest Summary", generator: "getMortgageInterestSummary" },
        { title: "General Ledger (CPA)", generator: "getGeneralLedger" },
        { title: "Owner Equity Roll-Forward", generator: "getEquityRollForward" },
    ];
    
    const renderActiveReport = () => {
        if (isLoading) {
             return <div className="text-center p-10">Loading report...</div>;
        }
        if (!activeReport || !reportData) {
            return <div className="text-center p-10 text-muted-foreground">Select and generate a report to view it here.</div>;
        }

        switch (activeReport) {
            case 'Schedule E Summary':
                return <ScheduleEReport data={reportData} />;
            case 'Depreciation Schedule':
                return <DepreciationSchedule data={reportData} />;
            case 'Mortgage Interest Summary':
                return <MortgageInterestReport data={reportData} />;
            case 'General Ledger (CPA)':
                return <GeneralLedgerCPA data={reportData} />;
            case 'Owner Equity Roll-Forward':
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reports.map(report => (
                    <ReportCard 
                        key={report.title}
                        title={report.title}
                        reportGenerator={report.generator}
                        onGenerate={(data, params) => handleGenerate(report.title, data, params)}
                        onLoading={handleLoading}
                    />
                ))}
            </div>
            
            <div className="mt-8">
                {renderActiveReport()}
            </div>
        </div>
    )
}
