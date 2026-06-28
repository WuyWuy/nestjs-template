import { BadRequestException } from '@nestjs/common';

export function assertValidAddressCoordinates(
    latitude: number,
    longitude: number,
): void {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new BadRequestException(
            'latitude and longitude must be valid numbers',
        );
    }

    if (latitude === 0 || longitude === 0) {
        throw new BadRequestException(
            'latitude and longitude must not be 0',
        );
    }

    if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        throw new BadRequestException('Invalid address coordinates');
    }
}

export function hasProvidedCoordinate(value: number | undefined): value is number {
    return value !== undefined && value !== null && Number.isFinite(value);
}
