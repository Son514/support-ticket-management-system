import { DashboardShell } from "@/components/dashboard-shell";
import { TicketForm } from "@/components/ticket-form";

export default function NewTicketPage() {
  return (
    <DashboardShell
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "New ticket" },
      ]}
    >
      <div className="mx-auto w-full max-w-2xl pt-4">
        <TicketForm />
      </div>
    </DashboardShell>
  );
}
