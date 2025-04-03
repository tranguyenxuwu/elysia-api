import { PrismaClient, Prisma } from "@prisma/client";
import { Elysia, t } from "elysia";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const prisma = new PrismaClient();

// Environment validation
if (!process.env.R2_ENDPOINT || !process.env.R2_PUBLIC_DOMAIN) {
  throw new Error("Missing R2 configuration in environment variables");
}

// Function to convert string to Decimal
const toDecimal = (value: string) => {
  try {
    return new Prisma.Decimal(value);
  } catch (error) {
    throw new Error(`Invalid decimal format: ${value}`);
  }
};

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const bookSchema = t.Object({
  tieu_de: t.String(),
  gia_tien: t.String({ pattern: "^\\d+(\\.\\d{1,2})?$" }),
  gioi_thieu: t.String(),
  tong_so_trang: t.Optional(t.Number()),
  danh_gia: t.Optional(t.String({ pattern: "^\\d+(\\.\\d{1,2})?$" })),
  ngay_xuat_ban: t.Optional(t.String({ format: "date" })),
  ma_nha_xuat_ban: t.Optional(t.Number()),
  ma_bo_sach: t.Optional(t.Number()),
  ma_tac_gia: t.Optional(t.Number()),
  ma_kieu_sach: t.Optional(t.Number()),
  so_tap: t.Optional(t.Number()),
  // Additional fields for book cover images
  url_bia_chinh: t.Optional(t.String()),
  url_bia_cover: t.Optional(t.String()),
  url_bia_phu: t.Optional(t.String()),
  url_bookmark: t.Optional(t.String()),
});

const presignedSchema = t.Object({
  fileName: t.String(),
  mimeType: t.String(),
});

export const elysiaUPLOADER = new Elysia({ prefix: "/upload" })
  
  .post(
    "/book",
    async ({ body, set }) => {
      try {
        // Validate publisher if provided
        if (body.ma_nha_xuat_ban) {
          const publisher = await prisma.nha_xuat_ban.findUnique({
            where: { ma_nha_xuat_ban: body.ma_nha_xuat_ban },
          });
          if (!publisher) {
            set.status = 400;
            return { message: "Invalid publisher ID" };
          }
        }

        // Validate book series if provided
        if (body.ma_bo_sach) {
          const bookSeries = await prisma.bo_sach.findUnique({
            where: { ma_bo_sach: body.ma_bo_sach },
          });
          if (!bookSeries) {
            set.status = 400;
            return { message: "Invalid book series ID" };
          }
        }

        // Validate author if provided
        if (body.ma_tac_gia) {
          const author = await prisma.tac_gia.findUnique({
            where: { ma_tac_gia: body.ma_tac_gia },
          });
          if (!author) {
            set.status = 400;
            return { message: "Invalid author ID" };
          }
        }

        // Validate book type if provided
        if (body.ma_kieu_sach) {
          const bookType = await prisma.kieu_sach.findUnique({
            where: { ma_kieu_sach: body.ma_kieu_sach },
          });
          if (!bookType) {
            set.status = 400;
            return { message: "Invalid book type ID" };
          }
        }

        // Create a new book record
        const bookData: Prisma.sachCreateInput = {
          tieu_de: body.tieu_de,
          gia_tien: toDecimal(body.gia_tien),
          gioi_thieu: body.gioi_thieu,
          so_tap: body.so_tap,
          tong_so_trang: body.tong_so_trang,
          danh_gia: body.danh_gia ? toDecimal(body.danh_gia) : undefined,
          ngay_xuat_ban: body.ngay_xuat_ban
            ? new Date(body.ngay_xuat_ban)
            : undefined,
          ...(body.ma_nha_xuat_ban && {
            nha_xuat_ban: {
              connect: { ma_nha_xuat_ban: body.ma_nha_xuat_ban },
            },
          }),
          ...(body.ma_bo_sach && {
            bo_sach: {
              connect: { ma_bo_sach: body.ma_bo_sach },
            },
          }),
          ...(body.ma_tac_gia && {
            tac_gia: {
              connect: { ma_tac_gia: body.ma_tac_gia },
            },
          }),
          ...(body.ma_kieu_sach && {
            kieu_sach: {
              connect: { ma_kieu_sach: body.ma_kieu_sach },
            },
          }),
        };
          
        // Prepare image URLs (omit undefined values)
        const imageUrls = {
          url_bia_chinh: body.url_bia_chinh,
          url_bia_cover: body.url_bia_cover,
          url_bia_phu: body.url_bia_phu,
          url_bookmark: body.url_bookmark,
        };

        // Use transaction to ensure book and images are created atomically
        const book = await prisma.$transaction(async (tx) => {
          // Create the book record
          const createdBook = await tx.sach.create({ data: bookData });
          
          // Use upsert instead of create to handle both new and existing records
          if (Object.values(imageUrls).some(v => v !== undefined)) {
            await tx.sach_bia_sach.upsert({
              where: { ma_sach: createdBook.ma_sach },
              update: imageUrls,
              create: {
                ma_sach: createdBook.ma_sach,
                ...imageUrls,
              },
            });
          }
          
          return createdBook;
        });
        
        // Fetch the book with its cover information
        const bookWithCover = await prisma.sach.findUnique({
          where: { ma_sach: book.ma_sach },
          include: {
            sach_bia_sach: true, // Include data from sach_bia_sach table
          },
        });
        
        set.status = 201;
        return bookWithCover; // Return the complete data
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          switch (error.code) {
            case "P2002": // Unique constraint violation
              set.status = 409;
              return { message: "Duplicate entry", details: error.meta };
            case "P2003": // Foreign key constraint violation
              set.status = 400;
              return {
                message: "Foreign key constraint failed",
                details: error.meta,
              };
            default:
              set.status = 500;
              return { message: "Database error", details: error.meta };
          }
        }
        // Handle other errors
        set.status = 500;
        return {
          message: "Internal server error",
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
    { body: bookSchema } // Validate request body
  )

  // Presigned URL endpoint
  .post("/presigned", async ({ body, set }) => {
    try {
      if (!body.mimeType.startsWith("image/")) {
        set.status = 400;
        return { error: "Invalid file type. Only images allowed" };
      }

      const sanitizedKey = `uploads/${Date.now()}-${body.fileName}`
        .replace(/[^\w.-]/g, '')
        .replace(/\.\./g, '');

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: sanitizedKey,
        ContentType: body.mimeType,
      });

      const url = await getSignedUrl(r2Client, command, {
        expiresIn: 300,
        signableHeaders: new Set(["content-type"])
      });

      return {
        url: url.replace('http://', 'https://'),
        publicUrl: `https://${process.env.R2_PUBLIC_DOMAIN}/${sanitizedKey}`
      };
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to generate upload URL",
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }, { body: presignedSchema })

  // CORS preflight
  .options("/presigned", ({ set }) => {
    set.status = 204;
    return "";
  })

  // create new author
  .post('/author', async ({ body, set }) => {
    try {
      const author = await prisma.tac_gia.create({
        data: {
          ten_tac_gia: body.ten_tac_gia
        }
      });
      
      set.status = 201;
      return author;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case "P2002": // Unique constraint violation
            set.status = 409;
            return { message: "Duplicate author entry", details: error.meta };
          default:
            set.status = 500;
            return { message: "Database error", details: error.meta };
        }
      }
      // Handle other errors
      set.status = 500;
      return {
        message: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }, { body: t.Object({
    ten_tac_gia: t.String()
  })})
  
  // CORS preflight for author endpoint
  .options("/author", ({ set }) => {
    set.status = 204;
    return "";
  })
  
  // create new book series
  .post('/series', async ({ body, set }) => {
    try {
      const bookSeries = await prisma.bo_sach.create({
        data: {
          ten_bo_sach: body.ten_bo_sach
        }
      });
      
      set.status = 201;
      return bookSeries;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case "P2002": // Unique constraint violation
            set.status = 409;
            return { message: "Duplicate series entry", details: error.meta };
          default:
            set.status = 500;
            return { message: "Database error", details: error.meta };
        }
      }
      // Handle other errors
      set.status = 500;
      return {
        message: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }, { body: t.Object({
    ten_bo_sach: t.String()
  })})
  
  // CORS preflight for series endpoint
  .options("/series", ({ set }) => {
    set.status = 204;
    return "";
  })
  
  // create new publisher
  .post('/publisher', async ({ body, set }) => {
    try {
      const publisher = await prisma.nha_xuat_ban.create({
        data: {
          ten_nha_xuat_ban: body.ten_nha_xuat_ban
        }
      });
      
      set.status = 201;
      return publisher;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case "P2002": // Unique constraint violation
            set.status = 409;
            return { message: "Duplicate publisher entry", details: error.meta };
          default:
            set.status = 500;
            return { message: "Database error", details: error.meta };
        }
      }
      // Handle other errors
      set.status = 500;
      return {
        message: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }, { body: t.Object({
    ten_nha_xuat_ban: t.String()
  })})
  
  // CORS preflight for publisher endpoint
  .options("/publisher", ({ set }) => {
    set.status = 204;
    return "";
  });