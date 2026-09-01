export interface MainOperationGate {
  busy: boolean;
}

export function createMainOperationGate(): MainOperationGate {
  return { busy: false };
}
