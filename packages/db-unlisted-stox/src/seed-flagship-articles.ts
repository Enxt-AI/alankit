/**
 * Seeds the five flagship articles into the Article table.
 *
 * Before this script existed, the answer-first summary, key-facts table and
 * FAQ block lived in apps/web/lib/flagship-articles.ts. That file is deleted
 * once these rows exist, so editorial can manage the content from the CMS.
 *
 * Idempotent: matches an existing article by explicit slug or by slugified
 * title, so re-running never duplicates rows. Bodies of existing articles are
 * left untouched — only the SEO fields are (re)filled.
 *
 * Run:
 *   pnpm --filter db-unlisted-stox seed:articles
 */
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

interface FlagshipArticle {
  /** Canonical public URL slug. */
  slug: string;
  /** Title used only when the article does not exist yet. */
  title: string;
  summary: string;
  keyFacts: Array<{ label: string; value: string }>;
  faqs: Array<{ question: string; answer: string }>;
  authorName: string;
  authorRole: string;
  authorBio: string;
  reviewedBy: string;
  contentReviewedAt: string;
  /** Body HTML for newly created rows. Existing rows keep their own body. */
  content: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const AUTHOR = {
  authorName: 'UnlistedStox Editorial Team',
  authorRole: 'Senior Investment Analyst',
  authorBio:
    "The UnlistedStox editorial team covers pre-IPO and unlisted share markets in India, backed by SMC Group's decades of broking experience.",
  reviewedBy: 'SMC Compliance',
  contentReviewedAt: '2026-01-15',
};

const ARTICLES: FlagshipArticle[] = [
  {
    slug: 'how-to-buy-unlisted-shares-india',
    title: 'How to Buy Unlisted Shares in India',
    summary:
      'To buy unlisted shares in India, you need three things: a KYC-verified account, a linked Demat account (CDSL or NSDL), and a verified bank account. On UnlistedStox, you browse the unlisted share price list, place an order for the quantity you want, and pay. Once payment clears, shares are transferred off-market via demat-to-demat settlement directly into your Demat account, typically within T+1 to T+2 business days. You receive an SMS and email from your depository once the shares are credited. All transactions are backed by SMC Group and follow Companies Act, 2013 and SEBI regulations.',
    keyFacts: [
      { label: 'Minimum order', value: '1 share (price varies by company)' },
      { label: 'Settlement timeline', value: 'T+1 to T+2 business days' },
      { label: 'Transfer mode', value: 'Off-market, demat-to-demat via CDSL/NSDL' },
      { label: 'Prerequisites', value: 'KYC, Demat, and bank account verification' },
      { label: 'Regulatory backing', value: 'Companies Act, 2013; SEBI regulations; SMC Group' },
    ],
    faqs: [
      {
        question: 'Do I need a Demat account to buy unlisted shares?',
        answer:
          'Yes. Unlisted shares are credited directly to your Demat account via CDSL or NSDL. You must link and verify your Demat account before placing an order on UnlistedStox.',
      },
      {
        question: 'How long does it take to receive shares after payment?',
        answer:
          "Settlement is typically T+1 to T+2 business days after payment confirmation. You'll receive an SMS and email from your depository once shares are credited.",
      },
      {
        question: 'Is buying unlisted shares legal in India?',
        answer:
          'Yes. Buying unlisted shares is legal under the Companies Act, 2013 and SEBI regulations. All transactions on UnlistedStox are legitimate demat-to-demat off-market transfers.',
      },
    ],
    ...AUTHOR,
    content: `
<h2>What counts as an unlisted share?</h2>
<p>An unlisted share is equity in a company whose shares are not traded on a recognised stock exchange such as NSE or BSE. The company may be private, may be preparing for an IPO, or may simply have chosen not to list. Because there is no exchange order book, ownership changes hands through an off-market transfer recorded with a depository.</p>

<h2>Before you place an order</h2>
<p>Three prerequisites decide whether you can transact at all:</p>
<ul>
  <li><strong>KYC verification.</strong> Your identity must be verified before any transfer can be processed.</li>
  <li><strong>A Demat account.</strong> Unlisted shares are held in dematerialised form with CDSL or NSDL. There is no physical certificate to receive.</li>
  <li><strong>A verified bank account.</strong> Payment and refunds move through an account in your own name.</li>
</ul>
<p>Complete these steps first. An order cannot be settled into an account that has not been linked and verified.</p>

<h2>Finding a price</h2>
<p>Unlisted shares have no single published market price. Quotes are negotiated between buyer and seller, or set by a platform based on secondary-market demand and recent valuation rounds. Treat any quoted price as the current ask for that company, not as a guarantee that the same price will apply tomorrow.</p>

<h2>Placing and settling an order</h2>
<p>Once you have chosen a company and a quantity, you place the order and pay. After payment clears, the shares are moved from the seller's Demat account to yours in an off-market, demat-to-demat transfer. This is the same depository mechanism used for any private transfer of securities. Settlement typically completes within T+1 to T+2 business days.</p>
<p>When the shares are credited, your depository sends an SMS and email confirmation, and the holding appears in your Demat statement. That statement is your proof of ownership.</p>

<h2>Risks worth understanding first</h2>
<p>Unlisted shares are not the same as listed shares. Liquidity is lower, public disclosure is thinner, and there is no exchange-driven price discovery. A position may take longer to exit than a listed position. They suit investors with a medium-to-long-term horizon who have read the company's available disclosures and can tolerate that illiquidity.</p>

<h2>Quick checklist</h2>
<ol>
  <li>Complete KYC.</li>
  <li>Link and verify your Demat and bank accounts.</li>
  <li>Review the company and the current ask price.</li>
  <li>Place the order and pay.</li>
  <li>Confirm the credit in your Demat statement.</li>
</ol>
`,
  },
  {
    slug: 'is-it-safe-legal-to-buy-unlisted-shares-india',
    title: 'Is It Safe and Legal to Buy Unlisted Shares in India?',
    summary:
      'Yes, buying unlisted shares is completely legal in India under the Companies Act, 2013 and SEBI regulations. UnlistedStox executes all transactions through legitimate demat-to-demat off-market transfers via CDSL or NSDL, so ownership is recorded in your depository account just like listed shares. Shares are backed by SMC Group, and every transaction includes KYC verification, Demat linkage, and bank account verification. You receive depository-level confirmation (SMS and email) when shares are credited, providing a verifiable audit trail.',
    keyFacts: [
      { label: 'Legal framework', value: 'Companies Act, 2013; SEBI regulations' },
      { label: 'Transfer mechanism', value: 'Off-market, demat-to-demat via CDSL/NSDL' },
      { label: 'Ownership proof', value: 'Depository statement (Demat holding)' },
      { label: 'Settlement', value: 'T+1 to T+2 business days' },
      { label: 'Backed by', value: 'SMC Group' },
    ],
    faqs: [
      {
        question: 'Can I verify my unlisted share ownership?',
        answer:
          'Yes. Once credited, your unlisted shares appear in your Demat account statement (CDSL or NSDL), just like listed shares. You can verify holdings through your depository participant.',
      },
      {
        question: 'Are off-market transfers safe?',
        answer:
          'Off-market transfers through registered depositories (CDSL/NSDL) with KYC-verified counterparties are a standard, regulated mechanism for unlisted share transfers in India.',
      },
      {
        question: 'Does UnlistedStox verify sellers?',
        answer:
          'Yes. All sellers and transactions on UnlistedStox undergo KYC verification and are processed through secure off-market transfer channels backed by SMC Group.',
      },
    ],
    ...AUTHOR,
    content: `
<h2>Is it legal?</h2>
<p>Buying and selling unlisted shares is a permitted transfer of private company equity in India. The transaction is governed by the Companies Act, 2013 and by SEBI regulations, and it is executed through the depository system rather than on a stock exchange. Legality depends on the transfer being carried out correctly — through a registered depository, between KYC-verified parties — not on the shares being listed.</p>

<h2>How ownership is recorded</h2>
<p>Unlisted shares are held in dematerialised form. When a transfer completes, the shares move from the seller's Demat account to the buyer's Demat account via CDSL or NSDL. Ownership is therefore recorded at the depository, in the same way it is for listed shares. Your Demat statement is the record you can point to.</p>

<h2>What makes a transaction verifiable</h2>
<ul>
  <li><strong>KYC on both sides.</strong> Buyer and seller are identity-verified before the transfer.</li>
  <li><strong>A depository-recorded transfer.</strong> The movement of shares is logged by CDSL or NSDL, not settled privately in cash.</li>
  <li><strong>Depository confirmation.</strong> On credit, you receive an SMS and email from your depository, creating an independent record of the event.</li>
</ul>

<h2>Safety is not the same as legal</h2>
<p>A transaction can be legal and still be risky. Unlisted shares carry lower liquidity, thinner public disclosure, and no exchange-driven price discovery. The legal framework protects the mechanism of transfer; it does not guarantee a return, a buyer at your chosen price, or a short exit. Anyone buying should be comfortable holding through illiquidity.</p>

<h2>Before you transact</h2>
<p>Confirm that your KYC, Demat account, and bank account are all verified and linked. Check the quantity and price on the order before paying. After settlement, verify the credit in your Demat statement — that is the ownership evidence that outlasts any email thread.</p>
`,
  },
  {
    slug: 'difference-between-listed-and-unlisted-shares',
    title: 'Difference Between Listed and Unlisted Shares',
    summary:
      'Listed shares trade on recognized stock exchanges (NSE, BSE) with daily price discovery and high liquidity. Unlisted shares are not listed on any exchange and are traded through off-market, demat-to-demat transfers. Prices for unlisted shares are negotiated between buyer and seller or set by platforms like UnlistedStox based on secondary-market demand and recent valuation rounds. Unlisted shares typically have lower liquidity, higher minimum investment, and longer settlement (T+1 to T+2), but offer early access to high-growth pre-IPO companies.',
    keyFacts: [
      { label: 'Trading venue', value: 'Listed: NSE/BSE · Unlisted: Off-market (CDSL/NSDL)' },
      { label: 'Price discovery', value: 'Listed: Exchange-driven · Unlisted: Negotiated/platform-set' },
      { label: 'Liquidity', value: 'Listed: High · Unlisted: Lower' },
      { label: 'Settlement', value: 'Listed: T+1 · Unlisted: T+1 to T+2' },
      { label: 'Minimum investment', value: 'Listed: 1 share · Unlisted: Varies by company' },
    ],
    faqs: [
      {
        question: 'Can I sell unlisted shares on NSE or BSE?',
        answer:
          'No. Unlisted shares are not traded on recognized stock exchanges. They are sold through off-market, demat-to-demat transfers via platforms like UnlistedStox.',
      },
      {
        question: 'How is the price of unlisted shares determined?',
        answer:
          'Unlisted share prices are negotiated between buyer and seller, or set by the platform based on secondary-market demand, recent company valuation rounds, and financial performance.',
      },
      {
        question: 'Are unlisted shares more risky than listed shares?',
        answer:
          'Unlisted shares generally carry higher risk due to lower liquidity, limited public information, and less price transparency. They suit investors with a medium-to-long-term horizon.',
      },
    ],
    ...AUTHOR,
    content: `
<h2>The core difference</h2>
<p>A listed company has its shares admitted to trading on a recognised stock exchange. An unlisted company has not. That single fact drives almost every other difference — where you trade, how a price is formed, how quickly you can exit, and how much public information exists.</p>

<h2>Where shares change hands</h2>
<p>Listed shares trade on NSE or BSE through a broker. Unlisted shares do not trade on any exchange. They change hands off-market, through a demat-to-demat transfer recorded with CDSL or NSDL. Both end up in your Demat account; only one has an exchange matching buyers and sellers continuously.</p>

<h2>How prices form</h2>
<p>On an exchange, price is discovered continuously from public bids and offers. For an unlisted company there is no order book to observe. A price is negotiated between buyer and seller, or quoted by a platform from secondary-market demand and recent valuation rounds. That means the price you see is a point-in-time quote, not a last-traded price.</p>

<h2>Liquidity and exit</h2>
<p>Listed shares can generally be sold during market hours at whatever price the market clears. Unlisted positions depend on finding a buyer or a platform willing to take the other side, so exits can take longer. This is the main practical difference for most investors, and the reason unlisted shares are usually described as a medium-to-long-term holding.</p>

<h2>Information and disclosure</h2>
<p>Listed companies publish quarterly results, disclosures, and price-sensitive announcements under exchange rules. Unlisted companies have lighter public disclosure obligations, so investors rely more on company-provided information and their own diligence.</p>

<h2>Settlement</h2>
<p>Both ultimately settle into a Demat account. Listed trades follow the exchange settlement cycle, while unlisted off-market transfers typically complete within T+1 to T+2 business days after payment. Minimum investment also differs: listed shares can be bought as a single share, while unlisted minimums vary by company and price per share.</p>

<h2>Which suits whom</h2>
<p>Listed shares suit investors who value daily liquidity and public disclosure. Unlisted shares suit investors seeking earlier exposure to companies before a listing, who can accept lower liquidity and less transparency in exchange for that earlier position.</p>
`,
  },
  {
    slug: 'tax-implications-of-unlisted-stock-investments',
    title: 'Tax Implications of Unlisted Stock Investments',
    summary:
      'Capital gains on unlisted equity shares are taxed based on holding period. If you hold unlisted shares for more than 24 months, gains are Long-Term Capital Gains (LTCG) taxed at 12.5% without indexation (as per Finance Act 2024). If held for 24 months or less, gains are Short-Term Capital Gains (STCG) and taxed at your applicable individual income tax slab rate. The holding period is calculated from the date of allotment/credit to your Demat account to the date of sale.',
    keyFacts: [
      { label: 'Long-term holding period', value: 'More than 24 months' },
      { label: 'LTCG tax rate', value: '12.5% without indexation (Finance Act 2024)' },
      { label: 'Short-term holding period', value: '24 months or less' },
      { label: 'STCG tax rate', value: 'Your individual income tax slab rate' },
      { label: 'Holding period start', value: 'Date of credit to Demat account' },
    ],
    faqs: [
      {
        question: 'What is the holding period for LTCG on unlisted shares?',
        answer:
          'For unlisted equity shares, a holding period of more than 24 months qualifies as Long-Term Capital Gains.',
      },
      {
        question: 'What is the LTCG tax rate on unlisted shares?',
        answer: '12.5% without indexation, as per Finance Act 2024.',
      },
      {
        question: 'How are short-term gains taxed?',
        answer:
          'Short-term gains (held 24 months or less) are added to your income and taxed at your applicable individual income tax slab rate.',
      },
    ],
    ...AUTHOR,
    // Existing row (article-seed-5) keeps its own body.
    content: '',
  },
  {
    slug: 'understanding-pre-ipo-investments-a-complete-guide',
    title: 'Understanding Pre-IPO Investments: A Complete Guide',
    summary:
      'Investing in pre-IPO companies means buying unlisted shares before a company lists on a stock exchange. On UnlistedStox, the process is: (1) complete KYC, (2) link and verify your Demat and bank accounts, (3) browse upcoming or active unlisted stocks, (4) place an order within the minimum/maximum quantity limits, (5) pay, and (6) receive shares in your Demat account via off-market transfer within T+1 to T+2 business days. Pre-IPO investing suits investors with a medium-to-long-term horizon who want early exposure to high-growth companies.',
    keyFacts: [
      { label: 'Investment horizon', value: 'Medium to long-term' },
      { label: 'Settlement timeline', value: 'T+1 to T+2 business days' },
      { label: 'Transfer mode', value: 'Off-market, demat-to-demat via CDSL/NSDL' },
      { label: 'Prerequisites', value: 'KYC, Demat, and bank account verification' },
      { label: 'Backed by', value: 'SMC Group' },
    ],
    faqs: [
      {
        question: 'What is pre-IPO investing?',
        answer:
          'Pre-IPO investing means buying shares in a company before it lists on a stock exchange, typically at a price below the expected IPO price.',
      },
      {
        question: 'Who can invest in pre-IPO shares?',
        answer:
          'Any Indian resident with a KYC-verified account, a linked Demat account, and a verified bank account can invest in pre-IPO shares on UnlistedStox.',
      },
      {
        question: 'What happens after a pre-IPO company lists?',
        answer:
          'After listing, pre-IPO shares become freely tradable on the stock exchange. You can continue holding them or sell them through the exchange at market prices.',
      },
    ],
    ...AUTHOR,
    // Existing row (article-seed-1) keeps its own body.
    content: '',
  },
];

async function main() {
  console.log('Seeding flagship articles...');

  const existing = await prisma.article.findMany({
    select: { id: true, title: true, slug: true, content: true },
  });

  const bySlug = new Map<string, (typeof existing)[number]>();
  for (const row of existing) {
    bySlug.set(row.slug ?? slugify(row.title), row);
  }

  for (const article of ARTICLES) {
    const match = bySlug.get(article.slug);
    const seo = {
      title: match?.title ?? article.title,
      slug: article.slug,
      summary: article.summary,
      keyFacts: article.keyFacts,
      authorName: article.authorName,
      authorRole: article.authorRole,
      authorBio: article.authorBio,
      reviewedBy: article.reviewedBy,
      contentReviewedAt: new Date(article.contentReviewedAt),
      isActive: true,
    };

    const faqRows = article.faqs.map((faq, index) => ({
      question: faq.question,
      answer: faq.answer,
      order: index,
    }));

    if (match) {
      await prisma.article.update({
        where: { id: match.id },
        data: {
          ...seo,
          // Never overwrite an existing body.
          ...(match.content ? {} : { content: article.content }),
          faqs: { deleteMany: {}, create: faqRows },
        },
      });
      console.log(`  updated  ${article.slug} (${match.id})`);
    } else {
      await prisma.article.create({
        data: {
          ...seo,
          content: article.content,
          faqs: { create: faqRows },
        },
      });
      console.log(`  created  ${article.slug}`);
    }
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
