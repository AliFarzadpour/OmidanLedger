
import { getAdminDB } from '@/lib/admin-db';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function UserManagementPage() {
  const db = getAdminDB();
  const usersSnap = await db.collection('users')
    .where('role', '==', 'landlord')
    .orderBy('metadata.createdAt', 'desc')
    .get();

  const landlords = usersSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return (
    <div className="space-y-6">
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
                   {user.metadata?.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge className={user.billing?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}>
                    {user.billing?.status || 'Trial'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
