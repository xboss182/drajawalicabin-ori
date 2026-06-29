ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS booking_group_id uuid;

UPDATE public.booking_requests
  SET booking_group_id = id
  WHERE booking_group_id IS NULL;

ALTER TABLE public.booking_requests
  ALTER COLUMN booking_group_id SET NOT NULL,
  ALTER COLUMN booking_group_id SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS booking_requests_group_idx
  ON public.booking_requests (booking_group_id);