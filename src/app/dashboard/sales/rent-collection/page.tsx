'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Home, Building, X, Edit, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PropertyForm } from '@/components/dashboard/sales/property-form';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';

// Infer the type from the form schema if possible, or define it manually
// This should match the structure of your Firestore documents for properties
interface Property {
  id: string;
  name: string;
  type: 'single-family' | 'multi-family' | 'condo' | 'commercial';
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  financials: {
    targetRent: number;
  };
  [key: string]: any; // Allow other properties
}


export default function RentCollectionPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

  const handleOpenForm = (property: Property | null = null) => {
    setSelectedProperty(property);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setSelectedProperty(null); // Clear selection on close
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></CardContent>
              <CardFooter><Skeleton className="h-6 w-1/4" /></CardFooter>
            </Card>
          ))}
        </div>
      );
    }
    if (!properties || properties.length === 0) {
      return (
        <Card className="flex h-64 flex-col items-center justify-center border-dashed">
            <Building className="h-12 w-12 text-muted-foreground" />
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-semibold">No Properties Yet</h3>
              <p className="text-muted-foreground">
                Add your first property to start collecting rent.
              </p>
            </CardContent>
        </Card>
      );
    }
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {properties.map(property => (
          <Card 
            key={property.id} 
            className="flex flex-col cursor-pointer hover:shadow-lg transition-shadow group"
            onClick={() => handleOpenForm(property)}
          >
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>{property.name}</CardTitle>
                <Badge variant="outline" className="mt-1">{property.type}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <Edit className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                {`${property.address.street}, ${property.address.city}, ${property.address.state}`}
              </p>
            </CardContent>
            <CardFooter>
                <span className="text-lg font-bold text-green-600">
                    {formatCurrency(property.financials?.targetRent || 0)}
                </span>
                <span className="text-xs text-muted-foreground ml-1">/ mo</span>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Properties</h1>
            <p className="text-muted-foreground">
              Add and manage your rental properties.
            </p>
          </div>
          <Button onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Property
          </Button>
        </div>

        {renderContent()}

      </div>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-4xl">
           <DialogHeader>
            <DialogTitle>{selectedProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
           </DialogHeader>
          <PropertyForm
            // Pass the selected property to the form for editing, or null for adding
            property={selectedProperty} 
            onSuccess={handleCloseForm}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}