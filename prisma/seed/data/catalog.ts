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
    {
        name: 'Pizza',
        description: 'Wood-fired pies, flatbreads, and Italian sides.',
        sortOrder: 7,
        image: seedImages.categories.pizza,
    },
    {
        name: 'Seafood',
        description: 'Grilled fish, shrimp plates, and coastal favorites.',
        sortOrder: 8,
        image: seedImages.categories.seafood,
    },
    {
        name: 'Korean',
        description: 'BBQ plates, bibimbap, and spicy stews.',
        sortOrder: 9,
        image: seedImages.categories.korean,
    },
    {
        name: 'Healthy',
        description: 'Salads, grain bowls, and lighter everyday meals.',
        sortOrder: 10,
        image: seedImages.categories.healthy,
    },
    {
        name: 'Breakfast',
        description: 'Morning sets, eggs, pastries, and coffee pairings.',
        sortOrder: 11,
        image: seedImages.categories.breakfast,
    },
    {
        name: 'BBQ',
        description: 'Charcoal grills, smoked meats, and sharing platters.',
        sortOrder: 12,
        image: seedImages.categories.bbq,
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
    fries: ['Corn', 'Chili'],
    lavaCake: ['Fresh Milk', 'Corn'],

    grilledChickenRice: ['Rice', 'Pork', 'Fresh Herbs'],
    lemongrassPorkRice: ['Rice', 'Pork', 'Mint'],
    comTamSuon: ['Rice', 'Pork', 'Fresh Herbs'],
    beefNoodles: ['Noodles', 'Pork', 'Mint', 'Chili'],

    salmonRoll: ['Seafood', 'Fresh Herbs'],
    chickenTeriyakiRoll: ['Pork', 'Fresh Herbs', 'Rice'],
    tunaRoll: ['Seafood', 'Fresh Herbs', 'Chili'],

    bunBoHue: ['Noodles', 'Pork', 'Mint', 'Chili'],
    bunChaHaNoi: ['Noodles', 'Pork', 'Fresh Herbs'],
    phoBo: ['Noodles', 'Pork', 'Mint', 'Fresh Herbs'],
    goiCuon: ['Seafood', 'Fresh Herbs', 'Mint'],
    milkTea: ['Black Tea', 'Fresh Milk', 'Tapioca Pearls'],

    classicMilkTea: ['Black Tea', 'Fresh Milk', 'Tapioca Pearls'],
    matchaLatte: ['Fresh Milk', 'Mint'],
    mangoSmoothie: ['Fresh Milk', 'Corn'],
    puddingFlan: ['Fresh Milk', 'Corn'],
    seafoodFriedRice: ['Rice', 'Seafood', 'Fresh Herbs', 'Chili'],

    margheritaPizza: ['Fresh Herbs', 'Corn'],
    pepperoniPizza: ['Pork', 'Chili'],
    bbqChickenPizza: ['Pork', 'Fresh Herbs'],
    garlicBread: ['Corn', 'Fresh Herbs'],
    caesarSalad: ['Fresh Herbs', 'Corn'],
    tiramisu: ['Fresh Milk', 'Corn'],

    vietnameseCoffee: ['Black Tea', 'Fresh Milk'],
    cappuccino: ['Fresh Milk', 'Black Tea'],
    icedLatte: ['Fresh Milk', 'Black Tea'],
    croissant: ['Fresh Milk', 'Corn'],
    banhMi: ['Burger Bun', 'Pork', 'Fresh Herbs', 'Chili'],

    bbqRibs: ['Pork', 'Chili', 'Fresh Herbs'],
    grilledPorkPlate: ['Pork', 'Rice', 'Fresh Herbs'],
    cornOnCob: ['Corn', 'Chili'],
    stickyRice: ['Rice', 'Pork', 'Fresh Herbs'],
    icedTea: ['Black Tea', 'Mint'],

    tomYumSeafood: ['Seafood', 'Chili', 'Fresh Herbs', 'Mint'],
    grilledSalmon: ['Seafood', 'Fresh Herbs', 'Corn'],
    garlicButterShrimp: ['Seafood', 'Chili', 'Fresh Herbs'],
    calamariRings: ['Seafood', 'Corn', 'Chili'],

    bibimbap: ['Rice', 'Pork', 'Chili', 'Fresh Herbs'],
    koreanFriedChicken: ['Pork', 'Chili', 'Corn'],
    kimchiJjigae: ['Pork', 'Chili', 'Fresh Herbs'],
    beefBulgogi: ['Pork', 'Rice', 'Fresh Herbs'],

    quinoaBowl: ['Rice', 'Fresh Herbs', 'Corn'],
    grilledChickenSalad: ['Pork', 'Fresh Herbs', 'Mint'],
    avocadoToast: ['Corn', 'Fresh Herbs', 'Fresh Milk'],
    acaiBowl: ['Fresh Milk', 'Corn', 'Mint'],

    fullEnglish: ['Pork', 'Corn', 'Fresh Herbs'],
    pancakeStack: ['Fresh Milk', 'Corn'],
    baconEggSandwich: ['Pork', 'Burger Bun', 'Fresh Herbs'],
    fruitParfait: ['Fresh Milk', 'Corn', 'Mint'],

    pho24Special: ['Noodles', 'Pork', 'Mint', 'Fresh Herbs'],
    tokyoShoyuRamen: ['Noodles', 'Pork', 'Fresh Herbs'],
    misoRamen: ['Noodles', 'Seafood', 'Fresh Herbs'],
    spicyTonkotsu: ['Noodles', 'Pork', 'Chili'],

    smokedBrisket: ['Pork', 'Chili', 'Fresh Herbs'],
    bbqPorkRibs: ['Pork', 'Chili'],
    grilledSausagePlate: ['Pork', 'Corn', 'Chili'],
};
