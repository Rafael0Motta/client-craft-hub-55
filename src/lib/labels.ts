export const taskStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
};

export const taskStatusOrder = [
  "pendente",
  "em_andamento",
  "aguardando_aprovacao",
  "aprovado",
] as const;

export const taskPriorityLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const creativeStatusLabels: Record<string, string> = {
  pendente_aprovacao: "Pendente",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

export const roleLabels: Record<string, string> = {
  admin: "Admin",
  gestor: "Gestor",
  cliente: "Cliente",
};

export const funilLabels: Record<string, string> = {
  topo: "Topo",
  meio: "Meio",
  fundo: "Fundo",
};

export const funilOrder = ["topo", "meio", "fundo"] as const;

export const creativeOpStatusLabels: Record<string, string> = {
  ativo: "Ativo",
  desativado: "Desativado",
  standby: "Standby",
};

export const creativeOpStatusOrder = ["ativo", "desativado", "standby"] as const;

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    pendente: "bg-[var(--status-pending)]/15 text-[var(--status-pending)] border-[var(--status-pending)]/30",
    em_andamento: "bg-[var(--status-progress)]/15 text-[var(--status-progress)] border-[var(--status-progress)]/30",
    aguardando_aprovacao: "bg-[var(--status-review)]/15 text-[var(--status-review)] border-[var(--status-review)]/30",
    aprovado: "bg-[var(--status-approved)]/15 text-[var(--status-approved)] border-[var(--status-approved)]/30",
    pendente_aprovacao: "bg-[var(--status-review)]/15 text-[var(--status-review)] border-[var(--status-review)]/30",
    reprovado: "bg-[var(--status-rejected)]/15 text-[var(--status-rejected)] border-[var(--status-rejected)]/30",
  };
  return map[status] ?? "bg-muted text-muted-foreground border-border";
}

export function priorityBadgeClass(p: string): string {
  const map: Record<string, string> = {
    baixa: "bg-muted text-muted-foreground border-border",
    media: "bg-[var(--status-progress)]/15 text-[var(--status-progress)] border-[var(--status-progress)]/30",
    alta: "bg-[var(--status-pending)]/15 text-[var(--status-pending)] border-[var(--status-pending)]/30",
    urgente: "bg-[var(--status-rejected)]/15 text-[var(--status-rejected)] border-[var(--status-rejected)]/30",
  };
  return map[p] ?? "bg-muted text-muted-foreground border-border";
}

export function opStatusBadgeClass(s: string): string {
  const map: Record<string, string> = {
    ativo: "bg-[var(--status-approved)]/15 text-[var(--status-approved)] border-[var(--status-approved)]/30",
    desativado: "bg-muted text-muted-foreground border-border",
    standby: "bg-[var(--status-pending)]/15 text-[var(--status-pending)] border-[var(--status-pending)]/30",
  };
  return map[s] ?? "bg-muted text-muted-foreground border-border";
}
