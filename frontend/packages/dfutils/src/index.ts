export function cellIdIntToStr(id: number): string {
    return id.toString(16).padStart(8, '0');
}

export function cellIdStrToInt(id: string): number {
    return parseInt(id, 16);
}

export function truncateCellId(id: string): string {
    return id.replace(/-/g, '').substring(0, 8);
}
