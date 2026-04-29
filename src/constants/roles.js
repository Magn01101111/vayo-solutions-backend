/**
 * Roles del sistema VAYO
 * ADMIN     → acceso total
 * COTIZADOR → crea y gestiona cotizaciones
 * PROVEEDOR → acceso limitado de lectura
 * CLIENTE   → consulta catálogo y estado de cotizaciones
 */
const ROLES = {
  ADMIN: 'ADMIN',
  COTIZADOR: 'COTIZADOR',
  PROVEEDOR: 'PROVEEDOR',
  CLIENTE: 'CLIENTE',
};

module.exports = { ROLES };
