import { z } from 'zod';
import { MAX_USER_NAME_LENGTH, MIN_USER_NAME_LENGTH } from '../../../domain/constants';

const nameLengthMessage = `El campo name debe tener entre ${MIN_USER_NAME_LENGTH} y ${MAX_USER_NAME_LENGTH} caracteres.`;

export const identifyUserRequestSchema = z
  .object(
    {
      name: z
        .string({
          required_error: 'El campo name es obligatorio.',
          invalid_type_error: 'El campo name debe ser texto.'
        })
        .trim()
        .min(MIN_USER_NAME_LENGTH, nameLengthMessage)
        .max(MAX_USER_NAME_LENGTH, nameLengthMessage)
    },
    {
      required_error: 'El cuerpo de la petición es obligatorio.',
      invalid_type_error: 'El cuerpo de la petición debe ser un objeto JSON válido.'
    }
  )
  .strict('El cuerpo de la petición solo admite el campo name.');

export type IdentifyUserRequest = z.infer<typeof identifyUserRequestSchema>;
