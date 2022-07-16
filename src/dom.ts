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
