/**
 * The order number as the guest sees it (BR-POST-01): a digits-only number
 * longer than `displayLength` shows only its last digits; anything else shows whole.
 */
export function displayCheckNumber(posCheckNumber: string, displayLength: number): string {
  if (displayLength > 0 && /^\d+$/.test(posCheckNumber) && posCheckNumber.length > displayLength) {
    return posCheckNumber.slice(-displayLength);
  }
  return posCheckNumber;
}
