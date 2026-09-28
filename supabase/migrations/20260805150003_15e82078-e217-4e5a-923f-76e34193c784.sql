-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','hr','manager','employee');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_hr(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','hr'))
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_hr(auth.uid()));
CREATE POLICY "hr manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

-- UPDATED AT
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- DEPARTMENTS
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments readable" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

-- EMPLOYEES
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  job_title text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  location text,
  hire_date date,
  employment_type text NOT NULL DEFAULT 'full_time',
  status text NOT NULL DEFAULT 'active',
  salary numeric(12,2),
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.my_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.manages(_employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = _employee_id AND e.manager_id = public.my_employee_id()
  )
$$;

CREATE POLICY "directory readable" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "self update" ON public.employees FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "hr manage employees" ON public.employees FOR ALL TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

-- LEAVE
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'annual',
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric(5,1) NOT NULL DEFAULT 1,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER leave_updated BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "leave read" ON public.leave_requests FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id() OR public.manages(employee_id) OR public.is_hr(auth.uid()));
CREATE POLICY "leave insert own" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.my_employee_id() OR public.is_hr(auth.uid()));
CREATE POLICY "leave update" ON public.leave_requests FOR UPDATE TO authenticated
  USING (employee_id = public.my_employee_id() OR public.manages(employee_id) OR public.is_hr(auth.uid()))
  WITH CHECK (true);
CREATE POLICY "leave delete" ON public.leave_requests FOR DELETE TO authenticated
  USING (employee_id = public.my_employee_id() OR public.is_hr(auth.uid()));

-- ATTENDANCE
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT current_date,
  clock_in timestamptz,
  clock_out timestamptz,
  hours numeric(5,2),
  status text NOT NULL DEFAULT 'present',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "attendance read" ON public.attendance FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id() OR public.manages(employee_id) OR public.is_hr(auth.uid()));
CREATE POLICY "attendance write own" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.my_employee_id() OR public.is_hr(auth.uid()));
CREATE POLICY "attendance update own" ON public.attendance FOR UPDATE TO authenticated
  USING (employee_id = public.my_employee_id() OR public.is_hr(auth.uid())) WITH CHECK (true);

-- RECRUITMENT
CREATE TABLE public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  location text,
  employment_type text NOT NULL DEFAULT 'full_time',
  description text,
  status text NOT NULL DEFAULT 'open',
  openings int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_postings TO authenticated;
GRANT ALL ON public.job_postings TO service_role;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER jobs_updated BEFORE UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "jobs readable" ON public.job_postings FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr manage jobs" ON public.job_postings FOR ALL TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

CREATE TABLE public.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  resume_url text,
  stage text NOT NULL DEFAULT 'applied',
  rating int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicants TO authenticated;
GRANT ALL ON public.applicants TO service_role;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER applicants_updated BEFORE UPDATE ON public.applicants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "hr manage applicants" ON public.applicants FOR ALL TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

-- ONBOARDING
CREATE TABLE public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_tasks TO authenticated;
GRANT ALL ON public.onboarding_tasks TO service_role;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER onboarding_updated BEFORE UPDATE ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "onboarding read" ON public.onboarding_tasks FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id() OR public.manages(employee_id) OR public.is_hr(auth.uid()));
CREATE POLICY "onboarding self update" ON public.onboarding_tasks FOR UPDATE TO authenticated
  USING (employee_id = public.my_employee_id() OR public.is_hr(auth.uid())) WITH CHECK (true);
CREATE POLICY "hr manage onboarding" ON public.onboarding_tasks FOR ALL TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

-- PAYROLL
CREATE TABLE public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_pay numeric(12,2) NOT NULL DEFAULT 0,
  deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_pay numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER payslips_updated BEFORE UPDATE ON public.payslips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "payslip read" ON public.payslips FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id() OR public.is_hr(auth.uid()));
CREATE POLICY "hr manage payslips" ON public.payslips FOR ALL TO authenticated
  USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

-- PERFORMANCE
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  period text NOT NULL,
  rating int,
  strengths text,
  improvements text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER reviews_updated BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "review read" ON public.reviews FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id() OR public.manages(employee_id) OR public.is_hr(auth.uid()));
CREATE POLICY "review write" ON public.reviews FOR ALL TO authenticated
  USING (public.manages(employee_id) OR public.is_hr(auth.uid()))
  WITH CHECK (public.manages(employee_id) OR public.is_hr(auth.uid()));

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  progress int NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER goals_updated BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "goal read" ON public.goals FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id() OR public.manages(employee_id) OR public.is_hr(auth.uid()));
CREATE POLICY "goal write own" ON public.goals FOR ALL TO authenticated
  USING (employee_id = public.my_employee_id() OR public.manages(employee_id) OR public.is_hr(auth.uid()))
  WITH CHECK (employee_id = public.my_employee_id() OR public.manages(employee_id) OR public.is_hr(auth.uid()));

-- New signups get an employee record + employee role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.employees (user_id, full_name, email, job_title, hire_date)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email, 'New hire', current_date)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
