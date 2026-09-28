# Demonstração — Correlação CNAE x item LC 116 x NBS

> Projeto de portfólio de **Victória Pedrosa**. **Demonstração** de correlação CNAE x item LC 116 x NBS — versão com dados fictícios (nomes, CNPJs, e-mails e IDs internos substituídos).

## Problema de negócio
Com a reforma tributária, cada serviço precisa ser correlacionado a item da LC 116, NBS e classificação tributária; a consulta manual é lenta e sujeita a erro.

## Antes x depois
| | Antes | Depois |
|---|---|---|
| Como é feito | Busca manual em tabelas oficiais para cada CNAE. | Web app consulta a correlação CNAE x Item LC 116 x NBS x cIndOp x cClassTrib em segundos. |

## Ganho
- Classificação padronizada para emissão de NFS-e no novo modelo.

## Tecnologias
Google Apps Script, Google Sheets, HTML/JavaScript, Web App (HtmlService)

## Arquivos
- `Codigo.gs`
- `Index.html`

## Como usar
Crie um projeto no Google Apps Script, copie os arquivos `.gs`/`.html` e configure as Propriedades do script indicadas no código.

## Autora
Victória Pedrosa — Product Owner do Time de IA, automação de processos contábeis e fiscais.
