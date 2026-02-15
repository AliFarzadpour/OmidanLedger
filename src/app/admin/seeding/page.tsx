'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { seedSampleData } from '@/actions/admin-seeding';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function SeedingPage() {
    const { user } = useUser();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSeed = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const result = await seedSampleData(user.uid);
            toast({
                title: 'Success!',
                description: result.message,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Seeding Failed',
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold">Sample Data Seeder</h1>
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                    Running the seeder will completely ERASE and REPLACE all data for the user <strong>sampledata@example.com</strong>.
                </AlertDescription>
            </Alert>
            <Card>
                <CardHeader>
                    <CardTitle>Seed Sample Account</CardTitle>
                    <CardDescription>
                        Click the button below to populate the sample user account with a full set of properties, transactions, and operational data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleSeed} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                        Seed Data for sampledata@example.com
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
