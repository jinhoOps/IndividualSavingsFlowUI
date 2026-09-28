import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export async function verifyHousingLoansDatabase({sql, quote, asUser, vite, userA, userC}) {
  const migration = await readFile(new URL('../supabase/migrations/202609280001_housing_loan_planner.sql', import.meta.url), 'utf8');
  const before = sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w');
  sql(`set role migration_admin; ${migration}`);
  assert.equal(sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w'), before, 'loan migration never rewrites existing accounts');
  const {calculateLoanSchedule, parseHousingLoan, parseHousingLoanPlan} = await vite.ssrLoadModule('/src/main/domain/housingLoan.ts');
  const {createExpenseDraft, EXPENSE_ITEMS, expenseTotals, parseExpenseAssistant} = await vite.ssrLoadModule('/src/main/domain/expenseAssistant.ts');
  const loan = {id: 'home', name: '주택담보대출', method: 'equal-payment', basis: 'remaining', principalWon: 100000000,
    annualRateBps: 400, rateType: 'fixed', months: 120, graceMonths: 0, firstPaymentMonth: '2026-09'};
  let comparisons = 0;
  for (const method of ['equal-payment', 'equal-principal', 'bullet']) {
    for (const patch of [{}, {annualRateBps: 0, months: 1}, {principalWon: 999999999999, annualRateBps: 1, months: 600},
      {principalWon: 1, months: 3}, {annualRateBps: 9999, months: 24, graceMonths: method === 'bullet' ? 0 : 12}]) {
      const value = {...loan, method, ...patch};
      const rows = calculateLoanSchedule(value);
      for (const index of new Set([0, Math.floor(rows.length / 2), rows.length - 1])) {
        const row = rows[index];
        const actual = JSON.parse(sql(`select private.housing_loan_month(${quote(value)},'${row.month}')`));
        assert.deepEqual(actual, {regularWon: row.paymentWon - row.maturityWon, maturityWon: row.maturityWon}, `${method} ${JSON.stringify(patch)} month ${index}`);
        comparisons++;
      }
    }
  }
  for (const patch of [{}, {principalWon: -1}, {principalWon: 1e13}, {annualRateBps: 4.1}, {months: 0}, {months: 601},
    {graceMonths: 120}, {method: 'bullet', graceMonths: 1}, {firstPaymentMonth: '2026-13'}, {firstPaymentMonth: '9999-12'},
    {name: ' '}, {name: null}, {principalWon: null}, {extra: true}]) {
    const value = {...loan, ...patch};
    assert.equal(sql(`select coalesce(private.valid_housing_loan(${quote(value)}),false)`), parseHousingLoan(value) ? 't' : 'f');
  }
  for (const value of [{month: '2026-09', loans: [loan], paymentOverrideWon: null},
    {month: '2026-09', loans: [loan, loan], paymentOverrideWon: null}, {month: '2026-09', loans: [loan], paymentOverrideWon: -1}]) {
    assert.equal(sql(`select coalesce(private.valid_housing_loans(${quote(value)}),false)`), parseHousingLoanPlan(value) ? 't' : 'f');
  }
  const rpc = (name, payload, revision, id = randomUUID(), user = userA) => JSON.parse(sql(asUser(`select public.${name}(${quote(payload)},'${id}',${revision},5)`, user)));
  let row = JSON.parse(sql(asUser('select to_jsonb(w) from public.user_workspaces w')));
  const original = structuredClone(row.payload);
  const draft = createExpenseDraft(1000);
  for (const {id} of EXPENSE_ITEMS) draft.answers[id] = {amountWon: 0, period: 'month'};
  draft.answers.rent = {amountWon: 500000, period: 'month'};
  draft.answers.housingInterest = {amountWon: 900000, period: 'month'};
  draft.housingLoans = {month: '2026-09', loans: [loan], paymentOverrideWon: null};
  let request = {main: {...row.payload.main, expenseAssistant: {schemaVersion: 2, draft, lastApplied: null}}};
  let result = rpc('save_expense_draft', request, row.revision);
  assert.equal(result.status, 'saved'); row = result.workspace;
  assert.deepEqual(row.payload.main.applied, original.main.applied, 'loan draft does not alter applied monthly amounts');
  assert.ok(parseExpenseAssistant(row.payload.main.expenseAssistant));
  const mutation = randomUUID();
  result = rpc('apply_expense', request, row.revision, mutation);
  assert.equal(result.status, 'saved');
  assert.equal(result.workspace.payload.main.applied.monthlyHousingWon, expenseTotals(draft.answers, draft.housingLoans).housingWon);
  assert.equal(result.workspace.payload.main.expenseAssistant.draft.answers.housingInterest.amountWon, 900000, 'historical interest preserved, not added twice');
  for (const field of ['monthlyNetIncomeWon', 'monthlySavingWon', 'monthlyInvestmentWon']) assert.equal(result.workspace.payload.main.applied[field], original.main.applied[field]);
  for (const field of ['simulation', 'portfolio', 'locations', 'accountMap']) assert.deepEqual(result.workspace.payload[field], original[field]);
  assert.deepEqual(result.workspace.payload.main.expenseAssistant.lastApplied.housingLoans, draft.housingLoans);
  assert.equal(rpc('apply_expense', request, row.revision, mutation).workspace.revision, result.workspace.revision);
  assert.equal(rpc('apply_expense', request, row.revision).status, 'conflict');
  row = result.workspace;
  const old = structuredClone(request); old.main.expenseAssistant.schemaVersion = 1; delete old.main.expenseAssistant.draft.housingLoans;
  assert.equal(rpc('save_expense_draft', old, row.revision).status, 'invalid', 'old open tab cannot erase new loan conditions');
  assert.equal(rpc('apply_expense', old, row.revision).status, 'invalid');
  assert.equal(rpc('apply_expense', request, row.revision, randomUUID(), userC).status, 'conflict');
  const beforeFailure = sql(asUser('select to_jsonb(w) from public.user_workspaces w'));
  sql("create function private.reject_loan_receipt() returns trigger language plpgsql as $$ begin raise exception 'loan receipt failure'; end $$; create trigger reject_loan_receipt before insert on private.workspace_mutations for each row execute function private.reject_loan_receipt()");
  assert.throws(() => rpc('apply_expense', request, row.revision), /loan receipt failure/);
  assert.equal(sql(asUser('select to_jsonb(w) from public.user_workspaces w')), beforeFailure);
  sql('drop trigger reject_loan_receipt on private.workspace_mutations; drop function private.reject_loan_receipt()');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(sql(`select has_function_privilege('${role}','private.housing_loan_month(jsonb,text)','EXECUTE')`), 'f');
  }
  console.log(`PASS: loan assistant v2; ${comparisons} TS/SQL schedule comparisons; strict inputs, unchanged v5 data, atomic apply, original interest retention, old-client rejection, CAS, receipts and private permissions.`);
}
