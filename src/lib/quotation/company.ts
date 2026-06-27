// Keyvendors company details + standard quotation boilerplate, taken verbatim
// from the existing quotation PDFs so generated quotes match exactly.

export const KEYVENDORS = {
  name: "Keyvendors India Pvt. Ltd.",
  address: "656-657, Aggarwal Chamber-3, Veer Savarkar Block, New Delhi 110092",
  contactPerson: "Parvinder Baweja",
  phones: "9018181818, 011-46012928, 9999995498",
  email: "keyvendors@gmail.com",
  gstin: "07AAGCK1663C2ZS",
  bank: {
    accountName: "Keyvendors India Pvt Ltd",
    bank: "Yes Bank",
    branch: "S-529, School Block, Mother Diary Road, Shakarpur, Delhi",
    ifsc: "YESB0000107",
    micr: "110532025",
    account: "010763300000640",
  },
};

/**
 * "Important Links" shown in the quotation header (clickable).
 * TODO: confirm the exact URLs with the business — these are best-guess
 * defaults and may need correcting.
 */
export const KEYVENDORS_LINKS = {
  blog: "https://www.keyvendors.com/blogs",
  youtube: "https://www.youtube.com/@keyvendors",
  review: "https://shorturl.at/bI9HW",
};

/** "We Also Provide These Services" list shown in the footer. */
export const OTHER_SERVICES = [
  "Interior Designing",
  "Painting (Residential / Commercial)",
  "Core Cutting",
  "Modular Kitchen",
  "Plumbing Service",
  "Home Deep Cleaning",
  "Architecture",
  "Appliance Repair",
  "Office Interior Designing",
  "False Ceiling Services",
  "Epoxy Flooring",
  "Carpenters",
  "PVC Wall Panel",
  "All Types Of Waterproofing",
  "…Many More",
];

/** Default Terms & Conditions (editable per quote). */
export const DEFAULT_TERMS = `1. Rate will be revised after 10 days from the date of this quotation.
2. Please make all cheques inclusive of applicable tax.
3. Bill will be generated as per actual measurement at site.
4. Products used: Dr. Fixit, Sika & Fosroc (as applicable).
5. Water, electricity, scaffolding, accommodation & storage to be provided by client.
6. Payment Schedule: 30% advance with Work Order confirmation; 30% at 30% completion; 30% at 75% completion; balance 10% on successful completion.`;

export const DEFAULT_NOTE = "Note: Bill will be generated as per actual measurement. Work will be done within the agreed timeline.";
