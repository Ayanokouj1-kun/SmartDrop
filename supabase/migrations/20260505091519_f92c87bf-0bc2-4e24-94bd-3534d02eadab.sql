-- Roles enum
CREATE TYPE public.app_role AS ENUM ('superadmin', 'admin', 'user');
CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','completed','cancelled','rejected');

-- Updated-at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User roles (separate table to avoid privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Security-definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Branches
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin assignments
CREATE TABLE public.admin_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(admin_id, branch_id)
);

CREATE OR REPLACE FUNCTION public.is_admin_of_branch(_user_id UUID, _branch_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_branches WHERE admin_id = _user_id AND branch_id = _branch_id)
$$;

-- Services
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  available_from TIME,
  available_to TIME,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  booking_date TIMESTAMPTZ NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bookings_user ON public.bookings(user_id);
CREATE INDEX idx_bookings_branch ON public.bookings(branch_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);

-- Global settings
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Auto-create profile + default user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "view profiles" ON public.profiles FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'superadmin'));

-- User roles
CREATE POLICY "view own roles or all if superadmin" ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "superadmin manage roles" ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- Branches
CREATE POLICY "view branches" ON public.branches FOR SELECT
USING (is_active OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "superadmin manage branches" ON public.branches FOR ALL
USING (public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- Admin branches
CREATE POLICY "view assignments" ON public.admin_branches FOR SELECT
USING (auth.uid() = admin_id OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "superadmin manage assignments" ON public.admin_branches FOR ALL
USING (public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- Services
CREATE POLICY "view services" ON public.services FOR SELECT
USING (is_active OR public.is_admin_of_branch(auth.uid(), branch_id) OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "manage services" ON public.services FOR ALL
USING (public.is_admin_of_branch(auth.uid(), branch_id) OR public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.is_admin_of_branch(auth.uid(), branch_id) OR public.has_role(auth.uid(),'superadmin'));

-- Bookings
CREATE POLICY "view bookings" ON public.bookings FOR SELECT
USING (auth.uid() = user_id OR public.is_admin_of_branch(auth.uid(), branch_id) OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "users create own bookings" ON public.bookings FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update bookings" ON public.bookings FOR UPDATE
USING (auth.uid() = user_id OR public.is_admin_of_branch(auth.uid(), branch_id) OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "superadmin delete bookings" ON public.bookings FOR DELETE
USING (public.has_role(auth.uid(),'superadmin'));

-- Settings
CREATE POLICY "view settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "superadmin manage settings" ON public.settings FOR ALL
USING (public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- Audit logs
CREATE POLICY "superadmin view audit logs" ON public.audit_logs FOR SELECT
USING (public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "actor inserts audit log" ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() = actor_id);

-- Seed default settings
INSERT INTO public.settings (key, value) VALUES
  ('booking_rules', '{"max_active_bookings_per_user": 5, "cancellation_window_hours": 24}'::jsonb),
  ('system', '{"name":"SmartDrop","support_email":"support@smartdrop.app"}'::jsonb);