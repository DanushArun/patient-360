export function evidenceSpan(text: string, rawStart?: string | number | null, rawEnd?: string | number | null): {
  kind: "page" | "span";
  reason: "no_span" | "invalid_span" | "whole_page" | null;
  before: string;
  highlight: string;
  after: string;
};
