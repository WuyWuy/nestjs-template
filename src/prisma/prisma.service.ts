import { Injectable, OnModuleInit } from '@nestjs/common';
// import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClientExtended } from './custom-prisma-client';

@Injectable()
export class PrismaService extends PrismaClientExtended implements OnModuleInit {
    constructor() {
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL,
        });
        super({ adapter });
    }
    async onModuleInit() {
        await this.$connect();
    }
}
