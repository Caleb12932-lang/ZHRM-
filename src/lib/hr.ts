import { supabase } from "@/integrations/supabase/client";

export type Employee = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  department_id: string | null;
  manager_id: string | null;
  location: string | null;
  hire_date: string | null;
  employment_type: string;
  status: string;
  salary: number | null;
  avatar_url: string | null;
  bio: string | null;
};

export type Department = { id: string; name: string; description: string | null };

export const LEAVE_TYPES = ["annual", "sick", "parental", "unpaid", "study"] as const;
export const HIRING_STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function money(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
}

export function prettyDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function titleCase(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function daysBetween(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const hr = {
  me: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return null;
    const [{ data: employeeByUserId }, { data: roles }] = await Promise.all([
      supabase.from("employees").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);

    let employee = employeeByUserId;

    if (!employee && user.email) {
      const { data: employeeByEmail } = await supabase
        .from("employees")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      employee = employeeByEmail;

      if (employee && !employee.user_id) {
        await supabase
          .from("employees")
          .update({ user_id: user.id })
          .eq("id", employee.id);
      }
    }
    const roleList = (roles ?? []).map((r) => r.role as string);
    return {
      user,
      employee: (employee ?? null) as Employee | null,
      roles: roleList,
      isHr: roleList.includes("admin") || roleList.includes("hr"),
      isManager: roleList.includes("manager"),
    };
  },
  employees: () =>
    unwrap<Employee[]>(supabase.from("employees").select("*").order("full_name")),
  departments: () =>
    unwrap<Department[]>(supabase.from("departments").select("*").order("name")),
  leave: () =>
    unwrap<any[]>(
      supabase
        .from("leave_requests")
        .select("*, employee:employees!leave_requests_employee_id_fkey(full_name, job_title)")
        .order("created_at", { ascending: false }),
    ),
  attendance: () =>
    unwrap<any[]>(
      supabase
        .from("attendance")
        .select("*, employee:employees(full_name)")
        .order("work_date", { ascending: false })
        .limit(200),
    ),
  jobs: () =>
    unwrap<any[]>(
      supabase
        .from("job_postings")
        .select("*, department:departments(name)")
        .order("created_at", { ascending: false }),
    ),
  applicants: () =>
    unwrap<any[]>(
      supabase
        .from("applicants")
        .select("*, job:job_postings(title)")
        .order("created_at", { ascending: false }),
    ),
  onboarding: () =>
    unwrap<any[]>(
      supabase
        .from("onboarding_tasks")
        .select("*, employee:employees(full_name)")
        .order("due_date", { nullsFirst: false }),
    ),
  payslips: () =>
    unwrap<any[]>(
      supabase
        .from("payslips")
        .select("*, employee:employees(full_name)")
        .order("period_end", { ascending: false }),
    ),
  reviews: () =>
    unwrap<any[]>(
      supabase
        .from("reviews")
        .select("*, employee:employees!reviews_employee_id_fkey(full_name, job_title)")
        .order("created_at", { ascending: false }),
    ),
  goals: () =>
    unwrap<any[]>(
      supabase
        .from("goals")
        .select("*, employee:employees(full_name)")
        .order("due_date", { nullsFirst: false }),
    ),
};
