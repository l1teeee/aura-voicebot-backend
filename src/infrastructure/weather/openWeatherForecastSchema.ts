import { z } from 'zod';

export const openWeatherForecastSchema = z.object({
  city: z.object({
    name: z.string(),
    country: z.string(),
    timezone: z.number()
  }),
  list: z
    .array(
      z.object({
        dt: z.number(),
        main: z.object({
          temp_min: z.number(),
          temp_max: z.number()
        }),
        weather: z
          .array(
            z.object({
              description: z.string()
            })
          )
          .nonempty(),
        pop: z.number().optional()
      })
    )
    .nonempty()
});

export type OpenWeatherForecast = z.infer<typeof openWeatherForecastSchema>;

export type OpenWeatherForecastEntry = OpenWeatherForecast['list'][number];
