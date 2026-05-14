import { Injectable } from '@nestjs/common';
import admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';

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

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
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
