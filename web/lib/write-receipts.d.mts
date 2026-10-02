type Receipt = Record<string, unknown>;

export function confirmWriteReceipt(options: {
  receipt: Receipt;
  idKey: string;
  readBack: () => Promise<Receipt[]>;
  matches: (row: Receipt) => boolean;
}): Promise<Receipt & { read_back_confirmed: true }>;
