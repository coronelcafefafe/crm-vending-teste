# Prompt para o chat do CRM Vending (TESTE)

Copie tudo o que está abaixo da linha para o início do novo chat.

---

Vais trabalhar comigo (André Freitas) no **CRM Vending · versão de testes**: uma cópia separada do CRM da Coronel Café, que vou adaptar para uma empresa de vending focada em assistências técnicas. Escreve sempre em português de Portugal. Quando eu disser "antes de avançar diz-me", explica o plano e espera pelo meu OK.

## Regra principal: só podes mexer nisto

| O quê | Identificação |
|---|---|
| Base de dados Supabase | projeto **"CRM Vending Teste"**, id **`rwsoizhxhqbchtjbgvip`** (organização "Coronel Cafe") |
| Código | repositório GitHub **`coronelcafefafe/crm-vending-teste`** (ramo `main`) |
| Site de testes | https://coronelcafefafe.github.io/crm-vending-teste/ |

## Proibido, sem exceção

- **Nunca** usar o projeto Supabase **`wajuoxdtjywjdndgatxp`** ("Coronel Cafe"): nem ler, nem escrever, nem SQL, nem edge functions, nem segredos, nem logs. É o CRM real da Coronel Café.
- **Nunca** mexer no repositório **`coronelcafefafe/coronel-crm`**, nem em **crm.coronelcafe.com**.
- **Nunca** mexer no computador do André na pasta `Desktop\xdsync`, no programa XD nem na base de dados do XD.
- **Nunca** usar a loja Shopify, o email geral@coronelcafe.com (Microsoft 365), o Brevo ou as redes sociais da Coronel Café.
- **Nunca** criar o ficheiro `CNAME` neste repositório (apontaria o domínio da Coronel para aqui).

Antes de **cada** chamada a uma ferramenta Supabase, confirma que `project_id` é `rwsoizhxhqbchtjbgvip`. Se uma tarefa parecer exigir o projeto da Coronel Café, **pára e pergunta-me**.

## O que existe na base de testes (copiada a 06/11/2026)

- 22 tabelas do CRM com os dados da Coronel Café nesse dia: `entidades` (734 clientes), `artigos` (2485, incluindo peças), `maquinas`, `maq_assist`, `maq_cofre`, `maq_fat`, `maq_leituras`, `maq_local`, `maq_troco`, `stock_mov`, `encomendas`, `propostas`, `avencas`, `pedidos`, `pedidos_link`, `visitas`, `tarefas`, `compras`, `pagamentos`, `xd_documentos`, `entrega_locais`, `membros`, mais `vgo_produtos` (vazia).
- As mesmas funções, triggers, regras de acesso (RLS) e permissões do CRM original.
- Fotos dos artigos copiadas para o bucket `artigos` deste projeto.
- **Não tem**: sincronização com o XD (os documentos e o stock estão congelados a 06/11), tarefas agendadas (pg_cron), emails (`emailEncomendas: false`), assistente Claude (`claude: false`) nem edge functions ativas.
- Equipa (`membros`): geral@coronelcafe.com (admin) e o Pimenta. Ninguém tem conta criada neste projeto: o André cria a sua conta pelo painel do Supabase (Authentication → Users) ou pelo email de entrada, e a ficha liga-se pelo email.

**Os dados são reais da Coronel Café e servem só para testar.** Não os mostres nem os entregues à outra empresa: antes de qualquer demonstração, substitui por dados fictícios ou pelos dados dessa empresa (RGPD).

## Como publicar alterações no site de testes

1. Editar os ficheiros (index.html, maquinas.js, extrato.js, pedido.html, sw.js, config.js, manifest.webmanifest).
2. Aumentar a versão em `sw.js` (`crm-vending-teste-v1` → `v2` …), senão os telemóveis ficam com a versão antiga.
3. Enviar pelo GitHub em https://github.com/coronelcafefafe/crm-vending-teste/upload/main e confirmar o commit.
4. `config.js` tem de apontar sempre para `https://rwsoizhxhqbchtjbgvip.supabase.co`.

## Regras de trabalho do André que continuam a valer

- Nunca escrever senhas ou credenciais; o André entra nas contas e cola os segredos ele próprio.
- Apagar dados de forma permanente só com a aprovação do André.
- Os funcionários (ex.: técnico) não veem custos nem valores da empresa.
- A faixa laranja "VERSÃO DE TESTES" no fundo do ecrã fica até o André dizer o contrário.
