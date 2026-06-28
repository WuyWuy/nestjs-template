import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAddressDto } from './address.dto';

describe('CreateAddressDto validation', () => {
    const validPayload = {
        title: 'Home',
        latitude: 10.776889,
        longitude: 106.700806,
        fullText: '123 Nguyen Hue, District 1',
    };

    it('should validate a complete payload', async () => {
        const dto = plainToInstance(CreateAddressDto, validPayload);
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject missing fullText', async () => {
        const dto = plainToInstance(CreateAddressDto, {
            ...validPayload,
            fullText: '',
        });
        const errors = await validate(dto);
        expect(errors.some((error) => error.property === 'fullText')).toBe(true);
    });

    it('should reject latitude equal to 0', async () => {
        const dto = plainToInstance(CreateAddressDto, {
            ...validPayload,
            latitude: 0,
        });
        const errors = await validate(dto);
        expect(errors.some((error) => error.property === 'latitude')).toBe(true);
    });

    it('should reject longitude equal to 0', async () => {
        const dto = plainToInstance(CreateAddressDto, {
            ...validPayload,
            longitude: 0,
        });
        const errors = await validate(dto);
        expect(errors.some((error) => error.property === 'longitude')).toBe(
            true,
        );
    });
});
