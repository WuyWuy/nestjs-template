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
    console.log("partnerCode"  , partnerCode) 
    console.log("accessKey " , accessKey) 
    console.log("secretKey" , secretKey)
    
    var requestId = partnerCode + new Date().getTime();
    var orderId = requestId + "-" + order 
    var orderInfo = 'Pay order with Momo';
    var redirectUrl = 'https://momo.vn/return'; //Url momo se return ve sau khi thanh toan thanh cong
    var ipnUrl = 'http://localhost:4000/api/payment/check-payment'; //Url ma Momo se goi ve ben backend de tien hanh cap nhat database sau khi thanh toan thanh cong
    // var ipnUrl = redirectUrl = "https://webhook.site/454e7b77-f177-4ece-8236-ddf1c26ba7f8";
    var amount = money.toString()
    var requestType = 'captureWallet';
    var extraData = ''; //pass empty value if your merchant does not have stores
    var rawSignature =
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
    var signature = crypto
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
        'https://test-payment.momo.vn/v2/gateway/api/create', requestBody , {
            headers: {
                'Content-Type' : 'application/json'
            }
        }
    );
    // console.log(response) 
    return response.data.payUrl 
}
