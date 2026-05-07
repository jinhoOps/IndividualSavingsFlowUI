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

  // Process previous items
  previousItems.forEach(item => {
    if (!item.name) return;
    map.set(item.name, {
      name: item.name,
      prev: item.amount || 0,
      curr: 0
    });
  });

  // Process current items (merge with previous or add new)
  currentItems.forEach(item => {
    if (!item.name) return;
    if (map.has(item.name)) {
      map.get(item.name).curr = item.amount || 0;
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

  const expenseComp = compareItems(prevData.expenseItems, currData.expenseItems);
  const incomeComp = compareItems(prevData.incomes, currData.incomes);
  const savingsComp = compareItems(prevData.savingsItems, currData.savingsItems);
  const investComp = compareItems(prevData.investItems, currData.investItems);

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
