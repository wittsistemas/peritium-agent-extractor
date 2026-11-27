import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Laudo } from "./laudo.entity.js";

@Entity("tb_empresa_laudo")
export class Empresa {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  razao_social!: string;

  @Column({ type: "varchar", length: 20, nullable: true, unique: true })
  cnpj?: string;

  @OneToMany(() => Laudo, (laudo) => laudo.empresa)
  laudos!: Laudo[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
