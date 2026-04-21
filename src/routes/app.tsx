import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useTarefasRealtime } from "@/hooks/use-tarefas-realtime";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  useTarefasRealtime();
  return (
    <RequireAuth>
      <AppShell>
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </AppShell>
    </RequireAuth>
  );
}
