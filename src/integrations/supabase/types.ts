export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cliente_gestores: {
        Row: {
          cliente_id: string
          created_at: string
          gestor_id: string
          id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          gestor_id: string
          id?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          gestor_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_gestores_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          campanha: string | null
          created_at: string
          drive_folder_url: string | null
          id: string
          nome: string
          segmento: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          campanha?: string | null
          created_at?: string
          drive_folder_url?: string | null
          id?: string
          nome: string
          segmento?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          campanha?: string | null
          created_at?: string
          drive_folder_url?: string | null
          id?: string
          nome?: string
          segmento?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      criativo_comentarios: {
        Row: {
          autor_id: string | null
          created_at: string
          criativo_id: string
          id: string
          texto: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          criativo_id: string
          id?: string
          texto: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          criativo_id?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "criativo_comentarios_criativo_id_fkey"
            columns: ["criativo_id"]
            isOneToOne: false
            referencedRelation: "criativos"
            referencedColumns: ["id"]
          },
        ]
      }
      criativo_versoes: {
        Row: {
          arquivo_nome: string
          arquivo_path: string | null
          arquivo_tipo: string | null
          comentario_revisao: string | null
          created_at: string
          criativo_id: string
          descricao: string | null
          enviado_por: string | null
          id: string
          link_url: string | null
          revisado_em: string | null
          revisado_por: string | null
          status: Database["public"]["Enums"]["creative_status"]
          versao: number
        }
        Insert: {
          arquivo_nome: string
          arquivo_path?: string | null
          arquivo_tipo?: string | null
          comentario_revisao?: string | null
          created_at?: string
          criativo_id: string
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          link_url?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database["public"]["Enums"]["creative_status"]
          versao: number
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string | null
          arquivo_tipo?: string | null
          comentario_revisao?: string | null
          created_at?: string
          criativo_id?: string
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          link_url?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database["public"]["Enums"]["creative_status"]
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "criativo_versoes_criativo_id_fkey"
            columns: ["criativo_id"]
            isOneToOne: false
            referencedRelation: "criativos"
            referencedColumns: ["id"]
          },
        ]
      }
      criativos: {
        Row: {
          arquivo_nome: string
          arquivo_path: string | null
          arquivo_tipo: string | null
          cliente_id: string
          comentario_revisao: string | null
          created_at: string
          descricao: string | null
          enviado_por: string | null
          id: string
          link_url: string | null
          revisado_em: string | null
          revisado_por: string | null
          status: Database["public"]["Enums"]["creative_status"]
          status_operacional: Database["public"]["Enums"]["creative_op_status"]
          tarefa_id: string
          updated_at: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_path?: string | null
          arquivo_tipo?: string | null
          cliente_id: string
          comentario_revisao?: string | null
          created_at?: string
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          link_url?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database["public"]["Enums"]["creative_status"]
          status_operacional?: Database["public"]["Enums"]["creative_op_status"]
          tarefa_id: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string | null
          arquivo_tipo?: string | null
          cliente_id?: string
          comentario_revisao?: string | null
          created_at?: string
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          link_url?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database["public"]["Enums"]["creative_status"]
          status_operacional?: Database["public"]["Enums"]["creative_op_status"]
          tarefa_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "criativos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criativos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          criativo_id: string | null
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          tarefa_id: string | null
          tipo: Database["public"]["Enums"]["notification_type"]
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criativo_id?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tarefa_id?: string | null
          tipo: Database["public"]["Enums"]["notification_type"]
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          criativo_id?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tarefa_id?: string | null
          tipo?: Database["public"]["Enums"]["notification_type"]
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_criativo_id_fkey"
            columns: ["criativo_id"]
            isOneToOne: false
            referencedRelation: "criativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          grupo_id: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          grupo_id?: string | null
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          grupo_id?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tarefa_atividades: {
        Row: {
          ator_id: string | null
          created_at: string
          id: string
          metadata: Json
          tarefa_id: string
          tipo: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          ator_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          tarefa_id: string
          tipo: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          ator_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          tarefa_id?: string
          tipo?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_atividades_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_comentarios: {
        Row: {
          autor_id: string | null
          created_at: string
          id: string
          tarefa_id: string
          texto: string
          updated_at: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          id?: string
          tarefa_id: string
          texto: string
          updated_at?: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          id?: string
          tarefa_id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          cliente_id: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          funil: Database["public"]["Enums"]["funil_classificacao"] | null
          id: string
          prazo: string | null
          prioridade: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          tipo_tarefa_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          funil?: Database["public"]["Enums"]["funil_classificacao"] | null
          id?: string
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tipo_tarefa_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          funil?: Database["public"]["Enums"]["funil_classificacao"] | null
          id?: string
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tipo_tarefa_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_tipo_tarefa_id_fkey"
            columns: ["tipo_tarefa_id"]
            isOneToOne: false
            referencedRelation: "tipos_tarefa"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_tarefa: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          criativo_id: string | null
          error: string | null
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          tarefa_id: string | null
          tipo_gatilho: string
        }
        Insert: {
          created_at?: string
          criativo_id?: string | null
          error?: string | null
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          tarefa_id?: string | null
          tipo_gatilho: string
        }
        Update: {
          created_at?: string
          criativo_id?: string | null
          error?: string | null
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          tarefa_id?: string | null
          tipo_gatilho?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _notif_recipients: {
        Args: { _ator_id: string; _tarefa_id: string }
        Returns: {
          user_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_dispatch_webhook: { Args: { payload: Json }; Returns: undefined }
      is_gestor_of_cliente: {
        Args: { _cliente_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_of_cliente: {
        Args: { _cliente_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "tarefa_criada"
        | "tarefa_status_alterado"
        | "criativo_enviado"
        | "criativo_aprovado"
        | "criativo_reprovado"
        | "comentario_adicionado"
      app_role: "admin" | "gestor" | "cliente"
      creative_op_status: "ativo" | "desativado" | "standby"
      creative_status: "pendente_aprovacao" | "aprovado" | "reprovado"
      funil_classificacao: "topo" | "meio" | "fundo"
      notification_type:
        | "tarefa_atribuida"
        | "tarefa_status_alterado"
        | "criativo_pendente"
        | "criativo_aprovado"
        | "criativo_reprovado"
        | "comentario_tarefa"
        | "comentario_criativo"
      task_priority: "baixa" | "media" | "alta" | "urgente"
      task_status:
        | "pendente"
        | "em_andamento"
        | "aguardando_aprovacao"
        | "aprovado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "tarefa_criada",
        "tarefa_status_alterado",
        "criativo_enviado",
        "criativo_aprovado",
        "criativo_reprovado",
        "comentario_adicionado",
      ],
      app_role: ["admin", "gestor", "cliente"],
      creative_op_status: ["ativo", "desativado", "standby"],
      creative_status: ["pendente_aprovacao", "aprovado", "reprovado"],
      funil_classificacao: ["topo", "meio", "fundo"],
      notification_type: [
        "tarefa_atribuida",
        "tarefa_status_alterado",
        "criativo_pendente",
        "criativo_aprovado",
        "criativo_reprovado",
        "comentario_tarefa",
        "comentario_criativo",
      ],
      task_priority: ["baixa", "media", "alta", "urgente"],
      task_status: [
        "pendente",
        "em_andamento",
        "aguardando_aprovacao",
        "aprovado",
      ],
    },
  },
} as const
