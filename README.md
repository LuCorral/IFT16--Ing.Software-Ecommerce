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

Las páginas web heredadas de administración, login y contacto redirigen al inicio en esta demo. Esto no elimina sus endpoints ni controladores.

### Funcionalidades previstas para próximos sprints

- Autenticación y login visible, roles y administración.
- Alta, modificación y eliminación administrativa de productos.
- Ordenamiento de productos.
- Historial y cancelación de pedidos.
- Gestión de usuarios y clientes.
- Cupones, descuentos, exportaciones, tickets/facturación y otras herramientas administrativas.

Estas funciones no se ofrecen en la interfaz de demostración. Sus rutas, modelos y lógica existente se conservan.

Parte de la infraestructura de autenticación con JWT y roles ya se encuentra implementada internamente como trabajo técnico adelantado, aunque no forma parte del incremento funcional visible del Sprint 1.

El campo opcional `descripcion` permite mostrar el detalle del producto; los productos existentes sin descripción muestran un texto alternativo. Los pedidos del checkout demo se identifican como `Compra de demostración` en el campo existente `Pedido.cliente`; no se agregan tablas ni se cambian las relaciones del modelo. El seed de productos actualiza ocho entradas de ejemplo en sitio, conservando sus IDs e imágenes existentes.

### Inicio rápido

Tecnologías: Node.js, Express, Sequelize, SQLite, API REST, HTML, CSS, JavaScript y JWT.

```bash
npm install
```

Copiar `.env.example` como `.env` y configurar `JWT_SECRET` con un valor local propio. Luego iniciar:

```bash
npm start
```

Abrir `http://localhost:3000`. El inicio sincroniza los modelos con SQLite mediante el `sequelize.sync({ alter: true })` existente. Para cargar o actualizar los productos de ejemplo, ejecutar `npm run seed`; el seed actualiza ocho productos de la lista existente sin eliminar filas ni cambiar sus IDs.

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
DB_STORAGE=./ecommerce.sqlite
JWT_SECRET=clave_local_para_desarrollo
```

El archivo `.env` no debe subirse al repositorio.

### 4. Crear o actualizar la base local

Se pueden ejecutar los seeds por separado:

```bash
npm run seed:coupons
npm run seed
npm run seed:users
```

O correr el flujo completo:

```bash
npm run seed:all
```

### 5. Levantar el servidor

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
  "seed": "node seed_DB.js",
  "seed:coupons": "node seed_Cupones_DB.js",
  "seed:users": "node seed_Users_DB.js",
  "seed:all": "node seed_Cupones_DB.js && node seed_DB.js && node seed_Users_DB.js"
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

### Usuarios de prueba

```text
Administrador:
email: admin@example.com
password: 123456

Cliente:
email: cliente@example.com
password: 123456
```

---

## Endpoints principales

### Autenticación

```http
POST /api/auth/login
POST /api/auth/register
```

Ejemplo de login:

```json
{
  "email": "admin@example.com",
  "password": "123456"
}
```

Ejemplo de registro:

```json
{
  "name": "Cliente Nuevo",
  "email": "cliente.nuevo@example.com",
  "password": "123456",
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

### Checkout

```http
POST /api/checkout
```

Requiere usuario autenticado. Valida:

- carrito no vacío;
- productos existentes y vigentes;
- stock disponible;
- cupón aplicado, si corresponde;
- descuento final y actualización de stock.

### Pedidos, detalles y tickets

Estas rutas se montan protegidas desde `server.js`, por lo que requieren token y rol `admin`.

```http
GET    /api/pedidos
GET    /api/pedidos/:id
POST   /api/pedidos
PUT    /api/pedidos/:id
DELETE /api/pedidos/:id
```

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
  -Body '{"email":"admin@example.com","password":"123456"}'

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
