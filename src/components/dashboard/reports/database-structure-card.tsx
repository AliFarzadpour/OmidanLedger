'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Database } from 'lucide-react';

export function DatabaseStructureCard() {
  return (
    <Card className="flex flex-col justify-between h-full shadow-md col-span-1 md:col-span-2 lg:col-span-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Database Schema</CardTitle>
          <Database className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardDescription>A visual representation of your Firestore data model.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground font-mono">
        <ul className="space-y-2">
          <li>
            <p className="text-foreground">/users/{'{userId}'}</p>
            <ul className="pl-4 border-l border-dashed border-primary/50 ml-2">
              <li className="pt-2">
                <p className="text-foreground">/bankAccounts/{'{bankAccountId}'}</p>
                <ul className="pl-4 border-l border-dashed border-primary/50 ml-2">
                   <li className="pt-2"><p className="text-foreground">/transactions/{'{transactionId}'}</p></li>
                </ul>
              </li>
              <li className="pt-2"><p className="text-foreground">/categories/{'{categoryId}'}</p></li>
              <li className="pt-2"><p className="text-foreground">/categoryMappings/{'{mappingId}'}</p></li>
            </ul>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
