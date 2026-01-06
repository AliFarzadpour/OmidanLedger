
'use client';

import {
  useUser,
  useAuth,
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CreditCard, LogOut, Settings, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function UserNav({ isMobile }: { isMobile: boolean }) {
  const auth = useAuth();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  // Fetch the user's full profile to get logo and billing info
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData } = useDoc<{
    businessProfile?: { logoUrl?: string };
    billing?: { subscriptionTier?: string };
  }>(userDocRef);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  const getInitials = (email: string | null | undefined) => {
    if (!email) return '..';
    const parts = email.split('@')[0];
    if (parts.includes('.')) {
      return parts
        .split('.')
        .map((p) => p[0])
        .join('')
        .toUpperCase();
    }
    return parts.substring(0, 2).toUpperCase();
  };

  // Render a skeleton while not on the client or user is loading
  if (!isClient || !user) {
    return (
      <div className="flex items-center gap-4 p-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        {!isMobile && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        )}
      </div>
    );
  }

  const logoUrl = userData?.businessProfile?.logoUrl;
  const subscriptionTier = userData?.billing?.subscriptionTier || 'Free';

  const trigger = (
    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
      <Avatar className="h-10 w-10 border-2 border-primary/50">
        {logoUrl && (
          <AvatarImage src={logoUrl} alt="User avatar" />
        )}
        <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
      </Avatar>
    </Button>
  );

  const content = (
    <DropdownMenuContent className="w-56" align="end" forceMount>
      <DropdownMenuLabel className="font-normal">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none">
            {user?.displayName || user?.email?.split('@')[0]}
          </p>
          <p className="text-xs leading-none text-muted-foreground">
            {user?.email}
          </p>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/billing">
            <CreditCard className="mr-2 h-4 w-4" />
            <div className="flex justify-between items-center w-full">
                <span>Billing</span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md capitalize">{subscriptionTier}</span>
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        <span>Log out</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        {content}
      </DropdownMenu>
    );
  }

  return (
    <div className={cn('hidden md:block')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-4 p-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer">
            <Avatar className="h-10 w-10 border-2 border-primary/50">
              {logoUrl && (
                <AvatarImage src={logoUrl} alt="User avatar" />
              )}
              <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden transition-opacity duration-300">
              <p className="text-sm font-medium leading-none text-foreground">
                {user?.displayName || user?.email?.split('@')[0]}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>
        </DropdownMenuTrigger>
        {content}
      </DropdownMenu>
    </div>
  );
}
