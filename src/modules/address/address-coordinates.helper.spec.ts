import { BadRequestException } from '@nestjs/common';
import { assertValidAddressCoordinates } from './address-coordinates.helper';

describe('assertValidAddressCoordinates', () => {
    it('should accept valid coordinates', () => {
        expect(() =>
            assertValidAddressCoordinates(10.776889, 106.700806),
        ).not.toThrow();
    });

    it('should reject latitude equal to 0', () => {
        expect(() => assertValidAddressCoordinates(0, 106.7)).toThrow(
            BadRequestException,
        );
    });

    it('should reject longitude equal to 0', () => {
        expect(() => assertValidAddressCoordinates(10.7, 0)).toThrow(
            BadRequestException,
        );
    });

    it('should reject out-of-range coordinates', () => {
        expect(() => assertValidAddressCoordinates(91, 106.7)).toThrow(
            BadRequestException,
        );
        expect(() => assertValidAddressCoordinates(10.7, 181)).toThrow(
            BadRequestException,
        );
    });

    it('should reject non-finite coordinates', () => {
        expect(() => assertValidAddressCoordinates(Number.NaN, 106.7)).toThrow(
            BadRequestException,
        );
    });
});
