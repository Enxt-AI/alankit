import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { delKey } from 'redis-service';
import { PrismaService } from '../prisma/prisma.service';
import { StocksService } from '../stocks/stocks.service';
import { PinoNestLogger } from '@repo/logger';

@Injectable()
export class ApprovalsService {
  private readonly logger = new PinoNestLogger('stocks-service', 'ApprovalsService');

  constructor(
    private prisma: PrismaService,
    private stocksService: StocksService,
  ) {}

  /**
   * Helper to sanitize stockId and ensure foreign key integrity
   */
  private async sanitizeStockId(
    stockId?: string | null,
  ): Promise<string | null | undefined> {
    if (stockId === undefined) return undefined;
    if (
      !stockId ||
      typeof stockId !== 'string' ||
      stockId === '_none' ||
      stockId.trim() === ''
    ) {
      return null;
    }
    try {
      const stockExists = await this.prisma.stock.findUnique({
        where: { id: stockId.trim() },
        select: { id: true },
      });
      return stockExists ? stockExists.id : null;
    } catch {
      return null;
    }
  }

  async getApprovalStats() {
    const [pending, approved, rejected] = await Promise.all([
      this.prisma.changeRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.changeRequest.count({ where: { status: 'APPROVED' } }),
      this.prisma.changeRequest.count({ where: { status: 'REJECTED' } }),
    ]);
    return {
      pending,
      approved,
      rejected,
      total: pending + approved + rejected,
    };
  }

  private async enrichChangeRequests(requests: any[]) {
    if (!requests || requests.length === 0) return [];

    // Collect entity IDs by type
    const stockIds = Array.from(
      new Set(
        requests
          .filter((r) => (r.entityType === 'STOCK_PRICING' || r.entityType === 'STOCK') && r.entityId)
          .map((r) => r.entityId as string),
      ),
    );

    const revenueTypes = Array.from(
      new Set(
        requests
          .filter((r) => r.entityType === 'REVENUE_SHARING')
          .map((r) => r.proposedData?.type || r.proposedData?.data?.type)
          .filter(Boolean),
      ),
    );

    const staticPageIds = Array.from(
      new Set(
        requests
          .filter((r) => r.entityType === 'STATIC_PAGE' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    );

    const faqIds = Array.from(
      new Set(
        requests
          .filter((r) => r.entityType === 'FAQ' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    );

    const newsIds = Array.from(
      new Set(
        requests
          .filter((r) => r.entityType === 'NEWS' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    );

    const articleIds = Array.from(
      new Set(
        requests
          .filter((r) => r.entityType === 'ARTICLE' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    );

    const categoryIds = Array.from(
      new Set(
        requests
          .filter((r) => r.entityType === 'STOCK_CATEGORY' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    );

    const upcomingStockIds = Array.from(
      new Set(
        requests
          .filter((r) => r.entityType === 'UPCOMING_STOCK' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    );

    const basketIds = Array.from(
      new Set(
        requests
          .filter((r) => r.entityType === 'BASKET' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    );

    const testimonialIds = Array.from(
      new Set(
        requests
          .filter((r) => r.entityType === 'TESTIMONIAL' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    );

    // Parallel fetch of baseline DB records
    const [
      stocks,
      revenueSettings,
      staticPages,
      faqs,
      newsItems,
      articles,
      categories,
      upcomingStocks,
      baskets,
      testimonials,
    ] = await Promise.all([
      stockIds.length > 0 ? this.prisma.stock.findMany({ where: { id: { in: stockIds } } }) : [],
      revenueTypes.length > 0 ? this.prisma.revenueShareSetting.findMany({ where: { type: { in: revenueTypes } } }) : [],
      staticPageIds.length > 0 ? this.prisma.staticPage.findMany({ where: { id: { in: staticPageIds } } }) : [],
      faqIds.length > 0 ? this.prisma.faq.findMany({ where: { id: { in: faqIds } } }) : [],
      newsIds.length > 0 ? this.prisma.news.findMany({ where: { id: { in: newsIds } } }) : [],
      articleIds.length > 0 ? this.prisma.article.findMany({ where: { id: { in: articleIds } }, include: { faqs: { orderBy: { order: 'asc' } } } }) : [],
      categoryIds.length > 0 ? this.prisma.stockCategory.findMany({ where: { id: { in: categoryIds } } }) : [],
      upcomingStockIds.length > 0 ? this.prisma.upcomingStock.findMany({ where: { id: { in: upcomingStockIds } } }) : [],
      basketIds.length > 0 ? this.prisma.stockBasket.findMany({ where: { id: { in: basketIds } } }) : [],
      testimonialIds.length > 0 ? this.prisma.testimonial.findMany({ where: { id: { in: testimonialIds } } }) : [],
    ]);

    const stockMap = new Map<string, any>();
    stocks.forEach((s: any) => stockMap.set(s.id, s));

    const revenueMap = new Map<string, any>();
    revenueSettings.forEach((rs: any) => revenueMap.set(rs.type, rs));

    const staticPageMap = new Map<string, any>();
    staticPages.forEach((p: any) => staticPageMap.set(p.id, p));

    const faqMap = new Map<string, any>();
    faqs.forEach((f: any) => faqMap.set(f.id, f));

    const newsMap = new Map<string, any>();
    newsItems.forEach((n: any) => newsMap.set(n.id, n));

    const articleMap = new Map<string, any>();
    articles.forEach((a: any) => articleMap.set(a.id, a));

    const categoryMap = new Map<string, any>();
    categories.forEach((c: any) => categoryMap.set(c.id, c));

    const upcomingStockMap = new Map<string, any>();
    upcomingStocks.forEach((u: any) => upcomingStockMap.set(u.id, u));

    const basketMap = new Map<string, any>();
    baskets.forEach((b: any) => basketMap.set(b.id, b));

    const testimonialMap = new Map<string, any>();
    testimonials.forEach((t: any) => testimonialMap.set(t.id, t));

    const FIELD_LABELS: Record<string, string> = {
      price: 'Base Selling Price',
      backupQuantity: 'Stock Backup Quantity',
      internalLendingPrice: 'Internal Lending Price',
      externalLendingPrice: 'External Lending Price',
      isActive: 'Status',
      isPopular: 'Popular Tag',
      isMarketMover: 'Market Mover Tag',
      minimumPurchaseQuantity: 'Min Purchase Quantity',
      minPurchaseQuantity: 'Min Purchase Quantity',
      maximumPurchaseQuantity: 'Max Purchase Quantity',
      maxPurchaseQuantity: 'Max Purchase Quantity',
      lotSize: 'Lot Size',
      pan: 'PAN Number',
      isin: 'ISIN Code',
      cin: 'CIN Number',
      slug: 'URL Slug',
      name: 'Name',
      title: 'Title',
      answer: 'Answer',
      content: 'Page Content',
      summary: 'Summary',
      metaTitle: 'Meta Title',
      metaDescription: 'Meta Description',
      performanceMetrics: 'Performance Metrics',
      category: 'Category',
      categoryId: 'Category ID',
      stockId: 'Associated Stock',
      companyOverview: 'Company Overview',
      financialOverview: 'Financial Overview',
      managementOverview: 'Management Overview',
      logoUrl: 'Logo Image',
      coverImageUrl: 'Cover Image',
      imageUrl: 'Image',
      discountSlabs: 'Discount Slabs',
      retailPrice: 'Retail Price',
      description: 'Description',
      sector: 'Sector',
      author: 'Author',
      readTimeMinutes: 'Read Time (Mins)',
      isFeatured: 'Featured Tag',
      expectedIpoDate: 'Expected IPO Date',
      expectedPrice: 'Expected Price',
      minInvestment: 'Min Investment',
      clientName: 'Client Name',
      clientRole: 'Client Role',
      rating: 'Rating',
      revenuePercentage: 'Revenue Percentage',
      incentivePercentage: 'Incentive Percentage',
    };

    // 5. Enrich each request
    return requests.map((req) => {
      const proposedData = (req.proposedData || {}) as Record<string, any>;
      const snapshot = (proposedData._snapshot || {}) as Record<string, any>;
      const cleanProposed = { ...proposedData };
      delete cleanProposed._snapshot;

      // Extract inner data if payload wraps fields in a `data` object
      const targetProposed = cleanProposed.data && typeof cleanProposed.data === 'object'
        ? { ...cleanProposed.data }
        : { ...cleanProposed };
      delete targetProposed.action;
      delete targetProposed.label;

      // Retrieve DB record based on entityType
      let dbRecord: any = null;
      if (req.entityType === 'STOCK' || req.entityType === 'STOCK_PRICING') {
        dbRecord = stockMap.get(req.entityId);
      } else if (req.entityType === 'STATIC_PAGE') {
        dbRecord = staticPageMap.get(req.entityId);
      } else if (req.entityType === 'FAQ') {
        dbRecord = faqMap.get(req.entityId);
      } else if (req.entityType === 'NEWS') {
        dbRecord = newsMap.get(req.entityId);
      } else if (req.entityType === 'ARTICLE') {
        dbRecord = articleMap.get(req.entityId);
      } else if (req.entityType === 'STOCK_CATEGORY') {
        dbRecord = categoryMap.get(req.entityId);
      } else if (req.entityType === 'UPCOMING_STOCK') {
        dbRecord = upcomingStockMap.get(req.entityId);
      } else if (req.entityType === 'BASKET') {
        dbRecord = basketMap.get(req.entityId);
      } else if (req.entityType === 'TESTIMONIAL') {
        dbRecord = testimonialMap.get(req.entityId);
      } else if (req.entityType === 'REVENUE_SHARING') {
        const revType = cleanProposed.type || targetProposed.type || 'INTERNAL';
        dbRecord = revenueMap.get(revType);
      }

      const baseline = snapshot && Object.keys(snapshot).length > 0 ? { ...dbRecord, ...snapshot } : dbRecord;

      // Article SEO blocks are nested/JSON. Flatten them into readable text so
      // the reviewer sees the actual Q&A instead of "[object Object]".
      if (req.entityType === 'ARTICLE') {
        const flattenKeyFacts = (v: any) =>
          Array.isArray(v)
            ? v.map((f: any) => `${f.label}: ${f.value}`).join('\n')
            : v;
        const flattenFaqs = (v: any) =>
          Array.isArray(v)
            ? v.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
            : v;

        if (targetProposed.keyFacts !== undefined) {
          targetProposed.keyFacts = flattenKeyFacts(targetProposed.keyFacts);
        }
        if (targetProposed.faqs !== undefined) {
          targetProposed.faqs = flattenFaqs(targetProposed.faqs);
        }
        if (baseline) {
          if (baseline.keyFacts !== undefined) {
            baseline.keyFacts = flattenKeyFacts(baseline.keyFacts);
          }
          if (baseline.faqs !== undefined) {
            baseline.faqs = flattenFaqs(baseline.faqs);
          }
        }
      }

      // Determine human-friendly entity name
      let entityName = '';
      if (req.entityType === 'STATIC_PAGE') {
        entityName =
          baseline?.title ||
          targetProposed.title ||
          cleanProposed.label?.replace(/^(Create|Edit|Delete)\s+page:\s*/i, '') ||
          (targetProposed.slug ? `Page: /${targetProposed.slug}` : 'Static Page');
      } else if (req.entityType === 'FAQ') {
        entityName =
          baseline?.title ||
          targetProposed.title ||
          cleanProposed.label?.replace(/^(Create|Edit|Delete)\s+FAQ:\s*/i, '') ||
          'FAQ';
      } else if (req.entityType === 'STOCK' || req.entityType === 'STOCK_PRICING') {
        entityName =
          dbRecord?.name ||
          baseline?.name ||
          snapshot.stockName ||
          cleanProposed.label?.replace(/^Edit stock:\s*/i, '')?.replace(/^Create stock:\s*/i, '') ||
          targetProposed.name ||
          'Unlisted Stock';
      } else if (req.entityType === 'NEWS') {
        entityName =
          baseline?.title ||
          targetProposed.title ||
          cleanProposed.label?.replace(/^(Create|Edit|Delete)\s+news:\s*/i, '') ||
          'News Item';
      } else if (req.entityType === 'ARTICLE') {
        entityName =
          baseline?.title ||
          targetProposed.title ||
          cleanProposed.label?.replace(/^(Create|Edit|Delete)\s+article:\s*/i, '') ||
          'Article';
      } else if (req.entityType === 'UPCOMING_STOCK') {
        entityName =
          baseline?.name ||
          targetProposed.name ||
          cleanProposed.label?.replace(/^(Create|Edit|Delete)\s+upcoming stock:\s*/i, '') ||
          'Upcoming Stock';
      } else if (req.entityType === 'STOCK_CATEGORY') {
        entityName =
          baseline?.name ||
          targetProposed.name ||
          cleanProposed.label?.replace(/^(Create|Edit|Delete)\s+category:\s*/i, '') ||
          'Stock Category';
      } else if (req.entityType === 'BASKET') {
        entityName =
          baseline?.name ||
          targetProposed.name ||
          cleanProposed.label?.replace(/^(Create|Edit|Delete)\s+basket:\s*/i, '') ||
          'Stock Basket';
      } else if (req.entityType === 'TESTIMONIAL') {
        entityName =
          baseline?.clientName ||
          targetProposed.clientName ||
          cleanProposed.label?.replace(/^(Create|Edit|Delete)\s+testimonial:\s*/i, '') ||
          'Testimonial';
      } else if (req.entityType === 'REVENUE_SHARING') {
        const revType = cleanProposed.type || targetProposed.type || 'INTERNAL';
        entityName = `Revenue Sharing (${revType})`;
      } else {
        entityName = targetProposed.title || targetProposed.name || cleanProposed.label || req.entityType.replace(/_/g, ' ');
      }

      const diff: Array<{
        field: string;
        label: string;
        currentValue: any;
        proposedValue: any;
        delta?: number | null;
        percentChange?: number | null;
      }> = [];

      const currentData: Record<string, any> = {};

      const formatVal = (v: any) =>
        v != null ? (typeof v === 'boolean' ? (v ? 'Active' : 'Inactive') : v) : '—';

      if (cleanProposed.action === 'DELETE') {
        diff.push({
          field: 'action',
          label: 'Requested Action',
          currentValue: 'Active Record in Catalog',
          proposedValue: 'Delete / Remove from Catalog',
        });
        if (baseline) {
          currentData.baseline = baseline;
        }
      } else if (baseline) {
        for (const key of Object.keys(targetProposed)) {
          if (['_snapshot', 'action', 'label', 'id', 'updatedAt', 'createdAt', 'createdById', 'updatedById'].includes(key)) continue;

          const curVal = (baseline as any)[key];
          const propVal = targetProposed[key];

          let isSame = false;
          if (curVal === propVal) {
            isSame = true;
          } else if ((curVal === null || curVal === undefined || curVal === '') && (propVal === null || propVal === undefined || propVal === '')) {
            isSame = true;
          } else {
            const numCur = curVal != null && typeof curVal !== 'boolean' && !isNaN(Number(curVal)) ? Number(curVal) : null;
            const numProp = propVal != null && typeof propVal !== 'boolean' && !isNaN(Number(propVal)) ? Number(propVal) : null;
            if (numCur !== null && numProp !== null && Math.abs(numCur - numProp) < 0.00001) {
              isSame = true;
            } else {
              const boolCur = typeof curVal === 'boolean' ? curVal : curVal === 'true' ? true : curVal === 'false' ? false : null;
              const boolProp = typeof propVal === 'boolean' ? propVal : propVal === 'true' ? true : propVal === 'false' ? false : null;
              if (boolCur !== null && boolProp !== null && boolCur === boolProp) {
                isSame = true;
              } else if (typeof curVal === 'object' && typeof propVal === 'object' && curVal != null && propVal != null) {
                try {
                  isSame = JSON.stringify(curVal) === JSON.stringify(propVal);
                } catch {
                  isSame = false;
                }
              } else if (typeof curVal === 'string' && typeof propVal === 'string') {
                isSame = curVal.trim() === propVal.trim();
              }
            }
          }

          if (formatVal(curVal) === formatVal(propVal)) {
            isSame = true;
          }

          if (!isSame) {
            currentData[key] = curVal;
            const isNum = curVal != null && propVal != null && !isNaN(Number(curVal)) && !isNaN(Number(propVal));
            const delta = isNum ? Number(propVal) - Number(curVal) : null;
            const isPriceField = ['price', 'internalLendingPrice', 'externalLendingPrice'].includes(key);
            const percentChange = isPriceField && isNum && Number(curVal) > 0 ? ((Number(propVal) - Number(curVal)) / Number(curVal)) * 100 : null;

            diff.push({
              field: key,
              label: FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
              currentValue: formatVal(curVal),
              proposedValue: formatVal(propVal),
              delta: delta !== null ? Number(delta.toFixed(2)) : null,
              percentChange: percentChange !== null ? Number(percentChange.toFixed(2)) : null,
            });
          }
        }

        // If diff is empty and request is APPROVED or REJECTED:
        // Show the proposed fields against snapshot/baseline so audit comparison remains visible!
        if (diff.length === 0 && (req.status === 'APPROVED' || req.status === 'REJECTED')) {
          for (const key of Object.keys(targetProposed)) {
            if (['_snapshot', 'action', 'label', 'id', 'updatedAt', 'createdAt', 'createdById', 'updatedById'].includes(key)) continue;
            if (targetProposed[key] !== undefined && targetProposed[key] !== null) {
              const snapVal = snapshot ? snapshot[key] : null;
              diff.push({
                field: key,
                label: FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
                currentValue: snapVal != null ? formatVal(snapVal) : (req.status === 'APPROVED' ? 'Current Baseline' : '—'),
                proposedValue: formatVal(targetProposed[key]),
                delta: null,
                percentChange: null,
              });
            }
          }
        }
      } else {
        // New record creation
        for (const key of Object.keys(targetProposed)) {
          if (['_snapshot', 'action', 'label', 'id', 'updatedAt', 'createdAt', 'createdById', 'updatedById'].includes(key)) continue;
          diff.push({
            field: key,
            label: FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
            currentValue: 'None (New Record)',
            proposedValue: formatVal(targetProposed[key]),
          });
        }
      }

      const isin = baseline?.isin || targetProposed.isin || null;
      const cin = baseline?.cin || targetProposed.cin || null;
      const logoUrl = baseline?.logoUrl || targetProposed.logoUrl || baseline?.coverImageUrl || targetProposed.coverImageUrl || null;

      return {
        ...req,
        entityName,
        entityDetails: {
          name: entityName,
          slug: targetProposed.slug || baseline?.slug || null,
          title: targetProposed.title || baseline?.title || entityName,
          category: targetProposed.category || baseline?.category || null,
          isin,
          cin,
          logoUrl,
          currentPrice: baseline?.price ?? null,
          currentInternalLendingPrice: baseline?.internalLendingPrice ?? null,
          currentExternalLendingPrice: baseline?.externalLendingPrice ?? null,
          currentDiscountSlabs: baseline?.discountSlabs ?? [],
          currentIsActive: baseline?.isActive ?? true,
        },
        currentData: Object.keys(currentData).length > 0 ? currentData : (baseline || null),
        proposedData: cleanProposed,
        diff,
      };
    });
  }

  async getRequestsByStatus(status: string) {
    const raw = await this.prisma.changeRequest.findMany({
      where: { status },
      include: {
        requestedBy: {
          select: { id: true, fullName: true, email: true },
        },
        reviewedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.enrichChangeRequests(raw);
  }

  async getRequestHistory() {
    const raw = await this.prisma.changeRequest.findMany({
      where: {
        status: { in: ['APPROVED', 'REJECTED'] },
      },
      include: {
        requestedBy: {
          select: { id: true, fullName: true, email: true },
        },
        reviewedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return this.enrichChangeRequests(raw);
  }

  async approveRequest(id: string, adminId: string, reviewNote?: string) {
    const request = await this.prisma.changeRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Change request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    const rawProposed = (request.proposedData || {}) as any;
    let snapshot = rawProposed._snapshot;
    if (!snapshot && request.entityId) {
      if (request.entityType === 'STOCK' || request.entityType === 'STOCK_PRICING') {
        const currentStock = await this.prisma.stock.findUnique({ where: { id: request.entityId } });
        if (currentStock) snapshot = JSON.parse(JSON.stringify(currentStock));
      } else if (request.entityType === 'STATIC_PAGE') {
        const currentPage = await this.prisma.staticPage.findUnique({ where: { id: request.entityId } });
        if (currentPage) snapshot = JSON.parse(JSON.stringify(currentPage));
      } else if (request.entityType === 'FAQ') {
        const currentFaq = await this.prisma.faq.findUnique({ where: { id: request.entityId } });
        if (currentFaq) snapshot = JSON.parse(JSON.stringify(currentFaq));
      } else if (request.entityType === 'NEWS') {
        const currentNews = await this.prisma.news.findUnique({ where: { id: request.entityId } });
        if (currentNews) snapshot = JSON.parse(JSON.stringify(currentNews));
      } else if (request.entityType === 'ARTICLE') {
        const currentArticle = await this.prisma.article.findUnique({ where: { id: request.entityId } });
        if (currentArticle) snapshot = JSON.parse(JSON.stringify(currentArticle));
      } else if (request.entityType === 'STOCK_CATEGORY') {
        const currentCat = await this.prisma.stockCategory.findUnique({ where: { id: request.entityId } });
        if (currentCat) snapshot = JSON.parse(JSON.stringify(currentCat));
      } else if (request.entityType === 'UPCOMING_STOCK') {
        const currentUpcoming = await this.prisma.upcomingStock.findUnique({ where: { id: request.entityId } });
        if (currentUpcoming) snapshot = JSON.parse(JSON.stringify(currentUpcoming));
      } else if (request.entityType === 'TESTIMONIAL') {
        const currentTest = await this.prisma.testimonial.findUnique({ where: { id: request.entityId } });
        if (currentTest) snapshot = JSON.parse(JSON.stringify(currentTest));
      } else if (request.entityType === 'BASKET') {
        const currentBasket = await this.prisma.stockBasket.findUnique({ where: { id: request.entityId } });
        if (currentBasket) snapshot = JSON.parse(JSON.stringify(currentBasket));
      }
    }

    const proposedData = { ...rawProposed };
    delete proposedData._snapshot;

    if (request.entityType === 'STOCK' || request.entityType === 'STOCK_PRICING') {
      const dataToApply = proposedData.data && typeof proposedData.data === 'object' ? proposedData.data : proposedData;
      const { id: _id, createdAt: _c, updatedAt: _u, action: _act, label: _lbl, _snapshot: _snap, ...cleanUpdateData } = dataToApply;

      // CMS forms submit "" for "no category" — Prisma rejects "" as an FK
      // value (P2003 → 500). The stored representation of "no category" is null.
      if ((cleanUpdateData as any).categoryId === '') {
        (cleanUpdateData as any).categoryId = null;
      }

      if (proposedData.action === 'DELETE') {
        if (request.entityId) {
          await this.prisma.stock.update({
            where: { id: request.entityId },
            data: { isActive: false, updatedById: adminId },
          });
          await this.stocksService.invalidateCache(request.entityId);
        }
      } else if (proposedData.action === 'CREATE') {
        const createdStock = await this.prisma.stock.create({
          data: {
            ...cleanUpdateData,
            createdById: adminId,
            updatedById: adminId,
          },
        });
        await this.stocksService.invalidateCache(createdStock.id);
      } else {
        if (!request.entityId) throw new BadRequestException('Entity ID missing for Stock update');
        await this.prisma.stock.update({
          where: { id: request.entityId },
          data: {
            ...cleanUpdateData,
            updatedById: adminId,
          },
        });
        await this.stocksService.invalidateCache(request.entityId);
      }
    } else if (request.entityType === 'REVENUE_SHARING') {
      await this.prisma.revenueShareSetting.upsert({
        where: { type: proposedData.type },
        update: proposedData,
        create: proposedData,
      });
    } else if (request.entityType === 'BASKET') {
      throw new BadRequestException('Basket approvals are no longer supported.');
    } else if (request.entityType === 'FAQ') {
      const dataToApply =
        proposedData.data && typeof proposedData.data === 'object' ? proposedData.data : proposedData;
      const { action: _act, label: _lbl, id: _id, createdAt: _c, updatedAt: _u, _snapshot: _snap, ...faqDto } =
        dataToApply as Record<string, any>;

      delete faqDto.stock;
      if ('stockId' in faqDto) {
        faqDto.stockId = await this.sanitizeStockId(faqDto.stockId);
      }

      if (proposedData.action === 'DELETE') {
        if (request.entityId) {
          await this.prisma.faq.delete({ where: { id: request.entityId } });
        }
      } else if (proposedData.action === 'CREATE') {
        await this.prisma.faq.create({
          data: {
            title: faqDto.title,
            answer: faqDto.answer,
            category: faqDto.category,
            isActive: faqDto.isActive !== undefined ? faqDto.isActive : true,
            stockId: faqDto.stockId ?? null,
          },
        });
      } else {
        if (!request.entityId) throw new BadRequestException('Entity ID missing for FAQ update');
        await this.prisma.faq.update({
          where: { id: request.entityId },
          data: {
            ...faqDto,
            stockId: 'stockId' in faqDto ? (faqDto.stockId ?? null) : undefined,
          },
        });
      }
    } else if (request.entityType === 'STATIC_PAGE') {
      const dataToApply =
        proposedData.data && typeof proposedData.data === 'object' ? proposedData.data : proposedData;
      const { action: _act, label: _lbl, id: _id, createdAt: _c, updatedAt: _u, _snapshot: _snap, ...pageDto } =
        dataToApply as Record<string, any>;

      if (proposedData.action === 'DELETE') {
        if (request.entityId) {
          await this.prisma.staticPage.delete({ where: { id: request.entityId } });
        }
      } else if (proposedData.action === 'CREATE') {
        await this.prisma.staticPage.create({
          data: {
            slug: pageDto.slug,
            title: pageDto.title,
            content: pageDto.content || '',
            metaTitle: pageDto.metaTitle || null,
            metaDescription: pageDto.metaDescription || null,
            performanceMetrics: pageDto.performanceMetrics !== undefined ? pageDto.performanceMetrics : undefined,
            isActive: pageDto.isActive !== undefined ? pageDto.isActive : true,
            createdById: adminId,
            updatedById: adminId,
          },
        });
      } else {
        if (!request.entityId) throw new BadRequestException('Entity ID missing for Static Page update');
        await this.prisma.staticPage.update({
          where: { id: request.entityId },
          data: {
            ...pageDto,
            updatedById: adminId,
          },
        });
      }
    } else if (request.entityType === 'NEWS') {
      const dataToApply =
        proposedData.data && typeof proposedData.data === 'object' ? proposedData.data : proposedData;
      const { action: _act, label: _lbl, id: _id, createdAt: _c, updatedAt: _u, _snapshot: _snap, ...newsDto } =
        dataToApply as Record<string, any>;

      delete newsDto.stock;
      delete newsDto.contentLikes;
      delete newsDto.author;
      if ('stockId' in newsDto) {
        newsDto.stockId = await this.sanitizeStockId(newsDto.stockId);
      }

      if (proposedData.action === 'DELETE') {
        if (request.entityId) await this.prisma.news.delete({ where: { id: request.entityId } });
      } else if (proposedData.action === 'CREATE') {
        await this.prisma.news.create({
          data: {
            ...newsDto,
            stockId: newsDto.stockId ?? null,
          } as any,
        });
      } else {
        if (!request.entityId) throw new BadRequestException('Entity ID missing for News update');
        await this.prisma.news.update({
          where: { id: request.entityId },
          data: {
            ...newsDto,
            stockId: 'stockId' in newsDto ? (newsDto.stockId ?? null) : undefined,
          } as any,
        });
      }
    } else if (request.entityType === 'ARTICLE') {
      const dataToApply =
        proposedData.data && typeof proposedData.data === 'object' ? proposedData.data : proposedData;
      const { action: _act, label: _lbl, id: _id, createdAt: _c, updatedAt: _u, _snapshot: _snap, ...articleDto } =
        dataToApply as Record<string, any>;

      delete articleDto.stock;
      delete articleDto.contentLikes;
      delete articleDto.author;
      if ('stockId' in articleDto) {
        articleDto.stockId = await this.sanitizeStockId(articleDto.stockId);
      }

      // `faqs` is a relation, not a column: convert to nested writes.
      // `contentReviewedAt` arrives as an ISO string from the JSON payload.
      const { faqs, contentReviewedAt, ...articleScalar } = articleDto;
      const articleData: Record<string, any> = { ...articleScalar };
      if (contentReviewedAt !== undefined) {
        articleData.contentReviewedAt = contentReviewedAt
          ? new Date(contentReviewedAt)
          : null;
      }

      if (proposedData.action === 'DELETE') {
        if (request.entityId) await this.prisma.article.delete({ where: { id: request.entityId } });
      } else if (proposedData.action === 'CREATE') {
        await this.prisma.article.create({
          data: {
            ...articleData,
            stockId: articleData.stockId ?? null,
            faqs: Array.isArray(faqs) && faqs.length
              ? {
                  create: faqs.map((faq: any, index: number) => ({
                    question: faq.question,
                    answer: faq.answer,
                    order: faq.order ?? index,
                  })),
                }
              : undefined,
          } as any,
        });
      } else {
        if (!request.entityId) throw new BadRequestException('Entity ID missing for Article update');
        await this.prisma.article.update({
          where: { id: request.entityId },
          data: {
            ...articleData,
            stockId: 'stockId' in articleDto ? (articleData.stockId ?? null) : undefined,
            faqs: Array.isArray(faqs)
              ? {
                  deleteMany: {},
                  create: faqs.map((faq: any, index: number) => ({
                    question: faq.question,
                    answer: faq.answer,
                    order: faq.order ?? index,
                  })),
                }
              : undefined,
          } as any,
        });
      }
    } else if (request.entityType === 'STOCK_CATEGORY') {
      const dataToApply =
        proposedData.data && typeof proposedData.data === 'object' ? proposedData.data : proposedData;
      const { action: _act, label: _lbl, id: _id, createdAt: _c, updatedAt: _u, _snapshot: _snap, ...catDto } =
        dataToApply as Record<string, any>;

      if (proposedData.action === 'DELETE') {
        if (request.entityId) await this.prisma.stockCategory.delete({ where: { id: request.entityId } });
      } else if (proposedData.action === 'CREATE') {
        await this.prisma.stockCategory.create({ data: catDto as any });
      } else {
        if (!request.entityId) throw new BadRequestException('Entity ID missing for Stock Category update');
        await this.prisma.stockCategory.update({ where: { id: request.entityId }, data: catDto as any });
      }
      await delKey('stocks:categories:active');
    } else if (request.entityType === 'UPCOMING_STOCK') {
      const dataToApply =
        proposedData.data && typeof proposedData.data === 'object' ? proposedData.data : proposedData;
      const { action: _act, label: _lbl, id: _id, createdAt: _c, updatedAt: _u, _snapshot: _snap, ...upcomingDto } =
        dataToApply as Record<string, any>;

      if (proposedData.action === 'DELETE') {
        if (request.entityId) await this.prisma.upcomingStock.delete({ where: { id: request.entityId } });
      } else if (proposedData.action === 'CREATE') {
        await this.prisma.upcomingStock.create({
          data: {
            ...upcomingDto,
            name: upcomingDto.name,
            price: Number(upcomingDto.price || 0),
            cin: upcomingDto.cin,
            createdById: adminId,
            updatedById: adminId,
          } as any,
        });
      } else {
        if (!request.entityId) throw new BadRequestException('Entity ID missing for Upcoming Stock update');
        await this.prisma.upcomingStock.update({
          where: { id: request.entityId },
          data: {
            ...upcomingDto,
            price: upcomingDto.price !== undefined ? Number(upcomingDto.price) : undefined,
            updatedById: adminId,
          } as any,
        });
      }
    } else if (request.entityType === 'TESTIMONIAL') {
      const dataToApply =
        proposedData.data && typeof proposedData.data === 'object' ? proposedData.data : proposedData;
      const { action: _act, label: _lbl, id: _id, createdAt: _c, updatedAt: _u, _snapshot: _snap, ...testDto } =
        dataToApply as Record<string, any>;

      if (proposedData.action === 'DELETE') {
        if (request.entityId) await this.prisma.testimonial.delete({ where: { id: request.entityId } });
      } else if (proposedData.action === 'CREATE') {
        await this.prisma.testimonial.create({ data: testDto as any });
      } else {
        if (!request.entityId) throw new BadRequestException('Entity ID missing for Testimonial update');
        await this.prisma.testimonial.update({ where: { id: request.entityId }, data: testDto as any });
      }
    }

    // Mark as approved and preserve pre-approval snapshot
    return this.prisma.changeRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: adminId,
        reviewNote,
        proposedData: {
          ...rawProposed,
          ...(snapshot ? { _snapshot: snapshot } : {}),
        },
      },
    });
  }

  async rejectRequest(id: string, adminId: string, reviewNote?: string) {
    const request = await this.prisma.changeRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Change request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    return this.prisma.changeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: adminId,
        reviewNote,
      },
    });
  }

  async clearAllPendingRequests(adminId?: string, action: 'REJECT' | 'DELETE' = 'REJECT', reviewNote?: string) {
    if (action === 'DELETE') {
      const result = await this.prisma.changeRequest.deleteMany({
        where: { status: 'PENDING' },
      });
      return { count: result.count, action: 'DELETED' };
    }

    const result = await this.prisma.changeRequest.updateMany({
      where: { status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewedById: adminId || null,
        reviewNote: reviewNote || 'Cleared by admin',
      },
    });
    return { count: result.count, action: 'REJECTED' };
  }
}
