-- Private parsers mirror src/workspace/domain/validation.ts and its slice parsers.
-- SQL NULL means invalid; JSON null is allowed only where explicitly handled.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.exact_keys(v jsonb, keys text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(v) = 'object' and v ?& keys
    and (select count(*) from jsonb_object_keys(case when jsonb_typeof(v)='object' then v else '{}' end)) = cardinality(keys), false)
$$;
create function private.integer_value(v jsonb, minimum numeric default 0, maximum numeric default 9007199254740991) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(case when jsonb_typeof(v)='number' then (v::text)::numeric between minimum and maximum
    and trunc((v::text)::numeric) = (v::text)::numeric else false end, false)
$$;
create function private.timestamp_value(v jsonb) returns boolean
language sql immutable set search_path = '' as $$ select private.integer_value(v, 0, 8640000000000000) $$;
create function private.string_value(v jsonb) returns boolean
language sql immutable set search_path = '' as $$ select coalesce(jsonb_typeof(v)='string' and length(v #>> '{}') > 0, false) $$;
create function private.enum_value(v jsonb, choices text[]) returns boolean
language sql immutable set search_path = '' as $$ select coalesce(jsonb_typeof(v)='string' and (v #>> '{}') = any(choices), false) $$;
create function private.display_name(v text) returns text
language sql immutable set search_path = '' as $$
  -- ECMAScript whitespace, including NBSP/BOM and excluding NEL.
  select btrim(regexp_replace(v, U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'))
$$;
create function private.comparison_name(v text, nfc boolean default true) returns text
language sql immutable set search_path = '' as $$
  select lower(private.display_name(case when nfc then normalize(v, NFC) else v end) collate "en-US-x-icu")
$$;
create function private.two_decimal(v jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare scaled double precision;
begin
  if jsonb_typeof(v) is distinct from 'number' then return false; end if;
  scaled := (v::text)::double precision * 100;
  -- Only distance to an integer matters here; avoid adding 0.5, which changes
  -- already integral doubles above 2^52 (unlike JavaScript Math.round).
  return abs(scaled - round(scaled)) < 2.220446049250313e-14;
exception when numeric_value_out_of_range then return false;
end $$;

create function private.valid_main_data(v jsonb, applied boolean) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  if not private.exact_keys(v, array['schemaVersion','updatedAt','monthlyNetIncomeWon','monthlyHousingWon','monthlyLivingWon','monthlySavingWon','monthlyInvestmentWon'])
    or v->'schemaVersion' <> '2'::jsonb then return false; end if;
  foreach k in array array['updatedAt','monthlyNetIncomeWon','monthlyHousingWon','monthlyLivingWon','monthlySavingWon','monthlyInvestmentWon'] loop
    if not private.integer_value(v->k) then return false; end if;
  end loop;
  return not applied or (v->>'monthlyNetIncomeWon')::numeric > 0;
end $$;
create function private.valid_main(v jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare progress jsonb := v->'setupProgress';
begin
  if not private.exact_keys(v, array['applied','setupProgress']) then return false; end if;
  if v->'applied' <> 'null'::jsonb and not private.valid_main_data(v->'applied', true) then return false; end if;
  if progress = 'null'::jsonb then return true; end if;
  return private.exact_keys(progress, array['kind','step','draft','savedAt'])
    and private.enum_value(progress->'kind',array['initial','restart'])
    and private.enum_value(progress->'step',array['welcome','income','housing','living','saving-investment','review'])
    and private.valid_main_data(progress->'draft', false) and private.timestamp_value(progress->'savedAt');
end $$;
create function private.valid_simulation(v jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare d jsonb := v->'draft'; s jsonb := d->'source';
begin
  if not private.exact_keys(v, array['draft']) then return false; end if;
  if d = 'null'::jsonb then return true; end if;
  if not private.exact_keys(d, array['schemaVersion','source','initialInvestmentWon','targetAmountWon','years','expectedAnnualReturnPercent','baseRatePercent','inflationOffsetPercentPoints','amountMode','updatedAt'])
    or not private.exact_keys(s, array['monthlySavingsWon','monthlyInvestmentWon','mainUpdatedAt']) then return false; end if;
  if d->'schemaVersion' <> '3'::jsonb or not private.integer_value(s->'monthlySavingsWon') or not private.integer_value(s->'monthlyInvestmentWon')
    or not private.integer_value(s->'mainUpdatedAt', 1) or not private.integer_value(d->'updatedAt', 1)
    or not private.integer_value(d->'initialInvestmentWon') or not private.integer_value(d->'years', 0, 30)
    or not private.two_decimal(d->'expectedAnnualReturnPercent') or not private.two_decimal(d->'baseRatePercent')
    or not private.two_decimal(d->'inflationOffsetPercentPoints') then return false; end if;
  if (d->>'expectedAnnualReturnPercent')::numeric not between 0 and 30 or (d->>'baseRatePercent')::numeric <= -100
    or (d->>'baseRatePercent')::double precision + (d->>'inflationOffsetPercentPoints')::double precision <= -100
    or not private.enum_value(d->'amountMode',array['nominal','real']) then return false; end if;
  return case when d->'targetAmountWon'='null'::jsonb then (d->>'initialInvestmentWon')::numeric >= 200000000
    else private.integer_value(d->'targetAmountWon', 1) and (d->>'targetAmountWon')::numeric > (d->>'initialInvestmentWon')::numeric end;
end $$;

create function private.valid_portfolio_state(v jsonb, draft boolean) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb; total numeric; ids text[] := '{}'; names text[] := '{}'; orders numeric[] := '{}'; name text;
begin
  if not private.exact_keys(v, case when draft then array['schemaVersion','scope','items','cashShareUnits','cashMode','inputMode','syncedInvestmentWon','updatedAt','isApplicable']
    else array['schemaVersion','scope','items','cashShareUnits','cashMode','syncedInvestmentWon','appliedAt','updatedAt'] end)
    or v->'schemaVersion' <> '2'::jsonb or v->'scope' <> '{"type":"aggregate"}'::jsonb
    or jsonb_typeof(v->'items') <> 'array' then return false; end if;
  if jsonb_array_length(v->'items') > 10 or not private.enum_value(v->'cashMode',array['automatic','manual'])
    or not private.integer_value(v->'cashShareUnits', 0, 1000000) or not private.integer_value(v->'syncedInvestmentWon')
    or not private.timestamp_value(v->'updatedAt') then return false; end if;
  total := (v->>'cashShareUnits')::numeric;
  for item in select value from jsonb_array_elements(v->'items') loop
    if not private.exact_keys(item, array['id','name','shareUnits','order','classification','classificationOrigin'])
      or not private.string_value(item->'id') or not private.string_value(item->'name')
      or not private.integer_value(item->'shareUnits', 0, 1000000) or not private.integer_value(item->'order')
      or not private.enum_value(item->'classification',array['growth','stable']) or not private.enum_value(item->'classificationOrigin',array['automatic','user']) then return false; end if;
    name := private.comparison_name(item->>'name', false);
    if name = '' or item->>'id' = any(ids) or name = any(names) or (item->>'order')::numeric = any(orders)
      or (item->>'order')::numeric >= jsonb_array_length(v->'items') then return false; end if;
    ids := array_append(ids, item->>'id'); names := array_append(names, name); orders := array_append(orders, (item->>'order')::numeric);
    total := total + (item->>'shareUnits')::numeric;
  end loop;
  if not draft then return private.timestamp_value(v->'appliedAt') and total = 1000000; end if;
  return private.enum_value(v->'inputMode',array['amount','percentage']) and total <= 1000000
    and (v->>'cashMode' <> 'automatic' or total = 1000000)
    and v->'isApplicable' = to_jsonb((v->>'syncedInvestmentWon')::numeric > 0 and total = 1000000);
end $$;
create function private.valid_portfolio(v jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare plan jsonb;
begin
  if not private.exact_keys(v, array['plans','draft']) or jsonb_typeof(v->'plans') <> 'array' then return false; end if;
  -- Current plans have only one allowed aggregate scope.
  if jsonb_array_length(v->'plans') > 1 then return false; end if;
  for plan in select value from jsonb_array_elements(v->'plans') loop
    if not private.valid_portfolio_state(plan, false) then return false; end if;
  end loop;
  return v->'draft' = 'null'::jsonb or private.valid_portfolio_state(v->'draft', true);
end $$;

create function private.normalize_locations(v jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare loc jsonb; inst jsonb; name text; instkey text; keys text[]; role jsonb; roles text[];
  ids text[] := '{}'; active_names text[] := '{}'; counts jsonb := '{}'; output jsonb := '[]'; pair text;
begin
  if jsonb_typeof(v) is distinct from 'array' then return null; end if;
  for loc in select value from jsonb_array_elements(v) loop
    keys := array['id','shortName','kind','roles','createdAt','updatedAt'];
    if loc ? 'institution' then keys := array_append(keys, 'institution'); end if;
    if loc ? 'archivedAt' then keys := array_append(keys, 'archivedAt'); end if;
    if not private.exact_keys(loc, keys) or not private.string_value(loc->'id') or not private.string_value(loc->'shortName')
      or not private.enum_value(loc->'kind',array['bank','brokerage','cash']) or jsonb_typeof(loc->'roles') <> 'array'
      or not private.timestamp_value(loc->'createdAt') or not private.timestamp_value(loc->'updatedAt')
      or (loc ? 'archivedAt' and not private.timestamp_value(loc->'archivedAt')) then return null; end if;
    name := private.display_name(loc->>'shortName');
    -- Unicode Script=Latin/Script=Hangul ranges, matching the browser regexp (not generic letters).
    if length(name) not between 1 and 8 or name collate "C" !~ '^[0-9 A-Za-zªºÀ-ÖØ-öø-ʸˠ-ˤᄀ-ᇿᴀ-ᴥᴬ-ᵜᵢ-ᵥᵫ-ᵷᵹ-ᶾḀ-ỿⁱⁿₐ-ₜK-ÅℲⅎⅠ-ↈⱠ-Ɀ〮-〯ㄱ-ㆎ㈀-㈞㉠-㉾Ꜣ-ꞇꞋ-Ƛ꟱-ꟿꥠ-ꥼꬰ-ꭚꭜ-ꭤꭦ-ꭩ가-힣ힰ-ퟆퟋ-ퟻﬀ-ﬆＡ-Ｚａ-ｚﾠ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ𐞀-𐞅𐞇-𐞰𐞲-𐞺𝼀-𝼞𝼥-𝼪]+$'
      or loc->>'id' = any(ids) then return null; end if;
    ids := array_append(ids, loc->>'id'); roles := '{}'; loc := jsonb_set(loc, '{shortName}', to_jsonb(name));
    for role in select value from jsonb_array_elements(loc->'roles') loop
      if jsonb_typeof(role) <> 'string' or role #>> '{}' not in ('income','spending','saving','investing') or role #>> '{}' = any(roles) then return null; end if;
      roles := array_append(roles, role #>> '{}');
      if not loc ? 'archivedAt' then
        counts := jsonb_set(counts, array[role #>> '{}'], to_jsonb(coalesce((counts->>(role #>> '{}'))::integer, 0) + 1));
        if (counts->>(role #>> '{}'))::integer > 10 then return null; end if;
      end if;
    end loop;
    if cardinality(roles) = 0 then return null; end if;
    instkey := 'institution:none';
    if loc ? 'institution' then
      inst := loc->'institution'; keys := array['name']; if inst ? 'id' then keys := array_append(keys, 'id'); end if;
      if not private.exact_keys(inst, keys) or not private.string_value(inst->'name')
        or (inst ? 'id' and not private.string_value(inst->'id')) then return null; end if;
      name := private.display_name(inst->>'name'); if name = '' then return null; end if;
      inst := jsonb_set(inst, '{name}', to_jsonb(name)); loc := jsonb_set(loc, '{institution}', inst);
      instkey := case when not inst ? 'id' or starts_with(inst->>'id', 'custom:') then 'custom-name:' || private.comparison_name(name)
        else 'institution:' || (inst->>'id') end;
    end if;
    -- JSON array encoding gives an unambiguous composite key without forbidden NUL characters.
    pair := jsonb_build_array(instkey, private.comparison_name(loc->>'shortName'))::text;
    if not loc ? 'archivedAt' then
      if pair = any(active_names) then return null; end if;
      active_names := array_append(active_names, pair);
    end if;
    output := output || jsonb_build_array(loc);
  end loop;
  return output;
end $$;

create function private.normalize_purpose_state(v jsonb, draft boolean, main jsonb, locations jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare keys text[]; purpose jsonb; link jsonb; loc jsonb; custom jsonb; name text; parent text; role text; pair text;
  customs jsonb := '[]'; customids text[] := '{}'; linkids text[] := '{}'; pairs text[] := '{}'; names text[] := '{}';
  counts jsonb := '{}'; totals jsonb := '{}'; activecounts jsonb := '{}'; remainders text[] := '{}'; amount numeric; mainfield text;
begin
  if v = 'null'::jsonb then return v; end if;
  keys := array['schemaVersion','sourceMainUpdatedAt','customPurposes','links','updatedAt'];
  keys := array_append(keys, case when draft then 'step' else 'setupCompletedAt' end);
  if not private.exact_keys(v, keys) or v->'schemaVersion' <> to_jsonb(case when draft then 1 else 2 end)
    or not private.timestamp_value(v->'sourceMainUpdatedAt') or not private.timestamp_value(v->'updatedAt')
    or (draft and not private.enum_value(v->'step',array['connect','review'])) or (not draft and not private.timestamp_value(v->'setupCompletedAt'))
    or jsonb_typeof(v->'customPurposes') <> 'array' or jsonb_typeof(v->'links') <> 'array'
    or main = 'null'::jsonb or (v->>'sourceMainUpdatedAt')::numeric > (main->>'updatedAt')::numeric then return null; end if;
  for purpose in select value from jsonb_array_elements(v->'customPurposes') loop
    keys := array['id','parentId','name','targetMonthlyWon','createdAt','updatedAt'];
    if purpose ? 'archivedAt' then keys := array_append(keys, 'archivedAt'); end if;
    if not private.exact_keys(purpose, keys) or not private.string_value(purpose->'id') or not starts_with(purpose->>'id','custom:')
      or length(purpose->>'id') <= 7 or not private.enum_value(purpose->'parentId',array['system:housing','system:living','system:saving','system:investing'])
      or not private.string_value(purpose->'name') or not private.integer_value(purpose->'targetMonthlyWon')
      or not private.timestamp_value(purpose->'createdAt') or not private.timestamp_value(purpose->'updatedAt')
      or (purpose ? 'archivedAt' and not private.timestamp_value(purpose->'archivedAt')) or purpose->>'id' = any(customids) then return null; end if;
    name := private.display_name(normalize(purpose->>'name', NFC));
    if length(name) not between 1 and 24 then return null; end if;
    purpose := jsonb_set(purpose, '{name}', to_jsonb(name)); parent := purpose->>'parentId';
    customids := array_append(customids, purpose->>'id'); customs := customs || jsonb_build_array(purpose);
    if not purpose ? 'archivedAt' then
      pair := jsonb_build_array(parent, private.comparison_name(name))::text;
      if pair = any(names) then return null; end if; names := array_append(names, pair);
      counts := jsonb_set(counts, array[parent], to_jsonb(coalesce((counts->>parent)::integer,0)+1));
      amount := coalesce((totals->>parent)::numeric,0) + (purpose->>'targetMonthlyWon')::numeric;
      totals := jsonb_set(totals, array[parent], to_jsonb(amount));
      if (counts->>parent)::integer > 10 or amount > 9007199254740991 then return null; end if;
      mainfield := case parent when 'system:housing' then 'monthlyHousingWon' when 'system:living' then 'monthlyLivingWon'
        when 'system:saving' then 'monthlySavingWon' else 'monthlyInvestmentWon' end;
      if v->'sourceMainUpdatedAt' = main->'updatedAt' and amount > (main->>mainfield)::numeric then return null; end if;
    end if;
  end loop;
  for link in select value from jsonb_array_elements(v->'links') loop
    keys := array['id','purposeId','locationId','monthlyAmountWon','remainder','status','createdAt','updatedAt'];
    if link ? 'suspendedReason' then keys := array_append(keys,'suspendedReason'); end if;
    if not private.exact_keys(link, keys) or not private.string_value(link->'id') or not private.string_value(link->'purposeId')
      or not private.string_value(link->'locationId') or not private.integer_value(link->'monthlyAmountWon')
      or jsonb_typeof(link->'remainder') <> 'boolean' or not private.timestamp_value(link->'createdAt')
      or not private.timestamp_value(link->'updatedAt') or link->>'id' = any(linkids) then return null; end if;
    if not ((link->'status'='"active"'::jsonb and not link ? 'suspendedReason') or (link->'status'='"suspended"'::jsonb and link->'remainder'='false'::jsonb
      and private.enum_value(link->'suspendedReason',array['location-archived','user']))) then return null; end if;
    parent := link->>'purposeId'; custom := null;
    if parent not in ('system:income','system:housing','system:living','system:saving','system:investing') then
      select value into custom from jsonb_array_elements(customs) where value->>'id'=parent;
      if custom is null then return null; end if; parent := custom->>'parentId';
    end if;
    select value into loc from jsonb_array_elements(locations) where value->>'id'=link->>'locationId';
    if loc is null then return null; end if;
    pair := jsonb_build_array(link->>'purposeId',link->>'locationId')::text;
    if pair = any(pairs) then return null; end if;
    pairs := array_append(pairs,pair); linkids := array_append(linkids,link->>'id');
    if link->>'status'='active' then
      role := case parent when 'system:income' then 'income' when 'system:saving' then 'saving' when 'system:investing' then 'investing' else 'spending' end;
      if loc ? 'archivedAt' or custom ? 'archivedAt' or not (loc->'roles' ? role) then return null; end if;
      parent := link->>'purposeId';
      activecounts := jsonb_set(activecounts,array[parent],to_jsonb(coalesce((activecounts->>parent)::integer,0)+1));
      if (activecounts->>parent)::integer > 10 then return null; end if;
      if link->'remainder'='true'::jsonb then
        if parent = any(remainders) then return null; end if; remainders := array_append(remainders,parent);
      end if;
    end if;
  end loop;
  return jsonb_set(v,'{customPurposes}',customs);
end $$;

create function private.normalize_workspace(v jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare locations jsonb; applied jsonb; draft jsonb;
begin
  if not private.exact_keys(v,array['main','simulation','portfolio','locations','accountMap'])
    or not coalesce(private.valid_main(v->'main'),false) or not coalesce(private.valid_simulation(v->'simulation'),false)
    or not coalesce(private.valid_portfolio(v->'portfolio'),false)
    or not private.exact_keys(v->'accountMap',array['applied','draft']) then return null; end if;
  locations := private.normalize_locations(v->'locations'); if locations is null then return null; end if;
  applied := private.normalize_purpose_state(v#>'{accountMap,applied}',false,v#>'{main,applied}',locations);
  draft := private.normalize_purpose_state(v#>'{accountMap,draft}',true,v#>'{main,applied}',locations);
  if applied is null or draft is null then return null; end if;
  return v || jsonb_build_object('locations',locations,'accountMap',jsonb_build_object('applied',applied,'draft',draft));
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
