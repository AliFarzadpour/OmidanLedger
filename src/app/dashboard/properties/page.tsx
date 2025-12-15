'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress'; // Make sure you have this shadcn component
import { Plus, Home, MapPin, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QuickPropertyForm } from '@/components/dashboard/sales/quick-property-form'; // NEW IMPORT

export default function PropertiesListPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const fetchProperties = async () => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      const q = query(collection(firestore, 'properties'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProperties(data);
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [user, firestore]);

  // HELPER: Calculate Profile Completeness
  const getCompleteness = (p: any) => {
    let score = 20; // Base score for creating it
    if (p.tenants?.length > 0) score += 20;
    if (p.mortgage?.lenderName) score += 20;
    if (p.taxAndInsurance?.policyNumber) score += 20;
    if (p.preferredVendors?.length > 0) score += 20;
    return score;
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Properties</h1>
          <p className="text-muted-foreground">Manage your portfolio.</p>
        </div>
        
        {/* QUICK ADD MODAL */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
             <DialogHeader>
               <DialogTitle>Add New Property</DialogTitle>
             </DialogHeader>
             <QuickPropertyForm onSuccess={() => { setIsAddOpen(false); fetchProperties(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {loading && <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

      {!loading && properties.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-slate-50">
          <Home className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium">No properties yet</h3>
          <Button variant="outline" className="mt-4" onClick={() => setIsAddOpen(true)}>Add Property</Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => {
          const progress = getCompleteness(property);
          return (
            <Card key={property.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Home className="h-5 w-5" /></div>
                  <Badge variant={property.tenants?.length > 0 ? "default" : "secondary"}>
                    {property.tenants?.length || 0} Unit{(property.tenants?.length || 0) !== 1 && 's'}
                  </Badge>
                </div>
                <CardTitle className="mt-3 text-lg">{property.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 line-clamp-1">
                  <MapPin className="h-3 w-3" /> {property.address?.street}, {property.address?.city}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pb-4">
                 <div className="space-y-3">
                    {/* Setup Progress */}
                    <div>
                       <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Profile Strength</span>
                          <span className={progress === 100 ? "text-green-600 font-bold" : "text-blue-600"}>{progress}%</span>
                       </div>
                       <Progress value={progress} className="h-2" />
                    </div>

                    {/* Missing Data Nudges */}
                    {progress < 100 && (
                       <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>
                             Missing: 
                             {!property.tenants?.length && " Tenants,"} 
                             {!property.mortgage?.lenderName && " Loan Info,"} 
                             {!property.taxAndInsurance?.policyNumber && " Tax/Ins"}
                          </span>
                       </div>
                    )}
                 </div>
              </CardContent>

              <CardFooter className="pt-3 border-t bg-slate-50/50">
                <Link href={`/dashboard/properties/${property.id}`} className="w-full">
                  <Button variant="ghost" className="w-full justify-between text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    Manage Property <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
