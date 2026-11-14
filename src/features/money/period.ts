// A ledger month (stub: red step).

export type Period = string & { readonly __brand: "Period" };

export function isPeriod(text: string): text is Period {
  throw new Error(`not built yet: isPeriod ${text}`);
}

export function parsePeriod(text: string): Period {
  throw new Error(`not built yet: parsePeriod ${text}`);
}

export function addMonths(period: Period, months: number): Period {
  throw new Error(`not built yet: addMonths ${period} ${String(months)}`);
}

export function periodOf(epochMs: number): Period {
  throw new Error(`not built yet: periodOf ${String(epochMs)}`);
}
