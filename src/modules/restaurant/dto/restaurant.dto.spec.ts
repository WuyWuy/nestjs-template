import { validate } from 'class-validator';
import { CreateRestaurantRatingDto } from './restaurant.dto';

describe('CreateRestaurantRatingDto validation', () => {
    it('should validate successfully for a valid payload', async () => {
        const dto = new CreateRestaurantRatingDto();
        dto.vote = 5;
        dto.comment = 'Thuc an rat ngon, giao hang sieu nhanh!';
        dto.orderId = 162432;
        dto.tags = ['Delicious food', 'Fast delivery'];

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should validate successfully when tags are omitted', async () => {
        const dto = new CreateRestaurantRatingDto();
        dto.vote = 4;
        dto.orderId = 162432;

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should fail validation if vote is invalid', async () => {
        const dto = new CreateRestaurantRatingDto();
        dto.vote = 6; // Max is 5
        dto.orderId = 162432;

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('vote');
    });

    it('should fail validation if orderId is missing', async () => {
        const dto = new CreateRestaurantRatingDto();
        dto.vote = 3;
        // orderId is missing

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.property === 'orderId')).toBe(true);
    });

    it('should fail validation if tags contain an invalid tag', async () => {
        const dto = new CreateRestaurantRatingDto();
        dto.vote = 5;
        dto.orderId = 162432;
        dto.tags = ['Thuc an ngon', 'Giao qua tre'];

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('tags');
    });
});
