-- Seed: the kinds of itinerary segment the app knows how to draw. `leaf` picks
-- the timeline glyph family; lodging/transport drive the reconcile rules.
insert into public.travel_segment_types (code, label, is_extractable, is_lodging, is_transport, leaf, position) values
  ('flight',     'Flight',           true,  false, true,  'wing',    10),
  ('train',      'Train',            true,  false, true,  'blade',   20),
  ('ferry',      'Ferry',            true,  false, true,  'blade',   30),
  ('bus',        'Coach',            true,  false, true,  'blade',   40),
  ('car_hire',   'Car hire',         true,  false, true,  'lobed',   50),
  ('hotel',      'Hotel',            true,  true,  false, 'ovate',   60),
  ('apartment',  'Apartment',        true,  true,  false, 'ovate',   70),
  ('meeting',    'Meeting',          false, false, false, 'generic', 80),
  ('activity',   'Activity',         false, false, false, 'generic', 90),
  ('restaurant', 'Restaurant',       false, false, false, 'generic', 100),
  ('visa',       'Visa appointment', false, false, false, 'generic', 110),
  ('note',       'Note',             false, false, false, 'generic', 120)
on conflict (code) do update
  set label = excluded.label,
      is_extractable = excluded.is_extractable,
      is_lodging = excluded.is_lodging,
      is_transport = excluded.is_transport,
      leaf = excluded.leaf,
      position = excluded.position;
