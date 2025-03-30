import { PrismaClient, Prisma } from "@prisma/client";
import { Elysia } from 'elysia';

const prisma = new PrismaClient();

/**
 * Deletes a book by its ID
 * @param bookId ID of the book to delete
 */
export async function elysiaGoodbyeBook(bookId: number) {
  try {
    // Check if book exists before attempting deletion
    const existingBook = await prisma.sach.findUnique({
      where: {
        ma_sach: bookId
      }
    });

    if (!existingBook) {
      return {
        success: false,
        status: 404,
        message: `Book with ID ${bookId} not found`
      };
    }

    // Delete the book
    await prisma.sach.delete({
      where: {
        ma_sach: bookId
      }
    });

    return {
      success: true,
      status: 200,
      message: `Book with ID ${bookId} deleted successfully`
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle foreign key constraint violations
      if (error.code === 'P2003') {
        return {
          success: false,
          status: 400,
          message: 'Cannot delete this book as it is referenced by other records'
        };
      }
    }
    
    return {
      success: false,
      status: 500,
      message: `Failed to delete book: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Route for deleting a book by ID
export const bookDeleteRoutes = new Elysia()
  .delete('/book/:id', async ({ params }) => {
    const bookId = parseInt(params.id);
    
    if (isNaN(bookId)) {
      return {
        success: false,
        status: 400,
        message: 'Invalid book ID'
      };
    }
    
    return await elysiaGoodbyeBook(bookId);
  });

// Export the app for use in the main application
export default new Elysia()
  .use(bookDeleteRoutes);
