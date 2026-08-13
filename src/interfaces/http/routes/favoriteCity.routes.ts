import { Router } from 'express';
import { FavoriteCityController } from '../controllers/FavoriteCityController';
import { validateBody } from '../middlewares/validateBody';
import { validateParams } from '../middlewares/validateParams';
import {
  favoriteCityIdParamsSchema,
  favoriteCityUserIdParamsSchema
} from '../schemas/favoriteCityParamsSchema';
import { favoriteCityRequestSchema } from '../schemas/favoriteCityRequestSchema';

const FAVORITE_CITY_COLLECTION_ROUTE_PATH = '/';
const FAVORITE_CITY_USER_ROUTE_PATH = '/:userId';
const FAVORITE_CITY_ITEM_ROUTE_PATH = '/:id';

export const createFavoriteCityRouter = (controller: FavoriteCityController): Router => {
  const router = Router();

  router.post(
    FAVORITE_CITY_COLLECTION_ROUTE_PATH,
    validateBody(favoriteCityRequestSchema),
    controller.add
  );
  router.get(
    FAVORITE_CITY_USER_ROUTE_PATH,
    validateParams(favoriteCityUserIdParamsSchema),
    controller.list
  );
  router.delete(
    FAVORITE_CITY_ITEM_ROUTE_PATH,
    validateParams(favoriteCityIdParamsSchema),
    controller.remove
  );

  return router;
};
