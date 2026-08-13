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
    name: TOOL_NAMES.logInteraction,
    description:
      'Deja constancia de la conversación actual en el registro externo. Úsala solo cuando la persona pida expresamente guardar, registrar o anotar lo que se ha hablado.',
    parameters: logInteractionParameters
  }
];
