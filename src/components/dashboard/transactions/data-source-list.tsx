'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Banknote, CreditCard, Wallet, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DataSource {
  id: string;
  accountName: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit-card' | 'cash' | 'other';
  accountNumber?: string;
  plaidAccessToken?: string;
}

interface DataSourceListProps {
  dataSources: DataSource[];
  isLoading: boolean;
  onEdit: (dataSource: DataSource) => void;
  onSelect: (dataSource: DataSource) => void;
  selectedDataSourceId?: string | null;
}

const typeIcons = {
  checking: <Banknote className="h-6 w-6 text-primary" />,
  savings: <Banknote className="h-6 w-6 text-green-500" />,
  'credit-card': <CreditCard className="h-6 w-6 text-blue-500" />,
  credit: <CreditCard className="h-6 w-6 text-blue-500" />,
  cash: <Wallet className="h-6 w-6 text-yellow-500" />,
  other: <Wallet className="h-6 w-6 text-gray-500" />,
};

export function DataSourceList({ dataSources, isLoading, onEdit, onSelect, selectedDataSourceId }: DataSourceListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-8 w-20" />
            </CardFooter>
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {dataSources.map((source) => (
        <div key={source.id} className="relative group">
          <Card 
            className={cn(
                "flex flex-col shadow-md hover:shadow-lg transition-all h-full cursor-pointer",
                selectedDataSourceId === source.id && "ring-2 ring-primary"
            )}
            onClick={() => onSelect(source)}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">{source.accountName}</CardTitle>
              <div className="flex items-center gap-2">
                {source.plaidAccessToken && <Badge variant="secondary">Plaid</Badge>}
                {typeIcons[source.accountType as keyof typeof typeIcons] || typeIcons.other}
              </div>
            </CardHeader>
            <CardContent className="flex-grow pt-2">
              <p className="text-sm text-muted-foreground">{source.bankName}</p>
              {source.accountNumber && (
                <p className="text-sm text-muted-foreground">
                  •••• {source.accountNumber.slice(-4)}
                </p>
              )}
            </CardContent>
            <CardFooter>
              {/* Footer can be used for other actions in the future */}
            </CardFooter>
          </Card>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(source);
            }}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
