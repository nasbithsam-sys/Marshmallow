CREATE TABLE IF NOT EXISTS public.quo_number_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id UUID NOT NULL UNIQUE REFERENCES public.quo_phone_numbers(id) ON DELETE CASCADE,
  label_override TEXT,
  emoji TEXT NOT NULL DEFAULT 'Q',
  hidden BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 9999,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quo_pinned_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  pinned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quo_number_preferences_hidden_sort
  ON public.quo_number_preferences(hidden, sort_order);

CREATE INDEX IF NOT EXISTS idx_quo_pinned_conversations_sort
  ON public.quo_pinned_conversations(sort_order, created_at);

ALTER TABLE public.quo_number_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_pinned_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read quo number preferences" ON public.quo_number_preferences;
CREATE POLICY "Admins read quo number preferences"
  ON public.quo_number_preferences FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage quo number preferences" ON public.quo_number_preferences;
CREATE POLICY "Admins manage quo number preferences"
  ON public.quo_number_preferences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins read quo pinned conversations" ON public.quo_pinned_conversations;
CREATE POLICY "Admins read quo pinned conversations"
  ON public.quo_pinned_conversations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage quo pinned conversations" ON public.quo_pinned_conversations;
CREATE POLICY "Admins manage quo pinned conversations"
  ON public.quo_pinned_conversations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.enforce_quo_pinned_conversation_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.quo_pinned_conversations) >= 50 THEN
    RAISE EXCEPTION 'Pin limit reached. Unpin one chat before pinning another.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_quo_pinned_conversation_limit_trigger ON public.quo_pinned_conversations;
CREATE TRIGGER enforce_quo_pinned_conversation_limit_trigger
BEFORE INSERT ON public.quo_pinned_conversations
FOR EACH ROW EXECUTE FUNCTION public.enforce_quo_pinned_conversation_limit();

DROP TRIGGER IF EXISTS update_quo_number_preferences_modtime ON public.quo_number_preferences;
CREATE TRIGGER update_quo_number_preferences_modtime
BEFORE UPDATE ON public.quo_number_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

WITH defaults(phone_digits, label, emoji, sort_order) AS (
  VALUES
    ('13465949213', 'Mini Split', '✅', 10),
    ('19726324844', 'Max Mad', '🆕', 20),
    ('16693378803', 'JOC HOT TUB', '🛁', 30),
    ('19723626313', 'Dallas, Texas', '❤️', 40),
    ('18329816614', 'Exterior Painting Nationwide / TV Mounting', '🧶', 50),
    ('14243339932', 'BEVERLY HILLS 2', '❤️', 60),
    ('12393067796', 'NAPLES FLORIDA', '❤️', 70),
    ('13463537571', 'Sliding Door', '🇺🇸', 80),
    ('14697785063', 'Nationwide Christmas Lights', '🎯', 90),
    ('13463539245', 'Nationwide Drywall Patch Repair', '🛠️', 100),
    ('17372775713', 'Junk Removal Nationwide MIS', '🚧', 110),
    ('17866736371', 'Miami FB/ND Garage Door OP1', '🟢', 120),
    ('13465779242', 'Houston Facebook ND Garage Door OP1', '🚨', 130),
    ('16575716845', 'Orange County Handyman OP1', '🟠', 140),
    ('18582643190', 'San Diego Garage Door OP1', '🇦🇪', 150),
    ('17472988624', 'Los Angeles Appliance OP1', '🏙️', 160),
    ('14632098542', 'Indianapolis Handyman', '⚡', 170),
    ('18723287251', 'Chicago Facebook', '⭐', 180),
    ('18188149252', 'Los Angeles Facebook OP1', '🇭🇹', 190),
    ('12819426479', 'Houston Handyman OP1', '🚨', 200),
    ('14708232133', 'Atlanta Georgia Appliance Repair / GD', '📱', 210),
    ('14709448210', 'Atlanta Georgia Handyman', '📱', 220),
    ('12132779445', 'LOS ANGELES GARAGE DOOR / CLEANING / PLUMBING', 'LA', 230),
    ('16613628754', 'Santa Clarita Handyman', '🏖️', 240),
    ('16572230626', 'Orange County Appliance Repair', '🟠', 250),
    ('18322097989', 'Houston Handyman', '🚨', 260),
    ('12014489324', 'New Jersey Handyman', '🌉', 270),
    ('19542396751', 'Miami Appliance Repair', '🟢', 280),
    ('15614646940', 'Miami Handyman', '🟢', 290),
    ('18722787204', 'Chicago Handyman', '⭐', 300),
    ('19292983346', 'New York Handyman', '🗽', 310),
    ('17374027035', 'Austin Handyman N/FB', '🇦🇺', 320),
    ('16692366322', 'San Jose Appliance Repair', '🇳🇴', 330),
    ('16692026712', 'San Jose Handyman', '🇳🇴', 340),
    ('16822049388', 'Nationwide Plumbing FB / Nationwide Handyman', '⚡', 350),
    ('17475887812', 'Technicians Communications (NEW)', '🌟', 360),
    ('12133192404', 'Los Angeles Handyman FB', 'LA', 370),
    ('18582890634', 'San Diego - Appliance Repair', '🇦🇪', 380),
    ('16193049048', 'San Diego - Handyman', '🇦🇪', 390),
    ('12134718651', 'Los Angeles - Handyman', 'LA', 400),
    ('13464060053', 'Appliance Repair Nationwide MIS', '🖨️', 410),
    ('13462263895', 'Garage Door NATIONWIDE MIS', '🚚', 420),
    ('14697188444', 'Dallas Garage Door', '🤠', 430)
)
INSERT INTO public.quo_number_preferences (phone_number_id, label_override, emoji, hidden, sort_order)
SELECT qpn.id, defaults.label, defaults.emoji, false, defaults.sort_order
FROM defaults
JOIN public.quo_phone_numbers qpn
  ON right(regexp_replace(coalesce(qpn.number, qpn.display_number, qpn.quo_phone_number_id), '\D', '', 'g'), 10)
   = right(defaults.phone_digits, 10)
ON CONFLICT (phone_number_id) DO UPDATE
SET
  label_override = coalesce(public.quo_number_preferences.label_override, excluded.label_override),
  emoji = coalesce(nullif(public.quo_number_preferences.emoji, 'Q'), excluded.emoji),
  sort_order = least(public.quo_number_preferences.sort_order, excluded.sort_order),
  updated_at = now();
