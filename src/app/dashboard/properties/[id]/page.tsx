'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase'; 
import { doc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Wallet, ShieldCheck, Users as UsersIcon, Building } from 'lucide-react';
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
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Landmark, DollarSign } from 'lucide-react';


export default function PropertyDetailsPage() {
  const { id } = useParams();
  const firestore = useFirestore();
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Fetch Property Data
  const { data: property, isLoading, refetch } = useDoc(
    doc(firestore, 'properties', id as string)
  );

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    refetch(); // Refetch the data to show updates
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading property details...</div>;
  if (!property) return <div className="p-8 text-center text-muted-foreground">Property not found or you do not have permission to view it.</div>;

  return (
    <div className="space-y-6 p-4 md:p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/properties">
            <Button variant="ghost" size="icon" aria-label="Back to properties">
                <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
                {property.name}
                <Badge variant="outline" className="text-sm font-normal">{property.type}</Badge>
            </h1>
            <p className="text-muted-foreground">{property.address.street}, {property.address.city}</p>
          </div>
        </div>
        
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Target Rent</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${(property.financials?.targetRent || 0).toLocaleString()}</div>
                  </CardContent>
              </Card>
               <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Status</CardTitle>
                    <Building className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold capitalize">{property.status || 'Active'}</div>
                  </CardContent>
              </Card>
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Mortgage</CardTitle>
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{property.mortgage?.hasMortgage === 'yes' ? 'Active' : 'None'}</div>
                    <p className="text-xs text-muted-foreground">{property.mortgage?.lenderName || 'No lender specified'}</p>
                  </CardContent>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="tenants" className="mt-6">
           <Card>
               <CardHeader>
                  <CardTitle>Current Residents</CardTitle>
                  <CardDescription>All tenants associated with this property.</CardDescription>
               </CardHeader>
               <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Term</TableHead>
                                <TableHead>Rent Portion</TableHead>
                                <TableHead>Contact</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {property.tenants && property.tenants.length > 0 ? (
                                property.tenants.map((t: any, i: number) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">{t.firstName} {t.lastName}</TableCell>
                                        <TableCell className="text-xs">{t.leaseStart} to {t.leaseEnd}</TableCell>
                                        <TableCell>${t.rentAmount?.toLocaleString()}</TableCell>
                                        <TableCell className="text-xs">{t.email}<br/>{t.phone}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No tenants recorded. Click "Edit Settings" to add one.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
               </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
           <PropertyFinancials 
              propertyId={property.id} 
              propertyName={property.name} 
              view="expenses" 
           />
        </TabsContent>

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
