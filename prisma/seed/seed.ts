//Gpt da fix cho modern :)) 
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
    }),
});

async function seedAddress() {
    const addresses = [
        {
            street: "123 Nguyen Hue",
            ward: "Ben Nghe",
            district: "District 1",
            city: "Ho Chi Minh",
            latitude: 10.7769,
            longitude: 106.7009,
            fullText: "123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh",
        },
        {
            street: "45 Le Loi",
            ward: "Ben Thanh",
            district: "District 1",
            city: "Ho Chi Minh",
            latitude: 10.7725,
            longitude: 106.698,
            fullText: "45 Le Loi, Ben Thanh, District 1, Ho Chi Minh",
        },
        {
            street: "12 Tran Phu",
            ward: "Phuoc Ninh",
            district: "Hai Chau",
            city: "Da Nang",
            latitude: 16.0678,
            longitude: 108.2208,
            fullText: "12 Tran Phu, Phuoc Ninh, Hai Chau, Da Nang",
        },
        {
            street: "88 Vo Nguyen Giap",
            ward: "My An",
            district: "Ngu Hanh Son",
            city: "Da Nang",
            latitude: 16.0515,
            longitude: 108.2478,
            fullText: "88 Vo Nguyen Giap, My An, Ngu Hanh Son, Da Nang",
        },
        {
            street: "7 Hung Vuong",
            ward: "Phu Hoi",
            district: "Hue",
            city: "Thua Thien Hue",
            latitude: 16.4637,
            longitude: 107.5909,
            fullText: "7 Hung Vuong, Phu Hoi, Hue, Thua Thien Hue",
        },
    ];

    console.log("🌱 Seeding addresses...");

    await prisma.address.createMany({
        data: addresses,
        skipDuplicates: true, // 🔥 quan trọng
    });

    console.log(`✅ Seeded ${addresses.length} addresses`);
}

async function seedAdminAccount() {
    console.log("🌱 Seeding admin account...");

    const email = "admin@gmail.com";
    const password = "admin";

    // check tồn tại trước (idempotent)
    const existing = await prisma.user.findUnique({
        where: { email },
    });

    if (existing) {
        console.log("⚠️ Admin already exists, skipping...");
        return;
    }

    const hashPassword = await Bun.password.hash(password, {
        cost: 10,
        algorithm: "bcrypt",
    });

    // lấy 1 address bất kỳ (tránh hardcode id = 1)
    const address = await prisma.address.findFirst();

    if (!address) {
        throw new Error("❌ No address found. Seed address first.");
    }

    const admin = await prisma.user.create({
        data: {
            name: "Admin",
            email,
            password: hashPassword,
            active: true,
            addressId: address.id,
        },
    });

    await prisma.userRole.createMany({
        data: [
            { userId: admin.id, role: Role.ADMIN },
            { userId: admin.id, role: Role.BUSINESS },
            { userId: admin.id, role: Role.CUSTOMER },
        ],
    });

    console.log("✅ Admin created:");
    console.log("   Email:", email);
    console.log("   Password:", password);
}

async function main() {
    try {
        await prisma.$transaction(async () => {
            await seedAddress();
            await seedAdminAccount();
        });

        console.log("🎉 Seeding completed successfully");
    } catch (err) {
        console.error("❌ Seeding failed:", err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();