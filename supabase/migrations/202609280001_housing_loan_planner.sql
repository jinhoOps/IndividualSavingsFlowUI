-- Versioned Main expense extension. Workspace and public RPC protocol remain v5.
-- No account row is rewritten: only explicit new loan saves adopt assistant v2.
begin;

create function private.loan_month_index(v text) returns integer language plpgsql immutable set search_path='' as $$
begin
 if v is null or v !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then return null; end if;
 if substring(v,1,4)::integer < 1900 then return null; end if;
 return substring(v,1,4)::integer*12 + substring(v,6,2)::integer - 1;
end $$;

create function private.valid_housing_loan(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare first_month integer;
begin
 if not coalesce(private.exact_keys(v,array['id','name','method','basis','principalWon','annualRateBps','rateType','months','graceMonths','firstPaymentMonth']),false) then return false; end if;
 if jsonb_typeof(v->'id') <> 'string' or (v->>'id') !~ '^[a-zA-Z0-9-]{1,64}$'
   or jsonb_typeof(v->'name') <> 'string' or length(v->>'name') > 40 or (v->>'name') !~ '[^[:space:]]'
   or not coalesce(private.enum_value(v->'method',array['equal-payment','equal-principal','bullet']),false)
   or not coalesce(private.enum_value(v->'basis',array['new','remaining']),false)
   or not coalesce(private.enum_value(v->'rateType',array['fixed','variable']),false)
   or not coalesce(private.integer_value(v->'principalWon'),false) or not coalesce(private.integer_value(v->'annualRateBps'),false)
   or not coalesce(private.integer_value(v->'months'),false) or not coalesce(private.integer_value(v->'graceMonths'),false)
   or jsonb_typeof(v->'firstPaymentMonth') <> 'string' then return false; end if;
 if (v->>'principalWon')::numeric not between 1 and 1000000000000 or (v->>'annualRateBps')::numeric not between 0 and 10000
   or (v->>'months')::numeric not between 1 and 600 or (v->>'graceMonths')::numeric >= (v->>'months')::numeric
   or (v->>'method'='bullet' and (v->>'graceMonths')::numeric <> 0) then return false; end if;
 first_month:=private.loan_month_index(v->>'firstPaymentMonth');
 return first_month is not null and first_month+(v->>'months')::integer <= 120000;
end $$;

create function private.valid_housing_loans(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare loan jsonb; ids text[]:=array[]::text[];
begin
 if not coalesce(private.exact_keys(v,array['month','loans','paymentOverrideWon']),false)
   or jsonb_typeof(v->'month') <> 'string' or private.loan_month_index(v->>'month') is null
   or jsonb_typeof(v->'loans') <> 'array' then return false; end if;
 if jsonb_array_length(v->'loans') > 10 then return false; end if;
 if v->'paymentOverrideWon' <> 'null'::jsonb and (not coalesce(private.integer_value(v->'paymentOverrideWon'),false)
   or (v->>'paymentOverrideWon')::numeric > 10000000000000) then return false; end if;
 for loan in select value from jsonb_array_elements(v->'loans') loop
   if not private.valid_housing_loan(loan) or (loan->>'id')=any(ids) then return false; end if;
   ids:=array_append(ids,loan->>'id');
 end loop;
 return true;
end $$;

create function private.housing_loan_month(loan jsonb, selected_month text) returns jsonb language plpgsql immutable set search_path='' as $$
declare principal numeric; balance numeric; bps numeric; n integer; term integer; grace integer; selected integer;
 level_payment numeric; level_principal numeric; power_value numeric; interest numeric; paid numeric; maturity numeric; k integer;
begin
 if not private.valid_housing_loan(loan) or private.loan_month_index(selected_month) is null then return null; end if;
 term:=(loan->>'months')::integer; grace:=(loan->>'graceMonths')::integer;
 selected:=private.loan_month_index(selected_month)-private.loan_month_index(loan->>'firstPaymentMonth');
 if selected<0 or selected>=term then return jsonb_build_object('regularWon',0,'maturityWon',0); end if;
 principal:=(loan->>'principalWon')::numeric; balance:=principal; bps:=(loan->>'annualRateBps')::numeric; n:=term-grace;
 if bps=0 then level_payment:=round(principal/n); else
   power_value:=power(120000::numeric+bps,n);
   level_payment:=round(principal*bps*power_value/(120000*(power_value-power(120000::numeric,n))));
 end if;
 level_principal:=round(principal/n);
 for k in 0..selected loop
   interest:=round(balance*bps/120000);
   paid:=case when k=term-1 then balance when k<grace or loan->>'method'='bullet' then 0
     when loan->>'method'='equal-principal' then level_principal else level_payment-interest end;
   paid:=greatest(0,least(balance,paid)); balance:=balance-paid;
 end loop;
 maturity:=case when loan->>'method'='bullet' and selected=term-1 then paid else 0 end;
 return jsonb_build_object('regularWon',paid+interest-maturity,'maturityWon',maturity);
end $$;

create function private.expense_draft_totals(v jsonb, complete boolean default false) returns jsonb language plpgsql immutable set search_path='' as $$
declare answers jsonb:=v->'answers'; plan jsonb:=v->'housingLoans'; loan jsonb; totals jsonb; regular numeric:=0; housing numeric; living numeric;
begin
 if private.expense_totals(answers,false) is null then return null; end if;
 if plan is not null and plan <> 'null'::jsonb then
   if not private.valid_housing_loans(plan) then return null; end if;
   answers:=jsonb_set(answers,'{housingInterest}',jsonb_build_object('amountWon',0,'period','month'));
   for loan in select value from jsonb_array_elements(plan->'loans') loop
     regular:=regular+(private.housing_loan_month(loan,plan->>'month')->>'regularWon')::numeric;
   end loop;
   if plan->'paymentOverrideWon' <> 'null'::jsonb then regular:=(plan->>'paymentOverrideWon')::numeric; end if;
 end if;
 totals:=private.expense_totals(answers,complete); if totals is null then return null; end if;
 housing:=(totals->>'housingWon')::numeric+regular; living:=(totals->>'livingWon')::numeric;
 if housing+living>9007199254740991 then return null; end if;
 return jsonb_build_object('housingWon',housing,'livingWon',living,'totalWon',housing+living);
end $$;

create or replace function private.valid_expense_draft(v jsonb) returns boolean language sql immutable set search_path='' as $$
 select (private.exact_keys(v,array['answers','step','updatedAt']) or private.exact_keys(v,array['answers','step','updatedAt','housingLoans']))
   and private.timestamp_value(v->'updatedAt') and private.enum_value(v->'step',private.expense_item_ids() || array['review'])
   and private.expense_draft_totals(v) is not null
$$;

create or replace function private.valid_expense_assistant(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare applied jsonb:=v->'lastApplied';
begin
 if v='null'::jsonb then return true; end if;
 if not coalesce(private.exact_keys(v,array['schemaVersion','draft','lastApplied']),false)
   or not coalesce(v->'schemaVersion' in ('1'::jsonb,'2'::jsonb),false)
   or not coalesce(private.valid_expense_draft(v->'draft'),false)
   or ((v->'schemaVersion'='2'::jsonb) is distinct from ((v->'draft') ? 'housingLoans')) then return false; end if;
 if applied='null'::jsonb then return true; end if;
 if not coalesce(private.exact_keys(applied,array['answers','appliedAt']) or private.exact_keys(applied,array['answers','appliedAt','housingLoans']),false)
   or not coalesce(private.timestamp_value(applied->'appliedAt'),false)
   or (v->'schemaVersion'='1'::jsonb and applied ? 'housingLoans') then return false; end if;
 return private.expense_draft_totals(applied,true) is not null;
end $$;

create or replace function private.expense_main(current_main jsonb, requested_main jsonb, complete boolean) returns jsonb
language plpgsql volatile set search_path='' as $$
declare draft jsonb:=requested_main#>'{expenseAssistant,draft}'; totals jsonb; applied jsonb:=current_main->'applied'; assistant jsonb; stamp numeric; last_applied jsonb;
begin
 if applied='null'::jsonb or not coalesce(private.valid_expense_draft(draft),false) then return null; end if;
 -- An old open tab must not replace a v2 loan plan with its v1 answers.
 if current_main#>'{expenseAssistant,schemaVersion}'='2'::jsonb and not (draft ? 'housingLoans') then return null; end if;
 totals:=private.expense_draft_totals(draft,complete); if totals is null then return null; end if;
 assistant:=jsonb_build_object('schemaVersion',case when draft ? 'housingLoans' then 2 else 1 end,'draft',draft,
   'lastApplied',coalesce(current_main#>'{expenseAssistant,lastApplied}','null'::jsonb));
 if complete then
   stamp:=greatest(floor(extract(epoch from clock_timestamp())*1000),(applied->>'updatedAt')::numeric+1);
   if stamp>8640000000000000 then return null; end if;
   last_applied:=jsonb_build_object('answers',draft->'answers','appliedAt',stamp);
   if draft ? 'housingLoans' then last_applied:=last_applied || jsonb_build_object('housingLoans',draft->'housingLoans'); end if;
   assistant:=jsonb_set(assistant,'{draft,step}','"review"'::jsonb) || jsonb_build_object('lastApplied',last_applied);
   if applied->'monthlyHousingWon' <> totals->'housingWon' or applied->'monthlyLivingWon' <> totals->'livingWon' then
     applied:=applied || jsonb_build_object('monthlyHousingWon',totals->'housingWon','monthlyLivingWon',totals->'livingWon','updatedAt',stamp);
   end if;
 end if;
 return current_main || jsonb_build_object('applied',applied,'expenseAssistant',assistant);
end $$;

revoke all on function private.loan_month_index(text), private.valid_housing_loan(jsonb), private.valid_housing_loans(jsonb),
 private.housing_loan_month(jsonb,text), private.expense_draft_totals(jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function private.loan_month_index(text), private.valid_housing_loan(jsonb), private.valid_housing_loans(jsonb),
 private.housing_loan_month(jsonb,text), private.expense_draft_totals(jsonb,boolean) to workspace_rpc_owner;
commit;
