# Gestión de cuenta — Sprint 3

Base: `00d3e6f` de `origin/main`. Rama: `feature/sprint3-gestion-cuenta`.

## Funciones

- **SCRUM-10:** editar nombre, apellido, correo y teléfono opcional desde Mi perfil. Validación de campos obligatorios, formato y correo único sin distinguir mayúsculas. No permite modificar ID, rol ni contraseña por esta ruta. El saludo se actualiza y los datos persisten al recargar. Antes de cambiar el email, los pedidos históricos por correo se vinculan al ID del usuario.
- **SCRUM-13:** sesión, contraseña actual validada, nueva contraseña y confirmación coincidente. Mínimo vigente: 6 caracteres; máximo: 72 bytes UTF-8 por el límite de bcrypt. Se guarda el nuevo hash y se invalidan las sesiones y enlaces de recuperación anteriores. El resultado se informa en la pantalla de login.
- **SCRUM-12:** enlace de recuperación en login; solo se envía a cuentas registradas. Respuesta genérica que no revela si existe una cuenta. Token aleatorio de 256 bits, hash SHA-256 persistido, vencimiento de 20 minutos y consumo atómico único. Reenviar invalida el enlace anterior. El restablecimiento invalida sesiones y la contraseña previa. El token viaja en el fragmento del enlace y se retira del historial al cargar.
- **SCRUM-14:** diálogo con contraseña y texto ELIMINAR. Cancelar o Escape cierra sin eliminar. Se borra el usuario y su carrito; se anonimizan identificadores de pedidos y datos de cliente en comprobantes, y se eliminan notificaciones asociadas. Se conservan importes y productos históricos. Se limpia la sesión y el carrito local. Una cuenta nueva con el mismo correo no hereda pedidos. No permite eliminar al último administrador.

## API

| Método | Ruta | Datos |
|---|---|---|
| PUT | `/api/auth/profile` | Sesión; `name`, `apellido`, `email`, `telefono` |
| PUT | `/api/auth/password` | Sesión; `currentPassword`, `password`, `confirmPassword` |
| POST | `/api/auth/forgot-password` | `email` |
| POST | `/api/auth/reset-password` | `token`, `password`, `confirmPassword` |
| DELETE | `/api/auth/account` | Sesión; `password`, `confirmation: "ELIMINAR"` |

Rutas sensibles: 10 solicitudes por IP y ruta cada 15 minutos, por proceso. Detrás de un proxy se usa su dirección por defecto; configurar `trust proxy` solo con una cadena de proxies conocida y restringida. Para varios procesos usar un contador compartido.

## Correo y despliegue

El correo de recuperación usa SMTP con [Nodemailer](https://nodemailer.com/smtp/), separado de las notificaciones simuladas de pedidos. No se publican enlaces en las respuestas ni en logs. Configurar en el entorno del sitio de Alwaysdata:

```dotenv
PUBLIC_URL=https://<cuenta>.alwaysdata.net
SMTP_HOST=<servidor-del-proveedor>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM=<remitente-autorizado>
SMTP_USER=<usuario-smtp>
SMTP_PASSWORD=<credencial-smtp>
```

Con puerto 465 usar `SMTP_SECURE=true`; con 587 se exige STARTTLS. `PUBLIC_URL` debe ser la URL pública de confianza, HTTPS en producción. Las credenciales van en el panel del proveedor, fuera del repositorio. Si falta configuración, recuperación responde 503. Si falla la entrega se invalida el enlace generado y se registra un error sin datos personales; se mantiene la respuesta genérica. Verificar la entrega con una cuenta controlada tras configurar SMTP.

La migración `003-account-security.js` agrega campos a Users sin eliminar cuentas. El arranque y `npm run migrate` usan el mecanismo de respaldo previo existente. No ejecutar seeds sobre producción.

## Pruebas

`npm test`: suite existente más `tests/account.integration.test.js`, con permisos, validaciones, persistencia, credenciales antiguas, revocación de sesiones, enlaces vencidos/reemplazados, consumo concurrente único, eliminación, anonimización, aislamiento de pedidos y migración repetible sobre tabla existente. SQLite temporal y correo sustituido en pruebas: no se envían emails reales.

Verificación manual: editar perfil y recargar; cambiar contraseña e iniciar sesión; recuperar desde un correo controlado; cancelar eliminación y verificar sesión; confirmar eliminación y comprobar que ya no se puede iniciar sesión.
