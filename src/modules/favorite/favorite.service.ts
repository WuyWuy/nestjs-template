import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FavoriteService {
    constructor(private readonly prismaService: PrismaService) {}
}
