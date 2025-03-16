/**
 * Any JSONifiable value
 *
 * @category Types and Interfaces
 */
export type JSONValue = JSONPrimitive | JSONArray | JSONObject;

/**
 * An object representable as JSON
 *
 * @category Types and Interfaces
 */
export type JSONObject = { [attr: string]: JSONValue; } & NotAFunction;

/**
 * A primitive JSONifiable value
 *
 * @category Types and Interfaces
 */
export type JSONPrimitive = string | number | boolean | Date | null;

/**
 * Enforce JSONifiability of an object type
 *
 * @category Types and Interfaces
 */
export type JSON<T> = {
    [P in keyof T]:
        T[P] extends JSONValue ? T[P] :
        T[P] extends NotJSON ? never :
        JSON<T[P]>;
}

/**
 * Things that can't be JSONified
 *
 * @category Types and Interfaces
 */
export type NotJSON = bigint | symbol | Function

/**
 * An array of JSONifiable values
 *
 * @category Types and Interfaces
 */
export type JSONArray = JSONValue[] & NotAFunction;

/**
 * A non-function value
 *
 * @category Types and Interfaces
 */
export type NotAFunction = { bind?: void; } | { apply?: void; } | { call?: void; } | { length?: void; };
