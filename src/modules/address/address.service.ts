import { Injectable } from '@nestjs/common';
import { CreateAddressDto } from './dto/address.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionClientExtended } from '@/prisma/custom-prisma-client';

@Injectable()
export class AddressService {
    constructor(private readonly prismaService: PrismaService) {}
    private readonly locationTolerance = 0.000001;

    async findAddress(
        address: CreateAddressDto,
        db: TransactionClientExtended | PrismaService = this.prismaService,
    ) {
        const existsAddress = await db.address.findFirst({
            where: {
                deleteAt: null,
                title: {
                    equals: address.title,
                    mode: 'insensitive',
                },
                latitude: {
                    gte: address.latitude - this.locationTolerance,
                    lte: address.latitude + this.locationTolerance,
                },
                longitude: {
                    gte: address.longitude - this.locationTolerance,
                    lte: address.longitude + this.locationTolerance,
                },
                fullText: address.fullText
                    ? {
                          equals: address.fullText,
                          mode: 'insensitive',
                      }
                    : undefined,
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
            console.log("creating address error: " , err) 
            throw err;
        }
    }
}
