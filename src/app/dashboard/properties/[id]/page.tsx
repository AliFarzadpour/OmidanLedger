'use client';

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { UnitMatrix } from '@/components/dashboard/properties/UnitMatrix';
import { PropertyDashboardSFH } from '@/components/dashboard/properties/PropertyDashboardSFH';
import { Loader2 } from 'lucide-react';

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();
  
  const propertyDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'properties', params.id);
  }, [firestore, params.id]);

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
          <div>
            <h1 className="text-3xl font-bold">{property.name} Central Hub</h1>
            <p className="text-muted-foreground">{property.address.street}, {property.address.city}</p>
          </div>
          {/* Add a button for building-wide bulk operations here */}
        </header>
        
        <UnitMatrix propertyId={params.id} />
      </div>
    );
  }

  // Otherwise, return your original Single Family interface
  return <PropertyDashboardSFH property={property} />;
}
