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
  "MEP",
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
];
