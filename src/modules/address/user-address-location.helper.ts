import { BadRequestException } from '@nestjs/common';
import { assertValidAddressCoordinates } from './address-coordinates.helper';
import { ChangeUserAddressLocationDto } from './dto/address.dto';

export function buildUserAddressLocationPayload(
    location: ChangeUserAddressLocationDto,
) {
    assertValidAddressCoordinates(location.latitude, location.longitude);

    const title = location.title.trim();
    if (!title) {
        throw new BadRequestException('title is required');
    }

    const fullText = location.fullText.trim();
    if (!fullText) {
        throw new BadRequestException('fullText is required');
    }

    return {
        title,
        latitude: location.latitude,
        longitude: location.longitude,
        fullText,
    };
}
