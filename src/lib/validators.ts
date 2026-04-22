// Validações Zod compartilhadas. Mantém os mesmos limites que o banco
// (constraints CHECK) para evitar erros 500 em vez de feedback amigável.
import { z } from "zod";

// ── Helpers ──────────────────────────────────────────────
function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidDriveUrl(value: string): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.hostname.endsWith("google.com") && u.pathname.includes("/drive/");
  } catch {
    return false;
  }
}

export const httpUrlSchema = z
  .string()
  .trim()
  .refine(isValidHttpUrl, { message: "URL inválida (use http:// ou https://)" });

export const driveUrlSchema = z
  .string()
  .trim()
  .refine(isValidDriveUrl, { message: "URL do Google Drive inválida" });

// ── Domínio ──────────────────────────────────────────────
export const tarefaCreateSchema = z.object({
  cliente_id: z.string().uuid("Cliente inválido"),
  titulo: z.string().trim().min(1, "Título obrigatório").max(200, "Máximo 200 caracteres"),
  descricao: z.string().max(10_000, "Descrição muito longa").optional().nullable(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
  prazo: z.string().nullable().optional(),
  tipo_tarefa_id: z.string().uuid("Tipo inválido"),
  funil: z.enum(["topo", "meio", "fundo"]).nullable().optional(),
});
export type TarefaCreateInput = z.infer<typeof tarefaCreateSchema>;

export const tarefaUpdateSchema = tarefaCreateSchema
  .omit({ cliente_id: true, tipo_tarefa_id: true })
  .extend({
    status: z.enum(["pendente", "em_andamento", "aguardando_aprovacao", "aprovado"]),
  });
export type TarefaUpdateInput = z.infer<typeof tarefaUpdateSchema>;

export const comentarioSchema = z
  .string()
  .trim()
  .min(1, "Comentário não pode ficar vazio")
  .max(5000, "Máximo 5 000 caracteres");

export const clienteCreateSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  segmento: z.string().trim().max(120).optional().nullable(),
  campanha: z.string().max(10_000).optional().nullable(),
  drive_folder_url: driveUrlSchema,
  user_id: z.string().uuid().nullable().optional(),
  gestor_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um gestor"),
});
export type ClienteCreateInput = z.infer<typeof clienteCreateSchema>;

export const userRoleEnum = z.enum(["admin", "gestor", "cliente"]);

export const userCreateSchema = z
  .object({
    nome: z.string().trim().min(1).max(120),
    email: z.string().trim().email("Email inválido").max(255),
    password: z.string().min(6, "Mínimo 6 caracteres").max(72, "Máximo 72 caracteres"),
    role: userRoleEnum,
    telefone: z.string().trim().max(40).nullable().optional(),
    grupo_id: z.string().trim().max(60).nullable().optional(),
    cliente: z
      .object({
        nome: z.string().trim().min(1).max(200),
        segmento: z.string().trim().max(120).optional().nullable(),
        drive_folder_url: driveUrlSchema,
        gestor_ids: z.array(z.string().uuid()).min(1, "Ao menos um gestor"),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "cliente") {
      if (!data.cliente) {
        ctx.addIssue({ code: "custom", path: ["cliente"], message: "Dados do cliente obrigatórios" });
      }
      if (!data.grupo_id?.trim()) {
        ctx.addIssue({ code: "custom", path: ["grupo_id"], message: "ID do grupo obrigatório" });
      }
    } else if (!data.telefone?.trim()) {
      ctx.addIssue({ code: "custom", path: ["telefone"], message: "Telefone obrigatório" });
    }
  });
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  user_id: z.string().uuid(),
  nome: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
  password: z.string().min(6).max(72).optional(),
  role: userRoleEnum.optional(),
  telefone: z.string().trim().max(40).nullable().optional(),
  grupo_id: z.string().trim().max(60).nullable().optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/** Formata erros Zod em uma string única para exibir em toast. */
export function formatZodErrors(error: z.ZodError): string {
  return error.errors.map((e) => e.message).join(" • ");
}
