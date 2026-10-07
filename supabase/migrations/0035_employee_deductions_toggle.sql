-- Migration 0035: Add PF and ESI deduction toggles to employees table
alter table public.employees
  add column if not exists deduct_pf boolean not null default true,
  add column if not exists deduct_esi boolean not null default true;

comment on column public.employees.deduct_pf is 'Whether to deduct 12% Provident Fund (PF) from basic pay';
comment on column public.employees.deduct_esi is 'Whether to deduct 0.75% Employee State Insurance (ESI) from gross pay';
