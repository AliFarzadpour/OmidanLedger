'use client';

import { useParams } from 'next/navigation';
import { useDoc } from '@/firebase'; 
import { doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit } from 'lucide-react';
import Link from 'next/link';
import { PropertyForm } from '@/components/dashboard/sales/property-form'; 
import { PropertyFinancials } from '@/components/dashboard/sales/property-financials'; 
import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
// FIX: Added Card imports here
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const firestore = useFirestore();
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Fetch Property Data
  const { data: property, isLoading, refetch } = useDoc(
    doc(firestore, 'properties', id as string)
  );

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    refetch(); // Refetch the data to show updates
  };

  if (isLoading) return <div className="p-8">Loading property...</div>;
  if (!property) return <div className="p-8">Property not found.</div>;

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/properties">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{property.name}</h1>
            <p className="text-muted-foreground">{property.address.street}, {property.address.city}</p>
          </div>
        </div>
        
        {/* EDIT BUTTON (Opens the Form Modal) */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Edit className="mr-2 h-4 w-4" /> Edit Settings</Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl h-[90vh] p-0">
             <DialogHeader className="p-6 pb-0">
                <DialogTitle>Edit Property Settings</DialogTitle>
                <DialogDescription>
                   Update tenants, mortgage details, and configuration for {property.name}.
                </DialogDescription>
             </DialogHeader>
             <div className="overflow-y-auto px-6 pb-6">
                <PropertyForm initialData={{ id: property.id, ...property }} onSuccess={handleEditSuccess} />
             </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* MAIN TABS */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-6">
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                 <CardHeader className="pb-2">
                    <CardDescription>Target Rent</CardDescription>
                    <CardTitle className="text-2xl font-bold">${(property.financials?.targetRent || 0).toLocaleString()}</CardTitle>
                 </CardHeader>
              </Card>
              <Card>
                 <CardHeader className="pb-2">
                    <CardDescription>Status</CardDescription>
                    <CardTitle className="text-2xl font-bold capitalize">
                        {property.tenants && property.tenants.length > 0 ? 'Occupied' : 'Vacant'}
                    </CardTitle>
                 </CardHeader>
              </Card>
           </div>
        </TabsContent>

        {/* 2. TENANTS TAB (Read Only View) */}
        <TabsContent value="tenants" className="mt-6">
           <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Current Residents</CardTitle>
                    <CardDescription>Lease details for this property.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>Manage Tenants</Button>
              </CardHeader>
              <CardContent>
                  {property.tenants && property.tenants.length > 0 ? (
                     <div className="space-y-4">
                        {property.tenants.map((t: any, i: number) => (
                            <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                               <div>
                                  <p className="font-medium">{t.firstName} {t.lastName}</p>
                                  <p className="text-sm text-muted-foreground">{t.email}</p>
                               </div>
                               <div className="text-right">
                                  <p className="font-medium">${t.rentAmount.toLocaleString()}/mo</p>
                                  <p className="text-xs text-muted-foreground">Lease ends: {t.leaseEnd || 'N/A'}</p>
                               </div>
                            </div>
                        ))}
                     </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No tenants recorded. Click "Edit Settings" to add one.</p>
                  )}
              </CardContent>
           </Card>
        </TabsContent>

        {/* 3. EXPENSES (was Financials) TAB */}
        <TabsContent value="expenses" className="mt-6">
           <PropertyFinancials 
              propertyId={property.id} 
              propertyName={property.name} 
              view="expenses" 
           />
        </TabsContent>

        {/* 4. INCOME (was Leases) TAB */}
        <TabsContent value="income" className="mt-6">
           <PropertyFinancials 
              propertyId={property.id} 
              propertyName={property.name} 
              view="income" 
           />
        </TabsContent>

      </Tabs>
    </div>
  );
}