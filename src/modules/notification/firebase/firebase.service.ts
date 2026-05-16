import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FirebaseService {
    constructor(private readonly configService: ConfigService) {
        const serviceAccountFromEnv: ServiceAccount = {
            projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
            clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
            privateKey: this.configService
                .get<string>('FIREBASE_PRIVATE_KEY')
                ?.replace(/\\n/g, '\n'),
        };

        const hasEnvCredential =
            !!serviceAccountFromEnv.projectId &&
            !!serviceAccountFromEnv.clientEmail &&
            !!serviceAccountFromEnv.privateKey;

        let serviceAccount: ServiceAccount;

        if (hasEnvCredential) {
            serviceAccount = serviceAccountFromEnv;
        } else {
            const credentialFile = join(process.cwd(), 'firebase-credential.json');
            try {
                const fileContents = readFileSync(credentialFile, 'utf-8');
                const json = JSON.parse(fileContents);
                serviceAccount = {
                    projectId: json.project_id,
                    clientEmail: json.client_email,
                    privateKey: json.private_key,
                };
            } catch (error) {
                throw new Error(
                    'Firebase credential is missing or invalid. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, or add firebase-credential.json.',
                );
            }
        }

        if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
            throw new Error(
                'Firebase service account object must contain projectId, clientEmail, and privateKey.',
            );
        }

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
    }

    async sendNotification(
        deviceToken: string,
        payload: admin.messaging.MessagingPayload,
    ) {
        try {
            await admin.messaging().send({
                token: deviceToken,
                notification: payload.notification,
                data: payload.data,
            });
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }
}
