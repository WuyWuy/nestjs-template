import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    // BadRequestException,
    Injectable,
    // UnauthorizedException,
} from '@nestjs/common';
// import { RegisterData } from './dto/auth.dto';
// import { Role, TokenType } from '@prisma/client';
// import { JwtService } from '@nestjs/jwt';
// import { ConfigService } from '@nestjs/config';
// import { TokenBody } from '@/bases/commons/enums/token.enum';
import { TwilioService } from '../twilio/twilio.service';
import { RegisterData } from './dto/auth.dto';
import { OTPType, Role } from '@prisma/client';
import { generateOtp } from '@/utilis/ranomOtp';
import { VERIFY_OTP_LIVE_TIME } from '@/bases/commons/constants/auth.constant';
import { hashing } from '@/utilis/sha256';

@Injectable()
export class AuthService {
    //this is the simple Authentication. You can config it to suitable for your job
    constructor(
        private readonly prismaService: PrismaService,
        // private readonly jwtService: JwtService,
        // private readonly configService: ConfigService,
        private readonly twilioService: TwilioService,
    ) {}
    async validateUser(email: string, password: string) {
        //Ham validate user dung de validate nguoi dung khi ho dang nhap
        const user = await this.prismaService.user.findFirst({
            where: { email },
        });
        if (user) {
            const results = await Bun.password.verify(password, user.password);
            if (results) return user;
            return null;
        }
        return null;
    }
    async register(registerData : RegisterData) 
    {
        try 
        {
            const results = await this.prismaService.$transaction(async (tx) => {
                let user = await tx.user.findFirst({
                    where: {
                        deleteAt: null, 
                        OR: [
                            {
                                phone : registerData.phone
                            }, {
                                email : registerData.email 
                            }
                        ]
                    }
                })
                if (user && user.active) 
                    throw new BadRequestException("Use has been register. Please login") 
                if (!user) {
                    const hashedPassword = await Bun.password.hash(registerData.password , {
                        cost : 10, 
                        algorithm : 'bcrypt'
                    })
                    user = await tx.user.create({
                        data : {
                            active : false, 
                            name : registerData.name, 
                            email : registerData.email, 
                            birthday : new Date(registerData.birthday), 
                            password : hashedPassword, 
                            addressId : registerData.addressId as number, 
                            phone : registerData.phone 
                        }
                    })
                }
                //Create otp 
                //Drop any otp related to the user 
                await tx.oTP.deleteMany({
                    where: {
                        userId : user.id, 
                        type : OTPType.VERIFY_OTP //Use for verify register 
                    }
                }) 
                const otp = generateOtp() 
                await tx.oTP.create({
                    data : {
                        otp : hashing(otp), 
                        userId : user.id, 
                        type : OTPType.VERIFY_OTP, 
                        expiresAt : new Date(Date.now() + VERIFY_OTP_LIVE_TIME)
                    }
                })
                //Creating Role 
                await tx.userRole.create({
                    data: {
                        userId : user.id, 
                        role : Role.CUSTOMER //Default is the customer 
                    }
                })
                return {
                    otp, 
                    id : user.id, 
                    birthday : user.birthday, 
                    name : user.name, 
                    phone : user.phone, 
                    email : user.email, 
                }
            })
            return results
        } 
        catch (err) 
        {
            console.log("Register Error: " , err) 
            throw err 
        }
    }

}
