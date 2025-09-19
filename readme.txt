proyecto-whatsapp/
│
├─ src/
│   ├─ app.js              # servidor Express con webhook
│   └─ utils/
│       └─ sendMessage.js  # helper para enviar mensajes
│
├─ docs/
│   └─ WhatsApp-Cloud-API.postman_collection.json  # colección Postman
│
├─ .env.example            # ejemplo de variables de entorno
├─ package.json
└─ README.md

# Proyecto WhatsApp Cloud API

Servidor Node.js para recibir y enviar mensajes con la API oficial de Meta.

## Requisitos
- Node.js 18+
- Cuenta de WhatsApp Business en Meta
- Usuario del sistema con token permanente
- Número verificado en Cloud API

## Instalación
```bash
npm install
cp .env.example .env
# editar .env con tu TOKEN y PHONE_NUMBER_ID
npm run dev




## Postman
- Colección de requests para WhatsApp Cloud API
- Importar desde: docs/WhatsApp-Cloud-API.postman_collection.json
Abrí Postman → Import → File y seleccioná ese archivo.

Te va a aparecer la colección con todos los requests.

En las variables de la colección, completá:

TOKEN → tu Access Token del Usuario del Sistema

BUSINESS_ID → 538918002616853

WABA_ID → el ID que sacaste (ej: 2179670872553359)

PHONE_NUMBER_ID → el que corresponde a tu número (ej: 734578309746361)


Ngrok
30vRPXsUhgjK9ZRdDX7RiAASuzA_2awkVhLw91chVf8BMpRwi

ngrok config add-authtoken TU_TOKEN_AQUI
ngrok http 3000

Estado	Descripción
IDLE	Estado inicial, sin interacción activa
AWAITING_NAME	Esperando que el usuario diga su nombre
AWAITING_ADDRESS	Esperando dirección o ubicación
AWAITING_MENU_SELECT	Mostrando direcciones frecuentes, esperando selección o texto libre
ORDER_ACTIVE	Pedido creado, esperando despacho o cancelación
ORDER_DONE	Pedido completado, se puede cerrar sesión

CREATE TABLE WA_MessageLog (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  WaId VARCHAR(20) NOT NULL,              -- Número del remitente (ej: 5493416777021)
  NombreContacto VARCHAR(100),           -- Nombre del contacto si está disponible
  TipoMensaje VARCHAR(20),               -- text, image, location, etc.
  Contenido TEXT,                        -- Texto del mensaje o JSON del contenido
  MediaId VARCHAR(100),                  -- Si es imagen/audio/documento
  Timestamp DATETIME NOT NULL,           -- Fecha y hora del mensaje
  ContextId VARCHAR(100),                -- Si es respuesta a otro mensaje
  EstadoProcesamiento VARCHAR(20),       -- pending, processed, error, etc.
  Metadata NVARCHAR(MAX) NULL                     -- Metadata adicional (ej: phone_number_id, pricing, etc.)
);


await db.insert("WA_MessageLog", {
  WaId: msg.from,
  NombreContacto: getContactName(value, msg.from),
  TipoMensaje: msg.type,
  Contenido: msg.text?.body || JSON.stringify(msg),
  MediaId: msg[msg.type]?.id || null,
  Timestamp: new Date(Number(msg.timestamp) * 1000),
  ContextId: msg.context?.id || null,
  EstadoProcesamiento: "pending",
  Metadata: JSON.stringify(value.metadata || {})
});

Esta tabla registra cada mensaje que el bot envía, con vínculo al mensaje original si aplica
CREATE TABLE WA_ReplyLog (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  WaId VARCHAR(20) NOT NULL,               -- Número del destinatario
  ReplyText NVARCHAR(MAX) NOT NULL,        -- Texto enviado
  RelatedMessageId INT NULL,               -- FK a WA_MessageLog.Id si aplica
  Timestamp DATETIME NOT NULL DEFAULT GETDATE(), -- Fecha de envío
  PhoneNumberId VARCHAR(50),               -- ID del número usado para enviar
  Status VARCHAR(20) DEFAULT 'sent',       -- sent, failed, queued, etc.
  ApiResponse NVARCHAR(MAX) NULL           -- JSON con respuesta de Meta
);

Esto te permite:

Auditar qué se respondió y cuándo
Detectar errores de envío
Vincular respuestas a mensajes originales

2. Tabla WA_Session — Estado conversacional por usuario
Esta tabla mantiene el estado actual de cada conversación, útil para flujos como “esperando nombre”, “esperando dirección”, etc.
sql
CREATE TABLE WA_Session (
  WaId VARCHAR(20) PRIMARY KEY,            -- Número del usuario
  EstadoConversacional VARCHAR(50) NOT NULL, -- IDLE, AWAITING_NAME, etc.
  Nombre NVARCHAR(100) NULL,               -- Nombre si ya fue capturado
  Direccion NVARCHAR(200) NULL,            -- Dirección si ya fue capturada
  IdViaje INT NULL,                        -- FK al viaje si ya fue creado
  UltimaActualizacion DATETIME NOT NULL DEFAULT GETDATE()
);

Esto permite:

Persistir el estado entre mensajes
Evitar duplicados o reintentos
Saber si el usuario ya tiene un viaje activo

armar un job SQL que corra cada 5 minutos y detecte sesiones vencidas



whatsapp-bot/
├── logs/                         # Logs de ejecución
│   └── bot.log
│
├── node_modules/                 # Dependencias
│
├── .env                          # Token, versión API, etc.
├── package.json                  # Scripts y dependencias
│
├── src/
│   ├── app.js                    # Punto de entrada Express
│
│   ├── utils/                    # Funciones generales
│   │   ├── analizeMessages.js    # Detecta saludos, direcciones, etc.
│   │   ├── logger.js             # Wrapper para logs
│   │   ├── sendMessage.js        # Envío de mensajes vía API
│   │   └── webhook.js            # Ruta POST /webhook
│
│   ├── services/                 # Lógica de negocio
│   │   ├── messageHandler.js     # Procesa mensajes entrantes
│   │   ├── sessionManager.js     # Maneja WA_Session
│   │   ├── replyBuilder.js       # Construye respuestas según estado
│   │   └── timeoutChecker.js     # Detecta sesiones vencidas
│
│   ├── db/                       # Acceso a base de datos
│   │   ├── index.js              # Conexión SQL
│   │   ├── messageLog.js         # Inserta en WA_MessageLog
│   │   ├── replyLog.js           # Inserta en WA_ReplyLog
│   │   └── session.js            # Get/update WA_Session
│
│   └── jobs/                     # Procesos periódicos
│       └── sessionTimeout.js     # Limpia sesiones inactivas


¿Cómo se conectan?
webhook.js recibe el mensaje y llama a messageHandler.js

messageHandler.js consulta el estado con sessionManager.js, analiza el texto con analizeMessages.js, y construye la respuesta con replyBuilder.js

sendMessage.js envía la respuesta y loguea en replyLog.js

timeoutChecker.js puede correr en background o como job en sessionTimeout.js
