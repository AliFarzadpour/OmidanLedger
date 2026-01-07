'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Play, FileDown, Loader2 } from 'lucide-react';
import * as cpaActions from '@/actions/cpa-reports';
import { exportToCSV, exportToPDF } from '@/lib/report-exporter';


interface ReportCardProps {
    title: string;
    reportGenerator: keyof typeof cpaActions;
    onGenerate: (data: any, params: any) => void;
    onLoading: (loading: boolean) => void;
}

export function ReportCard({ title, reportGenerator, onGenerate, onLoading }: ReportCardProps) {
    const { user } = useUser();
    const firestore = useFirestore();

    const currentYear = new Date().getFullYear();
    const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
    const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
    const [scope, setScope] = useState('all');
    const [isLoading, setIsLoading] = useState(false);

    const propertiesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
    }, [user, firestore]);

    const { data: properties, isLoading: isLoadingProperties } = useCollection(propertiesQuery);

    const handleGenerate = async () => {
        if (!user) return;
        setIsLoading(true);
        onLoading(true);
        try {
            const action = cpaActions[reportGenerator] as Function;
            const params = { userId: user.uid, startDate, endDate, propertyId: scope };
            const data = await action(params);
            onGenerate(data, { title, startDate, endDate, scope });
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
            onLoading(false);
        }
    };
    
    const handleExport = async (format: 'pdf' | 'csv') => {
        const action = cpaActions[reportGenerator] as Function;
        const params = { userId: user!.uid, startDate, endDate, propertyId: scope };
        const data = await action(params);

        const propertyName = scope === 'all' ? 'All Properties' : properties?.find(p => p.id === scope)?.name || 'Unknown Property';

        if (format === 'pdf') {
            exportToPDF(title, data, { startDate, endDate, property: propertyName });
        } else {
            exportToCSV(title, data);
        }
    }

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                        <Label>Start Date</Label>
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>End Date</Label>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>
                <div className="grid gap-1.5">
                    <Label>Scope</Label>
                    <Select value={scope} onValueChange={setScope} disabled={isLoadingProperties}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select property..." />
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="all">All Properties (Portfolio)</SelectItem>
                            {properties?.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between bg-slate-50/50 p-4 border-t">
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport('pdf')}>
                        <FileDown className="h-4 w-4" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport('csv')}>
                        <FileDown className="h-4 w-4" /> CSV
                    </Button>
                </div>
                 <Button size="sm" className="gap-2" onClick={handleGenerate} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Generate Report
                </Button>
            </CardFooter>
        </Card>
    );
}
