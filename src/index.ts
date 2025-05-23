import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { elysiaQuery } from './elysiaGET'
import { elysiaUPLOADER } from './elysiaPOST'
import { bookDeleteRoutes } from './elysiaDEL'
import { elysiaORDER } from './elysiaORDER'

// Comment out or remove the allowedOrigins list as it's no longer needed
// const allowedOrigins = ["https://bookstore-elysia.web.app"];

new Elysia()
  .use(cors({
    origin: true, // Allow requests from any origin
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type"]
  }))
  .use(swagger())
  .use(elysiaQuery)
  .use(elysiaUPLOADER)
  .use(bookDeleteRoutes)
  .use(elysiaORDER)
  .listen(3000);

console.log('Elysia server is running on http://localhost:3000/swagger');
