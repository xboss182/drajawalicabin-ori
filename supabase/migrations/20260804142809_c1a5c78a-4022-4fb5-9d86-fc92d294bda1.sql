CREATE TABLE public.store_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_bm text NOT NULL,
  description_en text,
  description_bm text,
  price numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'per stay',
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_items TO authenticated;
GRANT ALL ON public.store_items TO service_role;

ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store items readable by all"
  ON public.store_items FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage store items"
  ON public.store_items FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER store_items_updated_at
  BEFORE UPDATE ON public.store_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.store_items (name_en, name_bm, description_en, description_bm, price, unit, display_order) VALUES
  ('BBQ pit set', 'Set BBQ', 'Pit, grill and charcoal at the riverside pavilion.', 'Pit, panggangan dan arang di pavilion tepi sungai.', 50, 'per stay', 1),
  ('Extra mattress', 'Tilam tambahan', 'Single mattress with pillow and sheet.', 'Tilam single dengan bantal dan cadar.', 30, 'per night', 2),
  ('Extra comforter', 'Selimut tambahan', 'Warm comforter for one guest.', 'Selimut tebal untuk seorang tetamu.', 20, 'per night', 3),
  ('Late check-out (per hour)', 'Daftar keluar lewat (sejam)', 'Past 12:00 PM, subject to availability.', 'Selepas 12:00 tengah hari, tertakluk kepada kekosongan.', 10, 'per hour', 4);