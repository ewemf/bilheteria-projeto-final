import { Evento } from "./dominio.ts";
import { criarBilheteria } from "./bilheteria.ts";
import { criarPagamentoFalso } from "./pagamento.ts";
import { criarServidor } from "./servidor.ts";

const eventos = [
  new Evento(1, "Festival de Música", 100, 100),
  new Evento(2, "Festival de Cinema", 60, 150),
  new Evento(3, "Espetáculo de Teatro", 80, 80),
];

const pagar = criarPagamentoFalso({ latenciaMs: 80, taxaDeFalha: 0.1 });
const bilheteria = criarBilheteria({ eventos, pagar, limitePagamentoMs: 500 });

criarServidor(bilheteria).listen(3000);
