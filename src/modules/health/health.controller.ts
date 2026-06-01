import { Controller, Get } from "@nestjs/common";

@Controller("health") 
export class HealthController 
{
    @Get("/liveness") 
    async liveness()  
    {
        return "Server is running. Build with Cloudian 💙 Cloud"
    } 
    @Get("readness") 
    async readness() 
    {
        return "Server testing successfully" 
    }
}