import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}
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
}
