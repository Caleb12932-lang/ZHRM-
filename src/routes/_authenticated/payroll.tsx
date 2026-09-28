import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Banknote, Wallet, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hr, money, prettyDate } from "@/lib/hr";
import { useMe } from "@/hooks/useMe";
import { PageHeader } from "@/components/hr/Shell";
import { StatCard, StatusBadge, EmptyState } from "@/components/hr/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/payroll")({
  component: Payroll,
});

function Payroll() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const payslips = useQuery({ queryKey: ["payslips"], queryFn: hr.payslips });
  const employees = useQuery({ queryKey: ["employees"], queryFn: hr.employees });

  const isHr = Boolean(me?.isHr);
  const rows = payslips.data ?? [];

  const create = useMutation({
    mutationFn: async (fd: FormData) => {
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      const gross = Number(get("gross_pay"));
      const deductions = Number(get("deductions") || 0);
      const { error } = await supabase.from("payslips").insert({
        employee_id: get("employee_id"),
        period_start: get("period_start"),
        period_end: get("period_end"),
        gross_pay: gross,
        deductions,
        net_pay: gross - deductions,
        status: "draft",
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Payslip created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["payslips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payslips")
        .update({ status: "paid", paid_on: new Date().toISOString().slice(0, 10) } as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Payslip marked as paid");
      qc.invalidateQueries({ queryKey: ["payslips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalNet = rows.reduce((s, r) => s + Number(r.net_pay ?? 0), 0);
  const pendingCount = rows.filter((r) => r.status !== "paid").length;

  return (
    <div>
      <PageHeader
        title="Payroll"
        description={isHr ? "Run pay periods and publish payslips." : "Your pay history and payslips."}
        action={
          isHr ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> New payslip
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create payslip</DialogTitle>
                </DialogHeader>
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    create.mutate(new FormData(e.currentTarget));
                  }}
                >
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Employee</Label>
                    <Select name="employee_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {(employees.data ?? []).map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period_start">Period start</Label>
                    <Input id="period_start" name="period_start" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period_end">Period end</Label>
                    <Input id="period_end" name="period_end" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gross_pay">Gross pay</Label>
                    <Input id="gross_pay" name="gross_pay" type="number" min="0" step="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deductions">Deductions</Label>
                    <Input id="deductions" name="deductions" type="number" min="0" step="0.01" defaultValue="0" />
                  </div>
                  <DialogFooter className="sm:col-span-2">
                    <Button type="submit" disabled={create.isPending}>
                      Create payslip
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Payslips" value={rows.length} icon={<Receipt className="size-5" />} />
        <StatCard label="Total net pay" value={money(totalNet)} icon={<Banknote className="size-5" />} />
        <StatCard label="Awaiting payment" value={pendingCount} icon={<Wallet className="size-5" />} />
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No payslips yet" hint="Payslips appear here once payroll is run." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                  {isHr && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.employee?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {prettyDate(p.period_start)} → {prettyDate(p.period_end)}
                    </TableCell>
                    <TableCell>{money(p.gross_pay)}</TableCell>
                    <TableCell>{money(p.deductions)}</TableCell>
                    <TableCell className="font-medium">{money(p.net_pay)}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    {isHr && (
                      <TableCell className="text-right">
                        {p.status === "paid" ? (
                          <span className="text-xs text-muted-foreground">
                            Paid {prettyDate(p.paid_on)}
                          </span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => markPaid.mutate(p.id)}>
                            Mark paid
                          </Button>
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
