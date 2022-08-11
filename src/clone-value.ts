export function cloneValue(ob: any) { return (ob && typeof ob === "object") ? JSON.parse(JSON.stringify(ob)) : ob; }
