export const familyLanguages: Readonly<Record<string, string>>;

export type FamilyRecordItem = {
  ruleId: string | null;
  status: string;
  reason: string | null;
};

export type FamilyRecord = {
  items: FamilyRecordItem[];
  available: boolean;
  allReturnedPassed: boolean;
  message: string;
};

export function familyRecord(gates: unknown): FamilyRecord;
