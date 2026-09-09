-- notifications.read is nullable. A row with read = NULL counts as unread in the bell
-- (`!n.read`) but was never cleared by "mark all read", which filtered on read = false — a
-- badge that can never be dismissed. Every insert sets it explicitly today, so this closes a
-- latent hole rather than fixing live data.
UPDATE public.notifications SET read = false WHERE read IS NULL;

ALTER TABLE public.notifications ALTER COLUMN read SET DEFAULT false;
ALTER TABLE public.notifications ALTER COLUMN read SET NOT NULL;
