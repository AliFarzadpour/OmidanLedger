'use client';

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { UnitMatrix } from '@/components/dashboard/properties/UnitMatrix';
import { PropertyDashboardSFH } from '@/components/dashboard/properties/PropertyDashboardSFH';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation'; // Import useParams

export default function PropertyDetailPage() {
  const firestore = useFirestore();
  const params = useParams(); // Use the hook to get params
  const id = params.id as string; // Extract id from the hook's result

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
          <div>
            <h1 className="text-3xl font-bold">{property.name} Central Hub</h1>
            <p className="text-muted-foreground">{property.address.street}, {property.address.city}</p>
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
