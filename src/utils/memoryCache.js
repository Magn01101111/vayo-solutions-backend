/**
 * Cache en memoria simple con TTL (Time To Live).
 *
 * Uso típico:
 *   const cached = cache.get('categories');
 *   if (cached) return cached;
 *   const fresh = await Category.find(...);
 *   cache.set('categories', fresh, 5 * 60 * 1000); // 5 min
 *   return fresh;
 *
 * Cuándo NO usarlo:
 *   - Datos por usuario (porque es global, no per-request)
 *   - Datos sensibles (vive en RAM del proceso)
 *   - Datasets enormes (consume memoria)
 *
 * Cuándo SÍ:
 *   - Datos compartidos por todos (catálogo, categorías, config empresa)
 *   - Que cambian con baja frecuencia
 *   - Siempre con invalidación en los writes
 */

class MemoryCache {
  constructor() {
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this.store = new Map();
  }

  /**
   * Obtiene un valor si está vigente.
   * @returns el valor cacheado o `null` si no existe o expiró.
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Guarda un valor con TTL en milisegundos.
   * Si no se especifica TTL, usa 5 min por defecto.
   */
  set(key, value, ttlMs = 5 * 60 * 1000) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Elimina una clave específica. */
  invalidate(key) {
    this.store.delete(key);
  }

  /**
   * Elimina todas las claves que matcheen un prefijo.
   * Útil para invalidar familias enteras: invalidatePrefix('products:')
   */
  invalidatePrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /** Limpia todo el cache. */
  clear() {
    this.store.clear();
  }

  /** Para debugging / monitoring. */
  size() {
    return this.store.size;
  }
}

// Singleton compartido por todo el backend
module.exports = new MemoryCache();
