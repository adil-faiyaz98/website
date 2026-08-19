/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://sdaint-migrationworkbench.com',
  generateRobotsTxt: true,
  changefreq: 'weekly',
  priority: 0.7,
  sitemapSize: 7000,
  additionalPaths: async (config) => {
    const paths = [
      // Homepage
      { loc: '/', changefreq: 'daily', priority: 1.0 },

      // Product pages
      { loc: '/products/dell-boomi', changefreq: 'weekly', priority: 0.9 },
      { loc: '/products/informatica', changefreq: 'weekly', priority: 0.9 },
      { loc: '/products/mulesoft', changefreq: 'weekly', priority: 0.9 },
      { loc: '/products/assessment', changefreq: 'weekly', priority: 0.9 },

      // Learn pages
      { loc: '/learn/blog', changefreq: 'daily', priority: 0.8 },
      { loc: '/learn/case-studies', changefreq: 'weekly', priority: 0.8 },
      { loc: '/learn/webinars', changefreq: 'weekly', priority: 0.8 },
      { loc: '/learn/documentation', changefreq: 'weekly', priority: 0.8 },

      // Company pages
      { loc: '/company/about', changefreq: 'monthly', priority: 0.7 },
      { loc: '/company/careers', changefreq: 'weekly', priority: 0.7 },
      { loc: '/company/contact', changefreq: 'monthly', priority: 0.7 },
      { loc: '/company/partners', changefreq: 'monthly', priority: 0.7 },

      // Pricing
      { loc: '/pricing', changefreq: 'weekly', priority: 0.9 },

      // Legal pages
      { loc: '/legal/privacy', changefreq: 'yearly', priority: 0.3 },
      { loc: '/legal/terms', changefreq: 'yearly', priority: 0.3 },
      { loc: '/legal/cookies', changefreq: 'yearly', priority: 0.3 },

      // Demo
      { loc: '/demo', changefreq: 'monthly', priority: 0.8 },
    ];

    return paths.map((path) => ({
      ...path,
      lastmod: new Date().toISOString(),
    }));
  },
};
