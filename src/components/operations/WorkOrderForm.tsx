
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { saveWorkOrder } from '@/actions/work-order-actions';
import { Loader2, CalendarIcon, Paperclip, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useState, useEffect } from 'react';

const WorkOrderSchema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
  unitId: z.string().optional(),
  tenantId: z.string().optional(),
  vendorId: z.string().optional(),
  title: z.string().min(3, 'Title is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['Low', 'Normal', 'High', 'Emergency']),
  status: z.enum(['New', 'Scheduled', 'In Progress', 'Waiting', 'Completed', 'Canceled']),
  dueDate: z.date().optional().nullable(),
  scheduledAt: z.date().optional().nullable(),
  estimatedCost: z.coerce.number().optional().nullable(),
  actualCost: z.coerce.number().optional().nullable(),
  visibility: z.enum(['landlord_only', 'shared_with_tenant', 'shared_with_vendor']),
  attachments: z.array(z.any()).optional(), // For file input
});

type WorkOrderFormValues = z.infer<typeof WorkOrderSchema>;

export function WorkOrderForm({ initialData }: { initialData?: any }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<WorkOrderFormValues>({
    resolver: zodResolver(WorkOrderSchema),
    defaultValues: {
      ...initialData,
      dueDate: initialData?.dueDate ? initialData.dueDate.toDate() : null,
      scheduledAt: initialData?.scheduledAt ? initialData.scheduledAt.toDate() : null,
    } || {
      priority: 'Normal',
      status: 'New',
      visibility: 'landlord_only',
    },
  });

  const { data: properties, isLoading: isLoadingProperties } = useCollection(
    useMemoFirebase(() => user ? query(collection(firestore, 'properties'), where('userId', '==', user.uid)) : null, [user, firestore])
  );
  
  const { data: vendors, isLoading: isLoadingVendors } = useCollection(
    useMemoFirebase(() => user ? query(collection(firestore, 'vendors'), where('userId', '==', user.uid)) : null, [user, firestore])
  );

  const selectedPropertyId = form.watch('propertyId');
  const [units, setUnits] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    const fetchUnitsAndTenants = async () => {
        if (!selectedPropertyId || !firestore) {
            setUnits([]);
            setTenants([]);
            return;
        }

        const unitsQuery = query(collection(firestore, `properties/${selectedPropertyId}/units`));
        const unitsSnap = await getDocs(unitsQuery);
        const fetchedUnits = unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUnits(fetchedUnits);

        const propDoc = properties?.find((p:any) => p.id === selectedPropertyId);
        const activeTenants = (propDoc?.tenants || []).filter((t:any) => t.status === 'active');
        setTenants(activeTenants);
    };

    fetchUnitsAndTenants();
}, [selectedPropertyId, firestore, properties]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFilesToUpload(Array.from(e.target.files));
    }
  };

  const onSubmit = async (data: WorkOrderFormValues) => {
    if (!user) return;
    setIsUploading(true);

    try {
        const attachmentUrls = [];
        if (filesToUpload.length > 0) {
            toast({ title: "Uploading attachments...", description: `Uploading ${filesToUpload.length} file(s).` });
            const storage = getStorage();
            // A temporary ID is needed if we're creating a new work order
            const workOrderId = initialData?.id || doc(collection(firestore, '_')).id;

            for (const file of filesToUpload) {
                const storagePath = `users/${user.uid}/opsWorkOrders/${workOrderId}/${file.name}`;
                const storageRef = ref(storage, storagePath);
                const uploadTask = await uploadBytesResumable(storageRef, file);
                const downloadURL = await getDownloadURL(uploadTask.ref);
                attachmentUrls.push({ name: file.name, url: downloadURL, storagePath });
            }
        }

      const result = await saveWorkOrder({
        id: initialData?.id,
        userId: user.uid,
        ...data,
        attachments: attachmentUrls,
      });

      toast({
        title: 'Work Order Saved',
        description: `The work order "${data.title}" has been successfully saved.`,
      });
      
      router.push(`/dashboard/operations/work-orders/${result.id}`);
      router.refresh();

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message,
      });
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Details</CardTitle>
            <CardDescription>Describe the work that needs to be done.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <Label>Title</Label>
                  <FormControl>
                    <Input placeholder="e.g., Leaky faucet in kitchen" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <Label>Description</Label>
                  <FormControl>
                    <Textarea placeholder="Provide more details about the issue..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <Label>Category</Label>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a category..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Plumbing">Plumbing</SelectItem>
                      <SelectItem value="HVAC">HVAC</SelectItem>
                      <SelectItem value="Electrical">Electrical</SelectItem>
                      <SelectItem value="Appliance">Appliance</SelectItem>
                      <SelectItem value="Turnover">Turnover</SelectItem>
                      <SelectItem value="Cleaning">Cleaning</SelectItem>
                      <SelectItem value="Landscaping">Landscaping</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduling & Assignment</CardTitle>
            <CardDescription>Set priority, dates, and assign responsible parties.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem><Label>Priority</Label>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><Label>Status</Label>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Waiting">Waiting</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                    <FormItem className="flex flex-col"><Label>Scheduled Date</Label><Popover><PopoverTrigger asChild>
                        <FormControl><Button variant="outline" className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button></FormControl>
                    </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><Label>Due Date</Label><Popover><PopoverTrigger asChild>
                        <FormControl><Button variant="outline" className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button></FormControl>
                    </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>
                )} />
            </div>
             <FormField control={form.control} name="propertyId" render={({ field }) => (
                <FormItem><Label>Property *</Label>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a property..." /></SelectTrigger></FormControl>
                        <SelectContent>{properties?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
             )} />
             <div className="grid grid-cols-2 gap-4">
                 <FormField control={form.control} name="unitId" render={({ field }) => (
                    <FormItem><Label>Unit (Optional)</Label>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedPropertyId || units.length === 0}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a unit..." /></SelectTrigger></FormControl>
                            <SelectContent>{units?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>)}</SelectContent>
                        </Select><FormMessage /></FormItem>
                 )} />
                  <FormField control={form.control} name="tenantId" render={({ field }) => (
                    <FormItem><Label>Tenant (Optional)</Label>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedPropertyId || tenants.length === 0}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a tenant..." /></SelectTrigger></FormControl>
                            <SelectContent>{tenants?.map((t: any) => <SelectItem key={t.email} value={t.email}>{t.firstName} {t.lastName}</SelectItem>)}</SelectContent>
                        </Select><FormMessage /></FormItem>
                 )} />
             </div>
            <FormField control={form.control} name="vendorId" render={({ field }) => (
                <FormItem><Label>Assigned Vendor</Label>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Assign a vendor..." /></SelectTrigger></FormControl>
                        <SelectContent>{vendors?.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name} ({v.role})</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
            <CardContent>
                <Label htmlFor="attachments">Upload Photos or Documents</Label>
                <Input id="attachments" type="file" multiple onChange={handleFileChange} />
                {filesToUpload.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {filesToUpload.map((file, index) => (
                            <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted rounded-md">
                                <span>{file.name}</span>
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFilesToUpload(files => files.filter((_, i) => i !== index))}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cost & Visibility</CardTitle></CardHeader>
          <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="estimatedCost" render={({ field }) => (
                    <FormItem><Label>Estimated Cost ($)</Label><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="actualCost" render={({ field }) => (
                    <FormItem><Label>Actual Cost ($)</Label><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="visibility" render={({ field }) => (
                <FormItem><Label>Visibility</Label>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="landlord_only">Landlord Only</SelectItem>
                      <SelectItem value="shared_with_tenant">Shared with Tenant</SelectItem>
                      <SelectItem value="shared_with_vendor">Shared with Vendor</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting || isUploading}>
            {form.formState.isSubmitting || isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {initialData ? 'Save Changes' : 'Create Work Order'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
