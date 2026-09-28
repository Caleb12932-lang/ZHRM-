import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, MapPin, Search, Plus, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hr, initials, money, prettyDate, titleCase } from "@/lib/hr";
import { useMe } from "@/hooks/useMe";
import { PageHeader } from "@/components/hr/Shell";
import { StatusBadge, EmptyState } from "@/components/hr/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/directory")({
  component: Directory,
});

function Directory() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [open, setOpen] = useState(false);
  const [removeEmployee, setRemoveEmployee] = useState<any>(null);

  const employees = useQuery({ queryKey: ["employees"], queryFn: hr.employees });
  const departments = useQuery({ queryKey: ["departments"], queryFn: hr.departments });

  const create = useMutation({
    mutationFn: async (fd: FormData) => {
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      const payload: Record<string, unknown> = {
        full_name: get("full_name"),
        email: get("email"),
        job_title: get("job_title") || null,
        location: get("location") || null,
        employment_type: get("employment_type") || "full_time",
        hire_date: get("hire_date") || null,
      };
      const deptId = get("department_id");
      if (deptId && deptId !== "none") payload["department_id"] = deptId;
      if (get("salary")) payload["salary"] = Number(get("salary"));
      const { error } = await supabase.from("employees").insert(payload as never);
      if (error) throw new Error(error.message);
    },

    onSuccess: () => {
      toast.success("Employee added");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFromDepartment = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("employees")
        .update({ department_id: null })
        .eq("id", employeeId);

      if (error) throw new Error(error.message);
    },

    onSuccess: () => {
      toast.success("Employee removed from department");
      qc.invalidateQueries({ queryKey: ["employees"] });
    },

    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const deptName = (id: string | null) =>
    departments.data?.find((d) => d.id === id)?.name ?? "Unassigned";

  const filtered = useMemo(() => {
    const list = employees.data ?? [];
    return list.filter((e) => {
      const matchSearch = `${e.full_name} ${e.email} ${e.job_title ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchDept = dept === "all" || e.department_id === dept;
      return matchSearch && matchDept;
    });
  }, [employees.data, search, dept]);

  return (
    <div>
      <PageHeader
        title="People directory"
        description="Everyone in the organisation, with roles, teams and contact details."
        action={
          me?.isHr ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Add employee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add employee</DialogTitle>
                </DialogHeader>
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    create.mutate(new FormData(e.currentTarget));

                  }}
                >
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input id="full_name" name="full_name" required />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job_title">Job title</Label>
                    <Input id="job_title" name="job_title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select name="department_id" defaultValue="none">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {(departments.data ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" name="location" />
                  </div>
                  <div className="space-y-2">
                    <Label>Employment type</Label>
                    <Select name="employment_type" defaultValue="full_time">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["full_time", "part_time", "contract", "intern"].map((t) => (
                          <SelectItem key={t} value={t}>
                            {titleCase(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hire_date">Hire date</Label>
                    <Input id="hire_date" name="hire_date" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salary">Annual salary</Label>
                    <Input id="salary" name="salary" type="number" min="0" step="100" />
                  </div>
                  <DialogFooter className="sm:col-span-2">
                    <Button type="submit" disabled={create.isPending}>
                      {create.isPending ? "Saving…" : "Save employee"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email or role"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {(departments.data ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No people found" hint="Try a different search or filter." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
                    {initials(e.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.full_name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {e.job_title ?? "Role not set"}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="size-3.5" /> {e.email}
                  </p>
                  {e.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5" /> {e.phone}
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <MapPin className="size-3.5" /> {e.location ?? "Remote"}
                  </p>
                </div>
                <div className="mt-4 border-t pt-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{deptName(e.department_id)}</span>
                    <span>Joined {prettyDate(e.hire_date)}</span>

                    {(me?.isHr || me?.employee?.id === e.id) && e.salary != null && (
                      <span className="font-medium text-foreground">
                        {money(e.salary)}/yr
                      </span>
                    )}
                  </div>

                  {me?.isHr && e.department_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setRemoveEmployee(e)}
                    >
                      <UserMinus className="mr-2 size-4" />
                      Remove from department
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={!!removeEmployee}
        onOpenChange={(value) => {
          if (!value) setRemoveEmployee(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from department?</DialogTitle>
          </DialogHeader>

          <div className="text-sm text-muted-foreground">
            {removeEmployee && (
              <p>
                <strong className="text-foreground">
                  {removeEmployee.full_name}
                </strong>{" "}
                will remain an active employee but will no longer be assigned
                to{" "}
                <strong className="text-foreground">
                  {deptName(removeEmployee.department_id)}
                </strong>
                .
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveEmployee(null)}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              disabled={removeFromDepartment.isPending}
              onClick={() => {
                if (removeEmployee) {
                  removeFromDepartment.mutate(removeEmployee.id);
                }
              }}
            >
              {removeFromDepartment.isPending
                ? "Removing..."
                : "Remove from department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
