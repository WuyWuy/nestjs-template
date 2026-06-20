import { Injectable } from '@nestjs/common';
import admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class FirebaseService {
    constructor() {
        let serviceAccount: ServiceAccount;

        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            };
        } else {
            try {
                // Fallback to firebase-credential.json at project root
                // Map fields from snake_case to camelCase expected by firebase-admin
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const cred = require(process.cwd() + '/firebase-credential.json');
                serviceAccount = {
                    projectId: cred.project_id,
                    clientEmail: cred.client_email,
                    privateKey: cred.private_key,
                };
            } catch (err) {
                throw new Error('Firebase credentials not found in env or firebase-credential.json');
            }
        }

        if (
            serviceAccountFromEnv.projectId &&
            serviceAccountFromEnv.clientEmail &&
            serviceAccountFromEnv.privateKey
        ) {
            return serviceAccountFromEnv;
        }

        const credentialPath =
            process.env.FIREBASE_CREDENTIAL_PATH ||
            process.env.GOOGLE_APPLICATION_CREDENTIALS ||
            join(process.cwd(), 'firebase-credential.json');

        if (!existsSync(credentialPath)) {
            throw new Error(
                'Firebase credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY, or provide firebase-credential.json in the container.',
            );
        }

        const rawCredential = readFileSync(credentialPath, 'utf8');
        const parsedCredential = JSON.parse(rawCredential) as {
            project_id?: string;
            client_email?: string;
            private_key?: string;
        };

        if (
            !parsedCredential.project_id ||
            !parsedCredential.client_email ||
            !parsedCredential.private_key
        ) {
            throw new Error(
                `Firebase credential file at "${credentialPath}" is missing one of project_id, client_email, or private_key.`,
            );
        }

        return {
            projectId: parsedCredential.project_id,
            clientEmail: parsedCredential.client_email,
            privateKey: parsedCredential.private_key,
        };
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
