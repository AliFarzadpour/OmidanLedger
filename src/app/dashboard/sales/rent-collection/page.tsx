'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { PlusCircle, Home, Building, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PropertyForm, type Property } from '@/components/dashboard/sales/property-form';
import { PropertyTable } from '@/components/dashboard/sales/property-table';

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

  const handleAddNew = () => {
    setSelectedProperty(null);
    setFormOpen(true);
  };

  const handleEdit = (property: Property) => {
    setSelectedProperty(property);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setSelectedProperty(null);
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
          <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Property
          </Button>
        </div>

        {isLoading ? (
            <Card>
                <CardHeader>
                    <CardTitle>Loading Properties...</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Fetching your data.</p>
                </CardContent>
            </Card>
        ) : properties && properties.length > 0 ? (
          <PropertyTable properties={properties} onEdit={handleEdit} />
        ) : (
          <Card className="flex h-64 flex-col items-center justify-center border-dashed">
            <Building className="h-12 w-12 text-muted-foreground" />
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-semibold">No Properties Yet</h3>
              <p className="text-muted-foreground">
                Add your first property to start collecting rent.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-4xl">
           <DialogHeader>
            <DialogTitle>{selectedProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
           </DialogHeader>
          <PropertyForm
            property={selectedProperty}
            onSave={handleCloseForm}
            onCancel={handleCloseForm}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
