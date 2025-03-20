import { PrismaClient, Prisma } from '@prisma/client'
import { Elysia, t } from 'elysia'

const prisma = new PrismaClient()

const toDecimal = (value: string) => {
  try {
    return new Prisma.Decimal(value)
  } catch (error) {
    throw new Error(`Invalid decimal format: ${value}`)
  }
}

const basicBookSchema = t.Object({
  tieu_de: t.String(),
  gia_tien: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
  gioi_thieu: t.String()
})

const completeBookSchema = t.Object({
  tieu_de: t.String(),
  gia_tien: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
  gioi_thieu: t.String(),
  tong_so_trang: t.Optional(t.Number()),
  danh_gia: t.Optional(t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' })),
  ngay_xuat_ban: t.Optional(t.String({ format: 'date' })),
  ma_nha_xuat_ban: t.Optional(t.Number()),
  so_tap: t.Optional(t.Number())
})

export const elysiaUPLOADER = new Elysia({ prefix: '/upload' })
  .post('/', async ({ body, set }) => {
    try {
      const decimalPrice = toDecimal(body.gia_tien)
      
      const book = await prisma.sach.create({
        data: {
          tieu_de: body.tieu_de,
          gia_tien: decimalPrice,
          gioi_thieu: body.gioi_thieu
        }
      })

      set.status = 201
      return book
    } catch (error) {
      set.status = 500
      return { 
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }
    }
  }, { body: basicBookSchema })
  .post('/book', async ({ body, set }) => {
    try {
      if (body.ma_nha_xuat_ban) {
        const publisher = await prisma.nha_xuat_ban.findUnique({
          where: { ma_nha_xuat_ban: body.ma_nha_xuat_ban }
        })
        
        if (!publisher) {
          set.status = 400
          return { message: 'Invalid publisher ID' }
        }
      }

      const bookData: Prisma.sachCreateInput = {
        tieu_de: body.tieu_de,
        gia_tien: toDecimal(body.gia_tien),
        gioi_thieu: body.gioi_thieu,
        so_tap: body.so_tap,
      }

      try {
        if (body.tong_so_trang) bookData.tong_so_trang = body.tong_so_trang
        if (body.danh_gia) bookData.danh_gia = toDecimal(body.danh_gia)
        if (body.ngay_xuat_ban) {
          const date = new Date(body.ngay_xuat_ban)
          if (isNaN(date.getTime())) throw new Error('Invalid date format')
          bookData.ngay_xuat_ban = date
        }
        if (body.ma_nha_xuat_ban) {
          bookData.nha_xuat_ban = {
            connect: { ma_nha_xuat_ban: body.ma_nha_xuat_ban }
          }
        }
      } catch (fieldError) {
        set.status = 400
        return { 
          message: 'Invalid field format',
          details: fieldError instanceof Error ? fieldError.message : String(fieldError)
        }
      }

      const book = await prisma.sach.create({ data: bookData })
      set.status = 201
      return book

    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            set.status = 409
            return { message: 'Duplicate entry', details: error.meta }
          case 'P2003':
            set.status = 400
            return { message: 'Foreign key constraint failed', details: error.meta }
          case 'P2025':
            set.status = 404
            return { message: 'Related record not found', details: error.meta }
        }
      }

      set.status = 500
      return { 
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }
    }
  }, { body: completeBookSchema })