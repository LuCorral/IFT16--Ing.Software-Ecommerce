# Verificación e implementación de las ocho HU

Base: `origin/main` de87de4. Rama: `feature/cuentas-credito-notificaciones-metricas`.
El árbol inicial estaba limpio; `main` estaba 22 commits detrás del remoto y se conservó sin modificar. El 14/11/2026 el usuario autorizó commit y push exclusivamente a esta rama. No se autorizaron merge a main ni despliegue. Las menciones de «sin commit/push» más abajo describen etapas anteriores a esta autorización.

## Reglas acordadas con el usuario

- SCRUM-110: selección opcional de crédito; aplicar el máximo disponible, limitado al total después de cupón. La diferencia se paga con tarjeta o transferencia simuladas. Un canje completo queda Pagado con comprobante no fiscal; no es cancelable desde esta opción.
- **Regla adicional acordada:** cancelar un pedido propio Pendiente reintegra todo el crédito utilizado y repone stock. Reintentos y concurrencia no duplican reintegros. No se habilita la cancelación de pagados. La desactivación del beneficio no impide devolver el crédito ya utilizado.
- SCRUM-121/125: solo correo SMTP mediante Nodemailer. Ethereal para demostración, sin entrega real. Recepción y aprobación incluyen número, fecha, productos, cantidades, total y estado. Cambios a Enviado, Entregado y Cancelado incluyen pedido y nuevo estado. Pago simulado identificado en pantalla y correo. Una edición administrativa a Pagado sin registro de aprobación no genera confirmación de pago.
- SCRUM-135: total de pedidos y desglose por estado; ventas y ticket promedio de Pagado, Enviado y Entregado con al menos un Pago Aprobado. Cada pedido se cuenta una vez por su total, también en mixtos. Pendientes y Cancelados se incluyen en total/desglose y se excluyen de ventas.
- **Decisión adicional acordada:** stock bajo = 1 a 5 unidades; sin stock = 0. Ambos cuentan productos actuales y no dependen del período.
- Período: mes calendario en `America/Argentina/Buenos_Aires`, usando **fecha de creación `createdAt`**. Inicio inclusivo, inicio del mes siguiente exclusivo. Mes/año actual por defecto. La API acepta años 2000 a 2100.

## Evidencia y estado

No se consideran criterios oficiales adicionales a los proporcionados por el usuario. La validación visual automática quedó bloqueada; el usuario reportó una comprobación manual puntual del canje completo, detallada a continuación. Las demás comprobaciones manuales no se dan por realizadas.

### Comprobaciones manuales reportadas por el usuario

| Caso | Evidencia reportada en el chat | Estado |
|---|---|---|
| Canje completo, pedido #7 | La confirmación mostraba Pagado, crédito aplicado $27.990 y diferencia $0 | Comprobado manualmente ese resultado de confirmación; no equivale a validar toda SCRUM-110 |
| Recepción del pedido #7 | El aviso del correo mostraba Estado: Pendiente, inconsistente con la compra | Fallo reportado y reproducido; corregido con pruebas automáticas. Revalidación manual de una nueva recepción pendiente |

No se reportó confirmación manual del saldo posterior, restitución de stock, historial, comprobante, canje mixto, pago de diferencia, edición de perfil, baja, aislamiento entre cuentas, asignación administrativa, métricas ni uso del teclado/móvil. Los pedidos de rediseño y mejoras de navegación no se interpretan como aceptación de esos flujos.

### Comprobaciones realizadas por el agente y pendientes

- Automatizadas: permisos, validaciones, canjes completos/mixtos, rechazo, concurrencia, reversión y reintentos; generación de recepción con estado final y ausencia de correos duplicados. La suite final se vuelve a ejecutar antes del commit.
- Por API en la demo aislada: salud, login, saldo inicial, catálogo de 28 productos, 8 categorías y 28 imágenes accesibles; métricas de referencia e inventario filtrado. Son comprobaciones técnicas, no validaciones visuales del usuario.
- SMTP: seis capturas Ethereal verificadas sin entrega real, antes de la corrección de recepción. El nuevo contenido Pagado/Pendiente está cubierto por regresión automatizada; su nueva captura y su aviso en navegador siguen pendientes de revisión manual.
- Pendientes: revalidar recepción del canje completo; mixto y aprobación de diferencia; verificar en navegador perfil, baja, saldo, asignación, restituciones y permisos. Revisar dashboard en escritorio/móvil, filtros de período, carga/error/vacío, teclado y navegación/edición desde inventario.

| HU | Estado | Evidencia en implementación y pruebas | Pendiente |
|---|---|---|---|
| SCRUM-14 | Parcial | `accountController.js`, `account.js`, `account.integration.test.js`: credenciales, baja, anonimización, sesión revocada. `redemption.integration.test.js`: baja propia conserva canje y movimiento anonimizado | Verificación visual |
| SCRUM-10 | Parcial | `accountController.js`, `account.js`, `account.integration.test.js`: campos permitidos, validación, persistencia, propiedad histórica de pedidos | Verificación visual |
| SCRUM-104 | Parcial | `corporateController.js`, `corporate-admin.js`, `corporate.integration.test.js`: permisos contra DB, importes, reintentos, concurrencia, rollback | Verificación visual |
| SCRUM-108 | Parcial | `/api/auth/corporate-balance`, `account.js`, `corporate.integration.test.js`: saldo propio, ARS, condición y aislamiento | Verificación visual |
| SCRUM-110 | Parcial | `pedidoController.js`, `Pedido.js`, `orderReceipt.js`, `main.js`, `cart.html`, `redemption.integration.test.js`: canje total/mixto, concurrencia, stock, idempotencia, cancelación, fallo y anonimización. Confirmación de canje completo reportada manualmente para #7 | Validar manualmente el resto del flujo y revalidar la recepción corregida |
| SCRUM-121 | Parcial | `notificacionesCorreo.js`, `accountMail.js`, `mailController.js`, `admin-insights.js`, pruebas mail-delivery y notificaciones: commit, detalle, simulación, fallo y recuperación; SMTP Ethereal verificado | Verificación visual |
| SCRUM-125 | Parcial | Mismos archivos; cambios reales a Enviado/Entregado/Cancelado, sin correo por operación rechazada o estado repetido; SMTP Ethereal verificado | Verificación visual |
| SCRUM-135 | Parcial | `metricsController.js`, `admin-insights.js`, `metrics.integration.test.js`: permisos, límites argentinos, aprobaciones, mixtos, vacíos, stock actual | Verificación visual |

## Integridad y recuperación

- Se reutilizan `corporateBalanceCents` y `CorporateMovements`. Débitos negativos con clave `redeem:<pedidoId>` y reintegros positivos `refund:<pedidoId>`. Referencias a cuentas eliminadas se conservan en nulo.
- Checkout usa transacción SQLite IMMEDIATE para saldo, stock, pedido, detalles, cupón y movimiento. `requestId` UUID persistido y huella de usuario/carrito/cupón/elección de crédito: mismo contenido devuelve el pedido; contenido o usuario distintos devuelve 409.
- La interfaz conserva la clave de checkout tras error de red y la elimina al confirmar éxito. Los pagos aprobados se consultan antes de crear otro cobro. Un reintento de pago aprobado devuelve el resultado existente. El monto de Pago es solo la diferencia; el comprobante conserva el total y muestra ambas partes.
- Para pedidos con crédito se bloquean ediciones administrativas que eludan el pago o reintegro, y la eliminación física del pedido. Se permite avance Pagado → Enviado → Entregado. No se reescribió el CRUD heredado para pedidos sin crédito.
- El evento de correo se persiste con la operación. SMTP se invoca después del commit. Un fallo SMTP no revierte compra, pago ni estado. Cada fila se reclama mediante actualización condicional antes de enviar; un reintento simultáneo no vuelve a enviar una fila ya reclamada.
- Estados: `en_cola`, `enviando`, `fallo`, `incierto`, `demo`, `enviado`, `legado`. Fallos confirmados y en cola pueden reintentarse desde administración. Desconexiones/timeouts quedan inciertos y no se reenvían automáticamente. Un proceso interrumpido durante envío puede quedar `enviando`: requiere cotejo con el proveedor y reparación operativa tras confirmar el resultado. No se promete entrega exactamente una vez con SMTP.
- `enviado` significa aceptado por SMTP, no lectura ni llegada garantizada a bandeja. `demo` significa capturado en Ethereal sin entrega real. `legado` conserva simulaciones anteriores sin reenviarlas.
- La casilla `ORDER_MAIL_TO` redirige solo el envío de pedidos; no cambia el email de la cuenta. La vista administrativa muestra el propietario y la captura Ethereal. Los enlaces de captura solo se ofrecen a administradores.

## Migraciones y configuración

- `005-order-credit.js`: columnas aditivas de importe de crédito, clave y huella de checkout. Pedidos anteriores quedan con crédito cero.
- `006-mail-delivery.js`: columnas de entrega, intentos, error y captura. Correos anteriores quedan `legado`, nunca enviados en masa. Ambas son repetibles y preservan filas; el mecanismo existente crea respaldo antes de migrar una base existente.
- No se ejecutaron migraciones ni semillas contra bases reales. No cambiaron dependencias del repositorio; se instaló Nodemailer ya declarado.
- Configuración y pruebas manuales en README. El script opcional `verify-ethereal-demo.js --ethereal` crea cuenta Ethereal y datos temporales, verifica seis capturas y limpia su base; no imprime credenciales. No forma parte de `npm test`.

## Verificación

- Suite automatizada con SQLite temporal; el transporte SMTP se sustituye en pruebas de entrega y se desconfigura en las demás. No se entregan correos reales ni se toca la base del proyecto.
- Nuevas pruebas de canje, entrega y métricas se ejecutaron primero y fallaron por comportamiento ausente; luego pasaron. Se agregó regresión para desconexión SMTP después de DATA, identificada por revisión independiente.
- La prueba de migraciones crea tablas anteriores y confirma preservación, repetibilidad, crédito cero y estado legado. La suite heredada de despliegue prepara datos demo exclusivamente en su base temporal.
- Suite final antes del commit, ejecutada el 14/11/2026 con **Node 22.23.5**: **50 pruebas, 50 pasan, 0 fallos**, salida 0. Incluye reversión integral ante fallo de reintegro y regresión de recepción. Node se ejecutó desde su caché temporal sin modificar package.json ni la versión global.
- `node scripts/verify-ethereal-demo.js --ethereal`: salida 0, **seis capturas SMTP Ethereal verificadas**, sin entrega real. Se verificó recepción de dos pedidos, aprobación simulada, envío, entrega y cancelación; cada fila quedó `demo` con enlace de captura. No se publican enlaces privados de capturas ni credenciales temporales en el repositorio.
- `node --check` de las interfaces/controlador modificados y `git diff --check`: sin errores. Git puede avisar conversión LF a CRLF según su configuración local; no es un error de contenido.
- Revisión independiente estática realizada: detectó desconexión SMTP ambigua; se reprodujo con prueba que falló y se corrigió. Sin otros hallazgos importantes informados.
- Navegador: la integración informó primero `The browser access host is unavailable`; al intentar Edge nativo, Computer Use se detuvo porque no pudo determinar con confianza la URL. No se automatizó esa ventana ni se declara verificada la apariencia.

## Entorno para validación manual del usuario

Corrección de recepción de canjes: el evento se genera después de guardar el estado final, diferenciando el tipo recepción de su estado. Canje completo recibe correo Recibimos tu pedido con Estado: Pagado y confirmación de aprobación; mixto recibe Pendiente y luego su confirmación Pagado al aprobar la diferencia. Se conserva el envío después del commit. Pruebas concurrentes verifican un solo correo por evento, con rechazo sin aprobación ni correo adicional. **50 pruebas pasan en Node 22.23.5**. Presentación: Mis pedidos ya no muestra aviso de simulación ni casilla de rechazo; conserva método, pagar, cancelar, crédito y diferencia. El pago académico y la cobertura de rechazos siguen vigentes. Las capturas históricas ya emitidas no se modifican ni reenvían.

Mejora complementaria de navegación de SCRUM-135: tarjetas de inventario convertidas en botones accesibles con foco visible y texto Ver productos. Reutilizan Gestión de productos, con banner del filtro y opción de quitarlo, listado/edición/paginación existentes, carga y mensaje vacío. Nueva ruta administrativa `/api/productos/inventario?stockFilter=low|empty`, stock actualizado desde base, independiente de mes/año y de vigencia comercial. Edición recarga primera página para reevaluar pertenencia al filtro. Las respuestas anteriores de cargas superpuestas no reemplazan un filtro nuevo. No se modificaron cálculos de métricas.

Verificación de esta mejora: **48 pruebas pasan con Node 22.23.5**. Prueba nueva falló primero por ruta inexistente y luego pasó; cubre administrador/cliente/anónimo, filtro inválido, límites 1 y 5, stock 0, paginación, producto vencido, filtros combinados y actualización de stock. Sintaxis del JS externo y scripts inline del panel comprobada. En demo: stock bajo devuelve aspiradora 3 y TV 5; sin stock devuelve tablet 0; métricas noviembre conservan ventas $167.940, 5 pedidos y ticket $55.980.

Demo reanudada en **http://127.0.0.1:49301**, misma base temporal, sin seeds ni migraciones. Usuarios y contraseñas conservados. El servidor anterior se detuvo tras verificar el nuevo. Nuevos JWT de sesión requieren volver a ingresar; nueva cuenta SMTP temporal Ethereal, manteniendo modo demo y redirección a casilla de captura, sin entrega real ni cambios de `.env`. Las capturas anteriores se conservan en la base. Validación visual pendiente del usuario; sin commit, push ni despliegue.

Rediseño visual de Métricas: tarjetas de ventas, pedidos, ticket y aprobados; gráfico HTML/CSS con cinco estados, cantidades y eje entero desde cero; inventario ámbar/rojo, filtros mes/año, período en español, detalles de cálculo desplegables y nota de pagos simulados. Incluye carga, error con reintento y período sin datos. CSS aislado en `metrics-dashboard.css`; no se modificó el endpoint ni reglas/permisos. Valores de referencia de noviembre, octubre y diciembre comprobados por API después del rediseño; las cuatro pruebas de metrics.integration.test.js pasan. Validación visual de escritorio/móvil sigue pendiente del usuario. Recargar el panel y abrir Métricas; probar diciembre para ver el estado vacío, modo sin conexión del navegador para error/reintento y conexión lenta para carga.

Se agregó `scripts/start-manual-demo.cjs`: crea una carpeta temporal nueva, fija SQLite exclusivamente allí antes de cargar la aplicación, genera contraseñas y JWT aleatorios, obtiene una cuenta Ethereal y mantiene el servidor en loopback con puerto libre. No modifica `.env`; ejecuta el seed original únicamente con destino explícito a esa base nueva. No guarda credenciales en archivos. La base temporal se conserva al detener el proceso para poder inspeccionar los resultados.

Demo preparada el 14/11/2026 con Node 22.23.5; salud, login y métricas comprobados por API. Estado visual: **pendiente de resultados del usuario**. No se hizo commit, push ni despliegue.

Catálogo actualizado a pedido del usuario: se ejecutó `seed_DB.js` **sin modificarlo**, dirigido explícitamente a la base temporal `ecommerce-manual-4GsIgs/demo.sqlite`. Se quitaron los cuatro productos artificiales; las categorías se derivan del catálogo y ya no incluyen Demostración. Quedaron 28 productos y 8 categorías originales con sus imágenes. Se conservaron usuarios, contraseñas y el proceso servidor con su configuración Ethereal en memoria.

Datos de referencia actualizados, comprobados por API antes de compras manuales: noviembre 2026 = 5 pedidos (uno por estado), 3 ventas, **$167.940** vendidos y ticket promedio **$55.980**; octubre = 1 venta de **$251.910**; diciembre = sin pedidos. Los seis pedidos precargados ahora usan el aro de luz original ($27.990), cantidades 1, 2, 3, 4, 5 y 9 respectivamente, con importes y pagos de referencia actualizados. No consumen stock: son fixtures históricos para métricas, sin correos ni comprobantes. Validar esos flujos con pedidos nuevos.

Ajustes exclusivamente en la base temporal: aspiradora robot Wi-Fi stock 8 → 3, Smart TV 43' stock 7 → 5 y tablet Lenovo stock 14 → 0. Resultado: **2 productos con stock bajo y 1 sin stock**, independiente del mes. El resto conserva el stock del seed; aro de luz = 36 unidades. Todos los clientes empiezan sin beneficio y con saldo cero.

Secuencia de crédito sugerida: asignar **$70.000**; canjear un aro de luz por **$27.990** → Pagado y saldo **$42.010**; crear pedido de dos aros → total **$55.980**, crédito **$42.010**, diferencia **$13.970** y Pendiente; cancelar → saldo **$42.010**, se restituyen dos unidades (stock vuelve a 35 tras la primera compra). Crear otro mixto igual y aprobar pago simulado de **$13.970** → Pagado, saldo cero. Usar ese pedido para envío y entrega. Revisar correos en administración. Las nuevas operaciones alterarán las métricas de noviembre respecto de la referencia inicial.
