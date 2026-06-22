import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FavoriteService } from './favorite.service';

@ApiTags('17. Favorite')
@Controller()
export class FavoriteController {
    constructor(private readonly favoriteService: FavoriteService) {}
}
