
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore'; 
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Home, MapPin, ArrowRight, Loader2, AlertCircle, ArrowLeft, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ImportPropertiesDialog } from '@/components/dashboard/properties/import-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AddPropertyModal } from '@/components/dashboard/sales/AddPropertyModal';

export default function PropertiesListPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);
  
  const { data: properties, isLoading, refetch } = useCollection(propertiesQuery);
  
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);


  const getCompleteness = (p: any) => {
    let score = 20; 
    let missingItems = [];

    const hasTenants = p.tenants?.length > 0;
    const hasLoanDetails = p.mortgage?.lenderName || p.mortgage?.hasMortgage === 'no';
    const hasTaxAndInsurance = p.taxAndInsurance?.policyNumber || (p.taxAndInsurance?.annualPremium || 0) > 0;
    const hasVendors = p.preferredVendors?.length > 0;

    if (hasTenants) score += 20;
    else missingItems.push("Tenants");

    if (hasLoanDetails) score += 20;
    else missingItems.push("Loan Info");

    if (hasTaxAndInsurance) score += 20;
    else missingItems.push("Tax & Insurance");
    
    if (hasVendors) score += 20;
    else missingItems.push("Vendors");

    return { score, missingItems };
  };

  if (!isClient) {
    return (
        <div className="space-y-8 p-4 md:p-8">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-36" />
                    <Skeleton className="h-10 w-44" />
                </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                    <Card key={i} className="flex flex-col justify-between">
                       <CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
                       <CardContent><Skeleton className="h-10 w-full" /></CardContent>
                       <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/sales')}>
              <ArrowLeft className="h-5 w-5" />
           </Button>
           <div>
              <h1 className="text-3xl font-bold tracking-tight">My Properties</h1>
              <p className="text-muted-foreground">Manage your portfolio and automated ledgers.</p>
           </div>
        </div>
        
        <div className="flex items-center gap-2">
          <ImportPropertiesDialog />
          <AddPropertyModal onSuccess={refetch} />
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

      {!isLoading && properties && properties.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-slate-50">
          <Home className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium">No properties yet</h3>
          <p className="text-sm text-muted-foreground">Add your first property to start tracking.</p>
          <AddPropertyModal onSuccess={refetch} />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {properties && properties.map((property) => {
          const { score: progress, missingItems } = getCompleteness(property);
          return (
            <Card key={property.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Home className="h-5 w-5" /></div>
                  <Badge variant="secondary">{property.type || 'Rental'}</Badge>
                </div>
                <CardTitle className="mt-3 text-lg">{property.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 line-clamp-1">
                  <MapPin className="h-3 w-3" /> {property.address?.street}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pb-4">
                 <div className="space-y-3">
                    <div>
                       <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Profile Strength</span>
                          <span className={progress === 100 ? "text-green-600 font-bold" : "text-blue-600"}>{progress}%</span>
                       </div>
                       <Progress value={progress} className="h-2" />
                    </div>
                    {progress < 100 && (
                       <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>Missing: {missingItems.join(', ')}</span>
                       </div>
                    )}
                 </div>
              </CardContent>

              <CardFooter className="pt-3 border-t bg-slate-50/50 flex flex-col items-stretch gap-2">
                <Link href={`/dashboard/properties/${property.id}`} className="w-full">
                  <Button 
                      variant="ghost" 
                      className="w-full justify-between text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    Manage Property <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
