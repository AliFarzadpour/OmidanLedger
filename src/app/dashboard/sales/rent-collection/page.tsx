'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Home } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AddPropertyDialog } from '@/components/dashboard/sales/add-property-dialog';

export default function RentCollectionPage() {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [properties, setProperties] = useState([]); // Placeholder for properties

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
          <Button onClick={() => setDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Property
          </Button>
        </div>

        {properties.length === 0 ? (
          <Card className="flex h-64 flex-col items-center justify-center border-dashed">
            <Home className="h-12 w-12 text-muted-foreground" />
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-semibold">No Properties Yet</h3>
              <p className="text-muted-foreground">
                Add your first property to start collecting rent.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Property cards will be rendered here */}
          </div>
        )}
      </div>

      <AddPropertyDialog isOpen={isDialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
