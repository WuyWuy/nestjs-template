import { IsString } from 'class-validator';

export class RegisterDeviceData {
    @IsString()
    deviceToken: string;
    @IsString()
    platform: string;
}
