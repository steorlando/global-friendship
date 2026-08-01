export const DEFAULT_IN_FILTER_BATCH_SIZE = 50;

export function batchInFilterValues<T>(
  values: readonly T[],
  batchSize = DEFAULT_IN_FILTER_BATCH_SIZE
): T[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }

  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += batchSize) {
    batches.push(values.slice(index, index + batchSize));
  }
  return batches;
}
