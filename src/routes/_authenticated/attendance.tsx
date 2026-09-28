import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogIn, LogOut, Timer, CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hr, prettyDate, titleCase } from "@/lib/hr";
import { useMe } from "@/hooks/useMe";
import { PageHeader } from "@/components/hr/Shell";
import { StatCard, StatusBadge, EmptyState } from "@/components/hr/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const today = () => new Date().toISOString().slice(0, 10);

function clockLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hoursBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  return Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 3600000) * 10) / 10;
}

function AttendancePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const attendance = useQuery({ queryKey: ["attendance"], queryFn: hr.attendance });

  const rows = attendance.data ?? [];
  const mine = rows.filter((r) => r.employee_id === me?.employee?.id);
  const todayRow = mine.find((r) => r.work_date === today());

  const clock = useMutation({
    mutationFn: async (kind: "in" | "out") => {
      if (!me?.employee?.id) throw new Error("No employee profile found for your account.");
      const now = new Date().toISOString();
      if (kind === "in") {
        const { error } = await supabase.from("attendance").insert({
          employee_id: me.employee.id,
          work_date: today(),
          clock_in: now,
          status: "present",
        } as never);
        if (error) throw new Error(error.message);
      } else {
        if (!todayRow) throw new Error("Clock in first.");
        const { error } = await supabase
          .from("attendance")
          .update({ clock_out: now } as never)
          .eq("id", todayRow.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Attendance updated");
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const monthDays = mine.filter((r) => r.work_date?.slice(0, 7) === today().slice(0, 7)).length;
  const loggedHours = mine.reduce(
    (sum, r) => sum + (hoursBetween(r.clock_in, r.clock_out) ?? 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Clock in and out, and review daily attendance records."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p className="text-muted-foreground">{prettyDate(today())}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {clockLabel(todayRow?.clock_in ?? null)}
                {todayRow?.clock_out ? ` – ${clockLabel(todayRow.clock_out)}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {todayRow ? (todayRow.clock_out ? "Day complete" : "Currently clocked in") : "Not clocked in"}
              </p>
            </div>
            {me?.employee?.id && (
  <div className="flex gap-2">
    <Button
      className="flex-1"
      disabled={Boolean(todayRow) || clock.isPending}
      onClick={() => clock.mutate("in")}
    >
      <LogIn className="size-4" /> Clock in
    </Button>

    <Button
      className="flex-1"
      variant="outline"
      disabled={!todayRow || Boolean(todayRow?.clock_out) || clock.isPending}
      onClick={() => clock.mutate("out")}
    >
      <LogOut className="size-4" /> Clock out
    </Button>
  </div>
)}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:content-start">
          <StatCard label="Days logged this month" value={monthDays} icon={<CalendarCheck className="size-5" />} />
          <StatCard label="Hours logged" value={loggedHours} hint="All time" icon={<Timer className="size-5" />} />
        </div>
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No attendance records" hint="Clock in to create your first record." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employee?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{prettyDate(r.work_date)}</TableCell>
                    <TableCell>{clockLabel(r.clock_in)}</TableCell>
                    <TableCell>{clockLabel(r.clock_out)}</TableCell>
                    <TableCell>{hoursBetween(r.clock_in, r.clock_out) ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={titleCase(r.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
