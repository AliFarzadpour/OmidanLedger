'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Play, FileDown } from 'lucide-react';
import { format } from 'date-fns';

interface ReportCardProps {
    title: string;
    description: string;
    icon: React.ElementType;
    properties: { id: string; name: string }[];
    isLoadingProperties: boolean;
}

export function ReportCard({ title, description, icon: Icon, properties, isLoadingProperties }: ReportCardProps) {
    const currentYear = new Date().getFullYear();
    const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
    const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
    const [scope, setScope] = useState('all');

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Icon className="h-5 w-5 text-primary" />
                            {title}
                        </CardTitle>
                        <CardDescription className="mt-1">{description}</CardDescription>
                    </div>
                </div>
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
                            {properties.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between bg-slate-50/50 p-4 border-t">
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                        <FileDown className="h-4 w-4" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                        <FileDown className="h-4 w-4" /> CSV
                    </Button>
                </div>
                 <Button size="sm" className="gap-2">
                    <Play className="h-4 w-4" /> Generate Report
                </Button>
            </CardFooter>
        </Card>
    );
}
