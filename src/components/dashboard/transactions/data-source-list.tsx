'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Banknote, CreditCard, Wallet, Pencil, Trash2, Flag, Loader2, RefreshCw, Landmark, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { formatDistanceToNow } from 'date-fns';

interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit-card' | 'credit' | 'cash' | 'other';
  accountNumber?: string;
  plaidAccessToken?: string;
  plaidAccountId?: string;
  historicalDataPending?: boolean;
}

interface BalanceData {
    currentBalance: number | null;
    availableBalance: number | null;
    limit: number | null;
    currency: string;
    lastUpdatedAt: { seconds: number, nanoseconds: number } | Date;
}

interface DataSourceListProps {
  dataSources: DataSource[];
  balances: Record<string, BalanceData>;
  isLoading: boolean;
  onEdit: (dataSource: DataSource) => void;
  onSelect: (dataSource: DataSource) => void;
  onDelete: (dataSource: DataSource) => void;
  onSync: (dataSourceId: string) => void; 
  onRefreshBalances: () => void;
  selectedDataSourceId?: string | null;
  flagCounts: Record<string, { needsReview: number; incorrect: number }>;
  syncingIds: Set<string>; 
}

const typeConfig = {
  checking: { icon: Landmark, color: 'border-t-green-500' },
  savings: { icon: PiggyBank, color: 'border-t-blue-500' },
  'credit-card': { icon: CreditCard, color: 'border-t-purple-500' },
  credit: { icon: CreditCard, color: 'border-t-purple-500' },
  cash: { icon: Wallet, color: 'border-t-yellow-500' },
  other: { icon: Wallet, color: 'border-t-gray-400' },
};

export function DataSourceList({ 
    dataSources, 
    balances,
    isLoading, 
    onEdit, 
    onSelect, 
    onDelete, 
    onSync,
    onRefreshBalances,
    selectedDataSourceId,
    flagCounts,
    syncingIds
}: DataSourceListProps) {

  const handleDeleteClick = (e: React.MouseEvent, source: DataSource) => {
    e.stopPropagation();
    onDelete(source);
  };
  
  const handleSyncClick = (e: React.MouseEvent, source: DataSource) => {
      e.stopPropagation();
      onSync(source.id);
  }

  const getBalanceDisplay = (source: DataSource) => {
      const balance = balances[source.plaidAccountId!];
      if (!balance) return null;

      const lastUpdatedDate = balance.lastUpdatedAt ? (balance.lastUpdatedAt instanceof Date ? balance.lastUpdatedAt : new Date((balance.lastUpdatedAt as any).seconds * 1000)) : null;

      if (source.accountType === 'credit' || source.accountType === 'credit-card') {
          return {
              label: 'Balance Owed',
              value: balance.currentBalance,
              sublabel: 'Available Credit',
              subvalue: balance.availableBalance,
              color: 'text-red-600',
              subcolor: 'text-green-600',
              lastUpdatedAt: lastUpdatedDate,
          };
      }
      return {
          label: 'Bank Balance',
          value: balance.currentBalance,
          sublabel: 'Available',
          subvalue: balance.availableBalance,
          color: 'text-slate-800',
          subcolor: 'text-slate-500',
          lastUpdatedAt: lastUpdatedDate,
      };
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (dataSources.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">No data sources found. Add one to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <div className="flex justify-end mb-2 -mt-4">
        <Button variant="ghost" size="sm" onClick={onRefreshBalances} className="text-xs text-muted-foreground gap-2">
            <RefreshCw className="h-3 w-3" /> Refresh Bank Balances
        </Button>
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {dataSources.map((source) => {
        const counts = flagCounts[source.id] || { needsReview: 0, incorrect: 0 };
        const isSyncingThis = syncingIds.has(source.id);
        const balanceDisplay = source.plaidAccountId ? getBalanceDisplay(source) : null;
        const config = typeConfig[source.accountType as keyof typeof typeConfig] || typeConfig.other;
        const Icon = config.icon;

        return (
            <div key={source.id} className="relative group">
            <Card 
                className={cn(
                    "flex flex-col shadow-sm hover:shadow-md transition-all h-full cursor-pointer border-t-4",
                    config.color,
                    selectedDataSourceId === source.id && "ring-2 ring-primary"
                )}
                onClick={() => onSelect(source)}
            >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3">
                    <CardTitle className="text-base font-semibold">{source.accountName}</CardTitle>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="flex-grow p-3 pt-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">{source.bankName}</p>
                  </div>
                   {balanceDisplay ? (
                        <div className="mt-2 pt-2 border-t">
                            <p className="text-xs text-muted-foreground">{balanceDisplay.label}</p>
                            <p className={cn("text-lg font-bold", balanceDisplay.color)}>
                                {formatCurrency(balanceDisplay.value ?? 0)}
                            </p>
                            {balanceDisplay.sublabel && (
                                <p className="text-xs mt-1">
                                    <span className="text-muted-foreground">{balanceDisplay.sublabel}: </span>
                                    <span className={cn("font-medium", balanceDisplay.subcolor)}>
                                        {formatCurrency(balanceDisplay.subvalue ?? 0)}
                                    </span>
                                </p>
                            )}
                            {balanceDisplay.lastUpdatedAt && (
                                <p className="text-[10px] text-muted-foreground/70 mt-1">
                                    Updated {formatDistanceToNow(balanceDisplay.lastUpdatedAt, { addSuffix: true })}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="mt-2 pt-2 border-t">
                             <p className="text-xs text-muted-foreground italic mt-2">Manual account</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="p-3 pt-2 flex items-center justify-between">
                    <div>
                         {source.historicalDataPending ? (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                                <span className="animate-pulse mr-1">⏳</span> Syncing...
                            </Badge>
                        ) : source.plaidAccessToken && (
                            <Badge variant="secondary" className="text-xs">Plaid</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {counts.incorrect > 0 && (
                            <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                                <Flag className="h-3 w-3" /> {counts.incorrect}
                            </Badge>
                        )}
                         {counts.needsReview > 0 && (
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1 text-xs">
                                <Flag className="h-3 w-3" /> {counts.needsReview}
                            </Badge>
                        )}
                    </div>
                </CardFooter>
            </Card>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {source.plaidAccessToken && (
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => handleSyncClick(e, source)}
                        disabled={isSyncingThis}
                    >
                        {isSyncingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); onEdit(source); }}
                >
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => handleDeleteClick(e, source)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            </div>
        )
      })}
    </div>
    </>
  );
}
