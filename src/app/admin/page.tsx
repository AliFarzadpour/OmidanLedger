
import { db } from '@/lib/admin-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, CreditCard, Activity } from 'lucide-react';

export default async function SuperAdminDashboard() {
  // Fetch Global Stats
  const globalStats = (await db.doc('system/global_stats').get()).data() || {};

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="text-3xl font-bold">System Overview</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Landlords</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalStats.totalLandlords || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalStats.totalProperties || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tx Volume (MTD)</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(globalStats.totalTransactionVolume || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Stable</div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for User Management Table */}
      <div className="rounded-md border p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-4">User Management & Billing Status</h2>
        <p className="text-sm text-muted-foreground">List of Landlords and their calculated monthly fees would go here.</p>
      </div>
    </div>
  );
}
