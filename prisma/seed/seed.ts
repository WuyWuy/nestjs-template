import { PrismaClient, Role, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
    }),
});

async function seedAddress() {
    const addresses = [
        {
            title: 'Nguyen Hue',
            latitude: 10.7769,
            longitude: 106.7009,
            fullText: '123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh',
        },
        {
            title: 'Le Loi',
            latitude: 10.7725,
            longitude: 106.698,
            fullText: '45 Le Loi, Ben Thanh, District 1, Ho Chi Minh',
        },
        {
            title: 'Tran Phu',
            latitude: 16.0678,
            longitude: 108.2208,
            fullText: '12 Tran Phu, Hai Chau, Da Nang',
        },
        {
            title: 'Vo Nguyen Giap',
            latitude: 16.0515,
            longitude: 108.2478,
            fullText: '88 Vo Nguyen Giap, Ngu Hanh Son, Da Nang',
        },
        {
            title: 'Hung Vuong',
            latitude: 16.4637,
            longitude: 107.5909,
            fullText: '7 Hung Vuong, Hue',
        },
    ];

    console.log('🌱 Seeding addresses...');

    await prisma.address.createMany({
        data: addresses,
        skipDuplicates: true,
    });

    console.log(`✅ Seeded 5 addresses`);
}

async function seedCategories() {
    console.log('🌱 Seeding categories...');

    const categories = [
        { name: 'Pizza', description: 'Delicious Italian pizzas with various toppings' },
        { name: 'Burger', description: 'Classic and gourmet burgers' },
        { name: 'Pasta', description: 'Traditional Italian pasta dishes' },
        { name: 'Sushi', description: 'Fresh sushi and rolls' },
        { name: 'Dessert', description: 'Sweet desserts and pastries' },
    ];

    await prisma.category.createMany({
        data: categories,
        skipDuplicates: true,
    });

    console.log(`✅ Seeded 5 categories`);
}

async function seedIngredients() {
    console.log('🌱 Seeding ingredients...');

    const ingredients = [
        { name: 'Tomato', icon: '🍅' },
        { name: 'Cheese', icon: '🧀' },
        { name: 'lettuce', icon: '🥬' },
        { name: 'Bacon', icon: '🥓' },
        { name: 'Shrimp', icon: '🦐' },
        { name: 'Rice', icon: '🍚' },
        { name: 'Avocado', icon: '🥑' },
        { name: 'Olive Oil', icon: '🫒' },
    ];

    await prisma.ingredient.createMany({
        data: ingredients,
        skipDuplicates: true,
    });

    console.log(`✅ Seeded 8 ingredients`);
}

async function seedUsers() {
    console.log('🌱 Seeding users...');

    const users = [
        {
            name: 'Admin',
            email: 'admin@gmail.com',
            password: await hashPassword('admin'),
            phone: '0984120972',
            birthday: new Date(2006, 0, 19),
            active: true,
        },
        {
            name: 'Business Owner',
            email: 'business@gmail.com',
            password: await hashPassword('business123'),
            phone: '0987654321',
            birthday: new Date(1990, 5, 15),
            active: true,
        },
        {
            name: 'John Customer',
            email: 'john@gmail.com',
            password: await hashPassword('john123'),
            phone: '0912345678',
            birthday: new Date(1998, 3, 22),
            active: true,
        },
        {
            name: 'Jane Customer',
            email: 'jane@gmail.com',
            password: await hashPassword('jane123'),
            phone: '0923456789',
            birthday: new Date(2000, 8, 10),
            active: true,
        },
    ];

    const createdUsers: any[] = [];
    for (const userData of users) {
        const existing = await prisma.user.findUnique({
            where: { email: userData.email },
        });

        if (!existing) {
            const user = await prisma.user.create({
                data: userData,
            });
            createdUsers.push(user);
        } else {
            createdUsers.push(existing);
        }
    }

    // Assign roles
    const admin = createdUsers[0];
    const business = createdUsers[1];
    const customer1 = createdUsers[2];
    const customer2 = createdUsers[3];

    await prisma.userRole.createMany({
        data: [
            { userId: admin.id, role: Role.ADMIN },
            { userId: admin.id, role: Role.BUSINESS },
            { userId: admin.id, role: Role.CUSTOMER },
            { userId: business.id, role: Role.BUSINESS },
            { userId: business.id, role: Role.CUSTOMER },
            { userId: customer1.id, role: Role.CUSTOMER },
            { userId: customer2.id, role: Role.CUSTOMER },
        ],
        skipDuplicates: true,
    });

    // Assign addresses to users
    const addresses = await prisma.address.findMany();
    if (addresses.length > 0) {
        await prisma.userAddress.createMany({
            data: [
                { userId: admin.id, addressId: addresses[0].id, title: 'Home' },
                { userId: business.id, addressId: addresses[0].id, title: 'Business' },
                { userId: customer1.id, addressId: addresses[1].id, title: 'Home' },
                { userId: customer1.id, addressId: addresses[2].id, title: 'Office' },
                { userId: customer2.id, addressId: addresses[1].id, title: 'Home' },
            ],
            skipDuplicates: true,
        });
    }

    console.log(`✅ Seeded 4 users with roles and addresses`);
    return { admin, business, customer1, customer2 };
}

async function seedRestaurants(businessUser: any) {
    console.log('🌱 Seeding restaurants...');

    const addresses = await prisma.address.findMany();
    if (addresses.length === 0) {
        throw new Error('❌ No addresses found');
    }

    const restaurants = [
        { code: 'REST001', name: 'Pizza Palace', phone: '0901111111', addressId: addresses[0].id },
        { code: 'REST002', name: 'Burger Heaven', phone: '0902222222', addressId: addresses[1].id },
        { code: 'REST003', name: 'Pasta Magic', phone: '0903333333', addressId: addresses[2].id },
        { code: 'REST004', name: 'Sushi Dreams', phone: '0904444444', addressId: addresses[3].id },
        { code: 'REST005', name: 'Sweet Desserts', phone: '0905555555', addressId: addresses[4].id },
    ];

    // Use createMany with skipDuplicates to avoid failing when a code already exists
    await prisma.restaurant.createMany({
        data: restaurants.map((rest) => ({
            ...rest,
            ownerId: businessUser.id,
            approved: true,
        })),
        skipDuplicates: true,
    });

    const createdRestaurants = await prisma.restaurant.findMany({
        where: {
            code: { in: restaurants.map((r) => r.code) },
        },
    });

    console.log(`✅ Seeded ${createdRestaurants.length} restaurants`);
    return createdRestaurants;
}



async function seedFoods(menus: any[]) {
    console.log('🌱 Seeding foods...');

    const categories = await prisma.category.findMany();
    const ingredients = await prisma.ingredient.findMany();

    if (categories.length === 0) {
        throw new Error('❌ No categories found');
    }

    const foods = [
        { code: 'FOOD001', name: 'Margherita Pizza', categoryId: categories[0].id, price: 12.99, description: 'Classic pizza with tomato and cheese' },
        { code: 'FOOD002', name: 'Pepperoni Pizza', categoryId: categories[0].id, price: 14.99, description: 'Spicy pepperoni pizza' },
        { code: 'FOOD003', name: 'Classic Burger', categoryId: categories[1].id, price: 9.99, description: 'Juicy beef burger with lettuce and tomato' },
        { code: 'FOOD004', name: 'Bacon Burger', categoryId: categories[1].id, price: 11.99, description: 'Burger with crispy bacon' },
        { code: 'FOOD005', name: 'Spaghetti Carbonara', categoryId: categories[2].id, price: 13.99, description: 'Traditional Italian pasta with creamy sauce' },
        { code: 'FOOD006', name: 'Penne Alfredo', categoryId: categories[2].id, price: 12.99, description: 'Creamy pasta with parmesan cheese' },
        { code: 'FOOD007', name: 'California Roll', categoryId: categories[3].id, price: 10.99, description: 'Fresh sushi roll with avocado and crab' },
        { code: 'FOOD008', name: 'Spicy Tuna Roll', categoryId: categories[3].id, price: 11.99, description: 'Spicy tuna sushi roll' },
        { code: 'FOOD009', name: 'Chocolate Cake', categoryId: categories[4].id, price: 6.99, description: 'Rich chocolate cake with frosting' },
        { code: 'FOOD010', name: 'Cheesecake', categoryId: categories[4].id, price: 7.99, description: 'Creamy New York style cheesecake' },
    ];

    const createdFoods: any[] = [];

    // 👉 chia đều foods cho menus
    const foodsPerMenu = Math.ceil(foods.length / menus.length);

    for (let i = 0; i < menus.length; i++) {
        const menu = menus[i];
        const startIdx = i * foodsPerMenu;
        const endIdx = startIdx + foodsPerMenu;

        for (let j = startIdx; j < endIdx && j < foods.length; j++) {
            const food = await prisma.food.create({
                data: {
                    ...foods[j],
                    menuId: menu.id, // ✅ QUAN TRỌNG
                },
            });
            createdFoods.push(food);
        }
    }

    // link ingredients (giữ nguyên)
    if (ingredients.length > 0) {
        await prisma.foodIngredient.createMany({
            data: [
                { foodId: createdFoods[0].id, ingredientId: ingredients[0].id },
                { foodId: createdFoods[0].id, ingredientId: ingredients[1].id },
                { foodId: createdFoods[2].id, ingredientId: ingredients[2].id },
                { foodId: createdFoods[2].id, ingredientId: ingredients[0].id },
                { foodId: createdFoods[3].id, ingredientId: ingredients[3].id },
                { foodId: createdFoods[6].id, ingredientId: ingredients[4].id },
                { foodId: createdFoods[6].id, ingredientId: ingredients[6].id },
            ],
            skipDuplicates: true,
        });
    }

    console.log(`✅ Seeded ${createdFoods.length} foods`);
    return createdFoods;
}
async function seedMenus(restaurants: any[]) {
    console.log('🌱 Seeding menus (1 restaurant = 1 menu)...');

    if (!Array.isArray(restaurants) || restaurants.length === 0) {
        throw new Error('No restaurants provided to seedMenus');
    }

    const processed = restaurants
        .map((r) => ({
            ...r,
            _id: r && (typeof r.id === 'bigint' ? Number(r.id) : r.id),
        }))
        .filter((r) => r && typeof r._id === 'number');

    if (processed.length !== restaurants.length) {
        console.warn('Some restaurants are missing numeric `id` and will be skipped:', restaurants);
    }

    console.log('Processed restaurants for menus:', processed.map((r) => ({ code: r.code, _id: r._id })));

    const menus = await Promise.all(
        processed.map((restaurant) =>
            prisma.menu.create({
                data: {
                    restaurantId: restaurant._id,
                },
            }),
        ),
    );

    console.log(`✅ Seeded ${menus.length} menus`);
    return menus;
}

async function seedOrders(businessUser: any, customer1: any, customer2: any, restaurants: any[]) {
    console.log('🌱 Seeding orders...');

    const orders = [
        { code: 'ORDER001', restaurantId: restaurants[0].id, totalPrice: 35.97, status: OrderStatus.DELIVERED },
        { code: 'ORDER002', restaurantId: restaurants[1].id, totalPrice: 23.98, status: OrderStatus.DELIVERED },
        { code: 'ORDER003', restaurantId: restaurants[2].id, totalPrice: 26.98, status: OrderStatus.CONFIRMED },
        { code: 'ORDER004', restaurantId: restaurants[3].id, totalPrice: 22.98, status: OrderStatus.PREPARING },
        { code: 'ORDER005', restaurantId: restaurants[0].id, totalPrice: 29.97, status: OrderStatus.DELIVERING },
        { code: 'ORDER006', restaurantId: restaurants[4].id, totalPrice: 14.98, status: OrderStatus.PENDING },
    ];

    const createdOrders = await Promise.all(
        orders.map((order) => prisma.order.create({ data: order })),
    );

    console.log(`✅ Seeded 6 orders`);
    return createdOrders;
}

async function seedOrderFoods(orders: any[], foods: any[]) {
    console.log('🌱 Seeding order foods...');

    await prisma.address.findMany();
    const orderFoods = [
        {
            orderId: orders[0].id,
            foodId: foods[0].id,
            quantity: 2,
            price: 12.99,
            latitude: 10.7769,
            longitude: 106.7009,
            fullText: '123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh',
        },
        {
            orderId: orders[0].id,
            foodId: foods[1].id,
            quantity: 1,
            price: 14.99,
            latitude: 10.7769,
            longitude: 106.7009,
            fullText: '123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh',
        },
        {
            orderId: orders[1].id,
            foodId: foods[2].id,
            quantity: 2,
            price: 9.99,
            latitude: 10.7725,
            longitude: 106.698,
            fullText: '45 Le Loi, Ben Thanh, District 1, Ho Chi Minh',
        },
        {
            orderId: orders[2].id,
            foodId: foods[4].id,
            quantity: 2,
            price: 13.99,
            latitude: 16.0678,
            longitude: 108.2208,
            fullText: '12 Tran Phu, Hai Chau, Da Nang',
        },
        {
            orderId: orders[3].id,
            foodId: foods[6].id,
            quantity: 2,
            price: 10.99,
            latitude: 16.0515,
            longitude: 108.2478,
            fullText: '88 Vo Nguyen Giap, Ngu Hanh Son, Da Nang',
        },
        {
            orderId: orders[4].id,
            foodId: foods[3].id,
            quantity: 1,
            price: 11.99,
            latitude: 10.7769,
            longitude: 106.7009,
            fullText: '123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh',
        },
        {
            orderId: orders[5].id,
            foodId: foods[9].id,
            quantity: 2,
            price: 7.99,
            latitude: 16.4637,
            longitude: 107.5909,
            fullText: '7 Hung Vuong, Hue',
        },
    ];

    await prisma.orderFood.createMany({
        data: orderFoods,
    });

    console.log(`✅ Seeded order foods`);
}

async function seedPayments(orders: any[]) {
    console.log('🌱 Seeding payments...');

    const payments = [
        { orderId: orders[0].id, method: PaymentMethod.CASH, amount: 35.97, status: PaymentStatus.DONE },
        { orderId: orders[1].id, method: PaymentMethod.MOMO, amount: 23.98, status: PaymentStatus.DONE },
        { orderId: orders[2].id, method: PaymentMethod.ZALOPAY, amount: 26.98, status: PaymentStatus.SOLVING },
        { orderId: orders[3].id, method: PaymentMethod.BANK, amount: 22.98, status: PaymentStatus.SOLVING },
        { orderId: orders[4].id, method: PaymentMethod.CASH, amount: 29.97, status: PaymentStatus.DONE },
        { orderId: orders[5].id, method: PaymentMethod.MOMO, amount: 14.98, status: PaymentStatus.SOLVING },
    ];

    await prisma.payment.createMany({
        data: payments,
    });

    console.log(`✅ Seeded 6 payments`);
}

async function seedConversations(businessUser: any, customer1: any, customer2: any, orders: any[]) {
    console.log('🌱 Seeding conversations...');

    const conversations = [
        { orderId: orders[0].id, customerId: customer1.id, sellerId: businessUser.id },
        { orderId: orders[1].id, customerId: customer1.id, sellerId: businessUser.id },
        { orderId: orders[2].id, customerId: customer2.id, sellerId: businessUser.id },
        { orderId: orders[3].id, customerId: customer2.id, sellerId: businessUser.id },
        { orderId: orders[4].id, customerId: customer1.id, sellerId: businessUser.id },
        { orderId: orders[5].id, customerId: customer2.id, sellerId: businessUser.id },
    ];

    const createdConversations = await Promise.all(
        conversations.map((conv) => prisma.conversation.create({ data: conv })),
    );

    console.log(`✅ Seeded 6 conversations`);
    return createdConversations;
}

async function seedMessages(conversations: any[], businessUser: any, customer1: any, customer2: any) {
    console.log('🌱 Seeding messages...');

    const messages = [
        { conversationId: conversations[0].id, senderId: customer1.id, content: 'When will my order arrive?' },
        { conversationId: conversations[0].id, senderId: businessUser.id, content: 'It will be there in 30 minutes' },
        { conversationId: conversations[1].id, senderId: customer1.id, content: 'Can I add extra cheese?' },
        { conversationId: conversations[1].id, senderId: businessUser.id, content: 'Sure, no problem!' },
        { conversationId: conversations[2].id, senderId: customer2.id, content: 'Is it fresh?' },
        { conversationId: conversations[2].id, senderId: businessUser.id, content: 'Yes, made fresh today' },
        { conversationId: conversations[3].id, senderId: customer2.id, content: 'Any discounts available?' },
        { conversationId: conversations[3].id, senderId: businessUser.id, content: 'Subscribe for 10% off' },
        { conversationId: conversations[4].id, senderId: customer1.id, content: 'Thank you!' },
        { conversationId: conversations[4].id, senderId: businessUser.id, content: 'You are welcome!' },
        { conversationId: conversations[5].id, senderId: customer2.id, content: 'Great food!' },
        { conversationId: conversations[5].id, senderId: businessUser.id, content: 'Thanks for your order!' },
    ];

    await prisma.message.createMany({
        data: messages,
    });

    console.log(`✅ Seeded 12 messages`);
}

async function seedCarts(customer1: any, customer2: any, restaurants: any[], foods: any[]) {
    console.log('🌱 Seeding carts...');

    const carts = [
        { userId: customer1.id, restaurantId: restaurants[0].id },
        { userId: customer2.id, restaurantId: restaurants[1].id },
    ];

    const createdCarts = await Promise.all(
        carts.map((cart) => prisma.cart.create({ data: cart })),
    );

    // Add items to carts
    const cartItems = [
        { cartId: createdCarts[0].id, foodId: foods[0].id, quantity: 2 },
        { cartId: createdCarts[0].id, foodId: foods[1].id, quantity: 1 },
        { cartId: createdCarts[1].id, foodId: foods[2].id, quantity: 3 },
        { cartId: createdCarts[1].id, foodId: foods[3].id, quantity: 1 },
    ];

    await prisma.cartItem.createMany({
        data: cartItems,
    });

    console.log(`✅ Seeded 2 carts with 4 items`);
}

async function hashPassword(password: string): Promise<string> {
    return await Bun.password.hash(password, {
        cost: 10,
        algorithm: 'bcrypt',
    });
}

async function main() {
    try {
        await prisma.$transaction(async () => {
            await seedAddress();
            await seedCategories();
            await seedIngredients();

            const users = await seedUsers();
            const restaurants = await seedRestaurants(users.business);
            // Ensure DB columns match current Prisma models: drop legacy Menu.foodId if present
            try {
                await prisma.$executeRawUnsafe('ALTER TABLE "Menu" DROP COLUMN IF EXISTS "foodId";');
                console.log('Adjusted DB: dropped legacy Menu.foodId column if it existed');
            } catch (e) {
                console.warn('Could not adjust DB schema automatically:', e);
            }

            // 🔥 NEW FLOW
            const menus = await seedMenus(restaurants);
            const foods = await seedFoods(menus);

            const orders = await seedOrders(users.business, users.customer1, users.customer2, restaurants);
            await seedOrderFoods(orders, foods);
            await seedPayments(orders);

            const conversations = await seedConversations(users.business, users.customer1, users.customer2, orders);
            await seedMessages(conversations, users.business, users.customer1, users.customer2);

            await seedCarts(users.customer1, users.customer2, restaurants, foods);
        });

        console.log('🎉 Seeding completed successfully');
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}
main();
