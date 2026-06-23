jest.mock('@prisma/client', () => ({
    Prisma: {
        defineExtension: jest.fn((extension) => extension),
        getExtensionContext: jest.fn(),
        TransactionIsolationLevel: {},
    },
    PrismaClient: class {
        $extends() {
            return this;
        }
    },
}));

import { AuditService } from './audit.service';

describe('AuditService', () => {
    let service: AuditService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            auditLog: {
                create: jest.fn(),
            },
        };

        service = new AuditService(prismaService);
    });

    it('should create an audit log with provided actor, entity and metadata', async () => {
        const createdLog = {
            id: 1,
            action: 'ADMIN_UPDATE_ADDRESS',
            entityType: 'Address',
            entityId: 10,
            actorId: 99,
            metadata: {
                before: { title: 'Home' },
                after: { title: 'Office' },
            },
        };
        prismaService.auditLog.create.mockResolvedValueOnce(createdLog);

        const result = await service.log(
            'ADMIN_UPDATE_ADDRESS',
            'Address',
            10,
            99,
            {
                before: { title: 'Home' },
                after: { title: 'Office' },
            },
        );

        expect(prismaService.auditLog.create).toHaveBeenCalledWith({
            data: {
                actorId: 99,
                action: 'ADMIN_UPDATE_ADDRESS',
                entityType: 'Address',
                entityId: 10,
                metadata: {
                    before: { title: 'Home' },
                    after: { title: 'Office' },
                },
            },
        });
        expect(result).toEqual(createdLog);
    });

    it('should default missing actorId and entityId to null', async () => {
        prismaService.auditLog.create.mockResolvedValueOnce({ id: 1 });

        await service.log('ADMIN_VIEW_DASHBOARD', 'Dashboard');

        expect(prismaService.auditLog.create).toHaveBeenCalledWith({
            data: {
                actorId: null,
                action: 'ADMIN_VIEW_DASHBOARD',
                entityType: 'Dashboard',
                entityId: null,
                metadata: undefined,
            },
        });
    });

    it('should keep metadata undefined when metadata is not provided', async () => {
        prismaService.auditLog.create.mockResolvedValueOnce({ id: 1 });

        await service.log('ADMIN_VIEW_REVENUE', 'Revenue', null, 99);

        expect(prismaService.auditLog.create).toHaveBeenCalledWith({
            data: {
                actorId: 99,
                action: 'ADMIN_VIEW_REVENUE',
                entityType: 'Revenue',
                entityId: null,
                metadata: undefined,
            },
        });
    });

    it('should serialize metadata before writing it', async () => {
        const metadata = {
            when: new Date('2026-06-23T00:00:00.000Z'),
            nested: {
                keep: true,
                remove: undefined,
            },
        };
        prismaService.auditLog.create.mockResolvedValueOnce({ id: 1 });

        await service.log('ADMIN_TEST', 'Entity', 5, 99, metadata);

        expect(prismaService.auditLog.create).toHaveBeenCalledWith({
            data: {
                actorId: 99,
                action: 'ADMIN_TEST',
                entityType: 'Entity',
                entityId: 5,
                metadata: {
                    when: '2026-06-23T00:00:00.000Z',
                    nested: {
                        keep: true,
                    },
                },
            },
        });
        expect(metadata.nested).toHaveProperty('remove', undefined);
    });

    it('should write through the provided transaction client', async () => {
        const tx = {
            auditLog: {
                create: jest.fn().mockResolvedValue({ id: 2 }),
            },
        };

        const result = await service.log(
            'ADMIN_DELETE_ADDRESS',
            'Address',
            10,
            99,
            { reason: 'cleanup' },
            tx as any,
        );

        expect(tx.auditLog.create).toHaveBeenCalledWith({
            data: {
                actorId: 99,
                action: 'ADMIN_DELETE_ADDRESS',
                entityType: 'Address',
                entityId: 10,
                metadata: {
                    reason: 'cleanup',
                },
            },
        });
        expect(prismaService.auditLog.create).not.toHaveBeenCalled();
        expect(result).toEqual({ id: 2 });
    });
});
