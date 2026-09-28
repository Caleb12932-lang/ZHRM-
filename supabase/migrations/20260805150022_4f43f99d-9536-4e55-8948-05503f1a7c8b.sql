REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_hr(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_employee_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.manages(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
INSERT INTO public.departments (name, description) VALUES
  ('Engineering','Product development and platform engineering'),
  ('People & Culture','HR operations, hiring and employee experience'),
  ('Finance','Payroll, accounting and financial planning'),
  ('Sales','Revenue, partnerships and account management'),
  ('Operations','Facilities, logistics and internal operations')
ON CONFLICT (name) DO NOTHING;