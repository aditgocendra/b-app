import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { ProductSchema, CreateProductSchema } from '../validations/product.schema'
import { ProductService } from '../services/product.service'
import { checkRole } from '../middlewares/auth'

export const productRouter = new OpenAPIHono()

// --- DEFINE ROUTES (OPENAPI) ---

const getProductsRoute = createRoute({
  method: 'get',
  path: '/',
  summary: 'Get all products',
  description: 'Retrieve a list of all products in the system',
  responses: {
    200: {
      description: 'List of products',
      content: {
        'application/json': {
          schema: z.array(ProductSchema),
        },
      },
    },
  },
})

const createProductRoute = createRoute({
  method: 'post',
  path: '/',
  summary: 'Create a new product',
  description: 'Add a new product to the catalog',
  middleware: [checkRole('admin')] as const, // RBAC check
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateProductSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Product created successfully',
      content: {
        'application/json': {
          schema: ProductSchema,
        },
      },
    },
    400: {
      description: 'Bad Request / Validation Error',
    },
  },
})

// --- HANDLERS ---

productRouter.openapi(getProductsRoute, async (c) => {
  const products = await ProductService.getAllProducts()
  return c.json(products, 200)
})

productRouter.openapi(createProductRoute, async (c) => {
  const data = c.req.valid('json')
  const newProduct = await ProductService.createProduct(data)
  return c.json(newProduct as any, 201)
})
