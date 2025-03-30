import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { elysiaQuery } from './elysiaGET'
import { elysiaUPLOADER } from './elysiaPOST'
import { cors } from '@elysiajs/cors'
import { bookDeleteRoutes } from './elysiaDEL'

// Create and start the application
new Elysia()
  .use(swagger())
  .use(elysiaQuery)
  .use(elysiaUPLOADER)
  .use(bookDeleteRoutes)
  .use(cors())
  .listen(3000)

console.log('Elysia server is running on http://localhost:3000/swagger')