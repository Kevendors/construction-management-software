-- ============================================================================
-- 0044_item_master_cleanup_2.sql — resolve the 40-group lookalike review list
-- ----------------------------------------------------------------------------
-- Follow-up to 0043. Each of the 40 "needs a human decision" groups from the
-- item-master review was resolved per the user's explicit confirmation:
--   - Genuine duplicates (same item, reworded) are merged into one entry.
--   - Lookalikes that are actually different items (different TMT bar sizes,
--     different AMC contract years, different trades, different furniture,
--     etc.) are added as their own separate entries -- never merged.
--   - A few pairs were one complete description and one that stopped
--     mid-sentence (a copy-paste artifact) -- only the complete one is kept.
--   - The B1 AHU/IT room wall-waterproofing pair is intentionally generified
--     into ONE reusable "Wall Waterproofing Treatment" methodology with the
--     room name removed -- the actual case this whole effort was about.
--   - Plain section/scope headers ("SURROUNDING PAVER AREA", "INTERNAL OFFICE
--     PAINTING WORK...", etc.) are deliberately NOT added -- they aren't
--     priced, reusable catalog items, just quotation section labels.
-- Historical quotations/invoices are NOT edited -- they stay exactly as sent.
-- ============================================================================

insert into public.org_item_master (org_id, name, category, unit, uses_sqft)
select (select id from public.orgs order by created_at limit 1), v.name, v.category, v.unit, v.uses_sqft
from (values
  ($IM$Excavation in soil: From average ground level to 3 mtrs below GL$IM$, 'Civil & Misc', 'SQM', false),
  ($IM$Excavation in soil: From 3 mtrs to 6 mtrs below$IM$, 'Civil & Misc', 'SQM', false),
  ($IM$Reinforcement: From 3 to 6 mtrs below (fabrication & placing) include steel base price 60rs$IM$, 'Civil & Misc', 'MT', false),
  ($IM$RCC (M25): From 3 mtrs to 6 mtrs below$IM$, 'Civil & Misc', 'SQM', false),
  ($IM$Shuttering: From 3 mtrs to 6 mtrs below$IM$, 'Civil & Misc', 'SQM', false),
  ($IM$RMC (M25): From 3 mtrs to 6 mtrs below$IM$, 'Civil & Misc', 'CUM', false),
  ($IM$TMT BAR 08 MM$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$TMT BAR 10 MM$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$TMT BAR 16 MM$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$TMT BAR 20 MM$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$TMT BAR 25 MM$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Apply Injection Grouting: Walls &raft with injection grouting of RCC structural
members, horizontal as well as vertical by fixing
10mm nominal dia PVC nozzle 100mm long by
drilling / chiseling & fixing of nozzles at 1 meter c/c.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Apply 2K Pidifin: 2K Pidifin: A two component cementitious & acrylic
flexible waterproofing & protective coating composed of
best quality portal and cement, properly selected &
graded aggregates, additives & acrylic emulsion polymer
as a binder. It is applied to waterproof and protect
concrete and similar structures.
(Product use: Dr. Fixit / Bostik / Perma)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Fast Flex: Dr. Fixit Fast Flex is a two-component
cementitious & acrylic flexible
waterproofing & protective coating
composed of best quality portal and
cement, properly selected & graded
aggregates, additives & acrylic emulsion
polymer as a binder. It is applied to
waterproof and protect concrete and
similar structures. (Product use: Dr. Fixit /
Bostik / Perma)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Re-plaster: 12 mm thick protective plaster 1:4 (1cement: 4 coarse sand) over treated surface etc. complete With waterproofing compound$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Roof waterproofing treatment AMC 1 year$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Roof waterproofing treatment AMC 2 year$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Roof waterproofing treatment AMC 3rd year$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Roof waterproofing treatment AMC 4th year$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Roof waterproofing treatment AMC 5th year$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing and fixing a scaffolding system (cup lock type) on the exterior side, height up to the story made with 40 mm dia M.S. tube 1.5 m centre to centre, horizontal & vertical tubes joining with cup & lock system with M.S. tubes, M.S. tube challies, M.S. clamps and M.S. staircase system in the scaffolding for working platform etc. and maintaining it in a serviceable condition for the required duration as approved and removing it there after .The scaffolding system shall be stiffened with bracings, runners, connection with the building, etc wherever required for inspection of work at required locations with essential safety features for the workmen etc. complete as per directions and approval of Engineer incharge. If required, Nito Bond EP (concrete bonding agent) shall be applied for proper bonding. If required, shot blasting shall be carried out to prepare the surface. All necessary materials and methodologies shall be applied as required to resolve the site issues effectively.$IM$, 'Civil & Misc', 'RMT', false),
  ($IM$**Wall Waterproofing Treatment**

Removal of all plaster and loose particles
Making a V-shaped groove at the construction joint and repairing it with SBR mortar
Injection grouting treatment
Fastflex coating, 2 layers$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Apply APP Membrane 3mm
1. Apply bitumen primer 1 coat Sq.ft. 26000 45 11,70,000
2. Apply 3mm APP membrane APPLICATION
Dr. Fixit Torch shield AM membranes are applied by  torch-on application using a standard roofer’s torch. The membranes should be heated carefully ensuring the PE film on the underside is completely removed as work proceeds and to ensure adequate adhesion to the substrate. All laps should be properly secured in its lap joints, during application ensuring that a continuous 5 mm bead of bitumen is extruded from all laps. Side laps must follow the manufactured mineral free selvedge. In any case, side laps should be a minimum of 100mm, with end laps of a minimum of 150 mm, when not using the granule-free roll end.
(Product use: Dr. Fixit / STP)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Apply APP Membrane 2mm 1. Apply bitumen primer 1 coat Sq.ft. 26000 45 11,70,000 2. Apply 2mm APP membrane APPLICATION Dr. Fixit Torch shield AM membranes are applied by torch-on application using a standard roofer’s torch. The membranes should be heated carefully ensuring the PE film on the underside is completely removed as work proceeds and to ensure adequate adhesion to the substrate. All laps should be properly secured in its lap joints, during application ensuring that a continuous 5 mm bead of bitumen is extruded from all laps. Side laps must follow the manufactured mineral free selvedge. In any case, side laps should be a minimum of 100mm, with end laps of a minimum of 150 mm, when not using the granule-free roll end. (Product use: Dr. Fixit / STP)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Oil Paint Window & Staircase Railing / fire pipe: Scrapping the wooden window then Applying One Coats oil base Primer & One Coat Putty Then Two Coats of Oil Paint inside window A & B wing.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$WALL & CEILING: Scrapping Crack Filling then the applying Two Primer, Two Coats of Putty and Two coats of PLASTIC PAINT A & B wing.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Chipping of unsound/weak concrete material from
slabs, beams,columns etc. with manual Chisel and/ or
by standard power driven percussion type or of
approved make including tapering of all edges, making
square shoulders of cavities including cleaning the
exposed concrete surface and reinforcement with wire
brushes etc. and disposal of debris for all lead and lifts
all complete as per direction of Engineer-In- Charge ,25
mm average
thickness$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Chipping of unsound/weak concrete material from
slabs, beams,columns etc. with manual Chisel and/ or
by standard power driven percussion type or of
approved make including tapering of all edges, making
square shoulders of cavities including cleaning the
exposed concrete surface and reinforcement with wire
brushes etc. and disposal of debris for all lead and lifts
all complete as per direction of Engineer-In- Charge 50
mm average
thickness$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$**Cable Waterproofing Treatment**

Removal of old plaster and loose particles
Making grooves around all pipes and inlets
Application of MS bonding agent to concrete, with injection grouting
Waterproofing of the cable area with PU foam treatment$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$**Exhaust Room Waterproofing Treatment**

Removal of old plaster and loose particles near the ducting inlet area and concrete
Application of MS bonding agent
Injection grouting treatment
Application of Pidifin 2K coating$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Surface Repairing with SBR Mortar$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Repairing with SBR mortar with micro-concreting repair$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Jet Water Wash: Cleaning of the surface using a high-pressure water jet pump. The process will remove dirt, mud, debris and loose particles from the surface.$IM$, 'Civil & Misc', 'RMT', false),
  ($IM$**Surface Cleaning**
Thorough cleaning of the surface using wire brush and high-pressure jet water wash to remove dirt, dust and loose material.$IM$, 'Civil & Misc', 'MT', false),
  ($IM$Fixing: Providing and fixing new gypsum false ceiling with GI framework,
including jointing and finishing.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Painting: Providing and applying putty and paint on the new gypsum
ceiling, including surface preparation and complete finishing.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Meter area wiring / Cabling/ Bulbs / Meter Room Ply Bourd Panelling / Panels, Meter room, and Common DB installation. / Testing, Commissioning and Handover$IM$, 'Civil & Misc', 'LUMPSUM', false),
  ($IM$Common area wiring / Cabling/ Bulbs / DB, Switch Plates, Switch Fixing / Panels, Meter room, and Common DB installation. / Testing, Commissioning and Handover$IM$, 'Civil & Misc', 'LUMPSUM', false),
  ($IM$SS Water Tap 4 Inch$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$SS Water Tap 6 Inch$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Nitobond EP (4 Ltr)$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Brush Bond RFX (20.88 KG)$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Providing, mixing and applying SBR polymer (of
approved make) modified Cement mortar in
proportion of 1:4 (1 cement: 4 graded coarse sand
with polymer minimum 2% by wt. of cement
used) as per specifications and directions of
Engineer-in-charge. Note: Measurement and
payment: The pre- measurement of thickness shall
be done just after the surface preparation is
completed and Payment under this item shall be
made only after proper wet curing has been done
and surface has been satisfactorily evaluated by
sounding / tapping with a blunt metal
instrument and/or the 75mm size cube crushing
strength at the end of 28 days to be not less
than
30N/mm2), 25 mm average thickness in 2 layers.$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Cleaning of reinforcement from rust from the
reinforcing bars complete to give it a total rust free
steel surface by using alkaline chemical rust remover
of approved make of BASF/ SIKA/FOSROC
make and to be applied with paint brush as
per manufacturer's specifications including
removing loose particles after 24 hours of its
application with wire brush and thoroughly washing
with water and allowing it to dry, all complete as
per direction of Engineer-In-Charge. (Note:
Chipping area shall be measured for payment
purpose)$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Providing and applying anticorrosive treatment to
exposed structural reinforcement to two coats of
approved make of BASF/ SIKA/FOSROC make and to
be applied with paint brush with time interval of
minimum 8-10 hours between each coat after the
application of two coats of alkaline rust
converting primer. (The measurement shall be
Sqm of repaired / treated concrete surface area.)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing and inserting 12mm dia PVC
perforated injection nipple in honey comb area and
along crack line including drilling of holes of
required diametre (20mm to 30mm) up to depth
from 30mm to 80mm at required spacing and
making the hole & crack dust free by blowing
compressed air, sealing the distance between
injection nipple with adhesive chemical of
approved make and allow it to cure
complete as per direction of Engineer In-Charge.$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Applying Epoxy Bond Coat Epoxy Bond Coat prior
to Micro concrete for long open time of BASF/
SIKA/FOSROC make by using epoxy bonding agent
of two component i.e. Base and Hardner of
approved make and brand like Concresive of
approved make having more open time all as
per manufacturer’s specifications and
recommendations complete.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing and placing pre-packed high
strength, free flow micro concrete repair depth
or more, excessively damaged areas of columns,
beams, chajjas etc internal / External with 25% by
weight of 10mm and down aggregate inclusive
of all labour, materials, equipment, curing etc
complete as per specifications and instructions of
Engineer in Charge but excluding
reinforcement, scaffolding and shuttering.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Replasting with SBR mortar smooth finishing if required re apply mesh/ fiber mesh:$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Designer Wooden Chair with Metal Hardware:
Custom-designed wooden chair with quality wood, metal hardware/fittings,
required fabrication, polishing, finishing and complete assembly as per
approved design.$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Designer Wooden Table with Metal Hardware:
Custom-designed wooden table with quality wood, metal hardware/fittings,
required fabrication, polishing, finishing and complete assembly as per
approved design.$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$**Rendroc SP40 (25 kg)**

Fosroc Renderoc SP40 – High-performance, cementitious, polymer-modified repair mortar designed for the repair and reinstatement of damaged or deteriorated concrete surfaces. Suitable for concrete patch repairs and structural repair applications, subject to the manufacturer's technical specifications.$IM$, 'Civil & Misc', 'KG', false),
  ($IM$**Fosroc Conbextra GP2 (25 kg) – Non-Shrink Cementitious Grout 
**
High-strength, free-flowing, non-shrink cementitious precision grout for grouting machine foundations, base plates, concrete voids, and anchoring bolts or other structural fixings. Supplied as a pre-packed dry powder requiring the addition of clean water before application. Suitable for grout gaps up to 100 mm, subject to application requirements and the manufacturer's technical datasheet.$IM$, 'Civil & Misc', 'KG', false),
  ($IM$Supply and installation of a premium 3-layer insulated roofing system comprising a top layer of high-quality color-coated galvanized steel roofing sheet, a middle layer of fiber mat insulation for effective thermal and acoustic insulation, and a bottom layer of galvanized steel sheet for added strength, durability, and a neat interior finish. The roofing system is designed to provide excellent protection against heat, rain, and corrosion while reducing noise and improving energy efficiency. The quotation includes the supply of all required materials, accessories, fasteners, and professional installation, ensuring a durable, weather-resistant, and long-lasting roofing solution suitable for industrial, commercial, warehouse, and residential applications.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Supply and installation of a premium 3-layer insulated roofing system comprising a top layer of high-quality color-coated galvanized steel roofing sheet, a middle layer of fiber mat insulation for effective thermal and acoustic insulation, and a bottom layer of galvanized steel sheet for added strength, durability, and a neat interior finish. The roofing system is designed to provide excellent protection against heat, rain, and corrosion while reducing noise and improving energy efficiency. The quotation includes the supply of all required materials, accessories, fasteners, and professional installation, ensuring a durable, weather-resistant, and long-lasting roofing solution suitable for industrial, commercial, warehouse, and residential applications. with 5 year warranty$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$PCC: 

a) include with waterproofing compound 

b) with cement neat paning

c)top layer with polymer coating one layer 

d) loading material, etc. 

Providing and laying Plain Cement Concrete (PCC) of specified grade using cement, coarse aggregate, and fine aggregate in the required proportion, including mixing, placing, leveling, compacting, finishing, and curing complete, as per drawings and site engineer's instructions.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Supply and construction of 1 brickwork cabin, including plastering on both sides, painting, ceiling work, and installation of wooden door and windows, complete as per the required specifications.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Supply and installation of 1 Aluminium Frame Cabin measuring 17 ft × 12 ft, including ceiling, windows, and door, complete as per the required specifications.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$**Vendor Monitoring and Supervision of Civil Works**
Structural consultancy, vendor monitoring, and supervision of civil works through 20 site visits by our Structural Engineers within a period of 2 months, including inspection of work progress, quality, and execution as per project requirements.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Fixing light 2x2 any(make)$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Fixing light 8" any (make)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing and fixing Lights 2x2 (Make: Crompton, Syska, Havells)$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Providing and fixing Lights 8" (Make: Crompton, Syska, Havells)$IM$, 'Civil & Misc', 'NOS', false)
) as v(name, category, unit, uses_sqft)
where not exists (
  select 1 from public.org_item_master m where lower(m.name) = lower(v.name)
);

-- ----------------------------------------------------------------------------
-- ROLLBACK: the 0043 backup table (org_item_master_backup_20261022) predates
-- this migration too, so the same restore works:
--   truncate public.org_item_master;
--   insert into public.org_item_master select * from public.org_item_master_backup_20261022;
-- ----------------------------------------------------------------------------
