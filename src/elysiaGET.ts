import { PrismaClient } from '@prisma/client'
import { Elysia } from 'elysia'

const prisma = new PrismaClient()

// function to get book by id 
export const elysiaQuery = new Elysia({ prefix: '/book' })
  .get('/id/:ma_sach', async ({ params: { ma_sach }, set }) => {
    try {
      // Parse và validate ID
      const id = parseInt(ma_sach);
      if (isNaN(id)) {
        set.status = 400;
        return { message: "Định dạng ID không hợp lệ" };
      }

      // Truy vấn sách kèm ảnh bìa
      const book = await prisma.sach.findUnique({
        where: { ma_sach: id },
        include: {
          sach_bia_sach: true, // Include thông tin ảnh bìa
          nha_xuat_ban: {     // Include thông tin nhà xuất bản (nếu cần)
            select: { ten_nha_xuat_ban: true }
          }
        }
      });

      if (!book) {
        set.status = 404;
        return { message: "Không tìm thấy sách" };
      }

      // Định dạng response
      const response = {
        ma_sach: book.ma_sach,
        tieu_de: book.tieu_de,
        tong_so_trang: book.tong_so_trang,
        danh_gia: book.danh_gia?.toString() || null, // Chuyển Decimal sang string
        ngay_xuat_ban: book.ngay_xuat_ban,
        ma_nha_xuat_ban: book.ma_nha_xuat_ban,
        gia_tien: book.gia_tien.toString(), // Chuyển Decimal sang string
        so_tap: book.so_tap,
        gioi_thieu: book.gioi_thieu,
        sach_bia_sach: book.sach_bia_sach || null // Trả về null nếu không có ảnh
      };

      return response;

    } catch (error) {
      console.error("Lỗi truy vấn:", error);
      set.status = 500;
      return { message: "Lỗi server" };
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
          so_tap: true,
          sach_bia_sach: true
        }
      });

      if (book.length === 0) {
        return {
          status: 404,
          message: 'Book not found'
        };
      }

      return book.map(item => ({
        ...item,
        sach_bia_sach: item.sach_bia_sach || null
      }));
    } catch (error) {
      console.error('Error fetching book:', error);
      return {
        status: 500,
        message: 'Internal server error'
      };
    }
  })

  // SELECT 6 RANDOM BOOKS
  .get('/randomStoreIndex', async () => {
    try {
      const books = await prisma.sach.findMany({
        take: 10,
        select: {
          ma_sach: true,
          tieu_de: true,
          gia_tien: true,
          so_tap: true,
          gioi_thieu: true,
          sach_bia_sach: true
        }
      });

      return books.map(book => ({
        ...book,
        sach_bia_sach: book.sach_bia_sach || null
      }));
    } catch (error) {
      console.error('Error fetching books:', error);
      return {
        status: 500,
        message: 'Internal server error'
      };
    }
  })


  // select all books
  .get('/all', async () => {
    try {
      const books = await prisma.sach.findMany({
        select: {
          ma_sach: true,
          tieu_de: true,
          gia_tien: true,
          so_tap: true,
          gioi_thieu: true,
          sach_bia_sach: true
        }
      });

      return books.map(book => ({
        ...book,
        sach_bia_sach: book.sach_bia_sach || null
      }));
    } catch (error) {
      console.error('Error fetching books:', error);
      return {
        status: 500,
        message: 'Internal server error'
      };
    }
  })