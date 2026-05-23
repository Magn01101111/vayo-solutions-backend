# Guion de presentación — Base de datos y Backup (VAYO)

Documento para hablar con seguridad sobre (1) el modelo de datos y su diagrama,
y (2) el sistema de respaldo y restauración.

---

# PARTE 1 — El modelo de datos y el diagrama

## 1.1 Qué tipo de base de datos usamos y por qué

VAYO usa **MongoDB**, una base de datos **NoSQL de tipo documental**.

- En una base **SQL** (MySQL, PostgreSQL) los datos viven en **tablas** con
  filas y columnas fijas, y las relaciones se hacen con **claves foráneas (FK)**
  y se "normalizan" (1FN, 2FN, 3FN) para evitar repetir información.

- En **MongoDB** los datos viven en **colecciones** que contienen **documentos**
  (parecidos a objetos JSON). Cada documento puede tener su propia estructura, y
  los datos relacionados pueden **embeberse dentro del mismo documento** o
  **referenciarse** con un identificador (`ObjectId`).

**Frase para la presentación:**
> "MongoDB no se normaliza como SQL. En su lugar, por cada relación tomamos una
> de dos decisiones: *embeber* los datos dentro del documento, o *referenciarlos*
> con un ObjectId. Embebemos cuando los datos siempre se leen juntos; referenciamos
> cuando son entidades independientes que se comparten."

## 1.2 Cómo leer el diagrama (notación Mermaid ER)

El diagrama usa notación **Entidad-Relación** con "pata de gallo" (crow's foot):

| Símbolo | Significado |
|---|---|
| `PK` | Primary Key — identificador único del documento (`_id`) |
| `UK` | Unique Key — campo con valor único (ej. email, sku, folio) |
| `FK` | Foreign Key — referencia a otra colección (un `ObjectId`) |
| `||--o|` | Relación **uno a uno** opcional (el `o` = "cero o uno") |
| `||--o{` | Relación **uno a muchos** (el `{` = "muchos") |
| `||--||` | Relación **uno a uno** obligatoria (sub-documento embebido) |

## 1.3 Las 6 colecciones, una por una

### 1) `users` — Cuentas de autenticación
Todo el que puede **iniciar sesión** está aquí: administradores, cotizadores,
proveedores y clientes.
- `email` es **único** porque es la credencial de login.
- `password` se guarda como **hash bcrypt** (nunca en texto plano) y con
  `select:false` para que nunca se devuelva en consultas por defecto.
- `role` define los permisos (ADMIN, COTIZADOR, PROVEEDOR, CLIENTE).
- `clientId` es la **referencia opcional** a su ficha comercial (solo los CLIENTE
  la tienen).
- `loginAttempts` + `lockUntil` implementan **bloqueo por intentos fallidos**
  (seguridad anti fuerza bruta).

### 2) `clients` — Fichas CRM de clientes
La información **comercial** de cada cliente (lo que se usa para facturar/cotizar).
- `rut` es **único sparse**: único cuando existe, pero permite documentos sin RUT.
- `createdBy` → qué cotizador lo registró.
- `userId` → su cuenta de portal (si tiene). **Relación bidireccional 1:1 con users.**

**Punto clave para defender:** separamos `users` (identidad para autenticarse) de
`clients` (entidad comercial). Un cliente puede existir en el CRM **sin** tener
acceso al portal; y cuando se le da acceso, se crea un `user` vinculado.

### 3) `categories` — Categorías del catálogo
Simple: nombre, `slug` único (para URLs amigables), estado activo.
Un producto pertenece a **una** categoría.

### 4) `products` — Catálogo de repuestos HVAC
El corazón del catálogo. Contiene campos simples (nombre, sku, precio, stock) y
**tres listas embebidas**:
- `images[]` — hasta 4 imágenes (la primera es la principal).
- `specs[]` — especificaciones técnicas (clave/valor).
- `documents[]` — fichas técnicas, manuales (PDF).

**Por qué embebidas y no en colecciones aparte:** las imágenes, specs y documentos
de un producto **siempre se leen junto al producto** y **no se comparten** entre
productos. Embeberlas evita tener que hacer múltiples consultas (en SQL serían JOINs).

### 5) `company` — Configuración de la empresa (singleton)
Existe **un solo documento**. Guarda datos fiscales y, lo más importante, el
**`ivaPercent`** que se aplica a todas las cotizaciones. Es un "singleton" porque
solo hay una empresa: VAYO.

### 6) `quotes` — Cotizaciones (datos transaccionales)
La colección más rica. Cada cotización guarda:
- `folio` único auto-generado (`Q-2026-0001`).
- `clientId` → referencia al cliente (para agrupar su historial).
- `client{}` → **snapshot embebido** de los datos del cliente al momento de cotizar.
- `items[]` → líneas de la cotización (producto, cantidad, precio, nota).
- `coupon{}`, `shipping{}`, `totals{}` → descuentos, envío y totales.
- `paymentTerms`, `deliveryTerms`, `validUntil` → condiciones comerciales.

**La decisión de diseño más importante (y la que más impresiona):**
> "La cotización guarda un *snapshot* embebido de los datos del cliente, no solo
> una referencia. ¿Por qué? Porque si el cliente cambia su nombre o RUT el mes que
> viene, la cotización histórica debe conservar los datos **tal como estaban
> cuando se emitió** — por integridad legal y contable. Pero además guardamos el
> `clientId` como referencia para poder listar todas las cotizaciones de un cliente."

## 1.4 Las relaciones (el equivalente a las FK de SQL)

| Relación | Tipo | Explicación |
|---|---|---|
| `users.clientId → clients` | 1:1 opcional | Un usuario CLIENTE apunta a su ficha CRM |
| `clients.userId → users` | 1:1 opcional | La ficha CRM apunta a su cuenta de portal |
| `clients.createdBy → users` | N:1 | Un cotizador crea muchos clientes |
| `products.category → categories` | N:1 | Muchos productos en una categoría |
| `quotes.clientId → clients` | N:1 opcional | Un cliente tiene muchas cotizaciones |

Y las **embebidas** (composición, viven dentro del documento padre):
`products` embebe `images/specs/documents`; `quotes` embebe `client/items/totals`.

---

# PARTE 2 — El sistema de Backup

## 2.1 Por qué un backup es obligatorio

Una base de datos puede perderse por:
- **Error humano** (un borrado accidental).
- **Bug** en una migración o script.
- **Ataque** (ransomware, acceso no autorizado).
- **Falla del proveedor.**

Sin respaldo = pérdida **permanente** de clientes, cotizaciones y catálogo. Por eso
todo sistema profesional tiene una estrategia de **Disaster Recovery (DR)**.

## 2.2 Conceptos para sonar profesional

| Concepto | Qué es | Nuestro valor |
|---|---|---|
| **RPO** (Recovery Point Objective) | Cuántos datos puedo perder como máximo | 1 día (backup diario) |
| **RTO** (Recovery Time Objective) | En cuánto tiempo restauro | Minutos (`npm run restore`) |
| **Regla 3-2-1** | 3 copias, 2 medios, 1 externa | Atlas (nube) + JSON local + (ideal: subir copia externa) |
| **Rotación** | Conservar solo las últimas N copias | 7 (configurable) |

**Frase:**
> "Definimos un RPO de 1 día: como hacemos backup diario, en el peor caso
> perderíamos como máximo las transacciones de un día. El RTO es de minutos
> porque restaurar es solo correr el script de restauración."

## 2.3 ¿MongoDB no respalda solo?

Sí, **pero solo en planes de pago**. MongoDB Atlas incluye *Cloud Backups* con
snapshots automáticos y *point-in-time recovery* **desde el tier M10** (~USD 57/mes).
El tier gratuito **M0** que usamos **no tiene backups**. Por eso implementamos
uno propio a nivel de aplicación. Esto **también demuestra que entendemos el
mecanismo por dentro**, no solo apretar un botón.

## 2.4 Cómo funciona nuestro backup (paso a paso)

```
  node-cron (todos los días 03:00)
        │
        ▼
  runBackup()  en backup.service.js
        │
        ├─ 1. Verifica conexión a MongoDB
        ├─ 2. Crea carpeta con fecha:  backups/2026-05-22_03-00-00/
        ├─ 3. Lista TODAS las colecciones (db.listCollections())
        ├─ 4. Por cada colección: lee todos los docs → escribe coleccion.json
        ├─ 5. Escribe _manifest.json (fecha, conteos, total)
        └─ 6. Rotación: si hay > 7 backups, borra los más viejos
```

### Los 4 archivos del sistema y qué hace cada uno

| Archivo | Responsabilidad |
|---|---|
| `services/backup.service.js` | El **motor**: lee colecciones y escribe los JSON. Incluye la rotación. |
| `services/backup.scheduler.js` | El **reloj**: usa `node-cron` para disparar el backup en horario. |
| `scripts/backup.js` | El **botón manual**: `npm run backup` corre un respaldo al instante. |
| `scripts/restore.js` | La **vuelta atrás**: `npm run restore` reconstruye la base desde un JSON. |

### Qué es node-cron

Es una librería que ejecuta una función según una **expresión cron** (5 campos:
minuto, hora, día-mes, mes, día-semana). Nuestra expresión por defecto es
`0 3 * * *` = "a las 03:00 de todos los días". Se eligió la madrugada porque hay
poco tráfico y el respaldo no compite con los usuarios.

## 2.5 Qué genera (la evidencia para mostrar)

Cada backup crea una carpeta `backups/<fecha-hora>/` con:
```
users.json         ← 8 documentos
clients.json       ← 2 documentos
categories.json    ← 11 documentos
products.json      ← 19 documentos
quotes.json        ← 26 documentos
companies.json     ← 1 documento
_manifest.json     ← metadata: fecha, conteos, total (67 docs)
```

El `_manifest.json` es la "etiqueta" del backup: dice cuándo se hizo y cuántos
documentos tiene cada colección. Sirve para verificar de un vistazo que el
respaldo está completo.

## 2.6 El ciclo completo de Disaster Recovery

```
   BACKUP            (ocurre un desastre)           RESTORE
  ─────────  ───────────────────────────────────  ──────────
  npm run     alguien borra datos / se corrompe    npm run
  backup      la base / falla el proveedor          restore <carpeta> --drop
     │                                                   │
     ▼                                                   ▼
  JSON guardado                                  Base reconstruida
  con timestamp                                  desde el JSON
```

**Comandos:**
```bash
# Respaldar ahora
npm run backup

# Restaurar el backup más reciente, reemplazando todo
npm run restore latest --drop

# Restaurar uno específico
npm run restore 2026-05-22_01-24-42 --drop
```

El flag `--drop` borra las colecciones actuales antes de restaurar (reemplazo
total). Sin el flag, solo inserta (útil si la base está vacía). El script pide
**confirmación escribiendo "SI"** antes de hacer algo destructivo — una salvaguarda
para no borrar por accidente.

## 2.7 Limitación honesta (prepárate para esta pregunta)

**Si te preguntan: "¿esto corre solo en producción?"**

> "El cron interno corre confiable en local y mientras el servidor esté activo.
> En nuestro hosting (Render plan gratuito), el servicio **se suspende tras 15
> minutos sin tráfico**, así que el cron de las 03:00 no dispararía si nadie usa
> la app a esa hora. Para producción real hay tres caminos: (1) subir a Atlas M10
> que trae backups nativos, (2) un workflow de **GitHub Actions** con `schedule`
> que corre `mongodump` cada noche independiente del servidor, o (3) un cron
> externo que despierte el servicio. Nuestra implementación demuestra el concepto
> completo y es directamente migrable a esas opciones."

Esto convierte una limitación en una demostración de que conoces las alternativas
profesionales.

---

# Mini-resumen para memorizar (elevator pitch)

- **BD:** MongoDB NoSQL documental. 6 colecciones. Diseño basado en *embeber vs
  referenciar*. Lo más destacable: el **snapshot embebido del cliente en la
  cotización** por integridad histórica.
- **Backup:** script propio (porque Atlas M0 no trae backups), corre **diario a
  las 03:00** con node-cron, exporta cada colección a JSON con timestamp, **rota**
  manteniendo las últimas 7. RPO = 1 día, RTO = minutos.
- **Restore:** `npm run restore` cierra el ciclo de Disaster Recovery, con
  confirmación de seguridad para operaciones destructivas.
