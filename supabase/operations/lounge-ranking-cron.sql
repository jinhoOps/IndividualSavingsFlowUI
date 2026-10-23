-- Trusted operator only. Apply migration 009 and inspect this first refresh before enabling the UI.
select individualsavingflow_private.refresh_lounge_ranking();
select cron.schedule('isf-lounge-ranking-refresh','*/15 * * * *',
  $$select individualsavingflow_private.refresh_lounge_ranking();$$);
