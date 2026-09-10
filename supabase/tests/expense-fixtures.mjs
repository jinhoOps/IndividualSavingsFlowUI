export const expenseIds = ['rent','housingInterest','maintenance','insurance','telecom','subscriptions','utilities','food','transport','occasions','leisure','otherHousing','otherLiving'];
export const answers = Object.fromEntries(expenseIds.map(id => [id, {amountWon: 0, period: 'month'}]));
answers.rent.amountWon = 800000;
answers.insurance.amountWon = 100000;
answers.telecom.amountWon = 60000;
answers.food.amountWon = 600000;
answers.utilities.amountWon = 35000;
answers.leisure = {amountWon: 1200000, period: 'year'};
export const assistant = {schemaVersion: 1, draft: {answers, step: 'review', updatedAt: 1000}, lastApplied: null};
const changed = change => {const value = structuredClone(assistant); change(value); return value;};
export const expenseFixtures = [
  {name:'complete monthly and annual answers', value:assistant, valid:true},
  {name:'unanswered differs from zero', value:changed(v=>{v.draft.answers.rent=null;v.draft.step='rent';}),valid:true},
  {name:'complete applied snapshot', value:changed(v=>{v.lastApplied={answers:structuredClone(answers),appliedAt:1000};}),valid:true},
  {name:'unknown question',value:changed(v=>{v.draft.answers.unknown={amountWon:1,period:'month'};}),valid:false},
  {name:'missing question',value:changed(v=>{delete v.draft.answers.rent;}),valid:false},
  {name:'negative amount',value:changed(v=>{v.draft.answers.rent.amountWon=-1;}),valid:false},
  {name:'fractional amount',value:changed(v=>{v.draft.answers.rent.amountWon=0.5;}),valid:false},
  {name:'unsupported period',value:changed(v=>{v.draft.answers.rent.period='week';}),valid:false},
  {name:'unknown step',value:changed(v=>{v.draft.step='unknown';}),valid:false},
  {name:'sum overflow',value:changed(v=>{v.draft.answers.rent.amountWon=Number.MAX_SAFE_INTEGER;}),valid:false},
  {name:'incomplete applied snapshot',value:changed(v=>{v.lastApplied={answers:{...answers,rent:null},appliedAt:1000};}),valid:false},
  {name:'unexpected draft field',value:changed(v=>{v.draft.extra=true;}),valid:false},
];
