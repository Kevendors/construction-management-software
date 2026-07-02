"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import type { Department, Employee } from "@/lib/types";

const DEPARTMENTS: { key: Department; label: string }[] = [
  { key: "engineering", label: "Engineering" },
  { key: "design", label: "Design" },
  { key: "site", label: "Site" },
  { key: "accounts", label: "Accounts" },
  { key: "admin", label: "Admin" },
];

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface EmployeeDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (emp: Omit<Employee, "id">) => void;
  initial?: Employee;
}

export function EmployeeDialog({ open, onClose, onSave, initial }: EmployeeDialogProps) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [designation, setDesignation] = React.useState(initial?.designation ?? "");
  const [department, setDepartment] = React.useState<Department>(initial?.department ?? "site");
  const [monthlyCtc, setMonthlyCtc] = React.useState(initial?.monthlyCtc?.toString() ?? "");
  const [joinDate, setJoinDate] = React.useState(initial?.joinDate ?? new Date().toISOString().slice(0, 10));
  const [phone, setPhone] = React.useState(initial?.phone ?? "");

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDesignation(initial?.designation ?? "");
      setDepartment(initial?.department ?? "site");
      setMonthlyCtc(initial?.monthlyCtc?.toString() ?? "");
      setJoinDate(initial?.joinDate ?? new Date().toISOString().slice(0, 10));
      setPhone(initial?.phone ?? "");
    }
  }, [open, initial]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      designation: designation.trim(),
      department,
      monthlyCtc: Number(monthlyCtc) || 0,
      joinDate,
      phone: phone.trim(),
      initials: getInitials(name.trim()),
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? "Edit Employee" : "Add Employee"}
      description="Employee data is stored in this browser."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Full Name</Label>
            <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-designation">Designation</Label>
            <Input id="emp-designation" value={designation} onChange={(e) => setDesignation(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="emp-dept">Department</Label>
            <Select id="emp-dept" value={department} onChange={(e) => setDepartment(e.target.value as Department)}>
              {DEPARTMENTS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-ctc">Monthly CTC (INR)</Label>
            <Input id="emp-ctc" type="number" value={monthlyCtc} onChange={(e) => setMonthlyCtc(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="emp-join">Join Date</Label>
            <Input id="emp-join" type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-phone">Phone</Label>
            <Input id="emp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">{initial ? "Update" : "Add Employee"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
