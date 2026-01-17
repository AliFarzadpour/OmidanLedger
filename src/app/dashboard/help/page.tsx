'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

function HelpCenterDisabled() {
    return (
        <Card className="border-amber-300 bg-amber-50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-5 w-5" />
                    Help Center Disabled
                </CardTitle>
                <CardDescription className="text-amber-700">
                    The AI-powered help center is not enabled in the current environment configuration.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-amber-900">
                    To enable this feature, please set the `NEXT_PUBLIC_ENABLE_HELP_RAG` environment variable to `true`.
                </p>
            </CardContent>
        </Card>
    );
}

export default function HelpCenterPage() {
  const router = useRouter();
  const isHelpEnabled = process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true';

  return (
      <div className="p-8 max-w-2xl mx-auto">
           <div className="flex items-center gap-4 mb-8">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                  <h1 className="text-3xl font-bold tracking-tight">Help Center</h1>
                  <p className="text-muted-foreground">Guides, tutorials, and frequently asked questions.</p>
              </div>
          </div>
          
          {isHelpEnabled ? (
            // Future home of the RAG search component
            <Card>
                <CardHeader>
                    <CardTitle>AI Help Search</CardTitle>
                    <CardDescription>Search our knowledge base.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">AI search component will be implemented here.</p>
                </CardContent>
            </Card>
          ) : (
             <HelpCenterDisabled />
          )}
      </div>
  );
}
