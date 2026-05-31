import { Injectable } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';

@Injectable()
export class MinioService {
    private minioClient: Minio.Client;
    private bucketName: string;
    private publicBaseUrl: string;
    constructor(private readonly configService: ConfigService) {
        const endPoint = this.configService.get('MINIO_ENDPOINT') as string;
        const port = Number(this.configService.get('MINIO_PORT'));
        const useSSL = this.configService.get('MINIO_USE_SSL') === 'true';
        const configuredPublicUrl = this.configService.get<string>(
            'MINIO_PUBLIC_URL',
        );

        this.minioClient = new Minio.Client({
            endPoint,
            port,
            useSSL,
            accessKey: this.configService.get('MINIO_ACCESS_KEY'),
            secretKey: this.configService.get('MINIO_SECRET_KEY'),
        });
        this.bucketName = this.configService.get('MINIO_BUCKET') as string;
        this.publicBaseUrl = (
            configuredPublicUrl || `${useSSL ? 'https' : 'http'}://${endPoint}:${port}`
        ).replace(/\/+$/, '');
    }
    async createBucketIfNotExists() {
        const bucketExists = await this.minioClient.bucketExists(
            this.bucketName,
        );
        if (!bucketExists) {
            await this.minioClient.makeBucket(this.bucketName, 'eu-west-1');
        }
    }
    async uploadFile(file: Express.Multer.File) {
        const fileName = `${Date.now()}-${file.originalname}`;
        await this.minioClient.putObject(
            this.bucketName,
            fileName,
            file.buffer,
            file.size,
        );
        return this.buildPublicFileUrl(fileName);
    }
    extractFileNameFromUrl(url: string): string {
        if (!url) return '';
        if (!/^https?:\/\//i.test(url)) return url;

        try {
            const parsedUrl = new URL(url);
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            if (pathParts[0] === this.bucketName) {
                return pathParts.slice(1).join('/');
            }
            return pathParts.join('/');
        } catch {
            return url.split('/').pop() as string;
        }
    }
    buildPublicFileUrl(fileName: string) {
        return `${this.publicBaseUrl}/${this.bucketName}/${fileName}`;
    }
    async getFileUrl(fileName: string) {
        if (!fileName) return '';
        if (/^https?:\/\//i.test(fileName)) return fileName;
        return this.buildPublicFileUrl(fileName);
    }
    async deleteFile(fileName: string) {
        const objectName = this.extractFileNameFromUrl(fileName);
        await this.minioClient.removeObject(this.bucketName, objectName);
    }
}
