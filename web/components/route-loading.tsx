import { Page } from "@/components/sa";

export function RouteLoading({ patient = false }: { patient?: boolean }) {
  const label = patient ? "Opening patient record…" : "Refreshing today’s readiness…";
  return (
    <Page>
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">{label}</span>
        <div className="mb-8 animate-pulse">
          <div className="mb-2 h-7 w-48 rounded bg-gray-100" />
          <div className="h-4 w-72 rounded bg-gray-100" />
        </div>
        {!patient && <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5 animate-pulse">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-16 rounded bg-gray-100" />)}
        </div>}
        <div className="grid gap-8 lg:grid-cols-[7fr_5fr]">
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: patient ? 4 : 6 }, (_, index) => (
              <div key={index} className="border-t py-4" style={{ borderColor: "var(--sa-rule)" }}>
                <div className="mb-3 h-4 w-40 rounded bg-gray-100" />
                <div className="h-4 w-3/4 rounded bg-gray-100" />
              </div>
            ))}
          </div>
          {patient && <div className="hidden space-y-3 lg:block animate-pulse">
            <div className="h-4 w-40 rounded bg-gray-100" />
            <div className="h-24 rounded bg-gray-100" />
          </div>}
        </div>
        <div className="sa-meta mt-4">{label}</div>
      </div>
    </Page>
  );
}
