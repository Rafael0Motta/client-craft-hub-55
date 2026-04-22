import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { roleLabels } from "@/lib/labels";
import { LayoutDashboard, Users, ListTodo, UserCog, LogOut, Webhook, Menu, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationsBell } from "@/components/NotificationsBell";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"admin" | "gestor" | "cliente">;
}

const navItems: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "gestor", "cliente"] },
  { to: "/app/clientes", label: "Clientes", icon: Users, roles: ["admin", "gestor"] },
  { to: "/app/tarefas", label: "Tarefas", icon: ListTodo, roles: ["admin", "gestor", "cliente"] },
  { to: "/app/usuarios", label: "Usuários", icon: UserCog, roles: ["admin"] },
  { to: "/app/logs", label: "Logs Webhook", icon: Webhook, roles: ["admin"] },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const visible = navItems.filter((i) => role && i.roles.includes(role));

  const handleLogout = async () => {
    await signOut();
    onNavigate?.();
    navigate({ to: "/login" });
  };

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-6 py-6 border-b border-sidebar-border flex items-center justify-between gap-2">
        <Link to="/app" onClick={onNavigate} className="block min-w-0">
          <div className="text-2xl font-black tracking-tight leading-none">
            OLD<span className="text-sidebar-primary">LAB</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-sidebar-foreground/60 mt-1">
            Client System
          </div>
        </Link>
        <NotificationsBell variant="sidebar" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visible.map((item) => {
          const Icon = item.icon;
          const active =
            item.to === "/app"
              ? location.pathname === "/app"
              : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="px-3 py-2 mb-2">
          <div className="text-sm font-semibold truncate">{profile?.nome ?? "—"}</div>
          <div className="text-[11px] text-sidebar-foreground/60 truncate">{profile?.email}</div>
          <div className="mt-1 inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-sidebar-primary text-sidebar-primary-foreground font-bold">
            {role ? roleLabels[role] : ""}
          </div>
        </div>
        <Link
          to="/app/conta"
          onClick={onNavigate}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
        >
          <KeyRound className="h-4 w-4" /> Trocar senha
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden lg:block w-64 shrink-0">
        <SidebarContent />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 h-14 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent/60">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r-sidebar-border">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/app" className="text-lg font-black tracking-tight">
            OLD<span className="text-sidebar-primary">LAB</span>
          </Link>
          <NotificationsBell variant="sidebar" />
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm sm:text-base text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
