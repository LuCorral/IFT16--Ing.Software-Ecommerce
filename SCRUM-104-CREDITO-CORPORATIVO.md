# SCRUM-104 — Asignar crédito corporativo a un usuario

Rama `feature/sprint3-credito-corporativo`, basada en `origin/main` (`2b76ff8`, PR #7 desplegado).

## Uso desde administración

1. Iniciar sesión como administrador y abrir **Gestión de usuarios**.
2. Buscar un usuario existente por nombre, apellido o email. La búsqueda se realiza en servidor y admite paginación.
3. En la fila del cliente, seleccionar **Crédito corporativo**.
4. Marcar **Beneficio corporativo activo** y seleccionar **Guardar condición**.
5. Ingresar un importe positivo y seleccionar **Asignar crédito**.
6. Ver la confirmación, el saldo actualizado y el movimiento con fecha, administrador, importe y saldo resultante. La fila del usuario también refleja su condición y saldo.

El beneficio es una condición adicional: el usuario conserva su rol `client`. Un administrador no puede recibir asignaciones a su propia cuenta de rol `admin`. Desactivar conserva el saldo y el historial, y bloquea nuevas asignaciones hasta reactivarlo.

Este incremento contiene únicamente SCRUM-104 y sus subtareas de saldo y movimientos, formulario administrativo y API protegida. SCRUM-92 es la épica de referencia. La consulta del cliente (SCRUM-108) y el canje (SCRUM-110) quedan fuera de este cambio. Ninguna pantalla de cliente permite gestionar estos valores.

## Operaciones protegidas

Todas requieren JWT válido y rol administrador comprobado contra la base de datos:

| Método | Ruta | Datos |
|---|---|---|
| GET | `/api/usuarios?search=texto&page=1&limit=10` | Búsqueda por nombre, apellido o correo |
| PUT | `/api/usuarios/:id/corporativo` | `{ "enabled": true }` o `false` |
| POST | `/api/usuarios/:id/credito-corporativo` | `{ "amount": "50000.25", "requestId": "UUID" }` |
| GET | `/api/usuarios/:id/movimientos-corporativos?page=1` | Historial paginado, 10 registros por página |

El saldo y la condición también se devuelven en el listado y detalle administrativos existentes. Los campos corporativos recibidos por registro o edición de perfil del cliente se ignoran; estas rutas no pueden modificarlos.

## Persistencia e integridad

- `Users.corporateEnabled`: booleano, inicialmente falso.
- `Users.corporateBalanceCents`: saldo entero en centavos, inicialmente cero.
- `CorporateMovements`: usuario, administrador, importe en centavos, saldo resultante, identificador de solicitud y fechas.
- Solo se aceptan importes positivos con hasta dos decimales. En JSON se usa punto decimal. Límite de importe y saldo: ARS 1.000.000.000.
- La suma y el movimiento se guardan en la misma transacción SQLite `IMMEDIATE`. Un fallo revierte ambos y las asignaciones simultáneas no pierden incrementos.
- Repetir un `requestId` con el mismo usuario, administrador e importe devuelve la asignación existente sin sumar otra vez. Reutilizarlo con otros datos devuelve 409. La interfaz conserva el identificador si hay un error de red para permitir reintentos seguros.
- El historial no tiene operaciones de edición ni eliminación. Si se elimina un usuario, la referencia se pone en nulo y se conserva el movimiento sin nombres ni emails.

La migración `004-corporate-credit.js` agrega los campos e historial sin eliminar cuentas. Usa el mecanismo existente de respaldo y migraciones al iniciar o ejecutar `npm run migrate`. No requiere dependencias nuevas ni cambios en SMTP.

## Verificación

`npm test` incluye `tests/corporate.integration.test.js`: permisos, intento de elevar rol mediante JWT, búsqueda, suma, validación de importes, idempotencia, concurrencia, reversión ante fallo, desactivación, protección de perfil y registro, migración repetible y baja de un usuario con movimientos.

También se verificó en navegador con base y usuarios temporales: login administrativo, búsqueda por email, activación, dos asignaciones acumuladas, historial, persistencia tras recargar, desactivación y formulario en escritorio y móvil. No se modifica la base desplegada durante las pruebas.
