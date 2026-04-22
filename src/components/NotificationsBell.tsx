import { useNavigate } from "@tanstack/react-router";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/use-notifications";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function NotificationsBell({ variant = "default" }: { variant?: "default" | "sidebar" }) {
  const navigate = useNavigate();
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas, excluir } = useNotifications();

  const handleClick = (id: string, link: string | null, lida: boolean) => {
    if (!lida) marcarLida(id);
    if (link) navigate({ to: link });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative",
            variant === "sidebar" && "text-sidebar-foreground hover:bg-sidebar-accent/60",
          )}
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-sm">
            Notificações {naoLidas > 0 && <span className="text-muted-foreground">({naoLidas})</span>}
          </div>
          {naoLidas > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => marcarTodasLidas()}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {notificacoes.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação por enquanto.
            </div>
          ) : (
            <ul className="divide-y">
              {notificacoes.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "group px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors",
                    !n.lida && "bg-primary/5",
                  )}
                  onClick={() => handleClick(n.id, n.link, n.lida)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.lida && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        <div className="text-sm font-medium truncate">{n.titulo}</div>
                      </div>
                      {n.mensagem && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(n.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.lida && (
                        <button
                          onClick={(e) => { e.stopPropagation(); marcarLida(n.id); }}
                          className="text-muted-foreground hover:text-primary"
                          title="Marcar como lida"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); excluir(n.id); }}
                        className="text-muted-foreground hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
