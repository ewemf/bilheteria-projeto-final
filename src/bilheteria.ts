import { DadosInvalidosErro, NaoEncontradoErro, PagamentoErro } from "./dominio.ts";
import type { Evento } from "./dominio.ts";
import type { Pagamento } from "./pagamento.ts";
import { calcularTotal, montarIngressos } from "./preco.ts";
import { direitoAMeia } from "./regras.ts";
import type { Comprovante, ConfigBilheteria, EventoInfo, Pedido } from "./tipos.ts";

// Parte C: corre a promise contra um timer; quem terminar primeiro decide.
function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`operadora não respondeu em ${ms} ms`)), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

export class Bilheteria {
  #eventos: Map<number, Evento>;
  #pagar: Pagamento;
  #limitePagamentoMs: number;
  #proximaReserva = 1;

  constructor({ eventos, pagar, limitePagamentoMs }: ConfigBilheteria) {
    this.#eventos = new Map(eventos.map((e) => [e.id, e]));
    this.#pagar = pagar;
    this.#limitePagamentoMs = limitePagamentoMs;
  }

  listarEventos(): EventoInfo[] {
    return [...this.#eventos.values()].map((e) => e.info());
  }

  async reservar(pedido: Pedido): Promise<Comprovante> {
    // 1. Valida (o pedido vem do HTTP, então pode ser qualquer coisa).
    if (!pedido || !Array.isArray(pedido.ingressos) || pedido.ingressos.length === 0) {
      throw new DadosInvalidosErro("o pedido precisa ter ao menos um ingresso");
    }
    if (pedido.ingressos.some((p) => !p || typeof p !== "object")) {
      throw new DadosInvalidosErro("ingresso inválido");
    }
    const evento = this.#eventos.get(pedido.eventoId);
    if (!evento) throw new NaoEncontradoErro(`evento ${pedido.eventoId} não existe`);

    // 2. Marca as poltronas ANTES do await: entre aqui e o pagamento nenhum outro
    //    pedido roda (JS é single-thread), então ninguém compra a mesma poltrona.
    const poltronas = pedido.ingressos.map((p) => p.poltrona);
    evento.reservar(poltronas);

    // 3. Monta ingressos e total (funções puras do preco.ts).
    const ingressos = montarIngressos(evento.preco, pedido.ingressos, direitoAMeia);
    const total = calcularTotal(ingressos);
    const reservaId = this.#proximaReserva++;

    // 4. Cobra. Se falhar ou travar, devolve as poltronas (Parte B).
    try {
      await comTempoLimite(this.#pagar(total), this.#limitePagamentoMs);
    } catch (erro) {
      evento.liberar(poltronas);
      throw new PagamentoErro(`pagamento não aprovado: ${(erro as Error).message}`);
    }

    return { reservaId, eventoId: evento.id, ingressos, total };
  }
}

export function criarBilheteria(config: ConfigBilheteria): Bilheteria {
  return new Bilheteria(config);
}
