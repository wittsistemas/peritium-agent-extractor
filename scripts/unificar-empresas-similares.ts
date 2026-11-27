/**
 * Une empresas cujo nome só difere por acento, caixa, pontuação ou sufixo
 * (LTDA, ME, EPP, S.A...). Move os laudos para a empresa principal e apaga as outras.
 * Principal = a com mais laudos; empate: a que tem CNPJ; depois o menor nome.
 * Padrão é SIMULAR. Para aplicar: APLICAR=1 npx tsx scripts/unificar-empresas-similares.ts
 * Faça backup do banco antes.
 */
import { AppDataSource } from "../config/database.js";
import { chaveEmpresa } from "../services/nome-empresa.js";

const aplicar = process.env.APLICAR === "1";
await AppDataSource.initialize();

type E = { id: string; razao_social: string; cnpj: string | null; laudos: number };
const linhas: E[] = (await AppDataSource.query(`
  select e.id, e.razao_social, e.cnpj, count(l.id)::int as laudos
  from tb_empresa_laudo e left join tb_laudo l on l.empresa_id = e.id group by e.id`));

const grupos = new Map<string, E[]>();
for (const e of linhas) {
  const k = chaveEmpresa(e.razao_social);
  grupos.set(k, [...(grupos.get(k) ?? []), e]);
}

const qr = AppDataSource.createQueryRunner();
await qr.connect();
await qr.startTransaction();
let unidas = 0, laudosMovidos = 0;
try {
  for (const itens of grupos.values()) {
    if (itens.length < 2) continue;
    itens.sort((a, b) =>
      b.laudos - a.laudos ||
      Number(!!b.cnpj) - Number(!!a.cnpj) ||
      a.razao_social.length - b.razao_social.length);
    const [principal, ...outras] = itens as [E, ...E[]];
    for (const o of outras) {
      console.log(`"${o.razao_social}" (${o.laudos}) -> "${principal.razao_social}"`);
      // CNPJ é único: só copia para a principal se ela não tiver.
      if (o.cnpj && !principal.cnpj) {
        await qr.query(`update tb_empresa_laudo set cnpj = null where id = $1`, [o.id]);
        await qr.query(`update tb_empresa_laudo set cnpj = $1 where id = $2`, [o.cnpj, principal.id]);
        principal.cnpj = o.cnpj;
      }
      await qr.query(`update tb_laudo set empresa_id = $1 where empresa_id = $2`, [principal.id, o.id]);
      await qr.query(`delete from tb_empresa_laudo where id = $1`, [o.id]);
      laudosMovidos += o.laudos;
      unidas++;
    }
  }
  if (aplicar) await qr.commitTransaction(); else await qr.rollbackTransaction();
} catch (e) {
  await qr.rollbackTransaction();
  throw e;
} finally {
  await qr.release();
}
console.log(`\n${aplicar ? "APLICADO" : "SIMULAÇÃO (nada foi gravado)"}: ${unidas} empresas unidas, ${laudosMovidos} laudos movidos.`);
await AppDataSource.destroy();
