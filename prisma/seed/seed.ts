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
} from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

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

const categories = [
    {
        name: 'Burger',
        description:
            'Smash burgers, chicken burgers, and comfort food classics.',
        sortOrder: 1,
        image: '',
    },
    {
        name: 'Rice',
        description:
            'Rice bowls and grilled protein combos for everyday meals.',
        sortOrder: 2,
        image: '',
    },
    {
        name: 'Sushi',
        description: 'Rolls, nigiri, and light Japanese favorites.',
        sortOrder: 3,
        image: '',
    },
    {
        name: 'Noodles',
        description: 'Warm noodle dishes with bold broth and toppings.',
        sortOrder: 4,
        image: '',
    },
    {
        name: 'Dessert',
        description: 'Sweet add-ons and comfort desserts for finishing a meal.',
        sortOrder: 5,
        image: '',
    },
    {
        name: 'Fantasy Gourmet',
        description: 'Rare fantasy dishes and ingredients for manual testing.',
        sortOrder: 6,
        image: '',
    },
] as const;

const ingredients = [
    { name: 'Beef Patty', icon: 'beef' },
    { name: 'Cheddar', icon: 'cheese' },
    { name: 'Cucumber', icon: 'cucumber' },
    { name: 'Salmon', icon: 'salmon' },
    { name: 'Egg', icon: 'egg' },
    { name: 'Seaweed', icon: 'seaweed' },
    { name: 'Chicken', icon: 'chicken' },
    { name: 'Chocolate', icon: 'chocolate' },
    { name: 'Bắp rang BB', icon: 'popcorn' },
    { name: 'Súp thể kỉ', icon: 'soup' },
    { name: 'Sò quỷ (Ký ức viễn hải)', icon: 'devil-shell' },
    {
        name: 'Tuyệt tượng - Ma mút kết thúc',
        icon: 'ending-mammoth',
    },
    { name: 'GOD', icon: 'god' },
    { name: 'Air', icon: 'air' },
    { name: 'Trái cầu vồng', icon: 'rainbow-fruit' },
    { name: 'Trứng thập ức điểu', icon: 'billion-bird-egg' },
    { name: 'Thịt kim cương', icon: 'diamond-meat' },
    { name: 'Cá nóc trắng', icon: 'white-pufferfish' },
    { name: 'Cỏ ozone', icon: 'ozone-grass' },
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
            const fantasyGourmetCategory = categoryMap.get('Fantasy Gourmet');

            if (
                !burgerCategory ||
                !riceCategory ||
                !sushiCategory ||
                !noodlesCategory ||
                !dessertCategory ||
                !fantasyGourmetCategory
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
                        'Fast casual burger shop with smash patties and crispy fries.',
                    addressId: district1.id,
                    ownerId: business.id,
                    status: RestaurantApprovalStatus.APPROVED,
                    image: '',
                    coverImage: '',
                    minimumOrder: 8,
                    estimatedDeliveryTime: 25,
                }),
                riceExpress: await upsertRestaurant(tx, {
                    name: 'Rice Express',
                    phone: '02873000002',
                    description:
                        'Everyday Vietnamese rice bowls for lunch and dinner.',
                    addressId: district3.id,
                    ownerId: business2.id,
                    status: RestaurantApprovalStatus.APPROVED,
                    image: '',
                    coverImage: '',
                    minimumOrder: 6,
                    estimatedDeliveryTime: 20,
                }),
                sushiLab: await upsertRestaurant(tx, {
                    name: 'Sushi Lab',
                    phone: '02873000003',
                    description:
                        'Fresh sushi rolls and Japanese comfort dishes for testing admin approval.',
                    addressId: thuDuc.id,
                    ownerId: business3.id,
                    status: RestaurantApprovalStatus.PENDING,
                    image: '',
                    coverImage: '',
                    minimumOrder: 10,
                    estimatedDeliveryTime: 35,
                }),
                bepVietSearchLab: await upsertRestaurant(tx, {
                    name: 'Bếp Việt Search Lab',
                    phone: '02873000004',
                    description:
                        'Vietnamese comfort food and drinks seeded for manual search testing.',
                    addressId: binhThanh.id,
                    ownerId: business3.id,
                    status: RestaurantApprovalStatus.APPROVED,
                    image: '',
                    coverImage: '',
                    minimumOrder: 5,
                    estimatedDeliveryTime: 18,
                }),
                gourmetWorld: await upsertRestaurant(tx, {
                    name: 'Gourmet World Manual Test',
                    phone: '02873000005',
                    description:
                        'Rare fantasy dishes prepared for food, ingredient, voucher, and order testing.',
                    addressId: district1.id,
                    ownerId: business.id,
                    status: RestaurantApprovalStatus.APPROVED,
                    image: '',
                    coverImage: '',
                    minimumOrder: 15,
                    estimatedDeliveryTime: 40,
                }),
            };

            const foods = {
                cheeseburger: await upsertFood(tx, {
                    restaurantId: restaurants.burgerTown.id,
                    categoryId: burgerCategory.id,
                    name: 'Classic Cheeseburger',
                    description:
                        'Beef patty, cheddar, pickles, and burger sauce.',
                    price: 9,
                    label: 'Best seller',
                    image: '',
                    isAvailable: true,
                }),
                doubleBurger: await upsertFood(tx, {
                    restaurantId: restaurants.burgerTown.id,
                    categoryId: burgerCategory.id,
                    name: 'Double Smash Burger',
                    description:
                        'Two beef patties, caramelized onions, cheddar, and house sauce.',
                    price: 12,
                    label: 'Signature',
                    image: '',
                    isAvailable: true,
                }),
                lavaCake: await upsertFood(tx, {
                    restaurantId: restaurants.burgerTown.id,
                    categoryId: dessertCategory.id,
                    name: 'Chocolate Lava Cake',
                    description:
                        'Warm chocolate cake with a soft molten center.',
                    price: 6,
                    label: 'Sweet',
                    image: '',
                    isAvailable: true,
                }),
                grilledChickenRice: await upsertFood(tx, {
                    restaurantId: restaurants.riceExpress.id,
                    categoryId: riceCategory.id,
                    name: 'Grilled Chicken Rice',
                    description:
                        'Char-grilled chicken, jasmine rice, pickles, and scallion oil.',
                    price: 8,
                    label: 'Lunch set',
                    image: '',
                    isAvailable: true,
                }),
                beefNoodles: await upsertFood(tx, {
                    restaurantId: restaurants.riceExpress.id,
                    categoryId: noodlesCategory.id,
                    name: 'Beef Stir-fried Noodles',
                    description:
                        'Wok-fried noodles with sliced beef and crunchy greens.',
                    price: 10,
                    label: 'Hot dish',
                    image: '',
                    isAvailable: true,
                }),
                salmonRoll: await upsertFood(tx, {
                    restaurantId: restaurants.sushiLab.id,
                    categoryId: sushiCategory.id,
                    name: 'Salmon Roll',
                    description: 'Fresh salmon roll with cucumber and seaweed.',
                    price: 11,
                    label: 'Fresh',
                    image: '',
                    isAvailable: true,
                }),
                bunBoHue: await upsertFood(tx, {
                    restaurantId: restaurants.bepVietSearchLab.id,
                    categoryId: noodlesCategory.id,
                    name: 'Bún bò Huế đặc biệt',
                    description:
                        'Spicy beef noodle soup with pork sausage and fresh herbs.',
                    price: 9,
                    label: 'Bún Huế best seller',
                    image: '',
                    isAvailable: true,
                }),
                bunChaHaNoi: await upsertFood(tx, {
                    restaurantId: restaurants.bepVietSearchLab.id,
                    categoryId: noodlesCategory.id,
                    name: 'Bún chả Hà Nội',
                    description:
                        'Grilled pork, rice noodles, herbs, and sweet fish sauce.',
                    price: 7,
                    label: 'Món Việt',
                    image: '',
                    isAvailable: true,
                }),
                milkTea: await upsertFood(tx, {
                    restaurantId: restaurants.bepVietSearchLab.id,
                    categoryId: dessertCategory.id,
                    name: 'Trà sữa trân châu đường đen',
                    description: 'Fresh milk tea with brown sugar pearls.',
                    price: 4,
                    label: 'Trà sữa phổ biến',
                    image: '',
                    isAvailable: true,
                }),
                bbPopcorn: await upsertFood(tx, {
                    restaurantId: restaurants.gourmetWorld.id,
                    categoryId: fantasyGourmetCategory.id,
                    name: 'Bắp rang bơ tẩm gia vị ăn kèm bánh Quicke gà và tôm càng 5 cánh',
                    description:
                        'A fantasy popcorn course prepared for manual food and ingredient testing.',
                    price: 18,
                    label: 'Fantasy appetizer',
                    image: '',
                    isAvailable: true,
                }),
                centurySoup: await upsertFood(tx, {
                    restaurantId: restaurants.gourmetWorld.id,
                    categoryId: fantasyGourmetCategory.id,
                    name: 'Súp thế kỉ, ăn kèm với bánh gạo thuốc',
                    description:
                        'A century soup course served with medicinal rice cake.',
                    price: 25,
                    label: 'Century menu',
                    image: '',
                    isAvailable: true,
                }),
                devilShellCourse: await upsertFood(tx, {
                    restaurantId: restaurants.gourmetWorld.id,
                    categoryId: fantasyGourmetCategory.id,
                    name: 'Sò quỷ, cá quý bà, cá voi trắng, another',
                    description:
                        'A rare seafood assortment from the fantasy gourmet menu.',
                    price: 32,
                    label: 'Rare seafood',
                    image: '',
                    isAvailable: true,
                }),
                endingMammothCourse: await upsertFood(tx, {
                    restaurantId: restaurants.gourmetWorld.id,
                    categoryId: fantasyGourmetCategory.id,
                    name: 'Ma mút kết thúc ăn kèm thịt kim cương, Gia vị bụi sao Melk',
                    description:
                        'Ending mammoth served with diamond meat and Melk stardust seasoning.',
                    price: 45,
                    label: 'Legendary meat',
                    image: '',
                    isAvailable: true,
                }),
                god: await upsertFood(tx, {
                    restaurantId: restaurants.gourmetWorld.id,
                    categoryId: fantasyGourmetCategory.id,
                    name: 'God',
                    description: 'The final fantasy main course.',
                    price: 60,
                    label: 'Ultimate dish',
                    image: '',
                    isAvailable: true,
                }),
                airCourse: await upsertFood(tx, {
                    restaurantId: restaurants.gourmetWorld.id,
                    categoryId: fantasyGourmetCategory.id,
                    name: 'Air ăn kèm với cỏ Ozone',
                    description:
                        'Air served with freshly harvested ozone grass.',
                    price: 50,
                    label: 'Sky course',
                    image: '',
                    isAvailable: true,
                }),
                rainbowPudding: await upsertFood(tx, {
                    restaurantId: restaurants.gourmetWorld.id,
                    categoryId: fantasyGourmetCategory.id,
                    name: 'Pudding trái cầu vồng và sầu riêng bomb',
                    description:
                        'Rainbow fruit pudding paired with explosive durian flavor.',
                    price: 22,
                    label: 'Fantasy dessert',
                    image: '',
                    isAvailable: true,
                }),
                billionBirdDrink: await upsertFood(tx, {
                    restaurantId: restaurants.gourmetWorld.id,
                    categoryId: fantasyGourmetCategory.id,
                    name: 'Thức uống thập ức điểu, pha với Cola say mèm.',
                    description:
                        'A billion-bird drink mixed with strongly fermented cola.',
                    price: 15,
                    label: 'Fantasy drink',
                    image: '',
                    isAvailable: true,
                }),
            };

            const sizeM = sizeMap.get('M');
            if (!sizeM) {
                throw new Error('Size "M" was not created correctly');
            }

            for (const [key, food] of Object.entries(foods)) {
                console.log('Key: ', key);
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

            const beefPatty = ingredientMap.get('Beef Patty');
            const cheddar = ingredientMap.get('Cheddar');
            const chicken = ingredientMap.get('Chicken');
            const salmon = ingredientMap.get('Salmon');
            const cucumber = ingredientMap.get('Cucumber');
            const seaweed = ingredientMap.get('Seaweed');
            const chocolate = ingredientMap.get('Chocolate');
            const bbPopcornIngredient = ingredientMap.get('Bắp rang BB');
            const centurySoupIngredient = ingredientMap.get('Súp thể kỉ');
            const devilShellIngredient = ingredientMap.get(
                'Sò quỷ (Ký ức viễn hải)',
            );
            const endingMammothIngredient = ingredientMap.get(
                'Tuyệt tượng - Ma mút kết thúc',
            );
            const godIngredient = ingredientMap.get('GOD');
            const airIngredient = ingredientMap.get('Air');
            const rainbowFruitIngredient = ingredientMap.get('Trái cầu vồng');
            const billionBirdEggIngredient =
                ingredientMap.get('Trứng thập ức điểu');
            const diamondMeatIngredient = ingredientMap.get('Thịt kim cương');
            const whitePufferfishIngredient = ingredientMap.get('Cá nóc trắng');
            const ozoneGrassIngredient = ingredientMap.get('Cỏ ozone');

            if (
                !beefPatty ||
                !cheddar ||
                !chicken ||
                !salmon ||
                !cucumber ||
                !seaweed ||
                !chocolate ||
                !bbPopcornIngredient ||
                !centurySoupIngredient ||
                !devilShellIngredient ||
                !endingMammothIngredient ||
                !godIngredient ||
                !airIngredient ||
                !rainbowFruitIngredient ||
                !billionBirdEggIngredient ||
                !diamondMeatIngredient ||
                !whitePufferfishIngredient ||
                !ozoneGrassIngredient
            ) {
                throw new Error('Seed ingredients were not created correctly');
            }

            await ensureFoodIngredient(tx, foods.cheeseburger.id, beefPatty.id);
            await ensureFoodIngredient(tx, foods.cheeseburger.id, cheddar.id);
            await ensureFoodIngredient(tx, foods.doubleBurger.id, beefPatty.id);
            await ensureFoodIngredient(tx, foods.doubleBurger.id, cheddar.id);
            await ensureFoodIngredient(
                tx,
                foods.grilledChickenRice.id,
                chicken.id,
            );
            await ensureFoodIngredient(tx, foods.salmonRoll.id, salmon.id);
            await ensureFoodIngredient(tx, foods.salmonRoll.id, cucumber.id);
            await ensureFoodIngredient(tx, foods.salmonRoll.id, seaweed.id);
            await ensureFoodIngredient(tx, foods.lavaCake.id, chocolate.id);
            await ensureFoodIngredient(
                tx,
                foods.bbPopcorn.id,
                bbPopcornIngredient.id,
            );
            await ensureFoodIngredient(
                tx,
                foods.centurySoup.id,
                centurySoupIngredient.id,
            );
            await ensureFoodIngredient(
                tx,
                foods.devilShellCourse.id,
                devilShellIngredient.id,
            );
            await ensureFoodIngredient(
                tx,
                foods.devilShellCourse.id,
                whitePufferfishIngredient.id,
            );
            await ensureFoodIngredient(
                tx,
                foods.endingMammothCourse.id,
                endingMammothIngredient.id,
            );
            await ensureFoodIngredient(
                tx,
                foods.endingMammothCourse.id,
                diamondMeatIngredient.id,
            );
            await ensureFoodIngredient(tx, foods.god.id, godIngredient.id);
            await ensureFoodIngredient(
                tx,
                foods.airCourse.id,
                airIngredient.id,
            );
            await ensureFoodIngredient(
                tx,
                foods.airCourse.id,
                ozoneGrassIngredient.id,
            );
            await ensureFoodIngredient(
                tx,
                foods.rainbowPudding.id,
                rainbowFruitIngredient.id,
            );
            await ensureFoodIngredient(
                tx,
                foods.billionBirdDrink.id,
                billionBirdEggIngredient.id,
            );

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
                    name: 'Bếp Việt Fifteen',
                    code: 'BEPVIET15',
                    description:
                        'Fifteen percent off for testing search promotion tags.',
                    image: '',
                    sale: 15,
                    type: VoucherType.PERCENT,
                    status: VoucherStatus.APPLYING,
                    restaurantId: restaurants.bepVietSearchLab.id,
                    minimumOrderAmount: 12,
                    maximumDiscountAmount: 5,
                    startAt: new Date(now.getTime() - oneDay),
                    endAt: new Date(now.getTime() + 14 * oneDay),
                }),
                gourmet20: await upsertVoucher(tx, {
                    name: 'Gourmet World Twenty',
                    code: 'GOURMET20',
                    description:
                        'Twenty percent off fantasy gourmet orders for manual testing.',
                    image: '',
                    sale: 20,
                    type: VoucherType.PERCENT,
                    status: VoucherStatus.APPLYING,
                    restaurantId: restaurants.gourmetWorld.id,
                    minimumOrderAmount: 50,
                    maximumDiscountAmount: 30,
                    startAt: new Date(now.getTime() - oneDay),
                    endAt: new Date(now.getTime() + 30 * oneDay),
                }),
                fantasy10: await upsertVoucher(tx, {
                    name: 'Fantasy Ten',
                    code: 'FANTASY10',
                    description:
                        'Flat discount for testing voucher application on fantasy orders.',
                    image: '',
                    sale: 10,
                    type: VoucherType.MONEY,
                    status: VoucherStatus.APPLYING,
                    restaurantId: restaurants.gourmetWorld.id,
                    minimumOrderAmount: 30,
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
                totalPrice: 22,
                note: '[seed] delivered burger order',
                deliveredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
                autoConfirmAt: new Date(now.getTime() + 22 * 60 * 60 * 1000),
            });

            await replaceOrderFoods(tx, orderOne.id, [
                {
                    foodId: foods.doubleBurger.id,
                    quantity: 1,
                    fullText: 'No onions',
                    price: 12,
                },
                {
                    foodId: foods.cheeseburger.id,
                    quantity: 1,
                    fullText: 'Extra sauce',
                    price: 9,
                },
                {
                    foodId: foods.lavaCake.id,
                    quantity: 1,
                    fullText: 'Pack separately',
                    price: 6,
                },
            ]);

            await upsertPayment(tx, orderOne.id, {
                method: PaymentMethod.CASH,
                amount: 22,
                paymentStatus: PaymentStatus.DONE,
            });

            const orderTwo = await upsertOrder(tx, {
                restaurantId: restaurants.riceExpress.id,
                userId: customer2.id,
                voucherId: null,
                addressId: thuDuc.id,
                status: OrderStatus.DELIVERED,
                totalPrice: 18,
                note: '[seed] confirmed rice order',
                deliveredAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
                autoConfirmAt: new Date(now.getTime() + 20 * 60 * 60 * 1000),
            });

            await replaceOrderFoods(tx, orderTwo.id, [
                {
                    foodId: foods.grilledChickenRice.id,
                    quantity: 1,
                    fullText: 'Less rice',
                    price: 8,
                },
                {
                    foodId: foods.beefNoodles.id,
                    quantity: 1,
                    fullText: 'No chili',
                    price: 10,
                },
            ]);

            await upsertPayment(tx, orderTwo.id, {
                method: PaymentMethod.MOMO,
                amount: 18,
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
                totalPrice: 19,
                note: '[seed] pending burger order',
            });

            await replaceOrderFoods(tx, orderThree.id, [
                {
                    foodId: foods.doubleBurger.id,
                    quantity: 1,
                    fullText: 'Add napkins',
                    price: 12,
                },
                {
                    foodId: foods.cheeseburger.id,
                    quantity: 1,
                    fullText: 'No pickles',
                    price: 9,
                },
            ]);

            await upsertPayment(tx, orderThree.id, {
                method: PaymentMethod.CASH,
                amount: 19,
                paymentStatus: PaymentStatus.UNPAID,
            });

            const searchOrder = await upsertOrder(tx, {
                restaurantId: restaurants.bepVietSearchLab.id,
                userId: customer2.id,
                voucherId: vouchers.bepViet15.id,
                addressId: thuDuc.id,
                status: OrderStatus.CONFIRMED,
                totalPrice: 35,
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
                    price: 9,
                },
                {
                    foodId: foods.milkTea.id,
                    quantity: 2,
                    fullText: 'Less ice',
                    price: 4,
                },
            ]);

            await upsertPayment(tx, searchOrder.id, {
                method: PaymentMethod.CASH,
                amount: 35,
                paymentStatus: PaymentStatus.DONE,
            });

            await upsertRating(tx, {
                restaurantId: restaurants.bepVietSearchLab.id,
                userId: customer2.id,
                vote: 5,
                comment: 'Great seeded restaurant for search suggestions.',
                orderId: searchOrder.id,
            });

            const gourmetConfirmedOrder = await upsertOrder(tx, {
                restaurantId: restaurants.gourmetWorld.id,
                userId: customer1.id,
                voucherId: vouchers.gourmet20.id,
                addressId: district3.id,
                status: OrderStatus.CONFIRMED,
                totalPrice: 88,
                note: '[seed] confirmed gourmet world order',
                deliveredAt: new Date(now.getTime() - 3 * oneDay),
                confirmedAt: new Date(now.getTime() - 2 * oneDay),
                confirmedBy: ConfirmedBy.CUSTOMER,
            });

            await replaceOrderFoods(tx, gourmetConfirmedOrder.id, [
                {
                    foodId: foods.god.id,
                    quantity: 1,
                    fullText: 'Serve as the final course',
                    price: 60,
                },
                {
                    foodId: foods.airCourse.id,
                    quantity: 1,
                    fullText: 'Extra ozone grass',
                    price: 50,
                },
            ]);

            await upsertPayment(tx, gourmetConfirmedOrder.id, {
                method: PaymentMethod.MOMO,
                amount: 88,
                paymentStatus: PaymentStatus.DONE,
            });

            const gourmetPreparingOrder = await upsertOrder(tx, {
                restaurantId: restaurants.gourmetWorld.id,
                userId: customer2.id,
                voucherId: vouchers.fantasy10.id,
                addressId: thuDuc.id,
                status: OrderStatus.PREPARING,
                totalPrice: 33,
                note: '[seed] preparing gourmet world order',
            });

            await replaceOrderFoods(tx, gourmetPreparingOrder.id, [
                {
                    foodId: foods.bbPopcorn.id,
                    quantity: 1,
                    fullText: 'Pack Quicke cake separately',
                    price: 18,
                },
                {
                    foodId: foods.centurySoup.id,
                    quantity: 1,
                    fullText: 'Serve hot',
                    price: 25,
                },
            ]);

            await upsertPayment(tx, gourmetPreparingOrder.id, {
                method: PaymentMethod.CASH,
                amount: 33,
                paymentStatus: PaymentStatus.UNPAID,
            });

            const gourmetDeliveredOrder = await upsertOrder(tx, {
                restaurantId: restaurants.gourmetWorld.id,
                userId: customer1.id,
                voucherId: null,
                addressId: binhThanh.id,
                status: OrderStatus.DELIVERED,
                totalPrice: 67,
                note: '[seed] delivered gourmet world order',
                deliveredAt: new Date(now.getTime() - 60 * 60 * 1000),
                autoConfirmAt: new Date(now.getTime() + 23 * 60 * 60 * 1000),
            });

            await replaceOrderFoods(tx, gourmetDeliveredOrder.id, [
                {
                    foodId: foods.endingMammothCourse.id,
                    quantity: 1,
                    fullText: 'Extra Melk stardust seasoning',
                    price: 45,
                },
                {
                    foodId: foods.rainbowPudding.id,
                    quantity: 1,
                    fullText: 'Keep chilled',
                    price: 22,
                },
            ]);

            await upsertPayment(tx, gourmetDeliveredOrder.id, {
                method: PaymentMethod.CASH,
                amount: 67,
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
                    foodId: foods.devilShellCourse.id,
                    quantity: 1,
                    fullText: 'No spicy sauce [seed multi-restaurant cart]',
                },
                {
                    foodId: foods.billionBirdDrink.id,
                    quantity: 2,
                    fullText: 'Less ice [seed multi-restaurant cart]',
                },
            ]);

            const searchHistories = [
                { userId: customer1.id, keyword: 'bún bò' },
                { userId: customer1.id, keyword: 'trà sữa' },
                { userId: customer1.id, keyword: 'burger' },
                { userId: customer2.id, keyword: 'bún bò' },
                { userId: customer2.id, keyword: 'trà sữa' },
                { userId: admin.id, keyword: 'bún bò' },
                { userId: business.id, keyword: 'bún bò' },
                { userId: business2.id, keyword: 'trà sữa' },
                { userId: customer1.id, keyword: 'God' },
                { userId: customer2.id, keyword: 'Ma mút kết thúc' },
            ];

            for (const history of searchHistories) {
                await upsertSearchHistory(tx, history.userId, history.keyword);
            }
        },
        {
            maxWait: 10000,
            timeout: 30000,
        },
    );

    console.log('Seed completed successfully.');
    console.log('Test accounts:');
    console.log('ADMIN    phone=0900000001 password=admin123');
    console.log('BUSINESS phone=0900000002 password=business123');
    console.log('CUSTOMER phone=0900000003 password=customer123');
    console.log('CUSTOMER phone=0900000004 password=customer456');
    console.log(
        'Multi-restaurant carts: customer1=Burger Town + Rice Express; customer2=Rice Express + Gourmet World',
    );
    console.log(
        'Search keywords: bún, trà sữa, God, Air, Ma mút, Gourmet World',
    );
    console.log(
        'Voucher codes: WELCOME5, BURGER10, RICEOLD, BEPVIET15, GOURMET20, FANTASY10',
    );
}

main()
    .catch((error) => {
        console.error('Seed failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
