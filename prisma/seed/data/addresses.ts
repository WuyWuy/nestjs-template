/** Shared map pins + Photon-style place titles (Address.title). */
export const addressSeeds = [
    {
        key: 'district-1',
        title: 'Nguyen Hue Walking Street',
        latitude: 10.776889,
        longitude: 106.700806,
        fullText: '123 Nguyen Hue, Ben Nghe Ward, District 1, Ho Chi Minh City',
    },
    {
        key: 'district-3',
        title: 'Vo Van Tan',
        latitude: 10.786749,
        longitude: 106.690529,
        fullText: '45 Vo Van Tan, Ward 6, District 3, Ho Chi Minh City',
    },
    {
        key: 'phu-nhuan',
        title: 'Hoang Van Thu',
        latitude: 10.799055,
        longitude: 106.680168,
        fullText: '12 Hoang Van Thu, Ward 9, Phu Nhuan, Ho Chi Minh City',
    },
    {
        key: 'thu-duc',
        title: 'Vo Van Ngan',
        latitude: 10.845161,
        longitude: 106.794357,
        fullText: '99 Vo Van Ngan, Linh Chieu Ward, Thu Duc City, Ho Chi Minh City',
    },
    {
        key: 'binh-thanh',
        title: 'Dien Bien Phu',
        latitude: 10.808153,
        longitude: 106.709572,
        fullText: '18 Dien Bien Phu, Ward 15, Binh Thanh, Ho Chi Minh City',
    },
    {
        key: 'district-7',
        title: 'Phu My Hung',
        latitude: 10.728512,
        longitude: 106.719302,
        fullText: '101 Nguyen Luong Bang, Tan Phu Ward, District 7, Ho Chi Minh City',
    },
    {
        key: 'go-vap',
        title: 'Quang Trung',
        latitude: 10.838648,
        longitude: 106.665236,
        fullText: '220 Quang Trung, Ward 10, Go Vap, Ho Chi Minh City',
    },
    {
        key: 'tan-binh',
        title: 'Tan Son Nhat Airport Area',
        latitude: 10.818463,
        longitude: 106.658762,
        fullText: '58 Hoang Viet, Ward 4, Tan Binh, Ho Chi Minh City',
    },
] as const;

export type AddressSeedKey = (typeof addressSeeds)[number]['key'];

export type UserAddressLinkSeed = {
    addressKey: AddressSeedKey;
    /** UserAddress.title — memorized label (Home, Work, …) */
    title: string;
    /** UserAddress.addressDetail — delivery note */
    addressDetail?: string;
};
