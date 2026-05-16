import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';

@Injectable()
export class MinioService implements OnModuleInit {
    private minioClient: Minio.Client;
    private bucketName: string;
    constructor(private readonly configService: ConfigService) {
        this.minioClient = new Minio.Client({
            endPoint: this.configService.get('MINIO_ENDPOINT') as string,
            port: Number(this.configService.get('MINIO_PORT')),
            useSSL: this.configService.get('MINIO_USE_SSL') === 'true',
            accessKey: this.configService.get('MINIO_ACCESS_KEY'),
            secretKey: this.configService.get('MINIO_SECRET_KEY'),
        });
        this.bucketName = this.configService.get('MINIO_BUCKET') as string;
    }
    // IMPORTANT:
    // - Environment variables expected:
    //   MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_USE_SSL
    // - Bucket auto-creation: onModuleInit will attempt to create the configured
    //   bucket if it does not exist. In production you may prefer to provision
    //   the bucket ahead of time and remove auto-create behavior.
    // - Errors during bucket creation are logged but do not crash the app.
    async onModuleInit() {
        try {
            await this.createBucketIfNotExists();
        } catch (err) {
            // don't crash the whole app on bucket creation failure, just log
            console.error('Minio bucket check/create failed:', err?.message || err);
        }
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
        return fileName;
    }
    extractFileNameFromUrl(url: string): string {
        return url.split('/').pop() as string;
    }
    async getFileUrl(fileName: string) {
        // const fileName = this.extractFileNameFromUrl(fileUrl);
        return await this.minioClient.presignedUrl(
            'GET',
            this.bucketName,
            fileName,
        );
    }
    async deleteFile(fileName: string) {
        // const fileName = this.extractFileNameFromUrl(fileUrl);
        await this.minioClient.removeObject(this.bucketName, fileName);
    }
}
