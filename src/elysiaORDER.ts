import { PrismaClient, Prisma } from "@prisma/client"; // Import PrismaClient và các kiểu liên quan
import { Elysia, t } from "elysia"; // Import Elysia và t từ elysia

// --- Khởi tạo Prisma Client ngay trong file này ---
const prisma = new PrismaClient();
// Bạn có thể thêm logging hoặc error formatting nếu muốn
// prisma.$on('query', (e) => { console.log('Query: ' + e.query) });

const CreateCustomerSchema = t.Object({
    ten_khach_hang: t.Optional(t.String({ maxLength: 520 })),
    phone: t.String({ minLength: 10, maxLength: 10 }),
    email: t.Optional(t.String({ format: 'email', maxLength: 100 })),
    dia_chi: t.String({ maxLength: 2083 }),
    so_nha: t.String({ maxLength: 520 })
});

// Schema cho một chi tiết đơn hàng trong request tạo đơn hàng
const OrderDetailSchema = t.Object({
    ma_sach: t.Integer({ minimum: 1 }),
    so_luong: t.Integer({ minimum: 1 }),
    gia_tien: t.Number()
});

// Schema để tạo đơn hàng mới
const CreateOrderSchema = t.Object({
    ma_khach_hang: t.Integer({ minimum: 1 }),
    chi_tiet: t.Array(OrderDetailSchema, { minItems: 1 })
});

// --- Định nghĩa Elysia plugin/instance ---
// Export instance này để index.ts có thể sử dụng
export const elysiaORDER = new Elysia({ prefix: '/customer' })

    // ---- Route Tạo Khách Hàng Mới ----
    .post(
        '/create', // Endpoint: POST 
        async ({ body, set }) => {
            try {
                // Sử dụng instance `prisma` đã khởi tạo ở trên
                const newCustomer = await prisma.thong_tin_khach_hang.create({
                    data: {
                        ten_khach_hang: body.ten_khach_hang,
                        phone: body.phone,
                        email: body.email,
                        dia_chi: body.dia_chi,
                        so_nha: body.so_nha,
                    }
                });

                set.status = 201; // Created
                return { message: 'Tạo khách hàng thành công!', data: newCustomer };

            } catch (error) {
                console.error("Lỗi khi tạo khách hàng:", error); // Log lỗi ra console

                // Xử lý lỗi Prisma cụ thể
                if (error instanceof Prisma.PrismaClientKnownRequestError) {
                    // Lỗi unique constraint (ví dụ: trùng SĐT)
                    if (error.code === 'P2002') {
                        set.status = 409; // Conflict
                        const fields = (error.meta as any)?.target as string[] | undefined;
                        return {
                            error: 'Xung đột dữ liệu',
                            message: `Khách hàng với ${fields?.includes('phone') ? 'số điện thoại' : fields?.includes('email') ? 'email' : 'thông tin'} này đã tồn tại.`
                        };
                    }
                    // Các lỗi Prisma khác có thể xử lý thêm ở đây
                }

                // Lỗi chung
                set.status = 500; // Internal Server Error
                return {
                    error: "Lỗi máy chủ",
                    message: "Không thể tạo khách hàng vào lúc này.",
                    // Chỉ trả về chi tiết lỗi nếu ở môi trường dev hoặc cần thiết
                    // details: error instanceof Error ? error.message : String(error)
                };
            }
        },
        {
            body: CreateCustomerSchema, // Áp dụng validation
            detail: {
                summary: 'Tạo khách hàng mới',
                tags: ['Khách hàng']
            }
        }
    )

    // ---- Route Tạo Đơn Hàng Mới ----
    .post(
        '/new-order', // Endpoint: POST 
        async ({ body, set }) => {
            try {
                // Sử dụng instance `prisma`
                const newOrder = await prisma.don_hang.create({
                    data: {
                        ma_khach_hang: body.ma_khach_hang,
                        don_hang_chi_tiet: {
                            create: body.chi_tiet.map(item => ({
                                ma_sach: item.ma_sach,
                                so_luong: item.so_luong,
                                gia_tien: item.gia_tien
                            }))
                        }
                    },
                    include: { // Bao gồm dữ liệu liên quan
                        thong_tin_khach_hang: { select: { ma_khach_hang: true, ten_khach_hang: true } },
                        don_hang_chi_tiet: { include: { sach: { select: { ma_sach: true, tieu_de: true } } } }
                    }
                });

                set.status = 201; // Created
                return { message: 'Tạo đơn hàng thành công!', data: newOrder };

            } catch (error) {
                console.error("Lỗi khi tạo đơn hàng:", error); // Log lỗi

                // Xử lý lỗi Prisma
                if (error instanceof Prisma.PrismaClientKnownRequestError) {
                    // Lỗi foreign key constraint (khách hàng hoặc sách không tồn tại)
                    if (error.code === 'P2003' || error.code === 'P2025') {
                         set.status = 400; // Bad Request (vì client gửi ID không hợp lệ)
                         let resource = 'Tài nguyên liên quan';
                         const fieldName = (error.meta as any)?.field_name as string | undefined;
                         if (fieldName?.includes('ma_khach_hang')) {
                            resource = 'Khách hàng';
                         } else if (fieldName?.includes('ma_sach')) {
                            resource = 'Sách';
                         }
                         return {
                            error: 'Dữ liệu không hợp lệ',
                            message: `${resource} với ID cung cấp không tồn tại.`
                         };
                    }
                     // Các lỗi Prisma khác
                }

                // Lỗi chung
                set.status = 500; // Internal Server Error
                return {
                    error: "Lỗi máy chủ",
                    message: "Không thể tạo đơn hàng vào lúc này.",
                    // details: error instanceof Error ? error.message : String(error)
                };
            }
        },
        {
            body: CreateOrderSchema, // Áp dụng validation
            detail: {
                summary: 'Tạo đơn hàng mới',
                tags: ['Đơn hàng']
            }
        }
    );

// --- Export ---
// Đảm bảo bạn export instance `elysiaORDER`