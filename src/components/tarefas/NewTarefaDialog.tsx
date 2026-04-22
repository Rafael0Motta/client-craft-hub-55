import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { taskPriorityLabels, funilLabels, funilOrder } from "@/lib/labels";
import { tarefaCreateSchema, formatZodErrors, type TarefaCreateInput } from "@/lib/validators";
import { toast } from "sonner";
import type { TipoTarefa } from "./types";

export function NewTarefaDialog({
  clientes, tipos, onSubmit, submitting,
}: {
  clientes: Array<{ id: string; nome: string }>;
  tipos: TipoTarefa[];
  onSubmit: (p: TarefaCreateInput) => void;
  submitting: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [prioridade, setPrioridade] = useState<TarefaCreateInput["prioridade"]>("media");
  const [prazo, setPrazo] = useState("");
  const [funil, setFunil] = useState<string>("");

  // Atualmente o app só cria tarefas do tipo "Criativo" via UI principal.
  const tipoCriativo = tipos.find((t) => t.nome.toLowerCase() === "criativo");
  const tipoId = tipoCriativo?.id ?? "";

  const trySubmit = () => {
    const parsed = tarefaCreateSchema.safeParse({
      cliente_id: clienteId,
      titulo,
      descricao: descricao.trim() || null,
      prioridade,
      prazo: prazo || null,
      tipo_tarefa_id: tipoId,
      funil: funil ? (funil as "topo" | "meio" | "fundo") : null,
    });
    if (!parsed.success) {
      toast.error("Dados inválidos", { description: formatZodErrors(parsed.error) });
      return;
    }
    onSubmit(parsed.data);
  };

  const canSubmit = !!titulo && !!clienteId && !!tipoId && !!funil && !submitting;

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Cliente *</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground">
          Tipo: <strong>Criativo</strong>
        </div>

        <div className="space-y-2">
          <Label>Classificação de funil *</Label>
          <Select value={funil} onValueChange={setFunil}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {funilOrder.map((f) => <SelectItem key={f} value={f}>{funilLabels[f]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Título *</Label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={10000}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as TarefaCreateInput["prioridade"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(taskPriorityLabels).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prazo</Label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!canSubmit} onClick={trySubmit}>
          {submitting ? "Salvando…" : "Criar tarefa"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
