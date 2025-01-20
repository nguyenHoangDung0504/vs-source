export default class JsonRequest {
    /**
     * Base URL for requests.
     * @private
     * @type {string}
     */
    _baseURL = '';

    /**
     * Request headers.
     * @private
     * @type {Record<string, string>}
     */
    _headers = {};

    /**
     * Creates an instance of JsonRequest
     * @param {string} [baseURL=''] - The base URL to use for all requests. If no baseURL is provided, requests will be made using the provided endpoint URLs
     */
    constructor(baseURL = '') {
        this._baseURL = baseURL;
        this._headers = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * Sets a header value for requests
     * @param {string} key - The name of the header
     * @param {string} value - The value of the header
     * @returns {this} - Support chainning method
     */
    setHeader(key, value) {
        this._headers[key] = value;
        return this;
    }

    /**
     * Clears a specific header from the headers object
     * @param {string} key - The name of the header to remove
     * @returns {this} Support chainning method
     */
    clearHeader(key) {
        delete this._headers[key];
        return this;
    }

    /**
     * Performs an HTTP request with the specified options
     * @private
     * @param {string} url - The endpoint URL (relative or absolute)
     * @param {RequestInit} options - The options for the fetch request. These options may include method, body, headers, etc
     * @throws {Error} If the request fails or the response is not ok
     */
    async _request(url, options = {}) {
        const { headers, method, ...otherOptions } = options;
        const finalUrl = this._baseURL ? `${this._baseURL}${url}` : url;

        const response = await fetch(finalUrl, {
            method,
            headers: { ...this._headers, ...headers },
            ...otherOptions,
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Request failed');
        }

        return response.json();
    }

    /**
     * Performs a GET request
     * @param {string} url - The endpoint URL
     * @param {RequestInit} options - The options for the fetch request. These options may include method, body, headers, etc
     * @throws {Error} If the request fails or the response is not ok
     */
    async get(url, options = {}) {
        return this._request(url, {
            method: 'GET',
            ...options,
        });
    }

    /**
     * Performs a POST request
     * @param {string} url - The endpoint URL
     * @param {Record<string, any>} body - The body data to send in the request
     * @param {RequestInit} options - The options for the fetch request. These options may include method, body, headers, etc
     * @throws {Error} If the request fails or the response is not ok
     */
    async post(url, body, options = {}) {
        return this._request(url, {
            method: 'POST',
            body: JSON.stringify(body),
            ...options,
        });
    }

    /**
     * Performs a PUT request
     * @param {string} url - The endpoint URL
     * @param {Record<string, any>} body - The body data to send in the request
     * @param {RequestInit} options - The options for the fetch request. These options may include method, body, headers, etc
     * @throws {Error} If the request fails or the response is not ok
     */
    async put(url, body, options = {}) {
        return this._request(url, {
            method: 'PUT',
            body: JSON.stringify(body),
            ...options,
        });
    }

    /**
     * Performs a DELETE request
     * @param {string} url - The endpoint URL
     * @param {RequestInit} options - The options for the fetch request. These options may include method, body, headers, etc
     * @throws {Error} If the request fails or the response is not ok
     */
    async delete(url, options = {}) {
        return this._request(url, {
            method: 'DELETE',
            ...options,
        });
    }
}