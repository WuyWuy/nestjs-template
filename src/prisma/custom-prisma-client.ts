//Document cho thang nao noi t xai AI: https://medium.com/@erciliomarquesmanhica/implementing-soft-delete-in-prisma-using-client-extensions-a-step-by-step-guide-for-nestjs-51a9d0716831

import { Prisma, PrismaClient } from '@prisma/client';
import {
    filterSoftDeleted,
    softDelete,
    softDeleteMany,
} from './prisma.extension';

//function to give us a prismaClient with extensions we want
export const customPrismaClient = (prismaClient: PrismaClient) => {
    return prismaClient
        .$extends(softDelete) //here we add our created extensions
        .$extends(softDeleteMany)
        .$extends(filterSoftDeleted);
};

//Our Custom Prisma Client with the client set to the customPrismaClient with extension
export class PrismaClientExtended extends PrismaClient {
    customPrismaClient: CustomPrismaClient;

    get client() {
        if (!this.customPrismaClient)
            this.customPrismaClient = customPrismaClient(this);

        return this.customPrismaClient;
    }

    async transaction<T>(
        fn: (tx: TransactionClientExtended) => Promise<T>,
        options?: {
            maxWait?: number;
            timeout?: number;
            isolationLevel?: Prisma.TransactionIsolationLevel;
        },
    ): Promise<T> {
        return await this.client.$transaction(
            async (tx) => await fn(tx as TransactionClientExtended),
            options,
        );
    }
}

//Create a type to our funtion
export type CustomPrismaClient = ReturnType<typeof customPrismaClient>;
export type TransactionClientExtended = Omit<
    CustomPrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
