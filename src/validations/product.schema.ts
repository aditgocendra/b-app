import { z } from '@hono/zod-openapi'

export const ProductSchema = z.object({
  id: z.string().uuid().openapi({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Unique identifier for the product',
  }),
  name: z.string().min(3).openapi({
    example: 'Kopi Susu Gula Aren',
    description: 'Name of the product',
  }),
  price: z.number().positive().openapi({
    example: 15000,
    description: 'Price of the product in IDR',
  }),
  stock: z.number().int().nonnegative().openapi({
    example: 100,
    description: 'Current stock available',
  }),
})

export const CreateProductSchema = ProductSchema.omit({ id: true })
export const UpdateProductSchema = CreateProductSchema.partial()

export type Product = z.infer<typeof ProductSchema>
export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
