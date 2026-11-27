/**
 * SOMENTE LEITURA. Agrupa empresas do banco cujo nome só difere por
 * acento, maiúsculas, pontuação ou sufixo (LTDA, ME, EPP, S.A...) e grava um CSV.
 * Uso: npx tsx scripts/relatorio-empresas-similares.ts [saida.csv]
 */
import * as fs from "fs";
import { AppDataSource } from "../config/database.js";
import { chaveEmpresa } from "../services/nome-empresa.js";

const saida = process.argv[2] || "empresas_similares.csv";

await AppDataSource.initialize();
const linhas: { id: string; razao_social: string; cnpj: string | null; laudos: string }[] =
  await AppDataSource.query(`
    select e.id, e.razao_social, e.cnpj, count(l.id)::text as laudos
    from tb_empresa_laudo e left join tb_laudo l on l.empresa_id = e.id
    group by e.id order by e.razao_social`);

const grupos = new Map<string, typeof linhas>();
for (const l of linhas) {
  const k = chaveEmpresa(l.razao_social);
  grupos.set(k, [...(grupos.get(k) ?? []), l]);
}

const csv = ["grupo;chave;id;razao_social;cnpj;laudos"];
let g = 0, extras = 0;
for (const [chave, itens] of grupos) {
  if (itens.length < 2) continue;
  g++;
  extras += itens.length - 1;
  for (const e of itens)
    csv.push([g, chave, e.id, e.razao_social, e.cnpj ?? "", e.laudos].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"));
}
fs.writeFileSync(saida, "﻿" + csv.join("\n") + "\n");
console.log(`Empresas: ${linhas.length} | grupos parecidos: ${g} | empresas a unir (sobrando): ${extras}`);
console.log(`CSV: ${saida}`);
await AppDataSource.destroy();
