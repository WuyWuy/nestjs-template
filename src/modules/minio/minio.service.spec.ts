const mockMinioClient = {
    bucketExists: jest.fn(),
    makeBucket: jest.fn(),
    putObject: jest.fn(),
    removeObject: jest.fn(),
};

jest.mock('minio', () => ({
    Client: jest.fn(() => mockMinioClient),
}));

import * as Minio from 'minio';
import { MinioService } from './minio.service';

describe('MinioService', () => {
    let service: MinioService;
    let configService: { get: jest.Mock; getOrThrow: jest.Mock };

    const createService = (
        overrides: Record<string, string | undefined> = {},
    ) => {
        const values: Record<string, string | undefined> = {
            MINIO_ENDPOINT: 'localhost',
            MINIO_PORT: '9000',
            MINIO_USE_SSL: 'false',
            MINIO_ACCESS_KEY: 'minio',
            MINIO_SECRET_KEY: 'password',
            MINIO_BUCKET: 'uploads',
            MINIO_PUBLIC_URL: undefined,
            ...overrides,
        };

        configService = {
            get: jest.fn((key: string) => values[key]),
            getOrThrow: jest.fn((key: string) => {
                const value = values[key];
                if (value === undefined) {
                    throw new Error(`Missing config: ${key}`);
                }
                return value;
            }),
        };

        return new MinioService(configService as any);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        service = createService();
    });

    it('should configure Minio client from config values', () => {
        expect(Minio.Client).toHaveBeenCalledWith({
            endPoint: 'localhost',
            port: 9000,
            useSSL: false,
            accessKey: 'minio',
            secretKey: 'password',
        });
    });

    it('should create bucket when it does not exist', async () => {
        mockMinioClient.bucketExists.mockResolvedValueOnce(false);
        mockMinioClient.makeBucket.mockResolvedValueOnce(undefined);

        await service.createBucketIfNotExists();

        expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('uploads');
        expect(mockMinioClient.makeBucket).toHaveBeenCalledWith(
            'uploads',
            'eu-west-1',
        );
    });

    it('should not create bucket when it already exists', async () => {
        mockMinioClient.bucketExists.mockResolvedValueOnce(true);

        await service.createBucketIfNotExists();

        expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('uploads');
        expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('should upload file and return public file url', async () => {
        jest.spyOn(Date, 'now').mockReturnValueOnce(1719100000000);
        mockMinioClient.putObject.mockResolvedValueOnce(undefined);
        const file = {
            originalname: 'avatar.png',
            buffer: Buffer.from('image'),
            size: 5,
            mimetype: 'image/png',
        };

        const result = await service.uploadFile(file as any);

        expect(mockMinioClient.putObject).toHaveBeenCalledWith(
            'uploads',
            '1719100000000-avatar.png',
            file.buffer,
            5,
            {
                'Content-Type': 'image/png',
            },
        );
        expect(result).toBe(
            'http://localhost:9000/uploads/1719100000000-avatar.png',
        );
    });

    it('should use configured public url without trailing slashes', () => {
        service = createService({
            MINIO_PUBLIC_URL: 'https://cdn.example.com///',
        });

        expect(service.buildPublicFileUrl('avatar.png')).toBe(
            'https://cdn.example.com/uploads/avatar.png',
        );
    });

    it('should build https public url when SSL is enabled and no public url is configured', () => {
        service = createService({
            MINIO_USE_SSL: 'true',
        });

        expect(service.buildPublicFileUrl('avatar.png')).toBe(
            'https://localhost:9000/uploads/avatar.png',
        );
    });

    it('should extract empty file name from empty input', () => {
        expect(service.extractFileNameFromUrl('')).toBe('');
    });

    it('should keep plain object names unchanged when extracting file name', () => {
        expect(service.extractFileNameFromUrl('folder/avatar.png')).toBe(
            'folder/avatar.png',
        );
    });

    it('should extract object name from url containing bucket name', () => {
        expect(
            service.extractFileNameFromUrl(
                'https://cdn.example.com/uploads/folder/avatar.png',
            ),
        ).toBe('folder/avatar.png');
    });

    it('should extract path from url without bucket prefix', () => {
        expect(
            service.extractFileNameFromUrl(
                'https://cdn.example.com/public/avatar.png',
            ),
        ).toBe('public/avatar.png');
    });

    it('should return empty url for empty file name', async () => {
        await expect(service.getFileUrl('')).resolves.toBe('');
    });

    it('should return absolute urls unchanged', async () => {
        await expect(
            service.getFileUrl('https://cdn.example.com/avatar.png'),
        ).resolves.toBe('https://cdn.example.com/avatar.png');
    });

    it('should build public url for object names', async () => {
        await expect(service.getFileUrl('avatar.png')).resolves.toBe(
            'http://localhost:9000/uploads/avatar.png',
        );
    });

    it('should delete file using extracted object name', async () => {
        mockMinioClient.removeObject.mockResolvedValueOnce(undefined);

        await service.deleteFile('https://cdn.example.com/uploads/avatar.png');

        expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
            'uploads',
            'avatar.png',
        );
    });
});
