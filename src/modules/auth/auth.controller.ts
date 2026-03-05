import { Controller, Get, Post, Query } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('register')
  async register() {}
  @Get('verify')
  async verify(@Query('token') token: String) {
    console.log(token) 
  }
  @Post('login')
  async login() {}
}
