-- Apply after 202609280007_lounge_conversation.sql, using the trusted operator.
-- No client EXECUTE grant is needed. Supabase pg_cron runs under this operator.
select cron.schedule('isf-lounge-notification-cleanup','17 3 * * *',
  $$select individualsavingflow_private.prune_lounge_conversation();$$);
