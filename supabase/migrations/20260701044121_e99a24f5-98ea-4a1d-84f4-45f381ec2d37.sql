
UPDATE public.cabins SET name = 'Room 1 — Queen room'  WHERE name = 'Deluxe Queen 1';
UPDATE public.cabins SET name = 'Room 3 — Queen room'  WHERE name = 'Deluxe Queen 2';
UPDATE public.cabins SET name = 'Room 2 — Twin room'   WHERE name = 'Deluxe Twin 1';
UPDATE public.cabins SET name = 'Room 4 — Twin room'   WHERE name = 'Deluxe Twin 2';
UPDATE public.cabins SET name = 'Room 5 — Triple room' WHERE name = 'Triple Suite 1';
UPDATE public.cabins SET name = 'Room 6 — Family room' WHERE name = 'Family Suite 1';
UPDATE public.cabins SET name = 'Room 7 — Family room' WHERE name = 'Family Suite 2';

UPDATE public.cabins
SET name = 'Room 8 — Family room',
    cabin_type = 'Family',
    capacity = 4,
    weekday_rate = 165.00,
    weekend_rate = 176.00,
    school_holiday_rate = 198.00
WHERE name = 'Triple Suite 2';

UPDATE public.booking_requests br
SET room_type = 'Family'
FROM public.cabins c
WHERE br.cabin_id = c.id
  AND c.name = 'Room 8 — Family room'
  AND br.room_type = 'Triple';
