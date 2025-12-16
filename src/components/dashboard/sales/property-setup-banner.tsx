'use client';

import { useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Home, FileText, Users } from 'lucide-react';
import Link from 'next/link';

interface PropertySetupBannerProps {
  propertyId: string;
  propertyData: any;
  onOpenSettings: (tab: string) => void; // New prop for handling clicks
}

export function PropertySetupBanner({ propertyId, propertyData, onOpenSettings }: PropertySetupBannerProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  // Logic to determine what's missing
  const hasTenants = propertyData?.tenants && propertyData.tenants.length > 0;
  const hasMortgage = propertyData?.mortgage?.hasMortgage === 'yes' && propertyData?.mortgage?.lenderName;
  const hasTax = propertyData?.taxAndInsurance?.taxParcelId || (propertyData?.taxAndInsurance?.annualPremium || 0) > 0;

  // Calculate percentage
  let progress = 34; // Base score for having the property created
  if (hasTenants) progress += 22;
  if (hasMortgage) progress += 22;
  if (hasTax) progress += 22;

  // If mostly complete (99%+), hide the banner
  if (progress >= 99) return null;

  return (
    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 mb-8 shadow-sm">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-blue-950">
          Finish Setting Up {propertyData?.name || 'Property'}
        </h3>
        <span className="text-sm font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full w-fit">
          {Math.round(progress)}% Complete
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-blue-200/50 rounded-full h-2 mb-6 overflow-hidden">
        <div 
          className="bg-blue-600 h-full rounded-full transition-all duration-700 ease-out" 
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* 1. Add Tenants Button */}
        {!hasTenants && (
           <Button onClick={() => onOpenSettings('tenants')} variant="outline" className="h-auto py-4 px-4 justify-start bg-white hover:bg-blue-50 hover:border-blue-300 border-blue-200 shadow-sm relative group whitespace-normal">
               <div className="bg-blue-100 p-2.5 rounded-full mr-3 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                 <Users className="h-5 w-5" />
               </div>
               <div className="flex flex-col items-start min-w-0">
                 <span className="font-semibold text-blue-950 text-base">Add Tenants</span>
                 <span className="text-xs text-slate-500 font-normal mt-0.5 line-clamp-2 text-left">
                   Track leases and rent payments
                 </span>
               </div>
           </Button>
        )}

        {/* 2. Setup Mortgage Button */}
        {!hasMortgage && (
           <Button onClick={() => onOpenSettings('mortgage')} variant="outline" className="h-auto py-4 px-4 justify-start bg-white hover:bg-blue-50 hover:border-blue-300 border-blue-200 shadow-sm relative group whitespace-normal">
               <div className="bg-blue-100 p-2.5 rounded-full mr-3 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                 <Home className="h-5 w-5" />
               </div>
               <div className="flex flex-col items-start min-w-0">
                 <span className="font-semibold text-blue-950 text-base">Setup Mortgage</span>
                 <span className="text-xs text-slate-500 font-normal mt-0.5 line-clamp-2 text-left">
                   Track loan balances &amp; interest
                 </span>
               </div>
           </Button>
        )}

        {/* 3. Tax & Insurance Button */}
        {!hasTax && (
           <Button onClick={() => onOpenSettings('tax')} variant="outline" className="h-auto py-4 px-4 justify-start bg-white hover:bg-blue-50 hover:border-blue-300 border-blue-200 shadow-sm relative group whitespace-normal">
               <div className="bg-blue-100 p-2.5 rounded-full mr-3 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                 <FileText className="h-5 w-5" />
               </div>
               <div className="flex flex-col items-start min-w-0">
                 <span className="font-semibold text-blue-950 text-base">Tax &amp; Insurance</span>
                 <span className="text-xs text-slate-500 font-normal mt-0.5 line-clamp-2 text-left">
                   Record tax payments &amp; policies
                 </span>
               </div>
           </Button>
        )}
      </div>
    </div>
  );
}
