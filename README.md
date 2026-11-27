# 🤖 Peritium Agent Extractor

O **Peritium Agent Extractor** é um _Worker Cognitivo_ autônomo desenvolvido em Node.js e TypeScript. Ele foi projetado para ler, interpretar e extrair dados complexos de laudos técnicos de segurança do trabalho (LTCAT, PPRA, PCMSO) utilizando IA Generativa local e Visão Computacional (OCR).

Seu objetivo é transformar dados não-estruturados (arquivos PDF e imagens escaneadas) em dados estruturados no banco de dados PostgreSQL, auxiliando advogados previdenciários na busca por provas materiais para processos de aposentadoria especial.

---

## Funcionalidades

- **Varredura Autônoma:** Lê pastas locais organizadas por hierarquia (Estado > Cidade > Empresa) e processa documentos em lote automaticamente.
- **Inteligência Híbrida de Leitura:**
  - **Texto Nativo:** Usa `pdf-parse` para extração ultra-rápida de PDFs digitais originais.
  - **Visão Computacional (OCR):** Detecta PDFs escaneados automaticamente e aciona o `Tesseract` para ler os pixels e converter imagens em texto.
- **Cognição via LLM (Llama 3):** Utiliza um modelo local rodando via Ollama (Engenheiro de Segurança Sênior) para deduzir contexto e extrair de forma precisa:
  - 🔑 Palavras-chave (agentes nocivos e riscos)
  - 🏢 CNPJ e CNAE
  - 📅 Ano do documento
  - 🏭 Ramo de atividade, Setores e Funções avaliadas
- **Anti-Duplicação:** Integração inteligente com PostgreSQL via TypeORM para garantir que laudos sejam vinculados corretamente a empresas existentes, sem criar registros duplicados.

---

## Tecnologias Utilizadas

- **Backend:** Node.js, TypeScript
- **Banco de Dados:** PostgreSQL, TypeORM
- **IA Generativa:** Ollama (Modelo Llama 3)
- **Processamento de PDF / OCR:** `pdf-parse`, Poppler (`pdftoppm`), Tesseract OCR

---

## Pré-requisitos e Instalação

Como o agente lida com OCR e Inteligência Artificial local, seu ambiente precisa das seguintes ferramentas instaladas no sistema operacional (focado em ambientes Linux/Ubuntu):

### 1. Ferramentas de Sistema (OCR e PDF)

```bash
# Atualize os pacotes
sudo apt update

# Instale o poppler-utils (para converter PDF em imagem)
sudo apt install poppler-utils

# Instale o Tesseract e o pacote de idioma português
sudo apt install tesseract-ocr tesseract-ocr-por
```

### 2. Ollama (IA Local)

Instale o Ollama seguindo a documentação oficial e baixe o modelo do Llama 3:

```bash
ollama run llama3
```

> (Deixe o Ollama rodando em background na sua máquina)

### 3. Banco de Dados

Certifique-se de ter uma instância do PostgreSQL rodando e crie o banco de dados peritium_db.

## Como Rodar o Projeto

### 1. Clone e Instale as dependências:

```bash
git clone <url-do-repositorio>
cd peritium-agent-extractor
npm install
```

### 2. Configure o Banco de Dados:

Ajuste as credenciais no arquivo `src/config/database.ts` ou crie um arquivo .env (caso implemente variáveis de ambiente) com os dados do seu PostgreSQL local.

### 3. Inicie o Agente:

Use o ts-node ou o script de desenvolvimento configurado no seu package.json:

```bash
npx tsx index.ts
```

### 4. Interação:

Ao iniciar, o terminal perguntará o caminho raiz da pasta de laudos.
Exemplo de entrada:

```bash
Digite o caminho da pasta raiz de laudos: /caminho/absoluto/para/MeusLaudos
```
