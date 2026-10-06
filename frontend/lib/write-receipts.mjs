import { apiError } from "./api-contracts.mjs";

/**
 * @param {{receipt: Record<string, unknown>, idKey: string,
 * readBack: () => Promise<Record<string, unknown>[]>,
 * matches: (row: Record<string, unknown>) => boolean}} options
 * @returns {Promise<Record<string, unknown> & {read_back_confirmed: true}>}
 */
export async function confirmWriteReceipt(options) {
  const { receipt, idKey, readBack, matches } = options;
  if (receipt.error) throw new Error(String(receipt.error));
  if (typeof receipt[idKey] !== "string" || !receipt[idKey].trim()) {
    throw new Error("write_receipt_missing");
  }
  let rows;
  try {
    rows = await readBack();
  } catch (error) {
    if (apiError(error).category === "access") throw error;
    throw new Error("write_readback_unavailable", { cause: error });
  }
  if (!Array.isArray(rows) || !rows.some(matches)) {
    throw new Error("write_readback_unconfirmed");
  }
  return { ...receipt, read_back_confirmed: true };
}
