export function parseDateBoundary(value: string, endOfDay: boolean) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
        return new Date(`${value}T${time}Z`);
    }
    return new Date(value);
}
