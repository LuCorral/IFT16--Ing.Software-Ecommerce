# EcommerceApp2

Proyecto grupal desarrollado para la materia **Prácticas Profesionalizantes 2** del IFTS 16.

EcommerceApp2 es una aplicación web de tienda online construida con **Node.js**, **Express**, **Sequelize** y **SQLite**. El backend expone una **API REST** organizada con patrón **MVC**, sirve el frontend estático y aplica seguridad con **JWT**, roles de usuario y contraseñas hasheadas con **bcryptjs**.

## Demo Sprint 1

La identidad visible de la aplicación en esta demo es **Ecommerce**.

El incremento visible está centrado en el flujo `Inicio -> Productos -> Detalle -> Carrito -> Confirmar pedido`:

- Inicio con productos destacados.
- Catálogo, detalle, búsqueda por nombre y filtro por categoría.
- Carrito con agregar, ajustar cantidades, quitar productos, validación de stock y cálculo de subtotales/total.
- Confirmación de compra que crea el pedido y sus detalles, descuenta stock y vacía el carrito.

El checkout visible usa el endpoint dedicado `/api/pedidos/demo`, que comparte la validación de stock y la transacción Sequelize para crear `Pedido` y `DetallePedido`, pero no requiere iniciar sesión. La ruta autenticada existente `POST /api/pedidos` se conserva para el resto del sistema. JWT, roles y middlewares no se eliminaron.

El panel administrativo y el login se sirven desde `/admin.html` y `/login.html`; el panel requiere una sesión con rol de administrador. La página de contacto continúa redirigiendo al inicio.

### Funcionalidades previstas para próximos sprints

- Ordenamiento de productos.
- Gestión de usuarios y clientes.
- Cupones, descuentos, exportaciones, tickets/facturación y otras herramientas administrativas.

Las rutas y controladores existentes conservan la autenticación JWT y las reglas de autorización por rol.

El campo opcional `descripcion` permite mostrar el detalle del producto; los productos existentes sin descripción muestran un texto alternativo. Los pedidos del checkout demo se identifican como `Compra de demostración` en el campo existente `Pedido.cliente`; no se agregan tablas ni se cambian las relaciones del modelo. El seed de productos actualiza ocho entradas de ejemplo en sitio, conservando sus IDs e imágenes existentes.

La administración obtiene las categorías desde los productos existentes y el servidor rechaza categorías inexistentes al crear o editar. Los pedidos autenticados guardan el identificador de propietario existente `demo-user:<id>:<email>`; las respuestas administrativas resuelven nombre, apellido y correo desde el usuario identificado por ese ID, y el acceso del cliente se limita a sus propios pedidos. Los registros históricos con una dirección de correo como propietario también se reconocen; si un pedido no contiene un identificador resoluble, se presenta como cliente no identificado sin modificar ni descartar el dato histórico. Los comprobantes aprobados siguen disponibles para pedidos pagados, enviados y entregados.

### Inicio rápido

Tecnologías: Node.js, Express, Sequelize, SQLite, API REST, HTML, CSS, JavaScript y JWT.

```bash
npm ci
npm test
```

Usar Node.js 22. Copiar `.env.example` como `.env` y reemplazar `JWT_SECRET` por un valor aleatorio de al menos 32 caracteres. Para generarlo:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Luego iniciar:

```bash
npm start
```

Abrir `http://localhost:3000`. El servidor crea tablas faltantes y aplica migraciones versionadas; no ejecuta `sync({ alter: true })` ni seeds al arrancar. Para poblar una base de demostración de forma explícita e idempotente, seguir la sección **Demo pública y despliegues**.

---

## Tecnologías utilizadas

### Stack principal

| JavaScript | Node.js | Express | Sequelize | SQLite | JWT | HTML5 | CSS3 |
|---|---|---|---|---|---|---|---|
| ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=000) | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=fff) | ![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=fff) | ![Sequelize](https://img.shields.io/badge/Sequelize-52B0E7?style=for-the-badge&logo=sequelize&logoColor=fff) | ![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=fff) | ![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=fff) | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=fff) | ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=fff) |

### Herramientas de desarrollo

| Git | GitHub | VS Code | Postman |
|---|---|---|---|
| ![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=fff) | ![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=fff) | ![VS Code](https://img.shields.io/badge/VS_Code-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=fff) | ![Postman](https://img.shields.io/badge/Postman-FF6C37?style=for-the-badge&logo=postman&logoColor=fff) |

### Librerías y herramientas implementadas

`express` · `sequelize` · `sqlite3` · `dotenv` · `cors` · `jsonwebtoken` · `bcryptjs` · `Thunder Client/Postman` · `Git/GitHub` · `VS Code`

---

## Descripción del proyecto

La aplicación permite trabajar con entidades típicas de un e-commerce:

- Productos con precio, stock, imagen, categoría, rating, reviews y fechas de vigencia.
- Categorías generadas a partir de los productos cargados.
- Usuarios con registro, login, rol y carrito persistido.
- Clientes, pedidos, detalles de pedido y tickets.
- Cupones con código, porcentaje de descuento, vencimiento, stock de usos y estado activo.
- Checkout con validación de carrito, stock, vigencia de productos y aplicación de cupones.

El frontend se sirve desde Express y debe abrirse desde `http://localhost:3000` para que pueda comunicarse correctamente con la API.

---

## Arquitectura

El proyecto sigue una organización basada en **MVC**:

- `src/models/`: define las entidades Sequelize y sus validaciones.
- `src/controllers/`: contiene la lógica de negocio de cada recurso.
- `src/routes/`: conecta los endpoints HTTP con sus controladores.
- `src/middlewares/`: centraliza autenticación y autorización.
- `src/config/`: contiene la configuración de base de datos.
- `src/utils/`: contiene utilidades compartidas, como paginación.

La base local se maneja con **SQLite** mediante **Sequelize**. La configuración se toma desde `.env`.

---

## Estructura general del proyecto

```text
EcommerceApp2/
|-- css/
|   |-- styles.css
|   `-- styles-corregido.css
|-- data/
|   `-- productos.json
|-- html/
|   |-- admin.html
|   |-- admin copy.html
|   |-- cart.html
|   |-- contacto.html
|   |-- login.html
|   `-- productos.html
|-- img/
|   |-- AuricularesBluetooth.png
|   |-- CafeteraExpress.png
|   |-- DiscoExterno1TB.png
|   |-- SmartTV43.png
|   `-- ...
|-- js/
|   `-- main.js
|-- src/
|   |-- config/
|   |   `-- database.js
|   |-- controllers/
|   |   |-- authController.js
|   |   |-- categoriasController.js
|   |   |-- clientesController.js
|   |   |-- cuponController.js
|   |   |-- detallePedidoController.js
|   |   |-- pedidoController.js
|   |   |-- productosController.js
|   |   |-- ticketsController.js
|   |   `-- usuariosController.js
|   |-- data/
|   |   |-- categoriasData.js
|   |   |-- cuponData.js
|   |   |-- detallePedidoData.js
|   |   |-- pedidoData.js
|   |   |-- productos.json
|   |   |-- productosData.js
|   |   `-- ticketsData.js
|   |-- middlewares/
|   |   `-- authMiddleware.js
|   |-- models/
|   |   |-- cart.js
|   |   |-- Categoria.js
|   |   |-- Cliente.js
|   |   |-- Cupon.js
|   |   |-- DetallePedido.js
|   |   |-- Pedido.js
|   |   |-- Producto.js
|   |   |-- Ticket.js
|   |   `-- User.js
|   |-- routes/
|   |   |-- authRoutes.js
|   |   |-- categoriasRoutes.js
|   |   |-- clientesRoutes.js
|   |   |-- cuponRoutes.js
|   |   |-- detallePedidoRoutes.js
|   |   |-- pedidoRoutes.js
|   |   |-- productosRoutes.js
|   |   |-- ticketsRoutes.js
|   |   `-- usuariosRoutes.js
|   `-- utils/
|       `-- pagination.js
|-- index.html
|-- server.js
|-- main-corregido.js
|-- seed_DB.js
|-- seed_Cupones_DB.js
|-- seed_Users_DB.js
|-- package.json
|-- package-lock.json
|-- ecommerce.sqlite.sql
|-- check_categorias.js
|-- check_productos.js
|-- test_db.js
|-- ver_productos.js
|-- .env
|-- .gitignore
|-- agents.md
`-- README.md
```

---

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/PabloHD2024/EcommerceApp2.git
cd EcommerceApp2
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crear un archivo `.env` en la raíz del proyecto:

```env
PORT=3000
DB_DIALECT=sqlite
DB_STORAGE=./data/ecommerce.sqlite
JWT_SECRET=<valor-aleatorio-privado-de-32-caracteres-o-mas>
```

El archivo `.env` no debe subirse al repositorio.

### 4. Levantar el servidor

```bash
npm start
```

Servidor local:

```text
http://localhost:3000
```

Importante: abrir la aplicación desde `http://localhost:3000`, no haciendo doble click sobre `index.html`, porque el frontend necesita consumir la API del backend.

---

## Scripts disponibles

```json
{
  "start": "node server.js",
  "test": "node --test",
  "migrate": "node scripts/run-migrations.js",
  "db:backup": "node scripts/backup-db.js",
  "seed:demo": "node scripts/seed-demo.js"
}
```

---

## Seguridad

La API utiliza autenticación con **JWT** y autorización por rol.

- `authenticateToken`: valida el header `Authorization: Bearer TOKEN`.
- `isAdmin`: permite ejecutar acciones sensibles solo a usuarios con rol `admin`.
- Las contraseñas se guardan hasheadas con `bcryptjs`.
- Roles disponibles: `admin` y `client`.
- Los tokens de login vencen luego de `2h`.

### Usuarios de demostración

Las cuentas se crean mediante `npm run seed:demo` con credenciales privadas ingresadas en el entorno. El repositorio no publica contraseñas predeterminadas.

---

## Endpoints principales

### Autenticación

```http
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/profile
```

`GET /api/auth/profile` requiere JWT y devuelve el perfil del usuario autenticado.

Ejemplo de login (usar credenciales propias, nunca una contraseña publicada):

```json
{
  "email": "demo-admin@example.invalid",
  "password": "<contraseña-privada>"
}
```

Ejemplo de registro:

```json
{
  "name": "Cliente Nuevo",
  "email": "cliente.nuevo@example.com",
  "password": "<contraseña-privada>",
  "telefono": "1122334455"
}
```

### Productos

```http
GET    /api/productos
GET    /api/productos/:id
POST   /api/productos
PUT    /api/productos/:id
DELETE /api/productos/:id
```

Lectura pública:

- `GET /api/productos`
- `GET /api/productos/:id`

Escritura protegida para administradores:

- `POST /api/productos`
- `PUT /api/productos/:id`
- `DELETE /api/productos/:id`

Filtros y paginación:

```http
GET /api/productos?categoria=Tecnología&nombre=mouse&page=1&limit=6
```

### Categorías

```http
GET /api/categorias
```

Devuelve las categorías disponibles a partir de los productos.

### Clientes y carrito

```http
POST /api/clientes/carrito
GET  /api/clientes/carrito/recuperar
```

Estas rutas requieren usuario autenticado.

Rutas administrativas:

```http
GET    /api/clientes
GET    /api/clientes/:id
POST   /api/clientes
PUT    /api/clientes/:id
DELETE /api/clientes/:id
```

### Usuarios

Todas las rutas de usuarios requieren token y rol `admin`.

```http
GET    /api/usuarios
GET    /api/usuarios/:id
POST   /api/usuarios
PUT    /api/usuarios/:id
DELETE /api/usuarios/:id
```

### Cupones

Rutas públicas para validar y calcular descuentos:

```http
GET /api/cupones/validar/:codigo
GET /api/cupones/aplicar/:codigo?monto=10000
```

Rutas administrativas:

```http
GET    /api/cupones
GET    /api/cupones/:id
POST   /api/cupones
POST   /api/cupones/:id/usar
PUT    /api/cupones/:id
DELETE /api/cupones/:id
```

### Checkout y pedidos

```http
POST /api/pedidos
```

Requiere usuario autenticado. Es el único flujo para crear pedidos y valida:

- productos y cantidades;
- stock disponible y descuento de stock;
- cupón aplicado, si corresponde;
- subtotal, descuento y total final.

### Pedidos, detalles y tickets

Las rutas de pedidos requieren JWT. Los clientes solo consultan sus pedidos; el administrador puede consultar todos. Las transiciones administrativas (`PUT`) requieren rol `admin`.

```http
GET    /api/pedidos
GET    /api/pedidos/:id
POST   /api/pedidos
POST   /api/pedidos/:id/pagar
GET    /api/pedidos/:id/comprobante
PATCH  /api/pedidos/:id/cancelar
PUT    /api/pedidos/:id
DELETE /api/pedidos/:id
```

Los detalles de pedido y tickets requieren JWT y rol `admin`.

```http
GET    /api/detalles-pedido
GET    /api/detalles-pedido/pedido/:pedidoId
GET    /api/detalles-pedido/:id
POST   /api/detalles-pedido
PUT    /api/detalles-pedido/:id
DELETE /api/detalles-pedido/:id
```

```http
GET    /api/tickets
GET    /api/tickets/:id
POST   /api/tickets
PUT    /api/tickets/:id
DELETE /api/tickets/:id
```

---

## Notificaciones por correo simuladas

No se envía ningún email real: cada notificación se persiste en la tabla `notificaciones_correo` (`pedido_id`, `destinatario`, `asunto`, `cuerpo`, `estado_pedido`, `fecha`).

- `POST /api/pedidos` guarda el correo de confirmación con estado `Pendiente`.
- `POST /api/pedidos/:id/pagar` guarda el correo de pago aprobado.
- `PUT /api/pedidos/:id` genera correo cuando el administrador cambia el estado a `Pagado`, `Enviado` o `Entregado`. No se duplica si el estado no cambió, y no se genera para `Pendiente` ni `Cancelado`.
- Las plantillas viven en `src/utils/notificacionesCorreo.js`.
- La escritura ocurre en la misma transacción Sequelize que el pedido, por lo que un pedido rechazado no deja registros huérfanos.

Las respuestas de esos tres endpoints incluyen el objeto `correo_simulado` (o `null` si no corresponde):

```json
{
  "correo_simulado": {
    "id": 12,
    "pedido_id": 34,
    "destinatario": "cliente@example.com",
    "asunto": "Pago confirmado del pedido #34",
    "cuerpo": "Hola,\n\nAprobamos el pago de tu pedido #34...",
    "estado_pedido": "Pagado",
    "fecha": "2026-10-26T15:30:00.000Z"
  }
}
```

En el frontend, `js/main.js` expone `showEmailToast(correo)` y el checkout del cliente (`js/main.js`) y el cambio de estado del admin (`html/admin.html`) lo invocan con `data.correo_simulado` para mostrar un toast flotante en la esquina inferior derecha.

Consulta rápida de los últimos registros:

```powershell
node -e "const s=require('./src/config/database');const N=require('./src/models/NotificacionCorreo');N.findAll({order:[['id','DESC']],limit:5}).then(r=>{console.log(r.map(x=>x.toJSON()));return s.close();})"
```

---

## Paginación

Los recursos que usan `src/utils/pagination.js` devuelven una respuesta con esta forma:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 0,
    "totalPages": 0,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

Parámetros soportados:

```http
?page=1&limit=10
```

---

## Pruebas rápidas con PowerShell

### Productos públicos

```powershell
Invoke-RestMethod http://localhost:3000/api/productos
```

### Login administrador

```powershell
$login = Invoke-RestMethod `
  -Uri http://localhost:3000/api/auth/login `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{ email = $env:DEMO_ADMIN_EMAIL; password = $env:DEMO_ADMIN_PASSWORD } | ConvertTo-Json)

$token = $login.token
```

### Crear producto con token administrador

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3000/api/productos `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"nombre":"Producto Test","precio":1000,"stock":5,"categoria":"Test","image":"../img/placeholder.png","rating":4,"reviews":0}'
```

### Validar cupón

```powershell
Invoke-RestMethod http://localhost:3000/api/cupones/validar/BIENVENIDA10
Invoke-RestMethod "http://localhost:3000/api/cupones/aplicar/BIENVENIDA10?monto=10000"
```

---

## Estado actual del proyecto

- Servidor Express funcionando.
- Frontend estático servido desde Express.
- Conexión SQLite mediante Sequelize.
- Configuración por variables de entorno.
- CRUD de productos con lectura pública y escritura protegida por admin.
- Filtros y paginación para productos.
- Categorías disponibles desde la API.
- Registro y login de usuarios.
- JWT con expiración y roles `admin`/`client`.
- Hash de contraseñas con `bcryptjs`.
- Persistencia de carrito por usuario autenticado.
- CRUD administrativo de usuarios, clientes, cupones, pedidos, detalles y tickets.
- Checkout con transacción, validación de stock, vigencia y cupones.
- Seeds para productos, cupones y usuarios.

---

## Próximos pasos sugeridos

- Agregar pruebas automatizadas para auth, productos, cupones y checkout.
- Centralizar manejo de errores.
- Completar relaciones Sequelize entre usuarios/clientes, pedidos, detalles y productos.
- Revisar permisos específicos para cada módulo administrativo.
- Documentar ejemplos de body para pedidos, detalles y tickets.
- Mejorar validaciones de entrada en todos los controladores.
- Unificar archivos de datos legacy con modelos Sequelize cuando ya no sean necesarios.

---

## Integrantes

- Lucía Corral
- Pablo Demartini
- Carla Guisande
- Ignacio Hernandez
- Ignacio Vidal

---

## Demo pública y despliegues

### Hosting evaluado: alwaysdata Free

La oferta oficial Free figura a **0 €/mes**, para necesidades personales, con 1 GB de almacenamiento SSD, 256 MB de RAM, 1/4 de CPU y tres días de copias de respaldo. La documentación oficial incluye sitios Node.js, acceso SSH, variables de entorno por sitio, reinicio vía API y HTTPS para direcciones `*.alwaysdata.net`. Es suficiente para una demostración académica pequeña y no es una prueba temporal de un plan pago. Respetá la condición de uso personal y los límites de recursos; el almacenamiento y la CPU son modestos.

Fuentes oficiales consultadas:

- [Ofertas y plan Free](https://www.alwaysdata.com/en/offers/)
- [Configuración de Node.js](https://help.alwaysdata.com/en/docs/web-hosting/languages/nodejs/configuration/)
- [Agregar un sitio web](https://help.alwaysdata.com/en/docs/web-hosting/sites/add-a-site/)
- [Reinicio de un sitio](https://help.alwaysdata.com/en/docs/web-hosting/sites/restart-a-site/)
- [API de alwaysdata](https://help.alwaysdata.com/en/docs/development/api/)
- [SSH y claves](https://help.alwaysdata.com/en/docs/web-hosting/remote-access/ssh/)
- [Certificados Let's Encrypt y direcciones alwaysdata.net](https://help.alwaysdata.com/en/docs/web-hosting/sites/ssl-tls/lets-encrypt/)
- [Copias de respaldo del proveedor](https://help.alwaysdata.com/en/docs/web-hosting/backups/)
- [Tokens de acceso a la API](https://help.alwaysdata.com/en/docs/admin-billing/profile/tokens/)

### Preparación inicial del hosting (una sola vez)

1. Crear una cuenta Free de alwaysdata y usar la dirección `https://<cuenta>.alwaysdata.net`. La dirección `*.alwaysdata.net` usa el certificado comodín HTTPS del proveedor.
2. En **Web > Sites**, agregar un sitio de tipo **Node.js** para esa dirección. Elegir Node.js 22 y configurar el comando de inicio equivalente a:

   ```text
   node /home/<cuenta>/apps/ecommerce/current/server.js
   ```

   El sitio debe proporcionar el `IP`/`HOST` interno y `PORT` indicados por alwaysdata. El servidor los consume para escuchar en el puerto asignado.
3. Crear por SSH los directorios persistentes y de releases:

   ```bash
   mkdir -p /home/<cuenta>/apps/ecommerce/releases
   mkdir -p /home/<cuenta>/data
   ```

4. Configurar en el entorno del sitio, no en el repositorio:

   ```text
   NODE_ENV=production
   NODEJS_VERSION=22
   DB_DIALECT=sqlite
   DB_STORAGE=/home/<cuenta>/data/ecommerce.sqlite
   JWT_SECRET=<valor aleatorio privado, mínimo 32 caracteres>
   IP=<IP interna asignada por alwaysdata>
   PORT=<puerto asignado por alwaysdata>
   ```

   Generá el secreto localmente con `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` y pegalo directamente en la configuración del sitio. No lo agregues a GitHub ni a `.env.example`. La ruta de SQLite queda fuera de `apps/ecommerce`, por lo que no se reemplaza al desplegar.
5. En **Remote Access > SSH/SFTP**, habilitar un usuario de despliegue y cargar una clave pública ED25519. El servidor SSH usa el host `ssh-<cuenta>.alwaysdata.net` y el puerto 22. Verificá su fingerprint desde el panel antes de guardar el `known_hosts` utilizado por Actions.
6. Crear un token de API alwaysdata para reiniciar solo el sitio. alwaysdata requiere 2FA para crear tokens y un token hereda los permisos de su perfil; asignale a ese perfil solamente los permisos necesarios.
7. En GitHub, ir a **Settings > Secrets and variables > Actions** y configurar:

   **Repository variables** (son rutas/identificadores, no credenciales):

   | Nombre | Valor |
   |---|---|
   | `ALWAYSDATA_ACCOUNT` | Nombre de la cuenta alwaysdata |
   | `ALWAYSDATA_SSH_HOST` | `ssh-<cuenta>.alwaysdata.net` |
   | `ALWAYSDATA_SSH_USER` | Usuario SSH creado para Actions |
   | `ALWAYSDATA_SITE_ID` | ID numérico del sitio en **Web > Sites** |
   | `ALWAYSDATA_APP_DIR` | `/home/<cuenta>/apps/ecommerce` |
   | `ALWAYSDATA_DB_STORAGE` | `/home/<cuenta>/data/ecommerce.sqlite` |
   | `DEMO_PUBLIC_URL` | `https://<cuenta>.alwaysdata.net` |

   **Repository secrets**:

   | Nombre | Valor |
   |---|---|
   | `ALWAYSDATA_SSH_PRIVATE_KEY` | Clave privada ED25519 dedicada a Actions |
   | `ALWAYSDATA_SSH_KNOWN_HOSTS` | Línea `known_hosts` con el fingerprint del servidor ya verificado |
   | `ALWAYSDATA_API_TOKEN` | Token API del perfil mínimo indicado arriba |

   Las dos rutas deben coincidir exactamente con las configuradas en el sitio. No guardes `JWT_SECRET`, contraseñas de usuarios ni bases de datos en GitHub.

### Datos de demo

La operación es explícita; no se ejecuta al iniciar ni al desplegar:

```bash
cd /home/<cuenta>/apps/ecommerce/current
```

Antes de ejecutarla por SSH, cargá en esa sesión `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `DEMO_CLIENT_EMAIL` y `DEMO_CLIENT_PASSWORD` con direcciones propias y contraseñas de al menos 12 caracteres. No las guardes en el repositorio, en el workflow ni en los logs. Luego:

```bash
read -r -p "Admin email: " DEMO_ADMIN_EMAIL
read -r -s -p "Admin password: " DEMO_ADMIN_PASSWORD; printf '\n'
read -r -p "Client email: " DEMO_CLIENT_EMAIL
read -r -s -p "Client password: " DEMO_CLIENT_PASSWORD; printf '\n'
export DEMO_ADMIN_EMAIL DEMO_ADMIN_PASSWORD DEMO_CLIENT_EMAIL DEMO_CLIENT_PASSWORD
DB_STORAGE=/home/<cuenta>/data/ecommerce.sqlite npm run seed:demo
unset DEMO_ADMIN_EMAIL DEMO_ADMIN_PASSWORD DEMO_CLIENT_EMAIL DEMO_CLIENT_PASSWORD
```

El proceso crea las dos cuentas y los productos de `src/data/demo-products.json` solo si todavía no existen. Repetirlo no reinicia stock, contraseñas ni datos existentes; una cuenta preexistente con rol incompatible causa un error explícito. Los pagos siguen siendo simulados y el comprobante se identifica como no fiscal. No hay envío de correo configurado.

### Flujo de GitHub Actions

El workflow `.github/workflows/deploy-demo.yml` ejecuta `npm ci` y `npm test` en Pull Requests a `main` y en pushes a `main`. Solo el evento `push` de `main` despliega; por lo tanto, el merge del Pull Request inicia el despliegue y las ramas de trabajo no publican al sitio.

La automatización:

1. Sube el commit a un directorio nuevo `releases/<SHA>` y excluye `.env`, bases SQLite, pruebas y `node_modules`.
2. Instala las dependencias con Node.js 22 en el hosting. Antes de una migración pendiente, la app crea una copia SQLite consistente; luego ejecuta la migración.
3. Activa el release con un cambio atómico del enlace `current`, reinicia el sitio mediante la API oficial de alwaysdata y consulta `/health` por HTTPS.
4. `/health` devuelve únicamente estado y SHA desplegado; el mismo SHA queda registrado en el log de inicio.
5. Si el reinicio o la comprobación de salud falla y existe una versión anterior, vuelve al enlace anterior y solicita su reinicio. El job queda fallido. Una primera publicación no tiene todavía un release anterior al cual volver.
6. Tras una verificación exitosa, conserva el release actual y los dos anteriores. SQLite, configuración del sitio y copias `.bak` quedan fuera del directorio reemplazado.

La concurrencia del workflow impide que dos despliegues al sitio principal se ejecuten simultáneamente. Se recomienda configurar reglas de protección de rama en GitHub para exigir que pase el job **Tests** antes de permitir el merge.

### Migraciones, respaldo y recuperación

El arranque usa `sequelize.sync()` sin `alter: true`: crea tablas faltantes, pero no modifica automáticamente tablas existentes. Los cambios de esquema deben agregarse como archivos ordenados en `src/migrations/`, en forma compatible y no destructiva. El runner registra lo aplicado en `SchemaMigrations`; antes de aplicar migraciones pendientes sobre un archivo ya existente, crea un respaldo SQLite en el mismo directorio persistente. `npm run migrate` permite aplicar el mismo proceso de forma manual.

Para hacer un respaldo adicional en cualquier momento:

```bash
DB_STORAGE=/home/<cuenta>/data/ecommerce.sqlite npm run db:backup
```

La oferta Free mantiene además los respaldos del proveedor por tres días. Antes de recuperar manualmente, detené el sitio en **Web > Sites** para no dejar escrituras activas; preservá el archivo actual y restaurá una copia consistente:

```bash
cd /home/<cuenta>/data
mv ecommerce.sqlite ecommerce.sqlite.failed
cp ecommerce.sqlite.<fecha>.bak ecommerce.sqlite
```

Después iniciá/reiniciá el sitio. También se puede usar **Advanced > Restore backups** para recuperar los respaldos gestionados por alwaysdata.

El rollback automático cambia el código, no deshace migraciones ni restaura datos. Las migraciones incluidas son aditivas; mantené ese requisito para que el código anterior siga siendo compatible. Para cambios destructivos o incompatibles, primero diseñá una migración en etapas y un plan de restauración manual. Los archivos SQLite locales no se suben ni se copian al hosting.

### Verificación del despliegue

Después de configurar la cuenta y los valores de GitHub:

1. Abrí `https://<cuenta>.alwaysdata.net/health`; debe devolver `status: "ok"` y el commit activo.
2. Creá y autenticá cuentas cliente desde navegadores distintos; verificá perfil, catálogo, carrito, pedido, pago simulado e historial.
3. Comprobá que un cliente no pueda acceder a un pedido ajeno ni a las rutas administrativas; ingresá con la cuenta admin creada explícitamente.
4. Reiniciá el sitio desde el panel y verificá que usuarios y pedidos sigan disponibles.
5. Tras tener un Pull Request aprobado, fusioná una actualización inocua a `main`; verificá que el workflow finalice y que `/health` muestre el SHA nuevo sin perder datos.

Todavía no se realizó un despliegue público: requiere una cuenta alwaysdata, la configuración del sitio y los secretos/variables indicados. El repositorio no puede comprobar la persistencia ni la URL hasta que esos accesos se configuren.
