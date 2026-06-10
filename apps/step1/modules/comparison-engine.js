import { migrateInputsToWon } from "./input-sanitizer.js";

/**
 * Comparison Engine for Step 1 Snapshots
 * Calculates differences between historical and current financial data.
 */

/**
 * Compares two arrays of financial items (e.g., expenseItems) by name.
 * @param {Array} previousItems - Array of { name, amount }
 * @param {Array} currentItems - Array of { name, amount }
 * @returns {Array} Array of { name, prev, curr, diff, ratio }
 */
export function compareItems(previousItems = [], currentItems = []) {
  const map = new Map();

  // Process previous items (aggregate by name)
  previousItems.forEach(item => {
    if (!item.name) return;
    const existing = map.get(item.name);
    if (existing) {
      existing.prev += (item.amount || 0);
    } else {
      map.set(item.name, {
        name: item.name,
        prev: item.amount || 0,
        curr: 0
      });
    }
  });

  // Process current items (aggregate by name, merge with previous or add new)
  currentItems.forEach(item => {
    if (!item.name) return;
    const existing = map.get(item.name);
    if (existing) {
      existing.curr += (item.amount || 0);
    } else {
      map.set(item.name, {
        name: item.name,
        prev: 0,
        curr: item.amount || 0
      });
    }
  });

  return Array.from(map.values()).map(entry => {
    const diff = entry.curr - entry.prev;
    const ratio = entry.prev === 0 ? (entry.curr > 0 ? 1 : 0) : diff / entry.prev;
    return {
      ...entry,
      diff,
      ratio
    };
  }).sort((a, b) => b.curr - a.curr); // Sort by current amount descending
}

/**
 * Calculates a summary of differences between two snapshot data objects.
 * @param {Object} prevData - Snapshot data
 * @param {Object} currData - Current inputs
 * @returns {Object} Comparison summary
 */
export function calculateComparison(prevData, currData) {
  if (!prevData || !currData) return null;

  // Ensure consistent units (원) for older snapshots
  const sanitizedPrev = migrateInputsToWon(prevData);
  const sanitizedCurr = migrateInputsToWon(currData);

  const expenseComp = compareItems(sanitizedPrev.expenseItems, sanitizedCurr.expenseItems);
  const incomeComp = compareItems(sanitizedPrev.incomes, sanitizedCurr.incomes);
  const savingsComp = compareItems(sanitizedPrev.savingsItems, sanitizedCurr.savingsItems);
  const investComp = compareItems(sanitizedPrev.investItems, sanitizedCurr.investItems);

  const totalPrevExpense = expenseComp.reduce((sum, item) => sum + item.prev, 0);
  const totalCurrExpense = expenseComp.reduce((sum, item) => sum + item.curr, 0);

  return {
    expenses: expenseComp,
    incomes: incomeComp,
    savings: savingsComp,
    invests: investComp,
    summary: {
      expense: {
        prev: totalPrevExpense,
        curr: totalCurrExpense,
        diff: totalCurrExpense - totalPrevExpense,
        ratio: totalPrevExpense === 0 ? 0 : (totalCurrExpense - totalPrevExpense) / totalPrevExpense
      }
    }
  };
}
