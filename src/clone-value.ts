export function cloneValue<T>(ob: T): T { return (ob && typeof ob === "object") ? JSON.parse(JSON.stringify(ob)) : ob; }
