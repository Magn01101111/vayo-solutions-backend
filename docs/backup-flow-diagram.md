# Diagramas de flujo — Backup y Restauración (VAYO)

> Para exportar: pega SOLO el código (desde `flowchart` hasta la última línea,
> sin las comillas triples ```) en https://mermaid.live → Actions → PNG/SVG.

---

## A) Flujo de BACKUP

```mermaid
flowchart TD
    A["Disparador del backup"] --> B{"Como se inicio?"}
    B -->|"node-cron diario 03:00"| C["runBackup()"]
    B -->|"manual: npm run backup"| C

    C --> D{"Hay conexion a MongoDB?"}
    D -->|"No"| E["Error: aborta el respaldo"]
    D -->|"Si"| F["Crear carpeta con timestamp<br/>backups/2026-05-22_03-00-00"]

    F --> G["Listar todas las colecciones"]
    G --> H["Por cada coleccion:<br/>leer todos los documentos"]
    H --> I["Escribir coleccion.json"]
    I --> J{"Quedan colecciones?"}
    J -->|"Si"| H
    J -->|"No"| K["Escribir _manifest.json<br/>fecha + conteos + total"]

    K --> L{"Hay mas de 7 backups?"}
    L -->|"Si"| M["Borrar los mas antiguos<br/>(rotacion)"]
    L -->|"No"| N["Fin: backup completo"]
    M --> N
```

---

## B) Flujo de RESTAURACION

```mermaid
flowchart TD
    A["npm run restore &lt;carpeta&gt; [--drop]"] --> B["Resolver carpeta<br/>(latest = la mas reciente)"]
    B --> C{"La carpeta existe?"}
    C -->|"No"| D["Error: muestra backups disponibles"]
    C -->|"Si"| E{"Se uso el flag --drop?"}

    E -->|"Si"| F{"Confirmar escribiendo SI"}
    F -->|"No confirma"| G["Cancelado: no se modifica nada"]
    F -->|"Confirma"| H["Conectar a MongoDB"]
    E -->|"No"| H

    H --> I["Por cada coleccion.json del backup"]
    I --> J{"--drop activo?"}
    J -->|"Si"| K["Borrar coleccion actual"]
    J -->|"No"| L["insertMany (sobre lo existente)"]
    K --> L
    L --> M{"Quedan archivos?"}
    M -->|"Si"| I
    M -->|"No"| N["Fin: base reconstruida"]
```

---

## C) Ciclo completo de Disaster Recovery (vista de alto nivel)

```mermaid
flowchart LR
    subgraph Normal["Operacion normal"]
        OP["App en uso<br/>datos cambiando"]
    end

    subgraph Proteccion["Respaldo automatico"]
        BK["Backup diario 03:00<br/>JSON con timestamp"]
    end

    subgraph Desastre["Incidente"]
        DS["Borrado accidental /<br/>corrupcion / ataque"]
    end

    subgraph Recuperacion["Recuperacion"]
        RS["npm run restore<br/>reconstruye desde JSON"]
    end

    OP --> BK
    BK -.guarda copia.-> OP
    OP --> DS
    DS --> RS
    RS --> OP
```
