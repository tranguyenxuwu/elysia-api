import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { bookController } from './elysiaController'

// Create and start the application
new Elysia()
  .use(swagger())
  .use(bookController)
  .listen(3000)

console.log('Server is running on http://localhost:3000')