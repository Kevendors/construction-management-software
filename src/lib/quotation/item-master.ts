// Reusable item/service master — a deduped, generic list distilled from the
// historical Keyvendors quotations. Each entry carries a standard description
// and default unit; rate/quantity/sqft are filled per quotation.

export type QuoteUnit = "SQFT" | "RFT" | "NOS" | "POINT" | "LUMPSUM";

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
  "Waterproofing",
  "Structural Repair",
  "Civil & Misc",
  "MEP",
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
];
