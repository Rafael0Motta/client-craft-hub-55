// Helpers de formatação reutilizados em várias telas.
// Centralizar aqui evita imports duplicados de date-fns/locale e silencia
// erros de parsing inválido em um único lugar.
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function fmtShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd 'de' MMM 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}
