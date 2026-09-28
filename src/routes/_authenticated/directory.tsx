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

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: hr.employees,
  });

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: hr.departments,
  });

  /*
   * Add / update employee
   */
  const create = useMutation({
    mutationFn: async (fd: FormData) => {
      const get = (key: string) =>
        String(fd.get(key) ?? "").trim();

      const fullName = get("full_name");
      const email = get("email").toLowerCase();

      if (!fullName) {
        throw new Error("Full name is required");
      }

      if (!email) {
        throw new Error("Email is required");
      }

      const payload: Record<string, unknown> = {
        full_name: fullName,
        email,
        job_title: get("job_title") || null,
        location: get("location") || null,
        employment_type:
          get("employment_type") || "full_time",
        hire_date: get("hire_date") || null,
      };

      const departmentId = get("department_id");

      if (departmentId && departmentId !== "none") {
        payload["department_id"] = departmentId;
      } else {
        payload["department_id"] = null;
      }

      const salary = get("salary");

      if (salary) {
        const numericSalary = Number(salary);

        if (Number.isNaN(numericSalary)) {
          throw new Error("Salary must be a valid number");
        }

        payload["salary"] = numericSalary;
      } else {
        payload["salary"] = null;
      }

      /*
       * Check whether an employee with this email
       * already exists.
       */
      const {
        data: existingEmployee,
        error: findError,
      } = await supabase
        .from("employees")
        .select(
          "id, user_id, full_name, email, job_title, department_id",
        )
        .eq("email", email)
        .maybeSingle();

      if (findError) {
        throw new Error(findError.message);
      }

      /*
       * Existing employee:
       * update instead of creating a duplicate.
       */
      if (existingEmployee) {
        const { error: updateError } = await supabase
          .from("employees")
          .update(payload as never)
          .eq("id", existingEmployee.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        return;
      }

      /*
       * No existing employee:
       * create a new employee.
       */
      const { error: insertError } = await supabase
        .from("employees")
        .insert(payload as never);

      if (insertError) {
        throw new Error(insertError.message);
      }
    },

    onSuccess: () => {
      toast.success("Employee saved");
      setOpen(false);

      qc.invalidateQueries({
        queryKey: ["employees"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  /*
   * Remove employee from department
   */
  const removeFromDepartment = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("employees")
        .update({
          department_id: null,
        })
        .eq("id", employeeId);

      if (error) {
        throw new Error(error.message);
      }
    },

    onSuccess: () => {
      toast.success("Employee removed from department");

      setRemoveEmployee(null);

      qc.invalidateQueries({
        queryKey: ["employees"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  /*
   * Get department name
   */
  const deptName = (id: string | null) => {
    return (
      departments.data?.find(
        (department) => department.id === id,
      )?.name ?? "Unassigned"
    );
  };

  /*
   * Search and department filtering
   */
  const filtered = useMemo(() => {
    const list = employees.data ?? [];

    return list.filter((employee) => {
      const matchSearch = `
        ${employee.full_name}
        ${employee.email}
        ${employee.job_title ?? ""}
      `
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchDepartment =
        dept === "all" ||
        employee.department_id === dept;

      return matchSearch && matchDepartment;
    });
  }, [employees.data, search, dept]);

  return (
    <div>
      <PageHeader
        title="People directory"
        description="Everyone in the organisation, with roles, teams and contact details."
        action={
          me?.isHr ? (
            <Dialog
              open={open}
              onOpenChange={setOpen}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" />
                  Add employee
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Add employee
                  </DialogTitle>
                </DialogHeader>

                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();

                    const formData = new FormData(
                      event.currentTarget,
                    );

                    create.mutate(formData);
                  }}
                >
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="full_name">
                      Full name
                    </Label>

                    <Input
                      id="full_name"
                      name="full_name"
                      required
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="email">
                      Email
                    </Label>

                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job_title">
                      Job title
                    </Label>

                    <Input
                      id="job_title"
                      name="job_title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Department
                    </Label>

                    <Select
                      name="department_id"
                      defaultValue="none"
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="none">
                          Unassigned
                        </SelectItem>

                        {(departments.data ?? []).map(
                          (department) => (
                            <SelectItem
                              key={department.id}
                              value={department.id}
                            >
                              {department.name}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">
                      Location
                    </Label>

                    <Input
                      id="location"
                      name="location"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Employment type
                    </Label>

                    <Select
                      name="employment_type"
                      defaultValue="full_time"
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {[
                          "full_time",
                          "part_time",
                          "contract",
                          "intern",
                        ].map((type) => (
                          <SelectItem
                            key={type}
                            value={type}
                          >
                            {titleCase(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hire_date">
                      Hire date
                    </Label>

                    <Input
                      id="hire_date"
                      name="hire_date"
                      type="date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salary">
                      Annual salary
                    </Label>

                    <Input
                      id="salary"
                      name="salary"
                      type="number"
                      min="0"
                      step="100"
                    />
                  </div>

                  <DialogFooter className="sm:col-span-2">
                    <Button
                      type="submit"
                      disabled={create.isPending}
                    >
                      {create.isPending
                        ? "Saving..."
                        : "Save employee"}
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
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <Select
          value={dept}
          onValueChange={setDept}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All departments
            </SelectItem>

            {(departments.data ?? []).map(
              (department) => (
                <SelectItem
                  key={department.id}
                  value={department.id}
                >
                  {department.name}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No people found"
          hint="Try a different search or filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((employee) => (
            <Card key={employee.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
                    {initials(employee.full_name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {employee.full_name}
                    </p>

                    <p className="truncate text-sm text-muted-foreground">
                      {employee.job_title ??
                        "Role not set"}
                    </p>
                  </div>

                  <StatusBadge
                    status={employee.status}
                  />
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="size-3.5" />
                    {employee.email}
                  </p>

                  {employee.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5" />
                      {employee.phone}
                    </p>
                  )}

                  <p className="flex items-center gap-2">
                    <MapPin className="size-3.5" />
                    {employee.location ??
                      "Remote"}
                  </p>
                </div>

                <div className="mt-4 border-t pt-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {deptName(
                        employee.department_id,
                      )}
                    </span>

                    <span>
                      Joined{" "}
                      {prettyDate(
                        employee.hire_date,
                      )}
                    </span>

                    {(me?.isHr ||
                      me?.employee?.id ===
                      employee.id) &&
                      employee.salary != null && (
                        <span className="font-medium text-foreground">
                          {money(employee.salary)}
                          /yr
                        </span>
                      )}
                  </div>

                  {me?.isHr &&
                    employee.department_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() =>
                          setRemoveEmployee(
                            employee,
                          )
                        }
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
          if (!value) {
            setRemoveEmployee(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove from department?
            </DialogTitle>
          </DialogHeader>

          <div className="text-sm text-muted-foreground">
            {removeEmployee && (
              <p>
                <strong className="text-foreground">
                  {removeEmployee.full_name}
                </strong>{" "}
                will remain an active employee
                but will no longer be assigned to{" "}
                <strong className="text-foreground">
                  {deptName(
                    removeEmployee.department_id,
                  )}
                </strong>
                .
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRemoveEmployee(null)
              }
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              disabled={
                removeFromDepartment.isPending
              }
              onClick={() => {
                if (removeEmployee) {
                  removeFromDepartment.mutate(
                    removeEmployee.id,
                  );
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