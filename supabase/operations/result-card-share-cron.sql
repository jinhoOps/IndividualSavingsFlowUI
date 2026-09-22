-- Apply only after Edge Functions and Vault secrets are ready.
-- Vault names: isf_result_card_project_url, isf_result_card_cleanup_secret.
-- No credentials are embedded in Cron commands or migration history.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule('isf-result-card-cleanup', '*/5 * * * *', $job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='isf_result_card_project_url') || '/functions/v1/cleanup-result-card-shares',
  headers := jsonb_build_object('Content-Type','application/json','x-result-card-cleanup',(select decrypted_secret from vault.decrypted_secrets where name='isf_result_card_cleanup_secret')),
  body := '{}'::jsonb, timeout_milliseconds := 120000
 );
$job$);
select cron.schedule('isf-result-card-inventory', '17 3 * * *', $job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='isf_result_card_project_url') || '/functions/v1/cleanup-result-card-shares',
  headers := jsonb_build_object('Content-Type','application/json','x-result-card-cleanup',(select decrypted_secret from vault.decrypted_secrets where name='isf_result_card_cleanup_secret')),
  body := '{"mode":"inventory"}'::jsonb, timeout_milliseconds := 120000
 );
$job$);
select cron.schedule('isf-result-card-log-retention', '27 3 * * *', $job$
 delete from cron.job_run_details where end_time < now()-interval '7 days'
 and jobid in(select jobid from cron.job where jobname in ('isf-result-card-cleanup','isf-result-card-inventory','isf-result-card-log-retention'));
 delete from public.result_card_share_runs where created_at < now()-interval '7 days';
$job$);
