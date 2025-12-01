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
import { CreditCard, LogOut, Settings, User } from 'lucide-react';

export function UserNav({ isMobile }: { isMobile: boolean }) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar');

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
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    </Button>
  );

  const content = (
    <DropdownMenuContent className="w-56" align="end" forceMount>
      <DropdownMenuLabel className="font-normal">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none">John Doe</p>
          <p className="text-xs leading-none text-muted-foreground">
            john.doe@example.com
          </p>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Billing</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
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
      <div className="flex items-center gap-4 p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
        <Avatar className="h-10 w-10 border-2 border-primary/50">
          {userAvatar && (
            <AvatarImage
              src={userAvatar.imageUrl}
              alt="User avatar"
              data-ai-hint={userAvatar.imageHint}
            />
          )}
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <div className="flex flex-col group-data-[collapsible=icon]:hidden transition-opacity duration-300">
          <p className="text-sm font-medium leading-none text-foreground">John Doe</p>
          <p className="text-xs leading-none text-muted-foreground">
            john.doe@example.com
          </p>
        </div>
      </div>
    </div>
  );
}
