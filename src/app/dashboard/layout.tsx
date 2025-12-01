import { Header } from '@/components/header';
import { MainNav } from '@/components/dashboard/main-nav';
import { UserNav } from '@/components/dashboard/user-nav';
import { Logo } from '@/components/logo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Logo />
        </SidebarHeader>
        <SidebarContent className="p-2">
          <div className="p-2">
            <Select defaultValue="2024">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Fiscal Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">Fiscal Year 2024</SelectItem>
                <SelectItem value="2023">Fiscal Year 2023</SelectItem>
                <SelectItem value="2022">Fiscal Year 2022</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <MainNav />
        </SidebarContent>
        <SidebarFooter className="p-4">
          <UserNav isMobile={false}/>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <Header>
          <SidebarTrigger className="md:hidden" />
          <div className="flex-1" />
          <UserNav isMobile={true}/>
        </Header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
