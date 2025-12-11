'use client';

import { PlaceHolderImages } from '@/lib/placeholder-images';
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
import { useAuth, useUser } from '@/firebase';
import Link from 'next/link';

export function UserNav({ isMobile }: { isMobile: boolean }) {
  const auth = useAuth();
  const { user } = useUser();
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar');

  const handleLogout = () => {
    auth.signOut();
  };
  
  const getInitials = (email: string | null | undefined) => {
    if (!email) return '..';
    const parts = email.split('@')[0];
    if (parts.includes('.')) {
      return parts.split('.').map(p => p[0]).join('').toUpperCase();
    }
    return parts.substring(0, 2).toUpperCase();
  };

  const trigger = (
    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
      <Avatar className="h-10 w-10 border-2 border-primary/50">
        {userAvatar && (
          <AvatarImage
            src={userAvatar.imageUrl}
            alt="User avatar"
            data-ai-hint={userAvatar.imageHint}
          />
        )}
        <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
      </Avatar>
    </Button>
  );

  const content = (
    <DropdownMenuContent className="w-56" align="end" forceMount>
      <DropdownMenuLabel className="font-normal">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none">{user?.displayName || user?.email?.split('@')[0]}</p>
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
        <DropdownMenuItem>
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Billing</span>
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
    <div className={cn("hidden md:block")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
           <div className="flex items-center gap-4 p-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer">
              <Avatar className="h-10 w-10 border-2 border-primary/50">
                {userAvatar && (
                  <AvatarImage
                    src={userAvatar.imageUrl}
                    alt="User avatar"
                    data-ai-hint={userAvatar.imageHint}
                  />
                )}
                <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden transition-opacity duration-300">
                <p className="text-sm font-medium leading-none text-foreground">{user?.displayName || user?.email?.split('@')[0]}</p>
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
