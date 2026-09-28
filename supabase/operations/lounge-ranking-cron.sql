-- Trusted operator only. Apply migration 009 and inspect this first refresh before enabling the UI.
select private.refresh_lounge_ranking();
select cron.schedule('lounge-ranking-refresh','*/15 * * * *',
  $$select private.refresh_lounge_ranking();$$);
