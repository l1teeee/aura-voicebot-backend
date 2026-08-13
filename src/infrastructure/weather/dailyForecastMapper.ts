import type { DailyForecast, TemperatureUnits, WeatherForecast } from '../../domain/ports/WeatherProvider';
import { MAX_FORECAST_DAYS } from '../constants';
import type { OpenWeatherForecast, OpenWeatherForecastEntry } from './openWeatherForecastSchema';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_DAY = 86400;
const DAY_KEY_LENGTH = 10;
const PROBABILITY_TO_PERCENTAGE = 100;
const NO_PRECIPITATION = 0;
const TODAY_LABEL = 'hoy';
const TOMORROW_LABEL = 'mañana';
const WEEKDAY_LOCALE = 'es-ES';
const WEEKDAY_OPTIONS: Intl.DateTimeFormatOptions = { weekday: 'long', timeZone: 'UTC' };

interface DayAccumulator {
  readonly date: string;
  readonly weekdayLabel: string;
  minTemperature: number;
  maxTemperature: number;
  precipitationChance: number;
  readonly descriptionCounts: Map<string, number>;
}

const toLocalDate = (utcSeconds: number, timezoneOffsetSeconds: number): Date =>
  new Date((utcSeconds + timezoneOffsetSeconds) * MILLISECONDS_PER_SECOND);

const toDayKey = (localDate: Date): string => localDate.toISOString().slice(0, DAY_KEY_LENGTH);

const toWeekdayLabel = (localDate: Date): string =>
  localDate.toLocaleDateString(WEEKDAY_LOCALE, WEEKDAY_OPTIONS);

const toPrecipitationChance = (entry: OpenWeatherForecastEntry): number =>
  Math.round((entry.pop ?? NO_PRECIPITATION) * PROBABILITY_TO_PERCENTAGE);

const mostFrequentDescription = (descriptionCounts: Map<string, number>): string => {
  let chosenDescription = '';
  let highestCount = 0;
  for (const [description, count] of descriptionCounts) {
    if (count > highestCount) {
      chosenDescription = description;
      highestCount = count;
    }
  }
  return chosenDescription;
};

const accumulateEntry = (accumulator: DayAccumulator, entry: OpenWeatherForecastEntry): void => {
  accumulator.minTemperature = Math.min(accumulator.minTemperature, entry.main.temp_min);
  accumulator.maxTemperature = Math.max(accumulator.maxTemperature, entry.main.temp_max);
  accumulator.precipitationChance = Math.max(
    accumulator.precipitationChance,
    toPrecipitationChance(entry)
  );
  const description = entry.weather[0].description;
  accumulator.descriptionCounts.set(
    description,
    (accumulator.descriptionCounts.get(description) ?? 0) + 1
  );
};

const startAccumulator = (date: string, weekdayLabel: string): DayAccumulator => ({
  date,
  weekdayLabel,
  minTemperature: Number.POSITIVE_INFINITY,
  maxTemperature: Number.NEGATIVE_INFINITY,
  precipitationChance: NO_PRECIPITATION,
  descriptionCounts: new Map<string, number>()
});

const groupByLocalDay = (payload: OpenWeatherForecast): DayAccumulator[] => {
  const daysByKey = new Map<string, DayAccumulator>();
  for (const entry of payload.list) {
    const localDate = toLocalDate(entry.dt, payload.city.timezone);
    const dayKey = toDayKey(localDate);
    const accumulator = daysByKey.get(dayKey) ?? startAccumulator(dayKey, toWeekdayLabel(localDate));
    accumulateEntry(accumulator, entry);
    daysByKey.set(dayKey, accumulator);
  }
  return Array.from(daysByKey.values());
};

const toDayLabel = (accumulator: DayAccumulator, todayKey: string, tomorrowKey: string): string => {
  if (accumulator.date === todayKey) {
    return TODAY_LABEL;
  }
  if (accumulator.date === tomorrowKey) {
    return TOMORROW_LABEL;
  }
  return accumulator.weekdayLabel;
};

const toDailyForecast = (
  accumulator: DayAccumulator,
  todayKey: string,
  tomorrowKey: string
): DailyForecast => ({
  date: accumulator.date,
  label: toDayLabel(accumulator, todayKey, tomorrowKey),
  minTemperature: Math.round(accumulator.minTemperature),
  maxTemperature: Math.round(accumulator.maxTemperature),
  description: mostFrequentDescription(accumulator.descriptionCounts),
  precipitationChance: accumulator.precipitationChance
});

export const toWeatherForecast = (
  payload: OpenWeatherForecast,
  units: TemperatureUnits,
  now: Date = new Date()
): WeatherForecast => {
  const nowSeconds = Math.floor(now.getTime() / MILLISECONDS_PER_SECOND);
  const todayKey = toDayKey(toLocalDate(nowSeconds, payload.city.timezone));
  const tomorrowKey = toDayKey(toLocalDate(nowSeconds + SECONDS_PER_DAY, payload.city.timezone));

  return {
    city: payload.city.name,
    country: payload.city.country,
    units,
    days: groupByLocalDay(payload)
      .slice(0, MAX_FORECAST_DAYS)
      .map((accumulator) => toDailyForecast(accumulator, todayKey, tomorrowKey))
  };
};
