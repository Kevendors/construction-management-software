-- ============================================================================
-- 0048_item_master_categories_and_headings.sql — tidy the saved Master List
-- ----------------------------------------------------------------------------
-- Data cleanup, not schema.
--
-- 1. Section headings saved as items. The quotation builder saves every typed
--    line into org_item_master, so BOQ section titles from the Royal Plaza
--    quote ("BASEMENT WORK", "SURROUNDING PAVER AREA", ...) became pickable
--    "items" with no description or rate. They are removed here by exact
--    heading text (short rows only, so a real item that merely starts with
--    the same words is never touched).
--
-- 2. Categories. Every saved item was filed under 'Civil & Misc'. Each row
--    still in 'Civil & Misc' is moved to the matching built-in category
--    (Waterproofing, Structural Repair, Civil & RCC, Painting, ...) by
--    keyword. Rows that match nothing stay in 'Civil & Misc'. Rows someone
--    already filed in another category are left alone.
--    The keyword rules were checked against all 196 items in migrations
--    0043-0046 before writing this file.
--
-- Historical quotations/invoices are NOT edited -- they keep their own text.
--
-- PREVIEW FIRST (optional) -- run this alone to see what step 1 will delete:
--   select name from public.org_item_master
--   where length(name) < 120 and lower(btrim(name)) like any (array[ <same list as below> ]);
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ============================================================================

-- Safety backup of every row as it stands now.
create table if not exists public.org_item_master_backup_20261026 as
  select * from public.org_item_master;

-- 1. Remove section headings that were saved as items.
delete from public.org_item_master
where length(name) < 120
  and lower(btrim(name)) like any (array[
    'basement work',
    'surrounding paver area',
    'surrounding area common toilet',
    'extra items',
    'internal office painting work%',
    'lift lobby & staircase wall%',
    'a wing 2nd,3rd & 4th floor pantry & toilet finishing work%',
    'internal plumbing work for toilet & pantry%',
    'internal marble counter and tiling in toilet%',
    'internal electrical work for toilet & pantry%',
    'internal office fire fighting sleeves micro concrete work%',
    'electrical meter room renovation work%',
    'electrical work entrance lobby%',
    'electrical work building surrounding area%',
    'electrical work main entry gate%',
    'electrical panel shifting to a wing%',
    'building signages a & b wing%'
  ]);

-- 2. File 'Civil & Misc' items under their proper category.
update public.org_item_master m
set
  category = case
    when t.s like '%waterproof%' or t.s like '%water proof%'
      then 'Waterproofing'
    when t.s like '%micro concrete%' or t.s like '%microconcrete%' or t.s like '%micro-concret%' or t.s like '%chipping%'
      then 'Structural Repair'
    when t.s like '%scaffold%' or t.s like '%supervision%' or t.s like '%consultancy%'
      then 'Site & Services'
    when t.s like '%rust%' or t.s like '%injection nipple%' or t.s like '%nitozinc%'
      then 'Structural Repair'
    when t.s like '%jet water wash%' or t.s like '%surface cleaning%' or t.s like '%brush bond%' or t.s like '%conplast%'
      then 'Waterproofing'
    when t.s like '%concealed plumbing%' or t.s like '%pvc waste line%'
      then 'MEP'
    when t.s like '%false ceiling%'
      then 'Ceiling & Partition'
    when t.s like '% roofing%' or t.s like '%aluminium frame cabin%'
      then 'Facade & Metal'
    when t.s like '%fly ash%' or t.s like '%brickwork cabin%' or t.s like '%civil work%' or t.s like '%reinforcement%' or t.s like '%rmc %'
      then 'Civil & RCC'
    when t.s like '%chair%' or t.s like '% table %' or t.s like '% tables%' or t.s like '%furniture%' or t.s like '%vanity%' or t.s like '%mandir%' or t.s like '%tv panel%' or t.s like '%tv unit%'
      then 'Carpentry & Interiors'
    when t.s like '%cubicle%'
      then 'Doors & Sanitary'
    when t.s like '%gas refill%' or t.s like '%gas top%' or t.s like '%split ac%' or t.s like '%cassette ac%' or t.s like '%ductable%' or t.s like '%freezer%' or t.s like '%cold room%' or t.s like '% ac %' or t.s like '%a.c.%' or t.s like '%hvac%' or t.s like '%air condition%' or t.s like '%ahu%'
      then 'HVAC & Refrigeration'
    when t.s like '%waterproof%' or t.s like '%water proof%' or t.s like '%membrane%' or t.s like '%pidifin%' or t.s like '%fastflex%' or t.s like '%fast flex%' or t.s like '%roof seal%' or t.s like '%krystalline%' or t.s like '%crystalline%' or t.s like '%coba%' or t.s like '%injection%' or t.s like '%leak%' or t.s like '%seepage%' or t.s like '% app %' or t.s like '%torch%' or t.s like '%geotextile%' or t.s like '%geo textile%' or t.s like '% urp%' or t.s like '%pidicrete%' or t.s like '%anti carbon%' or t.s like '%anti-carbon%' or t.s like '%fillet%' or t.s like '%watta%'
      then 'Waterproofing'
    when t.s like '%cfrp%' or t.s like '%carbon fib%' or t.s like '%carbon wrap%' or t.s like '%glass fib%' or t.s like '%fibre wrap%' or t.s like '%fiber wrap%' or t.s like '%laminate hexacure%' or t.s like '%hexacure%' or t.s like '%shear key%' or t.s like '%shear anchor%' or t.s like '%jacketing%'
      then 'Structural Strengthening'
    when t.s like '%micro concrete%' or t.s like '%microconcrete%' or t.s like '%rust%' or t.s like '%corros%' or t.s like '%chipping%' or t.s like '%polymer modified%' or t.s like '%polymer-modified%' or t.s like '%sbr%' or t.s like '%conbextra%' or t.s like '%renderoc%' or t.s like '%rendroc%' or t.s like '%nitobond%' or t.s like '%nito bond%' or t.s like '%bond coat%' or t.s like '%honeycomb%' or t.s like '%re-strength%' or t.s like '%restrength%' or t.s like '%repair mortar%' or t.s like '%hammer test%' or t.s like '%core cutting%' or t.s like '%anchor%'
      then 'Structural Repair'
    when t.s like '%paint%' or t.s like '%putty%' or t.s like '%distemper%' or t.s like '%primer%' or t.s like '%emulsion%' or t.s like '%texture%' or t.s like '%machine polish%' or t.s like '%duco%' or t.s like '%enamel%' or t.s like '%white wash%' or t.s like '%whitewash%'
      then 'Painting'
    when t.s like '%tile%' or t.s like '%kota%' or t.s like '%marble%' or t.s like '%granite%' or t.s like '%epoxy%' or t.s like '%flooring%' or t.s like '%paver%' or t.s like '%vitrified%' or t.s like '%stone%' or t.s like '%skirting%' or t.s like '%mosaic%' or t.s like '%dado%' or t.s like '%grout%'
      then 'Tiling & Flooring'
    when t.s like '%ceiling%' or t.s like '%gypsum%' or t.s like '%pop %' or t.s like '%p.o.p%' or t.s like '%partition%' or t.s like '%cornice%' or t.s like '%pvc panel%' or t.s like '%wall panel%'
      then 'Ceiling & Partition'
    when t.s like '%door%' or t.s like '%wc%' or t.s like '%washbasin%' or t.s like '%wash basin%' or t.s like '%urinal%' or t.s like '%sanitary%' or t.s like '%faucet%' or t.s like '% tap %' or t.s like '% taps%' or t.s like '%cistern%' or t.s like '%commode%' or t.s like '%mirror%' or t.s like '%chamber cover%'
      then 'Doors & Sanitary'
    when t.s like '%electrical%' or t.s like '%wiring%' or t.s like '%light%' or t.s like '%plumbing%' or t.s like '%pipe%' or t.s like '%cable%' or t.s like '% db %' or t.s like '%panel board%' or t.s like '%conduit%' or t.s like '%switch%' or t.s like '%fire fight%' or t.s like '%drain line%'
      then 'MEP'
    when t.s like '% ply%' or t.s like '%plywood%' or t.s like '%veneer%' or t.s like '%laminate%' or t.s like '%wardrobe%' or t.s like '%kitchen%' or t.s like '%carpent%' or t.s like '%furniture%' or t.s like '%chair%' or t.s like '%table%' or t.s like '%window%' or t.s like '%wooden%' or t.s like '%joinery%' or t.s like '%designing work%' or t.s like '%drawings%'
      then 'Carpentry & Interiors'
    when t.s like '%acp%' or t.s like '%cladding%' or t.s like '%curtain wall%' or t.s like '%aluminium%' or t.s like '%aluminum%' or t.s like '% ms %' or t.s like '%m.s.%' or t.s like '%steel structure%' or t.s like '%structural steel%' or t.s like '%truss%' or t.s like '%railing%' or t.s like '%grill%' or t.s like '%sheet%' or t.s like '%patra%' or t.s like '%fabricat%' or t.s like '%welding%'
      then 'Facade & Metal'
    when t.s like '%bitumin%' or t.s like '%bitumen%' or t.s like '%road%' or t.s like '%macadam%' or t.s like '%tack coat%' or t.s like '%kerb%'
      then 'Road Work'
    when t.s like '%rcc%' or t.s like '%pcc%' or t.s like '%concrete%' or t.s like '%rmc%' or t.s like '%shuttering%' or t.s like '%centering%' or t.s like '%reinforcement%' or t.s like '%tmt%' or t.s like '%brick%' or t.s like '%block%' or t.s like '%plaster%' or t.s like '%masonry%' or t.s like '%excavat%' or t.s like '%earth%' or t.s like '%screed%' or t.s like '%footing%' or t.s like '%slab%' or t.s like '%column%' or t.s like '%beam%' or t.s like '%cement%' or t.s like '%aac%' or t.s like '%lintel%' or t.s like '%dismantl%' or t.s like '%demoli%' or t.s like '%breaking%'
      then 'Civil & RCC'
    when t.s like '%scaffold%' or t.s like '%barricad%' or t.s like '%supervision%' or t.s like '%consultan%' or t.s like '%sampling%' or t.s like '%debris%' or t.s like '%malba%' or t.s like '%malwa%' or t.s like '%disposal%' or t.s like '%dump%' or t.s like '%amc%'
      then 'Site & Services'
    when t.s like '%clean%'
      then 'Cleaning'
    else category
  end
from (
  select id, ' ' || lower(regexp_replace(name, '[\r\n]+', ' ', 'g')) || ' ' as s
  from public.org_item_master
) t
where t.id = m.id
  and m.category = 'Civil & Misc';

-- ----------------------------------------------------------------------------
-- ROLLBACK (restores categories and the deleted heading rows):
--   delete from public.org_item_master;
--   insert into public.org_item_master select * from public.org_item_master_backup_20261026;
-- (Only safe if no new items were saved after this migration ran.)
-- ----------------------------------------------------------------------------
