// Cache TTL em memória com dedup de requisições concorrentes (single-flight).
//
// Os dados servidos pela API só mudam quando documentos são reprocessados no
// Redshift, então um cache curto elimina a maior fonte de latência: re-rodar
// agregados pesados e dezenas de queries pequenas (alta latência no warehouse)
// a cada navegação.
//
// Mora no processo de propósito: hoje a API roda em 1 instância (App Runner com
// 2 usuários não escala além disso), então RAM é suficiente e tem custo zero.
// A abstração existe para que, SE um dia houver múltiplas instâncias, baste
// trocar o backend por Redis sem tocar na lógica de negócio (loaders).

type CacheEntry<T> = { at: number; value: T };

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private inflight = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 1000,
  ) {}

  /**
   * Retorna o valor cacheado se ainda válido; senão executa `loader`, cacheia e
   * retorna. Chamadas concorrentes para a mesma chave compartilham a mesma
   * promise (evita disparar o mesmo trabalho pesado N vezes em paralelo).
   */
  async get(key: string, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.store.get(key);
    if (hit && now - hit.at < this.ttlMs) {
      return hit.value;
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }

    const promise = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  private set(key: string, value: T): void {
    // Eviction FIFO simples para não crescer sem limite (ex.: muitos hashes de
    // credor distintos). Suficiente para o volume atual.
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }
    this.store.set(key, { at: Date.now(), value });
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }
}

// Registro central de caches para invalidação em massa via /api/reload.
const registry: Array<{ clear: () => void }> = [];

export function createCache<T>(ttlMs: number, maxEntries?: number): TtlCache<T> {
  const cache = new TtlCache<T>(ttlMs, maxEntries);
  registry.push(cache);
  return cache;
}

export function clearAllCaches(): void {
  for (const cache of registry) {
    cache.clear();
  }
}

export const DEFAULT_TTL_MS = Number.parseInt(process.env.CACHE_TTL_MS ?? "300000", 10);
