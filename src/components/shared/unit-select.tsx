"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { addOrgUnitAction, listOrgUnitsAction } from "@/app/item-master/actions";

const ADD_NEW = "__add_new_unit__";

/**
 * Unit dropdown for Quotation/Invoice/Purchase Bill line items — the fixed
 * base list (SQFT/SQM/.../LS) plus any custom units this org has already
 * added, with a "+ Add new unit…" option that saves it (org_units,
 * migration 0038) so it's offered everywhere next time instead of staying
 * one-document free text.
 */
export function UnitSelect({
  value,
  onChange,
  baseUnits,
  className,
}: {
  value: string;
  onChange: (unit: string) => void;
  baseUnits: string[];
  className?: string;
}) {
  const [orgUnits, setOrgUnits] = React.useState<string[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [newUnit, setNewUnit] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    listOrgUnitsAction().then(setOrgUnits);
  }, []);

  const options = Array.from(new Set([...baseUnits, ...orgUnits, ...(value ? [value] : [])]));

  async function saveNewUnit() {
    const u = newUnit.trim().toUpperCase();
    if (!u) {
      setAdding(false);
      return;
    }
    setSaving(true);
    await addOrgUnitAction(u);
    setSaving(false);
    setOrgUnits((prev) => Array.from(new Set([...prev, u])));
    onChange(u);
    setAdding(false);
    setNewUnit("");
  }

  if (adding) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={newUnit}
          onChange={(e) => setNewUnit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveNewUnit();
            } else if (e.key === "Escape") {
              setAdding(false);
              setNewUnit("");
            }
          }}
          onBlur={() => !newUnit.trim() && setAdding(false)}
          placeholder="e.g. DRUM"
          className={className}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 px-2 text-xs"
          disabled={saving}
          onClick={saveNewUnit}
        >
          {saving ? "…" : "OK"}
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value}
      onChange={(e) => (e.target.value === ADD_NEW ? setAdding(true) : onChange(e.target.value))}
      className={className}
    >
      <option value="">—</option>
      {options.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new unit…</option>
    </Select>
  );
}
