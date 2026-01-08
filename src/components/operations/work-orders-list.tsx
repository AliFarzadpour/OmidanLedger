
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Search, Filter, Wrench } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

// Helper to get color class based on status or priority
const getBadgeClass = (type: 'status' | 'priority', value: string) => {
  const lowerValue = value.toLowerCase();
  if (type === 'status') {
    switch (lowerValue) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'in progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'canceled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  }
  if (type === 'priority') {
    switch (lowerValue) {
      case 'emergency': return 'bg-red-500 text-white';
      case 'high': return 'bg-red-200 text-red-900';
      case 'normal': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  }
  return '';
};

export function WorkOrdersList() {
  const { user } = useUser();
  const firestore = useFirestore();

  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Fetch all user's properties for the filter dropdown
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection(propertiesQuery);

  // Fetch all user's work orders
  const workOrdersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, `users/${user.uid}/opsWorkOrders`), orderBy('createdAt', 'desc'));
  }, [user, firestore]);
  const { data: workOrders, isLoading: isLoadingWorkOrders } = useCollection(workOrdersQuery);

  // Memoized filtering logic
  const filteredWorkOrders = useMemo(() => {
    if (!workOrders) return [];
    return workOrders.filter(wo => {
      const searchMatch = searchTerm === '' ||
        wo.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const propertyMatch = propertyFilter === 'all' || wo.propertyId === propertyFilter;
      const statusMatch = statusFilter === 'all' || wo.status?.toLowerCase() === statusFilter;
      const priorityMatch = priorityFilter === 'all' || wo.priority?.toLowerCase() === priorityFilter;
      
      return searchMatch && propertyMatch && statusMatch && priorityMatch;
    });
  }, [workOrders, searchTerm, propertyFilter, statusFilter, priorityFilter]);

  const isLoading = isLoadingProperties || isLoadingWorkOrders;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
              <CardTitle>All Work Orders</CardTitle>
              <CardDescription>A list of all maintenance jobs across your properties.</CardDescription>
            </div>
            <Button asChild>
                <Link href="/dashboard/operations/work-orders/new">
                    <Plus className="mr-2 h-4 w-4" /> New Work Order
                </Link>
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4 p-4 bg-slate-50 border rounded-lg">
            <div className="relative flex-grow">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search by title..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by property..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by status..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
            </Select>
             <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by priority..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
            </Select>
        </div>
        
        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Est. Cost</TableHead>
              <TableHead className="text-right">Actual Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center h-32"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filteredWorkOrders.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={8} className="text-center h-32">
                        <Wrench className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        No work orders found.
                    </TableCell>
                </TableRow>
            ) : (
                filteredWorkOrders.map((wo) => (
                    <TableRow key={wo.id}>
                        <TableCell><Badge variant="outline" className={cn('capitalize', getBadgeClass('status', wo.status || ''))}>{wo.status || 'N/A'}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={cn('capitalize', getBadgeClass('priority', wo.priority || ''))}>{wo.priority || 'N/A'}</Badge></TableCell>
                        <TableCell>
                            <Link href={`/dashboard/operations/work-orders/${wo.id}`} className="font-medium hover:underline text-primary">
                                {wo.title}
                            </Link>
                        </TableCell>
                        <TableCell>{properties?.find(p => p.id === wo.propertyId)?.name || 'N/A'}</TableCell>
                        <TableCell>{wo.scheduledAt ? format(wo.scheduledAt.toDate(), 'PPP') : 'N/A'}</TableCell>
                        <TableCell>{wo.dueDate ? format(wo.dueDate.toDate(), 'PPP') : 'N/A'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(wo.estimatedCost || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(wo.actualCost || 0)}</TableCell>
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

    