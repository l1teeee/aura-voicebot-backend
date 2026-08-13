import { z } from 'zod';
import {
  MAX_FAVORITE_CITY_NAME_LENGTH,
  MIN_FAVORITE_CITY_NAME_LENGTH,
  UUID_V4_PATTERN
} from '../../../domain/constants';
const cityLengthMessage =
  `El campo city debe tener entre ${MIN_FAVORITE_CITY_NAME_LENGTH} y ${MAX_FAVORITE_CITY_NAME_LENGTH} caracteres.`;

export const favoriteCityRequestSchema = z
  .object(
    {
      userId: z
        .string({
          required_error: 'El campo userId es obligatorio.',
          invalid_type_error: 'El campo userId debe ser texto.'
        })
        .regex(UUID_V4_PATTERN, 'El campo userId debe ser un identificador UUID v4 válido.'),
      city: z
        .string({
          required_error: 'El campo city es obligatorio.',
          invalid_type_error: 'El campo city debe ser texto.'
        })
        .trim()
        .min(MIN_FAVORITE_CITY_NAME_LENGTH, cityLengthMessage)
        .max(MAX_FAVORITE_CITY_NAME_LENGTH, cityLengthMessage)
    },
    {
      required_error: 'El cuerpo de la petición es obligatorio.',
      invalid_type_error: 'El cuerpo de la petición debe ser un objeto JSON válido.'
    }
  )
  .strict('El cuerpo de la petición solo admite los campos userId y city.');

export type FavoriteCityRequest = z.infer<typeof favoriteCityRequestSchema>;
