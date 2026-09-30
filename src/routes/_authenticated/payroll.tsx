import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Banknote,
  Wallet,
  Receipt,
  Search,
  Calculator,
  Printer,
  Eye,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hr, initials, money, prettyDate } from "@/lib/hr";
import { useMe } from "@/hooks/useMe";
import { PageHeader } from "@/components/hr/Shell";
import { StatusBadge, EmptyState } from "@/components/hr/ui";
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

export const Route = createFileRoute("/_authenticated/payroll")({
  component: Payroll,
});

/* ------------------------------------------------------------------ */
/* Kenya statutory deductions (monthly pay).                           */
/* Rates as of 2026 – confirm with KRA / NSSF / SHA before relying     */
/* on them, and update the numbers below when the law changes.         */
/* ------------------------------------------------------------------ */
const RATES = {
  nssfRate: 0.06,
  nssfUpperLimit: 108_000, // pensionable pay ceiling from Feb 2026
  shifRate: 0.0275,
  shifMinimum: 300,
  housingLevyRate: 0.015,
  personalRelief: 2_400,
  // Monthly PAYE bands: [band width, rate]
  bands: [
    [24_000, 0.1],
    [8_333, 0.25],
    [467_667, 0.3],
    [300_000, 0.325],
    [Infinity, 0.35],
  ] as [number, number][],
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function payeOn(taxable: number) {
  let remaining = Math.max(0, taxable);
  let tax = 0;
  for (const [width, rate] of RATES.bands) {
    const slice = Math.min(remaining, width);
    tax += slice * rate;
    remaining -= slice;
    if (remaining <= 0) break;
  }
  return tax;
}

function statutory(gross: number) {
  const nssf = round2(Math.min(gross, RATES.nssfUpperLimit) * RATES.nssfRate);
  const shif = round2(Math.max(gross * RATES.shifRate, RATES.shifMinimum));
  const housing = round2(gross * RATES.housingLevyRate);
  const taxable = gross - nssf - shif - housing;
  const paye = round2(Math.max(0, payeOn(taxable) - RATES.personalRelief));
  return { paye, nssf, shif, housing, total: round2(paye + nssf + shif + housing) };
}

/* ------------------------------------------------------------------ */

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function printPayslip(p: any) {
  const gross = Number(p.gross_pay ?? 0);
  const ded = Number(p.deductions ?? 0);
  const net = Number(p.net_pay ?? 0);
  const win = window.open("", "_blank", "width=720,height=900");
  if (!win) {
    toast.error("Allow pop-ups to print or save the payslip");
    return;
  }
  win.document.write(`<!doctype html><html><head><title>Payslip</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1b2440;margin:40px}
  h1{margin:0 0 4px;font-size:22px} .muted{color:#66708a;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  td{padding:12px 0;border-bottom:1px solid #e3e7f2;font-size:15px}
  td:last-child{text-align:right}
  .net td{font-size:18px;font-weight:700;border-bottom:none;padding-top:20px}
</style></head><body>
<h1>Payslip</h1>
<div class="muted">${esc(p.employee?.full_name ?? "")}<br/>
${esc(prettyDate(p.period_start))} – ${esc(prettyDate(p.period_end))}</div>
<table>
<tr><td>Gross pay</td><td>${esc(money(gross))}</td></tr>
<tr><td>Total deductions</td><td>− ${esc(money(ded))}</td></tr>
<tr class="net"><td>Net pay</td><td>${esc(money(net))}</td></tr>
</table>
<p class="muted" style="margin-top:32px">Status: ${esc(p.status)}${p.paid_on ? ` · Paid ${esc(prettyDate(p.paid_on))}` : ""
    }</p>
<script>window.onload=()=>window.print()</script>
</body></html>`);
  win.document.close();
}

function Payroll() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "paid">("all");
  const [month, setMonth] = useState("all");

  // Create-form state (kept in state so the estimate button can fill it in)
  const [grossInput, setGrossInput] = useState("");
  const [dedInput, setDedInput] = useState("0");

  const payslips = useQuery({ queryKey: ["payslips"], queryFn: hr.payslips });
  const employees = useQuery({ queryKey: ["employees"], queryFn: hr.employees });

  const isHr = Boolean(me?.isHr);
  const allRows: any[] = payslips.data ?? [];

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
      setGrossInput("");
      setDedInput("0");
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
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["payslips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const months = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => r.period_end && set.add(String(r.period_end).slice(0, 7)));
    return [...set].sort().reverse();
  }, [allRows]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      const name = String(r.employee?.full_name ?? "").toLowerCase();
      const okSearch = !q || name.includes(q);
      const okStatus =
        status === "all" ||
        (status === "paid" ? r.status === "paid" : r.status !== "paid");
      const okMonth = month === "all" || String(r.period_end ?? "").startsWith(month);
      return okSearch && okStatus && okMonth;
    });
  }, [allRows, search, status, month]);

  const totalNet = rows.reduce((s, r) => s + Number(r.net_pay ?? 0), 0);
  const totalGross = rows.reduce((s, r) => s + Number(r.gross_pay ?? 0), 0);
  const totalDed = rows.reduce((s, r) => s + Number(r.deductions ?? 0), 0);
  const pendingCount = rows.filter((r) => r.status !== "paid").length;

  const chip = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "bg-card/70 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`;

  /* Breakdown is only shown when it matches what was saved (monthly pay). */
  const breakdownFor = (p: any) => {
    const gross = Number(p.gross_pay ?? 0);
    const saved = Number(p.deductions ?? 0);
    const days = p.period_start && p.period_end ? daysBetween(p.period_start, p.period_end) : 0;
    if (days < 25 || days > 32) return null;
    const s = statutory(gross);
    return Math.abs(s.total - saved) <= 1 ? s : null;
  };

  const selectedBreakdown = selected ? breakdownFor(selected) : null;

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
                    <Input
                      id="gross_pay"
                      name="gross_pay"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={grossInput}
                      onChange={(e) => setGrossInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deductions">Deductions</Label>
                    <Input
                      id="deductions"
                      name="deductions"
                      type="number"
                      min="0"
                      step="0.01"
                      value={dedInput}
                      onChange={(e) => setDedInput(e.target.value)}
                    />
                  </div>

                  <div className="rounded-xl border bg-accent/40 p-3 text-sm sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-muted-foreground">
                        Fill in PAYE, NSSF, SHIF and Housing Levy for a monthly salary.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!Number(grossInput)}
                        onClick={() => setDedInput(String(statutory(Number(grossInput)).total))}
                      >
                        <Calculator className="size-4" /> Estimate deductions
                      </Button>
                    </div>
                    {Number(grossInput) > 0 && (
                      <p className="mt-2 font-medium">
                        Net pay: {money(Number(grossInput) - Number(dedInput || 0))}
                      </p>
                    )}
                  </div>

                  <DialogFooter className="sm:col-span-2">
                    <Button type="submit" disabled={create.isPending}>
                      {create.isPending ? "Creating..." : "Create payslip"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* Hero total */}
      <div className="bg-brand relative overflow-hidden rounded-2xl p-6 text-primary-foreground shadow-elevated sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 size-40 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm font-medium opacity-80">
          {month === "all" ? "Total net pay" : `Net pay · ${monthLabel(month)}`}
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{money(totalNet)}</p>
        <p className="mt-2 text-sm opacity-80">
          across {rows.length} payslip{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Gross pay",
            value: money(totalGross),
            icon: <Banknote className="size-5" />,
            tone: "bg-primary/10 text-primary",
          },
          {
            label: "Deductions",
            value: money(totalDed),
            icon: <TrendingDown className="size-5" />,
            tone: "bg-destructive/10 text-destructive",
          },
          {
            label: "Awaiting payment",
            value: pendingCount,
            icon: <Wallet className="size-5" />,
            tone: "bg-warning/25 text-warning-foreground",
          },
        ].map((s) => (
          <div key={s.label} className="surface-card flex items-center gap-4 p-5">
            <div className={`flex size-11 items-center justify-center rounded-xl ${s.tone}`}>
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="truncate text-xl font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by employee"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <button type="button" className={chip(status === "all")} onClick={() => setStatus("all")}>
            All
          </button>
          <button type="button" className={chip(status === "pending")} onClick={() => setStatus("pending")}>
            Pending
          </button>
          <button type="button" className={chip(status === "paid")} onClick={() => setStatus("paid")}>
            Paid
          </button>
        </div>
      </div>

      {/* Payslips */}
      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="No payslips found"
            hint={
              allRows.length === 0
                ? "Payslips appear here once payroll is run."
                : "Try a different search or filter."
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((p) => {
              const gross = Number(p.gross_pay ?? 0);
              const net = Number(p.net_pay ?? 0);
              const pct = gross > 0 ? Math.max(0, Math.min(100, (net / gross) * 100)) : 0;
              return (
                <div key={p.id} className="surface-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
                      {initials(p.employee?.full_name ?? "—")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.employee?.full_name ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {prettyDate(p.period_start)} → {prettyDate(p.period_end)}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="mt-5">
                    <p className="text-xs text-muted-foreground">Net pay</p>
                    <p className="text-2xl font-bold tracking-tight">{money(p.net_pay)}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-destructive/15">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>Gross {money(p.gross_pay)}</span>
                      <span>− {money(p.deductions)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t pt-4">
                    <Button size="sm" variant="outline" onClick={() => setSelected(p)}>
                      <Eye className="size-4" /> View
                    </Button>
                    {isHr &&
                      (p.status === "paid" ? (
                        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="size-3.5 text-success" />
                          Paid {prettyDate(p.paid_on)}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="ml-auto"
                          disabled={markPaid.isPending}
                          onClick={() => markPaid.mutate(p.id)}
                        >
                          Mark paid
                        </Button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payslip detail */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="size-5 text-primary" /> Payslip
                </DialogTitle>
              </DialogHeader>

              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
                  {initials(selected.employee?.full_name ?? "—")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{selected.employee?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {prettyDate(selected.period_start)} → {prettyDate(selected.period_end)}
                  </p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <div className="divide-y rounded-xl border text-sm">
                <div className="flex justify-between p-3">
                  <span className="text-muted-foreground">Gross pay</span>
                  <span className="font-medium">{money(selected.gross_pay)}</span>
                </div>

                {selectedBreakdown ? (
                  <>
                    <div className="flex justify-between p-3">
                      <span className="text-muted-foreground">PAYE</span>
                      <span>− {money(selectedBreakdown.paye)}</span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-muted-foreground">NSSF</span>
                      <span>− {money(selectedBreakdown.nssf)}</span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-muted-foreground">SHIF</span>
                      <span>− {money(selectedBreakdown.shif)}</span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-muted-foreground">Housing Levy</span>
                      <span>− {money(selectedBreakdown.housing)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">Total deductions</span>
                    <span>− {money(selected.deductions)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between bg-primary/10 p-4">
                  <span className="font-semibold">Net pay</span>
                  <span className="text-xl font-bold text-primary">{money(selected.net_pay)}</span>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" onClick={() => printPayslip(selected)}>
                  <Printer className="size-4" /> Print / Save as PDF
                </Button>
                {isHr && selected.status !== "paid" && (
                  <Button disabled={markPaid.isPending} onClick={() => markPaid.mutate(selected.id)}>
                    Mark paid
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}