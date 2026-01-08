// This file is intentionally left blank for now.
// The new recurring task form page will be implemented in a future step.
// For now, this route exists to satisfy the navigation links.
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewRecurringTaskPage() {
  return (
    <div className="p-8 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard/operations/tasks">
                    <ArrowLeft />
                </Link>
            </Button>
            <h1 className="text-3xl font-bold">New Recurring Task</h1>
        </div>
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">The form to create a new recurring task will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
