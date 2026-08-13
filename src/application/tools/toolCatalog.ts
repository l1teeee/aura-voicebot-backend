import { JsonSchemaObject, LLMToolDefinition } from '../../domain/ports/LLMProvider';
import { TEMPERATURE_UNIT_VALUES, TOOL_NAMES } from '../constants';

const weatherLookupParameters: JsonSchemaObject = {
  type: 'object',
  properties: {
    city: {
      type: 'string',
      description:
        'Nombre de la ciudad sobre la que se consulta el clima, tal como la nombra la persona. Solo la ciudad, sin la provincia ni el país. Por ejemplo Madrid, Bogotá o Nueva York.'
    },
    units: {
      type: 'string',
      description:
        'Sistema de unidades de la temperatura. Usa metric para grados centígrados e imperial para grados Fahrenheit. Si la persona no indica nada, usa metric.',
      enum: TEMPERATURE_UNIT_VALUES
    }
  },
  required: ['city']
};

const forecastLookupParameters: JsonSchemaObject = {
  type: 'object',
  properties: {
    city: {
      type: 'string',
      description:
        'Nombre de la ciudad sobre la que se consulta el pronóstico, tal como la nombra la persona. Solo la ciudad, sin la provincia ni el país. Por ejemplo Madrid, Bogotá o Nueva York.'
    },
    units: {
      type: 'string',
      description:
        'Sistema de unidades de la temperatura. Usa metric para grados centígrados e imperial para grados Fahrenheit. Si la persona no indica nada, usa metric.',
      enum: TEMPERATURE_UNIT_VALUES
    }
  },
  required: ['city']
};

const addFavoriteCityParameters: JsonSchemaObject = {
  type: 'object',
  properties: {
    city: {
      type: 'string',
      description:
        'Nombre de la ciudad que la persona quiere guardar como favorita. Si dice esta ciudad o se refiere a ella de forma implícita, usa la ciudad mencionada más recientemente en la conversación.'
    }
  },
  required: ['city']
};

const listFavoriteCitiesParameters: JsonSchemaObject = {
  type: 'object',
  properties: {},
  required: []
};

const logInteractionParameters: JsonSchemaObject = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description:
        'Resumen breve de la interacción, en una o dos frases: qué pidió la persona y qué se le respondió.'
    }
  },
  required: ['summary']
};

export const AVAILABLE_TOOLS: readonly LLMToolDefinition[] = [
  {
    name: TOOL_NAMES.weatherLookup,
    description:
      'Consulta el clima actual de una ciudad y devuelve temperatura, sensación térmica, descripción del cielo, humedad, ciudad y país. Úsala siempre que la persona pregunte por el tiempo, la temperatura, la lluvia o si necesita abrigo en un lugar concreto. No inventes nunca estos datos. Si no sabes de qué ciudad habla, pregúntasela antes de llamar a esta herramienta.',
    parameters: weatherLookupParameters
  },
  {
    name: TOOL_NAMES.forecastLookup,
    description:
      'Consulta el pronóstico del tiempo de los próximos cinco días de una ciudad. Devuelve una lista de días, cada uno con una etiqueta que dice hoy, mañana o el nombre del día de la semana, la temperatura mínima y máxima, el estado del cielo y la probabilidad de lluvia en porcentaje. Úsala siempre que la persona pregunte por el tiempo de mañana, del fin de semana o de cualquier día futuro, o si va a llover más adelante. Para el tiempo de ahora mismo usa consultarClima. No inventes nunca estos datos.',
    parameters: forecastLookupParameters
  },
  {
    name: TOOL_NAMES.addFavoriteCity,
    description:
      'Guarda una ciudad como favorita de la persona identificada. Úsala cuando pida guardar, añadir o agregar una ciudad a sus favoritas, incluso si se refiere a una ciudad mencionada recientemente como esta ciudad.',
    parameters: addFavoriteCityParameters
  },
  {
    name: TOOL_NAMES.listFavoriteCities,
    description:
      'Consulta las ciudades favoritas de la persona identificada. Úsala cuando pregunte cuáles son sus ciudades favoritas o pida verlas.',
    parameters: listFavoriteCitiesParameters
  },
  {
    name: TOOL_NAMES.logInteraction,
    description:
      'Deja constancia de la conversación actual en el registro externo. Úsala solo cuando la persona pida expresamente guardar, registrar o anotar lo que se ha hablado.',
    parameters: logInteractionParameters
  }
];
