-- ============================================================================
-- SiteHub — demo seed
-- Populates the tables the data-access layer (src/lib/data/) currently reads,
-- so every migrated page (dashboard, analytics, clients, projects, design,
-- quotations, invoices) shows real data the moment you point .env.local at this
-- database. Mirrors src/lib/mock/data.ts. Remaining modules (material, subcon,
-- payroll, equipment, …) get seeded as those read paths are migrated.
--
-- Apply AFTER 0001_init.sql, e.g.  supabase db reset  (runs migration + seed),
-- or paste this whole file into the SQL editor.
--
-- Person-linked columns (pm_id, assignee_id, author_id, …) are left NULL because
-- profiles reference auth.users; backfill them once your team has signed up.
--
-- Stable UUIDs: pg_temp.sid('kind:code') = md5(...)::uuid, recomputable for FKs.
-- ============================================================================

create function pg_temp.sid(text) returns uuid language sql immutable as $$
  select md5($1)::uuid
$$;

-- one org; every row hangs off it
insert into orgs (id, name, gstin) values
  (pg_temp.sid('org:charu'), 'Charu Construction & Design', '09AAACH0000A1Z5');

-- ---------- clients ----------
insert into clients (id, org_id, name, company, email, phone, address, gst, created_at) values
  (pg_temp.sid('client:c1'), pg_temp.sid('org:charu'), 'Rakesh Agarwal', 'Agarwal Estates Pvt Ltd', 'rakesh@agarwalestates.in', '+91 98100 11223', 'Sector 62, Noida, UP', '09AABCA1234L1ZP', '2025-09-12'),
  (pg_temp.sid('client:c2'), pg_temp.sid('org:charu'), 'Meera Sharma', 'Sharma Residency', 'meera.sharma@gmail.com', '+91 99710 44556', 'Vasant Kunj, New Delhi', '07ABXPS5678K1Z2', '2025-10-03'),
  (pg_temp.sid('client:c3'), pg_temp.sid('org:charu'), 'Imtiaz Khan', 'Crescent Hospitality', 'imtiaz@crescenthotels.com', '+91 90045 78901', 'MG Road, Gurugram, HR', '06AADCC9012M1Z8', '2025-11-20'),
  (pg_temp.sid('client:c4'), pg_temp.sid('org:charu'), 'Lakshmi Iyer', 'Iyer Family Trust', 'lakshmi.iyer@outlook.com', '+91 98860 23344', 'Indiranagar, Bengaluru, KA', '29AAATI3456N1Z1', '2026-01-08');

-- ---------- projects ----------
insert into projects (id, org_id, code, name, client_id, value, status, start_date, end_date, percent_complete, location) values
  (pg_temp.sid('project:p1'), pg_temp.sid('org:charu'), 'SH-001', 'Agarwal Corporate Tower', pg_temp.sid('client:c1'), 48500000, 'ongoing', '2025-10-01', '2026-09-30', 62, 'Sector 62, Noida'),
  (pg_temp.sid('project:p2'), pg_temp.sid('org:charu'), 'SH-002', 'Sharma Villa Renovation', pg_temp.sid('client:c2'), 9800000, 'ongoing', '2025-11-15', '2026-07-31', 81, 'Vasant Kunj, Delhi'),
  (pg_temp.sid('project:p3'), pg_temp.sid('org:charu'), 'SH-003', 'Crescent Boutique Hotel', pg_temp.sid('client:c3'), 73200000, 'ongoing', '2026-01-10', '2027-03-31', 28, 'MG Road, Gurugram'),
  (pg_temp.sid('project:p4'), pg_temp.sid('org:charu'), 'SH-004', 'Iyer Residence', pg_temp.sid('client:c4'), 14200000, 'planning', '2026-03-01', '2026-12-15', 8, 'Indiranagar, Bengaluru');

-- ---------- tasks ----------
insert into tasks (id, org_id, project_id, parent_id, name, start_date, end_date, status, progress_value, progress_target, unit, delay_days) values
  (pg_temp.sid('task:t1'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'Site mobilisation & excavation', '2025-10-01', '2025-11-15', 'completed', 100, 100, 'percent', 0),
  (pg_temp.sid('task:t2'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'Foundation & raft', '2025-11-16', '2026-01-20', 'completed', 100, 100, 'percent', 0),
  (pg_temp.sid('task:t3'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'RCC superstructure', '2026-01-21', '2026-06-30', 'ongoing', 8, 14, 'numbers', 0),
  (pg_temp.sid('task:t3a'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('task:t3'), 'Columns & beams (floors 1-8)', '2026-01-21', '2026-04-30', 'completed', 8, 8, 'numbers', 0),
  (pg_temp.sid('task:t3b'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('task:t3'), 'Slab casting (floors 9-14)', '2026-05-01', '2026-06-30', 'ongoing', 0, 6, 'numbers', 0),
  (pg_temp.sid('task:t4'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'Block work & plastering', '2026-04-01', '2026-07-15', 'ongoing', 3429.5, 6000, 'meter', 0),
  (pg_temp.sid('task:t5'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'MEP rough-in', '2026-05-15', '2026-08-15', 'delayed', 12, 40, 'percent', 6),
  (pg_temp.sid('task:t6'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'Facade glazing', '2026-07-01', '2026-09-15', 'not_started', 0, 100, 'percent', 0),
  (pg_temp.sid('task:t7'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'Interior fit-out & handover', '2026-08-01', '2026-09-30', 'not_started', 0, 100, 'percent', 0),
  (pg_temp.sid('task:t10'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, 'Demolition & structural strengthening', '2025-11-15', '2026-01-10', 'completed', 100, 100, 'percent', 0),
  (pg_temp.sid('task:t11'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, 'Flooring & joinery', '2026-01-11', '2026-04-30', 'completed', 100, 100, 'percent', 0),
  (pg_temp.sid('task:t12'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, 'Painting & finishes', '2026-05-01', '2026-06-30', 'ongoing', 47, 50, 'numbers', 0),
  (pg_temp.sid('task:t13'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, 'Landscaping & handover', '2026-07-01', '2026-07-31', 'not_started', 0, 100, 'percent', 0),
  (pg_temp.sid('task:t20'), pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), null, 'Piling & foundation', '2026-01-10', '2026-05-30', 'ongoing', 60, 100, 'percent', 0),
  (pg_temp.sid('task:t21'), pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), null, 'Structural frame', '2026-06-01', '2026-11-30', 'delayed', 5, 20, 'percent', 12),
  (pg_temp.sid('task:t22'), pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), null, 'Envelope & MEP', '2026-10-01', '2027-01-31', 'not_started', 0, 100, 'percent', 0),
  (pg_temp.sid('task:t30'), pg_temp.sid('org:charu'), pg_temp.sid('project:p4'), null, 'Design development & approvals', '2026-03-01', '2026-05-15', 'ongoing', 35, 100, 'percent', 0),
  (pg_temp.sid('task:t31'), pg_temp.sid('org:charu'), pg_temp.sid('project:p4'), null, 'Site preparation', '2026-05-16', '2026-06-30', 'not_started', 0, 100, 'percent', 0);

-- ---------- transactions (ledger) ----------
insert into transactions (org_id, project_id, party_id, date, direction, amount, cost_code, category, note) values
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-01-15', 'out', 4200000, 'material', 'material', 'RMC supply Jan'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-02-12', 'out', 3800000, 'material', 'material', 'Steel & block'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-03-10', 'out', 1500000, 'labour', 'salary', 'Labour wages Mar'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-04-08', 'out', 1650000, 'labour', 'salary', 'Labour wages Apr'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-04-22', 'out', 220000, 'machinery', 'site', 'Crane rental'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-05-05', 'out', 95000, 'diesel', 'site', 'DG diesel'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-05-20', 'out', 2900000, 'material', 'material', 'Block & cement'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-06-02', 'out', 1700000, 'labour', 'salary', 'Labour wages Jun'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-06-10', 'out', 480000, 'other', 'subcon', 'MEP subcon RA1'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('client:c1'), '2026-04-06', 'in', 8260000, 'other', 'other', 'INV-2026-031'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('client:c1'), '2026-06-01', 'in', 3000000, 'other', 'other', 'INV-2026-038 part'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, '2026-02-10', 'out', 1100000, 'material', 'material', 'Flooring material'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, '2026-04-15', 'out', 900000, 'labour', 'salary', 'Labour'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, '2026-05-20', 'out', 700000, 'other', 'other', 'Finishes'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), null, '2026-02-28', 'out', 5200000, 'material', 'material', 'Piling material'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), null, '2026-04-30', 'out', 2100000, 'labour', 'salary', 'Labour'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), pg_temp.sid('client:c3'), '2026-03-21', 'in', 11800000, 'other', 'other', 'INV-2026-029');

-- ---------- sales invoices + items ----------
insert into sales_invoices (id, org_id, number, project_id, client_id, date, due_date, tax_rate, received, status) values
  (pg_temp.sid('inv:inv1'), pg_temp.sid('org:charu'), 'INV-2026-031', pg_temp.sid('project:p1'), pg_temp.sid('client:c1'), '2026-04-05', '2026-05-05', 18, 8260000, 'paid'),
  (pg_temp.sid('inv:inv2'), pg_temp.sid('org:charu'), 'INV-2026-038', pg_temp.sid('project:p1'), pg_temp.sid('client:c1'), '2026-05-28', '2026-06-27', 18, 3000000, 'partial'),
  (pg_temp.sid('inv:inv3'), pg_temp.sid('org:charu'), 'INV-2026-040', pg_temp.sid('project:p2'), pg_temp.sid('client:c2'), '2026-06-01', '2026-07-01', 18, 0, 'sent'),
  (pg_temp.sid('inv:inv4'), pg_temp.sid('org:charu'), 'INV-2026-029', pg_temp.sid('project:p3'), pg_temp.sid('client:c3'), '2026-03-20', '2026-04-20', 18, 11800000, 'paid');

insert into invoice_items (org_id, invoice_id, description, qty, unit, rate) values
  (pg_temp.sid('org:charu'), pg_temp.sid('inv:inv1'), 'RA Bill #3 — superstructure milestone', 1, 'lot', 7000000),
  (pg_temp.sid('org:charu'), pg_temp.sid('inv:inv2'), 'RA Bill #4 — block work milestone', 1, 'lot', 5500000),
  (pg_temp.sid('org:charu'), pg_temp.sid('inv:inv3'), 'Finishing stage milestone', 1, 'lot', 2200000),
  (pg_temp.sid('org:charu'), pg_temp.sid('inv:inv4'), 'Mobilisation advance + RA Bill #1', 1, 'lot', 10000000);

-- ---------- BOQ + items ----------
insert into boqs (id, org_id, project_id) values
  (pg_temp.sid('boq:b1'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1')),
  (pg_temp.sid('boq:b2'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'));

insert into boq_items (org_id, boq_id, description, cost_code, qty, unit, rate) values
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'RCC works (M30) incl. steel & formwork', 'material', 2800, 'cum', 8200),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'Block work & plaster', 'material', 6000, 'sqm', 850),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'Structural steel — facade support', 'material', 42, 'MT', 78000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'Skilled & unskilled labour', 'labour', 1, 'lot', 6800000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'Tower crane & hoist', 'machinery', 11, 'month', 220000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'DG & site power (diesel)', 'diesel', 11, 'month', 95000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'MEP & finishes', 'other', 1, 'lot', 7400000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b2'), 'Structural strengthening', 'material', 1, 'lot', 1200000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b2'), 'Flooring & joinery', 'material', 1, 'lot', 2400000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b2'), 'Labour', 'labour', 1, 'lot', 1900000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b2'), 'Finishes & landscaping', 'other', 1, 'lot', 1600000);

-- ---------- quotations + items ----------
insert into quotations (id, org_id, number, client_id, project_name, date, valid_until, status, tax_rate) values
  (pg_temp.sid('qtn:q1'), pg_temp.sid('org:charu'), 'QTN-2026-014', pg_temp.sid('client:c4'), 'Iyer Residence', '2026-02-02', '2026-03-04', 'accepted', 18),
  (pg_temp.sid('qtn:q2'), pg_temp.sid('org:charu'), 'QTN-2026-021', pg_temp.sid('client:c3'), 'Crescent — Phase 2 spa wing', '2026-05-18', '2026-06-18', 'sent', 18);

insert into quotation_items (org_id, quotation_id, description, qty, unit, rate) values
  (pg_temp.sid('org:charu'), pg_temp.sid('qtn:q1'), 'Architectural design & drawings', 1, 'lot', 950000),
  (pg_temp.sid('org:charu'), pg_temp.sid('qtn:q1'), 'Civil construction (built-up)', 4200, 'sqft', 2200),
  (pg_temp.sid('org:charu'), pg_temp.sid('qtn:q1'), 'Interior fit-out', 1, 'lot', 2800000),
  (pg_temp.sid('org:charu'), pg_temp.sid('qtn:q2'), 'Spa & wellness wing construction', 1, 'lot', 8200000),
  (pg_temp.sid('org:charu'), pg_temp.sid('qtn:q2'), 'Specialised MEP', 1, 'lot', 1900000);

-- ---------- drawings + versions ----------
insert into drawings (id, org_id, project_id, title, discipline, current_rev, status) values
  (pg_temp.sid('dwg:dr1'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), 'General Arrangement Plan', 'architectural', 'C', 'approved'),
  (pg_temp.sid('dwg:dr2'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), 'Structural Framing — Typical Floor', 'structural', 'B', 'for_review'),
  (pg_temp.sid('dwg:dr3'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), 'MEP Services Layout', 'mep', 'A', 'draft'),
  (pg_temp.sid('dwg:dr4'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), 'Interior Layout — Ground Floor', 'interior', 'D', 'approved');

insert into drawing_versions (org_id, drawing_id, rev, date, notes, file_kb) values
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr1'), 'A', '2025-09-20', 'Initial issue for client review', 4800),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr1'), 'B', '2025-10-30', 'Core relocated per structural input', 4950),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr1'), 'C', '2026-06-08', 'Lift lobby revised; approved for construction', 5120),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr2'), 'A', '2025-11-02', 'First structural issue', 3600),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr2'), 'B', '2026-06-05', 'M30 grade note added (SR-12)', 3720),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr3'), 'A', '2026-05-20', 'Draft coordination model export', 6200),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr4'), 'A', '2025-11-20', 'Concept', 2800),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr4'), 'B', '2025-12-15', 'Client revisions r1', 2900),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr4'), 'C', '2026-02-10', 'Matte door finish', 3000),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr4'), 'D', '2026-05-01', 'Final for execution', 3050);

-- ---------- suppliers ----------
insert into suppliers (id, org_id, name, company, contact, phone, email, gst, address) values
  (pg_temp.sid('supplier:s1'), pg_temp.sid('org:charu'), 'Sunil Verma', 'UltraBuild Materials Pvt Ltd', 'Sunil Verma', '+91 98110 22001', 'sales@ultrabuild.in', '09AAACU1234F1ZV', 'Industrial Area, Sahibabad, UP'),
  (pg_temp.sid('supplier:s2'), pg_temp.sid('org:charu'), 'Farah Sheikh', 'SteelLine Traders', 'Farah Sheikh', '+91 99100 55002', 'orders@steelline.co.in', '07AAFCS5678G1Z3', 'Wazirpur, New Delhi'),
  (pg_temp.sid('supplier:s3'), pg_temp.sid('org:charu'), 'Mahesh Pillai', 'Crescent Electricals & Plumbing', 'Mahesh Pillai', '+91 90080 33003', 'info@crescentep.com', '06AAGCC9012H1Z9', 'Sector 18, Gurugram, HR');

-- ---------- material items (warehouse) ----------
insert into material_items (id, org_id, name, category, unit, stock_qty, reorder_level, rate) values
  (pg_temp.sid('mat:m1'), pg_temp.sid('org:charu'), 'OPC 53 Grade Cement', 'cement', 'bag', 180, 200, 410),
  (pg_temp.sid('mat:m2'), pg_temp.sid('org:charu'), 'TMT Steel Bar 16mm', 'steel', 'MT', 8.5, 6, 71500),
  (pg_temp.sid('mat:m3'), pg_temp.sid('org:charu'), 'TMT Steel Bar 12mm', 'steel', 'MT', 3.2, 5, 72000),
  (pg_temp.sid('mat:m4'), pg_temp.sid('org:charu'), 'Coarse Aggregate 20mm', 'aggregate', 'cum', 240, 150, 1450),
  (pg_temp.sid('mat:m5'), pg_temp.sid('org:charu'), 'River Sand', 'aggregate', 'cum', 95, 120, 2100),
  (pg_temp.sid('mat:m6'), pg_temp.sid('org:charu'), 'AAC Block 600x200x200', 'blocks', 'no', 4200, 3000, 62),
  (pg_temp.sid('mat:m7'), pg_temp.sid('org:charu'), 'PVC Conduit 25mm', 'electrical', 'm', 380, 500, 38),
  (pg_temp.sid('mat:m8'), pg_temp.sid('org:charu'), 'CPVC Pipe 1in', 'plumbing', 'm', 620, 400, 145);

-- ---------- material requests + lines (by_id null until users exist) ----------
insert into material_requests (id, org_id, number, project_id, date, status, note) values
  (pg_temp.sid('mr:mr1'), pg_temp.sid('org:charu'), 'MR-2026-051', pg_temp.sid('project:p1'), '2026-06-16', 'approved', 'Floor 9 slab pour'),
  (pg_temp.sid('mr:mr2'), pg_temp.sid('org:charu'), 'MR-2026-054', pg_temp.sid('project:p1'), '2026-06-18', 'pending', 'MEP rough-in floor 4'),
  (pg_temp.sid('mr:mr3'), pg_temp.sid('org:charu'), 'MR-2026-055', pg_temp.sid('project:p3'), '2026-06-17', 'pending', 'Piling reinforcement');

insert into material_request_lines (org_id, request_id, material_item_id, qty) values
  (pg_temp.sid('org:charu'), pg_temp.sid('mr:mr1'), pg_temp.sid('mat:m1'), 220),
  (pg_temp.sid('org:charu'), pg_temp.sid('mr:mr1'), pg_temp.sid('mat:m2'), 4),
  (pg_temp.sid('org:charu'), pg_temp.sid('mr:mr2'), pg_temp.sid('mat:m7'), 300),
  (pg_temp.sid('org:charu'), pg_temp.sid('mr:mr2'), pg_temp.sid('mat:m8'), 120),
  (pg_temp.sid('org:charu'), pg_temp.sid('mr:mr3'), pg_temp.sid('mat:m3'), 6);

-- ---------- purchase orders + items ----------
insert into purchase_orders (id, org_id, number, supplier_id, project_id, date, status, tax_rate, discount, terms, payment_terms) values
  (pg_temp.sid('po:po1'), pg_temp.sid('org:charu'), 'PO-2026-088', pg_temp.sid('supplier:s1'), pg_temp.sid('project:p1'), '2026-06-10', 'received', 28, 12000, 'Delivery within 3 days at site. Material to conform to IS standards. Rejected material to be lifted by supplier.', '50% advance, balance within 30 days of delivery.'),
  (pg_temp.sid('po:po2'), pg_temp.sid('org:charu'), 'PO-2026-092', pg_temp.sid('supplier:s2'), pg_temp.sid('project:p1'), '2026-06-15', 'sent', 18, 0, 'Material to be delivered in single lot. Test certificates required.', 'Net 45 days from delivery.');

insert into po_items (id, org_id, po_id, description, material_item_id, qty, unit, rate) values
  (pg_temp.sid('poitem:poi1'), pg_temp.sid('org:charu'), pg_temp.sid('po:po1'), 'OPC 53 Grade Cement', pg_temp.sid('mat:m1'), 400, 'bag', 410),
  (pg_temp.sid('poitem:poi2'), pg_temp.sid('org:charu'), pg_temp.sid('po:po1'), 'Coarse Aggregate 20mm', pg_temp.sid('mat:m4'), 120, 'cum', 1450),
  (pg_temp.sid('poitem:poi3'), pg_temp.sid('org:charu'), pg_temp.sid('po:po2'), 'TMT Steel Bar 16mm', pg_temp.sid('mat:m2'), 6, 'MT', 71500),
  (pg_temp.sid('poitem:poi4'), pg_temp.sid('org:charu'), pg_temp.sid('po:po2'), 'TMT Steel Bar 12mm', pg_temp.sid('mat:m3'), 4, 'MT', 72000);

-- ---------- goods receipts + lines, booking ----------
insert into goods_receipts (id, org_id, number, po_id, date) values
  (pg_temp.sid('grn:gr1'), pg_temp.sid('org:charu'), 'GRN-2026-061', pg_temp.sid('po:po1'), '2026-06-13');

insert into goods_receipt_lines (org_id, receipt_id, po_item_id, qty_received) values
  (pg_temp.sid('org:charu'), pg_temp.sid('grn:gr1'), pg_temp.sid('poitem:poi1'), 400),
  (pg_temp.sid('org:charu'), pg_temp.sid('grn:gr1'), pg_temp.sid('poitem:poi2'), 120);

insert into purchase_bookings (org_id, po_id, bill_no, date, amount, status) values
  (pg_temp.sid('org:charu'), pg_temp.sid('po:po1'), 'UB/2026/2231', '2026-06-14', 384000, 'booked');

-- ---------- material usage ----------
insert into material_usage (org_id, project_id, material_item_id, qty, date, ref) values
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m1'), 220, '2026-06-17', 'Floor 9 slab'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m4'), 80, '2026-06-17', 'Floor 9 slab'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m6'), 1800, '2026-06-12', 'Block work floor 6'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m2'), 3.5, '2026-06-16', 'Column reinforcement');

-- ---------- subcontractors ----------
insert into subcontractors (id, org_id, name, company, trade, contact, phone, gst) values
  (pg_temp.sid('sub:sc1'), pg_temp.sid('org:charu'), 'Ravi Yadav', 'Yadav RCC Works', 'rcc', 'Ravi Yadav', '+91 98730 11221', '09ADFPY1122A1ZK'),
  (pg_temp.sid('sub:sc2'), pg_temp.sid('org:charu'), 'Anil Kumar', 'PowerFlow MEP Services', 'mep', 'Anil Kumar', '+91 99580 44556', '07AEKPK3344B1Z2'),
  (pg_temp.sid('sub:sc3'), pg_temp.sid('org:charu'), 'Deepak Shah', 'ClearView Facade Systems', 'facade', 'Deepak Shah', '+91 90250 77889', '06AFLPS5566C1Z7');

-- ---------- subcon work orders + items ----------
insert into subcon_work_orders (id, org_id, number, subcontractor_id, project_id, date, status, tax_rate, signatory) values
  (pg_temp.sid('wo:wo1'), pg_temp.sid('org:charu'), 'WO-2026-017', pg_temp.sid('sub:sc1'), pg_temp.sid('project:p1'), '2026-02-01', 'in_progress', 18, 'Priya Nair (Project Manager)'),
  (pg_temp.sid('wo:wo2'), pg_temp.sid('org:charu'), 'WO-2026-024', pg_temp.sid('sub:sc2'), pg_temp.sid('project:p1'), '2026-05-10', 'issued', 18, 'Priya Nair (Project Manager)');

insert into wo_items (org_id, work_order_id, description, qty, unit, rate) values
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo1'), 'RCC superstructure — labour & shuttering (per cum)', 2800, 'cum', 1850),
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo1'), 'Steel cutting, bending & tying (per MT)', 320, 'MT', 6500),
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo2'), 'MEP rough-in — electrical & plumbing (lumpsum)', 1, 'lot', 2400000);

-- ---------- subcon progress ----------
insert into subcon_progress (org_id, work_order_id, date, percent, note) values
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo1'), '2026-04-30', 45, 'Columns & beams floors 1-8 complete'),
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo1'), '2026-06-15', 58, 'Slab casting floors 9-11 in progress'),
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo2'), '2026-06-12', 12, 'Conduiting floor 4 started');

-- ---------- material issues to subcontractors ----------
insert into material_issues (org_id, subcontractor_id, project_id, material_item_id, qty, date) values
  (pg_temp.sid('org:charu'), pg_temp.sid('sub:sc1'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m2'), 3.5, '2026-06-16'),
  (pg_temp.sid('org:charu'), pg_temp.sid('sub:sc2'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m7'), 150, '2026-06-18');

-- ---------- RA bills (gross − deductions = net) ----------
insert into ra_bills (org_id, number, work_order_id, date, percent_complete, gross_amount, deductions, net_amount, status) values
  (pg_temp.sid('org:charu'), 'RA-WO017-03', pg_temp.sid('wo:wo1'), '2026-05-05', 45, 4660000, 233000, 4427000, 'paid'),
  (pg_temp.sid('org:charu'), 'RA-WO017-04', pg_temp.sid('wo:wo1'), '2026-06-16', 58, 1346000, 67300, 1278700, 'submitted');

-- ---------- equipment & assets ----------
insert into equipment (org_id, code, name, kind, ownership, status, project_id, monthly_rate, acquired_date) values
  (pg_temp.sid('org:charu'), 'TC-01', 'Potain Tower Crane MCi 85', 'machinery', 'rented', 'in_use', pg_temp.sid('project:p1'), 220000, '2025-11-01'),
  (pg_temp.sid('org:charu'), 'PH-02', 'Material Hoist 2T', 'machinery', 'owned', 'in_use', pg_temp.sid('project:p1'), 35000, '2021-05-10'),
  (pg_temp.sid('org:charu'), 'EX-03', 'JCB 3DX Backhoe Loader', 'machinery', 'rented', 'idle', pg_temp.sid('project:p3'), 165000, '2026-01-12'),
  (pg_temp.sid('org:charu'), 'DG-04', 'Kirloskar 125 kVA DG Set', 'machinery', 'owned', 'in_use', pg_temp.sid('project:p1'), 28000, '2020-08-20'),
  (pg_temp.sid('org:charu'), 'CM-05', 'Concrete Mixer 10/7', 'machinery', 'owned', 'maintenance', pg_temp.sid('project:p2'), 12000, '2019-03-15'),
  (pg_temp.sid('org:charu'), 'VB-06', 'Needle Vibrator Set (x4)', 'tool', 'owned', 'in_use', pg_temp.sid('project:p1'), 4000, '2023-06-01'),
  (pg_temp.sid('org:charu'), 'WT-07', 'Total Station Leica TS07', 'tool', 'owned', 'idle', null, 9000, '2022-10-05'),
  (pg_temp.sid('org:charu'), 'SC-08', 'Cup-lock Scaffolding (5T set)', 'asset', 'owned', 'in_use', pg_temp.sid('project:p1'), 45000, '2021-01-20'),
  (pg_temp.sid('org:charu'), 'PP-09', 'Diesel Pump 3in', 'tool', 'rented', 'idle', pg_temp.sid('project:p3'), 6000, '2026-02-01'),
  (pg_temp.sid('org:charu'), 'LV-10', 'Site Vehicle — Bolero Pickup', 'asset', 'owned', 'in_use', pg_temp.sid('project:p1'), 22000, '2022-04-18');

-- ----------------------------------------------------------------------------
-- After signup, link yourself to the org so RLS lets you read the above:
--   insert into memberships (org_id, user_id, role)
--   values (md5('org:charu')::uuid, auth.uid(), 'super_admin');
-- (run while authenticated, or substitute your profiles.id for auth.uid();
--  'super_admin' needs 0008_roles_enum.sql — use 'admin' on the base enum).
--
-- Non-super-admins only see projects they are assigned to (0010). Assign via
-- the project's Team tab, or by hand:
--   insert into project_members (org_id, project_id, user_id, role)
--   values (md5('org:charu')::uuid, md5('project:p1')::uuid, <profiles.id>, 'engineer');
-- ----------------------------------------------------------------------------
