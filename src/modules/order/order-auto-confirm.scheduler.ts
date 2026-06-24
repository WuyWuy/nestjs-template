import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from './order.service';

@Injectable()
export class OrderAutoConfirmScheduler {
    private readonly logger = new Logger(OrderAutoConfirmScheduler.name);

    constructor(private readonly orderService: OrderService) {}

    @Cron(CronExpression.EVERY_HOUR)
    async handleAutoConfirm() {
        const count = await this.orderService.autoConfirmStaleOrders();
        if (count > 0) {
            this.logger.log(`Auto-confirmed ${count} delivered order(s)`);
        }
    }
}
