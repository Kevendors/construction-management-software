-- ============================================================================
-- 0043_item_master_cleanup.sql — consolidate formatting-only duplicate items
-- ----------------------------------------------------------------------------
-- One-time data cleanup, not schema. Found 24 groups of item/
-- methodology descriptions across the Master List, 76 quotations, and 22
-- invoices that were the SAME text with only cosmetic differences (stray quote
-- marks, leftover markdown **bold**, a newline instead of a space) -- confirmed
-- via local deterministic text comparison, no AI API involved. Only the 23
-- genuinely new ones are inserted here (one, "Malba Removal", was already clean
-- in the master list and needs no change). Historical quotations/invoices are
-- NOT edited -- they stay exactly as sent. A separate, larger set of lookalike
-- groups that turned out to be genuinely different items (different sizes,
-- different contract years, different trades, etc.) was deliberately NOT
-- auto-merged -- reviewed with the user instead.
-- ============================================================================

-- Safety backup: every row in org_item_master as it stood before this cleanup.
-- Keep this table (or drop it once you've confirmed everything looks right).
create table if not exists public.org_item_master_backup_20261022 as
  select * from public.org_item_master;

insert into public.org_item_master (org_id, name, category, unit, uses_sqft)
select (select id from public.orgs order by created_at limit 1), v.name, v.category, v.unit, v.uses_sqft
from (values
  ($IM$Dismantling of Existing Waterproofing:
 Removal of the existing/old waterproofing treatment from the specified surface. All damaged and loose waterproofing material shall be removed properly.$IM$, 'Civil & Misc', 'RMT', false),
  ($IM$SBR Latex Bonding Treatment:
 Application of SBR acrylic latex bonding agent over the prepared surface. It will provide bonding between old and new concrete surfaces and help the layers behave as a single unit.$IM$, 'Civil & Misc', 'RMT', false),
  ($IM$Injection Grouting: 
Injection grouting of RCC structural members, including walls and raft, horizontally and vertically. 10 mm nominal diameter PVC nozzles shall be fixed at 1 metre centre-to-centre spacing.$IM$, 'Civil & Misc', 'RMT', false),
  ($IM$Micro Concrete Finishing & Edge Repair: 
Repair and finishing of affected areas using micro concrete. Area filling shall be carried out up to 10 mm as required, followed by finishing and hardener treatment.$IM$, 'Civil & Misc', 'RMT', false),
  ($IM$If required, any other area PU treatment: 
Foam Injection in Major Leakage Areas
Apply PU Foam Injection Grout:
Dr. Fixit PU Foam Injection is based on MDI (Methylene
Diphenyl iso cyanate) polyurethane pre- polymer
& accelerator. The system only reacts when it comes in
contact with water, producing a relatively stiff & inert
polyurathane foam. It is a 100% solid & solvent free
polyurethane grout for quick temperrory closing & sealing
of water bearing cracks, cavities and leaks under hydrostatic
pressure. The system foams to 30-40 times its
volume in the presence of water & can be an effective
means of arresting running water seepage.$IM$, 'Civil & Misc', 'RMT', false),
  ($IM$BASEMENT WORK$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Removing loose plaster, paint and deteriorated material
Carefully hacking/removing all loose, debonded, hollow, damaged and deteriorated plaster, paint, putty and other defective surface materials from affected wall/RCC surfaces, including scraping, cleaning, collection and disposal of debris at an approved location. The work shall include exposing sound substrate and preparing the surface for subsequent repair and waterproofing treatment.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Preparation and cleaning of RCC surface
Thorough preparation and cleaning of exposed RCC/masonry substrate by wire brushing, scraping and mechanical/manual cleaning to remove loose particles, laitance, dust, dirt, algae, efflorescence, weak concrete and other contaminants. The surface shall be made sound, clean and free from loose material to receive repair mortar and waterproofing treatment, including all necessary labour, tools and equipment.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$PU injection grouting in active cracks/joints
Providing and carrying out polyurethane (PU) injection grouting for active cracks, construction joints, leakage paths and water-seepage locations, including drilling suitable injection holes, fixing injection packers/nipples, cleaning and flushing of cracks, sealing of the crack surface where required, injection of suitable hydrophilic/hydrophobic PU grout under controlled pressure, sealing/removal of packers after completion and making good the surface. The treatment shall be carried out until active water seepage is effectively arrested.$IM$, 'Civil & Misc', 'RFT', false),
  ($IM$Polymer-modified repair mortar for surface defects
Providing and applying polymer-modified cementitious repair mortar to damaged, honeycombed, porous, spalled, uneven and defective areas after proper surface preparation. The work shall include removal of weak material, cleaning and dampening of substrate, application of bonding coat/primer where specified, filling and compacting of repair mortar in required thicknesses, finishing to match the adjoining surface and curing as recommended by the manufacturer.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$2-component flexible cementitious waterproofing coating
Providing and applying two-component flexible cementitious waterproofing coating in two coats over prepared wall/RCC surfaces, including mixing of polymer and cementitious components in the manufacturer's recommended proportion, application by brush/trowel/roller, treatment of corners, junctions and penetrations, maintaining the specified coating thickness, allowing adequate curing between coats and providing a continuous waterproofing membrane. The treatment shall extend over the affected area as required to control water ingress and rising dampness.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Waterproofing fillet at wall-floor junction
Providing and forming a waterproofing fillet/coving at wall-to-floor junctions using suitable polymer-modified repair mortar/waterproofing material, including cleaning and preparation of the junction, forming a smooth rounded fillet of suitable size, application of bonding/waterproofing coat and integration with the adjoining waterproofing system to eliminate weak points and prevent water ingress through the wall-floor junction.$IM$, 'Civil & Misc', 'RFT', false),
  ($IM$Protective plaster/screed over waterproofing
Providing protective cement plaster/screed over the completed waterproofing treatment to protect the waterproofing membrane from mechanical damage and provide a suitable base for subsequent finishing. The work shall include application of cementitious protective plaster/screed of required thickness, levelling, finishing, curing and all necessary labour, materials, scaffolding and tools.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Injection grouting to be carried out to the honeycombs, voids, tie rod holes, and Construction Joints etc. Cementious Grout.
1) Chasing and opening the construction joints to form a “U” shaped groove of approx. 20 mm width and 20 mm depth.
2) Fixing of 10 to 12mm dia PVC Nozzle Packers for all surface floor and wall to c/c 300mm
3) Grouting the packers using Hydrogrout,/ Cement with adding Dr. Fixit pidicreat AM per bag of cement 225g cementatious crystalline based grout of M/s. Pidilite make, using grouting pump to full saturation wherever required as per our judgment etc. complete.
4) Followed by making 50mm x 50mm fillets (wattas) at the junctions of floor and walls.
5) Nozzle cutting after Grauting work finished
6) As per site Requirement$IM$, 'Civil & Misc', 'NOS', false),
  ($IM$Removing sand bedding/loose material and cleaning substrate
Removal of existing sand bedding, loose screed, dust, debris, laitance, deteriorated material and other contaminants from the exposed substrate. The surface shall be thoroughly cleaned by scraping, wire brushing/vacuum cleaning and other suitable methods to obtain a sound, clean and dry substrate suitable for primer and waterproofing membrane application.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Surface preparation and minor concrete repairs
Preparation of the concrete substrate including removal of weak/honeycombed/loose concrete, filling of minor surface defects, blowholes, local depressions and cracks, levelling of irregularities and making the surface sound and suitable for waterproofing. Repairs shall be carried out using polymer-modified repair mortar, including bonding coat, application, finishing and curing as recommended by the manufacturer.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing slope correction screed
Providing and laying cementitious slope-correction screed over the prepared substrate to achieve the required gradient towards drainage points, including surface preparation, bonding slurry/primer where required, mixing, laying, compacting, levelling, finishing and curing. The screed shall be designed to eliminate water stagnation and shall be compatible with the proposed waterproofing system.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Primer for waterproofing membrane
Providing and applying manufacturer-approved primer over the prepared and properly cured substrate prior to application of the elastomeric waterproofing membrane. Primer shall be applied uniformly at the manufacturer's recommended coverage and allowed to achieve the required tack/drying condition before membrane application.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Heavy-duty elastomeric waterproofing membrane system
Providing and applying a heavy-duty, seamless, elastomeric liquid-applied waterproofing membrane, including all coats required to achieve the specified dry-film thickness, over the approved primer. The membrane shall be fully bonded, flexible, crack-bridging, resistant to water ingress and suitable for concealed applications below protective screed/paver finishes. Application shall include mixing, laying by roller/squeegee/spray as applicable, achieving uniform thickness, treatment of laps/details and curing as per manufacturer's recommendations.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Additional treatment at corners, joints and penetrations
Providing reinforced waterproofing treatment at wall-floor junctions, construction/movement joints, cracks, pipe penetrations, drainage outlets, corners and other vulnerable locations, including forming suitable fillets, application of compatible sealant, reinforcement tape/fabric where required and integration with the main waterproofing membrane to provide a continuous watertight system.$IM$, 'Civil & Misc', 'RFT', false),
  ($IM$Protection screed/board over waterproofing
Providing a protective layer over the completed waterproofing membrane to prevent puncture, abrasion or mechanical damage during subsequent paver installation. The protection may comprise suitable geotextile/protection board followed by cementitious protective screed of required thickness, including laying, levelling, finishing and curing. The protection system shall be compatible with the selected membrane and shall not damage the waterproofing layer.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Relay existing paver blocks including bedding
Carefully relaying the existing sound and reusable paver blocks over the completed and approved protection layer, including preparation of bedding layer, laying to required line, level and slope, maintaining uniform joints, cutting/fitting at edges and around penetrations, joint filling with suitable bedding/jointing material, compaction and final cleaning. Damaged/non-reusable pavers shall be excluded and replaced separately if instructed.$IM$, 'Civil & Misc', 'SQFT', false),
  ($IM$Providing and applying 2 coats of Putty of required thickness over plastered surface after removal all loosely adhering material from the wall surface at all levels to prepare the surface even and smooth complete without undulation to take a paint surface, Applying Water thinneble Priming coat with Primer of approved brand, Applying Two coats of Oil Bound washable Distember (OBD) of approved brand and manufacture to given an even shade.
Note: Asian Paint (2coats Putty/Primer/2coats or more coats).$IM$, 'Civil & Misc', 'SQFT', false)
) as v(name, category, unit, uses_sqft)
where not exists (
  select 1 from public.org_item_master m where lower(m.name) = lower(v.name)
);

-- ----------------------------------------------------------------------------
-- ROLLBACK: delete the rows this added (anything inserted after the backup was
-- taken), or restore entirely from org_item_master_backup_20261022:
--   truncate public.org_item_master;
--   insert into public.org_item_master select * from public.org_item_master_backup_20261022;
-- ----------------------------------------------------------------------------
