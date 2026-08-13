import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AddFavoriteCityUseCase } from '../../../application/use-cases/AddFavoriteCityUseCase';
import { ListFavoriteCitiesUseCase } from '../../../application/use-cases/ListFavoriteCitiesUseCase';
import { RemoveFavoriteCityUseCase } from '../../../application/use-cases/RemoveFavoriteCityUseCase';
import { HTTP_STATUS } from '../constants';
import {
  FavoriteCityIdParams,
  FavoriteCityUserIdParams
} from '../schemas/favoriteCityParamsSchema';
import { FavoriteCityRequest } from '../schemas/favoriteCityRequestSchema';

export class FavoriteCityController {
  constructor(
    private readonly addFavoriteCity: AddFavoriteCityUseCase,
    private readonly listFavoriteCities: ListFavoriteCitiesUseCase,
    private readonly removeFavoriteCity: RemoveFavoriteCityUseCase
  ) {}

  readonly add: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId, city } = req.body as FavoriteCityRequest;
      const output = await this.addFavoriteCity.execute({ userId, city });

      res.status(HTTP_STATUS.created).json(output);
    } catch (error) {
      next(error);
    }
  };

  readonly list: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params as FavoriteCityUserIdParams;
      const output = await this.listFavoriteCities.execute({ userId });

      res.status(HTTP_STATUS.ok).json(output);
    } catch (error) {
      next(error);
    }
  };

  readonly remove: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params as FavoriteCityIdParams;

      await this.removeFavoriteCity.execute({ id });
      res.status(HTTP_STATUS.noContent).send();
    } catch (error) {
      next(error);
    }
  };
}
