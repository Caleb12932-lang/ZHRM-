import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hr, LEAVE_TYPES, daysBetween, prettyDate, titleCase } from "@/lib/hr";
import { useMe } from "@/hooks/useMe";
import { PageHeader } from "@/components/hr/Shell";
import { StatCard, StatusBadge, EmptyState } from "@/components/hr/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Clock, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/leave")({
  component: LeavePage,
});

function LeavePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const leave = useQuery({ queryKey: ["leave"], queryFn: hr.leave });

  const canDecide = Boolean(me?.isHr || me?.isManager);

  const request = useMutation({
    mutationFn: async (fd: FormData) => {
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      if (!me?.employee?.id) throw new Error("No employee profile found for your account.");
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: me.employee.id,
        leave_type: get("leave_type"),
        start_date: get("start_date"),
        end_date: get("end_date"),
        reason: get("reason") || null,
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Leave request submitted");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["leave"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status, reviewed_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Request updated");
      qc.invalidateQueries({ queryKey: ["leave"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = leave.data ?? [];
  const mine = rows.filter((r) => r.employee_id === me?.employee?.id);
  const takenDays = mine
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + daysBetween(r.start_date, r.end_date), 0);

  return (
    <div>
      <PageHeader
        title="Leave & time off"
        description="Book time off, track balances and approve your team's requests."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Request leave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request time off</DialogTitle>
              </DialogHeader>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  request.mutate(new FormData(e.currentTarget));
                }}
              >
                <div className="space-y-2 sm:col-span-2">
                  <Label>Leave type</Label>
                  <Select name="leave_type" defaultValue="annual">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAVE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {titleCase(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">From</Label>
                  <Input id="start_date" name="start_date" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">To</Label>
                  <Input id="end_date" name="end_date" type="date" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea id="reason" name="reason" rows={3} />
                </div>
                <DialogFooter className="sm:col-span-2">
                  <Button type="submit" disabled={request.isPending}>
                    {request.isPending ? "Submitting…" : "Submit request"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Days taken" value={takenDays} hint="Approved this year" icon={<CalendarDays className="size-5" />} />
        <StatCard label="Awaiting approval" value={rows.filter((r) => r.status === "pending").length} icon={<Clock className="size-5" />} />
        <StatCard label="Approved" value={rows.filter((r) => r.status === "approved").length} icon={<CheckCircle2 className="size-5" />} />
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No leave requests yet" hint="Requests you submit will appear here." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  {canDecide && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employee?.full_name ?? "—"}</TableCell>
                    <TableCell>{titleCase(r.leave_type)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {prettyDate(r.start_date)} → {prettyDate(r.end_date)}
                    </TableCell>
                    <TableCell>{daysBetween(r.start_date, r.end_date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    {canDecide && (
                      <TableCell className="text-right">
                        {r.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decide.mutate({ id: r.id, status: "approved" })}
                            >
                              <Check className="size-4" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => decide.mutate({ id: r.id, status: "rejected" })}
                            >
                              <X className="size-4" /> Decline
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Decided</span>
                        )}
                      </TableCell>
                    )}
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
