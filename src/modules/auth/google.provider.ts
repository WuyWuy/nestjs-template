import { OAuth2Client } from 'google-auth-library'

export const GoogleOauthProvider =  {
    provide: 'GOOGLE_OAUTH_CLIENT', 
    useFactory: () => {
        return new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID
        ) 
    }
}