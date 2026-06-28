import { BadRequestException } from '@nestjs/common';
import { buildUserAddressLocationPayload } from './user-address-location.helper';

describe('buildUserAddressLocationPayload', () => {
    it('should build a create-address payload from a Google Maps bundle', () => {
        const payload = buildUserAddressLocationPayload({
            title: 'District 1',
            fullText: '456 Le Loi, District 1, Ho Chi Minh City',
            latitude: 10.78,
            longitude: 106.71,
        });

        expect(payload).toEqual({
            title: 'District 1',
            latitude: 10.78,
            longitude: 106.71,
            fullText: '456 Le Loi, District 1, Ho Chi Minh City',
        });
    });

    it('should reject empty title', () => {
        expect(() =>
            buildUserAddressLocationPayload({
                title: '   ',
                fullText: '456 Le Loi',
                latitude: 10.78,
                longitude: 106.71,
            }),
        ).toThrow(BadRequestException);
    });

    it('should reject empty fullText', () => {
        expect(() =>
            buildUserAddressLocationPayload({
                title: 'District 1',
                fullText: '   ',
                latitude: 10.78,
                longitude: 106.71,
            }),
        ).toThrow(BadRequestException);
    });

    it('should reject invalid coordinates', () => {
        expect(() =>
            buildUserAddressLocationPayload({
                title: 'District 1',
                fullText: '456 Le Loi',
                latitude: 0,
                longitude: 106.71,
            }),
        ).toThrow(BadRequestException);
    });
});
