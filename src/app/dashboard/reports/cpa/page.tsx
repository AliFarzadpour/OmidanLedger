'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, FileText, Landmark, Users } from 'lucide-react';
import { ReportCard } from '@/components/dashboard/reports/cpa/ReportCard';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

export default function CpaReportsPage() {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const [properties, setProperties] = useState<{ id: string, name: string }[]>([]);

    const propertiesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
    }, [user, firestore]);

    const { data: fetchedProperties, isLoading } = useCollection(propertiesQuery);

    useEffect(() => {
        if (fetchedProperties) {
            const propsData = fetchedProperties.map((p: any) => ({ id: p.id, name: p.name }));
            setProperties([{ id: 'all', name: 'All Properties (Portfolio)' }, ...propsData]);
        }
    }, [fetchedProperties]);

    const reports = [
        { title: "Schedule E Summary", description: "IRS-ready summary of rental income and expenses.", icon: FileText },
        { title: "Depreciation Schedule", description: "Manage and track asset depreciation inputs.", icon: BookOpen },
        { title: "Mortgage Interest Summary", description: "Form 1098 data for all properties.", icon: Landmark },
        { title: "Owner Equity Roll-Forward", description: "Tracks contributions and distributions for the period.", icon: Users },
    ];
    
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
                        description={report.description}
                        icon={report.icon}
                        properties={properties}
                        isLoadingProperties={isLoading}
                    />
                ))}
            </div>
        </div>
    )
}
