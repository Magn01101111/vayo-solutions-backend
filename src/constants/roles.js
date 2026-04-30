/**
 * Roles del sistema VAYO — fuente única de verdad en el backend.
 * El frontend define los mismos valores en `src/app/core/constants/roles.ts`.
 *
 * Object.freeze garantiza que nadie pueda mutar o agregar roles en runtime.
 *
 * ADMIN     → acceso total
 * COTIZADOR → crea y gestiona cotizaciones
 * PROVEEDOR → acceso limitado de lectura
 * CLIENTE   → consulta catálogo y estado de cotizaciones
 */
const ROLES = Object.freeze({
  ADMIN:     'ADMIN',
  COTIZADOR: 'COTIZADOR',
  PROVEEDOR: 'PROVEEDOR',
  CLIENTE:   'CLIENTE',
});

module.exports = { ROLES };
