'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, CreditCard, Activity, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { refreshGlobalSystemStats } from "@/actions/admin-actions";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export function AdminDashboard({ initialStats }: { initialStats: any }) {
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await refreshGlobalSystemStats();
      toast({ title: "System Stats Updated" });
      if (result.success && result.stats) {
        // The server action now returns the latest stats, so we can update the UI without a full reload.
        const newStats = JSON.parse(JSON.stringify(result.stats, (key, value) => {
            if (value && typeof value === 'object' && value.hasOwnProperty('seconds')) {
              return new Date(value.seconds * 1000).toISOString();
            }
            return value;
        }));
        setStats(newStats);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">System Overview</h1>
        <Button onClick={handleSync} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Sync Global Data
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Landlords</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLandlords || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProperties || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tx Volume (MTD)</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.totalTransactionVolume || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.systemStatus || 'Stable'}</div>
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
