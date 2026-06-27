import { seedImages } from './media-urls';

export const categories = [
    {
        name: 'Burger',
        description:
            'Smash burgers, chicken burgers, and comfort food classics.',
        sortOrder: 1,
        image: seedImages.categories.burger,
    },
    {
        name: 'Rice',
        description: 'Rice bowls and grilled protein combos for everyday meals.',
        sortOrder: 2,
        image: seedImages.categories.rice,
    },
    {
        name: 'Sushi',
        description: 'Rolls, nigiri, and light Japanese favorites.',
        sortOrder: 3,
        image: seedImages.categories.sushi,
    },
    {
        name: 'Noodles',
        description: 'Pho, bun, and stir-fried noodle dishes.',
        sortOrder: 4,
        image: seedImages.categories.noodles,
    },
    {
        name: 'Dessert',
        description: 'Sweet add-ons and comfort desserts.',
        sortOrder: 5,
        image: seedImages.categories.dessert,
    },
    {
        name: 'Drinks',
        description: 'Milk tea, coffee, and fruit drinks.',
        sortOrder: 6,
        image: seedImages.categories.drinks,
    },
] as const;

/** 12 ingredients — icon keys map to Material Icons on FE. */
export const ingredients = [
    { name: 'Pork', icon: 'pork' },
    { name: 'Fresh Herbs', icon: 'herbs' },
    { name: 'Mint', icon: 'mint' },
    { name: 'Burger Bun', icon: 'bun' },
    { name: 'Rice', icon: 'rice' },
    { name: 'Noodles', icon: 'noodle' },
    { name: 'Chili', icon: 'chili' },
    { name: 'Fresh Milk', icon: 'milk' },
    { name: 'Tapioca Pearls', icon: 'boba' },
    { name: 'Black Tea', icon: 'tea' },
    { name: 'Corn', icon: 'corn' },
    { name: 'Seafood', icon: 'seafood' },
] as const;

export type IngredientName = (typeof ingredients)[number]['name'];

/** food seed key → ingredient display names */
export const foodIngredientLinks: Record<string, IngredientName[]> = {
    cheeseburger: ['Burger Bun', 'Pork', 'Chili', 'Fresh Herbs'],
    doubleBurger: ['Burger Bun', 'Pork', 'Chili'],
    chickenBurger: ['Burger Bun', 'Pork', 'Fresh Herbs'],
    lavaCake: ['Fresh Milk', 'Corn'],

    grilledChickenRice: ['Rice', 'Pork', 'Fresh Herbs'],
    lemongrassPorkRice: ['Rice', 'Pork', 'Mint'],
    beefNoodles: ['Noodles', 'Pork', 'Mint', 'Chili'],

    salmonRoll: ['Seafood', 'Fresh Herbs'],
    chickenTeriyakiRoll: ['Pork', 'Fresh Herbs', 'Rice'],

    bunBoHue: ['Noodles', 'Pork', 'Mint', 'Chili'],
    bunChaHaNoi: ['Noodles', 'Pork', 'Fresh Herbs'],
    phoBo: ['Noodles', 'Pork', 'Mint', 'Fresh Herbs'],
    milkTea: ['Black Tea', 'Fresh Milk', 'Tapioca Pearls'],

    classicMilkTea: ['Black Tea', 'Fresh Milk', 'Tapioca Pearls'],
    matchaLatte: ['Fresh Milk', 'Mint'],
    mangoSmoothie: ['Fresh Milk', 'Corn'],
    puddingFlan: ['Fresh Milk', 'Corn'],
    seafoodFriedRice: ['Rice', 'Seafood', 'Fresh Herbs', 'Chili'],
};
