import { z } from 'zod';
import {
  MAX_USER_MESSAGE_LENGTH,
  MIN_USER_MESSAGE_LENGTH,
  UUID_V4_PATTERN
} from '../../../domain/constants';

export const chatRequestSchema = z
  .object(
    {
      message: z
        .string({
          required_error: 'El campo message es obligatorio.',
          invalid_type_error: 'El campo message debe ser texto.'
        })
        .trim()
        .min(
          MIN_USER_MESSAGE_LENGTH,
          `El campo message no puede estar vacío y debe tener al menos ${MIN_USER_MESSAGE_LENGTH} carácter.`
        )
        .max(
          MAX_USER_MESSAGE_LENGTH,
          `El campo message no puede superar los ${MAX_USER_MESSAGE_LENGTH} caracteres.`
        ),
      sessionId: z
        .string({
          required_error: 'El campo sessionId es obligatorio.',
          invalid_type_error: 'El campo sessionId debe ser texto.'
        })
        .regex(UUID_V4_PATTERN, 'El campo sessionId debe ser un identificador UUID v4 válido.')
    },
    {
      required_error: 'El cuerpo de la petición es obligatorio.',
      invalid_type_error: 'El cuerpo de la petición debe ser un objeto JSON válido.'
    }
  )
  .strict('El cuerpo de la petición solo admite los campos message y sessionId.');

export type ChatRequest = z.infer<typeof chatRequestSchema>;
