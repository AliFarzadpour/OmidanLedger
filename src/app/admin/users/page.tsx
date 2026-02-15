
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@/firebase';
import { getAllUsers, setUserRole } from '@/actions/admin-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function AdminUsersPage() {
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const userList = await getAllUsers(currentUser.uid);
      setUsers(userList);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Fetching Users',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    if (!currentUser) return;
    setIsSaving(targetUserId);
    try {
      await setUserRole(currentUser.uid, targetUserId, newRole);
      toast({
        title: 'Role Updated',
        description: 'User role has been successfully changed.',
      });
      // Update the role locally to give instant feedback
      setUsers(prevUsers =>
        prevUsers.map(u => (u.uid === targetUserId ? { ...u, role: newRole } : u))
      );
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message,
      });
    } finally {
      setIsSaving(null);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Users className="h-8 w-8 text-primary" />
        <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Assign roles and manage users across the application.</p>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Last Sign-In</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.uid}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    {user.lastSignInTime
                      ? format(new Date(user.lastSignInTime), 'PPpp')
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    {isSaving === user.uid ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => handleRoleChange(user.uid, newRole)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="tenant">Tenant</SelectItem>
                          <SelectItem value="landlord">Landlord</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
