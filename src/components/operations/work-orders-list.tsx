
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
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
import { Loader2, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, formatDistanceToNowStrict } from 'date-fns';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');

  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(view === 'inbox' ? 'active' : 'all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [workOrdersWithOpenTasks, setWorkOrdersWithOpenTasks] = useState<Set<string>>(new Set());

  // Fetch all user's properties for the filter dropdown
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection(propertiesQuery);

  // Fetch all user's work orders
  const workOrdersQuery = useMemoFirebase(() => {
    if (!user) return null;
    const baseQuery = query(collection(firestore, `users/${user.uid}/opsWorkOrders`));
    if (view === 'inbox') {
        return query(baseQuery, orderBy('lastMessageAt', 'desc'));
    }
    return query(baseQuery, orderBy('updatedAt', 'desc'));
  }, [user, firestore, view]);
  const { data: workOrders, isLoading: isLoadingWorkOrders } = useCollection(workOrdersQuery);
  
  // Fetch work orders with open tasks if the view is 'tasks'
  useEffect(() => {
    if (view === 'tasks' && user && firestore) {
      const fetchTasks = async () => {
        const tasksQuery = query(collection(firestore, `users/${user.uid}/opsTasks`), where('status', '!=', 'done'));
        const tasksSnap = await getDocs(tasksQuery);
        const woIds = new Set(tasksSnap.docs.map(doc => doc.data().workOrderId).filter(Boolean));
        setWorkOrdersWithOpenTasks(woIds);
      };
      fetchTasks();
    }
  }, [view, user, firestore]);


  // Memoized filtering logic
  const filteredWorkOrders = useMemo(() => {
    if (!workOrders) return [];
    return workOrders.filter(wo => {
      const searchMatch = searchTerm === '' ||
        wo.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const propertyMatch = propertyFilter === 'all' || wo.propertyId === propertyFilter;

      const baseStatusMatch = statusFilter === 'all' || 
          (statusFilter === 'active' && !['Completed', 'Canceled'].includes(wo.status)) ||
          wo.status?.toLowerCase() === statusFilter;

      const priorityMatch = priorityFilter === 'all' || wo.priority?.toLowerCase() === priorityFilter;
      
      // View-specific filtering
      let viewMatch = true;
      if (view === 'tasks') {
          viewMatch = workOrdersWithOpenTasks.has(wo.id);
      }
      if (view === 'inbox') {
          viewMatch = !!wo.lastMessageAt;
      }
      
      return searchMatch && propertyMatch && baseStatusMatch && priorityMatch && viewMatch;
    });
  }, [workOrders, searchTerm, propertyFilter, statusFilter, priorityFilter, view, workOrdersWithOpenTasks]);

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
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter by property..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Properties</SelectItem>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter by status..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">All Active</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Canceled">Canceled</SelectItem>
                </SelectContent>
            </Select>
             <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter by priority..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Emergency">Emergency</SelectItem>
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
              <TableHead>Due Date</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="text-right">Costs (Est./Actual)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-32"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filteredWorkOrders.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                        No work orders match the current filters.
                    </TableCell>
                </TableRow>
            ) : (
                filteredWorkOrders.map((wo) => (
                    <TableRow key={wo.id} onClick={() => router.push(`/dashboard/operations/work-orders/${wo.id}`)} className="cursor-pointer">
                        <TableCell><Badge variant="outline" className={cn('capitalize', getBadgeClass('status', wo.status || ''))}>{wo.status || 'N/A'}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={cn('capitalize', getBadgeClass('priority', wo.priority || ''))}>{wo.priority || 'N/A'}</Badge></TableCell>
                        <TableCell className="font-medium">{wo.title}</TableCell>
                        <TableCell>{properties?.find(p => p.id === wo.propertyId)?.name || 'N/A'}</TableCell>
                        <TableCell>{wo.dueDate ? format(wo.dueDate.toDate(), 'PPP') : 'N/A'}</TableCell>
                        <TableCell>{wo.updatedAt ? formatDistanceToNowStrict(wo.updatedAt.toDate(), {addSuffix: true}) : 'N/A'}</TableCell>
                        <TableCell className="text-right font-mono">
                            {formatCurrency(wo.estimatedCost || 0)} / {formatCurrency(wo.actualCost || 0)}
                        </TableCell>
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
