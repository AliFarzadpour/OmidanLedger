// This file is intentionally left blank for now.
// The recurring task list page will be implemented in a future step.
// For now, this route exists to satisfy the navigation links.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function RecurringTasksPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Recurring Tasks</h1>
          <p className="text-muted-foreground">Automate your property management checklist.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/operations/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            New Recurring Task
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">The recurring tasks list will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
