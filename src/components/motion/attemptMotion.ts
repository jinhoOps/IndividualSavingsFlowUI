export function attemptMotion(operation: () => void): boolean {
  try {
    operation();
    return true;
  } catch {
    return false;
  }
}
