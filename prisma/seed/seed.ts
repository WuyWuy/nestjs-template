import { PrismaClient, Role } from '@prisma/client';
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

    console.log(`✅ Seeded addresses`);
}

async function seedAdminAccount() {
    console.log('🌱 Seeding admin account...');

    const email = 'admin@gmail.com';
    const password = 'admin';

    const existing = await prisma.user.findUnique({
        where: { email },
    });

    if (existing) {
        console.log('⚠️ Admin already exists, skipping...');
        return;
    }

    const hashPassword = await Bun.password.hash(password, {
        cost: 10,
        algorithm: 'bcrypt',
    });

    const address = await prisma.address.findFirst();

    if (!address) {
        throw new Error('❌ No address found. Seed address first.');
    }

    const admin = await prisma.user.create({
        data: {
            name: 'Admin',
            email,
            password: hashPassword,
            active: true,
            phone: '0984120972',
            birthday: new Date(2006, 0, 19),
        },
    });

    // 🔥 NEW: phải có title cho UserAddress
    await prisma.userAddress.create({
        data: {
            userId: admin.id,
            addressId: address.id,
            title: 'Home', // 👈 quan trọng
        },
    });

    await prisma.userRole.createMany({
        data: [
            { userId: admin.id, role: Role.ADMIN },
            { userId: admin.id, role: Role.BUSINESS },
            { userId: admin.id, role: Role.CUSTOMER },
        ],
    });

    console.log('✅ Admin created:');
    console.log('   Email:', email);
    console.log('   Password:', password);
}

async function main() {
    try {
        await prisma.$transaction(async () => {
            await seedAddress();
            await seedAdminAccount();
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
