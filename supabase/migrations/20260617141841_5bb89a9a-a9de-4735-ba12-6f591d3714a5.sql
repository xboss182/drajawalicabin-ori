ALTER TABLE public.booking_requests
  ADD COLUMN relationship text,
  ADD COLUMN vehicle_type text,
  ADD COLUMN vehicle_number text,
  ADD COLUMN num_rooms integer DEFAULT 1;

-- Note: GRANT not needed since we're ALTERing an existing table that already has grants and policies