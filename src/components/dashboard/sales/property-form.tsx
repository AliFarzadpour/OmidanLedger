'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';

const numberPreprocess = (val: any) => parseFloat(String(val).replace(/,/g, '')) || 0;

const propertySchema = z.object({
  name: z.string().min(1, 'Property name is required.'),
  address: z.object({
    street: z.string().min(1, 'Street address is required.'),
    city: z.string().min(1, 'City is required.'),
    state: z.string().min(1, 'State is required.'),
    zip: z.string().min(1, 'ZIP code is required.'),
    country: z.string().optional(),
  }),
  financials: z.object({
    targetRent: z.preprocess(numberPreprocess, z.number().positive().optional()),
    securityDeposit: z.preprocess(numberPreprocess, z.number().positive().optional()),
    mortgagePayment: z.preprocess(numberPreprocess, z.number().positive().optional()),
  }),
  specs: z.object({
    units: z.preprocess(numberPreprocess, z.number().int().positive().optional()),
    type: z.enum(['Residential', 'Commercial', 'Industrial', 'Land', 'Other']).optional(),
  }),
});

export type Property = z.infer<typeof propertySchema> & { id?: string, userId?: string };

interface PropertyFormProps {
  property?: Property | null;
  onSave: (property: Property) => void;
  onCancel: () => void;
}

export function PropertyForm({ property, onSave, onCancel }: PropertyFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<Property>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: '',
      address: { street: '', city: '', state: '', zip: '', country: 'USA' },
      financials: { targetRent: 0, securityDeposit: 0, mortgagePayment: 0 },
      specs: { units: 1, type: 'Residential' },
    },
  });
  
  useEffect(() => {
    if (property) {
      form.reset(property);
    } else {
      form.reset({
        name: '',
        address: { street: '', city: '', state: '', zip: '', country: 'USA' },
        financials: { targetRent: 0, securityDeposit: 0, mortgagePayment: 0 },
        specs: { units: 1, type: 'Residential' },
      });
    }
  }, [property, form]);


  const onSubmit = async (values: Property) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
      let docRef;
      const propertyData = {
        ...values,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (property?.id) {
        docRef = doc(firestore, 'properties', property.id);
        await setDoc(docRef, propertyData, { merge: true });
      } else {
        docRef = await addDoc(collection(firestore, 'properties'), {
            ...propertyData,
            createdAt: serverTimestamp(),
        });
      }
      
      const savedProperty = { ...propertyData, id: docRef.id };

      toast({
        title: property?.id ? 'Property Updated' : 'Property Added',
        description: `${values.name} has been saved successfully.`,
      });
      
      onSave(savedProperty);

    } catch (error: any) {
      console.error('Error saving property:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Could not save the property.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="ops">Operational</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 123 Main St Duplex" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="address.street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-4">
                <FormField
                    control={form.control}
                    name="address.city"
                    render={({ field }) => (
                        <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="address.state"
                    render={({ field }) => (
                        <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="address.zip"
                    render={({ field }) => (
                        <FormItem><FormLabel>ZIP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                />
            </div>
          </TabsContent>

          <TabsContent value="financials" className="space-y-4 pt-4">
             <FormField
                control={form.control}
                name="financials.targetRent"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Target Monthly Rent</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="financials.securityDeposit"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Security Deposit</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="financials.mortgagePayment"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Monthly Mortgage (if any)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
          </TabsContent>
          
          <TabsContent value="ops" className="space-y-4 pt-4">
            <FormField
                control={form.control}
                name="specs.type"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Residential">Residential</SelectItem>
                                <SelectItem value="Commercial">Commercial</SelectItem>
                                <SelectItem value="Industrial">Industrial</SelectItem>
                                <SelectItem value="Land">Land</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="specs.units"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Number of Units</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
          </TabsContent>
        </Tabs>
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Property'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
