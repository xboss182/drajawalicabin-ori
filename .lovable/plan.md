Remove the bracketed sleep-capacity text from the room card headings on the homepage.

## Changes

1. **src/lib/i18n.tsx**
   - Update English `t.stay.cabins` names:
     - `Queen Room (Sleeps 2)` → `Queen Room`
     - `Twin Room (Sleeps 2)` → `Twin Room`
     - `Family Room (Sleeps 4)` → `Family Room`
     - `Triple Room (Sleeps 3)` → `Triple Room`
   - Update Malay `t.stay.cabins` names to keep the bilingual cards consistent:
     - `Bilik Queen (Muat 2 orang)` → `Bilik Queen`
     - `Bilik Twin (Muat 2 orang)` → `Bilik Twin`
     - `Bilik Family (Muat 4 orang)` → `Bilik Family`
     - `Bilik Triple (Muat 3 orang)` → `Bilik Triple`

2. **Homepage cards**
   - The capacity badges (`Sleeps 2`, `Muat 2 orang`, etc.) remain unchanged as separate badges on the cards.

3. **Homepage dropdown**
   - No change needed; the dropdown already shows the requested labels without the bracketed suffixes.

## Verification

- Build the project and confirm the homepage card headings read Queen Room, Twin Room, Family Room, Triple Room.
- Confirm the capacity badges are still visible.