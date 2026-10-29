import { departmentLabel } from "@/lib/labels";
import type { Department } from "@/lib/types";

/**
 * Department + designation pickers shared by Add Employee and Set Salary.
 * Department / designation are HR labels only — they never decide Office vs Site
 * (that is the explicit `is_office` Team setting).
 */

export const DEPARTMENT_GROUPS: { label: string; departments: Department[] }[] = [
  {
    label: "Office",
    departments: ["admin", "accounts", "hr", "sales", "digital_marketing", "business_development", "purchase", "it"],
  },
  { label: "Site / Projects", departments: ["site", "projects", "engineering", "design"] },
  { label: "Others", departments: ["others"] },
];

/** `<option>`s for a department `<Select>`, grouped with `<optgroup>`. */
export function DepartmentOptions() {
  return (
    <>
      {DEPARTMENT_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.departments.map((d) => (
            <option key={d} value={d}>
              {departmentLabel[d]}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

const OFFICE_DESIGNATIONS = [
  "Sales Executive",
  "Sales Manager",
  "Digital Marketing Executive",
  "Admin Executive",
  "Office Manager",
  "Business Development Executive",
  "Business Development Manager",
  "Accountant",
  "Accounts Manager",
  "HR Executive",
  "HR Manager",
  "Purchase Executive",
  "IT Executive",
];

const SITE_DESIGNATIONS = [
  "Site Supervisor",
  "Project Manager",
  "Site Engineer",
  "Junior Engineer",
  "Foreman",
  "Safety Officer",
  "Store Keeper",
  "Surveyor",
  "Draughtsman",
  "Architect",
];

/** Suggestion list for a designation `<Input list={id}>`; free text is still allowed. */
export function DesignationSuggestions({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {[...OFFICE_DESIGNATIONS, ...SITE_DESIGNATIONS].map((d) => (
        <option key={d} value={d} />
      ))}
    </datalist>
  );
}
