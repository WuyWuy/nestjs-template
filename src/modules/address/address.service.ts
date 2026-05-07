import { Injectable } from '@nestjs/common';
import { CreateAddressDto } from './dto/address.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionClientExtended } from '@/prisma/custom-prisma-client';

@Injectable()
export class AddressService {
    constructor(private readonly prismaService: PrismaService) {}

    async findAddress(
        address: CreateAddressDto,
        db: TransactionClientExtended | PrismaService = this.prismaService,
    ) {
        const existsAddress = await db.address.findFirst({
            where: {
                title: address.title,
                fullText: address.fullText,
                longitude: {
                    gte: address.longitude - 0.0001,
                    lte: address.longitude + 0.0001,
                },
                latitude: {
                    gte: address.latitude - 0.0001,
                    lte: address.latitude + 0.0001,
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
            const existsAddress = await this.findAddress(address, db);
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
