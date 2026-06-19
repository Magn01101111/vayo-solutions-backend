API REST para el backend de Vayo Solutions — servicio en Node.js/Express <br> 
que expone endpoints para autenticación, gestión de usuarios, categorías, productos, cotizaciones, ventas, proveedores, reseñas, cupones, banners y más. <br> 
Está pensado para ser consumido por un frontend SPA y para integrarse con MongoDB Atlas.

Información del equipo
------------------
Vayo Solutions es una aplicación web desarrollada por el Equipo N°08, Sección TPY1101.
Para el curso TALLER APLICADO DE PROGRAMACION_004V (2026-1).

Equipo compuesto por:

Jorge Escobar - Desarrollador. <br> 
Paula Toledo - Desarrollador.<br> 
Yoaldry Rodriguez - Scrum Master.<br> 

Link tablero Trello:
https://trello.com/invite/b/69cda7590b9b0af7953f5cbc/ATTI72d0d76e8cc14186865c844e33dbd214797D1434/vayo-solutions
---------------------------

Stack
Lenguaje: JavaScript (Node.js, CommonJS)
Framework / runtime: Node.js + Express (v5)
Base de datos: MongoDB (MongoDB native driver + Mongoose)
Bibliotecas notables: express, mongoose, jsonwebtoken, bcryptjs, multer, cloudinary, helmet, express-rate-limit, nodemailer, pdfkit
Estado y propósito
Servidor API que implementa la lógica de negocio, autenticación y almacenamiento para la plataforma Vayo. Incluye utilidades para seed de datos, backups programados y endpoints para salud/diagnóstico.

Requisitos
------------
Node.js (recomendado v16+ o la versión que uses en tu entorno)
MongoDB Atlas (URI)
Variables de entorno mínimas: ATLAS_URL y JWT_SECRET (el servidor verifica que estas estén definidas al arrancar).
Revisa .env.example para más variables opcionales (FRONTEND_URL, PORT, CLOUDINARY_*, UPLOAD_PATH, etc).

Instalacion rapida
-------------------
git clone https://github.com/Magn01101111/vayo-solutions-backend.git <br> 
cd vayo-solutions-backend <br> 
npm install<br> 
cp .env.example .env<br> 
# editar .env y configurar ATLAS_URL y JWT_SECRET (y otras variables si es necesario)

Ejecutar localmente
----------------
Modo desarrollo: npm run dev

Producción / arranque normal: npm start
El servidor por defecto escucha en el puerto indicado por PORT (o 3000 si no está definido).
---------------------------------
Scripts útiles (package.json)
------------------------------
npm start — Ejecuta node src/server.js<br> 
npm run dev — Ejecuta nodemon src/server.js (desarrollo)<br> 
npm test — Ejecuta tests con Jest<br> 
npm run seed — Ejecuta node src/seeds/seed.js (puebla datos)<br> 
npm run seed:categories — Ejecuta node src/seeds/seed-categories.js<br> 
npm run seed:demo — Ejecuta node src/seeds/seed-demo.js<br> 
npm run seed:supreviews — Ejecuta node src/seeds/seed-suppliers-reviews.js<br> 
npm run backup — Ejecuta node src/scripts/backup.js<br> 
npm run restore — Ejecuta node src/scripts/restore.js<br> 
Endpoints básicos de diagnóstico
GET /health — comprueba el ping a DB y estado de la app
GET / — mensaje raíz ("Backend funcionando correctamente 🚀")
GET /test-db — lista colecciones (útil para verificar la conexión con MongoDB)
Rutas API principales (montadas en src/routes/index.js):

/api/auth<br> 
/api/users<br> 
/api/categories<br> 
/api/products<br> 
/api/clients<br> 
/api/company<br> 
/api/quotes<br> 
/api/sales<br> 
/api/stats<br> 
/api/reports<br> 
/api/suppliers<br> 
/api/reviews<br> 
/api/coupons<br> 
/api/banners<br> 
/api/favorites<br> 
/api/upload<br> 
(Internamente cada router aplica su middleware de autenticación según corresponda.)
-------------------------------------

Variables de entorno (mínimas / recomendadas)
-------------------------------------
ATLAS_URL (obligatoria) — MongoDB Atlas connection string
JWT_SECRET (obligatoria) — clave para firmar tokens JWT
PORT — puerto donde escuchar (opcional)
FRONTEND_URL — orígenes permitidos para CORS (puede ser lista separada por comas)
UPLOAD_PATH — ruta para archivos subidos (si se usa almacenamiento local)
CLOUDINARY_* — si se integra Cloudinary para uploads
Consulta .env.example para el set completo de variables que el proyecto maneja.

Seeds y datos de prueba
Para poblar datos de ejemplo existen scripts en src/seeds. Usa:
-----------------------
npm run seed           # seed general
npm run seed:categories
npm run seed:demo
npm run seed:supreviews


Backups
Hay scripts para backup/restore en src/scripts y un scheduler (cron) en src/services/backup.scheduler que se inicia cuando el servidor arranca. <br>
Revisa esos archivos si quieres cambiar la política de backup.
