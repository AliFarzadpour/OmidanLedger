'use client';

import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase'; // Use your existing hooks
import { collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Plus, Home, FileText } from 'lucide-react';
import Link from 'next/link';

export function PropertySetupBanner({ propertyId, propertyData }: { propertyId: string, propertyData: any }) {
  const firestore = useFirestore();
  const { user } = useUser();

  // 1. SAFE QUERIES: Wrapped in useMemoFirebase to PREVENT INFINITE LOOPS
  const tenantsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid), where('id', '==', propertyId));
  }, [firestore, propertyId, user]);

  const mortgageQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    // Assuming mortgage is a field on the property document itself
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid), where('id', '==', propertyId));
  }, [firestore, propertyId, user]);

  const taxQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    // Assuming tax is a field on the property document itself
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid), where('id', '==', propertyId));
  }, [firestore, propertyId, user]);

  // 2. Fetch data safely
  const { data: properties, isLoading: loadingProperties } = useCollection(tenantsQuery);
  
  if (loadingProperties) return null;

  const currentProperty = properties?.[0];

  // 3. Calculate Progress
  const hasTenants = currentProperty?.tenants && currentProperty.tenants.length > 0;
  const hasMortgage = currentProperty?.mortgage?.hasMortgage === 'yes' && currentProperty?.mortgage?.lenderName;
  const hasTax = currentProperty?.taxAndInsurance?.taxParcelId || currentProperty?.taxAndInsurance?.annualPremium > 0;
  
  let progress = 0;
  if (propertyData?.address?.street) progress += 34; // Base progress for having the property
  if (hasTenants) progress += 22;
  if (hasMortgage) progress += 22;
  if (hasTax) progress += 22;


  // If complete, hide the banner
  if (progress >= 99) return null;

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-blue-900">
          Finish Setting Up {propertyData?.name || 'Property'}
        </h3>
        <span className="text-sm font-bold text-blue-700">{Math.round(progress)}% Complete</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-blue-200 rounded-full h-2.5 mb-6">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {!hasTenants && (
           <Button variant="outline" className="h-auto p-4 justify-start bg-white hover:bg-blue-50 border-blue-200" asChild>
             <Link href={`/dashboard/properties/${propertyId}?tab=tenants`}>
               <div className="bg-blue-100 p-2 rounded-full mr-3 text-blue-600">
                 <Plus className="h-5 w-5" />
               </div>
               <div className="text-left">
                 <div className="font-semibold text-blue-900">Add Tenants</div>
                 <div className="text-xs text-blue-600/70 font-normal">Track leases and rent payments</div>
               </div>
             </Link>
           </Button>
        )}
        {!hasMortgage && (
           <Button variant="outline" className="h-auto p-4 justify-start bg-white hover:bg-blue-50 border-blue-200" asChild>
             <Link href={`/dashboard/properties/${propertyId}?tab=mortgage`}>
               <div className="bg-blue-100 p-2 rounded-full mr-3 text-blue-600">
                 <Home className="h-5 w-5" />
               </div>
               <div className="text-left">
                 <div className="font-semibold text-blue-900">Setup Mortgage</div>
                 <div className="text-xs text-blue-600/70 font-normal">Track loan balances & interest</div>
               </div>
             </Link>
           </Button>
        )}

        {!hasTax && (
           <Button variant="outline" className="h-auto p-4 justify-start bg-white hover:bg-blue-50 border-blue-200" asChild>
             <Link href={`/dashboard/properties/${propertyId}?tab=tax`}>
               <div className="bg-blue-100 p-2 rounded-full mr-3 text-blue-600">
                 <FileText className="h-5 w-5" />
               </div>
               <div className="text-left">
                 <div className="font-semibold text-blue-900">Tax & Insurance</div>
                 <div className="text-xs text-blue-600/70 font-normal">Record tax payments & policies</div>
               </div>
             </Link>
           </Button>
        )}
      </div>
    </div>
  );
}
