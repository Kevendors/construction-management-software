"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ADD_KEY = "__add_new__";

interface AddCategorySelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { key: string; label: string }[];
  onAdd: (label: string) => string; // returns the new key
  placeholder?: string;
  className?: string;
}

export function AddCategorySelect({
  id,
  value,
  onChange,
  options,
  onAdd,
  placeholder,
  className,
}: AddCategorySelectProps) {
  const [adding, setAdding] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === ADD_KEY) {
      setAdding(true);
    } else {
      onChange(v);
    }
  }

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    const key = onAdd(label);
    onChange(key);
    setNewLabel("");
    setAdding(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      setAdding(false);
      setNewLabel("");
    }
  }

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <Input
          ref={inputRef}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Category name…"
          className="flex-1"
        />
        <Button type="button" size="sm" onClick={handleAdd} disabled={!newLabel.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setAdding(false); setNewLabel(""); }}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <select
      id={id}
      value={value}
      onChange={handleSelectChange}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
      <option value={ADD_KEY}>+ Add Category…</option>
    </select>
  );
}
