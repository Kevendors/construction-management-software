-- ============================================================================
-- 0046_item_master_fix_truncation.sql — restore 7 entries truncated by mistake
-- ----------------------------------------------------------------------------
-- While preparing the Item Master Review doc, several very long methodology
-- descriptions were abbreviated with "..." purely for readability in that
-- report. Most were caught and restored to full text before migration 0045
-- ran, but these 7 were missed -- the abbreviated report text was what
-- actually got inserted into the Master List. This restores the real,
-- complete original wording for each, matched by the row's current id so
-- there's no ambiguity about which row is being corrected.
-- ============================================================================

update public.org_item_master set name = $IM$Dr. Fixit Roofseal Select Top Coat is a single-component, insulating elastomeric waterproof coating designed for exposed (new and old) roof surfaces. It provides a seamless, monolithic waterproof membrane that offers excellent protection against water leakage and heat while delivering superior crack-bridging properties and long-lasting weather resistance. The system shall include the application of fiber mesh reinforcement embedded within the coating at all critical areas, joints, cracks, and as specified, to enhance tensile strength, durability, and crack resistance. The coating is easy to apply using a brush or roller and does not require any additional protective coating, even on roofs subjected to normal foot traffic. The complete application shall be carried out as per the manufacturer's specifications and recommendations.$IM$ where id = 'a4ab2b5d-d547-4dcb-9966-ccb81e2f5c4b';

update public.org_item_master set name = $IM$Lift pit
Krystalline is composed of high quality cement,
properly selected & graded inert aggregates,
proprietary waterproofing active chemicals &
additives. It is used as a chemically active
waterproofing treatment for concrete. Dr.Fixit
Krystalline when mixed with water and applied as a
brush coat to concrete, it penetrates deeply into the
capillaries of the concrete & protects it against the
permeability of water.
(Product use: Dr. Fixit / Bostik / Perma)$IM$ where id = 'd25486dc-72f5-474f-b3a1-1b1cc84cfd3d';

update public.org_item_master set name = $IM$**Deployment of Junior Engineer for Site Monitoring and Supervision**
Deployment of one Junior Engineer for 60 days, working 8 hours per day at the project site. The Junior Engineer will remain at the site and monitor the ongoing civil works, work progress, quality, and execution on a regular basis.$IM$ where id = '9d12d0db-faa1-4cd0-ab7e-cffb5e36c7c7';

update public.org_item_master set name = $IM$**PU Grouting**• Pre-inspection and marking: Identify the leakage path and mark repair spots along the damp or dripping concrete surface.
• Drilling holes: Drill 16mm-wide holes at a 45-degree angle intersecting the crack or void, spaced roughly 100mm to 150mm apart.
• Installing packers: Insert mechanical injection packers (metal ports with a non-return valve) tightly into the drilled holes.
• PU injection: Connect a high-pressure injection pump to inject liquid polyurethane resin into the packers from bottom to top. The resin expands upon contacting moisture, tightly sealing all hidden gaps.
• Curing and trimming: Let the foam cure for about 1 hour, then remove the protruding mechanical packers.
• Patching and finishing: Seal and patch the holes using a waterproof cementitious grout, then clean the area.$IM$ where id = '4234a7fc-e20d-4aff-bc13-6cf176c0cb7a';

update public.org_item_master set name = $IM$Micro concrete: Rebuilding the section of damaged RCC elements to its original size or as per consultants recommendations in thicknesses of Fire Sleeves on each side by providing and casting with micro concrete of grade M50 and above including providing and fixing of watertight foam faced finish shuttering of minimum 18 mm with supporting framework, all lead lift, mixing, placing, deshuttering, levelling the surface by grinding off cementitious slurry or construction joint differences if any to satisfaction of engg. incharge, curing etc. complete. (Make Fosroc & SIKA)$IM$ where id = '20f7a224-bc39-40a4-8189-4c4553f8fa64';

update public.org_item_master set name = $IM$Fly ash bricks are eco-friendly building materials made primarily from fly ash (a byproduct of coal-fired power plants), mixed with cement or lime, gypsum, sand, and water. The mixture is molded under high pressure and cured to produce strong, lightweight, and dimensionally accurate bricks$IM$ where id = '8f9205d6-4117-4769-a62f-4fa223847f24';

update public.org_item_master set name = $IM$Fly ash blocks are larger masonry units manufactured using fly ash, cement, sand or stone dust, and water. They are designed to replace conventional concrete blocks and clay bricks, offering faster construction and better thermal performance.$IM$ where id = 'be349d65-332d-4ac2-acd9-d1d2552d1337';

-- ----------------------------------------------------------------------------
-- ROLLBACK: the org_item_master_backup_20261022 table does not help here
-- (these rows didn't exist at that backup's snapshot time) -- re-run with the
-- old truncated text if you ever need to revert, though there's no reason to.
-- ----------------------------------------------------------------------------
