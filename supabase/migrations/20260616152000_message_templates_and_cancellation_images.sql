CREATE TABLE IF NOT EXISTS public.message_templates (
  key TEXT PRIMARY KEY,
  template TEXT NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read message templates"
  ON public.message_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage message templates"
  ON public.message_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS message_templates_set_updated_at ON public.message_templates;
CREATE TRIGGER message_templates_set_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.message_templates (key, template)
VALUES
  (
    'technician_message',
    '*Customer #{customer_number}*

Customer Name: {customer_name}
Customer Number: {customer_phone}
Customer Address: {customer_address}
Service Details: {service_details}

Job Scheduled for: {schedule}
{reference_line}'
  ),
  (
    'technician_reminder',
    'Hi {tech_name}, This is the Automated Reminder, You have to visit the following customer today between {schedule_time}, Please Text back by "Yes" so we can update our system that you will head over

Customer Name: {customer_name}
Customer Number: {customer_phone}
Customer Address: {customer_address}'
  )
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.lead_cancellation_requests
  ADD COLUMN IF NOT EXISTS proof_image_path TEXT;
