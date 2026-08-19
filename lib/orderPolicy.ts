/**
 * Order policy: net requirement -> recommended order quantity.
 *
 * Matches the logic already used in the company's own Order sheet
 * ("QTY after MOQ", "Final order"): first floor at the MOQ, then round
 * up to the nearest order multiple (lot size). MOQ and order multiple
 * are looked up per Supplier-Material link when one exists, falling back
 * to the Material's own defaults.
 */
export function applyOrderPolicy(netRequirement: number, moq: number, orderMultiple: number): number {
  if (netRequirement <= 0) return 0;
  const flooredAtMoq = Math.max(netRequirement, moq);
  const multiple = orderMultiple > 0 ? orderMultiple : 1;
  return Math.ceil(flooredAtMoq / multiple) * multiple;
}
