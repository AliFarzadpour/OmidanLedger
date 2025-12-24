
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Banknote, CreditCard, Wallet, Pencil, Trash2, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit-card' | 'credit' | 'cash' | 'other';
  accountNumber?: string;
  plaidAccessToken?: string;
  historicalDataPending?: boolean;
}

interface DataSourceListProps {
  dataSources: DataSource[];
  isLoading: boolean;
  onEdit: (dataSource: DataSource) => void;
  onSelect: (dataSource: DataSource) => void;
  onDelete: (dataSource: DataSource) => void;
  selectedDataSourceId?: string | null;
  flagCounts: Record<string, { needsReview: number; incorrect: number }>;
}

const typeIcons = {
  checking: <Banknote className="h-5 w-5 text-primary" />,
  savings: <Banknote className="h-5 w-5 text-green-500" />,
  'credit-card': <CreditCard className="h-5 w-5 text-blue-500" />,
  credit: <CreditCard className="h-5 w-5 text-blue-500" />,
  cash: <Wallet className="h-5 w-5 text-yellow-500" />,
  other: <Wallet className="h-5 w-5 text-gray-500" />,
};

export function DataSourceList({ 
    dataSources, 
    isLoading, 
    onEdit, 
    onSelect, 
    onDelete, 
    selectedDataSourceId,
    flagCounts
}: DataSourceListProps) {

  const handleDeleteClick = (e: React.MouseEvent, source: DataSource) => {
    e.stopPropagation();
    onDelete(source);
  };

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {dataSources.map((source) => {
        const counts = flagCounts[source.id] || { needsReview: 0, incorrect: 0 };
        return (
            <div key={source.id} className="relative group">
            <Card 
                className={cn(
                    "flex flex-col shadow-sm hover:shadow-md transition-all h-full cursor-pointer",
                    selectedDataSourceId === source.id && "ring-2 ring-primary"
                )}
                onClick={() => onSelect(source)}
            >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3">
                <CardTitle className="text-base font-semibold">{source.accountName}</CardTitle>
                {typeIcons[source.accountType as keyof typeof typeIcons] || typeIcons.other}
                </CardHeader>
                <CardContent className="flex-grow p-3 pt-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">{source.bankName}</p>
                    <Badge variant="outline" className="text-xs capitalize">{source.accountType.replace('-', ' ')}</Badge>
                  </div>
                  {source.accountNumber && (
                      <p className="text-xs text-muted-foreground">
                      •••• {source.accountNumber.slice(-4)}
                      </p>
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
  );
}
