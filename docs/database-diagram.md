# Diagrama de Base de Datos — VAYO Solutions (MongoDB)

> **Nota conceptual para la presentación:**
> MongoDB es una base de datos **NoSQL documental**, no relacional. No existe
> "normalización" en el sentido SQL (1FN, 2FN, 3FN). En su lugar, el diseño se
> basa en dos decisiones por cada relación:
>
> | Decisión | Cuándo se usa | Ejemplo en VAYO |
> |---|---|---|
> | **Embeber** (embed) | Datos que SIEMPRE se leen juntos y pertenecen al documento | Los `items` dentro de una `Quote`, las `specs` dentro de un `Product` |
> | **Referenciar** (reference, `ObjectId`) | Entidades independientes y compartidas | Un `Product` referencia su `Category`; una `Quote` referencia su `Client` |
>
> Esto es el equivalente NoSQL de las claves foráneas (FK) de SQL.

---

## Diagrama Entidad-Relación (Mermaid)

```mermaid
erDiagram
    USERS {
        ObjectId _id PK
        string   name
        string   email UK "único, lowercase"
        string   password "hash bcrypt, select:false"
        string   phone "E.164 +56912345678"
        string   position
        string   role "ADMIN|COTIZADOR|PROVEEDOR|CLIENTE"
        boolean  isActive
        string   profileImage
        ObjectId clientId FK "ref CLIENTS (solo CLIENTE)"
        number   loginAttempts
        date     lockUntil
        date     createdAt
        date     updatedAt
    }

    CLIENTS {
        ObjectId _id PK
        string   name
        string   company
        string   rut UK "único sparse, ej 12345678-9"
        string   email
        string   phone "E.164"
        string   address
        string   notes
        boolean  isActive
        ObjectId createdBy FK "ref USERS (cotizador)"
        ObjectId userId FK "ref USERS (cuenta portal)"
        date     createdAt
        date     updatedAt
    }

    CATEGORIES {
        ObjectId _id PK
        string   name
        string   slug UK "único"
        string   description
        boolean  isActive
        date     createdAt
        date     updatedAt
    }

    PRODUCTS {
        ObjectId _id PK
        ObjectId category FK "ref CATEGORIES"
        string   name
        string   sku UK "único, uppercase"
        string   description
        string   brand
        string   model
        number   price "null = Consultar"
        string   currency "CLP"
        number   stock
        string   availabilityStatus "in_stock|out_of_stock|on_request|discontinued"
        string   imageUrl "legacy = images[0].url"
        string   imagePublicId "legacy"
        boolean  isActive
        array    tags
        date     createdAt
        date     updatedAt
    }

    PRODUCT_IMAGES {
        string url
        string publicId "Cloudinary"
    }
    PRODUCT_SPECS {
        string key
        string label
        string value
    }
    PRODUCT_DOCUMENTS {
        string title
        string type "pdf|doc|image|other"
        number sizeMb
        string url
    }

    COMPANY {
        ObjectId _id PK
        string   name
        string   rut
        string   address
        string   phone
        string   email
        string   website
        string   logoUrl
        number   ivaPercent "default 19"
        string   invoiceTerms
    }

    QUOTES {
        ObjectId _id PK
        string   folio UK "Q-2026-0001"
        ObjectId clientId FK "ref CLIENTS (opcional)"
        string   currency "CLP|USD|UF"
        string   paymentTerms "contado|15-dias|30-dias|60-dias"
        string   deliveryTerms "pickup|delivery|shipping"
        number   validityDays
        date     validUntil
        string   generalNotes
        boolean  acceptsTerms
        date     createdAt
        date     updatedAt
    }

    QUOTE_CLIENT_SNAPSHOT {
        string customerType "person|company"
        string name
        string email
        string taxId "RUT"
        string businessActivity "Giro"
    }
    QUOTE_ITEMS {
        string productId
        string name
        string sku
        number price
        number quantity
        number total
        string notes
    }
    QUOTE_TOTALS {
        number subtotal
        number discount
        number taxableBase
        number iva
        number shipping
        number total
    }

    %% ── Relaciones por REFERENCIA (equivalente a FK en SQL) ──
    USERS      ||--o| CLIENTS    : "clientId (1:1 opcional)"
    CLIENTS    ||--o| USERS      : "userId (cuenta portal)"
    USERS      ||--o{ CLIENTS    : "createdBy (cotizador crea N clientes)"
    CATEGORIES ||--o{ PRODUCTS   : "category (1 categoría : N productos)"
    CLIENTS    ||--o{ QUOTES     : "clientId (1 cliente : N cotizaciones)"

    %% ── Relaciones por EMBEBIDO (sub-documentos dentro del documento) ──
    PRODUCTS ||--o{ PRODUCT_IMAGES    : "embeds images[] (máx 4)"
    PRODUCTS ||--o{ PRODUCT_SPECS     : "embeds specs[]"
    PRODUCTS ||--o{ PRODUCT_DOCUMENTS : "embeds documents[]"
    QUOTES   ||--|| QUOTE_CLIENT_SNAPSHOT : "embeds client{}"
    QUOTES   ||--o{ QUOTE_ITEMS        : "embeds items[]"
    QUOTES   ||--|| QUOTE_TOTALS       : "embeds totals{}"
```

---

## Cómo exportar el diagrama para la presentación

1. Ve a **https://mermaid.live**
2. Pega el bloque de código de arriba (lo que está entre ` ```mermaid ` y ` ``` `)
3. Botón **Actions → PNG / SVG** para descargar la imagen
4. Alternativa en VS Code: instala la extensión **"Markdown Preview Mermaid Support"** (`bierner.markdown-mermaid`) y abre este archivo en preview (Ctrl+Shift+V)

---

## Las 6 colecciones explicadas

| Colección | Tipo | Descripción |
|---|---|---|
| **users** | Maestra | Cuentas que se autentican (admin, cotizador, proveedor, cliente) |
| **clients** | Maestra | Ficha CRM de cada cliente. Puede o no tener cuenta de portal |
| **categories** | Maestra | Categorías del catálogo |
| **products** | Maestra | Catálogo de repuestos HVAC. Embebe imágenes, specs y documentos |
| **company** | Singleton | Configuración única de la empresa (IVA, datos fiscales) |
| **quotes** | Transaccional | Cotizaciones. Embebe un *snapshot* del cliente, items, totales |

## Decisiones de diseño NoSQL clave (para defender en la presentación)

1. **`Quote.client{}` es un snapshot embebido**, NO solo una referencia.
   *Por qué:* si el cliente cambia su nombre/RUT después, la cotización histórica
   debe conservar los datos tal como estaban al emitirla (integridad documental
   y legal). Aun así guardamos `clientId` como referencia para poder agrupar.

2. **`Product.images[]` está embebido** (no es colección aparte).
   *Por qué:* las imágenes de un producto siempre se leen junto al producto y
   nunca se comparten entre productos → embeber evita un JOIN.

3. **`User` ↔ `Client` referencia bidireccional 1:1.**
   *Por qué:* separa la identidad de autenticación (User) de la entidad comercial
   (Client). Un Client puede existir sin login; un User CLIENTE siempre apunta a su Client.

4. **`company` es un singleton.**
   *Por qué:* solo hay una empresa (VAYO). El controlador garantiza un único documento.
