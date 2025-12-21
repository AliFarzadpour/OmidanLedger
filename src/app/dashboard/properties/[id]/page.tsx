'use client';

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { UnitMatrix } from '@/components/dashboard/properties/UnitMatrix';
import { PropertyDashboardSFH } from '@/components/dashboard/properties/PropertyDashboardSFH';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function PropertyDetailPage() {
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const propertyDocRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'properties', id);
  }, [firestore, id]);

  const { data: property, isLoading } = useDoc(propertyDocRef);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-20">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // --- THE INTERFACE ROUTER ---
  // If it's a multi-unit or commercial property, show the Central Hub (Unit Matrix)
  if (property?.isMultiUnit) {
    return (
      <div className="space-y-6 p-8">
        <header className="flex justify-between items-end">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/properties')}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{property.name} Central Hub</h1>
              <p className="text-muted-foreground">{property.address.street}, {property.address.city}</p>
            </div>
          </div>
          {/* Add a button for building-wide bulk operations here */}
        </header>
        
        <UnitMatrix propertyId={id} />
      </div>
    );
  }

  // Otherwise, return your original Single Family interface
  return <PropertyDashboardSFH property={property} />;
}
