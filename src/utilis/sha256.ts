import crypto from 'crypto';

export const hashing = (str: string) => {
    return crypto.createHash('sha256').update(str).digest('hex');
};

export const compareHash = (str: string, hashedStr: string) => {
    if (hashing(str) === hashedStr) {
        return true;
    }
    return false;
};
