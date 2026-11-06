# BRIEF MAESTRO — PLATAFORMA DE SOLUCIONES DIGITALES PARA RESTAURANTES

> **Documento de dirección de producto, arquitectura y forma de trabajo**  
> **Uso:** entregar este archivo a Gemini y utilizarlo como contexto principal de trabajo en Antigravity.  
> **Estado:** visión inicial; las decisiones técnicas y funcionales deben analizarse, cuestionarse y especificarse antes de implementarse.  
> **Idioma de trabajo:** español. Los nombres técnicos, identificadores y convenciones de código pueden permanecer en inglés.

---

## 1. Propósito de este documento

Este documento establece el contexto del negocio, la intención del producto, las preferencias tecnológicas, los estándares de calidad y la metodología de ingeniería que se espera utilizar para construir una plataforma de soluciones digitales para restaurantes.

No es un plan de fases ni una lista rígida de tareas. **No debes convertirlo automáticamente en un roadmap cerrado ni empezar a programar sin entender y validar el problema.** Su función es encaminar el razonamiento, la planificación y las decisiones que se tomarán junto con Antigravity.

Se espera que Gemini actúe como socio de pensamiento técnico y de producto: analice, investigue cuando sea necesario, cuestione supuestos, identifique riesgos, compare alternativas y ayude a producir planes, especificaciones, pruebas y revisiones de calidad.

La implementación se realizará principalmente con **Antigravity**, aprovechando sus capacidades de planificación, agentes, subagentes, skills, terminal, navegador y revisión del trabajo, según estén disponibles en el entorno.

---

## 2. Contexto del negocio

La oportunidad nace de observar restaurantes independientes y establecimientos gastronómicos que tienen una presencia digital fragmentada o que no aprovechan canales propios para presentar y comercializar sus productos y servicios.

En muchos casos, el restaurante puede tener Instagram, Facebook o WhatsApp, pero eso no necesariamente significa que tenga un sistema digital organizado para:

- Presentar su menú de forma clara, atractiva y fácil de consultar.
- Actualizar precios, productos, fotografías y disponibilidad sin depender de editar imágenes o documentos manualmente.
- Mostrar servicios que van más allá de vender platos: cumpleaños, celebraciones, reuniones familiares, eventos empresariales y encuentros privados.
- Explicar paquetes, capacidades, extras y condiciones de eventos.
- Recibir solicitudes de información, cotizaciones o reservas con datos suficientes para darles seguimiento.
- Centralizar su información comercial en un canal propio, accesible desde un QR o enlace.
- Entender, con métricas honestas, qué contenido y productos generan interés.

La intención no es vender páginas web genéricas ni presentarse como una agencia de marketing. La propuesta es ofrecer **productos tecnológicos comerciales que ayuden a los restaurantes a presentar mejor su oferta, organizar información y facilitar oportunidades de venta y contacto**.

El enfoque comercial debe ser consultivo: observar el negocio, conversar con el propietario, identificar una necesidad real y demostrar una solución funcional que pueda adaptarse a su operación.

### Principios comerciales

1. Vender resultados operativos y comerciales plausibles, no tecnología por tecnología.
2. Mostrar antes que prometer: disponer de demostraciones funcionales reduce la abstracción de la venta.
3. No asumir que todos los restaurantes necesitan todos los módulos.
4. Recomendar la solución más urgente y relevante para cada negocio.
5. No prometer aumentos de ventas ni resultados económicos sin evidencia.
6. Distinguir claramente entre una demostración, una funcionalidad disponible y una integración que todavía requiere desarrollo.
7. Cobrar de forma transparente la configuración, personalización, implementación, soporte y mantenimiento que correspondan.
8. Diseñar una base de producto reutilizable para varios clientes, evitando reconstruir cada solución desde cero.

---

## 3. Visión del producto

Construir una plataforma modular y configurable para ofrecer a restaurantes soluciones digitales que puedan implementarse y adaptarse a su identidad y operación.

La visión contempla tres grandes capacidades. No se presupone que todas deban desarrollarse simultáneamente ni que cada cliente deba contratarlas todas.

### 3.1 Menú digital inteligente

Un menú público, responsive y administrable desde un dashboard privado.

La experiencia pública debe permitir que un cliente consulte el menú desde un enlace o código QR, encuentre categorías y productos con facilidad y entienda claramente precios, descripciones, opciones y disponibilidad.

El restaurante debe poder administrar el contenido sin solicitar cambios al desarrollador.

Capacidades candidatas:

- Categorías y subcategorías.
- Productos con nombre, descripción, precio, fotografía y estado de disponibilidad.
- Productos destacados, nuevos o en promoción.
- Variantes, tamaños, adicionales y complementos, si el modelo operativo del restaurante lo necesita.
- Etiquetas como vegetariano, picante, recomendado o similar, cuando aporten valor.
- Orden configurable de categorías y productos.
- Activar, desactivar, archivar y reordenar elementos.
- Horarios o disponibilidad diferenciada, si se justifica.
- Identidad visual configurable por restaurante.
- Enlace público y experiencia preparada para QR.
- Vistas adaptadas a móviles, tablets y escritorio.
- Posibilidad de manejar distintas sedes y, cuando sea necesario, menús o precios distintos por sede.
- Estados vacíos, errores, carga y contenido no disponible tratados con cuidado.

**Importante:** un menú digital no equivale automáticamente a un sistema de pedidos, pagos o domicilios. Esas capacidades deben considerarse módulos independientes, con sus propios requisitos operativos y de integración. No simular que un pedido se ha confirmado si solo se ha enviado una solicitud por WhatsApp.

### 3.2 Sistema comercial de eventos y celebraciones

Una experiencia para que el restaurante presente y comercialice los eventos que puede atender.

Tipos de eventos posibles:

- Cumpleaños infantiles.
- Cumpleaños de adultos.
- Celebraciones familiares.
- Aniversarios y ocasiones especiales.
- Reuniones empresariales.
- Reuniones privadas y encuentros de grupos.
- Otras categorías definidas por cada establecimiento.

Capacidades candidatas:

- Página o sección de eventos.
- Categorías de eventos.
- Descripción de espacios y capacidades.
- Paquetes configurables.
- Precio por persona, precio base o cotización personalizada, según el modelo del restaurante.
- Número mínimo o máximo de asistentes.
- Servicios incluidos y adicionales.
- Fotografías del espacio y montajes.
- Condiciones, horarios y restricciones.
- Formulario de solicitud con fecha tentativa, número de asistentes, tipo de evento y datos de contacto.
- Envío de la solicitud al canal definido por el restaurante, por ejemplo WhatsApp o correo.
- Registro de solicitudes en un dashboard, si se define como parte del producto.
- Estados de seguimiento: recibido, contactado, cotizado, confirmado, rechazado o cerrado, según las necesidades reales.
- Mensajes de confirmación que expliquen que se trata de una solicitud y no de una reserva confirmada, salvo que exista disponibilidad y confirmación transaccional real.

No asumir disponibilidad automática, calendarios sincronizados, pagos de anticipos o reservas confirmadas sin diseñar y construir explícitamente esas capacidades.

### 3.3 Página comercial del restaurante

Un canal propio para presentar el establecimiento y conectar sus principales puntos de conversión.

Capacidades candidatas:

- Presentación del restaurante y propuesta gastronómica.
- Galería de fotografías.
- Ubicación, horarios y datos de contacto.
- Menú.
- Eventos y celebraciones.
- Botones de contacto y canales externos.
- Información sobre espacios, servicios y experiencias.
- SEO técnico y metadatos.
- Diseño responsive y rendimiento optimizado.

La página comercial debe poder funcionar como una capa de presentación que conecte los módulos disponibles, no necesariamente como un sitio independiente y aislado.

---

## 4. Estrategia de producto: demostraciones reutilizables

Una prioridad del proyecto es disponer de productos demostrativos funcionales que puedan presentarse desde un portátil o compartirse mediante un enlace.

La demostración debe mostrar una experiencia creíble, completa en su alcance y suficientemente pulida para que un propietario entienda el valor de la solución.

### Requisitos de las demos

- Utilizar una marca ficticia claramente identificada como demostración.
- No hacerse pasar por un restaurante real ni sugerir que existe una relación comercial inexistente.
- No copiar marcas, logotipos, fotografías, textos, diseños protegidos ni activos de restaurantes reales.
- Se pueden utilizar datos, nombres, fotografías y contenido ficticios o debidamente licenciados.
- Debe ser sencillo adaptar la demo a otro restaurante.
- El contenido debe parecer gastronómicamente plausible y estar bien redactado.
- No llenar la interfaz de funcionalidades falsas que no existan.
- Diferenciar visualmente las acciones funcionales de las que sean únicamente ilustrativas.
- La demo debe mostrar tanto la experiencia pública como, cuando sea relevante, el dashboard administrativo.
- No utilizar información personal real en datos de prueba.

### Enfoque de reutilización

La arquitectura debe permitir que una misma base de producto se configure para diferentes restaurantes mediante datos e identidad visual, en vez de crear un proyecto de código separado para cada cliente.

Se deben analizar desde el inicio:

- Identidad visual por restaurante.
- Configuración por sede.
- Datos aislados por organización.
- Roles y permisos.
- Dominios o subdominios personalizados, si se requieren.
- Activación de módulos por cliente.
- Diferencias de configuración sin introducir bifurcaciones innecesarias de código.

---

## 5. Stack tecnológico preferido

El stack preferido es el siguiente. Es una preferencia inicial fundamentada en experiencia previa, no una prohibición de evaluar alternativas. Cualquier cambio debe justificarse por una ventaja concreta y no por moda o complejidad innecesaria.

| Capa | Preferencia |
|---|---|
| Framework | Next.js, App Router |
| Lenguaje | TypeScript |
| UI | React |
| Estilos | Tailwind CSS |
| Componentes | shadcn/ui, adaptados y refinados |
| Base de datos | Supabase PostgreSQL |
| Autenticación | Supabase Auth |
| Archivos e imágenes | Supabase Storage |
| Seguridad de datos | PostgreSQL Row Level Security (RLS) |
| Validación | Zod |
| Formularios | React Hook Form cuando aporte valor |
| Iconos | Lucide |
| Animación | Framer Motion, con moderación |
| Despliegue | Vercel |
| Control de versiones | Git y GitHub |
| Diseño y exploración visual | Figma cuando resulte útil |

### Reglas del stack

- Preferir soluciones compatibles con el ecosistema existente.
- Mantener dependencias justificadas y actualizadas.
- Evitar instalar librerías para resolver problemas que el stack ya cubre.
- Evitar abstracciones prematuras y arquitecturas innecesariamente complejas.
- Usar Server Components por defecto cuando corresponda y Client Components solo cuando exista una necesidad de interacción en cliente.
- Separar responsabilidades de UI, lógica de negocio, acceso a datos y validación.
- Evitar que componentes visuales contengan consultas de base de datos o lógica de negocio compleja.
- Mantener tipos consistentes entre formularios, dominio y persistencia.
- No exponer secretos, claves `service_role` ni credenciales privadas en el navegador.
- No asumir que ocultar una ruta o botón es una medida de autorización.

---

## 6. Estrategia de datos e infraestructura

### 6.1 Supabase como backend principal

La recomendación inicial es utilizar Supabase Free durante el desarrollo, la experimentación y la validación de las primeras demostraciones, siempre respetando sus límites y condiciones.

No se debe asumir que el plan gratuito es adecuado para producción crítica. Antes de poner un cliente en producción, evaluar:

- Riesgo de pausa por inactividad.
- Backups y recuperación.
- Límites de base de datos, almacenamiento y transferencia.
- Necesidades de soporte y disponibilidad.
- Volumen esperado de imágenes y tráfico.
- Costes de cómputo y proyectos adicionales.
- Estrategia de migración y continuidad.

El plan Pro puede ser apropiado cuando exista un cliente o una operación productiva que justifique sus beneficios. La decisión debe basarse en requisitos reales, no anticipar gastos innecesarios.

### 6.2 Una plataforma multi-tenant

La dirección preferida es una aplicación multi-tenant: una instancia de aplicación y una base de datos compartida por múltiples restaurantes, con aislamiento estricto de datos.

**No crear una base de datos independiente por restaurante como estrategia predeterminada.** Cada negocio debe representarse como una organización o tenant dentro del modelo de datos.

Conceptos de dominio que se deben evaluar:

- `restaurants` u `organizations`: restaurantes/organizaciones clientes.
- `restaurant_members`: relación entre usuarios y restaurantes, con roles.
- `locations`: sedes o sucursales.
- `menus`: menús y configuraciones.
- `categories`: categorías.
- `products`: productos.
- `product_variants`: variantes, tamaños y opciones, si se necesitan.
- `product_availability`: disponibilidad, cuando no baste un campo simple.
- `event_types`: tipos de eventos.
- `event_packages`: paquetes comerciales.
- `event_inquiries`: solicitudes de información o cotización.
- `media_assets`: metadatos de archivos cuando sea necesario.
- `audit_logs`: historial de cambios en operaciones sensibles, si se justifica.

Esta lista es orientativa, no un esquema que deba implementarse sin análisis. El modelo debe evitar tablas y relaciones innecesarias. Se debe definir con claridad qué entidades pertenecen a un restaurante y cuáles pueden variar por sede.

### 6.3 Aislamiento y seguridad

El aislamiento multi-tenant es un requisito central, no una mejora futura.

- Diseñar políticas RLS para todas las tablas con información privada o modificable.
- Cada registro de negocio debe tener una relación inequívoca con su restaurante/tenant.
- Los permisos deben validarse en el servidor y en la base de datos.
- Definir roles explícitos, por ejemplo propietario, administrador y editor, solo si el alcance lo requiere.
- Evitar confiar en un `restaurant_id` enviado libremente por el cliente sin comprobar membresía y autorización.
- Aplicar restricciones de integridad, claves foráneas e índices adecuados.
- Probar accesos cruzados entre tenants: un usuario del restaurante A nunca debe poder leer ni modificar datos del restaurante B.
- Revisar políticas de Storage: las imágenes privadas y públicas deben tener reglas apropiadas.
- La clave `service_role` solo puede utilizarse en entornos seguros de servidor y nunca exponerse al cliente.
- Documentar cómo se crean los primeros usuarios, propietarios y organizaciones sin dejar rutas de administración abiertas.

### 6.4 Google Sheets

Google Sheets puede utilizarse como herramienta auxiliar para:

- Importación inicial de productos.
- Exportación de información.
- Reportes sencillos.
- Cargas masivas o plantillas operativas.
- Integraciones puntuales.

No utilizarlo como base de datos principal del producto ni como sustituto de autenticación, autorización o almacenamiento relacional.

### 6.5 Imágenes y archivos

Evaluar Supabase Storage como solución inicial. Definir:

- Convenciones de nombres y rutas.
- Relación entre archivos y restaurante.
- Validación de tipo y tamaño.
- Compresión y dimensiones apropiadas.
- Formatos modernos cuando sean compatibles.
- Eliminación y sustitución de imágenes.
- Políticas de acceso y lectura.
- Tratamiento de imágenes faltantes y errores de carga.

No subir imágenes originales enormes sin optimización ni permitir archivos arbitrarios sin validación.

---

## 7. Dirección visual y experiencia de usuario

La calidad visual es un requisito del producto. La interfaz debe sentirse contemporánea, cuidada y comercialmente convincente. No debe parecer un dashboard genérico ensamblado con componentes predeterminados.

### Dirección estética

Buscar una combinación de:

- Diseño moderno y editorial.
- Jerarquía tipográfica clara.
- Fotografía gastronómica protagonista y de calidad.
- Espacios en blanco bien utilizados.
- Composición equilibrada.
- Contraste y legibilidad.
- Sistemas de color coherentes.
- Microinteracciones discretas.
- Transiciones fluidas, sin animación excesiva.
- Componentes consistentes y estados bien diseñados.

La estética debe servir al negocio y al contenido. Evitar interfaces recargadas, gradientes decorativos sin propósito, sombras excesivas, tarjetas repetidas sin jerarquía, efectos de vidrio indiscriminados y patrones visuales genéricos de plantillas SaaS.

### Dos experiencias distintas

**Experiencia pública del restaurante**

- Debe priorizar comida, fotografía, navegación y claridad comercial.
- Debe ser rápida, intuitiva y mobile-first.
- El usuario debe encontrar categorías y productos sin esfuerzo.
- Los precios, opciones y condiciones deben ser legibles.
- Las acciones principales deben ser evidentes.
- El QR debe abrir una experiencia útil, no una pantalla de bienvenida innecesaria.

**Dashboard administrativo**

- Debe priorizar productividad, claridad y confianza.
- Debe permitir administrar productos y categorías sin conocimientos técnicos.
- Debe reducir errores al editar precios, disponibilidad e imágenes.
- Debe ofrecer confirmaciones para acciones destructivas.
- Debe mostrar estados de carga, éxito, error y vacío.
- Debe funcionar en escritorio y ser usable en dispositivos móviles.
- Debe incluir búsqueda, filtros y ordenamiento cuando el volumen de datos lo justifique.

### Accesibilidad y responsive

- Diseñar primero para móvil en la experiencia pública.
- Comprobar tablet y escritorio.
- Mantener contraste suficiente.
- Usar etiquetas y nombres accesibles.
- No depender solo del color para comunicar estados.
- Asegurar navegación por teclado en controles relevantes.
- Respetar `prefers-reduced-motion`.
- Utilizar HTML semántico y componentes accesibles.

### Calidad visual

No aceptar como terminado un diseño únicamente porque compila. Revisar capturas reales en navegador, tamaños de pantalla, contenido largo, estados vacíos, errores, imágenes y comportamiento de interacción. Usar las herramientas visuales disponibles en Antigravity.

---

## 8. Estándares de ingeniería

### Código

- TypeScript estricto.
- Evitar `any`; cuando sea inevitable, documentar el motivo y limitar su alcance.
- Funciones pequeñas y con responsabilidades claras.
- Componentes reutilizables cuando exista repetición real.
- Nombres expresivos y consistentes.
- Separar tipos de dominio de tipos específicos de UI cuando sea útil.
- Validar datos en límites de confianza.
- Manejar errores explícitamente.
- Evitar duplicación de lógica.
- Evitar archivos gigantes y componentes monolíticos.
- No crear capas de abstracción que no resuelvan una necesidad concreta.

### Arquitectura

- Mantener límites claros entre presentación, dominio y persistencia.
- Centralizar operaciones de acceso a datos.
- Evitar consultas duplicadas y patrones N+1.
- Diseñar índices a partir de consultas reales.
- Usar paginación cuando los listados puedan crecer.
- Considerar caché y revalidación de Next.js de forma consciente, especialmente para contenido público que debe reflejar cambios administrativos.
- No cachear datos privados de forma que puedan filtrarse entre usuarios o restaurantes.
- Documentar decisiones arquitectónicas relevantes mediante ADRs breves cuando convenga.

### Rendimiento

- Optimizar imágenes.
- Evitar JavaScript innecesario en el cliente.
- Cuidar Core Web Vitals.
- Evitar saltos de diseño.
- Cargar recursos de forma eficiente.
- Usar fuentes con criterio.
- No sacrificar accesibilidad ni legibilidad por métricas.
- Medir antes de optimizar prematuramente.

### Calidad y mantenibilidad

- ESLint y formato consistente.
- Comprobación de tipos.
- Tests unitarios para lógica importante.
- Tests de integración para operaciones de datos y permisos.
- Tests end-to-end para recorridos críticos.
- Migraciones versionadas.
- Variables de entorno documentadas.
- README útil para instalación, desarrollo y despliegue.
- No dejar código muerto, mocks accidentales ni `TODO` críticos sin registrar.

---

## 9. Forma de trabajo esperada con Gemini y Antigravity

Esta sección define el método de colaboración. **No impone una secuencia fija de fases.** El equipo debe elegir el proceso adecuado para cada problema, manteniendo trazabilidad entre lo que se decide, se especifica, se construye y se verifica.

### 9.1 Antes de implementar

- Comprender el problema y el contexto.
- Identificar qué se sabe, qué se supone y qué falta validar.
- Hacer preguntas cuando una decisión cambie significativamente el alcance o la arquitectura.
- Investigar documentación oficial para decisiones sensibles o dependientes de versiones.
- Comparar alternativas cuando exista una duda técnica real.
- Explicar ventajas, desventajas, riesgos y coste de mantenimiento.
- Proponer una solución proporcionada al estado del producto.
- No sobreingenierizar un MVP, pero tampoco ignorar requisitos estructurales como el aislamiento de datos.

### 9.2 Planes y especificaciones

Para cambios significativos, producir primero un plan de trabajo y una especificación suficientemente concreta.

Según el problema, la especificación puede incluir:

- Objetivo y problema que resuelve.
- Alcance y fuera de alcance.
- Usuarios y permisos.
- Flujos principales y alternativos.
- Reglas de negocio.
- Modelo de datos y migraciones.
- Estados de interfaz.
- Validaciones.
- Manejo de errores.
- Seguridad y autorización.
- Requisitos responsive y accesibilidad.
- Criterios de aceptación verificables.
- Riesgos y dependencias.
- Estrategia de pruebas.

No convertir cada ajuste pequeño en documentación excesiva. Aplicar el nivel de rigor proporcional al impacto y al riesgo.

### 9.3 Agentes y subagentes

Aprovechar subagentes y skills disponibles cuando aporten valor real. Se pueden distribuir tareas como:

- Análisis de producto y requisitos.
- Arquitectura y modelo de datos.
- Implementación de UI.
- Backend y operaciones de datos.
- Seguridad y revisión de RLS.
- Pruebas y control de calidad.
- Revisión visual y responsive.
- Auditoría de rendimiento y accesibilidad.

Las tareas delegadas deben tener contexto, archivos relevantes, límites, entregables y criterios de aceptación. Evitar que varios agentes modifiquen simultáneamente los mismos archivos o que implementen soluciones incompatibles.

El agente principal debe integrar y revisar el trabajo. La delegación no reemplaza la verificación.

### 9.4 Loops de implementación y revisión

Trabajar mediante ciclos controlados:

1. Entender el cambio.
2. Definir alcance y criterios de aceptación.
3. Planificar.
4. Implementar una unidad coherente.
5. Ejecutar verificaciones.
6. Revisar el resultado en navegador cuando corresponda.
7. Corregir defectos.
8. Volver a probar.
9. Resumir qué cambió y qué queda pendiente.

No dar por terminado un trabajo porque el agente afirma haberlo completado. La finalización depende de evidencia: tests, comprobaciones, revisión visual y comportamiento real.

### 9.5 Uso de skills y herramientas

- Inspeccionar las skills instaladas antes de asumir que existe una herramienta o capacidad.
- Leer las instrucciones de la skill relevante y respetar sus restricciones.
- Utilizar documentación oficial para APIs, librerías y servicios externos.
- No inventar opciones de configuración, endpoints ni funciones.
- No añadir herramientas solo porque estén disponibles.
- Registrar comandos de verificación que permitan repetir las pruebas.
- Si una herramienta no está disponible, explicar la limitación y proponer una alternativa viable.

### 9.6 Comunicación

Las respuestas deben ser claras, concretas y en español.

Cuando se recomiende una decisión técnica, explicar brevemente:

- Qué se recomienda.
- Por qué.
- Qué alternativa se descartó.
- Qué coste o riesgo introduce.
- Qué debe comprobarse.

No responder con elogios vacíos ni afirmaciones de que todo está perfecto. Se espera criterio técnico, pensamiento crítico y disposición a señalar problemas.

---

## 10. Pruebas y criterios de aceptación

Las pruebas deben derivarse de los requisitos y de los riesgos. No limitarse a comprobar que la aplicación arranca.

### Casos importantes del menú

- Un visitante puede abrir el menú público sin autenticarse.
- Las categorías y productos se muestran en el orden esperado.
- Los productos no disponibles se representan según la regla definida.
- Los precios y descripciones se muestran correctamente.
- Una edición autorizada desde el dashboard se refleja en la experiencia pública dentro del comportamiento de caché definido.
- Un usuario sin permisos no puede editar el menú.
- Un usuario de otro restaurante no puede consultar ni modificar los datos.
- La carga, sustitución y eliminación de imágenes respetan las políticas de almacenamiento.
- Los estados vacíos y errores tienen una presentación útil.

### Casos importantes de eventos

- Se pueden consultar los tipos de eventos y paquetes publicados.
- Los formularios validan campos obligatorios y formatos.
- Se rechazan datos inválidos.
- Una solicitud queda claramente diferenciada de una reserva confirmada.
- Los datos llegan al destino configurado.
- Los usuarios no autorizados no pueden acceder a solicitudes privadas.
- Se evitan duplicados accidentales o envíos repetidos cuando corresponda.

### Seguridad multi-tenant

Probar explícitamente, como mínimo:

- Usuario A intenta leer datos del restaurante B.
- Usuario A intenta actualizar o eliminar datos del restaurante B.
- Usuario sin membresía intenta acceder a una ruta privada.
- Usuario editor intenta realizar acciones reservadas al propietario, si esos roles existen.
- Se intenta manipular el identificador del restaurante desde el cliente.
- Se intenta acceder a archivos de otro restaurante.
- Las operaciones administrativas no filtran secretos al navegador.

Los tests de autorización deben verificar la protección real en backend/base de datos, no solo la respuesta visual de la interfaz.

---

## 11. Seguridad, privacidad y operación

- Recopilar únicamente los datos personales necesarios.
- Explicar qué información se solicita y para qué se utiliza.
- Proteger datos de contacto y solicitudes de eventos.
- No incluir datos personales reales en fixtures, capturas o demos.
- Validar y limitar formularios públicos para reducir spam y abuso.
- Evaluar rate limiting y protección anti-bot según exposición y riesgo.
- No registrar contraseñas, tokens ni información sensible en logs.
- Mantener secretos en variables de entorno.
- No subir `.env` ni credenciales al repositorio.
- Definir políticas de retención y eliminación de datos cuando el producto lo requiera.
- Considerar las obligaciones aplicables de protección de datos en Colombia antes de operar con información personal de clientes.
- Mantener dependencias y servicios actualizados.

---

## 12. Métricas y analítica: medir sin engañar

El producto puede ofrecer métricas que ayuden al restaurante a entender el uso de sus canales, siempre que se definan con precisión.

Posibles métricas:

- Visitas a la página o menú.
- Vistas de categorías y productos.
- Clics en botones de contacto.
- Clics en WhatsApp.
- Aperturas de formularios.
- Solicitudes enviadas.
- Eventos o paquetes más consultados.

Distinguir claramente:

- Visita no significa intención de compra.
- Clic en WhatsApp no significa conversación iniciada.
- Formulario enviado no significa reserva confirmada.
- Solicitud recibida no significa venta.
- Venta registrada requiere una fuente de confirmación adecuada.

No presentar estimaciones como ventas reales ni atribuir causalidad comercial a métricas que no la demuestran. La analítica debe respetar privacidad y evitar recopilar datos innecesarios.

---

## 13. Alcance, prioridades y control de complejidad

La visión es modular, pero el desarrollo debe mantenerse enfocado.

- No intentar construir un ERP gastronómico.
- No incluir inventario, facturación, nómina, domicilios, pagos, POS o reservas transaccionales sin una necesidad validada y una especificación independiente.
- No crear un constructor visual complejo si una configuración estructurada resuelve el problema.
- No construir integraciones externas antes de validar su utilidad y viabilidad.
- No asumir que todos los restaurantes tienen los mismos procesos.
- No añadir funcionalidades para impresionar en una demo si no ayudan a demostrar el valor central.
- Preferir una experiencia pequeña, coherente y fiable a una lista extensa de funciones incompletas.

La primera demostración debe ser suficientemente funcional para validar el producto y facilitar conversaciones comerciales, sin confundir demo con plataforma lista para producción.

---

## 14. Decisiones que deben investigarse y validarse

Estas son preguntas abiertas. No se deben resolver por intuición si tienen impacto importante.

### Producto

- ¿El menú inicial será solo informativo o incluirá solicitudes de pedido?
- ¿Se necesita manejar variantes y adicionales desde el primer modelo?
- ¿Los precios y productos cambian entre sedes?
- ¿Qué tipos de eventos y reglas de cotización son comunes en los restaurantes objetivo?
- ¿Las solicitudes de eventos se gestionarán dentro del dashboard o se enviarán inicialmente a WhatsApp?
- ¿Qué funcionalidades deben ser configurables por cliente y cuáles son universales?

### Arquitectura

- ¿Cómo identificar restaurantes en rutas públicas: slug, dominio propio o subdominio?
- ¿Cómo resolver la configuración de marca y sede?
- ¿Qué estrategia de caché y revalidación conviene para que los cambios del dashboard se reflejen correctamente?
- ¿Qué tablas requieren RLS y qué políticas exactas necesita cada rol?
- ¿Cómo se manejarán altas de clientes, invitaciones y recuperación de acceso?
- ¿Qué estructura de Storage permite aislar archivos por tenant?
- ¿Qué datos deben auditarse?

### Operación y negocio

- ¿Qué parte de la implementación será estándar y cuál será personalizada?
- ¿Qué soporte mensual se ofrecerá?
- ¿Qué costes variables pueden aparecer por almacenamiento, tráfico, correo o servicios externos?
- ¿Qué condiciones se deben definir para dominios, copias de seguridad, exportación y salida de un cliente?
- ¿Cómo se medirá el uso real y el valor entregado?

Cuando una pregunta no bloquee el trabajo, se puede registrar como decisión pendiente y continuar con una opción reversible. Cuando afecte seguridad, aislamiento, integridad de datos o costes relevantes, resolverla antes de implementar.

---

## 15. Cómo debe responder Gemini al recibir este documento

Primero, demuestra que entendiste el contexto. No empieces generando código ni imponiendo un roadmap.

Tu primera respuesta debe:

1. Sintetizar la visión del negocio y del producto.
2. Identificar los supuestos que parecen razonables y los que requieren validación.
3. Señalar riesgos técnicos o de producto que no debamos pasar por alto.
4. Evaluar la arquitectura multi-tenant con Supabase y el stack indicado.
5. Identificar decisiones que conviene tomar antes de construir.
6. Proponer cómo organizar el trabajo con Antigravity usando planes, specs, tests, agentes y loops de revisión.
7. Separar decisiones recomendadas, decisiones abiertas y cuestiones que requieren información del usuario.
8. Hacer únicamente las preguntas realmente necesarias para avanzar, agrupadas con claridad y sin convertir la conversación en un cuestionario interminable.

No asumas que el nombre comercial, la identidad visual o el alcance definitivo ya están decididos. No inventes validación de mercado, clientes, ventas ni capacidades implementadas.

---

## 16. Prompt de inicio para Gemini

Utiliza el siguiente mensaje junto con este documento:

> Quiero que trabajemos en este proyecto como un equipo de producto e ingeniería de software. Lee y analiza el brief completo antes de proponer una solución.
>
> Mi entorno principal de construcción será Antigravity. Mi forma de trabajar es deliberada: me gusta comenzar con comprensión del problema, planes, especificaciones, criterios de aceptación, implementación controlada, pruebas, revisión visual, loops de corrección y uso de subagentes y skills cuando aporten valor.
>
> No quiero que conviertas el documento en una lista rígida de fases ni que empieces a programar inmediatamente. Quiero que primero razones sobre el producto, la arquitectura, el modelo de negocio y los riesgos. Cuestiona las decisiones cuando tengas argumentos y ofrece alternativas justificadas.
>
> Conserva como stack preferido Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase y Vercel, salvo que encuentres una razón técnica concreta para cambiar algo. Prioriza una arquitectura multi-tenant segura, reutilizable y razonable en costes.
>
> La calidad visual importa mucho: buscamos una experiencia contemporánea, premium, editorial, responsive y cuidada; no una plantilla genérica. La calidad de ingeniería importa igual: código mantenible, seguridad real, tests y evidencia de funcionamiento.
>
> Tu primera tarea es devolver una evaluación crítica del brief: visión que entendiste, fortalezas, riesgos, decisiones abiertas y recomendaciones. Después, propón cómo deberíamos colaborar con Antigravity para definir el alcance inicial. No implementes nada hasta que hayamos acordado qué vamos a construir y cómo comprobaremos que está bien hecho.

---

## 17. Principio rector

**Construir productos que resuelvan problemas reales de restaurantes, con una base tecnológica reutilizable, una experiencia visual sobresaliente y una ingeniería suficientemente rigurosa para convertir una demostración en una solución comercial confiable.**

La tecnología debe facilitar el negocio. El diseño debe facilitar la comprensión y la conversión. La arquitectura debe permitir crecer sin reconstruir todo. Y cada funcionalidad debe existir por una razón verificable.
