/**
 * Any JSONifiable value
 *
 * @category Types and Interfaces
 */
export type JSON = JSONPrimitive | JSONArray | JSONObject;

/**
 * An object representable as JSON
 *
 * @category Types and Interfaces
 */

export type JSONObject = { [attr: string]: JSON; } & NotAFunction;

/**
 * A primitive JSONifiable value
 *
 * @category Types and Interfaces
 */
export type JSONPrimitive = string | number | boolean | Date | null;

/**
 * An array of JSONifiable values
 *
 * @category Types and Interfaces
 */
export type JSONArray = JSON[] & NotAFunction;

/**
 * A non-function value
 *
 * @category Types and Interfaces
 */
export type NotAFunction = { bind?: void; } | { apply?: void; } | { call?: void; } | { length?: void; };
