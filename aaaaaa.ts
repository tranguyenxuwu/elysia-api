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
  so_tap: t.Optional(t.Number()),
});

const presignedSchema = t.Object({
  fileName: t.String(),
  mimeType: t.String(),
});

export const elysiaUPLOADER = new Elysia({ prefix: "/upload" })
  // CORS headers middleware
  .onAfterHandle(({ set }) => {
    set.headers = {
      "Access-Control-Allow-Origin": process.env.NODE_ENV === "production" 
        ? "https://your-domain.com" 
        : "http://127.0.0.1:5501",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  })
  
    .post(
      "/book",
      async ({ body, set }) => {
        try {
          if (body.ma_nha_xuat_ban) {
            const publisher = await prisma.nha_xuat_ban.findUnique({
              where: { ma_nha_xuat_ban: body.ma_nha_xuat_ban },
            });
            if (!publisher) {
              set.status = 400;
              return { message: "Invalid publisher ID" };
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
          };
          
          // Insert the book record into the database
          const book = await prisma.sach.create({ data: bookData });
          set.status = 201;
          return book;
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
  });