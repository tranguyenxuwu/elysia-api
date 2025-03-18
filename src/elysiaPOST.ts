import { PrismaClient } from '@prisma/client'
import { Elysia, t } from 'elysia'

const prisma = new PrismaClient()

// Define type interfaces for request bodies
interface BasicBookBody {
  tieu_de: string;
  gia_tien: number;
  gioi_thieu: string;
}

interface CompleteBookBody extends BasicBookBody {
  tong_so_trang?: number;
  danh_gia?: number;
  ngay_xuat_ban?: string;
  ma_nha_xuat_ban?: number;
  so_tap?: number;
}

export const elysiaUPLOADER = new Elysia({ prefix: '/upload' })
// Basic book upload endpoint with schema validation
    .post('/', {
      body: t.Object({
        tieu_de: t.String(),
        gia_tien: t.Number(),
        gioi_thieu: t.String()
      }),
      async handler({ body }: { body: BasicBookBody }) {
        try {
          const { tieu_de, gia_tien, gioi_thieu } = body;
          if (!tieu_de || !gia_tien || !gioi_thieu) {
            return {
              status: 400,
              message: 'Title, price and description are required'
            };
          }
      
          const book = await prisma.sach.create({
            data: {
              tieu_de,
              gia_tien,
              gioi_thieu
            }
          });
      
          return { 
            tieu_de: book.tieu_de, 
            gia_tien: book.gia_tien,
            gioi_thieu: book.gioi_thieu
          };
        } catch (error) {
          console.error('Error creating book:', error);
          return {
            status: 500,
            message: 'Internal server error'
          };
        }
      }
    })
    
    // Complete book creation endpoint with schema validation
    .post('/book', {
      body: t.Object({
        tieu_de: t.String(),
        gia_tien: t.Number(),
        gioi_thieu: t.String(),
        tong_so_trang: t.Optional(t.Number()),
        danh_gia: t.Optional(t.Number()),
        ngay_xuat_ban: t.Optional(t.String()),
        ma_nha_xuat_ban: t.Optional(t.Number()),
        so_tap: t.Optional(t.Number())
      }),
      async handler({ body }: { body: CompleteBookBody }) {
        try {
          const { 
            tieu_de, 
            tong_so_trang, 
            danh_gia, 
            ngay_xuat_ban, 
            ma_nha_xuat_ban, 
            gia_tien, 
            so_tap, 
            gioi_thieu 
          } = body;
          
          // Prepare data object with all fields
          const bookData = {
            tieu_de,
            gia_tien,
            gioi_thieu,
            // Add optional fields only if they exist
            ...(tong_so_trang !== undefined && { tong_so_trang }),
            ...(danh_gia !== undefined && { danh_gia }),
            ...(ngay_xuat_ban !== undefined && { 
              ngay_xuat_ban: new Date(ngay_xuat_ban) 
            }),
            ...(ma_nha_xuat_ban !== undefined && { ma_nha_xuat_ban }),
            ...(so_tap !== undefined && { so_tap })
          };
          
          // Create book record
          const book = await prisma.sach.create({
            data: bookData
          });
          
          return {
            status: 201,
            message: 'Book created successfully',
            data: book
          };
          
        } catch (error) {
          console.error('Error creating book:', error);
          
          // Handle specific errors
        //   if (error.code === 'P2003') {
        //     return {
        //       status: 400,
        //       message: 'Invalid publisher ID provided'
        //     };
        //   }
          
        //   return {
        //     status: 500,
        //     message: 'Internal server error'
        //   };
        }
      }
    });