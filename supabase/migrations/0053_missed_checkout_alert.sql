-- ============================================================================
-- 0053_missed_checkout_alert.sql — daily alert to Super Admin/HR at 10:00 AM IST
-- (04:30 UTC) listing shifts from earlier dates with no check-out. Sent every
-- day until HR/Super Admin close them; no alert when there are none.
--
-- Copies the site address and secret from the existing spot-check job (0045),
-- so nothing needs replacing. Fails with a null-value error if that job doesn't
-- exist. Re-running this updates the job (same name).
-- ============================================================================

select cron.schedule(
  'sitehub-missed-checkouts',
  '30 4 * * *',
  (
    select replace(command, '/api/cron/spot-checks', '/api/cron/missed-checkouts')
    from cron.job
    where jobname = 'sitehub-spot-checks'
  )
);

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   select cron.unschedule('sitehub-missed-checkouts');
-- ----------------------------------------------------------------------------
