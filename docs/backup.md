# Estrategia de Respaldo (Backup) — VAYO Solutions

## ¿Por qué se necesita un backup?

Una base de datos puede perderse o corromperse por múltiples causas:

- **Error humano:** alguien borra datos por accidente (un `deleteMany` mal hecho).
- **Bug en el código:** una migración o script daña registros.
- **Ataque:** ransomware, acceso no autorizado, borrado malicioso.
- **Falla de infraestructura:** el proveedor pierde datos (raro, pero pasa).

Sin respaldo, cualquiera de estos casos significa **pérdida permanente** de la
información del negocio: clientes, cotizaciones, productos. Por eso todo sistema
profesional implementa una estrategia de **Disaster Recovery (DR)**.

## Conceptos clave (para la presentación)

| Concepto | Significado | En VAYO |
|---|---|---|
| **RPO** (Recovery Point Objective) | ¿Cuántos datos puedo perder como máximo? | 1 día (backup diario) |
| **RTO** (Recovery Time Objective) | ¿En cuánto tiempo debo poder restaurar? | Minutos (restaurar el JSON) |
| **Regla 3-2-1** | 3 copias, en 2 medios distintos, 1 fuera del sitio | Atlas (nube) + JSON local + (ideal: subir a la nube) |
| **Rotación** | Conservar solo las últimas N copias | 7 últimas (configurable) |

## ¿MongoDB no hace esto solo?

**Sí, pero no en el plan gratuito.** MongoDB Atlas ofrece backups automáticos
(*Cloud Backups* con snapshots continuos y *point-in-time recovery*), pero **solo
desde el tier M10 en adelante** (de pago, ~USD 57/mes). El tier gratuito **M0**
que usamos en este proyecto **no incluye backups**.

Por eso implementamos un backup propio a nivel de aplicación.

---

## Cómo funciona nuestra solución

### Arquitectura

```
┌──────────────────┐     cron diario 03:00      ┌────────────────────┐
│  node-cron       │ ─────────────────────────► │ backup.service.js  │
│  (scheduler)     │                            │  runBackup()       │
└──────────────────┘                            └─────────┬──────────┘
                                                          │
                          lee TODAS las colecciones       │
                                                          ▼
                                          ┌───────────────────────────┐
                                          │ backups/2026-05-02_03-00/  │
                                          │   users.json               │
                                          │   clients.json             │
                                          │   products.json            │
                                          │   quotes.json              │
                                          │   categories.json          │
                                          │   companies.json           │
                                          │   _manifest.json           │
                                          └───────────────────────────┘
```

### Componentes

| Archivo | Rol |
|---|---|
| `src/services/backup.service.js` | Lógica: lee cada colección y la exporta a JSON con timestamp + rotación |
| `src/services/backup.scheduler.js` | Programa la ejecución automática con `node-cron` |
| `src/scripts/backup.js` | Ejecución manual (`npm run backup`) |
| `src/server.js` | Arranca el scheduler al iniciar el servidor |

### Flujo paso a paso

1. **node-cron** dispara la tarea según el horario configurado (default: `0 3 * * *` = diario 03:00).
2. `runBackup()` verifica que haya conexión activa a MongoDB.
3. Crea una carpeta con timestamp: `backups/2026-05-02_03-00-00/`.
4. Lista todas las colecciones (`db.listCollections()`).
5. Por cada colección, lee todos los documentos y los escribe en un `.json`.
6. Escribe un `_manifest.json` con metadata (fecha, conteo por colección, total).
7. **Rotación:** si hay más de 7 backups, borra los más antiguos.

---

## Cómo usarlo

### Backup manual (ideal para la demo)

```bash
npm run backup
```

Salida esperada:
```
[backup] ✔ 67 documentos respaldados en backups/2026-05-22_01-24-42
── Resumen del backup ──
Carpeta:      backups/2026-05-22_01-24-42
Total docs:   67
┌────────────┬────────┐
│   users    │   8    │
│  products  │   19   │
│   quotes   │   26   │
│ ...        │  ...   │
└────────────┴────────┘
```

### Backup automático

Se inicia solo al levantar el servidor (`npm run dev` o `npm start`).
En consola verás:
```
[backup] Scheduler activo — programado con cron "0 3 * * *"
```

### Variables de entorno (opcionales)

```
BACKUP_ENABLED=true        # false para desactivar el scheduler
BACKUP_CRON=0 3 * * *      # horario (formato cron de 5 campos)
BACKUP_KEEP=7              # cuántas copias conservar
```

> Para la demo, puedes poner `BACKUP_CRON` con la expresión de "cada minuto"
> (`* * * * *`) y mostrar cómo se generan carpetas automáticamente.

---

## Cómo restaurar un backup

Para restaurar una colección desde su JSON, usando `mongoimport`:

```bash
mongoimport --uri "TU_ATLAS_URL" --collection products \
  --file backups/2026-05-02_03-00-00/products.json --jsonArray --drop
```

O programáticamente con un script que lea el JSON y haga `insertMany`.

---

## Limitación en producción (Render free tier)

⚠️ El backend está en **Render plan gratuito**, que **suspende el servicio tras
15 min sin tráfico**. Por eso el cron interno **no dispara de forma confiable** a
las 03:00 si nadie está usando la app.

**Soluciones de producción (en orden de profesionalismo):**

1. **Atlas M10+** — backups nativos gestionados (lo ideal si hay presupuesto).
2. **GitHub Actions con `schedule`** — gratis y confiable. Un workflow corre
   `mongodump` cada noche y guarda el dump como *artifact*. No depende de que el
   servidor esté despierto.
3. **Cron externo** (cron-job.org) que pegue a un endpoint `/api/admin/backup`
   para despertar el servicio y forzar el respaldo.

Para este proyecto académico, el script + node-cron demuestra el concepto
completo; en una puesta en producción real se migraría a la opción 1 o 2.

---

## Ejemplo de GitHub Actions (referencia para producción)

```yaml
# .github/workflows/backup.yml
name: Daily DB Backup
on:
  schedule:
    - cron: '0 6 * * *'   # 06:00 UTC = 03:00 Chile
  workflow_dispatch:        # permite ejecución manual
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install mongodb-tools
        run: |
          wget -qO- https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
          sudo apt-get install -y mongodb-database-tools
      - name: Run mongodump
        run: mongodump --uri="${{ secrets.ATLAS_URL }}" --archive=backup.gz --gzip
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.run_id }}
          path: backup.gz
          retention-days: 30
```
