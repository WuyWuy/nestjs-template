import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
    }),
});
async function seedUserAccounts() {
    console.log('🌱 Seeding customer & business accounts...');

    const users = [
        {
            name: 'Customer User',
            email: 'customer@gmail.com',
            password: 'customer',
            role: Role.CUSTOMER,
        },
        {
            name: 'Business User',
            email: 'business@gmail.com',
            password: 'business',
            role: Role.BUSINESS,
        },
    ];

    const address = await prisma.address.findFirst();

    if (!address) {
        throw new Error('❌ No address found. Seed address first.');
    }

    for (const u of users) {
        const existing = await prisma.user.findUnique({
            where: { email: u.email },
        });

        if (existing) {
            console.log(`⚠️ ${u.email} already exists, skipping...`);
            continue;
        }

        const hashPassword = await Bun.password.hash(u.password, {
            cost: 10,
            algorithm: 'bcrypt',
        });

        const user = await prisma.user.create({
            data: {
                name: u.name,
                email: u.email,
                password: hashPassword,
                active: true,
                phone: '0123456789',
                birthday: new Date(2000, 0, 1),
            },
        });

        // address
        await prisma.userAddress.create({
            data: {
                userId: user.id,
                addressId: address.id,
                title: 'Home',
            },
        });

        // role
        await prisma.userRole.create({
            data: {
                userId: user.id,
                role: u.role,
            },
        });

        console.log(`✅ Created ${u.role}:`);
        console.log(`   Email: ${u.email}`);
        console.log(`   Password: ${u.password}`);
    }
}

async function main() {
    try {
        await prisma.$transaction(async () => {
            await seedUserAccounts() 
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
