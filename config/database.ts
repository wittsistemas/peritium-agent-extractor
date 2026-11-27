import { DataSource } from "typeorm";
import { Laudo } from "../entities/laudo.entity.js";
import { Empresa } from "../entities/empresa.entity.js";
import "dotenv/config";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST as string,
  port: Number(process.env.DB_PORT as string),
  username: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  database: process.env.DB_NAME as string,
  entities: [Laudo, Empresa],
  synchronize: false,
});
