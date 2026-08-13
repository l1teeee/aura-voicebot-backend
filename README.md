# Aura — Backend

API REST del voicebot **Aura**: un asistente personal conversacional por voz, de propósito abierto y con especialidad en clima.

---

## 1. El producto

Aura vive en el navegador. El frontend (Vue 3) captura la voz del usuario, la transcribe localmente y envía **texto plano** a esta API. La API:

1. Recupera el historial de la conversación asociado a la sesión.
2. Envía el mensaje a un modelo de OpenAI (`gpt-4o-mini`) junto con el catálogo de herramientas disponibles.
3. Si el modelo solicita una herramienta, la ejecuta y le devuelve el resultado, repitiendo el ciclo hasta un máximo de 3 iteraciones.
4. Devuelve una respuesta en lenguaje natural, pensada para ser **leída en voz alta**: frases cortas, sin markdown, sin viñetas, sin emojis, sin URLs, en español neutro y de unas 60 palabras como máximo.
5. Registra la interacción completa en un webhook externo.

Herramientas que el modelo puede invocar:

| Herramienta            | Qué hace                                                                 |
|------------------------|--------------------------------------------------------------------------|
| `consultarClima`       | Consulta el clima actual de una ciudad en OpenWeatherMap y lo normaliza a un tipo del dominio (`WeatherSnapshot`). El LLM nunca ve el payload crudo del tercero. |
| `registrarInteraccion` | Envía la interacción al webhook de registro. Es *fire-and-forget*: si falla, se anota en consola y la conversación continúa. |

Lo que este backend **no** hace: autenticación real, frontend, transcripción de audio, síntesis de voz, WebSockets ni streaming.

**Stack:** Node.js 20+, TypeScript `strict`, Express 4, SDK oficial `openai` v4, `zod`, `dotenv` y `pg`. Sin ORM ni Docker. PostgreSQL se usa para identificación e historial persistente; el chat anónimo conserva su repositorio en memoria.

---

## 2. Arquitectura

Clean Architecture **pragmática**: se definen puertos solo donde existe una implementación externa real que podría cambiarse.

### 2.1 Estructura de carpetas

```
src/
  domain/                        Núcleo. No importa nada: ni Express, ni OpenAI, ni zod.
    entities/                    Conversation, ConversationTurn, Message, User
    value-objects/               SessionId, UserMessage
    ports/                       LLMProvider, SpeechProvider, WeatherProvider,
                                 InteractionLogger, ConversationRepository, UserRepository
    errors/                      DomainError + subtipos tipados
    constants.ts

  application/                   Orquestación. Importa solo domain (+ zod para validar
                                 los argumentos que llegan del LLM).
    use-cases/                   ProcessUserMessageUseCase, SynthesizeSpeechUseCase
    dto/                         ProcessUserMessageInput / Output, SynthesizeSpeechInput
    prompts/                     auraSystemPrompt
    tools/                       toolCatalog
    constants.ts

  infrastructure/                Implementaciones concretas de los puertos.
    llm/                         OpenAILLMProvider
    speech/                      OpenAITextToSpeechProvider
    weather/                     OpenWeatherMapProvider
    logging/                     WebhookInteractionLogger
    persistence/                 InMemoryConversationRepository, PostgresUserRepository
    http/                        HttpClient (timeout + reintentos)
    constants.ts

  interfaces/                    Adaptador HTTP. Importa application y domain,
    http/                        nunca infrastructure.
      routes/                    chat.routes.ts, health.routes.ts, identify.routes.ts,
                                 speech.routes.ts
      controllers/               ChatController, IdentifyUserController, SpeechController
      middlewares/               errorHandler, rateLimiter, cors,
                                 requestLogger, validateBody
      schemas/                   chatRequestSchema, identifyUserRequestSchema,
                                 speechRequestSchema (zod)
      constants.ts

  config/env.ts                  Variables de entorno validadas con zod al arranque.
  container.ts                   Composition root: único lugar que hace `new`.
  server.ts                      Bootstrap HTTP, montaje de rutas y graceful shutdown.
```

### 2.2 Regla de dependencia

Las capas externas conocen a las internas; **jamás al revés**.

```
   interfaces ──┐
                ├──> application ──> domain
infrastructure ─┘                      ^
                                       |
   config / container / server ────────┘
```

- `domain/` no importa **nada**: ni librerías, ni otras capas. TypeScript puro.
- `application/` importa **solo** `domain/` (y `zod` para validar argumentos del LLM). Prohibido `infrastructure/`, `interfaces/`, `express`, `openai`.
- `infrastructure/` importa `domain/` (implementa sus puertos) y librerías externas. Prohibido `application/` e `interfaces/`.
- `interfaces/` importa `application/` y `domain/`. Prohibido `infrastructure/`.
- `container.ts` es el único punto donde las flechas se cruzan: conoce a todos y ensambla el grafo.

Consecuencia práctica: el caso de uso se puede ejecutar en un test sin Express, sin red y sin claves de API, sustituyendo los cuatro puertos por dobles.

### 2.3 Flujo de una petición

```
POST /api/chat
   │
   ├─ cors → requestLogger → rateLimiter → validateBody(chatRequestSchema)
   │
   ├─ ChatController.handle           mapea HTTP -> DTO, sin lógica de negocio
   │
   └─ ProcessUserMessageUseCase.execute
        1. SessionId.create + UserMessage.create        (ValidationError si no cuadran)
        2. conversationRepository.findBySessionId       (null -> Conversation.start)
        3. conversation.addUserMessage
        4. bucle de tool calling, máximo 3 iteraciones
             llmProvider.generate({ systemPrompt, conversation, tools, toolRounds })
             sin toolCalls  -> respuesta final, se sale del bucle
             con toolCalls  -> se ejecutan, se acumula un LLMToolRound y se repite
             límite agotado -> se responde con lo que haya y se anota la anomalía
        5. conversation.completeTurn + conversationRepository.save
        6. interactionLogger.log(...)                   fire-and-forget, sin await bloqueante
        7. devuelve ProcessUserMessageOutput
```

Los errores de herramienta (`CITY_NOT_FOUND`, `EXTERNAL_SERVICE_ERROR`) **no rompen la petición**: se devuelven al modelo como contenido del resultado de la herramienta para que los comunique con naturalidad ("no encuentro esa ciudad, ¿puedes repetirla?"). Solo un fallo del propio LLM se propaga como `503`.

---

## 3. Decisiones arquitectónicas y su justificación

### 3.1 Puertos solo para servicios externos y repositorios

Un puerto es un contrato que aísla una decisión que puede cambiar. Estos seis tienen una razón concreta y presente para existir:

| Puerto                   | Razón de existir                                                                  |
|--------------------------|-----------------------------------------------------------------------------------|
| `LLMProvider`            | OpenAI podría sustituirse por Anthropic, Groq o un modelo local sin tocar el caso de uso. |
| `SpeechProvider`         | La síntesis de voz puede cambiar de OpenAI a otro proveedor sin tocar HTTP ni el caso de uso. |
| `WeatherProvider`        | OpenWeatherMap tiene alternativas directas (AEMET, WeatherAPI) con el mismo contrato. |
| `InteractionLogger`      | Hoy es un webhook de Pipedream; mañana puede ser BigQuery, S3 o una cola.          |
| `ConversationRepository` | Hoy es memoria; en cuanto haya más de una instancia debe ser Redis.                |
| `UserRepository`         | Aísla PostgreSQL y concentra la identificación, el historial y la asociación opcional del chat. |

No se han creado puertos ni DTOs para lo que no cambia. No hay mappers entre estructuras idénticas, ni una interfaz por clase "por simetría". Una abstracción sin al menos una razón concreta de existir es coste de mantenimiento sin retorno.

### 3.2 Composición manual, sin librería de inyección de dependencias

`container.ts` es el único archivo que hace `new` de una clase concreta de infraestructura. Nada de decoradores, `reflect-metadata`, contenedores mágicos ni resolución en tiempo de ejecución.

Justificación: con cuatro dependencias el grafo cabe en una pantalla y se lee de arriba abajo. Una librería de DI aportaría una capa de indirección, un ciclo de vida que aprender y errores que solo aparecen en tiempo de ejecución, a cambio de resolver un problema que aquí no existe. El compilador verifica el ensamblado completo: si una implementación deja de cumplir su puerto, `npm run typecheck` falla antes de arrancar.

### 3.3 El caso de uso orquesta el bucle de herramientas; `LLMProvider` es **sin estado**

`LLMProvider.generate` recibe en cada llamada la conversación completa más el histórico acumulado de rondas de herramientas, y devuelve texto o peticiones de herramienta. No guarda nada entre llamadas.

Justificación:

- **El bucle es lógica de negocio, no un detalle de OpenAI.** El límite de 3 iteraciones, qué hacer al agotarlo y cómo se traduce un error de herramienta en algo que el modelo pueda contar son reglas del producto. Viven en `application/`, donde se pueden leer y probar sin red.
- **Un proveedor sin estado es sustituible de verdad.** Si el bucle viviera dentro del adaptador de OpenAI, cambiar de proveedor obligaría a reimplementar la política de reintentos completa. Al ser sin estado, el adaptador solo traduce formatos: entidades del dominio a mensajes del SDK y viceversa.
- **Es trivialmente testeable.** Un `LLMProvider` falso que devuelve una secuencia guionizada de peticiones de herramienta ejercita el bucle entero sin llamar a nadie.

### 3.4 `InMemoryConversationRepository` se cambia por Redis en una línea

El repositorio es un `Map` con TTL de 30 minutos, límite de 20 turnos por conversación y limpieza periódica de sesiones expiradas. Implementa `ConversationRepository`, cuyo contrato es asíncrono (`Promise`) aunque hoy la implementación sea síncrona: precisamente para que una implementación con E/S real encaje sin cambiar ni una firma.

Migrar a Redis es sustituir una línea de `container.ts`:

```ts
const conversationRepository: ConversationRepository = new RedisConversationRepository(redisClient);
```

Ni el caso de uso, ni el controlador, ni el dominio se enteran. Esto importa desde el primer día: memoria local significa una única instancia y pérdida del historial en cada despliegue, algo aceptable en una demo e inaceptable en cuanto haya escalado horizontal.

### 3.5 El logger es *fire-and-forget* tolerante a fallos

`InteractionLogger.log` **nunca rechaza la promesa** y se invoca sin `await` bloqueante al final del caso de uso. Cualquier error se captura dentro de la implementación y se reporta por consola.

Justificación: el registro es observabilidad, no parte del contrato con el usuario. Si el webhook está caído o tarda tres segundos, el usuario no debe esperar ni recibir un error por algo que no le afecta. La regla es explícita: **un webhook caído jamás debe romper la experiencia**. Además del registro que el modelo pueda solicitar como herramienta, toda interacción completada se registra automáticamente al final del caso de uso, para garantizar que la operación de escritura siempre ocurra.

### 3.6 Otras decisiones

- **`Conversation` encapsula sus invariantes.** El límite de turnos, la poda del historial y el cálculo de expiración viven dentro de la entidad. No es una estructura anémica manipulada desde fuera.
- **Errores de dominio tipados.** Solo el `errorHandler` conoce códigos HTTP; el dominio habla de `ValidationError`, `CityNotFoundError`, `LLMUnavailableError`… Ninguna otra capa traduce a HTTP.
- **Nunca se filtra nada sensible.** Ni stack traces, ni claves de API, ni texto crudo de un servicio externo salen en una respuesta, un log o un mensaje de error de arranque. El validador de entorno lista qué variable falla y por qué, nunca su valor.
- **Fallo rápido al arrancar.** `config/env.ts` valida el entorno con zod antes de abrir el puerto. Si falta una clave, el proceso muere con un mensaje accionable en lugar de fallar en la primera petición del usuario.
- **Rate limits independientes en `/api/chat` y `/api/speech`.** Cada ruta protege por separado su cuota de OpenAI. `/api/health` queda libre porque las plataformas de despliegue lo consultan constantemente y no debe consumir cupo ni tumbar el health check.

---

## 4. Instalación y ejecución

Requisitos: **Node.js 20 o superior** (el código usa `fetch`, `AbortController` y `crypto` globales).

> El repositorio se publica sin `node_modules/` ni `package-lock.json`: el lock se genera en tu primer `npm install`. Hasta entonces el editor marcará como no resueltos los imports de `express`, `openai`, `zod` y `dotenv`, y `npm run typecheck` fallará. Es lo esperado.

```bash
# 1. Clonar el repositorio
git clone https://github.com/l1teeee/aura-voicebot-backend.git
cd aura-voicebot-backend

# 2. Instalar dependencias
npm install

# 3. Crear tu archivo de entorno a partir de la plantilla
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env

# 4. Editar .env y rellenar las claves reales (ver tabla de la sección 6)

# 5. Arrancar en desarrollo, con recarga automática
npm run dev
```

Comprobación rápida:

```bash
curl http://localhost:3000/api/health
```

### Scripts disponibles

| Script              | Qué hace                                                        |
|---------------------|------------------------------------------------------------------|
| `npm run dev`       | Arranca con `tsx watch`: recarga automática al guardar.          |
| `npm run build`     | Compila TypeScript a `dist/` con `tsc`.                          |
| `npm start`         | Ejecuta el build compilado (`node dist/server.js`). Producción.  |
| `npm run typecheck` | Comprueba tipos sin emitir archivos.                             |
| `npm run lint`      | Analiza `src/**/*.ts` con ESLint.                                |

Flujo de producción: `npm install` → `npm run build` → `npm start`.

---

## 5. API

Base URL en local: `http://localhost:3000`. Todas las rutas cuelgan del prefijo `/api`.

| Método | Ruta           | Body                                          | Respuesta 200                                                        |
|--------|----------------|-----------------------------------------------|----------------------------------------------------------------------|
| `GET`  | `/api/health`  | —                                             | `{ "status": "ok", "uptime": 1234 }` (`uptime` en segundos enteros)  |
| `POST` | `/api/chat`    | `{ "message": string, "sessionId": string }`  | `{ "reply": string, "sessionId": string, "action"?: { "type": string, "data": object } }` |
| `POST` | `/api/identify` | `{ "name": string }`                         | `{ "userId": string, "isReturning": boolean, "conversations": [...] }` |
| `POST` | `/api/speech`  | `{ "text": string }`                           | Audio MP3 (`Content-Type: audio/mpeg`) transmitido por streaming.            |

Restricciones del body de `/api/chat`:

| Campo       | Tipo   | Reglas                                        |
|-------------|--------|-----------------------------------------------|
| `message`   | string | Obligatorio. Entre 1 y 1000 caracteres.       |
| `sessionId` | string | Obligatorio. UUID v4. Lo genera el frontend y lo mantiene durante toda la conversación. |
| `userId`    | string | Opcional. UUID v4 devuelto por `/api/identify`. Si no viene, el comportamiento actual no cambia. |

`action` se **omite del JSON** si el modelo no invocó ninguna herramienta. Cuando aparece, sirve para que el frontend muestre contexto visual (por ejemplo, una tarjeta de clima).

El body de `/api/speech` solo admite `text`, que se recorta y debe contener entre 1 y 800 caracteres. La respuesta no se almacena en caché.

### Ejemplo

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Qué tiempo hace en Valencia?",
    "sessionId": "3f1a7c9e-2b64-4d2f-9a1e-8c5d6b7a0f31"
  }'
```

```json
{
  "reply": "En Valencia hay 24 grados y cielo despejado. Se siente como 25. Buen día para salir.",
  "sessionId": "3f1a7c9e-2b64-4d2f-9a1e-8c5d6b7a0f31",
  "action": {
    "type": "weather_lookup",
    "data": {
      "city": "Valencia",
      "country": "ES",
      "temperature": 24,
      "feelsLike": 25,
      "description": "cielo despejado",
      "humidity": 55,
      "units": "metric"
    }
  }
}
```

Para sintetizar una respuesta y guardarla como MP3:

```bash
curl -X POST http://localhost:3000/api/speech \
  -H "Content-Type: application/json" \
  -d '{"text":"En Valencia hay 24 grados y cielo despejado."}' \
  --output aura.mp3
```

### Errores

Todos los errores comparten exactamente la misma forma:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "El mensaje no puede estar vacío." } }
```

| Código                   | HTTP | Cuándo ocurre                                                        |
|--------------------------|------|-----------------------------------------------------------------------|
| `VALIDATION_ERROR`       | 400  | Body ausente o mal formado, identificadores inválidos o campos de texto fuera de sus límites. |
| `CITY_NOT_FOUND`         | 400  | La ciudad solicitada no existe en el proveedor de clima.              |
| `NOT_FOUND`              | 404  | La ruta solicitada no existe.                                         |
| `RATE_LIMIT_EXCEEDED`    | 429  | Se superó el límite de peticiones por IP.                             |
| `LLM_UNAVAILABLE`        | 503  | OpenAI no responde, agota el timeout o devuelve un error irrecuperable. |
| `EXTERNAL_SERVICE_ERROR` | 503  | Un servicio externo, incluida la síntesis de voz, no respondió correctamente. |
| `INTERNAL_ERROR`         | 500  | Cualquier error no previsto. Mensaje genérico en español.              |

Nunca se expone un stack trace, una clave de API ni el texto crudo de un servicio externo.

### Límites operativos

| Límite                                | Valor        | Por qué                                       |
|---------------------------------------|--------------|-----------------------------------------------|
| Peticiones por IP a `/api/chat`       | 30 por minuto | Protege la cuota de OpenAI.                  |
| Peticiones por IP a `/api/speech`     | 30 por minuto | Limita por separado el coste de síntesis.    |
| Iteraciones de herramientas por turno | 3            | Evita bucles infinitos de tool calling.       |
| Turnos guardados por conversación     | 20           | Acota el tamaño del contexto y el coste.      |
| TTL de una sesión inactiva            | 30 minutos   | Libera memoria de sesiones abandonadas.       |
| Tamaño máximo del body JSON           | 16 kB        | El mensaje más largo válido son 1000 caracteres. |
| Timeout de peticiones salientes       | Configurable, con 1 reintento y backoff exponencial solo para `429`, `502`, `503` y `504`. | Absorbe fallos transitorios sin castigar la latencia. |

---

### Identificación de usuario

`POST /api/identify` recibe `{ "name": "string" }`. El nombre se recorta y se normaliza a minúsculas para buscarlo en `users.name_key`. La respuesta devuelve el UUID, indica si es un usuario existente y, si corresponde, devuelve sus sesiones e interacciones en orden cronológico.

El historial persistente requiere ejecutar [`database/schema.sql`](database/schema.sql) en PostgreSQL y configurar `DATABASE_URL`. Cada petición de `/api/chat` que incluya el `userId` devuelto por este endpoint crea o reutiliza la sesión en PostgreSQL y guarda la interacción. Las peticiones sin `userId` siguen usando exactamente el flujo anónimo en memoria.

Respuesta `200`:

```json
{
  "userId": "uuid",
  "isReturning": true,
  "conversations": [
    {
      "sessionId": "uuid",
      "startedAt": "2026-08-12T10:00:00.000Z",
      "messages": [
        {
          "role": "user",
          "text": "Hola",
          "createdAt": "2026-08-12T10:00:01.000Z"
        },
        {
          "role": "bot",
          "text": "Hola, ¿en qué puedo ayudarte?",
          "createdAt": "2026-08-12T10:00:01.000Z"
        }
      ]
    }
  ]
}
```

Los nombres con menos de 2 o más de 40 caracteres devuelven `400` con el formato común `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`.

Esta identificación no es autenticación real. Es una decisión deliberada para la prueba de concepto: no hay contraseña, verificación de identidad, sesión segura ni protección contra suplantación. Cualquier persona que escriba el mismo nombre recuperará el historial asociado, por lo que esta solución no debe usarse para datos sensibles ni producción sin añadir autenticación real.

---

## 6. Variables de entorno

Se validan con zod al arrancar. Si falta alguna obligatoria o es inválida, el proceso **no arranca** y se imprime qué variable falla y por qué (nunca su valor).

| Variable               | Obligatoria | Por defecto   | Descripción y de dónde sacarla                                                                                   |
|------------------------|-------------|---------------|-------------------------------------------------------------------------------------------------------------------|
| `PORT`                 | No          | `3000`        | Puerto HTTP. En Render y Railway lo inyecta la plataforma: no lo fijes a mano en producción.                       |
| `NODE_ENV`             | No          | `development` | `development`, `production` o `test`.                                                                             |
| `OPENAI_API_KEY`       | **Sí**      | —             | Clave de OpenAI. Créala en <https://platform.openai.com/api-keys>. Requiere saldo o plan activo.                    |
| `OPENAI_MODEL`         | No          | `gpt-4o-mini` | Modelo de chat. `gpt-4o-mini` es el equilibrio recomendado entre coste, latencia y calidad de tool calling.        |
| `OPENAI_TTS_MODEL`     | No          | `gpt-4o-mini-tts` | Modelo de síntesis de voz. Debe admitir instrucciones de tono en lenguaje natural.                             |
| `OPENAI_TTS_VOICE`     | No          | `coral`       | Voz de síntesis. Voces integradas: `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `onyx`, `nova`, `sage`, `shimmer`, `verse`, `marin` y `cedar`. |
| `OPENWEATHER_API_KEY`  | **Sí**      | —             | Clave de OpenWeatherMap. Regístrate gratis y créala en <https://home.openweathermap.org/api_keys>. Tarda unos minutos en activarse tras crearla. |
| `OPENWEATHER_BASE_URL` | **Sí**      | —             | URL base de la API, sin barra final: `https://api.openweathermap.org/data/2.5`.                                    |
| `LOG_WEBHOOK_URL`      | **Sí**      | —             | Endpoint que recibe el registro de cada interacción. Crea uno gratis en <https://pipedream.com/requestbin> o RequestBin. |
| `ALLOWED_ORIGIN`       | **Sí**      | —             | Único origen autorizado por CORS, sin barra final. En local, el del dev server de Vue (`http://localhost:5173`); en producción, el dominio real del frontend. |

`DATABASE_URL` es opcional para conservar el chat anónimo. Es necesaria para usar `/api/identify` y guardar el historial asociado a `userId`.

---

## 7. Despliegue

El servidor lee `process.env.PORT`, así que funciona con el **puerto dinámico** que asignan tanto Render como Railway sin tocar nada. Ambas plataformas envían `SIGTERM` al reiniciar o redesplegar: el proceso captura la señal, deja de aceptar conexiones, limpia los intervalos de limpieza de sesiones y de rate limiting, y sale de forma ordenada (con un cierre forzoso de seguridad si algo se atasca).

Antes de desplegar, ten a mano las cuatro claves obligatorias y el origen del frontend ya desplegado.

### 7.1 Render

1. **New → Web Service** y conecta el repositorio.
2. Configuración:

   | Campo             | Valor                        |
   |-------------------|------------------------------|
   | Runtime           | Node                         |
   | Build Command     | `npm install && npm run build` |
   | Start Command     | `npm start`                  |
   | Health Check Path | `/api/health`                |

3. En **Environment → Environment Variables**, añade `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE`, `OPENWEATHER_API_KEY`, `OPENWEATHER_BASE_URL`, `LOG_WEBHOOK_URL`, `ALLOWED_ORIGIN` y `NODE_ENV=production`.
   **No definas `PORT`:** Render la inyecta y sobrescribirla rompe el despliegue.
4. Despliega y comprueba `https://<tu-servicio>.onrender.com/api/health`.

> En el plan gratuito el servicio se duerme tras un rato de inactividad: la primera petición tras el arranque en frío tarda varios segundos y el historial anónimo en memoria se pierde. Es esperado con `InMemoryConversationRepository`; el historial asociado a `userId` se conserva en PostgreSQL.

### 7.2 Railway

1. **New Project → Deploy from GitHub repo**.
2. Railway detecta Node con Nixpacks. Si necesitas fijarlo, en **Settings → Build & Deploy**:

   | Campo         | Valor                          |
   |---------------|--------------------------------|
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start`                    |

3. En la pestaña **Variables**, añade las mismas variables que en Render (todas menos `PORT`, que Railway inyecta).
4. En **Settings → Networking → Generate Domain** para obtener la URL pública, y verifica `/api/health`.

### 7.3 Después de desplegar

- Ajusta `ALLOWED_ORIGIN` al dominio real del frontend, o el navegador bloqueará las peticiones por CORS.
- El historial anónimo vive en memoria: **una sola instancia**. El historial asociado a `userId` vive en PostgreSQL. No actives autoescalado para el chat anónimo sin migrar antes su repositorio a Redis (sección 3.4).
- Comprueba que el webhook de registro recibe eventos; si no, revisa `LOG_WEBHOOK_URL`. Un fallo ahí no rompe la conversación, solo se anota en los logs.

---

## 8. Convenciones de código

- TypeScript `strict`, sin `any`. Si un tipo externo es desconocido, se usa `unknown` y se valida con zod.
- **Sin comentarios en el código**: los nombres explican la intención.
- Nombres de código en inglés; textos de cara al usuario en español.
- Sin números mágicos: cada capa tiene su módulo `constants.ts`.
- Exportaciones nombradas, nunca `export default`.
- Imports relativos sin extensión y sin alias de rutas.
- Un archivo, una responsabilidad.
