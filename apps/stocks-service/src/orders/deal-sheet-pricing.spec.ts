jest.mock('redis-service', () => ({}));
import { PdfGeneratorService } from './pdf-generator.service';
import { OrdersService } from './orders.service';
import { GenerateESignSessionDto } from './dto/generate-esign-session.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Deal Sheet & e-Sign Pricing', () => {
  describe('GenerateESignSessionDto', () => {
    it('validates and accepts pricing fields', async () => {
      const plain = {
        stockId: 'stock-123',
        quantity: 10,
        couponCode: 'SAVE10',
        stockPrice: 1000,
        discountedPrice: 9000,
        discountedPricePerShare: 900,
        pricePerShare: 900,
      };

      const dto = plainToInstance(GenerateESignSessionDto, plain);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.stockPrice).toBe(1000);
      expect(dto.discountedPrice).toBe(9000);
      expect(dto.discountedPricePerShare).toBe(900);
      expect(dto.pricePerShare).toBe(900);
    });
  });

  describe('PdfGeneratorService.buildDealSheetData', () => {
    let pdfService: PdfGeneratorService;

    beforeEach(() => {
      pdfService = new PdfGeneratorService();
    });

    it('sets formatted discounted price, total consideration, and template discount variables', () => {
      const user = {
        fullName: 'John Doe',
        kycData: { panDetails: { pan: 'ABCDE1234F', name: 'JOHN DOE' } },
        dematData: { dpId: 'IN300000', clientId: '12345678' },
        bankData: { bankName: 'HDFC Bank', accNo: '11223344', ifsc: 'HDFC0001234' },
      };
      const stock = {
        name: 'TATA CONSULTANCY SERVICES',
        isin: 'INE467B01029',
        price: 1000,
      };
      const order = {
        quantity: 10,
        totalAmount: 9000,
        pricePerShare: 900,
        basePrice: 1000,
        discountAmount: 1000,
      };

      const dealData = pdfService.buildDealSheetData(user, stock, order);

      expect(dealData.quantity).toBe('10');
      expect(dealData.price).toBe('900');
      expect(dealData.total_consideration).toBe('INR 9,000');
      expect(dealData.base_price).toBe('1000');
      expect(dealData.discounted_price).toBe('INR 9,000');
      expect(dealData.discounted_price_per_share).toBe('900');
      expect(dealData.discount_amount).toBe('INR 1,000');
    });
  });

  describe('OrdersService eSign session forwarding and reconciliation', () => {
    let ordersService: any;
    let mockEsignRequests: any;
    let mockPrisma: any;
    let mockRedis: any;
    let mockCoupons: any;
    let mockPdfGenerator: any;
    let mockAlankitEsign: any;

    beforeEach(() => {
      mockEsignRequests = {
        generate: jest.fn().mockResolvedValue({ docId: 'doc-123' }),
      };
      mockPrisma = {
        user: { findUnique: jest.fn() },
        stock: { findUnique: jest.fn() },
        eSignTemplate: { findFirst: jest.fn().mockResolvedValue({ templateId: 'tpl-1', pdfUrl: 'http://template' }) },
        esignAttempt: { upsert: jest.fn().mockResolvedValue({}) },
      };
      mockRedis = {
        set: jest.fn().mockResolvedValue('OK'),
      };
      mockCoupons = {
        validateCoupon: jest.fn().mockResolvedValue({ couponId: 'c1', discountAmount: 1000 }),
      };
      mockPdfGenerator = {
        buildDealSheetData: jest.fn().mockReturnValue({}),
        fillDealSheet: jest.fn().mockResolvedValue(Buffer.from('%PDF-test')),
      };
      mockAlankitEsign = {
        createTransaction: jest.fn().mockResolvedValue({
          referenceNo: '343434112544',
          redirectUrl: 'https://provider.example/sign?refno=343434112544',
          sourceObjectKey: '9e973dda-69e5-46e7-9e83-a65cfd08605d.pdf',
        }),
      };

      ordersService = Object.create(OrdersService.prototype);
      Object.assign(ordersService, {
        esignRequests: mockEsignRequests,
        prisma: mockPrisma,
        redisService: mockRedis,
        couponsService: mockCoupons,
        pdfGeneratorService: mockPdfGenerator,
        alankitEsign: mockAlankitEsign,
        configService: { get: jest.fn().mockReturnValue('test') },
        logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
        normalizeESignDocId: (id: string) => id.trim(),
        logEsignAttempt: jest.fn().mockResolvedValue({}),
        resolveSlabPrice: OrdersService.prototype['resolveSlabPrice'],
      });
    });

    it('forwards pricing fields in generateESignSession queue payload', async () => {
      const dto: GenerateESignSessionDto = {
        stockId: 'stock-1',
        quantity: 10,
        couponCode: 'OFFER10',
        stockPrice: 1000,
        discountedPrice: 9000,
        discountedPricePerShare: 900,
        pricePerShare: 900,
      };

      await ordersService.generateESignSession('user-1', dto, 'req-1');

      expect(mockEsignRequests.generate).toHaveBeenCalledWith(
        'generate-session',
        {
          userId: 'user-1',
          dto: {
            stockId: 'stock-1',
            basketId: null,
            quantity: 10,
            couponCode: 'OFFER10',
            stockPrice: 1000,
            discountedPrice: 9000,
            discountedPricePerShare: 900,
            pricePerShare: 900,
          },
        },
        'req-1',
      );
    });

    it('processGenerateESignSession reconciles verified pricing and saves to redis intent', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', fullName: 'Alice' });
      mockPrisma.stock.findUnique.mockResolvedValue({
        id: 'stock-1',
        name: 'HDFC Ltd',
        isin: 'INE001A01036',
        price: 1000,
        discountSlabs: [
          { minAmount: 5000, pricePerShare: 950 },
        ],
      });

      ordersService.fetchESignHtml = jest.fn().mockResolvedValue('<html>{{price}}</html>');

      const dto: GenerateESignSessionDto = {
        stockId: 'stock-1',
        quantity: 10, // 10 * 1000 = 10,000 -> matches slab 5000 -> slab price 950 -> slabTotal = 9500
        couponCode: 'SAVE1000', // coupon discount = 1000 -> verified discounted total = 8500, per share = 850
      };

      const session = await ordersService.processGenerateESignSession('user-1', dto);

      expect(mockPrisma.stock.findUnique).toHaveBeenCalledWith({
        where: { id: 'stock-1' },
        select: { name: true, isin: true, price: true, discountSlabs: true },
      });

      expect(mockCoupons.validateCoupon).toHaveBeenCalledWith('SAVE1000', 'stock-1', 10, 'user-1');

      expect(mockPdfGenerator.buildDealSheetData).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        expect.objectContaining({ name: 'HDFC Ltd' }),
        expect.objectContaining({
          quantity: 10,
          totalAmount: 8500,
          pricePerShare: 850,
          basePrice: 1000,
          discountAmount: 1500,
        }),
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        'esign:intent:user-1',
        expect.objectContaining({
          stockPrice: 1000,
          basePrice: 1000,
          pricePerShare: 850,
          discountedPricePerShare: 850,
          discountedPrice: 8500,
          totalAmount: 8500,
          discountAmount: 1500,
        }),
        7200,
      );
      expect(mockAlankitEsign.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
        signerName: 'Alice',
        location: 'India',
        pdf: Buffer.from('%PDF-test'),
      }));
      expect(session).toEqual({
        docId: '343434112544',
        eSignUrl: 'https://provider.example/sign?refno=343434112544',
        pdfUrl: '',
      });
    });
  });
});
