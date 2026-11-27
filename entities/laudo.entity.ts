import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Empresa } from "./empresa.entity.js";

@Entity("tb_laudo")
export class Laudo {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  titulo!: string;

  @Column({ type: "text", nullable: true })
  descricao!: string;

  @Index()
  @Column({ type: "char", length: 2 })
  uf!: string;

  @Index()
  @Column({ type: "varchar", length: 100 })
  cidade!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  cnae?: string;

  @Column({ type: "text", array: true, nullable: true, name: "agente_nocivo" })
  agentesNocivos?: string[];

  @Column({ type: "int", nullable: true })
  ano?: number;

  @Column({ type: "varchar", length: 150, nullable: true })
  ramo?: string;

  @Column({ type: "text", array: true, nullable: true, name: "setor" })
  setores?: string[];

  @Column({ type: "text", array: true, nullable: true, name: "funcao" })
  funcoes?: string[];

  @Column({ type: "text", name: "caminho_arquivo" })
  caminhoArquivo!: string;

  @ManyToOne(() => Empresa, (empresa) => empresa.laudos, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "empresa_id" })
  empresa!: Empresa;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
