
'use server';

import { db } from '@/lib/admin-db';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Timestamp } from 'firebase-admin/firestore';
import { UserBillingForm } from '@/components/admin/user-billing-form';

export default async function UserManagementPage() {
  const usersSnap = await db.collection('users')
    .where('role', '==', 'landlord')
    .get();

  const landlords = usersSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Safely convert timestamp for client component
      metadata: {
        ...data.metadata,
        createdAt: data.metadata?.createdAt?.toDate()?.toISOString() || null,
      }
    };
  });

  landlords.sort((a, b) => {
    const timeA = a.metadata?.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
    const timeB = b.metadata?.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h2 className="text-2xl font-bold">Landlord Management</h2>
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Properties</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {landlords.map((user: any) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {user.billing?.subscriptionTier || 'Free'}
                  </Badge>
                </TableCell>
                <TableCell>{user.metadata?.propertyCount || 0}</TableCell>
                <TableCell>
                   {user.metadata?.createdAt ? new Date(user.metadata.createdAt).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge className={user.billing?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}>
                    {user.billing?.status || 'Trial'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <UserBillingForm user={user} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
