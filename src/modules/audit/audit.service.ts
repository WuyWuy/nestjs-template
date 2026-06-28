import { Injectable } from '@nestjs/common';
import { TransactionClientExtended } from '@/prisma/custom-prisma-client';
import { PrismaService } from '@/prisma/prisma.service';

type AuditClient = PrismaService | TransactionClientExtended;

@Injectable()
export class AuditService {
    constructor(private readonly prismaService: PrismaService) {}

    async log(
        action: string,
        entityType: string,
        entityId?: number | null,
        actorId?: number | null,
        metadata?: unknown,
        db: AuditClient = this.prismaService,
    ) {
        return await db.auditLog.create({
            data: {
                actorId: actorId ?? null,
                action,
                entityType,
                entityId: entityId ?? null,
                metadata:
                    metadata === undefined
                        ? undefined
                        : JSON.parse(JSON.stringify(metadata)),
            },
        });
    }
}
