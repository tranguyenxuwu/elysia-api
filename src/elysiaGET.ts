import { PrismaClient } from "@prisma/client";
import { Elysia } from "elysia";

const prisma = new PrismaClient();

// function to get book by id
export const elysiaQuery = new Elysia({ prefix: "/book" })
  .get("/id/:ma_sach", async ({ params: { ma_sach }, set }) => {
    try {
      // Parse và validate ID
      const id = parseInt(ma_sach);
      if (isNaN(id)) {
        set.status = 400;
        return { message: "Định dạng ID không hợp lệ" };
      }

      // Truy vấn sách kèm các quan hệ
      const book = await prisma.sach.findUnique({
        where: { ma_sach: id },
        include: {
          sach_bia_sach: true, // Include thông tin ảnh bìa
          nha_xuat_ban: {
            // Include thông tin nhà xuất bản
            select: { ten_nha_xuat_ban: true },
          },
          bo_sach: {
            // Include thông tin bộ sách
            select: { ma_bo_sach: true, ten_bo_sach: true },
          },
          kieu_sach: {
            // Include thông tin kiểu sách
            select: { ten_kieu_sach: true },
          },
          tac_gia: {
            // Include thông tin tác giả
            select: { ten_tac_gia: true },
          },
        },
      });

      if (!book) {
        set.status = 404;
        return { message: "Không tìm thấy sách" };
      }

      // Định dạng response
      // Use type assertion to resolve TypeScript errors
      const response = {
        ma_sach: book.ma_sach,
        tieu_de: book.tieu_de,
        tong_so_trang: book.tong_so_trang,
        danh_gia: book.danh_gia?.toString() || null,
        ngay_xuat_ban: book.ngay_xuat_ban,
        ma_nha_xuat_ban: book.ma_nha_xuat_ban,
        gia_tien: book.gia_tien.toString(),
        so_tap: book.so_tap,
        gioi_thieu: book.gioi_thieu,
        // Use type assertion for included relations
        sach_bia_sach: (book as any).sach_bia_sach || null,
        nha_xuat_ban: (book as any).nha_xuat_ban || null,
        bo_sach: (book as any).bo_sach || null,
        kieu_sach: (book as any).kieu_sach || null,
        tac_gia: (book as any).tac_gia || null,
      };

      return response;
    } catch (error) {
      console.error("Lỗi truy vấn:", error);
      set.status = 500;
      return { message: "Lỗi server" };
    }
  })

  // fuction to seach book by title
  .get("/search", async ({ query }) => {
    try {
      const { title } = query;
      if (!title) {
        return {
          status: 400,
          message: "Title query parameter is required",
        };
      }

      // Query the book using Prisma
      const book = await prisma.sach.findMany({
        where: {
          tieu_de: {
            contains: title,
          },
        },
        select: {
          ma_sach: true,
          tieu_de: true,
          gia_tien: true,
          so_tap: true,
          sach_bia_sach: true,
        },
      });

      if (book.length === 0) {
        return {
          status: 404,
          message: "Book not found",
        };
      }

      return book.map((item) => ({
        ...item,
        sach_bia_sach: item.sach_bia_sach || null,
      }));
    } catch (error) {
      console.error("Error fetching book:", error);
      return {
        status: 500,
        message: "Internal server error",
      };
    }
  })

  // select all books
  .get("/all", async () => {
    try {
      const books = await prisma.sach.findMany({
        select: {
          ma_sach: true,
          tieu_de: true,
          gia_tien: true,
          so_tap: true,
          gioi_thieu: true,
          sach_bia_sach: true,
          kieu_sach: true,
        },
      });

      return books.map((book) => ({
        ...book,
        sach_bia_sach: book.sach_bia_sach || null,
      }));
    } catch (error) {
      console.error("Error fetching books:", error);
      return {
        status: 500,
        message: "Internal server error",
      };
    }
  })

  //function to get all authors
  .get("/authors", async ({ set }) => {
    try {
      const authors = await prisma.tac_gia.findMany({
        select: {
          ma_tac_gia: true,
          ten_tac_gia: true,
          // Optionally include book count for each author
          // _count: {
          //   select: {
          //     sach: true
          //   }
          // }
        },
      });

      return authors.map((author) => ({
        ...author,
        ten_tac_gia: author.ten_tac_gia || null, // Handle null values
        // books_count: author._count.sach
      }));
    } catch (error) {
      console.error("Error fetching authors:", error);
      set.status = 500;
      return {
        message: "Internal server error"
      };
    }
  })

  // Function to get all book types
  .get("/types", async ({ set }) => {
    try {
      const bookTypes = await prisma.kieu_sach.findMany({
        select: {
          ma_kieu_sach: true,
          ten_kieu_sach: true,
          // _count: {
          //   select: {
          //     sach: true
          //   }
          // }
        },
      });

      return bookTypes.map((type) => ({
        ma_kieu_sach: type.ma_kieu_sach,
        ten_kieu_sach: type.ten_kieu_sach,
        // books_count: type._count.sach
      }));
    } catch (error) {
      console.error("Error fetching book types:", error);
      set.status = 500;
      return {
        message: "Internal server error"
      };
    }
  })

  // Function to get all publishers
  .get("/publishers", async ({ set }) => {
    try {
      const publishers = await prisma.nha_xuat_ban.findMany({
        select: {
          ma_nha_xuat_ban: true,
          ten_nha_xuat_ban: true,
          // _count: {
          //   select: {
          //     sach: true
          //   }
          // }
        },
      });

      return publishers.map((publisher) => ({
        ma_nha_xuat_ban: publisher.ma_nha_xuat_ban,
        ten_nha_xuat_ban: publisher.ten_nha_xuat_ban,
        // books_count: publisher._count.sach
      }));
    } catch (error) {
      console.error("Error fetching publishers:", error);
      set.status = 500;
      return {
        message: "Internal server error"
      };
    }
  })

  // query all books in the same series
  .get("/in-series/:ma_bo_sach", async ({ params: { ma_bo_sach }, set }) => {
    try {
      const series = await prisma.sach.findMany({
        where: { ma_bo_sach: parseInt(ma_bo_sach) },
        select: {
          ma_sach: true,
          tieu_de: true,
          gia_tien: true,
          so_tap: true,
          sach_bia_sach: true,
        },
      });

      return series.map((book) => ({
        ...book,
        sach_bia_sach: book.sach_bia_sach || null,
      }));
    } catch (error) {
      console.error("Error fetching series:", error);
      set.status = 500;
      return {
        message: "Internal server error"
      };
    }
  })

  // query all series
  .get("/series", async ({ set }) => {
    try {
      const series = await prisma.bo_sach.findMany({
        select: {
          ma_bo_sach: true,
          ten_bo_sach: true,
        },
      });

      return series;
    } catch (error) {
      console.error("Error fetching series:", error);
      set.status = 500;
      return {
        message: "Internal server error"
      };
    }
  })

  // function to get all light novels
  .get("/light-novels", async ({ set }) => {
    try {
      const lightNovels = await prisma.sach.findMany({
        where: { ma_kieu_sach: 1 },
        select: {
          ma_sach: true,
          tieu_de: true,
          gia_tien: true,
          so_tap: true,
          sach_bia_sach: true,
        },
      });

      return lightNovels.map((book) => ({
        ...book,
        sach_bia_sach: book.sach_bia_sach || null,
      }));
    } catch (error) {
      console.error("Error fetching light novels:", error);
      set.status = 500;
      return {
        message: "Internal server error"
      };
    }
  })
  // function to get all manga
  .get("/manga", async ({ set }) => {
    try {
      const manga = await prisma.sach.findMany({
        where: { ma_kieu_sach: 2 },
        select: {
          ma_sach: true,
          tieu_de: true,
          gia_tien: true,
          so_tap: true,
          sach_bia_sach: true,
        },
      });

      return manga.map((book) => ({
        ...book,
        sach_bia_sach: book.sach_bia_sach || null,
      }));
    } catch (error) {
      console.error("Error fetching manga:", error);
      set.status = 500;
      return {
        message: "Internal server error"
      };
    }
  })

  //function to get all artbooks
  .get("/artbooks", async ({ set }) => {
    try {
      const artbooks = await prisma.sach.findMany({
        where: { ma_kieu_sach: 3 },
        select: {
          ma_sach: true,
          tieu_de: true,
          gia_tien: true,
          so_tap: true,
          sach_bia_sach: true,
        },
      });

      return artbooks.map((book) => ({
        ...book,
        sach_bia_sach: book.sach_bia_sach || null,
      }));
    } catch (error) {
      console.error("Error fetching artbooks:", error);
      set.status = 500;
      return {
        message: "Internal server error"
      };
    }
  })

    // function to get all ref books
  .get("/ref-books", async ({ set }) => {
    try {
      const refBooks = await prisma.sach.findMany({
        where: { ma_kieu_sach: 4 },
        select: {
          ma_sach: true,
          tieu_de: true,
          gia_tien: true,
          so_tap: true,
          sach_bia_sach: true,
        },
      });

      return refBooks.map((book) => ({
        ...book,
        sach_bia_sach: book.sach_bia_sach || null,
      }));
    } catch (error) {
      console.error("Error fetching ref books:", error);
      set.status = 500;
      return {
        message: "Internal server error"
      };
    }
  })  

