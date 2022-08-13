export function onElement<K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    event: K,
    selector: string,
    callback: (this: HTMLElement, ev: HTMLElementEventMap[K], delegateTarget: HTMLElement) => any,
    options?: boolean | AddEventListenerOptions
) {
    el.on(event, selector, callback, options)
    return () => el.off(event, selector, callback, options);
}

/**
 * Efficiently update a class on a workspace item, only touching where changes are needed
 *
 * @param el The element to add or remove the class from
 * @param cls The class to add or remove
 * @param state Boolean, flag to add or remove, defaults to opposite of current state
 * @returns boolean for the state of the class afterwards
 */
 export function toggleClass(el: Element, cls: string, state?: boolean): boolean {
    const had = el.classList.contains(cls);
    state = state ?? !had;
    if (state !== had) { state ? el.classList.add(cls) : el.classList.remove(cls); }
    return state;
}
