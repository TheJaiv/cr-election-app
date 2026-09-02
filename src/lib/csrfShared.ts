/**
 * Names shared by the client and the server. Kept free of any node: import so
 * the client bundle never pulls in crypto.
 */
export const CSRF_COOKIE = "cr-csrf";
export const CSRF_HEADER = "x-csrf-token";
