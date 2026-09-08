# LINCE

Console fullstack de **coleta web** (protótipo HTML): fontes, fila de jobs, dataset estruturado, logs e export CSV.

Em produção os workers seriam Python/Node com fila, banco e coleta só em fontes autorizadas (robots.txt + rate-limit).

## Abrir

- `index.html` — landing
- `entrar.html` — login demo `ana@lince.dev` / `Lince#2026`
- `console.html` — operação

Os jobs “Rodar” simulam uma coleta e gravam linhas no `localStorage`.
