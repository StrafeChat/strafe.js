export interface ClientConfig {
  equinox: string;
  nebula: string;
  stargate: string;
  status: string;
}

/***
 * @typedef {Object} ApiError
 * @property {string} message
 */
export interface ApiError {
  message: string;
  code: number;
}
