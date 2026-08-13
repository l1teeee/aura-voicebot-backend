import { z } from 'zod';

import {
  MAX_FAVORITE_CITY_NAME_LENGTH,
  MIN_FAVORITE_CITY_NAME_LENGTH
} from '../../domain/constants';

import {
  DEFAULT_TEMPERATURE_UNITS,
  MAX_CITY_NAME_LENGTH,
  MAX_INTERACTION_SUMMARY_LENGTH,
  MIN_TOOL_ARGUMENT_LENGTH,
  TEMPERATURE_UNIT_VALUES
} from '../constants';

export const weatherToolArgumentsSchema = z.object({
  city: z.string().trim().min(MIN_TOOL_ARGUMENT_LENGTH).max(MAX_CITY_NAME_LENGTH),
  units: z.enum(TEMPERATURE_UNIT_VALUES).default(DEFAULT_TEMPERATURE_UNITS)
});

export type WeatherToolArguments = z.infer<typeof weatherToolArgumentsSchema>;

export const forecastToolArgumentsSchema = weatherToolArgumentsSchema;

export type ForecastToolArguments = z.infer<typeof forecastToolArgumentsSchema>;

export const addFavoriteCityToolArgumentsSchema = z.object({
  city: z
    .string()
    .trim()
    .min(MIN_FAVORITE_CITY_NAME_LENGTH)
    .max(MAX_FAVORITE_CITY_NAME_LENGTH)
});

export type AddFavoriteCityToolArguments = z.infer<
  typeof addFavoriteCityToolArgumentsSchema
>;

export const listFavoriteCitiesToolArgumentsSchema = z.object({}).strict();

export type ListFavoriteCitiesToolArguments = z.infer<
  typeof listFavoriteCitiesToolArgumentsSchema
>;

export const logInteractionToolArgumentsSchema = z.object({
  summary: z.string().trim().min(MIN_TOOL_ARGUMENT_LENGTH).max(MAX_INTERACTION_SUMMARY_LENGTH)
});

export type LogInteractionToolArguments = z.infer<typeof logInteractionToolArgumentsSchema>;
