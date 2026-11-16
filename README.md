# Bilheteria concorrente

Projeto final de Paradigmas de Linguagens de Programação. Enunciado completo no Blackboard.

Os arquivos de `src/` que vocês escrevem já existem, vazios; o `tipos.ts` e o `servidor.ts` vêm prontos. O que vai em cada um está no passo
indicado do enunciado:

| Arquivo | Passo do enunciado |
| :--- | :--- |
| `src/tipos.ts` (pronto) | 1: os tipos |
| `src/regras.ts` | 2: meia-entrada |
| `src/preco.ts` | 3: preço (funcional) |
| `src/dominio.ts` | 4: evento e erros (orientado a objetos) |
| `src/bilheteria.ts` | 5: a venda, onde a concorrência aparece |
| `src/servidor.ts` (pronto) e `src/main.ts` | 6: ligar o servidor |

Não alterem `src/pagamento.ts`, `src/servidor.ts`, `src/bench.ts` nem `testes/`: a correção usa os originais.

Para começar, sigam o `GUIA.md`. Depois dele, os comandos são:

```bash
npm install
npm test          # correção automática: mostra os pontos
npm start         # serviço em http://localhost:3000
npm run bench     # com o serviço no ar: 200 pedidos simultâneos no evento 1, dois por poltrona
```

Exemplo de pedido:

```bash
curl -X POST localhost:3000/reservas -H 'Content-Type: application/json' \
  -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
```

---

## Preencham (avaliado no vídeo)

**Link do vídeo:** 

### Integrantes

| Nome | Usuário do GitHub | Parte principal |
| :--- | :--- | :--- |
| Ewellyn Maria | ewemf | `regras.ts`, `dominio.ts` (OO) |
| Rafael Cirne | rafaelcirn3 | `preco.ts`, `main.ts` (funcional) |
| Gustavo Martinez | gustavomartinezx | `bilheteria.ts` (concorrente) |

### Decisões

1. **Concorrência.** Como vocês garantem que duas pessoas não ficam com a mesma poltrona? Onde estava o
   `await` perigoso?

   O `reservar` da `Bilheteria` marca as poltronas no `Evento` antes de qualquer `await`. Como o Node roda o
   JavaScript numa linha só, entre conferir se a poltrona está livre e marcar ela como vendida nenhum outro pedido
   consegue rodar. Quando o segundo pedido chega na mesma poltrona, ela já está marcada e ele recebe um
   `PoltronaOcupadaErro`.

   O `await` perigoso é o do pagamento. Se a gente conferisse a poltrona, esperasse a operadora responder e só depois
   marcasse, vários pedidos iam conferir a mesma poltrona enquanto esperavam e todos iam achar que ela estava livre.
   Aí a mesma poltrona seria vendida mais de uma vez. Por isso o pagamento vem depois da marcação: se ele for recusado
   ou passar do tempo limite (o `comTempoLimite` usa um `Promise.race` com um timer), o `catch` chama o `liberar` e
   devolve as poltronas. Os pedidos continuam sem esperar uns pelos outros, porque cada um só fica parado no próprio
   pagamento.
2. **OO.** O que o `Evento` esconde e por quê? Por que o `reservar` é tudo ou nada? Por que os erros são uma hierarquia de classes?

   O `Evento` esconde a lista das poltronas vendidas (o `#vendidas`). Quem usa a classe de fora só consegue ver quantas
   restam, com o `disponivel`, e mexer nas poltronas pelo `reservar` e pelo `liberar`. Fizemos assim para ninguém marcar
   uma poltrona pulando as validações. Se a lista fosse pública, qualquer parte do código podia vender uma poltrona
   duas vezes sem querer. Também tentei fazer `evento.disponivel = 999` e não muda nada, porque ele é só um getter.

   O `reservar` é tudo ou nada porque um pedido pode ter várias poltronas. Se ele marcasse umas e desse erro numa delas,
   as que já tinham sido marcadas ficariam presas, sem ninguém ter comprado. Então ele olha todas antes (se a lista está
   vazia, se a poltrona existe, se repetiu, se já foi vendida) e só marca no final, quando está tudo certo.

   Os erros são uma hierarquia porque todos têm a mesma ideia: algo que deu errado no pedido, com um status HTTP. A
   `ErroDeNegocio` guarda o `status` e as quatro filhas só mudam o número. Com isso o servidor não precisa olhar qual
   erro foi: pergunta se é um `ErroDeNegocio` e devolve o `erro.status`. Se aparecer um erro novo, é só criar mais uma
   filha.
3. **Funcional.** O que ganhamos com `preco.ts` puro? Como vocês testariam ele sem subir o servidor?

   As funções de `preco.ts` calculam os valores só a partir dos argumentos e não alteram as pessoas nem os ingressos
   recebidos. Isso torna o resultado previsível e facilita reutilizar o cálculo com preços e regras de meia-entrada
   diferentes. `montarIngressos` usa `map` e recebe a regra de meia como função; `calcularTotal` usa `reduce` e aplica a
   taxa de serviço. Para testar, basta importar essas funções, passar entradas conhecidas e comparar os ingressos e o
   total esperados, sem iniciar o servidor ou simular pagamentos.
4. **Se fosse em outro paradigma.** Escolham uma das partes e expliquem como ficaria em outro
   paradigma, e se ficaria melhor ou pior.

   A precificação poderia ser orientada a objetos: uma classe guardaria o preço base e a taxa, com métodos para montar
   ingressos e calcular o total. Funcionaria, mas para esse cálculo simples traria mais estado e estrutura. As funções
   atuais são mais diretas para combinar e testar isoladamente.
5. **Concorrente × paralelo.** O Node roda o JavaScript numa linha só: os pedidos de vocês são
   concorrentes, não paralelos. O que mudaria se a venda rodasse em vários núcleos ao mesmo tempo?

   `main.ts` inicia um servidor com os eventos em memória, dentro de um único processo. Nesse modelo, o Node pode
   intercalar pedidos enquanto espera operações assíncronas, mas o código JavaScript não executa em vários núcleos ao
   mesmo tempo. Com vários processos ou núcleos, cada um teria sua própria cópia dos eventos; seria necessário
   coordenar a reserva das poltronas em um armazenamento compartilhado, com uma operação atômica, para impedir vendas
   duplicadas.

### Resultados do bench

| Cenário | Pedidos | Tempo (ms) | Vendidos | Poltrona ocupada | Falha de pagamento |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Padrão (`main.ts`) | 200 | 445 | 99 | 96 | 5 |

O bench ocupa as poltronas do evento 1: para rodar de novo, parem o `npm start` (Ctrl+C) e subam outra
vez.

O que os números mostram: os 200 pedidos disputavam as 100 poltronas do evento 1 (dois por poltrona) e nenhuma foi
vendida duas vezes. Foram 99 vendas, 96 pedidos recusados porque a poltrona já estava marcada e 5 pagamentos recusados
pela operadora, somando os 200. Os 5 pagamentos recusados devolveram as poltronas, e quase todas foram compradas depois pelo
outro pedido que disputava o mesmo lugar e chegou após a liberação, por isso sobrou só 1 poltrona livre no fim
(`disponivel: 1`). O tempo também mostra a concorrência: cada pagamento leva cerca de 80 ms, então 200 pedidos um
depois do outro levariam uns 16 segundos, e todos terminaram em 445 ms porque esperaram a operadora ao mesmo tempo.
