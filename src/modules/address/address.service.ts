import { Injectable } from '@nestjs/common';
import { CreateAddressDto } from './dto/address.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionClientExtended } from '@/prisma/custom-prisma-client';

@Injectable()
export class AddressService {
    constructor(private readonly prismaService: PrismaService) {}

    async findAddress(
        longitude : number, 
        latitude :  number, 
        db: TransactionClientExtended | PrismaService = this.prismaService,
    ) {
        const existsAddress = await db.address.findFirst({
            where: {
                longitude: {
                    gte: longitude - 0.0001,
                    lte: longitude + 0.0001,
                },
                latitude: {
                    gte: latitude - 0.0001,
                    lte: latitude + 0.0001,
                },
            },
        });
        return existsAddress;
    }

    async createAddress(
        address: CreateAddressDto,
        db: TransactionClientExtended | PrismaService = this.prismaService,
    ) {
        try {
            const existsAddress = await this.findAddress(address.longitude , address.latitude, db);
            if (existsAddress) return existsAddress;

            const address1 = await db.address.create({
                data: {
                    ...address,
                },
            });
            return address1;
        } catch (err) {
            console.log('create address error', err);
            throw err;
        }
    }
}
