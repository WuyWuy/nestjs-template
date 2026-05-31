import { Prisma } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';
export async function getMomoPayUrl(
    partnerCode: string,
    accessKey: string,
    secretKey: string,
    money: Prisma.Decimal | number,
    order: number,
) {
    const requestId = partnerCode + new Date().getTime();
    const orderId = requestId + '-' + order;
    const orderInfo = 'Pay order with Momo';
    const redirectUrl = 'https://momo.vn/return';
    const ipnUrl = 'http://localhost:4000/api/payment/check-payment';
    const amount = money.toString();
    const requestType = 'captureWallet';
    const extraData = '';
    const rawSignature =
        'accessKey=' +
        accessKey +
        '&amount=' +
        amount +
        '&extraData=' +
        extraData +
        '&ipnUrl=' +
        ipnUrl +
        '&orderId=' +
        orderId +
        '&orderInfo=' +
        orderInfo +
        '&partnerCode=' +
        partnerCode +
        '&redirectUrl=' +
        redirectUrl +
        '&requestId=' +
        requestId +
        '&requestType=' +
        requestType;
    const signature = crypto
        .createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');
    const requestBody = JSON.stringify({
        partnerCode: partnerCode,
        accessKey: accessKey,
        requestId: requestId,
        amount: amount,
        orderId: orderId,
        orderInfo: orderInfo,
        redirectUrl: redirectUrl,
        ipnUrl: ipnUrl,
        extraData: extraData,
        requestType: requestType,
        signature: signature,
        lang: 'en',
    });
    const response = await axios.post(
        'https://test-payment.momo.vn/v2/gateway/api/create',
        requestBody,
        {
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    return response.data;
}
