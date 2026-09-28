import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  X,
  Plus,
  Users,
  CalendarDays,
  ClipboardList,
  Clock,
  Target,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { hr, prettyDate, titleCase } from "@/lib/hr";
import { useMe } from "@/hooks/useMe";
import { PageHeader } from "@/components/hr/Shell";
import { StatCard, StatusBadge, EmptyState } from "@/components/hr/ui";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

export const Route = createFileRoute("/_authenticated/manager")({
  component: ManagerPage,
});

function ManagerPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [taskOpen, setTaskOpen] = useState(false);

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: hr.employees,
  });

  const leave = useQuery({
    queryKey: ["leave"],
    queryFn: hr.leave,
  });

  const attendance = useQuery({
    queryKey: ["attendance"],
    queryFn: hr.attendance,
  });

  const goals = useQuery({
    queryKey: ["goals"],
    queryFn: hr.goals,
  });

  const onboarding = useQuery({
    queryKey: ["onboarding"],
    queryFn: hr.onboarding,
  });

  const team = useMemo(() => {
    if (!me?.employee?.id) return [];

    return (employees.data ?? []).filter(
      (employee) => employee.manager_id === me.employee!.id,
    );
  }, [employees.data, me?.employee?.id]);

  const teamIds = useMemo(
    () => new Set(team.map((employee) => employee.id)),
    [team],
  );

  const teamLeave = useMemo(
    () =>
      (leave.data ?? []).filter((request) =>
        teamIds.has(request.employee_id),
      ),
    [leave.data, teamIds],
  );

  const pendingLeave = teamLeave.filter(
    (request) => request.status === "pending",
  );

  const teamAttendance = (attendance.data ?? []).filter((record) =>
    teamIds.has(record.employee_id),
  );

  const teamGoals = (goals.data ?? []).filter((goal) =>
    teamIds.has(goal.employee_id),
  );

  const teamTasks = (onboarding.data ?? []).filter((task) =>
    teamIds.has(task.employee_id),
  );

  const decideLeave = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "approved" | "rejected";
    }) => {
      if (!me?.employee?.id) {
        throw new Error("Manager employee profile not found.");
      }

      const { error } = await supabase
        .from("leave_requests")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: me.employee.id,
        } as never)
        .eq("id", id);

      if (error) throw new Error(error.message);
    },

    onSuccess: (_, variables) => {
      toast.success(
        variables.status === "approved"
          ? "Leave approved"
          : "Leave rejected",
      );

      qc.invalidateQueries({ queryKey: ["leave"] });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const createTask = useMutation({
    mutationFn: async (formData: FormData) => {
      const get = (key: string) =>
        String(formData.get(key) ?? "").trim();

      const employeeId = get("employee_id");
      const title = get("title");
      const description = get("description");
      const dueDate = get("due_date");

      if (!employeeId) throw new Error("Select an employee.");
      if (!title) throw new Error("Enter a duty/task title.");

      if (!teamIds.has(employeeId)) {
        throw new Error("You can only assign duties to your team.");
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .insert({
          employee_id: employeeId,
          title,
          description: description || null,
          due_date: dueDate || null,
          completed: false,
        } as never);

      if (error) throw new Error(error.message);
    },

    onSuccess: () => {
      toast.success("Duty assigned successfully");
      setTaskOpen(false);
      qc.invalidateQueries({ queryKey: ["onboarding"] });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const completeTask = useMutation({
    mutationFn: async ({
      id,
      completed,
    }: {
      id: string;
      completed: boolean;
    }) => {
      const { error } = await supabase
        .from("onboarding_tasks")
        .update({
          completed,
          completed_at: completed
            ? new Date().toISOString()
            : null,
        } as never)
        .eq("id", id);

      if (error) throw new Error(error.message);
    },

    onSuccess: () => {
      toast.success("Duty status updated");
      qc.invalidateQueries({ queryKey: ["onboarding"] });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (!me) {
    return (
      <div className="p-6">
        <EmptyState
          title="Loading manager profile..."
          hint="Please wait while your account is loaded."
        />
      </div>
    );
  }

  if (!me.isManager && !me.isHr) {
    return (
      <div className="p-6">
        <EmptyState
          title="Manager access required"
          hint="This area is available to managers and HR administrators."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager Dashboard"
        description="Manage your team, approve leave, assign duties and monitor performance."
        action={
          <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Assign duty
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign a duty</DialogTitle>
              </DialogHeader>

              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  createTask.mutate(
                    new FormData(event.currentTarget),
                  );
                }}
              >
                <div className="space-y-2">
                  <Label>Employee</Label>

                  <Select name="employee_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>

                    <SelectContent>
                      {team.map((employee) => (
                        <SelectItem
                          key={employee.id}
                          value={employee.id}
                        >
                          {employee.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Duty / task</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g. Prepare monthly attendance report"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    Instructions
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe what the employee needs to do..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due date</Label>
                  <Input
                    id="due_date"
                    name="due_date"
                    type="date"
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createTask.isPending}
                  >
                    {createTask.isPending
                      ? "Assigning..."
                      : "Assign duty"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="My team"
          value={team.length}
          icon={<Users className="size-5" />}
        />

        <StatCard
          label="Pending leave"
          value={pendingLeave.length}
          icon={<CalendarDays className="size-5" />}
        />

        <StatCard
          label="Team attendance"
          value={teamAttendance.length}
          icon={<Clock className="size-5" />}
        />

        <StatCard
          label="Active duties"
          value={teamTasks.filter((task) => !task.completed).length}
          icon={<ClipboardList className="size-5" />}
        />

        <StatCard
          label="Goals"
          value={teamGoals.length}
          icon={<Target className="size-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave requests awaiting approval</CardTitle>
        </CardHeader>

        <CardContent>
          {pendingLeave.length === 0 ? (
            <EmptyState
              title="No pending leave requests"
              hint="Your team's new leave requests will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead className="text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pendingLeave.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.employee?.full_name ?? "Unknown"}
                    </TableCell>

                    <TableCell>
                      {titleCase(request.leave_type)}
                    </TableCell>

                    <TableCell>
                      {prettyDate(request.start_date)} ?{" "}
                      {prettyDate(request.end_date)}
                    </TableCell>

                    <TableCell>{request.days}</TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            decideLeave.mutate({
                              id: request.id,
                              status: "approved",
                            })
                          }
                          disabled={decideLeave.isPending}
                        >
                          <Check className="size-4" />
                          Approve
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            decideLeave.mutate({
                              id: request.id,
                              status: "rejected",
                            })
                          }
                          disabled={decideLeave.isPending}
                        >
                          <X className="size-4" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My team</CardTitle>
        </CardHeader>

        <CardContent>
          {team.length === 0 ? (
            <EmptyState
              title="No employees assigned"
              hint="Employees assigned to you will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Job title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {team.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.full_name}
                    </TableCell>

                    <TableCell>
                      {employee.job_title ?? "Not set"}
                    </TableCell>

                    <TableCell>
                      {employee.department_id ?? "Unassigned"}
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={employee.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned duties</CardTitle>
        </CardHeader>

        <CardContent>
          {teamTasks.length === 0 ? (
            <EmptyState
              title="No duties assigned"
              hint="Use the Assign duty button to give work to a team member."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Duty</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {teamTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      {task.employee?.full_name ?? "Unknown"}
                    </TableCell>

                    <TableCell>
                      <div>
                        <p className="font-medium">{task.title}</p>

                        {task.description && (
                          <p className="text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {prettyDate(task.due_date)}
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        status={
                          task.completed
                            ? "completed"
                            : "pending"
                        }
                      />
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={
                          task.completed
                            ? "outline"
                            : "default"
                        }
                        onClick={() =>
                          completeTask.mutate({
                            id: task.id,
                            completed: !task.completed,
                          })
                        }
                      >
                        {task.completed
                          ? "Mark pending"
                          : "Mark complete"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team goals</CardTitle>
          </CardHeader>

          <CardContent>
            {teamGoals.length === 0 ? (
              <EmptyState
                title="No goals yet"
                hint="Team goals will appear here."
              />
            ) : (
              <div className="space-y-3">
                {teamGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          {goal.title}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {goal.employee?.full_name ??
                            "Unknown employee"}
                        </p>
                      </div>

                      <span className="text-sm font-medium">
                        {goal.progress ?? 0}%
                      </span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, goal.progress ?? 0),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent team attendance</CardTitle>
          </CardHeader>

          <CardContent>
            {teamAttendance.length === 0 ? (
              <EmptyState
                title="No attendance records"
                hint="Team attendance will appear here."
              />
            ) : (
              <div className="space-y-3">
                {teamAttendance.slice(0, 8).map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {record.employee?.full_name ??
                          "Unknown employee"}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {prettyDate(record.work_date)}
                      </p>
                    </div>

                    <StatusBadge status={record.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
