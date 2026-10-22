-- ============================================================================
-- 0045_item_master_132_review.sql — add the approved new Master List entries
-- ----------------------------------------------------------------------------
-- From the 132-entry review (Item Master Review doc). Per your own-judgment
-- instruction: every Category 1 (reusable methodology) and Category 2
-- (individual line item) entry is added, EXCEPT two flagged as likely
-- duplicates of existing master entries ("Malwa Removal" -- a spelling variant
-- of the existing "Malba Removal"; the short "Injection Grouting" summary --
-- likely redundant with the detailed Injection Grouting entry already merged).
-- Category 3 (13 section headings) and Category 4 (7 incomplete/error entries)
-- are NOT added -- they aren't real reusable catalog items.
-- Where the review flagged project-specific content (a floor number, a
-- baked-in quantity, "as already done in B wing"), the entry uses the
-- cleaned-up recommended name instead of the raw original text; everything
-- else is the original wording, unedited, per "preserve original technical
-- wording wherever possible."
-- Historical quotations/invoices are NOT edited -- they stay exactly as sent.
-- ============================================================================

insert into public.org_item_master (org_id, name, category, unit, uses_sqft)
select (select id from public.orgs order by created_at limit 1), v.name, v.category, v.unit, v.uses_sqft
from (values
  ($IM$Dismantling hard rock excavation using hydraulic breaker machinery, followed by hard rock extraction through punchering method to loosen, break, and remove rock efficiently for excavation and construction activities.$IM$, 'Civil & Misc', 'CUM', false),
  ($IM$Providing and laying design-mix RCC (M20/M25/M30) for slabs, beams, columns and footings, including pumping/placing, compaction, finishing and curing (shuttering & reinforcement separate unless specified).$IM$, 'Civil & Misc', 'CUM', false),
  ($IM$Texture / feature wall finish using premium materials, including surface preparation and application as per approved design.$IM$, 'Civil & Misc', 'SQFT', true),
  ($IM$Dr. Fixit Roof Seal single-component cold-applied waterproof coating in 3 coats, including surface preparation. Surface cleaning, repair of joints and tracks using Micro Concrete & SBR Mortar, followed by application of Roof Seal waterproofing in 3 coats, including a 5-year warranty.$IM$, 'Civil & Misc', 'SQFT', true),
  ($IM$Painting work executed as per the discussed scope and standards, including surface preparation, putty, primer and finish coats (a minimum area of 1000 sq.ft is required for execution).$IM$, 'Civil & Misc', 'SQFT', true),
  ($IM$Providing and applying waterproofing treatment to the lift pit, including surface preparation, cleaning, crack and honeycomb repair with polymer-modified repair mortar, sealing of construction joints, application of two coats of crystalline/cementitious waterproofing coating on the lift pit floor and walls as per the manufacturer's specifications, including all materials, labour, tools, scaffolding, curing, testing, and completion of the work to the satisfaction of the Engineer/Consultant.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing & applying proprietary box type water proofing for UG tanks , foundations, plinth, basements walls, rafts, lift pits etc. by approved waterproofing agency, using 25 mm thick Shahbad /Tandur blue stone or as directed by Project manager/consultant in base & cladding to walls from outside including required injection grouting if any all complete, as per approved method of manufacturer/proprietor to entire satisfaction of Project Manager. The 25 mm thick Shahbad stone/ Tandur blue stone to be laid by grouting and bedding with 20 mm thick in cement sand mortar mix 1:4 (1 cement: 4 sand) and protective screed over keyed surface (floor and walls) including 2% waterproofing compound by weight of cement; surface cured as per manufacturer's  specification and as approved by the  Project Manager. The rate shall be inclusive of the treatment of passive rock anchors and the provision of pressure release pipes at 3.0 m centre-to-centre spacing, as indicated in the drawings.  Cost to include grouting of wall,  scaffolding, curing, maintaining daily material consumption registers, etc., complete. The rate shall include ten-year guarantee in the proforma approved by the Project Manager for workmanship, quality of work & materials. (Makes of water proofing treatment materials -BASF, Sika, Fosroc,Pidilite or equivalent) (The rate shall include providing and fixing nozzeles where ever required and grouting the same with non shrink waterproofing compound. The rate includes all golias / watas made at junction of horizontal and vertical waterproofing and dewatering etc. complete)(Basements, lift pits etc).$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Dismantling the existing old Asbestos Cement (AC) roofing sheets, including carefully removing ridges, hips, gutters, hooks, bolts, nuts, and washers without damaging the supporting members; stacking the serviceable materials and disposing of the unserviceable materials as directed. Providing and fixing new Asbestos Cement (AC) corrugated roofing sheets of approved quality and thickness, including all necessary GI/J/L hooks, nuts, bitumen washers, limpet washers, overlaps, cutting, drilling, fixing, sealing, and all labour, tools and tackles, loading, unloading, transportation, all leads and lifts, and all incidental works complete. If any additional hardware is required, it shall be provided by the client. Accommodation, food, and electricity for the workforce shall also be provided by the client.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Civil Work for LED Panel Frame Installation$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Surface Cleaning And Repairing — Surface cleaning with wire brush/preparation, Prepare the surface thoroughly by cleaning, washing and removing dust, dirt, oil, grease and loose particles, surface cleaning with wirebrush and /with grinder$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Dr. Fixit Roofseal Select Top Coat is a single-component, insulating elastomeric waterproof coating designed for exposed (new and old) roof surfaces... fiber mesh reinforcement embedded within the coating at all critical areas...$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Steel reinforcement for R.C.C. work including straightening, cutting, bending, placing in position and binding all complete above plinth level — a) Thermo-Mechanically Treated bars of grade Fe-500 D or more$IM$, 'Civil & Misc', 'KG', false),
  ($IM$RCC Work (excl. centering/shuttering/reinforcement)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing and applying single-component PU (Polyurethane) waterproofing coating to the lift pit surface, including surface preparation, cleaning, crack/joint treatment, primer wherever required, and application of PU waterproofing coating as per manufacturer's specifications, complete in all respects.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Lift pit — Krystalline is composed of high quality cement, properly selected & graded inert aggregates, proprietary waterproofing active chemicals & additives... (Product use: Dr. Fixit / Bostik / Perma)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$3mm epoxy coating. A high-performance, solvent-free, two-component polyurethane-based elastomeric coating system, designed for durable waterproofing and protection of concrete, podiums, basements, and terrace slabs. Product used: Pidilite Asian Quality$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Designing work providing 3d and working drawings with 2 options for the entire flat$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Gypsum Board false ceiling : 
Providing & fixing at site plain Gypsum Board false ceiling
made out of 12.5 mm thick paper reinforced gypsum board
sheets to be fixed with main frame channels of size(80 mm x
26 mm x 0.5 mm) at every 450 mm c/c, intermediate
channels of size(15 mm x 45 mm x 0.9 mm) at every 1220 mm
c/c with perimeter channel 20 mm x 26 mm x 0.5
mm all along the wall shall be provided . The frame work to
be suspended with strap bolts as recommended using rail
plugs 12.5 mm dia x 35 mm long with 6 mm dia bolt and soffit
cleat. Ceiling surface is to paint with two coats of distemper
to get a smooth & even look, including the cost of hardware
fittings, all labour & materials.
(As per our designer )
cove and running design count as per running sq ft$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing and applying distemper paint and preparing the base for the same and applying 2 or more coats of paint complete$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Surface Preparation & SBR Mortar Repair: Dismantling of loose particles, cleaning and preparation of the roof/ceiling surface, followed by repairing of damaged portions using SBR-modified mortar for improved bonding and durability.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Deployment of Junior Engineer for Site Monitoring and Supervision — Deployment of one Junior Engineer for 60 days, working 8 hours per day at the project site...$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$PCC - Providing & Making new PCC in the ratio 1:2:4 (Cement : Sand : Coarse Aggregate) with waterproof admixture. Apply a 50 to 75 mm thick PCC layer above the cured coba evenly. Proper Line & Level the surface etc complete.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Replace defective concealed plumbing / waste water / soil lines contributing to leakage, including cutting, jointing, testing and reinstatement.$IM$, 'Civil & Misc', 'RFT', false),
  ($IM$Dismantling Existing Paver Blocks Including Stacking$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing and laying of Kota Stone slab 30mm thick mortar 25 mm thk. bed of cement mortar (1:6) with a neat floating coat of cement, filling joints with neat cement slurry curing and cleaning complete.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing and laying Vitrified tile 600x600, Premium grade, over cement mortar bed / approved adhesive, including cutting, jointing, grouting, polishing / cleaning and curing; excluding skirting unless otherwise specified, all as per approved drawings, relevant IS / NBC codes and the Engineer-in-Charge's instructions.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Waterproofing of entrance canopy both side and with Brik Bat and IPS finish and Coating as complete$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Removing of Existing Cable Trey and Fixing of cable vertical panel with clamping As complete ( If any extra wiring connection and cable Provided by client only )$IM$, 'Civil & Misc', 'RFT', false),
  ($IM$New Brick Wall & Plaster (as directed by Site PMC)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Breaking & Removing Old Waterproofing + Plaster (up to 2 ft)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Laying of Brickbats with Required Slope (Toilet & Pantry)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Existing Mosaic/Tile Dismantling including removal of existing tiles, adhesive/mortar, cleaning of surface and disposal of dismantled debris.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Surface Preparation & Repair including cleaning, hacking, minor levelling and making the surface ready for waterproofing$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Waterproofing Treatment using suitable swimmingpool-grade waterproofing system, including primer, 2coat waterproofing and treatment of corners/joints$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$New Swimming Pool Mosaic Tile Installation including approved mosaic tiles, suitable adhesive, laying, alignment, cutting and fixing$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Mosaic Tile Grouting using swimming-pool-grade epoxy/chemical-resistant grout, including filling and finishing of joints$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Removal of Old Waterproofing & Loose Particles — Removal of existing waterproofing layer, loose concrete, dust and other weak particles from the affected surface.$IM$, 'Civil & Misc', 'MT', false),
  ($IM$SBR Mortar & GP2 Repair — Repairing cracks, damaged areas, honeycombs and cavities using SBR-modified mortar and GP2 repair grout.$IM$, 'Civil & Misc', 'MT', false),
  ($IM$PU Grouting — Pre-inspection and marking... Drilling holes... Installing packers... PU injection... Curing and trimming... Patching and finishing...$IM$, 'Civil & Misc', 'MT', false),
  ($IM$HDPE Membrane Tape — Providing and fixing HDPE membrane tape over joints, cracks, corners and other critical areas to provide additional waterproofing protection.$IM$, 'Civil & Misc', 'MT', false),
  ($IM$Cleaning the entire toilet and pantry surface throughly removing dust and loose particals-Appling a cement slurry mixed with W/P chemical ( Dr.FixIt 301 URP ) up to 2 ft wall height$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Fixing of Owner-Supplied Sanitary Fittings (WC Pan/Flush/Washbasin/Urinal)$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Fixing Marble Counter with SS Nirali Sink (18"×24")$IM$, 'Civil & Misc', 'LUMPSUM', false),
  ($IM$All Dedo and Flooring Tiles up to 8 feet height ( Flooring Tile marble kadappa ,cement,Jointner all necessary material will be given by owner at their own$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Wall Conduiting, Concealed Box & Internal Wiring, Switch Plates & Fixing, Testing & Commissioning$IM$, 'Civil & Misc', 'LUMPSUM', false),
  ($IM$Micro concrete: Rebuilding the section of damaged RCC elements to its original size... in thicknesses of Fire Sleeves on each side by providing and casting with micro concrete of grade M50 and above... (Make Fosroc & SIKA)$IM$, 'Civil & Misc', 'CUM', false),
  ($IM$Restoration & Cleaning of Window Brass Hardware Fittings$IM$, 'Civil & Misc', 'LUMPSUM', false),
  ($IM$Wooden Window & Hardware Refurbishment$IM$, 'Civil & Misc', 'LUMPSUM', false),
  ($IM$Core cutting service for drilling precise circular holes in RCC slabs, concrete walls, and floors as per the required diameter and thickness.$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Roof Waterproofing with Roof Seal Top and Fibre Mesh — Preparation of the roof surface, followed by application of Roof Seal Top waterproofing material with fibre mesh reinforcement as per the required application procedure.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Water Tank Waterproofing with Roof Seal Top (No Warranty)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Boundary Wall – Dismantling of Existing Plaster — Removal of existing plaster from the affected boundary wall surface, including clearing loose material and preparing the substrate for further treatment.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Boundary Wall – Waterproofing Treatment — Application of one coat of the specified waterproofing treatment to the prepared boundary wall surface.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Boundary Wall – Replastering with Waterproofing Compound — Replastering of the boundary wall using a suitable cement-based plaster mixed with a waterproofing compound to improve surface protection and durability.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Staircase and Balcony Waterproofing Repair Work — Repair and waterproofing treatment of the staircase and balcony areas, including preparation of affected surfaces and application of the specified waterproofing system.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$RCC / decorative concrete flooring with water-wash / trowel finish, including mixing, laying, finishing and curing.$IM$, 'Civil & Misc', 'SQFT', true),
  ($IM$Disposal of surplus earth$IM$, 'Civil & Misc', 'SQM', false),
  ($IM$PCC: Cement concrete grade M-10 (1:3:6)$IM$, 'Civil & Misc', 'SQM', false),
  ($IM$Remove Old Waterproofing Treatment$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$UV Resistant Silver Paint$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Fly ash bricks are eco-friendly building materials made primarily from fly ash (a byproduct of coal-fired power plants), mixed with cement or lime, gypsum, sand, and water...$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Fly ash blocks are larger masonry units manufactured using fly ash, cement, sand or stone dust, and water...$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$RMC M30 supply and apply as per client design plaster$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Vanity: Custom-made bathroom vanity unit in BWP plywood carcass with laminate finish shutters, solid wood support/detailing and quartz countertop. (Century / Merino / Virgo)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Mirror: Supply and fixing of mirror above vanity/wash area, cut and edge-polished to size.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Sanitary & Fixtures: Supply of sanitary ware and bathroom fittings such as taps, and accessories (Jaquar, CERA)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Mandir: Custom pooja unit (Mandir) in HDHMR/plywood carcass with fittings and hardware, finished to match interior theme (Action Tesa)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Light & Fixtures — General Scope$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Blind / Roller Shutter: Supply and fixing of window blinds / roller shutters as per requirement$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Interior Painting — Satin / Duco$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$MDF Work: Carpentry work in E3-grade MDF board for cabinets, panelling and other joinery as required. (Century)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$TV Panel: TV unit / wall panel constructed in E3 ply and HDHMR board with fittings, designed to house the television and accessories. (Action Tesa)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$LED & Profile Light: Supply and fixing of LED strip lights with aluminium profile for cove/panel lighting. (Philips, Surya)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Electrical Wire: Concealed electrical wiring for lighting, sockets and switch points as per layout. (Havells, Polycab)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Laminate: Decorative laminate finish applied on cabinets, panels and other furniture surfaces (Merino, Virgo)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Hardware: Branded furniture hardware — hinges, channels, handles and fittings for all cabinets/shutters (Hettich)$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Light & Fixtures — Additional$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Dismantling Work: Dismantling of existing fixtures/furniture and removal of debris before new work begins$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Louvers: Supply and fixing of louvers for ventilation/partition as per design$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Plaster Removal$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Repairing of the floor and reinstalling Kota stone$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Granite Frame Double Tan Brown /Black$IM$, 'Civil & Misc', 'RFT', false),
  ($IM$Backlight Door (6 X 2.5) ( WC) with fitting$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Chamber Cover (3x2 ) Heavy Duty$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Cement Patra (12 X 8) with channel support$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$POP Work : applying 20mm to 32 mm pop in wall and match the surface with Wall surface$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Breaking Bottom Surface of Old Waterproofing$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$LG 3 mm PVC Flooring: Durable and stylish flooring solution with a smooth finish. Easy to clean and maintain, suitable for both residential and commercial spaces.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Final Cleaning & Finishing after completion of tile and grouting work$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$All Debris Dump to the yard$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Dismantling of Existing False Ceiling$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Removal of Debris$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Providing & Fixing Concealed PVC waste line as per given drawing$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Providing & Fixing Ledge wall for WC$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$HPL Toilet Cubicle Partition and Urinal Partition as per given drawing$IM$, 'Civil & Misc', 'LUMPSUM', false),
  ($IM$Core Cutting — 50mm dia × 250mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 75mm dia × 250mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 100mm dia × 250mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 125mm dia × 250mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 150mm dia × 250mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 200mm dia × 250mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 50mm dia × 450mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 75mm dia × 450mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 100mm dia × 450mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 125mm dia × 450mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 150mm dia × 450mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Core Cutting — 200mm dia × 450mm depth$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$stone sampling$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Nitozinc Primer: Supply of Nitozinc Primer for protective coating work.$IM$, 'Civil & Misc', 'LTR', false),
  ($IM$Renderoc HS Xtra: Supply of Renderoc HS Xtra for concrete repair and restoration work.$IM$, 'Civil & Misc', 'BAG', false)
) as v(name, category, unit, uses_sqft)
where not exists (
  select 1 from public.org_item_master m where lower(m.name) = lower(v.name)
);

-- ----------------------------------------------------------------------------
-- ROLLBACK: same backup table as before covers this too --
--   truncate public.org_item_master;
--   insert into public.org_item_master select * from public.org_item_master_backup_20261022;
-- ----------------------------------------------------------------------------
