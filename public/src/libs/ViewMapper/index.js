/**
 * - ViewMapper: A utility to map DOM elements to a predefined structure, providing support for dynamic DOM updates.
 * @template {Record<string, [selector: string, keyof HTMLElementTagNameMap | `${keyof HTMLElementTagNameMap}[]`]>} ViewMap
 * @example
 * const mapper = new ViewMapper({
 *   header: ['header', 'header'],
 *   items: ['.item', 'div[]'], // A list of div elements
 * });
 *
 * mapper.onReady(() => {
 *   console.log('All elements are loaded!');
 * }, true);
 *
 * mapper.onElementReady('items', (item) => {
 *   console.log('New item added:', item);
 * });
 */
export default class ViewMapper {
    /**
     * Creates an instance of ViewMapper.
     * @param {ViewMap} viewMap - A map of view names to selectors and HTML types.
     */
    constructor(viewMap) {
        /**
         * @private
         * @type {ViewMap}
         */
        this._viewMap = viewMap;

        /**
         * @private
         * @type {Record<keyof ViewMap, HTMLElement | HTMLElement[] | null>} 
         */
        this._views = {};

        /**
         * @private
         * @type {WeakMap<HTMLElement, boolean>}
         */
        this._observedElements = new WeakMap();

        /**
         * @private
         * @type {Map<string, MutationObserver>}
         */
        this._observers = new Map();

        this._initViews();
        this._startObserver();
    }

    /**
     * Callback when all elements in the map are ready.
     * @param {() => any} callback - The function to call when all elements are ready.
     * @param {boolean} [strict=false] - If true, throw an error if any element is missing after DOMContentLoaded.
     */
    onReady(callback, strict = false) {
        const allReady = () => {
            for (const [selector, type] of Object.values(this._viewMap)) {
                if (!this._queryElement(selector, type)) {
                    return false;
                }
            }
            return true;
        };

        const handleReady = () => {
            if (allReady()) {
                callback();
            } else if (strict) {
                throw new Error("Not all elements in the map are present after DOMContentLoaded.");
            }
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", handleReady, { once: true });
        } else {
            handleReady();
        }
    }

    /**
     * Add a listener that triggers when an element appears in the DOM for the first time.
     * @template {keyof ViewMap} Key
     * @param {Key} keyOfElement - The key of the element in the view map.
     * @param {(element: ViewMap[Key][1] extends `${infer K}[]` ? HTMLElementTagNameMap[K] : HTMLElementTagNameMap[ViewMap[Key][1]]) => any} callback - The function to call when the element is ready.
     * @param {boolean} [once=true] - If true, stop observing after callback is triggered once.
     */
    onElementReady(keyOfElement, callback, once = true) {
        const [selector, type] = this._viewMap[keyOfElement];
        const tag = type.replace("[]", "");

        // Check current elements
        const existingElements = Array.from(document.querySelectorAll(selector)).filter(
            (node) => node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === tag
        );

        existingElements.forEach((el) => {
            if (!this._isObserved(el)) {
                this._markAsObserved(el);
                callback(el); // Always send a single element
            }
        });

        // Observe new elements if required
        if (!once || existingElements.length === 0) {
            const observer = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === "childList") {
                        const addedElements = Array.from(mutation.addedNodes)
                            .filter((node) => node.nodeType === Node.ELEMENT_NODE)
                            .flatMap((node) =>
                                node.matches(selector)
                                    ? [node]
                                    : Array.from(node.querySelectorAll(selector)) // Check all child nodes
                            )
                            .filter((el) => el.tagName.toLowerCase() === tag); // Ensure tag matches

                        addedElements.forEach((el) => {
                            if (!this._isObserved(el)) {
                                this._markAsObserved(el);
                                callback(el); // Always send a single element

                                // Stop observing if `once` is true
                                if (once) {
                                    this._disconnectObserver(selector);
                                }
                            }
                        });
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
            this._observers.set(selector, observer);
        }
    }

    /**
     * Initialize views based on the provided map.
     * @private
     */
    _initViews() {
        for (const [key, [selector, type]] of Object.entries(this._viewMap)) {
            this._views[key] = this._queryElement(selector, type);
        }
    }

    /**
     * Query an element or a collection of elements based on the selector and type.
     * @private
     * @param {string} selector - The CSS selector.
     * @param {keyof HTMLElementTagNameMap | `${keyof HTMLElementTagNameMap}[]`} type - The expected tag type, with `[]` for multiple elements.
     * @returns {ViewMap[Key][1] extends `${infer K}[]` ? HTMLElementTagNameMap[K][] : (HTMLElementTagNameMap[ViewMap[Key][1]] | null)} The queried element(s) or null.
     */
    _queryElement(selector, type) {
        const isArray = type.endsWith("[]");
        const tag = type.replace("[]", "");

        if (isArray) {
            return Array.from(document.querySelectorAll(selector)).filter(
                (el) => el.tagName.toLowerCase() === tag
            );
        } else {
            const element = Array.from(document.querySelectorAll(selector)).find((el) => el.tagName.toLowerCase() === tag);
            return element ?? null;
        }
    }

    /**
     * Start observing the DOM for changes.
     * @private
     */
    _startObserver() {
        const observer = new MutationObserver(() => {
            this._updateViews();
        });

        observer.observe(document.body, { childList: true, subtree: true });
        this._observers.set("global", observer);
    }

    /**
     * Update the views based on the current DOM state.
     * @private
     */
    _updateViews() {
        for (const [key, [selector, type]] of Object.entries(this._viewMap)) {
            this._views[key] = this._queryElement(selector, type);
        }
    }

    /**
     * Check if an element has already been observed.
     * @private
     * @param {HTMLElement} element - The element to check.
     * @returns {boolean} True if the element has been observed, otherwise false.
     */
    _isObserved(element) {
        return this._observedElements.has(element);
    }

    /**
     * Mark an element as observed.
     * @private
     * @param {HTMLElement} element - The element to mark.
     */
    _markAsObserved(element) {
        this._observedElements.set(element, true);
    }

    /**
     * Get a view by its key.
     * @template {keyof ViewMap} Key
     * @param {Key} key - The view key.
     * @returns {ViewMap[Key][1] extends `${infer K}[]` ? HTMLElementTagNameMap[K][] : (HTMLElementTagNameMap[ViewMap[Key][1]] | null)} The HTML element(s) associated with the key.
     */
    get(key) {
        const [selector, type] = this._viewMap[key];
        this._views[key] = this._queryElement(selector, type);

        // Optional: Disconnect observers if all elements are present
        const isArray = type.endsWith("[]");
        if (isArray && Array.isArray(this._views[key]) && this._views[key].length > 0) {
            this._disconnectObserver(selector);
        } else if (!isArray && this._views[key] !== null) {
            this._disconnectObserver(selector);
        }

        return this._views[key];
    }

    /**
     * Disconnect a specific observer.
     * @private
     * @param {string} selector - The selector associated with the observer.
     */
    _disconnectObserver(selector) {
        const observer = this._observers.get(selector);
        if (observer) {
            observer.disconnect();
            this._observers.delete(selector);
        }
    }

    /**
     * Disconnect all observers and clean up resources.
     */
    disconnect() {
        this._observers.forEach((observer) => observer.disconnect());
        this._observers.clear();
        this._observedElements = new WeakMap();
    }
}