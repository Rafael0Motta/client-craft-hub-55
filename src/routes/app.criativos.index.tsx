import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppShell";
import { CriativosSection } from "@/components/CriativosSection";

export const Route = createFileRoute("/app/criativos/")({
  component: CriativosPage,
});

function CriativosPage() {
  const { role } = useAuth();
  return (
    <>
      <PageHeader
        title="Criativos"
        description={
          role === "cliente"
            ? "Envie criativos como arquivo ou cole o link (Google Drive, Dropbox, etc.)."
            : "Aprove ou reprove os criativos enviados pelos clientes."
        }
      />
      <CriativosSection />
    </>
  );
}
