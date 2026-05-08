-- ═══════════════════════════════════════════════════════════════
-- SmartDrop Schema Updates — Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Driver role enum (if not already added)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'driver';

-- 1b. booking_status enum — add new transit statuses
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'on_the_way';

-- 2. driver_id column on bookings (if not already added)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Driver vehicle info on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_type  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plate_number  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_model TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_color TEXT;

-- 4. Ratings table
CREATE TABLE IF NOT EXISTS public.ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id),
  driver_id  UUID REFERENCES auth.users(id),
  rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can insert own ratings" ON public.ratings;
CREATE POLICY "users can insert own ratings" ON public.ratings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "authenticated can view ratings" ON public.ratings;
CREATE POLICY "authenticated can view ratings" ON public.ratings
  FOR SELECT TO authenticated USING (true);

-- 5. Platform settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read settings" ON public.platform_settings;
CREATE POLICY "authenticated can read settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "superadmin can manage settings" ON public.platform_settings;
CREATE POLICY "superadmin can manage settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'));

INSERT INTO public.platform_settings (key, value) VALUES
  ('commission_rate',    '15'),
  ('maintenance_mode',   'false'),
  ('platform_name',      'SmartDrop'),
  ('base_fare',          '30'),
  ('per_km_rate',        '8')
ON CONFLICT (key) DO NOTHING;

-- 6. RLS: drivers can view and update bookings
DROP POLICY IF EXISTS "drivers can view bookings" ON public.bookings;
CREATE POLICY "drivers can view bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'));

DROP POLICY IF EXISTS "drivers can update bookings" ON public.bookings;
CREATE POLICY "drivers can update bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'driver'));

-- 7. Driver accounts — insert if not exists, then upsert profiles/roles using real IDs
DO $$
DECLARE
  d1 uuid; d2 uuid; d3 uuid;
BEGIN
  -- Insert new accounts only if the email doesn't exist yet
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES
    (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'driver01@smartdrop.app', crypt('driver', gen_salt('bf')),
     now(),'{"provider":"email","providers":["email"]}','{}',false,now(),now(),'','','',''),
    (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'driver02@smartdrop.app', crypt('driver', gen_salt('bf')),
     now(),'{"provider":"email","providers":["email"]}','{}',false,now(),now(),'','','',''),
    (gen_random_uuid(),'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'driver03@smartdrop.app', crypt('driver', gen_salt('bf')),
     now(),'{"provider":"email","providers":["email"]}','{}',false,now(),now(),'','','','')
  ON CONFLICT DO NOTHING;

  -- Look up the real IDs (works whether just inserted or already existed)
  SELECT id INTO d1 FROM auth.users WHERE email = 'driver01@smartdrop.app';
  SELECT id INTO d2 FROM auth.users WHERE email = 'driver02@smartdrop.app';
  SELECT id INTO d3 FROM auth.users WHERE email = 'driver03@smartdrop.app';

  INSERT INTO public.profiles (user_id, display_name, email, username, is_active, vehicle_type, plate_number)
  VALUES
    (d1,'Driver 01','driver01@smartdrop.app','driver01',true,'Motorcycle','ABC-1234'),
    (d2,'Driver 02','driver02@smartdrop.app','driver02',true,'Motorcycle','DEF-5678'),
    (d3,'Driver 03','driver03@smartdrop.app','driver03',true,'Tricycle','GHI-9012')
  ON CONFLICT (user_id) DO NOTHING;

  DELETE FROM public.user_roles WHERE user_id IN (d1, d2, d3);
  INSERT INTO public.user_roles (user_id, role) VALUES
    (d1, 'driver'), (d2, 'driver'), (d3, 'driver')
  ON CONFLICT DO NOTHING;
END $$;

