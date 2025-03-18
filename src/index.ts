import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { elysiaQuery } from './elysiaGET'
import { elysiaUPLOADER } from './elysiaPOST'

// Create and start the application
new Elysia()
  .use(swagger())
  .use(elysiaQuery)
  .use(elysiaUPLOADER)
  .listen(3000)

console.log('Server is running on http://localhost:3000')