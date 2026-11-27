import "reflect-metadata";
import * as fs from "fs";
import * as path from "path";

import { AppDataSource } from "./config/database.js";
import { Empresa } from "./entities/empresa.entity.js";
import { Laudo } from "./entities/laudo.entity.js";

import {
  analisarPdfComGemini,
  temDadosUteis,
} from "./services/llm.service.js";

import "dotenv/config";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Só pastas com sigla de estado (ex.: SC) são lidas; NAO_IDENTIFICADO e afins ficam de fora.
const ehSiglaUf = (nome: string) => /^[A-Za-z]{2}$/.test(nome);

const subpastas = (dir: string) =>
  fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory());

async function rodarAgenteExtractor() {
  const resumo = {
    importados: 0,
    jaImportados: 0,
    semDados: [] as string[],
    falhas: [] as string[],
  };

  try {
    const caminhoRaiz = process.env.FOLDER_PATH;
    if (!caminhoRaiz || !fs.existsSync(caminhoRaiz)) {
      throw new Error(`FOLDER_PATH inválido ou inexistente: ${caminhoRaiz}`);
    }

    console.log("⏳ Conectando ao PostgreSQL...");
    await AppDataSource.initialize();
    console.log("✅ Banco conectado!");

    const empresaRepo = AppDataSource.getRepository(Empresa);
    const laudoRepo = AppDataSource.getRepository(Laudo);

    for (const pastaEstadoDir of subpastas(caminhoRaiz)) {
      if (!ehSiglaUf(pastaEstadoDir.name)) {
        console.log(`⏭️  Pasta ignorada (não é uma UF): ${pastaEstadoDir.name}`);
        continue;
      }
      const dadosEstado = pastaEstadoDir.name.toUpperCase();
      const estadoPath = path.join(caminhoRaiz, pastaEstadoDir.name);

      for (const cidade of subpastas(estadoPath)) {
        const cidadePath = path.join(estadoPath, cidade.name);

        for (const empresaPasta of subpastas(cidadePath)) {
          const empresaPath = path.join(cidadePath, empresaPasta.name);
          const nomeEmpresaLimpo = empresaPasta.name
            .replace(/[_\-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          const arquivos = fs
            .readdirSync(empresaPath, { withFileTypes: true })
            .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".pdf"));

          for (const arquivo of arquivos) {
            const caminhoCompletoPdf = path.join(empresaPath, arquivo.name);

            // Garante que a chave use barras normais (padrão web)
            const caminhoRelativo =
              `${pastaEstadoDir.name}/${cidade.name}/${empresaPasta.name}/${arquivo.name}`.replace(
                /\\/g,
                "/",
              );

            // Antes de gastar uma chamada na IA, pula o que já foi importado.
            if (await laudoRepo.exists({ where: { caminhoArquivo: caminhoRelativo } })) {
              resumo.jaImportados++;
              continue;
            }

            console.log(`\n📄 Lendo arquivo: ${caminhoRelativo}`);

            const tituloArquivo = arquivo.name
              .replace(/\.[^/.]+$/, "")
              .replace(/[_\-]/g, " ")
              .replace(/\s+/g, " ")
              .trim();

            try {
              console.log(`   🤖 Enviando PDF direto para o Gemini...`);
              const ia = await analisarPdfComGemini(caminhoCompletoPdf);

              // Falha da IA: não grava nada, tenta de novo na próxima execução.
              if (!ia) {
                resumo.falhas.push(caminhoRelativo);
                await sleep(5000);
                continue;
              }

              // Regra: sem agente nocivo, ramo, setor e função, não grava o laudo
              // (nem a empresa).
              if (!temDadosUteis(ia)) {
                console.log("   🚫 Sem agente nocivo, ramo, setor ou função: não salvo.");
                resumo.semDados.push(caminhoRelativo);
                await sleep(5000);
                continue;
              }

              let empresaEntity = null;
              if (ia.cnpj)
                empresaEntity = await empresaRepo.findOne({
                  where: { cnpj: ia.cnpj },
                });
              if (!empresaEntity)
                empresaEntity = await empresaRepo.findOne({
                  where: { razao_social: nomeEmpresaLimpo },
                });

              if (!empresaEntity) {
                empresaEntity = empresaRepo.create({
                  razao_social: nomeEmpresaLimpo,
                  ...(ia.cnpj && { cnpj: ia.cnpj }),
                });
                await empresaRepo.save(empresaEntity);
              } else if (ia.cnpj && !empresaEntity.cnpj) {
                empresaEntity.cnpj = ia.cnpj;
                await empresaRepo.save(empresaEntity);
              }

              const novoLaudo = laudoRepo.create({
                titulo: ia.titulo || tituloArquivo,
                descricao: ia.descricao || null,
                uf: dadosEstado,
                cidade: cidade.name,
                cnae: ia.cnae || undefined,
                agentesNocivos: ia.agentesNocivos,
                ano: ia.ano ?? undefined,
                ramo: ia.ramo ?? undefined,
                setores: ia.setores,
                funcoes: ia.funcoes,
                caminhoArquivo: caminhoRelativo,
                empresa: empresaEntity,
              } as any);

              await laudoRepo.save(novoLaudo);
              resumo.importados++;
              console.log(
                `💾 Laudo salvo: ${nomeEmpresaLimpo} (Setores: ${ia.setores.join(", ") || "Nenhum"})`,
              );

              console.log(
                `⏳ Pausa de segurança (5s) para respeitar o limite de 15 RPM...`,
              );
              await sleep(5000);
            } catch (err: any) {
              resumo.falhas.push(caminhoRelativo);
              console.error(
                `\n❌ ERRO REAL no arquivo ${arquivo.name}:`,
                err.message || err,
              );
            }
          }
        }
      }
    }
    console.log("\n🎉 IMPORTAÇÃO AUTÔNOMA CONCLUÍDA!");
  } catch (error) {
    console.error("\n❌ Erro crítico:", error);
  } finally {
    console.log("\n===== RESUMO =====");
    console.log(`Importados:        ${resumo.importados}`);
    console.log(`Já importados:     ${resumo.jaImportados} (pulados, sem custo de IA)`);
    console.log(`Sem dados úteis:   ${resumo.semDados.length}`);
    resumo.semDados.forEach((c) => console.log(`   - ${c}`));
    console.log(`Falhas (repetir):  ${resumo.falhas.length}`);
    resumo.falhas.forEach((c) => console.log(`   - ${c}`));
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }
}

rodarAgenteExtractor();
