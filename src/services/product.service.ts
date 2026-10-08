import { prisma } from '../db/prisma'
import { logger } from '../utils/logger'
import type { CreateProductInput } from '../validations/product.schema'

export class ProductService {
  /**
   * Mengambil semua data produk
   */
  static async getAllProducts() {
    logger.info('Fetching all products from database')
    // Asumsi schema prisma memiliki model Product
    // Return mock data for now since we haven't defined schema.prisma completely
    // return prisma.product.findMany()
    return [] 
  }

  /**
   * Menambahkan produk baru
   */
  static async createProduct(data: CreateProductInput) {
    logger.info({ data }, 'Creating new product')
    // return prisma.product.create({ data })
    return {
      id: crypto.randomUUID(),
      ...data,
    }
  }

  /**
   * Mengurangi stok (contoh logika transaksi terpusat di Service)
   */
  static async decrementStock(productId: string, quantity: number) {
    logger.info({ productId, quantity }, 'Decrementing product stock')
    // Logika transaksi database bisa menggunakan prisma.$transaction
    // if stock < quantity throw error
    // return prisma.product.update({ ... })
    return true
  }
}
