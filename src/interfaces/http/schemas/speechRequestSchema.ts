import { z } from 'zod';
import { MAX_SPEECH_TEXT_LENGTH, MIN_SPEECH_TEXT_LENGTH } from '../../../domain/constants';

const textLengthMessage = `El campo text debe tener entre ${MIN_SPEECH_TEXT_LENGTH} y ${MAX_SPEECH_TEXT_LENGTH} caracteres.`;

export const speechRequestSchema = z
  .object(
    {
      text: z
        .string({
          required_error: 'El campo text es obligatorio.',
          invalid_type_error: 'El campo text debe ser texto.'
        })
        .trim()
        .min(MIN_SPEECH_TEXT_LENGTH, textLengthMessage)
        .max(MAX_SPEECH_TEXT_LENGTH, textLengthMessage)
    },
    {
      required_error: 'El cuerpo de la petición es obligatorio.',
      invalid_type_error: 'El cuerpo de la petición debe ser un objeto JSON válido.'
    }
  )
  .strict('El cuerpo de la petición solo admite el campo text.');

export type SpeechRequest = z.infer<typeof speechRequestSchema>;
