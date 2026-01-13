
'use client';

import { useState } from 'react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Rocket, Loader2 } from 'lucide-react';
import { publishUserRulesToGlobal } from '@/ai/flows/publish-user-rules';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';

// Admin User ID Check
const ADMIN_USER_ID = 'ZzqaKaPSOGgg6eALbbs5NY9DRVZ2'; 

export function AdminPublishButton() {
  const { user } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handlePublish = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const result = await publishUserRulesToGlobal({ userId: user.uid });
      if (result.success) {
        toast({
          title: "Rules Published! 🚀",
          description: `${result.count} rules have been successfully published to the global database.`,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Publishing Failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render nothing if the current user is not the admin
  if (user?.uid !== ADMIN_USER_ID) {
    return null;
  }

  return (
    <>
      <Separator />
      <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900">Admin Controls</h3>
          <p className="text-sm text-red-700 mt-1">This action is irreversible and will affect all users.</p>
          <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-4">
                  <Rocket className="mr-2 h-4 w-4" />
                  Publish My Rules to Global
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                          This will copy all of your personal categorization rules to the global database,
                          potentially overwriting existing global rules. This action cannot be undone.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                          onClick={handlePublish}
                          disabled={isLoading}
                          className="bg-red-600 hover:bg-red-700"
                      >
                          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Yes, Publish Rules
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
      </div>
    </>
  );
}
