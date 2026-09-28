import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  CalendarDays,
  Briefcase,
  Target,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { hr, prettyDate, titleCase } from "@/lib/hr";
import { useMe } from "@/hooks/useMe";
import { PageHeader } from "@/components/hr/Shell";
import { StatCard, StatusBadge, EmptyState } from "@/components/hr/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const employees = useQuery({ queryKey: ["employees"], queryFn: hr.employees });
  const departments = useQuery({ queryKey: ["departments"], queryFn: hr.departments });
  const leave = useQuery({ queryKey: ["leave"], queryFn: hr.leave });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: hr.jobs });
  const goals = useQuery({ queryKey: ["goals"], queryFn: hr.goals });

  const staff = employees.data ?? [];
  const pending = (leave.data ?? []).filter((l) => l.status === "pending");
  const openJobs = (jobs.data ?? []).filter((j) => j.status === "open");

  const byDept = (departments.data ?? []).map((d) => ({
    name: d.name.split(" ")[0],
    people: staff.filter((e) => e.department_id === d.id).length,
  }));

  return (
    <div>
      <PageHeader
        title={`Good day, ${me?.employee?.full_name?.split(" ")[0] ?? "there"}`}
        description="Here's what's happening across your organisation today."
        badge={me?.isHr ? "HR access" : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Headcount" value={staff.length} hint={`${staff.filter((e) => e.status === "active").length} active`} icon={<Users className="size-5" />} />
        <StatCard label="Pending leave" value={pending.length} hint="Awaiting approval" icon={<CalendarDays className="size-5" />} />
        <StatCard label="Open roles" value={openJobs.length} hint="Currently hiring" icon={<Briefcase className="size-5" />} />
        <StatCard label="Active goals" value={(goals.data ?? []).filter((g) => g.status === "in_progress").length} hint="This cycle" icon={<Target className="size-5" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Headcount by department</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {byDept.length === 0 ? (
              <EmptyState title="No departments yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDept}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="people" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Leave queue</CardTitle>
            <Link to="/leave" className="text-xs text-primary hover:underline">
              View all <ArrowRight className="inline size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {(leave.data ?? []).slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.employee?.full_name ?? "Employee"}</p>
                  <p className="text-xs text-muted-foreground">
                    {titleCase(l.leave_type)} · {prettyDate(l.start_date)}
                  </p>
                </div>
                <StatusBadge status={l.status} />
              </div>
            ))}
            {(leave.data ?? []).length === 0 && <EmptyState title="No leave requests" />}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Goal progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(goals.data ?? []).slice(0, 5).map((g) => (
              <div key={g.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{g.title}</span>
                  <span className="text-muted-foreground">{g.progress}%</span>
                </div>
                <Progress value={g.progress} />
              </div>
            ))}
            {(goals.data ?? []).length === 0 && (
              <EmptyState title="No goals yet" hint="Set goals from the Performance page." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Open roles</CardTitle>
            <Link to="/recruitment" className="text-xs text-primary hover:underline">
              Recruitment <ArrowRight className="inline size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {openJobs.slice(0, 5).map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{j.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {j.department?.name ?? "—"} · {titleCase(j.employment_type)}
                  </p>
                </div>
                <StatusBadge status={j.status} />
              </div>
            ))}
            {openJobs.length === 0 && <EmptyState title="No open roles" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
