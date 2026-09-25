ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_reporting_manager_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_reporting_manager_id_fkey
  FOREIGN KEY (reporting_manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;