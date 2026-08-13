import { z } from 'zod';

export const openWeatherResponseSchema = z.object({
  name: z.string(),
  sys: z.object({
    country: z.string()
  }),
  main: z.object({
    temp: z.number(),
    feels_like: z.number(),
    humidity: z.number()
  }),
  weather: z
    .array(
      z.object({
        description: z.string()
      })
    )
    .nonempty()
});

export type OpenWeatherResponse = z.infer<typeof openWeatherResponseSchema>;
