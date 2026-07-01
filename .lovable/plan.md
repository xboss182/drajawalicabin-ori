Update the homepage room display cards and the availability-search room-type dropdown to match the new naming.

## Changes

1. **src/lib/i18n.tsx**
   - Update English `t.stay.cabins` names:
     - `Deluxe Queen` → `Queen Room (Sleeps 2)`
     - `Deluxe Twin` → `Twin Room (Sleeps 2)`
     - `Family Suite` → `Family Room (Sleeps 4)`
     - `Triple Suite` → `Triple Room (Sleeps 3)`
   - Update Malay `t.stay.cabins` names to keep the bilingual cards consistent:
     - `Deluxe Queen` → `Bilik Queen (Muat 2 orang)`
     - `Deluxe Twin` → `Bilik Twin (Muat 2 orang)`
     - `Family Suite` → `Bilik Family (Muat 4 orang)`
     - `Triple Suite` → `Bilik Triple (Muat 3 orang)`

2. **src/routes/index.tsx**
   - Change the room-type dropdown from a simple string array to a value/label mapping so the menu displays the new friendly labels while the form still submits the original database identifiers (`Deluxe Queen`, `Deluxe Twin`, `Family Suite`, `Triple Suite`) to the `/book` route.
   - Dropdown display order:
     - Any cabin
     - Queen Room
     - Twin Room
     - Family Room
     - Triple Room

## Verification

- Build the project and check the homepage renders the new card headings and dropdown items.
- Confirm selecting a room from the dropdown and submitting the search still pre-selects the correct room on the `/book` page.