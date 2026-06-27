import {
    AuthProvider,
    ConfirmedBy,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Prisma,
    PrismaClient,
    RestaurantApprovalStatus,
    Role,
    VoucherStatus,
    VoucherType,
    NotificationType,
    DeliveryChannel,
} from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
    categories,
    foodIngredientLinks,
    ingredients,
} from './data/catalog';
import { seedImages } from './data/media-urls';

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
    }),
});

type DbClient = PrismaClient | Prisma.TransactionClient;

const now = new Date();
const oneDay = 24 * 60 * 60 * 1000;

const addresses = [
    {
        key: 'district-1',
        title: 'District 1 Hub',
        latitude: 10.776889,
        longitude: 106.700806,
        fullText: '123 Nguyen Hue, Ben Nghe Ward, District 1, Ho Chi Minh City',
    },
    {
        key: 'district-3',
        title: 'District 3 Home',
        latitude: 10.786749,
        longitude: 106.690529,
        fullText: '45 Vo Van Tan, Ward 6, District 3, Ho Chi Minh City',
    },
    {
        key: 'phu-nhuan',
        title: 'Phu Nhuan Office',
        latitude: 10.799055,
        longitude: 106.680168,
        fullText: '12 Hoang Van Thu, Ward 9, Phu Nhuan, Ho Chi Minh City',
    },
    {
        key: 'thu-duc',
        title: 'Thu Duc Stop',
        latitude: 10.845161,
        longitude: 106.794357,
        fullText: '99 Vo Van Ngan, Linh Chieu Ward, Thu Duc City',
    },
    {
        key: 'binh-thanh',
        title: 'Binh Thanh Corner',
        latitude: 10.808153,
        longitude: 106.709572,
        fullText: '18 Dien Bien Phu, Ward 15, Binh Thanh, Ho Chi Minh City',
    },
] as const;


const users = {
    admin: {
        name: 'Seed Admin',
        email: 'admin@seed.local',
        phone: '0900000001',
        password: 'admin123',
        birthday: '1994-01-10T00:00:00.000Z',
        roles: [Role.ADMIN],
        addressTitles: [{ addressKey: 'district-1', title: 'Admin Home' }],
    },
    business: {
        name: 'Seed Business',
        email: 'business@seed.local',
        phone: '0900000002',
        password: 'business123',
        birthday: '1992-06-20T00:00:00.000Z',
        roles: [Role.BUSINESS],
        addressTitles: [{ addressKey: 'phu-nhuan', title: 'Business HQ' }],
    },
    business2: {
        name: 'Seed Business Two',
        email: 'business2@seed.local',
        phone: '0900000005',
        password: 'business123',
        birthday: '1991-04-12T00:00:00.000Z',
        roles: [Role.BUSINESS],
        addressTitles: [{ addressKey: 'district-3', title: 'Business HQ' }],
    },
    business3: {
        name: 'Seed Business Three',
        email: 'business3@seed.local',
        phone: '0900000006',
        password: 'business123',
        birthday: '1990-11-08T00:00:00.000Z',
        roles: [Role.BUSINESS],
        addressTitles: [{ addressKey: 'thu-duc', title: 'Business HQ' }],
    },
    customer1: {
        name: 'Seed Customer One',
        email: 'customer1@seed.local',
        phone: '0900000003',
        password: 'customer123',
        birthday: '1998-03-15T00:00:00.000Z',
        roles: [Role.CUSTOMER],
        addressTitles: [
            { addressKey: 'district-3', title: 'Home' },
            { addressKey: 'binh-thanh', title: 'Office' },
        ],
    },
    customer2: {
        name: 'Seed Customer Two',
        email: 'customer2@seed.local',
        phone: '0900000004',
        password: 'customer456',
        birthday: '2000-09-08T00:00:00.000Z',
        roles: [Role.CUSTOMER],
        addressTitles: [{ addressKey: 'thu-duc', title: 'Home' }],
    },
} as const;

function getLocalProviderUserId(userId: number) {
    return `local:${userId}`;
}

async function hashPassword(password: string) {
    return await Bun.password.hash(password, {
        cost: 10,
        algorithm: 'bcrypt',
    });
}

async function upsertAddress(db: DbClient, data: (typeof addresses)[number]) {
    const existing = await db.address.findFirst({
        where: {
            fullText: data.fullText,
        },
    });

    if (existing) {
        return await db.address.update({
            where: { id: existing.id },
            data: {
                title: data.title,
                latitude: data.latitude,
                longitude: data.longitude,
                fullText: data.fullText,
                deleteAt: null,
            },
        });
    }

    return await db.address.create({
        data: {
            title: data.title,
            latitude: data.latitude,
            longitude: data.longitude,
            fullText: data.fullText,
        },
    });
}

async function upsertCategory(db: DbClient, data: (typeof categories)[number]) {
    const existing = await db.category.findFirst({
        where: {
            name: data.name,
        },
    });

    if (existing) {
        return await db.category.update({
            where: { id: existing.id },
            data: {
                description: data.description,
                image: data.image,
                sortOrder: data.sortOrder,
                deleteAt: null,
            },
        });
    }

    return await db.category.create({
        data,
    });
}

async function upsertIngredient(
    db: DbClient,
    data: (typeof ingredients)[number],
) {
    const existing = await db.ingredient.findFirst({
        where: {
            name: data.name,
        },
    });

    if (existing) {
        return await db.ingredient.update({
            where: { id: existing.id },
            data: {
                icon: data.icon,
            },
        });
    }

    return await db.ingredient.create({
        data,
    });
}

async function ensureUserRole(db: DbClient, userId: number, role: Role) {
    const existing = await db.userRole.findFirst({
        where: {
            userId,
            role,
        },
    });

    if (existing) {
        if (existing.deleteAt) {
            await db.userRole.update({
                where: { id: existing.id },
                data: {
                    deleteAt: null,
                },
            });
        }
        return;
    }

    await db.userRole.create({
        data: {
            userId,
            role,
        },
    });
}

async function ensureUserAddress(
    db: DbClient,
    userId: number,
    title: string,
    addressId: number,
) {
    const existing = await db.userAddress.findFirst({
        where: {
            userId,
            title,
        },
    });

    if (existing) {
        return await db.userAddress.update({
            where: { id: existing.id },
            data: {
                addressId,
                deleteAt: null,
            },
        });
    }

    return await db.userAddress.create({
        data: {
            userId,
            title,
            addressId,
        },
    });
}

async function upsertUser(
    db: DbClient,
    data: (typeof users)[keyof typeof users],
) {
    const password = await hashPassword(data.password);

    const user = await db.user.upsert({
        where: {
            email: data.email,
        },
        create: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            password,
            birthday: new Date(data.birthday),
            active: true,
            avatar: '',
        },
        update: {
            name: data.name,
            phone: data.phone,
            password,
            birthday: new Date(data.birthday),
            active: true,
            avatar: '',
            deleteAt: null,
        },
    });

    for (const role of data.roles) {
        await ensureUserRole(db, user.id, role);
    }

    await db.identity.upsert({
        where: {
            userId_provider: {
                userId: user.id,
                provider: AuthProvider.LOCAL,
            },
        },
        create: {
            userId: user.id,
            provider: AuthProvider.LOCAL,
            providerUserId: getLocalProviderUserId(user.id),
        },
        update: {
            providerUserId: getLocalProviderUserId(user.id),
            accessToken: null,
            deleteAt: null,
        },
    });

    if (data.roles.some((role) => role === Role.CUSTOMER)) {
        await db.cart.upsert({
            where: {
                userId: user.id,
            },
            create: {
                userId: user.id,
            },
            update: {
                deleteAt: null,
            },
        });
    }

    return user;
}

async function upsertRestaurant(
    db: DbClient,
    data: {
        name: string;
        phone: string;
        description: string;
        addressId: number;
        ownerId: number;
        status: RestaurantApprovalStatus;
        image: string;
        coverImage: string;
        minimumOrder: number;
        estimatedDeliveryTime: number;
    },
) {
    return await db.restaurant.upsert({
        where: {
            phone: data.phone,
        },
        create: data,
        update: {
            ...data,
            deleteAt: null,
        },
    });
}

async function upsertFood(
    db: DbClient,
    data: {
        restaurantId: number;
        categoryId: number;
        name: string;
        description: string;
        price: number;
        label: string;
        image: string;
        isAvailable: boolean;
    },
) {
    const existing = await db.food.findFirst({
        where: {
            restaurantId: data.restaurantId,
            name: data.name,
        },
    });

    if (existing) {
        return await db.food.update({
            where: {
                id: existing.id,
            },
            data: {
                ...data,
                deleteAt: null,
            },
        });
    }

    return await db.food.create({
        data,
    });
}

async function ensureFoodIngredient(
    db: DbClient,
    foodId: number,
    ingredientId: number,
) {
    await db.foodIngredient.upsert({
        where: {
            foodId_ingredientId: {
                foodId,
                ingredientId,
            },
        },
        create: {
            foodId,
            ingredientId,
        },
        update: {
            deleteAt: null,
        },
    });
}

async function seedFoodIngredients(
    db: DbClient,
    foodMap: Map<string, { id: number }>,
    ingredientMap: Map<string, { id: number }>,
) {
    for (const [foodKey, ingredientNames] of Object.entries(
        foodIngredientLinks,
    )) {
        const food = foodMap.get(foodKey);
        if (!food) {
            throw new Error(`Unknown food seed key: ${foodKey}`);
        }

        for (const name of ingredientNames) {
            const ingredient = ingredientMap.get(name);
            if (!ingredient) {
                throw new Error(`Unknown ingredient seed name: ${name}`);
            }
            await ensureFoodIngredient(db, food.id, ingredient.id);
        }
    }
}

async function upsertSize(db: DbClient, name: string) {
    return await db.size.upsert({
        where: { name },
        create: { name },
        update: {},
    });
}

async function ensureDefaultFoodSize(
    db: DbClient,
    foodId: number,
    sizeId: number,
    price: number,
) {
    const existing = await db.foodSize.findFirst({
        where: {
            foodId,
            sizeId,
        },
    });

    if (existing) {
        return await db.foodSize.update({
            where: { id: existing.id },
            data: {
                price,
                isDefault: true,
                deleteAt: null,
            },
        });
    }

    return await db.foodSize.create({
        data: {
            foodId,
            sizeId,
            price,
            isDefault: true,
        },
    });
}

async function upsertVoucher(
    db: DbClient,
    data: {
        name: string;
        code: string;
        description: string;
        image: string;
        sale: number;
        type: VoucherType;
        status: VoucherStatus;
        restaurantId?: number | null;
        minimumOrderAmount: number;
        maximumDiscountAmount?: number | null;
        startAt?: Date | null;
        endAt?: Date | null;
    },
) {
    const existing = await db.voucher.findFirst({
        where: {
            code: data.code,
            restaurantId: data.restaurantId ?? null,
        },
    });

    if (existing) {
        return await db.voucher.update({
            where: {
                id: existing.id,
            },
            data: {
                ...data,
                restaurantId: data.restaurantId ?? null,
                maximumDiscountAmount: data.maximumDiscountAmount ?? null,
                startAt: data.startAt ?? null,
                endAt: data.endAt ?? null,
                deleteAt: null,
            },
        });
    }

    return await db.voucher.create({
        data: {
            ...data,
            restaurantId: data.restaurantId ?? null,
            maximumDiscountAmount: data.maximumDiscountAmount ?? null,
            startAt: data.startAt ?? null,
            endAt: data.endAt ?? null,
        },
    });
}

async function upsertRating(
    db: DbClient,
    data: {
        restaurantId: number;
        userId: number;
        vote: number;
        comment: string;
        orderId: number;
    },
) {
    const existing = await db.restaurantRating.findFirst({
        where: {
            restaurantId: data.restaurantId,
            userId: data.userId,
        },
    });

    if (existing) {
        return await db.restaurantRating.update({
            where: { id: existing.id },
            data: {
                vote: data.vote,
                comment: data.comment,
                orderId: data.orderId,
                deleteAt: null,
            },
        });
    }

    return await db.restaurantRating.create({
        data,
    });
}

async function upsertOrder(
    db: DbClient,
    data: {
        restaurantId: number;
        totalPrice: number;
        status: OrderStatus;
        userId: number;
        voucherId?: number | null;
        addressId: number;
        note: string;
        deliveredAt?: Date | null;
        confirmedAt?: Date | null;
        confirmedBy?: ConfirmedBy | null;
        autoConfirmAt?: Date | null;
    },
) {
    const existing = await db.order.findFirst({
        where: {
            note: data.note,
        },
    });

    if (existing) {
        return await db.order.update({
            where: {
                id: existing.id,
            },
            data: {
                restaurantId: data.restaurantId,
                totalPrice: data.totalPrice,
                status: data.status,
                userId: data.userId,
                voucherId: data.voucherId ?? null,
                addressId: data.addressId,
                note: data.note,
                deliveredAt: data.deliveredAt ?? null,
                confirmedAt: data.confirmedAt ?? null,
                confirmedBy: data.confirmedBy ?? null,
                autoConfirmAt: data.autoConfirmAt ?? null,
                deleteAt: null,
            },
        });
    }

    return await db.order.create({
        data: {
            restaurantId: data.restaurantId,
            totalPrice: data.totalPrice,
            status: data.status,
            userId: data.userId,
            voucherId: data.voucherId ?? null,
            addressId: data.addressId,
            note: data.note,
            deliveredAt: data.deliveredAt ?? null,
            confirmedAt: data.confirmedAt ?? null,
            confirmedBy: data.confirmedBy ?? null,
            autoConfirmAt: data.autoConfirmAt ?? null,
        },
    });
}

async function replaceOrderFoods(
    db: DbClient,
    orderId: number,
    items: Array<{
        foodId: number;
        quantity: number;
        fullText: string;
        price: number;
    }>,
) {
    await db.orderFood.deleteMany({
        where: {
            orderId,
        },
    });

    if (items.length === 0) {
        return;
    }

    await db.orderFood.createMany({
        data: items.map((item) => ({
            orderId,
            foodId: item.foodId,
            quantity: item.quantity,
            fullText: item.fullText,
            price: item.price,
        })),
    });
}

async function upsertPayment(
    db: DbClient,
    orderId: number,
    data: {
        method: PaymentMethod;
        amount: number;
        paymentStatus: PaymentStatus;
    },
) {
    return await db.payment.upsert({
        where: {
            orderId,
        },
        create: {
            orderId,
            method: data.method,
            amount: data.amount,
            paymentStatus: data.paymentStatus,
        },
        update: {
            method: data.method,
            amount: data.amount,
            paymentStatus: data.paymentStatus,
            deleteAt: null,
        },
    });
}

async function upsertConversation(
    db: DbClient,
    data: {
        customerId: number;
        sellerId: number;
    },
) {
    const existing = await db.conversation.findFirst({
        where: {
            customerId: data.customerId,
            sellerId: data.sellerId,
        },
    });

    if (existing) {
        return await db.conversation.update({
            where: { id: existing.id },
            data: {
                customerId: data.customerId,
                sellerId: data.sellerId,
                deleteAt: null,
            },
        });
    }

    return await db.conversation.create({
        data: {
            customerId: data.customerId,
            sellerId: data.sellerId,
        },
    });
}

async function replaceMessages(
    db: DbClient,
    conversationId: number,
    messages: Array<{
        senderId: number;
        content: string;
    }>,
) {
    await db.message.deleteMany({
        where: {
            conversationId,
        },
    });

    if (messages.length === 0) {
        return;
    }

    await db.message.createMany({
        data: messages.map((message) => ({
            conversationId,
            senderId: message.senderId,
            content: message.content,
        })),
    });
}

async function replaceCartItems(
    db: DbClient,
    userId: number,
    items: Array<{
        foodId: number;
        quantity: number;
        fullText?: string;
    }>,
) {
    const cart = await db.cart.findUnique({
        where: {
            userId,
        },
    });

    if (!cart) {
        return;
    }

    await db.cartItem.deleteMany({
        where: {
            cartId: cart.id,
        },
    });

    if (items.length === 0) {
        return;
    }

    const defaultSizes = await db.foodSize.findMany({
        where: {
            foodId: {
                in: items.map((item) => item.foodId),
            },
            isDefault: true,
            deleteAt: null,
        },
        select: {
            id: true,
            foodId: true,
        },
    });
    const defaultSizeByFoodId = new Map(
        defaultSizes.map((foodSize) => [foodSize.foodId, foodSize.id]),
    );

    await db.cartItem.createMany({
        data: items.map((item) => {
            const foodSizeId = defaultSizeByFoodId.get(item.foodId);
            if (!foodSizeId) {
                throw new Error(
                    `Default food size not found for cart food ${item.foodId}`,
                );
            }

            return {
                cartId: cart.id,
                foodId: item.foodId,
                foodSizeId,
                quantity: item.quantity,
                fullText: item.fullText ?? null,
            };
        }),
    });
}

async function upsertSearchHistory(
    db: DbClient,
    userId: number,
    keyword: string,
) {
    return await db.searchHistory.upsert({
        where: {
            userId_keyword: {
                userId,
                keyword,
            },
        },
        create: {
            userId,
            keyword,
            createdAt: new Date(),
        },
        update: {
            createdAt: new Date(),
        },
    });
}

async function upsertNotification(
    db: DbClient,
    data: {
        userId: number;
        title: string;
        body: string;
        type: NotificationType;
        targetType?: string | null;
        targetId?: number | null;
        actorId?: number | null;
    },
) {
    const existing = await db.notification.findFirst({
        where: {
            userId: data.userId,
            title: data.title,
            body: data.body,
        },
    });

    if (existing) {
        return existing;
    }

    const notification = await db.notification.create({
        data,
    });

    await db.notificationChannel.create({
        data: {
            notificationId: notification.id,
            channel: DeliveryChannel.IN_APP,
            status: 'SENT',
            sentAt: new Date(),
        },
    });

    await db.notificationChannel.create({
        data: {
            notificationId: notification.id,
            channel: DeliveryChannel.DEVICE,
            status: 'SENT',
            sentAt: new Date(),
        },
    });

    return notification;
}

async function main() {
    await prisma.$transaction(
        async (tx) => {
            const addressMap = new Map<
                string,
                Awaited<ReturnType<typeof upsertAddress>>
            >();
            for (const address of addresses) {
                addressMap.set(address.key, await upsertAddress(tx, address));
            }

            const categoryMap = new Map<
                string,
                Awaited<ReturnType<typeof upsertCategory>>
            >();
            for (const category of categories) {
                categoryMap.set(
                    category.name,
                    await upsertCategory(tx, category),
                );
            }

            const sizeMap = new Map<
                string,
                Awaited<ReturnType<typeof upsertSize>>
            >();
            for (const name of ['S', 'M', 'L', 'XL'] as const) {
                sizeMap.set(name, await upsertSize(tx, name));
            }

            const ingredientMap = new Map<
                string,
                Awaited<ReturnType<typeof upsertIngredient>>
            >();
            for (const ingredient of ingredients) {
                ingredientMap.set(
                    ingredient.name,
                    await upsertIngredient(tx, ingredient),
                );
            }

            const userMap = new Map<
                string,
                Awaited<ReturnType<typeof upsertUser>>
            >();
            for (const [key, userData] of Object.entries(users)) {
                const user = await upsertUser(tx, userData);
                userMap.set(key, user);

                for (const addressLink of userData.addressTitles) {
                    const address = addressMap.get(addressLink.addressKey);
                    if (!address) {
                        throw new Error(
                            `Missing address seed "${addressLink.addressKey}"`,
                        );
                    }

                    await ensureUserAddress(
                        tx,
                        user.id,
                        addressLink.title,
                        address.id,
                    );
                }
            }

            const admin = userMap.get('admin');
            const business = userMap.get('business');
            const business2 = userMap.get('business2');
            const business3 = userMap.get('business3');
            const customer1 = userMap.get('customer1');
            const customer2 = userMap.get('customer2');

            if (
                !admin ||
                !business ||
                !business2 ||
                !business3 ||
                !customer1 ||
                !customer2
            ) {
                throw new Error('Seed users were not created correctly');
            }

            const burgerCategory = categoryMap.get('Burger');
            const riceCategory = categoryMap.get('Rice');
            const sushiCategory = categoryMap.get('Sushi');
            const noodlesCategory = categoryMap.get('Noodles');
            const dessertCategory = categoryMap.get('Dessert');
            const drinksCategory = categoryMap.get('Drinks');

            if (
                !burgerCategory ||
                !riceCategory ||
                !sushiCategory ||
                !noodlesCategory ||
                !dessertCategory ||
                !drinksCategory
            ) {
                throw new Error('Seed categories were not created correctly');
            }

            const district1 = addressMap.get('district-1');
            const district3 = addressMap.get('district-3');
            const thuDuc = addressMap.get('thu-duc');
            const binhThanh = addressMap.get('binh-thanh');

            if (!district1 || !district3 || !thuDuc || !binhThanh) {
                throw new Error('Seed addresses were not created correctly');
            }

            const restaurants = {
                burgerTown: await upsertRestaurant(tx, {
                    name: 'Burger Town',
                    phone: '02873000001',
                    description:
                        'Smash burgers, fries, and shakes in District 1.',
                    addressId: district1.id,
                    ownerId: business.id,
                    status: RestaurantApprovalStatus.APPROVED,
                    image: seedImages.restaurants.burgerTown.logo,
                    coverImage: seedImages.restaurants.burgerTown.cover,
                    minimumOrder: 8,
                    estimatedDeliveryTime: 25,
                }),
                riceExpress: await upsertRestaurant(tx, {
                    name: 'Rice Express',
                    phone: '02873000002',
                    description:
                        'Com tam, grilled meats, and weekday lunch sets.',
                    addressId: district3.id,
                    ownerId: business2.id,
                    status: RestaurantApprovalStatus.APPROVED,
                    image: seedImages.restaurants.riceExpress.logo,
                    coverImage: seedImages.restaurants.riceExpress.cover,
                    minimumOrder: 6,
                    estimatedDeliveryTime: 20,
                }),
                sushiLab: await upsertRestaurant(tx, {
                    name: 'Sushi Lab',
                    phone: '02873000003',
                    description:
                        'Fresh rolls made to order. New shop awaiting approval.',
                    addressId: thuDuc.id,
                    ownerId: business3.id,
                    status: RestaurantApprovalStatus.PENDING,
                    image: seedImages.restaurants.sushiLab.logo,
                    coverImage: seedImages.restaurants.sushiLab.cover,
                    minimumOrder: 10,
                    estimatedDeliveryTime: 35,
                }),
                bepViet: await upsertRestaurant(tx, {
                    name: 'Bep Viet Kitchen',
                    phone: '02873000004',
                    description:
                        'Pho, bun, and Vietnamese street food favorites.',
                    addressId: binhThanh.id,
                    ownerId: business3.id,
                    status: RestaurantApprovalStatus.APPROVED,
                    image: seedImages.restaurants.bepViet.logo,
                    coverImage: seedImages.restaurants.bepViet.cover,
                    minimumOrder: 5,
                    estimatedDeliveryTime: 18,
                }),
                cocoTea: await upsertRestaurant(tx, {
                    name: 'CoCo Tea House',
                    phone: '02873000005',
                    description: 'Milk tea, fruit tea, and light desserts.',
                    addressId: district1.id,
                    ownerId: business.id,
                    status: RestaurantApprovalStatus.APPROVED,
                    image: seedImages.restaurants.cocoTea.logo,
                    coverImage: seedImages.restaurants.cocoTea.cover,
                    minimumOrder: 4,
                    estimatedDeliveryTime: 15,
                }),
            };

            const foods = {
                cheeseburger: await upsertFood(tx, {
                    restaurantId: restaurants.burgerTown.id,
                    categoryId: burgerCategory.id,
                    name: 'Classic Cheeseburger',
                    description:
                        'Beef patty, cheddar, pickles, lettuce, and house sauce.',
                    price: 8.99,
                    label: 'Best seller',
                    image: seedImages.foods.cheeseburger,
                    isAvailable: true,
                }),
                doubleBurger: await upsertFood(tx, {
                    restaurantId: restaurants.burgerTown.id,
                    categoryId: burgerCategory.id,
                    name: 'Double Smash Burger',
                    description:
                        'Two smash patties, cheddar, caramelized onion, and sauce.',
                    price: 11.99,
                    label: 'Signature',
                    image: seedImages.foods.doubleBurger,
                    isAvailable: true,
                }),
                chickenBurger: await upsertFood(tx, {
                    restaurantId: restaurants.burgerTown.id,
                    categoryId: burgerCategory.id,
                    name: 'Crispy Chicken Burger',
                    description:
                        'Crispy chicken fillet, coleslaw, and mayo on a brioche bun.',
                    price: 9.99,
                    label: 'Popular',
                    image: seedImages.foods.chickenBurger,
                    isAvailable: true,
                }),
                lavaCake: await upsertFood(tx, {
                    restaurantId: restaurants.burgerTown.id,
                    categoryId: dessertCategory.id,
                    name: 'Chocolate Lava Cake',
                    description:
                        'Warm chocolate cake with a molten center and vanilla cream.',
                    price: 5.49,
                    label: 'Sweet',
                    image: seedImages.foods.lavaCake,
                    isAvailable: true,
                }),
                grilledChickenRice: await upsertFood(tx, {
                    restaurantId: restaurants.riceExpress.id,
                    categoryId: riceCategory.id,
                    name: 'Grilled Chicken Rice',
                    description:
                        'Char-grilled chicken thigh, jasmine rice, pickles, and scallion oil.',
                    price: 7.99,
                    label: 'Lunch set',
                    image: seedImages.foods.grilledChickenRice,
                    isAvailable: true,
                }),
                lemongrassPorkRice: await upsertFood(tx, {
                    restaurantId: restaurants.riceExpress.id,
                    categoryId: riceCategory.id,
                    name: 'Lemongrass Pork Rice',
                    description:
                        'Grilled lemongrass pork chop with broken rice and fish sauce dip.',
                    price: 7.49,
                    label: 'Homestyle',
                    image: seedImages.foods.lemongrassPorkRice,
                    isAvailable: true,
                }),
                beefNoodles: await upsertFood(tx, {
                    restaurantId: restaurants.riceExpress.id,
                    categoryId: noodlesCategory.id,
                    name: 'Beef Stir-fried Noodles',
                    description:
                        'Wok-fried egg noodles with beef, bean sprouts, and greens.',
                    price: 9.49,
                    label: 'Hot dish',
                    image: seedImages.foods.beefNoodles,
                    isAvailable: true,
                }),
                salmonRoll: await upsertFood(tx, {
                    restaurantId: restaurants.sushiLab.id,
                    categoryId: sushiCategory.id,
                    name: 'Salmon Avocado Roll',
                    description:
                        'Fresh salmon, avocado, cucumber, and seasoned rice.',
                    price: 10.99,
                    label: 'Fresh',
                    image: seedImages.foods.salmonRoll,
                    isAvailable: true,
                }),
                chickenTeriyakiRoll: await upsertFood(tx, {
                    restaurantId: restaurants.sushiLab.id,
                    categoryId: sushiCategory.id,
                    name: 'Chicken Teriyaki Roll',
                    description: 'Teriyaki chicken, cucumber, and sesame seeds.',
                    price: 8.99,
                    label: 'Classic',
                    image: seedImages.foods.chickenTeriyakiRoll,
                    isAvailable: true,
                }),
                bunBoHue: await upsertFood(tx, {
                    restaurantId: restaurants.bepViet.id,
                    categoryId: noodlesCategory.id,
                    name: 'Bun Bo Hue',
                    description:
                        'Spicy beef noodle soup with pork sausage, herbs, and lime.',
                    price: 8.49,
                    label: 'Best seller',
                    image: seedImages.foods.bunBoHue,
                    isAvailable: true,
                }),
                bunChaHaNoi: await upsertFood(tx, {
                    restaurantId: restaurants.bepViet.id,
                    categoryId: noodlesCategory.id,
                    name: 'Bun Cha Hanoi',
                    description:
                        'Grilled pork patties, rice noodles, herbs, and dipping sauce.',
                    price: 7.49,
                    label: 'Hanoi style',
                    image: seedImages.foods.bunChaHaNoi,
                    isAvailable: true,
                }),
                phoBo: await upsertFood(tx, {
                    restaurantId: restaurants.bepViet.id,
                    categoryId: noodlesCategory.id,
                    name: 'Pho Bo',
                    description:
                        'Beef pho with brisket, basil, bean sprouts, and lime.',
                    price: 7.99,
                    label: 'Comfort bowl',
                    image: seedImages.foods.phoBo,
                    isAvailable: true,
                }),
                milkTea: await upsertFood(tx, {
                    restaurantId: restaurants.bepViet.id,
                    categoryId: drinksCategory.id,
                    name: 'Brown Sugar Milk Tea',
                    description:
                        'Black tea, fresh milk, brown sugar syrup, and tapioca pearls.',
                    price: 4.49,
                    label: 'Popular',
                    image: seedImages.foods.milkTea,
                    isAvailable: true,
                }),
                classicMilkTea: await upsertFood(tx, {
                    restaurantId: restaurants.cocoTea.id,
                    categoryId: drinksCategory.id,
                    name: 'Classic Milk Tea',
                    description:
                        'Black tea and fresh milk with chewy tapioca pearls.',
                    price: 3.99,
                    label: 'Signature',
                    image: seedImages.foods.classicMilkTea,
                    isAvailable: true,
                }),
                matchaLatte: await upsertFood(tx, {
                    restaurantId: restaurants.cocoTea.id,
                    categoryId: drinksCategory.id,
                    name: 'Matcha Latte',
                    description: 'Japanese matcha blended with fresh milk and ice.',
                    price: 4.99,
                    label: 'Best seller',
                    image: seedImages.foods.matchaLatte,
                    isAvailable: true,
                }),
                mangoSmoothie: await upsertFood(tx, {
                    restaurantId: restaurants.cocoTea.id,
                    categoryId: drinksCategory.id,
                    name: 'Mango Smoothie',
                    description: 'Fresh mango blended with milk and ice.',
                    price: 5.49,
                    label: 'Fruit series',
                    image: seedImages.foods.mangoSmoothie,
                    isAvailable: true,
                }),
                puddingFlan: await upsertFood(tx, {
                    restaurantId: restaurants.cocoTea.id,
                    categoryId: dessertCategory.id,
                    name: 'Caramel Pudding Flan',
                    description: 'Silky egg pudding with caramel sauce.',
                    price: 3.49,
                    label: 'Sweet',
                    image: seedImages.foods.puddingFlan,
                    isAvailable: true,
                }),
                seafoodFriedRice: await upsertFood(tx, {
                    restaurantId: restaurants.cocoTea.id,
                    categoryId: riceCategory.id,
                    name: 'Seafood Fried Rice',
                    description:
                        'Wok-fried rice with mixed seafood and spring onion.',
                    price: 10.99,
                    label: 'Chef special',
                    image: seedImages.foods.seafoodFriedRice,
                    isAvailable: true,
                }),
            };

            const foodMap = new Map(
                Object.entries(foods).map(([key, food]) => [key, food]),
            );

            const sizeM = sizeMap.get('M');
            if (!sizeM) {
                throw new Error('Size "M" was not created correctly');
            }

            for (const [, food] of Object.entries(foods)) {
                await ensureDefaultFoodSize(
                    tx,
                    food.id,
                    sizeM.id,
                    Number(food.price),
                );
            }

            // Backfill FoodSizes for any other foods in the database that don't have sizes yet
            const allFoods = await tx.food.findMany({
                include: {
                    sizes: true,
                },
            });
            for (const food of allFoods) {
                if (food.sizes.length === 0) {
                    await tx.foodSize.create({
                        data: {
                            foodId: food.id,
                            sizeId: sizeM.id,
                            price: food.price,
                            isDefault: true,
                        },
                    });
                }
            }

            await seedFoodIngredients(tx, foodMap, ingredientMap);

            const vouchers = {
                welcome5: await upsertVoucher(tx, {
                    name: 'Welcome 5',
                    code: 'WELCOME5',
                    description: 'Flat 5 off for seeded test orders.',
                    image: '',
                    sale: 5,
                    type: VoucherType.MONEY,
                    status: VoucherStatus.APPLYING,
                    restaurantId: null,
                    minimumOrderAmount: 15,
                    maximumDiscountAmount: null,
                    startAt: new Date(now.getTime() - oneDay),
                    endAt: new Date(now.getTime() + 30 * oneDay),
                }),
                burger10: await upsertVoucher(tx, {
                    name: 'Burger Ten',
                    code: 'BURGER10',
                    description: 'Ten percent off Burger Town orders.',
                    image: '',
                    sale: 10,
                    type: VoucherType.PERCENT,
                    status: VoucherStatus.APPLYING,
                    restaurantId: restaurants.burgerTown.id,
                    minimumOrderAmount: 20,
                    maximumDiscountAmount: 6,
                    startAt: new Date(now.getTime() - oneDay),
                    endAt: new Date(now.getTime() + 14 * oneDay),
                }),
                oldRiceDeal: await upsertVoucher(tx, {
                    name: 'Old Rice Deal',
                    code: 'RICEOLD',
                    description: 'Expired voucher kept for testing filters.',
                    image: '',
                    sale: 4,
                    type: VoucherType.MONEY,
                    status: VoucherStatus.ENDED,
                    restaurantId: restaurants.riceExpress.id,
                    minimumOrderAmount: 10,
                    maximumDiscountAmount: null,
                    startAt: new Date(now.getTime() - 30 * oneDay),
                    endAt: new Date(now.getTime() - 7 * oneDay),
                }),
                bepViet15: await upsertVoucher(tx, {
                    name: 'Bep Viet Fifteen',
                    code: 'BEPVIET15',
                    description:
                        'Fifteen percent off Bep Viet Kitchen orders.',
                    image: '',
                    sale: 15,
                    type: VoucherType.PERCENT,
                    status: VoucherStatus.APPLYING,
                    restaurantId: restaurants.bepViet.id,
                    minimumOrderAmount: 12,
                    maximumDiscountAmount: 5,
                    startAt: new Date(now.getTime() - oneDay),
                    endAt: new Date(now.getTime() + 14 * oneDay),
                }),
                coco20: await upsertVoucher(tx, {
                    name: 'CoCo Tea Twenty',
                    code: 'COCO20',
                    description: 'Twenty percent off CoCo Tea House orders.',
                    image: '',
                    sale: 20,
                    type: VoucherType.PERCENT,
                    status: VoucherStatus.APPLYING,
                    restaurantId: restaurants.cocoTea.id,
                    minimumOrderAmount: 10,
                    maximumDiscountAmount: 8,
                    startAt: new Date(now.getTime() - oneDay),
                    endAt: new Date(now.getTime() + 30 * oneDay),
                }),
                tea10: await upsertVoucher(tx, {
                    name: 'Tea Ten Off',
                    code: 'TEA10',
                    description: 'Flat $10 off drink orders at CoCo Tea House.',
                    image: '',
                    sale: 10,
                    type: VoucherType.MONEY,
                    status: VoucherStatus.APPLYING,
                    restaurantId: restaurants.cocoTea.id,
                    minimumOrderAmount: 15,
                    maximumDiscountAmount: null,
                    startAt: new Date(now.getTime() - oneDay),
                    endAt: new Date(now.getTime() + 21 * oneDay),
                }),
            };

            const orderOne = await upsertOrder(tx, {
                restaurantId: restaurants.burgerTown.id,
                userId: customer1.id,
                voucherId: vouchers.welcome5.id,
                addressId: district3.id,
                status: OrderStatus.DELIVERED,
                totalPrice: 26.5,
                note: '[seed] delivered burger order',
                deliveredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
                autoConfirmAt: new Date(now.getTime() + 22 * 60 * 60 * 1000),
            });

            await replaceOrderFoods(tx, orderOne.id, [
                {
                    foodId: foods.doubleBurger.id,
                    quantity: 1,
                    fullText: 'No onions',
                    price: 11.99,
                },
                {
                    foodId: foods.cheeseburger.id,
                    quantity: 1,
                    fullText: 'Extra sauce',
                    price: 8.99,
                },
                {
                    foodId: foods.lavaCake.id,
                    quantity: 1,
                    fullText: 'Pack separately',
                    price: 5.49,
                },
            ]);

            await upsertPayment(tx, orderOne.id, {
                method: PaymentMethod.CASH,
                amount: 26.5,
                paymentStatus: PaymentStatus.DONE,
            });

            const orderTwo = await upsertOrder(tx, {
                restaurantId: restaurants.riceExpress.id,
                userId: customer2.id,
                voucherId: null,
                addressId: thuDuc.id,
                status: OrderStatus.DELIVERED,
                totalPrice: 17.5,
                note: '[seed] confirmed rice order',
                deliveredAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
                autoConfirmAt: new Date(now.getTime() + 20 * 60 * 60 * 1000),
            });

            await replaceOrderFoods(tx, orderTwo.id, [
                {
                    foodId: foods.grilledChickenRice.id,
                    quantity: 1,
                    fullText: 'Less rice',
                    price: 7.99,
                },
                {
                    foodId: foods.beefNoodles.id,
                    quantity: 1,
                    fullText: 'No chili',
                    price: 9.49,
                },
            ]);

            await upsertPayment(tx, orderTwo.id, {
                method: PaymentMethod.MOMO,
                amount: 17.5,
                paymentStatus: PaymentStatus.SOLVING,
            });

            await upsertRating(tx, {
                restaurantId: restaurants.burgerTown.id,
                userId: customer1.id,
                vote: 5,
                comment: 'Fast delivery and the burger was still hot.',
                orderId: orderOne.id,
            });

            await upsertRating(tx, {
                restaurantId: restaurants.riceExpress.id,
                userId: customer2.id,
                vote: 4,
                comment: 'Solid lunch option and portion size was good.',
                orderId: orderTwo.id,
            });

            const orderThree = await upsertOrder(tx, {
                restaurantId: restaurants.burgerTown.id,
                userId: customer1.id,
                voucherId: vouchers.burger10.id,
                addressId: district3.id,
                status: OrderStatus.PENDING,
                totalPrice: 21,
                note: '[seed] pending burger order',
            });

            await replaceOrderFoods(tx, orderThree.id, [
                {
                    foodId: foods.doubleBurger.id,
                    quantity: 1,
                    fullText: 'Add napkins',
                    price: 11.99,
                },
                {
                    foodId: foods.cheeseburger.id,
                    quantity: 1,
                    fullText: 'No pickles',
                    price: 8.99,
                },
            ]);

            await upsertPayment(tx, orderThree.id, {
                method: PaymentMethod.CASH,
                amount: 21,
                paymentStatus: PaymentStatus.UNPAID,
            });

            const searchOrder = await upsertOrder(tx, {
                restaurantId: restaurants.bepViet.id,
                userId: customer2.id,
                voucherId: vouchers.bepViet15.id,
                addressId: thuDuc.id,
                status: OrderStatus.CONFIRMED,
                totalPrice: 34.5,
                note: '[seed] confirmed search test order',
                deliveredAt: new Date(now.getTime() - 2 * oneDay),
                confirmedAt: new Date(now.getTime() - oneDay),
                confirmedBy: ConfirmedBy.CUSTOMER,
            });

            await replaceOrderFoods(tx, searchOrder.id, [
                {
                    foodId: foods.bunBoHue.id,
                    quantity: 3,
                    fullText: 'Medium spicy',
                    price: 8.49,
                },
                {
                    foodId: foods.milkTea.id,
                    quantity: 2,
                    fullText: 'Less ice',
                    price: 4.49,
                },
            ]);

            await upsertPayment(tx, searchOrder.id, {
                method: PaymentMethod.CASH,
                amount: 34.5,
                paymentStatus: PaymentStatus.DONE,
            });

            await upsertRating(tx, {
                restaurantId: restaurants.bepViet.id,
                userId: customer2.id,
                vote: 5,
                comment: 'Great pho and bun bowls for search testing.',
                orderId: searchOrder.id,
            });

            const cocoConfirmedOrder = await upsertOrder(tx, {
                restaurantId: restaurants.cocoTea.id,
                userId: customer1.id,
                voucherId: vouchers.coco20.id,
                addressId: district3.id,
                status: OrderStatus.CONFIRMED,
                totalPrice: 9,
                note: '[seed] confirmed coco tea order',
                deliveredAt: new Date(now.getTime() - 3 * oneDay),
                confirmedAt: new Date(now.getTime() - 2 * oneDay),
                confirmedBy: ConfirmedBy.CUSTOMER,
            });

            await replaceOrderFoods(tx, cocoConfirmedOrder.id, [
                {
                    foodId: foods.matchaLatte.id,
                    quantity: 1,
                    fullText: 'Less ice',
                    price: 4.99,
                },
                {
                    foodId: foods.classicMilkTea.id,
                    quantity: 1,
                    fullText: 'Regular sweetness',
                    price: 3.99,
                },
            ]);

            await upsertPayment(tx, cocoConfirmedOrder.id, {
                method: PaymentMethod.MOMO,
                amount: 9,
                paymentStatus: PaymentStatus.DONE,
            });

            const cocoPreparingOrder = await upsertOrder(tx, {
                restaurantId: restaurants.cocoTea.id,
                userId: customer2.id,
                voucherId: vouchers.tea10.id,
                addressId: thuDuc.id,
                status: OrderStatus.PREPARING,
                totalPrice: 9,
                note: '[seed] preparing coco tea order',
            });

            await replaceOrderFoods(tx, cocoPreparingOrder.id, [
                {
                    foodId: foods.mangoSmoothie.id,
                    quantity: 1,
                    fullText: 'No sugar',
                    price: 5.49,
                },
                {
                    foodId: foods.puddingFlan.id,
                    quantity: 1,
                    fullText: 'Keep chilled',
                    price: 3.49,
                },
            ]);

            await upsertPayment(tx, cocoPreparingOrder.id, {
                method: PaymentMethod.CASH,
                amount: 9,
                paymentStatus: PaymentStatus.UNPAID,
            });

            const cocoDeliveredOrder = await upsertOrder(tx, {
                restaurantId: restaurants.cocoTea.id,
                userId: customer1.id,
                voucherId: null,
                addressId: binhThanh.id,
                status: OrderStatus.DELIVERED,
                totalPrice: 15,
                note: '[seed] delivered coco tea order',
                deliveredAt: new Date(now.getTime() - 60 * 60 * 1000),
                autoConfirmAt: new Date(now.getTime() + 23 * 60 * 60 * 1000),
            });

            await replaceOrderFoods(tx, cocoDeliveredOrder.id, [
                {
                    foodId: foods.seafoodFriedRice.id,
                    quantity: 1,
                    fullText: 'Extra lime',
                    price: 10.99,
                },
                {
                    foodId: foods.classicMilkTea.id,
                    quantity: 1,
                    fullText: 'Less ice',
                    price: 3.99,
                },
            ]);

            await upsertPayment(tx, cocoDeliveredOrder.id, {
                method: PaymentMethod.CASH,
                amount: 15,
                paymentStatus: PaymentStatus.DONE,
            });

            const conversationOne = await upsertConversation(tx, {
                customerId: customer1.id,
                sellerId: business.id,
            });

            await replaceMessages(tx, conversationOne.id, [
                {
                    senderId: customer1.id,
                    content: 'Please make sure the burgers stay separate.',
                },
                {
                    senderId: business.id,
                    content: 'Confirmed. We will pack them separately.',
                },
                {
                    senderId: customer1.id,
                    content: 'Thanks, the delivery was quick.',
                },
                {
                    senderId: business.id,
                    content: 'Happy to hear that. See you again soon.',
                },
            ]);

            const conversationTwo = await upsertConversation(tx, {
                customerId: customer2.id,
                sellerId: business.id,
            });

            await replaceMessages(tx, conversationTwo.id, [
                {
                    senderId: customer2.id,
                    content: 'Can you help me check the delivery progress?',
                },
                {
                    senderId: business.id,
                    content:
                        'The rider is on the way and should arrive shortly.',
                },
            ]);

            await replaceCartItems(tx, customer1.id, [
                {
                    foodId: foods.cheeseburger.id,
                    quantity: 2,
                    fullText: 'No onions [seed multi-restaurant cart]',
                },
                {
                    foodId: foods.grilledChickenRice.id,
                    quantity: 1,
                    fullText: 'Extra scallion oil [seed multi-restaurant cart]',
                },
            ]);

            await replaceCartItems(tx, customer2.id, [
                {
                    foodId: foods.grilledChickenRice.id,
                    quantity: 1,
                    fullText: 'Less rice [seed multi-restaurant cart]',
                },
                {
                    foodId: foods.matchaLatte.id,
                    quantity: 1,
                    fullText: 'Less ice [seed multi-restaurant cart]',
                },
                {
                    foodId: foods.classicMilkTea.id,
                    quantity: 2,
                    fullText: 'Regular sweetness [seed multi-restaurant cart]',
                },
            ]);

            const searchHistories = [
                { userId: customer1.id, keyword: 'bun bo' },
                { userId: customer1.id, keyword: 'milk tea' },
                { userId: customer1.id, keyword: 'burger' },
                { userId: customer2.id, keyword: 'bun bo' },
                { userId: customer2.id, keyword: 'milk tea' },
                { userId: admin.id, keyword: 'pho' },
                { userId: business.id, keyword: 'burger' },
                { userId: business2.id, keyword: 'milk tea' },
                { userId: customer1.id, keyword: 'matcha' },
                { userId: customer2.id, keyword: 'coco tea' },
            ];

            for (const history of searchHistories) {
                await upsertSearchHistory(tx, history.userId, history.keyword);
            }

            // Seed notifications matching the seeded events and notifications
            const seedNotifications = [
                // Admin notifications (business registration & restaurant creation)
                {
                    userId: admin.id,
                    title: 'New Business Registration',
                    body: `User "${business.name}" (Phone: ${business.phone || 'N/A'}) has registered as a business.`,
                    type: NotificationType.SYSTEM,
                    targetType: 'USER',
                    targetId: business.id,
                    actorId: business.id,
                },
                {
                    userId: admin.id,
                    title: 'New Restaurant Created',
                    body: `User "${business.name}" has registered a new restaurant "${restaurants.burgerTown.name}".`,
                    type: NotificationType.SYSTEM,
                    targetType: 'RESTAURANT',
                    targetId: restaurants.burgerTown.id,
                    actorId: business.id,
                },
                // Business notification (rating review & new order)
                {
                    userId: business.id,
                    title: 'New Restaurant Review',
                    body: `A customer has rated your restaurant "${restaurants.burgerTown.name}" with 5 stars: "Fast delivery and the burger was still hot."`,
                    type: NotificationType.SYSTEM,
                    targetType: 'RESTAURANT',
                    targetId: restaurants.burgerTown.id,
                    actorId: customer1.id,
                },
                {
                    userId: business.id,
                    title: 'New Order Received',
                    body: `New order #${orderOne.id} from ${customer1.name}: 2x Smash Patty, 1x Cheddar. Total: $${orderOne.totalPrice}`,
                    type: NotificationType.ORDER,
                    targetType: 'ORDER',
                    targetId: orderOne.id,
                    actorId: customer1.id,
                },
                // Customer notifications (preparing order, order completed, payment confirmed)
                {
                    userId: customer1.id,
                    title: 'Preparing Your Order',
                    body: `The restaurant has accepted and is preparing your order #${orderOne.id}.`,
                    type: NotificationType.ORDER,
                    targetType: 'ORDER',
                    targetId: orderOne.id,
                },
                {
                    userId: customer1.id,
                    title: 'Payment Confirmed',
                    body: `Your payment of $${orderOne.totalPrice} for order #${orderOne.id} has been confirmed.`,
                    type: NotificationType.PAYMENT,
                    targetType: 'ORDER',
                    targetId: orderOne.id,
                    actorId: business.id,
                },
                {
                    userId: customer1.id,
                    title: 'Order Completed',
                    body: `Thanks for confirming receipt of your order #${orderOne.id}.`,
                    type: NotificationType.ORDER,
                    targetType: 'ORDER',
                    targetId: orderOne.id,
                    actorId: customer1.id,
                },
                // Promotion notifications
                {
                    userId: customer1.id,
                    title: 'New Promotion Available!',
                    body: `Use code ${vouchers.welcome5.code} to get a discount.`,
                    type: NotificationType.PROMOTION,
                    targetType: 'VOUCHER',
                    targetId: vouchers.welcome5.id,
                },
                {
                    userId: customer2.id,
                    title: 'New Promotion Available!',
                    body: `Use code ${vouchers.welcome5.code} to get a discount.`,
                    type: NotificationType.PROMOTION,
                    targetType: 'VOUCHER',
                    targetId: vouchers.welcome5.id,
                },
            ];

            for (const notification of seedNotifications) {
                await upsertNotification(tx, notification);
            }
        },
        {
            maxWait: 10000,
            timeout: 60000,
        },
    );

    console.log('Seed completed successfully.');
    console.log('Test accounts:');
    console.log('ADMIN    phone=0900000001 password=admin123');
    console.log('BUSINESS phone=0900000002 password=business123');
    console.log('CUSTOMER phone=0900000003 password=customer123');
    console.log('CUSTOMER phone=0900000004 password=customer456');
    console.log(
        'Multi-restaurant carts: customer1=Burger Town + Rice Express; customer2=Rice Express + CoCo Tea',
    );
    console.log(
        'Search keywords: bun bo, milk tea, burger, pho, matcha, coco tea',
    );
    console.log(
        'Voucher codes: WELCOME5, BURGER10, RICEOLD, BEPVIET15, COCO20, TEA10',
    );
    console.log('Ingredients: 12 items (Material icon keys — see GET /food/ingredients)');
    console.log('Food & restaurant images: Unsplash URLs in seed data');
}

main()
    .catch((error) => {
        console.error('Seed failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
