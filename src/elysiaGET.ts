import { PrismaClient } from '@prisma/client'
import { Elysia } from 'elysia'

const prisma = new PrismaClient()

// function to get book by id 
export const elysiaQuery = new Elysia({ prefix: '/book' })
  .get('/id/:ma_sach', async ({ params: { ma_sach } }) => {
    try {
      // Parse and validate the book ID
      const id = parseInt(ma_sach);
      if (isNaN(id)) {
        return {
          status: 400,
          message: 'Invalid book ID format'
        };
      }

      // Query the book using Prisma
      const book = await prisma.sach.findUnique({
        where: {
          ma_sach: id
        },
        select: {
          tieu_de: true,
          gia_tien: true,
          gioi_thieu: true
        }
      });

      if (!book) {
        return {
          status: 404,
          message: 'Book not found'
        };
      }

      return { tieu_de: book.tieu_de 
        , gia_tien: book.gia_tien
        , gioi_thieu: book.gioi_thieu
      };
    } catch (error) {
      console.error('Error fetching book:', error);
      return {
        status: 500,
        message: 'Internal server error'
      };
    }
  })


  // fuction to seach book by title
  .get('/search', async ({ query }) => {
    try {
      const { title } = query;
      if (!title) {
        return {
          status: 400,
          message: 'Title query parameter is required'
        };
      }

      // Query the book using Prisma
      const book = await prisma.sach.findMany({
        where: {
          tieu_de: {
            contains: title
          }
        },
        select: {
          ma_sach: true,
          tieu_de: true,
          gia_tien: true,
          so_tap: true
        }
      });

      if (book.length === 0) {
        return {
          status: 404,
          message: 'Book not found'
        };
      }

      return book;
    } catch (error) {
      console.error('Error fetching book:', error);
      return {
        status: 500,
        message: 'Internal server error'
      };
    }
  })
