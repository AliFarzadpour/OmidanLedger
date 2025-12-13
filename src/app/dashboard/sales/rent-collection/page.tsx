'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Home, Building, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PropertyForm } from '@/components/dashboard/sales/property-form';

export default function RentCollectionPage() {
  const [isFormOpen, setFormOpen] = useState(false);

  const handleCloseForm = () => {
    setFormOpen(false);
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
          <Button onClick={() => setFormOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Property
          </Button>
        </div>

        <Card className="flex h-64 flex-col items-center justify-center border-dashed">
            <Building className="h-12 w-12 text-muted-foreground" />
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-semibold">No Properties Yet</h3>
              <p className="text-muted-foreground">
                Add your first property to start collecting rent.
              </p>
            </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-4xl">
           <DialogHeader>
            <DialogTitle>Add New Property</DialogTitle>
           </DialogHeader>
          <PropertyForm
            onSuccess={handleCloseForm}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

    