// Tipos compartilhados pelos componentes da página de tarefas.
export type TipoTarefa = { id: string; nome: string };

export type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  prazo: string | null;
  created_at: string;
  criado_por: string | null;
  cliente_id: string;
  tipo_tarefa_id: string | null;
  funil: string | null;
  clientes: { nome: string } | null;
  tipos_tarefa: { nome: string } | null;
  profiles?: { nome: string } | null;
};

export type ClienteMini = { id: string; nome: string };
