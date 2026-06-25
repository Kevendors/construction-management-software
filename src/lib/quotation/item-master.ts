// Reusable item/service master — a deduped, generic list distilled from the
// historical Keyvendors quotations. Each entry carries a standard description
// and default unit; rate/quantity/sqft are filled per quotation.

export type QuoteUnit =
  | "SQFT"
  | "SQM"
  | "RFT"
  | "RMT"
  | "CUM"
  | "KG"
  | "MT"
  | "NOS"
  | "POINT"
  | "LUMPSUM";

export interface MasterItem {
  id: string;
  name: string;
  category: string;
  unit: QuoteUnit;
  /** Uses a per-sqft area multiplier in the Amount formula. */
  usesSqft: boolean;
  description: string;
}

export const ITEM_CATEGORIES = [
  "Painting",
  "Tiling & Flooring",
  "Ceiling & Partition",
  "Carpentry & Interiors",
  "Civil & RCC",
  "Waterproofing",
  "Structural Repair",
  "Structural Strengthening",
  "Facade & Metal",
  "Doors & Sanitary",
  "Civil & Misc",
  "Road Work",
  "MEP",
  "HVAC & Refrigeration",
  "Site & Services",
  "Cleaning",
];

export const ITEM_MASTER: MasterItem[] = [
  // ---- Painting ----
  { id: "paint-res", name: "Residential Painting", category: "Painting", unit: "SQFT", usesSqft: true,
    description: "Painting work executed as per the discussed scope and standards, including surface preparation, putty, primer and finish coats (a minimum area of 1000 sq.ft is required for execution)." },
  { id: "paint-comm", name: "Commercial Painting", category: "Painting", unit: "SQFT", usesSqft: true,
    description: "Commercial painting executed with premium-grade materials and professional application as per site requirements (a minimum area of 1000 sq.ft is required for execution)." },
  { id: "paint-texture", name: "Texture / Feature Wall", category: "Painting", unit: "SQFT", usesSqft: true,
    description: "Texture / feature wall finish using premium materials, including surface preparation and application as per approved design." },
  { id: "wall-putty", name: "Wall Putty", category: "Painting", unit: "SQFT", usesSqft: true,
    description: "Application of wall putty including surface preparation and sanding to achieve a smooth finish." },

  // ---- Tiling & Flooring ----
  { id: "tile-wall", name: "Commercial Wall Tile Work", category: "Tiling & Flooring", unit: "SQFT", usesSqft: true,
    description: "Commercial wall tile work executed with premium-grade materials and professional installation as per site requirements." },
  { id: "tile-kota", name: "Floor Kota Tile Installation", category: "Tiling & Flooring", unit: "SQFT", usesSqft: true,
    description: "Floor Kota tile installation using high-quality Kota stone, including surface preparation and finishing as per industry standards (a minimum area of 1000 sq.ft is required for execution)." },
  { id: "tile-vitrified", name: "Vitrified / Floor Tile Installation", category: "Tiling & Flooring", unit: "SQFT", usesSqft: true,
    description: "Supply and laying of vitrified / floor tiles including surface preparation, fixing and grouting as per site requirements." },
  { id: "epoxy", name: "Epoxy Flooring", category: "Tiling & Flooring", unit: "SQFT", usesSqft: true,
    description: "Epoxy flooring application including surface preparation, priming and finishing coats as per industry standards." },

  // ---- Ceiling & Partition ----
  { id: "ceiling-false", name: "False Ceiling Work", category: "Ceiling & Partition", unit: "SQFT", usesSqft: true,
    description: "False ceiling executed as per approved design, including framing, board installation and finishing, ensuring high-quality standards (a minimum area of 1000 sq.ft is required for execution)." },
  { id: "ceiling-pop", name: "POP Ceiling Work", category: "Ceiling & Partition", unit: "SQFT", usesSqft: true,
    description: "POP ceiling work including framing, POP board / punning and finishing as per approved design." },
  { id: "pop-cornice", name: "POP Cornice / Moulding", category: "Ceiling & Partition", unit: "RFT", usesSqft: false,
    description: "POP cornice / moulding work executed along the perimeter as per approved design." },
  { id: "partition-gypsum", name: "Gypsum Partition", category: "Ceiling & Partition", unit: "SQFT", usesSqft: true,
    description: "Gypsum board partition including GI framing, boarding both sides and finishing as per site requirements." },
  { id: "pvc-panel", name: "PVC Wall Panel", category: "Ceiling & Partition", unit: "SQFT", usesSqft: true,
    description: "Supply and installation of PVC wall panels including framing and finishing as per site requirements." },

  // ---- Carpentry & Interiors ----
  { id: "carpentry", name: "Carpentry Work", category: "Carpentry & Interiors", unit: "SQFT", usesSqft: true,
    description: "Carpentry work carried out including material, labour and finishing as per project specifications." },
  { id: "wood-polish", name: "Wood / PU Polish", category: "Carpentry & Interiors", unit: "SQFT", usesSqft: true,
    description: "Wood / PU polish including surface preparation and multiple coats for a premium finish." },
  { id: "modular-kitchen", name: "Modular Kitchen", category: "Carpentry & Interiors", unit: "SQFT", usesSqft: true,
    description: "Design and installation of modular kitchen with premium fittings, hardware and finishes as per approved design." },
  { id: "interior-design", name: "Interior Designing", category: "Carpentry & Interiors", unit: "LUMPSUM", usesSqft: false,
    description: "Interior design service including concept, layout, 3D visualisation and execution drawings." },
  { id: "office-interior", name: "Office Interior Designing", category: "Carpentry & Interiors", unit: "LUMPSUM", usesSqft: false,
    description: "Office interior design and fit-out including space planning, furniture and finishes." },

  // ---- Waterproofing ----
  { id: "waterproof", name: "Waterproofing (All Types)", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "All types of waterproofing using Dr. Fixit / Sika / Fosroc products, including surface preparation and application as per industry standards." },
  { id: "waterproof-terrace", name: "Terrace / Roof Waterproofing", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "Terrace / roof waterproofing including cleaning, crack filling, priming and protective coats." },

  // ---- Structural Repair ----
  { id: "jet-wash", name: "Jet Water Wash Cleaning", category: "Structural Repair", unit: "SQFT", usesSqft: true,
    description: "Cleaning with high-pressure jet water wash to remove dirt, mud, debris and loose particles prior to repair." },
  { id: "sbr-bonding", name: "SBR Latex Concrete Bonding", category: "Structural Repair", unit: "SQFT", usesSqft: true,
    description: "Application of SBR latex bonding agent to join old and new concrete surfaces so successive layers behave as a single unit." },
  { id: "injection-grouting", name: "Injection Grouting (RCC)", category: "Structural Repair", unit: "NOS", usesSqft: false,
    description: "Injection grouting of RCC structural members (horizontal & vertical) by fixing PVC nozzles at 1 m c/c through drilling/chiselling; cement provided by client." },
  { id: "micro-concrete", name: "Micro Concrete Finishing / Repair", category: "Structural Repair", unit: "SQFT", usesSqft: true,
    description: "Edge repair and micro-concrete finishing with hardener, including area filling as per specification." },
  { id: "structural-strength", name: "Structural Strengthening / Retrofitting", category: "Structural Repair", unit: "LUMPSUM", usesSqft: false,
    description: "Structural strengthening / retrofitting works as per structural consultant's design and scope." },

  // ---- Civil & Misc ----
  { id: "core-cutting", name: "Core Cutting", category: "Civil & Misc", unit: "NOS", usesSqft: false,
    description: "Core cutting of specified diameter through RCC / brick as per site requirement." },
  { id: "civil-misc", name: "General Civil Work", category: "Civil & Misc", unit: "LUMPSUM", usesSqft: false,
    description: "General civil work including masonry, plaster and allied items as per site requirements." },

  // ---- MEP ----
  { id: "plumbing", name: "Plumbing Service", category: "MEP", unit: "LUMPSUM", usesSqft: false,
    description: "Plumbing service including supply and installation of fittings as per site requirements." },
  { id: "electrical", name: "Electrical Work", category: "MEP", unit: "POINT", usesSqft: false,
    description: "Electrical wiring / point work including material and labour as per site requirements." },

  // ---- Cleaning ----
  { id: "deep-clean", name: "Home Deep Cleaning", category: "Cleaning", unit: "SQFT", usesSqft: true,
    description: "Home deep cleaning including floors, bathrooms, kitchen and surfaces using professional equipment and materials." },

  /* ================================================================= */
  /* Items distilled from the full set of historical quotations (53)   */
  /* ================================================================= */

  // ---- Painting (additional) ----
  { id: "white-wash", name: "White Wash / Distemper", category: "Painting", unit: "SQFT", usesSqft: true,
    description: "White washing / dry distemper including surface cleaning and the required number of coats." },

  // ---- Civil & RCC ----
  { id: "rcc-casting", name: "RCC Casting Work", category: "Civil & RCC", unit: "CUM", usesSqft: false,
    description: "Providing and laying design-mix RCC (M20/M25/M30) for slabs, beams, columns and footings, including pumping/placing, compaction, finishing and curing (shuttering & reinforcement separate unless specified)." },
  { id: "pcc", name: "PCC – Plain Cement Concrete", category: "Civil & RCC", unit: "CUM", usesSqft: false,
    description: "Providing and laying plain cement concrete (PCC) of specified grade in foundations / sub-base, including compaction and curing." },
  { id: "brick-masonry", name: "Brick Masonry Work", category: "Civil & RCC", unit: "SQFT", usesSqft: true,
    description: "Brick masonry in cement mortar (1:6) for walls of specified thickness (9\" / 4\"), including scaffolding and curing." },
  { id: "aac-block", name: "AAC Block Masonry", category: "Civil & RCC", unit: "SQFT", usesSqft: true,
    description: "AAC (Autoclaved Aerated Concrete) block masonry in cement mortar, including jointing, scaffolding and curing." },
  { id: "plaster-internal", name: "Internal Cement Plaster", category: "Civil & RCC", unit: "SQFT", usesSqft: true,
    description: "Internal cement plaster 12–15 mm thick (1:4 / 1:6), finished smooth in true line and level, including curing." },
  { id: "plaster-external", name: "External Cement Plaster", category: "Civil & RCC", unit: "SQFT", usesSqft: true,
    description: "External cement plaster 15–20 mm thick (two coats) with waterproofing compound, finished to line and level." },
  { id: "gypsum-plaster", name: "Gypsum Plaster", category: "Civil & RCC", unit: "SQFT", usesSqft: true,
    description: "Providing and applying 6–12 mm thick gypsum plaster on walls / ceiling in line and level, finished smooth." },
  { id: "steel-reinf", name: "Steel Reinforcement (TMT)", category: "Civil & RCC", unit: "KG", usesSqft: false,
    description: "Supplying, cutting, bending and fixing TMT steel reinforcement bars in position, including binding wire and cover blocks." },
  { id: "shuttering", name: "Centering & Shuttering", category: "Civil & RCC", unit: "SQFT", usesSqft: true,
    description: "Providing, fixing and removing centering / shuttering (ply / steel) for RCC members, including props and staging at all heights." },
  { id: "demolition", name: "Demolition & Dismantling", category: "Civil & RCC", unit: "SQFT", usesSqft: true,
    description: "Demolishing / dismantling of brick, RCC, tiles or plaster manually or by mechanical means, including disposal of debris." },
  { id: "excavation", name: "Earthwork Excavation", category: "Civil & RCC", unit: "CUM", usesSqft: false,
    description: "Earthwork in excavation by manual / mechanical means in all soils, including dressing, leveling and disposal." },
  { id: "scaffolding", name: "Scaffolding (Cup-lock)", category: "Civil & RCC", unit: "SQFT", usesSqft: true,
    description: "Providing and fixing cup-lock / double scaffolding system as working platform at all heights, including removal after completion." },

  // ---- Structural Strengthening (retrofit) ----
  { id: "carbon-laminate", name: "Carbon Fibre Laminate Strengthening", category: "Structural Strengthening", unit: "RMT", usesSqft: false,
    description: "Structural strengthening using carbon-fibre laminates / plates bonded with structural epoxy adhesive (HEXACURE / Sika), as per consultant design." },
  { id: "fibre-wrap", name: "Carbon / Glass Fibre Wrap", category: "Structural Strengthening", unit: "SQFT", usesSqft: true,
    description: "Strengthening of RCC members with carbon / glass-fibre wrap using structural saturant and primer, surface preparation included." },
  { id: "rebar-treatment", name: "Anti-Corrosive Rebar Treatment", category: "Structural Strengthening", unit: "SQFT", usesSqft: true,
    description: "Cleaning exposed reinforcement of rust, applying rust converter and anti-corrosive / polymer protective coating to rebars and substrate." },

  // ---- Waterproofing (variants) ----
  { id: "app-membrane", name: "APP Membrane Waterproofing (Torch-on)", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "Torch-on APP membrane waterproofing (Dr. Fixit Torch Shield / equivalent) including bitumen primer and protective screed, with warranty." },
  { id: "brickbat-coba", name: "Brickbat Coba Waterproofing", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "Brickbat coba waterproofing on terrace including slurry coat, brickbat laying in slope, curing and protective finish." },
  { id: "pu-waterproof", name: "PU Waterproofing / Roof Seal Top", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "PU-based elastomeric waterproofing / Roof Seal Top coating with heat insulation, applied in multiple coats over a prepared surface." },
  { id: "roof-seal-coat", name: "Roof Seal Coat (3-coat)", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "Dr. Fixit Roof Seal single-component cold-applied waterproof coating in 3 coats, including surface preparation." },
  { id: "sa-membrane", name: "Self-Adhesive Membrane Waterproofing", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "Application of self-adhesive waterproofing membrane to a prepared surface with primer, fully adhered with no wastage." },

  // ---- Tiling & Flooring (stone / screed / decorative) ----
  { id: "granite-work", name: "Granite Flooring / Stonework", category: "Tiling & Flooring", unit: "SQFT", usesSqft: true,
    description: "Providing and laying polished granite flooring / counters over cement mortar base, including jointing, machine polishing and edge moulding." },
  { id: "marble-work", name: "Marble Flooring / Stonework", category: "Tiling & Flooring", unit: "SQFT", usesSqft: true,
    description: "Providing and laying marble flooring / cladding over cement mortar base with pigment-matched jointing, rubbing and polishing." },
  { id: "floor-screed", name: "Floor Screeding", category: "Tiling & Flooring", unit: "SQFT", usesSqft: true,
    description: "Providing and laying cement / level screed of specified thickness over slab as a base for flooring, finished to level." },
  { id: "decorative-concrete", name: "RCC / Decorative Concrete Flooring", category: "Tiling & Flooring", unit: "SQFT", usesSqft: true,
    description: "RCC / decorative concrete flooring with water-wash / trowel finish, including mixing, laying, finishing and curing." },

  // ---- Facade & Metal ----
  { id: "acp-cladding", name: "ACP / Aluminium Composite Panel Cladding", category: "Facade & Metal", unit: "SQFT", usesSqft: true,
    description: "Providing and fixing 4 mm ACP cladding over aluminium framework, including cleats, sealant, backer rods and protective-film removal." },
  { id: "aluminium-glazing", name: "Aluminium / Glass Glazing Work", category: "Facade & Metal", unit: "SQFT", usesSqft: true,
    description: "Providing and fixing aluminium-framed glazing / curtain wall with glass, including hardware, sealant and finishing." },
  { id: "structural-steel", name: "Structural Steel Fabrication (MS)", category: "Facade & Metal", unit: "KG", usesSqft: false,
    description: "Fabrication and erection of structural steel (MS tubular / sections, trusses, columns) including cutting, welding, anti-rust primer and painting." },
  { id: "railing", name: "MS / Glass Railing", category: "Facade & Metal", unit: "RFT", usesSqft: false,
    description: "Providing and fixing MS / stainless-steel and glass railing as per design, including anti-rust primer and finishing." },

  // ---- Doors & Sanitary ----
  { id: "flush-door", name: "Flush Door (Supply & Install)", category: "Doors & Sanitary", unit: "NOS", usesSqft: false,
    description: "Supply and installation of flush doors with frame, standard hardware and finish as per site requirement." },
  { id: "toilet-cubicle", name: "Toilet Cubicle (Supply & Install)", category: "Doors & Sanitary", unit: "NOS", usesSqft: false,
    description: "Supply and installation of toilet cubicle partitions with hardware, complete as per approved design." },
  { id: "mirror", name: "Mirror (Supply & Fixing)", category: "Doors & Sanitary", unit: "SQFT", usesSqft: true,
    description: "Supply and fixing of 6 mm clear / full-height mirror with backing and fixing accessories." },
  { id: "sanitary-ware", name: "Sanitary Ware Installation", category: "Doors & Sanitary", unit: "NOS", usesSqft: false,
    description: "Supply and installation of sanitary ware (WC, washbasin, urinal, taps, hand dryer) including connections and fittings." },

  // ---- Site & Services ----
  { id: "ac-jet-clean", name: "AC Jet Cleaning Service", category: "Site & Services", unit: "NOS", usesSqft: false,
    description: "High-pressure jet cleaning of Split / Cassette AC (indoor + outdoor) including coil, blower and drain cleaning, with reassembly and testing." },
  { id: "signage", name: "Signage (Acrylic / Sticker)", category: "Site & Services", unit: "SQFT", usesSqft: true,
    description: "Supply and installation of acrylic / vinyl signage and stickers as per approved artwork." },
  { id: "barricading", name: "Site Barricading (Tin / MS)", category: "Site & Services", unit: "RFT", usesSqft: false,
    description: "Providing and fixing tin-sheet / MS-frame site barricading, including supply, installation and removal after completion." },

  /* ================================================================= */
  /* Complete set — every remaining distinct item across all 53 quotes */
  /* (one-off / project-specific items included, deduped)              */
  /* ================================================================= */

  // ---- Waterproofing (further variants) ----
  { id: "wp-2k-fastflex", name: "2K / Fast Flex Cementitious Waterproofing", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "Two-component cementitious + acrylic flexible waterproofing & protective coating (Dr. Fixit Pidifin 2K / Fast Flex / Bostik / Perma) applied to protect concrete and similar structures." },
  { id: "wp-integral", name: "Integral Cement-Based Waterproofing", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "Integral cement-based waterproofing treatment for roofs/terraces: neat cement slurry with waterproofing compound, brickbat laying to slope, and protective cement mortar, with curing and leak testing." },
  { id: "wp-anticarbonation", name: "Anti-Carbonation Coating", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "Providing and applying non-bleeding anti-carbonation / bituminous coating (e.g. Dekguard) on external surfaces, including surface preparation and consumables." },
  { id: "protective-plaster", name: "Protective Plaster (over waterproofing)", category: "Waterproofing", unit: "SQFT", usesSqft: true,
    description: "12 mm thick protective plaster 1:4 with waterproofing compound over treated/waterproofed surface, complete." },

  // ---- Structural Repair (further sub-items) ----
  { id: "concrete-chipping", name: "Concrete Chipping / Surface Removal", category: "Structural Repair", unit: "SQFT", usesSqft: true,
    description: "Chipping of unsound/weak concrete from slabs, beams, columns by chisel/power tools, tapering edges, cleaning exposed concrete & reinforcement, and disposal of debris." },
  { id: "epoxy-bond-coat", name: "Epoxy Bond Coat", category: "Structural Repair", unit: "SQFT", usesSqft: true,
    description: "Applying epoxy bond coat (two-component base + hardener, BASF/Sika/Fosroc) prior to micro-concrete, for long open time, as per manufacturer specs." },
  { id: "polymer-mortar", name: "Polymer Modified Mortar Repair", category: "Structural Repair", unit: "SQFT", usesSqft: true,
    description: "Providing, mixing and applying SBR/acrylic polymer-modified cement mortar (1:4 with min 2% polymer by wt. of cement) for repair, including curing — 25 mm avg in 2 layers." },
  { id: "curing-compound", name: "Concrete Curing Compound", category: "Structural Repair", unit: "SQFT", usesSqft: true,
    description: "Supplying and applying pre-tested water-based concrete curing compound to concrete/masonry surfaces as per manufacturer specification." },
  { id: "epoxy-anchor", name: "Epoxy Anchor / Dowel Grouting", category: "Structural Repair", unit: "NOS", usesSqft: false,
    description: "Drilling holes in RCC and fixing dowel/anchor bars using epoxy resin anchor grout (HILTI HIT / Fischer or equivalent), excluding reinforcement cost." },
  { id: "shear-key", name: "Shear Key Installation (CFRP / Epoxy)", category: "Structural Repair", unit: "NOS", usesSqft: false,
    description: "Providing and fixing L-type shear keys / CFRP shear anchors (10 mm dia) through pre-packed epoxy system in RCC members, including drilling and fixing." },
  { id: "injection-nipple", name: "PVC Injection Nipple Fixing (crack repair)", category: "Structural Repair", unit: "NOS", usesSqft: false,
    description: "Providing and inserting 12 mm dia PVC perforated injection nipples in honeycomb/crack zones, drilling and sealing, complete." },
  { id: "propping", name: "Propping / Shoring of RCC Members", category: "Structural Repair", unit: "NOS", usesSqft: false,
    description: "Relieving RCC elements (columns/beams/slabs) of superimposed load by props with timber runners for load distribution, maintained till repair completion." },
  { id: "diamond-grinding", name: "Surface Preparation (Diamond Grinding)", category: "Structural Repair", unit: "SQFT", usesSqft: true,
    description: "Surface preparation of column/beam/slab by diamond grinding to remove form lines and protrusions, leveling cavities with polymer slim coats to receive fibre-wrap systems." },

  // ---- Civil & RCC (further) ----
  { id: "scaffold-screening", name: "Scaffolding Screening / Dust Curtain", category: "Civil & RCC", unit: "SQFT", usesSqft: true,
    description: "Providing and fixing continuous vertical curtain/screening (gunny cloth / HDPE mesh) over scaffolding to prevent dust/debris scatter, with upkeep till removal." },
  { id: "malba-disposal", name: "Debris / Malba Disposal", category: "Civil & RCC", unit: "CUM", usesSqft: false,
    description: "Disposal of building rubbish/malba by mechanical means including loading, transporting and unloading to approved dumping ground beyond initial lead." },
  { id: "inspection-pit", name: "Inspection Pit / Tank Pit Construction", category: "Civil & RCC", unit: "NOS", usesSqft: false,
    description: "Construction of vehicle inspection pit / water-tank pit with both-side plaster and RCC inner flooring, including excavation and finishing." },
  { id: "drain-piping", name: "Drain Line / PVC Piping Work", category: "Civil & RCC", unit: "RMT", usesSqft: false,
    description: "Providing and laying drain line / PVC piping with required slope, pits and connections, including waterproofing of inlets." },

  // ---- Road Work ----
  { id: "dbm", name: "Dense Graded Bituminous Macadam (DBM)", category: "Road Work", unit: "SQM", usesSqft: false,
    description: "Providing and laying DBM with crushed aggregates premixed with bituminous binder, laid by paver and rolled to required grade, level and compaction." },
  { id: "bc-layer", name: "Bituminous Concrete (BC) Layer", category: "Road Work", unit: "SQM", usesSqft: false,
    description: "Providing and laying bituminous concrete wearing course with crushed aggregates and bitumen (CRMB/VG grade), laid by paver and compacted to specification." },
  { id: "tack-coat", name: "Tack Coat Application", category: "Road Work", unit: "SQM", usesSqft: false,
    description: "Providing and applying tack coat using bitumen emulsion / hot bitumen by pressure distributor, after cleaning the existing surface with mechanical broom." },
  { id: "prime-coat", name: "Prime Coat Application", category: "Road Work", unit: "SQM", usesSqft: false,
    description: "Providing and applying primer/prime coat on the prepared granular surface prior to bituminous layers, as per specification." },

  // ---- MEP (turnkey) ----
  { id: "mep-design-build", name: "MEP Design & Build (Turnkey)", category: "MEP", unit: "LUMPSUM", usesSqft: false,
    description: "MEP design & build — concept design, GFC drawings & BOQ, and execution of plumbing, HVAC/ventilation, electrical and fire-fighting works with handover." },
  { id: "hvac", name: "HVAC / Ventilation System", category: "MEP", unit: "LUMPSUM", usesSqft: false,
    description: "Supply, installation and commissioning of HVAC / ventilation system as per design and site requirement." },
  { id: "fire-fighting", name: "Fire Fighting System", category: "MEP", unit: "LUMPSUM", usesSqft: false,
    description: "Supply and installation of fire-fighting system (piping, pumps, fixtures) as per approved design and norms." },

  // ---- HVAC & Refrigeration ----
  { id: "ductable-ac", name: "Ductable AC (Supply / Install / Dismantle)", category: "HVAC & Refrigeration", unit: "NOS", usesSqft: false,
    description: "Supply, installation, dismantling or gas top-up of ductable air-conditioning units (e.g. 8.5 TR), including ducting and connections as required." },
  { id: "ac-gas-refill", name: "AC Gas Refilling / General Service", category: "HVAC & Refrigeration", unit: "NOS", usesSqft: false,
    description: "AC general service and gas refilling — deep jet cleaning, leak inspection/fixing and refrigerant top-up." },
  { id: "cold-room", name: "Cold Room / Freezer Room (PUF Panels)", category: "HVAC & Refrigeration", unit: "LUMPSUM", usesSqft: false,
    description: "Supply and installation of cold room / freezer room with PUF insulated panels (PPGI, cam-lock joints), refrigeration unit, door, controls and civil interface." },
  { id: "puf-panel", name: "PUF Insulated Panel Work", category: "HVAC & Refrigeration", unit: "SQFT", usesSqft: true,
    description: "Supply and installation of PUF insulated panels (specified thickness/density) for walls/ceiling with cam-lock jointing." },

  // ---- Civil & Misc (one-off) ----
  { id: "tin-shed", name: "Tin Shed / Roofing Sheet Work", category: "Civil & Misc", unit: "SQFT", usesSqft: true,
    description: "Supply and fixing of tin/GI roofing sheets over MS structure, including supports and fasteners; replacement of old sheets as required." },
  { id: "sports-platform", name: "Sports / Basketball Court Platform", category: "Civil & Misc", unit: "SQFT", usesSqft: true,
    description: "Construction of sports / basketball court platform including brickbat base, PCC/RCC and finishing as per site requirement." },
];
