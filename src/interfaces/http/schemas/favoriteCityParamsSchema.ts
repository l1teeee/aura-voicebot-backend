import { z } from 'zod';
import { UUID_V4_PATTERN } from '../../../domain/constants';

export const favoriteCityUserIdParamsSchema = z
  .object({
    userId: z
      .string({
        required_error: 'El parámetro userId es obligatorio.',
        invalid_type_error: 'El parámetro userId debe ser texto.'
      })
      .regex(UUID_V4_PATTERN, 'El parámetro userId debe ser un identificador UUID v4 válido.')
  })
  .strict();

export type FavoriteCityUserIdParams = z.infer<typeof favoriteCityUserIdParamsSchema>;

export const favoriteCityIdParamsSchema = z
  .object({
    id: z
      .string({
        required_error: 'El parámetro id es obligatorio.',
        invalid_type_error: 'El parámetro id debe ser texto.'
      })
      .regex(UUID_V4_PATTERN, 'El parámetro id debe ser un identificador UUID v4 válido.')
  })
  .strict();

export type FavoriteCityIdParams = z.infer<typeof favoriteCityIdParamsSchema>;
