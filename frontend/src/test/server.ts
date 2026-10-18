import { setupServer } from 'msw/node'

/** Servidor MSW compartido: cada prueba añade sus respuestas con `server.use(...)`. */
export const server = setupServer()
export const API = 'http://api.test/api'
