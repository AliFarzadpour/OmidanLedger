import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { UserNav } from "@/components/dashboard/user-nav"
import { HelpAssistant } from "@/components/help/help-assistant"
import BugReporter from "@/components/BugReporter"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-white transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1 font-medium text-sm text-slate-500">
             {/* Dynamic Breadcrumbs could go here later */}
             Dashboard
          </div>
          <UserNav isMobile={false} />
        </header>
        <div className="flex-1 overflow-auto bg-slate-50/30">
          {children}
        </div>
      </SidebarInset>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-3">
        <HelpAssistant />
        <BugReporter />
      </div>
    </SidebarProvider>
  )
}
